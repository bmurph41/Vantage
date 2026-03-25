/**
 * Capital Markets Routes (Sections 6.1–6.4)
 *
 * 6.1 Lender Matching
 * 6.2 Term Sheet Comparator
 * 6.3 Debt Maturity Wall
 * 6.4 Preferred Equity / Mezz Tracker
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';

export const capitalMarketsRouter = Router();

async function getDb() {
  const { db } = await import('../db');
  return db;
}

async function getSchema() {
  return import('@shared/schema');
}

function getOrgId(req: Request): string | null {
  return (req as any).orgId || (req as any).user?.orgId || null;
}

// ============================================================================
// 6.1 LENDERS
// ============================================================================

// GET /lenders — list all lenders, optional filters: lenderType, assetClass
capitalMarketsRouter.get('/lenders', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();
    const { lenderType, assetClass } = req.query;

    const conditions: any[] = [eq(schema.lenders.orgId, orgId)];

    if (lenderType) {
      conditions.push(eq(schema.lenders.lenderType, lenderType as string));
    }
    if (assetClass) {
      conditions.push(
        sql`${schema.lenders.preferredAssetClasses} @> ${JSON.stringify([assetClass])}::jsonb`
      );
    }

    const rows = await db
      .select()
      .from(schema.lenders)
      .where(and(...conditions))
      .orderBy(desc(schema.lenders.createdAt));

    res.json(rows);
  } catch (error) {
    console.error('Error fetching lenders:', error);
    res.status(500).json({ error: 'Failed to fetch lenders' });
  }
});

// POST /lenders — create lender
capitalMarketsRouter.post('/lenders', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [lender] = await db.insert(schema.lenders).values({
      ...req.body,
      orgId,
    }).returning();

    res.status(201).json(lender);
  } catch (error) {
    console.error('Error creating lender:', error);
    res.status(500).json({ error: 'Failed to create lender' });
  }
});

// GET /lenders/:id — get lender detail
capitalMarketsRouter.get('/lenders/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [lender] = await db
      .select()
      .from(schema.lenders)
      .where(and(eq(schema.lenders.id, req.params.id), eq(schema.lenders.orgId, orgId)));

    if (!lender) return res.status(404).json({ error: 'Lender not found' });
    res.json(lender);
  } catch (error) {
    console.error('Error fetching lender:', error);
    res.status(500).json({ error: 'Failed to fetch lender' });
  }
});

// PUT /lenders/:id — update lender
capitalMarketsRouter.put('/lenders/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.lenders)
      .set(req.body)
      .where(and(eq(schema.lenders.id, req.params.id), eq(schema.lenders.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Lender not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating lender:', error);
    res.status(500).json({ error: 'Failed to update lender' });
  }
});

// DELETE /lenders/:id — delete lender
capitalMarketsRouter.delete('/lenders/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [deleted] = await db
      .delete(schema.lenders)
      .where(and(eq(schema.lenders.id, req.params.id), eq(schema.lenders.orgId, orgId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Lender not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting lender:', error);
    res.status(500).json({ error: 'Failed to delete lender' });
  }
});

// POST /lenders/match — score and match lenders for deal parameters
capitalMarketsRouter.post('/lenders/match', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const { assetClass, loanAmount, ltv, dscr, market } = req.body;
    if (!assetClass || !loanAmount) {
      return res.status(400).json({ error: 'assetClass and loanAmount are required' });
    }

    const db = await getDb();
    const schema = await getSchema();

    const allLenders = await db
      .select()
      .from(schema.lenders)
      .where(and(eq(schema.lenders.orgId, orgId), eq(schema.lenders.isActive, true)));

    const scored = allLenders.map((lender) => {
      let score = 0;

      // Asset class match — 30 pts
      const prefClasses = (lender.preferredAssetClasses as string[] | null) || [];
      if (prefClasses.includes(assetClass)) {
        score += 30;
      }

      // Loan amount in range — 20 pts
      const minLoan = lender.minLoanAmount ? Number(lender.minLoanAmount) : 0;
      const maxLoan = lender.maxLoanAmount ? Number(lender.maxLoanAmount) : Infinity;
      if (loanAmount >= minLoan && loanAmount <= maxLoan) {
        score += 20;
      }

      // LTV within lender max — 20 pts
      if (ltv != null && lender.typicalLTVMax) {
        if (ltv <= Number(lender.typicalLTVMax)) {
          score += 20;
        }
      }

      // DSCR above lender minimum — 20 pts
      if (dscr != null && lender.typicalDSCRMin) {
        if (dscr >= Number(lender.typicalDSCRMin)) {
          score += 20;
        }
      }

      // Market match — 10 pts
      if (market) {
        const prefMarkets = (lender.preferredMarkets as string[] | null) || [];
        if (prefMarkets.includes(market)) {
          score += 10;
        }
      }

      return { ...lender, matchScore: score };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);

    res.json(scored);
  } catch (error) {
    console.error('Error matching lenders:', error);
    res.status(500).json({ error: 'Failed to match lenders' });
  }
});

// ============================================================================
// 6.1 LENDER-DEAL TRACKING
// ============================================================================

// POST /lender-deals — create lender-deal tracking record
capitalMarketsRouter.post('/lender-deals', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [record] = await db.insert(schema.lenderDeals).values({
      ...req.body,
      orgId,
    }).returning();

    res.status(201).json(record);
  } catch (error) {
    console.error('Error creating lender-deal record:', error);
    res.status(500).json({ error: 'Failed to create lender-deal record' });
  }
});

// GET /lender-deals/deal/:dealId — all lender tracks for a deal
capitalMarketsRouter.get('/lender-deals/deal/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const rows = await db
      .select()
      .from(schema.lenderDeals)
      .where(and(eq(schema.lenderDeals.orgId, orgId), eq(schema.lenderDeals.dealId, req.params.dealId)))
      .orderBy(desc(schema.lenderDeals.createdAt));

    res.json(rows);
  } catch (error) {
    console.error('Error fetching lender-deals:', error);
    res.status(500).json({ error: 'Failed to fetch lender-deal records' });
  }
});

// PUT /lender-deals/:id — update status/details
capitalMarketsRouter.put('/lender-deals/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.lenderDeals)
      .set(req.body)
      .where(and(eq(schema.lenderDeals.id, req.params.id), eq(schema.lenderDeals.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Lender-deal record not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating lender-deal record:', error);
    res.status(500).json({ error: 'Failed to update lender-deal record' });
  }
});

// ============================================================================
// 6.2 TERM SHEETS
// ============================================================================

// POST /term-sheets — create term sheet
capitalMarketsRouter.post('/term-sheets', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [sheet] = await db.insert(schema.termSheets).values({
      ...req.body,
      orgId,
    }).returning();

    res.status(201).json(sheet);
  } catch (error) {
    console.error('Error creating term sheet:', error);
    res.status(500).json({ error: 'Failed to create term sheet' });
  }
});

// GET /term-sheets/deal/:dealId — list for deal
capitalMarketsRouter.get('/term-sheets/deal/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const rows = await db
      .select()
      .from(schema.termSheets)
      .where(and(eq(schema.termSheets.orgId, orgId), eq(schema.termSheets.dealId, req.params.dealId)))
      .orderBy(desc(schema.termSheets.createdAt));

    res.json(rows);
  } catch (error) {
    console.error('Error fetching term sheets:', error);
    res.status(500).json({ error: 'Failed to fetch term sheets' });
  }
});

// GET /term-sheets/:id — get single
capitalMarketsRouter.get('/term-sheets/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [sheet] = await db
      .select()
      .from(schema.termSheets)
      .where(and(eq(schema.termSheets.id, req.params.id), eq(schema.termSheets.orgId, orgId)));

    if (!sheet) return res.status(404).json({ error: 'Term sheet not found' });
    res.json(sheet);
  } catch (error) {
    console.error('Error fetching term sheet:', error);
    res.status(500).json({ error: 'Failed to fetch term sheet' });
  }
});

// PUT /term-sheets/:id — update
capitalMarketsRouter.put('/term-sheets/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.termSheets)
      .set(req.body)
      .where(and(eq(schema.termSheets.id, req.params.id), eq(schema.termSheets.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Term sheet not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating term sheet:', error);
    res.status(500).json({ error: 'Failed to update term sheet' });
  }
});

// POST /term-sheets/:id/select — mark as selected, reject others
capitalMarketsRouter.post('/term-sheets/:id/select', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    // Fetch the sheet to get its dealId
    const [sheet] = await db
      .select()
      .from(schema.termSheets)
      .where(and(eq(schema.termSheets.id, req.params.id), eq(schema.termSheets.orgId, orgId)));

    if (!sheet) return res.status(404).json({ error: 'Term sheet not found' });

    // Reject all other term sheets for this deal
    if (sheet.dealId) {
      await db
        .update(schema.termSheets)
        .set({ status: 'rejected' })
        .where(
          and(
            eq(schema.termSheets.orgId, orgId),
            eq(schema.termSheets.dealId, sheet.dealId),
            sql`${schema.termSheets.id} != ${req.params.id}`
          )
        );
    }

    // Mark this one as selected
    const [selected] = await db
      .update(schema.termSheets)
      .set({ status: 'selected' })
      .where(eq(schema.termSheets.id, req.params.id))
      .returning();

    res.json(selected);
  } catch (error) {
    console.error('Error selecting term sheet:', error);
    res.status(500).json({ error: 'Failed to select term sheet' });
  }
});

// GET /term-sheets/compare/:dealId — compare all term sheets with calculated metrics
capitalMarketsRouter.get('/term-sheets/compare/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const sheets = await db
      .select()
      .from(schema.termSheets)
      .where(and(eq(schema.termSheets.orgId, orgId), eq(schema.termSheets.dealId, req.params.dealId)))
      .orderBy(desc(schema.termSheets.createdAt));

    const compared = sheets.map((ts) => {
      const loanAmount = ts.loanAmount ? Number(ts.loanAmount) : 0;
      const rate = ts.rate ? Number(ts.rate) / 100 : 0; // stored as percent
      const amortYears = ts.amortizationYears || 30;
      const termYears = ts.termYears || 10;
      const ioMonths = ts.ioMonths || 0;
      const origFee = ts.originationFee ? Number(ts.originationFee) / 100 : 0;
      const exitFee = ts.exitFee ? Number(ts.exitFee) / 100 : 0;

      // Monthly payment (P&I after IO period)
      const monthlyRate = rate / 12;
      let monthlyPayment = 0;
      if (monthlyRate > 0 && loanAmount > 0) {
        const n = amortYears * 12;
        monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) /
          (Math.pow(1 + monthlyRate, n) - 1);
      }

      // Annual debt service (blended over first year considering IO)
      const ioMonthlyPayment = loanAmount * monthlyRate;
      const amortMonthsInYear = Math.max(0, 12 - Math.min(ioMonths, 12));
      const ioMonthsInYear = 12 - amortMonthsInYear;
      const annualDebtService = (ioMonthsInYear * ioMonthlyPayment) + (amortMonthsInYear * monthlyPayment);

      // All-in rate (approx): rate + annualized fees spread over term
      const totalFees = (origFee + exitFee);
      const allInRate = rate + (totalFees / termYears);

      return {
        ...ts,
        metrics: {
          monthlyPayment: Math.round(monthlyPayment * 100) / 100,
          annualDebtService: Math.round(annualDebtService * 100) / 100,
          allInRate: Math.round(allInRate * 10000) / 10000,
        },
      };
    });

    res.json(compared);
  } catch (error) {
    console.error('Error comparing term sheets:', error);
    res.status(500).json({ error: 'Failed to compare term sheets' });
  }
});

// ============================================================================
// 6.3 DEAL DEBT / DEBT MATURITY
// ============================================================================

// POST /debt — create debt record
capitalMarketsRouter.post('/debt', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [record] = await db.insert(schema.dealDebt).values({
      ...req.body,
      orgId,
    }).returning();

    res.status(201).json(record);
  } catch (error) {
    console.error('Error creating debt record:', error);
    res.status(500).json({ error: 'Failed to create debt record' });
  }
});

// GET /debt — list all debt for org with maturity sorting
capitalMarketsRouter.get('/debt', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const rows = await db
      .select()
      .from(schema.dealDebt)
      .where(eq(schema.dealDebt.orgId, orgId))
      .orderBy(schema.dealDebt.maturityDate);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching debt records:', error);
    res.status(500).json({ error: 'Failed to fetch debt records' });
  }
});

// GET /debt/deal/:dealId — debt for specific deal
capitalMarketsRouter.get('/debt/deal/:dealId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const rows = await db
      .select()
      .from(schema.dealDebt)
      .where(and(eq(schema.dealDebt.orgId, orgId), eq(schema.dealDebt.dealId, req.params.dealId)))
      .orderBy(schema.dealDebt.maturityDate);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching deal debt:', error);
    res.status(500).json({ error: 'Failed to fetch deal debt' });
  }
});

// PUT /debt/:id — update debt record
capitalMarketsRouter.put('/debt/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.dealDebt)
      .set(req.body)
      .where(and(eq(schema.dealDebt.id, req.params.id), eq(schema.dealDebt.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Debt record not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating debt record:', error);
    res.status(500).json({ error: 'Failed to update debt record' });
  }
});

// GET /debt/maturity-wall — all loans grouped by maturity month for next 36 months
capitalMarketsRouter.get('/debt/maturity-wall', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const now = new Date();
    const threeYearsOut = new Date(now);
    threeYearsOut.setMonth(threeYearsOut.getMonth() + 36);

    const nowStr = now.toISOString().slice(0, 10);
    const futureStr = threeYearsOut.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(schema.dealDebt)
      .where(
        and(
          eq(schema.dealDebt.orgId, orgId),
          gte(schema.dealDebt.maturityDate, nowStr),
          lte(schema.dealDebt.maturityDate, futureStr)
        )
      )
      .orderBy(schema.dealDebt.maturityDate);

    // Group by year-month
    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (row.maturityDate) {
        const key = row.maturityDate.slice(0, 7); // YYYY-MM
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
      }
    }

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching maturity wall:', error);
    res.status(500).json({ error: 'Failed to fetch maturity wall' });
  }
});

// GET /debt/maturing-soon — loans maturing within 12 months
capitalMarketsRouter.get('/debt/maturing-soon', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const now = new Date();
    const oneYearOut = new Date(now);
    oneYearOut.setMonth(oneYearOut.getMonth() + 12);

    const nowStr = now.toISOString().slice(0, 10);
    const futureStr = oneYearOut.toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(schema.dealDebt)
      .where(
        and(
          eq(schema.dealDebt.orgId, orgId),
          gte(schema.dealDebt.maturityDate, nowStr),
          lte(schema.dealDebt.maturityDate, futureStr)
        )
      )
      .orderBy(schema.dealDebt.maturityDate);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching maturing-soon debt:', error);
    res.status(500).json({ error: 'Failed to fetch maturing-soon debt' });
  }
});

// ============================================================================
// 6.4 MEZZ POSITIONS
// ============================================================================

// POST /mezz — create mezz position
capitalMarketsRouter.post('/mezz', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [position] = await db.insert(schema.mezzPositions).values({
      ...req.body,
    }).returning();

    res.status(201).json(position);
  } catch (error) {
    console.error('Error creating mezz position:', error);
    res.status(500).json({ error: 'Failed to create mezz position' });
  }
});

// GET /mezz/deal-debt/:dealDebtId — get mezz positions for a debt record
capitalMarketsRouter.get('/mezz/deal-debt/:dealDebtId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const rows = await db
      .select()
      .from(schema.mezzPositions)
      .where(eq(schema.mezzPositions.dealDebtId, req.params.dealDebtId))
      .orderBy(desc(schema.mezzPositions.createdAt));

    res.json(rows);
  } catch (error) {
    console.error('Error fetching mezz positions:', error);
    res.status(500).json({ error: 'Failed to fetch mezz positions' });
  }
});

// PUT /mezz/:id — update mezz position
capitalMarketsRouter.put('/mezz/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(400).json({ error: 'Organization required' });

    const db = await getDb();
    const schema = await getSchema();

    const [updated] = await db
      .update(schema.mezzPositions)
      .set(req.body)
      .where(eq(schema.mezzPositions.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Mezz position not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating mezz position:', error);
    res.status(500).json({ error: 'Failed to update mezz position' });
  }
});
