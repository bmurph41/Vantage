import { useState, lazy, Suspense } from "react";
import TopBar from "@/components/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

// Lazy load analytics components for better performance
const AnalyticsOverview = lazy(() => import("@/components/analytics/analytics-overview"));
const RevenueTrendChart = lazy(() => import("@/components/analytics/revenue-trend-chart"));
const PipelinePerformanceChart = lazy(() => import("@/components/analytics/pipeline-performance-chart"));
const TopPerformers = lazy(() => import("@/components/analytics/top-performers"));
const UnifiedAnalyticsPanel = lazy(() => import("@/components/analytics/unified-analytics-panel"));

// Loading component for lazy-loaded components
const ComponentLoader = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse ${className}`}>
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </CardContent>
    </Card>
  </div>
);

export default function Analytics() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  });
  const [isExporting, setIsExporting] = useState(false);

  // Fetch insights data
  const { data: insights } = useQuery({
    queryKey: ['/api/analytics/insights', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/analytics/insights?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics insights: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  // Keyboard navigation handler
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Skip navigation if user is typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (event.key) {
      case 'e':
      case 'E':
        if (!isExporting) {
          event.preventDefault();
          handleExport();
        }
        break;
      case 'Escape':
        // Close any open popovers/modals
        event.preventDefault();
        break;
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/analytics/export?${params}`);
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: "Analytics data has been exported to CSV file.",
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export analytics data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
        <TopBar title="Analytics" subtitle="Insights and performance metrics" />
        
        <main 
          className="flex-1 overflow-y-auto p-4 sm:p-6" 
          data-testid="analytics-main"
          role="main"
          aria-label="Analytics Dashboard"
        >
          {/* Header with filters */}
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">Analytics Dashboard</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                Track your sales performance and key metrics
                <span className="hidden sm:inline text-xs text-gray-500 ml-2">
                  • Press 'E' to export data
                </span>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {/* Date Range Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[280px] justify-start text-left font-normal text-sm",
                      !dateRange.from && "text-muted-foreground"
                    )}
                    aria-label={`Date range filter: ${
                      dateRange.from 
                        ? dateRange.to 
                          ? `${format(dateRange.from, "LLL dd, y")} to ${format(dateRange.to, "LLL dd, y")}`
                          : format(dateRange.from, "LLL dd, y")
                        : "No date range selected"
                    }`}
                    aria-haspopup="dialog"
                    aria-expanded="false"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={{
                      from: dateRange.from,
                      to: dateRange.to,
                    }}
                    onSelect={(range) => {
                      // Validate date range on frontend
                      if (range?.from && range?.to) {
                        // Check if start date is after end date
                        if (range.from > range.to) {
                          toast({
                            title: "Invalid date range",
                            description: "Start date cannot be after end date.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        // Check if dates are in the future
                        const now = new Date();
                        if (range.from > now || range.to > now) {
                          toast({
                            title: "Invalid date range",
                            description: "Dates cannot be in the future.",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        // Check if range exceeds 2 years
                        const maxRange = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
                        if (range.to.getTime() - range.from.getTime() > maxRange) {
                          toast({
                            title: "Date range too large",
                            description: "Date range cannot exceed 2 years.",
                            variant: "destructive",
                          });
                          return;
                        }
                      }
                      
                      setDateRange({
                        from: range?.from,
                        to: range?.to,
                      });
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>

              {/* Export Button */}
              <Button 
                onClick={handleExport} 
                variant="outline" 
                disabled={isExporting} 
                className="w-full sm:w-auto text-sm"
                aria-label={isExporting ? "Exporting analytics data, please wait" : "Export analytics data to CSV"}
              >
                <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                {isExporting ? "Exporting..." : "Export"}
              </Button>
            </div>
          </div>

          {/* Cross-Module Analytics */}
          <section className="mb-6 sm:mb-8" aria-labelledby="unified-heading">
            <h2 id="unified-heading" className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Cross-Module Analytics</h2>
            <Suspense fallback={<ComponentLoader />}>
              <UnifiedAnalyticsPanel />
            </Suspense>
          </section>

          {/* Overview Metrics */}
          <section className="mb-6 sm:mb-8" aria-labelledby="overview-heading">
            <h2 id="overview-heading" className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Pipeline Overview</h2>
            <Suspense fallback={<ComponentLoader />}>
              <AnalyticsOverview dateRange={dateRange} />
            </Suspense>
          </section>

          {/* Charts Section */}
          <section className="mb-6 sm:mb-8" aria-labelledby="charts-heading">
            <h2 id="charts-heading" className="sr-only">Performance Charts</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              <Suspense fallback={<ComponentLoader />}>
                <RevenueTrendChart dateRange={dateRange} />
              </Suspense>
              <Suspense fallback={<ComponentLoader />}>
                <PipelinePerformanceChart dateRange={dateRange} />
              </Suspense>
            </div>
          </section>

          {/* Top Performers */}
          <section className="mb-6 sm:mb-8" aria-labelledby="performers-heading">
            <h2 id="performers-heading" className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Top Performers</h2>
            <Suspense fallback={<ComponentLoader />}>
              <TopPerformers dateRange={dateRange} />
            </Suspense>
          </section>

          {/* Additional Insights */}
          <section aria-labelledby="insights-heading">
            <h2 id="insights-heading" className="sr-only">Additional Insights</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Insights</CardTitle>
              </CardHeader>
              <CardContent>
                {!insights ? (
                  <div className="space-y-3 animate-pulse">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex justify-between">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg. Deal Cycle</span>
                      <span className="font-medium">{insights?.avgDealCycle || 0} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Best Performing Stage</span>
                      <span className="font-medium">{insights?.bestPerformingStage || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Peak Activity Day</span>
                      <span className="font-medium">{insights?.peakActivityDay || "N/A"}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Goals & Targets</CardTitle>
              </CardHeader>
              <CardContent>
                {!insights ? (
                  <div className="space-y-4 animate-pulse">
                    {[...Array(2)].map((_, i) => (
                      <div key={i}>
                        <div className="flex justify-between mb-2">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                          <div className="h-4 bg-gray-200 rounded w-8"></div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600">Monthly Revenue</span>
                        <span className="font-medium">{insights?.monthlyRevenueProgress || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${insights?.monthlyRevenueProgress || 0}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-600">New Contacts</span>
                        <span className="font-medium">{insights?.newContactsProgress || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${insights?.newContactsProgress || 0}%` }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Trends</CardTitle>
              </CardHeader>
              <CardContent>
                {!insights ? (
                  <div className="space-y-3 animate-pulse">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex justify-between">
                        <div className="h-4 bg-gray-200 rounded w-28"></div>
                        <div className="h-4 bg-gray-200 rounded w-12"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Deal Velocity</span>
                      <span className={`font-medium ${insights?.trends?.dealVelocity?.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {insights?.trends?.dealVelocity?.startsWith('+') ? '↑' : '↓'} {insights?.trends?.dealVelocity || '0%'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Contact Engagement</span>
                      <span className={`font-medium ${insights?.trends?.contactEngagement?.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {insights?.trends?.contactEngagement?.startsWith('+') ? '↑' : '↓'} {insights?.trends?.contactEngagement || '0%'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Pipeline Value</span>
                      <span className={`font-medium ${insights?.trends?.pipelineValue?.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                        {insights?.trends?.pipelineValue?.startsWith('+') ? '↑' : '↓'} {insights?.trends?.pipelineValue || '0%'}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </section>
        </main>
    </div>
  );
}
