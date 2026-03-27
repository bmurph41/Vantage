/**
 * UnifiedLeaseList
 * ================
 * Main lease list page shared between Operations and Valuator.
 * Server-side pagination, debounced search, column sorting, KPIs.
 * 
 * Context-aware features:
 * - Operations: property selector, lease alerts, tenant history
 * - Valuator: sync to pro forma, import from operations, recompute
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  Building2,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Link2,
  Upload,
  ArrowUpDown,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLeaseContext } from "./LeaseContextProvider";
import { LeaseKpiCards } from "./LeaseKpiCards";
import { useUnifiedLeases, useUnifiedLeaseMutations } from "@/hooks/use-unified-leases";

const PAGE_SIZE = 25;

const formatCurrency = (value: number | string | null | undefined) => {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    return format(parseISO(value), "MM/dd/yyyy");
  } catch {
    return value;
  }
};

const getLeaseTypeBadge = (type: string) => {
  const labels: Record<string, string> = {
    retail: "Retail",
    office: "Office",
    industrial: "Industrial",
    other: "Other",
    nnn: "NNN",
    NNN: "NNN",
    MOD_GROSS: "Modified Gross",
    FULL_GROSS: "Full Gross",
    ABSOLUTE_NNN: "Absolute NNN",
    modified_gross: "Modified Gross",
    full_service: "Full Service",
  };
  return <Badge variant="outline">{labels[type] || type}</Badge>;
};

const getExpirationWarning = (expirationDate: string | null) => {
  if (!expirationDate) return null;
  const daysUntil = differenceInDays(parseISO(expirationDate), new Date());
  if (daysUntil < 0) return <Badge variant="destructive">Expired</Badge>;
  if (daysUntil <= 90)
    return <Badge variant="destructive">{daysUntil}d</Badge>;
  if (daysUntil <= 180)
    return <Badge variant="secondary">{daysUntil}d</Badge>;
  return null;
};

interface UnifiedLeaseListProps {
  onOpenForm?: (lease?: any) => void;
  onOpenDetail?: (lease: any) => void;
  onOpenConnect?: () => void;
  className?: string;
}

export function UnifiedLeaseList({
  onOpenForm,
  onOpenDetail,
  onOpenConnect,
  className,
}: UnifiedLeaseListProps) {
  const { mode, features } = useLeaseContext();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("tenantName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { leases, total, hasMore, loading, error } = useUnifiedLeases({
    search,
    sortBy,
    sortDir,
    limit: PAGE_SIZE,
    page,
  });

  const { deleteLease, syncToProForma, bulkRecompute } =
    useUnifiedLeaseMutations();

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  // Toggle sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
    setPage(0);
  };

  const handleDelete = (lease: any) => {
    if (confirm(`Delete "${lease.tenantName}"? This cannot be undone.`)) {
      deleteLease.mutate(lease.id, {
        onSuccess: () => toast({ title: "Tenant deleted" }),
        onError: (err: any) =>
          toast({
            title: "Error",
            description: err.message,
            variant: "destructive",
          }),
      });
    }
  };

  const handleSync = () => {
    syncToProForma.mutate(undefined, {
      onSuccess: (result: any) =>
        toast({
          title: "Synced",
          description: `${result.synced} months synced to Pro Forma`,
        }),
      onError: () =>
        toast({
          title: "Error syncing",
          variant: "destructive",
        }),
    });
  };

  const SortHeader = ({
    column,
    children,
  }: {
    column: string;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === column && (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </TableHead>
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startItem = page * PAGE_SIZE + 1;
  const endItem = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className={`space-y-6 ${className || ""}`}>
      {/* KPI Cards */}
      <LeaseKpiCards />

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {features.syncToProForma && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncToProForma.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${
                  syncToProForma.isPending ? "animate-spin" : ""
                }`}
              />
              {syncToProForma.isPending ? "Syncing..." : "Sync to Pro Forma"}
            </Button>
          )}

          {features.connectFromOps && onOpenConnect && (
            <Button variant="outline" size="sm" onClick={onOpenConnect}>
              <Link2 className="h-4 w-4 mr-2" />
              Import from Operations
            </Button>
          )}

          <Button size="sm" onClick={() => onOpenForm?.()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">
              Error loading tenants
            </div>
          ) : leases.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Commercial Tenants</h3>
              <p className="text-muted-foreground mb-4">
                {mode === "valuator"
                  ? "Add tenants or import from Operations"
                  : "Add tenants to start tracking your portfolio"}
              </p>
              <div className="flex gap-2 justify-center">
                {features.connectFromOps && onOpenConnect && (
                  <Button variant="outline" onClick={onOpenConnect}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Import from Operations
                  </Button>
                )}
                <Button onClick={() => onOpenForm?.()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tenant
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader column="tenantName">Tenant</SortHeader>
                    <TableHead>Suite</TableHead>
                    <SortHeader column="sf">SF</SortHeader>
                    <TableHead>Base Rent</TableHead>
                    <SortHeader column="leaseType">Lease Type</SortHeader>
                    <SortHeader column="expirationDate">Expiration</SortHeader>
                    <TableHead>Status</TableHead>
                    {mode === "valuator" && <TableHead>Source</TableHead>}
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leases.map((lease: any) => (
                    <TableRow
                      key={lease.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onOpenDetail?.(lease)}
                    >
                      <TableCell>
                        <div className="font-medium">{lease.tenantName}</div>
                      </TableCell>
                      <TableCell>{lease.suite || "-"}</TableCell>
                      <TableCell>
                        {lease.sf
                          ? parseFloat(lease.sf).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {lease.monthlyBaseRent
                          ? formatCurrency(lease.monthlyBaseRent)
                          : "-"}
                      </TableCell>
                      <TableCell>{getLeaseTypeBadge(lease.leaseType)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{formatDate(lease.expirationDate)}</span>
                          {getExpirationWarning(lease.expirationDate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lease.active ? "default" : "secondary"}>
                          {lease.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      {mode === "valuator" && (
                        <TableCell>
                          {lease.sourceLeaseId ? (
                            <Badge
                              variant="outline"
                              className="text-blue-600 border-blue-300 bg-blue-50"
                            >
                              <Link2 className="h-3 w-3 mr-1" />
                              Linked
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              Manual
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onOpenDetail?.(lease)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onOpenForm?.(lease)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(lease)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    Showing {startItem}–{endItem} of {total}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page === 0}
                      onClick={() => setPage(0)}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-2">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!hasMore}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={!hasMore}
                      onClick={() => setPage(totalPages - 1)}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
