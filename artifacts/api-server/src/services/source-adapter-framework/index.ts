import { LRUCache } from "../../lib/cache";
import { logger } from "../../lib/logger";

export type SourceErrorType =
  | "timeout"
  | "rate_limited"
  | "auth_error"
  | "parse_error"
  | "not_found"
  | "server_error"
  | "unknown";

export interface SourceError {
  type: SourceErrorType;
  message: string;
  retryable: boolean;
}

export interface SourceResult {
  found: boolean;
  data: unknown;
  profile?: Record<string, unknown>;
  error?: SourceError;
}

export interface SourceHealth {
  healthy: boolean;
  lastCheck: string;
  latencyMs: number;
  error?: string;
}

export abstract class BaseSourceAdapter {
  readonly name: string;
  readonly type: string;

  protected config: { name: string; type: string; timeoutMs: number; cacheTtlMs: number };
  protected cache: LRUCache<SourceResult>;
  protected circuitState: "closed" | "open" | "half-open" = "closed";
  protected failureCount = 0;
  protected lastFailureTime = 0;
  protected health: SourceHealth = { healthy: true, lastCheck: new Date().toISOString(), latencyMs: 0 };
  protected lastRequestTime = 0;

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_MS = 30_000;
  private readonly RATE_LIMIT_TOKENS: number;
  private readonly RATE_REFILL_INTERVAL: number;
  private tokens: number;
  private lastRefill: number;

  constructor(config: { name: string; type: string; rateLimitPerMinute?: number; timeoutMs?: number; cacheTtlMs?: number }) {
    this.name = config.name;
    this.type = config.type;
    this.config = {
      name: config.name,
      type: config.type,
      timeoutMs: config.timeoutMs ?? 10_000,
      cacheTtlMs: config.cacheTtlMs ?? 300_000,
    };
    this.cache = new LRUCache<SourceResult>(100);
    this.RATE_LIMIT_TOKENS = config.rateLimitPerMinute ?? 60;
    this.tokens = this.RATE_LIMIT_TOKENS;
    this.lastRefill = Date.now();
    this.RATE_REFILL_INTERVAL = Math.max(1, Math.ceil(60_000 / this.RATE_LIMIT_TOKENS));
  }

  abstract search(query: string): Promise<SourceResult>;
  abstract validateResponse(response: unknown): boolean;
  abstract normalizeResult(result: unknown): SourceResult;

  protected async executeWithRetry(query: string, retries = 3): Promise<SourceResult> {
    let lastError: SourceError | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      if (this.circuitState === "open") {
        if (Date.now() - this.lastFailureTime >= this.CIRCUIT_RESET_MS) {
          this.circuitState = "half-open";
          logger.info({ source: this.name }, "circuit breaker half-open");
        } else {
          return {
            found: false,
            data: null,
            error: { type: "server_error", message: "circuit breaker open", retryable: false },
          };
        }
      }

      if (!(await this.acquireToken())) {
        return {
          found: false,
          data: null,
          error: { type: "rate_limited", message: "rate limit exceeded", retryable: true },
        };
      }

      const cacheKey = `${this.name}:${query.toLowerCase().trim()}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      try {
        const start = Date.now();
        const result = await this.search(query);
        const elapsed = Date.now() - start;

        this.health = { healthy: true, lastCheck: new Date().toISOString(), latencyMs: elapsed };
        this.failureCount = 0;
        this.lastRequestTime = Date.now();

        if (result.found) {
          this.cache.set(cacheKey, result, this.config.cacheTtlMs);
        }

        return result;
      } catch (err: any) {
        lastError = this.classifyError(err);
        this.failureCount++;
        this.lastFailureTime = Date.now();

        logger.warn(
          { source: this.name, attempt: attempt + 1, error: lastError },
          "source adapter error",
        );

        if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
          this.circuitState = "open";
          logger.error({ source: this.name }, "circuit breaker tripped");
        }

        if (lastError.retryable && attempt < retries - 1) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10_000);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        } else {
          break;
        }
      }
    }

    this.health = { healthy: false, lastCheck: new Date().toISOString(), latencyMs: 0, error: lastError?.message };

    return {
      found: false,
      data: null,
      error: lastError ?? { type: "unknown", message: "all retries exhausted", retryable: false },
    };
  }

  protected classifyError(err: Error): SourceError {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) {
      return { type: "timeout", message: err.message, retryable: true };
    }
    if (msg.includes("rate") || msg.includes("429") || msg.includes("too many")) {
      return { type: "rate_limited", message: err.message, retryable: true };
    }
    if (msg.includes("auth") || msg.includes("401") || msg.includes("403") || msg.includes("unauthorized")) {
      return { type: "auth_error", message: err.message, retryable: false };
    }
    if (msg.includes("parse") || msg.includes("invalid json")) {
      return { type: "parse_error", message: err.message, retryable: false };
    }
    if (msg.includes("404") || msg.includes("not found")) {
      return { type: "not_found", message: err.message, retryable: false };
    }
    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("server")) {
      return { type: "server_error", message: err.message, retryable: true };
    }
    return { type: "unknown", message: err.message, retryable: true };
  }

  private async acquireToken(): Promise<boolean> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.RATE_LIMIT_TOKENS, this.tokens + Math.floor(elapsed / this.RATE_REFILL_INTERVAL));
    this.lastRefill = now;

    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    return false;
  }

  async checkHealth(): Promise<SourceHealth> {
    return this.health;
  }

  async resetCircuitBreaker(): Promise<void> {
    this.circuitState = "closed";
    this.failureCount = 0;
    logger.info({ source: this.name }, "circuit breaker manually reset");
  }
}

export class SherlockAdapter extends BaseSourceAdapter {
  constructor() {
    super({ name: "sherlock", type: "username", rateLimitPerMinute: 30 });
  }

  async search(query: string): Promise<SourceResult> {
    return {
      found: false,
      data: null,
      error: { type: "not_found", message: "not implemented - requires Sherlock subprocess", retryable: false },
    };
  }

  validateResponse(response: unknown): boolean {
    return typeof response === "object" && response !== null;
  }

  normalizeResult(result: unknown): SourceResult {
    return { found: false, data: result };
  }
}

export class MaigretAdapter extends BaseSourceAdapter {
  constructor() {
    super({ name: "maigret", type: "username", rateLimitPerMinute: 20 });
  }

  async search(query: string): Promise<SourceResult> {
    return {
      found: false,
      data: null,
      error: { type: "not_found", message: "not implemented - use maigret.ts directly", retryable: false },
    };
  }

  validateResponse(response: unknown): boolean {
    return typeof response === "object" && response !== null;
  }

  normalizeResult(result: unknown): SourceResult {
    return { found: false, data: result };
  }
}

export class PhoneSearchAdapter extends BaseSourceAdapter {
  constructor() {
    super({ name: "phone_search", type: "phone", rateLimitPerMinute: 15 });
  }

  async search(query: string): Promise<SourceResult> {
    return {
      found: false,
      data: null,
      error: { type: "not_found", message: "not implemented - use phoneSearch.ts directly", retryable: false },
    };
  }

  validateResponse(response: unknown): boolean {
    return typeof response === "object" && response !== null;
  }

  normalizeResult(result: unknown): SourceResult {
    return { found: false, data: result };
  }
}

export class EmailSearchAdapter extends BaseSourceAdapter {
  constructor() {
    super({ name: "email_search", type: "email", rateLimitPerMinute: 10 });
  }

  async search(query: string): Promise<SourceResult> {
    return {
      found: false,
      data: null,
      error: { type: "not_found", message: "not implemented - requires email API integration", retryable: false },
    };
  }

  validateResponse(response: unknown): boolean {
    return typeof response === "object" && response !== null;
  }

  normalizeResult(result: unknown): SourceResult {
    return { found: false, data: result };
  }
}
