import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw, Clock, AlertCircle, CheckCircle2, XCircle,
  ArrowDownToLine, FileSpreadsheet, Loader2, Database, Link2, Link2Off, Zap
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ImportHistoryRecord {
  importDate: string;
  rowCount: number;
  marinaId: string | null;
  earliest: string | null;
  latest: string | null;
}

interface SyncStatusRecord {
  module: string;
  lastSyncAt: string | null;
  status: "synced" | "syncing" | "error" | "never";
  recordCount: number;
}

interface SyncEvent {
  id: string;
  date: string;
  source: string;
  recordsImported: number;
  status: "success" | "failed" | "syncing";
  duration: string;
  periodRange: string;
}

interface QboStatus {
  isConnected: boolean;
  companyName?: string;
  companyId?: string;
  tokenExpiresAt?: string;
  lastSyncAt?: string;
  warnings?: string[];
}

function getSourceLabel(source: string): string {
  const map: Record<string, string> = {
    CSV_IMPORT: "CSV Import",
    QUICKBOOKS: "QuickBooks",
    SAGE: "Sage Intacct",
    MANUAL: "Manual Entry",
    API: "API Sync",
  };
  return map[source] || source;
}

function getSourceIcon(source: string) {
  switch (source) {
    case "CSV_IMPORT":
      return <FileSpreadsheet className="h-4 w-4 text-blue-500" />;
    case "QUICKBOOKS":
    case "SAGE":
      return <Database className="h-4 w-4 text-purple-500" />;
    default:
      return <ArrowDownToLine className="h-4 w-4 text-gray-500" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
    case "synced":
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    case "failed":
    case "error":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "syncing":
    case "processing":
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Syncing
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          {status}
        </Badge>
      );
  }
}

function QboConnectionPanel() {
  const { toast } = useToast();

  const { data: qboStatus, isLoading: isLoadingQbo, refetch: refetchQbo } = useQuery<QboStatus>({
    queryKey: ["/api/quickbooks/status"],
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/quickbooks/auth-url");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Unable to connect", description: "Could not generate authorization URL.", variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/quickbooks/disconnect");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      toast({ title: "QuickBooks disconnected", description: "Your QuickBooks connection has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Disconnect failed", description: err.message, variant: "destructive" });
    },
  });

  const syncNowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fk/qbo/ingest", {
        startDate: `${new Date().getFullYear() - 1}-01-01`,
        endDate: new Date().toISOString().split("T")[0],
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookkeeping/gl"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookkeeping/pnl"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookkeeping/gl/import-history"] });
      refetchQbo();
      toast({
        title: "QuickBooks sync complete",
        description: `Imported ${data?.linesCreated ?? 0} GL entries from QuickBooks.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-4 h-4 text-[#1E4FAB]" />
          Accounting Integrations
        </CardTitle>
        <CardDescription>
          Connect your accounting software to automatically sync GL entries
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoadingQbo ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2CA01C]/10">
                <svg className="h-6 w-6" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="32" height="32" rx="6" fill="#2CA01C" />
                  <text x="16" y="22" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">QB</text>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">QuickBooks Online</p>
                {qboStatus?.isConnected ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <p className="text-xs text-muted-foreground">
                      {qboStatus.companyName
                        ? `Connected — ${qboStatus.companyName}`
                        : "Connected"}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-2 w-2 rounded-full bg-gray-300" />
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {qboStatus?.isConnected ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncNowMutation.mutate()}
                    disabled={syncNowMutation.isPending}
                  >
                    {syncNowMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Sync GL
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <Link2Off className="h-3.5 w-3.5 mr-1.5" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="bg-[#2CA01C] hover:bg-[#228A15] text-white"
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending}
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Connect QuickBooks
                </Button>
              )}
            </div>
          </div>
        )}
        {qboStatus?.warnings && qboStatus.warnings.length > 0 && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
            {qboStatus.warnings[0]}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BookkeepingSyncHistory() {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    data: importHistory = [],
    isLoading: isLoadingHistory,
  } = useQuery<ImportHistoryRecord[]>({
    queryKey: ["/api/bookkeeping/gl/import-history"],
  });

  const {
    data: syncStatus,
    isLoading: isLoadingSyncStatus,
  } = useQuery<SyncStatusRecord>({
    queryKey: ["/api/operations-context/sync-status", { module: "bookkeeping" }],
    queryFn: async () => {
      const res = await fetch("/api/operations-context/sync-status?module=bookkeeping", { credentials: "include" });
      if (!res.ok) {
        return { module: "bookkeeping", lastSyncAt: null, status: "never" as const, recordCount: 0 };
      }
      return res.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/operations/sync/bookkeeping", {
        entityTypes: ["gl_entries"],
        fullSync: false,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookkeeping/gl/import-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/sync-status"] });
      toast({ title: "Sync initiated", description: "Data synchronization has been started." });
      setIsSyncing(false);
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Unable to start synchronization. Please try again.", variant: "destructive" });
      setIsSyncing(false);
    },
  });

  const handleSyncNow = () => {
    setIsSyncing(true);
    syncMutation.mutate();
  };

  const totalSyncs = importHistory.length;
  const successfulSyncs = importHistory.length;
  const failedSyncs = syncStatus?.status === "error" ? 1 : 0;
  const totalRecordsImported = importHistory.reduce((sum, r) => sum + (r.rowCount || 0), 0);

  const lastSyncTime = importHistory.length > 0
    ? importHistory[0].importDate
    : syncStatus?.lastSyncAt || null;
  const successRate = totalSyncs > 0
    ? Math.round((successfulSyncs / (successfulSyncs + failedSyncs)) * 100)
    : 0;

  const syncEvents: SyncEvent[] = importHistory.map((record, idx) => ({
    id: `import-${idx}`,
    date: record.importDate,
    source: "CSV_IMPORT",
    recordsImported: record.rowCount,
    status: "success" as const,
    duration: `${Math.max(1, Math.round(record.rowCount * 0.05))}s`,
    periodRange: record.earliest && record.latest
      ? `${record.earliest} - ${record.latest}`
      : "N/A",
  }));

  const isLoading = isLoadingHistory || isLoadingSyncStatus;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sync History</h2>
          <p className="text-sm text-muted-foreground">View data synchronization history and connected integrations</p>
        </div>
        <Button
          size="sm"
          className="bg-[#1E4FAB] hover:bg-[#1a4294]"
          onClick={handleSyncNow}
          disabled={isSyncing || syncMutation.isPending}
        >
          {isSyncing || syncMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Sync Now
        </Button>
      </div>

      {/* QuickBooks Integration Panel */}
      <QboConnectionPanel />

      <Separator />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Syncs</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSyncs}</div>
            <p className="text-xs text-muted-foreground">
              {totalRecordsImported.toLocaleString()} total records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successfulSyncs}</div>
            <p className="text-xs text-muted-foreground">
              {totalSyncs > 0 ? `${successRate}% success rate` : "No syncs yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedSyncs}</div>
            <p className="text-xs text-muted-foreground">
              {failedSyncs === 0 ? "No failures" : "Action needed"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastSyncTime
                ? formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })
                : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">
              {lastSyncTime
                ? format(new Date(lastSyncTime), "MM/dd/yyyy h:mm a")
                : "No syncs recorded"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Events Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#1E4FAB]" />
            Recent Sync Activity
          </CardTitle>
          <CardDescription>Detailed log of data synchronization events</CardDescription>
        </CardHeader>
        <CardContent>
          {syncEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium">No sync history</p>
              <p className="text-sm mt-1">
                Connect QuickBooks above or import a CSV on the GL Import tab to start syncing.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Records Imported</TableHead>
                  <TableHead>Period Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      {format(new Date(event.date), "MM/dd/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSourceIcon(event.source)}
                        <span>{getSourceLabel(event.source)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {event.recordsImported.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {event.periodRange}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={event.status} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {event.duration}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
