import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { searchSessionsTable } from "./search_sessions";

export const sourceResultsTable = pgTable("source_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  searchSessionId: uuid("search_session_id").notNull().references(() => searchSessionsTable.id, { onDelete: "cascade" }),
  sourceName: text("source_name").notNull(),
  sourceType: text("source_type").notNull(),
  query: text("query").notNull(),
  rawResponse: jsonb("raw_response").default({}),
  normalizedData: jsonb("normalized_data").default({}),
  status: text("status").notNull().default("success"),
  responseTimeMs: integer("response_time_ms"),
  httpStatus: integer("http_status"),
  errorMessage: text("error_message"),
  evidenceIds: uuid("evidence_ids").array().notNull().default([]),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  searchSessionIdIdx: index("source_results_search_session_id_idx").on(table.searchSessionId),
  sourceNameIdx: index("source_results_source_name_idx").on(table.sourceName),
  statusIdx: index("source_results_status_idx").on(table.status),
  sessionSourceIdx: index("source_results_session_source_idx").on(table.searchSessionId, table.sourceName),
  collectedAtIdx: index("source_results_collected_at_idx").on(table.collectedAt),
}));

export type SourceResult = typeof sourceResultsTable.$inferSelect;
export type InsertSourceResult = typeof sourceResultsTable.$inferInsert;
