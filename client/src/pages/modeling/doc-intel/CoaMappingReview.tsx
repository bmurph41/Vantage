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
  canonicalAccountId: string | null;
  canonicalAccountName: string | null;
  canonicalAccountCode: string | null;
  profitCenterId: string | null;
  profitCenterName: string | null;
  subCenterId: string | null;
  confidence: number;
  method: string;
  status: string;
  statementType: string | null;
};

type MappingStats = {
  autoMapped: number;
  needsReview: number;
  approved: number;
  overridden: number;
  total: number;
};

type ProfitCenter = {
  id: string;
  name: string;
  subCenters: { id: string; name: string }[];
};

type CanonicalAccount = {
  id: string;
  code: string;
  name: string;
  statementType: string;
  profitCenterId: string;
  subCenterId: string | null;
};

type TaxonomyTree = {
  profitCenters: ProfitCenter[];
  accounts: CanonicalAccount[];
};

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "NEEDS_REVIEW", label: "Needs Review" },
  { value: "AUTO_MAPPED", label: "Auto-Mapped" },
  { value: "APPROVED", label: "Approved" },
  { value: "OVERRIDDEN", label: "Overridden" },
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
  };
  return (
    <Badge variant="outline" className={`border-0 ${variants[status] || ""}`}>
      {status.replace("_", " ")}
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === queue.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queue.map((item) => item.id)));
    }
  };

  const openOverrideDialog = (item: MappedItem) => {
    setOverrideItem(item);
    setSelectedProfitCenter(item.profitCenterId || "");
    setSelectedAccount("");
    setOverrideDialogOpen(true);
  };

  const handleOverrideSubmit = () => {
    if (!overrideItem || !selectedAccount || !selectedProfitCenter) return;
    const account = taxonomy?.accounts.find((a) => a.id === selectedAccount);
    overrideMutation.mutate({
      extractedItemId: overrideItem.extractedItemId,
      canonicalAccountId: selectedAccount,
      profitCenterId: selectedProfitCenter,
      subCenterId: account?.subCenterId || null,
      createAlias: true,
    });
  };

  const filteredAccounts = taxonomy?.accounts.filter(
    (a) => a.profitCenterId === selectedProfitCenter
  ) || [];

  const isLoading = statsLoading || queueLoading;

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : queue.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No items found</p>
              <p className="text-sm mt-1">
                {activeFilter === "all"
                  ? "No mapped items for this upload."
                  : `No items with status "${activeFilter.replace("_", " ")}".`}
              </p>
            </div>
          ) : (
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
                {queue.map((item) => (
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
                      {item.canonicalAccountName ? (
                        <div>
                          <span className="font-medium">{item.canonicalAccountName}</span>
                          {item.canonicalAccountCode && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({item.canonicalAccountCode})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Unmapped</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.profitCenterName || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getConfidenceBg(item.confidence)} ${getConfidenceColor(item.confidence)}`}
                      >
                        {Math.round(item.confidence)}%
                      </span>
                    </TableCell>
                    <TableCell>{getMethodBadge(item.method)}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.status !== "APPROVED" && (
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
