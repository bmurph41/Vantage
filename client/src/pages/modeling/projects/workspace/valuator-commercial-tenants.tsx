import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { UnifiedTenantFormDialog } from "@/components/commercial-tenants/UnifiedTenantFormDialog";
import {
  Building2, Plus, Trash2, Edit, DollarSign, Users,
  TrendingUp, Download, AlertTriangle, ChevronDown,
  Calendar, Percent, MoreHorizontal, Copy, Archive,
  X, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface ValuatorCommercialTenantsProps {
  projectId: string;
  projectName: string;
}

type LeaseType = "NNN" | "MOD_GROSS" | "FULL_GROSS" | "ABSOLUTE_NNN" | "OTHER";
type LeaseStatus = "ACTIVE" | "FUTURE" | "EXPIRING" | "EXPIRED" | "ARCHIVED";

interface TenantLease {
  id: string;
  tenantName: string;
  suiteLabel?: string | null;
  sf: number;
  leaseType: LeaseType;
  leaseStartDate: string;
  leaseEndDate: string;
  baseRentMonthly: number;
  escalationDisplay: string;
  optionsCount: number;
  percentRentEnabled: boolean;
  recoveriesEnabled: boolean;
  status: LeaseStatus;
  health: {
    score: number;
    status: "Strong" | "Stable" | "Watch" | "At Risk";
  };
}

interface LeaseKpis {
  totalBaseRentMonthly: number;
  totalRecoveriesMonthly: number;
  totalPercentRentMtd: number;
  totalPercentRentYtd: number;
  weightedAvgRentPsf: number;
  totalSf: number;
  activeLeaseCount: number;
  expiringCount: number;
  expiredCount: number;
}


// ============================================
// CONSTANTS
// ============================================


const STATUS_FILTER_OPTIONS: { value: LeaseStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "FUTURE", label: "Future" },
  { value: "EXPIRING", label: "Expiring" },
  { value: "EXPIRED", label: "Expired" },
];

const getStatusBadgeVariant = (status: LeaseStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "ACTIVE": return "default";
    case "FUTURE": return "secondary";
    case "EXPIRING": return "outline";
    case "EXPIRED": return "destructive";
    case "ARCHIVED": return "outline";
    default: return "default";
  }
};

const getHealthBadgeColor = (status: string) => {
  switch (status) {
    case "Strong": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Stable": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Watch": return "bg-amber-100 text-amber-700 border-amber-200";
    case "At Risk": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
};


// ============================================
// MAIN COMPONENT
// ============================================

export default function ValuatorCommercialTenantsTab({ projectId, projectName }: ValuatorCommercialTenantsProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingLease, setEditingLease] = useState<TenantLease | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeaseStatus | "all">("all");
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Fetch leases
  const { data: leases = [], isLoading: leasesLoading } = useQuery<TenantLease[]>({
    queryKey: ["/api/valuator", projectId, "leases", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      const res = await fetch(`/api/valuator/${projectId}/leases?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch leases");
      const data = await res.json();
      return data.data || [];
    },
  });

  // Fetch KPIs
  const { data: kpis } = useQuery<LeaseKpis>({
    queryKey: ["/api/valuator", projectId, "leases/kpis"],
    queryFn: async () => {
      const res = await fetch(`/api/valuator/${projectId}/leases/kpis`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      const data = await res.json();
      return data.data;
    },
  });


  // Duplicate lease mutation
  const duplicateMutation = useMutation({
    mutationFn: async (leaseId: string) => {
      return apiRequest(`/api/valuator/${projectId}/leases/${leaseId}/duplicate`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuator", projectId, "leases"] });
      toast({ title: "Success", description: "Lease duplicated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to duplicate lease", variant: "destructive" });
    },
  });

  // Archive lease mutation
  const archiveMutation = useMutation({
    mutationFn: async (leaseId: string) => {
      return apiRequest(`/api/valuator/${projectId}/leases/${leaseId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/valuator", projectId, "leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/valuator", projectId, "leases/kpis"] });
      toast({ title: "Success", description: "Lease archived" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive lease", variant: "destructive" });
    },
  });

  const showBanner = !bannerDismissed && kpis && (kpis.expiringCount > 0 || kpis.expiredCount > 0);

  // KPI cards data
  const kpiCards = [
    {
      label: "Base Rent (Monthly)",
      value: formatCurrency(kpis?.totalBaseRentMonthly || 0),
      subLabel: `${kpis?.activeLeaseCount || 0} active lease${(kpis?.activeLeaseCount || 0) !== 1 ? "s" : ""}`,
      icon: DollarSign,
    },
    {
      label: "Recoveries (Monthly)",
      value: formatCurrency(kpis?.totalRecoveriesMonthly || 0),
      subLabel: `${(kpis?.totalSf || 0).toLocaleString()} total SF`,
      icon: TrendingUp,
    },
    {
      label: "% Rent (MTD)",
      value: formatCurrency(kpis?.totalPercentRentMtd || 0),
      subLabel: `YTD: ${formatCurrency(kpis?.totalPercentRentYtd || 0)}`,
      icon: Percent,
    },
    {
      label: "Weighted Avg Rent",
      value: `$${(kpis?.weightedAvgRentPsf || 0).toFixed(2)}/SF`,
      subLabel: "annualized",
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Commercial Tenants
          </h3>
          <p className="text-sm text-muted-foreground">
            Model base rent, escalations, options, recoveries, and percentage rent for {projectName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant Lease
          </Button>
        </div>
      </div>

      {/* Expiring Banner */}
      {showBanner && (
        <Alert className={kpis?.expiredCount ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}>
          <AlertTriangle className={`h-4 w-4 ${kpis?.expiredCount ? "text-red-500" : "text-amber-500"}`} />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {(kpis?.expiredCount || 0) > 0 && (
                <span className="font-medium text-red-700">
                  {kpis?.expiredCount} lease{kpis?.expiredCount !== 1 ? "s" : ""} expired
                </span>
              )}
              {(kpis?.expiringCount || 0) > 0 && (
                <span className={kpis?.expiredCount ? "text-muted-foreground" : "font-medium text-amber-700"}>
                  {kpis?.expiringCount} lease{kpis?.expiringCount !== 1 ? "s" : ""} expiring within 12 months
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setBannerDismissed(true)}>
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  {kpi.subLabel && (
                    <p className="text-xs text-muted-foreground">{kpi.subLabel}</p>
                  )}
                </div>
                <kpi.icon className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={(v: LeaseStatus | "all") => setStatusFilter(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Showing {leases.length} lease{leases.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Leases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Leases</CardTitle>
          <CardDescription>
            {leases.length} lease{leases.length !== 1 ? "s" : ""} in portfolio
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leasesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tenant leases yet</p>
              <p className="text-sm">Add leases to build your commercial tenant income model</p>
              <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Lease
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">SF</TableHead>
                  <TableHead>Lease Term</TableHead>
                  <TableHead className="text-right">Base Rent</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead>Options</TableHead>
                  <TableHead>% Rent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{lease.tenantName}</div>
                        {lease.suiteLabel && (
                          <div className="text-sm text-muted-foreground">{lease.suiteLabel}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {lease.sf.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(new Date(lease.leaseStartDate), "MMM yyyy")}</div>
                        <div className="text-muted-foreground">
                          to {format(new Date(lease.leaseEndDate), "MMM yyyy")}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono font-medium">
                        {formatCurrency(lease.baseRentMonthly)}
                      </span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{lease.escalationDisplay || "—"}</span>
                    </TableCell>
                    <TableCell>
                      {lease.optionsCount > 0 ? (
                        <Badge variant="secondary">
                          {lease.optionsCount} option{lease.optionsCount > 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {lease.percentRentEnabled ? (
                        <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                          On
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Off</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(lease.status)}>
                        {lease.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getHealthBadgeColor(lease.health.status)}>
                        {lease.health.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingLease(lease)}>
                            <Edit className="h-4 w-4 mr-2" />
                            View / Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(lease.id)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => archiveMutation.mutate(lease.id)}
                            className="text-destructive"
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UnifiedTenantFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        context="valuator"
        projectId={projectId}
        projectName={projectName}
      />
    </div>
  );
}
