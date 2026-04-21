import { formatCurrency, formatPercent } from '@/lib/utils';
// =============================================================================
// CONFIG-DRIVEN OVERVIEW KPI CARDS
// File: client/src/pages/modeling/projects/workspace/overview-dynamic.tsx
//
// Replaces marina-specific KPI cards with dynamic cards driven by
// asset-class-model-config.ts. Each asset class defines its own KPI list
// in config.kpis.
// =============================================================================

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Info, Building2 } from 'lucide-react';
import { useModelConfig, useTerms } from '@/hooks/use-model-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewDynamicProps {
  onTabChange?: (tab: string) => void;
  project: any;
  pricingData?: any;
  financials?: any;
}

interface KPIConfig {
  key: string;
  label: string;
  format: 'currency' | 'percent' | 'number' | 'ratio' | 'multiplier';
  description?: string;
}

// ---------------------------------------------------------------------------
// KPI value extraction — maps config keys to actual project/pricing data
// ---------------------------------------------------------------------------

function extractKPIValue(
  key: string,
  project: any,
  pricingData: any,
  financials: any,
): number | null {
  const customMetrics = project?.customMetrics ?? {};
  const pricing = pricingData ?? {};

  // Direct pricing data
  const pricingMap: Record<string, any> = {
    noi: financials?.noi ?? pricing.noi,
    capRate: pricing.capRate ?? pricing.goingInCapRate,
    cashOnCash: financials?.cashOnCash ?? pricing.cashOnCashReturn ?? pricing.cashOnCash,
    dscr: pricing.dscr ?? pricing.debtServiceCoverageRatio,
    irr: financials?.irr ?? pricing.irr ?? pricing.internalRateOfReturn,
    leveredIrr: financials?.irr ?? pricing.leveredIrr ?? pricing.irr,
    equityMultiple: financials?.equityMultiple ?? pricing.equityMultiple,
    totalRevenue: financials?.totalRevenue ?? pricing.totalRevenue,
    totalExpenses: financials?.totalExpenses ?? pricing.totalExpenses,
    grm: pricing.grm ?? pricing.grossRentMultiplier,
    pricePerUnit: pricing.pricePerUnit,
    pricePerSF: pricing.pricePerSF ?? pricing.pricePerSquareFoot,
    pricePerSlip: pricing.pricePerSlip,
    pricePerRoom: pricing.pricePerRoom ?? pricing.pricePerKey,
    pricePerDoor: pricing.pricePerDoor ?? pricing.pricePerUnit,
    occupancy: customMetrics?.occupancy ?? customMetrics?.inputAssumptions?.occupancy,
    adr: customMetrics?.adr ?? customMetrics?.inputAssumptions?.averageDailyRate ?? customMetrics?.inputAssumptions?.nightlyRate,
    revpar: pricing.revPAR ?? pricing.revpar,
    effectiveGrossIncome: financials?.totalRevenue ?? pricing.effectiveGrossIncome,
    debtYield: pricing.debtYield,
    breakEvenOccupancy: pricing.breakEvenOccupancy,
    operatingExpenseRatio: financials ? (financials.totalExpenses / Math.max(1, financials.totalRevenue)) : pricing.operatingExpenseRatio,
    noiMargin: financials?.noiMargin ?? (financials && financials.totalRevenue > 0 ? (financials.noi / financials.totalRevenue) : pricing.noiMargin),
    sde: pricing.sde ?? pricing.sellersDiscretionaryEarnings,
    ebitda: pricing.ebitda,
    ebitdaMultiple: pricing.ebitdaMultiple,
  };

  const val = pricingMap[key];
  if (val === undefined || val === null) return null;
  return typeof val === 'number' ? val : parseFloat(val);
}

// ---------------------------------------------------------------------------
// Format KPI value for display
// ---------------------------------------------------------------------------

function formatKPIValue(value: number | null, format: string): string {
  if (value === null || isNaN(value)) return '—';
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value * 100);
    case 'ratio':
      return `${value.toFixed(2)}x`;
    case 'multiplier':
      return `${value.toFixed(1)}x`;
    case 'number':
      return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverviewDynamic({ project, pricingData, financials, onTabChange }: OverviewDynamicProps) {
  const config = useModelConfig(project);
  const terms = useTerms(project);

  const kpis: KPIConfig[] = useMemo(() => {
    return config.kpis ?? [
      { key: 'noi', label: 'NOI', format: 'currency' },
      { key: 'capRate', label: 'Cap Rate', format: 'percent' },
      { key: 'cashOnCash', label: 'Cash-on-Cash', format: 'percent' },
      { key: 'dscr', label: 'DSCR', format: 'ratio' },
    ];
  }, [config]);

  const kpiValues = useMemo(() => {
    return kpis.map((kpi) => ({
      ...kpi,
      value: extractKPIValue(kpi.key, project, pricingData, financials),
    }));
  }, [kpis, project, pricingData, financials]);

  const hasAnyValue = kpiValues.some((k) => k.value !== null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Key Metrics
          </h3>
          <Badge variant="outline" className="text-xs">
            {config.label}
          </Badge>
          {!hasAnyValue && (
            <span className="text-xs text-muted-foreground italic">
              Enter assumptions or upload a P&amp;L to populate
            </span>
          )}
        </div>
      </div>

      {/* KPI Grid — always rendered; null values show "—" */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 px-6">
        {kpiValues.map((kpi) => (
          <KPICard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            format={kpi.format}
            description={kpi.description}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KPICard({
  label,
  value,
  format,
  description,
}: {
  label: string;
  value: number | null;
  format: string;
  description?: string;
}) {
  const isGood = value !== null ? getKPIHealth(label, value) : 'neutral';
  const healthColor =
    isGood === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : isGood === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : isGood === 'bad'
          ? 'text-red-500'
          : 'text-foreground';

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs text-muted-foreground leading-tight">{label}</span>
          {description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-48">{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className={`text-xl font-bold tabular-nums ${value === null ? 'text-muted-foreground/40' : healthColor}`}>
          {formatKPIValue(value, format)}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Simple KPI health assessment
// ---------------------------------------------------------------------------

function getKPIHealth(
  label: string,
  value: number,
): 'good' | 'warning' | 'bad' | 'neutral' {
  const key = label.toLowerCase();

  if (key.includes('cap rate')) {
    if (value >= 0.08) return 'good';
    if (value >= 0.05) return 'neutral';
    return 'warning';
  }
  if (key.includes('cash-on-cash') || key.includes('coc')) {
    if (value >= 0.10) return 'good';
    if (value >= 0.06) return 'neutral';
    return 'warning';
  }
  if (key.includes('dscr')) {
    if (value >= 1.25) return 'good';
    if (value >= 1.0) return 'warning';
    return 'bad';
  }
  if (key.includes('noi') || key.includes('revenue')) {
    return value > 0 ? 'good' : 'bad';
  }
  if (key.includes('expense ratio')) {
    if (value <= 0.45) return 'good';
    if (value <= 0.60) return 'warning';
    return 'bad';
  }
  if (key.includes('occupancy')) {
    if (value >= 0.90) return 'good';
    if (value >= 0.75) return 'warning';
    return 'bad';
  }

  return 'neutral';
}

export default OverviewDynamic;
