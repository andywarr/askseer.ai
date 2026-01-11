/**
 * Controller utilities for reducing code duplication across route handlers.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/apps/shared/logger.ts";
import { StudyStatus } from "@prisma/client";

/**
 * Extracts a parameter from multiple possible sources in a request.
 * Checks query, body, params, and headers in that order.
 *
 * @param req - Express request object
 * @param name - Parameter name to look for in query, body, and params
 * @param headerName - Optional header name (defaults to kebab-case of name)
 * @returns The parameter value or undefined if not found
 *
 * @example
 * const studyId = getParam(req, "studyId", "study-id");
 * const userId = getParam(req, "userId"); // uses "userid" as header name
 */
export function getParam<T = string>(
  req: Request,
  name: string,
  headerName?: string
): T | undefined {
  const value =
    req.query[name] ??
    req.body?.[name] ??
    req.params[name] ??
    req.headers[headerName ?? name.toLowerCase()];

  // Handle array values (e.g., from query string)
  if (Array.isArray(value)) {
    return value[0] as T;
  }

  return value as T | undefined;
}

/**
 * Extracts a required parameter and sends a 400 response if missing.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param name - Parameter name
 * @param friendlyName - Human-readable name for error message
 * @param headerName - Optional header name
 * @returns The parameter value or null if validation failed (response already sent)
 *
 * @example
 * const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
 * if (!studyId) return; // Response already sent
 */
export function requireParam<T = string>(
  req: Request,
  res: Response,
  name: string,
  friendlyName: string,
  headerName?: string
): T | null {
  const value = getParam<T>(req, name, headerName);

  if (value === undefined || value === null || value === "") {
    res.status(400).json({
      success: false,
      message: `${friendlyName} is required`,
    });
    return null;
  }

  return value;
}

/**
 * Rating values allowed for feedback on issues/recommendations
 */
export type Rating = "UP" | "DOWN" | null;

/**
 * Normalizes a rating value to uppercase or null.
 * Returns undefined if the original value was undefined (not provided).
 *
 * @param rating - The rating value to normalize
 * @returns Normalized rating, null, or undefined
 *
 * @example
 * normalizeRating("up")    // "UP"
 * normalizeRating("down")  // "DOWN"
 * normalizeRating(null)    // null
 * normalizeRating(undefined) // undefined
 */
export function normalizeRating(
  rating: unknown
): "UP" | "DOWN" | null | undefined {
  if (rating === undefined) return undefined;
  if (rating === null) return null;

  const normalized = String(rating).toUpperCase();
  if (normalized === "UP" || normalized === "DOWN") {
    return normalized;
  }
  return null;
}

/**
 * Validates a rating value and sends a 400 response if invalid.
 *
 * @param rating - The normalized rating value
 * @param res - Express response object
 * @returns true if valid, false if invalid (response already sent)
 */
export function validateRating(
  rating: "UP" | "DOWN" | null | undefined,
  res: Response
): boolean {
  if (
    rating !== undefined &&
    rating !== null &&
    rating !== "UP" &&
    rating !== "DOWN"
  ) {
    res.status(400).json({
      success: false,
      message: "Rating must be UP, DOWN, or null",
    });
    return false;
  }
  return true;
}

/**
 * HTTP error status codes that should be passed through to the client
 */
const PASSTHROUGH_STATUS_CODES = [400, 403, 404, 409] as const;

/**
 * Handles service errors with standard status code passthrough.
 * If the error has a status property matching common HTTP error codes,
 * it returns that status with the error message. Otherwise, it logs
 * the error and calls next() to pass to the error handler.
 *
 * @param error - The caught error
 * @param res - Express response object
 * @param next - Express next function
 * @param logMessage - Message to log if this is an unexpected error
 *
 * @example
 * catch (error) {
 *   return handleServiceError(error, res, next, "POST /study failed");
 * }
 */
export function handleServiceError(
  error: unknown,
  res: Response,
  next: NextFunction,
  logMessage: string
): void {
  const err = error as { status?: number; message?: string; code?: string };

  // Handle errors with specific status codes
  if (err?.status && PASSTHROUGH_STATUS_CODES.includes(err.status as any)) {
    res.status(err.status).json({
      success: false,
      message: err.message || "An error occurred",
    });
    return;
  }

  // Handle errors with specific codes (like Prisma errors)
  if (err?.code === "NOT_FOUND") {
    res.status(404).json({ success: false, message: "Not found" });
    return;
  }

  if (err?.code === "NOT_MEMBER") {
    res.status(403).json({
      success: false,
      message: "User is not a member of the requested team",
    });
    return;
  }

  if (err?.code === "PERSONAL_TEAM_DISABLED") {
    res.status(403).json({
      success: false,
      message: "Personal teams are disabled for your company",
    });
    return;
  }

  // Log unexpected errors and pass to error middleware
  logger.error(logMessage, { error });
  next(error);
}

/**
 * Validates and converts a status string to a Prisma StudyStatus enum value.
 * Accepts both uppercase (preferred) and lowercase (legacy) values.
 *
 * @param status - The status string (e.g., "COMPLETED", "FAILED", "PENDING")
 * @returns The corresponding StudyStatus enum value, or null if invalid
 */
export function convertToStudyStatus(status: string): StudyStatus | null {
  const normalized = status.toUpperCase() as StudyStatus;
  return Object.values(StudyStatus).includes(normalized) ? normalized : null;
}

/**
 * Creates a standard success response with optional data.
 *
 * @param res - Express response object
 * @param data - Optional data to include in response
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendSuccess<T>(
  res: Response,
  data?: T,
  statusCode: number = 200
): void {
  if (data !== undefined) {
    res.status(statusCode).json({ success: true, data });
  } else {
    res.status(statusCode).json({ success: true });
  }
}

/**
 * Creates a standard error response.
 *
 * @param res - Express response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 400)
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 400
): void {
  res.status(statusCode).json({ success: false, message });
}

/**
 * Validates that required fields are present in the request body.
 *
 * @param body - Request body object
 * @param fields - Array of required field names
 * @param res - Express response object
 * @returns true if all fields present, false if validation failed (response sent)
 */
export function requireBodyFields(
  body: Record<string, unknown>,
  fields: string[],
  res: Response
): boolean {
  const missing = fields.filter(
    (field) =>
      body[field] === undefined || body[field] === null || body[field] === ""
  );

  if (missing.length > 0) {
    sendError(
      res,
      `${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required`
    );
    return false;
  }

  return true;
}

/**
 * Wraps an async controller function with standard error handling.
 * This reduces boilerplate try/catch blocks in controllers.
 *
 * @param fn - The async controller function
 * @param logPrefix - Prefix for error logging
 * @returns Wrapped controller function
 *
 * @example
 * export const getUser = withErrorHandler(
 *   async (req, res) => {
 *     const userId = requireParam(req, res, "userId", "User ID");
 *     if (!userId) return;
 *     const data = await dbGetUser(userId);
 *     sendSuccess(res, data);
 *   },
 *   "GET /user"
 * );
 */
export function withErrorHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  logPrefix: string
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      handleServiceError(error, res, next, `${logPrefix} failed`);
    }
  };
}

/**
 * Verifies user is a company admin (ADMIN or OWNER role).
 * Sends 403 if not authorized.
 *
 * @param companyId - The company ID
 * @param userId - The user ID
 * @param res - Express response object
 * @param actionDescription - Description of the action for error message
 * @returns true if authorized, false if not (response sent)
 */
export async function requireCompanyAdmin(
  companyId: string,
  userId: string,
  res: Response,
  actionDescription: string
): Promise<boolean> {
  const { dbGetCompanyMembership } =
    await import("@/apps/db-worker/src/services/index.ts");
  const membership = await dbGetCompanyMembership(companyId, userId);

  if (
    !membership ||
    (membership.role !== "ADMIN" && membership.role !== "OWNER")
  ) {
    logger.warn(`${actionDescription} access denied`, {
      userId,
      companyId,
      role: membership?.role,
    });
    sendError(
      res,
      `Only company admins can ${actionDescription.toLowerCase()}`,
      403
    );
    return false;
  }

  return true;
}
