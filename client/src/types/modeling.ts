export interface ProjectConfig {
  holdPeriod?: number;
  startDate?: string;
  cashFlowGranularity?: string;
  seasonMonths?: number[];
  winterMonths?: number[];
  bottomLineMetric?: 'noi' | 'ebitda';
  departments?: Record<string, { isEnabled?: boolean; label?: string }>;
  projectionStartDate?: string;
  projectionStartRule?: string;
  acquisitionCloseDate?: string;
  storageTypes?: Array<{ id: string; label: string; enabled: boolean }>;
  designatedSpaces?: Array<{ id: string; label: string; enabled: boolean }>;
  profitCenters?: Record<string, { enabled?: boolean; [key: string]: unknown }> | Array<{ id: string; label: string; enabled: boolean }>;
  storageMix?: { items?: Array<{ storageType: string; count: number; [key: string]: unknown }>; hasFuelDock?: boolean };
  [key: string]: unknown;
}

export interface ProjectAssumptions {
  growthRates?: Record<string, number | Record<string, number>>;
  expenseGrowth?: Record<string, number | Record<string, number>>;
  margins?: Record<string, { historical?: number; projected?: number }>;
  yearlyGrowthRates?: Record<string, Record<string, number>>;
  lineItemOverrides?: Record<string, Record<string, number>>;
  belowTheLine?: Record<string, number>;
  exitAssumptions?: Record<string, number>;
  [key: string]: unknown;
}

export interface ProFormaLineItem {
  id: string;
  name: string;
  department?: string;
  bucket?: string;
  historical?: Record<string, number>;
  projected?: Record<string, number>;
  monthly?: Record<string, number>;
  [key: string]: unknown;
}

export interface ProFormaSection {
  lineItems?: ProFormaLineItem[];
  totals?: Record<string, number>;
  totalsMonthly?: Record<string, number>;
}

export interface AnnualProjection {
  year?: number;
  revenue?: number;
  expenses?: number;
  grossProfit?: number;
  noi?: number;
  managementFee?: number;
  capex?: number;
  reserves?: number;
  debtService?: number;
  leveredCashFlow?: number;
  [key: string]: unknown;
}

export interface MonthlyProjection {
  periodKey?: string;
  month?: number;
  year?: number;
  revenue?: number;
  expenses?: number;
  grossProfit?: number;
  noi?: number;
  leveredCashFlow?: number;
  [key: string]: unknown;
}

export interface ProFormaData {
  revenue?: ProFormaSection;
  expenses?: ProFormaSection;
  cogs?: ProFormaSection;
  annualProjections?: AnnualProjection[];
  monthlyProjections?: MonthlyProjection[];
  latestHistoricalYear?: number;
  [key: string]: unknown;
}

export interface ExecutiveSummaryData {
  purchasePrice?: number;
  year1NOI?: number;
  noiByYear?: Record<string, number>;
  cashOnCash?: Record<string, number>;
  irr?: number;
  equityMultiple?: number;
  exitCapRate?: number;
  exitValue?: number;
  year1CapRate?: number;
  exitYear?: number;
  [key: string]: unknown;
}

export interface ProFormaChartData {
  revenueByCategory?: Array<{ name: string; value: number }>;
  expensesByCategory?: Array<{ name: string; value: number }>;
  noiWaterfall?: Array<{ name: string; value: number }>;
  revenueTrend?: Array<{ year: string; value: number }>;
  revenueMix?: Array<{ name: string; value: number }>;
  kpis?: Record<string, number>;
  [key: string]: unknown;
}

export interface ScenarioComparisonScenario {
  id: string;
  name: string;
  irr?: number;
  equityMultiple?: number;
  noi?: number;
  exitValue?: number;
  assumptions?: {
    revenueGrowth?: number;
    expenseGrowth?: number;
    occupancyStart?: number;
    exitCapRate?: number;
    growthRates?: Record<string, number>;
  };
  [key: string]: unknown;
}

export interface ScenarioComparisonData {
  projectId?: string;
  scenarios?: ScenarioComparisonScenario[];
  comparisonMetrics?: Array<{
    metric: string;
    values: Record<string, number>;
  }>;
  [key: string]: unknown;
}

export interface HistoricalPLData {
  lineItems?: ProFormaLineItem[];
  departments?: string[];
  totals?: Record<string, number>;
  [key: string]: unknown;
}

export interface ActualsData {
  lineItems?: Array<{
    id: string;
    name: string;
    department?: string;
    bucket?: string;
    months?: Record<string, number>;
    total?: number;
    [key: string]: unknown;
  }>;
  totals?: Record<string, number>;
  [key: string]: unknown;
}

export interface ScenarioVersionComparison {
  baseVersion?: { id: string; versionNumber: number };
  compareVersion?: { id: string; versionNumber: number };
  changes?: Array<{
    field: string;
    basePath?: string;
    baseValue?: number | string;
    compareValue?: number | string;
  }>;
  [key: string]: unknown;
}
