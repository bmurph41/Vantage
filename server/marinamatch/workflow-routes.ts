/**
 * workflow-routes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount in your existing router file:
 *
 *   import workflowRouter from './workflow-routes';
 *   router.use('/workflow', workflowRouter);
 *
 * Resulting paths:
 *   GET    /api/vantage/workflow/rules
 *   POST   /api/vantage/workflow/rules
 *   PATCH  /api/vantage/workflow/rules/:id
 *   DELETE /api/vantage/workflow/rules/:id
 *   POST   /api/vantage/workflow/rules/:id/trigger   (manual fire)
 *   GET    /api/vantage/workflow/executions
 *   GET    /api/vantage/workflow/tasks
 *   PATCH  /api/vantage/workflow/tasks/:id
 *   GET    /api/vantage/workflow/notifications
 *   POST   /api/vantage/workflow/notifications/:id/read
 *   POST   /api/vantage/workflow/notifications/read-all
 *   GET    /api/vantage/workflow/stats
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db'; // adjust path
import { WorkflowEngine } from './workflow-engine';

const router = Router();

// ── Auth helper (mirrors your existing pattern) ───────────────────────────────

function getOrgId(req: Request): string | null {
  return (req as any).orgId ?? (req as any).user?.orgId ?? null;
}
function getUserId(req: Request): string | null {
  return (req as any).userId ?? (req as any).user?.id ?? null;
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq','ne','gt','lt','gte','lte','contains','not_contains','in','not_in','is_empty','is_not_empty']),
  value: z.any().optional(),
});

const actionSchema = z.object({
  type: z.enum(['change_status','assign_to','add_note','create_task','send_notification','send_email','webhook']),
  config: z.record(z.any()),
});

const ruleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
  run_order: z.number().int().optional().default(0),
  trigger_type: z.enum(['deal_added','deal_stage_changed','deal_score_threshold','deal_stale','deal_converted','deal_disqualified','manual']),
  trigger_config: z.record(z.any()).optional().default({}),
  conditions: z.array(conditionSchema).optional().default([]),
  actions: z.array(actionSchema).min(1, 'At least one action required'),
});

// ─── Rules CRUD ───────────────────────────────────────────────────────────────

// GET /rules
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT * FROM workflow_rules WHERE org_id = $1 ORDER BY run_order ASC, created_at ASC`,
      [orgId]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('[WorkflowRoutes] GET rules:', err);
    res.status(500).json({ error: 'Failed to load rules' });
  }
});

// POST /rules
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const data = ruleSchema.parse(req.body);
    const { rows: [rule] } = await pool.query(
      `INSERT INTO workflow_rules
       (org_id, name, description, is_active, run_order, trigger_type, trigger_config,
        conditions, actions, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
       RETURNING *`,
      [
        orgId, data.name, data.description ?? null, data.is_active, data.run_order,
        data.trigger_type, JSON.stringify(data.trigger_config),
        JSON.stringify(data.conditions), JSON.stringify(data.actions), userId,
      ]
    );
    res.status(201).json(rule);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors });
    console.error('[WorkflowRoutes] POST rule:', err);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// PATCH /rules/:id
router.patch('/rules/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const data = ruleSchema.partial().parse(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const map: Record<string, any> = {
      name: data.name,
      description: data.description,
      is_active: data.is_active,
      run_order: data.run_order,
      trigger_type: data.trigger_type,
      trigger_config: data.trigger_config != null ? JSON.stringify(data.trigger_config) : undefined,
      conditions: data.conditions != null ? JSON.stringify(data.conditions) : undefined,
      actions: data.actions != null ? JSON.stringify(data.actions) : undefined,
    };

    for (const [key, val] of Object.entries(map)) {
      if (val !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    fields.push(`updated_at = NOW()`);

    values.push(req.params.id, orgId);
    const { rows: [updated] } = await pool.query(
      `UPDATE workflow_rules SET ${fields.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
      values
    );
    if (!updated) return res.status(404).json({ error: 'Rule not found' });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation error', details: err.errors });
    console.error('[WorkflowRoutes] PATCH rule:', err);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// DELETE /rules/:id
router.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rowCount } = await pool.query(
      `DELETE FROM workflow_rules WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Rule not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[WorkflowRoutes] DELETE rule:', err);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

// POST /rules/:id/trigger — manual fire
router.post('/rules/:id/trigger', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows: [rule] } = await pool.query(
      `SELECT * FROM workflow_rules WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    let deal: any = null;
    if (req.body.dealId) {
      const { rows: [d] } = await pool.query(
        `SELECT * FROM sourced_deals WHERE id = $1 AND org_id = $2`,
        [req.body.dealId, orgId]
      );
      deal = d ?? null;
    }

    const executionId = await WorkflowEngine.executeRule(rule, {
      deal: deal ?? undefined,
      triggeredBy: userId ?? undefined,
      meta: { manual: true, ...req.body },
    });

    const { rows: [exec] } = await pool.query(
      `SELECT * FROM workflow_executions WHERE id = $1`,
      [executionId]
    );
    res.json({ executionId, execution: exec });
  } catch (err: any) {
    console.error('[WorkflowRoutes] manual trigger:', err);
    res.status(500).json({ error: 'Failed to trigger rule' });
  }
});

// ─── Executions ───────────────────────────────────────────────────────────────

router.get('/executions', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const ruleId = req.query.rule_id as string | undefined;
    const dealId = req.query.deal_id as string | undefined;
    const status = req.query.status as string | undefined;

    const conditions = ['e.org_id = $1'];
    const params: any[] = [orgId];
    let idx = 2;

    if (ruleId)  { conditions.push(`e.rule_id = $${idx++}`);  params.push(ruleId); }
    if (dealId)  { conditions.push(`e.deal_id = $${idx++}`);  params.push(dealId); }
    if (status)  { conditions.push(`e.status = $${idx++}`);   params.push(status); }
    params.push(limit);

    const { rows } = await pool.query(
      `SELECT e.*, r.name AS rule_name
       FROM workflow_executions e
       LEFT JOIN workflow_rules r ON r.id = e.rule_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.started_at DESC
       LIMIT $${idx}`,
      params
    );
    res.json(rows);
  } catch (err: any) {
    console.error('[WorkflowRoutes] GET executions:', err);
    res.status(500).json({ error: 'Failed to load executions' });
  }
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const assigneeId = req.query.assignee_id as string | undefined;
    const status = req.query.status as string ?? 'open';
    const dealId = req.query.deal_id as string | undefined;

    const conditions = ['org_id = $1'];
    const params: any[] = [orgId];
    let idx = 2;

    if (status !== 'all') { conditions.push(`status = $${idx++}`); params.push(status); }
    if (assigneeId) { conditions.push(`assignee_id = $${idx++}`); params.push(assigneeId); }
    if (dealId) { conditions.push(`deal_id = $${idx++}`); params.push(dealId); }

    const { rows } = await pool.query(
      `SELECT * FROM workflow_tasks WHERE ${conditions.join(' AND ')} ORDER BY due_date ASC NULLS LAST, created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load tasks' });
  }
});

router.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { status, completed_by } = req.body;
    const setClause = status === 'done'
      ? `status=$1, completed_at=NOW(), completed_by=$2, updated_at=NOW()`
      : `status=$1, updated_at=NOW()`;
    const params = status === 'done'
      ? [status, completed_by ?? null, req.params.id, orgId]
      : [status, req.params.id, orgId];

    const { rows: [task] } = await pool.query(
      `UPDATE workflow_tasks SET ${setClause} WHERE id=$${params.length - 1} AND org_id=$${params.length} RETURNING *`,
      params
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get('/notifications', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT * FROM workflow_notifications WHERE org_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 50`,
      [orgId, userId]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    await pool.query(
      `UPDATE workflow_notifications SET is_read=true, read_at=NOW() WHERE id=$1 AND user_id=$2`,
      [req.params.id, userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

router.post('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    if (!userId || !orgId) return res.status(401).json({ error: 'Unauthorized' });
    await pool.query(
      `UPDATE workflow_notifications SET is_read=true, read_at=NOW() WHERE org_id=$1 AND user_id=$2 AND is_read=false`,
      [orgId, userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [rulesRes, execRes, tasksRes, notifRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FILTER (WHERE is_active) AS active, COUNT(*) AS total FROM workflow_rules WHERE org_id=$1`, [orgId]),
      pool.query(
        `SELECT status, COUNT(*) as count FROM workflow_executions WHERE org_id=$1 AND started_at > NOW() - INTERVAL '7 days' GROUP BY status`,
        [orgId]
      ),
      pool.query(`SELECT COUNT(*) AS open_tasks FROM workflow_tasks WHERE org_id=$1 AND status='open'`, [orgId]),
      pool.query(`SELECT COUNT(*) AS unread FROM workflow_notifications WHERE org_id=$1 AND is_read=false`, [orgId]),
    ]);

    const execByStatus = Object.fromEntries(execRes.rows.map(r => [r.status, parseInt(r.count)]));

    res.json({
      rules: {
        active: parseInt(rulesRes.rows[0].active),
        total: parseInt(rulesRes.rows[0].total),
      },
      executions7d: {
        success: execByStatus.success ?? 0,
        failed: execByStatus.failed ?? 0,
        skipped: execByStatus.skipped ?? 0,
        partial: execByStatus.partial ?? 0,
        total: Object.values(execByStatus).reduce((a, b) => a + b, 0),
      },
      openTasks: parseInt(tasksRes.rows[0].open_tasks),
      unreadNotifications: parseInt(notifRes.rows[0].unread),
    });
  } catch (err: any) {
    console.error('[WorkflowRoutes] stats:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ─── Stale deal cron (call from your existing cron setup) ────────────────────
// Import and call: runStaleDealWorkflows(orgId, staleAfterDays)

export async function runStaleDealWorkflows(orgId: string, staleAfterDays = 14) {
  const { rows: staleDeals } = await pool.query(
    `SELECT * FROM sourced_deals
     WHERE org_id = $1
       AND status IN ('new', 'reviewing')
       AND updated_at < NOW() - INTERVAL '${staleAfterDays} days'`,
    [orgId]
  );

  for (const deal of staleDeals) {
    await WorkflowEngine.fire('deal_stale', orgId, {
      deal,
      staleAfterDays,
    });
  }
}

export default router;
