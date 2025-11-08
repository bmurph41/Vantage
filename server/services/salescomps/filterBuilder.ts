export interface FilterParams {
  q?: string;
  states?: string[];
  regions?: string[];
  saleYearMin?: number;
  saleYearMax?: number;
  priceMin?: number;
  priceMax?: number;
  capRateMin?: number;
  capRateMax?: number;
  occupancyMin?: number;
  occupancyMax?: number;
  wetSlipsMin?: number;
  wetSlipsMax?: number;
  dryRacksMin?: number;
  dryRacksMax?: number;
  ioBoth?: string;
  disclosedOnly?: boolean;
  disclosedCapRateOnly?: boolean;
  portfoliosOnly?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export class FilterBuilder {
  buildFilters(params: FilterParams): Record<string, any> {
    const filters: Record<string, any> = {};

    // Text search
    if (params.q) {
      filters.q = params.q;
    }

    // Location filters
    if (params.states && params.states.length > 0) {
      filters.states = params.states;
    }
    if (params.regions && params.regions.length > 0) {
      filters.regions = params.regions;
    }

    // Year range
    if (params.saleYearMin) {
      filters.saleYearMin = params.saleYearMin;
    }
    if (params.saleYearMax) {
      filters.saleYearMax = params.saleYearMax;
    }

    // Price range
    if (params.priceMin) {
      filters.priceMin = params.priceMin;
    }
    if (params.priceMax) {
      filters.priceMax = params.priceMax;
    }

    // Cap rate range
    if (params.capRateMin) {
      filters.capRateMin = params.capRateMin;
    }
    if (params.capRateMax) {
      filters.capRateMax = params.capRateMax;
    }

    // Occupancy range
    if (params.occupancyMin) {
      filters.occupancyMin = params.occupancyMin;
    }
    if (params.occupancyMax) {
      filters.occupancyMax = params.occupancyMax;
    }

    // Marina features
    if (params.wetSlipsMin) {
      filters.wetSlipsMin = params.wetSlipsMin;
    }
    if (params.wetSlipsMax) {
      filters.wetSlipsMax = params.wetSlipsMax;
    }
    if (params.dryRacksMin) {
      filters.dryRacksMin = params.dryRacksMin;
    }
    if (params.dryRacksMax) {
      filters.dryRacksMax = params.dryRacksMax;
    }
    if (params.ioBoth) {
      filters.ioBoth = params.ioBoth;
    }

    // Boolean filters
    if (params.disclosedOnly) {
      filters.disclosedOnly = params.disclosedOnly;
    }
    if (params.disclosedCapRateOnly) {
      filters.disclosedCapRateOnly = params.disclosedCapRateOnly;
    }
    if (params.portfoliosOnly) {
      filters.portfoliosOnly = params.portfoliosOnly;
    }

    return filters;
  }

  validateSortField(sortBy: string): boolean {
    const allowedFields = [
      'marina', 'salePrice', 'capRate', 'noi', 'saleYear', 'saleMonth',
      'state', 'market', 'wetSlips', 'dryRacks', 'occupancy', 'createdAt'
    ];
    return allowedFields.includes(sortBy);
  }

  sanitizePagination(page?: number, pageSize?: number): { page: number; pageSize: number } {
    const safePage = Math.max(1, page || 1);
    const safePageSize = Math.min(100, Math.max(10, pageSize || 25));
    return { page: safePage, pageSize: safePageSize };
  }
}
