import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  juniorAnalystSuggestions,
  juniorAnalystSettings,
} from '@shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

export const juniorAnalystRouter = Router();

// ── Suggestions ────────────────────────────────────────────────────────────

// GET /api/junior-analyst/suggestions
// Query params: projectId, dealId, status (default: pending)
juniorAnalystRouter.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { projectId, dealId, status } = req.query as Record<string, string>;

    const conditions = [eq(juniorAnalystSuggestions.orgId, orgId)];
    if (status) conditions.push(eq(juniorAnalystSuggestions.status, status));
    if (projectId) conditions.push(eq(juniorAnalystSuggestions.projectId, projectId));
    if (dealId) conditions.push(eq(juniorAnalystSuggestions.dealId, dealId));

    const suggestions = await db
      .select()
      .from(juniorAnalystSuggestions)
      .where(and(...conditions))
      .orderBy(desc(juniorAnalystSuggestions.createdAt));

    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/junior-analyst/suggestions/:id/approve
juniorAnalystRouter.post('/suggestions/:id/approve', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { id } = req.params;

    const [updated] = await db
      .update(juniorAnalystSuggestions)
      .set({ status: 'approved', actedAt: new Date(), actedBy: userId, updatedAt: new Date() })
      .where(and(eq(juniorAnalystSuggestions.id, id), eq(juniorAnalystSuggestions.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Suggestion not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/junior-analyst/suggestions/:id/dismiss
juniorAnalystRouter.post('/suggestions/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { id } = req.params;

    const [updated] = await db
      .update(juniorAnalystSuggestions)
      .set({ status: 'dismissed', actedAt: new Date(), actedBy: userId, updatedAt: new Date() })
      .where(and(eq(juniorAnalystSuggestions.id, id), eq(juniorAnalystSuggestions.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Suggestion not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Settings ───────────────────────────────────────────────────────────────

// GET /api/junior-analyst/settings?projectId=...
juniorAnalystRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { projectId } = req.query as { projectId?: string };

    let settings = null;

    if (projectId) {
      [settings] = await db.select().from(juniorAnalystSettings)
        .where(and(eq(juniorAnalystSettings.orgId, orgId), eq(juniorAnalystSettings.projectId, projectId)));
    }

    if (!settings) {
      [settings] = await db.select().from(juniorAnalystSettings)
        .where(and(eq(juniorAnalystSettings.orgId, orgId), isNull(juniorAnalystSettings.projectId)));
    }

    // Return defaults if nothing saved yet
    if (!settings) {
      return res.json({
        mode: 'manual',
        enabledAgents: ['document_intake', 'underwriting', 'deal_scout', 'dd_coordinator', 'rent_roll', 'market_pulse', 'outreach'],
        stageToggles: {},
      });
    }

    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/junior-analyst/settings
juniorAnalystRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { projectId, mode, enabledAgents, stageToggles } = req.body;

    const existing = projectId
      ? await db.select().from(juniorAnalystSettings)
          .where(and(eq(juniorAnalystSettings.orgId, orgId), eq(juniorAnalystSettings.projectId, projectId)))
          .then(r => r[0])
      : await db.select().from(juniorAnalystSettings)
          .where(and(eq(juniorAnalystSettings.orgId, orgId), isNull(juniorAnalystSettings.projectId)))
          .then(r => r[0]);

    const values: any = { updatedAt: new Date() };
    if (mode !== undefined) values.mode = mode;
    if (enabledAgents !== undefined) values.enabledAgents = enabledAgents;
    if (stageToggles !== undefined) values.stageToggles = stageToggles;

    if (existing) {
      const [updated] = await db.update(juniorAnalystSettings)
        .set(values)
        .where(eq(juniorAnalystSettings.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(juniorAnalystSettings)
      .values({ orgId, projectId: projectId ?? null, mode: mode ?? 'manual', enabledAgents, stageToggles })
      .returning();
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/junior-analyst/suggestions/count  (unread badge count)
juniorAnalystRouter.get('/suggestions/count', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { projectId } = req.query as { projectId?: string };

    const conditions = [
      eq(juniorAnalystSuggestions.orgId, orgId),
      eq(juniorAnalystSuggestions.status, 'pending'),
    ];
    if (projectId) conditions.push(eq(juniorAnalystSuggestions.projectId, projectId));

    const rows = await db.select().from(juniorAnalystSuggestions).where(and(...conditions));
    res.json({ count: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
