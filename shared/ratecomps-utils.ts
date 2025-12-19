import { RateTier } from './schema';

export interface NormalizationResult {
  normalizedValue: number;
  normalizedUnit: string;
  normalizedMethod: string;
}

export function normalizeRate(tier: {
  amountCents: number;
  rateUnit: string;
  ratePeriod: string;
  loaMin?: number | null;
  loaMax?: number | null;
  seasonality?: string | null;
  seasonStartMonth?: number | null;
  seasonEndMonth?: number | null;
}): NormalizationResult {
  const { amountCents, rateUnit, ratePeriod, loaMin, loaMax, seasonality } = tier;
  
  let monthlyRate = amountCents;
  let method = '';
  
  switch (ratePeriod) {
    case 'daily':
      monthlyRate = amountCents * 30;
      method = 'daily x 30';
      break;
    case 'weekly':
      monthlyRate = Math.round(amountCents * 4.33);
      method = 'weekly x 4.33';
      break;
    case 'monthly':
      monthlyRate = amountCents;
      method = 'monthly direct';
      break;
    case 'seasonal':
      const seasonMonths = calculateSeasonMonths(tier.seasonStartMonth, tier.seasonEndMonth);
      monthlyRate = Math.round(amountCents / seasonMonths);
      method = `seasonal / ${seasonMonths} months`;
      break;
    case 'annual':
      monthlyRate = Math.round(amountCents / 12);
      method = 'annual / 12';
      break;
    default:
      monthlyRate = amountCents;
      method = 'unknown period (assumed monthly)';
  }
  
  let normalizedRate = monthlyRate;
  let normalizedUnit = 'usd_per_ft_per_month';
  
  if (rateUnit === 'flat') {
    const avgLoa = calculateAvgLoa(loaMin, loaMax);
    if (avgLoa > 0) {
      normalizedRate = Math.round(monthlyRate / avgLoa);
      method += ` / ${avgLoa}ft avg LOA`;
    }
  } else if (rateUnit === 'per_foot' || rateUnit === 'per_foot_loa') {
    method += ' (per foot)';
  } else if (rateUnit === 'per_foot_beam') {
    method += ' (per foot beam - converted to LOA estimate)';
  } else if (rateUnit === 'per_sf') {
    method += ' (per square foot)';
    normalizedUnit = 'usd_per_sf_per_month';
  }
  
  return {
    normalizedValue: normalizedRate,
    normalizedUnit,
    normalizedMethod: method,
  };
}

function calculateSeasonMonths(startMonth?: number | null, endMonth?: number | null): number {
  if (!startMonth || !endMonth) {
    return 6;
  }
  
  if (endMonth >= startMonth) {
    return endMonth - startMonth + 1;
  } else {
    return (12 - startMonth + 1) + endMonth;
  }
}

function calculateAvgLoa(loaMin?: number | null, loaMax?: number | null): number {
  if (loaMin && loaMax) {
    return Math.round((loaMin + loaMax) / 2);
  }
  if (loaMin) return loaMin;
  if (loaMax) return loaMax;
  return 30;
}

export function formatRateDisplay(amountCents: number, rateUnit: string, ratePeriod: string): string {
  const amount = amountCents / 100;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  
  const unitLabel = rateUnit === 'per_foot' || rateUnit === 'per_foot_loa' 
    ? '/ft' 
    : rateUnit === 'per_foot_beam' 
      ? '/ft (beam)'
      : rateUnit === 'per_sf'
        ? '/SF'
        : '';
      
  const periodLabel = ratePeriod === 'daily' ? '/day'
    : ratePeriod === 'weekly' ? '/wk'
    : ratePeriod === 'monthly' ? '/mo'
    : ratePeriod === 'seasonal' ? '/season'
    : ratePeriod === 'annual' ? '/yr'
    : '';
    
  return `${formattedAmount}${unitLabel}${periodLabel}`;
}

export function formatNormalizedRate(normalizedValue: number, normalizedUnit?: string): string {
  const amount = normalizedValue / 100;
  const suffix = normalizedUnit === 'usd_per_sf_per_month' ? '/SF/mo' : '/ft/mo';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + suffix;
}

export function formatSizeRange(
  loaMin?: number | null, 
  loaMax?: number | null, 
  categoryLabel?: string | null
): string {
  if (categoryLabel) {
    return categoryLabel;
  }
  if (loaMin && loaMax) {
    return `${loaMin}'-${loaMax}'`;
  }
  if (loaMin) {
    return `${loaMin}'+ `;
  }
  if (loaMax) {
    return `Up to ${loaMax}'`;
  }
  return 'Any size';
}

export const STORAGE_TYPE_LABELS: Record<string, string> = {
  wet_slip: 'Wet Slips',
  lift_slip: 'Lift Slips',
  mooring: 'Moorings',
  dinghy_small_boat: 'Dinghies/Small Boats',
  jet_ski: 'Jet Skis',
  dry_rack_indoor: 'Dry Racks - Indoor',
  dry_rack_outdoor: 'Dry Racks - Outdoor',
  land_storage: 'Land Storage',
  trailered_boat: 'Trailered Boats',
  trailer: 'Trailers',
  carport: 'Carports',
  houseboat: 'Houseboats',
  rv_site: 'RV Sites',
  cabin: 'Cabins',
  sales: 'Sales',
  service: 'Service',
  commercial: 'Commercial',
  rental_boat: 'Rental Boats',
  boat_club: 'Boat Club',
};

export const RATE_PERIOD_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  seasonal: 'Seasonal',
  annual: 'Annual',
};

export const RATE_UNIT_LABELS: Record<string, string> = {
  per_foot: 'Per Foot',
  flat: 'Flat Rate',
  per_foot_beam: 'Per Foot (Beam)',
  per_foot_loa: 'Per Foot (LOA)',
  per_sf: 'Per Square Foot',
};

export const PROTECTION_LEVEL_LABELS: Record<string, string> = {
  open: 'Open',
  protected: 'Protected',
  covered: 'Covered',
  indoor: 'Indoor',
};
