import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { rateLimit } from "../../middleware/rate-limit";
import type { Request, Response, NextFunction } from "express";

jest.mock("../../lib/logger", () => ({ logger: { warn: jest.fn(), info: jest.fn() } }));

function mockRes(): Response {
  const state: { statusCode?: number; body?: any; headers: Record<string, any> } = { headers: {} };
  const res = {
    status: function (code: number) { state.statusCode = code; return this; },
    json: function (body: any) { state.body = body; return this; },
    setHeader: function (key: string, value: any) { state.headers[key] = value; return this; },
    get statusCode() { return state.statusCode; },
    get body() { return state.body; },
    get headers() { return state.headers; },
  } as any;
  return res;
}

describe("rateLimit middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows requests under the limit", () => {
    const middleware = rateLimit("general");
    const res = mockRes();
    const next = jest.fn();

    middleware({ ip: "192.168.1.1", socket: {} } as Request, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("allows multiple requests under the limit for search endpoint", () => {
    const middleware = rateLimit("search");

    for (let i = 0; i < 5; i++) {
      const res = mockRes();
      const next = jest.fn();
      middleware({ ip: `192.168.1.${i}`, socket: {} } as Request, res, next);
      expect(next).toHaveBeenCalled();
    }
  });

  it("blocks requests when rate limit exceeded and returns 429", () => {
    const middleware = rateLimit("auth");
    const req = { ip: "10.0.0.1", socket: {} } as Request;

    let lastRes: any;
    for (let i = 0; i < 10; i++) {
      const res = mockRes();
      const next = jest.fn();
      middleware(req, res, next);
      lastRes = res;
    }

    expect(lastRes!.statusCode).toBe(429);
    expect(lastRes!.headers["Retry-After"]).toBeDefined();
  });

  it("uses different limits per endpoint type", () => {
    const generalMw = rateLimit("general");
    const authMw = rateLimit("auth");
    const req = { ip: "10.0.0.3", socket: {} } as Request;

    for (let i = 0; i < 10; i++) {
      const res = mockRes();
      const next = jest.fn();
      generalMw(req, res, next);
    }

    const authRes = mockRes();
    const authNext = jest.fn();
    for (let i = 0; i < 10; i++) {
      const res = mockRes();
      const next = jest.fn();
      authMw(req, res, next);
      if (i >= 5) {
        expect(res.statusCode).toBe(429);
      }
    }
  });

  it("sets X-RateLimit headers on allowed requests", () => {
    const middleware = rateLimit("general");
    const res = mockRes();
    const next = jest.fn();

    middleware({ ip: "10.0.0.4", socket: {} } as Request, res, next);

    expect(res.headers["X-RateLimit-Limit"]).toBeDefined();
    expect(res.headers["X-RateLimit-Remaining"]).toBeDefined();
  });
});
