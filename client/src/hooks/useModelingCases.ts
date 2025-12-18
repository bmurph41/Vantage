import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export interface ModelingCase {
  id: string;
  projectId: string;
  orgId: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isDefault: boolean;
  color?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseAssumption {
  id: string;
  caseId: string;
  category: string;
  key: string;
  value: string;
  label?: string | null;
  notes?: string | null;
}

export function useModelingCases(projectId: string | undefined) {
  const { toast } = useToast();

  const casesQuery = useQuery<ModelingCase[]>({
    queryKey: ['/api/modeling/projects', projectId, 'cases'],
    enabled: !!projectId,
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      const response = await apiRequest('POST', `/api/modeling/projects/${projectId}/cases`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      toast({ title: 'Case Created', description: 'New scenario case has been added.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateCaseMutation = useMutation({
    mutationFn: async ({ caseId, data }: { caseId: string; data: Partial<ModelingCase> }) => {
      const response = await apiRequest('PATCH', `/api/modeling/cases/${caseId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      toast({ title: 'Case Updated', description: 'Scenario case has been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await apiRequest('DELETE', `/api/modeling/cases/${caseId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      toast({ title: 'Case Deleted', description: 'Scenario case has been removed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const response = await apiRequest('POST', `/api/modeling/cases/${caseId}/set-default`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      toast({ title: 'Default Case Set', description: 'This case will be used by default.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const cloneCaseMutation = useMutation({
    mutationFn: async ({ caseId, name, description }: { caseId: string; name?: string; description?: string }) => {
      const response = await apiRequest('POST', `/api/modeling/cases/${caseId}/clone`, { name, description });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'cases'] });
      toast({ title: 'Case Cloned', description: 'Scenario case and its assumptions have been duplicated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const defaultCase = casesQuery.data?.find(c => c.isDefault) || casesQuery.data?.[0];

  return {
    cases: casesQuery.data || [],
    isLoading: casesQuery.isLoading,
    defaultCase,
    createCase: createCaseMutation.mutateAsync,
    updateCase: updateCaseMutation.mutateAsync,
    deleteCase: deleteCaseMutation.mutateAsync,
    setDefault: setDefaultMutation.mutateAsync,
    cloneCase: cloneCaseMutation.mutateAsync,
    isPending: 
      createCaseMutation.isPending || 
      updateCaseMutation.isPending || 
      deleteCaseMutation.isPending ||
      setDefaultMutation.isPending ||
      cloneCaseMutation.isPending,
  };
}

export function useCaseAssumptions(caseId: string | undefined) {
  const { toast } = useToast();

  const assumptionsQuery = useQuery<CaseAssumption[]>({
    queryKey: ['/api/modeling/cases', caseId, 'assumptions'],
    enabled: !!caseId,
  });

  const updateAssumptionsMutation = useMutation({
    mutationFn: async (assumptions: Omit<CaseAssumption, 'id' | 'caseId'>[]) => {
      const response = await apiRequest('PUT', `/api/modeling/cases/${caseId}/assumptions`, { assumptions });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/cases', caseId, 'assumptions'] });
      toast({ title: 'Assumptions Saved', description: 'Case assumptions have been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    assumptions: assumptionsQuery.data || [],
    isLoading: assumptionsQuery.isLoading,
    updateAssumptions: updateAssumptionsMutation.mutateAsync,
    isPending: updateAssumptionsMutation.isPending,
  };
}

export const CASE_COLORS = [
  { value: 'blue', label: 'Blue', bg: 'bg-blue-100', border: 'border-blue-500', dot: 'bg-blue-500' },
  { value: 'green', label: 'Green', bg: 'bg-green-100', border: 'border-green-500', dot: 'bg-green-500' },
  { value: 'amber', label: 'Amber', bg: 'bg-amber-100', border: 'border-amber-500', dot: 'bg-amber-500' },
  { value: 'red', label: 'Red', bg: 'bg-red-100', border: 'border-red-500', dot: 'bg-red-500' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-100', border: 'border-purple-500', dot: 'bg-purple-500' },
  { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-100', border: 'border-indigo-500', dot: 'bg-indigo-500' },
] as const;

export function getCaseColorClasses(color: string | null | undefined) {
  const found = CASE_COLORS.find(c => c.value === color);
  return found || CASE_COLORS[0];
}
