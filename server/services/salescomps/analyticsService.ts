import { db } from '../../db';
import { salesComps } from '../../../shared/schema';
import { sql, and, eq, isNull, inArray, desc, or } from 'drizzle-orm';

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
      wetSlips: salesComps.wetSlips,
      dryRacks: salesComps.dryRacks,
      totalSlips: sql<number>`COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0)`,
      pricePerSlip: sql<number>`CASE WHEN (COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0)) > 0 THEN ${salesComps.salePrice}::numeric / (COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0)) ELSE NULL END`,
      storageTypes: salesComps.storageTypes,
      profitCenters: salesComps.profitCenters,
      waterType: salesComps.waterType,
      buyerName: salesComps.owner,
      sellerName: salesComps.seller,
      brokerName: salesComps.brokerage,
      agentName: sql<string>`CONCAT_WS(' ', ${salesComps.agentFirstName}, ${salesComps.agentLastName})`,
      coastalType: salesComps.coastalType,
      region: salesComps.region,
      isPortfolio: salesComps.isPortfolio,
      capRate: salesComps.capRate,
      noi: salesComps.noi,
      listPrice: salesComps.listPrice,
      acres: salesComps.acres,
      occupancy: salesComps.occupancy,
      yearBuilt: salesComps.yearBuilt,
      daysOnMarket: salesComps.daysOnMarket,
      saleCondition: salesComps.saleCondition,
      bodyOfWater: salesComps.bodyOfWater,
      waterBodyName: salesComps.waterBodyName,
      company: salesComps.company,
      lat: salesComps.lat,
      lng: salesComps.lng,
    })
    .from(salesComps)
    .where(whereClause)
    .orderBy(desc(salesComps.saleYear), desc(salesComps.saleMonth))
    .limit(500);

  return comps;
}

// ==========================================
// MARKET TRENDS ANALYSIS
// ==========================================

export interface TrendsFilters {
  yearMin?: number;
  yearMax?: number;
  regions?: string[];
  states?: string[];
  wetSlipsMin?: number;
  wetSlipsMax?: number;
  dryRacksMin?: number;
  dryRacksMax?: number;
  profitCenters?: string[];
}

export interface YearlyTrendData {
  year: number;
  transactionCount: number;
  totalVolume: number;
  avgPrice: number;
  medianPrice: number;
  avgPricePerSlip: number;
  medianPricePerSlip: number;
  avgCapRate: number;
  avgCapacity: number;
}

export interface QuarterlyTrendData {
  year: number;
  quarter: number;
  label: string;
  transactionCount: number;
  totalVolume: number;
  avgPrice: number;
  avgPricePerSlip: number;
}

export interface RegionalTrendData {
  region: string;
  transactionCount: number;
  totalVolume: number;
  avgPrice: number;
  marketShare: number;
}

export interface RepeatSale {
  propertyName: string;
  city: string | null;
  state: string | null;
  sales: Array<{
    saleYear: number;
    saleMonth: number | null;
    salePrice: number;
    pricePerSlip: number | null;
  }>;
  priceAppreciation: number;
  annualizedReturn: number;
  holdingPeriodYears: number;
}

export interface MarketTrendsData {
  summary: {
    totalTransactions: number;
    totalVolume: number;
    earliestYear: number;
    latestYear: number;
    avgAnnualGrowth: number;
    volumeCAGR: number;
  };
  yearlyTrends: YearlyTrendData[];
  quarterlyTrends: QuarterlyTrendData[];
  regionalBreakdown: RegionalTrendData[];
  repeatSales: RepeatSale[];
  topBrokers: Array<{
    name: string;
    dealCount: number;
    totalVolume: number;
    marketShare: number;
  }>;
}

function applyTrendsFilters(orgId: string, filters: TrendsFilters) {
  const conditions: any[] = [
    eq(salesComps.orgId, orgId),
    isNull(salesComps.deletedAt),
    sql`${salesComps.saleYear} IS NOT NULL`
  ];

  if (filters.yearMin) {
    conditions.push(sql`${salesComps.saleYear} >= ${filters.yearMin}`);
  }

  if (filters.yearMax) {
    conditions.push(sql`${salesComps.saleYear} <= ${filters.yearMax}`);
  }

  // Location filters - use inArray for robust parameter handling
  if (filters.regions && filters.regions.length > 0) {
    conditions.push(inArray(salesComps.region, filters.regions));
  }

  if (filters.states && filters.states.length > 0) {
    conditions.push(inArray(salesComps.state, filters.states));
  }

  // Capacity filters - check for undefined to allow zero values
  if (filters.wetSlipsMin !== undefined) {
    conditions.push(sql`COALESCE(${salesComps.wetSlips}, 0) >= ${filters.wetSlipsMin}`);
  }

  if (filters.wetSlipsMax !== undefined) {
    conditions.push(sql`COALESCE(${salesComps.wetSlips}, 0) <= ${filters.wetSlipsMax}`);
  }

  if (filters.dryRacksMin !== undefined) {
    conditions.push(sql`COALESCE(${salesComps.dryRacks}, 0) >= ${filters.dryRacksMin}`);
  }

  if (filters.dryRacksMax !== undefined) {
    conditions.push(sql`COALESCE(${salesComps.dryRacks}, 0) <= ${filters.dryRacksMax}`);
  }

  // Profit center filters - match any of the selected profit centers
  if (filters.profitCenters && filters.profitCenters.length > 0) {
    const profitCenterConditions: any[] = [];
    for (const pc of filters.profitCenters) {
      switch (pc) {
        case 'storage':
          profitCenterConditions.push(eq(salesComps.profitCenterStorage, true));
          break;
        case 'events':
          profitCenterConditions.push(eq(salesComps.profitCenterEvents, true));
          break;
        case 'service':
          profitCenterConditions.push(eq(salesComps.profitCenterService, true));
          break;
        case 'third_party_leases':
          profitCenterConditions.push(eq(salesComps.profitCenterThirdPartyLeases, true));
          break;
        case 'boat_rentals':
          profitCenterConditions.push(eq(salesComps.profitCenterBoatRentals, true));
          break;
        case 'boat_brokerage':
          profitCenterConditions.push(eq(salesComps.profitCenterBoatBrokerage, true));
          break;
        case 'rv_park':
          profitCenterConditions.push(eq(salesComps.profitCenterRvPark, true));
          break;
        case 'fuel':
          profitCenterConditions.push(eq(salesComps.profitCenterFuel, true));
          break;
        case 'ship_store':
          profitCenterConditions.push(eq(salesComps.profitCenterShipStore, true));
          break;
        case 'parts':
          profitCenterConditions.push(eq(salesComps.profitCenterParts, true));
          break;
      }
    }
    if (profitCenterConditions.length > 0) {
      conditions.push(or(...profitCenterConditions));
    }
  }

  return and(...conditions);
}

export async function getMarketTrends(
  orgId: string,
  filters: TrendsFilters = {}
): Promise<MarketTrendsData> {
  const whereClause = applyTrendsFilters(orgId, filters);

  // Get yearly trends
  const yearlyResults = await db
    .select({
      year: salesComps.saleYear,
      transactionCount: sql<number>`COUNT(*)`,
      totalVolume: sql<number>`SUM(COALESCE(${salesComps.salePrice}, 0))`,
      avgPrice: sql<number>`AVG(${salesComps.salePrice})`,
      medianPrice: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${salesComps.salePrice})`,
      avgPricePerSlip: sql<number>`AVG(CASE WHEN (COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0)) > 0 THEN ${salesComps.salePrice}::numeric / (COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0)) ELSE NULL END)`,
      medianPricePerSlip: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CASE WHEN (COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0)) > 0 THEN ${salesComps.salePrice}::numeric / (COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0)) ELSE NULL END)`,
      avgCapRate: sql<number>`AVG(${salesComps.capRate})`,
      avgCapacity: sql<number>`AVG(COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0))`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(salesComps.saleYear)
    .orderBy(salesComps.saleYear);

  const yearlyTrends: YearlyTrendData[] = yearlyResults
    .filter((r: any) => r.year)
    .map((r: any) => ({
      year: r.year,
      transactionCount: Number(r.transactionCount) || 0,
      totalVolume: Number(r.totalVolume) || 0,
      avgPrice: Number(r.avgPrice) || 0,
      medianPrice: Number(r.medianPrice) || 0,
      avgPricePerSlip: Number(r.avgPricePerSlip) || 0,
      medianPricePerSlip: Number(r.medianPricePerSlip) || 0,
      avgCapRate: Number(r.avgCapRate) || 0,
      avgCapacity: Number(r.avgCapacity) || 0,
    }));

  // Get quarterly trends for more granular view
  const quarterlyResults = await db
    .select({
      year: salesComps.saleYear,
      quarter: sql<number>`CEIL(COALESCE(${salesComps.saleMonth}, 1)::numeric / 3)`,
      transactionCount: sql<number>`COUNT(*)`,
      totalVolume: sql<number>`SUM(COALESCE(${salesComps.salePrice}, 0))`,
      avgPrice: sql<number>`AVG(${salesComps.salePrice})`,
      avgPricePerSlip: sql<number>`AVG(CASE WHEN (COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0)) > 0 THEN ${salesComps.salePrice}::numeric / (COALESCE(${salesComps.wetSlips}, 0) + COALESCE(${salesComps.dryRacks}, 0)) ELSE NULL END)`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(salesComps.saleYear, sql`CEIL(COALESCE(${salesComps.saleMonth}, 1)::numeric / 3)`)
    .orderBy(salesComps.saleYear, sql`CEIL(COALESCE(${salesComps.saleMonth}, 1)::numeric / 3)`);

  const quarterlyTrends: QuarterlyTrendData[] = quarterlyResults
    .filter((r: any) => r.year)
    .map((r: any) => ({
      year: r.year,
      quarter: Number(r.quarter) || 1,
      label: `Q${r.quarter || 1} ${r.year}`,
      transactionCount: Number(r.transactionCount) || 0,
      totalVolume: Number(r.totalVolume) || 0,
      avgPrice: Number(r.avgPrice) || 0,
      avgPricePerSlip: Number(r.avgPricePerSlip) || 0,
    }));

  // Get regional breakdown
  const totalVolumeResult = await db
    .select({
      total: sql<number>`SUM(COALESCE(${salesComps.salePrice}, 0))`,
    })
    .from(salesComps)
    .where(whereClause);

  const totalMarketVolume = Number(totalVolumeResult[0]?.total) || 1;

  const regionalResults = await db
    .select({
      region: salesComps.region,
      transactionCount: sql<number>`COUNT(*)`,
      totalVolume: sql<number>`SUM(COALESCE(${salesComps.salePrice}, 0))`,
      avgPrice: sql<number>`AVG(${salesComps.salePrice})`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(salesComps.region)
    .orderBy(sql`SUM(COALESCE(${salesComps.salePrice}, 0)) DESC`);

  const regionalBreakdown: RegionalTrendData[] = regionalResults
    .filter((r: any) => r.region)
    .map((r: any) => ({
      region: r.region || 'Unknown',
      transactionCount: Number(r.transactionCount) || 0,
      totalVolume: Number(r.totalVolume) || 0,
      avgPrice: Number(r.avgPrice) || 0,
      marketShare: (Number(r.totalVolume) / totalMarketVolume) * 100,
    }));

  // Get repeat sales (properties sold multiple times)
  const repeatSalesQuery = await db
    .select({
      marina: salesComps.marina,
      city: salesComps.city,
      state: salesComps.state,
      saleYear: salesComps.saleYear,
      saleMonth: salesComps.saleMonth,
      salePrice: salesComps.salePrice,
      wetSlips: salesComps.wetSlips,
      dryRacks: salesComps.dryRacks,
    })
    .from(salesComps)
    .where(whereClause)
    .orderBy(salesComps.marina, salesComps.saleYear, salesComps.saleMonth);

  // Group by property name to find repeat sales
  const propertySales = new Map<string, any[]>();
  for (const sale of repeatSalesQuery) {
    if (!sale.marina) continue;
    const key = `${sale.marina.toLowerCase().trim()}-${sale.city?.toLowerCase() || ''}-${sale.state?.toLowerCase() || ''}`;
    if (!propertySales.has(key)) {
      propertySales.set(key, []);
    }
    propertySales.get(key)!.push(sale);
  }

  const repeatSales: RepeatSale[] = [];
  for (const [_, sales] of propertySales) {
    if (sales.length < 2) continue;

    // Sort by year/month
    sales.sort((a, b) => {
      if (a.saleYear !== b.saleYear) return a.saleYear - b.saleYear;
      return (a.saleMonth || 1) - (b.saleMonth || 1);
    });

    const firstSale = sales[0];
    const lastSale = sales[sales.length - 1];
    const firstPrice = Number(firstSale.salePrice) || 0;
    const lastPrice = Number(lastSale.salePrice) || 0;

    if (firstPrice <= 0 || lastPrice <= 0) continue;

    const holdingPeriodYears = (lastSale.saleYear - firstSale.saleYear) || 1;
    const priceAppreciation = ((lastPrice - firstPrice) / firstPrice) * 100;
    const annualizedReturn = holdingPeriodYears > 0 
      ? (Math.pow(lastPrice / firstPrice, 1 / holdingPeriodYears) - 1) * 100 
      : 0;

    repeatSales.push({
      propertyName: firstSale.marina,
      city: firstSale.city,
      state: firstSale.state,
      sales: sales.map(s => ({
        saleYear: s.saleYear,
        saleMonth: s.saleMonth,
        salePrice: Number(s.salePrice) || 0,
        pricePerSlip: (Number(s.wetSlips) + Number(s.dryRacks)) > 0 
          ? Number(s.salePrice) / (Number(s.wetSlips) + Number(s.dryRacks))
          : null,
      })),
      priceAppreciation,
      annualizedReturn,
      holdingPeriodYears,
    });
  }

  // Sort repeat sales by appreciation
  repeatSales.sort((a, b) => b.priceAppreciation - a.priceAppreciation);

  // Get top brokers
  const brokerResults = await db
    .select({
      brokerage: salesComps.brokerage,
      dealCount: sql<number>`COUNT(*)`,
      totalVolume: sql<number>`SUM(COALESCE(${salesComps.salePrice}, 0))`,
    })
    .from(salesComps)
    .where(whereClause)
    .groupBy(salesComps.brokerage)
    .orderBy(sql`SUM(COALESCE(${salesComps.salePrice}, 0)) DESC`)
    .limit(10);

  const topBrokers = brokerResults
    .filter((r: any) => r.brokerage)
    .map((r: any) => ({
      name: r.brokerage || 'Unknown',
      dealCount: Number(r.dealCount) || 0,
      totalVolume: Number(r.totalVolume) || 0,
      marketShare: (Number(r.totalVolume) / totalMarketVolume) * 100,
    }));

  // Calculate summary statistics
  const totalTransactions = yearlyTrends.reduce((sum, y) => sum + y.transactionCount, 0);
  const totalVolume = yearlyTrends.reduce((sum, y) => sum + y.totalVolume, 0);
  const earliestYear = yearlyTrends.length > 0 ? yearlyTrends[0].year : new Date().getFullYear();
  const latestYear = yearlyTrends.length > 0 ? yearlyTrends[yearlyTrends.length - 1].year : new Date().getFullYear();

  // Calculate CAGR for volume
  let volumeCAGR = 0;
  let avgAnnualGrowth = 0;
  if (yearlyTrends.length >= 2) {
    const firstYearVolume = yearlyTrends[0].totalVolume || 1;
    const lastYearVolume = yearlyTrends[yearlyTrends.length - 1].totalVolume || 1;
    const years = latestYear - earliestYear || 1;
    volumeCAGR = (Math.pow(lastYearVolume / firstYearVolume, 1 / years) - 1) * 100;

    // Calculate average year-over-year growth
    let totalGrowth = 0;
    let growthPeriods = 0;
    for (let i = 1; i < yearlyTrends.length; i++) {
      if (yearlyTrends[i - 1].avgPrice > 0) {
        totalGrowth += ((yearlyTrends[i].avgPrice - yearlyTrends[i - 1].avgPrice) / yearlyTrends[i - 1].avgPrice) * 100;
        growthPeriods++;
      }
    }
    avgAnnualGrowth = growthPeriods > 0 ? totalGrowth / growthPeriods : 0;
  }

  return {
    summary: {
      totalTransactions,
      totalVolume,
      earliestYear,
      latestYear,
      avgAnnualGrowth,
      volumeCAGR,
    },
    yearlyTrends,
    quarterlyTrends,
    regionalBreakdown,
    repeatSales: repeatSales.slice(0, 20), // Top 20 repeat sales
    topBrokers,
  };
}

export async function generateTrendsInsights(
  trendsData: MarketTrendsData
): Promise<string[]> {
  const insights: string[] = [];
  const { summary, yearlyTrends, regionalBreakdown, repeatSales } = trendsData;

  // Volume insights
  if (summary.totalTransactions > 0) {
    insights.push(
      `The marina market has recorded ${summary.totalTransactions.toLocaleString()} transactions totaling $${(summary.totalVolume / 1000000000).toFixed(2)}B in transaction volume from ${summary.earliestYear} to ${summary.latestYear}.`
    );
  }

  // Growth trends
  if (summary.volumeCAGR !== 0) {
    const direction = summary.volumeCAGR > 0 ? 'grown' : 'contracted';
    insights.push(
      `Transaction volume has ${direction} at a compound annual rate of ${Math.abs(summary.volumeCAGR).toFixed(1)}%.`
    );
  }

  if (summary.avgAnnualGrowth !== 0) {
    const direction = summary.avgAnnualGrowth > 0 ? 'increased' : 'decreased';
    insights.push(
      `Average sale prices have ${direction} by approximately ${Math.abs(summary.avgAnnualGrowth).toFixed(1)}% annually.`
    );
  }

  // Peak year analysis
  if (yearlyTrends.length > 0) {
    const peakVolumeYear = yearlyTrends.reduce((max, y) => y.transactionCount > max.transactionCount ? y : max);
    const peakPriceYear = yearlyTrends.reduce((max, y) => y.avgPrice > max.avgPrice ? y : max);
    
    insights.push(
      `${peakVolumeYear.year} was the most active year with ${peakVolumeYear.transactionCount} transactions.`
    );
    
    if (peakPriceYear.year !== peakVolumeYear.year) {
      insights.push(
        `${peakPriceYear.year} saw the highest average prices at $${(peakPriceYear.avgPrice / 1000000).toFixed(2)}M.`
      );
    }
  }

  // Regional insights
  if (regionalBreakdown.length > 0) {
    const topRegion = regionalBreakdown[0];
    insights.push(
      `${topRegion.region} leads the market with ${topRegion.marketShare.toFixed(1)}% of total transaction volume (${topRegion.transactionCount} deals).`
    );
  }

  // Repeat sales insights
  if (repeatSales.length > 0) {
    const avgAppreciation = repeatSales.reduce((sum, r) => sum + r.priceAppreciation, 0) / repeatSales.length;
    const avgHoldPeriod = repeatSales.reduce((sum, r) => sum + r.holdingPeriodYears, 0) / repeatSales.length;
    
    insights.push(
      `Across ${repeatSales.length} repeat sales, properties have appreciated an average of ${avgAppreciation.toFixed(1)}% over ${avgHoldPeriod.toFixed(1)} year average holding periods.`
    );
  }

  return insights;
}
