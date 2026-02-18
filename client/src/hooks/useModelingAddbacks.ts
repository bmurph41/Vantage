import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export type AddbackScope = 'line_item' | 'category' | 'month_cell';

export interface AddbackValue {
  id?: string;
  addbackId: string;
  year: number;
  month?: number | null;
  amount: string;
}

export interface Addback {
  id: string;
  projectId: string;
  orgId: string;
  lineItemKey: string;
  lineItemLabel: string;
  lineItemId?: string;
  category: string | null;
  department: string | null;
  scope: AddbackScope;
  reason: string | null;
  notes: string | null;
  periodType: 'monthly' | 'yearly';
  isActive: boolean;
  addbackMonth: number | null;
  addbackYear: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  values: AddbackValue[];
}

export const ADDBACK_REASONS = [
  { value: 'one_time', label: 'One-time Expense', description: 'Non-recurring expense' },
  { value: 'owner_related', label: 'Owner-related', description: 'Personal or owner-specific expense' },
  { value: 'non_operating', label: 'Non-operating', description: 'Expense unrelated to operations' },
  { value: 'management_fee', label: 'Management Fee Adjustment', description: 'Fee adjustment for new ownership' },
  { value: 'lease_adjustment', label: 'Lease Adjustment', description: 'Below/above market lease normalization' },
  { value: 'capex', label: 'CapEx Misclassified', description: 'Capital expense recorded as operating' },
  { value: 'litigation', label: 'Litigation/Legal', description: 'One-time legal or settlement costs' },
  { value: 'other', label: 'Other', description: 'Custom addback reason' },
] as const;

export type AddbackReasonType = typeof ADDBACK_REASONS[number]['value'];

export function useModelingAddbacks(projectId: string | undefined) {
  const { toast } = useToast();

  const addbacksQuery = useQuery<Addback[]>({
    queryKey: ['/api/modeling/projects', projectId, 'addbacks'],
    enabled: !!projectId,
  });

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data: {
      lineItemKey: string;
      lineItemLabel: string;
      lineItemId?: string;
      category?: string;
      department?: string;
      reason?: string;
      notes?: string;
      periodType?: 'monthly' | 'yearly';
      scope?: AddbackScope;
      addbackMonth?: number;
      addbackYear?: number;
      amount?: string;
      values?: { year: number; month?: number; amount: string }[];
    }) => {
      const response = await apiRequest('POST', `/api/modeling/projects/${projectId}/addbacks`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'addbacks'] });
      toast({ title: 'Addback Saved', description: 'Addback has been saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ addbackId, isActive }: { addbackId: string; isActive: boolean }) => {
      const response = await apiRequest('PATCH', `/api/modeling/addbacks/${addbackId}/toggle`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'addbacks'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteAddbackMutation = useMutation({
    mutationFn: async (addbackId: string) => {
      const response = await apiRequest('DELETE', `/api/modeling/addbacks/${addbackId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'addbacks'] });
      toast({ title: 'Addback Removed', description: 'Addback has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getAddbackForLineItem = (lineItemKey: string): Addback | undefined => {
    return addbacksQuery.data?.find(
      a => (a.lineItemKey === lineItemKey || a.lineItemId === lineItemKey) && a.scope === 'line_item' && a.isActive
    );
  };

  const getAddbackForCategory = (category: string): Addback | undefined => {
    return addbacksQuery.data?.find(
      a => a.lineItemKey === category && a.scope === 'category' && a.isActive
    );
  };

  const getAddbackForMonthCell = (lineItemKey: string, year: number, month: number): Addback | undefined => {
    return addbacksQuery.data?.find(
      a => (a.lineItemKey === lineItemKey || a.lineItemId === lineItemKey)
        && a.scope === 'month_cell'
        && a.addbackYear === year
        && a.addbackMonth === month
        && a.isActive
    );
  };

  const getAnyAddback = (lineItemKey: string, scope: AddbackScope, year?: number, month?: number): Addback | undefined => {
    return addbacksQuery.data?.find(a => {
      const keyMatch = a.lineItemKey === lineItemKey || a.lineItemId === lineItemKey;
      if (!keyMatch || a.scope !== scope) return false;
      if (scope === 'month_cell') {
        return a.addbackYear === year && a.addbackMonth === month;
      }
      return true;
    });
  };

  const isLineItemAddedBack = (lineItemKey: string): boolean => {
    return !!getAddbackForLineItem(lineItemKey);
  };

  const isCategoryAddedBack = (category: string): boolean => {
    return !!getAddbackForCategory(category);
  };

  const isMonthCellAddedBack = (lineItemKey: string, year: number, month: number): boolean => {
    return !!getAddbackForMonthCell(lineItemKey, year, month);
  };

  const toggleLineItemAddback = async (lineItemKey: string, lineItemLabel: string, category: string, reason?: string, department?: string) => {
    const existing = addbacksQuery.data?.find(
      a => (a.lineItemKey === lineItemKey || a.lineItemId === lineItemKey) && a.scope === 'line_item'
    );
    if (existing) {
      await toggleMutation.mutateAsync({ addbackId: existing.id, isActive: !existing.isActive });
    } else {
      await createOrUpdateMutation.mutateAsync({
        lineItemKey,
        lineItemLabel,
        category,
        department,
        scope: 'line_item',
        reason: reason || 'other',
        periodType: 'yearly',
      });
    }
  };

  const toggleCategoryAddback = async (category: string, reason?: string, department?: string) => {
    const existing = addbacksQuery.data?.find(
      a => a.lineItemKey === category && a.scope === 'category'
    );
    if (existing) {
      await toggleMutation.mutateAsync({ addbackId: existing.id, isActive: !existing.isActive });
    } else {
      await createOrUpdateMutation.mutateAsync({
        lineItemKey: category,
        lineItemLabel: `${category} (Entire Department)`,
        category,
        department,
        scope: 'category',
        reason: reason || 'other',
        periodType: 'yearly',
      });
    }
  };

  const toggleMonthCellAddback = async (lineItemKey: string, lineItemLabel: string, category: string, year: number, month: number, reason?: string, department?: string) => {
    const existing = addbacksQuery.data?.find(
      a => (a.lineItemKey === lineItemKey || a.lineItemId === lineItemKey)
        && a.scope === 'month_cell'
        && a.addbackYear === year
        && a.addbackMonth === month
    );
    if (existing) {
      await toggleMutation.mutateAsync({ addbackId: existing.id, isActive: !existing.isActive });
    } else {
      await createOrUpdateMutation.mutateAsync({
        lineItemKey,
        lineItemLabel,
        category,
        department,
        scope: 'month_cell',
        addbackMonth: month,
        addbackYear: year,
        reason: reason || 'other',
        periodType: 'monthly',
      });
    }
  };

  const bulkAddbackAllMonths = async (data: {
    lineItemKey: string;
    lineItemLabel: string;
    category: string;
    department?: string;
    reason?: string;
    notes?: string;
    months: { year: number; month: number; amount: string }[];
  }) => {
    const response = await apiRequest('POST', `/api/modeling/projects/${projectId}/addbacks/bulk-months`, data);
    const result = await response.json();
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'addbacks'] });
    toast({ title: 'Addbacks Applied', description: `Applied addback to ${data.months.length} months.` });
    return result;
  };

  const hasAnyMonthAddback = (lineItemKey: string, year: number): boolean => {
    if (!addbacksQuery.data) return false;
    return addbacksQuery.data.some(
      a => (a.lineItemKey === lineItemKey || a.lineItemId === lineItemKey)
        && a.scope === 'month_cell'
        && a.addbackYear === year
        && a.isActive
    );
  };

  const getActiveAddbacks = (): Addback[] => {
    return (addbacksQuery.data || []).filter(a => a.isActive);
  };

  const getAddbackAmountForCell = (lineItemKey: string, year: number, month: number): number => {
    const cellAddback = getAddbackForMonthCell(lineItemKey, year, month);
    if (cellAddback && cellAddback.values.length > 0) {
      return parseFloat(cellAddback.values[0].amount) || 0;
    }
    return 0;
  };

  const getAddbackAmountForLineItem = (lineItemKey: string): number => {
    const addback = getAddbackForLineItem(lineItemKey);
    if (addback && addback.values.length > 0) {
      return addback.values.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
    }
    return 0;
  };

  const getTotalAddbacksForPeriod = (year: number, month?: number): number => {
    if (!addbacksQuery.data) return 0;
    
    return addbacksQuery.data.filter(a => a.isActive).reduce((total, addback) => {
      const matchingValue = addback.values.find(v => {
        if (addback.periodType === 'yearly') {
          return v.year === year;
        }
        return v.year === year && v.month === month;
      });
      return total + (matchingValue ? parseFloat(matchingValue.amount) || 0 : 0);
    }, 0);
  };

  const getAddbacksSummary = () => {
    if (!addbacksQuery.data) return { total: 0, byReason: {} as Record<string, number>, count: 0, byScope: {} as Record<string, number> };
    
    const activeAddbacks = addbacksQuery.data.filter(a => a.isActive);
    const byReason: Record<string, number> = {};
    const byScope: Record<string, number> = { line_item: 0, category: 0, month_cell: 0 };
    let total = 0;
    
    activeAddbacks.forEach(addback => {
      const reason = addback.reason || 'other';
      const lineTotal = addback.values.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
      byReason[reason] = (byReason[reason] || 0) + lineTotal;
      byScope[addback.scope] = (byScope[addback.scope] || 0) + 1;
      total += lineTotal;
    });
    
    return { total, byReason, count: activeAddbacks.length, byScope };
  };

  return {
    addbacks: addbacksQuery.data || [],
    activeAddbacks: getActiveAddbacks(),
    isLoading: addbacksQuery.isLoading,
    createOrUpdate: createOrUpdateMutation.mutateAsync,
    toggleAddback: toggleMutation.mutateAsync,
    deleteAddback: deleteAddbackMutation.mutateAsync,
    getAddbackForLineItem,
    getAddbackForCategory,
    getAddbackForMonthCell,
    getAnyAddback,
    isLineItemAddedBack,
    isCategoryAddedBack,
    isMonthCellAddedBack,
    toggleLineItemAddback,
    toggleCategoryAddback,
    toggleMonthCellAddback,
    bulkAddbackAllMonths,
    hasAnyMonthAddback,
    getAddbackAmountForCell,
    getAddbackAmountForLineItem,
    getTotalAddbacksForPeriod,
    getAddbacksSummary,
    isPending: createOrUpdateMutation.isPending || deleteAddbackMutation.isPending || toggleMutation.isPending,
  };
}
