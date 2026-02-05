/**
 * Data Retention Service
 * 
 * Automated cleanup of expired data according to retention policies.
 * Runs as a scheduled job (recommend: daily at 3 AM).
 * 
 * Usage:
 *   // In a cron job or startup script:
 *   import { DataRetentionService } from './services/data-retention-service';
 *   
 *   const retention = new DataRetentionService();
 *   
 *   // Run once
 *   await retention.run();
 *   
 *   // Or schedule with node-cron:
 *   import cron from 'node-cron';
 *   cron.schedule('0 3 * * *', () => retention.run());  // Daily at 3 AM
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';

// ─── Retention Policies ──────────────────────────────────────────────────────

interface RetentionPolicy {
  /** Table name */
  table: string;
  /** Number of days to retain data */
  retentionDays: number;
  /** Column to check age against (default: 'created_at') */
  dateColumn?: string;
  /** Additional WHERE clause for safety (e.g., only delete soft-deleted items) */
  condition?: string;
  /** Description for logging */
  description: string;
  /** Max rows to delete per batch (prevents long-running transactions) */
  batchSize?: number;
}

const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    table: 'audit_logs',
    retentionDays: 365,
    description: 'Audit logs older than 1 year',
  },
  {
    table: 'user_sessions',
    retentionDays: 90,
    dateColumn: 'expires_at',
    description: 'Expired sessions older than 90 days',
  },
  {
    table: 'notifications',
    retentionDays: 180,
    condition: "read = true",
    description: 'Read notifications older than 6 months',
  },
  {
    table: 'notifications',
    retentionDays: 365,
    description: 'All notifications older than 1 year',
  },
];

// ─── Service ─────────────────────────────────────────────────────────────────

export class DataRetentionService {
  private readonly log = logger.child({ service: 'data-retention' });

  /**
   * Run all retention policies.
   * Returns a summary of what was deleted.
   */
  async run(): Promise<RetentionSummary> {
    const startTime = Date.now();
    const results: RetentionResult[] = [];

    this.log.info({ policyCount: RETENTION_POLICIES.length }, 'Starting data retention job');

    for (const policy of RETENTION_POLICIES) {
      try {
        const result = await this.executePolicy(policy);
        results.push(result);
      } catch (error: any) {
        this.log.error(
          { error: error.message, table: policy.table },
          'Data retention policy failed'
        );
        results.push({
          table: policy.table,
          description: policy.description,
          deletedCount: 0,
          success: false,
          error: error.message,
        });
      }
    }

    const summary: RetentionSummary = {
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      totalDeleted: results.reduce((sum, r) => sum + r.deletedCount, 0),
      results,
    };

    this.log.info(
      {
        type: 'data_retention_complete',
        totalDeleted: summary.totalDeleted,
        durationMs: summary.durationMs,
        policies: results.length,
        failures: results.filter(r => !r.success).length,
      },
      'Data retention job completed'
    );

    return summary;
  }

  /**
   * Execute a single retention policy.
   * Uses batched deletes to prevent long-running transactions.
   */
  private async executePolicy(policy: RetentionPolicy): Promise<RetentionResult> {
    const dateColumn = policy.dateColumn || 'created_at';
    const batchSize = policy.batchSize || 10000;
    let totalDeleted = 0;

    // Build the WHERE clause
    const conditions = [
      `${dateColumn} < NOW() - INTERVAL '${policy.retentionDays} days'`,
    ];
    if (policy.condition) {
      conditions.push(policy.condition);
    }

    const whereClause = conditions.join(' AND ');

    // Delete in batches
    let batchDeleted = 0;
    do {
      const result = await db.execute(sql.raw(`
        DELETE FROM ${policy.table}
        WHERE id IN (
          SELECT id FROM ${policy.table}
          WHERE ${whereClause}
          LIMIT ${batchSize}
        )
      `));

      batchDeleted = result.rowCount || 0;
      totalDeleted += batchDeleted;

      if (batchDeleted > 0) {
        this.log.debug(
          { table: policy.table, batchDeleted, totalDeleted },
          'Retention batch completed'
        );
      }
    } while (batchDeleted >= batchSize);

    if (totalDeleted > 0) {
      this.log.info(
        {
          type: 'data_retention_executed',
          table: policy.table,
          description: policy.description,
          deletedCount: totalDeleted,
          retentionDays: policy.retentionDays,
        },
        `Deleted ${totalDeleted} rows from ${policy.table}`
      );
    }

    return {
      table: policy.table,
      description: policy.description,
      deletedCount: totalDeleted,
      success: true,
    };
  }

  /**
   * Dry run — reports what WOULD be deleted without actually deleting.
   */
  async dryRun(): Promise<RetentionSummary> {
    const results: RetentionResult[] = [];

    this.log.info('Starting data retention DRY RUN');

    for (const policy of RETENTION_POLICIES) {
      try {
        const dateColumn = policy.dateColumn || 'created_at';
        const conditions = [
          `${dateColumn} < NOW() - INTERVAL '${policy.retentionDays} days'`,
        ];
        if (policy.condition) {
          conditions.push(policy.condition);
        }

        const result = await db.execute(sql.raw(`
          SELECT COUNT(*) as count FROM ${policy.table}
          WHERE ${conditions.join(' AND ')}
        `));

        const count = parseInt(result.rows[0]?.count as string) || 0;

        results.push({
          table: policy.table,
          description: policy.description,
          deletedCount: count,
          success: true,
        });

        this.log.info(
          { table: policy.table, wouldDelete: count, retentionDays: policy.retentionDays },
          `DRY RUN: Would delete ${count} rows from ${policy.table}`
        );
      } catch (error: any) {
        results.push({
          table: policy.table,
          description: policy.description,
          deletedCount: 0,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      totalDeleted: results.reduce((sum, r) => sum + r.deletedCount, 0),
      results,
    };
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RetentionResult {
  table: string;
  description: string;
  deletedCount: number;
  success: boolean;
  error?: string;
}

interface RetentionSummary {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalDeleted: number;
  results: RetentionResult[];
}
