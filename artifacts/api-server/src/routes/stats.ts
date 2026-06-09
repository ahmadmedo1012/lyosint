import { Router } from "express";
import { db, searchesTable } from "@workspace/db";
import { sql, gte } from "drizzle-orm";

const router = Router();

const PLATFORMS: Array<{
  slug: string;
  name: string;
  category: "social" | "libyan" | "professional" | "messaging" | "code" | "other";
  active: boolean;
  url: string | null;
  libyaSpecific: boolean;
}> = [
  { slug: "facebook", name: "Facebook", category: "social", active: true, url: "https://facebook.com", libyaSpecific: false },
  { slug: "instagram", name: "Instagram", category: "social", active: true, url: "https://instagram.com", libyaSpecific: false },
  { slug: "twitter", name: "Twitter/X", category: "social", active: true, url: "https://x.com", libyaSpecific: false },
  { slug: "tiktok", name: "TikTok", category: "social", active: true, url: "https://tiktok.com", libyaSpecific: false },
  { slug: "snapchat", name: "Snapchat", category: "social", active: true, url: "https://snapchat.com", libyaSpecific: false },
  { slug: "reddit", name: "Reddit", category: "social", active: true, url: "https://reddit.com", libyaSpecific: false },
  { slug: "pinterest", name: "Pinterest", category: "social", active: true, url: "https://pinterest.com", libyaSpecific: false },
  { slug: "tumblr", name: "Tumblr", category: "social", active: true, url: "https://tumblr.com", libyaSpecific: false },
  { slug: "flickr", name: "Flickr", category: "social", active: true, url: "https://flickr.com", libyaSpecific: false },
  { slug: "vimeo", name: "Vimeo", category: "social", active: true, url: "https://vimeo.com", libyaSpecific: false },
  { slug: "youtube", name: "YouTube", category: "social", active: true, url: "https://youtube.com", libyaSpecific: false },
  { slug: "phonelibya", name: "PhoneLibya.ly", category: "libyan", active: true, url: "https://phonelibya.ly", libyaSpecific: true },
  { slug: "libyayponline", name: "Libya Yellow Pages", category: "libyan", active: true, url: "https://libyayponline.com", libyaSpecific: true },
  { slug: "libya-herald", name: "Libya Herald", category: "libyan", active: true, url: "https://libyaherald.com", libyaSpecific: true },
  { slug: "libya-observer", name: "Libya Observer", category: "libyan", active: true, url: "https://libyaobserver.ly", libyaSpecific: true },
  { slug: "al-wasat", name: "Al-Wasat Libya", category: "libyan", active: true, url: "https://alwasat.ly", libyaSpecific: true },
  { slug: "libya-forum", name: "Libyan Forums", category: "libyan", active: true, url: null, libyaSpecific: true },
  { slug: "libya-mostakbal", name: "Libya Al-Mostakbal", category: "libyan", active: true, url: "https://libya-al-mostakbal.org", libyaSpecific: true },
  { slug: "linkedin", name: "LinkedIn", category: "professional", active: true, url: "https://linkedin.com", libyaSpecific: false },
  { slug: "github", name: "GitHub", category: "code", active: true, url: "https://github.com", libyaSpecific: false },
  { slug: "gitlab", name: "GitLab", category: "code", active: true, url: "https://gitlab.com", libyaSpecific: false },
  { slug: "bitbucket", name: "Bitbucket", category: "code", active: true, url: "https://bitbucket.org", libyaSpecific: false },
  { slug: "stackoverflow", name: "Stack Overflow", category: "code", active: true, url: "https://stackoverflow.com", libyaSpecific: false },
  { slug: "telegram", name: "Telegram", category: "messaging", active: true, url: "https://t.me", libyaSpecific: false },
  { slug: "whatsapp", name: "WhatsApp", category: "messaging", active: true, url: "https://wa.me", libyaSpecific: false },
  { slug: "discord", name: "Discord", category: "messaging", active: true, url: "https://discord.com", libyaSpecific: false },
  { slug: "skype", name: "Skype", category: "messaging", active: true, url: "https://skype.com", libyaSpecific: false },
  { slug: "viber", name: "Viber", category: "messaging", active: true, url: "https://viber.com", libyaSpecific: false },
  { slug: "namemc", name: "NameMC", category: "other", active: true, url: "https://namemc.com", libyaSpecific: false },
  { slug: "pastebin", name: "Pastebin", category: "other", active: true, url: "https://pastebin.com", libyaSpecific: false },
  { slug: "gravatar", name: "Gravatar", category: "other", active: true, url: "https://gravatar.com", libyaSpecific: false },
  { slug: "soundcloud", name: "SoundCloud", category: "other", active: true, url: "https://soundcloud.com", libyaSpecific: false },
  { slug: "medium", name: "Medium", category: "other", active: true, url: "https://medium.com", libyaSpecific: false },
  { slug: "devto", name: "Dev.to", category: "code", active: true, url: "https://dev.to", libyaSpecific: false },
  { slug: "behance", name: "Behance", category: "other", active: true, url: "https://behance.net", libyaSpecific: false },
  { slug: "dribbble", name: "Dribbble", category: "other", active: true, url: "https://dribbble.com", libyaSpecific: false },
  { slug: "foursquare", name: "Foursquare", category: "other", active: true, url: "https://foursquare.com", libyaSpecific: false },
  { slug: "truecaller", name: "Truecaller", category: "other", active: true, url: "https://truecaller.com", libyaSpecific: false },
  { slug: "spotify", name: "Spotify", category: "other", active: true, url: "https://spotify.com", libyaSpecific: false },
  { slug: "twitch", name: "Twitch", category: "social", active: true, url: "https://twitch.tv", libyaSpecific: false },
];

router.get("/stats", async (req, res) => {
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where status = 'completed')::int`,
      avgConf: sql<number>`avg(confidence_score)`,
      nameCount: sql<number>`count(*) filter (where type = 'name')::int`,
      phoneCount: sql<number>`count(*) filter (where type = 'phone')::int`,
      usernameCount: sql<number>`count(*) filter (where type = 'username')::int`,
      deepCount: sql<number>`count(*) filter (where type = 'deep')::int`,
      totalFindings: sql<number>`sum(results_count)::int`,
    })
    .from(searchesTable);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(searchesTable)
    .where(gte(searchesTable.createdAt, yesterday));

  const stat = rows[0];
  res.json({
    totalSearches: stat?.total ?? 0,
    totalFindings: stat?.totalFindings ?? 0,
    platformsCovered: PLATFORMS.filter((p) => p.active).length,
    avgConfidence: Math.round((stat?.avgConf ?? 0.75) * 100) / 100,
    searchesByType: {
      name: stat?.nameCount ?? 0,
      phone: stat?.phoneCount ?? 0,
      username: stat?.usernameCount ?? 0,
      deep: stat?.deepCount ?? 0,
    },
    recentSearchCount: recentRows[0]?.count ?? 0,
  });
});

router.get("/platform-coverage", (_req, res) => {
  res.json(PLATFORMS);
});

export default router;
