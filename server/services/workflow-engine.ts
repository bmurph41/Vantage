import { db } from '../db';
import { pool } from '../db';
import { storage } from '../storage';
import {
  workflowAutomations,
  workflowExecutionLog,
  crmDeals,
  crmContacts,
  crmCompanies,
  crmTasks,
  crmActivities,
  users,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { sendEmail, wrapEmailTemplate } from './email-service';

// ── Trigger types ──────────────────────────────────────────────────────

export const TRIGGER_TYPES = {
  'deal.stage_changed': { label: 'Deal stage changes', entity: 'deal' },
  'deal.created': { label: 'New deal created', entity: 'deal' },
  'deal.field_updated': { label: 'Deal field updated', entity: 'deal' },
  'deal.assigned': { label: 'Deal assigned to user', entity: 'deal' },
  'contact.created': { label: 'New contact created', entity: 'contact' },
  'document.uploaded': { label: 'Document uploaded to deal', entity: 'document' },
  'work_order.created': { label: 'Work order submitted', entity: 'work_order' },
} as const;

export type TriggerType = keyof typeof TRIGGER_TYPES;

// ── Condition evaluation ───────────────────────────────────────────────

interface ConditionRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' |
            'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' |
            'in_list' | 'not_in_list';
  value: any;
}

interface ConditionGroup {
  logic?: 'AND' | 'OR';
  rules: ConditionRule[];
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function evaluateRule(rule: ConditionRule, entity: Record<string, any>, eventData: Record<string, any>): boolean {
  // Allow accessing both the entity fields and eventData fields (e.g. "prevStage", "newStage")
  const fieldValue = getNestedValue(entity, rule.field) ?? getNestedValue(eventData, rule.field);

  switch (rule.operator) {
    case 'equals':
      return fieldValue == rule.value;
    case 'not_equals':
      return fieldValue != rule.value;
    case 'greater_than':
      return Number(fieldValue) > Number(rule.value);
    case 'less_than':
      return Number(fieldValue) < Number(rule.value);
    case 'contains':
      return String(fieldValue ?? '').toLowerCase().includes(String(rule.value).toLowerCase());
    case 'not_contains':
      return !String(fieldValue ?? '').toLowerCase().includes(String(rule.value).toLowerCase());
    case 'is_empty':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'is_not_empty':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'in_list':
      return Array.isArray(rule.value) && rule.value.includes(fieldValue);
    case 'not_in_list':
      return Array.isArray(rule.value) && !rule.value.includes(fieldValue);
    default:
      return false;
  }
}

export function evaluateConditions(
  conditions: ConditionGroup | null | undefined,
  entity: Record<string, any>,
  eventData: Record<string, any>,
): boolean {
  if (!conditions || !conditions.rules || conditions.rules.length === 0) {
    return true; // No conditions = always pass
  }

  const logic = conditions.logic || 'AND';
  const results = conditions.rules.map(rule => evaluateRule(rule, entity, eventData));

  return logic === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}

// ── Action execution ───────────────────────────────────────────────────

interface WorkflowAction {
  type: string;
  params: Record<string, any>;
  parameters?: Record<string, any>; // Some builders use `parameters` instead of `params`
}

async function executeAction(
  action: WorkflowAction,
  entity: Record<string, any>,
  eventData: Record<string, any>,
  orgId: string,
  automationCreatedBy: string | null,
): Promise<{ type: string; success: boolean; detail?: string }> {
  const result = { type: action.type, success: true, detail: '' };

  try {
    switch (action.type) {
      case 'task.create': {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (action.params.dueDaysFromNow || 3));

        const assigneeId = action.params.assignTo || automationCreatedBy || entity.ownerId;
        if (!assigneeId) {
          result.success = false;
          result.detail = 'No assignee available for task creation';
          break;
        }

        await db.insert(crmTasks).values({
          title: interpolateTemplate(action.params.title, entity, eventData),
          description: interpolateTemplate(action.params.description || '', entity, eventData),
          type: 'task',
          priority: action.params.priority || 'medium',
          status: 'pending',
          dueDate,
          completed: false,
          dealId: entity.id && eventData.entityType === 'deal' ? entity.id : (entity.dealId || null),
          contactId: eventData.entityType === 'contact' ? entity.id : null,
          assigneeId,
          orgId,
        });
        result.detail = `Task "${action.params.title}" created`;
        break;
      }

      case 'deal.update_stage': {
        if (entity.id && action.params.newStage) {
          await storage.updateCrmDeal(entity.id, { stageId: action.params.newStage });
          result.detail = `Deal stage updated to ${action.params.newStage}`;
        }
        break;
      }

      case 'deal.update_field': {
        if (entity.id && action.params.field) {
          await storage.updateCrmDeal(entity.id, { [action.params.field]: action.params.value });
          result.detail = `Deal field "${action.params.field}" updated`;
        }
        break;
      }

      case 'deal.add_tag': {
        if (entity.id && action.params.tag) {
          const currentTags = Array.isArray(entity.tags) ? entity.tags : [];
          if (!currentTags.includes(action.params.tag)) {
            await storage.updateCrmDeal(entity.id, { tags: [...currentTags, action.params.tag] });
          }
          result.detail = `Tag "${action.params.tag}" added to deal`;
        }
        break;
      }

      case 'notification.send_in_app': {
        // Log as activity which shows in activity feed
        await storage.createCrmActivity({
          type: 'automation',
          subject: interpolateTemplate(action.params.message || 'Workflow notification', entity, eventData),
          description: `Automated notification from workflow`,
          status: 'completed',
          entityType: eventData.entityType || 'deal',
          entityId: entity.id,
          performedBy: automationCreatedBy,
        });
        result.detail = 'In-app notification sent';
        break;
      }

      case 'activity.log': {
        await storage.createCrmActivity({
          type: action.params.activityType || 'note',
          subject: interpolateTemplate(action.params.note || '', entity, eventData),
          description: 'Logged by workflow automation',
          status: 'completed',
          entityType: eventData.entityType || 'deal',
          entityId: entity.id,
          performedBy: automationCreatedBy,
        });
        result.detail = 'Activity logged';
        break;
      }

      case 'wait': {
        // Wait actions are logged but not executed synchronously.
        // A full implementation would schedule via a job queue (Bull/Redis).
        result.detail = `Wait ${action.params.days} day(s) — skipped (no job queue configured)`;
        break;
      }

      case 'webhook.send': {
        const url = action.params.url;
        if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
          result.success = false;
          result.detail = 'Webhook URL must be a valid HTTPS URL';
          break;
        }
        try {
          const payload = {
            trigger: eventData,
            entity,
            automation_action: action.type,
            timestamp: new Date().toISOString(),
          };
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          });
          result.detail = `Webhook sent to ${url} — ${resp.status}`;
          if (!resp.ok) result.success = false;
        } catch (err: any) {
          result.success = false;
          result.detail = `Webhook failed: ${err.message?.slice(0, 100)}`;
        }
        break;
      }

      case 'contact.create_task': {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (action.params.dueDaysFromNow || 3));
        const assigneeId = action.params.assignTo || automationCreatedBy;
        if (!assigneeId) {
          result.success = false;
          result.detail = 'No assignee for contact task';
          break;
        }
        await db.insert(crmTasks).values({
          title: interpolateTemplate(action.params.title, entity, eventData),
          description: interpolateTemplate(action.params.description || '', entity, eventData),
          type: 'task',
          priority: action.params.priority || 'medium',
          status: 'pending',
          dueDate,
          completed: false,
          contactId: entity.id,
          assigneeId,
          orgId,
        });
        result.detail = `Contact task "${action.params.title}" created`;
        break;
      }

      case 'email.send':
      case 'send_email': {
        // Support both action.params and action.parameters (different builders use different keys)
        const p = action.params ?? action.parameters ?? {};

        // Fail fast if in template mode but no template was actually selected
        if (p.templateId !== undefined && !p.templateId) {
          result.success = false;
          result.detail = 'Email template mode is selected but no template was chosen';
          break;
        }

        // ── Step 1: Fetch owner row (used for both recipient resolution and context) ──
        const ownerIdRaw = entity.ownerId || entity.assignedTo || automationCreatedBy;
        let ownerEmail = entity.assignedToEmail || entity.ownerEmail || '';
        let ownerName = '';
        if (ownerIdRaw) {
          try {
            const ownerRow = await pool.query(
              'SELECT email, COALESCE(first_name || \' \' || last_name, first_name, last_name, username, email) AS display_name FROM users WHERE id::text = $1 LIMIT 1',
              [String(ownerIdRaw)]
            );
            if (ownerRow.rows.length > 0) {
              ownerEmail = ownerRow.rows[0].email || ownerEmail;
              ownerName = ownerRow.rows[0].display_name || '';
            }
          } catch (_) { /* non-fatal */ }
        }

        // ── Step 2: Fetch primary contact for deal context ──
        let contactCtx: Record<string, string> = {};
        if (eventData.entityType === 'deal' && entity.contactId) {
          try {
            const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, entity.contactId));
            if (contact) {
              contactCtx = {
                firstName: contact.firstName || '',
                lastName: contact.lastName || '',
                email: contact.email || '',
              };
            }
          } catch (_) { /* non-fatal */ }
        } else if (eventData.entityType === 'contact') {
          contactCtx = {
            firstName: entity.firstName || '',
            lastName: entity.lastName || '',
            email: entity.email || '',
          };
        }

        // ── Step 3: Fetch org name ──
        let orgName = '';
        try {
          const orgRow = await pool.query('SELECT name FROM organizations WHERE id::text = $1 LIMIT 1', [String(orgId)]);
          orgName = orgRow.rows[0]?.name || '';
        } catch (_) { /* non-fatal */ }

        // ── Step 4: Build canonical nested context for {{deal.X}}, {{contact.X}} tokens ──
        // Use Record<string, any> so interpolateTemplate accepts it without casts
        const dealValue = entity.value || entity.amount || entity.dealValue;
        const templateContext: Record<string, any> = {
          deal: {
            propertyName: entity.title || entity.marinaName || entity.name || '',
            stage: entity.stage || '',
            value: dealValue ? `$${Number(dealValue).toLocaleString()}` : '',
            assetClass: entity.assetClass || '',
            daysInStage: String(entity.daysInCurrentStage || entity.daysInStage || 0),
            state: entity.state || '',
            city: entity.city || '',
            assignedToName: ownerName,
          },
          contact: contactCtx,
          org: { name: orgName },
          user: { name: ownerName },
          rule: { name: eventData.automationName || eventData.ruleName || '' },
        };

        // ── Step 5: Resolve recipient email ──
        const recipientType = p.recipientType || 'custom';
        let toEmail: string;
        if (recipientType === 'deal_owner' || p.to === 'deal_owner') {
          toEmail = ownerEmail;
        } else if (recipientType === 'contact' || p.to === 'primary_contact') {
          toEmail = contactCtx.email || entity.email || entity.contactEmail || '';
        } else {
          toEmail = p.to
            ? interpolateTemplate(p.to, templateContext, eventData)
            : entity.email || '';
        }
        if (!toEmail) {
          result.success = false;
          result.detail = 'No recipient email address resolved';
          break;
        }

        // ── Step 6: Resolve subject and body — prefer templateId if set ──
        let renderedSubject: string;
        let renderedHtml: string;
        let usedTemplateId: string | null = null;

        if (p.templateId) {
          try {
            const tplResult = await pool.query(
              'SELECT * FROM workflow_email_templates WHERE id = $1 AND org_id = $2 AND is_active = true',
              [p.templateId, orgId]
            );
            if (tplResult.rows.length === 0) {
              result.success = false;
              result.detail = `Email template ${p.templateId} not found`;
              break;
            }
            const tpl = tplResult.rows[0];
            // Use canonical nested context for accurate {{deal.X}} / {{contact.X}} resolution
            renderedSubject = interpolateTemplate(tpl.subject, templateContext, eventData);
            renderedHtml = wrapEmailTemplate(interpolateTemplate(tpl.body_html, templateContext, eventData));
            usedTemplateId = p.templateId;
          } catch (tplErr: any) {
            result.success = false;
            result.detail = `Failed to load template: ${tplErr.message}`;
            break;
          }
        } else {
          // Custom content: merge flat entity (for legacy {stage} tokens) with nested context
          // (for {{deal.propertyName}} tokens) so both formats work consistently
          const rawSubject = p.subject || '';
          const rawBody = p.body || '';
          if (!rawSubject && !rawBody) {
            result.success = false;
            result.detail = 'Email action is missing both subject and body';
            break;
          }
          const mergedContext: Record<string, any> = { ...entity, ...templateContext };
          renderedSubject = interpolateTemplate(rawSubject, mergedContext, eventData);
          renderedHtml = wrapEmailTemplate(interpolateTemplate(rawBody, mergedContext, eventData));
        }

        const renderedText = renderedHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

        // Determine provider for logging based on available API keys
        const emailProvider = process.env.SENDGRID_API_KEY ? 'sendgrid'
          : process.env.RESEND_API_KEY ? 'resend'
          : 'console';

        const sent = await sendEmail({
          to: toEmail,
          subject: renderedSubject,
          text: renderedText,
          html: renderedHtml,
          from: p.fromName
            ? { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@vantage.com', name: p.fromName }
            : undefined,
        });

        // ── Step 7: Log to workflow_email_log (correct entity linkage) ──
        const logDealId = eventData.entityType === 'deal' ? (entity.id || null) : null;
        const logContactId = eventData.entityType === 'contact' ? (entity.id || null) : (entity.contactId || null);
        try {
          await pool.query(
            `INSERT INTO workflow_email_log
               (org_id, template_id, recipient_email, recipient_type, subject, body_preview, status, provider, sent_at, deal_id, contact_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              orgId,
              usedTemplateId,
              toEmail,
              recipientType,
              renderedSubject,
              renderedHtml.substring(0, 500),
              sent ? 'sent' : 'failed',
              sent ? emailProvider : null,
              sent ? new Date() : null,
              logDealId,
              logContactId,
            ]
          );
        } catch (_logErr) { /* non-fatal */ }

        if (sent) {
          // ── Step 8: Log CRM activity for deal side (always) ──
          const crmEntityType = eventData.entityType === 'contact' ? 'contact' : 'deal';
          await storage.createCrmActivity({
            type: 'email',
            subject: `Automated email: ${renderedSubject}`,
            description: `Email sent to ${toEmail} via workflow automation`,
            direction: 'outbound',
            entityType: crmEntityType,
            entityId: entity.id,
            orgId,
          });
          // Also log a contact-side activity when a deal-triggered email goes to a primary contact
          if (eventData.entityType === 'deal' && entity.contactId) {
            try {
              await storage.createCrmActivity({
                type: 'email',
                subject: `Automated email: ${renderedSubject}`,
                description: `Email sent to ${toEmail} via workflow automation (deal: ${entity.title || entity.id})`,
                direction: 'outbound',
                entityType: 'contact',
                entityId: entity.contactId,
                orgId,
              });
            } catch (_) { /* non-fatal: best-effort contact-side activity */ }
          }
          result.detail = `Email sent to ${toEmail}: "${renderedSubject}"`;
        } else {
          result.success = false;
          result.detail = `Email send failed to ${toEmail}`;
        }
        break;
      }

      default:
        result.detail = `Unknown action type: ${action.type}`;
        result.success = false;
    }
  } catch (err: any) {
    result.success = false;
    result.detail = err.message;
  }

  return result;
}

// ── Template interpolation ─────────────────────────────────────────────

function interpolateTemplate(
  template: string,
  entity: Record<string, any>,
  eventData: Record<string, any>,
): string {
  if (!template) return '';
  // Support {{path}} syntax (used by email templates and spec)
  let result = template.replace(/\{\{([\w.]+)\}\}/g, (_match, path) => {
    const val = getNestedValue(entity, path) ?? getNestedValue(eventData, path);
    return val != null ? String(val) : '';
  });
  // Also support {path} syntax (legacy single-brace format)
  result = result.replace(/\{(\w+(?:\.\w+)*)\}/g, (_match, path) => {
    const val = getNestedValue(entity, path) ?? getNestedValue(eventData, path);
    return val != null ? String(val) : '';
  });
  return result;
}

// ── Entity fetcher ─────────────────────────────────────────────────────

async function fetchEntity(entityType: string, entityId: string): Promise<Record<string, any> | null> {
  switch (entityType) {
    case 'deal': {
      const deal = await storage.getCrmDeal(entityId);
      return deal ? (deal as unknown as Record<string, any>) : null;
    }
    case 'contact': {
      const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, entityId));
      return contact ? (contact as unknown as Record<string, any>) : null;
    }
    case 'company': {
      const [company] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, entityId));
      return company ? (company as unknown as Record<string, any>) : null;
    }
    default:
      return null;
  }
}

// ── Main entry point ───────────────────────────────────────────────────

export async function evaluateAutomations(
  triggerType: string,
  entityType: string,
  entityId: string,
  orgId: string,
  eventData: Record<string, any> = {},
): Promise<void> {
  try {
    const automations = await storage.getActiveAutomationsByTrigger(orgId, triggerType);

    if (automations.length === 0) return;

    const entity = await fetchEntity(entityType, entityId);
    if (!entity) {
      logger.warn({ triggerType, entityType, entityId }, '[WorkflowEngine] Entity not found, skipping automations');
      return;
    }

    const enrichedEventData = { ...eventData, entityType };

    for (const automation of automations) {
      const conditionsMet = evaluateConditions(
        automation.conditions as ConditionGroup | null,
        entity,
        enrichedEventData,
      );

      if (!conditionsMet) {
        await storage.createWorkflowExecutionLog({
          automationId: automation.id,
          triggerEntityType: entityType,
          triggerEntityId: entityId,
          status: 'skipped',
          actionsExecuted: null,
          errorMessage: null,
        });
        continue;
      }

      // Execute actions
      const actions = automation.actions as WorkflowAction[];
      if (!Array.isArray(actions)) continue;

      const actionResults: Array<{ type: string; success: boolean; detail?: string }> = [];
      let hasError = false;

      for (const action of actions) {
        const actionResult = await executeAction(action, entity, enrichedEventData, orgId, automation.createdBy);
        actionResults.push(actionResult);
        if (!actionResult.success) {
          hasError = true;
          break; // Stop executing further actions on failure
        }
      }

      await storage.createWorkflowExecutionLog({
        automationId: automation.id,
        triggerEntityType: entityType,
        triggerEntityId: entityId,
        status: hasError ? 'failed' : 'success',
        actionsExecuted: actionResults,
        errorMessage: hasError ? actionResults.find(r => !r.success)?.detail || 'Action failed' : null,
      });

      if (!hasError) {
        await storage.incrementWorkflowExecutionCount(automation.id);
      }

      logger.info(
        { automationId: automation.id, triggerType, entityId, status: hasError ? 'failed' : 'success' },
        '[WorkflowEngine] Automation executed',
      );
    }
  } catch (err) {
    logger.error({ err, triggerType, entityType, entityId }, '[WorkflowEngine] Unexpected error evaluating automations');
  }
}

// ── Dry-run for testing ────────────────────────────────────────────────

export async function dryRunAutomation(
  automationId: string,
  orgId: string,
  testEntityId: string,
): Promise<{ conditionsMet: boolean; wouldExecute: WorkflowAction[]; entity: Record<string, any> | null }> {
  const automation = await storage.getWorkflowAutomation(automationId, orgId);
  if (!automation) throw new Error('Automation not found');

  const triggerDef = TRIGGER_TYPES[automation.triggerType as TriggerType];
  if (!triggerDef) throw new Error(`Unknown trigger type: ${automation.triggerType}`);

  const entity = await fetchEntity(triggerDef.entity, testEntityId);
  if (!entity) throw new Error(`Entity not found: ${testEntityId}`);

  const conditionsMet = evaluateConditions(
    automation.conditions as ConditionGroup | null,
    entity,
    { entityType: triggerDef.entity },
  );

  const actions = Array.isArray(automation.actions) ? automation.actions as WorkflowAction[] : [];

  return { conditionsMet, wouldExecute: conditionsMet ? actions : [], entity };
}

// ── Pre-built templates ────────────────────────────────────────────────

export const WORKFLOW_TEMPLATES = [
  {
    id: 'new_deal_onboarding',
    name: 'New Deal Onboarding',
    description: 'Automatically create setup tasks when a new deal is added',
    triggerType: 'deal.created',
    triggerConfig: {},
    conditions: null,
    actions: [
      { type: 'task.create', params: { title: 'Schedule initial site tour for {name}', description: 'Coordinate with seller to schedule property inspection', assignTo: null, dueDaysFromNow: 5, priority: 'high' } },
      { type: 'task.create', params: { title: 'Run buy-box scoring', description: 'Score deal against investment criteria', assignTo: null, dueDaysFromNow: 2, priority: 'high' } },
      { type: 'task.create', params: { title: 'Research submarket comps', description: 'Pull comparable sales and rental data for the submarket', assignTo: null, dueDaysFromNow: 3, priority: 'medium' } },
      { type: 'activity.log', params: { note: 'Deal created — onboarding tasks generated by automation', activityType: 'note' } },
    ],
  },
  {
    id: 'dd_stage_entry',
    name: 'Due Diligence Stage Entry',
    description: 'Create DD-related tasks when a deal moves to Due Diligence',
    triggerType: 'deal.stage_changed',
    triggerConfig: {},
    conditions: { logic: 'AND', rules: [{ field: 'newStageName', operator: 'contains', value: 'due diligence' }] },
    actions: [
      { type: 'task.create', params: { title: 'Confirm DD deadline with seller', description: 'Verify inspection period dates and deadlines', assignTo: null, dueDaysFromNow: 1, priority: 'high' } },
      { type: 'task.create', params: { title: 'Schedule physical inspection for {name}', description: 'Book property inspection and environmental review', assignTo: null, dueDaysFromNow: 3, priority: 'high' } },
      { type: 'activity.log', params: { note: 'Automated DD setup triggered for {name}', activityType: 'note' } },
    ],
  },
  {
    id: 'deal_won_close_tasks',
    name: 'Deal Won — Close Tasks',
    description: 'Generate post-close tasks when a deal moves to Closed',
    triggerType: 'deal.stage_changed',
    triggerConfig: {},
    conditions: { logic: 'AND', rules: [{ field: 'newStageName', operator: 'contains', value: 'closed' }] },
    actions: [
      { type: 'notification.send_in_app', params: { message: '{name} has closed!' } },
      { type: 'task.create', params: { title: 'Set up asset management workspace', assignTo: null, dueDaysFromNow: 3, priority: 'medium' } },
      { type: 'task.create', params: { title: 'Update cap stack with final loan terms', assignTo: null, dueDaysFromNow: 2, priority: 'high' } },
      { type: 'task.create', params: { title: 'Send investor close notifications', assignTo: null, dueDaysFromNow: 1, priority: 'high' } },
      { type: 'task.create', params: { title: 'Schedule 30-day post-close inspection', assignTo: null, dueDaysFromNow: 7, priority: 'medium' } },
      { type: 'activity.log', params: { note: 'Deal closed. Automated close tasks created for {name}.', activityType: 'note' } },
    ],
  },
  {
    id: 'critical_work_order_escalation',
    name: 'Critical Work Order Escalation',
    description: 'Escalate critical work orders to property manager immediately',
    triggerType: 'work_order.created',
    triggerConfig: {},
    conditions: { logic: 'AND', rules: [{ field: 'priority', operator: 'equals', value: 'critical' }] },
    actions: [
      { type: 'task.create', params: { title: 'Review critical work order: {title}', description: 'Urgent escalation — critical work order requires immediate attention', assignTo: null, dueDaysFromNow: 0, priority: 'urgent' } },
      { type: 'activity.log', params: { note: 'Critical work order escalated via automation', activityType: 'note' } },
    ],
  },
  {
    id: 'broker_follow_up',
    name: 'New Broker Contact Follow-Up',
    description: 'Create a follow-up task when a broker contact is added',
    triggerType: 'contact.created',
    triggerConfig: {},
    conditions: { logic: 'AND', rules: [{ field: 'contactTag', operator: 'equals', value: 'broker' }] },
    actions: [
      { type: 'task.create', params: { title: 'Schedule intro call with {firstName} {lastName}', description: 'New broker contact — reach out to establish relationship', assignTo: null, dueDaysFromNow: 2, priority: 'medium' } },
      { type: 'activity.log', params: { note: 'Broker follow-up task created for {firstName} {lastName}', activityType: 'note' } },
    ],
  },
];
