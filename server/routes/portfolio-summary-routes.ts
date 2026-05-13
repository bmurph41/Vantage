/**
 * Portfolio Summary Routes
 *
 * Aggregates modeling project data into org-level portfolio KPIs:
 *   GET /api/portfolio/summary              → deal count, total equity, NOI, IRR, asset class breakdown
 *   GET /api/portfolio/debt-maturity-wall   → debt tranches grouped by maturity year
 *   GET /api/portfolio/concentration-risk   → HHI scores by class/geo/vintage
 *   GET /api/portfolio/scorecard            → 5 portfolio health scores (0–100)
 *   GET /api/portfolio/assets/:id/detail    → full single-asset detail for drawer
 *
 * Mount: app.use("/api/portfolio", authenticateUser, enforceTenant, portfolioSummaryRoutes);
 */

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// ─── Stage filter helpers ─────────────────────────────────────────────────────

const STAGE_SQL: Record<string, string> = {
  all: '',
  pipeline: `AND mp.deal_outcome = 'active'`,
  under_loi: `AND mp.deal_outcome = 'active' AND mp.uw_stage = 'initial_screening'`,
  under_contract: `AND mp.deal_outcome = 'active' AND mp.uw_stage IN ('data_collection','building_model','sensitivity_analysis','ic_review','approved')`,
  owned: `AND mp.deal_outcome = 'won'`,
  passed: `AND mp.deal_outcome IN ('lost','passed')`,
};

// ─── GET /summary ────────────────────────────────────────────────────────────
router.get("/summary", async (req: any, res) => {
  try {
    const orgId = (req.user?.orgId || req.tenantId) as string;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const rawStage = (req.query.stage as string) || 'all';
    const stage = Object.prototype.hasOwnProperty.call(STAGE_SQL, rawStage) ? rawStage : 'all';
    const sc = STAGE_SQL[stage];

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
      ${sql.raw(sc)}
    `);

    const core = (projectAgg.rows[0] || {}) as any;

    const stackAgg = await db.execute(sql`
      SELECT
        COALESCE(SUM(cs.total_equity), 0)::numeric             AS total_equity,
        COALESCE(SUM(cs.total_debt), 0)::numeric               AS total_debt,
        COALESCE(AVG(cs.ltv), 0)::numeric(8,4)                 AS avg_ltv
      FROM capital_stacks cs
      INNER JOIN modeling_projects mp ON mp.id = cs.modeling_project_id
      WHERE mp.org_id = ${orgId}
        AND cs.is_active = true
      ${sql.raw(sc)}
    `);

    const stackData = (stackAgg.rows[0] || {}) as any;

    const dscrAgg = await db.execute(sql`
      SELECT COALESCE(AVG(cs.debt_yield), 0)::numeric(8,4) AS avg_dscr
      FROM capital_stacks cs
      INNER JOIN modeling_projects mp ON mp.id = cs.modeling_project_id
      WHERE mp.org_id = ${orgId} AND cs.is_active = true
      ${sql.raw(sc)}
    `);

    const avgDscr = Number((dscrAgg.rows[0] as any)?.avg_dscr || 0);

    const irrAgg = await db.execute(sql`
      SELECT COALESCE(AVG(vs.irr), 0)::numeric(8,4) AS avg_irr
      FROM valuation_snapshots vs
      INNER JOIN modeling_projects mp ON mp.id = vs.modeling_project_id
      WHERE mp.org_id = ${orgId} AND vs.irr IS NOT NULL
      ${sql.raw(sc)}
    `);

    const avgLeveredIrr = Number((irrAgg.rows[0] as any)?.avg_irr || 0);

    const byAssetClass = await db.execute(sql`
      SELECT
        COALESCE(mp.asset_class, 'marina')  AS asset_class,
        COUNT(*)::int                       AS count,
        COALESCE(SUM(mp.purchase_price), 0)::numeric AS total_value,
        COALESCE(SUM(mp.ebitda), 0)::numeric         AS total_noi
      FROM modeling_projects mp
      WHERE mp.org_id = ${orgId}
      ${sql.raw(sc)}
      GROUP BY mp.asset_class
      ORDER BY count DESC
    `);

    const noiTrend = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', mp.created_at), 'YYYY-MM') AS month,
        COUNT(*)::int                                           AS deal_count,
        COALESCE(SUM(mp.ebitda), 0)::numeric                   AS total_noi,
        COALESCE(SUM(mp.purchase_price), 0)::numeric           AS total_aum
      FROM modeling_projects mp
      WHERE mp.org_id = ${orgId}
        AND mp.created_at >= NOW() - INTERVAL '12 months'
      ${sql.raw(sc)}
      GROUP BY DATE_TRUNC('month', mp.created_at)
      ORDER BY month ASC
    `);

    const trendMap = new Map<string, any>();
    for (const row of noiTrend.rows as any[]) trendMap.set(row.month, row);

    const fullTrend: any[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      fullTrend.push(trendMap.get(key) || { month: key, deal_count: 0, total_noi: "0", total_aum: "0" });
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
      dealCount: 0, activeCount: 0, closedCount: 0, totalAum: 0,
      aggregateNoi: 0, avgCapRate: 0, totalEquity: 0, totalDebt: 0,
      avgLtv: 0, avgDscr: 0, avgLeveredIrr: 0, byAssetClass: [], noiTrend: [],
      generatedAt: new Date().toISOString(), _fallback: true,
    });
  }
});

// ─── GET /debt-maturity-wall ──────────────────────────────────────────────────
router.get("/debt-maturity-wall", async (req: any, res) => {
  try {
    const orgId = (req.user?.orgId || req.tenantId) as string;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const tranches = await db.execute(sql`
      SELECT
        dt.id,
        dt.name                                                             AS tranche_name,
        dt.principal,
        dt.interest_rate,
        dt.term_years,
        dt.lender_name,
        dt.tranche_type,
        dt.index_rate,
        dt.amortization_years,
        dt.interest_only_months,
        mp.id                                                               AS project_id,
        mp.marina_name,
        mp.asset_class,
        mp.state,
        cs.id                                                               AS stack_id,
        cs.created_at                                                       AS stack_created,
        EXTRACT(YEAR FROM cs.created_at + (dt.term_years || ' years')::interval)::int AS maturity_year,
        -- Annual debt service estimate: P&I based on amort schedule or IO
        CASE
          WHEN dt.amortization_years IS NOT NULL AND dt.amortization_years > 0
            THEN (dt.principal * (dt.interest_rate / 12) /
                  (1 - POWER(1 + dt.interest_rate / 12, -dt.amortization_years * 12))) * 12
          ELSE dt.principal * dt.interest_rate
        END                                                                 AS annual_debt_service
      FROM debt_tranches dt
      JOIN capital_stacks cs ON cs.id = dt.capital_stack_id
      JOIN modeling_projects mp ON mp.id = cs.modeling_project_id
      WHERE mp.org_id = ${orgId}
        AND cs.is_active = true
      ORDER BY maturity_year ASC
    `);

    const byYear: Record<number, { totalBalance: number; annualService: number; tranches: any[] }> = {};

    for (const t of tranches.rows as any[]) {
      const year = Number(t.maturity_year) || new Date().getFullYear() + 5;
      if (!byYear[year]) byYear[year] = { totalBalance: 0, annualService: 0, tranches: [] };
      const balance = Number(t.principal || 0);
      byYear[year].totalBalance += balance;
      byYear[year].annualService += Number(t.annual_debt_service || 0);
      byYear[year].tranches.push({
        projectId: t.project_id,
        assetName: t.marina_name,
        assetClass: t.asset_class,
        state: t.state,
        trancheName: t.tranche_name,
        lender: t.lender_name || "Unknown",
        balance,
        interestRate: Number(t.interest_rate || 0),
        rateType: t.index_rate ? "floating" : "fixed",
        termYears: Number(t.term_years || 0),
        maturityYear: year,
        annualService: Number(t.annual_debt_service || 0),
      });
    }

    const maturityWall = Object.entries(byYear)
      .map(([year, data]) => ({ year: Number(year), ...data }))
      .sort((a, b) => a.year - b.year);

    const totalDebt = maturityWall.reduce((s, y) => s + y.totalBalance, 0);
    const totalAnnualService = maturityWall.reduce((s, y) => s + y.annualService, 0);

    // Also return summary by asset class for the stacked bar
    const assetClasses = [...new Set((tranches.rows as any[]).map((t: any) => t.asset_class || "other"))];
    const byYearByClass: Record<number, Record<string, number>> = {};
    for (const t of tranches.rows as any[]) {
      const year = Number(t.maturity_year) || new Date().getFullYear() + 5;
      const ac = t.asset_class || "other";
      if (!byYearByClass[year]) byYearByClass[year] = {};
      byYearByClass[year][ac] = (byYearByClass[year][ac] || 0) + Number(t.principal || 0);
    }

    const chartData = maturityWall.map((row) => ({
      year: row.year,
      total: row.totalBalance,
      ...((byYearByClass[row.year] || {})),
    }));

    res.json({ maturityWall, totalDebt, totalAnnualService, chartData, assetClasses });
  } catch (error: any) {
    console.error("Debt maturity wall error:", error);
    res.json({ maturityWall: [], totalDebt: 0, totalAnnualService: 0, chartData: [], assetClasses: [] });
  }
});

// ─── GET /concentration-risk ──────────────────────────────────────────────────
router.get("/concentration-risk", async (req: any, res) => {
  try {
    const orgId = (req.user?.orgId || req.tenantId) as string;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const projects = await db.execute(sql`
      SELECT
        COALESCE(mp.asset_class, 'other')  AS asset_class,
        COALESCE(mp.state, 'Unknown')      AS state,
        COALESCE(mp.region, 'Unknown')     AS region,
        EXTRACT(YEAR FROM mp.created_at)::int AS vintage_year,
        COALESCE(mp.purchase_price, 0)::numeric AS value
      FROM modeling_projects mp
      WHERE mp.org_id = ${orgId}
    `);

    const rows = projects.rows as any[];
    const totalValue = rows.reduce((s, r) => s + Number(r.value), 0);

    if (totalValue === 0) {
      return res.json({
        byAssetClass: [], byGeography: [], byVintage: [],
        hhiAssetClass: 0, hhiGeography: 0, hhiVintage: 0,
      });
    }

    // Group by asset class
    const acMap: Record<string, number> = {};
    const stateMap: Record<string, number> = {};
    const vintageMap: Record<number, number> = {};

    for (const r of rows) {
      const v = Number(r.value);
      acMap[r.asset_class] = (acMap[r.asset_class] || 0) + v;
      stateMap[r.state] = (stateMap[r.state] || 0) + v;
      vintageMap[Number(r.vintage_year)] = (vintageMap[Number(r.vintage_year)] || 0) + v;
    }

    const toSlices = (map: Record<string | number, number>) =>
      Object.entries(map)
        .map(([name, value]) => ({ name, value, pct: value / totalValue }))
        .sort((a, b) => b.value - a.value);

    const hhi = (slices: { pct: number }[]) =>
      Math.round(slices.reduce((s, sl) => s + Math.pow(sl.pct * 100, 2), 0));

    const acSlices = toSlices(acMap);
    const geoSlices = toSlices(stateMap);
    const vintageSlices = toSlices(vintageMap);

    res.json({
      byAssetClass: acSlices,
      byGeography: geoSlices.slice(0, 8),
      byVintage: vintageSlices,
      hhiAssetClass: hhi(acSlices),
      hhiGeography: hhi(geoSlices),
      hhiVintage: hhi(vintageSlices),
      totalValue,
    });
  } catch (error: any) {
    console.error("Concentration risk error:", error);
    res.json({ byAssetClass: [], byGeography: [], byVintage: [], hhiAssetClass: 0, hhiGeography: 0, hhiVintage: 0 });
  }
});

// ─── GET /scorecard ───────────────────────────────────────────────────────────
router.get("/scorecard", async (req: any, res) => {
  try {
    const orgId = (req.user?.orgId || req.tenantId) as string;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    const BENCHMARKS: Record<string, { capRate: number; irr: number }> = {
      marina: { capRate: 0.065, irr: 0.142 },
      multifamily: { capRate: 0.055, irr: 0.121 },
      self_storage: { capRate: 0.060, irr: 0.135 },
      str: { capRate: 0.072, irr: 0.158 },
      retail: { capRate: 0.068, irr: 0.118 },
      office: { capRate: 0.073, irr: 0.109 },
      hotel: { capRate: 0.085, irr: 0.164 },
    };

    // Fetch key metrics
    const [projectsRes, stackRes, irrRes] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) AS total,
          COALESCE(AVG(mp.year_1_cap_rate), 0)::float AS avg_cap_rate,
          COALESCE(SUM(mp.purchase_price), 0)::float AS total_aum,
          COALESCE(SUM(mp.ebitda), 0)::float AS total_noi,
          COALESCE(AVG(CASE WHEN mp.asset_class IS NOT NULL THEN 1 ELSE 0 END), 0) AS has_class
        FROM modeling_projects mp WHERE mp.org_id = ${orgId}
      `),
      db.execute(sql`
        SELECT
          COALESCE(AVG(cs.ltv), 0)::float AS avg_ltv,
          COALESCE(AVG(cs.debt_yield), 0)::float AS avg_dscr,
          COUNT(*) AS loan_count,
          COUNT(*) FILTER (
            WHERE cs.created_at + (5 || ' years')::interval < NOW() + INTERVAL '18 months'
          )::int AS maturing_soon
        FROM capital_stacks cs
        JOIN modeling_projects mp ON mp.id = cs.modeling_project_id
        WHERE mp.org_id = ${orgId} AND cs.is_active = true
      `),
      db.execute(sql`
        SELECT COALESCE(AVG(vs.irr), 0)::float AS avg_irr
        FROM valuation_snapshots vs
        JOIN modeling_projects mp ON mp.id = vs.modeling_project_id
        WHERE mp.org_id = ${orgId} AND vs.irr IS NOT NULL
      `),
    ]);

    const p = (projectsRes.rows[0] || {}) as any;
    const s = (stackRes.rows[0] || {}) as any;
    const avgIrr = Number((irrRes.rows[0] as any)?.avg_irr || 0);

    const totalProjects = Number(p.total || 0);
    const avgCapRate = Number(p.avg_cap_rate || 0);
    const avgLtv = Number(s.avg_ltv || 0);
    const avgDscr = Number(s.avg_dscr || 0);
    const loanCount = Number(s.loan_count || 0);
    const maturingSoon = Number(s.maturing_soon || 0);

    // Benchmark IRR (average across benchmarks)
    const benchmarkIrr = Object.values(BENCHMARKS).reduce((s, b) => s + b.irr, 0) / Object.values(BENCHMARKS).length;
    const benchmarkCapRate = Object.values(BENCHMARKS).reduce((s, b) => s + b.capRate, 0) / Object.values(BENCHMARKS).length;

    // 1. Income Quality (0–100): cap rate vs benchmark, portfolio coverage
    const capRateScore = avgCapRate > 0
      ? Math.min(100, Math.round((avgCapRate / benchmarkCapRate) * 60))
      : 30;
    const incomeQuality = Math.min(100, capRateScore + (totalProjects > 0 ? 25 : 0));

    // 2. Return Performance (0–100)
    const irrScore = avgIrr > 0
      ? Math.min(100, Math.round((avgIrr / benchmarkIrr) * 70))
      : 30;
    const returnPerformance = Math.min(100, irrScore + (avgCapRate > benchmarkCapRate ? 20 : 0));

    // 3. Leverage Safety (0–100): DSCR > 1.25 is good, LTV < 65% is good
    const dscrScore = avgDscr > 0 ? Math.min(50, Math.round((avgDscr / 1.25) * 40)) : 25;
    const ltvScore = avgLtv > 0 ? Math.max(0, Math.round((1 - avgLtv / 0.80) * 35)) : 20;
    const maturityScore = loanCount > 0 ? Math.max(0, Math.round(((loanCount - maturingSoon) / loanCount) * 15)) : 10;
    const leverageSafety = Math.min(100, dscrScore + ltvScore + maturityScore);

    // 4. Diversification (0–100): based on project count and asset class spread
    const diversificationScore = Math.min(100, totalProjects * 10 + (totalProjects > 3 ? 30 : 0));

    // 5. Growth Trajectory (0–100): rough estimate based on NOI relative to AUM
    const totalAum = Number(p.total_aum || 0);
    const totalNoi = Number(p.total_noi || 0);
    const noiYield = totalAum > 0 ? totalNoi / totalAum : 0;
    const growthScore = noiYield > 0
      ? Math.min(100, Math.round((noiYield / benchmarkCapRate) * 70) + 20)
      : 30;

    res.json({
      scores: {
        incomeQuality: Math.max(0, Math.min(100, incomeQuality)),
        returnPerformance: Math.max(0, Math.min(100, returnPerformance)),
        leverageSafety: Math.max(0, Math.min(100, leverageSafety)),
        diversification: Math.max(0, Math.min(100, diversificationScore)),
        growthTrajectory: Math.max(0, Math.min(100, growthScore)),
      },
      inputs: {
        avgCapRate, avgLtv, avgDscr, avgIrr, totalProjects,
        maturingSoon, loanCount, benchmarkIrr, benchmarkCapRate,
      },
    });
  } catch (error: any) {
    console.error("Scorecard error:", error);
    res.json({
      scores: { incomeQuality: 0, returnPerformance: 0, leverageSafety: 0, diversification: 0, growthTrajectory: 0 },
      inputs: {},
    });
  }
});

// ─── GET /assets/:projectId/detail ───────────────────────────────────────────
router.get("/assets/:projectId/detail", async (req: any, res) => {
  try {
    const orgId = (req.user?.orgId || req.tenantId) as string;
    const { projectId } = req.params;
    if (!orgId) return res.status(401).json({ error: "Unauthorized" });

    // Core project data
    const projectRes = await db.execute(sql`
      SELECT
        mp.id, mp.marina_name, mp.purchase_price, mp.year_1_cap_rate,
        mp.ebitda, mp.deal_outcome, mp.asset_class, mp.state, mp.region,
        mp.city, mp.address, mp.notes, mp.created_at, mp.updated_at,
        mp.total_storage_units
      FROM modeling_projects mp
      WHERE mp.id = ${projectId} AND mp.org_id = ${orgId}
      LIMIT 1
    `);

    const project = (projectRes.rows[0] || null) as any;
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Capital stack
    const stackRes = await db.execute(sql`
      SELECT cs.*, dt.id as tranche_id, dt.name as tranche_name, dt.principal,
        dt.interest_rate, dt.term_years, dt.lender_name, dt.tranche_type,
        dt.index_rate, dt.amortization_years, dt.interest_only_months,
        dt.min_dscr, dt.max_ltv
      FROM capital_stacks cs
      LEFT JOIN debt_tranches dt ON dt.capital_stack_id = cs.id
      WHERE cs.modeling_project_id = ${projectId} AND cs.is_active = true
      ORDER BY cs.created_at DESC, dt.tranche_type
    `);

    // T12 Actuals
    const actualsRes = await db.execute(sql`
      SELECT category, line_item, SUM(amount::numeric) AS total
      FROM modeling_actuals
      WHERE modeling_project_id = ${projectId}
        AND year >= EXTRACT(YEAR FROM NOW()) - 1
      GROUP BY category, line_item
      ORDER BY category, total DESC
    `);

    // Valuation snapshots (for IRR, MOIC)
    const valuationRes = await db.execute(sql`
      SELECT vs.*, vs.irr, vs.moic, vs.equity_multiple, vs.cash_on_cash,
        vs.snapshot_date, vs.current_value, vs.estimated_value
      FROM valuation_snapshots vs
      WHERE vs.modeling_project_id = ${projectId}
      ORDER BY vs.snapshot_date DESC
      LIMIT 10
    `);

    // Recent document extractions
    const docsRes = await db.execute(sql`
      SELECT id, original_filename, doc_type, status, created_at, extraction_result
      FROM doc_intel_uploads
      WHERE modeling_project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Scenario versions
    const scenariosRes = await db.execute(sql`
      SELECT scenario_type, status, revenue_growth_rate, exit_cap_rate,
        expense_growth_rate, hold_period, is_current_version
      FROM modeling_scenario_versions
      WHERE modeling_project_id = ${projectId}
        AND is_current_version = true
      ORDER BY scenario_type
    `);

    // Build capital stack summary
    const stackRows = stackRes.rows as any[];
    const stackSummary = stackRows[0] ? {
      id: stackRows[0].id,
      totalDebt: Number(stackRows[0].total_debt || 0),
      totalEquity: Number(stackRows[0].total_equity || 0),
      ltv: Number(stackRows[0].ltv || 0),
      blendedRate: Number(stackRows[0].blended_debt_rate || 0),
      debtYield: Number(stackRows[0].debt_yield || 0),
      holdPeriodYears: Number(stackRows[0].hold_period_years || 5),
      exitCapRate: Number(stackRows[0].exit_cap_rate || 0),
      purchasePrice: Number(stackRows[0].purchase_price || 0),
      totalCapitalization: Number(stackRows[0].total_capitalization || 0),
      tranches: stackRows
        .filter((r) => r.tranche_id)
        .map((r) => ({
          id: r.tranche_id,
          name: r.tranche_name,
          principal: Number(r.principal || 0),
          interestRate: Number(r.interest_rate || 0),
          termYears: Number(r.term_years || 0),
          lenderName: r.lender_name,
          trancheType: r.tranche_type,
          rateType: r.index_rate ? "floating" : "fixed",
          indexRate: r.index_rate,
          amortizationYears: r.amortization_years,
          ioMonths: r.interest_only_months,
        })),
    } : null;

    // T12 P&L summary
    const actualsRows = actualsRes.rows as any[];
    const revenue = actualsRows.filter((r) => r.category === "Revenue").reduce((s, r) => s + Number(r.total), 0);
    const expenses = actualsRows.filter((r) => r.category !== "Revenue").reduce((s, r) => s + Math.abs(Number(r.total)), 0);
    const noi = revenue - expenses;

    const latestValuation = (valuationRes.rows[0] || null) as any;
    const purchasePrice = Number(project.purchase_price || 0);
    const currentValue = Number(latestValuation?.current_value || latestValuation?.estimated_value || purchasePrice);

    res.json({
      project: {
        id: project.id,
        name: project.marina_name,
        assetClass: project.asset_class || "other",
        state: project.state,
        region: project.region,
        city: project.city,
        address: project.address,
        status: project.deal_outcome,
        purchasePrice,
        currentValue,
        unrealizedGain: currentValue - purchasePrice,
        gainPct: purchasePrice > 0 ? (currentValue - purchasePrice) / purchasePrice : 0,
        capRate: Number(project.year_1_cap_rate || 0),
        totalUnits: Number(project.total_storage_units || 0),
        ebitda: Number(project.ebitda || 0),
        createdAt: project.created_at,
      },
      t12: {
        revenue,
        expenses,
        noi,
        ebitdaMargin: revenue > 0 ? noi / revenue : 0,
        lineItems: actualsRows.map((r) => ({
          category: r.category,
          label: r.line_item,
          amount: Number(r.total),
          pctOfRevenue: revenue > 0 ? Number(r.total) / revenue : 0,
        })),
      },
      capitalStack: stackSummary,
      returns: {
        irr: Number(latestValuation?.irr || 0),
        moic: Number(latestValuation?.moic || 0),
        equityMultiple: Number(latestValuation?.equity_multiple || 0),
        cashOnCash: Number(latestValuation?.cash_on_cash || 0),
        snapshots: (valuationRes.rows as any[]).map((r) => ({
          date: r.snapshot_date,
          value: Number(r.current_value || r.estimated_value || 0),
          irr: Number(r.irr || 0),
          moic: Number(r.moic || 0),
        })),
      },
      documents: (docsRes.rows as any[]).map((r) => ({
        id: r.id,
        filename: r.original_filename,
        docType: r.doc_type,
        status: r.status,
        uploadedAt: r.created_at,
        keyMetric: extractKeyMetric(r.doc_type, r.extraction_result),
      })),
      scenarios: (scenariosRes.rows as any[]).map((r) => ({
        type: r.scenario_type,
        status: r.status,
        revenueGrowthRate: Number(r.revenue_growth_rate || 0),
        exitCapRate: Number(r.exit_cap_rate || 0),
        expenseGrowthRate: Number(r.expense_growth_rate || 0),
        holdPeriod: Number(r.hold_period || 5),
      })),
    });
  } catch (error: any) {
    console.error("Asset detail error:", error);
    res.status(500).json({ error: "Failed to fetch asset detail" });
  }
});

function extractKeyMetric(docType: string, extractionResult: any): string {
  if (!extractionResult) return "";
  try {
    const result = typeof extractionResult === "string" ? JSON.parse(extractionResult) : extractionResult;
    if (docType === "str_payout" && result.net_payout) return `Net Payout: $${Number(result.net_payout).toLocaleString()}`;
    if (docType === "profit_loss" && result.noi) return `NOI: $${Number(result.noi).toLocaleString()}`;
    if (docType === "rent_roll" && result.occupancy) return `Occupancy: ${(Number(result.occupancy) * 100).toFixed(1)}%`;
    if (docType === "t12" && result.total_revenue) return `Revenue: $${Number(result.total_revenue).toLocaleString()}`;
    return "";
  } catch {
    return "";
  }
}

export default router;
