import { db, searchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { LRUCache } from "../../lib/cache";
import { resolveEntity, type RawIdentifier, type ResolvedEntity } from "../entity-resolver/index";
import { scoreConfidence, type ConfidenceResult } from "../confidence-engine/index";
import { storeEvidence, type EvidenceItem } from "../evidence-engine/index";
import { inferRelationships, type Relationship } from "../relationship-engine/index";
import { IntelligenceGraph, type GraphNode, type GraphEdge } from "../graph-engine/index";

export interface SearchTask {
  id: string;
  query: string;
  sources: string[];
  status: "pending" | "running" | "completed" | "failed" | "partial";
  progress: number;
  results: unknown[];
  errors: Array<{ source: string; error: string }>;
  createdAt: string;
  completedAt?: string;
}

export interface SearchSourceResult {
  source: string;
  data: unknown;
  error?: string;
  elapsedMs: number;
}

export interface OrchestratedResult {
  entity: ResolvedEntity;
  evidence: EvidenceItem[];
  relationships: Relationship[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  confidence: ConfidenceResult;
  searchId: string;
}

type SourceSearchFn = (query: string) => Promise<unknown>;

interface SourceAdapter {
  name: string;
  search: SourceSearchFn;
}

const taskQueue: SearchTask[] = [];
let isProcessing = false;
const MAX_CONCURRENCY = 5;
const DEFAULT_SOURCE_TIMEOUT = 10_000;
const OVERALL_TIMEOUT = 60_000;

const resultCache = new LRUCache<unknown>(200);

function generateId(): string {
  return `srch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cacheKey(source: string, query: string): string {
  return `${source}:${query.toLowerCase().trim()}`;
}

async function executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

async function updateSearchProgress(searchId: string, progress: number): Promise<void> {
  try {
    await db
      .update(searchesTable)
      .set({ progress: Math.min(100, Math.round(progress)) })
      .where(eq(searchesTable.id, searchId));
  } catch {
    // non-critical
  }
}

export async function enqueueSearch(params: {
  query: string;
  sources: string[];
  searchId?: string;
}): Promise<SearchTask> {
  const task: SearchTask = {
    id: params.searchId ?? generateId(),
    query: params.query,
    sources: params.sources,
    status: "pending",
    progress: 0,
    results: [],
    errors: [],
    createdAt: new Date().toISOString(),
  };

  taskQueue.push(task);
  logger.info({ taskId: task.id, query: task.query, sources: task.sources.length }, "search enqueued");

  if (!isProcessing) processQueue();
  return task;
}

async function processQueue(): Promise<void> {
  isProcessing = true;

  while (taskQueue.length > 0) {
    const task = taskQueue.shift()!;
    task.status = "running";
    task.progress = 0;

    const overallTimeout = setTimeout(() => {
      task.status = "partial";
      logger.warn({ taskId: task.id }, "search overall timeout, returning partial results");
    }, OVERALL_TIMEOUT);

    try {
      const batchSize = Math.min(MAX_CONCURRENCY, task.sources.length);
      const results: SearchSourceResult[] = [];

      for (let i = 0; i < task.sources.length; i += batchSize) {
        const batch = task.sources.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (source) => {
            const cacheKeyStr = cacheKey(source, task.query);
            const cached = resultCache.get(cacheKeyStr);
            if (cached) {
              return { source, data: cached, elapsedMs: 0 } as SearchSourceResult;
            }

            const start = Date.now();
            try {
              const data = await executeWithTimeout(
                () => resolveSourceSearch(source, task.query),
                DEFAULT_SOURCE_TIMEOUT,
                source,
              );
              resultCache.set(cacheKeyStr, data, 300_000);
              return { source, data, elapsedMs: Date.now() - start } as SearchSourceResult;
            } catch (err: any) {
              return { source, data: null, error: err.message, elapsedMs: Date.now() - start } as SearchSourceResult;
            }
          }),
        );

        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            results.push(result.value);
          }
        }

        task.progress = Math.round(((i + batchSize) / task.sources.length) * 100);
        await updateSearchProgress(task.id, task.progress);
      }

      task.results = results;
      task.status = task.errors.length > 0 && results.length > 0 ? "partial" : "completed";
    } catch (err: any) {
      task.status = "failed";
      logger.error({ taskId: task.id, error: err.message }, "search orchestration failed");
    } finally {
      clearTimeout(overallTimeout);
      task.completedAt = new Date().toISOString();
    }
  }

  isProcessing = false;
}

async function resolveSourceSearch(source: string, query: string): Promise<unknown> {
  throw new Error(`No adapter registered for source: ${source}`);
}

export function registerSource(name: string, searchFn: SourceSearchFn): void {
  sourceAdapters.set(name, { name, search: searchFn });
}

const sourceAdapters = new Map<string, SourceAdapter>();

export async function orchestrateSearch(params: {
  query: string;
  rawIdentifiers: RawIdentifier[];
  searchId?: string;
}): Promise<OrchestratedResult> {
  const entity = await resolveEntity(params.rawIdentifiers);

  const confidence = scoreConfidence({
    sourceAuthority: 0.6,
    consistency: 0.7,
    evidenceAgeDays: 0,
    corroborationCount: entity.identifiers.length,
  });

  const evidence: EvidenceItem[] = [];
  for (const id of entity.identifiers) {
    const ev = await storeEvidence({
      entityId: entity.id,
      type: "profile",
      source: "entity-resolver",
      sourceName: "Entity Resolution Engine",
      value: id.normalized,
      metadata: { type: id.type, original: id.original },
      confidence,
    });
    evidence.push(ev);
  }

  const existingEntities: Array<{ id: string; identifiers: import("../entity-resolver/index").NormalizedIdentifier[] }> = [];
  const relationships = inferRelationships(entity.id, entity.identifiers, existingEntities);

  const graph = new IntelligenceGraph();
  graph.addNode({ id: entity.id, label: entity.label, type: "entity" });
  for (const rel of relationships.relationships) {
    graph.addNode({ id: rel.targetEntityId, label: rel.targetEntityId, type: "entity" });
    graph.addEdge({
      id: rel.id,
      source: rel.sourceEntityId,
      target: rel.targetEntityId,
      type: rel.type,
      weight: rel.strength,
    });
  }

  const adjList = graph.toAdjacencyList();

  await db
    .update(searchesTable)
    .set({
      status: "completed",
      progress: 100,
      confidenceScore: confidence.score,
      completedAt: new Date(),
    })
    .where(eq(searchesTable.id, params.searchId ?? ""))
    .catch(() => {});

  return {
    entity,
    evidence,
    relationships: relationships.relationships,
    graph: adjList,
    confidence,
    searchId: params.searchId ?? "",
  };
}

export function getTaskStatus(taskId: string): SearchTask | undefined {
  return taskQueue.find((t) => t.id === taskId);
}

export function getQueueLength(): number {
  return taskQueue.length;
}
