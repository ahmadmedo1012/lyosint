import { pgTable, uuid, text, doublePrecision, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { entitiesTable } from "./entities";

export const relationshipsTable = pgTable("relationships", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceEntityId: uuid("source_entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  targetEntityId: uuid("target_entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type").notNull().default("unknown"),
  strength: doublePrecision("strength").default(0),
  confidence: doublePrecision("confidence").default(0),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  evidenceIds: uuid("evidence_ids").array().notNull().default([]),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sourceEntityIdIdx: index("relationships_source_entity_id_idx").on(table.sourceEntityId),
  targetEntityIdIdx: index("relationships_target_entity_id_idx").on(table.targetEntityId),
  sourceTargetIdx: index("relationships_source_target_idx").on(table.sourceEntityId, table.targetEntityId),
  typeIdx: index("relationships_type_idx").on(table.relationshipType),
  targetTypeIdx: index("relationships_target_type_idx").on(table.targetEntityId, table.relationshipType),
}));

export type Relationship = typeof relationshipsTable.$inferSelect;
export type InsertRelationship = typeof relationshipsTable.$inferInsert;
