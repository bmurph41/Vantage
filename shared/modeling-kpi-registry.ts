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
  // Marina-specific
  totalSlips?: number;
  revenuePerSlip?: number;
  slipOccupancy?: number;
  // Hotel-specific
  adr?: number;
  revpar?: number;
  hotelOccupancy?: number;
  fbRevenuePct?: number;
  // Self-storage-specific
  physicalOccupancy?: number;
  ratePerSf?: number;
  // STR-specific
  avgDailyRate?: number;
  strOccupancy?: number;
  // RV Park
  rvSiteOccupancy?: number;
  [key: string]: number | undefined;
}

export interface KpiAnnualRow {
  year?: number;
  noi?: number;
  revenue?: number;
  expenses?: number;
  debtService?: number;
  // Operational fields (populated when asset-class engine provides them)
  revenuePerSlip?: number;
  slipOccupancy?: number;
  adr?: number;
  revpar?: number;
  physicalOccupancy?: number;
  ratePerSf?: number;
  avgDailyRate?: number;
  strOccupancy?: number;
  rvSiteOccupancy?: number;
  [key: string]: number | undefined;
}

export interface ModelingKpiDef {
  key: string;
  label: string;
  format: 'currency' | 'percent' | 'multiple' | 'number';
  color: string;
  tooltip?: string;
  compute: (metrics: KpiMetrics, annualProjections?: KpiAnnualRow[]) => number | null;
  /** Per-year computation for baseline/stabilized display and sparkline. */
  computeByYear?: (annualRow: KpiAnnualRow, metrics: KpiMetrics) => number | null;
  /** Value >= benchmarkGood → green (good). */
  benchmarkGood?: number;
  /** Value >= benchmarkWarn (and < benchmarkGood) → amber (caution); below → red. */
  benchmarkWarn?: number;
  /** When true the benchmark direction is inverted: lower is better (e.g. LTV). */
  benchmarkInvert?: boolean;
}

export const MODELING_KPI_REGISTRY: Record<string, ModelingKpiDef> = {
  irr: {
    key: 'irr',
    label: 'Levered IRR',
    format: 'percent',
    color: 'text-violet-600 dark:text-violet-400',
    tooltip: 'Internal Rate of Return on levered equity cash flows',
    compute: (m) => m.irr ?? null,
    benchmarkGood: 15,
    benchmarkWarn: 10,
  },
  equityMultiple: {
    key: 'equityMultiple',
    label: 'Equity Multiple',
    format: 'multiple',
    color: 'text-blue-600 dark:text-blue-400',
    tooltip: 'Total equity distributions divided by invested equity',
    compute: (m) => m.equityMultiple ?? null,
    benchmarkGood: 2.0,
    benchmarkWarn: 1.5,
  },
  goingInCapRate: {
    key: 'goingInCapRate',
    label: 'Going-In Cap',
    format: 'percent',
    color: 'text-sky-600 dark:text-sky-400',
    tooltip: 'Year 1 NOI / Purchase Price',
    compute: (m) => m.goingInCapRate ?? null,
    benchmarkGood: 7,
    benchmarkWarn: 5,
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
    computeByYear: (row) => row.noi ?? null,
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
    benchmarkGood: 20,
    benchmarkWarn: 12,
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
    benchmarkGood: 5,
    benchmarkWarn: 2,
  },
  dscr: {
    key: 'dscr',
    label: 'Min DSCR',
    format: 'number',
    color: 'text-teal-600 dark:text-teal-400',
    tooltip: 'Minimum Debt Service Coverage Ratio over hold period',
    compute: (m) => m.minDscr ?? null,
    benchmarkGood: 1.5,
    benchmarkWarn: 1.25,
  },
  ltv: {
    key: 'ltv',
    label: 'LTV',
    format: 'percent',
    color: 'text-cyan-600 dark:text-cyan-400',
    tooltip: 'Loan-to-Value at acquisition',
    compute: (m) => m.ltv ?? null,
    benchmarkGood: 65,
    benchmarkWarn: 75,
    benchmarkInvert: true,
  },
  // ─── Marina-specific ──────────────────────────────────────────────────
  revenuePerSlip: {
    key: 'revenuePerSlip',
    label: 'Rev / Slip',
    format: 'currency',
    color: 'text-cyan-700 dark:text-cyan-300',
    tooltip: 'Annual revenue per occupied slip',
    compute: (m, rows) => {
      if (m.revenuePerSlip != null) return m.revenuePerSlip;
      if (m.totalSlips && m.totalSlips > 0 && rows?.length) {
        return (rows[0]?.revenue ?? 0) / m.totalSlips;
      }
      return null;
    },
    computeByYear: (row, m) => {
      if (row.revenuePerSlip != null) return row.revenuePerSlip;
      if (m.totalSlips && m.totalSlips > 0 && row.revenue != null) {
        return row.revenue / m.totalSlips;
      }
      return null;
    },
    benchmarkGood: 5000,
    benchmarkWarn: 3000,
  },
  slipOccupancy: {
    key: 'slipOccupancy',
    label: 'Slip Occ.',
    format: 'percent',
    color: 'text-blue-700 dark:text-blue-300',
    tooltip: 'Percentage of slips under active lease or contract',
    compute: (m) => m.slipOccupancy ?? null,
    computeByYear: (row) => row.slipOccupancy ?? null,
    benchmarkGood: 90,
    benchmarkWarn: 75,
  },
  // ─── Hotel-specific ───────────────────────────────────────────────────
  adr: {
    key: 'adr',
    label: 'ADR',
    format: 'currency',
    color: 'text-fuchsia-600 dark:text-fuchsia-400',
    tooltip: 'Average Daily Rate (Revenue / Occupied Rooms)',
    compute: (m) => m.adr ?? null,
    computeByYear: (row) => row.adr ?? null,
    benchmarkGood: 200,
    benchmarkWarn: 120,
  },
  revpar: {
    key: 'revpar',
    label: 'RevPAR',
    format: 'currency',
    color: 'text-pink-600 dark:text-pink-400',
    tooltip: 'Revenue Per Available Room (ADR × Occupancy)',
    compute: (m) => m.revpar ?? null,
    computeByYear: (row) => row.revpar ?? null,
    benchmarkGood: 150,
    benchmarkWarn: 80,
  },
  fbRevenuePct: {
    key: 'fbRevenuePct',
    label: 'F&B Rev %',
    format: 'percent',
    color: 'text-rose-600 dark:text-rose-400',
    tooltip: 'Food & Beverage revenue as a percentage of total revenue',
    compute: (m) => m.fbRevenuePct ?? null,
    benchmarkGood: 30,
    benchmarkWarn: 15,
  },
  // ─── Self-storage-specific ────────────────────────────────────────────
  physicalOccupancy: {
    key: 'physicalOccupancy',
    label: 'Phys. Occ.',
    format: 'percent',
    color: 'text-yellow-600 dark:text-yellow-400',
    tooltip: 'Physical occupancy rate of storage units',
    compute: (m) => m.physicalOccupancy ?? null,
    computeByYear: (row) => row.physicalOccupancy ?? null,
    benchmarkGood: 90,
    benchmarkWarn: 80,
  },
  ratePerSf: {
    key: 'ratePerSf',
    label: 'Rate / SF',
    format: 'currency',
    color: 'text-lime-700 dark:text-lime-300',
    tooltip: 'Street rate per square foot per month',
    compute: (m) => m.ratePerSf ?? null,
    computeByYear: (row) => row.ratePerSf ?? null,
    benchmarkGood: 1.5,
    benchmarkWarn: 0.9,
  },
  // ─── STR-specific ─────────────────────────────────────────────────────
  avgDailyRate: {
    key: 'avgDailyRate',
    label: 'Avg Daily Rate',
    format: 'currency',
    color: 'text-orange-700 dark:text-orange-300',
    tooltip: 'Average Daily Rate for short-term rental units',
    compute: (m) => m.avgDailyRate ?? null,
    computeByYear: (row) => row.avgDailyRate ?? null,
    benchmarkGood: 250,
    benchmarkWarn: 150,
  },
  strOccupancy: {
    key: 'strOccupancy',
    label: 'STR Occ.',
    format: 'percent',
    color: 'text-amber-700 dark:text-amber-300',
    tooltip: 'Short-term rental occupancy rate',
    compute: (m) => m.strOccupancy ?? null,
    computeByYear: (row) => row.strOccupancy ?? null,
    benchmarkGood: 75,
    benchmarkWarn: 60,
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
  marina:       ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr', 'revenuePerSlip', 'slipOccupancy'],
  multifamily:  ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr', 'physicalOccupancy'],
  hotel:        ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr', 'adr', 'revpar', 'fbRevenuePct'],
  str:          ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'noiCagr', 'avgDailyRate', 'strOccupancy'],
  rv_park:      ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr', 'physicalOccupancy'],
  retail:       ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'dscr', 'ltv'],
  office:       ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'dscr', 'ltv'],
  industrial:   ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'dscr', 'ltv'],
  self_storage: ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'noiCagr', 'dscr', 'ltv', 'physicalOccupancy', 'ratePerSf'],
  mixed_use:    ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr'],
  business:     ['irr', 'equityMultiple', 'totalReturn', 'exitValue', 'stabilizedNoi', 'noiCagr'],
  default:      ['irr', 'equityMultiple', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue'],
};

export function getKpisForAssetClass(assetClass?: string | null): ModelingKpiDef[] {
  const normalized = (assetClass?.toLowerCase().replace(/[-\s]/g, '_') || 'default') as ModelingAssetClass;
  const keys = ASSET_CLASS_KPI_SETS[normalized] ?? ASSET_CLASS_KPI_SETS.default;
  return keys.map((k) => MODELING_KPI_REGISTRY[k]).filter(Boolean);
}
