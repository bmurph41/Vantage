/**
 * CRM Gap Routes — CSV Export, Custom Fields, Forecasting, Reminders,
 * Recurring Activities, Webhooks, DNC/GDPR, Product-Deal Linking
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { sendEmail, wrapEmailTemplate } from '../services/email-service';

export const crmGapsRouter = Router();

// ═══════════════════════════════════════════════════════════════════════
// 1. CSV EXPORT
// ═══════════════════════════════════════════════════════════════════════

crmGapsRouter.get('/export/contacts', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, phone, company, position,
              address, city, state, zip_code, contact_type, lead_status,
              lead_score, linkedin_url, labels, do_not_contact, gdpr_consent,
              email_opt_out, created_at, updated_at
       FROM crm_contacts WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );

    const headers = [
      'ID','First Name','Last Name','Email','Phone','Company','Position',
      'Address','City','State','Zip','Type','Lead Status','Lead Score',
      'LinkedIn','Labels','Do Not Contact','GDPR Consent','Email Opt Out',
      'Created','Updated'
    ];
    const csvRows = rows.map(r => [
      r.id, r.first_name, r.last_name, r.email, r.phone, r.company, r.position,
      r.address, r.city, r.state, r.zip_code, r.contact_type, r.lead_status,
      r.lead_score, r.linkedin_url,
      Array.isArray(r.labels) ? r.labels.join(';') : '',
      r.do_not_contact ? 'Yes' : 'No',
      r.gdpr_consent ? 'Yes' : 'No',
      r.email_opt_out ? 'Yes' : 'No',
      r.created_at, r.updated_at
    ]);

    const csv = [headers.join(','), ...csvRows.map(row =>
      row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    )].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.send(csv);
  } catch (err: any) {
    console.error('Export contacts error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

crmGapsRouter.get('/export/companies', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT id, name, domain, industry, size, address, phone, website,
              city, state, zip_code, country, annual_revenue, employee_count,
              linkedin_url, labels, tags, created_at, updated_at
       FROM crm_companies WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );

    const headers = [
      'ID','Name','Domain','Industry','Size','Address','Phone','Website',
      'City','State','Zip','Country','Annual Revenue','Employees',
      'LinkedIn','Labels','Tags','Created','Updated'
    ];
    const csvRows = rows.map(r => [
      r.id, r.name, r.domain, r.industry, r.size, r.address, r.phone, r.website,
      r.city, r.state, r.zip_code, r.country, r.annual_revenue, r.employee_count,
      r.linkedin_url,
      Array.isArray(r.labels) ? r.labels.join(';') : '',
      Array.isArray(r.tags) ? r.tags.join(';') : '',
      r.created_at, r.updated_at
    ]);

    const csv = [headers.join(','), ...csvRows.map(row =>
      row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    )].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=companies.csv');
    res.send(csv);
  } catch (err: any) {
    console.error('Export companies error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

crmGapsRouter.get('/export/deals', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.value, d.amount, d.probability, d.priority,
              d.expected_close_date, d.lead_source, d.lost_reason,
              d.forecast_category, d.asset_class, d.property_type,
              d.city, d.state, d.is_closed, d.closed_at,
              s.name as stage_name, p.name as pipeline_name,
              d.created_at, d.updated_at
       FROM crm_deals d
       LEFT JOIN crm_pipeline_stages s ON d.stage_id = s.id
       LEFT JOIN crm_pipelines p ON d.pipeline_id = p.id
       WHERE d.org_id = $1 ORDER BY d.created_at DESC`,
      [orgId]
    );

    const headers = [
      'ID','Title','Value','Amount','Probability %','Priority',
      'Expected Close','Lead Source','Lost Reason','Forecast Category',
      'Asset Class','Property Type','City','State',
      'Stage','Pipeline','Is Closed','Closed At','Created','Updated'
    ];
    const csvRows = rows.map(r => [
      r.id, r.title, r.value, r.amount, r.probability, r.priority,
      r.expected_close_date, r.lead_source, r.lost_reason, r.forecast_category,
      r.asset_class, r.property_type, r.city, r.state,
      r.stage_name, r.pipeline_name,
      r.is_closed ? 'Yes' : 'No', r.closed_at,
      r.created_at, r.updated_at
    ]);

    const csv = [headers.join(','), ...csvRows.map(row =>
      row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    )].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=deals.csv');
    res.send(csv);
  } catch (err: any) {
    console.error('Export deals error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

crmGapsRouter.get('/export/properties', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT id, title, type, status, listing_price, address, city, state, zip_code,
              wet_slips, dry_slips, total_capacity, occupancy_rate,
              annual_revenue, noi_estimate, is_on_market, pipeline_stage,
              broker_name, list_cap_rate, listing_date,
              created_at, updated_at
       FROM crm_properties WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );

    const headers = [
      'ID','Title','Type','Status','Listing Price','Address','City','State','Zip',
      'Wet Slips','Dry Slips','Total Capacity','Occupancy Rate',
      'Annual Revenue','NOI Estimate','On Market','Pipeline Stage',
      'Broker','Cap Rate','Listing Date','Created','Updated'
    ];
    const csvRows = rows.map(r => [
      r.id, r.title, r.type, r.status, r.listing_price, r.address, r.city, r.state, r.zip_code,
      r.wet_slips, r.dry_slips, r.total_capacity, r.occupancy_rate,
      r.annual_revenue, r.noi_estimate, r.is_on_market ? 'Yes' : 'No', r.pipeline_stage,
      r.broker_name, r.list_cap_rate, r.listing_date,
      r.created_at, r.updated_at
    ]);

    const csv = [headers.join(','), ...csvRows.map(row =>
      row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    )].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=properties.csv');
    res.send(csv);
  } catch (err: any) {
    console.error('Export properties error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

crmGapsRouter.get('/export/activities', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT id, type, subject, description, direction, duration, outcome,
              status, entity_type, entity_id, scheduled_at, completed_at,
              created_at
       FROM crm_activities WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );

    const headers = [
      'ID','Type','Subject','Description','Direction','Duration (min)','Outcome',
      'Status','Entity Type','Entity ID','Scheduled','Completed','Created'
    ];
    const csvRows = rows.map(r => [
      r.id, r.type, r.subject, r.description, r.direction, r.duration, r.outcome,
      r.status, r.entity_type, r.entity_id, r.scheduled_at, r.completed_at, r.created_at
    ]);

    const csv = [headers.join(','), ...csvRows.map(row =>
      row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    )].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=activities.csv');
    res.send(csv);
  } catch (err: any) {
    console.error('Export activities error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 2. CUSTOM FIELD DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

crmGapsRouter.get('/custom-fields/:entityType', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { entityType } = req.params;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT * FROM crm_custom_field_definitions
       WHERE org_id = $1 AND entity_type = $2 AND is_active = true
       ORDER BY sort_order ASC, created_at ASC`,
      [orgId, entityType]
    );

    res.json(rows.map(r => ({
      id: r.id,
      entityType: r.entity_type,
      fieldKey: r.field_key,
      fieldLabel: r.field_label,
      fieldType: r.field_type,
      description: r.description,
      isRequired: r.is_required,
      defaultValue: r.default_value,
      options: r.options,
      sortOrder: r.sort_order,
    })));
  } catch (err: any) {
    console.error('Get custom fields error:', err);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

crmGapsRouter.post('/custom-fields', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { entityType, fieldKey, fieldLabel, fieldType, description, isRequired, defaultValue, options, sortOrder } = req.body;
    if (!entityType || !fieldKey || !fieldLabel) {
      return res.status(400).json({ error: 'entityType, fieldKey, and fieldLabel are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO crm_custom_field_definitions
       (org_id, entity_type, field_key, field_label, field_type, description, is_required, default_value, options, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [orgId, entityType, fieldKey, fieldLabel, fieldType || 'text', description, isRequired || false, defaultValue, JSON.stringify(options || []), sortOrder || 0, userId]
    );

    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.message.includes('duplicate key')) {
      return res.status(409).json({ error: 'A field with this key already exists for this entity type' });
    }
    console.error('Create custom field error:', err);
    res.status(500).json({ error: 'Failed to create custom field' });
  }
});

crmGapsRouter.put('/custom-fields/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { fieldLabel, fieldType, description, isRequired, defaultValue, options, sortOrder, isActive } = req.body;

    const { rows } = await pool.query(
      `UPDATE crm_custom_field_definitions
       SET field_label = COALESCE($1, field_label),
           field_type = COALESCE($2, field_type),
           description = COALESCE($3, description),
           is_required = COALESCE($4, is_required),
           default_value = COALESCE($5, default_value),
           options = COALESCE($6, options),
           sort_order = COALESCE($7, sort_order),
           is_active = COALESCE($8, is_active),
           updated_at = NOW()
       WHERE id = $9 AND org_id = $10
       RETURNING *`,
      [fieldLabel, fieldType, description, isRequired, defaultValue, options ? JSON.stringify(options) : null, sortOrder, isActive, req.params.id, orgId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Field not found' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('Update custom field error:', err);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
});

crmGapsRouter.delete('/custom-fields/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    await pool.query(
      `UPDATE crm_custom_field_definitions SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete custom field error:', err);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 3. REVENUE FORECASTING ROLLUPS
// ═══════════════════════════════════════════════════════════════════════

crmGapsRouter.get('/forecast/pipeline', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const pipelineId = req.query.pipelineId as string | undefined;

    // Weighted forecast by stage
    let query = `
      SELECT
        s.id as stage_id, s.name as stage_name, s.probability as stage_probability,
        s.stage_order, s.stage_type, s.color,
        COUNT(d.id) as deal_count,
        COALESCE(SUM(COALESCE(d.value, d.amount, 0)), 0) as total_value,
        COALESCE(SUM(COALESCE(d.value, d.amount, 0) * COALESCE(d.probability, s.probability, 0) / 100.0), 0) as weighted_value,
        COALESCE(AVG(d.days_in_current_stage), 0) as avg_days_in_stage
      FROM crm_pipeline_stages s
      LEFT JOIN crm_deals d ON d.stage_id = s.id AND d.org_id = $1 AND (d.is_closed IS NULL OR d.is_closed = false)
    `;
    const params: any[] = [orgId];

    if (pipelineId) {
      query += ` WHERE s.pipeline_id = $2`;
      params.push(pipelineId);
    } else {
      query += ` WHERE s.org_id = $1`;
    }

    query += ` GROUP BY s.id, s.name, s.probability, s.stage_order, s.stage_type, s.color
               ORDER BY s.stage_order ASC`;

    const { rows: stages } = await pool.query(query, params);

    // Summary
    const totalWeighted = stages.reduce((sum: number, s: any) => sum + parseFloat(s.weighted_value || 0), 0);
    const totalUnweighted = stages.reduce((sum: number, s: any) => sum + parseFloat(s.total_value || 0), 0);
    const totalDeals = stages.reduce((sum: number, s: any) => sum + parseInt(s.deal_count || 0), 0);

    // Won/Lost this period
    const periodStart = req.query.periodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const periodEnd = req.query.periodEnd || new Date().toISOString();

    const { rows: wonLost } = await pool.query(
      `SELECT
        SUM(CASE WHEN is_closed = true AND closed_at IS NOT NULL THEN COALESCE(value, amount, 0) ELSE 0 END) as won_value,
        SUM(CASE WHEN is_closed = true AND closed_at IS NOT NULL THEN 1 ELSE 0 END) as won_count,
        SUM(CASE WHEN lost_reason IS NOT NULL THEN COALESCE(value, amount, 0) ELSE 0 END) as lost_value,
        SUM(CASE WHEN lost_reason IS NOT NULL THEN 1 ELSE 0 END) as lost_count
       FROM crm_deals
       WHERE org_id = $1 AND updated_at BETWEEN $2 AND $3`,
      [orgId, periodStart, periodEnd]
    );

    // Forecast by month (next 6 months based on expected close dates)
    const { rows: monthlyForecast } = await pool.query(
      `SELECT
        DATE_TRUNC('month', expected_close_date) as month,
        COUNT(*) as deal_count,
        COALESCE(SUM(COALESCE(value, amount, 0)), 0) as total_value,
        COALESCE(SUM(COALESCE(value, amount, 0) * COALESCE(probability, 50) / 100.0), 0) as weighted_value
       FROM crm_deals
       WHERE org_id = $1
         AND (is_closed IS NULL OR is_closed = false)
         AND expected_close_date IS NOT NULL
         AND expected_close_date >= NOW()
         AND expected_close_date <= NOW() + INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', expected_close_date)
       ORDER BY month ASC`,
      [orgId]
    );

    res.json({
      stages: stages.map((s: any) => ({
        stageId: s.stage_id,
        stageName: s.stage_name,
        stageProbability: parseFloat(s.stage_probability || 0),
        stageOrder: s.stage_order,
        stageType: s.stage_type,
        color: s.color,
        dealCount: parseInt(s.deal_count),
        totalValue: parseFloat(s.total_value),
        weightedValue: parseFloat(s.weighted_value),
        avgDaysInStage: Math.round(parseFloat(s.avg_days_in_stage)),
      })),
      summary: {
        totalWeightedValue: Math.round(totalWeighted * 100) / 100,
        totalUnweightedValue: Math.round(totalUnweighted * 100) / 100,
        totalDeals,
        wonValue: parseFloat(wonLost[0]?.won_value || 0),
        wonCount: parseInt(wonLost[0]?.won_count || 0),
        lostValue: parseFloat(wonLost[0]?.lost_value || 0),
        lostCount: parseInt(wonLost[0]?.lost_count || 0),
      },
      monthlyForecast: monthlyForecast.map((m: any) => ({
        month: m.month,
        dealCount: parseInt(m.deal_count),
        totalValue: parseFloat(m.total_value),
        weightedValue: parseFloat(m.weighted_value),
      })),
    });
  } catch (err: any) {
    console.error('Forecast error:', err);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 4. ACTIVITY REMINDERS
// ═══════════════════════════════════════════════════════════════════════

// Get pending reminders for the current user
crmGapsRouter.get('/reminders/pending', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Tasks with upcoming reminders
    const { rows: taskReminders } = await pool.query(
      `SELECT id, title, description, type, priority, due_date, reminder_at,
              deal_id, contact_id, company_id, 'task' as source_type
       FROM crm_tasks
       WHERE org_id = $1 AND assignee_id = $2
         AND reminder_at IS NOT NULL AND reminder_sent = false
         AND reminder_at <= NOW() + INTERVAL '24 hours'
       ORDER BY reminder_at ASC
       LIMIT 50`,
      [orgId, userId]
    );

    // Activities with upcoming reminders
    const { rows: activityReminders } = await pool.query(
      `SELECT id, type, subject, description, scheduled_at, reminder_at,
              entity_type, entity_id, 'activity' as source_type
       FROM crm_activities
       WHERE org_id = $1 AND user_id = $2
         AND reminder_at IS NOT NULL AND reminder_sent = false
         AND reminder_at <= NOW() + INTERVAL '24 hours'
       ORDER BY reminder_at ASC
       LIMIT 50`,
      [orgId, userId]
    );

    res.json({
      tasks: taskReminders.map((r: any) => ({
        id: r.id, title: r.title, description: r.description,
        type: r.type, priority: r.priority, dueDate: r.due_date,
        reminderAt: r.reminder_at, dealId: r.deal_id,
        contactId: r.contact_id, companyId: r.company_id,
        sourceType: r.source_type,
      })),
      activities: activityReminders.map((r: any) => ({
        id: r.id, type: r.type, subject: r.subject,
        description: r.description, scheduledAt: r.scheduled_at,
        reminderAt: r.reminder_at, entityType: r.entity_type,
        entityId: r.entity_id, sourceType: r.source_type,
      })),
    });
  } catch (err: any) {
    console.error('Get reminders error:', err);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// Mark reminder as sent/dismissed
crmGapsRouter.post('/reminders/:sourceType/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { sourceType, id } = req.params;
    const table = sourceType === 'task' ? 'crm_tasks' : 'crm_activities';

    await pool.query(
      `UPDATE ${table} SET reminder_sent = true WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Dismiss reminder error:', err);
    res.status(500).json({ error: 'Failed to dismiss reminder' });
  }
});

// Process and send email reminders (called by cron or interval)
crmGapsRouter.post('/reminders/process', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Get overdue task reminders
    const { rows: dueTasks } = await pool.query(
      `SELECT t.id, t.title, t.due_date, t.reminder_at, t.assignee_id,
              u.email as assignee_email, u.username as assignee_name
       FROM crm_tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.org_id = $1
         AND t.reminder_at IS NOT NULL AND t.reminder_sent = false
         AND t.reminder_at <= NOW()
         AND u.email IS NOT NULL
       LIMIT 100`,
      [orgId]
    );

    let sent = 0;
    for (const task of dueTasks) {
      try {
        await sendEmail({
          to: task.assignee_email,
          subject: `Reminder: ${task.title}`,
          text: `Task reminder: ${task.title}\nDue: ${task.due_date || 'No due date'}\n\nLog in to view details.`,
          html: wrapEmailTemplate(`
            <h2>Task Reminder</h2>
            <p><strong>${task.title}</strong></p>
            <p>Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</p>
            <p>Log in to view and complete this task.</p>
          `),
        });
        await pool.query(`UPDATE crm_tasks SET reminder_sent = true WHERE id = $1`, [task.id]);
        sent++;
      } catch (_emailErr) { /* skip individual failures */ }
    }

    // Get overdue activity reminders
    const { rows: dueActivities } = await pool.query(
      `SELECT a.id, a.subject, a.scheduled_at, a.reminder_at, a.user_id,
              u.email as user_email
       FROM crm_activities a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.org_id = $1
         AND a.reminder_at IS NOT NULL AND a.reminder_sent = false
         AND a.reminder_at <= NOW()
         AND u.email IS NOT NULL
       LIMIT 100`,
      [orgId]
    );

    for (const activity of dueActivities) {
      try {
        await sendEmail({
          to: activity.user_email,
          subject: `Reminder: ${activity.subject || 'Upcoming activity'}`,
          text: `Activity reminder: ${activity.subject}\nScheduled: ${activity.scheduled_at || 'Not scheduled'}`,
          html: wrapEmailTemplate(`
            <h2>Activity Reminder</h2>
            <p><strong>${activity.subject || 'Upcoming activity'}</strong></p>
            <p>Scheduled: ${activity.scheduled_at ? new Date(activity.scheduled_at).toLocaleString() : 'Not set'}</p>
          `),
        });
        await pool.query(`UPDATE crm_activities SET reminder_sent = true WHERE id = $1`, [activity.id]);
        sent++;
      } catch (_emailErr) { /* skip */ }
    }

    res.json({ processed: dueTasks.length + dueActivities.length, sent });
  } catch (err: any) {
    console.error('Process reminders error:', err);
    res.status(500).json({ error: 'Failed to process reminders' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 5. DNC / GDPR CONSENT
// ═══════════════════════════════════════════════════════════════════════

crmGapsRouter.patch('/contacts/:id/consent', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { doNotContact, gdprConsent, emailOptOut, smsOptOut, mailOptOut, consentNotes, gdprConsentSource } = req.body;

    const { rows } = await pool.query(
      `UPDATE crm_contacts
       SET do_not_contact = COALESCE($1, do_not_contact),
           gdpr_consent = COALESCE($2, gdpr_consent),
           gdpr_consent_date = CASE WHEN $2 IS NOT NULL THEN NOW() ELSE gdpr_consent_date END,
           gdpr_consent_source = COALESCE($3, gdpr_consent_source),
           email_opt_out = COALESCE($4, email_opt_out),
           sms_opt_out = COALESCE($5, sms_opt_out),
           mail_opt_out = COALESCE($6, mail_opt_out),
           consent_notes = COALESCE($7, consent_notes),
           updated_at = NOW()
       WHERE id = $8 AND org_id = $9
       RETURNING id, do_not_contact, gdpr_consent, gdpr_consent_date, email_opt_out, sms_opt_out, mail_opt_out`,
      [doNotContact, gdprConsent, gdprConsentSource, emailOptOut, smsOptOut, mailOptOut, consentNotes, req.params.id, orgId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('Update consent error:', err);
    res.status(500).json({ error: 'Failed to update consent' });
  }
});

// Check DNC before sending email (used by email send routes)
crmGapsRouter.post('/contacts/check-dnc', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { contactIds } = req.body;
    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: 'contactIds array required' });
    }

    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, do_not_contact, email_opt_out
       FROM crm_contacts
       WHERE org_id = $1 AND id = ANY($2)
         AND (do_not_contact = true OR email_opt_out = true)`,
      [orgId, contactIds]
    );

    res.json({
      blocked: rows.map((r: any) => ({
        id: r.id,
        name: `${r.first_name} ${r.last_name}`.trim(),
        email: r.email,
        reason: r.do_not_contact ? 'Do Not Contact' : 'Email Opt Out',
      })),
      blockedCount: rows.length,
      allowedCount: contactIds.length - rows.length,
    });
  } catch (err: any) {
    console.error('Check DNC error:', err);
    res.status(500).json({ error: 'Failed to check DNC status' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 6. WEBHOOKS
// ═══════════════════════════════════════════════════════════════════════

const WEBHOOK_EVENTS = [
  'deal.created', 'deal.updated', 'deal.stage_changed', 'deal.won', 'deal.lost', 'deal.deleted',
  'contact.created', 'contact.updated', 'contact.deleted',
  'company.created', 'company.updated', 'company.deleted',
  'activity.created', 'activity.completed',
  'task.created', 'task.completed',
  'note.created',
];

crmGapsRouter.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT * FROM crm_webhooks WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );
    res.json({
      webhooks: rows.map((r: any) => ({
        id: r.id, name: r.name, description: r.description,
        url: r.url, method: r.method, events: r.events,
        headers: r.headers, isActive: r.is_active,
        totalCalls: r.total_calls, successfulCalls: r.successful_calls,
        failedCalls: r.failed_calls, lastCalledAt: r.last_called_at,
        lastStatus: r.last_status, createdAt: r.created_at,
      })),
      availableEvents: WEBHOOK_EVENTS,
    });
  } catch (err: any) {
    console.error('Get webhooks error:', err);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

crmGapsRouter.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const userId = (req as any).user?.id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description, url, method, events, headers, secret } = req.body;
    if (!name || !url || !events?.length) {
      return res.status(400).json({ error: 'name, url, and events are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO crm_webhooks (name, description, url, method, events, headers, secret, owner_id, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, description, url, method || 'POST', JSON.stringify(events), JSON.stringify(headers || {}), secret, userId, orgId]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error('Create webhook error:', err);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

crmGapsRouter.put('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description, url, method, events, headers, secret, isActive } = req.body;

    const { rows } = await pool.query(
      `UPDATE crm_webhooks
       SET name = COALESCE($1, name), description = COALESCE($2, description),
           url = COALESCE($3, url), method = COALESCE($4, method),
           events = COALESCE($5, events), headers = COALESCE($6, headers),
           secret = COALESCE($7, secret), is_active = COALESCE($8, is_active),
           updated_at = NOW()
       WHERE id = $9 AND org_id = $10
       RETURNING *`,
      [name, description, url, method, events ? JSON.stringify(events) : null, headers ? JSON.stringify(headers) : null, secret, isActive, req.params.id, orgId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('Update webhook error:', err);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

crmGapsRouter.delete('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    await pool.query(
      `DELETE FROM crm_webhooks WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete webhook error:', err);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

crmGapsRouter.get('/webhooks/:id/logs', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);

    const { rows } = await pool.query(
      `SELECT * FROM crm_webhook_logs
       WHERE webhook_id = $1 AND org_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.params.id, orgId, pageSize, (page - 1) * pageSize]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM crm_webhook_logs WHERE webhook_id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );

    res.json({
      logs: rows.map((r: any) => ({
        id: r.id, event: r.event, payload: r.payload,
        statusCode: r.status_code, responseBody: r.response_body,
        responseTime: r.response_time, errorMessage: r.error_message,
        success: r.success, createdAt: r.created_at,
      })),
      total: parseInt(countRows[0].count),
      page, pageSize,
    });
  } catch (err: any) {
    console.error('Get webhook logs error:', err);
    res.status(500).json({ error: 'Failed to fetch webhook logs' });
  }
});

// Test a webhook
crmGapsRouter.post('/webhooks/:id/test', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT * FROM crm_webhooks WHERE id = $1 AND org_id = $2`,
      [req.params.id, orgId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });

    const webhook = rows[0];
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook from MarinaMatch CRM' },
    };

    const startTime = Date.now();
    try {
      const response = await fetch(webhook.url, {
        method: webhook.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.headers || {}),
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });
      const responseTime = Date.now() - startTime;
      const responseBody = await response.text();

      // Log
      await pool.query(
        `INSERT INTO crm_webhook_logs (webhook_id, event, payload, status_code, response_body, response_time, success, org_id)
         VALUES ($1, 'test', $2, $3, $4, $5, $6, $7)`,
        [webhook.id, JSON.stringify(testPayload), response.status, responseBody.substring(0, 1000), responseTime, response.ok, orgId]
      );

      res.json({ success: response.ok, statusCode: response.status, responseTime, responseBody: responseBody.substring(0, 500) });
    } catch (fetchErr: any) {
      const responseTime = Date.now() - startTime;
      await pool.query(
        `INSERT INTO crm_webhook_logs (webhook_id, event, payload, status_code, error_message, response_time, success, org_id)
         VALUES ($1, 'test', $2, 0, $3, $4, false, $5)`,
        [webhook.id, JSON.stringify(testPayload), fetchErr.message, responseTime, orgId]
      );
      res.json({ success: false, error: fetchErr.message, responseTime });
    }
  } catch (err: any) {
    console.error('Test webhook error:', err);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// ── Webhook firing utility (exported for use in other routes) ────────
export async function fireWebhooks(orgId: string, event: string, data: any) {
  try {
    const { rows: webhooks } = await pool.query(
      `SELECT * FROM crm_webhooks
       WHERE org_id = $1 AND is_active = true AND events @> $2::jsonb`,
      [orgId, JSON.stringify([event])]
    );

    for (const webhook of webhooks) {
      const payload = { event, timestamp: new Date().toISOString(), data };
      const startTime = Date.now();
      try {
        const response = await fetch(webhook.url, {
          method: webhook.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...(webhook.headers || {}) },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });
        const responseTime = Date.now() - startTime;

        await pool.query(
          `INSERT INTO crm_webhook_logs (webhook_id, event, payload, status_code, response_time, success, org_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [webhook.id, event, JSON.stringify(payload), response.status, responseTime, response.ok, orgId]
        );
        await pool.query(
          `UPDATE crm_webhooks SET total_calls = total_calls + 1,
           successful_calls = successful_calls + CASE WHEN $1 THEN 1 ELSE 0 END,
           failed_calls = failed_calls + CASE WHEN NOT $1 THEN 1 ELSE 0 END,
           last_called_at = NOW(), last_status = $2
           WHERE id = $3`,
          [response.ok, response.status, webhook.id]
        );
      } catch (fetchErr: any) {
        const responseTime = Date.now() - startTime;
        await pool.query(
          `INSERT INTO crm_webhook_logs (webhook_id, event, payload, error_message, response_time, success, org_id)
           VALUES ($1, $2, $3, $4, $5, false, $6)`,
          [webhook.id, event, JSON.stringify(payload), fetchErr.message, responseTime, orgId]
        );
        await pool.query(
          `UPDATE crm_webhooks SET total_calls = total_calls + 1, failed_calls = failed_calls + 1,
           last_called_at = NOW(), last_status = 0 WHERE id = $1`,
          [webhook.id]
        );
      }
    }
  } catch (err) {
    console.error('Fire webhooks error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 7. RECURRING ACTIVITIES
// ═══════════════════════════════════════════════════════════════════════

crmGapsRouter.post('/activities/:id/set-recurrence', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { recurrenceRule, recurrenceEndDate } = req.body;
    // recurrenceRule: "daily", "weekly", "biweekly", "monthly", "quarterly"
    if (!recurrenceRule) {
      return res.status(400).json({ error: 'recurrenceRule is required' });
    }

    const { rows } = await pool.query(
      `UPDATE crm_activities
       SET is_recurring = true, recurrence_rule = $1, recurrence_end_date = $2
       WHERE id = $3 AND org_id = $4
       RETURNING *`,
      [recurrenceRule, recurrenceEndDate || null, req.params.id, orgId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('Set recurrence error:', err);
    res.status(500).json({ error: 'Failed to set recurrence' });
  }
});

// Generate next occurrence from a recurring activity
crmGapsRouter.post('/activities/:id/create-next-occurrence', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows: [parent] } = await pool.query(
      `SELECT * FROM crm_activities WHERE id = $1 AND org_id = $2 AND is_recurring = true`,
      [req.params.id, orgId]
    );
    if (!parent) return res.status(404).json({ error: 'Recurring activity not found' });

    // Calculate next date
    const baseDate = parent.scheduled_at ? new Date(parent.scheduled_at) : new Date();
    const nextDate = new Date(baseDate);

    switch (parent.recurrence_rule) {
      case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
      default: nextDate.setDate(nextDate.getDate() + 7);
    }

    // Check end date
    if (parent.recurrence_end_date && nextDate > new Date(parent.recurrence_end_date)) {
      return res.json({ created: false, reason: 'Past recurrence end date' });
    }

    // Get current occurrence count
    const { rows: [countRow] } = await pool.query(
      `SELECT COALESCE(MAX(occurrence_index), 0) as max_idx FROM crm_activities WHERE parent_activity_id = $1`,
      [parent.id]
    );

    const { rows: [newActivity] } = await pool.query(
      `INSERT INTO crm_activities
       (type, subject, description, direction, duration, status, entity_type, entity_id,
        user_id, scheduled_at, is_recurring, recurrence_rule, recurrence_end_date,
        parent_activity_id, occurrence_index, reminder_minutes_before, org_id)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9, true, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        parent.type, parent.subject, parent.description, parent.direction, parent.duration,
        parent.entity_type, parent.entity_id, parent.user_id, nextDate,
        parent.recurrence_rule, parent.recurrence_end_date,
        parent.id, parseInt(countRow.max_idx) + 1,
        parent.reminder_minutes_before, orgId
      ]
    );

    // Set reminder if reminder_minutes_before is set
    if (newActivity.reminder_minutes_before) {
      const reminderAt = new Date(nextDate.getTime() - (newActivity.reminder_minutes_before * 60000));
      await pool.query(
        `UPDATE crm_activities SET reminder_at = $1 WHERE id = $2`,
        [reminderAt, newActivity.id]
      );
    }

    res.status(201).json({ created: true, activity: newActivity });
  } catch (err: any) {
    console.error('Create next occurrence error:', err);
    res.status(500).json({ error: 'Failed to create next occurrence' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 8. DEAL-PRODUCT LINKING (Enhanced)
// ═══════════════════════════════════════════════════════════════════════

crmGapsRouter.get('/deals/:dealId/products', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { rows } = await pool.query(
      `SELECT dp.*, p.name as product_name, p.code as product_code, p.category
       FROM crm_deal_products dp
       JOIN crm_products p ON dp.product_id = p.id
       WHERE dp.deal_id = $1 AND dp.org_id = $2
       ORDER BY dp.created_at ASC`,
      [req.params.dealId, orgId]
    );

    const totalRevenue = rows.reduce((sum: number, r: any) => sum + parseFloat(r.total_price || 0), 0);
    const recurringRevenue = rows.filter((r: any) => r.is_recurring).reduce((sum: number, r: any) => sum + parseFloat(r.total_price || 0), 0);

    res.json({
      products: rows.map((r: any) => ({
        id: r.id, dealId: r.deal_id, productId: r.product_id,
        productName: r.product_name, productCode: r.product_code, category: r.category,
        quantity: r.quantity, price: parseFloat(r.price), discount: parseFloat(r.discount || 0),
        totalPrice: parseFloat(r.total_price), isRecurring: r.is_recurring,
        billingCycle: r.billing_cycle, startDate: r.start_date, endDate: r.end_date,
        notes: r.notes,
      })),
      totalRevenue,
      recurringRevenue,
      oneTimeRevenue: totalRevenue - recurringRevenue,
    });
  } catch (err: any) {
    console.error('Get deal products error:', err);
    res.status(500).json({ error: 'Failed to fetch deal products' });
  }
});

crmGapsRouter.post('/deals/:dealId/products', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { productId, quantity, price, discount, isRecurring, billingCycle, startDate, endDate, notes } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required' });

    const qty = quantity || 1;
    const unitPrice = price || 0;
    const disc = discount || 0;
    const totalPrice = qty * unitPrice * (1 - disc / 100);

    const { rows } = await pool.query(
      `INSERT INTO crm_deal_products
       (deal_id, product_id, quantity, price, discount, total_price, is_recurring, billing_cycle, start_date, end_date, notes, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [req.params.dealId, productId, qty, unitPrice, disc, totalPrice, isRecurring || false, billingCycle, startDate, endDate, notes, orgId]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error('Add deal product error:', err);
    res.status(500).json({ error: 'Failed to add product to deal' });
  }
});

crmGapsRouter.delete('/deals/:dealId/products/:id', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    await pool.query(
      `DELETE FROM crm_deal_products WHERE id = $1 AND deal_id = $2 AND org_id = $3`,
      [req.params.id, req.params.dealId, orgId]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('Remove deal product error:', err);
    res.status(500).json({ error: 'Failed to remove product from deal' });
  }
});

export default crmGapsRouter;
