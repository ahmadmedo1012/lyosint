/**
 * Free API integrations — no key required for basic usage
 * Includes: HackerNews, Keybase, Reddit, Dev.to, GitLab, Stack Overflow (extended)
 * Optional keys: Hunter.io, HIBP, Numverify, VirusTotal, Shodan
 */
import { getSetting } from "./settingsService";

const UA = "LYOSINT-OSINT-Bot/3.0";

function safeJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

async function timedFetch(url: string, headers: Record<string, string> = {}, timeoutMs = 5000): Promise<Response | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: controller.signal });
    clearTimeout(t);
    return res;
  } catch {
    clearTimeout(t);
    return null;
  }
}

// ── Hunter.io — email finder ─────────────────────────────────────────────────
export async function hunterEmailFinder(name: string, company?: string): Promise<string[] | null> {
  const key = await getSetting("hunter_api_key");
  if (!key) return null;

  const params = new URLSearchParams({ full_name: name, api_key: key });
  if (company) params.set("company", company);

  const res = await timedFetch(`https://api.hunter.io/v2/email-finder?${params}`);
  if (!res?.ok) return null;
  const data = await safeJson(res) as any;
  const email = data?.data?.email;
  return email ? [email] : [];
}

// ── Have I Been Pwned — breach check ─────────────────────────────────────────
export async function checkHIBP(emailOrUsername: string): Promise<Array<{ name: string; breachDate: string; dataClasses: string[] }> | null> {
  const key = await getSetting("hibp_api_key");
  if (!key) return null;

  const res = await timedFetch(
    `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(emailOrUsername)}?truncateResponse=false`,
    { "hibp-api-key": key },
  );
  if (!res) return null;
  if (res.status === 404) return [];
  if (!res.ok) return null;
  const data = await safeJson(res) as any[];
  if (!Array.isArray(data)) return null;
  return data.map((b: any) => ({
    name: b.Name, breachDate: b.BreachDate, dataClasses: b.DataClasses ?? [],
  }));
}

// ── Numverify — phone validation ─────────────────────────────────────────────
export interface NumverifyResult {
  valid: boolean;
  number: string;
  localFormat: string;
  internationalFormat: string;
  countryPrefix: string;
  countryCode: string;
  countryName: string;
  location: string;
  carrier: string;
  lineType: string;
}

export async function validatePhone(phone: string): Promise<NumverifyResult | null> {
  const key = await getSetting("numverify_api_key");
  if (!key) return null;

  const clean = phone.replace(/\s+/g, "").replace(/^\+/, "");
  const res = await timedFetch(`http://apilayer.net/api/validate?access_key=${key}&number=${clean}&format=1`);
  if (!res?.ok) return null;
  const data = await safeJson(res) as any;
  if (!data?.valid) return null;
  return {
    valid: data.valid, number: data.number, localFormat: data.local_format,
    internationalFormat: data.international_format, countryPrefix: data.country_prefix,
    countryCode: data.country_code, countryName: data.country_name,
    location: data.location, carrier: data.carrier, lineType: data.line_type,
  };
}

// ── VirusTotal — URL/IP/domain check ─────────────────────────────────────────
export async function virusTotalCheck(query: string, type: "url" | "domain" | "ip"): Promise<{ malicious: number; suspicious: number; harmless: number; total: number } | null> {
  const key = await getSetting("virustotal_api_key");
  if (!key) return null;

  let endpoint = "";
  if (type === "url") {
    const id = Buffer.from(query).toString("base64url");
    endpoint = `https://www.virustotal.com/api/v3/urls/${id}`;
  } else if (type === "domain") {
    endpoint = `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(query)}`;
  } else {
    endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(query)}`;
  }

  const res = await timedFetch(endpoint, { "x-apikey": key });
  if (!res?.ok) return null;
  const data = await safeJson(res) as any;
  const stats = data?.data?.attributes?.last_analysis_stats;
  if (!stats) return null;
  return { malicious: stats.malicious ?? 0, suspicious: stats.suspicious ?? 0, harmless: stats.harmless ?? 0, total: (stats.malicious ?? 0) + (stats.suspicious ?? 0) + (stats.harmless ?? 0) + (stats.undetected ?? 0) };
}

// ── Shodan — host lookup ──────────────────────────────────────────────────────
export async function shodanHostLookup(ip: string): Promise<{ ports: number[]; country: string; org: string; os: string | null; vulnerabilities: string[] } | null> {
  const key = await getSetting("shodan_api_key");
  if (!key) return null;

  const res = await timedFetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${key}`);
  if (!res?.ok) return null;
  const data = await safeJson(res) as any;
  return {
    ports: data?.ports ?? [], country: data?.country_name ?? "Unknown",
    org: data?.org ?? "Unknown", os: data?.os ?? null,
    vulnerabilities: data?.vulns ? Object.keys(data.vulns) : [],
  };
}

// ── ip-api.com — free IP/phone geolocation (no key) ─────────────────────────
export async function geoLocatePhone(countryCode: string): Promise<{ country: string; countryCode: string; timezone: string } | null> {
  // Map country code to geo info — static for Libya
  const map: Record<string, { country: string; countryCode: string; timezone: string }> = {
    "LY": { country: "Libya", countryCode: "LY", timezone: "Africa/Tripoli" },
    "EG": { country: "Egypt", countryCode: "EG", timezone: "Africa/Cairo" },
    "TN": { country: "Tunisia", countryCode: "TN", timezone: "Africa/Tunis" },
    "MA": { country: "Morocco", countryCode: "MA", timezone: "Africa/Casablanca" },
    "DZ": { country: "Algeria", countryCode: "DZ", timezone: "Africa/Algiers" },
    "SA": { country: "Saudi Arabia", countryCode: "SA", timezone: "Asia/Riyadh" },
    "AE": { country: "UAE", countryCode: "AE", timezone: "Asia/Dubai" },
  };
  return map[countryCode] ?? null;
}

// ── Twitch — user lookup (with App Access Token) ──────────────────────────────
export async function lookupTwitchUser(username: string): Promise<{ id: string; displayName: string; description: string; followers: number; views: number; createdAt: string; profileImage: string } | null> {
  const clientId = await getSetting("twitch_client_id");
  const clientSecret = await getSetting("twitch_client_secret");
  if (!clientId || !clientSecret) return null;

  // Get app access token
  const tokenRes = await timedFetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { "Content-Type": "application/x-www-form-urlencoded" },
  );
  if (!tokenRes?.ok) return null;
  const tokenData = await safeJson(tokenRes) as any;
  const accessToken = tokenData?.access_token;
  if (!accessToken) return null;

  const res = await timedFetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
    { "Client-Id": clientId, Authorization: `Bearer ${accessToken}` },
  );
  if (!res?.ok) return null;
  const data = await safeJson(res) as any;
  const user = data?.data?.[0];
  if (!user) return null;

  // Get follower count
  const followRes = await timedFetch(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`,
    { "Client-Id": clientId, Authorization: `Bearer ${accessToken}` },
  );
  const followData = followRes?.ok ? await safeJson(followRes) as any : null;

  return {
    id: user.id, displayName: user.display_name, description: user.description ?? "",
    followers: followData?.total ?? 0, views: user.view_count ?? 0,
    createdAt: user.created_at, profileImage: user.profile_image_url,
  };
}
