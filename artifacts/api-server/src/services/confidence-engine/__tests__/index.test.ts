import { describe, expect, it } from "@jest/globals";
import { scoreConfidence } from "../index";

describe("confidenceEngine", () => {
  it("returns very_high when all factors are high", () => {
    const result = scoreConfidence({
      sourceAuthority: 0.95,
      consistency: 0.95,
      independence: 0.9,
      evidenceAgeDays: 1,
      corroborationCount: 10,
    });

    expect(result.level).toBe("very_high");
    expect(result.score).toBeGreaterThanOrEqual(0.9);
  });

  it("returns weak when all factors are low", () => {
    const result = scoreConfidence({
      sourceAuthority: 0.1,
      consistency: 0.1,
      independence: 0.1,
      evidenceAgeDays: 1000,
      corroborationCount: 0,
    });

    expect(result.level).toBe("weak");
    expect(result.score).toBeLessThan(0.35);
  });

  it("returns medium for mixed factors", () => {
    const result = scoreConfidence({
      sourceAuthority: 0.6,
      consistency: 0.6,
      independence: 0.5,
      evidenceAgeDays: 60,
      corroborationCount: 3,
    });

    expect(["medium", "high", "low"]).toContain(result.level);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
  });

  it("decays confidence with older evidence", () => {
    const fresh = scoreConfidence({ sourceAuthority: 0.8, consistency: 0.8, evidenceAgeDays: 1 });
    const old = scoreConfidence({ sourceAuthority: 0.8, consistency: 0.8, evidenceAgeDays: 500 });

    expect(old.score).toBeLessThan(fresh.score);
    expect(old.factors.recency).toBeLessThan(fresh.factors.recency);
  });

  it("generates arabic explanation text when lang is ar", () => {
    const result = scoreConfidence({ sourceAuthority: 0.9, consistency: 0.9, lang: "ar" });

    expect(result.explanationAr).toMatch(/درجة الثقة/);
    expect(result.explanationAr).toMatch(/%/);
  });

  it("generates english explanation when lang is en", () => {
    const result = scoreConfidence({ sourceAuthority: 0.9, consistency: 0.9, lang: "en" });

    expect(result.explanation).toMatch(/Confidence/);
    expect(result.explanation).toMatch(/%/);
  });

  it("returns default medium score when no factors provided", () => {
    const result = scoreConfidence({});

    expect(result.score).toBeGreaterThanOrEqual(0.3);
    expect(result.level).toBeDefined();
    expect(result.factors.source_authority).toBe(0.5);
    expect(result.factors.evidence_consistency).toBe(0.5);
  });

  it("clamps negative values to 0", () => {
    const result = scoreConfidence({ sourceAuthority: -1, consistency: -1 });

    expect(result.factors.source_authority).toBe(0);
    expect(result.factors.evidence_consistency).toBe(0);
  });

  it("clamps values above 1 to 1", () => {
    const result = scoreConfidence({ sourceAuthority: 5, consistency: 5 });

    expect(result.factors.source_authority).toBe(1);
    expect(result.factors.evidence_consistency).toBe(1);
  });

  it("capping score at 0.99 max", () => {
    const result = scoreConfidence({
      sourceAuthority: 1,
      consistency: 1,
      independence: 1,
      evidenceAgeDays: 0,
      corroborationCount: 100,
    });

    expect(result.score).toBeLessThanOrEqual(0.99);
  });

  it("includes corroboration_count in factors", () => {
    const result = scoreConfidence({ corroborationCount: 5 });

    expect(result.factors.corroboration_count).toBeGreaterThan(0);
  });

  it("handles missing factors gracefully (undefined)", () => {
    const result = scoreConfidence({ sourceAuthority: undefined as any });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.level).toBeDefined();
  });
});
