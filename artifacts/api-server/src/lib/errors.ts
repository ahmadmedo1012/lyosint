export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "الموارد غير موجودة", details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "بيانات غير صالحة", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "غير مصرح", details?: unknown) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "ممنوع", details?: unknown) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "طلبات كثيرة جداً", details?: unknown) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "تعارض في البيانات", details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class InternalError extends AppError {
  constructor(message = "خطأ داخلي في الخادم", details?: unknown) {
    super(message, 500, "INTERNAL_ERROR", details);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
