import { pgTable, uuid, text, doublePrecision, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { entitiesTable } from "./entities";

export const identifiersTable = pgTable("identifiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  value: text("value").notNull(),
  normalizedValue: text("normalized_value"),
  source: text("source"),
  confidence: doublePrecision("confidence").default(0),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  entityIdIdx: index("identifiers_entity_id_idx").on(table.entityId),
  typeIdx: index("identifiers_type_idx").on(table.type),
  valueIdx: index("identifiers_value_idx").on(table.value),
  normalizedValueIdx: index("identifiers_normalized_value_idx").on(table.normalizedValue),
  entityTypeIdx: index("identifiers_entity_type_idx").on(table.entityId, table.type),
  uniqueEntityValue: uniqueIndex("identifiers_entity_value_unq").on(table.entityId, table.normalizedValue),
}));

export type Identifier = typeof identifiersTable.$inferSelect;
export type InsertIdentifier = typeof identifiersTable.$inferInsert;
