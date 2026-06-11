import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID, timingSafeEqual, createHash } from "crypto";
import { db, usersTable, searchesTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { toPublicUser } from "../lib/user-transformer";
import { logger } from "../lib/logger";
import { isMaigretAvailable } from "../services/maigret";
import { existsSync } from "node:fs";
import {
  getAllSettingRows,
  setSetting,
  deleteSetting,
  getSetting,
  DEFINED_SERVICES,
  SYSTEM_CONFIG_DEFS,
} from "../services/settingsService";

const router = Router();

// ─── Admin credentials ──────────────────────────────────────────────────────
// Loaded fresh each time to support runtime credential changes
async function getAdminUsername(): Promise<string> {
  return (await getSetting("sys_admin_username")) ?? process.env.ADMIN_USERNAME ?? "admin";
}
async function getAdminPassword(): Promise<string> {
  return (await getSetting("sys_admin_password")) ?? process.env.ADMIN_PASSWORD ?? "";
}

// ─── Admin sessions (in-memory) ─────────────────────────────────────────────
const adminSessions = new Map<string, { expiresAt: number }>();

function safeCompare(a: string, b: string): boolean {
  try {
    const maxLen = Math.max(a.length, b.length, 32);
    const ba = Buffer.from(a.padEnd(maxLen));
    const bb = Buffer.from(b.padEnd(maxLen));
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of adminSessions) {
    if (v.expiresAt < now) adminSessions.delete(k);
  }
}, 5 * 60 * 1000);

async function requireAdminToken(req: Request, res: Response, next: NextFunction) {
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

// ── Auth ─────────────────────────────────────────────────────────────────────

router.post("/admin/login", async (req, res) => {
  const adminPassword = await getAdminPassword();
  if (!adminPassword) {
    res.status(503).json({ error: "لم يتم تعيين كلمة مرور المسؤول — يرجى تعيينها في لوحة التحكم أو المتغيرات البيئية" });
    return;
  }
  const { username, password } = req.body ?? {};
  const adminUsername = await getAdminUsername();
  if (
    !safeCompare(String(username ?? ""), adminUsername) ||
    !safeCompare(String(password ?? ""), adminPassword)
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
    req.headers.authorization?.replace("Bearer ", ""),
  );
  adminSessions.delete(token);
  res.json({ ok: true });
});

// ── Stats ────────────────────────────────────────────────────────────────────

// Diagnostics — check OSINT tool availability in running container
// Uses only existsSync (no execSync) to avoid blocking the event loop
router.get("/admin/osint-status", requireAdminToken, async (_req, res) => {
  try {
    // Check Python binary existence
    const pythonBinary = existsSync("/usr/local/bin/python3") ? "/usr/local/bin/python3" :
                         existsSync("/usr/bin/python3") ? "/usr/bin/python3" :
                         "python3";

    // Maigret runner script
    const here = process.cwd();
    const runnerCandidates = [
      `${here}/artifacts/api-server/dist/scripts/maigret_runner.py`,
      `${here}/dist/scripts/maigret_runner.py`,
      "/app/artifacts/api-server/dist/scripts/maigret_runner.py",
    ];
    const runnerPath = runnerCandidates.find(existsSync) || null;

    // WMN data
    const wmnCandidates = [
      `${here}/artifacts/api-server/dist/data/wmn-data.json`,
      `${here}/dist/data/wmn-data.json`,
      "/app/artifacts/api-server/dist/data/wmn-data.json",
    ];
    const wmnPath = wmnCandidates.find(existsSync) || null;

    res.json({
      cwd: here,
      node: process.version,
      python: { path: pythonBinary, available: pythonBinary !== "python3" || process.env.PATH?.includes("python3") },
      maigret: { available: !!runnerPath && existsSync(pythonBinary), runnerPath },
      wmn: { available: !!wmnPath, path: wmnPath },
    });
  } catch (err) {
    logger.error(err, "admin/osint-status error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

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

// ── Users ────────────────────────────────────────────────────────────────────

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
      .where(eq(usersTable.id, String(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
    res.json({ ok: true, user: await toPublicUser(updated) });
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
      .where(eq(usersTable.id, String(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
    res.json({ ok: true, user: await toPublicUser(updated) });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/admin/users/:id/reset-quota", requireAdminToken, async (req, res) => {
  try {
    const [updated] = await db
      .update(usersTable)
      .set({ searchCount: 0, updatedAt: new Date() })
      .where(eq(usersTable.id, String(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
    res.json({ ok: true, user: await toPublicUser(updated) });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/admin/users/:id", requireAdminToken, async (req, res) => {
  try {
    await db.delete(usersTable).where(eq(usersTable.id, String(req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ── API Key Settings ──────────────────────────────────────────────────────────

router.get("/admin/settings", requireAdminToken, async (req, res) => {
  try {
    const rows: import("@workspace/db").Setting[] = await getAllSettingRows();
    const configuredKeys = new Map(rows.map((r: import("@workspace/db").Setting) => [r.key, r]));

    const services = DEFINED_SERVICES.map((svc) => ({
      ...svc,
      isConfigured: configuredKeys.has(svc.key) && !!configuredKeys.get(svc.key)?.value,
      updatedAt: configuredKeys.get(svc.key)?.updatedAt ?? null,
    }));

    res.json({ services });
  } catch (err) {
    logger.error(err, "admin/settings error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/admin/settings/:key", requireAdminToken, async (req, res) => {
  try {
    const key = String(req.params.key);
    const { value } = req.body ?? {};

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

router.delete("/admin/settings/:key", requireAdminToken, async (req, res) => {
  try {
    await deleteSetting(String(req.params.key));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ── System Configuration ──────────────────────────────────────────────────────

router.get("/admin/system-config", requireAdminToken, async (req, res) => {
  try {
    const rows: import("@workspace/db").Setting[] = await getAllSettingRows();
    const storedMap = new Map(rows.map((r: import("@workspace/db").Setting) => [r.key, r.value]));

    const config = SYSTEM_CONFIG_DEFS.map((def) => ({
      key: def.key,
      name: def.name,
      description: def.description,
      type: def.type,
      value: storedMap.get(def.key) ?? def.defaultValue,
      defaultValue: def.defaultValue,
      ...(def.min !== undefined ? { min: def.min } : {}),
      ...(def.max !== undefined ? { max: def.max } : {}),
    }));

    res.json({ config });
  } catch (err) {
    logger.error(err, "admin/system-config error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/admin/system-config/:key", requireAdminToken, async (req, res) => {
  try {
    const key = String(req.params.key);
    const { value } = req.body ?? {};

    const def = SYSTEM_CONFIG_DEFS.find((d) => d.key === key);
    if (!def) { res.status(400).json({ error: "مفتاح تكوين غير معروف" }); return; }

    if (value === "" || value == null) {
      await deleteSetting(key);
    } else {
      await setSetting(key, String(value));
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "admin/system-config PUT error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ── Admin Credentials Management ──────────────────────────────────────────────

router.post("/admin/change-credentials", requireAdminToken, async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body ?? {};

    const adminPassword = await getAdminPassword();
    if (!adminPassword || !safeCompare(String(currentPassword ?? ""), adminPassword)) {
      res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
      return;
    }

    if (newUsername && newUsername.trim().length >= 3) {
      await setSetting("sys_admin_username", newUsername.trim());
    }
    if (newPassword && newPassword.length >= 6) {
      await setSetting("sys_admin_password", newPassword);
      // Invalidate all existing admin sessions after password change
      adminSessions.clear();
    }

    res.json({ ok: true, message: "تم تحديث بيانات الاعتماد بنجاح" });
  } catch (err) {
    logger.error(err, "admin/change-credentials error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
