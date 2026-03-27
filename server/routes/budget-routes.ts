import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { pool } from "../db";
import { z } from "zod";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import {
  budgets, budgetVersions, budgetDimensions, budgetLines, budgetAmounts,
  actualsFacts, budgetTargets, opsBookkeepingGl,
  insertBudgetSchema, insertBudgetVersionSchema, insertBudgetLineSchema,
  insertBudgetAmountSchema, insertActualsFactSchema,
  type Budget, type BudgetVersion, type BudgetLine, type BudgetAmount, type ActualsFact,
} from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth-resolver";

const router = Router();

// ---------------------------------------------------------------------------
// Ensure budget_tree_accounts table exists (raw SQL, no Drizzle)
// ---------------------------------------------------------------------------
async function ensureBudgetTreeTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_tree_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      budget_version_id UUID NOT NULL,
      account_key TEXT NOT NULL,
      display_name TEXT NOT NULL,
      parent_key TEXT,
      line_type TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_parent BOOLEAN NOT NULL DEFAULT false,
      asset_class TEXT NOT NULL DEFAULT 'marina',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_bta_version ON budget_tree_accounts(budget_version_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bta_version_key ON budget_tree_accounts(budget_version_id, account_key);
  `);
}
// Add is_locked column to budget_versions if missing
async function ensureVersionLockColumn() {
  await pool.query(`
    ALTER TABLE budget_versions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
  `);
}

// Run on import — idempotent
ensureBudgetTreeTable().catch(err => console.error("Failed to create budget_tree_accounts:", err));
ensureVersionLockColumn().catch(err => console.error("Failed to add is_locked column:", err));

// ---------------------------------------------------------------------------
// COA templates by asset class — revenue & expense accounts for budget trees
// ---------------------------------------------------------------------------
const COA_TEMPLATES: Record<string, { key: string; name: string; parentKey: string; lineType: string }[]> = {
  marina: [
    // Revenue children
    { key: "wet_slip_revenue", name: "Wet Slip Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "dry_storage_revenue", name: "Dry Storage Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "fuel_sales", name: "Fuel Sales", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "ship_store_revenue", name: "Ship Store Sales", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "service_repair_revenue", name: "Service & Repair Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "transient_dockage", name: "Transient Dockage", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "boat_rental_revenue", name: "Boat Rental Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "launch_haul_revenue", name: "Launch & Haul Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "other_marina_revenue", name: "Other Marina Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    // OpEx children
    { key: "payroll_expense", name: "Payroll & Benefits", parentKey: "OPEX", lineType: "OPEX" },
    { key: "utilities_expense", name: "Utilities", parentKey: "OPEX", lineType: "OPEX" },
    { key: "insurance_expense", name: "Insurance", parentKey: "OPEX", lineType: "OPEX" },
    { key: "maintenance_expense", name: "Maintenance & Repairs", parentKey: "OPEX", lineType: "OPEX" },
    { key: "property_tax", name: "Property Tax", parentKey: "OPEX", lineType: "OPEX" },
    { key: "marketing_expense", name: "Marketing & Advertising", parentKey: "OPEX", lineType: "OPEX" },
    { key: "professional_fees", name: "Professional Fees", parentKey: "OPEX", lineType: "OPEX" },
    { key: "fuel_cogs", name: "Fuel Cost of Goods", parentKey: "OPEX", lineType: "OPEX" },
    { key: "ship_store_cogs", name: "Ship Store COGS", parentKey: "OPEX", lineType: "OPEX" },
    { key: "management_fees", name: "Management Fees", parentKey: "OPEX", lineType: "OPEX" },
  ],
  hotel: [
    { key: "room_revenue", name: "Room Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "fb_revenue", name: "F&B Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "meeting_revenue", name: "Meeting Room Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "spa_revenue", name: "Spa Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "other_hotel_revenue", name: "Other Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "rooms_dept_expense", name: "Rooms Department Expense", parentKey: "OPEX", lineType: "OPEX" },
    { key: "fb_expense", name: "F&B Expense", parentKey: "OPEX", lineType: "OPEX" },
    { key: "ag_expense", name: "A&G Expense", parentKey: "OPEX", lineType: "OPEX" },
    { key: "sales_marketing", name: "Sales & Marketing", parentKey: "OPEX", lineType: "OPEX" },
    { key: "property_ops", name: "Property Operations", parentKey: "OPEX", lineType: "OPEX" },
    { key: "utilities_expense", name: "Utilities", parentKey: "OPEX", lineType: "OPEX" },
    { key: "insurance_expense", name: "Insurance", parentKey: "OPEX", lineType: "OPEX" },
    { key: "property_tax", name: "Property Tax", parentKey: "OPEX", lineType: "OPEX" },
  ],
  multifamily: [
    { key: "rental_revenue", name: "Rental Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "parking_revenue", name: "Parking Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "laundry_revenue", name: "Laundry Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "late_fee_revenue", name: "Late Fee Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "other_mf_revenue", name: "Other Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "property_mgmt", name: "Property Management", parentKey: "OPEX", lineType: "OPEX" },
    { key: "maintenance_expense", name: "Maintenance & Repairs", parentKey: "OPEX", lineType: "OPEX" },
    { key: "utilities_expense", name: "Utilities", parentKey: "OPEX", lineType: "OPEX" },
    { key: "insurance_expense", name: "Insurance", parentKey: "OPEX", lineType: "OPEX" },
    { key: "property_tax", name: "Property Tax", parentKey: "OPEX", lineType: "OPEX" },
    { key: "turnover_costs", name: "Turnover Costs", parentKey: "OPEX", lineType: "OPEX" },
    { key: "marketing_expense", name: "Marketing", parentKey: "OPEX", lineType: "OPEX" },
  ],
  restaurant: [
    { key: "food_sales", name: "Food Sales", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "beverage_sales", name: "Beverage Sales", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "catering_revenue", name: "Catering Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "other_fb_revenue", name: "Other Revenue", parentKey: "REVENUE", lineType: "REVENUE" },
    { key: "food_cost", name: "Food Cost", parentKey: "OPEX", lineType: "OPEX" },
    { key: "beverage_cost", name: "Beverage Cost", parentKey: "OPEX", lineType: "OPEX" },
    { key: "labor_expense", name: "Labor", parentKey: "OPEX", lineType: "OPEX" },
    { key: "occupancy_costs", name: "Occupancy Costs", parentKey: "OPEX", lineType: "OPEX" },
    { key: "marketing_expense", name: "Marketing", parentKey: "OPEX", lineType: "OPEX" },
    { key: "utilities_expense", name: "Utilities", parentKey: "OPEX", lineType: "OPEX" },
    { key: "insurance_expense", name: "Insurance", parentKey: "OPEX", lineType: "OPEX" },
  ],
};

// Parent rows (always the same structure)
/**
 * Safe GL-to-budget account matching. Returns the BEST single match, not all substring matches.
 * Prevents double-counting by requiring exact or high-confidence match.
 */
function matchGlToBudgetLine(glAccountName: string | null | undefined, budgetLines: { accountKey: string; displayName: string }[]): string | null {
  if (!glAccountName) return null;
  const normGl = glAccountName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!normGl) return null;

  // Priority 1: Exact key match
  for (const l of budgetLines) {
    if (l.accountKey === normGl) return l.accountKey;
  }

  // Priority 2: Exact display name match (normalized)
  for (const l of budgetLines) {
    const normName = l.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (normName === normGl) return l.accountKey;
  }

  // Priority 3: Score-based — prefer longest common prefix, avoid substring ambiguity
  let bestKey: string | null = null;
  let bestScore = 0;
  for (const l of budgetLines) {
    const normName = l.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    // Word overlap scoring
    const glWords = new Set(normGl.split('_').filter(Boolean));
    const nameWords = normName.split('_').filter(Boolean);
    const keyWords = l.accountKey.split('_').filter(Boolean);
    const allCandidateWords = new Set([...nameWords, ...keyWords]);
    const overlap = [...glWords].filter(w => allCandidateWords.has(w)).length;
    const score = overlap / Math.max(glWords.size, allCandidateWords.size);
    if (score > bestScore && score >= 0.6) {
      bestScore = score;
      bestKey = l.accountKey;
    }
  }
  return bestKey;
}

/**
 * Aggregate GL entries into a map of accountKey → month → total amount.
 * Each GL entry matches at most one budget line (prevents double-counting).
 */
function aggregateGlActuals(
  glEntries: { accountName: string; periodStart: string | Date; amount: string }[],
  budgetLinesList: { accountKey: string; displayName: string }[],
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const gl of glEntries) {
    const matchedKey = matchGlToBudgetLine(gl.accountName, budgetLinesList);
    if (!matchedKey) continue;
    const period = gl.periodStart as string;
    if (!result[matchedKey]) result[matchedKey] = {};
    result[matchedKey][period] = (result[matchedKey][period] || 0) + parseFloat(gl.amount);
  }
  return result;
}

const PARENT_ROWS = [
  { key: "REVENUE", name: "Revenue", lineType: "REVENUE", sortOrder: 0 },
  { key: "OPEX", name: "Operating Expenses", lineType: "OPEX", sortOrder: 1000 },
  // NOI is computed, not stored
];

/**
 * Seed the budget_tree_accounts for a given version with COA-based hierarchy.
 */
async function seedBudgetTree(versionId: string, assetClass: string, fiscalYear: number) {
  const template = COA_TEMPLATES[assetClass] || COA_TEMPLATES.marina;

  // Insert parent rows
  for (const p of PARENT_ROWS) {
    await pool.query(
      `INSERT INTO budget_tree_accounts (budget_version_id, account_key, display_name, parent_key, line_type, sort_order, is_parent, asset_class)
       VALUES ($1, $2, $3, NULL, $4, $5, true, $6)
       ON CONFLICT (budget_version_id, account_key) DO NOTHING`,
      [versionId, p.key, p.name, p.lineType, p.sortOrder, assetClass]
    );
  }

  // Insert child rows
  let sortOrder = 1;
  for (const child of template) {
    const baseSortOrder = child.parentKey === "REVENUE" ? sortOrder : 1000 + sortOrder;
    await pool.query(
      `INSERT INTO budget_tree_accounts (budget_version_id, account_key, display_name, parent_key, line_type, sort_order, is_parent, asset_class)
       VALUES ($1, $2, $3, $4, $5, $6, false, $7)
       ON CONFLICT (budget_version_id, account_key) DO NOTHING`,
      [versionId, child.key, child.name, child.parentKey, child.lineType, baseSortOrder, assetClass]
    );
    sortOrder++;
  }

  // Also seed budget_amounts rows for each child (12 months, $0)
  const childKeys = template.map(c => c.key);
  // First, ensure budget_lines exist for each child (for amounts compatibility)
  for (let i = 0; i < template.length; i++) {
    const child = template[i];
    const baseSortOrder = child.parentKey === "REVENUE" ? (i + 1) : (1000 + i + 1);

    // Check if budget line already exists
    const existing = await db.select().from(budgetLines)
      .where(and(eq(budgetLines.budgetVersionId, versionId), eq(budgetLines.accountKey, child.key)));

    let lineId: string;
    if (existing.length === 0) {
      const [line] = await db.insert(budgetLines).values({
        budgetVersionId: versionId,
        sortOrder: baseSortOrder,
        lineType: child.lineType,
        accountKey: child.key,
        displayName: child.name,
      }).returning();
      lineId = line.id;
    } else {
      lineId = existing[0].id;
    }

    // Seed 12 months of $0 amounts if not already there
    for (let m = 0; m < 12; m++) {
      const periodStart = `${fiscalYear}-${(m + 1).toString().padStart(2, '0')}-01`;
      const existingAmt = await db.select().from(budgetAmounts)
        .where(and(eq(budgetAmounts.budgetLineId, lineId), eq(budgetAmounts.periodStart, periodStart)));
      if (existingAmt.length === 0) {
        await db.insert(budgetAmounts).values({ budgetLineId: lineId, periodStart, amount: '0' });
      }
    }
  }
}

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

// ---------------------------------------------------------------------------
// GET /version/:versionId/tree-grid — Hierarchical budget grid
// Returns parent rows with children, amounts, and computed totals
// ---------------------------------------------------------------------------
router.get("/version/:versionId/tree-grid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;

    // Get the budget to know fiscal year and asset class
    const [ver] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, versionId));
    if (!ver) return res.status(404).json({ error: "Version not found" });

    const [budget] = await db.select().from(budgets).where(eq(budgets.id, ver.budgetId));
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    // Check if tree is seeded; if not, seed it
    const treeCheck = await pool.query(
      `SELECT count(*)::int AS cnt FROM budget_tree_accounts WHERE budget_version_id = $1`,
      [versionId]
    );
    if (treeCheck.rows[0].cnt === 0) {
      const assetClass = (req.query.assetClass as string) || 'marina';
      await seedBudgetTree(versionId, assetClass, budget.fiscalYear);
    }

    // Fetch tree rows
    const treeResult = await pool.query(
      `SELECT id, account_key, display_name, parent_key, line_type, sort_order, is_parent, asset_class
       FROM budget_tree_accounts
       WHERE budget_version_id = $1
       ORDER BY sort_order ASC`,
      [versionId]
    );

    // Fetch all budget lines + amounts for this version
    const lines = await db.select().from(budgetLines)
      .where(eq(budgetLines.budgetVersionId, versionId))
      .orderBy(asc(budgetLines.sortOrder));

    const lineIds = lines.map(l => l.id);
    let amounts: BudgetAmount[] = [];
    if (lineIds.length > 0) {
      amounts = await db.select().from(budgetAmounts)
        .where(inArray(budgetAmounts.budgetLineId, lineIds));
    }

    // Build amount map: accountKey → { periodStart → amount }
    const lineByKey = new Map<string, string>();
    for (const l of lines) lineByKey.set(l.accountKey, l.id);

    const amountMap: Record<string, Record<string, string>> = {};
    const lineIdToKey = new Map<string, string>();
    for (const l of lines) lineIdToKey.set(l.id, l.accountKey);

    for (const a of amounts) {
      const key = lineIdToKey.get(a.budgetLineId);
      if (!key) continue;
      if (!amountMap[key]) amountMap[key] = {};
      amountMap[key][a.periodStart as string] = a.amount;
    }

    // Build line ID map for the frontend to use when saving
    const lineIdMap: Record<string, string> = {};
    for (const l of lines) lineIdMap[l.accountKey] = l.id;

    // Structure tree
    const treeRows = treeResult.rows.map((r: any) => ({
      id: r.id,
      accountKey: r.account_key,
      displayName: r.display_name,
      parentKey: r.parent_key,
      lineType: r.line_type,
      sortOrder: r.sort_order,
      isParent: r.is_parent,
      assetClass: r.asset_class,
    }));

    res.json({
      tree: treeRows,
      amounts: amountMap,
      lineIdMap,
      fiscalYear: budget.fiscalYear,
      budgetStatus: budget.status,
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PATCH /version/:versionId/cell — Single-cell auto-save
// ---------------------------------------------------------------------------
const cellPatchSchema = z.object({
  accountKey: z.string(),
  periodStart: z.string(),
  amount: z.string(),
});

router.patch("/version/:versionId/cell", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const { accountKey, periodStart, amount } = cellPatchSchema.parse(req.body);

    // Find the budget line by version + account key
    const [line] = await db.select().from(budgetLines)
      .where(and(eq(budgetLines.budgetVersionId, versionId), eq(budgetLines.accountKey, accountKey)));

    if (!line) return res.status(404).json({ error: `Budget line not found for key: ${accountKey}` });

    // Upsert the amount
    const existing = await db.select().from(budgetAmounts)
      .where(and(eq(budgetAmounts.budgetLineId, line.id), eq(budgetAmounts.periodStart, periodStart)));

    let result;
    if (existing.length > 0) {
      [result] = await db.update(budgetAmounts)
        .set({ amount, updatedAt: new Date() })
        .where(eq(budgetAmounts.id, existing[0].id))
        .returning();
    } else {
      [result] = await db.insert(budgetAmounts)
        .values({ budgetLineId: line.id, periodStart, amount })
        .returning();
    }

    res.json({ ok: true, amount: result.amount, periodStart: result.periodStart });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /version/:versionId/bulk-fill — Bulk fill a single account row
// Modes: spread_evenly, grow_pct, seasonality, copy_prior_year
// ---------------------------------------------------------------------------
const bulkFillSchema = z.object({
  accountKey: z.string(),
  mode: z.enum(["spread_evenly", "grow_pct", "seasonality", "copy_prior_year"]),
  annualTotal: z.number().optional(),     // spread_evenly, seasonality
  januaryValue: z.number().optional(),    // grow_pct
  growthRate: z.number().optional(),       // grow_pct (e.g. 0.03 = 3% MoM)
  upliftPct: z.number().optional(),        // copy_prior_year (e.g. 0.05 = 5%)
});

router.post("/version/:versionId/bulk-fill", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const body = bulkFillSchema.parse(req.body);

    // Resolve budget + fiscal year
    const [ver] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, versionId));
    if (!ver) return res.status(404).json({ error: "Version not found" });
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, ver.budgetId));
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    const fiscalYear = budget.fiscalYear;
    const months = Array.from({ length: 12 }, (_, i) =>
      `${fiscalYear}-${(i + 1).toString().padStart(2, '0')}-01`
    );

    let monthlyAmounts: number[] = [];

    switch (body.mode) {
      case "spread_evenly": {
        const total = body.annualTotal ?? 0;
        const perMonth = Math.round((total / 12) * 100) / 100;
        // Last month absorbs rounding
        monthlyAmounts = Array(11).fill(perMonth);
        monthlyAmounts.push(Math.round((total - perMonth * 11) * 100) / 100);
        break;
      }

      case "grow_pct": {
        const jan = body.januaryValue ?? 0;
        const rate = body.growthRate ?? 0;
        let val = jan;
        for (let i = 0; i < 12; i++) {
          monthlyAmounts.push(Math.round(val * 100) / 100);
          val = val * (1 + rate);
        }
        break;
      }

      case "seasonality": {
        const total = body.annualTotal ?? 0;
        // Pull prior year actuals for this account to get seasonal distribution
        const priorYear = fiscalYear - 1;
        const priorActuals = await db.select().from(actualsFacts).where(
          and(
            eq(actualsFacts.userId, userId),
            eq(actualsFacts.accountKey, body.accountKey),
            sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${priorYear}`,
          )
        );

        if (priorActuals.length === 0) {
          // No prior data — fall back to even spread
          const perMonth = Math.round((total / 12) * 100) / 100;
          monthlyAmounts = Array(11).fill(perMonth);
          monthlyAmounts.push(Math.round((total - perMonth * 11) * 100) / 100);
        } else {
          // Build month → amount map from prior actuals
          const priorByMonth: number[] = new Array(12).fill(0);
          for (const a of priorActuals) {
            const mStr = (a.periodStart as string).slice(5, 7);
            const mIdx = parseInt(mStr, 10) - 1;
            if (mIdx >= 0 && mIdx < 12) priorByMonth[mIdx] += parseFloat(a.amount);
          }
          const priorTotal = priorByMonth.reduce((s, v) => s + v, 0);
          if (priorTotal === 0) {
            const perMonth = Math.round((total / 12) * 100) / 100;
            monthlyAmounts = Array(11).fill(perMonth);
            monthlyAmounts.push(Math.round((total - perMonth * 11) * 100) / 100);
          } else {
            const weights = priorByMonth.map(v => v / priorTotal);
            let allocated = 0;
            for (let i = 0; i < 11; i++) {
              const val = Math.round(total * weights[i] * 100) / 100;
              monthlyAmounts.push(val);
              allocated += val;
            }
            monthlyAmounts.push(Math.round((total - allocated) * 100) / 100);
          }
        }
        break;
      }

      case "copy_prior_year": {
        const uplift = body.upliftPct ?? 0;
        const priorYear = fiscalYear - 1;
        const priorActuals = await db.select().from(actualsFacts).where(
          and(
            eq(actualsFacts.userId, userId),
            eq(actualsFacts.accountKey, body.accountKey),
            sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${priorYear}`,
          )
        );

        const priorByMonth: number[] = new Array(12).fill(0);
        for (const a of priorActuals) {
          const mStr = (a.periodStart as string).slice(5, 7);
          const mIdx = parseInt(mStr, 10) - 1;
          if (mIdx >= 0 && mIdx < 12) priorByMonth[mIdx] += parseFloat(a.amount);
        }
        monthlyAmounts = priorByMonth.map(v => Math.round(v * (1 + uplift) * 100) / 100);
        break;
      }
    }

    // Find (or create) the budget line for this account
    let [line] = await db.select().from(budgetLines)
      .where(and(eq(budgetLines.budgetVersionId, versionId), eq(budgetLines.accountKey, body.accountKey)));

    if (!line) {
      const displayName = body.accountKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      [line] = await db.insert(budgetLines).values({
        budgetVersionId: versionId,
        sortOrder: 999,
        lineType: 'OPEX',
        accountKey: body.accountKey,
        displayName,
      }).returning();
    }

    // Upsert all 12 months
    for (let i = 0; i < 12; i++) {
      const periodStart = months[i];
      const amount = monthlyAmounts[i].toString();
      const existing = await db.select().from(budgetAmounts)
        .where(and(eq(budgetAmounts.budgetLineId, line.id), eq(budgetAmounts.periodStart, periodStart)));
      if (existing.length > 0) {
        await db.update(budgetAmounts)
          .set({ amount, updatedAt: new Date() })
          .where(eq(budgetAmounts.id, existing[0].id));
      } else {
        await db.insert(budgetAmounts).values({ budgetLineId: line.id, periodStart, amount });
      }
    }

    res.json({
      ok: true,
      accountKey: body.accountKey,
      mode: body.mode,
      amounts: Object.fromEntries(months.map((m, i) => [m, monthlyAmounts[i].toString()])),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /version/:versionId/import-csv — Import budget from CSV text
// Fuzzy-matches account names and month headers
// ---------------------------------------------------------------------------
const MONTH_ALIASES: Record<string, number> = {
  jan: 0, january: 0, "1": 0, "01": 0,
  feb: 1, february: 1, "2": 1, "02": 1,
  mar: 2, march: 2, "3": 2, "03": 2,
  apr: 3, april: 3, "4": 3, "04": 3,
  may: 4, "5": 4, "05": 4,
  jun: 5, june: 5, "6": 5, "06": 5,
  jul: 6, july: 6, "7": 6, "07": 6,
  aug: 7, august: 7, "8": 7, "08": 7,
  sep: 8, sept: 8, september: 8, "9": 8, "09": 8,
  oct: 9, october: 9, "10": 9,
  nov: 10, november: 10, "11": 10,
  dec: 11, december: 11, "12": 11,
};

function fuzzyMatchAccount(input: string, candidates: { key: string; name: string }[]): string | null {
  const norm = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!norm) return null;

  // Exact key match
  for (const c of candidates) {
    if (c.key === norm || c.key.replace(/_/g, '') === norm) return c.key;
  }
  // Exact name match
  for (const c of candidates) {
    if (c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === norm) return c.key;
  }
  // Substring match — input contains candidate name or vice-versa
  for (const c of candidates) {
    const cNorm = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm.includes(cNorm) || cNorm.includes(norm)) return c.key;
  }
  // Word overlap scoring
  const inputWords = new Set(input.toLowerCase().split(/\s+/));
  let bestScore = 0;
  let bestKey: string | null = null;
  for (const c of candidates) {
    const nameWords = c.name.toLowerCase().split(/\s+/);
    const overlap = nameWords.filter(w => inputWords.has(w)).length;
    const score = overlap / Math.max(nameWords.length, inputWords.size);
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestKey = c.key;
    }
  }
  return bestKey;
}

function parseMonthHeader(header: string): number | null {
  const clean = header.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (MONTH_ALIASES[clean] !== undefined) return MONTH_ALIASES[clean];
  // Try prefix match (e.g. "jan-26", "feb 2026")
  for (const [alias, idx] of Object.entries(MONTH_ALIASES)) {
    if (clean.startsWith(alias) && alias.length >= 3) return idx;
  }
  return null;
}

const csvImportSchema = z.object({
  csvText: z.string(),
});

router.post("/version/:versionId/import-csv", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const { csvText } = csvImportSchema.parse(req.body);

    // Resolve budget
    const [ver] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, versionId));
    if (!ver) return res.status(404).json({ error: "Version not found" });
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, ver.budgetId));
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    const fiscalYear = budget.fiscalYear;

    // Parse CSV
    const rawLines = csvText.split(/\r?\n/).filter(l => l.trim());
    if (rawLines.length < 2) return res.status(400).json({ error: "CSV must have header + at least 1 data row" });

    const parseCsvRow = (line: string): string[] => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
          else if (ch === '"') { inQuotes = false; }
          else { current += ch; }
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === ',') { fields.push(current.trim()); current = ''; }
          else { current += ch; }
        }
      }
      fields.push(current.trim());
      return fields;
    };

    const headers = parseCsvRow(rawLines[0]);

    // Identify account column (first non-month column, typically column 0)
    let accountColIdx = 0;
    const monthColMap: { colIdx: number; monthIdx: number }[] = [];

    for (let i = 0; i < headers.length; i++) {
      const mIdx = parseMonthHeader(headers[i]);
      if (mIdx !== null) {
        monthColMap.push({ colIdx: i, monthIdx: mIdx });
      } else if (monthColMap.length === 0) {
        accountColIdx = i; // First non-month column before any months
      }
    }

    if (monthColMap.length === 0) {
      return res.status(400).json({ error: "Could not identify any month columns in CSV headers" });
    }

    // Get tree accounts for fuzzy matching
    const treeResult = await pool.query(
      `SELECT account_key, display_name FROM budget_tree_accounts
       WHERE budget_version_id = $1 AND is_parent = false`,
      [versionId]
    );
    const candidates = treeResult.rows.map((r: any) => ({ key: r.account_key, name: r.display_name }));

    const imported: { row: number; account: string; matched: string }[] = [];
    const skipped: { row: number; account: string; reason: string }[] = [];

    for (let r = 1; r < rawLines.length; r++) {
      const cols = parseCsvRow(rawLines[r]);
      const accountName = cols[accountColIdx]?.trim();
      if (!accountName) { skipped.push({ row: r, account: '', reason: 'empty account' }); continue; }

      const matchedKey = fuzzyMatchAccount(accountName, candidates);
      if (!matchedKey) { skipped.push({ row: r, account: accountName, reason: 'no match' }); continue; }

      // Find or create budget line
      let [line] = await db.select().from(budgetLines)
        .where(and(eq(budgetLines.budgetVersionId, versionId), eq(budgetLines.accountKey, matchedKey)));

      if (!line) {
        const candidate = candidates.find(c => c.key === matchedKey);
        // Resolve lineType from tree accounts (not hardcoded)
        const treeRow = await pool.query(
          `SELECT line_type FROM budget_tree_accounts WHERE budget_version_id = $1 AND account_key = $2 LIMIT 1`,
          [versionId, matchedKey]
        );
        const resolvedLineType = treeRow.rows[0]?.line_type || 'OPEX';
        [line] = await db.insert(budgetLines).values({
          budgetVersionId: versionId,
          sortOrder: 999,
          lineType: resolvedLineType,
          accountKey: matchedKey,
          displayName: candidate?.name || matchedKey,
        }).returning();
      }

      // Write each month
      for (const { colIdx, monthIdx } of monthColMap) {
        const raw = (cols[colIdx] || '').replace(/[$,\s]/g, '');
        const val = parseFloat(raw);
        if (isNaN(val)) continue;

        const periodStart = `${fiscalYear}-${(monthIdx + 1).toString().padStart(2, '0')}-01`;
        const amount = val.toString();

        const existing = await db.select().from(budgetAmounts)
          .where(and(eq(budgetAmounts.budgetLineId, line.id), eq(budgetAmounts.periodStart, periodStart)));
        if (existing.length > 0) {
          await db.update(budgetAmounts).set({ amount, updatedAt: new Date() }).where(eq(budgetAmounts.id, existing[0].id));
        } else {
          await db.insert(budgetAmounts).values({ budgetLineId: line.id, periodStart, amount });
        }
      }

      imported.push({ row: r, account: accountName, matched: matchedKey });
    }

    res.json({ imported: imported.length, skipped: skipped.length, details: { imported, skipped } });
  } catch (err) { next(err); }
});

// ===========================================================================
// VERSION MANAGEMENT
// ===========================================================================

// POST /version/:versionId/clone — Deep-clone a version (lines + amounts)
router.post("/version/:versionId/clone", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const { name } = z.object({ name: z.string().optional() }).parse(req.body);

    const [srcVer] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, versionId));
    if (!srcVer) return res.status(404).json({ error: "Source version not found" });

    // Create new version
    const [newVer] = await db.insert(budgetVersions).values({
      budgetId: srcVer.budgetId,
      name: name || `${srcVer.name} (Copy)`,
      isPrimary: false,
    }).returning();

    // Clone budget lines
    const srcLines = await db.select().from(budgetLines)
      .where(eq(budgetLines.budgetVersionId, versionId));

    for (const srcLine of srcLines) {
      const [newLine] = await db.insert(budgetLines).values({
        budgetVersionId: newVer.id,
        sortOrder: srcLine.sortOrder,
        lineType: srcLine.lineType,
        accountKey: srcLine.accountKey,
        displayName: srcLine.displayName,
      }).returning();

      // Clone amounts
      const srcAmounts = await db.select().from(budgetAmounts)
        .where(eq(budgetAmounts.budgetLineId, srcLine.id));
      for (const srcAmt of srcAmounts) {
        await db.insert(budgetAmounts).values({
          budgetLineId: newLine.id,
          periodStart: srcAmt.periodStart,
          amount: srcAmt.amount,
        });
      }
    }

    // Clone tree accounts
    await pool.query(
      `INSERT INTO budget_tree_accounts (budget_version_id, account_key, display_name, parent_key, line_type, sort_order, is_parent, asset_class)
       SELECT $1, account_key, display_name, parent_key, line_type, sort_order, is_parent, asset_class
       FROM budget_tree_accounts WHERE budget_version_id = $2
       ON CONFLICT (budget_version_id, account_key) DO NOTHING`,
      [newVer.id, versionId]
    );

    res.status(201).json(newVer);
  } catch (err) { next(err); }
});

// PATCH /version/:versionId/lock — Lock or unlock a version
router.patch("/version/:versionId/lock", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const { locked } = z.object({ locked: z.boolean() }).parse(req.body);

    await pool.query(
      `UPDATE budget_versions SET is_locked = $1, updated_at = now() WHERE id = $2`,
      [locked, versionId]
    );

    res.json({ ok: true, versionId, locked });
  } catch (err) { next(err); }
});

// PATCH /version/:versionId/rename — Rename a version
router.patch("/version/:versionId/rename", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);

    const [row] = await db.update(budgetVersions)
      .set({ name, updatedAt: new Date() })
      .where(eq(budgetVersions.id, versionId))
      .returning();
    if (!row) return res.status(404).json({ error: "Version not found" });
    res.json(row);
  } catch (err) { next(err); }
});

// PATCH /version/:versionId/set-primary — Make this the primary version
router.patch("/version/:versionId/set-primary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;

    const [ver] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, versionId));
    if (!ver) return res.status(404).json({ error: "Version not found" });

    // Unset all siblings
    await db.update(budgetVersions)
      .set({ isPrimary: false })
      .where(eq(budgetVersions.budgetId, ver.budgetId));

    // Set this one
    const [row] = await db.update(budgetVersions)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(budgetVersions.id, versionId))
      .returning();

    res.json(row);
  } catch (err) { next(err); }
});

// GET /version/compare — Compare two versions side-by-side
router.get("/version/compare", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionA, versionB } = z.object({
      versionA: z.string(),
      versionB: z.string(),
    }).parse(req.query);

    const fetchVersionGrid = async (versionId: string) => {
      const lines = await db.select().from(budgetLines)
        .where(eq(budgetLines.budgetVersionId, versionId))
        .orderBy(asc(budgetLines.sortOrder));
      const lineIds = lines.map(l => l.id);
      let amounts: BudgetAmount[] = [];
      if (lineIds.length > 0) {
        amounts = await db.select().from(budgetAmounts)
          .where(inArray(budgetAmounts.budgetLineId, lineIds));
      }
      const amountMap: Record<string, Record<string, number>> = {};
      for (const l of lines) amountMap[l.accountKey] = {};
      for (const a of amounts) {
        const line = lines.find(l => l.id === a.budgetLineId);
        if (line) amountMap[line.accountKey][a.periodStart as string] = parseFloat(a.amount);
      }
      return { lines, amountMap };
    };

    const [verA, verB] = await Promise.all([
      db.select().from(budgetVersions).where(eq(budgetVersions.id, versionA)),
      db.select().from(budgetVersions).where(eq(budgetVersions.id, versionB)),
    ]);
    if (!verA[0] || !verB[0]) return res.status(404).json({ error: "One or both versions not found" });

    const [gridA, gridB] = await Promise.all([fetchVersionGrid(versionA), fetchVersionGrid(versionB)]);

    // Build comparison: for each account, compute A, B, variance
    const allKeys = new Set<string>();
    gridA.lines.forEach(l => allKeys.add(l.accountKey));
    gridB.lines.forEach(l => allKeys.add(l.accountKey));

    const [budget] = await db.select().from(budgets).where(eq(budgets.id, verA[0].budgetId));
    const months = Array.from({ length: 12 }, (_, i) =>
      `${budget.fiscalYear}-${(i + 1).toString().padStart(2, '0')}-01`
    );

    const comparison = Array.from(allKeys).map(accountKey => {
      const lineA = gridA.lines.find(l => l.accountKey === accountKey);
      const lineB = gridB.lines.find(l => l.accountKey === accountKey);
      const monthly = months.map(m => {
        const a = gridA.amountMap[accountKey]?.[m] || 0;
        const b = gridB.amountMap[accountKey]?.[m] || 0;
        return { month: m, a, b, diff: b - a, pctDiff: a !== 0 ? ((b - a) / Math.abs(a)) * 100 : 0 };
      });
      const totalA = monthly.reduce((s, m) => s + m.a, 0);
      const totalB = monthly.reduce((s, m) => s + m.b, 0);
      return {
        accountKey,
        displayName: lineA?.displayName || lineB?.displayName || accountKey,
        lineType: lineA?.lineType || lineB?.lineType || 'OPEX',
        monthly,
        totalA,
        totalB,
        totalDiff: totalB - totalA,
        totalPctDiff: totalA !== 0 ? ((totalB - totalA) / Math.abs(totalA)) * 100 : 0,
      };
    });

    res.json({
      versionA: verA[0],
      versionB: verB[0],
      months,
      comparison,
    });
  } catch (err) { next(err); }
});

// ===========================================================================
// ENHANCED BVA — Budget vs Actual with GL actuals + monthly detail + YTD
// ===========================================================================
router.get("/bva-enhanced/:budgetId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const { budgetId } = req.params;
    const versionId = req.query.versionId as string | undefined;

    const [budget] = await db.select().from(budgets).where(eq(budgets.id, budgetId));
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    // Resolve version
    const versions = await db.select().from(budgetVersions).where(eq(budgetVersions.budgetId, budgetId));
    let targetVersion: BudgetVersion | undefined;
    if (versionId) {
      targetVersion = versions.find(v => v.id === versionId);
    }
    if (!targetVersion) {
      targetVersion = versions.find(v => v.isPrimary) || versions[0];
    }
    if (!targetVersion) return res.json({ lines: [], summary: {}, months: [] });

    const fiscalYear = budget.fiscalYear;
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = (i + 1).toString().padStart(2, '0');
      return `${fiscalYear}-${m}-01`;
    });

    // YTD cutoff: current month (inclusive)
    const now = new Date();
    const currentMonthIdx = now.getFullYear() === fiscalYear
      ? now.getMonth() // 0-based
      : now.getFullYear() > fiscalYear ? 11 : -1;

    // Budget lines + amounts
    const lines = await db.select().from(budgetLines)
      .where(eq(budgetLines.budgetVersionId, targetVersion.id))
      .orderBy(asc(budgetLines.sortOrder));
    const lineIds = lines.map(l => l.id);
    let budgetAmountsRows: BudgetAmount[] = [];
    if (lineIds.length > 0) {
      budgetAmountsRows = await db.select().from(budgetAmounts)
        .where(inArray(budgetAmounts.budgetLineId, lineIds));
    }

    // Actuals from actualsFacts
    const seedActuals = await db.select().from(actualsFacts).where(
      and(
        eq(actualsFacts.userId, userId),
        sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${fiscalYear}`,
      )
    );

    // Actuals from GL (opsBookkeepingGl)
    const glActuals = await db.select().from(opsBookkeepingGl).where(
      and(
        eq(opsBookkeepingGl.orgId, orgId),
        sql`EXTRACT(YEAR FROM ${opsBookkeepingGl.periodStart}::date) = ${fiscalYear}`,
      )
    );

    // Build GL actuals map using safe matching (prevents double-counting)
    const glByMonth = aggregateGlActuals(glActuals as any, lines);

    // Build per-line BVA
    const bvaLines = lines.map(line => {
      const lineAmounts: Record<string, number> = {};
      for (const a of budgetAmountsRows) {
        if (a.budgetLineId === line.id) lineAmounts[a.periodStart as string] = parseFloat(a.amount);
      }

      const isExpense = ['COGS', 'OPEX', 'OTHER_EXPENSE'].includes(line.lineType);

      const monthly = months.map((month, mIdx) => {
        const budgetAmt = lineAmounts[month] || 0;

        // Actual = seedActuals + GL actuals combined
        let actualAmt = 0;
        actualAmt += seedActuals
          .filter(a => (a.periodStart as string) === month && a.accountKey === line.accountKey)
          .reduce((s, a) => s + parseFloat(a.amount), 0);
        actualAmt += glByMonth[line.accountKey]?.[month] || 0;

        const varDollar = actualAmt - budgetAmt;
        const varPct = budgetAmt !== 0 ? (varDollar / Math.abs(budgetAmt)) * 100 : 0;
        const favorable = isExpense ? varDollar <= 0 : varDollar >= 0;
        const isYtd = mIdx <= currentMonthIdx;

        return {
          month,
          budget: Math.round(budgetAmt * 100) / 100,
          actual: Math.round(actualAmt * 100) / 100,
          varDollar: Math.round(varDollar * 100) / 100,
          varPct: Math.round(varPct * 100) / 100,
          favorable,
          isYtd,
        };
      });

      const ytdMonths = monthly.filter(m => m.isYtd);
      const ytd = {
        budget: ytdMonths.reduce((s, m) => s + m.budget, 0),
        actual: ytdMonths.reduce((s, m) => s + m.actual, 0),
        varDollar: 0 as number,
        varPct: 0 as number,
        favorable: false,
      };
      ytd.varDollar = ytd.actual - ytd.budget;
      ytd.varPct = ytd.budget !== 0 ? (ytd.varDollar / Math.abs(ytd.budget)) * 100 : 0;
      ytd.favorable = isExpense ? ytd.varDollar <= 0 : ytd.varDollar >= 0;

      const annual = {
        budget: monthly.reduce((s, m) => s + m.budget, 0),
        actual: monthly.reduce((s, m) => s + m.actual, 0),
        varDollar: 0 as number,
        varPct: 0 as number,
        favorable: false,
      };
      annual.varDollar = annual.actual - annual.budget;
      annual.varPct = annual.budget !== 0 ? (annual.varDollar / Math.abs(annual.budget)) * 100 : 0;
      annual.favorable = isExpense ? annual.varDollar <= 0 : annual.varDollar >= 0;

      return {
        accountKey: line.accountKey,
        displayName: line.displayName,
        lineType: line.lineType,
        monthly,
        ytd,
        annual,
      };
    });

    // Summary
    const revLines = bvaLines.filter(l => ['REVENUE', 'OTHER_INCOME'].includes(l.lineType));
    const expLines = bvaLines.filter(l => ['COGS', 'OPEX', 'OTHER_EXPENSE'].includes(l.lineType));
    const sumField = (arr: typeof bvaLines, field: 'budget' | 'actual') =>
      arr.reduce((s, l) => s + l.annual[field], 0);
    const ytdSumField = (arr: typeof bvaLines, field: 'budget' | 'actual') =>
      arr.reduce((s, l) => s + l.ytd[field], 0);

    const summary = {
      totalRevenueBudget: sumField(revLines, 'budget'),
      totalRevenueActual: sumField(revLines, 'actual'),
      totalExpenseBudget: sumField(expLines, 'budget'),
      totalExpenseActual: sumField(expLines, 'actual'),
      noiBudget: sumField(revLines, 'budget') - sumField(expLines, 'budget'),
      noiActual: sumField(revLines, 'actual') - sumField(expLines, 'actual'),
      ytdRevenueBudget: ytdSumField(revLines, 'budget'),
      ytdRevenueActual: ytdSumField(revLines, 'actual'),
      ytdExpenseBudget: ytdSumField(expLines, 'budget'),
      ytdExpenseActual: ytdSumField(expLines, 'actual'),
      ytdNoiBudget: ytdSumField(revLines, 'budget') - ytdSumField(expLines, 'budget'),
      ytdNoiActual: ytdSumField(revLines, 'actual') - ytdSumField(expLines, 'actual'),
    };

    res.json({
      budget,
      version: targetVersion,
      versions,
      lines: bvaLines,
      summary,
      months,
      currentMonthIdx,
    });
  } catch (err) { next(err); }
});

// ===========================================================================
// ROLLING FORECAST — Latest Estimate version
// Closed months = GL actuals, future months = budget values
// ===========================================================================
router.post("/version/:versionId/rolling-forecast", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const userId = getUserId(req);
    const orgId = getOrgId(req);

    // Resolve source version + budget
    const [srcVer] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, versionId));
    if (!srcVer) return res.status(404).json({ error: "Source version not found" });
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, srcVer.budgetId));
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    const fiscalYear = budget.fiscalYear;
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const months = Array.from({ length: 12 }, (_, i) =>
      `${fiscalYear}-${(i + 1).toString().padStart(2, '0')}-01`
    );

    // Check if a "Latest Estimate" version already exists for this budget
    const existingVersions = await db.select().from(budgetVersions)
      .where(eq(budgetVersions.budgetId, budget.id));
    let leVersion = existingVersions.find(v => v.name === "Latest Estimate");

    if (!leVersion) {
      // Clone the source version as "Latest Estimate"
      const [newVer] = await db.insert(budgetVersions).values({
        budgetId: budget.id,
        name: "Latest Estimate",
        isPrimary: false,
      }).returning();

      // Clone lines + amounts
      const srcLines = await db.select().from(budgetLines)
        .where(eq(budgetLines.budgetVersionId, versionId));
      for (const srcLine of srcLines) {
        const [newLine] = await db.insert(budgetLines).values({
          budgetVersionId: newVer.id,
          sortOrder: srcLine.sortOrder,
          lineType: srcLine.lineType,
          accountKey: srcLine.accountKey,
          displayName: srcLine.displayName,
        }).returning();
        const srcAmounts = await db.select().from(budgetAmounts)
          .where(eq(budgetAmounts.budgetLineId, srcLine.id));
        for (const a of srcAmounts) {
          await db.insert(budgetAmounts).values({
            budgetLineId: newLine.id,
            periodStart: a.periodStart,
            amount: a.amount,
          });
        }
      }

      // Clone tree
      await pool.query(
        `INSERT INTO budget_tree_accounts (budget_version_id, account_key, display_name, parent_key, line_type, sort_order, is_parent, asset_class)
         SELECT $1, account_key, display_name, parent_key, line_type, sort_order, is_parent, asset_class
         FROM budget_tree_accounts WHERE budget_version_id = $2
         ON CONFLICT (budget_version_id, account_key) DO NOTHING`,
        [newVer.id, versionId]
      );

      leVersion = newVer;
    }

    // Now overwrite closed months with actuals
    const leLines = await db.select().from(budgetLines)
      .where(eq(budgetLines.budgetVersionId, leVersion.id));

    // Gather actuals from both sources
    const seedActuals = await db.select().from(actualsFacts).where(
      and(eq(actualsFacts.userId, userId), sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${fiscalYear}`)
    );
    const glActuals = await db.select().from(opsBookkeepingGl).where(
      and(eq(opsBookkeepingGl.orgId, orgId), sql`EXTRACT(YEAR FROM ${opsBookkeepingGl.periodStart}::date) = ${fiscalYear}`)
    );

    // Build actuals by accountKey → month → total
    const actualsMap: Record<string, Record<string, number>> = {};
    for (const a of seedActuals) {
      if (!actualsMap[a.accountKey]) actualsMap[a.accountKey] = {};
      const p = a.periodStart as string;
      actualsMap[a.accountKey][p] = (actualsMap[a.accountKey][p] || 0) + parseFloat(a.amount);
    }

    // GL matching — use safe matcher to prevent double-counting
    const glMapped = aggregateGlActuals(glActuals as any, leLines);
    for (const [key, months] of Object.entries(glMapped)) {
      if (!actualsMap[key]) actualsMap[key] = {};
      for (const [p, val] of Object.entries(months)) {
        actualsMap[key][p] = (actualsMap[key][p] || 0) + val;
      }
    }

    // Overwrite closed months
    let updatedCells = 0;
    for (const line of leLines) {
      for (const month of months) {
        if (month >= currentMonthStr) continue; // Future — keep budget
        const actualVal = actualsMap[line.accountKey]?.[month];
        if (actualVal === undefined) continue;

        const existing = await db.select().from(budgetAmounts)
          .where(and(eq(budgetAmounts.budgetLineId, line.id), eq(budgetAmounts.periodStart, month)));
        const amount = actualVal.toString();
        if (existing.length > 0) {
          await db.update(budgetAmounts).set({ amount, updatedAt: new Date() }).where(eq(budgetAmounts.id, existing[0].id));
        } else {
          await db.insert(budgetAmounts).values({ budgetLineId: line.id, periodStart: month, amount });
        }
        updatedCells++;
      }
    }

    res.json({
      ok: true,
      versionId: leVersion.id,
      versionName: leVersion.name,
      updatedCells,
      currentMonth: currentMonthStr,
    });
  } catch (err) { next(err); }
});

// ===========================================================================
// AI BUDGET ASSISTANT
// ===========================================================================

// (1) Seed assumptions from actuals — analyze prior year, compute growth, auto-fill
router.post("/ai/seed-assumptions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const { versionId, growthOverride } = z.object({
      versionId: z.string(),
      growthOverride: z.number().optional(), // manual override for all accounts
    }).parse(req.body);

    const [ver] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, versionId));
    if (!ver) return res.status(404).json({ error: "Version not found" });
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, ver.budgetId));
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    const fiscalYear = budget.fiscalYear;
    const priorYear = fiscalYear - 1;
    const twoYearsAgo = fiscalYear - 2;

    // Pull prior year actuals
    const priorActuals = await db.select().from(actualsFacts).where(
      and(eq(actualsFacts.userId, userId), sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${priorYear}`)
    );
    // Pull two-years-ago for growth calculation
    const olderActuals = await db.select().from(actualsFacts).where(
      and(eq(actualsFacts.userId, userId), sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${twoYearsAgo}`)
    );

    // Also try GL
    const priorGl = await db.select().from(opsBookkeepingGl).where(
      and(eq(opsBookkeepingGl.orgId, orgId), sql`EXTRACT(YEAR FROM ${opsBookkeepingGl.periodStart}::date) = ${priorYear}`)
    );

    // Aggregate by account → month
    const priorByAccount: Record<string, number[]> = {};
    const olderByAccount: Record<string, number> = {};

    for (const a of priorActuals) {
      if (!priorByAccount[a.accountKey]) priorByAccount[a.accountKey] = new Array(12).fill(0);
      const mIdx = parseInt((a.periodStart as string).slice(5, 7), 10) - 1;
      priorByAccount[a.accountKey][mIdx] += parseFloat(a.amount);
    }

    for (const a of olderActuals) {
      olderByAccount[a.accountKey] = (olderByAccount[a.accountKey] || 0) + parseFloat(a.amount);
    }

    // Add GL entries — use safe matcher
    const budLines = await db.select().from(budgetLines).where(eq(budgetLines.budgetVersionId, versionId));
    const glMapped = aggregateGlActuals(priorGl as any, budLines);
    for (const [key, monthAmts] of Object.entries(glMapped)) {
      if (!priorByAccount[key]) priorByAccount[key] = new Array(12).fill(0);
      for (const [period, val] of Object.entries(monthAmts)) {
        const mIdx = parseInt(period.slice(5, 7), 10) - 1;
        if (mIdx >= 0 && mIdx < 12) priorByAccount[key][mIdx] += val;
      }
    }

    // For each account, compute YoY growth and apply
    const assumptions: { accountKey: string; priorTotal: number; growthRate: number; budgetTotal: number }[] = [];
    const skippedAccounts: { accountKey: string; displayName: string; reason: string }[] = [];
    const months = Array.from({ length: 12 }, (_, i) =>
      `${fiscalYear}-${(i + 1).toString().padStart(2, '0')}-01`
    );

    for (const line of budLines) {
      const priorMonthly = priorByAccount[line.accountKey];
      if (!priorMonthly) {
        skippedAccounts.push({ accountKey: line.accountKey, displayName: line.displayName, reason: 'no_prior_data' });
        continue;
      }

      const priorTotal = priorMonthly.reduce((s, v) => s + v, 0);
      if (priorTotal === 0) {
        skippedAccounts.push({ accountKey: line.accountKey, displayName: line.displayName, reason: 'zero_prior_total' });
        continue;
      }

      // Compute growth rate
      let growth: number;
      if (growthOverride !== undefined) {
        growth = growthOverride;
      } else {
        const olderTotal = olderByAccount[line.accountKey] || 0;
        if (olderTotal > 0) {
          growth = (priorTotal - olderTotal) / Math.abs(olderTotal);
          growth = Math.max(-0.20, Math.min(0.30, growth)); // Clamp to ±20-30%
        } else {
          growth = 0.03; // Default 3% growth
        }
      }

      // Apply growth to each month (preserving seasonality)
      const budgetTotal = priorTotal * (1 + growth);
      for (let m = 0; m < 12; m++) {
        const weight = priorTotal !== 0 ? priorMonthly[m] / priorTotal : 1 / 12;
        const amount = Math.round(budgetTotal * weight * 100) / 100;

        const existing = await db.select().from(budgetAmounts)
          .where(and(eq(budgetAmounts.budgetLineId, line.id), eq(budgetAmounts.periodStart, months[m])));
        if (existing.length > 0) {
          await db.update(budgetAmounts).set({ amount: amount.toString(), updatedAt: new Date() })
            .where(eq(budgetAmounts.id, existing[0].id));
        } else {
          await db.insert(budgetAmounts).values({ budgetLineId: line.id, periodStart: months[m], amount: amount.toString() });
        }
      }

      assumptions.push({
        accountKey: line.accountKey,
        priorTotal: Math.round(priorTotal),
        growthRate: Math.round(growth * 10000) / 100,
        budgetTotal: Math.round(budgetTotal),
      });
    }

    res.json({
      ok: true,
      accountsUpdated: assumptions.length,
      accountsSkipped: skippedAccounts.length,
      assumptions,
      skippedAccounts,
      method: growthOverride !== undefined ? "manual_override" : "yoy_growth",
    });
  } catch (err) { next(err); }
});

// (2) Explain variance — fetch GL transactions, build plain-English explanation
router.post("/ai/explain-variance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const orgId = getOrgId(req);
    const { versionId, accountKey, month } = z.object({
      versionId: z.string(),
      accountKey: z.string(),
      month: z.string().optional(), // If omitted, YTD
    }).parse(req.body);

    const [ver] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, versionId));
    if (!ver) return res.status(404).json({ error: "Version not found" });
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, ver.budgetId));
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    const fiscalYear = budget.fiscalYear;

    // Get budget amount
    const [line] = await db.select().from(budgetLines)
      .where(and(eq(budgetLines.budgetVersionId, versionId), eq(budgetLines.accountKey, accountKey)));
    if (!line) return res.status(404).json({ error: "Budget line not found" });

    const isExpense = ['COGS', 'OPEX', 'OTHER_EXPENSE'].includes(line.lineType);

    // Determine months to analyze
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
    let targetMonths: string[];
    if (month) {
      targetMonths = [month];
    } else {
      // YTD
      targetMonths = [];
      for (let m = 1; m <= 12; m++) {
        const ms = `${fiscalYear}-${m.toString().padStart(2, '0')}-01`;
        if (ms < currentMonthStr) targetMonths.push(ms);
      }
    }

    // Budget total for the period
    const budgetAmts = await db.select().from(budgetAmounts)
      .where(eq(budgetAmounts.budgetLineId, line.id));
    let budgetTotal = 0;
    for (const ba of budgetAmts) {
      if (targetMonths.includes(ba.periodStart as string)) {
        budgetTotal += parseFloat(ba.amount);
      }
    }

    // Actual from seed actuals
    let actualTotal = 0;
    const seedActuals = await db.select().from(actualsFacts).where(
      and(eq(actualsFacts.userId, userId), eq(actualsFacts.accountKey, accountKey),
        sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${fiscalYear}`)
    );
    for (const a of seedActuals) {
      if (targetMonths.includes(a.periodStart as string)) {
        actualTotal += parseFloat(a.amount);
      }
    }

    // GL transactions for this account
    const glConditions = [
      eq(opsBookkeepingGl.orgId, orgId),
      sql`EXTRACT(YEAR FROM ${opsBookkeepingGl.periodStart}::date) = ${fiscalYear}`,
    ];
    const glEntries = await db.select().from(opsBookkeepingGl).where(and(...glConditions));

    // Match GL to this account using safe matcher
    const matchedGl = glEntries.filter(gl => {
      const matched = matchGlToBudgetLine(gl.accountName, [{ accountKey: line.accountKey, displayName: line.displayName }]);
      return matched === line.accountKey;
    }).filter(gl => targetMonths.includes(gl.periodStart as string));

    for (const gl of matchedGl) {
      actualTotal += parseFloat(gl.amount);
    }

    const variance = actualTotal - budgetTotal;
    const variancePct = budgetTotal !== 0 ? (variance / Math.abs(budgetTotal)) * 100 : 0;
    const favorable = isExpense ? variance <= 0 : variance >= 0;

    // Get prior year for context
    const priorYear = fiscalYear - 1;
    const priorActuals = await db.select().from(actualsFacts).where(
      and(eq(actualsFacts.userId, userId), eq(actualsFacts.accountKey, accountKey),
        sql`EXTRACT(YEAR FROM ${actualsFacts.periodStart}::date) = ${priorYear}`)
    );
    let priorTotal = 0;
    for (const a of priorActuals) {
      const aMonth = (a.periodStart as string).replace(`${priorYear}`, `${fiscalYear}`);
      if (targetMonths.includes(aMonth)) priorTotal += parseFloat(a.amount);
    }
    const yoyChange = priorTotal !== 0 ? ((actualTotal - priorTotal) / Math.abs(priorTotal)) * 100 : 0;

    // Build GL transaction details
    const transactions = matchedGl.map(gl => ({
      date: gl.periodStart,
      amount: parseFloat(gl.amount),
      notes: gl.notes,
      source: gl.source,
    })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    // Build explanation
    const periodLabel = month
      ? new Date(month + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `YTD (${targetMonths.length} months)`;

    const direction = variance >= 0 ? "higher" : "lower";
    const favorability = favorable ? "favorable" : "unfavorable";

    let explanation = `**${line.displayName}** — ${periodLabel}\n\n`;
    explanation += `Budget: $${budgetTotal.toLocaleString()} | Actual: $${actualTotal.toLocaleString()} | `;
    explanation += `Variance: ${variance >= 0 ? '+' : ''}$${variance.toLocaleString()} (${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%) — **${favorability}**\n\n`;

    if (priorTotal > 0) {
      explanation += `Compared to prior year same period ($${priorTotal.toLocaleString()}), actuals are ${yoyChange >= 0 ? 'up' : 'down'} ${Math.abs(yoyChange).toFixed(1)}% YoY.\n\n`;
    }

    if (Math.abs(variancePct) < 5) {
      explanation += `The variance is within normal range (< 5%). ${line.displayName} is tracking close to budget.`;
    } else if (favorable) {
      if (isExpense) {
        explanation += `${line.displayName} is running $${Math.abs(variance).toLocaleString()} ${direction} than budget. This is ${favorability} — spending is under control.`;
      } else {
        explanation += `${line.displayName} is outperforming budget by $${Math.abs(variance).toLocaleString()}. Revenue is trending ${direction} than planned.`;
      }
    } else {
      if (isExpense) {
        explanation += `⚠️ ${line.displayName} is $${Math.abs(variance).toLocaleString()} over budget. Review the largest transactions below for cost drivers.`;
      } else {
        explanation += `⚠️ ${line.displayName} is $${Math.abs(variance).toLocaleString()} under budget. Revenue shortfall may require corrective action.`;
      }
    }

    if (transactions.length > 0) {
      explanation += `\n\n**Top GL entries:**\n`;
      for (const t of transactions.slice(0, 5)) {
        explanation += `- ${t.date}: $${t.amount.toLocaleString()}${t.notes ? ` — ${t.notes}` : ''}\n`;
      }
    }

    res.json({
      accountKey,
      displayName: line.displayName,
      lineType: line.lineType,
      period: periodLabel,
      budgetTotal: Math.round(budgetTotal * 100) / 100,
      actualTotal: Math.round(actualTotal * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      variancePct: Math.round(variancePct * 100) / 100,
      favorable,
      priorYearTotal: Math.round(priorTotal * 100) / 100,
      yoyChangePct: Math.round(yoyChange * 100) / 100,
      explanation,
      transactions: transactions.slice(0, 10),
    });
  } catch (err) { next(err); }
});

// (3) What-if analysis — adjust driver assumptions, see NOI impact
router.post("/ai/what-if", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId, adjustments } = z.object({
      versionId: z.string(),
      adjustments: z.array(z.object({
        accountKey: z.string(),
        changePct: z.number(), // e.g. +5 = 5% increase, -10 = 10% decrease
      })),
    }).parse(req.body);

    const [ver] = await db.select().from(budgetVersions).where(eq(budgetVersions.id, versionId));
    if (!ver) return res.status(404).json({ error: "Version not found" });
    const [budget] = await db.select().from(budgets).where(eq(budgets.id, ver.budgetId));
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    const months = Array.from({ length: 12 }, (_, i) =>
      `${budget.fiscalYear}-${(i + 1).toString().padStart(2, '0')}-01`
    );

    // Fetch all lines + amounts
    const lines = await db.select().from(budgetLines)
      .where(eq(budgetLines.budgetVersionId, versionId));
    const lineIds = lines.map(l => l.id);
    let allAmounts: BudgetAmount[] = [];
    if (lineIds.length > 0) {
      allAmounts = await db.select().from(budgetAmounts)
        .where(inArray(budgetAmounts.budgetLineId, lineIds));
    }

    // Build current amounts map
    const currentByAccount: Record<string, number[]> = {};
    for (const line of lines) {
      currentByAccount[line.accountKey] = new Array(12).fill(0);
    }
    for (const a of allAmounts) {
      const line = lines.find(l => l.id === a.budgetLineId);
      if (!line) continue;
      const mIdx = parseInt((a.periodStart as string).slice(5, 7), 10) - 1;
      currentByAccount[line.accountKey][mIdx] = parseFloat(a.amount);
    }

    // Compute baseline NOI
    const computeNoi = (amounts: Record<string, number[]>) => {
      let totalRev = 0, totalExp = 0;
      const monthlyNoi: number[] = new Array(12).fill(0);
      for (const line of lines) {
        const vals = amounts[line.accountKey] || new Array(12).fill(0);
        for (let m = 0; m < 12; m++) {
          if (['REVENUE', 'OTHER_INCOME'].includes(line.lineType)) {
            totalRev += vals[m];
            monthlyNoi[m] += vals[m];
          } else {
            totalExp += vals[m];
            monthlyNoi[m] -= vals[m];
          }
        }
      }
      return { totalRev, totalExp, noi: totalRev - totalExp, monthlyNoi };
    };

    const baseline = computeNoi(currentByAccount);

    // Apply adjustments
    const adjustedByAccount = { ...currentByAccount };
    const adjustmentDetails: { accountKey: string; displayName: string; baseTotal: number; adjustedTotal: number; changePct: number }[] = [];

    for (const adj of adjustments) {
      const line = lines.find(l => l.accountKey === adj.accountKey);
      if (!line) continue;
      const base = currentByAccount[adj.accountKey] || new Array(12).fill(0);
      const factor = 1 + (adj.changePct / 100);
      adjustedByAccount[adj.accountKey] = base.map(v => Math.round(v * factor * 100) / 100);

      adjustmentDetails.push({
        accountKey: adj.accountKey,
        displayName: line.displayName,
        baseTotal: base.reduce((s, v) => s + v, 0),
        adjustedTotal: adjustedByAccount[adj.accountKey].reduce((s, v) => s + v, 0),
        changePct: adj.changePct,
      });
    }

    const scenario = computeNoi(adjustedByAccount);

    const noiImpact = scenario.noi - baseline.noi;
    const noiImpactPct = baseline.noi !== 0 ? (noiImpact / Math.abs(baseline.noi)) * 100 : 0;

    // Build monthly comparison
    const monthlyComparison = months.map((m, i) => ({
      month: m,
      baselineNoi: Math.round(baseline.monthlyNoi[i] * 100) / 100,
      scenarioNoi: Math.round(scenario.monthlyNoi[i] * 100) / 100,
      impact: Math.round((scenario.monthlyNoi[i] - baseline.monthlyNoi[i]) * 100) / 100,
    }));

    res.json({
      baseline: {
        revenue: Math.round(baseline.totalRev),
        expenses: Math.round(baseline.totalExp),
        noi: Math.round(baseline.noi),
      },
      scenario: {
        revenue: Math.round(scenario.totalRev),
        expenses: Math.round(scenario.totalExp),
        noi: Math.round(scenario.noi),
      },
      noiImpact: Math.round(noiImpact),
      noiImpactPct: Math.round(noiImpactPct * 100) / 100,
      favorable: noiImpact >= 0,
      adjustments: adjustmentDetails,
      monthlyComparison,
    });
  } catch (err) { next(err); }
});

export default router;
