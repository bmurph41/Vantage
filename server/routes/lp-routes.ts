/**
 * LP (Limited Partner) Management Routes
 *
 * CRUD APIs for LP investors, commitments, distributions, and capital accounts.
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql, sum } from 'drizzle-orm';

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
  return (req as any).user?.orgId || (req as any).tenantId || null;
}

// ============================================================================
// INVESTORS
// ============================================================================

// GET /investors - list investors
router.get('/investors', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const conditions = [eq(schema.lpInvestors.orgId, orgId)];

    if (req.query.active !== 'false') {
      conditions.push(eq(schema.lpInvestors.isActive, true));
    }

    const investors = await db
      .select()
      .from(schema.lpInvestors)
      .where(and(...conditions))
      .orderBy(desc(schema.lpInvestors.createdAt));

    res.json(investors);
  } catch (error) {
    console.error('Error fetching LP investors:', error);
    res.status(500).json({ error: 'Failed to fetch investors' });
  }
});

// POST /investors - create investor
router.post('/investors', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const parsed = schema.insertLpInvestorSchema.parse(req.body);

    const [investor] = await db
      .insert(schema.lpInvestors)
      .values({
        ...parsed,
        orgId,
      })
      .returning();

    res.status(201).json(investor);
  } catch (error) {
    console.error('Error creating LP investor:', error);
    res.status(500).json({ error: 'Failed to create investor' });
  }
});

// GET /investors/:id - get investor with commitments
router.get('/investors/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [investor] = await db
      .select()
      .from(schema.lpInvestors)
      .where(
        and(
          eq(schema.lpInvestors.id, req.params.id),
          eq(schema.lpInvestors.orgId, orgId)
        )
      );

    if (!investor) return res.status(404).json({ error: 'Investor not found' });

    const commitments = await db
      .select()
      .from(schema.lpCommitments)
      .where(
        and(
          eq(schema.lpCommitments.investorId, req.params.id),
          eq(schema.lpCommitments.orgId, orgId)
        )
      )
      .orderBy(desc(schema.lpCommitments.createdAt));

    res.json({ ...investor, commitments });
  } catch (error) {
    console.error('Error fetching LP investor:', error);
    res.status(500).json({ error: 'Failed to fetch investor' });
  }
});

// PATCH /investors/:id - update investor
router.patch('/investors/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const parsed = schema.updateLpInvestorSchema.parse(req.body);

    const [updated] = await db
      .update(schema.lpInvestors)
      .set({ ...parsed, updatedAt: new Date() })
      .where(
        and(
          eq(schema.lpInvestors.id, req.params.id),
          eq(schema.lpInvestors.orgId, orgId)
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: 'Investor not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating LP investor:', error);
    res.status(500).json({ error: 'Failed to update investor' });
  }
});

// GET /investors/:id/commitments - get commitments for investor
router.get('/investors/:id/commitments', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const commitments = await db
      .select()
      .from(schema.lpCommitments)
      .where(
        and(
          eq(schema.lpCommitments.investorId, req.params.id),
          eq(schema.lpCommitments.orgId, orgId)
        )
      )
      .orderBy(desc(schema.lpCommitments.createdAt));

    res.json(commitments);
  } catch (error) {
    console.error('Error fetching LP commitments:', error);
    res.status(500).json({ error: 'Failed to fetch commitments' });
  }
});

// ============================================================================
// COMMITMENTS
// ============================================================================

// POST /commitments - create commitment
router.post('/commitments', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const parsed = schema.insertLpCommitmentSchema.parse(req.body);

    // Calculate unfunded commitment
    const fundedAmount = parseFloat(String(parsed.fundedAmount || '0'));
    const commitmentAmount = parseFloat(String(parsed.commitmentAmount));
    const unfundedCommitment = String(commitmentAmount - fundedAmount);

    const [commitment] = await db
      .insert(schema.lpCommitments)
      .values({
        ...parsed,
        orgId,
        unfundedCommitment,
      })
      .returning();

    res.status(201).json(commitment);
  } catch (error) {
    console.error('Error creating LP commitment:', error);
    res.status(500).json({ error: 'Failed to create commitment' });
  }
});

// PATCH /commitments/:id - update commitment
router.patch('/commitments/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.lpCommitments)
      .set({ ...req.body, updatedAt: new Date() })
      .where(
        and(
          eq(schema.lpCommitments.id, req.params.id),
          eq(schema.lpCommitments.orgId, orgId)
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: 'Commitment not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating LP commitment:', error);
    res.status(500).json({ error: 'Failed to update commitment' });
  }
});

// GET /commitments/:id/distributions - get distributions for commitment
router.get('/commitments/:id/distributions', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const distributions = await db
      .select()
      .from(schema.lpDistributions)
      .where(
        and(
          eq(schema.lpDistributions.commitmentId, req.params.id),
          eq(schema.lpDistributions.orgId, orgId)
        )
      )
      .orderBy(desc(schema.lpDistributions.distributionDate));

    res.json(distributions);
  } catch (error) {
    console.error('Error fetching LP distributions:', error);
    res.status(500).json({ error: 'Failed to fetch distributions' });
  }
});

// ============================================================================
// DISTRIBUTIONS
// ============================================================================

// POST /distributions - create distribution
router.post('/distributions', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const parsed = schema.insertLpDistributionSchema.parse(req.body);

    const [distribution] = await db
      .insert(schema.lpDistributions)
      .values({
        ...parsed,
        orgId,
      })
      .returning();

    // Update commitment funded amount
    const grossAmount = parseFloat(String(parsed.grossAmount));
    await db
      .update(schema.lpCommitments)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(schema.lpCommitments.id, parsed.commitmentId));

    res.status(201).json(distribution);
  } catch (error) {
    console.error('Error creating LP distribution:', error);
    res.status(500).json({ error: 'Failed to create distribution' });
  }
});

// ============================================================================
// CAPITAL ACCOUNTS
// ============================================================================

// GET /investors/:id/capital-accounts - get capital account history
router.get('/investors/:id/capital-accounts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const accounts = await db
      .select()
      .from(schema.lpCapitalAccounts)
      .where(
        and(
          eq(schema.lpCapitalAccounts.investorId, req.params.id),
          eq(schema.lpCapitalAccounts.orgId, orgId)
        )
      )
      .orderBy(desc(schema.lpCapitalAccounts.periodEnd));

    res.json(accounts);
  } catch (error) {
    console.error('Error fetching LP capital accounts:', error);
    res.status(500).json({ error: 'Failed to fetch capital accounts' });
  }
});

// POST /capital-accounts - create capital account entry
router.post('/capital-accounts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    const [account] = await db
      .insert(schema.lpCapitalAccounts)
      .values({
        ...req.body,
        orgId,
      })
      .returning();

    res.status(201).json(account);
  } catch (error) {
    console.error('Error creating LP capital account:', error);
    res.status(500).json({ error: 'Failed to create capital account entry' });
  }
});

// ============================================================================
// DASHBOARD
// ============================================================================

// GET /dashboard - summary stats
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const schema = await getSchema();

    // Total investors
    const [investorCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.lpInvestors)
      .where(
        and(
          eq(schema.lpInvestors.orgId, orgId),
          eq(schema.lpInvestors.isActive, true)
        )
      );

    // Total AUM (sum of commitment amounts for active commitments)
    const [aumResult] = await db
      .select({
        totalAum: sql<string>`coalesce(sum(${schema.lpCommitments.commitmentAmount}::numeric), 0)`,
        totalFunded: sql<string>`coalesce(sum(${schema.lpCommitments.fundedAmount}::numeric), 0)`,
      })
      .from(schema.lpCommitments)
      .where(
        and(
          eq(schema.lpCommitments.orgId, orgId),
          eq(schema.lpCommitments.status, 'active')
        )
      );

    // Distributions YTD
    const currentYear = new Date().getFullYear();
    const [distResult] = await db
      .select({
        totalDistributed: sql<string>`coalesce(sum(${schema.lpDistributions.netAmount}::numeric), 0)`,
        distributionCount: sql<number>`count(*)`,
      })
      .from(schema.lpDistributions)
      .where(
        and(
          eq(schema.lpDistributions.orgId, orgId),
          sql`extract(year from ${schema.lpDistributions.distributionDate}::date) = ${currentYear}`
        )
      );

    res.json({
      totalInvestors: Number(investorCount?.count || 0),
      totalAum: parseFloat(aumResult?.totalAum || '0'),
      totalFunded: parseFloat(aumResult?.totalFunded || '0'),
      distributionsYtd: parseFloat(distResult?.totalDistributed || '0'),
      distributionCountYtd: Number(distResult?.distributionCount || 0),
    });
  } catch (error) {
    console.error('Error fetching LP dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
