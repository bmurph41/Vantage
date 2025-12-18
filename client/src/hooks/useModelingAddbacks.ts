import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
  lineItemId: string;
  reason: string | null;
  notes: string | null;
  periodType: 'monthly' | 'yearly';
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
      lineItemId: string;
      reason: string;
      notes?: string;
      periodType: 'monthly' | 'yearly';
      values: { year: number; month?: number; amount: string }[];
    }) => {
      const response = await apiRequest('POST', `/api/modeling/projects/${projectId}/addbacks`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'addbacks'] });
      toast({ title: 'Addback Saved', description: 'Line item addback has been saved.' });
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
      toast({ title: 'Addback Removed', description: 'Addback has been removed from this line item.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getAddbackForLineItem = (lineItemId: string): Addback | undefined => {
    return addbacksQuery.data?.find(a => a.lineItemId === lineItemId);
  };

  const getTotalAddbacksForPeriod = (year: number, month?: number): number => {
    if (!addbacksQuery.data) return 0;
    
    return addbacksQuery.data.reduce((total, addback) => {
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
    if (!addbacksQuery.data) return { total: 0, byReason: {} as Record<string, number>, count: 0 };
    
    const byReason: Record<string, number> = {};
    let total = 0;
    
    addbacksQuery.data.forEach(addback => {
      const reason = addback.reason || 'other';
      const lineTotal = addback.values.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
      byReason[reason] = (byReason[reason] || 0) + lineTotal;
      total += lineTotal;
    });
    
    return { total, byReason, count: addbacksQuery.data.length };
  };

  return {
    addbacks: addbacksQuery.data || [],
    isLoading: addbacksQuery.isLoading,
    createOrUpdate: createOrUpdateMutation.mutateAsync,
    deleteAddback: deleteAddbackMutation.mutateAsync,
    getAddbackForLineItem,
    getTotalAddbacksForPeriod,
    getAddbacksSummary,
    isPending: createOrUpdateMutation.isPending || deleteAddbackMutation.isPending,
  };
}
