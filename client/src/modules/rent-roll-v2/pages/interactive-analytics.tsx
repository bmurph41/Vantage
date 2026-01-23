import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Anchor,
  Building2,
  RefreshCw,
  Download,
  Users,
  DollarSign,
  Activity
} from "lucide-react";
import {
  DrillDownBarChart,
  TimeSeriesDrillDown,
  HierarchicalPieChart,
  WaterfallChart,
  CHART_COLORS,
} from "@/components/analytics/InteractiveCharts";
import DashboardNav from "../components/navigation/DashboardNav";
import TimePeriodSelector from "../components/rent-roll/TimePeriodSelector";
import type { TimePeriodFilter } from "@shared/timePeriodUtils";
import { calculateDateRange } from "@shared/timePeriodUtils";
import { useProjectContext } from "../contexts/ProjectContext";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface AnalyticsData {
  occupancyTrend: Array<{
    period: string;
    occupancy: number;
    totalSlips: number;
    occupiedSlips: number;
    revenue: number;
    breakdown?: Array<{ name: string; value: number }>;
  }>;
  storageTypeDistribution: Array<{
    name: string;
    value: number;
    children?: Array<{ name: string; value: number }>;
  }>;
  leaseExpirations: Array<{
    name: string;
    value: number;
    isTotal?: boolean;
    details?: Array<{ label: string; value: number }>;
  }>;
  revenueByStorageType: Array<{
    category: string;
    value: number;
    breakdown?: Array<{ name: string; value: number }>;
  }>;
  kpis: {
    currentOccupancy: number;
    occupancyChange: number;
    totalRevenue: number;
    revenueChange: number;
    avgLeaseValue: number;
    leaseValueChange: number;
    expiringNext90Days: number;
    expiringChange: number;
  };
}

export default function RentRollInteractiveAnalytics() {
  const [periodFilter, setPeriodFilter] = useState<TimePeriodFilter>({ type: "ytd" });
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const { projectId: contextProjectId } = useProjectContext();

  const effectiveProject = contextProjectId || selectedProject;
  const isProjectScoped = !!contextProjectId;
  const dateRange = calculateDateRange(periodFilter);

  const { data: analyticsData, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics/rent-roll/interactive-analytics", effectiveProject, JSON.stringify(periodFilter)],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      if (effectiveProject !== "all") {
        params.set("locationId", effectiveProject);
      }
      const response = await fetch(`/api/analytics/rent-roll/interactive-analytics?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  const { data: locations } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/rent-roll/locations"],
  });

  const occupancyChartData = useMemo(() => {
    if (!analyticsData?.occupancyTrend) {
      return generateSampleOccupancyData();
    }
    return analyticsData.occupancyTrend.map(item => ({
      period: item.period,
      value: item.occupancy,
      breakdown: item.breakdown || [
        { name: "Wet Slips", value: Math.round(item.occupancy * 0.6) },
        { name: "Dry Storage", value: Math.round(item.occupancy * 0.25) },
        { name: "Moorings", value: Math.round(item.occupancy * 0.15) },
      ],
    }));
  }, [analyticsData]);

  const storageTypeData = useMemo(() => {
    if (!analyticsData?.storageTypeDistribution) {
      return [
        { name: "Wet Slips", value: 156, children: [
          { name: "Under 30ft", value: 45 },
          { name: "30-50ft", value: 68 },
          { name: "50-80ft", value: 32 },
          { name: "Over 80ft", value: 11 },
        ]},
        { name: "Dry Storage", value: 85, children: [
          { name: "Rack Storage", value: 52 },
          { name: "Forklift", value: 33 },
        ]},
        { name: "Moorings", value: 24, children: [
          { name: "Swing Moorings", value: 16 },
          { name: "Mediterranean", value: 8 },
        ]},
        { name: "Transient", value: 18, children: [
          { name: "Daily", value: 12 },
          { name: "Weekly", value: 6 },
        ]},
      ];
    }
    return analyticsData.storageTypeDistribution;
  }, [analyticsData]);

  const leaseExpirationData = useMemo(() => {
    if (!analyticsData?.leaseExpirations) {
      return [
        { name: "Current Revenue", value: 1850000, isTotal: false, details: [
          { label: "Monthly Contracts", value: 980000 },
          { label: "Seasonal Contracts", value: 620000 },
          { label: "Annual Contracts", value: 250000 },
        ]},
        { name: "Expiring 30 Days", value: -125000, details: [
          { label: "High Risk (No Renewal)", value: 45000 },
          { label: "Medium Risk", value: 35000 },
          { label: "Expected to Renew", value: 45000 },
        ]},
        { name: "Expiring 60 Days", value: -95000, details: [
          { label: "High Risk (No Renewal)", value: 30000 },
          { label: "Medium Risk", value: 25000 },
          { label: "Expected to Renew", value: 40000 },
        ]},
        { name: "Expiring 90 Days", value: -78000, details: [
          { label: "High Risk (No Renewal)", value: 20000 },
          { label: "Medium Risk", value: 28000 },
          { label: "Expected to Renew", value: 30000 },
        ]},
        { name: "New Contracts", value: 185000, details: [
          { label: "Confirmed Renewals", value: 120000 },
          { label: "New Waitlist", value: 45000 },
          { label: "Pending Applications", value: 20000 },
        ]},
        { name: "Projected Revenue", value: 1737000, isTotal: true },
      ];
    }
    return analyticsData.leaseExpirations;
  }, [analyticsData]);

  const revenueByTypeData = useMemo(() => {
    if (!analyticsData?.revenueByStorageType) {
      return [
        { category: "Wet Slips", value: 985000, breakdown: [
          { name: "Monthly", value: 520000 },
          { name: "Seasonal", value: 320000 },
          { name: "Transient", value: 145000 },
        ]},
        { category: "Dry Storage", value: 425000, breakdown: [
          { name: "Annual", value: 280000 },
          { name: "Monthly", value: 145000 },
        ]},
        { category: "Moorings", value: 185000, breakdown: [
          { name: "Seasonal", value: 120000 },
          { name: "Monthly", value: 65000 },
        ]},
        { category: "Ancillary", value: 255000, breakdown: [
          { name: "Electric", value: 85000 },
          { name: "Water", value: 45000 },
          { name: "Pump Out", value: 35000 },
          { name: "WiFi", value: 45000 },
          { name: "Other", value: 45000 },
        ]},
      ];
    }
    return analyticsData.revenueByStorageType;
  }, [analyticsData]);

  const kpis = analyticsData?.kpis || {
    currentOccupancy: 87.5,
    occupancyChange: 3.2,
    totalRevenue: 1850000,
    revenueChange: 8.5,
    avgLeaseValue: 12500,
    leaseValueChange: 4.2,
    expiringNext90Days: 42,
    expiringChange: -5,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              Interactive Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Drill-down charts for occupancy, revenue, and lease analysis
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DashboardNav />
            <div className="flex flex-wrap items-center gap-3">
              <TimePeriodSelector value={periodFilter} onChange={setPeriodFilter} />
              {!isProjectScoped && locations && locations.length > 1 && (
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="w-[180px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Occupancy Rate</p>
                  <p className="text-2xl font-bold">{kpis.currentOccupancy.toFixed(1)}%</p>
                </div>
                <div className={`flex items-center ${kpis.occupancyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis.occupancyChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="ml-1 text-sm">{Math.abs(kpis.occupancyChange).toFixed(1)}%</span>
                </div>
              </div>
              <Badge variant="outline" className="mt-2">vs last period</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue)}</p>
                </div>
                <div className={`flex items-center ${kpis.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis.revenueChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="ml-1 text-sm">{Math.abs(kpis.revenueChange).toFixed(1)}%</span>
                </div>
              </div>
              <Badge variant="outline" className="mt-2">YTD</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Lease Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(kpis.avgLeaseValue)}</p>
                </div>
                <div className={`flex items-center ${kpis.leaseValueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis.leaseValueChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="ml-1 text-sm">{Math.abs(kpis.leaseValueChange).toFixed(1)}%</span>
                </div>
              </div>
              <Badge variant="outline" className="mt-2">per month</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expiring (90 Days)</p>
                  <p className="text-2xl font-bold">{kpis.expiringNext90Days}</p>
                </div>
                <div className={`flex items-center ${kpis.expiringChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpis.expiringChange <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  <span className="ml-1 text-sm">{Math.abs(kpis.expiringChange)}</span>
                </div>
              </div>
              <Badge variant="outline" className="mt-2">leases</Badge>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="expirations">Expirations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <TimeSeriesDrillDown
                title="Occupancy Trend"
                description="Click on any bar to see breakdown by storage type"
                data={occupancyChartData}
                height={350}
                valueFormatter={(val) => `${val}%`}
              />
              <HierarchicalPieChart
                title="Storage Type Distribution"
                description="Click segments to drill into subcategories"
                data={storageTypeData}
                height={350}
                valueFormatter={(val) => `${val} units`}
              />
            </div>
            <WaterfallChart
              title="Lease Expiration Waterfall"
              description="Revenue impact of expiring leases over next 90 days - click bars for details"
              data={leaseExpirationData}
              height={400}
            />
          </TabsContent>

          <TabsContent value="occupancy" className="space-y-6 mt-6">
            <TimeSeriesDrillDown
              title="Monthly Occupancy Trend"
              description="Click any period to see occupancy breakdown by storage type"
              data={occupancyChartData}
              height={400}
              valueFormatter={(val) => `${val}%`}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <HierarchicalPieChart
                title="Current Occupancy by Type"
                description="Drill down into storage subcategories"
                data={storageTypeData}
                height={350}
                valueFormatter={(val) => `${val} units`}
              />
              <DrillDownBarChart
                title="Revenue by Storage Type"
                description="Click bars to see contract type breakdown"
                data={revenueByTypeData}
                height={350}
              />
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6 mt-6">
            <DrillDownBarChart
              title="Revenue by Storage Category"
              description="Click each bar to drill into revenue components"
              data={revenueByTypeData}
              height={400}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <HierarchicalPieChart
                title="Revenue Distribution"
                description="Click to see subcategory breakdown"
                data={storageTypeData.map(item => ({
                  ...item,
                  value: Math.round(item.value * 6500),
                  children: item.children?.map(c => ({ ...c, value: Math.round(c.value * 6500) })),
                }))}
                height={350}
                valueFormatter={(val) => formatCurrency(val)}
              />
              <TimeSeriesDrillDown
                title="Revenue Trend"
                description="Monthly revenue with drill-down"
                data={occupancyChartData.map(item => ({
                  period: item.period,
                  value: Math.round(item.value * 21000),
                  breakdown: item.breakdown?.map(b => ({ name: b.name, value: Math.round(b.value * 350) })),
                }))}
                height={350}
                valueFormatter={(val) => formatCurrency(val)}
              />
            </div>
          </TabsContent>

          <TabsContent value="expirations" className="space-y-6 mt-6">
            <WaterfallChart
              title="90-Day Lease Expiration Impact"
              description="Revenue waterfall showing expirations and expected renewals - click for details"
              data={leaseExpirationData}
              height={450}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-orange-500" />
                    Expiration Risk Summary
                  </CardTitle>
                  <CardDescription>Leases expiring in next 90 days by risk level</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="font-medium">High Risk</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">12 leases</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(95000)} at risk</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="font-medium">Medium Risk</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-yellow-600">18 leases</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(88000)} at risk</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="font-medium">Expected Renewals</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">12 leases</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(115000)} secured</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <HierarchicalPieChart
                title="Expirations by Storage Type"
                description="Where expiring leases are concentrated"
                data={[
                  { name: "Wet Slips", value: 24, children: [
                    { name: "High Risk", value: 8 },
                    { name: "Medium Risk", value: 10 },
                    { name: "Low Risk", value: 6 },
                  ]},
                  { name: "Dry Storage", value: 12, children: [
                    { name: "High Risk", value: 3 },
                    { name: "Medium Risk", value: 5 },
                    { name: "Low Risk", value: 4 },
                  ]},
                  { name: "Moorings", value: 6, children: [
                    { name: "High Risk", value: 1 },
                    { name: "Medium Risk", value: 3 },
                    { name: "Low Risk", value: 2 },
                  ]},
                ]}
                height={350}
                valueFormatter={(val) => `${val} leases`}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function generateSampleOccupancyData() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const seasonalMultipliers = [0.65, 0.62, 0.70, 0.82, 0.92, 0.98, 1.0, 0.98, 0.90, 0.78, 0.68, 0.64];
  
  return months.map((month, idx) => {
    const baseOccupancy = 85;
    const occupancy = Math.round(baseOccupancy * seasonalMultipliers[idx]);
    return {
      period: month,
      value: occupancy,
      breakdown: [
        { name: "Wet Slips", value: Math.round(occupancy * 0.55) },
        { name: "Dry Storage", value: Math.round(occupancy * 0.28) },
        { name: "Moorings", value: Math.round(occupancy * 0.12) },
        { name: "Transient", value: Math.round(occupancy * 0.05) },
      ],
    };
  });
}
