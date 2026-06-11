import { LRUCache } from "./cache";
import { logger } from "./logger";
import { secrets } from "./secrets";

const MAX_FAILED_ATTEMPTS = Number(process.env["ABUSE_MAX_FAILED"] ?? "5");
const BLOCK_DURATION_MS = Number(process.env["ABUSE_BLOCK_DURATION_MS"] ?? "900000");
const FAILED_WINDOW_MS = Number(process.env["ABUSE_FAILED_WINDOW_MS"] ?? "600000");

interface IPRecord {
  failedAttempts: { timestamp: number }[];
  blockedUntil: number;
  requestCount: number;
  requestWindowStart: number;
  suspiciousScore: number;
}

const ipStore = new LRUCache<IPRecord>(5000);

setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const key of Object.keys(ipStore)) {
    const entry = (ipStore as unknown as Map<string, IPRecord>).get(key);
    if (entry && entry.blockedUntil < now && entry.requestWindowStart < now - FAILED_WINDOW_MS) {
      (ipStore as unknown as Map<string, IPRecord>).delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) logger.debug({ cleaned }, "تم تنظيف سجلات IP القديمة");
}, 300_000);

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = getOrCreateRecord(ip);
  record.failedAttempts.push({ timestamp: now });
  const windowStart = now - FAILED_WINDOW_MS;
  record.failedAttempts = record.failedAttempts.filter((a) => a.timestamp > windowStart);
  if (record.failedAttempts.length >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
    logger.warn({ ip, attempts: record.failedAttempts.length }, `تم حظر IP ${ip} — محاولات فاشلة كثيرة`);
  }
  ipStore.set(ip, record, BLOCK_DURATION_MS + FAILED_WINDOW_MS);
}

export function isBlocked(ip: string): boolean {
  const record = ipStore.get(ip);
  if (!record) return false;
  if (record.blockedUntil > Date.now()) return true;
  return false;
}

export function getBlockRemainingMs(ip: string): number {
  const record = ipStore.get(ip);
  if (!record) return 0;
  return Math.max(0, record.blockedUntil - Date.now());
}

export function clearRecord(ip: string): void {
  ipStore.delete(ip);
}

export function recordRequest(ip: string): void {
  const now = Date.now();
  const record = getOrCreateRecord(ip);
  if (now - record.requestWindowStart > 60_000) {
    record.requestCount = 0;
    record.requestWindowStart = now;
  }
  record.requestCount++;
  ipStore.set(ip, record, BLOCK_DURATION_MS + FAILED_WINDOW_MS);
}

export function getRequestCount(ip: string): number {
  const record = ipStore.get(ip);
  if (!record) return 0;
  return record.requestCount;
}

export function detectSuspiciousPattern(ip: string, path: string): boolean {
  const record = getOrCreateRecord(ip);
  if (path.includes("/search/")) {
    record.suspiciousScore += 2;
  }
  if (record.suspiciousScore > 20) {
    record.blockedUntil = Date.now() + BLOCK_DURATION_MS;
    logger.warn({ ip, score: record.suspiciousScore }, `اكتشاف نمط مشبوه من IP ${ip}`);
    return true;
  }
  ipStore.set(ip, record, BLOCK_DURATION_MS + FAILED_WINDOW_MS);
  return false;
}

export async function verifyCaptcha(token: string): Promise<boolean> {
  const hcaptchaSecret = secrets.HCAPTCHA_SECRET;
  const turnstileSecret = secrets.TURNSTILE_SECRET;

  if (hcaptchaSecret) {
    try {
      const res = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: hcaptchaSecret, response: token }),
      });
      const data = (await res.json()) as { success: boolean };
      return data.success;
    } catch { return false; }
  }

  if (turnstileSecret) {
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: turnstileSecret, response: token }),
      });
      const data = (await res.json()) as { success: boolean };
      return data.success;
    } catch { return false; }
  }

  return true;
}

function getOrCreateRecord(ip: string): IPRecord {
  const existing = ipStore.get(ip);
  if (existing) return existing;
  return {
    failedAttempts: [],
    blockedUntil: 0,
    requestCount: 0,
    requestWindowStart: Date.now(),
    suspiciousScore: 0,
  };
}
