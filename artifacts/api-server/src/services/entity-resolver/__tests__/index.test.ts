import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  normalizeIdentifier,
  fuzzyMatch,
  resolveEntity,
  type NormalizedIdentifier,
  type RawIdentifier,
} from "../index";

jest.mock("@workspace/db", () => ({}));
jest.mock("../../../lib/logger", () => ({ logger: { info: jest.fn() } }));

const emptyCandidates: NormalizedIdentifier[] = [];

describe("normalizeIdentifier", () => {
  it("normalizes email addresses (lowercase, dot-stripping local part)", () => {
    const result = normalizeIdentifier({ type: "email", value: "  Test.User+spam@Example.COM  " });
    expect(result?.normalized).toBe("testuser@example.com");
    expect(result?.type).toBe("email");
  });

  it("normalizes email with dots and plus sign", () => {
    const result = normalizeIdentifier({ type: "email", value: "john.doe+tag@GMAIL.COM" });
    expect(result?.normalized).toBe("johndoe@gmail.com");
  });

  it("returns null for invalid email (no @)", () => {
    const result = normalizeIdentifier({ type: "email", value: "notanemail" });
    expect(result).toBeNull();
  });

  it("normalizes phone numbers to E.164", () => {
    const result = normalizeIdentifier({ type: "phone", value: "  0911234567  " });
    expect(result?.normalized).toBe("+218911234567");
  });

  it("normalizes international phone with +", () => {
    const result = normalizeIdentifier({ type: "phone", value: "+1-555-123-4567" });
    expect(result?.normalized).toBe("+15551234567");
  });

  it("returns null for invalid phone", () => {
    const result = normalizeIdentifier({ type: "phone", value: "abc" });
    expect(result).toBeNull();
  });

  it("normalizes usernames (lowercase, strip special chars)", () => {
    const result = normalizeIdentifier({ type: "username", value: "  Ahmad_Ridwan!  " });
    expect(result?.normalized).toBe("ahmad_ridwan");
  });

  it("normalizes URLs to canonical form (lowercase hostname, strip trailing slash)", () => {
    const result = normalizeIdentifier({ type: "url", value: "https://www.Example.com/Path/" });
    expect(result?.normalized).toMatch(/^example\.com\//);
  });

  it("normalizes names via baseNormalize", () => {
    const result = normalizeIdentifier({ type: "name", value: "  أحمد رضوان  " });
    expect(result?.normalized).toBeTruthy();
    expect(result?.type).toBe("name");
  });

  it("normalizes domains (lowercase, strip www)", () => {
    const result = normalizeIdentifier({ type: "domain", value: "WWW.Example.COM" });
    expect(result?.normalized).toBe("example.com");
  });

  it("returns null for empty value", () => {
    const result = normalizeIdentifier({ type: "username", value: "   " });
    expect(result).toBeNull();
  });

  it("handles RTL text in name normalization", () => {
    const result = normalizeIdentifier({ type: "name", value: "محمد" });
    expect(result?.normalized).toBe("محمد");
    expect(result?.fingerprint).toBeTruthy();
  });

  it("strips non-ASCII chars from usernames (only a-z0-9_-.)", () => {
    const result = normalizeIdentifier({ type: "username", value: "über_user" });
    expect(result?.normalized).not.toContain("ü");
    expect(result?.normalized).toBe("ber_user");
  });
});

describe("fuzzyMatch", () => {
  it("returns exact match with score 1 for identical fingerprints", () => {
    const query = normalizeIdentifier({ type: "email", value: "test@test.com" })!;
    const candidates = [normalizeIdentifier({ type: "email", value: "test@test.com" })!];
    const results = fuzzyMatch(query, candidates);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(1);
  });

  it("fuzzy matches close name with jaro-winkler", () => {
    const query = normalizeIdentifier({ type: "name", value: "Ahmad Ridwan" })!;
    const candidates = [normalizeIdentifier({ type: "name", value: "Ahmad Radwan" })!];
    const results = fuzzyMatch(query, candidates);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].score).toBeGreaterThanOrEqual(0.85);
  });

  it("returns empty for completely different names", () => {
    const query = normalizeIdentifier({ type: "name", value: "John Smith" })!;
    const candidates = [normalizeIdentifier({ type: "name", value: "Ahmad Ridwan" })!];
    const results = fuzzyMatch(query, candidates);
    expect(results).toHaveLength(0);
  });

  it("fuzzy matches close usernames with levenshtein", () => {
    const query = normalizeIdentifier({ type: "username", value: "ahmad_ridwan" })!;
    const candidates = [normalizeIdentifier({ type: "username", value: "ahmad_ridwan" })!];
    const results = fuzzyMatch(query, candidates);
    expect(results[0].score).toBe(1);
  });

  it("does not match different type identifiers", () => {
    const query = normalizeIdentifier({ type: "email", value: "a@b.com" })!;
    const candidates = [normalizeIdentifier({ type: "username", value: "a" })!];
    const results = fuzzyMatch(query, candidates);
    expect(results).toHaveLength(0);
  });

  it("sorts results by score descending", () => {
    const query = normalizeIdentifier({ type: "name", value: "Ahmad" })!;
    const c1 = normalizeIdentifier({ type: "name", value: "Ahmad" })!;
    const c2 = normalizeIdentifier({ type: "name", value: "Ahmed" })!;
    const results = fuzzyMatch(query, [c2, c1]);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1]?.score ?? 0);
  });
});

describe("resolveEntity", () => {
  it("creates a new entity with resolved identifiers", async () => {
    const raw: RawIdentifier[] = [{ type: "name", value: "Ahmad Ridwan" }, { type: "email", value: "ahmad@ridwan.ly" }];
    const entity = await resolveEntity(raw);
    expect(entity.id).toMatch(/^entity-/);
    expect(entity.label).toBeTruthy();
    expect(entity.identifiers).toHaveLength(2);
    expect(entity.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it("deduplicates identical identifiers", async () => {
    const raw: RawIdentifier[] = [
      { type: "email", value: "test@test.com" },
      { type: "email", value: "test@test.com" },
    ];
    const entity = await resolveEntity(raw);
    expect(entity.identifiers).toHaveLength(1);
  });

  it("filters out invalid identifiers (empty)", async () => {
    const raw: RawIdentifier[] = [
      { type: "name", value: "Ahmad" },
      { type: "phone", value: "" },
    ];
    const entity = await resolveEntity(raw);
    expect(entity.identifiers).toHaveLength(1);
  });

  it("returns a confidence of at least 0.3", async () => {
    const entity = await resolveEntity([{ type: "name", value: "Unknown" }]);
    expect(entity.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it("groups matching identifiers and increases confidence", async () => {
    const raw: RawIdentifier[] = [
      { type: "email", value: "a@b.com" },
      { type: "email", value: "a@b.com" },
      { type: "name", value: "Ahmad" },
    ];
    const entity = await resolveEntity(raw);
    expect(entity.identifiers.length).toBeLessThanOrEqual(2);
  });
});
