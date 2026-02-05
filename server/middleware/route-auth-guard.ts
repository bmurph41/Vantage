/**
 * Route Auth Guard
 * 
 * Ensures every /api route has consistent authentication and authorization.
 * Applies globally after authResolver() and before route handlers.
 * 
 * Usage in index.ts:
 *   import { routeAuthGuard } from './middleware/route-auth-guard';
 *   app.use('/api', authResolver());
 *   app.use('/api', routeAuthGuard());
 *   app.use('/api', requireTenantMatch);
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

/** Routes that do NOT require authentication */
const PUBLIC_ROUTES = new Set<string>([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/callback',
  '/api/auth/saml',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/stripe/webhook',
  '/api/webhooks',
  '/health',
  '/health/ready',
  '/health/live',
]);

/** Route prefixes that do NOT require authentication */
const PUBLIC_PREFIXES: string[] = [
  '/api/auth/',
  '/api/public/',
];

/**
 * Check if a route is public (no auth required)
 */
export function isPublicRoute(path: string): boolean {
  if (PUBLIC_ROUTES.has(path)) return true;
  return PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * Global auth guard middleware.
 * Rejects any non-public /api request that lacks a valid session/user.
 */
export function routeAuthGuard() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isPublicRoute(req.path)) {
      return next();
    }

    const user = (req as any).user;

    if (!user || !user.id) {
      logger.warn({
        type: 'auth_guard_rejected',
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'You must be authenticated to access this resource.',
        },
      });
    }

    // Verify orgId is present for tenant-scoped routes
    if (!user.orgId && !req.path.startsWith('/api/auth/') && !req.path.startsWith('/api/onboarding')) {
      logger.warn({
        type: 'auth_guard_missing_org',
        userId: user.id,
        path: req.path,
        method: req.method,
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'ORG_REQUIRED',
          message: 'Organization context is required for this operation.',
        },
      });
    }

    next();
  };
}

/**
 * Route Security Matrix Generator
 * 
 * Use in development to audit all registered routes and their middleware.
 * Call after all routes are registered.
 * 
 * Usage:
 *   if (isDevelopment()) {
 *     logRouteSecurityMatrix(app);
 *   }
 */
export function logRouteSecurityMatrix(app: any): void {
  const routes: Array<{ method: string; path: string; middlewareCount: number }> = [];

  function extractRoutes(stack: any[], basePath: string = '') {
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
        const path = basePath + (layer.route.path || '');
        routes.push({
          method: methods.join(','),
          path,
          middlewareCount: layer.route.stack?.length || 0,
        });
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const prefix = basePath + (layer.regexp?.source
          ?.replace('\\/?(?=\\/|$)', '')
          ?.replace(/\\\//g, '/')
          ?.replace(/\^/g, '')
          ?.replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param') || '');
        extractRoutes(layer.handle.stack, prefix);
      }
    }
  }

  if (app._router?.stack) {
    extractRoutes(app._router.stack);
  }

  logger.info({
    type: 'route_security_matrix',
    totalRoutes: routes.length,
    publicRoutes: routes.filter(r => isPublicRoute(r.path)).length,
    protectedRoutes: routes.filter(r => !isPublicRoute(r.path)).length,
  });

  // Log individual routes in development
  for (const route of routes) {
    const isPublic = isPublicRoute(route.path);
    logger.debug({
      type: 'route_security_entry',
      method: route.method,
      path: route.path,
      isPublic,
      middlewareCount: route.middlewareCount,
    });
  }
}
