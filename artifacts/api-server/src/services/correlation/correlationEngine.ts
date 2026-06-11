import type { PlatformResult } from "../httpChecker";
import type { MaigretResult } from "../maigret";
import type { GitHubProfile } from "../githubOsint";

interface ProfileEntry {
  exists: boolean;
  displayName?: string | null;
  bio?: string | null;
  url?: string | null;
  verified?: boolean | null;
  profileData?: Record<string, unknown>;
}

interface TwitchProfile {
  displayName?: string | null;
}

export type EvidenceType =
  | "username_exact"
  | "website_match"
  | "email_match"
  | "phone_match"
  | "profile_image_match"
  | "display_name_match"
  | "name_token_overlap"
  | "bio_overlap"
  | "location_match"
  | "source_corroboration"
  | "conflicting_name"
  | "conflicting_location"
  | "duplicate_source"
  | "weak_single_source";

export interface IdentityObservation {
  id: string;
  source: string;
  platform: string;
  url: string | null;
  verified: boolean;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  profileImage: string | null;
  metadata: Record<string, unknown>;
}

export interface CorrelationEvidenceItem {
  type: EvidenceType;
  weight: number;
  description: string;
  platforms: string[];
  polarity: "supporting" | "conflicting" | "caution";
}

export interface IdentityClusterReport {
  id: string;
  label: string;
  confidence: number;
  confidencePercent: number;
  level: "very_high" | "high" | "medium" | "low" | "weak" | "unrelated";
  conclusion: string;
  platforms: Array<{
    platform: string;
    source: string;
    url: string | null;
    username: string | null;
    displayName: string | null;
    verified: boolean;
  }>;
  evidence: CorrelationEvidenceItem[];
  conflicts: CorrelationEvidenceItem[];
  representative: {
    username: string | null;
    displayName: string | null;
    bio: string | null;
    website: string | null;
    location: string | null;
    profileImage: string | null;
  };
}

export interface IdentityResolutionReport {
  query: string;
  identities: IdentityClusterReport[];
  suppressed: {
    count: number;
    reason: string;
    platforms: string[];
  };
  analysisSummary: string;
  scoringVersion: "identity-correlation-v1";
}

const EVIDENCE_WEIGHTS = {
  usernameExact: 0.35,
  websiteMatch: 0.22,
  emailMatch: 0.3,
  phoneMatch: 0.28,
  profileImageMatch: 0.25,
  displayNameMatch: 0.15,
  nameTokenOverlap: 0.08,
  bioOverlap: 0.1,
  locationMatch: 0.09,
  sourceCorroboration: 0.05,
  conflictingName: 0.18,
  conflictingLocation: 0.1,
  duplicateSource: 0.12,
  weakSingleSource: 0.12,
} as const;

export function buildIdentityResolutionReport(params: {
  username: string;
  profilesFound: Record<string, ProfileEntry>;
  mergedResults: PlatformResult[];
  maigret: MaigretResult | null;
  twitch: TwitchProfile | null;
  githubProfile: GitHubProfile | null;
  possibleEmail: string | null;
}): IdentityResolutionReport {
  const observations = dedupeObservations(
    buildObservations(
      params.username,
      params.profilesFound,
      params.mergedResults,
      params.maigret,
      params.twitch,
      params.githubProfile,
      params.possibleEmail,
    ),
  );
  const clusters = clusterObservations(observations);
  const reports = clusters.map((cluster, index) => scoreCluster(cluster, index + 1));
  const visible = reports
    .filter((cluster) => cluster.confidence >= 0.4 || (cluster.platforms.length >= 2 && cluster.confidence >= 0.15) || cluster.platforms.length >= 3)
    .sort((a, b) => b.confidence - a.confidence);
  const suppressedReports = reports.filter((cluster) => !visible.includes(cluster));

  return {
    query: params.username,
    identities: visible,
    suppressed: {
      count: suppressedReports.reduce((sum, cluster) => sum + cluster.platforms.length, 0),
      reason: "تم إخفاء النتائج الضعيفة لأنها لا تملك أدلة كافية تربطها بهوية واحدة.",
      platforms: suppressedReports.flatMap((cluster) => cluster.platforms.map((p) => p.platform)).slice(0, 20),
    },
    analysisSummary: buildArabicSummary(visible, suppressedReports.length),
    scoringVersion: "identity-correlation-v1",
  };
}

function buildObservations(
  username: string,
  profilesFound: Record<string, ProfileEntry>,
  mergedResults: PlatformResult[],
  maigret: MaigretResult | null,
  twitch: TwitchProfile | null,
  githubProfile: GitHubProfile | null,
  possibleEmail: string | null,
): IdentityObservation[] {
  const bySlug = new Map(mergedResults.map((r) => [r.slug, r]));
  const maigretBySlug = new Map((maigret?.found ?? []).map((m) => [slugify(m.site), m]));
  const observations: IdentityObservation[] = [];

  for (const [platform, profile] of Object.entries(profilesFound)) {
    if (!profile?.exists) continue;
    const result = bySlug.get(platform);
    const m = maigretBySlug.get(platform);
    const profileData = ((profile.profileData ?? result?.profileData ?? {}) as Record<string, unknown>);
    const displayName = firstString(
      profile.displayName,
      profileData.name,
      profileData.fullName,
      profileData.fullname,
      m?.fullname,
      platform === "twitch" ? twitch?.displayName : null,
      platform === "github" ? githubProfile?.name : null,
    );
    const bio = firstString(
      profile.bio,
      profileData.bio,
      profileData.description,
      profileData.about,
      m?.bio,
      platform === "github" ? githubProfile?.bio : null,
    );
    const location = firstString(
      profileData.location,
      profileData.country,
      platform === "github" ? githubProfile?.location : null,
    );
    const website = normalizeWebsite(firstString(
      profileData.website,
      profileData.blog,
      platform === "github" ? githubProfile?.blog : null,
    ));
    const email = normalizeEmail(firstString(
      profileData.email,
      platform === "github" ? githubProfile?.email : null,
      platform === "github" ? possibleEmail : null,
    ));
    const profileImage = normalizeImage(firstString(
      profileData.avatar,
      profileData.image,
      profileData.iconImg,
      m?.image,
      platform === "github" ? githubProfile?.avatar : null,
    ));

    observations.push({
      id: `${platform}:${profile.url ?? result?.url ?? observations.length}`,
      source: sourceFromProfile(profileData, m),
      platform,
      url: profile.url ?? result?.url ?? null,
      verified: Boolean(profile.verified ?? result?.verified),
      username,
      displayName,
      bio,
      website,
      email,
      phone: null,
      location,
      profileImage,
      metadata: profileData,
    });
  }

  return observations;
}

function clusterObservations(observations: IdentityObservation[]): IdentityObservation[][] {
  const clusters: IdentityObservation[][] = [];

  for (const observation of observations) {
    const matches = clusters.filter((cluster) => canJoinCluster(observation, cluster));
    if (matches.length === 0) {
      clusters.push([observation]);
      continue;
    }

    matches[0].push(observation);
    for (const extra of matches.slice(1)) {
      matches[0].push(...extra);
      clusters.splice(clusters.indexOf(extra), 1);
    }
  }

  return clusters;
}

function canJoinCluster(observation: IdentityObservation, cluster: IdentityObservation[]): boolean {
  return cluster.some((existing) => hasHardCorrelation(observation, existing));
}

function hasHardCorrelation(a: IdentityObservation, b: IdentityObservation): boolean {
  if (a.source === b.source && a.platform === b.platform) return false;
  if (a.email && b.email && a.email === b.email) return true;
  if (a.phone && b.phone && a.phone === b.phone) return true;
  if (a.website && b.website && a.website === b.website) return true;
  if (a.profileImage && b.profileImage && a.profileImage === b.profileImage) return true;
  if (hasCorroboratedNameMatch(a, b)) return true;
  return false;
}


function hasCorroboratedNameMatch(a: IdentityObservation, b: IdentityObservation): boolean {
  const sameDisplayName = Boolean(
    a.displayName
      && b.displayName
      && normalizeText(a.displayName) === normalizeText(b.displayName),
  );
  const sameUsername = Boolean(
    a.username
      && b.username
      && normalizeUsername(a.username) === normalizeUsername(b.username),
  );
  return sameUsername && sameDisplayName;
}

function scoreCluster(cluster: IdentityObservation[], ordinal: number): IdentityClusterReport {
  const evidence: CorrelationEvidenceItem[] = [];
  const conflicts: CorrelationEvidenceItem[] = [];

  addSharedEvidence(cluster, evidence);
  addConflictEvidence(cluster, conflicts);

  let score = evidence.reduce((sum, item) => sum + item.weight, 0) - conflicts.reduce((sum, item) => sum + item.weight, 0);
  if (cluster.length === 1) score -= EVIDENCE_WEIGHTS.weakSingleSource;
  score = Math.max(0, Math.min(0.97, score));

  const confidence = round2(score);
  const level = confidenceLevel(confidence);
  const representative = buildRepresentative(cluster);

  return {
    id: `identity-${ordinal}`,
    label: `Identity ${String.fromCharCode(64 + Math.min(ordinal, 26))}`,
    confidence,
    confidencePercent: Math.round(confidence * 100),
    level,
    conclusion: conclusionFor(level),
    platforms: cluster
      .sort((a, b) => a.platform.localeCompare(b.platform))
      .map((identity) => ({
        platform: identity.platform,
        source: identity.source,
        url: identity.url,
        username: identity.username,
        displayName: identity.displayName,
        verified: identity.verified,
      })),
    evidence,
    conflicts,
    representative,
  };
}

function addSharedEvidence(cluster: IdentityObservation[], evidence: CorrelationEvidenceItem[]): void {
  const usernameGroups = groupBy(cluster, (i) => normalizeUsername(i.username ?? ""));
  const websiteGroups = groupBy(cluster, (i) => i.website ?? "");
  const emailGroups = groupBy(cluster, (i) => i.email ?? "");
  const phoneGroups = groupBy(cluster, (i) => i.phone ?? "");
  const imageGroups = groupBy(cluster, (i) => i.profileImage ?? "");
  const displayNameGroups = groupBy(cluster, (i) => normalizeText(i.displayName ?? ""));
  const locationGroups = groupBy(cluster, (i) => normalizeText(i.location ?? ""));

  addGroupEvidence(usernameGroups, "username_exact", EVIDENCE_WEIGHTS.usernameExact, "تطابق اسم المستخدم بعد التطبيع", evidence);
  addGroupEvidence(websiteGroups, "website_match", EVIDENCE_WEIGHTS.websiteMatch, "نفس الموقع أو النطاق مذكور في أكثر من حساب", evidence);
  addGroupEvidence(emailGroups, "email_match", EVIDENCE_WEIGHTS.emailMatch, "نفس البريد ظهر كدليل داعم عبر المصادر", evidence);
  addGroupEvidence(phoneGroups, "phone_match", EVIDENCE_WEIGHTS.phoneMatch, "نفس رقم الهاتف ظهر كدليل داعم عبر المصادر", evidence);
  addGroupEvidence(imageGroups, "profile_image_match", EVIDENCE_WEIGHTS.profileImageMatch, "نفس صورة الملف الشخصي أو رابطها", evidence);
  addGroupEvidence(displayNameGroups, "display_name_match", EVIDENCE_WEIGHTS.displayNameMatch, "تطابق اسم العرض", evidence);
  addGroupEvidence(locationGroups, "location_match", EVIDENCE_WEIGHTS.locationMatch, "تطابق الموقع الجغرافي المعلن", evidence);

  const nameOverlap = strongestTokenOverlap(cluster.map((i) => tokenSet(i.displayName)));
  if (nameOverlap >= 0.6) {
    evidence.push({
      type: "name_token_overlap",
      weight: EVIDENCE_WEIGHTS.nameTokenOverlap,
      description: "تشابه قوي في مكونات الاسم الظاهر",
      platforms: cluster.map((i) => i.platform),
      polarity: "supporting",
    });
  }

  const bioOverlap = strongestTokenOverlap(cluster.map((i) => tokenSet(i.bio)));
  if (bioOverlap >= 0.5) {
    evidence.push({
      type: "bio_overlap",
      weight: EVIDENCE_WEIGHTS.bioOverlap,
      description: "تشابه واضح في نصوص النبذة العامة",
      platforms: cluster.map((i) => i.platform),
      polarity: "supporting",
    });
  }

  const sourceCount = new Set(cluster.map((i) => i.source)).size;
  if (sourceCount > 1) {
    evidence.push({
      type: "source_corroboration",
      weight: Math.min(0.15, (sourceCount - 1) * EVIDENCE_WEIGHTS.sourceCorroboration),
      description: "تأكيد من أكثر من أداة أو مصدر جمع",
      platforms: cluster.map((i) => i.platform),
      polarity: "supporting",
    });
  }
}

function addConflictEvidence(cluster: IdentityObservation[], conflicts: CorrelationEvidenceItem[]): void {
  const names = uniqueMeaningful(cluster.map((i) => normalizeText(i.displayName ?? "")));
  if (names.length > 1 && !hasTokenOverlapConflictException(cluster.map((i) => i.displayName))) {
    conflicts.push({
      type: "conflicting_name",
      weight: EVIDENCE_WEIGHTS.conflictingName,
      description: "أسماء العرض مختلفة ولا يوجد تداخل كاف بينها",
      platforms: cluster.filter((i) => i.displayName).map((i) => i.platform),
      polarity: "conflicting",
    });
  }

  const locations = uniqueMeaningful(cluster.map((i) => normalizeText(i.location ?? "")));
  if (locations.length > 1) {
    conflicts.push({
      type: "conflicting_location",
      weight: EVIDENCE_WEIGHTS.conflictingLocation,
      description: "توجد مواقع جغرافية معلنة متضاربة",
      platforms: cluster.filter((i) => i.location).map((i) => i.platform),
      polarity: "conflicting",
    });
  }

  const duplicateSources = [...groupBy(cluster, (i) => i.platform).values()].filter((items) => items.length > 1);
  if (duplicateSources.length > 0) {
    conflicts.push({
      type: "duplicate_source",
      weight: EVIDENCE_WEIGHTS.duplicateSource,
      description: "أكثر من حساب من نفس المنصة داخل نفس المجموعة",
      platforms: duplicateSources.flatMap((items) => items.map((i) => i.platform)),
      polarity: "caution",
    });
  }
}

function addGroupEvidence(
  groups: Map<string, IdentityObservation[]>,
  type: EvidenceType,
  weight: number,
  description: string,
  evidence: CorrelationEvidenceItem[],
): void {
  const matches = [...groups.entries()].filter(([key, items]) => key && items.length > 1);
  if (matches.length === 0) return;
  const platforms = [...new Set(matches.flatMap(([, items]) => items.map((i) => i.platform)))];
  evidence.push({ type, weight, description, platforms, polarity: "supporting" });
}

function buildRepresentative(cluster: IdentityObservation[]): IdentityClusterReport["representative"] {
  const sorted = [...cluster].sort((a, b) => Number(b.verified) - Number(a.verified));
  return {
    username: firstString(...sorted.map((i) => i.username)),
    displayName: firstString(...sorted.map((i) => i.displayName)),
    bio: firstString(...sorted.map((i) => i.bio)),
    website: firstString(...sorted.map((i) => i.website)),
    location: firstString(...sorted.map((i) => i.location)),
    profileImage: firstString(...sorted.map((i) => i.profileImage)),
  };
}

function confidenceLevel(score: number): IdentityClusterReport["level"] {
  if (score >= 0.9) return "very_high";
  if (score >= 0.75) return "high";
  if (score >= 0.55) return "medium";
  if (score >= 0.4) return "low";
  if (score >= 0.15) return "weak";
  return "unrelated";
}

function conclusionFor(level: IdentityClusterReport["level"]): string {
  switch (level) {
    case "very_high":
      return "مرجح جداً أنها نفس الهوية.";
    case "high":
      return "مرجح أنها نفس الهوية مع أدلة داعمة قوية.";
    case "medium":
      return "ارتباط محتمل يحتاج مراجعة الأدلة.";
    case "low":
      return "ارتباط ضعيف ولا يكفي للجزم.";
    case "weak":
      return "تشابه محدود فقط.";
    default:
      return "غالباً غير مرتبط.";
  }
}

function buildArabicSummary(visible: IdentityClusterReport[], suppressedCount: number): string {
  if (visible.length === 0) {
    return suppressedCount > 0
      ? "لم تظهر مجموعة هوية موثوقة؛ تم إخفاء نتائج ضعيفة لتقليل الإيجابيات الكاذبة."
      : "لم يتم العثور على أدلة كافية لبناء مجموعة هوية.";
  }

  const top = visible[0];
  return `تم بناء ${visible.length} مجموعة هوية. أعلى مجموعة بثقة ${top.confidencePercent}%: ${top.conclusion}`;
}

function dedupeObservations(observations: IdentityObservation[]): IdentityObservation[] {
  const seen = new Set<string>();
  return observations.filter((observation) => {
    const key = `${observation.platform}:${observation.url ?? observation.username ?? observation.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceFromProfile(profileData: Record<string, unknown>, maigretProfile: unknown): string {
  const source = firstString(profileData.source);
  if (source) return source;
  if (maigretProfile) return "maigret";
  return "platform-checker";
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function strongestTokenOverlap(sets: Array<Set<string>>): number {
  let strongest = 0;
  for (let i = 0; i < sets.length; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      const a = sets[i];
      const b = sets[j];
      if (a.size === 0 || b.size === 0) continue;
      const shared = [...a].filter((token) => b.has(token)).length;
      strongest = Math.max(strongest, shared / Math.min(a.size, b.size));
    }
  }
  return strongest;
}

function hasTokenOverlapConflictException(names: Array<string | null>): boolean {
  const sets = names.map(tokenSet).filter((set) => set.size > 0);
  return strongestTokenOverlap(sets) >= 0.5;
}

function tokenSet(value: string | null): Set<string> {
  return new Set((value ?? "").toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter((token) => token.length > 2));
}

function uniqueMeaningful(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 2))];
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeUsername(value: string): string {
  return normalizeText(value);
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "").trim();
}

function normalizeEmail(value: string | null): string | null {
  if (!value || !value.includes("@")) return null;
  return value.trim().toLowerCase();
}

function normalizeWebsite(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function normalizeImage(value: string | null): string | null {
  if (!value) return null;
  return value.trim().replace(/\?.*$/, "");
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
