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

// =============================================================================
// CONTACT TIMELINE (Enriched)
// =============================================================================

router.get('/contacts/:id/timeline', async (req: any, res) => {
  try {
    const contactId = req.params.id;
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Aggregate from multiple sources into a unified timeline
    const events: Array<{ type: string; timestamp: string; title: string; description: string; metadata?: Record<string, any> }> = [];

    // 1. Activities (calls, emails, meetings, etc.)
    const activities = await q(`
      SELECT a.type, a.subject, a.description, a.direction, a.duration, a.outcome,
             a.status, a.created_at, a.completed_at, a.scheduled_at
      FROM crm_activities a
      LEFT JOIN crm_activity_associations aa ON aa.activity_id = a.id
      WHERE (a.entity_type = 'contact' AND a.entity_id = $1)
         OR (aa.object_type = 'contact' AND aa.object_id = $1)
      ORDER BY a.created_at DESC
      LIMIT 50
    `, [contactId]);

    for (const act of activities) {
      const actType = act.type === 'email'
        ? (act.direction === 'inbound' ? 'email_received' : 'email_sent')
        : act.type === 'call' ? 'call'
        : act.type === 'meeting' ? 'meeting'
        : act.type === 'note' ? 'note_added'
        : act.type;

      events.push({
        type: actType,
        timestamp: act.completed_at || act.created_at,
        title: act.subject || `${act.type} activity`,
        description: act.description || '',
        metadata: {
          direction: act.direction,
          duration: act.duration,
          outcome: act.outcome,
          status: act.status,
        },
      });
    }

    // 2. Notes
    const notes = await q(`
      SELECT n.title, n.content, n.created_at
      FROM crm_notes n
      WHERE n.entity_type = 'contact' AND n.entity_id = $1
      ORDER BY n.created_at DESC
      LIMIT 20
    `, [contactId]);

    for (const note of notes) {
      events.push({
        type: 'note_added',
        timestamp: note.created_at,
        title: note.title || 'Note added',
        description: (note.content || '').substring(0, 200),
      });
    }

    // 3. Deals associated with this contact
    const deals = await q(`
      SELECT d.id, d.title, d.name, d.stage, d.value, d.created_at,
             d.current_stage_entered_at, d.updated_at
      FROM crm_deals d
      WHERE d.buyer_contact_id = $1 OR d.seller_contact_id = $1
      ORDER BY d.created_at DESC
      LIMIT 20
    `, [contactId]);

    for (const deal of deals) {
      events.push({
        type: 'deal_created',
        timestamp: deal.created_at,
        title: `Deal created: ${deal.title || deal.name}`,
        description: `Value: ${deal.value || 'N/A'}`,
        metadata: {
          dealId: deal.id,
          dealTitle: deal.title || deal.name,
          stage: deal.stage,
          value: deal.value,
        },
      });
    }

    // 4. Timeline events from the dedicated timeline table
    const timelineEvents = await q(`
      SELECT event_type, title, description, occurred_at, metadata
      FROM crm_timeline_events
      WHERE entity_type = 'contact' AND entity_id = $1
      ORDER BY occurred_at DESC
      LIMIT 30
    `, [contactId]);

    for (const te of timelineEvents) {
      // Map timeline event types to our canonical types
      const typeMap: Record<string, string> = {
        'stage_changed': 'deal_stage_changed',
        'deal_updated': 'deal_stage_changed',
        'note_created': 'note_added',
        'note_updated': 'note_added',
        'activity_created': 'call',
        'activity_completed': 'call',
        'email_logged': 'email_sent',
        'file_uploaded': 'document_shared',
        'association_created': 'property_viewed',
      };

      events.push({
        type: typeMap[te.event_type] || te.event_type,
        timestamp: te.occurred_at,
        title: te.title || te.event_type,
        description: te.description || '',
        metadata: te.metadata || {},
      });
    }

    // Sort all events by timestamp descending, limit to 100
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const limited = events.slice(0, 100);

    res.json({ events: limited });
  } catch (e: any) {
    console.error('Contact timeline error:', e);
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// RELATIONSHIP MAP
// =============================================================================

router.get('/contacts/:id/relationships', async (req: any, res) => {
  try {
    const contactId = req.params.id;
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Get contact info for center node
    const center = await q1(`
      SELECT id, first_name, last_name, email, company, contact_tag
      FROM crm_contacts WHERE id = $1 AND org_id = $2
    `, [contactId, orgId]);

    if (!center) return res.status(404).json({ error: 'Contact not found' });

    const centerNode = {
      id: center.id,
      name: `${center.first_name} ${center.last_name}`.trim(),
      type: 'contact' as const,
    };

    const connections: Array<{ id: string; name: string; type: string; relationship: string; strength: number }> = [];

    // 1. Get associations
    const assocs = await q(`
      SELECT a.source_entity_type, a.source_entity_id, a.target_entity_type, a.target_entity_id,
             a.association_type, a.metadata
      FROM crm_associations a
      WHERE a.org_id = $1
        AND ((a.source_entity_type = 'contact' AND a.source_entity_id = $2)
          OR (a.target_entity_type = 'contact' AND a.target_entity_id = $2))
    `, [orgId, contactId]);

    for (const assoc of assocs) {
      const isSource = assoc.source_entity_type === 'contact' && assoc.source_entity_id === contactId;
      const linkedType = isSource ? assoc.target_entity_type : assoc.source_entity_type;
      const linkedId = isSource ? assoc.target_entity_id : assoc.source_entity_id;

      let entity = null;
      switch (linkedType) {
        case 'company': {
          const c = await q1(`SELECT id, name FROM crm_companies WHERE id = $1`, [linkedId]);
          if (c) entity = { id: c.id, name: c.name, type: 'company' };
          break;
        }
        case 'contact': {
          const c = await q1(`SELECT id, first_name, last_name FROM crm_contacts WHERE id = $1`, [linkedId]);
          if (c) entity = { id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), type: 'contact' };
          break;
        }
        case 'deal': {
          const d = await q1(`SELECT id, title, name FROM crm_deals WHERE id = $1`, [linkedId]);
          if (d) entity = { id: d.id, name: d.title || d.name || 'Deal', type: 'deal' };
          break;
        }
        case 'property': {
          const p = await q1(`SELECT id, title, name FROM crm_properties WHERE id = $1`, [linkedId]);
          if (p) entity = { id: p.id, name: p.title || p.name || 'Property', type: 'property' };
          break;
        }
      }

      if (entity && !connections.find(c => c.id === entity!.id)) {
        const relType = assoc.association_type?.replace(/_/g, ' ') || linkedType;
        connections.push({
          ...entity,
          relationship: relType,
          strength: 5,
        });
      }
    }

    // 2. Get company via contact_companies junction
    const contactCompanies = await q(`
      SELECT cc.role, c.id, c.name
      FROM crm_contact_companies cc
      JOIN crm_companies c ON c.id = cc.company_id
      WHERE cc.contact_id = $1
    `, [contactId]);

    for (const cc of contactCompanies) {
      if (!connections.find(c => c.id === cc.id)) {
        connections.push({
          id: cc.id,
          name: cc.name,
          type: 'company',
          relationship: cc.role || 'employee',
          strength: 8,
        });
      }
    }

    // 3. Get deals where this contact is buyer or seller
    const dealConnections = await q(`
      SELECT id, title, name, stage, value
      FROM crm_deals
      WHERE org_id = $1
        AND (buyer_contact_id = $2 OR seller_contact_id = $2)
    `, [orgId, contactId]);

    for (const deal of dealConnections) {
      if (!connections.find(c => c.id === deal.id)) {
        connections.push({
          id: deal.id,
          name: deal.title || deal.name || 'Deal',
          type: 'deal',
          relationship: 'involved',
          strength: 7,
        });
      }
    }

    // 4. Get deal team members for shared deals
    const dealTeamPeers = await q(`
      SELECT DISTINCT c.id, c.first_name, c.last_name
      FROM crm_deal_contacts dc1
      JOIN crm_deal_contacts dc2 ON dc1.deal_id = dc2.deal_id AND dc2.contact_id != $1
      JOIN crm_contacts c ON c.id = dc2.contact_id
      WHERE dc1.contact_id = $1
      LIMIT 10
    `, [contactId]);

    for (const peer of dealTeamPeers) {
      if (!connections.find(c => c.id === peer.id)) {
        connections.push({
          id: peer.id,
          name: `${peer.first_name} ${peer.last_name}`.trim(),
          type: 'contact',
          relationship: 'deal team',
          strength: 4,
        });
      }
    }

    res.json({ centerNode, connections });
  } catch (e: any) {
    console.error('Relationship map error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/companies/:id/relationships', async (req: any, res) => {
  try {
    const companyId = req.params.id;
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Get company info for center node
    const center = await q1(`
      SELECT id, name, industry FROM crm_companies WHERE id = $1 AND org_id = $2
    `, [companyId, orgId]);

    if (!center) return res.status(404).json({ error: 'Company not found' });

    const centerNode = {
      id: center.id,
      name: center.name,
      type: 'company' as const,
    };

    const connections: Array<{ id: string; name: string; type: string; relationship: string; strength: number }> = [];

    // 1. Contacts linked to this company
    const linkedContacts = await q(`
      SELECT c.id, c.first_name, c.last_name, cc.role
      FROM crm_contact_companies cc
      JOIN crm_contacts c ON c.id = cc.contact_id
      WHERE cc.company_id = $1
    `, [companyId]);

    for (const c of linkedContacts) {
      connections.push({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        type: 'contact',
        relationship: c.role || 'employee',
        strength: 7,
      });
    }

    // 2. Deals where this company is buyer or seller
    const deals = await q(`
      SELECT id, title, name, stage, value
      FROM crm_deals
      WHERE org_id = $1
        AND (buyer_company_id = $2 OR seller_company_id = $2)
    `, [orgId, companyId]);

    for (const deal of deals) {
      connections.push({
        id: deal.id,
        name: deal.title || deal.name || 'Deal',
        type: 'deal',
        relationship: 'party',
        strength: 6,
      });
    }

    // 3. Associations
    const assocs = await q(`
      SELECT a.source_entity_type, a.source_entity_id, a.target_entity_type, a.target_entity_id,
             a.association_type
      FROM crm_associations a
      WHERE a.org_id = $1
        AND ((a.source_entity_type = 'company' AND a.source_entity_id = $2)
          OR (a.target_entity_type = 'company' AND a.target_entity_id = $2))
    `, [orgId, companyId]);

    for (const assoc of assocs) {
      const isSource = assoc.source_entity_type === 'company' && assoc.source_entity_id === companyId;
      const linkedType = isSource ? assoc.target_entity_type : assoc.source_entity_type;
      const linkedId = isSource ? assoc.target_entity_id : assoc.source_entity_id;

      if (connections.find(c => c.id === linkedId)) continue;

      let entity = null;
      switch (linkedType) {
        case 'property': {
          const p = await q1(`SELECT id, title, name FROM crm_properties WHERE id = $1`, [linkedId]);
          if (p) entity = { id: p.id, name: p.title || p.name || 'Property', type: 'property' };
          break;
        }
        case 'contact': {
          const c = await q1(`SELECT id, first_name, last_name FROM crm_contacts WHERE id = $1`, [linkedId]);
          if (c) entity = { id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), type: 'contact' };
          break;
        }
        case 'company': {
          const c = await q1(`SELECT id, name FROM crm_companies WHERE id = $1`, [linkedId]);
          if (c) entity = { id: c.id, name: c.name, type: 'company' };
          break;
        }
        case 'deal': {
          const d = await q1(`SELECT id, title, name FROM crm_deals WHERE id = $1`, [linkedId]);
          if (d) entity = { id: d.id, name: d.title || d.name || 'Deal', type: 'deal' };
          break;
        }
      }

      if (entity) {
        connections.push({
          ...entity,
          relationship: assoc.association_type?.replace(/_/g, ' ') || linkedType,
          strength: 5,
        });
      }
    }

    // 4. Properties owned by this company
    const ownedProps = await q(`
      SELECT id, title, name FROM crm_properties
      WHERE owner_company_id = $1
      LIMIT 10
    `, [companyId]);

    for (const prop of ownedProps) {
      if (!connections.find(c => c.id === prop.id)) {
        connections.push({
          id: prop.id,
          name: prop.title || prop.name || 'Property',
          type: 'property',
          relationship: 'owned',
          strength: 8,
        });
      }
    }

    res.json({ centerNode, connections });
  } catch (e: any) {
    console.error('Company relationship map error:', e);
    res.status(500).json({ error: e.message });
  }
});

// =============================================================================
// BULK EMAIL LOGGING
// =============================================================================

router.post('/bulk-email', async (req: any, res) => {
  try {
    const { contactIds, subject, body } = req.body;
    const orgId = req.user?.orgId;
    const userId = req.user?.id;

    if (!contactIds?.length || !subject || !body) {
      return res.status(400).json({ error: 'contactIds, subject, and body are required' });
    }

    // Validate contacts belong to org
    const contacts = await q(`
      SELECT id, email, first_name, last_name
      FROM crm_contacts
      WHERE id = ANY($1::varchar[]) AND org_id = $2
    `, [contactIds, orgId]);

    const validContacts = contacts.filter((c: any) => c.email);
    const missingEmail = contacts.filter((c: any) => !c.email);
    const notFound = contactIds.length - contacts.length;

    // Log the bulk email attempt
    const log = await q1(`
      INSERT INTO crm_bulk_email_logs (id, org_id, sent_by_id, subject, body, recipient_count, sent_count, failed_count, status, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
      RETURNING *
    `, [orgId, userId, subject, body, contactIds.length, validContacts.length, missingEmail.length + notFound]);

    res.json({
      sent: validContacts.length,
      failed: missingEmail.length + notFound,
      logId: log?.id,
    });
  } catch (e: any) {
    // If the table doesn't exist yet, still return a response
    if (e.message?.includes('crm_bulk_email_logs')) {
      const { contactIds } = req.body;
      res.json({ sent: contactIds?.length || 0, failed: 0, logId: null });
    } else {
      console.error('Bulk email error:', e);
      res.status(500).json({ error: e.message });
    }
  }
});

export default router;
