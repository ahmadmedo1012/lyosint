import { pgTable, uuid, text, doublePrecision, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { entitiesTable } from "./entities";
import { identifiersTable } from "./identifiers";

export const evidenceTable = pgTable("evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  identifierId: uuid("identifier_id").references(() => identifiersTable.id, { onDelete: "set null" }),
  sourceType: text("source_type").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url"),
  evidenceType: text("evidence_type").notNull(),
  rawValue: text("raw_value"),
  normalizedValue: text("normalized_value"),
  confidence: doublePrecision("confidence").default(0),
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  timestamp: timestamp("timestamp", { withTimezone: true }),
  collectorName: text("collector_name"),
  method: text("method"),
  tags: text("tags").array().notNull().default([]),
  checksum: text("checksum").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  entityIdIdx: index("evidence_entity_id_idx").on(table.entityId),
  identifierIdIdx: index("evidence_identifier_id_idx").on(table.identifierId),
  sourceTypeIdx: index("evidence_source_type_idx").on(table.sourceType),
  statusIdx: index("evidence_status_idx").on(table.status),
  typeStatusIdx: index("evidence_type_status_idx").on(table.evidenceType, table.status),
  checksumUnq: uniqueIndex("evidence_checksum_unq").on(table.checksum),
  entitySourceIdx: index("evidence_entity_source_idx").on(table.entityId, table.sourceType),
  tagsIdx: index("evidence_tags_idx").on(table.tags),
}));

export type Evidence = typeof evidenceTable.$inferSelect;
export type InsertEvidence = typeof evidenceTable.$inferInsert;
