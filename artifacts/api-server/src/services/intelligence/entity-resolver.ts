import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import {
  entitiesTable, identifiersTable, profilesTable,
  evidenceTable, timelineEventsTable,
  type InsertEntity,
} from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { computeConfidence, scoreToLevel } from "./confidence-engine";
import {
  buildEvidenceFromUsernameResult,
  buildEvidenceFromPhoneResult,
  buildEvidenceFromNameResult,
  evidenceToConfidenceInput,
  type EvidenceItem,
} from "./evidence-engine";
import { logger } from "../../lib/logger";

export interface ResolvedEntity {
  entityId: string;
  isNew: boolean;
  confidenceScore: number;
  evidenceCount: number;
}

async function findExistingEntityByIdentifier(
  type: string,
  normalizedValue: string,
): Promise<string | null> {
  const rows = await db
    .select({ entityId: identifiersTable.entityId })
    .from(identifiersTable)
    .where(
      and(
        eq(identifiersTable.type, type as any),
        eq(identifiersTable.normalizedValue, normalizedValue),
      ),
    )
    .limit(1);
  return rows[0]?.entityId ?? null;
}

async function upsertEntity(
  id: string,
  label: string,
  avatarUrl: string | null,
  confidenceScore: number,
  summary: string | null,
): Promise<void> {
  const existing = await db
    .select({ id: entitiesTable.id })
    .from(entitiesTable)
    .where(eq(entitiesTable.id, id))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(entitiesTable).values({
      id,
      label,
      confidenceScore,
      avatarUrl: avatarUrl ?? undefined,
      summary: summary ?? undefined,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(entitiesTable)
      .set({ confidenceScore, updatedAt: new Date(), avatarUrl: avatarUrl ?? undefined, summary: summary ?? undefined })
      .where(eq(entitiesTable.id, id));
  }
}

async function upsertIdentifier(
  entityId: string,
  type: string,
  value: string,
  normalizedValue: string,
  source: string,
  confidenceScore: number,
  verified: boolean,
): Promise<void> {
  const existing = await db
    .select({ id: identifiersTable.id })
    .from(identifiersTable)
    .where(
      and(
        eq(identifiersTable.entityId, entityId),
        eq(identifiersTable.type, type as any),
        eq(identifiersTable.normalizedValue, normalizedValue),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(identifiersTable).values({
      id: randomUUID(),
      entityId,
      type: type as any,
      value,
      normalizedValue,
      confidenceScore,
      verified,
      source,
      createdAt: new Date(),
    });
  }
}

async function upsertProfile(
  entityId: string,
  platform: string,
  data: {
    url?: string | null;
    username?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    verified?: boolean;
    rawData?: Record<string, unknown>;
  },
): Promise<void> {
  const existing = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(
      and(
        eq(profilesTable.entityId, entityId),
        eq(profilesTable.platform, platform),
      ),
    )
    .limit(1);

  const now = new Date();
  if (existing.length === 0) {
    await db.insert(profilesTable).values({
      id: randomUUID(),
      entityId,
      platform,
      url: data.url ?? undefined,
      username: data.username ?? undefined,
      displayName: data.displayName ?? undefined,
      bio: data.bio ?? undefined,
      avatarUrl: data.avatarUrl ?? undefined,
      verified: data.verified ?? false,
      confidenceScore: data.verified ? 0.95 : 0.75,
      rawData: data.rawData ?? {},
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(profilesTable)
      .set({ updatedAt: now, ...data })
      .where(eq(profilesTable.id, existing[0]!.id));
  }
}

async function storeEvidence(entityId: string, items: EvidenceItem[]): Promise<void> {
  if (items.length === 0) return;
  await db.insert(evidenceTable).values(
    items.map((e) => ({
      id: e.id,
      entityId,
      type: e.type,
      source: e.source,
      platform: e.platform ?? undefined,
      rawValue: e.rawValue ?? undefined,
      normalizedValue: e.normalizedValue ?? undefined,
      confidenceScore: e.confidenceScore,
      polarity: e.polarity,
      description: e.description,
      metadata: e.metadata ?? {},
      timestamp: e.timestamp,
    })),
  ).onConflictDoNothing();
}

async function addTimelineEvent(
  entityId: string,
  eventType: string,
  title: string,
  description: string,
  source: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(timelineEventsTable).values({
    id: randomUUID(),
    entityId,
    eventType,
    title,
    description,
    source,
    metadata: metadata ?? {},
    occurredAt: new Date(),
    createdAt: new Date(),
  });
}

export async function resolveEntityFromUsernameSearch(
  username: string,
  searchResult: Record<string, unknown>,
): Promise<ResolvedEntity> {
  try {
    const normalizedUsername = username.toLowerCase();
    let entityId = await findExistingEntityByIdentifier("username", normalizedUsername);
    const isNew = !entityId;
    if (!entityId) entityId = randomUUID();

    const evidence = buildEvidenceFromUsernameResult(username, searchResult);
    const confidenceResult = computeConfidence(evidence.map(evidenceToConfidenceInput));

    const profilesFound = searchResult["profilesFound"] as Record<string, { exists?: boolean; url?: string; displayName?: string; bio?: string; verified?: boolean; profileData?: Record<string, unknown> }> ?? {};
    const summary = searchResult["summary"] as Record<string, unknown> ?? {};
    const label = (summary["realName"] as string) || username;
    const avatarUrl = (searchResult["profilePhoto"] as string) ?? null;
    const summaryText = (summary["bio"] as string) ?? null;

    await upsertEntity(entityId, label, avatarUrl, confidenceResult.score, summaryText);
    await upsertIdentifier(entityId, "username", username, normalizedUsername, "username_search", confidenceResult.score, false);

    const maigretProfiles = searchResult["maigretProfiles"] as Array<Record<string, unknown>> ?? [];
    for (const mp of maigretProfiles) {
      if (mp["site"]) {
        await upsertProfile(entityId, mp["site"] as string, {
          url: mp["url"] as string,
          username,
          displayName: mp["fullname"] as string,
          bio: mp["bio"] as string,
          avatarUrl: mp["image"] as string,
          verified: true,
          rawData: mp,
        });
      }
    }

    for (const [platform, profile] of Object.entries(profilesFound)) {
      if (profile?.exists) {
        await upsertProfile(entityId, platform, {
          url: profile.url,
          username,
          displayName: profile.displayName,
          bio: profile.bio,
          verified: profile.verified ?? false,
          rawData: profile as unknown as Record<string, unknown>,
        });
      }
    }

    const possibleEmail = searchResult["possibleEmail"] as string | null;
    if (possibleEmail) {
      await upsertIdentifier(entityId, "email", possibleEmail, possibleEmail.toLowerCase(), "derived", 0.6, false);
    }

    await storeEvidence(entityId, evidence);

    await addTimelineEvent(
      entityId,
      "username_search",
      `Username search: ${username}`,
      `Search completed. Found ${evidence.filter(e => e.polarity === "supporting").length} supporting evidence items.`,
      "lyosint_search",
      { username, confidenceScore: confidenceResult.score },
    );

    logger.info({ entityId, isNew, username, confidence: confidenceResult.score }, "Entity resolved from username search");
    return { entityId, isNew, confidenceScore: confidenceResult.score, evidenceCount: evidence.length };
  } catch (err) {
    logger.error(err, "Failed to resolve entity from username search");
    throw err;
  }
}

export async function resolveEntityFromPhoneSearch(
  phone: string,
  searchResult: Record<string, unknown>,
): Promise<ResolvedEntity> {
  try {
    const e164 = (searchResult["e164"] as string) ?? phone;
    let entityId = await findExistingEntityByIdentifier("phone", e164);
    const isNew = !entityId;
    if (!entityId) entityId = randomUUID();

    const evidence = buildEvidenceFromPhoneResult(phone, searchResult);
    const confidenceResult = computeConfidence(evidence.map(evidenceToConfidenceInput));

    const label = `Phone: ${e164}`;
    await upsertEntity(entityId, label, null, confidenceResult.score, null);
    await upsertIdentifier(entityId, "phone", phone, e164, "phone_search", confidenceResult.score, searchResult["valid"] as boolean ?? false);

    await storeEvidence(entityId, evidence);

    await addTimelineEvent(
      entityId,
      "phone_search",
      `Phone search: ${phone}`,
      `Phone number searched. Carrier: ${searchResult["carrier"] ?? "unknown"}, Country: ${searchResult["country"] ?? "unknown"}`,
      "lyosint_search",
      { phone, e164, carrier: searchResult["carrier"], country: searchResult["country"] },
    );

    return { entityId, isNew, confidenceScore: confidenceResult.score, evidenceCount: evidence.length };
  } catch (err) {
    logger.error(err, "Failed to resolve entity from phone search");
    throw err;
  }
}

export async function resolveEntityFromNameSearch(
  name: string,
  searchResult: Record<string, unknown>,
): Promise<ResolvedEntity> {
  try {
    const normalizedName = name.trim().toLowerCase();
    let entityId = await findExistingEntityByIdentifier("name", normalizedName);
    const isNew = !entityId;
    if (!entityId) entityId = randomUUID();

    const evidence = buildEvidenceFromNameResult(name, searchResult);
    const confidenceResult = computeConfidence(evidence.map(evidenceToConfidenceInput));

    await upsertEntity(entityId, name, null, confidenceResult.score, null);
    await upsertIdentifier(entityId, "name", name, normalizedName, "name_search", confidenceResult.score, false);

    await storeEvidence(entityId, evidence);

    await addTimelineEvent(
      entityId,
      "name_search",
      `Name search: ${name}`,
      `Name search completed. Found ${evidence.length} evidence items.`,
      "lyosint_search",
      { name },
    );

    return { entityId, isNew, confidenceScore: confidenceResult.score, evidenceCount: evidence.length };
  } catch (err) {
    logger.error(err, "Failed to resolve entity from name search");
    throw err;
  }
}

export async function getFullEntity(entityId: string) {
  const [entity] = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.id, entityId))
    .limit(1);

  if (!entity) return null;

  const [identifiers, profiles, evidence, timeline] = await Promise.all([
    db.select().from(identifiersTable).where(eq(identifiersTable.entityId, entityId)),
    db.select().from(profilesTable).where(eq(profilesTable.entityId, entityId)),
    db.select().from(evidenceTable).where(eq(evidenceTable.entityId, entityId)),
    db.select().from(timelineEventsTable).where(eq(timelineEventsTable.entityId, entityId)),
  ]);

  return { entity, identifiers, profiles, evidence, timeline };
}

export async function mergeEntities(
  sourceEntityId: string,
  targetEntityId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(identifiersTable)
      .set({ entityId: targetEntityId })
      .where(eq(identifiersTable.entityId, sourceEntityId));

    await tx
      .update(profilesTable)
      .set({ entityId: targetEntityId })
      .where(eq(profilesTable.entityId, sourceEntityId));

    await tx
      .update(evidenceTable)
      .set({ entityId: targetEntityId })
      .where(eq(evidenceTable.entityId, sourceEntityId));

    await tx
      .update(timelineEventsTable)
      .set({ entityId: targetEntityId })
      .where(eq(timelineEventsTable.entityId, sourceEntityId));

    await tx
      .update(entitiesTable)
      .set({ status: "merged", mergedIntoId: targetEntityId, updatedAt: new Date() })
      .where(eq(entitiesTable.id, sourceEntityId));
  });
}
