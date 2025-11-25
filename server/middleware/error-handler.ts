import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';
import { isProduction } from '../config/env';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = 'ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class TenantIsolationError extends AppError {
  constructor() {
    super(403, 'Access denied', 'TENANT_ISOLATION_ERROR');
    this.name = 'TenantIsolationError';
  }
}

function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

export function centralizedErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const requestId = req.requestId || 'unknown';
  const log = req.log || logger;
  
  if (err instanceof ZodError) {
    const validationErrors = formatZodError(err);
    log.warn({
      type: 'validation_error',
      requestId,
      errors: validationErrors,
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      requestId,
      details: validationErrors,
    });
  }
  
  if (err instanceof AppError) {
    const logMethod = err.statusCode >= 500 ? 'error' : 'warn';
    log[logMethod]({
      type: 'app_error',
      requestId,
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
      stack: err.statusCode >= 500 ? err.stack : undefined,
    });
    
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId,
      ...(err.details && !isProduction() && { details: err.details }),
    });
  }
  
  log.error({
    type: 'unhandled_error',
    requestId,
    error: err.message,
    stack: err.stack,
    userId: (req as any).user?.id,
    tenantId: (req as any).user?.orgId,
    method: req.method,
    path: req.path,
  });
  
  return res.status(500).json({
    error: isProduction() ? 'An unexpected error occurred' : err.message,
    code: 'INTERNAL_ERROR',
    requestId,
  });
}

export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  const requestId = req.requestId || 'unknown';
  
  if (req.log) {
    req.log.warn({
      type: 'not_found',
      method: req.method,
      path: req.path,
    });
  }
  
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    requestId,
    path: req.path,
  });
}
