import { type Request, type Response, type NextFunction } from "express";

const SELF = "'self'";

const CSP_DIRECTIVES = {
  "default-src": [SELF],
  "script-src": [SELF, "'unsafe-inline'", "https://telegram.org"],
  "style-src": [SELF, "'unsafe-inline'"],
  "img-src": [SELF, "data:", "https:", "http:"],
  "font-src": [SELF, "data:"],
  "connect-src": [SELF, "https://api.telegram.org"],
  "frame-src": [SELF, "https://telegram.org"],
  "object-src": ["'none'"],
  "base-uri": [SELF],
  "form-action": [SELF],
};

function buildCSP(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

const DEFAULT_CSP = buildCSP();
const REPORT_ONLY = process.env["CSP_REPORT_ONLY"] === "true";
const HSTS_MAX_AGE = Number(process.env["HSTS_MAX_AGE"] ?? "31536000");

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  if (req.protocol === "https" || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", `max-age=${HSTS_MAX_AGE}; includeSubDomains; preload`);
  }

  const cspHeader = REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
  res.setHeader(cspHeader, DEFAULT_CSP);

  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  next();
}
