import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { z } from "zod";
import { eq, and, or, desc, inArray } from "drizzle-orm";
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
import { computeModelReturns, computePortfolioReturns, computeFundReturns, ReturnView } from "../services/returns-service";
import { calculateXIRR, calculateNPV, DatedCashFlow } from "../../shared/finance/xirr";

const router = Router();

function getOrgId(req: Request): string | null {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedOrgId) return authReq.validatedOrgId;
  return (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId || (req as any).session?.orgId || null;
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
    let propertyIds = propertyIdsParam ? propertyIdsParam.split(',') : undefined;

    // If no explicit propertyIds provided, scope to owned properties
    // by filtering to modeling projects with dealOutcome='won' or any owned asset link
    if (!propertyIds) {
      const ownedProjects = await db.select({ propertyId: modelingProjects.propertyId })
        .from(modelingProjects)
        .where(and(
          eq(modelingProjects.orgId, orgId),
          or(
            eq(modelingProjects.dealOutcome, 'won'),
            eq(modelingProjects.dealSource, 'owned_marina')
          )
        ));
      const ownedPropIds = ownedProjects
        .map(p => p.propertyId)
        .filter((id): id is string => id !== null && id !== undefined);
      if (ownedPropIds.length > 0) {
        propertyIds = ownedPropIds;
      }
    }

    const result = await computePortfolioReturns(orgId, view, start, end, propertyIds);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/fund/:fundId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { fundId } = req.params;
    const view = (req.query.view as ReturnView) || 'levered';
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const result = await computeFundReturns(orgId, fundId, view, start, end);
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

// ============================================================================
// AFTER-TAX RETURN ANALYSIS
// Computes pre-tax and after-tax IRR, equity multiple, CoC, NPV for an asset.
// Covers: ordinary income tax on operations, depreciation shield, Section 1250
// recapture, LTCG, NIIT (3.8%), and state/local rates.
// Handles both asset-level and portfolio-level output.
// ============================================================================

function buildAmortizationSchedule(
  principal: number,
  annualRate: number,
  termYears: number,
  holdPeriodYears: number,
): { interest: number; principalPaid: number; balance: number }[] {
  if (principal <= 0 || annualRate <= 0 || termYears <= 0) {
    return Array.from({ length: holdPeriodYears }, () => ({ interest: 0, principalPaid: 0, balance: 0 }));
  }
  const monthlyRate = annualRate / 12;
  const n = termYears * 12;
  const monthlyPayment = monthlyRate > 0
    ? principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    : principal / n;

  const years: { interest: number; principalPaid: number; balance: number }[] = [];
  let balance = principal;

  for (let y = 0; y < holdPeriodYears; y++) {
    let yearInterest = 0;
    let yearPrincipal = 0;
    for (let m = 0; m < 12; m++) {
      if (balance <= 0) break;
      const intPayment = balance * monthlyRate;
      const prinPayment = Math.min(monthlyPayment - intPayment, balance);
      yearInterest += intPayment;
      yearPrincipal += prinPayment;
      balance = Math.max(0, balance - prinPayment);
    }
    years.push({ interest: yearInterest, principalPaid: yearPrincipal, balance });
  }
  return years;
}

router.post('/after-tax-analysis', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      purchasePrice: z.number().positive(),
      landValue: z.number().min(0).default(0),
      equityInvested: z.number().positive(),
      loanAmount: z.number().min(0).default(0),
      interestRate: z.number().min(0).max(1).default(0),
      amortizationYears: z.number().int().positive().default(30),
      holdPeriodYears: z.number().int().min(1).max(30),
      year1NOI: z.number(),
      noiGrowthRate: z.number().default(0.03),
      exitCapRate: z.number().positive().default(0.065),
      sellingCostsPct: z.number().min(0).max(0.1).default(0.02),
      // Tax inputs
      ordinaryRate: z.number().min(0).max(1).default(0.37),
      ltcgRate: z.number().min(0).max(1).default(0.20),
      recaptureRate: z.number().min(0).max(1).default(0.25),
      niitRate: z.number().min(0).max(1).default(0.038),
      stateLocalRate: z.number().min(0).max(1).default(0),
      // Depreciation
      depreciableLifeYears: z.number().int().positive().default(39),
      bonusDepreciationPct: z.number().min(0).max(1).default(0),
      // NPV discount rate
      targetDiscountRate: z.number().min(0).max(1).default(0.08),
    }).parse(req.body);

    const p = body;
    const improvementsBasis = p.purchasePrice - p.landValue;
    const annualSLDepreciation = improvementsBasis > 0 ? improvementsBasis / p.depreciableLifeYears : 0;

    // Bonus depreciation (e.g. cost seg) accelerates first-year deduction
    const bonusAmount = improvementsBasis * p.bonusDepreciationPct;
    const remainingBasisForSL = improvementsBasis - bonusAmount;
    const annualSLAfterBonus = remainingBasisForSL > 0 ? remainingBasisForSL / p.depreciableLifeYears : 0;

    // Build annual NOI schedule
    const noi: number[] = [];
    for (let y = 0; y < p.holdPeriodYears; y++) {
      noi.push(p.year1NOI * Math.pow(1 + p.noiGrowthRate, y));
    }

    // Build amortization schedule (annual interest / principal / balance)
    const amort = buildAmortizationSchedule(p.loanAmount, p.interestRate, p.amortizationYears, p.holdPeriodYears);
    const loanBalanceAtExit = amort[p.holdPeriodYears - 1]?.balance ?? 0;

    // Exit value: terminal NOI / exit cap rate
    const terminalNOI = noi[p.holdPeriodYears - 1] * (1 + p.noiGrowthRate);
    const exitValue = terminalNOI / p.exitCapRate;
    const sellingCosts = exitValue * p.sellingCostsPct;
    const preTaxNetExitProceeds = exitValue - sellingCosts - loanBalanceAtExit;

    // ── Year-by-year computations ─────────────────────────────────────────
    const effectiveOrdinaryRate = p.ordinaryRate + p.stateLocalRate;

    const yearly: Array<{
      year: number;
      noi: number;
      totalDebtService: number;
      interest: number;
      depreciation: number;
      taxableIncome: number;
      ordinaryTax: number;
      depShieldBenefit: number;
      preTaxLeveredCF: number;
      afterTaxLeveredCF: number;
      cumulativeDepreciation: number;
    }> = [];

    let cumDep = 0;

    for (let y = 0; y < p.holdPeriodYears; y++) {
      const yearNOI = noi[y];
      const interest = amort[y]?.interest ?? 0;
      const principal = amort[y]?.principalPaid ?? 0;
      const totalDS = interest + principal;
      const preTaxCF = yearNOI - totalDS;

      // Depreciation for this year (bonus in year 1, then straight-line)
      const dep = y === 0 ? bonusAmount + annualSLAfterBonus : annualSLAfterBonus;
      cumDep += dep;

      // Taxable ordinary income = NOI - interest (only) - depreciation
      const taxableIncome = yearNOI - interest - dep;

      let ordinaryTax = 0;
      let depShieldBenefit = 0;

      if (taxableIncome > 0) {
        ordinaryTax = taxableIncome * effectiveOrdinaryRate;
      } else {
        // Passive loss creates a tax shield (offset against other income)
        depShieldBenefit = Math.abs(taxableIncome) * effectiveOrdinaryRate;
      }

      const afterTaxCF = preTaxCF - ordinaryTax + depShieldBenefit;

      yearly.push({
        year: y + 1,
        noi: yearNOI,
        totalDebtService: totalDS,
        interest,
        depreciation: dep,
        taxableIncome,
        ordinaryTax,
        depShieldBenefit,
        preTaxLeveredCF: preTaxCF,
        afterTaxLeveredCF: afterTaxCF,
        cumulativeDepreciation: cumDep,
      });
    }

    // ── Exit tax calculation ──────────────────────────────────────────────
    const totalAccumDep = cumDep;
    const adjustedBasis = p.purchasePrice - totalAccumDep;
    const totalGain = exitValue - sellingCosts - adjustedBasis;
    const depRecapture = Math.max(0, Math.min(totalAccumDep, totalGain));
    const capitalGain = Math.max(0, totalGain - depRecapture);

    const effectiveRecaptureRate = Math.min(p.ordinaryRate, p.recaptureRate) + p.stateLocalRate;
    const recaptureTax = depRecapture * effectiveRecaptureRate;
    const ltcgTax = capitalGain * (p.ltcgRate + p.stateLocalRate);
    const niitTax = (depRecapture + capitalGain) * p.niitRate;
    const totalExitTax = recaptureTax + ltcgTax + niitTax;

    const netAfterTaxExitProceeds = preTaxNetExitProceeds - totalExitTax;

    // ── Build dated cash flow series for IRR ─────────────────────────────
    const acquisitionDate = new Date();
    acquisitionDate.setMonth(acquisitionDate.getMonth() - p.holdPeriodYears * 12); // assume starting in past for illustration
    const startYear = new Date().getFullYear() - p.holdPeriodYears;

    const preTaxFlows: DatedCashFlow[] = [
      { date: `${startYear}-01-01`, amount: -p.equityInvested },
      ...yearly.map((row, i) => ({
        date: `${startYear + i + 1}-01-01`,
        amount: row.preTaxLeveredCF + (i === p.holdPeriodYears - 1 ? preTaxNetExitProceeds : 0),
      })),
    ];

    const afterTaxFlows: DatedCashFlow[] = [
      { date: `${startYear}-01-01`, amount: -p.equityInvested },
      ...yearly.map((row, i) => ({
        date: `${startYear + i + 1}-01-01`,
        amount: row.afterTaxLeveredCF + (i === p.holdPeriodYears - 1 ? netAfterTaxExitProceeds : 0),
      })),
    ];

    const preTaxIRR = calculateXIRR(preTaxFlows);
    const afterTaxIRR = calculateXIRR(afterTaxFlows);

    // Equity multiples
    const preTaxTotalReturn = yearly.reduce((s, r) => s + r.preTaxLeveredCF, 0) + preTaxNetExitProceeds;
    const afterTaxTotalReturn = yearly.reduce((s, r) => s + r.afterTaxLeveredCF, 0) + netAfterTaxExitProceeds;
    const preTaxEM = preTaxTotalReturn / p.equityInvested;
    const afterTaxEM = afterTaxTotalReturn / p.equityInvested;

    // NPV
    const preTaxNPV = calculateNPV(preTaxFlows, p.targetDiscountRate * 100);
    const afterTaxNPV = calculateNPV(afterTaxFlows, p.targetDiscountRate * 100);

    // Cash-on-cash Y1
    const preTaxCoCY1 = yearly[0] ? (yearly[0].preTaxLeveredCF / p.equityInvested) * 100 : 0;
    const afterTaxCoCY1 = yearly[0] ? (yearly[0].afterTaxLeveredCF / p.equityInvested) * 100 : 0;

    // Total tax shield (depreciation benefit over hold period)
    const totalDepShieldBenefit = yearly.reduce((s, r) => s + r.depShieldBenefit, 0);
    const totalOrdinaryTaxPaid = yearly.reduce((s, r) => s + r.ordinaryTax, 0);

    res.json({
      preTax: {
        irr: preTaxIRR.irr,
        equityMultiple: preTaxEM,
        npv: preTaxNPV,
        cashOnCashY1: preTaxCoCY1,
        totalReturn: preTaxTotalReturn,
        netExitProceeds: preTaxNetExitProceeds,
      },
      afterTax: {
        irr: afterTaxIRR.irr,
        equityMultiple: afterTaxEM,
        npv: afterTaxNPV,
        cashOnCashY1: afterTaxCoCY1,
        totalReturn: afterTaxTotalReturn,
        netExitProceeds: netAfterTaxExitProceeds,
      },
      irrDrag: preTaxIRR.irr - afterTaxIRR.irr,
      emDrag: preTaxEM - afterTaxEM,
      exitBreakdown: {
        exitValue,
        sellingCosts,
        loanPayoff: loanBalanceAtExit,
        adjustedBasis,
        totalGain,
        depreciationRecapture: depRecapture,
        capitalGain,
        recaptureTax,
        ltcgTax,
        niitTax,
        totalExitTax,
        preTaxNetExitProceeds,
        netAfterTaxExitProceeds,
      },
      taxComponents: {
        totalOrdinaryTaxPaid,
        totalDepShieldBenefit,
        recaptureTax,
        ltcgTax,
        niitTax,
        stateTaxEstimate: (totalOrdinaryTaxPaid + recaptureTax + ltcgTax) * (p.stateLocalRate / Math.max(effectiveOrdinaryRate, 0.01)),
        totalTaxBurden: totalOrdinaryTaxPaid - totalDepShieldBenefit + totalExitTax,
        netTaxSavingsFromDepreciation: totalDepShieldBenefit - (depRecapture * Math.max(0, effectiveRecaptureRate - p.ltcgRate - p.stateLocalRate)),
      },
      yearlyBreakdown: yearly,
      exitValue,
      totalAccumulatedDepreciation: totalAccumDep,
      inputs: {
        purchasePrice: p.purchasePrice,
        equityInvested: p.equityInvested,
        loanAmount: p.loanAmount,
        holdPeriodYears: p.holdPeriodYears,
        year1NOI: p.year1NOI,
        exitCapRate: p.exitCapRate,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
