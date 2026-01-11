import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { X, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeaseWithTenant } from "@shared/schema";

interface StorageTypeDetailDialogProps {
  storageType: string | null;
  onClose: () => void;
  startDate: string;
  endDate: string;
  periodLabel: string;
}

type SortField = "tenant" | "commencement" | "expiration" | "amount" | "term" | "location" | "boat" | "status";
type SortDirection = "asc" | "desc";

export default function StorageTypeDetailDialog({
  storageType,
  onClose,
  startDate,
  endDate,
  periodLabel,
}: StorageTypeDetailDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortField, setSortField] = useState<SortField>("tenant");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data, isLoading } = useQuery<{ leases: LeaseWithTenant[]; total: number }>({
    queryKey: ["/api/rent-roll/leases", { storageType }],
    enabled: !!storageType,
  });

  const leases = data?.leases;

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  };

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter, search, and sort leases
  const filteredLeases = useMemo(() => {
    if (!leases) return [];

    // Stable timestamp for ongoing leases (captured once per memo run for deterministic sorting)
    const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const ongoingProxy = Date.now() + YEAR_MS;

    // Helper: Get lease end date as timestamp (null expiration uses stable proxy)
    const getLeaseEndTimestamp = (lease: LeaseWithTenant): number => {
      return lease.leaseExpiration 
        ? new Date(lease.leaseExpiration).getTime() 
        : ongoingProxy;
    };

    return leases
      .filter((lease) => {
        // Period filter: lease overlaps with selected period
        const leaseStart = new Date(lease.leaseCommencement).getTime();
        const leaseEnd = getLeaseEndTimestamp(lease);
        const periodStart = new Date(startDate).getTime();
        const periodEnd = new Date(endDate).getTime();
        const periodOverlap = leaseStart <= periodEnd && leaseEnd >= periodStart;
        if (!periodOverlap) return false;

        // Status filter
        if (statusFilter === "active" && !lease.isActive) return false;
        if (statusFilter === "inactive" && lease.isActive) return false;

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const tenantName = lease.tenant.name?.toLowerCase() || "";
          const location = `${lease.tenant.city || ""} ${lease.tenant.state || ""}`.toLowerCase();
          const boat = `${lease.tenant.boatYear || ""} ${lease.tenant.boatMake || ""}`.toLowerCase();
          const term = lease.contractTerm?.toLowerCase() || "";
          
          return (
            tenantName.includes(query) ||
            location.includes(query) ||
            boat.includes(query) ||
            term.includes(query)
          );
        }

        return true;
      })
      .sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortField) {
          case "tenant":
            aValue = a.tenant.name?.toLowerCase() || "";
            bValue = b.tenant.name?.toLowerCase() || "";
            break;
          case "commencement":
            aValue = new Date(a.leaseCommencement).getTime();
            bValue = new Date(b.leaseCommencement).getTime();
            break;
          case "expiration":
            aValue = getLeaseEndTimestamp(a);
            bValue = getLeaseEndTimestamp(b);
            break;
          case "amount":
            aValue = parseFloat(a.leaseAmount);
            bValue = parseFloat(b.leaseAmount);
            break;
          case "term":
            aValue = a.contractTerm?.toLowerCase() || "";
            bValue = b.contractTerm?.toLowerCase() || "";
            break;
          case "location":
            aValue = `${a.tenant.city || ""} ${a.tenant.state || ""}`.toLowerCase();
            bValue = `${b.tenant.city || ""} ${b.tenant.state || ""}`.toLowerCase();
            break;
          case "boat":
            aValue = `${a.tenant.boatYear || ""} ${a.tenant.boatMake || ""}`.toLowerCase();
            bValue = `${b.tenant.boatYear || ""} ${b.tenant.boatMake || ""}`.toLowerCase();
            break;
          case "status":
            // Active leases should sort first (0), inactive second (1)
            aValue = a.isActive ? 0 : 1;
            bValue = b.isActive ? 0 : 1;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [leases, startDate, endDate, statusFilter, searchQuery, sortField, sortDirection]);

  return (
    <Dialog open={!!storageType} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-semibold">{storageType} Leases</DialogTitle>
              <DialogDescription className="mt-1">
                Active leases for {periodLabel}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-detail"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Search and Filter Controls */}
        <div className="px-6 pt-4 pb-3 border-b space-y-3 flex-shrink-0">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tenant, location, boat, or term..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-leases"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leases</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            Showing {filteredLeases.length} of {leases?.length || 0} leases
          </div>
        </div>

        {/* Scrollable Table Content */}
        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredLeases.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="empty-state-detail">
              <p className="text-sm">No active leases found for this storage type in the selected period</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort("tenant")}
                        data-testid="sort-tenant"
                      >
                        Tenant
                        {sortField === "tenant" && (
                          sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        )}
                        {sortField !== "tenant" && <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort("commencement")}
                        data-testid="sort-commencement"
                      >
                        Commencement
                        {sortField === "commencement" && (
                          sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        )}
                        {sortField !== "commencement" && <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort("expiration")}
                        data-testid="sort-expiration"
                      >
                        Expiration
                        {sortField === "expiration" && (
                          sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        )}
                        {sortField !== "expiration" && <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -mr-3"
                        onClick={() => handleSort("amount")}
                        data-testid="sort-amount"
                      >
                        Monthly Rent
                        {sortField === "amount" && (
                          sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        )}
                        {sortField !== "amount" && <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort("term")}
                        data-testid="sort-term"
                      >
                        Term
                        {sortField === "term" && (
                          sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        )}
                        {sortField !== "term" && <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort("location")}
                        data-testid="sort-location"
                      >
                        Location
                        {sortField === "location" && (
                          sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        )}
                        {sortField !== "location" && <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort("boat")}
                        data-testid="sort-boat"
                      >
                        Boat
                        {sortField === "boat" && (
                          sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        )}
                        {sortField !== "boat" && <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 -ml-3"
                        onClick={() => handleSort("status")}
                        data-testid="sort-status"
                      >
                        Status
                        {sortField === "status" && (
                          sortDirection === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                        )}
                        {sortField !== "status" && <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeases.map((lease) => (
                    <TableRow
                      key={lease.id}
                      data-testid={`detail-row-${lease.id}`}
                    >
                      <TableCell className="font-medium">
                        {lease.tenant.name}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(lease.leaseCommencement)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {lease.leaseExpiration ? formatDate(lease.leaseExpiration) : "Ongoing"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(lease.leaseAmount)}
                      </TableCell>
                      <TableCell>
                        {lease.contractTerm || "N/A"}
                      </TableCell>
                      <TableCell>
                        {lease.tenant.city && lease.tenant.state
                          ? `${lease.tenant.city}, ${lease.tenant.state}`
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        {lease.tenant.boatMake
                          ? `${lease.tenant.boatYear || ""} ${lease.tenant.boatMake}`.trim()
                          : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={lease.isActive ? "default" : "secondary"}
                          data-testid={`status-${lease.id}`}
                        >
                          {lease.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
