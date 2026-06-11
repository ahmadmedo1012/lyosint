import { pgTable, uuid, text, timestamp, uniqueIndex, vector } from "drizzle-orm/pg-core";
import { entitiesTable } from "./entities";

export const entityEmbeddingsTable = pgTable("entity_embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").notNull().references(() => entitiesTable.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 384 }),
  modelName: text("model_name").notNull().default("all-MiniLM-L6-v2"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  entityIdUnq: uniqueIndex("entity_embeddings_entity_id_unq").on(table.entityId),
}));

export type EntityEmbedding = typeof entityEmbeddingsTable.$inferSelect;
export type InsertEntityEmbedding = typeof entityEmbeddingsTable.$inferInsert;
