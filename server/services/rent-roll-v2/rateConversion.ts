/**
 * Rate Conversion Utility
 * 
 * Converts lease amounts between different rate bases to monthly rent.
 * Used by bulk import, bulk update, and individual lease update flows.
 */

/**
 * Rate type labels used in the UI mapped to internal rate basis
 */
export const RATE_TYPE_TO_BASIS: Record<string, string> = {
  '$/ft./mo.': 'per_ft_month',
  '$/ft./season': 'per_ft_season',
  '$/ft./yr.': 'per_ft_year',
  '$/mo.': 'per_month',
  '$/season': 'per_season',
  '$/yr.': 'per_year',
  '$/SF': 'per_sf',
  '$/sf/mo.': 'per_sf_month',
  '$/SF/Month': 'per_sf_month',
  '$/sf/yr.': 'per_sf_year',
  '$/SF/Year': 'per_sf_year',
  '$/SF/Year (NNN)': 'per_sf_year',
  '$/Month (Gross)': 'per_month',
  '$/night': 'per_night',
  '$/Night': 'per_night',
  '$/week': 'per_week',
  '$/Week': 'per_week',
  'Flat Fee': 'flat_fee',
};

/**
 * Get the internal rate basis from a UI rate type label
 */
export function getRateBasis(rateType: string | null | undefined): string {
  if (!rateType) return 'per_month';
  return RATE_TYPE_TO_BASIS[rateType] || 'per_month';
}

/**
 * Configuration for rate conversion
 */
export interface RateConversionConfig {
  rawAmount: number;
  rateType: string | null | undefined;
  numMonths?: number | null;
  boatLength?: number | null;
  slipLength?: number | null;
  slipWidth?: number | null;
  contractTerm?: string | null;
  // Multi-asset: generic dimension fields (SF for CRE/storage, etc.)
  unitDimension1?: number | null;
  unitDimension2?: number | null;
}

/**
 * Calculate the number of months based on contract term
 */
export function getMonthsFromContractTerm(contractTerm: string | null | undefined): number {
  if (!contractTerm) return 12;
  
  const term = contractTerm.toLowerCase();
  
  if (term === 'annual' || term === 'yearly' || term === '12 month' || term === '12 months') {
    return 12;
  }
  if (term === 'seasonal' || term === 'seasonal/summer' || term === 'summer' || term === '6-months' || term === '6 months') {
    return 6;
  }
  if (term === 'winter') {
    return 6;
  }
  if (term === '3-months' || term === '3 months') {
    return 3;
  }
  if (term === 'monthly' || term === 'mtm' || term === 'month-to-month') {
    return 1;
  }
  if (term === 'weekly') {
    return 0.25; // ~1 week
  }
  if (term === 'daily' || term === 'daily/nightly') {
    return 1/30; // ~1 day
  }
  
  return 12; // Default to annual
}

/**
 * Convert a raw amount to monthly rent based on rate type
 * 
 * @param config - Configuration with raw amount, rate type, and dimensions
 * @returns Monthly rent equivalent
 */
export function convertToMonthlyRent(config: RateConversionConfig): number {
  const { rawAmount, rateType, numMonths, boatLength, slipLength, slipWidth, contractTerm, unitDimension1, unitDimension2 } = config;

  if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) {
    return 0;
  }

  const rateBasis = getRateBasis(rateType);

  // Determine the number of months for season-based calculations
  const effectiveMonths = numMonths && numMonths > 0
    ? numMonths
    : getMonthsFromContractTerm(contractTerm);

  // Ensure we don't divide by zero
  const safeMonths = Math.max(1, effectiveMonths);

  // Get boat length for per-foot calculations (marina)
  const length = boatLength && boatLength > 0 ? boatLength : null;

  // Get square footage: prefer unitDimension1, fallback to slipLength × slipWidth
  const sqft = (unitDimension1 && unitDimension1 > 0)
    ? unitDimension1
    : (slipLength && slipWidth && slipLength > 0 && slipWidth > 0
      ? slipLength * slipWidth
      : null);
  
  switch (rateBasis) {
    case 'per_month':
      // Already monthly
      return rawAmount;
      
    case 'per_season':
      // Seasonal total - divide by months
      return rawAmount / safeMonths;
      
    case 'per_year':
      // Annual total - divide by 12
      return rawAmount / 12;
      
    case 'per_ft_month':
      // Rate per foot per month - multiply by boat length
      if (length) {
        return rawAmount * length;
      }
      return rawAmount;
      
    case 'per_ft_season':
      // Rate per foot for season - multiply by length, divide by months
      if (length) {
        return (rawAmount * length) / safeMonths;
      }
      return rawAmount / safeMonths;
      
    case 'per_ft_year':
      // Rate per foot per year - multiply by length, divide by 12
      if (length) {
        return (rawAmount * length) / 12;
      }
      return rawAmount / 12;
      
    case 'per_sf':
      // Rate per square foot (ambiguous period) - multiply by area, treat as monthly
      if (sqft) {
        return rawAmount * sqft;
      }
      return rawAmount;

    case 'per_sf_month':
      // Rate per SF per month - multiply by area
      if (sqft) {
        return rawAmount * sqft;
      }
      return rawAmount;

    case 'per_sf_year':
      // Rate per SF per year - multiply by area, divide by 12
      if (sqft) {
        return (rawAmount * sqft) / 12;
      }
      return rawAmount / 12;

    case 'per_night':
      // Nightly rate (hotel/STR) - multiply by ~30 days for monthly equivalent
      return rawAmount * 30;

    case 'per_week':
      // Weekly rate - multiply by ~4.33 weeks for monthly equivalent
      return rawAmount * (52 / 12);

    case 'flat_fee':
      // Flat fee - no conversion, treat as monthly
      return rawAmount;

    default:
      // Unknown rate type - treat as monthly
      return rawAmount;
  }
}

/**
 * Convert monthly rent back to a raw rate value based on rate type
 * This is the inverse of convertToMonthlyRent
 * 
 * @param config - Configuration with monthly rent as rawAmount
 * @returns Raw rate value in the specified rate type
 */
export function convertFromMonthlyRent(config: RateConversionConfig): number {
  const { rawAmount: monthlyRent, rateType, numMonths, boatLength, slipLength, slipWidth, contractTerm } = config;
  
  if (!monthlyRent || isNaN(monthlyRent) || monthlyRent <= 0) {
    return 0;
  }
  
  const rateBasis = getRateBasis(rateType);
  
  const effectiveMonths = numMonths && numMonths > 0 
    ? numMonths 
    : getMonthsFromContractTerm(contractTerm);
  
  const safeMonths = Math.max(1, effectiveMonths);
  const length = boatLength && boatLength > 0 ? boatLength : null;
  const sqft = slipLength && slipWidth && slipLength > 0 && slipWidth > 0 
    ? slipLength * slipWidth 
    : null;
  
  switch (rateBasis) {
    case 'per_month':
      return monthlyRent;
      
    case 'per_season':
      return monthlyRent * safeMonths;
      
    case 'per_year':
      return monthlyRent * 12;
      
    case 'per_ft_month':
      if (length) {
        return monthlyRent / length;
      }
      return monthlyRent;
      
    case 'per_ft_season':
      if (length) {
        return (monthlyRent * safeMonths) / length;
      }
      return monthlyRent * safeMonths;
      
    case 'per_ft_year':
      if (length) {
        return (monthlyRent * 12) / length;
      }
      return monthlyRent * 12;
      
    case 'per_sf':
      if (sqft) {
        return monthlyRent / sqft;
      }
      return monthlyRent;
      
    case 'flat_fee':
      return monthlyRent;
      
    default:
      return monthlyRent;
  }
}
