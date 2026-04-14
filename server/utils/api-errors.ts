/**
 * Standardized API error classes and factory functions.
 *
 * Usage in route handlers:
 *   import { ApiError, badRequest, notFound } from '../utils/api-errors';
 *
 *   throw notFound('PROJECT_NOT_FOUND', 'Project not found for this organization');
 *   throw badRequest('INVALID_DATE_RANGE', 'Start date must be before end date', { start, end });
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (code: string, message: string, details?: Record<string, any>) =>
  new ApiError(400, code, message, details);

export const notFound = (code: string, message: string) =>
  new ApiError(404, code, message);

export const forbidden = (code: string, message: string) =>
  new ApiError(403, code, message);

export const conflict = (code: string, message: string) =>
  new ApiError(409, code, message);

export const internal = (code: string, message: string) =>
  new ApiError(500, code, message);
