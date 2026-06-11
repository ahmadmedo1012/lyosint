import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";
import { normalizeText as baseNormalize } from "../correlation/correlationEngine";

export type IdentifierType = "name" | "phone" | "username" | "email" | "domain" | "url";

export interface RawIdentifier {
  type: IdentifierType;
  value: string;
  source?: string;
  context?: Record<string, unknown>;
}

export interface NormalizedIdentifier {
  type: IdentifierType;
  original: string;
  normalized: string;
  fingerprint: string;
}

export interface ResolvedEntity {
  id: string;
  label: string;
  confidence: number;
  identifiers: NormalizedIdentifier[];
  matchedIds: string[];
  mergedIds: string[];
  createdAt: string;
}

interface FuzzyMatchResult {
  identifier: NormalizedIdentifier;
  score: number;
  targetId: string;
}

function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matches1 = new Array<boolean>(len1).fill(false);
  const matches2 = new Array<boolean>(len2).fill(false);
  let matches = 0;
  let transpositions = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (matches2[j]) continue;
      if (s1[i] !== s2[j]) continue;
      matches1[i] = true;
      matches2[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  const prefix = Math.min(
    4,
    (() => { let p = 0; while (p < Math.min(len1, len2, 4) && s1[p] === s2[p]) p++; return p; })(),
  );
  return jaro + prefix * 0.1 * (1 - jaro);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function nfkc(value: string): string {
  return value.normalize("NFKC");
}

function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, "") + url.pathname.replace(/\/$/, "");
  } catch {
    return value.toLowerCase().trim();
  }
}

function normalizePhoneE164(value: string): string | null {
  const cleaned = value.replace(/[\s\-\(\)]/g, "");
  if (/^\+[1-9]\d{6,14}$/.test(cleaned)) return cleaned;
  if (/^00[1-9]\d{6,14}$/.test(cleaned)) return "+" + cleaned.slice(2);
  if (/^0\d{9}$/.test(cleaned)) return "+218" + cleaned.slice(1);
  return null;
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function normalizeIdentifier(raw: RawIdentifier): NormalizedIdentifier | null {
  let value = raw.value.trim();
  if (!value) return null;
  value = nfkc(value);
  switch (raw.type) {
    case "email": {
      value = value.toLowerCase();
      const at = value.indexOf("@");
      if (at === -1) return null;
      const local = value.slice(0, at).replace(/\./g, "").replace(/\+.*$/, "");
      value = `${local}@${value.slice(at + 1)}`;
      break;
    }
    case "phone": {
      const e164 = normalizePhoneE164(value);
      if (!e164) return null;
      value = e164;
      break;
    }
    case "url": {
      value = canonicalizeUrl(value);
      break;
    }
    case "name": {
      value = baseNormalize(value);
      break;
    }
    case "username": {
      value = value.toLowerCase().replace(/[^a-z0-9_\-.]/g, "");
      break;
    }
    case "domain": {
      value = value.toLowerCase().replace(/^www\./, "").trim();
      break;
    }
  }
  return {
    type: raw.type,
    original: raw.value,
    normalized: value,
    fingerprint: fingerprint(value),
  };
}

export function fuzzyMatch(
  query: NormalizedIdentifier,
  candidates: NormalizedIdentifier[],
): FuzzyMatchResult[] {
  const results: FuzzyMatchResult[] = [];
  for (const candidate of candidates) {
    if (query.fingerprint === candidate.fingerprint) {
      results.push({ identifier: candidate, score: 1, targetId: candidate.fingerprint });
      continue;
    }
    if (query.type !== candidate.type) continue;
    let score = 0;
    switch (query.type) {
      case "email":
      case "phone":
      case "domain":
        score = query.normalized === candidate.normalized ? 1 : 0;
        break;
      case "name": {
        score = jaroWinkler(query.normalized, candidate.normalized);
        break;
      }
      case "username": {
        score = levenshteinSimilarity(query.normalized, candidate.normalized);
        break;
      }
      case "url": {
        score = query.normalized === candidate.normalized ? 1 : 0;
        break;
      }
    }
    if (score >= 0.85) {
      results.push({ identifier: candidate, score, targetId: candidate.fingerprint });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

export async function resolveEntity(rawIdentifiers: RawIdentifier[]): Promise<ResolvedEntity> {
  const normalized = rawIdentifiers
    .map(normalizeIdentifier)
    .filter((n): n is NormalizedIdentifier => n !== null);
  const seen = new Map<string, NormalizedIdentifier>();
  for (const n of normalized) {
    const key = `${n.type}:${n.fingerprint}`;
    if (!seen.has(key)) seen.set(key, n);
  }
  const uniqueIdentifiers = [...seen.values()];
  const matches = new Map<string, number>();
  for (let i = 0; i < uniqueIdentifiers.length; i++) {
    for (let j = i + 1; j < uniqueIdentifiers.length; j++) {
      const results = fuzzyMatch(uniqueIdentifiers[i], [uniqueIdentifiers[j]]);
      for (const r of results) {
        const key = `${uniqueIdentifiers[i].fingerprint}->${r.targetId}`;
        matches.set(key, r.score);
      }
    }
  }
  const avgConfidence = matches.size > 0
    ? [...matches.values()].reduce((a, b) => a + b, 0) / matches.size
    : 0.5;
  const confidence = Math.round(Math.min(Math.max(avgConfidence, 0.3), 0.99) * 100) / 100;
  const mergedIds = [...new Set([...matches.keys()].flatMap((k) => k.split("->")))];
  const entity: ResolvedEntity = {
    id: `entity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: uniqueIdentifiers.find((i) => i.type === "name")?.normalized
      ?? uniqueIdentifiers.find((i) => i.type === "email")?.normalized
      ?? uniqueIdentifiers[0]?.normalized
      ?? "unknown",
    confidence,
    identifiers: uniqueIdentifiers,
    matchedIds: [...matches.keys()],
    mergedIds,
    createdAt: new Date().toISOString(),
  };
  logger.info({ entityId: entity.id, confidence }, "entity resolved");
  return entity;
}
