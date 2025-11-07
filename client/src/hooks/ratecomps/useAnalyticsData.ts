import { useMemo, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { rateCompsApi, type CompsResponse } from "@/lib/ratecomps/api";
import { queryKeys } from "@/lib/ratecomps/queryKeys";
import type { FilterState } from "@/lib/ratecomps/types";
import type { RateComp } from "@shared/schema";
import { deriveEffectiveCapRate } from "@/lib/ratecomps/capRateUtils";
import { calculateStats, groupByStats, formatCurrency, formatPercent } from "@/lib/ratecomps/stats";

export interface AnalyticsData {
  // Raw data
  allComps: RateComp[];
  loading: boolean;
  error: any;
  
  // KPI metrics
  kpis: {
    totalComps: number;
    totalVolume: number;
    avgSalePrice: number | null;
    medianSalePrice: number | null;
    avgCapRate: number | null;
    medianCapRate: number | null;
    disclosedPrices: number;
    disclosedNOI: number;
  };
  
  // Time series data
  timeSeries: Array<{
    year: number;
    count: number;
    totalVolume: number;
    avgPrice: number | null;
    avgCapRate: number | null;
  }>;
  
  // Enhanced time series with quarterly and monthly analysis
  quarterlyTimeSeries: Array<{
    year: number;
    quarter: number;
    quarterLabel: string;
    count: number;
    totalVolume: number;
    avgPrice: number | null;
    avgCapRate: number | null;
  }>;
  
  monthlyTimeSeries: Array<{
    year: number;
    month: number;
    monthLabel: string;
    count: number;
    totalVolume: number;
    avgPrice: number | null;
    avgCapRate: number | null;
  }>;
  
  // Group by data
  groupByState: Array<{
    state: string;
    count: number;
    avgPrice: number | null;
    medianPrice: number | null;
    avgCapRate: number | null;
    totalVolume: number;
  }>;
  
  // Regional analysis
  groupByRegion: Array<{
    region: string;
    states: string[];
    count: number;
    avgPrice: number | null;
    medianPrice: number | null;
    avgCapRate: number | null;
    totalVolume: number;
  }>;
  
  // Property size tranches
  priceTranches: Array<{
    tranche: string;
    min: number | null;
    max: number | null;
    count: number;
    totalVolume: number;
    avgPrice: number | null;
    medianPrice: number | null;
    avgCapRate: number | null;
    percentOfTotal: number;
  }>;
  
  // Ownership analysis
  ownershipAnalysis: {
    uniqueOwners: number;
    multipleOwnershipCount: number;
    topOwners: Array<{
      owner: string;
      count: number;
      totalVolume: number;
      avgPrice: number | null;
      avgCapRate: number | null;
      properties: string[];
    }>;
  };
  
  // Distribution data
  priceDistribution: Array<{
    bin: string;
    count: number;
    min: number;
    max: number;
  }>;
  
  capRateDistribution: Array<{
    bin: string;
    count: number;
    min: number;
    max: number;
  }>;
  
  // Quantile data for distribution analysis
  priceQuantiles: {
    q1: number | null;
    median: number | null;
    q3: number | null;
  };
  
  capRateQuantiles: {
    q1: number | null;
    median: number | null;
    q3: number | null;
  };
}

/**
 * Hook to fetch and aggregate analytics data based on filters
 * Uses progressive loading to fetch all pages of filtered results
 */
export function useAnalyticsData(filters: FilterState): AnalyticsData {
  // Build query parameters from filters
  const queryParams = useMemo(() => {
    return {
      q: filters.q || "",
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => 
          value !== "" && value !== false && value !== null && value !== undefined
        )
      ),
      sortBy: "saleYear",
      sortDir: "desc" as const,
    };
  }, [filters]);

  // Fetch all pages of data using infinite query
  const {
    data: queryData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: queryKeys.comps.list(queryParams),
    queryFn: async ({ pageParam = 1 }) => {
      const response = await rateCompsApi.getComps({
        ...queryParams,
        page: pageParam,
      });
      return response;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: CompsResponse | undefined, pages: CompsResponse[] | undefined) => {
      // Defensive checks for all parameters
      if (!lastPage || typeof lastPage !== 'object') {
        return undefined;
      }
      
      if (!pages || !Array.isArray(pages)) {
        return undefined;
      }
      
      // Filter out any undefined/null pages
      const validPages = pages.filter(p => p && typeof p === 'object');
      if (validPages.length === 0) {
        return undefined;
      }
      
      if (!lastPage.comps || !Array.isArray(lastPage.comps)) {
        return undefined;
      }
      
      // If last page is empty, no more data
      if (lastPage.comps.length === 0) {
        return undefined;
      }
      
      const currentPage = typeof lastPage.page === 'number' ? lastPage.page : 1;
      const pageSize = typeof lastPage.pageSize === 'number' ? lastPage.pageSize : 20;
      const total = typeof lastPage.total === 'number' ? lastPage.total : 0;
      
      const totalFetched = currentPage * pageSize;
      const hasMoreData = totalFetched < total;
      
      return hasMoreData ? currentPage + 1 : undefined;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });

  // Automatically fetch all pages for complete analytics
  const allComps = useMemo(() => {
    if (!queryData?.pages || !Array.isArray(queryData.pages)) return [];
    return queryData.pages.flatMap((page: CompsResponse) => {
      if (!page || !page.comps || !Array.isArray(page.comps)) return [];
      return page.comps;
    });
  }, [queryData?.pages]);

  // Auto-fetch next page if more data available
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  // Calculate analytics from aggregated data
  const analytics = useMemo((): AnalyticsData => {
    if (!allComps.length) {
      return {
        allComps: [],
        loading: isLoading,
        error,
        kpis: {
          totalComps: 0,
          totalVolume: 0,
          avgSalePrice: null,
          medianSalePrice: null,
          avgCapRate: null,
          medianCapRate: null,
          disclosedPrices: 0,
          disclosedNOI: 0,
        },
        timeSeries: [],
        quarterlyTimeSeries: [],
        monthlyTimeSeries: [],
        groupByState: [],
        groupByRegion: [],
        priceTranches: [],
        ownershipAnalysis: {
          uniqueOwners: 0,
          multipleOwnershipCount: 0,
          topOwners: [],
        },
        priceDistribution: [],
        capRateDistribution: [],
        priceQuantiles: { q1: null, median: null, q3: null },
        capRateQuantiles: { q1: null, median: null, q3: null },
      };
    }

    // Extract data for calculations
    const salePrices = allComps
      .filter(comp => comp.isPriceDisclosed && comp.salePrice)
      .map(comp => {
        if (typeof comp.salePrice === 'string') {
          // Handle string values like "-", empty strings, etc.
          const trimmed = comp.salePrice.trim();
          if (trimmed === '' || trimmed === '-' || trimmed === '—') {
            return null;
          }
          return parseFloat(trimmed);
        }
        return comp.salePrice;
      })
      .filter((price): price is number => price != null && isFinite(price) && price > 0);
      
    const capRates = allComps
      .map(comp => deriveEffectiveCapRate(comp))
      .filter((rate): rate is number => rate !== null && isFinite(rate) && rate > 0);

    // Calculate KPIs
    const priceStats = calculateStats(salePrices);
    const capRateStats = calculateStats(capRates);
    
    const kpis = {
      totalComps: allComps.length,
      totalVolume: salePrices.reduce((sum, price) => sum + price, 0),
      avgSalePrice: priceStats?.mean || null,
      medianSalePrice: priceStats?.median || null,
      avgCapRate: capRateStats?.mean || null,
      medianCapRate: capRateStats?.median || null,
      disclosedPrices: allComps.filter(comp => comp.isPriceDisclosed).length,
      disclosedNOI: allComps.filter(comp => comp.isNoiDisclosed).length,
    };

    // Time series by year
    const yearGroups = groupByStats(
      allComps,
      comp => comp.saleYear || 0,
      comp => {
        if (!comp.isPriceDisclosed || !comp.salePrice) return null;
        if (typeof comp.salePrice === 'string') {
          const trimmed = comp.salePrice.trim();
          if (trimmed === '' || trimmed === '-' || trimmed === '—') {
            return null;
          }
          const price = parseFloat(trimmed);
          return price > 0 ? price : null;
        }
        return comp.salePrice && comp.salePrice > 0 ? comp.salePrice : null;
      }
    );
    
    const timeSeries = Object.entries(yearGroups)
      .filter(([year]) => year !== "0")
      .map(([year, stats]) => ({
        year: parseInt(year),
        count: stats?.count || 0,
        totalVolume: stats?.sum || 0,
        avgPrice: stats?.mean || null,
        avgCapRate: null as number | null, // Will be calculated separately
      }))
      .sort((a, b) => a.year - b.year);

    // Add cap rate averages to time series
    timeSeries.forEach(item => {
      const yearComps = allComps.filter(comp => comp.saleYear === item.year);
      const yearCapRates = yearComps.map(comp => deriveEffectiveCapRate(comp));
      const yearCapStats = calculateStats(yearCapRates);
      item.avgCapRate = yearCapStats?.mean || null;
    });

    // Group by state
    const stateGroups = groupByStats(
      allComps,
      comp => comp.state || "Unknown",
      comp => {
        if (!comp.isPriceDisclosed || !comp.salePrice) return null;
        if (typeof comp.salePrice === 'string') {
          const trimmed = comp.salePrice.trim();
          if (trimmed === '' || trimmed === '-' || trimmed === '—') {
            return null;
          }
          const price = parseFloat(trimmed);
          return price > 0 ? price : null;
        }
        return comp.salePrice && comp.salePrice > 0 ? comp.salePrice : null;
      }
    );
    
    const groupByState = Object.entries(stateGroups)
      .map(([state, stats]) => {
        // Use same grouping logic for consistency (handle Unknown state)
        const stateComps = allComps.filter(comp => (comp.state || "Unknown") === state);
        const stateCapRates = stateComps.map(comp => deriveEffectiveCapRate(comp));
        const stateCapStats = calculateStats(stateCapRates);
        
        return {
          state,
          count: stats?.count || 0,
          avgPrice: stats?.mean || null,
          medianPrice: stats?.median || null,
          avgCapRate: stateCapStats?.mean || null,
          totalVolume: stats?.sum || 0,
        };
      })
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);

    // Price distribution
    const priceDistribution = createHistogramBins(salePrices, 8);
    
    // Cap rate distribution - use percentage formatting for labels
    const capRateDistribution = createHistogramBins(capRates, 8, true);
    
    // Quantile analysis for distributions
    const priceQuantiles = priceStats ? {
      q1: priceStats.q25,
      median: priceStats.median,
      q3: priceStats.q75
    } : { q1: null, median: null, q3: null };
    
    const capRateQuantiles = capRateStats ? {
      q1: capRateStats.q25,
      median: capRateStats.median,
      q3: capRateStats.q75
    } : { q1: null, median: null, q3: null };

    // Enhanced time series: Quarterly analysis
    const quarterlyTimeSeries = createQuarterlyTimeSeries(allComps);
    
    // Enhanced time series: Monthly analysis
    const monthlyTimeSeries = createMonthlyTimeSeries(allComps);
    
    // Regional analysis (group states by regions)
    const groupByRegion = createRegionalAnalysis(allComps);
    
    // Property size tranches analysis
    const priceTranches = createPriceTranches(allComps);
    
    // Ownership analysis
    const ownershipAnalysis = createOwnershipAnalysis(allComps);

    return {
      allComps,
      loading: isLoading || hasNextPage,
      error,
      kpis,
      timeSeries,
      quarterlyTimeSeries,
      monthlyTimeSeries,
      groupByState,
      groupByRegion,
      priceTranches,
      ownershipAnalysis,
      priceDistribution,
      capRateDistribution,
      priceQuantiles,
      capRateQuantiles,
    };
  }, [allComps, isLoading, hasNextPage, error]);

  return analytics;
}

/**
 * Create histogram bins for distribution charts
 */
function createHistogramBins(
  values: (number | null | undefined)[],
  binCount: number = 8,
  isPercentage: boolean = false
): Array<{ bin: string; count: number; min: number; max: number }> {
  const validValues = values.filter((v): v is number => v != null && isFinite(v) && v > 0);
  
  if (validValues.length === 0) return [];
  
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min;
  
  // Handle case where all values are the same (range = 0)
  if (range === 0) {
    const formatter = isPercentage ? formatPercent : formatCurrency;
    return [{
      bin: `${formatter(min)}`,
      count: validValues.length,
      min: min,
      max: max
    }];
  }
  
  const binSize = range / binCount;
  
  const bins = Array.from({ length: binCount }, (_, i) => {
    const binMin = min + i * binSize;
    const binMax = min + (i + 1) * binSize;
    
    const formatter = isPercentage ? formatPercent : formatCurrency;
    return {
      bin: `${formatter(binMin)} - ${formatter(binMax)}`,
      count: 0,
      min: binMin,
      max: binMax
    };
  });
  
  validValues.forEach(value => {
    const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
    bins[binIndex].count++;
  });
  
  return bins.filter(bin => bin.count > 0);
}

/**
 * Create quarterly time series analysis
 */
function createQuarterlyTimeSeries(allComps: RateComp[]) {
  const quarterlyData: { [key: string]: { comps: RateComp[], prices: number[] } } = {};
  
  allComps.forEach(comp => {
    if (!comp.saleYear || !comp.saleMonth) return;
    
    const quarter = Math.ceil(comp.saleMonth / 3);
    const key = `${comp.saleYear}-Q${quarter}`;
    
    if (!quarterlyData[key]) {
      quarterlyData[key] = { comps: [], prices: [] };
    }
    
    quarterlyData[key].comps.push(comp);
    
    if (comp.isPriceDisclosed && comp.salePrice) {
      const price = typeof comp.salePrice === 'string' ? 
        parseFloat(comp.salePrice.replace(/[^\d.-]/g, '')) : comp.salePrice;
      if (price > 0) {
        quarterlyData[key].prices.push(price);
      }
    }
  });
  
  return Object.entries(quarterlyData)
    .map(([key, data]) => {
      const [year, quarterStr] = key.split('-Q');
      const quarter = parseInt(quarterStr);
      const quarterLabel = `Q${quarter} ${year}`;
      
      const capRates = data.comps.map(comp => deriveEffectiveCapRate(comp)).filter(rate => rate !== null);
      const stats = calculateStats(data.prices);
      const capStats = calculateStats(capRates);
      
      return {
        year: parseInt(year),
        quarter,
        quarterLabel,
        count: data.comps.length,
        totalVolume: data.prices.reduce((sum, price) => sum + price, 0),
        avgPrice: stats?.mean || null,
        avgCapRate: capStats?.mean || null,
      };
    })
    .sort((a, b) => a.year === b.year ? a.quarter - b.quarter : a.year - b.year);
}

/**
 * Create monthly time series analysis
 */
function createMonthlyTimeSeries(allComps: RateComp[]) {
  const monthlyData: { [key: string]: { comps: RateComp[], prices: number[] } } = {};
  
  allComps.forEach(comp => {
    if (!comp.saleYear || !comp.saleMonth) return;
    
    const key = `${comp.saleYear}-${comp.saleMonth.toString().padStart(2, '0')}`;
    
    if (!monthlyData[key]) {
      monthlyData[key] = { comps: [], prices: [] };
    }
    
    monthlyData[key].comps.push(comp);
    
    if (comp.isPriceDisclosed && comp.salePrice) {
      const price = typeof comp.salePrice === 'string' ? 
        parseFloat(comp.salePrice.replace(/[^\d.-]/g, '')) : comp.salePrice;
      if (price > 0) {
        monthlyData[key].prices.push(price);
      }
    }
  });
  
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  return Object.entries(monthlyData)
    .map(([key, data]) => {
      const [year, monthStr] = key.split('-');
      const month = parseInt(monthStr);
      const monthLabel = `${monthNames[month - 1]} ${year}`;
      
      const capRates = data.comps.map(comp => deriveEffectiveCapRate(comp)).filter(rate => rate !== null);
      const stats = calculateStats(data.prices);
      const capStats = calculateStats(capRates);
      
      return {
        year: parseInt(year),
        month,
        monthLabel,
        count: data.comps.length,
        totalVolume: data.prices.reduce((sum, price) => sum + price, 0),
        avgPrice: stats?.mean || null,
        avgCapRate: capStats?.mean || null,
      };
    })
    .sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);
}

/**
 * Create regional analysis by grouping states into regions
 */
function createRegionalAnalysis(allComps: RateComp[]) {
  // Define US regions
  const regions: { [key: string]: string[] } = {
    'Northeast': ['CT', 'ME', 'MA', 'NH', 'RI', 'VT', 'NJ', 'NY', 'PA'],
    'Southeast': ['DE', 'FL', 'GA', 'MD', 'NC', 'SC', 'VA', 'WV', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA'],
    'Midwest': ['IL', 'IN', 'MI', 'OH', 'WI', 'IA', 'KS', 'MN', 'MO', 'NE', 'ND', 'SD'],
    'Southwest': ['AZ', 'NM', 'TX', 'OK'],
    'West': ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
    'Other': [] // Will capture any unmatched states
  };
  
  const regionData: { [region: string]: { comps: RateComp[], prices: number[], states: Set<string> } } = {};
  
  // Initialize regions
  Object.keys(regions).forEach(region => {
    regionData[region] = { comps: [], prices: [], states: new Set() };
  });
  
  allComps.forEach(comp => {
    const state = comp.state?.toUpperCase() || 'UNKNOWN';
    let assignedRegion = 'Other';
    
    // Find which region this state belongs to
    for (const [region, states] of Object.entries(regions)) {
      if (states.includes(state)) {
        assignedRegion = region;
        break;
      }
    }
    
    if (!regionData[assignedRegion]) {
      regionData[assignedRegion] = { comps: [], prices: [], states: new Set() };
    }
    
    regionData[assignedRegion].comps.push(comp);
    regionData[assignedRegion].states.add(state);
    
    if (comp.isPriceDisclosed && comp.salePrice) {
      const price = typeof comp.salePrice === 'string' ? 
        parseFloat(comp.salePrice.replace(/[^\d.-]/g, '')) : comp.salePrice;
      if (price > 0) {
        regionData[assignedRegion].prices.push(price);
      }
    }
  });
  
  return Object.entries(regionData)
    .map(([region, data]) => {
      const capRates = data.comps.map(comp => deriveEffectiveCapRate(comp)).filter(rate => rate !== null);
      const stats = calculateStats(data.prices);
      const capStats = calculateStats(capRates);
      
      return {
        region,
        states: Array.from(data.states).sort(),
        count: data.comps.length,
        avgPrice: stats?.mean || null,
        medianPrice: stats?.median || null,
        avgCapRate: capStats?.mean || null,
        totalVolume: data.prices.reduce((sum, price) => sum + price, 0),
      };
    })
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Create property size tranches analysis
 */
function createPriceTranches(allComps: RateComp[]) {
  const tranches = [
    { tranche: 'Sub-$1M', min: null, max: 1000000 },
    { tranche: '$1M-$5M', min: 1000000, max: 5000000 },
    { tranche: '$5M-$10M', min: 5000000, max: 10000000 },
    { tranche: '$10M-$20M', min: 10000000, max: 20000000 },
    { tranche: '$20M-$50M', min: 20000000, max: 50000000 },
    { tranche: '$50M+', min: 50000000, max: null },
  ];
  
  const trancheData = tranches.map(tranche => ({ ...tranche, comps: [] as RateComp[], prices: [] as number[] }));
  
  allComps.forEach(comp => {
    if (!comp.isPriceDisclosed || !comp.salePrice) return;
    
    const price = typeof comp.salePrice === 'string' ? 
      parseFloat(comp.salePrice.replace(/[^\d.-]/g, '')) : comp.salePrice;
    
    if (price <= 0) return;
    
    // Find the appropriate tranche
    for (const tranche of trancheData) {
      const minOk = tranche.min === null || price >= tranche.min;
      const maxOk = tranche.max === null || price < tranche.max;
      
      if (minOk && maxOk) {
        tranche.comps.push(comp);
        tranche.prices.push(price);
        break;
      }
    }
  });
  
  const totalComps = allComps.filter(comp => comp.isPriceDisclosed && comp.salePrice).length;
  
  return trancheData
    .map(tranche => {
      const capRates = tranche.comps.map(comp => deriveEffectiveCapRate(comp)).filter(rate => rate !== null);
      const stats = calculateStats(tranche.prices);
      const capStats = calculateStats(capRates);
      
      return {
        tranche: tranche.tranche,
        min: tranche.min,
        max: tranche.max,
        count: tranche.comps.length,
        totalVolume: tranche.prices.reduce((sum, price) => sum + price, 0),
        avgPrice: stats?.mean || null,
        medianPrice: stats?.median || null,
        avgCapRate: capStats?.mean || null,
        percentOfTotal: totalComps > 0 ? (tranche.comps.length / totalComps) * 100 : 0,
      };
    })
    .filter(item => item.count > 0);
}

/**
 * Create ownership analysis
 */
function createOwnershipAnalysis(allComps: RateComp[]) {
  const ownerData: { [owner: string]: { comps: RateComp[], prices: number[] } } = {};
  
  allComps.forEach(comp => {
    // Use seller as owner identifier, fallback to marina name if no seller
    const owner = comp.seller?.trim() || comp.marina?.trim() || 'Unknown';
    if (!owner || owner === 'Unknown') return;
    
    if (!ownerData[owner]) {
      ownerData[owner] = { comps: [], prices: [] };
    }
    
    ownerData[owner].comps.push(comp);
    
    if (comp.isPriceDisclosed && comp.salePrice) {
      const price = typeof comp.salePrice === 'string' ? 
        parseFloat(comp.salePrice.replace(/[^\d.-]/g, '')) : comp.salePrice;
      if (price > 0) {
        ownerData[owner].prices.push(price);
      }
    }
  });
  
  const topOwners = Object.entries(ownerData)
    .map(([owner, data]) => {
      const capRates = data.comps.map(comp => deriveEffectiveCapRate(comp)).filter(rate => rate !== null);
      const stats = calculateStats(data.prices);
      const capStats = calculateStats(capRates);
      
      return {
        owner,
        count: data.comps.length,
        totalVolume: data.prices.reduce((sum, price) => sum + price, 0),
        avgPrice: stats?.mean || null,
        avgCapRate: capStats?.mean || null,
        properties: data.comps.map(comp => comp.marina || 'Unknown').filter((value, index, self) => self.indexOf(value) === index),
      };
    })
    .filter(item => item.count > 1) // Only show owners with multiple properties
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Top 20 owners
  
  return {
    uniqueOwners: Object.keys(ownerData).length,
    multipleOwnershipCount: topOwners.length,
    topOwners,
  };
}
