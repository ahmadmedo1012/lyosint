import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: jsonb("details").default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  severity: text("severity").notNull().default("info"),
  sessionId: text("session_id"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  severityIdx: index("audit_logs_severity_idx").on(table.severity),
  resourceTypeIdx: index("audit_logs_resource_type_idx").on(table.resourceType),
  timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp),
  userActionIdx: index("audit_logs_user_action_idx").on(table.userId, table.action),
  sessionIdIdx: index("audit_logs_session_id_idx").on(table.sessionId),
}));

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
