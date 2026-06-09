/**
 * Evidence Model & Scoring Framework
 *
 * This module defines how evidence is weighted and how confidence scores
 * are calculated from evidence factors.
 */

/**
 * Stores hardcoded evidence weights and thresholds
 * Used for scoring identity correlations
 */
export class EvidenceWeights {
  // Exact matches - highest weight
  readonly emailExactMatch = 0.3;
  readonly usernameExactMatch = 0.25;
  readonly phoneExactMatch = 0.28;
  readonly websiteMatch = 0.22;

  // Partial/similarity matches
  readonly displayNameSimilarity = 0.15;
  readonly nameTokenOverlap = 0.12;
  readonly bioTextOverlap = 0.1;
  readonly locationMatch = 0.09;

  // Other matches
  readonly profileImageMatch = 0.2;
  readonly verifiedMatch = 0.05;

  // Penalties - reduce confidence for conflicting signals
  readonly penaltyConflictingName = 0.15;
  readonly penaltyConflictingLocation = 0.08;
  readonly penaltyConflictingVerified = 0.05;

  // Confidence score thresholds
  readonly MAX_SCORE = 0.97; // Maximum possible score
  readonly VERY_HIGH = 0.75; // >= 0.75
  readonly HIGH = 0.6; // >= 0.6
  readonly MEDIUM = 0.4; // >= 0.4
  readonly LOW = 0.2; // >= 0.2
  readonly WEAK = 0.1; // >= 0.1
  // < 0.1 is "uncertain"
}

/**
 * Represents a single piece of evidence
 */
export interface Evidence {
  type: string;
  weight: number;
  score: number; // 0-1 score for this particular evidence
  description: string;
  data?: Record<string, unknown>;
}

/**
 * Accumulates factors and penalties to calculate confidence scores
 * Handles score capping and confidence level determination
 */
export class EvidenceScore {
  private factors: Array<{ type: string; score: number }> = [];
  private penalties: Array<{ type: string; score: number }> = [];
  private weights = new EvidenceWeights();

  /**
   * Add a factor (positive evidence)
   * Score must be between 0 and 1
   */
  addFactor(type: string, score: number): void {
    if (score < 0 || score > 1) {
      throw new Error(`Factor score must be between 0 and 1, got ${score}`);
    }
    this.factors.push({ type, score });
  }

  /**
   * Add a penalty (negative evidence/conflicting signals)
   * Score must be between 0 and 1
   */
  addPenalty(type: string, score: number): void {
    if (score < 0 || score > 1) {
      throw new Error(`Penalty score must be between 0 and 1, got ${score}`);
    }
    this.penalties.push({ type, score });
  }

  /**
   * Get the total number of factors and penalties
   */
  getFactorCount(): number {
    return this.factors.length + this.penalties.length;
  }

  /**
   * Calculate total score: sum(factors) - sum(penalties)
   * Capped at MAX_SCORE and floored at 0
   */
  totalScore(): number {
    const factorSum = this.factors.reduce((sum, f) => sum + f.score, 0);
    const penaltySum = this.penalties.reduce((sum, p) => sum + p.score, 0);

    let score = factorSum - penaltySum;

    // Floor at 0
    if (score < 0) {
      score = 0;
    }

    // Cap at MAX_SCORE
    if (score > this.weights.MAX_SCORE) {
      score = this.weights.MAX_SCORE;
    }

    return score;
  }

  /**
   * Determine confidence level from score
   */
  getConfidenceLevel(): string {
    const score = this.totalScore();

    if (score >= this.weights.VERY_HIGH) {
      return 'very_high';
    }
    if (score >= this.weights.HIGH) {
      return 'high';
    }
    if (score >= this.weights.MEDIUM) {
      return 'medium';
    }
    if (score >= this.weights.LOW) {
      return 'low';
    }
    if (score >= this.weights.WEAK) {
      return 'very_low';
    }

    return 'uncertain';
  }

  /**
   * Get score as percentage string in "XX.XX%" format
   */
  getDisplayPercentage(): string {
    const percentage = this.totalScore() * 100;
    return `${percentage.toFixed(2)}%`;
  }

  /**
   * Get summary object with score, percentage, confidence level, and factor count
   */
  getSummary(): {
    score: number;
    percentage: string;
    level: string;
    factorCount: number;
  } {
    return {
      score: this.totalScore(),
      percentage: this.getDisplayPercentage(),
      level: this.getConfidenceLevel(),
      factorCount: this.getFactorCount(),
    };
  }
}

/**
 * Tracks individual evidence pieces with detailed information
 * Supports sorting and retrieval of top evidence
 */
export class DetailedEvidenceTracker {
  private evidence: Evidence[] = [];

  /**
   * Add a piece of evidence with all details
   */
  addEvidence(
    type: string,
    weight: number,
    score: number,
    description: string,
    data?: Record<string, unknown>
  ): void {
    this.evidence.push({
      type,
      weight,
      score,
      description,
      data,
    });
  }

  /**
   * Get all evidence items in the order they were added
   */
  getEvidence(): Evidence[] {
    return this.evidence;
  }

  /**
   * Get evidence sorted by weight in descending order (highest weight first)
   * Does not modify the original list
   */
  getSortedByWeight(): Evidence[] {
    return [...this.evidence].sort((a, b) => b.weight - a.weight);
  }

  /**
   * Get top N evidence items by weight
   * Returns items sorted by weight descending
   */
  getTopEvidence(n: number): Evidence[] {
    return this.getSortedByWeight().slice(0, n);
  }
}
