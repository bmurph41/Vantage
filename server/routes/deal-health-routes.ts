/**
 * Deal Health Score Service
 * Computes a 0-100 health score per deal based on:
 *   - Activity recency (30 pts)
 *   - Field completeness (20 pts)
 *   - Days in stage vs benchmark (25 pts)
 *   - Probability alignment with stage (15 pts)
 *   - Upcoming deadline urgency (10 pts)
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, count, max } from 'drizzle-orm';

const router = Router();
async function getDb() { const { db } = await import('../db'); return db; }
async function getSchema() { return import('@shared/schema'); }
function getOrgId(req: Request): string | null { return (req as any).orgId || (req as any).user?.orgId || null; }

// Expected avg days per stage type (benchmark)
const STAGE_BENCHMARKS: Record<string, number> = {
  prospect: 14, initial_outreach: 7, qualified: 10, loi_submitted: 14,
  loi_negotiated: 21, loi_executed: 7, psa_drafting: 14, psa_executed: 7,
  due_diligence: 30, financing: 21, clear_to_close: 14, closed: 0,
};

// Fields that should be filled for a "complete" deal
const REQUIRED_FIELDS = ['amount', 'probability', 'expectedCloseDate', 'primaryContactId', 'assetClass'];
const NICE_TO_HAVE_FIELDS = ['description', 'forecastCategory', 'leadSource', 'companyId'];

function computeHealthScore(deal: any, activityStats: { count: number; lastDate: Date | null }): {
  score: number;
  breakdown: Record<string, number>;
  flags: string[];
} {
  const flags: string[] = [];
  let score = 0;
  const breakdown: Record<string, number> = {};

  // ── Activity Recency (30 pts) ──
  const daysSinceActivity = activityStats.lastDate
    ? Math.floor((Date.now() - activityStats.lastDate.getTime()) / 86400000)
    : 999;
  let activityScore = 0;
  if (daysSinceActivity <= 3) activityScore = 30;
  else if (daysSinceActivity <= 7) activityScore = 25;
  else if (daysSinceActivity <= 14) activityScore = 15;
  else if (daysSinceActivity <= 30) activityScore = 5;
  else { activityScore = 0; flags.push('No activity in 30+ days'); }
  breakdown.activityRecency = activityScore;
  score += activityScore;

  // ── Field Completeness (20 pts) ──
  const filledRequired = REQUIRED_FIELDS.filter(f => deal[f] != null && deal[f] !== '' && deal[f] !== 0).length;
  const filledNice = NICE_TO_HAVE_FIELDS.filter(f => deal[f] != null && deal[f] !== '').length;
  const completenessScore = Math.round(
    (filledRequired / REQUIRED_FIELDS.length) * 14 +
    (filledNice / NICE_TO_HAVE_FIELDS.length) * 6
  );
  if (filledRequired < REQUIRED_FIELDS.length) flags.push(`Missing ${REQUIRED_FIELDS.length - filledRequired} required fields`);
  breakdown.fieldCompleteness = completenessScore;
  score += completenessScore;

  // ── Days in Stage (25 pts) ──
  const daysInStage = deal.currentStageEnteredAt
    ? Math.floor((Date.now() - new Date(deal.currentStageEnteredAt).getTime()) / 86400000) : 0;
  const stageBenchmark = STAGE_BENCHMARKS[deal.stage] || 21;
  let stageScore = 0;
  const ratio = stageBenchmark > 0 ? daysInStage / stageBenchmark : 0;
  if (ratio <= 0.5) stageScore = 25;
  else if (ratio <= 1.0) stageScore = 20;
  else if (ratio <= 1.5) stageScore = 10;
  else if (ratio <= 2.0) stageScore = 3;
  else { stageScore = 0; flags.push(`Stale: ${daysInStage}d in ${deal.stage} (benchmark: ${stageBenchmark}d)`); }
  breakdown.stageVelocity = stageScore;
  score += stageScore;

  // ── Probability Alignment (15 pts) ──
  const prob = Number(deal.probability) || 0;
  let probScore = 0;
  if (prob >= 70) probScore = 15;
  else if (prob >= 50) probScore = 12;
  else if (prob >= 30) probScore = 8;
  else if (prob >= 10) probScore = 4;
  else { probScore = 0; flags.push('Low probability — qualify or advance stage'); }
  breakdown.probabilityAlignment = probScore;
  score += probScore;

  // ── Deadline Urgency (10 pts — rewards having near-term clarity) ──
  const closeDate = deal.expectedCloseDate || deal.closingDate;
  let urgencyScore = 0;
  if (closeDate) {
    const daysToClose = Math.floor((new Date(closeDate).getTime() - Date.now()) / 86400000);
    if (daysToClose < 0) { urgencyScore = 0; flags.push('Close date has passed'); }
    else if (daysToClose <= 30) urgencyScore = 10;
    else if (daysToClose <= 90) urgencyScore = 7;
    else urgencyScore = 4;
  } else {
    urgencyScore = 0;
    flags.push('No close date set');
  }
  breakdown.deadlineClarity = urgencyScore;
  score += urgencyScore;

  return { score: Math.min(100, Math.max(0, score)), breakdown, flags };
}

// POST /deal-health/compute-all — recompute scores for all open deals
router.post('/compute-all', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const db = await getDb();
    const schema = await getSchema();

    const deals = await db.select().from(schema.crmDeals)
      .where(and(eq(schema.crmDeals.orgId, orgId), eq(schema.crmDeals.isClosed, false)));

    const activityCounts = await db
      .select({
        dealId: schema.crmActivities.dealId,
        lastDate: max(schema.crmActivities.date),
        cnt: count(schema.crmActivities.id),
      })
      .from(schema.crmActivities)
      .where(eq(schema.crmActivities.orgId, orgId))
      .groupBy(schema.crmActivities.dealId);

    const actMap = new Map(activityCounts.map(a => [a.dealId, {
      count: Number(a.cnt),
      lastDate: a.lastDate ? new Date(a.lastDate) : null,
    }]));

    const results = [];
    for (const deal of deals) {
      const stats = actMap.get(deal.id) || { count: 0, lastDate: null };
      const { score } = computeHealthScore(deal, stats);
      await db.update(schema.crmDeals)
        .set({ score, updatedAt: new Date() } as any)
        .where(eq(schema.crmDeals.id, deal.id));
      results.push({ id: deal.id, title: deal.title, score });
    }

    return res.json({ updated: results.length, results });
  } catch (e) {
    console.error('Health score compute error:', e);
    return res.status(500).json({ error: 'Failed to compute health scores' });
  }
});

// GET /deal-health/:dealId — get detailed score for one deal
router.get('/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });
    const db = await getDb();
    const schema = await getSchema();

    const [deal] = await db.select().from(schema.crmDeals)
      .where(and(eq(schema.crmDeals.id, req.params.dealId), eq(schema.crmDeals.orgId, orgId)));
    if (!deal) return res.status(404).json({ error: 'Deal not found' });

    const [actStats] = await db.select({
      lastDate: max(schema.crmActivities.date),
      cnt: count(schema.crmActivities.id),
    }).from(schema.crmActivities)
      .where(and(eq(schema.crmActivities.orgId, orgId), eq(schema.crmActivities.dealId, deal.id)));

    const result = computeHealthScore(deal, {
      count: Number(actStats?.cnt || 0),
      lastDate: actStats?.lastDate ? new Date(actStats.lastDate) : null,
    });

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to compute deal health score' });
  }
});

export default router;
