/**
 * Client Sentry initialization.
 *
 * No-op when VITE_SENTRY_DSN is unset. Import once from main.tsx.
 */

import * as Sentry from '@sentry/react';

let initialized = false;

export function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    tracesSampleRate: parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.05'),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
  });

  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, any>) {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function setSentryUser(user: { id: string; email?: string; orgId?: string; role?: string; isBeta?: boolean } | null) {
  if (!initialized) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, email: user.email });
  if (user.orgId) Sentry.setTag('orgId', user.orgId);
  if (user.role) Sentry.setTag('role', user.role);
  if (typeof user.isBeta === 'boolean') Sentry.setTag('beta', String(user.isBeta));
}

export { Sentry };
