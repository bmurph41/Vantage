import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, Loader2,
  ChevronDown, Shield, Zap, Brain, PenLine, Search, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type MappedItem = {
  id: string;
  extractedItemId: string;
  rawLabel: string;
  amount: string | null;
  period: string | null;
  categoryTier: string | null;
  canonicalAccount: { id: string; code: string; name: string; statementType: string } | null;
  profitCenter: { id: string; code: string; name: string } | null;
  subCenter: { id: string; code: string; name: string } | null;
  confidence: string;
  method: string;
  explanation: string | null;
  reviewedStatus: string;
  reviewedAt: string | null;
  candidates: any[];
};

type MappingStats = {
  autoMapped: number;
  needsReview: number;
  approved: number;
  overridden: number;
  dismissed: number;
  total: number;
};

type CanonicalAccount = {
  id: string;
  code: string;
  name: string;
  statementType: string;
  profitCenterId: string;
  subCenterId: string | null;
};

type ProfitCenterNode = {
  id: string;
  name: string;
  code: string;
  subCenters: { id: string; name: string }[];
  accounts: CanonicalAccount[];
};

type TaxonomyTree = {
  pack: { id: string; name: string; assetClass: string; version: string };
  profitCenters: ProfitCenterNode[];
};

function parseConfidence(val: string | number | null): number {
  const n = parseFloat(String(val ?? '0'));
  return isNaN(n) ? 0 : n <= 1 ? n * 100 : n;
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "AUTO_MAPPED", label: "Auto-Mapped" },
  { value: "APPROVED", label: "Approved" },
  { value: "OVERRIDDEN", label: "Overridden" },
  { value: "DISMISSED", label: "Dismissed" },
];

function getConfidenceColor(confidence: number) {
  if (confidence >= 90) return "text-green-600 dark:text-green-400";
  if (confidence >= 75) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getConfidenceBg(confidence: number) {
  if (confidence >= 90) return "bg-green-100 dark:bg-green-900/30";
  if (confidence >= 75) return "bg-yellow-100 dark:bg-yellow-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function getMethodBadge(method: string) {
  const variants: Record<string, { icon: typeof Zap; className: string }> = {
    EXACT_ALIAS: { icon: Shield, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    RULES: { icon: Zap, className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    EMBEDDING: { icon: Search, className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
    LLM: { icon: Brain, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    MANUAL: { icon: PenLine, className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300" },
  };
  const config = variants[method] || variants.MANUAL;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${config.className} border-0`}>
      <Icon className="h-3 w-3" />
      {method}
    </Badge>
  );
}

function getStatusBadge(status: string) {
  const variants: Record<string, string> = {
    AUTO_MAPPED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    NEEDS_REVIEW: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    OVERRIDDEN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    DISMISSED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <Badge variant="outline" className={`border-0 ${variants[status] || ""}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export default function CoaMappingReview() {
  const { uploadId } = useParams<{ uploadId: string }>();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideItem, setOverrideItem] = useState<MappedItem | null>(null);
  const [selectedProfitCenter, setSelectedProfitCenter] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [createAliasMap, setCreateAliasMap] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const { data: stats, isLoading: statsLoading } = useQuery<MappingStats>({
    queryKey: ['/api/coa-taxonomy/stats', uploadId],
    queryFn: async () => {
      const res = await fetch(`/api/coa-taxonomy/stats?uploadId=${uploadId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!uploadId,
  });

  const { data: queue = [], isLoading: queueLoading } = useQuery<MappedItem[]>({
    queryKey: ['/api/coa-taxonomy/mapping-queue', uploadId, activeFilter],
    queryFn: async () => {
      const statusParam = activeFilter === "all" ? "" : `&status=${activeFilter}`;
      const res = await fetch(`/api/coa-taxonomy/mapping-queue?uploadId=${uploadId}${statusParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch queue");
      return res.json();
    },
    enabled: !!uploadId,
  });

  const { data: taxonomy } = useQuery<TaxonomyTree>({
    queryKey: ['/api/coa-taxonomy/tree'],
    queryFn: async () => {
      const res = await fetch("/api/coa-taxonomy/tree", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch taxonomy");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, createAlias }: { id: string; createAlias: boolean }) => {
      return apiRequest("POST", `/api/coa-taxonomy/approve/${id}`, { createAlias });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/mapping-queue', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/stats', uploadId] });
      toast({ title: "Approved", description: "Mapping has been approved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve", variant: "destructive" });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (mappedItemIds: string[]) => {
      return apiRequest("POST", "/api/coa-taxonomy/bulk-approve", { mappedItemIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/mapping-queue', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/stats', uploadId] });
      setSelectedIds(new Set());
      toast({ title: "Bulk Approved", description: `${selectedIds.size} mappings approved.` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to bulk approve", variant: "destructive" });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: async (data: {
      extractedItemId: string;
      canonicalAccountId: string;
      profitCenterId: string;
      subCenterId: string | null;
      createAlias: boolean;
    }) => {
      return apiRequest("POST", "/api/coa-taxonomy/override", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/mapping-queue', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/stats', uploadId] });
      setOverrideDialogOpen(false);
      setOverrideItem(null);
      setSelectedProfitCenter("");
      setSelectedAccount("");
      toast({ title: "Override Applied", description: "Mapping has been overridden." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to override", variant: "destructive" });
    },
  });

  const remapMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/coa-taxonomy/remap-upload/${uploadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/mapping-queue', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/stats', uploadId] });
      toast({ title: "Remapping Started", description: "All items are being remapped." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remap", variant: "destructive" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return apiRequest("POST", `/api/coa-taxonomy/dismiss/${id}`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/mapping-queue', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/coa-taxonomy/stats', uploadId] });
      toast({ title: "Dismissed", description: "Mapping has been dismissed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to dismiss", variant: "destructive" });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedQueue.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedQueue.map((item) => item.id)));
    }
  };

  const allAccounts: CanonicalAccount[] = taxonomy?.profitCenters.flatMap(pc => pc.accounts) || [];

  const openOverrideDialog = (item: MappedItem) => {
    setOverrideItem(item);
    setSelectedProfitCenter(item.profitCenter?.id || "");
    setSelectedAccount("");
    setOverrideDialogOpen(true);
  };

  const handleOverrideSubmit = () => {
    if (!overrideItem || !selectedAccount || !selectedProfitCenter) return;
    const account = allAccounts.find((a) => a.id === selectedAccount);
    overrideMutation.mutate({
      extractedItemId: overrideItem.extractedItemId,
      canonicalAccountId: selectedAccount,
      profitCenterId: selectedProfitCenter,
      subCenterId: account?.subCenterId || null,
      createAlias: true,
    });
  };

  const filteredAccounts = allAccounts.filter(
    (a) => a.profitCenterId === selectedProfitCenter
  );

  const isLoading = statsLoading || queueLoading;

  const filteredQueue = queue.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.rawLabel.toLowerCase().includes(q) ||
      (item.canonicalAccount?.name || "").toLowerCase().includes(q) ||
      (item.canonicalAccount?.code || "").toLowerCase().includes(q) ||
      (item.profitCenter?.name || "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredQueue.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQueue = filteredQueue.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/modeling/doc-intel">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">COA Mapping Review</h1>
            <p className="text-muted-foreground">
              Review and approve chart of accounts taxonomy mappings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
              disabled={bulkApproveMutation.isPending}
            >
              {bulkApproveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Approve Selected ({selectedIds.size})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => remapMutation.mutate()}
            disabled={remapMutation.isPending}
          >
            {remapMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Remap All
          </Button>
          <Link href={`/modeling/doc-intel/${uploadId}/departmental-pl`}>
            <Button variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              Departmental P&L
            </Button>
          </Link>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Auto-Mapped</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.autoMapped}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Needs Review</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.needsReview}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overridden</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.overridden}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Dismissed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.dismissed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeFilter} onValueChange={setActiveFilter}>
        <TabsList>
          {STATUS_FILTERS.map((filter) => (
            <TabsTrigger key={filter.value} value={filter.value}>
              {filter.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by account name, code, or profit center..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 text-sm border rounded-md bg-background"
          />
        </div>
        {filteredQueue.length !== queue.length && (
          <span className="text-sm text-muted-foreground">
            {filteredQueue.length} of {queue.length} items
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginatedQueue.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No items found</p>
              <p className="text-sm mt-1">
                {searchQuery
                  ? `No items matching "${searchQuery}".`
                  : activeFilter === "all"
                    ? "No mapped items for this upload."
                    : `No items with status "${activeFilter.replace(/_/g, " ")}".`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === queue.length && queue.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Account Label</TableHead>
                  <TableHead>Mapped To</TableHead>
                  <TableHead>Profit Center</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedQueue.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {item.rawLabel}
                    </TableCell>
                    <TableCell>
                      {item.canonicalAccount ? (
                        <div>
                          <span className="font-medium">{item.canonicalAccount.name}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.canonicalAccount.code})
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Unmapped</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.profitCenter?.name || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => { const conf = parseConfidence(item.confidence); return (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getConfidenceBg(conf)} ${getConfidenceColor(conf)}`}
                      >
                        {Math.round(conf)}%
                      </span>
                      ); })()}
                    </TableCell>
                    <TableCell>{getMethodBadge(item.method)}</TableCell>
                    <TableCell>{getStatusBadge(item.reviewedStatus)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.reviewedStatus !== "APPROVED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              approveMutation.mutate({
                                id: item.id,
                                createAlias: createAliasMap[item.id] ?? true,
                              })
                            }
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openOverrideDialog(item)}
                        >
                          <ChevronDown className="h-3.5 w-3.5 mr-1" />
                          Override
                        </Button>
                        {item.reviewedStatus !== "DISMISSED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            onClick={() => dismissMutation.mutate({ id: item.id })}
                            disabled={dismissMutation.isPending}
                          >
                            <AlertCircle className="h-3.5 w-3.5 mr-1" />
                            Dismiss
                          </Button>
                        )}
                        <div className="flex items-center gap-1">
                          <Checkbox
                            id={`alias-${item.id}`}
                            checked={createAliasMap[item.id] ?? true}
                            onCheckedChange={(checked) =>
                              setCreateAliasMap((prev) => ({
                                ...prev,
                                [item.id]: !!checked,
                              }))
                            }
                          />
                          <label
                            htmlFor={`alias-${item.id}`}
                            className="text-xs text-muted-foreground cursor-pointer"
                          >
                            Alias
                          </label>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Page {safePage} of {totalPages} ({filteredQueue.length} items)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Override Mapping</DialogTitle>
            <DialogDescription>
              Select a different canonical account for "{overrideItem?.rawLabel}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Profit Center</label>
              <Select value={selectedProfitCenter} onValueChange={(v) => {
                setSelectedProfitCenter(v);
                setSelectedAccount("");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a profit center" />
                </SelectTrigger>
                <SelectContent>
                  {taxonomy?.profitCenters.map((pc) => (
                    <SelectItem key={pc.id} value={pc.id}>
                      {pc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Canonical Account</label>
              <Select
                value={selectedAccount}
                onValueChange={setSelectedAccount}
                disabled={!selectedProfitCenter}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedProfitCenter ? "Select an account" : "Select a profit center first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {account.code}
                        </span>
                        <span>{account.name}</span>
                        <Badge variant="outline" className="text-[10px] ml-1">
                          {account.statementType}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOverrideSubmit}
              disabled={!selectedAccount || overrideMutation.isPending}
            >
              {overrideMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Apply Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
