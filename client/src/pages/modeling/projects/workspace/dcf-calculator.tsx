import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { useHoldPeriod } from '@/hooks/use-hold-period';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown,
  Calculator,
  DollarSign,
  BarChart3,
  PieChart,
  RefreshCw,
  Download,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Percent,
  Target,
  Activity,
  Layers,
  AlertCircle
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import debounce from 'lodash.debounce';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { MarketRatePicker, MarketRateContext } from '@/components/modeling/MarketRatePicker';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';
import { DCFMonteCarloPanel, DecisionSupportAccordion } from '@/components/workspace/DCFMonteCarloPanel';

interface DCFScenario {
  id: string;
  name: string;
  isBase: boolean;
  probability?: number;
  purchasePrice: number;
  npv: number;
  irr: number;
  leveredIRR: number;
  equityMultiple: number;
  avgCashOnCash: number;
  paybackPeriod: number;
  terminalValueAmount: number;
  goingInCapRate: number;
  exitCapRate: number;
  cashFlows: {
    period: number;
    year: number;
    noi: number;
    cashFlowBeforeDebt: number;
    cashFlowAfterDebt: number;
    presentValue: number;
  }[];
}

interface SensitivityMatrix {
  variable1: { name: string; values: number[] };
  variable2: { name: string; values: number[] };
  metric: string;
  results: number[][];
}

interface DCFAnalysis {
  projectId: string;
  scenarios: DCFScenario[];
  baseScenario: DCFScenario;
  sensitivityMatrix?: SensitivityMatrix;
  scenarioComparison: {
    scenarios: string[];
    metrics: { name: string; values: Record<string, number>; unit: string }[];
  };
  probabilityWeightedResult?: {
    expectedNPV: number;
    expectedIRR: number;
    expectedEquityMultiple: number;
    standardDeviation: number;
    confidenceInterval: { low: number; high: number };
  };
}

interface DCFCalculatorPageProps {
  onTabChange?: (tab: string) => void;
}

export default function DCFCalculatorPage({ onTabChange }: DCFCalculatorPageProps = {}) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  
  const { holdPeriod: sharedHoldPeriod, setHoldPeriod: setSharedHoldPeriod } = useHoldPeriod(projectId || '');

  const { data: scenarios = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios'],
    enabled: !!projectId,
  });
  const activeScenario = scenarios.find((s: any) => s.scenarioType === 'base' && s.isCurrentVersion);

  const { data: dcfProject } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const { data: proFormaData } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
    enabled: !!projectId,
  });

  const { data: capitalStackData } = useQuery<any>({
    queryKey: ['/api/capital-stacks', projectId],
    enabled: !!projectId,
  });

  const [liveInputs, setLiveInputs] = useState({
    purchasePrice: 0,
    year1NOI: 0,
    noiGrowthRate: 3,
    discountRate: 10,
    exitCapRate: 7.5,
    holdPeriod: 10,
    loanAmount: 0,
    loanRate: 5.5,
  });

  const [inputSources, setInputSources] = useState<Record<string, string>>({});
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updates: Partial<typeof liveInputs> = {};
    const sources: Record<string, string> = {};

    const trySet = (field: keyof typeof liveInputs, value: number, source: string) => {
      if (userOverrides[field]) return;
      if (value > 0) {
        updates[field] = value;
        sources[field] = source;
      }
    };

    const pp = dcfProject?.purchasePrice ? parseFloat(dcfProject.purchasePrice) : 0;
    trySet('purchasePrice', pp, 'Project');

    const pfY1 = proFormaData?.metrics?.year1Noi || proFormaData?.noi?.[0];
    if (pfY1 && pfY1 > 0) {
      trySet('year1NOI', pfY1, 'Pro Forma');
    } else if (pp > 0 && !pfY1 && !userOverrides.year1NOI) {
      updates.year1NOI = pp * 0.10;
      sources.year1NOI = 'Estimated (10% cap)';
    }

    const pfExitCap = proFormaData?.metrics?.exitCapRate;
    if (pfExitCap && pfExitCap > 0) {
      trySet('exitCapRate', pfExitCap, 'Pro Forma');
    } else if (activeScenario?.exitCapRate) {
      const ecr = parseFloat(activeScenario.exitCapRate);
      trySet('exitCapRate', ecr > 1 ? ecr : ecr * 100, 'Scenario');
    }

    const pfGrowth = proFormaData?.metrics?.revenueGrowthRate;
    if (pfGrowth && pfGrowth > 0) {
      trySet('noiGrowthRate', pfGrowth, 'Pro Forma');
    } else if (activeScenario?.revenueGrowthRate) {
      trySet('noiGrowthRate', parseFloat(activeScenario.revenueGrowthRate), 'Scenario');
    }

    const pfHp = proFormaData?.holdPeriod;
    if (pfHp && pfHp > 0) {
      trySet('holdPeriod', pfHp, 'Pro Forma');
    } else if (sharedHoldPeriod && sharedHoldPeriod > 0) {
      trySet('holdPeriod', sharedHoldPeriod, 'Shared');
    }

    const stack = capitalStackData?.capitalStack || capitalStackData;
    if (stack?.totalDebt) {
      trySet('loanAmount', parseFloat(stack.totalDebt), 'Capital Stack');
    }
    if (stack?.blendedDebtRate) {
      const bdr = parseFloat(stack.blendedDebtRate);
      trySet('loanRate', bdr > 1 ? bdr : bdr * 100, 'Capital Stack');
    }

    if (updates.loanAmount === undefined && updates.purchasePrice && updates.purchasePrice > 0 && !userOverrides.loanAmount) {
      updates.loanAmount = updates.purchasePrice * 0.65;
      sources.loanAmount = 'Default (65% LTV)';
    }

    if (Object.keys(updates).length > 0) {
      setLiveInputs(prev => ({ ...prev, ...updates }));
      setInputSources(prev => ({ ...prev, ...sources }));
    }
  }, [dcfProject, proFormaData, capitalStackData, activeScenario, sharedHoldPeriod, userOverrides]);

  useEffect(() => {
    if (sharedHoldPeriod && sharedHoldPeriod !== liveInputs.holdPeriod && !userOverrides.holdPeriod) {
      setLiveInputs(prev => ({ ...prev, holdPeriod: sharedHoldPeriod }));
    }
  }, [sharedHoldPeriod]);

  const { data: dcfAnalysis, isLoading, isError, error: dcfError, refetch } = useQuery<DCFAnalysis>({
    queryKey: ['/api/modeling/projects', projectId, 'dcf'],
    enabled: !!projectId,
    retry: false,
  });

  const saveExitCapRateToScenario = useMutation({
    mutationFn: (exitCapRatePercent: number) => {
      if (!activeScenario?.id) return Promise.resolve();
      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        exitCapRate: (exitCapRatePercent / 100).toFixed(4),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'dcf'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'deal-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
    },
  });

  const debouncedSaveCapRate = useCallback(
    debounce((exitCapRatePercent: number) => {
      saveExitCapRateToScenario.mutate(exitCapRatePercent);
    }, 500),
    [activeScenario?.id]
  );

  // Real-time IRR calculation
  const calculateQuickIRR = useMutation({
    mutationFn: (input: any) =>
      apiRequest('POST', '/api/dcf/quick-irr', { input }),
  });

  const debouncedCalculate = useCallback(
    debounce((inputs: typeof liveInputs) => {
      calculateQuickIRR.mutate({
        purchasePrice: inputs.purchasePrice,
        year1NOI: inputs.year1NOI,
        noiGrowthRate: inputs.noiGrowthRate / 100,
        discountRate: inputs.discountRate / 100,
        exitCapRate: inputs.exitCapRate / 100,
        holdPeriod: inputs.holdPeriod,
        loanAmount: inputs.loanAmount,
        loanRate: inputs.loanRate / 100,
      });
    }, 300),
    []
  );

  const handleInputChange = (key: keyof typeof liveInputs, value: number) => {
    const newInputs = { ...liveInputs, [key]: value };
    setLiveInputs(newInputs);
    setUserOverrides(prev => ({ ...prev, [key]: true }));
    setInputSources(prev => ({ ...prev, [key]: 'Manual' }));
    debouncedCalculate(newInputs);
    if (key === 'holdPeriod') {
      setSharedHoldPeriod(value);
    }
    if (key === 'exitCapRate') {
      debouncedSaveCapRate(value);
    }
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError) {
    const errMsg = (dcfError as any)?.message ?? '';
    const needsInputs = errMsg.includes('Project not found') || errMsg.includes('No inputs') || !dcfAnalysis;
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
        <div className="rounded-full bg-amber-100 dark:bg-amber-950 p-4">
          <AlertCircle className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-1">
            {needsInputs ? 'Input Assumptions Required' : 'DCF Analysis Unavailable'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {needsInputs
              ? 'Complete the property inputs on the Inputs & Data tab — occupancy, revenue assumptions, and unit mix — to generate a DCF analysis.'
              : errMsg || 'Unable to compute DCF. Check that project assumptions are configured.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
          <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'inputs' }))}>
            Go to Inputs
          </Button>
        </div>
      </div>
    );
  }

  const baseScenario = dcfAnalysis?.baseScenario;
  const dcfScenarios = dcfAnalysis?.scenarios || [];
  const sensitivityMatrix = dcfAnalysis?.sensitivityMatrix;
  const probabilityResult = dcfAnalysis?.probabilityWeightedResult;
  const comparison = dcfAnalysis?.scenarioComparison;

  const quickResult = calculateQuickIRR.data as any;
  const displayIRR = quickResult?.irr ?? baseScenario?.irr ?? 0;
  const displayLeveredIRR = quickResult?.leveredIrr ?? baseScenario?.leveredIRR ?? 0;
  const displayNPV = quickResult?.npv ?? baseScenario?.npv ?? 0;
  const displayEquityMultiple = quickResult?.equityMultiple ?? baseScenario?.equityMultiple ?? 0;

  const SourceBadge = ({ field }: { field: string }) => {
    const src = inputSources[field];
    if (!src) return null;
    const isManual = src === 'Manual';
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
        isManual 
          ? 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400'
          : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
      }`}>
        {src}
      </span>
    );
  };

  return (
    <div ref={pdfRef} className="fm-page" data-testid="dcf-calculator-page">
      {onTabChange && (
        <WorkflowNavigation currentTab="dcf" onNavigate={onTabChange} />
      )}
      <div className="fm-header">
        <div>
          <div className="fm-header-title">DCF Analysis</div>
          <div className="fm-header-sub">Discounted cash flow · IRR · NPV · Sensitivity</div>
        </div>
        <div className="fm-header-actions">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            data-testid="refresh-btn"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" data-testid="export-btn">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <ExportPdfButton contentRef={pdfRef} filename="dcf-analysis" title="DCF Analysis" />
        </div>
      </div>

      {/* Real-Time Calculator */}
      <div className="fm-body">
      <div className="fm-panel">
        <div className="fm-panel-header">
          <div className="fm-panel-title">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            Real-Time DCF Calculator
          </div>
          <span className="text-xs text-muted-foreground">Adjust inputs for instant IRR · NPV · Equity Multiple</span>
        </div>
        <div className="fm-panel-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Purchase Price</Label>
                <SourceBadge field="purchasePrice" />
              </div>
              <Input
                value={liveInputs.purchasePrice ? `$${liveInputs.purchasePrice.toLocaleString()}` : ''}
                onChange={(e) => handleInputChange('purchasePrice', parseFloat(e.target.value.replace(/[$,]/g, '')) || 0)}
                placeholder="$10,000,000"
                data-testid="input-purchase-price"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Year 1 NOI</Label>
                <SourceBadge field="year1NOI" />
              </div>
              <Input
                value={liveInputs.year1NOI ? `$${liveInputs.year1NOI.toLocaleString()}` : ''}
                onChange={(e) => handleInputChange('year1NOI', parseFloat(e.target.value.replace(/[$,]/g, '')) || 0)}
                placeholder="$500,000"
                data-testid="input-year1-noi"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>NOI Growth Rate</Label>
                <SourceBadge field="noiGrowthRate" />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.noiGrowthRate]}
                  onValueChange={([v]) => handleInputChange('noiGrowthRate', v)}
                  min={0}
                  max={10}
                  step={0.25}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.noiGrowthRate}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Discount Rate</Label>
                <MarketRatePicker 
                  compact
                  filterRateTypes={['treasury']}
                  onSelectRate={(rate, label) => {
                    const riskPremium = 4;
                    handleInputChange('discountRate', rate + riskPremium);
                  }}
                  buttonLabel="Risk-Free + Premium"
                />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.discountRate]}
                  onValueChange={([v]) => handleInputChange('discountRate', v)}
                  min={5}
                  max={20}
                  step={0.5}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.discountRate}%</span>
              </div>
              <MarketRateContext 
                currentRate={liveInputs.discountRate}
                rateType="treasury"
                tenor="10y"
                className="mt-1"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Exit Cap Rate</Label>
                <SourceBadge field="exitCapRate" />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.exitCapRate]}
                  onValueChange={([v]) => handleInputChange('exitCapRate', v)}
                  min={4}
                  max={12}
                  step={0.25}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.exitCapRate}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Hold Period (Years)</Label>
                <SourceBadge field="holdPeriod" />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.holdPeriod]}
                  onValueChange={([v]) => handleInputChange('holdPeriod', v)}
                  min={3}
                  max={15}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.holdPeriod}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Loan Amount</Label>
                <SourceBadge field="loanAmount" />
              </div>
              <Input
                value={liveInputs.loanAmount ? `$${liveInputs.loanAmount.toLocaleString()}` : ''}
                onChange={(e) => handleInputChange('loanAmount', parseFloat(e.target.value.replace(/[$,]/g, '')) || 0)}
                placeholder="$7,500,000"
                data-testid="input-loan-amount"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Loan Rate</Label>
                <SourceBadge field="loanRate" />
              </div>
              <div className="flex items-center gap-2">
                <Slider
                  value={[liveInputs.loanRate]}
                  onValueChange={([v]) => handleInputChange('loanRate', v)}
                  min={3}
                  max={10}
                  step={0.125}
                  className="flex-1"
                />
                <span className="text-sm w-12 text-right">{liveInputs.loanRate}%</span>
              </div>
            </div>
          </div>

          {/* Real-Time Results */}
          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                <p className="text-sm text-green-600 dark:text-green-400">Unlevered IRR</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {calculateQuickIRR.isPending ? (
                    <Activity className="h-6 w-6 animate-pulse mx-auto" />
                  ) : (
                    formatPercent(displayIRR)
                  )}
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                <p className="text-sm text-blue-600 dark:text-blue-400">Going-In Cap</p>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {formatPercent((liveInputs.year1NOI / liveInputs.purchasePrice) * 100)}
                </p>
              </div>

              <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg text-center">
                <p className="text-sm text-purple-600 dark:text-purple-400">LTV Ratio</p>
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {formatPercent((liveInputs.loanAmount / liveInputs.purchasePrice) * 100)}
                </p>
              </div>

              <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg text-center">
                <p className="text-sm text-orange-600 dark:text-orange-400">Equity Required</p>
                <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                  {formatCompactCurrency(liveInputs.purchasePrice * 1.02 - liveInputs.loanAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ── Institutional KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 divide-x divide-border border rounded-lg overflow-hidden">
        {[
          { label: 'Levered IRR', value: formatPercent(baseScenario?.leveredIRR || 0), accent: 'text-emerald-600 dark:text-emerald-400', testId: 'card-irr' },
          { label: 'Unlevered IRR', value: formatPercent(baseScenario?.irr || 0), accent: 'text-emerald-600/80' },
          { label: 'Equity Multiple', value: `${(baseScenario?.equityMultiple || 0).toFixed(2)}x`, accent: 'text-blue-600 dark:text-blue-400', testId: 'card-equity-multiple' },
          { label: 'NPV', value: formatCompactCurrency(baseScenario?.npv || 0), accent: (baseScenario?.npv||0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500', testId: 'card-npv' },
          { label: 'Cash-on-Cash', value: formatPercent(baseScenario?.avgCashOnCash || 0), accent: 'text-amber-600 dark:text-amber-400', testId: 'card-coc' },
          { label: 'Going-In Cap', value: formatPercent(baseScenario?.goingInCapRate || 0), accent: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Exit Cap', value: formatPercent(baseScenario?.exitCapRate || 0), accent: 'text-violet-600 dark:text-violet-400' },
          { label: 'Payback', value: baseScenario?.paybackPeriod ? `${baseScenario.paybackPeriod.toFixed(1)} yrs` : '—', accent: 'text-foreground' },
        ].map(m => (
          <div key={m.label} className="px-3 py-3" data-testid={(m as any).testId}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none mb-1.5">{m.label}</p>
            <p className={`text-base font-bold tabular-nums leading-none ${m.accent}`}>{m.value}</p>
          </div>
        ))}
      </div>
      <div className="hidden">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="finance-kpi-card variant-green" data-testid="card-irr">
          <div className="kpi-icon">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">Levered IRR</div>
            <div className="kpi-value">{formatPercent(baseScenario?.leveredIRR || 0)}</div>
          </div>
        </div>

        <div className="finance-kpi-card variant-blue" data-testid="card-equity-multiple">
          <div className="kpi-icon">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">Equity Multiple</div>
            <div className="kpi-value">{(baseScenario?.equityMultiple || 0).toFixed(2)}x</div>
          </div>
        </div>

        <div className="finance-kpi-card" data-testid="card-npv">
          <div className="kpi-icon">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">NPV</div>
            <div className="kpi-value">{formatCompactCurrency(baseScenario?.npv || 0)}</div>
          </div>
        </div>

        <div className="finance-kpi-card variant-orange" data-testid="card-coc">
          <div className="kpi-icon">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">Cash-on-Cash</div>
            <div className="kpi-value">{formatPercent(baseScenario?.avgCashOnCash || 0)}</div>
          </div>
        </div>
      </div>
      </div>

      {baseScenario?.cashFlows && baseScenario.cashFlows.length > 0 && (
        <div className="p-4 border rounded-lg bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Levered Cash Flow Waterfall</p>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={baseScenario.cashFlows.map((cf: any) => ({
              yr: cf.year ? `Y${cf.year}` : `P${cf.period}`,
              noi: Math.round(cf.noi || cf.cashFlowBeforeDebt || 0),
              cf: Math.round(cf.cashFlowAfterDebt ?? cf.leveredCashFlow ?? cf.cashFlow ?? cf.noi ?? 0),
            }))} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="yr" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={60} />
              <RechartTooltip formatter={(v, n) => [`${Number(v).toLocaleString()}`, n === 'noi' ? 'NOI' : 'Levered CF']} contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid hsl(var(--border))' }} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
              <Bar dataKey="noi" fill="#3b82f6" opacity={0.25} radius={[3,3,0,0]} name="NOI" />
              <Line type="monotone" dataKey="cf" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} name="Levered CF" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="sensitivity" data-testid="tab-sensitivity">Sensitivity</TabsTrigger>
          <TabsTrigger value="cashflows" data-testid="tab-cashflows">Cash Flows</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Probability Weighted Results */}
            {probabilityResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Probability-Weighted Analysis</CardTitle>
                  <CardDescription>Expected returns across all scenarios</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Expected NPV</p>
                        <p className="text-lg font-bold">
                          {formatCompactCurrency(probabilityResult.expectedNPV)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Expected IRR</p>
                        <p className="text-lg font-bold">
                          {formatPercent(probabilityResult.expectedIRR)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Expected Multiple</p>
                        <p className="text-lg font-bold">
                          {probabilityResult.expectedEquityMultiple.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">90% Confidence Interval (NPV)</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{formatCompactCurrency(probabilityResult.confidenceInterval.low)}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full relative">
                          <div 
                            className="absolute top-0 left-1/4 right-1/4 h-full bg-blue-500 rounded-full"
                          />
                        </div>
                        <span className="text-sm">{formatCompactCurrency(probabilityResult.confidenceInterval.high)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scenario Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="finance-section-header">Scenario Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {comparison?.scenarios.map((s) => (
                        <th key={s}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison?.metrics.slice(0, 6).map((m, idx) => (
                      <tr key={m.name} className={['IRR', 'NPV', 'Equity Multiple'].includes(m.name) ? 'highlight-row' : ''}>
                        <td>{m.name}</td>
                        {comparison.scenarios.map((s) => (
                          <td key={s}>
                            {m.unit === '$' 
                              ? formatCompactCurrency(m.values[s] || 0)
                              : m.unit === '%'
                              ? formatPercent(m.values[s] || 0)
                              : m.unit === 'x'
                              ? `${(m.values[s] || 0).toFixed(2)}x`
                              : `${(m.values[s] || 0).toFixed(1)} ${m.unit}`
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scenarios Tab */}
        <TabsContent value="scenarios" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Investment Scenarios</CardTitle>
                  <CardDescription>Compare base, upside, and downside cases</CardDescription>
                </div>
                <Button variant="outline" size="sm" data-testid="add-scenario-btn">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scenario
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {dcfScenarios.map((scenario) => (
                  <Card 
                    key={scenario.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      selectedScenario === scenario.id && "ring-2 ring-primary",
                      scenario.isBase && "border-blue-500"
                    )}
                    onClick={() => setSelectedScenario(
                      selectedScenario === scenario.id ? null : scenario.id
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{scenario.name}</CardTitle>
                        {scenario.isBase && (
                          <Badge>Base</Badge>
                        )}
                        {scenario.probability && (
                          <Badge variant="outline">{(scenario.probability * 100).toFixed(0)}% prob</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">IRR</span>
                          <span className="font-semibold text-green-600">
                            {formatPercent(scenario.irr)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Levered IRR</span>
                          <span className="font-semibold">
                            {formatPercent(scenario.leveredIRR)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Equity Multiple</span>
                          <span className="font-semibold">
                            {scenario.equityMultiple.toFixed(2)}x
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">NPV</span>
                          <span className={cn(
                            "font-semibold",
                            scenario.npv >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {formatCompactCurrency(scenario.npv)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Cash-on-Cash</span>
                          <span className="font-semibold">
                            {formatPercent(scenario.avgCashOnCash)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Payback</span>
                          <span className="font-semibold">
                            {scenario.paybackPeriod.toFixed(1)} years
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sensitivity Tab */}
        <TabsContent value="sensitivity" className="mt-4">
          {sensitivityMatrix && (
            <Card>
              <CardHeader>
                <CardTitle>IRR Sensitivity Matrix</CardTitle>
                <CardDescription>
                  {sensitivityMatrix.variable1.name} vs {sensitivityMatrix.variable2.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="bg-muted">{sensitivityMatrix.variable1.name} ↓ / {sensitivityMatrix.variable2.name} →</TableHead>
                        {sensitivityMatrix.variable2.values.map((v, i) => (
                          <TableHead key={i} className="text-center min-w-[80px]">
                            {(v * 100).toFixed(1)}%
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sensitivityMatrix.results.map((row, i) => {
                        const baseIRR = baseScenario?.irr || 10;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium bg-muted">
                              {(sensitivityMatrix.variable1.values[i] * 100).toFixed(1)}%
                            </TableCell>
                            {row.map((value, j) => {
                              const variance = value - baseIRR;
                              return (
                                <TableCell 
                                  key={j}
                                  className={cn(
                                    "text-center font-medium",
                                    variance > 2 ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" :
                                    variance > 0 ? "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400" :
                                    variance < -2 ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300" :
                                    variance < 0 ? "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400" :
                                    "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold"
                                  )}
                                >
                                  {value.toFixed(1)}%
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cash Flows Tab */}
        <TabsContent value="cashflows" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="finance-section-header">Projected Cash Flows - {baseScenario?.name || 'Base Case'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>NOI</th>
                      <th>CF Before Debt</th>
                      <th>CF After Debt</th>
                      <th>Present Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baseScenario?.cashFlows.map((cf) => (
                      <tr key={cf.period}>
                        <td>Year {cf.period}</td>
                        <td>{formatCurrency(cf.noi)}</td>
                        <td>{formatCurrency(cf.cashFlowBeforeDebt)}</td>
                        <td>
                          <span className={cf.cashFlowAfterDebt >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            {formatCurrency(cf.cashFlowAfterDebt)}
                          </span>
                        </td>
                        <td className="text-muted-foreground">{formatCurrency(cf.presentValue)}</td>
                      </tr>
                    ))}
                    <tr className="highlight-row">
                      <td>Terminal Value</td>
                      <td colSpan={2}></td>
                      <td>{formatCurrency(baseScenario?.terminalValueAmount || 0)}</td>
                      <td>
                        {formatCurrency(
                          (baseScenario as any)?.presentValueOfTerminal ||
                          ((baseScenario?.terminalValueAmount || 0) / 
                            Math.pow(1 + (liveInputs.discountRate / 100), baseScenario?.cashFlows.length || 10))
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Monte Carlo Simulation */}
      {projectId && <DCFMonteCarloPanel projectId={projectId} />}

      {/* Decision Support (Tornado, Attribution, IC Memo) */}
      {projectId && <DecisionSupportAccordion projectId={projectId} />}

    </div>
  );
}
