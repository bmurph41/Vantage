/**
 * useDdPeriods.ts
 * 
 * React Query hooks for managing DD checklist item period slots.
 * Period types: year, month, trailing (T12, T24, etc.)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface DdPeriod {
  id: string;
  itemId: string;
  periodType: 'year' | 'month' | 'trailing';
  periodLabel: string;
  periodSort: number;
  isReceived: boolean;
  receivedAt: string | null;
  receivedBy: string | null;
  fileId: string | null;
  notes: string | null;
}

export interface PeriodProgress {
  total: number;
  received: number;
  pct: number;
}

export interface SectionProgress {
  id: string;
  title: string;
  pct: number;
  items: {
    id: string;
    title: string;
    hasPeriods: boolean;
    pct: number;
    received?: number;
    total?: number;
  }[];
}

export interface ChecklistProgress {
  overall: number;
  sections: SectionProgress[];
}

// ─── Fetch periods for an item ───────────────────────────────────────────────
export function useItemPeriods(itemId: string | null) {
  return useQuery({
    queryKey: ['dd-item-periods', itemId],
    queryFn: async () => {
      if (!itemId) return { periods: [], progress: { total: 0, received: 0, pct: 0 } };
      const res = await apiRequest('GET', `/api/dd-items/${itemId}/periods`);
      return res.json() as Promise<{ periods: DdPeriod[]; progress: PeriodProgress }>;
    },
    enabled: !!itemId,
  });
}

// ─── Add periods to an item ──────────────────────────────────────────────────
export function useAddPeriods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, type, values }: { itemId: string; type: string; values: string[] }) => {
      const res = await apiRequest('POST', `/api/dd-items/${itemId}/periods`, { type, values });
      return res.json();
    },
    onSuccess: (_, { itemId }) => {
      qc.invalidateQueries({ queryKey: ['dd-item-periods', itemId] });
      qc.invalidateQueries({ queryKey: ['dd-checklist'] });
      qc.invalidateQueries({ queryKey: ['dd-checklist-progress'] });
    },
  });
}

// ─── Toggle a single period slot ─────────────────────────────────────────────
export function useTogglePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ periodId, isReceived, itemId }: { periodId: string; isReceived: boolean; itemId: string }) => {
      const res = await apiRequest('PATCH', `/api/dd-item-periods/${periodId}`, { isReceived });
      return res.json();
    },
    onSuccess: (_, { itemId }) => {
      qc.invalidateQueries({ queryKey: ['dd-item-periods', itemId] });
      qc.invalidateQueries({ queryKey: ['dd-checklist'] });
      qc.invalidateQueries({ queryKey: ['dd-checklist-progress'] });
    },
  });
}

// ─── Update period notes/file ────────────────────────────────────────────────
export function useUpdatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ periodId, notes, fileId, itemId }: { periodId: string; notes?: string; fileId?: string; itemId: string }) => {
      const res = await apiRequest('PATCH', `/api/dd-item-periods/${periodId}`, { notes, fileId });
      return res.json();
    },
    onSuccess: (_, { itemId }) => {
      qc.invalidateQueries({ queryKey: ['dd-item-periods', itemId] });
    },
  });
}

// ─── Delete a period slot ────────────────────────────────────────────────────
export function useDeletePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ periodId, itemId }: { periodId: string; itemId: string }) => {
      const res = await apiRequest('DELETE', `/api/dd-item-periods/${periodId}`);
      return res.json();
    },
    onSuccess: (_, { itemId }) => {
      qc.invalidateQueries({ queryKey: ['dd-item-periods', itemId] });
      qc.invalidateQueries({ queryKey: ['dd-checklist'] });
      qc.invalidateQueries({ queryKey: ['dd-checklist-progress'] });
    },
  });
}

// ─── Bulk toggle all periods for an item ─────────────────────────────────────
export function useBulkTogglePeriods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, isReceived }: { itemId: string; isReceived: boolean }) => {
      const res = await apiRequest('POST', `/api/dd-items/${itemId}/periods/bulk-toggle`, { isReceived });
      return res.json();
    },
    onSuccess: (_, { itemId }) => {
      qc.invalidateQueries({ queryKey: ['dd-item-periods', itemId] });
      qc.invalidateQueries({ queryKey: ['dd-checklist'] });
      qc.invalidateQueries({ queryKey: ['dd-checklist-progress'] });
    },
  });
}

// ─── Fetch hierarchical progress for entire checklist ────────────────────────
export function useChecklistProgress(workspaceId: string | null) {
  return useQuery({
    queryKey: ['dd-checklist-progress', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { overall: 0, sections: [] };
      const res = await apiRequest('GET', `/api/workspaces/${workspaceId}/dd-checklist/progress`);
      return res.json() as Promise<ChecklistProgress>;
    },
    enabled: !!workspaceId,
  });
}

// ─── Helper: generate period values ──────────────────────────────────────────
export function generateYearValues(startYear: number, endYear: number): string[] {
  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(String(y));
  return years;
}

export function generateMonthValues(year: number): string[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map(m => `${m} ${year}`);
}

export function generateTrailingValues(): string[] {
  return ['T3', 'T6', 'T12', 'T24', 'T36'];
}
