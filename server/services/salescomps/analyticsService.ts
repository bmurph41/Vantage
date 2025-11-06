import { db } from '../../db';
import { salesComps } from '../../../shared/schema';
import { sql, and, eq, isNull, inArray } from 'drizzle-orm';

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
    eq(salesComps.orgId, orgId),
    isNull(salesComps.deletedAt)
  ];

  if (filters.states && filters.states.length > 0) {
    conditions.push(inArray(salesComps.state, filters.states));
  }

  if (filters.yearSoldMin) {
    conditions.push(sql`EXTRACT(YEAR FROM ${salesComps.saleDate})::integer >= ${filters.yearSoldMin}`);
  }

  if (filters.yearSoldMax) {
    conditions.push(sql`EXTRACT(YEAR FROM ${salesComps.saleDate})::integer <= ${filters.yearSoldMax}`);
  }

  if (filters.priceMin) {
    conditions.push(sql`${salesComps.salePrice}::numeric >= ${filters.priceMin}`);
  }

  if (filters.priceMax) {
    conditions.push(sql`${salesComps.salePrice}::numeric <= ${filters.priceMax}`);
  }

  if (filters.pricePerSlipMin) {
    conditions.push(sql`${salesComps.pricePerSlip}::numeric >= ${filters.pricePerSlipMin}`);
  }

  if (filters.pricePerSlipMax) {
    conditions.push(sql`${salesComps.pricePerSlip}::numeric <= ${filters.pricePerSlipMax}`);
  }

  if (filters.waterTypes && filters.waterTypes.length > 0) {
    conditions.push(inArray(salesComps.waterType, filters.waterTypes));
  }

  if (filters.capacityMin) {
    conditions.push(sql`${salesComps.slipCapacity}::integer >= ${filters.capacityMin}`);
  }

  if (filters.capacityMax) {
    conditions.push(sql`${salesComps.slipCapacity}::integer <= ${filters.capacityMax}`);
  }

  if (filters.profitCenters && filters.profitCenters.length > 0) {
    const profitCenterConditions = filters.profitCenters.map(pc => 
      sql`${salesComps.profitCenters} @> ARRAY[${pc}]::text[]`
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
      avgPrice: sql<number>`AVG(${salesComps.salePrice}::numeric)`,
      medianPrice: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${salesComps.pricePerSlip}::numeric)`,
      medianPricePerSlip: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate}::numeric)`,
      medianCapRate: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.capRate}::numeric)`,
      avgCapacity: sql<number>`AVG(${salesComps.slipCapacity}::numeric)`,
      totalValue: sql<number>`SUM(${salesComps.salePrice}::numeric)`,
    })
    .from(salesComps)
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
      state: salesComps.state,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${salesComps.salePrice}::numeric)`,
      medianPrice: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${salesComps.pricePerSlip}::numeric)`,
      medianPricePerSlip: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate}::numeric)`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(salesComps.state)
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
      year: sql<number>`EXTRACT(YEAR FROM ${salesComps.saleDate})::integer`,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${salesComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${salesComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate}::numeric)`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(sql`EXTRACT(YEAR FROM ${salesComps.saleDate})`)
    .orderBy(sql`EXTRACT(YEAR FROM ${salesComps.saleDate})`);

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
      waterType: salesComps.waterType,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${salesComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${salesComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate}::numeric)`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(salesComps.waterType)
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
          WHEN ${salesComps.salePrice}::numeric < 1000000 THEN 'Under $1M'
          WHEN ${salesComps.salePrice}::numeric < 5000000 THEN '$1M - $5M'
          WHEN ${salesComps.salePrice}::numeric < 10000000 THEN '$5M - $10M'
          WHEN ${salesComps.salePrice}::numeric < 25000000 THEN '$10M - $25M'
          ELSE 'Over $25M'
        END
      `,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${salesComps.salePrice}::numeric)`,
      avgPricePerSlip: sql<number>`AVG(${salesComps.pricePerSlip}::numeric)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate}::numeric)`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(sql`
      CASE
        WHEN ${salesComps.salePrice}::numeric < 1000000 THEN 'Under $1M'
        WHEN ${salesComps.salePrice}::numeric < 5000000 THEN '$1M - $5M'
        WHEN ${salesComps.salePrice}::numeric < 10000000 THEN '$5M - $10M'
        WHEN ${salesComps.salePrice}::numeric < 25000000 THEN '$10M - $25M'
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
    insights.push(`Analyzed ${analysis.overall.count} marina sales comparables.`);
    
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
