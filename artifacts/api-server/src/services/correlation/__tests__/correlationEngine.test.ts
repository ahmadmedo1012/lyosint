import { describe, expect, it } from "@jest/globals";
import { buildIdentityResolutionReport } from "../correlationEngine";
import type { PlatformResult } from "../../httpChecker";

function found(slug: string, profileData: Record<string, unknown> = {}): PlatformResult {
  return {
    slug,
    name: slug,
    category: "social",
    status: "found",
    url: `https://example.com/${slug}/ahmad_ridwan`,
    verified: true,
    profileData,
  };
}

describe("correlationEngine", () => {
  it("builds a high-confidence cluster when username is corroborated by strong metadata", () => {
    const mergedResults = [
      found("github", {
        name: "Ahmad Ridwan",
        bio: "Security researcher in Tripoli",
        blog: "https://ridwan.ly",
        avatar: "https://cdn.example.com/avatar.jpg?size=200",
      }),
      found("keybase", {
        fullName: "Ahmad Ridwan",
        bio: "Security researcher",
        website: "https://ridwan.ly/about",
        image: "https://cdn.example.com/avatar.jpg",
      }),
    ];
    const profilesFound = Object.fromEntries(
      mergedResults.map((result) => [
        result.slug,
        {
          url: result.url,
          exists: true,
          status: "found",
          verified: true,
          displayName: (result.profileData as any).name ?? (result.profileData as any).fullName,
          bio: (result.profileData as any).bio,
          profileData: result.profileData,
        },
      ]),
    );

    const report = buildIdentityResolutionReport({
      username: "ahmad_ridwan",
      profilesFound,
      mergedResults,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(1);
    expect(report.identities[0].confidence).toBeGreaterThanOrEqual(0.75);
    expect(report.identities[0].evidence.map((e) => e.type)).toContain("website_match");
    expect(report.identities[0].evidence.map((e) => e.type)).toContain("profile_image_match");
  });

  it("suppresses unsupported single-source username hits", () => {
    const mergedResults = [found("github")];
    const profilesFound = {
      github: {
        url: mergedResults[0].url,
        exists: true,
        status: "found",
        verified: true,
        profileData: {},
      },
    };

    const report = buildIdentityResolutionReport({
      username: "ahmad_ridwan",
      profilesFound,
      mergedResults,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(0);
    expect(report.suppressed.count).toBe(1);
  });


  it("suppresses username-only multi-platform overlap", () => {
    const mergedResults = [found("github"), found("reddit")];
    const profilesFound = Object.fromEntries(
      mergedResults.map((result) => [
        result.slug,
        {
          url: result.url,
          exists: true,
          status: "found",
          verified: true,
          profileData: result.profileData,
        },
      ]),
    );

    const report = buildIdentityResolutionReport({
      username: "ahmad_ridwan",
      profilesFound,
      mergedResults,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(0);
    expect(report.suppressed.count).toBe(2);
  });

  it("separates conflicting names instead of clustering them on username alone", () => {
    const mergedResults = [
      found("github", { name: "Ahmad Ridwan" }),
      found("reddit", { name: "Different Person" }),
    ];
    const profilesFound = Object.fromEntries(
      mergedResults.map((result) => [
        result.slug,
        {
          url: result.url,
          exists: true,
          status: "found",
          verified: true,
          displayName: (result.profileData as any).name,
          profileData: result.profileData,
        },
      ]),
    );

    const report = buildIdentityResolutionReport({
      username: "ahmad_ridwan",
      profilesFound,
      mergedResults,
      maigret: null,
      twitch: null,
      githubProfile: null,
      possibleEmail: null,
    });

    expect(report.identities).toHaveLength(0);
    expect(report.suppressed.count).toBe(2);
  });
});
