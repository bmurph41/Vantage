import Decimal from 'decimal.js';

// ─────────────────────────────────────────────────────────────────────────────
// Cost Segregation Engine
// Allocates purchase price into IRS component classes for accelerated depreciation.
// Based on IRS Rev. Proc. 87-56 asset class lives and typical engineering study
// allocation percentages by CRE asset type.
// ─────────────────────────────────────────────────────────────────────────────

export interface CostSegregationInput {
  purchasePrice: number;
  landValue: number;
  assetType: string;
  improvementsValue?: number;
}

export interface ComponentDetail {
  amount: number;
  percentage: number;
  depreciationYears: number | null;
}

export interface CostSegregationResult {
  components: {
    land: { amount: number; percentage: number; depreciationYears: null };
    personalProperty5yr: { amount: number; percentage: number; depreciationYears: 5 };
    personalProperty7yr: { amount: number; percentage: number; depreciationYears: 7 };
    landImprovements15yr: { amount: number; percentage: number; depreciationYears: 15 };
    realProperty: { amount: number; percentage: number; depreciationYears: number };
  };
  totalDepreciableBase: number;
  acceleratedDepreciationYear1: number;
  straightLineDepreciationYear1: number;
  taxSavingsYear1: number;
}

/** Default allocation percentages by asset type (from typical engineering studies). */
interface AllocationProfile {
  personalProperty5yr: number;
  personalProperty7yr: number;
  landImprovements15yr: number;
  land: number;
  realProperty: number;
  realPropertyLife: number; // 27.5 for residential, 39 for nonresidential
}

const ALLOCATION_PROFILES: Record<string, AllocationProfile> = {
  multifamily: {
    personalProperty5yr: 0.15,
    personalProperty7yr: 0.05,
    landImprovements15yr: 0.10,
    land: 0.10,
    realProperty: 0.60,
    realPropertyLife: 27.5,
  },
  office: {
    personalProperty5yr: 0.10,
    personalProperty7yr: 0.05,
    landImprovements15yr: 0.08,
    land: 0.12,
    realProperty: 0.65,
    realPropertyLife: 39,
  },
  retail: {
    personalProperty5yr: 0.10,
    personalProperty7yr: 0.05,
    landImprovements15yr: 0.08,
    land: 0.12,
    realProperty: 0.65,
    realPropertyLife: 39,
  },
  industrial: {
    personalProperty5yr: 0.12,
    personalProperty7yr: 0.08,
    landImprovements15yr: 0.10,
    land: 0.08,
    realProperty: 0.62,
    realPropertyLife: 39,
  },
  hotel: {
    personalProperty5yr: 0.20,
    personalProperty7yr: 0.08,
    landImprovements15yr: 0.08,
    land: 0.10,
    realProperty: 0.54,
    realPropertyLife: 39,
  },
  marina: {
    personalProperty5yr: 0.18,
    personalProperty7yr: 0.10,
    landImprovements15yr: 0.12,
    land: 0.08,
    realProperty: 0.52,
    realPropertyLife: 39,
  },
};

const DEFAULT_PROFILE: AllocationProfile = {
  personalProperty5yr: 0.12,
  personalProperty7yr: 0.05,
  landImprovements15yr: 0.08,
  land: 0.10,
  realProperty: 0.65,
  realPropertyLife: 39,
};

/** Assumed top marginal federal rate for tax savings estimate. */
const DEFAULT_MARGINAL_RATE = new Decimal('0.37');

/** MACRS first-year rates for accelerated depreciation estimate. */
const MACRS_YEAR1_RATES: Record<number, Decimal> = {
  5: new Decimal('0.20'),
  7: new Decimal('0.1429'),
  15: new Decimal('0.05'),
};

class CostSegregationEngine {
  /**
   * Perform a cost segregation analysis, allocating the purchase price into
   * IRS-recognized component classes for accelerated depreciation.
   *
   * @param input - Purchase price, land value, asset type, and optional improvements value.
   * @returns Detailed component breakdown with year-1 depreciation and tax savings estimates.
   */
  calculate(input: CostSegregationInput): CostSegregationResult {
    const purchasePrice = new Decimal(input.purchasePrice);
    const landValue = new Decimal(input.landValue);

    if (purchasePrice.lte(0)) {
      throw new Error('Purchase price must be greater than zero.');
    }
    if (landValue.lt(0)) {
      throw new Error('Land value cannot be negative.');
    }
    if (landValue.gte(purchasePrice)) {
      throw new Error('Land value must be less than purchase price.');
    }

    const profile = this.getProfile(input.assetType);

    // The depreciable base is purchase price minus land.
    // If improvementsValue is provided, it overrides the derived depreciable base.
    const depreciableBase = input.improvementsValue !== undefined
      ? new Decimal(input.improvementsValue)
      : purchasePrice.minus(landValue);

    // Allocate depreciable base into component classes using profile percentages.
    // We normalize the non-land percentages so they sum to 100% of the depreciable base.
    const nonLandTotal = new Decimal(profile.personalProperty5yr)
      .plus(profile.personalProperty7yr)
      .plus(profile.landImprovements15yr)
      .plus(profile.realProperty);

    const pp5yr = depreciableBase.times(new Decimal(profile.personalProperty5yr).div(nonLandTotal));
    const pp7yr = depreciableBase.times(new Decimal(profile.personalProperty7yr).div(nonLandTotal));
    const li15yr = depreciableBase.times(new Decimal(profile.landImprovements15yr).div(nonLandTotal));
    // Real property gets the remainder to avoid rounding drift
    const realProp = depreciableBase.minus(pp5yr.toDecimalPlaces(2))
      .minus(pp7yr.toDecimalPlaces(2))
      .minus(li15yr.toDecimalPlaces(2));

    // Compute percentages relative to purchase price
    const landPct = landValue.div(purchasePrice).times(100);
    const pp5yrPct = pp5yr.div(purchasePrice).times(100);
    const pp7yrPct = pp7yr.div(purchasePrice).times(100);
    const li15yrPct = li15yr.div(purchasePrice).times(100);
    const realPropPct = realProp.div(purchasePrice).times(100);

    // Year 1 accelerated depreciation (MACRS half-year convention)
    const accelYear1 = pp5yr.times(MACRS_YEAR1_RATES[5])
      .plus(pp7yr.times(MACRS_YEAR1_RATES[7]))
      .plus(li15yr.times(MACRS_YEAR1_RATES[15]))
      .plus(this.realPropertyYear1Depreciation(realProp, profile.realPropertyLife));

    // Straight-line comparison: all depreciable base at the real property life
    const straightLineRate = new Decimal(1).div(profile.realPropertyLife);
    // Mid-month convention: assume mid-year for comparison simplicity (6 months)
    const straightLineYear1 = depreciableBase.times(straightLineRate).times(new Decimal('0.5'));

    // Tax savings = (accelerated - straight line) * marginal rate
    // This represents the present-value timing benefit, not total savings
    const taxSavingsYear1 = accelYear1.minus(straightLineYear1).times(DEFAULT_MARGINAL_RATE);

    return {
      components: {
        land: {
          amount: this.round(landValue),
          percentage: this.round(landPct),
          depreciationYears: null,
        },
        personalProperty5yr: {
          amount: this.round(pp5yr),
          percentage: this.round(pp5yrPct),
          depreciationYears: 5,
        },
        personalProperty7yr: {
          amount: this.round(pp7yr),
          percentage: this.round(pp7yrPct),
          depreciationYears: 7,
        },
        landImprovements15yr: {
          amount: this.round(li15yr),
          percentage: this.round(li15yrPct),
          depreciationYears: 15,
        },
        realProperty: {
          amount: this.round(realProp),
          percentage: this.round(realPropPct),
          depreciationYears: profile.realPropertyLife,
        },
      },
      totalDepreciableBase: this.round(depreciableBase),
      acceleratedDepreciationYear1: this.round(accelYear1),
      straightLineDepreciationYear1: this.round(straightLineYear1),
      taxSavingsYear1: this.round(taxSavingsYear1.gt(0) ? taxSavingsYear1 : new Decimal(0)),
    };
  }

  /**
   * Look up the allocation profile for a given asset type.
   * Falls back to the default profile for unrecognized types.
   */
  private getProfile(assetType: string): AllocationProfile {
    const normalized = assetType.toLowerCase().replace(/[\s_-]/g, '');
    // Check for known aliases
    if (normalized.includes('multifamily') || normalized.includes('apartment') || normalized.includes('residential')) {
      return ALLOCATION_PROFILES.multifamily;
    }
    if (normalized.includes('office')) return ALLOCATION_PROFILES.office;
    if (normalized.includes('retail') || normalized.includes('shopping')) return ALLOCATION_PROFILES.retail;
    if (normalized.includes('industrial') || normalized.includes('warehouse') || normalized.includes('logistics')) {
      return ALLOCATION_PROFILES.industrial;
    }
    if (normalized.includes('hotel') || normalized.includes('hospitality')) return ALLOCATION_PROFILES.hotel;
    if (normalized.includes('marina')) return ALLOCATION_PROFILES.marina;

    return ALLOCATION_PROFILES[assetType.toLowerCase()] ?? DEFAULT_PROFILE;
  }

  /**
   * Calculate first-year depreciation for real property using straight-line
   * with mid-month convention. Assumes acquisition in month 7 (July) as a
   * conservative mid-year default; caller can override via DepreciationService.
   */
  private realPropertyYear1Depreciation(amount: Decimal, life: number): Decimal {
    const annualRate = new Decimal(1).div(life);
    // Mid-month convention: 5.5 months out of 12 for a July acquisition
    const midMonthFraction = new Decimal('5.5').div(12);
    return amount.times(annualRate).times(midMonthFraction);
  }

  /** Round a Decimal to 2 decimal places and convert to number. */
  private round(value: Decimal): number {
    return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  }
}

export const costSegregationEngine = new CostSegregationEngine();
