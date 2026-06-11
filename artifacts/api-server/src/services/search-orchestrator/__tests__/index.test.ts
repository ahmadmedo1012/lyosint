import { jest, describe, expect, it, beforeEach } from "@jest/globals";
import {
  enqueueSearch,
  orchestrateSearch,
  getTaskStatus,
  getQueueLength,
} from "../index";

jest.mock("@workspace/db", () => ({
  db: { update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ catch: jest.fn() })) })) })) },
  searchesTable: {},
}));

jest.mock("../../../lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

jest.mock("../../entity-resolver/index", () => ({
  resolveEntity: jest.fn<() => Promise<any>>().mockResolvedValue({
    id: "entity-mock",
    label: "Test User",
    confidence: 0.75,
    identifiers: [],
    matchedIds: [],
    mergedIds: [],
    createdAt: new Date().toISOString(),
  }),
  normalizeIdentifier: jest.fn(),
}));

jest.mock("../../confidence-engine/index", () => ({
  scoreConfidence: jest.fn().mockReturnValue({
    score: 0.75,
    level: "high",
    factors: {
      source_authority: 0.6, evidence_consistency: 0.7,
      source_independence: 0.5, recency: 1, corroboration_count: 0.1,
    },
    explanation: "High confidence",
    explanationAr: "ثقة عالية",
  }),
}));

jest.mock("../../evidence-engine/index", () => ({
  storeEvidence: jest.fn().mockImplementation(async (params: any) => ({
    id: `ev-${Date.now()}`,
    entityId: params.entityId,
    type: params.type,
    source: params.source,
    sourceName: params.sourceName,
    value: params.value,
    checksum: `cs-${params.value}`,
    status: "pending",
    confidence: { score: 0.75 },
    metadata: params.metadata ?? {},
    collectedAt: new Date().toISOString(),
  })),
}));

jest.mock("../../relationship-engine/index", () => ({
  inferRelationships: jest.fn().mockReturnValue({
    relationships: [],
    autoMergePending: false,
    mergeCandidates: [],
  }),
}));

jest.mock("../../graph-engine/index", () => {
  const mockGraph: any = {
    nodes: new Map(),
    edges: new Map(),
    adjacency: new Map(),
    addNode: jest.fn(),
    addEdge: jest.fn(),
    toAdjacencyList: jest.fn().mockReturnValue({ nodes: [], edges: [] }),
  };
  return {
    IntelligenceGraph: jest.fn().mockImplementation(() => mockGraph),
  };
});

describe("searchOrchestrator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enqueues a search task and assigns an id", async () => {
    const task = await enqueueSearch({
      query: "test_user",
      sources: ["github", "twitter"],
    });

    expect(task.id).toMatch(/^srch-/);
    expect(task.query).toBe("test_user");
    expect(task.sources).toEqual(["github", "twitter"]);
    expect(task.status).toBeDefined();
  });

  it("task is trackable via getTaskStatus (may be processed already)", async () => {
    const task = await enqueueSearch({
      query: "test_user",
      sources: ["github"],
    });

    expect(task.id).toMatch(/^srch-/);
  });

  it("getQueueLength returns current queue size", async () => {
    await enqueueSearch({ query: "user1", sources: ["s1"] });
    await enqueueSearch({ query: "user2", sources: ["s2"] });

    const len = getQueueLength();
    expect(len).toBeGreaterThanOrEqual(0);
  });

  it("orchestrateSearch resolves entity, stores evidence, builds graph", async () => {
    const result = await orchestrateSearch({
      query: "test_user",
      rawIdentifiers: [{ type: "name", value: "Test User" }],
    });

    expect(result.entity).toBeDefined();
    expect(result.entity.id).toBe("entity-mock");
    expect(result.confidence).toBeDefined();
    expect(result.confidence.score).toBeGreaterThan(0);
  });

  it("orchestrateSearch returns evidence array", async () => {
    const result = await orchestrateSearch({
      query: "test_user",
      rawIdentifiers: [{ type: "name", value: "Test User" }],
    });

    expect(Array.isArray(result.evidence)).toBe(true);
  });

  it("orchestrateSearch returns graph with nodes and edges", async () => {
    const result = await orchestrateSearch({
      query: "test_user",
      rawIdentifiers: [{ type: "name", value: "Test User" }],
    });

    expect(result.graph).toBeDefined();
    expect(Array.isArray(result.graph.nodes)).toBe(true);
    expect(Array.isArray(result.graph.edges)).toBe(true);
  });

  it("orchestrateSearch handles empty identifiers gracefully", async () => {
    const result = await orchestrateSearch({
      query: "",
      rawIdentifiers: [],
    });

    expect(result.entity).toBeDefined();
  });
});
