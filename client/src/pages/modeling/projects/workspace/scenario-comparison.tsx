import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useCaseLabels, type CaseType } from '@/hooks/useCaseLabels';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { ModelingProject } from '@shared/schema';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';
import {
  GitCompare,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  BarChart3,
  Percent,
  DollarSign,
  RefreshCw
} from 'lucide-react';

interface ScenarioComparisonProps {
  projectId: string;
}

type ScenarioType = 'base' | 'aggressive' | 'conservative' | 'custom';
type ScenarioStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

interface Scenario {
  id: string;
  scenarioType: ScenarioType;
  name: string;
  description?: string;
  version: number;
  isCurrentVersion: boolean;
  revenueGrowthRate?: string;
  expenseGrowthRate?: string;
  exitCapRate?: string;
  assumptions: any;
  status: ScenarioStatus;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ComparisonResult {
  id: string;
  name: string;
  scenarioType: string;
  version: number;
  status: string;
  revenueGrowthRate: number | null;
  expenseGrowthRate: number | null;
  exitCapRate: number | null;
  assumptions: any;
  createdAt: string;
  updatedAt: string;
}


const statusConfig: Record<ScenarioStatus, { label: string; icon: any; color: string }> = {
  draft: { label: 'Draft', icon: Clock, color: 'text-muted-foreground' },
  pending_approval: { label: 'Pending', icon: Clock, color: 'text-amber-500' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-green-500' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-500' },
};

const revenueCategories = [
  { id: 'wet_slips', name: 'Wet Slips' },
  { id: 'dry_storage', name: 'Dry Storage' },
  { id: 'annual_storage', name: 'Annual Storage' },
  { id: 'rental_boats', name: 'Rental Boats' },
  { id: 'fuel', name: 'Fuel Sales' },
  { id: 'ship_store', name: 'Ship Store' },
  { id: 'service_repair', name: 'Service & Repair' },
  { id: 'third_party_leases', name: 'Third-Party Leases' },
  { id: 'other_revenue', name: 'Other Revenue' },
];

const expenseCategories = [
  { id: 'payroll', name: 'Payroll & Benefits' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'repairs_maintenance', name: 'Repairs & Maintenance' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'professional_fees', name: 'Professional Fees' },
  { id: 'property_taxes', name: 'Property Taxes' },
  { id: 'management_fees', name: 'Management Fees' },
  { id: 'other_expenses', name: 'Other Expenses' },
];

export default function ScenarioComparison({ projectId }: ScenarioComparisonProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });
  
  const { getLabel, getCaseColor } = useCaseLabels(project);
  
  const { data: scenarios = [], isLoading } = useQuery<Scenario[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios'],
  });

  const { data: comparisonData, isLoading: comparing, refetch: compareScenarios } = useQuery<ComparisonResult[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios', 'compare', selectedScenarios],
    enabled: selectedScenarios.length >= 2,
    queryFn: async () => {
      const response = await fetch(`/api/modeling/projects/${projectId}/scenarios/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scenarioIds: selectedScenarios }),
      });
      if (!response.ok) throw new Error('Failed to compare scenarios');
      return response.json();
    },
  });

  const currentScenarios = scenarios.filter(s => s.isCurrentVersion);

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(scenarioId)) {
        return prev.filter(id => id !== scenarioId);
      }
      if (prev.length >= 3) {
        toast({ title: 'Maximum 3 scenarios', description: 'You can compare up to 3 scenarios at a time.', variant: 'destructive' });
        return prev;
      }
      return [...prev, scenarioId];
    });
  };

  const getVarianceIndicator = (values: (number | null | undefined)[]) => {
    const validValues = values.filter(v => v !== null && v !== undefined) as number[];
    if (validValues.length < 2) return null;
    
    const max = Math.max(...validValues);
    const min = Math.min(...validValues);
    const variance = max - min;
    const avgValue = validValues.reduce((a, b) => a + b, 0) / validValues.length;
    const variancePercent = avgValue !== 0 ? (variance / avgValue) * 100 : 0;
    
    if (variancePercent > 25) {
      return { type: 'high', icon: AlertTriangle, color: 'text-red-500', label: 'High Variance' };
    } else if (variancePercent > 10) {
      return { type: 'medium', icon: TrendingUp, color: 'text-amber-500', label: 'Moderate Variance' };
    }
    return { type: 'low', icon: Minus, color: 'text-green-500', label: 'Low Variance' };
  };

  const getCellHighlight = (value: number | null | undefined, allValues: (number | null | undefined)[], higherIsBetter: boolean = true) => {
    if (value === null || value === undefined) return '';
    const validValues = allValues.filter(v => v !== null && v !== undefined) as number[];
    if (validValues.length < 2) return '';
    
    const max = Math.max(...validValues);
    const min = Math.min(...validValues);
    
    if (value === max) {
      return higherIsBetter ? 'bg-green-50 dark:bg-green-950 font-semibold' : 'bg-red-50 dark:bg-red-950 font-semibold';
    }
    if (value === min) {
      return higherIsBetter ? 'bg-red-50 dark:bg-red-950' : 'bg-green-50 dark:bg-green-950';
    }
    return '';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-96 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="fm-page" ref={pdfRef}>
      <div className="fm-header">
        <div>
          <div className="fm-header-title flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Scenario Comparison
          </div>
          <div className="fm-header-sub">
            Compare assumptions and metrics across scenarios for IC review
          </div>
        </div>
        <div className="fm-header-actions">
          <ExportPdfButton contentRef={pdfRef} filename="scenario-comparison" title="Scenario Comparison" />
          {selectedScenarios.length >= 2 && (
            <Button 
              onClick={() => compareScenarios()} 
              disabled={comparing}
              data-testid="button-refresh-comparison"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${comparing ? 'animate-spin' : ''}`} />
              Refresh Comparison
            </Button>
          )}
        </div>
      </div>

      <div className="fm-body">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Scenarios to Compare</CardTitle>
          <CardDescription>Choose 2-3 scenarios to see a side-by-side comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {currentScenarios.map((scenario) => {
              const isSelected = selectedScenarios.includes(scenario.id);
              const StatusIcon = statusConfig[scenario.status]?.icon || Clock;
              
              return (
                <div
                  key={scenario.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-transparent bg-muted/50 hover:border-muted-foreground/30'
                  }`}
                  onClick={() => toggleScenario(scenario.id)}
                  data-testid={`scenario-select-${scenario.scenarioType}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => toggleScenario(scenario.id)}
                      />
                      <div className={`h-2 w-2 rounded-full ${getCaseColor(scenario.scenarioType)}`} />
                    </div>
                    <Badge variant="outline" className={`text-xs ${statusConfig[scenario.status]?.color}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig[scenario.status]?.label}
                    </Badge>
                  </div>
                  <h4 className="font-medium">{scenario.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Version {scenario.version} • Updated {new Date(scenario.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Rev Growth:</span>
                      <span className="ml-1 font-medium">{formatPercent(parseFloat(scenario.revenueGrowthRate || '0'), { dash: true })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Exp Growth:</span>
                      <span className="ml-1 font-medium">{formatPercent(parseFloat(scenario.expenseGrowthRate || '0'), { dash: true })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedScenarios.length >= 2 && comparisonData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Key Metrics Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Metric</TableHead>
                    {comparisonData.map(s => (
                      <TableHead key={s.id} className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${getCaseColor(s.scenarioType as CaseType)}`} />
                          {s.name}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="w-[120px] text-center">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Revenue Growth Rate
                      </div>
                    </TableCell>
                    {comparisonData.map(s => {
                      const allValues = comparisonData.map(sc => sc.revenueGrowthRate);
                      return (
                        <TableCell 
                          key={s.id} 
                          className={`text-center ${getCellHighlight(s.revenueGrowthRate, allValues, true)}`}
                        >
                          {formatPercent(s.revenueGrowthRate, { dash: true })}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      {(() => {
                        const indicator = getVarianceIndicator(comparisonData.map(s => s.revenueGrowthRate));
                        if (!indicator) return '-';
                        const Icon = indicator.icon;
                        return (
                          <Badge variant="outline" className={indicator.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {indicator.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                  
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Expense Growth Rate
                      </div>
                    </TableCell>
                    {comparisonData.map(s => {
                      const allValues = comparisonData.map(sc => sc.expenseGrowthRate);
                      return (
                        <TableCell 
                          key={s.id} 
                          className={`text-center ${getCellHighlight(s.expenseGrowthRate, allValues, false)}`}
                        >
                          {formatPercent(s.expenseGrowthRate, { dash: true })}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      {(() => {
                        const indicator = getVarianceIndicator(comparisonData.map(s => s.expenseGrowthRate));
                        if (!indicator) return '-';
                        const Icon = indicator.icon;
                        return (
                          <Badge variant="outline" className={indicator.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {indicator.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-blue-500" />
                        Exit Cap Rate
                      </div>
                    </TableCell>
                    {comparisonData.map(s => {
                      const allValues = comparisonData.map(sc => sc.exitCapRate);
                      return (
                        <TableCell 
                          key={s.id} 
                          className={`text-center ${getCellHighlight(s.exitCapRate, allValues, false)}`}
                        >
                          {formatPercent(s.exitCapRate, { dash: true })}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      {(() => {
                        const indicator = getVarianceIndicator(comparisonData.map(s => s.exitCapRate));
                        if (!indicator) return '-';
                        const Icon = indicator.icon;
                        return (
                          <Badge variant="outline" className={indicator.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {indicator.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-medium">Status</TableCell>
                    {comparisonData.map(s => {
                      const StatusIcon = statusConfig[s.status as ScenarioStatus]?.icon || Clock;
                      return (
                        <TableCell key={s.id} className="text-center">
                          <Badge variant="outline" className={statusConfig[s.status as ScenarioStatus]?.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConfig[s.status as ScenarioStatus]?.label}
                          </Badge>
                        </TableCell>
                      );
                    })}
                    <TableCell />
                  </TableRow>

                  <TableRow>
                    <TableCell className="font-medium">Version</TableCell>
                    {comparisonData.map(s => (
                      <TableCell key={s.id} className="text-center">
                        v{s.version}
                      </TableCell>
                    ))}
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Revenue Growth Assumptions Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Category</TableHead>
                      {comparisonData.map(s => (
                        <TableHead key={s.id} className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${getCaseColor(s.scenarioType as CaseType)}`} />
                            {s.name}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="w-[80px] text-center">Spread</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueCategories.map(category => {
                      const values = comparisonData.map(s => s.assumptions?.growthRates?.[category.id] ?? null);
                      const validValues = values.filter(v => v !== null) as number[];
                      const spread = validValues.length >= 2 
                        ? Math.max(...validValues) - Math.min(...validValues) 
                        : 0;
                      
                      return (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          {comparisonData.map((s, idx) => {
                            const value = s.assumptions?.growthRates?.[category.id];
                            return (
                              <TableCell 
                                key={s.id} 
                                className={`text-center ${getCellHighlight(value, values, true)}`}
                              >
                                {formatPercent(value, { dash: true })}
                              </TableCell>
                            );
                          })}
                          <TableCell className={`text-center font-medium ${spread > 2 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {spread > 0 ? `${spread.toFixed(2)}%` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Expense Growth Assumptions Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Category</TableHead>
                      {comparisonData.map(s => (
                        <TableHead key={s.id} className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${getCaseColor(s.scenarioType as CaseType)}`} />
                            {s.name}
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="w-[80px] text-center">Spread</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseCategories.map(category => {
                      const values = comparisonData.map(s => s.assumptions?.expenseGrowth?.[category.id] ?? null);
                      const validValues = values.filter(v => v !== null) as number[];
                      const spread = validValues.length >= 2 
                        ? Math.max(...validValues) - Math.min(...validValues) 
                        : 0;
                      
                      return (
                        <TableRow key={category.id}>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          {comparisonData.map((s, idx) => {
                            const value = s.assumptions?.expenseGrowth?.[category.id];
                            return (
                              <TableCell 
                                key={s.id} 
                                className={`text-center ${getCellHighlight(value, values, false)}`}
                              >
                                {formatPercent(value, { dash: true })}
                              </TableCell>
                            );
                          })}
                          <TableCell className={`text-center font-medium ${spread > 1 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {spread > 0 ? `${spread.toFixed(2)}%` : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Margin Assumptions Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Category</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    {comparisonData.map(s => (
                      <TableHead key={s.id} className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${getCaseColor(s.scenarioType as CaseType)}`} />
                          {s.name}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {['fuel', 'ship_store'].map(marginKey => {
                    const marginName = marginKey === 'fuel' ? 'Fuel' : 'Ship Store';
                    return (
                      <>
                        <TableRow key={`${marginKey}-historical`}>
                          <TableCell className="font-medium" rowSpan={2}>{marginName}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">Historical</TableCell>
                          {comparisonData.map(s => {
                            const value = s.assumptions?.margins?.[marginKey]?.historical;
                            const allValues = comparisonData.map(sc => sc.assumptions?.margins?.[marginKey]?.historical);
                            return (
                              <TableCell 
                                key={s.id} 
                                className={`text-center ${getCellHighlight(value, allValues, true)}`}
                              >
                                {formatPercent(value, { dash: true })}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        <TableRow key={`${marginKey}-projected`}>
                          <TableCell className="text-center text-sm text-muted-foreground">Projected</TableCell>
                          {comparisonData.map(s => {
                            const value = s.assumptions?.margins?.[marginKey]?.projected;
                            const allValues = comparisonData.map(sc => sc.assumptions?.margins?.[marginKey]?.projected);
                            return (
                              <TableCell 
                                key={s.id} 
                                className={`text-center ${getCellHighlight(value, allValues, true)}`}
                              >
                                {formatPercent(value, { dash: true })}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedScenarios.length < 2 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <GitCompare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select Scenarios to Compare</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Choose at least 2 scenarios from the cards above to view a detailed side-by-side comparison 
              of growth assumptions, expense projections, and key metrics.
            </p>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
