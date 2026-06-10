import { db } from "@workspace/db";
import {
  entitiesTable, entityIdentifiersTable, entityProfilesTable, entityEvidenceTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger";

export interface MemoryLookupResult {
  found: boolean;
  entityId: string | null;
  lastSeenAt: Date | null;
  confidenceScore: number;
  profileCount: number;
  evidenceCount: number;
  summary: string | null;
}

export async function lookupMemory(
  type: "username" | "phone" | "email" | "name",
  value: string,
): Promise<MemoryLookupResult> {
  const normalizedValue = value.toLowerCase().trim();

  const rows = await db
    .select({
      entityId: entityIdentifiersTable.entityId,
      createdAt: entityIdentifiersTable.createdAt,
    })
    .from(entityIdentifiersTable)
    .where(
      and(
        eq(entityIdentifiersTable.type, type),
        eq(entityIdentifiersTable.normalizedValue, normalizedValue),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return { found: false, entityId: null, lastSeenAt: null, confidenceScore: 0, profileCount: 0, evidenceCount: 0, summary: null };
  }

  const { entityId } = rows[0]!;

  const [entityRows, profileCountRows, evidenceCountRows] = await Promise.all([
    db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1),
    db.select().from(entityProfilesTable).where(eq(entityProfilesTable.entityId, entityId)),
    db.select().from(entityEvidenceTable).where(eq(entityEvidenceTable.entityId, entityId)),
  ]);

  const entity = entityRows[0];
  if (!entity || entity.status !== "active") {
    return { found: false, entityId: null, lastSeenAt: null, confidenceScore: 0, profileCount: 0, evidenceCount: 0, summary: null };
  }

  logger.info({ entityId, type, value }, "Memory hit — entity already known");

  return {
    found: true,
    entityId,
    lastSeenAt: rows[0]!.createdAt,
    confidenceScore: entity.confidenceScore ?? 0,
    profileCount: profileCountRows.length,
    evidenceCount: evidenceCountRows.length,
    summary: entity.summary,
  };
}

export async function enrichFromMemory(
  entityId: string,
): Promise<{ identifierCount: number; profileCount: number; evidenceCount: number }> {
  const [identifiers, profiles, evidence] = await Promise.all([
    db.select().from(entityIdentifiersTable).where(eq(entityIdentifiersTable.entityId, entityId)),
    db.select().from(entityProfilesTable).where(eq(entityProfilesTable.entityId, entityId)),
    db.select().from(entityEvidenceTable).where(eq(entityEvidenceTable.entityId, entityId)),
  ]);

  return {
    identifierCount: identifiers.length,
    profileCount: profiles.length,
    evidenceCount: evidence.length,
  };
}
