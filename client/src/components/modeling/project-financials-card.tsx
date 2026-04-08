import { formatCurrency } from '@/lib/utils';
// =============================================================================
// PROJECT FINANCIALS LIVE REFRESH
// File: client/src/components/modeling/project-financials-card.tsx
//
// Drop-in replacement for the "Project Financials" card in deal-pricing.tsx.
// Shows Year 1 NOI, Total Revenue, Total Expenses with:
//   - Source badge (uploaded vs computed vs hybrid)
//   - Stale indicator when assumptions change
//   - Refresh button
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FinancialSourceBadge } from './pl-mode-toggle';
import { getModelConfig } from '@shared/asset-class-model-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectFinancialsCardProps {
  project: any;
  pricingData?: any;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectFinancialsCard({
  project,
  pricingData,
  className = '',
}: ProjectFinancialsCardProps) {
  const queryClient = useQueryClient();
  const config = useMemo(() => getModelConfig(project?.assetClass), [project?.assetClass]);
  const [isStale, setIsStale] = useState(false);
  const [lastAssumptionsHash, setLastAssumptionsHash] = useState<string | null>(null);

  // Track assumptions changes for stale detection
  const currentAssumptions = (project?.customMetrics as any)?.inputAssumptions;

  useEffect(() => {
    if (!currentAssumptions) return;
    const hash = JSON.stringify(currentAssumptions);
    if (lastAssumptionsHash !== null && hash !== lastAssumptionsHash) {
      setIsStale(true);
    }
    setLastAssumptionsHash(hash);
  }, [currentAssumptions, lastAssumptionsHash]);

  // Financials from pricing endpoint
  const financials = pricingData?.projectFinancials;
  const source = financials?.source ?? 'none';

  const {
    refetch: refreshFinancials,
    isFetching: isRefreshing,
  } = useQuery({
    queryKey: [`/api/modeling/projects/${project?.id}/pricing`],
    enabled: false, // manual refetch only
  });

  const handleRefresh = useCallback(async () => {
    await refreshFinancials();
    setIsStale(false);
    // Also invalidate deal pricing queries
    queryClient.invalidateQueries({
      queryKey: [`/api/modeling/projects/${project?.id}/pricing`],
    });
  }, [refreshFinancials, queryClient, project?.id]);

  const totalRevenue = financials?.totalRevenue ?? 0;
  const totalExpenses = financials?.totalExpenses ?? 0;
  const noi = financials?.noi ?? totalRevenue - totalExpenses;

  // Cached vs live comparison
  const cachedNOI = (project?.customMetrics as any)?.cachedNOI;
  const noiDelta = cachedNOI ? noi - cachedNOI : null;

  return (
    <Card className={`${className} ${isStale ? 'ring-2 ring-amber-300 dark:ring-amber-700' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Project Financials</CardTitle>
            <FinancialSourceBadge source={source} />
          </div>
          <div className="flex items-center gap-2">
            {isStale && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs border-amber-400 text-amber-600 dark:text-amber-400 animate-pulse cursor-help"
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Stale
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Assumptions have changed. Click refresh to recompute.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Revenue */}
          <FinancialMetric
            label="Total Revenue"
            value={totalRevenue}
            color="text-emerald-600 dark:text-emerald-400"
          />

          {/* Total Expenses */}
          <FinancialMetric
            label="Total Expenses"
            value={totalExpenses}
            color="text-red-500 dark:text-red-400"
          />

          {/* NOI */}
          <FinancialMetric
            label={config.kpis?.find((k: any) => k.key === 'noi')?.label ?? 'NOI'}
            value={noi}
            color={noi >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}
            delta={noiDelta}
          />
        </div>

        {/* Revenue/Expense line detail (collapsible) */}
        {financials?.revenueLines?.length > 0 && (
          <FinancialLineDetail
            revenueLines={financials.revenueLines}
            expenseLines={financials.expenseLines}
            formulaBreakdowns={financials.formulaBreakdowns}
          />
        )}

        {/* Expense ratio indicator */}
        {totalRevenue > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Operating Expense Ratio</span>
              <span className="font-medium">
                {((totalExpenses / totalRevenue) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-red-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalExpenses / totalRevenue) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FinancialMetric({
  label,
  value,
  color,
  delta,
}: {
  label: string;
  value: number;
  color: string;
  delta?: number | null;
}) {
  const DeltaIcon = delta && delta > 0 ? TrendingUp : delta && delta < 0 ? TrendingDown : Minus;

  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>
        {formatCurrency(value)}
      </div>
      {delta !== null && delta !== undefined && delta !== 0 && (
        <div className={`flex items-center justify-center gap-1 mt-0.5 text-xs ${delta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          <DeltaIcon className="h-3 w-3" />
          <span>{delta > 0 ? "+" : ""}{formatCurrency(delta)}</span>
        </div>
      )}
    </div>
  );
}

function FinancialLineDetail({
  revenueLines,
  expenseLines,
  formulaBreakdowns,
}: {
  revenueLines: any[];
  expenseLines: any[];
  formulaBreakdowns?: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs text-muted-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Hide Details' : 'Show Line Items'}
      </Button>

      {expanded && (
        <div className="mt-2 space-y-3 text-sm">
          {revenueLines.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Revenue</div>
              {revenueLines.map((line: any, i: number) => (
                <div key={i} className="flex justify-between py-0.5 group">
                  <div className="flex items-center gap-1.5">
                    <span className={line.amount < 0 ? 'text-muted-foreground' : ''}>{line.label}</span>
                    {formulaBreakdowns?.[line.label] && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs font-mono">{formulaBreakdowns[line.label]}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <span className={`tabular-nums ${line.amount < 0 ? 'text-red-500' : ''}`}>
                    {line.amount < 0 ? `(${formatCurrency(Math.abs(line.amount)).replace("$","")})` : formatCurrency(line.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {expenseLines.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Expenses</div>
              {expenseLines.map((line: any, i: number) => (
                <div key={i} className="flex justify-between py-0.5 group">
                  <div className="flex items-center gap-1.5">
                    <span>{line.label}</span>
                    {formulaBreakdowns?.[line.label] && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs font-mono">{formulaBreakdowns[line.label]}</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <span className="tabular-nums">{formatCurrency(line.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// formatCurrency imported from @/lib/utils
