import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import {
  signAccessToken,
  signRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  refreshTokens,
  invalidateSession,
} from "../lib/session";

jest.mock("../lib/logger", () => ({ logger: { info: jest.fn(), debug: jest.fn() } }));

jest.mock("../lib/secrets", () => ({
  secrets: {
    JWT_SECRET: "test-jwt-secret-for-testing-only",
    JWT_REFRESH_SECRET: "test-refresh-secret-for-testing-only",
    ENCRYPTION_KEY: "test-encryption-key",
    DATABASE_URL: "sqlite://:memory:",
  },
}));

describe("auth", () => {
  const testPayload = { userId: "user-123", role: "user" as const };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("signs and verifies an access token", () => {
    const token = signAccessToken(testPayload);
    expect(typeof token).toBe("string");

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe("user-123");
    expect(decoded.role).toBe("user");
    expect(decoded.sessionId).toBeTruthy();
  });

  it("signs and verifies a refresh token", () => {
    const token = signRefreshToken(testPayload);
    expect(typeof token).toBe("string");

    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe("user-123");
  });

  it("generateTokens returns both access and refresh tokens", () => {
    const tokens = generateTokens(testPayload);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.expiresIn).toBe(15 * 60);

    const accessDecoded = verifyAccessToken(tokens.accessToken);
    expect(accessDecoded.userId).toBe("user-123");

    const refreshDecoded = verifyRefreshToken(tokens.refreshToken);
    expect(refreshDecoded.userId).toBe("user-123");
  });

  it("refreshTokens rotates tokens and invalidates old session", () => {
    const tokens = generateTokens(testPayload);
    const newTokens = refreshTokens(tokens.refreshToken);

    expect(newTokens.accessToken).not.toBe(tokens.accessToken);
    expect(newTokens.refreshToken).not.toBe(tokens.refreshToken);

    expect(() => verifyRefreshToken(tokens.refreshToken)).toThrow();
  });

  it("verifyAccessToken throws on expired tokens", () => {
    const expiredPayload = { userId: "user-1", role: "user" as const };

    const expiredToken = jwt.sign(
      { ...expiredPayload, sessionId: "test-session" },
      "test-jwt-secret-for-testing-only",
      { expiresIn: "0s" },
    );

    expect(() => verifyAccessToken(expiredToken)).toThrow();
  });

  it("verifyAccessToken throws on invalid token", () => {
    expect(() => verifyAccessToken("invalid-token-here")).toThrow();
  });

  it("invalidateSession prevents token reuse", () => {
    const token = signAccessToken(testPayload);
    const decoded = verifyAccessToken(token);

    invalidateSession(decoded.sessionId);
    expect(() => verifyAccessToken(token)).toThrow();
  });
});
