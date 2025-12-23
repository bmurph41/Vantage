import { runIngestion } from './runIngestion';
import { V2_CONFIG, isV2Enabled } from '../config';
import { logger } from '../utils/logger';
import { db } from '../../../db';
import { users } from '@shared/docktalk-schema';
import { eq } from 'drizzle-orm';

let runnerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

export function startDockTalkV2Runner(): void {
  if (!isV2Enabled()) {
    logger.info({
      module: 'docktalk_v2',
      event: 'runner_disabled',
      message: 'DockTalk V2 runner is disabled. Set DOCKTALK_SCRAPER_V2=true to enable.',
    });
    return;
  }
  
  if (runnerInterval) {
    logger.warn({
      module: 'docktalk_v2',
      event: 'runner_already_started',
    });
    return;
  }
  
  const intervalMs = V2_CONFIG.scheduler.intervalMinutes * 60 * 1000;
  
  logger.info({
    module: 'docktalk_v2',
    event: 'runner_started',
    intervalMinutes: V2_CONFIG.scheduler.intervalMinutes,
  });
  
  runnerInterval = setInterval(runScheduledIngestion, intervalMs);
  
  setTimeout(runScheduledIngestion, 5000);
}

export function stopDockTalkV2Runner(): void {
  if (runnerInterval) {
    clearInterval(runnerInterval);
    runnerInterval = null;
    logger.info({
      module: 'docktalk_v2',
      event: 'runner_stopped',
    });
  }
}

async function runScheduledIngestion(): Promise<void> {
  if (isRunning) {
    logger.info({
      module: 'docktalk_v2',
      event: 'ingestion_skipped',
      reason: 'Previous run still in progress',
    });
    return;
  }
  
  isRunning = true;
  
  try {
    const activeUsers = await getActiveUsers();
    
    logger.info({
      module: 'docktalk_v2',
      event: 'scheduled_run_start',
      userCount: activeUsers.length,
    });
    
    const maxConcurrent = V2_CONFIG.scheduler.maxConcurrentRuns;
    
    for (let i = 0; i < activeUsers.length; i += maxConcurrent) {
      const batch = activeUsers.slice(i, i + maxConcurrent);
      
      await Promise.all(
        batch.map(async (user) => {
          try {
            const runId = await runIngestion(user.id, user.orgId, 'scheduler');
            logger.info({
              module: 'docktalk_v2',
              event: 'user_ingestion_complete',
              userId: user.id,
              runId,
            });
          } catch (error) {
            logger.error({
              module: 'docktalk_v2',
              event: 'user_ingestion_failed',
              userId: user.id,
              error: (error as Error).message,
            });
          }
        })
      );
    }
    
    logger.info({
      module: 'docktalk_v2',
      event: 'scheduled_run_complete',
    });
    
  } catch (error) {
    logger.error({
      module: 'docktalk_v2',
      event: 'scheduled_run_error',
      error: (error as Error).message,
    });
  } finally {
    isRunning = false;
  }
}

async function getActiveUsers(): Promise<Array<{ id: string; orgId: string }>> {
  try {
    const result = await db.select({
      id: users.id,
      orgId: users.orgId,
    })
      .from(users)
      .where(eq(users.isActive, true))
      .limit(100);
    
    return result.filter((u): u is { id: string; orgId: string } => 
      u.id !== null && u.orgId !== null
    );
  } catch {
    return [];
  }
}

export async function triggerManualIngestion(userId: string, orgId: string): Promise<string> {
  return runIngestion(userId, orgId, 'manual');
}

export function getRunnerStatus(): { enabled: boolean; running: boolean; intervalMinutes: number } {
  return {
    enabled: isV2Enabled(),
    running: isRunning,
    intervalMinutes: V2_CONFIG.scheduler.intervalMinutes,
  };
}
