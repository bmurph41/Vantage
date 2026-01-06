/**
 * Phase Gates API Routes
 * 
 * Provides endpoints for managing phase gate approvals in deal progression
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  crmPhaseGateApprovals,
  crmPipelineStages,
  crmDeals,
  users,
  insertCrmPhaseGateApprovalSchema,
} from '@shared/schema';
import { eq, and, desc, asc, sql, or } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/crm/phase-gates/pending
 * Get all pending gate approvals for the current user (as approver)
 */
router.get('/pending', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'user-1';

    const rawApprovals = await db.select({
      approval: crmPhaseGateApprovals,
      deal: {
        id: crmDeals.id,
        title: crmDeals.title,
        value: crmDeals.value,
        stage: crmDeals.stage,
      },
      fromStage: {
        id: crmPipelineStages.id,
        name: crmPipelineStages.name,
      },
      requester: {
        id: users.id,
        username: users.username,
      },
    })
    .from(crmPhaseGateApprovals)
    .leftJoin(crmDeals, eq(crmPhaseGateApprovals.dealId, crmDeals.id))
    .leftJoin(crmPipelineStages, eq(crmPhaseGateApprovals.fromStageId, crmPipelineStages.id))
    .leftJoin(users, eq(crmPhaseGateApprovals.requestedById, users.id))
    .where(eq(crmPhaseGateApprovals.status, 'pending'))
    .orderBy(desc(crmPhaseGateApprovals.requestedAt));

    const toStageIds = rawApprovals.map(a => a.approval.toStageId).filter(Boolean);
    const toStages = toStageIds.length > 0 
      ? await db.select({ id: crmPipelineStages.id, name: crmPipelineStages.name })
          .from(crmPipelineStages)
          .where(sql`${crmPipelineStages.id} IN (${sql.join(toStageIds.map(id => sql`${id}`), sql`, `)})`)
      : [];

    const toStageMap = new Map(toStages.map(s => [s.id, s]));

    const pendingApprovals = rawApprovals.map(item => ({
      ...item,
      toStage: toStageMap.get(item.approval.toStageId) || { id: item.approval.toStageId, name: 'Unknown' },
    }));

    res.json(pendingApprovals);
  } catch (error) {
    console.error('[Phase Gates] Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
});

/**
 * GET /api/crm/phase-gates/deal/:dealId
 * Get all gate approvals for a specific deal
 */
router.get('/deal/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;

    const approvals = await db.select()
      .from(crmPhaseGateApprovals)
      .where(eq(crmPhaseGateApprovals.dealId, dealId))
      .orderBy(desc(crmPhaseGateApprovals.requestedAt));

    res.json(approvals);
  } catch (error) {
    console.error('[Phase Gates] Error fetching deal approvals:', error);
    res.status(500).json({ error: 'Failed to fetch deal approvals' });
  }
});

/**
 * GET /api/crm/phase-gates/stage/:stageId/requirements
 * Get gate requirements for a specific stage
 */
router.get('/stage/:stageId/requirements', async (req: Request, res: Response) => {
  try {
    const { stageId } = req.params;

    const [stage] = await db.select({
      id: crmPipelineStages.id,
      name: crmPipelineStages.name,
      requiredFields: crmPipelineStages.requiredFields,
      automations: crmPipelineStages.automations,
      stageOrder: crmPipelineStages.stageOrder,
    })
    .from(crmPipelineStages)
    .where(eq(crmPipelineStages.id, stageId));

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const automations = (stage.automations || []) as any[];
    const approvalAutomation = automations.find((a: any) => a.type === 'require_approval');

    res.json({
      stageId: stage.id,
      stageName: stage.name,
      requiredFields: stage.requiredFields || [],
      requiresApproval: !!approvalAutomation,
      approvalConfig: approvalAutomation || null,
    });
  } catch (error) {
    console.error('[Phase Gates] Error fetching stage requirements:', error);
    res.status(500).json({ error: 'Failed to fetch stage requirements' });
  }
});

/**
 * POST /api/crm/phase-gates/request
 * Request approval to move a deal to a new stage
 */
router.post('/request', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || 'user-1';
    const { dealId, fromStageId, toStageId, requiredApproverRole, requiredApproverId } = req.body;

    if (!dealId || !toStageId) {
      return res.status(400).json({ error: 'dealId and toStageId are required' });
    }

    const [existing] = await db.select()
      .from(crmPhaseGateApprovals)
      .where(
        and(
          eq(crmPhaseGateApprovals.dealId, dealId),
          eq(crmPhaseGateApprovals.toStageId, toStageId),
          eq(crmPhaseGateApprovals.status, 'pending')
        )
      );

    if (existing) {
      return res.status(400).json({ 
        error: 'Approval already pending for this stage transition',
        existingApprovalId: existing.id 
      });
    }

    const [toStage] = await db.select({
      requiredFields: crmPipelineStages.requiredFields,
      automations: crmPipelineStages.automations,
    })
    .from(crmPipelineStages)
    .where(eq(crmPipelineStages.id, toStageId));

    const [approval] = await db.insert(crmPhaseGateApprovals)
      .values({
        dealId,
        fromStageId,
        toStageId,
        requestedById: userId,
        requiredApproverRole,
        requiredApproverId,
        gateConditions: {
          requiredFields: toStage?.requiredFields || [],
          automations: toStage?.automations || [],
        },
        status: 'pending',
      })
      .returning();

    res.json(approval);
  } catch (error) {
    console.error('[Phase Gates] Error requesting approval:', error);
    res.status(500).json({ error: 'Failed to request approval' });
  }
});

/**
 * PATCH /api/crm/phase-gates/:approvalId/approve
 * Approve a pending gate request
 */
router.patch('/:approvalId/approve', async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const userId = (req as any).userId || 'user-1';
    const { reviewNotes } = req.body;

    const [approval] = await db.select()
      .from(crmPhaseGateApprovals)
      .where(eq(crmPhaseGateApprovals.id, approvalId));

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval is not pending' });
    }

    const [updated] = await db.update(crmPhaseGateApprovals)
      .set({
        status: 'approved',
        reviewedById: userId,
        reviewedAt: new Date(),
        reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(crmPhaseGateApprovals.id, approvalId))
      .returning();

    await db.update(crmDeals)
      .set({
        stageId: approval.toStageId,
        currentStageEnteredAt: new Date(),
        daysInCurrentStage: 0,
        updatedAt: new Date(),
      })
      .where(eq(crmDeals.id, approval.dealId));

    res.json(updated);
  } catch (error) {
    console.error('[Phase Gates] Error approving gate:', error);
    res.status(500).json({ error: 'Failed to approve gate' });
  }
});

/**
 * PATCH /api/crm/phase-gates/:approvalId/reject
 * Reject a pending gate request
 */
router.patch('/:approvalId/reject', async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const userId = (req as any).userId || 'user-1';
    const { rejectionReason, reviewNotes } = req.body;

    const [approval] = await db.select()
      .from(crmPhaseGateApprovals)
      .where(eq(crmPhaseGateApprovals.id, approvalId));

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval is not pending' });
    }

    const [updated] = await db.update(crmPhaseGateApprovals)
      .set({
        status: 'rejected',
        reviewedById: userId,
        reviewedAt: new Date(),
        rejectionReason,
        reviewNotes,
        updatedAt: new Date(),
      })
      .where(eq(crmPhaseGateApprovals.id, approvalId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[Phase Gates] Error rejecting gate:', error);
    res.status(500).json({ error: 'Failed to reject gate' });
  }
});

/**
 * POST /api/crm/phase-gates/check-requirements
 * Check if a deal meets all requirements to enter a stage
 */
router.post('/check-requirements', async (req: Request, res: Response) => {
  try {
    const { dealId, targetStageId } = req.body;

    if (!dealId || !targetStageId) {
      return res.status(400).json({ error: 'dealId and targetStageId are required' });
    }

    const [deal] = await db.select()
      .from(crmDeals)
      .where(eq(crmDeals.id, dealId));

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const [stage] = await db.select()
      .from(crmPipelineStages)
      .where(eq(crmPipelineStages.id, targetStageId));

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const requiredFields = (stage.requiredFields || []) as string[];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const dealRecord = deal as Record<string, any>;
      if (!dealRecord[field] || dealRecord[field] === '' || dealRecord[field] === null) {
        missingFields.push(field);
      }
    }

    const automations = (stage.automations || []) as any[];
    const approvalAutomation = automations.find((a: any) => a.type === 'require_approval');

    const fromStageId = deal.stageId;
    const [existingApproval] = await db.select()
      .from(crmPhaseGateApprovals)
      .where(
        and(
          eq(crmPhaseGateApprovals.dealId, dealId),
          eq(crmPhaseGateApprovals.toStageId, targetStageId),
          eq(crmPhaseGateApprovals.status, 'approved'),
          fromStageId 
            ? eq(crmPhaseGateApprovals.fromStageId, fromStageId)
            : sql`${crmPhaseGateApprovals.fromStageId} IS NULL`
        )
      );

    const requiresApproval = !!approvalAutomation && !existingApproval;

    res.json({
      canProgress: missingFields.length === 0 && !requiresApproval,
      missingFields,
      requiresApproval,
      approvalStatus: existingApproval ? 'approved' : requiresApproval ? 'required' : 'not_required',
      stageName: stage.name,
    });
  } catch (error) {
    console.error('[Phase Gates] Error checking requirements:', error);
    res.status(500).json({ error: 'Failed to check requirements' });
  }
});

/**
 * PATCH /api/crm/stages/:stageId/gate-config
 * Update gate configuration for a stage
 */
router.patch('/stages/:stageId/gate-config', async (req: Request, res: Response) => {
  try {
    const { stageId } = req.params;
    const { requiredFields, requiresApproval, approverRole, approverId } = req.body;

    const [stage] = await db.select()
      .from(crmPipelineStages)
      .where(eq(crmPipelineStages.id, stageId));

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const currentAutomations = (stage.automations || []) as any[];
    const filteredAutomations = currentAutomations.filter((a: any) => a.type !== 'require_approval');

    if (requiresApproval) {
      filteredAutomations.push({
        type: 'require_approval',
        approverRole,
        approverId,
        createdAt: new Date().toISOString(),
      });
    }

    const [updated] = await db.update(crmPipelineStages)
      .set({
        requiredFields: requiredFields || stage.requiredFields,
        automations: filteredAutomations,
        updatedAt: new Date(),
      })
      .where(eq(crmPipelineStages.id, stageId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('[Phase Gates] Error updating gate config:', error);
    res.status(500).json({ error: 'Failed to update gate configuration' });
  }
});

export default router;
