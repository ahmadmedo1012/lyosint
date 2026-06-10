/**
 * Free & Optional API integrations
 * Free (no key): crt.sh, ip-api.com, HackerNews, Gravatar hash check
 * Optional keys: Hunter.io, HIBP, Numverify, VirusTotal, Shodan,
 *                IPInfo, AbstractAPI Email, EmailRep.io, LeakCheck
 */
import { getSetting } from "./settingsService";
import { LRUCache } from "../lib/cache";

const UA = "LYOSINT-OSINT-Bot/3.0";

// ── Generic TTL cache (LRU, max 1000 entries) ─────────────────────────────────
const cache = new LRUCache<unknown>(1000);
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T | null>): Promise<T | null> {
  const hit = cache.get(key) as T | undefined;
  if (hit !== undefined) return Promise.resolve(hit);
  return fn().then((data) => {
    cache.set(key, data, ttlMs);
    return data;
  }).catch(() => null);
}

function safeJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

async function timedFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = 6000, ...fetchOptions } = options;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, ...(fetchOptions.headers as Record<string, string> ?? {}) },
      signal: controller.signal,
      ...fetchOptions,
    });
    clearTimeout(t);
    return res;
  } catch {
    clearTimeout(t);
    return null;
  }
}

// ── Hunter.io — email finder ──────────────────────────────────────────────────
export async function hunterEmailFinder(name: string, company?: string): Promise<string[] | null> {
  const key = await getSetting("hunter_api_key");
  if (!key) return null;

  return cached(`hunter:${name}:${company ?? ""}`, 86_400_000, async () => {
    const params = new URLSearchParams({ full_name: name, api_key: key });
    if (company) params.set("company", company);
    const res = await timedFetch(`https://api.hunter.io/v2/email-finder?${params}`);
    if (!res?.ok) return null;
    const data = await safeJson(res) as any;
    const email = data?.data?.email;
    return email ? [email] : [];
  });
}

// ── Have I Been Pwned — breach check ─────────────────────────────────────────
export async function checkHIBP(
  emailOrUsername: string,
): Promise<Array<{ name: string; breachDate: string; dataClasses: string[] }> | null> {
  const key = await getSetting("hibp_api_key");
  if (!key) return null;

  return cached(`hibp:${emailOrUsername}`, 300_000, async () => {
    const res = await timedFetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(emailOrUsername)}?truncateResponse=false`,
      { headers: { "hibp-api-key": key } },
    );
    if (!res) return null;
    if (res.status === 404) return [];
    if (!res.ok) return null;
    const data = await safeJson(res) as any[];
    if (!Array.isArray(data)) return null;
    return data.map((b: any) => ({
      name: b.Name, breachDate: b.BreachDate, dataClasses: b.DataClasses ?? [],
    }));
  });
}

// ── LeakCheck.io — breach DB lookup ──────────────────────────────────────────
export async function checkLeakCheck(
  query: string,
  type: "email" | "username" | "password_hash" = "email",
): Promise<Array<{ source: string; date: string | null }> | null> {
  const key = await getSetting("leakcheck_key");
  if (!key) return null;

  return cached(`leakcheck:${type}:${query}`, 300_000, async () => {
    const res = await timedFetch(
      `https://leakcheck.io/api/public?key=${key}&check=${encodeURIComponent(query)}&type=${type}`,
    );
    if (!res?.ok) return null;
    const data = await safeJson(res) as any;
    if (!data?.success || !Array.isArray(data?.sources)) return null;
    return data.sources.map((s: any) => ({
      source: s.name ?? s, date: s.date ?? null,
    }));
  });
}

// ── Numverify — phone validation ──────────────────────────────────────────────
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

  return cached(`numverify:${phone}`, 86_400_000, async () => {
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
  });
}

// ── VirusTotal — URL/IP/domain check ─────────────────────────────────────────
export async function virusTotalCheck(
  query: string, type: "url" | "domain" | "ip",
): Promise<{ malicious: number; suspicious: number; harmless: number; total: number } | null> {
  const key = await getSetting("virustotal_api_key");
  if (!key) return null;

  return cached(`vt:${type}:${query}`, 120_000, async () => {
    let endpoint = "";
    if (type === "url") {
      const id = Buffer.from(query).toString("base64url");
      endpoint = `https://www.virustotal.com/api/v3/urls/${id}`;
    } else if (type === "domain") {
      endpoint = `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(query)}`;
    } else {
      endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(query)}`;
    }
    const res = await timedFetch(endpoint, { headers: { "x-apikey": key } });
    if (!res?.ok) return null;
    const data = await safeJson(res) as any;
    const stats = data?.data?.attributes?.last_analysis_stats;
    if (!stats) return null;
    return {
      malicious: stats.malicious ?? 0, suspicious: stats.suspicious ?? 0,
      harmless: stats.harmless ?? 0,
      total: (stats.malicious ?? 0) + (stats.suspicious ?? 0) + (stats.harmless ?? 0) + (stats.undetected ?? 0),
    };
  });
}

// ── Shodan — host lookup ───────────────────────────────────────────────────────
export async function shodanHostLookup(
  ip: string,
): Promise<{ ports: number[]; country: string; org: string; os: string | null; vulnerabilities: string[] } | null> {
  const key = await getSetting("shodan_api_key");
  if (!key) return null;

  return cached(`shodan:${ip}`, 300_000, async () => {
    const res = await timedFetch(`https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${key}`);
    if (!res?.ok) return null;
    const data = await safeJson(res) as any;
    return {
      ports: data?.ports ?? [], country: data?.country_name ?? "Unknown",
      org: data?.org ?? "Unknown", os: data?.os ?? null,
      vulnerabilities: data?.vulns ? Object.keys(data.vulns) : [],
    };
  });
}

// ── IPInfo — IP geolocation (free 50k/month) ──────────────────────────────────
export interface IPInfoResult {
  ip: string;
  city: string;
  region: string;
  country: string;
  org: string;
  asn: string;
  timezone: string;
  lat: number | null;
  lon: number | null;
}

export async function lookupIPInfo(ip: string): Promise<IPInfoResult | null> {
  const token = await getSetting("ipinfo_token");
  const url = token
    ? `https://ipinfo.io/${encodeURIComponent(ip)}/json?token=${token}`
    : `https://ipinfo.io/${encodeURIComponent(ip)}/json`;

  return cached(`ipinfo:${ip}`, 30_000, async () => {
    const res = await timedFetch(url);
    if (!res?.ok) return null;
    const data = await safeJson(res) as any;
    if (!data?.ip) return null;
    const [lat, lon] = (data.loc ?? ",").split(",").map(Number);
    return {
      ip: data.ip, city: data.city ?? "", region: data.region ?? "",
      country: data.country ?? "", org: data.org ?? "",
      asn: data.org?.split(" ")[0] ?? "",
      timezone: data.timezone ?? "",
      lat: isNaN(lat) ? null : lat,
      lon: isNaN(lon) ? null : lon,
    };
  });
}

// ── ip-api.com — free IP geolocation (no key, max 45 req/min) ────────────────
export async function geoLocateIP(ip: string): Promise<IPInfoResult | null> {
  return cached(`geoip:${ip}`, 30_000, async () => {
    const res = await timedFetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon,timezone,org,as`);
    if (!res?.ok) return null;
    const data = await safeJson(res) as any;
    if (data?.status !== "success") return null;
    return {
      ip, city: data.city ?? "", region: data.regionName ?? "",
      country: data.countryCode ?? "", org: data.org ?? "",
      asn: data.as ?? "", timezone: data.timezone ?? "",
      lat: data.lat ?? null, lon: data.lon ?? null,
    };
  });
}

// ── crt.sh — Certificate Transparency (free, no key) ─────────────────────────
export interface CertResult {
  domain: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
}

export async function crtShLookup(domain: string): Promise<CertResult[]> {
  const result = await cached<CertResult[]>(`crtsh:${domain}`, 120_000, async () => {
    const res = await timedFetch(
      `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`,
      { timeoutMs: 10000 },
    );
    if (!res?.ok) return [];
    const data = await safeJson(res) as any[];
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    return data
      .filter((c: any) => c.name_value && !seen.has(c.name_value) && seen.add(c.name_value))
      .slice(0, 30)
      .map((c: any) => ({
        domain: c.name_value, issuer: c.issuer_ca_id ?? "",
        notBefore: c.not_before ?? "", notAfter: c.not_after ?? "",
      }));
  });
  return result ?? [];
}

// ── AbstractAPI — email validation (100 req/month free) ───────────────────────
export interface EmailValidationResult {
  email: string;
  deliverability: "DELIVERABLE" | "UNDELIVERABLE" | "RISKY" | "UNKNOWN";
  isValidFormat: boolean;
  isFreeEmail: boolean;
  isDisposable: boolean;
  isRoleEmail: boolean;
  isMxFound: boolean;
  isSmtpValid: boolean;
}

export async function validateEmail(email: string): Promise<EmailValidationResult | null> {
  const key = await getSetting("abstractapi_email_key");
  if (!key) return null;

  return cached(`abstractemail:${email}`, 86_400_000, async () => {
    const res = await timedFetch(
      `https://emailvalidation.abstractapi.com/v1/?api_key=${key}&email=${encodeURIComponent(email)}`,
    );
    if (!res?.ok) return null;
    const data = await safeJson(res) as any;
    if (!data?.email) return null;
    return {
      email: data.email,
      deliverability: data.deliverability ?? "UNKNOWN",
      isValidFormat: data.is_valid_format?.value ?? false,
      isFreeEmail: data.is_free_email?.value ?? false,
      isDisposable: data.is_disposable_email?.value ?? false,
      isRoleEmail: data.is_role_email?.value ?? false,
      isMxFound: data.is_mx_found?.value ?? false,
      isSmtpValid: data.is_smtp_valid?.value ?? false,
    };
  });
}

// ── EmailRep.io — email reputation (1000 req/day free) ───────────────────────
export interface EmailRepResult {
  email: string;
  reputation: "high" | "medium" | "low" | "none";
  suspicious: boolean;
  references: number;
  details: {
    blacklisted: boolean;
    maliciousActivity: boolean;
    credentialLeaked: boolean;
    dataBreaches: number;
    firstSeen: string | null;
    lastSeen: string | null;
    domainReputation: string;
  };
}

export async function checkEmailRep(email: string): Promise<EmailRepResult | null> {
  const key = await getSetting("emailrep_key");
  const headers: Record<string, string> = {};
  if (key) headers["Key"] = key;

  return cached(`emailrep:${email}`, 3600_000, async () => {
    const res = await timedFetch(
      `https://emailrep.io/${encodeURIComponent(email)}`,
      { headers },
    );
    if (!res?.ok) return null;
    const data = await safeJson(res) as any;
    if (!data?.email) return null;
    return {
      email: data.email,
      reputation: data.reputation ?? "none",
      suspicious: data.suspicious ?? false,
      references: data.references ?? 0,
      details: {
        blacklisted: data.details?.blacklisted ?? false,
        maliciousActivity: data.details?.malicious_activity ?? false,
        credentialLeaked: data.details?.credentials_leaked ?? false,
        dataBreaches: data.details?.data_breach ?? 0,
        firstSeen: data.details?.first_seen ?? null,
        lastSeen: data.details?.last_seen ?? null,
        domainReputation: data.details?.domain_reputation ?? "none",
      },
    };
  });
}

// ── Twitch — user lookup (with App Access Token) ──────────────────────────────
export async function lookupTwitchUser(
  username: string,
): Promise<{ id: string; displayName: string; description: string; followers: number; views: number; createdAt: string; profileImage: string } | null> {
  const clientId = await getSetting("twitch_client_id");
  const clientSecret = await getSetting("twitch_client_secret");
  if (!clientId || !clientSecret) return null;

  return cached(`twitch:${username}`, 60_000, async () => {
    const tokenRes = await timedFetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      { method: "POST" },
    );
    if (!tokenRes?.ok) return null;
    const tokenData = await safeJson(tokenRes) as any;
    const accessToken = tokenData?.access_token;
    if (!accessToken) return null;

    const res = await timedFetch(
      `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
      { headers: { "Client-Id": clientId, Authorization: `Bearer ${accessToken}` } },
    );
    if (!res?.ok) return null;
    const data = await safeJson(res) as any;
    const user = data?.data?.[0];
    if (!user) return null;

    const followRes = await timedFetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${user.id}`,
      { headers: { "Client-Id": clientId, Authorization: `Bearer ${accessToken}` } },
    );
    const followData = followRes?.ok ? await safeJson(followRes) as any : null;

    return {
      id: user.id, displayName: user.display_name, description: user.description ?? "",
      followers: followData?.total ?? 0, views: user.view_count ?? 0,
      createdAt: user.created_at, profileImage: user.profile_image_url,
    };
  });
}

// ── Static geo map for country codes ─────────────────────────────────────────
export function geoLocatePhone(countryCode: string): { country: string; countryCode: string; timezone: string } | null {
  const map: Record<string, { country: string; countryCode: string; timezone: string }> = {
    "LY": { country: "Libya",        countryCode: "LY", timezone: "Africa/Tripoli"   },
    "EG": { country: "Egypt",        countryCode: "EG", timezone: "Africa/Cairo"     },
    "TN": { country: "Tunisia",      countryCode: "TN", timezone: "Africa/Tunis"     },
    "MA": { country: "Morocco",      countryCode: "MA", timezone: "Africa/Casablanca"},
    "DZ": { country: "Algeria",      countryCode: "DZ", timezone: "Africa/Algiers"   },
    "SA": { country: "Saudi Arabia", countryCode: "SA", timezone: "Asia/Riyadh"      },
    "AE": { country: "UAE",          countryCode: "AE", timezone: "Asia/Dubai"       },
    "QA": { country: "Qatar",        countryCode: "QA", timezone: "Asia/Qatar"       },
    "KW": { country: "Kuwait",       countryCode: "KW", timezone: "Asia/Kuwait"      },
    "BH": { country: "Bahrain",      countryCode: "BH", timezone: "Asia/Bahrain"     },
    "OM": { country: "Oman",         countryCode: "OM", timezone: "Asia/Muscat"      },
    "JO": { country: "Jordan",       countryCode: "JO", timezone: "Asia/Amman"       },
    "IQ": { country: "Iraq",         countryCode: "IQ", timezone: "Asia/Baghdad"     },
    "SY": { country: "Syria",        countryCode: "SY", timezone: "Asia/Damascus"    },
    "LB": { country: "Lebanon",      countryCode: "LB", timezone: "Asia/Beirut"      },
    "PS": { country: "Palestine",    countryCode: "PS", timezone: "Asia/Hebron"      },
    "YE": { country: "Yemen",        countryCode: "YE", timezone: "Asia/Aden"        },
    "SD": { country: "Sudan",        countryCode: "SD", timezone: "Africa/Khartoum"  },
    "SO": { country: "Somalia",      countryCode: "SO", timezone: "Africa/Mogadishu" },
    "MR": { country: "Mauritania",   countryCode: "MR", timezone: "Africa/Nouakchott"},
  };
  return map[countryCode] ?? null;
}
