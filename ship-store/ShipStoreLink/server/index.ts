import express, { type Request, Response, NextFunction } from "express";
import morgan from "morgan";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupSecurity } from "./middleware/security";
import logger, { logError, logInfo } from "./config/logger";
import { env } from "./config/env";

const app = express();

// Trust proxy - needed for rate limiting behind reverse proxies (Replit, load balancers)
app.set('trust proxy', 1);

// Security middleware (CORS, Helmet, Rate Limiting)
setupSecurity(app);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// HTTP request logging in development
if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

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
  const server = await registerRoutes(app);

  // Global error handler with logging
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details
    logError(`${req.method} ${req.path}`, err, {
      status,
      user: (req as any).user?.id,
      body: req.body,
      query: req.query,
    });

    res.status(status).json({ message });
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
  const port = env.PORT;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    logInfo(`Ship Store started successfully`, {
      port,
      environment: env.NODE_ENV,
      nodeVersion: process.version,
    });
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    logInfo("SIGTERM received, shutting down gracefully");
    server.close(() => {
      logInfo("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    logInfo("SIGINT received, shutting down gracefully");
    server.close(() => {
      logInfo("Server closed");
      process.exit(0);
    });
  });
})();
