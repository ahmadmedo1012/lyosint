import { describe, it, expect } from '@jest/globals';
import {
  EvidenceWeights,
  EvidenceScore,
  DetailedEvidenceTracker,
} from '../evidenceModel';

describe('Evidence Model', () => {
  describe('EvidenceWeights Initialization', () => {
    it('should initialize with all weight properties', () => {
      const weights = new EvidenceWeights();

      // Exact matches
      expect(weights.emailExactMatch).toBe(0.3);
      expect(weights.usernameExactMatch).toBe(0.25);
      expect(weights.phoneExactMatch).toBe(0.28);
      expect(weights.websiteMatch).toBe(0.22);

      // Partial/similarity matches
      expect(weights.displayNameSimilarity).toBe(0.15);
      expect(weights.nameTokenOverlap).toBe(0.12);
      expect(weights.bioTextOverlap).toBe(0.1);
      expect(weights.locationMatch).toBe(0.09);

      // Other matches
      expect(weights.profileImageMatch).toBe(0.2);
      expect(weights.verifiedMatch).toBe(0.05);
    });

    it('should initialize with all penalty properties', () => {
      const weights = new EvidenceWeights();

      expect(weights.penaltyConflictingName).toBe(0.15);
      expect(weights.penaltyConflictingLocation).toBe(0.08);
      expect(weights.penaltyConflictingVerified).toBe(0.05);
    });

    it('should initialize with all confidence thresholds', () => {
      const weights = new EvidenceWeights();

      expect(weights.MAX_SCORE).toBe(0.97);
      expect(weights.VERY_HIGH).toBe(0.75);
      expect(weights.HIGH).toBe(0.6);
      expect(weights.MEDIUM).toBe(0.4);
      expect(weights.LOW).toBe(0.2);
      expect(weights.WEAK).toBe(0.1);
    });
  });

  describe('EvidenceScore Factor Accumulation', () => {
    it('should start with zero score and zero factors', () => {
      const score = new EvidenceScore();

      expect(score.totalScore()).toBe(0);
      expect(score.getFactorCount()).toBe(0);
    });

    it('should add a single factor and calculate score', () => {
      const score = new EvidenceScore();

      score.addFactor('emailMatch', 0.3);

      expect(score.totalScore()).toBe(0.3);
      expect(score.getFactorCount()).toBe(1);
    });

    it('should accumulate multiple factors', () => {
      const score = new EvidenceScore();

      score.addFactor('emailMatch', 0.3);
      score.addFactor('usernameMatch', 0.25);
      score.addFactor('phoneMatch', 0.28);

      expect(score.totalScore()).toBeCloseTo(0.83, 5);
      expect(score.getFactorCount()).toBe(3);
    });

    it('should reject factors outside 0-1 range', () => {
      const score = new EvidenceScore();

      expect(() => score.addFactor('invalid', 1.5)).toThrow();
      expect(() => score.addFactor('invalid', -0.1)).toThrow();
    });

    it('should accept factors at boundaries (0 and 1)', () => {
      const score = new EvidenceScore();

      score.addFactor('factor1', 0);
      score.addFactor('factor2', 1);

      // Score of 1 gets capped at MAX_SCORE (0.97)
      expect(score.totalScore()).toBe(0.97);
      expect(score.getFactorCount()).toBe(2);
    });
  });

  describe('EvidenceScore Penalty Application', () => {
    it('should apply a single penalty', () => {
      const score = new EvidenceScore();

      score.addFactor('emailMatch', 0.5);
      score.addPenalty('conflictingName', 0.1);

      expect(score.totalScore()).toBeCloseTo(0.4, 5);
      expect(score.getFactorCount()).toBe(2);
    });

    it('should accumulate multiple penalties', () => {
      const score = new EvidenceScore();

      score.addFactor('emailMatch', 0.8);
      score.addFactor('usernameMatch', 0.7);
      score.addPenalty('conflictingName', 0.15);
      score.addPenalty('conflictingLocation', 0.08);

      // 0.8 + 0.7 - 0.15 - 0.08 = 1.27, capped at MAX_SCORE (0.97)
      expect(score.totalScore()).toBeCloseTo(0.97, 5);
      expect(score.getFactorCount()).toBe(4);
    });

    it('should reject penalties outside 0-1 range', () => {
      const score = new EvidenceScore();

      expect(() => score.addPenalty('invalid', 1.5)).toThrow();
      expect(() => score.addPenalty('invalid', -0.1)).toThrow();
    });

    it('should never return negative score (floored at 0)', () => {
      const score = new EvidenceScore();

      score.addFactor('factor', 0.1);
      score.addPenalty('penalty1', 0.08);
      score.addPenalty('penalty2', 0.05);

      expect(score.totalScore()).toBe(0);
    });
  });

  describe('EvidenceScore Capping at MAX_SCORE', () => {
    it('should cap score at MAX_SCORE (0.97)', () => {
      const score = new EvidenceScore();

      score.addFactor('factor1', 0.4);
      score.addFactor('factor2', 0.4);
      score.addFactor('factor3', 0.3);

      // Sum would be 1.1, but capped at 0.97
      expect(score.totalScore()).toBe(0.97);
    });

    it('should allow score up to MAX_SCORE without capping', () => {
      const score = new EvidenceScore();

      score.addFactor('factor1', 0.5);
      score.addFactor('factor2', 0.47);

      expect(score.totalScore()).toBe(0.97);
    });

    it('should cap after penalty deduction if still exceeds MAX_SCORE', () => {
      const score = new EvidenceScore();

      score.addFactor('factor1', 0.9);
      score.addFactor('factor2', 0.3);
      score.addPenalty('penalty', 0.1);

      // 0.9 + 0.3 - 0.1 = 1.1, capped at 0.97
      expect(score.totalScore()).toBe(0.97);
    });
  });

  describe('EvidenceScore Confidence Level Determination', () => {
    it('should return "very_high" for score >= 0.75', () => {
      const score = new EvidenceScore();
      score.addFactor('factor', 0.75);

      expect(score.getConfidenceLevel()).toBe('very_high');
    });

    it('should return "high" for score >= 0.6 and < 0.75', () => {
      const score = new EvidenceScore();
      score.addFactor('factor', 0.65);

      expect(score.getConfidenceLevel()).toBe('high');
    });

    it('should return "medium" for score >= 0.4 and < 0.6', () => {
      const score = new EvidenceScore();
      score.addFactor('factor', 0.5);

      expect(score.getConfidenceLevel()).toBe('medium');
    });

    it('should return "low" for score >= 0.2 and < 0.4', () => {
      const score = new EvidenceScore();
      score.addFactor('factor', 0.3);

      expect(score.getConfidenceLevel()).toBe('low');
    });

    it('should return "very_low" for score >= 0.1 and < 0.2', () => {
      const score = new EvidenceScore();
      score.addFactor('factor', 0.15);

      expect(score.getConfidenceLevel()).toBe('very_low');
    });

    it('should return "uncertain" for score < 0.1', () => {
      const score = new EvidenceScore();
      score.addFactor('factor', 0.05);

      expect(score.getConfidenceLevel()).toBe('uncertain');
    });

    it('should return "uncertain" for zero score', () => {
      const score = new EvidenceScore();

      expect(score.getConfidenceLevel()).toBe('uncertain');
    });
  });

  describe('EvidenceScore Display Percentage', () => {
    it('should format score as percentage with two decimals', () => {
      const score = new EvidenceScore();
      score.addFactor('factor', 0.5);

      expect(score.getDisplayPercentage()).toBe('50.00%');
    });

    it('should format 0 score as "0.00%"', () => {
      const score = new EvidenceScore();

      expect(score.getDisplayPercentage()).toBe('0.00%');
    });

    it('should format MAX_SCORE as "97.00%"', () => {
      const score = new EvidenceScore();
      score.addFactor('factor1', 0.5);
      score.addFactor('factor2', 0.5);

      expect(score.getDisplayPercentage()).toBe('97.00%');
    });

    it('should format decimal scores correctly', () => {
      const score = new EvidenceScore();
      score.addFactor('factor', 0.3456);

      expect(score.getDisplayPercentage()).toBe('34.56%');
    });
  });

  describe('EvidenceScore Summary', () => {
    it('should return summary object with all required fields', () => {
      const score = new EvidenceScore();
      score.addFactor('emailMatch', 0.3);
      score.addFactor('usernameMatch', 0.25);

      const summary = score.getSummary();

      expect(summary).toHaveProperty('score');
      expect(summary).toHaveProperty('percentage');
      expect(summary).toHaveProperty('level');
      expect(summary).toHaveProperty('factorCount');
    });

    it('should populate summary with correct values', () => {
      const score = new EvidenceScore();
      score.addFactor('emailMatch', 0.3);
      score.addFactor('usernameMatch', 0.25);

      const summary = score.getSummary();

      expect(summary.score).toBeCloseTo(0.55, 5);
      expect(summary.percentage).toBe('55.00%');
      expect(summary.level).toBe('medium');
      expect(summary.factorCount).toBe(2);
    });
  });

  describe('DetailedEvidenceTracker Initialization', () => {
    it('should initialize with empty evidence list', () => {
      const tracker = new DetailedEvidenceTracker();

      expect(tracker.getEvidence()).toEqual([]);
    });
  });

  describe('DetailedEvidenceTracker Adding Evidence', () => {
    it('should add a single evidence item', () => {
      const tracker = new DetailedEvidenceTracker();

      tracker.addEvidence(
        'emailMatch',
        0.3,
        1.0,
        'Exact email match',
        { email: 'test@example.com' }
      );

      const evidence = tracker.getEvidence();
      expect(evidence).toHaveLength(1);
      expect(evidence[0].type).toBe('emailMatch');
      expect(evidence[0].weight).toBe(0.3);
    });

    it('should accumulate multiple evidence items', () => {
      const tracker = new DetailedEvidenceTracker();

      tracker.addEvidence('emailMatch', 0.3, 1.0, 'Email match', {});
      tracker.addEvidence('usernameMatch', 0.25, 0.9, 'Username match', {});
      tracker.addEvidence('phoneMatch', 0.28, 0.85, 'Phone match', {});

      expect(tracker.getEvidence()).toHaveLength(3);
    });

    it('should store all evidence fields correctly', () => {
      const tracker = new DetailedEvidenceTracker();
      const data = { field1: 'value1', field2: 123 };

      tracker.addEvidence('testType', 0.5, 0.8, 'Test description', data);

      const evidence = tracker.getEvidence();
      expect(evidence[0].type).toBe('testType');
      expect(evidence[0].weight).toBe(0.5);
      expect(evidence[0].score).toBe(0.8);
      expect(evidence[0].description).toBe('Test description');
      expect(evidence[0].data).toEqual(data);
    });
  });

  describe('DetailedEvidenceTracker Sorting', () => {
    it('should return evidence sorted by weight descending', () => {
      const tracker = new DetailedEvidenceTracker();

      tracker.addEvidence('factor1', 0.1, 1.0, 'Low weight', {});
      tracker.addEvidence('factor2', 0.5, 1.0, 'Medium weight', {});
      tracker.addEvidence('factor3', 0.3, 1.0, 'Medium-low weight', {});
      tracker.addEvidence('factor4', 0.8, 1.0, 'High weight', {});

      const sorted = tracker.getSortedByWeight();

      expect(sorted[0].weight).toBe(0.8);
      expect(sorted[1].weight).toBe(0.5);
      expect(sorted[2].weight).toBe(0.3);
      expect(sorted[3].weight).toBe(0.1);
    });

    it('should not modify original evidence order', () => {
      const tracker = new DetailedEvidenceTracker();

      tracker.addEvidence('factor1', 0.1, 1.0, 'Low', {});
      tracker.addEvidence('factor2', 0.5, 1.0, 'High', {});

      const original = tracker.getEvidence();
      const sorted = tracker.getSortedByWeight();

      expect(original[0].weight).toBe(0.1);
      expect(original[1].weight).toBe(0.5);
      expect(sorted[0].weight).toBe(0.5);
      expect(sorted[1].weight).toBe(0.1);
    });
  });

  describe('DetailedEvidenceTracker Top Evidence', () => {
    it('should return top N evidence items by weight', () => {
      const tracker = new DetailedEvidenceTracker();

      tracker.addEvidence('factor1', 0.1, 1.0, 'Low', {});
      tracker.addEvidence('factor2', 0.5, 1.0, 'Medium', {});
      tracker.addEvidence('factor3', 0.3, 1.0, 'Med-low', {});
      tracker.addEvidence('factor4', 0.8, 1.0, 'High', {});
      tracker.addEvidence('factor5', 0.4, 1.0, 'Med', {});

      const top3 = tracker.getTopEvidence(3);

      expect(top3).toHaveLength(3);
      expect(top3[0].weight).toBe(0.8);
      expect(top3[1].weight).toBe(0.5);
      expect(top3[2].weight).toBe(0.4);
    });

    it('should return all evidence if N exceeds list length', () => {
      const tracker = new DetailedEvidenceTracker();

      tracker.addEvidence('factor1', 0.1, 1.0, 'Low', {});
      tracker.addEvidence('factor2', 0.5, 1.0, 'High', {});

      const top10 = tracker.getTopEvidence(10);

      expect(top10).toHaveLength(2);
    });

    it('should return empty list if N is 0', () => {
      const tracker = new DetailedEvidenceTracker();

      tracker.addEvidence('factor1', 0.1, 1.0, 'Low', {});

      const top0 = tracker.getTopEvidence(0);

      expect(top0).toHaveLength(0);
    });

    it('should return empty list if no evidence added', () => {
      const tracker = new DetailedEvidenceTracker();

      const topAny = tracker.getTopEvidence(5);

      expect(topAny).toHaveLength(0);
    });
  });
});
