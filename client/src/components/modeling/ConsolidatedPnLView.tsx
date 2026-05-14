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
import { AlertCircle, AlertTriangle, Check, Layers, Loader2, RefreshCw, Sparkles, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils';
import { useConsolidatedPnL, useApplyAdjustments, useUpdateProjectionDecision } from '@/hooks/useConsolidatedPnL';
import { useModelingAddbacks, type Addback } from '@/hooks/useModelingAddbacks';
import type {
  AdjustmentMasterState,
  AddbackToggle,
  ConsolidatedLineItem,
  ConsolidatedPnLOptions,
  ConsolidatedPnLResponse,
  MissingPeriodReport,
  ProjectionHandling,
  ProjectionSource,
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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatSource(source: ProjectionSource): string {
  switch (source) {
    case 'auto:prior_year_yoy': return 'Prior-year YoY';
    case 'auto:trailing_3mo':   return 'Trailing 3-month';
    case 'gap':                 return 'Gap (no projection)';
  }
}

interface YearProjectionInfo {
  report: MissingPeriodReport;
  methods: Array<{ source: ProjectionSource; months: number[] }>;
}

function YearHeader({
  year,
  projectionInfo,
}: {
  year: YearColumn;
  projectionInfo?: YearProjectionInfo;
}) {
  const hasProjections = !!projectionInfo && projectionInfo.report.missingMonths.length > 0;
  return (
    <th className="px-3 py-2 text-right font-semibold text-foreground whitespace-nowrap" data-testid={`year-header-${year.year}`}>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm">
          {year.year}
          {hasProjections && projectionInfo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="ml-0.5 text-amber-600 cursor-help"
                    data-testid={`projection-indicator-${year.year}`}
                    aria-label={`${projectionInfo.report.missingMonths.length} of 12 months projected`}
                  >
                    *
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">
                      {projectionInfo.report.missingMonths.length} of 12 months projected
                    </div>
                    <div className="text-muted-foreground">
                      Handling: {projectionInfo.report.handling}
                    </div>
                    {projectionInfo.methods.length > 0 && (
                      <div className="pt-1 mt-1 border-t border-border space-y-0.5">
                        {projectionInfo.methods.map((b) => (
                          <div key={b.source}>
                            <span className="font-medium">{formatSource(b.source)}:</span>{' '}
                            {b.months.map((m) => MONTH_NAMES[m - 1]).join(', ')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </span>
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
  const [pendingTogglesByAddbackId, setPendingTogglesByAddbackId] = useState<Map<string, boolean>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);

  const options: ConsolidatedPnLOptions = useMemo(() => ({ yearRange }), [yearRange]);
  const { data, isLoading, isError, refetch, isFetching } = useConsolidatedPnL(projectId, options);
  const apply = useApplyAdjustments(projectId);
  const updateProjectionDecision = useUpdateProjectionDecision(projectId);
  const { addbacks, isLoading: addbacksLoading } = useModelingAddbacks(projectId);

  const effectiveMaster: AdjustmentMasterState =
    pendingMaster ?? data?.masterState ?? 'all_on';

  // Resolve the desired isActive for an addback, taking into account
  // (1) any explicit per-addback override the user toggled in the drawer,
  // (2) the pending master state if user changed it,
  // (3) the server-persisted isActive as fallback.
  const resolveAddbackState = (a: Addback): boolean => {
    if (pendingTogglesByAddbackId.has(a.id)) {
      return pendingTogglesByAddbackId.get(a.id)!;
    }
    if (pendingMaster === 'all_on') return true;
    if (pendingMaster === 'all_off') return false;
    return a.isActive;
  };

  // Only-divergent payload: send addbacks whose resolved state differs
  // from server-persisted isActive. "Leave alone" semantics verified against
  // adjustment-apply-service.ts (Phase 0).
  const pendingTogglesArray = useMemo<AddbackToggle[]>(() => {
    const out: AddbackToggle[] = [];
    for (const a of addbacks) {
      const target = pendingTogglesByAddbackId.has(a.id)
        ? pendingTogglesByAddbackId.get(a.id)!
        : pendingMaster === 'all_on'
          ? true
          : pendingMaster === 'all_off'
            ? false
            : a.isActive;
      if (target !== a.isActive) out.push({ addbackId: a.id, isActive: target });
    }
    return out;
  }, [addbacks, pendingMaster, pendingTogglesByAddbackId]);

  const masterDirty = pendingMaster !== null && pendingMaster !== data?.masterState;
  const dirty = masterDirty || pendingTogglesArray.length > 0;

  const projectedSet = useMemo<Set<ProjectedKey>>(() => {
    if (!data) return new Set();
    return new Set(
      data.projectedCells.map((c) => `${c.year}:${c.month}` as ProjectedKey),
    );
  }, [data]);

  const projectionByYear = useMemo<Map<number, YearProjectionInfo>>(() => {
    const m = new Map<number, YearProjectionInfo>();
    if (!data) return m;
    for (const report of data.missingPeriods) {
      m.set(report.year, { report, methods: [] });
    }

    // Upstream emits one ConsolidatedCell per (line item × missing month)
    // by design (potential per-cell rendering). For the year-header summary
    // tooltip we want each missing month listed once, attributed to its
    // "best" projection method. Source rank: prior_year_yoy beats
    // trailing_3mo beats gap (lower rank = better basis).
    const sourceRank: Record<ProjectionSource, number> = {
      'auto:prior_year_yoy': 0,
      'auto:trailing_3mo': 1,
      'gap': 2,
    };

    const bestByYearMonth = new Map<number, Map<number, ProjectionSource>>();
    for (const cell of data.projectedCells) {
      if (!m.has(cell.year)) continue;
      let byMonth = bestByYearMonth.get(cell.year);
      if (!byMonth) {
        byMonth = new Map<number, ProjectionSource>();
        bestByYearMonth.set(cell.year, byMonth);
      }
      const existing = byMonth.get(cell.month);
      if (existing === undefined || sourceRank[cell.source] < sourceRank[existing]) {
        byMonth.set(cell.month, cell.source);
      }
    }

    bestByYearMonth.forEach((byMonth, year) => {
      const info = m.get(year);
      if (!info) return;
      const bucketBySource = new Map<ProjectionSource, number[]>();
      byMonth.forEach((source, month) => {
        const months = bucketBySource.get(source);
        if (months) months.push(month);
        else bucketBySource.set(source, [month]);
      });
      bucketBySource.forEach((months, source) => {
        months.sort((x: number, y: number) => x - y);
        info.methods.push({ source, months });
      });
      info.methods.sort((a, b) => sourceRank[a.source] - sourceRank[b.source]);
    });
    return m;
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
    projectionByYear,
    isFetching,
    addbacks,
    addbacksLoading,
    pendingTogglesByAddbackId,
    setPendingTogglesByAddbackId,
    pendingTogglesArray,
    drawerOpen,
    setDrawerOpen,
    resolveAddbackState,
    updateProjectionDecision,
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
  projectionByYear: Map<number, YearProjectionInfo>;
  isFetching: boolean;
  addbacks: Addback[];
  addbacksLoading: boolean;
  pendingTogglesByAddbackId: Map<string, boolean>;
  setPendingTogglesByAddbackId: React.Dispatch<React.SetStateAction<Map<string, boolean>>>;
  pendingTogglesArray: AddbackToggle[];
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  resolveAddbackState: (a: Addback) => boolean;
  updateProjectionDecision: ReturnType<typeof useUpdateProjectionDecision>;
}

function renderView(args: RenderArgs) {
  const {
    data, yearRange, setYearRange,
    effectiveMaster, setPendingMaster, dirty, apply, pendingMaster,
    projectedSet, projectionByYear, isFetching,
    addbacks, addbacksLoading,
    pendingTogglesByAddbackId, setPendingTogglesByAddbackId,
    pendingTogglesArray, drawerOpen, setDrawerOpen,
    resolveAddbackState,
    updateProjectionDecision,
  } = args;

  const lines = sortLines(data.lineItems);
  const baselineYear = data.years[0]?.year;

  // Master toggle change. When user picks all_on / all_off, clear per-addback
  // overrides so the master state "wins" for all addbacks. When user picks
  // 'custom', preserve existing overrides (drawer falls back to server state
  // for un-touched addbacks).
  const handleMasterChange = (next: AdjustmentMasterState) => {
    setPendingMaster(next);
    if (next === 'all_on' || next === 'all_off') {
      setPendingTogglesByAddbackId(new Map());
    }
  };

  // Individual toggle from the drawer. Sets per-addback override and flips
  // master to 'custom' if it wasn't already (so the master dropdown reflects
  // the divergence from a bulk-set state).
  const handleIndividualToggle = (addbackId: string, next: boolean) => {
    setPendingTogglesByAddbackId((prev) => {
      const m = new Map(prev);
      m.set(addbackId, next);
      return m;
    });
    if (effectiveMaster !== 'custom') {
      setPendingMaster('custom');
    }
  };

  const handleApply = () => {
    apply.mutate(
      {
        addbackToggles: pendingTogglesArray,
        masterStateChange: pendingMaster ?? undefined,
      },
      {
        onSuccess: () => {
          setPendingMaster(null);
          setPendingTogglesByAddbackId(new Map());
          setDrawerOpen(false);
        },
      },
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
                onValueChange={(v) => handleMasterChange(v as AdjustmentMasterState)}
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

            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={addbacks.length === 0 && !addbacksLoading}
                  data-testid="open-addback-drawer"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Manage individual
                  {pendingTogglesArray.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5" data-testid="pending-toggle-count">
                      {pendingTogglesArray.length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto"
                data-testid="addback-drawer"
              >
                <SheetHeader>
                  <SheetTitle>Manage individual addbacks</SheetTitle>
                  <SheetDescription className="text-xs">
                    Toggle individual addbacks below. Changes here flip the master state to{' '}
                    <span className="font-semibold">Custom</span> and are sent on the next{' '}
                    <span className="font-semibold">Apply to Pro Forma</span>.
                  </SheetDescription>
                </SheetHeader>

                {addbacksLoading ? (
                  <div className="space-y-2 mt-4" data-testid="addback-drawer-loading">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : addbacks.length === 0 ? (
                  <div
                    className="text-center py-8 text-muted-foreground mt-4"
                    data-testid="addback-drawer-empty"
                  >
                    <p className="text-sm">No addbacks defined for this project yet.</p>
                    <p className="text-xs mt-2">
                      Open the <span className="font-semibold">Single Year</span> or{' '}
                      <span className="font-semibold">All Years</span> view of Historical P&amp;L
                      and click the addback icon next to any line item to create one.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 mt-4">
                    {addbacks.map((addback) => {
                      const resolved = resolveAddbackState(addback);
                      const diverges = resolved !== addback.isActive;
                      const scopeLabel =
                        addback.scope === 'line_item' ? 'Line'
                        : addback.scope === 'category' ? 'Category'
                        : 'Month';
                      return (
                        <div
                          key={addback.id}
                          className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/40 border border-transparent hover:border-border"
                          data-testid={`addback-row-${addback.id}`}
                        >
                          <Switch
                            checked={resolved}
                            onCheckedChange={(v) => handleIndividualToggle(addback.id, v)}
                            className="mt-0.5 shrink-0"
                            data-testid={`addback-toggle-${addback.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{addback.lineItemLabel}</div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {addback.category && (
                                <span className="text-[10px] text-muted-foreground">{addback.category}</span>
                              )}
                              <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                {scopeLabel}
                              </Badge>
                              {diverges && (
                                <Badge
                                  variant="outline"
                                  className="h-4 px-1 text-[10px] border-amber-500 text-amber-700"
                                  data-testid={`addback-pending-${addback.id}`}
                                >
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SheetContent>
            </Sheet>

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
          <AlertDescription className="text-blue-800 text-xs space-y-2">
            {data.missingPeriods.filter((p) => p.missingMonths.length > 0).map((p) => {
              const isPending =
                updateProjectionDecision.isPending &&
                updateProjectionDecision.variables?.year === p.year;
              return (
                <div key={p.year} className="flex items-center gap-3" data-testid={`missing-period-row-${p.year}`}>
                  <span className="flex-1">
                    {p.year}: {p.missingMonths.length} month
                    {p.missingMonths.length === 1 ? '' : 's'} missing
                  </span>
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" />}
                  <Select
                    value={p.handling}
                    onValueChange={(v) =>
                      updateProjectionDecision.mutate({
                        year: p.year,
                        handling: v as ProjectionHandling,
                      })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger
                      className="h-7 w-36 text-xs bg-white"
                      data-testid={`projection-handling-${p.year}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-project</SelectItem>
                      <SelectItem value="gap">Leave as gaps</SelectItem>
                      <SelectItem value="manual" disabled>
                        <span className="flex items-center gap-1.5">
                          Manual entry
                          <span className="text-[10px] text-muted-foreground">(Phase 3)</span>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            <div className="text-[11px] text-blue-700/80 pt-1 border-t border-blue-200">
              Auto-project uses prior-year YoY → trailing-3-month → gap fallback. Choose "Leave as gaps" to render missing months as known holes.
            </div>
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
                  {data.years.map((y) => (
                    <YearHeader
                      key={y.year}
                      year={y}
                      projectionInfo={projectionByYear.get(y.year)}
                    />
                  ))}
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
