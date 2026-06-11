import type { NormalizedIdentifier } from "../entity-resolver/index";

export type RelationshipType =
  | "same_identity"
  | "associated"
  | "communicated"
  | "located_at"
  | "owns"
  | "works_at"
  | "family"
  | "colleague";

export interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  strength: number;
  sharedIdentifiers: string[];
  evidence: string[];
  createdAt: string;
}

export interface RelationshipInferenceResult {
  relationships: Relationship[];
  autoMergePending: boolean;
  mergeCandidates: Array<{ entityA: string; entityB: string; confidence: number }>;
}

const relationshipStore = new Map<string, Relationship>();

function generateId(): string {
  return `rel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const SHARED_IDENTIFIER_WEIGHTS: Record<string, number> = {
  email: 0.95,
  phone: 0.90,
  profile_image: 0.80,
  username: 0.60,
  display_name: 0.55,
  domain: 0.40,
  location: 0.25,
  source: 0.15,
};

export function inferRelationships(
  entityId: string,
  identifiers: NormalizedIdentifier[],
  existingEntities: Array<{ id: string; identifiers: NormalizedIdentifier[] }>,
  mergeThreshold: number = 0.85,
): RelationshipInferenceResult {
  const relationships: Relationship[] = [];
  const mergeCandidates: Array<{ entityA: string; entityB: string; confidence: number }> = [];

  for (const existing of existingEntities) {
    if (existing.id === entityId) continue;

    const shared: string[] = [];
    let totalStrength = 0;
    let maxPossible = 0;

    for (const myId of identifiers) {
      for (const theirId of existing.identifiers) {
        if (myId.type !== theirId.type) continue;
        const weight = SHARED_IDENTIFIER_WEIGHTS[myId.type] ?? 0.1;

        if (myId.fingerprint === theirId.fingerprint) {
          shared.push(`${myId.type}:${myId.normalized}`);
          totalStrength += weight;
        } else if (
          (myId.type === "username" || myId.type === "name")
          && myId.normalized.toLowerCase() === theirId.normalized.toLowerCase()
        ) {
          shared.push(`${myId.type}:${myId.normalized}`);
          totalStrength += weight * 0.7;
        }
        maxPossible += weight;
      }
    }

    if (shared.length === 0) continue;

    const strength = maxPossible > 0 ? totalStrength / maxPossible : 0;
    const relationshipType = determineRelationshipType(shared, strength);

    if (strength >= mergeThreshold) {
      mergeCandidates.push({ entityA: entityId, entityB: existing.id, confidence: strength });
    }

    relationships.push({
      id: generateId(),
      sourceEntityId: entityId,
      targetEntityId: existing.id,
      type: relationshipType,
      strength: Math.round(strength * 100) / 100,
      sharedIdentifiers: shared,
      evidence: shared.map((s) => `shared_${s}`),
      createdAt: new Date().toISOString(),
    });

    relationshipStore.set(relationships[relationships.length - 1].id, relationships[relationships.length - 1]);
  }

  return {
    relationships,
    autoMergePending: mergeCandidates.length > 0,
    mergeCandidates: mergeCandidates.map((m) => ({ ...m, confidence: Math.round(m.confidence * 100) / 100 })),
  };
}

function determineRelationshipType(shared: string[], strength: number): RelationshipType {
  const types = shared.map((s) => s.split(":")[0]);
  if (types.includes("email") || types.includes("phone")) {
    if (strength >= 0.8) return "same_identity";
    return "associated";
  }
  if (types.includes("domain") && types.includes("location")) return "works_at";
  if (types.includes("location") && strength >= 0.5) return "located_at";
  if (types.includes("username") && strength >= 0.6) return "associated";
  if (strength >= 0.4) return "colleague";
  return "associated";
}

export function getRelationshipsForEntity(entityId: string): Relationship[] {
  return [...relationshipStore.values()].filter(
    (r) => r.sourceEntityId === entityId || r.targetEntityId === entityId,
  );
}

export function getRelationship(id: string): Relationship | undefined {
  return relationshipStore.get(id);
}

export function removeRelationship(id: string): void {
  relationshipStore.delete(id);
}
