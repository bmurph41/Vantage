import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Anchor, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Clock, Loader2,
  ArrowRight, Database, Zap, Settings, ChevronRight, Activity, Shield,
  BarChart3, GitMerge, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "Never";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function HealthBadge({ health }: { health: string }) {
  if (health === "healthy") return (
    <Badge className="bg-green-600 text-white gap-1">
      <CheckCircle2 className="h-3 w-3" />Healthy
    </Badge>
  );
  if (health === "warning") return (
    <Badge className="bg-amber-500 text-white gap-1">
      <AlertTriangle className="h-3 w-3" />Warning
    </Badge>
  );
  if (health === "error") return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="h-3 w-3" />Error
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <XCircle className="h-3 w-3" />Disconnected
    </Badge>
  );
}

function StatusDot({ health }: { health: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-green-500",
    warning: "bg-amber-400",
    error: "bg-red-500",
    disconnected: "bg-muted-foreground/40",
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[health] || colors.disconnected} shrink-0`} />;
}

// ── Conflict resolution dialog ────────────────────────────────────────────────

function ConflictDialog({
  conflict,
  onClose,
  onResolve,
  isPending,
}: {
  conflict: any;
  onClose: () => void;
  onResolve: (id: string, resolution: string) => void;
  isPending: boolean;
}) {
  const [choice, setChoice] = useState<"use_pms" | "use_manual" | null>(null);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
              <GitMerge className="h-4 w-4 text-amber-600" />
            </div>
            <DialogTitle>Resolve Data Conflict</DialogTitle>
          </div>
          <DialogDescription>
            The {conflict.pmsSource} import differs from your manually entered data. Choose which value to keep.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/20 p-3 space-y-1 text-xs">
            <p><span className="text-muted-foreground">Entity:</span> <strong>{conflict.entityType}</strong> · <code className="bg-muted px-1 rounded">{conflict.entityId}</code></p>
            <p><span className="text-muted-foreground">Field:</span> <strong>{conflict.fieldName}</strong></p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setChoice("use_pms")}
              className={`rounded-lg border-2 p-3 text-left transition-all ${choice === "use_pms" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40"}`}
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{conflict.pmsSource}</p>
              <p className="text-sm font-medium break-all">{String(conflict.pmsValue ?? "—")}</p>
              <p className="text-xs text-muted-foreground mt-1">From sync</p>
            </button>
            <button
              type="button"
              onClick={() => setChoice("use_manual")}
              className={`rounded-lg border-2 p-3 text-left transition-all ${choice === "use_manual" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/40"}`}
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Manual Entry</p>
              <p className="text-sm font-medium break-all">{String(conflict.manualValue ?? "—")}</p>
              <p className="text-xs text-muted-foreground mt-1">Entered in Vantage</p>
            </button>
          </div>

          {choice && (
            <Alert className="py-2">
              <CheckCircle2 className="h-3 w-3" />
              <AlertDescription className="text-xs">
                The <strong>{choice === "use_pms" ? conflict.pmsSource : "manual"}</strong> value will become the authoritative source for this field.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => choice && onResolve(conflict.id, choice)}
            disabled={!choice || isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Apply Resolution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Connected PMS card ────────────────────────────────────────────────────────

function PmsCard({ conn, onSync, syncPending }: { conn: any; onSync: (key: string) => void; syncPending: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`relative overflow-hidden transition-all ${conn.health === "healthy" ? "border-green-200 dark:border-green-800" : conn.health === "error" ? "border-red-200 dark:border-red-800" : conn.health === "warning" ? "border-amber-200 dark:border-amber-800" : ""}`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${conn.health === "healthy" ? "bg-green-500" : conn.health === "error" ? "bg-red-500" : conn.health === "warning" ? "bg-amber-400" : "bg-border"}`} />

      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center shrink-0">
              <Anchor className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm">{conn.name}</CardTitle>
              <CardDescription className="text-xs">{conn.category}</CardDescription>
            </div>
          </div>
          <HealthBadge health={conn.health} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {conn.errorMessage && (
          <Alert className="py-2 border-red-200 bg-red-50 dark:bg-red-950/20">
            <AlertTriangle className="h-3 w-3 text-red-600" />
            <AlertDescription className="text-xs text-red-700 dark:text-red-400">{conn.errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 rounded-md bg-muted/40">
            <p className="font-semibold text-foreground">{conn.metrics?.totalRecordsImported?.toLocaleString() ?? "—"}</p>
            <p className="text-muted-foreground">Records</p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/40">
            <p className="font-semibold text-foreground">{conn.metrics?.totalSyncs ?? "—"}</p>
            <p className="text-muted-foreground">Total Syncs</p>
          </div>
          <div className="text-center p-2 rounded-md bg-muted/40">
            <p className={`font-semibold ${conn.metrics?.healthScore != null && conn.metrics.healthScore < 80 ? "text-amber-600" : "text-foreground"}`}>
              {conn.metrics?.healthScore != null ? `${conn.metrics.healthScore}%` : "—"}
            </p>
            <p className="text-muted-foreground">Success</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>Last sync: {timeAgo(conn.lastSyncAt)}</span>
          </div>
          {conn.metrics?.lastSuccessfulSyncAt && (
            <span>Last success: {timeAgo(conn.metrics.lastSuccessfulSyncAt)}</span>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            onClick={() => onSync(conn.key)}
            disabled={syncPending}
          >
            {syncPending
              ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Syncing…</>
              : <><RefreshCw className="h-3 w-3 mr-1" />Sync Now</>
            }
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-3 pt-1 border-t">
            <p className="text-xs font-medium text-muted-foreground">Recent Sync History</p>
            {conn.recentHistory?.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sync history yet.</p>
            ) : (
              <div className="space-y-1.5">
                {conn.recentHistory?.map((h: any) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <StatusDot health={h.status === "success" || h.status === "completed" ? "healthy" : h.status === "partial" ? "warning" : "error"} />
                    <span className="text-muted-foreground shrink-0">{timeAgo(h.startedAt)}</span>
                    <span className="text-muted-foreground shrink-0">·</span>
                    <span className="truncate">{h.recordsProcessed?.toLocaleString()} records</span>
                    {h.errorCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] shrink-0">{h.errorCount} err</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <p className="text-xs font-medium text-muted-foreground">Data Mappings</p>
            <div className="space-y-1">
              {conn.dataMappings?.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                  <span className="font-medium text-foreground">{m.sourceEntity}</span>
                  <span>→</span>
                  <span>{m.targetModule} / {m.targetEntity}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{m.frequency}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Conflicts panel ───────────────────────────────────────────────────────────

function ConflictsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedConflict, setSelectedConflict] = useState<any>(null);

  const { data, isLoading } = useQuery<{ conflicts: any[]; total: number }>({
    queryKey: ["/api/integrations/pms/conflicts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/pms/conflicts");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const resolveConflict = useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      const res = await apiRequest("POST", `/api/integrations/pms/conflicts/${id}/resolve`, { resolution });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integrations/pms/conflicts"] });
      setSelectedConflict(null);
      toast({ title: "Conflict resolved", description: "The data source preference has been saved." });
    },
    onError: () => {
      toast({ title: "Failed to resolve", variant: "destructive" });
    },
  });

  const dismissAll = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/pms/conflicts/dismiss-all", {});
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/integrations/pms/conflicts"] });
      toast({ title: "All conflicts dismissed" });
    },
  });

  const conflicts = data?.conflicts ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <p className="text-sm font-medium">No conflicts detected</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          When imported PMS data differs from manually entered values, conflicts will appear here for you to review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{conflicts.length} open {conflicts.length === 1 ? "conflict" : "conflicts"}</p>
        <Button size="sm" variant="outline" onClick={() => dismissAll.mutate()} disabled={dismissAll.isPending}>
          {dismissAll.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          Dismiss All
        </Button>
      </div>

      <div className="space-y-3">
        {conflicts.map((conflict: any) => (
          <Card key={conflict.id} className="border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-sm font-medium">{conflict.entityType} · {conflict.fieldName}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{conflict.pmsSource}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2">
                      <p className="text-muted-foreground mb-0.5">From {conflict.pmsSource}</p>
                      <p className="font-medium truncate">{String(conflict.pmsValue ?? "—")}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 border p-2">
                      <p className="text-muted-foreground mb-0.5">Manual entry</p>
                      <p className="font-medium truncate">{String(conflict.manualValue ?? "—")}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Detected {timeAgo(conflict.detectedAt)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setSelectedConflict(conflict)}
                >
                  Resolve <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedConflict && (
        <ConflictDialog
          conflict={selectedConflict}
          onClose={() => setSelectedConflict(null)}
          onResolve={(id, resolution) => resolveConflict.mutate({ id, resolution })}
          isPending={resolveConflict.isPending}
        />
      )}
    </div>
  );
}

// ── Available PMS to connect ──────────────────────────────────────────────────

function AvailablePmsCard({ pms, onConnect }: { pms: any; onConnect: (key: string) => void }) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
          <Anchor className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{pms.name}</p>
          <p className="text-xs text-muted-foreground truncate">{pms.description?.slice(0, 60)}…</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onConnect(pms.key)} className="shrink-0 text-xs">
          <Zap className="h-3 w-3 mr-1" />Connect
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Summary stat bar ──────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: any }) {
  const stats = [
    { label: "Connected", value: summary?.connectedCount ?? 0, icon: <Anchor className="h-4 w-4 text-blue-500" /> },
    { label: "Healthy", value: summary?.healthyCount ?? 0, icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
    { label: "Errors", value: summary?.errorCount ?? 0, icon: <XCircle className="h-4 w-4 text-red-500" /> },
    { label: "Records Imported", value: summary?.totalRecordsImported?.toLocaleString() ?? "0", icon: <Database className="h-4 w-4 text-purple-500" /> },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(stat => (
        <Card key={stat.label}>
          <CardContent className="p-4 flex items-center gap-3">
            {stat.icon}
            <div>
              <p className="text-lg font-bold leading-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarinaPmsStatusPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [syncingKey, setSyncingKey] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<{
    connected: any[];
    available: any[];
    summary: any;
  }>({
    queryKey: ["/api/integrations/pms/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/pms/status");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: conflictsData } = useQuery<{ total: number }>({
    queryKey: ["/api/integrations/pms/conflicts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/integrations/pms/conflicts");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const syncNow = useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/integrations/${key}/sync`, { executeNow: true, fullSync: false });
      return res.json();
    },
    onSuccess: (_, key) => {
      qc.invalidateQueries({ queryKey: ["/api/integrations/pms/status"] });
      setSyncingKey(null);
      toast({ title: "Sync complete", description: "Data has been refreshed from your PMS." });
    },
    onError: (_, key) => {
      setSyncingKey(null);
      toast({ title: "Sync failed", description: "Check your connection and try again.", variant: "destructive" });
    },
  });

  function handleSync(key: string) {
    setSyncingKey(key);
    syncNow.mutate(key);
  }

  function handleConnectPms(key: string) {
    setLocation(`/settings/integrations/${key}`);
  }

  const conflictCount = conflictsData?.total ?? 0;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Anchor className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-semibold">Marina PMS Integrations</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Connect your marina property management system to automatically sync reservation data, slip occupancy, and revenue actuals into Vantage.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {/* Conflict alert banner */}
      {conflictCount > 0 && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Data conflicts detected</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {conflictCount} {conflictCount === 1 ? "conflict" : "conflicts"} found between PMS imports and manually entered data. Review them in the Conflicts tab below.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <SummaryBar summary={data?.summary} />
      )}

      {/* Main tabs */}
      <Tabs defaultValue="connected">
        <TabsList className="mb-4">
          <TabsTrigger value="connected" className="gap-2">
            <Activity className="h-3.5 w-3.5" />
            Connected
            {data?.connected?.length ? (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{data.connected.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-2">
            <GitMerge className="h-3.5 w-3.5" />
            Conflicts
            {conflictCount > 0 && (
              <Badge className="ml-1 text-[10px] px-1.5 bg-amber-500 text-white">{conflictCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="available" className="gap-2">
            <Zap className="h-3.5 w-3.5" />Available
          </TabsTrigger>
        </TabsList>

        {/* Connected PMS */}
        <TabsContent value="connected" className="space-y-4">
          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-56 w-full" />)}
            </div>
          ) : data?.connected?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <Anchor className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">No marina PMS connected</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Connect Dockwa, Havenstar, or another marina management system to automatically sync your operational data.
                </p>
              </div>
              <Button size="sm" onClick={() => setLocation("/settings/integrations")}>
                <Settings className="h-3.5 w-3.5 mr-1.5" />Browse Integrations
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {data?.connected?.map((conn: any) => (
                <PmsCard
                  key={conn.key}
                  conn={conn}
                  onSync={handleSync}
                  syncPending={syncingKey === conn.key && syncNow.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Conflicts */}
        <TabsContent value="conflicts">
          <ConflictsPanel />
        </TabsContent>

        {/* Available */}
        <TabsContent value="available" className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : data?.available?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">All supported marina PMS systems are already connected.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground pb-1">
                Connect any of the following marina management systems to start syncing data automatically.
              </p>
              {data?.available?.map((pms: any) => (
                <AvailablePmsCard key={pms.key} pms={pms} onConnect={handleConnectPms} />
              ))}
            </>
          )}

          <div className="rounded-lg border border-dashed p-4 mt-4">
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How the connector framework works</p>
                <p>Vantage uses a read-only sync approach — it pulls data from your PMS but never writes back. All credentials are AES-256 encrypted. Sync runs on the schedule you configure and stores imported records alongside your existing Vantage data.</p>
                <p>Adding a new PMS system? Each connector maps the source system's data model to Vantage's rent roll, CRM, and financials schemas automatically.</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
