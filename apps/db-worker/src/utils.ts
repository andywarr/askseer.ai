// Import logger
import { logger } from "./logger.ts";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Utility functions for database operations
export function formatError(error: any): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

export function sanitizeLogData(data: any): any {
  // Remove sensitive information from log data
  const sanitized = { ...data };

  // Remove potential sensitive fields
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;

  return sanitized;
}

export function logDatabaseOperation(operation: string, params: any): void {
  logger.debug("Database operation", {
    operation,
    params: sanitizeLogData(params),
  });
}

export default {
  formatError,
  sanitizeLogData,
  logDatabaseOperation,
};
