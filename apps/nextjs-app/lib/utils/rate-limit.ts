/**
 * In-memory rate limiter for API routes
 *
 * Simple IP-based rate limiting with configurable limits per endpoint.
 * Uses in-memory storage - suitable for single-server deployments.
 * For distributed systems, consider Redis-based rate limiting.
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds (default: 60000 = 1 minute)
  maxRequests: number; // Max requests per window per IP
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// Global store for all rate limiters
const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Creates a rate limiter with the specified configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
  const windowMs = config.windowMs ?? 60 * 1000;
  const maxRequests = config.maxRequests;

  return {
    /**
     * Check if a request is allowed under the rate limit
     */
    check(identifier: string): RateLimitResult {
      const now = Date.now();
      const key = identifier;
      const record = rateLimitStore.get(key);

      if (!record || record.resetAt < now) {
        const resetAt = now + windowMs;
        rateLimitStore.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: maxRequests - 1, resetAt };
      }

      if (record.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetAt: record.resetAt };
      }

      record.count++;
      return {
        allowed: true,
        remaining: maxRequests - record.count,
        resetAt: record.resetAt,
      };
    },

    /**
     * Create rate limit exceeded response with proper headers
     */
    errorResponse(resetAt: number): NextResponse {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          },
        },
      );
    },
  };
}

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Pre-configured rate limiters for plugin routes
export const pluginAuthLimiter = createRateLimiter({ maxRequests: 30 });
export const pluginSessionLimiter = createRateLimiter({ maxRequests: 60 });
export const pluginUploadLimiter = createRateLimiter({ maxRequests: 10 });
