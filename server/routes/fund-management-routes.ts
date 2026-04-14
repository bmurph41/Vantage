/**
 * Fund Management Routes
 *
 * Covers Gap Spec sections:
 *   B.1 Fund-Level Model — DELEGATES to V1 FundService via /api/funds/* routes
 *   B.2 Fund Formation Documents
 *   B.3 Investor Verification / KYC
 *   B.4 Capital Account Ledger (V2 tables for immutable ledger)
 *   B.5 Management Fee Calculator
 *
 * NOTE: B.1 fund CRUD and investor management is handled by the V1 FundService
 * exposed at /api/funds/* in routes.ts. The V2 fund routes below (fundsV2 table)
 * are kept for B.2-B.5 features that aren't in the V1 service. Avoid duplicating
 * fund CRUD — use /api/funds/* as the canonical entry point.
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql, sum, count as drizzleCount } from 'drizzle-orm';
import { parsePagination, paginatedResponse } from '../utils/pagination';
import {
  fundsV2,
  fundDealsV2,
  managementFeeInvoices,
  fundDocuments,
  sideLetters,
  investorVerification,
  capitalAccounts,
  capitalAccountEntries,
  investors,
} from '@shared/schema';

export const fundManagementRouter = Router();

async function getDb() {
  const { db } = await import('../db');
  return db;
}

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).orgId || (req as any).tenantId || null;
}

// ============================================================================
// B.1 — Fund-Level Model
// ============================================================================

// GET /funds — list funds for org
fundManagementRouter.get('/funds', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const pag = parsePagination(req.query as Record<string, any>, { pageSize: 25 });

    const [{ total }] = await db.select({ total: drizzleCount() }).from(fundsV2)
      .where(eq(fundsV2.orgId, orgId));
    const funds = await db
      .select()
      .from(fundsV2)
      .where(eq(fundsV2.orgId, orgId))
      .orderBy(desc(fundsV2.createdAt))
      .limit(pag.limit)
      .offset(pag.offset);

    res.json(paginatedResponse(funds, Number(total), pag));
  } catch (error) {
    console.error('Error fetching funds:', error);
    res.status(500).json({ error: 'Failed to fetch funds' });
  }
});

// POST /funds — create fund
fundManagementRouter.post('/funds', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [fund] = await db
      .insert(fundsV2)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(fund);
  } catch (error) {
    console.error('Error creating fund:', error);
    res.status(500).json({ error: 'Failed to create fund' });
  }
});

// GET /funds/:id — get fund detail with computed metrics
fundManagementRouter.get('/funds/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, req.params.id), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const totalCalled = parseFloat(fund.totalCalled || '0');
    const totalDistributed = parseFloat(fund.totalDistributed || '0');
    const nav = parseFloat(fund.nav || '0');

    const tvpi = totalCalled > 0 ? (totalDistributed + nav) / totalCalled : 0;
    const dpi = totalCalled > 0 ? totalDistributed / totalCalled : 0;
    const rvpi = totalCalled > 0 ? nav / totalCalled : 0;

    res.json({
      ...fund,
      metrics: { tvpi, dpi, rvpi },
    });
  } catch (error) {
    console.error('Error fetching fund:', error);
    res.status(500).json({ error: 'Failed to fetch fund' });
  }
});

// PUT /funds/:id — update fund
fundManagementRouter.put('/funds/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [updated] = await db
      .update(fundsV2)
      .set(req.body)
      .where(and(eq(fundsV2.id, req.params.id), eq(fundsV2.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Fund not found' });

    res.json(updated);
  } catch (error) {
    console.error('Error updating fund:', error);
    res.status(500).json({ error: 'Failed to update fund' });
  }
});

// GET /funds/:id/deals — list fund-deal associations
fundManagementRouter.get('/funds/:id/deals', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Verify fund belongs to org
    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, req.params.id), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const pag = parsePagination(req.query as Record<string, any>, { pageSize: 25 });
    const [{ total }] = await db.select({ total: drizzleCount() }).from(fundDealsV2)
      .where(eq(fundDealsV2.fundId, req.params.id));
    const deals = await db
      .select()
      .from(fundDealsV2)
      .where(eq(fundDealsV2.fundId, req.params.id))
      .orderBy(desc(fundDealsV2.addedAt))
      .limit(pag.limit)
      .offset(pag.offset);

    res.json(paginatedResponse(deals, Number(total), pag));
  } catch (error) {
    console.error('Error fetching fund deals:', error);
    res.status(500).json({ error: 'Failed to fetch fund deals' });
  }
});

// POST /funds/:id/deals — link deal to fund
fundManagementRouter.post('/funds/:id/deals', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Verify fund belongs to org
    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, req.params.id), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const { dealId, allocationPct, allocatedEquity } = req.body;

    const [fundDeal] = await db
      .insert(fundDealsV2)
      .values({
        fundId: req.params.id,
        dealId,
        allocationPct,
        allocatedEquity,
      })
      .returning();

    res.status(201).json(fundDeal);
  } catch (error) {
    console.error('Error linking deal to fund:', error);
    res.status(500).json({ error: 'Failed to link deal to fund' });
  }
});

// PUT /fund-deals/:id — update fund-deal allocation
fundManagementRouter.put('/fund-deals/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Verify fund-deal belongs to this org via parent fund
    const [existing] = await db
      .select({ id: fundDealsV2.id, fundId: fundDealsV2.fundId })
      .from(fundDealsV2)
      .where(eq(fundDealsV2.id, req.params.id));

    if (!existing) return res.status(404).json({ error: 'Fund deal not found' });

    const [fund] = await db
      .select({ id: fundsV2.id })
      .from(fundsV2)
      .where(and(eq(fundsV2.id, existing.fundId), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund deal not found' });

    const [updated] = await db
      .update(fundDealsV2)
      .set(req.body)
      .where(eq(fundDealsV2.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Fund deal not found' });

    res.json(updated);
  } catch (error) {
    console.error('Error updating fund deal:', error);
    res.status(500).json({ error: 'Failed to update fund deal' });
  }
});

// DELETE /fund-deals/:id — unlink deal
fundManagementRouter.delete('/fund-deals/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Verify fund-deal belongs to this org via parent fund
    const [existing] = await db
      .select({ id: fundDealsV2.id, fundId: fundDealsV2.fundId })
      .from(fundDealsV2)
      .where(eq(fundDealsV2.id, req.params.id));

    if (!existing) return res.status(404).json({ error: 'Fund deal not found' });

    const [fund] = await db
      .select({ id: fundsV2.id })
      .from(fundsV2)
      .where(and(eq(fundsV2.id, existing.fundId), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund deal not found' });

    const [deleted] = await db
      .delete(fundDealsV2)
      .where(eq(fundDealsV2.id, req.params.id))
      .returning();

    if (!deleted) return res.status(404).json({ error: 'Fund deal not found' });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting fund deal:', error);
    res.status(500).json({ error: 'Failed to delete fund deal' });
  }
});

// GET /funds/:id/metrics — compute TVPI, DPI, RVPI, management fee YTD, carry position
fundManagementRouter.get('/funds/:id/metrics', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, req.params.id), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const totalCalled = parseFloat(fund.totalCalled || '0');
    const totalDistributed = parseFloat(fund.totalDistributed || '0');
    const nav = parseFloat(fund.nav || '0');

    const tvpi = totalCalled > 0 ? (totalDistributed + nav) / totalCalled : 0;
    const dpi = totalCalled > 0 ? totalDistributed / totalCalled : 0;
    const rvpi = totalCalled > 0 ? nav / totalCalled : 0;

    // Management fee YTD
    const currentYear = new Date().getFullYear();
    const ytdStart = `${currentYear}-01-01`;

    const [feeResult] = await db
      .select({ total: sum(managementFeeInvoices.netFee) })
      .from(managementFeeInvoices)
      .where(
        and(
          eq(managementFeeInvoices.fundId, req.params.id),
          eq(managementFeeInvoices.orgId, orgId),
          sql`${managementFeeInvoices.periodStart} >= ${ytdStart}`
        )
      );

    const managementFeeYTD = parseFloat(feeResult?.total || '0');

    // Carry position: (nav + totalDistributed - totalCalled) * carriedInterest rate
    const carriedInterestRate = parseFloat(fund.carriedInterest || '0');
    const totalProfit = (nav + totalDistributed) - totalCalled;
    const carryPosition = totalProfit > 0 ? totalProfit * carriedInterestRate : 0;

    res.json({
      tvpi,
      dpi,
      rvpi,
      managementFeeYTD,
      carryPosition,
    });
  } catch (error) {
    console.error('Error computing fund metrics:', error);
    res.status(500).json({ error: 'Failed to compute fund metrics' });
  }
});

// ============================================================================
// B.2 — Fund Formation Documents
// ============================================================================

// GET /funds/:id/documents — list documents for fund
fundManagementRouter.get('/funds/:id/documents', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const docs = await db
      .select()
      .from(fundDocuments)
      .where(
        and(eq(fundDocuments.fundId, req.params.id), eq(fundDocuments.orgId, orgId))
      )
      .orderBy(desc(fundDocuments.createdAt));

    res.json(docs);
  } catch (error) {
    console.error('Error fetching fund documents:', error);
    res.status(500).json({ error: 'Failed to fetch fund documents' });
  }
});

// POST /funds/:id/documents — upload document
fundManagementRouter.post('/funds/:id/documents', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [doc] = await db
      .insert(fundDocuments)
      .values({
        ...req.body,
        fundId: req.params.id,
        orgId,
      })
      .returning();

    res.status(201).json(doc);
  } catch (error) {
    console.error('Error creating fund document:', error);
    res.status(500).json({ error: 'Failed to create fund document' });
  }
});

// PUT /fund-documents/:id — update document status/version
fundManagementRouter.put('/fund-documents/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [updated] = await db
      .update(fundDocuments)
      .set(req.body)
      .where(
        and(eq(fundDocuments.id, req.params.id), eq(fundDocuments.orgId, orgId))
      )
      .returning();

    if (!updated) return res.status(404).json({ error: 'Document not found' });

    res.json(updated);
  } catch (error) {
    console.error('Error updating fund document:', error);
    res.status(500).json({ error: 'Failed to update fund document' });
  }
});

// GET /funds/:id/side-letters — list side letters
fundManagementRouter.get('/funds/:id/side-letters', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Verify fund belongs to org
    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, req.params.id), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const letters = await db
      .select()
      .from(sideLetters)
      .where(eq(sideLetters.fundId, req.params.id))
      .orderBy(desc(sideLetters.createdAt));

    res.json(letters);
  } catch (error) {
    console.error('Error fetching side letters:', error);
    res.status(500).json({ error: 'Failed to fetch side letters' });
  }
});

// POST /funds/:id/side-letters — create side letter
fundManagementRouter.post('/funds/:id/side-letters', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Verify fund belongs to org
    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, req.params.id), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const [letter] = await db
      .insert(sideLetters)
      .values({
        ...req.body,
        fundId: req.params.id,
      })
      .returning();

    res.status(201).json(letter);
  } catch (error) {
    console.error('Error creating side letter:', error);
    res.status(500).json({ error: 'Failed to create side letter' });
  }
});

// ============================================================================
// B.3 — Investor Verification / KYC
// ============================================================================

// GET /investor-verification/compliance — list all investors needing review
fundManagementRouter.get('/investor-verification/compliance', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const records = await db
      .select()
      .from(investorVerification)
      .where(
        and(
          eq(investorVerification.orgId, orgId),
          sql`${investorVerification.overallStatus} != 'complete'`
        )
      )
      .orderBy(desc(investorVerification.createdAt));

    res.json(records);
  } catch (error) {
    console.error('Error fetching compliance records:', error);
    res.status(500).json({ error: 'Failed to fetch compliance records' });
  }
});

// GET /investor-verification/expiring — investors with accreditation expiring within 90 days
fundManagementRouter.get('/investor-verification/expiring', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const records = await db
      .select()
      .from(investorVerification)
      .where(
        and(
          eq(investorVerification.orgId, orgId),
          sql`${investorVerification.accreditationExpiresAt} IS NOT NULL`,
          sql`${investorVerification.accreditationExpiresAt} <= NOW() + INTERVAL '90 days'`
        )
      )
      .orderBy(investorVerification.accreditationExpiresAt);

    res.json(records);
  } catch (error) {
    console.error('Error fetching expiring verifications:', error);
    res.status(500).json({ error: 'Failed to fetch expiring verifications' });
  }
});

// GET /investor-verification/:investorId — get verification status
fundManagementRouter.get('/investor-verification/:investorId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [record] = await db
      .select()
      .from(investorVerification)
      .where(
        and(
          eq(investorVerification.investorId, req.params.investorId),
          eq(investorVerification.orgId, orgId)
        )
      );

    if (!record) return res.status(404).json({ error: 'Verification record not found' });

    res.json(record);
  } catch (error) {
    console.error('Error fetching investor verification:', error);
    res.status(500).json({ error: 'Failed to fetch investor verification' });
  }
});

// POST /investor-verification — create verification record
fundManagementRouter.post('/investor-verification', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [record] = await db
      .insert(investorVerification)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(record);
  } catch (error) {
    console.error('Error creating investor verification:', error);
    res.status(500).json({ error: 'Failed to create investor verification' });
  }
});

// PUT /investor-verification/:id — update status (accreditation, KYC, AML)
fundManagementRouter.put('/investor-verification/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [updated] = await db
      .update(investorVerification)
      .set({ ...req.body, updatedAt: new Date() })
      .where(
        and(
          eq(investorVerification.id, req.params.id),
          eq(investorVerification.orgId, orgId)
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: 'Verification record not found' });

    res.json(updated);
  } catch (error) {
    console.error('Error updating investor verification:', error);
    res.status(500).json({ error: 'Failed to update investor verification' });
  }
});

// ============================================================================
// B.4 — Capital Account Ledger
// ============================================================================

// GET /capital-accounts/fund/:fundId — list all capital accounts for fund
fundManagementRouter.get('/capital-accounts/fund/:fundId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Verify fund belongs to org
    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, req.params.fundId), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const pag = parsePagination(req.query as Record<string, any>, { pageSize: 25 });
    const [{ total }] = await db.select({ total: drizzleCount() }).from(capitalAccounts)
      .where(eq(capitalAccounts.fundId, req.params.fundId));
    const accounts = await db
      .select()
      .from(capitalAccounts)
      .where(eq(capitalAccounts.fundId, req.params.fundId))
      .limit(pag.limit)
      .offset(pag.offset);

    res.json(paginatedResponse(accounts, Number(total), pag));
  } catch (error) {
    console.error('Error fetching capital accounts:', error);
    res.status(500).json({ error: 'Failed to fetch capital accounts' });
  }
});

// POST /capital-accounts — create capital account
fundManagementRouter.post('/capital-accounts', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Verify fund belongs to org
    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, req.body.fundId), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const [account] = await db
      .insert(capitalAccounts)
      .values(req.body)
      .returning();

    res.status(201).json(account);
  } catch (error) {
    console.error('Error creating capital account:', error);
    res.status(500).json({ error: 'Failed to create capital account' });
  }
});

// GET /capital-accounts/:id — get account with current balances
fundManagementRouter.get('/capital-accounts/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [account] = await db
      .select()
      .from(capitalAccounts)
      .where(eq(capitalAccounts.id, req.params.id));

    if (!account) return res.status(404).json({ error: 'Capital account not found' });

    // Verify fund belongs to org
    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, account.fundId), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    res.json(account);
  } catch (error) {
    console.error('Error fetching capital account:', error);
    res.status(500).json({ error: 'Failed to fetch capital account' });
  }
});

// GET /capital-accounts/:id/entries — list ledger entries
fundManagementRouter.get('/capital-accounts/:id/entries', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Verify capital account belongs to this org via parent fund
    const [account] = await db
      .select({ id: capitalAccounts.id, fundId: capitalAccounts.fundId })
      .from(capitalAccounts)
      .where(eq(capitalAccounts.id, req.params.id));

    if (!account) return res.status(404).json({ error: 'Capital account not found' });

    const [fund] = await db
      .select({ id: fundsV2.id })
      .from(fundsV2)
      .where(and(eq(fundsV2.id, account.fundId), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Capital account not found' });

    const pag = parsePagination(req.query as Record<string, any>, { pageSize: 50 });
    const [{ total }] = await db.select({ total: drizzleCount() }).from(capitalAccountEntries)
      .where(eq(capitalAccountEntries.capitalAccountId, req.params.id));
    const entries = await db
      .select()
      .from(capitalAccountEntries)
      .where(eq(capitalAccountEntries.capitalAccountId, req.params.id))
      .orderBy(desc(capitalAccountEntries.createdAt))
      .limit(pag.limit)
      .offset(pag.offset);

    res.json(paginatedResponse(entries, Number(total), pag));
  } catch (error) {
    console.error('Error fetching capital account entries:', error);
    res.status(500).json({ error: 'Failed to fetch capital account entries' });
  }
});

// POST /capital-accounts/:id/entries — create ledger entry (immutable)
fundManagementRouter.post('/capital-accounts/:id/entries', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    // Fetch current account
    const [account] = await db
      .select()
      .from(capitalAccounts)
      .where(eq(capitalAccounts.id, req.params.id));

    if (!account) return res.status(404).json({ error: 'Capital account not found' });

    // Verify fund belongs to org
    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, account.fundId), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    // Insert immutable entry
    const [entry] = await db
      .insert(capitalAccountEntries)
      .values({
        ...req.body,
        capitalAccountId: req.params.id,
        fundId: account.fundId,
        investorId: account.investorId,
      })
      .returning();

    // Recalculate account balances from all entries
    const [totals] = await db
      .select({
        totalDebits: sum(capitalAccountEntries.debitAmount),
        totalCredits: sum(capitalAccountEntries.creditAmount),
      })
      .from(capitalAccountEntries)
      .where(eq(capitalAccountEntries.capitalAccountId, req.params.id));

    const totalContributions = parseFloat(totals?.totalDebits || '0');
    const totalDistributions = parseFloat(totals?.totalCredits || '0');
    const openingBalance = parseFloat(account.openingBalance || '0');
    const endingBalance = openingBalance + totalContributions - totalDistributions;

    await db
      .update(capitalAccounts)
      .set({
        totalContributions: totalContributions.toFixed(2),
        totalDistributions: totalDistributions.toFixed(2),
        endingBalance: endingBalance.toFixed(2),
        lastUpdatedAt: new Date(),
      })
      .where(eq(capitalAccounts.id, req.params.id));

    res.status(201).json(entry);
  } catch (error) {
    console.error('Error creating capital account entry:', error);
    res.status(500).json({ error: 'Failed to create capital account entry' });
  }
});

// GET /capital-accounts/:id/statement — generate statement data
fundManagementRouter.get('/capital-accounts/:id/statement', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [account] = await db
      .select()
      .from(capitalAccounts)
      .where(eq(capitalAccounts.id, req.params.id));

    if (!account) return res.status(404).json({ error: 'Capital account not found' });

    // Verify fund belongs to org
    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, account.fundId), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    // Aggregate entries by type
    const entries = await db
      .select()
      .from(capitalAccountEntries)
      .where(eq(capitalAccountEntries.capitalAccountId, req.params.id))
      .orderBy(capitalAccountEntries.entryDate);

    const openingBalance = parseFloat(account.openingBalance || '0');
    let contributions = 0;
    let distributions = 0;
    let fees = 0;

    for (const entry of entries) {
      const net = parseFloat(entry.netAmount || '0');
      const entryType = entry.entryType.toLowerCase();
      if (entryType === 'contribution' || entryType === 'capital_call') {
        contributions += Math.abs(net);
      } else if (entryType === 'distribution') {
        distributions += Math.abs(net);
      } else if (entryType === 'fee' || entryType === 'management_fee') {
        fees += Math.abs(net);
      }
    }

    const endingBalance = openingBalance + contributions - distributions - fees;

    res.json({
      accountId: account.id,
      fundId: account.fundId,
      investorId: account.investorId,
      openingBalance,
      contributions,
      distributions,
      fees,
      endingBalance,
      entries,
    });
  } catch (error) {
    console.error('Error generating capital account statement:', error);
    res.status(500).json({ error: 'Failed to generate statement' });
  }
});

// ============================================================================
// B.5 — Management Fee Calculator
// ============================================================================

// POST /management-fees/calculate — calculate fee based on fund's rate, basis, and step-down rules
fundManagementRouter.post('/management-fees/calculate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();
    const { fundId, period, periodStart, periodEnd } = req.body;

    const [fund] = await db
      .select()
      .from(fundsV2)
      .where(and(eq(fundsV2.id, fundId), eq(fundsV2.orgId, orgId)));

    if (!fund) return res.status(404).json({ error: 'Fund not found' });

    const feeRate = parseFloat(fund.managementFeeRate || '0');
    const feeBasis = fund.managementFeeBasis || 'committed';

    // Determine basis amount
    let basisAmount: number;
    if (feeBasis === 'called' || feeBasis === 'invested') {
      basisAmount = parseFloat(fund.totalCalled || '0');
    } else if (feeBasis === 'nav') {
      basisAmount = parseFloat(fund.nav || '0');
    } else {
      // Default: committed capital
      basisAmount = parseFloat(fund.totalCommitted || '0');
    }

    // Step-down: if past investment period end, reduce fee rate by 50%
    let effectiveRate = feeRate;
    if (fund.investmentPeriodEnd) {
      const investmentPeriodEnd = new Date(fund.investmentPeriodEnd);
      const calcDate = periodStart ? new Date(periodStart) : new Date();
      if (calcDate > investmentPeriodEnd) {
        effectiveRate = feeRate * 0.5;
      }
    }

    const grossFee = basisAmount * effectiveRate;
    const netFee = grossFee; // No expense offset by default

    // Create draft invoice
    const [invoice] = await db
      .insert(managementFeeInvoices)
      .values({
        fundId,
        orgId,
        period,
        periodStart,
        periodEnd,
        basis: basisAmount.toFixed(2),
        feeRate: effectiveRate.toFixed(4),
        grossFee: grossFee.toFixed(2),
        expenseOffset: '0',
        netFee: netFee.toFixed(2),
        status: 'draft',
      })
      .returning();

    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error calculating management fee:', error);
    res.status(500).json({ error: 'Failed to calculate management fee' });
  }
});

// GET /management-fees/fund/:fundId — list fee invoices for fund
fundManagementRouter.get('/management-fees/fund/:fundId', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const invoices = await db
      .select()
      .from(managementFeeInvoices)
      .where(
        and(
          eq(managementFeeInvoices.fundId, req.params.fundId),
          eq(managementFeeInvoices.orgId, orgId)
        )
      )
      .orderBy(desc(managementFeeInvoices.createdAt));

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching management fee invoices:', error);
    res.status(500).json({ error: 'Failed to fetch management fee invoices' });
  }
});

// POST /management-fees/:id/invoice — change status to 'invoiced'
fundManagementRouter.post('/management-fees/:id/invoice', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [updated] = await db
      .update(managementFeeInvoices)
      .set({ status: 'invoiced' })
      .where(
        and(
          eq(managementFeeInvoices.id, req.params.id),
          eq(managementFeeInvoices.orgId, orgId)
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: 'Invoice not found' });

    res.json(updated);
  } catch (error) {
    console.error('Error invoicing management fee:', error);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

// POST /management-fees/:id/paid — change status to 'paid'
fundManagementRouter.post('/management-fees/:id/paid', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    const [updated] = await db
      .update(managementFeeInvoices)
      .set({ status: 'paid' })
      .where(
        and(
          eq(managementFeeInvoices.id, req.params.id),
          eq(managementFeeInvoices.orgId, orgId)
        )
      )
      .returning();

    if (!updated) return res.status(404).json({ error: 'Invoice not found' });

    res.json(updated);
  } catch (error) {
    console.error('Error marking management fee as paid:', error);
    res.status(500).json({ error: 'Failed to update invoice status' });
  }
});

// ============================================================================
// FUND REPORTING — PME, Return Attribution, J-Curve, Vintage Cohorts
// ============================================================================

// GET /funds/:fundId/pme — Public Market Equivalent (Kaplan-Schoar)
fundManagementRouter.get('/funds/:fundId/pme', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { fundId } = req.params;
    const { calculatePME } = await import('../services/fund-reporting-service');
    const result = await calculatePME(orgId, fundId);
    res.json(result);
  } catch (error: any) {
    console.error('Error calculating PME:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate PME' });
  }
});

// GET /funds/:fundId/attribution — Return Attribution (top/bottom deals)
fundManagementRouter.get('/funds/:fundId/attribution', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { fundId } = req.params;
    const { calculateReturnAttribution } = await import('../services/fund-reporting-service');
    const result = await calculateReturnAttribution(orgId, fundId);
    res.json(result);
  } catch (error: any) {
    console.error('Error calculating return attribution:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate return attribution' });
  }
});

// GET /funds/:fundId/j-curve — J-Curve Analysis
fundManagementRouter.get('/funds/:fundId/j-curve', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { fundId } = req.params;
    const { calculateJCurve } = await import('../services/fund-reporting-service');
    const result = await calculateJCurve(orgId, fundId);
    res.json(result);
  } catch (error: any) {
    console.error('Error calculating J-curve:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate J-curve' });
  }
});

// GET /vintage-cohorts — Vintage Year Cohort Performance
fundManagementRouter.get('/vintage-cohorts', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    const { getVintageCohorts } = await import('../services/fund-reporting-service');
    const result = await getVintageCohorts(orgId);
    res.json({ cohorts: result });
  } catch (error: any) {
    console.error('Error fetching vintage cohorts:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch vintage cohorts' });
  }
});
