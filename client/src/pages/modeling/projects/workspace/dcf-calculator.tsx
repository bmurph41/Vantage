import { useState, useMemo, useCallback, useEffect } from 'react';
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
  Layers
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import debounce from 'lodash.debounce';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { MarketRatePicker, MarketRateContext } from '@/components/modeling/MarketRatePicker';

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
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  
  const { holdPeriod: sharedHoldPeriod, setHoldPeriod: setSharedHoldPeriod } = useHoldPeriod(projectId || '');

  // Real-time input state
  const [liveInputs, setLiveInputs] = useState({
    purchasePrice: 5000000,
    year1NOI: 500000,
    noiGrowthRate: 3,
    discountRate: 10,
    exitCapRate: 7.5,
    holdPeriod: 10,
    loanAmount: 3250000,
    loanRate: 5.5,
  });

  useEffect(() => {
    if (sharedHoldPeriod && sharedHoldPeriod !== liveInputs.holdPeriod) {
      setLiveInputs(prev => ({ ...prev, holdPeriod: sharedHoldPeriod }));
    }
  }, [sharedHoldPeriod]);

  const { data: dcfAnalysis, isLoading, refetch } = useQuery<DCFAnalysis>({
    queryKey: ['/api/modeling/projects', projectId, 'dcf'],
    enabled: !!projectId,
  });

  // Real-time IRR calculation
  const calculateQuickIRR = useMutation({
    mutationFn: (input: any) =>
      apiRequest('/api/dcf/quick-irr', {
        method: 'POST',
        body: JSON.stringify({ input }),
      }),
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
    debouncedCalculate(newInputs);
    if (key === 'holdPeriod') {
      setSharedHoldPeriod(value);
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
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const baseScenario = dcfAnalysis?.baseScenario;
  const scenarios = dcfAnalysis?.scenarios || [];
  const sensitivityMatrix = dcfAnalysis?.sensitivityMatrix;
  const probabilityResult = dcfAnalysis?.probabilityWeightedResult;
  const comparison = dcfAnalysis?.scenarioComparison;

  // Determine real-time IRR display
  const displayIRR = calculateQuickIRR.data?.irr ?? baseScenario?.irr ?? 0;

  return (
    <div className="space-y-6 p-6" data-testid="dcf-calculator-page">
      {onTabChange && (
        <WorkflowNavigation currentTab="dcf" onNavigate={onTabChange} />
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">DCF Calculator</h1>
          <p className="text-muted-foreground">
            Real-time discounted cash flow analysis with unlimited scenarios
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Real-Time Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Real-Time DCF Calculator
          </CardTitle>
          <CardDescription>
            Adjust inputs to see instant IRR and NPV calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label>Purchase Price</Label>
              <Input
                value={liveInputs.purchasePrice ? `$${liveInputs.purchasePrice.toLocaleString()}` : ''}
                onChange={(e) => handleInputChange('purchasePrice', parseFloat(e.target.value.replace(/[$,]/g, '')) || 0)}
                placeholder="$10,000,000"
                data-testid="input-purchase-price"
              />
            </div>

            <div className="space-y-2">
              <Label>Year 1 NOI</Label>
              <Input
                value={liveInputs.year1NOI ? `$${liveInputs.year1NOI.toLocaleString()}` : ''}
                onChange={(e) => handleInputChange('year1NOI', parseFloat(e.target.value.replace(/[$,]/g, '')) || 0)}
                placeholder="$500,000"
                data-testid="input-year1-noi"
              />
            </div>

            <div className="space-y-2">
              <Label>NOI Growth Rate</Label>
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
              <Label>Exit Cap Rate</Label>
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
              <Label>Hold Period (Years)</Label>
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
              <Label>Loan Amount</Label>
              <Input
                value={liveInputs.loanAmount ? `$${liveInputs.loanAmount.toLocaleString()}` : ''}
                onChange={(e) => handleInputChange('loanAmount', parseFloat(e.target.value.replace(/[$,]/g, '')) || 0)}
                placeholder="$7,500,000"
                data-testid="input-loan-amount"
              />
            </div>

            <div className="space-y-2">
              <Label>Loan Rate</Label>
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
        </CardContent>
      </Card>

      {/* Key Metrics - Zilculator Style KPI Cards */}
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
                    <div className="grid grid-cols-3 gap-4">
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
                {scenarios.map((scenario) => (
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
                        {formatCurrency((baseScenario?.terminalValueAmount || 0) / 
                          Math.pow(1.1, baseScenario?.cashFlows.length || 10))}
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

    </div>
  );
}
