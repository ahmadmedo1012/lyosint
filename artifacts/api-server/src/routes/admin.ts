import { Router } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { db, usersTable, searchesTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { toPublicUser } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

// ─── Admin credentials from env ────────────────────────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// In-memory admin session tokens (cleared on server restart intentionally)
const adminSessions = new Map<string, { expiresAt: number }>();

function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a.padEnd(64));
    const bb = Buffer.from(b.padEnd(64));
    return timingSafeEqual(ba, bb) && a.length === b.length;
  } catch {
    return false;
  }
}

// Cleanup expired sessions every hour
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of adminSessions) {
    if (v.expiresAt < now) adminSessions.delete(k);
  }
}, 60 * 60 * 1000);

async function requireAdminToken(req: any, res: any, next: any) {
  const token = req.headers["x-admin-token"] ?? req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "غير مصرح" }); return; }
  const session = adminSessions.get(String(token));
  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ error: "جلسة منتهية" });
    return;
  }
  next();
}

// POST /admin/login — username + password → admin token
router.post("/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "لم يتم تعيين كلمة مرور المسؤول" });
    return;
  }
  const { username, password } = req.body ?? {};
  if (
    !safeCompare(String(username ?? ""), ADMIN_USERNAME) ||
    !safeCompare(String(password ?? ""), ADMIN_PASSWORD)
  ) {
    logger.warn("Failed admin login attempt");
    res.status(401).json({ error: "بيانات الاعتماد غير صحيحة" });
    return;
  }
  const token = randomUUID();
  // 8 hour session
  adminSessions.set(token, { expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  res.json({ token });
});

// POST /admin/logout
router.post("/admin/logout", requireAdminToken, (req, res) => {
  const token = String(req.headers["x-admin-token"] ?? req.headers.authorization?.replace("Bearer ", ""));
  adminSessions.delete(token);
  res.json({ ok: true });
});

// GET /admin/stats
router.get("/admin/stats", requireAdminToken, async (req, res) => {
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
router.get("/admin/users", requireAdminToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
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
router.post("/admin/users/:id/subscribe", requireAdminToken, async (req, res) => {
  try {
    const months = Math.max(1, parseInt(String(req.body?.months ?? "1"), 10));
    const expiry = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
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
router.post("/admin/users/:id/unsubscribe", requireAdminToken, async (req, res) => {
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
router.post("/admin/users/:id/reset-quota", requireAdminToken, async (req, res) => {
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
router.delete("/admin/users/:id", requireAdminToken, async (req, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "admin/delete user error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
