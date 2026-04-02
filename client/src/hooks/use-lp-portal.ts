/**
 * React Query hooks for LP Portal, Statements, K-1, Side Letters
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

export const lpKeys = {
  all: ['lp'] as const,
  statements: (fundId?: string) => [...lpKeys.all, 'statements', fundId] as const,
  statement: (id: string) => [...lpKeys.all, 'statement', id] as const,
  k1: (fundId: string, investorId: string, year: number) => [...lpKeys.all, 'k1', fundId, investorId, year] as const,
  sideLetters: (fundId: string) => [...lpKeys.all, 'side-letters', fundId] as const,
  mfnAnalysis: (fundId: string) => [...lpKeys.all, 'mfn', fundId] as const,
  templates: () => [...lpKeys.all, 'templates'] as const,
  sessions: () => [...lpKeys.all, 'sessions'] as const,
};

// ─── LP Auth ─────────────────────────────────────────────────────────────────

export function useCreateLPUser() {
  return useMutation({
    mutationFn: (data: { investorId: string; email: string; name: string }) =>
      fetchApi('/api/lp-portal/auth/create-user', { method: 'POST', body: JSON.stringify(data) }),
  });
}

export function useLPLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      fetchApi('/api/lp-portal/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  });
}

// ─── Statements ──────────────────────────────────────────────────────────────

export function useLPStatements(filters?: { fundId?: string; investorId?: string; statementType?: string }) {
  const params = new URLSearchParams(filters as any || {}).toString();
  return useQuery({
    queryKey: [...lpKeys.statements(filters?.fundId), filters],
    queryFn: () => fetchApi<any>(`/api/lp-portal/statements${params ? `?${params}` : ''}`),
  });
}

export function useLPStatement(id: string | undefined) {
  return useQuery({
    queryKey: lpKeys.statement(id!),
    queryFn: () => fetchApi<any>(`/api/lp-portal/statements/${id}`),
    enabled: !!id,
  });
}

export function useGenerateStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fundId: string; investorId: string; periodEnd: string }) =>
      fetchApi('/api/lp-portal/statements/generate', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: lpKeys.all }); },
  });
}

export function useStatementHTML(id: string | undefined) {
  return useQuery({
    queryKey: [...lpKeys.statement(id!), 'html'],
    queryFn: () => fetchApi<{ html: string }>(`/api/lp-portal/statements/${id}/html`),
    enabled: !!id,
  });
}

// ─── K-1 ─────────────────────────────────────────────────────────────────────

export function useGenerateK1() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fundId: string; investorId: string; taxYear: number }) =>
      fetchApi('/api/lp-portal/k1/generate', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: lpKeys.all }); },
  });
}

// ─── Side Letters ────────────────────────────────────────────────────────────

export function useSideLetters(fundId: string | undefined) {
  return useQuery({
    queryKey: lpKeys.sideLetters(fundId!),
    queryFn: () => fetchApi<any>(`/api/lp-portal/side-letters/fund/${fundId}`),
    enabled: !!fundId,
  });
}

export function useCreateSideLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      fetchApi('/api/lp-portal/side-letters', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: lpKeys.all }); },
  });
}

export function useMFNAnalysis(fundId: string | undefined) {
  return useQuery({
    queryKey: lpKeys.mfnAnalysis(fundId!),
    queryFn: () => fetchApi<any>(`/api/lp-portal/side-letters/mfn-analysis/${fundId}`),
    enabled: !!fundId,
  });
}

// ─── Investor Letter Templates ───────────────────────────────────────────────

export function useInvestorLetterTemplates(templateType?: string) {
  return useQuery({
    queryKey: [...lpKeys.templates(), templateType],
    queryFn: () => fetchApi<any>(`/api/lp-portal/investor-letters/templates${templateType ? `?templateType=${templateType}` : ''}`),
  });
}

export function useCreateInvestorLetterTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      fetchApi('/api/lp-portal/investor-letters/templates', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: lpKeys.templates() }); },
  });
}

export function useRenderInvestorLetter() {
  return useMutation({
    mutationFn: (data: { templateId: string; tokenValues: Record<string, string> }) =>
      fetchApi('/api/lp-portal/investor-letters/render', { method: 'POST', body: JSON.stringify(data) }),
  });
}

export function useSeedDefaultTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchApi('/api/lp-portal/investor-letters/seed-defaults', { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: lpKeys.templates() }); },
  });
}
