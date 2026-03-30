/**
 * Fund Management React Query Hooks
 *
 * Comprehensive hooks for GP/LP fund operations:
 * - Fund CRUD & metrics
 * - Investor management & capital accounts
 * - Capital calls & distributions
 * - Waterfall calculations
 * - Preferred return accrual
 * - NAV calculations
 * - LP investor statements
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Query Key Factory
// ============================================================================

export const fundKeys = {
  all: ['funds'] as const,
  lists: () => [...fundKeys.all, 'list'] as const,
  detail: (fundId: string) => [...fundKeys.all, fundId] as const,
  metrics: (fundId: string) => [...fundKeys.all, fundId, 'metrics'] as const,
  investors: (fundId: string) => [...fundKeys.all, fundId, 'investors'] as const,
  investor: (fundId: string, investorId: string) => [...fundKeys.all, fundId, 'investors', investorId] as const,
  capitalAccounts: (fundId: string) => [...fundKeys.all, fundId, 'capital-accounts'] as const,
  allocations: (fundId: string) => [...fundKeys.all, fundId, 'allocations'] as const,
  capitalMovements: (fundId: string) => [...fundKeys.all, fundId, 'capital-movements'] as const,
  capitalCalls: (fundId: string) => [...fundKeys.all, fundId, 'capital-calls'] as const,
  distributions: (fundId: string) => [...fundKeys.all, fundId, 'distributions'] as const,
  cashFlows: (fundId: string) => [...fundKeys.all, fundId, 'cash-flows'] as const,
  waterfall: (fundId: string) => [...fundKeys.all, fundId, 'waterfall'] as const,
  waterfallHistory: (fundId: string) => [...fundKeys.all, fundId, 'waterfall', 'history'] as const,
  preferredReturn: (fundId: string) => [...fundKeys.all, fundId, 'preferred-return'] as const,
  capitalStackTemplates: (fundId: string) => [...fundKeys.all, fundId, 'capital-stack-templates'] as const,
  investorStatement: (fundId: string, investorId: string) => [...fundKeys.all, fundId, 'investors', investorId, 'statement'] as const,
  projectAllocations: (projectId: string) => ['project-fund-allocations', projectId] as const,
};

// ============================================================================
// Helper
// ============================================================================

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ============================================================================
// FUND QUERIES
// ============================================================================

/** List all funds for the current org */
export function useFunds() {
  return useQuery({
    queryKey: fundKeys.lists(),
    queryFn: () => fetchApi<any[]>('/api/funds'),
  });
}

/** Get fund detail with investors, allocations, and metrics */
export function useFund(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.detail(fundId!),
    queryFn: () => fetchApi<any>(`/api/funds/${fundId}`),
    enabled: !!fundId,
  });
}

/** Get computed fund performance metrics */
export function useFundMetrics(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.metrics(fundId!),
    queryFn: () => fetchApi<any>(`/api/funds/${fundId}/metrics`),
    enabled: !!fundId,
  });
}

// ============================================================================
// FUND MUTATIONS
// ============================================================================

/** Create a new fund */
export function useCreateFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi<any>('/api/funds', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.lists() });
    },
  });
}

/** Update an existing fund */
export function useUpdateFund(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi<any>(`/api/funds/${fundId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.lists() });
    },
  });
}

/** Delete a fund */
export function useDeleteFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fundId: string) => fetchApi<any>(`/api/funds/${fundId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.lists() });
    },
  });
}

/** Recalculate all fund metrics (IRR, MOIC, TVPI, DPI, RVPI) and persist */
export function useRecalculateFundMetrics(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchApi<any>(`/api/funds/${fundId}/recalculate`, {
      method: 'POST',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.waterfall(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.lists() });
    },
  });
}

// ============================================================================
// INVESTOR QUERIES & MUTATIONS
// ============================================================================

/** List all investors in a fund */
export function useFundInvestors(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.investors(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/investors`),
    enabled: !!fundId,
  });
}

/** Get a single investor's detail */
export function useFundInvestor(fundId: string | undefined, investorId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.investor(fundId!, investorId!),
    queryFn: () => fetchApi<any>(`/api/funds/${fundId}/investors/${investorId}`),
    enabled: !!fundId && !!investorId,
  });
}

/** Add investor to fund */
export function useCreateFundInvestor(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi<any>(`/api/funds/${fundId}/investors`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.investors(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalAccounts(fundId) });
    },
  });
}

/** Update investor in fund */
export function useUpdateFundInvestor(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ investorId, data }: { investorId: string; data: any }) =>
      fetchApi<any>(`/api/funds/${fundId}/investors/${investorId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.investors(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalAccounts(fundId) });
    },
  });
}

/** Remove investor from fund */
export function useDeleteFundInvestor(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (investorId: string) =>
      fetchApi<any>(`/api/funds/${fundId}/investors/${investorId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.investors(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalAccounts(fundId) });
    },
  });
}

// ============================================================================
// CAPITAL ACCOUNTS
// ============================================================================

/** Get capital account balances for all investors in a fund */
export function useFundCapitalAccounts(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.capitalAccounts(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/capital-accounts`),
    enabled: !!fundId,
  });
}

// ============================================================================
// DEAL ALLOCATIONS
// ============================================================================

/** List all deal allocations for a fund */
export function useFundAllocations(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.allocations(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/allocations`),
    enabled: !!fundId,
  });
}

/** Get fund allocations for a specific modeling project */
export function useProjectFundAllocations(projectId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.projectAllocations(projectId!),
    queryFn: () => fetchApi<any[]>(`/api/modeling/projects/${projectId}/fund-allocations`),
    enabled: !!projectId,
  });
}

/** Create a deal allocation (link project to fund) */
export function useCreateFundAllocation(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi<any>(`/api/funds/${fundId}/allocations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.allocations(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
    },
  });
}

/** Update a deal allocation */
export function useUpdateFundAllocation(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ allocationId, data }: { allocationId: string; data: any }) =>
      fetchApi<any>(`/api/funds/${fundId}/allocations/${allocationId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.allocations(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
    },
  });
}

/** Delete a deal allocation */
export function useDeleteFundAllocation(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (allocationId: string) =>
      fetchApi<any>(`/api/funds/${fundId}/allocations/${allocationId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.allocations(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
    },
  });
}

// ============================================================================
// CAPITAL MOVEMENTS
// ============================================================================

/** List all capital movements for a fund */
export function useFundCapitalMovements(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.capitalMovements(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/capital-movements`),
    enabled: !!fundId,
  });
}

/** Create a capital movement */
export function useCreateCapitalMovement(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi<any>(`/api/funds/${fundId}/capital-movements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.capitalMovements(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.investors(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalAccounts(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.cashFlows(fundId) });
    },
  });
}

// ============================================================================
// FUND-LEVEL CAPITAL CALLS
// ============================================================================

/** List capital calls for a fund */
export function useFundCapitalCalls(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.capitalCalls(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/capital-calls`),
    enabled: !!fundId,
  });
}

/** Create a fund-level capital call with auto-allocation to investors */
export function useCreateFundCapitalCall(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      totalAmount: number;
      purpose: string;
      dueDate: string;
      callNumber?: number;
      notes?: string;
      dealAllocationId?: string;
    }) => fetchApi<any>(`/api/funds/${fundId}/capital-calls`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.capitalCalls(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalMovements(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.investors(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalAccounts(fundId) });
    },
  });
}

/** Complete a capital call (mark all payments received, update balances) */
export function useCompleteFundCapitalCall(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (callNumber: number) =>
      fetchApi<any>(`/api/funds/${fundId}/capital-calls/${callNumber}/complete`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.capitalCalls(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalMovements(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.investors(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalAccounts(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.cashFlows(fundId) });
    },
  });
}

// ============================================================================
// DISTRIBUTIONS
// ============================================================================

/** List distributions for a fund */
export function useFundDistributions(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.distributions(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/distributions`),
    enabled: !!fundId,
  });
}

/** Process a fund distribution (runs waterfall, allocates to investors, updates accounts) */
export function useProcessFundDistribution(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      totalProceeds: number;
      distributionType: 'operating' | 'return_of_capital' | 'capital_gain' | 'refinance' | 'exit';
      dealAllocationId?: string;
      notes?: string;
      yearsHeld?: number;
    }) => fetchApi<any>(`/api/funds/${fundId}/distributions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      // Invalidate everything — distributions touch all fund data
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.distributions(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalMovements(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.investors(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalAccounts(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.waterfall(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.waterfallHistory(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.cashFlows(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.preferredReturn(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.lists() });
    },
  });
}

// ============================================================================
// WATERFALL
// ============================================================================

/** Get the latest waterfall calculation */
export function useFundWaterfall(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.waterfall(fundId!),
    queryFn: () => fetchApi<any>(`/api/funds/${fundId}/waterfall`),
    enabled: !!fundId,
  });
}

/** Get waterfall calculation history */
export function useFundWaterfallHistory(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.waterfallHistory(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/waterfall/history`),
    enabled: !!fundId,
  });
}

/** Run waterfall calculation */
export function useCalculateWaterfall(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: { totalDistributable?: number; yearsHeld?: number }) =>
      fetchApi<any>(`/api/funds/${fundId}/waterfall/calculate`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.waterfall(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.waterfallHistory(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
    },
  });
}

// ============================================================================
// PREFERRED RETURN
// ============================================================================

/** Get preferred return summary for all investors */
export function useFundPreferredReturn(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.preferredReturn(fundId!),
    queryFn: () => fetchApi<any>(`/api/funds/${fundId}/preferred-return`),
    enabled: !!fundId,
  });
}

/** Accrue preferred return for all investors */
export function useAccruePreferredReturn(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: {
      compoundingMethod?: 'simple' | 'annual' | 'quarterly' | 'continuous';
      periodMonths?: number;
      asOfDate?: string;
    }) => fetchApi<any>(`/api/funds/${fundId}/preferred-return/accrue`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.preferredReturn(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.investors(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalAccounts(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalMovements(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
    },
  });
}

// ============================================================================
// NAV CALCULATION
// ============================================================================

/** Calculate fund NAV from deal-level valuations */
export function useCalculateFundNav(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data?: {
      cashOnHand?: number;
      outstandingLiabilities?: number;
      asOfDate?: string;
    }) => fetchApi<any>(`/api/funds/${fundId}/nav/calculate`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.allocations(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.cashFlows(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.lists() });
    },
  });
}

// ============================================================================
// CASH FLOWS
// ============================================================================

/** Get cash flows for IRR calculation */
export function useFundCashFlows(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.cashFlows(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/cash-flows`),
    enabled: !!fundId,
  });
}

/** Create a cash flow entry */
export function useCreateFundCashFlow(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi<any>(`/api/funds/${fundId}/cash-flows`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.cashFlows(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
    },
  });
}

// ============================================================================
// CAPITAL STACK TEMPLATES
// ============================================================================

/** List capital stack templates for a fund */
export function useFundCapitalStackTemplates(fundId: string | undefined) {
  return useQuery({
    queryKey: fundKeys.capitalStackTemplates(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/capital-stack-templates`),
    enabled: !!fundId,
  });
}

/** Create a capital stack template */
export function useCreateCapitalStackTemplate(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi<any>(`/api/funds/${fundId}/capital-stack-templates`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.capitalStackTemplates(fundId) });
    },
  });
}

// ============================================================================
// SYNC & REPORTING
// ============================================================================

/** Sync deal-level IRR/MOIC from returns ledger into fund allocations */
export function useSyncDealReturns(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchApi<any>(`/api/funds/${fundId}/sync-deal-returns`, {
      method: 'POST',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fundKeys.allocations(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
    },
  });
}

/** Generate comprehensive LP investor statement */
export function useInvestorStatement(
  fundId: string | undefined,
  investorId: string | undefined,
  options?: { asOfDate?: string; periodStart?: string; periodEnd?: string }
) {
  const params = new URLSearchParams();
  if (options?.asOfDate) params.set('asOfDate', options.asOfDate);
  if (options?.periodStart) params.set('periodStart', options.periodStart);
  if (options?.periodEnd) params.set('periodEnd', options.periodEnd);
  const qs = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: fundKeys.investorStatement(fundId!, investorId!),
    queryFn: () => fetchApi<any>(`/api/funds/${fundId}/investors/${investorId}/statement${qs}`),
    enabled: !!fundId && !!investorId,
  });
}

/** Generate quarterly fund report */
export function useGenerateFundReport(fundId: string) {
  return useMutation({
    mutationFn: (data: { quarter: number; year: number; marketCommentary?: string }) =>
      fetchApi<any>(`/api/funds/${fundId}/generate-report`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

// ============================================================================
// DISTRIBUTION APPROVAL WORKFLOW (Institutional)
// ============================================================================

export const distributionDraftKeys = {
  all: (fundId: string) => [...fundKeys.detail(fundId), 'distribution-drafts'] as const,
  byStatus: (fundId: string, status?: string) => [...fundKeys.detail(fundId), 'distribution-drafts', status] as const,
};

/** List distribution drafts for a fund */
export function useDistributionDrafts(fundId: string | undefined, status?: string) {
  const qs = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: distributionDraftKeys.byStatus(fundId!, status),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/distribution-drafts${qs}`),
    enabled: !!fundId,
  });
}

/** Create a distribution draft (does NOT execute) */
export function useCreateDistributionDraft(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      totalProceeds: number;
      distributionType: string;
      dealAllocationId?: string;
      notes?: string;
      yearsHeld?: number;
    }) => fetchApi<any>(`/api/funds/${fundId}/distribution-drafts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: distributionDraftKeys.all(fundId) });
    },
  });
}

/** Submit draft for approval */
export function useSubmitDistributionForApproval(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) =>
      fetchApi<any>(`/api/funds/${fundId}/distribution-drafts/${draftId}/submit`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: distributionDraftKeys.all(fundId) });
    },
  });
}

/** Approve a distribution (enforces dual control) */
export function useApproveDistribution(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ draftId, notes }: { draftId: string; notes?: string }) =>
      fetchApi<any>(`/api/funds/${fundId}/distribution-drafts/${draftId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: distributionDraftKeys.all(fundId) });
    },
  });
}

/** Reject a distribution */
export function useRejectDistribution(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ draftId, reason }: { draftId: string; reason: string }) =>
      fetchApi<any>(`/api/funds/${fundId}/distribution-drafts/${draftId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: distributionDraftKeys.all(fundId) });
    },
  });
}

/** Execute an approved distribution (runs waterfall, creates movements) */
export function useExecuteDistribution(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) =>
      fetchApi<any>(`/api/funds/${fundId}/distribution-drafts/${draftId}/execute`, { method: 'POST' }),
    onSuccess: () => {
      // Full invalidation — execution touches everything
      qc.invalidateQueries({ queryKey: fundKeys.detail(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.metrics(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.distributions(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalMovements(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.investors(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.capitalAccounts(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.waterfall(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.cashFlows(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.preferredReturn(fundId) });
      qc.invalidateQueries({ queryKey: distributionDraftKeys.all(fundId) });
      qc.invalidateQueries({ queryKey: fundKeys.lists() });
    },
  });
}

// ============================================================================
// PERIOD LOCKS
// ============================================================================

export const periodLockKeys = {
  all: (fundId: string) => [...fundKeys.detail(fundId), 'period-locks'] as const,
};

/** List period locks for a fund */
export function useFundPeriodLocks(fundId: string | undefined) {
  return useQuery({
    queryKey: periodLockKeys.all(fundId!),
    queryFn: () => fetchApi<any[]>(`/api/funds/${fundId}/period-locks`),
    enabled: !!fundId,
  });
}

/** Lock a period */
export function useLockPeriod(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { periodLabel: string; periodStart: string; periodEnd: string }) =>
      fetchApi<any>(`/api/funds/${fundId}/period-locks`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: periodLockKeys.all(fundId) });
    },
  });
}

/** Unlock a period (requires reason) */
export function useUnlockPeriod(fundId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lockId, reason }: { lockId: string; reason: string }) =>
      fetchApi<any>(`/api/funds/${fundId}/period-locks/${lockId}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: periodLockKeys.all(fundId) });
    },
  });
}

// ============================================================================
// FINANCIAL AUDIT TRAIL
// ============================================================================

export const auditTrailKeys = {
  fund: (fundId: string) => [...fundKeys.detail(fundId), 'audit-trail'] as const,
};

/** Query financial audit trail for a fund */
export function useFundAuditTrail(
  fundId: string | undefined,
  filters?: {
    eventType?: string;
    investorId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }
) {
  const params = new URLSearchParams();
  if (filters?.eventType) params.set('eventType', filters.eventType);
  if (filters?.investorId) params.set('investorId', filters.investorId);
  if (filters?.fromDate) params.set('fromDate', filters.fromDate);
  if (filters?.toDate) params.set('toDate', filters.toDate);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: [...auditTrailKeys.fund(fundId!), filters],
    queryFn: () => fetchApi<{ entries: any[]; total: number }>(`/api/funds/${fundId}/audit-trail${qs}`),
    enabled: !!fundId,
  });
}
