import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { z } from "zod";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import {
  budgets, budgetVersions, budgetDimensions, budgetLines, budgetAmounts,
  actualsFacts, budgetTargets,
  insertBudgetSchema, insertBudgetVersionSchema, insertBudgetLineSchema,
  insertBudgetAmountSchema, insertActualsFactSchema,
  type Budget, type BudgetVersion, type BudgetLine, type BudgetAmount, type ActualsFact,
} from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth-resolver";

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

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const rows = await db.select().from(budgets)
      .where(eq(budgets.userId, userId))
      .orderBy(desc(budgets.fiscalYear), desc(budgets.updatedAt));
    const result = await Promise.all(rows.map(async (b) => {
      const versions = await db.select().from(budgetVersions).where(eq(budgetVersions.budgetId, b.id));
      return { ...b, versions };
    }));
    res.json(result);
  } catch (err) { next(err); }
});

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const body = insertBudgetSchema.parse({ ...req.body, userId, orgId });
    const [row] = await db.insert(budgets).values(body).returning();
    const [ver] = await db.insert(budgetVersions).values({
      budgetId: row.id,
      name: "Original Budget",
      isPrimary: true,
    }).returning();

    if (req.body.seedMethod === "ACTUALS") {
      await seedVersionFromActuals(ver.id, userId, orgId, row.fiscalYear);
    } else if (req.body.seedMethod === "BLANK") {
      await seedBlankVersion(ver.id, row.fiscalYear);
    }

    res.status(201).json({ budget: row, version: ver });
  } catch (err) { next(err); }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const [row] = await db.select().from(budgets).where(and(eq(budgets.id, req.params.id), eq(budgets.userId, userId)));
    if (!row) return res.status(404).json({ error: "Budget not found" });
    const versions = await db.select().from(budgetVersions).where(eq(budgetVersions.budgetId, row.id));
    res.json({ ...row, versions });
  } catch (err) { next(err); }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const allowed = z.object({
      name: z.string().optional(),
      status: z.enum(["DRAFT", "LOCKED", "ARCHIVED"]).optional(),
    }).parse(req.body);
    const [row] = await db.update(budgets).set({ ...allowed, updatedAt: new Date() }).where(and(eq(budgets.id, req.params.id), eq(budgets.userId, userId))).returning();
    if (!row) return res.status(404).json({ error: "Budget not found" });
    res.json(row);
  } catch (err) { next(err); }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    await db.delete(budgets).where(and(eq(budgets.id, req.params.id), eq(budgets.userId, userId)));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get("/:id/versions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, req.params.id), eq(budgets.userId, userId)));
    if (!budget) return res.status(404).json({ error: "Budget not found" });
    const rows = await db.select().from(budgetVersions).where(eq(budgetVersions.budgetId, req.params.id));
    res.json(rows);
  } catch (err) { next(err); }
});

router.get("/version/:versionId/grid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const lines = await db.select().from(budgetLines)
      .where(eq(budgetLines.budgetVersionId, versionId))
      .orderBy(asc(budgetLines.sortOrder));

    if (lines.length === 0) return res.json({ lines: [], amounts: {} });

    const lineIds = lines.map(l => l.id);
    const amounts = await db.select().from(budgetAmounts)
      .where(inArray(budgetAmounts.budgetLineId, lineIds));

    const amountMap: Record<string, Record<string, string>> = {};
    for (const a of amounts) {
      if (!amountMap[a.budgetLineId]) amountMap[a.budgetLineId] = {};
      amountMap[a.budgetLineId][a.periodStart as string] = a.amount;
    }
    res.json({ lines, amounts: amountMap });
  } catch (err) { next(err); }
});

router.post("/version/:versionId/lines", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = insertBudgetLineSchema.parse({ ...req.body, budgetVersionId: req.params.versionId });
    const [row] = await db.insert(budgetLines).values(body).returning();
    res.status(201).json(row);
  } catch (err) { next(err); }
});

const batchAmountSchema = z.object({
  updates: z.array(z.object({
    budgetLineId: z.string(),
    periodStart: z.string(),
    amount: z.string(),
  })),
});

router.put("/version/:versionId/amounts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { updates } = batchAmountSchema.parse(req.body);
    const results: BudgetAmount[] = [];
    for (const u of updates) {
      const existing = await db.select().from(budgetAmounts)
        .where(and(
          eq(budgetAmounts.budgetLineId, u.budgetLineId),
          eq(budgetAmounts.periodStart, u.periodStart),
        ));
      if (existing.length > 0) {
        const [row] = await db.update(budgetAmounts)
          .set({ amount: u.amount, updatedAt: new Date() })
          .where(eq(budgetAmounts.id, existing[0].id))
          .returning();
        results.push(row);
      } else {
        const [row] = await db.insert(budgetAmounts)
          .values({ budgetLineId: u.budgetLineId, periodStart: u.periodStart, amount: u.amount })
          .returning();
        results.push(row);
      }
    }
    res.json(results);
  } catch (err) { next(err); }
});

router.get("/bva/:budgetId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const { budgetId } = req.params;

    const [budget] = await db.select().from(budgets).where(eq(budgets.id, budgetId));
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    const versions = await db.select().from(budgetVersions).where(eq(budgetVersions.budgetId, budgetId));
    const primary = versions.find(v => v.isPrimary) || versions[0];
    if (!primary) return res.json({ lines: [], totals: {} });

    const lines = await db.select().from(budgetLines)
      .where(eq(budgetLines.budgetVersionId, primary.id))
      .orderBy(asc(budgetLines.sortOrder));

    if (lines.length === 0) return res.json({ lines: [], totals: {} });

    const lineIds = lines.map(l => l.id);
    const amounts = await db.select().from(budgetAmounts)
      .where(inArray(budgetAmounts.budgetLineId, lineIds));

    const actuals = await db.select().from(actualsFacts)
      .where(and(
        eq(actualsFacts.userId, userId),
        sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${budget.fiscalYear}`,
      ));

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = (i + 1).toString().padStart(2, '0');
      return `${budget.fiscalYear}-${m}-01`;
    });

    const bvaLines = lines.map(line => {
      const lineAmounts: Record<string, string> = {};
      for (const a of amounts) {
        if (a.budgetLineId === line.id) lineAmounts[a.periodStart as string] = a.amount;
      }

      const monthlyData = months.map(month => {
        const budgetAmt = parseFloat(lineAmounts[month] || '0');
        const actualAmt = actuals
          .filter(a => (a.periodStart as string) === month && a.accountKey === line.accountKey)
          .reduce((s, a) => s + parseFloat(a.amount), 0);

        const varDollar = actualAmt - budgetAmt;
        const varPct = budgetAmt !== 0 ? (varDollar / Math.abs(budgetAmt)) * 100 : 0;
        const isExpense = ['COGS', 'OPEX', 'OTHER_EXPENSE'].includes(line.lineType);
        const favorable = isExpense ? varDollar < 0 : varDollar > 0;

        return { month, budget: budgetAmt, actual: actualAmt, varDollar, varPct: Math.round(varPct * 100) / 100, favorable };
      });

      const totalBudget = monthlyData.reduce((s, m) => s + m.budget, 0);
      const totalActual = monthlyData.reduce((s, m) => s + m.actual, 0);
      const totalVarDollar = totalActual - totalBudget;
      const totalVarPct = totalBudget !== 0 ? (totalVarDollar / Math.abs(totalBudget)) * 100 : 0;
      const isExpense = ['COGS', 'OPEX', 'OTHER_EXPENSE'].includes(line.lineType);

      return {
        ...line,
        monthly: monthlyData,
        totals: {
          budget: totalBudget,
          actual: totalActual,
          varDollar: totalVarDollar,
          varPct: Math.round(totalVarPct * 100) / 100,
          favorable: isExpense ? totalVarDollar < 0 : totalVarDollar > 0,
        },
      };
    });

    const summaryTotals = {
      totalRevenueBudget: 0, totalRevenueActual: 0,
      totalExpenseBudget: 0, totalExpenseActual: 0,
      noiBudget: 0, noiActual: 0,
    };
    for (const l of bvaLines) {
      if (['REVENUE', 'OTHER_INCOME'].includes(l.lineType)) {
        summaryTotals.totalRevenueBudget += l.totals.budget;
        summaryTotals.totalRevenueActual += l.totals.actual;
      } else {
        summaryTotals.totalExpenseBudget += l.totals.budget;
        summaryTotals.totalExpenseActual += l.totals.actual;
      }
    }
    summaryTotals.noiBudget = summaryTotals.totalRevenueBudget - summaryTotals.totalExpenseBudget;
    summaryTotals.noiActual = summaryTotals.totalRevenueActual - summaryTotals.totalExpenseActual;

    res.json({ budget, lines: bvaLines, summary: summaryTotals, months });
  } catch (err) { next(err); }
});

router.post("/seed-actuals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const fiscalYear = parseInt(req.body.fiscalYear || '2025');

    const existing = await db.select({ id: actualsFacts.id }).from(actualsFacts)
      .where(and(
        eq(actualsFacts.userId, userId),
        sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${fiscalYear}`,
      )).limit(1);

    if (existing.length > 0) return res.json({ message: "Actuals already seeded", seeded: false });

    const accounts = [
      { key: "wet_slip_revenue", type: "REVENUE" as const, base: 45000, variance: 8000 },
      { key: "dry_storage_revenue", type: "REVENUE" as const, base: 28000, variance: 5000 },
      { key: "fuel_sales", type: "REVENUE" as const, base: 35000, variance: 12000 },
      { key: "ship_store_revenue", type: "REVENUE" as const, base: 12000, variance: 4000 },
      { key: "service_repair_revenue", type: "REVENUE" as const, base: 18000, variance: 6000 },
      { key: "transient_dockage", type: "REVENUE" as const, base: 8000, variance: 5000 },
      { key: "payroll_expense", type: "OPEX" as const, base: 32000, variance: 3000 },
      { key: "insurance_expense", type: "OPEX" as const, base: 8500, variance: 500 },
      { key: "utilities_expense", type: "OPEX" as const, base: 6000, variance: 2000 },
      { key: "maintenance_expense", type: "OPEX" as const, base: 9000, variance: 4000 },
      { key: "fuel_cogs", type: "COGS" as const, base: 28000, variance: 10000 },
      { key: "ship_store_cogs", type: "COGS" as const, base: 7000, variance: 2000 },
      { key: "property_tax", type: "OPEX" as const, base: 4500, variance: 200 },
      { key: "marketing_expense", type: "OPEX" as const, base: 3000, variance: 1500 },
      { key: "interest_income", type: "OTHER_INCOME" as const, base: 800, variance: 200 },
      { key: "loan_interest_expense", type: "OTHER_EXPENSE" as const, base: 12000, variance: 500 },
    ];

    const seasonality: Record<string, number[]> = {
      wet_slip_revenue: [0.6, 0.65, 0.75, 0.85, 1.1, 1.3, 1.5, 1.5, 1.2, 0.9, 0.7, 0.55],
      dry_storage_revenue: [0.7, 0.7, 0.8, 0.9, 1.1, 1.2, 1.3, 1.3, 1.1, 0.9, 0.8, 0.7],
      fuel_sales: [0.3, 0.35, 0.5, 0.8, 1.2, 1.6, 1.8, 1.7, 1.3, 0.8, 0.4, 0.3],
      transient_dockage: [0.2, 0.2, 0.4, 0.7, 1.2, 1.6, 1.9, 1.8, 1.3, 0.7, 0.3, 0.2],
      ship_store_revenue: [0.4, 0.5, 0.7, 0.9, 1.2, 1.5, 1.7, 1.6, 1.2, 0.8, 0.5, 0.4],
    };
    const flat = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

    const rows: any[] = [];
    for (const acc of accounts) {
      const seasonal = seasonality[acc.key] || flat;
      for (let m = 0; m < 12; m++) {
        const factor = seasonal[m];
        const noise = (Math.random() - 0.5) * 2 * acc.variance;
        const amount = Math.round((acc.base * factor + noise) * 100) / 100;
        rows.push({
          userId,
          orgId,
          periodStart: `${fiscalYear}-${(m + 1).toString().padStart(2, '0')}-01`,
          lineType: acc.type,
          accountKey: acc.key,
          amount: amount.toString(),
          source: 'SEED' as const,
          sourceRef: 'demo-seed',
        });
      }
    }

    await db.insert(actualsFacts).values(rows);
    res.json({ message: `Seeded ${rows.length} actuals rows for ${fiscalYear}`, seeded: true, count: rows.length });
  } catch (err) { next(err); }
});

async function seedVersionFromActuals(versionId: string, userId: string, orgId: string, fiscalYear: number) {
  const actuals = await db.select().from(actualsFacts)
    .where(and(
      eq(actualsFacts.userId, userId),
      sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${fiscalYear}`,
    ));

  const grouped = new Map<string, ActualsFact[]>();
  for (const a of actuals) {
    if (!grouped.has(a.accountKey)) grouped.set(a.accountKey, []);
    grouped.get(a.accountKey)!.push(a);
  }

  let sortOrder = 0;
  for (const [accountKey, facts] of grouped) {
    const displayName = accountKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const [line] = await db.insert(budgetLines).values({
      budgetVersionId: versionId,
      sortOrder: sortOrder++,
      lineType: facts[0].lineType,
      accountKey,
      displayName,
    }).returning();

    for (const fact of facts) {
      await db.insert(budgetAmounts).values({
        budgetLineId: line.id,
        periodStart: fact.periodStart as string,
        amount: fact.amount,
      });
    }
  }
}

async function seedBlankVersion(versionId: string, fiscalYear: number) {
  const defaultLines = [
    { key: "wet_slip_revenue", name: "Wet Slip Revenue", type: "REVENUE" as const },
    { key: "dry_storage_revenue", name: "Dry Storage Revenue", type: "REVENUE" as const },
    { key: "fuel_sales", name: "Fuel Sales", type: "REVENUE" as const },
    { key: "ship_store_revenue", name: "Ship Store Revenue", type: "REVENUE" as const },
    { key: "service_repair_revenue", name: "Service & Repair Revenue", type: "REVENUE" as const },
    { key: "transient_dockage", name: "Transient Dockage", type: "REVENUE" as const },
    { key: "payroll_expense", name: "Payroll", type: "OPEX" as const },
    { key: "insurance_expense", name: "Insurance", type: "OPEX" as const },
    { key: "utilities_expense", name: "Utilities", type: "OPEX" as const },
    { key: "maintenance_expense", name: "Maintenance & Repairs", type: "OPEX" as const },
    { key: "fuel_cogs", name: "Fuel COGS", type: "COGS" as const },
    { key: "ship_store_cogs", name: "Ship Store COGS", type: "COGS" as const },
    { key: "property_tax", name: "Property Tax", type: "OPEX" as const },
    { key: "marketing_expense", name: "Marketing", type: "OPEX" as const },
    { key: "interest_income", name: "Interest Income", type: "OTHER_INCOME" as const },
    { key: "loan_interest_expense", name: "Loan Interest", type: "OTHER_EXPENSE" as const },
  ];

  for (let i = 0; i < defaultLines.length; i++) {
    const dl = defaultLines[i];
    const [line] = await db.insert(budgetLines).values({
      budgetVersionId: versionId,
      sortOrder: i,
      lineType: dl.type,
      accountKey: dl.key,
      displayName: dl.name,
    }).returning();

    for (let m = 0; m < 12; m++) {
      await db.insert(budgetAmounts).values({
        budgetLineId: line.id,
        periodStart: `${fiscalYear}-${(m + 1).toString().padStart(2, '0')}-01`,
        amount: '0',
      });
    }
  }
}

export default router;
