import { formatCurrency, formatPercent } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
// =============================================================================
// CONFIG-DRIVEN EXECUTIVE SUMMARY
// File: client/src/pages/modeling/projects/workspace/executive-summary-dynamic.tsx
//
// Replaces marina-hardcoded executive summary with dynamic version.
// Uses config terminology and KPIs per asset class.
// =============================================================================

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, MapPin, DollarSign, TrendingUp, BarChart3, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useModelConfig, useTerms } from '@/hooks/use-model-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExecutiveSummaryDynamicProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
  pricingData?: any;
  financials?: any;
  /**
   * Mode-switch flicker fix (2026-05-24): when true, the Year-1 Operating
   * Performance and Revenue Breakdown values render as skeletons — the
   * only sections sourced from financials (the mode-varying source).
   * Property Overview / Acquisition / Returns are sourced from pricing.*
   * and project, both mode-invariant; they keep showing their stable
   * values to avoid loading-theater on numbers that aren't changing.
   * Same single-source gate as OverviewDynamic — see workspace.tsx.
   */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExecutiveSummaryDynamic({
  projectId,
  onTabChange,
  pricingData,
  financials,
  loading,
}: ExecutiveSummaryDynamicProps) {
  const { data: project } = useQuery<any>({
    queryKey: [`/api/modeling/projects/${projectId}`],
  });
  const config = useModelConfig(project);
  const terms = useTerms(project);

  const summary = useMemo(() => buildSummary(project, config, terms, pricingData, financials), [
    project,
    config,
    terms,
    pricingData,
    financials,
  ]);

  return (
    <div className="space-y-6">
      {/* Property Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <CardTitle className="text-base">Property Overview</CardTitle>
            </div>
            <Badge variant="outline">{config.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {summary.propertyDetails.map((detail, i) => (
              <div key={i}>
                <div className="text-xs text-muted-foreground">{detail.label}</div>
                <div className="text-sm font-medium mt-0.5">{detail.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <CardTitle className="text-base">Financial Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Acquisition */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Acquisition
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {summary.acquisitionMetrics.map((m, i) => (
                  <SummaryMetric key={i} label={m.label} value={m.value} />
                ))}
              </div>
            </div>

            <Separator />

            {/* Operating Performance */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Year 1 Operating Performance
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {summary.operatingMetrics.map((m, i) => (
                  <SummaryMetric key={i} label={m.label} value={m.value} loading={loading} />
                ))}
              </div>
            </div>

            <Separator />

            {/* Returns */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Investment Returns
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {summary.returnMetrics.map((m, i) => (
                  <SummaryMetric key={i} label={m.label} value={m.value} highlight={m.highlight} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Breakdown (asset-class-specific) */}
      {summary.revenueBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <CardTitle className="text-base">{terms.revenue} Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.revenueBreakdown.map((line, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{line.label}</span>
                  {loading ? (
                    <Skeleton className="h-4 w-20" data-testid="es-revenue-skeleton" />
                  ) : (
                    <span className="text-sm font-medium tabular-nums">{line.value}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Build summary data from project + config
// ---------------------------------------------------------------------------

interface SummaryData {
  propertyDetails: { label: string; value: string }[];
  acquisitionMetrics: { label: string; value: string }[];
  operatingMetrics: { label: string; value: string }[];
  returnMetrics: { label: string; value: string; highlight?: boolean }[];
  revenueBreakdown: { label: string; value: string }[];
}

function buildSummary(
  project: any,
  config: any,
  terms: any,
  pricingData: any,
  financials: any,
): SummaryData {
  const cm = project?.customMetrics ?? {};
  const inputs = cm?.inputAssumptions ?? {};
  const pricing = pricingData ?? {};

  const assetClass = project?.assetClass ?? 'marina';
  const fmtCur = (v: any) => {
    const n = Number(v);
    if (!n || isNaN(n)) return '—';
    return formatCurrency(n);
  };
  const fmtPct = (v: any) => {
    const n = Number(v);
    if (!n || isNaN(n)) return '—';
    return formatPercent(n * 100);
  };

  // Property Details — adapt per asset class
  const propertyDetails: { label: string; value: string }[] = [
    { label: 'Property Name', value: project?.name ?? '—' },
    { label: 'Asset Class', value: config.label },
    { label: 'Location', value: project?.address ?? project?.location ?? '—' },
  ];

  // Asset-class-specific details
  const detailsByClass: Record<string, { label: string; value: string }[]> = {
    marina: [
      { label: 'Wet Slips', value: String(inputs.wetSlips ?? cm.totalSlips ?? '—') },
      { label: 'Dry Storage', value: String(inputs.dryStorageSpaces ?? '—') },
    ],
    multifamily: [
      { label: 'Total Units', value: String(inputs.totalUnits ?? cm.totalUnits ?? '—') },
      { label: 'Avg Rent/Unit', value: fmtCur(inputs.averageRent ?? cm.averageRent) },
    ],
    hotel: [
      { label: 'Rooms', value: String(inputs.numberOfRooms ?? cm.rooms ?? '—') },
      { label: 'ADR', value: fmtCur(inputs.averageDailyRate ?? cm.adr) },
    ],
    str: [
      { label: 'Bedrooms', value: String(inputs.bedrooms ?? '—') },
      { label: 'Nightly Rate', value: fmtCur(inputs.nightlyRate ?? inputs.averageDailyRate) },
    ],
    sfr: [
      { label: 'Bedrooms', value: String(inputs.bedrooms ?? '—') },
      { label: 'Monthly Rent', value: fmtCur(inputs.monthlyRent) },
    ],
    duplex: [{ label: 'Units', value: '2' }],
    triplex: [{ label: 'Units', value: '3' }],
    quad: [{ label: 'Units', value: '4' }],
    self_storage: [
      { label: 'Total Units', value: String(inputs.totalUnits ?? '—') },
      { label: 'Avg Rate/Unit', value: fmtCur(inputs.averageMonthlyRate) },
    ],
    laundromat: [
      { label: 'Washers', value: String(inputs.numberOfWashers ?? '—') },
      { label: 'Dryers', value: String(inputs.numberOfDryers ?? '—') },
    ],
    retail: [{ label: 'Square Feet', value: String(inputs.totalSquareFeet ?? cm.squareFeet ?? '—') }],
    office: [{ label: 'Square Feet', value: String(inputs.totalSquareFeet ?? cm.squareFeet ?? '—') }],
    industrial: [{ label: 'Square Feet', value: String(inputs.totalSquareFeet ?? cm.squareFeet ?? '—') }],
    medical_office: [{ label: 'Square Feet', value: String(inputs.totalSquareFeet ?? '—') }],
    business: [{ label: 'Annual Revenue', value: fmtCur(inputs.annualRevenue ?? cm.annualRevenue) }],
  };

  propertyDetails.push(...(detailsByClass[assetClass] ?? []));

  // Acquisition
  const acquisitionMetrics = [
    { label: 'Purchase Price', value: fmtCur(project?.askingPrice ?? project?.purchasePrice ?? inputs.purchasePrice) },
    { label: 'Closing Costs', value: fmtCur(pricing.closingCosts) },
    { label: 'Total Acquisition', value: fmtCur(pricing.totalAcquisitionCost ?? pricing.allInCost) },
    { label: 'Down Payment', value: fmtCur(pricing.downPayment ?? pricing.equityRequired) },
    { label: 'Loan Amount', value: fmtCur(pricing.loanAmount) },
  ].filter(m => m.value !== '—');

  // Operating Performance
  const totalRevenue = financials?.totalRevenue ?? pricing.totalRevenue ?? 0;
  const totalExpenses = financials?.totalExpenses ?? pricing.totalExpenses ?? 0;
  const noi = financials?.noi ?? pricing.noi ?? totalRevenue - totalExpenses;

  const operatingMetrics = [
    { label: `Total ${terms.revenue}`, value: fmtCur(totalRevenue) },
    { label: `Total ${terms.expenses}`, value: fmtCur(totalExpenses) },
    { label: terms.noi || 'NOI', value: fmtCur(noi) },
    { label: 'Debt Service', value: fmtCur(pricing.annualDebtService) },
    { label: 'Cash Flow (BTCF)', value: fmtCur(pricing.beforeTaxCashFlow ?? noi - (pricing.annualDebtService ?? 0)) },
  ].filter(m => m.value !== '—');

  // Returns
  //
  // 2026-05-24 ES Gap A parallel: Returns row now precedences financials?.*
  // (PF-computed metrics from workspace.tsx, already decimal-form) ahead of
  // pricing.* (user-typed targets). Mirrors Overview's extractKPIValue
  // pattern. The 3 PF computes — IRR, Equity Multiple, Cap Rate — get the
  // upgrade. Cash-on-Cash and GRM stay pricing.*-only because /pro-forma
  // doesn't emit them. DSCR's inline truthiness check (filed separately as
  // Finding C convention inconsistency) is intentionally left alone here.
  //
  // Gap B (fallback unit fix): pricing.goingInCapRate is stored in DB as
  // PERCENTAGE form (e.g. 9.37 / 7.5 — verified against the 2 fallback-
  // cohort projects). fmtPct does formatPercent(n*100), expecting DECIMAL
  // form. pricingPctToDecimal applies ONLY to the goingInCapRate fallback
  // branch — financials.capRate is already decimal, pricing.capRate is
  // undefined across the cohort today.
  const pricingPctToDecimal = (v: any) => (v != null ? Number(v) / 100 : undefined);
  const returnMetrics = [
    {
      label: 'Cap Rate',
      value: fmtPct(financials?.capRate ?? pricing.capRate ?? pricingPctToDecimal(pricing.goingInCapRate)),
      highlight: true,
    },
    { label: 'Cash-on-Cash', value: fmtPct(pricing.cashOnCashReturn ?? pricing.cashOnCash), highlight: true },
    { label: 'DSCR', value: pricing.dscr ? `${Number(pricing.dscr).toFixed(2)}x` : '—' },
    { label: 'IRR', value: fmtPct(financials?.irr ?? pricing.irr) },
    {
      label: 'Equity Multiple',
      value:
        financials?.equityMultiple != null
          ? `${Number(financials.equityMultiple).toFixed(2)}x`
          : pricing.equityMultiple
            ? `${Number(pricing.equityMultiple).toFixed(2)}x`
            : '—',
    },
    { label: 'GRM', value: pricing.grm ? `${Number(pricing.grm).toFixed(1)}` : '—' },
  ].filter(m => m.value !== '—');

  // Revenue Breakdown from computed lines
  const revenueBreakdown = (financials?.revenueLines ?? [])
    .filter((l: any) => l.amount !== 0)
    .map((l: any) => ({
      label: l.label,
      value: l.amount < 0
        ? `(${fmtCur(Math.abs(l.amount)).replace('$', '')})`
        : fmtCur(l.amount),
    }));

  return { propertyDetails, acquisitionMetrics, operatingMetrics, returnMetrics, revenueBreakdown };
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function SummaryMetric({
  label,
  value,
  highlight,
  loading,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  loading?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {loading ? (
        <Skeleton className="h-5 w-16 mt-0.5" data-testid="es-summary-skeleton" />
      ) : (
        <div className={`text-sm font-medium mt-0.5 tabular-nums ${highlight ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
          {value}
        </div>
      )}
    </div>
  );
}

export default ExecutiveSummaryDynamic;
