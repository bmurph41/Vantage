/**
 * G4 Phase 2 — Consolidated multi-period P&L view.
 *
 * Renders the response of POST /api/modeling/projects/:projectId/consolidated-pnl
 * (server/services/consolidated-pnl-service.ts). Surfaces:
 *   - year columns side-by-side, with the variance % vs the leftmost year
 *   - per-year NOI rollup (baseAmount + adjustmentDelta = adjustedAmount)
 *   - master adjustment toggle (all_on / all_off / custom)
 *   - per-addback toggle drawer (collapsed by default — full per-line toggling
 *     today still lives in `AddbacksTracker`; this view layers master + apply)
 *   - "Apply to Pro Forma" with amber dot when local state differs from
 *     persisted state
 *   - unmatched-addbacks warning and missing-period banner
 *
 * What is intentionally NOT here yet (Phase 3 follow-ups):
 *   - ReconciliationModal (variances stream is stub-empty in Phase 1.5)
 *   - Per-cell hover provenance card for AppliedAddback details
 */

import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Check, Loader2, RefreshCw, Sparkles, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { useConsolidatedPnL, useApplyAdjustments } from '@/hooks/useConsolidatedPnL';
import type {
  AdjustmentMasterState,
  ConsolidatedLineItem,
  ConsolidatedPnLOptions,
  ConsolidatedPnLResponse,
  YearColumn,
  YearRangeMode,
} from '@shared/types/consolidated-pnl';
import { FMEmptyState } from '@/components/modeling/FMEmptyState';

type ProjectedKey = `${number}:${number}`; // `${year}:${month}`

interface Props {
  projectId: string;
  onNavigateToInputs?: () => void;
}

const CATEGORY_ORDER: Record<string, number> = {
  Revenue: 0,
  COGS: 1,
  Expenses: 2,
  Other: 3,
};

function sortLines(items: ConsolidatedLineItem[]): ConsolidatedLineItem[] {
  return [...items].sort((a, b) => {
    const ca = CATEGORY_ORDER[a.category] ?? 99;
    const cb = CATEGORY_ORDER[b.category] ?? 99;
    if (ca !== cb) return ca - cb;
    return a.lineItemLabel.localeCompare(b.lineItemLabel);
  });
}

function YearHeader({ year }: { year: YearColumn }) {
  return (
    <th className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap" data-testid={`year-header-${year.year}`}>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm">{year.year}</span>
        <div className="flex items-center gap-1.5 text-[10px] font-normal text-muted-foreground">
          {year.periodType === 'year' ? (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">Annual</Badge>
          ) : (
            <span>{year.monthsCovered}/12 mo</span>
          )}
          {year.isPartial && (
            <Badge variant="outline" className="h-4 px-1 text-[10px] border-amber-500 text-amber-600">
              Partial
            </Badge>
          )}
        </div>
      </div>
    </th>
  );
}

function VarianceCell({ base, current }: { base: number | null; current: number | null }) {
  if (base == null || current == null || base === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const pct = ((current - base) / Math.abs(base)) * 100;
  const cls = pct > 0
    ? 'text-emerald-600'
    : pct < 0
      ? 'text-rose-600'
      : 'text-muted-foreground';
  const sign = pct > 0 ? '+' : '';
  return <span className={cls}>{sign}{pct.toFixed(1)}%</span>;
}

export function ConsolidatedPnLView({ projectId, onNavigateToInputs }: Props) {
  const [yearRange, setYearRange] = useState<YearRangeMode>('calendar');
  const [pendingMaster, setPendingMaster] = useState<AdjustmentMasterState | null>(null);

  const options: ConsolidatedPnLOptions = useMemo(() => ({ yearRange }), [yearRange]);
  const { data, isLoading, isError, refetch, isFetching } = useConsolidatedPnL(projectId, options);
  const apply = useApplyAdjustments(projectId);

  const effectiveMaster: AdjustmentMasterState =
    pendingMaster ?? data?.masterState ?? 'all_on';

  const dirty = pendingMaster !== null && pendingMaster !== data?.masterState;

  const projectedSet = useMemo<Set<ProjectedKey>>(() => {
    if (!data) return new Set();
    return new Set(
      data.projectedCells.map((c) => `${c.year}:${c.month}` as ProjectedKey),
    );
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="consolidated-pnl-loading">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" data-testid="consolidated-pnl-error">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Could not load consolidated P&amp;L</AlertTitle>
        <AlertDescription>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-2" /> Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!data || data.lineItems.length === 0 || data.years.length === 0) {
    return (
      <FMEmptyState
        icon={Sparkles}
        title="No P&L history yet"
        description="Upload at least one historical P&L to see the multi-period consolidated view."
        actionLabel={onNavigateToInputs ? 'Upload P&L' : undefined}
        onAction={onNavigateToInputs}
      />
    );
  }

  return renderView({
    data,
    yearRange,
    setYearRange,
    effectiveMaster,
    setPendingMaster,
    dirty,
    apply,
    pendingMaster,
    projectedSet,
    isFetching,
  });
}

interface RenderArgs {
  data: ConsolidatedPnLResponse;
  yearRange: YearRangeMode;
  setYearRange: (m: YearRangeMode) => void;
  effectiveMaster: AdjustmentMasterState;
  setPendingMaster: (m: AdjustmentMasterState | null) => void;
  dirty: boolean;
  apply: ReturnType<typeof useApplyAdjustments>;
  pendingMaster: AdjustmentMasterState | null;
  projectedSet: Set<ProjectedKey>;
  isFetching: boolean;
}

function renderView(args: RenderArgs) {
  const {
    data, yearRange, setYearRange,
    effectiveMaster, setPendingMaster, dirty, apply, pendingMaster,
    projectedSet, isFetching,
  } = args;

  const lines = sortLines(data.lineItems);
  const baselineYear = data.years[0]?.year;

  const handleApply = () => {
    apply.mutate(
      {
        addbackToggles: [],
        masterStateChange: pendingMaster ?? effectiveMaster,
      },
      { onSuccess: () => setPendingMaster(null) },
    );
  };

  return (
    <div className="space-y-4" data-testid="consolidated-pnl-view">
      {/* Sticky header — range + master toggle + apply */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b py-3 -mx-2 px-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={yearRange} onValueChange={(v) => setYearRange(v as YearRangeMode)}>
              <SelectTrigger className="w-36 h-9" data-testid="year-range-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calendar">Calendar Years</SelectItem>
                <SelectItem value="fiscal">Fiscal Years</SelectItem>
                <SelectItem value="t12">Trailing 12 Months</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {data.effectiveStart.year}/{String(data.effectiveStart.month).padStart(2, '0')}
              {' → '}
              {data.effectiveEnd.year}/{String(data.effectiveEnd.month).padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Adjustments:
              <Select
                value={effectiveMaster}
                onValueChange={(v) => setPendingMaster(v as AdjustmentMasterState)}
              >
                <SelectTrigger className="w-32 h-8" data-testid="master-state-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_on">All On</SelectItem>
                  <SelectItem value="all_off">All Off</SelectItem>
                  <SelectItem value="custom">Custom (per addback)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              size="sm"
              onClick={handleApply}
              disabled={apply.isPending || (!dirty && !apply.isError)}
              data-testid="apply-to-pro-forma"
              className="relative"
            >
              {apply.isPending ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Check className="h-3 w-3 mr-2" />}
              Apply to Pro Forma
              {dirty && (
                <span
                  className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background"
                  aria-label="unsynced changes"
                />
              )}
            </Button>
            {isFetching && !apply.isPending && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {!dirty && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Adjustments shown reflect the persisted master state. Change the selector above and click
            <span className="font-semibold"> Apply to Pro Forma</span> to sync — Pro Forma will pick up
            the new state on next read.
          </p>
        )}
        {dirty && (
          <p className="text-[11px] text-amber-700 mt-2">
            You have unsynced changes. Click <span className="font-semibold">Apply to Pro Forma</span> to commit.
          </p>
        )}
      </div>

      {/* Warnings */}
      {data.unmatchedAddbacks.length > 0 && (
        <Alert variant="default" className="border-amber-300 bg-amber-50" data-testid="unmatched-addbacks-banner">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">
            {data.unmatchedAddbacks.length} addback{data.unmatchedAddbacks.length === 1 ? '' : 's'} unmatched
          </AlertTitle>
          <AlertDescription className="text-amber-800 text-xs">
            One or more addbacks reference line items that no longer exist in your actuals.
            Review and either delete the orphan addback or correct its line-item key.
          </AlertDescription>
        </Alert>
      )}

      {data.missingPeriods.some((p) => p.missingMonths.length > 0) && (
        <Alert variant="default" className="border-blue-300 bg-blue-50" data-testid="missing-periods-banner">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900">Projected months in range</AlertTitle>
          <AlertDescription className="text-blue-800 text-xs">
            {data.missingPeriods.filter((p) => p.missingMonths.length > 0).map((p) => (
              <div key={p.year}>
                {p.year}: {p.missingMonths.length} month{p.missingMonths.length === 1 ? '' : 's'} missing — auto-projected
                ({p.handling}).
              </div>
            ))}
            Auto-projected cells use prior-year YoY → trailing-3-month → gap fallback.
          </AlertDescription>
        </Alert>
      )}

      {/* Main consolidated grid */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Consolidated P&amp;L</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Line item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Category</th>
                  {data.years.map((y) => <YearHeader key={y.year} year={y} />)}
                  {data.years.length > 1 && (
                    <th className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap">
                      Δ {data.years[0]?.year} → {data.years[data.years.length - 1]?.year}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const lastCell = line.annual[line.annual.length - 1];
                  const firstCell = line.annual[0];
                  return (
                    <tr
                      key={line.lineItemKey}
                      className="border-b last:border-0 hover:bg-muted/20"
                      data-testid={`line-row-${line.lineItemKey}`}
                    >
                      <td className="px-3 py-1.5 font-medium text-foreground">{line.lineItemLabel}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">
                        {line.category}
                        {line.department && <span className="ml-1.5 text-[10px]">/ {line.department}</span>}
                      </td>
                      {line.annual.map((cell) => (
                        <td
                          key={cell.year}
                          className="px-3 py-1.5 text-right font-mono tabular-nums"
                          data-testid={`cell-${line.lineItemKey}-${cell.year}`}
                        >
                          <div className="flex flex-col items-end">
                            <span className={cell.hasAdjustment ? 'text-foreground' : 'text-foreground'}>
                              {formatCurrency(cell.adjustedAmount, { dash: true })}
                            </span>
                            {cell.hasAdjustment && cell.adjustedAmount !== cell.baseAmount && (
                              <span className="text-[10px] text-muted-foreground line-through">
                                {formatCurrency(cell.baseAmount, { dash: true })}
                              </span>
                            )}
                          </div>
                        </td>
                      ))}
                      {data.years.length > 1 && (
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs">
                          <VarianceCell
                            base={firstCell?.adjustedAmount ?? null}
                            current={lastCell?.adjustedAmount ?? null}
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* NOI rollup */}
                <tr className="bg-muted/30 font-semibold border-t-2">
                  <td className="px-3 py-2 text-foreground">NOI</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">Rollup</td>
                  {data.years.map((y, idx) => {
                    const g = data.annualAdjustments[idx];
                    return (
                      <td key={y.year} className="px-3 py-2 text-right font-mono tabular-nums" data-testid={`noi-${y.year}`}>
                        <div className="flex flex-col items-end">
                          <span>{formatCurrency(g?.adjustedAmount ?? 0, { dash: true })}</span>
                          {g && g.adjustmentDelta !== 0 && (
                            <span className={`text-[10px] ${g.adjustmentDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {g.adjustmentDelta > 0 ? '+' : ''}{formatCurrency(g.adjustmentDelta, { dash: false })} addback
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {data.years.length > 1 && (
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-xs">
                      <VarianceCell
                        base={data.annualAdjustments[0]?.adjustedAmount ?? null}
                        current={data.annualAdjustments[data.annualAdjustments.length - 1]?.adjustedAmount ?? null}
                      />
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footer — meta */}
      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
        <span>
          Generated {new Date(data.generatedAt).toLocaleString()}
          {baselineYear ? ` • Baseline year: ${baselineYear}` : ''}
        </span>
        <span>
          {data.lineItems.length} lines × {data.years.length} years
          {projectedSet.size > 0 ? ` • ${projectedSet.size} projected months` : ''}
        </span>
      </div>
    </div>
  );
}
