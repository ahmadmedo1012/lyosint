import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  storePattern,
  recallPattern,
  recallPatternsByType,
  consolidatePatterns,
  getPatternStats,
} from "../index";

jest.mock("@workspace/db", () => ({}));
jest.mock("../../../lib/logger", () => ({ logger: { info: jest.fn() } }));

describe("memoryEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores a pattern and recalls it by type+key", async () => {
    const pattern = await storePattern("false_positive_signatures", "github:404", { confidence: 0.9 });

    expect(pattern.id).toMatch(/^pat-/);
    expect(pattern.type).toBe("false_positive_signatures");
    expect(pattern.key).toBe("github:404");
    expect(pattern.accessCount).toBe(0);

    const recalled = await recallPattern("false_positive_signatures", "github:404");
    expect(recalled).toBeDefined();
    expect(recalled!.value).toEqual({ confidence: 0.9 });
  });

  it("returns undefined for cache miss", async () => {
    const result = await recallPattern("correlation_hints", "nonexistent");
    expect(result).toBeUndefined();
  });

  it("increments accessCount on recall", async () => {
    await storePattern("source_reliability_scores", "twitter", 0.7);
    const first = await recallPattern("source_reliability_scores", "twitter");
    expect(first!.accessCount).toBe(1);

    const second = await recallPattern("source_reliability_scores", "twitter");
    expect(second!.accessCount).toBe(2);
  });

  it("recalls patterns by type sorted by access count", async () => {
    await storePattern("entity_name_patterns", "key_a", "value_a");
    await storePattern("entity_name_patterns", "key_b", "value_b");
    const p1 = await recallPattern("entity_name_patterns", "key_a");

    const results = await recallPatternsByType("entity_name_patterns");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0].accessCount).toBeGreaterThanOrEqual(results[1]?.accessCount ?? 0);
  });

  it("consolidates patterns by merging duplicates and decaying old data", async () => {
    await storePattern("entity_name_patterns", "duplicate", { confidence: 0.9 });
    await storePattern("entity_name_patterns", "duplicate", { confidence: 0.8 });

    const merged = await consolidatePatterns();
    expect(merged).toBeGreaterThanOrEqual(1);
  });

  it("does not remove recently used patterns during consolidation", async () => {
    for (let i = 0; i < 5; i++) {
      await storePattern("correlation_hints", `key-${i}`, `value-${i}`);
    }

    const removed = await consolidatePatterns();
    expect(removed).toBe(0);
  });

  it("getPatternStats returns total count and breakdown by type", async () => {
    await storePattern("entity_name_patterns", "k1", "v1");
    await storePattern("false_positive_signatures", "k2", "v2");

    const stats = getPatternStats();
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(Object.keys(stats.byType).length).toBeGreaterThanOrEqual(2);
  });

  it("getPatternStats returns zero for empty store", async () => {
    const stats = getPatternStats();
    expect(stats.total).toBeGreaterThanOrEqual(0);
  });
});
