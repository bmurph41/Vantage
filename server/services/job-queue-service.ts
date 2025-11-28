import { db } from '../db';
import { and, eq, lt, gt, desc, asc, sql, or, inArray } from 'drizzle-orm';
import { backgroundJobs, type BackgroundJob, type InsertBackgroundJob } from '@shared/schema';
import { logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

export type JobType = 
  | 'analytics_update'
  | 'docktalk_refresh'
  | 'docktalk_sentiment'
  | 'document_parse'
  | 'portfolio_rollup'
  | 'benchmark_comparison'
  | 'sensitivity_analysis'
  | 'export_generation'
  | 'notification_batch'
  | 'cleanup';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

interface JobPayload {
  [key: string]: any;
}

interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

type JobHandler = (job: BackgroundJob) => Promise<JobResult>;

class JobQueueService {
  private handlers: Map<JobType, JobHandler> = new Map();
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 5000;
  private readonly MAX_RETRIES = 3;
  private readonly STALE_JOB_THRESHOLD_MS = 30 * 60 * 1000;
  private readonly JOB_RETENTION_DAYS = 7;
  
  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    this.registerHandler('cleanup', async () => {
      await this.cleanupOldJobs();
      return { success: true, data: { message: 'Cleanup completed' } };
    });
  }

  registerHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
    logger.info({ type }, 'Registered job handler');
  }

  async enqueue(
    type: JobType,
    payload: JobPayload,
    options: {
      priority?: JobPriority;
      orgId?: string;
      userId?: string;
      scheduledFor?: Date;
      maxRetries?: number;
    } = {}
  ): Promise<BackgroundJob> {
    const { priority = 'normal', orgId, userId, scheduledFor, maxRetries = this.MAX_RETRIES } = options;
    
    const priorityValue = this.getPriorityValue(priority);
    
    const job: InsertBackgroundJob = {
      id: uuidv4(),
      type,
      status: 'pending',
      priority: priorityValue,
      payload: payload as any,
      orgId: orgId || null,
      userId: userId || null,
      scheduledFor: scheduledFor || new Date(),
      maxRetries,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [created] = await db.insert(backgroundJobs).values(job).returning();
    
    logger.info({ jobId: created.id, type, priority }, 'Job enqueued');
    
    return created;
  }

  async enqueueBatch(
    jobs: Array<{
      type: JobType;
      payload: JobPayload;
      priority?: JobPriority;
      orgId?: string;
      userId?: string;
    }>
  ): Promise<BackgroundJob[]> {
    const jobRecords = jobs.map(job => ({
      id: uuidv4(),
      type: job.type,
      status: 'pending' as const,
      priority: this.getPriorityValue(job.priority || 'normal'),
      payload: job.payload as any,
      orgId: job.orgId || null,
      userId: job.userId || null,
      scheduledFor: new Date(),
      maxRetries: this.MAX_RETRIES,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const created = await db.insert(backgroundJobs).values(jobRecords).returning();
    
    logger.info({ count: created.length }, 'Batch jobs enqueued');
    
    return created;
  }

  private getPriorityValue(priority: JobPriority): number {
    switch (priority) {
      case 'critical': return 0;
      case 'high': return 1;
      case 'normal': return 2;
      case 'low': return 3;
      default: return 2;
    }
  }

  async getJob(jobId: string): Promise<BackgroundJob | undefined> {
    const [job] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, jobId));
    return job;
  }

  async getJobsByOrg(
    orgId: string,
    options: { status?: JobStatus; limit?: number; offset?: number } = {}
  ): Promise<BackgroundJob[]> {
    const { status, limit = 50, offset = 0 } = options;
    
    let conditions = eq(backgroundJobs.orgId, orgId);
    if (status) {
      conditions = and(conditions, eq(backgroundJobs.status, status))!;
    }

    return db.select()
      .from(backgroundJobs)
      .where(conditions)
      .orderBy(desc(backgroundJobs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getQueueStats(orgId?: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    byType: Record<string, number>;
  }> {
    const baseCondition = orgId ? eq(backgroundJobs.orgId, orgId) : sql`1=1`;
    
    const [stats] = await db.select({
      pending: sql<number>`count(*) filter (where ${backgroundJobs.status} = 'pending')`,
      processing: sql<number>`count(*) filter (where ${backgroundJobs.status} = 'processing')`,
      completed: sql<number>`count(*) filter (where ${backgroundJobs.status} = 'completed')`,
      failed: sql<number>`count(*) filter (where ${backgroundJobs.status} = 'failed')`,
    }).from(backgroundJobs).where(baseCondition);

    const typeStats = await db.select({
      type: backgroundJobs.type,
      count: sql<number>`count(*)`
    }).from(backgroundJobs)
      .where(and(baseCondition, eq(backgroundJobs.status, 'pending')))
      .groupBy(backgroundJobs.type);

    const byType: Record<string, number> = {};
    typeStats.forEach(s => {
      byType[s.type] = Number(s.count);
    });

    return {
      pending: Number(stats?.pending || 0),
      processing: Number(stats?.processing || 0),
      completed: Number(stats?.completed || 0),
      failed: Number(stats?.failed || 0),
      byType
    };
  }

  async cancelJob(jobId: string): Promise<BackgroundJob | undefined> {
    const [updated] = await db.update(backgroundJobs)
      .set({ 
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(and(
        eq(backgroundJobs.id, jobId),
        inArray(backgroundJobs.status, ['pending', 'processing'])
      ))
      .returning();
    
    if (updated) {
      logger.info({ jobId }, 'Job cancelled');
    }
    
    return updated;
  }

  async retryJob(jobId: string): Promise<BackgroundJob | undefined> {
    const [updated] = await db.update(backgroundJobs)
      .set({
        status: 'pending',
        retryCount: 0,
        error: null,
        updatedAt: new Date()
      })
      .where(and(
        eq(backgroundJobs.id, jobId),
        eq(backgroundJobs.status, 'failed')
      ))
      .returning();
    
    if (updated) {
      logger.info({ jobId }, 'Job scheduled for retry');
    }
    
    return updated;
  }

  private async fetchNextJob(): Promise<BackgroundJob | undefined> {
    const now = new Date();
    
    const [job] = await db.select()
      .from(backgroundJobs)
      .where(and(
        eq(backgroundJobs.status, 'pending'),
        lt(backgroundJobs.scheduledFor, now)
      ))
      .orderBy(asc(backgroundJobs.priority), asc(backgroundJobs.scheduledFor))
      .limit(1);
    
    if (!job) return undefined;

    const [claimed] = await db.update(backgroundJobs)
      .set({
        status: 'processing',
        startedAt: now,
        updatedAt: now
      })
      .where(and(
        eq(backgroundJobs.id, job.id),
        eq(backgroundJobs.status, 'pending')
      ))
      .returning();
    
    return claimed;
  }

  private async processJob(job: BackgroundJob): Promise<void> {
    const handler = this.handlers.get(job.type as JobType);
    
    if (!handler) {
      logger.warn({ jobId: job.id, type: job.type }, 'No handler registered for job type');
      await this.markJobFailed(job.id, `No handler registered for job type: ${job.type}`);
      return;
    }

    try {
      logger.info({ jobId: job.id, type: job.type }, 'Processing job');
      
      const result = await handler(job);
      
      if (result.success) {
        await this.markJobCompleted(job.id, result.data);
      } else {
        throw new Error(result.error || 'Job handler returned failure');
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      logger.error({ jobId: job.id, type: job.type, error: errorMessage }, 'Job processing failed');
      
      if (job.retryCount < job.maxRetries) {
        await this.scheduleRetry(job, errorMessage);
      } else {
        await this.markJobFailed(job.id, errorMessage);
      }
    }
  }

  private async markJobCompleted(jobId: string, result: any): Promise<void> {
    await db.update(backgroundJobs)
      .set({
        status: 'completed',
        result: result as any,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(backgroundJobs.id, jobId));
    
    logger.info({ jobId }, 'Job completed successfully');
  }

  private async markJobFailed(jobId: string, error: string): Promise<void> {
    await db.update(backgroundJobs)
      .set({
        status: 'failed',
        error,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(backgroundJobs.id, jobId));
    
    logger.warn({ jobId, error }, 'Job failed permanently');
  }

  private async scheduleRetry(job: BackgroundJob, error: string): Promise<void> {
    const nextRetryCount = job.retryCount + 1;
    const backoffMs = Math.pow(2, nextRetryCount) * 1000;
    const scheduledFor = new Date(Date.now() + backoffMs);

    await db.update(backgroundJobs)
      .set({
        status: 'pending',
        retryCount: nextRetryCount,
        scheduledFor,
        error,
        updatedAt: new Date()
      })
      .where(eq(backgroundJobs.id, job.id));
    
    logger.info({ jobId: job.id, retryCount: nextRetryCount, scheduledFor }, 'Job scheduled for retry');
  }

  private async recoverStaleJobs(): Promise<void> {
    const staleThreshold = new Date(Date.now() - this.STALE_JOB_THRESHOLD_MS);
    
    const staleJobs = await db.update(backgroundJobs)
      .set({
        status: 'pending',
        error: 'Job recovered from stale state',
        updatedAt: new Date()
      })
      .where(and(
        eq(backgroundJobs.status, 'processing'),
        lt(backgroundJobs.startedAt, staleThreshold)
      ))
      .returning();
    
    if (staleJobs.length > 0) {
      logger.warn({ count: staleJobs.length }, 'Recovered stale jobs');
    }
  }

  private async cleanupOldJobs(): Promise<void> {
    const retentionDate = new Date(Date.now() - this.JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    
    const deleted = await db.delete(backgroundJobs)
      .where(and(
        inArray(backgroundJobs.status, ['completed', 'cancelled', 'failed']),
        lt(backgroundJobs.completedAt, retentionDate)
      ))
      .returning();
    
    if (deleted.length > 0) {
      logger.info({ count: deleted.length }, 'Cleaned up old jobs');
    }
  }

  async start(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Job queue already running');
      return;
    }

    this.isProcessing = true;
    logger.info('Starting job queue processor');

    await this.recoverStaleJobs();

    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) return;

      try {
        const job = await this.fetchNextJob();
        if (job) {
          await this.processJob(job);
        }
      } catch (error: any) {
        logger.error({ error: error.message }, 'Error in job queue processing loop');
      }
    }, this.POLL_INTERVAL_MS);

    setInterval(() => {
      this.recoverStaleJobs().catch(err => {
        logger.error({ error: err.message }, 'Error recovering stale jobs');
      });
    }, this.STALE_JOB_THRESHOLD_MS / 2);

    setInterval(() => {
      this.enqueue('cleanup', {}).catch(err => {
        logger.error({ error: err.message }, 'Error scheduling cleanup job');
      });
    }, 24 * 60 * 60 * 1000);
  }

  async stop(): Promise<void> {
    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    logger.info('Job queue processor stopped');
  }

  async processNow(jobId: string): Promise<JobResult> {
    const job = await this.getJob(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    const handler = this.handlers.get(job.type as JobType);
    if (!handler) {
      return { success: false, error: `No handler for job type: ${job.type}` };
    }

    await db.update(backgroundJobs)
      .set({
        status: 'processing',
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(backgroundJobs.id, jobId));

    try {
      const result = await handler(job);
      
      if (result.success) {
        await this.markJobCompleted(jobId, result.data);
      } else {
        await this.markJobFailed(jobId, result.error || 'Unknown error');
      }
      
      return result;
    } catch (error: any) {
      await this.markJobFailed(jobId, error.message);
      return { success: false, error: error.message };
    }
  }
}

export const jobQueueService = new JobQueueService();
