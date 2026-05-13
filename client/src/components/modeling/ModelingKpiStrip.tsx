import { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info, ChevronDown, ChevronUp, Settings2, RotateCcw, ArrowUp, ArrowDown, GripVertical, Bookmark as BookmarkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { getKpisForAssetClass, MODELING_KPI_REGISTRY, type ModelingKpiDef, type KpiAnnualRow } from '@shared/modeling-kpi-registry';
import type { ProFormaData } from '@/types/modeling';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ModelingKpiStripProps {
  proFormaData?: ProFormaData | null;
  assetClass?: string | null;
  className?: string;
  projectId?: string;
}

function formatKpiValue(value: number | null | undefined, format: ModelingKpiDef['format']): string {
  if (value === null || value === undefined || isNaN(value as number)) return '—';
  switch (format) {
    case 'currency': return formatCurrency(value as number, { dash: true });
    case 'percent': return formatPercent(value as number, { dash: true });
    case 'multiple': return `${(value as number).toFixed(2)}x`;
    case 'number': return (value as number).toFixed(2);
    default: return String(value);
  }
}

function getBenchmarkColor(value: number | null, kpi: ModelingKpiDef): string {
  if (value === null || value === undefined) return kpi.color;
  const { benchmarkGood, benchmarkWarn, benchmarkInvert } = kpi;
  if (benchmarkGood === undefined && benchmarkWarn === undefined) return kpi.color;
  const isGood = benchmarkGood !== undefined
    ? (benchmarkInvert ? value <= benchmarkGood : value >= benchmarkGood)
    : false;
  const isWarn = benchmarkWarn !== undefined
    ? (benchmarkInvert ? value <= benchmarkWarn : value >= benchmarkWarn)
    : false;
  if (isGood) return 'text-emerald-600 dark:text-emerald-400';
  if (isWarn) return 'text-amber-500 dark:text-amber-400';
  if (benchmarkWarn !== undefined) return 'text-red-500 dark:text-red-400';
  return kpi.color;
}

function Sparkline({ values, colorClass }: { values: (number | null)[]; colorClass: string }) {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v));
  if (valid.length < 2) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const W = 48, H = 16;
  const pts = values
    .map((v, i) => {
      if (v === null || isNaN(v)) return null;
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cn('opacity-70', colorClass)}>
      <svg width={W} height={H} aria-hidden>
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function computeKpiValues(
  kpi: ModelingKpiDef,
  metrics: Record<string, number | undefined>,
  annualProjections: KpiAnnualRow[],
) {
  const primary = kpi.compute(metrics, annualProjections);
  let baselineVal: number | null = null;
  let stabilizedVal: number | null = null;
  let sparkValues: (number | null)[] = [];

  if (kpi.computeByYear && annualProjections.length > 0) {
    const allVals = annualProjections.map((row) => kpi.computeByYear!(row, metrics));
    sparkValues = allVals;
    baselineVal = allVals[0] ?? null;
    const stabIdx = Math.min(2, annualProjections.length - 1);
    stabilizedVal = allVals[stabIdx] ?? null;
  }

  if (!kpi.computeByYear && annualProjections.length > 0) {
    const perYearVals = annualProjections.map((row) => {
      const rowMetrics = { ...metrics, ...row };
      return kpi.compute(rowMetrics, [row]);
    });
    const yr1 = perYearVals[0] ?? null;
    const stabIdx = Math.min(2, annualProjections.length - 1);
    const stab = perYearVals[stabIdx] ?? null;
    if (yr1 !== null || stab !== null) {
      baselineVal = yr1;
      stabilizedVal = stab;
      sparkValues = perYearVals;
    }
  }

  const displayValue = baselineVal ?? primary;
  const valueColor = getBenchmarkColor(displayValue, kpi);
  const showBaselineStab = (kpi.computeByYear != null || sparkValues.length > 0) && baselineVal !== null;
  return { primary, baselineVal, stabilizedVal, sparkValues, displayValue, valueColor, showBaselineStab };
}

// ─── KPI Card content (shared between sortable card and drag overlay) ──────────

interface KpiCardContentProps {
  kpi: ModelingKpiDef;
  primary: number | null;
  baselineVal: number | null;
  stabilizedVal: number | null;
  sparkValues: (number | null)[];
  valueColor: string;
  showBaselineStab: boolean;
  isDragOverlay?: boolean;
}

function KpiCardContent({
  kpi,
  primary,
  baselineVal,
  stabilizedVal,
  sparkValues,
  valueColor,
  showBaselineStab,
  isDragOverlay,
}: KpiCardContentProps) {
  return (
    <div className={cn('px-4 py-3', isDragOverlay && 'shadow-lg border rounded-lg bg-card min-w-[120px]')}>
      <div className="flex items-center gap-1 mb-1">
        <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0 -ml-1" aria-hidden />
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none">
          {kpi.label}
        </p>
        {kpi.tooltip && !isDragOverlay && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-2.5 w-2.5 text-muted-foreground/50 cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[200px]">
              {kpi.tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {showBaselineStab ? (
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className={cn('text-base font-bold tabular-nums leading-tight', valueColor)}>
              {formatKpiValue(baselineVal, kpi.format)}
            </p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
              Yr1 &nbsp;→&nbsp;
              <span className={cn('font-medium', valueColor)}>
                {stabilizedVal !== null ? formatKpiValue(stabilizedVal, kpi.format) : '—'}
              </span>
              {' '}stab
            </p>
          </div>
          <Sparkline values={sparkValues} colorClass={valueColor} />
        </div>
      ) : (
        <p className={cn('text-base font-bold tabular-nums leading-tight', valueColor)}>
          {formatKpiValue(primary, kpi.format)}
        </p>
      )}
    </div>
  );
}

// ─── Sortable KPI Card ─────────────────────────────────────────────────────────

interface SortableKpiCardProps extends KpiCardContentProps {
  isBeingDragged: boolean;
}

function SortableKpiCard({ isBeingDragged, ...contentProps }: SortableKpiCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: contentProps.kpi.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'flex-1 min-w-[120px] cursor-grab active:cursor-grabbing touch-none select-none',
        isBeingDragged && 'opacity-40',
      )}
    >
      <KpiCardContent {...contentProps} />
    </div>
  );
}

// ─── Settings Popover ─────────────────────────────────────────────────────────

interface KpiSettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  effectiveOrderedKeys: string[];
  effectiveEnabledSet: Set<string>;
  assetClassKpis: ModelingKpiDef[];
  extraKpis: ModelingKpiDef[];
  onToggle: (key: string) => void;
  onMove: (key: string, direction: 'up' | 'down') => void;
  onReset: () => void;
  onSetAsDefault?: () => void;
  setAsDefaultPending?: boolean;
}

function KpiSettingsPopover({
  open,
  onOpenChange,
  effectiveOrderedKeys,
  effectiveEnabledSet,
  assetClassKpis,
  extraKpis,
  onToggle,
  onMove,
  onReset,
  onSetAsDefault,
  setAsDefaultPending,
}: KpiSettingsPopoverProps) {
  const unpinnedAsset = assetClassKpis.filter((k) => !effectiveEnabledSet.has(k.key));
  const unpinnedExtra = extraKpis.filter((k) => !effectiveEnabledSet.has(k.key));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center justify-center px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
          title="Customize KPI strip"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={4}>
        <div className="px-3 py-2.5 border-b flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Customize KPIs</p>
          <div className="flex items-center gap-2">
            {onSetAsDefault && (
              <button
                onClick={onSetAsDefault}
                disabled={setAsDefaultPending}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                title="Save this order as your default for all new projects"
              >
                <BookmarkIcon className="h-3 w-3" />
                {setAsDefaultPending ? 'Saving…' : 'Set as my default'}
              </button>
            )}
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              title="Reset to asset-class defaults"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto p-1">
          {/* Pinned KPIs in display order */}
          {effectiveOrderedKeys.length > 0 ? (
            <>
              <p className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Pinned · drag cards on strip or use arrows to reorder
              </p>
              {effectiveOrderedKeys.map((key, idx) => {
                const kpi = MODELING_KPI_REGISTRY[key];
                if (!kpi) return null;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex flex-col shrink-0">
                      <button
                        disabled={idx === 0}
                        onClick={() => onMove(key, 'up')}
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-default"
                        title="Move up"
                      >
                        <ArrowUp className="h-2.5 w-2.5" />
                      </button>
                      <button
                        disabled={idx === effectiveOrderedKeys.length - 1}
                        onClick={() => onMove(key, 'down')}
                        className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-default"
                        title="Move down"
                      >
                        <ArrowDown className="h-2.5 w-2.5" />
                      </button>
                    </div>
                    <span className={cn('text-xs font-medium flex-1 truncate', kpi.color)}>{kpi.label}</span>
                    <button
                      onClick={() => onToggle(key)}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1 py-0.5 rounded shrink-0"
                      title="Remove from strip"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </>
          ) : (
            <p className="px-3 py-3 text-xs text-muted-foreground italic">
              No KPIs pinned. Add some from the lists below.
            </p>
          )}

          {/* Asset-class KPIs not yet pinned */}
          {unpinnedAsset.length > 0 && (
            <>
              <p className="px-2 pt-3 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Asset-Class KPIs
              </p>
              {unpinnedAsset.map((kpi) => (
                <AddKpiRow key={kpi.key} kpi={kpi} onAdd={() => onToggle(kpi.key)} />
              ))}
            </>
          )}

          {/* Additional KPIs from other asset classes */}
          {unpinnedExtra.length > 0 && (
            <>
              <p className="px-2 pt-3 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Additional KPIs
              </p>
              {unpinnedExtra.map((kpi) => (
                <AddKpiRow key={kpi.key} kpi={kpi} onAdd={() => onToggle(kpi.key)} />
              ))}
            </>
          )}
        </div>

        <div className="px-3 py-2 border-t text-[11px] text-muted-foreground">
          {effectiveOrderedKeys.length} KPI{effectiveOrderedKeys.length !== 1 ? 's' : ''} pinned · closes to save
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddKpiRow({ kpi, onAdd }: { kpi: ModelingKpiDef; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors text-left"
      title={`Add ${kpi.label} to strip`}
    >
      <span className="text-muted-foreground/40 text-xs font-bold shrink-0">+</span>
      <span className={cn('text-xs font-medium flex-1 truncate', kpi.color)}>{kpi.label}</span>
      {kpi.tooltip && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{kpi.tooltip}</span>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ModelingKpiStrip({ proFormaData, assetClass, className, projectId }: ModelingKpiStripProps) {
  const assetClassKpis = useMemo(() => getKpisForAssetClass(assetClass), [assetClass]);
  const defaultOrderedKeys = useMemo(() => assetClassKpis.map((k) => k.key), [assetClassKpis]);

  const extraKpis = useMemo(() => {
    const assetKeys = new Set(defaultOrderedKeys);
    return Object.values(MODELING_KPI_REGISTRY)
      .filter((k) => !assetKeys.has(k.key))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [defaultOrderedKeys]);

  const { data: prefData } = useQuery<{ enabledKeys: string[] | null }>({
    queryKey: ['/api/modeling/projects', projectId, 'kpi-strip-config'],
    queryFn: async () => {
      const r = await fetch(`/api/modeling/projects/${projectId}/kpi-strip-config`, { credentials: 'include' });
      if (!r.ok) throw new Error(`KPI config fetch failed: ${r.status}`);
      return r.json();
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const { data: globalPrefData } = useQuery<{ enabledKeys: string[] | null }>({
    queryKey: ['/api/modeling/kpi-strip-config/global-default'],
    queryFn: async () => {
      const r = await fetch('/api/modeling/kpi-strip-config/global-default', { credentials: 'include' });
      if (!r.ok) throw new Error(`Global KPI default fetch failed: ${r.status}`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const savedOrderedKeys: string[] | null = useMemo(() => {
    if (!prefData || !Array.isArray(prefData.enabledKeys)) return null;
    return prefData.enabledKeys;
  }, [prefData]);

  const globalDefaultKeys: string[] | null = useMemo(() => {
    if (!globalPrefData || !Array.isArray(globalPrefData.enabledKeys)) return null;
    return globalPrefData.enabledKeys;
  }, [globalPrefData]);

  const saveMutation = useMutation({
    mutationFn: (keys: string[]) =>
      apiRequest('PATCH', `/api/modeling/projects/${projectId}/kpi-strip-config`, { enabledKeys: keys }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'kpi-strip-config'] });
    },
  });

  const setAsDefaultMutation = useMutation({
    mutationFn: (keys: string[]) =>
      apiRequest('PUT', '/api/modeling/kpi-strip-config/global-default', { enabledKeys: keys }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/kpi-strip-config/global-default'] });
    },
  });

  const [localOrderedKeys, setLocalOrderedKeys] = useState<string[] | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  useEffect(() => {
    if (!popoverOpen) {
      setLocalOrderedKeys(savedOrderedKeys ? [...savedOrderedKeys] : null);
    }
  }, [savedOrderedKeys, popoverOpen]);

  const effectiveOrderedKeys: string[] = useMemo(() => {
    if (localOrderedKeys !== null) return localOrderedKeys;
    if (savedOrderedKeys !== null) return savedOrderedKeys;
    if (globalDefaultKeys !== null) return globalDefaultKeys;
    return defaultOrderedKeys;
  }, [localOrderedKeys, savedOrderedKeys, globalDefaultKeys, defaultOrderedKeys]);

  const effectiveEnabledSet = useMemo(() => new Set(effectiveOrderedKeys), [effectiveOrderedKeys]);

  const handleToggle = useCallback((key: string) => {
    setLocalOrderedKeys((prev) => {
      const base = prev ?? [...defaultOrderedKeys];
      return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
    });
  }, [defaultOrderedKeys]);

  const handleMove = useCallback((key: string, direction: 'up' | 'down') => {
    setLocalOrderedKeys((prev) => {
      const base = prev ?? [...defaultOrderedKeys];
      const idx = base.indexOf(key);
      if (idx === -1) return base;
      const next = [...base];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return base;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }, [defaultOrderedKeys]);

  const handleReset = useCallback(() => {
    setLocalOrderedKeys([...defaultOrderedKeys]);
  }, [defaultOrderedKeys]);

  const handlePopoverOpenChange = useCallback((open: boolean) => {
    if (!open && localOrderedKeys !== null && projectId) {
      saveMutation.mutate(localOrderedKeys);
    }
    setPopoverOpen(open);
  }, [localOrderedKeys, projectId, saveMutation]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalOrderedKeys((prev) => {
      const base = prev ?? [...defaultOrderedKeys];
      const oldIndex = base.indexOf(String(active.id));
      const newIndex = base.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return base;
      const reordered = arrayMove(base, oldIndex, newIndex);
      if (projectId) {
        saveMutation.mutate(reordered);
      }
      return reordered;
    });
  }, [defaultOrderedKeys, projectId, saveMutation]);

  const handleSetAsDefault = useCallback(() => {
    setAsDefaultMutation.mutate(effectiveOrderedKeys);
  }, [effectiveOrderedKeys, setAsDefaultMutation]);

  // Shared popover props
  const settingsProps: KpiSettingsPopoverProps = {
    open: popoverOpen,
    onOpenChange: handlePopoverOpenChange,
    effectiveOrderedKeys,
    effectiveEnabledSet,
    assetClassKpis,
    extraKpis,
    onToggle: handleToggle,
    onMove: handleMove,
    onReset: handleReset,
    onSetAsDefault: projectId ? handleSetAsDefault : undefined,
    setAsDefaultPending: setAsDefaultMutation.isPending,
  };

  // ── No proFormaData ────────────────────────────────────────────────────────
  // If no projectId either, nothing to show at all
  if (!proFormaData && !projectId) return null;

  // If projectId exists, keep the settings button accessible even while loading
  if (!proFormaData) {
    return (
      <TooltipProvider>
        <div className={cn('space-y-1', className)}>
          <div className="inline-flex border rounded-lg bg-card overflow-hidden">
            <KpiSettingsPopover {...settingsProps} />
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // ── Compute values ────────────────────────────────────────────────────────
  const annualProjections: KpiAnnualRow[] =
    (proFormaData.annualProjections as KpiAnnualRow[] | undefined) ?? [];
  const metrics = proFormaData.metrics ?? {};

  const computedByKey = new Map<string, ReturnType<typeof computeKpiValues>>();
  for (const kpi of Object.values(MODELING_KPI_REGISTRY)) {
    computedByKey.set(kpi.key, computeKpiValues(kpi, metrics, annualProjections));
  }

  const visible = effectiveOrderedKeys
    .map((key) => {
      const kpi = MODELING_KPI_REGISTRY[key];
      if (!kpi) return null;
      const computed = computedByKey.get(key);
      if (!computed) return null;
      if (computed.primary === null && computed.baselineVal === null) return null;
      return { kpi, ...computed };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // ── Empty-pin state — proFormaData present but all KPIs unpinned ──────────
  if (visible.length === 0) {
    return (
      <TooltipProvider>
        <div className={cn('space-y-1', className)}>
          <div className="flex items-center gap-0 divide-x divide-border border rounded-lg bg-card overflow-hidden">
            <p className="flex-1 px-4 py-3 text-xs text-muted-foreground italic">
              No KPIs pinned — open settings to add some.
            </p>
            {projectId && <KpiSettingsPopover {...settingsProps} />}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // ── Normal render ─────────────────────────────────────────────────────────
  const MAX_VISIBLE = 8;
  const [expanded, setExpanded] = useState(false);
  const displayedCards = expanded ? visible : visible.slice(0, MAX_VISIBLE);
  const hasMore = visible.length > MAX_VISIBLE;

  const activeCard = activeDragId ? visible.find((v) => v.kpi.key === activeDragId) ?? null : null;

  return (
    <TooltipProvider>
      <div className={cn('space-y-1', className)}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveDragId(null)}
        >
          <SortableContext
            items={displayedCards.map((c) => c.kpi.key)}
            strategy={horizontalListSortingStrategy}
          >
            <div className={cn(
              'flex flex-wrap gap-0 divide-x divide-border border rounded-lg bg-card overflow-hidden',
            )}>
              {displayedCards.map(({ kpi, primary, baselineVal, stabilizedVal, sparkValues, valueColor, showBaselineStab }) => (
                <SortableKpiCard
                  key={kpi.key}
                  kpi={kpi}
                  primary={primary}
                  baselineVal={baselineVal}
                  stabilizedVal={stabilizedVal}
                  sparkValues={sparkValues}
                  valueColor={valueColor}
                  showBaselineStab={showBaselineStab}
                  isBeingDragged={activeDragId === kpi.key}
                />
              ))}

              {projectId && <KpiSettingsPopover {...settingsProps} />}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeCard && (
              <KpiCardContent
                kpi={activeCard.kpi}
                primary={activeCard.primary}
                baselineVal={activeCard.baselineVal}
                stabilizedVal={activeCard.stabilizedVal}
                sparkValues={activeCard.sparkValues}
                valueColor={activeCard.valueColor}
                showBaselineStab={activeCard.showBaselineStab}
                isDragOverlay
              />
            )}
          </DragOverlay>
        </DndContext>

        {hasMore && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" /> Show fewer KPIs</>
            ) : (
              <><ChevronDown className="h-3 w-3" /> Show {visible.length - MAX_VISIBLE} more KPIs</>
            )}
          </button>
        )}
      </div>
    </TooltipProvider>
  );
}
