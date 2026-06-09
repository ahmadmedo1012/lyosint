import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateNameVariants, LIBYA_SOCIAL_PLATFORMS } from "./libyaHelpers";
import { searchGitHubByName } from "./githubOsint";
import { hunterEmailFinder } from "./freeApis";

export async function runNameSearch(id: string, name: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running", progress: 5 }).where(eq(searchesTable.id, id));

    const variants = generateNameVariants(name);
    const slug = name.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^\w.]/g, "");
    const slugDash = slug.replace(/\./g, "-");
    const slugUnder = slug.replace(/\./g, "_");

    // Run GitHub + Hunter.io in parallel
    const [githubUsers, discoveredEmails] = await Promise.all([
      searchGitHubByName(name).catch(() => []),
      hunterEmailFinder(name).catch(() => null),
    ]);

    await db.update(searchesTable).set({ progress: 50 }).where(eq(searchesTable.id, id));

    const nameEncoded = encodeURIComponent(name);

    const searchEngineLinks = [
      { label: "Google — البحث الشامل", url: `https://www.google.com/search?q=${nameEncoded}+Libya` },
      { label: "Google — صور", url: `https://www.google.com/search?q=${nameEncoded}&tbm=isch` },
      { label: "Bing", url: `https://www.bing.com/search?q=${nameEncoded}+Libya` },
      { label: "DuckDuckGo", url: `https://duckduckgo.com/?q=${nameEncoded}+Libya` },
    ];

    const socialMedia: Record<string, string[]> = {
      facebook: [`https://www.facebook.com/search/people?q=${nameEncoded}`, `https://facebook.com/${slug}`],
      twitter: [`https://x.com/search?q=${nameEncoded}&f=user`],
      instagram: [`https://www.instagram.com/${slug}/`],
      linkedin: [`https://www.linkedin.com/search/results/people/?keywords=${nameEncoded}`, `https://linkedin.com/in/${slugDash}`],
      tiktok: [`https://www.tiktok.com/search/user?q=${nameEncoded}`],
      telegram: [`https://t.me/${slugUnder}`],
      youtube: [`https://www.youtube.com/results?search_query=${nameEncoded}`],
    };

    const libyanPlatforms = LIBYA_SOCIAL_PLATFORMS.map((p) => ({
      name: p.name,
      url: p.searchUrl.replace("{q}", nameEncoded),
    }));

    const usernameVariants = [
      slug, slugDash, slugUnder,
      ...variants.map((v) => v.toLowerCase().replace(/\s+/g, ".").replace(/[^\w.]/g, "")),
    ].filter((v, i, arr) => v && arr.indexOf(v) === i).slice(0, 8);

    const confidence = Math.round(Math.min(
      0.25 + githubUsers.length * 0.12 + (discoveredEmails?.length ?? 0) * 0.1, 0.82,
    ) * 100) / 100;

    const socialCount = Object.values(socialMedia).flat().length;
    const resultsCount = githubUsers.length + (discoveredEmails?.length ?? 0) + socialCount;

    const nameResult = {
      fullName: name,
      possibleVariations: variants,
      usernameVariants,
      githubUsers,
      discoveredEmails: discoveredEmails ?? [],
      searchEngineLinks,
      socialMedia,
      libyanPlatforms,
      sources: ["github.com/search", ...(discoveredEmails ? ["hunter.io"] : []), "google.com", "facebook.com", "linkedin.com"],
      dataNote: "روابط وسائل التواصل للفحص اليدوي — نتائج GitHub مؤكدة من API",
    };

    await db.update(searchesTable).set({
      status: "completed", progress: 100,
      platformsSearched: 8 + libyanPlatforms.length,
      nameResult, confidenceScore: confidence,
      resultsCount, completedAt: new Date(),
    }).where(eq(searchesTable.id, id));
  } catch {
    await db.update(searchesTable).set({ status: "failed" }).where(eq(searchesTable.id, id));
  }
}
