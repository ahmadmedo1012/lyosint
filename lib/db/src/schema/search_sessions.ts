import { pgTable, uuid, text, doublePrecision, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const searchSessionsTable = pgTable("search_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  queryType: text("query_type").notNull().default("combined"),
  status: text("status").notNull().default("pending"),
  progress: doublePrecision("progress").default(0),
  identifiersFound: integer("identifiers_found").default(0),
  entitiesResolved: integer("entities_resolved").default(0),
  evidenceCollected: integer("evidence_collected").default(0),
  sourcesSearched: integer("sources_searched").default(0),
  sourcesTotal: integer("sources_total").default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default({}),
}, (table) => ({
  userIdIdx: index("search_sessions_user_id_idx").on(table.userId),
  statusIdx: index("search_sessions_status_idx").on(table.status),
  queryTypeIdx: index("search_sessions_query_type_idx").on(table.queryType),
  userStatusIdx: index("search_sessions_user_status_idx").on(table.userId, table.status),
  startedAtIdx: index("search_sessions_started_at_idx").on(table.startedAt),
}));

export type SearchSession = typeof searchSessionsTable.$inferSelect;
export type InsertSearchSession = typeof searchSessionsTable.$inferInsert;
