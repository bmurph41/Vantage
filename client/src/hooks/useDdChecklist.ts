/**
 * DD Checklist Hooks
 * React Query hooks for the DD Checklist Engine.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DdChecklistItemPeriod {
  id: string;
  itemId: string;
  periodType: string;
  periodLabel: string;
  periodSort: number;
  isReceived: boolean;
  receivedAt: string | null;
  receivedBy: string | null;
  fileId: string | null;
  notes: string | null;
}

export interface DdChecklistItem {
  id: string;
  sectionId: string;
  sortOrder: number;
  title: string;
  requestText: string | null;
  subCategory: string | null;
  priority: number;
  requestType: string;
  status: string;
  internalStatus?: string;
  dueDate: string | null;
  milestoneAnchor: string | null;
  dueOffsetDays: number | null;
  assignedToMemberId: string | null;
  reviewerMemberId: string | null;
  requestedFromMemberId: string | null;
  tags: string[] | null;
  sellerNotes: string | null;
  internalNotes: string | null;
  templateKey: string | null;
  hasPeriods?: boolean;
  periodConfig?: { type: string; values: string[] } | null;
  periods: DdChecklistItemPeriod[];
  fileCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DdChecklistSection {
  id: string;
  checklistId: string;
  sortOrder: number;
  title: string;
  description: string | null;
  isCollapsedByDefault: boolean;
  items: DdChecklistItem[];
}

export interface DdChecklist {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
  sellerCanMarkProvided: boolean;
  sellerCanChangeStatus: boolean;
  requireReviewerApproval: boolean;
  autoProvidedOnUpload: boolean;
  autoReminders: boolean;
  lockAfterClosing: boolean;
  caRequiredForChecklist: boolean;
}

export interface DdChecklistStats {
  total: number;
  open: number;
  requested: number;
  inProgress: number;
  provided: number;
  reviewing: number;
  approved: number;
  rejected: number;
  waived: number;
  blocked: number;
  overdue: number;
}

export interface DdChecklistData {
  checklist: DdChecklist | null;
  sections: DdChecklistSection[];
  stats: DdChecklistStats;
}

export interface DdChecklistTemplate {
  id: string;
  name: string;
  version: string;
  assetClass: string;
  isBuiltin: boolean;
  description?: string;
  data?: any;
}

// ─── Checklist ───────────────────────────────────────────────────────────────

export function useDdChecklist(workspaceId: string | undefined) {
  return useQuery<DdChecklistData>({
    queryKey: ['dd-checklist', workspaceId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/workspaces/${workspaceId}/dd-checklist`);
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

export function useCreateDdChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, name }: { workspaceId: string; name?: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/dd-checklist`, { name });
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

export function useCreateFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, templateIds, mergeStrategy }: { workspaceId: string; templateIds: string[]; mergeStrategy?: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/dd-checklist/from-template`, { templateIds, mergeStrategy });
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

export function useUpdateChecklistSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ checklistId, workspaceId, ...data }: { checklistId: string; workspaceId: string } & Record<string, any>) => {
      const res = await apiRequest('PATCH', `/api/dd-checklist/${checklistId}/settings`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

export function useSyncDeadlines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/dd-checklist/sync-deadlines`);
      return res.json();
    },
    onSuccess: (_, workspaceId) => qc.invalidateQueries({ queryKey: ['dd-checklist', workspaceId] }),
  });
}

// ─── Sections ────────────────────────────────────────────────────────────────

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ checklistId, workspaceId, ...data }: { checklistId: string; workspaceId: string; title: string; description?: string }) => {
      const res = await apiRequest('POST', `/api/dd-checklist/${checklistId}/sections`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, workspaceId, ...data }: { sectionId: string; workspaceId: string } & Record<string, any>) => {
      const res = await apiRequest('PATCH', `/api/dd-sections/${sectionId}`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

export function useDeleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, workspaceId }: { sectionId: string; workspaceId: string }) => {
      const res = await apiRequest('DELETE', `/api/dd-sections/${sectionId}`);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

// ─── Items ───────────────────────────────────────────────────────────────────

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, workspaceId, ...data }: { sectionId: string; workspaceId: string; title: string; requestText?: string; priority?: number; requestType?: string }) => {
      const res = await apiRequest('POST', `/api/dd-sections/${sectionId}/items`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, workspaceId, ...data }: { itemId: string; workspaceId: string } & Record<string, any>) => {
      const res = await apiRequest('PATCH', `/api/dd-items/${itemId}`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, workspaceId }: { itemId: string; workspaceId: string }) => {
      const res = await apiRequest('DELETE', `/api/dd-items/${itemId}`);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

export function useSetItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, workspaceId, status }: { itemId: string; workspaceId: string; status: string }) => {
      const res = await apiRequest('POST', `/api/dd-items/${itemId}/set-status`, { status });
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

export function useLinkFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, workspaceId, documentId }: { itemId: string; workspaceId: string; documentId: string }) => {
      const res = await apiRequest('POST', `/api/dd-items/${itemId}/link-file`, { documentId });
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

// ─── Periods ─────────────────────────────────────────────────────────────────

export function useTogglePeriodReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ periodId, workspaceId, isReceived }: { periodId: string; workspaceId: string; isReceived: boolean }) => {
      const res = await apiRequest('PATCH', `/api/dd-item-periods/${periodId}`, { isReceived });
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-checklist', vars.workspaceId] }),
  });
}

// ─── Comments ────────────────────────────────────────────────────────────────

export function useItemComments(itemId: string | undefined) {
  return useQuery({
    queryKey: ['dd-item-comments', itemId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/dd-items/${itemId}/comments`);
      return res.json();
    },
    enabled: !!itemId,
  });
}

export function usePostComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, body, visibility }: { itemId: string; body: string; visibility?: string }) => {
      const res = await apiRequest('POST', `/api/dd-items/${itemId}/comments`, { body, visibility });
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['dd-item-comments', vars.itemId] }),
  });
}

// ─── History ─────────────────────────────────────────────────────────────────

export function useItemHistory(itemId: string | undefined) {
  return useQuery({
    queryKey: ['dd-item-history', itemId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/dd-items/${itemId}/history`);
      return res.json();
    },
    enabled: !!itemId,
  });
}

// ─── Templates ───────────────────────────────────────────────────────────────

export function useDdChecklistTemplates() {
  return useQuery<DdChecklistTemplate[]>({
    queryKey: ['dd-checklist-templates'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/dd-checklist-templates');
      return res.json();
    },
  });
}

export function useSeedTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/dd-checklist-templates/seed');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dd-checklist-templates'] }),
  });
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function useExportChecklist() {
  return useMutation({
    mutationFn: async ({ workspaceId, format }: { workspaceId: string; format: 'excel' | 'pdf' }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/dd-checklist/export/${format}`, {
        method: 'POST', credentials: 'include',
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dd-checklist.${format === 'excel' ? 'csv' : 'html'}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
