/**
 * API Versioning Router
 * 
 * Provides versioned API routing with deprecation support.
 * 
 * Usage in index.ts:
 *   import { createVersionedRouter, deprecationWarning } from './routes/api-versioning';
 *   
 *   const v1Router = createVersionedRouter();
 *   // Mount your existing route modules on v1Router
 *   v1Router.use('/projects', projectRoutes);
 *   v1Router.use('/crm', crmRoutes);
 *   
 *   // Versioned mount
 *   app.use('/api/v1', v1Router);
 *   
 *   // Backwards-compat: old /api/* routes still work with deprecation header
 *   app.use('/api', deprecationWarning('2026-12-31'), v1Router);
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

/**
 * Creates a new versioned API router with version header injection.
 */
export function createVersionedRouter(version: string = 'v1'): Router {
  const router = Router();

  // Inject API version header on all responses
  router.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-API-Version', version);
    next();
  });

  return router;
}

/**
 * Middleware that adds deprecation headers to responses.
 * Attach to legacy /api/* routes to signal clients should migrate to /api/v1/*.
 * 
 * @param sunsetDate - ISO date string when the unversioned routes will be removed
 */
export function deprecationWarning(sunsetDate: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only add deprecation headers if the request is NOT already under /api/v1
    if (!req.baseUrl.includes('/v1')) {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', sunsetDate);
      res.setHeader('Link', '</api/v1>; rel="successor-version"');

      // Log usage of deprecated routes (sampling: 1% of requests)
      if (Math.random() < 0.01) {
        logger.info({
          type: 'deprecated_api_usage',
          path: req.path,
          method: req.method,
          userId: (req as any).user?.id,
          userAgent: req.headers['user-agent'],
        });
      }
    }

    next();
  };
}

/**
 * Version negotiation middleware (for future use with Accept-Version header).
 * 
 * Allows clients to request specific API versions via header:
 *   Accept-Version: v1
 */
export function versionNegotiation(supportedVersions: string[] = ['v1']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestedVersion = req.headers['accept-version'] as string;

    if (requestedVersion && !supportedVersions.includes(requestedVersion)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_API_VERSION',
          message: `API version '${requestedVersion}' is not supported. Supported versions: ${supportedVersions.join(', ')}`,
        },
      });
    }

    next();
  };
}
