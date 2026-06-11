import { describe, expect, it, beforeEach } from "@jest/globals";
import {
  inferRelationships,
  getRelationshipsForEntity,
  getRelationship,
  removeRelationship,
  type Relationship,
} from "../index";
import { normalizeIdentifier, type NormalizedIdentifier, type RawIdentifier } from "../../entity-resolver/index";

function ident(raw: RawIdentifier): NormalizedIdentifier {
  return normalizeIdentifier(raw)!;
}

describe("relationshipEngine", () => {
  beforeEach(() => {
    const r = getRelationshipsForEntity("any");
    r.forEach((rel) => removeRelationship(rel.id));
  });

  it("infers same_identity when email is shared", () => {
    const myIdents = [ident({ type: "email", value: "shared@email.com" })];
    const existing = [
      { id: "entity-2", identifiers: [ident({ type: "email", value: "shared@email.com" })] },
    ];

    const result = inferRelationships("entity-1", myIdents, existing);
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].type).toBe("same_identity");
    expect(result.relationships[0].strength).toBeGreaterThanOrEqual(0.8);
    expect(result.autoMergePending).toBe(true);
  });

  it("infers same_identity when phone is shared", () => {
    const myIdents = [ident({ type: "phone", value: "+218911234567" })];
    const existing = [
      { id: "entity-2", identifiers: [ident({ type: "phone", value: "+218911234567" })] },
    ];

    const result = inferRelationships("entity-1", myIdents, existing, 0.85);
    expect(result.relationships[0].type).toBe("same_identity");
  });

  it("infers associated when username+name match", () => {
    const myIdents = [ident({ type: "username", value: "ahmad" }), ident({ type: "name", value: "Ahmad Ridwan" })];
    const existing = [
      {
        id: "entity-2",
        identifiers: [ident({ type: "username", value: "ahmad" }), ident({ type: "name", value: "Ahmad Ridwan" })],
      },
    ];

    const result = inferRelationships("entity-1", myIdents, existing);
    expect(result.relationships.length).toBeGreaterThanOrEqual(1);
    expect(result.autoMergePending).toBeDefined();
  });

  it("detects merge candidates above threshold", () => {
    const myIdents = [ident({ type: "email", value: "same@email.com" })];
    const existing = [
      { id: "entity-2", identifiers: [ident({ type: "email", value: "same@email.com" })] },
    ];

    const result = inferRelationships("entity-1", myIdents, existing, 0.5);
    expect(result.mergeCandidates).toHaveLength(1);
    expect(result.mergeCandidates[0].confidence).toBeGreaterThanOrEqual(0.5);
  });

  it("returns no relationships when no shared identifiers exist", () => {
    const myIdents = [ident({ type: "email", value: "me@a.com" })];
    const existing = [
      { id: "entity-2", identifiers: [ident({ type: "email", value: "other@b.com" })] },
    ];

    const result = inferRelationships("entity-1", myIdents, existing);
    expect(result.relationships).toHaveLength(0);
    expect(result.autoMergePending).toBe(false);
  });

  it("skips self-comparison", () => {
    const myIdents = [ident({ type: "email", value: "me@a.com" })];
    const existing = [
      { id: "entity-1", identifiers: [ident({ type: "email", value: "me@a.com" })] },
    ];

    const result = inferRelationships("entity-1", myIdents, existing);
    expect(result.relationships).toHaveLength(0);
  });

  it("handles conflicting evidence with low strength", () => {
    const myIdents = [ident({ type: "username", value: "user_a" })];
    const existing = [
      { id: "entity-2", identifiers: [ident({ type: "username", value: "user_b" })] },
    ];

    const result = inferRelationships("entity-1", myIdents, existing);
    expect(result.relationships).toHaveLength(0);
  });

  it("stores created relationships in store", () => {
    const myIdents = [ident({ type: "email", value: "shared@email.com" })];
    const existing = [
      { id: "entity-2", identifiers: [ident({ type: "email", value: "shared@email.com" })] },
    ];

    const result = inferRelationships("entity-1", myIdents, existing);
    const stored = getRelationship(result.relationships[0].id);
    expect(stored).toBeDefined();
    expect(stored!.sourceEntityId).toBe("entity-1");
  });

  it("getRelationshipsForEntity returns all for source or target", () => {
    const myIdents = [ident({ type: "email", value: "a@b.com" })];
    const existing = [
      { id: "entity-2", identifiers: [ident({ type: "email", value: "a@b.com" })] },
    ];
    inferRelationships("entity-1", myIdents, existing);

    const rels = getRelationshipsForEntity("entity-2");
    expect(rels.length).toBeGreaterThanOrEqual(1);
  });

  it("removeRelationship removes from store", () => {
    const myIdents = [ident({ type: "email", value: "x@y.com" })];
    const existing = [
      { id: "entity-2", identifiers: [ident({ type: "email", value: "x@y.com" })] },
    ];
    const result = inferRelationships("entity-1", myIdents, existing);

    removeRelationship(result.relationships[0].id);
    expect(getRelationship(result.relationships[0].id)).toBeUndefined();
  });
});
