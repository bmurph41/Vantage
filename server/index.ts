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

import { configureSecurityMiddleware } from "./middleware/security";
import { requestIdMiddleware, requestLoggingMiddleware } from "./middleware/logging";
import { centralizedErrorHandler, notFoundHandler } from "./middleware/error-handler";
import { tenantContextMiddleware } from "./middleware/tenant-context";
import { logger } from "./lib/logger";

const app = express();

app.use(requestIdMiddleware);

configureSecurityMiddleware(app);

// Stripe webhook route must be BEFORE express.json() to receive raw body
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { WebhookHandlers } = await import('./webhookHandlers');
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(requestLoggingMiddleware);

(async () => {
  try {
    const server = await registerRoutes(app);

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
