import { Router } from 'express';
import { db } from '../db';
import {
  crmCampaigns,
  crmWebhooks,
  crmWebhookLogs,
  crmDedupeRules,
  crmMergeHistory,
  crmAiConversations,
  crmAiMessages,
  crmContacts,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

const router = Router();

// ─── Campaigns ──────────────────────────────────────────────────────────────

router.get('/campaigns', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions: any[] = [eq(crmCampaigns.orgId, orgId)];
    if (status) conditions.push(eq(crmCampaigns.status, status));
    if (type) conditions.push(eq(crmCampaigns.type, type));

    const campaigns = await db
      .select()
      .from(crmCampaigns)
      .where(and(...conditions))
      .orderBy(desc(crmCampaigns.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmCampaigns)
      .where(and(...conditions));

    res.json({ campaigns, total: count });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [campaign] = await db
      .insert(crmCampaigns)
      .values({
        ...req.body,
        orgId,
        createdById: user?.userId || user?.id,
      })
      .returning();

    res.status(201).json(campaign);
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/campaigns/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [campaign] = await db
      .select()
      .from(crmCampaigns)
      .where(and(eq(crmCampaigns.id, req.params.id), eq(crmCampaigns.orgId, orgId)));

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (error: any) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/campaigns/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [campaign] = await db
      .update(crmCampaigns)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(crmCampaigns.id, req.params.id), eq(crmCampaigns.orgId, orgId)))
      .returning();

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (error: any) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/campaigns/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [deleted] = await db
      .delete(crmCampaigns)
      .where(and(eq(crmCampaigns.id, req.params.id), eq(crmCampaigns.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Webhooks ───────────────────────────────────────────────────────────────

router.get('/webhooks', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const webhooks = await db
      .select()
      .from(crmWebhooks)
      .where(eq(crmWebhooks.orgId, orgId))
      .orderBy(desc(crmWebhooks.createdAt));

    res.json(webhooks);
  } catch (error: any) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/webhooks', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [webhook] = await db
      .insert(crmWebhooks)
      .values({
        ...req.body,
        orgId,
        ownerId: user?.userId || user?.id,
      })
      .returning();

    res.status(201).json(webhook);
  } catch (error: any) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/webhooks/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [webhook] = await db
      .update(crmWebhooks)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(crmWebhooks.id, req.params.id), eq(crmWebhooks.orgId, orgId)))
      .returning();

    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });
    res.json(webhook);
  } catch (error: any) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/webhooks/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [deleted] = await db
      .delete(crmWebhooks)
      .where(and(eq(crmWebhooks.id, req.params.id), eq(crmWebhooks.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Webhook not found' });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/webhooks/:id/test', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [webhook] = await db
      .select()
      .from(crmWebhooks)
      .where(and(eq(crmWebhooks.id, req.params.id), eq(crmWebhooks.orgId, orgId)));

    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook delivery' },
    };

    const startTime = Date.now();
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let errorMessage: string | null = null;
    let success = false;

    try {
      const response = await fetch(webhook.url, {
        method: webhook.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(webhook.headers as Record<string, string> || {}),
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });
      statusCode = response.status;
      responseBody = await response.text();
      success = response.ok;
    } catch (err: any) {
      errorMessage = err.message;
    }

    const responseTime = Date.now() - startTime;

    // Log the test call
    const [log] = await db
      .insert(crmWebhookLogs)
      .values({
        webhookId: webhook.id,
        event: 'webhook.test',
        payload: testPayload,
        statusCode,
        responseBody,
        responseTime,
        errorMessage,
        success,
        orgId,
      })
      .returning();

    // Update webhook stats
    await db
      .update(crmWebhooks)
      .set({
        totalCalls: sql`${crmWebhooks.totalCalls} + 1`,
        ...(success
          ? { successfulCalls: sql`${crmWebhooks.successfulCalls} + 1` }
          : { failedCalls: sql`${crmWebhooks.failedCalls} + 1` }),
        lastCalledAt: new Date(),
        lastStatus: statusCode,
        updatedAt: new Date(),
      })
      .where(eq(crmWebhooks.id, webhook.id));

    res.json({ success, log });
  } catch (error: any) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Webhook Logs ───────────────────────────────────────────────────────────

router.get('/webhook-logs/:webhookId', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await db
      .select()
      .from(crmWebhookLogs)
      .where(
        and(
          eq(crmWebhookLogs.webhookId, req.params.webhookId),
          eq(crmWebhookLogs.orgId, orgId)
        )
      )
      .orderBy(desc(crmWebhookLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmWebhookLogs)
      .where(
        and(
          eq(crmWebhookLogs.webhookId, req.params.webhookId),
          eq(crmWebhookLogs.orgId, orgId)
        )
      );

    res.json({ logs, total: count });
  } catch (error: any) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Dedupe Rules ───────────────────────────────────────────────────────────

router.get('/dedupe-rules', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const rules = await db
      .select()
      .from(crmDedupeRules)
      .where(eq(crmDedupeRules.orgId, orgId))
      .orderBy(desc(crmDedupeRules.createdAt));

    res.json(rules);
  } catch (error: any) {
    console.error('Error fetching dedupe rules:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/dedupe-rules', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [rule] = await db
      .insert(crmDedupeRules)
      .values({
        ...req.body,
        orgId,
        ownerId: user?.userId || user?.id,
      })
      .returning();

    res.status(201).json(rule);
  } catch (error: any) {
    console.error('Error creating dedupe rule:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/dedupe-rules/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [rule] = await db
      .update(crmDedupeRules)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(crmDedupeRules.id, req.params.id), eq(crmDedupeRules.orgId, orgId)))
      .returning();

    if (!rule) return res.status(404).json({ error: 'Dedupe rule not found' });
    res.json(rule);
  } catch (error: any) {
    console.error('Error updating dedupe rule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scan for duplicates based on a rule
router.post('/dedupe/scan', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { ruleId } = req.body;

    // Fetch the rule
    const [rule] = await db
      .select()
      .from(crmDedupeRules)
      .where(and(eq(crmDedupeRules.id, ruleId), eq(crmDedupeRules.orgId, orgId)));

    if (!rule) return res.status(404).json({ error: 'Dedupe rule not found' });

    const matchFields = rule.matchFields as string[];
    const entityType = rule.entityType;

    // Currently supports contact deduplication
    if (entityType === 'contact') {
      // Build a query that groups contacts by the match fields and finds duplicates
      const fieldExpressions = matchFields.map((field: string) => {
        if (rule.caseSensitive) {
          return sql.raw(`"${field}"`);
        }
        return sql.raw(`lower("${field}")`);
      });

      // Use a simpler approach: fetch all contacts and group in memory for flexibility
      const contacts = await db
        .select()
        .from(crmContacts)
        .where(eq(crmContacts.orgId, orgId));

      // Group by match fields
      const groups = new Map<string, any[]>();
      for (const contact of contacts) {
        const key = matchFields
          .map((f: string) => {
            const val = (contact as any)[f];
            if (val == null) return '';
            return rule.caseSensitive ? String(val) : String(val).toLowerCase();
          })
          .join('|');

        if (!key || key === matchFields.map(() => '').join('|')) continue; // skip empty keys
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(contact);
      }

      // Filter to only groups with duplicates
      const duplicates = Array.from(groups.entries())
        .filter(([_, records]) => records.length > 1)
        .map(([key, records]) => ({
          matchKey: key,
          matchFields,
          records,
          count: records.length,
        }));

      res.json({ duplicates, totalGroups: duplicates.length });
    } else {
      res.status(400).json({ error: `Deduplication for entity type '${entityType}' is not yet supported` });
    }
  } catch (error: any) {
    console.error('Error scanning for duplicates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Merge duplicate records
router.post('/dedupe/merge', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { primaryRecordId, mergedRecordIds, entityType, fieldOverrides, dedupeRuleId } = req.body;

    if (!primaryRecordId || !mergedRecordIds?.length || !entityType) {
      return res.status(400).json({ error: 'primaryRecordId, mergedRecordIds, and entityType are required' });
    }

    if (entityType === 'contact') {
      // Fetch the primary record
      const [primary] = await db
        .select()
        .from(crmContacts)
        .where(and(eq(crmContacts.id, primaryRecordId), eq(crmContacts.orgId, orgId)));

      if (!primary) return res.status(404).json({ error: 'Primary record not found' });

      // If field overrides are provided, update the primary record with merged field values
      if (fieldOverrides && Object.keys(fieldOverrides).length > 0) {
        await db
          .update(crmContacts)
          .set({ ...fieldOverrides, updatedAt: new Date() })
          .where(eq(crmContacts.id, primaryRecordId));
      }

      // Delete merged records
      for (const mergedId of mergedRecordIds) {
        await db
          .delete(crmContacts)
          .where(and(eq(crmContacts.id, mergedId), eq(crmContacts.orgId, orgId)));
      }

      // Record merge history
      const [history] = await db
        .insert(crmMergeHistory)
        .values({
          entityType,
          primaryRecordId,
          mergedRecordIds,
          fieldsMerged: fieldOverrides || {},
          conflictResolutions: req.body.conflictResolutions || {},
          mergedBy: user?.userId || user?.id,
          dedupeRuleId: dedupeRuleId || null,
          ownerId: user?.userId || user?.id,
        })
        .returning();

      res.json({ success: true, mergeHistory: history });
    } else {
      res.status(400).json({ error: `Merge for entity type '${entityType}' is not yet supported` });
    }
  } catch (error: any) {
    console.error('Error merging records:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Merge History ──────────────────────────────────────────────────────────

router.get('/merge-history', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const entityType = req.query.entityType as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // crmMergeHistory doesn't have orgId, so we filter by ownerId belonging to the org
    const conditions: any[] = [eq(crmMergeHistory.ownerId, user?.userId || user?.id)];
    if (entityType) conditions.push(eq(crmMergeHistory.entityType, entityType));

    const history = await db
      .select()
      .from(crmMergeHistory)
      .where(and(...conditions))
      .orderBy(desc(crmMergeHistory.mergedAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmMergeHistory)
      .where(and(...conditions));

    res.json({ history, total: count });
  } catch (error: any) {
    console.error('Error fetching merge history:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── AI Conversations & Messages ────────────────────────────────────────────

router.get('/ai/conversations', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const conversations = await db
      .select()
      .from(crmAiConversations)
      .where(
        and(
          eq(crmAiConversations.orgId, orgId),
          eq(crmAiConversations.ownerId, user?.userId || user?.id),
          eq(crmAiConversations.isActive, true)
        )
      )
      .orderBy(desc(crmAiConversations.updatedAt))
      .limit(limit)
      .offset(offset);

    res.json(conversations);
  } catch (error: any) {
    console.error('Error fetching AI conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/conversations', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const [conversation] = await db
      .insert(crmAiConversations)
      .values({
        title: req.body.title || 'New Conversation',
        contextType: req.body.contextType || 'general',
        contextId: req.body.contextId,
        contextData: req.body.contextData,
        provider: req.body.provider || 'openai',
        model: req.body.model || 'gpt-4o',
        ownerId: user?.userId || user?.id,
        orgId,
      })
      .returning();

    res.status(201).json(conversation);
  } catch (error: any) {
    console.error('Error creating AI conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/ai/conversations/:id/messages', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Verify conversation belongs to user/org
    const [conversation] = await db
      .select()
      .from(crmAiConversations)
      .where(
        and(
          eq(crmAiConversations.id, req.params.id),
          eq(crmAiConversations.orgId, orgId),
          eq(crmAiConversations.ownerId, user?.userId || user?.id)
        )
      );

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const messages = await db
      .select()
      .from(crmAiMessages)
      .where(eq(crmAiMessages.conversationId, req.params.id))
      .orderBy(crmAiMessages.createdAt);

    res.json(messages);
  } catch (error: any) {
    console.error('Error fetching AI messages:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/ai/conversations/:id/messages', async (req, res) => {
  try {
    const user = (req as any).user;
    const orgId = (req as any).orgId || user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Verify conversation belongs to user/org
    const [conversation] = await db
      .select()
      .from(crmAiConversations)
      .where(
        and(
          eq(crmAiConversations.id, req.params.id),
          eq(crmAiConversations.orgId, orgId),
          eq(crmAiConversations.ownerId, user?.userId || user?.id)
        )
      );

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const [message] = await db
      .insert(crmAiMessages)
      .values({
        conversationId: req.params.id,
        role: req.body.role || 'user',
        content: req.body.content,
        functionCall: req.body.functionCall,
        functionResult: req.body.functionResult,
        toolCalls: req.body.toolCalls,
        toolResults: req.body.toolResults,
        tokenCount: req.body.tokenCount,
        model: req.body.model || conversation.model,
        finishReason: req.body.finishReason,
        orgId,
      })
      .returning();

    // Update conversation's lastMessageAt
    await db
      .update(crmAiConversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(crmAiConversations.id, req.params.id));

    res.status(201).json(message);
  } catch (error: any) {
    console.error('Error creating AI message:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
