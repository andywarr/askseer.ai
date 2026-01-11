/**
 * Custom HTTP Error class for consistent error handling across services
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }
}

/**
 * Factory function to create HttpError instances
 */
export function createHttpError(
  status: number,
  message: string,
  code?: string,
  details?: unknown
): HttpError {
  return new HttpError(status, message, code, details);
}

// Common error factories for convenience
export const NotFoundError = (message = "Not found", code?: string) =>
  createHttpError(404, message, code);

export const ForbiddenError = (message = "Forbidden", code?: string) =>
  createHttpError(403, message, code);

export const BadRequestError = (
  message = "Bad request",
  code?: string,
  details?: unknown
) => createHttpError(400, message, code, details);

export const UnauthorizedError = (message = "Unauthorized", code?: string) =>
  createHttpError(401, message, code);

export const ConflictError = (message = "Conflict", code?: string) =>
  createHttpError(409, message, code);

export const InternalServerError = (
  message = "Internal server error",
  code?: string
) => createHttpError(500, message, code);
