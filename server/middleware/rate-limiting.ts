/**
 * Rate Limiting Middleware
 * Protects against brute force, DoS attacks, and API abuse
 *
 * Uses Redis for distributed rate limiting when REDIS_URL is set,
 * otherwise falls back to in-memory storage.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Store } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

// Lazily build the Redis store only if REDIS_URL is configured and reachable.
// Returns undefined when Redis is unavailable so express-rate-limit falls back
// to its default in-memory store.
function buildRedisStore(prefix: string): Store | undefined {
  if (!process.env.REDIS_URL) return undefined;
  try {
    const Redis = require('ioredis');
    const RedisStore = require('rate-limit-redis').default;
    const redis = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times: number) => (times > 2 ? null : times * 200),
      lazyConnect: true,
    });
    redis.on('error', (err: Error) => {
      logger.warn({ err }, 'Redis rate-limit store error');
    });
    return new RedisStore({
      sendCommand: (...args: string[]) =>
        redis.call(args[0], ...args.slice(1)) as Promise<number>,
      prefix,
    });
  } catch {
    logger.warn('rate-limit-redis not available — using in-memory store');
    return undefined;
  }
}

/**
 * Global rate limit — applies to all routes
 * 100 requests per minute per user/IP
 */
export const globalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '60 seconds',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('rl:global:'),
  skip: (req) =>
    req.path === '/health' || req.path === '/health/ready',
  keyGenerator: (req) =>
    req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req),
});

/**
 * Strict rate limit for login attempts
 * 10 attempts per 15 minutes per IP + email
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: buildRedisStore('rl:login:'),
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    return `${ipKeyGenerator(req)}:${email}`;
  },
  handler: (req: Request, res: Response) => {
    logger.warn(
      { type: 'login_rate_limit_exceeded', ip: req.ip, email: req.body?.email, path: req.path },
      'Login rate limit exceeded',
    );
    res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: 900,
    });
  },
});

/**
 * Failed login IP tracker
 * Blocks an IP for 30 minutes after 5 consecutive failed login attempts.
 */
const failedLoginAttempts = new Map<string, { count: number; blockedUntil: number | null }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failedLoginAttempts.entries()) {
    if (entry.blockedUntil && entry.blockedUntil < now) {
      failedLoginAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function failedLoginTracker(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const entry = failedLoginAttempts.get(ip);

  if (entry?.blockedUntil && Date.now() < entry.blockedUntil) {
    const retryAfterSec = Math.ceil((entry.blockedUntil - Date.now()) / 1000);
    logger.warn({ type: 'failed_login_ip_blocked', ip, retryAfterSec }, 'Failed login IP block active');
    return res.status(429).json({
      error: 'Too many failed login attempts. Your IP is temporarily blocked.',
      retryAfter: retryAfterSec,
    });
  }

  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      const current = failedLoginAttempts.get(ip) || { count: 0, blockedUntil: null };
      current.count += 1;
      if (current.count >= 5) {
        current.blockedUntil = Date.now() + 30 * 60 * 1000;
        logger.warn({ type: 'failed_login_ip_block_triggered', ip }, 'IP blocked after 5 failed login attempts');
      }
      failedLoginAttempts.set(ip, current);
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      failedLoginAttempts.delete(ip);
    }
    return originalJson(body);
  };

  next();
}

/**
 * Rate limit for AI-powered endpoints
 * 10 requests per minute per user
 */
export const aiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: {
    error: 'AI request limit reached. Please wait before making more requests.',
    retryAfter: '60 seconds',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('rl:ai:'),
  keyGenerator: (req) => `user:${req.user?.id || ipKeyGenerator(req)}`,
});

/**
 * Rate limit for file uploads
 * 20 uploads per hour per user
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    error: 'Upload limit reached. Please wait before uploading more files.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('rl:upload:'),
  keyGenerator: (req) => `user:${req.user?.id || ipKeyGenerator(req)}`,
});

/**
 * Rate limit for exports (CSV, PDF, Excel)
 * 5 exports per hour per user
 */
export const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: 'Export limit reached. Please wait before generating more exports.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: buildRedisStore('rl:export:'),
  keyGenerator: (req) => `user:${req.user?.id || ipKeyGenerator(req)}`,
});

/**
 * Custom rate limiter for specific use cases
 */
export function createRateLimit(options: {
  windowMs: number;
  max: number;
  prefix: string;
  message?: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: options.message || 'Rate limit exceeded',
      retryAfter: Math.ceil(options.windowMs / 1000) + ' seconds',
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: buildRedisStore(`rl:${options.prefix}:`),
  });
}

export function closeRateLimitStore() {
  // No-op when using in-memory store; Redis connections self-close on process exit.
}
