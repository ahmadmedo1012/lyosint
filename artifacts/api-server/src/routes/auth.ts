import { Router } from "express";
import { createHmac, randomUUID } from "crypto";
import { db, usersTable, pendingLoginsTable } from "@workspace/db";
import { and, eq, lt } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const FREE_SEARCH_LIMIT = 3;
const IS_DEV = process.env.NODE_ENV !== "production";

// Cleanup expired login tokens from DB every 5 minutes
setInterval(async () => {
  try {
    await db.delete(pendingLoginsTable).where(lt(pendingLoginsTable.expiresAt, new Date()));
  } catch (err) {
    logger.error(err, "pending logins cleanup error");
  }
}, 5 * 60 * 1000);

function verifyTelegramAuth(data: Record<string, string>): boolean {
  const { hash, ...rest } = data;
  if (!hash) return false;
  const checkString = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hmac = createHmac("sha256", secretKey).update(checkString).digest("hex");
  const authDate = parseInt(rest.auth_date ?? "0", 10);
  if (Math.floor(Date.now() / 1000) - authDate > 86400) return false;
  return hmac === hash;
}

// Telegram widget auth (requires domain registration in BotFather)
router.post("/auth/telegram", async (req, res) => {
  try {
    const { id, first_name, last_name, username, photo_url, hash, auth_date } = req.body;
    if (!id || !first_name || !hash || !auth_date) {
      res.status(400).json({ error: "بيانات غير مكتملة" }); return;
    }
    const dataToVerify: Record<string, string> = { id: String(id), first_name, auth_date: String(auth_date) };
    if (last_name) dataToVerify.last_name = last_name;
    if (username) dataToVerify.username = username;
    if (photo_url) dataToVerify.photo_url = photo_url;
    dataToVerify.hash = hash;
    if (!verifyTelegramAuth(dataToVerify)) {
      res.status(401).json({ error: "توقيع تيليقرام غير صالح" }); return;
    }
    const user = await upsertUser({ telegramId: String(id), firstName: first_name, lastName: last_name, username, photoUrl: photo_url });
    res.json({ sessionToken: user.sessionToken, user: toPublicUser(user) });
  } catch (err) {
    logger.error(err, "auth/telegram error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Bot webhook — receives /start login_<token> messages from users
router.post("/auth/bot-webhook", async (req, res) => {
  try {
    const update = req.body;
    const msg = update?.message;
    if (!msg || !msg.text?.startsWith("/start login_")) { res.json({ ok: true }); return; }
    const loginToken = msg.text.replace("/start login_", "").trim();
    const from = msg.from;
    if (!from || !loginToken) { res.json({ ok: true }); return; }
    await db.insert(pendingLoginsTable).values({
      token: loginToken,
      telegramId: String(from.id),
      firstName: from.first_name ?? "User",
      lastName: from.last_name ?? null,
      username: from.username ?? null,
      photoUrl: null,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    }).onConflictDoUpdate({
      target: pendingLoginsTable.token,
      set: { telegramId: String(from.id), firstName: from.first_name ?? "User", lastName: from.last_name ?? null, username: from.username ?? null, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
    // Tell the user to go back to the website
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: from.id,
        text: `✅ تم التحقق من هويتك!\n\nارجع إلى الموقع وسيتم تسجيل دخولك تلقائياً.\n\n🔐 LYOSINT - منصة الاستخبارات الليبية`,
        parse_mode: "Markdown",
      }),
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error(err, "bot-webhook error");
    res.json({ ok: true });
  }
});

// Poll endpoint — frontend calls this after user clicks the bot link
router.post("/auth/bot-poll", async (req, res) => {
  const { loginToken } = req.body;
  if (!loginToken) { res.status(400).json({ error: "missing token" }); return; }
  const [pending] = await db.select().from(pendingLoginsTable).where(eq(pendingLoginsTable.token, loginToken));
  if (!pending || pending.expiresAt < new Date()) {
    res.json({ ready: false }); return;
  }
  await db.delete(pendingLoginsTable).where(and(eq(pendingLoginsTable.token, loginToken), eq(pendingLoginsTable.telegramId, pending.telegramId)));
  const user = await upsertUser({
    telegramId: pending.telegramId,
    firstName: pending.firstName,
    lastName: pending.lastName ?? undefined,
    username: pending.username ?? undefined,
    photoUrl: pending.photoUrl ?? undefined,
  });
  res.json({ ready: true, sessionToken: user.sessionToken, user: toPublicUser(user) });
});

router.get("/auth/me", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "غير مصرح" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, token));
  if (!user) { res.status(401).json({ error: "جلسة منتهية" }); return; }
  res.json(toPublicUser(user));
});

router.post("/auth/logout", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) await db.update(usersTable).set({ sessionToken: null }).where(eq(usersTable.sessionToken, token));
  res.json({ ok: true });
});

router.get("/auth/search-quota", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "غير مصرح" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, token));
  if (!user) { res.status(401).json({ error: "جلسة منتهية" }); return; }
  const isActive = user.isSubscribed && user.subscriptionExpiry && user.subscriptionExpiry > new Date();
  res.json({ used: user.searchCount, limit: FREE_SEARCH_LIMIT, unlimited: isActive ?? false, canSearch: isActive || user.searchCount < FREE_SEARCH_LIMIT });
});

router.post("/auth/subscribe", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "غير مصرح" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, token));
  if (!user) { res.status(401).json({ error: "جلسة منتهية" }); return; }
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [updated] = await db.update(usersTable).set({ isSubscribed: true, subscribedAt: new Date(), subscriptionExpiry: expiry, updatedAt: new Date() }).where(eq(usersTable.id, user.id)).returning();
  res.json({ ok: true, user: toPublicUser(updated) });
});

async function upsertUser(data: { telegramId: string; firstName: string; lastName?: string; username?: string; photoUrl?: string; }) {
  const sessionToken = randomUUID();
  const existing = await db.select().from(usersTable).where(eq(usersTable.telegramId, data.telegramId));
  if (existing.length > 0) {
    const [updated] = await db.update(usersTable)
      .set({ sessionToken, firstName: data.firstName, lastName: data.lastName ?? null, username: data.username ?? null, photoUrl: data.photoUrl ?? null, updatedAt: new Date() })
      .where(eq(usersTable.telegramId, data.telegramId)).returning();
    return updated;
  }
  const [created] = await db.insert(usersTable).values({
    id: randomUUID(), telegramId: data.telegramId, firstName: data.firstName,
    lastName: data.lastName ?? null, username: data.username ?? null, photoUrl: data.photoUrl ?? null,
    sessionToken, searchCount: 0, isSubscribed: false,
  }).returning();
  return created;
}

export function toPublicUser(user: typeof usersTable.$inferSelect) {
  const isActive = user.isSubscribed && user.subscriptionExpiry && user.subscriptionExpiry > new Date();
  return {
    id: user.id, telegramId: user.telegramId, firstName: user.firstName, lastName: user.lastName,
    username: user.username, photoUrl: user.photoUrl, searchCount: user.searchCount,
    isSubscribed: isActive ?? false, subscriptionExpiry: user.subscriptionExpiry?.toISOString() ?? null,
    canSearch: isActive || user.searchCount < FREE_SEARCH_LIMIT,
    searchesRemaining: isActive ? null : Math.max(0, FREE_SEARCH_LIMIT - user.searchCount),
  };
}

export const FREE_LIMIT = FREE_SEARCH_LIMIT;
export default router;
