/**
 * Financial Audit Service
 * =======================
 * Institutional-grade audit trail for all financial operations.
 * Every capital call, distribution, NAV calculation, and ledger entry
 * is logged immutably with actor, timestamp, IP, and before/after state.
 *
 * Required by: SOC 2 Type II (GT-1, GT-3), institutional LP ODD
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// ─── Types ──────────────────────────────────────────────────────────────────

export type FinancialEventType =
  | 'capital_call.created'
  | 'capital_call.approved'
  | 'capital_call.completed'
  | 'capital_call.cancelled'
  | 'distribution.draft_created'
  | 'distribution.approved'
  | 'distribution.executed'
  | 'distribution.rejected'
  | 'nav.calculated'
  | 'preferred_return.accrued'
  | 'waterfall.calculated'
  | 'investor.commitment_changed'
  | 'investor.balance_updated'
  | 'ledger_entry.created'
  | 'ledger_entry.reversal'
  | 'period.locked'
  | 'period.unlocked'
  | 'fund.metrics_recalculated'
  | 'fund.deal_returns_synced'
  | 'compliance.accreditation_checked'
  | 'compliance.accreditation_expired'
  | 'statement.generated'
  | 'statement.downloaded';

export interface FinancialAuditEntry {
  id?: string;
  orgId: string;
  fundId?: string;
  investorId?: string;
  eventType: FinancialEventType;
  actorUserId: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
  amount?: number;
  currency?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

// ─── Service ────────────────────────────────────────────────────────────────

class FinancialAuditService {
  /**
   * Log a financial event. This is an append-only operation.
   * Entries cannot be modified or deleted after creation.
   */
  async log(entry: FinancialAuditEntry): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();

    await db.execute(sql`
      INSERT INTO financial_audit_log (
        id, org_id, fund_id, investor_id, event_type,
        actor_user_id, actor_email, actor_role,
        ip_address, user_agent,
        amount, currency,
        before_state, after_state, metadata,
        created_at
      ) VALUES (
        ${id}, ${entry.orgId}, ${entry.fundId || null}, ${entry.investorId || null},
        ${entry.eventType}, ${entry.actorUserId}, ${entry.actorEmail || null},
        ${entry.actorRole || null}, ${entry.ipAddress || null}, ${entry.userAgent || null},
        ${entry.amount || null}, ${entry.currency || 'USD'},
        ${entry.beforeState ? JSON.stringify(entry.beforeState) : null},
        ${entry.afterState ? JSON.stringify(entry.afterState) : null},
        ${entry.metadata ? JSON.stringify(entry.metadata) : null},
        ${now}
      )
    `);

    return id;
  }

  /**
   * Log from Express request context (extracts IP, UA, user info)
   */
  async logFromRequest(
    req: any,
    entry: Omit<FinancialAuditEntry, 'orgId' | 'actorUserId' | 'actorEmail' | 'actorRole' | 'ipAddress' | 'userAgent'>
  ): Promise<string> {
    return this.log({
      ...entry,
      orgId: req.user?.orgId || '',
      actorUserId: req.user?.id || '',
      actorEmail: req.user?.email || '',
      actorRole: req.user?.role || '',
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '',
      userAgent: req.headers?.['user-agent'] || '',
    });
  }

  /**
   * Query audit trail for a fund (read-only, for compliance review)
   */
  async getAuditTrail(
    orgId: string,
    filters: {
      fundId?: string;
      investorId?: string;
      eventType?: FinancialEventType;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ entries: any[]; total: number }> {
    const conditions: string[] = [`org_id = '${orgId}'`];
    if (filters.fundId) conditions.push(`fund_id = '${filters.fundId}'`);
    if (filters.investorId) conditions.push(`investor_id = '${filters.investorId}'`);
    if (filters.eventType) conditions.push(`event_type = '${filters.eventType}'`);
    if (filters.fromDate) conditions.push(`created_at >= '${filters.fromDate.toISOString()}'`);
    if (filters.toDate) conditions.push(`created_at <= '${filters.toDate.toISOString()}'`);

    const where = conditions.join(' AND ');
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const [entries, countResult] = await Promise.all([
      db.execute(sql.raw(`SELECT * FROM financial_audit_log WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`)),
      db.execute(sql.raw(`SELECT count(*)::int as total FROM financial_audit_log WHERE ${where}`)),
    ]);

    return {
      entries: entries.rows || [],
      total: (countResult.rows as any)?.[0]?.total || 0,
    };
  }
}

export const financialAuditService = new FinancialAuditService();
