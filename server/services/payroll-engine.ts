/**
 * Payroll Processing Engine
 * =========================
 * Full-cycle payroll processing: gross pay computation, federal/state tax
 * withholding (2024 brackets), FICA/Medicare, benefits deductions, OT,
 * PTO accrual, workers' comp, and double-entry journal entry generation.
 *
 * Tables used: payroll_plans, payroll_plan_lines, payroll_employees,
 * payroll_positions, payroll_burden_profiles, payroll_weekly_hours,
 * payroll_runs, payroll_stubs, payroll_timesheets, payroll_pto_requests,
 * payroll_benefit_plans, payroll_benefit_enrollments, payroll_journal_entries
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import Decimal from 'decimal.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const FICA_RATE = new Decimal('0.062');
const FICA_WAGE_BASE_2024 = new Decimal('168600');
const MEDICARE_RATE = new Decimal('0.0145');
const ADDITIONAL_MEDICARE_RATE = new Decimal('0.009');
const ADDITIONAL_MEDICARE_THRESHOLD = new Decimal('200000');
const CONTRIB_401K_LIMIT_2024 = new Decimal('23000');

// ─── Federal Tax Brackets 2024 ────────────────────────────────────────────

interface TaxBracket {
  min: Decimal;
  max: Decimal;
  rate: Decimal;
}

const FEDERAL_STANDARD_DEDUCTION: Record<string, Decimal> = {
  single: new Decimal('14600'),
  married_joint: new Decimal('29200'),
  married_separate: new Decimal('14600'),
  head_of_household: new Decimal('21900'),
};

const FEDERAL_BRACKETS: Record<string, TaxBracket[]> = {
  single: [
    { min: new Decimal(0), max: new Decimal(11600), rate: new Decimal('0.10') },
    { min: new Decimal(11600), max: new Decimal(47150), rate: new Decimal('0.12') },
    { min: new Decimal(47150), max: new Decimal(100525), rate: new Decimal('0.22') },
    { min: new Decimal(100525), max: new Decimal(191950), rate: new Decimal('0.24') },
    { min: new Decimal(191950), max: new Decimal(243725), rate: new Decimal('0.32') },
    { min: new Decimal(243725), max: new Decimal(609350), rate: new Decimal('0.35') },
    { min: new Decimal(609350), max: new Decimal(Infinity), rate: new Decimal('0.37') },
  ],
  married_joint: [
    { min: new Decimal(0), max: new Decimal(23200), rate: new Decimal('0.10') },
    { min: new Decimal(23200), max: new Decimal(94300), rate: new Decimal('0.12') },
    { min: new Decimal(94300), max: new Decimal(201050), rate: new Decimal('0.22') },
    { min: new Decimal(201050), max: new Decimal(383900), rate: new Decimal('0.24') },
    { min: new Decimal(383900), max: new Decimal(487450), rate: new Decimal('0.32') },
    { min: new Decimal(487450), max: new Decimal(731200), rate: new Decimal('0.35') },
    { min: new Decimal(731200), max: new Decimal(Infinity), rate: new Decimal('0.37') },
  ],
  married_separate: [
    { min: new Decimal(0), max: new Decimal(11600), rate: new Decimal('0.10') },
    { min: new Decimal(11600), max: new Decimal(47150), rate: new Decimal('0.12') },
    { min: new Decimal(47150), max: new Decimal(100525), rate: new Decimal('0.22') },
    { min: new Decimal(100525), max: new Decimal(191950), rate: new Decimal('0.24') },
    { min: new Decimal(191950), max: new Decimal(243725), rate: new Decimal('0.32') },
    { min: new Decimal(243725), max: new Decimal(365600), rate: new Decimal('0.35') },
    { min: new Decimal(365600), max: new Decimal(Infinity), rate: new Decimal('0.37') },
  ],
  head_of_household: [
    { min: new Decimal(0), max: new Decimal(16550), rate: new Decimal('0.10') },
    { min: new Decimal(16550), max: new Decimal(63100), rate: new Decimal('0.12') },
    { min: new Decimal(63100), max: new Decimal(100500), rate: new Decimal('0.22') },
    { min: new Decimal(100500), max: new Decimal(191950), rate: new Decimal('0.24') },
    { min: new Decimal(191950), max: new Decimal(243700), rate: new Decimal('0.32') },
    { min: new Decimal(243700), max: new Decimal(609350), rate: new Decimal('0.35') },
    { min: new Decimal(609350), max: new Decimal(Infinity), rate: new Decimal('0.37') },
  ],
};

// ─── State Tax Configuration ───────────────────────────────────────────────

type StateType = 'none' | 'flat' | 'progressive';

interface StateConfig {
  type: StateType;
  flatRate?: Decimal;
  brackets?: TaxBracket[];
  standardDeduction?: Decimal;
}

const NO_INCOME_TAX_STATES = new Set([
  'AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY',
]);

const STATE_TAX_CONFIG: Record<string, StateConfig> = {
  // No-income-tax states
  AK: { type: 'none' }, FL: { type: 'none' }, NV: { type: 'none' },
  NH: { type: 'none' }, SD: { type: 'none' }, TN: { type: 'none' },
  TX: { type: 'none' }, WA: { type: 'none' }, WY: { type: 'none' },

  // Flat-rate states
  CO: { type: 'flat', flatRate: new Decimal('0.044') },
  IL: { type: 'flat', flatRate: new Decimal('0.0495') },
  IN: { type: 'flat', flatRate: new Decimal('0.0305') },
  KY: { type: 'flat', flatRate: new Decimal('0.04') },
  MA: { type: 'flat', flatRate: new Decimal('0.05') },
  MI: { type: 'flat', flatRate: new Decimal('0.0425') },
  NC: { type: 'flat', flatRate: new Decimal('0.0475') },
  PA: { type: 'flat', flatRate: new Decimal('0.0307') },
  UT: { type: 'flat', flatRate: new Decimal('0.0465') },
  AZ: { type: 'flat', flatRate: new Decimal('0.025') },

  // Progressive states — top 15 by population
  CA: {
    type: 'progressive',
    standardDeduction: new Decimal('5363'),
    brackets: [
      { min: new Decimal(0), max: new Decimal(10412), rate: new Decimal('0.01') },
      { min: new Decimal(10412), max: new Decimal(24684), rate: new Decimal('0.02') },
      { min: new Decimal(24684), max: new Decimal(38959), rate: new Decimal('0.04') },
      { min: new Decimal(38959), max: new Decimal(54081), rate: new Decimal('0.06') },
      { min: new Decimal(54081), max: new Decimal(68350), rate: new Decimal('0.08') },
      { min: new Decimal(68350), max: new Decimal(349137), rate: new Decimal('0.093') },
      { min: new Decimal(349137), max: new Decimal(418961), rate: new Decimal('0.103') },
      { min: new Decimal(418961), max: new Decimal(698271), rate: new Decimal('0.113') },
      { min: new Decimal(698271), max: new Decimal(1000000), rate: new Decimal('0.123') },
      { min: new Decimal(1000000), max: new Decimal(Infinity), rate: new Decimal('0.133') },
    ],
  },
  NY: {
    type: 'progressive',
    standardDeduction: new Decimal('8000'),
    brackets: [
      { min: new Decimal(0), max: new Decimal(8500), rate: new Decimal('0.04') },
      { min: new Decimal(8500), max: new Decimal(11700), rate: new Decimal('0.045') },
      { min: new Decimal(11700), max: new Decimal(13900), rate: new Decimal('0.0525') },
      { min: new Decimal(13900), max: new Decimal(80650), rate: new Decimal('0.0585') },
      { min: new Decimal(80650), max: new Decimal(215400), rate: new Decimal('0.0625') },
      { min: new Decimal(215400), max: new Decimal(1077550), rate: new Decimal('0.0685') },
      { min: new Decimal(1077550), max: new Decimal(5000000), rate: new Decimal('0.0965') },
      { min: new Decimal(5000000), max: new Decimal(25000000), rate: new Decimal('0.103') },
      { min: new Decimal(25000000), max: new Decimal(Infinity), rate: new Decimal('0.109') },
    ],
  },
  NJ: {
    type: 'progressive',
    standardDeduction: new Decimal(0),
    brackets: [
      { min: new Decimal(0), max: new Decimal(20000), rate: new Decimal('0.014') },
      { min: new Decimal(20000), max: new Decimal(35000), rate: new Decimal('0.0175') },
      { min: new Decimal(35000), max: new Decimal(40000), rate: new Decimal('0.035') },
      { min: new Decimal(40000), max: new Decimal(75000), rate: new Decimal('0.05525') },
      { min: new Decimal(75000), max: new Decimal(500000), rate: new Decimal('0.0637') },
      { min: new Decimal(500000), max: new Decimal(1000000), rate: new Decimal('0.0897') },
      { min: new Decimal(1000000), max: new Decimal(Infinity), rate: new Decimal('0.1075') },
    ],
  },
  GA: {
    type: 'progressive',
    standardDeduction: new Decimal('5400'),
    brackets: [
      { min: new Decimal(0), max: new Decimal(750), rate: new Decimal('0.01') },
      { min: new Decimal(750), max: new Decimal(2250), rate: new Decimal('0.02') },
      { min: new Decimal(2250), max: new Decimal(3750), rate: new Decimal('0.03') },
      { min: new Decimal(3750), max: new Decimal(5250), rate: new Decimal('0.04') },
      { min: new Decimal(5250), max: new Decimal(7000), rate: new Decimal('0.05') },
      { min: new Decimal(7000), max: new Decimal(Infinity), rate: new Decimal('0.0549') },
    ],
  },
  OH: {
    type: 'progressive',
    standardDeduction: new Decimal(0),
    brackets: [
      { min: new Decimal(0), max: new Decimal(26050), rate: new Decimal('0') },
      { min: new Decimal(26050), max: new Decimal(100000), rate: new Decimal('0.02765') },
      { min: new Decimal(100000), max: new Decimal(Infinity), rate: new Decimal('0.035') },
    ],
  },
  VA: {
    type: 'progressive',
    standardDeduction: new Decimal('4500'),
    brackets: [
      { min: new Decimal(0), max: new Decimal(3000), rate: new Decimal('0.02') },
      { min: new Decimal(3000), max: new Decimal(5000), rate: new Decimal('0.03') },
      { min: new Decimal(5000), max: new Decimal(17000), rate: new Decimal('0.05') },
      { min: new Decimal(17000), max: new Decimal(Infinity), rate: new Decimal('0.0575') },
    ],
  },
  MN: {
    type: 'progressive',
    standardDeduction: new Decimal('14575'),
    brackets: [
      { min: new Decimal(0), max: new Decimal(31690), rate: new Decimal('0.0535') },
      { min: new Decimal(31690), max: new Decimal(104090), rate: new Decimal('0.068') },
      { min: new Decimal(104090), max: new Decimal(183340), rate: new Decimal('0.0785') },
      { min: new Decimal(183340), max: new Decimal(Infinity), rate: new Decimal('0.0985') },
    ],
  },
  WI: {
    type: 'progressive',
    standardDeduction: new Decimal('12760'),
    brackets: [
      { min: new Decimal(0), max: new Decimal(14320), rate: new Decimal('0.0354') },
      { min: new Decimal(14320), max: new Decimal(28640), rate: new Decimal('0.0465') },
      { min: new Decimal(28640), max: new Decimal(315310), rate: new Decimal('0.053') },
      { min: new Decimal(315310), max: new Decimal(Infinity), rate: new Decimal('0.0765') },
    ],
  },
  OR: {
    type: 'progressive',
    standardDeduction: new Decimal('2745'),
    brackets: [
      { min: new Decimal(0), max: new Decimal(4050), rate: new Decimal('0.0475') },
      { min: new Decimal(4050), max: new Decimal(10200), rate: new Decimal('0.0675') },
      { min: new Decimal(10200), max: new Decimal(125000), rate: new Decimal('0.0875') },
      { min: new Decimal(125000), max: new Decimal(Infinity), rate: new Decimal('0.099') },
    ],
  },
  CT: {
    type: 'progressive',
    standardDeduction: new Decimal(0),
    brackets: [
      { min: new Decimal(0), max: new Decimal(10000), rate: new Decimal('0.03') },
      { min: new Decimal(10000), max: new Decimal(50000), rate: new Decimal('0.05') },
      { min: new Decimal(50000), max: new Decimal(100000), rate: new Decimal('0.055') },
      { min: new Decimal(100000), max: new Decimal(200000), rate: new Decimal('0.06') },
      { min: new Decimal(200000), max: new Decimal(250000), rate: new Decimal('0.065') },
      { min: new Decimal(250000), max: new Decimal(500000), rate: new Decimal('0.069') },
      { min: new Decimal(500000), max: new Decimal(Infinity), rate: new Decimal('0.0699') },
    ],
  },
  MD: {
    type: 'progressive',
    standardDeduction: new Decimal('2400'),
    brackets: [
      { min: new Decimal(0), max: new Decimal(1000), rate: new Decimal('0.02') },
      { min: new Decimal(1000), max: new Decimal(2000), rate: new Decimal('0.03') },
      { min: new Decimal(2000), max: new Decimal(3000), rate: new Decimal('0.04') },
      { min: new Decimal(3000), max: new Decimal(100000), rate: new Decimal('0.0475') },
      { min: new Decimal(100000), max: new Decimal(125000), rate: new Decimal('0.05') },
      { min: new Decimal(125000), max: new Decimal(150000), rate: new Decimal('0.0525') },
      { min: new Decimal(150000), max: new Decimal(250000), rate: new Decimal('0.055') },
      { min: new Decimal(250000), max: new Decimal(Infinity), rate: new Decimal('0.0575') },
    ],
  },
};

// Default fallback for states not individually configured
const DEFAULT_STATE_FLAT_RATE = new Decimal('0.05');

// ─── Types ─────────────────────────────────────────────────────────────────

type PayFrequency = 'biweekly' | 'semi_monthly' | 'monthly';
type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household';
type RunStatus = 'draft' | 'calculated' | 'approved' | 'processed' | 'voided';
type BenefitType = 'health' | 'dental' | 'vision' | '401k' | 'hsa' | 'life' | 'disability';
type PtoStatus = 'pending' | 'approved' | 'denied' | 'cancelled';
type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

interface PayrollRunInput {
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  frequency: PayFrequency;
  description?: string;
}

interface PayrollStub {
  id: string;
  runId: string;
  employeeId: string;
  grossPay: string;
  regularPay: string;
  overtimePay: string;
  federalWithholding: string;
  stateWithholding: string;
  ficaTax: string;
  medicareTax: string;
  benefitDeductions: string;
  otherDeductions: string;
  netPay: string;
  ytdGross: string;
  ytdFederalWh: string;
  ytdStateWh: string;
  ytdFica: string;
  ytdMedicare: string;
  hoursWorked: string;
  overtimeHours: string;
  state: string;
  filingStatus: FilingStatus;
}

interface BenefitPlanInput {
  name: string;
  type: BenefitType;
  employeeContribution: string;
  employerContribution: string;
  coverageTier?: string;
  eligibilityWaitDays?: number;
  description?: string;
}

interface TimesheetInput {
  weekStartDate: string;
  entries: Array<{
    date: string;
    hoursRegular: number;
    hoursOvertime?: number;
    hoursDoubleTime?: number;
    notes?: string;
  }>;
}

interface PtoRequestInput {
  startDate: string;
  endDate: string;
  hoursRequested: number;
  reason?: string;
  ptoType: 'vacation' | 'sick' | 'personal' | 'bereavement' | 'jury_duty';
}

interface PtoPolicyInput {
  name: string;
  accrualRate: string;
  accrualFrequency: 'annual' | 'monthly' | 'per_pay_period';
  maxBalance: string;
  carryoverMax: string;
  waitingPeriodDays: number;
}

// ─── Tax Calculation Helpers ───────────────────────────────────────────────

function computeProgressiveTax(taxableIncome: Decimal, brackets: TaxBracket[]): Decimal {
  let tax = new Decimal(0);
  for (const bracket of brackets) {
    if (taxableIncome.lte(bracket.min)) break;
    const taxableInBracket = Decimal.min(taxableIncome, bracket.max).minus(bracket.min);
    tax = tax.plus(taxableInBracket.times(bracket.rate));
  }
  return tax;
}

function periodsPerYear(frequency: PayFrequency): number {
  switch (frequency) {
    case 'biweekly': return 26;
    case 'semi_monthly': return 24;
    case 'monthly': return 12;
    default: return 26;
  }
}

// ─── Payroll Engine ────────────────────────────────────────────────────────

class PayrollEngine {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Federal Tax Withholding (IRS Publication 15-T, 2024)
  // ═══════════════════════════════════════════════════════════════════════

  calculateFederalWithholding(
    annualizedGross: number,
    filingStatus: FilingStatus,
    _allowances: number = 0,
  ): { annualTax: number; perPeriodTax: number; effectiveRate: number } {
    const gross = new Decimal(annualizedGross);
    const stdDeduction = FEDERAL_STANDARD_DEDUCTION[filingStatus] || FEDERAL_STANDARD_DEDUCTION.single;
    const taxableIncome = Decimal.max(gross.minus(stdDeduction), 0);
    const brackets = FEDERAL_BRACKETS[filingStatus] || FEDERAL_BRACKETS.single;
    const annualTax = computeProgressiveTax(taxableIncome, brackets);
    const effectiveRate = gross.gt(0) ? annualTax.div(gross) : new Decimal(0);
    return {
      annualTax: annualTax.toDecimalPlaces(2).toNumber(),
      perPeriodTax: annualTax.toDecimalPlaces(2).toNumber(), // caller divides by periods
      effectiveRate: effectiveRate.toDecimalPlaces(6).toNumber(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. State Tax Withholding (all 50 states)
  // ═══════════════════════════════════════════════════════════════════════

  calculateStateWithholding(
    annualizedGross: number,
    state: string,
    _filingStatus: FilingStatus = 'single',
  ): { annualTax: number; effectiveRate: number } {
    const stateUpper = state.toUpperCase();
    if (NO_INCOME_TAX_STATES.has(stateUpper)) {
      return { annualTax: 0, effectiveRate: 0 };
    }

    const gross = new Decimal(annualizedGross);
    const config = STATE_TAX_CONFIG[stateUpper];

    if (!config || config.type === 'none') {
      return { annualTax: 0, effectiveRate: 0 };
    }

    let annualTax: Decimal;

    if (config.type === 'flat') {
      annualTax = gross.times(config.flatRate!);
    } else {
      const deduction = config.standardDeduction || new Decimal(0);
      const taxable = Decimal.max(gross.minus(deduction), 0);
      annualTax = computeProgressiveTax(taxable, config.brackets!);
    }

    const effectiveRate = gross.gt(0) ? annualTax.div(gross) : new Decimal(0);
    return {
      annualTax: annualTax.toDecimalPlaces(2).toNumber(),
      effectiveRate: effectiveRate.toDecimalPlaces(6).toNumber(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. FICA / Medicare
  // ═══════════════════════════════════════════════════════════════════════

  calculateFICA(grossPay: number, ytdGross: number): { employee: number; employer: number } {
    const gross = new Decimal(grossPay);
    const ytd = new Decimal(ytdGross);
    const remaining = Decimal.max(FICA_WAGE_BASE_2024.minus(ytd), 0);
    const taxableGross = Decimal.min(gross, remaining);
    const tax = taxableGross.times(FICA_RATE).toDecimalPlaces(2).toNumber();
    return { employee: tax, employer: tax };
  }

  calculateMedicare(grossPay: number, ytdGross: number): { employee: number; employer: number } {
    const gross = new Decimal(grossPay);
    const ytd = new Decimal(ytdGross);
    let employeeTax = gross.times(MEDICARE_RATE);

    // Additional Medicare Tax: 0.9% on wages over $200k (employee only)
    const totalAfter = ytd.plus(gross);
    if (totalAfter.gt(ADDITIONAL_MEDICARE_THRESHOLD)) {
      const additionalBase = totalAfter.gt(ADDITIONAL_MEDICARE_THRESHOLD)
        ? Decimal.min(gross, totalAfter.minus(Decimal.max(ytd, ADDITIONAL_MEDICARE_THRESHOLD)))
        : new Decimal(0);
      if (additionalBase.gt(0)) {
        employeeTax = employeeTax.plus(additionalBase.times(ADDITIONAL_MEDICARE_RATE));
      }
    }

    const employerTax = gross.times(MEDICARE_RATE);
    return {
      employee: employeeTax.toDecimalPlaces(2).toNumber(),
      employer: employerTax.toDecimalPlaces(2).toNumber(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Overtime Calculation
  // ═══════════════════════════════════════════════════════════════════════

  calculateOvertime(
    weeklyHours: number,
    hourlyRate: number,
    state: string = 'XX',
  ): { regularHours: number; overtimeHours: number; doubleTimeHours: number; totalPay: number } {
    const rate = new Decimal(hourlyRate);
    const stateUpper = state.toUpperCase();
    let regularHours = Math.min(weeklyHours, 40);
    let overtimeHours = 0;
    let doubleTimeHours = 0;

    // California daily OT rules apply at weekly level: >8h/day = 1.5x, >12h/day = 2x
    // At weekly level: >40h = 1.5x, >60h (CA) = 2x
    if (stateUpper === 'CA') {
      if (weeklyHours > 60) {
        doubleTimeHours = weeklyHours - 60;
        overtimeHours = 20; // 40-60
        regularHours = 40;
      } else if (weeklyHours > 40) {
        overtimeHours = weeklyHours - 40;
        regularHours = 40;
      }
    } else {
      // Federal FLSA: >40h = 1.5x
      if (weeklyHours > 40) {
        overtimeHours = weeklyHours - 40;
        regularHours = 40;
      }
    }

    const regularPay = rate.times(regularHours);
    const overtimePay = rate.times(1.5).times(overtimeHours);
    const doubleTimePay = rate.times(2).times(doubleTimeHours);
    const totalPay = regularPay.plus(overtimePay).plus(doubleTimePay);

    return {
      regularHours,
      overtimeHours,
      doubleTimeHours,
      totalPay: totalPay.toDecimalPlaces(2).toNumber(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. Payroll Run Processing
  // ═══════════════════════════════════════════════════════════════════════

  async initializePayrollRun(orgId: string, data: PayrollRunInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO payroll_runs (
        id, org_id, pay_period_start, pay_period_end, pay_date,
        frequency, description, status, created_at
      ) VALUES (
        ${id}, ${orgId}, ${data.payPeriodStart}, ${data.payPeriodEnd},
        ${data.payDate}, ${data.frequency}, ${data.description || null},
        'draft', NOW()
      )
    `);
    return { id };
  }

  async calculatePayrollRun(orgId: string, runId: string): Promise<{ stubCount: number; totalGross: number; totalNet: number }> {
    // Fetch the run
    const runResult = await db.execute(sql`
      SELECT * FROM payroll_runs WHERE id = ${runId} AND org_id = ${orgId}
    `);
    const run = (runResult as any).rows?.[0];
    if (!run) throw new Error('Payroll run not found');
    if (run.status !== 'draft') throw new Error(`Cannot calculate run in status: ${run.status}`);

    const frequency: PayFrequency = run.frequency;
    const periods = periodsPerYear(frequency);

    // Fetch all active employees
    const empResult = await db.execute(sql`
      SELECT e.*, p.annual_salary, p.hourly_rate, p.pay_type,
             p.department, p.id as position_id
      FROM payroll_employees e
      JOIN payroll_positions p ON p.employee_id = e.id AND p.org_id = e.org_id
      WHERE e.org_id = ${orgId} AND e.status = 'active'
    `);
    const employees = (empResult as any).rows || [];

    let totalGross = new Decimal(0);
    let totalNet = new Decimal(0);
    let stubCount = 0;

    // Delete existing stubs for re-calculation
    await db.execute(sql`DELETE FROM payroll_stubs WHERE run_id = ${runId}`);

    for (const emp of employees) {
      const filingStatus: FilingStatus = emp.filing_status || 'single';
      const state = emp.work_state || emp.state || 'TX';

      // Compute gross pay
      let grossPay: Decimal;
      let regularPay: Decimal;
      let overtimePay = new Decimal(0);
      let overtimeHours = 0;
      let hoursWorked = 0;

      if (emp.pay_type === 'salary') {
        grossPay = new Decimal(emp.annual_salary).div(periods);
        regularPay = grossPay;
        hoursWorked = frequency === 'biweekly' ? 80 : frequency === 'semi_monthly' ? 86.67 : 173.33;
      } else {
        // Hourly: look up timesheet hours for the pay period
        const tsResult = await db.execute(sql`
          SELECT COALESCE(SUM(hours_regular), 0) as reg_hours,
                 COALESCE(SUM(hours_overtime), 0) as ot_hours,
                 COALESCE(SUM(hours_double_time), 0) as dt_hours
          FROM payroll_timesheets
          WHERE employee_id = ${emp.id} AND org_id = ${orgId}
            AND week_start_date >= ${run.pay_period_start}
            AND week_start_date <= ${run.pay_period_end}
            AND status = 'approved'
        `);
        const ts = (tsResult as any).rows?.[0] || { reg_hours: 0, ot_hours: 0, dt_hours: 0 };
        const rate = new Decimal(emp.hourly_rate || 0);
        hoursWorked = Number(ts.reg_hours) + Number(ts.ot_hours) + Number(ts.dt_hours);
        overtimeHours = Number(ts.ot_hours);
        regularPay = rate.times(Number(ts.reg_hours));
        overtimePay = rate.times(1.5).times(Number(ts.ot_hours))
          .plus(rate.times(2).times(Number(ts.dt_hours)));
        grossPay = regularPay.plus(overtimePay);
      }

      // YTD gross for FICA/Medicare cap calculations
      const ytdResult = await db.execute(sql`
        SELECT COALESCE(SUM(s.gross_pay::numeric), 0) as ytd_gross,
               COALESCE(SUM(s.federal_withholding::numeric), 0) as ytd_fed,
               COALESCE(SUM(s.state_withholding::numeric), 0) as ytd_state,
               COALESCE(SUM(s.fica_tax::numeric), 0) as ytd_fica,
               COALESCE(SUM(s.medicare_tax::numeric), 0) as ytd_medicare
        FROM payroll_stubs s
        JOIN payroll_runs r ON r.id = s.run_id
        WHERE s.employee_id = ${emp.id} AND r.org_id = ${orgId}
          AND r.status = 'processed'
          AND EXTRACT(YEAR FROM r.pay_date::date) = EXTRACT(YEAR FROM ${run.pay_date}::date)
      `);
      const ytd = (ytdResult as any).rows?.[0] || {};
      const ytdGross = Number(ytd.ytd_gross || 0);

      // Annualize for tax withholding
      const annualized = grossPay.times(periods).toNumber();

      // Federal withholding
      const fedResult = this.calculateFederalWithholding(annualized, filingStatus);
      const federalWh = new Decimal(fedResult.annualTax).div(periods);

      // State withholding
      const stateResult = this.calculateStateWithholding(annualized, state, filingStatus);
      const stateWh = new Decimal(stateResult.annualTax).div(periods);

      // FICA
      const fica = this.calculateFICA(grossPay.toNumber(), ytdGross);
      const ficaTax = new Decimal(fica.employee);

      // Medicare
      const medicare = this.calculateMedicare(grossPay.toNumber(), ytdGross);
      const medicareTax = new Decimal(medicare.employee);

      // Benefits deductions
      const benefitDeductions = await this._calculateBenefitDeductionsInternal(orgId, emp.id, frequency);

      // Net pay
      const netPay = grossPay
        .minus(federalWh)
        .minus(stateWh)
        .minus(ficaTax)
        .minus(medicareTax)
        .minus(benefitDeductions);

      const stubId = crypto.randomUUID();
      await db.execute(sql`
        INSERT INTO payroll_stubs (
          id, run_id, employee_id, gross_pay, regular_pay, overtime_pay,
          federal_withholding, state_withholding, fica_tax, medicare_tax,
          benefit_deductions, other_deductions, net_pay,
          ytd_gross, ytd_federal_wh, ytd_state_wh, ytd_fica, ytd_medicare,
          hours_worked, overtime_hours, state, filing_status, created_at
        ) VALUES (
          ${stubId}, ${runId}, ${emp.id},
          ${grossPay.toDecimalPlaces(2).toString()},
          ${regularPay.toDecimalPlaces(2).toString()},
          ${overtimePay.toDecimalPlaces(2).toString()},
          ${federalWh.toDecimalPlaces(2).toString()},
          ${stateWh.toDecimalPlaces(2).toString()},
          ${ficaTax.toDecimalPlaces(2).toString()},
          ${medicareTax.toDecimalPlaces(2).toString()},
          ${benefitDeductions.toDecimalPlaces(2).toString()},
          '0.00',
          ${netPay.toDecimalPlaces(2).toString()},
          ${new Decimal(ytdGross).plus(grossPay).toDecimalPlaces(2).toString()},
          ${new Decimal(ytd.ytd_fed || 0).plus(federalWh).toDecimalPlaces(2).toString()},
          ${new Decimal(ytd.ytd_state || 0).plus(stateWh).toDecimalPlaces(2).toString()},
          ${new Decimal(ytd.ytd_fica || 0).plus(ficaTax).toDecimalPlaces(2).toString()},
          ${new Decimal(ytd.ytd_medicare || 0).plus(medicareTax).toDecimalPlaces(2).toString()},
          ${hoursWorked.toString()}, ${overtimeHours.toString()},
          ${state}, ${filingStatus}, NOW()
        )
      `);

      totalGross = totalGross.plus(grossPay);
      totalNet = totalNet.plus(netPay);
      stubCount++;
    }

    // Update run totals
    await db.execute(sql`
      UPDATE payroll_runs
      SET status = 'calculated',
          total_gross = ${totalGross.toDecimalPlaces(2).toString()},
          total_net = ${totalNet.toDecimalPlaces(2).toString()},
          employee_count = ${stubCount},
          calculated_at = NOW()
      WHERE id = ${runId} AND org_id = ${orgId}
    `);

    return {
      stubCount,
      totalGross: totalGross.toDecimalPlaces(2).toNumber(),
      totalNet: totalNet.toDecimalPlaces(2).toNumber(),
    };
  }

  async approvePayrollRun(orgId: string, runId: string, userId: string): Promise<void> {
    const result = await db.execute(sql`
      UPDATE payroll_runs
      SET status = 'approved', approved_by = ${userId}, approved_at = NOW()
      WHERE id = ${runId} AND org_id = ${orgId} AND status = 'calculated'
    `);
    if ((result as any).rowCount === 0) {
      throw new Error('Run not found or not in calculated status');
    }
  }

  async processPayrollRun(orgId: string, runId: string): Promise<{ journalEntryId: string }> {
    const result = await db.execute(sql`
      UPDATE payroll_runs
      SET status = 'processed', processed_at = NOW()
      WHERE id = ${runId} AND org_id = ${orgId} AND status = 'approved'
    `);
    if ((result as any).rowCount === 0) {
      throw new Error('Run not found or not in approved status');
    }

    // Generate the journal entry
    const jeId = await this.generatePayrollJE(orgId, runId);
    return { journalEntryId: jeId };
  }

  async voidPayrollRun(orgId: string, runId: string, reason: string): Promise<{ reversalJeId: string }> {
    const runResult = await db.execute(sql`
      SELECT * FROM payroll_runs WHERE id = ${runId} AND org_id = ${orgId}
    `);
    const run = (runResult as any).rows?.[0];
    if (!run) throw new Error('Payroll run not found');
    if (run.status !== 'processed') throw new Error('Only processed runs can be voided');

    await db.execute(sql`
      UPDATE payroll_runs
      SET status = 'voided', voided_at = NOW(), void_reason = ${reason}
      WHERE id = ${runId} AND org_id = ${orgId}
    `);

    // Generate reversal JE (negate all amounts)
    const reversalId = await this._generateReversalJE(orgId, runId, reason);
    return { reversalJeId: reversalId };
  }

  async getPayrollRun(orgId: string, runId: string): Promise<any> {
    const runResult = await db.execute(sql`
      SELECT * FROM payroll_runs WHERE id = ${runId} AND org_id = ${orgId}
    `);
    const run = (runResult as any).rows?.[0];
    if (!run) return null;

    const stubsResult = await db.execute(sql`
      SELECT s.*, e.first_name, e.last_name, e.employee_number
      FROM payroll_stubs s
      JOIN payroll_employees e ON e.id = s.employee_id
      WHERE s.run_id = ${runId}
      ORDER BY e.last_name, e.first_name
    `);

    return {
      id: run.id,
      orgId: run.org_id,
      payPeriodStart: run.pay_period_start,
      payPeriodEnd: run.pay_period_end,
      payDate: run.pay_date,
      frequency: run.frequency,
      status: run.status,
      totalGross: run.total_gross,
      totalNet: run.total_net,
      employeeCount: run.employee_count,
      description: run.description,
      approvedBy: run.approved_by,
      approvedAt: run.approved_at,
      processedAt: run.processed_at,
      voidedAt: run.voided_at,
      voidReason: run.void_reason,
      createdAt: run.created_at,
      stubs: ((stubsResult as any).rows || []).map((s: any) => ({
        id: s.id,
        employeeId: s.employee_id,
        employeeName: `${s.first_name} ${s.last_name}`,
        employeeNumber: s.employee_number,
        grossPay: s.gross_pay,
        regularPay: s.regular_pay,
        overtimePay: s.overtime_pay,
        federalWithholding: s.federal_withholding,
        stateWithholding: s.state_withholding,
        ficaTax: s.fica_tax,
        medicareTax: s.medicare_tax,
        benefitDeductions: s.benefit_deductions,
        otherDeductions: s.other_deductions,
        netPay: s.net_pay,
        ytdGross: s.ytd_gross,
        hoursWorked: s.hours_worked,
        overtimeHours: s.overtime_hours,
        state: s.state,
        filingStatus: s.filing_status,
      })),
    };
  }

  async listPayrollRuns(
    orgId: string,
    filters?: { status?: RunStatus; year?: number; limit?: number; offset?: number },
  ): Promise<{ runs: any[]; total: number }> {
    const status = filters?.status;
    const year = filters?.year;
    const limit = filters?.limit || 25;
    const offset = filters?.offset || 0;

    let whereClause = sql`org_id = ${orgId}`;
    if (status) whereClause = sql`${whereClause} AND status = ${status}`;
    if (year) whereClause = sql`${whereClause} AND EXTRACT(YEAR FROM pay_date::date) = ${year}`;

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM payroll_runs WHERE ${whereClause}
    `);
    const total = Number((countResult as any).rows?.[0]?.total || 0);

    const runsResult = await db.execute(sql`
      SELECT * FROM payroll_runs
      WHERE ${whereClause}
      ORDER BY pay_date DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const runs = ((runsResult as any).rows || []).map((r: any) => ({
      id: r.id,
      payPeriodStart: r.pay_period_start,
      payPeriodEnd: r.pay_period_end,
      payDate: r.pay_date,
      frequency: r.frequency,
      status: r.status,
      totalGross: r.total_gross,
      totalNet: r.total_net,
      employeeCount: r.employee_count,
      description: r.description,
      createdAt: r.created_at,
    }));

    return { runs, total };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. Benefits Administration
  // ═══════════════════════════════════════════════════════════════════════

  async createBenefitPlan(orgId: string, data: BenefitPlanInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO payroll_benefit_plans (
        id, org_id, name, type, employee_contribution, employer_contribution,
        coverage_tier, eligibility_wait_days, description, active, created_at
      ) VALUES (
        ${id}, ${orgId}, ${data.name}, ${data.type},
        ${data.employeeContribution}, ${data.employerContribution},
        ${data.coverageTier || 'employee_only'}, ${data.eligibilityWaitDays || 0},
        ${data.description || null}, true, NOW()
      )
    `);
    return { id };
  }

  async getBenefitPlans(orgId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT * FROM payroll_benefit_plans
      WHERE org_id = ${orgId} AND active = true
      ORDER BY type, name
    `);
    return ((result as any).rows || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      employeeContribution: p.employee_contribution,
      employerContribution: p.employer_contribution,
      coverageTier: p.coverage_tier,
      eligibilityWaitDays: p.eligibility_wait_days,
      description: p.description,
    }));
  }

  async enrollEmployee(orgId: string, employeeId: string, benefitPlanId: string): Promise<{ id: string }> {
    // Check eligibility (wait period)
    const planResult = await db.execute(sql`
      SELECT * FROM payroll_benefit_plans WHERE id = ${benefitPlanId} AND org_id = ${orgId}
    `);
    const plan = (planResult as any).rows?.[0];
    if (!plan) throw new Error('Benefit plan not found');

    const empResult = await db.execute(sql`
      SELECT hire_date FROM payroll_employees WHERE id = ${employeeId} AND org_id = ${orgId}
    `);
    const emp = (empResult as any).rows?.[0];
    if (!emp) throw new Error('Employee not found');

    if (plan.eligibility_wait_days > 0) {
      const hireDate = new Date(emp.hire_date);
      const eligibleDate = new Date(hireDate);
      eligibleDate.setDate(eligibleDate.getDate() + plan.eligibility_wait_days);
      if (new Date() < eligibleDate) {
        throw new Error(`Employee not eligible until ${eligibleDate.toISOString().split('T')[0]}`);
      }
    }

    // Check for duplicate enrollment
    const existingResult = await db.execute(sql`
      SELECT id FROM payroll_benefit_enrollments
      WHERE employee_id = ${employeeId} AND benefit_plan_id = ${benefitPlanId}
        AND org_id = ${orgId} AND status = 'active'
    `);
    if (((existingResult as any).rows || []).length > 0) {
      throw new Error('Employee already enrolled in this plan');
    }

    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO payroll_benefit_enrollments (
        id, org_id, employee_id, benefit_plan_id, status,
        enrollment_date, created_at
      ) VALUES (
        ${id}, ${orgId}, ${employeeId}, ${benefitPlanId},
        'active', NOW()::date, NOW()
      )
    `);
    return { id };
  }

  async calculateBenefitDeductions(orgId: string, employeeId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT e.id as enrollment_id, p.name, p.type,
             p.employee_contribution, p.employer_contribution
      FROM payroll_benefit_enrollments e
      JOIN payroll_benefit_plans p ON p.id = e.benefit_plan_id
      WHERE e.employee_id = ${employeeId} AND e.org_id = ${orgId}
        AND e.status = 'active' AND p.active = true
    `);
    return ((result as any).rows || []).map((r: any) => ({
      enrollmentId: r.enrollment_id,
      planName: r.name,
      planType: r.type,
      employeeContribution: r.employee_contribution,
      employerContribution: r.employer_contribution,
    }));
  }

  async get401kContributions(
    orgId: string,
    employeeId: string,
  ): Promise<{ ytdContributions: number; limit: number; remaining: number; onTrack: boolean }> {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(s.benefit_deductions::numeric), 0) as total_deductions
      FROM payroll_stubs s
      JOIN payroll_runs r ON r.id = s.run_id
      WHERE s.employee_id = ${employeeId} AND r.org_id = ${orgId}
        AND r.status = 'processed'
        AND EXTRACT(YEAR FROM r.pay_date::date) = EXTRACT(YEAR FROM NOW())
    `);

    // Get 401k-specific deductions from enrollments
    const enrollResult = await db.execute(sql`
      SELECT p.employee_contribution
      FROM payroll_benefit_enrollments e
      JOIN payroll_benefit_plans p ON p.id = e.benefit_plan_id
      WHERE e.employee_id = ${employeeId} AND e.org_id = ${orgId}
        AND e.status = 'active' AND p.type = '401k'
    `);
    const enrollment = (enrollResult as any).rows?.[0];

    // Estimate YTD 401k contributions from processed stubs
    const stubs401kResult = await db.execute(sql`
      SELECT COUNT(*) as stub_count
      FROM payroll_stubs s
      JOIN payroll_runs r ON r.id = s.run_id
      WHERE s.employee_id = ${employeeId} AND r.org_id = ${orgId}
        AND r.status = 'processed'
        AND EXTRACT(YEAR FROM r.pay_date::date) = EXTRACT(YEAR FROM NOW())
    `);
    const stubCount = Number((stubs401kResult as any).rows?.[0]?.stub_count || 0);
    const perPayPeriod = enrollment ? Number(enrollment.employee_contribution) : 0;
    const ytdContributions = new Decimal(perPayPeriod).times(stubCount).toNumber();
    const limit = CONTRIB_401K_LIMIT_2024.toNumber();
    const remaining = Math.max(limit - ytdContributions, 0);

    // On track if projected annual contributions would approach the limit
    const projectedAnnual = stubCount > 0 ? (ytdContributions / stubCount) * 26 : 0;
    const onTrack = projectedAnnual >= limit * 0.9;

    return { ytdContributions, limit, remaining, onTrack };
  }

  /** Internal helper: sum benefit deductions for one employee per pay period */
  private async _calculateBenefitDeductionsInternal(
    orgId: string,
    employeeId: string,
    _frequency: PayFrequency,
  ): Promise<Decimal> {
    const result = await db.execute(sql`
      SELECT COALESCE(SUM(p.employee_contribution::numeric), 0) as total
      FROM payroll_benefit_enrollments e
      JOIN payroll_benefit_plans p ON p.id = e.benefit_plan_id
      WHERE e.employee_id = ${employeeId} AND e.org_id = ${orgId}
        AND e.status = 'active' AND p.active = true
    `);
    return new Decimal((result as any).rows?.[0]?.total || 0);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. Time & Attendance
  // ═══════════════════════════════════════════════════════════════════════

  async submitTimesheet(orgId: string, employeeId: string, data: TimesheetInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();

    let totalRegular = 0;
    let totalOvertime = 0;
    let totalDoubleTime = 0;

    for (const entry of data.entries) {
      totalRegular += entry.hoursRegular;
      totalOvertime += entry.hoursOvertime || 0;
      totalDoubleTime += entry.hoursDoubleTime || 0;
    }

    await db.execute(sql`
      INSERT INTO payroll_timesheets (
        id, org_id, employee_id, week_start_date,
        hours_regular, hours_overtime, hours_double_time,
        status, entries, submitted_at, created_at
      ) VALUES (
        ${id}, ${orgId}, ${employeeId}, ${data.weekStartDate},
        ${totalRegular.toString()}, ${totalOvertime.toString()},
        ${totalDoubleTime.toString()},
        'submitted', ${JSON.stringify(data.entries)}::jsonb,
        NOW(), NOW()
      )
    `);
    return { id };
  }

  async approveTimesheet(orgId: string, timesheetId: string, userId: string): Promise<void> {
    const result = await db.execute(sql`
      UPDATE payroll_timesheets
      SET status = 'approved', approved_by = ${userId}, approved_at = NOW()
      WHERE id = ${timesheetId} AND org_id = ${orgId} AND status = 'submitted'
    `);
    if ((result as any).rowCount === 0) {
      throw new Error('Timesheet not found or not in submitted status');
    }
  }

  async getTimesheetSummary(
    orgId: string,
    employeeId: string,
    payPeriodStart: string,
    payPeriodEnd: string,
  ): Promise<{ regularHours: number; overtimeHours: number; doubleTimeHours: number; totalHours: number }> {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(hours_regular::numeric), 0) as regular_hours,
        COALESCE(SUM(hours_overtime::numeric), 0) as overtime_hours,
        COALESCE(SUM(hours_double_time::numeric), 0) as double_time_hours
      FROM payroll_timesheets
      WHERE employee_id = ${employeeId} AND org_id = ${orgId}
        AND week_start_date >= ${payPeriodStart}
        AND week_start_date <= ${payPeriodEnd}
        AND status IN ('submitted', 'approved')
    `);
    const row = (result as any).rows?.[0] || {};
    const regular = Number(row.regular_hours || 0);
    const overtime = Number(row.overtime_hours || 0);
    const doubleTime = Number(row.double_time_hours || 0);
    return {
      regularHours: regular,
      overtimeHours: overtime,
      doubleTimeHours: doubleTime,
      totalHours: regular + overtime + doubleTime,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 8. PTO / Leave Tracking
  // ═══════════════════════════════════════════════════════════════════════

  async createPtoPolicy(orgId: string, data: PtoPolicyInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO payroll_pto_policies (
        id, org_id, name, accrual_rate, accrual_frequency,
        max_balance, carryover_max, waiting_period_days,
        active, created_at
      ) VALUES (
        ${id}, ${orgId}, ${data.name}, ${data.accrualRate},
        ${data.accrualFrequency}, ${data.maxBalance}, ${data.carryoverMax},
        ${data.waitingPeriodDays}, true, NOW()
      )
    `);
    return { id };
  }

  async calculatePtoAccrual(orgId: string, employeeId: string): Promise<{ accrued: number; policyName: string }> {
    // Look up employee's PTO policy (via position or default)
    const policyResult = await db.execute(sql`
      SELECT pp.* FROM payroll_pto_policies pp
      JOIN payroll_positions pos ON pos.pto_policy_id = pp.id
      WHERE pos.employee_id = ${employeeId} AND pos.org_id = ${orgId}
        AND pp.active = true
      LIMIT 1
    `);
    const policy = (policyResult as any).rows?.[0];
    if (!policy) return { accrued: 0, policyName: 'none' };

    // Check waiting period
    const empResult = await db.execute(sql`
      SELECT hire_date FROM payroll_employees
      WHERE id = ${employeeId} AND org_id = ${orgId}
    `);
    const emp = (empResult as any).rows?.[0];
    if (!emp) return { accrued: 0, policyName: policy.name };

    const hireDate = new Date(emp.hire_date);
    const now = new Date();
    const daysSinceHire = Math.floor((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceHire < (policy.waiting_period_days || 0)) {
      return { accrued: 0, policyName: policy.name };
    }

    const rate = new Decimal(policy.accrual_rate);
    const maxBalance = new Decimal(policy.max_balance);
    let accrualPeriods: number;

    switch (policy.accrual_frequency) {
      case 'annual':
        accrualPeriods = Math.floor(daysSinceHire / 365);
        break;
      case 'monthly':
        accrualPeriods = Math.floor(daysSinceHire / 30.44);
        break;
      case 'per_pay_period':
        accrualPeriods = Math.floor(daysSinceHire / 14); // biweekly default
        break;
      default:
        accrualPeriods = 0;
    }

    const totalAccrued = Decimal.min(rate.times(accrualPeriods), maxBalance);
    return {
      accrued: totalAccrued.toDecimalPlaces(2).toNumber(),
      policyName: policy.name,
    };
  }

  async requestPto(orgId: string, employeeId: string, data: PtoRequestInput): Promise<{ id: string }> {
    // Check balance
    const balance = await this.getPtoBalance(orgId, employeeId);
    if (balance.available < data.hoursRequested) {
      throw new Error(
        `Insufficient PTO balance. Available: ${balance.available}h, Requested: ${data.hoursRequested}h`,
      );
    }

    const id = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO payroll_pto_requests (
        id, org_id, employee_id, start_date, end_date,
        hours_requested, pto_type, reason, status, created_at
      ) VALUES (
        ${id}, ${orgId}, ${employeeId}, ${data.startDate}, ${data.endDate},
        ${data.hoursRequested.toString()}, ${data.ptoType},
        ${data.reason || null}, 'pending', NOW()
      )
    `);
    return { id };
  }

  async approvePto(orgId: string, requestId: string, userId: string): Promise<void> {
    const result = await db.execute(sql`
      UPDATE payroll_pto_requests
      SET status = 'approved', approved_by = ${userId}, approved_at = NOW()
      WHERE id = ${requestId} AND org_id = ${orgId} AND status = 'pending'
    `);
    if ((result as any).rowCount === 0) {
      throw new Error('PTO request not found or not in pending status');
    }
  }

  async getPtoBalance(
    orgId: string,
    employeeId: string,
  ): Promise<{ accrued: number; used: number; pending: number; available: number }> {
    const accrualResult = await this.calculatePtoAccrual(orgId, employeeId);

    // Sum approved PTO (used)
    const usedResult = await db.execute(sql`
      SELECT COALESCE(SUM(hours_requested::numeric), 0) as total_used
      FROM payroll_pto_requests
      WHERE employee_id = ${employeeId} AND org_id = ${orgId}
        AND status = 'approved'
        AND EXTRACT(YEAR FROM start_date::date) = EXTRACT(YEAR FROM NOW())
    `);
    const used = Number((usedResult as any).rows?.[0]?.total_used || 0);

    // Sum pending PTO
    const pendingResult = await db.execute(sql`
      SELECT COALESCE(SUM(hours_requested::numeric), 0) as total_pending
      FROM payroll_pto_requests
      WHERE employee_id = ${employeeId} AND org_id = ${orgId}
        AND status = 'pending'
        AND EXTRACT(YEAR FROM start_date::date) = EXTRACT(YEAR FROM NOW())
    `);
    const pending = Number((pendingResult as any).rows?.[0]?.total_pending || 0);

    const accrued = accrualResult.accrued;
    const available = Math.max(accrued - used - pending, 0);

    return { accrued, used, pending, available };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 9. Workers' Comp
  // ═══════════════════════════════════════════════════════════════════════

  async setClassCode(
    orgId: string,
    positionId: string,
    classCode: string,
    rate: string,
  ): Promise<void> {
    await db.execute(sql`
      UPDATE payroll_positions
      SET workers_comp_class_code = ${classCode},
          workers_comp_rate = ${rate}
      WHERE id = ${positionId} AND org_id = ${orgId}
    `);
  }

  async calculateWorkersCompPremium(
    orgId: string,
    employeeId: string,
  ): Promise<{ classCode: string; rate: number; annualPayroll: number; annualPremium: number }> {
    const result = await db.execute(sql`
      SELECT p.workers_comp_class_code, p.workers_comp_rate, p.annual_salary
      FROM payroll_positions p
      WHERE p.employee_id = ${employeeId} AND p.org_id = ${orgId}
      LIMIT 1
    `);
    const pos = (result as any).rows?.[0];
    if (!pos) throw new Error('Position not found');

    const rate = new Decimal(pos.workers_comp_rate || '0');
    const annualPayroll = new Decimal(pos.annual_salary || '0');
    // Workers comp premium = rate per $100 of payroll
    const annualPremium = annualPayroll.div(100).times(rate);

    return {
      classCode: pos.workers_comp_class_code || 'N/A',
      rate: rate.toNumber(),
      annualPayroll: annualPayroll.toNumber(),
      annualPremium: annualPremium.toDecimalPlaces(2).toNumber(),
    };
  }

  async getWorkersCompSummary(
    orgId: string,
  ): Promise<{ classifications: any[]; totalPremium: number; totalPayroll: number }> {
    const result = await db.execute(sql`
      SELECT
        p.workers_comp_class_code as class_code,
        p.workers_comp_rate as rate,
        COUNT(*) as employee_count,
        SUM(p.annual_salary::numeric) as total_payroll
      FROM payroll_positions p
      JOIN payroll_employees e ON e.id = p.employee_id AND e.org_id = p.org_id
      WHERE p.org_id = ${orgId} AND e.status = 'active'
        AND p.workers_comp_class_code IS NOT NULL
      GROUP BY p.workers_comp_class_code, p.workers_comp_rate
      ORDER BY p.workers_comp_class_code
    `);

    let totalPremium = new Decimal(0);
    let totalPayroll = new Decimal(0);

    const classifications = ((result as any).rows || []).map((r: any) => {
      const payroll = new Decimal(r.total_payroll || 0);
      const rate = new Decimal(r.rate || 0);
      const premium = payroll.div(100).times(rate);
      totalPremium = totalPremium.plus(premium);
      totalPayroll = totalPayroll.plus(payroll);
      return {
        classCode: r.class_code,
        rate: rate.toNumber(),
        employeeCount: Number(r.employee_count),
        totalPayroll: payroll.toDecimalPlaces(2).toNumber(),
        annualPremium: premium.toDecimalPlaces(2).toNumber(),
      };
    });

    return {
      classifications,
      totalPremium: totalPremium.toDecimalPlaces(2).toNumber(),
      totalPayroll: totalPayroll.toDecimalPlaces(2).toNumber(),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 10. Payroll Journal Entry Generation
  // ═══════════════════════════════════════════════════════════════════════

  async generatePayrollJE(orgId: string, runId: string): Promise<string> {
    const runResult = await db.execute(sql`
      SELECT * FROM payroll_runs WHERE id = ${runId} AND org_id = ${orgId}
    `);
    const run = (runResult as any).rows?.[0];
    if (!run) throw new Error('Payroll run not found');

    // Aggregate stubs by department
    const aggResult = await db.execute(sql`
      SELECT
        COALESCE(pos.department, 'General') as department,
        SUM(s.gross_pay::numeric) as total_gross,
        SUM(s.regular_pay::numeric) as total_regular,
        SUM(s.overtime_pay::numeric) as total_overtime,
        SUM(s.federal_withholding::numeric) as total_federal_wh,
        SUM(s.state_withholding::numeric) as total_state_wh,
        SUM(s.fica_tax::numeric) as total_fica_ee,
        SUM(s.medicare_tax::numeric) as total_medicare_ee,
        SUM(s.benefit_deductions::numeric) as total_benefits,
        SUM(s.net_pay::numeric) as total_net
      FROM payroll_stubs s
      JOIN payroll_employees e ON e.id = s.employee_id
      LEFT JOIN payroll_positions pos ON pos.employee_id = e.id AND pos.org_id = ${orgId}
      WHERE s.run_id = ${runId}
      GROUP BY COALESCE(pos.department, 'General')
    `);

    const jeId = crypto.randomUUID();
    const jeDate = run.pay_date;
    const memo = `Payroll ${run.pay_period_start} to ${run.pay_period_end}`;

    await db.execute(sql`
      INSERT INTO payroll_journal_entries (
        id, org_id, run_id, entry_date, memo, entry_type, created_at
      ) VALUES (
        ${jeId}, ${orgId}, ${runId}, ${jeDate}, ${memo}, 'payroll', NOW()
      )
    `);

    let lineOrder = 0;

    for (const dept of (aggResult as any).rows || []) {
      const department = dept.department;
      const totalGross = new Decimal(dept.total_gross);
      const totalFederalWh = new Decimal(dept.total_federal_wh);
      const totalStateWh = new Decimal(dept.total_state_wh);
      const totalFicaEE = new Decimal(dept.total_fica_ee);
      const totalMedicareEE = new Decimal(dept.total_medicare_ee);
      const totalBenefits = new Decimal(dept.total_benefits);
      const totalNet = new Decimal(dept.total_net);

      // Employer-side FICA and Medicare match employee amounts
      const totalFicaER = totalFicaEE;
      const totalMedicareER = totalMedicareEE;

      const lines: Array<{ account: string; debit: Decimal; credit: Decimal; description: string }> = [
        // DEBITS — Expenses
        {
          account: `6100-${department}`,
          debit: totalGross,
          credit: new Decimal(0),
          description: `Salary & Wages Expense — ${department}`,
        },
        {
          account: `6200-${department}`,
          debit: totalFicaER,
          credit: new Decimal(0),
          description: `Employer FICA Expense — ${department}`,
        },
        {
          account: `6210-${department}`,
          debit: totalMedicareER,
          credit: new Decimal(0),
          description: `Employer Medicare Expense — ${department}`,
        },

        // CREDITS — Liabilities
        {
          account: '2100',
          debit: new Decimal(0),
          credit: totalFederalWh,
          description: 'Federal Withholding Payable',
        },
        {
          account: '2110',
          debit: new Decimal(0),
          credit: totalStateWh,
          description: 'State Withholding Payable',
        },
        {
          account: '2120',
          debit: new Decimal(0),
          credit: totalFicaEE.plus(totalFicaER),
          description: 'FICA Payable (EE + ER)',
        },
        {
          account: '2130',
          debit: new Decimal(0),
          credit: totalMedicareEE.plus(totalMedicareER),
          description: 'Medicare Payable (EE + ER)',
        },
        {
          account: '2140',
          debit: new Decimal(0),
          credit: totalBenefits,
          description: 'Benefits Payable',
        },
        {
          account: '1010',
          debit: new Decimal(0),
          credit: totalNet,
          description: 'Cash — Net Payroll',
        },
      ];

      for (const line of lines) {
        // Skip zero-value lines
        if (line.debit.isZero() && line.credit.isZero()) continue;
        lineOrder++;
        const lineId = crypto.randomUUID();
        await db.execute(sql`
          INSERT INTO payroll_journal_entry_lines (
            id, journal_entry_id, line_order, account_code,
            debit, credit, description, department, created_at
          ) VALUES (
            ${lineId}, ${jeId}, ${lineOrder}, ${line.account},
            ${line.debit.toDecimalPlaces(2).toString()},
            ${line.credit.toDecimalPlaces(2).toString()},
            ${line.description}, ${department}, NOW()
          )
        `);
      }
    }

    // Update run with JE reference
    await db.execute(sql`
      UPDATE payroll_runs SET journal_entry_id = ${jeId} WHERE id = ${runId}
    `);

    return jeId;
  }

  /** Generate a reversal journal entry (void scenario) */
  private async _generateReversalJE(orgId: string, runId: string, reason: string): Promise<string> {
    // Read the original JE and reverse all debits/credits
    const origJeResult = await db.execute(sql`
      SELECT journal_entry_id FROM payroll_runs WHERE id = ${runId} AND org_id = ${orgId}
    `);
    const origJeId = (origJeResult as any).rows?.[0]?.journal_entry_id;

    const reversalId = crypto.randomUUID();
    const run = (await db.execute(sql`SELECT * FROM payroll_runs WHERE id = ${runId}`)).rows?.[0] as any;

    await db.execute(sql`
      INSERT INTO payroll_journal_entries (
        id, org_id, run_id, entry_date, memo, entry_type,
        reversal_of, created_at
      ) VALUES (
        ${reversalId}, ${orgId}, ${runId}, NOW()::date,
        ${'REVERSAL: ' + reason}, 'reversal',
        ${origJeId || null}, NOW()
      )
    `);

    if (origJeId) {
      // Copy lines with swapped debit/credit
      const linesResult = await db.execute(sql`
        SELECT * FROM payroll_journal_entry_lines
        WHERE journal_entry_id = ${origJeId}
        ORDER BY line_order
      `);

      for (const line of ((linesResult as any).rows || [])) {
        const lineId = crypto.randomUUID();
        await db.execute(sql`
          INSERT INTO payroll_journal_entry_lines (
            id, journal_entry_id, line_order, account_code,
            debit, credit, description, department, created_at
          ) VALUES (
            ${lineId}, ${reversalId}, ${line.line_order}, ${line.account_code},
            ${line.credit}, ${line.debit},
            ${'REVERSAL: ' + line.description}, ${line.department}, NOW()
          )
        `);
      }
    }

    return reversalId;
  }
}

// ─── Singleton Export ──────────────────────────────────────────────────────

export const payrollEngine = new PayrollEngine();
