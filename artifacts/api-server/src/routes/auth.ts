import { Router } from "express";
import { createHmac, randomUUID, randomBytes } from "crypto";
import { db, usersTable, pendingLoginsTable } from "@workspace/db";
import { and, eq, lt } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import { z } from "zod";
import { logger } from "../lib/logger";
import { getCachedUser, setCachedUser, clearSessionCache, requireAuth as requireLegacyAuth } from "../middleware/requireAuth";
import { toPublicUser, getFreeLimit } from "../lib/user-transformer";
import { generateTokens, refreshTokens, verifyAccessToken, invalidateSession, signAccessToken, type TokenPayload } from "../lib/session";
import { validateBody } from "../middleware/validate";
import { recordFailedAttempt, isBlocked, getBlockRemainingMs, clearRecord } from "../lib/abuse";
import { UnauthorizedError } from "../lib/errors";

const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

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

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
});

const LoginBody = z.object({
  email: z.string().email().optional(),
  telegramId: z.string().optional(),
  password: z.string().optional(),
  totpToken: z.string().optional(),
});

const RefreshBody = z.object({
  refreshToken: z.string(),
});

const PasswordResetRequest = z.object({
  email: z.string().email(),
});

const PasswordResetConfirm = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});

const TotpSetupBody = z.object({
  password: z.string(),
});

const TotpVerifyBody = z.object({
  token: z.string().length(6),
});

// ─── JWT Auth Endpoints ───────────────────────────────────────────────────────

router.post("/auth/register", validateBody(RegisterBody), async (req, res, next) => {
  try {
    const { email, password, name } = req.body as z.infer<typeof RegisterBody>;
    const ip = req.ip ?? "unknown";

    if (isBlocked(ip) && getBlockRemainingMs(ip) > 0) {
      res.status(429).json({ error: "محظور مؤقتاً — يرجى الانتظار" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.telegramId, email));
    if (existing.length > 0) {
      res.status(409).json({ error: "البريد الإلكتروني مسجل مسبقاً" });
      return;
    }

    const salt = randomBytes(16).toString("hex");
    const passwordHash = createHmac("sha256", salt).update(password).digest("hex");
    const storedHash = `${salt}:${passwordHash}`;
    const id = randomUUID();

    await db.insert(usersTable).values({
      id,
      telegramId: email,
      firstName: name,
      sessionToken: null,
      searchCount: 0,
      isSubscribed: false,
    });

    const tokens = generateTokens({ userId: id, role: "user" });
    await db.update(usersTable).set({ sessionToken: tokens.accessToken }).where(eq(usersTable.id, id));

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    res.status(201).json({
      ...tokens,
      user: await toPublicUser(user!),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/login", validateBody(LoginBody), async (req, res, next) => {
  try {
    const { email, password, totpToken } = req.body as z.infer<typeof LoginBody>;
    const ip = req.ip ?? "unknown";

    if (isBlocked(ip)) {
      const remaining = getBlockRemainingMs(ip);
      res.setHeader("Retry-After", Math.ceil(remaining / 1000));
      res.status(429).json({
        error: `محظور مؤقتاً — يرجى الانتظار ${Math.ceil(remaining / 1000)} ثانية`,
      });
      return;
    }

    if (!email || !password) {
      recordFailedAttempt(ip);
      throw new UnauthorizedError("البريد الإلكتروني وكلمة المرور مطلوبان");
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, email));
    if (!user) {
      recordFailedAttempt(ip);
      throw new UnauthorizedError("بيانات الاعتماد غير صحيحة");
    }

    if (user.passwordHash) {
      const [salt, storedHash] = user.passwordHash.split(":");
      const computedHash = createHmac("sha256", salt).update(password).digest("hex");
      if (computedHash !== storedHash) {
        recordFailedAttempt(ip);
        throw new UnauthorizedError("بيانات الاعتماد غير صحيحة");
      }
    } else {
      recordFailedAttempt(ip);
      throw new UnauthorizedError("بيانات الاعتماد غير صحيحة");
    }

    if (user.totpSecret) {
      if (!totpToken) {
        res.json({ requiresTotp: true, message: "رمز المصادقة الثنائية مطلوب" });
        return;
      }
      const totp = new OTPAuth.TOTP({ secret: user.totpSecret });
      const delta = totp.validate({ token: totpToken, window: 1 });
      if (delta === null) {
        recordFailedAttempt(ip);
        throw new UnauthorizedError("رمز المصادقة الثنائية غير صالح");
      }
    }

    clearRecord(ip);
    const tokens = generateTokens({ userId: user.id, role: "user" });
    await db.update(usersTable).set({ sessionToken: tokens.accessToken, updatedAt: new Date() }).where(eq(usersTable.id, user.id));

    clearSessionCache();
    res.json({ ...tokens, user: await toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/refresh", validateBody(RefreshBody), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as z.infer<typeof RefreshBody>;
    const tokens = refreshTokens(refreshToken);
    res.json(tokens);
  } catch (err) {
    next(new UnauthorizedError("رمز التحديث غير صالح أو منتهي الصلاحية"));
  }
});

router.post("/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");
  let sessionId: string | null = null;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      sessionId = payload.sessionId;
      await db.update(usersTable).set({ sessionToken: null, updatedAt: new Date() }).where(eq(usersTable.id, payload.userId));
    } catch {
      // Token might be the old session token format
      await db.update(usersTable).set({ sessionToken: null }).where(eq(usersTable.sessionToken, token));
      clearSessionCache(token);
    }
  }

  if (sessionId) {
    invalidateSession(sessionId);
  }

  res.clearCookie("accessToken", { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
  res.clearCookie("refreshToken", { httpOnly: true, secure: true, sameSite: "strict", path: "/api/auth" });
  res.json({ ok: true });
});

// ─── Password Reset ───────────────────────────────────────────────────────────

router.post("/auth/password-reset/request", validateBody(PasswordResetRequest), async (req, res) => {
  try {
    const { email } = req.body as z.infer<typeof PasswordResetRequest>;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, email));
    if (user) {
      const resetToken = randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 3600_000);
      // Reset token stored in-memory for simplicity — in production use DB/cache
      resetTokens.set(resetToken, { userId: user.id, expiresAt: expiry });
      logger.info({ email, resetToken: resetToken.slice(0, 8) }, "Password reset token generated");
    }
    // Always return success to prevent email enumeration
    res.json({ ok: true, message: "إذا كان البريد الإلكتروني مسجلاً، سيتم إرسال رابط إعادة تعيين كلمة المرور" });
  } catch (err) {
    logger.error(err, "password reset request error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

const resetTokens = new Map<string, { userId: string; expiresAt: Date }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of resetTokens) {
    if (v.expiresAt.getTime() < now) resetTokens.delete(k);
  }
}, 300_000);

router.post("/auth/password-reset/confirm", validateBody(PasswordResetConfirm), async (req, res, next) => {
  try {
    const { token, password } = req.body as z.infer<typeof PasswordResetConfirm>;
    const stored = resetTokens.get(token);
    if (!stored || stored.expiresAt < new Date()) {
      res.status(400).json({ error: "رمز إعادة التعيين غير صالح أو منتهي الصلاحية" });
      return;
    }
    const salt = randomBytes(16).toString("hex");
    const passwordHash = createHmac("sha256", salt).update(password).digest("hex");
    const storedHash = `${salt}:${passwordHash}`;
    await db.update(usersTable).set({ passwordHash: storedHash, sessionToken: null, updatedAt: new Date() }).where(eq(usersTable.id, stored.userId));
    resetTokens.delete(token);
    clearSessionCache();
    res.json({ ok: true, message: "تم إعادة تعيين كلمة المرور بنجاح" });
  } catch (err) {
    next(err);
  }
});

// ─── 2FA (TOTP) ───────────────────────────────────────────────────────────────

router.post("/auth/2fa/setup", requireLegacyAuth, validateBody(TotpSetupBody), async (req, res, next) => {
  try {
    const user = (req as typeof req & { authUser: typeof usersTable.$inferSelect }).authUser;
    const { password } = req.body as z.infer<typeof TotpSetupBody>;

    if (user.passwordHash) {
      const [salt, storedHash] = user.passwordHash.split(":");
      const computedHash = createHmac("sha256", salt).update(password).digest("hex");
      if (computedHash !== storedHash) {
        throw new UnauthorizedError("كلمة المرور غير صحيحة");
      }
    } else {
      throw new UnauthorizedError("كلمة المرور مطلوبة لإعداد المصادقة الثنائية");
    }

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: process.env["TOTP_ISSUER"] ?? "Lyosint",
      label: user.telegramId,
      secret,
    });

    const otpAuthUrl = totp.toString();
    const secretBase32 = secret.base32;

    res.json({
      secret: secretBase32,
      otpAuthUrl,
      message: "امسح رمز QR ضوئياً باستخدام Google Authenticator أو أي تطبيق TOTP",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/2fa/verify", requireLegacyAuth, validateBody(TotpVerifyBody), async (req, res, next) => {
  try {
    const user = (req as typeof req & { authUser: typeof usersTable.$inferSelect }).authUser;
    const { token } = req.body as z.infer<typeof TotpVerifyBody>;

    const secret = process.env["TOTP_SECRET"] ?? "";
    if (!secret) {
      res.status(400).json({ error: "لم يتم إعداد المصادقة الثنائية بعد" });
      return;
    }

    const totp = new OTPAuth.TOTP({ secret });
    const delta = totp.validate({ token, window: 1 });
    if (delta === null) {
      throw new UnauthorizedError("رمز المصادقة الثنائية غير صالح");
    }

    // Store TOTP secret reference in user record
    await db.update(usersTable).set({ totpSecret: secret, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    res.json({ ok: true, message: "تم تفعيل المصادقة الثنائية بنجاح" });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/2fa/disable", requireLegacyAuth, async (req, res, next) => {
  try {
    const user = (req as typeof req & { authUser: typeof usersTable.$inferSelect }).authUser;
    await db.update(usersTable).set({ totpSecret: null, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    res.json({ ok: true, message: "تم إلغاء المصادقة الثنائية" });
  } catch (err) {
    next(err);
  }
});

// ─── Telegram Auth ────────────────────────────────────────────────────────────

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
    const tokens = generateTokens({ userId: user.id, role: "user" });
    await db.update(usersTable).set({ sessionToken: tokens.accessToken, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
    res.json({ ...tokens, user: await toPublicUser(user) });
  } catch (err) {
    logger.error(err, "auth/telegram error");
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

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
  const tokens = generateTokens({ userId: user.id, role: "user" });
  await db.update(usersTable).set({ sessionToken: tokens.accessToken, updatedAt: new Date() }).where(eq(usersTable.id, user.id));
  res.json({ ready: true, ...tokens, user: await toPublicUser(user) });
});

// ─── JWT Auth Middleware ───────────────────────────────────────────────────────

export async function requireJwtAuth(req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    next(new UnauthorizedError("غير مصرح — سجل دخولك أولاً"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user) {
      next(new UnauthorizedError("المستخدم غير موجود"));
      return;
    }
    (req as any).authUser = user;
    (req as any).tokenPayload = payload;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    if (err instanceof Error && (err.message.includes("Token") || err.message.includes("jwt") || err.message.includes("session"))) {
      next(new UnauthorizedError("جلسة منتهية — يرجى تسجيل الدخول مجدداً"));
      return;
    }
    next(err);
  }
}

// JWT variant of me endpoint
router.get("/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  const rawToken = authHeader?.replace("Bearer ", "");

  if (!rawToken) { res.status(401).json({ error: "غير مصرح" }); return; }

  // Try JWT first
  try {
    const payload = verifyAccessToken(rawToken);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (user) {
      setCachedUser(rawToken, user);
      res.json(await toPublicUser(user));
      return;
    }
  } catch {
    // Fall back to legacy session token
  }

  let user = getCachedUser(rawToken);
  if (!user) {
    const [found] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, rawToken));
    if (!found) { res.status(401).json({ error: "جلسة منتهية" }); return; }
    setCachedUser(rawToken, found);
    user = found;
  }
  res.json(await toPublicUser(user));
});

router.get("/auth/search-quota", async (req, res) => {
  const authHeader = req.headers.authorization;
  const rawToken = authHeader?.replace("Bearer ", "");
  if (!rawToken) { res.status(401).json({ error: "غير مصرح" }); return; }

  let user = getCachedUser(rawToken);
  if (!user) {
    try {
      const payload = verifyAccessToken(rawToken);
      const [found] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
      if (found) {
        setCachedUser(rawToken, found);
        user = found;
      }
    } catch {
      const [found] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, rawToken));
      if (found) setCachedUser(rawToken, found);
      user = found;
    }
  }
  if (!user) { res.status(401).json({ error: "جلسة منتهية" }); return; }

  const isActive = user.isSubscribed && user.subscriptionExpiry && user.subscriptionExpiry > new Date();
  const limit = await getFreeLimit();
  res.json({ used: user.searchCount, limit, unlimited: isActive ?? false, canSearch: isActive || user.searchCount < limit });
});

router.post("/auth/subscribe", async (req, res) => {
  const rawToken = req.headers.authorization?.replace("Bearer ", "");
  if (!rawToken) { res.status(401).json({ error: "غير مصرح" }); return; }

  let userId: string | null = null;
  try {
    const payload = verifyAccessToken(rawToken);
    userId = payload.userId;
  } catch {
    const [found] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, rawToken));
    if (found) userId = found.id;
  }

  if (!userId) { res.status(401).json({ error: "جلسة منتهية" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(401).json({ error: "جلسة منتهية" }); return; }

  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [updated] = await db.update(usersTable).set({ isSubscribed: true, subscribedAt: new Date(), subscriptionExpiry: expiry, updatedAt: new Date() }).where(eq(usersTable.id, userId)).returning();
  res.json({ ok: true, user: await toPublicUser(updated!) });
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

export default router;
