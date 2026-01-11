import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModalFilters, ModalFilterState } from "./ModalFilters";
import { calculateDateRange, type TimePeriodFilter } from "@shared/timePeriodUtils";

interface AvgLeaseValueModalProps {
  open: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  initialTimePeriod?: TimePeriodFilter;
}

interface ProjectAvgValue {
  projectId: string;
  projectName: string;
  projectType: "OWNED" | "DEAL";
  totalRevenue: string;
  activeLeases: number;
  avgLeaseValue: string;
  minLeaseValue: string;
  maxLeaseValue: string;
}

interface StorageTypeAvgValue {
  storageType: string;
  totalRevenue: string;
  activeLeases: number;
  avgLeaseValue: string;
  minLeaseValue: string;
  maxLeaseValue: string;
}

export function AvgLeaseValueModal({ 
  open, 
  onClose, 
  startDate: initialStartDate, 
  endDate: initialEndDate,
  initialTimePeriod = { type: "TTM" }
}: AvgLeaseValueModalProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"project" | "storageType">("project");
  
  // Track whether user has explicitly changed the time period in this modal session
  const [hasUserChangedTimePeriod, setHasUserChangedTimePeriod] = useState(false);
  
  // Use ref to track latest props to avoid stale closure issues
  const initialTimePeriodRef = useRef(initialTimePeriod);
  
  // Update ref on every render to have latest prop values
  initialTimePeriodRef.current = initialTimePeriod;

  const [filters, setFilters] = useState<ModalFilterState>({
    timePeriod: initialTimePeriod,
    selectedProjectIds: [],
    selectedStorageTypes: [],
  });

  // Reset filters when modal opens
  useEffect(() => {
    if (open) {
      const currentPeriod = initialTimePeriodRef.current;
      setFilters({
        timePeriod: currentPeriod,
        selectedProjectIds: [],
        selectedStorageTypes: [],
      });
      setActiveTab("project");
      setHasUserChangedTimePeriod(false);
    }
  }, [open]);
  
  // Handle filter changes from user - detect if time period specifically changed
  const handleFiltersChange = (newFilters: ModalFilterState) => {
    // Check if time period changed (compare type and relevant properties)
    const oldPeriod = filters.timePeriod;
    const newPeriod = newFilters.timePeriod;
    const timePeriodChanged = JSON.stringify(oldPeriod) !== JSON.stringify(newPeriod);
    
    if (timePeriodChanged) {
      setHasUserChangedTimePeriod(true);
    }
    setFilters(newFilters);
  };

  // Use initial dates from dashboard props unless user has changed time period
  const calculatedRange = calculateDateRange(filters.timePeriod);
  const startDate = hasUserChangedTimePeriod ? calculatedRange.startDate : initialStartDate;
  const endDate = hasUserChangedTimePeriod ? calculatedRange.endDate : initialEndDate;
  
  // Build query params with the correct dates (not recalculated from filters.timePeriod)
  const buildQueryParams = () => {
    const params = new URLSearchParams({ startDate, endDate });
    if (filters.selectedProjectIds.length > 0) {
      params.set("projectIds", filters.selectedProjectIds.join(","));
    }
    if (filters.selectedStorageTypes.length > 0) {
      params.set("storageTypes", filters.selectedStorageTypes.join(","));
    }
    return params;
  };

  const { data: projectData, isLoading: projectLoading } = useQuery<ProjectAvgValue[]>({
    queryKey: ["/api/executive-dashboard/avg-lease-value-by-project", startDate, endDate, filters.selectedProjectIds, filters.selectedStorageTypes],
    queryFn: async () => {
      const response = await fetch(`/api/executive-dashboard/avg-lease-value-by-project?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch avg lease value by project');
      return response.json();
    },
    enabled: open && activeTab === "project",
  });

  const { data: storageTypeData, isLoading: storageTypeLoading } = useQuery<StorageTypeAvgValue[]>({
    queryKey: ["/api/executive-dashboard/avg-lease-value-by-storage-type", startDate, endDate, filters.selectedProjectIds, filters.selectedStorageTypes],
    queryFn: async () => {
      const response = await fetch(`/api/executive-dashboard/avg-lease-value-by-storage-type?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch avg lease value by storage type');
      return response.json();
    },
    enabled: open && activeTab === "storageType",
  });

  const { data: availableYears } = useQuery<number[]>({
    queryKey: ["/api/rent-roll/available-years"],
    enabled: open,
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

  const filteredProjectData = useMemo(() => {
    if (!projectData) return [];
    if (filters.selectedProjectIds.length === 0) return projectData;
    return projectData.filter(p => filters.selectedProjectIds.includes(p.projectId));
  }, [projectData, filters.selectedProjectIds]);

  const filteredStorageData = useMemo(() => {
    if (!storageTypeData) return [];
    if (filters.selectedStorageTypes.length === 0) return storageTypeData;
    return storageTypeData.filter(s => filters.selectedStorageTypes.includes(s.storageType));
  }, [storageTypeData, filters.selectedStorageTypes]);

  const totalRevenue = useMemo(() => {
    const data = activeTab === "project" ? filteredProjectData : filteredStorageData;
    return data.reduce((sum, item) => sum + parseFloat(item.totalRevenue), 0);
  }, [activeTab, filteredProjectData, filteredStorageData]);

  const totalLeases = useMemo(() => {
    const data = activeTab === "project" ? filteredProjectData : filteredStorageData;
    return data.reduce((sum, item) => sum + item.activeLeases, 0);
  }, [activeTab, filteredProjectData, filteredStorageData]);

  const overallAvg = totalLeases > 0 ? totalRevenue / totalLeases : 0;

  const isLoading = activeTab === "project" ? projectLoading : storageTypeLoading;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-avg-lease-value">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>Average Lease Value Breakdown</DialogTitle>
          <DialogDescription>
            Overall average: {formatCurrency(overallAvg)} across {totalLeases} active leases
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3 border-b bg-muted/30">
          <ModalFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            showProjectFilter={true}
            showStorageTypeFilter={true}
            showTimePeriodFilter={true}
            availableYears={availableYears || [new Date().getFullYear()]}
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "project" | "storageType")} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3">
            <TabsList>
              <TabsTrigger value="project" data-testid="tab-by-project">By Project</TabsTrigger>
              <TabsTrigger value="storageType" data-testid="tab-by-storage-type">By Storage Type</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="project" className="flex-1 min-h-0 overflow-hidden px-6 py-4 mt-0">
            <ScrollArea className="h-full">
              {projectLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Active Leases</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">Avg Value</TableHead>
                      <TableHead className="text-right">Min</TableHead>
                      <TableHead className="text-right">Max</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjectData.length > 0 ? (
                      filteredProjectData.map((project) => (
                        <TableRow 
                          key={project.projectId} 
                          data-testid={`row-project-${project.projectId}`}
                          className="cursor-pointer hover-elevate"
                          onClick={() => {
                            setLocation(`/rent-roll/${project.projectId}`);
                            onClose();
                          }}
                        >
                          <TableCell className="font-medium">{project.projectName}</TableCell>
                          <TableCell>
                            <Badge variant={project.projectType === "OWNED" ? "default" : "secondary"}>
                              {project.projectType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{project.activeLeases}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(project.totalRevenue)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(project.avgLeaseValue)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {formatCurrency(project.minLeaseValue)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {formatCurrency(project.maxLeaseValue)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No lease value data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="storageType" className="flex-1 min-h-0 overflow-hidden px-6 py-4 mt-0">
            <ScrollArea className="h-full">
              {storageTypeLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Storage Type</TableHead>
                      <TableHead className="text-right">Active Leases</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">Avg Value</TableHead>
                      <TableHead className="text-right">Min</TableHead>
                      <TableHead className="text-right">Max</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStorageData.length > 0 ? (
                      filteredStorageData.map((item) => (
                        <TableRow 
                          key={item.storageType} 
                          data-testid={`row-storage-type-${item.storageType}`}
                        >
                          <TableCell className="font-medium">{item.storageType}</TableCell>
                          <TableCell className="text-right tabular-nums">{item.activeLeases}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(item.totalRevenue)}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(item.avgLeaseValue)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {formatCurrency(item.minLeaseValue)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {formatCurrency(item.maxLeaseValue)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No storage type data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end px-6 py-4 border-t flex-shrink-0 bg-background">
          <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
