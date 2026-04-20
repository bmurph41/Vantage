import { useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
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
  Upload,
  MoreVertical,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  CalendarDays,
  DollarSign,
  Percent,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
  FileText,
  TrendingUp,
  Calculator,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CommercialTenant } from "@shared/schema";
import { PageTour } from "@/components/onboarding/PageTour";
import { TOUR_IDS, commercialTenantsTourSteps } from "@/lib/tour-configs";
import { UnifiedTenantFormDialog } from "@/components/commercial-tenants/UnifiedTenantFormDialog";
import { TenantDetailSheet } from "@/components/commercial-tenants/TenantDetailSheet";
import { LeaseImportWizard } from "./LeaseImportWizard";

const CAMReconciliation = lazy(() => import("./CAMReconciliation"));

const formatCurrency = (value: string | number | null | undefined) => {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatPercent = (value: string | number | null | undefined) => {
  if (!value) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `${(num * 100).toFixed(2)}%`;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  try {
    return format(parseISO(value), "MM/dd/yyyy");
  } catch {
    return value;
  }
};

const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

const isPreLeased = (commencementDate: string | null | undefined): boolean => {
  if (!commencementDate) return false;
  return commencementDate.slice(0, 10) > getTodayDateStr();
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    active: { variant: "default", label: "Active" },
    pending: { variant: "secondary", label: "Pending" },
    expired: { variant: "destructive", label: "Expired" },
    terminated: { variant: "outline", label: "Terminated" },
    month_to_month: { variant: "secondary", label: "Month-to-Month" },
  };
  const config = variants[status] || { variant: "outline", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const getLeaseTypeBadge = (type: string) => {
  const labels: Record<string, string> = {
    nnn: "NNN",
    modified_gross: "Modified Gross",
    full_service: "Full Service",
    absolute_net: "Absolute Net",
    double_net: "Double Net",
  };
  return <Badge variant="outline">{labels[type] || type}</Badge>;
};

const getExpirationWarning = (expirationDate: string | null) => {
  if (!expirationDate) return null;
  const daysUntil = differenceInDays(parseISO(expirationDate), new Date());
  if (daysUntil < 0) return <Badge variant="destructive">Expired</Badge>;
  if (daysUntil <= 90) return <Badge variant="destructive">{daysUntil}d</Badge>;
  if (daysUntil <= 180) return <Badge variant="secondary">{daysUntil}d</Badge>;
  return null;
};

export default function CommercialTenants() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<CommercialTenant | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<CommercialTenant | null>(null);

  const tenantsQueryUrl = (() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString();
    return qs ? `/api/commercial-tenants?${qs}` : "/api/commercial-tenants";
  })();

  const { data: tenants, isLoading, error } = useQuery<CommercialTenant[]>({
    queryKey: ["/api/commercial-tenants", search, statusFilter],
    queryFn: async () => {
      const res = await fetch(tenantsQueryUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tenants");
      return res.json();
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["/api/commercial-tenants/analytics/summary"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/commercial-tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commercial-tenants"] });
      toast({ title: "Tenant deleted successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error deleting tenant", description: err.message, variant: "destructive" });
    },
  });

  const filteredTenants = tenants?.filter(t => {
    if (statusFilter && t.tenantStatus !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        t.tenantName?.toLowerCase().includes(s) ||
        t.tradeName?.toLowerCase().includes(s) ||
        t.suiteNumber?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleViewDetails = (tenant: CommercialTenant) => {
    setSelectedTenant(tenant);
    setIsDetailOpen(true);
  };

  const handleEdit = (tenant: CommercialTenant) => {
    setEditingTenant(tenant);
    setIsFormOpen(true);
  };

  const handleDelete = (tenant: CommercialTenant) => {
    if (confirm(`Delete tenant "${tenant.tenantName}"? This cannot be undone.`)) {
      deleteMutation.mutate(tenant.id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageTour tourId={TOUR_IDS.COMMERCIAL_TENANTS} steps={commercialTenantsTourSteps} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commercial Tenants</h1>
          <p className="text-muted-foreground">Manage retail and commercial lease abstracts</p>
        </div>
      </div>

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="cam" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            CAM Reconciliation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4">
      <div className="flex justify-end">
        <div className="flex gap-2" data-tour="tenants-add">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Leases
          </Button>
          <Button onClick={() => { setEditingTenant(null); setIsFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4" data-tour="tenants-analytics">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Tenants</span>
              </div>
              <div className="text-2xl font-bold">{summary.totalTenants || 0}</div>
              <div className="text-xs text-muted-foreground">{summary.activeTenants || 0} active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total SF</span>
              </div>
              <div className="text-2xl font-bold">{(summary.totalSquareFootage || 0).toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Annual Rent</span>
              </div>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalAnnualRent)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Rent/SF</span>
              </div>
              <div className="text-2xl font-bold">${(summary.avgRentPerSF || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Expiring 90d</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">{summary.expiringWithin90Days || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Pre-Leased SF</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {(tenants?.filter(t => isPreLeased(t.leaseCommencementDate))
                  .reduce((sum, t) => sum + (t.squareFootage ? parseFloat(t.squareFootage) : 0), 0) || 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {tenants?.filter(t => isPreLeased(t.leaseCommencementDate)).length || 0} future tenant(s)
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lease Abstract List</CardTitle>
            <div className="flex gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {statusFilter ? statusFilter.replace("_", " ") : "All Status"}
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setStatusFilter(null)}>All Status</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStatusFilter("active")}>Active</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pending</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("expired")}>Expired</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("month_to_month")}>Month-to-Month</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">Unable to load tenants. Please try again.</div>
          ) : !filteredTenants?.length ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No tenants in portfolio</h3>
              <p className="text-muted-foreground mb-4">
                Add tenants manually or import from a lease abstract document
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Leases
                </Button>
                <Button onClick={() => { setEditingTenant(null); setIsFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tenant
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table data-tour="tenants-list">
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Suite</TableHead>
                  <TableHead>SF</TableHead>
                  <TableHead>Base Rent</TableHead>
                  <TableHead>Rent/SF</TableHead>
                  <TableHead>Lease Type</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => (
                  <TableRow 
                    key={tenant.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewDetails(tenant)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{tenant.tenantName}</div>
                        {tenant.tradeName && (
                          <div className="text-xs text-muted-foreground">dba {tenant.tradeName}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{tenant.suiteNumber || "-"}</TableCell>
                    <TableCell>{tenant.squareFootage ? parseFloat(tenant.squareFootage).toLocaleString() : "-"}</TableCell>
                    <TableCell>{formatCurrency(tenant.currentBaseRent)}</TableCell>
                    <TableCell>{formatCurrency(tenant.baseRentPerSF)}</TableCell>
                    <TableCell>{getLeaseTypeBadge(tenant.leaseType)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{formatDate(tenant.leaseExpirationDate)}</span>
                        {getExpirationWarning(tenant.leaseExpirationDate)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(tenant.tenantStatus)}
                        {isPreLeased(tenant.leaseCommencementDate) && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">
                            Pre-Leased
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(tenant)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(tenant)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDelete(tenant)}
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
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="cam">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <CAMReconciliation />
          </Suspense>
        </TabsContent>
      </Tabs>

      <UnifiedTenantFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        context="operations"
        tenant={editingTenant}
      />

      <TenantDetailSheet
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        tenant={selectedTenant}
        onEdit={handleEdit}
      />

      <LeaseImportWizard
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
      />
    </div>
  );
}
