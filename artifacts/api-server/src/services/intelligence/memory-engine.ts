import { db } from "@workspace/db";
import {
  entitiesTable, identifiersTable, profilesTable, evidenceTable,
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
      entityId: identifiersTable.entityId,
      createdAt: identifiersTable.createdAt,
    })
    .from(identifiersTable)
    .where(
      and(
        eq(identifiersTable.type, type),
        eq(identifiersTable.normalizedValue, normalizedValue),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return { found: false, entityId: null, lastSeenAt: null, confidenceScore: 0, profileCount: 0, evidenceCount: 0, summary: null };
  }

  const { entityId } = rows[0]!;

  const [entityRows, profileCountRows, evidenceCountRows] = await Promise.all([
    db.select().from(entitiesTable).where(eq(entitiesTable.id, entityId)).limit(1),
    db.select().from(profilesTable).where(eq(profilesTable.entityId, entityId)),
    db.select().from(evidenceTable).where(eq(evidenceTable.entityId, entityId)),
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
    db.select().from(identifiersTable).where(eq(identifiersTable.entityId, entityId)),
    db.select().from(profilesTable).where(eq(profilesTable.entityId, entityId)),
    db.select().from(evidenceTable).where(eq(evidenceTable.entityId, entityId)),
  ]);

  return {
    identifierCount: identifiers.length,
    profileCount: profiles.length,
    evidenceCount: evidence.length,
  };
}
