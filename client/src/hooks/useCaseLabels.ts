import { useMemo } from 'react';
import type { ModelingProject } from '@shared/schema';

export type CaseType = 'base' | 'aggressive' | 'conservative' | 'custom';

export interface CaseLabels {
  base: string;
  aggressive: string;
  conservative: string;
  custom: string;
}

const DEFAULT_CASE_LABELS: CaseLabels = {
  base: 'Base Case',
  aggressive: 'Aggressive Case',
  conservative: 'Conservative Case',
  custom: 'Custom Case',
};

export function useCaseLabels(project: ModelingProject | null | undefined) {
  const labels = useMemo<CaseLabels>(() => {
    if (!project?.caseLabels) {
      return DEFAULT_CASE_LABELS;
    }
    
    const projectLabels = project.caseLabels as Partial<CaseLabels>;
    
    return {
      base: projectLabels.base || DEFAULT_CASE_LABELS.base,
      aggressive: projectLabels.aggressive || DEFAULT_CASE_LABELS.aggressive,
      conservative: projectLabels.conservative || DEFAULT_CASE_LABELS.conservative,
      custom: projectLabels.custom || DEFAULT_CASE_LABELS.custom,
    };
  }, [project?.caseLabels]);

  const getLabel = (caseType: CaseType): string => {
    return labels[caseType] || DEFAULT_CASE_LABELS[caseType] || caseType;
  };

  const getCaseColor = (caseType: CaseType): string => {
    const colors: Record<CaseType, string> = {
      base: 'bg-blue-500',
      aggressive: 'bg-green-500',
      conservative: 'bg-amber-500',
      custom: 'bg-purple-500',
    };
    return colors[caseType] || 'bg-gray-500';
  };

  const getCaseBorderColor = (caseType: CaseType): string => {
    const colors: Record<CaseType, string> = {
      base: 'border-blue-500',
      aggressive: 'border-green-500',
      conservative: 'border-amber-500',
      custom: 'border-purple-500',
    };
    return colors[caseType] || 'border-gray-500';
  };

  const getCaseTextColor = (caseType: CaseType): string => {
    const colors: Record<CaseType, string> = {
      base: 'text-blue-600 dark:text-blue-400',
      aggressive: 'text-green-600 dark:text-green-400',
      conservative: 'text-amber-600 dark:text-amber-400',
      custom: 'text-purple-600 dark:text-purple-400',
    };
    return colors[caseType] || 'text-gray-600 dark:text-gray-400';
  };

  const getCaseBgColor = (caseType: CaseType): string => {
    const colors: Record<CaseType, string> = {
      base: 'bg-blue-50 dark:bg-blue-950',
      aggressive: 'bg-green-50 dark:bg-green-950',
      conservative: 'bg-amber-50 dark:bg-amber-950',
      custom: 'bg-purple-50 dark:bg-purple-950',
    };
    return colors[caseType] || 'bg-gray-50 dark:bg-gray-950';
  };

  return {
    labels,
    getLabel,
    getCaseColor,
    getCaseBorderColor,
    getCaseTextColor,
    getCaseBgColor,
    defaultLabels: DEFAULT_CASE_LABELS,
  };
}

export { DEFAULT_CASE_LABELS };
