import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { checkUsername, type PlatformResult } from "./httpChecker";
import { getGitHubProfile } from "./githubOsint";
import { checkHIBP, lookupTwitchUser, checkLeakCheck, checkEmailRep, crtShLookup } from "./freeApis";
import { getSetting } from "./settingsService";
import { checkWhatsMyName, wmnResultToPlatformResult, type WMNResult } from "./whatsmyname";
import { runMaigret, isMaigretAvailable, startBackgroundInstall, type MaigretProfile } from "./maigret";

// Start background install of maigret on module load
startBackgroundInstall();

export async function runUsernameSearch(id: string, username: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running", progress: 5 }).where(eq(searchesTable.id, id));

    // Run httpChecker, Twitch, WhatsMyName, and Maigret in parallel
    // Maigret is the slow path (Python subprocess + 500 sites + priority sites, ~30-120s)
    // Background install of maigret started at module load (startBackgroundInstall)
    const [platformResults, twitchData, wmnResultsRaw, maigretResult] = await Promise.allSettled([
      checkUsername(username),
      lookupTwitchUser(username),
      checkWhatsMyName(username, { concurrency: 20, perSiteTimeoutMs: 5000, globalTimeoutMs: 30000 }),
      isMaigretAvailable()
        ? runMaigret(username, { timeoutMs: 8000, maxConnections: 30, maxSites: 500 })
        : Promise.resolve({ username, found: [], totalFound: 0, elapsedSeconds: 0 }),
    ]);

    const results: PlatformResult[] = platformResults.status === "fulfilled" ? platformResults.value : [];
    const twitch = twitchData.status === "fulfilled" ? twitchData.value : null;
    const wmnResults: WMNResult[] = wmnResultsRaw.status === "fulfilled" ? wmnResultsRaw.value : [];
    const maigret = maigretResult.status === "fulfilled" ? maigretResult.value : null;

    // Merge WhatsMyName results (additive — don't overwrite existing httpChecker entries by slug)
    const existingSlugs = new Set(results.map((r) => r.slug));
    const wmnPlatformResults: PlatformResult[] = wmnResults
      .filter((w) => !existingSlugs.has(w.slug))
      .map((w) => {
        const pr = wmnResultToPlatformResult(w);
        return {
          slug: pr.slug,
          name: pr.name,
          category: pr.category,
          status: pr.status,
          url: pr.url,
          verified: pr.verified,
          profileData: pr.profileData,
        };
      });

    // Merge Maigret results (additive — adds new slugs not yet seen)
    const seenSlugs = new Set([...results.map((r) => r.slug), ...wmnPlatformResults.map((r) => r.slug)]);
    const maigretPlatformResults: PlatformResult[] = maigret
      ? maigret.found
          .filter((m) => !seenSlugs.has(slugifyName(m.site)))
          .map((m) => maigretToPlatformResult(m))
      : [];

    const mergedResults: PlatformResult[] = [...results, ...wmnPlatformResults, ...maigretPlatformResults];

    await db.update(searchesTable).set({
      progress: 55,
      platformsSearched: mergedResults.length,
    }).where(eq(searchesTable.id, id));

    // Enrich GitHub result if found
    let githubProfile = null;
    const ghResult = mergedResults.find((r) => r.slug === "github" && r.status === "found");
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

    for (const r of mergedResults) {
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

    // Add Maigret profiles (richer data wins)
    if (maigret) {
      for (const m of maigret.found) {
        const slug = slugifyName(m.site);
        const existing = profilesFound[slug];
        if (!existing || !existing.bio) {
          // Maigret has bio/fullname/image — override or add
          profilesFound[slug] = {
            url: m.url,
            exists: true,
            status: "found",
            verified: true,  // Maigret uses CSRF+redirect+JSON+regex detection — high quality
            bio: m.bio,
            displayName: m.fullname,
            confidence: "high",
            profileData: {
              ...((existing?.profileData as Record<string, unknown>) ?? {}),
              source: "maigret",
              image: m.image,
              fullname: m.fullname,
              maigretExtra: m.extra,
              httpStatus: m.httpStatus,
            },
          };
        }
      }
    }

    const totalFound = Object.values(profilesFound).filter((p) => p.exists).length;
    const verifiedFound = Object.values(profilesFound).filter((p) => p.exists && p.verified).length;

    // Confidence: verified hits + breach context + cert data
    const confidence = Math.round(Math.min(
      0.2 + verifiedFound * 0.05 + (githubProfile ? 0.15 : 0) + (breaches.length > 0 ? 0.05 : 0),
      0.97
    ) * 100) / 100;

    // Aggregate sources actually used
    const sourcesUsed: string[] = [];
    if (results.length > 0) sourcesUsed.push("http-checker");
    if (wmnResults.length > 0) sourcesUsed.push("whatsmyname");
    if (maigret && maigret.found.length > 0) sourcesUsed.push("maigret");
    if (twitch) sourcesUsed.push("twitch");
    if (githubProfile) sourcesUsed.push("github");
    if (breaches.length > 0) sourcesUsed.push("breaches");

    // Derive top-level profile photo/bio/fullname from the richest source
    // Priority: GitHub > Maigret (YouTube/Gravatar) > Twitch
    let topPhoto: string | null = null;
    let topBio: string | null = null;
    let topFullname: string | null = null;
    if (githubProfile) {
      topPhoto = githubProfile.avatar ?? null;
      topBio = githubProfile.bio ?? null;
      topFullname = githubProfile.name ?? null;
    }
    if (!topPhoto && maigret) {
      // Find first Maigret profile with an image
      for (const m of maigret.found) {
        if (m.image) { topPhoto = m.image; break; }
      }
    }
    if (!topBio && maigret) {
      for (const m of maigret.found) {
        if (m.bio) { topBio = m.bio; break; }
      }
    }
    if (!topFullname && maigret) {
      for (const m of maigret.found) {
        if (m.fullname) { topFullname = m.fullname; break; }
      }
    }
    if (!topFullname && twitch?.displayName) {
      topFullname = twitch.displayName;
    }

    const usernameResult = {
      username,
      profilesFound,
      totalPlatformsSearched: mergedResults.length,
      totalFound,
      verifiedFound,
      githubProfile,
      breaches,
      emailRep,
      certDomains: certs.slice(0, 10).map((c: any) => c.domain),
      possibleEmail,
      sources: sourcesUsed,
      profilePhoto: topPhoto,
      profileBio: topBio,
      profileFullname: topFullname,
      maigretProfiles: maigret?.found ?? [],
      summary: {
        realName: topFullname ?? githubProfile?.name ?? null,
        location: githubProfile?.location ?? null,
        bio: topBio ?? githubProfile?.bio ?? null,
        languages: githubProfile?.languages ?? [],
        totalRepos: githubProfile?.publicRepos ?? null,
        totalStars: githubProfile?.totalStars ?? null,
      },
    };

    await db.update(searchesTable).set({
      status: "completed", progress: 100,
      platformsSearched: mergedResults.length,
      usernameResult, confidenceScore: confidence,
      resultsCount: totalFound, completedAt: new Date(),
    }).where(eq(searchesTable.id, id));
  } catch (err) {
    await db.update(searchesTable).set({ status: "failed" }).where(eq(searchesTable.id, id));
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function maigretToPlatformResult(m: MaigretProfile): PlatformResult {
  return {
    slug: slugifyName(m.site),
    name: m.site,
    category: m.category,
    status: "found",
    url: m.url,
    verified: true,  // Maigret's detection is more accurate than WMN
    profileData: {
      source: "maigret",
      fullname: m.fullname,
      bio: m.bio,
      image: m.image,
      maigretExtra: m.extra,
      httpStatus: m.httpStatus,
    },
  };
}
