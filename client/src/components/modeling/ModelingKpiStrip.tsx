import { useMemo, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { getKpisForAssetClass, type ModelingKpiDef, type KpiAnnualRow } from '@shared/modeling-kpi-registry';
import type { ProFormaData } from '@/types/modeling';

interface ModelingKpiStripProps {
  proFormaData?: ProFormaData | null;
  assetClass?: string | null;
  className?: string;
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

interface SparklineProps {
  values: (number | null)[];
  colorClass: string;
}

function Sparkline({ values, colorClass }: SparklineProps) {
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

export function ModelingKpiStrip({ proFormaData, assetClass, className }: ModelingKpiStripProps) {
  const kpis = useMemo(() => getKpisForAssetClass(assetClass), [assetClass]);

  const annualProjections = useMemo(
    (): KpiAnnualRow[] => (proFormaData?.annualProjections as KpiAnnualRow[] | undefined) ?? [],
    [proFormaData]
  );

  const computed = useMemo(() => {
    if (!proFormaData) return [];
    const metrics = proFormaData.metrics ?? {};
    return kpis.map((kpi) => {
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

      // For KPIs without computeByYear, try to derive per-year values via compute() on each row
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

      return { kpi, primary, baselineVal, stabilizedVal, sparkValues, displayValue, valueColor, showBaselineStab };
    });
  }, [kpis, proFormaData, annualProjections]);

  const visible = computed.filter((c) => c.primary !== null || c.baselineVal !== null);
  if (visible.length === 0) return null;

  const MAX_VISIBLE = 8;
  const [expanded, setExpanded] = useState(false);
  const displayedCards = expanded ? visible : visible.slice(0, MAX_VISIBLE);
  const hasMore = visible.length > MAX_VISIBLE;

  return (
    <TooltipProvider>
      <div className={cn('space-y-1', className)}>
      <div className={cn(
        'flex flex-wrap gap-0 divide-x divide-border border rounded-lg bg-card overflow-hidden',
      )}>
        {displayedCards.map(({ kpi, primary, baselineVal, stabilizedVal, sparkValues, valueColor, showBaselineStab }) => (
          <div key={kpi.key} className="flex-1 min-w-[120px] px-4 py-3">
            <div className="flex items-center gap-1 mb-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none">
                {kpi.label}
              </p>
              {kpi.tooltip && (
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
        ))}
      </div>
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
