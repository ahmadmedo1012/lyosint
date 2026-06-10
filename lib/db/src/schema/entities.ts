import {
  pgTable, text, integer, real, timestamp, jsonb, pgEnum, boolean
} from "drizzle-orm/pg-core";

export const entityStatusEnum = pgEnum("entity_status", ["active", "merged", "archived"]);
export const identifierTypeEnum = pgEnum("identifier_type", ["phone", "email", "username", "name", "domain", "ip"]);
export const relationshipTypeEnum = pgEnum("relationship_type", [
  "owns", "uses", "works_at", "related_to", "registered_with", "same_person_as"
]);
export const evidencePolarityEnum = pgEnum("evidence_polarity", ["supporting", "conflicting", "caution"]);
export const nodeTypeEnum = pgEnum("node_type", [
  "person", "phone", "email", "username", "profile", "company", "website", "domain", "location"
]);

export const entitiesTable = pgTable("entities", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  status: entityStatusEnum("status").notNull().default("active"),
  mergedIntoId: text("merged_into_id"),
  confidenceScore: real("confidence_score").default(0),
  riskScore: real("risk_score").default(0),
  summary: text("summary"),
  avatarUrl: text("avatar_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const entityIdentifiersTable = pgTable("entity_identifiers", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  type: identifierTypeEnum("type").notNull(),
  value: text("value").notNull(),
  normalizedValue: text("normalized_value").notNull(),
  confidenceScore: real("confidence_score").default(0),
  verified: boolean("verified").default(false),
  source: text("source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const entityProfilesTable = pgTable("entity_profiles", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  url: text("url"),
  username: text("username"),
  displayName: text("display_name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  verified: boolean("verified").default(false),
  confidenceScore: real("confidence_score").default(0),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const entityEvidenceTable = pgTable("entity_evidence", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  source: text("source").notNull(),
  platform: text("platform"),
  rawValue: text("raw_value"),
  normalizedValue: text("normalized_value"),
  confidenceScore: real("confidence_score").default(0),
  polarity: evidencePolarityEnum("polarity").notNull().default("supporting"),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const entityRelationshipsTable = pgTable("entity_relationships", {
  id: text("id").primaryKey(),
  sourceEntityId: text("source_entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  targetEntityId: text("target_entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  type: relationshipTypeEnum("type").notNull(),
  confidenceScore: real("confidence_score").default(0),
  evidence: text("evidence"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const entityTimelineTable = pgTable("entity_timeline", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  source: text("source"),
  platform: text("platform"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  occurredAt: timestamp("occurred_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dossiersTable = pgTable("dossiers", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  summary: text("summary"),
  threatLevel: text("threat_level"),
  confidenceScore: real("confidence_score").default(0),
  sections: jsonb("sections").$type<DossierSection[]>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const investigationsTable = pgTable("investigations", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  entityId: text("entity_id").references(() => entitiesTable.id),
  searchIds: jsonb("search_ids").$type<string[]>().default([]),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const graphNodesTable = pgTable("graph_nodes", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").references(() => entitiesTable.id, { onDelete: "cascade" }),
  type: nodeTypeEnum("type").notNull(),
  label: text("label").notNull(),
  value: text("value"),
  properties: jsonb("properties").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const graphEdgesTable = pgTable("graph_edges", {
  id: text("id").primaryKey(),
  sourceNodeId: text("source_node_id").notNull().references(() => graphNodesTable.id, { onDelete: "cascade" }),
  targetNodeId: text("target_node_id").notNull().references(() => graphNodesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  weight: real("weight").default(1.0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Entity = typeof entitiesTable.$inferSelect;
export type InsertEntity = typeof entitiesTable.$inferInsert;
export type EntityIdentifier = typeof entityIdentifiersTable.$inferSelect;
export type EntityProfile = typeof entityProfilesTable.$inferSelect;
export type EntityEvidence = typeof entityEvidenceTable.$inferSelect;
export type EntityRelationship = typeof entityRelationshipsTable.$inferSelect;
export type EntityTimeline = typeof entityTimelineTable.$inferSelect;
export type Dossier = typeof dossiersTable.$inferSelect;
export type Investigation = typeof investigationsTable.$inferSelect;

export interface DossierSection {
  title: string;
  content: string;
  type: "summary" | "identifiers" | "profiles" | "relationships" | "timeline" | "risk";
}
