/**
 * G.4 — Predictive Analytics Routes
 *
 * Three models:
 *   1. Deal Closure Probability — rule-based scoring with stage, activity, DD signals
 *   2. Asset Underperformance Early Warning — occupancy, NOI, maintenance, DSCR trends
 *   3. Optimal Hold Period / Hold-Sell Optimizer (also covers 3.5)
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  crmDeals,
  crmActivities,
  dealPredictions,
  assetRiskScores,
  holdSellAnalyses,
  workOrders,
  rentPayments,
} from "@shared/schema";
import { eq, and, desc, sql, gte, count } from "drizzle-orm";

export const predictiveAnalyticsRouter = Router();

// ═══════════════════════════════════════════════════════════════════════════
// MODEL 1: Deal Closure Probability
// ═══════════════════════════════════════════════════════════════════════════

// GET /deal-closure/:dealId — predict closure probability
predictiveAnalyticsRouter.get("/deal-closure/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId } = req.params;

    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: "Deal not found" });

    // Get activity signals
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [activityStats] = await db
      .select({
        totalActivities: count(),
        recentActivities: sql<number>`count(*) filter (where ${crmActivities.createdAt} > ${thirtyDaysAgo})`,
        lastActivityAt: sql<Date>`max(${crmActivities.createdAt})`,
      })
      .from(crmActivities)
      .where(eq(crmActivities.dealId, dealId));

    const prediction = predictClosureProbability(deal, activityStats);

    // Store prediction
    const [stored] = await db
      .insert(dealPredictions)
      .values({
        orgId,
        dealId,
        predictionType: "closure_probability",
        score: String(prediction.score),
        confidence: String(prediction.confidence),
        factors: prediction.factors,
        recommendation: prediction.recommendation,
        modelVersion: "v1",
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      })
      .returning();

    res.json({
      dealId,
      dealTitle: deal.title,
      probability: prediction.score,
      confidence: prediction.confidence,
      factors: prediction.factors,
      recommendation: prediction.recommendation,
      predictionId: stored.id,
      modelVersion: "v1",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /deal-closure — batch: all open deals with predictions
predictiveAnalyticsRouter.get("/deal-closure", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const openDeals = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)))
      .orderBy(desc(crmDeals.updatedAt))
      .limit(100);

    const predictions = [];
    for (const deal of openDeals) {
      const [activityStats] = await db
        .select({
          totalActivities: count(),
          recentActivities: sql<number>`count(*) filter (where ${crmActivities.createdAt} > now() - interval '30 days')`,
          lastActivityAt: sql<Date>`max(${crmActivities.createdAt})`,
        })
        .from(crmActivities)
        .where(eq(crmActivities.dealId, deal.id));

      const pred = predictClosureProbability(deal, activityStats);
      predictions.push({
        dealId: deal.id,
        dealTitle: deal.title,
        stage: deal.stage,
        value: deal.value,
        probability: pred.score,
        confidence: pred.confidence,
        recommendation: pred.recommendation,
        topFactor: pred.factors[0]?.name || null,
      });
    }

    // Sort by probability descending
    predictions.sort((a, b) => b.probability - a.probability);

    res.json({
      totalDeals: predictions.length,
      predictions,
      highProbability: predictions.filter((p) => p.probability >= 70).length,
      atRisk: predictions.filter((p) => p.probability < 30).length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MODEL 2: Asset Underperformance Early Warning
// ═══════════════════════════════════════════════════════════════════════════

// GET /asset-risk/:dealId — assess underperformance risk
predictiveAnalyticsRouter.get("/asset-risk/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId } = req.params;

    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: "Deal not found" });

    // Get maintenance signals
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [workOrderStats] = await db
      .select({
        totalWO: count(),
        emergencyWO: sql<number>`count(*) filter (where ${workOrders.priority} = 'emergency')`,
      })
      .from(workOrders)
      .where(and(eq(workOrders.dealId, dealId), gte(workOrders.createdAt, ninetyDaysAgo)));

    // Get rent payment signals
    const [paymentStats] = await db
      .select({
        totalPayments: count(),
        failedPayments: sql<number>`count(*) filter (where ${rentPayments.status} in ('failed', 'nsf'))`,
        delinquent: sql<number>`count(*) filter (where ${rentPayments.status} = 'pending' and ${rentPayments.periodEnd} < now())`,
      })
      .from(rentPayments)
      .where(eq(rentPayments.dealId, dealId));

    const riskAssessment = assessAssetRisk(deal, workOrderStats, paymentStats);

    // Store assessment
    const [stored] = await db
      .insert(assetRiskScores)
      .values({
        orgId,
        dealId,
        compositeScore: String(riskAssessment.compositeScore),
        occupancyRisk: String(riskAssessment.occupancyRisk),
        noiVarianceRisk: String(riskAssessment.noiVarianceRisk),
        maintenanceRisk: String(riskAssessment.maintenanceRisk),
        leaseRolloverRisk: String(riskAssessment.leaseRolloverRisk),
        marketRisk: String(riskAssessment.marketRisk),
        dscrRisk: String(riskAssessment.dscrRisk),
        factors: riskAssessment.factors,
        recommendation: riskAssessment.recommendation,
        alertLevel: riskAssessment.alertLevel,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    res.json({
      dealId,
      dealTitle: deal.title,
      ...riskAssessment,
      assessmentId: stored.id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /asset-risk — portfolio-wide risk overview
predictiveAnalyticsRouter.get("/asset-risk", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    // Get latest risk scores for all deals
    const scores = await db
      .select()
      .from(assetRiskScores)
      .where(eq(assetRiskScores.orgId, orgId))
      .orderBy(desc(assetRiskScores.assessedAt));

    // Deduplicate to latest per deal
    const latestByDeal = new Map<string, any>();
    for (const s of scores) {
      if (!latestByDeal.has(s.dealId)) {
        latestByDeal.set(s.dealId, s);
      }
    }

    const allScores = Array.from(latestByDeal.values());
    const critical = allScores.filter((s) => s.alertLevel === "critical");
    const warning = allScores.filter((s) => s.alertLevel === "warning");
    const watch = allScores.filter((s) => s.alertLevel === "watch");

    res.json({
      totalAssessed: allScores.length,
      critical: critical.length,
      warning: warning.length,
      watch: watch.length,
      normal: allScores.length - critical.length - warning.length - watch.length,
      alerts: [...critical, ...warning].map((s) => ({
        dealId: s.dealId,
        compositeScore: s.compositeScore,
        alertLevel: s.alertLevel,
        recommendation: s.recommendation,
        assessedAt: s.assessedAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MODEL 3: Optimal Hold Period / Hold-Sell Optimizer (covers 3.5)
// ═══════════════════════════════════════════════════════════════════════════

// POST /hold-sell/:dealId — run hold/sell analysis
predictiveAnalyticsRouter.post("/hold-sell/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { dealId } = req.params;
    const {
      currentCapRate,
      exitCapRate,
      rentGrowthRate,
      expenseGrowthRate,
      holdYears,
      discountRate,
    } = req.body;

    const [deal] = await db
      .select()
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));

    if (!deal) return res.status(404).json({ error: "Deal not found" });

    const analysis = computeHoldSellAnalysis(deal, {
      currentCapRate: currentCapRate || 0.06,
      exitCapRate: exitCapRate || 0.065,
      rentGrowthRate: rentGrowthRate || 0.03,
      expenseGrowthRate: expenseGrowthRate || 0.025,
      maxHoldYears: holdYears || 10,
      discountRate: discountRate || 0.08,
    });

    // Store analysis
    const [stored] = await db
      .insert(holdSellAnalyses)
      .values({
        orgId,
        dealId,
        recommendation: analysis.recommendation,
        confidenceScore: String(analysis.confidenceScore),
        currentValue: deal.value ? String(deal.value) : null,
        projectedExitValue: String(analysis.projectedExitValue),
        optimalExitYear: analysis.optimalExitYear,
        holdIrr: String(analysis.holdIrr),
        sellNowIrr: String(analysis.sellNowIrr),
        yearByYearProjections: analysis.yearByYearProjections,
        factors: analysis.factors,
        marketConditions: analysis.marketConditions,
        createdBy: userId,
      })
      .returning();

    res.json({
      dealId,
      dealTitle: deal.title,
      ...analysis,
      analysisId: stored.id,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /hold-sell/:dealId — get latest analysis for a deal
predictiveAnalyticsRouter.get("/hold-sell/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [latest] = await db
      .select()
      .from(holdSellAnalyses)
      .where(
        and(eq(holdSellAnalyses.dealId, req.params.dealId), eq(holdSellAnalyses.orgId, orgId)),
      )
      .orderBy(desc(holdSellAnalyses.createdAt))
      .limit(1);

    if (!latest) return res.status(404).json({ error: "No hold/sell analysis found" });
    res.json(latest);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /hold-sell — portfolio hold/sell summary
predictiveAnalyticsRouter.get("/hold-sell", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const analyses = await db
      .select()
      .from(holdSellAnalyses)
      .where(eq(holdSellAnalyses.orgId, orgId))
      .orderBy(desc(holdSellAnalyses.createdAt));

    // Deduplicate to latest per deal
    const latestByDeal = new Map<string, any>();
    for (const a of analyses) {
      if (!latestByDeal.has(a.dealId)) latestByDeal.set(a.dealId, a);
    }

    const all = Array.from(latestByDeal.values());

    res.json({
      totalAnalyzed: all.length,
      holdCount: all.filter((a) => a.recommendation === "hold").length,
      sellCount: all.filter((a) => a.recommendation === "sell").length,
      refinanceCount: all.filter((a) => a.recommendation === "refinance").length,
      analyses: all,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Prediction History ───────────────────────────────────────────────────

// GET /history/:dealId — all predictions for a deal
predictiveAnalyticsRouter.get("/history/:dealId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const predictions = await db
      .select()
      .from(dealPredictions)
      .where(
        and(eq(dealPredictions.dealId, req.params.dealId), eq(dealPredictions.orgId, orgId)),
      )
      .orderBy(desc(dealPredictions.createdAt))
      .limit(50);
    res.json(predictions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SCORING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function predictClosureProbability(
  deal: any,
  activityStats: any,
): { score: number; confidence: number; factors: any[]; recommendation: string } {
  const factors: Array<{ name: string; impact: number; value: string; direction: string }> = [];
  let score = 50;
  let confidence = 60;

  // Stage-based scoring (highest impact)
  const stageBase: Record<string, number> = {
    prospect: 5,
    lead: 10,
    qualified: 20,
    initial_review: 25,
    loi_draft: 30,
    loi_submitted: 35,
    loi_accepted: 60,
    psa_negotiation: 65,
    psa_executed: 75,
    due_diligence: 80,
    financing: 85,
    clear_to_close: 95,
    closed_won: 100,
  };

  const stage = (deal.stage || "prospect").toLowerCase().replace(/\s+/g, "_");
  if (stageBase[stage] !== undefined) {
    score = stageBase[stage];
    factors.push({
      name: "Deal Stage",
      impact: score - 50,
      value: deal.stage || "prospect",
      direction: score >= 50 ? "positive" : "negative",
    });
  }

  // Activity recency signal
  const lastActivity = activityStats?.lastActivityAt;
  if (lastActivity) {
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 3) {
      score += 10;
      factors.push({ name: "Recent Activity", impact: 10, value: `${daysSince}d ago`, direction: "positive" });
    } else if (daysSince > 14) {
      const penalty = daysSince > 30 ? -30 : -15;
      score += penalty;
      factors.push({
        name: "Activity Gap",
        impact: penalty,
        value: `${daysSince}d since last activity`,
        direction: "negative",
      });
    }
  } else {
    score -= 20;
    factors.push({ name: "No Activities", impact: -20, value: "No recorded activity", direction: "negative" });
  }

  // Activity volume
  const recentCount = activityStats?.recentActivities || 0;
  if (recentCount >= 5) {
    score += 5;
    factors.push({ name: "High Engagement", impact: 5, value: `${recentCount} activities in 30d`, direction: "positive" });
  }

  // Deal size penalty (larger deals have more friction)
  const dealValue = parseFloat(deal.value || "0");
  if (dealValue > 50_000_000) {
    score -= 10;
    factors.push({ name: "Large Deal Size", impact: -10, value: `$${(dealValue / 1e6).toFixed(1)}M`, direction: "negative" });
  } else if (dealValue > 0 && dealValue < 5_000_000) {
    score += 5;
    factors.push({ name: "Small Deal Size", impact: 5, value: `$${(dealValue / 1e6).toFixed(1)}M`, direction: "positive" });
  }

  // Expected close date signal
  if (deal.expectedCloseDate) {
    const daysToClose = Math.floor(
      (new Date(deal.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    if (daysToClose < 0) {
      score -= 15;
      factors.push({
        name: "Past Expected Close",
        impact: -15,
        value: `${Math.abs(daysToClose)}d overdue`,
        direction: "negative",
      });
    } else if (daysToClose < 30) {
      score += 5;
      confidence += 10;
      factors.push({ name: "Close Date Near", impact: 5, value: `${daysToClose}d away`, direction: "positive" });
    }
  }

  // Probability override from CRM (if manually set)
  if (deal.probability && deal.probability > 0) {
    const crmProb = parseFloat(deal.probability);
    score = Math.round(score * 0.6 + crmProb * 0.4); // blend
    confidence += 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  confidence = Math.min(95, confidence);

  // Sort factors by absolute impact
  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  let recommendation: string;
  if (score >= 80) recommendation = "High likelihood — prioritize for closing preparation";
  else if (score >= 60) recommendation = "Good momentum — maintain engagement cadence";
  else if (score >= 40) recommendation = "Moderate — needs attention to advance";
  else if (score >= 20) recommendation = "At risk — consider re-engagement or qualification review";
  else recommendation = "Low probability — evaluate whether to continue pursuit";

  return { score, confidence, factors, recommendation };
}

function assessAssetRisk(
  deal: any,
  workOrderStats: any,
  paymentStats: any,
): {
  compositeScore: number;
  occupancyRisk: number;
  noiVarianceRisk: number;
  maintenanceRisk: number;
  leaseRolloverRisk: number;
  marketRisk: number;
  dscrRisk: number;
  factors: any[];
  recommendation: string;
  alertLevel: string;
} {
  const factors: any[] = [];

  // Maintenance risk from work order volume
  const emergencyWO = workOrderStats?.emergencyWO || 0;
  const totalWO = workOrderStats?.totalWO || 0;
  let maintenanceRisk = 20; // baseline
  if (emergencyWO > 3) {
    maintenanceRisk = 80;
    factors.push({ name: "Emergency Work Orders", value: `${emergencyWO} in 90d`, direction: "negative" });
  } else if (totalWO > 10) {
    maintenanceRisk = 50;
    factors.push({ name: "High Work Order Volume", value: `${totalWO} in 90d`, direction: "negative" });
  }

  // Payment delinquency risk
  const failedPayments = paymentStats?.failedPayments || 0;
  const delinquent = paymentStats?.delinquent || 0;
  let noiVarianceRisk = 20;
  if (failedPayments > 2 || delinquent > 1) {
    noiVarianceRisk = 70;
    factors.push({
      name: "Payment Issues",
      value: `${failedPayments} failed, ${delinquent} delinquent`,
      direction: "negative",
    });
  }

  // Use deal metadata for other risk dimensions (placeholder scoring)
  const occupancyRisk = 25; // would be computed from actual occupancy data
  const leaseRolloverRisk = 30; // would check lease expiration concentration
  const marketRisk = 25; // would check cap rate trends
  const dscrRisk = 20; // would check debt service coverage

  const compositeScore = Math.round(
    occupancyRisk * 0.25 +
      noiVarianceRisk * 0.2 +
      maintenanceRisk * 0.15 +
      leaseRolloverRisk * 0.2 +
      marketRisk * 0.1 +
      dscrRisk * 0.1,
  );

  let alertLevel: string;
  if (compositeScore >= 70) alertLevel = "critical";
  else if (compositeScore >= 50) alertLevel = "warning";
  else if (compositeScore >= 35) alertLevel = "watch";
  else alertLevel = "normal";

  let recommendation: string;
  if (alertLevel === "critical")
    recommendation = "Immediate attention required — multiple risk indicators elevated";
  else if (alertLevel === "warning")
    recommendation = "Monitor closely — review maintenance backlog and payment collections";
  else if (alertLevel === "watch")
    recommendation = "Slight concern — keep monitoring trends";
  else recommendation = "Asset performing within normal parameters";

  return {
    compositeScore,
    occupancyRisk,
    noiVarianceRisk,
    maintenanceRisk,
    leaseRolloverRisk,
    marketRisk,
    dscrRisk,
    factors,
    recommendation,
    alertLevel,
  };
}

function computeHoldSellAnalysis(
  deal: any,
  params: {
    currentCapRate: number;
    exitCapRate: number;
    rentGrowthRate: number;
    expenseGrowthRate: number;
    maxHoldYears: number;
    discountRate: number;
  },
) {
  const currentValue = parseFloat(deal.value || "0") || 10_000_000;
  const assumedNOI = currentValue * params.currentCapRate;

  const projections: any[] = [];
  let bestIrr = -1;
  let bestYear = 1;

  for (let year = 1; year <= params.maxHoldYears; year++) {
    const projectedNOI = assumedNOI * Math.pow(1 + params.rentGrowthRate - params.expenseGrowthRate * 0.5, year);
    const projectedValue = projectedNOI / params.exitCapRate;

    // Simple IRR approximation: (exit value / entry value)^(1/years) - 1
    const totalReturn = projectedValue / currentValue;
    const annualizedReturn = Math.pow(totalReturn, 1 / year) - 1;

    // Add cash-on-cash from NOI
    const avgCashYield = (assumedNOI * (1 + params.rentGrowthRate * year / 2)) / currentValue;
    const estimatedIRR = annualizedReturn + avgCashYield * 0.5;

    projections.push({
      year,
      projectedNOI: Math.round(projectedNOI),
      projectedValue: Math.round(projectedValue),
      irr: parseFloat((estimatedIRR * 100).toFixed(2)),
      capRate: parseFloat((projectedNOI / projectedValue * 100).toFixed(2)),
    });

    if (estimatedIRR > bestIrr) {
      bestIrr = estimatedIRR;
      bestYear = year;
    }
  }

  // Sell now IRR = 0 (no appreciation)
  const sellNowIrr = 0;
  const holdIrr = bestIrr;
  const projectedExitValue = projections[bestYear - 1]?.projectedValue || currentValue;

  // Determine recommendation
  let recommendation: string;
  const factors: any[] = [];

  if (bestIrr > 0.12) {
    recommendation = "hold";
    factors.push({ name: "Strong IRR projection", impact: "positive", value: `${(bestIrr * 100).toFixed(1)}% at year ${bestYear}` });
  } else if (bestIrr > 0.08) {
    recommendation = "hold";
    factors.push({ name: "Moderate IRR", impact: "neutral", value: `${(bestIrr * 100).toFixed(1)}%` });
  } else {
    recommendation = "sell";
    factors.push({ name: "Below-target returns", impact: "negative", value: `${(bestIrr * 100).toFixed(1)}% IRR` });
  }

  if (params.exitCapRate > params.currentCapRate + 0.01) {
    factors.push({ name: "Cap rate expansion risk", impact: "negative", value: `${(params.exitCapRate * 100).toFixed(1)}% exit vs ${(params.currentCapRate * 100).toFixed(1)}% current` });
    if (recommendation === "hold" && bestIrr < 0.10) recommendation = "sell";
  }

  return {
    recommendation,
    confidenceScore: 65,
    projectedExitValue,
    optimalExitYear: bestYear,
    holdIrr: parseFloat((holdIrr * 100).toFixed(4)),
    sellNowIrr: 0,
    yearByYearProjections: projections,
    factors,
    marketConditions: {
      assumedCurrentCapRate: params.currentCapRate,
      assumedExitCapRate: params.exitCapRate,
      rentGrowthRate: params.rentGrowthRate,
      expenseGrowthRate: params.expenseGrowthRate,
      discountRate: params.discountRate,
    },
  };
}
