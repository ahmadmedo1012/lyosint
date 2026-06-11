import { describe, expect, it } from "@jest/globals";
import { buildTimeline, type TimelineEvent, type TimelinePeriod } from "../index";
import type { EvidenceItem } from "../../evidence-engine/index";

const baseConfidence = { score: 0.8, level: "high" as const, factors: {
  source_authority: 0.8, evidence_consistency: 0.8, source_independence: 0.6, recency: 0.9, corroboration_count: 0.5,
}, explanation: "Test", explanationAr: "اختبار" };

function makeEvidence(
  id: string,
  entityId: string,
  type: EvidenceItem["type"],
  collectedAt: string,
  sourceName = "TestSource",
  source = "test",
  value = "test value",
): EvidenceItem {
  return {
    id,
    entityId,
    type,
    source,
    sourceName,
    value,
    checksum: `cs-${id}`,
    status: "verified",
    confidence: baseConfidence,
    metadata: {},
    collectedAt,
  };
}

describe("timelineEngine", () => {
  it("builds a chronological timeline from evidence", () => {
    const items = [
      makeEvidence("e1", "entity-1", "profile", "2024-01-03T00:00:00Z"),
      makeEvidence("e2", "entity-1", "profile", "2024-01-01T00:00:00Z"),
      makeEvidence("e3", "entity-1", "breach", "2024-01-02T00:00:00Z"),
    ];

    const report = buildTimeline("entity-1", items, "day");
    expect(report.totalEvents).toBe(3);
    expect(report.events[0].timestamp).toBe("2024-01-01T00:00:00Z");
    expect(report.events[1].timestamp).toBe("2024-01-02T00:00:00Z");
    expect(report.events[2].timestamp).toBe("2024-01-03T00:00:00Z");
  });

  it("groups events by specified period (month)", () => {
    const items = [
      makeEvidence("e1", "entity-1", "profile", "2024-01-15T00:00:00Z"),
      makeEvidence("e2", "entity-1", "profile", "2024-02-10T00:00:00Z"),
      makeEvidence("e3", "entity-1", "breach", "2024-01-20T00:00:00Z"),
    ];

    const report = buildTimeline("entity-1", items, "month");
    expect(report.periodGroups).toHaveLength(2);
    expect(report.periodGroups[0].period).toBe("2024-01");
    expect(report.periodGroups[1].period).toBe("2024-02");
  });

  it("groups events by week", () => {
    const items = [
      makeEvidence("e1", "entity-1", "profile", "2024-01-01T00:00:00Z"),
      makeEvidence("e2", "entity-1", "profile", "2024-01-08T00:00:00Z"),
    ];

    const report = buildTimeline("entity-1", items, "week");
    expect(report.periodGroups.length).toBeGreaterThanOrEqual(1);
  });

  it("groups events by year", () => {
    const items = [
      makeEvidence("e1", "entity-1", "profile", "2023-06-01T00:00:00Z"),
      makeEvidence("e2", "entity-1", "profile", "2024-06-01T00:00:00Z"),
    ];

    const report = buildTimeline("entity-1", items, "year");
    expect(report.periodGroups).toHaveLength(2);
    expect(report.periodGroups[0].period).toBe("2023");
    expect(report.periodGroups[1].period).toBe("2024");
  });

  it("detects gaps longer than 30 days", () => {
    const items = [
      makeEvidence("e1", "entity-1", "profile", "2024-01-01T00:00:00Z"),
      makeEvidence("e2", "entity-1", "profile", "2024-06-01T00:00:00Z"),
    ];

    const report = buildTimeline("entity-1", items, "month");
    expect(report.gaps.length).toBeGreaterThanOrEqual(1);
    expect(report.gaps[0].durationDays).toBeGreaterThan(30);
  });

  it("returns empty timeline for no evidence", () => {
    const report = buildTimeline("entity-1", [], "month");
    expect(report.totalEvents).toBe(0);
    expect(report.events).toHaveLength(0);
    expect(report.earliestEvent).toBeNull();
    expect(report.latestEvent).toBeNull();
    expect(report.spanDays).toBe(0);
  });

  it("handles single event correctly", () => {
    const items = [makeEvidence("e1", "entity-1", "profile", "2024-05-15T00:00:00Z")];
    const report = buildTimeline("entity-1", items, "month");

    expect(report.totalEvents).toBe(1);
    expect(report.earliestEvent).toBe(report.latestEvent);
    expect(report.spanDays).toBe(0);
  });

  it("handles duplicate dates as separate events", () => {
    const items = [
      makeEvidence("e1", "entity-1", "profile", "2024-01-01T00:00:00Z"),
      makeEvidence("e2", "entity-1", "breach", "2024-01-01T00:00:00Z"),
    ];

    const report = buildTimeline("entity-1", items, "day");
    expect(report.totalEvents).toBe(2);
    const groups = report.periodGroups.filter((g) => g.period === "2024-01-01");
    expect(groups[0].count).toBe(2);
  });

  it("identifies activity patterns with repeated event types", () => {
    const items = [
      makeEvidence("e1", "entity-1", "profile", "2024-01-01T00:00:00Z"),
      makeEvidence("e2", "entity-1", "profile", "2024-01-02T00:00:00Z"),
      makeEvidence("e3", "entity-1", "profile", "2024-01-03T00:00:00Z"),
    ];

    const report = buildTimeline("entity-1", items, "day");
    expect(report.patterns.length).toBeGreaterThanOrEqual(1);
    expect(report.patterns.some((p) => p.includes("Multiple profile"))).toBe(true);
  });

  it("ignores evidence without timestamps", () => {
    const noTs = makeEvidence("e1", "entity-1", "profile", "");
    const report = buildTimeline("entity-1", [noTs], "month");
    expect(report.totalEvents).toBe(0);
  });

  it("sets entityId correctly", () => {
    const items = [makeEvidence("e1", "entity-42", "profile", "2024-01-01T00:00:00Z")];
    const report = buildTimeline("entity-42", items, "month");
    expect(report.entityId).toBe("entity-42");
  });

  it("calculates spanDays correctly", () => {
    const items = [
      makeEvidence("e1", "entity-1", "profile", "2024-01-01T00:00:00Z"),
      makeEvidence("e2", "entity-1", "profile", "2024-01-31T00:00:00Z"),
    ];

    const report = buildTimeline("entity-1", items, "month");
    expect(report.spanDays).toBe(30);
  });
});
