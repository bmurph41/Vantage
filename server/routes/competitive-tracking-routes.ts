/**
 * Competitive Tracking Routes
 *
 * Track competitors per deal — names, bids, strengths/weaknesses, intel sources.
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

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

// GET /deals/:dealId/competitors — list competitors for a deal
router.get('/deals/:dealId/competitors', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { dealId } = req.params;
    const db = await getDb();
    const schema = await getSchema();

    const competitors = await db
      .select()
      .from(schema.dealCompetitors)
      .where(and(
        eq(schema.dealCompetitors.orgId, orgId),
        eq(schema.dealCompetitors.dealId, dealId),
      ))
      .orderBy(desc(schema.dealCompetitors.updatedAt));

    // Compute summary
    const bids = competitors
      .map(c => Number(c.estimatedBid || 0))
      .filter(b => b > 0);
    const avgBid = bids.length > 0 ? bids.reduce((s, b) => s + b, 0) / bids.length : 0;
    const maxBid = bids.length > 0 ? Math.max(...bids) : 0;
    const minBid = bids.length > 0 ? Math.min(...bids) : 0;

    res.json({
      competitors,
      summary: {
        count: competitors.length,
        avgBid,
        maxBid,
        minBid,
      },
    });
  } catch (error) {
    console.error('Error fetching competitors:', error);
    res.status(500).json({ error: 'Failed to fetch competitors' });
  }
});

// POST /deals/:dealId/competitors — add a competitor
router.post('/deals/:dealId/competitors', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(401).json({ error: 'Authentication required' });

    const { dealId } = req.params;
    const { competitorName, estimatedBid, strengths, weaknesses, intelSource, notes } = req.body;

    if (!competitorName) return res.status(400).json({ error: 'competitorName is required' });

    const db = await getDb();
    const schema = await getSchema();

    const [competitor] = await db.insert(schema.dealCompetitors).values({
      orgId,
      dealId,
      competitorName,
      estimatedBid: estimatedBid ? String(estimatedBid) : null,
      strengths,
      weaknesses,
      intelSource,
      notes,
      createdBy: userId,
    }).returning();

    res.status(201).json(competitor);
  } catch (error) {
    console.error('Error adding competitor:', error);
    res.status(500).json({ error: 'Failed to add competitor' });
  }
});

// PUT /deals/:dealId/competitors/:id — update a competitor
router.put('/deals/:dealId/competitors/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { id } = req.params;
    const { competitorName, estimatedBid, strengths, weaknesses, intelSource, notes } = req.body;

    const db = await getDb();
    const schema = await getSchema();

    const updates: any = { updatedAt: new Date() };
    if (competitorName !== undefined) updates.competitorName = competitorName;
    if (estimatedBid !== undefined) updates.estimatedBid = estimatedBid ? String(estimatedBid) : null;
    if (strengths !== undefined) updates.strengths = strengths;
    if (weaknesses !== undefined) updates.weaknesses = weaknesses;
    if (intelSource !== undefined) updates.intelSource = intelSource;
    if (notes !== undefined) updates.notes = notes;

    const [updated] = await db.update(schema.dealCompetitors)
      .set(updates)
      .where(and(
        eq(schema.dealCompetitors.id, id),
        eq(schema.dealCompetitors.orgId, orgId),
      ))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Competitor not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating competitor:', error);
    res.status(500).json({ error: 'Failed to update competitor' });
  }
});

// DELETE /deals/:dealId/competitors/:id — remove a competitor
router.delete('/deals/:dealId/competitors/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { id } = req.params;
    const db = await getDb();
    const schema = await getSchema();

    const [deleted] = await db.delete(schema.dealCompetitors)
      .where(and(
        eq(schema.dealCompetitors.id, id),
        eq(schema.dealCompetitors.orgId, orgId),
      ))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Competitor not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting competitor:', error);
    res.status(500).json({ error: 'Failed to delete competitor' });
  }
});

export default router;
