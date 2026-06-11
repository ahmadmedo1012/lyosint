import { createHash } from "node:crypto";
import { logger } from "../../lib/logger";

export type SeverityLevel = "info" | "warning" | "error" | "critical";

export type ActionType =
  | "search"
  | "view_entity"
  | "create_investigation"
  | "update_dossier"
  | "export_data"
  | "admin_action"
  | "system";

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: ActionType;
  resourceType: string;
  resourceId?: string;
  severity: SeverityLevel;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  details: Record<string, unknown>;
  timestamp: string;
  checksum: string;
}

export interface AuditLogQuery {
  userId?: string;
  resourceType?: string;
  action?: ActionType;
  severity?: SeverityLevel;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface AggregatedActivity {
  date: string;
  userId: string;
  actionCounts: Record<string, number>;
  total: number;
}

const auditStore: AuditLogEntry[] = [];
const MAX_LOG_SIZE = 100_000;
const DEFAULT_RETENTION_DAYS = 365;

function generateId(): string {
  return `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function computeChecksum(entry: Omit<AuditLogEntry, "checksum">): string {
  const data = `${entry.id}:${entry.userId}:${entry.action}:${entry.resourceType}:${entry.timestamp}`;
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

function now(): string {
  return new Date().toISOString();
}

export async function logAction(params: {
  userId: string;
  action: ActionType;
  resourceType: string;
  resourceId?: string;
  severity?: SeverityLevel;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  details?: Record<string, unknown>;
}): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    id: generateId(),
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    severity: params.severity ?? "info",
    ip: params.ip,
    userAgent: params.userAgent,
    sessionId: params.sessionId,
    details: params.details ?? {},
    timestamp: now(),
    checksum: "",
  };

  entry.checksum = computeChecksum(entry);
  auditStore.push(entry);

  if (auditStore.length > MAX_LOG_SIZE) {
    auditStore.splice(0, auditStore.length - MAX_LOG_SIZE);
  }

  if (entry.severity === "error" || entry.severity === "critical") {
    logger.error({ auditId: entry.id, action: entry.action, userId: entry.userId }, entry.severity === "critical" ? "critical action" : "error action");
  }

  return entry;
}

export async function queryAuditLog(query: AuditLogQuery): Promise<AuditLogEntry[]> {
  let results = [...auditStore];

  if (query.userId) results = results.filter((e) => e.userId === query.userId);
  if (query.resourceType) results = results.filter((e) => e.resourceType === query.resourceType);
  if (query.action) results = results.filter((e) => e.action === query.action);
  if (query.severity) results = results.filter((e) => e.severity === query.severity);
  if (query.dateFrom) results = results.filter((e) => e.timestamp >= query.dateFrom!);
  if (query.dateTo) results = results.filter((e) => e.timestamp <= query.dateTo!);

  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  return results.slice(offset, offset + limit);
}

export async function getActivityFeed(limit: number = 20): Promise<AuditLogEntry[]> {
  return [...auditStore]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export async function getAggregatedActivity(
  dateFrom: string,
  dateTo: string,
): Promise<AggregatedActivity[]> {
  const filtered = auditStore.filter(
    (e) => e.timestamp >= dateFrom && e.timestamp <= dateTo,
  );

  const grouped = new Map<string, Map<string, Map<string, number>>>();

  for (const entry of filtered) {
    const date = entry.timestamp.slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, new Map());
    const byUser = grouped.get(date)!;
    if (!byUser.has(entry.userId)) byUser.set(entry.userId, new Map());
    const counts = byUser.get(entry.userId)!;
    counts.set(entry.action, (counts.get(entry.action) ?? 0) + 1);
  }

  const result: AggregatedActivity[] = [];
  for (const [date, byUser] of grouped) {
    for (const [userId, counts] of byUser) {
      const actionCounts: Record<string, number> = {};
      let total = 0;
      for (const [action, count] of counts) {
        actionCounts[action] = count;
        total += count;
      }
      result.push({ date, userId, actionCounts, total });
    }
  }

  return result.sort((a, b) => b.date.localeCompare(a.date) || b.total - a.total);
}

export async function enforceRetention(retentionDays: number = DEFAULT_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  const before = auditStore.length;
  let removed = 0;
  for (let i = auditStore.length - 1; i >= 0; i--) {
    if (auditStore[i].timestamp < cutoff) {
      auditStore.splice(i, 1);
      removed++;
    }
  }
  logger.info({ removed, before, after: auditStore.length }, "audit log retention enforced");
  return removed;
}

export function getAuditStats(): { total: number; bySeverity: Record<string, number>; byAction: Record<string, number> } {
  const bySeverity: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  for (const entry of auditStore) {
    bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;
    byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
  }
  return { total: auditStore.length, bySeverity, byAction };
}
