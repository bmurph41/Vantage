import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calculator, 
  TrendingUp, 
  DollarSign,
  Percent,
  BarChart3,
  Brain,
  RefreshCcw,
  Landmark,
  HandCoins,
  Award,
  Target,
  Info
} from "lucide-react";

const exitTools = [
  { 
    id: "tax", 
    name: "Tax Calculator", 
    shortName: "Tax",
    description: "Capital gains & depreciation recapture analysis", 
    icon: Calculator,
    color: "text-red-500",
    bgColor: "bg-red-50"
  },
  { 
    id: "net-proceeds", 
    name: "Net Proceeds", 
    shortName: "Proceeds",
    description: "Cash-on-cash analysis at exit", 
    icon: DollarSign,
    color: "text-green-500",
    bgColor: "bg-green-50"
  },
  { 
    id: "1031", 
    name: "1031 Exchange", 
    shortName: "1031",
    description: "Like-kind exchange planning", 
    icon: RefreshCcw,
    color: "text-blue-500",
    bgColor: "bg-blue-50"
  },
  { 
    id: "dst", 
    name: "DST Analysis", 
    shortName: "DST",
    description: "Delaware Statutory Trust modeling", 
    icon: Landmark,
    color: "text-purple-500",
    bgColor: "bg-purple-50"
  },
  { 
    id: "seller-financing", 
    name: "Seller Financing", 
    shortName: "Seller Fin.",
    description: "Installment sale modeling", 
    icon: HandCoins,
    color: "text-amber-500",
    bgColor: "bg-amber-50"
  },
  { 
    id: "earnout", 
    name: "Earnout", 
    shortName: "Earnout",
    description: "Contingent payment structures", 
    icon: Award,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50"
  },
  { 
    id: "waterfall", 
    name: "Waterfall", 
    shortName: "Waterfall",
    description: "Fund distribution modeling", 
    icon: BarChart3,
    color: "text-cyan-500",
    bgColor: "bg-cyan-50"
  },
  { 
    id: "irr", 
    name: "IRR Calculator", 
    shortName: "IRR",
    description: "Multi-period return analysis", 
    icon: Percent,
    color: "text-emerald-500",
    bgColor: "bg-emerald-50"
  },
  { 
    id: "sensitivity", 
    name: "Sensitivity", 
    shortName: "Sensitivity",
    description: "What-if scenario explorer", 
    icon: TrendingUp,
    color: "text-orange-500",
    bgColor: "bg-orange-50"
  },
  { 
    id: "ai-insights", 
    name: "AI Insights", 
    shortName: "AI",
    description: "AI-powered exit recommendations", 
    icon: Brain,
    color: "text-pink-500",
    bgColor: "bg-pink-50"
  },
];

export default function ExitStrategiesPage() {
  const [activeTab, setActiveTab] = useState("tax");
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="exit-strategies-title">
              <Target className="h-6 w-6 text-primary" />
              Exit Strategies
            </h1>
            <p className="text-muted-foreground mt-1">
              Quick analysis tools for exit planning. For project-specific analysis, use the Exit Strategy tab within a modeling project.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/modeling/projects")}
            data-testid="button-back-to-projects"
          >
            View Projects
          </Button>
        </div>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 font-medium">Standalone Mode</p>
                <p className="text-sm text-blue-700">
                  These tools use manual inputs for quick calculations. For integrated analysis with your project data, 
                  open a modeling project and use the Exit Strategy tab.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {exitTools.map((tool) => (
              <TabsTrigger 
                key={tool.id} 
                value={tool.id}
                className="flex items-center gap-1.5 px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
                data-testid={`tab-${tool.id}`}
              >
                <tool.icon className={`h-3.5 w-3.5 ${activeTab === tool.id ? tool.color : ''}`} />
                <span className="hidden sm:inline">{tool.shortName}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="tax" className="mt-6">
            <TaxCalculatorPanel />
          </TabsContent>

          <TabsContent value="net-proceeds" className="mt-6">
            <NetProceedsPanel />
          </TabsContent>

          <TabsContent value="1031" className="mt-6">
            <Exchange1031Panel />
          </TabsContent>

          <TabsContent value="dst" className="mt-6">
            <DSTAnalysisPanel />
          </TabsContent>

          <TabsContent value="seller-financing" className="mt-6">
            <SellerFinancingPanel />
          </TabsContent>

          <TabsContent value="earnout" className="mt-6">
            <EarnoutPanel />
          </TabsContent>

          <TabsContent value="waterfall" className="mt-6">
            <WaterfallPanel />
          </TabsContent>

          <TabsContent value="irr" className="mt-6">
            <IRRCalculatorPanel />
          </TabsContent>

          <TabsContent value="sensitivity" className="mt-6">
            <SensitivityPanel />
          </TabsContent>

          <TabsContent value="ai-insights" className="mt-6">
            <AIInsightsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TaxCalculatorPanel() {
  const [salePrice, setSalePrice] = useState<string>("5000000");
  const [costBasis, setCostBasis] = useState<string>("3500000");
  const [depreciationRecapture, setDepreciationRecapture] = useState<string>("500000");
  const [holdingPeriod, setHoldingPeriod] = useState<string>("5");
  const [taxRate, setTaxRate] = useState<string>("20");
  const [stateRate, setStateRate] = useState<string>("5");

  const calculateTax = () => {
    const sale = parseFloat(salePrice) || 0;
    const basis = parseFloat(costBasis) || 0;
    const depreciation = parseFloat(depreciationRecapture) || 0;
    const fedRate = parseFloat(taxRate) / 100 || 0.20;
    const stRate = parseFloat(stateRate) / 100 || 0.05;
    
    const capitalGain = sale - basis;
    const federalTax = capitalGain * fedRate;
    const stateTax = capitalGain * stRate;
    const depTax = depreciation * 0.25;
    const niit = capitalGain > 250000 ? capitalGain * 0.038 : 0;
    const totalTax = federalTax + stateTax + depTax + niit;
    const netProceeds = sale - totalTax;
    
    return { capitalGain, federalTax, stateTax, depTax, niit, totalTax, netProceeds };
  };

  const results = calculateTax();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-red-500" />
            Tax Calculator
          </CardTitle>
          <CardDescription>
            Calculate capital gains, depreciation recapture, and state taxes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sale Price ($)</Label>
              <Input 
                type="number" 
                value={salePrice} 
                onChange={(e) => setSalePrice(e.target.value)}
                data-testid="input-sale-price"
              />
            </div>
            <div>
              <Label>Cost Basis ($)</Label>
              <Input 
                type="number" 
                value={costBasis} 
                onChange={(e) => setCostBasis(e.target.value)}
                data-testid="input-cost-basis"
              />
            </div>
            <div>
              <Label>Depreciation Recapture ($)</Label>
              <Input 
                type="number" 
                value={depreciationRecapture} 
                onChange={(e) => setDepreciationRecapture(e.target.value)}
                data-testid="input-depreciation"
              />
            </div>
            <div>
              <Label>Holding Period (Years)</Label>
              <Input 
                type="number" 
                value={holdingPeriod} 
                onChange={(e) => setHoldingPeriod(e.target.value)}
                data-testid="input-holding-period"
              />
            </div>
            <div>
              <Label>Federal Cap Gains Rate (%)</Label>
              <Input 
                type="number" 
                value={taxRate} 
                onChange={(e) => setTaxRate(e.target.value)}
                data-testid="input-fed-rate"
              />
            </div>
            <div>
              <Label>State Tax Rate (%)</Label>
              <Input 
                type="number" 
                value={stateRate} 
                onChange={(e) => setStateRate(e.target.value)}
                data-testid="input-state-rate"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Capital Gain</span>
              <span className="font-semibold" data-testid="text-capital-gain">${results.capitalGain.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Federal Tax</span>
              <span className="text-red-600" data-testid="text-federal-tax">-${results.federalTax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">State Tax</span>
              <span className="text-red-600" data-testid="text-state-tax">-${results.stateTax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Depreciation Recapture (25%)</span>
              <span className="text-red-600" data-testid="text-dep-recapture">-${results.depTax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">NIIT (3.8%)</span>
              <span className="text-red-600" data-testid="text-niit">-${results.niit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-3">
              <span className="font-semibold">Total Tax Liability</span>
              <span className="font-bold text-red-600" data-testid="text-total-tax">${results.totalTax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-3 bg-green-50 rounded-lg px-3">
              <span className="font-semibold">Net Proceeds After Tax</span>
              <span className="font-bold text-green-600" data-testid="text-net-proceeds">${results.netProceeds.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NetProceedsPanel() {
  const [salePrice, setSalePrice] = useState<string>("5000000");
  const [loanBalance, setLoanBalance] = useState<string>("2500000");
  const [closingCosts, setClosingCosts] = useState<string>("150000");
  const [brokerFee, setBrokerFee] = useState<string>("5");
  const [taxes, setTaxes] = useState<string>("300000");

  const calculate = () => {
    const sale = parseFloat(salePrice) || 0;
    const loan = parseFloat(loanBalance) || 0;
    const closing = parseFloat(closingCosts) || 0;
    const brokerPct = parseFloat(brokerFee) / 100 || 0;
    const tax = parseFloat(taxes) || 0;
    
    const brokerCost = sale * brokerPct;
    const totalDeductions = loan + closing + brokerCost + tax;
    const netProceeds = sale - totalDeductions;
    
    return { brokerCost, totalDeductions, netProceeds };
  };

  const results = calculate();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Net Proceeds Calculator
          </CardTitle>
          <CardDescription>
            Calculate cash proceeds after all deductions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sale Price ($)</Label>
              <Input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </div>
            <div>
              <Label>Loan Balance ($)</Label>
              <Input type="number" value={loanBalance} onChange={(e) => setLoanBalance(e.target.value)} />
            </div>
            <div>
              <Label>Closing Costs ($)</Label>
              <Input type="number" value={closingCosts} onChange={(e) => setClosingCosts(e.target.value)} />
            </div>
            <div>
              <Label>Broker Fee (%)</Label>
              <Input type="number" value={brokerFee} onChange={(e) => setBrokerFee(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Estimated Taxes ($)</Label>
              <Input type="number" value={taxes} onChange={(e) => setTaxes(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proceeds Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Gross Sale Price</span>
              <span className="font-semibold">${parseFloat(salePrice).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Loan Payoff</span>
              <span className="text-red-600">-${parseFloat(loanBalance).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Broker Commission</span>
              <span className="text-red-600">-${results.brokerCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Closing Costs</span>
              <span className="text-red-600">-${parseFloat(closingCosts).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Taxes</span>
              <span className="text-red-600">-${parseFloat(taxes).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-3 bg-green-50 rounded-lg px-3">
              <span className="font-semibold">Net Cash Proceeds</span>
              <span className="font-bold text-green-600">${results.netProceeds.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Exchange1031Panel() {
  const [relinquishedValue, setRelinquishedValue] = useState<string>("5000000");
  const [replacementValue, setReplacementValue] = useState<string>("6000000");
  const [bootReceived, setBootReceived] = useState<string>("0");
  const [identificationDays, setIdentificationDays] = useState<string>("45");
  const [closingDays, setClosingDays] = useState<string>("180");

  const deferredGain = Math.min(parseFloat(relinquishedValue) || 0, parseFloat(replacementValue) || 0);
  const taxableGain = parseFloat(bootReceived) || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-blue-500" />
            1031 Exchange Planner
          </CardTitle>
          <CardDescription>
            Plan your like-kind exchange and track deadlines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Relinquished Property Value ($)</Label>
              <Input type="number" value={relinquishedValue} onChange={(e) => setRelinquishedValue(e.target.value)} />
            </div>
            <div>
              <Label>Replacement Property Value ($)</Label>
              <Input type="number" value={replacementValue} onChange={(e) => setReplacementValue(e.target.value)} />
            </div>
            <div>
              <Label>Boot Received ($)</Label>
              <Input type="number" value={bootReceived} onChange={(e) => setBootReceived(e.target.value)} />
            </div>
            <div>
              <Label>Identification Period (Days)</Label>
              <Input type="number" value={identificationDays} onChange={(e) => setIdentificationDays(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exchange Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Deferred Gain</span>
              <span className="font-semibold text-green-600">${deferredGain.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Taxable Boot</span>
              <span className="text-red-600">${taxableGain.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">ID Deadline</span>
              <span>{identificationDays} days</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Closing Deadline</span>
              <span>{closingDays} days</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DSTAnalysisPanel() {
  const [investmentAmount, setInvestmentAmount] = useState<string>("1000000");
  const [distributionRate, setDistributionRate] = useState<string>("5.5");
  const [holdPeriod, setHoldPeriod] = useState<string>("7");

  const annualDistribution = (parseFloat(investmentAmount) || 0) * (parseFloat(distributionRate) / 100 || 0);
  const totalDistributions = annualDistribution * (parseFloat(holdPeriod) || 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-purple-500" />
            DST Analysis
          </CardTitle>
          <CardDescription>
            Delaware Statutory Trust investment modeling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Investment Amount ($)</Label>
              <Input type="number" value={investmentAmount} onChange={(e) => setInvestmentAmount(e.target.value)} />
            </div>
            <div>
              <Label>Distribution Rate (%)</Label>
              <Input type="number" value={distributionRate} onChange={(e) => setDistributionRate(e.target.value)} />
            </div>
            <div>
              <Label>Hold Period (Years)</Label>
              <Input type="number" value={holdPeriod} onChange={(e) => setHoldPeriod(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DST Returns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Annual Distribution</span>
              <span className="font-semibold text-green-600">${annualDistribution.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Distributions</span>
              <span className="font-semibold">${totalDistributions.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SellerFinancingPanel() {
  const [salePrice, setSalePrice] = useState<string>("5000000");
  const [downPayment, setDownPayment] = useState<string>("1000000");
  const [interestRate, setInterestRate] = useState<string>("6");
  const [term, setTerm] = useState<string>("10");

  const loanAmount = (parseFloat(salePrice) || 0) - (parseFloat(downPayment) || 0);
  const monthlyRate = (parseFloat(interestRate) / 100 || 0) / 12;
  const months = (parseFloat(term) || 0) * 12;
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1) || 0;
  const totalInterest = (monthlyPayment * months) - loanAmount;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-amber-500" />
            Seller Financing
          </CardTitle>
          <CardDescription>
            Installment sale with amortization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sale Price ($)</Label>
              <Input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </div>
            <div>
              <Label>Down Payment ($)</Label>
              <Input type="number" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
            </div>
            <div>
              <Label>Interest Rate (%)</Label>
              <Input type="number" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
            </div>
            <div>
              <Label>Term (Years)</Label>
              <Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financing Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Loan Amount</span>
              <span className="font-semibold">${loanAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Monthly Payment</span>
              <span className="font-semibold text-green-600">${monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Interest</span>
              <span>${totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EarnoutPanel() {
  const [basePrice, setBasePrice] = useState<string>("4000000");
  const [earnoutMax, setEarnoutMax] = useState<string>("1000000");
  const [probability, setProbability] = useState<string>("60");

  const expectedEarnout = (parseFloat(earnoutMax) || 0) * (parseFloat(probability) / 100 || 0);
  const totalExpected = (parseFloat(basePrice) || 0) + expectedEarnout;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-indigo-500" />
            Earnout Modeling
          </CardTitle>
          <CardDescription>
            Contingent payment structures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Base Price ($)</Label>
              <Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            <div>
              <Label>Maximum Earnout ($)</Label>
              <Input type="number" value={earnoutMax} onChange={(e) => setEarnoutMax(e.target.value)} />
            </div>
            <div>
              <Label>Achievement Probability (%)</Label>
              <Input type="number" value={probability} onChange={(e) => setProbability(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Earnout Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Expected Earnout</span>
              <span className="font-semibold text-green-600">${expectedEarnout.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Expected Value</span>
              <span className="font-semibold">${totalExpected.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WaterfallPanel() {
  const [totalDistribution, setTotalDistribution] = useState<string>("10000000");
  const [lpCapital, setLpCapital] = useState<string>("8000000");
  const [preferredReturn, setPreferredReturn] = useState<string>("8");
  const [carriedInterest, setCarriedInterest] = useState<string>("20");

  const prefAmount = (parseFloat(lpCapital) || 0) * (parseFloat(preferredReturn) / 100 || 0);
  const remaining = (parseFloat(totalDistribution) || 0) - prefAmount - (parseFloat(lpCapital) || 0);
  const gpCarry = remaining > 0 ? remaining * (parseFloat(carriedInterest) / 100 || 0) : 0;
  const lpShare = remaining - gpCarry;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-cyan-500" />
            Waterfall Analysis
          </CardTitle>
          <CardDescription>
            Fund distribution modeling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Distribution ($)</Label>
              <Input type="number" value={totalDistribution} onChange={(e) => setTotalDistribution(e.target.value)} />
            </div>
            <div>
              <Label>LP Capital ($)</Label>
              <Input type="number" value={lpCapital} onChange={(e) => setLpCapital(e.target.value)} />
            </div>
            <div>
              <Label>Preferred Return (%)</Label>
              <Input type="number" value={preferredReturn} onChange={(e) => setPreferredReturn(e.target.value)} />
            </div>
            <div>
              <Label>Carried Interest (%)</Label>
              <Input type="number" value={carriedInterest} onChange={(e) => setCarriedInterest(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribution Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">LP Preferred Return</span>
              <span className="font-semibold">${prefAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">LP Capital Return</span>
              <span className="font-semibold">${parseFloat(lpCapital).toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">GP Carried Interest</span>
              <span className="font-semibold">${gpCarry.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">LP Profit Share</span>
              <span className="font-semibold text-green-600">${lpShare.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IRRCalculatorPanel() {
  const [initialInvestment, setInitialInvestment] = useState<string>("1000000");
  const [year1, setYear1] = useState<string>("100000");
  const [year2, setYear2] = useState<string>("150000");
  const [year3, setYear3] = useState<string>("200000");
  const [exitValue, setExitValue] = useState<string>("1500000");

  const cashFlows = [
    -(parseFloat(initialInvestment) || 0),
    parseFloat(year1) || 0,
    parseFloat(year2) || 0,
    parseFloat(year3) || 0 + (parseFloat(exitValue) || 0)
  ];

  const calculateIRR = (flows: number[]) => {
    let rate = 0.1;
    for (let i = 0; i < 100; i++) {
      let npv = 0;
      let npvDerivative = 0;
      for (let t = 0; t < flows.length; t++) {
        npv += flows[t] / Math.pow(1 + rate, t);
        npvDerivative -= t * flows[t] / Math.pow(1 + rate, t + 1);
      }
      if (Math.abs(npv) < 0.01) break;
      rate = rate - npv / npvDerivative;
    }
    return (rate * 100).toFixed(2);
  };

  const irr = calculateIRR(cashFlows);
  const totalCashFlow = cashFlows.reduce((a, b) => a + b, 0);
  const multiple = (totalCashFlow + (parseFloat(initialInvestment) || 0)) / (parseFloat(initialInvestment) || 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-emerald-500" />
            IRR Calculator
          </CardTitle>
          <CardDescription>
            Multi-period return analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Initial Investment ($)</Label>
              <Input type="number" value={initialInvestment} onChange={(e) => setInitialInvestment(e.target.value)} />
            </div>
            <div>
              <Label>Year 1 Cash Flow ($)</Label>
              <Input type="number" value={year1} onChange={(e) => setYear1(e.target.value)} />
            </div>
            <div>
              <Label>Year 2 Cash Flow ($)</Label>
              <Input type="number" value={year2} onChange={(e) => setYear2(e.target.value)} />
            </div>
            <div>
              <Label>Year 3 Cash Flow ($)</Label>
              <Input type="number" value={year3} onChange={(e) => setYear3(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Exit Value ($)</Label>
              <Input type="number" value={exitValue} onChange={(e) => setExitValue(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Returns Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-3 bg-emerald-50 rounded-lg px-3">
              <span className="font-semibold">IRR</span>
              <span className="font-bold text-emerald-600">{irr}%</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Equity Multiple</span>
              <span className="font-semibold">{multiple.toFixed(2)}x</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Profit</span>
              <span className="font-semibold text-green-600">${totalCashFlow.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SensitivityPanel() {
  const [baseNOI, setBaseNOI] = useState<string>("500000");
  const [baseCapRate, setBaseCapRate] = useState<string>("6");

  const capRates = [5, 5.5, 6, 6.5, 7];
  const noiChanges = [-10, -5, 0, 5, 10];

  const calculateValue = (noi: number, capRate: number) => {
    return noi / (capRate / 100);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-500" />
            Sensitivity Analysis
          </CardTitle>
          <CardDescription>
            NOI & Cap Rate sensitivity matrix
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div>
              <Label>Base NOI ($)</Label>
              <Input type="number" value={baseNOI} onChange={(e) => setBaseNOI(e.target.value)} />
            </div>
            <div>
              <Label>Base Cap Rate (%)</Label>
              <Input type="number" value={baseCapRate} onChange={(e) => setBaseCapRate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Value Sensitivity Matrix</CardTitle>
          <CardDescription>Property value at different NOI and Cap Rate combinations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">NOI / Cap Rate</th>
                  {capRates.map(cr => (
                    <th key={cr} className="p-2 text-center">{cr}%</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {noiChanges.map(change => {
                  const noi = (parseFloat(baseNOI) || 0) * (1 + change / 100);
                  return (
                    <tr key={change} className="border-b">
                      <td className="p-2 font-medium">
                        ${noi.toLocaleString()} ({change >= 0 ? '+' : ''}{change}%)
                      </td>
                      {capRates.map(cr => {
                        const value = calculateValue(noi, cr);
                        const isBase = change === 0 && cr === parseFloat(baseCapRate);
                        return (
                          <td 
                            key={cr} 
                            className={`p-2 text-center ${isBase ? 'bg-blue-100 font-bold' : ''}`}
                          >
                            ${(value / 1000000).toFixed(2)}M
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
    </div>
  );
}

function AIInsightsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-pink-500" />
          AI Insights
        </CardTitle>
        <CardDescription>
          AI-powered exit recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">AI Analysis Requires Project Data</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            To get AI-powered exit recommendations, open a modeling project and use the Exit Strategy tab. 
            The AI will analyze your project's financial data, market conditions, and comparable sales 
            to provide personalized exit strategy recommendations.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
