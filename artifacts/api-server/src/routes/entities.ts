import { Router } from "express";
import { db } from "@workspace/db";
import {
  entitiesTable, entityIdentifiersTable, entityProfilesTable,
  entityEvidenceTable, entityTimelineTable, dossiersTable, investigationsTable,
} from "@workspace/db";
import { eq, desc, ilike, or } from "drizzle-orm";
import { getFullEntity, mergeEntities } from "../services/intelligence/entity-resolver";
import { generateDossier } from "../services/intelligence/dossier-engine";
import { logger } from "../lib/logger";

const router = Router();

router.get("/entities", async (req, res) => {
  try {
    const q = req.query["q"] as string | undefined;
    let rows;
    if (q && q.trim()) {
      rows = await db
        .select()
        .from(entitiesTable)
        .where(ilike(entitiesTable.label, `%${q.trim()}%`))
        .orderBy(desc(entitiesTable.updatedAt))
        .limit(50);
    } else {
      rows = await db
        .select()
        .from(entitiesTable)
        .orderBy(desc(entitiesTable.updatedAt))
        .limit(50);
    }
    res.json({ entities: rows, total: rows.length });
  } catch (err) {
    logger.error(err, "GET /entities failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/entities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await getFullEntity(id);
    if (!result) { res.status(404).json({ error: "Entity not found" }); return; }
    res.json(result);
  } catch (err) {
    logger.error(err, "GET /entities/:id failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/entities/:id/dossier", async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await db
      .select()
      .from(dossiersTable)
      .where(eq(dossiersTable.entityId, id))
      .limit(1);

    if (existing.length > 0) {
      res.json(existing[0]);
      return;
    }

    const dossierId = await generateDossier(id);
    const [dossier] = await db.select().from(dossiersTable).where(eq(dossiersTable.id, dossierId)).limit(1);
    res.json(dossier);
  } catch (err) {
    logger.error(err, "GET /entities/:id/dossier failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/entities/:id/dossier/regenerate", async (req, res) => {
  try {
    const { id } = req.params;
    const dossierId = await generateDossier(id);
    const [dossier] = await db.select().from(dossiersTable).where(eq(dossiersTable.id, dossierId)).limit(1);
    res.json(dossier);
  } catch (err) {
    logger.error(err, "POST /entities/:id/dossier/regenerate failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/entities/merge", async (req, res) => {
  try {
    const { sourceId, targetId } = req.body as { sourceId: string; targetId: string };
    if (!sourceId || !targetId) {
      res.status(400).json({ error: "sourceId and targetId required" });
      return;
    }
    if (sourceId === targetId) {
      res.status(400).json({ error: "Cannot merge entity with itself" });
      return;
    }
    await mergeEntities(sourceId, targetId);
    res.json({ success: true, mergedInto: targetId });
  } catch (err) {
    logger.error(err, "POST /entities/merge failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/entities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { label, summary, notes } = req.body as { label?: string; summary?: string; notes?: string };
    await db
      .update(entitiesTable)
      .set({
        ...(label ? { label } : {}),
        ...(summary !== undefined ? { summary } : {}),
        updatedAt: new Date(),
      })
      .where(eq(entitiesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error(err, "PATCH /entities/:id failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/investigations", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(investigationsTable)
      .orderBy(desc(investigationsTable.updatedAt))
      .limit(50);
    res.json({ investigations: rows, total: rows.length });
  } catch (err) {
    logger.error(err, "GET /investigations failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/investigations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [inv] = await db
      .select()
      .from(investigationsTable)
      .where(eq(investigationsTable.id, id))
      .limit(1);
    if (!inv) { res.status(404).json({ error: "Investigation not found" }); return; }

    let entityData = null;
    if (inv.entityId) {
      entityData = await getFullEntity(inv.entityId);
    }

    res.json({ investigation: inv, entity: entityData });
  } catch (err) {
    logger.error(err, "GET /investigations/:id failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
