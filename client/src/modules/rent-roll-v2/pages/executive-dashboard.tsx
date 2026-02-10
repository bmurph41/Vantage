import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TimePeriodSelector, { type SuggestedContractTerm } from "../components/rent-roll/TimePeriodSelector";
import DashboardNav from "../components/navigation/DashboardNav";
import LeaseCalculator from "../components/LeaseCalculator";
import { MoveEventsModal } from "../components/executive/MoveEventsModal";
import { TotalRevenueModal } from "../components/executive/TotalRevenueModal";
import { ActiveLeasesModal } from "../components/executive/ActiveLeasesModal";
import { OccupancyRateModal } from "../components/executive/OccupancyRateModal";
import { AvgLeaseValueModal } from "../components/executive/AvgLeaseValueModal";
import { AvgBoatSizeModal } from "../components/executive/AvgBoatSizeModal";
import { TrendingUp, TrendingDown, DollarSign, Users, Percent, ArrowRightLeft, Info, Plus, Loader2, Download, FileImage, X, Filter, Check, Building2, Ship } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { calculateDateRange, type TimePeriodFilter } from "@shared/timePeriodUtils";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { createLocation } from "../lib/locationApi";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const STORAGE_TYPES = [
  "Wet Slip",
  "Lift Slip",
  "Mooring",
  "Jet Ski",
  "Dry Rack - Indoor",
  "Dry Rack - Outdoor",
  "Houseboat",
  "Land Storage",
  "Boat on Trailer",
  "Trailer Only",
] as const;

const storageTypeConfigSchema = z.object({
  storageType: z.string(),
  unitCount: z.number().min(0).nullable(),
  targetOccupancy: z.string().optional(),
});

const addProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  projectType: z.enum(["OWNED", "DEAL"]),
  description: z.string().optional(),
  status: z.string().optional(),
  operationType: z.enum(["ANNUAL", "SEASONAL"]).default("ANNUAL"),
  storageTypeConfigs: z.array(storageTypeConfigSchema).default([]),
  includeInExecutive: z.boolean().default(true),
});

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingProject?: {
    id: string;
    name: string;
    projectType: string;
  };
  canModify?: boolean;
}

interface IncludedProject {
  locationId: string;
  name: string;
  projectType: "OWNED" | "DEAL";
}

interface ExecutiveDashboardMetrics {
  totalRevenue: string;
  totalStorageRevenue: string;
  activeLeases: number;
  totalLeases: number;
  occupancyRate: number;
  averageLeaseValue: string;
  totalMoveIns: number;
  totalMoveOuts: number;
  netMoveChange: number;
}

interface RevenueTrendDataPoint {
  periodDate: string;
  periodLabel: string;
  revenue: string;
  leaseCount: number;
}

interface StorageTypeMix {
  storageType: string;
  totalRevenue: string;
  leaseCount: number;
}

interface RevenueTrendByStorageType {
  total: RevenueTrendDataPoint[];
  byStorageType: Record<string, RevenueTrendDataPoint[]>;
  storageTypes: string[];
}

interface AncillaryRevenueTrendDataPoint {
  periodDate: string;
  periodLabel: string;
  electricRevenue: string;
  liveaboardRevenue: string;
  otherRevenue: string;
  totalAncillaryRevenue: string;
}

type ProjectTypeFilter = "ALL" | "OWNED" | "DEAL";

type IncludedProjectsViewMode = "all" | "owned-only" | "pipeline-only";

interface KpiFilterState {
  projectType: ProjectTypeFilter;
  selectedProjectIds: string[] | null;
}

type ContractTermOccupancyMode = "overall" | "annual" | "seasonal" | "winter" | "shortTerm";

type AvgBoatSizeMode = "overall" | "annual" | "seasonal" | "winter";

interface AvgBoatSizeMetrics {
  overall: { avgLength: number; boatCount: number; label: string };
  annual: { avgLength: number; boatCount: number; label: string } | null;
  seasonal: { avgLength: number; boatCount: number; label: string } | null;
  winter: { avgLength: number; boatCount: number; label: string } | null;
  byProject: Array<{
    projectId: string;
    projectName: string;
    avgLength: number;
    boatCount: number;
    contractTermBreakdown: {
      annual: { avgLength: number; boatCount: number };
      seasonal: { avgLength: number; boatCount: number };
      winter: { avgLength: number; boatCount: number };
    };
  }>;
}

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

export default function ExecutiveDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [periodFilter, setPeriodFilter] = useState<TimePeriodFilter>({
    type: "TTM",
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogStep, setAddDialogStep] = useState<1 | 2 | 3>(1);
  const [isExporting, setIsExporting] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [projectToRemove, setProjectToRemove] = useState<string | null>(null);
  const [moveEventsModalOpen, setMoveEventsModalOpen] = useState(false);
  const [moveEventType, setMoveEventType] = useState<"move-in" | "move-out">("move-in");
  const [revenueModalOpen, setRevenueModalOpen] = useState(false);
  const [leasesModalOpen, setLeasesModalOpen] = useState(false);
  const [occupancyModalOpen, setOccupancyModalOpen] = useState(false);
  const [avgLeaseValueModalOpen, setAvgLeaseValueModalOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResult["existingProject"] | null>(null);
  const [pendingProjectData, setPendingProjectData] = useState<z.infer<typeof addProjectSchema> | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [canModifyDuplicate, setCanModifyDuplicate] = useState(false);
  
  const [kpiFilter, setKpiFilter] = useState<KpiFilterState>({
    projectType: "ALL",
    selectedProjectIds: null,
  });
  // Unified KPI filter state - shared across all KPI cards
  const [kpiSeasonMode, setKpiSeasonMode] = useState<ContractTermOccupancyMode>("overall");
  const [kpiStorageTypeFilter, setKpiStorageTypeFilter] = useState<string>("all");
  const [selectedTrendStorageTypes, setSelectedTrendStorageTypes] = useState<string[]>([]);
  const [avgBoatSizeModalOpen, setAvgBoatSizeModalOpen] = useState(false);
  
  // Derive view mode from kpiFilter.projectType to keep in sync
  const includedProjectsViewMode: IncludedProjectsViewMode = 
    kpiFilter.projectType === "OWNED" ? "owned-only" : 
    kpiFilter.projectType === "DEAL" ? "pipeline-only" : "all";

  const { startDate, endDate, label } = calculateDateRange(periodFilter);
  
  const buildFilterQueryString = () => {
    const params: string[] = [];
    if (kpiFilter.projectType !== "ALL") {
      params.push(`projectType=${kpiFilter.projectType}`);
    }
    if (kpiFilter.selectedProjectIds !== null && kpiFilter.selectedProjectIds.length > 0) {
      params.push(`projectIds=${kpiFilter.selectedProjectIds.join(",")}`);
    }
    return params.length > 0 ? `&${params.join("&")}` : "";
  };

  const handleOpenMoveEventsModal = (type: "move-in" | "move-out") => {
    setMoveEventType(type);
    setMoveEventsModalOpen(true);
  };

  // When Time Period changes, auto-adjust Contract Term to match
  const handlePeriodFilterChange = (filter: TimePeriodFilter, suggestedContractTerm?: SuggestedContractTerm) => {
    setPeriodFilter(filter);
    // Auto-adjust Contract Term based on Time Period selection
    if (suggestedContractTerm && suggestedContractTerm !== kpiSeasonMode) {
      setKpiSeasonMode(suggestedContractTerm as ContractTermOccupancyMode);
    }
  };

  // When Contract Term is manually changed, reset Time Period to TTM
  const handleContractTermChange = (term: ContractTermOccupancyMode) => {
    setKpiSeasonMode(term);
    // Reset Time Period to TTM when Contract Term is manually changed
    if (periodFilter.type !== "TTM") {
      setPeriodFilter({ type: "TTM" });
    }
  };

  const handleExportPNG = async () => {
    if (!dashboardRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      
      const link = document.createElement("a");
      link.download = `executive-summary-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      toast({
        title: "Success",
        description: "Dashboard exported as PNG",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export dashboard",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const form = useForm<z.infer<typeof addProjectSchema>>({
    resolver: zodResolver(addProjectSchema),
    defaultValues: {
      name: "",
      projectType: "OWNED",
      description: "",
      status: "",
      operationType: "ANNUAL",
      storageTypeConfigs: [],
      includeInExecutive: true,
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addProjectSchema>) => {
      const response = await fetch('/api/rent-roll/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create project');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/included-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive-dashboard/metrics'] });
      toast({
        title: "Success",
        description: "Rent roll created successfully",
      });
      setAddDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create rent roll",
        variant: "destructive",
      });
    },
  });

  const checkDuplicateName = async (name: string): Promise<DuplicateCheckResult> => {
    const response = await fetch('/api/rent-roll/locations/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to check for duplicate');
    return response.json();
  };

  const handleAddProject = async (data: z.infer<typeof addProjectSchema>) => {
    const cleanedData = {
      ...data,
      description: data.description?.trim() || undefined,
      status: data.status?.trim() || undefined,
    };
    createProjectMutation.mutate(cleanedData);
  };

  const handleDuplicateRename = () => {
    setDuplicateDialogOpen(false);
    if (pendingProjectData) {
      form.setValue("name", pendingProjectData.name);
      form.setValue("projectType", pendingProjectData.projectType);
    }
    setAddDialogOpen(true);
  };

  const handleDuplicateReplace = async () => {
    if (!duplicateInfo || !pendingProjectData) return;
    
    setIsReplacing(true);
    try {
      const response = await fetch('/api/rent-roll/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pendingProjectData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create project');
      }
      
      // Delete the old project after successful create
      await fetch(`/api/rent-roll/locations/${duplicateInfo.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/included-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive-dashboard/metrics'] });
      
      toast({
        title: "Success",
        description: "Project replaced successfully",
      });
      
      setDuplicateDialogOpen(false);
      setPendingProjectData(null);
      setDuplicateInfo(null);
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to replace project",
        variant: "destructive",
      });
    } finally {
      setIsReplacing(false);
    }
  };

  const handleDuplicateMerge = () => {
    if (!duplicateInfo) return;
    const projectId = duplicateInfo.id;
    setDuplicateDialogOpen(false);
    setPendingProjectData(null);
    setDuplicateInfo(null);
    setLocation(`/rent-roll/${projectId}`);
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setPendingProjectData(null);
    setDuplicateInfo(null);
    setCanModifyDuplicate(false);
    form.reset();
  };

  const removeFromExecutiveMutation = useMutation({
    mutationFn: async (locationId: string) => {
      const response = await fetch(`/api/rent-roll/locations/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ includeInExecutive: false }),
      });
      if (!response.ok) throw new Error("Failed to remove project from executive summary");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/included-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive-dashboard/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive-dashboard/revenue-trend'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/revenue-by-storage-type'] });
      toast({
        title: "Success",
        description: "Project removed from executive summary",
      });
      setRemoveDialogOpen(false);
      setProjectToRemove(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove project",
        variant: "destructive",
      });
    },
  });

  const handleRemoveProject = (locationId: string) => {
    setProjectToRemove(locationId);
    setRemoveDialogOpen(true);
  };

  const confirmRemoveProject = () => {
    if (projectToRemove) {
      removeFromExecutiveMutation.mutate(projectToRemove);
    }
  };

  useEffect(() => {
    if (!addDialogOpen) {
      form.reset();
      setAddDialogStep(1);
    }
  }, [addDialogOpen]);

  const filterQueryString = buildFilterQueryString();
  
  const { data: metrics, isLoading: metricsLoading } = useQuery<ExecutiveDashboardMetrics>({
    queryKey: ["/api/executive-dashboard/metrics", startDate, endDate, kpiFilter.projectType, kpiFilter.selectedProjectIds, kpiSeasonMode, kpiStorageTypeFilter],
    queryFn: async () => {
      const seasonModeParam = kpiSeasonMode !== "overall" ? `&seasonMode=${kpiSeasonMode}` : "";
      const storageTypeParam = kpiStorageTypeFilter !== "all" ? `&storageType=${encodeURIComponent(kpiStorageTypeFilter)}` : "";
      const response = await fetch(
        `/api/executive-dashboard/metrics?startDate=${startDate}&endDate=${endDate}${filterQueryString}${seasonModeParam}${storageTypeParam}`
      );
      if (!response.ok) throw new Error("Failed to fetch metrics");
      return response.json();
    },
  });

  const { data: trendData, isLoading: trendLoading } = useQuery<RevenueTrendDataPoint[]>({
    queryKey: ["/api/executive-dashboard/revenue-trend", startDate, endDate, kpiFilter.projectType, kpiFilter.selectedProjectIds],
    queryFn: async () => {
      const response = await fetch(
        `/api/executive-dashboard/revenue-trend?startDate=${startDate}&endDate=${endDate}${filterQueryString}`
      );
      if (!response.ok) throw new Error("Failed to fetch revenue trend");
      return response.json();
    },
  });

  // Revenue trend by storage type (only fetched when storage types are selected)
  const { data: trendByStorageType, isLoading: trendByStorageLoading } = useQuery<RevenueTrendByStorageType>({
    queryKey: ["/api/executive-dashboard/revenue-trend-by-storage-type", startDate, endDate, kpiFilter.projectType, kpiFilter.selectedProjectIds, selectedTrendStorageTypes],
    queryFn: async () => {
      const storageTypesParam = selectedTrendStorageTypes.length > 0 
        ? `&storageTypes=${selectedTrendStorageTypes.join(",")}`
        : "";
      const response = await fetch(
        `/api/executive-dashboard/revenue-trend-by-storage-type?startDate=${startDate}&endDate=${endDate}${filterQueryString}${storageTypesParam}`
      );
      if (!response.ok) throw new Error("Failed to fetch revenue trend by storage type");
      return response.json();
    },
    enabled: selectedTrendStorageTypes.length > 0,
  });

  const { data: storageTypeMix, isLoading: mixLoading } = useQuery<StorageTypeMix[]>({
    queryKey: ["/api/rent-roll/revenue-by-storage-type", startDate, endDate, kpiFilter.projectType, kpiFilter.selectedProjectIds],
    queryFn: async () => {
      const response = await fetch(
        `/api/rent-roll/revenue-by-storage-type?startDate=${startDate}&endDate=${endDate}${filterQueryString}`
      );
      if (!response.ok) throw new Error("Failed to fetch storage type mix");
      return response.json();
    },
  });

  // Ancillary revenue trend (electric, liveaboard, other fees)
  const { data: ancillaryTrendData, isLoading: ancillaryTrendLoading } = useQuery<AncillaryRevenueTrendDataPoint[]>({
    queryKey: ["/api/executive-dashboard/ancillary-revenue-trend", startDate, endDate, kpiFilter.projectType, kpiFilter.selectedProjectIds],
    queryFn: async () => {
      const response = await fetch(
        `/api/executive-dashboard/ancillary-revenue-trend?startDate=${startDate}&endDate=${endDate}${filterQueryString}`
      );
      if (!response.ok) throw new Error("Failed to fetch ancillary revenue trend");
      return response.json();
    },
  });

  // Transient/short-term revenue trend (monthly, weekly, daily contract terms)
  const { data: transientTrendData, isLoading: transientTrendLoading } = useQuery<RevenueTrendDataPoint[]>({
    queryKey: ["/api/executive-dashboard/transient-revenue-trend", startDate, endDate, kpiFilter.projectType, kpiFilter.selectedProjectIds],
    queryFn: async () => {
      const response = await fetch(
        `/api/executive-dashboard/transient-revenue-trend?startDate=${startDate}&endDate=${endDate}${filterQueryString}`
      );
      if (!response.ok) throw new Error("Failed to fetch transient revenue trend");
      return response.json();
    },
  });

  const { data: includedProjects } = useQuery<IncludedProject[]>({
    queryKey: ["/api/rent-roll/included-projects"],
    queryFn: async () => {
      const response = await fetch("/api/rent-roll/included-projects");
      if (!response.ok) throw new Error("Failed to fetch included projects");
      return response.json();
    },
  });

  // Contract term occupancy query
  const { data: contractTermOccupancy, isLoading: contractTermOccupancyLoading } = useQuery<ContractTermOccupancyMetrics>({
    queryKey: ["/api/executive-dashboard/contract-term-occupancy", kpiFilter.projectType, kpiFilter.selectedProjectIds, kpiStorageTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (kpiFilter.projectType !== "ALL") {
        params.append("projectType", kpiFilter.projectType);
      }
      if (kpiFilter.selectedProjectIds.length > 0) {
        params.append("projectIds", kpiFilter.selectedProjectIds.join(","));
      }
      if (kpiStorageTypeFilter !== "all") {
        params.append("storageType", kpiStorageTypeFilter);
      }
      const response = await fetch(`/api/executive-dashboard/contract-term-occupancy?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch contract term occupancy");
      return response.json();
    },
  });

  // Available storage types for filter
  const { data: availableStorageTypes } = useQuery<string[]>({
    queryKey: ["/api/executive-dashboard/available-storage-types", kpiFilter.selectedProjectIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (kpiFilter.selectedProjectIds.length > 0) {
        params.append("projectIds", kpiFilter.selectedProjectIds.join(","));
      }
      const response = await fetch(`/api/executive-dashboard/available-storage-types?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch storage types");
      return response.json();
    },
  });

  // Average boat size query
  const { data: avgBoatSize, isLoading: avgBoatSizeLoading } = useQuery<AvgBoatSizeMetrics>({
    queryKey: ["/api/executive-dashboard/avg-boat-size", kpiFilter.projectType, kpiFilter.selectedProjectIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (kpiFilter.projectType !== "ALL") {
        params.append("projectType", kpiFilter.projectType);
      }
      if (kpiFilter.selectedProjectIds.length > 0) {
        params.append("projectIds", kpiFilter.selectedProjectIds.join(","));
      }
      const response = await fetch(`/api/executive-dashboard/avg-boat-size?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch avg boat size");
      return response.json();
    },
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

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const chartData = trendData?.map(point => ({
    month: point.periodLabel,
    revenue: parseFloat(point.revenue),
    leases: point.leaseCount,
  })) || [];

  const STORAGE_TYPE_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(210, 100%, 50%)",
    "hsl(280, 100%, 50%)",
    "hsl(30, 100%, 50%)",
    "hsl(150, 100%, 40%)",
  ];

  // Build storage type color map for consistent colors
  const storageTypeColorMap: Record<string, string> = {};
  (availableStorageTypes || []).forEach((st, index) => {
    storageTypeColorMap[st] = STORAGE_TYPE_COLORS[index % STORAGE_TYPE_COLORS.length];
  });

  // Prepare multi-line chart data when storage types are selected
  const multiLineChartData = (() => {
    if (selectedTrendStorageTypes.length === 0 || !trendByStorageType) {
      return chartData;
    }

    // Build a merged dataset with columns for each storage type
    const periodMap = new Map<string, Record<string, any>>();
    
    // Initialize with total data
    trendByStorageType.total.forEach(point => {
      periodMap.set(point.periodLabel, {
        month: point.periodLabel,
        total: parseFloat(point.revenue),
      });
    });

    // Add each storage type as a column
    selectedTrendStorageTypes.forEach(st => {
      const stData = trendByStorageType.byStorageType[st] || [];
      stData.forEach(point => {
        const existing = periodMap.get(point.periodLabel) || { month: point.periodLabel };
        existing[st] = parseFloat(point.revenue);
        periodMap.set(point.periodLabel, existing);
      });
    });

    // Fill in zeros for missing periods
    const result = Array.from(periodMap.values()).map(row => {
      selectedTrendStorageTypes.forEach(st => {
        if (row[st] === undefined) row[st] = 0;
      });
      return row;
    });

    return result;
  })();

  // Build dynamic chart config for storage types
  const chartConfig: Record<string, { label: string; color: string }> = {
    revenue: {
      label: "Total Revenue",
      color: "hsl(var(--primary))",
    },
    total: {
      label: "Total Revenue",
      color: "hsl(var(--muted-foreground))",
    },
  };

  selectedTrendStorageTypes.forEach(st => {
    chartConfig[st] = {
      label: st,
      color: storageTypeColorMap[st] || "hsl(var(--chart-1))",
    };
  });

  const pieChartData = storageTypeMix?.map((item, index) => ({
    name: item.storageType,
    value: parseFloat(item.totalRevenue),
    leases: item.leaseCount,
    color: STORAGE_TYPE_COLORS[index % STORAGE_TYPE_COLORS.length],
  })) || [];

  const totalStorageRevenue = pieChartData.reduce((sum, item) => sum + item.value, 0);

  // Toggle storage type selection for trend chart
  const toggleTrendStorageType = (st: string) => {
    setSelectedTrendStorageTypes(prev => 
      prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]
    );
  };

  const clearTrendStorageTypes = () => {
    setSelectedTrendStorageTypes([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-semibold text-foreground" data-testid="heading-executive-dashboard">
              Rent Roll
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Key performance metrics and trends
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DashboardNav />
          </div>
        </div>
      </div>

      <div ref={dashboardRef} className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {includedProjects && includedProjects.length > 0 && (
          <Card className="mb-8 border-2 border-primary/20 bg-primary/5" data-testid="card-included-projects">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Info className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Included Projects</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {includedProjectsViewMode === "owned-only" 
                        ? `Analytics below show data from ${includedProjects.filter(p => p.projectType === "OWNED").length} owned marina${includedProjects.filter(p => p.projectType === "OWNED").length !== 1 ? 's' : ''}`
                        : includedProjectsViewMode === "pipeline-only"
                        ? `Analytics below show data from ${includedProjects.filter(p => p.projectType === "DEAL").length} pipeline deal${includedProjects.filter(p => p.projectType === "DEAL").length !== 1 ? 's' : ''}`
                        : `Analytics below aggregate data from ${includedProjects.length} project${includedProjects.length !== 1 ? 's' : ''}`
                      }
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex bg-muted rounded-md p-0.5" data-testid="toggle-view-mode">
                    <Button
                      variant={includedProjectsViewMode === "all" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setKpiFilter({ projectType: "ALL", selectedProjectIds: null });
                      }}
                      className="h-7 px-3 text-xs"
                      data-testid="button-view-all"
                    >
                      All Projects
                    </Button>
                    <Button
                      variant={includedProjectsViewMode === "owned-only" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setKpiFilter({ projectType: "OWNED", selectedProjectIds: null });
                      }}
                      className="h-7 px-3 text-xs"
                      data-testid="button-view-owned"
                    >
                      Owned Only
                    </Button>
                    <Button
                      variant={includedProjectsViewMode === "pipeline-only" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setKpiFilter({ projectType: "DEAL", selectedProjectIds: null });
                      }}
                      className="h-7 px-3 text-xs"
                      data-testid="button-view-pipeline"
                    >
                      Pipeline Only
                    </Button>
                  </div>
                  <Badge variant="outline" className="px-3 py-1">
                    {includedProjectsViewMode === "owned-only" 
                      ? `${includedProjects.filter(p => p.projectType === "OWNED").length} Owned`
                      : includedProjectsViewMode === "pipeline-only"
                      ? `${includedProjects.filter(p => p.projectType === "DEAL").length} Pipeline`
                      : `${includedProjects.filter(p => p.projectType === "OWNED").length} Owned · ${includedProjects.filter(p => p.projectType === "DEAL").length} Pipeline`
                    }
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {includedProjectsViewMode !== "pipeline-only" && includedProjects.filter(p => p.projectType === "OWNED").length > 0 && (
                <div data-testid="section-owned-projects">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Owned</h3>
                    <Badge variant="outline" className="text-xs">
                      {includedProjects.filter(p => p.projectType === "OWNED").length}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {includedProjects
                      .filter(p => p.projectType === "OWNED")
                      .map((project) => {
                        const isSelected = kpiFilter.selectedProjectIds === null || 
                          kpiFilter.selectedProjectIds.includes(project.locationId);
                        return (
                          <div
                            key={project.locationId}
                            className="flex items-center gap-1.5 group"
                          >
                            <Checkbox
                              id={`check-${project.locationId}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  if (kpiFilter.selectedProjectIds === null) {
                                    return;
                                  }
                                  const newSelected = [...kpiFilter.selectedProjectIds, project.locationId];
                                  setKpiFilter(prev => ({
                                    ...prev,
                                    selectedProjectIds: newSelected.length === includedProjects.length ? null : newSelected
                                  }));
                                } else {
                                  const currentSelected = kpiFilter.selectedProjectIds === null
                                    ? includedProjects.map(p => p.locationId)
                                    : kpiFilter.selectedProjectIds;
                                  const newSelected = currentSelected.filter(id => id !== project.locationId);
                                  setKpiFilter(prev => ({
                                    ...prev,
                                    selectedProjectIds: newSelected
                                  }));
                                }
                              }}
                              className="h-4 w-4"
                              data-testid={`checkbox-project-${project.locationId}`}
                            />
                            <Badge 
                              variant={isSelected ? "default" : "outline"}
                              data-testid={`badge-project-${project.locationId}`}
                              className={`px-3 py-1.5 text-sm cursor-pointer transition-all ${isSelected ? 'hover-elevate active-elevate-2' : 'opacity-60'}`}
                              onClick={() => setLocation(`/rent-roll/projects/${project.locationId}`)}
                            >
                              {project.name}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              
              {includedProjectsViewMode !== "owned-only" && includedProjects.filter(p => p.projectType === "DEAL").length > 0 && (
                <div data-testid="section-pipeline-projects">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Pipeline</h3>
                    <Badge variant="outline" className="text-xs">
                      {includedProjects.filter(p => p.projectType === "DEAL").length}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {includedProjects
                      .filter(p => p.projectType === "DEAL")
                      .map((project) => {
                        const isSelected = kpiFilter.selectedProjectIds === null || 
                          kpiFilter.selectedProjectIds.includes(project.locationId);
                        return (
                          <div
                            key={project.locationId}
                            className="flex items-center gap-1.5 group"
                          >
                            <Checkbox
                              id={`check-${project.locationId}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  if (kpiFilter.selectedProjectIds === null) {
                                    return;
                                  }
                                  const newSelected = [...kpiFilter.selectedProjectIds, project.locationId];
                                  setKpiFilter(prev => ({
                                    ...prev,
                                    selectedProjectIds: newSelected.length === includedProjects.length ? null : newSelected
                                  }));
                                } else {
                                  const currentSelected = kpiFilter.selectedProjectIds === null
                                    ? includedProjects.map(p => p.locationId)
                                    : kpiFilter.selectedProjectIds;
                                  const newSelected = currentSelected.filter(id => id !== project.locationId);
                                  setKpiFilter(prev => ({
                                    ...prev,
                                    selectedProjectIds: newSelected
                                  }));
                                }
                              }}
                              className="h-4 w-4"
                              data-testid={`checkbox-project-${project.locationId}`}
                            />
                            <Badge 
                              variant={isSelected ? "secondary" : "outline"}
                              data-testid={`badge-project-${project.locationId}`}
                              className={`px-3 py-1.5 text-sm cursor-pointer transition-all ${isSelected ? 'hover-elevate active-elevate-2' : 'opacity-60'}`}
                              onClick={() => setLocation(`/rent-roll/projects/${project.locationId}`)}
                            >
                              {project.name}
                            </Badge>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              
              {/* Unified Controls Row - All filters and actions */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t" data-testid="section-global-kpi-filters">
                <div className="flex flex-wrap items-center gap-4">
                  <TimePeriodSelector value={periodFilter} onChange={handlePeriodFilterChange} />
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium text-muted-foreground">Contract Term:</Label>
                    <Select 
                      value={kpiSeasonMode} 
                      onValueChange={(v) => handleContractTermChange(v as ContractTermOccupancyMode)}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-sm" data-testid="select-global-contract-term">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="overall">Overall</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="seasonal">Seasonal</SelectItem>
                        <SelectItem value="winter">Winter</SelectItem>
                        <SelectItem value="shortTerm">Short-Term</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium text-muted-foreground">Storage Type:</Label>
                    <Select 
                      value={kpiStorageTypeFilter} 
                      onValueChange={setKpiStorageTypeFilter}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-sm" data-testid="select-global-storage-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {availableStorageTypes?.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Popover open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="gap-2 h-8"
                        data-testid="button-kpi-filter"
                      >
                        <Filter className="h-4 w-4" />
                        Filter
                        {(kpiFilter.projectType !== "ALL" || (kpiFilter.selectedProjectIds !== null && kpiFilter.selectedProjectIds.length > 0)) && (
                          <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                            {(kpiFilter.projectType !== "ALL" ? 1 : 0) + ((kpiFilter.selectedProjectIds !== null && kpiFilter.selectedProjectIds.length > 0) ? 1 : 0)}
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="start" data-testid="popover-kpi-filter">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Project Type</h4>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={kpiFilter.projectType === "ALL" ? "default" : "outline"}
                              onClick={() => setKpiFilter({ projectType: "ALL", selectedProjectIds: null })}
                              data-testid="filter-type-all"
                            >
                              All
                            </Button>
                            <Button
                              size="sm"
                              variant={kpiFilter.projectType === "OWNED" ? "default" : "outline"}
                              onClick={() => setKpiFilter({ projectType: "OWNED", selectedProjectIds: null })}
                              data-testid="filter-type-owned"
                            >
                              Owned
                            </Button>
                            <Button
                              size="sm"
                              variant={kpiFilter.projectType === "DEAL" ? "default" : "outline"}
                              onClick={() => setKpiFilter({ projectType: "DEAL", selectedProjectIds: null })}
                              data-testid="filter-type-pipeline"
                            >
                              Pipeline
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm">Select Projects</h4>
                            {kpiFilter.selectedProjectIds !== null && kpiFilter.selectedProjectIds.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => setKpiFilter(prev => ({ ...prev, selectedProjectIds: null }))}
                                data-testid="button-clear-selection"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {includedProjects?.filter(p => 
                              kpiFilter.projectType === "ALL" || p.projectType === kpiFilter.projectType
                            ).map(project => {
                              const isSelected = kpiFilter.selectedProjectIds === null || 
                                kpiFilter.selectedProjectIds.includes(project.locationId);
                              return (
                                <div 
                                  key={project.locationId}
                                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                  onClick={() => {
                                    setKpiFilter(prev => {
                                      if (prev.selectedProjectIds === null) {
                                        const allIds = includedProjects.map(p => p.locationId);
                                        return {
                                          ...prev,
                                          selectedProjectIds: allIds.filter(id => id !== project.locationId)
                                        };
                                      }
                                      const wasSelected = prev.selectedProjectIds.includes(project.locationId);
                                      const newSelected = wasSelected
                                        ? prev.selectedProjectIds.filter(id => id !== project.locationId)
                                        : [...prev.selectedProjectIds, project.locationId];
                                      return {
                                        ...prev,
                                        selectedProjectIds: newSelected.length === includedProjects.length ? null : newSelected
                                      };
                                    });
                                  }}
                                  data-testid={`filter-project-${project.locationId}`}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      setKpiFilter(prev => {
                                        if (checked) {
                                          if (prev.selectedProjectIds === null) return prev;
                                          const newSelected = [...prev.selectedProjectIds, project.locationId];
                                          return {
                                            ...prev,
                                            selectedProjectIds: newSelected.length === includedProjects.length ? null : newSelected
                                          };
                                        } else {
                                          const currentSelected = prev.selectedProjectIds === null
                                            ? includedProjects.map(p => p.locationId)
                                            : prev.selectedProjectIds;
                                          return {
                                            ...prev,
                                            selectedProjectIds: currentSelected.filter(id => id !== project.locationId)
                                          };
                                        }
                                      });
                                    }}
                                  />
                                  <div className="flex-1">
                                    <span className="text-sm">{project.name}</span>
                                  </div>
                                  <Badge 
                                    variant={project.projectType === "OWNED" ? "default" : "secondary"} 
                                    className="text-xs h-5"
                                  >
                                    {project.projectType === "OWNED" ? "Owned" : "Pipeline"}
                                  </Badge>
                                </div>
                              );
                            })}
                            {includedProjects?.filter(p => 
                              kpiFilter.projectType === "ALL" || p.projectType === kpiFilter.projectType
                            ).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No projects match the selected type
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex justify-between pt-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setKpiFilter({ projectType: "ALL", selectedProjectIds: [] });
                            }}
                            data-testid="button-reset-filters"
                          >
                            Reset All
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setFilterDialogOpen(false)}
                            data-testid="button-apply-filters"
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isExporting} className="h-8" data-testid="button-export">
                        {isExporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Export
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleExportPNG} data-testid="menu-export-png">
                        <FileImage className="h-4 w-4 mr-2" />
                        Export as PNG
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    onClick={() => setAddDialogOpen(true)}
                    data-testid="button-add-rent-roll"
                    className="gap-2 h-8"
                  >
                    <Plus className="h-4 w-4" />
                    Add Rent Roll
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {metricsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card 
                data-testid="card-total-storage-revenue" 
                className="hover-elevate cursor-pointer"
                onClick={() => setRevenueModalOpen(true)}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Storage Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-storage-revenue">
                    {formatCurrency(metrics?.totalStorageRevenue || metrics?.totalRevenue || "0")}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sum of active leases
                  </p>
                </CardContent>
              </Card>

              <Card 
                data-testid="card-active-leases"
                className="hover-elevate cursor-pointer"
                onClick={() => setLeasesModalOpen(true)}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Leases</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="value-active-leases">
                    {metrics?.activeLeases || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    of {metrics?.totalLeases || 0} total
                  </p>
                </CardContent>
              </Card>

              <Card 
                data-testid="card-occupancy-rate"
                className="hover-elevate"
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Occupancy</CardTitle>
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {contractTermOccupancyLoading ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  ) : contractTermOccupancy ? (
                    (() => {
                      const metric = contractTermOccupancy.occupancy[kpiSeasonMode];
                      if (!metric) {
                        return (
                          <>
                            <div className="text-2xl font-bold text-muted-foreground" data-testid="value-occupancy-rate">
                              N/A
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              No {kpiSeasonMode} data
                            </p>
                          </>
                        );
                      }
                      return (
                        <>
                          <div className="text-2xl font-bold" data-testid="value-occupancy-rate">
                            {metric.percentage.toFixed(1)}%
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {metric.numerator} / {metric.denominator}
                          </p>
                        </>
                      );
                    })()
                  ) : (
                    <div className="text-2xl font-bold" data-testid="value-occupancy-rate">
                      {formatPercent(metrics?.occupancyRate || 0)}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card 
                data-testid="card-average-lease"
                className="hover-elevate cursor-pointer"
                onClick={() => setAvgLeaseValueModalOpen(true)}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Lease Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="value-average-lease">
                    {formatCurrency(metrics?.averageLeaseValue || "0")}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per active lease
                  </p>
                </CardContent>
              </Card>

              <Card 
                data-testid="card-avg-boat-size"
                className="hover-elevate cursor-pointer"
                onClick={() => setAvgBoatSizeModalOpen(true)}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Boat Size</CardTitle>
                  <Ship className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {avgBoatSizeLoading ? (
                    <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                  ) : avgBoatSize ? (
                    (() => {
                      // Map kpiSeasonMode to AvgBoatSizeMetrics keys (doesn't have shortTerm)
                      const boatSizeKey = kpiSeasonMode === "shortTerm" ? undefined : kpiSeasonMode;
                      const metric = boatSizeKey === "overall" 
                        ? avgBoatSize.overall 
                        : boatSizeKey ? avgBoatSize[boatSizeKey] : undefined;
                      if (!metric) {
                        return (
                          <>
                            <div className="text-2xl font-bold text-muted-foreground" data-testid="value-avg-boat-size">
                              N/A
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              No {kpiSeasonMode} boats
                            </p>
                          </>
                        );
                      }
                      return (
                        <>
                          <div className="text-2xl font-bold" data-testid="value-avg-boat-size">
                            {metric.avgLength} ft
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {metric.boatCount} boats
                          </p>
                        </>
                      );
                    })()
                  ) : (
                    <div className="text-2xl font-bold text-muted-foreground" data-testid="value-avg-boat-size">
                      N/A
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card 
                data-testid="card-move-ins"
                className="cursor-pointer hover-elevate active-elevate-2"
                onClick={() => handleOpenMoveEventsModal("move-in")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Move-Ins</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="value-move-ins">
                    {metrics?.totalMoveIns || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {label}
                  </p>
                </CardContent>
              </Card>

              <Card 
                data-testid="card-move-outs"
                className="cursor-pointer hover-elevate active-elevate-2"
                onClick={() => handleOpenMoveEventsModal("move-out")}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Move-Outs</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600" data-testid="value-move-outs">
                    {metrics?.totalMoveOuts || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {label}
                  </p>
                </CardContent>
              </Card>

              <Card 
                data-testid="card-net-change"
                className="cursor-pointer hover-elevate active-elevate-2"
                onClick={() => {
                  const netChange = metrics?.netMoveChange || 0;
                  handleOpenMoveEventsModal(netChange >= 0 ? "move-in" : "move-out");
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Net Change</CardTitle>
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div 
                    className={`text-2xl font-bold ${
                      (metrics?.netMoveChange || 0) >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                    data-testid="value-net-change"
                  >
                    {metrics?.netMoveChange && metrics.netMoveChange > 0 ? "+" : ""}
                    {metrics?.netMoveChange || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {label}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              <Card data-testid="card-revenue-trend">
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle>Storage Revenue Trend</CardTitle>
                    <CardDescription>Monthly storage revenue (slip/dock fees only, excludes ancillary)</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedTrendStorageTypes.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearTrendStorageTypes}
                        className="h-8 px-2"
                        data-testid="button-clear-storage-types"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="gap-2"
                          data-testid="button-compare-storage-types"
                        >
                          <Filter className="h-3 w-3" />
                          Compare
                          {selectedTrendStorageTypes.length > 0 && (
                            <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                              {selectedTrendStorageTypes.length}
                            </Badge>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3" align="end">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Compare Storage Types</Label>
                            {selectedTrendStorageTypes.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearTrendStorageTypes}
                                className="h-6 px-2 text-xs"
                              >
                                Clear all
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Select storage types to compare their revenue trends
                          </p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {(availableStorageTypes || []).map((st) => (
                              <div key={st} className="flex items-center gap-2">
                                <Checkbox
                                  id={`trend-st-${st}`}
                                  checked={selectedTrendStorageTypes.includes(st)}
                                  onCheckedChange={() => toggleTrendStorageType(st)}
                                  data-testid={`checkbox-storage-type-${st}`}
                                />
                                <label
                                  htmlFor={`trend-st-${st}`}
                                  className="flex-1 text-sm cursor-pointer flex items-center gap-2"
                                >
                                  <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: storageTypeColorMap[st] || STORAGE_TYPE_COLORS[0] }}
                                  />
                                  {st}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent>
                  {(trendLoading || (selectedTrendStorageTypes.length > 0 && trendByStorageLoading)) ? (
                    <div className="h-80 flex items-center justify-center">
                      <div className="animate-pulse text-muted-foreground">Loading chart...</div>
                    </div>
                  ) : multiLineChartData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No revenue data available for selected period
                    </div>
                  ) : (
                    <ChartContainer config={chartConfig} className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={multiLineChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 12 }}
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value, name) => [
                                  formatCurrency(value as number),
                                  chartConfig[name as string]?.label || name
                                ]}
                              />
                            }
                          />
                          <Legend />
                          {selectedTrendStorageTypes.length === 0 ? (
                            <Line 
                              type="monotone" 
                              dataKey="revenue" 
                              stroke="var(--color-revenue)" 
                              strokeWidth={2}
                              name="Revenue"
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          ) : (
                            <>
                              <Line 
                                type="monotone" 
                                dataKey="total" 
                                stroke="hsl(var(--muted-foreground))" 
                                strokeWidth={1}
                                strokeDasharray="5 5"
                                name="Total"
                                dot={false}
                              />
                              {selectedTrendStorageTypes.map((st) => (
                                <Line 
                                  key={st}
                                  type="monotone" 
                                  dataKey={st} 
                                  stroke={storageTypeColorMap[st] || STORAGE_TYPE_COLORS[0]}
                                  strokeWidth={2}
                                  name={st}
                                  dot={{ r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                              ))}
                            </>
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-storage-mix">
                <CardHeader>
                  <CardTitle>Storage Revenue by Type</CardTitle>
                  <CardDescription>Storage revenue distribution (excludes ancillary fees)</CardDescription>
                </CardHeader>
                <CardContent>
                  {mixLoading ? (
                    <div className="h-80 flex items-center justify-center">
                      <div className="animate-pulse text-muted-foreground">Loading chart...</div>
                    </div>
                  ) : pieChartData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No storage type data available
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => 
                              `${name}: ${(percent * 100).toFixed(1)}%`
                            }
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-card border rounded-lg shadow-lg p-3">
                                    <p className="font-semibold text-sm">{data.name}</p>
                                    <p className="text-sm">
                                      Revenue: {formatCurrency(data.value)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {data.leases} {data.leases === 1 ? "lease" : "leases"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {((data.value / totalStorageRevenue) * 100).toFixed(1)}% of total
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Ancillary and Transient Revenue Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              <Card data-testid="card-ancillary-revenue-trend">
                <CardHeader>
                  <CardTitle>Ancillary Revenue Trend</CardTitle>
                  <CardDescription>Electric, liveaboard, and other fees by month</CardDescription>
                </CardHeader>
                <CardContent>
                  {ancillaryTrendLoading ? (
                    <div className="h-80 flex items-center justify-center">
                      <div className="animate-pulse text-muted-foreground">Loading chart...</div>
                    </div>
                  ) : !ancillaryTrendData || ancillaryTrendData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No ancillary revenue data available
                    </div>
                  ) : (
                    <ChartContainer config={{
                      electric: { label: "Electric", color: "hsl(200, 70%, 50%)" },
                      liveaboard: { label: "Liveaboard", color: "hsl(142, 70%, 45%)" },
                      other: { label: "Other", color: "hsl(280, 70%, 50%)" },
                    }} className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ancillaryTrendData.map(d => ({
                          month: d.periodLabel,
                          electric: parseFloat(d.electricRevenue),
                          liveaboard: parseFloat(d.liveaboardRevenue),
                          other: parseFloat(d.otherRevenue),
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 12 }}
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value, name) => [
                                  formatCurrency(value as number),
                                  name === "electric" ? "Electric" : name === "liveaboard" ? "Liveaboard" : "Other"
                                ]}
                              />
                            }
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="electric" 
                            stroke="hsl(200, 70%, 50%)" 
                            strokeWidth={2}
                            name="Electric"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="liveaboard" 
                            stroke="hsl(142, 70%, 45%)" 
                            strokeWidth={2}
                            name="Liveaboard"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="other" 
                            stroke="hsl(280, 70%, 50%)" 
                            strokeWidth={2}
                            name="Other"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-transient-revenue-trend">
                <CardHeader>
                  <CardTitle>Transient Revenue Trend</CardTitle>
                  <CardDescription>Short-term (daily, weekly, monthly) storage revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  {transientTrendLoading ? (
                    <div className="h-80 flex items-center justify-center">
                      <div className="animate-pulse text-muted-foreground">Loading chart...</div>
                    </div>
                  ) : !transientTrendData || transientTrendData.length === 0 ? (
                    <div className="h-80 flex items-center justify-center text-muted-foreground">
                      No transient revenue data available
                    </div>
                  ) : (
                    <ChartContainer config={{
                      transient: { label: "Transient Revenue", color: "hsl(25, 95%, 53%)" },
                    }} className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={transientTrendData.map(d => ({
                          month: d.periodLabel,
                          transient: parseFloat(d.revenue),
                          leases: d.leaseCount,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 12 }}
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value, name, props) => {
                                  if (name === "transient") {
                                    return [formatCurrency(value as number), "Transient Revenue"];
                                  }
                                  return [value, name];
                                }}
                              />
                            }
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="transient" 
                            stroke="hsl(25, 95%, 53%)" 
                            strokeWidth={2}
                            name="Transient Revenue"
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-rent-roll" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {addDialogStep === 1 && "Add New Rent Roll"}
              {addDialogStep === 2 && "Select Project Type"}
              {addDialogStep === 3 && "Project Details"}
            </DialogTitle>
            <DialogDescription data-testid="text-dialog-description">
              {addDialogStep === 1 && "Step 1 of 3: Enter your project name"}
              {addDialogStep === 2 && "Step 2 of 3: Choose the project type"}
              {addDialogStep === 3 && "Step 3 of 3: Complete the project details"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-center gap-2 py-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-2 w-12 rounded-full transition-colors ${
                  step <= addDialogStep ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddProject)} className="space-y-4 py-4">
              {addDialogStep === 1 && (
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Marina A - Downtown Location"
                          data-testid="input-project-name"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {addDialogStep === 2 && (
                <FormField
                  control={form.control}
                  name="projectType"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel>Project Type *</FormLabel>
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                            field.value === "OWNED"
                              ? "border-primary bg-primary/5"
                              : "border-muted hover-elevate"
                          }`}
                          onClick={() => field.onChange("OWNED")}
                          data-testid="select-type-owned"
                        >
                          <div className="flex flex-col items-center gap-2 text-center">
                            <Building2 className={`h-8 w-8 ${field.value === "OWNED" ? "text-primary" : "text-muted-foreground"}`} />
                            <div className="font-medium">My Marina</div>
                            <div className="text-xs text-muted-foreground">Actively managed property</div>
                          </div>
                        </div>
                        <div
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                            field.value === "DEAL"
                              ? "border-primary bg-primary/5"
                              : "border-muted hover-elevate"
                          }`}
                          onClick={() => field.onChange("DEAL")}
                          data-testid="select-type-deal"
                        >
                          <div className="flex flex-col items-center gap-2 text-center">
                            <TrendingUp className={`h-8 w-8 ${field.value === "DEAL" ? "text-primary" : "text-muted-foreground"}`} />
                            <div className="font-medium">Deal Pipeline</div>
                            <div className="text-xs text-muted-foreground">Property under evaluation</div>
                          </div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {addDialogStep === 3 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief description of the marina"
                            data-testid="input-project-description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select value={field.value || ""} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-project-status">
                                <SelectValue placeholder="Select status..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Operating">Operating</SelectItem>
                              <SelectItem value="Analyzing">Analyzing</SelectItem>
                              <SelectItem value="Under LOI">Under LOI</SelectItem>
                              <SelectItem value="Due Diligence">Due Diligence</SelectItem>
                              <SelectItem value="Closed">Closed</SelectItem>
                              <SelectItem value="On Hold">On Hold</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="operationType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Operation Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-operation-type">
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ANNUAL">Year-Round</SelectItem>
                              <SelectItem value="SEASONAL">Seasonal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <FormLabel>Storage Types</FormLabel>
                    <p className="text-xs text-muted-foreground">Select storage types and set unit count and target occupancy for each</p>
                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                      {STORAGE_TYPES.map((storageType) => {
                        const configs = form.watch("storageTypeConfigs") || [];
                        const existingConfig = configs.find((c) => c.storageType === storageType);
                        const isSelected = !!existingConfig;

                        const toggleStorageType = () => {
                          const currentConfigs = form.getValues("storageTypeConfigs") || [];
                          if (isSelected) {
                            form.setValue(
                              "storageTypeConfigs",
                              currentConfigs.filter((c) => c.storageType !== storageType)
                            );
                          } else {
                            form.setValue("storageTypeConfigs", [
                              ...currentConfigs,
                              { storageType, unitCount: null, targetOccupancy: "" },
                            ]);
                          }
                        };

                        const updateConfig = (field: "unitCount" | "targetOccupancy", value: string) => {
                          const currentConfigs = form.getValues("storageTypeConfigs") || [];
                          const updatedConfigs = currentConfigs.map((c) => {
                            if (c.storageType === storageType) {
                              if (field === "unitCount") {
                                return { ...c, unitCount: value === "" ? null : parseInt(value) };
                              } else {
                                const numericValue = value.replace(/[^0-9]/g, "");
                                const formatted = numericValue ? `${numericValue}%` : "";
                                return { ...c, targetOccupancy: formatted };
                              }
                            }
                            return c;
                          });
                          form.setValue("storageTypeConfigs", updatedConfigs);
                        };

                        return (
                          <div
                            key={storageType}
                            className={`rounded-lg border p-3 transition-colors ${
                              isSelected ? "border-primary bg-primary/5" : "border-muted"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={toggleStorageType}
                                data-testid={`checkbox-storage-${storageType.toLowerCase().replace(/\s+/g, "-")}`}
                              />
                              <span className="font-medium text-sm flex-1">{storageType}</span>
                              {isSelected && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    placeholder="Units"
                                    className="w-20 h-8 text-sm"
                                    value={existingConfig?.unitCount ?? ""}
                                    onChange={(e) => updateConfig("unitCount", e.target.value)}
                                    data-testid={`input-units-${storageType.toLowerCase().replace(/\s+/g, "-")}`}
                                  />
                                  <Input
                                    type="text"
                                    placeholder="e.g. 90%"
                                    className="w-24 h-8 text-sm"
                                    value={existingConfig?.targetOccupancy ?? ""}
                                    onChange={(e) => updateConfig("targetOccupancy", e.target.value)}
                                    data-testid={`input-occupancy-${storageType.toLowerCase().replace(/\s+/g, "-")}`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="includeInExecutive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-include-executive"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            Include in Executive Dashboard
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Show this project in executive-level analytics and reports
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                {addDialogStep === 1 && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const name = form.getValues("name");
                        if (name.trim()) {
                          setAddDialogStep(2);
                        } else {
                          form.setError("name", { message: "Project name is required" });
                        }
                      }}
                      disabled={!form.watch("name").trim()}
                      data-testid="button-next-step"
                    >
                      Next
                    </Button>
                  </>
                )}

                {addDialogStep === 2 && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddDialogStep(1)}
                      data-testid="button-back"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setAddDialogStep(3)}
                      data-testid="button-next-step"
                    >
                      Next
                    </Button>
                  </>
                )}

                {addDialogStep === 3 && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddDialogStep(2)}
                      data-testid="button-back"
                      disabled={createProjectMutation.isPending}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={createProjectMutation.isPending || isCheckingDuplicate}
                      data-testid="button-create"
                    >
                      {(createProjectMutation.isPending || isCheckingDuplicate) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {isCheckingDuplicate ? "Checking..." : createProjectMutation.isPending ? "Creating..." : "Add Project"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-duplicate-project">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-amber-500" />
              Project Already Exists
            </DialogTitle>
            <DialogDescription>
              A project named "{duplicateInfo?.name}" already exists.
              {canModifyDuplicate 
                ? " What would you like to do?"
                : " This project belongs to another organization. You can only choose a different name."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={handleDuplicateRename}
              disabled={isReplacing}
              data-testid="button-duplicate-rename"
            >
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="font-medium">Rename</div>
                <div className="text-sm text-muted-foreground">Go back and choose a different name</div>
              </div>
            </Button>
            
            {canModifyDuplicate && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={handleDuplicateMerge}
                  disabled={isReplacing}
                  data-testid="button-duplicate-merge"
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">Add to Existing</div>
                    <div className="text-sm text-muted-foreground">Open the existing project and import data there</div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 border-destructive/50 hover:bg-destructive/5"
                  onClick={handleDuplicateReplace}
                  disabled={isReplacing}
                  data-testid="button-duplicate-replace"
                >
                  <X className="h-5 w-5 text-destructive" />
                  <div className="text-left">
                    <div className="font-medium text-destructive">Replace</div>
                    <div className="text-sm text-muted-foreground">Delete the existing project and create a new one</div>
                  </div>
                  {isReplacing && (
                    <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                  )}
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={handleDuplicateCancel}
              disabled={isReplacing}
              data-testid="button-duplicate-cancel"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent data-testid="dialog-remove-project">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Executive Summary?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the project from the executive summary calculations. 
              The project data will remain intact and can be re-included at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveProject}
              data-testid="button-confirm-remove"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MoveEventsModal
        isOpen={moveEventsModalOpen}
        onClose={() => setMoveEventsModalOpen(false)}
        eventType={moveEventType}
        startDate={startDate}
        endDate={endDate}
        initialTimePeriod={periodFilter}
      />

      <TotalRevenueModal
        open={revenueModalOpen}
        onClose={() => setRevenueModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
        initialTimePeriod={periodFilter}
      />

      <ActiveLeasesModal
        open={leasesModalOpen}
        onClose={() => setLeasesModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
        initialTimePeriod={periodFilter}
      />

      <OccupancyRateModal
        open={occupancyModalOpen}
        onClose={() => setOccupancyModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
        initialTimePeriod={periodFilter}
      />

      <AvgLeaseValueModal
        open={avgLeaseValueModalOpen}
        onClose={() => setAvgLeaseValueModalOpen(false)}
        startDate={startDate}
        endDate={endDate}
        initialTimePeriod={periodFilter}
      />

      <AvgBoatSizeModal
        open={avgBoatSizeModalOpen}
        onClose={() => setAvgBoatSizeModalOpen(false)}
        initialMode={kpiSeasonMode === "shortTerm" ? "overall" : kpiSeasonMode}
        projectType={kpiFilter.projectType}
        selectedProjectIds={kpiFilter.selectedProjectIds}
      />
    </div>
  );
}
