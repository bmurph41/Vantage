/**
 * Payroll Module — TanStack Query Hooks
 * All data fetching + mutations for the payroll module.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = "/api";

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "API Error");
  }
  return res.json();
}

// ─── PLANS ──────────────────────────────────────────────────────────────────

export function usePayrollPlans(params: {
  orgId?: string;
  portfolioId?: string;
  assetId?: string;
  type?: string;
}) {
  return useQuery({
    queryKey: ["payroll-plans", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.orgId) qs.set("orgId", params.orgId);
      if (params.portfolioId) qs.set("portfolioId", params.portfolioId);
      if (params.assetId) qs.set("assetId", params.assetId);
      if (params.type) qs.set("type", params.type);
      return apiFetch(`/payroll/plans?${qs}`);
    },
    enabled: !!params.orgId,
  });
}

export function usePayrollPlan(planId: string | undefined) {
  return useQuery({
    queryKey: ["payroll-plan", planId],
    queryFn: () => apiFetch(`/payroll/plans/${planId}`),
    enabled: !!planId,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch("/payroll/plans", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plans"] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      apiFetch(`/payroll/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plans"] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/payroll/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plans"] }),
  });
}

// ─── PLAN LINES ─────────────────────────────────────────────────────────────

export function useCreateLine(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/payroll/plans/${planId}/lines`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plan", planId] }),
  });
}

export function useUpdateLine(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, ...data }: any) =>
      apiFetch(`/payroll/lines/${lineId}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plan", planId] }),
  });
}

export function useDeleteLine(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) => apiFetch(`/payroll/lines/${lineId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plan", planId] }),
  });
}

// ─── RATE EVENTS ────────────────────────────────────────────────────────────

export function useCreateRateEvent(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, ...data }: any) =>
      apiFetch(`/payroll/lines/${lineId}/rate-events`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plan", planId] }),
  });
}

// ─── WEEKLY HOURS ───────────────────────────────────────────────────────────

export function useBulkWeeklyHours(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, hours }: { lineId: string; hours: any[] }) =>
      apiFetch(`/payroll/lines/${lineId}/weekly-hours/bulk`, {
        method: "POST",
        body: JSON.stringify({ hours }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plan", planId] }),
  });
}

// ─── ALLOCATIONS ────────────────────────────────────────────────────────────

export function useBulkAllocations(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, allocations }: { lineId: string; allocations: any[] }) =>
      apiFetch(`/payroll/lines/${lineId}/allocations/bulk`, {
        method: "POST",
        body: JSON.stringify({ allocations }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plan", planId] }),
  });
}

// ─── BONUSES ────────────────────────────────────────────────────────────────

export function useCreateBonus(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, ...data }: any) =>
      apiFetch(`/payroll/lines/${lineId}/bonus-events`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plan", planId] }),
  });
}

// ─── CALCULATION ────────────────────────────────────────────────────────────

export function usePayrollCalc(params: {
  planId: string;
  granularity: "weekly" | "monthly";
  startDate: string;
  endDate: string;
}) {
  return useQuery({
    queryKey: ["payroll-calc", params],
    queryFn: () => {
      const qs = new URLSearchParams({
        granularity: params.granularity,
        start: params.startDate,
        end: params.endDate,
      });
      return apiFetch(`/payroll/plans/${params.planId}/calc?${qs}`);
    },
    enabled: !!params.planId && !!params.startDate && !!params.endDate,
  });
}

// ─── DEPARTMENTS ────────────────────────────────────────────────────────────

export function useDepartments(orgId: string | undefined) {
  return useQuery({
    queryKey: ["payroll-departments", orgId],
    queryFn: () => apiFetch(`/payroll/departments?orgId=${orgId}`),
    enabled: !!orgId,
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch("/payroll/departments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-departments"] }),
  });
}

// ─── POSITIONS ──────────────────────────────────────────────────────────────

export function usePositions(orgId: string | undefined, templateOnly?: boolean) {
  return useQuery({
    queryKey: ["payroll-positions", orgId, templateOnly],
    queryFn: () => {
      const qs = new URLSearchParams({ orgId: orgId! });
      if (templateOnly) qs.set("templateOnly", "true");
      return apiFetch(`/payroll/positions?${qs}`);
    },
    enabled: !!orgId,
  });
}

// ─── EMPLOYEES ──────────────────────────────────────────────────────────────

export function useEmployees(orgId: string | undefined) {
  return useQuery({
    queryKey: ["payroll-employees", orgId],
    queryFn: () => apiFetch(`/payroll/employees?orgId=${orgId}`),
    enabled: !!orgId,
  });
}

// ─── BURDEN PROFILES ────────────────────────────────────────────────────────

export function useBurdenProfiles(orgId: string | undefined) {
  return useQuery({
    queryKey: ["burden-profiles", orgId],
    queryFn: () => apiFetch(`/payroll/burden-profiles?orgId=${orgId}`),
    enabled: !!orgId,
  });
}

// ─── SEASONALITY TEMPLATES ──────────────────────────────────────────────────

export function useSeasonalityTemplates(orgId: string | undefined) {
  return useQuery({
    queryKey: ["seasonality-templates", orgId],
    queryFn: () => apiFetch(`/payroll/seasonality-templates?orgId=${orgId}`),
    enabled: !!orgId,
  });
}

export function useApplySeasonality(planId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, templateId, startDate }: any) =>
      apiFetch(`/payroll/lines/${lineId}/apply-seasonality`, {
        method: "POST",
        body: JSON.stringify({ templateId, startDate }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plan", planId] }),
  });
}

// ─── PERMISSIONS ────────────────────────────────────────────────────────────

export function usePermissionGrants(orgId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: ["payroll-permissions", orgId, userId],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (orgId) qs.set("orgId", orgId);
      if (userId) qs.set("userId", userId);
      return apiFetch(`/payroll/permissions/grants?${qs}`);
    },
    enabled: !!orgId,
  });
}

export function useCreateGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch("/payroll/permissions/grants", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-permissions"] }),
  });
}

export function useUpdateGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) =>
      apiFetch(`/payroll/permissions/grants/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-permissions"] }),
  });
}

export function useDeleteGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/payroll/permissions/grants/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-permissions"] }),
  });
}

export function useEffectivePermissions(params: {
  userId?: string;
  orgId?: string;
  scopeType?: string;
  scopeId?: string;
}) {
  return useQuery({
    queryKey: ["payroll-effective-perms", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
      return apiFetch(`/payroll/permissions/effective?${qs}`);
    },
    enabled: !!params.userId && !!params.orgId,
  });
}

// ─── DEPT P&L BRIDGE ────────────────────────────────────────────────────────

export function useDeptPnl(params: {
  dataSource: string;
  scopeId: string;
  scenarioId?: string;
  startDate: string;
  endDate: string;
  payrollPlanId?: string;
}) {
  return useQuery({
    queryKey: ["dept-pnl", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
      return apiFetch(`/dept-pnl/calculate?${qs}`);
    },
    enabled: !!params.scopeId && !!params.startDate && !!params.endDate,
  });
}

export function usePnlMappings(orgId: string | undefined) {
  return useQuery({
    queryKey: ["pnl-mappings", orgId],
    queryFn: () => apiFetch(`/dept-pnl/mappings?orgId=${orgId}`),
    enabled: !!orgId,
  });
}

export function useCreatePnlMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch("/dept-pnl/mappings", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pnl-mappings"] }),
  });
}

export function useUnassignedPnlItems(params: {
  assetId?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ["pnl-unassigned", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
      return apiFetch(`/dept-pnl/unassigned?${qs}`);
    },
    enabled: !!params.assetId,
  });
}

// ─── VALUATOR ───────────────────────────────────────────────────────────────

export function useImportSellerPayroll(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/valuator/${modelId}/payroll/import`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plans"] }),
  });
}

export function useCloneToProforma(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch(`/valuator/${modelId}/payroll/clone-to-proforma`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plans"] }),
  });
}

export function useSyncNow(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { operationsPlanId: string }) =>
      apiFetch(`/valuator/${modelId}/payroll/sync-now`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plans"] }),
  });
}

export function useUpdateActuals(modelId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/valuator/${modelId}/payroll/update-actuals`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payroll-plans"] }),
  });
}
