/**
 * Error Handler Middleware
 * Sanitizes error responses to prevent information leakage
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

interface AppError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Main error handler - place this LAST in your middleware chain
 */
export const errorHandler: ErrorRequestHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log full error server-side
  console.error('Error occurred:', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id,
    orgId: (req as any).user?.orgId,
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      status: err.status || err.statusCode
    }
  });

  // Determine status code
  const statusCode = err.status || err.statusCode || 500;

  // Production mode - send sanitized error
  if (process.env.NODE_ENV === 'production') {
    // Operational errors (expected) - can send message
    if (err.isOperational) {
      return res.status(statusCode).json({
        error: err.message,
        code: err.code
      });
    }

    // Programming errors (unexpected) - hide details
    return res.status(statusCode).json({
      error: 'An unexpected error occurred. Please try again later.',
      requestId: generateRequestId(req)
    });
  }

  // Development mode - send full error details
  res.status(statusCode).json({
    error: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
};

/**
 * Async error wrapper - catches errors in async route handlers
 * Usage: router.get('/route', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create an operational error (expected error that's safe to show user)
 */
export class OperationalError extends Error {
  status: number;
  code: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 400, code?: string) {
    super(message);
    this.status = statusCode;
    this.code = code || 'OPERATIONAL_ERROR';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common operational errors
 */
export class NotFoundError extends OperationalError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends OperationalError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends OperationalError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends OperationalError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends OperationalError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends OperationalError {
  constructor(retryAfter?: number) {
    super(
      'Too many requests. Please try again later.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}

/**
 * Generate unique request ID for error tracking
 */
function generateRequestId(req: Request): string {
  // Use existing request ID if present (from load balancer, etc.)
  const existingId = req.headers['x-request-id'] as string;
  if (existingId) return existingId;

  // Generate new ID
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Sanitize database errors (hide schema details)
 */
export function sanitizeDatabaseError(error: any): Error {
  // PostgreSQL error codes
  const errorCode = error.code;
  
  switch (errorCode) {
    case '23505': // unique_violation
      return new ConflictError('This record already exists');
    
    case '23503': // foreign_key_violation
      return new ValidationError('Referenced record not found');
    
    case '23502': // not_null_violation
      return new ValidationError('Required field is missing');
    
    case '42P01': // undefined_table
    case '42703': // undefined_column
      // Hide schema details in production
      if (process.env.NODE_ENV === 'production') {
        return new Error('Database error occurred');
      }
      return error;
    
    default:
      // Generic database error (hide details in production)
      if (process.env.NODE_ENV === 'production') {
        return new Error('A database error occurred. Please try again.');
      }
      return error;
  }
}

/**
 * Not found handler - 404 for undefined routes
 * Place this AFTER all other routes but BEFORE error handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
}

/**
 * Example usage in server/index.ts:
 * 
 * import { errorHandler, notFoundHandler, asyncHandler } from './middleware/error-handler';
 * 
 * // ... all your routes ...
 * 
 * // 404 handler (after all routes)
 * app.use(notFoundHandler);
 * 
 * // Error handler (must be last)
 * app.use(errorHandler);
 * 
 * 
 * Example usage in routes:
 * 
 * import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error-handler';
 * 
 * router.get('/projects/:id', asyncHandler(async (req, res) => {
 *   const project = await db.select().from(projects)
 *     .where(eq(projects.id, req.params.id))
 *     .limit(1);
 *   
 *   if (!project.length) {
 *     throw new NotFoundError('Project');
 *   }
 *   
 *   res.json(project[0]);
 * }));
 */
