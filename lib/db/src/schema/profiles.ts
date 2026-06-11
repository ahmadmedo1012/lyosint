import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { entitiesTable } from "./entities";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  profileUrl: text("profile_url"),
  displayName: text("display_name"),
  username: text("username"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  location: text("location"),
  website: text("website"),
  followerCount: integer("follower_count").default(0),
  followingCount: integer("following_count").default(0),
  verified: boolean("verified").notNull().default(false),
  rawData: jsonb("raw_data").default({}),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  entityIdIdx: index("profiles_entity_id_idx").on(table.entityId),
  platformIdx: index("profiles_platform_idx").on(table.platform),
  usernameIdx: index("profiles_username_idx").on(table.username),
  entityPlatformIdx: index("profiles_entity_platform_idx").on(table.entityId, table.platform),
  platformUsernameIdx: index("profiles_platform_username_idx").on(table.platform, table.username),
}));

export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = typeof profilesTable.$inferInsert;
