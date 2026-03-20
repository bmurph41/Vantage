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

export default router;
