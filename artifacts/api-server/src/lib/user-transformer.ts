import { usersTable } from "@workspace/db";
import { getSystemConfigNumber } from "../services/settingsService";

export async function getFreeLimit(): Promise<number> {
  return getSystemConfigNumber("sys_free_search_quota");
}

export async function toPublicUser(user: typeof usersTable.$inferSelect) {
  const isActive = user.isSubscribed && user.subscriptionExpiry && user.subscriptionExpiry > new Date();
  const limit = await getFreeLimit();
  return {
    id: user.id, telegramId: user.telegramId, firstName: user.firstName, lastName: user.lastName,
    username: user.username, photoUrl: user.photoUrl, searchCount: user.searchCount,
    isSubscribed: isActive ?? false, subscriptionExpiry: user.subscriptionExpiry?.toISOString() ?? null,
    canSearch: isActive || user.searchCount < limit,
    searchesRemaining: isActive ? null : Math.max(0, limit - user.searchCount),
  };
}
