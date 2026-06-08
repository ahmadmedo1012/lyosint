import { describe, it, expect } from '@jest/globals';
import {
  Identity,
  IdentityCluster,
  CorrelationEvidence,
} from '../identityModel';

describe('Identity Model', () => {
  describe('Identity Creation and Normalization', () => {
    it('should create an identity with basic fields', () => {
      const identity = new Identity({
        source: 'twitter',
        username: 'JohnDoe',
        displayName: 'John Doe',
        email: 'john@example.com',
        phone: '+1-555-0100',
        bio: 'Software Engineer',
        website: 'https://johndoe.com',
        location: 'New York, NY',
        profileUrl: 'https://twitter.com/johndoe',
        profileImageHash: 'abc123',
        followers: 1500,
        verified: true,
        joinDate: new Date('2020-01-15'),
        metadata: { custom: 'data' },
      });

      expect(identity.source).toBe('twitter');
      expect(identity.username).toBe('JohnDoe');
      expect(identity.displayName).toBe('John Doe');
      expect(identity.uuid).toBeDefined();
      expect(typeof identity.uuid).toBe('string');
    });

    it('should normalize username: lowercase and remove special chars/spaces', () => {
      const identity = new Identity({
        source: 'twitter',
        username: 'John_Doe-123!@#',
        displayName: 'John Doe',
        email: 'john@example.com',
      });

      expect(identity.normalizedUsername).toBe('johndoe123');
    });

    it('should normalize email with dot-normalization for Gmail', () => {
      const identity1 = new Identity({
        source: 'gmail',
        username: 'user1',
        email: 'a.b.c@gmail.com',
      });

      const identity2 = new Identity({
        source: 'gmail',
        username: 'user2',
        email: 'abc@gmail.com',
      });

      expect(identity1.normalizedEmail).toBe(identity2.normalizedEmail);
      expect(identity1.normalizedEmail).toBe('abc@gmail.com');
    });

    it('should normalize email for non-Gmail domains without dot-normalization', () => {
      const identity = new Identity({
        source: 'email',
        username: 'user',
        email: 'a.b.c@example.com',
      });

      expect(identity.normalizedEmail).toBe('a.b.c@example.com');
    });

    it('should normalize display name: lowercase, remove special chars and spaces', () => {
      const identity = new Identity({
        source: 'facebook',
        username: 'user123',
        displayName: 'John Doe-Smith!@#',
      });

      expect(identity.normalizedDisplayName).toBe('johndoesmith');
    });

    it('should normalize bio: lowercase, remove special chars and spaces', () => {
      const identity = new Identity({
        source: 'instagram',
        username: 'photouser',
        bio: 'I Love Photography! @2024 #Art-Works',
      });

      expect(identity.normalizedBio).toBe('ilovephotography2024artworks');
    });

    it('should tokenize name and bio into word sets (>2 char tokens only)', () => {
      const identity = new Identity({
        source: 'twitter',
        username: 'john_doe',
        displayName: 'John Doe Smith',
        bio: 'Software Engineer and Designer',
      });

      // Should have tokens from both name and bio, only >2 chars
      expect(identity.nameTokens.size).toBeGreaterThan(0);
      expect(identity.bioTokens.size).toBeGreaterThan(0);

      // Check that tokens don't include 2-char or smaller words
      identity.nameTokens.forEach(token => {
        expect(token.length).toBeGreaterThan(2);
      });

      identity.bioTokens.forEach(token => {
        expect(token.length).toBeGreaterThan(2);
      });

      // Check for expected tokens
      expect(identity.nameTokens.has('john')).toBe(true);
      expect(identity.nameTokens.has('smith')).toBe(true);
      expect(identity.bioTokens.has('software')).toBe(true);
      expect(identity.bioTokens.has('engineer')).toBe(true);
    });

    it('should generate unique UUIDs for different identities', () => {
      const identity1 = new Identity({
        source: 'twitter',
        username: 'user1',
      });

      const identity2 = new Identity({
        source: 'twitter',
        username: 'user2',
      });

      expect(identity1.uuid).not.toBe(identity2.uuid);
    });
  });

  describe('Profile Image Hash', () => {
    it('should return provided profile image hash', () => {
      const identity = new Identity({
        source: 'twitter',
        username: 'user',
        profileImageHash: 'hash123abc',
      });

      expect(identity.getProfileImageHash()).toBe('hash123abc');
    });

    it('should return undefined if no hash and no URL', () => {
      const identity = new Identity({
        source: 'twitter',
        username: 'user',
      });

      expect(identity.getProfileImageHash()).toBeUndefined();
    });
  });
});

describe('IdentityCluster', () => {
  describe('Cluster Creation and Evidence Management', () => {
    it('should create a cluster with multiple identities', () => {
      const identity1 = new Identity({
        source: 'twitter',
        username: 'john_doe',
      });

      const identity2 = new Identity({
        source: 'github',
        username: 'johndoe',
      });

      const cluster = new IdentityCluster([identity1, identity2]);

      expect(cluster.identities).toHaveLength(2);
      expect(cluster.evidence).toHaveLength(0);
    });

    it('should add evidence to the cluster', () => {
      const identity1 = new Identity({
        source: 'twitter',
        username: 'john_doe',
      });

      const identity2 = new Identity({
        source: 'github',
        username: 'johndoe',
      });

      const cluster = new IdentityCluster([identity1, identity2]);

      const evidence: CorrelationEvidence = {
        type: 'username_match',
        score: 0.95,
        identityA: identity1,
        identityB: identity2,
        evidence: 'Usernames are similar: john_doe vs johndoe',
      };

      cluster.addEvidence(evidence);

      expect(cluster.evidence).toHaveLength(1);
      expect(cluster.evidence[0].score).toBe(0.95);
    });

    it('should filter identities by source', () => {
      const identity1 = new Identity({
        source: 'twitter',
        username: 'user1',
      });

      const identity2 = new Identity({
        source: 'github',
        username: 'user2',
      });

      const identity3 = new Identity({
        source: 'twitter',
        username: 'user3',
      });

      const cluster = new IdentityCluster([identity1, identity2, identity3]);

      const twitterIdentities = cluster.getIdentitiesBySource('twitter');
      expect(twitterIdentities).toHaveLength(2);
      expect(twitterIdentities).toContain(identity1);
      expect(twitterIdentities).toContain(identity3);
    });

    it('should detect conflicting identities (2+ from same source)', () => {
      const identity1 = new Identity({
        source: 'twitter',
        username: 'user1',
      });

      const identity2 = new Identity({
        source: 'twitter',
        username: 'user2',
      });

      const identity3 = new Identity({
        source: 'github',
        username: 'user3',
      });

      // Cluster without conflicts
      const clusterNoConflict = new IdentityCluster([identity1, identity3]);
      expect(clusterNoConflict.hasConflictingIdentities()).toBe(false);

      // Cluster with conflicts
      const clusterWithConflict = new IdentityCluster([
        identity1,
        identity2,
        identity3,
      ]);
      expect(clusterWithConflict.hasConflictingIdentities()).toBe(true);
    });

    it('should calculate average confidence from evidence scores', () => {
      const identity1 = new Identity({
        source: 'twitter',
        username: 'user1',
      });

      const identity2 = new Identity({
        source: 'github',
        username: 'user2',
      });

      const identity3 = new Identity({
        source: 'linkedin',
        username: 'user3',
      });

      const cluster = new IdentityCluster([identity1, identity2, identity3]);

      cluster.addEvidence({
        type: 'username_match',
        score: 0.8,
        identityA: identity1,
        identityB: identity2,
        evidence: 'Test',
      });

      cluster.addEvidence({
        type: 'email_match',
        score: 0.95,
        identityA: identity2,
        identityB: identity3,
        evidence: 'Test',
      });

      cluster.addEvidence({
        type: 'name_match',
        score: 0.7,
        identityA: identity1,
        identityB: identity3,
        evidence: 'Test',
      });

      const avgConfidence = cluster.getAverageConfidence();
      expect(avgConfidence).toBe((0.8 + 0.95 + 0.7) / 3);
      expect(avgConfidence).toBeCloseTo(0.816666, 5);
    });

    it('should return 0 average confidence for empty evidence', () => {
      const identity1 = new Identity({
        source: 'twitter',
        username: 'user1',
      });

      const cluster = new IdentityCluster([identity1]);

      expect(cluster.getAverageConfidence()).toBe(0);
    });
  });
});
