/**
 * Pipeline Analytics Routes
 * 
 * Provides computed analytics for pipeline performance:
 *   GET /api/crm/analytics/velocity    → avg days per stage
 *   GET /api/crm/analytics/conversion  → stage-to-stage conversion rates
 *   GET /api/crm/analytics/win-loss    → win/loss breakdown
 *   GET /api/crm/analytics/health      → composite pipeline health score
 *   GET /api/crm/analytics/summary     → combined quick summary
 * 
 * Mount: app.use("/api/crm/analytics", authenticateUser, analyticsRoutes);
 * 
 * All endpoints accept optional query params:
 *   ?assetClass=marina  — filter by asset class
 *   ?from=2025-01-01&to=2025-12-31  — date range
 *   ?source=broker  — filter by deal source
 */

import { Router } from "express";
import { db } from "../db";
import { sql, eq, and, gte, lte, count, sum, avg } from "drizzle-orm";

const router = Router();

// ─── Velocity: Avg days in each pipeline stage ────────────────────

router.get("/velocity", async (req, res) => {
  try {
    const { assetClass, from, to } = req.query;
    
    // Build WHERE clauses
    const conditions: string[] = [`d.org_id = '${(req as any).orgId}'`];
    if (assetClass) conditions.push(`d.asset_class = '${assetClass}'`);
    if (from) conditions.push(`d.created_at >= '${from}'`);
    if (to) conditions.push(`d.created_at <= '${to}'`);
    
    const whereClause = conditions.join(" AND ");

    // Calculate avg days in current stage per deal
    const result = await db.execute(sql.raw(`
      SELECT 
        d.pipeline_stage as stage,
        COUNT(*)::int as deal_count,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (NOW() - COALESCE(d.stage_changed_at, d.updated_at, d.created_at))) / 86400
        ), 0)::numeric(10,1) as avg_days,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause} AND d.status = 'open'
      GROUP BY d.pipeline_stage
      ORDER BY 
        CASE d.pipeline_stage
          WHEN 'lead' THEN 0
          WHEN 'qualified' THEN 1
          WHEN 'loi' THEN 2
          WHEN 'due_diligence' THEN 3
          WHEN 'under_contract' THEN 4
          WHEN 'closing' THEN 5
          ELSE 6
        END
    `));

    // Also get velocity by asset class if not filtered
    let byAssetClass = null;
    if (!assetClass) {
      const acResult = await db.execute(sql.raw(`
        SELECT 
          COALESCE(d.asset_class, 'marina') as asset_class,
          d.pipeline_stage as stage,
          COUNT(*)::int as deal_count,
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (NOW() - COALESCE(d.stage_changed_at, d.updated_at, d.created_at))) / 86400
          ), 0)::numeric(10,1) as avg_days
        FROM crm_deals d
        WHERE ${whereClause} AND d.status = 'open'
        GROUP BY d.asset_class, d.pipeline_stage
        ORDER BY d.asset_class, d.pipeline_stage
      `));
      byAssetClass = acResult.rows;
    }

    res.json({
      stages: result.rows,
      byAssetClass,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Velocity analytics error:", error);
    // Return safe defaults if table structure differs
    res.json({
      stages: [],
      byAssetClass: null,
      generatedAt: new Date().toISOString(),
      _fallback: true,
    });
  }
});

// ─── Conversion: Stage-to-stage conversion rates ──────────────────

router.get("/conversion", async (req, res) => {
  try {
    const { assetClass, from, to } = req.query;
    
    const conditions: string[] = [`d.org_id = '${(req as any).orgId}'`];
    if (assetClass) conditions.push(`d.asset_class = '${assetClass}'`);
    if (from) conditions.push(`d.created_at >= '${from}'`);
    if (to) conditions.push(`d.created_at <= '${to}'`);
    
    const whereClause = conditions.join(" AND ");

    // Get counts per stage (including won/lost for conversion calc)
    const stageResult = await db.execute(sql.raw(`
      SELECT 
        d.pipeline_stage as stage,
        d.status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause}
      GROUP BY d.pipeline_stage, d.status
      ORDER BY 
        CASE d.pipeline_stage
          WHEN 'lead' THEN 0
          WHEN 'qualified' THEN 1
          WHEN 'loi' THEN 2
          WHEN 'due_diligence' THEN 3
          WHEN 'under_contract' THEN 4
          WHEN 'closing' THEN 5
          ELSE 6
        END
    `));

    // By source
    const sourceResult = await db.execute(sql.raw(`
      SELECT 
        COALESCE(d.source, 'unknown') as source,
        d.status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause}
      GROUP BY d.source, d.status
    `));

    res.json({
      stages: stageResult.rows,
      bySource: sourceResult.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Conversion analytics error:", error);
    res.json({ stages: [], bySource: [], generatedAt: new Date().toISOString(), _fallback: true });
  }
});

// ─── Win/Loss Analysis ────────────────────────────────────────────

router.get("/win-loss", async (req, res) => {
  try {
    const { assetClass, from, to } = req.query;
    
    const conditions: string[] = [`d.org_id = '${(req as any).orgId}'`];
    if (assetClass) conditions.push(`d.asset_class = '${assetClass}'`);
    if (from) conditions.push(`d.created_at >= '${from}'`);
    if (to) conditions.push(`d.created_at <= '${to}'`);
    
    const whereClause = conditions.join(" AND ");

    // Overall win/loss
    const overallResult = await db.execute(sql.raw(`
      SELECT
        d.status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value,
        COALESCE(AVG(d.amount), 0)::numeric(12,0) as avg_deal_size
      FROM crm_deals d
      WHERE ${whereClause} AND d.status IN ('won', 'lost')
      GROUP BY d.status
    `));

    // By asset class
    const byAssetClassResult = await db.execute(sql.raw(`
      SELECT
        COALESCE(d.asset_class, 'marina') as asset_class,
        d.status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause} AND d.status IN ('won', 'lost')
      GROUP BY d.asset_class, d.status
    `));

    // By source
    const bySourceResult = await db.execute(sql.raw(`
      SELECT
        COALESCE(d.source, 'unknown') as source,
        d.status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause} AND d.status IN ('won', 'lost')
      GROUP BY d.source, d.status
    `));

    // Monthly trend (last 12 months)
    const trendResult = await db.execute(sql.raw(`
      SELECT
        TO_CHAR(d.updated_at, 'YYYY-MM') as month,
        d.status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause} 
        AND d.status IN ('won', 'lost')
        AND d.updated_at >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(d.updated_at, 'YYYY-MM'), d.status
      ORDER BY month
    `));

    const won = overallResult.rows.find((r: any) => r.status === "won") || { count: 0, total_value: 0, avg_deal_size: 0 };
    const lost = overallResult.rows.find((r: any) => r.status === "lost") || { count: 0, total_value: 0, avg_deal_size: 0 };
    const totalClosed = (Number(won.count) || 0) + (Number(lost.count) || 0);
    const winRate = totalClosed > 0 ? ((Number(won.count) || 0) / totalClosed) * 100 : 0;

    res.json({
      won: { count: Number(won.count), totalValue: Number(won.total_value), avgDealSize: Number(won.avg_deal_size) },
      lost: { count: Number(lost.count), totalValue: Number(lost.total_value), avgDealSize: Number(lost.avg_deal_size) },
      winRate: Math.round(winRate * 10) / 10,
      byAssetClass: byAssetClassResult.rows,
      bySource: bySourceResult.rows,
      monthlyTrend: trendResult.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Win/loss analytics error:", error);
    res.json({
      won: { count: 0, totalValue: 0, avgDealSize: 0 },
      lost: { count: 0, totalValue: 0, avgDealSize: 0 },
      winRate: 0,
      byAssetClass: [],
      bySource: [],
      monthlyTrend: [],
      generatedAt: new Date().toISOString(),
      _fallback: true,
    });
  }
});

// ─── Pipeline Health Score (composite 0-100) ──────────────────────

router.get("/health", async (req, res) => {
  try {
    const orgId = (req as any).orgId;

    const result = await db.execute(sql.raw(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int as open_deals,
        COUNT(*) FILTER (WHERE status = 'won')::int as won_deals,
        COUNT(*) FILTER (WHERE status = 'lost')::int as lost_deals,
        COALESCE(SUM(amount) FILTER (WHERE status = 'open'), 0)::numeric as pipeline_value,
        COALESCE(SUM(amount) FILTER (WHERE status = 'won'), 0)::numeric as won_value,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (NOW() - COALESCE(stage_changed_at, updated_at, created_at))) / 86400
        ) FILTER (WHERE status = 'open'), 0)::numeric(10,1) as avg_age_days,
        COUNT(*) FILTER (
          WHERE status = 'open' 
          AND COALESCE(updated_at, created_at) < NOW() - INTERVAL '30 days'
        )::int as stale_count
      FROM crm_deals
      WHERE org_id = '${orgId}'
    `));

    const data = result.rows[0] as any;
    const openDeals = Number(data?.open_deals || 0);
    const wonDeals = Number(data?.won_deals || 0);
    const lostDeals = Number(data?.lost_deals || 0);
    const pipelineValue = Number(data?.pipeline_value || 0);
    const wonValue = Number(data?.won_value || 0);
    const avgAgeDays = Number(data?.avg_age_days || 0);
    const staleCount = Number(data?.stale_count || 0);

    // Compute health score components (each 0-25, total 0-100)
    const totalClosed = wonDeals + lostDeals;
    const winRate = totalClosed > 0 ? wonDeals / totalClosed : 0.5;
    const stalePct = openDeals > 0 ? staleCount / openDeals : 0;
    const coverageRatio = wonValue > 0 ? pipelineValue / wonValue : openDeals > 0 ? 2 : 0;

    // Win rate score (25 pts max): 60%+ = 25, scale down
    const winRateScore = Math.min(25, Math.round(winRate * 100 * 0.4));

    // Freshness score (25 pts max): fewer stale = higher score
    const freshnessScore = Math.min(25, Math.round((1 - stalePct) * 25));

    // Coverage score (25 pts max): 2-4x coverage ideal
    const coverageScore =
      coverageRatio >= 2 && coverageRatio <= 4
        ? 25
        : coverageRatio > 4
          ? Math.max(15, 25 - Math.round((coverageRatio - 4) * 2))
          : Math.round(coverageRatio * 12.5);

    // Velocity score (25 pts max): under 45 days avg = 25
    const velocityScore = avgAgeDays <= 45 ? 25 : Math.max(0, 25 - Math.round((avgAgeDays - 45) * 0.5));

    const totalScore = winRateScore + freshnessScore + coverageScore + velocityScore;

    res.json({
      score: Math.min(100, totalScore),
      breakdown: {
        winRate: { score: winRateScore, max: 25, value: Math.round(winRate * 100) },
        freshness: { score: freshnessScore, max: 25, value: Math.round((1 - stalePct) * 100) },
        coverage: { score: coverageScore, max: 25, value: Math.round(coverageRatio * 100) / 100 },
        velocity: { score: velocityScore, max: 25, value: Math.round(avgAgeDays) },
      },
      summary: {
        openDeals,
        wonDeals,
        lostDeals,
        pipelineValue,
        wonValue,
        avgAgeDays: Math.round(avgAgeDays),
        staleCount,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Health score error:", error);
    res.json({
      score: 0,
      breakdown: {
        winRate: { score: 0, max: 25, value: 0 },
        freshness: { score: 0, max: 25, value: 0 },
        coverage: { score: 0, max: 25, value: 0 },
        velocity: { score: 0, max: 25, value: 0 },
      },
      summary: { openDeals: 0, wonDeals: 0, lostDeals: 0, pipelineValue: 0, wonValue: 0, avgAgeDays: 0, staleCount: 0 },
      generatedAt: new Date().toISOString(),
      _fallback: true,
    });
  }
});

// ─── Quick Summary (combined endpoint) ────────────────────────────

router.get("/summary", async (req, res) => {
  try {
    const orgId = (req as any).orgId;

    const result = await db.execute(sql.raw(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int as open_count,
        COUNT(*) FILTER (WHERE status = 'won')::int as won_count,
        COUNT(*) FILTER (WHERE status = 'lost')::int as lost_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'open'), 0)::numeric as open_value,
        COALESCE(SUM(amount) FILTER (WHERE status = 'won'), 0)::numeric as won_value,
        COALESCE(AVG(amount) FILTER (WHERE status = 'open'), 0)::numeric(12,0) as avg_open_deal,
        COUNT(DISTINCT COALESCE(asset_class, 'marina'))::int as asset_class_count,
        COUNT(DISTINCT pipeline_stage) FILTER (WHERE status = 'open')::int as active_stages
      FROM crm_deals
      WHERE org_id = '${orgId}'
    `));

    res.json({
      ...(result.rows[0] || {}),
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Summary analytics error:", error);
    res.json({ open_count: 0, won_count: 0, lost_count: 0, open_value: 0, won_value: 0, generatedAt: new Date().toISOString(), _fallback: true });
  }
});

export default router;
