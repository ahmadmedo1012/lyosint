import { pgTable, uuid, text, doublePrecision, jsonb, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const memoryEntriesTable = pgTable("memory_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  entryType: text("entry_type").notNull(),
  key: text("key").notNull(),
  value: jsonb("value").notNull().default({}),
  confidence: doublePrecision("confidence").default(0),
  source: text("source"),
  tags: text("tags").array().notNull().default([]),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  keyUnq: uniqueIndex("memory_entries_key_unq").on(table.key),
  entryTypeIdx: index("memory_entries_entry_type_idx").on(table.entryType),
  tagsIdx: index("memory_entries_tags_idx").on(table.tags),
  entryTypeConfidenceIdx: index("memory_entries_type_confidence_idx").on(table.entryType, table.confidence),
}));

export type MemoryEntry = typeof memoryEntriesTable.$inferSelect;
export type InsertMemoryEntry = typeof memoryEntriesTable.$inferInsert;
