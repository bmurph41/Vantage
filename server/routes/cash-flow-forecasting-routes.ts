/**
 * E.5 — Cash Flow Forecasting Engine
 *
 * Rolling 24-month portfolio cash flow projections.
 * Aggregates NOI, debt service, capex, distributions, capital calls
 * across all deals to produce a treasury management view.
 * Detects liquidity risks and suggests corrective actions.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  cashFlowForecasts,
  liquidityAlerts,
  crmDeals,
  loans,
  capexProjects,
  distributions,
  capitalCalls,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, count } from "drizzle-orm";
import {
  loadLeaseIncomeForProject,
  findActiveRentStep,
  convertRentStepToAnnual,
  type LeaseIncomeResult,
} from "../services/dcf-calculator-service";
import { pool } from "../db";

export const cashFlowForecastingRouter = Router();

// ── Generate Forecast ────────────────────────────────────────────────────

// ── Lease income cache (per forecast generation run) ─────────────────────
// Avoids re-querying the DB for each of the 24 months in the loop.
// Returns the full LeaseIncomeResult per deal for escalation-aware forecasting.
async function buildLeaseIncomeCache(
  deals: any[],
  pool: any
): Promise<Map<string, LeaseIncomeResult>> {
  const cache = new Map<string, LeaseIncomeResult>();
  for (const deal of deals) {
    if (!deal.modelingProjectId) continue;
    try {
      const leaseData = await loadLeaseIncomeForProject(pool, deal.modelingProjectId);
      if (leaseData.hasLeases && leaseData.totalEGIAnnual > 0) {
        cache.set(deal.id, leaseData);
      }
    } catch {
      // ignore per-deal errors — fall back to cap rate estimate
    }
  }
  return cache;
}

/**
 * Compute monthly EGI from a lease breakdown applying per-lease escalation schedules.
 * monthsOut is the number of months from forecast start (0 = current month).
 */
function computeLeaseEGIForMonth(
  leaseBreakdown: LeaseIncomeResult['leaseBreakdown'],
  monthsOut: number,
  forecastDate?: Date
): number {
  let total = 0;
  const monthDate = forecastDate ?? new Date();

  for (const lease of leaseBreakdown) {
    const yearsElapsed = monthsOut / 12;
    const recoveryGrowthFactor = Math.pow(1.025, yearsElapsed);

    let monthlyBaseRent: number;

    if (
      lease.escalationType === 'SCHEDULE' &&
      lease.scheduleJson &&
      lease.scheduleJson.length > 0
    ) {
      const activeStep = findActiveRentStep(lease.scheduleJson, monthDate);
      monthlyBaseRent = activeStep
        ? convertRentStepToAnnual(activeStep, lease.sf) / 12
        : lease.baseRentAnnual / 12;
    } else {
      const rentGrowthFactor = Math.pow(1 + lease.escalationRate, yearsElapsed);
      monthlyBaseRent = (lease.baseRentAnnual * rentGrowthFactor) / 12;
    }

    total += monthlyBaseRent + lease.recoveryAnnual * recoveryGrowthFactor / 12;
  }
  return total;
}

// POST /generate — generate 24-month cash flow forecast
cashFlowForecastingRouter.post("/generate", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const {
      horizonMonths = 24,
      noiGrowthRate = 0.03,
      expenseGrowthRate = 0.025,
    } = req.body;

    // Get all active deals
    const deals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)));

    // Preload lease income for deals with linked modeling projects
    const leaseIncomeByDeal = await buildLeaseIncomeCache(deals, pool);

    const now = new Date();
    const asOf = now.toISOString().split("T")[0];
    const forecasts: any[] = [];
    let cumulativeCash = 0;
    const alerts: any[] = [];

    for (let m = 0; m < horizonMonths; m++) {
      const forecastDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const period = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, "0")}`;
      const monthsOut = m;

      // Confidence degrades over time
      const confidenceLevel = monthsOut <= 3 ? "high" : monthsOut <= 12 ? "medium" : "low";

      // Aggregate across all deals
      let totalNOI = 0;
      let totalDebtService = 0;
      let totalCapex = 0;
      let totalDistributions = 0;
      let totalManagementFees = 0;
      let totalOpEx = 0;
      const dealBreakdown: any[] = [];

      for (const deal of deals) {
        const dealValue = parseFloat(deal.value || "0");
        if (dealValue <= 0) continue;

        // Use actual lease income with per-lease escalation schedules if available;
        // otherwise fall back to cap rate estimate with global growth rate.
        const leaseData = leaseIncomeByDeal.get(deal.id);
        let monthlyNOI: number;
        // baseMonthlyIncome = Year-0 income basis used for expense derivation only.
        // Keeping it separate avoids compounding: op-ex should grow from a fixed base,
        // not from an already-escalated NOI, to prevent double-compounding.
        let baseMonthlyIncome: number;
        let incomeSource: "lease_data" | "cap_rate_estimate";

        if (leaseData && leaseData.hasLeases) {
          // Apply per-lease escalation schedules (base rent) and 2.5% recovery growth.
          // Pass the actual forecast calendar date so SCHEDULE steps resolve correctly.
          monthlyNOI = computeLeaseEGIForMonth(leaseData.leaseBreakdown, monthsOut, forecastDate);
          // Base for op-ex = Year-0 lease EGI (no growth applied, anchored to today)
          baseMonthlyIncome = computeLeaseEGIForMonth(leaseData.leaseBreakdown, 0, now);
          incomeSource = "lease_data";
        } else {
          // Estimated monthly NOI (assume 6% cap rate, grow over time)
          const annualNOI = dealValue * 0.06;
          const monthlyGrowthFactor = Math.pow(1 + noiGrowthRate, monthsOut / 12);
          monthlyNOI = (annualNOI / 12) * monthlyGrowthFactor;
          // Base for op-ex = constant Year-0 income (no escalation)
          baseMonthlyIncome = annualNOI / 12;
          incomeSource = "cap_rate_estimate";
        }

        // Estimated monthly debt service (assume 65% LTV, 6.5% rate, 30yr amort)
        const loanAmount = dealValue * 0.65;
        const monthlyRate = 0.065 / 12;
        const monthlyDebtService =
          loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, 360)) /
          (Math.pow(1 + monthlyRate, 360) - 1);

        // Capex reserve (1% of value annually)
        const monthlyCapex = (dealValue * 0.01) / 12;

        // Management fees (1.5% of AUM annually)
        const monthlyMgmtFee = (dealValue * 0.015) / 12;

        // Operating expenses grow from a fixed base (avoids double-compounding with
        // per-lease escalation already applied to monthlyNOI for lease-based deals)
        const monthlyOpEx = (baseMonthlyIncome * 0.42) * Math.pow(1 + expenseGrowthRate, monthsOut / 12);

        const dealNet = monthlyNOI - monthlyDebtService - monthlyCapex - monthlyMgmtFee;

        totalNOI += monthlyNOI;
        totalDebtService += monthlyDebtService;
        totalCapex += monthlyCapex;
        totalManagementFees += monthlyMgmtFee;
        totalOpEx += monthlyOpEx;

        dealBreakdown.push({
          dealId: deal.id,
          dealTitle: deal.title,
          noi: Math.round(monthlyNOI),
          debtService: Math.round(monthlyDebtService),
          capex: Math.round(monthlyCapex),
          managementFee: Math.round(monthlyMgmtFee),
          net: Math.round(dealNet),
          incomeSource,
        });
      }

      // Quarterly distributions (Q1=Mar, Q2=Jun, Q3=Sep, Q4=Dec)
      const isDistributionMonth = [3, 6, 9, 12].includes(forecastDate.getMonth() + 1);
      if (isDistributionMonth) {
        // Distribute 70% of trailing 3-month net cash to LPs
        totalDistributions = Math.max(0, totalNOI - totalDebtService - totalCapex - totalManagementFees) * 3 * 0.7;
      }

      const netCashFlow = totalNOI - totalDebtService - totalCapex - totalDistributions - totalManagementFees;
      cumulativeCash += netCashFlow;

      // Detect liquidity risks
      if (cumulativeCash < 0) {
        alerts.push({
          period,
          alertType: "cash_shortfall",
          severity: "critical",
          message: `Projected cash shortfall in ${period} — $${Math.abs(Math.round(cumulativeCash)).toLocaleString()}`,
          shortfallAmount: Math.round(Math.abs(cumulativeCash)),
          suggestedActions: [
            "Accelerate capital call",
            "Defer quarterly distribution",
            "Draw from operating reserve",
            "Arrange bridge line of credit",
          ],
        });
      } else if (netCashFlow < 0) {
        alerts.push({
          period,
          alertType: "low_reserve",
          severity: "warning",
          message: `Negative net cash flow in ${period} — $${Math.abs(Math.round(netCashFlow)).toLocaleString()} deficit`,
          shortfallAmount: Math.round(Math.abs(netCashFlow)),
          suggestedActions: [
            "Review capex timing",
            "Accelerate rent collections",
          ],
        });
      }

      const forecastRow = {
        orgId,
        period,
        asOf,
        projectedNOI: String(Math.round(totalNOI)),
        projectedDebtService: String(Math.round(totalDebtService)),
        projectedCapex: String(Math.round(totalCapex)),
        projectedDistributions: String(Math.round(totalDistributions)),
        projectedManagementFees: String(Math.round(totalManagementFees)),
        projectedOperatingExpenses: String(Math.round(totalOpEx)),
        netCashFlow: String(Math.round(netCashFlow)),
        cumulativeCashFlow: String(Math.round(cumulativeCash)),
        dealBreakdown,
        confidenceLevel,
      };

      forecasts.push(forecastRow);
    }

    // Store forecasts (delete old ones for this org first)
    await db.delete(cashFlowForecasts).where(eq(cashFlowForecasts.orgId, orgId));
    if (forecasts.length > 0) {
      await db.insert(cashFlowForecasts).values(forecasts);
    }

    // Store liquidity alerts
    await db.delete(liquidityAlerts).where(eq(liquidityAlerts.orgId, orgId));
    if (alerts.length > 0) {
      await db.insert(liquidityAlerts).values(
        alerts.map((a) => ({
          orgId,
          period: a.period,
          alertType: a.alertType,
          severity: a.severity,
          message: a.message,
          shortfallAmount: String(a.shortfallAmount),
          suggestedActions: a.suggestedActions,
        })),
      );
    }

    // Summary stats
    const tightMonths = forecasts.filter((f) => parseFloat(f.netCashFlow) < 0);
    const totalInflows = forecasts.reduce(
      (sum, f) => sum + parseFloat(f.projectedNOI),
      0,
    );
    const totalOutflows = forecasts.reduce(
      (sum, f) =>
        sum +
        parseFloat(f.projectedDebtService) +
        parseFloat(f.projectedCapex) +
        parseFloat(f.projectedDistributions) +
        parseFloat(f.projectedManagementFees),
      0,
    );

    res.json({
      horizonMonths,
      dealsAnalyzed: deals.length,
      forecasts,
      alerts,
      summary: {
        totalProjectedInflows: Math.round(totalInflows),
        totalProjectedOutflows: Math.round(totalOutflows),
        netOverHorizon: Math.round(totalInflows - totalOutflows),
        tightMonths: tightMonths.length,
        liquidityAlerts: alerts.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Read Forecasts ───────────────────────────────────────────────────────

// GET / — get latest forecast
cashFlowForecastingRouter.get("/", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const forecasts = await db
      .select()
      .from(cashFlowForecasts)
      .where(eq(cashFlowForecasts.orgId, orgId))
      .orderBy(cashFlowForecasts.period);

    res.json(forecasts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /summary — high-level forecast summary
cashFlowForecastingRouter.get("/summary", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const [totals] = await db
      .select({
        totalNOI: sql<string>`coalesce(sum(${cashFlowForecasts.projectedNOI}::numeric), 0)`,
        totalDebtService: sql<string>`coalesce(sum(${cashFlowForecasts.projectedDebtService}::numeric), 0)`,
        totalCapex: sql<string>`coalesce(sum(${cashFlowForecasts.projectedCapex}::numeric), 0)`,
        totalDistributions: sql<string>`coalesce(sum(${cashFlowForecasts.projectedDistributions}::numeric), 0)`,
        totalNet: sql<string>`coalesce(sum(${cashFlowForecasts.netCashFlow}::numeric), 0)`,
        periods: count(),
        tightMonths: sql<number>`count(*) filter (where ${cashFlowForecasts.netCashFlow}::numeric < 0)`,
      })
      .from(cashFlowForecasts)
      .where(eq(cashFlowForecasts.orgId, orgId));

    const alertsList = await db
      .select()
      .from(liquidityAlerts)
      .where(and(eq(liquidityAlerts.orgId, orgId), eq(liquidityAlerts.acknowledged, false)))
      .orderBy(liquidityAlerts.period);

    res.json({
      totals: totals || {},
      activeAlerts: alertsList,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Alerts ───────────────────────────────────────────────────────────────

// GET /alerts — get liquidity alerts
cashFlowForecastingRouter.get("/alerts", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { acknowledged } = req.query;

    const conditions = [eq(liquidityAlerts.orgId, orgId)];
    if (acknowledged === "false") conditions.push(eq(liquidityAlerts.acknowledged, false));
    if (acknowledged === "true") conditions.push(eq(liquidityAlerts.acknowledged, true));

    const alerts = await db
      .select()
      .from(liquidityAlerts)
      .where(and(...conditions))
      .orderBy(liquidityAlerts.period);

    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /alerts/:id/acknowledge — acknowledge an alert
cashFlowForecastingRouter.patch("/alerts/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;

    const [updated] = await db
      .update(liquidityAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      })
      .where(and(eq(liquidityAlerts.id, req.params.id), eq(liquidityAlerts.orgId, orgId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Alert not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /deal/:dealId — get forecast contribution for a specific deal
cashFlowForecastingRouter.get("/deal/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId } = req.params;

    const forecasts = await db
      .select()
      .from(cashFlowForecasts)
      .where(eq(cashFlowForecasts.orgId, orgId))
      .orderBy(cashFlowForecasts.period);

    // Extract this deal's contribution from each period's breakdown
    const dealForecasts = forecasts.map((f) => {
      const breakdown = (f.dealBreakdown as any[]) || [];
      const dealEntry = breakdown.find((d: any) => d.dealId === dealId);
      return {
        period: f.period,
        confidenceLevel: f.confidenceLevel,
        ...(dealEntry || { noi: 0, debtService: 0, capex: 0, managementFee: 0, net: 0 }),
      };
    });

    res.json({ dealId, forecasts: dealForecasts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
