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
import { ModalFilters, ModalFilterState } from "./ModalFilters";
import { calculateDateRange, type TimePeriodFilter } from "@shared/timePeriodUtils";

interface ActiveLeasesModalProps {
  open: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  initialTimePeriod?: TimePeriodFilter;
}

interface ProjectLeases {
  projectId: string;
  projectName: string;
  projectType: "OWNED" | "DEAL";
  activeLeases: number;
  totalLeases: number;
  vacantSlips: number;
  unusableSlips: number;
  notPayingSlips: number;
}

export function ActiveLeasesModal({ 
  open, 
  onClose, 
  startDate: initialStartDate, 
  endDate: initialEndDate,
  initialTimePeriod = { type: "TTM" }
}: ActiveLeasesModalProps) {
  const [, setLocation] = useLocation();
  
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

  const { data: projectData, isLoading } = useQuery<ProjectLeases[]>({
    queryKey: ["/api/executive-dashboard/leases-by-project", startDate, endDate, filters.selectedProjectIds, filters.selectedStorageTypes],
    queryFn: async () => {
      const response = await fetch(`/api/executive-dashboard/leases-by-project?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch leases by project');
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
  const totalLeases = useMemo(() => filteredData.reduce((sum, p) => sum + p.totalLeases, 0), [filteredData]);
  const totalVacant = useMemo(() => filteredData.reduce((sum, p) => sum + p.vacantSlips, 0), [filteredData]);
  const totalUnusable = useMemo(() => filteredData.reduce((sum, p) => sum + p.unusableSlips, 0), [filteredData]);
  const totalNotPaying = useMemo(() => filteredData.reduce((sum, p) => sum + p.notPayingSlips, 0), [filteredData]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-active-leases">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>Active Leases Breakdown</DialogTitle>
          <DialogDescription>
            {totalActive} active of {totalLeases} total leases
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

        <div className="px-6 py-4 grid grid-cols-4 gap-4 flex-shrink-0 border-b">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Vacant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{totalVacant}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Unusable</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{totalUnusable}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Not Paying</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{totalNotPaying}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Inactive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{Math.max(0, totalLeases - totalActive - totalVacant - totalUnusable - totalNotPaying)}</div>
            </CardContent>
          </Card>
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
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Vacant</TableHead>
                    <TableHead className="text-right">Unusable</TableHead>
                    <TableHead className="text-right">Not Paying</TableHead>
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
                          const params = new URLSearchParams();
                          params.set("startDate", startDate);
                          params.set("endDate", endDate);
                          params.set("tab", "leases");
                          if (filters.selectedStorageTypes.length > 0) {
                            params.set("storageTypes", filters.selectedStorageTypes.join(","));
                          }
                          setLocation(`/rent-roll/${project.projectId}?${params.toString()}`);
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
                        <TableCell className="text-right text-muted-foreground tabular-nums">{project.totalLeases}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{project.vacantSlips}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{project.unusableSlips}</TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">{project.notPayingSlips}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No lease data available
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
  );
}
