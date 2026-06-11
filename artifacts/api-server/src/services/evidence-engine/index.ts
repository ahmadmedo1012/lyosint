import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";
import { scoreConfidence, type ConfidenceResult } from "../confidence-engine/index";

export type EvidenceStatus = "pending" | "verified" | "contradicted" | "expired";
export type EvidenceType = "profile" | "breach" | "communication" | "document" | "location" | "association";

export interface EvidenceItem {
  id: string;
  entityId: string;
  identifierId?: string;
  relationshipId?: string;
  type: EvidenceType;
  source: string;
  sourceName: string;
  value: string;
  checksum: string;
  status: EvidenceStatus;
  confidence: ConfidenceResult;
  metadata: Record<string, unknown>;
  collectedAt: string;
  verifiedAt?: string;
  expiresAt?: string;
}

export interface EvidenceQuery {
  entityId?: string;
  identifierId?: string;
  source?: string;
  type?: EvidenceType;
  status?: EvidenceStatus;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface EvidenceSummary {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  averageConfidence: number;
  sourcesList: string[];
}

const evidenceStore = new Map<string, EvidenceItem>();

function generateChecksum(value: string, sourceName: string): string {
  return createHash("sha256")
    .update(`${value.toLowerCase().trim()}:${sourceName.toLowerCase().trim()}`)
    .digest("hex");
}

function deduplicate(items: EvidenceItem[], candidate: EvidenceItem): boolean {
  return items.some((e) => e.checksum === candidate.checksum);
}

function bayesianConfidenceUpdate(
  currentConfidence: ConfidenceResult,
  newEvidenceConfidence: ConfidenceResult,
): ConfidenceResult {
  const combined = scoreConfidence({
    sourceAuthority: (currentConfidence.factors.source_authority + newEvidenceConfidence.factors.source_authority) / 2,
    consistency: (currentConfidence.factors.evidence_consistency + newEvidenceConfidence.factors.evidence_consistency) / 2,
    independence: Math.min(1, currentConfidence.factors.source_independence + newEvidenceConfidence.factors.source_independence),
    evidenceAgeDays: 0,
    corroborationCount: Math.round(
      (currentConfidence.factors.corroboration_count + newEvidenceConfidence.factors.corroboration_count) * 10,
    ),
    priorConfidence: currentConfidence.score,
  });
  return combined;
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function storeEvidence(params: {
  entityId: string;
  type: EvidenceType;
  source: string;
  sourceName: string;
  value: string;
  metadata?: Record<string, unknown>;
  identifierId?: string;
  relationshipId?: string;
  confidence?: ConfidenceResult;
}): Promise<EvidenceItem> {
  const checksum = generateChecksum(params.value, params.sourceName);

  const existing = [...evidenceStore.values()].filter((e) => e.checksum === checksum);
  if (existing.length > 0) {
    logger.info({ checksum, entityId: params.entityId }, "duplicate evidence skipped");
    return existing[0];
  }

  const confidence = params.confidence ?? scoreConfidence({
    sourceAuthority: 0.5,
    consistency: 0.5,
    evidenceAgeDays: 0,
    corroborationCount: 1,
  });

  const item: EvidenceItem = {
    id: generateId(),
    entityId: params.entityId,
    identifierId: params.identifierId,
    relationshipId: params.relationshipId,
    type: params.type,
    source: params.source,
    sourceName: params.sourceName,
    value: params.value,
    checksum,
    status: "pending",
    confidence,
    metadata: params.metadata ?? {},
    collectedAt: now(),
  };

  evidenceStore.set(item.id, item);
  logger.info({ evidenceId: item.id, type: item.type, source: item.source }, "evidence stored");
  return item;
}

export async function getEvidence(id: string): Promise<EvidenceItem | undefined> {
  return evidenceStore.get(id);
}

export async function queryEvidence(query: EvidenceQuery): Promise<EvidenceItem[]> {
  let results = [...evidenceStore.values()];

  if (query.entityId) results = results.filter((e) => e.entityId === query.entityId);
  if (query.identifierId) results = results.filter((e) => e.identifierId === query.identifierId);
  if (query.source) results = results.filter((e) => e.source === query.source);
  if (query.type) results = results.filter((e) => e.type === query.type);
  if (query.status) results = results.filter((e) => e.status === query.status);
  if (query.dateFrom) results = results.filter((e) => e.collectedAt >= query.dateFrom!);
  if (query.dateTo) results = results.filter((e) => e.collectedAt <= query.dateTo!);

  results.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  return results.slice(offset, offset + limit);
}

export async function updateConfidence(
  evidenceId: string,
  newConfidence: ConfidenceResult,
): Promise<EvidenceItem | undefined> {
  const item = evidenceStore.get(evidenceId);
  if (!item) return undefined;
  item.confidence = bayesianConfidenceUpdate(item.confidence, newConfidence);
  evidenceStore.set(evidenceId, item);
  return item;
}

export async function verifyEvidence(evidenceId: string): Promise<EvidenceItem | undefined> {
  const item = evidenceStore.get(evidenceId);
  if (!item) return undefined;
  item.status = "verified";
  item.verifiedAt = now();
  evidenceStore.set(evidenceId, item);
  return item;
}

export async function evidenceSummary(entityId?: string): Promise<EvidenceSummary> {
  const items = entityId
    ? [...evidenceStore.values()].filter((e) => e.entityId === entityId)
    : [...evidenceStore.values()];

  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalConfidence = 0;

  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1;
    bySource[item.source] = (bySource[item.source] ?? 0) + 1;
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    totalConfidence += item.confidence.score;
  }

  return {
    total: items.length,
    byType,
    bySource,
    byStatus,
    averageConfidence: items.length > 0 ? Math.round((totalConfidence / items.length) * 100) / 100 : 0,
    sourcesList: [...new Set(items.map((i) => i.sourceName))],
  };
}
