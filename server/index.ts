import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { deadlineMonitor } from "./deadline-monitor";
import { reconciliationService } from "./reconciliation-service";
import { vdrFileService } from "./vdr-file-service";
import { registerDocketRoutes } from "./docket/routes";
import { startDocketCronJobs } from "./docket/cron-jobs";
import { DatabaseStorage as DocketStorage } from "./docket/storage";
import { initializeWebSocket } from "./docket/websocket";
import { startMarinaMatchIntelCronJobs } from "./marinamatch/services/intel-cron";
import { startScheduler as startListingScheduler } from "./marinamatch/services/listing-scheduler";
import { autoSeedGlobalBrokerSources } from "./marinamatch/services/global-broker-sources";
import { seedIntegrations } from "./integrations";
import { seedMarinaTaxonomyPack } from "./services/coa-taxonomy-seed";
import { docIntelService } from "./services/doc-intel-service";

import { configureSecurityMiddleware } from "./middleware/security";
import { requestIdMiddleware, requestLoggingMiddleware } from "./middleware/logging";
import { centralizedErrorHandler, notFoundHandler } from "./middleware/error-handler";
import { globalRateLimit, loginRateLimit, failedLoginTracker } from "./middleware/rate-limiting";
import { tenantContextMiddleware } from "./middleware/tenant-context";
import { logger } from "./lib/logger";
import settingsRoutes from './routes/settings-routes';
import leasesRouter from './routes/leases';
import wizardDraftsRouter from './routes/wizard-drafts';
import { workspaceRouter } from './routes/workspace-routes';
import { ddChecklistRouter } from "./routes/dd-checklist-routes";
import healthRoutes from './routes/health';
import { deprecationWarning } from './routes/api-versioning';
import legalBenchmarkingRoutes from './routes/legal-benchmarking-routes';
import { authenticateUser } from './middleware/authenticate';
import { configureEnhancedSecurityHeaders } from './middleware/enhanced-security-headers';

import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 50;

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown — release the port so the next start doesn't hit EADDRINUSE
function gracefulShutdown(signal: string) {
  console.log(`[Server] ${signal} received — shutting down gracefully`);
  if ((global as any).__httpServer) {
    (global as any).__httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
    // Force-exit after 5 s if connections are still open
    setTimeout(() => process.exit(0), 5000).unref();
  } else {
    process.exit(0);
  }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Validate required environment variables before starting
function validateRequiredEnvVars() {
  const required = ['DATABASE_URL'];
  const recommended = ['JWT_SECRET', 'SENDGRID_API_KEY', 'STRIPE_SECRET_KEY'];

  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const missingRecommended = recommended.filter(v => !process.env[v]);
  if (missingRecommended.length > 0) {
    console.warn(`WARNING: Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
}

validateRequiredEnvVars();

const app = express();

app.use((req, res, next) => { res.setMaxListeners(50); next(); });
app.use(requestIdMiddleware);

configureSecurityMiddleware(app);

// Enhanced security headers (CSP hardening, Permissions-Policy, etc.)
configureEnhancedSecurityHeaders(app);

// Stripe webhook route placeholder (payment integration coming soon)
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (_req, res) => {
    res.status(503).json({ message: 'Payment webhooks coming soon' });
  }
);

// Default body size limit — keep it small to prevent abuse.
// File-upload routes should use their own higher-limit parser.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Higher limit for file upload routes
app.use('/api/uploads', express.json({ limit: '10mb' }));
app.use('/api/documents/upload', express.json({ limit: '10mb' }));

app.use(requestLoggingMiddleware);

// Global rate limit — 100 req/min per user (Redis-backed)
// NOTE: security.ts already applies /api/ rate limit (300/15min) and /api/auth/login limit (10/15min).
// This global limiter adds a per-minute cap on top.
app.use(globalRateLimit);

// NOTE: Removed duplicate loginRateLimit here — security.ts already applies one at line 86.
// Having two separate rate limiters on the same path caused double-counting.

// Track failed logins per IP — block after 10 consecutive failures for 15 minutes.
// (Reduced from 5 failures / 30 min which was too aggressive)
app.use('/api/auth/login', failedLoginTracker);

// Enhanced health check routes (mounted BEFORE auth middleware)
// Provides /health, /health/live, /health/ready endpoints
app.use(healthRoutes);

// API deprecation warning for legacy /api/* routes (sunset 2027-06-01)
// Clients should migrate to /api/v1/*
app.use('/api', deprecationWarning('2027-06-01'));

(async () => {
  try {
    const server = await registerRoutes(app);
    (global as any).__httpServer = server; // used by gracefulShutdown

    // Auth middleware for routes mounted outside registerRoutes()
    app.use(authenticateUser);

    // Then add after auth routes:
    app.use('/api/settings', settingsRoutes);
    app.use('/api', legalBenchmarkingRoutes);
    app.use('/api/valuator/:projectId/leases', leasesRouter);
    app.use('/api/wizard-drafts', wizardDraftsRouter);
app.use(ddChecklistRouter);
    app.use(workspaceRouter);
    // exitStudioRouter mounted in routes.ts with auth middleware

    // Initialize Docket storage and register routes
    const docketStorage = new DocketStorage();
    registerDocketRoutes(app, docketStorage);

    app.use(centralizedErrorHandler);

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    // Start document export job processor
import('./services/document-builder/export-job-processor').then(({ exportJobProcessor }) => {
  exportJobProcessor.startProcessing(5000); // poll every 5s
  console.log('[DocumentBuilder] Export job processor started');
}).catch(err => console.warn('[DocumentBuilder] Export processor failed to start:', err.message));

server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    
      // Initialize background services in parallel without blocking
      // This allows the HTTP server to respond immediately
      
      // Synchronous services - start immediately
      try {
        deadlineMonitor.start();
        log('Deadline monitoring service started');
      } catch (error) {
        log(`Failed to start deadline monitoring service: ${error}`);
      }

      docIntelService.recoverStuckUploads().then(count => {
        if (count > 0) log(`[DocIntel] Recovered ${count} stuck document(s)`);
      }).catch(err => {
        log(`[DocIntel] Recovery check failed: ${err.message}`);
      });

      // DISABLED: Docket, MarinaMatch Intel, and Listing Scraper cron jobs turned off to reduce RAM usage.
      // Re-enable by uncommenting the blocks below.
      /*
      try {
        startDocketCronJobs(docketStorage);
        log('Docket background jobs started');
      } catch (error) {
        log(`Failed to start Docket background jobs: ${error}`);
      }

      try {
        startMarinaMatchIntelCronJobs();
        log('MarinaMatch Intel background jobs started');
      } catch (error) {
        log(`Failed to start MarinaMatch Intel background jobs: ${error}`);
      }

      try {
        startListingScheduler();
        log('MarinaMatch listing scrape scheduler started');

        // Auto-seed global broker sources in background
        autoSeedGlobalBrokerSources().then(result => {
          if (result.created > 0 || result.updated > 0) {
            log(`[Global Brokers] Auto-seeded: ${result.created} created, ${result.updated} updated`);
          }
        }).catch(err => {
          log(`[Global Brokers] Auto-seed failed: ${err.message}`);
        });
      } catch (error) {
        log(`Failed to start MarinaMatch listing scheduler: ${error}`);
      }
      */

      // Skip Docket WebSocket in development to avoid conflict with Vite HMR WebSocket
      if (process.env.NODE_ENV !== 'development') {
        try {
          initializeWebSocket(server);
          log('Docket WebSocket initialized');
        } catch (error) {
          log(`Failed to initialize Docket WebSocket: ${error}`);
        }
      } else {
        log('Docket WebSocket disabled in development mode (use production for real-time updates)');
      }

      // Async services - run in background without awaiting
      seedIntegrations()
        .then(() => log('Integration catalog seeded'))
        .catch((error) => log(`Failed to seed integrations: ${error}`));

      reconciliationService.start()
        .then(() => log('Document reconciliation service started'))
        .catch((error) => log(`Failed to start document reconciliation service: ${error}`));

      vdrFileService.initialize()
        .then(() => log('VDR file service initialized'))
        .catch((error) => log(`Failed to initialize VDR file service: ${error}`));

      seedMarinaTaxonomyPack()
        .then((packId) => log(`[COA] Marina taxonomy pack ready: ${packId}`))
        .catch((error) => log(`[COA] Failed to seed taxonomy: ${error}`));

    });
  } catch (error) {
    console.error('Fatal error during server initialization:', error);
    process.exit(1);
  }
})();
