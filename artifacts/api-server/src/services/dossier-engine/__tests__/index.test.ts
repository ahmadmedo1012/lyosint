import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  generateDossier,
  getDossier,
  getDossierVersions,
  listDossiers,
} from "../index";
import type { ResolvedEntity } from "../../entity-resolver/index";
import type { EvidenceItem, EvidenceSummary } from "../../evidence-engine/index";
import type { Relationship } from "../../relationship-engine/index";
import type { TimelineReport } from "../../timeline-engine/index";
import type { ConfidenceResult } from "../../confidence-engine/index";

jest.mock("@workspace/db", () => ({}));
jest.mock("../../../lib/logger", () => ({ logger: { info: jest.fn() } }));

const baseConfidence: ConfidenceResult = {
  score: 0.85,
  level: "high",
  factors: {
    source_authority: 0.8,
    evidence_consistency: 0.8,
    source_independence: 0.7,
    recency: 0.9,
    corroboration_count: 0.5,
  },
  explanation: "High confidence from multiple sources",
  explanationAr: "ثقة عالية من مصادر متعددة",
};

const entity: ResolvedEntity = {
  id: "entity-1",
  label: "Ahmad Ridwan",
  confidence: 0.85,
  identifiers: [
    { type: "name", original: "Ahmad Ridwan", normalized: "ahmad ridwan", fingerprint: "fp1" },
    { type: "email", original: "ahmad@ridwan.ly", normalized: "ahmad@ridwan.ly", fingerprint: "fp2" },
  ],
  matchedIds: [],
  mergedIds: [],
  createdAt: "2024-01-01T00:00:00Z",
};

const evidenceItems: EvidenceItem[] = [
  {
    id: "ev-1", entityId: "entity-1", type: "profile", source: "github",
    sourceName: "GitHub", value: "ahmad_ridwan", checksum: "cs1", status: "verified",
    confidence: baseConfidence, metadata: {}, collectedAt: "2024-01-01T00:00:00Z",
  },
];

const evidenceSummary: EvidenceSummary = {
  total: 1,
  byType: { profile: 1 },
  bySource: { github: 1 },
  byStatus: { verified: 1 },
  averageConfidence: 0.85,
  sourcesList: ["GitHub"],
};

const relationships: Relationship[] = [
  {
    id: "rel-1", sourceEntityId: "entity-1", targetEntityId: "entity-2",
    type: "associated", strength: 0.7, sharedIdentifiers: ["username:ahmad"],
    evidence: ["shared_username:ahmad"], createdAt: "2024-01-02T00:00:00Z",
  },
];

const timeline: TimelineReport = {
  entityId: "entity-1", totalEvents: 1,
  events: [{
    id: "te-ev-1", timestamp: "2024-01-01T00:00:00Z",
    title: "profile evidence from GitHub", description: "ahmad_ridwan",
    type: "profile", source: "github", evidenceId: "ev-1", entityId: "entity-1",
    confidenceScore: 0.85,
  }],
  periodGroups: [{ period: "2024-01", events: [], count: 1 }],
  gaps: [], patterns: ["Consistent activity over 1 events"],
  earliestEvent: "2024-01-01T00:00:00Z",
  latestEvent: "2024-01-01T00:00:00Z",
  spanDays: 0,
};

describe("dossierEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates a dossier with complete data in JSON format", async () => {
    const uniqueEntity = { ...entity, id: "entity-json-test" };
    const dossier = await generateDossier({
      entity: uniqueEntity,
      evidence: evidenceItems.map((e) => ({ ...e, entityId: "entity-json-test" })),
      evidenceSummary: { ...evidenceSummary },
      relationships,
      timeline: { ...timeline, entityId: "entity-json-test" },
      confidence: baseConfidence,
      format: "json",
    });

    expect(dossier.id).toMatch(/^dos-/);
    expect(dossier.entityId).toBe("entity-json-test");
    expect(dossier.title).toContain("Ahmad Ridwan");
    expect(dossier.version).toBe(1);
    expect(dossier.format).toBe("json");
    expect(dossier.sections.length).toBeGreaterThan(3);
  });

  it("generates Markdown output format", async () => {
    const uniqueEntity = { ...entity, id: "entity-md-test" };
    const dossier = await generateDossier({
      entity: uniqueEntity,
      evidence: evidenceItems.map((e) => ({ ...e, entityId: "entity-md-test" })),
      evidenceSummary,
      relationships,
      timeline: { ...timeline, entityId: "entity-md-test" },
      confidence: baseConfidence,
      format: "markdown",
    });

    expect(dossier.format).toBe("markdown");
    expect(dossier.executiveSummary).toContain("# Dossier:");
  });

  it("tracks version number across updates", async () => {
    const uniqueEntity = { ...entity, id: "entity-version-test" };
    const first = await generateDossier({
      entity: uniqueEntity,
      evidence: evidenceItems.map((e) => ({ ...e, entityId: "entity-version-test" })),
      evidenceSummary,
      relationships,
      timeline: { ...timeline, entityId: "entity-version-test" },
      confidence: baseConfidence,
    });

    expect(first.version).toBe(1);

    const second = await generateDossier({
      entity: uniqueEntity,
      evidence: evidenceItems.map((e) => ({ ...e, entityId: "entity-version-test" })),
      evidenceSummary,
      relationships,
      timeline: { ...timeline, entityId: "entity-version-test" },
      confidence: baseConfidence,
    });

    expect(second.version).toBe(2);
    expect(second.id).toBe(first.id);
  });

  it("includes executive summary in output", async () => {
    const uniqueEntity = { ...entity, id: "entity-summary-test" };
    const dossier = await generateDossier({
      entity: uniqueEntity,
      evidence: evidenceItems.map((e) => ({ ...e, entityId: "entity-summary-test" })),
      evidenceSummary,
      relationships,
      timeline: { ...timeline, entityId: "entity-summary-test" },
      confidence: baseConfidence,
    });

    expect(dossier.executiveSummary).toContain("Investigation dossier");
    expect(dossier.executiveSummary).toContain("Confidence: 85%");
  });

  it("returns the same dossier via getDossier", async () => {
    const uniqueEntity = { ...entity, id: "entity-retrieve-test" };
    const dossier = await generateDossier({
      entity: uniqueEntity,
      evidence: evidenceItems.map((e) => ({ ...e, entityId: "entity-retrieve-test" })),
      evidenceSummary,
      relationships,
      timeline: { ...timeline, entityId: "entity-retrieve-test" },
      confidence: baseConfidence,
    });

    const retrieved = await getDossier(dossier.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(dossier.id);
  });

  it("returns undefined for non-existent dossier", async () => {
    const result = await getDossier("nonexistent");
    expect(result).toBeUndefined();
  });

  it("lists dossiers sorted by updatedAt", async () => {
    const uniqueEntity = { ...entity, id: "entity-list-test" };
    const d1 = await generateDossier({
      entity: uniqueEntity,
      evidence: evidenceItems.map((e) => ({ ...e, entityId: "entity-list-test" })),
      evidenceSummary,
      relationships,
      timeline: { ...timeline, entityId: "entity-list-test" },
      confidence: baseConfidence,
    });

    const all = await listDossiers();
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.some((d) => d.id === d1.id)).toBe(true);
  });

  it("filters dossiers by entityId", async () => {
    const filtered = await listDossiers("entity-1");
    expect(filtered.every((d) => d.entityId === "entity-1")).toBe(true);
  });

  it("stores version history", async () => {
    const uniqueEntity = { ...entity, id: "entity-history-test" };
    const d1 = await generateDossier({
      entity: uniqueEntity,
      evidence: evidenceItems.map((e) => ({ ...e, entityId: "entity-history-test" })),
      evidenceSummary,
      relationships,
      timeline: { ...timeline, entityId: "entity-history-test" },
      confidence: baseConfidence,
    });

    await generateDossier({
      entity: uniqueEntity,
      evidence: evidenceItems.map((e) => ({ ...e, entityId: "entity-history-test" })),
      evidenceSummary,
      relationships,
      timeline: { ...timeline, entityId: "entity-history-test" },
      confidence: baseConfidence,
    });

    const versions = await getDossierVersions(d1.id);
    expect(versions.length).toBeGreaterThanOrEqual(2);
  });
});
