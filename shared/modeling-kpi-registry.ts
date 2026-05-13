export interface KpiMetrics {
  irr?: number;
  equityMultiple?: number;
  goingInCapRate?: number;
  exitCapRate?: number;
  stabilizedNoi?: number;
  exitValue?: number;
  totalReturn?: number;
  minDscr?: number;
  ltv?: number;
  [key: string]: number | undefined;
}

export interface KpiAnnualRow {
  noi?: number;
  [key: string]: number | undefined;
}

export interface ModelingKpiDef {
  key: string;
  label: string;
  format: 'currency' | 'percent' | 'multiple' | 'number';
  color: string;
  tooltip?: string;
  compute: (metrics: KpiMetrics, annualProjections?: KpiAnnualRow[]) => number | null;
}

export const MODELING_KPI_REGISTRY: Record<string, ModelingKpiDef> = {
  irr: {
    key: 'irr',
    label: 'Levered IRR',
    format: 'percent',
    color: 'text-violet-600 dark:text-violet-400',
    tooltip: 'Internal Rate of Return on levered equity cash flows',
    compute: (m) => m.irr ?? null,
  },
  equityMultiple: {
    key: 'equityMultiple',
    label: 'Equity Multiple',
    format: 'multiple',
    color: 'text-blue-600 dark:text-blue-400',
    tooltip: 'Total equity distributions divided by invested equity',
    compute: (m) => m.equityMultiple ?? null,
  },
  goingInCapRate: {
    key: 'goingInCapRate',
    label: 'Going-In Cap',
    format: 'percent',
    color: 'text-sky-600 dark:text-sky-400',
    tooltip: 'Year 1 NOI / Purchase Price',
    compute: (m) => m.goingInCapRate ?? null,
  },
  exitCapRate: {
    key: 'exitCapRate',
    label: 'Exit Cap Rate',
    format: 'percent',
    color: 'text-indigo-600 dark:text-indigo-400',
    tooltip: 'Assumed exit capitalization rate',
    compute: (m) => m.exitCapRate ?? null,
  },
  stabilizedNoi: {
    key: 'stabilizedNoi',
    label: 'Stabilized NOI',
    format: 'currency',
    color: 'text-emerald-600 dark:text-emerald-400',
    tooltip: 'NOI at stabilization year',
    compute: (m) => m.stabilizedNoi ?? null,
  },
  exitValue: {
    key: 'exitValue',
    label: 'Exit Value',
    format: 'currency',
    color: 'text-amber-600 dark:text-amber-400',
    tooltip: 'Projected exit value (Stabilized NOI / Exit Cap Rate)',
    compute: (m) => m.exitValue ?? null,
  },
  totalReturn: {
    key: 'totalReturn',
    label: 'Total Return',
    format: 'percent',
    color: 'text-orange-600 dark:text-orange-400',
    tooltip: 'Total return on investment over hold period',
    compute: (m) => m.totalReturn ?? null,
  },
  noiCagr: {
    key: 'noiCagr',
    label: 'NOI CAGR',
    format: 'percent',
    color: 'text-lime-600 dark:text-lime-400',
    tooltip: 'Compound Annual Growth Rate of NOI over hold period',
    compute: (_m, annualProjections) => {
      if (!annualProjections || annualProjections.length < 2) return null;
      const first = annualProjections[0]?.noi;
      const last = annualProjections[annualProjections.length - 1]?.noi;
      if (!first || !last || first <= 0 || last <= 0) return null;
      const n = annualProjections.length - 1;
      return (Math.pow(last / first, 1 / n) - 1) * 100;
    },
  },
  dscr: {
    key: 'dscr',
    label: 'Min DSCR',
    format: 'number',
    color: 'text-teal-600 dark:text-teal-400',
    tooltip: 'Minimum Debt Service Coverage Ratio over hold period',
    compute: (m) => m.minDscr ?? null,
  },
  ltv: {
    key: 'ltv',
    label: 'LTV',
    format: 'percent',
    color: 'text-cyan-600 dark:text-cyan-400',
    tooltip: 'Loan-to-Value at acquisition',
    compute: (m) => m.ltv ?? null,
  },
};

export type ModelingAssetClass =
  | 'marina'
  | 'multifamily'
  | 'hotel'
  | 'str'
  | 'rv_park'
  | 'retail'
  | 'office'
  | 'industrial'
  | 'self_storage'
  | 'mixed_use'
  | 'business'
  | 'default';

export const ASSET_CLASS_KPI_SETS: Record<ModelingAssetClass, string[]> = {
  marina:       ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr'],
  multifamily:  ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr'],
  hotel:        ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr'],
  str:          ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'noiCagr'],
  rv_park:      ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr'],
  retail:       ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'dscr', 'ltv'],
  office:       ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'dscr', 'ltv'],
  industrial:   ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'dscr', 'ltv'],
  self_storage: ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'noiCagr', 'dscr', 'ltv'],
  mixed_use:    ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr'],
  business:     ['irr', 'equityMultiple', 'totalReturn', 'exitValue', 'stabilizedNoi', 'noiCagr'],
  default:      ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue'],
};

export function getKpisForAssetClass(assetClass?: string | null): ModelingKpiDef[] {
  const normalized = (assetClass?.toLowerCase().replace(/[-\s]/g, '_') || 'default') as ModelingAssetClass;
  const keys = ASSET_CLASS_KPI_SETS[normalized] ?? ASSET_CLASS_KPI_SETS.default;
  return keys.map((k) => MODELING_KPI_REGISTRY[k]).filter(Boolean);
}
