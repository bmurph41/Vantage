/**
 * Portfolio Summary Routes
 *
 * Aggregates modeling project data into org-level portfolio KPIs:
 *   GET /api/portfolio/summary  → deal count, total equity, aggregate NOI, avg DSCR,
 *                                  avg levered IRR, breakdown by asset class, 12-mo NOI trend
 *
 * Mount: app.use("/api/portfolio", authenticateUser, enforceTenant, portfolioSummaryRoutes);
 */

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req: any, res) => {
  try {
    const orgId = req.orgId as string;

    // ── Core project aggregates ─────────────────────────────────────────────
    const projectAgg = await db.execute(sql`
      SELECT
        COUNT(*)::int                                          AS deal_count,
        COUNT(*) FILTER (WHERE mp.deal_outcome = 'active')::int  AS active_count,
        COUNT(*) FILTER (WHERE mp.deal_outcome = 'won')::int     AS closed_count,
        COALESCE(SUM(mp.purchase_price), 0)::numeric           AS total_aum,
        COALESCE(SUM(mp.ebitda), 0)::numeric                   AS aggregate_noi,
        COALESCE(AVG(mp.year_1_cap_rate), 0)::numeric(8,4)     AS avg_cap_rate
      FROM modeling_projects mp
      WHERE mp.org_id = ${orgId}
    `);

    const core = (projectAgg.rows[0] || {}) as any;

    // ── Capital stack aggregates (equity deployed, avg DSCR) ───────────────
    const stackAgg = await db.execute(sql`
      SELECT
        COALESCE(SUM(cs.total_equity), 0)::numeric             AS total_equity,
        COALESCE(SUM(cs.total_debt), 0)::numeric               AS total_debt,
        COALESCE(AVG(cs.ltv), 0)::numeric(8,4)                 AS avg_ltv
      FROM capital_stacks cs
      INNER JOIN modeling_projects mp ON mp.id = cs.modeling_project_id
      WHERE mp.org_id = ${orgId}
        AND cs.is_active = true
    `);

    const stackData = (stackAgg.rows[0] || {}) as any;

    // ── Avg DSCR from modeling financial periods (year 1 projected) ────────
    const dscrAgg = await db.execute(sql`
      SELECT
        COALESCE(AVG(mfp.dscr), 0)::numeric(8,4)               AS avg_dscr
      FROM modeling_financial_periods mfp
      INNER JOIN modeling_projects mp ON mp.id = mfp.modeling_project_id
      WHERE mp.org_id = ${orgId}
        AND mfp.period_type = 'projected'
        AND mfp.sort_order = 1
    `);

    // Fallback: use debt_yield from capital_stacks if no projected year-1 data
    const dscrAggFallback = await db.execute(sql`
      SELECT
        COALESCE(AVG(cs.debt_yield), 0)::numeric(8,4)           AS avg_dscr
      FROM capital_stacks cs
      INNER JOIN modeling_projects mp ON mp.id = cs.modeling_project_id
      WHERE mp.org_id = ${orgId}
        AND cs.is_active = true
    `);

    const avgDscr = Number((dscrAgg.rows[0] as any)?.avg_dscr || 0) ||
      Number((dscrAggFallback.rows[0] as any)?.avg_dscr || 0);

    // ── Avg levered IRR from valuation snapshots ─────────────────────────
    const irrAgg = await db.execute(sql`
      SELECT COALESCE(AVG(vs.irr), 0)::numeric(8,4) AS avg_irr
      FROM valuation_snapshots vs
      INNER JOIN modeling_projects mp ON mp.id = vs.modeling_project_id
      WHERE mp.org_id = ${orgId}
        AND vs.irr IS NOT NULL
    `);

    const avgLeveredIrr = Number((irrAgg.rows[0] as any)?.avg_irr || 0);

    // ── Deal count by asset class ─────────────────────────────────────────
    const byAssetClass = await db.execute(sql`
      SELECT
        COALESCE(mp.asset_class, 'marina')                      AS asset_class,
        COUNT(*)::int                                           AS count,
        COALESCE(SUM(mp.purchase_price), 0)::numeric            AS total_value,
        COALESCE(SUM(mp.ebitda), 0)::numeric                    AS total_noi
      FROM modeling_projects mp
      WHERE mp.org_id = ${orgId}
      GROUP BY mp.asset_class
      ORDER BY count DESC
    `);

    // ── Portfolio NOI trend — trailing 12 months ──────────────────────────
    const noiTrend = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', mp.created_at), 'YYYY-MM')  AS month,
        COUNT(*)::int                                            AS deal_count,
        COALESCE(SUM(mp.ebitda), 0)::numeric                    AS total_noi,
        COALESCE(SUM(mp.purchase_price), 0)::numeric            AS total_aum
      FROM modeling_projects mp
      WHERE mp.org_id = ${orgId}
        AND mp.created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', mp.created_at)
      ORDER BY month ASC
    `);

    // ── Fill in empty months for trailing 12 ─────────────────────────────
    const trendMap = new Map<string, any>();
    for (const row of noiTrend.rows as any[]) {
      trendMap.set(row.month, row);
    }

    const fullTrend: any[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      fullTrend.push(trendMap.get(key) || {
        month: key,
        deal_count: 0,
        total_noi: "0",
        total_aum: "0",
      });
    }

    res.json({
      dealCount: Number(core.deal_count || 0),
      activeCount: Number(core.active_count || 0),
      closedCount: Number(core.closed_count || 0),
      totalAum: Number(core.total_aum || 0),
      aggregateNoi: Number(core.aggregate_noi || 0),
      avgCapRate: Number(core.avg_cap_rate || 0),
      totalEquity: Number(stackData.total_equity || 0),
      totalDebt: Number(stackData.total_debt || 0),
      avgLtv: Number(stackData.avg_ltv || 0),
      avgDscr: Number(avgDscr || 0),
      avgLeveredIrr: Number(avgLeveredIrr || 0),
      byAssetClass: (byAssetClass.rows as any[]).map((r: any) => ({
        assetClass: r.asset_class,
        count: Number(r.count),
        totalValue: Number(r.total_value),
        totalNoi: Number(r.total_noi),
      })),
      noiTrend: fullTrend.map((r: any) => ({
        month: r.month,
        dealCount: Number(r.deal_count),
        totalNoi: Number(r.total_noi),
        totalAum: Number(r.total_aum),
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Portfolio summary error:", error);
    res.json({
      dealCount: 0,
      activeCount: 0,
      closedCount: 0,
      totalAum: 0,
      aggregateNoi: 0,
      avgCapRate: 0,
      totalEquity: 0,
      totalDebt: 0,
      avgLtv: 0,
      avgDscr: 0,
      avgLeveredIrr: 0,
      byAssetClass: [],
      noiTrend: [],
      generatedAt: new Date().toISOString(),
      _fallback: true,
    });
  }
});

export default router;
