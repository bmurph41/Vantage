import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCaseLabels, type CaseType } from '@/hooks/useCaseLabels';
import type { ModelingProject } from '@shared/schema';
import {
  ClipboardList,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Building2,
  Calendar,
  Target,
  Settings,
  Save,
  Download,
  FileText,
  BarChart3
} from 'lucide-react';
import ICMemoExport from './ic-memo-export';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';

interface WorkspaceExecutiveSummaryProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

type ScenarioType = 'base' | 'aggressive' | 'conservative';

type ScenarioConfig = {
  name: string;
  revenueGrowth: number;
  expenseGrowth: number;
  exitCapRate: number;
  description: string;
};

const defaultScenarios: Record<ScenarioType, ScenarioConfig> = {
  base: {
    name: 'Base Case',
    revenueGrowth: 3,
    expenseGrowth: 2,
    exitCapRate: 7.5,
    description: 'Manual assumptions as entered',
  },
  aggressive: {
    name: 'Aggressive',
    revenueGrowth: 5,
    expenseGrowth: 1.5,
    exitCapRate: 7.0,
    description: 'Higher growth, lower expenses, cap rate compression',
  },
  conservative: {
    name: 'Conservative',
    revenueGrowth: 2,
    expenseGrowth: 3,
    exitCapRate: 8.0,
    description: 'Lower growth, higher expenses, cap rate expansion',
  },
};

export default function WorkspaceExecutiveSummary({ projectId, onTabChange }: WorkspaceExecutiveSummaryProps) {
  const { toast } = useToast();
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('base');
  const [showScenarioConfig, setShowScenarioConfig] = useState(false);
  const [scenarios, setScenarios] = useState(defaultScenarios);

  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });
  
  const { getLabel, getCaseColor } = useCaseLabels(project);

  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const { data: summaryData } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'executive-summary', activeScenario],
  });

  const holdPeriod = config?.holdPeriod || 5;
  const startYear = 2026;

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}%`;
  };

  const formatMultiple = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}x`;
  };

  const currentScenario = scenarios[activeScenario];

  const hasData = summaryData && (summaryData.year1NOI > 0 || summaryData.purchasePrice > 0);
  
  const emptyMetrics = {
    purchasePrice: project?.purchasePrice || 0,
    year1NOI: 0,
    year1CapRate: 0,
    exitNOI: 0,
    exitCapRate: scenarios[activeScenario].exitCapRate,
    exitValue: 0,
    totalEquityRequired: 0,
    totalDebt: 0,
    ltv: 0,
    minDscr: 0,
    avgDscr: 0,
    debtYield: 0,
    totalDebtService: 0,
    unleveredIRR: 0,
    leveredIRR: 0,
    equityMultiple: 0,
    cashOnCash: Array.from({ length: holdPeriod }, () => 0),
    noiByYear: Array.from({ length: holdPeriod }, () => 0),
  };

  const metrics = summaryData || emptyMetrics;

  const updateScenario = (type: ScenarioType, field: keyof ScenarioConfig, value: string | number) => {
    setScenarios(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: typeof value === 'string' && field !== 'name' && field !== 'description' 
          ? parseFloat(value) || 0 
          : value,
      },
    }));
  };

  return (
    <div className="space-y-6">
      {onTabChange && (
        <WorkflowNavigation currentTab="summary" onNavigate={onTabChange} />
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Executive Summary</h2>
          <p className="text-sm text-muted-foreground">
            Investment analysis and scenario comparison
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={activeScenario} onValueChange={(v: ScenarioType) => setActiveScenario(v)}>
            <SelectTrigger className="w-48" data-testid="select-scenario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getCaseColor('base')}`} />
                  {getLabel('base')}
                </div>
              </SelectItem>
              <SelectItem value="aggressive">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getCaseColor('aggressive')}`} />
                  {getLabel('aggressive')}
                </div>
              </SelectItem>
              <SelectItem value="conservative">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getCaseColor('conservative')}`} />
                  {getLabel('conservative')}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <ICMemoExport projectId={projectId} />
          <Dialog open={showScenarioConfig} onOpenChange={setShowScenarioConfig}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-configure-scenarios">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Scenario Configuration</DialogTitle>
                <DialogDescription>
                  Set fixed growth percentages for each scenario
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {(['base', 'aggressive', 'conservative'] as ScenarioType[]).map((type) => (
                  <div key={type} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant={type === 'base' ? 'default' : type === 'aggressive' ? 'secondary' : 'outline'}>
                        <div className={`w-2 h-2 rounded-full mr-1.5 ${getCaseColor(type)}`} />
                        {getLabel(type)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{scenarios[type].description}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Revenue Growth (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={scenarios[type].revenueGrowth}
                          onChange={(e) => updateScenario(type, 'revenueGrowth', e.target.value)}
                          disabled={type === 'base'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expense Growth (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={scenarios[type].expenseGrowth}
                          onChange={(e) => updateScenario(type, 'expenseGrowth', e.target.value)}
                          disabled={type === 'base'}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Exit Cap Rate (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={scenarios[type].exitCapRate}
                          onChange={(e) => updateScenario(type, 'exitCapRate', e.target.value)}
                          disabled={type === 'base'}
                        />
                      </div>
                    </div>
                    {type !== 'conservative' && <Separator />}
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowScenarioConfig(false)} data-testid="button-cancel-config">
                  Cancel
                </Button>
                <Button onClick={() => setShowScenarioConfig(false)} data-testid="button-save-scenarios">
                  <Save className="h-4 w-4 mr-2" />
                  Save Scenarios
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" data-testid="button-export-summary">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{project?.marinaName || 'Marina Project'}</h3>
                <p className="text-sm text-muted-foreground">
                  {[project?.city, project?.state].filter(Boolean).join(', ')} • {holdPeriod}-Year Hold
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {currentScenario.name}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {!hasData && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h4 className="font-semibold mb-2">No Financial Data Yet</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Upload P&L documents or enter historical data to generate investment analysis and financial projections.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchase Price</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.purchasePrice)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercent(metrics.year1CapRate)} going-in cap
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Exit Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics.exitValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              @ {formatPercent(metrics.exitCapRate)} exit cap
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Levered IRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatPercent(metrics.leveredIRR)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercent(metrics.unleveredIRR)} unlevered
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Equity Multiple</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMultiple(metrics.equityMultiple)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              on {formatCurrency(metrics.totalEquityRequired)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Investment Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Purchase Price</span>
              <span className="font-medium">{formatCurrency(metrics.purchasePrice)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Senior Debt ({metrics.ltv}% LTV)</span>
              <span className="font-medium">{formatCurrency(metrics.totalDebt)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Equity Required</span>
              <span className="font-medium">{formatCurrency(metrics.totalEquityRequired)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Year 1 NOI</span>
              <span className="font-medium">{formatCurrency(metrics.year1NOI)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Debt Metrics Card */}
        <Card>
          <CardHeader>
            <CardTitle>Debt Metrics</CardTitle>
            <CardDescription>Key lending ratios and coverage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Min DSCR</span>
              <Badge variant={metrics.minDscr >= 1.25 ? "default" : metrics.minDscr >= 1.0 ? "secondary" : "destructive"}>
                {metrics.minDscr ? metrics.minDscr.toFixed(2) : "-"}x
              </Badge>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Avg DSCR</span>
              <Badge variant={metrics.avgDscr >= 1.25 ? "default" : metrics.avgDscr >= 1.0 ? "secondary" : "destructive"}>
                {metrics.avgDscr ? metrics.avgDscr.toFixed(2) : "-"}x
              </Badge>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Debt Yield</span>
              <span className="font-medium">{formatPercent(metrics.debtYield)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Annual Debt Service</span>
              <span className="font-medium">{formatCurrency(metrics.totalDebtService / (holdPeriod || 5))}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Assumptions</CardTitle>
            <CardDescription>{currentScenario.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Revenue Growth</span>
              <Badge variant="outline">{currentScenario.revenueGrowth}% annually</Badge>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Expense Growth</span>
              <Badge variant="outline">{currentScenario.expenseGrowth}% annually</Badge>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Exit Cap Rate</span>
              <Badge variant="outline">{currentScenario.exitCapRate}%</Badge>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Hold Period</span>
              <Badge variant="outline">{holdPeriod} years</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>NOI Projection & Cash-on-Cash Returns</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Metric</TableHead>
                {Array.from({ length: holdPeriod }, (_, i) => (
                  <TableHead key={i} className="text-right">
                    Year {i + 1}
                    <div className="text-xs font-normal text-muted-foreground">{startYear + i}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Net Operating Income</TableCell>
                {metrics.noiByYear.map((noi: number, i: number) => (
                  <TableCell key={i} className="text-right">{formatCurrency(noi)}</TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Cash-on-Cash Return</TableCell>
                {metrics.cashOnCash.map((coc: number, i: number) => (
                  <TableCell key={i} className="text-right text-green-600">
                    {formatPercent(coc)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell className="font-medium">NOI Growth</TableCell>
                {metrics.noiByYear.map((noi: number, i: number) => (
                  <TableCell key={i} className="text-right text-muted-foreground">
                    {i === 0 ? '-' : `+${(((noi / metrics.noiByYear[i - 1]) - 1) * 100).toFixed(1)}%`}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scenario Comparison</CardTitle>
          <CardDescription>Side-by-side comparison of all scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Metric</TableHead>
                <TableHead className="text-right">{getLabel('base')}</TableHead>
                <TableHead className="text-right">{getLabel('aggressive')}</TableHead>
                <TableHead className="text-right">{getLabel('conservative')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Revenue Growth</TableCell>
                <TableCell className="text-right">{scenarios.base.revenueGrowth}%</TableCell>
                <TableCell className="text-right text-green-600">{scenarios.aggressive.revenueGrowth}%</TableCell>
                <TableCell className="text-right text-amber-600">{scenarios.conservative.revenueGrowth}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Expense Growth</TableCell>
                <TableCell className="text-right">{scenarios.base.expenseGrowth}%</TableCell>
                <TableCell className="text-right text-green-600">{scenarios.aggressive.expenseGrowth}%</TableCell>
                <TableCell className="text-right text-amber-600">{scenarios.conservative.expenseGrowth}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Exit Cap Rate</TableCell>
                <TableCell className="text-right">{scenarios.base.exitCapRate}%</TableCell>
                <TableCell className="text-right text-green-600">{scenarios.aggressive.exitCapRate}%</TableCell>
                <TableCell className="text-right text-amber-600">{scenarios.conservative.exitCapRate}%</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Exit Value</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(812000 / (scenarios.base.exitCapRate / 100))}
                </TableCell>
                <TableCell className="text-right text-green-600">
                  {formatCurrency(850000 / (scenarios.aggressive.exitCapRate / 100))}
                </TableCell>
                <TableCell className="text-right text-amber-600">
                  {formatCurrency(780000 / (scenarios.conservative.exitCapRate / 100))}
                </TableCell>
              </TableRow>
              <TableRow className="bg-primary/5 font-semibold">
                <TableCell>Levered IRR</TableCell>
                <TableCell className="text-right">18.2%</TableCell>
                <TableCell className="text-right text-green-600">22.5%</TableCell>
                <TableCell className="text-right text-amber-600">14.8%</TableCell>
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell>Equity Multiple</TableCell>
                <TableCell className="text-right">2.10x</TableCell>
                <TableCell className="text-right text-green-600">2.45x</TableCell>
                <TableCell className="text-right text-amber-600">1.85x</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
