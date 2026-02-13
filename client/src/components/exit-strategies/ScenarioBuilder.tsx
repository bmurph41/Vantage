import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Play, 
  Download, 
  AlertTriangle, 
  Info, 
  AlertCircle,
  CheckCircle2,
  Shield,
  ChevronDown,
  ChevronUp,
  FileJson
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/utils";
import { 
  runExitScenario, 
  exportScenarioToJson,
  type ExitScenarioInput, 
  type ExitScenarioResult,
  type ScenarioWarning
} from "@shared/exit/exit-scenario-engine";

interface ScenarioBuilderProps {
  scenarioInput: ExitScenarioInput;
  onResultChange?: (result: ExitScenarioResult) => void;
}

export function ScenarioBuilder({ scenarioInput, onResultChange }: ScenarioBuilderProps) {
  const [result, setResult] = useState<ExitScenarioResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);

  const handleRunScenario = () => {
    setIsRunning(true);
    try {
      const scenarioResult = runExitScenario(scenarioInput);
      setResult(scenarioResult);
      onResultChange?.(scenarioResult);
    } catch (err) {
      console.error('Scenario engine error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportJson = () => {
    if (!result) return;
    const json = exportScenarioToJson(result);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exit-scenario-${result.scenarioName.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const warningsBySource = useMemo(() => {
    if (!result) return {};
    const groups: Record<string, ScenarioWarning[]> = {};
    for (const w of result.warnings) {
      if (!groups[w.source]) groups[w.source] = [];
      groups[w.source].push(w);
    }
    return groups;
  }, [result]);

  const errorCount = result?.warnings.filter(w => w.severity === 'error').length || 0;
  const warningCount = result?.warnings.filter(w => w.severity === 'warning').length || 0;
  const infoCount = result?.warnings.filter(w => w.severity === 'info').length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{scenarioInput.scenarioName}</h3>
          <p className="text-sm text-muted-foreground capitalize">{scenarioInput.scenarioType.replace(/_/g, ' ')} Strategy</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRunScenario} disabled={isRunning} className="gap-2">
            <Play className="h-4 w-4" />
            {isRunning ? 'Running...' : 'Run Scenario'}
          </Button>
          {result && (
            <Button variant="outline" onClick={handleExportJson} className="gap-2">
              <FileJson className="h-4 w-4" />
              Export JSON
            </Button>
          )}
        </div>
      </div>

      <Alert variant="default" className="border-amber-200 bg-amber-50/50">
        <Shield className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-amber-800">
          This analysis is for informational purposes only and does not constitute tax, legal, or financial advice. 
          Consult qualified professionals before making investment decisions.
        </AlertDescription>
      </Alert>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard 
              label="After-Tax Proceeds" 
              value={formatCurrency(String(Math.round(result.afterTaxEquityProceeds)))} 
              color="text-green-600"
            />
            <MetricCard 
              label="Effective Tax Rate" 
              value={`${(result.taxResult.effectiveTaxRate * 100).toFixed(1)}%`} 
              color="text-red-600"
            />
            <MetricCard 
              label="IRR" 
              value={result.returns.irr ? `${(result.returns.irr * 100).toFixed(1)}%` : 'N/A'} 
              color="text-blue-600"
            />
            <MetricCard 
              label="MOIC" 
              value={`${result.returns.moic.toFixed(2)}x`} 
              color="text-purple-600"
            />
          </div>

          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="tax">Tax Detail</TabsTrigger>
              <TabsTrigger value="warnings" className="gap-1">
                Warnings
                {(errorCount + warningCount) > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1 text-[10px]">
                    {errorCount + warningCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Proceeds Waterfall</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <Row label="Gross Sale Price" value={result.grossSaleProceeds} />
                    <Row label="Costs of Sale" value={-result.costsOfSale} negative />
                    <Row label="Net Sale Proceeds" value={result.netSaleProceeds} bold />
                    <Row label="Debt Payoff" value={-result.debtPayoff} negative />
                    {result.prepaymentPenalty > 0 && (
                      <Row label="Prepayment Penalty" value={-result.prepaymentPenalty} negative />
                    )}
                    <Row label="Before-Tax Equity" value={result.beforeTaxEquityProceeds} bold />
                    <Row label="Total Tax Liability" value={-result.taxResult.totalTaxLiability} negative />
                    <div className="border-t pt-2 mt-2">
                      <Row label="After-Tax Equity Proceeds" value={result.afterTaxEquityProceeds} bold highlight />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {result.refinanceSummary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Refinance Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {result.refinanceSummary.events.map((evt, i) => (
                        <Row key={i} label={`Year ${evt.year} Refi Cash-Out`} value={evt.netCashOut} />
                      ))}
                      <div className="border-t pt-2 mt-2">
                        <Row label="Total Cash-Out (Tax-Free)" value={result.refinanceSummary.netCashOut} bold />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Return Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Equity Invested</span>
                      <p className="font-medium">{formatCurrency(String(Math.round(result.returns.totalEquityInvested)))}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Cash Returned</span>
                      <p className="font-medium">{formatCurrency(String(Math.round(result.returns.totalCashReturned)))}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cash-on-Cash</span>
                      <p className="font-medium">{(result.returns.cashOnCash * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Annualized Return</span>
                      <p className="font-medium">{(result.returns.annualizedReturn * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tax" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Gain Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <Row label="Total Gain" value={result.taxResult.gainAllocation.totalGain} bold />
                    {result.taxResult.gainAllocation.recaptureBuckets.map((bucket, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <span className="text-muted-foreground text-xs">{bucket.label} ({bucket.irsSection})</span>
                        <div className="text-right">
                          <span className="font-medium">{formatCurrency(String(Math.round(bucket.amount)))}</span>
                          <span className="text-muted-foreground ml-2 text-xs">@ {(bucket.rate * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Federal Tax</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <Row label="LTCG Tax" value={result.taxResult.federal.ltcgTax} />
                    <Row label="§1250 Recapture Tax" value={result.taxResult.federal.section1250Tax} />
                    <Row label="§1245 Recapture Tax" value={result.taxResult.federal.section1245Tax} />
                    <Row label={`NIIT (${result.taxResult.federal.niitApplies ? 'Applies' : 'N/A'})`} value={result.taxResult.federal.niitTax} />
                    <div className="border-t pt-2 mt-2">
                      <Row label="Total Federal" value={result.taxResult.federal.totalFederalTax} bold />
                    </div>
                    {result.taxResult.federal.niitApplies && (
                      <div className="bg-blue-50 p-2 rounded text-xs text-blue-700">
                        MAGI: {formatCurrency(String(Math.round(result.taxResult.federal.niitMagi)))} exceeds {formatCurrency(String(Math.round(result.taxResult.federal.niitThreshold)))} threshold
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">State Tax</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <Row 
                      label={`${result.taxResult.dualState.residenceState.state} (Residence)`} 
                      value={result.taxResult.dualState.residenceState.tax} 
                    />
                    {result.taxResult.dualState.propertyState && (
                      <>
                        <Row 
                          label={`${result.taxResult.dualState.propertyState.state} (Property)`} 
                          value={result.taxResult.dualState.propertyState.tax} 
                        />
                        <Row 
                          label="Credit for Property State Tax" 
                          value={-result.taxResult.dualState.creditForPropertyStateTax} 
                          negative 
                        />
                      </>
                    )}
                    <div className="border-t pt-2 mt-2">
                      <Row label="Net State Tax" value={result.taxResult.dualState.netStateTax} bold />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {result.taxResult.installmentSchedule && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Installment Sale Tax Schedule</CardTitle>
                    {result.taxResult.installmentNpvSavings && result.taxResult.installmentNpvSavings > 0 && (
                      <CardDescription className="text-green-600">
                        NPV Tax Savings: {formatCurrency(String(Math.round(result.taxResult.installmentNpvSavings)))}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1">Year</th>
                            <th className="text-right py-1">Principal</th>
                            <th className="text-right py-1">Interest</th>
                            <th className="text-right py-1">Gain</th>
                            <th className="text-right py-1">Tax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.taxResult.installmentSchedule.map((entry, i) => (
                            <tr key={i} className="border-b border-dashed">
                              <td className="py-1">{entry.year}</td>
                              <td className="text-right">{formatCurrency(String(Math.round(entry.principalReceived)))}</td>
                              <td className="text-right">{formatCurrency(String(Math.round(entry.interestReceived)))}</td>
                              <td className="text-right">{formatCurrency(String(Math.round(entry.gainRecognized)))}</td>
                              <td className="text-right">{formatCurrency(String(Math.round(entry.totalTax)))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="warnings" className="space-y-3 mt-3">
              {result.warnings.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No warnings or issues detected.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex gap-2 text-xs">
                    {errorCount > 0 && (
                      <Badge variant="destructive">{errorCount} Error{errorCount > 1 ? 's' : ''}</Badge>
                    )}
                    {warningCount > 0 && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700">{warningCount} Warning{warningCount > 1 ? 's' : ''}</Badge>
                    )}
                    {infoCount > 0 && (
                      <Badge variant="outline" className="border-blue-300 text-blue-700">{infoCount} Info</Badge>
                    )}
                  </div>

                  {Object.entries(warningsBySource).map(([source, warnings]) => (
                    <Card key={source}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm capitalize">{source.replace(/_/g, ' ')}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            {w.severity === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
                            {w.severity === 'warning' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />}
                            {w.severity === 'info' && <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />}
                            <span className="text-muted-foreground">{w.message}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </TabsContent>

            <TabsContent value="audit" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Calculation Audit Trail</CardTitle>
                  <CardDescription className="text-xs">Step-by-step breakdown of all calculations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {result.taxResult.auditTrail.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-dashed last:border-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1">{entry.step}</Badge>
                          <span className="text-muted-foreground">{entry.description}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-medium">
                            {entry.step === 'total' && entry.description === 'Effective Tax Rate'
                              ? `${(entry.value * 100).toFixed(1)}%`
                              : entry.description.includes('Rate')
                                ? `${(entry.value * 100).toFixed(1)}%`
                                : formatCurrency(String(Math.round(entry.value)))
                            }
                          </span>
                          {entry.formula && (
                            <span className="text-muted-foreground ml-2 text-[10px]">({entry.formula})</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold, negative, highlight }: { 
  label: string; 
  value: number; 
  bold?: boolean; 
  negative?: boolean; 
  highlight?: boolean 
}) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${highlight ? 'bg-green-50 px-2 rounded' : ''}`}>
      <span className={`${bold ? 'font-medium' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`font-mono ${bold ? 'font-bold' : ''} ${negative ? 'text-red-600' : ''} ${highlight ? 'text-green-700 font-bold' : ''}`}>
        {formatCurrency(String(Math.round(value)))}
      </span>
    </div>
  );
}
