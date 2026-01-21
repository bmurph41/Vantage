import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, BarChart, Bar, Area, AreaChart 
} from "recharts";
import { 
  Calculator, TrendingUp, AlertCircle, Save, Trash2, Copy, 
  DollarSign, Percent, Calendar, Building2, ArrowRight,
  RefreshCw, FileSpreadsheet, ChevronRight, ExternalLink
} from "lucide-react";
import { format, subYears } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DebtScenario, ModelingProject } from "@shared/schema";
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';

interface WorkspaceDebtScenariosProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

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

const formatNumberWithCommas = (value: string): string => {
  const num = value.replace(/,/g, '');
  if (!num || isNaN(Number(num))) return value;
  return Number(num).toLocaleString('en-US');
};

const parseFormattedNumber = (value: string): number => {
  return parseFloat(value.replace(/,/g, '')) || 0;
};

export default function WorkspaceDebtScenarios({ projectId, onTabChange }: WorkspaceDebtScenariosProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState<TimeRange>("5Y");
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

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

  useEffect(() => {
    if (project) {
      const pp = Number(project.purchasePrice) || 10000000;
      const noi = Number(project.ebitda) || 800000;
      const capRate = pp > 0 ? (noi / pp) * 100 : 8;
      const ltvPercent = 70;
      const loanAmount = pp * (ltvPercent / 100);

      setInputs(prev => ({
        ...prev,
        name: `${project.marinaName || 'Project'} - Scenario 1`,
        purchasePrice: formatNumberWithCommas(Math.round(pp).toString()),
        noi: formatNumberWithCommas(Math.round(noi).toString()),
        capRate: capRate.toFixed(2),
        ltvPercent: ltvPercent.toString(),
        loanAmount: formatNumberWithCommas(Math.round(loanAmount).toString()),
      }));
    }
  }, [project]);

  const updateInput = (key: keyof ScenarioInputs, value: string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const handlePurchasePriceChange = (value: string) => {
    setInputs(prev => {
      const newInputs = { ...prev, purchasePrice: value };
      const pp = parseFormattedNumber(value);
      const capRate = parseFloat(prev.capRate);
      const ltvPct = parseFloat(prev.ltvPercent);
      
      if (capRate > 0 && pp > 0) {
        newInputs.noi = formatNumberWithCommas(Math.round(pp * capRate / 100).toString());
      }
      
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
      
      if (capRate > 0 && noi > 0) {
        const pp = noi / (capRate / 100);
        newInputs.purchasePrice = formatNumberWithCommas(Math.round(pp).toString());
        
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
        if (pp > 0) {
          newInputs.noi = formatNumberWithCommas(Math.round(pp * capRate / 100).toString());
        } else if (noi > 0) {
          const newPP = noi / (capRate / 100);
          newInputs.purchasePrice = formatNumberWithCommas(Math.round(newPP).toString());
          
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
      
      if (pp > 0 && ltvPct > 0) {
        newInputs.loanAmount = formatNumberWithCommas(Math.round(pp * ltvPct / 100).toString());
      }
      
      return newInputs;
    });
  };

  const { data: savedScenarios = [], isLoading: scenariosLoading } = useQuery<DebtScenario[]>({
    queryKey: ['/api/modeling/projects', projectId, 'debt-scenarios'],
  });

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
        projectId: parseInt(projectId),
      };

      if (currentScenarioId) {
        return await apiRequest(`/api/modeling/projects/${projectId}/debt-scenarios/${currentScenarioId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenarioData),
        });
      } else {
        return await apiRequest(`/api/modeling/projects/${projectId}/debt-scenarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenarioData),
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'debt-scenarios'] });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/modeling/projects/${projectId}/debt-scenarios/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'debt-scenarios'] });
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
    setActiveTab("calculator");
    toast({
      title: "Scenario Loaded",
      description: `"${scenario.name}" is now active.`,
    });
  };

  const newScenario = () => {
    const pp = Number(project?.purchasePrice) || 10000000;
    const noi = Number(project?.ebitda) || 800000;
    const capRate = pp > 0 ? (noi / pp) * 100 : 8;
    const ltvPercent = 70;
    const loanAmount = pp * (ltvPercent / 100);

    setInputs({
      name: `${project?.marinaName || 'Project'} - Scenario ${savedScenarios.length + 1}`,
      baseRate: "SOFR",
      spreadBps: "250",
      purchasePrice: formatNumberWithCommas(Math.round(pp).toString()),
      loanAmount: formatNumberWithCommas(Math.round(loanAmount).toString()),
      ltvPercent: ltvPercent.toString(),
      noi: formatNumberWithCommas(Math.round(noi).toString()),
      capRate: capRate.toFixed(2),
      amortizationYears: "25",
      loanTermYears: "10",
      interestOnlyYears: "0",
    });
    setCurrentScenarioId(null);
    setActiveTab("calculator");
  };

  const purchasePrice = parseFormattedNumber(inputs.purchasePrice);
  const loanAmount = parseFormattedNumber(inputs.loanAmount);
  const equity = purchasePrice - loanAmount;
  const noi = parseFormattedNumber(inputs.noi);
  const spreadBps = parseFloat(inputs.spreadBps) || 0;
  const baseRateValue = 4.5;
  const allInRate = baseRateValue + (spreadBps / 100);
  const annualDebtService = calculateDebtService(loanAmount, allInRate, parseInt(inputs.amortizationYears), parseInt(inputs.interestOnlyYears));
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;
  const debtYield = loanAmount > 0 ? (noi / loanAmount) * 100 : 0;
  const cashOnCash = equity > 0 ? ((noi - annualDebtService) / equity) * 100 : 0;

  function calculateDebtService(principal: number, rate: number, amortYears: number, ioYears: number): number {
    if (principal <= 0 || rate <= 0) return 0;
    
    if (ioYears > 0) {
      return principal * (rate / 100);
    }
    
    const monthlyRate = rate / 100 / 12;
    const numPayments = amortYears * 12;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    return monthlyPayment * 12;
  }

  const amortizationSchedule = generateAmortizationSchedule();

  function generateAmortizationSchedule() {
    const schedule = [];
    let balance = loanAmount;
    const monthlyRate = allInRate / 100 / 12;
    const numPayments = parseInt(inputs.amortizationYears) * 12;
    const ioMonths = parseInt(inputs.interestOnlyYears) * 12;
    
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    
    for (let year = 1; year <= Math.min(parseInt(inputs.loanTermYears), 10); year++) {
      let yearInterest = 0;
      let yearPrincipal = 0;
      
      for (let month = 1; month <= 12; month++) {
        const currentMonth = (year - 1) * 12 + month;
        const interest = balance * monthlyRate;
        
        if (currentMonth <= ioMonths) {
          yearInterest += interest;
        } else {
          yearInterest += interest;
          const principal = monthlyPayment - interest;
          yearPrincipal += principal;
          balance -= principal;
        }
      }
      
      schedule.push({
        year: `Year ${year}`,
        interest: Math.round(yearInterest),
        principal: Math.round(yearPrincipal),
        balance: Math.round(balance),
        payment: Math.round(yearInterest + yearPrincipal),
      });
    }
    
    return schedule;
  }

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Debt Scenarios</h2>
          <p className="text-sm text-muted-foreground">
            Model financing options for {project?.marinaName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/modeling/debt-scenarios')}
            data-testid="button-standalone-debt"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Quick Calculator
          </Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending}
            data-testid="button-save-debt-scenario"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Scenario'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Loan Amount</p>
                <p className="text-lg font-bold" data-testid="text-loan-amount">{formatCurrency(loanAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <Percent className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">All-In Rate</p>
                <p className="text-lg font-bold" data-testid="text-all-in-rate">{formatPercentage(allInRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">DSCR</p>
                <p className="text-lg font-bold" data-testid="text-dscr">{dscr.toFixed(2)}x</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Calculator className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cash-on-Cash</p>
                <p className="text-lg font-bold" data-testid="text-cash-on-cash">{formatPercentage(cashOnCash)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-debt-overview">Overview</TabsTrigger>
          <TabsTrigger value="calculator" data-testid="tab-debt-calculator">Calculator</TabsTrigger>
          <TabsTrigger value="amortization" data-testid="tab-debt-amortization">Amortization</TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-debt-scenarios">Saved Scenarios</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deal Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Purchase Price</span>
                  <span className="font-medium">{formatCurrency(purchasePrice)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Loan Amount</span>
                  <span className="font-medium">{formatCurrency(loanAmount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Equity Required</span>
                  <span className="font-medium">{formatCurrency(equity)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">LTV</span>
                  <span className="font-medium">{inputs.ltvPercent}%</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Cap Rate</span>
                  <span className="font-medium">{inputs.capRate}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Loan Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Base Rate</span>
                  <span className="font-medium">{inputs.baseRate}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Spread</span>
                  <span className="font-medium">{inputs.spreadBps} bps</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">All-In Rate</span>
                  <span className="font-medium">{formatPercentage(allInRate)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Loan Term</span>
                  <span className="font-medium">{inputs.loanTermYears} years</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Amortization</span>
                  <span className="font-medium">{inputs.amortizationYears} years</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{dscr.toFixed(2)}x</p>
                  <p className="text-sm text-muted-foreground">DSCR</p>
                  <Badge variant={dscr >= 1.25 ? "default" : dscr >= 1.0 ? "secondary" : "destructive"} className="mt-2">
                    {dscr >= 1.25 ? "Strong" : dscr >= 1.0 ? "Adequate" : "Weak"}
                  </Badge>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{formatPercentage(debtYield)}</p>
                  <p className="text-sm text-muted-foreground">Debt Yield</p>
                  <Badge variant={debtYield >= 10 ? "default" : debtYield >= 8 ? "secondary" : "destructive"} className="mt-2">
                    {debtYield >= 10 ? "Strong" : debtYield >= 8 ? "Adequate" : "Tight"}
                  </Badge>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(annualDebtService)}</p>
                  <p className="text-sm text-muted-foreground">Annual Debt Service</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{formatPercentage(cashOnCash)}</p>
                  <p className="text-sm text-muted-foreground">Cash-on-Cash Return</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Property & Valuation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Scenario Name</Label>
                  <Input
                    value={inputs.name}
                    onChange={(e) => updateInput('name', e.target.value)}
                    data-testid="input-scenario-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Purchase Price</Label>
                  <Input
                    value={inputs.purchasePrice}
                    onChange={(e) => handlePurchasePriceChange(formatNumberWithCommas(e.target.value))}
                    data-testid="input-purchase-price"
                  />
                </div>
                <div className="space-y-2">
                  <Label>NOI</Label>
                  <Input
                    value={inputs.noi}
                    onChange={(e) => handleNoiChange(formatNumberWithCommas(e.target.value))}
                    data-testid="input-noi"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cap Rate (%)</Label>
                  <Input
                    value={inputs.capRate}
                    onChange={(e) => handleCapRateChange(e.target.value)}
                    data-testid="input-cap-rate"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Loan Structure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Loan Amount</Label>
                  <Input
                    value={inputs.loanAmount}
                    onChange={(e) => handleLoanAmountChange(formatNumberWithCommas(e.target.value))}
                    data-testid="input-loan-amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label>LTV (%)</Label>
                  <Input
                    value={inputs.ltvPercent}
                    onChange={(e) => handleLtvChange(e.target.value)}
                    data-testid="input-ltv"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base Rate</Label>
                  <Select value={inputs.baseRate} onValueChange={(v) => updateInput('baseRate', v)}>
                    <SelectTrigger data-testid="select-base-rate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BASE_RATE_OPTIONS.map((rate) => (
                        <SelectItem key={rate.id} value={rate.id}>{rate.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Spread (bps)</Label>
                  <Input
                    value={inputs.spreadBps}
                    onChange={(e) => updateInput('spreadBps', e.target.value)}
                    data-testid="input-spread"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Term Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Loan Term (Years)</Label>
                  <Select value={inputs.loanTermYears} onValueChange={(v) => updateInput('loanTermYears', v)}>
                    <SelectTrigger data-testid="select-loan-term">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 7, 10, 15, 20, 25, 30].map((yr) => (
                        <SelectItem key={yr} value={yr.toString()}>{yr} Years</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amortization (Years)</Label>
                  <Select value={inputs.amortizationYears} onValueChange={(v) => updateInput('amortizationYears', v)}>
                    <SelectTrigger data-testid="select-amortization">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[20, 25, 30].map((yr) => (
                        <SelectItem key={yr} value={yr.toString()}>{yr} Years</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Interest-Only (Years)</Label>
                  <Select value={inputs.interestOnlyYears} onValueChange={(v) => updateInput('interestOnlyYears', v)}>
                    <SelectTrigger data-testid="select-io-years">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 5].map((yr) => (
                        <SelectItem key={yr} value={yr.toString()}>{yr === 0 ? 'None' : `${yr} Years`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amortization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Amortization Schedule</CardTitle>
              <CardDescription>Principal and interest breakdown over loan term</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={amortizationSchedule}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend />
                    <Bar dataKey="principal" name="Principal" fill="hsl(var(--primary))" stackId="payment" />
                    <Bar dataKey="interest" name="Interest" fill="hsl(var(--muted-foreground))" stackId="payment" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schedule Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Year</th>
                      <th className="text-right py-2 font-medium">Payment</th>
                      <th className="text-right py-2 font-medium">Principal</th>
                      <th className="text-right py-2 font-medium">Interest</th>
                      <th className="text-right py-2 font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amortizationSchedule.map((row, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{row.year}</td>
                        <td className="text-right">{formatCurrency(row.payment)}</td>
                        <td className="text-right">{formatCurrency(row.principal)}</td>
                        <td className="text-right">{formatCurrency(row.interest)}</td>
                        <td className="text-right">{formatCurrency(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Saved Scenarios</h3>
              <p className="text-sm text-muted-foreground">Compare different financing structures</p>
            </div>
            <Button onClick={newScenario} variant="outline" data-testid="button-new-scenario">
              <RefreshCw className="h-4 w-4 mr-2" />
              New Scenario
            </Button>
          </div>

          {scenariosLoading ? (
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : savedScenarios.length === 0 ? (
            <Card className="p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Saved Scenarios</h3>
              <p className="text-muted-foreground mb-4">
                Create and save your first debt scenario to compare financing options.
              </p>
              <Button onClick={newScenario} data-testid="button-create-first-scenario">
                Create First Scenario
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {savedScenarios.map((scenario) => (
                <Card key={scenario.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Calculator className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{scenario.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(scenario.loanAmount)} at {scenario.baseRate} + {scenario.spreadBps}bps
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => loadScenario(scenario)}
                        data-testid={`button-load-scenario-${scenario.id}`}
                      >
                        Load
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteMutation.mutate(scenario.id)}
                        data-testid={`button-delete-scenario-${scenario.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {onTabChange && (
        <WorkflowNavigation currentTab="debt" onNavigate={onTabChange} />
      )}
    </div>
  );
}
