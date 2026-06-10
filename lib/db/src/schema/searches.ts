import { pgTable, text, integer, real, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const searchStatusEnum = pgEnum("search_status", ["pending", "running", "completed", "failed"]);
export const searchTypeEnum = pgEnum("search_type", ["name", "phone", "username", "deep"]);

export const searchesTable = pgTable("searches", {
  id: text("id").primaryKey(),
  status: searchStatusEnum("status").notNull().default("pending"),
  type: searchTypeEnum("type").notNull(),
  query: text("query").notNull(),
  progress: integer("progress").default(0),
  platformsSearched: integer("platforms_searched").default(0),
  platformsTotal: integer("platforms_total").default(0),
  resultsCount: integer("results_count"),
  confidenceScore: real("confidence_score"),
  nameResult: jsonb("name_result"),
  phoneResult: jsonb("phone_result"),
  usernameResult: jsonb("username_result"),
  entityId: text("entity_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertSearchSchema = createInsertSchema(searchesTable).omit({ createdAt: true, completedAt: true });
export type InsertSearch = z.infer<typeof insertSearchSchema>;
export type Search = typeof searchesTable.$inferSelect;
