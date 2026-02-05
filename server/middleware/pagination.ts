/**
 * Pagination Middleware
 * 
 * Parses, validates, and normalizes pagination parameters from query strings.
 * Attaches parsed pagination to req.pagination for use in route handlers.
 * 
 * Usage:
 *   import { parsePagination } from './middleware/pagination';
 *   
 *   // Apply globally to all list endpoints
 *   app.use('/api', parsePagination);
 *   
 *   // Or per-route
 *   app.get('/api/projects', parsePagination, async (req, res) => {
 *     const { page, limit, offset } = req.pagination!;
 *     const projects = await getProjects({ limit, offset });
 *     return apiPaginated(res, projects, { page, limit, total });
 *   });
 *   
 *   // With custom defaults
 *   app.get('/api/audit-logs', parsePagination({ defaultLimit: 100, maxLimit: 500 }), handler);
 */

import { Request, Response, NextFunction } from 'express';

// ─── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationOptions {
  /** Default items per page (default: 50) */
  defaultLimit?: number;
  /** Maximum items per page (default: 100) */
  maxLimit?: number;
  /** Default page number (default: 1) */
  defaultPage?: number;
}

// ─── Type Augmentation ───────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Parse pagination from query parameters.
 * Can be called with or without options:
 * 
 *   app.use(parsePagination);                          // Use defaults
 *   app.use(parsePagination({ maxLimit: 200 }));       // Custom max
 */
export function parsePagination(
  optionsOrReq?: PaginationOptions | Request,
  res?: Response,
  next?: NextFunction
): any {
  // If called as middleware directly (no options)
  if (optionsOrReq && 'method' in optionsOrReq && res && next) {
    return createPaginationMiddleware({})(optionsOrReq as Request, res, next);
  }

  // Called with options — return middleware function
  return createPaginationMiddleware(optionsOrReq as PaginationOptions || {});
}

function createPaginationMiddleware(options: PaginationOptions) {
  const defaultLimit = options.defaultLimit || DEFAULT_LIMIT;
  const maxLimit = options.maxLimit || MAX_LIMIT;
  const defaultPage = options.defaultPage || DEFAULT_PAGE;

  return (req: Request, res: Response, next: NextFunction) => {
    const rawPage = req.query.page as string;
    const rawLimit = req.query.limit as string;
    const rawPerPage = req.query.per_page as string; // Support alternate param name

    const page = Math.max(1, parseInt(rawPage) || defaultPage);
    const limit = Math.min(
      maxLimit,
      Math.max(1, parseInt(rawLimit || rawPerPage) || defaultLimit)
    );
    const offset = (page - 1) * limit;

    req.pagination = { page, limit, offset };

    next();
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse sort parameters from query string.
 * 
 * Usage:
 *   const sort = parseSortParams(req, ['name', 'created_at', 'updated_at']);
 *   // ?sort=name&order=desc → { field: 'name', direction: 'desc' }
 */
export function parseSortParams(
  req: Request,
  allowedFields: string[],
  defaults: { field: string; direction: 'asc' | 'desc' } = { field: 'created_at', direction: 'desc' }
): { field: string; direction: 'asc' | 'desc' } {
  const rawSort = (req.query.sort || req.query.sort_by) as string;
  const rawOrder = (req.query.order || req.query.order_by) as string;

  const field = rawSort && allowedFields.includes(rawSort) ? rawSort : defaults.field;
  const direction = rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : defaults.direction;

  return { field, direction };
}
