import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DollarSign, Users, Percent, TrendingUp, TrendingDown, ArrowRightLeft, AlertCircle, Ship, Warehouse, X } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { calculateDateRange, type TimePeriodFilter } from "@shared/timePeriodUtils";
import { Link } from "wouter";
import { format } from "date-fns";
import { ProjectActiveLeasesModal } from "./ProjectActiveLeasesModal";
import { ProjectAvgLeaseValueModal } from "./ProjectAvgLeaseValueModal";

const STORAGE_TYPES = [
  "Wet Slip", "Lift Slip", "Mooring", "Jet Ski", "Dry Rack - Indoor",
  "Dry Rack - Outdoor", "Houseboat", "Liveaboard", "Land Storage", "Boat on Trailer",
  "Trailer Only", "Carport", "RV Site", "Other",
];

interface ProjectOverviewProps {
  locationId: string | null;
  periodFilter: TimePeriodFilter;
}

interface ProjectKPIs {
  totalRevenue: string;
  totalStorageRevenue: string;
  activeLeases: number;
  occupancyRate: number;
  avgLeaseValue: string;
  totalCapacity: number;
  totalLeaseAmount: string;
  hasLeases: boolean;
  hasCapacity: boolean;
  hasDates: boolean;
  // Data quality indicators
  totalLeaseCount: number;
  leasesWithDefaultDates: number;
  leasesWithCashFlows: number;
}

interface ProjectMoveEvents {
  moveIns: number;
  moveOuts: number;
  netChange: number;
  avgVesselSize: number | null;
}

interface MoveEventLeaseDetail {
  id: string;
  customerName: string;
  vesselName: string | null;
  loa: number | null;
  leaseAmount: string | null;
  unitLocation: string | null;
  storageType: string | null;
  contractTerm: string | null;
  eventDate: string;
}

interface GroupedLeases {
  storageType: string;
  leases: MoveEventLeaseDetail[];
}

interface RevenueTrendPoint {
  month: string;
  revenue: string;
  leaseCount: number;
}

interface RevenueByStorage {
  storageType: string;
  revenue: string;
  leaseCount: number;
  percentage: number;
}

interface StorageLocationRevenue {
  storageLocationId: string;
  storageLocationName: string;
  storageType: string | null;
  capacity: number | null;
  occupiedCount: number;
  postedRate: number | null;
  postedRateType: string | null;
  avgBoatLength: number | null;
  potentialMonthlyRevenue: number;
  actualMonthlyRevenue: number;
  economicVacancy: number;
  occupancyVacancy: number;
  discountAmount: number;
}

interface EconomicVacancyMetrics {
  totalPotentialRevenue: number;
  totalActualRevenue: number;
  totalEconomicVacancy: number;
  economicVacancyPercentage: number;
  occupancyVacancy: number;
  totalCapacity: number;
  totalOccupied: number;
  byStorageLocation: StorageLocationRevenue[];
}

interface SlipOverlapWarning {
  slipAssignment: string;
  seasonType: string;
  leases: { leaseId: string; tenantName: string; dateRange: string }[];
}

interface SeasonalOccupancyMetrics {
  summerOccupancy: number;
  winterOccupancy: number;
  annualOccupancy: number;
  totalCapacity: number;
  summerOccupancyRate: number;
  winterOccupancyRate: number;
  overallOccupancyRate: number;
  summerSlips: string[];
  winterSlips: string[];
  annualSlips: string[];
  summerRevenue: number;
  winterRevenue: number;
  annualRevenue: number;
  totalRevenue: number;
  overlappingSlips: SlipOverlapWarning[];
}

interface SeasonalMoveEventsMetrics {
  summerMoveIns: number;
  summerMoveOuts: number;
  summerNetChange: number;
  winterMoveIns: number;
  winterMoveOuts: number;
  winterNetChange: number;
  annualMoveIns: number;
  annualMoveOuts: number;
  annualNetChange: number;
  overallMoveIns: number;
  overallMoveOuts: number;
  overallNetChange: number;
}

type OccupancyViewMode = "overall" | "summer" | "winter";
type ContractTermOccupancyMode = "overall" | "annual" | "seasonal" | "winter" | "shortTerm";

interface ContractTermOccupancyMetrics {
  counts: {
    annual: number;
    seasonal: number;
    winter: number;
    shortTerm: number;
    unclassified: number;
    total: number;
  };
  capacity: number;
  slotSeasons: number;
  occupancy: {
    overall: { percentage: number; numerator: number; denominator: number; label: string };
    annual: { percentage: number; numerator: number; denominator: number; label: string };
    seasonal: { percentage: number; numerator: number; denominator: number; label: string };
    winter: { percentage: number; numerator: number; denominator: number; label: string };
    shortTerm: { percentage: number; numerator: number; denominator: number; label: string };
  };
}

interface LocationBudgetData {
  budgetedRevenue: string | null;
  budgetedOccupancy: string | null;
  budgetedExpenses: string | null;
  budgetYear: number | null;
}

export default function ProjectOverview({ locationId, periodFilter }: ProjectOverviewProps) {
  const { startDate, endDate, label } = calculateDateRange(periodFilter);
  const [moveEventModalType, setMoveEventModalType] = useState<"move-in" | "move-out" | null>(null);
  const [selectedStorageTypes, setSelectedStorageTypes] = useState<string[]>([]);
  const [storageFilterOpen, setStorageFilterOpen] = useState(false);
  const [occupancyViewMode, setOccupancyViewMode] = useState<OccupancyViewMode>("overall");
  // Unified KPI filter state - shared across all KPI cards
  const [kpiSeasonMode, setKpiSeasonMode] = useState<ContractTermOccupancyMode>("overall");
  const [kpiStorageTypeFilter, setKpiStorageTypeFilter] = useState<string>("all");
  // Active Leases modal state
  const [activeLeasesModalOpen, setActiveLeasesModalOpen] = useState(false);
  // Avg Lease Value modal state
  const [avgLeaseValueModalOpen, setAvgLeaseValueModalOpen] = useState(false);
  
  // Extract year from the period filter for seasonal occupancy
  const currentYear = new Date(startDate).getFullYear();

  // Fetch project KPIs
  const { data: kpis, isLoading: kpisLoading } = useQuery<ProjectKPIs>({
    queryKey: ["/api/rent-roll", locationId, "overview/metrics", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/rent-roll/${locationId}/overview/metrics?${params}`);
      if (!response.ok) throw new Error("Failed to fetch project KPIs");
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch move events
  const { data: moveEvents, isLoading: moveEventsLoading } = useQuery<ProjectMoveEvents>({
    queryKey: ["/api/rent-roll", locationId, "overview/move-events", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/rent-roll/${locationId}/overview/move-events?${params}`);
      if (!response.ok) throw new Error("Failed to fetch move events");
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch revenue trend
  const { data: revenueTrend, isLoading: trendLoading } = useQuery<RevenueTrendPoint[]>({
    queryKey: ["/api/rent-roll", locationId, "overview/revenue-trend", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/rent-roll/${locationId}/overview/revenue-trend?${params}`);
      if (!response.ok) throw new Error("Failed to fetch revenue trend");
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch revenue by storage
  const { data: revenueByStorage, isLoading: storageLoading } = useQuery<RevenueByStorage[]>({
    queryKey: ["/api/rent-roll", locationId, "overview/revenue-by-storage", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/rent-roll/${locationId}/overview/revenue-by-storage?${params}`);
      if (!response.ok) throw new Error("Failed to fetch revenue by storage");
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch economic vacancy metrics (Potential Revenue vs Actual Revenue)
  const { data: economicVacancy, isLoading: economicVacancyLoading } = useQuery<EconomicVacancyMetrics>({
    queryKey: ["/api/rent-roll", locationId, "overview/economic-vacancy", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/rent-roll/${locationId}/overview/economic-vacancy?${params}`);
      if (!response.ok) throw new Error("Failed to fetch economic vacancy metrics");
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch seasonal occupancy metrics
  const { data: seasonalOccupancy, isLoading: seasonalOccupancyLoading } = useQuery<SeasonalOccupancyMetrics>({
    queryKey: ["/api/rent-roll", locationId, "overview/seasonal-occupancy", currentYear],
    queryFn: async () => {
      const params = new URLSearchParams({ year: currentYear.toString() });
      const response = await fetch(`/api/rent-roll/${locationId}/overview/seasonal-occupancy?${params}`);
      if (!response.ok) throw new Error("Failed to fetch seasonal occupancy metrics");
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch contract term-based occupancy metrics
  const { data: contractTermOccupancy, isLoading: contractTermOccupancyLoading } = useQuery<ContractTermOccupancyMetrics>({
    queryKey: ["/api/rent-roll", locationId, "overview/contract-term-occupancy", kpiStorageTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (kpiStorageTypeFilter !== "all") {
        params.append("storageType", kpiStorageTypeFilter);
      }
      const response = await fetch(`/api/rent-roll/${locationId}/overview/contract-term-occupancy?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch contract term occupancy");
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch available storage types for filter
  const { data: availableStorageTypes } = useQuery<string[]>({
    queryKey: ["/api/rent-roll", locationId, "overview/available-storage-types"],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/${locationId}/overview/available-storage-types`);
      if (!response.ok) throw new Error("Failed to fetch storage types");
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch seasonal move events metrics
  const { data: seasonalMoveEvents, isLoading: seasonalMoveEventsLoading } = useQuery<SeasonalMoveEventsMetrics>({
    queryKey: ["/api/rent-roll", locationId, "overview/seasonal-move-events", currentYear],
    queryFn: async () => {
      const params = new URLSearchParams({ year: currentYear.toString() });
      const response = await fetch(`/api/rent-roll/${locationId}/overview/seasonal-move-events?${params}`);
      if (!response.ok) throw new Error("Failed to fetch seasonal move events");
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch move event leases for drill-down modal
  const { data: moveEventLeases, isLoading: moveEventLeasesLoading } = useQuery<MoveEventLeaseDetail[]>({
    queryKey: ["/api/rent-roll", locationId, "overview/move-event-leases", startDate, endDate, moveEventModalType],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, eventType: moveEventModalType! });
      const response = await fetch(`/api/rent-roll/${locationId}/overview/move-event-leases?${params}`);
      if (!response.ok) throw new Error("Failed to fetch move event leases");
      return response.json();
    },
    enabled: !!locationId && !!moveEventModalType,
  });

  // Fetch location data for budget fields
  const { data: locationData, isLoading: locationLoading } = useQuery<LocationBudgetData>({
    queryKey: [`/api/rent-roll/locations/${locationId}`],
    enabled: !!locationId,
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatChartCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const chartData = revenueTrend?.map(point => ({
    month: point.month,
    revenue: parseFloat(point.revenue),
    leaseCount: point.leaseCount,
  })) || [];

  const pieChartData = revenueByStorage?.map(item => ({
    name: item.storageType,
    value: parseFloat(item.revenue),
    leaseCount: item.leaseCount,
    percentage: item.percentage,
  })) || [];

  const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#4f46e5'];

  const filteredMoveEventLeases = useMemo(() => {
    if (!moveEventLeases) return [];
    if (selectedStorageTypes.length === 0) return moveEventLeases;
    return moveEventLeases.filter(lease => 
      lease.storageType && selectedStorageTypes.includes(lease.storageType)
    );
  }, [moveEventLeases, selectedStorageTypes]);

  const handleStorageTypeToggle = (storageType: string) => {
    setSelectedStorageTypes(prev =>
      prev.includes(storageType)
        ? prev.filter(t => t !== storageType)
        : [...prev, storageType]
    );
  };

  const handleOpenMoveModal = (type: "move-in" | "move-out") => {
    setSelectedStorageTypes([]);
    setMoveEventModalType(type);
  };

  if (!locationId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Select a project to view overview</p>
      </div>
    );
  }

  // Check if configuration is needed
  const needsSetup = !kpisLoading && kpis && (!kpis.hasCapacity || !kpis.hasDates);
  const hasNoData = !kpisLoading && kpis && !kpis.hasLeases;
  const hasDefaultDates = !kpisLoading && kpis && kpis.leasesWithDefaultDates > 0;
  
  // Display Total Storage Revenue from the sum of all lease storage revenue
  const displayRevenue = kpis?.totalStorageRevenue || "0";

  // Compute seasonal move event display values based on selected view mode
  const displayMoveIns = useMemo(() => {
    if (seasonalMoveEvents) {
      switch (occupancyViewMode) {
        case "summer": return seasonalMoveEvents.summerMoveIns;
        case "winter": return seasonalMoveEvents.winterMoveIns;
        default: return seasonalMoveEvents.overallMoveIns;
      }
    }
    return moveEvents?.moveIns || 0;
  }, [occupancyViewMode, seasonalMoveEvents, moveEvents]);

  const displayMoveOuts = useMemo(() => {
    if (seasonalMoveEvents) {
      switch (occupancyViewMode) {
        case "summer": return seasonalMoveEvents.summerMoveOuts;
        case "winter": return seasonalMoveEvents.winterMoveOuts;
        default: return seasonalMoveEvents.overallMoveOuts;
      }
    }
    return moveEvents?.moveOuts || 0;
  }, [occupancyViewMode, seasonalMoveEvents, moveEvents]);

  const displayNetChange = useMemo(() => {
    if (seasonalMoveEvents) {
      switch (occupancyViewMode) {
        case "summer": return seasonalMoveEvents.summerNetChange;
        case "winter": return seasonalMoveEvents.winterNetChange;
        default: return seasonalMoveEvents.overallNetChange;
      }
    }
    return moveEvents?.netChange || 0;
  }, [occupancyViewMode, seasonalMoveEvents, moveEvents]);

  // Budget variance calculations
  const budgetVariance = useMemo(() => {
    if (!locationData || !kpis) return null;
    
    const budgetYear = locationData.budgetYear;
    // Parse budget values, stripping any comma formatting
    const budgetedRevenue = locationData.budgetedRevenue 
      ? parseFloat(locationData.budgetedRevenue.toString().replace(/,/g, '')) 
      : null;
    const budgetedOccupancy = locationData.budgetedOccupancy 
      ? parseFloat(locationData.budgetedOccupancy.toString().replace(/,/g, '')) 
      : null;
    
    // Only show variance if budget is set for the current year
    if (!budgetYear || budgetYear !== currentYear) return null;
    
    // Parse actual revenue, stripping any comma formatting
    const actualRevenue = parseFloat(displayRevenue.toString().replace(/,/g, ''));
    const actualOccupancy = contractTermOccupancy?.occupancy?.overall?.percentage ?? kpis.occupancyRate ?? 0;
    
    let revenueVariance = null;
    let revenueVariancePercent = null;
    if (budgetedRevenue !== null && budgetedRevenue > 0) {
      revenueVariance = actualRevenue - budgetedRevenue;
      revenueVariancePercent = ((actualRevenue - budgetedRevenue) / budgetedRevenue) * 100;
    }
    
    let occupancyVariance = null;
    if (budgetedOccupancy !== null) {
      occupancyVariance = actualOccupancy - budgetedOccupancy;
    }
    
    return {
      budgetYear,
      budgetedRevenue,
      budgetedOccupancy,
      actualRevenue,
      actualOccupancy,
      revenueVariance,
      revenueVariancePercent,
      occupancyVariance,
      hasBudgetData: budgetedRevenue !== null || budgetedOccupancy !== null,
    };
  }, [locationData, kpis, currentYear, displayRevenue, contractTermOccupancy]);

  return (
    <div className="space-y-4">
      {/* Data Quality Notice - Leases using default dates */}
      {hasDefaultDates && (
        <Alert className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm">
            <span className="font-medium text-blue-800 dark:text-blue-300">
              {kpis.leasesWithDefaultDates} {kpis.leasesWithDefaultDates === 1 ? 'lease is' : 'leases are'} using estimated dates.
            </span>
            {' '}
            <span className="text-blue-700 dark:text-blue-400">
              Revenue is calculated using Jan 1 - Dec 31 for leases without commencement dates. 
              Add actual dates in the Leases tab for accurate reporting.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Notice */}
      {needsSetup && !hasNoData && (
        <Alert className="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-300">Some data is missing.</span>
            {' '}
            <span className="text-amber-700 dark:text-amber-400">
              {!kpis?.hasCapacity && "Set property capacity to see occupancy rates. "}
              {!kpis?.hasDates && "Add lease dates to see revenue trends and move events. "}
            </span>
            <Link href={`/rent-roll/${locationId}?tab=settings`} className="text-amber-800 dark:text-amber-300 underline font-medium">
              Configure in Settings
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Unified KPI Filter Bar */}
      <div className="flex items-center justify-end gap-3 py-2">
        <span className="text-sm text-muted-foreground">Filter KPIs:</span>
        <Select 
          value={kpiSeasonMode} 
          onValueChange={(v) => setKpiSeasonMode(v as ContractTermOccupancyMode)}
        >
          <SelectTrigger className="h-8 w-[130px] text-sm" data-testid="select-kpi-contract-term">
            <SelectValue placeholder="Contract Term" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overall">Overall</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="seasonal">Seasonal</SelectItem>
            <SelectItem value="winter">Winter</SelectItem>
            <SelectItem value="shortTerm">Short-Term</SelectItem>
          </SelectContent>
        </Select>
        <Select 
          value={kpiStorageTypeFilter} 
          onValueChange={setKpiStorageTypeFilter}
        >
          <SelectTrigger className="h-8 w-[140px] text-sm" data-testid="select-kpi-storage-type">
            <SelectValue placeholder="Storage Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {availableStorageTypes?.map(type => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Storage Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Storage Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : hasNoData ? (
              <div className="text-muted-foreground">
                <div className="text-xl">—</div>
                <p className="text-xs mt-1">Import leases to see revenue</p>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-storage-revenue">
                  {formatCurrency(displayRevenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Sum of active leases
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Leases */}
        <Card 
          className="hover-elevate cursor-pointer" 
          onClick={() => setActiveLeasesModalOpen(true)}
          data-testid="card-active-leases"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Active Leases</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : hasNoData ? (
              <div className="text-muted-foreground">
                <div className="text-xl">—</div>
                <p className="text-xs mt-1">No leases imported</p>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-active-leases">
                  {kpis?.activeLeases || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Currently active
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Occupancy Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {(kpisLoading || contractTermOccupancyLoading) ? (
              <Skeleton className="h-8 w-24" />
            ) : !kpis?.hasCapacity && kpiStorageTypeFilter === "all" ? (
              <div className="text-muted-foreground">
                <div className="text-xl">—</div>
                <p className="text-xs mt-1">Set capacity in Settings</p>
              </div>
            ) : contractTermOccupancy ? (
              <div className="flex justify-between gap-4">
                <div>
                  <div className="text-2xl font-bold" data-testid="text-occupancy-rate">
                    {contractTermOccupancy.occupancy[kpiSeasonMode].percentage.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {contractTermOccupancy.occupancy[kpiSeasonMode].numerator} / {contractTermOccupancy.occupancy[kpiSeasonMode].denominator}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground space-y-0.5" data-testid="contract-term-breakdown">
                  <p><span className="tabular-nums">{contractTermOccupancy.counts.annual}</span> Annual</p>
                  <p><span className="tabular-nums">{contractTermOccupancy.counts.seasonal}</span> Seasonal</p>
                  <p><span className="tabular-nums">{contractTermOccupancy.counts.winter}</span> Winter</p>
                  <p><span className="tabular-nums">{contractTermOccupancy.counts.shortTerm}</span> Short-Term</p>
                  {contractTermOccupancy.counts.unclassified > 0 && (
                    <p className="text-amber-600"><span className="tabular-nums">{contractTermOccupancy.counts.unclassified}</span> Unclassified</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-occupancy-rate">
                  {kpis?.occupancyRate?.toFixed(1) || "0.0"}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.activeLeases || 0} / {kpis?.totalCapacity || 0} slips
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Avg Lease Value */}
        <Card 
          className="hover-elevate cursor-pointer"
          onClick={() => setAvgLeaseValueModalOpen(true)}
          data-testid="card-avg-lease-value"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Avg Lease Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : hasNoData ? (
              <div className="text-muted-foreground">
                <div className="text-xl">—</div>
                <p className="text-xs mt-1">Import leases first</p>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-avg-lease-value">
                  {formatCurrency(kpis?.avgLeaseValue || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per active lease
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 2 - Move Events (Seasonal) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Move-Ins */}
        <Card 
          className={kpis?.hasDates && (displayMoveIns) > 0 ? "cursor-pointer hover-elevate" : ""}
          onClick={() => kpis?.hasDates && (displayMoveIns) > 0 && handleOpenMoveModal("move-in")}
          data-testid="card-move-ins"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Move-Ins</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {(moveEventsLoading || seasonalMoveEventsLoading) ? (
              <Skeleton className="h-8 w-16" />
            ) : !kpis?.hasDates ? (
              <div className="text-muted-foreground">
                <div className="text-xl">—</div>
                <p className="text-xs mt-1">Add lease dates</p>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600" data-testid="text-move-ins">
                  {displayMoveIns}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {label}
                  {occupancyViewMode !== "overall" && ` (${occupancyViewMode})`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Move-Outs */}
        <Card 
          className={kpis?.hasDates && (displayMoveOuts) > 0 ? "cursor-pointer hover-elevate" : ""}
          onClick={() => kpis?.hasDates && (displayMoveOuts) > 0 && handleOpenMoveModal("move-out")}
          data-testid="card-move-outs"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Move-Outs</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {(moveEventsLoading || seasonalMoveEventsLoading) ? (
              <Skeleton className="h-8 w-16" />
            ) : !kpis?.hasDates ? (
              <div className="text-muted-foreground">
                <div className="text-xl">—</div>
                <p className="text-xs mt-1">Add lease dates</p>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600" data-testid="text-move-outs">
                  {displayMoveOuts}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {label}
                  {occupancyViewMode !== "overall" && ` (${occupancyViewMode})`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Net Change */}
        <Card data-testid="card-net-change">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Net Change</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {(moveEventsLoading || seasonalMoveEventsLoading) ? (
              <Skeleton className="h-8 w-16" />
            ) : !kpis?.hasDates ? (
              <div className="text-muted-foreground">
                <div className="text-xl">—</div>
                <p className="text-xs mt-1">Add lease dates</p>
              </div>
            ) : (
              <>
                <div className={`text-2xl font-bold ${
                  displayNetChange > 0 ? 'text-green-600' :
                  displayNetChange < 0 ? 'text-red-600' :
                  'text-foreground'
                }`} data-testid="text-net-change">
                  {displayNetChange > 0 ? '+' : ''}{displayNetChange}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Move-ins minus move-outs
                  {occupancyViewMode !== "overall" && ` (${occupancyViewMode})`}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Average Vessel Size */}
        <Card data-testid="card-avg-vessel-size">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Avg Vessel Size</CardTitle>
            <Ship className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {moveEventsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : moveEvents?.avgVesselSize === null ? (
              <div className="text-muted-foreground">
                <div className="text-xl">—</div>
                <p className="text-xs mt-1">No LOA data</p>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-avg-vessel-size">
                  {moveEvents?.avgVesselSize} ft
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average LOA
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Variance Section */}
      {budgetVariance && budgetVariance.hasBudgetData && (
        <Card data-testid="card-budget-variance">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Budget Variance</CardTitle>
                <CardDescription>
                  {budgetVariance.budgetYear} Actual vs. Budget Performance
                </CardDescription>
              </div>
              <Link 
                href={`/rent-roll/${locationId}?tab=details`} 
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Edit Budget
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Revenue Variance */}
              {budgetVariance.budgetedRevenue !== null && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Revenue</p>
                    {budgetVariance.revenueVariance !== null && (
                      <Badge 
                        variant={budgetVariance.revenueVariance >= 0 ? "default" : "destructive"}
                        className={budgetVariance.revenueVariance >= 0 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                          : ""}
                      >
                        {budgetVariance.revenueVariance >= 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {budgetVariance.revenueVariancePercent !== null 
                          ? `${budgetVariance.revenueVariancePercent >= 0 ? '+' : ''}${budgetVariance.revenueVariancePercent.toFixed(1)}%`
                          : '—'}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Actual</p>
                      <p className="text-lg font-bold" data-testid="text-actual-revenue-budget">
                        {formatCurrency(budgetVariance.actualRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Budgeted</p>
                      <p className="text-lg font-semibold text-muted-foreground" data-testid="text-budgeted-revenue">
                        {formatCurrency(budgetVariance.budgetedRevenue)}
                      </p>
                    </div>
                  </div>
                  {budgetVariance.revenueVariance !== null && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Variance</p>
                      <p className={`text-sm font-semibold ${
                        budgetVariance.revenueVariance >= 0 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-red-600 dark:text-red-400"
                      }`} data-testid="text-revenue-variance">
                        {budgetVariance.revenueVariance >= 0 ? '+' : ''}
                        {formatCurrency(budgetVariance.revenueVariance)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Occupancy Variance */}
              {budgetVariance.budgetedOccupancy !== null && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">Occupancy</p>
                    {budgetVariance.occupancyVariance !== null && (
                      <Badge 
                        variant={budgetVariance.occupancyVariance >= 0 ? "default" : "destructive"}
                        className={budgetVariance.occupancyVariance >= 0 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                          : ""}
                      >
                        {budgetVariance.occupancyVariance >= 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {budgetVariance.occupancyVariance >= 0 ? '+' : ''}
                        {budgetVariance.occupancyVariance.toFixed(1)} pts
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Actual</p>
                      <p className="text-lg font-bold" data-testid="text-actual-occupancy">
                        {budgetVariance.actualOccupancy.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="text-lg font-semibold text-muted-foreground" data-testid="text-target-occupancy">
                        {budgetVariance.budgetedOccupancy.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {budgetVariance.occupancyVariance !== null && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">Variance</p>
                      <p className={`text-sm font-semibold ${
                        budgetVariance.occupancyVariance >= 0 
                          ? "text-green-600 dark:text-green-400" 
                          : "text-red-600 dark:text-red-400"
                      }`} data-testid="text-occupancy-variance">
                        {budgetVariance.occupancyVariance >= 0 ? '+' : ''}
                        {budgetVariance.occupancyVariance.toFixed(1)} percentage points
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Economic Vacancy Section */}
      {economicVacancy && economicVacancy.totalPotentialRevenue > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Analysis</CardTitle>
            <CardDescription>Potential vs Actual Revenue by Storage Location</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Potential Revenue</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="text-potential-revenue">
                    {formatCurrency(economicVacancy.totalPotentialRevenue || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">At posted rates × capacity</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Actual Revenue</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-actual-revenue">
                    {formatCurrency(economicVacancy.totalActualRevenue || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">From active leases</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Economic Vacancy</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-economic-vacancy">
                    {formatCurrency(economicVacancy.totalEconomicVacancy || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {typeof economicVacancy.economicVacancyPercentage === 'number' && !isNaN(economicVacancy.economicVacancyPercentage) 
                      ? `${economicVacancy.economicVacancyPercentage.toFixed(1)}% of potential` 
                      : "—"}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Occupancy Vacancy</p>
                  <p className="text-xl font-bold" data-testid="text-occupancy-vacancy">
                    {economicVacancy.occupancyVacancy || 0} slips
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {economicVacancy.totalOccupied || 0} / {economicVacancy.totalCapacity || 0} occupied
                  </p>
                </div>
              </div>

              {/* By Storage Location Table */}
              {economicVacancy.byStorageLocation.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Storage Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Posted Rate</TableHead>
                        <TableHead className="text-center">Capacity</TableHead>
                        <TableHead className="text-center">Occupied</TableHead>
                        <TableHead className="text-right">Potential</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Vacancy $</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {economicVacancy.byStorageLocation
                        .filter(loc => loc.capacity && loc.capacity > 0)
                        .map((loc) => (
                        <TableRow key={loc.storageLocationId}>
                          <TableCell className="font-medium">{loc.storageLocationName}</TableCell>
                          <TableCell>{loc.storageType || "—"}</TableCell>
                          <TableCell className="text-right">
                            {loc.postedRate ? (
                              <span>
                                {(() => {
                                  const hasDecimals = loc.postedRate % 1 !== 0;
                                  return loc.postedRate.toLocaleString('en-US', { 
                                    style: 'currency', 
                                    currency: 'USD', 
                                    minimumFractionDigits: hasDecimals ? 2 : 0, 
                                    maximumFractionDigits: hasDecimals ? 2 : 0 
                                  });
                                })()}
                                <span className="text-xs text-muted-foreground ml-1">
                                  {loc.postedRateType === "Per Foot/Month" && "/ft/mo"}
                                  {loc.postedRateType === "Per Month" && "/mo"}
                                  {loc.postedRateType === "Per Season" && "/season"}
                                  {loc.postedRateType === "Per Foot/Season" && "/ft/season"}
                                  {loc.postedRateType === "Per Year" && "/yr"}
                                  {loc.postedRateType === "Per Foot/Year" && "/ft/yr"}
                                </span>
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-center">{loc.capacity || "—"}</TableCell>
                          <TableCell className="text-center">{loc.occupiedCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(loc.potentialMonthlyRevenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(loc.actualMonthlyRevenue)}</TableCell>
                          <TableCell className="text-right">
                            {loc.economicVacancy > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400">
                                {formatCurrency(loc.economicVacancy)}
                              </span>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue over selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={formatChartCurrency} />
                  <Tooltip formatter={(value) => formatChartCurrency(value as number)} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground text-center px-4">
                <AlertCircle className="h-8 w-8 mb-2 text-muted-foreground/50" />
                <p className="text-sm font-medium">No revenue trend data</p>
                <p className="text-xs mt-1">
                  {!kpis?.hasDates 
                    ? "Add commencement dates to leases to see trends" 
                    : "No cash flow records for selected period"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Storage Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Storage Type</CardTitle>
            <CardDescription>Revenue distribution across storage types</CardDescription>
          </CardHeader>
          <CardContent>
            {storageLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatChartCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground text-center px-4">
                <AlertCircle className="h-8 w-8 mb-2 text-muted-foreground/50" />
                <p className="text-sm font-medium">No storage breakdown</p>
                <p className="text-xs mt-1">
                  {hasNoData 
                    ? "Import leases to see storage type distribution" 
                    : "No cash flow records for selected period"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Move Event Leases Drill-down Modal */}
      <Dialog open={!!moveEventModalType} onOpenChange={(open) => !open && setMoveEventModalType(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0" data-testid="dialog-move-event-leases">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl">
              {moveEventModalType === "move-in" ? "Move-Ins" : "Move-Outs"} ({filteredMoveEventLeases.length}) - {label}
            </DialogTitle>
            <DialogDescription>
              {moveEventModalType === "move-in" 
                ? "New leases that started during this period" 
                : "Leases that ended during this period"}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-3 border-b bg-muted/30">
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={storageFilterOpen} onOpenChange={setStorageFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    data-testid="button-storage-filter"
                  >
                    <Warehouse className="h-4 w-4" />
                    Storage Type
                    {selectedStorageTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                        {selectedStorageTypes.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Filter by Storage Type</span>
                      {selectedStorageTypes.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setSelectedStorageTypes([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {STORAGE_TYPES.map((type) => (
                        <div key={type} className="flex items-center gap-2">
                          <Checkbox
                            id={`modal-storage-${type}`}
                            checked={selectedStorageTypes.includes(type)}
                            onCheckedChange={() => handleStorageTypeToggle(type)}
                            data-testid={`checkbox-storage-${type.replace(/\s+/g, "-").toLowerCase()}`}
                          />
                          <Label
                            htmlFor={`modal-storage-${type}`}
                            className="text-sm cursor-pointer"
                          >
                            {type}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {selectedStorageTypes.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground"
                  onClick={() => setSelectedStorageTypes([])}
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear filters
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex-1 min-h-0 overflow-hidden">
            {moveEventLeasesLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredMoveEventLeases.length > 0 ? (
              <ScrollArea className="h-full">
                <div className="px-6 py-4">
                  {(() => {
                    const groupedByStorageType = filteredMoveEventLeases.reduce((acc, lease) => {
                      const key = lease.storageType || "Unassigned";
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(lease);
                      return acc;
                    }, {} as Record<string, MoveEventLeaseDetail[]>);
                    
                    const sortedGroups = Object.entries(groupedByStorageType).sort((a, b) => 
                      a[0].localeCompare(b[0])
                    );
                    
                    return (
                      <div className="space-y-6">
                        {sortedGroups.map(([storageType, leases]) => (
                          <div key={storageType}>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="secondary" className="text-sm font-medium">
                                {storageType}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {leases.length} {leases.length === 1 ? "lease" : "leases"}
                              </span>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[180px]">Customer</TableHead>
                                  <TableHead className="w-[100px]">Location</TableHead>
                                  <TableHead className="w-[80px] text-right">Rate</TableHead>
                                  <TableHead className="w-[80px]">Term</TableHead>
                                  <TableHead className="w-[60px] text-right">LOA</TableHead>
                                  <TableHead className="w-[100px]">{moveEventModalType === "move-in" ? "Start Date" : "End Date"}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {leases.map((lease) => (
                                  <TableRow key={lease.id} data-testid={`row-lease-${lease.id}`}>
                                    <TableCell className="font-medium">
                                      <div className="truncate max-w-[180px]" title={lease.customerName}>
                                        {lease.customerName}
                                      </div>
                                      {lease.vesselName && (
                                        <div className="text-xs text-muted-foreground truncate max-w-[180px]" title={lease.vesselName}>
                                          {lease.vesselName}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm">{lease.unitLocation || "—"}</span>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-medium">
                                      {lease.leaseAmount ? formatCurrency(lease.leaseAmount) : "—"}
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-sm">{lease.contractTerm || "—"}</span>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {lease.loa ? `${lease.loa}'` : "—"}
                                    </TableCell>
                                    <TableCell className="tabular-nums text-sm">
                                      {lease.eventDate 
                                        ? format(new Date(lease.eventDate + "T12:00:00"), "MMM d, yyyy")
                                        : "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-12 text-muted-foreground px-6">
                No {moveEventModalType === "move-in" ? "move-ins" : "move-outs"} found for the selected period
              </div>
            )}
          </div>
          
          <div className="flex justify-end px-6 py-4 border-t flex-shrink-0 bg-background">
            <Button variant="outline" onClick={() => setMoveEventModalType(null)} data-testid="button-close-modal">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Leases Modal */}
      {locationId && (
        <ProjectActiveLeasesModal
          open={activeLeasesModalOpen}
          onClose={() => setActiveLeasesModalOpen(false)}
          projectId={locationId}
        />
      )}

      {/* Avg Lease Value Modal */}
      {locationId && (
        <ProjectAvgLeaseValueModal
          open={avgLeaseValueModalOpen}
          onClose={() => setAvgLeaseValueModalOpen(false)}
          locationId={locationId}
          startDate={startDate}
          endDate={endDate}
          contractTermFilter={kpiSeasonMode}
          storageTypeFilter={kpiStorageTypeFilter}
        />
      )}
    </div>
  );
}
