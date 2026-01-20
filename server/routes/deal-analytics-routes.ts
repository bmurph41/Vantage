import { Router, Request, Response, NextFunction } from "express";
import { dealStageHistoryService } from "../services/deal-stage-history-service";
import { db } from "../db";
import { crmDeals, crmDealEngagementScores } from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

const router = Router();

router.get("/crm/deals/:dealId/stage-history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const history = await dealStageHistoryService.getDealStageHistory(dealId);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

router.get("/crm/deals/:dealId/timeline", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const timeline = await dealStageHistoryService.getDealTimeline(dealId, limit);
    res.json(timeline);
  } catch (error) {
    next(error);
  }
});

router.get("/crm/deals/:dealId/engagement-score", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const score = await dealStageHistoryService.getEngagementScore(dealId);
    res.json(score);
  } catch (error) {
    next(error);
  }
});

router.post("/crm/deals/:dealId/recalculate-score", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dealId } = req.params;
    const score = await dealStageHistoryService.recalculateEngagementScore(dealId);
    res.json({ engagementScore: score });
  } catch (error) {
    next(error);
  }
});

router.get("/crm/analytics/velocity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).orgId || "org-1";
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const metrics = await dealStageHistoryService.getStageVelocityMetrics(orgId, start, end);
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get("/crm/analytics/sales-velocity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).orgId || "org-1";
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const velocity = await dealStageHistoryService.getSalesVelocity(orgId, start, end);
    res.json(velocity);
  } catch (error) {
    next(error);
  }
});

router.get("/crm/analytics/success-predictors", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).orgId || "org-1";
    const predictors = await dealStageHistoryService.getSuccessPredictors(orgId);
    res.json(predictors);
  } catch (error) {
    next(error);
  }
});

router.get("/crm/analytics/pipeline-health", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).orgId || "org-1";
    
    const deals = await db.select().from(crmDeals);
    
    const engagementScores = await db.select().from(crmDealEngagementScores);
    const scoreMap = new Map(engagementScores.map(s => [s.dealId, s]));
    
    const stageDistribution: Record<string, { count: number; value: number; avgProbability: number }> = {};
    let totalPipelineValue = 0;
    let weightedPipelineValue = 0;
    let atRiskCount = 0;
    let healthyCount = 0;
    
    for (const deal of deals) {
      const stage = deal.stage || "unknown";
      const value = Number(deal.value) || 0;
      const score = scoreMap.get(deal.id);
      const probability = score?.winProbability || 10;
      
      if (!stageDistribution[stage]) {
        stageDistribution[stage] = { count: 0, value: 0, avgProbability: 0 };
      }
      stageDistribution[stage].count++;
      stageDistribution[stage].value += value;
      stageDistribution[stage].avgProbability = 
        (stageDistribution[stage].avgProbability * (stageDistribution[stage].count - 1) + probability) / 
        stageDistribution[stage].count;
      
      totalPipelineValue += value;
      weightedPipelineValue += value * (probability / 100);
      
      if (score && score.engagementScore < 30) {
        atRiskCount++;
      } else if (score && score.engagementScore >= 50) {
        healthyCount++;
      }
    }
    
    const stageDistributionArray = Object.entries(stageDistribution).map(([stage, data]) => ({
      stage,
      count: data.count,
      value: Math.round(data.value),
      avgProbability: Math.round(data.avgProbability),
    }));
    
    res.json({
      totalDeals: deals.length,
      totalPipelineValue: Math.round(totalPipelineValue),
      weightedPipelineValue: Math.round(weightedPipelineValue),
      atRiskDeals: atRiskCount,
      healthyDeals: healthyCount,
      stageDistribution: stageDistributionArray,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/crm/analytics/win-probability-distribution", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scores = await db.select().from(crmDealEngagementScores);
    
    const distribution = {
      low: scores.filter(s => (s.winProbability || 0) < 30).length,
      medium: scores.filter(s => (s.winProbability || 0) >= 30 && (s.winProbability || 0) < 60).length,
      high: scores.filter(s => (s.winProbability || 0) >= 60 && (s.winProbability || 0) < 80).length,
      veryHigh: scores.filter(s => (s.winProbability || 0) >= 80).length,
    };
    
    res.json({
      distribution,
      averageWinProbability: scores.length > 0 
        ? Math.round(scores.reduce((acc, s) => acc + (s.winProbability || 0), 0) / scores.length)
        : 0,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
