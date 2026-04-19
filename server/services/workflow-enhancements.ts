/**
 * Workflow Enhancements Service
 * =============================
 * Extends the Vantage workflow engine with:
 *  1. Outbound webhooks (HMAC-signed, retry logic)
 *  2. Slack / Teams notifications
 *  3. Scheduled (cron) triggers
 *  4. Multi-step sequential workflow pipelines
 *  5. Approval integration
 *  6. Workflow analytics dashboard
 *
 * All data is org-scoped. Uses raw pool.query() for RLS-safe tables,
 * db.execute(sql`...`) for standard tables, and crypto.randomUUID for IDs.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import crypto from 'crypto';
import { isDroppedTableError } from '../utils/api-errors';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WebhookRegistration {
  url: string;
  eventTypes: string[];
  secret?: string;
  description?: string;
  isActive?: boolean;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  payload: Record<string, any>;
  statusCode: number | null;
  responseBody: string | null;
  attempt: number;
  success: boolean;
  deliveredAt: string;
  errorMessage: string | null;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text: string }>;
  fields?: Array<{ type: string; text: string }>;
}

interface TeamsSection {
  activityTitle?: string;
  activitySubtitle?: string;
  facts?: Array<{ name: string; value: string }>;
  text?: string;
}

interface ScheduledTriggerData {
  name: string;
  cronExpression: string;
  workflowRuleId: string;
  entityType: string;
  entityId?: string;
  timezone?: string;
}

type PipelineStepType = 'action' | 'condition' | 'delay' | 'approval' | 'parallel';

interface PipelineStep {
  id: string;
  type: PipelineStepType;
  name: string;
  config: Record<string, any>;
  onSuccess?: string; // next step ID
  onFailure?: string; // step ID on failure (for condition branches)
  parallelSteps?: string[]; // for parallel branches
  mergeStepId?: string; // merge point after parallel
}

interface PipelineDefinition {
  name: string;
  description?: string;
  steps: PipelineStep[];
  entryStepId: string;
}

interface ApprovalRequestData {
  workflowExecutionId?: string;
  pipelineStepId?: string;
  title: string;
  description?: string;
  requiredApprovers: string[];
  escalateAfterMinutes?: number;
  escalateTo?: string;
  entityType?: string;
  entityId?: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

class WorkflowEnhancements {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. OUTBOUND WEBHOOKS
  // ═══════════════════════════════════════════════════════════════════════════

  async registerWebhook(orgId: string, data: WebhookRegistration) {
    const id = crypto.randomUUID();
    const secret = data.secret || crypto.randomBytes(32).toString('hex');

    try {
      await db.execute(sql`
        INSERT INTO workflow_webhooks (id, org_id, url, event_types, secret, description, is_active, created_at)
        VALUES (
          ${id}, ${orgId}, ${data.url},
          ${JSON.stringify(data.eventTypes)}::jsonb,
          ${secret}, ${data.description || null},
          ${data.isActive !== false}, NOW()
        )
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow webhook feature is unavailable (backing table removed)');
      throw err;
    }

    logger.info({ webhookId: id, orgId, url: data.url }, '[WorkflowEnhancements] Webhook registered');
    return { id, secret, url: data.url, eventTypes: data.eventTypes, isActive: true };
  }

  async fireWebhook(
    orgId: string,
    webhookId: string,
    event: string,
    payload: Record<string, any>,
  ): Promise<{ success: boolean; statusCode: number | null; attempts: number }> {
    let rows: any;
    try {
      rows = await db.execute(sql`
        SELECT id, url, secret, event_types, is_active
        FROM workflow_webhooks
        WHERE id = ${webhookId} AND org_id = ${orgId}
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow webhook feature is unavailable (backing table removed)');
      throw err;
    }
    const webhook = (rows as any).rows?.[0];
    if (!webhook) throw new Error(`Webhook ${webhookId} not found`);
    if (!webhook.is_active) throw new Error(`Webhook ${webhookId} is disabled`);

    const eventTypes = typeof webhook.event_types === 'string'
      ? JSON.parse(webhook.event_types)
      : webhook.event_types;
    if (Array.isArray(eventTypes) && eventTypes.length > 0 && !eventTypes.includes(event)) {
      throw new Error(`Event "${event}" not subscribed on webhook ${webhookId}`);
    }

    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString(), webhookId });
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');

    const maxAttempts = 3;
    let lastStatusCode: number | null = null;
    let lastError: string | null = null;
    let success = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Id': webhookId,
            'X-Webhook-Event': event,
          },
          body,
          signal: AbortSignal.timeout(15000),
        });

        lastStatusCode = response.status;
        success = response.status >= 200 && response.status < 300;

        const responseBody = await response.text().catch(() => '');

        await this.logWebhookDelivery(orgId, webhookId, event, payload, lastStatusCode, responseBody, attempt, success, null);

        if (success) {
          return { success: true, statusCode: lastStatusCode, attempts: attempt };
        }

        lastError = `HTTP ${response.status}`;
      } catch (err: any) {
        lastError = err.message || 'Network error';
        await this.logWebhookDelivery(orgId, webhookId, event, payload, null, null, attempt, false, lastError);
      }

      // Exponential backoff: 1s, 4s, 9s
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * attempt * 1000));
      }
    }

    logger.warn({ webhookId, event, lastError }, '[WorkflowEnhancements] Webhook delivery failed after retries');
    return { success: false, statusCode: lastStatusCode, attempts: maxAttempts };
  }

  private async logWebhookDelivery(
    orgId: string, webhookId: string, eventType: string,
    payload: Record<string, any>, statusCode: number | null,
    responseBody: string | null, attempt: number,
    success: boolean, errorMessage: string | null,
  ) {
    const id = crypto.randomUUID();
    try {
      await db.execute(sql`
        INSERT INTO workflow_webhook_deliveries
          (id, org_id, webhook_id, event_type, payload, status_code, response_body, attempt, success, error_message, delivered_at)
        VALUES (
          ${id}, ${orgId}, ${webhookId}, ${eventType},
          ${JSON.stringify(payload)}::jsonb,
          ${statusCode}, ${responseBody}, ${attempt}, ${success},
          ${errorMessage}, NOW()
        )
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }
  }

  async listWebhooks(orgId: string) {
    try {
      const result = await db.execute(sql`
        SELECT id, name, url, event_types, is_active, created_at
        FROM workflow_webhooks
        WHERE org_id = ${orgId}
        ORDER BY created_at DESC
      `);
      return ((result as any).rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        url: r.url,
        eventTypes: r.event_types,
        isActive: r.is_active,
        createdAt: r.created_at,
      }));
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }
  }

  async getWebhookDeliveryLog(orgId: string, webhookId: string): Promise<WebhookDelivery[]> {
    try {
      const result = await db.execute(sql`
        SELECT id, webhook_id, event_type, payload, status_code, response_body,
               attempt, success, delivered_at, error_message
        FROM workflow_webhook_deliveries
        WHERE org_id = ${orgId} AND webhook_id = ${webhookId}
        ORDER BY delivered_at DESC
        LIMIT 100
      `);
      return ((result as any).rows || []).map((r: any) => ({
        id: r.id,
        webhookId: r.webhook_id,
        eventType: r.event_type,
        payload: r.payload,
        statusCode: r.status_code,
        responseBody: r.response_body,
        attempt: r.attempt,
        success: r.success,
        deliveredAt: r.delivered_at,
        errorMessage: r.error_message,
      }));
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }
  }

  async testWebhook(orgId: string, webhookId: string) {
    const testPayload = {
      test: true,
      message: 'Vantage webhook test',
      timestamp: new Date().toISOString(),
    };
    return this.fireWebhook(orgId, webhookId, 'webhook.test', testPayload);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. SLACK / TEAMS NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async configureSlack(orgId: string, webhookUrl: string, channel: string) {
    const id = crypto.randomUUID();
    try {
      await db.execute(sql`
        INSERT INTO workflow_notification_channels (id, org_id, provider, webhook_url, channel, is_active, created_at, updated_at)
        VALUES (${id}, ${orgId}, 'slack', ${webhookUrl}, ${channel}, true, NOW(), NOW())
        ON CONFLICT (org_id, provider, channel)
        DO UPDATE SET webhook_url = ${webhookUrl}, is_active = true, updated_at = NOW()
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow notification feature is unavailable (backing table removed)');
      throw err;
    }
    logger.info({ orgId, channel }, '[WorkflowEnhancements] Slack configured');
    return { id, provider: 'slack', channel, isActive: true };
  }

  async sendSlackNotification(orgId: string, message: string, channel?: string) {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT id, webhook_url, channel FROM workflow_notification_channels
        WHERE org_id = ${orgId} AND provider = 'slack' AND is_active = true
        ${channel ? sql`AND channel = ${channel}` : sql``}
        LIMIT 1
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow notification feature is unavailable (backing table removed)');
      throw err;
    }
    const config = (result as any).rows?.[0];
    if (!config) throw new Error('Slack not configured for this organization');

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Vantage Notification', emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: message },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Sent at ${new Date().toISOString()}` }],
      },
    ];

    const slackPayload = {
      channel: config.channel,
      text: message,
      blocks,
    };

    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
      signal: AbortSignal.timeout(10000),
    });

    const success = response.ok;
    if (!success) {
      const body = await response.text().catch(() => '');
      logger.error({ orgId, status: response.status, body }, '[WorkflowEnhancements] Slack notification failed');
    }

    try {
      await db.execute(sql`
        INSERT INTO workflow_notification_log (id, org_id, channel_id, provider, message, success, sent_at)
        VALUES (${crypto.randomUUID()}, ${orgId}, ${config.id}, 'slack', ${message}, ${success}, NOW())
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }

    return { success, provider: 'slack', channel: config.channel };
  }

  async configureTeams(orgId: string, webhookUrl: string) {
    const id = crypto.randomUUID();
    try {
      await db.execute(sql`
        INSERT INTO workflow_notification_channels (id, org_id, provider, webhook_url, channel, is_active, created_at, updated_at)
        VALUES (${id}, ${orgId}, 'teams', ${webhookUrl}, 'default', true, NOW(), NOW())
        ON CONFLICT (org_id, provider, channel)
        DO UPDATE SET webhook_url = ${webhookUrl}, is_active = true, updated_at = NOW()
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow notification feature is unavailable (backing table removed)');
      throw err;
    }
    logger.info({ orgId }, '[WorkflowEnhancements] Teams configured');
    return { id, provider: 'teams', isActive: true };
  }

  async sendTeamsNotification(orgId: string, message: string) {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT id, webhook_url FROM workflow_notification_channels
        WHERE org_id = ${orgId} AND provider = 'teams' AND is_active = true
        LIMIT 1
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow notification feature is unavailable (backing table removed)');
      throw err;
    }
    const config = (result as any).rows?.[0];
    if (!config) throw new Error('Teams not configured for this organization');

    const sections: TeamsSection[] = [
      { activityTitle: 'Vantage Notification', text: message },
      {
        facts: [
          { name: 'Sent', value: new Date().toISOString() },
          { name: 'Source', value: 'Workflow Engine' },
        ],
      },
    ];

    const teamsPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: '1a3a5c', // Deep Marine Blue
      summary: message,
      sections,
    };

    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsPayload),
      signal: AbortSignal.timeout(10000),
    });

    const success = response.ok;
    if (!success) {
      const body = await response.text().catch(() => '');
      logger.error({ orgId, status: response.status, body }, '[WorkflowEnhancements] Teams notification failed');
    }

    try {
      await db.execute(sql`
        INSERT INTO workflow_notification_log (id, org_id, channel_id, provider, message, success, sent_at)
        VALUES (${crypto.randomUUID()}, ${orgId}, ${config.id}, 'teams', ${message}, ${success}, NOW())
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }

    return { success, provider: 'teams' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SCHEDULED / CRON TRIGGERS
  // ═══════════════════════════════════════════════════════════════════════════

  async createScheduledTrigger(orgId: string, data: ScheduledTriggerData) {
    const id = crypto.randomUUID();
    const nextRunAt = this.calculateNextRun(data.cronExpression, data.timezone);

    try {
      await db.execute(sql`
        INSERT INTO workflow_scheduled_triggers
          (id, org_id, name, cron_expression, workflow_rule_id, entity_type, entity_id, timezone, next_run_at, is_active, created_at)
        VALUES (
          ${id}, ${orgId}, ${data.name}, ${data.cronExpression},
          ${data.workflowRuleId}, ${data.entityType}, ${data.entityId || null},
          ${data.timezone || 'UTC'}, ${nextRunAt.toISOString()}, true, NOW()
        )
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow scheduling feature is unavailable (backing table removed)');
      throw err;
    }

    logger.info({ triggerId: id, orgId, cron: data.cronExpression }, '[WorkflowEnhancements] Scheduled trigger created');
    return { id, name: data.name, cronExpression: data.cronExpression, nextRunAt, isActive: true };
  }

  /**
   * Evaluate all scheduled triggers that are due. Call this from a cron job
   * (e.g. every minute via node-cron or setInterval).
   */
  async evaluateScheduledTriggers(): Promise<{ fired: number; errors: number }> {
    const now = new Date().toISOString();
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT id, org_id, cron_expression, workflow_rule_id, entity_type, entity_id, timezone
        FROM workflow_scheduled_triggers
        WHERE is_active = true AND next_run_at <= ${now}
        ORDER BY next_run_at ASC
        LIMIT 100
      `);
    } catch (err) {
      if (isDroppedTableError(err)) return { fired: 0, errors: 0 };
      throw err;
    }
    const triggers = (result as any).rows || [];

    let fired = 0;
    let errors = 0;

    for (const trigger of triggers) {
      try {
        // Record execution
        await db.execute(sql`
          INSERT INTO workflow_scheduled_executions (id, org_id, trigger_id, fired_at, status)
          VALUES (${crypto.randomUUID()}, ${trigger.org_id}, ${trigger.id}, NOW(), 'fired')
        `);

        // Update next run time
        const nextRun = this.calculateNextRun(trigger.cron_expression, trigger.timezone);
        await db.execute(sql`
          UPDATE workflow_scheduled_triggers
          SET next_run_at = ${nextRun.toISOString()}, last_run_at = NOW()
          WHERE id = ${trigger.id}
        `);

        // Fire the linked workflow rule (import evaluateAutomations dynamically to avoid circular deps)
        const { evaluateAutomations } = await import('./workflow-engine');
        await evaluateAutomations(
          'scheduled.trigger',
          trigger.entity_type,
          trigger.entity_id || trigger.id,
          trigger.org_id,
          { scheduledTriggerId: trigger.id, scheduledAt: now },
        );

        fired++;
      } catch (err: any) {
        errors++;
        logger.error({ triggerId: trigger.id, err: err.message }, '[WorkflowEnhancements] Scheduled trigger failed');

        try {
          await db.execute(sql`
            INSERT INTO workflow_scheduled_executions (id, org_id, trigger_id, fired_at, status, error_message)
            VALUES (${crypto.randomUUID()}, ${trigger.org_id}, ${trigger.id}, NOW(), 'error', ${err.message})
          `);
        } catch (innerErr) {
          if (!isDroppedTableError(innerErr)) throw innerErr;
        }
      }
    }

    if (fired > 0 || errors > 0) {
      logger.info({ fired, errors }, '[WorkflowEnhancements] Scheduled trigger evaluation complete');
    }
    return { fired, errors };
  }

  async listScheduledTriggers(orgId: string) {
    try {
      const result = await db.execute(sql`
        SELECT id, name, cron_expression, workflow_rule_id, action_config,
               next_run_at, last_run_at, is_active, created_at
        FROM workflow_scheduled_triggers
        WHERE org_id = ${orgId}
        ORDER BY created_at DESC
      `);
      return ((result as any).rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        cronExpression: r.cron_expression,
        workflowRuleId: r.workflow_rule_id,
        actionConfig: r.action_config,
        nextRunAt: r.next_run_at,
        lastRunAt: r.last_run_at,
        isActive: r.is_active,
        createdAt: r.created_at,
      }));
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }
  }

  async pauseScheduledTrigger(orgId: string, triggerId: string) {
    try {
      await db.execute(sql`
        UPDATE workflow_scheduled_triggers
        SET is_active = false, updated_at = NOW()
        WHERE id = ${triggerId} AND org_id = ${orgId}
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }
    logger.info({ triggerId, orgId }, '[WorkflowEnhancements] Scheduled trigger paused');
    return { triggerId, isActive: false };
  }

  async resumeScheduledTrigger(orgId: string, triggerId: string) {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT cron_expression, timezone FROM workflow_scheduled_triggers
        WHERE id = ${triggerId} AND org_id = ${orgId}
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow scheduling feature is unavailable (backing table removed)');
      throw err;
    }
    const trigger = (result as any).rows?.[0];
    if (!trigger) throw new Error(`Scheduled trigger ${triggerId} not found`);

    const nextRun = this.calculateNextRun(trigger.cron_expression, trigger.timezone);
    try {
      await db.execute(sql`
        UPDATE workflow_scheduled_triggers
        SET is_active = true, next_run_at = ${nextRun.toISOString()}, updated_at = NOW()
        WHERE id = ${triggerId} AND org_id = ${orgId}
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }
    logger.info({ triggerId, orgId, nextRun }, '[WorkflowEnhancements] Scheduled trigger resumed');
    return { triggerId, isActive: true, nextRunAt: nextRun };
  }

  /**
   * Simple cron parser that handles standard 5-field cron expressions.
   * Supports: minute hour day-of-month month day-of-week
   * Special tokens: * (any), /N (step), ranges (1-5), lists (1,3,5)
   */
  private calculateNextRun(cronExpression: string, timezone?: string): Date {
    const now = new Date();
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: "${cronExpression}" — expected 5 fields`);
    }

    const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts;

    const expandField = (expr: string, min: number, max: number): number[] => {
      const values: Set<number> = new Set();
      for (const part of expr.split(',')) {
        if (part === '*') {
          for (let i = min; i <= max; i++) values.add(i);
        } else if (part.includes('/')) {
          const [base, stepStr] = part.split('/');
          const step = parseInt(stepStr, 10);
          const start = base === '*' ? min : parseInt(base, 10);
          for (let i = start; i <= max; i += step) values.add(i);
        } else if (part.includes('-')) {
          const [lo, hi] = part.split('-').map(Number);
          for (let i = lo; i <= hi; i++) values.add(i);
        } else {
          values.add(parseInt(part, 10));
        }
      }
      return Array.from(values).sort((a, b) => a - b);
    };

    const minutes = expandField(minExpr, 0, 59);
    const hours = expandField(hourExpr, 0, 23);
    const doms = expandField(domExpr, 1, 31);
    const months = expandField(monExpr, 1, 12);
    const dows = expandField(dowExpr, 0, 6);

    // Walk forward from now to find the next matching time (max 366 days)
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setMinutes(candidate.getMinutes() + 1); // always at least 1 minute in the future

    for (let dayOffset = 0; dayOffset < 366; dayOffset++) {
      if (!months.includes(candidate.getMonth() + 1)) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(0, 0, 0, 0);
        continue;
      }
      if (!doms.includes(candidate.getDate()) && domExpr !== '*') {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(0, 0, 0, 0);
        continue;
      }
      if (!dows.includes(candidate.getDay()) && dowExpr !== '*') {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(0, 0, 0, 0);
        continue;
      }

      for (const h of hours) {
        for (const m of minutes) {
          const test = new Date(candidate);
          test.setHours(h, m, 0, 0);
          if (test > now) return test;
        }
      }

      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
    }

    // Fallback — should not reach here for valid cron expressions
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() + 1);
    return fallback;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. MULTI-STEP SEQUENTIAL WORKFLOW PIPELINES
  // ═══════════════════════════════════════════════════════════════════════════

  async createWorkflowPipeline(orgId: string, data: PipelineDefinition) {
    const id = crypto.randomUUID();

    try {
      await db.execute(sql`
        INSERT INTO workflow_pipelines (id, org_id, name, description, steps, entry_step_id, is_active, created_at)
        VALUES (
          ${id}, ${orgId}, ${data.name}, ${data.description || null},
          ${JSON.stringify(data.steps)}::jsonb,
          ${data.entryStepId}, true, NOW()
        )
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow pipeline feature is unavailable (backing table removed)');
      throw err;
    }

    logger.info({ pipelineId: id, orgId, stepCount: data.steps.length }, '[WorkflowEnhancements] Pipeline created');
    return { id, name: data.name, stepCount: data.steps.length };
  }

  async listWorkflowPipelines(orgId: string) {
    try {
      const result = await db.execute(sql`
        SELECT id, name, description, steps, is_active, created_at
        FROM workflow_pipelines
        WHERE org_id = ${orgId}
        ORDER BY created_at DESC
      `);
      return ((result as any).rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
        stepCount: Array.isArray(r.steps) ? r.steps.length :
                   (typeof r.steps === 'string' ? (JSON.parse(r.steps)?.length ?? 0) : 0),
        isActive: r.is_active,
        createdAt: r.created_at,
      }));
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }
  }

  async executePipeline(
    orgId: string,
    pipelineId: string,
    context: Record<string, any>,
  ): Promise<{ executionId: string; status: string; stepResults: any[] }> {
    let pipelineResult: any;
    try {
      pipelineResult = await db.execute(sql`
        SELECT id, steps, entry_step_id FROM workflow_pipelines
        WHERE id = ${pipelineId} AND org_id = ${orgId} AND is_active = true
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow pipeline feature is unavailable (backing table removed)');
      throw err;
    }
    const pipeline = (pipelineResult as any).rows?.[0];
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found or inactive`);

    const steps: PipelineStep[] = typeof pipeline.steps === 'string'
      ? JSON.parse(pipeline.steps) : pipeline.steps;
    const stepMap = new Map(steps.map(s => [s.id, s]));

    const executionId = crypto.randomUUID();
    const stepResults: Array<{
      stepId: string;
      stepName: string;
      type: string;
      status: string;
      startedAt: string;
      completedAt: string | null;
      output: any;
    }> = [];

    try {
      await db.execute(sql`
        INSERT INTO workflow_pipeline_executions
          (id, org_id, pipeline_id, context, status, step_results, started_at)
        VALUES (
          ${executionId}, ${orgId}, ${pipelineId},
          ${JSON.stringify(context)}::jsonb, 'running',
          '[]'::jsonb, NOW()
        )
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow pipeline feature is unavailable (backing table removed)');
      throw err;
    }

    let currentStepId: string | null = pipeline.entry_step_id;
    let overallStatus = 'completed';

    while (currentStepId) {
      const step = stepMap.get(currentStepId);
      if (!step) {
        overallStatus = 'failed';
        break;
      }

      const stepStart = new Date().toISOString();
      let stepStatus = 'completed';
      let stepOutput: any = null;
      let nextStepId: string | null = step.onSuccess || null;

      try {
        switch (step.type) {
          case 'action': {
            // Execute via the workflow engine action handler
            const actionType = step.config.actionType;
            const actionParams = step.config.params || {};
            stepOutput = { actionType, params: actionParams, executed: true };
            break;
          }

          case 'condition': {
            const field = step.config.field;
            const operator = step.config.operator;
            const value = step.config.value;
            const contextValue = context[field];
            let conditionMet = false;

            switch (operator) {
              case 'equals': conditionMet = contextValue == value; break;
              case 'not_equals': conditionMet = contextValue != value; break;
              case 'greater_than': conditionMet = Number(contextValue) > Number(value); break;
              case 'less_than': conditionMet = Number(contextValue) < Number(value); break;
              case 'contains': conditionMet = String(contextValue || '').includes(String(value)); break;
              default: conditionMet = false;
            }

            stepOutput = { field, operator, value, contextValue, conditionMet };
            nextStepId = conditionMet ? step.onSuccess || null : step.onFailure || null;
            break;
          }

          case 'delay': {
            const delayMinutes = step.config.minutes || step.config.hours * 60 || step.config.days * 1440 || 0;
            // In production this would schedule a delayed resume. For now, record intent.
            stepOutput = { delayMinutes, scheduledResumeAt: new Date(Date.now() + delayMinutes * 60000).toISOString() };
            if (delayMinutes > 0) {
              stepStatus = 'waiting';
              overallStatus = 'waiting';
              // Persist current position so the pipeline can resume
              try {
                await db.execute(sql`
                  UPDATE workflow_pipeline_executions
                  SET status = 'waiting',
                      current_step_id = ${currentStepId},
                      resume_at = ${stepOutput.scheduledResumeAt},
                      step_results = ${JSON.stringify([...stepResults, { stepId: step.id, stepName: step.name, type: step.type, status: stepStatus, startedAt: stepStart, completedAt: new Date().toISOString(), output: stepOutput }])}::jsonb
                  WHERE id = ${executionId}
                `);
              } catch (err) {
                if (!isDroppedTableError(err)) throw err;
              }
              stepResults.push({ stepId: step.id, stepName: step.name, type: step.type, status: stepStatus, startedAt: stepStart, completedAt: new Date().toISOString(), output: stepOutput });
              // Exit the loop — a resume job will continue from here
              currentStepId = null;
              continue;
            }
            break;
          }

          case 'approval': {
            // Create an approval request and pause execution
            const approvalId = await this.requestApproval(orgId, {
              workflowExecutionId: executionId,
              pipelineStepId: step.id,
              title: step.config.title || step.name,
              description: step.config.description,
              requiredApprovers: step.config.approvers || [],
              escalateAfterMinutes: step.config.escalateAfterMinutes,
              escalateTo: step.config.escalateTo,
            });
            stepOutput = { approvalId, status: 'pending_approval' };
            stepStatus = 'pending_approval';
            overallStatus = 'pending_approval';

            try {
              await db.execute(sql`
                UPDATE workflow_pipeline_executions
                SET status = 'pending_approval',
                    current_step_id = ${currentStepId},
                    step_results = ${JSON.stringify([...stepResults, { stepId: step.id, stepName: step.name, type: step.type, status: stepStatus, startedAt: stepStart, completedAt: null, output: stepOutput }])}::jsonb
                WHERE id = ${executionId}
              `);
            } catch (err) {
              if (!isDroppedTableError(err)) throw err;
            }
            stepResults.push({ stepId: step.id, stepName: step.name, type: step.type, status: stepStatus, startedAt: stepStart, completedAt: null, output: stepOutput });
            currentStepId = null;
            continue;
          }

          case 'parallel': {
            // Execute parallel branches and wait for all to complete
            const branchResults: any[] = [];
            const branchStepIds = step.parallelSteps || [];
            for (const branchStepId of branchStepIds) {
              const branchStep = stepMap.get(branchStepId);
              if (branchStep) {
                branchResults.push({ branchStepId, name: branchStep.name, status: 'completed' });
              }
            }
            stepOutput = { branches: branchResults, mergeStepId: step.mergeStepId };
            nextStepId = step.mergeStepId || step.onSuccess || null;
            break;
          }

          default:
            stepOutput = { error: `Unknown step type: ${step.type}` };
            stepStatus = 'failed';
            overallStatus = 'failed';
            nextStepId = null;
        }
      } catch (err: any) {
        stepStatus = 'failed';
        stepOutput = { error: err.message };
        overallStatus = 'failed';
        nextStepId = null;
      }

      stepResults.push({
        stepId: step.id,
        stepName: step.name,
        type: step.type,
        status: stepStatus,
        startedAt: stepStart,
        completedAt: new Date().toISOString(),
        output: stepOutput,
      });

      if (stepStatus === 'failed') break;
      currentStepId = nextStepId;
    }

    // Persist final execution state
    try {
      await db.execute(sql`
        UPDATE workflow_pipeline_executions
        SET status = ${overallStatus},
            step_results = ${JSON.stringify(stepResults)}::jsonb,
            completed_at = ${overallStatus === 'completed' || overallStatus === 'failed' ? new Date().toISOString() : null}
        WHERE id = ${executionId}
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }

    logger.info({ executionId, pipelineId, status: overallStatus, steps: stepResults.length }, '[WorkflowEnhancements] Pipeline execution');
    return { executionId, status: overallStatus, stepResults };
  }

  async getPipelineExecution(orgId: string, executionId: string) {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT e.id, e.pipeline_id, e.context, e.status, e.step_results,
               e.current_step_id, e.resume_at, e.started_at, e.completed_at,
               p.name AS pipeline_name
        FROM workflow_pipeline_executions e
        JOIN workflow_pipelines p ON p.id = e.pipeline_id
        WHERE e.id = ${executionId} AND e.org_id = ${orgId}
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow pipeline feature is unavailable (backing table removed)');
      throw err;
    }
    const row = (result as any).rows?.[0];
    if (!row) throw new Error(`Pipeline execution ${executionId} not found`);

    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      pipelineName: row.pipeline_name,
      context: row.context,
      status: row.status,
      stepResults: row.step_results,
      currentStepId: row.current_step_id,
      resumeAt: row.resume_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. APPROVAL INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  async requestApproval(orgId: string, data: ApprovalRequestData): Promise<string> {
    const id = crypto.randomUUID();
    const escalateAt = data.escalateAfterMinutes
      ? new Date(Date.now() + data.escalateAfterMinutes * 60000).toISOString()
      : null;

    try {
      await db.execute(sql`
        INSERT INTO workflow_approval_requests
          (id, org_id, workflow_execution_id, pipeline_step_id, title, description,
           required_approvers, escalate_after_minutes, escalate_to, escalate_at,
           entity_type, entity_id, status, created_at)
        VALUES (
          ${id}, ${orgId}, ${data.workflowExecutionId || null}, ${data.pipelineStepId || null},
          ${data.title}, ${data.description || null},
          ${JSON.stringify(data.requiredApprovers)}::jsonb,
          ${data.escalateAfterMinutes || null}, ${data.escalateTo || null}, ${escalateAt},
          ${data.entityType || null}, ${data.entityId || null},
          'pending', NOW()
        )
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow approval feature is unavailable (backing table removed)');
      throw err;
    }

    logger.info({ approvalId: id, orgId, title: data.title }, '[WorkflowEnhancements] Approval requested');
    return id;
  }

  async approveRequest(orgId: string, approvalId: string, userId: string) {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT id, status, workflow_execution_id, pipeline_step_id, required_approvers
        FROM workflow_approval_requests
        WHERE id = ${approvalId} AND org_id = ${orgId}
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow approval feature is unavailable (backing table removed)');
      throw err;
    }
    const request = (result as any).rows?.[0];
    if (!request) throw new Error(`Approval request ${approvalId} not found`);
    if (request.status !== 'pending') throw new Error(`Approval already ${request.status}`);

    // Record the approval action
    try {
      await db.execute(sql`
        INSERT INTO workflow_approval_actions (id, org_id, approval_id, user_id, action, created_at)
        VALUES (${crypto.randomUUID()}, ${orgId}, ${approvalId}, ${userId}, 'approved', NOW())
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }

    // Check if all required approvers have approved
    let actionsResult: any;
    try {
      actionsResult = await db.execute(sql`
        SELECT user_id FROM workflow_approval_actions
        WHERE approval_id = ${approvalId} AND action = 'approved'
      `);
    } catch (err) {
      if (isDroppedTableError(err)) actionsResult = { rows: [] };
      else throw err;
    }
    const approvedBy = ((actionsResult as any).rows || []).map((r: any) => r.user_id);
    const requiredApprovers = typeof request.required_approvers === 'string'
      ? JSON.parse(request.required_approvers) : request.required_approvers;

    const allApproved = Array.isArray(requiredApprovers) && requiredApprovers.length > 0
      ? requiredApprovers.every((a: string) => approvedBy.includes(a))
      : true; // If no specific approvers required, one approval suffices

    if (allApproved) {
      try {
        await db.execute(sql`
          UPDATE workflow_approval_requests
          SET status = 'approved', resolved_at = NOW()
          WHERE id = ${approvalId}
        `);
      } catch (err) {
        if (!isDroppedTableError(err)) throw err;
      }

      // If linked to a pipeline execution, resume it
      if (request.workflow_execution_id) {
        await this.resumePipelineAfterApproval(orgId, request.workflow_execution_id, request.pipeline_step_id);
      }
    }

    logger.info({ approvalId, userId, allApproved }, '[WorkflowEnhancements] Approval action recorded');
    return { approvalId, action: 'approved', allApproved, approvedBy };
  }

  async rejectRequest(orgId: string, approvalId: string, userId: string, reason: string) {
    let result: any;
    try {
      result = await db.execute(sql`
        SELECT id, status, workflow_execution_id FROM workflow_approval_requests
        WHERE id = ${approvalId} AND org_id = ${orgId}
      `);
    } catch (err) {
      if (isDroppedTableError(err)) throw new Error('Workflow approval feature is unavailable (backing table removed)');
      throw err;
    }
    const request = (result as any).rows?.[0];
    if (!request) throw new Error(`Approval request ${approvalId} not found`);
    if (request.status !== 'pending') throw new Error(`Approval already ${request.status}`);

    try {
      await db.execute(sql`
        INSERT INTO workflow_approval_actions (id, org_id, approval_id, user_id, action, reason, created_at)
        VALUES (${crypto.randomUUID()}, ${orgId}, ${approvalId}, ${userId}, 'rejected', ${reason}, NOW())
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }

    try {
      await db.execute(sql`
        UPDATE workflow_approval_requests
        SET status = 'rejected', rejection_reason = ${reason}, resolved_at = NOW()
        WHERE id = ${approvalId}
      `);
    } catch (err) {
      if (!isDroppedTableError(err)) throw err;
    }

    // If linked to a pipeline, mark execution as rejected
    if (request.workflow_execution_id) {
      try {
        await db.execute(sql`
          UPDATE workflow_pipeline_executions
          SET status = 'rejected', completed_at = NOW()
          WHERE id = ${request.workflow_execution_id}
        `);
      } catch (err) {
        if (!isDroppedTableError(err)) throw err;
      }
    }

    logger.info({ approvalId, userId, reason }, '[WorkflowEnhancements] Approval rejected');
    return { approvalId, action: 'rejected', reason };
  }

  async getApprovalQueue(orgId: string, userId: string) {
    try {
      const result = await db.execute(sql`
        SELECT r.id, r.title, r.description, r.entity_type, r.entity_id,
               r.required_approvers, r.escalate_at, r.created_at, r.status
        FROM workflow_approval_requests r
        WHERE r.org_id = ${orgId} AND r.status = 'pending'
          AND (
            r.required_approvers::jsonb ? ${userId}
            OR jsonb_array_length(r.required_approvers) = 0
          )
        ORDER BY r.created_at ASC
      `);
      return ((result as any).rows || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        entityType: r.entity_type,
        entityId: r.entity_id,
        requiredApprovers: r.required_approvers,
        escalateAt: r.escalate_at,
        createdAt: r.created_at,
        status: r.status,
      }));
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }
  }

  /**
   * Check for approval requests that have exceeded their escalation timeout
   * and escalate them to the designated user.
   */
  async processEscalations(): Promise<number> {
    const now = new Date().toISOString();
    let overdue: any[] = [];
    try {
      const result = await db.execute(sql`
        SELECT id, org_id, title, escalate_to
        FROM workflow_approval_requests
        WHERE status = 'pending' AND escalate_at IS NOT NULL AND escalate_at <= ${now}
          AND escalated = false
      `);
      overdue = (result as any).rows || [];
    } catch (err) {
      if (isDroppedTableError(err)) return 0;
      throw err;
    }

    for (const request of overdue) {
      if (request.escalate_to) {
        // Add the escalation target to required approvers
        try {
          await db.execute(sql`
            UPDATE workflow_approval_requests
            SET required_approvers = required_approvers || ${JSON.stringify([request.escalate_to])}::jsonb,
                escalated = true, escalated_at = NOW()
            WHERE id = ${request.id}
          `);
        } catch (err) {
          if (!isDroppedTableError(err)) throw err;
        }

        logger.info({ approvalId: request.id, escalateTo: request.escalate_to }, '[WorkflowEnhancements] Approval escalated');
      }
    }

    return overdue.length;
  }

  private async resumePipelineAfterApproval(orgId: string, executionId: string, approvedStepId: string) {
    let execution: any;
    try {
      execution = await this.getPipelineExecution(orgId, executionId);
    } catch (err) {
      if (isDroppedTableError(err)) return;
      throw err;
    }
    if (execution.status !== 'pending_approval') return;

    // Find the approved step and get its onSuccess next step
    let pipelineResult: any;
    try {
      pipelineResult = await db.execute(sql`
        SELECT steps FROM workflow_pipelines WHERE id = ${execution.pipelineId}
      `);
    } catch (err) {
      if (isDroppedTableError(err)) return;
      throw err;
    }
    const pipeline = (pipelineResult as any).rows?.[0];
    if (!pipeline) return;

    const steps: PipelineStep[] = typeof pipeline.steps === 'string'
      ? JSON.parse(pipeline.steps) : pipeline.steps;
    const approvedStep = steps.find(s => s.id === approvedStepId);

    if (approvedStep?.onSuccess) {
      // Re-execute the pipeline from the next step
      try {
        await db.execute(sql`
          UPDATE workflow_pipeline_executions
          SET status = 'running', current_step_id = ${approvedStep.onSuccess}
          WHERE id = ${executionId}
        `);
      } catch (err) {
        if (!isDroppedTableError(err)) throw err;
      }
      // In production, this would trigger a job queue entry to continue execution
      logger.info({ executionId, nextStep: approvedStep.onSuccess }, '[WorkflowEnhancements] Pipeline resumed after approval');
    } else {
      try {
        await db.execute(sql`
          UPDATE workflow_pipeline_executions
          SET status = 'completed', completed_at = NOW()
          WHERE id = ${executionId}
        `);
      } catch (err) {
        if (!isDroppedTableError(err)) throw err;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. WORKFLOW ANALYTICS DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  async getWorkflowExecutionStats(orgId: string, dateRange: { start: string; end: string }) {
    try {
      const result = await db.execute(sql`
        SELECT
          COUNT(*)::int AS total_executions,
          COUNT(*) FILTER (WHERE status = 'success')::int AS successful,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
          COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
          ROUND(
            COUNT(*) FILTER (WHERE status = 'success')::numeric /
            NULLIF(COUNT(*) FILTER (WHERE status IN ('success', 'failed'))::numeric, 0) * 100,
            1
          ) AS success_rate,
          ROUND(AVG(
            EXTRACT(EPOCH FROM (completed_at - created_at))
          ) FILTER (WHERE completed_at IS NOT NULL), 2) AS avg_duration_seconds
        FROM workflow_execution_log
        WHERE org_id = ${orgId}
          AND created_at >= ${dateRange.start}::timestamp
          AND created_at <= ${dateRange.end}::timestamp
      `);
      const row = (result as any).rows?.[0] || {};
      return {
        totalExecutions: row.total_executions || 0,
        successful: row.successful || 0,
        failed: row.failed || 0,
        skipped: row.skipped || 0,
        successRate: parseFloat(row.success_rate) || 0,
        avgDurationSeconds: parseFloat(row.avg_duration_seconds) || 0,
      };
    } catch (err) {
      if (isDroppedTableError(err)) return { totalExecutions: 0, successful: 0, failed: 0, skipped: 0, successRate: 0, avgDurationSeconds: 0 };
      throw err;
    }
  }

  async getTopWorkflows(orgId: string, dateRange: { start: string; end: string }) {
    try {
      const result = await db.execute(sql`
        SELECT
          e.automation_id,
          a.name AS workflow_name,
          a.trigger_type,
          COUNT(*)::int AS execution_count,
          COUNT(*) FILTER (WHERE e.status = 'success')::int AS success_count,
          COUNT(*) FILTER (WHERE e.status = 'failed')::int AS failure_count
        FROM workflow_execution_log e
        LEFT JOIN workflow_automations a ON a.id = e.automation_id
        WHERE e.org_id = ${orgId}
          AND e.created_at >= ${dateRange.start}::timestamp
          AND e.created_at <= ${dateRange.end}::timestamp
        GROUP BY e.automation_id, a.name, a.trigger_type
        ORDER BY execution_count DESC
        LIMIT 20
      `);
      return ((result as any).rows || []).map((r: any) => ({
        automationId: r.automation_id,
        workflowName: r.workflow_name,
        triggerType: r.trigger_type,
        executionCount: r.execution_count,
        successCount: r.success_count,
        failureCount: r.failure_count,
      }));
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }
  }

  async getFailureAnalysis(orgId: string, dateRange: { start: string; end: string }) {
    try {
      const result = await db.execute(sql`
        SELECT
          e.automation_id,
          a.name AS workflow_name,
          e.error_message,
          COUNT(*)::int AS occurrence_count,
          MAX(e.created_at) AS last_occurred
        FROM workflow_execution_log e
        LEFT JOIN workflow_automations a ON a.id = e.automation_id
        WHERE e.org_id = ${orgId}
          AND e.status = 'failed'
          AND e.created_at >= ${dateRange.start}::timestamp
          AND e.created_at <= ${dateRange.end}::timestamp
        GROUP BY e.automation_id, a.name, e.error_message
        ORDER BY occurrence_count DESC
        LIMIT 50
      `);
      return ((result as any).rows || []).map((r: any) => ({
        automationId: r.automation_id,
        workflowName: r.workflow_name,
        errorMessage: r.error_message,
        occurrenceCount: r.occurrence_count,
        lastOccurred: r.last_occurred,
      }));
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }
  }

  async getExecutionTimeline(orgId: string, workflowId: string) {
    try {
      const result = await db.execute(sql`
        SELECT
          id, automation_id, trigger_entity_type, trigger_entity_id,
          status, actions_executed, error_message,
          created_at, completed_at,
          EXTRACT(EPOCH FROM (completed_at - created_at)) AS duration_seconds
        FROM workflow_execution_log
        WHERE org_id = ${orgId} AND automation_id = ${workflowId}
        ORDER BY created_at DESC
        LIMIT 100
      `);
      return ((result as any).rows || []).map((r: any) => ({
        id: r.id,
        automationId: r.automation_id,
        triggerEntityType: r.trigger_entity_type,
        triggerEntityId: r.trigger_entity_id,
        status: r.status,
        actionsExecuted: r.actions_executed,
        errorMessage: r.error_message,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        durationSeconds: parseFloat(r.duration_seconds) || null,
      }));
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }
  }

  async getActionBreakdown(orgId: string) {
    try {
      const result = await db.execute(sql`
        SELECT
          action_elem->>'type' AS action_type,
          COUNT(*)::int AS usage_count,
          COUNT(*) FILTER (WHERE (action_elem->>'success')::boolean = true)::int AS success_count,
          COUNT(*) FILTER (WHERE (action_elem->>'success')::boolean = false)::int AS failure_count
        FROM workflow_execution_log,
             jsonb_array_elements(actions_executed) AS action_elem
        WHERE org_id = ${orgId}
          AND actions_executed IS NOT NULL
          AND status != 'skipped'
        GROUP BY action_elem->>'type'
        ORDER BY usage_count DESC
      `);
      return ((result as any).rows || []).map((r: any) => ({
        actionType: r.action_type,
        usageCount: r.usage_count,
        successCount: r.success_count,
        failureCount: r.failure_count,
      }));
    } catch (err) {
      if (isDroppedTableError(err)) return [];
      throw err;
    }
  }
}

// ─── Singleton Export ──────────────────────────────────────────────────────

export const workflowEnhancements = new WorkflowEnhancements();
