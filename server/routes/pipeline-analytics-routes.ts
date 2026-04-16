/**
 * Pipeline Analytics Routes
 * 
 * Provides computed analytics for pipeline performance:
 *   GET /            → consolidated analytics (velocity + conversion + win-loss + health + leaderboard)
 *                      uses crm_deal_stage_history for true stage-to-stage transition conversion rates
 *   GET /velocity    → avg days per stage
 *   GET /conversion  → stage/status counts (simple)
 *   GET /win-loss    → win/loss breakdown
 *   GET /health      → composite pipeline health score
 *   GET /summary     → combined quick summary
 * 
 * Mounted at TWO paths in server/routes.ts:
 *   app.use("/api/crm/analytics", ...)    → backward-compat CRM analytics prefix
 *   app.use("/api/pipeline/analytics", .) → canonical pipeline analytics endpoint
 *                                           GET / responds at /api/pipeline/analytics
 * 
 * All sub-endpoints accept optional query params:
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
        d.stage as stage,
        COUNT(*)::int as deal_count,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (NOW() - COALESCE(d.current_stage_entered_at, d.updated_at, d.created_at))) / 86400
        ), 0)::numeric(10,1) as avg_days,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause} AND d.is_closed = false
      GROUP BY d.stage
      ORDER BY 
        CASE d.stage
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
          d.stage as stage,
          COUNT(*)::int as deal_count,
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (NOW() - COALESCE(d.current_stage_entered_at, d.updated_at, d.created_at))) / 86400
          ), 0)::numeric(10,1) as avg_days
        FROM crm_deals d
        WHERE ${whereClause} AND d.is_closed = false
        GROUP BY d.asset_class, d.stage
        ORDER BY d.asset_class, d.stage
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

    const stageResult = await db.execute(sql.raw(`
      SELECT 
        d.stage as stage,
        CASE WHEN d.is_closed = false THEN 'open' WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END as status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause}
      GROUP BY d.stage, CASE WHEN d.is_closed = false THEN 'open' WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END
      ORDER BY 
        CASE d.stage
          WHEN 'lead' THEN 0
          WHEN 'qualified' THEN 1
          WHEN 'loi' THEN 2
          WHEN 'due_diligence' THEN 3
          WHEN 'under_contract' THEN 4
          WHEN 'closing' THEN 5
          ELSE 6
        END
    `));

    const sourceResult = await db.execute(sql.raw(`
      SELECT 
        COALESCE(d.lead_source, 'unknown') as source,
        CASE WHEN d.is_closed = false THEN 'open' WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END as status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause}
      GROUP BY d.lead_source, CASE WHEN d.is_closed = false THEN 'open' WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END
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

    const overallResult = await db.execute(sql.raw(`
      SELECT
        CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END as status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value,
        COALESCE(AVG(d.amount), 0)::numeric(12,0) as avg_deal_size
      FROM crm_deals d
      WHERE ${whereClause} AND d.is_closed = true
      GROUP BY CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END
    `));

    const byAssetClassResult = await db.execute(sql.raw(`
      SELECT
        COALESCE(d.asset_class, 'marina') as asset_class,
        CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END as status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause} AND d.is_closed = true
      GROUP BY d.asset_class, CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END
    `));

    const bySourceResult = await db.execute(sql.raw(`
      SELECT
        COALESCE(d.lead_source, 'unknown') as source,
        CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END as status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause} AND d.is_closed = true
      GROUP BY d.lead_source, CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END
    `));

    const trendResult = await db.execute(sql.raw(`
      SELECT
        TO_CHAR(d.closed_at, 'YYYY-MM') as month,
        CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END as status,
        COUNT(*)::int as count,
        COALESCE(SUM(d.amount), 0)::numeric as total_value
      FROM crm_deals d
      WHERE ${whereClause} 
        AND d.is_closed = true
        AND d.closed_at >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(d.closed_at, 'YYYY-MM'), CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END
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
    const orgId = ((req as any).user?.orgId || (req as any).tenantId) as string;

    const result = await db.execute(sql.raw(`
      SELECT
        COUNT(*) FILTER (WHERE is_closed = false)::int as open_deals,
        COUNT(*) FILTER (WHERE is_closed = true AND lost_reason IS NULL)::int as won_deals,
        COUNT(*) FILTER (WHERE is_closed = true AND lost_reason IS NOT NULL)::int as lost_deals,
        COALESCE(SUM(amount) FILTER (WHERE is_closed = false), 0)::numeric as pipeline_value,
        COALESCE(SUM(amount) FILTER (WHERE is_closed = true AND lost_reason IS NULL), 0)::numeric as won_value,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (NOW() - COALESCE(current_stage_entered_at, updated_at, created_at))) / 86400
        ) FILTER (WHERE is_closed = false), 0)::numeric(10,1) as avg_age_days,
        COUNT(*) FILTER (
          WHERE is_closed = false
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

// ─── Consolidated Pipeline Analytics (all data in one call) ───────

router.get("/", async (req, res) => {
  try {
    const orgId = ((req as any).user?.orgId || (req as any).tenantId) as string;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const velocityResult = await db.execute(sql`
      SELECT
        d.stage AS stage,
        COUNT(*)::int AS deal_count,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (NOW() - COALESCE(d.current_stage_entered_at, d.updated_at, d.created_at))) / 86400
        ), 0)::numeric(10,1) AS avg_days,
        COALESCE(SUM(d.amount), 0)::numeric AS total_value
      FROM crm_deals d
      WHERE d.org_id = ${orgId} AND d.is_closed = false
      GROUP BY d.stage
      ORDER BY
        CASE d.stage
          WHEN 'lead' THEN 0
          WHEN 'qualified' THEN 1
          WHEN 'loi' THEN 2
          WHEN 'due_diligence' THEN 3
          WHEN 'under_contract' THEN 4
          WHEN 'closing' THEN 5
          ELSE 6
        END
    `);

    // True stage-to-stage conversion: count distinct deals that ENTERED each stage
    // using crm_deal_stage_history for actual transition tracking
    const conversionResult = await db.execute(sql`
      SELECT
        ps.id AS stage_id,
        ps.name AS stage_name,
        COALESCE(ps.stage_order, 0) AS sort_order,
        COUNT(DISTINCT dsh.deal_id)::int AS deals_entered,
        COALESCE(AVG(dsh.duration_seconds), 0)::numeric(12,0) AS avg_duration_seconds
      FROM crm_pipeline_stages ps
      LEFT JOIN crm_deal_stage_history dsh
        ON dsh.stage_id = ps.id
      WHERE ps.org_id = ${orgId}
        AND ps.is_active = true
      GROUP BY ps.id, ps.name, ps.stage_order
      ORDER BY ps.stage_order ASC NULLS LAST
    `);

    const winLossResult = await db.execute(sql`
      SELECT
        CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END AS status,
        COUNT(*)::int AS count,
        COALESCE(SUM(d.amount), 0)::numeric AS total_value,
        COALESCE(AVG(d.amount), 0)::numeric(12,0) AS avg_deal_size
      FROM crm_deals d
      WHERE d.org_id = ${orgId} AND d.is_closed = true
      GROUP BY CASE WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END
    `);

    const dealSizeResult = await db.execute(sql`
      SELECT
        d.stage AS stage,
        COALESCE(AVG(d.amount), 0)::numeric(12,0) AS avg_deal_size,
        COUNT(*)::int AS deal_count
      FROM crm_deals d
      WHERE d.org_id = ${orgId} AND d.is_closed = false
      GROUP BY d.stage
    `);

    const healthResult = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE is_closed = false)::int AS open_deals,
        COUNT(*) FILTER (WHERE is_closed = true AND lost_reason IS NULL)::int AS won_deals,
        COUNT(*) FILTER (WHERE is_closed = true AND lost_reason IS NOT NULL)::int AS lost_deals,
        COALESCE(SUM(amount) FILTER (WHERE is_closed = false), 0)::numeric AS pipeline_value,
        COALESCE(SUM(amount) FILTER (WHERE is_closed = true AND lost_reason IS NULL), 0)::numeric AS won_value,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (NOW() - COALESCE(current_stage_entered_at, updated_at, created_at))) / 86400
        ) FILTER (WHERE is_closed = false), 0)::numeric(10,1) AS avg_age_days,
        COUNT(*) FILTER (
          WHERE is_closed = false
          AND COALESCE(updated_at, created_at) < NOW() - INTERVAL '30 days'
        )::int AS stale_count
      FROM crm_deals
      WHERE org_id = ${orgId}
    `);

    // Top deals leaderboard
    const leaderboardResult = await db.execute(sql`
      SELECT
        d.id,
        d.title AS name,
        d.stage AS stage,
        CASE WHEN d.is_closed = false THEN 'open' WHEN d.lost_reason IS NULL THEN 'won' ELSE 'lost' END AS status,
        COALESCE(d.amount, 0)::numeric AS amount,
        d.asset_class,
        d.owner_id
      FROM crm_deals d
      WHERE d.org_id = ${orgId} AND d.is_closed = false
      ORDER BY d.amount DESC NULLS LAST
      LIMIT 10
    `);

    const won = winLossResult.rows.find((r: any) => r.status === "won") || { count: 0, total_value: 0, avg_deal_size: 0 };
    const lost = winLossResult.rows.find((r: any) => r.status === "lost") || { count: 0, total_value: 0, avg_deal_size: 0 };
    const totalClosed = (Number((won as any).count) || 0) + (Number((lost as any).count) || 0);
    const winRate = totalClosed > 0 ? ((Number((won as any).count) || 0) / totalClosed) * 100 : 0;

    const h = (healthResult.rows[0] || {}) as any;
    const openDeals = Number(h.open_deals || 0);
    const wonDeals = Number(h.won_deals || 0);
    const lostDeals = Number(h.lost_deals || 0);
    const avgAgeDays = Number(h.avg_age_days || 0);
    const staleCount = Number(h.stale_count || 0);
    const pipelineValue = Number(h.pipeline_value || 0);
    const wonValue = Number(h.won_value || 0);
    const totalClosedH = wonDeals + lostDeals;
    const wr = totalClosedH > 0 ? wonDeals / totalClosedH : 0.5;
    const stalePct = openDeals > 0 ? staleCount / openDeals : 0;
    const coverageRatio = wonValue > 0 ? pipelineValue / wonValue : openDeals > 0 ? 2 : 0;
    const winRateScore = Math.min(25, Math.round(wr * 100 * 0.4));
    const freshnessScore = Math.min(25, Math.round((1 - stalePct) * 25));
    const coverageScore = coverageRatio >= 2 && coverageRatio <= 4 ? 25 : coverageRatio > 4 ? Math.max(15, 25 - Math.round((coverageRatio - 4) * 2)) : Math.round(coverageRatio * 12.5);
    const velocityScore = avgAgeDays <= 45 ? 25 : Math.max(0, 25 - Math.round((avgAgeDays - 45) * 0.5));
    const healthScore = Math.min(100, winRateScore + freshnessScore + coverageScore + velocityScore);

    // Compute true stage-to-stage transition conversion rates
    const stageRows = conversionResult.rows as any[];
    const stageConversions = stageRows.map((s, i) => {
      const entered = Number(s.deals_entered || 0);
      const prev = i > 0 ? Number(stageRows[i - 1].deals_entered || 0) : null;
      const conversionRate = prev !== null && prev > 0 ? Math.round((entered / prev) * 100) : null;
      return {
        stageId: s.stage_id,
        stageName: s.stage_name,
        sortOrder: Number(s.sort_order || 0),
        dealsEntered: entered,
        avgDurationSeconds: Number(s.avg_duration_seconds || 0),
        conversionRate, // null for first stage
      };
    });

    // Compute avg deal size by stage from DB (all open deals)
    const dealSizeByStage = (dealSizeResult.rows as any[]).map((r: any) => ({
      stage: r.stage,
      avgDealSize: Number(r.avg_deal_size || 0),
      dealCount: Number(r.deal_count || 0),
    }));

    res.json({
      velocity: {
        stages: velocityResult.rows,
        generatedAt: new Date().toISOString(),
      },
      conversion: {
        stageConversions,
        generatedAt: new Date().toISOString(),
      },
      winLoss: {
        won: { count: Number((won as any).count), totalValue: Number((won as any).total_value), avgDealSize: Number((won as any).avg_deal_size) },
        lost: { count: Number((lost as any).count), totalValue: Number((lost as any).total_value), avgDealSize: Number((lost as any).avg_deal_size) },
        winRate: Math.round(winRate * 10) / 10,
        generatedAt: new Date().toISOString(),
      },
      dealSizeByStage,
      health: {
        score: healthScore,
        summary: { openDeals, wonDeals, lostDeals, pipelineValue, wonValue, avgAgeDays: Math.round(avgAgeDays), staleCount },
        generatedAt: new Date().toISOString(),
      },
      leaderboard: leaderboardResult.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Consolidated pipeline analytics error:", error);
    res.json({
      velocity: { stages: [], generatedAt: new Date().toISOString(), _fallback: true },
      conversion: { stages: [], generatedAt: new Date().toISOString(), _fallback: true },
      winLoss: { won: { count: 0, totalValue: 0, avgDealSize: 0 }, lost: { count: 0, totalValue: 0, avgDealSize: 0 }, winRate: 0, generatedAt: new Date().toISOString(), _fallback: true },
      dealSizeByStage: [],
      health: { score: 0, summary: { openDeals: 0, wonDeals: 0, lostDeals: 0, pipelineValue: 0, wonValue: 0, avgAgeDays: 0, staleCount: 0 }, generatedAt: new Date().toISOString(), _fallback: true },
      leaderboard: [],
      generatedAt: new Date().toISOString(),
      _fallback: true,
    });
  }
});

// ─── Quick Summary (combined endpoint) ────────────────────────────

router.get("/summary", async (req, res) => {
  try {
    const orgId = ((req as any).user?.orgId || (req as any).tenantId) as string;

    const result = await db.execute(sql.raw(`
      SELECT
        COUNT(*) FILTER (WHERE is_closed = false)::int as open_count,
        COUNT(*) FILTER (WHERE is_closed = true AND lost_reason IS NULL)::int as won_count,
        COUNT(*) FILTER (WHERE is_closed = true AND lost_reason IS NOT NULL)::int as lost_count,
        COALESCE(SUM(amount) FILTER (WHERE is_closed = false), 0)::numeric as open_value,
        COALESCE(SUM(amount) FILTER (WHERE is_closed = true AND lost_reason IS NULL), 0)::numeric as won_value,
        COALESCE(AVG(amount) FILTER (WHERE is_closed = false), 0)::numeric(12,0) as avg_open_deal,
        COUNT(DISTINCT COALESCE(asset_class, 'marina'))::int as asset_class_count,
        COUNT(DISTINCT stage) FILTER (WHERE is_closed = false)::int as active_stages
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
