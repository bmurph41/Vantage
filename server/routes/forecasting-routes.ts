/**
 * Pipeline Forecasting API Routes
 * 
 * Provides endpoints for pipeline forecasting with weighted probability,
 * close rate benchmarking, and time-period analysis
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  crmDeals,
  crmPipelines,
  crmPipelineStages,
} from '@shared/schema';
import { eq, sql, and, gte, lte, isNull, or, desc, asc } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/crm/forecasting/summary
 * Get pipeline forecasting summary with weighted values
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const ownerId = (req as any).userId || 'user-1';
    const pipelineId = req.query.pipelineId as string | undefined;
    
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const thisQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const thisQuarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const thisYearEnd = new Date(now.getFullYear(), 11, 31);

    const conditions = [
      eq(crmDeals.isClosed, false),
    ];
    
    if (pipelineId) {
      conditions.push(eq(crmDeals.pipelineId, pipelineId));
    }

    const allOpenDeals = await db.select({
      id: crmDeals.id,
      title: crmDeals.title,
      value: crmDeals.value,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      stageId: crmDeals.stageId,
      stage: crmDeals.stage,
      forecastCategory: crmDeals.forecastCategory,
      createdAt: crmDeals.createdAt,
      ownerId: crmDeals.ownerId,
    })
    .from(crmDeals)
    .where(and(...conditions));

    const calculateForecast = (deals: typeof allOpenDeals, startDate: Date, endDate: Date) => {
      const periodDeals = deals.filter(d => {
        if (!d.expectedCloseDate) return false;
        const closeDate = new Date(d.expectedCloseDate);
        return closeDate >= startDate && closeDate <= endDate;
      });

      const totalValue = periodDeals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0);
      const weightedValue = periodDeals.reduce((sum, d) => {
        const value = parseFloat(d.value || '0') || 0;
        const prob = (d.probability || 10) / 100;
        return sum + (value * prob);
      }, 0);
      
      return {
        dealCount: periodDeals.length,
        totalValue,
        weightedValue,
        deals: periodDeals.map(d => ({
          id: d.id,
          title: d.title,
          value: parseFloat(d.value || '0') || 0,
          probability: d.probability || 10,
          weightedValue: (parseFloat(d.value || '0') || 0) * ((d.probability || 10) / 100),
          expectedCloseDate: d.expectedCloseDate,
          stage: d.stage,
          forecastCategory: d.forecastCategory,
        })),
      };
    };

    const byCategory = allOpenDeals.reduce((acc, deal) => {
      const category = deal.forecastCategory || 'pipeline';
      if (!acc[category]) {
        acc[category] = { dealCount: 0, totalValue: 0, weightedValue: 0 };
      }
      const value = parseFloat(deal.value || '0') || 0;
      const prob = (deal.probability || 10) / 100;
      acc[category].dealCount++;
      acc[category].totalValue += value;
      acc[category].weightedValue += value * prob;
      return acc;
    }, {} as Record<string, { dealCount: number; totalValue: number; weightedValue: number }>);

    const totalOpenValue = allOpenDeals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0);
    const totalWeightedValue = allOpenDeals.reduce((sum, d) => {
      const value = parseFloat(d.value || '0') || 0;
      const prob = (d.probability || 10) / 100;
      return sum + (value * prob);
    }, 0);

    res.json({
      summary: {
        openDeals: allOpenDeals.length,
        totalOpenValue,
        totalWeightedValue,
        averageProbability: allOpenDeals.length > 0
          ? Math.round(allOpenDeals.reduce((sum, d) => sum + (d.probability || 10), 0) / allOpenDeals.length)
          : 0,
      },
      thisMonth: calculateForecast(allOpenDeals, thisMonthStart, thisMonthEnd),
      thisQuarter: calculateForecast(allOpenDeals, thisQuarterStart, thisQuarterEnd),
      thisYear: calculateForecast(allOpenDeals, thisYearStart, thisYearEnd),
      byCategory,
      periods: {
        thisMonth: { start: thisMonthStart.toISOString(), end: thisMonthEnd.toISOString() },
        thisQuarter: { start: thisQuarterStart.toISOString(), end: thisQuarterEnd.toISOString() },
        thisYear: { start: thisYearStart.toISOString(), end: thisYearEnd.toISOString() },
      },
    });
  } catch (error) {
    console.error('[Forecasting] Error calculating forecast summary:', error);
    res.status(500).json({ error: 'Failed to calculate forecast summary' });
  }
});

/**
 * GET /api/crm/forecasting/close-rates
 * Get historical close rate benchmarking data
 */
router.get('/close-rates', async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const pipelineId = req.query.pipelineId as string | undefined;
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const conditions = [
      eq(crmDeals.isClosed, true),
      gte(crmDeals.closedAt, startDate),
    ];

    if (pipelineId) {
      conditions.push(eq(crmDeals.pipelineId, pipelineId));
    }

    const closedDeals = await db.select({
      id: crmDeals.id,
      stage: crmDeals.stage,
      value: crmDeals.value,
      closedAt: crmDeals.closedAt,
      createdAt: crmDeals.createdAt,
    })
    .from(crmDeals)
    .where(and(...conditions));

    const wonDeals = closedDeals.filter(d => d.stage === 'closed_won');
    const lostDeals = closedDeals.filter(d => d.stage === 'closed_lost');

    const wonValue = wonDeals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0);
    const lostValue = lostDeals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0);
    const totalValue = wonValue + lostValue;
    const totalCount = wonDeals.length + lostDeals.length;

    const avgDaysToClose = wonDeals.length > 0
      ? Math.round(
          wonDeals.reduce((sum, d) => {
            const created = new Date(d.createdAt);
            const closed = new Date(d.closedAt!);
            return sum + ((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / wonDeals.length
        )
      : 0;

    const monthlyData: Record<string, { won: number; lost: number; wonValue: number; lostValue: number }> = {};
    
    closedDeals.forEach(d => {
      const monthKey = new Date(d.closedAt!).toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { won: 0, lost: 0, wonValue: 0, lostValue: 0 };
      }
      if (d.stage === 'closed_won') {
        monthlyData[monthKey].won++;
        monthlyData[monthKey].wonValue += parseFloat(d.value || '0') || 0;
      } else {
        monthlyData[monthKey].lost++;
        monthlyData[monthKey].lostValue += parseFloat(d.value || '0') || 0;
      }
    });

    const monthlyTrend = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        ...data,
        closeRate: data.won + data.lost > 0 
          ? Math.round((data.won / (data.won + data.lost)) * 100) 
          : 0,
      }));

    res.json({
      summary: {
        totalClosed: totalCount,
        wonCount: wonDeals.length,
        lostCount: lostDeals.length,
        closeRate: totalCount > 0 ? Math.round((wonDeals.length / totalCount) * 100) : 0,
        wonValue,
        lostValue,
        totalValue,
        valueCloseRate: totalValue > 0 ? Math.round((wonValue / totalValue) * 100) : 0,
        avgDaysToClose,
        periodMonths: months,
      },
      monthlyTrend,
      benchmarks: {
        industryAvgCloseRate: 25,
        industryAvgDaysToClose: 90,
        targetCloseRate: 30,
        performanceVsTarget: totalCount > 0 
          ? Math.round((wonDeals.length / totalCount) * 100) - 30 
          : 0,
      },
    });
  } catch (error) {
    console.error('[Forecasting] Error calculating close rates:', error);
    res.status(500).json({ error: 'Failed to calculate close rates' });
  }
});

/**
 * GET /api/crm/forecasting/stage-analysis
 * Get stage conversion analysis
 */
router.get('/stage-analysis', async (req: Request, res: Response) => {
  try {
    const pipelineId = req.query.pipelineId as string | undefined;

    const stageConditions = pipelineId 
      ? [eq(crmPipelineStages.pipelineId, pipelineId)]
      : [];

    const stages = await db.select()
      .from(crmPipelineStages)
      .where(stageConditions.length > 0 ? and(...stageConditions) : undefined)
      .orderBy(asc(crmPipelineStages.stageOrder));

    const dealConditions = pipelineId 
      ? [eq(crmDeals.pipelineId, pipelineId)]
      : [];

    const deals = await db.select({
      stageId: crmDeals.stageId,
      stage: crmDeals.stage,
      value: crmDeals.value,
      probability: crmDeals.probability,
      isClosed: crmDeals.isClosed,
      daysInCurrentStage: crmDeals.daysInCurrentStage,
    })
    .from(crmDeals)
    .where(dealConditions.length > 0 ? and(...dealConditions) : undefined);

    const stageAnalysis = stages.map(stage => {
      const stageDeals = deals.filter(d => d.stageId === stage.id || d.stage === stage.name.toLowerCase());
      const openDeals = stageDeals.filter(d => !d.isClosed);
      
      const totalValue = openDeals.reduce((sum, d) => sum + (parseFloat(d.value || '0') || 0), 0);
      const weightedValue = openDeals.reduce((sum, d) => {
        const value = parseFloat(d.value || '0') || 0;
        const prob = (d.probability || stage.probability || 10) / 100;
        return sum + (value * prob);
      }, 0);

      const avgDays = openDeals.length > 0
        ? Math.round(openDeals.reduce((sum, d) => sum + (d.daysInCurrentStage || 0), 0) / openDeals.length)
        : 0;

      return {
        id: stage.id,
        name: stage.name,
        stageOrder: stage.stageOrder,
        defaultProbability: stage.probability || 0,
        color: stage.color,
        dealCount: openDeals.length,
        totalValue,
        weightedValue,
        avgDaysInStage: avgDays,
        slaWarningDays: stage.slaWarningDays,
        slaMaxDays: stage.slaMaxDays,
        dealsAtRisk: stage.slaWarningDays 
          ? openDeals.filter(d => (d.daysInCurrentStage || 0) >= stage.slaWarningDays!).length 
          : 0,
      };
    });

    const totalPipelineValue = stageAnalysis.reduce((sum, s) => sum + s.totalValue, 0);
    const totalWeightedValue = stageAnalysis.reduce((sum, s) => sum + s.weightedValue, 0);
    const totalDeals = stageAnalysis.reduce((sum, s) => sum + s.dealCount, 0);

    res.json({
      stages: stageAnalysis,
      summary: {
        totalStages: stages.length,
        totalDeals,
        totalPipelineValue,
        totalWeightedValue,
      },
    });
  } catch (error) {
    console.error('[Forecasting] Error calculating stage analysis:', error);
    res.status(500).json({ error: 'Failed to calculate stage analysis' });
  }
});

/**
 * GET /api/crm/forecasting/velocity
 * Get deal velocity metrics
 */
router.get('/velocity', async (req: Request, res: Response) => {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const pipelineId = req.query.pipelineId as string | undefined;
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const conditions = [
      eq(crmDeals.stage, 'closed_won'),
      gte(crmDeals.closedAt, startDate),
    ];

    if (pipelineId) {
      conditions.push(eq(crmDeals.pipelineId, pipelineId));
    }

    const wonDeals = await db.select({
      id: crmDeals.id,
      value: crmDeals.value,
      createdAt: crmDeals.createdAt,
      closedAt: crmDeals.closedAt,
    })
    .from(crmDeals)
    .where(and(...conditions));

    const velocityData = wonDeals.map(d => {
      const created = new Date(d.createdAt);
      const closed = new Date(d.closedAt!);
      const daysToClose = Math.round((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      const value = parseFloat(d.value || '0') || 0;
      return {
        id: d.id,
        daysToClose,
        value,
        valuePerDay: daysToClose > 0 ? value / daysToClose : value,
      };
    });

    const avgDaysToClose = velocityData.length > 0
      ? Math.round(velocityData.reduce((sum, d) => sum + d.daysToClose, 0) / velocityData.length)
      : 0;

    const avgDealSize = velocityData.length > 0
      ? velocityData.reduce((sum, d) => sum + d.value, 0) / velocityData.length
      : 0;

    const avgValuePerDay = velocityData.length > 0
      ? velocityData.reduce((sum, d) => sum + d.valuePerDay, 0) / velocityData.length
      : 0;

    const totalWonValue = velocityData.reduce((sum, d) => sum + d.value, 0);
    const monthlyVelocity = totalWonValue / months;

    res.json({
      metrics: {
        avgDaysToClose,
        avgDealSize: Math.round(avgDealSize),
        avgValuePerDay: Math.round(avgValuePerDay),
        monthlyVelocity: Math.round(monthlyVelocity),
        dealsClosed: velocityData.length,
        totalWonValue: Math.round(totalWonValue),
        periodMonths: months,
      },
      distribution: {
        fast: velocityData.filter(d => d.daysToClose <= 30).length,
        medium: velocityData.filter(d => d.daysToClose > 30 && d.daysToClose <= 90).length,
        slow: velocityData.filter(d => d.daysToClose > 90).length,
      },
    });
  } catch (error) {
    console.error('[Forecasting] Error calculating velocity:', error);
    res.status(500).json({ error: 'Failed to calculate velocity' });
  }
});

export default router;
