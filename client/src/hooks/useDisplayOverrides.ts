import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface NameOverride {
  id: string;
  orgId: string;
  projectId: string;
  scope: 'department' | 'line_item';
  originalName: string;
  displayName: string;
  category: string | null;
  department: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgDisplayDefault {
  id: string;
  orgId: string;
  scope: 'department' | 'line_item';
  originalName: string;
  displayName: string;
  category: string | null;
  department: string | null;
  isActive: boolean;
  timesUsed: number | null;
}

interface OverridesResponse {
  overrides: NameOverride[];
  orgDefaults: OrgDisplayDefault[];
}

export function useDisplayOverrides(projectId: string | undefined) {
  const { toast } = useToast();

  const query = useQuery<OverridesResponse>({
    queryKey: ['/api/modeling/projects', projectId, 'name-overrides'],
    enabled: !!projectId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: {
      scope: 'department' | 'line_item';
      originalName: string;
      displayName: string;
      category?: string;
      department?: string;
    }) => {
      const response = await apiRequest('POST', `/api/modeling/projects/${projectId}/name-overrides`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'name-overrides'] });
      toast({ title: 'Name Updated', description: 'Display name saved for this project and added to your defaults.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (overrideId: string) => {
      const response = await apiRequest('DELETE', `/api/modeling/projects/${projectId}/name-overrides/${overrideId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'name-overrides'] });
      toast({ title: 'Name Reverted', description: 'Reverted to original name.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const overrides = query.data?.overrides || [];
  const orgDefaults = query.data?.orgDefaults || [];

  const findOverride = (originalName: string, scope: 'department' | 'line_item', category?: string, department?: string): NameOverride | undefined => {
    if (scope === 'line_item' && category) {
      const exact = overrides.find(o => o.scope === scope && o.originalName === originalName && o.category === category);
      if (exact) return exact;
    }
    return overrides.find(o => o.scope === scope && o.originalName === originalName);
  };

  const findOrgDefault = (originalName: string, scope: 'department' | 'line_item'): OrgDisplayDefault | undefined => {
    return orgDefaults.find(d => d.scope === scope && d.originalName === originalName);
  };

  const getDisplayName = (originalName: string, scope: 'department' | 'line_item', category?: string, department?: string): string => {
    const projectOverride = findOverride(originalName, scope, category, department);
    if (projectOverride) return projectOverride.displayName;

    const orgDefault = findOrgDefault(originalName, scope);
    if (orgDefault) return orgDefault.displayName;

    return originalName;
  };

  const getOverride = (originalName: string, scope: 'department' | 'line_item', category?: string, department?: string): NameOverride | undefined => {
    return findOverride(originalName, scope, category, department);
  };

  const hasOverride = (originalName: string, scope: 'department' | 'line_item', category?: string, department?: string): boolean => {
    return !!findOverride(originalName, scope, category, department);
  };

  const getOrgDefaultSuggestion = (originalName: string, scope: 'department' | 'line_item'): string | undefined => {
    const orgDefault = findOrgDefault(originalName, scope);
    return orgDefault?.displayName;
  };

  return {
    overrides,
    orgDefaults,
    isLoading: query.isLoading,
    getDisplayName,
    getOverride,
    hasOverride,
    getOrgDefaultSuggestion,
    saveOverride: saveMutation.mutateAsync,
    deleteOverride: deleteMutation.mutateAsync,
    isPending: saveMutation.isPending || deleteMutation.isPending,
  };
}
