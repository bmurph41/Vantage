import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Search, Building2, Users, CreditCard, DollarSign,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ArrowRight, Loader2, Package,
} from "lucide-react";

interface OrgRow {
  id: string;
  name: string;
  ssoEnabled: boolean;
  mfaRequired: boolean;
  benchmarkOptIn: boolean;
  createdAt: string;
  memberCount: number;
  planName: string | null;
  subStatus: string | null;
  mrrCents: number | null;
  interval: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

interface OrgsResponse {
  rows: OrgRow[];
  pagination: Pagination;
}

interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface OrgPack {
  id: string;
  packType: string;
  status: string;
  purchasedAt: string;
  expiresAt: string | null;
}

interface OrgDetail {
  id: string;
  name: string;
  ssoEnabled: boolean;
  ssoEnforced: boolean;
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  benchmarkOptIn: boolean;
  createdAt: string;
  members: OrgMember[];
  subscription: {
    planName: string | null;
    status: string | null;
    mrrCents: number | null;
    interval: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  packs: OrgPack[];
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

function getStatusBadge(isActive: boolean) {
  return isActive ? (
    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Active</Badge>
  ) : (
    <Badge variant="destructive">Disabled</Badge>
  );
}

export default function AdminOrganizationsPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("createdAt:desc");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [transferOwnerId, setTransferOwnerId] = useState<string>("");
  const [grantPackType, setGrantPackType] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (sort) params.set("sort", sort);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return params.toString();
  }, [debouncedSearch, sort, page, pageSize]);

  const { data, isLoading } = useQuery<OrgsResponse>({
    queryKey: [`/api/admin/organizations?${buildQueryString()}`],
  });

  const { data: orgDetail, isLoading: detailLoading } = useQuery<OrgDetail>({
    queryKey: ["/api/admin/organizations", selectedOrgId],
    enabled: !!selectedOrgId,
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async ({ orgId, newOwnerId }: { orgId: string; newOwnerId: string }) => {
      await apiRequest("POST", `/api/admin/organizations/${orgId}/transfer-ownership`, { newOwnerId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", selectedOrgId] });
      }
      setTransferOwnerId("");
      toast({ title: "Ownership transferred successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error transferring ownership", description: err.message, variant: "destructive" });
    },
  });

  const grantPackMutation = useMutation({
    mutationFn: async ({ orgId, packType }: { orgId: string; packType: string }) => {
      await apiRequest("POST", `/api/admin/organizations/${orgId}/packs/grant`, { packType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", selectedOrgId] });
      }
      setGrantPackType("");
      toast({ title: "Pack granted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error granting pack", description: err.message, variant: "destructive" });
    },
  });

  const revokePackMutation = useMutation({
    mutationFn: async ({ orgId, packType }: { orgId: string; packType: string }) => {
      await apiRequest("POST", `/api/admin/organizations/${orgId}/packs/revoke`, { packType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      if (selectedOrgId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations", selectedOrgId] });
      }
      toast({ title: "Pack revoked successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error revoking pack", description: err.message, variant: "destructive" });
    },
  });

  const openDetail = (id: string) => {
    setSelectedOrgId(id);
    setDrawerOpen(true);
    setTransferOwnerId("");
    setGrantPackType("");
  };

  const handleTransferOwnership = () => {
    if (!transferOwnerId || !selectedOrgId) return;
    if (confirm("Are you sure you want to transfer ownership? The current owner will be demoted to editor.")) {
      transferOwnershipMutation.mutate({ orgId: selectedOrgId, newOwnerId: transferOwnerId });
    }
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

  const pagination = data?.pagination;
  const rows = data?.rows ?? [];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Organizations</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage organizations, members, and ownership</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1">Name <SortIcon field="name" /></span>
              </TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("createdAt")}>
                <span className="flex items-center gap-1">Created <SortIcon field="createdAt" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No organizations found
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
                        <Building2 className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{row.memberCount}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.planName || "—"}</TableCell>
                  <TableCell>{getSubStatusBadge(row.subStatus)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.mrrCents ? formatCurrency(row.mrrCents) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(row.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detailLoading ? "Loading…" : orgDetail?.name || "Organization"}</SheetTitle>
            <SheetDescription>Organization details and member management</SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : orgDetail ? (
            <div className="space-y-6 mt-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created</span>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(orgDetail.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Members</span>
                    <p className="font-medium text-gray-900 dark:text-white">{orgDetail.members.length}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">SSO</span>
                    <p className="font-medium text-gray-900 dark:text-white">{orgDetail.ssoEnabled ? "Enabled" : "Disabled"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">MFA Required</span>
                    <p className="font-medium text-gray-900 dark:text-white">{orgDetail.mfaRequired ? "Yes" : "No"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {orgDetail.subscription && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Subscription</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Plan</span>
                        <p className="font-medium text-gray-900 dark:text-white">{orgDetail.subscription.planName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status</span>
                        <div className="mt-0.5">{getSubStatusBadge(orgDetail.subscription.status)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">MRR</span>
                        <p className="font-medium text-gray-900 dark:text-white">{orgDetail.subscription.mrrCents ? formatCurrency(orgDetail.subscription.mrrCents) : "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Interval</span>
                        <p className="font-medium text-gray-900 dark:text-white capitalize">{orgDetail.subscription.interval || "—"}</p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Members</h3>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Role</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Last Login</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgDetail.members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="text-sm font-medium">{member.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                          <TableCell>{getRoleBadge(member.role)}</TableCell>
                          <TableCell>{getStatusBadge(member.isActive)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(member.lastLoginAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Transfer Ownership</h3>
                <p className="text-xs text-muted-foreground">Transfer the owner role to another member. The current owner will become an editor.</p>
                <div className="flex items-center gap-2">
                  <Select value={transferOwnerId} onValueChange={setTransferOwnerId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select new owner…" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgDetail.members
                        .filter((m) => m.role !== "owner")
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.email})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!transferOwnerId || transferOwnershipMutation.isPending}
                    onClick={handleTransferOwnership}
                  >
                    {transferOwnershipMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-1" />
                    )}
                    Transfer
                  </Button>
                </div>
              </div>

              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Packs</h3>
                {orgDetail.packs.length > 0 && (
                  <div className="space-y-2">
                    {orgDetail.packs.map((pack) => (
                      <div key={pack.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{pack.packType.replace(/_/g, " ")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={pack.status === "active" ? "default" : "secondary"} className={pack.status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0" : ""}>
                            {pack.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(pack.purchasedAt)}</span>
                          {pack.status === "active" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={revokePackMutation.isPending}
                              onClick={() => {
                                if (confirm(`Revoke "${pack.packType.replace(/_/g, " ")}" pack from this organization?`)) {
                                  revokePackMutation.mutate({ orgId: orgDetail.id, packType: pack.packType });
                                }
                              }}
                            >
                              {revokePackMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Revoke"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grant Pack</h4>
                  <div className="flex items-center gap-2">
                    <Select value={grantPackType} onValueChange={setGrantPackType}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select pack type…" />
                      </SelectTrigger>
                      <SelectContent>
                        {["fund_management", "lp_portal", "prospecting", "analytics_pro", "owner", "investor", "broker", "operations"].map((pt) => (
                          <SelectItem key={pt} value={pt}>
                            {pt.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!grantPackType || grantPackMutation.isPending}
                      onClick={() => {
                        if (grantPackType && selectedOrgId) {
                          grantPackMutation.mutate({ orgId: selectedOrgId, packType: grantPackType });
                        }
                      }}
                    >
                      {grantPackMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Package className="h-4 w-4 mr-1" />
                      )}
                      Grant
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
