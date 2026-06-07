import { spawn } from "node:child_process";
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
      cachedPythonPath = c;
      return c;
    }
  }
  cachedPythonPath = "python3";
  return cachedPythonPath;
}

/**
 * Promise-based async check if a Python module is importable.
 * Never blocks the event loop — no execSync.
 */
async function checkModuleAvailable(python: string, module: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(python, ["-c", `import ${module}`], {
      stdio: "ignore",
    });
    const timer = setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 15000);
    proc.on("error", () => { clearTimeout(timer); resolve(false); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

/**
 * Async pip install a package — non-blocking, uses spawn.
 */
async function pipInstall(python: string, pkg: string): Promise<boolean> {
  return new Promise((resolve) => {
    // First try --user
    const args = ["-m", "pip", "install", "--quiet", pkg];
    const proc = spawn(python, [...args, "--user"], {
      stdio: ["ignore", "inherit", "inherit"],
      timeout: 180000,
    });
    const timer = setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 180000);
    proc.on("error", () => { clearTimeout(timer); resolve(false); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) { resolve(true); return; }
      // Retry with --break-system-packages
      const proc2 = spawn(python, [...args, "--break-system-packages"], {
        stdio: ["ignore", "inherit", "inherit"],
        timeout: 180000,
      });
      const timer2 = setTimeout(() => { proc2.kill(); resolve(false); }, 180000);
      proc2.on("error", () => { clearTimeout(timer2); resolve(false); });
      proc2.on("close", (code2) => {
        clearTimeout(timer2);
        resolve(code2 === 0);
      });
    });
  });
}

/**
 * One-time background install of maigret.
 * Called on first `runMaigret` — subsequent calls use cached result.
 */
async function ensureMaigretInstalled(python: string): Promise<boolean> {
  // Quick check — already imported?
  const available = await checkModuleAvailable(python, "maigret");
  if (available) return true;

  if (maigretInstallPromise) return maigretInstallPromise;

  maigretInstallPromise = (async () => {
    console.log("[maigret] installing maigret==0.6.1 (one-time, ~60-180s)...");
    const ok = await pipInstall(python, "maigret==0.6.1");
    if (ok) {
      const verified = await checkModuleAvailable(python, "maigret");
      if (verified) {
        console.log("[maigret] install complete");
        return true;
      }
    }
    console.error("[maigret] install failed");
    return false;
  })();

  return maigretInstallPromise;
}

/**
 * Start background installation of maigret on module load.
 * This runs parallel to the first request — by the time the first
 * search completes (httpChecker+WMN, ~30s), maigret may be ready.
 */
let backgroundInstallStarted = false;
export function startBackgroundInstall(): void {
  if (backgroundInstallStarted || !isRunnerPresent()) return;
  backgroundInstallStarted = true;
  const python = getPythonPath();
  // Fire-and-forget
  ensureMaigretInstalled(python).then((ok) => {
    if (ok) console.log("[maigret] background install ready");
  }).catch(() => {});
}

function isRunnerPresent(): boolean {
  return existsSync(getRunnerPath());
}

function getRunnerPath(): string {
  if (cachedRunnerPath) return cachedRunnerPath;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../scripts/maigret_runner.py"),
    resolve(here, "../../../scripts/maigret_runner.py"),
    resolve(here, "../../scripts/maigret_runner.py"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) { cachedRunnerPath = c; return c; }
  }
  cachedRunnerPath = candidates[0];
  return cachedRunnerPath;
}

/**
 * Returns true if the runner script is bundled in dist/.
 * Does NOT check if Python or maigret are installed — that happens
 * at runtime in ensureMaigretInstalled (async, non-blocking).
 */
export function isMaigretAvailable(): boolean {
  return isRunnerPresent();
}

/**
 * Returns true if maigret is fully ready (runner + Python + maigret package).
 * Non-blocking — on first call it starts background install.
 */
export async function ensureMaigretReady(): Promise<boolean> {
  if (!isRunnerPresent()) return false;
  const python = getPythonPath();
  // Fast check — existing cached install
  const ok = await checkModuleAvailable(python, "maigret");
  if (ok) return true;
  // Start install (or wait for already-started install)
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
  // Check if maigret is usable (install if needed)
  const ok = await ensureMaigretInstalled(python);
  if (!ok) {
    // Maigret not available — return empty result instead of crashing
    return { username, found: [], totalFound: 0, elapsedSeconds: 0 };
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
