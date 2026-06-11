import { pgTable, uuid, text, doublePrecision, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { entitiesTable } from "./entities";

export const timelineEventsTable = pgTable("timeline_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  source: text("source"),
  evidenceIds: uuid("evidence_ids").array().notNull().default([]),
  confidence: doublePrecision("confidence").default(0),
  location: text("location"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  entityIdIdx: index("timeline_events_entity_id_idx").on(table.entityId),
  eventTypeIdx: index("timeline_events_event_type_idx").on(table.eventType),
  eventDateIdx: index("timeline_events_event_date_idx").on(table.eventDate),
  entityDateIdx: index("timeline_events_entity_date_idx").on(table.entityId, table.eventDate),
}));

export type TimelineEvent = typeof timelineEventsTable.$inferSelect;
export type InsertTimelineEvent = typeof timelineEventsTable.$inferInsert;
