import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  returnsLedger,
  returnsValuation,
  loanBalanceTimeline,
  insertReturnsLedgerSchema,
  insertReturnsValuationSchema,
  insertLoanBalanceTimelineSchema,
  modelingProjects,
} from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth-resolver";
import { computeModelReturns, computePortfolioReturns, ReturnView } from "../services/returns-service";

const router = Router();

function getOrgId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedOrgId) return authReq.validatedOrgId;
  return (req as any).tenantId || (req as any).user?.orgId || (req as any).session?.orgId || 'org-1';
}

function getUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedUserId) return authReq.validatedUserId;
  return (req as any).session?.userId || (req as any).user?.id || 'user-1';
}

router.get("/model/:modelId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { modelId } = req.params;
    const view = (req.query.view as ReturnView) || 'levered';
    const scenarioId = req.query.scenarioId as string | undefined;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const result = await computeModelReturns(
      { orgId, modelId, scenarioId, startDate: start, endDate: end },
      view
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/property/:propertyId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { propertyId } = req.params;
    const view = (req.query.view as ReturnView) || 'levered';
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const result = await computeModelReturns(
      { orgId, propertyId, startDate: start, endDate: end },
      view
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/portfolio", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const view = (req.query.view as ReturnView) || 'levered';
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;
    const propertyIdsParam = req.query.propertyIds as string | undefined;
    const propertyIds = propertyIdsParam ? propertyIdsParam.split(',') : undefined;

    const result = await computePortfolioReturns(orgId, view, start, end, propertyIds);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/ledger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const data = insertReturnsLedgerSchema.parse({
      ...req.body,
      orgId,
      userId,
    });

    const [entry] = await db.insert(returnsLedger).values(data).returning();
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.put("/ledger/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const existing = await db.select().from(returnsLedger)
      .where(and(eq(returnsLedger.id, id), eq(returnsLedger.orgId, orgId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Ledger entry not found" });
    }

    const { bucket, amount, asOfDate, memo, source, scenarioId, modelId, propertyId, dealId } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (bucket !== undefined) updates.bucket = bucket;
    if (amount !== undefined) updates.amount = amount;
    if (asOfDate !== undefined) updates.asOfDate = asOfDate;
    if (memo !== undefined) updates.memo = memo;
    if (source !== undefined) updates.source = source;
    if (scenarioId !== undefined) updates.scenarioId = scenarioId;
    if (modelId !== undefined) updates.modelId = modelId;
    if (propertyId !== undefined) updates.propertyId = propertyId;
    if (dealId !== undefined) updates.dealId = dealId;

    const [updated] = await db.update(returnsLedger)
      .set(updates)
      .where(and(eq(returnsLedger.id, id), eq(returnsLedger.orgId, orgId)))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/ledger/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;

    const existing = await db.select().from(returnsLedger)
      .where(and(eq(returnsLedger.id, id), eq(returnsLedger.orgId, orgId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ message: "Ledger entry not found" });
    }

    await db.delete(returnsLedger).where(and(eq(returnsLedger.id, id), eq(returnsLedger.orgId, orgId)));
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/valuation", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const data = insertReturnsValuationSchema.parse({
      ...req.body,
      orgId,
      userId,
    });

    const [entry] = await db.insert(returnsValuation).values(data).returning();
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.post("/loan-balance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);

    const data = insertLoanBalanceTimelineSchema.parse({
      ...req.body,
      orgId,
      userId,
    });

    const [entry] = await db.insert(loanBalanceTimeline).values(data).returning();
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

router.post("/seed/:modelId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { modelId } = req.params;

    const project = await db.select().from(modelingProjects)
      .where(and(eq(modelingProjects.id, modelId), eq(modelingProjects.orgId, orgId)))
      .limit(1);

    if (project.length === 0) {
      return res.status(404).json({ message: "Modeling project not found" });
    }

    const existingEntries = await db.select().from(returnsLedger)
      .where(and(eq(returnsLedger.modelId, modelId), eq(returnsLedger.orgId, orgId)))
      .limit(1);

    if (existingEntries.length > 0) {
      return res.json({ message: "Seed data already exists for this model", seeded: false });
    }

    const propertyId = `prop-${modelId}`;
    const acquisitionDate = '2024-01-31';
    const purchasePrice = parseFloat(project[0].purchasePrice || '5000000');
    const loanAmount = purchasePrice * 0.7;
    const equityAmount = purchasePrice * 0.3;

    const ledgerEntries: any[] = [];

    ledgerEntries.push({
      orgId, userId, propertyId, modelId,
      asOfDate: acquisitionDate,
      bucket: 'ACQUISITION',
      amount: (-purchasePrice).toFixed(2),
      source: 'MODEL',
      memo: 'Property acquisition',
    });

    ledgerEntries.push({
      orgId, userId, propertyId, modelId,
      asOfDate: acquisitionDate,
      bucket: 'EQUITY_CONTRIBUTION',
      amount: (-equityAmount).toFixed(2),
      source: 'MODEL',
      memo: 'Initial equity contribution',
    });

    ledgerEntries.push({
      orgId, userId, propertyId, modelId,
      asOfDate: acquisitionDate,
      bucket: 'LOAN_PROCEEDS',
      amount: loanAmount.toFixed(2),
      source: 'MODEL',
      memo: 'Acquisition loan proceeds',
    });

    const monthlyNOI = (purchasePrice * 0.08) / 12;
    const monthlyInterest = (loanAmount * 0.065) / 12;
    const monthlyPrincipal = loanAmount / (25 * 12);
    let runningBalance = loanAmount;

    for (let m = 1; m <= 24; m++) {
      const date = new Date(2024, m, 0);
      const dateStr = date.toISOString().split('T')[0];

      ledgerEntries.push({
        orgId, userId, propertyId, modelId,
        asOfDate: dateStr,
        bucket: 'OPERATING_CASHFLOW',
        amount: monthlyNOI.toFixed(2),
        source: 'MODEL',
        memo: `Month ${m} NOI`,
      });

      ledgerEntries.push({
        orgId, userId, propertyId, modelId,
        asOfDate: dateStr,
        bucket: 'DEBT_SERVICE_INTEREST',
        amount: (-monthlyInterest).toFixed(2),
        source: 'MODEL',
        memo: `Month ${m} interest`,
      });

      ledgerEntries.push({
        orgId, userId, propertyId, modelId,
        asOfDate: dateStr,
        bucket: 'DEBT_SERVICE_PRINCIPAL',
        amount: (-monthlyPrincipal).toFixed(2),
        source: 'MODEL',
        memo: `Month ${m} principal`,
      });

      runningBalance -= monthlyPrincipal;
    }

    ledgerEntries.push({
      orgId, userId, propertyId, modelId,
      asOfDate: '2024-06-30',
      bucket: 'CAPEX',
      amount: (-purchasePrice * 0.02).toFixed(2),
      source: 'MODEL',
      memo: 'Dock repairs CapEx',
    });

    await db.insert(returnsLedger).values(ledgerEntries);

    const valuationEntries: any[] = [];
    for (let q = 0; q < 8; q++) {
      const date = new Date(2024, (q + 1) * 3, 0);
      const dateStr = date.toISOString().split('T')[0];
      const appreciation = 1 + (q + 1) * 0.01;
      valuationEntries.push({
        orgId, userId, propertyId, modelId,
        asOfDate: dateStr,
        marketValue: (purchasePrice * appreciation).toFixed(2),
        valueSource: 'MODEL',
        notes: `Q${(q % 4) + 1} ${2024 + Math.floor(q / 4)} valuation`,
      });
    }
    await db.insert(returnsValuation).values(valuationEntries);

    const loanEntries: any[] = [];
    let balance = loanAmount;
    for (let m = 0; m <= 24; m++) {
      const date = new Date(2024, m, 0);
      if (m === 0) {
        loanEntries.push({
          orgId, userId, propertyId, modelId,
          asOfDate: acquisitionDate,
          loanBalance: balance.toFixed(2),
        });
      } else {
        const dateStr = date.toISOString().split('T')[0];
        balance -= monthlyPrincipal;
        loanEntries.push({
          orgId, userId, propertyId, modelId,
          asOfDate: dateStr,
          loanBalance: Math.max(0, balance).toFixed(2),
        });
      }
    }
    await db.insert(loanBalanceTimeline).values(loanEntries);

    res.json({ message: "Seed data created successfully", seeded: true, entries: ledgerEntries.length });
  } catch (err) {
    next(err);
  }
});

export default router;
