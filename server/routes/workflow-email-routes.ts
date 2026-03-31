import { Router } from 'express';
import { pool } from '../db';
import { sendEmail, wrapEmailTemplate } from '../services/email-service';

export const workflowEmailRouter = Router();

// ── Available tokens metadata ─────────────────────────────────────────
const AVAILABLE_TOKENS = [
  { key: 'deal.propertyName', label: 'Property Name', example: '123 Main St' },
  { key: 'deal.stage', label: 'Current Stage', example: 'Due Diligence' },
  { key: 'deal.value', label: 'Deal Value', example: '$2,500,000' },
  { key: 'deal.assetClass', label: 'Asset Class', example: 'Multifamily' },
  { key: 'deal.daysInStage', label: 'Days in Stage', example: '14' },
  { key: 'deal.state', label: 'State', example: 'FL' },
  { key: 'deal.city', label: 'City', example: 'Miami' },
  { key: 'deal.assignedToName', label: 'Assigned To', example: 'John Smith' },
  { key: 'contact.firstName', label: 'Contact First Name', example: 'Jane' },
  { key: 'contact.lastName', label: 'Contact Last Name', example: 'Doe' },
  { key: 'contact.email', label: 'Contact Email', example: 'jane@example.com' },
  { key: 'contact.company', label: 'Contact Company', example: 'Acme Corp' },
  { key: 'org.name', label: 'Organization Name', example: 'MarinaMatch' },
  { key: 'user.name', label: 'Triggered By', example: 'Brett' },
  { key: 'rule.name', label: 'Rule Name', example: 'Stale Deal Alert' },
];

// ── Default seed templates ────────────────────────────────────────────
const DEFAULT_TEMPLATES = [
  {
    name: 'Deal Stage Update',
    subject: '{{deal.propertyName}} moved to {{deal.stage}}',
    body_html: '<h2>Deal Stage Update</h2><p>The deal <strong>{{deal.propertyName}}</strong> has been moved to the <strong>{{deal.stage}}</strong> stage.</p><p>Deal value: {{deal.value}}</p>',
    category: 'workflow',
    tokens_used: ['deal.propertyName', 'deal.stage', 'deal.value'],
  },
  {
    name: 'Stale Deal Reminder',
    subject: 'Action needed: {{deal.propertyName}} has been idle',
    body_html: '<h2>Stale Deal Alert</h2><p><strong>{{deal.propertyName}}</strong> has been in the <strong>{{deal.stage}}</strong> stage for {{deal.daysInStage}} days.</p><p>Please review and take action.</p>',
    category: 'workflow',
    tokens_used: ['deal.propertyName', 'deal.daysInStage', 'deal.stage'],
  },
  {
    name: 'New Deal Assigned',
    subject: 'New deal assigned: {{deal.propertyName}}',
    body_html: '<h2>New Deal Assignment</h2><p>You have been assigned a new deal: <strong>{{deal.propertyName}}</strong></p><p>Asset class: {{deal.assetClass}}<br>Value: {{deal.value}}</p>',
    category: 'notification',
    tokens_used: ['deal.propertyName', 'deal.value', 'deal.assetClass'],
  },
  {
    name: 'Deal Won Notification',
    subject: 'Congratulations! {{deal.propertyName}} closed',
    body_html: '<h2>Deal Closed!</h2><p>Congratulations! <strong>{{deal.propertyName}}</strong> has been successfully closed.</p><p>Final value: {{deal.value}}</p>',
    category: 'notification',
    tokens_used: ['deal.propertyName', 'deal.value', 'deal.stage'],
  },
  {
    name: 'Follow-Up Reminder',
    subject: 'Follow up on {{deal.propertyName}}',
    body_html: '<h2>Follow-Up Reminder</h2><p>Hi {{contact.firstName}},</p><p>This is a reminder to follow up on <strong>{{deal.propertyName}}</strong>.</p><p>Please reach out to {{contact.email}} at your earliest convenience.</p>',
    category: 'follow_up',
    tokens_used: ['deal.propertyName', 'contact.firstName', 'contact.email'],
  },
];

// Helper: map DB row to camelCase response
function mapTemplate(row: any) {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    subject: row.subject,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    category: row.category,
    tokensUsed: row.tokens_used || [],
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLogEntry(row: any) {
  return {
    id: row.id,
    orgId: row.org_id,
    ruleId: row.rule_id,
    executionId: row.execution_id,
    templateId: row.template_id,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name,
    recipientType: row.recipient_type,
    subject: row.subject,
    bodyPreview: row.body_preview,
    status: row.status,
    provider: row.provider,
    providerId: row.provider_id,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

// Helper: lazy-seed default templates for an org
async function ensureDefaultTemplates(orgId: string, userId?: string): Promise<void> {
  const { rows } = await pool.query(
    'SELECT id FROM workflow_email_templates WHERE org_id = $1 LIMIT 1',
    [orgId]
  );
  if (rows.length > 0) return;

  for (const tpl of DEFAULT_TEMPLATES) {
    await pool.query(
      `INSERT INTO workflow_email_templates (org_id, name, subject, body_html, category, tokens_used, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orgId, tpl.name, tpl.subject, tpl.body_html, tpl.category, tpl.tokens_used, userId || null]
    );
  }
}

// Helper: interpolate {{token}} in text
function interpolateTokens(text: string, context: Record<string, any>): string {
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const parts = path.split('.');
    let val: any = context;
    for (const p of parts) {
      if (val == null) return '';
      val = val[p];
    }
    return val != null ? String(val) : '';
  });
}

// Helper: strip HTML tags for plain-text fallback
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// Build sample context from a deal or use example data
async function buildSampleContext(orgId: string, dealId?: string): Promise<Record<string, any>> {
  if (dealId) {
    const { rows } = await pool.query(
      `SELECT sd.*, u.email as owner_email, u.username as owner_name
       FROM sourced_deals sd
       LEFT JOIN users u ON sd.assigned_to::text = u.id::text
       WHERE sd.id = $1 AND sd.org_id = $2`,
      [dealId, orgId]
    );
    if (rows.length > 0) {
      const d = rows[0];
      return {
        deal: {
          id: d.id,
          propertyName: d.property_name || d.title || 'Sample Property',
          stage: d.stage || d.status || 'Active',
          value: d.asking_price ? `$${Number(d.asking_price).toLocaleString()}` : '$0',
          assetClass: d.asset_class || 'Unknown',
          state: d.state || '',
          city: d.city || '',
          assignedToName: d.owner_name || d.assigned_to_name || '',
          assignedToEmail: d.owner_email || '',
          daysInStage: '7',
        },
        contact: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', company: 'Acme Corp' },
        org: { name: 'MarinaMatch' },
        user: { name: 'System' },
        rule: { name: 'Sample Rule' },
      };
    }
  }
  // Fallback sample context using token examples
  const ctx: Record<string, any> = { deal: {}, contact: {}, org: {}, user: {}, rule: {} };
  for (const t of AVAILABLE_TOKENS) {
    const [group, field] = t.key.split('.');
    ctx[group][field] = t.example;
  }
  return ctx;
}

// ── GET /templates ────────────────────────────────────────────────────
workflowEmailRouter.get('/templates', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId || req.tenantId || req.orgId;
    if (!orgId) return res.status(401).json({ error: 'No org context' });

    await ensureDefaultTemplates(orgId, req.user?.id);

    const { category, isActive, search } = req.query;
    let sql = 'SELECT * FROM workflow_email_templates WHERE org_id = $1';
    const params: any[] = [orgId];
    let idx = 2;

    if (category) {
      sql += ` AND category = $${idx++}`;
      params.push(category);
    }
    if (isActive !== undefined) {
      sql += ` AND is_active = $${idx++}`;
      params.push(isActive === 'true');
    }
    if (search) {
      sql += ` AND (name ILIKE $${idx} OR subject ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    sql += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(sql, params);
    res.json({ templates: rows.map(mapTemplate) });
  } catch (error: any) {
    console.error('Failed to list email templates:', error);
    res.status(500).json({ error: 'Failed to list email templates' });
  }
});

// ── GET /templates/:id ────────────────────────────────────────────────
workflowEmailRouter.get('/templates/:id', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId || req.tenantId || req.orgId;
    const { rows } = await pool.query(
      'SELECT * FROM workflow_email_templates WHERE id = $1 AND org_id = $2',
      [req.params.id, orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ template: mapTemplate(rows[0]) });
  } catch (error: any) {
    console.error('Failed to get email template:', error);
    res.status(500).json({ error: 'Failed to get email template' });
  }
});

// ── POST /templates ───────────────────────────────────────────────────
workflowEmailRouter.post('/templates', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId || req.tenantId || req.orgId;
    const { name, subject, bodyHtml, bodyText, category, tokensUsed } = req.body;

    if (!name || !subject || !bodyHtml) {
      return res.status(400).json({ error: 'name, subject, and bodyHtml are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO workflow_email_templates (org_id, name, subject, body_html, body_text, category, tokens_used, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [orgId, name, subject, bodyHtml, bodyText || null, category || 'custom', tokensUsed || [], req.user?.id || null]
    );
    res.status(201).json({ template: mapTemplate(rows[0]) });
  } catch (error: any) {
    console.error('Failed to create email template:', error);
    res.status(500).json({ error: 'Failed to create email template' });
  }
});

// ── PATCH /templates/:id ──────────────────────────────────────────────
workflowEmailRouter.patch('/templates/:id', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId || req.tenantId || req.orgId;
    const { name, subject, bodyHtml, bodyText, category, isActive, tokensUsed } = req.body;

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name); }
    if (subject !== undefined) { sets.push(`subject = $${idx++}`); params.push(subject); }
    if (bodyHtml !== undefined) { sets.push(`body_html = $${idx++}`); params.push(bodyHtml); }
    if (bodyText !== undefined) { sets.push(`body_text = $${idx++}`); params.push(bodyText); }
    if (category !== undefined) { sets.push(`category = $${idx++}`); params.push(category); }
    if (isActive !== undefined) { sets.push(`is_active = $${idx++}`); params.push(isActive); }
    if (tokensUsed !== undefined) { sets.push(`tokens_used = $${idx++}`); params.push(tokensUsed); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    sets.push(`updated_at = NOW()`);
    params.push(req.params.id, orgId);

    const { rows } = await pool.query(
      `UPDATE workflow_email_templates SET ${sets.join(', ')} WHERE id = $${idx++} AND org_id = $${idx} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ template: mapTemplate(rows[0]) });
  } catch (error: any) {
    console.error('Failed to update email template:', error);
    res.status(500).json({ error: 'Failed to update email template' });
  }
});

// ── DELETE /templates/:id (soft delete) ───────────────────────────────
workflowEmailRouter.delete('/templates/:id', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId || req.tenantId || req.orgId;
    const { rows } = await pool.query(
      `UPDATE workflow_email_templates SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND org_id = $2 RETURNING id`,
      [req.params.id, orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete email template:', error);
    res.status(500).json({ error: 'Failed to delete email template' });
  }
});

// ── POST /templates/:id/preview ───────────────────────────────────────
workflowEmailRouter.post('/templates/:id/preview', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId || req.tenantId || req.orgId;
    const { dealId } = req.body;

    const { rows } = await pool.query(
      'SELECT * FROM workflow_email_templates WHERE id = $1 AND org_id = $2',
      [req.params.id, orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const tpl = rows[0];
    const context = await buildSampleContext(orgId, dealId);

    const renderedSubject = interpolateTokens(tpl.subject, context);
    const renderedBodyHtml = wrapEmailTemplate(interpolateTokens(tpl.body_html, context));
    const renderedBodyText = tpl.body_text
      ? interpolateTokens(tpl.body_text, context)
      : stripHtml(interpolateTokens(tpl.body_html, context));

    res.json({ subject: renderedSubject, bodyHtml: renderedBodyHtml, bodyText: renderedBodyText });
  } catch (error: any) {
    console.error('Failed to preview template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

// ── POST /send-test ───────────────────────────────────────────────────
workflowEmailRouter.post('/send-test', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId || req.tenantId || req.orgId;
    const { templateId, recipientEmail, dealId } = req.body;

    if (!templateId || !recipientEmail) {
      return res.status(400).json({ error: 'templateId and recipientEmail are required' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM workflow_email_templates WHERE id = $1 AND org_id = $2',
      [templateId, orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const tpl = rows[0];
    const context = await buildSampleContext(orgId, dealId);

    const renderedSubject = interpolateTokens(tpl.subject, context);
    const renderedHtml = wrapEmailTemplate(interpolateTokens(tpl.body_html, context));
    const renderedText = tpl.body_text
      ? interpolateTokens(tpl.body_text, context)
      : stripHtml(interpolateTokens(tpl.body_html, context));

    const sent = await sendEmail({
      to: recipientEmail,
      subject: `[TEST] ${renderedSubject}`,
      html: renderedHtml,
      text: renderedText,
    });

    // Log the test send
    await pool.query(
      `INSERT INTO workflow_email_log
         (org_id, template_id, recipient_email, recipient_type, subject, body_preview, status, provider, sent_at)
       VALUES ($1, $2, $3, 'custom', $4, $5, $6, 'test', $7)`,
      [orgId, templateId, recipientEmail, `[TEST] ${renderedSubject}`,
       renderedHtml.substring(0, 500), sent ? 'sent' : 'failed', sent ? new Date() : null]
    );

    res.json({ success: sent, messageId: null });
  } catch (error: any) {
    console.error('Failed to send test email:', error);
    res.status(500).json({ error: error.message || 'Failed to send test email' });
  }
});

// ── GET /logs ─────────────────────────────────────────────────────────
workflowEmailRouter.get('/logs', async (req: any, res) => {
  try {
    const orgId = req.user?.orgId || req.tenantId || req.orgId;
    const { ruleId, status, recipientEmail, startDate, endDate } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    let sql = 'SELECT * FROM workflow_email_log WHERE org_id = $1';
    let countSql = 'SELECT COUNT(*) FROM workflow_email_log WHERE org_id = $1';
    const params: any[] = [orgId];
    const countParams: any[] = [orgId];
    let idx = 2;

    if (ruleId) {
      const clause = ` AND rule_id = $${idx++}`;
      sql += clause; countSql += clause;
      params.push(ruleId); countParams.push(ruleId);
    }
    if (status) {
      const clause = ` AND status = $${idx++}`;
      sql += clause; countSql += clause;
      params.push(status); countParams.push(status);
    }
    if (recipientEmail) {
      const clause = ` AND recipient_email ILIKE $${idx++}`;
      sql += clause; countSql += clause;
      params.push(`%${recipientEmail}%`); countParams.push(`%${recipientEmail}%`);
    }
    if (startDate) {
      const clause = ` AND created_at >= $${idx++}`;
      sql += clause; countSql += clause;
      params.push(startDate); countParams.push(startDate);
    }
    if (endDate) {
      const clause = ` AND created_at <= $${idx++}`;
      sql += clause; countSql += clause;
      params.push(endDate); countParams.push(endDate);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
    params.push(limit, offset);

    const [logsResult, countResult] = await Promise.all([
      pool.query(sql, params),
      pool.query(countSql, countParams),
    ]);

    res.json({
      logs: logsResult.rows.map(mapLogEntry),
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error: any) {
    console.error('Failed to get email logs:', error);
    res.status(500).json({ error: 'Failed to get email logs' });
  }
});

// ── GET /available-tokens ─────────────────────────────────────────────
workflowEmailRouter.get('/available-tokens', async (_req: any, res) => {
  res.json({ tokens: AVAILABLE_TOKENS });
});
