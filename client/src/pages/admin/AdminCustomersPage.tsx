import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Search, Download, Users, CreditCard, Clock, AlertTriangle, DollarSign,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, UserCheck, UserX,
  Building, CalendarDays, Mail, Phone, Tag, Plus, Loader2,
  Ban, RefreshCw, CalendarPlus, ArrowRight, UserPlus, KeyRound, MailCheck,
} from "lucide-react";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  orgName: string | null;
  planName: string | null;
  subStatus: string | null;
  interval: string | null;
  mrrCents: number | null;
  currentPeriodEnd: string | null;
}

interface Totals {
  customers: number;
  activeSubs: number;
  trialing: number;
  pastDue: number;
  mrrCents: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

interface CustomersResponse {
  rows: CustomerRow[];
  totals: Totals;
  pagination: Pagination;
}

interface CustomerNote {
  id: string;
  userId: string;
  adminUserId: string;
  note: string;
  tags: string[] | null;
  createdAt: string;
}

interface AuditLogEntry {
  id: string;
  adminUserId: string;
  action: string;
  targetUserId: string | null;
  metadataJson: Record<string, any> | null;
  createdAt: string;
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  orgName: string | null;
  planName: string | null;
  subStatus: string | null;
  interval: string | null;
  mrrCents: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  planKey: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  notes: CustomerNote[];
  auditLog: AuditLogEntry[];
  usage?: {
    models_count: number;
    deals_count: number;
    sales_comps_count: number;
    dd_projects_count: number;
    documents_count: number;
    contacts_count: number;
  };
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getStatusBadge(isActive: boolean) {
  return isActive ? (
    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Active</Badge>
  ) : (
    <Badge variant="destructive">Disabled</Badge>
  );
}

function getSubStatusBadge(status: string | null) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  switch (status.toLowerCase()) {
    case "active":
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Active</Badge>;
    case "trialing":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0">Trialing</Badge>;
    case "past_due":
      return <Badge variant="destructive">Past Due</Badge>;
    case "canceled":
      return <Badge variant="secondary">Canceled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getRoleBadge(role: string) {
  switch (role.toLowerCase()) {
    case "owner":
      return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-0">Owner</Badge>;
    case "editor":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0">Editor</Badge>;
    case "viewer":
      return <Badge variant="secondary">Viewer</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
}

export default function AdminCustomersPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");
  const [subStatus, setSubStatus] = useState("all");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [newNoteTags, setNewNoteTags] = useState("");
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [changePlanForm, setChangePlanForm] = useState({ planName: "", planKey: "", interval: "month", mrrDollars: "" });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", orgId: "", role: "viewer" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, role, subStatus]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (status !== "all") params.set("status", status);
    if (role !== "all") params.set("role", role);
    if (subStatus !== "all") params.set("subStatus", subStatus);
    if (sort) params.set("sort", sort);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return params.toString();
  }, [debouncedSearch, status, role, subStatus, sort, page, pageSize]);

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: [`/api/admin/customers?${buildQueryString()}`],
  });

  const { data: customerDetail, isLoading: detailLoading } = useQuery<CustomerDetail>({
    queryKey: ["/api/admin/customers", selectedCustomerId],
    enabled: !!selectedCustomerId,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await apiRequest("POST", `/api/admin/customers/${id}/status`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      if (selectedCustomerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", selectedCustomerId] });
      }
      toast({ title: "Customer status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error updating status", description: err.message, variant: "destructive" });
    },
  });

  const noteMutation = useMutation({
    mutationFn: async ({ id, note, tags }: { id: string; note: string; tags?: string[] }) => {
      await apiRequest("POST", `/api/admin/customers/${id}/notes`, { note, tags });
    },
    onSuccess: () => {
      if (selectedCustomerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", selectedCustomerId] });
      }
      setNewNote("");
      setNewNoteTags("");
      toast({ title: "Note added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error adding note", description: err.message, variant: "destructive" });
    },
  });

  const cancelSubMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/customers/${id}/subscription/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      if (selectedCustomerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", selectedCustomerId] });
      }
      toast({ title: "Subscription canceled" });
    },
    onError: (err: Error) => {
      toast({ title: "Error canceling subscription", description: err.message, variant: "destructive" });
    },
  });

  const reactivateSubMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/customers/${id}/subscription/reactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      if (selectedCustomerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", selectedCustomerId] });
      }
      toast({ title: "Subscription reactivated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error reactivating subscription", description: err.message, variant: "destructive" });
    },
  });

  const extendTrialMutation = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      await apiRequest("POST", `/api/admin/customers/${id}/subscription/extend-trial`, { days });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      if (selectedCustomerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", selectedCustomerId] });
      }
      toast({ title: "Trial extended" });
    },
    onError: (err: Error) => {
      toast({ title: "Error extending trial", description: err.message, variant: "destructive" });
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ id, planKey, planName, interval, mrrCents }: { id: string; planKey: string; planName: string; interval: string; mrrCents: number }) => {
      await apiRequest("POST", `/api/admin/customers/${id}/subscription/change-plan`, { planKey, planName, interval, mrrCents });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      if (selectedCustomerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", selectedCustomerId] });
      }
      setShowChangePlan(false);
      setChangePlanForm({ planName: "", planKey: "", interval: "month", mrrDollars: "" });
      toast({ title: "Plan changed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error changing plan", description: err.message, variant: "destructive" });
    },
  });

  const { data: orgsData } = useQuery<{ rows: { id: string; name: string }[] }>({
    queryKey: ["/api/admin/organizations?pageSize=100"],
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; orgId: string; role: string }) => {
      await apiRequest("POST", "/api/admin/customers/invite", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      setInviteOpen(false);
      setInviteForm({ name: "", email: "", orgId: "", role: "viewer" });
      toast({ title: "User invited successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error inviting user", description: err.message, variant: "destructive" });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/customers/${id}/resend-verification`);
    },
    onSuccess: () => {
      if (selectedCustomerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", selectedCustomerId] });
      }
      toast({ title: "Verification email resent" });
    },
    onError: (err: Error) => {
      toast({ title: "Error resending verification", description: err.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/customers/${id}/reset-password`);
    },
    onSuccess: () => {
      toast({ title: "Password reset link generated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error resetting password", description: err.message, variant: "destructive" });
    },
  });

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (status !== "all") params.set("status", status);
      if (role !== "all") params.set("role", role);
      if (subStatus !== "all") params.set("subStatus", subStatus);
      const res = await fetch(`/api/admin/customers/export?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded" });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    }
  };

  const openDetail = (id: number) => {
    setSelectedCustomerId(id);
    setDrawerOpen(true);
    setNewNote("");
    setNewNoteTags("");
  };

  const handleToggleStatus = (cust: CustomerDetail) => {
    const newStatus = cust.isActive ? "disabled" : "active";
    if (confirm(`Are you sure you want to ${cust.isActive ? "disable" : "enable"} ${cust.name}?`)) {
      statusMutation.mutate({ id: cust.id, newStatus });
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedCustomerId) return;
    const tags = newNoteTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    noteMutation.mutate({ id: selectedCustomerId, note: newNote.trim(), tags: tags.length ? tags : undefined });
  };

  const toggleSort = (field: string) => {
    const [currentField, currentDir] = sort.split(":");
    if (currentField === field) {
      setSort(`${field}:${currentDir === "asc" ? "desc" : "asc"}`);
    } else {
      setSort(`${field}:asc`);
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    const [currentField, currentDir] = sort.split(":");
    if (currentField !== field) return <ChevronUp className="h-3 w-3 opacity-20" />;
    return currentDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  const totals = data?.totals;
  const pagination = data?.pagination;
  const rows = data?.rows ?? [];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage customer accounts, subscriptions, and notes</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Total Customers</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{totals?.customers ?? 0}</p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Active Subs</span>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals?.activeSubs ?? 0}</p>
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">Active</Badge>
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Trialing</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals?.trialing ?? 0}</p>
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs">Trial</Badge>
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Past Due</span>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-20 mt-2" />
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals?.pastDue ?? 0}</p>
              <Badge variant="destructive" className="text-xs">Due</Badge>
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">MRR</span>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-24 mt-2" />
          ) : (
            <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{formatCurrency(totals?.mrrCents ?? 0)}</p>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Viewer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subStatus} onValueChange={setSubStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sub Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sub Status</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1">Name <SortIcon field="name" /></span>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Sub Status</TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("mrrCents")}>
                <span className="flex items-center gap-1 justify-end">MRR <SortIcon field="mrrCents" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("createdAt")}>
                <span className="flex items-center gap-1">Joined <SortIcon field="createdAt" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("lastLoginAt")}>
                <span className="flex items-center gap-1">Last Login <SortIcon field="lastLoginAt" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(row.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {getInitials(row.name)}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.email}</TableCell>
                  <TableCell className="text-muted-foreground">{row.orgName || "—"}</TableCell>
                  <TableCell>{getRoleBadge(row.role)}</TableCell>
                  <TableCell>{getStatusBadge(row.isActive)}</TableCell>
                  <TableCell className="text-muted-foreground">{row.planName || "—"}</TableCell>
                  <TableCell>{getSubStatusBadge(row.subStatus)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.mrrCents ? formatCurrency(row.mrrCents) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(row.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(row.lastLoginAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{customerDetail?.name ?? "Customer Detail"}</SheetTitle>
            <SheetDescription>{customerDetail?.email ?? ""}</SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : customerDetail ? (
            <div className="space-y-6 mt-6">
              {/* Profile */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Profile</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DetailField icon={<Users className="h-4 w-4" />} label="Name" value={customerDetail.name} />
                  <DetailField icon={<Mail className="h-4 w-4" />} label="Email" value={customerDetail.email} />
                  <DetailField icon={<Phone className="h-4 w-4" />} label="Phone" value={customerDetail.phone || "—"} />
                  <div>
                    <span className="text-xs text-muted-foreground">Role</span>
                    <div className="mt-1">{getRoleBadge(customerDetail.role)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Status</span>
                    <div className="mt-1 flex items-center gap-2">
                      {getStatusBadge(customerDetail.isActive)}
                      <Button
                        variant={customerDetail.isActive ? "destructive" : "default"}
                        size="sm"
                        onClick={() => handleToggleStatus(customerDetail)}
                        disabled={statusMutation.isPending}
                      >
                        {statusMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : customerDetail.isActive ? (
                          <><UserX className="h-3 w-3 mr-1" /> Disable</>
                        ) : (
                          <><UserCheck className="h-3 w-3 mr-1" /> Enable</>
                        )}
                      </Button>
                    </div>
                  </div>
                  <DetailField icon={<CalendarDays className="h-4 w-4" />} label="Joined" value={formatDate(customerDetail.createdAt)} />
                  <DetailField icon={<Clock className="h-4 w-4" />} label="Last Login" value={formatDate(customerDetail.lastLoginAt)} />
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resendVerificationMutation.isPending}
                    onClick={() => resendVerificationMutation.mutate(customerDetail.id)}
                  >
                    {resendVerificationMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MailCheck className="h-3 w-3 mr-1" />}
                    Resend Verification
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resetPasswordMutation.isPending}
                    onClick={() => {
                      if (confirm(`Send password reset link to ${customerDetail.email}?`)) {
                        resetPasswordMutation.mutate(customerDetail.id);
                      }
                    }}
                  >
                    {resetPasswordMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <KeyRound className="h-3 w-3 mr-1" />}
                    Reset Password
                  </Button>
                </div>
              </section>

              <Separator />

              {/* Organization */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Organization</h3>
                <DetailField icon={<Building className="h-4 w-4" />} label="Org Name" value={customerDetail.orgName || "—"} />
              </section>

              <Separator />

              {/* Usage & Engagement */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Usage & Engagement</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <UsageMetric icon={<Building className="h-4 w-4" />} count={customerDetail.usage?.models_count ?? 0} label="Models" />
                  <UsageMetric icon={<DollarSign className="h-4 w-4" />} count={customerDetail.usage?.deals_count ?? 0} label="Deals" />
                  <UsageMetric icon={<Tag className="h-4 w-4" />} count={customerDetail.usage?.sales_comps_count ?? 0} label="Sales Comps" />
                  <UsageMetric icon={<AlertTriangle className="h-4 w-4" />} count={customerDetail.usage?.dd_projects_count ?? 0} label="DD Projects" />
                  <UsageMetric icon={<Download className="h-4 w-4" />} count={customerDetail.usage?.documents_count ?? 0} label="Documents" />
                  <UsageMetric icon={<Users className="h-4 w-4" />} count={customerDetail.usage?.contacts_count ?? 0} label="Contacts" />
                </div>
              </section>

              <Separator />

              {/* Subscription */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subscription</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DetailField label="Plan" value={customerDetail.planName || "—"} />
                  <div>
                    <span className="text-xs text-muted-foreground">Sub Status</span>
                    <div className="mt-1">{getSubStatusBadge(customerDetail.subStatus)}</div>
                  </div>
                  <DetailField label="Interval" value={customerDetail.interval || "—"} />
                  <DetailField label="MRR" value={customerDetail.mrrCents ? formatCurrency(customerDetail.mrrCents) : "—"} />
                  <DetailField label="Period End" value={formatDate(customerDetail.currentPeriodEnd)} />
                  {customerDetail.providerCustomerId && (
                    <DetailField label="Stripe Customer" value={customerDetail.providerCustomerId} />
                  )}
                  {customerDetail.providerSubscriptionId && (
                    <DetailField label="Stripe Subscription" value={customerDetail.providerSubscriptionId} />
                  )}
                </div>

                {customerDetail.subStatus && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      {(customerDetail.subStatus === "active" || customerDetail.subStatus === "trialing") && (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={cancelSubMutation.isPending}
                          onClick={() => {
                            if (confirm("Are you sure you want to cancel this subscription?")) {
                              cancelSubMutation.mutate(customerDetail.id);
                            }
                          }}
                        >
                          {cancelSubMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Ban className="h-3 w-3 mr-1" />}
                          Cancel Subscription
                        </Button>
                      )}
                      {customerDetail.subStatus === "canceled" && (
                        <Button
                          size="sm"
                          disabled={reactivateSubMutation.isPending}
                          onClick={() => reactivateSubMutation.mutate(customerDetail.id)}
                        >
                          {reactivateSubMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                          Reactivate
                        </Button>
                      )}
                      {customerDetail.subStatus === "trialing" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={extendTrialMutation.isPending}
                          onClick={() => {
                            const input = prompt("How many days to extend the trial? (1-90)", "14");
                            if (input) {
                              const days = parseInt(input, 10);
                              if (!isNaN(days) && days >= 1 && days <= 90) {
                                extendTrialMutation.mutate({ id: customerDetail.id, days });
                              } else {
                                toast({ title: "Invalid input", description: "Please enter a number between 1 and 90", variant: "destructive" });
                              }
                            }
                          }}
                        >
                          {extendTrialMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CalendarPlus className="h-3 w-3 mr-1" />}
                          Extend Trial
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChangePlan(!showChangePlan)}
                      >
                        <ArrowRight className="h-3 w-3 mr-1" />
                        Change Plan
                      </Button>
                    </div>

                    {showChangePlan && (
                      <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Plan Name</label>
                            <Input
                              value={changePlanForm.planName}
                              onChange={(e) => setChangePlanForm({ ...changePlanForm, planName: e.target.value })}
                              placeholder="e.g. Pro"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Plan Key</label>
                            <Input
                              value={changePlanForm.planKey}
                              onChange={(e) => setChangePlanForm({ ...changePlanForm, planKey: e.target.value })}
                              placeholder="e.g. pro"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Interval</label>
                            <Select value={changePlanForm.interval} onValueChange={(v) => setChangePlanForm({ ...changePlanForm, interval: v })}>
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="month">Monthly</SelectItem>
                                <SelectItem value="year">Yearly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">MRR ($)</label>
                            <Input
                              type="number"
                              value={changePlanForm.mrrDollars}
                              onChange={(e) => setChangePlanForm({ ...changePlanForm, mrrDollars: e.target.value })}
                              placeholder="e.g. 49.99"
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={!changePlanForm.planName || !changePlanForm.planKey || changePlanMutation.isPending}
                            onClick={() => {
                              changePlanMutation.mutate({
                                id: customerDetail.id,
                                planKey: changePlanForm.planKey,
                                planName: changePlanForm.planName,
                                interval: changePlanForm.interval,
                                mrrCents: Math.round(parseFloat(changePlanForm.mrrDollars || "0") * 100),
                              });
                            }}
                          >
                            {changePlanMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Save Plan Change
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowChangePlan(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <Separator />

              {/* Notes */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Notes</h3>

                <div className="space-y-3 mb-4">
                  <Textarea
                    placeholder="Add a note…"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <Input
                    placeholder="Tags (comma-separated, optional)"
                    value={newNoteTags}
                    onChange={(e) => setNewNoteTags(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || noteMutation.isPending}
                  >
                    {noteMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    Save Note
                  </Button>
                </div>

                {customerDetail.notes?.length ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {[...customerDetail.notes]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((n) => (
                        <div key={n.id} className="bg-muted/50 rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">Admin</span>
                            <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{n.note}</p>
                          {n.tags && n.tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {n.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                )}
              </section>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Invite User</SheetTitle>
            <SheetDescription>Send an invitation to a new user</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Full name"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={inviteForm.orgId} onValueChange={(v) => setInviteForm({ ...inviteForm, orgId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization…" />
                </SelectTrigger>
                <SelectContent>
                  {(orgsData?.rows ?? []).map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!inviteForm.name || !inviteForm.email || !inviteForm.orgId || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate(inviteForm)}
            >
              {inviteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailField({ icon, label, value }: { icon?: JSX.Element; label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </span>
      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white break-all">{value}</p>
    </div>
  );
}

function UsageMetric({ icon, count, label }: { icon: React.ReactNode; count: number; label: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>
      <div className="text-lg font-bold text-gray-900 dark:text-white">{count}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
