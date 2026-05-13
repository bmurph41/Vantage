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
  noiPerSlip?: number;
  slipOccupancy?: number;
  fuelRevenuePct?: number;
  serviceRevenuePct?: number;
  // Hotel-specific
  adr?: number;
  revpar?: number;
  hotelOccupancy?: number;
  fbRevenuePct?: number;
  // Multifamily-specific
  unitCount?: number;
  revPerUnit?: number;
  rentSpread?: number;
  turnoverRate?: number;
  // Self-storage-specific
  physicalOccupancy?: number;
  ratePerSf?: number;
  climateControlledPct?: number;
  ecriUpside?: number;
  // STR-specific
  avgDailyRate?: number;
  strOccupancy?: number;
  revpan?: number;
  cleaningFeePct?: number;
  // RV Park-specific
  rvSiteOccupancy?: number;
  siteRentPct?: number;
  storeRevenuePct?: number;
  cabinRevenuePct?: number;
  // Universal operational — generic fields populated by engine for any asset class
  noiMargin?: number;
  occupancyRate?: number;
  // Retail / Office-specific
  walt?: number;
  anchorTenantPct?: number;
  nearTermExpiryPct?: number;
  pricePerSf?: number;
  // Industrial-specific
  clearHeight?: number;
  dockDoorCount?: number;
  // Hotel additional
  roomsRevPct?: number;
  // Balance sheet fields (populated from uploaded financial statements or derived)
  currentAssets?: number;
  currentLiabilities?: number;
  inventory?: number;
  totalLiabilities?: number;
  netWorth?: number;
  cogs?: number;
  [key: string]: number | undefined;
}

export interface KpiAnnualRow {
  year?: number;
  noi?: number;
  revenue?: number;
  expenses?: number;
  debtService?: number;
  leveredCashFlow?: number;
  // Operational fields populated by asset-class engine when available
  occupancyRate?: number;
  noiMargin?: number;
  revenuePerSlip?: number;
  noiPerSlip?: number;
  slipOccupancy?: number;
  adr?: number;
  revpar?: number;
  physicalOccupancy?: number;
  ratePerSf?: number;
  avgDailyRate?: number;
  strOccupancy?: number;
  revpan?: number;
  revPerUnit?: number;
  siteRentPct?: number;
  cogs?: number;
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
  /** When true, benchmark direction is inverted: lower is better (e.g. LTV, OpEx). */
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
    computeByYear: (row) => {
      if (!row.debtService || row.debtService <= 0) return null;
      return (row.noi ?? 0) / row.debtService;
    },
    benchmarkGood: 1.5,
    benchmarkWarn: 1.25,
  },
  noiMargin: {
    key: 'noiMargin',
    label: 'NOI Margin',
    format: 'percent',
    color: 'text-green-600 dark:text-green-400',
    tooltip: 'Net Operating Income as a percentage of revenue',
    compute: (m, rows) => {
      if (m.noiMargin != null) return m.noiMargin;
      if (!rows?.length) return null;
      const row = rows[0];
      if (!row?.revenue || row.revenue <= 0) return null;
      return ((row.noi ?? 0) / row.revenue) * 100;
    },
    computeByYear: (row) => {
      if (!row.revenue || row.revenue <= 0) return null;
      return ((row.noi ?? 0) / row.revenue) * 100;
    },
    benchmarkGood: 40,
    benchmarkWarn: 25,
  },
  occupancyRate: {
    key: 'occupancyRate',
    label: 'Occupancy',
    format: 'percent',
    color: 'text-blue-600 dark:text-blue-400',
    tooltip: 'Physical or economic occupancy rate',
    compute: (m) => m.occupancyRate ?? null,
    computeByYear: (row) => row.occupancyRate ?? null,
    benchmarkGood: 90,
    benchmarkWarn: 80,
  },
  roomsRevPct: {
    key: 'roomsRevPct',
    label: 'Rooms Rev %',
    format: 'percent',
    color: 'text-fuchsia-700 dark:text-fuchsia-300',
    tooltip: 'Rooms revenue as a percentage of total hotel revenue',
    compute: (m) => m.roomsRevPct ?? null,
    benchmarkGood: 65,
    benchmarkWarn: 50,
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
  noiPerSlip: {
    key: 'noiPerSlip',
    label: 'NOI / Slip',
    format: 'currency',
    color: 'text-teal-700 dark:text-teal-300',
    tooltip: 'Annual NOI per slip',
    compute: (m, rows) => {
      if (m.noiPerSlip != null) return m.noiPerSlip;
      if (m.totalSlips && m.totalSlips > 0 && rows?.length) {
        return (rows[0]?.noi ?? 0) / m.totalSlips;
      }
      return null;
    },
    computeByYear: (row, m) => {
      if (row.noiPerSlip != null) return row.noiPerSlip;
      if (m.totalSlips && m.totalSlips > 0 && row.noi != null) {
        return row.noi / m.totalSlips;
      }
      return null;
    },
    benchmarkGood: 2500,
    benchmarkWarn: 1500,
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
  fuelRevenuePct: {
    key: 'fuelRevenuePct',
    label: 'Fuel Rev %',
    format: 'percent',
    color: 'text-yellow-700 dark:text-yellow-300',
    tooltip: 'Fuel sales as a percentage of total marina revenue',
    compute: (m) => m.fuelRevenuePct ?? null,
    benchmarkGood: 20,
    benchmarkWarn: 10,
  },
  serviceRevenuePct: {
    key: 'serviceRevenuePct',
    label: 'Service Rev %',
    format: 'percent',
    color: 'text-orange-700 dark:text-orange-300',
    tooltip: 'Service & repair revenue as a percentage of total marina revenue',
    compute: (m) => m.serviceRevenuePct ?? null,
    benchmarkGood: 15,
    benchmarkWarn: 8,
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
  climateControlledPct: {
    key: 'climateControlledPct',
    label: 'CC Unit %',
    format: 'percent',
    color: 'text-sky-700 dark:text-sky-300',
    tooltip: 'Percentage of units that are climate-controlled',
    compute: (m) => m.climateControlledPct ?? null,
    benchmarkGood: 50,
    benchmarkWarn: 25,
  },
  ecriUpside: {
    key: 'ecriUpside',
    label: 'ECRI Upside',
    format: 'percent',
    color: 'text-emerald-700 dark:text-emerald-300',
    tooltip: 'Existing Customer Rate Increase upside vs current street rates',
    compute: (m) => m.ecriUpside ?? null,
    benchmarkGood: 15,
    benchmarkWarn: 5,
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
  revpan: {
    key: 'revpan',
    label: 'RevPAN',
    format: 'currency',
    color: 'text-red-600 dark:text-red-400',
    tooltip: 'Revenue Per Available Night',
    compute: (m) => m.revpan ?? null,
    computeByYear: (row) => row.revpan ?? null,
    benchmarkGood: 200,
    benchmarkWarn: 120,
  },
  cleaningFeePct: {
    key: 'cleaningFeePct',
    label: 'Cleaning Fee %',
    format: 'percent',
    color: 'text-stone-600 dark:text-stone-400',
    tooltip: 'Cleaning fee revenue as a percentage of total STR revenue',
    compute: (m) => m.cleaningFeePct ?? null,
    benchmarkGood: 15,
    benchmarkWarn: 8,
  },
  // ─── RV Park-specific ─────────────────────────────────────────────────
  siteRentPct: {
    key: 'siteRentPct',
    label: 'Site Rent %',
    format: 'percent',
    color: 'text-green-700 dark:text-green-300',
    tooltip: 'Site rental revenue as a percentage of total RV park revenue',
    compute: (m) => m.siteRentPct ?? null,
    computeByYear: (row) => row.siteRentPct ?? null,
    benchmarkGood: 65,
    benchmarkWarn: 50,
  },
  storeRevenuePct: {
    key: 'storeRevenuePct',
    label: 'Store Rev %',
    format: 'percent',
    color: 'text-lime-600 dark:text-lime-400',
    tooltip: 'Store / retail revenue as a percentage of total revenue',
    compute: (m) => m.storeRevenuePct ?? null,
    benchmarkGood: 20,
    benchmarkWarn: 8,
  },
  cabinRevenuePct: {
    key: 'cabinRevenuePct',
    label: 'Cabin Rev %',
    format: 'percent',
    color: 'text-amber-600 dark:text-amber-400',
    tooltip: 'Cabin / lodging revenue as a percentage of total RV park revenue',
    compute: (m) => m.cabinRevenuePct ?? null,
    benchmarkGood: 25,
    benchmarkWarn: 10,
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
  pricePerSf: {
    key: 'pricePerSf',
    label: 'Price / SF',
    format: 'currency',
    color: 'text-slate-700 dark:text-slate-300',
    tooltip: 'Purchase price per square foot of gross leasable area',
    compute: (m) => m.pricePerSf ?? null,
    benchmarkGood: 300,
    benchmarkWarn: 150,
  },
  // ─── Balance sheet ratios ─────────────────────────────────────────────
  currentRatio: {
    key: 'currentRatio',
    label: 'Current Ratio',
    format: 'number',
    color: 'text-sky-600 dark:text-sky-400',
    tooltip: 'Current Assets ÷ Current Liabilities — measures short-term solvency; sourced from balance sheet uploads',
    compute: (m) => {
      if (m.currentAssets == null || !m.currentLiabilities || m.currentLiabilities <= 0) return null;
      return m.currentAssets / m.currentLiabilities;
    },
    benchmarkGood: 2.0,
    benchmarkWarn: 1.0,
  },
  quickRatio: {
    key: 'quickRatio',
    label: 'Quick Ratio',
    format: 'number',
    color: 'text-teal-600 dark:text-teal-400',
    tooltip: '(Current Assets − Inventory) ÷ Current Liabilities — excludes less-liquid inventory; sourced from balance sheet uploads',
    compute: (m) => {
      if (m.currentAssets == null || !m.currentLiabilities || m.currentLiabilities <= 0) return null;
      return (m.currentAssets - (m.inventory ?? 0)) / m.currentLiabilities;
    },
    benchmarkGood: 1.0,
    benchmarkWarn: 0.5,
  },
  inventoryTurnover: {
    key: 'inventoryTurnover',
    label: 'Inventory Turns',
    format: 'number',
    color: 'text-amber-600 dark:text-amber-400',
    tooltip: 'COGS ÷ Inventory — how many times inventory cycles per year; higher is more efficient',
    compute: (m, rows) => {
      if (!m.inventory || m.inventory <= 0) return null;
      const cogs = m.cogs ?? rows?.[0]?.cogs;
      if (!cogs) return null;
      return cogs / m.inventory;
    },
    computeByYear: (row, m) => {
      if (!m.inventory || m.inventory <= 0) return null;
      if (!row.cogs) return null;
      return row.cogs / m.inventory;
    },
    benchmarkGood: 6,
    benchmarkWarn: 3,
  },
  debtToWorth: {
    key: 'debtToWorth',
    label: 'Debt-to-Worth',
    format: 'number',
    color: 'text-red-500 dark:text-red-400',
    tooltip: 'Total Debt ÷ Net Worth — leverage at acquisition; derived from LTV when balance sheet data is unavailable',
    compute: (m) => {
      if (m.totalLiabilities != null && m.netWorth != null && m.netWorth > 0) {
        return m.totalLiabilities / m.netWorth;
      }
      if (m.ltv != null && m.ltv > 0 && m.ltv < 100) {
        return m.ltv / (100 - m.ltv);
      }
      if (m.purchasePrice && m.equityInvested && m.equityInvested > 0) {
        const debt = m.purchasePrice - m.equityInvested;
        return debt > 0 ? debt / m.equityInvested : 0;
      }
      return null;
    },
    benchmarkGood: 1.0,
    benchmarkWarn: 2.0,
    benchmarkInvert: true,
  },
  netProfitToOwnerCapital: {
    key: 'netProfitToOwnerCapital',
    label: 'NP / Owner Capital',
    format: 'percent',
    color: 'text-emerald-700 dark:text-emerald-300',
    tooltip: 'Net Operating Income ÷ Owner\'s Capital — return on equity invested; Year 1 → Stabilized',
    compute: (m, rows) => {
      const capital = m.equityInvested && m.equityInvested > 0
        ? m.equityInvested
        : (m.purchasePrice && m.ltv != null ? m.purchasePrice * (1 - m.ltv / 100) : null);
      if (!capital || capital <= 0) return null;
      const noi = rows?.[0]?.noi ?? m.year1Noi;
      if (noi == null) return null;
      return (noi / capital) * 100;
    },
    computeByYear: (row, m) => {
      const capital = m.equityInvested && m.equityInvested > 0
        ? m.equityInvested
        : (m.purchasePrice && m.ltv != null ? m.purchasePrice * (1 - m.ltv / 100) : null);
      if (!capital || capital <= 0) return null;
      if (row.noi == null) return null;
      return (row.noi / capital) * 100;
    },
    benchmarkGood: 12,
    benchmarkWarn: 7,
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
  marina:       ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'revenuePerSlip', 'noiPerSlip', 'slipOccupancy', 'fuelRevenuePct', 'serviceRevenuePct', 'debtToWorth', 'netProfitToOwnerCapital', 'currentRatio', 'quickRatio', 'inventoryTurnover'],
  multifamily:  ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'occupancyRate', 'revPerUnit', 'rentSpread', 'turnoverRate', 'debtToWorth', 'netProfitToOwnerCapital'],
  hotel:        ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'occupancyRate', 'adr', 'revpar', 'roomsRevPct', 'fbRevenuePct', 'debtToWorth', 'netProfitToOwnerCapital'],
  str:          ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'noiCagr', 'avgDailyRate', 'strOccupancy', 'revpan', 'cleaningFeePct', 'debtToWorth', 'netProfitToOwnerCapital'],
  rv_park:      ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'siteRentPct', 'storeRevenuePct', 'cabinRevenuePct', 'debtToWorth', 'netProfitToOwnerCapital', 'currentRatio', 'quickRatio', 'inventoryTurnover'],
  retail:       ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'ltv', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'occupancyRate', 'walt', 'anchorTenantPct', 'nearTermExpiryPct', 'pricePerSf', 'debtToWorth', 'netProfitToOwnerCapital'],
  office:       ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'ltv', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'occupancyRate', 'walt', 'anchorTenantPct', 'nearTermExpiryPct', 'pricePerSf', 'debtToWorth', 'netProfitToOwnerCapital'],
  industrial:   ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'ltv', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'walt', 'pricePerSf', 'clearHeight', 'dockDoorCount', 'debtToWorth', 'netProfitToOwnerCapital'],
  self_storage: ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'ltv', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'noiCagr', 'physicalOccupancy', 'ratePerSf', 'climateControlledPct', 'ecriUpside', 'debtToWorth', 'netProfitToOwnerCapital'],
  mixed_use:    ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'noiCagr', 'debtToWorth', 'netProfitToOwnerCapital'],
  business:     ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'exitCapRate', 'noiMargin', 'dscr', 'opexRatio', 'totalReturn', 'exitValue', 'stabilizedNoi', 'noiCagr', 'debtToWorth', 'netProfitToOwnerCapital', 'currentRatio', 'quickRatio', 'inventoryTurnover'],
  default:      ['irr', 'equityMultiple', 'cashOnCash', 'goingInCapRate', 'noiMargin', 'dscr', 'opexRatio', 'exitCapRate', 'stabilizedNoi', 'exitValue', 'debtToWorth', 'netProfitToOwnerCapital'],
};

export function getKpisForAssetClass(assetClass?: string | null): ModelingKpiDef[] {
  const normalized = (assetClass?.toLowerCase().replace(/[-\s]/g, '_') || 'default') as ModelingAssetClass;
  const keys = ASSET_CLASS_KPI_SETS[normalized] ?? ASSET_CLASS_KPI_SETS.default;
  return keys.map((k) => MODELING_KPI_REGISTRY[k]).filter(Boolean);
}
