import { formatCurrency } from '@/lib/utils';
// =============================================================================
// P&L MODE TOGGLE + P&L BUILDER
// File: client/src/components/modeling/pl-mode-toggle.tsx
//
// Drop this into the top of historical-pl.tsx
// Usage: <PLModeToggle project={project} onModeChange={handleModeChange} />
// =============================================================================

import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Upload, Calculator, Layers, Info, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getModelConfig } from '@shared/asset-class-model-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelInputMode = 'auto' | 'upload' | 'direct_input' | 'hybrid';

interface PLModeToggleProps {
  project: any;
  onModeChange?: (mode: ModelInputMode) => void;
}

interface DirectInputFinancialLine {
  label: string;
  amount: number;
  category: 'revenue' | 'expense';
  formula?: string;
}

interface ComputedFinancials {
  totalRevenue: number;
  totalExpenses: number;
  noi: number;
  revenueLines: DirectInputFinancialLine[];
  expenseLines: DirectInputFinancialLine[];
  formulaBreakdowns: Record<string, string>;
  source: string;
}

// ---------------------------------------------------------------------------
// Mode definitions
// ---------------------------------------------------------------------------

const MODE_OPTIONS: {
  value: ModelInputMode;
  label: string;
  description: string;
  icon: React.ElementType;
  activeClass: string;
  iconActiveClass: string;
  dotClass: string;
}[] = [
  {
    value: 'upload',
    label: 'Upload a P&L',
    description: 'Use an uploaded P&L statement as the source of historical financials',
    icon: Upload,
    activeClass: 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md shadow-blue-100',
    iconActiveClass: 'text-blue-600 dark:text-blue-400',
    dotClass: 'bg-blue-500',
  },
  {
    value: 'direct_input',
    label: 'Direct Input',
    description: 'Build Year 1 financials from your input assumptions (nightly rate, occupancy, etc.)',
    icon: Calculator,
    activeClass: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950 shadow-md shadow-emerald-100',
    iconActiveClass: 'text-emerald-600 dark:text-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'hybrid',
    label: 'Both (Hybrid)',
    description: 'Use uploaded actuals as the base, supplemented by computed values from assumptions',
    icon: Layers,
    activeClass: 'border-purple-500 bg-purple-50 dark:bg-purple-950 shadow-md shadow-purple-100',
    iconActiveClass: 'text-purple-600 dark:text-purple-400',
    dotClass: 'bg-purple-500',
  },
];

// ---------------------------------------------------------------------------
// Default mode by asset class
// ---------------------------------------------------------------------------

function getDefaultMode(assetClass: string): ModelInputMode {
  const directInputDefaults = new Set([
    'str', 'sfr', 'duplex', 'triplex', 'quad', 'laundromat', 'business',
  ]);
  return directInputDefaults.has(assetClass) ? 'direct_input' : 'upload';
}

// ---------------------------------------------------------------------------
// PLModeToggle Component
// ---------------------------------------------------------------------------

export function PLModeToggle({ project, onModeChange }: PLModeToggleProps) {
  const queryClient = useQueryClient();
  const assetClass = project?.assetClass ?? 'marina';
  const currentMode: ModelInputMode =
    (project?.modelInputMode as ModelInputMode) ?? getDefaultMode(assetClass);

  const [optimisticMode, setOptimisticMode] = useState<ModelInputMode | null>(null);
  const displayMode: ModelInputMode = optimisticMode ?? currentMode;

  const updateModeMutation = useMutation({
    mutationFn: async (mode: ModelInputMode) => {
      return apiRequest('PATCH', `/api/modeling/projects/${project.id}`, {
        modelInputMode: mode,
      });
    },
    onSuccess: () => {
      setOptimisticMode(null);
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
    },
    onError: () => {
      setOptimisticMode(null); // revert on error
    },
  });

  const handleSelectMode = useCallback(
    (mode: ModelInputMode) => {
      setOptimisticMode(mode);
      updateModeMutation.mutate(mode);
      onModeChange?.(mode);
    },
    [updateModeMutation, onModeChange],
  );

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Financial Data Source
        </h3>
        <Badge variant="outline" className="text-xs">
          {assetClass.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MODE_OPTIONS.map((opt) => {
          const isActive = displayMode === opt.value;
          const Icon = opt.icon;

          return (
            <button
              key={opt.value}
              onClick={() => handleSelectMode(opt.value)}
              disabled={updateModeMutation.isPending}
              className={[
                'relative p-4 rounded-xl border-2 text-left transition-all duration-200 w-full',
                isActive ? opt.activeClass + ' scale-[1.01]' : 'border-border bg-card hover:border-muted-foreground/40 hover:bg-muted/20',
                updateModeMutation.isPending ? 'opacity-50 cursor-wait' : 'cursor-pointer',
              ].join(' ')}
            >
              <div className={[
                'absolute top-2.5 right-2.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200',
                isActive ? opt.dotClass + ' border-transparent text-white shadow-sm' : 'border-muted-foreground/20 text-transparent',
              ].join(' ')}>
                <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none stroke-current stroke-[2.5]"><polyline points="1,4 3.5,6.5 9,1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="flex items-start gap-3">
                <div className={[' mt-0.5 p-1.5 rounded-lg flex-shrink-0 transition-colors', isActive ? opt.iconActiveClass + ' bg-white/70' : 'text-muted-foreground bg-muted/40'].join(' ')}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className={['font-semibold text-sm', isActive ? opt.iconActiveClass : 'text-foreground'].join(' ')}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {opt.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PLBuilder Component — Shows computed financials from inputs
// ---------------------------------------------------------------------------

interface PLBuilderProps {
  project: any;
  computedFinancials?: ComputedFinancials | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function PLBuilder({ project, computedFinancials, isLoading, onRefresh }: PLBuilderProps) {
  const [expanded, setExpanded] = useState(true);
  const config = useMemo(() => getModelConfig(project?.assetClass), [project?.assetClass]);

  if (!computedFinancials && !isLoading) return null;

  const mode = project?.modelInputMode ?? 'auto';
  if (mode === 'upload') return null; // Don't show builder in upload-only mode

  return (
    <Card className="mt-4 border-dashed border-emerald-300 dark:border-emerald-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-base">P&L Builder</CardTitle>
            <Badge variant="secondary" className="text-xs">
              Computed from Inputs
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-7 px-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-7 px-2"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        {computedFinancials && (
          <CardDescription>
            Year 1 projection based on your {config.label} assumptions
          </CardDescription>
        )}
      </CardHeader>

      {expanded && (
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : computedFinancials ? (
            <div className="space-y-4">
              {/* Revenue Section */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Revenue
                </h4>
                <div className="space-y-1">
                  {computedFinancials.revenueLines.map((line, i) => (
                    <FinancialLineRow key={i} line={line} formulaBreakdowns={computedFinancials.formulaBreakdowns} />
                  ))}
                </div>
              </div>

              {/* Expenses Section */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Expenses
                </h4>
                <div className="space-y-1">
                  {computedFinancials.expenseLines.map((line, i) => (
                    <FinancialLineRow key={i} line={line} formulaBreakdowns={computedFinancials.formulaBreakdowns} />
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-3 mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground">Total Revenue</div>
                    <div className="text-lg font-bold text-emerald-600">
                      {formatCurrency(computedFinancials.totalRevenue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total Expenses</div>
                    <div className="text-lg font-bold text-red-500">
                      {formatCurrency(computedFinancials.totalExpenses)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {config.kpis?.find(k => k.key === 'noi')?.label ?? 'NOI'}
                    </div>
                    <div className={`text-lg font-bold ${computedFinancials.noi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatCurrency(computedFinancials.noi)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No assumptions entered yet.</p>
              <p className="text-xs mt-1">Fill in your inputs in the Assumptions tab to compute Year 1 financials.</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Financial Line Row with formula tooltip
// ---------------------------------------------------------------------------

function FinancialLineRow({
  line,
  formulaBreakdowns,
}: {
  line: DirectInputFinancialLine;
  formulaBreakdowns: Record<string, string>;
}) {
  const formula = formulaBreakdowns[line.label] ?? line.formula;
  const isNegative = line.amount < 0;

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group">
      <div className="flex items-center gap-2">
        <span className="text-sm">{line.label}</span>
        {formula && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm">
                <p className="text-xs font-mono">{formula}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span className={`text-sm font-medium tabular-nums ${isNegative ? 'text-red-500' : ''}`}>
        {isNegative ? `(${formatCurrency(Math.abs(line.amount)).replace("$","")})` : formatCurrency(line.amount)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Badge — shows where financial data comes from
// ---------------------------------------------------------------------------

interface FinancialSourceBadgeProps {
  source: 'upload' | 'direct_input' | 'hybrid' | 'none';
}

export function FinancialSourceBadge({ source }: FinancialSourceBadgeProps) {
  const config = {
    upload: { label: 'From Uploaded P&L', variant: 'default' as const, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
    direct_input: { label: 'Computed from Inputs', variant: 'default' as const, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
    hybrid: { label: 'Hybrid (Actuals + Computed)', variant: 'default' as const, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
    none: { label: 'No Data', variant: 'outline' as const, className: 'text-muted-foreground' },
  };

  const c = config[source] ?? config.none;

  return (
    <Badge variant={c.variant} className={`text-xs ${c.className}`}>
      {c.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

// formatCurrency imported from @/lib/utils

export { getDefaultMode };
export type { ModelInputMode, ComputedFinancials, DirectInputFinancialLine };
