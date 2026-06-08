import { randomUUID } from 'crypto';

/**
 * Type definition for Identity data used during initialization
 */
export interface IdentityData {
  source: string;
  username?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  bio?: string;
  website?: string;
  location?: string;
  profileUrl?: string;
  profileImageHash?: string;
  followers?: number;
  verified?: boolean;
  joinDate?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Represents a single identity from a platform
 * Automatically normalizes fields and generates a unique UUID
 */
export class Identity {
  readonly uuid: string;
  readonly source: string;
  readonly username?: string;
  readonly displayName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly bio?: string;
  readonly website?: string;
  readonly location?: string;
  readonly profileUrl?: string;
  readonly profileImageHash?: string;
  readonly followers?: number;
  readonly verified?: boolean;
  readonly joinDate?: Date;
  readonly metadata?: Record<string, unknown>;

  // Normalized fields
  readonly normalizedUsername: string;
  readonly normalizedEmail: string;
  readonly normalizedDisplayName: string;
  readonly normalizedBio: string;

  // Tokenized fields
  readonly nameTokens: Set<string>;
  readonly bioTokens: Set<string>;

  constructor(data: IdentityData) {
    this.uuid = randomUUID();
    this.source = data.source;
    this.username = data.username;
    this.displayName = data.displayName;
    this.email = data.email;
    this.phone = data.phone;
    this.bio = data.bio;
    this.website = data.website;
    this.location = data.location;
    this.profileUrl = data.profileUrl;
    this.profileImageHash = data.profileImageHash;
    this.followers = data.followers;
    this.verified = data.verified;
    this.joinDate = data.joinDate;
    this.metadata = data.metadata;

    // Normalize fields
    this.normalizedUsername = this.normalizeUsername(this.username || '');
    this.normalizedEmail = this.normalizeEmail(this.email || '');
    this.normalizedDisplayName = this.normalizeDisplayName(
      this.displayName || ''
    );
    this.normalizedBio = this.normalizeBio(this.bio || '');

    // Tokenize
    this.nameTokens = this.tokenize(this.displayName || this.username || '');
    this.bioTokens = this.tokenize(this.bio || '');
  }

  /**
   * Normalize username: lowercase + remove special chars + remove spaces
   */
  private normalizeUsername(username: string): string {
    return username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Normalize email: handle dot-normalization for Gmail addresses
   * For Gmail: a.b.c@gmail.com becomes abc@gmail.com
   * For other domains: no dot normalization
   */
  private normalizeEmail(email: string): string {
    const lowerEmail = email.toLowerCase().trim();

    if (lowerEmail.endsWith('@gmail.com')) {
      const [localPart, domain] = lowerEmail.split('@');
      const normalizedLocal = localPart.replace(/\./g, '');
      return `${normalizedLocal}@${domain}`;
    }

    return lowerEmail;
  }

  /**
   * Normalize display name: lowercase + remove special chars + remove spaces
   */
  private normalizeDisplayName(displayName: string): string {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Normalize bio: lowercase + remove special chars + remove spaces
   */
  private normalizeBio(bio: string): string {
    return bio
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Tokenize text into words: split on non-alphanumeric, filter tokens > 2 chars
   */
  private tokenize(text: string): Set<string> {
    const tokens = new Set<string>();

    if (!text) {
      return tokens;
    }

    const words = text.toLowerCase().split(/[^a-z0-9]+/);

    for (const word of words) {
      if (word.length > 2) {
        tokens.add(word);
      }
    }

    return tokens;
  }

  /**
   * Get profile image hash or compute from URL if needed
   */
  getProfileImageHash(): string | undefined {
    if (this.profileImageHash) {
      return this.profileImageHash;
    }

    // Could compute hash from URL here if needed
    return undefined;
  }
}

/**
 * Interface for correlation evidence between two identities
 */
export interface CorrelationEvidence {
  type: string; // e.g., 'username_match', 'email_match', 'display_name_match'
  score: number; // 0-1 confidence score
  identityA: Identity;
  identityB: Identity;
  evidence: string; // human-readable description
  metadata?: Record<string, unknown>;
}

/**
 * Represents a cluster of correlated identities
 */
export class IdentityCluster {
  readonly identities: Identity[];
  readonly evidence: CorrelationEvidence[];

  constructor(identities: Identity[]) {
    this.identities = identities;
    this.evidence = [];
  }

  /**
   * Add evidence of correlation between identities
   */
  addEvidence(ev: CorrelationEvidence): void {
    this.evidence.push(ev);
  }

  /**
   * Get all identities from a specific platform/source
   */
  getIdentitiesBySource(source: string): Identity[] {
    return this.identities.filter(identity => identity.source === source);
  }

  /**
   * Check if cluster has conflicting identities (2+ from same source)
   */
  hasConflictingIdentities(): boolean {
    const sourceGroups = new Map<string, number>();

    for (const identity of this.identities) {
      const count = sourceGroups.get(identity.source) || 0;
      sourceGroups.set(identity.source, count + 1);
    }

    for (const count of sourceGroups.values()) {
      if (count >= 2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate average confidence score from all evidence
   */
  getAverageConfidence(): number {
    if (this.evidence.length === 0) {
      return 0;
    }

    const sum = this.evidence.reduce((acc, ev) => acc + ev.score, 0);
    return sum / this.evidence.length;
  }
}
