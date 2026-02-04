/**
 * Enhanced Debt Modeling API Routes
 * 
 * Provides endpoints for:
 * - Blended loan calculations
 * - Loan comparison analysis
 * - Monthly amortization schedules
 * - DSCR covenant testing
 * - Cash flow integration
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { enhancedDebtService, type LoanInputs } from '../services/enhanced-debt-service';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const loanInputSchema = z.object({
  name: z.string().min(1),
  principal: z.number().positive(),
  interestRate: z.number().min(0).max(1), // As decimal, e.g., 0.065
  termMonths: z.number().int().positive(),
  amortizationMonths: z.number().int().positive(),
  interestOnlyMonths: z.number().int().min(0).default(0),
  loanPurpose: z.enum(['acquisition', 'construction', 'bridge', 'permanent', 'refinancing', 'mezzanine', 'preferred_equity', 'line_of_credit']).default('acquisition'),
  lenderName: z.string().optional(),
  ltvAtOrigination: z.number().min(0).max(100).optional(),
  exitFeePct: z.number().min(0).optional(),
  exitFeeAmount: z.number().min(0).optional(),
  prepaymentPenaltyType: z.enum(['none', 'declining_balance', 'yield_maintenance', 'defeasance', 'step_down', 'lockout', 'custom']).optional(),
  prepaymentSchedule: z.array(z.object({
    yearStart: z.number().int(),
    yearEnd: z.number().int(),
    penaltyPct: z.number()
  })).optional(),
  dscrMinimum: z.number().min(0).optional(),
  dscrTestFrequency: z.enum(['monthly', 'quarterly', 'semi_annual', 'annual', 'at_closing', 'at_maturity']).optional(),
  dscrTestStartMonth: z.number().int().positive().optional(),
  isFloatingRate: z.boolean().optional(),
  floatingRateIndex: z.string().optional(),
  floatingRateSpreadBps: z.number().int().optional(),
  rateCap: z.number().optional(),
  rateFloor: z.number().optional(),
});

const blendedLoansRequestSchema = z.object({
  loans: z.array(loanInputSchema),
  purchasePrice: z.number().positive(),
  noi: z.number().positive(),
});

const comparisonRequestSchema = z.object({
  loans: z.array(loanInputSchema),
  noi: z.number().positive(),
  holdPeriodMonths: z.number().int().positive().default(60),
});

const amortizationRequestSchema = z.object({
  loan: loanInputSchema,
  holdPeriodMonths: z.number().int().positive().default(60),
  annualNoi: z.number().positive().optional(),
  startYear: z.number().int().optional(),
});

const dscrTestRequestSchema = z.object({
  loan: loanInputSchema,
  holdPeriodMonths: z.number().int().positive().default(60),
  annualNoi: z.number().positive(),
  noiGrowthRate: z.number().default(0.02),
  startYear: z.number().int().optional(),
});

const cashFlowRequestSchema = z.object({
  loans: z.array(loanInputSchema),
  annualNoi: z.number().positive(),
  noiGrowthRate: z.number().default(0.02),
  holdPeriodYears: z.number().int().positive().default(5),
  startYear: z.number().int().optional(),
});

const prepaymentRequestSchema = z.object({
  loan: loanInputSchema,
  prepaymentMonth: z.number().int().positive(),
  outstandingBalance: z.number().positive(),
});

const loanTransitionRequestSchema = z.object({
  currentLoan: loanInputSchema,
  newLoan: loanInputSchema,
  transitionMonth: z.number().int().positive(),
  noi: z.number().positive(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getOrgAndUser(req: Request): { orgId: string; userId: string } {
  const user = (req as any).user;
  if (!user?.orgId) throw new Error('Unauthorized - no org context');
  return { orgId: user.orgId, userId: user.id };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/debt/blended-metrics
 * Calculate blended metrics for multiple loans combined
 */
router.post('/blended-metrics', async (req: Request, res: Response) => {
  try {
    const { loans, purchasePrice, noi } = blendedLoansRequestSchema.parse(req.body);
    const result = enhancedDebtService.calculateBlendedMetrics(loans, purchasePrice, noi);
    res.json(result);
  } catch (error: any) {
    console.error('Error calculating blended metrics:', error);
    res.status(400).json({ error: error.message || 'Failed to calculate blended metrics' });
  }
});

/**
 * POST /api/debt/compare-loans
 * Compare multiple loan scenarios side-by-side
 */
router.post('/compare-loans', async (req: Request, res: Response) => {
  try {
    const { loans, noi, holdPeriodMonths } = comparisonRequestSchema.parse(req.body);
    const result = enhancedDebtService.compareLoanScenarios(loans, noi, holdPeriodMonths);
    res.json(result);
  } catch (error: any) {
    console.error('Error comparing loans:', error);
    res.status(400).json({ error: error.message || 'Failed to compare loans' });
  }
});

/**
 * POST /api/debt/amortization-schedule
 * Generate monthly amortization schedule with DSCR tracking
 */
router.post('/amortization-schedule', async (req: Request, res: Response) => {
  try {
    const { loan, holdPeriodMonths, annualNoi, startYear } = amortizationRequestSchema.parse(req.body);
    const result = enhancedDebtService.generateAmortizationSchedule(
      loan, 
      holdPeriodMonths, 
      annualNoi,
      startYear || new Date().getFullYear()
    );
    res.json({
      schedule: result,
      summary: {
        totalPayments: result.reduce((sum, p) => sum + p.scheduledPayment, 0),
        totalInterest: result.reduce((sum, p) => sum + p.interestPayment, 0),
        totalPrincipal: result.reduce((sum, p) => sum + p.principalPayment, 0),
        endingBalance: result[result.length - 1]?.endingBalance || 0,
        periodCount: result.length,
      }
    });
  } catch (error: any) {
    console.error('Error generating amortization schedule:', error);
    res.status(400).json({ error: error.message || 'Failed to generate amortization schedule' });
  }
});

/**
 * POST /api/debt/dscr-tests
 * Generate DSCR test schedule and results
 */
router.post('/dscr-tests', async (req: Request, res: Response) => {
  try {
    const { loan, holdPeriodMonths, annualNoi, noiGrowthRate, startYear } = dscrTestRequestSchema.parse(req.body);
    
    const tests = enhancedDebtService.generateDscrTestSchedule(
      loan,
      holdPeriodMonths,
      annualNoi,
      noiGrowthRate,
      startYear || new Date().getFullYear()
    );
    
    const results = tests.map(test => ({
      ...test,
      testDate: test.testDate.toISOString().split('T')[0],
      result: enhancedDebtService.runDscrTest(test),
    }));
    
    const passedCount = results.filter(r => r.result.passed).length;
    const failedCount = results.length - passedCount;
    
    res.json({
      tests: results,
      summary: {
        totalTests: results.length,
        passed: passedCount,
        failed: failedCount,
        passRate: results.length > 0 ? (passedCount / results.length) * 100 : 0,
        minDscr: Math.min(...results.map(r => r.result.calculatedDscr)),
        maxDscr: Math.max(...results.map(r => r.result.calculatedDscr)),
        avgDscr: results.reduce((sum, r) => sum + r.result.calculatedDscr, 0) / results.length,
      }
    });
  } catch (error: any) {
    console.error('Error generating DSCR tests:', error);
    res.status(400).json({ error: error.message || 'Failed to generate DSCR tests' });
  }
});

/**
 * POST /api/debt/cash-flow
 * Generate annual cash flow with debt service integration
 */
router.post('/cash-flow', async (req: Request, res: Response) => {
  try {
    const { loans, annualNoi, noiGrowthRate, holdPeriodYears, startYear } = cashFlowRequestSchema.parse(req.body);
    const result = enhancedDebtService.generateAnnualCashFlowWithDebt(
      loans,
      annualNoi,
      noiGrowthRate,
      holdPeriodYears,
      startYear || new Date().getFullYear()
    );
    
    // Calculate totals
    const totals = {
      totalNoi: result.reduce((sum, y) => sum + y.noi, 0),
      totalDebtService: result.reduce((sum, y) => sum + y.totalDebtService, 0),
      totalCashFlow: result.reduce((sum, y) => sum + y.cashFlowAfterDebt, 0),
      avgDscr: result.reduce((sum, y) => sum + y.dscr, 0) / result.length,
      totalPrincipalPaydown: result.reduce((sum, y) => sum + y.principalPaydown, 0),
      totalInterest: result.reduce((sum, y) => sum + y.interestExpense, 0),
    };
    
    res.json({
      yearlyData: result,
      totals,
    });
  } catch (error: any) {
    console.error('Error generating cash flow:', error);
    res.status(400).json({ error: error.message || 'Failed to generate cash flow' });
  }
});

/**
 * POST /api/debt/prepayment-penalty
 * Calculate prepayment penalty at a given month
 */
router.post('/prepayment-penalty', async (req: Request, res: Response) => {
  try {
    const { loan, prepaymentMonth, outstandingBalance } = prepaymentRequestSchema.parse(req.body);
    const result = enhancedDebtService.calculatePrepaymentPenalty(loan, prepaymentMonth, outstandingBalance);
    res.json(result);
  } catch (error: any) {
    console.error('Error calculating prepayment penalty:', error);
    res.status(400).json({ error: error.message || 'Failed to calculate prepayment penalty' });
  }
});

/**
 * POST /api/debt/exit-fees
 * Calculate exit fees at a given month
 */
router.post('/exit-fees', async (req: Request, res: Response) => {
  try {
    const { loan, prepaymentMonth, outstandingBalance } = prepaymentRequestSchema.parse(req.body);
    const result = enhancedDebtService.calculateExitFees(loan, prepaymentMonth, outstandingBalance);
    res.json(result);
  } catch (error: any) {
    console.error('Error calculating exit fees:', error);
    res.status(400).json({ error: error.message || 'Failed to calculate exit fees' });
  }
});

/**
 * POST /api/debt/loan-transition
 * Calculate loan transition (bridge to perm, refinancing)
 */
router.post('/loan-transition', async (req: Request, res: Response) => {
  try {
    const { currentLoan, newLoan, transitionMonth, noi } = loanTransitionRequestSchema.parse(req.body);
    const result = enhancedDebtService.calculateLoanTransition(currentLoan, newLoan, transitionMonth, noi);
    res.json(result);
  } catch (error: any) {
    console.error('Error calculating loan transition:', error);
    res.status(400).json({ error: error.message || 'Failed to calculate loan transition' });
  }
});

/**
 * GET /api/debt/loan-structure-templates
 * Get common loan structure templates
 */
router.get('/loan-structure-templates', async (req: Request, res: Response) => {
  try {
    const templates = [
      {
        id: 'single-senior',
        name: 'Single Senior Loan',
        description: 'Traditional senior debt with fixed rate',
        loans: [
          {
            name: 'Senior Debt',
            loanPurpose: 'acquisition',
            ltv: 65,
            interestRate: 0.065,
            termMonths: 120,
            amortizationMonths: 360,
            interestOnlyMonths: 0,
            prepaymentPenaltyType: 'step_down',
          }
        ]
      },
      {
        id: 'senior-mezz',
        name: 'Senior + Mezzanine',
        description: 'Senior debt with mezzanine layer for higher leverage',
        loans: [
          {
            name: 'Senior Debt',
            loanPurpose: 'acquisition',
            ltv: 60,
            interestRate: 0.055,
            termMonths: 120,
            amortizationMonths: 300,
            interestOnlyMonths: 0,
          },
          {
            name: 'Mezzanine',
            loanPurpose: 'mezzanine',
            ltv: 15,
            interestRate: 0.12,
            termMonths: 60,
            amortizationMonths: 60,
            interestOnlyMonths: 24,
          }
        ]
      },
      {
        id: 'bridge-to-perm',
        name: 'Bridge to Permanent',
        description: 'Short-term bridge financing with permanent takeout',
        loans: [
          {
            name: 'Bridge Loan',
            loanPurpose: 'bridge',
            ltv: 75,
            interestRate: 0.085,
            termMonths: 36,
            amortizationMonths: 0, // IO only
            interestOnlyMonths: 36,
          },
          {
            name: 'Permanent Loan',
            loanPurpose: 'permanent',
            ltv: 65,
            interestRate: 0.055,
            termMonths: 120,
            amortizationMonths: 300,
            interestOnlyMonths: 0,
            transitionFromBridge: true,
          }
        ]
      },
      {
        id: 'construction',
        name: 'Construction + Takeout',
        description: 'Development financing with permanent takeout',
        loans: [
          {
            name: 'Construction Loan',
            loanPurpose: 'construction',
            ltv: 70,
            interestRate: 0.075,
            termMonths: 24,
            amortizationMonths: 0,
            interestOnlyMonths: 24,
            isDrawLoan: true,
          },
          {
            name: 'Permanent Takeout',
            loanPurpose: 'permanent',
            ltv: 65,
            interestRate: 0.06,
            termMonths: 120,
            amortizationMonths: 360,
            interestOnlyMonths: 0,
          }
        ]
      },
      {
        id: 'three-loan-stack',
        name: 'Three-Loan Stack',
        description: 'Senior, mezz, and preferred equity for maximum leverage',
        loans: [
          {
            name: 'Senior Debt',
            loanPurpose: 'acquisition',
            ltv: 55,
            interestRate: 0.05,
            termMonths: 120,
            amortizationMonths: 300,
            interestOnlyMonths: 0,
          },
          {
            name: 'Mezzanine',
            loanPurpose: 'mezzanine',
            ltv: 15,
            interestRate: 0.11,
            termMonths: 84,
            amortizationMonths: 84,
            interestOnlyMonths: 24,
          },
          {
            name: 'Preferred Equity',
            loanPurpose: 'preferred_equity',
            ltv: 10,
            interestRate: 0.14,
            termMonths: 60,
            amortizationMonths: 60,
            interestOnlyMonths: 36,
          }
        ]
      },
      {
        id: 'sba-504',
        name: 'SBA 504 Structure',
        description: 'Bank loan + CDC loan for small business acquisition',
        loans: [
          {
            name: 'Bank Loan (50%)',
            loanPurpose: 'acquisition',
            ltv: 50,
            interestRate: 0.065,
            termMonths: 120,
            amortizationMonths: 300,
            interestOnlyMonths: 0,
          },
          {
            name: 'CDC Loan (40%)',
            loanPurpose: 'acquisition',
            ltv: 40,
            interestRate: 0.045,
            termMonths: 240,
            amortizationMonths: 240,
            interestOnlyMonths: 0,
          }
        ]
      }
    ];
    
    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching loan templates:', error);
    res.status(500).json({ error: 'Failed to fetch loan templates' });
  }
});

/**
 * POST /api/debt/exit-waterfall
 * Calculate exit proceeds and equity waterfall distribution
 */
const exitWaterfallRequestSchema = z.object({
  loans: z.array(loanInputSchema),
  holdPeriodMonths: z.number().positive(),
  noi: z.number().positive(),
  noiGrowthRate: z.number().optional().default(0.02),
  exitCapRate: z.number().positive(),
  purchasePrice: z.number().positive(),
  equityInvested: z.number().positive(),
  promoteTiers: z.array(z.object({
    irrHurdle: z.number(),
    gpSplit: z.number(),
    lpSplit: z.number(),
  })).optional(),
  gpContribution: z.number().optional().default(0.10),
});

router.post('/exit-waterfall', async (req: Request, res: Response) => {
  try {
    const data = exitWaterfallRequestSchema.parse(req.body);
    const result = enhancedDebtService.calculateExitWaterfall(
      data.loans,
      data.holdPeriodMonths,
      data.noi,
      data.noiGrowthRate,
      data.exitCapRate,
      data.purchasePrice,
      data.equityInvested,
      data.promoteTiers || [
        { irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 },
        { irrHurdle: 0.12, gpSplit: 0.30, lpSplit: 0.70 },
        { irrHurdle: 0.15, gpSplit: 0.35, lpSplit: 0.65 },
      ],
      data.gpContribution
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error calculating exit waterfall:', error);
    res.status(400).json({ error: error.message || 'Failed to calculate exit waterfall' });
  }
});

/**
 * POST /api/debt/capital-stack-report
 * Generate comprehensive capital stack report
 */
const capitalStackReportRequestSchema = z.object({
  loans: z.array(loanInputSchema),
  purchasePrice: z.number().positive(),
  noi: z.number().positive(),
  holdPeriodMonths: z.number().positive(),
  noiGrowthRate: z.number().optional().default(0.02),
  exitCapRate: z.number().optional().default(0.07),
  equityInvested: z.number().optional(),
});

router.post('/capital-stack-report', async (req: Request, res: Response) => {
  try {
    const data = capitalStackReportRequestSchema.parse(req.body);
    const result = enhancedDebtService.generateCapitalStackReport(
      data.loans,
      data.purchasePrice,
      data.noi,
      data.holdPeriodMonths,
      data.noiGrowthRate,
      data.exitCapRate,
      data.equityInvested
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error generating capital stack report:', error);
    res.status(400).json({ error: error.message || 'Failed to generate report' });
  }
});

export default router;
