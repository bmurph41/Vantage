import Decimal from 'decimal.js';
import { CostSegregationResult } from './cost-segregation-engine';

// ─────────────────────────────────────────────────────────────────────────────
// Depreciation Service
// Generates year-by-year depreciation schedules using MACRS or straight-line
// methods across all cost segregation component classes.
// Compliant with IRS Publication 946 depreciation tables.
// ─────────────────────────────────────────────────────────────────────────────

export interface DepreciationScheduleInput {
  costSegregation: CostSegregationResult;
  holdPeriodYears: number;
  acquisitionMonth?: number; // 1-12, for mid-month convention on real property
  method?: 'macrs' | 'straight_line';
}

export interface DepreciationYearDetail {
  year: number;
  personalProperty5yr: number;
  personalProperty7yr: number;
  landImprovements15yr: number;
  realProperty: number;
  totalDepreciation: number;
  accumulatedDepreciation: number;
  remainingBasis: number;
}

export interface DepreciationScheduleResult {
  yearlySchedule: DepreciationYearDetail[];
  totalDepreciation: number;
  totalTaxShield: number;
}

/** Assumed top marginal federal rate for tax shield calculation. */
const MARGINAL_RATE = new Decimal('0.37');

/**
 * MACRS percentage tables (200% declining balance, half-year convention).
 * Source: IRS Publication 946, Appendix A, Table A-1 (5-yr, 7-yr) and A-5 (15-yr).
 * Values are expressed as decimal fractions (e.g., 0.20 = 20%).
 */
const MACRS_5YR: Decimal[] = [
  new Decimal('0.2000'),
  new Decimal('0.3200'),
  new Decimal('0.1920'),
  new Decimal('0.1152'),
  new Decimal('0.1152'),
  new Decimal('0.0576'),
];

const MACRS_7YR: Decimal[] = [
  new Decimal('0.1429'),
  new Decimal('0.2449'),
  new Decimal('0.1749'),
  new Decimal('0.1249'),
  new Decimal('0.0893'),
  new Decimal('0.0892'),
  new Decimal('0.0893'),
  new Decimal('0.0446'),
];

const MACRS_15YR: Decimal[] = [
  new Decimal('0.0500'),
  new Decimal('0.0950'),
  new Decimal('0.0855'),
  new Decimal('0.0770'),
  new Decimal('0.0693'),
  new Decimal('0.0623'),
  new Decimal('0.0590'),
  new Decimal('0.0590'),
  new Decimal('0.0591'),
  new Decimal('0.0590'),
  new Decimal('0.0591'),
  new Decimal('0.0590'),
  new Decimal('0.0591'),
  new Decimal('0.0590'),
  new Decimal('0.0591'),
  new Decimal('0.0295'),
];

/**
 * Mid-month convention factors for real property (residential 27.5yr and
 * nonresidential 39yr). Index 0 = January acquisition, index 11 = December.
 * The factor represents the fraction of the first year's depreciation allowed.
 * Formula: (12 - month + 0.5) / 12
 */
function midMonthFactor(acquisitionMonth: number): Decimal {
  const month = Math.max(1, Math.min(12, Math.round(acquisitionMonth)));
  // Months of depreciation in first year = 12 - month + 0.5
  return new Decimal(12 - month + 0.5).div(12);
}

class DepreciationService {
  /**
   * Generate a complete year-by-year depreciation schedule for all component
   * classes identified in a cost segregation study.
   *
   * @param input - Cost segregation result, hold period, acquisition month, and method.
   * @returns Year-by-year schedule with accumulated depreciation and tax shield totals.
   */
  generateSchedule(input: DepreciationScheduleInput): DepreciationScheduleResult {
    const { costSegregation, holdPeriodYears } = input;
    const acquisitionMonth = input.acquisitionMonth ?? 7; // Default mid-year
    const method = input.method ?? 'macrs';

    if (holdPeriodYears <= 0) {
      throw new Error('Hold period must be greater than zero.');
    }

    const cs = costSegregation.components;
    const pp5yrBasis = new Decimal(cs.personalProperty5yr.amount);
    const pp7yrBasis = new Decimal(cs.personalProperty7yr.amount);
    const li15yrBasis = new Decimal(cs.landImprovements15yr.amount);
    const realPropBasis = new Decimal(cs.realProperty.amount);
    const realPropLife = cs.realProperty.depreciationYears; // 27.5 or 39
    const totalDepreciableBasis = new Decimal(costSegregation.totalDepreciableBase);

    const schedule: DepreciationYearDetail[] = [];
    let accumulatedDep = new Decimal(0);

    for (let year = 1; year <= holdPeriodYears; year++) {
      const pp5yr = method === 'macrs'
        ? this.macrsDepreciation(pp5yrBasis, year, MACRS_5YR)
        : this.straightLineDepreciation(pp5yrBasis, year, 5, acquisitionMonth);

      const pp7yr = method === 'macrs'
        ? this.macrsDepreciation(pp7yrBasis, year, MACRS_7YR)
        : this.straightLineDepreciation(pp7yrBasis, year, 7, acquisitionMonth);

      const li15yr = method === 'macrs'
        ? this.macrsDepreciation(li15yrBasis, year, MACRS_15YR)
        : this.straightLineDepreciation(li15yrBasis, year, 15, acquisitionMonth);

      const realProp = this.realPropertyDepreciation(
        realPropBasis,
        year,
        realPropLife,
        acquisitionMonth,
      );

      const totalYear = pp5yr.plus(pp7yr).plus(li15yr).plus(realProp);
      accumulatedDep = accumulatedDep.plus(totalYear);

      // Cap accumulated depreciation at total depreciable basis
      if (accumulatedDep.gt(totalDepreciableBasis)) {
        const overage = accumulatedDep.minus(totalDepreciableBasis);
        accumulatedDep = totalDepreciableBasis;
        // Reduce this year's total by the overage
        const adjustedTotal = totalYear.minus(overage);

        schedule.push({
          year,
          personalProperty5yr: this.round(pp5yr),
          personalProperty7yr: this.round(pp7yr),
          landImprovements15yr: this.round(li15yr),
          realProperty: this.round(realProp),
          totalDepreciation: this.round(adjustedTotal.lt(0) ? new Decimal(0) : adjustedTotal),
          accumulatedDepreciation: this.round(accumulatedDep),
          remainingBasis: 0,
        });
      } else {
        const remaining = totalDepreciableBasis.minus(accumulatedDep);
        schedule.push({
          year,
          personalProperty5yr: this.round(pp5yr),
          personalProperty7yr: this.round(pp7yr),
          landImprovements15yr: this.round(li15yr),
          realProperty: this.round(realProp),
          totalDepreciation: this.round(totalYear),
          accumulatedDepreciation: this.round(accumulatedDep),
          remainingBasis: this.round(remaining),
        });
      }
    }

    const totalDep = accumulatedDep;
    const totalTaxShield = totalDep.times(MARGINAL_RATE);

    return {
      yearlySchedule: schedule,
      totalDepreciation: this.round(totalDep),
      totalTaxShield: this.round(totalTaxShield),
    };
  }

  /**
   * Calculate MACRS depreciation for a given year using the provided rate table.
   * Returns zero if the year exceeds the recovery period (table length).
   */
  private macrsDepreciation(basis: Decimal, year: number, table: Decimal[]): Decimal {
    if (year < 1 || year > table.length || basis.lte(0)) {
      return new Decimal(0);
    }
    return basis.times(table[year - 1]);
  }

  /**
   * Calculate straight-line depreciation for personal property / land improvements.
   * Uses half-year convention: first and last years get half the annual amount.
   */
  private straightLineDepreciation(
    basis: Decimal,
    year: number,
    life: number,
    _acquisitionMonth: number,
  ): Decimal {
    if (basis.lte(0) || year < 1) return new Decimal(0);

    const annualAmount = basis.div(life);

    // Half-year convention for personal property
    if (year === 1) {
      return annualAmount.div(2);
    }
    // Recovery period is life + 1 years due to half-year convention
    if (year === life + 1) {
      return annualAmount.div(2);
    }
    if (year > life + 1) {
      return new Decimal(0);
    }
    return annualAmount;
  }

  /**
   * Calculate real property depreciation using straight-line with mid-month convention.
   * Residential (27.5yr) and nonresidential (39yr) real property always use
   * straight-line regardless of the method parameter.
   *
   * @param basis - Depreciable basis for the real property component.
   * @param year - Year number (1-based).
   * @param life - Recovery period (27.5 or 39).
   * @param acquisitionMonth - Month of acquisition (1-12).
   */
  private realPropertyDepreciation(
    basis: Decimal,
    year: number,
    life: number,
    acquisitionMonth: number,
  ): Decimal {
    if (basis.lte(0) || year < 1) return new Decimal(0);

    const annualAmount = basis.div(life);
    const mmFactor = midMonthFactor(acquisitionMonth);

    if (year === 1) {
      // First year: mid-month convention
      return annualAmount.times(mmFactor);
    }

    // Determine the last recovery year. For real property with mid-month convention,
    // the recovery extends into year (ceil(life) + 1) for the remaining stub.
    const fullRecoveryYears = Math.ceil(life);
    const lastYear = fullRecoveryYears + 1;

    if (year < lastYear) {
      // Full year of depreciation
      return annualAmount;
    }

    if (year === lastYear) {
      // Last year: complement of first-year mid-month factor
      const lastYearFactor = new Decimal(1).minus(mmFactor);
      return annualAmount.times(lastYearFactor);
    }

    // Beyond recovery period
    return new Decimal(0);
  }

  /** Round a Decimal to 2 decimal places and convert to number. */
  private round(value: Decimal): number {
    return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }
}

export const depreciationService = new DepreciationService();
