import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { toPublicUser } from "../routes/auth";
import { getSystemConfigNumber } from "../services/settingsService";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "غير مصرح — سجل دخولك أولاً" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.sessionToken, token));
  if (!user) { res.status(401).json({ error: "جلسة منتهية" }); return; }
  (req as Request & { authUser: typeof user }).authUser = user;
  next();
}

export async function requireQuota(req: Request, res: Response, next: NextFunction) {
  const user = (req as Request & { authUser: typeof usersTable.$inferSelect }).authUser;
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  // Check maintenance mode
  const maintenanceMode = await getSystemConfigNumber("sys_maintenance_mode").catch(() => 0);
  if (maintenanceMode) {
    res.status(503).json({ error: "الخدمة في وضع الصيانة مؤقتاً، يرجى المحاولة لاحقاً", code: "MAINTENANCE" });
    return;
  }

  const freeLimit = await getSystemConfigNumber("sys_free_search_quota").catch(() => 3) || 3;
  const isActive = user.isSubscribed && user.subscriptionExpiry && user.subscriptionExpiry > new Date();
  if (!isActive && user.searchCount >= freeLimit) {
    res.status(402).json({
      error: "انتهت عمليات البحث المجانية",
      code: "QUOTA_EXCEEDED",
      searchCount: user.searchCount,
      limit: freeLimit,
      user: toPublicUser(user),
    });
    return;
  }
  next();
}

export async function incrementSearchCount(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (user) {
    await db.update(usersTable).set({ searchCount: user.searchCount + 1, updatedAt: new Date() }).where(eq(usersTable.id, userId));
  }
}
