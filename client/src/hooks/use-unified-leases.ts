/**
 * Unified Lease Hooks
 * ===================
 * React hooks that work in both Operations and Valuator contexts.
 * Read mode from LeaseContextProvider to determine API endpoints.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLeaseContext } from "@/components/commercial-leases/LeaseContextProvider";
import type {
  OperationsLeaseStats,
  AvailableOpsLease,
  ImportFromOperationsResult,
  ImportMode,
} from "@shared/lease-context-types";

// ─── Helper: Debounce Hook ──────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Unified Lease List Hook ─────────────────────────────────────────────────

interface UseUnifiedLeasesParams {
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  page?: number;
}

interface LeaseListResponse {
  data: any[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function useUnifiedLeases(params: UseUnifiedLeasesParams = {}) {
  const { apiBase, mode, propertyId } = useLeaseContext();
  const {
    search = "",
    status = "all",
    sortBy = "tenantName",
    sortDir = "asc",
    limit = 25,
    page = 0,
  } = params;

  const debouncedSearch = useDebounce(search, 300);
  const offset = page * limit;

  const queryKey = [
    "unified-leases",
    mode,
    apiBase,
    { search: debouncedSearch, status, sortBy, sortDir, limit, offset, propertyId },
  ];

  const { data, isLoading, error, refetch } = useQuery<LeaseListResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (status && status !== "all") params.append("status", status);
      params.append("sortBy", sortBy);
      params.append("sortDir", sortDir);
      params.append("limit", String(limit));
      params.append("offset", String(offset));
      if (propertyId) params.append("propertyId", propertyId);

      const url = `${apiBase}/leases?${params.toString()}`;
      return apiRequest(url) as Promise<LeaseListResponse>;
    },
  });

  return {
    leases: data?.data || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    loading: isLoading,
    error,
    refetch,
  };
}

// ─── Unified Stats Hook ─────────────────────────────────────────────────────

export function useUnifiedLeaseStats() {
  const { apiBase, mode, propertyId, projectId } = useLeaseContext();

  const queryKey = ["unified-lease-stats", mode, apiBase, propertyId, projectId];

  const { data, isLoading } = useQuery<OperationsLeaseStats>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (propertyId) params.append("propertyId", propertyId);

      const url = `${apiBase}/stats?${params.toString()}`;
      return apiRequest(url) as Promise<OperationsLeaseStats>;
    },
  });

  return { stats: data, loading: isLoading };
}

// ─── Single Lease Detail Hook ────────────────────────────────────────────────

export function useUnifiedLeaseDetail(leaseId: string | null) {
  const { mode } = useLeaseContext();

  // Detail endpoint is shared (not context-specific)
  const url = leaseId ? `/api/commercial-leases/leases/${leaseId}` : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["unified-lease-detail", leaseId],
    queryFn: async () => {
      if (!url) return null;
      return apiRequest(url);
    },
    enabled: !!leaseId,
  });

  return { lease: data, loading: isLoading, error };
}

// ─── Unified Mutations ──────────────────────────────────────────────────────

export function useUnifiedLeaseMutations() {
  const { apiBase, mode } = useLeaseContext();
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["unified-leases"] });
    queryClient.invalidateQueries({ queryKey: ["unified-lease-stats"] });
  };

  // Create
  const createLease = useMutation({
    mutationFn: async (payload: { lease: any; initialTerm?: any }) => {
      return apiRequest(`${apiBase}/leases`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateAll,
  });

  // Update
  const updateLease = useMutation({
    mutationFn: async ({
      leaseId,
      payload,
    }: {
      leaseId: string;
      payload: { lease?: any; initialTerm?: any };
    }) => {
      if (mode === "operations") {
        return apiRequest(`${apiBase}/leases/${leaseId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        // Valuator uses PUT on the shared endpoint
        return apiRequest(`/api/commercial-leases/leases/${leaseId}`, {
          method: "PUT",
          body: JSON.stringify(payload.lease || payload),
        });
      }
    },
    onSuccess: invalidateAll,
  });

  // Delete
  const deleteLease = useMutation({
    mutationFn: async (leaseId: string) => {
      if (mode === "operations") {
        return apiRequest(`${apiBase}/leases/${leaseId}`, { method: "DELETE" });
      } else {
        return apiRequest(`/api/commercial-leases/leases/${leaseId}`, {
          method: "DELETE",
        });
      }
    },
    onSuccess: invalidateAll,
  });

  // Sync to Pro Forma (valuator only)
  const syncToProForma = useMutation({
    mutationFn: async () => {
      return apiRequest(`${apiBase}/sync-to-proforma`, { method: "POST" });
    },
  });

  // Bulk Recompute (valuator only)
  const bulkRecompute = useMutation({
    mutationFn: async () => {
      return apiRequest(`${apiBase}/bulk-recompute`, { method: "POST" });
    },
    onSuccess: invalidateAll,
  });

  return {
    createLease,
    updateLease,
    deleteLease,
    syncToProForma,
    bulkRecompute,
  };
}

// ─── Connect Flow Hooks ─────────────────────────────────────────────────────

export function useAvailableOpsLeases(propertyId?: string) {
  const { projectId } = useLeaseContext();

  const { data, isLoading, refetch } = useQuery<AvailableOpsLease[]>({
    queryKey: ["available-ops-leases", projectId, propertyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (propertyId) params.append("propertyId", propertyId);

      return apiRequest(
        `/api/commercial-leases/projects/${projectId}/available-ops-leases?${params}`
      ) as Promise<AvailableOpsLease[]>;
    },
    enabled: !!projectId,
  });

  return { availableLeases: data || [], loading: isLoading, refetch };
}

export function useImportFromOperations() {
  const { projectId } = useLeaseContext();
  const queryClient = useQueryClient();

  return useMutation<
    ImportFromOperationsResult,
    Error,
    { leaseIds: string[]; mode: ImportMode }
  >({
    mutationFn: async ({ leaseIds, mode }) => {
      return apiRequest(
        `/api/commercial-leases/projects/${projectId}/import-from-operations`,
        {
          method: "POST",
          body: JSON.stringify({ leaseIds, mode }),
        }
      ) as Promise<ImportFromOperationsResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-leases"] });
      queryClient.invalidateQueries({ queryKey: ["unified-lease-stats"] });
      queryClient.invalidateQueries({ queryKey: ["available-ops-leases"] });
    },
  });
}

export function usePushToOperations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaseId: string) => {
      return apiRequest(
        `/api/commercial-leases/leases/${leaseId}/push-to-operations`,
        { method: "POST" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unified-leases"] });
    },
  });
}
