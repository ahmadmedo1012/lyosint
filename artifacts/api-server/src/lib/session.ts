import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { secrets } from "./secrets";
import { LRUCache } from "./cache";
import { logger } from "./logger";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const SESSION_CACHE_TTL = 5 * 60 * 1000;

const invalidatedSessions = new LRUCache<true>(10000);

export interface TokenPayload {
  userId: string;
  role: "user" | "admin";
  sessionId: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function generateSessionId(): string {
  return randomBytes(24).toString("hex");
}

function getAccessSecret(): string {
  return secrets.JWT_SECRET;
}

function getRefreshSecret(): string {
  return secrets.JWT_REFRESH_SECRET ?? secrets.JWT_SECRET;
}

export function signAccessToken(payload: Omit<TokenPayload, "sessionId">): string {
  const sessionId = generateSessionId();
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_EXPIRY };
  return jwt.sign({ userId: payload.userId, role: payload.role, sessionId }, getAccessSecret(), options);
}

export function signRefreshToken(payload: Omit<TokenPayload, "sessionId">): string {
  const sessionId = generateSessionId();
  const options: SignOptions = { expiresIn: REFRESH_TOKEN_EXPIRY };
  return jwt.sign({ userId: payload.userId, role: payload.role, sessionId }, getRefreshSecret(), options);
}

export function generateTokens(payload: Omit<TokenPayload, "sessionId">): Tokens {
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60,
  };
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, getAccessSecret()) as JwtPayload & TokenPayload;
    if (invalidatedSessions.get(decoded.sessionId)) {
      throw new Error("Session invalidated");
    }
    return { userId: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error("انتهت صلاحية رمز الوصول");
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new Error("رمز وصول غير صالح");
    }
    throw err;
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, getRefreshSecret()) as JwtPayload & TokenPayload;
  if (invalidatedSessions.get(decoded.sessionId)) {
    throw new Error("Session invalidated");
  }
  return { userId: decoded.userId, role: decoded.role, sessionId: decoded.sessionId };
}

export function refreshTokens(refreshToken: string): Tokens {
  const payload = verifyRefreshToken(refreshToken);
  invalidatedSessions.set(payload.sessionId, true, SESSION_CACHE_TTL);
  return generateTokens({ userId: payload.userId, role: payload.role });
}

export function invalidateSession(sessionId: string): void {
  invalidatedSessions.set(sessionId, true, SESSION_CACHE_TTL);
  logger.debug({ sessionId }, "Session invalidated");
}
