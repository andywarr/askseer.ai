/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures when external services (OpenAI, db-worker) are unavailable.
 * Provides fail-fast behavior to allow services to recover.
 */

import { logger } from "@/apps/shared/logger.ts";

// ============================================================================
// Types
// ============================================================================

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Name for logging purposes */
  name: string;
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting recovery (default: 30000) */
  resetTimeoutMs?: number;
  /** Number of test requests allowed in half-open state (default: 1) */
  halfOpenMaxRequests?: number;
}

export interface CircuitBreakerState {
  name: string;
  state: CircuitState;
  failureCount: number;
  lastFailureTime: Date | null;
  successCount: number;
}

// ============================================================================
// Circuit Breaker Error
// ============================================================================

export class CircuitBreakerError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly state: CircuitState
  ) {
    super(`Circuit breaker "${circuitName}" is ${state}`);
    this.name = "CircuitBreakerError";
  }
}

// ============================================================================
// Circuit Breaker Class
// ============================================================================

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxRequests: number;

  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private halfOpenRequestCount = 0;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.halfOpenMaxRequests = options.halfOpenMaxRequests ?? 1;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should attempt the request
    if (!this.canExecute()) {
      throw new CircuitBreakerError(this.name, this.state);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if circuit allows execution
   */
  private canExecute(): boolean {
    switch (this.state) {
      case "CLOSED":
        return true;

      case "OPEN":
        // Check if reset timeout has passed
        if (this.shouldAttemptReset()) {
          this.transitionTo("HALF_OPEN");
          // Count this as the first half-open request
          this.halfOpenRequestCount++;
          return true;
        }
        return false;

      case "HALF_OPEN":
        // Allow limited requests in half-open state
        if (this.halfOpenRequestCount < this.halfOpenMaxRequests) {
          this.halfOpenRequestCount++;
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.resetTimeoutMs;
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      // Success in half-open state, close the circuit
      logger.info("Circuit breaker recovered", {
        name: this.name,
        previousState: this.state,
      });
      this.reset();
    }
    this.successCount++;
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === "HALF_OPEN") {
      // Failure in half-open state, reopen the circuit
      logger.warn("Circuit breaker failed recovery attempt", {
        name: this.name,
        failureCount: this.failureCount,
      });
      this.transitionTo("OPEN");
      this.halfOpenRequestCount = 0;
    } else if (
      this.state === "CLOSED" &&
      this.failureCount >= this.failureThreshold
    ) {
      // Threshold exceeded, open the circuit
      logger.error("Circuit breaker opened", {
        name: this.name,
        failureCount: this.failureCount,
        failureThreshold: this.failureThreshold,
        resetTimeoutMs: this.resetTimeoutMs,
      });
      this.transitionTo("OPEN");
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const previousState = this.state;
    this.state = newState;

    logger.info("Circuit breaker state transition", {
      name: this.name,
      from: previousState,
      to: newState,
    });
  }

  /**
   * Reset circuit to closed state
   */
  private reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.halfOpenRequestCount = 0;
  }

  /**
   * Get current circuit breaker state for observability
   */
  getState(): CircuitBreakerState {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
    };
  }

  /**
   * Force the circuit to a specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    logger.warn("Circuit breaker state forced", {
      name: this.name,
      from: this.state,
      to: state,
    });
    this.state = state;
    if (state === "CLOSED") {
      this.reset();
    }
  }
}

// ============================================================================
// Pre-configured Circuit Breakers
// ============================================================================

/**
 * Circuit breaker for OpenAI API calls
 * - Higher threshold since OpenAI occasionally has transient errors
 * - Longer reset timeout to give API time to recover
 */
export const openAiBreaker = new CircuitBreaker({
  name: "openai",
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxRequests: 2,
});

/**
 * Circuit breaker for db-worker API calls
 * - Lower threshold since db-worker should be more stable
 * - Shorter reset timeout for faster recovery
 */
export const dbWorkerBreaker = new CircuitBreaker({
  name: "db-worker",
  failureThreshold: 3,
  resetTimeoutMs: 10_000,
  halfOpenMaxRequests: 1,
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get states of all circuit breakers for health reporting
 */
export function getCircuitBreakerStates(): Record<string, CircuitBreakerState> {
  return {
    openai: openAiBreaker.getState(),
    dbWorker: dbWorkerBreaker.getState(),
  };
}
