/**
 * Enhanced Security Middleware Configuration
 * 
 * Extends the existing security.ts with additional hardening:
 * - Stricter CSP directives
 * - Permissions-Policy header
 * - Additional custom security headers
 * - Request ID propagation
 * 
 * This is an ENHANCEMENT file — integrate into existing security.ts
 * or import alongside it.
 */

import { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { isProduction } from '../config/env';
import { logger } from '../lib/logger';

/**
 * Apply enhanced security headers beyond the base Helmet configuration.
 * Call AFTER the existing configureSecurityMiddleware().
 */
export function configureEnhancedSecurityHeaders(app: Express) {
  // ─── Permissions Policy ──────────────────────────────────────────────────
  // Restricts browser features that can be used by the app
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Permissions-Policy', [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'interest-cohort=()',  // Opt out of FLoC/Topics
    ].join(', '));
    next();
  });

  // ─── Additional Security Headers ────────────────────────────────────────
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Propagate request ID for traceability
    const requestId = (req as any).requestId || req.headers['x-request-id'] || 'unknown';
    res.setHeader('X-Request-Id', requestId);

    // Prevent MIME-type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Remove server identity headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    // Cross-Origin policies
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

    // Cache control for API responses
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    next();
  });

  // ─── HSTS Enhancement ───────────────────────────────────────────────────
  // Ensure HSTS is set correctly in production (Helmet may already do this,
  // but this guarantees correctness)
  if (isProduction()) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
      next();
    });
  }
}

/**
 * Helmet configuration reference for updating security.ts.
 * 
 * If you need to update the existing Helmet config, merge these directives:
 */
export function getRecommendedHelmetConfig() {
  return helmet({
    contentSecurityPolicy: isProduction()
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://maps.googleapis.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
            connectSrc: ["'self'", 'https://maps.googleapis.com', 'wss:', 'ws:'],
            frameSrc: ["'self'", 'https://maps.google.com'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' as const },
  });
}
