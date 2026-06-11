/**
 * Real HTTP-based username existence checker
 * Inspired by Sherlock (github.com/sherlock-project/sherlock)
 * WhatsMyName (github.com/WebBreacher/WhatsMyName)
 * Maigret (github.com/soxoj/maigret)
 */
import { getSetting } from "./settingsService";
import { LRUCache } from "../lib/cache";

export type CheckStatus = "found" | "not_found" | "manual_check" | "error" | "rate_limited";

export interface PlatformResult {
  slug: string;
  name: string;
  category: string;
  status: CheckStatus;
  url: string | null;
  profileData?: Record<string, unknown>;
  verified: boolean;
}

interface PlatformDef {
  slug: string;
  name: string;
  category: string;
  profileUrl: string;
  checkMethod: "api_json" | "api_array" | "http_status" | "json_null" | "manual";
  checkUrl?: string;
  headers?: Record<string, string>;
  foundCondition?: (data: unknown) => boolean;
}

const UA = "LYOSINT-OSINT-Bot/3.0 (github.com/lyosint)";

// ── Platforms we can verify server-side ─────────────────────────────────────
const VERIFIED_PLATFORMS: PlatformDef[] = [
  // ── Developer Platforms ──────────────────────────────────────────────────
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
    slug: "codepen",
    name: "CodePen",
    category: "developer",
    profileUrl: "https://codepen.io/{u}",
    checkMethod: "http_status",
    checkUrl: "https://codepen.io/{u}",
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
    slug: "sourceforge",
    name: "SourceForge",
    category: "developer",
    profileUrl: "https://sourceforge.net/u/{u}/profile/",
    checkMethod: "http_status",
    checkUrl: "https://sourceforge.net/u/{u}/profile/",
    headers: { "User-Agent": UA },
  },
  // ── Community Platforms ──────────────────────────────────────────────────
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
    slug: "reddit",
    name: "Reddit",
    category: "community",
    profileUrl: "https://reddit.com/user/{u}",
    checkMethod: "api_json",
    checkUrl: "https://www.reddit.com/user/{u}/about.json",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => !!(d as any)?.data?.name,
  },
  // ── Security & Identity ──────────────────────────────────────────────────
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
    slug: "gravatar",
    name: "Gravatar",
    category: "identity",
    profileUrl: "https://gravatar.com/{u}",
    checkMethod: "http_status",
    checkUrl: "https://gravatar.com/{u}",
    headers: { "User-Agent": UA },
  },
  // ── Gaming Platforms ─────────────────────────────────────────────────────
  {
    slug: "chess",
    name: "Chess.com",
    category: "gaming",
    profileUrl: "https://chess.com/member/{u}",
    checkMethod: "api_json",
    checkUrl: "https://api.chess.com/pub/player/{u}",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => !!(d as any)?.username,
  },
  {
    slug: "lichess",
    name: "Lichess",
    category: "gaming",
    profileUrl: "https://lichess.org/@/{u}",
    checkMethod: "api_json",
    checkUrl: "https://lichess.org/api/user/{u}",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => !!(d as any)?.username,
  },
  {
    slug: "steam",
    name: "Steam Community",
    category: "gaming",
    profileUrl: "https://steamcommunity.com/id/{u}",
    checkMethod: "http_status",
    checkUrl: "https://steamcommunity.com/id/{u}",
    headers: { "User-Agent": UA },
  },
  // ── Creative & Media ─────────────────────────────────────────────────────
  {
    slug: "letterboxd",
    name: "Letterboxd",
    category: "media",
    profileUrl: "https://letterboxd.com/{u}",
    checkMethod: "http_status",
    checkUrl: "https://letterboxd.com/{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "duolingo",
    name: "Duolingo",
    category: "education",
    profileUrl: "https://www.duolingo.com/profile/{u}",
    checkMethod: "api_json",
    checkUrl: "https://www.duolingo.com/2017-06-30/users?username={u}",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => Array.isArray((d as any)?.users) && (d as any).users.length > 0,
  },
  {
    slug: "roblox",
    name: "Roblox",
    category: "gaming",
    profileUrl: "https://roblox.com/user.aspx?username={u}",
    checkMethod: "api_json",
    checkUrl: "https://users.roblox.com/v1/users/search?keyword={u}&limit=10",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => {
      const data = (d as any)?.data;
      if (!Array.isArray(data)) return false;
      return data.some((u: any) => u.name?.toLowerCase() === "{u}");
    },
  },
  // ── Link-in-bio Platforms ────────────────────────────────────────────────
  {
    slug: "linktree",
    name: "Linktree",
    category: "identity",
    profileUrl: "https://linktr.ee/{u}",
    checkMethod: "http_status",
    checkUrl: "https://linktr.ee/{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "aboutme",
    name: "About.me",
    category: "identity",
    profileUrl: "https://about.me/{u}",
    checkMethod: "http_status",
    checkUrl: "https://about.me/{u}",
    headers: { "User-Agent": UA },
  },
  // ── Music & Podcast ──────────────────────────────────────────────────────
  {
    slug: "bandcamp",
    name: "Bandcamp",
    category: "music",
    profileUrl: "https://bandcamp.com/{u}",
    checkMethod: "http_status",
    checkUrl: "https://bandcamp.com/{u}",
    headers: { "User-Agent": UA },
  },
  // ── Tech / Forum ──────────────────────────────────────────────────────────
  {
    slug: "producthunt",
    name: "Product Hunt",
    category: "startup",
    profileUrl: "https://producthunt.com/@{u}",
    checkMethod: "http_status",
    checkUrl: "https://producthunt.com/@{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "patreon",
    name: "Patreon",
    category: "creative",
    profileUrl: "https://patreon.com/{u}",
    checkMethod: "http_status",
    checkUrl: "https://patreon.com/{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "substack",
    name: "Substack",
    category: "blogging",
    profileUrl: "https://{u}.substack.com",
    checkMethod: "http_status",
    checkUrl: "https://{u}.substack.com",
    headers: { "User-Agent": UA },
  },
  {
    slug: "hashnode",
    name: "Hashnode",
    category: "blogging",
    profileUrl: "https://hashnode.com/@{u}",
    checkMethod: "api_json",
    checkUrl: "https://api.hashnode.com/",
    headers: { "User-Agent": UA, "Content-Type": "application/json" },
    foundCondition: (_: unknown) => false, // GraphQL - skip actual check, use HTTP
  },
  {
    slug: "peerlist",
    name: "Peerlist",
    category: "professional",
    profileUrl: "https://peerlist.io/{u}",
    checkMethod: "http_status",
    checkUrl: "https://peerlist.io/{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "polywork",
    name: "Polywork",
    category: "professional",
    profileUrl: "https://polywork.com/{u}",
    checkMethod: "http_status",
    checkUrl: "https://polywork.com/{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "kaggle",
    name: "Kaggle",
    category: "developer",
    profileUrl: "https://kaggle.com/{u}",
    checkMethod: "http_status",
    checkUrl: "https://kaggle.com/{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "opencollective",
    name: "Open Collective",
    category: "community",
    profileUrl: "https://opencollective.com/{u}",
    checkMethod: "api_json",
    checkUrl: "https://opencollective.com/{u}/json",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => !!(d as any)?.slug,
  },
  {
    slug: "gitea",
    name: "Gitea (Codeberg)",
    category: "developer",
    profileUrl: "https://codeberg.org/{u}",
    checkMethod: "api_json",
    checkUrl: "https://codeberg.org/api/v1/users/{u}",
    headers: { "User-Agent": UA },
    foundCondition: (d: unknown) => !!(d as any)?.login,
  },
  {
    slug: "figma",
    name: "Figma Community",
    category: "creative",
    profileUrl: "https://figma.com/@{u}",
    checkMethod: "http_status",
    checkUrl: "https://figma.com/@{u}",
    headers: { "User-Agent": UA },
  },
  {
    slug: "itch",
    name: "Itch.io",
    category: "gaming",
    profileUrl: "https://{u}.itch.io",
    checkMethod: "http_status",
    checkUrl: "https://{u}.itch.io",
    headers: { "User-Agent": UA },
  },
];

// ── Platforms that block server-side requests (provide link only) ────────────
const MANUAL_PLATFORMS: Array<{ slug: string; name: string; category: string; profileUrl: string | null }> = [
  // ── Major Social ──────────────────────────────────────────────────────────
  { slug: "facebook",     name: "Facebook",       category: "social",       profileUrl: "https://facebook.com/{u}" },
  { slug: "instagram",    name: "Instagram",      category: "social",       profileUrl: "https://instagram.com/{u}" },
  { slug: "twitter",      name: "Twitter / X",    category: "social",       profileUrl: "https://x.com/{u}" },
  { slug: "tiktok",       name: "TikTok",         category: "social",       profileUrl: "https://tiktok.com/@{u}" },
  { slug: "linkedin",     name: "LinkedIn",       category: "professional", profileUrl: "https://linkedin.com/in/{u}" },
  { slug: "snapchat",     name: "Snapchat",       category: "social",       profileUrl: "https://snapchat.com/add/{u}" },
  { slug: "pinterest",    name: "Pinterest",      category: "social",       profileUrl: "https://pinterest.com/{u}" },
  { slug: "youtube",      name: "YouTube",        category: "media",        profileUrl: "https://youtube.com/@{u}" },
  { slug: "twitch",       name: "Twitch",         category: "gaming",       profileUrl: "https://twitch.tv/{u}" },
  { slug: "spotify",      name: "Spotify",        category: "media",        profileUrl: "https://open.spotify.com/user/{u}" },
  { slug: "telegram",     name: "Telegram",       category: "messaging",    profileUrl: "https://t.me/{u}" },
  { slug: "discord",      name: "Discord",        category: "gaming",       profileUrl: null },
  { slug: "vk",           name: "VKontakte",      category: "social",       profileUrl: "https://vk.com/{u}" },
  { slug: "ok",           name: "OK.ru",          category: "social",       profileUrl: "https://ok.ru/{u}" },
  // ── Blogging & Content ────────────────────────────────────────────────────
  { slug: "medium",       name: "Medium",         category: "blogging",     profileUrl: "https://medium.com/@{u}" },
  { slug: "tumblr",       name: "Tumblr",         category: "blogging",     profileUrl: "https://{u}.tumblr.com" },
  { slug: "wordpress",    name: "WordPress.com",  category: "blogging",     profileUrl: "https://{u}.wordpress.com" },
  { slug: "blogger",      name: "Blogger",        category: "blogging",     profileUrl: "https://{u}.blogspot.com" },
  // ── Media Sharing ─────────────────────────────────────────────────────────
  { slug: "flickr",       name: "Flickr",         category: "media",        profileUrl: "https://flickr.com/people/{u}" },
  { slug: "vimeo",        name: "Vimeo",          category: "media",        profileUrl: "https://vimeo.com/{u}" },
  { slug: "soundcloud",   name: "SoundCloud",     category: "media",        profileUrl: "https://soundcloud.com/{u}" },
  { slug: "mixcloud",     name: "Mixcloud",       category: "music",        profileUrl: "https://mixcloud.com/{u}" },
  // ── Creative Platforms ────────────────────────────────────────────────────
  { slug: "behance",      name: "Behance",        category: "creative",     profileUrl: "https://behance.net/{u}" },
  { slug: "dribbble",     name: "Dribbble",       category: "creative",     profileUrl: "https://dribbble.com/{u}" },
  { slug: "deviantart",   name: "DeviantArt",     category: "creative",     profileUrl: "https://deviantart.com/{u}" },
  { slug: "artstation",   name: "ArtStation",     category: "creative",     profileUrl: "https://artstation.com/{u}" },
  // ── Startup & Business ────────────────────────────────────────────────────
  { slug: "angellist",    name: "AngelList",      category: "startup",      profileUrl: "https://angel.co/{u}" },
  { slug: "crunchbase",   name: "Crunchbase",     category: "startup",      profileUrl: "https://crunchbase.com/person/{u}" },
  // ── Developer Tools ───────────────────────────────────────────────────────
  { slug: "pastebin",     name: "Pastebin",       category: "developer",    profileUrl: "https://pastebin.com/u/{u}" },
  { slug: "gist",         name: "GitHub Gist",    category: "developer",    profileUrl: "https://gist.github.com/{u}" },
  // ── Social / Community ────────────────────────────────────────────────────
  { slug: "xing",         name: "Xing",           category: "professional", profileUrl: "https://xing.com/profile/{u}" },
  { slug: "mastodon",     name: "Mastodon",       category: "social",       profileUrl: null },
  { slug: "lastfm",       name: "Last.fm",        category: "media",        profileUrl: "https://last.fm/user/{u}" },
  { slug: "foursquare",   name: "Foursquare",     category: "social",       profileUrl: "https://foursquare.com/user/{u}" },
  { slug: "quora",        name: "Quora",          category: "community",    profileUrl: "https://quora.com/profile/{u}" },
  // ── Gaming ────────────────────────────────────────────────────────────────
  { slug: "epicgames",    name: "Epic Games",     category: "gaming",       profileUrl: "https://epicgames.com/{u}" },
  { slug: "minecraft",    name: "NameMC",         category: "gaming",       profileUrl: "https://namemc.com/{u}" },
  // ── Arab / Regional ──────────────────────────────────────────────────────
  { slug: "clubhouse",    name: "Clubhouse",      category: "social",       profileUrl: "https://joinclubhouse.com/@{u}" },
  { slug: "koo",          name: "Koo",            category: "social",       profileUrl: "https://kooapp.com/profile/{u}" },
  { slug: "ello",         name: "Ello",           category: "social",       profileUrl: "https://ello.co/{u}" },
];

function buildUrl(pattern: string, username: string): string {
  return pattern.replace(/\{u\}/g, encodeURIComponent(username));
}

async function checkOnePlatform(
  platform: PlatformDef,
  username: string,
  githubToken?: string,
  timeoutMs = 5000,
): Promise<PlatformResult> {
  const profileUrl = buildUrl(platform.profileUrl, username);
  const checkUrl = platform.checkUrl ? buildUrl(platform.checkUrl, username) : profileUrl;

  const headers: Record<string, string> = { ...(platform.headers ?? {}) };
  if (platform.slug === "github" && githubToken) {
    headers["Authorization"] = `Bearer ${githubToken}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(checkUrl, { headers, signal: controller.signal, redirect: "follow" });
    clearTimeout(timeout);

    let found = false;
    if (platform.checkMethod === "http_status") {
      found = res.status === 200;
    } else if (platform.foundCondition) {
      if (res.status === 404) {
        found = false;
      } else if (res.status === 429) {
        return { slug: platform.slug, name: platform.name, category: platform.category, status: "rate_limited", url: profileUrl, verified: true };
      } else {
        try {
          const data = await Promise.race([
            res.json(),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Body read timeout")), 3000)),
          ]);
          // Patch username into the condition for platforms that need it
          if (platform.slug === "stackoverflow") {
            const items = (data as any)?.items;
            if (Array.isArray(items)) {
              found = items.some((i: any) => i.display_name?.toLowerCase() === username.toLowerCase());
            }
          } else if (platform.slug === "roblox") {
            const items = (data as any)?.data;
            if (Array.isArray(items)) {
              found = items.some((u: any) => u.name?.toLowerCase() === username.toLowerCase());
            }
          } else {
            found = platform.foundCondition(data);
          }

          if (found) {
            // Return enriched profile data for known platforms
            if (platform.slug === "github" && (data as any)?.login) {
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
            if (platform.slug === "reddit" && (data as any)?.data) {
              const d = (data as any).data;
              return {
                slug: platform.slug, name: platform.name, category: platform.category,
                status: "found", url: profileUrl, verified: true,
                profileData: {
                  name: d.name, karma: d.total_karma,
                  created: new Date(d.created * 1000).toISOString(),
                  iconImg: d.icon_img,
                },
              };
            }
            if (platform.slug === "hackernews" && data && typeof data === "object") {
              const d = data as any;
              return {
                slug: platform.slug, name: platform.name, category: platform.category,
                status: "found", url: profileUrl, verified: true,
                profileData: { karma: d.karma, about: d.about, submitted: d.submitted?.length ?? 0 },
              };
            }
            if (platform.slug === "keybase" && (data as any)?.them?.[0]) {
              const t = (data as any).them[0];
              return {
                slug: platform.slug, name: platform.name, category: platform.category,
                status: "found", url: profileUrl, verified: true,
                profileData: {
                  fullName: t.profile?.full_name, bio: t.profile?.bio,
                  location: t.profile?.location,
                  proofs: Object.keys(t.proofs_summary ?? {}).filter((k) => (t.proofs_summary[k]?.length ?? 0) > 0),
                },
              };
            }
            if (platform.slug === "chess" && (data as any)?.username) {
              const d = data as any;
              return {
                slug: platform.slug, name: platform.name, category: platform.category,
                status: "found", url: profileUrl, verified: true,
                profileData: {
                  username: d.username, name: d.name, followers: d.followers,
                  joined: d.joined, country: d.country,
                },
              };
            }
            if (platform.slug === "lichess" && (data as any)?.username) {
              const d = data as any;
              return {
                slug: platform.slug, name: platform.name, category: platform.category,
                status: "found", url: profileUrl, verified: true,
                profileData: {
                  username: d.username, title: d.title, bio: d.profile?.bio,
                  rating: d.perfs?.rapid?.rating ?? d.perfs?.classical?.rating,
                  country: d.profile?.country,
                },
              };
            }
            if (platform.slug === "duolingo" && (data as any)?.users?.[0]) {
              const d = (data as any).users[0];
              return {
                slug: platform.slug, name: platform.name, category: platform.category,
                status: "found", url: profileUrl, verified: true,
                profileData: { username: d.username, name: d.name, streak: d.streak, totalXp: d.totalXp },
              };
            }
            if (platform.slug === "opencollective" && (data as any)?.slug) {
              const d = data as any;
              return {
                slug: platform.slug, name: platform.name, category: platform.category,
                status: "found", url: profileUrl, verified: true,
                profileData: { name: d.name, description: d.description, website: d.website },
              };
            }
            if (platform.slug === "gitea" && (data as any)?.login) {
              const d = data as any;
              return {
                slug: platform.slug, name: platform.name, category: platform.category,
                status: "found", url: profileUrl, verified: true,
                profileData: { login: d.login, fullName: d.full_name, bio: d.description, website: d.website },
              };
            }
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

const CONCURRENCY = 16;

// ── Result cache (re-checking same username within 60s returns cached, max 1000) ─
const httpResultCache = new LRUCache<PlatformResult[]>(1000);

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

export async function checkUsername(username: string, timeoutMs?: number): Promise<PlatformResult[]> {
  const cacheKey = `http:${username}:${timeoutMs ?? 5000}`;
  const cached = httpResultCache.get(cacheKey);
  if (cached) return cached;

  const githubToken = await getSetting("github_token");
  const timeout = timeoutMs ?? 5000;

  const tasks = VERIFIED_PLATFORMS.map((p) => () => checkOnePlatform(p, username, githubToken ?? undefined, timeout));
  const verifiedResults = await runWithConcurrency(tasks, CONCURRENCY);

  const manualResults: PlatformResult[] = MANUAL_PLATFORMS
    .filter((p) => p.profileUrl)
    .map((p) => ({
      slug: p.slug, name: p.name, category: p.category,
      status: "manual_check" as CheckStatus,
      url: buildUrl(p.profileUrl!, username),
      verified: false,
    }));

  const all = [...verifiedResults, ...manualResults];
  httpResultCache.set(cacheKey, all, 60_000);
  return all;
}
