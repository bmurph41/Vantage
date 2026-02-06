/**
 * Commercial Lease React Hooks
 * ============================
 * Provides data fetching and mutation hooks for the lease engine.
 *
 * INTEGRATION: Uses fetch() directly. If your app uses React Query (TanStack Query),
 * wrap these in useQuery/useMutation for caching + invalidation.
 *
 * ADJUST: Base URL if your API is proxied differently.
 */

import { useState, useEffect, useCallback, useRef } from "react";
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
  opts: { search?: string; leaseType?: string; active?: boolean; limit?: number; offset?: number; sortBy?: string; sortDir?: 'asc' | 'desc' } = {}
) {
  const [leases, setLeases] = useState<CommercialLease[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (opts.search) params.set("search", opts.search);
      if (opts.leaseType) params.set("leaseType", opts.leaseType);
      if (opts.active !== undefined) params.set("active", String(opts.active));
      if (opts.limit) params.set("limit", String(opts.limit));
      if (opts.offset !== undefined) params.set("offset", String(opts.offset));
      if (opts.sortBy) params.set("sortBy", opts.sortBy);
      if (opts.sortDir) params.set("sortDir", opts.sortDir);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const result = await apiFetch<LeaseListResponse>(
        `/projects/${projectId}/leases${qs}`
      );
      setLeases(result.data);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, opts.search, opts.leaseType, opts.active, opts.limit, opts.offset, opts.sortBy, opts.sortDir]);

  useEffect(() => { fetch(); }, [fetch]);

  return { leases, total, hasMore, loading, error, refetch: fetch };
}

// ─── useLeaseDetail ──────────────────────────────────────────────────────────

export function useLeaseDetail(leaseId: string | undefined) {
  const [detail, setDetail] = useState<LeaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!leaseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<LeaseDetail>(`/leases/${leaseId}`);
      setDetail(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { detail, loading, error, refetch: fetch };
}

// ─── useCashflows ────────────────────────────────────────────────────────────

export function useCashflows(
  leaseId: string | undefined,
  from?: string,
  to?: string
) {
  const [cashflows, setCashflows] = useState<LeaseMonthlyCashflow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!leaseId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch<LeaseMonthlyCashflow[]>(
        `/leases/${leaseId}/cashflows${qs}`
      );
      setCashflows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [leaseId, from, to]);

  useEffect(() => { fetch(); }, [fetch]);

  return { cashflows, loading, refetch: fetch };
}

// ─── useProjectRollup ────────────────────────────────────────────────────────

export function useProjectRollup(
  projectId: string | undefined,
  from?: string,
  to?: string
) {
  const [rollup, setRollup] = useState<ProjectLeaseRollup | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch<ProjectLeaseRollup>(
        `/projects/${projectId}/lease-rollup${qs}`
      );
      setRollup(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId, from, to]);

  useEffect(() => { fetch(); }, [fetch]);

  return { rollup, loading, refetch: fetch };
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
  const [stats, setStats] = useState<ProjectLeaseStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await apiFetch<ProjectLeaseStats>(
        `/projects/${projectId}/stats`
      );
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { stats, loading, refetch: fetch };
}

// ─── Mutation helpers ────────────────────────────────────────────────────────

export function useLeaseMutations(onSuccess?: () => void) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exec = useCallback(
    async <T>(url: string, method: string, body?: any): Promise<T | null> => {
      setSaving(true);
      setError(null);
      try {
        const data = await apiFetch<T>(url, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
        onSuccess?.();
        return data;
      } catch (e: any) {
        setError(e.message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [onSuccess]
  );

  return {
    saving,
    error,
    // Lease
    createLease: (projectId: string, data: any) =>
      exec(`/projects/${projectId}/leases`, "POST", data),
    updateLease: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}`, "PUT", data),
    deleteLease: (leaseId: string) => exec(`/leases/${leaseId}`, "DELETE"),

    // Terms
    createTerm: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}/terms`, "POST", data),
    updateTerm: (leaseId: string, termId: string, data: any) =>
      exec(`/leases/${leaseId}/terms/${termId}`, "PUT", data),
    deleteTerm: (leaseId: string, termId: string) =>
      exec(`/leases/${leaseId}/terms/${termId}`, "DELETE"),

    // Charge Lines
    createChargeLine: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}/charge-lines`, "POST", data),
    updateChargeLine: (leaseId: string, id: string, data: any) =>
      exec(`/leases/${leaseId}/charge-lines/${id}`, "PUT", data),
    deleteChargeLine: (leaseId: string, id: string) =>
      exec(`/leases/${leaseId}/charge-lines/${id}`, "DELETE"),

    // Abatements
    createAbatement: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}/abatements`, "POST", data),
    deleteAbatement: (leaseId: string, id: string) =>
      exec(`/leases/${leaseId}/abatements/${id}`, "DELETE"),

    // Sales
    createSale: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}/sales`, "POST", data),
    deleteSale: (leaseId: string, id: string) =>
      exec(`/leases/${leaseId}/sales/${id}`, "DELETE"),

    // Percent Rent
    createPercentRentRule: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}/percent-rent`, "POST", data),
    updatePercentRentRule: (leaseId: string, id: string, data: any) =>
      exec(`/leases/${leaseId}/percent-rent/${id}`, "PUT", data),

    // TI
    createTiProgram: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}/ti-program`, "POST", data),
    updateTiProgram: (leaseId: string, id: string, data: any) =>
      exec(`/leases/${leaseId}/ti-program/${id}`, "PUT", data),
    createTiDraw: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}/ti-draws`, "POST", data),
    deleteTiDraw: (leaseId: string, id: string) =>
      exec(`/leases/${leaseId}/ti-draws/${id}`, "DELETE"),

    // Recovery
    createRecoveryModel: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}/recovery-model`, "POST", data),
    updateRecoveryModel: (leaseId: string, id: string, data: any) =>
      exec(`/leases/${leaseId}/recovery-model/${id}`, "PUT", data),
    createRecoveryCategory: (leaseId: string, data: any) =>
      exec(`/leases/${leaseId}/recovery-categories`, "POST", data),
    updateRecoveryCategory: (leaseId: string, id: string, data: any) =>
      exec(`/leases/${leaseId}/recovery-categories/${id}`, "PUT", data),

    // Recompute
    recomputeCashflows: (leaseId: string) =>
      exec(`/leases/${leaseId}/cashflows/recompute`, "POST"),

    // Bulk operations
    bulkRecompute: (projectId: string) =>
      exec(`/projects/${projectId}/bulk-recompute`, "POST"),
    bulkImport: (projectId: string, leases: any[]) =>
      exec(`/projects/${projectId}/import`, "POST", { leases }),
    syncToProForma: (projectId: string) =>
      exec(`/projects/${projectId}/sync-to-proforma`, "POST"),
  };
}
