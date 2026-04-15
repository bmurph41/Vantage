import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Plus, Upload, ArrowLeft, ChevronsUpDown, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import DashboardNav from "../components/navigation/DashboardNav";
import RentRollSummaryCards from "../components/rent-roll/RentRollSummaryCards";
import RentRollCashFlowGrid from "../components/rent-roll/RentRollCashFlowGrid";
import LeasesTable from "../components/rent-roll/LeasesTable";
import AddressHeatMapTable from "../components/rent-roll/AddressHeatMapTable";
import LeaseFormDrawer from "../components/rent-roll/LeaseFormDrawer";
import FileImportDrawer from "../components/rent-roll/FileImportDrawer";
import ProjectOverview from "../components/rent-roll/ProjectOverview";
import { ProjectDetailsTab } from "../components/rent-roll/ProjectDetailsTab";
import UploadedFilesTab from "../components/rent-roll/UploadedFilesTab";
import { OccupancyTrendCharts } from "../components/rent-roll/OccupancyTrendCharts";
import { SeasonalRateComparison } from "../components/rent-roll/SeasonalRateComparison";
import { LeaseExpirationCalendar } from "../components/rent-roll/LeaseExpirationCalendar";
import { RenewalRemindersPanel } from "../components/rent-roll/RenewalRemindersPanel";
import { type TimePeriodFilter, type TimePeriodType, getAvailableMonths, getAvailableQuarters } from "@shared/timePeriodUtils";
import { deleteLocation } from "../lib/locationApi";
import RVParkAnalyticsPanel from "../components/rent-roll/RVParkAnalyticsPanel";
import IndustrialAnalyticsPanel from "../components/rent-roll/IndustrialAnalyticsPanel";
import CAMReconciliationPanel from "../components/rent-roll/CAMReconciliationPanel";
import { Warehouse, TentTree, Building2 as Building2Icon, Home, Hotel, DollarSign, RefreshCw } from "lucide-react";
import HotelAnalyticsPanel from "../components/rent-roll/HotelAnalyticsPanel";
import MultifamilyAnalyticsPanel from "../components/rent-roll/MultifamilyAnalyticsPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";

interface MarinaLocation {
  id: string;
  name: string;
  code: string | null;
  projectType: "OWNED" | "DEAL";
  status: string | null;
  charge1Label: string | null;
  charge2Label: string | null;
  charge3Label: string | null;
  seasonStartDate: string | null;
  seasonEndDate: string | null;
  winterStartDate: string | null;
  winterEndDate: string | null;
}

export default function RentRollDashboard() {
  const params = useParams<{ locationId?: string; id?: string }>();
  // Support both /rent-roll/:locationId and /projects/:id URL patterns
  const locationId = params.locationId || params.id || null;
  const [currentPath, setCurrentPath] = useLocation();
  
  // Parse URL query params for filters passed from Executive Dashboard KPI modals
  // Use window.location.search since wouter's useLocation doesn't include query string
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const urlTab = urlParams.get("tab");
  const urlLeaseId = urlParams.get("lease");
  const urlStartDate = urlParams.get("startDate");
  const urlEndDate = urlParams.get("endDate");
  const urlStorageTypes = urlParams.get("storageTypes");
  
  // Detect if we're inside a project layout (no need to show our own header)
  const isInsideProjectLayout = currentPath.startsWith("/projects/");

  // Fetch location details if locationId is provided
  const { data: locationData, isLoading: locationLoading } = useQuery<MarinaLocation>({
    queryKey: ['/api/rent-roll/locations', locationId],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/locations/${locationId}`);
      if (!response.ok) throw new Error('Failed to fetch location');
      return response.json();
    },
    enabled: !!locationId,
  });

  // Fetch auto-sync status for the header badge
  const { data: syncStatus } = useQuery<{ autoSyncEnabled: boolean; lastSyncAt: string | null; source: string | null }>({
    queryKey: ['/api/rent-roll/locations', locationId, 'sync-status'],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/locations/${locationId}/sync-status`);
      if (!response.ok) return { autoSyncEnabled: false, lastSyncAt: null, source: null };
      return response.json();
    },
    enabled: !!locationId,
    staleTime: 30_000,
  });

  // Fetch all locations for quick-switcher
  const { data: allLocations } = useQuery<MarinaLocation[]>({
    queryKey: ['/api/rent-roll/locations'],
    queryFn: async () => {
      const response = await fetch('/api/rent-roll/locations');
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    },
  });
  const { toast } = useToast();
  // Initialize activeTab from URL params or default to "overview"
  const [activeTab, setActiveTab] = useState(urlTab || "overview");
  const [isLeaseDrawerOpen, setIsLeaseDrawerOpen] = useState(false);
  // Initialize selectedLeaseId from URL params if present
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(urlLeaseId);
  // Initialize storage type filters from URL params
  const [storageTypeFilters, setStorageTypeFilters] = useState<string[]>(
    urlStorageTypes ? urlStorageTypes.split(",") : []
  );
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);
  const [isEditNameDialogOpen, setIsEditNameDialogOpen] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<TimePeriodFilter>({
    type: "TTM",
  });
  const [analyticsAssetClass, setAnalyticsAssetClass] = useState<string>("general");
  const [isMarketRentDrawerOpen, setIsMarketRentDrawerOpen] = useState(false);
  const [marketRentUpdates, setMarketRentUpdates] = useState<{ unitType: string; marketRent: string }[]>([
    { unitType: "Studio", marketRent: "" },
    { unitType: "1BR/1BA", marketRent: "" },
    { unitType: "2BR/2BA", marketRent: "" },
    { unitType: "3BR/2BA", marketRent: "" },
  ]);

  // Effect to handle URL param changes (from KPI modal navigation)
  // Runs on mount and whenever currentPath changes (includes query string changes)
  useEffect(() => {
    // Re-parse URL params on effect run (window.location is current)
    const currentUrlParams = new URLSearchParams(window.location.search);
    const tab = currentUrlParams.get("tab");
    const leaseId = currentUrlParams.get("lease");
    const storageTypes = currentUrlParams.get("storageTypes");
    
    // Switch to leases tab if specified in URL
    if (tab) {
      setActiveTab(tab);
    }
    // Open lease drawer if specific lease is specified
    if (leaseId) {
      setSelectedLeaseId(leaseId);
      setIsLeaseDrawerOpen(true);
    }
    // Update storage type filters if specified in URL
    if (storageTypes) {
      const types = storageTypes.split(",");
      setStorageTypeFilters(types);
    }
  }, [locationId, currentPath]);

  const currentYear = new Date().getFullYear();
  
  // Fetch available years from lease data for period selector
  const { data: availableYears = [currentYear] } = useQuery<number[]>({
    queryKey: ['/api/rent-roll/available-years', { locationId: locationId || undefined }],
    enabled: true,
  });
  
  const availableMonths = getAvailableMonths();
  const availableQuarters = getAvailableQuarters();

  const handlePeriodTypeChange = (type: TimePeriodType) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3);

    let newFilter: TimePeriodFilter;
    
    if (type === "Year") {
      newFilter = { type, year: currentYear };
    } else if (type === "Month") {
      newFilter = { type, year: currentYear, month: currentMonth };
    } else if (type === "Quarter") {
      newFilter = { type, year: currentYear, quarter: currentQuarter };
    } else {
      newFilter = { type };
    }
    
    setPeriodFilter(newFilter);
  };

  const handlePeriodYearChange = (year: string) => {
    setPeriodFilter({ ...periodFilter, year: parseInt(year) });
  };

  const handlePeriodMonthChange = (month: string) => {
    setPeriodFilter({ ...periodFilter, month: parseInt(month) });
  };

  const handlePeriodQuarterChange = (quarter: string) => {
    setPeriodFilter({ ...periodFilter, quarter: parseInt(quarter) });
  };

  const updateNameMutation = useMutation({
    mutationFn: async (newName: string) => {
      const response = await fetch(`/api/rent-roll/locations/${locationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update project name");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations', locationId] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      toast({
        title: "Success",
        description: "Project name updated successfully",
      });
      setIsEditNameDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project name",
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => deleteLocation(locationId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/included-projects'] });
      toast({
        title: "Project deleted",
        description: "The project has been permanently deleted",
      });
      setIsDeleteDialogOpen(false);
      setCurrentPath("/rent-roll");
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot delete project",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  const marketRentUpdateMutation = useMutation({
    mutationFn: (updates: { unitType: string; marketRent: number }[]) =>
      apiRequest('POST', `/api/rent-roll/locations/${locationId}/market-rents/bulk-update`, { updates }),
    onSuccess: () => {
      toast({ title: "Market rents updated", description: "Bulk market rents have been saved." });
      setIsMarketRentDrawerOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update market rents", variant: "destructive" });
    },
  });

  const handleEditName = () => {
    if (locationData) {
      setEditedName(locationData.name || "");
      setIsEditNameDialogOpen(true);
    }
  };

  const handleSaveProjectName = () => {
    if (editedName.trim()) {
      updateNameMutation.mutate(editedName.trim());
    }
  };

  const handleDeleteProject = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteProject = () => {
    deleteProjectMutation.mutate();
  };

  const handleEditLease = (leaseId: string) => {
    setSelectedLeaseId(leaseId);
    setIsLeaseDrawerOpen(true);
  };

  const handleNewLease = () => {
    setSelectedLeaseId(null);
    setIsLeaseDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsLeaseDrawerOpen(false);
    setSelectedLeaseId(null);
  };


  return (
    <div className={isInsideProjectLayout ? "" : "min-h-screen bg-background"}>
      {/* Header - only show when NOT inside ProjectLayout */}
      {!isInsideProjectLayout && (
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex-1">
                {locationId && locationData ? (
                  <>
                    <div className="flex items-center gap-2 mb-6">
                      <Link href="/rent-roll">
                        <Button variant="ghost" size="sm" data-testid="button-back-to-projects">
                          <ArrowLeft className="w-4 h-4 mr-1" />
                          All Projects
                        </Button>
                      </Link>
                      {allLocations && allLocations.length > 1 && (
                        <Select
                          value={locationId}
                          onValueChange={(value) => setCurrentPath(`/rent-roll/${value}`)}
                        >
                          <SelectTrigger className="w-[200px] h-8" data-testid="select-project-switcher">
                            <ChevronsUpDown className="h-4 w-4 opacity-50 mr-2" />
                            <SelectValue placeholder="Switch project..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allLocations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id} data-testid={`select-item-${loc.id}`}>
                                {loc.name} {loc.code ? `(${loc.code})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl font-semibold text-foreground" data-testid="text-location-name">
                        {locationData.name}
                      </h1>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleEditName}
                        data-testid="button-edit-project-name"
                        className="h-8 w-8"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDeleteProject}
                        data-testid="button-delete-project"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {locationData.code && (
                        <Badge variant="outline" data-testid="badge-location-code">{locationData.code}</Badge>
                      )}
                      <Badge 
                        variant={locationData.projectType === "OWNED" ? "default" : "secondary"}
                        data-testid="badge-project-type"
                      >
                        {locationData.projectType}
                      </Badge>
                      {locationData.status && (
                        <Badge variant="outline" data-testid="badge-location-status">{locationData.status}</Badge>
                      )}
                      {syncStatus && (
                        <Badge
                          variant={syncStatus.autoSyncEnabled ? "default" : "outline"}
                          className={syncStatus.autoSyncEnabled ? "bg-green-600 hover:bg-green-700 text-white gap-1" : "text-muted-foreground gap-1"}
                          data-testid="badge-sync-status"
                          title={syncStatus.lastSyncAt ? `Last synced: ${new Date(syncStatus.lastSyncAt).toLocaleString()}` : "Auto-sync not configured"}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {syncStatus.autoSyncEnabled ? "Auto-Sync On" : "Auto-Sync Off"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Detailed lease analysis and management
                    </p>
                  </>
                ) : locationId && locationLoading ? (
                  <>
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-10 w-96" />
                  </>
                ) : (
                  <>
                    <h1 className="text-3xl font-semibold text-foreground">Rent Roll</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Key performance metrics and trends
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="default" data-testid="button-export">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button variant="outline" size="default" onClick={() => setIsImportDrawerOpen(true)} data-testid="button-import">
                  <Upload className="w-4 h-4" />
                  Import
                </Button>
                <Button onClick={handleNewLease} data-testid="button-add-lease">
                  <Plus className="w-4 h-4" />
                  Add Lease
                </Button>
              </div>
            </div>
            <DashboardNav />
          </div>
        </div>
      )}
      
      {/* Action buttons when inside ProjectLayout */}
      {isInsideProjectLayout && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="default" data-testid="button-export">
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button variant="outline" size="default" onClick={() => setIsImportDrawerOpen(true)} data-testid="button-import">
              <Upload className="w-4 h-4" />
              Import
            </Button>
            <Button onClick={handleNewLease} data-testid="button-add-lease">
              <Plus className="w-4 h-4" />
              Add Lease
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TabsList className="bg-muted p-1 justify-start flex-wrap" data-testid="tabs-navigation">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              {locationId && <TabsTrigger value="details" data-testid="tab-details">Project Setup</TabsTrigger>}
              <TabsTrigger value="cash-flows" data-testid="tab-cash-flows">Cash Flows</TabsTrigger>
              <TabsTrigger value="leases" data-testid="tab-leases">Leases</TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
              <TabsTrigger value="lease-management" data-testid="tab-lease-management">Lease Management</TabsTrigger>
              <TabsTrigger value="heat-map" data-testid="tab-heat-map">Heat Map</TabsTrigger>
              {locationId && <TabsTrigger value="files" data-testid="tab-files">Uploaded Files</TabsTrigger>}
            </TabsList>
            {activeTab === "overview" && locationId && (
              <div className="flex items-center gap-2 lg:justify-self-end">
                <Label htmlFor="inline-period-type" className="text-sm whitespace-nowrap">Period Type</Label>
                <Select value={periodFilter.type} onValueChange={handlePeriodTypeChange}>
                  <SelectTrigger id="inline-period-type" data-testid="select-period-type" className="w-[220px] h-9">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TTM">Trailing Twelve Months</SelectItem>
                    <SelectItem value="Year">Year</SelectItem>
                    <SelectItem value="Month">Month</SelectItem>
                    <SelectItem value="Quarter">Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {/* Supplemental Period Fields */}
          {activeTab === "overview" && locationId && periodFilter.type !== "TTM" && (
            <div className="flex flex-wrap items-center gap-3">
              {periodFilter.type === "Year" && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="inline-year-select" className="text-sm">Year</Label>
                  <Select value={periodFilter.year?.toString()} onValueChange={handlePeriodYearChange}>
                    <SelectTrigger id="inline-year-select" data-testid="select-year" className="w-[120px] h-9">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {periodFilter.type === "Month" && (
                <>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="inline-month-year-select" className="text-sm">Year</Label>
                    <Select value={periodFilter.year?.toString()} onValueChange={handlePeriodYearChange}>
                      <SelectTrigger id="inline-month-year-select" data-testid="select-month-year" className="w-[120px] h-9">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="inline-month-select" className="text-sm">Month</Label>
                    <Select value={periodFilter.month?.toString()} onValueChange={handlePeriodMonthChange}>
                      <SelectTrigger id="inline-month-select" data-testid="select-month" className="w-[140px] h-9">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMonths.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {periodFilter.type === "Quarter" && (
                <>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="inline-quarter-year-select" className="text-sm">Year</Label>
                    <Select value={periodFilter.year?.toString()} onValueChange={handlePeriodYearChange}>
                      <SelectTrigger id="inline-quarter-year-select" data-testid="select-quarter-year" className="w-[120px] h-9">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="inline-quarter-select" className="text-sm">Quarter</Label>
                    <Select value={periodFilter.quarter?.toString()} onValueChange={handlePeriodQuarterChange}>
                      <SelectTrigger id="inline-quarter-select" data-testid="select-quarter" className="w-[100px] h-9">
                        <SelectValue placeholder="Q" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableQuarters.map((quarter) => (
                          <SelectItem key={quarter.value} value={quarter.value.toString()}>
                            {quarter.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <ProjectOverview 
              locationId={locationId}
              periodFilter={periodFilter}
            />
          </TabsContent>

          {/* Details Tab */}
          {locationId && (
            <TabsContent value="details" className="space-y-6">
              <ProjectDetailsTab locationId={locationId} />
            </TabsContent>
          )}

          {/* Cash Flows Tab */}
          <TabsContent value="cash-flows" className="space-y-6">
            <RentRollCashFlowGrid locationId={locationId} />
          </TabsContent>

          {/* Leases Tab */}
          <TabsContent value="leases" className="space-y-6">
            <LeasesTable onEditLease={handleEditLease} locationId={locationId} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Asset Class Selector */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: "general", label: "General", icon: Building2Icon },
                { key: "rv-park", label: "RV Park / MHP", icon: TentTree },
                { key: "industrial", label: "Industrial / Warehouse", icon: Warehouse },
                { key: "retail", label: "Retail CAM", icon: Building2Icon },
                { key: "hotel", label: "Hotel / STR", icon: Hotel },
                { key: "multifamily", label: "Multifamily", icon: Home },
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={analyticsAssetClass === key ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setAnalyticsAssetClass(key)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Button>
              ))}
            </div>

            {analyticsAssetClass === "general" && (
              <div className="grid gap-6">
                <OccupancyTrendCharts locationId={locationId} />
                <SeasonalRateComparison locationId={locationId} />
              </div>
            )}

            {analyticsAssetClass === "rv-park" && locationId && (
              <RVParkAnalyticsPanel locationId={locationId} />
            )}

            {analyticsAssetClass === "industrial" && locationId && (
              <IndustrialAnalyticsPanel locationId={locationId} />
            )}

            {analyticsAssetClass === "retail" && (
              <CAMReconciliationPanel orgId="" marinaId={locationId || undefined} />
            )}

            {analyticsAssetClass === "hotel" && (
              <HotelAnalyticsPanel locationId={locationId} />
            )}

            {analyticsAssetClass === "multifamily" && (
              <div className="grid gap-6">
                <MultifamilyAnalyticsPanel locationId={locationId} />
                {locationId && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsMarketRentDrawerOpen(true)}
                      data-testid="button-update-market-rents"
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Bulk Update Market Rents
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!locationId && analyticsAssetClass !== "general" && (
              <div className="text-center py-12 text-muted-foreground">
                <Building2Icon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a project to view asset-class analytics</p>
              </div>
            )}
          </TabsContent>

          {/* Lease Management Tab */}
          <TabsContent value="lease-management" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <LeaseExpirationCalendar locationId={locationId} />
              <RenewalRemindersPanel locationId={locationId} />
            </div>
          </TabsContent>

          {/* Heat Map Tab */}
          <TabsContent value="heat-map" className="space-y-6">
            <AddressHeatMapTable locationId={locationId} />
          </TabsContent>

          {/* Uploaded Files Tab */}
          {locationId && (
            <TabsContent value="files" className="space-y-6">
              <UploadedFilesTab locationId={locationId} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Lease Form Drawer */}
      <LeaseFormDrawer
        open={isLeaseDrawerOpen}
        onClose={handleCloseDrawer}
        leaseId={selectedLeaseId}
        locationId={locationId}
        location={locationData}
      />

      {/* File Import Drawer */}
      <FileImportDrawer
        open={isImportDrawerOpen}
        onClose={() => setIsImportDrawerOpen(false)}
        locationId={locationId}
      />

      {/* Market Rent Bulk-Update Drawer (Multifamily) */}
      <Sheet open={isMarketRentDrawerOpen} onOpenChange={setIsMarketRentDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[500px]">
          <SheetHeader>
            <SheetTitle>Bulk Update Market Rents</SheetTitle>
            <SheetDescription>
              Set market rent benchmarks by unit type. These values are used for variance analysis and pro forma sync.
            </SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-4">
            {marketRentUpdates.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">{row.unitType}</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Market rent"
                      value={row.marketRent}
                      className="pl-8"
                      onChange={(e) => {
                        const updated = [...marketRentUpdates];
                        updated[idx] = { ...updated[idx], marketRent: e.target.value };
                        setMarketRentUpdates(updated);
                      }}
                      data-testid={`input-market-rent-${row.unitType.replace(/\//g, '-')}`}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setMarketRentUpdates(prev => [...prev, { unitType: "", marketRent: "" }])}
            >
              + Add Unit Type
            </Button>
          </div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setIsMarketRentDrawerOpen(false)}
              disabled={marketRentUpdateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const updates = marketRentUpdates
                  .filter(r => r.unitType.trim() && r.marketRent !== "")
                  .map(r => ({ unitType: r.unitType, marketRent: parseFloat(r.marketRent) }));
                marketRentUpdateMutation.mutate(updates);
              }}
              disabled={marketRentUpdateMutation.isPending}
              data-testid="button-save-market-rents"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${marketRentUpdateMutation.isPending ? "animate-spin" : ""}`} />
              {marketRentUpdateMutation.isPending ? "Saving..." : "Save Market Rents"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Project Name Dialog */}
      <Dialog open={isEditNameDialogOpen} onOpenChange={setIsEditNameDialogOpen}>
        <DialogContent data-testid="dialog-edit-project-name">
          <DialogHeader>
            <DialogTitle>Edit Project Name</DialogTitle>
            <DialogDescription>
              Update the name for this project. This will be displayed throughout the application.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder="Enter project name..."
              data-testid="input-edit-project-name"
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !updateNameMutation.isPending) {
                  handleSaveProjectName();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditNameDialogOpen(false)}
              disabled={updateNameMutation.isPending}
              data-testid="button-cancel-edit-name"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProjectName}
              disabled={updateNameMutation.isPending || !editedName.trim()}
              data-testid="button-save-project-name"
            >
              {updateNameMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-project">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{locationData?.name}"? This action cannot be undone.
              {"\n\n"}
              <span className="font-medium text-destructive">
                Note: Projects with existing leases cannot be deleted. You must first delete or reassign all leases.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleteProjectMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProject}
              disabled={deleteProjectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteProjectMutation.isPending ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
