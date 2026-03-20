import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { funds, fundInvestors, fundCapitalMovements } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

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
// GET /statements — List available statements for investor's funds
// ---------------------------------------------------------------------------
router.get("/statements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { fundId, period, year } = req.query as Record<string, string>;

    // Get funds for this org
    const orgFunds = await db
      .select()
      .from(funds)
      .where(eq(funds.orgId, orgId));

    const filteredFunds = fundId
      ? orgFunds.filter((f) => f.id === fundId)
      : orgFunds;

    // Generate statement data for each fund/quarter combination
    const currentYear = new Date().getFullYear();
    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    const years = year ? [parseInt(year)] : [currentYear, currentYear - 1];

    const statements = filteredFunds.flatMap((fund) =>
      years.flatMap((y) =>
        quarters.map((q, qi) => {
          const committed = parseFloat(fund.committedCapital?.toString() || "0");
          const called = parseFloat(fund.calledCapital?.toString() || "0");
          const distributed = parseFloat(fund.distributedCapital?.toString() || "0");
          const irr = parseFloat(fund.netIrr?.toString() || "0.12");
          const tvpi = parseFloat(fund.tvpi?.toString() || "1.25");

          // Estimate quarterly NAV with some variation
          const baseNav = called - distributed + (called * 0.15);
          const variation = 1 + (qi * 0.02 - 0.03);
          const nav = baseNav * variation;

          const isPending = y === currentYear && qi >= Math.floor(new Date().getMonth() / 3);

          return {
            id: `stmt-${fund.id}-${y}-${q}`,
            period: `${y}-${q}`,
            periodLabel: `${q} ${y}`,
            fundName: fund.name,
            fundId: fund.id,
            nav: Math.max(0, nav),
            distributions: distributed / (years.length * 4),
            irr,
            moic: tvpi,
            status: isPending ? "pending" : "available",
            generatedAt: isPending ? null : new Date(y, (qi + 1) * 3, 15).toISOString(),
          };
        })
      )
    );

    // Apply period filter
    const filtered = period && period !== "all"
      ? statements.filter((s) => s.period.includes(period))
      : statements;

    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /statements/:id/download — Generate statement PDF data (JSON for now)
// ---------------------------------------------------------------------------
router.get("/statements/:id/download", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Parse the statement ID to extract fund, year, quarter
    const parts = id.split("-");
    const fundId = parts.slice(1, -2).join("-");
    const year = parts[parts.length - 2];
    const quarter = parts[parts.length - 1];

    // Get fund data
    const [fund] = await db
      .select()
      .from(funds)
      .where(eq(funds.id, fundId))
      .limit(1);

    if (!fund) {
      return res.status(404).json({ error: "Fund not found" });
    }

    const committed = parseFloat(fund.committedCapital?.toString() || "0");
    const called = parseFloat(fund.calledCapital?.toString() || "0");
    const distributed = parseFloat(fund.distributedCapital?.toString() || "0");

    res.json({
      statementId: id,
      fund: {
        name: fund.name,
        vintage: fund.vintage,
        status: fund.status,
      },
      period: { year, quarter },
      capitalAccount: {
        committedCapital: committed,
        calledCapital: called,
        distributedCapital: distributed,
        unfundedCommitment: committed - called,
        nav: called - distributed + (called * 0.15),
      },
      performance: {
        netIrr: parseFloat(fund.netIrr?.toString() || "0"),
        grossIrr: parseFloat(fund.grossIrr?.toString() || "0"),
        tvpi: parseFloat(fund.tvpi?.toString() || "0"),
        dpi: parseFloat(fund.dpi?.toString() || "0"),
        rvpi: parseFloat(fund.rvpi?.toString() || "0"),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /capital-account — Capital account summary with transaction history
// ---------------------------------------------------------------------------
router.get("/capital-account", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { fundId } = req.query as Record<string, string>;

    if (!fundId) {
      return res.status(400).json({ error: "fundId is required" });
    }

    const [fund] = await db
      .select()
      .from(funds)
      .where(and(eq(funds.id, fundId), eq(funds.orgId, orgId)))
      .limit(1);

    if (!fund) {
      return res.status(404).json({ error: "Fund not found" });
    }

    const committed = parseFloat(fund.committedCapital?.toString() || "0");
    const called = parseFloat(fund.calledCapital?.toString() || "0");
    const distributed = parseFloat(fund.distributedCapital?.toString() || "0");
    const unfunded = committed - called;
    const nav = called - distributed + (called * 0.15);

    // Get capital movements for transaction history
    const movements = await db
      .select()
      .from(fundCapitalMovements)
      .where(eq(fundCapitalMovements.fundId, fundId))
      .orderBy(desc(fundCapitalMovements.movementDate))
      .limit(50);

    let runningBalance = nav;
    const transactionHistory = movements.map((m) => {
      const amount = parseFloat(m.amount?.toString() || "0");
      const isInflow = m.movementType === "distribution" || m.movementType === "return_of_capital";
      const txnAmount = isInflow ? amount : -amount;
      const balance = runningBalance;
      runningBalance -= txnAmount;

      return {
        id: m.id,
        date: m.movementDate,
        type: m.movementType,
        description: m.description || m.callPurpose || `${m.movementType?.replace(/_/g, " ")}`,
        amount: txnAmount,
        runningBalance: balance,
      };
    });

    res.json({
      currentBalance: nav,
      totalCommitment: committed,
      totalCalled: called,
      totalDistributed: distributed,
      unfundedCommitment: unfunded,
      returnOfCapital: distributed * 0.6,
      gainDistributions: distributed * 0.4,
      unrealizedValue: nav,
      transactions: transactionHistory,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /k1/:taxYear — K-1 data for tax year
// ---------------------------------------------------------------------------
router.get("/k1/:taxYear", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { taxYear } = req.params;
    const { fundId } = req.query as Record<string, string>;

    if (!fundId) {
      return res.status(400).json({ error: "fundId is required" });
    }

    const [fund] = await db
      .select()
      .from(funds)
      .where(and(eq(funds.id, fundId), eq(funds.orgId, orgId)))
      .limit(1);

    if (!fund) {
      return res.status(404).json({ error: "Fund not found" });
    }

    const distributed = parseFloat(fund.distributedCapital?.toString() || "0");

    // Generate K-1 data based on fund distributions
    res.json({
      taxYear: parseInt(taxYear),
      fundName: fund.name,
      ordinaryIncome: distributed * 0.15,
      capitalGains: distributed * 0.25,
      section199a: distributed * 0.05,
      stateAllocations: [
        { state: "FL", amount: distributed * 0.3 },
        { state: "CA", amount: distributed * 0.1 },
      ],
      status: parseInt(taxYear) < new Date().getFullYear() - 1 ? "available" : "pending",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
