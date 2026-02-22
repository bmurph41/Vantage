import { useMemo } from 'react';
import { getModelConfig, getTabOverrides } from '@shared/asset-class-model-config';
import type { AssetClassModelConfig } from '@shared/asset-class-model-config';
import type { ModelingProject } from '@shared/schema';

export function useModelConfig(project: ModelingProject | undefined | null): AssetClassModelConfig {
  return useMemo(() => {
    const assetClass = project?.assetClass || 'marina';
    return getModelConfig(assetClass);
  }, [project?.assetClass]);
}

export function useTabConfig(project: ModelingProject | undefined | null) {
  return useMemo(() => {
    const assetClass = project?.assetClass || 'marina';
    return getTabOverrides(assetClass);
  }, [project?.assetClass]);
}

export function useTerms(project: ModelingProject | undefined | null) {
  const config = useModelConfig(project);
  return config.terms;
}
