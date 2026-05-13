import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { getKpisForAssetClass, type ModelingKpiDef } from '@shared/modeling-kpi-registry';
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

export function ModelingKpiStrip({ proFormaData, assetClass, className }: ModelingKpiStripProps) {
  const kpis = useMemo(() => getKpisForAssetClass(assetClass), [assetClass]);

  const computed = useMemo(() => {
    if (!proFormaData) return [];
    const metrics = proFormaData.metrics ?? {};
    const annualProjections = proFormaData.annualProjections;
    return kpis.map((kpi) => ({
      kpi,
      value: kpi.compute(metrics, annualProjections),
    }));
  }, [kpis, proFormaData]);

  const visible = computed.filter((c) => c.value !== null && c.value !== undefined);
  if (visible.length === 0) return null;

  return (
    <TooltipProvider>
      <div className={cn(
        'flex flex-wrap gap-0 divide-x divide-border border rounded-lg bg-card overflow-hidden',
        className
      )}>
        {visible.map(({ kpi, value }) => (
          <div key={kpi.key} className="flex-1 min-w-[110px] px-4 py-3">
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
            <p className={cn('text-base font-bold tabular-nums leading-tight', kpi.color)}>
              {formatKpiValue(value, kpi.format)}
            </p>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
