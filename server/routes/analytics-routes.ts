/**
 * Analytics API Routes
 * 
 * Provides endpoints for institutional-grade KPI calculations and benchmarking
 */

import { Router, Request, Response } from 'express';
import { marinaKpiCalculator } from '../services/analytics';
import { z } from 'zod';

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

export default router;
