import { Router, Request, Response, NextFunction } from "express";
import { dealStageHistoryService } from "../services/deal-stage-history-service";
import { contactEngagementService } from "../services/contact-engagement-service";
import { db } from "../db";
import { crmDeals, crmDealEngagementScores, crmContacts, crmActivities, users, crmDealStageHistory, crmContactEngagementScores } from "@shared/schema";
import { eq, desc, and, gte, lte, sql, count, isNotNull } from "drizzle-orm";

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

router.get("/crm/analytics/deal-velocity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.orgId || "org-1";
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const velocityMetrics = await dealStageHistoryService.getStageVelocityMetrics(orgId, start, end);
    
    const conditions = [isNotNull(crmDealStageHistory.exitedAt)];
    if (start) {
      conditions.push(gte(crmDealStageHistory.enteredAt, start));
    }
    if (end) {
      conditions.push(lte(crmDealStageHistory.enteredAt, end));
    }
    
    const monthlyVelocity = await db
      .select({
        month: sql<string>`TO_CHAR(${crmDealStageHistory.enteredAt}, 'YYYY-MM')`.as("month"),
        avgDays: sql<number>`AVG(${crmDealStageHistory.durationBusinessDays})`.as("avg_days"),
        dealCount: count().as("deal_count"),
      })
      .from(crmDealStageHistory)
      .where(and(...conditions))
      .groupBy(sql`TO_CHAR(${crmDealStageHistory.enteredAt}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${crmDealStageHistory.enteredAt}, 'YYYY-MM')`);
    
    res.json({
      ...velocityMetrics,
      velocityTrend: monthlyVelocity.map(m => ({
        period: m.month,
        avgDays: Math.round(m.avgDays || 0),
        dealCount: m.dealCount,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/crm/analytics/win-loss", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.orgId || "org-1";
    const { startDate, endDate } = req.query;
    
    const conditions = [];
    if (startDate) {
      conditions.push(gte(crmDeals.createdAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(crmDeals.createdAt, new Date(endDate as string)));
    }
    
    const deals = await db
      .select()
      .from(crmDeals)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const wonDeals = deals.filter(d => d.stage?.toLowerCase() === "won" || d.outcome === "won");
    const lostDeals = deals.filter(d => d.stage?.toLowerCase() === "lost" || d.outcome === "lost");
    const activeDeals = deals.filter(d => !["won", "lost"].includes(d.stage?.toLowerCase() || "") && !d.outcome);
    
    const totalClosed = wonDeals.length + lostDeals.length;
    const overallWinRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;
    
    const bySource: Record<string, { won: number; lost: number; total: number; winRate: number; value: number }> = {};
    deals.forEach(d => {
      const source = d.source || "Unknown";
      if (!bySource[source]) {
        bySource[source] = { won: 0, lost: 0, total: 0, winRate: 0, value: 0 };
      }
      bySource[source].total++;
      bySource[source].value += Number(d.value) || 0;
      if (d.stage?.toLowerCase() === "won" || d.outcome === "won") {
        bySource[source].won++;
      } else if (d.stage?.toLowerCase() === "lost" || d.outcome === "lost") {
        bySource[source].lost++;
      }
    });
    Object.values(bySource).forEach(s => {
      const closed = s.won + s.lost;
      s.winRate = closed > 0 ? Math.round((s.won / closed) * 100) : 0;
    });
    
    const sizeBuckets = [
      { label: "< $100K", min: 0, max: 100000 },
      { label: "$100K - $500K", min: 100000, max: 500000 },
      { label: "$500K - $1M", min: 500000, max: 1000000 },
      { label: "$1M - $5M", min: 1000000, max: 5000000 },
      { label: "> $5M", min: 5000000, max: Infinity },
    ];
    
    const bySize = sizeBuckets.map(bucket => {
      const bucketDeals = deals.filter(d => {
        const value = Number(d.value) || 0;
        return value >= bucket.min && value < bucket.max;
      });
      const won = bucketDeals.filter(d => d.stage?.toLowerCase() === "won" || d.outcome === "won").length;
      const lost = bucketDeals.filter(d => d.stage?.toLowerCase() === "lost" || d.outcome === "lost").length;
      const closed = won + lost;
      return {
        label: bucket.label,
        won,
        lost,
        total: bucketDeals.length,
        winRate: closed > 0 ? Math.round((won / closed) * 100) : 0,
        totalValue: bucketDeals.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
      };
    });
    
    const userMap = await db.select().from(users);
    const userLookup = new Map(userMap.map(u => [u.id, u.name || u.email || u.id]));
    
    const byUser: Record<string, { name: string; won: number; lost: number; total: number; winRate: number; value: number }> = {};
    deals.forEach(d => {
      const userId = d.ownerId || "unassigned";
      if (!byUser[userId]) {
        byUser[userId] = { name: userLookup.get(userId) || "Unassigned", won: 0, lost: 0, total: 0, winRate: 0, value: 0 };
      }
      byUser[userId].total++;
      byUser[userId].value += Number(d.value) || 0;
      if (d.stage?.toLowerCase() === "won" || d.outcome === "won") {
        byUser[userId].won++;
      } else if (d.stage?.toLowerCase() === "lost" || d.outcome === "lost") {
        byUser[userId].lost++;
      }
    });
    Object.values(byUser).forEach(u => {
      const closed = u.won + u.lost;
      u.winRate = closed > 0 ? Math.round((u.won / closed) * 100) : 0;
    });
    
    const monthlyData: Record<string, { won: number; lost: number; total: number; winRate: number }> = {};
    deals.forEach(d => {
      const month = d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 7) : "Unknown";
      if (!monthlyData[month]) {
        monthlyData[month] = { won: 0, lost: 0, total: 0, winRate: 0 };
      }
      monthlyData[month].total++;
      if (d.stage?.toLowerCase() === "won" || d.outcome === "won") {
        monthlyData[month].won++;
      } else if (d.stage?.toLowerCase() === "lost" || d.outcome === "lost") {
        monthlyData[month].lost++;
      }
    });
    Object.values(monthlyData).forEach(m => {
      const closed = m.won + m.lost;
      m.winRate = closed > 0 ? Math.round((m.won / closed) * 100) : 0;
    });
    
    const lostReasons: Record<string, number> = {};
    lostDeals.forEach(d => {
      const reason = d.lossReason || "Not specified";
      lostReasons[reason] = (lostReasons[reason] || 0) + 1;
    });
    
    res.json({
      summary: {
        totalDeals: deals.length,
        wonDeals: wonDeals.length,
        lostDeals: lostDeals.length,
        activeDeals: activeDeals.length,
        overallWinRate: Math.round(overallWinRate * 10) / 10,
        wonValue: wonDeals.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
        lostValue: lostDeals.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
      },
      bySource: Object.entries(bySource).map(([source, data]) => ({ source, ...data })),
      bySize,
      byUser: Object.entries(byUser).map(([userId, data]) => ({ userId, ...data })),
      byPeriod: Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, data]) => ({ period, ...data })),
      lostReasons: Object.entries(lostReasons)
        .sort(([, a], [, b]) => b - a)
        .map(([reason, count]) => ({ reason, count })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/crm/contacts/engagement-scores", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scores = await db
      .select({
        contactId: crmContactEngagementScores.contactId,
        engagementScore: crmContactEngagementScores.engagementScore,
        emailsOpened: crmContactEngagementScores.emailsOpened,
        emailsClicked: crmContactEngagementScores.emailsClicked,
        emailsSent: crmContactEngagementScores.emailsSent,
        lastInteraction: crmContactEngagementScores.lastInteraction,
      })
      .from(crmContactEngagementScores);
    res.json(scores);
  } catch (error) {
    next(error);
  }
});

router.get("/crm/contacts/:contactId/engagement-score", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contactId } = req.params;
    const score = await contactEngagementService.getEngagementScore(contactId);
    res.json(score);
  } catch (error) {
    next(error);
  }
});

router.post("/crm/contacts/:contactId/recalculate-engagement", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contactId } = req.params;
    const score = await contactEngagementService.recalculateEngagementScore(contactId);
    res.json({ engagementScore: score });
  } catch (error) {
    next(error);
  }
});

router.get("/crm/contacts/:contactId/email-activity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contactId } = req.params;
    const activity = await contactEngagementService.getEmailActivity(contactId);
    res.json(activity);
  } catch (error) {
    next(error);
  }
});

router.get("/crm/emails/tracking-stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.orgId || "org-1";
    const { startDate, endDate } = req.query;
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const conditions = [
      eq(crmActivities.type, "email"),
      gte(crmActivities.createdAt, startDate ? new Date(startDate as string) : ninetyDaysAgo)
    ];
    
    if (endDate) {
      conditions.push(lte(crmActivities.createdAt, new Date(endDate as string)));
    }
    
    const activities = await db
      .select()
      .from(crmActivities)
      .where(and(...conditions))
      .orderBy(desc(crmActivities.createdAt));
    
    const totalSent = activities.length;
    const totalOpened = activities.filter(a => 
      (a.metadata as any)?.opened === true || 
      (a.metadata as any)?.status === "opened" ||
      (a.metadata as any)?.status === "clicked"
    ).length;
    const totalClicked = activities.filter(a => 
      (a.metadata as any)?.clicked === true || 
      (a.metadata as any)?.status === "clicked"
    ).length;
    const totalBounced = activities.filter(a => 
      (a.metadata as any)?.bounced === true || 
      (a.metadata as any)?.status === "bounced"
    ).length;
    
    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
    const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;
    const bounceRate = totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0;
    const clickToOpenRate = totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0;
    
    const byDay: Record<string, { sent: number; opened: number; clicked: number }> = {};
    activities.forEach(a => {
      const day = new Date(a.createdAt).toISOString().slice(0, 10);
      if (!byDay[day]) {
        byDay[day] = { sent: 0, opened: 0, clicked: 0 };
      }
      byDay[day].sent++;
      if ((a.metadata as any)?.opened || (a.metadata as any)?.status === "opened" || (a.metadata as any)?.status === "clicked") {
        byDay[day].opened++;
      }
      if ((a.metadata as any)?.clicked || (a.metadata as any)?.status === "clicked") {
        byDay[day].clicked++;
      }
    });
    
    const uniqueContacts = new Set(activities.map(a => a.contactId).filter(Boolean));
    const uniqueDeals = new Set(activities.filter(a => a.entityType === "deal").map(a => a.entityId));
    
    res.json({
      summary: {
        totalSent,
        totalOpened,
        totalClicked,
        totalBounced,
        openRate,
        clickRate,
        bounceRate,
        clickToOpenRate,
        uniqueContacts: uniqueContacts.size,
        uniqueDeals: uniqueDeals.size,
      },
      trend: Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({
          date,
          ...data,
          openRate: data.sent > 0 ? Math.round((data.opened / data.sent) * 100) : 0,
          clickRate: data.sent > 0 ? Math.round((data.clicked / data.sent) * 100) : 0,
        })),
      recentEmails: activities.slice(0, 20).map(a => ({
        id: a.id,
        subject: (a.metadata as any)?.subject || a.description || "Email",
        contactId: a.contactId,
        entityType: a.entityType,
        entityId: a.entityId,
        sentAt: a.createdAt,
        opened: (a.metadata as any)?.opened || (a.metadata as any)?.status === "opened" || (a.metadata as any)?.status === "clicked",
        clicked: (a.metadata as any)?.clicked || (a.metadata as any)?.status === "clicked",
        openedAt: (a.metadata as any)?.openedAt || null,
        clickedAt: (a.metadata as any)?.clickedAt || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/crm/analytics/pipeline-insights", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.orgId || (req as any).orgId || "org-1";

    const deals = await db.select().from(crmDeals);
    const engagementScores = await db.select().from(crmDealEngagementScores);
    const scoreMap = new Map(engagementScores.map(s => [s.dealId, s]));

    const totalDeals = deals.length;
    let totalPipelineValue = 0;
    let weightedPipelineValue = 0;
    let atRiskCount = 0;
    let healthyCount = 0;
    const stageDistribution: Record<string, { count: number; value: number }> = {};
    const priorityCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    const recentDeals: any[] = [];
    const staleDeals: any[] = [];
    const now = new Date();

    for (const deal of deals) {
      const stage = deal.stage || "unknown";
      const value = Number(deal.value) || 0;
      const score = scoreMap.get(deal.id);
      const probability = score?.winProbability || deal.probability || 10;

      if (!stageDistribution[stage]) stageDistribution[stage] = { count: 0, value: 0 };
      stageDistribution[stage].count++;
      stageDistribution[stage].value += value;

      totalPipelineValue += value;
      weightedPipelineValue += value * (probability / 100);

      if (score && score.engagementScore < 30) atRiskCount++;
      else if (score && score.engagementScore >= 50) healthyCount++;

      const prio = deal.priority || "medium";
      priorityCounts[prio] = (priorityCounts[prio] || 0) + 1;

      const src = deal.dealSource || deal.leadSource || "unknown";
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;

      if (deal.createdAt && (now.getTime() - new Date(deal.createdAt).getTime()) < 30 * 86400000) {
        recentDeals.push({ title: deal.title, stage, value, priority: deal.priority });
      }

      const daysInStage = deal.daysInCurrentStage || 0;
      if (daysInStage > 30 && !["won", "lost", "closed"].includes(stage.toLowerCase())) {
        staleDeals.push({ title: deal.title, stage, daysInStage, value });
      }
    }

    const wonDeals = deals.filter(d => d.stage?.toLowerCase() === "won" || (d as any).outcome === "won");
    const lostDeals = deals.filter(d => d.stage?.toLowerCase() === "lost" || (d as any).outcome === "lost");
    const totalClosed = wonDeals.length + lostDeals.length;
    const winRate = totalClosed > 0 ? Math.round((wonDeals.length / totalClosed) * 100) : 0;

    const pipelineData = {
      totalDeals,
      totalPipelineValue: Math.round(totalPipelineValue),
      weightedPipelineValue: Math.round(weightedPipelineValue),
      atRiskDeals: atRiskCount,
      healthyDeals: healthyCount,
      winRate,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      stageDistribution: Object.entries(stageDistribution).map(([s, d]) => ({ stage: s, count: d.count, value: Math.round(d.value) })),
      priorityBreakdown: priorityCounts,
      sourceBreakdown: sourceCounts,
      recentDealsCount: recentDeals.length,
      staleDeals: staleDeals.slice(0, 10).map(d => ({ title: d.title, stage: d.stage, daysInStage: d.daysInStage, value: d.value })),
    };

    let aiInsights = null;
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `You are a marina acquisition deal pipeline analyst. Analyze this pipeline data and provide actionable insights.

Pipeline Data:
${JSON.stringify(pipelineData, null, 2)}

Respond with ONLY valid JSON in this exact structure:
{
  "healthScore": <number 0-100 representing overall pipeline health>,
  "healthLabel": "<string: Excellent|Good|Fair|Needs Attention|Critical>",
  "summary": "<2-3 sentence executive summary of pipeline state>",
  "trends": [
    {"title": "<trend name>", "description": "<detail>", "direction": "<up|down|stable>", "impact": "<positive|negative|neutral>"}
  ],
  "risks": [
    {"title": "<risk name>", "description": "<detail>", "severity": "<high|medium|low>", "recommendation": "<action to take>"}
  ],
  "opportunities": [
    {"title": "<opportunity name>", "description": "<detail>", "potentialValue": "<estimated impact>", "timeframe": "<short|medium|long>"}
  ],
  "recommendations": [
    {"title": "<action item>", "description": "<detail>", "priority": "<high|medium|low>", "category": "<pipeline|deals|process|engagement>"}
  ]
}

Provide 2-4 items for trends, risks, opportunities, and recommendations. Focus on marina acquisition-specific insights.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a deal pipeline analyst for marina acquisitions. Always respond with valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (content) {
        aiInsights = JSON.parse(content);
      }
    } catch (aiError: any) {
      console.error("[Pipeline Insights] AI analysis failed, using fallback:", aiError.message);
    }

    if (!aiInsights) {
      const healthScore = Math.min(100, Math.max(0,
        (healthyCount / Math.max(totalDeals, 1)) * 40 +
        (winRate / 100) * 30 +
        (1 - atRiskCount / Math.max(totalDeals, 1)) * 30
      ));
      aiInsights = {
        healthScore: Math.round(healthScore),
        healthLabel: healthScore >= 80 ? "Good" : healthScore >= 60 ? "Fair" : "Needs Attention",
        summary: `Your pipeline has ${totalDeals} deals worth $${(totalPipelineValue / 1000000).toFixed(1)}M total, with ${atRiskCount} at-risk deals requiring attention.`,
        trends: [
          { title: "Pipeline Volume", description: `${totalDeals} active deals in the pipeline`, direction: "stable", impact: "neutral" },
          { title: "Win Rate", description: `Current win rate is ${winRate}%`, direction: winRate >= 50 ? "up" : "down", impact: winRate >= 50 ? "positive" : "negative" },
        ],
        risks: staleDeals.slice(0, 3).map(d => ({
          title: `Stale Deal: ${d.title}`,
          description: `${d.daysInStage} days in ${d.stage} stage`,
          severity: d.daysInStage > 60 ? "high" : "medium",
          recommendation: "Review and update or archive this deal",
        })),
        opportunities: [],
        recommendations: [
          { title: "Review At-Risk Deals", description: `${atRiskCount} deals have low engagement scores`, priority: "high", category: "engagement" },
        ],
      };
    }

    res.json({
      pipelineData,
      insights: aiInsights,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
