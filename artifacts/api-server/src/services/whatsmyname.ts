import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * WhatsMyName username existence checker
 * Source: https://github.com/WebBreacher/WhatsMyName (CC BY-SA 4.0)
 *
 * Uses the bundled wmn-data.json (732 sites) to check for a username's
 * existence across a large set of platforms, using two detection strategies:
 *   - status_code: HTTP status differs between found (e_code) and missing (m_code)
 *   - message: HTTP status is the same, but body contains e_string (found)
 *     or m_string (missing).
 */

export interface WMNSite {
  name: string;
  uri_check: string;
  uri_pretty?: string;
  e_code: number;
  e_string?: string;
  m_code: number;
  m_string?: string;
  cat: string;
  known?: string[];
  post_body?: string;
  headers?: Record<string, string>;
  protection?: string[];
  strip_bad_char?: boolean;
}

export interface WMNResult {
  siteName: string;
  slug: string;
  category: string;
  uri: string;
  uriPretty: string | null;
  eCode: number;
  mCode: number;
  found: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  detectionMethod: "status_code" | "message";
  error?: string;
}

export interface WMNCheckOptions {
  concurrency?: number;
  perSiteTimeoutMs?: number;
  globalTimeoutMs?: number;
  siteNames?: string[];
  maxSites?: number;
}

let cachedSites: WMNSite[] | null = null;

function getDataFilePath(): string {
  // Source: src/services/whatsmyname.ts -> src/data/wmn-data.json
  // Bundled: dist/index.mjs -> dist/data/wmn-data.json
  // Try bundled location first (sibling of index.mjs), then fall back to source location
  const here = dirname(fileURLToPath(import.meta.url));
  const bundled = resolve(here, "data", "wmn-data.json");
  if (existsSync(bundled)) return bundled;
  const source = resolve(here, "..", "data", "wmn-data.json");
  if (existsSync(source)) return source;
  return bundled; // default to bundled path (will error visibly if missing)
}

export function loadWMNData(): WMNSite[] {
  if (cachedSites) return cachedSites;
  try {
    const raw = readFileSync(getDataFilePath(), "utf8");
    const parsed = JSON.parse(raw) as { sites: WMNSite[] };
    cachedSites = Array.isArray(parsed.sites) ? parsed.sites : [];
    return cachedSites;
  } catch (err) {
    console.error("[whatsmyname] failed to load wmn-data.json:", err);
    cachedSites = [];
    return cachedSites;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function buildUrl(uriCheck: string, username: string): string {
  return uriCheck.replace(/\{account\}/g, encodeURIComponent(username));
}

interface SiteResult {
  site: WMNSite;
  found: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  error?: string;
}

async function checkOneSite(
  site: WMNSite,
  username: string,
  perSiteTimeoutMs: number,
  globalSignal?: AbortSignal,
): Promise<SiteResult> {
  const url = buildUrl(site.uri_check, username);
  const start = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), perSiteTimeoutMs);
  // Chain the global signal: when global fires, also abort this request
  const onGlobalAbort = () => controller.abort();
  if (globalSignal) {
    if (globalSignal.aborted) controller.abort();
    else globalSignal.addEventListener("abort", onGlobalAbort, { once: true });
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": "LYOSINT-OSINT-Bot/3.0 (compatible; +https://lyosint.onrender.com)",
      Accept: "text/html,application/json,*/*",
      "Accept-Language": "en-US,en;q=0.5",
      ...(site.headers ?? {}),
    };

    const fetchOpts: RequestInit = {
      method: site.post_body ? "POST" : "GET",
      headers,
      signal: controller.signal,
      redirect: "follow",
    };

    if (site.post_body) {
      fetchOpts.body = site.post_body.replace(/\{account\}/g, encodeURIComponent(username));
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const resp = await fetch(url, fetchOpts);
    const httpStatus = resp.status;
    const body = await resp.text();
    const elapsed = Date.now() - start;

    let found = false;

    if (site.e_code !== site.m_code) {
      found = httpStatus === site.e_code;
    } else {
      const eStr = site.e_string?.toLowerCase() ?? "";
      const mStr = site.m_string?.toLowerCase() ?? "";
      const bodyLower = body.toLowerCase();
      if (eStr && mStr) {
        const hasE = bodyLower.includes(eStr);
        const hasM = bodyLower.includes(mStr);
        if (hasM && !hasE) found = false;
        else if (hasE && !hasM) found = true;
        else found = httpStatus === site.e_code;
      } else {
        found = httpStatus === site.e_code;
      }
    }

    return { site, found, httpStatus, responseTimeMs: elapsed };
  } catch (err: any) {
    return {
      site,
      found: false,
      httpStatus: null,
      responseTimeMs: Date.now() - start,
      error: err?.name === "AbortError" ? "timeout" : (err?.message ?? "request_failed"),
    };
  } finally {
    clearTimeout(timeout);
    if (globalSignal) globalSignal.removeEventListener("abort", onGlobalAbort);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  abortSignal?: AbortSignal,
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let idx = 0;
  let aborted = false;

  const onAbort = () => { aborted = true; };
  if (abortSignal) {
    if (abortSignal.aborted) aborted = true;
    else abortSignal.addEventListener("abort", onAbort, { once: true });
  }

  async function worker() {
    while (true) {
      if (aborted) return;
      const i = idx++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i]);
      } catch {
        results[i] = undefined;
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  if (abortSignal) abortSignal.removeEventListener("abort", onAbort);
  return results as R[];
}

export async function checkWhatsMyName(
  username: string,
  options: WMNCheckOptions = {},
): Promise<WMNResult[]> {
  if (!username || typeof username !== "string" || username.length < 1) return [];

  const allSites = loadWMNData();
  if (allSites.length === 0) return [];

  let sites = allSites;
  if (options.siteNames && options.siteNames.length > 0) {
    const wanted = new Set(options.siteNames.map((n) => n.toLowerCase()));
    sites = sites.filter((s) => wanted.has(s.name.toLowerCase()));
  }
  if (options.maxSites && options.maxSites > 0) {
    sites = sites.slice(0, options.maxSites);
  }

  const concurrency = Math.max(1, Math.min(options.concurrency ?? 20, 50));
  const perSiteTimeoutMs = Math.max(1000, options.perSiteTimeoutMs ?? 8000);
  const globalTimeoutMs = Math.max(10000, options.globalTimeoutMs ?? 60000);

  // Global timeout: abort all in-flight requests when wall-clock limit hits
  const globalController = new AbortController();
  const globalTimeout = setTimeout(() => globalController.abort(), globalTimeoutMs);

  // mapWithConcurrency respects the abort signal — workers stop dispatching new items
  // and the function returns once in-flight requests complete
  const settled = await mapWithConcurrency(
    sites,
    concurrency,
    (s) => checkOneSite(s, username, perSiteTimeoutMs, globalController.signal),
    globalController.signal,
  ).finally(() => clearTimeout(globalTimeout));

  return settled.map(({ site, found, httpStatus, responseTimeMs, error }) => {
    const detectionMethod: "status_code" | "message" =
      site.e_code !== site.m_code ? "status_code" : "message";
    return {
      siteName: site.name,
      slug: slugify(site.name),
      category: site.cat,
      uri: buildUrl(site.uri_check, username),
      uriPretty: site.uri_pretty
        ? buildUrl(site.uri_pretty, username)
        : null,
      eCode: site.e_code,
      mCode: site.m_code,
      found,
      httpStatus,
      responseTimeMs,
      detectionMethod,
      ...(error ? { error } : {}),
    };
  });
}

export function wmnResultToPlatformResult(r: WMNResult): {
  slug: string;
  name: string;
  category: string;
  status: "found" | "not_found" | "error";
  url: string | null;
  verified: boolean;
  profileData: Record<string, unknown>;
} {
  return {
    slug: r.slug,
    name: r.siteName,
    category: r.category,
    status: r.found ? "found" : r.error ? "error" : "not_found",
    url: r.found ? r.uriPretty ?? r.uri : null,
    verified: r.found && r.detectionMethod === "status_code",
    profileData: {
      source: "wmn",
      wmn: {
        siteName: r.siteName,
        category: r.category,
        httpStatus: r.httpStatus,
        responseTimeMs: r.responseTimeMs,
        detectionMethod: r.detectionMethod,
      },
    },
  };
}
