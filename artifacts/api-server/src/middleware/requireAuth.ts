import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { FREE_LIMIT, toPublicUser } from "../routes/auth";

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
  const isActive = user.isSubscribed && user.subscriptionExpiry && user.subscriptionExpiry > new Date();
  if (!isActive && user.searchCount >= FREE_LIMIT) {
    res.status(402).json({
      error: "انتهت عمليات البحث المجانية",
      code: "QUOTA_EXCEEDED",
      searchCount: user.searchCount,
      limit: FREE_LIMIT,
      user: toPublicUser(user),
    });
    return;
  }
  next();
}

export async function incrementSearchCount(userId: string) {
  await db
    .update(usersTable)
    .set({ searchCount: db.$count(usersTable) } as never)
    .where(eq(usersTable.id, userId));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (user) {
    await db.update(usersTable).set({ searchCount: user.searchCount + 1, updatedAt: new Date() }).where(eq(usersTable.id, userId));
  }
}
