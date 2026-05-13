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
  // Universal operational
  equityInvested?: number;
  cashOnCash?: number;
  opexRatio?: number;
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
  // Multifamily-specific
  unitCount?: number;
  revPerUnit?: number;
  rentSpread?: number;
  turnoverRate?: number;
  // Retail / Office-specific
  walt?: number;
  anchorTenantPct?: number;
  nearTermExpiryPct?: number;
  // Industrial-specific
  clearHeight?: number;
  dockDoorCount?: number;
  [key: string]: number | undefined;
}

export interface KpiAnnualRow {
  year?: number;
  noi?: number;
  revenue?: number;
  expenses?: number;
  debtService?: number;
  leveredCashFlow?: number;
  // Operational fields (populated when asset-class engine provides them)
  revenuePerSlip?: number;
  slipOccupancy?: number;
  adr?: number;
  revpar?: number;
  physicalOccupancy?: number;
  ratePerSf?: number;
  avgDailyRate?: number;
  strOccupancy?: number;
  revPerUnit?: number;
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
  /** Value >= benchmarkGood → green. */
  benchmarkGood?: number;
  /** Value >= benchmarkWarn (and < benchmarkGood) → amber; below → red. */
  benchmarkWarn?: number;
  /** When true the benchmark direction is inverted: lower is better (e.g. LTV). */
  benchmarkInvert?: boolean;
}

export const MODELING_KPI_REGISTRY: Record<string, ModelingKpiDef> = {
  // ─── Universal return metrics ─────────────────────────────────────────
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
  cashOnCash: {
    key: 'cashOnCash',
    label: 'Cash-on-Cash',
    format: 'percent',
    color: 'text-emerald-700 dark:text-emerald-300',
    tooltip: 'Year 1 levered cash flow as a percentage of equity invested',
    compute: (m, rows) => {
      if (m.cashOnCash != null) return m.cashOnCash;
      if (!rows?.length || !m.equityInvested || m.equityInvested <= 0) return null;
      return ((rows[0]?.leveredCashFlow ?? 0) / m.equityInvested) * 100;
    },
    computeByYear: (row, m) => {
      if (!m.equityInvested || m.equityInvested <= 0) return null;
      return ((row.leveredCashFlow ?? 0) / m.equityInvested) * 100;
    },
    benchmarkGood: 8,
    benchmarkWarn: 5,
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
  // ─── Universal operational metrics ───────────────────────────────────
  opexRatio: {
    key: 'opexRatio',
    label: 'OpEx Ratio',
    format: 'percent',
    color: 'text-orange-500 dark:text-orange-400',
    tooltip: 'Operating expenses as a percentage of revenue',
    compute: (m, rows) => {
      if (m.opexRatio != null) return m.opexRatio;
      if (!rows?.length) return null;
      const row = rows[0];
      if (!row?.revenue || row.revenue <= 0) return null;
      return ((row.expenses ?? 0) / row.revenue) * 100;
    },
    computeByYear: (row) => {
      if (!row?.revenue || row.revenue <= 0) return null;
      return ((row.expenses ?? 0) / row.revenue) * 100;
    },
    benchmarkGood: 50,
    benchmarkWarn: 65,
    benchmarkInvert: true,
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
  // ─── Multifamily-specific ─────────────────────────────────────────────
  revPerUnit: {
    key: 'revPerUnit',
    label: 'Rev / Unit',
    format: 'currency',
    color: 'text-violet-700 dark:text-violet-300',
    tooltip: 'Annual revenue per residential unit',
    compute: (m, rows) => {
      if (m.revPerUnit != null) return m.revPerUnit;
      if (m.unitCount && m.unitCount > 0 && rows?.length) {
        return (rows[0]?.revenue ?? 0) / m.unitCount;
      }
      return null;
    },
    computeByYear: (row, m) => {
      if (row.revPerUnit != null) return row.revPerUnit;
      if (m.unitCount && m.unitCount > 0 && row.revenue != null) {
        return row.revenue / m.unitCount;
      }
      return null;
    },
    benchmarkGood: 18000,
    benchmarkWarn: 12000,
  },
  rentSpread: {
    key: 'rentSpread',
    label: 'Rent Spread',
    format: 'percent',
    color: 'text-purple-600 dark:text-purple-400',
    tooltip: 'Spread between new lease rates and expiring lease rates',
    compute: (m) => m.rentSpread ?? null,
    benchmarkGood: 10,
    benchmarkWarn: 3,
  },
  turnoverRate: {
    key: 'turnoverRate',
    label: 'Turnover Rate',
    format: 'percent',
    color: 'text-pink-500 dark:text-pink-300',
    tooltip: 'Percentage of units turned over per year',
    compute: (m) => m.turnoverRate ?? null,
    benchmarkGood: 40,
    benchmarkWarn: 60,
    benchmarkInvert: true,
  },
  // ─── Retail / Office-specific ─────────────────────────────────────────
  walt: {
    key: 'walt',
    label: 'WALT',
    format: 'number',
    color: 'text-amber-700 dark:text-amber-300',
    tooltip: 'Weighted Average Lease Term remaining (years)',
    compute: (m) => m.walt ?? null,
    benchmarkGood: 7,
    benchmarkWarn: 3,
  },
  anchorTenantPct: {
    key: 'anchorTenantPct',
    label: 'Anchor %',
    format: 'percent',
    color: 'text-yellow-700 dark:text-yellow-300',
    tooltip: 'Percentage of gross leasable area occupied by anchor tenants',
    compute: (m) => m.anchorTenantPct ?? null,
    benchmarkGood: 50,
    benchmarkWarn: 25,
  },
  nearTermExpiryPct: {
    key: 'nearTermExpiryPct',
    label: 'Near-Term Expiry',
    format: 'percent',
    color: 'text-red-500 dark:text-red-400',
    tooltip: 'Percentage of leases expiring within 12 months',
    compute: (m) => m.nearTermExpiryPct ?? null,
    benchmarkGood: 10,
    benchmarkWarn: 25,
    benchmarkInvert: true,
  },
  // ─── Industrial-specific ──────────────────────────────────────────────
  clearHeight: {
    key: 'clearHeight',
    label: 'Clear Height',
    format: 'number',
    color: 'text-slate-600 dark:text-slate-400',
    tooltip: 'Average clear height of the industrial facility (feet)',
    compute: (m) => m.clearHeight ?? null,
    benchmarkGood: 32,
    benchmarkWarn: 24,
  },
  dockDoorCount: {
    key: 'dockDoorCount',
    label: 'Dock Doors',
    format: 'number',
    color: 'text-stone-600 dark:text-stone-400',
    tooltip: 'Number of dock-high loading doors',
    compute: (m) => m.dockDoorCount ?? null,
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
  marina:       ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr', 'opexRatio', 'revenuePerSlip', 'slipOccupancy'],
  multifamily:  ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr', 'opexRatio', 'revPerUnit', 'rentSpread', 'turnoverRate'],
  hotel:        ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr', 'opexRatio', 'adr', 'revpar', 'fbRevenuePct'],
  str:          ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'noiCagr', 'opexRatio', 'avgDailyRate', 'strOccupancy'],
  rv_park:      ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr', 'opexRatio', 'physicalOccupancy'],
  retail:       ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'dscr', 'ltv', 'opexRatio', 'walt', 'anchorTenantPct', 'nearTermExpiryPct'],
  office:       ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'dscr', 'ltv', 'opexRatio', 'walt', 'anchorTenantPct', 'nearTermExpiryPct'],
  industrial:   ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'dscr', 'ltv', 'opexRatio', 'walt', 'clearHeight', 'dockDoorCount'],
  self_storage: ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'noiCagr', 'dscr', 'ltv', 'opexRatio', 'physicalOccupancy', 'ratePerSf'],
  mixed_use:    ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'dscr', 'opexRatio'],
  business:     ['irr', 'equityMultiple', 'cashOnCash', 'totalReturn', 'exitValue', 'stabilizedNoi', 'noiCagr', 'opexRatio'],
  default:      ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'stabilizedNoi', 'exitValue'],
};

export function getKpisForAssetClass(assetClass?: string | null): ModelingKpiDef[] {
  const normalized = (assetClass?.toLowerCase().replace(/[-\s]/g, '_') || 'default') as ModelingAssetClass;
  const keys = ASSET_CLASS_KPI_SETS[normalized] ?? ASSET_CLASS_KPI_SETS.default;
  return keys.map((k) => MODELING_KPI_REGISTRY[k]).filter(Boolean);
}
