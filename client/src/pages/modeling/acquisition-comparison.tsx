import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import {
  ArrowLeft, Search, X, TrendingUp, TrendingDown, Minus,
  DollarSign, Anchor, MapPin, Building2, BarChart3,
  AlertTriangle, Shield, Target, Scale, ChevronRight
} from 'lucide-react';

type RiskLevel = 'low' | 'medium' | 'high';

const getRiskColor = (level: RiskLevel) => {
  switch (level) {
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }
};

const getRiskPoints = (level: RiskLevel) => {
  switch (level) {
    case 'low': return 0;
    case 'medium': return 5;
    case 'high': return 10;
  }
};

const fmtPercent = (val: any): string => {
  if (val === null || val === undefined) return '-';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '-';
  return `${num}%`;
};

const toNum = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(num) ? null : num;
};

const getHighlightClass = (value: number | null, allValues: (number | null)[], higherIsBetter: boolean): string => {
  if (value === null || value === undefined) return '';
  const valid = allValues.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  if (valid.length < 2) return '';
  const max = Math.max(...valid);
  const min = Math.min(...valid);
  if (value === max) return higherIsBetter
    ? 'bg-green-50 dark:bg-green-900/20 font-semibold text-green-700 dark:text-green-400'
    : 'bg-red-50 dark:bg-red-900/20 font-semibold text-red-700 dark:text-red-400';
  if (value === min) return higherIsBetter
    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    : 'bg-green-50 dark:bg-green-900/20 font-semibold text-green-700 dark:text-green-400';
  return '';
};

const getConcentrationRisk = (units: number | null): RiskLevel => {
  if (units === null) return 'medium';
  if (units < 50) return 'high';
  if (units <= 200) return 'medium';
  return 'low';
};

const getCapRateRisk = (capRate: number | null): RiskLevel => {
  if (capRate === null) return 'medium';
  if (capRate < 5) return 'high';
  if (capRate <= 8) return 'medium';
  return 'low';
};

const getMarketRisk = (dealSource: string | null): RiskLevel => {
  if (!dealSource) return 'medium';
  const src = dealSource.toLowerCase();
  if (src === 'off_market' || src === 'off-market') return 'low';
  if (src === 'auction') return 'high';
  return 'medium';
};

const getExecutionRisk = (dealOutcome: string | null): RiskLevel => {
  if (!dealOutcome) return 'medium';
  const out = dealOutcome.toLowerCase();
  if (out === 'under_contract' || out === 'closed') return 'low';
  if (out === 'lost') return 'high';
  return 'medium';
};

function ComparisonTable({ label, icon: Icon, rows, data }: {
  label: string;
  icon: any;
  rows: { label: string; getValue: (p: any) => any; format?: 'currency' | 'percent' | 'number' | 'text'; highlight?: 'higher-better' | 'lower-better' }[];
  data: any[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400 w-48">Metric</th>
                {data.map((p: any) => (
                  <th key={p.id} className="text-left py-2 px-3 text-sm font-medium min-w-[160px] dark:text-gray-200">
                    <span className="truncate block max-w-[160px]">{p.name || p.marinaName || 'Unnamed'}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rawValues = data.map((p: any) => row.getValue(p));
                const numValues = rawValues.map(toNum);
                return (
                  <tr key={row.label} className="border-b last:border-0 dark:border-gray-700">
                    <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">{row.label}</td>
                    {data.map((p: any, idx: number) => {
                      const raw = rawValues[idx];
                      const num = numValues[idx];
                      let cellClass = '';
                      if (row.highlight && num !== null) {
                        cellClass = getHighlightClass(num, numValues, row.highlight === 'higher-better');
                      }
                      let display: string;
                      if (row.format === 'currency') {
                        display = num !== null ? formatCurrency(num) : '-';
                      } else if (row.format === 'percent') {
                        display = fmtPercent(raw);
                      } else if (row.format === 'number') {
                        display = num !== null ? num.toLocaleString() : '-';
                      } else {
                        display = raw != null ? String(raw) : '-';
                      }
                      return (
                        <td key={p.id} className={cn('py-2 px-3 text-sm font-medium dark:text-gray-200', cellClass)}>
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level, label }: { level: RiskLevel; label: string }) {
  return (
    <Badge className={cn('text-xs capitalize', getRiskColor(level))}>
      {level === 'high' && <AlertTriangle className="h-3 w-3 mr-1" />}
      {level === 'medium' && <Minus className="h-3 w-3 mr-1" />}
      {level === 'low' && <Shield className="h-3 w-3 mr-1" />}
      {label || level}
    </Badge>
  );
}

export default function AcquisitionComparison() {
  const [, setLocation] = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const { data: projects = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects'],
  });

  const { data: comparisonData, isLoading: comparing } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects/compare', Array.from(selectedIds)],
    enabled: selectedIds.size >= 2,
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/modeling/projects/compare', {
        projectIds: Array.from(selectedIds),
      });
      return res.json();
    },
  });

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p: any) =>
      p.name?.toLowerCase().includes(q) ||
      p.marinaName?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  };

  const removeSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const selectedProjects = useMemo(() => {
    return projects.filter((p: any) => selectedIds.has(p.id?.toString()));
  }, [projects, selectedIds]);

  const riskData = useMemo(() => {
    if (!comparisonData) return [];
    return comparisonData.map((p: any) => {
      const units = toNum(p.totalUnits || p.totalStorageUnits);
      const capRate = toNum(p.year1CapRate);
      const concentration = getConcentrationRisk(units);
      const capRateRisk = getCapRateRisk(capRate);
      const market = getMarketRisk(p.dealSource);
      const execution = getExecutionRisk(p.dealOutcome);
      const ebitda = toNum(p.ebitda) || 0;
      const allEbitda = comparisonData.map((x: any) => toNum(x.ebitda) || 0);
      const maxEbitda = Math.max(...allEbitda, 1);
      const normalizedEbitda = (ebitda / maxEbitda) * 50;
      const score = normalizedEbitda
        + ((capRate || 0) * 10)
        - getRiskPoints(concentration)
        - getRiskPoints(capRateRisk)
        - getRiskPoints(market)
        - getRiskPoints(execution);

      return {
        id: p.id,
        name: p.name || p.marinaName || 'Unnamed',
        concentration,
        capRateRisk,
        market,
        execution,
        score: Math.round(score * 10) / 10,
      };
    });
  }, [comparisonData]);

  const overviewRows = [
    { label: 'Marina Name', getValue: (p: any) => p.marinaName || p.name, format: 'text' as const },
    { label: 'Location', getValue: (p: any) => [p.city, p.state].filter(Boolean).join(', ') || '-', format: 'text' as const },
    { label: 'Purchase Price', getValue: (p: any) => p.purchasePrice, format: 'currency' as const, highlight: 'lower-better' as const },
    { label: 'Total Storage Units', getValue: (p: any) => p.totalUnits || p.totalStorageUnits, format: 'number' as const, highlight: 'higher-better' as const },
    { label: 'EBITDA', getValue: (p: any) => p.ebitda, format: 'currency' as const, highlight: 'higher-better' as const },
    { label: 'Year 1 Cap Rate', getValue: (p: any) => p.year1CapRate, format: 'percent' as const, highlight: 'higher-better' as const },
    { label: 'Deal Source', getValue: (p: any) => p.dealSource?.replace(/_/g, ' ') || '-', format: 'text' as const },
    { label: 'Deal Outcome', getValue: (p: any) => p.dealOutcome?.replace(/_/g, ' ') || '-', format: 'text' as const },
  ];

  const getAssumption = (p: any, path: string) => {
    const assumptions = p.assumptions || p.baseScenario?.assumptions || {};
    const parts = path.split('.');
    let val: any = assumptions;
    for (const part of parts) {
      val = val?.[part];
    }
    return val;
  };

  const financialRows = [
    { label: 'Revenue Growth Rate', getValue: (p: any) => p.revenueGrowthRate || getAssumption(p, 'revenueGrowthRate'), format: 'percent' as const, highlight: 'higher-better' as const },
    { label: 'Expense Growth Rate', getValue: (p: any) => p.expenseGrowthRate || getAssumption(p, 'expenseGrowthRate'), format: 'percent' as const, highlight: 'lower-better' as const },
    { label: 'Exit Cap Rate', getValue: (p: any) => p.exitCapRate || getAssumption(p, 'exitCapRate'), format: 'percent' as const },
    { label: 'Management Fee %', getValue: (p: any) => getAssumption(p, 'belowTheLine.managementFeePct'), format: 'percent' as const },
    { label: 'CapEx %', getValue: (p: any) => getAssumption(p, 'belowTheLine.capexPct'), format: 'percent' as const },
    { label: 'Reserves %', getValue: (p: any) => getAssumption(p, 'belowTheLine.reservesPct'), format: 'percent' as const },
  ];

  const maxScore = useMemo(() => {
    if (!riskData.length) return 1;
    return Math.max(...riskData.map((r) => r.score), 1);
  }, [riskData]);

  return (
    <div className="flex-1 flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b shadow-sm">
        <div className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/modeling/projects')}
                className="gap-2 flex-shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Projects</span>
                <span className="sm:hidden">Back</span>
              </Button>
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="truncate">Acquisition Comparison</span>
                </h1>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                  Compare 2–4 modeling projects side-by-side
                </p>
              </div>
            </div>
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="text-sm flex-shrink-0">
                {selectedIds.size} project{selectedIds.size > 1 ? 's' : ''} selected
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r bg-white dark:bg-gray-800 flex flex-col max-h-[40vh] md:max-h-none">
          <div className="p-4 border-b dark:border-gray-700">
            <h3 className="font-semibold mb-3 dark:text-white">Select Projects to Compare</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))
              ) : filteredProjects.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">No projects found</div>
              ) : (
                filteredProjects.map((project: any) => {
                  const pid = project.id?.toString();
                  return (
                    <div
                      key={pid}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-colors',
                        selectedIds.has(pid)
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                      onClick={() => toggleSelection(pid)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedIds.has(pid)}
                          disabled={!selectedIds.has(pid) && selectedIds.size >= 4}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate dark:text-white">{project.name || project.marinaName || 'Unnamed'}</p>
                          {project.marinaName && project.name !== project.marinaName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{project.marinaName}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {project.city && project.state && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {project.city}, {project.state}
                              </span>
                            )}
                            {project.purchasePrice && (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                {formatCurrency(project.purchasePrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {selectedIds.size === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Scale className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Select projects to compare
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  Choose 2–4 modeling projects from the list on the left to see a side-by-side comparison
                  of financials, projections, and risk assessment.
                </p>
              </div>
            </div>
          ) : selectedIds.size < 2 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Select at least one more project
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  You need at least 2 projects selected to generate a comparison.
                </p>
              </div>
            </div>
          ) : comparing ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-lg" />
              ))}
            </div>
          ) : comparisonData ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 flex-wrap">
                {comparisonData.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border dark:border-gray-700 shadow-sm"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Anchor className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[150px] dark:text-white">{p.name || p.marinaName || 'Unnamed'}</p>
                      {p.city && p.state && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.city}, {p.state}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-2"
                      onClick={() => removeSelection(p.id?.toString())}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <ComparisonTable label="Acquisition Overview" icon={Building2} rows={overviewRows} data={comparisonData} />

              <ComparisonTable label="Financial Projections" icon={TrendingUp} rows={financialRows} data={comparisonData} />

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Pro Forma Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400 w-48">Year</th>
                          {comparisonData.map((p: any) => (
                            <th key={p.id} className="text-left py-2 px-3 text-sm font-medium min-w-[160px] dark:text-gray-200">
                              <span className="truncate block max-w-[160px]">{p.name || p.marinaName || 'Unnamed'}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4, 5].map((year) => {
                          const hasAny = comparisonData.some((p: any) => {
                            const rates = getAssumption(p, 'yearlyGrowthRates');
                            return rates && (Array.isArray(rates) ? rates[year - 1] !== undefined : rates[`year${year}`] !== undefined);
                          });
                          return (
                            <tr key={year} className="border-b last:border-0 dark:border-gray-700">
                              <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">Year {year}</td>
                              {comparisonData.map((p: any) => {
                                const rates = getAssumption(p, 'yearlyGrowthRates');
                                let val: any = null;
                                if (rates) {
                                  val = Array.isArray(rates) ? rates[year - 1] : rates[`year${year}`];
                                }
                                return (
                                  <td key={p.id} className="py-2 px-3 text-sm font-medium dark:text-gray-200">
                                    {val !== null && val !== undefined ? fmtPercent(val) : 'N/A'}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    Risk Assessment Matrix
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-sm font-medium text-gray-500 dark:text-gray-400 w-48">Risk Category</th>
                          {riskData.map((r) => (
                            <th key={r.id} className="text-left py-2 px-3 text-sm font-medium min-w-[160px] dark:text-gray-200">
                              <span className="truncate block max-w-[160px]">{r.name}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">Concentration Risk</td>
                          {riskData.map((r) => (
                            <td key={r.id} className="py-2 px-3">
                              <RiskBadge level={r.concentration} label={r.concentration} />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">Cap Rate Risk</td>
                          {riskData.map((r) => (
                            <td key={r.id} className="py-2 px-3">
                              <RiskBadge level={r.capRateRisk} label={r.capRateRisk} />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b dark:border-gray-700">
                          <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">Market Risk</td>
                          {riskData.map((r) => (
                            <td key={r.id} className="py-2 px-3">
                              <RiskBadge level={r.market} label={r.market} />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b last:border-0 dark:border-gray-700">
                          <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">Execution Risk</td>
                          {riskData.map((r) => (
                            <td key={r.id} className="py-2 px-3">
                              <RiskBadge level={r.execution} label={r.execution} />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Recommendation Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {riskData
                      .slice()
                      .sort((a, b) => b.score - a.score)
                      .map((r, idx) => {
                        const pct = maxScore > 0 ? Math.max((r.score / maxScore) * 100, 5) : 5;
                        return (
                          <div key={r.id} className="flex items-center gap-4">
                            <div className="flex items-center gap-2 w-8">
                              <span className={cn(
                                'text-sm font-bold',
                                idx === 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                              )}>
                                #{idx + 1}
                              </span>
                            </div>
                            <div className="w-40 truncate text-sm font-medium dark:text-white">{r.name}</div>
                            <div className="flex-1">
                              <div className="h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all flex items-center justify-end pr-2',
                                    idx === 0
                                      ? 'bg-green-500 dark:bg-green-600'
                                      : idx === riskData.length - 1
                                        ? 'bg-amber-500 dark:bg-amber-600'
                                        : 'bg-blue-500 dark:bg-blue-600'
                                  )}
                                  style={{ width: `${pct}%` }}
                                >
                                  <span className="text-xs font-semibold text-white whitespace-nowrap">
                                    {r.score}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {idx === 0 && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                Top Pick
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}