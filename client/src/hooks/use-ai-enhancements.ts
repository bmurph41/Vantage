/**
 * React Query hooks for AI/RAG Enhancements
 * Document ingestion, deal scoring, anomaly detection, conversation memory, comp suggestions
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

export const aiKeys = {
  all: ['ai'] as const,
  documents: () => [...aiKeys.all, 'documents'] as const,
  dealScore: (dealId: string) => [...aiKeys.all, 'deal-score', dealId] as const,
  dealScoreHistory: (dealId: string) => [...aiKeys.all, 'deal-score-history', dealId] as const,
  anomalies: (filters?: any) => [...aiKeys.all, 'anomalies', filters] as const,
  sessions: () => [...aiKeys.all, 'sessions'] as const,
  compSuggestions: (propertyId: string) => [...aiKeys.all, 'comp-suggestions', propertyId] as const,
  search: (query: string) => [...aiKeys.all, 'search', query] as const,
};

// ─── Document Ingestion ──────────────────────────────────────────────────────

export function useDocumentStatus() {
  return useQuery({
    queryKey: aiKeys.documents(),
    queryFn: () => fetchApi<any>('/api/ai/documents/status'),
  });
}

export function useIngestDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { documentId: string; title: string; content: string; documentType: string }) =>
      fetchApi('/api/ai/documents/ingest', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: aiKeys.documents() }); },
  });
}

export function useSemanticSearch(query: string, options?: { documentType?: string; limit?: number }) {
  return useQuery({
    queryKey: aiKeys.search(query),
    queryFn: () => fetchApi<any>('/api/ai/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...options }),
    }),
    enabled: !!query && query.length > 2,
  });
}

// ─── Deal Scoring ────────────────────────────────────────────────────────────

export function useDealScore(dealId: string | undefined) {
  return useQuery({
    queryKey: aiKeys.dealScore(dealId!),
    queryFn: () => fetchApi<any>(`/api/ai/deals/${dealId}/score`),
    enabled: !!dealId,
  });
}

export function useScoreDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dealId: string) =>
      fetchApi(`/api/ai/deals/${dealId}/score`, { method: 'POST' }),
    onSuccess: (_, dealId) => { qc.invalidateQueries({ queryKey: aiKeys.dealScore(dealId) }); },
  });
}

export function useScoreAllDeals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchApi('/api/ai/deals/score-all', { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: aiKeys.all }); },
  });
}

export function useDealScoreHistory(dealId: string | undefined) {
  return useQuery({
    queryKey: aiKeys.dealScoreHistory(dealId!),
    queryFn: () => fetchApi<any>(`/api/ai/deals/${dealId}/score-history`),
    enabled: !!dealId,
  });
}

// ─── Anomaly Detection ───────────────────────────────────────────────────────

export function useAnomalies(filters?: { entityType?: string; severity?: string; acknowledged?: boolean }) {
  return useQuery({
    queryKey: aiKeys.anomalies(filters),
    queryFn: () => {
      const params = new URLSearchParams(filters as any || {}).toString();
      return fetchApi<any>(`/api/ai/anomalies${params ? `?${params}` : ''}`);
    },
  });
}

export function useDetectAnomalies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      fetchApi(`/api/ai/anomalies/detect/${projectId}`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: aiKeys.anomalies() }); },
  });
}

export function useAcknowledgeAnomaly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (anomalyId: string) =>
      fetchApi(`/api/ai/anomalies/${anomalyId}/acknowledge`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: aiKeys.anomalies() }); },
  });
}

// ─── Conversation Memory ─────────────────────────────────────────────────────

export function useConversationSessions() {
  return useQuery({
    queryKey: aiKeys.sessions(),
    queryFn: () => fetchApi<any>('/api/ai/conversations/sessions'),
  });
}

// ─── Comp Suggestions ────────────────────────────────────────────────────────

export function useCompSuggestions(propertyData: any, enabled: boolean = true) {
  return useQuery({
    queryKey: aiKeys.compSuggestions(propertyData?.address || ''),
    queryFn: () => fetchApi<any>('/api/ai/comps/suggest', {
      method: 'POST',
      body: JSON.stringify(propertyData),
    }),
    enabled: enabled && !!propertyData?.address,
  });
}
