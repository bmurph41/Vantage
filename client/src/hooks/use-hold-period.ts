import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface UseHoldPeriodReturn {
  holdPeriod: number;
  setHoldPeriod: (value: number) => void;
  isUpdating: boolean;
  config: any;
  isLoading: boolean;
}

export function useHoldPeriod(projectId: string): UseHoldPeriodReturn {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
    enabled: !!projectId,
  });

  const mutation = useMutation({
    mutationFn: async (newHoldPeriod: number) => {
      const res = await apiRequest('PATCH', `/api/modeling/projects/${projectId}/config`, {
        holdPeriod: newHoldPeriod,
      });
      return res.json();
    },
    onMutate: async (newHoldPeriod: number) => {
      await queryClient.cancelQueries({ queryKey: ['/api/modeling/projects', projectId, 'config'] });
      const previous = queryClient.getQueryData(['/api/modeling/projects', projectId, 'config']);
      queryClient.setQueryData(['/api/modeling/projects', projectId, 'config'], (old: any) => ({
        ...old,
        holdPeriod: newHoldPeriod,
      }));
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'assumptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
    },
    onError: (_err: any, _newHoldPeriod: number, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(['/api/modeling/projects', projectId, 'config'], context.previous);
      }
      toast({ title: 'Error', description: 'Failed to update hold period.', variant: 'destructive' });
    },
  });

  const holdPeriod = config?.holdPeriod ?? 5;

  return {
    holdPeriod,
    setHoldPeriod: (value: number) => mutation.mutate(value),
    isUpdating: mutation.isPending,
    config,
    isLoading,
  };
}
