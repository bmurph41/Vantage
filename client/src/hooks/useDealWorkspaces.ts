import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { DealWorkspace, InsertDealWorkspace } from '@shared/schema';

export function useDealWorkspaces(filters?: { status?: string; role?: string }) {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.set('status', filters.status);
  if (filters?.role) queryParams.set('role', filters.role);
  const queryString = queryParams.toString();
  
  return useQuery<DealWorkspace[]>({
    queryKey: ['/api/workspaces', filters],
    queryFn: async () => {
      const url = queryString ? `/api/workspaces?${queryString}` : '/api/workspaces';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      return response.json();
    },
  });
}

export function useDealWorkspace(workspaceId: string | undefined) {
  return useQuery<DealWorkspace & { 
    deal?: any; 
    modelingProject?: any; 
    ddProject?: any; 
    property?: any;
    creator?: { id: string; name: string };
  }>({
    queryKey: ['/api/workspaces', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch workspace');
      return response.json();
    },
    enabled: !!workspaceId,
  });
}

export function useWorkspaceOverview(workspaceId: string | undefined) {
  return useQuery<{
    workspace: DealWorkspace & { deal?: any; modelingProject?: any; ddProject?: any; property?: any };
    stats: {
      dd: { total: number; completed: number; pending: number; overdue: number };
      vdr: { folders: number; documents: number; pendingRequests: number };
      modeling: { hasProject: boolean };
    };
  }>({
    queryKey: ['/api/workspaces', workspaceId, 'overview'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/overview`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch workspace overview');
      return response.json();
    },
    enabled: !!workspaceId,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<InsertDealWorkspace>) => {
      const response = await apiRequest('POST', '/api/workspaces', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertDealWorkspace> }) => {
      const response = await apiRequest('PATCH', `/api/workspaces/${id}`, data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', variables.id] });
    },
  });
}

export function useArchiveWorkspace() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/workspaces/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
    },
  });
}

export function useLinkWorkspaceEntities() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, entities }: { 
      id: string; 
      entities: { dealId?: string; modelingProjectId?: string; ddProjectId?: string; propertyId?: string } 
    }) => {
      const response = await apiRequest('POST', `/api/workspaces/${id}/link`, entities);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', variables.id] });
    },
  });
}

export function useCreateWorkspaceFromDeal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dealId, role }: { dealId: string; role?: string }) => {
      const response = await apiRequest('POST', `/api/workspaces/from-deal/${dealId}`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces'] });
    },
  });
}
