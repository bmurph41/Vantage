import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface PnlOverride {
  id: string;
  projectId: string;
  orgId: string;
  lineItemKey: string;
  category: string | null;
  overrideType: 'department' | 'exclude';
  overrideDepartment: string | null;
  isActive: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const VALID_DEPARTMENTS = [
  'Storage', 'Fuel', "Ship's Store", 'Service', 'Boat Sales',
  'Boat Brokerage', 'Payroll', 'Marina & Amenities', 'General',
  'Boat Rentals', 'Boat Club', 'Boat Finance', 'Commercial',
  'F&B', 'Restaurant', 'RV Park', 'Hospitality', 'Parts', 'Miscellaneous',
];

export function useModelingPnlOverrides(projectId: string) {
  const { toast } = useToast();

  const overridesQuery = useQuery<PnlOverride[]>({
    queryKey: ['/api/modeling/projects', projectId, 'pnl-overrides'],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/pnl-overrides`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch overrides');
      return res.json();
    },
    enabled: !!projectId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pnl-overrides'] });
    queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/actuals`] });
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'historical-pl'] });
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
  };

  const upsertMutation = useMutation({
    mutationFn: async (data: {
      lineItemKey: string;
      category?: string;
      overrideType: 'department' | 'exclude';
      overrideDepartment?: string;
      notes?: string;
    }) => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/pnl-overrides`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      invalidate();
      if (variables.overrideType === 'department') {
        toast({ title: 'Department Updated', description: `Moved "${variables.lineItemKey}" to ${variables.overrideDepartment}.` });
      } else {
        toast({ title: 'Line Item Excluded', description: `"${variables.lineItemKey}" has been excluded from P&L.` });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to save override', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (overrideId: string) => {
      const res = await apiRequest('DELETE', `/api/modeling/projects/${projectId}/pnl-overrides/${overrideId}`);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Override Removed', description: 'Line item restored to original position.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to remove override', variant: 'destructive' });
    },
  });

  const moveToDepartment = (lineItemKey: string, targetDepartment: string, category?: string) => {
    upsertMutation.mutate({
      lineItemKey,
      category,
      overrideType: 'department',
      overrideDepartment: targetDepartment,
    });
  };

  const excludeLineItem = (lineItemKey: string, category?: string) => {
    upsertMutation.mutate({
      lineItemKey,
      category,
      overrideType: 'exclude',
    });
  };

  const restoreLineItem = (lineItemKey: string) => {
    const override = (overridesQuery.data || []).find(
      o => o.lineItemKey === lineItemKey && o.overrideType === 'exclude' && o.isActive
    );
    if (override) {
      deleteMutation.mutate(override.id);
    }
  };

  const removeDepartmentOverride = (lineItemKey: string) => {
    const override = (overridesQuery.data || []).find(
      o => o.lineItemKey === lineItemKey && o.overrideType === 'department' && o.isActive
    );
    if (override) {
      deleteMutation.mutate(override.id);
    }
  };

  const isExcluded = (lineItemKey: string): boolean => {
    return (overridesQuery.data || []).some(
      o => o.lineItemKey === lineItemKey && o.overrideType === 'exclude' && o.isActive
    );
  };

  const getDepartmentOverride = (lineItemKey: string): string | null => {
    const override = (overridesQuery.data || []).find(
      o => o.lineItemKey === lineItemKey && o.overrideType === 'department' && o.isActive
    );
    return override?.overrideDepartment || null;
  };

  const getExcludedItems = (): PnlOverride[] => {
    return (overridesQuery.data || []).filter(o => o.overrideType === 'exclude' && o.isActive);
  };

  return {
    overrides: overridesQuery.data || [],
    isLoading: overridesQuery.isLoading,
    moveToDepartment,
    excludeLineItem,
    restoreLineItem,
    removeDepartmentOverride,
    isExcluded,
    getDepartmentOverride,
    getExcludedItems,
    isPending: upsertMutation.isPending || deleteMutation.isPending,
  };
}
