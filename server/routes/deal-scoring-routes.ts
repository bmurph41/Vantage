/**
 * Deal Scoring Routes
 *
 * Scoring models with weighted criteria, per-deal scoring, and leaderboard.
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';

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

function computeGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// GET /models — list scoring models
router.get('/models', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const models = await db
      .select()
      .from(schema.dealScoringModels)
      .where(eq(schema.dealScoringModels.orgId, orgId))
      .orderBy(desc(schema.dealScoringModels.createdAt));

    res.json(models);
  } catch (error) {
    console.error('Error fetching scoring models:', error);
    res.status(500).json({ error: 'Failed to fetch scoring models' });
  }
});

// POST /models — create scoring model
router.post('/models', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { name, criteria, isDefault } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const db = await getDb();
    const schema = await getSchema();

    // If setting as default, unset existing defaults
    if (isDefault) {
      await db.update(schema.dealScoringModels)
        .set({ isDefault: false })
        .where(eq(schema.dealScoringModels.orgId, orgId));
    }

    const [model] = await db.insert(schema.dealScoringModels).values({
      orgId,
      name,
      criteria: criteria || [],
      isDefault: isDefault ?? true,
    }).returning();

    res.status(201).json(model);
  } catch (error) {
    console.error('Error creating scoring model:', error);
    res.status(500).json({ error: 'Failed to create scoring model' });
  }
});

// GET /deals/:dealId/score — get score for a deal
router.get('/deals/:dealId/score', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { dealId } = req.params;
    const db = await getDb();
    const schema = await getSchema();

    const scores = await db
      .select()
      .from(schema.dealScores)
      .where(and(
        eq(schema.dealScores.orgId, orgId),
        eq(schema.dealScores.dealId, dealId),
      ))
      .orderBy(desc(schema.dealScores.scoredAt));

    // Get model info for the latest score
    let model = null;
    if (scores.length > 0 && scores[0].modelId) {
      const [m] = await db
        .select()
        .from(schema.dealScoringModels)
        .where(eq(schema.dealScoringModels.id, scores[0].modelId))
        .limit(1);
      model = m || null;
    }

    res.json({
      currentScore: scores[0] || null,
      history: scores,
      model,
    });
  } catch (error) {
    console.error('Error fetching deal score:', error);
    res.status(500).json({ error: 'Failed to fetch deal score' });
  }
});

// POST /deals/:dealId/score — score a deal against a model
router.post('/deals/:dealId/score', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) return res.status(401).json({ error: 'Authentication required' });

    const { dealId } = req.params;
    const { modelId, scores: criteriaScores } = req.body;

    if (!modelId || !criteriaScores) {
      return res.status(400).json({ error: 'modelId and scores are required' });
    }

    const db = await getDb();
    const schema = await getSchema();

    // Get the model to compute weighted total
    const [model] = await db
      .select()
      .from(schema.dealScoringModels)
      .where(eq(schema.dealScoringModels.id, modelId))
      .limit(1);

    if (!model) return res.status(404).json({ error: 'Scoring model not found' });

    const criteria = (model.criteria as any[]) || [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
      const rawScore = criteriaScores[criterion.name] ?? 0;
      const maxScore = criterion.maxScore || 10;
      const weight = criterion.weight || 1;
      const normalizedScore = (rawScore / maxScore) * 100;
      totalWeightedScore += normalizedScore * weight;
      totalWeight += weight;
    }

    const finalScore = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 10) / 10 : 0;
    const grade = computeGrade(finalScore);

    const [score] = await db.insert(schema.dealScores).values({
      orgId,
      dealId,
      modelId,
      scores: criteriaScores,
      totalScore: String(finalScore),
      grade,
      scoredBy: userId,
    }).returning();

    res.status(201).json(score);
  } catch (error) {
    console.error('Error scoring deal:', error);
    res.status(500).json({ error: 'Failed to score deal' });
  }
});

// GET /leaderboard — ranked deals by score
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    // Get latest score per deal using raw SQL for efficiency
    const result = await db.execute(sql`
      SELECT DISTINCT ON (ds.deal_id)
        ds.id, ds.deal_id, ds.total_score, ds.grade, ds.scored_at,
        d.title as deal_title, d.amount as deal_value, d.stage as deal_stage
      FROM deal_scores ds
      LEFT JOIN crm_deals d ON d.id = ds.deal_id
      WHERE ds.org_id = ${orgId}
      ORDER BY ds.deal_id, ds.scored_at DESC
    `);

    // Sort by total_score descending
    const leaderboard = (result.rows as any[])
      .sort((a, b) => Number(b.total_score || 0) - Number(a.total_score || 0))
      .map((row, index) => ({
        rank: index + 1,
        dealId: row.deal_id,
        dealTitle: row.deal_title,
        dealValue: row.deal_value,
        dealStage: row.deal_stage,
        totalScore: Number(row.total_score),
        grade: row.grade,
        scoredAt: row.scored_at,
      }));

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    // Return empty on error (table may not exist yet)
    res.json([]);
  }
});

export default router;
