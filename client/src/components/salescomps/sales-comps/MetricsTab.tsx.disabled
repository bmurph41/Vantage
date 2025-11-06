import { useState, useMemo } from "react";
import { TrendingUp, AlertTriangle, Info, BarChart3, DollarSign, Target, Calendar, MapPin } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard, MetricsGrid } from "@/components/metrics";
import { useMetricSnapshot, useAvailableMetrics } from "@/lib/marketApi";
import { useAnalyticsData } from '@/hooks/salescomps/useAnalyticsData';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/salescomps/format';
import type { FilterState } from '@/lib/salescomps/types';
import type { TimeRange } from "@/components/metrics/TimeRangeSelector";

interface MetricsTabProps {
  /**
   * Current sales comp filters to derive context from
   */
  filters: FilterState;
  /**
   * Total count of sales comps matching current filters
   */
  compsCount: number;
  /**
   * Custom class name
   */
  className?: string;
  /**
   * Data test id for accessibility
   */
  'data-testid'?: string;
}

/**
 * Context-aware metric categories based on sales comp filters
 */
interface MetricContext {
  category: string;
  relevanceScore: number;
  reason: string;
  metrics: string[];
}

/**
 * Smart filtering logic to map sales comp filters to relevant metric categories
 */
function deriveMetricContext(filters: FilterState, compsCount: number): MetricContext[] {
  const contexts: MetricContext[] = [];
  
  // Base macro indicators - always relevant for real estate analysis
  contexts.push({
    category: "macro",
    relevanceScore: 0.8,
    reason: "Macro economic indicators affect real estate markets",
    metrics: ["cpi_yoy", "unemployment", "pce"]
  });

  // Interest rates - always relevant for cap rate analysis
  let ratesRelevance = 0.7;
  let ratesReason = "Interest rates affect capitalization rates and property valuation";
  
  // Higher relevance if cap rate filters are active
  if (filters.capRateMin || filters.capRateMax) {
    ratesRelevance = 0.95;
    ratesReason = "Cap rate filters active - interest rates directly impact valuation";
  }
  
  // Higher relevance if price filters suggest higher-value properties
  if (filters.priceMin || filters.priceMax) {
    const minPrice = parseFloat(filters.priceMin.replace(/[^\d.-]/g, '')) || 0;
    const maxPrice = parseFloat(filters.priceMax.replace(/[^\d.-]/g, '')) || 0;
    if (minPrice > 1000000 || maxPrice > 5000000) {
      ratesRelevance = Math.min(0.95, ratesRelevance + 0.15);
      ratesReason += " - High-value properties more sensitive to rate changes";
    }
  }
  
  contexts.push({
    category: "rates",
    relevanceScore: ratesRelevance,
    reason: ratesReason,
    metrics: ["sofr", "fed_funds", "ust_10y"]
  });

  // Fuel prices - relevant for marina operations and boating costs
  let fuelRelevance = 0.6;
  let fuelReason = "Fuel costs impact marina operations and boating activity";
  
  // Higher relevance if marina features are specified (suggests operational focus)
  if (filters.wetSlipsMin || filters.wetSlipsMax || filters.dryRacksMin || filters.dryRacksMax) {
    fuelRelevance = 0.85;
    fuelReason = "Marina capacity filters active - fuel costs critical for operational analysis";
  }
  
  // Higher relevance for certain states with heavy marine activity
  const marineFocusedStates = ['FL', 'CA', 'TX', 'NY', 'MD', 'VA', 'NC', 'SC'];
  if (filters.state && marineFocusedStates.includes(filters.state)) {
    fuelRelevance = Math.min(0.9, fuelRelevance + 0.15);
    fuelReason += ` - ${filters.state} has significant marine activity`;
  }
  
  contexts.push({
    category: "fuel",
    relevanceScore: fuelRelevance,
    reason: fuelReason,
    metrics: ["gasoline_regular", "diesel", "heating_oil"]
  });

  // Internal/derived metrics - Marina-specific calculations
  if (compsCount > 0) {
    contexts.push({
      category: "internal",
      relevanceScore: 0.9,
      reason: `Based on ${compsCount} matching sales comps in your dataset`,
      metrics: ["median_cap_rate", "median_sale_price", "cap_rate_by_state", "sale_price_trends"]
    });
  }

  // Sort by relevance score (highest first)
  return contexts.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Sales Comps Analytics Summary Component
 */
function SalesCompsAnalytics({ 
  filters,
  compsCount,
  'data-testid': testId = "sales-analytics"
}: { 
  filters: FilterState;
  compsCount: number;
  'data-testid'?: string;
}) {
  const analytics = useAnalyticsData(filters);
  
  if (analytics.loading) {
    return (
      <div className="space-y-4" data-testid={`${testId}-loading`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (analytics.error) {
    return (
      <Alert variant="destructive" data-testid={`${testId}-error`}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load sales comps analytics: {analytics.error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const { 
    kpis, 
    timeSeries, 
    quarterlyTimeSeries,
    monthlyTimeSeries,
    groupByState, 
    groupByRegion,
    priceTranches,
    ownershipAnalysis,
    priceQuantiles, 
    capRateQuantiles 
  } = analytics;

  return (
    <div className="space-y-6" data-testid={testId}>
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid={`${testId}-kpi-volume`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Total Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis.totalVolume)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.disclosedPrices} disclosed prices
            </p>
          </CardContent>
        </Card>

        <Card data-testid={`${testId}-kpi-avg-price`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Avg Sale Price
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis.avgSalePrice)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Median: {formatCurrency(kpis.medianSalePrice)}
            </p>
          </CardContent>
        </Card>

        <Card data-testid={`${testId}-kpi-cap-rate`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Avg Cap Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercent(kpis.avgCapRate)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Median: {formatPercent(kpis.medianCapRate)}
            </p>
          </CardContent>
        </Card>

        <Card data-testid={`${testId}-kpi-total-comps`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              Total Comps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(kpis.totalComps)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.disclosedNOI} disclosed NOI
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Market Insights */}
      {(timeSeries.length > 0 || groupByState.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time Series Insights */}
          {timeSeries.length > 0 && (
            <Card data-testid={`${testId}-time-insights`}>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {timeSeries.slice(-3).map((data) => (
                    <div key={data.year} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{data.year}</span>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {formatNumber(data.count)} sales
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Avg: {formatCurrency(data.avgPrice)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* State Distribution */}
          {groupByState.length > 0 && (
            <Card data-testid={`${testId}-state-insights`}>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  Top Markets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {groupByState.slice(0, 5).map((data) => (
                    <div key={data.state} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{data.state || 'Unknown'}</span>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {formatNumber(data.count)} sales
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Avg: {formatCurrency(data.avgPrice)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Price Distribution Insights */}
      {(priceQuantiles.median || capRateQuantiles.median) && (
        <Card data-testid={`${testId}-distribution-insights`}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Market Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {priceQuantiles.median && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Sale Price Quartiles</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">25th percentile</span>
                      <span className="font-medium">{formatCurrency(priceQuantiles.q1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Median</span>
                      <span className="font-medium">{formatCurrency(priceQuantiles.median)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">75th percentile</span>
                      <span className="font-medium">{formatCurrency(priceQuantiles.q3)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {capRateQuantiles.median && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Cap Rate Quartiles</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">25th percentile</span>
                      <span className="font-medium">{formatPercent(capRateQuantiles.q1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Median</span>
                      <span className="font-medium">{formatPercent(capRateQuantiles.median)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">75th percentile</span>
                      <span className="font-medium">{formatPercent(capRateQuantiles.q3)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regional Analysis */}
      {groupByRegion.length > 0 && (
        <Card data-testid={`${testId}-regional-analysis`}>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              Regional Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupByRegion.map((region) => (
                <div key={region.region} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{region.region}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {formatNumber(region.count)} sales
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Price</span>
                      <span className="font-medium">{formatCurrency(region.avgPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Median Price</span>
                      <span className="font-medium">{formatCurrency(region.medianPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Volume</span>
                      <span className="font-medium">{formatCurrency(region.totalVolume)}</span>
                    </div>
                    {region.avgCapRate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Cap Rate</span>
                        <span className="font-medium">{formatPercent(region.avgCapRate)}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      States: {region.states.join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Property Size Tranches */}
      {priceTranches.length > 0 && (
        <Card data-testid={`${testId}-price-tranches`}>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              Property Size Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {priceTranches.map((tranche) => (
                <div key={tranche.tranche} className="border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">{tranche.tranche}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {formatNumber(tranche.count)} sales
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {tranche.percentOfTotal.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block">Total Volume</span>
                      <span className="font-medium">{formatCurrency(tranche.totalVolume)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Avg Price</span>
                      <span className="font-medium">{formatCurrency(tranche.avgPrice)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Median Price</span>
                      <span className="font-medium">{formatCurrency(tranche.medianPrice)}</span>
                    </div>
                    {tranche.avgCapRate && (
                      <div>
                        <span className="text-muted-foreground block">Avg Cap Rate</span>
                        <span className="font-medium">{formatPercent(tranche.avgCapRate)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ownership Analysis */}
      {ownershipAnalysis.topOwners.length > 0 && (
        <Card data-testid={`${testId}-ownership-analysis`}>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Ownership Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {formatNumber(ownershipAnalysis.uniqueOwners)}
                  </div>
                  <div className="text-xs text-muted-foreground">Unique Owners</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-accent">
                    {formatNumber(ownershipAnalysis.multipleOwnershipCount)}
                  </div>
                  <div className="text-xs text-muted-foreground">Multi-Property Owners</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {ownershipAnalysis.topOwners.length > 0 ? 
                      formatNumber(Math.max(...ownershipAnalysis.topOwners.map(o => o.count))) : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Max Properties</div>
                </div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Top Multi-Property Owners</h4>
                {ownershipAnalysis.topOwners.slice(0, 10).map((owner, index) => (
                  <div key={owner.owner} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-sm truncate max-w-xs" title={owner.owner}>
                        #{index + 1}. {owner.owner}
                      </h5>
                      <Badge variant="secondary" className="text-xs">
                        {formatNumber(owner.count)} properties
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Total Volume</span>
                        <span className="font-medium">{formatCurrency(owner.totalVolume)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Avg Price</span>
                        <span className="font-medium">{formatCurrency(owner.avgPrice)}</span>
                      </div>
                      {owner.avgCapRate && (
                        <div>
                          <span className="text-muted-foreground block">Avg Cap Rate</span>
                          <span className="font-medium">{formatPercent(owner.avgCapRate)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Properties: {owner.properties.slice(0, 3).join(', ')}
                        {owner.properties.length > 3 && ` + ${owner.properties.length - 3} more`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Time Series Analysis */}
      {(quarterlyTimeSeries.length > 0 || monthlyTimeSeries.length > 0) && (
        <Card data-testid={`${testId}-enhanced-time-series`}>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600" />
              Detailed Time Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quarterly Analysis */}
              {quarterlyTimeSeries.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-3">Quarterly Sales Activity</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {quarterlyTimeSeries.slice(-8).map((quarter) => (
                      <div key={quarter.quarterLabel} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="text-sm font-medium">{quarter.quarterLabel}</span>
                        <div className="text-right">
                          <div className="text-sm font-semibold">
                            {formatNumber(quarter.count)} sales
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Avg: {formatCurrency(quarter.avgPrice)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly Analysis */}
              {monthlyTimeSeries.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-3">Monthly Sales Activity</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {monthlyTimeSeries.slice(-12).map((month) => (
                      <div key={month.monthLabel} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="text-sm font-medium">{month.monthLabel}</span>
                        <div className="text-right">
                          <div className="text-sm font-semibold">
                            {formatNumber(month.count)} sales
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Avg: {formatCurrency(month.avgPrice)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Convert sales comp filters to appropriate metric time range
 */
function deriveTimeRange(filters: FilterState): TimeRange {
  const hasYearFilters = filters.saleYearMin || filters.saleYearMax;
  
  if (hasYearFilters) {
    const minYear = parseInt(filters.saleYearMin) || 2020;
    const maxYear = parseInt(filters.saleYearMax) || new Date().getFullYear();
    
    return {
      type: "absolute",
      start: new Date(minYear, 0, 1),
      end: new Date(maxYear, 11, 31)
    };
  }
  
  // Default to last 12 months if no year filters
  return {
    type: "relative", 
    relative: "1y"
  };
}

export default function MetricsTab({ 
  filters, 
  compsCount, 
  className, 
  'data-testid': testId = "metrics-tab" 
}: MetricsTabProps) {
  const [selectedContext, setSelectedContext] = useState<string>("all");

  // Derive context-aware metrics based on filters
  const metricContexts = useMemo(() => deriveMetricContext(filters, compsCount), [filters, compsCount]);
  
  // Derive appropriate time range from filters
  const timeRange = useMemo(() => deriveTimeRange(filters), [filters]);
  
  // Get all relevant metric keys
  const allRelevantMetrics = useMemo(() => {
    return metricContexts.flatMap(context => context.metrics);
  }, [metricContexts]);

  // Fetch available metrics to validate our selections
  const availableMetricsQuery = useAvailableMetrics();
  
  // Fetch metric snapshot for overview
  const snapshotFilters = useMemo(() => ({
    categories: metricContexts.map(c => c.category),
    timeRange: timeRange
  }), [metricContexts, timeRange]);
  
  const snapshotQuery = useMetricSnapshot(snapshotFilters);

  // Filter contexts based on selection
  const filteredContexts = useMemo(() => {
    if (selectedContext === "all") return metricContexts;
    return metricContexts.filter(context => context.category === selectedContext);
  }, [metricContexts, selectedContext]);

  // Get metrics to display
  const metricsToDisplay = useMemo(() => {
    return filteredContexts.flatMap(context => context.metrics);
  }, [filteredContexts]);

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'q') return false; // Search is handled separately
      return value !== "" && value !== false;
    });
  }, [filters]);

  if (availableMetricsQuery.isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid={`${testId}-loading`}>
        <div className="space-y-4">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (availableMetricsQuery.error) {
    return (
      <div className="p-6" data-testid={`${testId}-error`}>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load available metrics. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-8 ${className}`} data-testid={testId}>
      {/* Sales Comps Analytics Section */}
      {compsCount > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Sales Comps Analytics</h3>
            <Badge variant="secondary" data-testid={`${testId}-comps-count`}>
              {compsCount} comps
            </Badge>
          </div>
          
          <SalesCompsAnalytics 
            filters={filters}
            compsCount={compsCount}
            data-testid={`${testId}-sales-analytics`}
          />
        </div>
      )}

      {/* Economic Context Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Economic Context</h3>
        </div>
        
        {hasActiveFilters && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription data-testid={`${testId}-context-description`}>
              Economic metrics relevant to your marina market analysis. 
              {metricContexts.length > 0 && ` Found ${metricContexts.length} relevant categories.`}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Metric Context Filter */}
      {metricContexts.length > 1 && (
        <div className="flex flex-wrap gap-2" data-testid={`${testId}-context-filters`}>
          <button
            onClick={() => setSelectedContext("all")}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              selectedContext === "all" 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-background border-border hover:bg-muted"
            }`}
            data-testid={`${testId}-filter-all`}
          >
            All Categories ({metricContexts.length})
          </button>
          {metricContexts.map((context) => (
            <button
              key={context.category}
              onClick={() => setSelectedContext(context.category)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                selectedContext === context.category 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-background border-border hover:bg-muted"
              }`}
              data-testid={`${testId}-filter-${context.category}`}
            >
              {context.category.charAt(0).toUpperCase() + context.category.slice(1)}
              <Badge 
                variant="outline" 
                className="ml-2 text-xs"
              >
                {Math.round(context.relevanceScore * 100)}%
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Context Reasoning */}
      {filteredContexts.length > 0 && (
        <div className="space-y-2" data-testid={`${testId}-context-reasoning`}>
          {filteredContexts.map((context) => (
            <div key={context.category} className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {context.category.charAt(0).toUpperCase() + context.category.slice(1)}:
              </strong>{" "}
              {context.reason}
            </div>
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      {metricsToDisplay.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid={`${testId}-metrics-grid`}>
          {metricsToDisplay.map((metricKey) => (
            <MetricCard
              key={metricKey}
              metricKey={metricKey}
              compact={true}
              initialTimeRange={timeRange}
              showTimeRangeSelector={false}
              showActions={false}
              data-testid={`${testId}-metric-${metricKey}`}
            />
          ))}
        </div>
      ) : (
        // Empty state
        <div className="text-center py-12" data-testid={`${testId}-empty`}>
          <div className="text-muted-foreground mb-2">
            <TrendingUp className="h-8 w-8 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No Relevant Metrics Found
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {hasActiveFilters 
              ? "Try adjusting your sales comp filters to see relevant market metrics."
              : "Apply some filters to your sales comps to see relevant market context."
            }
          </p>
        </div>
      )}

      {/* Additional Insights */}
      {snapshotQuery.data && (
        <div className="pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Last updated: {new Date(snapshotQuery.data.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}