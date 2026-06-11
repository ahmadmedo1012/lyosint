import { type Request, type Response, type NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../lib/errors";

const HTML_TAG_RE = /<[^>]*>/g;
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const SQL_INJECTION_RE = /(\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|MERGE|SELECT|TRUNCATE|UPDATE|UNION)\b)|('--)|(;\s*$)/i;

function sanitizeString(value: string): string {
  return value
    .replace(HTML_TAG_RE, "")
    .replace(CONTROL_CHAR_RE, "")
    .normalize("NFKC")
    .trim();
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    const sanitized = sanitizeString(value);
    if (SQL_INJECTION_RE.test(sanitized)) {
      throw new ValidationError("قيمة الإدخال تحتوي على أنماط غير مسموحة", { field: "sanitized" });
    }
    return sanitized;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitized[k] = sanitizeValue(v);
    }
    return sanitized;
  }
  return value;
}

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = source === "body" ? req.body : source === "query" ? req.query : req.params;
      const sanitized = sanitizeValue(data);
      const parsed = schema.parse(sanitized);
      if (source === "body") req.body = parsed;
      else if (source === "query") req.query = parsed;
      else (req as unknown as Record<string, unknown>).params = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
          code: e.code,
        }));
        const error = new ValidationError("بيانات الإدخال غير صالحة", details);
        next(error);
        return;
      }
      if (err instanceof ValidationError) {
        next(err);
        return;
      }
      next(err);
    }
  };
}

export function validateBody(schema: ZodSchema) {
  return validate(schema, "body");
}

export function validateQuery(schema: ZodSchema) {
  return validate(schema, "query");
}

export function validateParams(schema: ZodSchema) {
  return validate(schema, "params");
}
