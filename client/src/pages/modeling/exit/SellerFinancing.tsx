import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, HandCoins, ChevronRight, Download, DollarSign, Percent, Calculator, AlertTriangle, TrendingUp, Shield, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModelingProject } from "@shared/schema";

interface SellerFinancingProps {
  projectId: string;
}

interface AmortizationRow {
  year: number;
  beginningBalance: number;
  payment: number;
  principal: number;
  interest: number;
  endingBalance: number;
  taxableGainRecognized: number;
  taxDue: number;
  netCashFlow: number;
}

export default function ExitSellerFinancing({ projectId }: SellerFinancingProps) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [inputs, setInputs] = useState({
    salePrice: project?.purchasePrice ? Number(project.purchasePrice) * 1.3 : 10000000,
    adjustedBasis: project?.purchasePrice ? Number(project.purchasePrice) * 0.75 : 6000000,
    downPayment: 20,
    interestRate: 6.5,
    termYears: 10,
    amortizationYears: 25,
    balloonYear: 10,
    useInstallmentMethod: true,
  });

  const [taxRates, setTaxRates] = useState({
    federalLongTermRate: 20,
    niitRate: 3.8,
    stateRate: 5,
    ordinaryIncomeRate: 37,
  });

  const [riskInputs, setRiskInputs] = useState({
    defaultProbability: 5,
    recoveryRate: 70,
    collateralType: 'first_lien' as 'first_lien' | 'second_lien' | 'unsecured',
    buyerCreditScore: 720,
    prepaymentProbability: 15,
  });

  const totalGain = inputs.salePrice - inputs.adjustedBasis;
  const grossProfitRatio = totalGain / inputs.salePrice;
  const combinedCapitalGainsRate = (taxRates.federalLongTermRate + taxRates.niitRate + taxRates.stateRate) / 100;
  
  const downPaymentAmount = inputs.salePrice * (inputs.downPayment / 100);
  const loanAmount = inputs.salePrice - downPaymentAmount;
  const monthlyRate = inputs.interestRate / 100 / 12;
  const amortizationMonths = inputs.amortizationYears * 12;
  const termMonths = inputs.termYears * 12;
  
  const monthlyPayment = loanAmount > 0 && monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortizationMonths)) / (Math.pow(1 + monthlyRate, amortizationMonths) - 1)
    : 0;
  
  const annualPayment = monthlyPayment * 12;

  const amortizationSchedule = useMemo<AmortizationRow[]>(() => {
    const schedule: AmortizationRow[] = [];
    let balance = loanAmount;
    
    const downPaymentGain = downPaymentAmount * grossProfitRatio;
    const downPaymentTax = downPaymentGain * combinedCapitalGainsRate;
    
    schedule.push({
      year: 0,
      beginningBalance: 0,
      payment: downPaymentAmount,
      principal: downPaymentAmount,
      interest: 0,
      endingBalance: loanAmount,
      taxableGainRecognized: inputs.useInstallmentMethod ? downPaymentGain : totalGain,
      taxDue: inputs.useInstallmentMethod ? downPaymentTax : totalGain * combinedCapitalGainsRate,
      netCashFlow: downPaymentAmount - (inputs.useInstallmentMethod ? downPaymentTax : totalGain * combinedCapitalGainsRate),
    });
    
    for (let year = 1; year <= Math.min(inputs.termYears, 30); year++) {
      const beginningBalance = balance;
      let yearInterest = 0;
      let yearPrincipal = 0;
      
      for (let month = 1; month <= 12; month++) {
        if (balance <= 0) break;
        const interestPayment = balance * monthlyRate;
        const principalPayment = Math.min(monthlyPayment - interestPayment, balance);
        yearInterest += interestPayment;
        yearPrincipal += principalPayment;
        balance -= principalPayment;
      }
      
      const taxableGainRecognized = inputs.useInstallmentMethod 
        ? yearPrincipal * grossProfitRatio 
        : 0;
      const taxDue = (taxableGainRecognized * combinedCapitalGainsRate) + 
        (yearInterest * taxRates.ordinaryIncomeRate / 100);
      
      schedule.push({
        year,
        beginningBalance,
        payment: annualPayment,
        principal: yearPrincipal,
        interest: yearInterest,
        endingBalance: Math.max(0, balance),
        taxableGainRecognized,
        taxDue,
        netCashFlow: annualPayment - taxDue,
      });
    }
    
    return schedule;
  }, [inputs, loanAmount, monthlyPayment, monthlyRate, grossProfitRatio, combinedCapitalGainsRate, taxRates, totalGain, downPaymentAmount, annualPayment]);

  const totalInterest = amortizationSchedule.slice(1).reduce((sum, row) => sum + row.interest, 0);
  const totalPrincipal = amortizationSchedule.reduce((sum, row) => sum + row.principal, 0);
  const balloonBalance = amortizationSchedule[inputs.balloonYear]?.endingBalance || 0;
  const totalTaxPaid = amortizationSchedule.reduce((sum, row) => sum + row.taxDue, 0);

  const taxWithoutInstallment = totalGain * combinedCapitalGainsRate + totalInterest * (taxRates.ordinaryIncomeRate / 100);
  const taxSavingsTiming = totalTaxPaid - taxWithoutInstallment;

  const npvOfNote = useMemo(() => {
    const discountRate = 0.08;
    let npv = 0;
    for (const row of amortizationSchedule) {
      if (row.year === 0) {
        npv += row.payment;
      } else {
        npv += row.netCashFlow / Math.pow(1 + discountRate, row.year);
      }
    }
    if (balloonBalance > 0 && inputs.balloonYear < amortizationSchedule.length) {
      npv += balloonBalance / Math.pow(1 + discountRate, inputs.balloonYear);
    }
    return npv;
  }, [amortizationSchedule, balloonBalance, inputs.balloonYear]);

  const expectedLoss = loanAmount * (riskInputs.defaultProbability / 100) * (1 - riskInputs.recoveryRate / 100);
  const riskAdjustedValue = npvOfNote - expectedLoss;

  const getCollateralBadge = () => {
    switch(riskInputs.collateralType) {
      case 'first_lien': return <Badge variant="outline" className="text-green-600 border-green-600">First Lien</Badge>;
      case 'second_lien': return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Second Lien</Badge>;
      case 'unsecured': return <Badge variant="outline" className="text-red-600 border-red-600">Unsecured</Badge>;
    }
  };

  const getCreditBadge = () => {
    if (riskInputs.buyerCreditScore >= 740) return <Badge variant="outline" className="text-green-600 border-green-600">Excellent</Badge>;
    if (riskInputs.buyerCreditScore >= 700) return <Badge variant="outline" className="text-blue-600 border-blue-600">Good</Badge>;
    if (riskInputs.buyerCreditScore >= 650) return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Fair</Badge>;
    return <Badge variant="outline" className="text-red-600 border-red-600">Poor</Badge>;
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
                Exit Strategy
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">Seller Financing</span>
            </div>
            <h1 className="text-3xl font-bold" data-testid="seller-financing-title">Seller Financing</h1>
            <p className="text-muted-foreground mt-1">
              Installment sale modeling with tax deferral analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocation(basePath)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" data-testid="btn-export-seller-financing">
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
                <span className="text-sm">Note Value</span>
              </div>
              <p className="text-2xl font-bold">${(loanAmount / 1000000).toFixed(2)}M</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Percent className="h-4 w-4" />
                <span className="text-sm">Interest Rate</span>
              </div>
              <p className="text-2xl font-bold">{inputs.interestRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Total Interest</span>
              </div>
              <p className="text-2xl font-bold text-green-600">${(totalInterest / 1000).toFixed(0)}K</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calculator className="h-4 w-4" />
                <span className="text-sm">NPV of Note</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">${(npvOfNote / 1000000).toFixed(2)}M</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Shield className="h-4 w-4" />
                <span className="text-sm">Balloon Payment</span>
              </div>
              <p className="text-2xl font-bold">${(balloonBalance / 1000000).toFixed(2)}M</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="terms" className="space-y-4">
          <TabsList>
            <TabsTrigger value="terms" className="gap-2">
              <HandCoins className="h-4 w-4" />
              Loan Terms
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <FileText className="h-4 w-4" />
              Amortization
            </TabsTrigger>
            <TabsTrigger value="tax" className="gap-2">
              <Calculator className="h-4 w-4" />
              Tax Analysis
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Risk Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terms">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HandCoins className="h-5 w-5" />
                    Financing Terms
                  </CardTitle>
                  <CardDescription>Configure seller financing parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="salePrice">Sale Price ($)</Label>
                      <Input
                        id="salePrice"
                        type="number"
                        value={inputs.salePrice}
                        onChange={(e) => setInputs({ ...inputs, salePrice: Number(e.target.value) })}
                        data-testid="input-sale-price"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adjustedBasis">Adjusted Basis ($)</Label>
                      <Input
                        id="adjustedBasis"
                        type="number"
                        value={inputs.adjustedBasis}
                        onChange={(e) => setInputs({ ...inputs, adjustedBasis: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="downPayment">Down Payment (%)</Label>
                      <Input
                        id="downPayment"
                        type="number"
                        step="0.1"
                        value={inputs.downPayment}
                        onChange={(e) => setInputs({ ...inputs, downPayment: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interestRate">Interest Rate (%)</Label>
                      <Input
                        id="interestRate"
                        type="number"
                        step="0.1"
                        value={inputs.interestRate}
                        onChange={(e) => setInputs({ ...inputs, interestRate: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="termYears">Loan Term (years)</Label>
                      <Input
                        id="termYears"
                        type="number"
                        value={inputs.termYears}
                        onChange={(e) => setInputs({ ...inputs, termYears: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amortizationYears">Amortization (years)</Label>
                      <Input
                        id="amortizationYears"
                        type="number"
                        value={inputs.amortizationYears}
                        onChange={(e) => setInputs({ ...inputs, amortizationYears: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="balloonYear">Balloon Year</Label>
                      <Input
                        id="balloonYear"
                        type="number"
                        value={inputs.balloonYear}
                        onChange={(e) => setInputs({ ...inputs, balloonYear: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="installmentMethod">Use Installment Sale Method</Label>
                      <p className="text-xs text-muted-foreground">Defer gain recognition as principal is received</p>
                    </div>
                    <Switch
                      id="installmentMethod"
                      checked={inputs.useInstallmentMethod}
                      onCheckedChange={(checked) => setInputs({ ...inputs, useInstallmentMethod: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Financing Summary</CardTitle>
                  <CardDescription>Key terms and payment analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Price</span>
                      <span className="font-medium">${inputs.salePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Down Payment</span>
                      <span className="font-medium text-green-600">${downPaymentAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Note Amount</span>
                      <span className="font-medium">${loanAmount.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Gain</span>
                      <span className="font-medium">${totalGain.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross Profit Ratio</span>
                      <span className="font-medium">{(grossProfitRatio * 100).toFixed(2)}%</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Payment</span>
                      <span className="font-medium" data-testid="text-monthly-payment">
                        ${monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Payment</span>
                      <span className="font-medium">
                        ${annualPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Interest</span>
                      <span className="font-medium text-green-600">
                        ${totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balloon Balance</span>
                      <span className="font-medium">
                        ${balloonBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle>Amortization Schedule with Tax Impact</CardTitle>
                <CardDescription>Year-by-year payment breakdown with installment sale tax analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead className="text-right">Beginning Balance</TableHead>
                        <TableHead className="text-right">Payment</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Ending Balance</TableHead>
                        <TableHead className="text-right">Gain Recognized</TableHead>
                        <TableHead className="text-right">Tax Due</TableHead>
                        <TableHead className="text-right">Net Cash Flow</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {amortizationSchedule.map((row) => (
                        <TableRow key={row.year} data-testid={`amort-row-${row.year}`}>
                          <TableCell>{row.year === 0 ? 'Down Pmt' : row.year}</TableCell>
                          <TableCell className="text-right">
                            ${row.beginningBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right">
                            ${row.payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            ${row.principal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            ${row.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${row.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right">
                            ${row.taxableGainRecognized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right text-red-500">
                            ${row.taxDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            ${row.netCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tax Rate Assumptions</CardTitle>
                  <CardDescription>Configure tax rates for installment sale analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Federal Long-Term Capital Gains</Label>
                        <span className="font-medium">{taxRates.federalLongTermRate}%</span>
                      </div>
                      <Slider
                        value={[taxRates.federalLongTermRate]}
                        onValueChange={([value]) => setTaxRates({ ...taxRates, federalLongTermRate: value })}
                        min={0}
                        max={25}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>NIIT Rate</Label>
                        <span className="font-medium">{taxRates.niitRate}%</span>
                      </div>
                      <Slider
                        value={[taxRates.niitRate]}
                        onValueChange={([value]) => setTaxRates({ ...taxRates, niitRate: value })}
                        min={0}
                        max={5}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>State Capital Gains Rate</Label>
                        <span className="font-medium">{taxRates.stateRate}%</span>
                      </div>
                      <Slider
                        value={[taxRates.stateRate]}
                        onValueChange={([value]) => setTaxRates({ ...taxRates, stateRate: value })}
                        min={0}
                        max={15}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Ordinary Income Rate (for Interest)</Label>
                        <span className="font-medium">{taxRates.ordinaryIncomeRate}%</span>
                      </div>
                      <Slider
                        value={[taxRates.ordinaryIncomeRate]}
                        onValueChange={([value]) => setTaxRates({ ...taxRates, ordinaryIncomeRate: value })}
                        min={0}
                        max={45}
                        step={0.1}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Installment Sale Tax Benefits</CardTitle>
                  <CardDescription>Compare installment vs. outright sale tax treatment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-3">Outright Sale (Year 0 Tax)</h4>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capital Gains Tax on Full Gain</span>
                        <span className="font-medium text-red-500">
                          ${(totalGain * combinedCapitalGainsRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h4 className="font-medium mb-3">Installment Sale (Spread Over Time)</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Year 0 Tax (Down Payment)</span>
                          <span className="font-medium">
                            ${amortizationSchedule[0]?.taxDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Tax Over Term</span>
                          <span className="font-medium">
                            ${totalTaxPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Separator />
                    
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Tax Timing Benefit</span>
                      <span className="font-bold text-green-600">
                        Defer ${((totalGain * combinedCapitalGainsRate) - (amortizationSchedule[0]?.taxDue || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} in Year 0
                      </span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Installment Sale Considerations
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Interest income is taxed at ordinary income rates</li>
                      <li>Related party sales have special rules</li>
                      <li>Disposition of installment note triggers gain</li>
                      <li>Consult tax advisor for specific guidance</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="risk">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Credit & Default Risk
                  </CardTitle>
                  <CardDescription>Assess buyer credit and note risk</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Default Probability</Label>
                        <span className="font-medium">{riskInputs.defaultProbability}%</span>
                      </div>
                      <Slider
                        value={[riskInputs.defaultProbability]}
                        onValueChange={([value]) => setRiskInputs({ ...riskInputs, defaultProbability: value })}
                        min={0}
                        max={30}
                        step={0.5}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Recovery Rate (if Default)</Label>
                        <span className="font-medium">{riskInputs.recoveryRate}%</span>
                      </div>
                      <Slider
                        value={[riskInputs.recoveryRate]}
                        onValueChange={([value]) => setRiskInputs({ ...riskInputs, recoveryRate: value })}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Collateral Type</Label>
                      <Select
                        value={riskInputs.collateralType}
                        onValueChange={(value: typeof riskInputs.collateralType) => 
                          setRiskInputs({ ...riskInputs, collateralType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first_lien">First Lien (Property)</SelectItem>
                          <SelectItem value="second_lien">Second Lien</SelectItem>
                          <SelectItem value="unsecured">Unsecured</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Buyer Credit Score</Label>
                        <span className="font-medium">{riskInputs.buyerCreditScore}</span>
                      </div>
                      <Slider
                        value={[riskInputs.buyerCreditScore]}
                        onValueChange={([value]) => setRiskInputs({ ...riskInputs, buyerCreditScore: value })}
                        min={500}
                        max={850}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Prepayment Probability</Label>
                        <span className="font-medium">{riskInputs.prepaymentProbability}%</span>
                      </div>
                      <Slider
                        value={[riskInputs.prepaymentProbability]}
                        onValueChange={([value]) => setRiskInputs({ ...riskInputs, prepaymentProbability: value })}
                        min={0}
                        max={50}
                        step={1}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk-Adjusted Value</CardTitle>
                  <CardDescription>Expected value accounting for default risk</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Collateral</p>
                      <div className="mt-1">{getCollateralBadge()}</div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Credit Quality</p>
                      <div className="mt-1">{getCreditBadge()}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Note Face Value</span>
                      <span className="font-medium">${loanAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">NPV (8% discount)</span>
                      <span className="font-medium">${npvOfNote.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Loss</span>
                      <span className="font-medium text-red-500">
                        -${expectedLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold">Risk-Adjusted Value</span>
                      <span className="font-bold text-blue-600">
                        ${riskAdjustedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Risk Mitigation Strategies</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Require personal guarantees</li>
                      <li>Include due-on-sale clause</li>
                      <li>Maintain first lien position</li>
                      <li>Require hazard insurance</li>
                      <li>Consider note sale or syndication</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
