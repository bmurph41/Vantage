import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { deadlineMonitor } from "./deadline-monitor";
import { reconciliationService } from "./reconciliation-service";
import { vdrFileService } from "./vdr-file-service";
import { registerDockTalkRoutes } from "./docktalk/routes";
import { startDockTalkCronJobs } from "./docktalk/cron-jobs";
import { DatabaseStorage as DockTalkStorage } from "./docktalk/storage";
import { initializeWebSocket } from "./docktalk/websocket";
import { startMarinaMatchIntelCronJobs } from "./marinamatch/services/intel-cron";
import { startScheduler as startListingScheduler } from "./marinamatch/services/listing-scheduler";
import { autoSeedGlobalBrokerSources } from "./marinamatch/services/global-broker-sources";
import { seedIntegrations } from "./integrations";
import { docIntelService } from "./services/doc-intel-service";

import { configureSecurityMiddleware } from "./middleware/security";
import { requestIdMiddleware, requestLoggingMiddleware } from "./middleware/logging";
import { centralizedErrorHandler, notFoundHandler } from "./middleware/error-handler";
import { tenantContextMiddleware } from "./middleware/tenant-context";
import { logger } from "./lib/logger";
import settingsRoutes from './routes/settings-routes';
import leasesRouter from './routes/leases';
import wizardDraftsRouter from './routes/wizard-drafts';
import { workspaceRouter } from './routes/workspace-routes';
import { ddChecklistRouter } from "./routes/dd-checklist-routes";
import healthRoutes from './routes/health';
import { deprecationWarning } from './routes/api-versioning';
import { exitStudioRouter } from './routes/exit-studio-routes';

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();

app.use(requestIdMiddleware);

configureSecurityMiddleware(app);

// Stripe webhook route placeholder (payment integration coming soon)
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (_req, res) => {
    res.status(503).json({ message: 'Payment webhooks coming soon' });
  }
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(requestLoggingMiddleware);

// Enhanced health check routes (mounted BEFORE auth middleware)
// Provides /health, /health/live, /health/ready endpoints
app.use(healthRoutes);

// API deprecation warning for legacy /api/* routes (sunset 2027-06-01)
// Clients should migrate to /api/v1/*
app.use('/api', deprecationWarning('2027-06-01'));

(async () => {
  try {
    const server = await registerRoutes(app);
    // Then add after auth routes:
    app.use('/api/settings', settingsRoutes);
    app.use('/api/valuator/:projectId/leases', leasesRouter);
    app.use('/api/wizard-drafts', wizardDraftsRouter);
app.use(ddChecklistRouter);
    app.use(workspaceRouter);
    app.use(exitStudioRouter);

    // Initialize DockTalk storage and register routes
    const dockTalkStorage = new DockTalkStorage();
    registerDockTalkRoutes(app, dockTalkStorage);

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

      try {
        startDockTalkCronJobs(dockTalkStorage);
        log('DockTalk background jobs started');
      } catch (error) {
        log(`Failed to start DockTalk background jobs: ${error}`);
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

      // Skip DockTalk WebSocket in development to avoid conflict with Vite HMR WebSocket
      if (process.env.NODE_ENV !== 'development') {
        try {
          initializeWebSocket(server);
          log('DockTalk WebSocket initialized');
        } catch (error) {
          log(`Failed to initialize DockTalk WebSocket: ${error}`);
        }
      } else {
        log('DockTalk WebSocket disabled in development mode (use production for real-time updates)');
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

    });
  } catch (error) {
    console.error('Fatal error during server initialization:', error);
    process.exit(1);
  }
})();
