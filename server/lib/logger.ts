import pino from 'pino';
import { isDevelopment } from '../config/env';

const logger = pino({
  level: isDevelopment() ? 'debug' : 'info',
  transport: isDevelopment()
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
});

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

export function createRequestLogger(requestId: string, userId?: string, tenantId?: string) {
  return logger.child({
    requestId,
    ...(userId && { userId }),
    ...(tenantId && { tenantId }),
  });
}

export { logger };
export default logger;
