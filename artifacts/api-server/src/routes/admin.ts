import { Router } from "express";
import { db, usersTable, searchesTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { toPublicUser } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function isAdmin(telegramId: string): boolean {
  if (ADMIN_IDS.length === 0) return true; // open if no admins configured
  return ADMIN_IDS.includes(telegramId);
}

async function requireAdminMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "غير مصرح" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, token));
  if (!user) { res.status(401).json({ error: "جلسة منتهية" }); return; }
  if (!isAdmin(user.telegramId)) { res.status(403).json({ error: "ليس لديك صلاحية الوصول" }); return; }
  req.adminUser = user;
  next();
}

// GET /admin/stats
router.get("/admin/stats", requireAdminMiddleware, async (req, res) => {
  try {
    const [{ total: totalUsers }] = await db.select({ total: count() }).from(usersTable);
    const [{ total: totalSearches }] = await db.select({ total: count() }).from(searchesTable);
    const [{ total: subscribedUsers }] = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.isSubscribed, true));
    const recentUsers = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(5);
    res.json({ totalUsers, totalSearches, subscribedUsers, recentUsers: recentUsers.map(toPublicUser) });
  } catch (err) {
    logger.error(err, "admin/stats error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// GET /admin/users
router.get("/admin/users", requireAdminMiddleware, async (req, res) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"), 10);
    const limit = 20;
    const offset = (page - 1) * limit;
    const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
    const [{ total }] = await db.select({ total: count() }).from(usersTable);
    res.json({ users: users.map(toPublicUser), total, page, pages: Math.ceil(Number(total) / limit) });
  } catch (err) {
    logger.error(err, "admin/users error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// POST /admin/users/:id/subscribe
router.post("/admin/users/:id/subscribe", requireAdminMiddleware, async (req, res) => {
  try {
    const { months = 1 } = req.body;
    const expiry = new Date(Date.now() + Number(months) * 30 * 24 * 60 * 60 * 1000);
    const [updated] = await db.update(usersTable)
      .set({ isSubscribed: true, subscribedAt: new Date(), subscriptionExpiry: expiry, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
    res.json({ ok: true, user: toPublicUser(updated) });
  } catch (err) {
    logger.error(err, "admin/subscribe error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// POST /admin/users/:id/unsubscribe
router.post("/admin/users/:id/unsubscribe", requireAdminMiddleware, async (req, res) => {
  try {
    const [updated] = await db.update(usersTable)
      .set({ isSubscribed: false, subscriptionExpiry: null, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
    res.json({ ok: true, user: toPublicUser(updated) });
  } catch (err) {
    logger.error(err, "admin/unsubscribe error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// POST /admin/users/:id/reset-quota
router.post("/admin/users/:id/reset-quota", requireAdminMiddleware, async (req, res) => {
  try {
    const [updated] = await db.update(usersTable)
      .set({ searchCount: 0, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
    res.json({ ok: true, user: toPublicUser(updated) });
  } catch (err) {
    logger.error(err, "admin/reset-quota error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// DELETE /admin/users/:id
router.delete("/admin/users/:id", requireAdminMiddleware, async (req, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "admin/delete user error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
