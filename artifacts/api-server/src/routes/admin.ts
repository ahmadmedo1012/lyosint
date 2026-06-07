import { Router } from "express";
import { randomUUID, timingSafeEqual } from "crypto";
import { db, usersTable, searchesTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { toPublicUser } from "./auth";
import { logger } from "../lib/logger";
import {
  getAllSettingRows,
  setSetting,
  deleteSetting,
  DEFINED_SERVICES,
} from "../services/settingsService";

const router = Router();

// ─── Admin credentials from env ────────────────────────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// In-memory admin session tokens
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

// Cleanup expired sessions hourly
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of adminSessions) {
    if (v.expiresAt < now) adminSessions.delete(k);
  }
}, 60 * 60 * 1000);

async function requireAdminToken(req: any, res: any, next: any) {
  const token =
    req.headers["x-admin-token"] ??
    req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "غير مصرح" }); return; }
  const session = adminSessions.get(String(token));
  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ error: "جلسة منتهية" });
    return;
  }
  next();
}

// ── Auth ───────────────────────────────────────────────────────────────────

router.post("/admin/login", (req, res) => {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "لم يتم تعيين كلمة مرور المسؤول في المتغيرات البيئية" });
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
  adminSessions.set(token, { expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  res.json({ token });
});

router.post("/admin/logout", requireAdminToken, (req, res) => {
  const token = String(
    req.headers["x-admin-token"] ??
    req.headers.authorization?.replace("Bearer ", "")
  );
  adminSessions.delete(token);
  res.json({ ok: true });
});

// ── Stats ──────────────────────────────────────────────────────────────────

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

// ── Users ──────────────────────────────────────────────────────────────────

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

router.post("/admin/users/:id/subscribe", requireAdminToken, async (req, res) => {
  try {
    const months = Math.max(1, parseInt(String(req.body?.months ?? "1"), 10));
    const expiry = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
    const [updated] = await db
      .update(usersTable)
      .set({ isSubscribed: true, subscribedAt: new Date(), subscriptionExpiry: expiry, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
    res.json({ ok: true, user: toPublicUser(updated) });
  } catch (err) {
    logger.error(err, "admin/subscribe error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/admin/users/:id/unsubscribe", requireAdminToken, async (req, res) => {
  try {
    const [updated] = await db
      .update(usersTable)
      .set({ isSubscribed: false, subscriptionExpiry: null, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
    res.json({ ok: true, user: toPublicUser(updated) });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/admin/users/:id/reset-quota", requireAdminToken, async (req, res) => {
  try {
    const [updated] = await db
      .update(usersTable)
      .set({ searchCount: 0, updatedAt: new Date() })
      .where(eq(usersTable.id, req.params.id)).returning();
    if (!updated) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
    res.json({ ok: true, user: toPublicUser(updated) });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/admin/users/:id", requireAdminToken, async (req, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ── Settings / API Keys ────────────────────────────────────────────────────

// GET /admin/settings — return defined services + their configuration status
router.get("/admin/settings", requireAdminToken, async (req, res) => {
  try {
    const rows = await getAllSettingRows();
    const configuredKeys = new Map(rows.map((r) => [r.key, r]));

    const services = DEFINED_SERVICES.map((svc) => ({
      ...svc,
      isConfigured: configuredKeys.has(svc.key) && !!configuredKeys.get(svc.key)?.value,
      // Never return actual key values — only whether they're set
      updatedAt: configuredKeys.get(svc.key)?.updatedAt ?? null,
    }));

    res.json({ services });
  } catch (err) {
    logger.error(err, "admin/settings error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// PUT /admin/settings/:key — set a setting value
router.put("/admin/settings/:key", requireAdminToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body ?? {};

    // Only allow keys that are in DEFINED_SERVICES
    const allowed = DEFINED_SERVICES.some((s) => s.key === key);
    if (!allowed) { res.status(400).json({ error: "مفتاح غير معروف" }); return; }

    if (value === "" || value == null) {
      await deleteSetting(key);
      res.json({ ok: true, configured: false });
    } else {
      await setSetting(key, String(value));
      res.json({ ok: true, configured: true });
    }
  } catch (err) {
    logger.error(err, "admin/settings PUT error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// DELETE /admin/settings/:key
router.delete("/admin/settings/:key", requireAdminToken, async (req, res) => {
  try {
    await deleteSetting(req.params.key);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
