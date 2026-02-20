import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { z } from "zod";
import { eq, and, desc, inArray } from "drizzle-orm";
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

router.post("/compare-models", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);

    const schema = z.object({
      projectIds: z.array(z.string()).min(2, 'Select at least 2 projects').max(10, 'Maximum 10 projects'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid request' });
    }
    const { projectIds } = parsed.data;

    const projects = await db.select().from(modelingProjects).where(
      and(eq(modelingProjects.orgId, orgId), inArray(modelingProjects.id, projectIds))
    );

    if (projects.length < 2) {
      return res.status(404).json({ error: 'Not enough projects found' });
    }

    const { proFormaEngineService } = await import('../services/pro-forma-engine-service');

    const results = await Promise.all(projects.map(async (project) => {
      try {
        const proForma = await proFormaEngineService.generateProForma(project.id, orgId, 'base');
        const m = proForma.metrics;
        const capitalAppreciation = m.exitValue - m.purchasePrice;
        const capitalAppreciationPct = m.purchasePrice > 0 ? (capitalAppreciation / m.purchasePrice) * 100 : 0;
        const totalEquity = m.purchasePrice - (m.debtSchedule?.totalDebtAtClose || 0);
        const gainOnSale = m.netExitProceeds - totalEquity;
        const cashOnCashY1 = totalEquity > 0 && proForma.leveredCashFlow?.[0] != null ? (proForma.leveredCashFlow[0] / totalEquity) * 100 : (totalEquity > 0 && proForma.noi[0] ? (proForma.noi[0] / totalEquity) * 100 : 0);

        return {
          projectId: project.id,
          projectName: project.marinaName || project.name,
          purchasePrice: m.purchasePrice,
          exitValue: m.exitValue,
          leveredIRR: m.irr,
          unleveredIRR: m.unleveredIrr,
          equityMultiple: m.equityMultiple,
          unleveredEquityMultiple: m.unleveredEquityMultiple,
          totalReturn: m.totalReturn,
          capitalAppreciation,
          capitalAppreciationPct,
          gainOnSale,
          goingInCapRate: m.goingInCapRate,
          exitCapRate: m.exitCapRate,
          year1Noi: m.year1Noi,
          stabilizedNoi: m.stabilizedNoi,
          totalEquity,
          cashOnCashY1,
          ltv: m.ltv || 0,
          dscr: m.avgDscr || 0,
          debtYield: m.debtYield || 0,
          projectionYears: proForma.years.length,
          noiByYear: proForma.noi,
          years: proForma.years,
          netExitProceeds: m.netExitProceeds,
          sellingFees: m.sellingFees,
          loanPayoff: m.loanPayoff,
        };
      } catch (e) {
        return {
          projectId: project.id,
          projectName: project.marinaName || project.name,
          error: 'Failed to generate pro forma',
        };
      }
    }));

    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.post("/portfolio-simulation", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);

    const schema = z.object({
      includeProjectIds: z.array(z.string()).min(1, 'Select at least one project'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid request' });
    }
    const { includeProjectIds } = parsed.data;

    const projects = await db.select().from(modelingProjects).where(
      and(eq(modelingProjects.orgId, orgId), inArray(modelingProjects.id, includeProjectIds))
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: 'No projects found for the provided IDs' });
    }

    const { proFormaEngineService } = await import('../services/pro-forma-engine-service');

    let portfolioTotalEquity = 0;
    let portfolioTotalReturn = 0;
    let portfolioTotalPurchasePrice = 0;
    let portfolioTotalExitValue = 0;
    let portfolioTotalNOIY1 = 0;
    let portfolioTotalGainOnSale = 0;
    const assetDetails: any[] = [];

    for (const project of projects) {
      try {
        const proForma = await proFormaEngineService.generateProForma(project.id, orgId, 'base');
        const m = proForma.metrics;
        const totalEquity = m.purchasePrice - (m.debtSchedule?.totalDebtAtClose || 0);
        const gainOnSale = m.netExitProceeds - totalEquity;

        portfolioTotalEquity += totalEquity;
        portfolioTotalReturn += m.totalReturn;
        portfolioTotalPurchasePrice += m.purchasePrice;
        portfolioTotalExitValue += m.exitValue;
        portfolioTotalNOIY1 += proForma.noi[0] || 0;
        portfolioTotalGainOnSale += gainOnSale;

        assetDetails.push({
          projectId: project.id,
          projectName: project.marinaName || project.name,
          purchasePrice: m.purchasePrice,
          exitValue: m.exitValue,
          totalEquity,
          leveredIRR: m.irr,
          unleveredIRR: m.unleveredIrr,
          equityMultiple: m.equityMultiple,
          totalReturn: m.totalReturn,
          gainOnSale,
          year1Noi: proForma.noi[0] || 0,
          weight: 0,
        });
      } catch (e) {
        assetDetails.push({
          projectId: project.id,
          projectName: project.marinaName || project.name,
          error: 'Failed to generate pro forma',
        });
      }
    }

    for (const asset of assetDetails) {
      if (!asset.error && portfolioTotalEquity > 0) {
        asset.weight = (asset.totalEquity / portfolioTotalEquity) * 100;
      }
    }

    const portfolioEquityMultiple = portfolioTotalEquity > 0 ? portfolioTotalReturn / portfolioTotalEquity : 0;
    const portfolioCapitalAppreciation = portfolioTotalExitValue - portfolioTotalPurchasePrice;
    const portfolioCapitalAppreciationPct = portfolioTotalPurchasePrice > 0
      ? (portfolioCapitalAppreciation / portfolioTotalPurchasePrice) * 100 : 0;
    const portfolioGoingInCapRate = portfolioTotalPurchasePrice > 0
      ? (portfolioTotalNOIY1 / portfolioTotalPurchasePrice) * 100 : 0;

    const weightedIRR = assetDetails.reduce((sum, a) => {
      if (a.error || !a.weight) return sum;
      return sum + (a.leveredIRR * a.weight / 100);
    }, 0);

    res.json({
      portfolio: {
        totalEquity: portfolioTotalEquity,
        totalReturn: portfolioTotalReturn,
        totalPurchasePrice: portfolioTotalPurchasePrice,
        totalExitValue: portfolioTotalExitValue,
        equityMultiple: portfolioEquityMultiple,
        capitalAppreciation: portfolioCapitalAppreciation,
        capitalAppreciationPct: portfolioCapitalAppreciationPct,
        goingInCapRate: portfolioGoingInCapRate,
        totalGainOnSale: portfolioTotalGainOnSale,
        weightedIRR,
        totalNOIY1: portfolioTotalNOIY1,
        assetCount: assetDetails.filter(a => !a.error).length,
      },
      assets: assetDetails,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
