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
  return (req as any).orgId || (req as any).user?.orgId || null;
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

// POST /evaluate — evaluate all active rules against current deals
router.post('/evaluate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    // Get active rules
    const rules = await db
      .select()
      .from(schema.pipelineAutomationRules)
      .where(and(
        eq(schema.pipelineAutomationRules.orgId, orgId),
        eq(schema.pipelineAutomationRules.isActive, true),
      ));

    // Get open deals
    const deals = await db
      .select()
      .from(schema.crmDeals)
      .where(eq(schema.crmDeals.orgId, orgId));

    const triggered: Array<{ ruleId: string; ruleName: string; dealId: string; dealTitle: string; action: string }> = [];

    for (const rule of rules) {
      const config = rule.triggerConfig as any;

      if (rule.triggerType === 'days_in_stage') {
        const threshold = config.daysThreshold || 30;
        for (const deal of deals) {
          if (!deal.currentStageEnteredAt) continue;
          const days = Math.floor((Date.now() - new Date(deal.currentStageEnteredAt).getTime()) / 86400000);
          if (days >= threshold) {
            triggered.push({
              ruleId: rule.id,
              ruleName: rule.name,
              dealId: deal.id,
              dealTitle: deal.title,
              action: rule.actionType,
            });
          }
        }
      }

      if (rule.triggerType === 'stage_change' && config.toStage) {
        for (const deal of deals) {
          if (deal.stage === config.toStage) {
            triggered.push({
              ruleId: rule.id,
              ruleName: rule.name,
              dealId: deal.id,
              dealTitle: deal.title,
              action: rule.actionType,
            });
          }
        }
      }
    }

    // Update execution counts
    const ruleIds = [...new Set(triggered.map(t => t.ruleId))];
    for (const ruleId of ruleIds) {
      await db.update(schema.pipelineAutomationRules)
        .set({
          executionCount: sql`COALESCE(${schema.pipelineAutomationRules.executionCount}, 0) + 1`,
          lastExecutedAt: new Date(),
        })
        .where(eq(schema.pipelineAutomationRules.id, ruleId));
    }

    res.json({
      evaluated: rules.length,
      dealsChecked: deals.length,
      triggered,
    });
  } catch (error) {
    console.error('Error evaluating automation rules:', error);
    res.status(500).json({ error: 'Failed to evaluate automation rules' });
  }
});

export default router;
