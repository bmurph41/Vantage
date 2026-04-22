/**
 * Contract Parser React Query Hooks (LOI / PSA / ASA)
 *
 * - useStartContractExtraction — kicks off the async extraction job.
 * - useContractExtractionStatus — polls status every 3s while processing.
 * - useExtractedDates — list of pending/approved/rejected/promoted date rows.
 * - useUpdateDateStatus — approve / reject a single date.
 * - usePromoteDates — write approved dates to ddMilestones.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ContractExtractionSchema,
  ExtractionResult,
} from '@shared/extraction-schemas';

export const contractParserKeys = {
  all: ['contract-parser'] as const,
  status: (documentId: string) =>
    ['contract-parser', documentId, 'status'] as const,
  dates: (documentId: string) =>
    ['contract-parser', documentId, 'dates'] as const,
};

type DocumentClass = 'pl' | 'rent_roll' | 't12' | 'om' | 'loi' | 'psa' | 'asa' | 'unknown';
type ParseStatus = 'pending' | 'parsing' | 'parsed' | 'failed';

export interface ContractExtractionStatus {
  status: ParseStatus;
  documentClass: DocumentClass | null;
  documentClassConfidence: number | null;
  extractedAt: string | null;
  error: string | null;
  extraction: ExtractionResult<ContractExtractionSchema> | null;
}

export interface ContractExtractedDate {
  id: string;
  documentId: string;
  workspaceId: string | null;
  fieldKey: string;
  fieldLabel: string;
  extractedDate: string | null;
  offsetDays: number | null;
  anchorField: string | null;
  confidence: number;
  sourcePage: number | null;
  sourceSnippet: string | null;
  userStatus: 'pending' | 'approved' | 'rejected' | 'promoted';
  promotedMilestoneId: string | null;
  promotedChecklistItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export function useStartContractExtraction(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { forceReclassify?: boolean } = {}) =>
      fetchApi<{ documentId: string; status: string }>(
        `/api/dd/documents/${documentId}/extract-contract`,
        { method: 'POST', body: JSON.stringify(opts) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractParserKeys.status(documentId) });
    },
  });
}

export function useContractExtractionStatus(
  documentId: string,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  return useQuery<ContractExtractionStatus>({
    queryKey: contractParserKeys.status(documentId),
    queryFn: () =>
      fetchApi(`/api/dd/documents/${documentId}/extract-contract/status`),
    enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'parsing' || status === 'pending' ? 3000 : false;
    },
  });
}

export function useExtractedDates(
  documentId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery<ContractExtractedDate[]>({
    queryKey: contractParserKeys.dates(documentId),
    queryFn: () => fetchApi(`/api/dd/documents/${documentId}/extracted-dates`),
    enabled: options.enabled ?? true,
  });
}

export function useUpdateDateStatus(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      user_status,
    }: {
      id: string;
      user_status: 'pending' | 'approved' | 'rejected';
    }) =>
      fetchApi(`/api/dd/extracted-dates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ user_status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractParserKeys.dates(documentId) });
    },
  });
}

export function usePromoteDates(documentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      dateIds: string[];
      workspaceId?: string;
      overwriteExisting?: boolean;
    }) =>
      fetchApi<{
        milestonesCreated: number;
        checklistItemsCreated: number;
        skipped: Array<{ id: string; reason: string }>;
      }>(`/api/dd/documents/${documentId}/promote-dates`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractParserKeys.dates(documentId) });
      // Refresh anywhere that reads milestones / checklist items.
      qc.invalidateQueries({ queryKey: ['dd-milestones'] });
      qc.invalidateQueries({ queryKey: ['dd-checklist'] });
      qc.invalidateQueries({ queryKey: ['workspace'] });
      qc.invalidateQueries({ queryKey: ['dd-timeline'] });
    },
  });
}
