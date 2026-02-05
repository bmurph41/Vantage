/**
 * Standardized API Response Envelope
 * 
 * Provides consistent response formatting across all API endpoints.
 * All responses follow the same structure:
 * 
 *   {
 *     "success": true|false,
 *     "data": { ... },          // Present on success
 *     "error": { code, message }, // Present on failure
 *     "meta": { requestId, page, limit, total }
 *   }
 * 
 * Usage:
 *   import { apiSuccess, apiPaginated, apiError } from '../lib/response';
 *   
 *   // Success
 *   return apiSuccess(res, project);
 *   
 *   // Paginated
 *   return apiPaginated(res, projects, { page: 1, limit: 50, total: 200 });
 *   
 *   // Error
 *   return apiError(res, 404, 'NOT_FOUND', 'Project not found');
 */

import { Response } from 'express';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: ApiMeta;
}

export interface ApiMeta {
  requestId?: string;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

// ─── Response Helpers ────────────────────────────────────────────────────────

function getRequestId(res: Response): string {
  return (res.req as any)?.requestId || 'unknown';
}

/**
 * Send a success response.
 */
export function apiSuccess<T>(res: Response, data: T, statusCode: number = 200): Response {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId: getRequestId(res),
    },
  } satisfies ApiResponse<T>);
}

/**
 * Send a success response for resource creation (201).
 */
export function apiCreated<T>(res: Response, data: T): Response {
  return apiSuccess(res, data, 201);
}

/**
 * Send a paginated response.
 */
export function apiPaginated<T>(
  res: Response,
  items: T[],
  pagination: PaginationMeta
): Response {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,
    data: items,
    meta: {
      requestId: getRequestId(res),
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  } satisfies ApiResponse<T[]>);
}

/**
 * Send an error response.
 */
export function apiError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): Response {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: {
      requestId: getRequestId(res),
    },
  } satisfies ApiResponse);
}

/**
 * Send a 204 No Content response (for deletes).
 */
export function apiNoContent(res: Response): Response {
  return res.status(204).send();
}

// ─── Convenience Error Helpers ───────────────────────────────────────────────

export function apiBadRequest(res: Response, message: string, details?: unknown): Response {
  return apiError(res, 400, 'BAD_REQUEST', message, details);
}

export function apiUnauthorized(res: Response, message: string = 'Authentication required'): Response {
  return apiError(res, 401, 'UNAUTHORIZED', message);
}

export function apiForbidden(res: Response, message: string = 'Insufficient permissions'): Response {
  return apiError(res, 403, 'FORBIDDEN', message);
}

export function apiNotFound(res: Response, resource: string = 'Resource'): Response {
  return apiError(res, 404, 'NOT_FOUND', `${resource} not found`);
}

export function apiConflict(res: Response, message: string): Response {
  return apiError(res, 409, 'CONFLICT', message);
}

export function apiValidationError(res: Response, details: unknown): Response {
  return apiError(res, 422, 'VALIDATION_ERROR', 'Validation failed', details);
}

export function apiTooManyRequests(res: Response, retryAfterSeconds?: number): Response {
  if (retryAfterSeconds) {
    res.setHeader('Retry-After', retryAfterSeconds.toString());
  }
  return apiError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.');
}

export function apiServerError(res: Response, message: string = 'Internal server error'): Response {
  return apiError(res, 500, 'INTERNAL_ERROR', message);
}
