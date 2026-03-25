/**
 * Reporting & Quick Win Features Routes
 *
 * Sections 8.1-8.4 (Reporting): Board packages, pipeline reports, quarterly reports, branding
 * Sections 9.1-9.5 (Quick Wins): Notifications, e-signatures, webhooks, custom deal stages
 * Section 10.6: Email send integration
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

export const reportingQuickWinsRouter = Router();

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

// ── 8.1-8.3 Board Package / Reports ────────────────────────────────────

// POST /reports/board-package — generate board package config
reportingQuickWinsRouter.post('/reports/board-package', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { period, includeDeals } = req.body;
    if (!period) return res.status(400).json({ error: 'Period is required' });

    const db = await getDb();
    const schema = await getSchema();

    // Aggregate deal data for board package
    let dealsQuery = db
      .select()
      .from(schema.crmDeals)
      .where(eq(schema.crmDeals.orgId, orgId));

    let deals;
    if (includeDeals && includeDeals.length > 0) {
      deals = await db
        .select()
        .from(schema.crmDeals)
        .where(and(
          eq(schema.crmDeals.orgId, orgId),
          inArray(schema.crmDeals.id, includeDeals)
        ));
    } else {
      deals = await dealsQuery;
    }

    // Compute aggregated metrics
    const totalValue = deals.reduce((sum: number, d: any) => sum + (parseFloat(d.value || '0') || 0), 0);
    const avgProbability = deals.length > 0
      ? deals.reduce((sum: number, d: any) => sum + (d.probability || 0), 0) / deals.length
      : 0;

    const stageBreakdown: Record<string, { count: number; value: number }> = {};
    for (const deal of deals) {
      const stage = deal.stage || 'unknown';
      if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0 };
      stageBreakdown[stage].count++;
      stageBreakdown[stage].value += parseFloat(deal.value || '0') || 0;
    }

    res.json({
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalDeals: deals.length,
        totalValue,
        avgProbability: Math.round(avgProbability),
        stageBreakdown,
      },
      deals,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reports/pipeline — pipeline report: deals aggregated by stage
reportingQuickWinsRouter.get('/reports/pipeline', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const results = await db
      .select({
        stage: schema.crmDeals.stage,
        count: sql<number>`count(*)::int`,
        totalValue: sql<string>`coalesce(sum(${schema.crmDeals.value}), 0)`,
        weightedValue: sql<string>`coalesce(sum(${schema.crmDeals.value} * ${schema.crmDeals.probability} / 100), 0)`,
      })
      .from(schema.crmDeals)
      .where(eq(schema.crmDeals.orgId, orgId))
      .groupBy(schema.crmDeals.stage);

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /reports/quarterly/:dealId — quarterly report data for a deal
reportingQuickWinsRouter.get('/reports/quarterly/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [deal] = await db
      .select()
      .from(schema.crmDeals)
      .where(and(
        eq(schema.crmDeals.id, req.params.dealId),
        eq(schema.crmDeals.orgId, orgId)
      ))
      .limit(1);

    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    // Gather associated contacts
    const contacts = await db
      .select()
      .from(schema.crmContacts)
      .where(and(
        eq(schema.crmContacts.orgId, orgId),
        eq(schema.crmContacts.dealAssignment, deal.id)
      ));

    res.json({
      deal,
      contacts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── 8.4 White-Label Branding ────────────────────────────────────────────

// GET /branding — get org branding
reportingQuickWinsRouter.get('/branding', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [branding] = await db
      .select()
      .from(schema.orgBranding)
      .where(eq(schema.orgBranding.orgId, orgId))
      .limit(1);

    res.json(branding || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /branding — update org branding
reportingQuickWinsRouter.put('/branding', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [existing] = await db
      .select()
      .from(schema.orgBranding)
      .where(eq(schema.orgBranding.orgId, orgId))
      .limit(1);

    const data = { ...req.body, orgId };

    let result;
    if (existing) {
      [result] = await db
        .update(schema.orgBranding)
        .set(data)
        .where(eq(schema.orgBranding.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(schema.orgBranding)
        .values(data)
        .returning();
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── 9.1 Notifications ──────────────────────────────────────────────────

// GET /notifications — list user's notifications
reportingQuickWinsRouter.get('/notifications', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(400).json({ error: 'Authentication required' });

    const db = await getDb();
    const schema = await getSchema();

    const conditions = [
      eq(schema.userNotifications.userId, userId),
      eq(schema.userNotifications.orgId, orgId),
    ];

    if (req.query.unread === 'true') {
      conditions.push(eq(schema.userNotifications.isRead, false));
    }

    const notifications = await db
      .select()
      .from(schema.userNotifications)
      .where(and(...conditions))
      .orderBy(desc(schema.userNotifications.createdAt));

    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /notifications/:id/read — mark notification as read
reportingQuickWinsRouter.put('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(400).json({ error: 'Authentication required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(schema.userNotifications.id, req.params.id),
        eq(schema.userNotifications.userId, userId),
        eq(schema.userNotifications.orgId, orgId)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /notifications/mark-all-read — mark all as read
reportingQuickWinsRouter.post('/notifications/mark-all-read', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(400).json({ error: 'Authentication required' });

    const db = await getDb();
    const schema = await getSchema();

    const result = await db
      .update(schema.userNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(schema.userNotifications.userId, userId),
        eq(schema.userNotifications.orgId, orgId),
        eq(schema.userNotifications.isRead, false)
      ))
      .returning();

    res.json({ updated: result.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /notification-preferences — get user's notification preferences
reportingQuickWinsRouter.get('/notification-preferences', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(400).json({ error: 'Authentication required' });

    const db = await getDb();
    const schema = await getSchema();

    const prefs = await db
      .select()
      .from(schema.notificationPreferences)
      .where(and(
        eq(schema.notificationPreferences.userId, userId),
        eq(schema.notificationPreferences.orgId, orgId)
      ));

    res.json(prefs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /notification-preferences — save/update preferences (upsert by alertType)
reportingQuickWinsRouter.post('/notification-preferences', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(400).json({ error: 'Authentication required' });

    const { alertType, inApp, email, sms } = req.body;
    if (!alertType) return res.status(400).json({ error: 'alertType is required' });

    const db = await getDb();
    const schema = await getSchema();

    // Check if preference exists for this alertType
    const [existing] = await db
      .select()
      .from(schema.notificationPreferences)
      .where(and(
        eq(schema.notificationPreferences.userId, userId),
        eq(schema.notificationPreferences.orgId, orgId),
        eq(schema.notificationPreferences.alertType, alertType)
      ))
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(schema.notificationPreferences)
        .set({ inApp, email, sms, updatedAt: new Date() })
        .where(eq(schema.notificationPreferences.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(schema.notificationPreferences)
        .values({ userId, orgId, alertType, inApp, email, sms })
        .returning();
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── 9.2 E-Signature ────────────────────────────────────────────────────

// POST /signatures — create signature request
reportingQuickWinsRouter.post('/signatures', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [result] = await db
      .insert(schema.signatureRequests)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /signatures — list for org (filter by dealId)
reportingQuickWinsRouter.get('/signatures', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const conditions = [eq(schema.signatureRequests.orgId, orgId)];
    if (req.query.dealId) {
      conditions.push(eq(schema.signatureRequests.dealId, req.query.dealId as string));
    }

    const signatures = await db
      .select()
      .from(schema.signatureRequests)
      .where(and(...conditions))
      .orderBy(desc(schema.signatureRequests.createdAt));

    res.json(signatures);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /signatures/:id — get single
reportingQuickWinsRouter.get('/signatures/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [sig] = await db
      .select()
      .from(schema.signatureRequests)
      .where(and(
        eq(schema.signatureRequests.id, req.params.id),
        eq(schema.signatureRequests.orgId, orgId)
      ))
      .limit(1);

    if (!sig) return res.status(404).json({ error: 'Signature request not found' });
    res.json(sig);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /signatures/:id — update (status changes from webhook callbacks)
reportingQuickWinsRouter.put('/signatures/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.signatureRequests)
      .set(req.body)
      .where(and(
        eq(schema.signatureRequests.id, req.params.id),
        eq(schema.signatureRequests.orgId, orgId)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Signature request not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── 9.3 Webhooks ────────────────────────────────────────────────────────

// GET /webhooks — list webhook endpoints for org
reportingQuickWinsRouter.get('/webhooks', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const webhooks = await db
      .select()
      .from(schema.webhookEndpoints)
      .where(eq(schema.webhookEndpoints.orgId, orgId))
      .orderBy(desc(schema.webhookEndpoints.createdAt));

    res.json(webhooks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /webhooks — create webhook endpoint
reportingQuickWinsRouter.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [result] = await db
      .insert(schema.webhookEndpoints)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /webhooks/:id — update
reportingQuickWinsRouter.put('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.webhookEndpoints)
      .set(req.body)
      .where(and(
        eq(schema.webhookEndpoints.id, req.params.id),
        eq(schema.webhookEndpoints.orgId, orgId)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Webhook endpoint not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /webhooks/:id — delete
reportingQuickWinsRouter.delete('/webhooks/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [deleted] = await db
      .delete(schema.webhookEndpoints)
      .where(and(
        eq(schema.webhookEndpoints.id, req.params.id),
        eq(schema.webhookEndpoints.orgId, orgId)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Webhook endpoint not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /webhooks/:id/deliveries — list recent deliveries
reportingQuickWinsRouter.get('/webhooks/:id/deliveries', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    // Verify webhook belongs to org
    const [webhook] = await db
      .select()
      .from(schema.webhookEndpoints)
      .where(and(
        eq(schema.webhookEndpoints.id, req.params.id),
        eq(schema.webhookEndpoints.orgId, orgId)
      ))
      .limit(1);

    if (!webhook) return res.status(404).json({ error: 'Webhook endpoint not found' });

    const deliveries = await db
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.webhookId, req.params.id))
      .orderBy(desc(schema.webhookDeliveries.createdAt))
      .limit(50);

    res.json(deliveries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /webhooks/test/:id — send test payload
reportingQuickWinsRouter.post('/webhooks/test/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [webhook] = await db
      .select()
      .from(schema.webhookEndpoints)
      .where(and(
        eq(schema.webhookEndpoints.id, req.params.id),
        eq(schema.webhookEndpoints.orgId, orgId)
      ))
      .limit(1);

    if (!webhook) return res.status(404).json({ error: 'Webhook endpoint not found' });

    const testPayload = {
      event: 'test.ping',
      timestamp: new Date().toISOString(),
      data: { message: 'Test webhook delivery' },
    };

    let responseStatus = 0;
    let responseBody = '';
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });
      responseStatus = response.status;
      responseBody = await response.text();
    } catch (fetchError: any) {
      responseBody = fetchError.message;
    }

    // Record delivery
    const [delivery] = await db
      .insert(schema.webhookDeliveries)
      .values({
        webhookId: webhook.id,
        event: 'test.ping',
        payload: testPayload,
        responseStatus,
        responseBody,
        deliveredAt: new Date(),
      })
      .returning();

    res.json(delivery);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── 9.5 Custom Deal Stages ─────────────────────────────────────────────

// GET /stage-configs — list stage configs for org
reportingQuickWinsRouter.get('/stage-configs', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const configs = await db
      .select()
      .from(schema.dealStageConfigs)
      .where(eq(schema.dealStageConfigs.orgId, orgId))
      .orderBy(desc(schema.dealStageConfigs.createdAt));

    res.json(configs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /stage-configs — create stage config
reportingQuickWinsRouter.post('/stage-configs', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { assetClass, stages } = req.body;
    if (!assetClass || !stages) return res.status(400).json({ error: 'assetClass and stages are required' });

    const db = await getDb();
    const schema = await getSchema();

    const [result] = await db
      .insert(schema.dealStageConfigs)
      .values({ orgId, assetClass, stages })
      .returning();

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /stage-configs/:id — update
reportingQuickWinsRouter.put('/stage-configs/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.dealStageConfigs)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(
        eq(schema.dealStageConfigs.id, req.params.id),
        eq(schema.dealStageConfigs.orgId, orgId)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Stage config not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /stage-configs/:id — delete
reportingQuickWinsRouter.delete('/stage-configs/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [deleted] = await db
      .delete(schema.dealStageConfigs)
      .where(and(
        eq(schema.dealStageConfigs.id, req.params.id),
        eq(schema.dealStageConfigs.orgId, orgId)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Stage config not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /stage-configs/:assetClass — get config for specific asset class (falls back to 'all')
reportingQuickWinsRouter.get('/stage-configs/:assetClass', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    // Try exact asset class first
    let [config] = await db
      .select()
      .from(schema.dealStageConfigs)
      .where(and(
        eq(schema.dealStageConfigs.orgId, orgId),
        eq(schema.dealStageConfigs.assetClass, req.params.assetClass)
      ))
      .limit(1);

    // Fall back to 'all' if no specific config found
    if (!config) {
      [config] = await db
        .select()
        .from(schema.dealStageConfigs)
        .where(and(
          eq(schema.dealStageConfigs.orgId, orgId),
          eq(schema.dealStageConfigs.assetClass, 'all')
        ))
        .limit(1);
    }

    res.json(config || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── 10.6 Email Send Integration ─────────────────────────────────────────

// POST /emails — create/send email
reportingQuickWinsRouter.post('/emails', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(400).json({ error: 'Authentication required' });

    const { toContactId, subject, bodyHtml, dealId, scheduledAt } = req.body;
    if (!toContactId || !subject) return res.status(400).json({ error: 'toContactId and subject are required' });

    const db = await getDb();
    const schema = await getSchema();

    // Resolve contact email
    const [contact] = await db
      .select()
      .from(schema.crmContacts)
      .where(and(
        eq(schema.crmContacts.id, toContactId),
        eq(schema.crmContacts.orgId, orgId)
      ))
      .limit(1);

    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    const status = scheduledAt ? 'scheduled' : 'sent';
    const sentAt = scheduledAt ? null : new Date();

    const [result] = await db
      .insert(schema.emailMessages)
      .values({
        orgId,
        fromUserId: userId,
        toContactId,
        toEmail: contact.email,
        subject,
        bodyHtml,
        dealId: dealId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status,
        sentAt,
      })
      .returning();

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /emails — list sent emails (filter by dealId, contactId)
reportingQuickWinsRouter.get('/emails', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const conditions = [eq(schema.emailMessages.orgId, orgId)];
    if (req.query.dealId) {
      conditions.push(eq(schema.emailMessages.dealId, req.query.dealId as string));
    }
    if (req.query.contactId) {
      conditions.push(eq(schema.emailMessages.toContactId, req.query.contactId as string));
    }

    const emails = await db
      .select()
      .from(schema.emailMessages)
      .where(and(...conditions))
      .orderBy(desc(schema.emailMessages.createdAt));

    res.json(emails);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /emails/:id — get email detail
reportingQuickWinsRouter.get('/emails/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [email] = await db
      .select()
      .from(schema.emailMessages)
      .where(and(
        eq(schema.emailMessages.id, req.params.id),
        eq(schema.emailMessages.orgId, orgId)
      ))
      .limit(1);

    if (!email) return res.status(404).json({ error: 'Email not found' });
    res.json(email);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /email-templates — list templates for org
reportingQuickWinsRouter.get('/email-templates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const templates = await db
      .select()
      .from(schema.emailSendTemplates)
      .where(eq(schema.emailSendTemplates.orgId, orgId))
      .orderBy(desc(schema.emailSendTemplates.createdAt));

    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /email-templates — create template
reportingQuickWinsRouter.post('/email-templates', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(400).json({ error: 'Authentication required' });

    const db = await getDb();
    const schema = await getSchema();

    const [result] = await db
      .insert(schema.emailSendTemplates)
      .values({ ...req.body, orgId, createdBy: userId })
      .returning();

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /email-templates/:id — update template
reportingQuickWinsRouter.put('/email-templates/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.emailSendTemplates)
      .set(req.body)
      .where(and(
        eq(schema.emailSendTemplates.id, req.params.id),
        eq(schema.emailSendTemplates.orgId, orgId)
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Template not found' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /email-templates/:id — delete template
reportingQuickWinsRouter.delete('/email-templates/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [deleted] = await db
      .delete(schema.emailSendTemplates)
      .where(and(
        eq(schema.emailSendTemplates.id, req.params.id),
        eq(schema.emailSendTemplates.orgId, orgId)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
