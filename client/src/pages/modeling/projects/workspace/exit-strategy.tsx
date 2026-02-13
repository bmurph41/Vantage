import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Calculator, 
  TrendingUp, 
  Building2, 
  FileSpreadsheet,
  DollarSign,
  Percent,
  BarChart3,
  Brain,
  RefreshCcw,
  Landmark,
  HandCoins,
  Award,
  Link2,
  Link2Off,
  Info,
  AlertCircle,
  Plus,
  Trash2,
  Users,
  PieChart,
  Save,
  Check,
  Play,
  GitCompareArrows
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { ModelingProject, ModelingCase, ExitScenario } from "@shared/schema";
import type { ProjectConfig, ProFormaData } from '@/types/modeling';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { defaultScenarios, type ScenarioType, type ScenarioConfig } from '@/lib/modeling-scenarios';
import { ScenarioBuilder } from '@/components/exit-strategies/ScenarioBuilder';
import { ScenarioComparison } from '@/components/exit-strategies/ScenarioComparison';
import type { ExitScenarioInput, ExitScenarioResult } from '@shared/exit/exit-scenario-engine';

interface WorkspaceExitStrategyProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const parseCurrency = (value: string): string => {
  const num = value.replace(/[^0-9.-]/g, '');
  return num || '0';
};

const parsePercent = (value: string): string => {
  const num = value.replace(/[^0-9.-]/g, '');
  return num || '0';
};

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  linked?: boolean;
  onUnlink?: () => void;
  "data-testid"?: string;
  disabled?: boolean;
}

function CurrencyInput({ value, onChange, linked, onUnlink, "data-testid": testId, disabled }: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(formatCurrency(value));

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCurrency(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseCurrency(displayValue);
    onChange(parsed);
    setDisplayValue(formatCurrency(parsed));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFocused) {
      setDisplayValue(e.target.value);
    }
  };

  return (
    <div className="relative">
      <Input
        type={isFocused ? "number" : "text"}
        value={isFocused ? displayValue : formatCurrency(value)}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        data-testid={testId}
        disabled={disabled}
        className={linked ? "pr-10 border-blue-300 bg-blue-50/50" : ""}
      />
      {linked && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onUnlink}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-blue-100 rounded"
                type="button"
              >
                <Link2 className="h-4 w-4 text-blue-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Linked to project data. Click to unlink and edit manually.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

interface PercentInputProps {
  value: string;
  onChange: (value: string) => void;
  "data-testid"?: string;
}

function PercentInput({ value, onChange, "data-testid": testId }: PercentInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(formatPercent(value));

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatPercent(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parsePercent(displayValue);
    onChange(parsed);
    setDisplayValue(formatPercent(parsed));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isFocused) {
      setDisplayValue(e.target.value);
    }
  };

  return (
    <Input
      type={isFocused ? "number" : "text"}
      value={isFocused ? displayValue : formatPercent(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      step="0.01"
      data-testid={testId}
    />
  );
}

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
  { 
    id: "scenario-builder", 
    name: "Scenario Builder", 
    shortName: "Builder",
    description: "Unified institutional-grade scenario runner", 
    icon: Play,
    color: "text-teal-500",
    bgColor: "bg-teal-50"
  },
  { 
    id: "comparison", 
    name: "Comparison", 
    shortName: "Compare",
    description: "Side-by-side scenario comparison", 
    icon: GitCompareArrows,
    color: "text-rose-500",
    bgColor: "bg-rose-50"
  },
];

export default function WorkspaceExitStrategy({ projectId, onTabChange }: WorkspaceExitStrategyProps) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("tax");
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [scenarioResults, setScenarioResults] = useState<ExitScenarioResult[]>([]);

  const { toast } = useToast();

  const { data: cases = [] } = useQuery<ModelingCase[]>({
    queryKey: ['/api/modeling/projects', projectId, 'cases'],
  });

  const { data: project, isLoading: projectLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: config } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const { data: proForma } = useQuery<ProFormaData>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
  });

  useEffect(() => {
    if (cases.length > 0 && !activeCaseId) {
      const defaultCase = cases.find(c => c.isDefault) || cases[0];
      setActiveCaseId(defaultCase.id);
    }
  }, [cases, activeCaseId]);

  const activeCase = cases.find(c => c.id === activeCaseId) || cases[0];

  const holdPeriod = config?.holdPeriod || 5;
  const purchasePrice = Number(project?.purchasePrice) || 0;

  const currentScenario: ScenarioConfig = activeCase ? {
    name: activeCase.name,
    description: activeCase.description || '',
    revenueGrowth: parseFloat(activeCase.revenueGrowthRate || '0') * 100,
    expenseGrowth: parseFloat(activeCase.expenseGrowthRate || '0') * 100,
    exitCapRate: parseFloat(activeCase.exitCapRate || '0') * 100 || 7.5,
  } : defaultScenarios.base;

  const exitCapRate = currentScenario.exitCapRate;
  
  const year1NOI = proForma?.year1NOI || Number(project?.ebitda) || 0;
  const netGrowthRate = (currentScenario.revenueGrowth - currentScenario.expenseGrowth) / 100;
  const exitNOI = year1NOI * Math.pow(1 + netGrowthRate, holdPeriod);
  const calculatedSalePrice = exitNOI / (exitCapRate / 100);

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {onTabChange && (
        <WorkflowNavigation currentTab="exit" onNavigate={onTabChange} />
      )}
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold" data-testid="exit-strategy-title">Exit Strategy Suite</h2>
          <p className="text-sm text-muted-foreground">
            Institutional-grade exit analysis for {project?.marinaName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Scenario:</Label>
            {cases.length > 0 ? (
              <Select value={activeCaseId || ''} onValueChange={(v) => setActiveCaseId(v)}>
                <SelectTrigger className="w-52" data-testid="select-exit-scenario">
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  {cases.filter(c => c.isEnabled).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full bg-${c.color || 'blue'}-500`} />
                        {c.name}
                        {c.isDefault && <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1">Default</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                No scenarios configured
              </Badge>
            )}
            {cases.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTabChange?.('scenarios')}
              >
                <Plus className="h-4 w-4 mr-1" /> Create Scenario
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Link2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-blue-800 font-medium">Project-Linked Mode</p>
              <p className="text-sm text-blue-700">
                Sale price is calculated from your {currentScenario.name} scenario: Exit NOI ({formatCurrency(exitNOI)}) ÷ Exit Cap Rate ({exitCapRate}%). 
                Values update when you change scenarios. Click the link icon on any field to manually override.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-blue-700">Net Growth:</span>
                <Badge variant="outline" className="bg-white">{(currentScenario.revenueGrowth - currentScenario.expenseGrowth).toFixed(1)}%/yr</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-700">Exit NOI:</span>
                <Badge variant="outline" className="bg-white font-mono">{formatCurrency(exitNOI)}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-700">Sale Price:</span>
                <Badge variant="outline" className="bg-white font-mono">{formatCurrency(calculatedSalePrice)}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => onTabChange?.('pricing')}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Building2 className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Purchase Price
                        <Link2 className="h-3 w-3 text-blue-400" />
                      </p>
                      <p className="text-lg font-bold" data-testid="text-exit-purchase-price">
                        {purchasePrice > 0 ? formatCurrency(purchasePrice) : <span className="text-muted-foreground text-sm">Not set</span>}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Click to update in Pricing tab</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Exit NOI (Yr {holdPeriod})</p>
                <p className="text-lg font-bold" data-testid="text-exit-noi">
                  {formatCurrency(exitNOI)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Percent className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Exit Cap Rate</p>
                <p className="text-lg font-bold" data-testid="text-exit-cap-rate">
                  {exitCapRate}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sale Price ({currentScenario.name})</p>
                <p className="text-lg font-bold text-green-600" data-testid="text-exit-sale-price">
                  {formatCurrency(calculatedSalePrice)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-cyan-50 rounded-lg">
                <FileSpreadsheet className="h-4 w-4 text-cyan-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hold Period</p>
                <p className="text-lg font-bold" data-testid="text-exit-hold-period">
                  {holdPeriod} years
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {exitTools.map((tool) => (
            <TabsTrigger 
              key={tool.id} 
              value={tool.id}
              className="flex items-center gap-1.5 px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm"
              data-testid={`tab-exit-${tool.id}`}
            >
              <tool.icon className={`h-3.5 w-3.5 ${activeTab === tool.id ? tool.color : ''}`} />
              <span className="hidden sm:inline">{tool.shortName}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="tax" className="mt-6">
          <TaxCalculatorPanel 
            salePrice={calculatedSalePrice.toString()}
            costBasis={purchasePrice.toString()}
            holdPeriod={holdPeriod.toString()}
          />
        </TabsContent>

        <TabsContent value="net-proceeds" className="mt-6">
          <NetProceedsPanel salePrice={calculatedSalePrice.toString()} />
        </TabsContent>

        <TabsContent value="1031" className="mt-6">
          <Exchange1031Panel salePrice={calculatedSalePrice.toString()} />
        </TabsContent>

        <TabsContent value="dst" className="mt-6">
          <DSTAnalysisPanel 
            salePrice={calculatedSalePrice.toString()} 
            holdPeriod={holdPeriod.toString()} 
          />
        </TabsContent>

        <TabsContent value="seller-financing" className="mt-6">
          <SellerFinancingPanel salePrice={calculatedSalePrice.toString()} />
        </TabsContent>

        <TabsContent value="earnout" className="mt-6">
          <EarnoutPanel salePrice={calculatedSalePrice.toString()} />
        </TabsContent>

        <TabsContent value="waterfall" className="mt-6">
          <WaterfallPanel salePrice={calculatedSalePrice.toString()} projectId={projectId} />
        </TabsContent>

        <TabsContent value="irr" className="mt-6">
          <IRRCalculatorPanel 
            initialInvestment={purchasePrice.toString()}
            exitValue={calculatedSalePrice.toString()}
            holdPeriod={holdPeriod}
          />
        </TabsContent>

        <TabsContent value="sensitivity" className="mt-6">
          <SensitivityPanel 
            baseNOI={exitNOI.toString()} 
            baseCapRate={exitCapRate.toString()} 
          />
        </TabsContent>

        <TabsContent value="ai-insights" className="mt-6">
          <AIInsightsPanel 
            projectId={projectId}
            salePrice={calculatedSalePrice}
            purchasePrice={purchasePrice}
            holdPeriod={holdPeriod}
            scenario={currentScenario.name}
          />
        </TabsContent>

        <TabsContent value="scenario-builder" className="mt-6">
          <ScenarioBuilderPanel
            salePrice={calculatedSalePrice}
            purchasePrice={purchasePrice}
            holdPeriod={holdPeriod}
            scenarioName={currentScenario.name}
            onScenarioResult={(result) => {
              setScenarioResults(prev => {
                const existing = prev.findIndex(r => r.scenarioName === result.scenarioName);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = result;
                  return updated;
                }
                return [...prev, result];
              });
            }}
          />
        </TabsContent>

        <TabsContent value="comparison" className="mt-6">
          <ScenarioComparison scenarios={scenarioResults} />
        </TabsContent>
      </Tabs>

    </div>
  );
}

interface TaxCalculatorPanelProps {
  salePrice: string;
  costBasis: string;
  holdPeriod: string;
}

function TaxCalculatorPanel({ salePrice: initialSalePrice, costBasis: initialCostBasis, holdPeriod: initialHoldPeriod }: TaxCalculatorPanelProps) {
  const [salePriceLinked, setSalePriceLinked] = useState(true);
  const [costBasisLinked, setCostBasisLinked] = useState(true);
  const [holdPeriodLinked, setHoldPeriodLinked] = useState(true);
  
  const [salePrice, setSalePrice] = useState<string>(initialSalePrice);
  const [costBasis, setCostBasis] = useState<string>(initialCostBasis);
  const [holdingPeriod, setHoldingPeriod] = useState<string>(initialHoldPeriod);
  const [depreciationRecapture, setDepreciationRecapture] = useState<string>("500000");
  const [taxRate, setTaxRate] = useState<string>("20");
  const [stateRate, setStateRate] = useState<string>("5");

  useEffect(() => {
    if (salePriceLinked) setSalePrice(initialSalePrice);
  }, [initialSalePrice, salePriceLinked]);

  useEffect(() => {
    if (costBasisLinked) setCostBasis(initialCostBasis);
  }, [initialCostBasis, costBasisLinked]);

  useEffect(() => {
    if (holdPeriodLinked) setHoldingPeriod(initialHoldPeriod);
  }, [initialHoldPeriod, holdPeriodLinked]);

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
              <Label className="flex items-center gap-1">
                Sale Price
                {salePriceLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={salePrice} 
                onChange={(v) => { setSalePrice(v); setSalePriceLinked(false); }}
                linked={salePriceLinked}
                onUnlink={() => setSalePriceLinked(false)}
                data-testid="input-sale-price"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Cost Basis
                {costBasisLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={costBasis} 
                onChange={(v) => { setCostBasis(v); setCostBasisLinked(false); }}
                linked={costBasisLinked}
                onUnlink={() => setCostBasisLinked(false)}
                data-testid="input-cost-basis"
              />
            </div>
            <div>
              <Label>Depreciation Recapture</Label>
              <CurrencyInput 
                value={depreciationRecapture} 
                onChange={setDepreciationRecapture}
                data-testid="input-depreciation"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Holding Period (Years)
                {holdPeriodLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <div className="relative">
                <Input 
                  type="number" 
                  value={holdingPeriod} 
                  onChange={(e) => { setHoldingPeriod(e.target.value); setHoldPeriodLinked(false); }}
                  data-testid="input-holding-period"
                  className={holdPeriodLinked ? "pr-10 border-blue-300 bg-blue-50/50" : ""}
                />
                {holdPeriodLinked && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => setHoldPeriodLinked(false)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-blue-100 rounded"
                          type="button"
                        >
                          <Link2 className="h-4 w-4 text-blue-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Linked to project data. Click to unlink and edit manually.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            <div>
              <Label>Federal Cap Gains Rate</Label>
              <PercentInput 
                value={taxRate} 
                onChange={setTaxRate}
                data-testid="input-fed-rate"
              />
            </div>
            <div>
              <Label>State Tax Rate</Label>
              <PercentInput 
                value={stateRate} 
                onChange={setStateRate}
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
              <span className="font-semibold" data-testid="text-capital-gain">{formatCurrency(results.capitalGain)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Federal Tax</span>
              <span className="text-red-600" data-testid="text-federal-tax">-{formatCurrency(results.federalTax)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">State Tax</span>
              <span className="text-red-600" data-testid="text-state-tax">-{formatCurrency(results.stateTax)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Depreciation Recapture (25%)</span>
              <span className="text-red-600" data-testid="text-dep-recapture">-{formatCurrency(results.depTax)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">NIIT (3.8%)</span>
              <span className="text-red-600" data-testid="text-niit">-{formatCurrency(results.niit)}</span>
            </div>
            <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-3">
              <span className="font-semibold">Total Tax Liability</span>
              <span className="font-bold text-red-600" data-testid="text-total-tax">{formatCurrency(results.totalTax)}</span>
            </div>
            <div className="flex justify-between py-3 bg-green-50 rounded-lg px-3">
              <span className="font-semibold">Net Proceeds After Tax</span>
              <span className="font-bold text-green-600" data-testid="text-net-proceeds">{formatCurrency(results.netProceeds)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface NetProceedsPanelProps {
  salePrice: string;
}

function NetProceedsPanel({ salePrice: initialSalePrice }: NetProceedsPanelProps) {
  const [salePriceLinked, setSalePriceLinked] = useState(true);
  const [salePrice, setSalePrice] = useState<string>(initialSalePrice);
  const [loanBalance, setLoanBalance] = useState<string>("2500000");
  const [closingCosts, setClosingCosts] = useState<string>("150000");
  const [brokerFee, setBrokerFee] = useState<string>("5");
  const [taxes, setTaxes] = useState<string>("300000");

  useEffect(() => {
    if (salePriceLinked) setSalePrice(initialSalePrice);
  }, [initialSalePrice, salePriceLinked]);

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
              <Label className="flex items-center gap-1">
                Sale Price
                {salePriceLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={salePrice} 
                onChange={(v) => { setSalePrice(v); setSalePriceLinked(false); }}
                linked={salePriceLinked}
                onUnlink={() => setSalePriceLinked(false)}
              />
            </div>
            <div>
              <Label>Loan Balance</Label>
              <CurrencyInput value={loanBalance} onChange={setLoanBalance} />
            </div>
            <div>
              <Label>Closing Costs</Label>
              <CurrencyInput value={closingCosts} onChange={setClosingCosts} />
            </div>
            <div>
              <Label>Broker Fee</Label>
              <PercentInput value={brokerFee} onChange={setBrokerFee} />
            </div>
            <div className="col-span-2">
              <Label>Estimated Taxes</Label>
              <CurrencyInput value={taxes} onChange={setTaxes} />
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
              <span className="font-semibold">{formatCurrency(salePrice)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Loan Payoff</span>
              <span className="text-red-600">-{formatCurrency(loanBalance)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Broker Commission</span>
              <span className="text-red-600">-{formatCurrency(results.brokerCost)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Closing Costs</span>
              <span className="text-red-600">-{formatCurrency(closingCosts)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Taxes</span>
              <span className="text-red-600">-{formatCurrency(taxes)}</span>
            </div>
            <div className="flex justify-between py-3 bg-green-50 rounded-lg px-3">
              <span className="font-semibold">Net Cash Proceeds</span>
              <span className="font-bold text-green-600">{formatCurrency(results.netProceeds)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface Exchange1031PanelProps {
  salePrice: string;
}

function Exchange1031Panel({ salePrice: initialSalePrice }: Exchange1031PanelProps) {
  const [salePriceLinked, setSalePriceLinked] = useState(true);
  const [relinquishedValue, setRelinquishedValue] = useState<string>(initialSalePrice);
  const [replacementValue, setReplacementValue] = useState<string>((parseFloat(initialSalePrice) * 1.2).toString());
  const [bootReceived, setBootReceived] = useState<string>("0");
  const [identificationDays] = useState<string>("45");
  const [closingDays] = useState<string>("180");

  useEffect(() => {
    if (salePriceLinked) {
      setRelinquishedValue(initialSalePrice);
      setReplacementValue((parseFloat(initialSalePrice) * 1.2).toString());
    }
  }, [initialSalePrice, salePriceLinked]);

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
              <Label className="flex items-center gap-1">
                Relinquished Property Value
                {salePriceLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={relinquishedValue} 
                onChange={(v) => { setRelinquishedValue(v); setSalePriceLinked(false); }}
                linked={salePriceLinked}
                onUnlink={() => setSalePriceLinked(false)}
              />
            </div>
            <div>
              <Label>Replacement Property Value</Label>
              <CurrencyInput value={replacementValue} onChange={setReplacementValue} />
            </div>
            <div>
              <Label>Boot Received</Label>
              <CurrencyInput value={bootReceived} onChange={setBootReceived} />
            </div>
            <div>
              <Label>Identification Period</Label>
              <Input type="text" value={`${identificationDays} days`} disabled />
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
              <span className="font-semibold text-green-600">{formatCurrency(deferredGain)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Taxable Boot</span>
              <span className="text-red-600">{formatCurrency(taxableGain)}</span>
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

interface DSTAnalysisPanelProps {
  salePrice: string;
  holdPeriod: string;
}

function DSTAnalysisPanel({ salePrice: initialSalePrice, holdPeriod: initialHoldPeriod }: DSTAnalysisPanelProps) {
  const [investmentLinked, setInvestmentLinked] = useState(true);
  const [holdPeriodLinked, setHoldPeriodLinked] = useState(true);
  
  const [investmentAmount, setInvestmentAmount] = useState<string>(initialSalePrice);
  const [distributionRate, setDistributionRate] = useState<string>("5.5");
  const [holdPeriod, setHoldPeriod] = useState<string>(initialHoldPeriod);

  useEffect(() => {
    if (investmentLinked) setInvestmentAmount(initialSalePrice);
  }, [initialSalePrice, investmentLinked]);

  useEffect(() => {
    if (holdPeriodLinked) setHoldPeriod(initialHoldPeriod);
  }, [initialHoldPeriod, holdPeriodLinked]);

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
              <Label className="flex items-center gap-1">
                Investment Amount
                {investmentLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={investmentAmount} 
                onChange={(v) => { setInvestmentAmount(v); setInvestmentLinked(false); }}
                linked={investmentLinked}
                onUnlink={() => setInvestmentLinked(false)}
              />
            </div>
            <div>
              <Label>Distribution Rate</Label>
              <PercentInput value={distributionRate} onChange={setDistributionRate} />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Hold Period (Years)
                {holdPeriodLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <div className="relative">
                <Input 
                  type="number" 
                  value={holdPeriod} 
                  onChange={(e) => { setHoldPeriod(e.target.value); setHoldPeriodLinked(false); }}
                  className={holdPeriodLinked ? "pr-10 border-blue-300 bg-blue-50/50" : ""}
                />
                {holdPeriodLinked && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => setHoldPeriodLinked(false)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-blue-100 rounded"
                          type="button"
                        >
                          <Link2 className="h-4 w-4 text-blue-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Linked to project data. Click to unlink.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
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
              <span className="font-semibold text-green-600">{formatCurrency(annualDistribution)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Distributions</span>
              <span className="font-semibold">{formatCurrency(totalDistributions)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SellerFinancingPanelProps {
  salePrice: string;
}

function SellerFinancingPanel({ salePrice: initialSalePrice }: SellerFinancingPanelProps) {
  const [salePriceLinked, setSalePriceLinked] = useState(true);
  const [salePrice, setSalePrice] = useState<string>(initialSalePrice);
  const [downPayment, setDownPayment] = useState<string>((parseFloat(initialSalePrice) * 0.2).toString());
  const [interestRate, setInterestRate] = useState<string>("6");
  const [term, setTerm] = useState<string>("10");

  useEffect(() => {
    if (salePriceLinked) {
      setSalePrice(initialSalePrice);
      setDownPayment((parseFloat(initialSalePrice) * 0.2).toString());
    }
  }, [initialSalePrice, salePriceLinked]);

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
              <Label className="flex items-center gap-1">
                Sale Price
                {salePriceLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={salePrice} 
                onChange={(v) => { setSalePrice(v); setSalePriceLinked(false); }}
                linked={salePriceLinked}
                onUnlink={() => setSalePriceLinked(false)}
              />
            </div>
            <div>
              <Label>Down Payment</Label>
              <CurrencyInput value={downPayment} onChange={setDownPayment} />
            </div>
            <div>
              <Label>Interest Rate</Label>
              <PercentInput value={interestRate} onChange={setInterestRate} />
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
              <span className="font-semibold">{formatCurrency(loanAmount)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Monthly Payment</span>
              <span className="font-semibold text-green-600">{formatCurrency(monthlyPayment)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Interest</span>
              <span>{formatCurrency(totalInterest)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface EarnoutPanelProps {
  salePrice: string;
}

function EarnoutPanel({ salePrice: initialSalePrice }: EarnoutPanelProps) {
  const [basePriceLinked, setBasePriceLinked] = useState(true);
  const [basePrice, setBasePrice] = useState<string>((parseFloat(initialSalePrice) * 0.8).toString());
  const [earnoutMax, setEarnoutMax] = useState<string>((parseFloat(initialSalePrice) * 0.2).toString());
  const [probability, setProbability] = useState<string>("60");

  useEffect(() => {
    if (basePriceLinked) {
      setBasePrice((parseFloat(initialSalePrice) * 0.8).toString());
      setEarnoutMax((parseFloat(initialSalePrice) * 0.2).toString());
    }
  }, [initialSalePrice, basePriceLinked]);

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
              <Label className="flex items-center gap-1">
                Base Price
                {basePriceLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={basePrice} 
                onChange={(v) => { setBasePrice(v); setBasePriceLinked(false); }}
                linked={basePriceLinked}
                onUnlink={() => setBasePriceLinked(false)}
              />
            </div>
            <div>
              <Label>Maximum Earnout</Label>
              <CurrencyInput value={earnoutMax} onChange={setEarnoutMax} />
            </div>
            <div>
              <Label>Achievement Probability</Label>
              <PercentInput value={probability} onChange={setProbability} />
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
              <span className="font-semibold text-green-600">{formatCurrency(expectedEarnout)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Expected Value</span>
              <span className="font-semibold">{formatCurrency(totalExpected)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface WaterfallPanelProps {
  salePrice: string;
  projectId: string;
}

interface Investor {
  id: string;
  name: string;
  contribution: number;
  isGP: boolean;
}

interface EquityLayer {
  id: string;
  layerType: string;
  investorName?: string;
  commitmentAmount: string | number;
  preferredReturn?: string | number;
}

interface CapitalStack {
  id: number;
  name: string;
  isPrimary?: boolean;
}

interface CapitalStackDetails {
  stack: CapitalStack;
  debtTranches: unknown[];
  equityLayers: EquityLayer[];
}

function WaterfallPanel({ salePrice: initialSalePrice, projectId }: WaterfallPanelProps) {
  const [distributionLinked, setDistributionLinked] = useState(true);
  const [capitalStackLinked, setCapitalStackLinked] = useState(true);
  const [totalDistribution, setTotalDistribution] = useState<string>(initialSalePrice);
  const [lpCapital, setLpCapital] = useState<string>("0");
  const [gpCapitalState, setGpCapitalState] = useState<string>("0");
  const [preferredReturn, setPreferredReturn] = useState<string>("8");
  const [carriedInterest, setCarriedInterest] = useState<string>("20");
  const [gpCatchUp, setGpCatchUp] = useState<string>("100");
  const [holdPeriod, setHoldPeriod] = useState<string>("5");
  const [waterfallTab, setWaterfallTab] = useState<string>("structure");
  const [investors, setInvestors] = useState<Investor[]>([]);

  const { data: capitalStacks, isLoading: stacksLoading } = useQuery<CapitalStack[]>({
    queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'],
    enabled: !!projectId,
  });

  const selectedStackId = capitalStacks?.find(s => s.isPrimary)?.id || capitalStacks?.[0]?.id;

  const { data: stackDetails, isLoading: detailsLoading } = useQuery<CapitalStackDetails>({
    queryKey: ['/api/modeling/capital-stacks', selectedStackId],
    enabled: !!selectedStackId && capitalStackLinked,
  });

  const capitalStackData = stackDetails;

  useEffect(() => {
    if (capitalStackLinked && capitalStackData?.equityLayers) {
      const equityLayers = capitalStackData.equityLayers;
      const gpLayers = equityLayers.filter(l => l.layerType === 'promote' || l.layerType === 'co_invest');
      const lpLayers = equityLayers.filter(l => l.layerType === 'common' || l.layerType === 'preferred');
      
      const gpTotal = gpLayers.reduce((sum, l) => sum + (parseFloat(String(l.commitmentAmount)) || 0), 0);
      const lpTotal = lpLayers.reduce((sum, l) => sum + (parseFloat(String(l.commitmentAmount)) || 0), 0);
      
      setGpCapitalState(gpTotal.toString());
      setLpCapital(lpTotal.toString());
      
      const newInvestors: Investor[] = equityLayers.map((layer, idx) => ({
        id: layer.id || String(idx + 1),
        name: layer.investorName || (layer.layerType === 'promote' ? 'GP Promote' : layer.layerType === 'co_invest' ? 'GP Co-Invest' : `LP - ${layer.layerType}`),
        contribution: parseFloat(String(layer.commitmentAmount)) || 0,
        isGP: layer.layerType === 'promote' || layer.layerType === 'co_invest',
      }));
      
      if (newInvestors.length > 0) {
        setInvestors(newInvestors);
      }
      
      const avgPref = lpLayers.reduce((sum, l) => sum + (parseFloat(String(l.preferredReturn)) || 0), 0) / (lpLayers.length || 1);
      if (avgPref > 0) {
        setPreferredReturn(avgPref.toFixed(1));
      }
    }
  }, [capitalStackData, capitalStackLinked]);

  useEffect(() => {
    if (distributionLinked) {
      setTotalDistribution(initialSalePrice);
    }
  }, [initialSalePrice, distributionLinked]);

  useEffect(() => {
    if (!capitalStackLinked && investors.length === 0) {
      const defaultPrice = parseFloat(initialSalePrice) || 10000000;
      setInvestors([
        { id: '1', name: 'GP Fund Manager', contribution: defaultPrice * 0.2, isGP: true },
        { id: '2', name: 'Institutional LP', contribution: defaultPrice * 0.5, isGP: false },
        { id: '3', name: 'Family Office LP', contribution: defaultPrice * 0.3, isGP: false },
      ]);
      setLpCapital((defaultPrice * 0.8).toString());
      setGpCapitalState((defaultPrice * 0.2).toString());
    }
  }, [capitalStackLinked, investors.length, initialSalePrice]);

  const totalProceeds = parseFloat(totalDistribution) || 0;
  const lpCap = parseFloat(lpCapital) || 0;
  const gpCapital = parseFloat(gpCapitalState) || 0;
  const totalCapital = lpCap + gpCapital;
  const prefRate = parseFloat(preferredReturn) / 100 || 0;
  const carryRate = parseFloat(carriedInterest) / 100 || 0;
  const catchUpRate = parseFloat(gpCatchUp) / 100 || 0;
  const holdYears = parseFloat(holdPeriod) || 5;

  const returnOfCapital = Math.min(totalProceeds, totalCapital);
  const afterCapitalReturn = Math.max(0, totalProceeds - totalCapital);
  const lpPreferred = lpCap * prefRate * holdYears;
  const prefPayment = Math.min(afterCapitalReturn, lpPreferred);
  const afterPref = Math.max(0, afterCapitalReturn - prefPayment);
  const gpCatchUpAmount = afterPref > 0 ? Math.min(afterPref * catchUpRate, afterPref) : 0;
  const afterCatchUp = Math.max(0, afterPref - gpCatchUpAmount);
  const gpCarry = afterCatchUp * carryRate;
  const lpProfitShare = afterCatchUp * (1 - carryRate);
  
  const totalLP = (returnOfCapital * (lpCap / totalCapital)) + prefPayment + lpProfitShare;
  const totalGP = (returnOfCapital * (gpCapital / totalCapital)) + gpCatchUpAmount + gpCarry;
  const lpMOIC = totalLP / lpCap;
  const gpMOIC = totalGP / gpCapital;
  const fundMOIC = totalProceeds / totalCapital;
  const fundIRR = (Math.pow(fundMOIC, 1 / holdYears) - 1) * 100;
  const lpIRR = (Math.pow(lpMOIC, 1 / holdYears) - 1) * 100;
  const gpIRR = (Math.pow(gpMOIC, 1 / holdYears) - 1) * 100;

  const addInvestor = () => {
    const newId = (investors.length + 1).toString();
    setInvestors([...investors, { id: newId, name: `New LP ${newId}`, contribution: 1000000, isGP: false }]);
  };

  const removeInvestor = (id: string) => {
    if (investors.length > 1) {
      setInvestors(investors.filter(inv => inv.id !== id));
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={waterfallTab} onValueChange={setWaterfallTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          <TabsTrigger value="structure" className="text-xs gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            Structure
          </TabsTrigger>
          <TabsTrigger value="partners" className="text-xs gap-1">
            <DollarSign className="h-3.5 w-3.5" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="returns" className="text-xs gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Returns
          </TabsTrigger>
          <TabsTrigger value="distribution" className="text-xs gap-1">
            <Calculator className="h-3.5 w-3.5" />
            Distribution
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5 text-cyan-500" />
                  Waterfall Structure
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>Configure fund distribution terms</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Capital Stack Link</span>
                    <Switch
                      checked={capitalStackLinked}
                      onCheckedChange={setCapitalStackLinked}
                      className="scale-75"
                    />
                    {capitalStackLinked ? (
                      <Badge variant="outline" className="gap-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                        <Link2 className="h-3 w-3" />
                        Linked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Link2Off className="h-3 w-3" />
                        Manual
                      </Badge>
                    )}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {capitalStackLinked && !stacksLoading && !detailsLoading && !selectedStackId && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800">
                      No Capital Stack found. Create one in the Capital Stack tab first.
                    </AlertDescription>
                  </Alert>
                )}
                {capitalStackLinked && !detailsLoading && selectedStackId && (capitalStackData?.equityLayers?.length ?? 0) === 0 && (
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-xs text-amber-800">
                      No equity layers found in Capital Stack. Add equity in the Capital Stack tab to auto-populate the waterfall.
                    </AlertDescription>
                  </Alert>
                )}
                {capitalStackLinked && (stacksLoading || detailsLoading) && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600 animate-pulse" />
                    <AlertDescription className="text-xs text-blue-800">
                      Loading Capital Stack data...
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-1 text-sm">
                      Total Proceeds
                      {distributionLinked && <Link2 className="h-3 w-3 text-blue-500" />}
                    </Label>
                    <CurrencyInput 
                      value={totalDistribution} 
                      onChange={(v) => { setTotalDistribution(v); setDistributionLinked(false); }}
                      linked={distributionLinked}
                      onUnlink={() => setDistributionLinked(false)}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-sm">
                      LP Capital
                      {capitalStackLinked && <Link2 className="h-3 w-3 text-blue-500" />}
                    </Label>
                    <CurrencyInput 
                      value={lpCapital} 
                      onChange={(v) => { setLpCapital(v); setCapitalStackLinked(false); }}
                      linked={capitalStackLinked}
                      onUnlink={() => setCapitalStackLinked(false)}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1 text-sm">
                      GP Capital
                      {capitalStackLinked && <Link2 className="h-3 w-3 text-blue-500" />}
                    </Label>
                    <CurrencyInput 
                      value={gpCapitalState} 
                      onChange={(v) => { setGpCapitalState(v); setCapitalStackLinked(false); }}
                      linked={capitalStackLinked}
                      onUnlink={() => setCapitalStackLinked(false)}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Preferred Return</Label>
                    <PercentInput value={preferredReturn} onChange={setPreferredReturn} />
                  </div>
                  <div>
                    <Label className="text-sm">Carried Interest</Label>
                    <PercentInput value={carriedInterest} onChange={setCarriedInterest} />
                  </div>
                  <div>
                    <Label className="text-sm">GP Catch-Up %</Label>
                    <PercentInput value={gpCatchUp} onChange={setGpCatchUp} />
                  </div>
                  <div>
                    <Label className="text-sm">Hold Period (Years)</Label>
                    <Input 
                      type="number" 
                      value={holdPeriod} 
                      onChange={(e) => setHoldPeriod(e.target.value)}
                      min={1}
                      max={20}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between py-2 border-b text-sm">
                  <span className="text-muted-foreground">Total Capital</span>
                  <span className="font-semibold">{formatCurrency(totalCapital)}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-sm">
                  <span className="text-muted-foreground">Total Proceeds</span>
                  <span className="font-semibold">{formatCurrency(totalProceeds)}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-sm">
                  <span className="text-muted-foreground">Total Profit</span>
                  <span className="font-semibold text-green-600">{formatCurrency(totalProceeds - totalCapital)}</span>
                </div>
                <div className="flex justify-between py-2 border-b text-sm">
                  <span className="text-muted-foreground">Fund MOIC</span>
                  <span className="font-semibold">{fundMOIC.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-muted-foreground">Fund IRR</span>
                  <span className="font-semibold text-green-600">{fundIRR.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="partners" className="mt-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Partners & Commitments</h3>
              <Button size="sm" variant="outline" onClick={addInvestor}>
                Add Partner
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-2 border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge className="bg-primary text-xs">GP</Badge>
                    General Partner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Co-Investment</span>
                    <span className="font-medium">{formatCurrency(gpCapital)} ({((gpCapital / totalCapital) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Promote Rate</span>
                    <span className="font-medium">{carriedInterest}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Catch-Up</span>
                    <span className="font-medium">{gpCatchUp}%</span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>Projected Returns</span>
                    <span className="text-green-600">{formatCurrency(totalGP)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">LP</Badge>
                    Limited Partners ({investors.filter(i => !i.isGP).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total LP Capital</span>
                    <span className="font-medium">{formatCurrency(lpCap)} ({((lpCap / totalCapital) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preferred Return</span>
                    <span className="font-medium">{preferredReturn}% IRR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Split</span>
                    <span className="font-medium">{100 - parseFloat(carriedInterest)}%</span>
                  </div>
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>Projected Returns</span>
                    <span className="text-green-600">{formatCurrency(totalLP)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Investor Detail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Investor</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Type</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Commitment</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ownership %</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Proj. MOIC</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investors.map((investor) => {
                        const ownership = (investor.contribution / totalCapital) * 100;
                        const projMoic = investor.isGP ? gpMOIC : lpMOIC;
                        return (
                          <tr key={investor.id} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3 font-medium">{investor.name}</td>
                            <td className="text-center py-2 px-3">
                              <Badge className={investor.isGP ? "bg-primary text-xs" : ""} variant={investor.isGP ? "default" : "secondary"}>
                                {investor.isGP ? 'GP' : 'LP'}
                              </Badge>
                            </td>
                            <td className="text-right py-2 px-3">{formatCurrency(investor.contribution)}</td>
                            <td className="text-right py-2 px-3">{ownership.toFixed(1)}%</td>
                            <td className="text-right py-2 px-3">
                              <span className="text-green-600 font-medium">{projMoic.toFixed(2)}x</span>
                            </td>
                            <td className="text-center py-2 px-3">
                              <Button variant="ghost" size="sm" onClick={() => removeInvestor(investor.id)}>
                                ×
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="returns" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5" />
                Investor Returns Analysis
              </CardTitle>
              <CardDescription>Waterfall distribution based on exit scenario</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <Card className="bg-blue-500/10 border-blue-500/20">
                  <CardContent className="pt-4 text-center">
                    <div className="text-xl font-bold text-blue-600">{formatCurrency(totalProceeds)}</div>
                    <div className="text-xs text-muted-foreground">Total Proceeds</div>
                  </CardContent>
                </Card>
                <Card className="bg-green-500/10 border-green-500/20">
                  <CardContent className="pt-4 text-center">
                    <div className="text-xl font-bold text-green-600">{formatCurrency(totalProceeds - totalCapital)}</div>
                    <div className="text-xs text-muted-foreground">Total Profit</div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-500/10 border-purple-500/20">
                  <CardContent className="pt-4 text-center">
                    <div className="text-xl font-bold text-purple-600">{fundIRR.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Fund IRR</div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-500/10 border-orange-500/20">
                  <CardContent className="pt-4 text-center">
                    <div className="text-xl font-bold text-orange-600">{fundMOIC.toFixed(2)}x</div>
                    <div className="text-xs text-muted-foreground">Equity Multiple</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">LP Returns Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capital Invested</span>
                      <span>{formatCurrency(lpCap)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Distributions</span>
                      <span>{formatCurrency(totalLP)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Net Profit</span>
                      <span className="text-green-600">{formatCurrency(totalLP - lpCap)}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>LP IRR</span>
                      <span className="text-green-600">{lpIRR.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>LP Multiple</span>
                      <span className="text-green-600">{lpMOIC.toFixed(2)}x</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">GP Returns Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capital Invested</span>
                      <span>{formatCurrency(gpCapital)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Co-Invest Return</span>
                      <span>{formatCurrency(returnOfCapital * (gpCapital / totalCapital))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Promote (Carry)</span>
                      <span className="text-green-600">{formatCurrency(gpCatchUpAmount + gpCarry)}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>GP IRR</span>
                      <span className="text-green-600">{gpIRR.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>GP Multiple</span>
                      <span className="text-green-600">{gpMOIC.toFixed(2)}x</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Waterfall Distribution</CardTitle>
              <CardDescription>Step-by-step distribution breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Tier</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Description</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">LP Share</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">GP Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-blue-500/5">
                      <td className="py-2 px-3"><Badge variant="outline" className="text-xs">Tier 1</Badge></td>
                      <td className="py-2 px-3">Return of Capital</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(returnOfCapital)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(returnOfCapital * (lpCap / totalCapital))}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(returnOfCapital * (gpCapital / totalCapital))}</td>
                    </tr>
                    <tr className="bg-green-500/5">
                      <td className="py-2 px-3"><Badge variant="outline" className="text-xs">Tier 2</Badge></td>
                      <td className="py-2 px-3">Preferred Return ({preferredReturn}% IRR)</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(prefPayment)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(prefPayment)}</td>
                      <td className="py-2 px-3 text-right">$0</td>
                    </tr>
                    <tr className="bg-orange-500/5">
                      <td className="py-2 px-3"><Badge variant="outline" className="text-xs">Tier 3</Badge></td>
                      <td className="py-2 px-3">GP Catch-Up ({gpCatchUp}%)</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(gpCatchUpAmount)}</td>
                      <td className="py-2 px-3 text-right">$0</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(gpCatchUpAmount)}</td>
                    </tr>
                    <tr className="bg-purple-500/5">
                      <td className="py-2 px-3"><Badge variant="outline" className="text-xs">Tier 4</Badge></td>
                      <td className="py-2 px-3">Carried Interest ({carriedInterest}%/{100 - parseFloat(carriedInterest)}%)</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(gpCarry + lpProfitShare)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(lpProfitShare)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(gpCarry)}</td>
                    </tr>
                    <tr className="font-bold border-t-2">
                      <td className="py-2 px-3"></td>
                      <td className="py-2 px-3">Total Distributions</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(totalProceeds)}</td>
                      <td className="py-2 px-3 text-right text-blue-600">{formatCurrency(totalLP)}</td>
                      <td className="py-2 px-3 text-right text-green-600">{formatCurrency(totalGP)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface IRRCalculatorPanelProps {
  initialInvestment: string;
  exitValue: string;
  holdPeriod: number;
}

function IRRCalculatorPanel({ initialInvestment: initialInvest, exitValue: initialExitValue, holdPeriod: initialHoldPeriod }: IRRCalculatorPanelProps) {
  const [investmentLinked, setInvestmentLinked] = useState(true);
  const [exitLinked, setExitLinked] = useState(true);
  
  const [initialInvestment, setInitialInvestment] = useState<string>(initialInvest);
  const [exitValue, setExitValue] = useState<string>(initialExitValue);
  const [year1, setYear1] = useState<string>("100000");
  const [year2, setYear2] = useState<string>("150000");
  const [year3, setYear3] = useState<string>("200000");

  useEffect(() => {
    if (investmentLinked) setInitialInvestment(initialInvest);
  }, [initialInvest, investmentLinked]);

  useEffect(() => {
    if (exitLinked) setExitValue(initialExitValue);
  }, [initialExitValue, exitLinked]);

  const annualCashFlows = [
    parseFloat(year1) || 0,
    parseFloat(year2) || 0,
    parseFloat(year3) || 0,
  ];
  
  const cashFlows = [
    -(parseFloat(initialInvestment) || 0),
    ...annualCashFlows.slice(0, initialHoldPeriod - 1),
    (annualCashFlows[Math.min(initialHoldPeriod - 1, 2)] || 0) + (parseFloat(exitValue) || 0)
  ];

  const calculateIRR = (flows: number[]) => {
    if (flows.length < 2) return "0.00";
    let rate = 0.1;
    for (let i = 0; i < 100; i++) {
      let npv = 0;
      let npvDerivative = 0;
      for (let t = 0; t < flows.length; t++) {
        npv += flows[t] / Math.pow(1 + rate, t);
        npvDerivative -= t * flows[t] / Math.pow(1 + rate, t + 1);
      }
      if (Math.abs(npv) < 0.01) break;
      if (npvDerivative !== 0) {
        rate = rate - npv / npvDerivative;
      }
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
            Multi-period return analysis ({initialHoldPeriod}-year hold)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                Initial Investment
                {investmentLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={initialInvestment} 
                onChange={(v) => { setInitialInvestment(v); setInvestmentLinked(false); }}
                linked={investmentLinked}
                onUnlink={() => setInvestmentLinked(false)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Exit Value
                {exitLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={exitValue} 
                onChange={(v) => { setExitValue(v); setExitLinked(false); }}
                linked={exitLinked}
                onUnlink={() => setExitLinked(false)}
              />
            </div>
            <div>
              <Label>Year 1 Cash Flow</Label>
              <CurrencyInput value={year1} onChange={setYear1} />
            </div>
            <div>
              <Label>Year 2 Cash Flow</Label>
              <CurrencyInput value={year2} onChange={setYear2} />
            </div>
            <div className="col-span-2">
              <Label>Year 3 Cash Flow</Label>
              <CurrencyInput value={year3} onChange={setYear3} />
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
              <span className="font-semibold text-green-600">{formatCurrency(totalCashFlow)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SensitivityPanelProps {
  baseNOI: string;
  baseCapRate: string;
}

function SensitivityPanel({ baseNOI: initialNOI, baseCapRate: initialCapRate }: SensitivityPanelProps) {
  const [noiLinked, setNoiLinked] = useState(true);
  const [capRateLinked, setCapRateLinked] = useState(true);
  
  const [baseNOI, setBaseNOI] = useState<string>(initialNOI);
  const [baseCapRate, setBaseCapRate] = useState<string>(initialCapRate);

  useEffect(() => {
    if (noiLinked) setBaseNOI(initialNOI);
  }, [initialNOI, noiLinked]);

  useEffect(() => {
    if (capRateLinked) setBaseCapRate(initialCapRate);
  }, [initialCapRate, capRateLinked]);

  const capRates = [5, 5.5, 6, 6.5, 7, 7.5, 8];
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
              <Label className="flex items-center gap-1">
                Base NOI
                {noiLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <CurrencyInput 
                value={baseNOI} 
                onChange={(v) => { setBaseNOI(v); setNoiLinked(false); }}
                linked={noiLinked}
                onUnlink={() => setNoiLinked(false)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Base Cap Rate
                {capRateLinked && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <div className="relative">
                <PercentInput 
                  value={baseCapRate} 
                  onChange={(v) => { setBaseCapRate(v); setCapRateLinked(false); }}
                />
                {capRateLinked && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => setCapRateLinked(false)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-blue-100 rounded z-10"
                          type="button"
                        >
                          <Link2 className="h-4 w-4 text-blue-500" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Linked to project data. Click to unlink.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
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
                    <th key={cr} className="p-2 text-center">{formatPercent(cr)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {noiChanges.map(change => {
                  const noi = (parseFloat(baseNOI) || 0) * (1 + change / 100);
                  return (
                    <tr key={change} className="border-b">
                      <td className="p-2 font-medium">
                        {formatCurrency(noi)} ({change >= 0 ? '+' : ''}{change}%)
                      </td>
                      {capRates.map(cr => {
                        const value = calculateValue(noi, cr);
                        const isBase = change === 0 && Math.abs(cr - parseFloat(baseCapRate)) < 0.1;
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

interface AIInsightsPanelProps {
  projectId: string;
  salePrice: number;
  purchasePrice: number;
  holdPeriod: number;
  scenario: string;
}

function AIInsightsPanel({ projectId, salePrice, purchasePrice, holdPeriod, scenario }: AIInsightsPanelProps) {
  const appreciation = ((salePrice - purchasePrice) / purchasePrice * 100).toFixed(1);
  const annualReturn = (Math.pow(salePrice / purchasePrice, 1 / holdPeriod) - 1) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-pink-500" />
          AI Insights
        </CardTitle>
        <CardDescription>
          AI-powered exit recommendations based on {scenario} scenario
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Total Appreciation</p>
            <p className="text-2xl font-bold text-green-600">{appreciation}%</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Annualized Return</p>
            <p className="text-2xl font-bold text-blue-600">{annualReturn.toFixed(1)}%</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Hold Period</p>
            <p className="text-2xl font-bold">{holdPeriod} years</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h4 className="font-medium">Exit Timing Recommendation</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Based on your {holdPeriod}-year hold period and {scenario} assumptions, 
                  the projected exit value of {formatCurrency(salePrice)} represents solid returns. 
                  Consider market conditions and interest rate environment when finalizing exit timing.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <RefreshCcw className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h4 className="font-medium">Tax Strategy Consideration</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  With {formatCurrency(salePrice - purchasePrice)} in potential gains, 
                  consider a 1031 exchange to defer capital gains taxes. This could preserve 
                  more capital for your next investment.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h4 className="font-medium">Value Enhancement Opportunity</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Review the Sensitivity Analysis tab to understand how NOI improvements 
                  could impact exit value. Small operational improvements can significantly 
                  increase sale price at your target cap rate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ScenarioBuilderPanelProps {
  salePrice: number;
  purchasePrice: number;
  holdPeriod: number;
  scenarioName: string;
  onScenarioResult: (result: ExitScenarioResult) => void;
}

function ScenarioBuilderPanel({ salePrice, purchasePrice, holdPeriod, scenarioName, onScenarioResult }: ScenarioBuilderPanelProps) {
  const [strategyType, setStrategyType] = useState<'cash_sale' | 'exchange_1031' | 'seller_financing' | 'dst_investment' | 'hybrid'>('cash_sale');
  const [customName, setCustomName] = useState(`${scenarioName} - Cash Sale`);
  const [debtBalance, setDebtBalance] = useState('0');
  const [brokerRate, setBrokerRate] = useState('5');
  const [closingCosts, setClosingCosts] = useState('50000');
  const [depreciationYears, setDepreciationYears] = useState('39');
  const [filingStatus, setFilingStatus] = useState<'single' | 'married' | 'head_of_household'>('married');
  const [otherIncome, setOtherIncome] = useState('200000');
  const [stateOfResidence, setStateOfResidence] = useState('FL');
  const [includeRefinance, setIncludeRefinance] = useState(false);
  const [refiYear, setRefiYear] = useState('3');
  const [refiAmount, setRefiAmount] = useState('0');
  const [refiCashOut, setRefiCashOut] = useState('0');

  useEffect(() => {
    const label = strategyType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    setCustomName(`${scenarioName} - ${label}`);
  }, [strategyType, scenarioName]);

  const scenarioInput: ExitScenarioInput = {
    scenarioName: customName,
    scenarioType: strategyType,
    property: {
      purchasePrice,
      acquisitionCosts: purchasePrice * 0.02,
      landValue: purchasePrice * 0.20,
      improvementValue: purchasePrice * 0.80,
      depreciationScheduleYears: parseInt(depreciationYears) || 39,
      holdingPeriodYears: holdPeriod,
    },
    sale: {
      salePrice,
      brokerCommissionRate: parseFloat(brokerRate) / 100 || 0.05,
      closingCosts: parseFloat(closingCosts) || 50000,
      holdingPeriodMonths: holdPeriod * 12,
    },
    debt: {
      outstandingBalance: parseFloat(debtBalance) || 0,
      prepaymentPenalty: 0,
      refinanceEvents: includeRefinance ? [{
        year: parseInt(refiYear) || 3,
        newLoanAmount: parseFloat(refiAmount) || 0,
        interestRate: 0.065,
        termYears: 25,
        cashOutProceeds: parseFloat(refiCashOut) || 0,
        closingCosts: (parseFloat(refiAmount) || 0) * 0.01,
      }] : undefined,
    },
    taxProfile: {
      filingStatus,
      otherOrdinaryIncome: parseFloat(otherIncome) || 200000,
      otherInvestmentIncome: 0,
      stateOfResidence,
    },
    exchange1031: strategyType === 'exchange_1031' ? {
      saleDate: new Date().toISOString().split('T')[0],
      replacementProperties: [{
        name: 'Replacement Property 1',
        purchasePrice: salePrice * 1.1,
        newMortgage: salePrice * 0.7,
        closingCosts: salePrice * 0.02,
        identificationPriority: 'primary' as const,
      }],
      qualifiedIntermediaryFee: 2500,
      additionalCashInvested: salePrice * 0.1,
    } : undefined,
    sellerFinancing: strategyType === 'seller_financing' ? {
      downPaymentPercent: 0.20,
      noteInterestRate: 0.07,
      noteTermYears: 10,
      amortizationYears: 25,
      buyerCreditProfile: {
        creditScore: 720,
        debtToIncomeRatio: 0.35,
        liquidReserves: salePrice * 0.1,
        yearsInBusiness: 10,
        hasBankruptcy: false,
        hasForeclosure: false,
        personalGuarantee: true,
      },
      collateral: {
        appraisedValue: salePrice * 1.05,
        lienPosition: 'first' as const,
        hasUccFiling: true,
        hasPersonalGuarantee: true,
      },
    } : undefined,
    installmentSale: strategyType === 'seller_financing' ? {
      enabled: true,
      downPaymentPercent: 0.20,
      termYears: 10,
      interestRate: 0.07,
    } : undefined,
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Play className="h-4 w-4 text-teal-500" />
            Scenario Configuration
          </CardTitle>
          <CardDescription className="text-xs">
            Configure and run institutional-grade exit analysis using the unified calculation engine
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Scenario Name</Label>
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Exit Strategy</Label>
              <Select value={strategyType} onValueChange={(v: any) => setStrategyType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_sale">Cash Sale</SelectItem>
                  <SelectItem value="exchange_1031">1031 Exchange</SelectItem>
                  <SelectItem value="seller_financing">Seller Financing</SelectItem>
                  <SelectItem value="dst_investment">DST Investment</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Outstanding Debt</Label>
              <Input type="number" value={debtBalance} onChange={(e) => setDebtBalance(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Broker Rate (%)</Label>
              <Input type="number" step="0.1" value={brokerRate} onChange={(e) => setBrokerRate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Closing Costs</Label>
              <Input type="number" value={closingCosts} onChange={(e) => setClosingCosts(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Filing Status</Label>
              <Select value={filingStatus} onValueChange={(v: any) => setFilingStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married Filing Jointly</SelectItem>
                  <SelectItem value="head_of_household">Head of Household</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Other Ordinary Income</Label>
              <Input type="number" value={otherIncome} onChange={(e) => setOtherIncome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">State of Residence</Label>
              <Input value={stateOfResidence} onChange={(e) => setStateOfResidence(e.target.value)} maxLength={2} />
            </div>
          </div>

          <div className="flex items-center gap-3 py-2 border-t">
            <Switch checked={includeRefinance} onCheckedChange={setIncludeRefinance} />
            <Label className="text-xs font-medium">Include Refinance Event</Label>
          </div>

          {includeRefinance && (
            <div className="grid grid-cols-3 gap-4 pl-4 border-l-2 border-teal-200">
              <div>
                <Label className="text-xs">Refi Year</Label>
                <Input type="number" value={refiYear} onChange={(e) => setRefiYear(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">New Loan Amount</Label>
                <Input type="number" value={refiAmount} onChange={(e) => setRefiAmount(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Cash-Out Proceeds</Label>
                <Input type="number" value={refiCashOut} onChange={(e) => setRefiCashOut(e.target.value)} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ScenarioBuilder 
        scenarioInput={scenarioInput} 
        onResultChange={onScenarioResult}
      />
    </div>
  );
}
