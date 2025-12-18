import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface CrmListMember {
  id: string;
  listId: string;
  entityId: string;
  addedAt: string;
}

export interface CrmList {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  entityType: 'contact' | 'company' | 'property';
  color: string | null;
  isSmartList: boolean;
  smartCriteria: Record<string, any> | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members?: CrmListMember[];
}

export function useCrmLists(entityType?: 'contact' | 'company' | 'property') {
  const { toast } = useToast();

  const listsQuery = useQuery<CrmList[]>({
    queryKey: entityType 
      ? ['/api/crm/lists', { entityType }] 
      : ['/api/crm/lists'],
  });

  const createListMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      description?: string; 
      entityType: 'contact' | 'company' | 'property';
      color?: string;
    }) => {
      const response = await apiRequest('POST', '/api/crm/lists', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lists'] });
      toast({ title: 'List Created', description: 'New list has been created.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateListMutation = useMutation({
    mutationFn: async ({ listId, data }: { listId: string; data: Partial<CrmList> }) => {
      const response = await apiRequest('PATCH', `/api/crm/lists/${listId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lists'] });
      toast({ title: 'List Updated', description: 'List has been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const response = await apiRequest('DELETE', `/api/crm/lists/${listId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lists'] });
      toast({ title: 'List Deleted', description: 'List has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    lists: listsQuery.data || [],
    isLoading: listsQuery.isLoading,
    createList: createListMutation.mutateAsync,
    updateList: updateListMutation.mutateAsync,
    deleteList: deleteListMutation.mutateAsync,
    isPending: createListMutation.isPending || updateListMutation.isPending || deleteListMutation.isPending,
  };
}

export function useCrmListMembers(listId: string | undefined) {
  const { toast } = useToast();

  const listQuery = useQuery<CrmList>({
    queryKey: ['/api/crm/lists', listId],
    enabled: !!listId,
  });

  const addMembersMutation = useMutation({
    mutationFn: async (entityIds: string[]) => {
      const response = await apiRequest('POST', `/api/crm/lists/${listId}/members`, { entityIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lists', listId] });
      toast({ title: 'Members Added', description: `${data.added} member(s) added to list.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const response = await apiRequest('DELETE', `/api/crm/lists/${listId}/members/${entityId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lists', listId] });
      toast({ title: 'Member Removed', description: 'Member has been removed from list.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    list: listQuery.data,
    members: listQuery.data?.members || [],
    isLoading: listQuery.isLoading,
    addMembers: addMembersMutation.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    isPending: addMembersMutation.isPending || removeMemberMutation.isPending,
  };
}

export const LIST_COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
] as const;
