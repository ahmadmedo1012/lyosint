import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { entitiesTable } from "./entities";
import { investigationsTable } from "./investigations";
import { usersTable } from "./users";

export const dossiersTable = pgTable("dossiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  investigationId: uuid("investigation_id").references(() => investigationsTable.id, { onDelete: "set null" }),
  entityId: uuid("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary"),
  sections: jsonb("sections").default({}),
  sourcesSummary: jsonb("sources_summary").default({}),
  confidenceSummary: jsonb("confidence_summary").default({}),
  timelineSummary: jsonb("timeline_summary").default({}),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  investigationIdIdx: index("dossiers_investigation_id_idx").on(table.investigationId),
  entityIdIdx: index("dossiers_entity_id_idx").on(table.entityId),
  statusIdx: index("dossiers_status_idx").on(table.status),
  createdByIdx: index("dossiers_created_by_idx").on(table.createdBy),
  investigationEntityIdx: index("dossiers_investigation_entity_idx").on(table.investigationId, table.entityId),
}));

export type Dossier = typeof dossiersTable.$inferSelect;
export type InsertDossier = typeof dossiersTable.$inferInsert;
