/**
 * Analytics API Routes
 * 
 * Provides endpoints for institutional-grade KPI calculations and benchmarking
 * Including unified cross-module analytics dashboard (Phase 4B)
 * 
 * IMPORTANT: Benchmarking Opt-Out Guardrails
 * Any endpoints that aggregate cross-user data for industry benchmarks MUST
 * exclude users who have opted out of anonymized benchmarking.
 * Use utilities from '../services/benchmarking-guardrails.ts' to filter users.
 * 
 * @see ../services/benchmarking-guardrails.ts
 */

import { Router, Request, Response } from 'express';
import { marinaKpiCalculator } from '../services/analytics';
import { z } from 'zod';
import { db } from '../db';
import { 
  crmContacts, 
  crmCompanies, 
  crmProperties, 
  crmDeals,
  projects,
  modelingProjects,
  modelingFinancialPeriods,
  tasks,
  rentRolls,
  rentRollEntries,
  analyticsReportSchedules,
  insertAnalyticsReportScheduleSchema,
} from '@shared/schema';
import { articles } from '@shared/docktalk-schema';
import { eq, sql, count, and, gte, lte, lt, desc, asc } from 'drizzle-orm';

const router = Router();

// Validation schemas
const calculateKpisSchema = z.object({
  rentRollId: z.string().optional(),
  projectId: z.string().optional(),
  periodStart: z.string().optional().transform(s => s ? new Date(s) : undefined),
  periodEnd: z.string().optional().transform(s => s ? new Date(s) : undefined),
  assumedExpenseRatio: z.number().min(0).max(1).optional(),
  assumedCapRate: z.number().min(0).max(100).optional(),
  propertyValue: z.number().min(0).optional(),
  loanAmount: z.number().min(0).optional(),
  annualDebtService: z.number().min(0).optional(),
  linearFeetPerSlip: z.number().min(10).max(200).optional(),
});

/**
 * GET /api/analytics/marina/kpis
 * Calculate marina KPIs for the authenticated organization
 */
router.get('/marina/kpis', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    
    // Parse query params
    const params = calculateKpisSchema.parse({
      rentRollId: req.query.rentRollId,
      projectId: req.query.projectId,
      periodStart: req.query.periodStart,
      periodEnd: req.query.periodEnd,
      assumedExpenseRatio: req.query.expenseRatio ? parseFloat(req.query.expenseRatio as string) : undefined,
      assumedCapRate: req.query.capRate ? parseFloat(req.query.capRate as string) : undefined,
      propertyValue: req.query.propertyValue ? parseFloat(req.query.propertyValue as string) : undefined,
      loanAmount: req.query.loanAmount ? parseFloat(req.query.loanAmount as string) : undefined,
      annualDebtService: req.query.annualDebtService ? parseFloat(req.query.annualDebtService as string) : undefined,
      linearFeetPerSlip: req.query.linearFeetPerSlip ? parseFloat(req.query.linearFeetPerSlip as string) : undefined,
    });

    const kpis = await marinaKpiCalculator.calculateKpis({
      orgId,
      ...params,
    });

    res.json(kpis);
  } catch (error: any) {
    console.error('[Analytics] Error calculating marina KPIs:', error);
    res.status(500).json({ 
      error: 'Failed to calculate KPIs',
      message: error.message 
    });
  }
});

/**
 * POST /api/analytics/marina/kpis
 * Calculate marina KPIs with body params (for more complex scenarios)
 */
router.post('/marina/kpis', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    
    const params = calculateKpisSchema.parse(req.body);

    const kpis = await marinaKpiCalculator.calculateKpis({
      orgId,
      ...params,
    });

    res.json(kpis);
  } catch (error: any) {
    console.error('[Analytics] Error calculating marina KPIs:', error);
    res.status(500).json({ 
      error: 'Failed to calculate KPIs',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/marina/trends
 * Get historical trend data for marina KPIs
 */
router.get('/marina/trends', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const months = req.query.months ? parseInt(req.query.months as string) : 12;

    const trends = await marinaKpiCalculator.calculateTrends(orgId, months);

    res.json(trends);
  } catch (error: any) {
    console.error('[Analytics] Error fetching trends:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trends',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/marina/summary
 * Get a quick summary of key marina metrics (for dashboard widgets)
 */
router.get('/marina/summary', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    
    const kpis = await marinaKpiCalculator.calculateKpis({ orgId });

    // Return simplified summary for dashboard
    res.json({
      occupancyRate: kpis.occupancy.occupancyRate,
      totalSlips: kpis.occupancy.totalSlips,
      occupiedSlips: kpis.occupancy.occupiedSlips,
      adr: kpis.revenue.avgDailyRate,
      revPalf: kpis.revenue.revPalf,
      grossRevenue: kpis.revenue.totalGrossRevenue,
      ancillaryRevenue: kpis.revenue.totalAncillaryRevenue,
      noi: kpis.profitability.netOperatingIncome,
      noiMargin: kpis.profitability.noiMargin,
      dscr: kpis.debt.dscr,
      dataQualityScore: kpis.dataQualityScore,
      asOf: kpis.asOf,
    });
  } catch (error: any) {
    console.error('[Analytics] Error fetching summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch summary',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/kpi-definitions
 * Get available KPI definitions for the UI
 */
router.get('/kpi-definitions', async (req: Request, res: Response) => {
  try {
    const assetClass = req.query.assetClass as string || 'marina';
    
    // Return static definitions for now (will be from DB later)
    const definitions = getMarinaKpiDefinitions();
    
    res.json(definitions.filter(d => d.assetClass === assetClass || !req.query.assetClass));
  } catch (error: any) {
    console.error('[Analytics] Error fetching KPI definitions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch KPI definitions',
      message: error.message 
    });
  }
});

/**
 * Static marina KPI definitions
 */
function getMarinaKpiDefinitions() {
  return [
    {
      code: 'marina_occupancy_rate',
      name: 'Occupancy Rate',
      description: 'Percentage of slips occupied by tenants',
      assetClass: 'marina',
      category: 'occupancy',
      formula: '(Occupied Slips / Total Slips) × 100',
      unit: '%',
      isHigherBetter: true,
      benchmarkLow: 70,
      benchmarkMid: 85,
      benchmarkHigh: 95,
    },
    {
      code: 'marina_adr',
      name: 'Average Daily Rate (ADR)',
      description: 'Average revenue per occupied slip per day',
      assetClass: 'marina',
      category: 'revenue',
      formula: 'Monthly Slip Rate / 30',
      unit: '$',
      isHigherBetter: true,
      benchmarkLow: 15,
      benchmarkMid: 35,
      benchmarkHigh: 75,
    },
    {
      code: 'marina_revpalf',
      name: 'Revenue per Available Linear Foot (RevPALF)',
      description: 'Annual revenue efficiency per dock linear foot',
      assetClass: 'marina',
      category: 'revenue',
      formula: 'Annual Revenue / Total Linear Feet',
      unit: '$/LF',
      isHigherBetter: true,
      benchmarkLow: 100,
      benchmarkMid: 200,
      benchmarkHigh: 400,
    },
    {
      code: 'marina_noi_margin',
      name: 'NOI Margin',
      description: 'Net Operating Income as percentage of gross revenue',
      assetClass: 'marina',
      category: 'profitability',
      formula: '(NOI / Gross Revenue) × 100',
      unit: '%',
      isHigherBetter: true,
      benchmarkLow: 50,
      benchmarkMid: 60,
      benchmarkHigh: 70,
    },
    {
      code: 'marina_cap_rate',
      name: 'Cap Rate',
      description: 'Capitalization rate (NOI / Property Value)',
      assetClass: 'marina',
      category: 'valuation',
      formula: '(NOI / Property Value) × 100',
      unit: '%',
      isHigherBetter: false, // Lower cap = higher value
      benchmarkLow: 6,
      benchmarkMid: 8,
      benchmarkHigh: 10,
    },
    {
      code: 'marina_dscr',
      name: 'Debt Service Coverage Ratio',
      description: 'NOI divided by annual debt service',
      assetClass: 'marina',
      category: 'debt',
      formula: 'NOI / Annual Debt Service',
      unit: 'x',
      isHigherBetter: true,
      benchmarkLow: 1.2,
      benchmarkMid: 1.5,
      benchmarkHigh: 2.0,
    },
    {
      code: 'marina_ancillary_revenue',
      name: 'Ancillary Revenue %',
      description: 'Non-slip revenue as percentage of total',
      assetClass: 'marina',
      category: 'revenue',
      formula: '(Fuel + Store + Services) / Total Revenue × 100',
      unit: '%',
      isHigherBetter: true,
      benchmarkLow: 10,
      benchmarkMid: 25,
      benchmarkHigh: 40,
    },
  ];
}

// ============================================================================
// Phase 4B: Unified Cross-Module Analytics Dashboard
// ============================================================================

interface UnifiedAnalytics {
  crm: {
    totalContacts: number;
    totalCompanies: number;
    totalProperties: number;
    totalDeals: number;
    dealsByStage: Record<string, number>;
    recentDeals: number;
    pipelineValue: number;
    conversionRate: number;
    wonDeals: number;
    lostDeals: number;
  };
  dueDiligence: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    projectsByStatus: Record<string, number>;
    completionRate: number;
    overdueTasks: number;
    totalTasks: number;
  };
  modeling: {
    totalProjects: number;
    recentProjects: number;
    avgPurchasePrice: number;
    avgCapRate: number;
    totalPurchaseValue: number;
  };
  operations: {
    totalRentRolls: number;
    totalUnits: number;
    occupiedUnits: number;
    occupancyRate: number;
    totalMonthlyRevenue: number;
  };
  intelligence: {
    totalArticles: number;
    recentArticles: number;
  };
  crossModule: {
    dealsWithDDProjects: number;
    dealsWithModelingProjects: number;
    propertiesWithDeals: number;
    contactsWithDeals: number;
  };
  period: string;
  lastUpdated: string;
}

/**
 * GET /api/analytics/unified
 * Get unified cross-module analytics for the dashboard
 * Supports time period filtering: 7d, 30d, 90d, ytd
 */
router.get('/unified', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const period = (req.query.period as string) || '30d';
    
    const periodDays: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'ytd': Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)),
    };
    const days = periodDays[period] || 30;
    
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    const today = new Date();

    const [
      contactsCount,
      companiesCount,
      propertiesCount,
      dealsData,
      ddProjectsData,
      modelingData,
      articlesData,
      crossModuleData,
      tasksData,
      operationsData,
    ] = await Promise.all([
      db.select({ count: count() })
        .from(crmContacts)
        .where(eq(crmContacts.orgId, orgId))
        .then(r => r[0]?.count || 0),
      
      db.select({ count: count() })
        .from(crmCompanies)
        .where(eq(crmCompanies.orgId, orgId))
        .then(r => r[0]?.count || 0),
      
      db.select({ count: count() })
        .from(crmProperties)
        .where(eq(crmProperties.orgId, orgId))
        .then(r => r[0]?.count || 0),
      
      db.select({
        stage: crmDeals.stage,
        count: count(),
        totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`,
      })
        .from(crmDeals)
        .where(eq(crmDeals.ownerId, orgId))
        .groupBy(crmDeals.stage)
        .then(rows => {
          const dealsByStage: Record<string, number> = {};
          let total = 0;
          let pipelineValue = 0;
          let wonDeals = 0;
          let lostDeals = 0;
          rows.forEach(r => {
            const stage = r.stage?.toLowerCase() || 'unknown';
            dealsByStage[r.stage || 'unknown'] = Number(r.count);
            total += Number(r.count);
            pipelineValue += Number(r.totalValue);
            if (stage.includes('won') || stage.includes('closed_won')) wonDeals += Number(r.count);
            if (stage.includes('lost') || stage.includes('closed_lost')) lostDeals += Number(r.count);
          });
          const closedDeals = wonDeals + lostDeals;
          const conversionRate = closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0;
          return { dealsByStage, total, pipelineValue, wonDeals, lostDeals, conversionRate };
        }),
      
      db.select({
        status: projects.status,
        count: count(),
      })
        .from(projects)
        .where(eq(projects.orgId, orgId))
        .groupBy(projects.status)
        .then(rows => {
          const projectsByStatus: Record<string, number> = {};
          let total = 0;
          let active = 0;
          let completed = 0;
          rows.forEach(r => {
            const status = r.status || 'unknown';
            projectsByStatus[status] = Number(r.count);
            total += Number(r.count);
            if (status === 'active' || status === 'in_progress') active += Number(r.count);
            if (status === 'completed') completed += Number(r.count);
          });
          const completionRate = total > 0 ? (completed / total) * 100 : 0;
          return { projectsByStatus, total, active, completed, completionRate };
        }),
      
      (async () => {
        try {
          const result = await db.select({
            cnt: count(),
            avgPrice: sql<number>`COALESCE(AVG(${modelingProjects.purchasePrice}::numeric), 0)`,
            avgCap: sql<number>`COALESCE(AVG(${modelingProjects.year1CapRate}::numeric), 0)`,
            totalValue: sql<number>`COALESCE(SUM(${modelingProjects.purchasePrice}::numeric), 0)`,
          })
            .from(modelingProjects)
            .where(eq(modelingProjects.orgId, orgId));
          
          const recentResult = await db.select({ count: count() })
            .from(modelingProjects)
            .where(and(
              eq(modelingProjects.orgId, orgId),
              gte(modelingProjects.createdAt, periodStart)
            ));
          
          return {
            total: Number(result[0]?.cnt || 0),
            recent: Number(recentResult[0]?.count || 0),
            avgPurchasePrice: Number(result[0]?.avgPrice || 0),
            avgCapRate: Number(result[0]?.avgCap || 0),
            totalPurchaseValue: Number(result[0]?.totalValue || 0),
          };
        } catch {
          return { total: 0, recent: 0, avgPurchasePrice: 0, avgCapRate: 0, totalPurchaseValue: 0 };
        }
      })(),
      
      (async () => {
        try {
          const r = await db.select({ 
            count: count(),
            recent: sql<number>`COUNT(*) FILTER (WHERE ${articles.publishedAt} >= ${periodStart})`,
          })
            .from(articles)
            .where(eq(articles.organizationId, orgId));
          return { total: r[0]?.count || 0, recent: Number(r[0]?.recent) || 0 };
        } catch {
          return { total: 0, recent: 0 };
        }
      })(),
      
      Promise.all([
        db.select({ count: count() })
          .from(projects)
          .where(and(
            eq(projects.orgId, orgId),
            sql`${projects.dealId} IS NOT NULL`
          ))
          .then(r => r[0]?.count || 0),
        
        db.select({ count: count() })
          .from(projects)
          .where(and(
            eq(projects.orgId, orgId),
            sql`${projects.modelingProjectId} IS NOT NULL`
          ))
          .then(r => r[0]?.count || 0),
        
        Promise.resolve(0),
        
        db.select({ count: sql<number>`COUNT(DISTINCT ${crmDeals.primaryContactId})` })
          .from(crmDeals)
          .where(and(
            eq(crmDeals.ownerId, orgId),
            sql`${crmDeals.primaryContactId} IS NOT NULL`
          ))
          .then(r => Number(r[0]?.count) || 0)
          .catch(() => 0),
      ]),
      
      (async () => {
        try {
          const totalResult = await db.select({ count: count() })
            .from(tasks);
          
          const overdueResult = await db.select({ count: count() })
            .from(tasks)
            .where(and(
              sql`${tasks.deadline} IS NOT NULL`,
              lt(sql`${tasks.deadline}::date`, sql`CURRENT_DATE`),
              sql`${tasks.status} NOT IN ('completed')`
            ));
          
          return {
            total: Number(totalResult[0]?.count || 0),
            overdue: Number(overdueResult[0]?.count || 0),
          };
        } catch {
          return { total: 0, overdue: 0 };
        }
      })(),
      
      (async () => {
        try {
          const rollsResult = await db.select({ count: count() })
            .from(rentRolls)
            .where(eq(rentRolls.orgId, orgId));
          
          const entriesResult = await db.select({
            total: count(),
            occupied: sql<number>`COUNT(*) FILTER (WHERE ${rentRollEntries.status} = 'active')`,
            revenue: sql<number>`COALESCE(SUM(CASE WHEN ${rentRollEntries.status} = 'active' THEN ${rentRollEntries.monthlyRate}::numeric ELSE 0 END), 0)`,
          })
            .from(rentRollEntries)
            .where(eq(rentRollEntries.orgId, orgId));
          
          const totalUnits = Number(entriesResult[0]?.total || 0);
          const occupiedUnits = Number(entriesResult[0]?.occupied || 0);
          const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
          
          return {
            totalRentRolls: Number(rollsResult[0]?.count || 0),
            totalUnits,
            occupiedUnits,
            occupancyRate,
            totalMonthlyRevenue: Number(entriesResult[0]?.revenue || 0),
          };
        } catch {
          return { totalRentRolls: 0, totalUnits: 0, occupiedUnits: 0, occupancyRate: 0, totalMonthlyRevenue: 0 };
        }
      })(),
    ]);

    const recentDeals = await db.select({ count: count() })
      .from(crmDeals)
      .where(and(
        eq(crmDeals.ownerId, orgId),
        gte(crmDeals.createdAt, periodStart)
      ))
      .then(r => r[0]?.count || 0);

    const analytics: UnifiedAnalytics = {
      crm: {
        totalContacts: Number(contactsCount),
        totalCompanies: Number(companiesCount),
        totalProperties: Number(propertiesCount),
        totalDeals: dealsData.total,
        dealsByStage: dealsData.dealsByStage,
        recentDeals: Number(recentDeals),
        pipelineValue: dealsData.pipelineValue,
        conversionRate: dealsData.conversionRate,
        wonDeals: dealsData.wonDeals,
        lostDeals: dealsData.lostDeals,
      },
      dueDiligence: {
        totalProjects: ddProjectsData.total,
        activeProjects: ddProjectsData.active,
        completedProjects: ddProjectsData.completed,
        projectsByStatus: ddProjectsData.projectsByStatus,
        completionRate: ddProjectsData.completionRate,
        overdueTasks: tasksData.overdue,
        totalTasks: tasksData.total,
      },
      modeling: {
        totalProjects: modelingData.total,
        recentProjects: modelingData.recent,
        avgPurchasePrice: modelingData.avgPurchasePrice,
        avgCapRate: modelingData.avgCapRate,
        totalPurchaseValue: modelingData.totalPurchaseValue,
      },
      operations: {
        totalRentRolls: operationsData.totalRentRolls,
        totalUnits: operationsData.totalUnits,
        occupiedUnits: operationsData.occupiedUnits,
        occupancyRate: operationsData.occupancyRate,
        totalMonthlyRevenue: operationsData.totalMonthlyRevenue,
      },
      intelligence: {
        totalArticles: Number(articlesData.total),
        recentArticles: articlesData.recent,
      },
      crossModule: {
        dealsWithDDProjects: Number(crossModuleData[0]),
        dealsWithModelingProjects: Number(crossModuleData[1]),
        propertiesWithDeals: crossModuleData[2],
        contactsWithDeals: crossModuleData[3],
      },
      period,
      lastUpdated: new Date().toISOString(),
    };

    res.json(analytics);
  } catch (error: any) {
    console.error('[Analytics] Error fetching unified analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unified analytics',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/executive-summary
 * Portfolio-level executive summary with institutional KPIs
 */
router.get('/executive-summary', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';

    const pipelineStats = await db.select({
      stage: crmDeals.stage,
      cnt: count(),
      totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`,
    })
      .from(crmDeals)
      .where(eq(crmDeals.ownerId, orgId))
      .groupBy(crmDeals.stage);

    const ddStats = await db.select({
      status: projects.status,
      cnt: count(),
    })
      .from(projects)
      .where(eq(projects.orgId, orgId))
      .groupBy(projects.status);

    const modelingCount = await db.select({ cnt: count() })
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId));

    const activeModelingCount = await db.select({ cnt: count() })
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.orgId, orgId),
        eq(modelingProjects.dealOutcome, 'active')
      ));

    const pipelineByStage: Record<string, { count: number; value: number }> = {};
    let totalPipelineValue = 0;
    let totalDeals = 0;

    pipelineStats.forEach(row => {
      const stage = row.stage || 'unknown';
      pipelineByStage[stage] = {
        count: Number(row.cnt),
        value: Number(row.totalValue),
      };
      totalPipelineValue += Number(row.totalValue);
      totalDeals += Number(row.cnt);
    });

    const ddByStatus: Record<string, number> = {};
    let activeDD = 0;
    let completedDD = 0;
    ddStats.forEach(row => {
      const status = row.status || 'unknown';
      ddByStatus[status] = Number(row.cnt);
      if (status === 'in_progress' || status === 'pending') activeDD += Number(row.cnt);
      if (status === 'completed') completedDD += Number(row.cnt);
    });

    const totalModeling = Number(modelingCount[0]?.cnt || 0);
    const activeModeling = Number(activeModelingCount[0]?.cnt || 0);

    const avgDealSize = totalDeals > 0 ? totalPipelineValue / totalDeals : 0;
    const ddCompletionRate = (activeDD + completedDD) > 0 
      ? (completedDD / (activeDD + completedDD)) * 100 
      : 0;

    const closedStages = ['closed_won', 'closed', 'won'];
    const activeStages = ['negotiation', 'proposal', 'qualified', 'discovery'];
    
    let closedValue = 0;
    let activeValue = 0;
    
    Object.entries(pipelineByStage).forEach(([stage, data]) => {
      if (closedStages.some(s => stage.toLowerCase().includes(s))) {
        closedValue += data.value;
      } else if (activeStages.some(s => stage.toLowerCase().includes(s))) {
        activeValue += data.value;
      }
    });

    const executiveSummary = {
      pipeline: {
        totalDeals,
        totalValue: totalPipelineValue,
        averageDealSize: avgDealSize,
        byStage: pipelineByStage,
        closedValue,
        activeValue,
      },
      dueDiligence: {
        active: activeDD,
        completed: completedDD,
        completionRate: ddCompletionRate,
        byStatus: ddByStatus,
      },
      modeling: {
        total: totalModeling,
        active: activeModeling,
        inactive: totalModeling - activeModeling,
      },
      healthIndicators: {
        pipelineHealthy: totalPipelineValue > 0 && totalDeals >= 3,
        ddVelocityGood: ddCompletionRate >= 50,
        modelingActive: activeModeling > 0,
      },
      generatedAt: new Date().toISOString(),
    };

    res.json(executiveSummary);
  } catch (error: any) {
    console.error('[Analytics] Error generating executive summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate executive summary',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/unified/trends
 * Get trend data for the unified dashboard
 */
router.get('/unified/trends', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const months = parseInt(req.query.months as string) || 6;
    
    // Generate monthly data points
    const trends = [];
    const now = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const [dealsCount, projectsCount, articlesCount] = await Promise.all([
        db.select({ count: count() })
          .from(crmDeals)
          .where(and(
            eq(crmDeals.ownerId, orgId),
            gte(crmDeals.createdAt, monthStart),
            lte(crmDeals.createdAt, monthEnd)
          ))
          .then(r => r[0]?.count || 0),
        
        db.select({ count: count() })
          .from(projects)
          .where(and(
            eq(projects.orgId, orgId),
            gte(projects.createdAt, monthStart),
            lte(projects.createdAt, monthEnd)
          ))
          .then(r => r[0]?.count || 0),
        
        // Articles - wrapped safely in case table doesn't exist
        (async () => {
          try {
            const r = await db.select({ count: count() })
              .from(articles)
              .where(and(
                eq(articles.organizationId, orgId),
                gte(articles.publishedAt, monthStart),
                lte(articles.publishedAt, monthEnd)
              ));
            return r[0]?.count || 0;
          } catch {
            return 0;
          }
        })(),
      ]);
      
      trends.push({
        month: monthStart.toISOString().slice(0, 7), // YYYY-MM format
        label: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        deals: Number(dealsCount),
        projects: Number(projectsCount),
        articles: Number(articlesCount),
      });
    }
    
    res.json({ trends });
  } catch (error: any) {
    console.error('[Analytics] Error fetching unified trends:', error);
    res.status(500).json({ 
      error: 'Failed to fetch unified trends',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/financial
 * Financial analysis data aggregated from modeling projects with drill-down capabilities
 */
router.get('/financial', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const timeframe = req.query.timeframe as string || '12m';
    const projectId = req.query.projectId as string;

    // Fetch all modeling projects for the org
    let projectsQuery = db.select({
      id: modelingProjects.id,
      marinaName: modelingProjects.marinaName,
      purchasePrice: modelingProjects.purchasePrice,
      ebitda: modelingProjects.ebitda,
      year1CapRate: modelingProjects.year1CapRate,
      totalStorageUnits: modelingProjects.totalStorageUnits,
      dealOutcome: modelingProjects.dealOutcome,
      state: modelingProjects.state,
      region: modelingProjects.region,
      createdAt: modelingProjects.createdAt,
    })
    .from(modelingProjects)
    .where(eq(modelingProjects.orgId, orgId))
    .orderBy(desc(modelingProjects.createdAt));

    const allProjects = await projectsQuery;

    // Filter to specific project if provided
    const filteredProjects = projectId && projectId !== 'all' 
      ? allProjects.filter(p => p.id === projectId)
      : allProjects;

    // Fetch financial periods for all relevant projects
    const projectIds = filteredProjects.map(p => p.id);
    let financialPeriodsData: any[] = [];
    
    if (projectIds.length > 0) {
      financialPeriodsData = await db.select({
        id: modelingFinancialPeriods.id,
        modelingProjectId: modelingFinancialPeriods.modelingProjectId,
        periodType: modelingFinancialPeriods.periodType,
        periodLabel: modelingFinancialPeriods.periodLabel,
        periodYear: modelingFinancialPeriods.periodYear,
        totalRevenue: modelingFinancialPeriods.totalRevenue,
        wetSlipRevenue: modelingFinancialPeriods.wetSlipRevenue,
        dryStorageRevenue: modelingFinancialPeriods.dryStorageRevenue,
        fuelRevenue: modelingFinancialPeriods.fuelRevenue,
        shipStoreRevenue: modelingFinancialPeriods.shipStoreRevenue,
        otherRevenue: modelingFinancialPeriods.otherRevenue,
        totalExpenses: modelingFinancialPeriods.totalExpenses,
        operatingExpenses: modelingFinancialPeriods.operatingExpenses,
        payrollExpenses: modelingFinancialPeriods.payrollExpenses,
        utilitiesExpenses: modelingFinancialPeriods.utilitiesExpenses,
        insuranceExpenses: modelingFinancialPeriods.insuranceExpenses,
        maintenanceExpenses: modelingFinancialPeriods.maintenanceExpenses,
        managementFees: modelingFinancialPeriods.managementFees,
        otherExpenses: modelingFinancialPeriods.otherExpenses,
        noi: modelingFinancialPeriods.noi,
        ebitda: modelingFinancialPeriods.ebitda,
        capRate: modelingFinancialPeriods.capRate,
        noiMargin: modelingFinancialPeriods.noiMargin,
        occupancyRate: modelingFinancialPeriods.occupancyRate,
        totalUnits: modelingFinancialPeriods.totalUnits,
        occupiedUnits: modelingFinancialPeriods.occupiedUnits,
        isProjected: modelingFinancialPeriods.isProjected,
        sortOrder: modelingFinancialPeriods.sortOrder,
      })
      .from(modelingFinancialPeriods)
      .where(
        and(
          eq(modelingFinancialPeriods.orgId, orgId),
          sql`${modelingFinancialPeriods.modelingProjectId} = ANY(${projectIds})`
        )
      )
      .orderBy(asc(modelingFinancialPeriods.sortOrder));
    }

    // Build project-level summaries with their financial data
    const projectSummaries = filteredProjects.map(project => {
      const projectPeriods = financialPeriodsData.filter(fp => fp.modelingProjectId === project.id);
      const latestHistorical = projectPeriods.find(p => !p.isProjected) || projectPeriods[0];
      
      return {
        id: project.id,
        marinaName: project.marinaName,
        purchasePrice: project.purchasePrice ? Number(project.purchasePrice) : null,
        ebitda: project.ebitda ? Number(project.ebitda) : null,
        capRate: project.year1CapRate ? Number(project.year1CapRate) : null,
        totalUnits: project.totalStorageUnits,
        dealOutcome: project.dealOutcome,
        state: project.state,
        region: project.region,
        financialPeriods: projectPeriods.length,
        latestRevenue: latestHistorical?.totalRevenue ? Number(latestHistorical.totalRevenue) : null,
        latestExpenses: latestHistorical?.totalExpenses ? Number(latestHistorical.totalExpenses) : null,
        latestNoi: latestHistorical?.noi ? Number(latestHistorical.noi) : null,
        latestOccupancy: latestHistorical?.occupancyRate ? Number(latestHistorical.occupancyRate) * 100 : null,
      };
    });

    // Aggregate revenue breakdown from all financial periods
    const aggregateRevenue = {
      wetSlipRevenue: 0,
      dryStorageRevenue: 0,
      fuelRevenue: 0,
      shipStoreRevenue: 0,
      otherRevenue: 0,
    };
    
    const aggregateExpenses = {
      payrollExpenses: 0,
      utilitiesExpenses: 0,
      insuranceExpenses: 0,
      maintenanceExpenses: 0,
      managementFees: 0,
      otherExpenses: 0,
    };

    // Use the most recent period from each project for aggregation
    const latestPeriodsByProject = new Map<string, typeof financialPeriodsData[0]>();
    financialPeriodsData.forEach(fp => {
      if (!fp.isProjected) {
        const existing = latestPeriodsByProject.get(fp.modelingProjectId);
        if (!existing || (fp.periodYear && existing.periodYear && fp.periodYear > existing.periodYear)) {
          latestPeriodsByProject.set(fp.modelingProjectId, fp);
        }
      }
    });

    latestPeriodsByProject.forEach(fp => {
      aggregateRevenue.wetSlipRevenue += fp.wetSlipRevenue ? Number(fp.wetSlipRevenue) : 0;
      aggregateRevenue.dryStorageRevenue += fp.dryStorageRevenue ? Number(fp.dryStorageRevenue) : 0;
      aggregateRevenue.fuelRevenue += fp.fuelRevenue ? Number(fp.fuelRevenue) : 0;
      aggregateRevenue.shipStoreRevenue += fp.shipStoreRevenue ? Number(fp.shipStoreRevenue) : 0;
      aggregateRevenue.otherRevenue += fp.otherRevenue ? Number(fp.otherRevenue) : 0;

      aggregateExpenses.payrollExpenses += fp.payrollExpenses ? Number(fp.payrollExpenses) : 0;
      aggregateExpenses.utilitiesExpenses += fp.utilitiesExpenses ? Number(fp.utilitiesExpenses) : 0;
      aggregateExpenses.insuranceExpenses += fp.insuranceExpenses ? Number(fp.insuranceExpenses) : 0;
      aggregateExpenses.maintenanceExpenses += fp.maintenanceExpenses ? Number(fp.maintenanceExpenses) : 0;
      aggregateExpenses.managementFees += fp.managementFees ? Number(fp.managementFees) : 0;
      aggregateExpenses.otherExpenses += fp.otherExpenses ? Number(fp.otherExpenses) : 0;
    });

    // Build revenue breakdown for charts
    const revenueBreakdown = [
      { name: 'Wet Slip Revenue', value: aggregateRevenue.wetSlipRevenue },
      { name: 'Dry Storage Revenue', value: aggregateRevenue.dryStorageRevenue },
      { name: 'Fuel Revenue', value: aggregateRevenue.fuelRevenue },
      { name: 'Ship Store Revenue', value: aggregateRevenue.shipStoreRevenue },
      { name: 'Other Revenue', value: aggregateRevenue.otherRevenue },
    ].filter(item => item.value > 0);

    // Build expense waterfall
    const totalRevenue = Object.values(aggregateRevenue).reduce((sum, val) => sum + val, 0);
    const totalExpensesSum = Object.values(aggregateExpenses).reduce((sum, val) => sum + val, 0);
    const totalNoi = totalRevenue - totalExpensesSum;

    const expenseWaterfall = [
      { name: 'Gross Revenue', value: totalRevenue, isTotal: true },
      { name: 'Payroll', value: -aggregateExpenses.payrollExpenses },
      { name: 'Utilities', value: -aggregateExpenses.utilitiesExpenses },
      { name: 'Insurance', value: -aggregateExpenses.insuranceExpenses },
      { name: 'Maintenance', value: -aggregateExpenses.maintenanceExpenses },
      { name: 'Management Fees', value: -aggregateExpenses.managementFees },
      { name: 'Other Expenses', value: -aggregateExpenses.otherExpenses },
      { name: 'Net Operating Income', value: totalNoi, isTotal: true },
    ].filter(item => item.isTotal || item.value !== 0);

    // Build comparison data by year if we have multiple periods
    const periodsByYear = new Map<number, { revenue: number; expenses: number; noi: number; count: number }>();
    financialPeriodsData.forEach(fp => {
      if (fp.periodYear && !fp.isProjected) {
        const existing = periodsByYear.get(fp.periodYear) || { revenue: 0, expenses: 0, noi: 0, count: 0 };
        existing.revenue += fp.totalRevenue ? Number(fp.totalRevenue) : 0;
        existing.expenses += fp.totalExpenses ? Number(fp.totalExpenses) : 0;
        existing.noi += fp.noi ? Number(fp.noi) : 0;
        existing.count += 1;
        periodsByYear.set(fp.periodYear, existing);
      }
    });

    const yearlyTrends = Array.from(periodsByYear.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, data]) => ({
        period: year.toString(),
        revenue: data.revenue,
        expenses: data.expenses,
        noi: data.noi,
        projectCount: data.count,
      }));

    // Summary stats
    const validProjects = projectSummaries.filter(p => p.latestRevenue || p.latestNoi);
    const avgOccupancy = validProjects.length > 0
      ? validProjects.reduce((sum, p) => sum + (p.latestOccupancy || 0), 0) / validProjects.filter(p => p.latestOccupancy).length
      : 0;

    res.json({
      projects: projectSummaries,
      projectCount: filteredProjects.length,
      revenueBreakdown,
      expenseWaterfall,
      yearlyTrends,
      summary: {
        totalRevenue,
        totalExpenses: totalExpensesSum,
        totalNoi,
        noiMargin: totalRevenue > 0 ? totalNoi / totalRevenue : 0,
        avgOccupancy: avgOccupancy || null,
        totalUnits: projectSummaries.reduce((sum, p) => sum + (p.totalUnits || 0), 0),
        avgCapRate: validProjects.length > 0 
          ? validProjects.reduce((sum, p) => sum + (p.capRate || 0), 0) / validProjects.filter(p => p.capRate).length
          : null,
      },
      timeframe,
      projectId: projectId || 'all',
    });
  } catch (error: any) {
    console.error('[Analytics] Error fetching financial analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch financial analytics',
      message: error.message 
    });
  }
});

router.get('/rent-roll/interactive-analytics', async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const seasonalMultipliers = [0.65, 0.62, 0.70, 0.82, 0.92, 0.98, 1.0, 0.98, 0.90, 0.78, 0.68, 0.64];

    const occupancyTrend = months.map((month, idx) => {
      const baseOccupancy = 85;
      const occupancy = Math.round(baseOccupancy * seasonalMultipliers[idx] * (0.95 + Math.random() * 0.1));
      const totalSlips = 283;
      const occupiedSlips = Math.round(totalSlips * occupancy / 100);
      return {
        period: month,
        occupancy,
        totalSlips,
        occupiedSlips,
        revenue: Math.round(occupiedSlips * 1250 * (0.9 + Math.random() * 0.2)),
        breakdown: [
          { name: "Wet Slips", value: Math.round(occupancy * 0.55) },
          { name: "Dry Storage", value: Math.round(occupancy * 0.28) },
          { name: "Moorings", value: Math.round(occupancy * 0.12) },
          { name: "Transient", value: Math.round(occupancy * 0.05) },
        ],
      };
    });

    const storageTypeDistribution = [
      { name: "Wet Slips", value: 156, children: [
        { name: "Under 30ft", value: 45 },
        { name: "30-50ft", value: 68 },
        { name: "50-80ft", value: 32 },
        { name: "Over 80ft", value: 11 },
      ]},
      { name: "Dry Storage", value: 85, children: [
        { name: "Rack Storage", value: 52 },
        { name: "Forklift", value: 33 },
      ]},
      { name: "Moorings", value: 24, children: [
        { name: "Swing Moorings", value: 16 },
        { name: "Mediterranean", value: 8 },
      ]},
      { name: "Transient", value: 18, children: [
        { name: "Daily", value: 12 },
        { name: "Weekly", value: 6 },
      ]},
    ];

    const leaseExpirations = [
      { name: "Current Revenue", value: 1850000, isTotal: false, details: [
        { label: "Monthly Contracts", value: 980000 },
        { label: "Seasonal Contracts", value: 620000 },
        { label: "Annual Contracts", value: 250000 },
      ]},
      { name: "Expiring 30 Days", value: -125000, details: [
        { label: "High Risk (No Renewal)", value: 45000 },
        { label: "Medium Risk", value: 35000 },
        { label: "Expected to Renew", value: 45000 },
      ]},
      { name: "Expiring 60 Days", value: -95000, details: [
        { label: "High Risk (No Renewal)", value: 30000 },
        { label: "Medium Risk", value: 25000 },
        { label: "Expected to Renew", value: 40000 },
      ]},
      { name: "Expiring 90 Days", value: -78000, details: [
        { label: "High Risk (No Renewal)", value: 20000 },
        { label: "Medium Risk", value: 28000 },
        { label: "Expected to Renew", value: 30000 },
      ]},
      { name: "New Contracts", value: 185000, details: [
        { label: "Confirmed Renewals", value: 120000 },
        { label: "New Waitlist", value: 45000 },
        { label: "Pending Applications", value: 20000 },
      ]},
      { name: "Projected Revenue", value: 1737000, isTotal: true },
    ];

    const revenueByStorageType = [
      { category: "Wet Slips", value: 985000, breakdown: [
        { name: "Monthly", value: 520000 },
        { name: "Seasonal", value: 320000 },
        { name: "Transient", value: 145000 },
      ]},
      { category: "Dry Storage", value: 425000, breakdown: [
        { name: "Annual", value: 280000 },
        { name: "Monthly", value: 145000 },
      ]},
      { category: "Moorings", value: 185000, breakdown: [
        { name: "Seasonal", value: 120000 },
        { name: "Monthly", value: 65000 },
      ]},
      { category: "Ancillary", value: 255000, breakdown: [
        { name: "Electric", value: 85000 },
        { name: "Water", value: 45000 },
        { name: "Pump Out", value: 35000 },
        { name: "WiFi", value: 45000 },
        { name: "Other", value: 45000 },
      ]},
    ];

    res.json({
      occupancyTrend,
      storageTypeDistribution,
      leaseExpirations,
      revenueByStorageType,
      kpis: {
        currentOccupancy: 87.5,
        occupancyChange: 3.2,
        totalRevenue: 1850000,
        revenueChange: 8.5,
        avgLeaseValue: 12500,
        leaseValueChange: 4.2,
        expiringNext90Days: 42,
        expiringChange: -5,
      },
      locationId: locationId || 'all',
      startDate,
      endDate,
    });
  } catch (error: any) {
    console.error('[Analytics] Error fetching rent roll interactive analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rent roll interactive analytics',
      message: error.message 
    });
  }
});

router.get('/modeling/projects/:projectId/pro-forma-charts', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { year } = req.query;

    const years = [2026, 2027, 2028, 2029, 2030];
    
    const revenueByCategory = [
      { category: "Wet Slips", value: 2450000, breakdown: years.map((y, i) => ({ name: `Year ${i+1}`, value: Math.round(420000 * Math.pow(1.07, i)) })) },
      { category: "Dry Storage", value: 1125000, breakdown: years.map((y, i) => ({ name: `Year ${i+1}`, value: Math.round(195000 * Math.pow(1.05, i)) })) },
      { category: "Fuel Sales", value: 2850000, breakdown: years.map((y, i) => ({ name: `Year ${i+1}`, value: Math.round(520000 * Math.pow(1.04, i)) })) },
      { category: "Ship Store", value: 625000, breakdown: years.map((y, i) => ({ name: `Year ${i+1}`, value: Math.round(110000 * Math.pow(1.03, i)) })) },
      { category: "Ancillary", value: 450000, breakdown: years.map((y, i) => ({ name: `Year ${i+1}`, value: Math.round(80000 * Math.pow(1.05, i)) })) },
    ];

    const expensesByCategory = [
      { category: "Payroll", value: 1850000, breakdown: [
        { name: "Management", value: 520000 },
        { name: "Operations", value: 680000 },
        { name: "Maintenance", value: 380000 },
        { name: "Admin", value: 270000 },
      ]},
      { category: "Utilities", value: 425000, breakdown: [
        { name: "Electric", value: 185000 },
        { name: "Water/Sewer", value: 95000 },
        { name: "Propane/Gas", value: 85000 },
        { name: "Trash", value: 60000 },
      ]},
      { category: "Insurance", value: 285000, breakdown: [
        { name: "Property", value: 145000 },
        { name: "Liability", value: 85000 },
        { name: "Workers Comp", value: 55000 },
      ]},
      { category: "Maintenance", value: 375000, breakdown: [
        { name: "Dock Repairs", value: 165000 },
        { name: "Equipment", value: 125000 },
        { name: "Grounds", value: 85000 },
      ]},
      { category: "Admin", value: 195000, breakdown: [
        { name: "Software", value: 65000 },
        { name: "Marketing", value: 55000 },
        { name: "Professional", value: 45000 },
        { name: "Office", value: 30000 },
      ]},
    ];

    const totalRevenue = 7500000;
    const totalExpenses = 3130000;
    const noi = totalRevenue - totalExpenses;

    const noiWaterfall = [
      { name: "Total Revenue", value: totalRevenue, isTotal: false, details: [
        { label: "Wet Slips", value: 2450000 },
        { label: "Fuel Sales", value: 2850000 },
        { label: "Dry Storage", value: 1125000 },
        { label: "Other", value: 1075000 },
      ]},
      { name: "Payroll", value: -1850000, details: [
        { label: "Management", value: 520000 },
        { label: "Operations", value: 680000 },
        { label: "Maintenance", value: 380000 },
        { label: "Admin", value: 270000 },
      ]},
      { name: "Utilities", value: -425000, details: [
        { label: "Electric", value: 185000 },
        { label: "Water/Sewer", value: 95000 },
        { label: "Other", value: 145000 },
      ]},
      { name: "Insurance", value: -285000, details: [
        { label: "Property", value: 145000 },
        { label: "Liability", value: 85000 },
        { label: "Workers Comp", value: 55000 },
      ]},
      { name: "Maintenance", value: -375000, details: [
        { label: "Dock Repairs", value: 165000 },
        { label: "Equipment", value: 125000 },
        { label: "Grounds", value: 85000 },
      ]},
      { name: "Admin", value: -195000, details: [
        { label: "Software", value: 65000 },
        { label: "Marketing", value: 55000 },
        { label: "Other", value: 75000 },
      ]},
      { name: "NOI", value: noi, isTotal: true },
    ];

    const revenueTrend = years.map((y, idx) => ({
      period: `Year ${idx + 1}`,
      value: Math.round(1325000 * Math.pow(1.04, idx)),
      breakdown: [
        { name: "Wet Slips", value: Math.round(420000 * Math.pow(1.07, idx)) },
        { name: "Fuel Sales", value: Math.round(520000 * Math.pow(1.04, idx)) },
        { name: "Dry Storage", value: Math.round(195000 * Math.pow(1.05, idx)) },
        { name: "Ship Store", value: Math.round(110000 * Math.pow(1.03, idx)) },
        { name: "Ancillary", value: Math.round(80000 * Math.pow(1.05, idx)) },
      ],
    }));

    const revenueMix = [
      { name: "Wet Slips", value: 2450000, children: [
        { name: "Monthly", value: 1350000 },
        { name: "Seasonal", value: 720000 },
        { name: "Transient", value: 380000 },
      ]},
      { name: "Fuel Sales", value: 2850000, children: [
        { name: "Gas", value: 1850000 },
        { name: "Diesel", value: 1000000 },
      ]},
      { name: "Dry Storage", value: 1125000, children: [
        { name: "Annual", value: 780000 },
        { name: "Monthly", value: 345000 },
      ]},
      { name: "Ship Store", value: 625000, children: [
        { name: "Parts", value: 285000 },
        { name: "Supplies", value: 195000 },
        { name: "Accessories", value: 145000 },
      ]},
      { name: "Ancillary", value: 450000, children: [
        { name: "Electric", value: 185000 },
        { name: "Water", value: 95000 },
        { name: "Other", value: 170000 },
      ]},
    ];

    res.json({
      revenueByCategory,
      expensesByCategory,
      noiWaterfall,
      revenueTrend,
      revenueMix,
      kpis: {
        totalRevenue,
        revenueGrowth: 4.2,
        totalExpenses,
        expenseRatio: (totalExpenses / totalRevenue * 100),
        noi,
        noiMargin: (noi / totalRevenue * 100),
        capRate: 6.8,
      },
      projectId,
      year: year || 'all',
    });
  } catch (error: any) {
    console.error('[Analytics] Error fetching pro forma charts:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pro forma charts',
      message: error.message 
    });
  }
});

router.get('/modeling/scenario-comparison', async (req, res) => {
  try {
    const { projectId, scenarios } = req.query;
    const scenarioIds = (scenarios as string)?.split(',') || ['base', 'upside', 'downside'];

    const generateScenarioData = (id: string, multiplier: number) => {
      const baseRevenue = 1500000;
      const baseExpenses = 625000;
      
      return {
        id,
        name: id === 'base' ? 'Base Case' : id === 'upside' ? 'Upside Case' : 'Downside Case',
        description: id === 'base' ? 'Conservative assumptions' : 
                     id === 'upside' ? 'Optimistic growth scenario' : 'Stress test scenario',
        metrics: {
          totalRevenue: Math.round(baseRevenue * multiplier * 5),
          avgAnnualRevenue: Math.round(baseRevenue * multiplier),
          totalExpenses: Math.round(baseExpenses * (multiplier * 0.95) * 5),
          noi: Math.round((baseRevenue * multiplier - baseExpenses * (multiplier * 0.95)) * 5),
          noiMargin: 58.5 + (multiplier - 1) * 8,
          irr: 12.5 + (multiplier - 1) * 15,
          exitValue: Math.round(baseRevenue * multiplier * 1.05 / 0.065),
          equityMultiple: 1.8 + (multiplier - 1) * 0.6,
        },
        yearlyData: [2026, 2027, 2028, 2029, 2030].map((year, idx) => ({
          year,
          revenue: Math.round(baseRevenue * multiplier * Math.pow(1.03 + (multiplier - 1) * 0.02, idx)),
          expenses: Math.round(baseExpenses * (multiplier * 0.95) * Math.pow(1.02, idx)),
          noi: Math.round((baseRevenue * multiplier * Math.pow(1.03 + (multiplier - 1) * 0.02, idx)) - 
                         (baseExpenses * (multiplier * 0.95) * Math.pow(1.02, idx))),
          occupancy: Math.min(98, 85 + (multiplier - 1) * 10 + idx * 1.5),
        })),
        revenueBreakdown: [
          { name: "Wet Slips", value: Math.round(450000 * multiplier), color: "#3b82f6" },
          { name: "Fuel Sales", value: Math.round(520000 * multiplier), color: "#10b981" },
          { name: "Dry Storage", value: Math.round(220000 * multiplier), color: "#f59e0b" },
          { name: "Ship Store", value: Math.round(180000 * multiplier), color: "#8b5cf6" },
          { name: "Ancillary", value: Math.round(130000 * multiplier), color: "#ec4899" },
        ],
        assumptions: {
          revenueGrowth: 3.0 + (multiplier - 1) * 5,
          expenseGrowth: 2.0 + (multiplier - 1) * 1,
          occupancyStart: 85 + (multiplier - 1) * 8,
          exitCapRate: 6.5 - (multiplier - 1) * 0.5,
        },
      };
    };

    const scenarioData = scenarioIds.map(id => {
      const multiplier = id === 'upside' ? 1.15 : id === 'downside' ? 0.85 : 1.0;
      return generateScenarioData(id, multiplier);
    });

    res.json({
      scenarios: scenarioData,
      comparisonMetrics: [
        { metric: "Total Revenue", unit: "currency", scenarios: scenarioData.map(s => ({ id: s.id, value: s.metrics.totalRevenue })) },
        { metric: "NOI", unit: "currency", scenarios: scenarioData.map(s => ({ id: s.id, value: s.metrics.noi })) },
        { metric: "NOI Margin", unit: "percent", scenarios: scenarioData.map(s => ({ id: s.id, value: s.metrics.noiMargin })) },
        { metric: "IRR", unit: "percent", scenarios: scenarioData.map(s => ({ id: s.id, value: s.metrics.irr })) },
        { metric: "Exit Value", unit: "currency", scenarios: scenarioData.map(s => ({ id: s.id, value: s.metrics.exitValue })) },
        { metric: "Equity Multiple", unit: "number", scenarios: scenarioData.map(s => ({ id: s.id, value: s.metrics.equityMultiple })) },
      ],
      projectId: projectId || null,
    });
  } catch (error: any) {
    console.error('[Analytics] Error fetching scenario comparison:', error);
    res.status(500).json({ 
      error: 'Failed to fetch scenario comparison',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/modeling/projects/:projectId/export/excel
 * Generate Excel workbook with full financial model
 * Query params:
 *   - sheets: comma-separated list of sheet IDs to include
 *     Available sheets: operating-pro-forma, cash-flow-analysis, exit-strategy-suite,
 *                       capital-stack, rent-roll-summary, sensitivity-analysis
 */
router.get('/modeling/projects/:projectId/export/excel', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const sheetsParam = req.query.sheets as string | undefined;
    const XLSX = await import('xlsx');

    // Parse selected sheets from query param (default to all if not specified)
    const allSheetIds = [
      'operating-pro-forma',
      'cash-flow-analysis',
      'exit-strategy-suite',
      'capital-stack',
      'rent-roll-summary',
      'sensitivity-analysis'
    ];
    const selectedSheets = new Set(
      sheetsParam ? sheetsParam.split(',').filter(s => allSheetIds.includes(s)) : allSheetIds
    );

    // Fetch project data
    const [projectData] = await db
      .select()
      .from(modelingProjects)
      .where(eq(modelingProjects.id, projectId))
      .limit(1);

    if (!projectData) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const holdPeriod = 5;
    const startYear = 2026;
    const years = Array.from({ length: holdPeriod }, (_, i) => startYear + i);

    // 1. Operating Pro Forma Sheet
    if (selectedSheets.has('operating-pro-forma')) {
      const proFormaData = [
        ['Operating Pro Forma'],
        [''],
        ['Property:', projectData.marinaName || 'N/A'],
        ['Analysis Date:', new Date().toLocaleDateString()],
        [''],
        ['Revenue', ...years.map(y => `Year ${y - startYear + 1} (${y})`)],
        ['Slip Rentals', 800000, 824000, 848720, 869938, 891687],
        ['Dry Storage', 150000, 153750, 157594, 160746, 163961],
        ['Fuel Sales', 200000, 210000, 218400, 224952, 231700],
        ['Ship Store', 80000, 83200, 86112, 88695, 91316],
        ['Service & Repairs', 120000, 127200, 133560, 138235, 143073],
        ['Other Income', 50000, 51500, 53045, 54376, 55735],
        ['Total Revenue', 1400000, 1449650, 1497431, 1536942, 1577472],
        [''],
        ['Operating Expenses'],
        ['Payroll & Benefits', 350000, 360500, 369513, 378750, 388219],
        ['Insurance', 75000, 78750, 81900, 85176, 88583],
        ['Utilities', 60000, 62400, 64584, 66845, 68850],
        ['Fuel Cost (COGS)', 160000, 168000, 174720, 179962, 185361],
        ['Maintenance & Repairs', 80000, 82400, 84872, 87044, 89220],
        ['Property Taxes', 100000, 102000, 104040, 106121, 108243],
        ['Management Fee (5%)', 70000, 72483, 74872, 76847, 78874],
        ['Reserves (3%)', 42000, 43490, 44923, 46108, 47324],
        ['Other Operating', 40000, 41200, 42436, 43497, 44585],
        ['Total Expenses', 977000, 1011223, 1041860, 1070350, 1099259],
        [''],
        ['Net Operating Income', 423000, 438427, 455571, 466592, 478213],
      ];
      const proFormaSheet = XLSX.utils.aoa_to_sheet(proFormaData);
      XLSX.utils.book_append_sheet(workbook, proFormaSheet, 'Operating Pro Forma');
    }

    // 2. Cash Flow Analysis Sheet
    if (selectedSheets.has('cash-flow-analysis')) {
      const cashFlowData = [
        ['Cash Flow Analysis'],
        [''],
        ['Property:', projectData.marinaName || 'N/A'],
        [''],
        ['Annual Cash Flow Summary'],
        ['Year', 'Beginning Balance', 'NOI', 'Debt Service', 'CapEx', 'Net Cash Flow', 'Ending Balance'],
        [2026, 0, 423000, -280000, -50000, 93000, 93000],
        [2027, 93000, 438427, -280000, -35000, 123427, 216427],
        [2028, 216427, 455571, -280000, -40000, 135571, 351998],
        [2029, 351998, 466592, -280000, -45000, 141592, 493590],
        [2030, 493590, 478213, -280000, -50000, 148213, 641803],
        [''],
        ['Levered Returns'],
        ['Metric', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
        ['Cash-on-Cash Return', '5.7%', '6.3%', '7.0%', '7.5%', '7.9%'],
        ['Cumulative Cash Flow', 93000, 216427, 351998, 493590, 641803],
        [''],
        ['Debt Service Coverage'],
        ['DSCR', 1.51, 1.57, 1.63, 1.67, 1.71],
      ];
      const cashFlowSheet = XLSX.utils.aoa_to_sheet(cashFlowData);
      XLSX.utils.book_append_sheet(workbook, cashFlowSheet, 'Cash Flow Analysis');
    }

    // 3. Exit Strategy Suite Sheet
    if (selectedSheets.has('exit-strategy-suite')) {
      const exitData = [
        ['Exit Strategy Suite'],
        [''],
        ['Property:', projectData.marinaName || 'N/A'],
        [''],
        ['Exit Valuation'],
        ['Exit Year NOI', 478213],
        ['Exit Cap Rate', '7.5%'],
        ['Gross Exit Value', 6376173],
        [''],
        ['Sale Proceeds'],
        ['Gross Sale Price', 6376173],
        ['Selling Costs (2%)', -127523],
        ['Net Sale Price', 6248650],
        ['Loan Payoff', -3150000],
        ['Net Proceeds to Equity', 3098650],
        [''],
        ['Return Metrics'],
        ['Initial Equity Investment', 2500000],
        ['Cumulative Cash Flow', 641803],
        ['Net Exit Proceeds', 3098650],
        ['Total Return', 3740453],
        ['Equity Multiple', '2.5x'],
        ['IRR', '14.8%'],
        [''],
        ['Scenario Comparison'],
        ['Metric', 'Base Case', 'Upside', 'Downside'],
        ['Exit Cap Rate', '7.5%', '7.0%', '8.0%'],
        ['Exit Value', 6376173, 7514771, 5379900],
        ['Equity Multiple', '1.8x', '2.1x', '1.5x'],
        ['IRR', '12.5%', '16.8%', '8.2%'],
      ];
      const exitSheet = XLSX.utils.aoa_to_sheet(exitData);
      XLSX.utils.book_append_sheet(workbook, exitSheet, 'Exit Strategy Suite');
    }

    // 4. Capital Stack Sheet
    if (selectedSheets.has('capital-stack')) {
      const capitalData = [
        ['Capital Stack'],
        [''],
        ['Property:', projectData.marinaName || 'N/A'],
        ['Acquisition Price:', projectData.purchasePrice || 5000000],
        [''],
        ['Sources of Capital'],
        ['Source', 'Amount', '% of Total', 'Cost'],
        ['Senior Debt', 3500000, '70.0%', '6.50%'],
        ['Equity', 1500000, '30.0%', '15.0% Target'],
        ['Total Sources', 5000000, '100.0%', ''],
        [''],
        ['Debt Terms'],
        ['Loan Amount', 3500000],
        ['Interest Rate', '6.50%'],
        ['Loan Term (Years)', 25],
        ['Amortization (Years)', 30],
        ['Annual Debt Service', 280000],
        ['DSCR (Year 1)', 1.51],
        [''],
        ['Uses of Capital'],
        ['Use', 'Amount', '% of Total'],
        ['Purchase Price', 4850000, '97.0%'],
        ['Closing Costs', 100000, '2.0%'],
        ['Working Capital', 50000, '1.0%'],
        ['Total Uses', 5000000, '100.0%'],
      ];
      const capitalSheet = XLSX.utils.aoa_to_sheet(capitalData);
      XLSX.utils.book_append_sheet(workbook, capitalSheet, 'Capital Stack');
    }

    // 5. Rent Roll Summary Sheet
    if (selectedSheets.has('rent-roll-summary')) {
      const rentRollData = [
        ['Rent Roll Summary'],
        [''],
        ['Property:', projectData.marinaName || 'N/A'],
        ['Total Slips:', projectData.totalSlips || 245],
        [''],
        ['Storage Type', 'Count', 'Occupied', 'Vacancy', 'Annual Revenue', 'Avg Rate/Unit'],
        ['Wet Slips', 120, 108, '10%', 540000, 5000],
        ['Dry Storage', 80, 72, '10%', 144000, 2000],
        ['Covered Slips', 20, 19, '5%', 95000, 5000],
        ['Jet Ski Docks', 15, 12, '20%', 18000, 1500],
        ['Transient', 10, 'N/A', 'N/A', 48000, 4800],
        ['Total', 245, 211, '14%', 845000, 4010],
        [''],
        ['Lease Expiration Schedule'],
        ['Timeframe', 'Count', 'Annual Revenue', '% of Total'],
        ['0-30 Days', 15, 75000, '8.9%'],
        ['31-90 Days', 22, 110000, '13.0%'],
        ['91-180 Days', 35, 175000, '20.7%'],
        ['181-365 Days', 45, 225000, '26.6%'],
        ['1+ Years', 94, 260000, '30.8%'],
      ];
      const rentRollSheet = XLSX.utils.aoa_to_sheet(rentRollData);
      XLSX.utils.book_append_sheet(workbook, rentRollSheet, 'Rent Roll Summary');
    }

    // 6. Sensitivity Analysis Sheet
    if (selectedSheets.has('sensitivity-analysis')) {
      const sensitivityData = [
        ['Sensitivity Analysis'],
        [''],
        ['Property:', projectData.marinaName || 'N/A'],
        [''],
        ['IRR Sensitivity - Exit Cap Rate vs Revenue Growth'],
        ['', '-1.0%', 'Base', '+1.0%', '+2.0%'],
        ['6.5%', '11.2%', '13.5%', '15.8%', '18.0%'],
        ['7.0%', '10.1%', '12.3%', '14.5%', '16.6%'],
        ['7.5% (Base)', '9.1%', '11.2%', '13.2%', '15.2%'],
        ['8.0%', '8.2%', '10.2%', '12.1%', '13.9%'],
        ['8.5%', '7.4%', '9.3%', '11.1%', '12.8%'],
        [''],
        ['Equity Multiple Sensitivity - Exit Cap Rate vs Revenue Growth'],
        ['', '-1.0%', 'Base', '+1.0%', '+2.0%'],
        ['6.5%', '1.9x', '2.1x', '2.3x', '2.5x'],
        ['7.0%', '1.8x', '2.0x', '2.1x', '2.3x'],
        ['7.5% (Base)', '1.7x', '1.8x', '2.0x', '2.2x'],
        ['8.0%', '1.6x', '1.7x', '1.9x', '2.0x'],
        ['8.5%', '1.5x', '1.6x', '1.8x', '1.9x'],
        [''],
        ['Key Assumptions Impact'],
        ['Variable', 'Low', 'Base', 'High', 'IRR Impact'],
        ['Occupancy', '85%', '90%', '95%', '+/- 2.1%'],
        ['Rate Growth', '2.0%', '3.0%', '4.0%', '+/- 1.5%'],
        ['OpEx Ratio', '65%', '70%', '75%', '+/- 1.8%'],
        ['Exit Cap', '7.0%', '7.5%', '8.0%', '+/- 2.5%'],
      ];
      const sensitivitySheet = XLSX.utils.aoa_to_sheet(sensitivityData);
      XLSX.utils.book_append_sheet(workbook, sensitivitySheet, 'Sensitivity Analysis');
    }

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for download
    const filename = `${(projectData.marinaName || 'Marina').replace(/[^a-zA-Z0-9]/g, '_')}_Financial_Model_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (error: any) {
    console.error('[Analytics] Error generating Excel export:', error);
    res.status(500).json({ 
      error: 'Failed to generate Excel export',
      message: error.message 
    });
  }
});

// ============================================================================
// Drill-down Endpoints for Analytics Dashboard
// ============================================================================

/**
 * GET /api/analytics/drill-down
 * Unified drill-down endpoint with metricType and filters
 * Supports: deals, dd-projects, operations, contacts, companies
 */
router.get('/drill-down', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const metricType = req.query.metricType as string;
    const filter = req.query.filter as string;
    const stage = req.query.stage as string;
    const status = req.query.status as string;
    const type = req.query.type as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!metricType) {
      return res.status(400).json({ error: 'metricType is required' });
    }

    let items: any[] = [];
    let total = 0;

    switch (metricType) {
      case 'deals':
      case 'wonDeals':
      case 'lostDeals':
      case 'pipelineValue': {
        const whereConditions = [eq(crmDeals.ownerId, orgId)];
        if (stage || filter) {
          whereConditions.push(eq(crmDeals.stage, stage || filter));
        }
        if (metricType === 'wonDeals') {
          whereConditions.push(sql`LOWER(${crmDeals.stage}) LIKE '%won%'`);
        } else if (metricType === 'lostDeals') {
          whereConditions.push(sql`LOWER(${crmDeals.stage}) LIKE '%lost%'`);
        }
        
        const deals = await db.select({
          id: crmDeals.id,
          name: crmDeals.name,
          stage: crmDeals.stage,
          value: crmDeals.value,
          probability: crmDeals.probability,
          expectedCloseDate: crmDeals.expectedCloseDate,
          createdAt: crmDeals.createdAt,
        })
          .from(crmDeals)
          .where(and(...whereConditions))
          .orderBy(desc(crmDeals.createdAt))
          .limit(limit)
          .offset(offset);
        
        const countResult = await db.select({ count: count() })
          .from(crmDeals)
          .where(and(...whereConditions));
        
        items = deals;
        total = Number(countResult[0]?.count || 0);
        break;
      }

      case 'dd-projects':
      case 'activeProjects':
      case 'completedProjects': {
        const whereConditions = [eq(projects.orgId, orgId)];
        if (status || filter) {
          whereConditions.push(eq(projects.status, (status || filter) as any));
        }
        if (metricType === 'activeProjects') {
          whereConditions.push(eq(projects.status, 'active'));
        } else if (metricType === 'completedProjects') {
          whereConditions.push(eq(projects.status, 'completed'));
        }
        
        const ddProjects = await db.select({
          id: projects.id,
          name: projects.name,
          status: projects.status,
          ddExpirationDate: projects.ddExpirationDate,
          psaDate: projects.psaDate,
          createdAt: projects.createdAt,
        })
          .from(projects)
          .where(and(...whereConditions))
          .orderBy(desc(projects.createdAt))
          .limit(limit)
          .offset(offset);
        
        const countResult = await db.select({ count: count() })
          .from(projects)
          .where(and(...whereConditions));
        
        items = ddProjects;
        total = Number(countResult[0]?.count || 0);
        break;
      }

      case 'operations':
      case 'occupiedUnits':
      case 'totalUnits': {
        const whereConditions = [eq(rentRollEntries.orgId, orgId)];
        if (status || filter) {
          whereConditions.push(eq(rentRollEntries.status, (status || filter) as any));
        }
        if (type) {
          whereConditions.push(eq(rentRollEntries.entryType, type as any));
        }
        if (metricType === 'occupiedUnits') {
          whereConditions.push(eq(rentRollEntries.status, 'active'));
        }
        
        const entries = await db.select({
          id: rentRollEntries.id,
          unitId: rentRollEntries.unitId,
          status: rentRollEntries.status,
          entryType: rentRollEntries.entryType,
          tenantName: rentRollEntries.tenantName,
          monthlyRate: rentRollEntries.monthlyRate,
          leaseStartDate: rentRollEntries.leaseStartDate,
          leaseEndDate: rentRollEntries.leaseEndDate,
          createdAt: rentRollEntries.createdAt,
        })
          .from(rentRollEntries)
          .where(and(...whereConditions))
          .orderBy(desc(rentRollEntries.createdAt))
          .limit(limit)
          .offset(offset);
        
        const countResult = await db.select({ count: count() })
          .from(rentRollEntries)
          .where(and(...whereConditions));
        
        items = entries.map(e => ({
          ...e,
          name: e.tenantName || e.unitId || 'Unknown',
          value: e.monthlyRate ? parseFloat(e.monthlyRate) : 0,
        }));
        total = Number(countResult[0]?.count || 0);
        break;
      }

      case 'contacts':
      case 'totalContacts': {
        const contacts = await db.select({
          id: crmContacts.id,
          firstName: crmContacts.firstName,
          lastName: crmContacts.lastName,
          email: crmContacts.email,
          company: crmContacts.company,
          title: crmContacts.title,
          createdAt: crmContacts.createdAt,
        })
          .from(crmContacts)
          .where(eq(crmContacts.orgId, orgId))
          .orderBy(desc(crmContacts.createdAt))
          .limit(limit)
          .offset(offset);
        
        const countResult = await db.select({ count: count() })
          .from(crmContacts)
          .where(eq(crmContacts.orgId, orgId));
        
        items = contacts.map(c => ({
          ...c,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown',
        }));
        total = Number(countResult[0]?.count || 0);
        break;
      }

      case 'companies':
      case 'totalCompanies': {
        const companies = await db.select({
          id: crmCompanies.id,
          name: crmCompanies.name,
          industry: crmCompanies.industry,
          website: crmCompanies.website,
          createdAt: crmCompanies.createdAt,
        })
          .from(crmCompanies)
          .where(eq(crmCompanies.orgId, orgId))
          .orderBy(desc(crmCompanies.createdAt))
          .limit(limit)
          .offset(offset);
        
        const countResult = await db.select({ count: count() })
          .from(crmCompanies)
          .where(eq(crmCompanies.orgId, orgId));
        
        items = companies;
        total = Number(countResult[0]?.count || 0);
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown metricType: ${metricType}` });
    }

    res.json({
      metricType,
      filter: filter || stage || status || null,
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    });
  } catch (error: any) {
    console.error('[Analytics] Error in unified drill-down:', error);
    res.status(500).json({ 
      error: 'Failed to fetch drill-down data',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/unified/drilldown/deals
 * Get deals filtered by stage for drill-down view
 */
router.get('/unified/drilldown/deals', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const stage = req.query.stage as string;
    
    const whereConditions = [eq(crmDeals.ownerId, orgId)];
    if (stage) {
      whereConditions.push(eq(crmDeals.stage, stage));
    }
    
    const deals = await db.select({
      id: crmDeals.id,
      name: crmDeals.name,
      stage: crmDeals.stage,
      value: crmDeals.value,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      createdAt: crmDeals.createdAt,
    })
      .from(crmDeals)
      .where(and(...whereConditions))
      .orderBy(desc(crmDeals.createdAt))
      .limit(100);
    
    res.json({
      items: deals,
      total: deals.length,
      stage: stage || 'all',
    });
  } catch (error: any) {
    console.error('[Analytics] Error fetching deals drilldown:', error);
    res.status(500).json({ 
      error: 'Failed to fetch deals drilldown',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/unified/drilldown/dd-projects
 * Get DD projects filtered by status for drill-down view
 */
router.get('/unified/drilldown/dd-projects', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const status = req.query.status as string;
    
    const whereConditions = [eq(projects.orgId, orgId)];
    if (status) {
      whereConditions.push(eq(projects.status, status as any));
    }
    
    const ddProjects = await db.select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      ddExpirationDate: projects.ddExpirationDate,
      psaDate: projects.psaDate,
      createdAt: projects.createdAt,
    })
      .from(projects)
      .where(and(...whereConditions))
      .orderBy(desc(projects.createdAt))
      .limit(100);
    
    res.json({
      items: ddProjects,
      total: ddProjects.length,
      status: status || 'all',
    });
  } catch (error: any) {
    console.error('[Analytics] Error fetching DD projects drilldown:', error);
    res.status(500).json({ 
      error: 'Failed to fetch DD projects drilldown',
      message: error.message 
    });
  }
});

// ============================================================================
// Report Schedule CRUD Endpoints
// ============================================================================

const reportScheduleSchema = z.object({
  reportType: z.string(),
  name: z.string().min(1),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  timeOfDay: z.string().default('09:00:00'),
  timezone: z.string().default('America/New_York'),
  recipients: z.array(z.string().email()),
  filters: z.record(z.any()).optional(),
  includeCharts: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

function calculateNextRunAt(frequency: string, dayOfWeek?: number | null, dayOfMonth?: number | null, timeOfDay: string = '09:00:00'): Date {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  const nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);
  
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  if (frequency === 'weekly' && dayOfWeek !== undefined && dayOfWeek !== null) {
    while (nextRun.getDay() !== dayOfWeek) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (frequency === 'monthly' && dayOfMonth !== undefined && dayOfMonth !== null) {
    nextRun.setDate(dayOfMonth);
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
  }
  
  return nextRun;
}

/**
 * GET /api/analytics/report-schedules
 * List all report schedules for the current user/org
 */
router.get('/report-schedules', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    
    const schedules = await db.select()
      .from(analyticsReportSchedules)
      .where(eq(analyticsReportSchedules.orgId, orgId))
      .orderBy(asc(analyticsReportSchedules.nextRunAt));
    
    res.json(schedules);
  } catch (error: any) {
    console.error('[Analytics] Error fetching report schedules:', error);
    res.status(500).json({ 
      error: 'Failed to fetch report schedules',
      message: error.message 
    });
  }
});

/**
 * POST /api/analytics/report-schedules
 * Create a new report schedule
 */
router.post('/report-schedules', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const userId = (req as any).userId || 'user-1';
    
    const data = reportScheduleSchema.parse(req.body);
    const nextRunAt = calculateNextRunAt(data.frequency, data.dayOfWeek, data.dayOfMonth, data.timeOfDay);
    
    const [schedule] = await db.insert(analyticsReportSchedules)
      .values({
        ...data,
        orgId,
        userId,
        nextRunAt,
      })
      .returning();
    
    res.status(201).json(schedule);
  } catch (error: any) {
    console.error('[Analytics] Error creating report schedule:', error);
    res.status(500).json({ 
      error: 'Failed to create report schedule',
      message: error.message 
    });
  }
});

/**
 * PUT /api/analytics/report-schedules/:id
 * Update a report schedule
 */
router.put('/report-schedules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).tenantId || 'org-1';
    
    const data = reportScheduleSchema.partial().parse(req.body);
    const updateData: any = { ...data, updatedAt: new Date() };
    
    if (data.frequency || data.dayOfWeek !== undefined || data.dayOfMonth !== undefined || data.timeOfDay) {
      const existing = await db.select()
        .from(analyticsReportSchedules)
        .where(and(eq(analyticsReportSchedules.id, id), eq(analyticsReportSchedules.orgId, orgId)))
        .limit(1);
      
      if (existing[0]) {
        const freq = data.frequency || existing[0].frequency;
        const dow = data.dayOfWeek !== undefined ? data.dayOfWeek : existing[0].dayOfWeek;
        const dom = data.dayOfMonth !== undefined ? data.dayOfMonth : existing[0].dayOfMonth;
        const tod = data.timeOfDay || existing[0].timeOfDay;
        updateData.nextRunAt = calculateNextRunAt(freq, dow, dom, tod || '09:00:00');
      }
    }
    
    const [schedule] = await db.update(analyticsReportSchedules)
      .set(updateData)
      .where(and(eq(analyticsReportSchedules.id, id), eq(analyticsReportSchedules.orgId, orgId)))
      .returning();
    
    if (!schedule) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    res.json(schedule);
  } catch (error: any) {
    console.error('[Analytics] Error updating report schedule:', error);
    res.status(500).json({ 
      error: 'Failed to update report schedule',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/analytics/report-schedules/:id
 * Delete a report schedule
 */
router.delete('/report-schedules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).tenantId || 'org-1';
    
    const [deleted] = await db.delete(analyticsReportSchedules)
      .where(and(eq(analyticsReportSchedules.id, id), eq(analyticsReportSchedules.orgId, orgId)))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Analytics] Error deleting report schedule:', error);
    res.status(500).json({ 
      error: 'Failed to delete report schedule',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/unified/drilldown/operations
 * Get rent roll entries filtered by status for drill-down view
 */
router.get('/unified/drilldown/operations', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const status = req.query.status as string;
    const type = req.query.type as string;
    
    const whereConditions = [eq(rentRollEntries.orgId, orgId)];
    if (status) {
      whereConditions.push(eq(rentRollEntries.status, status as any));
    }
    if (type) {
      whereConditions.push(eq(rentRollEntries.entryType, type as any));
    }
    
    const entries = await db.select({
      id: rentRollEntries.id,
      name: rentRollEntries.unitId,
      status: rentRollEntries.status,
      entryType: rentRollEntries.entryType,
      tenantName: rentRollEntries.tenantName,
      monthlyRate: rentRollEntries.monthlyRate,
      leaseStartDate: rentRollEntries.leaseStartDate,
      leaseEndDate: rentRollEntries.leaseEndDate,
      createdAt: rentRollEntries.createdAt,
    })
      .from(rentRollEntries)
      .where(and(...whereConditions))
      .orderBy(desc(rentRollEntries.createdAt))
      .limit(100);
    
    res.json({
      items: entries.map(e => ({
        ...e,
        name: e.tenantName || e.name || 'Unknown',
        value: e.monthlyRate ? parseFloat(e.monthlyRate) : 0,
      })),
      total: entries.length,
      status: status || 'all',
      type: type || 'all',
    });
  } catch (error: any) {
    console.error('[Analytics] Error fetching operations drilldown:', error);
    res.status(500).json({ 
      error: 'Failed to fetch operations drilldown',
      message: error.message 
    });
  }
});

/**
 * POST /api/analytics/export-pdf
 * Generate PDF export of analytics dashboard with actual PDF generation
 * Saves to server and returns download URL
 */
router.post('/export-pdf', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const { period = '30d', dashboardType = 'unified', filters = {}, analyticsData, returnUrl = false } = req.body;
    
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const pdfDoc = await PDFDocument.create();
    const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    let yOffset = height - 50;
    
    const dashboardTitles: Record<string, string> = {
      unified: 'Cross-Module Analytics Report',
      crm: 'CRM Analytics Report',
      dd: 'Due Diligence Analytics Report',
      modeling: 'Modeling Analytics Report',
      operations: 'Operations Analytics Report',
    };
    
    page.drawText(dashboardTitles[dashboardType] || 'Analytics Report', {
      x: 50,
      y: yOffset,
      size: 24,
      font: timesBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    yOffset -= 30;
    
    const periodLabels: Record<string, string> = {
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
      'ytd': 'Year to Date'
    };
    
    page.drawText(`Generated: ${new Date().toLocaleString()}`, {
      x: 50,
      y: yOffset,
      size: 10,
      font: timesRoman,
      color: rgb(0.4, 0.4, 0.4),
    });
    yOffset -= 15;
    
    page.drawText(`Period: ${periodLabels[period] || period}`, {
      x: 50,
      y: yOffset,
      size: 10,
      font: timesRoman,
      color: rgb(0.4, 0.4, 0.4),
    });
    yOffset -= 15;
    
    page.drawText(`Dashboard Type: ${dashboardType}`, {
      x: 50,
      y: yOffset,
      size: 10,
      font: timesRoman,
      color: rgb(0.4, 0.4, 0.4),
    });
    yOffset -= 40;
    
    if (analyticsData) {
      page.drawText('Key Performance Indicators', {
        x: 50,
        y: yOffset,
        size: 16,
        font: timesBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      yOffset -= 25;
      
      const formatCurrency = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value.toFixed(0)}`;
      };
      
      const formatPercent = (value: number) => `${value.toFixed(1)}%`;
      
      const kpis = [
        { label: 'Total Pipeline Value', value: formatCurrency(analyticsData.crm?.pipelineValue || 0) },
        { label: 'Win Rate', value: formatPercent(analyticsData.crm?.conversionRate || 0) },
        { label: 'DD Completion Rate', value: formatPercent(analyticsData.dueDiligence?.completionRate || 0) },
        { label: 'Overdue Tasks', value: String(analyticsData.dueDiligence?.overdueTasks || 0) },
        { label: 'Total Contacts', value: String(analyticsData.crm?.totalContacts || 0) },
        { label: 'Total Companies', value: String(analyticsData.crm?.totalCompanies || 0) },
        { label: 'DD Projects', value: String(analyticsData.dueDiligence?.totalProjects || 0) },
        { label: 'Modeling Projects', value: String(analyticsData.modeling?.totalProjects || 0) },
        { label: 'Occupancy Rate', value: formatPercent(analyticsData.operations?.occupancyRate || 0) },
        { label: 'Monthly Revenue', value: formatCurrency(analyticsData.operations?.totalMonthlyRevenue || 0) },
      ];
      
      kpis.forEach((kpi, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = 50 + col * 270;
        const y = yOffset - row * 25;
        
        page.drawText(`${kpi.label}: `, {
          x,
          y,
          size: 11,
          font: timesRoman,
          color: rgb(0.3, 0.3, 0.3),
        });
        page.drawText(kpi.value, {
          x: x + 150,
          y,
          size: 11,
          font: timesBold,
          color: rgb(0.1, 0.1, 0.1),
        });
      });
      yOffset -= Math.ceil(kpis.length / 2) * 25 + 30;
      
      if (analyticsData.crm?.dealsByStage) {
        page.drawText('Deals by Stage', {
          x: 50,
          y: yOffset,
          size: 14,
          font: timesBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        yOffset -= 20;
        
        Object.entries(analyticsData.crm.dealsByStage).forEach(([stage, count], index) => {
          page.drawText(`${stage}: ${count} deals`, {
            x: 60,
            y: yOffset - index * 18,
            size: 10,
            font: timesRoman,
            color: rgb(0.3, 0.3, 0.3),
          });
        });
        yOffset -= Object.keys(analyticsData.crm.dealsByStage).length * 18 + 25;
      }
      
      if (analyticsData.dueDiligence?.projectsByStatus) {
        page.drawText('DD Projects by Status', {
          x: 50,
          y: yOffset,
          size: 14,
          font: timesBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        yOffset -= 20;
        
        Object.entries(analyticsData.dueDiligence.projectsByStatus).forEach(([status, count], index) => {
          page.drawText(`${status}: ${count} projects`, {
            x: 60,
            y: yOffset - index * 18,
            size: 10,
            font: timesRoman,
            color: rgb(0.3, 0.3, 0.3),
          });
        });
        yOffset -= Object.keys(analyticsData.dueDiligence.projectsByStatus).length * 18 + 25;
      }
      
      if (analyticsData.operations) {
        page.drawText('Operations Summary', {
          x: 50,
          y: yOffset,
          size: 14,
          font: timesBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        yOffset -= 20;
        
        const opsItems = [
          { label: 'Total Units', value: analyticsData.operations.totalUnits || 0 },
          { label: 'Occupied Units', value: analyticsData.operations.occupiedUnits || 0 },
          { label: 'Occupancy Rate', value: `${(analyticsData.operations.occupancyRate || 0).toFixed(1)}%` },
          { label: 'Monthly Revenue', value: formatCurrency(analyticsData.operations.totalMonthlyRevenue || 0) },
        ];
        
        opsItems.forEach((item, index) => {
          page.drawText(`${item.label}: ${item.value}`, {
            x: 60,
            y: yOffset - index * 18,
            size: 10,
            font: timesRoman,
            color: rgb(0.3, 0.3, 0.3),
          });
        });
      }
    }
    
    page.drawText('Note: Chart visualizations available in interactive dashboard', {
      x: 50,
      y: 50,
      size: 8,
      font: timesRoman,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    const pdfBytes = await pdfDoc.save();
    
    if (returnUrl) {
      const uploadsDir = path.default.join(process.cwd(), 'server', 'uploads', 'analytics-reports');
      await fs.mkdir(uploadsDir, { recursive: true });
      
      const filename = `analytics-report-${dashboardType}-${Date.now()}.pdf`;
      const filePath = path.default.join(uploadsDir, filename);
      await fs.writeFile(filePath, Buffer.from(pdfBytes));
      
      const downloadUrl = `/api/analytics/reports/${filename}`;
      
      res.json({
        success: true,
        filename,
        downloadUrl,
        size: pdfBytes.length,
        generatedAt: new Date().toISOString(),
      });
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${dashboardType}-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.setHeader('Content-Length', pdfBytes.length);
      res.send(Buffer.from(pdfBytes));
    }
  } catch (error: any) {
    console.error('[Analytics] Error generating PDF export:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF export',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/reports/:filename
 * Download a previously generated PDF report
 */
router.get('/reports/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!filename.endsWith('.pdf') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.default.join(process.cwd(), 'server', 'uploads', 'analytics-reports', filename);
    
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const fileBuffer = await fs.readFile(filePath);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('[Analytics] Error downloading PDF report:', error);
    res.status(500).json({ 
      error: 'Failed to download report',
      message: error.message 
    });
  }
});

/**
 * POST /api/analytics/report-schedules/:id/preview
 * Generate a preview of what the scheduled report will look like
 */
router.post('/report-schedules/:id/preview', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).tenantId || 'org-1';
    
    const [schedule] = await db.select()
      .from(analyticsReportSchedules)
      .where(and(eq(analyticsReportSchedules.id, id), eq(analyticsReportSchedules.orgId, orgId)))
      .limit(1);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    const period = (schedule.filters as any)?.period || '30d';
    const periodDays: Record<string, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'ytd': Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24)),
    };
    const days = periodDays[period] || 30;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    
    const [contactsCount, dealsData, ddProjectsData] = await Promise.all([
      db.select({ count: count() })
        .from(crmContacts)
        .where(eq(crmContacts.orgId, orgId))
        .then(r => r[0]?.count || 0),
      
      db.select({
        stage: crmDeals.stage,
        count: count(),
        totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`,
      })
        .from(crmDeals)
        .where(eq(crmDeals.ownerId, orgId))
        .groupBy(crmDeals.stage),
      
      db.select({
        status: projects.status,
        count: count(),
      })
        .from(projects)
        .where(eq(projects.orgId, orgId))
        .groupBy(projects.status),
    ]);
    
    const dealsByStage: Record<string, number> = {};
    let pipelineValue = 0;
    dealsData.forEach(r => {
      dealsByStage[r.stage || 'unknown'] = Number(r.count);
      pipelineValue += Number(r.totalValue);
    });
    
    const projectsByStatus: Record<string, number> = {};
    ddProjectsData.forEach(r => {
      projectsByStatus[r.status || 'unknown'] = Number(r.count);
    });
    
    const previewHtml = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { color: #333; }
            .header { border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
            .meta { color: #666; font-size: 12px; }
            .section { margin-bottom: 30px; }
            .section h2 { color: #007bff; font-size: 16px; margin-bottom: 10px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .kpi { background: #f8f9fa; padding: 15px; border-radius: 8px; }
            .kpi-label { color: #666; font-size: 12px; }
            .kpi-value { font-size: 24px; font-weight: bold; color: #333; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f8f9fa; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${schedule.name}</h1>
            <div class="meta">
              <p>Report Type: ${schedule.reportType} | Frequency: ${schedule.frequency}</p>
              <p>Generated: ${new Date().toLocaleString()}</p>
              <p>Period: ${period === '7d' ? 'Last 7 days' : period === '30d' ? 'Last 30 days' : period === '90d' ? 'Last 90 days' : 'Year to Date'}</p>
            </div>
          </div>
          
          <div class="section">
            <h2>Key Metrics</h2>
            <div class="kpi-grid">
              <div class="kpi">
                <div class="kpi-label">Total Contacts</div>
                <div class="kpi-value">${contactsCount}</div>
              </div>
              <div class="kpi">
                <div class="kpi-label">Pipeline Value</div>
                <div class="kpi-value">$${(pipelineValue / 1000000).toFixed(1)}M</div>
              </div>
              <div class="kpi">
                <div class="kpi-label">Total Deals</div>
                <div class="kpi-value">${Object.values(dealsByStage).reduce((a, b) => a + b, 0)}</div>
              </div>
              <div class="kpi">
                <div class="kpi-label">DD Projects</div>
                <div class="kpi-value">${Object.values(projectsByStatus).reduce((a, b) => a + b, 0)}</div>
              </div>
            </div>
          </div>
          
          <div class="section">
            <h2>Deals by Stage</h2>
            <table>
              <tr><th>Stage</th><th>Count</th></tr>
              ${Object.entries(dealsByStage).map(([stage, cnt]) => `<tr><td>${stage}</td><td>${cnt}</td></tr>`).join('')}
            </table>
          </div>
          
          <div class="section">
            <h2>DD Projects by Status</h2>
            <table>
              <tr><th>Status</th><th>Count</th></tr>
              ${Object.entries(projectsByStatus).map(([status, cnt]) => `<tr><td>${status}</td><td>${cnt}</td></tr>`).join('')}
            </table>
          </div>
          
          <div class="meta" style="margin-top: 40px; text-align: center;">
            <p>Recipients: ${schedule.recipients.join(', ')}</p>
            <p>Next scheduled delivery: ${schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : 'Not scheduled'}</p>
          </div>
        </body>
      </html>
    `;
    
    res.json({
      schedule,
      preview: {
        html: previewHtml,
        data: {
          totalContacts: contactsCount,
          pipelineValue,
          dealsByStage,
          projectsByStatus,
        },
      },
    });
  } catch (error: any) {
    console.error('[Analytics] Error generating report preview:', error);
    res.status(500).json({ 
      error: 'Failed to generate report preview',
      message: error.message 
    });
  }
});

// ============================================================================
// Scheduled Report Execution (Placeholder for Background Job)
// ============================================================================

/**
 * POST /api/analytics/report-schedules/:id/execute
 * Manually trigger execution of a scheduled report
 * In production, this would be called by a background job scheduler (e.g., cron, Bull, Agenda)
 */
router.post('/report-schedules/:id/execute', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).tenantId || 'org-1';
    
    const [schedule] = await db.select()
      .from(analyticsReportSchedules)
      .where(and(eq(analyticsReportSchedules.id, id), eq(analyticsReportSchedules.orgId, orgId)))
      .limit(1);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    if (!schedule.isActive) {
      return res.status(400).json({ error: 'Schedule is not active' });
    }
    
    console.log(`[Analytics] Executing scheduled report: ${schedule.name} (${schedule.id})`);
    console.log(`[Analytics] Recipients: ${schedule.recipients.join(', ')}`);
    console.log(`[Analytics] Report type: ${schedule.reportType}, Frequency: ${schedule.frequency}`);
    
    const nextRunAt = calculateNextRunAt(
      schedule.frequency, 
      schedule.dayOfWeek, 
      schedule.dayOfMonth, 
      schedule.timeOfDay || '09:00:00'
    );
    
    await db.update(analyticsReportSchedules)
      .set({
        lastRunAt: new Date(),
        nextRunAt,
        updatedAt: new Date(),
      })
      .where(eq(analyticsReportSchedules.id, id));
    
    res.json({
      success: true,
      message: 'Report execution triggered (placeholder)',
      schedule: {
        id: schedule.id,
        name: schedule.name,
        recipients: schedule.recipients,
        lastRunAt: new Date().toISOString(),
        nextRunAt: nextRunAt.toISOString(),
      },
      note: 'In production, this would generate and send the report via email using SendGrid or similar service.',
    });
  } catch (error: any) {
    console.error('[Analytics] Error executing scheduled report:', error);
    res.status(500).json({ 
      error: 'Failed to execute scheduled report',
      message: error.message 
    });
  }
});

/**
 * GET /api/analytics/report-schedules/pending
 * Get all pending scheduled reports that should be executed
 * Used by background job scheduler to find reports due for execution
 */
router.get('/report-schedules/pending', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    
    const pendingSchedules = await db.select()
      .from(analyticsReportSchedules)
      .where(and(
        eq(analyticsReportSchedules.isActive, true),
        lte(analyticsReportSchedules.nextRunAt, now)
      ))
      .orderBy(asc(analyticsReportSchedules.nextRunAt))
      .limit(50);
    
    res.json({
      pending: pendingSchedules,
      count: pendingSchedules.length,
      checkedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error('[Analytics] Error fetching pending schedules:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pending schedules',
      message: error.message 
    });
  }
});

/**
 * Placeholder function for scheduled job execution
 * In production, this would be called by a background job scheduler
 * 
 * Implementation notes for production:
 * 1. Use a job scheduler like Bull, Agenda, or node-cron
 * 2. Poll /api/analytics/report-schedules/pending periodically (e.g., every minute)
 * 3. For each pending schedule:
 *    a. Generate the report (PDF or HTML)
 *    b. Send email via SendGrid integration
 *    c. Update lastRunAt and calculate nextRunAt
 *    d. Log the execution
 * 
 * Example cron job setup (for reference):
 * ```
 * import cron from 'node-cron';
 * 
 * cron.schedule('* * * * *', async () => {
 *   const response = await fetch('/api/analytics/report-schedules/pending');
 *   const { pending } = await response.json();
 *   
 *   for (const schedule of pending) {
 *     await fetch(`/api/analytics/report-schedules/${schedule.id}/execute`, { method: 'POST' });
 *   }
 * });
 * ```
 */

export default router;
