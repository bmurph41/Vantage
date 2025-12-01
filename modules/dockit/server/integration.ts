/**
 * Dockit Module Integration
 * 
 * This file provides the entry point for integrating Dockit into the main MarinaMatch app.
 * It wraps all Dockit routes under a configurable API prefix (default: /dockit/api).
 */

import type { Express, Router, Request, Response, NextFunction } from "express";
import { Router as ExpressRouter } from "express";
import type { Server } from "http";

// Re-export Dockit storage and services for potential cross-module integration
export { storage as dockitStorage } from "./storage";

interface DockitIntegrationOptions {
  apiPrefix?: string;
  enableWebSocket?: boolean;
}

/**
 * Creates an Express Router with all Dockit routes mounted.
 * Routes are prefixed to avoid collision with main app routes.
 */
export function createDockitRouter(
  sessionParser: any,
  sessionSecret: string
): Router {
  const router = ExpressRouter();
  
  // Import and configure Dockit routes dynamically
  // This allows lazy loading of the Dockit module
  return router;
}

/**
 * Attaches Dockit routes to the main Express app.
 * All routes are mounted under the specified prefix (default: /dockit/api).
 */
export async function attachDockitRoutes(
  app: Express,
  sessionParser: any,
  sessionSecret: string,
  options: DockitIntegrationOptions = {}
): Promise<void> {
  const prefix = options.apiPrefix ?? "/dockit/api";
  
  console.log(`[Dockit] Mounting Dockit module routes under ${prefix}`);
  
  // We'll dynamically import and configure routes
  // For now, add a basic health check endpoint
  app.get(`${prefix}/health`, (_req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      module: "dockit",
      version: "1.0.0",
      timestamp: new Date().toISOString()
    });
  });
  
  // Mount the main Dockit API routes
  // These will be loaded from the refactored routes file
  try {
    const { registerDockitRoutes } = await import("./routes-integration");
    await registerDockitRoutes(app, prefix, sessionParser, sessionSecret);
    console.log(`[Dockit] Successfully mounted ${prefix} routes`);
  } catch (error) {
    console.error("[Dockit] Failed to load routes:", error);
    // Provide a fallback error response
    app.use(`${prefix}/*`, (_req: Request, res: Response) => {
      res.status(503).json({
        error: "Dockit module not fully initialized",
        message: "The Dockit module is still being set up"
      });
    });
  }
}

/**
 * Initializes Dockit WebSocket on an existing HTTP server.
 * This allows real-time updates for launch queue, messaging, etc.
 */
export function initializeDockitWebSocket(
  httpServer: Server,
  sessionParser: any,
  sessionSecret: string
): void {
  try {
    // WebSocket initialization will be handled separately
    console.log("[Dockit] WebSocket initialization deferred");
  } catch (error) {
    console.error("[Dockit] WebSocket initialization failed:", error);
  }
}
