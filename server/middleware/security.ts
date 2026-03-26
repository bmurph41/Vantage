import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { Express, Request, Response, NextFunction } from 'express';
import { getAllowedOrigins, isProduction } from '../config/env';
import { logger } from '../lib/logger';
import { csrfProtection } from './csrf';

export function configureSecurityMiddleware(app: Express) {
  app.set('trust proxy', 1);
  
  app.use(
    helmet({
      contentSecurityPolicy: isProduction()
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: [
                "'self'",
                'https://maps.googleapis.com',
                'https://api.openai.com',
                'https://api.anthropic.com',
                'https://api.stripe.com',
                'https://api.sendgrid.com',
                'wss:',
                'ws:',
              ],
              frameSrc: ["'none'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );
  
  const allowedOrigins = getAllowedOrigins();
  
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else if (origin?.includes('.replit.dev') || origin?.includes('.replit.app') || origin?.includes('.repl.co')) {
          callback(null, true);
        } else {
          logger.warn({ origin, allowedOrigins }, 'CORS rejection');
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
      exposedHeaders: ['X-Request-ID'],
    })
  );
  
  app.use(cookieParser());
  
  app.use('/api/', createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { 
      error: 'Too many requests', 
      code: 'RATE_LIMITED',
      retryAfter: 15 * 60,
    },
  }));
  
  app.use('/api/auth/login', createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { 
      error: 'Too many login attempts', 
      code: 'LOGIN_RATE_LIMITED',
      retryAfter: 15 * 60,
    },
  }));
  
  app.use('/api/auth/register', createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { 
      error: 'Too many registration attempts', 
      code: 'REGISTRATION_RATE_LIMITED',
      retryAfter: 60 * 60,
    },
  }));
  
  app.use('/api/', csrfProtection);
  
  logger.info({ env: isProduction() ? 'production' : 'development' }, 'Security middleware configured');
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: object;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || { error: 'Too many requests', code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { 
      xForwardedForHeader: false,
      trustProxy: false,
    },
    skip: (req: Request) => {
      return !isProduction() && (req.ip === '127.0.0.1' || req.ip === '::1');
    },
    handler: (req: Request, res: Response, next: NextFunction, optionsUsed: any) => {
      logger.warn({
        type: 'rate_limit_exceeded',
        ip: req.ip,
        userId: (req as any).user?.id,
        path: req.path,
        windowMs: optionsUsed.windowMs,
        max: optionsUsed.max,
      });
      res.status(429).json(options.message);
    },
  });
}
