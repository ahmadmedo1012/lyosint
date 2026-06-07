import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pendingLoginsTable = pgTable("pending_logins", {
  token: text("token").primaryKey(),
  telegramId: text("telegram_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  username: text("username"),
  photoUrl: text("photo_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PendingLogin = typeof pendingLoginsTable.$inferSelect;
export type InsertPendingLogin = typeof pendingLoginsTable.$inferInsert;
