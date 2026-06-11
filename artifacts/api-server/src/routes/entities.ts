import { Router } from "express";
import { db } from "@workspace/db";
import {
  entitiesTable, identifiersTable, profilesTable,
  evidenceTable, timelineEventsTable, dossiersTable, investigationsTable,
  relationshipsTable,
} from "@workspace/db";
import { eq, desc, ilike } from "drizzle-orm";
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

router.get("/entities/graph/data", async (req, res) => {
  try {
    const allEntities = await db
      .select()
      .from(entitiesTable)
      .orderBy(desc(entitiesTable.updatedAt))
      .limit(200);

    const identifiers = await db
      .select()
      .from(identifiersTable)
      .limit(500);

    const relationships = await db
      .select()
      .from(relationshipsTable)
      .limit(500);

    const nodes = allEntities.map(e => ({
      id: e.id,
      label: e.label,
      type: e.type,
      riskScore: e.riskScore ?? 0,
      identifiers: identifiers
        .filter(i => i.entityId === e.id)
        .map(i => ({ type: i.type, value: i.value })),
    }));

    const edges = relationships.map(r => ({
      id: r.id,
      source: r.sourceEntityId,
      target: r.targetEntityId,
      type: r.relationshipType,
      confidence: r.confidence ?? 50,
      label: (r.evidenceIds ?? []).join(", "),
    }));

    // Add implicit edges between entities that share the same identifier value
    const valueMap = new Map<string, string[]>();
    for (const ident of identifiers) {
      if (!ident.value) continue;
      const key = `${ident.type}:${ident.value}`;
      if (!valueMap.has(key)) valueMap.set(key, []);
      valueMap.get(key)!.push(ident.entityId!);
    }
    const implicitEdges: {
      id: string; source: string; target: string;
      type: string; confidence: number; label: string | null;
    }[] = [];
    for (const [, eids] of valueMap) {
      if (eids.length < 2) continue;
      for (let i = 0; i < eids.length - 1; i++) {
        for (let j = i + 1; j < eids.length; j++) {
          if (eids[i] !== eids[j]) {
            implicitEdges.push({
              id: `implicit-${eids[i]}-${eids[j]}`,
              source: eids[i],
              target: eids[j],
              type: "same_identifier",
              confidence: 80,
              label: null,
            });
          }
        }
      }
    }

    res.json({ nodes, edges: [...edges, ...implicitEdges] });
  } catch (err) {
    logger.error(err, "GET /entities/graph/data failed");
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
    const { label } = req.body as { label?: string };
    await db
      .update(entitiesTable)
      .set({
        ...(label ? { label } : {}),
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
    if (inv.targetEntityIds && inv.targetEntityIds.length > 0) {
      entityData = await getFullEntity(inv.targetEntityIds[0]);
    }

    res.json({ investigation: inv, entity: entityData });
  } catch (err) {
    logger.error(err, "GET /investigations/:id failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
