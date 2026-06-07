import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  category: text("category").notNull().default("api"),
  description: text("description"),
  isSecret: boolean("is_secret").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Setting = typeof settingsTable.$inferSelect;
