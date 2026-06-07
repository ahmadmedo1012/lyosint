import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { checkUsername, type PlatformResult } from "./httpChecker";
import { getGitHubProfile } from "./githubOsint";
import { checkHIBP, lookupTwitchUser, checkLeakCheck, checkEmailRep, crtShLookup } from "./freeApis";
import { getSetting } from "./settingsService";

export async function runUsernameSearch(id: string, username: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running", progress: 5 }).where(eq(searchesTable.id, id));

    // Run all platform checks concurrently
    const [platformResults, twitchData] = await Promise.allSettled([
      checkUsername(username),
      lookupTwitchUser(username),
    ]);

    const results: PlatformResult[] = platformResults.status === "fulfilled" ? platformResults.value : [];
    const twitch = twitchData.status === "fulfilled" ? twitchData.value : null;

    await db.update(searchesTable).set({ progress: 55, platformsSearched: results.length }).where(eq(searchesTable.id, id));

    // Enrich GitHub result if found
    let githubProfile = null;
    const ghResult = results.find((r) => r.slug === "github" && r.status === "found");
    if (ghResult) {
      githubProfile = await getGitHubProfile(username).catch(() => null);
    }
    await db.update(searchesTable).set({ progress: 68 }).where(eq(searchesTable.id, id));

    // Build possible email from github or common patterns
    const possibleEmail = githubProfile?.email ?? null;

    // Run breach & reputation checks concurrently
    const hibpKey = await getSetting("hibp_api_key");
    const [breachesHIBP, breachesLeakCheck, emailRepData, certData] = await Promise.allSettled([
      hibpKey ? checkHIBP(username).catch(() => null) : Promise.resolve(null),
      checkLeakCheck(username, "username").catch(() => null),
      possibleEmail ? checkEmailRep(possibleEmail).catch(() => null) : Promise.resolve(null),
      // Check crt.sh for domain certificates if username looks like a domain
      username.includes(".") ? crtShLookup(username).catch(() => []) : Promise.resolve([]),
    ]);

    const breaches = [
      ...(breachesHIBP.status === "fulfilled" && breachesHIBP.value ? breachesHIBP.value : []),
      ...(breachesLeakCheck.status === "fulfilled" && breachesLeakCheck.value
        ? breachesLeakCheck.value.map((l) => ({ name: l.source, breachDate: l.date ?? "", dataClasses: [] }))
        : []),
    ];

    const emailRep = emailRepData.status === "fulfilled" ? emailRepData.value : null;
    const certs = certData.status === "fulfilled" ? certData.value : [];

    await db.update(searchesTable).set({ progress: 88 }).where(eq(searchesTable.id, id));

    // Build profiles map
    const profilesFound: Record<string, {
      url: string | null; exists: boolean; status: string; verified: boolean;
      bio?: string | null; followers?: number | null; displayName?: string | null;
      confidence: string | null; profileData?: Record<string, unknown>;
    }> = {};

    for (const r of results) {
      profilesFound[r.slug] = {
        url: r.url,
        exists: r.status === "found",
        status: r.status,
        verified: r.verified,
        bio: (r.profileData as any)?.bio ?? null,
        followers: (r.profileData as any)?.followers ?? null,
        displayName: (r.profileData as any)?.name ?? null,
        confidence: r.status === "found" ? (r.verified ? "high" : "medium") : null,
        profileData: r.profileData,
      };
    }

    // Add Twitch if found with API
    if (twitch) {
      profilesFound["twitch"] = {
        url: `https://twitch.tv/${username}`, exists: true, status: "found", verified: true,
        bio: twitch.description ?? null, followers: twitch.followers, displayName: twitch.displayName,
        confidence: "high", profileData: twitch as unknown as Record<string, unknown>,
      };
    }

    const totalFound = Object.values(profilesFound).filter((p) => p.exists).length;
    const verifiedFound = Object.values(profilesFound).filter((p) => p.exists && p.verified).length;

    // Confidence: verified hits + breach context + cert data
    const confidence = Math.round(Math.min(
      0.2 + verifiedFound * 0.08 + (githubProfile ? 0.15 : 0) + (breaches.length > 0 ? 0.05 : 0),
      0.97
    ) * 100) / 100;

    const usernameResult = {
      username,
      profilesFound,
      totalPlatformsSearched: results.length,
      totalFound,
      verifiedFound,
      githubProfile,
      breaches,
      emailRep,
      certDomains: certs.slice(0, 10).map((c: any) => c.domain),
      possibleEmail,
      summary: {
        realName: githubProfile?.name ?? null,
        location: githubProfile?.location ?? null,
        bio: githubProfile?.bio ?? null,
        languages: githubProfile?.languages ?? [],
        totalRepos: githubProfile?.publicRepos ?? null,
        totalStars: githubProfile?.totalStars ?? null,
      },
    };

    await db.update(searchesTable).set({
      status: "completed", progress: 100,
      platformsSearched: results.length,
      usernameResult, confidenceScore: confidence,
      resultsCount: totalFound, completedAt: new Date(),
    }).where(eq(searchesTable.id, id));
  } catch (err) {
    await db.update(searchesTable).set({ status: "failed" }).where(eq(searchesTable.id, id));
  }
}
