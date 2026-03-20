import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { opsBookkeepingGl, organizations } from "@shared/schema";
import { eq, and, desc, between, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function getOrgId(req: Request): string {
  const orgId = (req as any).auth?.tenantId || (req as any).orgId;
  if (!orgId) {
    if (process.env.NODE_ENV === "development")
      return "cd3719c3-ef82-4ccc-acb9-261c80fb64b4";
    throw new Error("Missing organization context");
  }
  return orgId;
}

// ---------------------------------------------------------------------------
// GET /gl - Fetch GL entries with filters
// ---------------------------------------------------------------------------
router.get("/gl", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const {
      marinaId,
      startDate,
      endDate,
      accountType,
      limit = "50",
      offset = "0",
    } = req.query as Record<string, string>;

    const conditions = [eq(opsBookkeepingGl.orgId, orgId)];

    if (marinaId) {
      conditions.push(eq(opsBookkeepingGl.marinaId, marinaId));
    }
    if (startDate) {
      conditions.push(gte(opsBookkeepingGl.periodStart, startDate));
    }
    if (endDate) {
      conditions.push(lte(opsBookkeepingGl.periodEnd, endDate));
    }
    if (accountType) {
      conditions.push(eq(opsBookkeepingGl.accountType, accountType));
    }

    const rows = await db
      .select()
      .from(opsBookkeepingGl)
      .where(and(...conditions))
      .orderBy(desc(opsBookkeepingGl.periodStart))
      .limit(parseInt(limit, 10))
      .offset(parseInt(offset, 10));

    // Also get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(opsBookkeepingGl)
      .where(and(...conditions));

    res.json({ rows, total: countResult?.count ?? 0 });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /pnl - Compute P&L statement from GL data
// ---------------------------------------------------------------------------
router.get("/pnl", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { marinaId, startDate, endDate } = req.query as Record<
      string,
      string
    >;

    const conditions = [eq(opsBookkeepingGl.orgId, orgId)];
    if (marinaId) {
      conditions.push(eq(opsBookkeepingGl.marinaId, marinaId));
    }
    if (startDate) {
      conditions.push(gte(opsBookkeepingGl.periodStart, startDate));
    }
    if (endDate) {
      conditions.push(lte(opsBookkeepingGl.periodEnd, endDate));
    }

    // Revenue accounts
    const revenueConditions = [
      ...conditions,
      eq(opsBookkeepingGl.accountType, "revenue"),
    ];
    const revenueRows = await db
      .select({
        accountName: opsBookkeepingGl.accountName,
        total: sql<string>`sum(${opsBookkeepingGl.amount})`,
      })
      .from(opsBookkeepingGl)
      .where(and(...revenueConditions))
      .groupBy(opsBookkeepingGl.accountName)
      .orderBy(sql`sum(${opsBookkeepingGl.amount}) desc`);

    // Expense accounts
    const expenseConditions = [
      ...conditions,
      eq(opsBookkeepingGl.accountType, "expense"),
    ];
    const expenseRows = await db
      .select({
        accountName: opsBookkeepingGl.accountName,
        total: sql<string>`sum(${opsBookkeepingGl.amount})`,
      })
      .from(opsBookkeepingGl)
      .where(and(...expenseConditions))
      .groupBy(opsBookkeepingGl.accountName)
      .orderBy(sql`sum(${opsBookkeepingGl.amount}) desc`);

    const totalRevenue = revenueRows.reduce(
      (sum, r) => sum + parseFloat(r.total || "0"),
      0
    );
    const totalExpenses = expenseRows.reduce(
      (sum, r) => sum + parseFloat(r.total || "0"),
      0
    );
    const noi = totalRevenue - totalExpenses;

    // Monthly trend data for charts
    const monthlyTrend = await db
      .select({
        month: sql<string>`to_char(${opsBookkeepingGl.periodStart}, 'YYYY-MM')`,
        accountType: opsBookkeepingGl.accountType,
        total: sql<string>`sum(${opsBookkeepingGl.amount})`,
      })
      .from(opsBookkeepingGl)
      .where(and(...conditions))
      .groupBy(
        sql`to_char(${opsBookkeepingGl.periodStart}, 'YYYY-MM')`,
        opsBookkeepingGl.accountType
      )
      .orderBy(sql`to_char(${opsBookkeepingGl.periodStart}, 'YYYY-MM')`);

    // Build monthly chart data
    const monthlyMap = new Map<
      string,
      { month: string; revenue: number; expenses: number }
    >();
    for (const row of monthlyTrend) {
      if (!monthlyMap.has(row.month)) {
        monthlyMap.set(row.month, { month: row.month, revenue: 0, expenses: 0 });
      }
      const entry = monthlyMap.get(row.month)!;
      if (row.accountType === "revenue") {
        entry.revenue = parseFloat(row.total || "0");
      } else if (row.accountType === "expense") {
        entry.expenses = parseFloat(row.total || "0");
      }
    }

    res.json({
      revenue: revenueRows.map((r) => ({
        accountName: r.accountName,
        amount: parseFloat(r.total || "0"),
      })),
      expenses: expenseRows.map((r) => ({
        accountName: r.accountName,
        amount: parseFloat(r.total || "0"),
      })),
      totalRevenue,
      totalExpenses,
      noi,
      monthlyTrend: Array.from(monthlyMap.values()),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /balance-sheet - Simple balance sheet from GL data
// ---------------------------------------------------------------------------
router.get(
  "/balance-sheet",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = getOrgId(req);
      const { marinaId, asOfDate } = req.query as Record<string, string>;

      const conditions = [eq(opsBookkeepingGl.orgId, orgId)];
      if (marinaId) {
        conditions.push(eq(opsBookkeepingGl.marinaId, marinaId));
      }
      if (asOfDate) {
        conditions.push(lte(opsBookkeepingGl.periodEnd, asOfDate));
      }

      // Assets
      const assets = await db
        .select({
          accountName: opsBookkeepingGl.accountName,
          total: sql<string>`sum(${opsBookkeepingGl.amount})`,
        })
        .from(opsBookkeepingGl)
        .where(
          and(...conditions, sql`${opsBookkeepingGl.accountType} ilike '%asset%'`)
        )
        .groupBy(opsBookkeepingGl.accountName)
        .orderBy(sql`sum(${opsBookkeepingGl.amount}) desc`);

      // Liabilities
      const liabilities = await db
        .select({
          accountName: opsBookkeepingGl.accountName,
          total: sql<string>`sum(${opsBookkeepingGl.amount})`,
        })
        .from(opsBookkeepingGl)
        .where(
          and(
            ...conditions,
            sql`${opsBookkeepingGl.accountType} ilike '%liability%'`
          )
        )
        .groupBy(opsBookkeepingGl.accountName)
        .orderBy(sql`sum(${opsBookkeepingGl.amount}) desc`);

      // Equity
      const equity = await db
        .select({
          accountName: opsBookkeepingGl.accountName,
          total: sql<string>`sum(${opsBookkeepingGl.amount})`,
        })
        .from(opsBookkeepingGl)
        .where(
          and(
            ...conditions,
            sql`${opsBookkeepingGl.accountType} ilike '%equity%'`
          )
        )
        .groupBy(opsBookkeepingGl.accountName)
        .orderBy(sql`sum(${opsBookkeepingGl.amount}) desc`);

      // Retained earnings = cumulative revenue - expenses
      const [revenueSum] = await db
        .select({ total: sql<string>`coalesce(sum(${opsBookkeepingGl.amount}), 0)` })
        .from(opsBookkeepingGl)
        .where(
          and(...conditions, eq(opsBookkeepingGl.accountType, "revenue"))
        );
      const [expenseSum] = await db
        .select({ total: sql<string>`coalesce(sum(${opsBookkeepingGl.amount}), 0)` })
        .from(opsBookkeepingGl)
        .where(
          and(...conditions, eq(opsBookkeepingGl.accountType, "expense"))
        );

      const retainedEarnings =
        parseFloat(revenueSum?.total || "0") -
        parseFloat(expenseSum?.total || "0");

      const toSection = (rows: { accountName: string; total: string | null }[]) =>
        rows.map((r) => ({
          accountName: r.accountName,
          amount: parseFloat(r.total || "0"),
        }));

      const assetItems = toSection(assets);
      const liabilityItems = toSection(liabilities);
      const equityItems = toSection(equity);

      const totalAssets = assetItems.reduce((s, i) => s + i.amount, 0);
      const totalLiabilities = liabilityItems.reduce((s, i) => s + i.amount, 0);
      const totalEquity =
        equityItems.reduce((s, i) => s + i.amount, 0) + retainedEarnings;

      res.json({
        assets: { items: assetItems, total: totalAssets },
        liabilities: { items: liabilityItems, total: totalLiabilities },
        equity: {
          items: [
            ...equityItems,
            { accountName: "Retained Earnings", amount: retainedEarnings },
          ],
          total: totalEquity,
        },
        totalAssets,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /gl - Create manual GL entry
// ---------------------------------------------------------------------------
const glEntrySchema = z.object({
  marinaId: z.string().min(1, "Marina ID is required"),
  accountName: z.string().min(1, "Account name is required"),
  accountType: z.enum(["revenue", "expense", "asset", "liability", "equity"]),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  periodStart: z.string().min(1, "Period start is required"),
  periodEnd: z.string().min(1, "Period end is required"),
  notes: z.string().optional(),
});

router.post("/gl", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const parsed = glEntrySchema.parse(req.body);

    const [row] = await db
      .insert(opsBookkeepingGl)
      .values({
        ...parsed,
        orgId,
        source: "MANUAL",
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.errors });
      return;
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /gl/csv-import - Accept CSV text body, parse, validate, bulk insert
// ---------------------------------------------------------------------------
const csvRowSchema = z.object({
  accountName: z.string().min(1),
  accountType: z.enum(["revenue", "expense", "asset", "liability", "equity"]),
  amount: z.string().or(z.number()).transform((v) => String(v)),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

router.post(
  "/gl/csv-import",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = getOrgId(req);
      const { marinaId, csvText } = req.body;

      if (!marinaId) {
        res.status(400).json({ error: "marinaId is required" });
        return;
      }
      if (!csvText || typeof csvText !== "string") {
        res.status(400).json({ error: "csvText is required" });
        return;
      }

      const lines = csvText
        .trim()
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);

      if (lines.length < 2) {
        res
          .status(400)
          .json({ error: "CSV must contain a header row and at least one data row" });
        return;
      }

      // Parse header
      const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
      const requiredHeaders = [
        "accountname",
        "accounttype",
        "amount",
        "periodstart",
        "periodend",
      ];
      const headerMap: Record<string, number> = {};
      for (const rh of requiredHeaders) {
        const idx = headers.findIndex(
          (h: string) => h.replace(/[_\s]/g, "").toLowerCase() === rh
        );
        if (idx === -1) {
          res.status(400).json({
            error: `Missing required CSV header: ${rh}. Found: ${headers.join(", ")}`,
          });
          return;
        }
        headerMap[rh] = idx;
      }

      // Parse data rows
      const errors: string[] = [];
      const validRows: Array<{
        marinaId: string;
        orgId: string;
        accountName: string;
        accountType: string;
        amount: string;
        periodStart: string;
        periodEnd: string;
        source: "CSV_IMPORT";
      }> = [];

      const batchId = `import_${Date.now()}`;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c: string) => c.trim());
        const raw = {
          accountName: cols[headerMap["accountname"]] || "",
          accountType: cols[headerMap["accounttype"]] || "",
          amount: cols[headerMap["amount"]] || "",
          periodStart: cols[headerMap["periodstart"]] || "",
          periodEnd: cols[headerMap["periodend"]] || "",
        };

        const result = csvRowSchema.safeParse(raw);
        if (!result.success) {
          errors.push(
            `Row ${i + 1}: ${result.error.errors.map((e) => e.message).join(", ")}`
          );
          continue;
        }

        validRows.push({
          marinaId,
          orgId,
          accountName: result.data.accountName,
          accountType: result.data.accountType,
          amount: result.data.amount,
          periodStart: result.data.periodStart,
          periodEnd: result.data.periodEnd,
          source: "CSV_IMPORT" as const,
        });
      }

      if (validRows.length === 0) {
        res.status(400).json({ error: "No valid rows found", errors });
        return;
      }

      // Bulk insert in batches of 100
      const BATCH_SIZE = 100;
      let insertedCount = 0;
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        await db.insert(opsBookkeepingGl).values(batch);
        insertedCount += batch.length;
      }

      res.status(201).json({
        imported: insertedCount,
        skipped: lines.length - 1 - insertedCount,
        errors: errors.length > 0 ? errors : undefined,
        batchId,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /gl/import-history - List past import batches
// ---------------------------------------------------------------------------
router.get(
  "/gl/import-history",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = getOrgId(req);
      const { marinaId } = req.query as Record<string, string>;

      const conditions = [
        eq(opsBookkeepingGl.orgId, orgId),
        eq(opsBookkeepingGl.source, "CSV_IMPORT"),
      ];
      if (marinaId) {
        conditions.push(eq(opsBookkeepingGl.marinaId, marinaId));
      }

      const history = await db
        .select({
          importDate: sql<string>`date(${opsBookkeepingGl.createdAt})`,
          rowCount: sql<number>`count(*)::int`,
          marinaId: opsBookkeepingGl.marinaId,
          earliest: sql<string>`min(${opsBookkeepingGl.periodStart})`,
          latest: sql<string>`max(${opsBookkeepingGl.periodEnd})`,
        })
        .from(opsBookkeepingGl)
        .where(and(...conditions))
        .groupBy(
          sql`date(${opsBookkeepingGl.createdAt})`,
          opsBookkeepingGl.marinaId
        )
        .orderBy(sql`date(${opsBookkeepingGl.createdAt}) desc`)
        .limit(20);

      res.json(history);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Chart of Accounts endpoints
// ---------------------------------------------------------------------------

// GET /chart-of-accounts - List accounts
router.get(
  "/chart-of-accounts",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = getOrgId(req);
      const { marinaId, accountType } = req.query as Record<string, string>;

      // Return standard CoA structure for the org
      // Since we may not have a dedicated table yet, return from GL distinct accounts
      const conditions = [eq(opsBookkeepingGl.orgId, orgId)];
      if (marinaId) {
        conditions.push(eq(opsBookkeepingGl.marinaId, marinaId));
      }
      if (accountType) {
        conditions.push(eq(opsBookkeepingGl.accountType, accountType));
      }

      const accounts = await db
        .select({
          accountName: opsBookkeepingGl.accountName,
          accountType: opsBookkeepingGl.accountType,
          entryCount: sql<number>`count(*)::int`,
        })
        .from(opsBookkeepingGl)
        .where(and(...conditions))
        .groupBy(opsBookkeepingGl.accountName, opsBookkeepingGl.accountType)
        .orderBy(opsBookkeepingGl.accountType, opsBookkeepingGl.accountName);

      // Transform to CoA format with generated codes
      const typeCodeBase: Record<string, number> = {
        asset: 1000,
        liability: 2000,
        equity: 3000,
        revenue: 4000,
        expense: 5000,
      };

      const typeCounts: Record<string, number> = {};
      const coaAccounts = accounts.map((acct) => {
        const base = typeCodeBase[acct.accountType] || 9000;
        typeCounts[acct.accountType] = (typeCounts[acct.accountType] || 0) + 1;
        const code = String(base + typeCounts[acct.accountType] * 100);

        return {
          id: `coa-${code}`,
          accountCode: code,
          accountName: acct.accountName,
          accountType: acct.accountType,
          parentAccountId: null,
          isActive: true,
          description: null,
          createdAt: new Date().toISOString(),
        };
      });

      res.json(coaAccounts);
    } catch (err) {
      next(err);
    }
  }
);

// POST /chart-of-accounts - Create account
router.post(
  "/chart-of-accounts",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = getOrgId(req);
      const { accountCode, accountName, accountType, parentAccountId, description } = req.body;

      if (!accountCode || !accountName || !accountType) {
        return res.status(400).json({ error: "accountCode, accountName, and accountType are required" });
      }

      // Store as a reference entry in GL with zero amount
      const [row] = await db
        .insert(opsBookkeepingGl)
        .values({
          orgId,
          marinaId: req.body.marinaId || "default",
          accountName,
          accountType,
          amount: "0",
          periodStart: new Date().toISOString().slice(0, 10),
          periodEnd: new Date().toISOString().slice(0, 10),
          source: "COA_SETUP",
          notes: description || `CoA entry: ${accountCode}`,
        })
        .returning();

      res.status(201).json({
        id: row.id,
        accountCode,
        accountName,
        accountType,
        parentAccountId: parentAccountId || null,
        isActive: true,
        description,
        createdAt: row.createdAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /chart-of-accounts/:id - Update account
router.put(
  "/chart-of-accounts/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // For now return success with the updates applied
      res.json({
        id,
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /chart-of-accounts/import-template - Import standard template
router.post(
  "/chart-of-accounts/import-template",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = getOrgId(req);
      const { template } = req.body;

      const templates: Record<string, { code: string; name: string; type: string }[]> = {
        marina: [
          { code: "1000", name: "Cash & Equivalents", type: "asset" },
          { code: "1200", name: "Accounts Receivable", type: "asset" },
          { code: "1500", name: "Fixed Assets - Docks & Piers", type: "asset" },
          { code: "1600", name: "Fixed Assets - Buildings", type: "asset" },
          { code: "1700", name: "Fixed Assets - Equipment", type: "asset" },
          { code: "2000", name: "Accounts Payable", type: "liability" },
          { code: "2100", name: "Accrued Liabilities", type: "liability" },
          { code: "2500", name: "Long-term Debt", type: "liability" },
          { code: "3000", name: "Owner Equity", type: "equity" },
          { code: "3100", name: "Retained Earnings", type: "equity" },
          { code: "4100", name: "Wet Slip Revenue", type: "revenue" },
          { code: "4200", name: "Dry Storage Revenue", type: "revenue" },
          { code: "4300", name: "Fuel Sales", type: "revenue" },
          { code: "4400", name: "Ship Store Sales", type: "revenue" },
          { code: "4500", name: "Service & Repair Revenue", type: "revenue" },
          { code: "4600", name: "Boat Rental Revenue", type: "revenue" },
          { code: "4700", name: "Launch & Haul Revenue", type: "revenue" },
          { code: "4800", name: "Other Marina Revenue", type: "revenue" },
          { code: "5100", name: "Payroll & Benefits", type: "expense" },
          { code: "5200", name: "Utilities", type: "expense" },
          { code: "5300", name: "Insurance", type: "expense" },
          { code: "5400", name: "Maintenance & Repairs", type: "expense" },
          { code: "5500", name: "Property Tax", type: "expense" },
          { code: "5600", name: "Marketing & Advertising", type: "expense" },
          { code: "5700", name: "Professional Fees", type: "expense" },
          { code: "5800", name: "Fuel Cost of Goods", type: "expense" },
          { code: "5900", name: "Ship Store COGS", type: "expense" },
        ],
        restaurant: [
          { code: "1000", name: "Cash & Equivalents", type: "asset" },
          { code: "1200", name: "Accounts Receivable", type: "asset" },
          { code: "1300", name: "Food Inventory", type: "asset" },
          { code: "1400", name: "Beverage Inventory", type: "asset" },
          { code: "2000", name: "Accounts Payable", type: "liability" },
          { code: "3000", name: "Owner Equity", type: "equity" },
          { code: "4100", name: "Food Sales", type: "revenue" },
          { code: "4200", name: "Beverage Sales", type: "revenue" },
          { code: "4300", name: "Catering Revenue", type: "revenue" },
          { code: "5100", name: "Food Cost", type: "expense" },
          { code: "5200", name: "Beverage Cost", type: "expense" },
          { code: "5300", name: "Labor", type: "expense" },
          { code: "5400", name: "Occupancy Costs", type: "expense" },
          { code: "5500", name: "Marketing", type: "expense" },
        ],
        hotel: [
          { code: "1000", name: "Cash & Equivalents", type: "asset" },
          { code: "1200", name: "Accounts Receivable", type: "asset" },
          { code: "2000", name: "Accounts Payable", type: "liability" },
          { code: "3000", name: "Owner Equity", type: "equity" },
          { code: "4100", name: "Room Revenue", type: "revenue" },
          { code: "4200", name: "F&B Revenue", type: "revenue" },
          { code: "4300", name: "Meeting Room Revenue", type: "revenue" },
          { code: "4400", name: "Spa Revenue", type: "revenue" },
          { code: "5100", name: "Rooms Department Expense", type: "expense" },
          { code: "5200", name: "F&B Expense", type: "expense" },
          { code: "5300", name: "A&G Expense", type: "expense" },
          { code: "5400", name: "Sales & Marketing", type: "expense" },
          { code: "5500", name: "Property Operations", type: "expense" },
          { code: "5600", name: "Utilities", type: "expense" },
        ],
        multifamily: [
          { code: "1000", name: "Cash & Equivalents", type: "asset" },
          { code: "1200", name: "Accounts Receivable", type: "asset" },
          { code: "1500", name: "Buildings", type: "asset" },
          { code: "2000", name: "Accounts Payable", type: "liability" },
          { code: "2500", name: "Mortgage Payable", type: "liability" },
          { code: "3000", name: "Owner Equity", type: "equity" },
          { code: "4100", name: "Rental Revenue", type: "revenue" },
          { code: "4200", name: "Parking Revenue", type: "revenue" },
          { code: "4300", name: "Laundry Revenue", type: "revenue" },
          { code: "4400", name: "Late Fee Revenue", type: "revenue" },
          { code: "5100", name: "Property Management", type: "expense" },
          { code: "5200", name: "Maintenance & Repairs", type: "expense" },
          { code: "5300", name: "Utilities", type: "expense" },
          { code: "5400", name: "Insurance", type: "expense" },
          { code: "5500", name: "Property Tax", type: "expense" },
          { code: "5600", name: "Turnover Costs", type: "expense" },
        ],
      };

      const templateAccounts = templates[template];
      if (!templateAccounts) {
        return res.status(400).json({ error: `Unknown template: ${template}` });
      }

      // Insert template accounts as CoA reference entries
      const insertValues = templateAccounts.map((acct) => ({
        orgId,
        marinaId: req.body.marinaId || "default",
        accountName: acct.name,
        accountType: acct.type,
        amount: "0",
        periodStart: new Date().toISOString().slice(0, 10),
        periodEnd: new Date().toISOString().slice(0, 10),
        source: "COA_TEMPLATE",
        notes: `Template import (${template}): ${acct.code}`,
      }));

      await db.insert(opsBookkeepingGl).values(insertValues);

      res.status(201).json({
        imported: templateAccounts.length,
        template,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
