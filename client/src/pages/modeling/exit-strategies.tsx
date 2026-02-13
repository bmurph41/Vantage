import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Calculator, 
  TrendingUp, 
  Percent,
  BarChart3,
  Brain,
  RefreshCcw,
  Landmark,
  HandCoins,
  Award,
  Target,
  Info,
  Settings2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Link,
  Search,
  Building2,
  MapPin
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useExitStrategiesStore, type MasterInputs } from "@/stores/exitStrategiesStore";
import type { ModelingProject } from "@shared/schema";

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
  "data-testid"?: string;
}

function CurrencyInput({ value, onChange, "data-testid": testId }: CurrencyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState(formatCurrency(value));

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
    <Input
      type={isFocused ? "number" : "text"}
      value={isFocused ? displayValue : formatCurrency(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      data-testid={testId}
    />
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

function SharedInputsPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const { masterInputs, setMasterInput, reset } = useExitStrategiesStore();

  const handleInputChange = <K extends keyof MasterInputs>(key: K, value: string) => {
    const numValue = parseFloat(value) || 0;
    setMasterInput(key, numValue as MasterInputs[K]);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Master Inputs</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => reset()}
                className="h-8 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CardDescription className="text-xs">
            These values are shared across all exit strategy calculators. Changes here update all tabs.
          </CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <Label className="text-xs">Sale Price</Label>
                <CurrencyInput
                  value={masterInputs.salePrice.toString()}
                  onChange={(v) => handleInputChange('salePrice', v)}
                  data-testid="master-sale-price"
                />
              </div>
              <div>
                <Label className="text-xs">Cost Basis</Label>
                <CurrencyInput
                  value={masterInputs.costBasis.toString()}
                  onChange={(v) => handleInputChange('costBasis', v)}
                  data-testid="master-cost-basis"
                />
              </div>
              <div>
                <Label className="text-xs">Depreciation Taken</Label>
                <CurrencyInput
                  value={masterInputs.depreciationTaken.toString()}
                  onChange={(v) => handleInputChange('depreciationTaken', v)}
                  data-testid="master-depreciation"
                />
              </div>
              <div>
                <Label className="text-xs">Holding Period (Yrs)</Label>
                <Input
                  type="number"
                  value={masterInputs.holdingPeriod}
                  onChange={(e) => handleInputChange('holdingPeriod', e.target.value)}
                  data-testid="master-holding-period"
                />
              </div>
              <div>
                <Label className="text-xs">Federal Tax Rate</Label>
                <PercentInput
                  value={masterInputs.federalTaxRate.toString()}
                  onChange={(v) => handleInputChange('federalTaxRate', v)}
                  data-testid="master-fed-rate"
                />
              </div>
              <div>
                <Label className="text-xs">State Tax Rate</Label>
                <PercentInput
                  value={masterInputs.stateTaxRate.toString()}
                  onChange={(v) => handleInputChange('stateTaxRate', v)}
                  data-testid="master-state-rate"
                />
              </div>
              <div>
                <Label className="text-xs">Current Debt</Label>
                <CurrencyInput
                  value={masterInputs.currentDebtBalance.toString()}
                  onChange={(v) => handleInputChange('currentDebtBalance', v)}
                  data-testid="master-debt"
                />
              </div>
              <div>
                <Label className="text-xs">Closing Costs</Label>
                <CurrencyInput
                  value={masterInputs.closingCosts.toString()}
                  onChange={(v) => handleInputChange('closingCosts', v)}
                  data-testid="master-closing-costs"
                />
              </div>
              <div>
                <Label className="text-xs">Broker Fee %</Label>
                <PercentInput
                  value={masterInputs.brokerFeePercent.toString()}
                  onChange={(v) => handleInputChange('brokerFeePercent', v)}
                  data-testid="master-broker-fee"
                />
              </div>
              <div>
                <Label className="text-xs">Capital Improvements</Label>
                <CurrencyInput
                  value={masterInputs.capitalImprovements.toString()}
                  onChange={(v) => handleInputChange('capitalImprovements', v)}
                  data-testid="master-cap-improvements"
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

const exitTools = [
  { 
    id: "tax-proceeds", 
    name: "Tax & Net Proceeds", 
    shortName: "Tax & Proceeds",
    description: "Capital gains tax analysis and net proceeds waterfall", 
    icon: Calculator,
    color: "text-red-500",
    bgColor: "bg-red-50"
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
  const [activeTab, setActiveTab] = useState("tax-proceeds");
  const [, navigate] = useLocation();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: projects = [], isLoading: projectsLoading } = useQuery<ModelingProject[]>({
    queryKey: ['/api/modeling/projects'],
    enabled: isLinkModalOpen,
  });

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = projectSearch === "" || 
      project.marinaName.toLowerCase().includes(projectSearch.toLowerCase()) ||
      project.city?.toLowerCase().includes(projectSearch.toLowerCase()) ||
      project.state?.toLowerCase().includes(projectSearch.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && project.dealOutcome === "active") ||
      (statusFilter === "archived" && project.dealOutcome === "archived") ||
      (statusFilter === "under_review" && project.dealOutcome === "under_review") ||
      (statusFilter === "closed" && (project.dealOutcome === "closed_won" || project.dealOutcome === "closed_lost"));
    
    return matchesSearch && matchesStatus;
  });

  const handleLinkToProject = (projectId: string) => {
    navigate(`/modeling/projects/${projectId}?tab=exit`);
    setIsLinkModalOpen(false);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            onClick={() => setIsLinkModalOpen(true)}
            data-testid="button-link-to-project"
          >
            <Link className="h-4 w-4 mr-2" />
            Link to Project
          </Button>
        </div>

        <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link className="h-5 w-5 text-primary" />
                Link to Modeling Project
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                {projectsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Building2 className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No projects found</p>
                    <p className="text-sm text-muted-foreground/70">Try adjusting your search or filter</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProjects.map((project) => (
                      <Card 
                        key={project.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleLinkToProject(project.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                                <span className="font-medium truncate">{project.marinaName}</span>
                              </div>
                              {(project.city || project.state) && (
                                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span>{[project.city, project.state].filter(Boolean).join(", ")}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-3">
                              {project.dealOutcome && (
                                <Badge variant={
                                  project.dealOutcome === "active" ? "default" :
                                  project.dealOutcome === "archived" ? "secondary" :
                                  project.dealOutcome === "under_review" ? "outline" :
                                  "secondary"
                                }>
                                  {project.dealOutcome.replace(/_/g, " ")}
                                </Badge>
                              )}
                              <Button size="sm" variant="ghost">
                                <Link className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 font-medium">Standalone Mode</p>
                <p className="text-sm text-blue-700">
                  Master inputs below are shared across all tabs. Change a value once and it updates everywhere.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <SharedInputsPanel />

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

          <TabsContent value="tax-proceeds" className="mt-6">
            <TaxAndProceedsPanel />
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

function TaxAndProceedsPanel() {
  const { masterInputs } = useExitStrategiesStore();

  const sale = masterInputs.salePrice;
  const basis = masterInputs.costBasis;
  const depreciation = masterInputs.depreciationTaken;
  const fedRate = masterInputs.federalTaxRate / 100;
  const stRate = masterInputs.stateTaxRate / 100;
  const loan = masterInputs.currentDebtBalance;
  const closingCosts = masterInputs.closingCosts;
  const brokerPct = masterInputs.brokerFeePercent / 100;

  const capitalGain = sale - basis;
  const federalTax = capitalGain * fedRate;
  const stateTax = capitalGain * stRate;
  const depTax = depreciation * 0.25;
  const niit = capitalGain > 250000 ? capitalGain * 0.038 : 0;
  const totalTax = federalTax + stateTax + depTax + niit;

  const brokerCost = sale * brokerPct;
  const netSaleProceeds = sale - brokerCost - closingCosts;
  const totalDeductions = loan + closingCosts + brokerCost + totalTax;
  const netProceeds = sale - totalDeductions;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-red-500" />
            Sale & Tax Inputs
          </CardTitle>
          <CardDescription>
            Values from Master Inputs panel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Sale Price</span>
              <span className="font-medium">{formatCurrency(masterInputs.salePrice)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Cost Basis</span>
              <span className="font-medium">{formatCurrency(masterInputs.costBasis)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Depreciation Taken</span>
              <span className="font-medium">{formatCurrency(masterInputs.depreciationTaken)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Holding Period</span>
              <span className="font-medium">{masterInputs.holdingPeriod} years</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Federal Rate / State Rate</span>
              <span className="font-medium">{masterInputs.federalTaxRate}% / {masterInputs.stateTaxRate}%</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Loan Balance</span>
              <span className="font-medium">{formatCurrency(masterInputs.currentDebtBalance)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Closing Costs</span>
              <span className="font-medium">{formatCurrency(masterInputs.closingCosts)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Broker Fee</span>
              <span className="font-medium">{masterInputs.brokerFeePercent}%</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Edit these values in the Master Inputs panel above
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Capital Gain</span>
              <span className="font-semibold" data-testid="text-capital-gain">{formatCurrency(capitalGain)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Federal Tax</span>
              <span className="text-red-600" data-testid="text-federal-tax">-{formatCurrency(federalTax)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">State Tax</span>
              <span className="text-red-600" data-testid="text-state-tax">-{formatCurrency(stateTax)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Depreciation Recapture (25%)</span>
              <span className="text-red-600" data-testid="text-dep-recapture">-{formatCurrency(depTax)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">NIIT (3.8%)</span>
              <span className="text-red-600" data-testid="text-niit">-{formatCurrency(niit)}</span>
            </div>
            <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-3">
              <span className="font-semibold">Total Tax Liability</span>
              <span className="font-bold text-red-600" data-testid="text-total-tax">{formatCurrency(totalTax)}</span>
            </div>
          </div>

          <div className="border-t my-4" />

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Net Proceeds Waterfall</h4>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Gross Sale</span>
              <span className="font-semibold">{formatCurrency(sale)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Broker Commission</span>
              <span className="text-red-600">-{formatCurrency(brokerCost)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Closing Costs</span>
              <span className="text-red-600">-{formatCurrency(closingCosts)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Net Sale Proceeds</span>
              <span className="font-semibold">{formatCurrency(netSaleProceeds)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Loan Payoff</span>
              <span className="text-red-600">-{formatCurrency(loan)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Taxes</span>
              <span className="text-red-600">-{formatCurrency(totalTax)}</span>
            </div>
            <div className="flex justify-between py-3 bg-green-50 rounded-lg px-3">
              <span className="font-semibold">Net Cash Proceeds</span>
              <span className="font-bold text-green-600" data-testid="text-net-proceeds">{formatCurrency(netProceeds)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Exchange1031Panel() {
  const { masterInputs } = useExitStrategiesStore();
  const [replacementValue, setReplacementValue] = useState<string>("6000000");
  const [bootReceived, setBootReceived] = useState<string>("0");
  const [identificationDays] = useState<string>("45");
  const [closingDays] = useState<string>("180");

  const relinquishedValue = masterInputs.salePrice;
  const adjustedBasis = masterInputs.costBasis + masterInputs.capitalImprovements - masterInputs.depreciationTaken;
  const gain = relinquishedValue - adjustedBasis;
  const deferredGain = Math.min(gain, parseFloat(replacementValue) || 0);
  const taxableGain = parseFloat(bootReceived) || 0;
  const taxSaved = deferredGain * ((masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-blue-500" />
            1031 Exchange Planner
          </CardTitle>
          <CardDescription>
            Relinquished value from master Sale Price
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Relinquished Value (Sale Price)</span>
              <span className="font-medium">{formatCurrency(relinquishedValue)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Adjusted Basis</span>
              <span className="font-medium">{formatCurrency(adjustedBasis)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Realized Gain</span>
              <span className="font-medium">{formatCurrency(gain)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Replacement Property Value</Label>
              <CurrencyInput value={replacementValue} onChange={setReplacementValue} />
            </div>
            <div>
              <Label>Boot Received</Label>
              <CurrencyInput value={bootReceived} onChange={setBootReceived} />
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
              <span className="text-muted-foreground">Tax Savings</span>
              <span className="font-semibold text-green-600">{formatCurrency(taxSaved)}</span>
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
  const { masterInputs } = useExitStrategiesStore();
  const [distributionRate, setDistributionRate] = useState<string>("5.5");

  const investmentAmount = masterInputs.salePrice - masterInputs.currentDebtBalance - masterInputs.closingCosts;
  const annualDistribution = investmentAmount * (parseFloat(distributionRate) / 100 || 0);
  const totalDistributions = annualDistribution * masterInputs.holdingPeriod;
  const gain = masterInputs.salePrice - masterInputs.costBasis;
  const deferredTax = gain * ((masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-purple-500" />
            DST Analysis
          </CardTitle>
          <CardDescription>
            Investment amount from net equity (Sale - Debt - Costs)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Net Equity Available</span>
              <span className="font-medium">{formatCurrency(investmentAmount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Hold Period</span>
              <span className="font-medium">{masterInputs.holdingPeriod} years</span>
            </div>
          </div>
          <div>
            <Label>Distribution Rate</Label>
            <PercentInput value={distributionRate} onChange={setDistributionRate} />
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
              <span className="text-muted-foreground">Investment Amount</span>
              <span className="font-semibold">{formatCurrency(investmentAmount)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Annual Distribution</span>
              <span className="font-semibold text-green-600">{formatCurrency(annualDistribution)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Distributions ({masterInputs.holdingPeriod} yrs)</span>
              <span className="font-semibold">{formatCurrency(totalDistributions)}</span>
            </div>
            <div className="flex justify-between py-3 bg-green-50 rounded-lg px-3">
              <span className="font-semibold">Tax Deferred via 1031</span>
              <span className="font-bold text-green-600">{formatCurrency(deferredTax)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SellerFinancingPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const [downPaymentPercent, setDownPaymentPercent] = useState<string>("20");
  const [interestRate, setInterestRate] = useState<string>("6");
  const [term, setTerm] = useState<string>("10");

  const salePrice = masterInputs.salePrice;
  const downPayment = salePrice * (parseFloat(downPaymentPercent) / 100 || 0);
  const loanAmount = salePrice - downPayment;
  const monthlyRate = (parseFloat(interestRate) / 100 || 0) / 12;
  const months = (parseFloat(term) || 0) * 12;
  const monthlyPayment = monthlyRate > 0 ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1) : 0;
  const totalInterest = (monthlyPayment * months) - loanAmount;
  
  const gain = salePrice - masterInputs.costBasis;
  const grossProfitRatio = salePrice > 0 ? gain / salePrice : 0;
  const taxableDownPayment = downPayment * grossProfitRatio;
  const annualPrincipal = loanAmount / (parseFloat(term) || 1);
  const annualTaxableGain = annualPrincipal * grossProfitRatio;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-amber-500" />
            Seller Financing
          </CardTitle>
          <CardDescription>
            Sale price from master inputs with installment sale treatment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 bg-muted/30 rounded-lg p-4">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Sale Price</span>
              <span className="font-medium">{formatCurrency(salePrice)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Cost Basis</span>
              <span className="font-medium">{formatCurrency(masterInputs.costBasis)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground text-sm">Gain</span>
              <span className="font-medium">{formatCurrency(gain)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Down Payment %</Label>
              <PercentInput value={downPaymentPercent} onChange={setDownPaymentPercent} />
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
              <span className="text-muted-foreground">Down Payment</span>
              <span className="font-semibold">{formatCurrency(downPayment)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Note Amount</span>
              <span className="font-semibold">{formatCurrency(loanAmount)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Monthly Payment</span>
              <span className="font-semibold text-green-600">{formatCurrency(monthlyPayment)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Total Interest Income</span>
              <span>{formatCurrency(totalInterest)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Gross Profit Ratio</span>
              <span>{(grossProfitRatio * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between py-3 bg-amber-50 rounded-lg px-3">
              <span className="font-semibold">Year 1 Taxable Gain</span>
              <span className="font-bold text-amber-600">{formatCurrency(taxableDownPayment + annualTaxableGain)}</span>
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
              <Label>Base Price</Label>
              <CurrencyInput value={basePrice} onChange={setBasePrice} />
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
              <Label>Total Distribution</Label>
              <CurrencyInput value={totalDistribution} onChange={setTotalDistribution} />
            </div>
            <div>
              <Label>LP Capital</Label>
              <CurrencyInput value={lpCapital} onChange={setLpCapital} />
            </div>
            <div>
              <Label>Preferred Return</Label>
              <PercentInput value={preferredReturn} onChange={setPreferredReturn} />
            </div>
            <div>
              <Label>Carried Interest</Label>
              <PercentInput value={carriedInterest} onChange={setCarriedInterest} />
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
              <span className="font-semibold">{formatCurrency(prefAmount)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">LP Capital Return</span>
              <span className="font-semibold">{formatCurrency(lpCapital)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">GP Carried Interest</span>
              <span className="font-semibold">{formatCurrency(gpCarry)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">LP Profit Share</span>
              <span className="font-semibold text-green-600">{formatCurrency(lpShare)}</span>
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
              <Label>Initial Investment</Label>
              <CurrencyInput value={initialInvestment} onChange={setInitialInvestment} />
            </div>
            <div>
              <Label>Year 1 Cash Flow</Label>
              <CurrencyInput value={year1} onChange={setYear1} />
            </div>
            <div>
              <Label>Year 2 Cash Flow</Label>
              <CurrencyInput value={year2} onChange={setYear2} />
            </div>
            <div>
              <Label>Year 3 Cash Flow</Label>
              <CurrencyInput value={year3} onChange={setYear3} />
            </div>
            <div className="col-span-2">
              <Label>Exit Value</Label>
              <CurrencyInput value={exitValue} onChange={setExitValue} />
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
              <Label>Base NOI</Label>
              <CurrencyInput value={baseNOI} onChange={setBaseNOI} />
            </div>
            <div>
              <Label>Base Cap Rate</Label>
              <PercentInput value={baseCapRate} onChange={setBaseCapRate} />
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
