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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ModalFilters, ModalFilterState } from "./ModalFilters";
import { calculateDateRange, type TimePeriodFilter } from "@shared/timePeriodUtils";

interface TotalRevenueModalProps {
  open: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  initialTimePeriod?: TimePeriodFilter;
}

interface ProjectRevenue {
  projectId: string;
  projectName: string;
  projectType: "OWNED" | "DEAL";
  revenue: string;
  leaseCount: number;
  percentage: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: string;
  leaseCount: number;
}

interface StorageTypeRevenue {
  storageType: string;
  revenue: string;
  leaseCount: number;
  percentage: number;
}

export function TotalRevenueModal({ 
  open, 
  onClose, 
  startDate: initialStartDate, 
  endDate: initialEndDate,
  initialTimePeriod = { type: "TTM" }
}: TotalRevenueModalProps) {
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

  const { data: byProject, isLoading: projectLoading } = useQuery<ProjectRevenue[]>({
    queryKey: ["/api/executive-dashboard/revenue-by-project", startDate, endDate, filters.selectedProjectIds, filters.selectedStorageTypes],
    queryFn: async () => {
      const response = await fetch(`/api/executive-dashboard/revenue-by-project?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch revenue by project');
      return response.json();
    },
    enabled: open,
  });

  const { data: byMonth, isLoading: monthLoading } = useQuery<MonthlyRevenue[]>({
    queryKey: ["/api/executive-dashboard/revenue-by-month", startDate, endDate, filters.selectedProjectIds, filters.selectedStorageTypes],
    queryFn: async () => {
      const response = await fetch(`/api/executive-dashboard/revenue-by-month?${buildQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch revenue by month');
      return response.json();
    },
    enabled: open,
  });

  const { data: byStorageType, isLoading: storageLoading } = useQuery<StorageTypeRevenue[]>({
    queryKey: ["/api/executive-dashboard/revenue-by-storage-type-modal", startDate, endDate, filters.selectedProjectIds],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      if (filters.selectedProjectIds.length > 0) {
        params.set("projectIds", filters.selectedProjectIds.join(","));
      }
      const response = await fetch(`/api/executive-dashboard/revenue-by-storage-type?${params}`);
      if (!response.ok) throw new Error('Failed to fetch revenue by storage type');
      return response.json();
    },
    enabled: open,
  });

  const { data: availableYears } = useQuery<number[]>({
    queryKey: ["/api/rent-roll/available-years"],
    enabled: open,
  });

  const filteredByProject = useMemo(() => {
    if (!byProject) return [];
    let filtered = byProject;
    if (filters.selectedProjectIds.length > 0) {
      filtered = filtered.filter(p => filters.selectedProjectIds.includes(p.projectId));
    }
    return filtered;
  }, [byProject, filters.selectedProjectIds]);

  const filteredByStorageType = useMemo(() => {
    if (!byStorageType) return [];
    let filtered = byStorageType;
    if (filters.selectedStorageTypes.length > 0) {
      filtered = filtered.filter(s => filters.selectedStorageTypes.includes(s.storageType));
    }
    return filtered;
  }, [byStorageType, filters.selectedStorageTypes]);

  const totalRevenue = useMemo(() => {
    return filteredByProject?.reduce((sum, p) => sum + parseFloat(p.revenue), 0) || 0;
  }, [filteredByProject]);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-total-revenue">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>Total Revenue Breakdown</DialogTitle>
          <DialogDescription>
            Detailed revenue analysis: {formatCurrency(totalRevenue)}
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

        <div className="flex-1 min-h-0 overflow-hidden">
          <Tabs defaultValue="by-project" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0 mx-6 mt-4" style={{ width: "calc(100% - 3rem)" }}>
              <TabsTrigger value="by-project" data-testid="tab-by-project">By Project</TabsTrigger>
              <TabsTrigger value="by-month" data-testid="tab-by-month">By Month</TabsTrigger>
              <TabsTrigger value="by-storage" data-testid="tab-by-storage">By Storage Type</TabsTrigger>
            </TabsList>

            <TabsContent value="by-project" className="mt-4 flex-1 min-h-0 px-6 pb-6">
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
                        <TableHead className="text-right">Leases</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredByProject && filteredByProject.length > 0 ? (
                        filteredByProject.map((project) => {
                          const percentage = totalRevenue > 0 
                            ? (parseFloat(project.revenue) / totalRevenue) * 100 
                            : 0;
                          return (
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
                              <TableCell className="text-right tabular-nums">{project.leaseCount}</TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatCurrency(project.revenue)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground tabular-nums">
                                {percentage.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No revenue data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="by-month" className="mt-4 flex-1 min-h-0 px-6 pb-6">
              <ScrollArea className="h-full">
                {monthLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Leases</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byMonth && byMonth.length > 0 ? (
                        byMonth.map((month, idx) => (
                          <TableRow key={idx} data-testid={`row-month-${idx}`}>
                            <TableCell className="font-medium">{month.month}</TableCell>
                            <TableCell className="text-right tabular-nums">{month.leaseCount}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(month.revenue)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No monthly data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="by-storage" className="mt-4 flex-1 min-h-0 px-6 pb-6">
              <ScrollArea className="h-full">
                {storageLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Storage Type</TableHead>
                        <TableHead className="text-right">Leases</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredByStorageType && filteredByStorageType.length > 0 ? (
                        filteredByStorageType.map((storage) => (
                          <TableRow key={storage.storageType} data-testid={`row-storage-${storage.storageType}`}>
                            <TableCell>
                              <Badge variant="secondary">{storage.storageType}</Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{storage.leaseCount}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(storage.revenue)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">
                              {storage.percentage.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
