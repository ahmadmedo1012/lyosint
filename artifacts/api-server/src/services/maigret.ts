import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Maigret username existence checker
 * Source: https://github.com/soxoj/maigret (MIT)
 *
 * Runs Maigret v0.6.1 as a Python subprocess to leverage its 3155-site database
 * and accurate detection logic (CSRF tokens, redirects, JSON APIs, etc.).
 *
 * Communication protocol: stdin JSON config → stdout JSON result.
 *
 * Python resolution order:
 *   1. process.env.MAIGRET_PYTHON
 *   2. /usr/local/bin/python3, /usr/bin/python3 (Docker image)
 *   3. "python3" / "python" on PATH (Render native runtime, system Ubuntu)
 *
 * Maigret install order:
 *   1. If `import maigret` works → use it
 *   2. Otherwise `pip install --user maigret==0.6.1` (cached for next call)
 */

export interface MaigretProfile {
  site: string;
  url: string | null;
  category: string;
  httpStatus: number | null;
  detectionMethod: string;
  fullname: string | null;
  bio: string | null;
  image: string | null;
  extra: Record<string, string>;
  isPriority?: boolean;
}

export interface MaigretResult {
  username: string;
  found: MaigretProfile[];
  totalFound: number;
  elapsedSeconds: number;
  sitesChecked?: number;
  priorityHits?: number;
}

// Major social media sites — Maigret ranks these LOW (3120+) because they
// require login to detect. We force-include them so the search always tries
// the platforms users care about most.
export const PRIORITY_SOCIAL_SITES = [
  "Twitter", "X", "Facebook", "Instagram", "LinkedIn", "YouTube", "TikTok",
  "Reddit", "Pinterest", "Snapchat", "Tumblr", "Twitch", "Discord", "Telegram",
  "WhatsApp", "Mastodon", "Threads", "Bluesky", "VK", "Weibo", "QQ", "WeChat",
  "Gravatar", "GitHub", "GitLab", "Bitbucket", "StackOverflow", "Medium",
  "Substack", "Blogger", "WordPress", "Flickr", "Vimeo",
  "SoundCloud", "Bandcamp", "DeviantArt", "Behance", "Dribbble", "Figma",
  "About.me", "Wattpad", "Quora",
];

export interface MaigretCheckOptions {
  timeoutMs?: number;       // per-site HTTP timeout (passed to Python)
  maxConnections?: number;  // concurrent connections
  maxSites?: number;        // cap number of sites to check (0 = all)
}

let cachedPythonPath: string | null = null;
let cachedRunnerPath: string | null = null;
let maigretInstallAttempted = false;
let maigretInstallPromise: Promise<boolean> | null = null;

function getPythonPath(): string {
  if (cachedPythonPath) return cachedPythonPath;
  // Look for python3 in PATH, fall back to common locations
  const candidates = [
    process.env.MAIGRET_PYTHON,
    "/usr/local/bin/python3",
    "/usr/bin/python3",
    "python3",
    "python",
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (c.startsWith("/")) {
      if (existsSync(c)) { cachedPythonPath = c; return c; }
    } else {
      // In PATH — trust it
      cachedPythonPath = c;
      return c;
    }
  }
  cachedPythonPath = "python3";
  return cachedPythonPath;
}

async function ensureMaigretInstalled(python: string): Promise<boolean> {
  // Check if maigret is importable
  try {
    execSync(`${python} -c "import maigret"`, { stdio: "ignore", timeout: 10000 });
    return true;
  } catch {}

  if (maigretInstallPromise) return maigretInstallPromise;

  maigretInstallPromise = (async () => {
    try {
      console.log("[maigret] installing maigret==0.6.1 via pip (one-time, ~60s)...");
      const userFlag = (() => {
        try {
          // On Render Ubuntu, --user works. On system Python it might be PEP 668 protected.
          execSync(`${python} -m pip --version`, { stdio: "ignore", timeout: 5000 });
          return "";
        } catch {
          return "--break-system-packages";
        }
      })();
      // Try --user first (Render Ubuntu), fall back to --break-system-packages
      const flags = userFlag || "--user";
      execSync(
        `${python} -m pip install --quiet ${flags} "maigret==0.6.1"`,
        { stdio: ["ignore", "inherit", "inherit"], timeout: 180000 },
      );
      // Verify
      execSync(`${python} -c "import maigret"`, { stdio: "ignore", timeout: 10000 });
      console.log("[maigret] install complete");
      return true;
    } catch (err) {
      console.error("[maigret] install failed:", (err as Error).message);
      return false;
    } finally {
      maigretInstallAttempted = true;
    }
  })();

  return maigretInstallPromise;
}

function getRunnerPath(): string {
  if (cachedRunnerPath) return cachedRunnerPath;
  // Source: src/services/maigret.ts -> ../../../scripts/maigret_runner.py
  // Bundled: dist/index.mjs -> ../scripts/maigret_runner.py (copied by build)
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../scripts/maigret_runner.py"),  // bundled
    resolve(here, "../../../scripts/maigret_runner.py"),  // source layout
    resolve(here, "../../scripts/maigret_runner.py"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) { cachedRunnerPath = c; return c; }
  }
  // Default to bundled path (will error visibly if missing)
  cachedRunnerPath = candidates[0];
  return cachedRunnerPath;
}

export function isMaigretAvailable(): boolean {
  // Available if the runner script is bundled in dist/
  // (Python + maigret itself may need runtime install on native runtimes)
  return existsSync(getRunnerPath());
}

export async function ensureMaigretReady(): Promise<boolean> {
  if (!isMaigretAvailable()) return false;
  const python = getPythonPath();
  return ensureMaigretInstalled(python);
}

export async function runMaigret(
  username: string,
  options: MaigretCheckOptions = {},
): Promise<MaigretResult> {
  if (!username || typeof username !== "string" || username.length < 1) {
    return { username, found: [], totalFound: 0, elapsedSeconds: 0 };
  }
  const runnerPath = getRunnerPath();
  if (!existsSync(runnerPath)) {
    throw new Error(`maigret_runner.py not found at ${runnerPath}`);
  }
  const python = getPythonPath();
  // Best-effort install (no-op if already present, 60-180s on first call)
  const ok = await ensureMaigretInstalled(python);
  if (!ok) {
    throw new Error("maigret python package not available and install failed");
  }

  const config = {
    username,
    timeout: Math.max(2, Math.floor((options.timeoutMs ?? 8000) / 1000)),
    max_connections: Math.max(5, Math.min(options.maxConnections ?? 25, 50)),
    max_sites: options.maxSites ?? 500,
    priority_sites: PRIORITY_SOCIAL_SITES,
  };

  return new Promise<MaigretResult>((resolvePromise, rejectPromise) => {
    const proc = spawn(python, [runnerPath], {
      stdio: ["pipe", "pipe", "ignore"],  // ignore stderr (maigret progress)
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let resolved = false;
    const finish = (fn: () => void) => {
      if (resolved) return;
      resolved = true;
      try { proc.kill("SIGTERM"); } catch {}
      setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} }, 2000);
      fn();
    };

    // Hard timeout (max wait = maxSites / maxConnections * timeout + buffer + priority_sites overhead)
    const hardTimeoutMs = options.timeoutMs ?? 8000;
    const maxWaitMs = Math.max(20000, Math.min(
      ((config.max_sites + 50) / config.max_connections) * config.timeout * 1000 + 8000,
      120000,  // absolute cap of 120s
    ));
    const hardTimer = setTimeout(() => {
      finish(() => rejectPromise(new Error(`maigret hard timeout after ${maxWaitMs}ms`)));
    }, maxWaitMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    proc.on("error", (err) => {
      clearTimeout(hardTimer);
      finish(() => rejectPromise(err));
    });

    proc.on("close", (code) => {
      clearTimeout(hardTimer);
      if (resolved) return;
      try {
        if (!stdout.trim()) {
          finish(() => rejectPromise(new Error(`maigret exited ${code} with empty output`)));
          return;
        }
        const parsed = JSON.parse(stdout);
        if (parsed.error) {
          finish(() => rejectPromise(new Error(parsed.error)));
          return;
        }
        finish(() => resolvePromise(parsed as MaigretResult));
      } catch (err: any) {
        finish(() => rejectPromise(new Error(`maigret parse error: ${err.message}; raw=${stdout.slice(0, 200)}`)));
      }
    });

    // Write config to stdin and close
    try {
      proc.stdin.write(JSON.stringify(config));
      proc.stdin.end();
    } catch (err: any) {
      clearTimeout(hardTimer);
      finish(() => rejectPromise(err));
    }
  });
}
