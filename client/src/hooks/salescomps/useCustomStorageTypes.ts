import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ScCustomStorageType } from "@shared/schema";

export function useCustomStorageTypes() {
  return useQuery<ScCustomStorageType[]>({
    queryKey: ['/api/sales-comps/custom-storage-types'],
  });
}

export function useCreateCustomStorageType() {
  return useMutation({
    mutationFn: async (name: string) => {
      return apiRequest<ScCustomStorageType>('/api/sales-comps/custom-storage-types', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps/custom-storage-types'] });
    },
  });
}

export function useDeleteCustomStorageType() {
  return useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/sales-comps/custom-storage-types/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-comps/custom-storage-types'] });
    },
  });
}
