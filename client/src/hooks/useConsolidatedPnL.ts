import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type {
  ConsolidatedPnLOptions,
  ConsolidatedPnLResponse,
  ApplyAdjustmentsRequest,
  ApplyAdjustmentsResult,
} from '@shared/types/consolidated-pnl';

const consolidatedKey = (projectId: string | undefined, options: ConsolidatedPnLOptions) => [
  '/api/modeling/projects',
  projectId,
  'consolidated-pnl',
  options.yearRange,
  options.customStart?.year ?? null,
  options.customStart?.month ?? null,
  options.customEnd?.year ?? null,
  options.customEnd?.month ?? null,
  options.fiscalYearStartMonth ?? null,
];

export function useConsolidatedPnL(
  projectId: string | undefined,
  options: ConsolidatedPnLOptions,
) {
  return useQuery<ConsolidatedPnLResponse>({
    queryKey: consolidatedKey(projectId, options),
    queryFn: async () => {
      const res = await apiRequest(
        'POST',
        `/api/modeling/projects/${projectId}/consolidated-pnl`,
        options,
      );
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useApplyAdjustments(projectId: string | undefined) {
  const { toast } = useToast();

  return useMutation<ApplyAdjustmentsResult, Error, ApplyAdjustmentsRequest>({
    mutationFn: async (request) => {
      const res = await apiRequest(
        'POST',
        `/api/modeling/projects/${projectId}/adjustments/apply`,
        request,
      );
      return res.json();
    },
    onSuccess: (result) => {
      // Invalidate everything downstream of an adjustment apply.
      queryClient.invalidateQueries({
        queryKey: ['/api/modeling/projects', projectId, 'consolidated-pnl'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/modeling/projects', projectId, 'addbacks'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/modeling/projects', projectId, 'actuals'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/modeling/projects', projectId, 'returns'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/modeling/projects', projectId, 'lp-reporting'],
      });

      const parts: string[] = [];
      if (result.appliedToggles > 0) {
        parts.push(`${result.appliedToggles} adjustment${result.appliedToggles === 1 ? '' : 's'}`);
      }
      if (result.masterStateChanged) parts.push('master state');
      toast({
        title: 'Applied to Pro Forma',
        description: parts.length > 0
          ? `Synced ${parts.join(' + ')}.`
          : 'Pro Forma is already in sync with current selections.',
      });
    },
    onError: (err) => {
      toast({
        title: 'Apply failed',
        description: err.message || 'Could not apply adjustments.',
        variant: 'destructive',
      });
    },
  });
}
