import { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, isAppError, ValidationError } from "../lib/errors";
import { logger } from "../lib/logger";

const isDev = process.env.NODE_ENV !== "production";

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

function formatZodError(err: ZodError): ErrorResponse {
  const details = err.errors.map((e) => ({
    field: e.path.join("."),
    message: e.message,
    code: e.code,
  }));
  return {
    error: {
      code: "VALIDATION_ERROR",
      message: "بيانات الإدخال غير صالحة",
      details,
      ...(isDev ? { stack: err.stack } : {}),
    },
  };
}

function formatAppError(err: AppError): ErrorResponse {
  return {
    error: {
      code: err.code,
      message: err.message,
      details: err.details,
      ...(isDev ? { stack: err.stack } : {}),
    },
  };
}

function formatUnknownError(err: Error): ErrorResponse {
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: isDev ? err.message : "خطأ داخلي في الخادم",
      ...(isDev ? { stack: err.stack } : {}),
    },
  };
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const response = formatZodError(err);
    logger.warn({ err, path: req.path, method: req.method }, "خطأ تحقق من صحة الإدخال");
    res.status(400).json(response);
    return;
  }

  if (isAppError(err)) {
    const response = formatAppError(err);
    const logLevel = err.statusCode >= 500 ? "error" : err.statusCode >= 400 ? "warn" : "info";
    logger[logLevel]({ err, path: req.path, method: req.method, statusCode: err.statusCode }, `خطأ معرف: ${err.code}`);
    res.status(err.statusCode).json(response);
    return;
  }

  const response = formatUnknownError(err);
  logger.error({ err, path: req.path, method: req.method }, "خطأ غير متوقع");
  res.status(500).json(response);
}
