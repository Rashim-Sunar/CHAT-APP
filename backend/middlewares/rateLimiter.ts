// ----------------------------------------
// @file   middleware/rateLimiter.ts
// @desc   Tiered rate limiting middleware for auth, messaging, and general API routes
// ----------------------------------------
 
import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response } from 'express';
 
// ----------------------------------------
// Types
// ----------------------------------------
 
interface RateLimiterConfig {
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}
 
// ----------------------------------------
// Helpers
// ----------------------------------------
 
/**
 * Builds a standardized rate limit error response.
 * Sent when a client exceeds their allowed request quota.
 */
const buildLimitHandler = (message: string) =>
  (_req: Request, res: Response): void => {
    res.status(429).json({
      status: "fail",
      error: 'TOO_MANY_REQUESTS',
      message,
      retryAfter: res.getHeader('Retry-After'),
    });
  };
 
/**
 * Factory function to create a rate limiter with shared defaults.
 */
const createLimiter = ({
  windowMs,
  limit,
  message,
  skipSuccessfulRequests = false,
}: RateLimiterConfig): RateLimitRequestHandler => {
  const options: Partial<Options> = {
    windowMs,
    limit,
    standardHeaders: 'draft-7', // Adds RateLimit-* headers (RFC standard)
    legacyHeaders: false,        // Disables X-RateLimit-* legacy headers
    skipSuccessfulRequests,
    handler: buildLimitHandler(message),
 
    // Key by IP; swap for user ID once auth middleware attaches req.user
    keyGenerator: (req: Request): string =>
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown',
  };
 
  return rateLimit(options);
};
 
// ----------------------------------------
// Tier 1 — Auth Routes (strictest)
// Protects login/register/forgot-password from brute-force & credential stuffing.
// Only failed requests count toward the limit to avoid penalizing valid logins.
// ----------------------------------------
export const authLimiter: RateLimitRequestHandler = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,                 // 10 failed attempts per window
  skipSuccessfulRequests: true,
  message:
    'Too many authentication attempts from this IP. Please try again after 15 minutes.',
});
 
// ----------------------------------------
// Tier 2 — Message Routes (moderate)
// Prevents message spam while allowing active conversation flow.
// ----------------------------------------
export const messageLimiter: RateLimitRequestHandler = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 60,           // 60 messages per minute (~1/sec sustained)
  message:
    'You are sending messages too quickly. Please slow down.',
});
 
// ----------------------------------------
// Tier 3 — General API Routes (lenient)
// Broad protection for user lookups, profile updates, etc.
// ----------------------------------------
export const apiLimiter: RateLimitRequestHandler = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,          // 100 requests per minute
  message:
    'Too many requests from this IP. Please try again in a moment.',
});

// ----------------------------------------
// Tier 4 — Device Link Session Creation
// Restricts how often a client can open key-transfer sessions.
// ----------------------------------------
export const linkSessionCreateLimiter: RateLimitRequestHandler = createLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  message:
    'Too many device linking attempts. Please wait a minute before trying again.',
});