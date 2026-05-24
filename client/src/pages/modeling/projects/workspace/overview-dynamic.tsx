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
import { Skeleton } from '@/components/ui/skeleton';
import { useModelConfig, useTerms } from '@/hooks/use-model-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewDynamicProps {
  onTabChange?: (tab: string) => void;
  project: any;
  pricingData?: any;
  financials?: any;
  /**
   * Mode-switch flicker fix (2026-05-24): when true, KPI cards render a
   * value-line skeleton instead of the formatted number. Gated upstream
   * on the /pro-forma query's isFetching (the single mode-varying KPI
   * source). Card label / frame / tooltip remain — only the value line
   * shimmers, so the grid stays layout-stable during refetch.
   */
  loading?: boolean;
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
  //
  // 2026-05-24 Overview Gap A + Gap C fix: financials.* is now populated from
  // the PF engine's metrics.* sub-object (see workspace.tsx financials extractor).
  // For every KPI below, financials wins when present; pricing-blob fallbacks
  // remain for empty-state and not-yet-computed cases.
  //
  // Gap C specifically: capRate now sources from financials.capRate (engine-
  // computed NOI₀ ÷ purchasePrice via metrics.goingInCapRate) before falling
  // back to pricing.goingInCapRate (the user-typed target). When PF returns
  // zero NOI (empty project), financials.capRate is undefined and the typed
  // fallback still displays as a sensible empty-state target.
  const pricingMap: Record<string, any> = {
    noi: financials?.noi ?? pricing.noi,
    capRate: financials?.capRate ?? pricing.capRate ?? pricing.goingInCapRate,
    cashOnCash: financials?.cashOnCash ?? pricing.cashOnCashReturn ?? pricing.cashOnCash,
    dscr: financials?.dscr ?? pricing.dscr ?? pricing.debtServiceCoverageRatio,
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
    occupancy: financials?.occupancy ?? customMetrics?.occupancy ?? customMetrics?.inputAssumptions?.occupancy,
    adr: financials?.adr ?? customMetrics?.adr ?? customMetrics?.inputAssumptions?.averageDailyRate ?? customMetrics?.inputAssumptions?.nightlyRate,
    revpar: financials?.revPAR ?? pricing.revPAR ?? pricing.revpar,
    effectiveGrossIncome: financials?.totalRevenue ?? pricing.effectiveGrossIncome,
    debtYield: financials?.debtYield ?? pricing.debtYield,
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

export function OverviewDynamic({ project, pricingData, financials, loading, onTabChange }: OverviewDynamicProps) {
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-2">
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-6 pb-2">
        {kpiValues.map((kpi) => (
          <KPICard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            format={kpi.format}
            description={kpi.description}
            loading={loading}
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
  loading,
}: {
  label: string;
  value: number | null;
  format: string;
  description?: string;
  loading?: boolean;
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
      <CardContent className="p-5 pb-6">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs text-muted-foreground leading-tight tracking-wide">{label}</span>
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
        {loading ? (
          // Value-skeleton — h-8 matches the text-2xl line height so the card
          // doesn't shift size during refetch. data-testid for the wiring gate.
          <Skeleton className="h-8 w-24" data-testid="kpi-skeleton" />
        ) : (
          <div className={`text-2xl font-bold tabular-nums ${value === null ? 'text-muted-foreground/40' : healthColor}`}>
            {formatKPIValue(value, format)}
          </div>
        )}
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
