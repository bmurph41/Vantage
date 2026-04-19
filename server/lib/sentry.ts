/**
 * Sentry initialization for the server.
 *
 * Safely a no-op when SENTRY_DSN is unset, so dev and beta without Sentry
 * configured behave identically to today. Set SENTRY_DSN in prod to enable.
 */

import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05'),
    beforeSend(event) {
      // Drop noisy auth / CORS preflight noise that isn't actionable.
      const status = (event.contexts?.response as any)?.status_code;
      if (status === 401 || status === 403 || status === 404) return null;
      if (event.request?.method === 'OPTIONS') return null;
      return event;
    },
  });

  initialized = true;
}

/**
 * Enrich each Sentry event with the authenticated user / org / beta-flag tags.
 * Mount after the auth middleware has populated req.user.
 */
export function sentryContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!initialized) return next();
  const user = (req as any).user;
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
    Sentry.setTag('orgId', user.orgId || 'unknown');
    Sentry.setTag('role', user.role || 'unknown');
  }
  const isBeta = (req as any).org?.isBeta;
  if (typeof isBeta === 'boolean') Sentry.setTag('beta', String(isBeta));
  next();
}

/**
 * Capture an uncaught exception and continue to the project's central error
 * handler. Must run BEFORE centralizedErrorHandler in the middleware chain.
 */
export function sentryErrorHandler(err: any, _req: Request, _res: Response, next: NextFunction) {
  if (initialized) {
    Sentry.captureException(err);
  }
  next(err);
}

export { Sentry };
