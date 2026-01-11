/**
 * Circuit Breaker Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerError,
  getCircuitBreakerStates,
} from "./circuitBreaker.ts";

// Mock the logger
vi.mock("@/apps/shared/logger.ts", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.clearAllMocks();
    breaker = new CircuitBreaker({
      name: "test-service",
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxRequests: 1,
    });
  });

  describe("initial state", () => {
    it("should start in CLOSED state", () => {
      expect(breaker.getState().state).toBe("CLOSED");
    });

    it("should have zero failure count", () => {
      expect(breaker.getState().failureCount).toBe(0);
    });
  });

  describe("CLOSED state", () => {
    it("should allow successful executions", async () => {
      const result = await breaker.execute(async () => "success");
      expect(result).toBe("success");
      expect(breaker.getState().state).toBe("CLOSED");
      expect(breaker.getState().successCount).toBe(1);
    });

    it("should count failures but stay closed below threshold", async () => {
      const failingFn = async () => {
        throw new Error("test error");
      };

      // Fail twice (below threshold of 3)
      await expect(breaker.execute(failingFn)).rejects.toThrow("test error");
      await expect(breaker.execute(failingFn)).rejects.toThrow("test error");

      expect(breaker.getState().state).toBe("CLOSED");
      expect(breaker.getState().failureCount).toBe(2);
    });

    it("should open after reaching failure threshold", async () => {
      const failingFn = async () => {
        throw new Error("test error");
      };

      // Fail 3 times (threshold)
      await expect(breaker.execute(failingFn)).rejects.toThrow("test error");
      await expect(breaker.execute(failingFn)).rejects.toThrow("test error");
      await expect(breaker.execute(failingFn)).rejects.toThrow("test error");

      expect(breaker.getState().state).toBe("OPEN");
      expect(breaker.getState().failureCount).toBe(3);
    });
  });

  describe("OPEN state", () => {
    beforeEach(async () => {
      // Open the circuit
      const failingFn = async () => {
        throw new Error("test error");
      };
      for (let i = 0; i < 3; i++) {
        await breaker.execute(failingFn).catch(() => {});
      }
    });

    it("should reject requests immediately when open", async () => {
      await expect(breaker.execute(async () => "success")).rejects.toThrow(
        CircuitBreakerError
      );
    });

    it("should include circuit name in error", async () => {
      try {
        await breaker.execute(async () => "success");
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError);
        expect((error as CircuitBreakerError).circuitName).toBe("test-service");
      }
    });

    it("should transition to HALF_OPEN after reset timeout", async () => {
      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next execution should be attempted (HALF_OPEN)
      const result = await breaker.execute(async () => "recovered");
      expect(result).toBe("recovered");
      expect(breaker.getState().state).toBe("CLOSED");
    });
  });

  describe("HALF_OPEN state", () => {
    beforeEach(async () => {
      // Open the circuit
      const failingFn = async () => {
        throw new Error("test error");
      };
      for (let i = 0; i < 3; i++) {
        await breaker.execute(failingFn).catch(() => {});
      }
      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    it("should close circuit on success", async () => {
      const result = await breaker.execute(async () => "success");
      expect(result).toBe("success");
      expect(breaker.getState().state).toBe("CLOSED");
      expect(breaker.getState().failureCount).toBe(0);
    });

    it("should reopen circuit on failure", async () => {
      await expect(
        breaker.execute(async () => {
          throw new Error("still failing");
        })
      ).rejects.toThrow("still failing");

      expect(breaker.getState().state).toBe("OPEN");
    });

    it("should limit requests in half-open state", async () => {
      // First request transitions to HALF_OPEN and starts
      const promise1 = breaker.execute(
        async () =>
          new Promise((resolve) => setTimeout(() => resolve("first"), 100))
      );

      // Second request should fail immediately (halfOpenMaxRequests = 1)
      await expect(breaker.execute(async () => "second")).rejects.toThrow(
        CircuitBreakerError
      );

      // First request should complete successfully
      expect(await promise1).toBe("first");
    });
  });

  describe("forceState", () => {
    it("should allow forcing circuit to OPEN", () => {
      breaker.forceState("OPEN");
      expect(breaker.getState().state).toBe("OPEN");
    });

    it("should reset failure count when forcing to CLOSED", async () => {
      // Create some failures
      for (let i = 0; i < 2; i++) {
        await breaker
          .execute(async () => {
            throw new Error("test");
          })
          .catch(() => {});
      }

      expect(breaker.getState().failureCount).toBe(2);

      breaker.forceState("CLOSED");
      expect(breaker.getState().failureCount).toBe(0);
    });
  });

  describe("getState", () => {
    it("should return complete state information", async () => {
      await breaker.execute(async () => "success");
      await breaker
        .execute(async () => {
          throw new Error("fail");
        })
        .catch(() => {});

      const state = breaker.getState();
      expect(state).toEqual({
        name: "test-service",
        state: "CLOSED",
        failureCount: 1,
        lastFailureTime: expect.any(Date),
        successCount: 1,
      });
    });
  });
});

describe("getCircuitBreakerStates", () => {
  it("should return states of all pre-configured breakers", () => {
    const states = getCircuitBreakerStates();

    expect(states).toHaveProperty("openai");
    expect(states).toHaveProperty("dbWorker");
    expect(states.openai.name).toBe("openai");
    expect(states.dbWorker.name).toBe("db-worker");
  });
});
