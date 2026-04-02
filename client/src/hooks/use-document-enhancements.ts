/**
 * React Query hooks for Document Enhancements
 * Versioning, e-signature, loan packages, investor letters, rent roll PDF
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

export const docKeys = {
  all: ['documents'] as const,
  versions: (docId: string) => [...docKeys.all, 'versions', docId] as const,
  esignRequests: () => [...docKeys.all, 'esign'] as const,
  esignRequest: (id: string) => [...docKeys.all, 'esign', id] as const,
  loanPackages: () => [...docKeys.all, 'loan-packages'] as const,
  loanPackage: (id: string) => [...docKeys.all, 'loan-package', id] as const,
};

// ─── Document Versioning ─────────────────────────────────────────────────────

export function useDocumentVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: docKeys.versions(documentId!),
    queryFn: () => fetchApi<any>(`/api/documents/versions/${documentId}`),
    enabled: !!documentId,
  });
}

export function useCreateDocumentVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/documents/versions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: docKeys.versions(vars.documentId) }); },
  });
}

export function useDiffVersions() {
  return useMutation({
    mutationFn: (data: { documentId: string; versionA: number; versionB: number }) =>
      fetchApi('/api/documents/versions/diff', { method: 'POST', body: JSON.stringify(data) }),
  });
}

export function useRestoreVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { documentId: string; versionNumber: number }) =>
      fetchApi('/api/documents/versions/restore', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: docKeys.versions(vars.documentId) }); },
  });
}

// ─── E-Signature ─────────────────────────────────────────────────────────────

export function useESignatureRequests(filters?: { status?: string; documentId?: string }) {
  const params = new URLSearchParams(filters as any || {}).toString();
  return useQuery({
    queryKey: [...docKeys.esignRequests(), filters],
    queryFn: () => fetchApi<any>(`/api/documents/esign${params ? `?${params}` : ''}`),
  });
}

export function useESignatureRequest(id: string | undefined) {
  return useQuery({
    queryKey: docKeys.esignRequest(id!),
    queryFn: () => fetchApi<any>(`/api/documents/esign/${id}`),
    enabled: !!id,
  });
}

export function useCreateSignatureRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/documents/esign', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: docKeys.esignRequests() }); },
  });
}

export function useSendForSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi(`/api/documents/esign/${id}/send`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: docKeys.esignRequests() }); },
  });
}

export function useRecordSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, signerId, ...data }: any) =>
      fetchApi(`/api/documents/esign/${requestId}/sign/${signerId}`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: docKeys.esignRequests() }); },
  });
}

// ─── Loan Packages ───────────────────────────────────────────────────────────

export function useLoanPackages(filters?: { dealId?: string; status?: string }) {
  const params = new URLSearchParams(filters as any || {}).toString();
  return useQuery({
    queryKey: [...docKeys.loanPackages(), filters],
    queryFn: () => fetchApi<any>(`/api/documents/loan-packages${params ? `?${params}` : ''}`),
  });
}

export function useLoanPackage(id: string | undefined) {
  return useQuery({
    queryKey: docKeys.loanPackage(id!),
    queryFn: () => fetchApi<any>(`/api/documents/loan-packages/${id}`),
    enabled: !!id,
  });
}

export function useCreateLoanPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/documents/loan-packages', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: docKeys.loanPackages() }); },
  });
}

export function useLoanPackageCompleteness(id: string | undefined) {
  return useQuery({
    queryKey: [...docKeys.loanPackage(id!), 'completeness'],
    queryFn: () => fetchApi<any>(`/api/documents/loan-packages/${id}/completeness`),
    enabled: !!id,
  });
}

export function useAutoGenerateLoanDocs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) =>
      fetchApi(`/api/documents/loan-packages/${packageId}/auto-generate`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: docKeys.loanPackages() }); },
  });
}

export function useUpdateLoanDocStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, documentId, ...data }: any) =>
      fetchApi(`/api/documents/loan-packages/${packageId}/documents/${documentId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: docKeys.loanPackages() }); },
  });
}

// ─── Rent Roll PDF ───────────────────────────────────────────────────────────

export function useRentRollHTML(projectId: string | undefined) {
  return useQuery({
    queryKey: [...docKeys.all, 'rent-roll', projectId],
    queryFn: () => fetchApi<{ html: string }>(`/api/documents/rent-roll/${projectId}/html`),
    enabled: !!projectId,
  });
}
