import { db, searchesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { resolveEntityFromUsernameSearch } from "./intelligence/entity-resolver";
import { logger } from "../lib/logger";
import { checkUsername, type PlatformResult } from "./httpChecker";
import { getGitHubProfile } from "./githubOsint";
import { checkHIBP, lookupTwitchUser, checkLeakCheck, checkEmailRep, crtShLookup } from "./freeApis";
import { getSetting } from "./settingsService";
import { checkWhatsMyName, wmnResultToPlatformResult, type WMNResult } from "./whatsmyname";
import { runMaigret, isMaigretAvailable, startBackgroundInstall, type MaigretProfile, type MaigretResult } from "./maigret";
import { buildIdentityResolutionReport } from "./correlation/correlationEngine";

// Start background install of maigret on module load
startBackgroundInstall();

// ─── Request dedup ────────────────────────────────────────────────────────────
const inflightSearches = new Map<string, { promise: Promise<void>; timestamp: number; id: string }>();
const DEDUP_WINDOW_MS = 5_000;

function dedupUsernameSearch(newId: string, username: string): Promise<void> | null {
  const key = username.toLowerCase();
  const existing = inflightSearches.get(key);
  if (existing && Date.now() - existing.timestamp < DEDUP_WINDOW_MS) {
    return existing.promise.then(async () => {
      const [source] = await db.select().from(searchesTable).where(eq(searchesTable.id, existing.id));
      if (source?.status === "completed") {
        await db.update(searchesTable).set({
          status: source.status, progress: source.progress,
          platformsSearched: source.platformsSearched,
          usernameResult: source.usernameResult as any,
          confidenceScore: source.confidenceScore,
          resultsCount: source.resultsCount, completedAt: source.completedAt,
        }).where(eq(searchesTable.id, newId));
      }
    });
  }
  return null;
}

export async function runUsernameSearch(id: string, username: string): Promise<void> {
  const deduped = dedupUsernameSearch(id, username);
  if (deduped) return deduped;

  const dedupKey = username.toLowerCase();
  const searchPromise = (async () => { try { await doRun(id, username); } finally { inflightSearches.delete(dedupKey); } })();
  inflightSearches.set(dedupKey, { promise: searchPromise, timestamp: Date.now(), id });
  return searchPromise;
}

async function doRun(id: string, username: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running", progress: 5 }).where(eq(searchesTable.id, id));

    // ── Phase 1: FAST — social media priority sites + httpChecker ──────────
    // These complete in ~3-10s and are what users care about most.
    const SOCIAL_WMN_SITES = [
      "Twitter", "X", "Facebook", "Instagram", "LinkedIn", "YouTube", "TikTok",
      "Reddit", "Pinterest", "Snapchat", "Tumblr", "Twitch", "Discord", "Telegram",
      "WhatsApp", "Mastodon", "Threads", "Bluesky", "VK", "Weibo", "QQ", "WeChat",
      "Gravatar", "GitHub", "GitLab", "Bitbucket", "StackOverflow", "Medium",
      "Substack", "Blogger", "WordPress", "Flickr", "Vimeo",
      "SoundCloud", "Bandcamp", "DeviantArt", "Behance", "Dribbble", "Figma",
      "About.me", "Wattpad", "Quora",
    ];

    const phase1Result = await Promise.race([
      Promise.allSettled([
        checkUsername(username),
        lookupTwitchUser(username),
        checkWhatsMyName(username, {
          concurrency: 40,
          perSiteTimeoutMs: 4000,
          globalTimeoutMs: 8000,
          siteNames: SOCIAL_WMN_SITES,
        }),
        isMaigretAvailable()
          ? runMaigret(username, { timeoutMs: 4000, maxConnections: 40, maxSites: 50 })
          : Promise.resolve({ username, found: [], totalFound: 0, elapsedSeconds: 0 }),
      ]),
      new Promise<PromiseSettledResult<unknown>[]>((_, reject) =>
        setTimeout(() => reject(new Error("Phase 1 global timeout")), 15000),
      ),
    ]);
    const [platformResults, twitchData, socialWmnRaw, maigretResult] = phase1Result as PromiseSettledResult<any>[];

    const results: PlatformResult[] = platformResults.status === "fulfilled" ? platformResults.value : [];
    const twitch = twitchData.status === "fulfilled" ? twitchData.value : null;
    const socialWmn: WMNResult[] = socialWmnRaw.status === "fulfilled" ? socialWmnRaw.value : [];
    const maigretPhase1 = maigretResult.status === "fulfilled" ? maigretResult.value : null;

    // Merge Phase 1 results
    const existingSlugs1 = new Set(results.map((r) => r.slug));
    const wmnPlatformResults1: PlatformResult[] = socialWmn
      .filter((w) => !existingSlugs1.has(w.slug))
      .map((w) => {
        const pr = wmnResultToPlatformResult(w);
        return { slug: pr.slug, name: pr.name, category: pr.category, status: pr.status, url: pr.url, verified: pr.verified, profileData: pr.profileData };
      });

    const seenSlugs1 = new Set([...results.map((r) => r.slug), ...wmnPlatformResults1.map((r) => r.slug)]);
    const maigret1Found: MaigretProfile[] = maigretPhase1 ? maigretPhase1.found : [];
    const maigretPlatformResults1: PlatformResult[] = maigret1Found
      .filter((m) => !seenSlugs1.has(slugifyName(m.site)))
      .map((m) => maigretToPlatformResult(m));

    const phase1merged = [...results, ...wmnPlatformResults1, ...maigretPlatformResults1];
    const phase1ProfilesFound = buildProfilesMap(phase1merged, maigretPhase1, twitch, username);

    // Save partial results immediately so frontend can render social media hits fast
    const phase1totalFound = Object.values(phase1ProfilesFound).filter((p) => p.exists).length;
    const partialResult = buildUsernameResult(username, phase1ProfilesFound, phase1merged, maigretPhase1, twitch, null, [], [], [] as any[], null as any);
    await db.update(searchesTable).set({
      progress: 25,
      platformsSearched: phase1merged.length,
      usernameResult: partialResult,
      resultsCount: phase1totalFound,
    }).where(eq(searchesTable.id, id));

    const [remainingWmnRaw, maigretPhase2] = await Promise.all([
      checkWhatsMyName(username, {
        concurrency: 20,
        perSiteTimeoutMs: 5000,
        globalTimeoutMs: 45000,
      }),
      isMaigretAvailable()
        ? runMaigret(username, { timeoutMs: 8000, maxConnections: 30, maxSites: 500 }).catch(() => null)
        : Promise.resolve(null),
    ]);
    const SOCIAL_SLUGS = new Set(SOCIAL_WMN_SITES.map((n) => n.toLowerCase()));
    const remainingWmn: WMNResult[] = remainingWmnRaw.filter(
      (w) => !SOCIAL_SLUGS.has(w.siteName.toLowerCase()),
    );

    const seenSlugs2 = new Set(phase1merged.map((r) => r.slug));
    const wmnPlatformResults2: PlatformResult[] = remainingWmn
      .filter((w) => !seenSlugs2.has(w.slug))
      .map((w) => {
        const pr = wmnResultToPlatformResult(w);
        return { slug: pr.slug, name: pr.name, category: pr.category, status: pr.status, url: pr.url, verified: pr.verified, profileData: pr.profileData };
      });

    const finalMerged = [...phase1merged, ...wmnPlatformResults2];
    const maigretFinal = maigretPhase2 ?? maigretPhase1;
    const seenSlugs3 = new Set(finalMerged.map((r) => r.slug));
    if (maigretFinal) {
      for (const m of maigretFinal.found) {
        const slug = slugifyName(m.site);
        if (!seenSlugs3.has(slug)) {
          finalMerged.push(maigretToPlatformResult(m));
          seenSlugs3.add(slug);
        }
      }
    }

    // Enrich GitHub — combined with progress update from previous step
    let githubProfile = null;
    const ghResult = finalMerged.find((r) => r.slug === "github" && r.status === "found");
    if (ghResult) {
      githubProfile = await getGitHubProfile(username).catch(() => null);
    }
    await db.update(searchesTable).set({ progress: 68, platformsSearched: finalMerged.length }).where(eq(searchesTable.id, id));

    // Breach & reputation
    const possibleEmail = githubProfile?.email ?? null;
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

    const profilesFoundFinal = buildProfilesMap(finalMerged, maigretFinal, twitch, username);
    const totalFound = Object.values(profilesFoundFinal).filter((p) => p.exists).length;

    const usernameResult = buildUsernameResult(username, profilesFoundFinal, finalMerged, maigretFinal, twitch, githubProfile, breaches, emailRep, certs, possibleEmail);
    const confidence = usernameResult.identityReport.identities[0]?.confidence ?? 0;

    await db.update(searchesTable).set({
      status: "completed", progress: 100,
      platformsSearched: finalMerged.length,
      usernameResult, confidenceScore: confidence,
      resultsCount: totalFound, completedAt: new Date(),
    }).where(eq(searchesTable.id, id));

    // ── Entity Resolution (non-blocking) ────────────────────────────────────
    resolveEntityFromUsernameSearch(username, usernameResult as unknown as Record<string, unknown>)
      .then(({ entityId, isNew, confidenceScore: cs }) => {
        db.update(searchesTable).set({ entityId }).where(eq(searchesTable.id, id)).catch(() => {});
        logger.info({ entityId, isNew, username, confidenceScore: cs }, "entity resolved after username search");
      })
      .catch((err) => logger.error(err, "entity resolution failed (username search)"));
  } catch (err) {
    await db.update(searchesTable).set({ status: "failed" }).where(eq(searchesTable.id, id));
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildProfilesMap(merged: PlatformResult[], maigret: MaigretResult | null, twitch: any, username: string) {
  const profilesFound: Record<string, {
    url: string | null; exists: boolean; status: string; verified: boolean;
    bio?: string | null; followers?: number | null; displayName?: string | null;
    confidence: string | null; profileData?: Record<string, unknown>;
  }> = {};

  for (const r of merged) {
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
  if (twitch) {
    profilesFound["twitch"] = {
      url: `https://twitch.tv/${username}`, exists: true, status: "found", verified: true,
      bio: twitch.description ?? null, followers: twitch.followers, displayName: twitch.displayName,
      confidence: "high", profileData: twitch as unknown as Record<string, unknown>,
    };
  }
  if (maigret) {
    for (const m of maigret.found) {
      const slug = slugifyName(m.site);
      const existing = profilesFound[slug];
      if (!existing || !existing.bio) {
        profilesFound[slug] = {
          url: m.url, exists: true, status: "found", verified: true,
          bio: m.bio, displayName: m.fullname, confidence: "high",
          profileData: {
            ...((existing?.profileData as Record<string, unknown>) ?? {}),
            source: "maigret", image: m.image, fullname: m.fullname,
            maigretExtra: m.extra, httpStatus: m.httpStatus,
          },
        };
      }
    }
  }
  return profilesFound;
}

function deriveTopLevelImage(profilesFound: Record<string, any>, maigret: MaigretResult | null): string | null {
  for (const m of maigret?.found ?? []) {
    if (m.image) return m.image;
  }
  return null;
}

function deriveBio(profilesFound: Record<string, any>, maigret: MaigretResult | null): string | null {
  for (const m of maigret?.found ?? []) {
    if (m.bio) return m.bio;
  }
  const firstWithBio = Object.values(profilesFound).find((p) => p.bio);
  return firstWithBio?.bio ?? null;
}

function deriveFullname(profilesFound: Record<string, any>, maigret: MaigretResult | null, twitch: any): string | null {
  if (twitch?.displayName) return twitch.displayName;
  for (const m of maigret?.found ?? []) {
    if (m.fullname) return m.fullname;
  }
  const firstWithName = Object.values(profilesFound).find((p) => p.displayName);
  return firstWithName?.displayName ?? null;
}

function buildUsernameResult(
  username: string,
  profilesFound: Record<string, any>,
  mergedResults: PlatformResult[],
  maigret: MaigretResult | null,
  twitch: any,
  githubProfile: any,
  breaches: any[],
  emailRep: any,
  certs: any[],
  possibleEmail: string | null,
) {
  const totalFound = Object.values(profilesFound).filter((p) => p.exists).length;

  // Derive top-level fields from richest source
  const topPhoto = deriveTopLevelImage(profilesFound, maigret);
  const topBio = deriveBio(profilesFound, maigret);
  const topFullname = deriveFullname(profilesFound, maigret, twitch);

  const sourcesUsed: string[] = [];
  if (mergedResults.some((r) => r.status === "found")) sourcesUsed.push("http-checker");
  if (maigret && maigret.found.length > 0) sourcesUsed.push("maigret");
  if (twitch) sourcesUsed.push("twitch");
  if (githubProfile) sourcesUsed.push("github");
  if (breaches.length > 0) sourcesUsed.push("breaches");

  const identityReport = buildIdentityResolutionReport({
    username,
    profilesFound,
    mergedResults,
    maigret,
    twitch,
    githubProfile,
    possibleEmail,
  });

  return {
    username,
    profilesFound,
    totalPlatformsSearched: mergedResults.length,
    totalFound,
    verifiedFound: Object.values(profilesFound).filter((p) => p.exists && p.verified).length,
    githubProfile,
    breaches,
    emailRep,
    certDomains: certs.slice(0, 10).map((c: any) => c.domain),
    possibleEmail,
    sources: sourcesUsed,
    profilePhoto: topPhoto,
    profileBio: topBio,
    profileFullname: topFullname,
    identityReport,
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
}

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
    verified: true,
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
