import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { checkUsername, type PlatformResult, getVerifiedSlugs, getManualSlugs } from "./httpChecker";
import { getGitHubProfile } from "./githubOsint";
import { checkHIBP, lookupTwitchUser, checkLeakCheck, checkEmailRep, crtShLookup } from "./freeApis";
import { getSetting } from "./settingsService";
import { checkWhatsMyName, wmnResultToPlatformResult, type WMNResult } from "./whatsmyname";
import { runMaigret, isMaigretAvailable, startBackgroundInstall, type MaigretProfile, type MaigretResult } from "./maigret";
import { buildIdentityResolutionReport } from "./correlation/correlationEngine";

startBackgroundInstall();

const SOCIAL_SITES = new Set([
  "twitter", "x", "facebook", "instagram", "linkedin", "youtube", "tiktok",
  "reddit", "pinterest", "snapchat", "tumblr", "twitch", "discord", "telegram",
  "whatsapp", "mastodon", "threads", "bluesky", "vk", "weibo", "qq", "wechat",
  "gravatar", "github", "gitlab", "bitbucket", "stackoverflow", "medium",
  "substack", "blogger", "wordpress", "flickr", "vimeo",
  "soundcloud", "bandcamp", "deviantart", "behance", "dribbble", "figma",
  "aboutme", "wattpad", "quora",
]);

// Platforms already checked by httpChecker — skip them in wmn/maigret
const HTTP_CHECKED = new Set(getVerifiedSlugs().concat(getManualSlugs()));

function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function maigretToPlatformResult(m: MaigretProfile): PlatformResult {
  return {
    slug: slugifyName(m.site), name: m.site, category: m.category,
    status: "found", url: m.url, verified: true,
    profileData: { source: "maigret", fullname: m.fullname, bio: m.bio, image: m.image, maigretExtra: m.extra, httpStatus: m.httpStatus },
  };
}

async function runPhase1(username: string) {
  const [httpResults, socialWmnRaw, maigretResult] = await Promise.allSettled([
    checkUsername(username),
    checkWhatsMyName(username, {
      concurrency: 40, perSiteTimeoutMs: 4000, globalTimeoutMs: 8000,
      siteNames: Array.from(SOCIAL_SITES),
    }),
    isMaigretAvailable()
      ? runMaigret(username, { timeoutMs: 4000, maxConnections: 40, maxSites: 50 })
      : Promise.resolve({ username, found: [], totalFound: 0, elapsedSeconds: 0 }),
  ]);

  const results: PlatformResult[] = httpResults.status === "fulfilled" ? httpResults.value : [];
  const socialWmn: WMNResult[] = socialWmnRaw.status === "fulfilled" ? socialWmnRaw.value : [];
  const maigretPhase1 = maigretResult.status === "fulfilled" ? maigretResult.value : null;

  // Filter out what httpChecker already checked (dedup)
  const newWmn = socialWmn.filter(w => !HTTP_CHECKED.has(slugifyName(w.siteName)));
  const wmnPlatformResults = newWmn.map(w => {
    const pr = wmnResultToPlatformResult(w);
    return { slug: pr.slug, name: pr.name, category: pr.category, status: pr.status, url: pr.url, verified: pr.verified, profileData: pr.profileData };
  });

  const merged = [...results, ...wmnPlatformResults];
  const existingSlugs = new Set(merged.map(r => r.slug));

  const maigretNew = (maigretPhase1?.found ?? [])
    .filter(m => !existingSlugs.has(slugifyName(m.site)))
    .map(maigretToPlatformResult);

  merged.push(...maigretNew);

  return { merged, maigretPhase1 };
}

async function runPhase2(username: string, existingSlugs: Set<string>) {
  const [remainingWmnRaw, maigretPhase2] = await Promise.all([
    checkWhatsMyName(username, { concurrency: 20, perSiteTimeoutMs: 5000, globalTimeoutMs: 45000 }),
    isMaigretAvailable()
      ? runMaigret(username, { timeoutMs: 8000, maxConnections: 30, maxSites: 500 }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const remainingWmn = remainingWmnRaw.filter(w => !existingSlugs.has(slugifyName(w.siteName)));
  const wmnResults = remainingWmn.map(w => {
    const pr = wmnResultToPlatformResult(w);
    return { slug: pr.slug, name: pr.name, category: pr.category, status: pr.status, url: pr.url, verified: pr.verified, profileData: pr.profileData };
  });

  const maigretFound = maigretPhase2?.found ?? [];
  const maigretResults = maigretFound
    .filter(m => !existingSlugs.has(slugifyName(m.site)))
    .map(maigretToPlatformResult);

  return [...wmnResults, ...maigretResults];
}

export async function runUsernameSearch(id: string, username: string): Promise<void> {
  try {
    await db.update(searchesTable).set({ status: "running", progress: 5 }).where(eq(searchesTable.id, id));

    // ── Phase 1: FAST — social media + httpChecker + maigret ─────────────
    const phase1 = await runPhase1(username);
    const phase1Profiles = buildProfilesMap(phase1.merged, phase1.maigretPhase1, null, username);
    const phase1TotalFound = Object.values(phase1Profiles).filter(p => p.exists).length;

    const partialResult = buildUsernameResult(username, phase1Profiles, phase1.merged, phase1.maigretPhase1, null, null, [], [], [] as any[], null as any);
    await db.update(searchesTable).set({
      progress: 35, platformsSearched: phase1.merged.length,
      usernameResult: partialResult, resultsCount: phase1TotalFound,
    }).where(eq(searchesTable.id, id));

    // ── Phase 2: SLOWER — remaining wmn + full maigret ────────────────────
    const existingSlugs = new Set(phase1.merged.map(r => r.slug));
    const phase2Results = await runPhase2(username, existingSlugs);

    const finalMerged = [...phase1.merged, ...phase2Results];
    await db.update(searchesTable).set({ progress: 55, platformsSearched: finalMerged.length }).where(eq(searchesTable.id, id));

    // ── Enrichment: GitHub + Twitch in parallel ────────────────────────────
    const ghResult = finalMerged.find(r => r.slug === "github" && r.status === "found");
    const [githubProfile, twitchData] = await Promise.all([
      ghResult ? getGitHubProfile(username).catch(() => null) : Promise.resolve(null),
      lookupTwitchUser(username).catch(() => null),
    ]);

    await db.update(searchesTable).set({ progress: 68 }).where(eq(searchesTable.id, id));

    // ── Breach & reputation (all parallel) ────────────────────────────────
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
        ? breachesLeakCheck.value.map(l => ({ name: l.source, breachDate: l.date ?? "", dataClasses: [] })) : []),
    ];
    const emailRep = emailRepData.status === "fulfilled" ? emailRepData.value : null;
    const certs = certData.status === "fulfilled" ? certData.value : [];

    await db.update(searchesTable).set({ progress: 88 }).where(eq(searchesTable.id, id));

    const maigretFinal = phase1.maigretPhase1 ?? null;
    const profilesFoundFinal = buildProfilesMap(finalMerged, maigretFinal, twitchData, username);
    const totalFound = Object.values(profilesFoundFinal).filter(p => p.exists).length;

    const usernameResult = buildUsernameResult(username, profilesFoundFinal, finalMerged, maigretFinal, twitchData, githubProfile, breaches, emailRep, certs, possibleEmail);
    const confidence = usernameResult.identityReport.identities[0]?.confidence ?? 0;

    await db.update(searchesTable).set({
      status: "completed", progress: 100,
      platformsSearched: finalMerged.length,
      usernameResult, confidenceScore: confidence,
      resultsCount: totalFound, completedAt: new Date(),
    }).where(eq(searchesTable.id, id));
  } catch (err) {
    await db.update(searchesTable).set({ status: "failed" }).where(eq(searchesTable.id, id));
  }
}

function buildProfilesMap(merged: PlatformResult[], maigret: MaigretResult | null, twitch: any, username: string) {
  const profilesFound: Record<string, { url: string | null; exists: boolean; status: string; verified: boolean; bio?: string | null; followers?: number | null; displayName?: string | null; confidence: string | null; profileData?: Record<string, unknown> }> = {};

  for (const r of merged) {
    profilesFound[r.slug] = {
      url: r.url, exists: r.status === "found", status: r.status,
      verified: r.verified, bio: (r.profileData as any)?.bio ?? null,
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
          profileData: { ...((existing?.profileData as Record<string, unknown>) ?? {}), source: "maigret", image: m.image, fullname: m.fullname, maigretExtra: m.extra, httpStatus: m.httpStatus },
        };
      }
    }
  }

  return profilesFound;
}

function deriveTopLevelImage(profilesFound: Record<string, any>, maigret: MaigretResult | null): string | null {
  for (const m of maigret?.found ?? []) { if (m.image) return m.image; }
  return null;
}

function deriveBio(profilesFound: Record<string, any>, maigret: MaigretResult | null): string | null {
  for (const m of maigret?.found ?? []) { if (m.bio) return m.bio; }
  const firstWithBio = Object.values(profilesFound).find(p => p.bio);
  return firstWithBio?.bio ?? null;
}

function deriveFullname(profilesFound: Record<string, any>, maigret: MaigretResult | null, twitch: any): string | null {
  if (twitch?.displayName) return twitch.displayName;
  for (const m of maigret?.found ?? []) { if (m.fullname) return m.fullname; }
  const firstWithName = Object.values(profilesFound).find(p => p.displayName);
  return firstWithName?.displayName ?? null;
}

function buildUsernameResult(
  username: string, profilesFound: Record<string, any>,
  mergedResults: PlatformResult[], maigret: MaigretResult | null,
  twitch: any, githubProfile: any, breaches: any[],
  emailRep: any, certs: any[], possibleEmail: string | null,
) {
  const totalFound = Object.values(profilesFound).filter(p => p.exists).length;
  const topPhoto = deriveTopLevelImage(profilesFound, maigret);
  const topBio = deriveBio(profilesFound, maigret);
  const topFullname = deriveFullname(profilesFound, maigret, twitch);

  const sourcesUsed: string[] = [];
  if (mergedResults.some(r => r.status === "found")) sourcesUsed.push("http-checker");
  if (maigret && maigret.found.length > 0) sourcesUsed.push("maigret");
  if (twitch) sourcesUsed.push("twitch");
  if (githubProfile) sourcesUsed.push("github");
  if (breaches.length > 0) sourcesUsed.push("breaches");

  const identityReport = buildIdentityResolutionReport({ username, profilesFound, mergedResults, maigret, twitch, githubProfile, possibleEmail });

  return {
    username, profilesFound,
    totalPlatformsSearched: mergedResults.length, totalFound,
    verifiedFound: Object.values(profilesFound).filter(p => p.exists && p.verified).length,
    githubProfile, breaches, emailRep,
    certDomains: certs.slice(0, 10).map((c: any) => c.domain),
    possibleEmail, sources: sourcesUsed,
    profilePhoto: topPhoto, profileBio: topBio, profileFullname: topFullname,
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
