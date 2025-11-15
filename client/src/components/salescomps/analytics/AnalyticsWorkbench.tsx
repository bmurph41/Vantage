import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, BarChart3, TrendingUp, Layers, Lightbulb, MapPin, PieChart, ScatterChart, Calculator, Table2, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AnalyticsFiltersPanel, { type AnalyticsFilters } from "./AnalyticsFilters";
import StatisticsPanel from "./StatisticsPanel";
import TimeSeriesView from "./TimeSeriesView";
import RegionalComparisonView from "./RegionalComparisonView";
import CohortAnalysisView from "./CohortAnalysisView";
import InsightsPanel from "./InsightsPanel";
import DistributionAnalysisView from "./DistributionAnalysisView";
import CorrelationAnalysisView from "./CorrelationAnalysisView";
import ValuationModelsView from "./ValuationModelsView";

interface ComparativeAnalysis {
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
  byState?: Record<string, any[]>;
  byYear?: Record<string, any[]>;
  byWaterType?: Record<string, any[]>;
  byPriceRange?: Record<string, any[]>;
  trends?: {
    priceOverTime: Array<{ year: number; avgPrice: number; count: number }>;
    capRateOverTime: Array<{ year: number; avgCapRate: number; count: number }>;
  };
}

interface AnalyticsResponse {
  metrics: ComparativeAnalysis;
  insights: string[];
}

export default function AnalyticsWorkbench() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [appliedFilters, setAppliedFilters] = useState<AnalyticsFilters>({});
  const [activeView, setActiveView] = useState("overview");

  const { data: columnValues } = useQuery({
    queryKey: ['analytics-column-values'],
    queryFn: async () => {
      const [statesRes, waterTypesRes, profitCentersRes] = await Promise.all([
        fetch('/api/sales-comps/column-values/state').then(r => r.json()),
        fetch('/api/sales-comps/column-values/waterType').then(r => r.json()),
        fetch('/api/sales-comps/column-values/profitCenters').then(r => r.json()),
      ]);
      return {
        states: statesRes.values || [],
        waterTypes: waterTypesRes.values || [],
        profitCenters: profitCentersRes.values || [],
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: analyticsData, isLoading, refetch } = useQuery<AnalyticsResponse>({
    queryKey: ['analytics', appliedFilters],
    queryFn: async () => {
      const response = await apiRequest('/api/sales-comps/analytics', {
        method: 'POST',
        body: JSON.stringify(appliedFilters),
      });
      return response;
    },
    enabled: Object.keys(appliedFilters).length > 0 || true,
  });

  useEffect(() => {
    if (Object.keys(filters).length === 0) {
      setAppliedFilters({});
    }
  }, [filters]);

  const handleFiltersChange = (newFilters: AnalyticsFilters) => {
    setFilters(newFilters);
    setAppliedFilters(newFilters);
  };

  const handleExportCSV = () => {
    if (!analyticsData?.metrics) {
      toast({
        title: "No data to export",
        description: "Please run an analysis first",
        variant: "destructive",
      });
      return;
    }

    const csvData = [];
    const headers = ['Metric', 'Value', 'Sample Size'];
    csvData.push(headers.join(','));

    const { overall } = analyticsData.metrics;
    csvData.push(`Count,${overall.count},${overall.count}`);
    csvData.push(`Average Price,$${overall.avgPrice.toFixed(2)},${overall.count}`);
    csvData.push(`Median Price,$${overall.medianPrice.toFixed(2)},${overall.count}`);
    csvData.push(`Average Price Per Slip,$${overall.avgPricePerSlip.toFixed(2)},${overall.count}`);
    csvData.push(`Median Price Per Slip,$${overall.medianPricePerSlip.toFixed(2)},${overall.count}`);
    csvData.push(`Average Cap Rate,${(overall.avgCapRate * 100).toFixed(2)}%,${overall.count}`);
    csvData.push(`Median Cap Rate,${(overall.medianCapRate * 100).toFixed(2)}%,${overall.count}`);
    csvData.push(`Average Capacity,${overall.avgCapacity.toFixed(0)},${overall.count}`);
    csvData.push(`Total Value,$${overall.totalValue.toFixed(2)},${overall.count}`);

    const blob = new Blob([csvData.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marina-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Analytics data exported to CSV",
    });
  };

  const metrics = analyticsData?.metrics;
  const insights = analyticsData?.insights || [];

  return (
    <div className="flex flex-col lg:flex-row gap-3 px-6 pt-0 pb-6">
      {/* Filters Sidebar */}
      <div className="w-full lg:w-80 flex-shrink-0 pt-3">
        <AnalyticsFiltersPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          availableStates={columnValues?.states || []}
          availableWaterTypes={columnValues?.waterTypes || []}
          availableProfitCenters={columnValues?.profitCenters || []}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-3">
        <div className="space-y-1.5">
          {/* Header */}
          <div className="flex items-center justify-between mb-0">
            <div>
              <h2 className="text-lg font-bold text-foreground">Market Analytics</h2>
              <p className="text-xs text-muted-foreground">
                Institutional-grade comparative analysis for marina sales data
              </p>
            </div>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              disabled={!metrics || isLoading}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Statistics Overview */}
          {metrics && (
            <StatisticsPanel stats={metrics.overall} isLoading={isLoading} />
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <InsightsPanel insights={insights} isLoading={isLoading} />
          )}

          {/* Analysis Views */}
          <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 lg:w-auto">
              <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden lg:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="trends" className="flex items-center gap-2" data-testid="tab-trends">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden lg:inline">Trends</span>
              </TabsTrigger>
              <TabsTrigger value="regional" className="flex items-center gap-2" data-testid="tab-regional">
                <MapPin className="h-4 w-4" />
                <span className="hidden lg:inline">Regional</span>
              </TabsTrigger>
              <TabsTrigger value="cohorts" className="flex items-center gap-2" data-testid="tab-cohorts">
                <Layers className="h-4 w-4" />
                <span className="hidden lg:inline">Cohorts</span>
              </TabsTrigger>
              <TabsTrigger value="distribution" className="flex items-center gap-2" data-testid="tab-distribution">
                <PieChart className="h-4 w-4" />
                <span className="hidden lg:inline">Distribution</span>
              </TabsTrigger>
              <TabsTrigger value="correlation" className="flex items-center gap-2" data-testid="tab-correlation">
                <ScatterChart className="h-4 w-4" />
                <span className="hidden lg:inline">Correlation</span>
              </TabsTrigger>
              <TabsTrigger value="valuation" className="flex items-center gap-2" data-testid="tab-valuation">
                <Calculator className="h-4 w-4" />
                <span className="hidden lg:inline">Valuation</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-2 mt-2" data-testid="tab-content-overview">
              {!metrics ? (
                <Card className="p-4 text-center border-dashed">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <h3 className="text-sm font-semibold mb-1">Start Your Analysis</h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Apply filters on the left to generate comprehensive market analytics and insights
                  </p>
                </Card>
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Use the tabs above to view detailed analysis</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="trends" className="mt-2" data-testid="tab-content-trends">
              {metrics?.trends ? (
                <TimeSeriesView
                  priceOverTime={metrics.trends.priceOverTime}
                  capRateOverTime={metrics.trends.capRateOverTime}
                  isLoading={isLoading}
                />
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Apply filters to view time series trends</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="regional" className="mt-2" data-testid="tab-content-regional">
              {metrics ? (
                <RegionalComparisonView
                  byState={metrics.byState}
                  byWaterType={metrics.byWaterType}
                  isLoading={isLoading}
                />
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Apply filters to view regional comparison</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="cohorts" className="mt-2" data-testid="tab-content-cohorts">
              {metrics ? (
                <CohortAnalysisView
                  byPriceRange={metrics.byPriceRange}
                  byYear={metrics.byYear}
                  isLoading={isLoading}
                />
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Apply filters to view cohort analysis</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="distribution" className="mt-2" data-testid="tab-content-distribution">
              {metrics ? (
                <DistributionAnalysisView
                  data={metrics}
                  isLoading={isLoading}
                />
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <PieChart className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Apply filters to view distribution analysis</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="correlation" className="mt-2" data-testid="tab-content-correlation">
              {metrics ? (
                <CorrelationAnalysisView
                  data={metrics}
                  isLoading={isLoading}
                />
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <ScatterChart className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Apply filters to view correlation analysis</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="valuation" className="mt-2" data-testid="tab-content-valuation">
              {metrics ? (
                <ValuationModelsView
                  data={metrics}
                  isLoading={isLoading}
                />
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <Calculator className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Apply filters to view valuation models</p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
