import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, 
  ChevronRight,
  GitCompare,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download
} from "lucide-react";
import type { ModelingProject, ExitScenario } from "@shared/schema";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { ExportPdfButton } from '@/components/ui/export-pdf-button';

interface ScenarioComparisonProps {
  projectId: string;
}

interface ScenarioMetrics {
  id: string;
  name: string;
  exitYear: number;
  salePrice: number;
  exitCapRate: number;
  netProceeds: number;
  irr: number;
  equityMultiple: number;
  totalProfit: number;
  holdingPeriod: number;
  cashOnCash: number;
  isRecommended?: boolean;
}

function MetricCell({ value, baseline, format = 'currency', highlightBest = true }: {
  value: number;
  baseline: number;
  format?: 'currency' | 'percent' | 'multiple' | 'years';
  highlightBest?: boolean;
}) {
  const isBest = highlightBest && value >= baseline;
  const isWorst = highlightBest && value < baseline * 0.9;
  
  let displayValue = '';
  switch (format) {
    case 'currency':
      displayValue = formatCurrency(value);
      break;
    case 'percent':
      displayValue = formatPercent(value);
      break;
    case 'multiple':
      displayValue = `${value.toFixed(2)}x`;
      break;
    case 'years':
      displayValue = `${value} years`;
      break;
  }

  return (
    <TableCell className={cn(
      "text-right font-medium",
      isBest && "text-green-600 dark:text-green-400",
      isWorst && "text-red-600 dark:text-red-400"
    )}>
      <div className="flex items-center justify-end gap-1">
        {displayValue}
        {isBest && highlightBest && <TrendingUp className="h-3 w-3" />}
        {isWorst && highlightBest && <TrendingDown className="h-3 w-3" />}
      </div>
    </TableCell>
  );
}

export default function ExitScenarioComparison({ projectId }: ScenarioComparisonProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  
  const { data: project, isLoading: projectLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery<ExitScenario[]>({
    queryKey: ['/api/modeling/projects', projectId, 'exit', 'scenarios'],
    enabled: !!projectId,
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const purchasePrice = Number(project?.purchasePrice) || 0;
  const ebitda = Number(project?.ebitda) || 0;

  const scenarioMetrics: ScenarioMetrics[] = scenarios.map((scenario, index) => {
    const salePrice = Number(scenario.projectedSalePrice) || 0;
    const exitCapRate = Number(scenario.exitCapRate) || 6.5;
    const holdingPeriod = scenario.exitYear || 5;
    const netProceeds = salePrice * 0.94;
    const totalProfit = salePrice - purchasePrice;
    
    const equityMultiple = purchasePrice > 0 
      ? (netProceeds + (ebitda * holdingPeriod * 0.3)) / (purchasePrice * 0.35) 
      : 0;
    
    const irr = purchasePrice > 0 && holdingPeriod > 0
      ? ((Math.pow(equityMultiple, 1 / holdingPeriod) - 1) * 100)
      : 0;
    
    const cashOnCash = purchasePrice > 0 
      ? ((ebitda * 0.6) / (purchasePrice * 0.35)) * 100 
      : 0;

    return {
      id: scenario.id,
      name: scenario.name,
      exitYear: holdingPeriod,
      salePrice,
      exitCapRate,
      netProceeds,
      irr: Math.max(0, Math.min(irr, 100)),
      equityMultiple: Math.max(0, equityMultiple),
      totalProfit,
      holdingPeriod,
      cashOnCash: Math.max(0, Math.min(cashOnCash, 50)),
      isRecommended: index === 0,
    };
  });

  const bestIrr = scenarioMetrics.length > 0 ? Math.max(...scenarioMetrics.map(s => s.irr)) : 0;
  const bestMultiple = scenarioMetrics.length > 0 ? Math.max(...scenarioMetrics.map(s => s.equityMultiple)) : 0;
  const bestProceeds = scenarioMetrics.length > 0 ? Math.max(...scenarioMetrics.map(s => s.netProceeds)) : 0;

  if (projectLoading || scenariosLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div ref={pdfRef} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy Suite
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Compare Scenarios</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="comparison-title">Scenario Comparison</h1>
          <p className="text-muted-foreground mt-1">
            Side-by-side analysis of exit strategies for {project?.marinaName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategies
          </Button>
          <Button variant="outline" data-testid="btn-export-comparison">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <ExportPdfButton contentRef={pdfRef} filename="exit-scenario-comparison" title="Exit Scenario Comparison" />
        </div>
      </div>

      {scenarioMetrics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GitCompare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Scenarios to Compare</h3>
            <p className="text-muted-foreground mb-4">
              Create exit scenarios to see a side-by-side comparison
            </p>
            <Button onClick={() => setLocation(`${basePath}/scenarios`)}>
              Create Scenarios
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Percent className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Best IRR</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatPercent(bestIrr)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Best Multiple</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {bestMultiple.toFixed(2)}x
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Best Net Proceeds</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(bestProceeds)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Scenario Analysis Matrix
              </CardTitle>
              <CardDescription>
                Compare key metrics across all exit scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Scenario</TableHead>
                      <TableHead className="text-right">Exit Year</TableHead>
                      <TableHead className="text-right">Sale Price</TableHead>
                      <TableHead className="text-right">Exit Cap</TableHead>
                      <TableHead className="text-right">Net Proceeds</TableHead>
                      <TableHead className="text-right">IRR</TableHead>
                      <TableHead className="text-right">Equity Multiple</TableHead>
                      <TableHead className="text-right">Total Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scenarioMetrics.map((scenario) => (
                      <TableRow 
                        key={scenario.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setLocation(`${basePath}/scenarios/${scenario.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{scenario.name}</span>
                            {scenario.isRecommended && (
                              <Badge variant="default" className="bg-[#1E4FAB]">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Recommended
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">Year {scenario.exitYear}</TableCell>
                        <MetricCell 
                          value={scenario.salePrice} 
                          baseline={Math.max(...scenarioMetrics.map(s => s.salePrice))} 
                          format="currency"
                        />
                        <TableCell className="text-right">{formatPercent(scenario.exitCapRate)}</TableCell>
                        <MetricCell 
                          value={scenario.netProceeds} 
                          baseline={bestProceeds} 
                          format="currency"
                        />
                        <MetricCell 
                          value={scenario.irr} 
                          baseline={bestIrr} 
                          format="percent"
                        />
                        <MetricCell 
                          value={scenario.equityMultiple} 
                          baseline={bestMultiple} 
                          format="multiple"
                        />
                        <MetricCell 
                          value={scenario.totalProfit} 
                          baseline={Math.max(...scenarioMetrics.map(s => s.totalProfit))} 
                          format="currency"
                        />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>IRR Analysis</CardTitle>
                <CardDescription>Internal Rate of Return by scenario</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {scenarioMetrics.sort((a, b) => b.irr - a.irr).map((scenario, index) => (
                    <div key={scenario.id} className="flex items-center gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        index === 0 ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                      )}>
                        #{index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{scenario.name}</span>
                          <span className="font-bold">{formatPercent(scenario.irr)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              index === 0 ? "bg-green-500" : "bg-[#1E4FAB]"
                            )}
                            style={{ width: `${(scenario.irr / bestIrr) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Equity Multiple Analysis</CardTitle>
                <CardDescription>Cash-on-cash return by scenario</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {scenarioMetrics.sort((a, b) => b.equityMultiple - a.equityMultiple).map((scenario, index) => (
                    <div key={scenario.id} className="flex items-center gap-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        index === 0 ? "bg-blue-100 text-blue-600" : "bg-muted text-muted-foreground"
                      )}>
                        #{index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{scenario.name}</span>
                          <span className="font-bold">{scenario.equityMultiple.toFixed(2)}x</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              index === 0 ? "bg-blue-500" : "bg-[#1E4FAB]/60"
                            )}
                            style={{ width: `${(scenario.equityMultiple / bestMultiple) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200">Analysis Note</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    IRR and equity multiple calculations assume steady-state cash flows and are based on projected 
                    exit values. Actual returns may vary based on market conditions, capital improvements, and 
                    operational performance. Consider running sensitivity analysis for a range of outcomes.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
