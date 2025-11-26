import { db } from '../../db';
import { rateComps, rateTiers } from '../../../shared/schema';
import { sql, and, eq, isNull, inArray, asc, desc } from 'drizzle-orm';
import { normalizeRate, formatRateDisplay, formatNormalizedRate, STORAGE_TYPE_LABELS } from '../../../shared/ratecomps-utils';

export interface AnalyticsFilters {
  states?: string[];
  yearSoldMin?: number;
  yearSoldMax?: number;
  priceMin?: number;
  priceMax?: number;
  pricePerSlipMin?: number;
  pricePerSlipMax?: number;
  waterTypes?: string[];
  profitCenters?: string[];
  capacityMin?: number;
  capacityMax?: number;
}

export interface MetricResult {
  metric: string;
  value: number;
  sampleSize: number;
  groupBy?: string;
  groupValue?: string;
}

export interface ComparativeAnalysis {
  overall: {
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPricePerSlip: number;
    medianPricePerSlip: number;
    avgCapRate: number;
    medianCapRate: number;
    avgCapacity: number;
    totalValue: number;
  };
  byState?: Record<string, MetricResult[]>;
  byYear?: Record<string, MetricResult[]>;
  byWaterType?: Record<string, MetricResult[]>;
  byPriceRange?: Record<string, MetricResult[]>;
  trends?: {
    priceOverTime: Array<{ year: number; avgPrice: number; count: number }>;
    capRateOverTime: Array<{ year: number; avgCapRate: number; count: number }>;
  };
}

function applyFilters(orgId: string, filters: AnalyticsFilters) {
  const conditions: any[] = [
    eq(rateComps.orgId, orgId),
    isNull(rateComps.deletedAt)
  ];

  if (filters.states && filters.states.length > 0) {
    conditions.push(inArray(rateComps.state, filters.states));
  }

  if (filters.yearSoldMin) {
    conditions.push(sql`EXTRACT(YEAR FROM ${rateComps.saleDate})::integer >= ${filters.yearSoldMin}`);
  }

  if (filters.yearSoldMax) {
    conditions.push(sql`EXTRACT(YEAR FROM ${rateComps.saleDate})::integer <= ${filters.yearSoldMax}`);
  }

  if (filters.priceMin) {
    conditions.push(sql`${rateComps.salePrice}::numeric >= ${filters.priceMin}`);
  }

  if (filters.priceMax) {
    conditions.push(sql`${rateComps.salePrice}::numeric <= ${filters.priceMax}`);
  }

  if (filters.pricePerSlipMin) {
    conditions.push(sql`${rateComps.pricePerSlip}::numeric >= ${filters.pricePerSlipMin}`);
  }

  if (filters.pricePerSlipMax) {
    conditions.push(sql`${rateComps.pricePerSlip}::numeric <= ${filters.pricePerSlipMax}`);
  }

  if (filters.waterTypes && filters.waterTypes.length > 0) {
    conditions.push(inArray(rateComps.waterType, filters.waterTypes));
  }

  if (filters.capacityMin) {
    conditions.push(sql`${rateComps.slipCapacity}::integer >= ${filters.capacityMin}`);
  }

  if (filters.capacityMax) {
    conditions.push(sql`${rateComps.slipCapacity}::integer <= ${filters.capacityMax}`);
  }

  if (filters.profitCenters && filters.profitCenters.length > 0) {
    const profitCenterConditions = filters.profitCenters.map(pc => 
      sql`${rateComps.profitCenters} @> ARRAY[${pc}]::text[]`
    );
    conditions.push(sql`(${sql.join(profitCenterConditions, sql` OR `)})`);
  }

  return and(...conditions);
}

export async function calculateMetrics(
  orgId: string,
  filters: AnalyticsFilters
): Promise<ComparativeAnalysis> {
  const whereClause = applyFilters(orgId, filters);

  // Overall statistics
  const overallStats = await db
    .select({
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${rateComps.salePrice}::numeric)`,
      medianPrice: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${rateComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${rateComps.pricePerSlip}::numeric)`,
      medianPricePerSlip: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${rateComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${rateComps.capRate}::numeric)`,
      medianCapRate: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${rateComps.capRate}::numeric)`,
      avgCapacity: sql<number>`AVG(${rateComps.slipCapacity}::numeric)`,
      totalValue: sql<number>`SUM(${rateComps.salePrice}::numeric)`,
    })
    .from(rateComps)
    .where(whereClause);

  const overall = overallStats[0] || {
    count: 0,
    avgPrice: 0,
    medianPrice: 0,
    avgPricePerSlip: 0,
    medianPricePerSlip: 0,
    avgCapRate: 0,
    medianCapRate: 0,
    avgCapacity: 0,
    totalValue: 0,
  };

  // By State
  const byStateResults = await db
    .select({
      state: rateComps.state,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${rateComps.salePrice}::numeric)`,
      medianPrice: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${rateComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${rateComps.pricePerSlip}::numeric)`,
      medianPricePerSlip: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${rateComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${rateComps.capRate}::numeric)`,
    })
    .from(rateComps)
    .where(whereClause)
    .groupBy(rateComps.state)
    .orderBy(sql`COUNT(*) DESC`);

  const byState: Record<string, MetricResult[]> = {};
  byStateResults.forEach((row: any) => {
    if (row.state) {
      byState[row.state] = [
        { metric: 'count', value: row.count, sampleSize: row.count, groupValue: row.state },
        { metric: 'avgPrice', value: row.avgPrice || 0, sampleSize: row.count, groupValue: row.state },
        { metric: 'medianPrice', value: row.medianPrice || 0, sampleSize: row.count, groupValue: row.state },
        { metric: 'avgPricePerSlip', value: row.avgPricePerSlip || 0, sampleSize: row.count, groupValue: row.state },
        { metric: 'medianPricePerSlip', value: row.medianPricePerSlip || 0, sampleSize: row.count, groupValue: row.state },
        { metric: 'avgCapRate', value: row.avgCapRate || 0, sampleSize: row.count, groupValue: row.state },
      ];
    }
  });

  // By Year
  const byYearResults = await db
    .select({
      year: sql<number>`EXTRACT(YEAR FROM ${rateComps.saleDate})::integer`,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${rateComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${rateComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${rateComps.capRate}::numeric)`,
    })
    .from(rateComps)
    .where(whereClause)
    .groupBy(sql`EXTRACT(YEAR FROM ${rateComps.saleDate})`)
    .orderBy(sql`EXTRACT(YEAR FROM ${rateComps.saleDate})`);

  const byYear: Record<string, MetricResult[]> = {};
  const priceOverTime: Array<{ year: number; avgPrice: number; count: number }> = [];
  const capRateOverTime: Array<{ year: number; avgCapRate: number; count: number }> = [];

  byYearResults.forEach((row: any) => {
    if (row.year) {
      const yearStr = row.year.toString();
      byYear[yearStr] = [
        { metric: 'count', value: row.count, sampleSize: row.count, groupValue: yearStr },
        { metric: 'avgPrice', value: row.avgPrice || 0, sampleSize: row.count, groupValue: yearStr },
        { metric: 'avgPricePerSlip', value: row.avgPricePerSlip || 0, sampleSize: row.count, groupValue: yearStr },
        { metric: 'avgCapRate', value: row.avgCapRate || 0, sampleSize: row.count, groupValue: yearStr },
      ];

      priceOverTime.push({ year: row.year, avgPrice: row.avgPrice || 0, count: row.count });
      capRateOverTime.push({ year: row.year, avgCapRate: row.avgCapRate || 0, count: row.count });
    }
  });

  // By Water Type
  const byWaterTypeResults = await db
    .select({
      waterType: rateComps.waterType,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${rateComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${rateComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${rateComps.capRate}::numeric)`,
    })
    .from(rateComps)
    .where(whereClause)
    .groupBy(rateComps.waterType)
    .orderBy(sql`COUNT(*) DESC`);

  const byWaterType: Record<string, MetricResult[]> = {};
  byWaterTypeResults.forEach((row: any) => {
    if (row.waterType) {
      byWaterType[row.waterType] = [
        { metric: 'count', value: row.count, sampleSize: row.count, groupValue: row.waterType },
        { metric: 'avgPrice', value: row.avgPrice || 0, sampleSize: row.count, groupValue: row.waterType },
        { metric: 'avgPricePerSlip', value: row.avgPricePerSlip || 0, sampleSize: row.count, groupValue: row.waterType },
        { metric: 'avgCapRate', value: row.avgCapRate || 0, sampleSize: row.count, groupValue: row.waterType },
      ];
    }
  });

  // By Price Range
  const byPriceRangeResults = await db
    .select({
      priceRange: sql<string>`
        CASE
          WHEN ${rateComps.salePrice}::numeric < 1000000 THEN 'Under $1M'
          WHEN ${rateComps.salePrice}::numeric < 5000000 THEN '$1M - $5M'
          WHEN ${rateComps.salePrice}::numeric < 10000000 THEN '$5M - $10M'
          WHEN ${rateComps.salePrice}::numeric < 25000000 THEN '$10M - $25M'
          ELSE 'Over $25M'
        END
      `,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${rateComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${rateComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${rateComps.capRate}::numeric)`,
    })
    .from(rateComps)
    .where(whereClause)
    .groupBy(sql`
      CASE
        WHEN ${rateComps.salePrice}::numeric < 1000000 THEN 'Under $1M'
        WHEN ${rateComps.salePrice}::numeric < 5000000 THEN '$1M - $5M'
        WHEN ${rateComps.salePrice}::numeric < 10000000 THEN '$5M - $10M'
        WHEN ${rateComps.salePrice}::numeric < 25000000 THEN '$10M - $25M'
        ELSE 'Over $25M'
      END
    `)
    .orderBy(sql`COUNT(*) DESC`);

  const byPriceRange: Record<string, MetricResult[]> = {};
  byPriceRangeResults.forEach((row: any) => {
    if (row.priceRange) {
      byPriceRange[row.priceRange] = [
        { metric: 'count', value: row.count, sampleSize: row.count, groupValue: row.priceRange },
        { metric: 'avgPrice', value: row.avgPrice || 0, sampleSize: row.count, groupValue: row.priceRange },
        { metric: 'avgPricePerSlip', value: row.avgPricePerSlip || 0, sampleSize: row.count, groupValue: row.priceRange },
        { metric: 'avgCapRate', value: row.avgCapRate || 0, sampleSize: row.count, groupValue: row.priceRange },
      ];
    }
  });

  return {
    overall,
    byState,
    byYear,
    byWaterType,
    byPriceRange,
    trends: {
      priceOverTime,
      capRateOverTime,
    },
  };
}

export async function generateInsights(
  analysis: ComparativeAnalysis,
  filters: AnalyticsFilters
): Promise<string[]> {
  const insights: string[] = [];

  // Overall insights
  if (analysis.overall.count > 0) {
    insights.push(`Analyzed ${analysis.overall.count} marina rate comparables.`);
    
    if (analysis.overall.avgPrice > 0) {
      insights.push(
        `Average sale price: $${(analysis.overall.avgPrice / 1000000).toFixed(2)}M (median: $${(analysis.overall.medianPrice / 1000000).toFixed(2)}M)`
      );
    }

    if (analysis.overall.avgPricePerSlip > 0) {
      insights.push(
        `Average price per slip: $${analysis.overall.avgPricePerSlip.toLocaleString('en-US', { maximumFractionDigits: 0 })} (median: $${analysis.overall.medianPricePerSlip.toLocaleString('en-US', { maximumFractionDigits: 0 })})`
      );
    }

    if (analysis.overall.avgCapRate > 0) {
      insights.push(
        `Average cap rate: ${(analysis.overall.avgCapRate * 100).toFixed(2)}% (median: ${(analysis.overall.medianCapRate * 100).toFixed(2)}%)`
      );
    }
  }

  // State insights - find highest/lowest
  if (analysis.byState && Object.keys(analysis.byState).length > 1) {
    const stateData = Object.entries(analysis.byState)
      .map(([state, metrics]) => ({
        state,
        avgPrice: metrics.find(m => m.metric === 'avgPrice')?.value || 0,
        count: metrics.find(m => m.metric === 'count')?.value || 0,
      }))
      .filter(s => s.count >= 3); // Only consider states with 3+ sales

    if (stateData.length > 0) {
      const highest = stateData.reduce((max, s) => s.avgPrice > max.avgPrice ? s : max);
      const lowest = stateData.reduce((min, s) => s.avgPrice < min.avgPrice && s.avgPrice > 0 ? s : min);
      
      if (highest.state !== lowest.state) {
        insights.push(
          `${highest.state} has the highest average price at $${(highest.avgPrice / 1000000).toFixed(2)}M, while ${lowest.state} has the lowest at $${(lowest.avgPrice / 1000000).toFixed(2)}M`
        );
      }
    }
  }

  // Year trends
  if (analysis.trends && analysis.trends.priceOverTime.length > 1) {
    const sortedYears = [...analysis.trends.priceOverTime].sort((a, b) => a.year - b.year);
    const recent = sortedYears[sortedYears.length - 1];
    const previous = sortedYears[sortedYears.length - 2];
    
    if (recent && previous) {
      const change = ((recent.avgPrice - previous.avgPrice) / previous.avgPrice) * 100;
      const direction = change > 0 ? 'increased' : 'decreased';
      insights.push(
        `Prices ${direction} ${Math.abs(change).toFixed(1)}% from ${previous.year} to ${recent.year}`
      );
    }
  }

  // Water type insights
  if (analysis.byWaterType && Object.keys(analysis.byWaterType).length > 1) {
    const waterTypeData = Object.entries(analysis.byWaterType)
      .map(([type, metrics]) => ({
        type,
        avgPricePerSlip: metrics.find(m => m.metric === 'avgPricePerSlip')?.value || 0,
        count: metrics.find(m => m.metric === 'count')?.value || 0,
      }))
      .filter(w => w.count >= 3);

    if (waterTypeData.length > 0) {
      const highest = waterTypeData.reduce((max, w) => w.avgPricePerSlip > max.avgPricePerSlip ? w : max);
      insights.push(
        `${highest.type} marinas command the highest price per slip at $${highest.avgPricePerSlip.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      );
    }
  }

  return insights;
}

// Rate Tier Analytics Interfaces and Functions
export interface RateTierAnalyticsFilters {
  states?: string[];
  storageTypes?: string[];
  electricRequired?: boolean;
  protectionLevels?: string[];
  seasonalRate?: boolean;
  sizeMin?: number;
  sizeMax?: number;
}

export interface NormalizedRateTier {
  id: string;
  rateCompId: string;
  marinaName: string;
  state: string;
  city: string;
  storageType: string;
  loaMin: number | null;
  loaMax: number | null;
  sizeBasis: string | null;
  amountCents: number;
  rateUnit: string;
  ratePeriod: string;
  electricIncluded: boolean;
  electricAdditionalCents: number | null;
  protectionLevel: string | null;
  seasonality: string | null;
  seasonStartMonth: number | null;
  seasonEndMonth: number | null;
  tierLabel: string | null;
  normalizedRate: number;
  normalizedRateDisplay: string;
}

export interface RateTierAnalysis {
  overall: {
    count: number;
    avgNormalizedRate: number;
    medianNormalizedRate: number;
    minNormalizedRate: number;
    maxNormalizedRate: number;
    stdDevNormalizedRate: number;
  };
  byStorageType?: Record<string, {
    count: number;
    avgNormalizedRate: number;
    medianNormalizedRate: number;
    minNormalizedRate: number;
    maxNormalizedRate: number;
  }>;
  byState?: Record<string, {
    count: number;
    avgNormalizedRate: number;
    medianNormalizedRate: number;
    minNormalizedRate: number;
    maxNormalizedRate: number;
  }>;
  bySize?: {
    small: { count: number; avgRate: number }; // < 25ft
    medium: { count: number; avgRate: number }; // 25-40ft
    large: { count: number; avgRate: number }; // 40-60ft
    mega: { count: number; avgRate: number }; // > 60ft
  };
  topRates: NormalizedRateTier[];
  bottomRates: NormalizedRateTier[];
  tiers: NormalizedRateTier[];
}

export async function calculateRateTierMetrics(
  orgId: string,
  filters: RateTierAnalyticsFilters = {}
): Promise<RateTierAnalysis> {
  // Get all rate tiers with their parent rate comp info
  const allTiers = await db
    .select({
      tier: rateTiers,
      comp: {
        id: rateComps.id,
        marina: rateComps.marina,
        state: rateComps.state,
        city: rateComps.city,
        orgId: rateComps.orgId,
        deletedAt: rateComps.deletedAt,
      }
    })
    .from(rateTiers)
    .innerJoin(rateComps, eq(rateTiers.rateCompId, rateComps.id))
    .where(and(
      eq(rateComps.orgId, orgId),
      isNull(rateComps.deletedAt)
    ));

  // Apply filters and calculate normalized rates
  let processedTiers: NormalizedRateTier[] = allTiers
    .map(({ tier, comp }) => {
      // Call normalizeRate with the proper tier object structure
      const normResult = normalizeRate({
        amountCents: tier.amountCents,
        rateUnit: tier.rateUnit,
        ratePeriod: tier.ratePeriod,
        loaMin: tier.loaMin,
        loaMax: tier.loaMax,
        seasonality: tier.seasonality,
        seasonStartMonth: tier.seasonStartMonth,
        seasonEndMonth: tier.seasonEndMonth,
      });

      return {
        id: tier.id,
        rateCompId: tier.rateCompId,
        marinaName: comp.marina || 'Unknown Marina',
        state: comp.state || '',
        city: comp.city || '',
        storageType: tier.storageType,
        loaMin: tier.loaMin,
        loaMax: tier.loaMax,
        sizeBasis: tier.sizeBasis,
        amountCents: tier.amountCents,
        rateUnit: tier.rateUnit,
        ratePeriod: tier.ratePeriod,
        electricIncluded: tier.electricIncluded || false,
        electricAdditionalCents: tier.electricAdditionalCents,
        protectionLevel: tier.protectionLevel,
        seasonality: tier.seasonality,
        seasonStartMonth: tier.seasonStartMonth,
        seasonEndMonth: tier.seasonEndMonth,
        tierLabel: tier.tierLabel,
        normalizedRate: normResult.normalizedValue,
        normalizedRateDisplay: formatNormalizedRate(normResult.normalizedValue),
      };
    })
    .filter(tier => tier.normalizedRate > 0); // Filter out invalid rates

  // Apply filters
  if (filters.states && filters.states.length > 0) {
    processedTiers = processedTiers.filter(t => filters.states!.includes(t.state));
  }
  if (filters.storageTypes && filters.storageTypes.length > 0) {
    processedTiers = processedTiers.filter(t => filters.storageTypes!.includes(t.storageType));
  }
  if (filters.electricRequired !== undefined) {
    // Filter by whether electric is included (equivalent to "electric required but provided")
    processedTiers = processedTiers.filter(t => t.electricIncluded === filters.electricRequired);
  }
  if (filters.protectionLevels && filters.protectionLevels.length > 0) {
    processedTiers = processedTiers.filter(t => t.protectionLevel && filters.protectionLevels!.includes(t.protectionLevel));
  }
  if (filters.seasonalRate !== undefined) {
    // Filter by seasonality type
    processedTiers = processedTiers.filter(t => (t.seasonality === 'seasonal') === filters.seasonalRate);
  }
  if (filters.sizeMin !== undefined) {
    processedTiers = processedTiers.filter(t => {
      const size = t.loaMin || 0;
      return size >= filters.sizeMin!;
    });
  }
  if (filters.sizeMax !== undefined) {
    processedTiers = processedTiers.filter(t => {
      const size = t.loaMax || Infinity;
      return size <= filters.sizeMax!;
    });
  }

  // Sort by normalized rate for consistent ordering
  processedTiers.sort((a, b) => a.normalizedRate - b.normalizedRate);

  // Calculate overall statistics
  const rates = processedTiers.map(t => t.normalizedRate);
  const count = rates.length;

  const overall = {
    count,
    avgNormalizedRate: count > 0 ? rates.reduce((a, b) => a + b, 0) / count : 0,
    medianNormalizedRate: count > 0 ? calculateMedian(rates) : 0,
    minNormalizedRate: count > 0 ? Math.min(...rates) : 0,
    maxNormalizedRate: count > 0 ? Math.max(...rates) : 0,
    stdDevNormalizedRate: count > 0 ? calculateStdDev(rates) : 0,
  };

  // Group by storage type
  const byStorageType: Record<string, { count: number; avgNormalizedRate: number; medianNormalizedRate: number; minNormalizedRate: number; maxNormalizedRate: number }> = {};
  const storageTypeGroups = groupBy(processedTiers, t => t.storageType);
  for (const [type, tiers] of Object.entries(storageTypeGroups)) {
    const typeRates = tiers.map(t => t.normalizedRate);
    byStorageType[type] = {
      count: typeRates.length,
      avgNormalizedRate: typeRates.reduce((a, b) => a + b, 0) / typeRates.length,
      medianNormalizedRate: calculateMedian(typeRates),
      minNormalizedRate: Math.min(...typeRates),
      maxNormalizedRate: Math.max(...typeRates),
    };
  }

  // Group by state
  const byState: Record<string, { count: number; avgNormalizedRate: number; medianNormalizedRate: number; minNormalizedRate: number; maxNormalizedRate: number }> = {};
  const stateGroups = groupBy(processedTiers, t => t.state);
  for (const [state, tiers] of Object.entries(stateGroups)) {
    if (!state) continue;
    const stateRates = tiers.map(t => t.normalizedRate);
    byState[state] = {
      count: stateRates.length,
      avgNormalizedRate: stateRates.reduce((a, b) => a + b, 0) / stateRates.length,
      medianNormalizedRate: calculateMedian(stateRates),
      minNormalizedRate: Math.min(...stateRates),
      maxNormalizedRate: Math.max(...stateRates),
    };
  }

  // Group by size
  const bySize = {
    small: { count: 0, avgRate: 0 },
    medium: { count: 0, avgRate: 0 },
    large: { count: 0, avgRate: 0 },
    mega: { count: 0, avgRate: 0 },
  };

  const sizeGroups: Record<string, number[]> = { small: [], medium: [], large: [], mega: [] };
  for (const tier of processedTiers) {
    // Calculate average size using loaMin and loaMax
    const avgSize = tier.loaMin && tier.loaMax 
      ? (tier.loaMin + tier.loaMax) / 2 
      : tier.loaMin || tier.loaMax || 30;
    
    if (avgSize < 25) {
      sizeGroups.small.push(tier.normalizedRate);
    } else if (avgSize < 40) {
      sizeGroups.medium.push(tier.normalizedRate);
    } else if (avgSize < 60) {
      sizeGroups.large.push(tier.normalizedRate);
    } else {
      sizeGroups.mega.push(tier.normalizedRate);
    }
  }

  for (const [size, rates] of Object.entries(sizeGroups)) {
    (bySize as any)[size] = {
      count: rates.length,
      avgRate: rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
    };
  }

  // Get top and bottom rates
  const sortedByRate = [...processedTiers].sort((a, b) => b.normalizedRate - a.normalizedRate);
  const topRates = sortedByRate.slice(0, 10);
  const bottomRates = sortedByRate.slice(-10).reverse();

  return {
    overall,
    byStorageType,
    byState,
    bySize,
    topRates,
    bottomRates,
    tiers: processedTiers,
  };
}

export async function generateRateTierInsights(
  analysis: RateTierAnalysis,
  filters: RateTierAnalyticsFilters = {}
): Promise<string[]> {
  const insights: string[] = [];

  // Overall insights
  if (analysis.overall.count > 0) {
    insights.push(`Analyzed ${analysis.overall.count} rate tiers across marinas.`);
    insights.push(
      `Average normalized rate: ${formatNormalizedRate(analysis.overall.avgNormalizedRate)} (median: ${formatNormalizedRate(analysis.overall.medianNormalizedRate)})`
    );
    insights.push(
      `Rate range: ${formatNormalizedRate(analysis.overall.minNormalizedRate)} to ${formatNormalizedRate(analysis.overall.maxNormalizedRate)}`
    );
  }

  // Storage type insights
  if (analysis.byStorageType && Object.keys(analysis.byStorageType).length > 1) {
    const storageData = Object.entries(analysis.byStorageType)
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => b[1].avgNormalizedRate - a[1].avgNormalizedRate);

    if (storageData.length > 0) {
      const [highestType, highestData] = storageData[0];
      const [lowestType, lowestData] = storageData[storageData.length - 1];
      
      const highestLabel = STORAGE_TYPE_LABELS[highestType as keyof typeof STORAGE_TYPE_LABELS] || highestType;
      const lowestLabel = STORAGE_TYPE_LABELS[lowestType as keyof typeof STORAGE_TYPE_LABELS] || lowestType;
      
      insights.push(
        `${highestLabel} commands the highest rates at ${formatNormalizedRate(highestData.avgNormalizedRate)} avg`
      );
      if (highestType !== lowestType) {
        insights.push(
          `${lowestLabel} has the lowest rates at ${formatNormalizedRate(lowestData.avgNormalizedRate)} avg`
        );
      }
    }
  }

  // State insights
  if (analysis.byState && Object.keys(analysis.byState).length > 1) {
    const stateData = Object.entries(analysis.byState)
      .filter(([_, data]) => data.count >= 2)
      .sort((a, b) => b[1].avgNormalizedRate - a[1].avgNormalizedRate);

    if (stateData.length > 0) {
      const [highestState, highestData] = stateData[0];
      insights.push(
        `${highestState} has the highest average rates at ${formatNormalizedRate(highestData.avgNormalizedRate)}`
      );
    }
  }

  // Size insights
  if (analysis.bySize) {
    const sizesWithData = Object.entries(analysis.bySize)
      .filter(([_, data]) => data.count > 0)
      .sort((a, b) => b[1].avgRate - a[1].avgRate);

    if (sizesWithData.length > 0) {
      const sizeLabels: Record<string, string> = {
        small: 'Small boats (<25ft)',
        medium: 'Medium boats (25-40ft)',
        large: 'Large boats (40-60ft)',
        mega: 'Mega yachts (>60ft)',
      };

      const [highestSize, highestData] = sizesWithData[0];
      insights.push(
        `${sizeLabels[highestSize]} have the highest average rates at ${formatNormalizedRate(highestData.avgRate)}`
      );
    }
  }

  return insights;
}

// Utility functions
function calculateMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 
    ? sorted[mid] 
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
