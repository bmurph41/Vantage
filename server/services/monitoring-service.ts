import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { cacheService } from './cache-service';
import { jobQueueService } from './job-queue-service';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: ComponentHealth;
    cache: ComponentHealth;
    jobQueue: ComponentHealth;
    memory: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  message?: string;
  latencyMs?: number;
}

interface ApplicationMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
  jobQueue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  requests: {
    total: number;
    avgResponseTimeMs: number;
    errorRate: number;
  };
}

class MonitoringService {
  private startTime: Date;
  private requestCount: number = 0;
  private totalResponseTime: number = 0;
  private errorCount: number = 0;

  constructor() {
    this.startTime = new Date();
  }

  recordRequest(responseTimeMs: number, isError: boolean): void {
    this.requestCount++;
    this.totalResponseTime += responseTimeMs;
    if (isError) {
      this.errorCount++;
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
      this.checkJobQueue(),
      this.checkMemory(),
    ]);

    const [database, cache, jobQueue, memory] = checks;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (database.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (cache.status === 'unhealthy' || jobQueue.status === 'unhealthy' || memory.status === 'unhealthy') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: this.getUptimeSeconds(),
      version: process.env.npm_package_version || '1.0.0',
      checks: { database, cache, jobQueue, memory },
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Database health check failed');
      return {
        status: 'unhealthy',
        message: 'Database connection failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  private async checkCache(): Promise<ComponentHealth> {
    try {
      const stats = cacheService.getStats();
      return {
        status: 'healthy',
        message: `${stats.size} entries, ${(stats.hitRate * 100).toFixed(1)}% hit rate`,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: 'Cache check failed',
      };
    }
  }

  private async checkJobQueue(): Promise<ComponentHealth> {
    try {
      const stats = await jobQueueService.getQueueStats();
      return {
        status: 'healthy',
        message: `${stats.pending} pending, ${stats.processing} processing`,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: 'Job queue check failed',
      };
    }
  }

  private checkMemory(): ComponentHealth {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;
    
    if (heapUsagePercent > 90) {
      return {
        status: 'unhealthy',
        message: `Memory usage critical: ${heapUsagePercent.toFixed(1)}%`,
      };
    }
    
    return {
      status: 'healthy',
      message: `${heapUsedMB.toFixed(1)}MB / ${heapTotalMB.toFixed(1)}MB (${heapUsagePercent.toFixed(1)}%)`,
    };
  }

  async getMetrics(): Promise<ApplicationMetrics> {
    const memUsage = process.memoryUsage();
    const cacheStats = cacheService.getStats();
    
    let jobStats = { pending: 0, processing: 0, completed: 0, failed: 0, byType: {} };
    try {
      jobStats = await jobQueueService.getQueueStats();
    } catch (e) {
    }

    return {
      timestamp: new Date().toISOString(),
      uptime: this.getUptimeSeconds(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        size: cacheStats.size,
      },
      jobQueue: {
        pending: jobStats.pending,
        processing: jobStats.processing,
        completed: jobStats.completed,
        failed: jobStats.failed,
      },
      requests: {
        total: this.requestCount,
        avgResponseTimeMs: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
        errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      },
    };
  }

  private getUptimeSeconds(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  getReadinessCheck(): { ready: boolean; message: string } {
    return { ready: true, message: 'Application is ready to accept traffic' };
  }

  getLivenessCheck(): { alive: boolean; message: string } {
    return { alive: true, message: 'Application is running' };
  }
}

export const monitoringService = new MonitoringService();
