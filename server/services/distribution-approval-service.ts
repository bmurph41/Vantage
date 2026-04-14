/**
 * Distribution Approval Workflow Service
 * =======================================
 * Implements institutional-grade dual-control distribution approval.
 *
 * Workflow: Draft → Pending Approval → Approved → Executed
 *                                    → Rejected
 *
 * Rules:
 * - Initiator cannot approve their own distribution
 * - Distributions > $50M require 2 approvals (dual signature)
 * - All state transitions are logged to financial audit trail
 * - Executed distributions are immutable
 *
 * Required by: SOC 2 (GT-2 Segregation of Duties), institutional LP ODD
 */

import { db } from '../db';
import { fundCapitalMovements, fundInvestors, funds } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { financialAuditService } from './financial-audit-service';
import Decimal from 'decimal.js';

/** Transaction-aware DB handle — either the root `db` or a `tx` from db.transaction() */
type DbOrTx = typeof db;

// ─── Types ──────────────────────────────────────────────────────────────────

export type DistributionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'executed';

export interface DistributionDraft {
  id: string;
  orgId: string;
  fundId: string;
  status: DistributionStatus;
  totalProceeds: string; // Stored as string for decimal precision
  distributionType: string;
  dealAllocationId?: string;
  notes?: string;
  yearsHeld?: number;
  // Workflow tracking
  createdBy: string;
  createdAt: Date;
  submittedForApprovalAt?: Date;
  submittedBy?: string;
  approvals: DistributionApproval[];
  requiredApprovals: number; // 1 for < $50M, 2 for >= $50M
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  executedAt?: Date;
  executedBy?: string;
  // Waterfall results (computed on approval, stored for audit)
  waterfallResult?: Record<string, any>;
  investorAllocations?: Record<string, any>[];
}

export interface DistributionApproval {
  userId: string;
  userEmail: string;
  userRole: string;
  approvedAt: Date;
  notes?: string;
}

const DUAL_SIGNATURE_THRESHOLD = 50_000_000; // $50M

// ─── Service ────────────────────────────────────────────────────────────────

class DistributionApprovalService {
  /**
   * Create a distribution draft. Does NOT execute — just stages it.
   */
  async createDraft(
    req: any,
    fundId: string,
    data: {
      totalProceeds: number;
      distributionType: string;
      dealAllocationId?: string;
      notes?: string;
      yearsHeld?: number;
    }
  ): Promise<DistributionDraft> {
    const orgId = req.user.orgId;
    const userId = req.user.id;
    const proceeds = new Decimal(data.totalProceeds);

    const draft: DistributionDraft = {
      id: crypto.randomUUID(),
      orgId,
      fundId,
      status: 'draft',
      totalProceeds: proceeds.toFixed(2),
      distributionType: data.distributionType,
      dealAllocationId: data.dealAllocationId,
      notes: data.notes,
      yearsHeld: data.yearsHeld,
      createdBy: userId,
      createdAt: new Date(),
      approvals: [],
      requiredApprovals: proceeds.gte(DUAL_SIGNATURE_THRESHOLD) ? 2 : 1,
    };

    // Store in database
    await db.execute(
      `INSERT INTO distribution_approvals (
        id, org_id, fund_id, status, total_proceeds, distribution_type,
        deal_allocation_id, notes, years_held,
        created_by, created_at, required_approvals, approvals_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)` as any,
    );

    await financialAuditService.logFromRequest(req, {
      fundId,
      eventType: 'distribution.draft_created',
      amount: data.totalProceeds,
      afterState: { draftId: draft.id, totalProceeds: draft.totalProceeds, requiredApprovals: draft.requiredApprovals },
    });

    return draft;
  }

  /**
   * Submit a draft for approval. Changes status from draft → pending_approval.
   */
  async submitForApproval(req: any, draftId: string): Promise<DistributionDraft> {
    const draft = await this.getDraft(req.user.orgId, draftId);
    if (!draft) throw new Error('Distribution draft not found');
    if (draft.status !== 'draft') throw new Error(`Cannot submit: distribution is ${draft.status}`);

    draft.status = 'pending_approval';
    draft.submittedForApprovalAt = new Date();
    draft.submittedBy = req.user.id;

    await this.updateDraft(draft);

    await financialAuditService.logFromRequest(req, {
      fundId: draft.fundId,
      eventType: 'distribution.draft_created',
      amount: parseFloat(draft.totalProceeds),
      metadata: { draftId, action: 'submitted_for_approval' },
    });

    return draft;
  }

  /**
   * Approve a distribution. Enforces dual-control rules.
   */
  async approve(
    req: any,
    draftId: string,
    notes?: string
  ): Promise<DistributionDraft> {
    const draft = await this.getDraft(req.user.orgId, draftId);
    if (!draft) throw new Error('Distribution draft not found');
    if (draft.status !== 'pending_approval') throw new Error(`Cannot approve: distribution is ${draft.status}`);

    const userId = req.user.id;
    const userRole = req.user.role;

    // Dual control: initiator cannot approve their own distribution
    if (draft.createdBy === userId) {
      throw new Error('Segregation of duties violation: initiator cannot approve their own distribution');
    }

    // Check if this user already approved
    if (draft.approvals.some(a => a.userId === userId)) {
      throw new Error('You have already approved this distribution');
    }

    // Add approval
    draft.approvals.push({
      userId,
      userEmail: req.user.email,
      userRole,
      approvedAt: new Date(),
      notes,
    });

    // Check if we have enough approvals
    if (draft.approvals.length >= draft.requiredApprovals) {
      draft.status = 'approved';
    }

    await this.updateDraft(draft);

    await financialAuditService.logFromRequest(req, {
      fundId: draft.fundId,
      eventType: 'distribution.approved',
      amount: parseFloat(draft.totalProceeds),
      metadata: {
        draftId,
        approvalCount: draft.approvals.length,
        requiredApprovals: draft.requiredApprovals,
        isFullyApproved: draft.status === 'approved',
      },
    });

    return draft;
  }

  /**
   * Reject a distribution. Only permitted for pending_approval status.
   */
  async reject(req: any, draftId: string, reason: string): Promise<DistributionDraft> {
    const draft = await this.getDraft(req.user.orgId, draftId);
    if (!draft) throw new Error('Distribution draft not found');
    if (draft.status !== 'pending_approval') throw new Error(`Cannot reject: distribution is ${draft.status}`);

    draft.status = 'rejected';
    draft.rejectedBy = req.user.id;
    draft.rejectedAt = new Date();
    draft.rejectionReason = reason;

    await this.updateDraft(draft);

    await financialAuditService.logFromRequest(req, {
      fundId: draft.fundId,
      eventType: 'distribution.rejected',
      amount: parseFloat(draft.totalProceeds),
      metadata: { draftId, reason },
    });

    return draft;
  }

  /**
   * Execute an approved distribution. Calls fundService.processFundDistribution()
   * and marks as executed. This is the only path to actually move money.
   */
  async execute(req: any, draftId: string): Promise<{ draft: DistributionDraft; result: any }> {
    return await db.transaction(async (tx) => {
      const draft = await this.getDraft(req.user.orgId, draftId, tx);
      if (!draft) throw new Error('Distribution draft not found');
      if (draft.status !== 'approved') throw new Error(`Cannot execute: distribution is ${draft.status}, must be approved`);

      // Run compliance checks before execution
      await this.runComplianceChecks(req.user.orgId, draft.fundId);

      // Execute via fund service (processFundDistribution has its own internal transaction;
      // since Neon/pg nested transactions are not supported, the inner tx will share this connection)
      const { fundService } = await import('./fund-service');
      const result = await fundService.processFundDistribution(
        req.user.orgId,
        req.user.id,
        draft.fundId,
        {
          totalProceeds: parseFloat(draft.totalProceeds),
          distributionType: draft.distributionType as any,
          dealAllocationId: draft.dealAllocationId,
          notes: draft.notes,
          yearsHeld: draft.yearsHeld,
        }
      );

      draft.status = 'executed';
      draft.executedAt = new Date();
      draft.executedBy = req.user.id;
      draft.waterfallResult = result.waterfallResult;
      draft.investorAllocations = result.investorDistributions;

      await this.updateDraft(draft, tx);

      await financialAuditService.logFromRequest(req, {
        fundId: draft.fundId,
        eventType: 'distribution.executed',
        amount: parseFloat(draft.totalProceeds),
        afterState: {
          draftId,
          totalDistributed: result.totalDistributed,
          gpCarry: result.gpCarry,
          investorCount: result.investorDistributions.length,
        },
      });

      return { draft, result };
    });
  }

  /**
   * Run pre-distribution compliance checks.
   * Verifies investor accreditation status and fund compliance.
   */
  async runComplianceChecks(orgId: string, fundId: string): Promise<void> {
    const { fundService } = await import('./fund-service');
    const investors = await fundService.getInvestorsByFund(orgId, fundId);

    // Check investor accreditation via investorVerification table
    const { investorVerification } = await import('@shared/schema');
    const { eq: eqOp, and: andOp } = await import('drizzle-orm');

    for (const investor of investors) {
      if (!investor.crmContactId) continue; // Skip if no linked contact

      const [verification] = await db.select()
        .from(investorVerification)
        .where(andOp(
          eqOp(investorVerification.orgId, orgId),
          eqOp(investorVerification.investorId, investor.id)
        ))
        .limit(1);

      if (verification) {
        // Check accreditation expiration
        if (verification.accreditationExpiresAt && new Date(verification.accreditationExpiresAt) < new Date()) {
          throw new Error(
            `Compliance hold: investor ${investor.investorName} has expired accreditation ` +
            `(expired ${verification.accreditationExpiresAt}). Update verification before distributing.`
          );
        }

        // Check AML status
        if (verification.amlStatus === 'flagged') {
          throw new Error(
            `Compliance hold: investor ${investor.investorName} has flagged AML status. ` +
            `Resolve AML screening before distributing.`
          );
        }

        // Check KYC status
        if (verification.kycStatus === 'failed') {
          throw new Error(
            `Compliance hold: investor ${investor.investorName} has failed KYC verification. ` +
            `Resolve KYC before distributing.`
          );
        }
      }
    }
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  private async getDraft(orgId: string, draftId: string, txn?: DbOrTx): Promise<DistributionDraft | null> {
    const d = txn || db;
    const result = await d.execute(
      `SELECT * FROM distribution_approvals WHERE id = '${draftId}' AND org_id = '${orgId}' LIMIT 1` as any
    );
    const row = (result.rows as any)?.[0];
    if (!row) return null;

    return {
      id: row.id,
      orgId: row.org_id,
      fundId: row.fund_id,
      status: row.status,
      totalProceeds: row.total_proceeds,
      distributionType: row.distribution_type,
      dealAllocationId: row.deal_allocation_id,
      notes: row.notes,
      yearsHeld: row.years_held,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      submittedForApprovalAt: row.submitted_for_approval_at ? new Date(row.submitted_for_approval_at) : undefined,
      submittedBy: row.submitted_by,
      approvals: row.approvals_json ? JSON.parse(row.approvals_json) : [],
      requiredApprovals: row.required_approvals,
      rejectedBy: row.rejected_by,
      rejectedAt: row.rejected_at ? new Date(row.rejected_at) : undefined,
      rejectionReason: row.rejection_reason,
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      executedBy: row.executed_by,
      waterfallResult: row.waterfall_result ? JSON.parse(row.waterfall_result) : undefined,
      investorAllocations: row.investor_allocations ? JSON.parse(row.investor_allocations) : undefined,
    };
  }

  private async updateDraft(draft: DistributionDraft, txn?: DbOrTx): Promise<void> {
    const d = txn || db;
    await d.execute(
      `UPDATE distribution_approvals SET
        status = '${draft.status}',
        submitted_for_approval_at = ${draft.submittedForApprovalAt ? `'${draft.submittedForApprovalAt.toISOString()}'` : 'NULL'},
        submitted_by = ${draft.submittedBy ? `'${draft.submittedBy}'` : 'NULL'},
        approvals_json = '${JSON.stringify(draft.approvals)}',
        rejected_by = ${draft.rejectedBy ? `'${draft.rejectedBy}'` : 'NULL'},
        rejected_at = ${draft.rejectedAt ? `'${draft.rejectedAt.toISOString()}'` : 'NULL'},
        rejection_reason = ${draft.rejectionReason ? `'${draft.rejectionReason.replace(/'/g, "''")}'` : 'NULL'},
        executed_at = ${draft.executedAt ? `'${draft.executedAt.toISOString()}'` : 'NULL'},
        executed_by = ${draft.executedBy ? `'${draft.executedBy}'` : 'NULL'},
        waterfall_result = ${draft.waterfallResult ? `'${JSON.stringify(draft.waterfallResult).replace(/'/g, "''")}'` : 'NULL'},
        investor_allocations = ${draft.investorAllocations ? `'${JSON.stringify(draft.investorAllocations).replace(/'/g, "''")}'` : 'NULL'}
      WHERE id = '${draft.id}'` as any
    );
  }

  /**
   * List distribution drafts for a fund.
   */
  async listDrafts(
    orgId: string,
    fundId: string,
    status?: DistributionStatus
  ): Promise<DistributionDraft[]> {
    const statusFilter = status ? ` AND status = '${status}'` : '';
    const result = await db.execute(
      `SELECT * FROM distribution_approvals WHERE org_id = '${orgId}' AND fund_id = '${fundId}'${statusFilter} ORDER BY created_at DESC` as any
    );

    return ((result.rows as any[]) || []).map(row => ({
      id: row.id,
      orgId: row.org_id,
      fundId: row.fund_id,
      status: row.status,
      totalProceeds: row.total_proceeds,
      distributionType: row.distribution_type,
      dealAllocationId: row.deal_allocation_id,
      notes: row.notes,
      yearsHeld: row.years_held,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      approvals: row.approvals_json ? JSON.parse(row.approvals_json) : [],
      requiredApprovals: row.required_approvals,
      rejectedBy: row.rejected_by,
      rejectedAt: row.rejected_at ? new Date(row.rejected_at) : undefined,
      rejectionReason: row.rejection_reason,
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      executedBy: row.executed_by,
    }));
  }
}

export const distributionApprovalService = new DistributionApprovalService();
