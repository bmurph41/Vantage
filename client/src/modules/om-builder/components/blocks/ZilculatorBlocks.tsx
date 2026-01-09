import { DollarSign, TrendingUp, Percent, BarChart3, PieChart, Building2, Calendar, CreditCard, Target, Activity, Landmark, Wallet, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

const safeFormatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '$0';
  return formatCurrency(value);
};

const safeFormatPercent = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '0.0%';
  return formatPercent(value);
};

export interface HeroKpiCardProps {
  label?: string;
  value?: string | number;
  subtext?: string;
  variant?: 'teal' | 'green' | 'blue' | 'orange' | 'default';
  icon?: 'dollar' | 'percent' | 'trending' | 'building' | 'calendar' | 'credit' | 'target' | 'activity';
}

const ICON_MAP = {
  dollar: DollarSign,
  percent: Percent,
  trending: TrendingUp,
  building: Building2,
  calendar: Calendar,
  credit: CreditCard,
  target: Target,
  activity: Activity,
};

const VARIANT_STYLES = {
  teal: 'bg-gradient-to-br from-teal-500 to-teal-600 text-white',
  green: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
  blue: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
  orange: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white',
  default: 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-900',
};

export function HeroKpiCard({ label = 'Metric', value = '$0', subtext, variant = 'teal', icon = 'dollar' }: HeroKpiCardProps) {
  const Icon = ICON_MAP[icon] || DollarSign;
  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
  
  return (
    <div className={`rounded-lg p-4 ${variantClass} flex items-center gap-3 shadow-md`}>
      <div className="p-2 rounded-lg bg-white/20">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs font-medium opacity-80">{label}</div>
        <div className="text-xl font-bold">{value}</div>
        {subtext && <div className="text-xs opacity-70">{subtext}</div>}
      </div>
    </div>
  );
}

export interface ExecutiveSummaryProps {
  purchasePrice?: number;
  rent?: number;
  monthlyCashFlow?: number;
  cashOnCash?: number;
  description?: string;
  investmentStrategy?: string;
}

export function ExecutiveSummaryBlock({ 
  purchasePrice = 0, 
  rent = 0, 
  monthlyCashFlow = 0, 
  cashOnCash = 0, 
  description,
  investmentStrategy 
}: ExecutiveSummaryProps) {
  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border">
      <div className="grid grid-cols-4 gap-3">
        <HeroKpiCard label="Purchase Price" value={safeFormatCurrency(purchasePrice)} variant="teal" icon="dollar" />
        <HeroKpiCard label="Rent" value={`${safeFormatCurrency(rent)}/mo`} variant="green" icon="building" />
        <HeroKpiCard label="Monthly Cash Flow" value={safeFormatCurrency(monthlyCashFlow)} variant="blue" icon="trending" />
        <HeroKpiCard label="Cash on Cash Return" value={safeFormatPercent(cashOnCash)} variant="orange" icon="percent" />
      </div>
      
      {(description || investmentStrategy) && (
        <div className="space-y-3">
          {investmentStrategy && (
            <div>
              <div className="text-sm font-semibold text-slate-700">Investment Strategy</div>
              <div className="text-sm text-slate-600">{investmentStrategy}</div>
            </div>
          )}
          {description && (
            <div>
              <div className="text-sm font-semibold text-slate-700">Property Description</div>
              <div className="text-sm text-slate-600 whitespace-pre-line">{description}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface FinancialAnalysisItem {
  label?: string;
  value?: string | number;
  format?: 'currency' | 'percent' | 'number' | 'text';
}

export interface FinancialAnalysisBlockProps {
  title?: string;
  items?: FinancialAnalysisItem[];
  columns?: 1 | 2;
}

export function FinancialAnalysisBlock({ title = 'Financial Analysis', items = [], columns = 2 }: FinancialAnalysisBlockProps) {
  const formatValue = (item: FinancialAnalysisItem) => {
    if (item.value === undefined || item.value === null) return '$0';
    if (typeof item.value === 'string') return item.value;
    switch (item.format) {
      case 'currency': return safeFormatCurrency(item.value);
      case 'percent': return safeFormatPercent(item.value);
      case 'number': return item.value.toLocaleString();
      default: return String(item.value);
    }
  };
  
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-sm font-semibold text-slate-700 border-b pb-2 mb-3">{title}</div>
      <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {items.map((item, index) => (
          <div key={index} className="flex justify-between items-center py-1">
            <span className="text-sm text-slate-600">{item.label || 'Metric'}</span>
            <span className="text-sm font-semibold text-slate-900">{formatValue(item)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface OperatingAnalysisItem {
  label?: string;
  value?: number;
  isExpense?: boolean;
  isTotal?: boolean;
}

export interface OperatingAnalysisBlockProps {
  title?: string;
  goi?: number;
  items?: OperatingAnalysisItem[];
}

export function OperatingAnalysisBlock({ title = 'Operating Analysis', goi = 0, items = [] }: OperatingAnalysisBlockProps) {
  const safeGoi = goi || 0;
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50/50">
            <th className="text-left py-2 px-4 font-medium text-slate-600">Item</th>
            <th className="text-right py-2 px-4 font-medium text-slate-600">Amount</th>
            <th className="text-right py-2 px-4 font-medium text-slate-600">% of GOI</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const itemValue = item.value || 0;
            const percentOfGoi = safeGoi > 0 ? (itemValue / safeGoi) * 100 : 0;
            return (
              <tr 
                key={index} 
                className={`border-b last:border-b-0 ${item.isTotal ? 'bg-slate-100 font-semibold' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
              >
                <td className="py-2 px-4 text-slate-700">{item.label || 'Item'}</td>
                <td className={`py-2 px-4 text-right ${item.isExpense ? 'text-red-600' : 'text-slate-900'}`}>
                  {item.isExpense ? '-' : ''}{safeFormatCurrency(Math.abs(itemValue))}
                </td>
                <td className="py-2 px-4 text-right text-slate-500">
                  {safeFormatPercent(percentOfGoi)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface FinancingOverviewProps {
  loanAmount?: number;
  downPayment?: number;
  ltv?: number;
  interestRate?: number;
  amortizationYears?: number;
  monthlyPayment?: number;
  dcr?: number;
}

export function FinancingOverviewBlock({
  loanAmount = 0,
  downPayment = 0,
  ltv = 0,
  interestRate = 0,
  amortizationYears = 30,
  monthlyPayment = 0,
  dcr = 0,
}: FinancingOverviewProps) {
  const safeDcr = dcr || 0;
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b flex items-center gap-2">
        <Landmark className="w-4 h-4 text-slate-500" />
        <div className="text-sm font-semibold text-slate-700">Financing Overview</div>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Loan Amount</span>
              <span className="text-sm font-semibold">{safeFormatCurrency(loanAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Down Payment</span>
              <span className="text-sm font-semibold">{safeFormatCurrency(downPayment)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">LTV Ratio</span>
              <span className="text-sm font-semibold">{safeFormatPercent(ltv)}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Interest Rate</span>
              <span className="text-sm font-semibold">{safeFormatPercent(interestRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Amortization</span>
              <span className="text-sm font-semibold">{amortizationYears} years</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Monthly Payment</span>
              <span className="text-sm font-semibold">{safeFormatCurrency(monthlyPayment)}</span>
            </div>
          </div>
        </div>
        
        <div className="border-t pt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Debt Coverage Ratio (DCR)</span>
            <span className={`text-sm font-bold ${safeDcr >= 1.25 ? 'text-green-600' : safeDcr >= 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {safeDcr.toFixed(2)}x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface CashFlowForecastRow {
  year?: number;
  goi?: number;
  expenses?: number;
  noi?: number;
  debtService?: number;
  cfbt?: number;
  cfat?: number;
}

export interface CashFlowForecastBlockProps {
  title?: string;
  rows?: CashFlowForecastRow[];
  showCfat?: boolean;
}

export function CashFlowForecastBlock({ title = 'Cash Flow Forecast', rows = [], showCfat = true }: CashFlowForecastBlockProps) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b flex items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-500" />
        <div className="text-sm font-semibold text-slate-700">{title}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left py-2 px-3 font-medium text-slate-600">Year</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600">GOI</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600">Expenses</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600 bg-teal-50">NOI</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600">Debt Service</th>
              <th className="text-right py-2 px-3 font-medium text-slate-600 bg-blue-50">CFBT</th>
              {showCfat && <th className="text-right py-2 px-3 font-medium text-slate-600 bg-green-50">CFAT</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const year = row.year || index + 1;
              const cfbt = row.cfbt || 0;
              const cfat = row.cfat || 0;
              return (
                <tr key={year} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="py-2 px-3 font-medium text-slate-700">Year {year}</td>
                  <td className="py-2 px-3 text-right">{safeFormatCurrency(row.goi)}</td>
                  <td className="py-2 px-3 text-right text-red-600">-{safeFormatCurrency(row.expenses)}</td>
                  <td className="py-2 px-3 text-right font-semibold bg-teal-50/50">{safeFormatCurrency(row.noi)}</td>
                  <td className="py-2 px-3 text-right text-red-600">-{safeFormatCurrency(row.debtService)}</td>
                  <td className={`py-2 px-3 text-right font-semibold bg-blue-50/50 ${cfbt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {safeFormatCurrency(cfbt)}
                  </td>
                  {showCfat && (
                    <td className={`py-2 px-3 text-right font-semibold bg-green-50/50 ${cfat >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {safeFormatCurrency(cfat)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface MarinaKpiProps {
  slipOccupancy?: number;
  revps?: number;
  ancillaryRevenueMix?: number;
  fuelMargin?: number;
  wetSlips?: number;
  dryStorage?: number;
  totalLinearFeet?: number;
}

export function MarinaKpiBlock({
  slipOccupancy = 0,
  revps = 0,
  ancillaryRevenueMix = 0,
  fuelMargin = 0,
  wetSlips = 0,
  dryStorage = 0,
  totalLinearFeet,
}: MarinaKpiProps) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-white" />
        <div className="text-sm font-semibold text-white">Marina Performance Metrics</div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold text-teal-600">{safeFormatPercent(slipOccupancy)}</div>
            <div className="text-xs text-slate-500">Slip Occupancy</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{safeFormatCurrency(revps)}</div>
            <div className="text-xs text-slate-500">REVPS</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{safeFormatPercent(ancillaryRevenueMix)}</div>
            <div className="text-xs text-slate-500">Ancillary Mix</div>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{safeFormatPercent(fuelMargin)}</div>
            <div className="text-xs text-slate-500">Fuel Margin</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-3 border-t">
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Wet Slips</span>
            <span className="text-sm font-semibold">{wetSlips}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-600">Dry Storage</span>
            <span className="text-sm font-semibold">{dryStorage}</span>
          </div>
          {totalLinearFeet !== undefined && totalLinearFeet !== null && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Linear Feet</span>
              <span className="text-sm font-semibold">{totalLinearFeet.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface FinancialBreakdownProps {
  purchasePrice?: number;
  purchaseCosts?: number;
  repairCosts?: number;
  totalCapitalNeeded?: number;
  financing?: number;
  totalCashNeeded?: number;
  cashAtClosing?: number;
  cashDuringRehab?: number;
}

export function FinancialBreakdownBlock({
  purchasePrice = 0,
  purchaseCosts = 0,
  repairCosts = 0,
  totalCapitalNeeded = 0,
  financing = 0,
  totalCashNeeded = 0,
  cashAtClosing = 0,
  cashDuringRehab = 0,
}: FinancialBreakdownProps) {
  const safeCashDuringRehab = cashDuringRehab || 0;
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-slate-50 px-4 py-2 border-b flex items-center gap-2">
        <Wallet className="w-4 h-4 text-slate-500" />
        <div className="text-sm font-semibold text-slate-700">Financial Breakdown</div>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex justify-between py-1">
          <span className="text-sm text-slate-600">Purchase Price</span>
          <span className="text-sm font-semibold">{safeFormatCurrency(purchasePrice)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-sm text-slate-600">Purchase Costs</span>
          <span className="text-sm font-semibold">{safeFormatCurrency(purchaseCosts)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-sm text-slate-600">Repair/Construction Costs</span>
          <span className="text-sm font-semibold">{safeFormatCurrency(repairCosts)}</span>
        </div>
        <div className="flex justify-between py-1 border-t pt-2">
          <span className="text-sm font-semibold text-slate-700">Total Capital Needed</span>
          <span className="text-sm font-bold text-slate-900">{safeFormatCurrency(totalCapitalNeeded)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-sm text-slate-600">Financing</span>
          <span className="text-sm font-semibold text-blue-600">{safeFormatCurrency(financing)}</span>
        </div>
        <div className="flex justify-between py-1 border-t pt-2 bg-teal-50 -mx-4 px-4">
          <span className="text-sm font-semibold text-teal-700">Total Cash Needed</span>
          <span className="text-sm font-bold text-teal-700">{safeFormatCurrency(totalCashNeeded)}</span>
        </div>
        <div className="flex justify-between py-1 pt-2">
          <span className="text-sm text-slate-600">Cash at Closing</span>
          <span className="text-sm font-semibold">{safeFormatCurrency(cashAtClosing)}</span>
        </div>
        {safeCashDuringRehab > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-sm text-slate-600">Cash During Rehab</span>
            <span className="text-sm font-semibold">{safeFormatCurrency(safeCashDuringRehab)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export interface InvestmentReturnRatiosProps {
  cashOnCash?: number;
  roi?: number;
  capRate?: number;
  grossRentalYield?: number;
  grm?: number;
}

export function InvestmentReturnRatiosBlock({
  cashOnCash = 0,
  roi = 0,
  capRate = 0,
  grossRentalYield = 0,
  grm = 0,
}: InvestmentReturnRatiosProps) {
  const safeGrm = grm || 0;
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-white" />
        <div className="text-sm font-semibold text-white">Investment Return Ratios</div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
          <span className="text-sm text-slate-600">Cash on Cash Return</span>
          <span className="text-sm font-bold text-green-600">{safeFormatPercent(cashOnCash)}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
          <span className="text-sm text-slate-600">Return on Investment</span>
          <span className="text-sm font-bold text-green-600">{safeFormatPercent(roi)}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
          <span className="text-sm text-slate-600">Capitalization Rate</span>
          <span className="text-sm font-bold text-blue-600">{safeFormatPercent(capRate)}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
          <span className="text-sm text-slate-600">Gross Rental Yield</span>
          <span className="text-sm font-bold text-blue-600">{safeFormatPercent(grossRentalYield)}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-slate-50 rounded col-span-2">
          <span className="text-sm text-slate-600">Gross Rent Multiplier</span>
          <span className="text-sm font-bold text-slate-900">{safeGrm.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
