import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, TrendingUp, Layers, MapPin, PieChart, Table2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import RcAnalyticsFiltersPanel, { type RcAnalyticsFilters } from "./RcAnalyticsFilters";
import RcStatisticsPanel from "./RcStatisticsPanel";
import RcMatchedRatesView from "./RcMatchedRatesView";
import RcRegionalView from "./RcRegionalView";
import RcStorageTypeView from "./RcStorageTypeView";
import RcDistributionView from "./RcDistributionView";

interface RateStats {
  count: number;
  avgRatePerFt: number;
  medianRatePerFt: number;
  minRatePerFt: number;
  maxRatePerFt: number;
  avgMonthlyRate: number;
  medianMonthlyRate: number;
  avgLoaSize: number;
  uniqueMarinas: number;
}

interface RegionalData {
  state: string;
  avgRatePerFt: number;
  medianRatePerFt: number;
  count: number;
}

interface StorageTypeData {
  storageType: string;
  avgRatePerFt: number;
  medianRatePerFt: number;
  count: number;
  avgMonthlyRate: number;
}

interface DistributionData {
  rateRanges: Array<{ range: string; count: number; avgRate: number }>;
  loaRanges: Array<{ range: string; count: number; avgRate: number }>;
  seasonalityBreakdown: Array<{ seasonality: string; count: number; avgRate: number }>;
}

interface RcAnalyticsResponse {
  stats: RateStats;
  byState: RegionalData[];
  byStorageType: StorageTypeData[];
  distribution: DistributionData;
}

const STORAGE_KEY = 'ratecomps-analytics-filters';

function hasValidFilters(filters: RcAnalyticsFilters): boolean {
  return Object.entries(filters).some(([_, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null;
  });
}

export default function RcAnalyticsWorkbench() {
  const { toast } = useToast();
  
  const [filters, setFilters] = useState<RcAnalyticsFilters>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
      return {};
    } catch {
      return {};
    }
  });
  
  const [appliedFilters, setAppliedFilters] = useState<RcAnalyticsFilters>({});
  const [activeView, setActiveView] = useState("matched");
  
  useEffect(() => {
    if (hasValidFilters(filters)) {
      setAppliedFilters(filters);
    }
  }, []);

  const { data: columnValues } = useQuery({
    queryKey: ['rc-analytics-column-values'],
    queryFn: async () => {
      const [statesRes, storageTypesRes] = await Promise.all([
        fetch('/api/rate-comps/column-values/state').then(r => r.json()),
        fetch('/api/rate-comps/column-values/storageType').then(r => r.json()),
      ]);
      return {
        states: statesRes.values || [],
        storageTypes: storageTypesRes.values || [],
        ratePeriods: ['daily', 'weekly', 'monthly', 'seasonal', 'annual'],
        seasonalities: ['annual', 'peak', 'off_peak', 'shoulder'],
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: analyticsData, isLoading, error } = useQuery<RcAnalyticsResponse>({
    queryKey: ['rc-analytics', appliedFilters],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/rate-comps/analytics', appliedFilters);
      return res.json();
    },
    enabled: hasValidFilters(appliedFilters),
  });

  useEffect(() => {
    if (Object.keys(filters).length === 0) {
      setAppliedFilters({});
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [filters]);

  const handleFiltersChange = (newFilters: RcAnalyticsFilters) => {
    setFilters(newFilters);
    setAppliedFilters(newFilters);
    try {
      if (Object.keys(newFilters).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newFilters));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save filters to localStorage:', error);
    }
  };

  const handleExportCSV = () => {
    if (!analyticsData?.stats) {
      toast({
        title: "No data to export",
        description: "Please run an analysis first",
        variant: "destructive",
      });
      return;
    }

    const csvData = [];
    const headers = ['Metric', 'Value'];
    csvData.push(headers.join(','));

    const { stats } = analyticsData;
    csvData.push(`Rate Records,${stats.count}`);
    csvData.push(`Unique Marinas,${stats.uniqueMarinas}`);
    csvData.push(`Average Rate/Ft/Mo,$${stats.avgRatePerFt.toFixed(2)}`);
    csvData.push(`Median Rate/Ft/Mo,$${stats.medianRatePerFt.toFixed(2)}`);
    csvData.push(`Min Rate/Ft/Mo,$${stats.minRatePerFt.toFixed(2)}`);
    csvData.push(`Max Rate/Ft/Mo,$${stats.maxRatePerFt.toFixed(2)}`);
    csvData.push(`Average Monthly Rate,$${Math.round(stats.avgMonthlyRate)}`);
    csvData.push(`Median Monthly Rate,$${Math.round(stats.medianMonthlyRate)}`);
    csvData.push(`Average LOA,${Math.round(stats.avgLoaSize)} ft`);

    if (analyticsData.byState?.length) {
      csvData.push('');
      csvData.push('State,Avg Rate/Ft,Median Rate/Ft,Count');
      analyticsData.byState.forEach(item => {
        csvData.push(`${item.state},$${item.avgRatePerFt.toFixed(2)},$${item.medianRatePerFt.toFixed(2)},${item.count}`);
      });
    }

    if (analyticsData.byStorageType?.length) {
      csvData.push('');
      csvData.push('Storage Type,Avg Rate/Ft,Median Rate/Ft,Avg Monthly,Count');
      analyticsData.byStorageType.forEach(item => {
        csvData.push(`${item.storageType},$${item.avgRatePerFt.toFixed(2)},$${item.medianRatePerFt.toFixed(2)},$${Math.round(item.avgMonthlyRate)},${item.count}`);
      });
    }

    const blob = new Blob([csvData.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Rate analytics data exported to CSV",
    });
  };

  const stats = analyticsData?.stats;

  return (
    <div className="flex flex-col lg:flex-row gap-3 px-6 pb-6 pt-0">
      {/* Filters Sidebar */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <RcAnalyticsFiltersPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          availableStates={columnValues?.states || []}
          availableStorageTypes={columnValues?.storageTypes || []}
          availableRatePeriods={columnValues?.ratePeriods || []}
          availableSeasonalities={columnValues?.seasonalities || []}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <div className="space-y-1.5">
          {/* Header */}
          <div className="flex items-center justify-between mb-0">
            <div>
              <h2 className="text-lg font-bold text-foreground">Rate Analytics</h2>
              <p className="text-xs text-muted-foreground">
                Comprehensive rate analysis for marina slip and storage pricing
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExportCSV}
                variant="outline"
                size="sm"
                disabled={!stats || isLoading}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Statistics Overview */}
          {stats && (
            <RcStatisticsPanel stats={stats} isLoading={isLoading} />
          )}

          {/* Analysis Views */}
          <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="matched" className="flex items-center gap-2" data-testid="tab-matched">
                <Table2 className="h-4 w-4" />
                <span className="hidden lg:inline">Matched</span>
              </TabsTrigger>
              <TabsTrigger value="regional" className="flex items-center gap-2" data-testid="tab-regional">
                <MapPin className="h-4 w-4" />
                <span className="hidden lg:inline">Regional</span>
              </TabsTrigger>
              <TabsTrigger value="storage" className="flex items-center gap-2" data-testid="tab-storage">
                <Layers className="h-4 w-4" />
                <span className="hidden lg:inline">Storage Type</span>
              </TabsTrigger>
              <TabsTrigger value="distribution" className="flex items-center gap-2" data-testid="tab-distribution">
                <PieChart className="h-4 w-4" />
                <span className="hidden lg:inline">Distribution</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matched" className="mt-2" data-testid="tab-content-matched">
              <RcMatchedRatesView
                filters={appliedFilters}
                isLoading={isLoading}
              />
            </TabsContent>

            <TabsContent value="regional" className="mt-2" data-testid="tab-content-regional">
              {analyticsData?.byState ? (
                <RcRegionalView
                  data={analyticsData.byState}
                  isLoading={isLoading}
                />
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Apply filters to view regional comparison</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="storage" className="mt-2" data-testid="tab-content-storage">
              {analyticsData?.byStorageType ? (
                <RcStorageTypeView
                  data={analyticsData.byStorageType}
                  isLoading={isLoading}
                />
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Apply filters to view storage type analysis</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="distribution" className="mt-2" data-testid="tab-content-distribution">
              {analyticsData?.distribution ? (
                <RcDistributionView
                  data={analyticsData.distribution}
                  isLoading={isLoading}
                />
              ) : (
                <Card className="p-4 text-center border-dashed">
                  <PieChart className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground">Apply filters to view distribution analysis</p>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
