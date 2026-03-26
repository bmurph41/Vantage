/**
 * Enhanced Logger Configuration
 * 
 * Extends the existing Pino logger with:
 * - External log transport (Datadog or Loki)
 * - Structured context helpers
 * - Request-scoped child loggers
 * - Environment-aware transport selection
 * 
 * Drop-in replacement for existing lib/logger.ts
 */

import pino from 'pino';

// ─── Environment Helpers ─────────────────────────────────────────────────────

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

// ─── Transport Configuration ─────────────────────────────────────────────────

type LogProvider = 'datadog' | 'loki' | 'console';

function getLogProvider(): LogProvider {
  if (process.env.DD_API_KEY) return 'datadog';
  if (process.env.LOKI_URL) return 'loki';
  return 'console';
}

function buildTransportTargets(): pino.TransportTargetOptions[] {
  const targets: pino.TransportTargetOptions[] = [];
  const provider = getLogProvider();

  // Development: pino-pretty console
  if (isDevelopment()) {
    targets.push({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    });
  }

  // Production: structured JSON to stdout (for container log collection)
  if (isProduction() && provider === 'console') {
    targets.push({
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    });
  }

  // Datadog transport
  if (provider === 'datadog') {
    targets.push({
      target: 'pino-datadog-transport',
      options: {
        apiKey: process.env.DD_API_KEY,
        service: process.env.DD_SERVICE || 'marinalytics',
        env: process.env.NODE_ENV || 'production',
        hostname: process.env.HOSTNAME || 'marinalytics-web',
        ddsource: 'nodejs',
      },
    });
  }

  // Grafana Loki transport
  if (provider === 'loki') {
    targets.push({
      target: 'pino-loki',
      options: {
        host: process.env.LOKI_URL,
        labels: {
          job: 'marinalytics',
          env: process.env.NODE_ENV || 'production',
        },
        batching: true,
        interval: 5, // seconds
      },
    });
  }

  // Fallback: at least stdout
  if (targets.length === 0) {
    targets.push({
      target: 'pino/file',
      options: { destination: 1 },
    });
  }

  return targets;
}

// ─── Logger Instance ─────────────────────────────────────────────────────────

const transport = pino.transport({
  targets: buildTransportTargets(),
});

const logger = pino(
  {
    level: isDevelopment() ? 'debug' : 'info',
    formatters: {
      level: (label) => ({ level: label }),
    },
    base: {
      env: process.env.NODE_ENV,
      service: 'marinalytics',
    },
    redact: {
      paths: [
        'password',
        'token',
        'accessToken',
        'refreshToken',
        'authorization',
        'cookie',
        'ssn',
        'creditCard',
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
        'apiKey',
        'req.body.apiKey',
        'req.body.api_key',
        'req.headers["x-api-key"]',
        'sessionId',
        'req.body.sessionToken',
      ],
      censor: '[REDACTED]',
    },
    // Add timestamp in ISO format
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
);

// ─── Child Logger Factories ──────────────────────────────────────────────────

/**
 * Create a child logger with custom bindings.
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

/**
 * Create a request-scoped child logger.
 * Automatically includes requestId, userId, orgId.
 */
export function createRequestLogger(req: any) {
  return logger.child({
    requestId: req.requestId || req.headers?.['x-request-id'],
    userId: req.user?.id,
    orgId: req.user?.orgId,
    method: req.method,
    path: req.path,
  });
}

/**
 * Create a service-scoped child logger.
 */
export function createServiceLogger(serviceName: string) {
  return logger.child({ service: serviceName });
}

export { logger };
export default logger;
