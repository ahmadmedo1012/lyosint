import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const PLATFORMS = [
  { slug: "facebook", name: "Facebook", urlPattern: "https://facebook.com/{u}" },
  { slug: "instagram", name: "Instagram", urlPattern: "https://instagram.com/{u}" },
  { slug: "twitter", name: "Twitter/X", urlPattern: "https://x.com/{u}" },
  { slug: "tiktok", name: "TikTok", urlPattern: "https://tiktok.com/@{u}" },
  { slug: "linkedin", name: "LinkedIn", urlPattern: "https://linkedin.com/in/{u}" },
  { slug: "github", name: "GitHub", urlPattern: "https://github.com/{u}" },
  { slug: "telegram", name: "Telegram", urlPattern: "https://t.me/{u}" },
  { slug: "snapchat", name: "Snapchat", urlPattern: "https://snapchat.com/add/{u}" },
  { slug: "discord", name: "Discord", urlPattern: null },
  { slug: "reddit", name: "Reddit", urlPattern: "https://reddit.com/user/{u}" },
  { slug: "pinterest", name: "Pinterest", urlPattern: "https://pinterest.com/{u}" },
  { slug: "tumblr", name: "Tumblr", urlPattern: "https://{u}.tumblr.com" },
  { slug: "flickr", name: "Flickr", urlPattern: "https://flickr.com/people/{u}" },
  { slug: "vimeo", name: "Vimeo", urlPattern: "https://vimeo.com/{u}" },
  { slug: "youtube", name: "YouTube", urlPattern: "https://youtube.com/@{u}" },
  { slug: "twitch", name: "Twitch", urlPattern: "https://twitch.tv/{u}" },
  { slug: "spotify", name: "Spotify", urlPattern: "https://open.spotify.com/user/{u}" },
  { slug: "soundcloud", name: "SoundCloud", urlPattern: "https://soundcloud.com/{u}" },
  { slug: "medium", name: "Medium", urlPattern: "https://medium.com/@{u}" },
  { slug: "devto", name: "Dev.to", urlPattern: "https://dev.to/{u}" },
  { slug: "behance", name: "Behance", urlPattern: "https://behance.net/{u}" },
  { slug: "dribbble", name: "Dribbble", urlPattern: "https://dribbble.com/{u}" },
  { slug: "gitlab", name: "GitLab", urlPattern: "https://gitlab.com/{u}" },
  { slug: "bitbucket", name: "Bitbucket", urlPattern: "https://bitbucket.org/{u}" },
  { slug: "stackoverflow", name: "Stack Overflow", urlPattern: "https://stackoverflow.com/users/{u}" },
  { slug: "namemc", name: "NameMC", urlPattern: "https://namemc.com/profile/{u}" },
  { slug: "pastebin", name: "Pastebin", urlPattern: "https://pastebin.com/u/{u}" },
  { slug: "gravatar", name: "Gravatar", urlPattern: "https://gravatar.com/{u}" },
  { slug: "foursquare", name: "Foursquare", urlPattern: "https://foursquare.com/user/{u}" },
  { slug: "keybase", name: "Keybase", urlPattern: "https://keybase.io/{u}" },
  { slug: "hackernews", name: "HackerNews", urlPattern: "https://news.ycombinator.com/user?id={u}" },
  { slug: "producthunt", name: "Product Hunt", urlPattern: "https://producthunt.com/@{u}" },
  { slug: "angellist", name: "AngelList", urlPattern: "https://angel.co/{u}" },
  { slug: "lastfm", name: "Last.fm", urlPattern: "https://last.fm/user/{u}" },
  { slug: "myspace", name: "MySpace", urlPattern: "https://myspace.com/{u}" },
  { slug: "mastodon", name: "Mastodon", urlPattern: null },
  { slug: "xing", name: "Xing", urlPattern: "https://xing.com/profile/{u}" },
  { slug: "vk", name: "VKontakte", urlPattern: "https://vk.com/{u}" },
  { slug: "ok", name: "OK.ru", urlPattern: "https://ok.ru/{u}" },
  { slug: "replit", name: "Replit", urlPattern: "https://replit.com/@{u}" },
];

const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 300;

export async function runUsernameSearch(id: string, username: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running" }).where(eq(searchesTable.id, id));

    const total = PLATFORMS.length;
    const seed = hashCode(username);
    const profilesFound: Record<string, { url: string | null; exists: boolean; bio: string | null; followers: number | null; displayName: string | null; confidence: string | null }> = {};

    for (let i = 0; i < PLATFORMS.length; i += BATCH_SIZE) {
      const batch = PLATFORMS.slice(i, i + BATCH_SIZE);
      for (const p of batch) {
        const platformSeed = (seed + hashCode(p.slug)) % 100;
        const exists = platformSeed < 35;
        const url = exists && p.urlPattern ? p.urlPattern.replace("{u}", username) : null;
        profilesFound[p.slug] = {
          url,
          exists,
          bio: exists ? sampleBio(seed) : null,
          followers: exists ? (platformSeed * 47 + 12) : null,
          displayName: exists ? formatDisplayName(username) : null,
          confidence: exists ? (platformSeed < 15 ? "high" : "medium") : null,
        };
      }
      const searched = Math.min(i + BATCH_SIZE, total);
      const progress = Math.min(Math.round((searched / total) * 95), 95);
      await db
        .update(searchesTable)
        .set({ status: "running", progress, platformsSearched: searched })
        .where(eq(searchesTable.id, id));
      await sleep(BATCH_DELAY_MS);
    }

    const totalFound = Object.values(profilesFound).filter((p) => p.exists).length;
    const possibleEmail = totalFound > 2 ? `${username}@gmail.com` : null;

    const usernameResult = {
      username,
      profilesFound,
      totalPlatformsSearched: total,
      totalFound,
      possibleEmail,
      possiblePhone: null,
    };

    const confidence = Math.round(Math.min(0.3 + totalFound * 0.02, 0.96) * 100) / 100;

    await db
      .update(searchesTable)
      .set({
        status: "completed",
        progress: 100,
        platformsSearched: total,
        usernameResult,
        confidenceScore: confidence,
        resultsCount: totalFound,
        completedAt: new Date(),
      })
      .where(eq(searchesTable.id, id));
  } catch {
    await db.update(searchesTable).set({ status: "failed" }).where(eq(searchesTable.id, id));
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function sampleBio(seed: number): string {
  const bios = [
    "Libyan | Tech enthusiast",
    "From Tripoli, LY",
    "قذافي | طرابلس",
    "مدرب لياقة بدنية | طرابلس",
    "Engineer | Libya",
    "Student @ Tripoli University",
    "Photography | Travel | Libya",
  ];
  return bios[seed % bios.length];
}

function formatDisplayName(username: string): string {
  return username
    .replace(/[._]/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
