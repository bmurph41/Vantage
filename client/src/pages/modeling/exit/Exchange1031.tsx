import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCcw, ChevronRight, Download, Calendar, AlertCircle, CheckCircle, Plus, Trash2, Building, DollarSign, FileText, Clock, PieChart } from "lucide-react";
import type { ModelingProject } from "@shared/schema";
import { useExitStrategiesStore } from "@/stores/exitStrategiesStore";
import { runExitScenario } from "@shared/exit/exit-scenario-engine";
import type { ExitScenarioInput, ExitScenarioResult } from "@shared/exit/exit-scenario-engine";
import { ExchangeBreakdownPanel } from "@/components/exit-strategies/BreakdownCards";
import { ExitProForma, buildExitProFormaRows } from "@/components/exit-strategies/ExitProForma";

interface Exchange1031Props {
  projectId: string;
}

interface ReplacementProperty {
  id: string;
  name: string;
  address: string;
  value: number;
  newDebt: number;
  propertyType: string;
  status: 'identified' | 'under_contract' | 'closed' | 'dropped';
}

interface ExchangeMilestone {
  id: string;
  name: string;
  dueDate: Date;
  completedDate?: Date;
  status: 'pending' | 'completed' | 'overdue';
  notes?: string;
}

export default function Exit1031Exchange({ projectId }: Exchange1031Props) {
  const [, setLocation] = useLocation();
  const { masterInputs, setMode, hydrateFromProject } = useExitStrategiesStore();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  useEffect(() => {
    if (project) {
      setMode({ type: 'project-linked', projectId });
      hydrateFromProject({
        purchasePrice: project.purchasePrice,
      }, projectId);
    }
  }, [project, projectId, setMode, hydrateFromProject]);

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [exchangeOnlyInputs, setExchangeOnlyInputs] = useState({
    replacementValue: 12000000,
    replacementDebt: 7000000,
    daysIdentified: 35,
    daysClosed: 120,
    qiFees: 2500,
    legalFees: 15000,
    titleAndEscrow: 12000,
    inspectionFees: 5000,
  });

  const inputs = {
    relinquishedValue: masterInputs.salePrice,
    relinquishedBasis: masterInputs.costBasis,
    accumulatedDepreciation: masterInputs.depreciationTaken,
    existingDebt: masterInputs.currentDebtBalance,
    closingCosts: masterInputs.closingCosts,
    ...exchangeOnlyInputs,
  };

  const setInputs = (updater: any) => {
    if (typeof updater === 'function') {
      const result = updater(inputs);
      const { relinquishedValue, relinquishedBasis, accumulatedDepreciation, existingDebt, closingCosts, ...rest } = result;
      setExchangeOnlyInputs(rest);
    } else {
      const { relinquishedValue, relinquishedBasis, accumulatedDepreciation, existingDebt, closingCosts, ...rest } = updater;
      setExchangeOnlyInputs(rest);
    }
  };

  const [replacementProperties, setReplacementProperties] = useState<ReplacementProperty[]>([
    { id: '1', name: 'Marina Bay Harbor', address: '123 Harbor Way, FL', value: 6000000, newDebt: 3500000, propertyType: 'marina', status: 'identified' },
    { id: '2', name: 'Sunset Cove Marina', address: '456 Ocean Dr, FL', value: 4000000, newDebt: 2500000, propertyType: 'marina', status: 'identified' },
    { id: '3', name: 'Coastal Yacht Club', address: '789 Beach Rd, FL', value: 5500000, newDebt: 3000000, propertyType: 'marina', status: 'under_contract' },
  ]);

  const [milestones, setMilestones] = useState<ExchangeMilestone[]>([
    { id: '1', name: 'Relinquished Property Sold', dueDate: new Date('2026-01-01'), completedDate: new Date('2026-01-01'), status: 'completed' },
    { id: '2', name: 'QI Engagement', dueDate: new Date('2026-01-05'), completedDate: new Date('2026-01-03'), status: 'completed' },
    { id: '3', name: 'Identification Deadline (45 days)', dueDate: new Date('2026-02-15'), status: 'pending' },
    { id: '4', name: 'Due Diligence Complete', dueDate: new Date('2026-03-01'), status: 'pending' },
    { id: '5', name: 'Financing Secured', dueDate: new Date('2026-05-01'), status: 'pending' },
    { id: '6', name: 'Closing Deadline (180 days)', dueDate: new Date('2026-06-30'), status: 'pending' },
  ]);

  const [opAssumptions, setOpAssumptions] = useState({
    monthlyNOI: 100000,
    noiGrowthRate: 3,
    monthlyDebtService: 40000,
  });

  const adjustedBasis = inputs.relinquishedBasis - inputs.accumulatedDepreciation;
  const relinquishedEquity = inputs.relinquishedValue - inputs.existingDebt;
  
  const totalReplacementValue = replacementProperties.reduce((sum, p) => sum + p.value, 0);
  const totalReplacementDebt = replacementProperties.reduce((sum, p) => sum + p.newDebt, 0);
  const replacementEquity = totalReplacementValue - totalReplacementDebt;
  
  const bootCash = Math.max(0, relinquishedEquity - replacementEquity);
  const bootDebt = Math.max(0, inputs.existingDebt - totalReplacementDebt);
  const totalBoot = bootCash + bootDebt;
  
  const totalExchangeCosts = inputs.qiFees + inputs.legalFees + inputs.titleAndEscrow + inputs.inspectionFees;
  
  const deferredGain = inputs.relinquishedValue - adjustedBasis - totalBoot;
  const taxableGain = totalBoot;
  
  const newBasis = adjustedBasis + (replacementEquity - relinquishedEquity);
  
  const id45Progress = Math.min(100, (inputs.daysIdentified / 45) * 100);
  const id180Progress = Math.min(100, (inputs.daysClosed / 180) * 100);

  const identifiedCount = replacementProperties.filter(p => p.status !== 'dropped').length;
  const uses200Percent = identifiedCount <= 3;
  const totalIdentifiedValue = replacementProperties.filter(p => p.status !== 'dropped').reduce((sum, p) => sum + p.value, 0);
  const uses200PercentValue = totalIdentifiedValue <= inputs.relinquishedValue * 2;

  // ── Engine-computed breakdowns ────────────────────────────────────────────
  const engineResult = useMemo<ExitScenarioResult | null>(() => {
    try {
      // Derive land/improvement split from cost basis (80/20 is typical commercial)
      const costBasis = masterInputs.costBasis;
      const landValue = Math.round(costBasis * 0.20);
      const improvementValue = costBasis - landValue;

      const engineInput: ExitScenarioInput = {
        scenarioName: '1031 Exchange',
        scenarioType: 'exchange_1031',
        property: {
          purchasePrice: costBasis,
          acquisitionCosts: 0,
          landValue,
          improvementValue,
          depreciationScheduleYears: 39,
          holdingPeriodYears: masterInputs.holdingPeriod,
          capitalAdditionsByYear: masterInputs.capitalImprovements > 0
            ? { 1: masterInputs.capitalImprovements }
            : undefined,
        },
        sale: {
          salePrice: masterInputs.salePrice,
          brokerCommissionRate: masterInputs.brokerFeePercent / 100,
          closingCosts: masterInputs.closingCosts,
          holdingPeriodMonths: masterInputs.holdingPeriod * 12,
        },
        debt: {
          outstandingBalance: masterInputs.currentDebtBalance,
          prepaymentPenalty: 0,
        },
        taxProfile: {
          filingStatus: 'married',
          otherOrdinaryIncome: 200000,
          otherInvestmentIncome: 0,
          stateOfResidence: 'FL',
          taxYear: 2025,
        },
        exchange1031: {
          saleDate: new Date().toISOString().slice(0, 10),
          replacementProperties: replacementProperties
            .filter(p => p.status !== 'dropped')
            .map(p => ({
              name: p.name || 'Replacement Property',
              purchasePrice: p.value,
              newMortgage: p.newDebt,
              closingCosts: 0,
              identificationPriority: 'primary' as const,
            })),
          qualifiedIntermediaryFee: exchangeOnlyInputs.qiFees,
          additionalCashInvested: 0,
        },
      };

      return runExitScenario(engineInput);
    } catch (e) {
      console.warn('Engine computation failed:', e);
      return null;
    }
  }, [masterInputs, replacementProperties, exchangeOnlyInputs.qiFees]);

  const proFormaConfig = useMemo(() => {
    const taxOnBoot = taxableGain * ((masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100);
    const { rows, lineItems } = buildExitProFormaRows({
      holdPeriodYears: masterInputs.holdingPeriod,
      monthlyNOI: opAssumptions.monthlyNOI,
      noiGrowthRate: opAssumptions.noiGrowthRate,
      monthlyDebtService: opAssumptions.monthlyDebtService,
      exitProceeds: inputs.relinquishedValue,
      exitCosts: totalExchangeCosts + inputs.closingCosts,
      exitTax: taxOnBoot,
      debtPayoff: inputs.existingDebt,
      strategySpecificExit: {
        "Tax Deferred": deferredGain > 0 ? deferredGain * ((masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100) : 0,
      },
    });

    const totalCF = rows.reduce((s, r) => s + (r.values["Total Cash Flow"] || 0), 0);

    return {
      strategyName: "1031 Exchange",
      holdPeriodYears: masterInputs.holdingPeriod,
      lineItems,
      rows,
      summaryMetrics: [
        { label: "Total Cash Flow", value: `$${Math.round(totalCF).toLocaleString()}` },
        { label: "Deferred Gain", value: `$${Math.round(deferredGain).toLocaleString()}` },
        { label: "Boot Taxable", value: `$${Math.round(totalBoot).toLocaleString()}` },
        { label: "Tax Savings", value: `$${Math.round(deferredGain * ((masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100)).toLocaleString()}`, deltaDirection: "up" as const, delta: "vs cash sale" },
      ],
    };
  }, [inputs, masterInputs, opAssumptions, totalExchangeCosts, taxableGain, deferredGain, totalBoot]);

  const addReplacementProperty = () => {
    setReplacementProperties([...replacementProperties, {
      id: Date.now().toString(),
      name: '',
      address: '',
      value: 0,
      newDebt: 0,
      propertyType: 'marina',
      status: 'identified'
    }]);
  };

  const removeReplacementProperty = (id: string) => {
    setReplacementProperties(replacementProperties.filter(p => p.id !== id));
  };

  const updateReplacementProperty = (id: string, updates: Partial<ReplacementProperty>) => {
    setReplacementProperties(replacementProperties.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy Suite
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">1031 Exchange</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="exchange-title">1031 Exchange Planner</h1>
          <p className="text-muted-foreground mt-1">
            Like-kind exchange analysis and timeline tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategies
          </Button>
          <Button variant="outline" data-testid="btn-export-exchange">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">45-Day ID</p>
                  <p className="text-xl font-bold">{inputs.daysIdentified} / 45</p>
                </div>
              </div>
              {inputs.daysIdentified <= 45 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
            <Progress value={id45Progress} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">180-Day Close</p>
                  <p className="text-xl font-bold">{inputs.daysClosed} / 180</p>
                </div>
              </div>
              {inputs.daysClosed <= 180 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
            <Progress value={id180Progress} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Properties ID'd</p>
                <p className="text-xl font-bold">{identifiedCount}</p>
              </div>
            </div>
            <div className="mt-2">
              {uses200Percent ? (
                <Badge variant="outline" className="text-green-600 border-green-600">3-Property Rule</Badge>
              ) : uses200PercentValue ? (
                <Badge variant="outline" className="text-blue-600 border-blue-600">200% Rule</Badge>
              ) : (
                <Badge variant="destructive">95% Rule Required</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Deferred Gain</p>
                <p className="text-xl font-bold text-green-600">${(deferredGain / 1000000).toFixed(2)}M</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Boot: ${totalBoot.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="properties" className="space-y-4">
        <TabsList>
          <TabsTrigger value="properties" className="gap-2">
            <Building className="h-4 w-4" />
            Replacement Properties
          </TabsTrigger>
          <TabsTrigger value="exchange" className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Exchange Analysis
          </TabsTrigger>
          <TabsTrigger value="costs" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Costs & Fees
          </TabsTrigger>
          <TabsTrigger value="milestones" className="gap-2">
            <Clock className="h-4 w-4" />
            Milestones
          </TabsTrigger>
          <TabsTrigger value="breakdowns" className="gap-2">
            <PieChart className="h-4 w-4" />
            Breakdowns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Replacement Property Candidates</CardTitle>
                  <CardDescription>Identify up to 3 properties (or use 200% rule for more)</CardDescription>
                </div>
                <Button onClick={addReplacementProperty} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">New Debt</TableHead>
                    <TableHead className="text-right">Equity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {replacementProperties.map(property => (
                    <TableRow key={property.id}>
                      <TableCell>
                        <Input
                          value={property.name}
                          onChange={(e) => updateReplacementProperty(property.id, { name: e.target.value })}
                          placeholder="Property name"
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={property.address}
                          onChange={(e) => updateReplacementProperty(property.id, { address: e.target.value })}
                          placeholder="Address"
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={property.value}
                          onChange={(e) => updateReplacementProperty(property.id, { value: Number(e.target.value) })}
                          className="w-28 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={property.newDebt}
                          onChange={(e) => updateReplacementProperty(property.id, { newDebt: Number(e.target.value) })}
                          className="w-28 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${(property.value - property.newDebt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={property.status}
                          onValueChange={(value) => updateReplacementProperty(property.id, { status: value as ReplacementProperty['status'] })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="identified">Identified</SelectItem>
                            <SelectItem value="under_contract">Under Contract</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="dropped">Dropped</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeReplacementProperty(property.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Replacement Value</p>
                    <p className="font-bold text-lg">${totalReplacementValue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total New Debt</p>
                    <p className="font-bold text-lg">${totalReplacementDebt.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Equity Required</p>
                    <p className="font-bold text-lg">${replacementEquity.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exchange">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCcw className="h-5 w-5" />
                  Exchange Inputs
                </CardTitle>
                <CardDescription>Enter property values and debt information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <h4 className="font-medium text-sm">Relinquished Property (Sold)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="relinquishedValue">Sale Price ($)</Label>
                    <Input
                      id="relinquishedValue"
                      type="number"
                      value={inputs.relinquishedValue}
                      onChange={(e) => setInputs({ ...inputs, relinquishedValue: Number(e.target.value) })}
                      data-testid="input-relinquished-value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="existingDebt">Existing Debt ($)</Label>
                    <Input
                      id="existingDebt"
                      type="number"
                      value={inputs.existingDebt}
                      onChange={(e) => setInputs({ ...inputs, existingDebt: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relinquishedBasis">Original Basis ($)</Label>
                    <Input
                      id="relinquishedBasis"
                      type="number"
                      value={inputs.relinquishedBasis}
                      onChange={(e) => setInputs({ ...inputs, relinquishedBasis: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accumulatedDepreciation">Accumulated Depreciation ($)</Label>
                    <Input
                      id="accumulatedDepreciation"
                      type="number"
                      value={inputs.accumulatedDepreciation}
                      onChange={(e) => setInputs({ ...inputs, accumulatedDepreciation: Number(e.target.value) })}
                    />
                  </div>
                </div>
                
                <Separator />
                <h4 className="font-medium text-sm">Timeline</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daysIdentified">Days to Identification</Label>
                    <Input
                      id="daysIdentified"
                      type="number"
                      value={inputs.daysIdentified}
                      onChange={(e) => setInputs({ ...inputs, daysIdentified: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daysClosed">Days to Closing</Label>
                    <Input
                      id="daysClosed"
                      type="number"
                      value={inputs.daysClosed}
                      onChange={(e) => setInputs({ ...inputs, daysClosed: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exchange Analysis</CardTitle>
                <CardDescription>Boot calculation and tax deferral analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Equity Comparison</h4>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Relinquished Equity</span>
                    <span className="font-medium">${relinquishedEquity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Replacement Equity</span>
                    <span className="font-medium">${replacementEquity.toLocaleString()}</span>
                  </div>
                  <Separator />
                  
                  <h4 className="font-medium text-sm">Boot Analysis</h4>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cash Boot</span>
                    <span className={`font-medium ${bootCash > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      ${bootCash.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mortgage Boot</span>
                    <span className={`font-medium ${bootDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      ${bootDebt.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Boot (Taxable)</span>
                    <span className={`font-bold ${totalBoot > 0 ? 'text-red-500' : 'text-green-500'}`} data-testid="text-total-boot">
                      ${totalBoot.toLocaleString()}
                    </span>
                  </div>
                  <Separator />
                  
                  <h4 className="font-medium text-sm">Gain Analysis</h4>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Realized Gain</span>
                    <span className="font-medium">${(inputs.relinquishedValue - adjustedBasis).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deferred Gain</span>
                    <span className="font-medium text-green-600">${deferredGain.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recognized Gain (Taxable)</span>
                    <span className="font-medium text-red-500">${taxableGain.toLocaleString()}</span>
                  </div>
                  <Separator />
                  
                  <div className="flex justify-between">
                    <span className="font-semibold">New Basis in Replacement</span>
                    <span className="font-bold" data-testid="text-new-basis">
                      ${newBasis.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Exchange Status</h4>
                  <div className="flex flex-wrap gap-2">
                    {totalBoot === 0 ? (
                      <Badge variant="default" className="bg-green-500">Full Tax Deferral</Badge>
                    ) : (
                      <Badge variant="destructive">Partial Tax Deferral</Badge>
                    )}
                    {inputs.daysIdentified <= 45 && inputs.daysClosed <= 180 ? (
                      <Badge variant="default" className="bg-green-500">Timeline Compliant</Badge>
                    ) : (
                      <Badge variant="destructive">Timeline Issues</Badge>
                    )}
                    {totalReplacementValue >= inputs.relinquishedValue ? (
                      <Badge variant="outline">Trading Up</Badge>
                    ) : (
                      <Badge variant="outline">Trading Down</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="costs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Exchange Costs & Fees
              </CardTitle>
              <CardDescription>Qualified Intermediary and transaction costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">QI & Professional Fees</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="qiFees">Qualified Intermediary Fee ($)</Label>
                      <Input
                        id="qiFees"
                        type="number"
                        value={inputs.qiFees}
                        onChange={(e) => setInputs({ ...inputs, qiFees: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="legalFees">Legal Fees ($)</Label>
                      <Input
                        id="legalFees"
                        type="number"
                        value={inputs.legalFees}
                        onChange={(e) => setInputs({ ...inputs, legalFees: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Transaction Costs</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="titleAndEscrow">Title & Escrow ($)</Label>
                      <Input
                        id="titleAndEscrow"
                        type="number"
                        value={inputs.titleAndEscrow}
                        onChange={(e) => setInputs({ ...inputs, titleAndEscrow: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inspectionFees">Inspection Fees ($)</Label>
                      <Input
                        id="inspectionFees"
                        type="number"
                        value={inputs.inspectionFees}
                        onChange={(e) => setInputs({ ...inputs, inspectionFees: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Exchange Costs</span>
                  <span className="text-xl font-bold">${totalExchangeCosts.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Exchange Milestones
              </CardTitle>
              <CardDescription>Track critical 1031 exchange deadlines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {milestones.map((milestone, index) => (
                  <div key={milestone.id} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0">
                      {milestone.status === 'completed' ? (
                        <CheckCircle className="h-6 w-6 text-green-500" />
                      ) : milestone.status === 'overdue' ? (
                        <AlertCircle className="h-6 w-6 text-red-500" />
                      ) : (
                        <div className="h-6 w-6 rounded-full border-2 border-muted-foreground flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{milestone.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Due: {milestone.dueDate.toLocaleDateString()}
                        {milestone.completedDate && (
                          <span className="text-green-600 ml-2">
                            Completed: {milestone.completedDate.toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant={milestone.status === 'completed' ? 'default' : milestone.status === 'overdue' ? 'destructive' : 'outline'}
                    >
                      {milestone.status === 'completed' ? 'Complete' : milestone.status === 'overdue' ? 'Overdue' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdowns" className="space-y-6">
          {engineResult ? (
            <ExchangeBreakdownPanel
              closingCosts={engineResult.closingCostsBreakdown}
              gainBreakdown={engineResult.gainBreakdown}
              taxDeferredBreakdown={engineResult.taxDeferredBreakdown}
              grossSalePrice={engineResult.grossSaleProceeds}
              deferredGain={engineResult.comparisonMetrics.deferredGain}
              isFullyDeferred={engineResult.exchange1031Result?.isFullyDeferred ?? false}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Enter sale and replacement property details to see detailed breakdowns.
                </p>
              </CardContent>
            </Card>
          )}

          {engineResult && engineResult.warnings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Engine Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {engineResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Badge variant={w.severity === 'error' ? 'destructive' : w.severity === 'warning' ? 'outline' : 'secondary'} className="text-xs shrink-0 mt-0.5">
                        {w.severity}
                      </Badge>
                      <span className="text-muted-foreground">{w.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Operating Assumptions</CardTitle>
          <CardDescription>Inputs for the monthly pro forma projection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Monthly NOI ($)</Label>
              <Input type="number" value={opAssumptions.monthlyNOI} onChange={(e) => setOpAssumptions({ ...opAssumptions, monthlyNOI: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>NOI Growth Rate (%)</Label>
              <Input type="number" step="0.1" value={opAssumptions.noiGrowthRate} onChange={(e) => setOpAssumptions({ ...opAssumptions, noiGrowthRate: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Monthly Debt Service ($)</Label>
              <Input type="number" value={opAssumptions.monthlyDebtService} onChange={(e) => setOpAssumptions({ ...opAssumptions, monthlyDebtService: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <ExitProForma config={proFormaConfig} />
    </div>
  );
}
