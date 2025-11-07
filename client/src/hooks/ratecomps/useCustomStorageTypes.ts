import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RcCustomStorageType } from "@shared/schema";

export function useCustomStorageTypes() {
  return useQuery<RcCustomStorageType[]>({
    queryKey: ['/api/rate-comps/custom-storage-types'],
  });
}

export function useCreateCustomStorageType() {
  return useMutation({
    mutationFn: async (name: string) => {
      return apiRequest<RcCustomStorageType>('/api/rate-comps/custom-storage-types', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps/custom-storage-types'] });
    },
  });
}

export function useDeleteCustomStorageType() {
  return useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/rate-comps/custom-storage-types/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps/custom-storage-types'] });
    },
  });
}
