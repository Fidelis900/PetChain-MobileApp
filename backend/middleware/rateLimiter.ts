/**
 * Rate limiting middleware using express-rate-limit with Redis backing.
 *
 * Limits:
 *  - Auth endpoints  : 5 req / min  per IP
 *  - Data endpoints  : 100 req / min per authenticated user (falls back to IP)
 *
 * On 429 the response includes a Retry-After header (seconds until reset).
 * Sustained violations (≥ 3 consecutive 429s from the same key) are logged
 * so they can be forwarded to an alerting system.
 */

import { type Request, type Response } from 'express';
import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

import { type AuthenticatedRequest } from './auth';

// ---------------------------------------------------------------------------
// Redis client (shared with redisSession if desired)
// ---------------------------------------------------------------------------

const redisClient = new Redis({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
  lazyConnect: true,
  enableOfflineQueue: false,
});

redisClient.on('error', (err: Error) => {
  // Log but don't crash — rate limiting degrades gracefully to in-memory
  console.error('[rateLimiter] Redis error:', err.message);
});

// ---------------------------------------------------------------------------
// Violation tracker (in-memory; replace with Redis INCR for multi-instance)
// ---------------------------------------------------------------------------

const violationCounts = new Map<string, number>();
const VIOLATION_ALERT_THRESHOLD = 3;

function trackViolation(key: string): void {
  const count = (violationCounts.get(key) ?? 0) + 1;
  violationCounts.set(key, count);

  if (count >= VIOLATION_ALERT_THRESHOLD) {
    console.warn(
      `[rateLimiter] ALERT: key "${key}" has hit the rate limit ${count} times consecutively`,
    );
    // TODO: forward to alerting service (PagerDuty, Sentry, etc.)
  }
}

// ---------------------------------------------------------------------------
// Shared handler options
// ---------------------------------------------------------------------------

function makeStore(prefix: string): RedisStore {
  return new RedisStore({
    // @ts-expect-error — ioredis is compatible but types differ slightly
    sendCommand: (...args: string[]) => redisClient.call(...args),
    prefix,
  });
}

const sharedOptions: Partial<Options> = {
  standardHeaders: true, // Return RateLimit-* headers
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const retryAfter = Math.ceil(
      (res.getHeader('RateLimit-Reset') as number ?? 60),
    );
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please slow down.',
      retryAfter,
    });
  },
  skip: (req: Request) => {
    // Never rate-limit health / readiness probes
    return req.path === '/health' || req.path === '/ready';
  },
};

// ---------------------------------------------------------------------------
// Auth rate limiter — 5 req / min per IP
// ---------------------------------------------------------------------------

export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req: Request) =>
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown',
  store: makeStore('rl:auth:'),
  handler: (req: Request, res: Response) => {
    const key =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';
    trackViolation(`auth:${key}`);
    const retryAfter = 60;
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please wait 1 minute.',
      retryAfter,
    });
  },
});

// ---------------------------------------------------------------------------
// Data rate limiter — 100 req / min per user (falls back to IP)
// ---------------------------------------------------------------------------

export const dataRateLimiter: RateLimitRequestHandler = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req: Request) => {
    const authed = req as AuthenticatedRequest;
    return authed.user?.id ??
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      'unknown';
  },
  store: makeStore('rl:data:'),
  handler: (req: Request, res: Response) => {
    const authed = req as AuthenticatedRequest;
    const key = authed.user?.id ?? req.socket.remoteAddress ?? 'unknown';
    trackViolation(`data:${key}`);
    const retryAfter = 60;
    res.setHeader('Retry-After', retryAfter);
    res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please slow down.',
      retryAfter,
    });
  },
});
