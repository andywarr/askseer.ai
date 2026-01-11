/**
 * Generic retry utility for async operations
 */

import { logger } from "@/apps/shared/logger.ts";

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Whether to use exponential backoff (default: true) */
  exponentialBackoff?: boolean;
  /** Context for logging */
  context?: Record<string, unknown>;
  /** Operation name for logging */
  operationName?: string;
}

// ============================================================================
// Retry Utility
// ============================================================================

/**
 * Wraps an async function with retry logic
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all attempts fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    exponentialBackoff = true,
    context = {},
    operationName = "operation",
  } = options;

  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      attempt++;
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= maxAttempts) {
        logger.error(`${operationName} failed after ${maxAttempts} attempts`, {
          error: lastError.message,
          attempt,
          maxAttempts,
          ...context,
        });
        throw lastError;
      }

      const delayMs = exponentialBackoff
        ? baseDelayMs * attempt
        : baseDelayMs;

      logger.warn(`${operationName} attempt ${attempt} failed, retrying...`, {
        error: lastError.message,
        attempt,
        maxAttempts,
        nextDelayMs: delayMs,
        ...context,
      });

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error(`${operationName} failed unexpectedly`);
}

/**
 * Creates a retry wrapper with preset options
 * Useful for creating specialized retry functions
 */
export function createRetryWrapper(defaultOptions: RetryOptions) {
  return async function <T>(
    fn: () => Promise<T>,
    overrideOptions: RetryOptions = {}
  ): Promise<T> {
    return withRetry(fn, { ...defaultOptions, ...overrideOptions });
  };
}
