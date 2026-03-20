/**
 * Institutional Analysis API Routes
 *
 * Endpoints for PE/institutional-grade financial analysis:
 * - IRR decomposition & return attribution
 * - Mark-to-market rent roll analysis
 * - CapEx budget & deferred maintenance
 * - Stabilized vs in-place NOI
 * - Hold period cash flow summary
 * - PE waterfall distributions
 * - Fund metrics (MOIC/DPI/RVPI/TVPI)
 * - Replacement cost analysis
 * - Loan sizing calculator
 * - Macro stress tests
 * - Depreciation schedule
 * - Comp adjustment grid
 * - Operator benchmarking
 * - Excel export engine
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  institutionalAnalysisService,
  PRESET_STRESS_SCENARIOS,
} from '../services/institutional-analysis-service';

const router = Router();

// ============================================================================
// 1. IRR DECOMPOSITION
// ============================================================================

router.post('/irr-decomposition', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      purchasePrice: z.number().positive(),
      equityInvested: z.number().positive(),
      loanAmount: z.number().min(0),
      interestRate: z.number().min(0).max(1),
      amortizationMonths: z.number().int().min(0),
      holdPeriodYears: z.number().int().positive(),
      year1NOI: z.number().positive(),
      noiGrowthRate: z.number(),
      exitCapRate: z.number().positive().max(1),
      sellingCostPct: z.number().min(0).max(1),
      acquisitionDate: z.string(),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeReturnDecomposition(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing IRR decomposition:', error);
    res.status(400).json({ error: error.message || 'Failed to compute IRR decomposition' });
  }
});

// ============================================================================
// 2. MARK-TO-MARKET
// ============================================================================

router.post('/mark-to-market', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      units: z.array(z.object({
        unitId: z.string(),
        unitName: z.string(),
        unitType: z.string(),
        size: z.string().optional(),
        currentRent: z.number().min(0),
        marketRent: z.number().min(0),
        leaseExpiry: z.string().optional(),
        occupancyStatus: z.enum(['occupied', 'vacant', 'pending']),
      })),
      purchasePrice: z.number().positive(),
      expenseRatio: z.number().min(0).max(1).optional(),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeMarkToMarket(
      body.units, body.purchasePrice, body.expenseRatio
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error computing mark-to-market:', error);
    res.status(400).json({ error: error.message || 'Failed to compute mark-to-market' });
  }
});

// ============================================================================
// 3. CAPEX BUDGET
// ============================================================================

router.post('/capex-budget', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      items: z.array(z.object({
        id: z.string(),
        category: z.enum(['deferred_maintenance', 'value_add', 'recurring', 'reserves', 'environmental']),
        name: z.string(),
        description: z.string().optional(),
        estimatedCost: z.number().min(0),
        yearPlanned: z.number().int().min(0),
        priority: z.enum(['critical', 'high', 'medium', 'low']),
        noiImpact: z.number().optional(),
        completionMonths: z.number().optional(),
      })),
      holdPeriodYears: z.number().int().positive(),
      currentNOI: z.number(),
      purchasePrice: z.number().positive(),
      totalUnits: z.number().int().positive(),
      exitCapRate: z.number().positive().max(1),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeCapExBudget(
      body.items, body.holdPeriodYears, body.currentNOI,
      body.purchasePrice, body.totalUnits, body.exitCapRate
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error computing CapEx budget:', error);
    res.status(400).json({ error: error.message || 'Failed to compute CapEx budget' });
  }
});

// ============================================================================
// 4. STABILIZED NOI
// ============================================================================

router.post('/stabilized-noi', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      currentRevenue: z.number(),
      currentExpenses: z.number(),
      purchasePrice: z.number().positive(),
      currentOccupancy: z.number().min(0).max(1),
      stabilizedOccupancy: z.number().min(0).max(1),
      lossToLease: z.number().min(0),
      newRevenueStreams: z.number().min(0),
      otherRevenueAdj: z.number(),
      operationalSavings: z.number().min(0),
      managementFeeChange: z.number(),
      insuranceChange: z.number(),
      otherExpenseAdj: z.number(),
      monthsToStabilize: z.number().int().positive(),
      exitCapRate: z.number().positive().max(1),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeStabilizedNOI(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing stabilized NOI:', error);
    res.status(400).json({ error: error.message || 'Failed to compute stabilized NOI' });
  }
});

// ============================================================================
// 5. HOLD PERIOD CASH FLOW SUMMARY
// ============================================================================

router.post('/hold-period-cf', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      purchasePrice: z.number().positive(),
      closingCostPct: z.number().min(0).max(0.2),
      equityInvested: z.number().positive(),
      loanAmount: z.number().min(0),
      interestRate: z.number().min(0).max(1),
      amortizationMonths: z.number().int().min(0),
      holdPeriodYears: z.number().int().positive(),
      year1NOI: z.number().positive(),
      noiGrowthRate: z.number(),
      exitCapRate: z.number().positive().max(1),
      sellingCostPct: z.number().min(0).max(0.2),
      annualCapEx: z.array(z.number().min(0)),
      discountRate: z.number().min(0),
      acquisitionDate: z.string(),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeHoldPeriodCF(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing hold period CF:', error);
    res.status(400).json({ error: error.message || 'Failed to compute hold period cash flow' });
  }
});

// ============================================================================
// 6. PE WATERFALL
// ============================================================================

router.post('/pe-waterfall', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      lpEquity: z.number().positive(),
      gpEquity: z.number().min(0),
      totalCashFlows: z.array(z.number()),
      terminalProceeds: z.number(),
      preferredRate: z.number().min(0).max(1),
      catchUpPct: z.number().min(0).max(1),
      carriedInterestPct: z.number().min(0).max(1),
      gpCoinvestPct: z.number().min(0).max(1),
      holdPeriodYears: z.number().int().positive(),
      interimDistributions: z.array(z.number()).optional(),
    }).parse(req.body);

    const result = institutionalAnalysisService.computePEWaterfall(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing PE waterfall:', error);
    res.status(400).json({ error: error.message || 'Failed to compute PE waterfall' });
  }
});

// ============================================================================
// 7. FUND METRICS
// ============================================================================

router.post('/fund-metrics', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      vintageYear: z.number().int(),
      capitalCommitments: z.number().positive(),
      capitalCalls: z.array(z.object({ date: z.string(), amount: z.number().positive() })),
      distributions: z.array(z.object({ date: z.string(), amount: z.number().min(0) })),
      currentNAV: z.number().min(0),
      managementFeePct: z.number().min(0).max(0.1),
      carryPct: z.number().min(0).max(0.5),
      hurdleRate: z.number().min(0).max(0.5),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeFundMetrics(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing fund metrics:', error);
    res.status(400).json({ error: error.message || 'Failed to compute fund metrics' });
  }
});

// ============================================================================
// 8. REPLACEMENT COST
// ============================================================================

router.post('/replacement-cost', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      acquisitionPrice: z.number().positive(),
      landValue: z.number().min(0),
      totalSlips: z.number().int().min(0),
      totalDryRacks: z.number().int().min(0),
      totalSF: z.number().min(0),
      floatingDockCostPerLF: z.number().min(0),
      fixedDockCostPerLF: z.number().min(0),
      pilingCostEach: z.number().min(0),
      numberOfPilings: z.number().int().min(0),
      electricalPerSlip: z.number().min(0),
      waterPerSlip: z.number().min(0),
      avgSlipLengthFt: z.number().positive(),
      dryRackCostPerRack: z.number().min(0),
      buildingCostPerSF: z.number().min(0),
      totalBuildingSF: z.number().min(0),
      siteworkPct: z.number().min(0).max(1),
      softCostPct: z.number().min(0).max(1),
      developerProfitPct: z.number().min(0).max(1),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeReplacementCost(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing replacement cost:', error);
    res.status(400).json({ error: error.message || 'Failed to compute replacement cost' });
  }
});

// ============================================================================
// 9. LOAN SIZING
// ============================================================================

router.post('/loan-sizing', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      propertyValue: z.number().positive(),
      noi: z.number().positive(),
      interestRate: z.number().min(0).max(1),
      amortizationMonths: z.number().int().min(0),
      maxLTV: z.number().min(0).max(1),
      minDSCR: z.number().positive(),
      minDebtYield: z.number().min(0).max(1),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeLoanSizing(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing loan sizing:', error);
    res.status(400).json({ error: error.message || 'Failed to compute loan sizing' });
  }
});

// ============================================================================
// 10. STRESS TESTS
// ============================================================================

router.get('/stress-test/presets', async (req: Request, res: Response) => {
  res.json(PRESET_STRESS_SCENARIOS);
});

router.post('/stress-test', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      baseNOI: z.number().positive(),
      purchasePrice: z.number().positive(),
      loanAmount: z.number().min(0),
      interestRate: z.number().min(0).max(1),
      amortizationMonths: z.number().int().min(0),
      exitCapRate: z.number().positive().max(1),
      equityInvested: z.number().positive(),
      holdPeriodYears: z.number().int().positive(),
      noiGrowthRate: z.number(),
      acquisitionDate: z.string(),
      scenarios: z.array(z.object({
        name: z.string(),
        description: z.string(),
        assumptions: z.object({
          capRateShift: z.number(),
          interestRateShift: z.number(),
          occupancyDrop: z.number(),
          revenueDecline: z.number(),
          expenseIncrease: z.number(),
          noiDecline: z.number(),
        }),
      })).optional(),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeStressTests(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing stress tests:', error);
    res.status(400).json({ error: error.message || 'Failed to compute stress tests' });
  }
});

// ============================================================================
// 11. DEPRECIATION
// ============================================================================

router.post('/depreciation', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      purchasePrice: z.number().positive(),
      landValue: z.number().min(0),
      improvementAllocations: z.array(z.object({
        assetClass: z.string(),
        amount: z.number().positive(),
        lifetimeYears: z.number().int().positive(),
        method: z.enum(['straight_line', 'macrs']),
      })),
      holdPeriodYears: z.number().int().positive(),
      taxRate: z.number().min(0).max(1),
      exitValue: z.number().min(0),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeDepreciation(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing depreciation:', error);
    res.status(400).json({ error: error.message || 'Failed to compute depreciation' });
  }
});

// ============================================================================
// 12. COMP ADJUSTMENT GRID
// ============================================================================

router.post('/comp-adjustment-grid', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      subjectName: z.string(),
      subjectIndicators: z.record(z.any()),
      subjectUnits: z.number().int().positive(),
      comps: z.array(z.object({
        compId: z.string(),
        name: z.string(),
        salePrice: z.number().positive(),
        units: z.number().int().positive(),
        adjustments: z.array(z.object({
          factor: z.string(),
          adjustmentType: z.enum(['dollar', 'percentage']),
          adjustment: z.number(),
          notes: z.string().optional(),
        })),
        weight: z.number().min(0).max(1),
      })),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeCompAdjustmentGrid(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing comp adjustments:', error);
    res.status(400).json({ error: error.message || 'Failed to compute comp adjustments' });
  }
});

// ============================================================================
// 13. OPERATOR BENCHMARKING
// ============================================================================

router.post('/operator-benchmark', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      subjectName: z.string(),
      subjectMetrics: z.record(z.number()),
      peerMetrics: z.array(z.record(z.number())),
      revenue: z.number().positive(),
      higherIsBetter: z.record(z.boolean()),
    }).parse(req.body);

    const result = institutionalAnalysisService.computeOperatorBenchmark(body);
    res.json(result);
  } catch (error: any) {
    console.error('Error computing operator benchmark:', error);
    res.status(400).json({ error: error.message || 'Failed to compute operator benchmark' });
  }
});

// ============================================================================
// 14. EXCEL EXPORT ENGINE
// ============================================================================

router.post('/export/excel', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      reportType: z.enum([
        'irr_decomposition', 'mark_to_market', 'capex_budget', 'stabilized_noi',
        'hold_period_cf', 'pe_waterfall', 'fund_metrics', 'replacement_cost',
        'loan_sizing', 'stress_test', 'depreciation', 'comp_adjustment', 'operator_benchmark',
      ]),
      data: z.any(),
      projectName: z.string().optional(),
    }).parse(req.body);

    // Generate CSV (universal Excel-compatible format without external deps)
    const rows: string[][] = [];
    const data = body.data;

    switch (body.reportType) {
      case 'hold_period_cf': {
        rows.push(['Hold Period Cash Flow Summary', body.projectName || '']);
        rows.push([]);
        rows.push(['Year', 'NOI', 'Debt Service', 'CF After Debt', 'CapEx', 'CF After CapEx', 'DSCR', 'Debt Yield', 'Cash-on-Cash', 'Loan Balance']);
        if (data.years) {
          data.years.forEach((y: any) => {
            rows.push([
              y.label, y.noi?.toFixed(0), y.debtService?.toFixed(0), y.cashFlowAfterDebt?.toFixed(0),
              y.capEx?.toFixed(0), y.cashFlowAfterCapEx?.toFixed(0), y.dscr?.toFixed(2),
              `${y.debtYield?.toFixed(2)}%`, `${y.cashOnCash?.toFixed(2)}%`, y.loanBalance?.toFixed(0),
            ]);
          });
        }
        rows.push([]);
        rows.push(['Return Metrics']);
        if (data.returnMetrics) {
          Object.entries(data.returnMetrics).forEach(([k, v]) => {
            rows.push([k, String(v)]);
          });
        }
        break;
      }
      case 'irr_decomposition': {
        rows.push(['Return Decomposition & Attribution', body.projectName || '']);
        rows.push([]);
        rows.push(['Metric', 'Value']);
        if (data) {
          rows.push(['Unlevered IRR', `${data.unleveredIRR?.toFixed(2)}%`]);
          rows.push(['Levered IRR', `${data.leveredIRR?.toFixed(2)}%`]);
          rows.push(['Equity Multiple', `${data.equityMultiple?.toFixed(2)}x`]);
          rows.push(['Going-In Cap Rate', `${data.goingInCapRate?.toFixed(2)}%`]);
          rows.push(['Exit Cap Rate', `${data.exitCapRate?.toFixed(2)}%`]);
          rows.push([]);
          rows.push(['Attribution Bridge']);
          rows.push(['Operations Yield', `${data.operationsYield?.toFixed(2)}%`]);
          rows.push(['Leverage Effect', `${data.leverageEffect?.toFixed(2)}%`]);
          rows.push(['Terminal Value Contribution', `${data.terminalValueContribution?.toFixed(2)}%`]);
          rows.push(['Cap Rate Compression', `${data.capRateCompressionEffect?.toFixed(2)}%`]);
          rows.push(['NOI Growth', `${data.noiGrowthContribution?.toFixed(2)}%`]);
          rows.push(['Debt Paydown', `${data.debtPaydownBenefit?.toFixed(2)}%`]);
        }
        break;
      }
      default: {
        rows.push([body.reportType, body.projectName || '']);
        rows.push([]);
        if (data && typeof data === 'object') {
          Object.entries(data).forEach(([key, value]) => {
            if (typeof value !== 'object') {
              rows.push([key, String(value)]);
            }
          });
        }
      }
    }

    const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${body.reportType}_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error: any) {
    console.error('Error generating export:', error);
    res.status(400).json({ error: error.message || 'Failed to generate export' });
  }
});

// ============================================================================
// 15. PER-UNIT METRIC NORMALIZATION
// ============================================================================

router.post('/normalize-metrics', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      metrics: z.record(z.number()),
      totalUnits: z.number().int().positive(),
      totalSF: z.number().positive().optional(),
      totalSlips: z.number().int().min(0).optional(),
      totalDryRacks: z.number().int().min(0).optional(),
    }).parse(req.body);

    const perUnit: Record<string, number> = {};
    const perSF: Record<string, number> = {};
    const perSlip: Record<string, number> = {};

    Object.entries(body.metrics).forEach(([key, value]) => {
      perUnit[key] = value / body.totalUnits;
      if (body.totalSF) perSF[key] = value / body.totalSF;
      if (body.totalSlips && body.totalSlips > 0) perSlip[key] = value / body.totalSlips;
    });

    res.json({
      absolute: body.metrics,
      perUnit,
      perSF: body.totalSF ? perSF : null,
      perSlip: body.totalSlips ? perSlip : null,
      normalizationBasis: {
        totalUnits: body.totalUnits,
        totalSF: body.totalSF || null,
        totalSlips: body.totalSlips || null,
        totalDryRacks: body.totalDryRacks || null,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to normalize metrics' });
  }
});

// ============================================================================
// 16. MARKET RENT GROWTH FROM COMP DATA
// ============================================================================

router.post('/market-rent-growth', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      rateComps: z.array(z.object({
        date: z.string(),
        ratePerFoot: z.number().positive(),
        boatLength: z.number().positive().optional(),
        storageType: z.string().optional(),
        location: z.string().optional(),
      })),
      yearsToAnalyze: z.number().int().positive().default(5),
    }).parse(req.body);

    // Sort by date
    const sorted = [...body.rateComps].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) {
      return res.json({ annualGrowthRate: 0.03, confidence: 'low', dataPoints: sorted.length, message: 'Insufficient data; defaulting to 3%' });
    }

    // Group by year
    const byYear = new Map<number, number[]>();
    sorted.forEach(comp => {
      const year = new Date(comp.date).getFullYear();
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year)!.push(comp.ratePerFoot);
    });

    const yearAvgs = Array.from(byYear.entries())
      .map(([year, rates]) => ({ year, avgRate: rates.reduce((s, r) => s + r, 0) / rates.length }))
      .sort((a, b) => a.year - b.year);

    if (yearAvgs.length < 2) {
      return res.json({ annualGrowthRate: 0.03, confidence: 'low', dataPoints: sorted.length, yearlyData: yearAvgs });
    }

    // Calculate CAGR
    const firstYear = yearAvgs[0];
    const lastYear = yearAvgs[yearAvgs.length - 1];
    const years = lastYear.year - firstYear.year;
    const cagr = years > 0 ? Math.pow(lastYear.avgRate / firstYear.avgRate, 1 / years) - 1 : 0;

    // Year-over-year growth rates
    const yoyGrowth: { year: number; growth: number }[] = [];
    for (let i = 1; i < yearAvgs.length; i++) {
      yoyGrowth.push({
        year: yearAvgs[i].year,
        growth: (yearAvgs[i].avgRate - yearAvgs[i - 1].avgRate) / yearAvgs[i - 1].avgRate,
      });
    }

    const avgYoY = yoyGrowth.reduce((s, g) => s + g.growth, 0) / yoyGrowth.length;
    const stdDev = Math.sqrt(yoyGrowth.reduce((s, g) => s + Math.pow(g.growth - avgYoY, 2), 0) / yoyGrowth.length);

    const confidence = sorted.length >= 20 && years >= 3 ? 'high'
      : sorted.length >= 10 && years >= 2 ? 'medium' : 'low';

    res.json({
      annualGrowthRate: cagr,
      averageYoYGrowth: avgYoY,
      cagr,
      stdDev,
      confidence,
      dataPoints: sorted.length,
      yearsOfData: years,
      yearlyData: yearAvgs,
      yoyGrowth,
      recommendedGrowthRate: Math.max(0, Math.min(cagr, 0.10)), // cap at 10%
      recommendedRange: { low: Math.max(0, cagr - stdDev), high: Math.min(0.10, cagr + stdDev) },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to compute market rent growth' });
  }
});

// ============================================================================
// 17. UNIFIED PDF REPORT PACKAGE
// ============================================================================

router.post('/export/pdf-package', async (req: Request, res: Response) => {
  try {
    const body = z.object({
      projectName: z.string(),
      sections: z.array(z.enum([
        'executive_summary', 'financial_summary', 'irr_decomposition', 'hold_period_cf',
        'mark_to_market', 'stabilized_noi', 'capex_budget', 'pe_waterfall',
        'stress_test', 'sensitivity', 'comps', 'demographics', 'recommendation',
      ])),
      data: z.record(z.any()),
      branding: z.object({
        firmName: z.string().optional(),
        preparedFor: z.string().optional(),
        preparedBy: z.string().optional(),
        date: z.string().optional(),
        confidential: z.boolean().optional(),
      }).optional(),
    }).parse(req.body);

    // Generate HTML-based PDF report (uses window.print() on client)
    const sections: { title: string; html: string }[] = [];
    const br = body.branding || {};

    // Cover page
    sections.push({
      title: 'Cover',
      html: `
        <div style="text-align: center; padding: 120px 40px;">
          <h1 style="font-size: 32px; margin-bottom: 8px;">${body.projectName}</h1>
          <h2 style="font-size: 20px; color: #666; margin-bottom: 40px;">Investment Memorandum</h2>
          ${br.firmName ? `<p style="font-size: 16px;">${br.firmName}</p>` : ''}
          ${br.preparedFor ? `<p>Prepared for: ${br.preparedFor}</p>` : ''}
          ${br.preparedBy ? `<p>Prepared by: ${br.preparedBy}</p>` : ''}
          <p>${br.date || new Date().toLocaleDateString()}</p>
          ${br.confidential ? '<p style="color: red; margin-top: 40px;">CONFIDENTIAL</p>' : ''}
        </div>
      `,
    });

    // Generate sections based on data
    for (const section of body.sections) {
      const sectionData = body.data[section];
      if (!sectionData) continue;

      switch (section) {
        case 'executive_summary':
          sections.push({
            title: 'Executive Summary',
            html: `<div><h2>Executive Summary</h2><p>${JSON.stringify(sectionData, null, 2)}</p></div>`,
          });
          break;
        case 'financial_summary':
          sections.push({
            title: 'Financial Summary',
            html: `<div><h2>Financial Summary</h2><pre>${JSON.stringify(sectionData, null, 2)}</pre></div>`,
          });
          break;
        default:
          sections.push({
            title: section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            html: `<div><h2>${section.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h2><pre style="white-space: pre-wrap;">${JSON.stringify(sectionData, null, 2)}</pre></div>`,
          });
      }
    }

    res.json({
      sections,
      generatedAt: new Date().toISOString(),
      projectName: body.projectName,
      pageCount: sections.length,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to generate PDF package' });
  }
});

// ============================================================================
// RENT ROLL → MARK-TO-MARKET BRIDGE
// ============================================================================

router.post('/rent-roll-mtm/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const orgId = (req as any).user?.orgId || (req as any).tenantId || 'org-1';

    // Import schema tables
    const { rentRolls, rentRollEntries, rateComps, modelingProjects } = await import('@shared/schema');
    const { db } = await import('../db');
    const { eq, and, desc } = await import('drizzle-orm');

    // Get project's rent rolls
    const projectRentRolls = await db.select().from(rentRolls)
      .where(and(eq(rentRolls.orgId, orgId), eq(rentRolls.modelingProjectId, projectId)))
      .orderBy(desc(rentRolls.createdAt))
      .limit(1);

    if (projectRentRolls.length === 0) {
      return res.json({ units: [], message: 'No rent roll found for this project' });
    }

    const rentRoll = projectRentRolls[0];

    // Get rent roll entries
    const entries = await db.select().from(rentRollEntries)
      .where(eq(rentRollEntries.rentRollId, rentRoll.id));

    // Get rate comps for market rate comparison (org-wide, latest)
    const marketRates = await db.select().from(rateComps)
      .where(eq(rateComps.orgId, orgId))
      .orderBy(desc(rateComps.createdAt))
      .limit(200);

    // Build market rate lookup by storage type and size
    const ratesByType = new Map<string, number[]>();
    for (const comp of marketRates) {
      const key = (comp as any).storageType || 'wet_slip';
      if (!ratesByType.has(key)) ratesByType.set(key, []);
      const rate = parseFloat((comp as any).monthlyRate || (comp as any).annualRate || '0');
      if (rate > 0) ratesByType.get(key)!.push(rate);
    }

    // Calculate median market rate per type
    const medianRate = (rates: number[]) => {
      if (rates.length === 0) return 0;
      const sorted = [...rates].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const marketMedians: Record<string, number> = {};
    for (const [type, rates] of ratesByType.entries()) {
      marketMedians[type] = medianRate(rates);
    }

    // Build mark-to-market units
    const units = entries.map(entry => {
      const currentRent = parseFloat((entry as any).monthlyRate || (entry as any).amount || '0');
      const unitType = (entry as any).storageType || (entry as any).entryType || 'wet_slip';
      const marketRent = marketMedians[unitType] || currentRent; // fallback to current if no comps

      return {
        unitId: entry.id,
        unitName: (entry as any).unitNumber || (entry as any).slipNumber || `Unit ${entry.id.slice(-4)}`,
        unitType,
        size: (entry as any).boatLength ? `${(entry as any).boatLength}ft` : '',
        currentRent,
        marketRent,
        leaseExpiry: (entry as any).leaseEndDate || undefined,
        occupancyStatus: ((entry as any).status === 'vacant' ? 'vacant' : 'occupied') as 'occupied' | 'vacant' | 'pending',
      };
    });

    // Get purchase price for cap rate impact
    const [project] = await db.select().from(modelingProjects)
      .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
    const purchasePrice = project?.purchasePrice ? parseFloat(project.purchasePrice) : 0;

    // Compute MTM using the institutional analysis service
    const { computeMarkToMarket } = await import('../services/institutional-analysis-service');
    const result = computeMarkToMarket(units, purchasePrice || 1);

    res.json({
      ...result,
      rentRollId: rentRoll.id,
      rentRollDate: rentRoll.createdAt,
      rateCompCount: marketRates.length,
      marketMedians,
    });
  } catch (error: any) {
    console.error('Error computing rent roll MTM:', error);
    res.status(400).json({ error: error.message || 'Failed to compute rent roll mark-to-market' });
  }
});

export default router;
