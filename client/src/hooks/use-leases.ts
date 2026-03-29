/**
 * Commercial Lease React Hooks (React Query)
 * ===========================================
 * Provides data fetching and mutation hooks for the lease engine.
 * Uses TanStack React Query for automatic caching and cache invalidation.
 *
 * Migrated from manual useState/useCallback pattern to React Query
 * to eliminate stale data issues and ensure cross-section updates.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CommercialLease,
  LeaseDetail,
  LeaseMonthlyCashflow,
  ProjectLeaseRollup,
} from "@shared/commercial-lease-types";

const API_BASE = "/api/commercial-leases";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include" as RequestCredentials,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ─── Query Key Factory ──────────────────────────────────────────────────────

export const leaseKeys = {
  all: ["commercial-leases"] as const,
  lists: (projectId: string) => [...leaseKeys.all, "list", projectId] as const,
  detail: (leaseId: string) => [...leaseKeys.all, "detail", leaseId] as const,
  cashflows: (leaseId: string, from?: string, to?: string) =>
    [...leaseKeys.all, "cashflows", leaseId, from, to] as const,
  rollup: (projectId: string, from?: string, to?: string) =>
    [...leaseKeys.all, "rollup", projectId, from, to] as const,
  stats: (projectId: string) => [...leaseKeys.all, "stats", projectId] as const,
};

// ─── useLeases (list with pagination) ─────────────────────────────────────

export interface LeaseListResponse {
  data: CommercialLease[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function useLeases(
  projectId: string | undefined,
  opts: {
    search?: string;
    leaseType?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  } = {}
) {
  const query = useQuery<LeaseListResponse>({
    queryKey: [...leaseKeys.lists(projectId!), opts],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (opts.search) params.set("search", opts.search);
      if (opts.leaseType) params.set("leaseType", opts.leaseType);
      if (opts.active !== undefined) params.set("active", String(opts.active));
      if (opts.limit) params.set("limit", String(opts.limit));
      if (opts.offset !== undefined) params.set("offset", String(opts.offset));
      if (opts.sortBy) params.set("sortBy", opts.sortBy);
      if (opts.sortDir) params.set("sortDir", opts.sortDir);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return apiFetch<LeaseListResponse>(`/projects/${projectId}/leases${qs}`);
    },
    enabled: !!projectId,
  });

  return {
    leases: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    hasMore: query.data?.hasMore ?? false,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

// ─── useLeaseDetail ──────────────────────────────────────────────────────────

export function useLeaseDetail(leaseId: string | undefined) {
  const query = useQuery<LeaseDetail>({
    queryKey: leaseKeys.detail(leaseId!),
    queryFn: () => apiFetch<LeaseDetail>(`/leases/${leaseId}`),
    enabled: !!leaseId,
  });

  return {
    detail: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}

// ─── useCashflows ────────────────────────────────────────────────────────────

export function useCashflows(
  leaseId: string | undefined,
  from?: string,
  to?: string
) {
  const query = useQuery<LeaseMonthlyCashflow[]>({
    queryKey: leaseKeys.cashflows(leaseId!, from, to),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return apiFetch<LeaseMonthlyCashflow[]>(
        `/leases/${leaseId}/cashflows${qs}`
      );
    },
    enabled: !!leaseId,
  });

  return {
    cashflows: query.data ?? [],
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

// ─── useProjectRollup ────────────────────────────────────────────────────────

export function useProjectRollup(
  projectId: string | undefined,
  from?: string,
  to?: string
) {
  const query = useQuery<ProjectLeaseRollup>({
    queryKey: leaseKeys.rollup(projectId!, from, to),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return apiFetch<ProjectLeaseRollup>(
        `/projects/${projectId}/lease-rollup${qs}`
      );
    },
    enabled: !!projectId,
  });

  return {
    rollup: query.data ?? null,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

// ─── useProjectLeaseStats (KPIs independent of pagination) ──────────────────

export interface ProjectLeaseStats {
  totalLeases: number;
  activeLeases: number;
  totalSf: number;
  avgRentPerSf: number;
  totalMonthlyBaseRent: number;
  leaseTypeBreakdown: Record<string, number>;
  expiringWithin12Months: number;
}

export function useProjectLeaseStats(projectId: string | undefined) {
  const query = useQuery<ProjectLeaseStats>({
    queryKey: leaseKeys.stats(projectId!),
    queryFn: () =>
      apiFetch<ProjectLeaseStats>(`/projects/${projectId}/stats`),
    enabled: !!projectId,
  });

  return {
    stats: query.data ?? null,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

// ─── Mutation helpers (with automatic cache invalidation) ───────────────────

/**
 * Provides all lease mutation methods with automatic React Query cache invalidation.
 *
 * The `onSuccess` callback is still supported for backwards compatibility,
 * but manual refetch() calls are no longer needed — all relevant queries
 * are automatically invalidated on mutation success.
 */
export function useLeaseMutations(onSuccess?: () => void) {
  const qc = useQueryClient();

  /** Invalidate all lease-related queries to ensure fresh data everywhere */
  function invalidateAll(projectId?: string, leaseId?: string) {
    // Always invalidate the broad lease cache
    qc.invalidateQueries({ queryKey: leaseKeys.all });
    // Also invalidate unified leases (used by Operations context)
    qc.invalidateQueries({ queryKey: ["unified-leases"] });
    qc.invalidateQueries({ queryKey: ["unified-lease-stats"] });
    // Invalidate pro-forma and actuals if a project context exists
    if (projectId) {
      qc.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "pro-forma"] });
      qc.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "actuals"] });
      qc.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId, "lp-reporting"] });
    }
    // Invalidate specific lease detail
    if (leaseId) {
      qc.invalidateQueries({ queryKey: leaseKeys.detail(leaseId) });
      qc.invalidateQueries({ queryKey: ["unified-lease-detail", leaseId] });
    }
    // Call legacy onSuccess callback
    onSuccess?.();
  }

  const mutation = useMutation({
    mutationFn: async ({
      url,
      method,
      body,
    }: {
      url: string;
      method: string;
      body?: any;
      projectId?: string;
      leaseId?: string;
    }) => {
      return apiFetch<any>(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    onSuccess: (_data, variables) => {
      invalidateAll(variables.projectId, variables.leaseId);
    },
  });

  const exec = <T>(
    url: string,
    method: string,
    body?: any,
    projectId?: string,
    leaseId?: string
  ): Promise<T | null> => {
    return mutation.mutateAsync({ url, method, body, projectId, leaseId }).catch(() => null) as Promise<T | null>;
  };

  return {
    saving: mutation.isPending,
    error: mutation.error?.message ?? null,

    // Lease
    createLease: (projectId: string, data: any) =>
      exec(`/projects/${projectId}/leases`, "POST", data, projectId),
    updateLease: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}`, "PUT", data, projectId, leaseId),
    deleteLease: (leaseId: string, projectId?: string) =>
      exec(`/leases/${leaseId}`, "DELETE", undefined, projectId, leaseId),

    // Terms
    createTerm: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/terms`, "POST", data, projectId, leaseId),
    updateTerm: (leaseId: string, termId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/terms/${termId}`, "PUT", data, projectId, leaseId),
    deleteTerm: (leaseId: string, termId: string, projectId?: string) =>
      exec(`/leases/${leaseId}/terms/${termId}`, "DELETE", undefined, projectId, leaseId),

    // Charge Lines
    createChargeLine: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/charge-lines`, "POST", data, projectId, leaseId),
    updateChargeLine: (leaseId: string, id: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/charge-lines/${id}`, "PUT", data, projectId, leaseId),
    deleteChargeLine: (leaseId: string, id: string, projectId?: string) =>
      exec(`/leases/${leaseId}/charge-lines/${id}`, "DELETE", undefined, projectId, leaseId),

    // Abatements
    createAbatement: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/abatements`, "POST", data, projectId, leaseId),
    deleteAbatement: (leaseId: string, id: string, projectId?: string) =>
      exec(`/leases/${leaseId}/abatements/${id}`, "DELETE", undefined, projectId, leaseId),

    // Sales
    createSale: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/sales`, "POST", data, projectId, leaseId),
    deleteSale: (leaseId: string, id: string, projectId?: string) =>
      exec(`/leases/${leaseId}/sales/${id}`, "DELETE", undefined, projectId, leaseId),

    // Percent Rent
    createPercentRentRule: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/percent-rent`, "POST", data, projectId, leaseId),
    updatePercentRentRule: (leaseId: string, id: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/percent-rent/${id}`, "PUT", data, projectId, leaseId),

    // TI
    createTiProgram: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/ti-program`, "POST", data, projectId, leaseId),
    updateTiProgram: (leaseId: string, id: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/ti-program/${id}`, "PUT", data, projectId, leaseId),
    createTiDraw: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/ti-draws`, "POST", data, projectId, leaseId),
    deleteTiDraw: (leaseId: string, id: string, projectId?: string) =>
      exec(`/leases/${leaseId}/ti-draws/${id}`, "DELETE", undefined, projectId, leaseId),

    // Recovery
    createRecoveryModel: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/recovery-model`, "POST", data, projectId, leaseId),
    updateRecoveryModel: (leaseId: string, id: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/recovery-model/${id}`, "PUT", data, projectId, leaseId),
    createRecoveryCategory: (leaseId: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/recovery-categories`, "POST", data, projectId, leaseId),
    updateRecoveryCategory: (leaseId: string, id: string, data: any, projectId?: string) =>
      exec(`/leases/${leaseId}/recovery-categories/${id}`, "PUT", data, projectId, leaseId),

    // Recompute
    recomputeCashflows: (leaseId: string, projectId?: string) =>
      exec(`/leases/${leaseId}/cashflows/recompute`, "POST", undefined, projectId, leaseId),

    // Bulk operations
    bulkRecompute: (projectId: string) =>
      exec(`/projects/${projectId}/bulk-recompute`, "POST", undefined, projectId),
    bulkImport: (projectId: string, leases: any[]) =>
      exec(`/projects/${projectId}/import`, "POST", { leases }, projectId),
    syncToProForma: (projectId: string) =>
      exec(`/projects/${projectId}/sync-to-proforma`, "POST", undefined, projectId),
  };
}
