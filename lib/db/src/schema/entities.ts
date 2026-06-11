import { pgTable, uuid, text, doublePrecision, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const entitiesTable = pgTable("entities", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull().default("unknown"),
  label: text("label").notNull(),
  normalizedLabel: text("normalized_label"),
  description: text("description"),
  riskScore: doublePrecision("risk_score").notNull().default(0),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  typeIdx: index("entities_type_idx").on(table.type),
  labelIdx: index("entities_label_idx").on(table.label),
  normalizedLabelIdx: index("entities_normalized_label_idx").on(table.normalizedLabel),
  typeRiskIdx: index("entities_type_risk_idx").on(table.type, table.riskScore),
}));

export type Entity = typeof entitiesTable.$inferSelect;
export type InsertEntity = typeof entitiesTable.$inferInsert;
