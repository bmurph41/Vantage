/**
 * PNL Job Retry
 *
 * Polls for failed pnl_jobs with retry_count < 3 and re-runs them through
 * the pipeline. Called from a platform cron tick (every 15 minutes).
 *
 * Simple strategy: re-queue up to 5 failed jobs per tick, increment
 * retry_count, reset status to 'queued'. The existing runPnlPipeline
 * handles the rest.
 */

import { pool } from "../../db";
import { logger } from "../../lib/logger";

const MAX_RETRIES = 3;
const BATCH_LIMIT = 5;

export async function retryFailedPnlJobs(): Promise<{ retried: number }> {
  const { rows: failed } = await pool.query(
    `SELECT id FROM pnl_jobs
      WHERE status = 'failed'
        AND retry_count < $1
      ORDER BY updated_at ASC
      LIMIT $2`,
    [MAX_RETRIES, BATCH_LIMIT],
  );

  if (failed.length === 0) return { retried: 0 };

  let retried = 0;

  for (const row of failed) {
    // Bump retry + reset to queued so the pipeline picks it up
    const { rowCount } = await pool.query(
      `UPDATE pnl_jobs
          SET status = 'queued',
              retry_count = retry_count + 1,
              last_error = NULL,
              updated_at = NOW()
        WHERE id = $1 AND status = 'failed'`,
      [row.id],
    );
    if (!rowCount) continue;

    // Fire-and-forget the pipeline run
    try {
      const { runPnlPipeline } = await import("./parseOrchestrator");
      runPnlPipeline(row.id).catch((err) => {
        logger.error({ err, jobId: row.id }, "[pnl-retry] pipeline run failed on retry");
      });
      retried++;
    } catch (err) {
      logger.error({ err, jobId: row.id }, "[pnl-retry] failed to import pipeline");
    }
  }

  if (retried > 0) {
    logger.info({ retried }, "[pnl-retry] re-queued failed jobs");
  }

  return { retried };
}
