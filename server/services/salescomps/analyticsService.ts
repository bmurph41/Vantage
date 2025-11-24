import { db } from '../../db';
import { salesComps } from '../../../shared/schema';
import { sql, and, eq, isNull, inArray, desc } from 'drizzle-orm';

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
  coastalType?: string[];
  region?: string[];
  broker?: string[];
  isPortfolio?: boolean | null;
}

export interface MetricResult {
  metric: string;
  value: number;
  sampleSize: number;
  groupBy?: string;
  groupValue?: string;
}

export interface AgentMetrics {
  agentName: string;
  brokerage: string | null;
  dealCount: number;
  totalSales: number;
  avgSalePrice: number;
  avgPricePerSlip: number;
  totalValue: number;
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
  byAgent?: AgentMetrics[];
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
    conditions.push(sql`${salesComps.saleYear} >= ${filters.yearSoldMin}`);
  }

  if (filters.yearSoldMax) {
    conditions.push(sql`${salesComps.saleYear} <= ${filters.yearSoldMax}`);
  }

  if (filters.priceMin) {
    conditions.push(sql`${salesComps.salePrice} >= ${filters.priceMin}`);
  }

  if (filters.priceMax) {
    conditions.push(sql`${salesComps.salePrice} <= ${filters.priceMax}`);
  }

  if (filters.pricePerSlipMin) {
    conditions.push(sql`CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END >= ${filters.pricePerSlipMin}`);
  }

  if (filters.pricePerSlipMax) {
    conditions.push(sql`CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END <= ${filters.pricePerSlipMax}`);
  }

  if (filters.waterTypes && filters.waterTypes.length > 0) {
    conditions.push(inArray(salesComps.waterType, filters.waterTypes));
  }

  if (filters.capacityMin) {
    conditions.push(sql`(${salesComps.wetSlips} + ${salesComps.dryRacks}) >= ${filters.capacityMin}`);
  }

  if (filters.capacityMax) {
    conditions.push(sql`(${salesComps.wetSlips} + ${salesComps.dryRacks}) <= ${filters.capacityMax}`);
  }

  if (filters.profitCenters && filters.profitCenters.length > 0) {
    const profitCenterConditions = filters.profitCenters.map(pc => 
      sql`${salesComps.profitCenters} @> ARRAY[${pc}]::text[]`
    );
    conditions.push(sql`(${sql.join(profitCenterConditions, sql` OR `)})`);
  }

  if (filters.coastalType && filters.coastalType.length > 0) {
    conditions.push(inArray(salesComps.coastalType, filters.coastalType));
  }

  if (filters.region && filters.region.length > 0) {
    conditions.push(inArray(salesComps.region, filters.region));
  }

  if (filters.broker && filters.broker.length > 0) {
    conditions.push(inArray(salesComps.brokerage, filters.broker));
  }

  if (filters.isPortfolio !== undefined && filters.isPortfolio !== null) {
    conditions.push(eq(salesComps.isPortfolio, filters.isPortfolio));
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
      avgPrice: sql<number>`AVG(${salesComps.salePrice})`,
      medianPrice: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.salePrice})`,
      avgPricePerSlip: sql<number>`AVG(CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END)`,
      medianPricePerSlip: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate})`,
      medianCapRate: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.capRate})`,
      avgCapacity: sql<number>`AVG(${salesComps.wetSlips} + ${salesComps.dryRacks})`,
      totalValue: sql<number>`SUM(${salesComps.salePrice})`,
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
      avgPrice: sql<number>`AVG(${salesComps.salePrice})`,
      medianPrice: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.salePrice})`,
      avgPricePerSlip: sql<number>`AVG(CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END)`,
      medianPricePerSlip: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate})`,
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
      year: salesComps.saleYear,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${salesComps.salePrice})`,
      avgPricePerSlip: sql<number>`AVG(CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate})`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(salesComps.saleYear)
    .orderBy(salesComps.saleYear);

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
      avgPrice: sql<number>`AVG(${salesComps.salePrice})`,
      avgPricePerSlip: sql<number>`AVG(CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate})`,
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
          WHEN ${salesComps.salePrice} < 1000000 THEN 'Under $1M'
          WHEN ${salesComps.salePrice} < 5000000 THEN '$1M - $5M'
          WHEN ${salesComps.salePrice} < 10000000 THEN '$5M - $10M'
          WHEN ${salesComps.salePrice} < 25000000 THEN '$10M - $25M'
          ELSE 'Over $25M'
        END
      `,
      count: sql<number>`COUNT(*)`,
      avgPrice: sql<number>`AVG(${salesComps.salePrice})`,
      avgPricePerSlip: sql<number>`AVG(CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate})`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(sql`
      CASE
        WHEN ${salesComps.salePrice} < 1000000 THEN 'Under $1M'
        WHEN ${salesComps.salePrice} < 5000000 THEN '$1M - $5M'
        WHEN ${salesComps.salePrice} < 10000000 THEN '$5M - $10M'
        WHEN ${salesComps.salePrice} < 25000000 THEN '$10M - $25M'
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

  // By Agent - aggregated agent sales metrics
  const byAgentResults = await db
    .select({
      brokerage: salesComps.brokerage,
      agentFirstName: salesComps.agentFirstName,
      agentLastName: salesComps.agentLastName,
      broker: salesComps.broker,
      dealCount: sql<number>`COUNT(*)`,
      totalSales: sql<number>`SUM(${salesComps.salePrice})`,
      avgSalePrice: sql<number>`AVG(${salesComps.salePrice})`,
      avgPricePerSlip: sql<number>`AVG(CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END)`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(salesComps.brokerage, salesComps.agentFirstName, salesComps.agentLastName, salesComps.broker)
    .orderBy(sql`SUM(${salesComps.salePrice}) DESC NULLS LAST`);

  const byAgent: AgentMetrics[] = byAgentResults
    .map((row: any) => {
      // Create display name from available fields, prioritizing new fields over legacy
      let agentName = '';
      if (row.agentFirstName || row.agentLastName) {
        agentName = [row.agentFirstName, row.agentLastName].filter(Boolean).join(' ').trim();
      } else if (row.broker) {
        agentName = row.broker;
      }

      // Only include records with at least some identifying information
      if (!agentName && !row.brokerage) {
        return null;
      }

      return {
        agentName: agentName || 'Unknown Agent',
        brokerage: row.brokerage || null,
        dealCount: row.dealCount,
        totalSales: row.totalSales || 0,
        avgSalePrice: row.avgSalePrice || 0,
        avgPricePerSlip: row.avgPricePerSlip || 0,
        totalValue: row.totalSales || 0,
      };
    })
    .filter((agent): agent is AgentMetrics => agent !== null);

  return {
    overall,
    byState,
    byYear,
    byWaterType,
    byPriceRange,
    byAgent,
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

// Correlation analysis data structures
export interface ScatterDataPoint {
  x: number;
  y: number;
  name: string;
  id: string;
}

export interface CorrelationData {
  priceVsCapRate: {
    data: ScatterDataPoint[];
    correlation: number;
    sampleSize: number;
  };
  priceVsCapacity: {
    data: ScatterDataPoint[];
    correlation: number;
    sampleSize: number;
  };
  pricePerSlipVsCapacity: {
    data: ScatterDataPoint[];
    correlation: number;
    sampleSize: number;
  };
}

// Calculate Pearson correlation coefficient
function calculateCorrelation(xValues: number[], yValues: number[]): number {
  if (xValues.length !== yValues.length || xValues.length === 0) return 0;
  
  const n = xValues.length;
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);
  const sumY2 = yValues.reduce((sum, y) => sum + y * y, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export async function calculateCorrelationData(
  orgId: string,
  filters: AnalyticsFilters
): Promise<CorrelationData> {
  const whereClause = applyFilters(orgId, filters);

  // Fetch raw comp data
  const comps = await db
    .select({
      id: salesComps.id,
      marina: salesComps.marina,
      salePrice: salesComps.salePrice,
      capRate: salesComps.capRate,
      wetSlips: salesComps.wetSlips,
      dryRacks: salesComps.dryRacks,
    })
    .from(salesComps)
    .where(whereClause)
    .limit(500); // Limit for performance

  // Price vs Cap Rate
  const priceCapRateData = comps
    .filter(c => c.salePrice && c.capRate && c.capRate > 0)
    .map(c => ({
      x: parseFloat(c.salePrice as string),
      y: parseFloat(c.capRate as string) * 100, // Convert to percentage
      name: c.marina || 'Unknown Marina',
      id: c.id,
    }));

  const priceCapRateCorrelation = calculateCorrelation(
    priceCapRateData.map(d => d.x),
    priceCapRateData.map(d => d.y)
  );

  // Price vs Capacity
  const priceCapacityData = comps
    .filter(c => {
      const capacity = (c.wetSlips || 0) + (c.dryRacks || 0);
      return c.salePrice && capacity > 0;
    })
    .map(c => ({
      x: parseFloat(c.salePrice as string),
      y: (c.wetSlips || 0) + (c.dryRacks || 0),
      name: c.marina || 'Unknown Marina',
      id: c.id,
    }));

  const priceCapacityCorrelation = calculateCorrelation(
    priceCapacityData.map(d => d.x),
    priceCapacityData.map(d => d.y)
  );

  // Price Per Slip vs Capacity
  const pricePerSlipCapacityData = comps
    .filter(c => {
      const capacity = (c.wetSlips || 0) + (c.dryRacks || 0);
      return c.salePrice && capacity > 0;
    })
    .map(c => {
      const capacity = (c.wetSlips || 0) + (c.dryRacks || 0);
      const pricePerSlip = parseFloat(c.salePrice as string) / capacity;
      return {
        x: capacity,
        y: pricePerSlip,
        name: c.marina || 'Unknown Marina',
        id: c.id,
      };
    });

  const pricePerSlipCapacityCorrelation = calculateCorrelation(
    pricePerSlipCapacityData.map(d => d.x),
    pricePerSlipCapacityData.map(d => d.y)
  );

  return {
    priceVsCapRate: {
      data: priceCapRateData,
      correlation: priceCapRateCorrelation,
      sampleSize: priceCapRateData.length,
    },
    priceVsCapacity: {
      data: priceCapacityData,
      correlation: priceCapacityCorrelation,
      sampleSize: priceCapacityData.length,
    },
    pricePerSlipVsCapacity: {
      data: pricePerSlipCapacityData,
      correlation: pricePerSlipCapacityCorrelation,
      sampleSize: pricePerSlipCapacityData.length,
    },
  };
}

// Valuation models data structures
export interface RegressionModel {
  data: Array<{ x: number; predicted: number; actual: number; label?: string }>;
  r2: number;
  rmse?: number;
  mae?: number;
}

export interface ValuationModels {
  pricePerSlipModel: RegressionModel;
  capRateModel: RegressionModel;
}

// Simple linear regression
function linearRegression(xValues: number[], yValues: number[]): { slope: number; intercept: number; r2: number } {
  const n = xValues.length;
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);
  const sumY2 = yValues.reduce((sum, y) => sum + y * y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R²
  const meanY = sumY / n;
  const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
  const ssResidual = yValues.reduce((sum, y, i) => sum + Math.pow(y - (slope * xValues[i] + intercept), 2), 0);
  const r2 = 1 - (ssResidual / ssTotal);

  return { slope, intercept, r2 };
}

// Calculate RMSE
function calculateRMSE(actual: number[], predicted: number[]): number {
  const n = actual.length;
  const sumSquaredErrors = actual.reduce((sum, y, i) => sum + Math.pow(y - predicted[i], 2), 0);
  return Math.sqrt(sumSquaredErrors / n);
}

// Calculate MAE
function calculateMAE(actual: number[], predicted: number[]): number {
  const n = actual.length;
  const sumAbsErrors = actual.reduce((sum, y, i) => sum + Math.abs(y - predicted[i]), 0);
  return sumAbsErrors / n;
}

export async function calculateValuationModels(
  orgId: string,
  filters: AnalyticsFilters
): Promise<ValuationModels> {
  const whereClause = applyFilters(orgId, filters);

  // Fetch raw comp data
  const comps = await db
    .select({
      id: salesComps.id,
      marina: salesComps.marina,
      salePrice: salesComps.salePrice,
      capRate: salesComps.capRate,
      wetSlips: salesComps.wetSlips,
      dryRacks: salesComps.dryRacks,
      saleYear: salesComps.saleYear,
      saleMonth: salesComps.saleMonth,
    })
    .from(salesComps)
    .where(whereClause)
    .limit(500);

  // Price Per Slip vs Capacity Model
  const pricePerSlipData = comps
    .filter(c => {
      const capacity = (c.wetSlips || 0) + (c.dryRacks || 0);
      return c.salePrice && capacity > 0;
    })
    .map(c => {
      const capacity = (c.wetSlips || 0) + (c.dryRacks || 0);
      const pricePerSlip = parseFloat(c.salePrice as string) / capacity;
      return {
        capacity,
        pricePerSlip,
      };
    })
    .sort((a, b) => a.capacity - b.capacity);

  let pricePerSlipModel: RegressionModel;
  if (pricePerSlipData.length >= 5) {
    const xValues = pricePerSlipData.map(d => d.capacity);
    const yValues = pricePerSlipData.map(d => d.pricePerSlip);
    const { slope, intercept, r2 } = linearRegression(xValues, yValues);

    // Create model data points with capacity ranges
    const capacityRanges = [50, 100, 200, 400, 600];
    const modelData = capacityRanges.map(capacity => {
      const predicted = slope * capacity + intercept;
      // Find actual average for this range
      const rangeData = pricePerSlipData.filter(d => 
        Math.abs(d.capacity - capacity) < 100
      );
      const actual = rangeData.length > 0
        ? rangeData.reduce((sum, d) => sum + d.pricePerSlip, 0) / rangeData.length
        : predicted;

      return {
        x: capacity,
        predicted: Math.max(0, predicted),
        actual: actual,
        label: `${capacity} slips`,
      };
    });

    const predictedValues = xValues.map(x => slope * x + intercept);
    const rmse = calculateRMSE(yValues, predictedValues);

    pricePerSlipModel = {
      data: modelData,
      r2: Math.max(0, Math.min(1, r2)),
      rmse: rmse,
    };
  } else {
    // Not enough data
    pricePerSlipModel = {
      data: [],
      r2: 0,
      rmse: 0,
    };
  }

  // Cap Rate Trend Model (by year)
  const capRateByYear = comps
    .filter(c => c.capRate && c.saleYear && c.capRate > 0)
    .map(c => ({
      year: c.saleYear as number,
      capRate: parseFloat(c.capRate as string) * 100, // Convert to percentage
    }));

  // Group by year and calculate averages
  const yearGroups = capRateByYear.reduce((acc, item) => {
    if (!acc[item.year]) acc[item.year] = [];
    acc[item.year].push(item.capRate);
    return acc;
  }, {} as Record<number, number[]>);

  const yearlyAvg = Object.entries(yearGroups)
    .map(([year, rates]) => ({
      year: parseInt(year),
      avgCapRate: rates.reduce((a, b) => a + b, 0) / rates.length,
    }))
    .sort((a, b) => a.year - b.year);

  let capRateModel: RegressionModel;
  if (yearlyAvg.length >= 3) {
    const xValues = yearlyAvg.map(d => d.year);
    const yValues = yearlyAvg.map(d => d.avgCapRate);
    const { slope, intercept, r2 } = linearRegression(xValues, yValues);

    const modelData = yearlyAvg.map(d => ({
      x: d.year,
      predicted: slope * d.year + intercept,
      actual: d.avgCapRate,
    }));

    const predictedValues = xValues.map(x => slope * x + intercept);
    const mae = calculateMAE(yValues, predictedValues);

    capRateModel = {
      data: modelData,
      r2: Math.max(0, Math.min(1, r2)),
      mae: mae,
    };
  } else {
    capRateModel = {
      data: [],
      r2: 0,
      mae: 0,
    };
  }

  return {
    pricePerSlipModel,
    capRateModel,
  };
}

// Get matched comps with similarity scoring
export async function getMatchedComps(
  orgId: string,
  filters: AnalyticsFilters
): Promise<any[]> {
  const whereClause = applyFilters(orgId, filters);

  const comps = await db
    .select({
      id: salesComps.id,
      propertyName: salesComps.marina,
      address: salesComps.address,
      city: salesComps.city,
      state: salesComps.state,
      zipCode: salesComps.zip,
      saleYear: salesComps.saleYear,
      saleMonth: salesComps.saleMonth,
      salePrice: salesComps.salePrice,
      totalSlips: sql<number>`(${salesComps.wetSlips} + ${salesComps.dryRacks})`,
      pricePerSlip: sql<number>`CASE WHEN (${salesComps.wetSlips} + ${salesComps.dryRacks}) > 0 THEN ${salesComps.salePrice} / (${salesComps.wetSlips} + ${salesComps.dryRacks}) ELSE NULL END`,
      storageTypes: salesComps.storageTypes,
      profitCenters: salesComps.profitCenters,
      waterType: salesComps.waterType,
      buyerName: sql<string>`NULL`,
      sellerName: salesComps.seller,
      brokerName: salesComps.brokerage,
      coastalType: salesComps.coastalType,
      region: salesComps.region,
      isPortfolio: salesComps.isPortfolio,
      capRate: salesComps.capRate,
    })
    .from(salesComps)
    .where(whereClause)
    .orderBy(desc(salesComps.saleYear), desc(salesComps.saleMonth))
    .limit(100);

  return comps;
}
