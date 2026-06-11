import { type Request, type Response, type NextFunction } from "express";
import { LRUCache } from "../lib/cache";
import { RateLimitError } from "../lib/errors";
import { logger } from "../lib/logger";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface LimitConfig {
  maxTokens: number;
  windowMs: number;
}

const LIMITS: Record<string, LimitConfig> = {
  search: { maxTokens: Number(process.env["RATE_LIMIT_SEARCH"] ?? "10"), windowMs: 60_000 },
  auth: { maxTokens: Number(process.env["RATE_LIMIT_AUTH"] ?? "5"), windowMs: 60_000 },
  admin: { maxTokens: Number(process.env["RATE_LIMIT_ADMIN"] ?? "30"), windowMs: 60_000 },
  general: { maxTokens: Number(process.env["RATE_LIMIT_GENERAL"] ?? "60"), windowMs: 60_000 },
};

const buckets = new LRUCache<Bucket>(10000);

function getBucketKey(ip: string, limitKey: string): string {
  return `${ip}:${limitKey}`;
}

function getOrCreateBucket(key: string, config: LimitConfig): Bucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: Date.now() };
    buckets.set(key, bucket, config.windowMs * 2);
  }
  return bucket;
}

function refillBucket(bucket: Bucket, config: LimitConfig): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const refillRate = config.maxTokens / config.windowMs;
  const newTokens = Math.min(config.maxTokens, bucket.tokens + elapsed * refillRate);
  bucket.tokens = newTokens;
  bucket.lastRefill = now;
}

function setRateLimitHeaders(res: Response, config: LimitConfig, remaining: number): void {
  res.setHeader("X-RateLimit-Limit", config.maxTokens);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, Math.floor(remaining)));
  res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() + config.windowMs) / 1000));
}

export function rateLimit(limitKey: keyof typeof LIMITS) {
  const config = LIMITS[limitKey] ?? LIMITS.general;

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = getBucketKey(ip, limitKey);
    const bucket = getOrCreateBucket(key, config);

    refillBucket(bucket, config);

    if (bucket.tokens < 1) {
      const retryAfter = Math.ceil((bucket.lastRefill + config.windowMs - Date.now()) / 1000);
      setRateLimitHeaders(res, config, 0);
      res.setHeader("Retry-After", retryAfter);
      logger.warn({ ip, limitKey, retryAfter }, "Rate limit exceeded");
      const err = new RateLimitError(
        `طلبات كثيرة جداً — يرجى الانتظار ${retryAfter} ثانية`,
        { retryAfter, limit: config.maxTokens, windowMs: config.windowMs },
      );
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      });
      return;
    }

    bucket.tokens -= 1;
    buckets.set(key, bucket, config.windowMs * 2);
    setRateLimitHeaders(res, config, bucket.tokens);
    next();
  };
}
