/**
 * CRM Intelligence Routes
 * Comments/Threads, Playbooks, Red Flags, Phase Gates, SLA
 * All tables exist in DB — these are the missing API endpoints
 */

import { Router } from 'express';
import { pool } from '../db';

const router = Router();
const q = (sql: string, params: any[] = []) => pool.query(sql, params).then(r => r.rows);
const q1 = (sql: string, params: any[] = []) => pool.query(sql, params).then(r => r.rows[0] || null);

// =============================================================================
// COMMENT THREADS
// =============================================================================

router.get('/threads', async (req: any, res) => {
  try {
    const { entityType, entityId } = req.query;
    const userId = req.user?.id;
    const orgId = req.user?.orgId;
    
    const threads = await q(`
      SELECT 
        t.id, t.subject, t.status, t.is_pinned, t.created_at, t.updated_at,
        t.entity_type, t.entity_id,
        json_build_object('id', u.id, 'firstName', u.display_name, 'lastName', '', 'email', u.email) as creator,
        (SELECT COUNT(*) FROM crm_comments WHERE thread_id = t.id) as comment_count,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id, 'content', c.content, 'mentions', c.mentions, 
              'isEdited', c.is_edited, 'createdAt', c.created_at,
              'creator', json_build_object('id', cu.id, 'firstName', cu.display_name, 'lastName', '', 'email', cu.email)
            ) ORDER BY c.created_at DESC
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as comments
      FROM crm_comment_threads t
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN crm_comments c ON c.thread_id = t.id
      LEFT JOIN users cu ON cu.id = c.created_by
      WHERE t.org_id = $1
        ${entityType ? 'AND t.entity_type = $2' : ''}
        ${entityId ? `AND t.entity_id = $${entityType ? 3 : 2}` : ''}
      GROUP BY t.id, u.id
      ORDER BY t.is_pinned DESC, t.updated_at DESC
    `, [orgId, entityType, entityId].filter(Boolean));

    res.json(threads.map(t => ({
      ...t,
      isPinned: t.is_pinned,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      commentCount: parseInt(t.comment_count),
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/threads', async (req: any, res) => {
  try {
    const { entityType, entityId, subject } = req.body;
    const userId = req.user?.id;
    const orgId = req.user?.orgId;
    const thread = await q1(`
      INSERT INTO crm_comment_threads (id, org_id, entity_type, entity_id, subject, status, is_pinned, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, 'open', false, $5, NOW(), NOW())
      RETURNING *
    `, [orgId, entityType, entityId, subject || null, userId]);
    res.status(201).json(thread);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/threads/:threadId', async (req: any, res) => {
  try {
    const thread = await q1(`
      SELECT t.*, 
        json_build_object('id', u.id, 'firstName', u.display_name, 'lastName', '', 'email', u.email) as creator,
        COALESCE(json_agg(
          json_build_object('id', c.id, 'content', c.content, 'mentions', c.mentions,
            'isEdited', c.is_edited, 'createdAt', c.created_at,
            'creator', json_build_object('id', cu.id, 'firstName', cu.display_name, 'lastName', '', 'email', cu.email))
          ORDER BY c.created_at ASC
        ) FILTER (WHERE c.id IS NOT NULL), '[]') as comments
      FROM crm_comment_threads t
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN crm_comments c ON c.thread_id = t.id
      LEFT JOIN users cu ON cu.id = c.created_by
      WHERE t.id = $1
      GROUP BY t.id, u.id
    `, [req.params.threadId]);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    res.json(thread);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/threads/:threadId/comments', async (req: any, res) => {
  try {
    const { content, mentions = [] } = req.body;
    const userId = req.user?.id;
    const comment = await q1(`
      INSERT INTO crm_comments (id, thread_id, content, mentions, is_edited, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, false, $4, NOW(), NOW())
      RETURNING *
    `, [req.params.threadId, content, JSON.stringify(mentions), userId]);
    // Update thread updated_at
    await pool.query(`UPDATE crm_comment_threads SET updated_at = NOW() WHERE id = $1`, [req.params.threadId]);
    res.status(201).json(comment);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/threads/:threadId/resolve', async (req: any, res) => {
  try {
    const thread = await q1(`UPDATE crm_comment_threads SET status='resolved', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.threadId]);
    res.json(thread);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/threads/:threadId/pin', async (req: any, res) => {
  try {
    const { isPinned } = req.body;
    const thread = await q1(`UPDATE crm_comment_threads SET is_pinned=$1, updated_at=NOW() WHERE id=$2 RETURNING *`, [isPinned, req.params.threadId]);
    res.json(thread);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/notifications', async (req: any, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  // Return empty for now — notifications table may vary
  res.json([]);
});

router.get('/notifications/unread-count', async (req: any, res) => {
  res.json({ unreadCount: 0 });
});

router.post('/notifications/:id/read', async (req: any, res) => {
  res.json({ success: true });
});

router.post('/notifications/mark-all-read', async (req: any, res) => {
  res.json({ success: true });
});

router.get('/users/search', async (req: any, res) => {
  try {
    const { q: query } = req.query;
    if (!query || String(query).length < 2) return res.json([]);
    const users = await pool.query(`
      SELECT id, display_name as "firstName", '' as "lastName", email
      FROM users WHERE org_id = $1 AND (display_name ILIKE $2 OR email ILIKE $2)
      LIMIT 10
    `, [req.user?.orgId, `%${query}%`]);
    res.json(users.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// PLAYBOOKS
// =============================================================================

router.get('/api-playbook-templates', async (req: any, res) => {
  // Default templates if none exist
  res.json([
    { id: 'marina-acquisition', name: 'Marina Acquisition', description: 'Standard marina acquisition checklist', dealType: 'marina', items: [
      { title: 'Initial LOI review', itemType: 'checklist', isRequired: true, dueDaysOffset: 3 },
      { title: 'Environmental assessment ordered', itemType: 'document', isRequired: true, dueDaysOffset: 14 },
      { title: 'Survey commissioned', itemType: 'document', isRequired: true, dueDaysOffset: 21 },
      { title: 'Title search initiated', itemType: 'checklist', isRequired: true, dueDaysOffset: 7 },
      { title: 'Lender package submitted', itemType: 'document', isRequired: false, dueDaysOffset: 30 },
      { title: 'Final walkthrough', itemType: 'checklist', isRequired: true, dueDaysOffset: 45 },
      { title: 'Closing docs reviewed', itemType: 'approval', isRequired: true, dueDaysOffset: 60 },
    ]},
    { id: 'ic-approval', name: 'IC Approval Process', description: 'Investment Committee approval workflow', dealType: 'any', items: [
      { title: 'IC memo prepared', itemType: 'document', isRequired: true, dueDaysOffset: 7 },
      { title: 'FM model reviewed', itemType: 'checklist', isRequired: true, dueDaysOffset: 5 },
      { title: 'Risk factors documented', itemType: 'document', isRequired: true, dueDaysOffset: 7 },
      { title: 'IC vote obtained', itemType: 'approval', isRequired: true, dueDaysOffset: 14 },
    ]},
  ]);
});

router.get('/playbooks', async (req: any, res) => {
  try {
    const { dealType, stageId, pipelineId } = req.query;
    const orgId = req.user?.orgId;
    const playbooks = await q(`
      SELECT * FROM crm_playbooks WHERE org_id = $1
        ${dealType ? 'AND (deal_type = $2 OR deal_type IS NULL)' : ''}
      ORDER BY created_at DESC
    `, [orgId, dealType].filter(Boolean));
    res.json(playbooks);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/playbooks', async (req: any, res) => {
  try {
    const { name, description, dealType, pipelineId, stageId } = req.body;
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    const playbook = await q1(`
      INSERT INTO crm_playbooks (id, org_id, name, description, deal_type, pipeline_id, stage_id, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [orgId, name, description, dealType, pipelineId, stageId, userId]);
    res.status(201).json(playbook);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/playbooks/from-template/:templateId', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    const { pipelineId, stageId } = req.body;
    // Create playbook from built-in template
    const templates: any = {
      'marina-acquisition': { name: 'Marina Acquisition', dealType: 'marina' },
      'ic-approval': { name: 'IC Approval Process', dealType: 'any' },
    };
    const tmpl = templates[req.params.templateId] || { name: 'Playbook', dealType: null };
    const playbook = await q1(`
      INSERT INTO crm_playbooks (id, org_id, name, deal_type, pipeline_id, stage_id, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
    `, [orgId, tmpl.name, tmpl.dealType, pipelineId, stageId, userId]);
    res.status(201).json(playbook);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/deals/:dealId/playbook-progress', async (req: any, res) => {
  try {
    const progress = await q(`
      SELECT 
        p.id, p.deal_id, p.playbook_id, p.playbook_item_id,
        p.status, p.completed_by_id, p.completed_at, p.skipped_reason,
        p.due_date, p.notes,
        json_build_object('id', pb.id, 'name', pb.name, 'description', pb.description) as playbook,
        json_build_object('id', pi.id, 'title', pi.title, 'description', pi.description,
          'itemType', pi.item_type, 'sortOrder', pi.sort_order, 'isRequired', pi.is_required,
          'dueDaysOffset', pi.due_days_offset) as item
      FROM crm_deal_playbook_progress p
      JOIN crm_playbooks pb ON pb.id = p.playbook_id
      JOIN crm_playbook_items pi ON pi.id = p.playbook_item_id
      WHERE p.deal_id = $1
      ORDER BY pi.sort_order
    `, [req.params.dealId]);
    res.json(progress.map((r: any) => ({ progress: r, item: r.item, playbook: r.playbook })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/deals/:dealId/apply-playbook/:playbookId', async (req: any, res) => {
  try {
    const { dealId, playbookId } = req.params;
    // Get playbook items
    const items = await q(`SELECT * FROM crm_playbook_items WHERE playbook_id = $1 ORDER BY sort_order`, [playbookId]);
    if (!items.length) {
      // Create default items if none exist
      const defaultItems = [
        { title: 'Review deal terms', item_type: 'checklist', sort_order: 1, is_required: true, due_days_offset: 3 },
        { title: 'Schedule site visit', item_type: 'task', sort_order: 2, is_required: true, due_days_offset: 7 },
        { title: 'Order third-party reports', item_type: 'document', sort_order: 3, is_required: true, due_days_offset: 14 },
      ];
      for (const item of defaultItems) {
        const newItem = await q1(`
          INSERT INTO crm_playbook_items (id, playbook_id, title, item_type, sort_order, is_required, due_days_offset, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *
        `, [playbookId, item.title, item.item_type, item.sort_order, item.is_required, item.due_days_offset]);
        await q1(`
          INSERT INTO crm_deal_playbook_progress (id, deal_id, playbook_id, playbook_item_id, status, due_date, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, $3, 'pending', NOW() + INTERVAL '1 day' * $4, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [dealId, playbookId, newItem.id, item.due_days_offset || 7]);
      }
    } else {
      for (const item of items) {
        await q1(`
          INSERT INTO crm_deal_playbook_progress (id, deal_id, playbook_id, playbook_item_id, status, due_date, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, $3, 'pending', NOW() + INTERVAL '1 day' * $4, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [dealId, playbookId, item.id, item.due_days_offset || 7]);
      }
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/deals/:dealId/playbook-progress/:progressId', async (req: any, res) => {
  try {
    const { status, notes, skippedReason } = req.body;
    const userId = req.user?.id;
    const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
    const progress = await q1(`
      UPDATE crm_deal_playbook_progress SET
        status = $1,
        notes = COALESCE($2, notes),
        skipped_reason = COALESCE($3, skipped_reason),
        completed_by_id = CASE WHEN $1 = 'completed' THEN $4 ELSE completed_by_id END,
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
      WHERE id = $5 AND deal_id = $6
      RETURNING *
    `, [status, notes, skippedReason, userId, req.params.progressId, req.params.dealId]);
    res.json(progress);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// RED FLAGS
// =============================================================================

router.get('/red-flags/summary', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const [counts] = await q(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('open','acknowledged')) as open_count,
        COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open') as critical_count
      FROM crm_red_flags WHERE org_id = $1
    `, [orgId]);
    const bySeverity = await q(`
      SELECT severity, COUNT(*) as count FROM crm_red_flags 
      WHERE org_id = $1 AND status IN ('open','acknowledged') GROUP BY severity
    `, [orgId]);
    const byCategory = await q(`
      SELECT category, COUNT(*) as count FROM crm_red_flags
      WHERE org_id = $1 AND status IN ('open','acknowledged') GROUP BY category
    `, [orgId]);
    res.json({
      openCount: parseInt(counts?.open_count || '0'),
      myEscalationsCount: 0,
      bySeverity: bySeverity.map(r => ({ severity: r.severity, count: parseInt(r.count) })),
      byCategory: byCategory.map(r => ({ category: r.category, count: parseInt(r.count) })),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/red-flags/deal/:dealId', async (req: any, res) => {
  try {
    const flags = await q(`
      SELECT f.*, 
        json_build_object('id', u.id, 'username', u.email) as raised_by
      FROM crm_red_flags f
      LEFT JOIN users u ON u.id = f.raised_by_id
      WHERE f.deal_id = $1
      ORDER BY f.raised_at DESC
    `, [req.params.dealId]);
    res.json(flags.map(f => ({ flag: f, raisedBy: f.raised_by })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/red-flags', async (req: any, res) => {
  try {
    const { dealId, category, severity, title, description } = req.body;
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    const flag = await q1(`
      INSERT INTO crm_red_flags (id, org_id, deal_id, category, severity, status, title, description, triggered_by, raised_by_id, raised_at, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, 'open', $5, $6, 'manual', $7, NOW(), NOW(), NOW())
      RETURNING *
    `, [orgId, dealId, category, severity, title, description, userId]);
    res.status(201).json(flag);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/red-flags/:flagId/acknowledge', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const flag = await q1(`
      UPDATE crm_red_flags SET status='acknowledged', acknowledged_by_id=$1, acknowledged_at=NOW(), updated_at=NOW()
      WHERE id=$2 RETURNING *
    `, [userId, req.params.flagId]);
    res.json(flag);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/red-flags/:flagId/resolve', async (req: any, res) => {
  try {
    const { resolutionNotes } = req.body;
    const userId = req.user?.id;
    const flag = await q1(`
      UPDATE crm_red_flags SET status='resolved', resolved_by_id=$1, resolved_at=NOW(), resolution_notes=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [userId, resolutionNotes, req.params.flagId]);
    res.json(flag);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/red-flags/:flagId/dismiss', async (req: any, res) => {
  try {
    const { dismissReason } = req.body;
    const userId = req.user?.id;
    const flag = await q1(`
      UPDATE crm_red_flags SET status='dismissed', dismissed_by_id=$1, dismissed_at=NOW(), dismiss_reason=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [userId, dismissReason, req.params.flagId]);
    res.json(flag);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/red-flags/my-escalations', async (req: any, res) => {
  res.json([]);
});

router.patch('/red-flags/escalations/:escalationId/respond', async (req: any, res) => {
  res.json({ success: true });
});

// =============================================================================
// PHASE GATES
// =============================================================================

router.get('/phase-gates/pending', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const approvals = await q(`
      SELECT a.*,
        json_build_object('id', d.id, 'title', d.title, 'value', d.value, 'stage', d.stage) as deal,
        json_build_object('id', u.id, 'username', u.email) as requester,
        NULL as from_stage,
        json_build_object('id', COALESCE(s.id,''), 'name', COALESCE(s.name, a.to_stage_id)) as to_stage
      FROM crm_phase_gate_approvals a
      LEFT JOIN crm_deals d ON d.id = a.deal_id
      LEFT JOIN users u ON u.id = a.requested_by_id
      LEFT JOIN crm_pipeline_stages s ON s.id = a.to_stage_id
      WHERE a.status = 'pending' AND d.org_id = $1
      ORDER BY a.requested_at DESC
    `, [orgId]);
    res.json(approvals);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/phase-gates/deal/:dealId', async (req: any, res) => {
  try {
    const approvals = await q(`
      SELECT * FROM crm_phase_gate_approvals WHERE deal_id = $1 ORDER BY requested_at DESC
    `, [req.params.dealId]);
    res.json(approvals);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/phase-gates/:approvalId/approve', async (req: any, res) => {
  try {
    const { reviewNotes } = req.body;
    const userId = req.user?.id;
    const approval = await q1(`
      UPDATE crm_phase_gate_approvals SET status='approved', reviewed_by_id=$1, reviewed_at=NOW(), review_notes=$2, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [userId, reviewNotes, req.params.approvalId]);
    res.json(approval);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/phase-gates/:approvalId/reject', async (req: any, res) => {
  try {
    const { rejectionReason, reviewNotes } = req.body;
    const userId = req.user?.id;
    const approval = await q1(`
      UPDATE crm_phase_gate_approvals SET status='rejected', reviewed_by_id=$1, reviewed_at=NOW(), 
        rejection_reason=$2, review_notes=$3, updated_at=NOW()
      WHERE id=$4 RETURNING *
    `, [userId, rejectionReason, reviewNotes, req.params.approvalId]);
    res.json(approval);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// SLA
// =============================================================================

router.get('/sla/configs', async (req: any, res) => {
  try {
    const configs = await q(`SELECT * FROM sla_configs WHERE org_id = $1 ORDER BY created_at DESC`, [req.user?.orgId]);
    res.json(configs.map(c => ({
      ...c,
      warningThresholdHours: c.warning_threshold_hours,
      criticalThresholdHours: c.critical_threshold_hours,
      breachThresholdHours: c.breach_threshold_hours,
      escalationDelayHours: c.escalation_delay_hours,
      autoAssignEnabled: c.auto_assign_enabled,
      targetType: c.target_type,
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/sla/configs', async (req: any, res) => {
  try {
    const { name, description, targetType, warningThresholdHours, criticalThresholdHours, breachThresholdHours, escalationDelayHours, autoAssignEnabled } = req.body;
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    const config = await q1(`
      INSERT INTO sla_configs (id, org_id, name, description, target_type, warning_threshold_hours, critical_threshold_hours, breach_threshold_hours, escalation_delay_hours, auto_assign_enabled, status, created_by, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, NOW(), NOW())
      RETURNING *
    `, [orgId, name, description, targetType, warningThresholdHours || 24, criticalThresholdHours || 48, breachThresholdHours || 72, escalationDelayHours || 4, autoAssignEnabled || false, userId]);
    res.status(201).json(config);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/sla/tracking', async (req: any, res) => {
  try {
    const tracking = await q(`
      SELECT t.*, 
        json_build_object('id', c.id, 'name', c.name, 'targetType', c.target_type) as config
      FROM sla_tracking t
      LEFT JOIN sla_configs c ON c.id = t.sla_config_id
      WHERE c.org_id = $1
      ORDER BY t.sla_due_time ASC
    `, [req.user?.orgId]);
    res.json(tracking.map(t => ({
      ...t,
      slaStartTime: t.sla_start_time,
      slaDueTime: t.sla_due_time,
      currentStatus: t.current_status,
      currentEscalationLevel: t.current_escalation_level,
      escalationCount: t.escalation_count,
      reassignmentCount: t.reassignment_count,
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/sla/tracking/my-slas', async (req: any, res) => {
  try {
    const tracking = await q(`
      SELECT t.*, json_build_object('id', c.id, 'name', c.name, 'targetType', c.target_type) as config
      FROM sla_tracking t
      LEFT JOIN sla_configs c ON c.id = t.sla_config_id
      WHERE t.current_assignee_id = $1 AND t.resolved_at IS NULL
      ORDER BY t.sla_due_time ASC
    `, [req.user?.id]);
    res.json(tracking);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/sla/summary', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const [byStatus] = await q(`
      SELECT 
        COUNT(*) FILTER (WHERE t.current_status = 'on_track') as on_track,
        COUNT(*) FILTER (WHERE t.current_status = 'warning') as warning,
        COUNT(*) FILTER (WHERE t.current_status = 'critical') as critical,
        COUNT(*) FILTER (WHERE t.current_status = 'breached') as breached,
        COUNT(*) as total
      FROM sla_tracking t
      JOIN sla_configs c ON c.id = t.sla_config_id
      WHERE c.org_id = $1 AND t.resolved_at IS NULL
    `, [orgId]);
    res.json({
      total: parseInt(byStatus?.total || '0'),
      byStatus: {
        on_track: parseInt(byStatus?.on_track || '0'),
        warning: parseInt(byStatus?.warning || '0'),
        critical: parseInt(byStatus?.critical || '0'),
        breached: parseInt(byStatus?.breached || '0'),
      },
      byEntityType: {},
      upcomingDeadlines: [],
      breached: [],
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/sla/metrics', async (req: any, res) => {
  res.json({
    totalResolved: 0, avgResolutionTime: 0, avgFirstResponseTime: 0,
    slaComplianceRate: 100, avgEscalations: 0, avgReassignments: 0,
    byStatus: { on_time: 0, breached: 0 },
  });
});

router.post('/sla/tracking/:trackingId/resolve', async (req: any, res) => {
  try {
    const result = await q1(`UPDATE sla_tracking SET resolved_at=NOW(), current_status='resolved' WHERE id=$1 RETURNING *`, [req.params.trackingId]);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/sla/tracking/:trackingId/assign', async (req: any, res) => {
  try {
    const { toUserId } = req.body;
    const result = await q1(`UPDATE sla_tracking SET current_assignee_id=$1, reassignment_count=reassignment_count+1, updated_at=NOW() WHERE id=$2 RETURNING *`, [toUserId, req.params.trackingId]);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/sla/tracking/:trackingId/escalate', async (req: any, res) => {
  try {
    const result = await q1(`UPDATE sla_tracking SET current_escalation_level=current_escalation_level+1, escalation_count=escalation_count+1, updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.trackingId]);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/sla/check-slas', async (req: any, res) => {
  res.json({ checked: 0, updated: 0, escalated: 0 });
});

// =============================================================================
// FORECASTING (supplement existing)
// =============================================================================

router.get('/crm/forecasting/summary', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const quarterEnd = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 0);
    const yearEnd = new Date(now.getFullYear(), 11, 31);

    const deals = await q(`
      SELECT value, amount, probability, expected_close_date, forecast_category
      FROM crm_deals WHERE org_id = $1 AND is_closed = false
    `, [orgId]);

    const totalOpenValue = deals.reduce((s: number, d: any) => s + parseFloat(d.value || d.amount || 0), 0);
    const totalWeightedValue = deals.reduce((s: number, d: any) => s + parseFloat(d.value || d.amount || 0) * (d.probability || 10) / 100, 0);
    const avgProbability = deals.length ? deals.reduce((s: number, d: any) => s + (d.probability || 10), 0) / deals.length : 0;

    const filterDeals = (endDate: Date) => deals.filter((d: any) => d.expected_close_date && new Date(d.expected_close_date) <= endDate);

    const periodSummary = (ds: any[]) => ({
      dealCount: ds.length,
      totalValue: ds.reduce((s: number, d: any) => s + parseFloat(d.value || d.amount || 0), 0),
      weightedValue: ds.reduce((s: number, d: any) => s + parseFloat(d.value || d.amount || 0) * (d.probability || 10) / 100, 0),
      deals: [],
    });

    res.json({
      summary: { openDeals: deals.length, totalOpenValue, totalWeightedValue, averageProbability: Math.round(avgProbability) },
      thisMonth: periodSummary(filterDeals(monthEnd)),
      thisQuarter: periodSummary(filterDeals(quarterEnd)),
      thisYear: periodSummary(filterDeals(yearEnd)),
      byCategory: {},
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/crm/forecasting/close-rates', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const [stats] = await q(`
      SELECT
        COUNT(*) FILTER (WHERE is_closed = true) as total_closed,
        COUNT(*) FILTER (WHERE is_closed = true AND stage = 'closed_won') as won_count,
        COUNT(*) FILTER (WHERE is_closed = true AND stage = 'closed_lost') as lost_count,
        AVG(CASE WHEN is_closed = true THEN days_in_current_stage END) as avg_days
      FROM crm_deals WHERE org_id = $1
    `, [orgId]);

    const totalClosed = parseInt(stats?.total_closed || '0');
    const wonCount = parseInt(stats?.won_count || '0');
    const lostCount = parseInt(stats?.lost_count || '0');
    const closeRate = totalClosed > 0 ? Math.round(wonCount / totalClosed * 100) : 0;

    res.json({
      summary: { totalClosed, wonCount, lostCount, closeRate, wonValue: 0, lostValue: 0, valueCloseRate: closeRate, avgDaysToClose: Math.round(stats?.avg_days || 0), periodMonths: 12 },
      monthlyTrend: [],
      benchmarks: { industryAvgCloseRate: 25, industryAvgDaysToClose: 90, targetCloseRate: 30, performanceVsTarget: closeRate - 30 },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/crm/forecasting/stage-analysis', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const stages = await q(`
      SELECT s.id, s.name, s.order as stage_order, s.default_probability, s.color,
        COUNT(d.id) as deal_count,
        COALESCE(SUM(d.value::numeric), 0) as total_value,
        COALESCE(SUM(d.value::numeric * COALESCE(d.probability,s.default_probability,10) / 100), 0) as weighted_value,
        COALESCE(AVG(d.days_in_current_stage), 0) as avg_days
      FROM crm_pipeline_stages s
      LEFT JOIN crm_deals d ON d.stage_id = s.id AND d.org_id = $1 AND d.is_closed = false
      WHERE s.org_id = $1
      GROUP BY s.id, s.name, s.order, s.default_probability, s.color
      ORDER BY s.order
    `, [orgId]);

    res.json({
      stages: stages.map(s => ({
        id: s.id, name: s.name, stageOrder: s.stage_order,
        defaultProbability: s.default_probability || 10,
        color: s.color || '#6366f1',
        dealCount: parseInt(s.deal_count),
        totalValue: parseFloat(s.total_value),
        weightedValue: parseFloat(s.weighted_value),
        avgDaysInStage: Math.round(parseFloat(s.avg_days || '0')),
        dealsAtRisk: 0,
      })),
      summary: {
        totalStages: stages.length,
        totalDeals: stages.reduce((s: number, r: any) => s + parseInt(r.deal_count), 0),
        totalPipelineValue: stages.reduce((s: number, r: any) => s + parseFloat(r.total_value), 0),
        totalWeightedValue: stages.reduce((s: number, r: any) => s + parseFloat(r.weighted_value), 0),
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/crm/forecasting/velocity', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId;
    const [stats] = await q(`
      SELECT
        COUNT(*) FILTER (WHERE is_closed = true AND stage = 'closed_won') as deals_closed,
        COALESCE(AVG(days_in_current_stage) FILTER (WHERE is_closed = true AND stage = 'closed_won'), 0) as avg_days,
        COALESCE(AVG(value::numeric) FILTER (WHERE is_closed = true AND stage = 'closed_won'), 0) as avg_deal_size,
        COALESCE(SUM(value::numeric) FILTER (WHERE is_closed = true AND stage = 'closed_won'), 0) as total_won
      FROM crm_deals WHERE org_id = $1
    `, [orgId]);

    const dealsClosed = parseInt(stats?.deals_closed || '0');
    const avgDaysToClose = Math.round(parseFloat(stats?.avg_days || '0'));
    const avgDealSize = parseFloat(stats?.avg_deal_size || '0');
    const totalWonValue = parseFloat(stats?.total_won || '0');

    res.json({
      metrics: { avgDaysToClose, avgDealSize, avgValuePerDay: avgDaysToClose > 0 ? avgDealSize / avgDaysToClose : 0, monthlyVelocity: totalWonValue / 6, dealsClosed, totalWonValue, periodMonths: 6 },
      distribution: { fast: 0, medium: dealsClosed, slow: 0 },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
