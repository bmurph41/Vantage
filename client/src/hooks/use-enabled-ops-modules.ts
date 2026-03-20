import { useQuery } from "@tanstack/react-query";

interface OpsModulesResponse {
  modules: string[];
  assetClasses: string[];
  assets: Array<{
    id: string;
    name: string;
    assetType: string;
    propertyId: string;
    projectId: string | null;
    status: string;
  }>;
}

/**
 * Hook to fetch which operations modules are enabled for the current user's org,
 * based on the asset classes of their owned properties.
 */
export function useEnabledOpsModules() {
  const { data, isLoading } = useQuery<OpsModulesResponse>({
    queryKey: ["/api/operations-context/modules"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    enabledModules: data?.modules || [],
    assetClasses: data?.assetClasses || [],
    assets: data?.assets || [],
    isLoading,
    isModuleEnabled: (moduleKey: string) => {
      if (!data?.modules || data.modules.length === 0) return true; // Default: show all
      return data.modules.includes(moduleKey);
    },
  };
}
