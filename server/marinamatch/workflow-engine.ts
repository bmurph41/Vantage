/**
 * workflow-engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Evaluates workflow rules and executes their action chains.
 *
 * Usage:
 *   import { WorkflowEngine } from './workflow-engine';
 *   await WorkflowEngine.fire('deal_stage_changed', orgId, { deal, fromStage, toStage });
 *
 * Called from:
 *   - PATCH /api/marinamatch/sourced-deals/:id  (stage changes)
 *   - POST  /api/marinamatch/sourced-deals       (new deal added)
 *   - POST  /api/marinamatch/sourced-deals/:id/convert
 *   - Cron job (deal_stale trigger)
 *   - Manual trigger via POST /api/marinamatch/workflow-rules/:id/trigger
 */

import { pool } from '../db'; // adjust path to your pg Pool

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriggerType =
  | 'deal_added'
  | 'deal_stage_changed'
  | 'deal_score_threshold'
  | 'deal_stale'
  | 'deal_converted'
  | 'deal_disqualified'
  | 'manual';

export interface TriggerContext {
  deal?: Record<string, any>;
  contact?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    company?: string;
  };
  fromStage?: string;
  toStage?: string;
  score?: number;
  staleAfterDays?: number;
  triggeredBy?: string; // userId for manual trigger
  ruleId?: string;
  ruleName?: string;
  executionId?: string;
  meta?: Record<string, any>;
}

export interface WorkflowRule {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  run_order: number;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  conditions: Condition[];
  actions: Action[];
}

export interface Condition {
  field: string;       // 'deal.status' | 'deal.askingPrice' | 'deal.state' | 'deal.bestMandateScore' | ...
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty';
  value: any;
}

export interface Action {
  type:
    | 'change_status'
    | 'assign_to'
    | 'add_note'
    | 'create_task'
    | 'send_notification'
    | 'send_email'
    | 'webhook';
  config: Record<string, any>;
}

// ─── Condition Evaluator ──────────────────────────────────────────────────────

function getFieldValue(context: TriggerContext, field: string): any {
  const parts = field.split('.');
  let obj: any = context;
  for (const part of parts) {
    if (obj == null) return undefined;
    obj = obj[part];
  }
  return obj;
}

function evaluateCondition(condition: Condition, context: TriggerContext): boolean {
  const actual = getFieldValue(context, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case 'eq':          return actual == expected;
    case 'ne':          return actual != expected;
    case 'gt':          return Number(actual) > Number(expected);
    case 'lt':          return Number(actual) < Number(expected);
    case 'gte':         return Number(actual) >= Number(expected);
    case 'lte':         return Number(actual) <= Number(expected);
    case 'contains':    return String(actual ?? '').toLowerCase().includes(String(expected).toLowerCase());
    case 'not_contains':return !String(actual ?? '').toLowerCase().includes(String(expected).toLowerCase());
    case 'in':          return Array.isArray(expected) && expected.includes(actual);
    case 'not_in':      return Array.isArray(expected) && !expected.includes(actual);
    case 'is_empty':    return actual == null || actual === '' || (Array.isArray(actual) && actual.length === 0);
    case 'is_not_empty':return actual != null && actual !== '' && !(Array.isArray(actual) && actual.length === 0);
    default:            return false;
  }
}

function evaluateConditions(conditions: Condition[], context: TriggerContext): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(c => evaluateCondition(c, context));
}

// ─── Action Executors ─────────────────────────────────────────────────────────

async function executeAction(
  action: Action,
  rule: WorkflowRule,
  context: TriggerContext,
  executionId: string
): Promise<{ status: 'success' | 'failed'; result?: any; error?: string }> {
  try {
    const deal = context.deal;
    const orgId = rule.org_id;

    switch (action.type) {
      // ── Change deal status ────────────────────────────────────────────────
      case 'change_status': {
        if (!deal?.id) return { status: 'failed', error: 'No deal in context' };
        const { newStatus } = action.config;
        await pool.query(
          `UPDATE sourced_deals SET status = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3`,
          [newStatus, deal.id, orgId]
        );
        return { status: 'success', result: { dealId: deal.id, newStatus } };
      }

      // ── Assign deal ───────────────────────────────────────────────────────
      case 'assign_to': {
        if (!deal?.id) return { status: 'failed', error: 'No deal in context' };
        const { assigneeId, assigneeName } = action.config;
        await pool.query(
          `UPDATE sourced_deals SET assigned_to = $1, assigned_to_name = $2, updated_at = NOW() 
           WHERE id = $3 AND org_id = $4`,
          [assigneeId, assigneeName, deal.id, orgId]
        );
        return { status: 'success', result: { assigneeId } };
      }

      // ── Add note ──────────────────────────────────────────────────────────
      case 'add_note': {
        if (!deal?.id) return { status: 'failed', error: 'No deal in context' };
        const { noteText } = action.config;
        const interpolated = interpolateTemplate(noteText, context);
        // Insert into broker_activity_log as a note record
        await pool.query(
          `INSERT INTO broker_activity_log (org_id, sourced_deal_id, activity_type, notes, activity_date, created_at)
           VALUES ($1, $2, 'note', $3, NOW(), NOW())`,
          [orgId, deal.id, interpolated]
        );
        return { status: 'success', result: { note: interpolated } };
      }

      // ── Create task ───────────────────────────────────────────────────────
      case 'create_task': {
        const { title, description, assigneeId, assigneeName, dueDaysFromNow, priority } = action.config;
        const interpolatedTitle = interpolateTemplate(title, context);
        const dueDate = dueDaysFromNow
          ? new Date(Date.now() + dueDaysFromNow * 86400000).toISOString().split('T')[0]
          : null;
        await pool.query(
          `INSERT INTO workflow_tasks 
           (org_id, deal_id, created_by_rule_id, created_by_execution_id, title, description, 
            assignee_id, assignee_name, due_date, priority, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',NOW(),NOW())`,
          [orgId, deal?.id ?? null, rule.id, executionId, interpolatedTitle,
           description ?? null, assigneeId ?? null, assigneeName ?? null, dueDate, priority ?? 'normal']
        );
        return { status: 'success', result: { task: interpolatedTitle, dueDate } };
      }

      // ── Send in-app notification ──────────────────────────────────────────
      case 'send_notification': {
        const { userIds, title, body, link } = action.config;
        const targets: string[] = Array.isArray(userIds) ? userIds : [userIds].filter(Boolean);
        const interpolatedTitle = interpolateTemplate(title, context);
        const interpolatedBody = body ? interpolateTemplate(body, context) : null;

        for (const userId of targets) {
          await pool.query(
            `INSERT INTO workflow_notifications 
             (org_id, user_id, deal_id, rule_id, execution_id, title, body, link, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
            [orgId, userId, deal?.id ?? null, rule.id, executionId,
             interpolatedTitle, interpolatedBody, link ?? null]
          );
        }
        return { status: 'success', result: { notified: targets.length } };
      }

      // ── Webhook ───────────────────────────────────────────────────────────
      case 'webhook': {
        const { url, method = 'POST', headers = {} } = action.config;
        const payload = {
          event: rule.trigger_type,
          rule: { id: rule.id, name: rule.name },
          deal: deal ?? null,
          context: { fromStage: context.fromStage, toStage: context.toStage, score: context.score },
          executionId,
          timestamp: new Date().toISOString(),
        };
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
        return { status: 'success', result: { statusCode: res.status } };
      }

      // ── Send email via email-service ──────────────────────────────────────
      case 'send_email': {
        const { to, subject, body, templateId, recipientType } = action.config;

        // Resolve recipient email
        let recipientEmail: string;
        let recipientName: string | undefined;

        if (to === '{{deal.ownerEmail}}' || to === 'deal_owner') {
          recipientEmail = deal?.assignedToEmail || deal?.ownerEmail || '';
          recipientName = deal?.assignedToName || deal?.ownerName;
        } else if (to === '{{contact.email}}' || to === 'primary_contact') {
          recipientEmail = context.contact?.email || '';
          recipientName = `${context.contact?.firstName || ''} ${context.contact?.lastName || ''}`.trim();
        } else {
          recipientEmail = interpolateTemplate(to || '', context);
          recipientName = undefined;
        }

        if (!recipientEmail) {
          return { status: 'failed', error: 'No recipient email resolved' };
        }

        // Resolve subject and body (template or inline)
        let renderedSubject: string;
        let renderedHtml: string;
        let renderedText: string;
        let usedTemplateId: string | null = null;

        if (templateId) {
          const tplResult = await pool.query(
            'SELECT * FROM workflow_email_templates WHERE id = $1 AND org_id = $2',
            [templateId, orgId]
          );
          if (tplResult.rows.length === 0) {
            return { status: 'failed', error: `Template ${templateId} not found` };
          }
          const tpl = tplResult.rows[0];
          renderedSubject = interpolateTemplate(tpl.subject, context);
          const { wrapEmailTemplate } = await import('../services/email-service.js');
          renderedHtml = wrapEmailTemplate(interpolateTemplate(tpl.body_html, context));
          renderedText = tpl.body_text
            ? interpolateTemplate(tpl.body_text, context)
            : stripHtmlTags(renderedHtml);
          usedTemplateId = templateId;
        } else {
          renderedSubject = interpolateTemplate(subject || '', context);
          const { wrapEmailTemplate } = await import('../services/email-service.js');
          renderedHtml = wrapEmailTemplate(interpolateTemplate(body || '', context));
          renderedText = stripHtmlTags(renderedHtml);
        }

        // Send via email-service.ts
        const { sendEmail } = await import('../services/email-service.js');
        const sent = await sendEmail({
          to: recipientEmail,
          subject: renderedSubject,
          html: renderedHtml,
          text: renderedText,
        });

        // Log to workflow_email_log
        await pool.query(
          `INSERT INTO workflow_email_log
             (org_id, rule_id, execution_id, template_id, recipient_email,
              recipient_name, recipient_type, subject, body_preview, status, provider, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            orgId,
            context.ruleId || null,
            context.executionId || null,
            usedTemplateId,
            recipientEmail,
            recipientName || null,
            recipientType || 'custom',
            renderedSubject,
            renderedHtml.substring(0, 500),
            sent ? 'sent' : 'failed',
            sent ? 'sendgrid' : null,
            sent ? new Date() : null,
          ]
        );

        // Log CRM activity
        await pool.query(
          `INSERT INTO crm_activities (id, org_id, entity_type, entity_id, action, actor_id, metadata, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
          [
            orgId,
            deal ? 'deal' : 'contact',
            deal?.id || context.contact?.id || null,
            'email_sent',
            context.triggeredBy || 'system',
            JSON.stringify({
              workflowRuleId: context.ruleId,
              templateId: usedTemplateId,
              recipientEmail,
              subject: renderedSubject,
              provider: 'workflow_automation',
            }),
          ]
        );

        return {
          status: sent ? 'success' : 'failed',
          result: { to: recipientEmail, subject: renderedSubject, templateId: usedTemplateId },
        };
      }

      default:
        return { status: 'failed', error: `Unknown action type: ${(action as any).type}` };
    }
  } catch (err: any) {
    return { status: 'failed', error: err.message ?? 'Unknown error' };
  }
}

// ─── Template interpolation ───────────────────────────────────────────────────
// Replaces {{deal.propertyName}}, {{deal.state}}, etc. in text templates.

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function interpolateTemplate(template: string, context: TriggerContext): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, path) => {
    const val = getFieldValue(context, path);
    return val != null ? String(val) : '';
  });
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

export const WorkflowEngine = {
  /**
   * Fire all active rules matching a given trigger type for an org.
   * Safe to call fire-and-forget (errors are caught and logged per-rule).
   */
  async fire(
    triggerType: TriggerType,
    orgId: string,
    context: TriggerContext
  ): Promise<void> {
    try {
      // Load matching active rules
      const { rows: rules } = await pool.query<WorkflowRule>(
        `SELECT * FROM workflow_rules
         WHERE org_id = $1 AND is_active = true AND trigger_type = $2
         ORDER BY run_order ASC, created_at ASC`,
        [orgId, triggerType]
      );

      if (rules.length === 0) return;

      // Validate trigger-level config
      const eligibleRules = rules.filter(r => triggerMatchesConfig(r, triggerType, context));

      for (const rule of eligibleRules) {
        await WorkflowEngine.executeRule(rule, context);
      }
    } catch (err) {
      console.error('[WorkflowEngine] fire() error:', err);
    }
  },

  /**
   * Execute a single rule against a context.
   * Returns the execution record id.
   */
  async executeRule(rule: WorkflowRule, context: TriggerContext): Promise<string> {
    const startedAt = Date.now();
    let executionId = '';

    // Create execution record
    const { rows: [exec] } = await pool.query(
      `INSERT INTO workflow_executions
       (rule_id, org_id, trigger_type, deal_id, deal_name, trigger_data, status, started_at)
       VALUES ($1,$2,$3,$4,$5,$6,'running',NOW()) RETURNING id`,
      [
        rule.id, rule.org_id, rule.trigger_type,
        context.deal?.id ?? null,
        context.deal?.property_name ?? context.deal?.propertyName ?? null,
        JSON.stringify(context),
      ]
    );
    executionId = exec.id;

    // Enrich context for email actions
    context.ruleId = rule.id;
    context.ruleName = rule.name;
    context.executionId = executionId;

    // Resolve deal owner email if deal is present
    if (context.deal?.id && !context.deal.assignedToEmail) {
      try {
        const { rows: ownerRows } = await pool.query(
          `SELECT u.email, u.username FROM sourced_deals sd
           LEFT JOIN users u ON sd.assigned_to::text = u.id::text
           WHERE sd.id = $1 AND sd.org_id = $2`,
          [context.deal.id, rule.org_id]
        );
        if (ownerRows.length > 0 && ownerRows[0].email) {
          context.deal.assignedToEmail = ownerRows[0].email;
          if (!context.deal.assignedToName) {
            context.deal.assignedToName = ownerRows[0].username;
          }
        }
      } catch { /* non-critical enrichment */ }
    }

    // Resolve primary contact if not already present
    if (context.deal?.id && !context.contact) {
      try {
        const { rows: contactRows } = await pool.query(
          `SELECT c.id, c.first_name, c.last_name, c.email, c.company
           FROM crm_deal_contacts dc
           JOIN crm_contacts c ON dc.contact_id = c.id
           WHERE dc.deal_id = $1 AND c.org_id = $2
           ORDER BY dc.is_primary DESC NULLS LAST, dc.created_at ASC
           LIMIT 1`,
          [context.deal.id, rule.org_id]
        );
        if (contactRows.length > 0) {
          const c = contactRows[0];
          context.contact = {
            id: c.id,
            firstName: c.first_name,
            lastName: c.last_name,
            email: c.email,
            company: c.company,
          };
        }
      } catch { /* non-critical enrichment */ }
    }

    // Check conditions
    const conditionsPassed = evaluateConditions(rule.conditions, context);

    if (!conditionsPassed) {
      await pool.query(
        `UPDATE workflow_executions SET status='skipped', skipped_reason='Conditions not met',
         completed_at=NOW(), duration_ms=$1 WHERE id=$2`,
        [Date.now() - startedAt, executionId]
      );
      return executionId;
    }

    // Execute actions
    const actionsRun: Array<{ type: string; status: string; result?: any; error?: string }> = [];
    let anyFailed = false;

    for (const action of rule.actions) {
      const result = await executeAction(action, rule, context, executionId);
      actionsRun.push({ type: action.type, ...result });
      if (result.status === 'failed') anyFailed = true;
    }

    const finalStatus = actionsRun.length === 0
      ? 'success'
      : anyFailed
        ? (actionsRun.some(a => a.status === 'success') ? 'partial' : 'failed')
        : 'success';

    const duration = Date.now() - startedAt;

    await pool.query(
      `UPDATE workflow_executions
       SET status=$1, actions_run=$2, completed_at=NOW(), duration_ms=$3
       WHERE id=$4`,
      [finalStatus, JSON.stringify(actionsRun), duration, executionId]
    );

    // Update rule stats
    await pool.query(
      `UPDATE workflow_rules
       SET times_triggered = times_triggered + 1, last_triggered_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [rule.id]
    );

    console.log(`[WorkflowEngine] Rule "${rule.name}" → ${finalStatus} in ${duration}ms`);
    return executionId;
  },
};

// ── Helper: check if trigger config matches the event ────────────────────────

function triggerMatchesConfig(
  rule: WorkflowRule,
  triggerType: TriggerType,
  context: TriggerContext
): boolean {
  const cfg = rule.trigger_config;

  switch (triggerType) {
    case 'deal_stage_changed': {
      // Optional fromStage / toStage filter
      if (cfg.fromStage && cfg.fromStage !== context.fromStage) return false;
      if (cfg.toStage && cfg.toStage !== context.toStage) return false;
      return true;
    }
    case 'deal_score_threshold': {
      // Only fire if deal score crosses threshold
      const threshold = Number(cfg.minScore ?? 0);
      return (context.score ?? 0) >= threshold;
    }
    case 'deal_stale': {
      // Checked by cron — accept all matching orgId
      if (cfg.staleAfterDays && context.staleAfterDays !== cfg.staleAfterDays) return false;
      return true;
    }
    default:
      return true;
  }
}
