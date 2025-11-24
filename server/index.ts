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

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Initialize DockTalk storage and register routes
    const dockTalkStorage = new DockTalkStorage();
    registerDockTalkRoutes(app, dockTalkStorage);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

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
    }, async () => {
      log(`serving on port ${port}`);
    
    // Start deadline monitoring service after server is ready
    try {
      deadlineMonitor.start();
      log('Deadline monitoring service started');
    } catch (error) {
      log(`Failed to start deadline monitoring service: ${error}`);
    }

    // Start document reconciliation service after server is ready
    try {
      await reconciliationService.start();
      log('Document reconciliation service started');
    } catch (error) {
      log(`Failed to start document reconciliation service: ${error}`);
    }

    // Initialize VDR file service directories
    try {
      await vdrFileService.initialize();
      log('VDR file service initialized');
    } catch (error) {
      log(`Failed to initialize VDR file service: ${error}`);
    }

    // Start DockTalk background jobs (RSS fetching, AI enrichment, etc.)
    try {
      startDockTalkCronJobs(dockTalkStorage);
      log('DockTalk background jobs started');
    } catch (error) {
      log(`Failed to start DockTalk background jobs: ${error}`);
    }

    // Initialize DockTalk WebSocket for real-time article updates
    try {
      initializeWebSocket(server);
      log('DockTalk WebSocket initialized');
    } catch (error) {
      log(`Failed to initialize DockTalk WebSocket: ${error}`);
    }

    });
  } catch (error) {
    console.error('Fatal error during server initialization:', error);
    process.exit(1);
  }
})();
