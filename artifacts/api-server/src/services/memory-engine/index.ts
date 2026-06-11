import { LRUCache } from "../../lib/cache";

export type PatternType =
  | "entity_name_patterns"
  | "false_positive_signatures"
  | "source_reliability_scores"
  | "correlation_hints";

export interface LearnedPattern {
  id: string;
  type: PatternType;
  key: string;
  value: unknown;
  accessCount: number;
  createdAt: string;
  lastAccessedAt: string;
}

const hotCache = new LRUCache<LearnedPattern>(500);
const patternStore = new Map<string, LearnedPattern[]>();

function generateId(): string {
  return `pat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function storePattern(
  type: PatternType,
  key: string,
  value: unknown,
): Promise<LearnedPattern> {
  const pattern: LearnedPattern = {
    id: generateId(),
    type,
    key,
    value,
    accessCount: 0,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
  };

  if (!patternStore.has(type)) patternStore.set(type, []);
  patternStore.get(type)!.push(pattern);

  hotCache.set(`${type}:${key}`, pattern, 3600000);

  return pattern;
}

export async function recallPattern(type: PatternType, key: string): Promise<LearnedPattern | undefined> {
  const cacheKey = `${type}:${key}`;
  const cached = hotCache.get(cacheKey);
  if (cached) {
    cached.accessCount++;
    cached.lastAccessedAt = new Date().toISOString();
    return cached;
  }

  const patterns = patternStore.get(type) ?? [];
  const found = patterns.find((p) => p.key === key || matchSimilar(p.key, key));
  if (found) {
    found.accessCount++;
    found.lastAccessedAt = new Date().toISOString();
    hotCache.set(cacheKey, found, 3600000);
    return found;
  }

  return undefined;
}

export async function recallPatternsByType(type: PatternType): Promise<LearnedPattern[]> {
  return [...(patternStore.get(type) ?? [])].sort((a, b) => b.accessCount - a.accessCount);
}

export async function consolidatePatterns(): Promise<number> {
  let merged = 0;
  const now = Date.now();

  for (const [type, patterns] of patternStore) {
    const mergedMap = new Map<string, LearnedPattern>();
    const toRemove: string[] = [];

    for (const pattern of patterns) {
      const ageDays = (now - new Date(pattern.lastAccessedAt).getTime()) / 86400000;

      if (ageDays > 365 && pattern.accessCount < 3) {
        toRemove.push(pattern.id);
        continue;
      }

      if (ageDays > 180) {
        pattern.value = decayValue(pattern.value);
      }

      const existing = mergedMap.get(pattern.key);
      if (existing) {
        if (pattern.accessCount > existing.accessCount) {
          mergedMap.set(pattern.key, pattern);
        }
        toRemove.push(pattern.id);
        merged++;
      } else {
        const similar = [...mergedMap.values()].find((p) => matchSimilar(p.key, pattern.key));
        if (similar) {
          toRemove.push(pattern.id);
          merged++;
        } else {
          mergedMap.set(pattern.key, pattern);
        }
      }
    }

    patternStore.set(
      type,
      patterns.filter((p) => !toRemove.includes(p.id)),
    );
  }

  return merged;
}

function matchSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return norm(a) === norm(b);
}

function decayValue(value: unknown): unknown {
  if (typeof value === "number") return value * 0.9;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if ("confidence" in record && typeof record.confidence === "number") {
      return { ...record, confidence: record.confidence * 0.95 };
    }
  }
  return value;
}

export function getPatternStats(): { total: number; byType: Record<string, number> } {
  const byType: Record<string, number> = {};
  let total = 0;
  for (const [type, patterns] of patternStore) {
    byType[type] = patterns.length;
    total += patterns.length;
  }
  return { total, byType };
}
