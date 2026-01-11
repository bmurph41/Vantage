/**
 * Contract Term Groups for Occupancy Calculations
 * 
 * Marinas have fixed capacity (e.g., 150 slips) that can be rented across seasons.
 * 
 * Occupancy calculations (denominators):
 * - Overall: Total unique contracts / Total slot-seasons (capacity × 2)
 * - Annual: Annual contracts / Capacity (raw capacity, ×1)
 * - Seasonal: (Seasonal + Annual) / Capacity (raw capacity, ×1)
 * - Winter: (Winter + Annual) / Capacity (raw capacity, ×1)
 * - Short-Term: Short-term contracts / Capacity (MTM, weekly, daily)
 * 
 * Note: Only Overall uses doubled capacity. Seasonal/Winter use raw capacity.
 */

export const CONTRACT_TERM_GROUPS = {
  ANNUAL: ['Annual'],
  SEASONAL: ['Seasonal/Summer', 'Summer/Seasonal', '6-Months', '3-Months'],
  WINTER: ['Winter'],
  SHORT_TERM: ['Monthly', 'Weekly', 'Daily/Nightly'],
} as const;

export type ContractTermGroupKey = keyof typeof CONTRACT_TERM_GROUPS;

export const CONTRACT_TERM_GROUP_LABELS: Record<ContractTermGroupKey, string> = {
  ANNUAL: 'Annual',
  SEASONAL: 'Seasonal',
  WINTER: 'Winter',
  SHORT_TERM: 'Short-Term',
};

/**
 * Get the contract term group for a given contract term value
 */
export function getContractTermGroup(contractTerm: string | null | undefined): ContractTermGroupKey | null {
  if (!contractTerm) return null;
  
  for (const [group, terms] of Object.entries(CONTRACT_TERM_GROUPS)) {
    if ((terms as readonly string[]).includes(contractTerm)) {
      return group as ContractTermGroupKey;
    }
  }
  return null;
}

/**
 * Check if a contract term belongs to a specific group
 */
export function isInContractTermGroup(contractTerm: string | null | undefined, group: ContractTermGroupKey): boolean {
  if (!contractTerm) return false;
  return (CONTRACT_TERM_GROUPS[group] as readonly string[]).includes(contractTerm);
}

/**
 * Get all contract terms that belong to a group
 */
export function getTermsInGroup(group: ContractTermGroupKey): readonly string[] {
  return CONTRACT_TERM_GROUPS[group];
}

export interface ContractTermOccupancyCounts {
  annual: number;
  seasonal: number;
  winter: number;
  shortTerm: number;
  unclassified: number;
  total: number;
}

export type ProjectSeasonType = 'ANNUAL' | 'SEASONAL';

export interface OccupancyMetric {
  percentage: number;
  numerator: number;
  denominator: number;
  label: string;
  exceedsCapacity?: boolean; // True when numerator > denominator (data quality issue)
}

export interface ContractTermOccupancyMetrics {
  counts: ContractTermOccupancyCounts;
  capacity: number;
  slotSeasons: number; // capacity * 2 for seasonal, capacity for annual
  projectSeasonType: ProjectSeasonType;
  hasDataQualityIssue?: boolean; // True when any occupancy exceeds 100%
  occupancy: {
    overall: OccupancyMetric;
    annual: OccupancyMetric;
    seasonal: OccupancyMetric | null;
    winter: OccupancyMetric | null;
    shortTerm: OccupancyMetric;
  };
}

/**
 * Calculate occupancy metrics based on contract term counts and marina capacity.
 * 
 * Key business logic:
 * - For ANNUAL projects: Use raw capacity for all modes, count all contracts once
 * - For SEASONAL projects: 
 *   - Denominator multipliers: Overall=×2, Annual=×1, Seasonal=×1, Winter=×1
 *   - Numerator: NEVER doubled - always raw lease counts
 * 
 * ANNUAL projects:
 * - All modes use same denominator (raw capacity)
 * - No seasonal/winter breakdown (returns null for those)
 * 
 * SEASONAL projects:
 * - Annual contracts count toward BOTH seasonal and winter occupancy numerators
 * - Seasonal contracts only count for seasonal (summer) occupancy
 * - Winter contracts only count for winter occupancy  
 * - Short-term contracts are counted separately
 * - Overall denominator is capacity × 2 (slot-seasons)
 * - Seasonal/Winter denominators use raw capacity (×1)
 * - Annual denominator is raw capacity (×1)
 */
function createOccupancyMetric(
  numerator: number,
  denominator: number,
  label: string
): OccupancyMetric {
  const rawPercentage = denominator > 0 ? (numerator / denominator) * 100 : 0;
  const exceedsCapacity = numerator > denominator;
  const cappedPercentage = Math.min(rawPercentage, 100);
  
  return {
    percentage: Math.round(cappedPercentage * 10) / 10,
    numerator,
    denominator,
    label,
    exceedsCapacity,
  };
}

export function calculateContractTermOccupancy(
  counts: ContractTermOccupancyCounts,
  capacity: number,
  projectSeasonType: ProjectSeasonType = 'SEASONAL'
): ContractTermOccupancyMetrics {
  // For ANNUAL projects: simple calculation against raw capacity
  if (projectSeasonType === 'ANNUAL') {
    const totalContracts = counts.annual + counts.seasonal + counts.winter + counts.shortTerm + counts.unclassified;
    
    const overallMetric = createOccupancyMetric(totalContracts, capacity, `${totalContracts} / ${capacity}`);
    const annualMetric = createOccupancyMetric(counts.annual, capacity, `${counts.annual} annual / ${capacity}`);
    const shortTermMetric = createOccupancyMetric(counts.shortTerm, capacity, `${counts.shortTerm} short-term / ${capacity}`);
    
    const hasDataQualityIssue = overallMetric.exceedsCapacity || annualMetric.exceedsCapacity || shortTermMetric.exceedsCapacity;
    
    return {
      counts,
      capacity,
      slotSeasons: capacity,
      projectSeasonType,
      hasDataQualityIssue,
      occupancy: {
        overall: overallMetric,
        annual: annualMetric,
        seasonal: null,
        winter: null,
        shortTerm: shortTermMetric,
      },
    };
  }
  
  // For SEASONAL projects: use slot-seasons calculation for Overall only
  // Denominator multipliers: Overall=×2, Annual=×1, Seasonal=×1, Winter=×1
  const slotSeasons = capacity * 2;
  
  // Overall numerator counts OCCUPIED slot-seasons:
  // - Annual leases occupy 2 slot-seasons each (summer + winter)
  // - Seasonal/Winter/ShortTerm leases occupy 1 slot-season each
  const overallNumerator = (counts.annual * 2) + counts.seasonal + counts.winter + counts.shortTerm + counts.unclassified;
  // Seasonal: seasonal + annual (annual leases also occupy summer season)
  const seasonalNumerator = counts.seasonal + counts.annual;
  // Winter: winter + annual (annual leases also occupy winter season)
  const winterNumerator = counts.winter + counts.annual;
  
  // Overall uses slotSeasons (×2) denominator
  const overallMetric = createOccupancyMetric(overallNumerator, slotSeasons, `${overallNumerator} / ${slotSeasons}`);
  // Annual uses raw capacity (×1) denominator
  const annualMetric = createOccupancyMetric(counts.annual, capacity, `${counts.annual} annual / ${capacity}`);
  // Seasonal uses raw capacity (×1) denominator - NOT doubled
  const seasonalMetric = createOccupancyMetric(
    seasonalNumerator, 
    capacity, 
    `${seasonalNumerator} (${counts.seasonal} seasonal + ${counts.annual} annual) / ${capacity}`
  );
  // Winter uses raw capacity (×1) denominator - NOT doubled
  const winterMetric = createOccupancyMetric(
    winterNumerator, 
    capacity, 
    `${winterNumerator} (${counts.winter} winter + ${counts.annual} annual) / ${capacity}`
  );
  const shortTermMetric = createOccupancyMetric(counts.shortTerm, capacity, `${counts.shortTerm} short-term / ${capacity}`);
  
  const hasDataQualityIssue = overallMetric.exceedsCapacity || 
    annualMetric.exceedsCapacity || 
    seasonalMetric.exceedsCapacity || 
    winterMetric.exceedsCapacity || 
    shortTermMetric.exceedsCapacity;
  
  return {
    counts,
    capacity,
    slotSeasons,
    projectSeasonType,
    hasDataQualityIssue,
    occupancy: {
      overall: overallMetric,
      annual: annualMetric,
      seasonal: seasonalMetric,
      winter: winterMetric,
      shortTerm: shortTermMetric,
    },
  };
}
