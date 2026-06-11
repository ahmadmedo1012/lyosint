export type ConfidenceLevel = "very_high" | "high" | "medium" | "low" | "weak";

export interface EvidenceFactor {
  source_authority: number;
  evidence_consistency: number;
  source_independence: number;
  recency: number;
  corroboration_count: number;
}

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  factors: EvidenceFactor;
  explanation: string;
  explanationAr: string;
}

const WEIGHTS = {
  source_authority: 0.30,
  evidence_consistency: 0.25,
  source_independence: 0.20,
  recency: 0.10,
  corroboration_count: 0.15,
} as const;

function decayWeight(ageDays: number, halfLifeDays: number = 90): number {
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function bayesianUpdate(prior: number, likelihood: number, evidenceStrength: number): number {
  const posterior = (prior * likelihood) / (prior * likelihood + (1 - prior) * (1 - likelihood));
  return posterior * evidenceStrength + (1 - evidenceStrength) * prior;
}

export function scoreConfidence(params: {
  sourceAuthority?: number;
  consistency?: number;
  independence?: number;
  evidenceAgeDays?: number;
  corroborationCount?: number;
  priorConfidence?: number;
  lang?: "ar" | "en";
}): ConfidenceResult {
  const sourceAuthority = Math.max(0, Math.min(1, params.sourceAuthority ?? 0.5));
  const consistency = Math.max(0, Math.min(1, params.consistency ?? 0.5));
  const independence = Math.max(0, Math.min(1, params.independence ?? 0.5));
  const evidenceAgeDays = Math.max(0, params.evidenceAgeDays ?? 0);
  const corroborationCount = Math.max(0, params.corroborationCount ?? 0);
  const priorConfidence = params.priorConfidence ?? 0.5;
  const lang = params.lang ?? "ar";

  const recencyWeight = decayWeight(evidenceAgeDays);
  const corroborationWeight = Math.min(1, corroborationCount * 0.1);

  const raw = bayesianUpdate(
    priorConfidence,
    sourceAuthority * WEIGHTS.source_authority
      + consistency * WEIGHTS.evidence_consistency
      + independence * WEIGHTS.source_independence
      + recencyWeight * WEIGHTS.recency
      + corroborationWeight * WEIGHTS.corroboration_count,
    0.85 + 0.15 * corroborationWeight,
  );

  const score = Math.round(Math.max(0, Math.min(0.99, raw)) * 100) / 100;

  const level: ConfidenceLevel =
    score >= 0.9 ? "very_high"
    : score >= 0.75 ? "high"
    : score >= 0.55 ? "medium"
    : score >= 0.35 ? "low"
    : "weak";

  const factors: EvidenceFactor = {
    source_authority: Math.round(sourceAuthority * 100) / 100,
    evidence_consistency: Math.round(consistency * 100) / 100,
    source_independence: Math.round(independence * 100) / 100,
    recency: Math.round(recencyWeight * 100) / 100,
    corroboration_count: Math.round(corroborationWeight * 100) / 100,
  };

  const explanationEn = buildExplanation(score, level, factors, "en");
  const explanationAr = buildExplanation(score, level, factors, "ar");

  return { score, level, factors, explanation: explanationEn, explanationAr };
}

function buildExplanation(score: number, level: ConfidenceLevel, factors: EvidenceFactor, lang: "ar" | "en"): string {
  if (lang === "ar") {
    const parts: string[] = [];
    if (factors.source_authority >= 0.7) parts.push("مصادر عالية الموثوقية");
    else if (factors.source_authority >= 0.4) parts.push("مصادر متوسطة الموثوقية");
    else parts.push("مصادر منخفضة الموثوقية");
    if (factors.evidence_consistency >= 0.7) parts.push("أدلة متسقة");
    else if (factors.evidence_consistency >= 0.4) parts.push("أدلة شبه متسقة");
    else parts.push("أدلة غير متسقة");
    if (factors.corroboration_count >= 0.5) parts.push("مؤكدة بمصادر متعددة");
    if (factors.recency < 0.5) parts.push("الأدلة قديمة");
    const levelMap: Record<ConfidenceLevel, string> = {
      very_high: "موثوقية عالية جداً",
      high: "موثوقية عالية",
      medium: "موثوقية متوسطة",
      low: "موثوقية منخفضة",
      weak: "موثوقية ضعيفة",
    };
    return `درجة الثقة ${Math.round(score * 100)}% — ${levelMap[level]}. ${parts.join("، ")}.`;
  }

  const parts: string[] = [];
  if (factors.source_authority >= 0.7) parts.push("high-authority sources");
  else if (factors.source_authority >= 0.4) parts.push("medium-authority sources");
  else parts.push("low-authority sources");
  if (factors.evidence_consistency >= 0.7) parts.push("consistent evidence");
  else if (factors.evidence_consistency >= 0.4) parts.push("partially consistent evidence");
  else parts.push("inconsistent evidence");
  if (factors.corroboration_count >= 0.5) parts.push("corroborated by multiple sources");
  if (factors.recency < 0.5) parts.push("aging evidence");
  const levelMap: Record<ConfidenceLevel, string> = {
    very_high: "very high confidence",
    high: "high confidence",
    medium: "medium confidence",
    low: "low confidence",
    weak: "weak confidence",
  };
  return `Confidence ${Math.round(score * 100)}% — ${levelMap[level]}. ${parts.join(", ")}.`;
}
