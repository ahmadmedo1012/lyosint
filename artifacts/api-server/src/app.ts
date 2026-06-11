import express, { type Express } from "express";
import path from "node:path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { corsMiddleware } from "./middleware/cors";
import { securityHeaders } from "./middleware/security-headers";
import { auditLogger } from "./middleware/audit";
import { rateLimit } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error-handler";
import { initSecrets } from "./lib/secrets";

const app: Express = express();

// Initialize secrets on startup
try {
  initSecrets();
} catch (err) {
  logger.fatal(err, "فشل تهيئة الأسماء الأسرارية");
  process.exit(1);
}

// Request logging
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers
app.use(securityHeaders);

// CORS
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Per-endpoint rate limiting
app.use("/api/search", rateLimit("search"));
app.use("/api/auth/login", rateLimit("auth"));
app.use("/api/auth/register", rateLimit("auth"));
app.use("/api/admin", rateLimit("admin"));
app.use("/api", rateLimit("general"));

// Audit logging
app.use("/api", auditLogger);

// API routes
app.use("/api", router);

// SPA fallback (must come after API routes)
const spaDir = path.resolve(import.meta.dirname, "../../lyosint/dist/public");
app.use(
  express.static(spaDir, {
    index: "index.html",
    maxAge: "1h",
    fallthrough: true,
  }),
);

app.get(/^\/(?!api\/).*/, (_req, res, next) => {
  res.sendFile(path.join(spaDir, "index.html"), (err) => {
    if (err) next();
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
