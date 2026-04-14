/**
 * Pagination utilities for list endpoints.
 *
 * Usage:
 *   import { parsePagination, paginatedResponse } from '../utils/pagination';
 *
 *   const pag = parsePagination(req.query);
 *   // ... add .limit(pag.limit).offset(pag.offset) to your query
 *   // ... run a separate count query
 *   res.json(paginatedResponse(rows, totalCount, pag));
 */

export interface PaginationParams {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Parse pagination parameters from Express query object.
 *
 * @param query  - req.query (Record<string, any>)
 * @param defaults.pageSize    - default page size (default 25)
 * @param defaults.maxPageSize - hard ceiling (default 100)
 */
export function parsePagination(
  query: Record<string, any>,
  defaults?: { pageSize?: number; maxPageSize?: number },
): PaginationParams {
  const maxPageSize = defaults?.maxPageSize ?? 100;
  const defaultPageSize = defaults?.pageSize ?? 25;

  const page = Math.max(1, parseInt(query.page as string) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parseInt(query.pageSize as string) || defaultPageSize),
  );

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

/**
 * Wrap a result set in the standard paginated envelope.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}
