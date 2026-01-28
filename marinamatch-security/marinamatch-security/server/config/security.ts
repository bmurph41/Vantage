/**
 * MarinaMatch Security Configuration
 * 
 * Centralized security middleware configuration including:
 * - Rate limiting (general, auth, upload)
 * - Helmet (CSP, HSTS, etc.)
 * - CORS (strict origin allowlist)
 * - Error handling (structured, no stack traces in prod)
 * 
 * USAGE:
 * import { configureSecurityMiddleware } from './config/security';
 * configureSecurityMiddleware(app);
 */

import { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import type { SecurityError } from '../types/security';

// ============================================================================
// CONFIGURATION
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';

// Allowed origins for CORS
const getAllowedOrigins = (): string[] => {
  const origins = [
    process.env.APP_URL, // Primary app URL
  ];

  // Add additional allowed origins from environment
  if (process.env.CORS_ALLOWED_ORIGINS) {
    origins.push(...process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim()));
  }

  // In development, allow localhost variations
  if (!isProduction) {
    origins.push(
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:5173', // Vite default
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:5173',
    );
  }

  return origins.filter(Boolean) as string[];
};

// CSP directives tuned for React + modern frontend
const getCSPDirectives = () => ({
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    // Allow inline scripts for React hydration (consider nonce in future)
    isProduction ? '' : "'unsafe-inline'",
    "'unsafe-eval'", // Required for some dev tools, remove in strict production
  ].filter(Boolean),
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Required for styled-components, emotion, etc.
  ],
  imgSrc: [
    "'self'",
    'data:',
    'blob:',
    'https:', // Allow HTTPS images (for user avatars, etc.)
  ],
  fontSrc: [
    "'self'",
    'data:',
  ],
  connectSrc: [
    "'self'",
    // API endpoints
    process.env.APP_URL || '',
    // Third-party services
    'https://api.sentry.io', // Error monitoring
    'https://appcenter.intuit.com', // QuickBooks
    'https://oauth.platform.intuit.com',
    'https://sandbox.api.intuit.com',
    'https://quickbooks.api.intuit.com',
  ].filter(Boolean),
  frameSrc: ["'none'"], // No iframes
  objectSrc: ["'none'"], // No plugins
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"], // Prevent clickjacking
  upgradeInsecureRequests: isProduction ? [] : undefined,
});

// ============================================================================
// RATE LIMITERS
// ============================================================================

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const generalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise IP
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.ip 
      || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
});

/**
 * Authentication rate limiter
 * 5 attempts per minute per IP (prevent brute force)
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again in a minute',
    },
  },
  keyGenerator: (req) => {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.ip 
      || 'unknown';
  },
});

/**
 * Upload rate limiter
 * 10 uploads per hour per user
 */
export const uploadRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
      message: 'Upload limit reached, please try again later',
    },
  },
  keyGenerator: (req) => {
    // Rate limit by user if authenticated, otherwise by IP
    const context = (req as any).tenantContext;
    if (context?.userId) {
      return `upload:${context.userId}`;
    }
    return `upload:${req.ip || 'unknown'}`;
  },
});

/**
 * Strict rate limiter for sensitive operations
 * 3 attempts per 5 minutes
 */
export const strictRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'STRICT_RATE_LIMIT_EXCEEDED',
      message: 'Too many attempts, please wait before trying again',
    },
  },
});

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    // In production, you may want to be stricter
    if (!origin) {
      if (isProduction) {
        // In production, reject requests without origin
        return callback(new Error('CORS: Origin required'), false);
      }
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error('CORS: Not allowed'), false);
  },
  credentials: true, // Required for cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Request-ID',
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  maxAge: 86400, // Cache preflight for 24 hours
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: Record<string, unknown>) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'Access denied', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }

  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMIT') {
    return new ApiError(429, code, message);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    return new ApiError(500, code, message);
  }
}

/**
 * Global error handler middleware
 * Converts errors to structured JSON responses
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error | ApiError | SecurityError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log error (with stack trace in development)
  console.error(`[ERROR] ${requestId}:`, {
    message: err.message,
    name: err.name,
    stack: isProduction ? undefined : err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Determine status code and error details
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> | undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
    // Handle custom errors with statusCode
    statusCode = (err as any).statusCode;
    code = (err as any).code || 'ERROR';
    message = err.message;
  } else if (err.name === 'ZodError') {
    // Handle Zod validation errors
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = { errors: (err as any).errors };
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid or expired token';
  } else if (err.message === 'CORS: Not allowed') {
    statusCode = 403;
    code = 'CORS_ERROR';
    message = 'Cross-origin request blocked';
  }

  // In production, don't expose internal error details
  if (isProduction && statusCode === 500) {
    message = 'An unexpected error occurred';
    details = undefined;
  }

  // Send structured error response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
      requestId,
    },
  });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
};

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check endpoint handler
 */
export const healthCheckHandler = async (req: Request, res: Response): Promise<void> => {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    checks: Record<string, { status: string; latency?: number; error?: string }>;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {},
  };

  // Database check
  try {
    const dbStart = Date.now();
    // Import db client dynamically to avoid circular deps
    const { db } = await import('../db/client');
    await db.execute('SELECT 1');
    health.checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = {
      status: 'unhealthy',
      error: isProduction ? 'Database connection failed' : (error as Error).message,
    };
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const memUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  health.checks.memory = {
    status: memUsedPercent > 90 ? 'degraded' : 'healthy',
    latency: Math.round(memUsedPercent),
  };

  if (memUsedPercent > 90) {
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
};

// ============================================================================
// REQUEST CONTEXT
// ============================================================================

/**
 * Add request ID to all requests
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

// ============================================================================
// MAIN CONFIGURATION FUNCTION
// ============================================================================

/**
 * Configure all security middleware for the Express app
 */
export function configureSecurityMiddleware(app: Express): void {
  // Trust proxy (required for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);

  // Request ID for tracking
  app.use(requestIdMiddleware);

  // Helmet security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: getCSPDirectives(),
      },
      crossOriginEmbedderPolicy: false, // Required for some third-party scripts
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // For OAuth popups
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // For CDN assets
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xContentTypeOptions: true,
      xDnsPrefetchControl: { allow: false },
      xDownloadOptions: true,
      xFrameOptions: { action: 'deny' },
      xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
      xXssProtection: true,
    })
  );

  // CORS
  app.use(cors(corsOptions));

  // General rate limiting
  app.use(generalRateLimiter);

  // Health check (before auth middleware)
  app.get('/health', healthCheckHandler);
  app.get('/api/health', healthCheckHandler);
}

/**
 * Configure error handling (should be added after routes)
 */
export function configureErrorHandling(app: Express): void {
  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  corsOptions,
  getAllowedOrigins,
  getCSPDirectives,
  isProduction,
};
