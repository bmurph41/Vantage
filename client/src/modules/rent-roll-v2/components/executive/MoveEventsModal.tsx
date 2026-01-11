import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ModalFilters, ModalFilterState } from "./ModalFilters";
import { calculateDateRange, type TimePeriodFilter } from "@shared/timePeriodUtils";

type MoveEventType = "move-in" | "move-out";

interface MoveEventLeaseDetail {
  leaseId: string;
  tenantName: string;
  boatSize: string | null;
  boatDimensions: string | null;
  contractTerm: string | null;
  rateType: string | null;
  leaseAmount: string;
  storageType: string | null;
  unitLocation: string | null;
  unitNumber: string | null;
  leaseCommencement: string;
  leaseExpiration: string | null;
  projectName: string | null;
  projectId: string | null;
}

interface MoveEventsByStorageLocation {
  storageLocation: string;
  count: number;
  leases: MoveEventLeaseDetail[];
}

interface MoveEventsByStorageType {
  storageType: string;
  count: number;
  locations: MoveEventsByStorageLocation[];
}

interface MoveEventsDetailResponse {
  eventType: MoveEventType;
  totalCount: number;
  storageTypes: MoveEventsByStorageType[];
}

interface MoveEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventType: MoveEventType;
  startDate: string;
  endDate: string;
  initialTimePeriod?: TimePeriodFilter;
}

export function MoveEventsModal({
  isOpen,
  onClose,
  eventType,
  startDate: initialStartDate,
  endDate: initialEndDate,
  initialTimePeriod = { type: "TTM" },
}: MoveEventsModalProps) {
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
    if (isOpen) {
      const currentPeriod = initialTimePeriodRef.current;
      setFilters({
        timePeriod: currentPeriod,
        selectedProjectIds: [],
        selectedStorageTypes: [],
      });
      setHasUserChangedTimePeriod(false);
    }
  }, [isOpen]);
  
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

  const { data, isLoading, error } = useQuery<MoveEventsDetailResponse>({
    queryKey: ["/api/executive-dashboard/move-events-detail", { eventType, startDate, endDate, projectIds: filters.selectedProjectIds, storageTypes: filters.selectedStorageTypes }],
    queryFn: async () => {
      const params = buildQueryParams();
      params.set("eventType", eventType);
      const response = await fetch(`/api/executive-dashboard/move-events-detail?${params}`);
      if (!response.ok) throw new Error("Failed to fetch move events");
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: availableYears } = useQuery<number[]>({
    queryKey: ["/api/rent-roll/available-years"],
    enabled: isOpen,
  });

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(amount));
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const title = eventType === "move-in" ? "Move-Ins" : "Move-Outs";
  const description = eventType === "move-in" 
    ? "New leases that started during this period"
    : "Leases that ended during this period";

  const allLeases = useMemo(() => {
    const leases: (MoveEventLeaseDetail & { storageTypeGroup: string })[] = [];
    data?.storageTypes.forEach((storageTypeGroup) => {
      if (filters.selectedStorageTypes.length > 0 && !filters.selectedStorageTypes.includes(storageTypeGroup.storageType)) {
        return;
      }
      storageTypeGroup.locations.forEach((location) => {
        location.leases.forEach((lease) => {
          if (filters.selectedProjectIds.length > 0 && lease.projectId && !filters.selectedProjectIds.includes(lease.projectId)) {
            return;
          }
          leases.push({
            ...lease,
            storageTypeGroup: storageTypeGroup.storageType,
          });
        });
      });
    });
    return leases;
  }, [data, filters.selectedStorageTypes, filters.selectedProjectIds]);

  const filteredCount = allLeases.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0" data-testid="dialog-move-events">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl" data-testid="title-move-events">
            {title} ({filteredCount})
          </DialogTitle>
          <DialogDescription data-testid="description-move-events">
            {description}
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
          {isLoading && (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-destructive px-6" data-testid="text-error">
              Failed to load move events data. Please try again.
            </div>
          )}

          {!isLoading && !error && allLeases.length === 0 && (
            <div className="text-center py-12 text-muted-foreground px-6" data-testid="text-no-results">
              No {eventType === "move-in" ? "move-ins" : "move-outs"} found for this period.
            </div>
          )}

          {!isLoading && !error && allLeases.length > 0 && (
            <ScrollArea className="h-full">
              <div className="px-6 py-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Customer</TableHead>
                      <TableHead className="w-[100px]">Storage Type</TableHead>
                      <TableHead className="w-[120px]">Project</TableHead>
                      <TableHead className="w-[80px] text-right">Rate</TableHead>
                      <TableHead className="w-[80px]">Term</TableHead>
                      <TableHead className="w-[70px] text-right">Size</TableHead>
                      <TableHead className="w-[100px]">{eventType === "move-in" ? "Start Date" : "End Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLeases.map((lease) => (
                      <TableRow 
                        key={lease.leaseId} 
                        data-testid={`row-lease-${lease.leaseId}`}
                        className={lease.projectId ? "cursor-pointer hover-elevate" : ""}
                        onClick={() => {
                          if (lease.projectId) {
                            const params = new URLSearchParams();
                            params.set("startDate", startDate);
                            params.set("endDate", endDate);
                            params.set("tab", "leases");
                            params.set("lease", lease.leaseId);
                            if (filters.selectedStorageTypes.length > 0) {
                              params.set("storageTypes", filters.selectedStorageTypes.join(","));
                            }
                            setLocation(`/rent-roll/${lease.projectId}?${params.toString()}`);
                            onClose();
                          }
                        }}
                      >
                        <TableCell className="font-medium">
                          <div className="truncate max-w-[180px]" title={lease.tenantName}>
                            {lease.tenantName}
                          </div>
                          {lease.unitNumber && (
                            <div className="text-xs text-muted-foreground">
                              Unit: {lease.unitNumber}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-normal whitespace-nowrap">
                            {lease.storageTypeGroup || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="truncate max-w-[120px] text-sm" title={lease.projectName || ""}>
                            {lease.projectName || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCurrency(lease.leaseAmount)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{lease.contractTerm || "—"}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {lease.boatSize ? `${lease.boatSize}'` : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {eventType === "move-in" 
                            ? formatDate(lease.leaseCommencement)
                            : formatDate(lease.leaseExpiration)
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
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
