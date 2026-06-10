export interface EvidenceInput {
  type: string;
  weight: number;
  polarity: "supporting" | "conflicting" | "caution";
  reliability?: number;
  freshnessDays?: number;
}

export interface ConfidenceResult {
  score: number;
  level: "confirmed" | "probable" | "possible" | "weak";
  breakdown: {
    evidence: number;
    reliability: number;
    corroboration: number;
    freshness: number;
    conflict: number;
  };
}

export function computeConfidence(evidenceItems: EvidenceInput[]): ConfidenceResult {
  if (evidenceItems.length === 0) {
    return { score: 0, level: "weak", breakdown: { evidence: 0, reliability: 0, corroboration: 0, freshness: 0, conflict: 0 } };
  }

  const supporting = evidenceItems.filter(e => e.polarity === "supporting");
  const conflicting = evidenceItems.filter(e => e.polarity === "conflicting");

  const evidenceScore = Math.min(
    supporting.reduce((sum, e) => sum + e.weight, 0) * 10,
    50
  );

  const reliability = supporting.length > 0
    ? supporting.reduce((sum, e) => sum + (e.reliability ?? 0.7), 0) / supporting.length * 20
    : 0;

  const corroboration = Math.min(
    supporting.length > 1 ? (supporting.length - 1) * 8 : 0,
    20
  );

  const avgFreshnessDays = supporting.length > 0
    ? supporting.reduce((sum, e) => sum + (e.freshnessDays ?? 30), 0) / supporting.length
    : 999;
  const freshness = avgFreshnessDays < 7 ? 10
    : avgFreshnessDays < 30 ? 8
    : avgFreshnessDays < 90 ? 5
    : avgFreshnessDays < 365 ? 2
    : 0;

  const conflict = Math.min(
    conflicting.reduce((sum, e) => sum + e.weight * 15, 0),
    30
  );

  const raw = evidenceScore + reliability + corroboration + freshness - conflict;
  const score = Math.min(100, Math.max(0, raw));

  const level: ConfidenceResult["level"] =
    score >= 90 ? "confirmed"
    : score >= 70 ? "probable"
    : score >= 50 ? "possible"
    : "weak";

  return {
    score: Math.round(score),
    level,
    breakdown: {
      evidence: Math.round(evidenceScore),
      reliability: Math.round(reliability),
      corroboration: Math.round(corroboration),
      freshness: Math.round(freshness),
      conflict: Math.round(conflict),
    },
  };
}

export function confidenceLevelLabel(level: ConfidenceResult["level"]): string {
  switch (level) {
    case "confirmed": return "مؤكد";
    case "probable": return "مرجح";
    case "possible": return "محتمل";
    case "weak": return "ضعيف";
  }
}

export function scoreToLevel(score: number): ConfidenceResult["level"] {
  if (score >= 90) return "confirmed";
  if (score >= 70) return "probable";
  if (score >= 50) return "possible";
  return "weak";
}
