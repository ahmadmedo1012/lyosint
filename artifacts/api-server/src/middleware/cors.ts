import corsLib from "cors";
import { type CorsOptions } from "cors";

const ALLOWED_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const ALLOWED_HEADERS = ["Authorization", "Content-Type", "X-Requested-With", "X-Admin-Token"];

function getOrigins(): string[] | boolean {
  const raw = process.env["CORS_ORIGINS"] ?? process.env["CORS_ORIGIN"] ?? "";
  if (!raw || raw === "*") return true;
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

export function createCorsOptions(): CorsOptions {
  const origins = getOrigins();

  const originList = typeof origins === "boolean" ? [] : origins;

  return {
    origin: (origin, callback) => {
      if (origins === true) {
        callback(null, true);
        return;
      }
      if (!origin || originList.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ALLOWED_METHODS,
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    credentials: typeof origins !== "boolean",
    maxAge: 86400,
  };
}

export const corsMiddleware = corsLib(createCorsOptions());
