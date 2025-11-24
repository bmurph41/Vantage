import type { AnalyticsFilters } from "@/components/salescomps/analytics/AnalyticsFilters";

/**
 * Checks if filters object has any valid, meaningful filter values
 * Returns true only if there's at least one filter with actual data
 */
export function hasValidFilters(filters: AnalyticsFilters): boolean {
  if (!filters || typeof filters !== 'object') {
    return false;
  }

  // Check for any valid filter values
  const hasValidValue = (
    // Array filters - must have length > 0
    (filters.states && filters.states.length > 0) ||
    (filters.waterTypes && filters.waterTypes.length > 0) ||
    (filters.profitCenters && filters.profitCenters.length > 0) ||
    (filters.coastalType && filters.coastalType.length > 0) ||
    (filters.region && filters.region.length > 0) ||
    (filters.broker && filters.broker.length > 0) ||
    
    // Number filters - must be defined and not null
    (filters.yearSoldMin !== undefined && filters.yearSoldMin !== null) ||
    (filters.yearSoldMax !== undefined && filters.yearSoldMax !== null) ||
    (filters.priceMin !== undefined && filters.priceMin !== null) ||
    (filters.priceMax !== undefined && filters.priceMax !== null) ||
    (filters.pricePerSlipMin !== undefined && filters.pricePerSlipMin !== null) ||
    (filters.pricePerSlipMax !== undefined && filters.pricePerSlipMax !== null) ||
    (filters.capacityMin !== undefined && filters.capacityMin !== null) ||
    (filters.capacityMax !== undefined && filters.capacityMax !== null) ||
    
    // Boolean filter - must be explicitly true or false
    (filters.isPortfolio !== undefined && filters.isPortfolio !== null)
  );

  return hasValidValue;
}

/**
 * Gets a human-readable description of active filters
 */
export function getActiveFiltersDescription(filters: AnalyticsFilters): string {
  const parts: string[] = [];

  if (filters.states && filters.states.length > 0) {
    parts.push(`${filters.states.length} state${filters.states.length > 1 ? 's' : ''}`);
  }

  if (filters.priceMin || filters.priceMax) {
    const priceRange = [];
    if (filters.priceMin) priceRange.push(`min $${(filters.priceMin / 1000000).toFixed(1)}M`);
    if (filters.priceMax) priceRange.push(`max $${(filters.priceMax / 1000000).toFixed(1)}M`);
    parts.push(priceRange.join(', '));
  }

  if (filters.waterTypes && filters.waterTypes.length > 0) {
    parts.push(`${filters.waterTypes.length} water type${filters.waterTypes.length > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return 'No filters applied';
  }

  return parts.join(' • ');
}
