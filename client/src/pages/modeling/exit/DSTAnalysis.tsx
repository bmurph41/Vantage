import { useState, useMemo, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Landmark, ChevronRight, Download, Plus, Trash2, Building, DollarSign, AlertTriangle, TrendingUp, PieChart, Percent, Calculator, Info, Clock, ArrowRight, Shield, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoTooltip, StrategyOverview } from "@/components/ui/info-tooltip";
import type { ModelingProject } from "@shared/schema";
import { useExitStrategiesStore } from "@/stores/exitStrategiesStore";
import { ExitProForma, type ProFormaCashFlowRow, type ProFormaLineItem } from "@/components/exit-strategies/ExitProForma";

interface DSTAnalysisProps {
  projectId: string;
}

interface DSTOption {
  id: number;
  name: string;
  sponsor: string;
  propertyType: string;
  cashOnCash: number;
  projectedAppreciation: number;
  holdPeriod: number;
  ltv: number;
  allocation: number;
  sponsorFees: {
    upfrontLoad: number;
    acquisitionFee: number;
    assetManagementFee: number;
    dispositionFee: number;
    financingFee: number;
  };
  riskRating: 'low' | 'medium' | 'high';
}

interface FractionalInterest {
  dstId: number;
  ownershipPercent: number;
  investmentAmount: number;
  annualDistribution: number;
  depreciationPassthrough: number;
}

export default function ExitDSTAnalysis({ projectId }: DSTAnalysisProps) {
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

  const investmentAmount = masterInputs.salePrice - masterInputs.currentDebtBalance || 0;
  const exchangeGain = masterInputs.salePrice - masterInputs.costBasis || 0;
  const federalTaxRate = masterInputs.federalTaxRate + 3.8 || 23.8;
  const stateTaxRate = masterInputs.stateTaxRate || 5;
  const [include1031, setInclude1031] = useState(true);
  const [usePortfolioDiversification, setUsePortfolioDiversification] = useState(true);

  const [dstOptions, setDstOptions] = useState<DSTOption[]>([
    { 
      id: 1, 
      name: "Industrial DST Fund I", 
      sponsor: "Harbor Capital",
      propertyType: "industrial",
      cashOnCash: 5.5, 
      projectedAppreciation: 3.0, 
      holdPeriod: 7, 
      ltv: 45,
      allocation: 40,
      sponsorFees: {
        upfrontLoad: 2.5,
        acquisitionFee: 1.5,
        assetManagementFee: 0.75,
        dispositionFee: 2.0,
        financingFee: 0.5
      },
      riskRating: 'medium'
    },
    { 
      id: 2, 
      name: "Multi-Family DST III", 
      sponsor: "Coastal Trust",
      propertyType: "multifamily",
      cashOnCash: 4.8, 
      projectedAppreciation: 4.0, 
      holdPeriod: 10, 
      ltv: 50,
      allocation: 35,
      sponsorFees: {
        upfrontLoad: 3.0,
        acquisitionFee: 2.0,
        assetManagementFee: 1.0,
        dispositionFee: 2.5,
        financingFee: 0.75
      },
      riskRating: 'low'
    },
    { 
      id: 3, 
      name: "Net Lease DST Portfolio", 
      sponsor: "Prime Capital",
      propertyType: "retail",
      cashOnCash: 6.2, 
      projectedAppreciation: 2.0, 
      holdPeriod: 5, 
      ltv: 35,
      allocation: 25,
      sponsorFees: {
        upfrontLoad: 2.0,
        acquisitionFee: 1.0,
        assetManagementFee: 0.5,
        dispositionFee: 1.5,
        financingFee: 0.25
      },
      riskRating: 'low'
    },
  ]);

  const totalAllocation = dstOptions.reduce((sum, dst) => sum + dst.allocation, 0);

  const fractionalInterests = useMemo<FractionalInterest[]>(() => {
    return dstOptions.map(dst => {
      const allocationAmount = investmentAmount * (dst.allocation / 100);
      const annualDistribution = allocationAmount * (dst.cashOnCash / 100);
      const propertyValuePerOwner = dst.ltv < 100 ? allocationAmount / (1 - dst.ltv / 100) : allocationAmount;
      const depreciableValue = propertyValuePerOwner * 0.85;
      const depreciationPassthrough = depreciableValue / 39;
      
      return {
        dstId: dst.id,
        ownershipPercent: investmentAmount > 0 ? (allocationAmount / investmentAmount) * 100 : 0,
        investmentAmount: allocationAmount,
        annualDistribution,
        depreciationPassthrough,
      };
    });
  }, [dstOptions, investmentAmount]);

  const addDstOption = () => {
    const newId = Math.max(...dstOptions.map(d => d.id)) + 1;
    setDstOptions([...dstOptions, {
      id: newId,
      name: `DST Option ${newId}`,
      sponsor: "New Sponsor",
      propertyType: "industrial",
      cashOnCash: 5.0,
      projectedAppreciation: 3.0,
      holdPeriod: 7,
      ltv: 45,
      allocation: 0,
      sponsorFees: {
        upfrontLoad: 2.5,
        acquisitionFee: 1.5,
        assetManagementFee: 0.75,
        dispositionFee: 2.0,
        financingFee: 0.5
      },
      riskRating: 'medium'
    }]);
  };

  const removeDstOption = (id: number) => {
    setDstOptions(dstOptions.filter(d => d.id !== id));
  };

  const updateDstOption = (id: number, updates: Partial<DSTOption>) => {
    setDstOptions(dstOptions.map(d => 
      d.id === id ? { ...d, ...updates } : d
    ));
  };

  const updateSponsorFee = (id: number, feeType: keyof DSTOption['sponsorFees'], value: number) => {
    setDstOptions(dstOptions.map(d => 
      d.id === id ? { 
        ...d, 
        sponsorFees: { ...d.sponsorFees, [feeType]: value }
      } : d
    ));
  };

  const calculateDstReturns = (dst: DSTOption) => {
    const allocationAmount = investmentAmount * (dst.allocation / 100);
    const annualCashFlow = allocationAmount * (dst.cashOnCash / 100);
    const totalCashFlow = annualCashFlow * dst.holdPeriod;
    const appreciationMultiple = Math.pow(1 + dst.projectedAppreciation / 100, dst.holdPeriod);
    const projectedValue = allocationAmount * appreciationMultiple;
    
    const totalFeePercent = dst.sponsorFees.upfrontLoad + 
      dst.sponsorFees.acquisitionFee + 
      (dst.sponsorFees.assetManagementFee * dst.holdPeriod) +
      dst.sponsorFees.dispositionFee +
      dst.sponsorFees.financingFee;
    
    const totalFeeAmount = allocationAmount * (totalFeePercent / 100);
    
    const netReturn = totalCashFlow + projectedValue - allocationAmount - totalFeeAmount;
    const irr = allocationAmount > 0 
      ? ((Math.pow((totalCashFlow + projectedValue - totalFeeAmount) / allocationAmount, 1 / dst.holdPeriod) - 1) * 100)
      : 0;
      
    return { allocationAmount, annualCashFlow, totalCashFlow, projectedValue, totalFeePercent, totalFeeAmount, netReturn, irr };
  };

  const portfolioSummary = useMemo(() => {
    const results = dstOptions.map(dst => calculateDstReturns(dst));
    
    const totalAllocated = results.reduce((sum, r) => sum + r.allocationAmount, 0);
    const totalAnnualCashFlow = results.reduce((sum, r) => sum + r.annualCashFlow, 0);
    const weightedIRR = totalAllocated > 0 
      ? results.reduce((sum, r) => sum + (r.irr * (r.allocationAmount / totalAllocated)), 0)
      : 0;
    const totalFees = results.reduce((sum, r) => sum + r.totalFeeAmount, 0);
    const blendedCashOnCash = totalAllocation > 0
      ? dstOptions.reduce((sum, dst) => sum + (dst.cashOnCash * dst.allocation / 100), 0)
      : 0;
    
    const taxSavings = include1031 ? exchangeGain * ((federalTaxRate + stateTaxRate) / 100) : 0;
    
    return {
      totalAllocated,
      totalAnnualCashFlow,
      weightedIRR,
      totalFees,
      blendedCashOnCash,
      taxSavings,
      unallocated: investmentAmount - totalAllocated,
    };
  }, [dstOptions, investmentAmount, exchangeGain, federalTaxRate, stateTaxRate, include1031, totalAllocation]);

  const proFormaConfig = useMemo(() => {
    const maxHoldPeriod = Math.max(...dstOptions.map(d => d.holdPeriod), 1);
    const totalMonths = maxHoldPeriod * 12;
    const rows: ProFormaCashFlowRow[] = [];

    for (let m = 1; m <= totalMonths; m++) {
      const year = Math.ceil(m / 12);
      const month = ((m - 1) % 12) + 1;
      const values: Record<string, number> = {};

      let totalDistribution = 0;
      for (const dst of dstOptions) {
        const alloc = investmentAmount * (dst.allocation / 100);
        const monthlyDist = alloc * (dst.cashOnCash / 100) / 12;
        const isActive = year <= dst.holdPeriod;
        const dstCF = isActive ? monthlyDist : 0;
        values[dst.name] = dstCF;
        totalDistribution += dstCF;

        if (year === dst.holdPeriod && month === 12) {
          const appreciationMultiple = Math.pow(1 + dst.projectedAppreciation / 100, dst.holdPeriod);
          const exitValue = alloc * appreciationMultiple;
          const totalFeePercent = dst.sponsorFees.dispositionFee;
          const dispositionFee = alloc * (totalFeePercent / 100);
          const netExitProceeds = exitValue - dispositionFee;
          values[`${dst.name} Exit`] = netExitProceeds;
          totalDistribution += netExitProceeds;
        }
      }

      values["Total Distributions"] = totalDistribution;
      rows.push({ period: m, year, month, values, isExitMonth: m === totalMonths });
    }

    const lineItems: ProFormaLineItem[] = [
      ...dstOptions.map(d => ({ label: d.name })),
      ...dstOptions.map(d => ({ label: `${d.name} Exit` })),
      { label: "Total Distributions", isSubtotal: true, isBold: true },
    ];

    const totalCF = rows.reduce((s, r) => s + (r.values["Total Distributions"] || 0), 0);
    const avgMonthlyCF = rows.length > 0 ? totalCF / rows.length : 0;

    return {
      strategyName: "DST Portfolio",
      holdPeriodYears: maxHoldPeriod,
      lineItems,
      rows,
      summaryMetrics: [
        { label: "Total Distributions", value: `$${Math.round(totalCF).toLocaleString()}` },
        { label: "Avg Monthly CF", value: `$${Math.round(avgMonthlyCF).toLocaleString()}` },
        { label: "Annual CF", value: `$${Math.round(portfolioSummary.totalAnnualCashFlow).toLocaleString()}` },
        { label: "Tax Savings", value: `$${Math.round(portfolioSummary.taxSavings).toLocaleString()}`, deltaDirection: "up" as const, delta: "deferred" },
      ],
    };
  }, [dstOptions, investmentAmount, portfolioSummary]);

  const getRiskBadge = (rating: DSTOption['riskRating']) => {
    switch(rating) {
      case 'low': return <Badge variant="outline" className="text-green-600 border-green-600">Low Risk</Badge>;
      case 'medium': return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Medium Risk</Badge>;
      case 'high': return <Badge variant="outline" className="text-red-600 border-red-600">High Risk</Badge>;
    }
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <StrategyOverview
          title="Delaware Statutory Trust (DST) Analysis"
          description="A DST lets you invest 1031 exchange proceeds into professionally managed, institutional-quality real estate without active management responsibilities. You become a beneficial owner of a trust that holds the property."
          bestFor="Investors seeking passive income, those tired of active management, or those who want to diversify across multiple properties and markets with their exchange proceeds."
          keyConsideration="DST interests are illiquid with limited secondary markets. You give up control over property decisions, and the trust has a fixed life (typically 7-10 years)."
          riskLevel="Moderate"
        />
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
                Exit Strategy Suite
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">DST Analysis</span>
            </div>
            <h1 className="text-3xl font-bold" data-testid="dst-title">DST Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Delaware Statutory Trust comparison with sponsor fee analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocation(basePath)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Strategies
            </Button>
            <Button variant="outline" data-testid="btn-export-dst">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Investment</span>
              </div>
              <p className="num text-2xl font-bold">${(investmentAmount / 1000000).toFixed(2)}M</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Annual Income</span>
              </div>
              <p className="num text-2xl font-bold text-green-600">${portfolioSummary.totalAnnualCashFlow.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Percent className="h-4 w-4" />
                <span className="text-sm">Blended Yield</span>
              </div>
              <p className="num text-2xl font-bold">{portfolioSummary.blendedCashOnCash.toFixed(2)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calculator className="h-4 w-4" />
                <span className="text-sm">Tax Savings</span>
              </div>
              <p className="num text-2xl font-bold text-blue-600">${(portfolioSummary.taxSavings / 1000).toFixed(0)}K</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <PieChart className="h-4 w-4" />
                <span className="text-sm">Allocated</span>
              </div>
              <p className="num text-2xl font-bold">{totalAllocation}%</p>
              {totalAllocation !== 100 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {totalAllocation < 100 ? `${100 - totalAllocation}% unallocated` : 'Over-allocated'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="portfolio" className="space-y-4">
          <TabsList>
            <TabsTrigger value="portfolio" className="gap-2">
              <PieChart className="h-4 w-4" />
              Portfolio Allocation
            </TabsTrigger>
            <TabsTrigger value="fees" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Sponsor Fees
            </TabsTrigger>
            <TabsTrigger value="interests" className="gap-2">
              <Building className="h-4 w-4" />
              Fractional Interests
            </TabsTrigger>
            <TabsTrigger value="tax" className="gap-2">
              <Calculator className="h-4 w-4" />
              Tax Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    Investment Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="investmentAmount">Investment Amount ($)</Label>
                    <Input
                      id="investmentAmount"
                      type="number"
                      value={investmentAmount}
                      onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                      data-testid="input-investment-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exchangeGain">1031 Exchange Gain ($)</Label>
                    <Input
                      id="exchangeGain"
                      type="number"
                      value={exchangeGain}
                      onChange={(e) => setExchangeGain(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include1031">Include 1031 Tax Deferral</Label>
                    <Switch
                      id="include1031"
                      checked={include1031}
                      onCheckedChange={setInclude1031}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="diversification">Portfolio Diversification</Label>
                    <Switch
                      id="diversification"
                      checked={usePortfolioDiversification}
                      onCheckedChange={setUsePortfolioDiversification}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>DST Options</CardTitle>
                    <CardDescription>Configure allocation percentages</CardDescription>
                  </div>
                  <Button onClick={addDstOption} size="sm" data-testid="btn-add-dst">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dstOptions.map((dst) => {
                      const returns = calculateDstReturns(dst);
                      return (
                        <div key={dst.id} className="border rounded-lg p-4" data-testid={`dst-option-${dst.id}`}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <Input
                                value={dst.name}
                                onChange={(e) => updateDstOption(dst.id, { name: e.target.value })}
                                className="max-w-xs font-medium"
                              />
                              {getRiskBadge(dst.riskRating)}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeDstOption(dst.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                            <div className="space-y-2">
                              <Label>Allocation (%)</Label>
                              <Input
                                type="number"
                                value={dst.allocation}
                                onChange={(e) => updateDstOption(dst.id, { allocation: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>Cash-on-Cash (%)</Label>
                                <InfoTooltip
                                  content="The annual cash distributions you receive as a percentage of your invested capital. DSTs typically target 4-6% annual distributions."
                                  tip="DST distributions are not guaranteed. They depend on the underlying property's performance and occupancy."
                                />
                              </div>
                              <Input
                                type="number"
                                step="0.1"
                                value={dst.cashOnCash}
                                onChange={(e) => updateDstOption(dst.id, { cashOnCash: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Appreciation (%/yr)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={dst.projectedAppreciation}
                                onChange={(e) => updateDstOption(dst.id, { projectedAppreciation: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Hold Period (yrs)</Label>
                              <Input
                                type="number"
                                value={dst.holdPeriod}
                                onChange={(e) => updateDstOption(dst.id, { holdPeriod: Number(e.target.value) })}
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Label>LTV (%)</Label>
                                <InfoTooltip
                                  content="The ratio of the trust's debt to the property's appraised value. Higher LTV means more leverage and potentially higher returns, but also more risk."
                                  tip="Watch out for DSTs with LTV above 60% — refinancing risk at maturity is significant in rising rate environments."
                                />
                              </div>
                              <Input
                                type="number"
                                value={dst.ltv}
                                onChange={(e) => updateDstOption(dst.id, { ltv: Number(e.target.value) })}
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted p-3 rounded">
                            <div>
                              <p className="text-muted-foreground">Amount Allocated</p>
                              <p className="num font-semibold">${returns.allocationAmount.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Annual Cash Flow</p>
                              <p className="num font-semibold text-green-600">${returns.annualCashFlow.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Fees</p>
                              <p className="num font-semibold text-red-500">${returns.totalFeeAmount.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Net IRR</p>
                              <p className="num font-semibold text-blue-600">{returns.irr.toFixed(2)}%</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fees">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Sponsor Fee Analysis
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>DST sponsors charge various fees that impact investor returns. Understanding the full fee stack is critical for comparing DST options.</p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <CardDescription>Compare sponsor fee structures across DST options</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DST Name</TableHead>
                      <TableHead className="text-right">Upfront Load</TableHead>
                      <TableHead className="text-right">Acquisition Fee</TableHead>
                      <TableHead className="text-right">Asset Mgmt Fee</TableHead>
                      <TableHead className="text-right">Disposition Fee</TableHead>
                      <TableHead className="text-right">Financing Fee</TableHead>
                      <TableHead className="text-right">Total Fees</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dstOptions.map(dst => {
                      const totalFees = dst.sponsorFees.upfrontLoad + 
                        dst.sponsorFees.acquisitionFee + 
                        (dst.sponsorFees.assetManagementFee * dst.holdPeriod) +
                        dst.sponsorFees.dispositionFee +
                        dst.sponsorFees.financingFee;
                      
                      return (
                        <TableRow key={dst.id}>
                          <TableCell className="font-medium">{dst.name}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.1"
                              value={dst.sponsorFees.upfrontLoad}
                              onChange={(e) => updateSponsorFee(dst.id, 'upfrontLoad', Number(e.target.value))}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.1"
                              value={dst.sponsorFees.acquisitionFee}
                              onChange={(e) => updateSponsorFee(dst.id, 'acquisitionFee', Number(e.target.value))}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.1"
                              value={dst.sponsorFees.assetManagementFee}
                              onChange={(e) => updateSponsorFee(dst.id, 'assetManagementFee', Number(e.target.value))}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.1"
                              value={dst.sponsorFees.dispositionFee}
                              onChange={(e) => updateSponsorFee(dst.id, 'dispositionFee', Number(e.target.value))}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.1"
                              value={dst.sponsorFees.financingFee}
                              onChange={(e) => updateSponsorFee(dst.id, 'financingFee', Number(e.target.value))}
                              className="w-20 text-right"
                            />
                          </TableCell>
                          <TableCell className="num text-right font-bold text-red-500">
                            {totalFees.toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Fees (All DSTs)</p>
                      <p className="num text-xl font-bold text-red-500">${portfolioSummary.totalFees.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Fees as % of Investment</p>
                      <p className="num text-xl font-bold">{((portfolioSummary.totalFees / investmentAmount) * 100).toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Net Investment After Fees</p>
                      <p className="num text-xl font-bold">${(investmentAmount - portfolioSummary.totalFees).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interests">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Fractional Interest Details
                </CardTitle>
                <CardDescription>Your ownership position in each DST property</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DST Name</TableHead>
                      <TableHead className="text-right">Investment</TableHead>
                      <TableHead className="text-right">Ownership %</TableHead>
                      <TableHead className="text-right flex items-center justify-end gap-2">
                        <span>Annual Distribution</span>
                        <InfoTooltip
                          content="The annual cash distributions you receive as a percentage of your invested capital. DSTs typically target 4-6% annual distributions."
                          tip="DST distributions are not guaranteed. They depend on the underlying property's performance and occupancy."
                        />
                      </TableHead>
                      <TableHead className="text-right">Depreciation Pass-through</TableHead>
                      <TableHead className="text-right">Tax-Sheltered Income</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fractionalInterests.map(interest => {
                      const dst = dstOptions.find(d => d.id === interest.dstId);
                      if (!dst) return null;
                      
                      const taxShelteredIncome = Math.min(interest.annualDistribution, interest.depreciationPassthrough);
                      
                      return (
                        <TableRow key={interest.dstId}>
                          <TableCell className="font-medium">{dst.name}</TableCell>
                          <TableCell className="num text-right">${interest.investmentAmount.toLocaleString()}</TableCell>
                          <TableCell className="num text-right">{interest.ownershipPercent.toFixed(4)}%</TableCell>
                          <TableCell className="num text-right text-green-600">${interest.annualDistribution.toLocaleString()}</TableCell>
                          <TableCell className="num text-right">${interest.depreciationPassthrough.toLocaleString()}</TableCell>
                          <TableCell className="num text-right text-blue-600">${taxShelteredIncome.toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Annual Distributions</p>
                    <p className="num text-xl font-bold text-green-600">
                      ${fractionalInterests.reduce((sum, i) => sum + i.annualDistribution, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Depreciation Pass-through</p>
                    <p className="num text-xl font-bold">
                      ${fractionalInterests.reduce((sum, i) => sum + i.depreciationPassthrough, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Effective Tax-Sheltered</p>
                    <p className="num text-xl font-bold text-blue-600">
                      ${fractionalInterests.reduce((sum, i) => sum + Math.min(i.annualDistribution, i.depreciationPassthrough), 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tax Rate Assumptions</CardTitle>
                  <CardDescription>Configure tax rates for deferral analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Federal Capital Gains + NIIT</Label>
                        <span className="font-medium">{federalTaxRate}%</span>
                      </div>
                      <Slider
                        value={[federalTaxRate]}
                        onValueChange={([value]) => setFederalTaxRate(value)}
                        min={0}
                        max={40}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>State Capital Gains Tax</Label>
                        <span className="font-medium">{stateTaxRate}%</span>
                      </div>
                      <Slider
                        value={[stateTaxRate]}
                        onValueChange={([value]) => setStateTaxRate(value)}
                        min={0}
                        max={15}
                        step={0.1}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Combined Tax Rate</span>
                      <span className="num font-bold">{(federalTaxRate + stateTaxRate).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Exchange Gain Being Deferred</span>
                      <span className="num font-medium">${exchangeGain.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tax Deferral Summary</CardTitle>
                  <CardDescription>1031 exchange tax savings analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <span>Federal Tax Avoided</span>
                      <span className="num font-bold text-green-600">${(exchangeGain * federalTaxRate / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <span>State Tax Avoided</span>
                      <span className="num font-bold text-green-600">${(exchangeGain * stateTaxRate / 100).toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <span className="font-semibold">Total Tax Savings</span>
                      <span className="num font-bold text-xl text-blue-600">${portfolioSummary.taxSavings.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Important Considerations
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Tax deferral is not tax elimination - gain is deferred to future sale</li>
                      <li>DST interests may have limited liquidity</li>
                      <li>Sponsor fees reduce effective investment amount</li>
                      <li>Consult tax advisor for personalized analysis</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        <ExitProForma config={proFormaConfig} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <div className="flex items-center gap-2">
                <span>Secondary Market</span>
                <InfoTooltip
                  content="DST interests can sometimes be sold on secondary markets, but typically at a 15-30% discount to NAV. Liquidity is very limited."
                />
              </div>
              Liquidity Analysis
            </CardTitle>
            <CardDescription>Estimated proceeds if DST interests are sold on the secondary market</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Typical Discount to NAV</p>
                <p className="text-xl font-bold">15–30%</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Average Time to Sell</p>
                <p className="text-xl font-bold">6–18 months</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Broker Fee (Secondary)</p>
                <p className="text-xl font-bold">5–7%</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario</TableHead>
                  <TableHead className="text-right">Discount to NAV</TableHead>
                  <TableHead className="text-right">Gross Market Value</TableHead>
                  <TableHead className="text-right">Broker Fee (6%)</TableHead>
                  <TableHead className="text-right">Net Proceeds</TableHead>
                  <TableHead className="text-right">Loss vs. NAV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { label: "Optimistic", discount: 0.15 },
                  { label: "Base", discount: 0.22 },
                  { label: "Stress", discount: 0.30 },
                ].map((scenario) => {
                  const grossValue = investmentAmount * (1 - scenario.discount);
                  const brokerFee = grossValue * 0.06;
                  const netProceeds = grossValue - brokerFee;
                  const lossVsNav = investmentAmount - netProceeds;
                  return (
                    <TableRow key={scenario.label}>
                      <TableCell className="font-medium">
                        <Badge variant="outline" className={
                          scenario.label === "Optimistic" ? "text-green-600 border-green-600" :
                          scenario.label === "Base" ? "text-yellow-600 border-yellow-600" :
                          "text-red-600 border-red-600"
                        }>
                          {scenario.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="num text-right">{(scenario.discount * 100).toFixed(0)}%</TableCell>
                      <TableCell className="num text-right">${grossValue.toLocaleString()}</TableCell>
                      <TableCell className="num text-right text-red-500">${brokerFee.toLocaleString()}</TableCell>
                      <TableCell className="num text-right font-semibold">${netProceeds.toLocaleString()}</TableCell>
                      <TableCell className="num text-right text-red-500">-${lossVsNav.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Secondary Market Limitations
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>DST secondary market is highly illiquid with limited buyers</li>
                <li>Actual discounts may exceed modeled scenarios depending on market conditions</li>
                <li>No guarantee of finding a buyer within the estimated timeframe</li>
                <li>Broker fees on secondary transactions are higher than traditional real estate</li>
                <li>Transfer restrictions in DST operating agreements may limit resale options</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              <div className="flex items-center gap-2">
                <span>DST-to-UPREIT Conversion (</span>
                <span className="flex items-center gap-1">
                  <span>721 Exchange</span>
                  <InfoTooltip
                    content="A Section 721 exchange lets you convert DST interests into operating partnership units in a REIT, providing a path to eventual liquidity without triggering a taxable event."
                  />
                </span>
                <span>)</span>
              </div>
            </CardTitle>
            <CardDescription>Section 721 exchange pathway from DST interests to REIT shares</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: "DST Maturity", sublabel: "Illiquid", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" },
                { label: "721 Exchange", sublabel: "No Tax Event", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
                { label: "OP Units", sublabel: "Semi-Liquid", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" },
                { label: "REIT Shares", sublabel: "Liquid (after lock-up)", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
              ].map((step, idx) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div className={`px-4 py-3 rounded-lg text-center ${step.color}`}>
                    <p className="font-semibold text-sm">{step.label}</p>
                    <p className="text-xs">{step.sublabel}</p>
                  </div>
                  {idx < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              ))}
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Estimated OP Unit Value (at NAV)</p>
                <p className="num text-xl font-bold">${investmentAmount.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Typical REIT Lock-up Period</p>
                <p className="text-xl font-bold">12–24 months</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">REIT Dividend Yield (est.)</p>
                <p className="num text-xl font-bold text-green-600">{portfolioSummary.blendedCashOnCash.toFixed(2)}%</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Conversion Timeline
                </h4>
                <div className="space-y-2 text-sm">
                  {dstOptions.map(dst => (
                    <div key={dst.id} className="flex justify-between">
                      <span className="text-muted-foreground">{dst.name}</span>
                      <span className="num font-medium">Matures Year {dst.holdPeriod} → 721 eligible</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Tax Impact
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span>721 Exchange (DST → OP Units)</span>
                    <Badge variant="outline" className="text-green-600 border-green-600">No Tax Event</Badge>
                  </div>
                  <div className="flex justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span>OP Units → REIT Shares</span>
                    <Badge variant="outline" className="text-green-600 border-green-600">Tax Deferred</Badge>
                  </div>
                  <div className="flex justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <span>REIT Shares Sold</span>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">Capital Gains Due</Badge>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-muted-foreground">Estimated deferred gain</span>
                    <span className="num font-semibold">${exchangeGain.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated tax at sale</span>
                    <span className="num font-semibold text-red-500">${(exchangeGain * (federalTaxRate + stateTaxRate) / 100).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Refinancing Risk Model
            </CardTitle>
            <CardDescription>Impact of interest rate changes on DST debt service at maturity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(() => {
              const baseRate = 5.0;
              const weightedLTV = totalAllocation > 0
                ? dstOptions.reduce((sum, dst) => sum + (dst.ltv * dst.allocation / totalAllocation), 0)
                : 45;
              const totalDebt = dstOptions.reduce((sum, dst) => {
                const alloc = investmentAmount * (dst.allocation / 100);
                return sum + (dst.ltv > 0 ? alloc * (dst.ltv / (100 - dst.ltv)) : 0);
              }, 0);
              const totalPropertyValue = dstOptions.reduce((sum, dst) => {
                const alloc = investmentAmount * (dst.allocation / 100);
                return sum + (dst.ltv < 100 ? alloc / (1 - dst.ltv / 100) : alloc);
              }, 0);
              const totalNOI = portfolioSummary.totalAnnualCashFlow + (totalDebt * baseRate / 100);

              const scenarios = [
                { label: "Current Rate", rateAdj: 0 },
                { label: "+1.0%", rateAdj: 1.0 },
                { label: "+2.0%", rateAdj: 2.0 },
                { label: "+3.0%", rateAdj: 3.0 },
              ];

              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Total DST Debt</p>
                      <p className="num text-xl font-bold">${totalDebt.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Weighted Avg LTV</p>
                      <p className="num text-xl font-bold">{weightedLTV.toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Current Base Rate</p>
                      <p className="num text-xl font-bold">{baseRate.toFixed(1)}%</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Estimated NOI</p>
                      <p className="num text-xl font-bold">${totalNOI.toLocaleString()}</p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scenario</TableHead>
                        <TableHead className="text-right">Interest Rate</TableHead>
                        <TableHead className="text-right">Annual Debt Service</TableHead>
                        <TableHead className="text-right">Cash Flow Impact</TableHead>
                        <TableHead className="text-right">Breakeven Occupancy</TableHead>
                        <TableHead className="text-right flex items-center justify-end gap-2">
                          <span>DSCR</span>
                          <InfoTooltip
                            content="The property's net operating income divided by its annual debt payments. A DSCR below 1.0x means the property can't cover its debt from operations alone."
                          />
                        </TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scenarios.map((scenario) => {
                        const newRate = baseRate + scenario.rateAdj;
                        const annualDebtService = totalDebt * (newRate / 100);
                        const currentDebtService = totalDebt * (baseRate / 100);
                        const cashFlowImpact = -(annualDebtService - currentDebtService);
                        const breakEvenOccupancy = totalNOI > 0
                          ? (annualDebtService / totalNOI) * 100
                          : 0;
                        const dscr = annualDebtService > 0 ? totalNOI / annualDebtService : 0;

                        return (
                          <TableRow key={scenario.label}>
                            <TableCell className="font-medium">{scenario.label}</TableCell>
                            <TableCell className="num text-right">{newRate.toFixed(1)}%</TableCell>
                            <TableCell className="num text-right">${annualDebtService.toLocaleString()}</TableCell>
                            <TableCell className={`num text-right ${cashFlowImpact < 0 ? 'text-red-500' : ''}`}>
                              {cashFlowImpact === 0 ? '—' : `${cashFlowImpact < 0 ? '-' : '+'}$${Math.abs(cashFlowImpact).toLocaleString()}`}
                            </TableCell>
                            <TableCell className="num text-right">{breakEvenOccupancy.toFixed(1)}%</TableCell>
                            <TableCell className={`num text-right font-semibold ${dscr < 1.25 ? 'text-red-500' : 'text-green-600'}`}>
                              {dscr.toFixed(2)}x
                            </TableCell>
                            <TableCell className="text-right">
                              {dscr < 1.25 ? (
                                <Badge variant="outline" className="text-red-600 border-red-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Below 1.25x
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-600 border-green-600">Adequate</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Balloon Payment & Refinancing Risk
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>DST loans typically have fixed terms of 7–10 years with balloon payments at maturity</li>
                      <li>Balloon payment of ${totalDebt.toLocaleString()} will be due at loan maturity</li>
                      <li>DSTs cannot refinance debt — if the loan matures, the property must be sold or the DST dissolved</li>
                      <li>Rising interest rates at maturity may reduce property values and exit proceeds</li>
                      <li>DSCR below 1.25x indicates elevated risk of cash flow shortfall</li>
                    </ul>
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
