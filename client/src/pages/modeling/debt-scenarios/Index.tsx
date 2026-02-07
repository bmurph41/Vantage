import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import { Calculator, TrendingUp, AlertCircle, Save, Trash2, Copy, Upload, Layers } from "lucide-react";
import { format, subYears } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DebtScenario } from "@shared/schema";
import LoanBuilder from '@/components/modeling/LoanBuilder';

// FRED Series IDs for base rates
const BASE_RATE_OPTIONS = [
  { id: "SOFR", name: "SOFR (Secured Overnight Financing Rate)", category: "SOFR" },
  { id: "SOFR30DAYAVG", name: "30-Day Average SOFR", category: "SOFR" },
  { id: "SOFR90DAYAVG", name: "90-Day Average SOFR", category: "SOFR" },
  { id: "DFF", name: "Fed Funds Rate", category: "Fed" },
  { id: "DPRIME", name: "Prime Rate", category: "Prime" },
  { id: "DGS2", name: "2-Year Treasury", category: "Treasury" },
  { id: "DGS5", name: "5-Year Treasury", category: "Treasury" },
  { id: "DGS10", name: "10-Year Treasury", category: "Treasury" },
  { id: "DGS30", name: "30-Year Treasury", category: "Treasury" },
];

type TimeRange = "1Y" | "2Y" | "5Y" | "10Y" | "ALL";

// Formatting helpers
const formatCurrency = (value: number): string => {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

interface ScenarioInputs {
  name: string;
  baseRate: string;
  spreadBps: string;
  purchasePrice: string;
  loanAmount: string;
  ltvPercent: string;
  noi: string;
  capRate: string;
  amortizationYears: string;
  loanTermYears: string;
  interestOnlyYears: string;
}

// Helper to format number input with commas
const formatNumberWithCommas = (value: string): string => {
  const num = value.replace(/,/g, '');
  if (!num || isNaN(Number(num))) return value;
  return Number(num).toLocaleString('en-US');
};

// Helper to parse formatted number
const parseFormattedNumber = (value: string): number => {
  return parseFloat(value.replace(/,/g, '')) || 0;
};

export default function DebtScenariosIndex() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("rates");
  const [timeRange, setTimeRange] = useState<TimeRange>("5Y");
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  
  // Scenario inputs
  const [inputs, setInputs] = useState<ScenarioInputs>({
    name: "Scenario 1",
    baseRate: "SOFR",
    spreadBps: "250",
    purchasePrice: "10,000,000",
    loanAmount: "7,000,000",
    ltvPercent: "70",
    noi: "800,000",
    capRate: "8",
    amortizationYears: "25",
    loanTermYears: "10",
    interestOnlyYears: "0",
  });

  const updateInput = (key: keyof ScenarioInputs, value: string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  // Bidirectional calculation handlers
  const handlePurchasePriceChange = (value: string) => {
    setInputs(prev => {
      const newInputs = { ...prev, purchasePrice: value };
      const pp = parseFormattedNumber(value);
      const capRate = parseFloat(prev.capRate);
      const ltvPct = parseFloat(prev.ltvPercent);
      
      // Auto-calculate NOI if cap rate is set
      if (capRate > 0 && pp > 0) {
        newInputs.noi = formatNumberWithCommas(Math.round(pp * capRate / 100).toString());
      }
      
      // Auto-calculate loan amount if LTV is set
      if (ltvPct > 0 && pp > 0) {
        newInputs.loanAmount = formatNumberWithCommas(Math.round(pp * ltvPct / 100).toString());
      }
      
      return newInputs;
    });
  };

  const handleNoiChange = (value: string) => {
    setInputs(prev => {
      const newInputs = { ...prev, noi: value };
      const noi = parseFormattedNumber(value);
      const capRate = parseFloat(prev.capRate);
      
      // Auto-calculate purchase price if cap rate is set
      if (capRate > 0 && noi > 0) {
        const pp = noi / (capRate / 100);
        newInputs.purchasePrice = formatNumberWithCommas(Math.round(pp).toString());
        
        // Also update loan amount if LTV is set
        const ltvPct = parseFloat(prev.ltvPercent);
        if (ltvPct > 0) {
          newInputs.loanAmount = formatNumberWithCommas(Math.round(pp * ltvPct / 100).toString());
        }
      }
      
      return newInputs;
    });
  };

  const handleCapRateChange = (value: string) => {
    setInputs(prev => {
      const newInputs = { ...prev, capRate: value };
      const capRate = parseFloat(value);
      const pp = parseFormattedNumber(prev.purchasePrice);
      const noi = parseFormattedNumber(prev.noi);
      
      if (capRate > 0) {
        // If we have purchase price, calculate NOI
        if (pp > 0) {
          newInputs.noi = formatNumberWithCommas(Math.round(pp * capRate / 100).toString());
        }
        // If we have NOI but not purchase price, calculate purchase price
        else if (noi > 0) {
          const newPP = noi / (capRate / 100);
          newInputs.purchasePrice = formatNumberWithCommas(Math.round(newPP).toString());
          
          // Also update loan amount if LTV is set
          const ltvPct = parseFloat(prev.ltvPercent);
          if (ltvPct > 0) {
            newInputs.loanAmount = formatNumberWithCommas(Math.round(newPP * ltvPct / 100).toString());
          }
        }
      }
      
      return newInputs;
    });
  };

  const handleLoanAmountChange = (value: string) => {
    setInputs(prev => {
      const newInputs = { ...prev, loanAmount: value };
      const loanAmt = parseFormattedNumber(value);
      const pp = parseFormattedNumber(prev.purchasePrice);
      
      // Auto-calculate LTV if purchase price is set
      if (pp > 0 && loanAmt > 0) {
        const ltv = (loanAmt / pp) * 100;
        newInputs.ltvPercent = ltv.toFixed(2);
      }
      
      return newInputs;
    });
  };

  const handleLtvChange = (value: string) => {
    setInputs(prev => {
      const newInputs = { ...prev, ltvPercent: value };
      const ltvPct = parseFloat(value);
      const pp = parseFormattedNumber(prev.purchasePrice);
      
      // Auto-calculate loan amount if purchase price is set
      if (pp > 0 && ltvPct > 0) {
        newInputs.loanAmount = formatNumberWithCommas(Math.round(pp * ltvPct / 100).toString());
      }
      
      return newInputs;
    });
  };

  // Query: Load saved scenarios
  const { data: savedScenarios = [], isLoading: scenariosLoading } = useQuery<DebtScenario[]>({
    queryKey: ['/api/modeling/debt-scenarios'],
  });

  // Mutation: Save scenario
  const saveMutation = useMutation({
    mutationFn: async () => {
      const scenarioData = {
        name: inputs.name,
        baseRate: inputs.baseRate,
        spreadBps: parseFloat(inputs.spreadBps),
        purchasePrice: parseFormattedNumber(inputs.purchasePrice),
        loanAmount: parseFormattedNumber(inputs.loanAmount),
        noi: parseFormattedNumber(inputs.noi),
        amortizationYears: parseInt(inputs.amortizationYears),
        loanTermYears: parseInt(inputs.loanTermYears),
        interestOnlyYears: parseInt(inputs.interestOnlyYears),
        dealId: null,
        projectId: null,
      };

      if (currentScenarioId) {
        // Update existing
        return await apiRequest(`/api/modeling/debt-scenarios/${currentScenarioId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenarioData),
        });
      } else {
        // Create new
        return await apiRequest('/api/modeling/debt-scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenarioData),
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/debt-scenarios'] });
      setCurrentScenarioId(data.id);
      toast({
        title: "Scenario Saved",
        description: `"${data.name}" has been saved successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save scenario. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation: Delete scenario
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/modeling/debt-scenarios/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/debt-scenarios'] });
      toast({
        title: "Scenario Deleted",
        description: "The scenario has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete scenario. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Load scenario into form
  const loadScenario = (scenario: DebtScenario) => {
    const pp = scenario.purchasePrice;
    const loanAmt = scenario.loanAmount;
    const noi = scenario.noi;
    const ltv = pp > 0 ? (loanAmt / pp) * 100 : 0;
    const cap = pp > 0 ? (noi / pp) * 100 : 0;
    
    setInputs({
      name: scenario.name,
      baseRate: scenario.baseRate,
      spreadBps: scenario.spreadBps.toString(),
      purchasePrice: formatNumberWithCommas(scenario.purchasePrice.toString()),
      loanAmount: formatNumberWithCommas(scenario.loanAmount.toString()),
      ltvPercent: ltv.toFixed(2),
      noi: formatNumberWithCommas(scenario.noi.toString()),
      capRate: cap.toFixed(2),
      amortizationYears: scenario.amortizationYears.toString(),
      loanTermYears: scenario.loanTermYears.toString(),
      interestOnlyYears: scenario.interestOnlyYears.toString(),
    });
    setCurrentScenarioId(scenario.id);
    setActiveTab("rates");
    toast({
      title: "Scenario Loaded",
      description: `"${scenario.name}" is now active.`,
    });
  };

  // Create new scenario (reset form)
  const newScenario = () => {
    setInputs({
      name: `New Scenario ${savedScenarios.length + 1}`,
      baseRate: "SOFR",
      spreadBps: "250",
      purchasePrice: "10,000,000",
      loanAmount: "7,000,000",
      ltvPercent: "70",
      noi: "800,000",
      capRate: "8",
      amortizationYears: "25",
      loanTermYears: "10",
      interestOnlyYears: "0",
    });
    setCurrentScenarioId(null);
    setActiveTab("rates");
  };

  const getStartDate = (range: TimeRange): string => {
    const now = new Date();
    switch (range) {
      case "1Y": return format(subYears(now, 1), "yyyy-MM-dd");
      case "2Y": return format(subYears(now, 2), "yyyy-MM-dd");
      case "5Y": return format(subYears(now, 5), "yyyy-MM-dd");
      case "10Y": return format(subYears(now, 10), "yyyy-MM-dd");
      case "ALL": return "2000-01-01";
    }
  };

  const selectedRate = BASE_RATE_OPTIONS.find(r => r.id === inputs.baseRate);

  const { data: rateData, isLoading: rateLoading } = useQuery({
    queryKey: [`/api/benchmarks/fred/${inputs.baseRate}`, getStartDate(timeRange)],
    queryFn: async () => {
      const response = await fetch(`/api/benchmarks/fred/${inputs.baseRate}?startDate=${getStartDate(timeRange)}`);
      if (!response.ok) throw new Error("Failed to fetch data");
      return response.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  // Calculate metrics
  const spreadPercent = parseFloat(inputs.spreadBps || "0") / 100;
  const observations = rateData?.observations?.filter((obs: any) => obs.value !== ".") || [];
  const currentBaseRate = observations.length > 0 ? parseFloat(observations[observations.length - 1].value) : 0;
  const effectiveRate = currentBaseRate + spreadPercent;
  
  const purchasePrice = parseFormattedNumber(inputs.purchasePrice || "0");
  const loanAmount = parseFormattedNumber(inputs.loanAmount || "0");
  const noi = parseFormattedNumber(inputs.noi || "0");
  const amortYears = parseInt(inputs.amortizationYears || "25");
  const loanTermYears = parseInt(inputs.loanTermYears || "10");
  const ioYears = parseInt(inputs.interestOnlyYears || "0");
  
  const ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
  const equity = purchasePrice - loanAmount;
  
  // Calculate monthly payment
  const monthlyRate = effectiveRate / 100 / 12;
  const amortMonths = amortYears * 12;
  const ioMonths = ioYears * 12;
  
  let monthlyPayment = 0;
  if (loanAmount > 0 && effectiveRate > 0) {
    if (monthlyRate > 0 && amortMonths > 0) {
      monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths)) / (Math.pow(1 + monthlyRate, amortMonths) - 1);
    }
  }
  
  const monthlyIOPayment = loanAmount * (effectiveRate / 100 / 12);
  const annualDebtService = ioYears > 0 
    ? (monthlyIOPayment * 12 * ioYears + monthlyPayment * 12 * (loanTermYears - ioYears)) / loanTermYears
    : monthlyPayment * 12;
  
  const dscr = noi > 0 && annualDebtService > 0 ? noi / annualDebtService : 0;
  const debtYield = loanAmount > 0 ? (noi / loanAmount) * 100 : 0;
  const annualCashFlow = noi - annualDebtService;
  const cashOnCash = equity > 0 ? (annualCashFlow / equity) * 100 : 0;
  
  // Calculate balloon payment
  const loanTermMonths = loanTermYears * 12;
  let balloonPayment = 0;
  if (loanTermMonths < amortMonths && loanAmount > 0) {
    let balance = loanAmount;
    for (let i = 0; i < loanTermMonths; i++) {
      const interest = balance * monthlyRate;
      const principal = i < ioMonths ? 0 : monthlyPayment - interest;
      balance -= principal;
    }
    balloonPayment = balance;
  }

  // Generate amortization schedule
  const generateAmortizationSchedule = () => {
    const schedule = [];
    let balance = loanAmount;
    const totalMonths = Math.min(loanTermMonths, amortMonths);
    
    for (let year = 1; year <= Math.ceil(totalMonths / 12); year++) {
      let yearPrincipal = 0;
      let yearInterest = 0;
      const startMonth = (year - 1) * 12;
      const endMonth = Math.min(year * 12, totalMonths);
      
      for (let month = startMonth; month < endMonth; month++) {
        const interest = balance * monthlyRate;
        const principal = month < ioMonths ? 0 : monthlyPayment - interest;
        yearPrincipal += principal;
        yearInterest += interest;
        balance -= principal;
      }
      
      schedule.push({
        year,
        payment: (year <= ioYears ? monthlyIOPayment : monthlyPayment) * 12,
        principal: yearPrincipal,
        interest: yearInterest,
        balance: Math.max(0, balance),
      });
    }
    
    return schedule;
  };

  const amortSchedule = generateAmortizationSchedule();

  // Historical chart data
  const chartData = observations.map((obs: any) => {
    const baseValue = parseFloat(obs.value);
    return {
      date: obs.date,
      baseRate: baseValue,
      effectiveRate: baseValue + spreadPercent,
    };
  });

  return (
    <div>
      {/* Scenario Management Card */}
      <Card className="mb-6 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="scenario-name" className="text-sm font-medium mb-1 block">
                Scenario Name
              </Label>
              <Input
                id="scenario-name"
                value={inputs.name}
                onChange={(e) => updateInput("name", e.target.value)}
                placeholder="Enter scenario name"
                data-testid="input-scenario-name"
                className="max-w-md"
              />
            </div>
            <div className="flex gap-2 pt-5">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !inputs.name.trim()}
                data-testid="button-save-scenario"
              >
                <Save className="w-4 h-4 mr-2" />
                {currentScenarioId ? "Update Scenario" : "Save Scenario"}
              </Button>
              {currentScenarioId && (
                <Button
                  onClick={newScenario}
                  variant="outline"
                  data-testid="button-clear-scenario"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  New
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rates" data-testid="tab-rates">Rate Analysis</TabsTrigger>
          <TabsTrigger value="underwriting" data-testid="tab-underwriting">Underwriting Metrics</TabsTrigger>
          <TabsTrigger value="advanced" data-testid="tab-advanced" className="gap-1">
            <Layers className="h-4 w-4" />
            Advanced Debt
          </TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">Saved Scenarios</TabsTrigger>
        </TabsList>

        {/* Tab 1: Rate Analysis */}
        <TabsContent value="rates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Base Rate & Spread Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="base-rate">Base Rate</Label>
                  <Select value={inputs.baseRate} onValueChange={(v) => updateInput("baseRate", v)}>
                    <SelectTrigger id="base-rate" data-testid="select-base-rate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">SOFR Rates</div>
                      {BASE_RATE_OPTIONS.filter(r => r.category === "SOFR").map(rate => (
                        <SelectItem key={rate.id} value={rate.id}>{rate.name}</SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Fed & Prime</div>
                      {BASE_RATE_OPTIONS.filter(r => r.category === "Fed" || r.category === "Prime").map(rate => (
                        <SelectItem key={rate.id} value={rate.id}>{rate.name}</SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Treasury Rates</div>
                      {BASE_RATE_OPTIONS.filter(r => r.category === "Treasury").map(rate => (
                        <SelectItem key={rate.id} value={rate.id}>{rate.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spread">Spread (Basis Points)</Label>
                  <div className="relative">
                    <Input
                      id="spread"
                      type="number"
                      value={inputs.spreadBps}
                      onChange={(e) => updateInput("spreadBps", e.target.value)}
                      placeholder="250"
                      className="pr-12"
                      data-testid="input-spread"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      bps
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatPercentage(spreadPercent)} ({inputs.spreadBps} basis points)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time-range">Time Range</Label>
                  <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                    <SelectTrigger id="time-range" data-testid="select-time-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1Y">1 Year</SelectItem>
                      <SelectItem value="2Y">2 Years</SelectItem>
                      <SelectItem value="5Y">5 Years</SelectItem>
                      <SelectItem value="10Y">10 Years</SelectItem>
                      <SelectItem value="ALL">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Current Base Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-3xl font-bold" data-testid="text-current-base-rate">
                    {formatPercentage(currentBaseRate)}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedRate?.name}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Spread</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-primary" data-testid="text-spread-display">
                    +{formatPercentage(spreadPercent)}
                  </p>
                  <p className="text-sm text-muted-foreground">{inputs.spreadBps} basis points</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Effective Interest Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-primary" data-testid="text-effective-rate">
                    {formatPercentage(effectiveRate)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPercentage(currentBaseRate)} + {formatPercentage(spreadPercent)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Historical Rate Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {rateLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                </div>
              ) : chartData.length > 0 ? (
                <div style={{ width: '100%', height: 400 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => format(new Date(date), "MMM yy")}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        stroke="#666"
                      />
                      <YAxis
                        domain={['dataMin - 0.5', 'dataMax + 0.5']}
                        tickFormatter={(value) => `${Number(value).toFixed(2)}%`}
                        stroke="#666"
                      />
                      <Tooltip
                        labelFormatter={(date) => format(new Date(String(date)), "MMMM dd, yyyy")}
                        formatter={(value: any, name: string) => {
                          const label = name === "baseRate" ? "Base Rate" : "Effective Rate";
                          return [`${Number(value).toFixed(2)}%`, label];
                        }}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="baseRate" stroke="#8884d8" strokeWidth={2} dot={false} name="Base Rate" isAnimationActive={false} />
                      <Line type="monotone" dataKey="effectiveRate" stroke="#82ca9d" strokeWidth={2} dot={false} name="Effective Rate" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Underwriting Metrics */}
        <TabsContent value="underwriting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Property & Loan Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4 p-4 bg-accent/20 rounded-lg">
                  <h4 className="text-sm font-semibold text-muted-foreground">Property Valuation</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="purchase-price">Purchase Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="purchase-price"
                        type="text"
                        value={inputs.purchasePrice}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          if (value === '' || /^\d+$/.test(value)) {
                            handlePurchasePriceChange(formatNumberWithCommas(value));
                          }
                        }}
                        className="pl-7"
                        data-testid="input-purchase-price"
                        placeholder="10,000,000"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground italic">Or calculate from NOI ÷ Cap Rate</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="noi">NOI (Annual)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          id="noi"
                          type="text"
                          value={inputs.noi}
                          onChange={(e) => {
                            const value = e.target.value.replace(/,/g, '');
                            if (value === '' || /^\d+$/.test(value)) {
                              handleNoiChange(formatNumberWithCommas(value));
                            }
                          }}
                          className="pl-7"
                          data-testid="input-noi"
                          placeholder="800,000"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cap-rate">Cap Rate</Label>
                      <div className="relative">
                        <Input
                          id="cap-rate"
                          type="number"
                          step="0.01"
                          value={inputs.capRate}
                          onChange={(e) => handleCapRateChange(e.target.value)}
                          className="pr-8"
                          data-testid="input-cap-rate"
                          placeholder="8.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-4 bg-accent/20 rounded-lg">
                  <h4 className="text-sm font-semibold text-muted-foreground">Debt Structure</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="loan-amount">Loan Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="loan-amount"
                        type="text"
                        value={inputs.loanAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/,/g, '');
                          if (value === '' || /^\d+$/.test(value)) {
                            handleLoanAmountChange(formatNumberWithCommas(value));
                          }
                        }}
                        className="pl-7"
                        data-testid="input-loan-amount"
                        placeholder="7,000,000"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground italic">Or calculate from LTV %</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ltv-percent">Loan-to-Value (LTV)</Label>
                    <div className="relative">
                      <Input
                        id="ltv-percent"
                        type="number"
                        step="0.01"
                        value={inputs.ltvPercent}
                        onChange={(e) => handleLtvChange(e.target.value)}
                        className="pr-8"
                        data-testid="input-ltv-percent"
                        placeholder="70.00"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Equity: {formatCurrency(equity)}
                    </p>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="amort-years">Amortization Period</Label>
                  <Select value={inputs.amortizationYears} onValueChange={(v) => updateInput("amortizationYears", v)}>
                    <SelectTrigger id="amort-years" data-testid="select-amort-years">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 Years</SelectItem>
                      <SelectItem value="25">25 Years</SelectItem>
                      <SelectItem value="30">30 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loan-term">Loan Term</Label>
                  <Select value={inputs.loanTermYears} onValueChange={(v) => updateInput("loanTermYears", v)}>
                    <SelectTrigger id="loan-term" data-testid="select-loan-term">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Years</SelectItem>
                      <SelectItem value="7">7 Years</SelectItem>
                      <SelectItem value="10">10 Years</SelectItem>
                      <SelectItem value="15">15 Years</SelectItem>
                      <SelectItem value="20">20 Years</SelectItem>
                      <SelectItem value="25">25 Years</SelectItem>
                      <SelectItem value="30">30 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="io-years">Interest-Only Period</Label>
                  <Select value={inputs.interestOnlyYears} onValueChange={(v) => updateInput("interestOnlyYears", v)}>
                    <SelectTrigger id="io-years" data-testid="select-io-years">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">None</SelectItem>
                      <SelectItem value="1">1 Year</SelectItem>
                      <SelectItem value="2">2 Years</SelectItem>
                      <SelectItem value="3">3 Years</SelectItem>
                      <SelectItem value="5">5 Years</SelectItem>
                      <SelectItem value="10">10 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">LTV</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="metric-ltv">{formatPercentage(ltv)}</p>
                <p className="text-xs text-muted-foreground mt-1">Loan-to-Value</p>
              </CardContent>
            </Card>

            <Card className={dscr < 1.2 ? "border-yellow-500" : "border-green-500"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">DSCR</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="metric-dscr">{dscr.toFixed(2)}x</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {dscr >= 1.25 ? "Strong" : dscr >= 1.2 ? "Acceptable" : "Weak"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Debt Yield</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="metric-debt-yield">{formatPercentage(debtYield)}</p>
                <p className="text-xs text-muted-foreground mt-1">NOI / Loan</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Annual Debt Service</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" data-testid="metric-debt-service">
                  {formatCurrency(annualDebtService)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(monthlyPayment)}/mo</p>
              </CardContent>
            </Card>

            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cash-on-Cash</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary" data-testid="metric-coc">{formatPercentage(cashOnCash)}</p>
                <p className="text-xs text-muted-foreground mt-1">Levered Return</p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Monthly Payment</p>
                  <p className="text-3xl font-bold" data-testid="text-monthly-payment">{formatCurrency(monthlyPayment)}</p>
                  {ioYears > 0 && (
                    <p className="text-sm text-muted-foreground" data-testid="text-io-payment">IO: {formatCurrency(monthlyIOPayment)} for {ioYears} years</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Annual Debt Service</p>
                  <p className="text-3xl font-bold" data-testid="text-annual-debt-service">{formatCurrency(annualDebtService)}</p>
                  <p className="text-sm text-muted-foreground">Total yearly payment</p>
                </div>
                {balloonPayment > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Balloon Payment</p>
                    <p className="text-3xl font-bold text-orange-600" data-testid="text-balloon-payment">{formatCurrency(balloonPayment)}</p>
                    <p className="text-sm text-muted-foreground">Due at year {loanTermYears}</p>
                  </div>
                )}
              </div>

              {amortSchedule.length > 0 && (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={amortSchedule} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip
                        formatter={(value: any) => formatCurrency(Number(value))}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                      />
                      <Legend />
                      <Bar dataKey="principal" stackId="a" fill="#82ca9d" name="Principal" />
                      <Bar dataKey="interest" stackId="a" fill="#8884d8" name="Interest" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Amortization Schedule Table */}
          {amortSchedule.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Amortization Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Year</th>
                        <th className="text-right p-2">Payment</th>
                        <th className="text-right p-2">Principal</th>
                        <th className="text-right p-2">Interest</th>
                        <th className="text-right p-2">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {amortSchedule.map((row) => (
                        <tr key={row.year} className="border-b">
                          <td className="p-2">{row.year}</td>
                          <td className="text-right p-2">{formatCurrency(row.payment)}</td>
                          <td className="text-right p-2">{formatCurrency(row.principal)}</td>
                          <td className="text-right p-2">{formatCurrency(row.interest)}</td>
                          <td className="text-right p-2 font-medium">{formatCurrency(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3: Advanced Debt Modeling */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Multi-Loan Debt Builder
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Build complex loan structures, view blended metrics, compare scenarios, and run DSCR covenant testing
              </p>
            </CardHeader>
            <CardContent>
              <LoanBuilder 
                projectId="standalone"
                purchasePrice={parseFormattedNumber(inputs.purchasePrice)}
                noi={parseFormattedNumber(inputs.noi)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Saved Scenarios */}
        <TabsContent value="scenarios" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Saved Scenarios</CardTitle>
              <Button onClick={newScenario} data-testid="button-new-scenario">
                <Copy className="w-4 h-4 mr-2" />
                New Scenario
              </Button>
            </CardHeader>
            <CardContent>
              {scenariosLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading scenarios...</div>
              ) : savedScenarios.length === 0 ? (
                <div className="text-center py-12">
                  <Save className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Saved Scenarios</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-4">
                    Create and save debt scenarios to compare different financing structures.
                  </p>
                  <Button onClick={newScenario} data-testid="button-create-first">
                    <Save className="w-4 h-4 mr-2" />
                    Create Your First Scenario
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedScenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-lg">{scenario.name}</h4>
                          {currentScenarioId === scenario.id && (
                            <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Purchase Price:</span>
                            <p className="font-medium" data-testid={`text-purchase-price-${scenario.id}`}>{formatCurrency(scenario.purchasePrice)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Loan Amount:</span>
                            <p className="font-medium" data-testid={`text-loan-amount-${scenario.id}`}>{formatCurrency(scenario.loanAmount)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">LTV:</span>
                            <p className="font-medium" data-testid={`text-ltv-${scenario.id}`}>
                              {formatPercentage((scenario.loanAmount / scenario.purchasePrice) * 100)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Base Rate:</span>
                            <p className="font-medium" data-testid={`text-base-rate-${scenario.id}`}>
                              {BASE_RATE_OPTIONS.find(r => r.id === scenario.baseRate)?.name || scenario.baseRate}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Last updated: {format(new Date(scenario.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          onClick={() => loadScenario(scenario)}
                          variant="outline"
                          size="sm"
                          data-testid={`button-load-${scenario.id}`}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Load
                        </Button>
                        <Button
                          onClick={() => {
                            if (confirm(`Delete "${scenario.name}"?`)) {
                              deleteMutation.mutate(scenario.id);
                              if (currentScenarioId === scenario.id) {
                                setCurrentScenarioId(null);
                              }
                            }
                          }}
                          variant="outline"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${scenario.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Information Card */}
      <Card className="mt-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-900">Underwriting Guidance:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li><strong>DSCR 1.20-1.25x:</strong> Minimum acceptable for most lenders</li>
                <li><strong>DSCR 1.35x+:</strong> Preferred for agency loans</li>
                <li><strong>LTV 65-75%:</strong> Typical for marina acquisitions</li>
                <li><strong>Debt Yield 10%+:</strong> Strong loan performance indicator</li>
                <li><strong>Balloon Payment:</strong> Occurs when loan term is shorter than amortization period</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
