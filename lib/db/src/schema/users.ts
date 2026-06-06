import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  username: text("username"),
  photoUrl: text("photo_url"),
  sessionToken: text("session_token"),
  searchCount: integer("search_count").notNull().default(0),
  isSubscribed: boolean("is_subscribed").notNull().default(false),
  subscribedAt: timestamp("subscribed_at"),
  subscriptionExpiry: timestamp("subscription_expiry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
