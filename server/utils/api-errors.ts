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

export const featureDisabled = (feature: string) =>
  new ApiError(501, 'FEATURE_UNAVAILABLE', `${feature} is unavailable (backing table was removed in a prior migration)`);

/**
 * Returns true when the error is a PostgreSQL "relation does not exist" error
 * (SQLSTATE 42P01). Use this to detect references to dropped tables.
 *
 * Detection strategy (most-specific first):
 *   1. Check the PostgreSQL SQLSTATE code (authoritative, always present in pg errors).
 *   2. As a narrow fallback for drivers that surface errors without a code, require
 *      BOTH "relation" AND "does not exist" in the message — this avoids matching
 *      unrelated errors such as "column does not exist" or "function does not exist".
 */
export function isDroppedTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as any;
  if (e.code === '42P01') return true;
  if (
    typeof e.message === 'string' &&
    e.message.includes('relation') &&
    e.message.includes('does not exist')
  ) return true;
  return false;
}

/**
 * Wraps an async operation that may reference a dropped database table.
 * If the underlying error is a "relation does not exist" (42P01), the
 * callback is not executed and `fallback` is returned instead.
 * All other errors are re-thrown as-is so the caller can handle them.
 */
export async function withDroppedTableFallback<T>(
  operation: () => Promise<T>,
  fallback: T,
  featureName?: string,
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (isDroppedTableError(err)) {
      if (featureName) {
        const { logger } = await import('../lib/logger');
        logger.warn({ featureName }, `[dropped-table] ${featureName} skipped — backing table removed`);
      }
      return fallback;
    }
    throw err;
  }
}
