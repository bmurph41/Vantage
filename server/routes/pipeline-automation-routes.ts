/**
 * Pipeline Automation Rules Routes
 *
 * CRUD + toggle + evaluate for automation rules that fire on stage changes,
 * time-in-stage thresholds, field updates, etc.
 */
import { Router, Request, Response } from 'express';
import { eq, and, sql, desc } from 'drizzle-orm';

const router = Router();

async function getDb() {
  const { db } = await import('../db');
  return db;
}

async function getSchema() {
  return import('@shared/schema');
}

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.claims?.sub || null;
}

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).tenantId || null;
}

// GET /rules — list all automation rules for the org
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const rules = await db
      .select()
      .from(schema.pipelineAutomationRules)
      .where(eq(schema.pipelineAutomationRules.orgId, orgId))
      .orderBy(desc(schema.pipelineAutomationRules.createdAt));

    res.json(rules);
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// POST /rules — create a new rule
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(401).json({ error: 'Authentication required' });

    const { name, triggerType, triggerConfig, actionType, actionConfig } = req.body;
    if (!name || !triggerType || !actionType) {
      return res.status(400).json({ error: 'name, triggerType, and actionType are required' });
    }

    const db = await getDb();
    const schema = await getSchema();

    const [rule] = await db.insert(schema.pipelineAutomationRules).values({
      orgId,
      name,
      triggerType,
      triggerConfig: triggerConfig || {},
      actionType,
      actionConfig: actionConfig || {},
      createdBy: userId,
    }).returning();

    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating automation rule:', error);
    res.status(500).json({ error: 'Failed to create automation rule' });
  }
});

// PUT /rules/:id — update an existing rule
router.put('/rules/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { id } = req.params;
    const { name, triggerType, triggerConfig, actionType, actionConfig, isActive } = req.body;

    const db = await getDb();
    const schema = await getSchema();

    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (triggerType !== undefined) updates.triggerType = triggerType;
    if (triggerConfig !== undefined) updates.triggerConfig = triggerConfig;
    if (actionType !== undefined) updates.actionType = actionType;
    if (actionConfig !== undefined) updates.actionConfig = actionConfig;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db.update(schema.pipelineAutomationRules)
      .set(updates)
      .where(and(
        eq(schema.pipelineAutomationRules.id, id),
        eq(schema.pipelineAutomationRules.orgId, orgId),
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Rule not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating automation rule:', error);
    res.status(500).json({ error: 'Failed to update automation rule' });
  }
});

// DELETE /rules/:id
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { id } = req.params;
    const db = await getDb();
    const schema = await getSchema();

    const [deleted] = await db.delete(schema.pipelineAutomationRules)
      .where(and(
        eq(schema.pipelineAutomationRules.id, id),
        eq(schema.pipelineAutomationRules.orgId, orgId),
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    res.status(500).json({ error: 'Failed to delete automation rule' });
  }
});

// POST /rules/:id/toggle — enable/disable a rule
router.post('/rules/:id/toggle', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { id } = req.params;
    const db = await getDb();
    const schema = await getSchema();

    // Get current state
    const [existing] = await db
      .select()
      .from(schema.pipelineAutomationRules)
      .where(and(
        eq(schema.pipelineAutomationRules.id, id),
        eq(schema.pipelineAutomationRules.orgId, orgId),
      ))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'Rule not found' });

    const [updated] = await db.update(schema.pipelineAutomationRules)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(eq(schema.pipelineAutomationRules.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error toggling automation rule:', error);
    res.status(500).json({ error: 'Failed to toggle automation rule' });
  }
});

// POST /evaluate — evaluate active rules and EXECUTE matching actions
// Supports both:
//   - Stage-change trigger: { dealId, fromStageId, toStageId, triggerType: 'stage_change' }
//   - Batch scan: { triggerType: 'days_in_stage' } (called by cron/on-load)
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();
    const { dealId, fromStageId, toStageId, triggerType } = req.body;

    // Get active rules
    const rules = await db
      .select()
      .from(schema.pipelineAutomationRules)
      .where(and(
        eq(schema.pipelineAutomationRules.orgId, orgId),
        eq(schema.pipelineAutomationRules.isActive, true),
      ));

    const executed: Array<{ ruleId: string; ruleName: string; dealId: string; action: string; success: boolean }> = [];

    // Helper: evaluate conditions array against a deal record
    function evaluateConditions(rule: typeof rules[0], deal: Record<string, any>): boolean {
      const conditions = (rule as any).conditions as Array<{
        field: string; operator: string; value: string;
      }> | undefined;
      if (!conditions || conditions.length === 0) return true; // no conditions = always run

      return conditions.every(cond => {
        const actual = deal[cond.field];
        const expected = cond.value;
        switch (cond.operator) {
          case 'equals': return String(actual) === expected;
          case 'not_equals': return String(actual) !== expected;
          case 'greater_than': return Number(actual) > Number(expected);
          case 'less_than': return Number(actual) < Number(expected);
          case 'contains': return String(actual || '').toLowerCase().includes(expected.toLowerCase());
          default: return true;
        }
      });
    }

    // Helper: execute a single rule action against a deal
    async function executeAction(rule: typeof rules[0], targetDealId: string): Promise<boolean> {
      const actionCfg = rule.actionConfig as any;
      try {
        switch (rule.actionType) {

          case 'create_task': {
            const dueDate = actionCfg.dueDays
              ? new Date(Date.now() + actionCfg.dueDays * 86400000)
              : null;
            await db.insert(schema.crmActivities).values({
              orgId,
              type: 'task',
              direction: 'internal',
              subject: actionCfg.taskTitle || `Task: ${rule.name}`,
              description: actionCfg.taskDescription || `Auto-created by automation rule: ${rule.name}`,
              dealId: targetDealId,
              userId: actionCfg.assignToUserId || userId,
              date: new Date(),
              ...(dueDate ? { dueDate } : {}),
            });
            break;
          }

          case 'send_notification': {
            // Fetch the deal to get owner
            const [deal] = await db.select({ ownerId: schema.crmDeals.ownerId, title: schema.crmDeals.title })
              .from(schema.crmDeals)
              .where(and(eq(schema.crmDeals.id, targetDealId), eq(schema.crmDeals.orgId, orgId)));
            // Store notification (in-app) — insert into crm_activities as a note for now
            // until crm_notifications table is created
            await db.insert(schema.crmActivities).values({
              orgId,
              type: 'note',
              direction: 'internal',
              subject: actionCfg.notificationTitle || `🔔 ${rule.name}`,
              description: actionCfg.notificationTemplate
                || `Automation rule fired: ${rule.name} on deal: ${deal?.title}`,
              dealId: targetDealId,
              userId: deal?.ownerId || userId,
              date: new Date(),
            });
            break;
          }

          case 'update_field': {
            if (actionCfg.fieldName && actionCfg.fieldValue !== undefined) {
              const updatePayload: Record<string, any> = {
                [actionCfg.fieldName]: actionCfg.fieldValue,
                updatedAt: new Date(),
              };
              await db.update(schema.crmDeals)
                .set(updatePayload)
                .where(and(eq(schema.crmDeals.id, targetDealId), eq(schema.crmDeals.orgId, orgId)));
            }
            break;
          }

          case 'assign_owner': {
            if (actionCfg.userId) {
              await db.update(schema.crmDeals)
                .set({ ownerId: actionCfg.userId, updatedAt: new Date() })
                .where(and(eq(schema.crmDeals.id, targetDealId), eq(schema.crmDeals.orgId, orgId)));
            }
            break;
          }

          case 'move_stage': {
            // Prevent infinite automation loops with a guard flag
            if (actionCfg.targetStageId && actionCfg.targetStageId !== toStageId) {
              await db.update(schema.crmDeals)
                .set({
                  stageId: actionCfg.targetStageId,
                  currentStageEnteredAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(and(eq(schema.crmDeals.id, targetDealId), eq(schema.crmDeals.orgId, orgId)));
            }
            break;
          }

          default:
            console.warn(`Unknown automation action type: ${rule.actionType}`);
        }

        // Update rule execution stats
        await db.update(schema.pipelineAutomationRules)
          .set({
            executionCount: sql`COALESCE(${schema.pipelineAutomationRules.executionCount}, 0) + 1`,
            lastExecutedAt: new Date(),
          })
          .where(eq(schema.pipelineAutomationRules.id, rule.id));

        return true;
      } catch (err) {
        console.error(`Automation action ${rule.actionType} failed for rule ${rule.id}:`, err);
        return false;
      }
    }

    // ── Stage-change triggered evaluation ──
    if (triggerType === 'stage_change' && dealId && toStageId) {
      for (const rule of rules) {
        if (rule.triggerType !== 'stage_change') continue;
        const cfg = rule.triggerConfig as any;

        // Match: specific toStage required, or any stage change
        const stageMatches = !cfg.toStageId || cfg.toStageId === toStageId;
        const fromMatches = !cfg.fromStageId || cfg.fromStageId === fromStageId;

        // Also support stage NAME matching (legacy config)
        const [toStageRecord] = await db.select({ name: schema.crmPipelineStages.name })
          .from(schema.crmPipelineStages)
          .where(eq(schema.crmPipelineStages.id, toStageId));
        const stageNameMatches = !cfg.toStage || cfg.toStage === toStageRecord?.name;

        if ((stageMatches || stageNameMatches) && fromMatches) {
          // Fetch deal record to evaluate conditions
          const [dealRecord] = await db.select().from(schema.crmDeals)
            .where(and(eq(schema.crmDeals.id, dealId), eq(schema.crmDeals.orgId, orgId)));
          if (dealRecord && !evaluateConditions(rule, dealRecord)) continue;
          const success = await executeAction(rule, dealId);
          executed.push({ ruleId: rule.id, ruleName: rule.name, dealId, action: rule.actionType, success });
        }
      }
    }

    // ── Days-in-stage batch evaluation ──
    if (triggerType === 'days_in_stage' || (!triggerType && !dealId)) {
      const deals = await db.select().from(schema.crmDeals).where(eq(schema.crmDeals.orgId, orgId));

      for (const rule of rules) {
        if (rule.triggerType !== 'days_in_stage') continue;
        const cfg = rule.triggerConfig as any;
        const threshold = cfg.daysThreshold || 30;

        for (const deal of deals) {
          if (!deal.currentStageEnteredAt) continue;
          const days = Math.floor((Date.now() - new Date(deal.currentStageEnteredAt).getTime()) / 86400000);
          if (days >= threshold) {
            const success = await executeAction(rule, deal.id);
            executed.push({ ruleId: rule.id, ruleName: rule.name, dealId: deal.id, action: rule.actionType, success });
          }
        }
      }
    }

    res.json({
      evaluated: rules.length,
      executed,
      successCount: executed.filter(e => e.success).length,
    });
  } catch (error) {
    console.error('Error evaluating automation rules:', error);
    res.status(500).json({ error: 'Failed to evaluate automation rules' });
  }
});

export default router;
