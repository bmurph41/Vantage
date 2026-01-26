/**
 * Rate Limiting Middleware
 * Protects against brute force, DoS attacks, and API abuse
 * 
 * Uses Redis for distributed rate limiting across multiple instances
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import type { Request, Response, NextFunction } from 'express';

// Redis connection for rate limiting
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('Redis connection failed after 3 retries');
      return null; // Stop retrying
    }
    return Math.min(times * 100, 3000); // Exponential backoff
  }
});

redis.on('error', (err) => {
  console.error('Redis rate limiter error:', err);
});

redis.on('connect', () => {
  console.log('✓ Redis rate limiter connected');
});

/**
 * Global rate limit - applies to all routes
 * 100 requests per minute per IP
 */
export const globalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  store: new RedisStore({
    // @ts-expect-error - Known type mismatch between versions
    client: redis,
    prefix: 'rl:global:',
  }),
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/health/ready';
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
  }
});

/**
 * Strict rate limit for login attempts
 * 5 attempts per 15 minutes per IP
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  store: new RedisStore({
    // @ts-expect-error - Known type mismatch between versions
    client: redis,
    prefix: 'rl:login:',
  }),
  keyGenerator: (req) => {
    // Rate limit by IP + email combination
    const email = req.body?.email || 'unknown';
    return `${req.ip}:${email}`;
  },
  handler: (req: Request, res: Response) => {
    // Log failed login attempts for security monitoring
    console.warn('Login rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      timestamp: new Date().toISOString()
    });
    
    res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
      retryAfter: 900 // seconds
    });
  }
});

/**
 * Rate limit for AI-powered endpoints
 * 10 requests per minute per user
 */
export const aiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 AI calls per minute
  message: {
    error: 'AI request limit reached. Please wait before making more requests.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - Known type mismatch between versions
    client: redis,
    prefix: 'rl:ai:',
  }),
  keyGenerator: (req) => {
    return `user:${req.user?.id || req.ip}`;
  }
});

/**
 * Rate limit for file uploads
 * 20 uploads per hour per user
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: {
    error: 'Upload limit reached. Please wait before uploading more files.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - Known type mismatch between versions
    client: redis,
    prefix: 'rl:upload:',
  }),
  keyGenerator: (req) => {
    return `user:${req.user?.id || req.ip}`;
  }
});

/**
 * Rate limit for exports (CSV, PDF, Excel)
 * 5 exports per hour per user
 */
export const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 exports per hour
  message: {
    error: 'Export limit reached. Please wait before generating more exports.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - Known type mismatch between versions
    client: redis,
    prefix: 'rl:export:',
  }),
  keyGenerator: (req) => {
    return `user:${req.user?.id || req.ip}`;
  }
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
      retryAfter: Math.ceil(options.windowMs / 1000) + ' seconds'
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // @ts-expect-error - Known type mismatch between versions
      client: redis,
      prefix: `rl:${options.prefix}:`,
    }),
  });
}

/**
 * Graceful shutdown - close Redis connection
 */
export function closeRateLimitStore() {
  redis.quit();
  console.log('✓ Redis rate limiter disconnected');
}

// Export Redis client for other uses
export { redis as rateLimitRedis };
