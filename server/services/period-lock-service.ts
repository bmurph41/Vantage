/**
 * Period Locking Service
 * ======================
 * Prevents retroactive changes to finalized reporting periods.
 * Once a period is locked, no capital movements, ledger entries,
 * or balance modifications can be made within that date range.
 *
 * Required by: SOC 2 (CC8.1 Change Management), institutional audit standards
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { financialAuditService } from './financial-audit-service';

export interface PeriodLock {
  id: string;
  orgId: string;
  fundId: string;
  periodLabel: string; // e.g., "Q4 2025", "2025-12"
  periodStart: Date;
  periodEnd: Date;
  lockedAt: Date;
  lockedBy: string;
  unlockedAt?: Date;
  unlockedBy?: string;
  unlockReason?: string;
  isLocked: boolean;
}

class PeriodLockService {
  /**
   * Lock a period. After locking, no financial mutations are allowed
   * for movements/entries with dates within this period.
   */
  async lockPeriod(
    req: any,
    fundId: string,
    periodLabel: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<PeriodLock> {
    const orgId = req.user.orgId;
    const userId = req.user.id;
    const id = crypto.randomUUID();
    const now = new Date();

    await db.execute(sql`
      INSERT INTO fund_period_locks (id, org_id, fund_id, period_label, period_start, period_end, locked_at, locked_by, is_locked)
      VALUES (${id}, ${orgId}, ${fundId}, ${periodLabel}, ${periodStart}, ${periodEnd}, ${now}, ${userId}, true)
    `);

    await financialAuditService.logFromRequest(req, {
      fundId,
      eventType: 'period.locked',
      metadata: { periodLabel, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() },
    });

    return { id, orgId, fundId, periodLabel, periodStart, periodEnd, lockedAt: now, lockedBy: userId, isLocked: true };
  }

  /**
   * Unlock a period. Requires owner/admin role and a documented reason.
   * The unlock is logged for audit trail.
   */
  async unlockPeriod(req: any, lockId: string, reason: string): Promise<PeriodLock> {
    const orgId = req.user.orgId;
    const userId = req.user.id;
    const now = new Date();

    if (!reason || reason.trim().length < 10) {
      throw new Error('Unlock reason must be at least 10 characters (audit requirement)');
    }

    const result = await db.execute(sql`
      UPDATE fund_period_locks
      SET is_locked = false, unlocked_at = ${now}, unlocked_by = ${userId}, unlock_reason = ${reason}
      WHERE id = ${lockId} AND org_id = ${orgId} AND is_locked = true
      RETURNING *
    `);

    const row = (result.rows as any)?.[0];
    if (!row) throw new Error('Period lock not found or already unlocked');

    await financialAuditService.logFromRequest(req, {
      fundId: row.fund_id,
      eventType: 'period.unlocked',
      metadata: { lockId, periodLabel: row.period_label, reason },
    });

    return {
      id: row.id,
      orgId: row.org_id,
      fundId: row.fund_id,
      periodLabel: row.period_label,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      lockedAt: new Date(row.locked_at),
      lockedBy: row.locked_by,
      unlockedAt: now,
      unlockedBy: userId,
      unlockReason: reason,
      isLocked: false,
    };
  }

  /**
   * Check if a date falls within a locked period for a fund.
   * Used as a guard before creating/modifying capital movements.
   */
  async isDateLocked(orgId: string, fundId: string, date: Date): Promise<{ locked: boolean; periodLabel?: string }> {
    const result = await db.execute(sql`
      SELECT period_label FROM fund_period_locks
      WHERE org_id = ${orgId} AND fund_id = ${fundId} AND is_locked = true
        AND period_start <= ${date} AND period_end >= ${date}
      LIMIT 1
    `);

    const row = (result.rows as any)?.[0];
    if (row) {
      return { locked: true, periodLabel: row.period_label };
    }
    return { locked: false };
  }

  /**
   * Enforce period lock — throws if date is in a locked period.
   * Call this before any financial mutation.
   */
  async enforcePeriodLock(orgId: string, fundId: string, date: Date): Promise<void> {
    const check = await this.isDateLocked(orgId, fundId, date);
    if (check.locked) {
      throw new Error(
        `Period ${check.periodLabel} is locked. Financial entries cannot be created or modified ` +
        `for dates within locked periods. Contact an administrator to unlock if correction is needed.`
      );
    }
  }

  /**
   * List all period locks for a fund.
   */
  async listPeriodLocks(orgId: string, fundId: string): Promise<PeriodLock[]> {
    const result = await db.execute(sql`
      SELECT * FROM fund_period_locks
      WHERE org_id = ${orgId} AND fund_id = ${fundId}
      ORDER BY period_start DESC
    `);

    return ((result.rows as any[]) || []).map(row => ({
      id: row.id,
      orgId: row.org_id,
      fundId: row.fund_id,
      periodLabel: row.period_label,
      periodStart: new Date(row.period_start),
      periodEnd: new Date(row.period_end),
      lockedAt: new Date(row.locked_at),
      lockedBy: row.locked_by,
      unlockedAt: row.unlocked_at ? new Date(row.unlocked_at) : undefined,
      unlockedBy: row.unlocked_by || undefined,
      unlockReason: row.unlock_reason || undefined,
      isLocked: row.is_locked,
    }));
  }
}

export const periodLockService = new PeriodLockService();
