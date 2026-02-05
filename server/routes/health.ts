/**
 * Health Check Routes
 * 
 * Provides three endpoints:
 * - GET /health/live   → Liveness probe (is the process running?)
 * - GET /health/ready  → Readiness probe (are dependencies healthy?)
 * - GET /health        → Combined status (alias for /health/ready)
 * 
 * Usage in index.ts:
 *   import healthRoutes from './routes/health';
 *   app.use(healthRoutes);  // Mount BEFORE auth middleware
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

const router = Router();

// ─── Types ───────────────────────────────────────────────────────────────────

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  uptime: number;
  timestamp: string;
  checks: Record<string, HealthCheck>;
}

// ─── Check Functions ─────────────────────────────────────────────────────────

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: error.message,
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Dynamic import — Redis may not be configured
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return { status: 'healthy', latencyMs: 0 }; // Redis not configured, skip
    }

    const Redis = (await import('ioredis')).default;
    const client = new Redis(redisUrl, { connectTimeout: 2000, lazyConnect: true });
    await client.ping();
    await client.quit();

    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      status: 'degraded', // Redis failure is degraded, not unhealthy (fallback exists)
      latencyMs: Date.now() - start,
      error: error.message,
    };
  }
}

function checkMemory(): HealthCheck {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const heapPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  if (heapPercent > 95) {
    return {
      status: 'unhealthy',
      error: `Heap usage critical: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`,
    };
  }

  if (heapPercent > 85) {
    return {
      status: 'degraded',
      error: `Heap usage high: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`,
    };
  }

  return { status: 'healthy' };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * Liveness probe — is the process running?
 * Kubernetes/load balancers use this to know if the container is alive.
 * Should always return 200 unless the process is truly hung.
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
});

/**
 * Readiness probe — are all dependencies healthy?
 * Kubernetes uses this to decide if the pod can accept traffic.
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  const [database, redis, memory] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkMemory()),
  ]);

  const checks: Record<string, HealthCheck> = { database, redis, memory };

  // Determine overall status
  const statuses = Object.values(checks).map(c => c.status);
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

  if (statuses.includes('unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded';
  }

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  const response: HealthResponse = {
    status: overallStatus,
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
  };

  if (overallStatus !== 'healthy') {
    logger.warn({ type: 'health_check', ...response }, 'Health check returned non-healthy status');
  }

  res.status(statusCode).json(response);
});

/**
 * Combined health endpoint (alias for readiness).
 */
router.get('/health', async (req: Request, res: Response) => {
  // Forward to the ready handler
  req.url = '/health/ready';
  router.handle(req, res, () => {});
});

export default router;
