import { type Request, type Response, type NextFunction } from "express";
import { db, auditLogsTable, type User } from "@workspace/db";
import { logger } from "../lib/logger";

const SENSITIVE_PREFIXES = ["/api/search/", "/api/entity/"];
const AUTH_ENDPOINTS = ["/api/auth/login", "/api/auth/register"];
const ADMIN_PREFIXES = ["/api/admin/"];

function determineSeverity(method: string, path: string, statusCode: number): string {
  if (statusCode >= 500) return "critical";
  if (statusCode >= 400 && statusCode < 500) {
    if (statusCode === 401 || statusCode === 403) return "warning";
    if (AUTH_ENDPOINTS.some((p) => path.startsWith(p))) return "warning";
    return "info";
  }
  if (SENSITIVE_PREFIXES.some((p) => path.startsWith(p))) return "info";
  if (ADMIN_PREFIXES.some((p) => path.startsWith(p))) return "info";
  return "info";
}

function classifyResource(path: string): { type: string; id?: string } {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "api" && parts.length >= 2) {
    const resource = parts[1];
    const possibleId = parts[2];
    const isValidId = possibleId && /^[a-f0-9-]{20,}$/i.test(possibleId);
    return { type: resource, id: isValidId ? possibleId : undefined };
  }
  return { type: "unknown" };
}

export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const responseTimeMs = Date.now() - start;
    const user = (req as Request & { authUser?: User }).authUser;
    const method = req.method;
    const path = req.originalUrl ?? req.url ?? "/";
    const cleanPath = path.split("?")[0];
    const statusCode = res.statusCode;
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? null;
    const userAgent = req.headers["user-agent"] ?? null;
    const severity = determineSeverity(method, cleanPath, statusCode);
    const resource = classifyResource(cleanPath);
    const sessionId = user ? (req as any).tokenPayload?.sessionId ?? null : null;

    const logEntry = {
      userId: user?.id ?? null,
      action: `${method} ${cleanPath}`,
      resourceType: resource.type,
      resourceId: resource.id ?? null,
      details: { method, statusCode, responseTimeMs, isAdmin: ADMIN_PREFIXES.some((p) => cleanPath.startsWith(p)) ? 1 : 0 },
      ipAddress,
      userAgent,
      severity,
      sessionId,
    };

    db.insert(auditLogsTable).values(logEntry).catch((err) => {
      logger.error(err, "Failed to write audit log");
    });

    if (severity === "critical" || severity === "warning") {
      logger[severity === "critical" ? "error" : "warn"]({
        userId: user?.id, action: logEntry.action, statusCode, responseTimeMs, ipAddress,
      }, `audit: ${severity}`);
    }
  });

  next();
}
