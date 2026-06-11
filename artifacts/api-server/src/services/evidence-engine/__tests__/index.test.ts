import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  storeEvidence,
  getEvidence,
  queryEvidence,
  updateConfidence,
  verifyEvidence,
  evidenceSummary,
} from "../index";
import { scoreConfidence } from "../../confidence-engine/index";

jest.mock("@workspace/db", () => ({}));
jest.mock("../../../lib/logger", () => ({ logger: { info: jest.fn() } }));

let counter = 0;
function uid(prefix = "e"): string {
  counter++;
  return `${prefix}-${counter}-${Date.now()}`;
}

describe("evidenceEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores evidence and returns it with generated id", async () => {
    const eid = uid("entity");
    const item = await storeEvidence({
      entityId: eid,
      type: "profile",
      source: "github",
      sourceName: "GitHub",
      value: `ahmad_${uid()}`,
    });

    expect(item.id).toMatch(/^ev-/);
    expect(item.entityId).toBe(eid);
    expect(item.type).toBe("profile");
    expect(item.status).toBe("pending");
    expect(item.checksum).toBeTruthy();
  });

  it("deduplicates evidence with identical checksums", async () => {
    const eid = uid("entity");
    const val = `dedup_val_${uid()}`;
    const first = await storeEvidence({
      entityId: eid,
      type: "profile",
      source: "github",
      sourceName: "GitHub",
      value: val,
    });

    const second = await storeEvidence({
      entityId: eid,
      type: "profile",
      source: "github",
      sourceName: "GitHub",
      value: val,
    });

    expect(second.id).toBe(first.id);
    expect(second.checksum).toBe(first.checksum);
  });

  it("retrieves evidence by id", async () => {
    const stored = await storeEvidence({
      entityId: uid("entity"),
      type: "profile",
      source: "twitter",
      sourceName: "Twitter",
      value: `user_${uid()}`,
    });

    const retrieved = await getEvidence(stored.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(stored.id);
  });

  it("returns undefined for non-existent evidence", async () => {
    const result = await getEvidence("nonexistent");
    expect(result).toBeUndefined();
  });

  it("queries evidence by entityId", async () => {
    const e1 = uid("entity");
    const e2 = uid("entity");
    await storeEvidence({ entityId: e1, type: "profile", source: "s1", sourceName: "S1", value: `v_${uid()}` });
    await storeEvidence({ entityId: e2, type: "profile", source: "s2", sourceName: "S2", value: `v_${uid()}` });

    const results = await queryEvidence({ entityId: e1 });
    expect(results).toHaveLength(1);
    expect(results[0].entityId).toBe(e1);
  });

  it("queries evidence by type", async () => {
    const eid = uid("entity");
    await storeEvidence({ entityId: eid, type: "profile", source: "s1", sourceName: "UniqueSrc1", value: `pv_${uid()}` });
    await storeEvidence({ entityId: eid, type: "breach", source: "s2", sourceName: "UniqueSrc2", value: `bv_${uid()}` });

    const results = await queryEvidence({ entityId: eid, type: "breach" });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("breach");
  });

  it("queries evidence by source", async () => {
    const eid = uid("entity");
    await storeEvidence({ entityId: eid, type: "profile", source: "github", sourceName: "GitHub", value: `v_${uid()}` });
    await storeEvidence({ entityId: eid, type: "profile", source: "twitter", sourceName: "Twitter", value: `v_${uid()}` });

    const results = await queryEvidence({ source: "github" });
    expect(results.every((r) => r.source === "github")).toBe(true);
  });

  it("applies limit and offset in query", async () => {
    const eid = uid("entity");
    for (let i = 0; i < 5; i++) {
      await storeEvidence({
        entityId: eid, type: "profile", source: `s${i}`, sourceName: `S${i}`, value: `v_${uid()}`,
      });
    }

    const results = await queryEvidence({ entityId: eid, limit: 2, offset: 0 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("updates confidence with bayesian combination", async () => {
    const eid = uid("entity");
    const item = await storeEvidence({
      entityId: eid,
      type: "profile",
      source: "s1",
      sourceName: "S1",
      value: `cv_${uid()}`,
      confidence: scoreConfidence({ sourceAuthority: 0.3, consistency: 0.3 }),
    });

    const originalAuthority = item.confidence.factors.source_authority;

    const updated = await updateConfidence(
      item.id,
      scoreConfidence({ sourceAuthority: 0.95, consistency: 0.95 }),
    );

    expect(updated).toBeDefined();
    expect(updated!.confidence.score).toBeGreaterThan(0);
  });

  it("updateConfidence returns undefined for missing id", async () => {
    const result = await updateConfidence("nonexistent", scoreConfidence({}));
    expect(result).toBeUndefined();
  });

  it("verifies evidence", async () => {
    const eid = uid("entity");
    const item = await storeEvidence({
      entityId: eid, type: "profile", source: "s1", sourceName: "S1", value: `vv_${uid()}`,
    });

    const verified = await verifyEvidence(item.id);
    expect(verified!.status).toBe("verified");
    expect(verified!.verifiedAt).toBeTruthy();
  });

  it("verifyEvidence returns undefined for missing id", async () => {
    const result = await verifyEvidence("nonexistent");
    expect(result).toBeUndefined();
  });

  it("aggregates evidence summary", async () => {
    const eid = uid("entity");
    await storeEvidence({ entityId: eid, type: "profile", source: "github", sourceName: "GitHub", value: `v_${uid()}` });
    await storeEvidence({ entityId: eid, type: "breach", source: "hibp", sourceName: "HIBP", value: `v_${uid()}` });

    const summary = await evidenceSummary(eid);
    expect(summary.total).toBe(2);
    expect(summary.byType.profile).toBe(1);
    expect(summary.byType.breach).toBe(1);
    expect(summary.averageConfidence).toBeGreaterThan(0);
    expect(summary.sourcesList).toEqual(expect.arrayContaining(["GitHub", "HIBP"]));
  });

  it("evidenceSummary for non-existent entity returns empty", async () => {
    const summary = await evidenceSummary("no_such_entity");
    expect(summary.total).toBe(0);
    expect(summary.averageConfidence).toBe(0);
  });
});
