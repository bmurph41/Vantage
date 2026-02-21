/**
 * CRM Integration Hooks
 * 
 * Reusable hooks that wire the CRM upgrade components together:
 * 
 *   useDealMutations    — CRUD + stage transitions + bulk ops
 *   useDealSubscription — SSE/polling for real-time deal updates
 *   useCRMEventBus      — Cross-module pub/sub (deal.won → trigger LP export, etc.)
 *   useDealFilters      — Filter/sort/search state with URL sync
 *   useDealExport       — Export deals in multiple formats
 * 
 * Drop into: client/src/hooks/use-crm-integrations.ts
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deal } from "@shared/schema";

// ═══════════════════════════════════════════════════════════════════
//  1. useDealMutations
// ═══════════════════════════════════════════════════════════════════

interface DealMutationCallbacks {
  onSuccess?: (deal: Deal, action: string) => void;
  onError?: (error: Error, action: string) => void;
}

export function useDealMutations(callbacks?: DealMutationCallbacks) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/analytics"] });
  };

  const handleSuccess = (deal: Deal, action: string, message: string) => {
    invalidate();
    toast({ title: message });
    callbacks?.onSuccess?.(deal, action);
    crmEventBus.emit("deal.updated", { deal, action });
  };

  const handleError = (error: Error, action: string) => {
    toast({ title: `Failed to ${action}`, description: error.message, variant: "destructive" });
    callbacks?.onError?.(error, action);
  };

  // Create
  const createDeal = useMutation({
    mutationFn: async (data: Partial<Deal>) => {
      const response = await apiRequest("POST", "/api/deals", data);
      return response.json();
    },
    onSuccess: (deal) => handleSuccess(deal, "create", "Deal Created"),
    onError: (err: Error) => handleError(err, "create deal"),
  });

  // Update
  const updateDeal = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Deal> }) => {
      const response = await apiRequest("PUT", `/api/deals/${id}`, data);
      return response.json();
    },
    onSuccess: (deal) => handleSuccess(deal, "update", "Deal Updated"),
    onError: (err: Error) => handleError(err, "update deal"),
  });

  // Delete
  const deleteDeal = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/deals/${id}`);
      return response.json();
    },
    onSuccess: (deal) => {
      invalidate();
      toast({ title: "Deal Deleted" });
      crmEventBus.emit("deal.deleted", { dealId: deal?.id });
    },
    onError: (err: Error) => handleError(err, "delete deal"),
  });

  // Stage Transition (with timestamp tracking)
  const moveStage = useMutation({
    mutationFn: async ({ id, stage, stageId }: { id: string; stage: string; stageId?: number }) => {
      const data: Record<string, any> = {
        pipelineStage: stage,
        stageChangedAt: new Date().toISOString(),
      };
      if (stageId !== undefined) data.stageId = stageId;
      const response = await apiRequest("PUT", `/api/deals/${id}`, data);
      return response.json();
    },
    onSuccess: (deal) => {
      handleSuccess(deal, "stage_move", `Moved to ${(deal as any).pipelineStage}`);
      crmEventBus.emit("deal.stage_changed", { deal, newStage: (deal as any).pipelineStage });

      // Check for lifecycle events
      const stage = ((deal as any).pipelineStage || "").toLowerCase();
      if (stage.includes("won") || stage.includes("closed_won")) {
        crmEventBus.emit("deal.won", { deal });
      }
      if (stage.includes("lost") || stage.includes("closed_lost")) {
        crmEventBus.emit("deal.lost", { deal });
      }
    },
    onError: (err: Error) => handleError(err, "move stage"),
  });

  // Bulk Update
  const bulkUpdate = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: Partial<Deal> }) => {
      try {
        const response = await apiRequest("POST", "/api/crm/bulk/deals", { ids, data });
        return response.json();
      } catch {
        // Fallback to individual updates
        const results = await Promise.allSettled(
          ids.map((id) => apiRequest("PUT", `/api/deals/${id}`, data).then((r) => r.json()))
        );
        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        return { succeeded, total: ids.length };
      }
    },
    onSuccess: (result) => {
      invalidate();
      const msg = result?.succeeded != null
        ? `${result.succeeded} of ${result.total} deals updated`
        : "Deals updated";
      toast({ title: "Bulk Update", description: msg });
      crmEventBus.emit("deals.bulk_updated", result);
    },
    onError: (err: Error) => handleError(err, "bulk update"),
  });

  return {
    createDeal,
    updateDeal,
    deleteDeal,
    moveStage,
    bulkUpdate,
    isLoading: createDeal.isPending || updateDeal.isPending || deleteDeal.isPending || moveStage.isPending || bulkUpdate.isPending,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  2. useDealSubscription
// ═══════════════════════════════════════════════════════════════════

interface SubscriptionOptions {
  /** Polling interval in ms (default 30000). Set to 0 to disable. */
  pollInterval?: number;
  /** SSE endpoint (default "/api/crm/events"). Set to null to disable. */
  sseEndpoint?: string | null;
  /** Only re-fetch when tab is visible (default true) */
  respectVisibility?: boolean;
}

export function useDealSubscription(options?: SubscriptionOptions) {
  const {
    pollInterval = 30000,
    sseEndpoint = "/api/crm/events",
    respectVisibility = true,
  } = options || {};

  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "polling" | "disconnected">("disconnected");
  const eventSourceRef = useRef<EventSource | null>(null);

  // Try SSE first
  useEffect(() => {
    if (!sseEndpoint) {
      setConnectionStatus("polling");
      return;
    }

    let es: EventSource;
    try {
      es = new EventSource(sseEndpoint);
      eventSourceRef.current = es;

      es.onopen = () => setConnectionStatus("connected");

      es.addEventListener("deal.updated", (e) => {
        try {
          const data = JSON.parse(e.data);
          queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
          setLastUpdate(new Date());
          crmEventBus.emit("deal.updated", data);
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener("deal.created", (e) => {
        try {
          const data = JSON.parse(e.data);
          queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
          setLastUpdate(new Date());
          crmEventBus.emit("deal.created", data);
        } catch { /* ignore */ }
      });

      es.onerror = () => {
        setConnectionStatus("polling");
        es.close();
      };
    } catch {
      setConnectionStatus("polling");
    }

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [sseEndpoint, queryClient]);

  // Fallback polling
  useEffect(() => {
    if (connectionStatus !== "polling" || pollInterval <= 0) return;

    const interval = setInterval(() => {
      if (respectVisibility && document.hidden) return;
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setLastUpdate(new Date());
    }, pollInterval);

    return () => clearInterval(interval);
  }, [connectionStatus, pollInterval, respectVisibility, queryClient]);

  const forceRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/analytics"] });
    setLastUpdate(new Date());
  }, [queryClient]);

  return { lastUpdate, connectionStatus, forceRefresh };
}

// ═══════════════════════════════════════════════════════════════════
//  3. useCRMEventBus (Singleton)
// ═══════════════════════════════════════════════════════════════════

type CRMEvent =
  | "deal.created"
  | "deal.updated"
  | "deal.deleted"
  | "deal.won"
  | "deal.lost"
  | "deal.stage_changed"
  | "deals.bulk_updated"
  | "activity.created"
  | "view.applied"
  | "export.requested";

type EventHandler = (data: any) => void;

class CRMEventBus {
  private listeners: Map<CRMEvent, Set<EventHandler>> = new Map();
  private history: { event: CRMEvent; data: any; timestamp: Date }[] = [];

  on(event: CRMEvent, handler: EventHandler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: CRMEvent, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: CRMEvent, data?: any) {
    this.history.push({ event, data, timestamp: new Date() });
    // Keep last 100 events
    if (this.history.length > 100) this.history.shift();

    this.listeners.get(event)?.forEach((handler) => {
      try { handler(data); } catch (err) { console.error(`CRM Event Bus error (${event}):`, err); }
    });
  }

  getHistory(event?: CRMEvent) {
    return event ? this.history.filter((h) => h.event === event) : [...this.history];
  }

  clear() {
    this.listeners.clear();
    this.history = [];
  }
}

// Singleton
export const crmEventBus = new CRMEventBus();

// React hook
export function useCRMEventBus(event: CRMEvent, handler: EventHandler) {
  const savedHandler = useRef(handler);
  savedHandler.current = handler;

  useEffect(() => {
    const wrapper = (data: any) => savedHandler.current(data);
    const unsubscribe = crmEventBus.on(event, wrapper);
    return unsubscribe;
  }, [event]);
}

// ═══════════════════════════════════════════════════════════════════
//  4. useDealFilters
// ═══════════════════════════════════════════════════════════════════

export interface DealFilterState {
  search: string;
  assetClass: string;
  stage: string;
  status: string;
  minAmount: number | null;
  maxAmount: number | null;
  source: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}

const DEFAULT_FILTERS: DealFilterState = {
  search: "",
  assetClass: "all",
  stage: "all",
  status: "all",
  minAmount: null,
  maxAmount: null,
  source: "all",
  sortBy: "updatedAt",
  sortDir: "desc",
};

export function useDealFilters(options?: { syncUrl?: boolean }) {
  const { syncUrl = false } = options || {};
  const [filters, setFilters] = useState<DealFilterState>(DEFAULT_FILTERS);

  // URL sync (read on mount)
  useEffect(() => {
    if (!syncUrl) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl: Partial<DealFilterState> = {};
    if (params.get("search")) fromUrl.search = params.get("search")!;
    if (params.get("assetClass")) fromUrl.assetClass = params.get("assetClass")!;
    if (params.get("stage")) fromUrl.stage = params.get("stage")!;
    if (params.get("status")) fromUrl.status = params.get("status")!;
    if (params.get("sortBy")) fromUrl.sortBy = params.get("sortBy")!;
    if (params.get("sortDir")) fromUrl.sortDir = params.get("sortDir") as "asc" | "desc";
    if (Object.keys(fromUrl).length > 0) {
      setFilters((prev) => ({ ...prev, ...fromUrl }));
    }
  }, [syncUrl]);

  // Write to URL
  useEffect(() => {
    if (!syncUrl) return;
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val != null && val !== "" && val !== "all" && val !== DEFAULT_FILTERS[key as keyof DealFilterState]) {
        params.set(key, String(val));
      }
    });
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [filters, syncUrl]);

  const updateFilter = useCallback(<K extends keyof DealFilterState>(key: K, value: DealFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.assetClass !== "all") count++;
    if (filters.stage !== "all") count++;
    if (filters.status !== "all") count++;
    if (filters.minAmount != null) count++;
    if (filters.maxAmount != null) count++;
    if (filters.source !== "all") count++;
    return count;
  }, [filters]);

  // Apply filters to deals array
  const applyFilters = useCallback((deals: Deal[]): Deal[] => {
    let result = [...deals];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((d: any) =>
        (d.name || "").toLowerCase().includes(q) ||
        (d.title || "").toLowerCase().includes(q) ||
        (d.description || "").toLowerCase().includes(q) ||
        (d.marinaName || "").toLowerCase().includes(q)
      );
    }

    if (filters.assetClass !== "all") {
      result = result.filter((d: any) => (d.assetClass || d.asset_class || "marina") === filters.assetClass);
    }

    if (filters.stage !== "all") {
      result = result.filter((d: any) => (d.pipelineStage || d.stage) === filters.stage);
    }

    if (filters.status !== "all") {
      result = result.filter((d: any) => {
        if (filters.status === "open") return !d.isClosed;
        if (filters.status === "won") return d.isClosed && d.status === "won";
        if (filters.status === "lost") return d.isClosed && d.status === "lost";
        return true;
      });
    }

    if (filters.minAmount != null) {
      result = result.filter((d: any) => (Number(d.amount) || 0) >= filters.minAmount!);
    }

    if (filters.maxAmount != null) {
      result = result.filter((d: any) => (Number(d.amount) || 0) <= filters.maxAmount!);
    }

    if (filters.source !== "all") {
      result = result.filter((d: any) => (d.source || d.dealSource) === filters.source);
    }

    // Sort
    result.sort((a: any, b: any) => {
      const aVal = a[filters.sortBy] ?? "";
      const bVal = b[filters.sortBy] ?? "";
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return filters.sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [filters]);

  return {
    filters,
    setFilters,
    updateFilter,
    resetFilters,
    activeFilterCount,
    applyFilters,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  5. useDealExport
// ═══════════════════════════════════════════════════════════════════

type ExportFormat = "csv" | "json" | "clipboard";

export function useDealExport() {
  const { toast } = useToast();

  const exportDeals = useCallback(async (
    deals: Deal[],
    format: ExportFormat = "csv",
    columns?: string[]
  ) => {
    const defaultCols = columns || [
      "name", "amount", "pipelineStage", "status", "assetClass",
      "source", "priority", "closeDate", "createdAt",
    ];

    switch (format) {
      case "csv": {
        const header = defaultCols.join(",");
        const rows = deals.map((d: any) =>
          defaultCols.map((col) => {
            const val = d[col] ?? "";
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(",")
        );
        const csv = [header, ...rows].join("\n");
        downloadBlob(csv, "text/csv", `deals-${dateStamp()}.csv`);
        toast({ title: "CSV Exported", description: `${deals.length} deals downloaded.` });
        break;
      }

      case "json": {
        const data = deals.map((d: any) => {
          const obj: Record<string, any> = {};
          defaultCols.forEach((col) => { obj[col] = d[col] ?? null; });
          return obj;
        });
        const json = JSON.stringify(data, null, 2);
        downloadBlob(json, "application/json", `deals-${dateStamp()}.json`);
        toast({ title: "JSON Exported", description: `${deals.length} deals downloaded.` });
        break;
      }

      case "clipboard": {
        const header = defaultCols.join("\t");
        const rows = deals.map((d: any) => defaultCols.map((col) => d[col] ?? "").join("\t"));
        await navigator.clipboard.writeText([header, ...rows].join("\n"));
        toast({ title: "Copied to Clipboard", description: `${deals.length} deals ready to paste.` });
        break;
      }
    }

    crmEventBus.emit("export.requested", { format, count: deals.length });
  }, [toast]);

  return { exportDeals };
}

// ─── Utilities ────────────────────────────────────────────────────

function downloadBlob(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().split("T")[0];
}
