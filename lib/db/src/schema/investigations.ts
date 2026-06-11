import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const investigationsTable = pgTable("investigations", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  ownerId: text("owner_id").references(() => usersTable.id, { onDelete: "set null" }),
  targetEntityIds: uuid("target_entity_ids").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  priority: text("priority").notNull().default("medium"),
  findingsSummary: text("findings_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (table) => ({
  statusIdx: index("investigations_status_idx").on(table.status),
  ownerIdIdx: index("investigations_owner_id_idx").on(table.ownerId),
  priorityIdx: index("investigations_priority_idx").on(table.priority),
  statusPriorityIdx: index("investigations_status_priority_idx").on(table.status, table.priority),
  tagsIdx: index("investigations_tags_idx").on(table.tags),
}));

export type Investigation = typeof investigationsTable.$inferSelect;
export type InsertInvestigation = typeof investigationsTable.$inferInsert;
