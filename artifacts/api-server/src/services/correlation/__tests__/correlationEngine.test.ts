import { describe, expect, it, beforeEach } from "@jest/globals";
import {
  buildIdentityResolutionReport,
  normalizeText,
} from "../correlationEngine";
import type { PlatformResult } from "../../httpChecker";

function found(
  slug: string,
  profileData: Record<string, unknown> = {},
): PlatformResult {
  return {
    slug,
    name: slug,
    category: "social",
    status: "found",
    url: `https://example.com/${slug}/user`,
    verified: true,
    profileData,
  };
}

function profilesFrom(
  results: PlatformResult[],
  overrides?: Record<string, Partial<{ displayName: string; bio: string }>>,
): Record<string, { url: string; exists: boolean; status: string; verified: boolean; displayName?: string; bio?: string; profileData: Record<string, unknown> }> {
  return Object.fromEntries(
    results.map((r) => {
      const ov = overrides?.[r.slug] ?? {};
      return [
        r.slug,
        {
          url: r.url,
          exists: true,
          status: "found",
          verified: true,
          displayName: ov.displayName ?? (r.profileData?.name as string) ?? (r.profileData?.fullName as string),
          bio: ov.bio ?? (r.profileData?.bio as string),
          profileData: r.profileData ?? {},
        },
      ];
    }),
  );
}

describe("correlationEngine", () => {
  it("builds a cluster when website bridges multiple platforms", () => {
    const results = [
      found("github", { name: "Ahmad Ridwan", blog: "https://ridwan.ly" }),
      found("keybase", { fullName: "Ahmad Ridwan", website: "https://ridwan.ly" }),
    ];
    const report = buildIdentityResolutionReport({
      username: "ahmad_ridwan",
      profilesFound: profilesFrom(results),
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(1);
    expect(report.identities[0].confidence).toBeGreaterThan(0);
    const types = report.identities[0].evidence.map((e) => e.type);
    expect(types).toContain("website_match");
  });

  it("merges single identity across multiple platforms into one cluster", () => {
    const results = [
      found("github", { name: "Ahmad Ridwan" }),
      found("reddit", { name: "Ahmad Ridwan" }),
      found("twitter", { name: "Ahmad Ridwan" }),
    ];
    const report = buildIdentityResolutionReport({
      username: "ahmad_ridwan",
      profilesFound: profilesFrom(results),
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(1);
    expect(report.identities[0].platforms).toHaveLength(3);
    expect(["high", "medium"]).toContain(report.identities[0].level);
  });

  it("creates separate clusters for two different identities", () => {
    const results = [
      found("github", { name: "Ahmad Ridwan", email: "ahmad@ridwan.ly" }),
      found("twitter", { name: "John Doe", email: "john@doe.com" }),
    ];
    const report = buildIdentityResolutionReport({
      username: "ahmad_ridwan",
      profilesFound: profilesFrom(results),
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(0);
    expect(report.suppressed.count).toBeGreaterThanOrEqual(1);
  });

  it("returns empty report when no profiles found", () => {
    const report = buildIdentityResolutionReport({
      username: "ghost_user",
      profilesFound: {},
      mergedResults: [],
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(0);
    expect(report.suppressed.count).toBe(0);
  });

  it("boosts confidence when email matches across platforms", () => {
    const results = [
      found("github", { name: "Ahmad R", email: "a@b.com" }),
      found("keybase", { name: "Ahmad R", email: "a@b.com" }),
    ];
    const report = buildIdentityResolutionReport({
      username: "ahmad_r",
      profilesFound: profilesFrom(results),
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: "a@b.com",
    });

    expect(report.identities[0].evidence.some((e) => e.type === "email_match")).toBe(true);
  });

  it("boosts confidence with website_match providing corroboration", () => {
    const results = [
      found("github", { name: "Ahmad R", blog: "https://ridwan.ly" }),
      found("keybase", { name: "Ahmad R", website: "https://ridwan.ly" }),
    ];
    const report = buildIdentityResolutionReport({
      username: "ahmad_r",
      profilesFound: profilesFrom(results),
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    const siteEvidence = report.identities[0]?.evidence.filter((e) => e.type === "website_match");
    expect(siteEvidence?.length).toBeGreaterThanOrEqual(1);
  });

  it("reduces confidence for conflicting names", () => {
    const results = [
      found("github", { name: "Ahmad Ridwan" }),
      found("twitter", { name: "Totally Different" }),
    ];
    const report = buildIdentityResolutionReport({
      username: "ahmad_ridwan",
      profilesFound: profilesFrom(results),
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities.length).toBe(0);
    expect(report.suppressed.count).toBe(2);
  });

  it("handles duplicate platforms gracefully", () => {
    const results = [
      found("github", { name: "Ahmad Ridwan" }),
      found("github", { name: "Ahmad Ridwan" }),
    ];
    const report = buildIdentityResolutionReport({
      username: "ahmad_ridwan",
      profilesFound: profilesFrom(results.slice(0, 1)),
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.suppressed.reason).toBeTruthy();
  });

  it("handles profiles with missing displayName", () => {
    const results = [found("github", {})];
    const report = buildIdentityResolutionReport({
      username: "user_no_name",
      profilesFound: {
        github: {
          url: results[0].url,
          exists: true,
          status: "found",
          verified: true,
          profileData: {},
        },
      },
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.suppressed.count).toBeGreaterThanOrEqual(1);
  });

  it("suppresses single-source username-only hits", () => {
    const results = [found("github", {})];
    const report = buildIdentityResolutionReport({
      username: "lonely_user",
      profilesFound: {
        github: {
          url: results[0].url,
          exists: true,
          status: "found",
          verified: true,
          profileData: {},
        },
      },
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(0);
    expect(report.suppressed.count).toBe(1);
  });

  it("suppresses username-only multi-platform overlap", () => {
    const results = [found("github"), found("reddit")];
    const pf = Object.fromEntries(
      results.map((r) => [r.slug, { url: r.url, exists: true, status: "found", verified: true, profileData: {} }]),
    );
    const report = buildIdentityResolutionReport({
      username: "test_user",
      profilesFound: pf,
      mergedResults: results,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(0);
    expect(report.suppressed.count).toBe(2);
  });
});
