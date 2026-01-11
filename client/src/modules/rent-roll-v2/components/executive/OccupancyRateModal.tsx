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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StorageLocationsDetailModal } from "./StorageLocationsDetailModal";
import { ModalFilters, ModalFilterState } from "./ModalFilters";
import { calculateDateRange, type TimePeriodFilter } from "@shared/timePeriodUtils";

interface OccupancyRateModalProps {
  open: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  initialTimePeriod?: TimePeriodFilter;
}

interface ProjectOccupancy {
  projectId: string;
  projectName: string;
  projectType: "OWNED" | "DEAL";
  activeLeases: number;
  totalCapacity: number;
  occupancyRate: number;
  activeStorageLocations: number;
  totalStorageLocations: number;
}

export function OccupancyRateModal({ 
  open, 
  onClose, 
  startDate: initialStartDate, 
  endDate: initialEndDate,
  initialTimePeriod = { type: "TTM" }
}: OccupancyRateModalProps) {
  const [, setLocation] = useLocation();
  const [storageLocationsModalOpen, setStorageLocationsModalOpen] = useState(false);
  const [selectedProjectForLocations, setSelectedProjectForLocations] = useState<{
    id: string;
    name: string;
  } | null>(null);
  
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

  const { data: projectData, isLoading } = useQuery<ProjectOccupancy[]>({
    queryKey: ["/api/executive-dashboard/occupancy-by-project", startDate, endDate, filters.selectedProjectIds, filters.selectedStorageTypes],
    queryFn: async () => {
      const response = await fetch(`/api/executive-dashboard/occupancy-by-project?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch occupancy by project');
      return response.json();
    },
    enabled: open,
  });

  const { data: availableYears } = useQuery<number[]>({
    queryKey: ["/api/rent-roll/available-years"],
    enabled: open,
  });

  const filteredData = useMemo(() => {
    if (!projectData) return [];
    if (filters.selectedProjectIds.length === 0) return projectData;
    return projectData.filter(p => filters.selectedProjectIds.includes(p.projectId));
  }, [projectData, filters.selectedProjectIds]);

  const totalActive = useMemo(() => filteredData.reduce((sum, p) => sum + p.activeLeases, 0), [filteredData]);
  const totalCapacity = useMemo(() => filteredData.reduce((sum, p) => sum + p.totalCapacity, 0), [filteredData]);
  const overallRate = totalCapacity > 0 ? (totalActive / totalCapacity) * 100 : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-occupancy-rate">
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogTitle>Occupancy Rate Breakdown</DialogTitle>
            <DialogDescription>
              {totalActive} active leases across {totalCapacity.toLocaleString()} total leasable spaces ({overallRate.toFixed(1)}%)
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

          <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
            <ScrollArea className="h-full">
              {isLoading ? (
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
                      <TableHead className="text-right">Total Capacity</TableHead>
                      <TableHead className="text-right">Occupancy Rate</TableHead>
                      <TableHead className="text-right">Storage Locations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length > 0 ? (
                      filteredData.map((project) => (
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
                          <TableCell className="text-right font-medium tabular-nums">{project.activeLeases}</TableCell>
                          <TableCell className="text-right tabular-nums">{project.totalCapacity.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <span className={
                              project.occupancyRate >= 90 ? "text-green-600 font-medium tabular-nums" :
                              project.occupancyRate >= 70 ? "text-amber-600 font-medium tabular-nums" :
                              "text-red-600 font-medium tabular-nums"
                            }>
                              {project.occupancyRate.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 font-normal text-primary hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProjectForLocations({
                                  id: project.projectId,
                                  name: project.projectName,
                                });
                                setStorageLocationsModalOpen(true);
                              }}
                              data-testid={`button-storage-locations-${project.projectId}`}
                            >
                              {project.totalStorageLocations}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No occupancy data available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>

          <div className="flex justify-end px-6 py-4 border-t flex-shrink-0 bg-background">
            <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StorageLocationsDetailModal
        open={storageLocationsModalOpen}
        onClose={() => setStorageLocationsModalOpen(false)}
        projectId={selectedProjectForLocations?.id || null}
        projectName={selectedProjectForLocations?.name || ""}
      />
    </>
  );
}
