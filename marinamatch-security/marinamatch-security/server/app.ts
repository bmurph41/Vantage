/**
 * MarinaMatch Express Application
 * 
 * Main entry point with security middleware configuration.
 * 
 * Security Features:
 * - Helmet (CSP, HSTS, etc.)
 * - CORS with strict origin allowlist
 * - Rate limiting (general, auth, upload)
 * - Session-based authentication
 * - CSRF protection
 * - Request validation (Zod)
 * - Audit logging
 * 
 * USAGE:
 * import { createApp } from './app';
 * const app = createApp();
 * app.listen(PORT);
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';

// Security configuration
import {
  configureSecurityMiddleware,
  configureErrorHandling,
  authRateLimiter,
  strictRateLimiter,
} from './config/security';

// Authentication & Authorization
import { authMiddleware, requireAuth, csrfProtection } from './middleware/auth';
import { initializeEncryption } from './utils/encryption';

// Routes
import { oauthRouter } from './routes/oauth';
import { documentRouter } from './routes/documents';
// import { authRouter } from './routes/auth'; // Implement based on your auth provider

// Background tasks
import { startScheduledTasks, registerShutdownHandler } from './tasks/scheduler';

// ============================================================================
// APP FACTORY
// ============================================================================

export function createApp(): Express {
  const app = express();

  // ========================================
  // PRE-MIDDLEWARE SETUP
  // ========================================

  // Initialize encryption (validates ENCRYPTION_KEY)
  initializeEncryption();

  // Trust proxy for accurate IP detection (Replit/Cloudflare)
  app.set('trust proxy', 1);

  // Disable x-powered-by header
  app.disable('x-powered-by');

  // ========================================
  // SECURITY MIDDLEWARE (Order matters!)
  // ========================================

  // 1. Security headers (Helmet), CORS, Rate limiting
  configureSecurityMiddleware(app);

  // 2. Parse cookies (required for session)
  app.use(cookieParser());

  // 3. Parse JSON bodies with size limit
  app.use(express.json({
    limit: '1mb',
    strict: true, // Only accept arrays and objects
  }));

  // 4. Parse URL-encoded bodies
  app.use(express.urlencoded({
    extended: false,
    limit: '1mb',
  }));

  // 5. Compression (after security, before routes)
  app.use(compression());

  // 6. Session/Auth middleware (sets req.tenantContext)
  app.use(authMiddleware());

  // ========================================
  // PUBLIC ROUTES (No auth required)
  // ========================================

  // Health check is handled in configureSecurityMiddleware

  // OAuth callbacks (handled specially - state validation instead of session)
  app.use('/api/oauth', oauthRouter);

  // ========================================
  // AUTHENTICATION ROUTES
  // ========================================

  // These routes have their own rate limiting
  // Example auth routes - implement based on your auth provider
  /*
  app.use('/api/auth', authRateLimiter, authRouter);
  */

  // Replit OIDC callback example
  app.post('/api/auth/callback', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      // This is a placeholder - implement based on Replit OIDC
      // See: https://docs.replit.com/hosting/authenticating-users-repl-auth
      
      // Example flow:
      // 1. Validate OIDC token from Replit
      // 2. Find or create user in database
      // 3. Create session
      // 4. Set session cookie
      
      res.status(501).json({
        success: false,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Implement Replit OIDC callback',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // Logout
  app.post('/api/auth/logout', requireAuth, csrfProtection, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { invalidateSession, clearSessionCookie } = await import('./middleware/auth');
      const { logLogout } = await import('./services/audit-logger');
      const { getClientIp } = await import('./middleware/auth');

      const context = req.tenantContext!;

      // Invalidate session
      await invalidateSession(context.sessionId);

      // Log logout
      await logLogout(context.userId, context.orgId, context.sessionId, getClientIp(req));

      // Clear cookie
      clearSessionCookie(res);

      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (error) {
      next(error);
    }
  });

  // Get current session info
  app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
    const context = req.tenantContext!;
    
    res.json({
      success: true,
      data: {
        userId: context.userId,
        orgId: context.orgId,
        roles: context.roles,
        isSuperAdmin: context.isSuperAdmin,
      },
    });
  });

  // ========================================
  // PROTECTED API ROUTES
  // ========================================

  // Documents
  app.use('/api/documents', documentRouter);

  // Integrations (OAuth connect/disconnect)
  // Already mounted above with oauthRouter

  // Users (implement based on your needs)
  /*
  app.use('/api/users', requireAuth, userRouter);
  */

  // Organization settings
  /*
  app.use('/api/org', requireAuth, orgRouter);
  */

  // Audit logs (admin only)
  app.get('/api/admin/audit-logs', 
    requireAuth, 
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { authorize } = await import('./middleware/authorization');
        const middleware = authorize('audit:read');
        middleware(req, res, async () => {
          const { queryAuditLogs } = await import('./services/audit-logger');
          const context = req.tenantContext!;
          
          const logs = await queryAuditLogs({
            orgId: context.orgId,
            limit: 100,
          });

          res.json({
            success: true,
            data: logs,
          });
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ========================================
  // ADMIN/SUPER-ADMIN ROUTES
  // ========================================

  app.get('/api/admin/health', 
    requireAuth, 
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { requireSuperAdmin } = await import('./middleware/auth');
        requireSuperAdmin(req, res, async () => {
          const { checkDatabaseHealth } = await import('./db/client');
          const { getTaskStatus } = await import('./tasks/scheduler');
          
          const dbHealth = await checkDatabaseHealth();
          const taskStatus = getTaskStatus();

          res.json({
            success: true,
            data: {
              database: dbHealth,
              tasks: taskStatus,
              memory: process.memoryUsage(),
              uptime: process.uptime(),
            },
          });
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ========================================
  // ERROR HANDLING (Must be last)
  // ========================================

  configureErrorHandling(app);

  return app;
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

export async function startServer(): Promise<void> {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Create app
  const app = createApp();

  // Start background tasks
  startScheduledTasks();

  // Register graceful shutdown
  registerShutdownHandler();

  // Start listening
  app.listen(PORT, '0.0.0.0', () => {
    console.log('═'.repeat(50));
    console.log('MarinaMatch Server Started');
    console.log('═'.repeat(50));
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Port: ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log('═'.repeat(50));
  });
}

// Run if executed directly
if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
