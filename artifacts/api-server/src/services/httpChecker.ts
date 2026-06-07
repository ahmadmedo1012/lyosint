/**
 * Real HTTP-based username existence checker
 * Inspired by Sherlock (github.com/sherlock-project/sherlock)
 * Only checks platforms that reliably respond to server-side requests
 */
import { getSetting } from "./settingsService";

export type CheckStatus = "found" | "not_found" | "manual_check" | "error" | "rate_limited";

export interface PlatformResult {
  slug: string;
  name: string;
  category: string;
  status: CheckStatus;
  url: string | null;
  profileData?: Record<string, unknown>;
  verified: boolean; // true = we actually checked HTTP, false = user must verify manually
}

interface PlatformDef {
  slug: string;
  name: string;
  category: string;
  profileUrl: string;               // URL shown to user
  checkMethod: "api_json" | "api_array" | "http_status" | "json_null" | "manual";
  checkUrl?: string;                // URL to actually request (if different from profileUrl)
  headers?: Record<string, string>;
  foundCondition?: (data: unknown) => boolean;
  rateLimit?: number;               // ms delay between requests
}

const UA = "LYOSINT-OSINT-Bot/3.0 (github.com/lyosint)";

// ── Platforms we can verify server-side ─────────────────────────────────────
const VERIFIED_PLATFORMS: PlatformDef[] = [
  {
    slug: "github",
    name: "GitHub",
    category: "developer",
    profileUrl: "https://github.com/{u}",
    checkMethod: "api_json",
    checkUrl: "https://api.github.com/users/{u}",
    headers: { "User-Agent": UA, Accept: "application/vnd.github+json" },
    foundCondition: (d: unknown) => !!(d as any)?.login,
  },
  {
    slug: "gitlab",
    name: "GitLab",
    category: "developer",
    profileUrl: "https://gitlab.com/{u}",
    checkMethod: "api_array",
    checkUrl: "https://gitlab.com/api/v4/users?username={u}",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => Array.isArray(d) && d.length > 0,
  },
  {
    slug: "bitbucket",
    name: "Bitbucket",
    category: "developer",
    profileUrl: "https://bitbucket.org/{u}",
    checkMethod: "api_json",
    checkUrl: "https://api.bitbucket.org/2.0/users/{u}",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => !!(d as any)?.nickname,
  },
  {
    slug: "devto",
    name: "Dev.to",
    category: "developer",
    profileUrl: "https://dev.to/{u}",
    checkMethod: "api_json",
    checkUrl: "https://dev.to/api/users/by_username?url={u}",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => !!(d as any)?.username,
  },
  {
    slug: "hackernews",
    name: "HackerNews",
    category: "community",
    profileUrl: "https://news.ycombinator.com/user?id={u}",
    checkMethod: "json_null",
    checkUrl: "https://hacker-news.firebaseio.com/v0/user/{u}.json",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => d !== null && typeof d === "object",
  },
  {
    slug: "keybase",
    name: "Keybase",
    category: "security",
    profileUrl: "https://keybase.io/{u}",
    checkMethod: "api_json",
    checkUrl: "https://keybase.io/_/api/1.0/user/lookup.json?username={u}",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => (d as any)?.status?.code === 0 && (d as any)?.them?.length > 0,
  },
  {
    slug: "reddit",
    name: "Reddit",
    category: "community",
    profileUrl: "https://reddit.com/user/{u}",
    checkMethod: "api_json",
    checkUrl: "https://www.reddit.com/user/{u}/about.json",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => !!(d as any)?.data?.name,
  },
  {
    slug: "npm",
    name: "NPM",
    category: "developer",
    profileUrl: "https://www.npmjs.com/~{u}",
    checkMethod: "http_status",
    checkUrl: "https://registry.npmjs.org/-/user/org.couchdb.user:{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "replit",
    name: "Replit",
    category: "developer",
    profileUrl: "https://replit.com/@{u}",
    checkMethod: "http_status",
    checkUrl: "https://replit.com/@{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "stackoverflow",
    name: "Stack Overflow",
    category: "developer",
    profileUrl: "https://stackoverflow.com/users/{u}",
    checkMethod: "api_json",
    checkUrl: "https://api.stackexchange.com/2.3/users?inname={u}&site=stackoverflow&pagesize=5",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => {
      const items = (d as any)?.items;
      if (!Array.isArray(items)) return false;
      return items.some((i: any) => i.display_name?.toLowerCase() === "{u}");
    },
  },
  {
    slug: "gravatar",
    name: "Gravatar",
    category: "identity",
    profileUrl: "https://gravatar.com/{u}",
    checkMethod: "http_status",
    checkUrl: "https://gravatar.com/{u}",
    headers: { "User-Agent": UA },
  },
];

// ── Platforms that block server-side requests (provide link only) ────────────
const MANUAL_PLATFORMS: Array<{ slug: string; name: string; category: string; profileUrl: string }> = [
  { slug: "facebook",   name: "Facebook",       category: "social",      profileUrl: "https://facebook.com/{u}" },
  { slug: "instagram",  name: "Instagram",      category: "social",      profileUrl: "https://instagram.com/{u}" },
  { slug: "twitter",    name: "Twitter / X",    category: "social",      profileUrl: "https://x.com/{u}" },
  { slug: "tiktok",     name: "TikTok",         category: "social",      profileUrl: "https://tiktok.com/@{u}" },
  { slug: "linkedin",   name: "LinkedIn",       category: "professional", profileUrl: "https://linkedin.com/in/{u}" },
  { slug: "snapchat",   name: "Snapchat",       category: "social",      profileUrl: "https://snapchat.com/add/{u}" },
  { slug: "pinterest",  name: "Pinterest",      category: "social",      profileUrl: "https://pinterest.com/{u}" },
  { slug: "youtube",    name: "YouTube",        category: "media",       profileUrl: "https://youtube.com/@{u}" },
  { slug: "twitch",     name: "Twitch",         category: "gaming",      profileUrl: "https://twitch.tv/{u}" },
  { slug: "spotify",    name: "Spotify",        category: "media",       profileUrl: "https://open.spotify.com/user/{u}" },
  { slug: "telegram",   name: "Telegram",       category: "messaging",   profileUrl: "https://t.me/{u}" },
  { slug: "discord",    name: "Discord",        category: "gaming",      profileUrl: null! },
  { slug: "vk",         name: "VKontakte",      category: "social",      profileUrl: "https://vk.com/{u}" },
  { slug: "ok",         name: "OK.ru",          category: "social",      profileUrl: "https://ok.ru/{u}" },
  { slug: "medium",     name: "Medium",         category: "blogging",    profileUrl: "https://medium.com/@{u}" },
  { slug: "tumblr",     name: "Tumblr",         category: "blogging",    profileUrl: "https://{u}.tumblr.com" },
  { slug: "flickr",     name: "Flickr",         category: "media",       profileUrl: "https://flickr.com/people/{u}" },
  { slug: "vimeo",      name: "Vimeo",          category: "media",       profileUrl: "https://vimeo.com/{u}" },
  { slug: "soundcloud", name: "SoundCloud",     category: "media",       profileUrl: "https://soundcloud.com/{u}" },
  { slug: "twitch2",    name: "Twitch",         category: "gaming",      profileUrl: "https://twitch.tv/{u}" },
  { slug: "behance",    name: "Behance",        category: "creative",    profileUrl: "https://behance.net/{u}" },
  { slug: "dribbble",   name: "Dribbble",       category: "creative",    profileUrl: "https://dribbble.com/{u}" },
  { slug: "producthunt",name: "Product Hunt",   category: "startup",     profileUrl: "https://producthunt.com/@{u}" },
  { slug: "angellist",  name: "AngelList",      category: "startup",     profileUrl: "https://angel.co/{u}" },
  { slug: "lastfm",     name: "Last.fm",        category: "media",       profileUrl: "https://last.fm/user/{u}" },
  { slug: "pastebin",   name: "Pastebin",       category: "developer",   profileUrl: "https://pastebin.com/u/{u}" },
  { slug: "foursquare", name: "Foursquare",     category: "social",      profileUrl: "https://foursquare.com/user/{u}" },
  { slug: "xing",       name: "Xing",           category: "professional", profileUrl: "https://xing.com/profile/{u}" },
  { slug: "mastodon",   name: "Mastodon",       category: "social",      profileUrl: null! },
];

function buildUrl(pattern: string, username: string): string {
  return pattern.replace(/\{u\}/g, encodeURIComponent(username));
}

async function checkOnePlatform(platform: PlatformDef, username: string, token?: string): Promise<PlatformResult> {
  const profileUrl = buildUrl(platform.profileUrl, username);
  const checkUrl = platform.checkUrl ? buildUrl(platform.checkUrl, username) : profileUrl;

  // Inject GitHub token if available
  const headers: Record<string, string> = { ...(platform.headers ?? {}) };
  if (platform.slug === "github" && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(checkUrl, { headers, signal: controller.signal, redirect: "follow" });
    clearTimeout(timeout);

    let found = false;
    if (platform.checkMethod === "http_status") {
      found = res.status === 200;
    } else if (platform.foundCondition) {
      if (res.status === 404 || res.status === 429) {
        found = false;
        if (res.status === 429) {
          return { slug: platform.slug, name: platform.name, category: platform.category, status: "rate_limited", url: profileUrl, verified: true };
        }
      } else {
        try {
          const data = await res.json();
          // Patch in username for stackoverflow special check
          const condition = platform.foundCondition;
          // Replace {u} in the condition closure by rebinding
          found = condition(data);
          if (platform.slug === "stackoverflow") {
            const items = (data as any)?.items;
            if (Array.isArray(items)) {
              found = items.some((i: any) => i.display_name?.toLowerCase() === username.toLowerCase());
            }
          }
          if (found && platform.slug === "github" && (data as any)?.login) {
            return {
              slug: platform.slug, name: platform.name, category: platform.category,
              status: "found", url: profileUrl, verified: true,
              profileData: {
                name: (data as any).name, bio: (data as any).bio,
                location: (data as any).location, company: (data as any).company,
                followers: (data as any).followers, publicRepos: (data as any).public_repos,
                avatar: (data as any).avatar_url, email: (data as any).email,
                blog: (data as any).blog, createdAt: (data as any).created_at,
              },
            };
          }
          if (found && platform.slug === "reddit" && (data as any)?.data) {
            const d = (data as any).data;
            return {
              slug: platform.slug, name: platform.name, category: platform.category,
              status: "found", url: profileUrl, verified: true,
              profileData: {
                name: d.name, karma: d.total_karma, created: new Date(d.created * 1000).toISOString(),
                goldReceived: d.gold_received, iconImg: d.icon_img,
              },
            };
          }
          if (found && platform.slug === "hackernews" && data && typeof data === "object") {
            const d = data as any;
            return {
              slug: platform.slug, name: platform.name, category: platform.category,
              status: "found", url: profileUrl, verified: true,
              profileData: { karma: d.karma, about: d.about, submitted: d.submitted?.length ?? 0, created: d.created },
            };
          }
          if (found && platform.slug === "keybase" && (data as any)?.them?.[0]) {
            const t = (data as any).them[0];
            return {
              slug: platform.slug, name: platform.name, category: platform.category,
              status: "found", url: profileUrl, verified: true,
              profileData: {
                fullName: t.profile?.full_name, bio: t.profile?.bio,
                location: t.profile?.location, pgpKeys: t.public_keys?.primary?.key_fingerprint,
                proofs: Object.keys(t.proofs_summary ?? {}).filter((k) => (t.proofs_summary[k]?.length ?? 0) > 0),
              },
            };
          }
        } catch {
          found = false;
        }
      }
    }

    return {
      slug: platform.slug, name: platform.name, category: platform.category,
      status: found ? "found" : "not_found",
      url: found ? profileUrl : null,
      verified: true,
    };
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      slug: platform.slug, name: platform.name, category: platform.category,
      status: isAbort ? "error" : "error",
      url: profileUrl, verified: true,
    };
  }
}

const CONCURRENCY = 6;

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

export async function checkUsername(username: string): Promise<PlatformResult[]> {
  const githubToken = await getSetting("github_token");

  // Verified checks
  const tasks = VERIFIED_PLATFORMS.map((p) => () => checkOnePlatform(p, username, githubToken ?? undefined));
  const verifiedResults = await runWithConcurrency(tasks, CONCURRENCY);

  // Manual platforms — just generate links
  const manualResults: PlatformResult[] = MANUAL_PLATFORMS
    .filter((p) => p.profileUrl)
    .map((p) => ({
      slug: p.slug, name: p.name, category: p.category,
      status: "manual_check" as CheckStatus,
      url: buildUrl(p.profileUrl, username),
      verified: false,
    }));

  return [...verifiedResults, ...manualResults];
}
