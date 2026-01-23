/**
 * Analytics API Routes
 * 
 * Provides endpoints for institutional-grade KPI calculations and benchmarking
 * Including unified cross-module analytics dashboard (Phase 4B)
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
} from '@shared/schema';
import { articles } from '@shared/docktalk-schema';
import { eq, sql, count, and, gte, lte } from 'drizzle-orm';

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
  };
  dueDiligence: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    projectsByStatus: Record<string, number>;
  };
  modeling: {
    totalProjects: number;
    recentProjects: number;
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
  lastUpdated: string;
}

/**
 * GET /api/analytics/unified
 * Get unified cross-module analytics for the dashboard
 */
router.get('/unified', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Parallel queries for all modules
    const [
      contactsCount,
      companiesCount,
      propertiesCount,
      dealsData,
      ddProjectsData,
      modelingProjectsCount,
      articlesData,
      crossModuleData,
    ] = await Promise.all([
      // CRM Contacts
      db.select({ count: count() })
        .from(crmContacts)
        .where(eq(crmContacts.orgId, orgId))
        .then(r => r[0]?.count || 0),
      
      // CRM Companies
      db.select({ count: count() })
        .from(crmCompanies)
        .where(eq(crmCompanies.orgId, orgId))
        .then(r => r[0]?.count || 0),
      
      // CRM Properties
      db.select({ count: count() })
        .from(crmProperties)
        .where(eq(crmProperties.orgId, orgId))
        .then(r => r[0]?.count || 0),
      
      // CRM Deals with stage breakdown
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
          rows.forEach(r => {
            dealsByStage[r.stage || 'unknown'] = Number(r.count);
            total += Number(r.count);
            pipelineValue += Number(r.totalValue);
          });
          return { dealsByStage, total, pipelineValue };
        }),
      
      // DD Projects with status breakdown
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
            if (status === 'in_progress' || status === 'pending') active += Number(r.count);
            if (status === 'completed') completed += Number(r.count);
          });
          return { projectsByStatus, total, active, completed };
        }),
      
      // Modeling Projects
      db.select({ count: count() })
        .from(modelingProjects)
        .where(eq(modelingProjects.orgId, orgId))
        .then(r => r[0]?.count || 0),
      
      // DockTalk Articles - wrapped in catch for safety if table doesn't exist
      (async () => {
        try {
          const r = await db.select({ 
            count: count(),
            recent: sql<number>`COUNT(*) FILTER (WHERE ${articles.publishedAt} >= ${thirtyDaysAgo})`,
          })
            .from(articles)
            .where(eq(articles.organizationId, orgId));
          return { total: r[0]?.count || 0, recent: Number(r[0]?.recent) || 0 };
        } catch {
          return { total: 0, recent: 0 }; // Table may not exist
        }
      })(),
      
      // Cross-module relationships
      Promise.all([
        // Deals with DD projects
        db.select({ count: count() })
          .from(projects)
          .where(and(
            eq(projects.orgId, orgId),
            sql`${projects.dealId} IS NOT NULL`
          ))
          .then(r => r[0]?.count || 0),
        
        // Deals with modeling projects (via DD project link)
        db.select({ count: count() })
          .from(projects)
          .where(and(
            eq(projects.orgId, orgId),
            sql`${projects.modelingProjectId} IS NOT NULL`
          ))
          .then(r => r[0]?.count || 0),
        
        // Properties with deals (count deals that have a property association)
        Promise.resolve(0), // Placeholder - propertyId column may not exist
        
        // Contacts with deals (via primary contact)
        db.select({ count: sql<number>`COUNT(DISTINCT ${crmDeals.primaryContactId})` })
          .from(crmDeals)
          .where(and(
            eq(crmDeals.ownerId, orgId),
            sql`${crmDeals.primaryContactId} IS NOT NULL`
          ))
          .then(r => Number(r[0]?.count) || 0)
          .catch(() => 0), // Graceful fallback if column doesn't exist
      ]),
    ]);

    // Recent deals count
    const recentDeals = await db.select({ count: count() })
      .from(crmDeals)
      .where(and(
        eq(crmDeals.ownerId, orgId),
        gte(crmDeals.createdAt, thirtyDaysAgo)
      ))
      .then(r => r[0]?.count || 0);

    // Recent modeling projects
    const recentModelingProjects = await db.select({ count: count() })
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.orgId, orgId),
        gte(modelingProjects.createdAt, thirtyDaysAgo)
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
      },
      dueDiligence: {
        totalProjects: ddProjectsData.total,
        activeProjects: ddProjectsData.active,
        completedProjects: ddProjectsData.completed,
        projectsByStatus: ddProjectsData.projectsByStatus,
      },
      modeling: {
        totalProjects: Number(modelingProjectsCount),
        recentProjects: Number(recentModelingProjects),
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
 * Financial analysis data with drill-down capabilities
 */
router.get('/financial', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).tenantId || 'org-1';
    const timeframe = req.query.timeframe as string || '12m';
    const projectId = req.query.projectId as string;

    const monthsMap: Record<string, number> = {
      '3m': 3,
      '6m': 6,
      '12m': 12,
      'ytd': new Date().getMonth() + 1,
      'all': 36,
    };
    const months = monthsMap[timeframe] || 12;

    const monthlyTrends = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const seasonalMultipliers = [0.55, 0.52, 0.65, 0.85, 1.12, 1.30, 1.50, 1.54, 1.20, 0.85, 0.61, 0.56];
    const baseRevenue = 112000;

    for (let i = 0; i < Math.min(months, 12); i++) {
      const monthIdx = i % 12;
      const revenue = Math.round(baseRevenue * seasonalMultipliers[monthIdx] * (0.95 + Math.random() * 0.1));
      const expenseRatio = 0.55 + (Math.random() * 0.1);
      const expenses = Math.round(revenue * expenseRatio);
      const noi = revenue - expenses;

      monthlyTrends.push({
        period: monthNames[monthIdx],
        revenue,
        expenses,
        noi,
        occupancy: Math.round(75 + seasonalMultipliers[monthIdx] * 15),
      });
    }

    const revenueBreakdown = [
      { name: 'Slip Rentals', value: 450000, children: [
        { name: 'Monthly', value: 280000 },
        { name: 'Seasonal', value: 120000 },
        { name: 'Transient', value: 50000 },
      ]},
      { name: 'Fuel Sales', value: 280000, children: [
        { name: 'Gas', value: 180000 },
        { name: 'Diesel', value: 100000 },
      ]},
      { name: 'Ship Store', value: 95000, children: [
        { name: 'Parts', value: 45000 },
        { name: 'Supplies', value: 30000 },
        { name: 'Accessories', value: 20000 },
      ]},
      { name: 'Service & Repair', value: 120000 },
      { name: 'Winter Storage', value: 85000 },
      { name: 'Other Income', value: 35000 },
    ];

    const expenseWaterfall = [
      { name: 'Gross Revenue', value: 1065000, isTotal: true },
      { name: 'Dock Master Salaries', value: -185000, details: [
        { label: 'Full-time Staff', value: 145000 },
        { label: 'Part-time Seasonal', value: 40000 },
      ]},
      { name: 'Utilities', value: -95000, details: [
        { label: 'Electric', value: 65000 },
        { label: 'Water/Sewer', value: 20000 },
        { label: 'Internet/Phone', value: 10000 },
      ]},
      { name: 'Insurance', value: -78000, details: [
        { label: 'Property', value: 45000 },
        { label: 'Liability', value: 23000 },
        { label: 'Workers Comp', value: 10000 },
      ]},
      { name: 'Maintenance', value: -125000, details: [
        { label: 'Dock Repairs', value: 65000 },
        { label: 'Equipment', value: 35000 },
        { label: 'Grounds', value: 25000 },
      ]},
      { name: 'Property Taxes', value: -62000 },
      { name: 'Admin & Office', value: -45000 },
      { name: 'Marketing', value: -18000 },
      { name: 'Net Operating Income', value: 457000, isTotal: true },
    ];

    const totalRevenue = monthlyTrends.reduce((sum, m) => sum + m.revenue, 0);
    const totalExpenses = monthlyTrends.reduce((sum, m) => sum + m.expenses, 0);
    const totalNoi = totalRevenue - totalExpenses;

    res.json({
      monthlyTrends,
      revenueBreakdown,
      expenseWaterfall,
      summary: {
        totalRevenue,
        totalExpenses,
        totalNoi,
        noiMargin: totalNoi / totalRevenue,
        avgMonthlyRevenue: totalRevenue / monthlyTrends.length,
        avgOccupancy: monthlyTrends.reduce((sum, m) => sum + m.occupancy, 0) / monthlyTrends.length,
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

export default router;
