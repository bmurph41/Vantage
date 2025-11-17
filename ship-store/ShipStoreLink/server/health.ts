import type { Request, Response } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Health check endpoint for monitoring and parent app integration
 * Returns 200 OK if all systems are operational
 * Returns 503 Service Unavailable if any critical system is down
 */
export async function healthCheck(req: Request, res: Response) {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    checks: {
      database: "unknown" as "healthy" | "unhealthy" | "unknown",
      memory: "unknown" as "healthy" | "unhealthy" | "unknown",
    },
  };

  try {
    // Database check
    await db.execute(sql`SELECT 1`);
    health.checks.database = "healthy";
  } catch (error) {
    health.checks.database = "unhealthy";
    health.status = "unhealthy";
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const memUsageMB = memUsage.heapUsed / 1024 / 1024;
  const memLimitMB = memUsage.heapTotal / 1024 / 1024;

  health.checks.memory = memUsageMB < (memLimitMB * 0.9) ? "healthy" : "unhealthy";

  if (health.checks.memory === "unhealthy") {
    health.status = "degraded";
  }

  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  res.status(statusCode).json(health);
}

/**
 * Readiness check - determines if app is ready to receive traffic
 * Used by load balancers and orchestrators
 */
export async function readinessCheck(req: Request, res: Response) {
  try {
    // Check database connection
    await db.execute(sql`SELECT 1`);
    
    res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "not ready",
      reason: "Database connection failed",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Liveness check - determines if app is alive
 * Used by orchestrators to decide if container should be restarted
 */
export async function livenessCheck(req: Request, res: Response) {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
