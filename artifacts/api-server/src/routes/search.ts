import { Router } from "express";
import { randomUUID } from "crypto";
import { db, searchesTable, usersTable, type Search } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  SearchByNameBody,
  SearchByPhoneBody,
  SearchByUsernameBody,
  DeepSearchBody,
  GetSearchResultParams,
  GetSearchStatusParams,
  ListRecentSearchesQueryParams,
} from "@workspace/api-zod";
import { runNameSearch } from "../services/nameSearch";
import { runPhoneSearch } from "../services/phoneSearch";
import { runUsernameSearch } from "../services/usernameSearch";
import { requireAuth, requireQuota } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

router.post("/search/name", requireAuth, requireQuota, async (req, res) => {
  const parsed = SearchByNameBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const user = (req as typeof req & { authUser: typeof usersTable.$inferSelect }).authUser;
  const { name } = parsed.data;
  const id = randomUUID();
  const now = new Date();
  await db.insert(searchesTable).values({ id, type: "name", query: name, status: "pending", progress: 0, platformsTotal: 40, platformsSearched: 0, createdAt: now });
  await db.update(usersTable).set({ searchCount: sql`search_count + 1`, updatedAt: now }).where(eq(usersTable.id, user.id));
  runNameSearch(id, name).catch((err) => { logger.error(err, "name search failed"); });
  res.status(202).json({ id, status: "pending", type: "name", query: name, progress: 0, platformsSearched: 0, platformsTotal: 40, createdAt: now.toISOString(), completedAt: null });
});

router.post("/search/phone", requireAuth, requireQuota, async (req, res) => {
  const parsed = SearchByPhoneBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const user = (req as typeof req & { authUser: typeof usersTable.$inferSelect }).authUser;
  const { phone } = parsed.data;
  const id = randomUUID();
  const now = new Date();
  await db.insert(searchesTable).values({ id, type: "phone", query: phone, status: "pending", progress: 0, platformsTotal: 15, platformsSearched: 0, createdAt: now });
  await db.update(usersTable).set({ searchCount: sql`search_count + 1`, updatedAt: now }).where(eq(usersTable.id, user.id));
  runPhoneSearch(id, phone).catch((err) => { logger.error(err, "phone search failed"); });
  res.status(202).json({ id, status: "pending", type: "phone", query: phone, progress: 0, platformsSearched: 0, platformsTotal: 15, createdAt: now.toISOString(), completedAt: null });
});

router.post("/search/username", requireAuth, requireQuota, async (req, res) => {
  const parsed = SearchByUsernameBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const user = (req as typeof req & { authUser: typeof usersTable.$inferSelect }).authUser;
  const { username } = parsed.data;
  const id = randomUUID();
  const now = new Date();
  await db.insert(searchesTable).values({ id, type: "username", query: username, status: "pending", progress: 0, platformsTotal: 400, platformsSearched: 0, createdAt: now });
  await db.update(usersTable).set({ searchCount: sql`search_count + 1`, updatedAt: now }).where(eq(usersTable.id, user.id));
  runUsernameSearch(id, username).catch((err) => { logger.error(err, "username search failed"); });
  res.status(202).json({ id, status: "pending", type: "username", query: username, progress: 0, platformsSearched: 0, platformsTotal: 400, createdAt: now.toISOString(), completedAt: null });
});

router.post("/search/deep", requireAuth, requireQuota, async (req, res) => {
  const parsed = DeepSearchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }
  const user = (req as typeof req & { authUser: typeof usersTable.$inferSelect }).authUser;
  const { name, phone, username } = parsed.data;
  const query = [name, phone, username].filter(Boolean).join(" | ");
  const id = randomUUID();

  // Deep search spawns sub-searches with unique IDs
  const subIds: string[] = [];
  const tasks: Promise<void>[] = [];
  if (name) { const sid = randomUUID(); subIds.push(sid); tasks.push(runNameSearch(sid, name)); }
  if (phone) { const sid = randomUUID(); subIds.push(sid); tasks.push(runPhoneSearch(sid, phone)); }
  if (username) { const sid = randomUUID(); subIds.push(sid); tasks.push(runUsernameSearch(sid, username)); }

  const platformsTotal = subIds.length > 0 ? subIds.length * 150 : 0;
  const now = new Date();
  await db.insert(searchesTable).values({ id, type: "deep", query: query || "deep search", status: "running", progress: 0, platformsTotal, platformsSearched: 0, createdAt: now });
  await db.update(usersTable).set({ searchCount: sql`search_count + 1`, updatedAt: now }).where(eq(usersTable.id, user.id));

  Promise.allSettled(tasks).then(() => {
    db.update(searchesTable).set({ status: "completed", progress: 100, completedAt: new Date() }).where(eq(searchesTable.id, id)).catch((err) => { logger.error(err, "deep search update failed"); });
  });

  res.status(202).json({ id, status: "running", type: "deep", query: query || "deep search", progress: 0, platformsSearched: 0, platformsTotal, createdAt: now.toISOString(), completedAt: null });
});

router.get("/search/:id", async (req, res) => {
  const parsed = GetSearchResultParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid params" }); return; }
  const [row] = await db.select().from(searchesTable).where(eq(searchesTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toSearchResult(row));
});

router.get("/search/:id/status", async (req, res) => {
  const parsed = GetSearchStatusParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid params" }); return; }
  const [row] = await db.select().from(searchesTable).where(eq(searchesTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toSearchTask(row));
});

router.get("/searches/recent", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.json([]); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, token));
  if (!user) { res.json([]); return; }
  const parsed = ListRecentSearchesQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const rows = await db.select().from(searchesTable).orderBy(desc(searchesTable.createdAt)).limit(limit);
  res.json(rows.map((r: Search) => ({
    id: r.id, type: r.type, query: r.query, status: r.status,
    createdAt: r.createdAt.toISOString(), resultsCount: r.resultsCount ?? null, confidenceScore: r.confidenceScore ?? null,
  })));
});

function toSearchTask(row: typeof searchesTable.$inferSelect) {
  return { id: row.id, status: row.status, type: row.type, query: row.query, progress: row.progress ?? null, platformsSearched: row.platformsSearched ?? null, platformsTotal: row.platformsTotal ?? null, createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null };
}

function toSearchResult(row: typeof searchesTable.$inferSelect) {
  return { id: row.id, type: row.type, query: row.query, status: row.status, createdAt: row.createdAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null, nameResult: row.nameResult ?? null, phoneResult: row.phoneResult ?? null, usernameResult: row.usernameResult ?? null, confidenceScore: row.confidenceScore ?? null };
}

export default router;
