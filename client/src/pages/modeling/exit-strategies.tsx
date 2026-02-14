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

function getCashSaleBaseline(m: MasterInputs) {
  const adjustedBasis = m.costBasis + m.capitalImprovements - m.depreciationTaken;
  const capitalGain = m.salePrice - adjustedBasis;
  const depRecapture = Math.min(m.depreciationTaken, Math.max(0, capitalGain)) * 0.25;
  const longTermGain = Math.max(0, capitalGain - m.depreciationTaken);
  const federalTax = longTermGain * (m.federalTaxRate / 100);
  const stateTax = longTermGain * (m.stateTaxRate / 100);
  const niit = longTermGain > 250000 ? longTermGain * 0.038 : 0;
  const totalTax = federalTax + stateTax + depRecapture + niit;
  const brokerCost = m.salePrice * (m.brokerFeePercent / 100);
  const closingCosts = m.closingCosts;
  const netSaleProceeds = m.salePrice - brokerCost - closingCosts;
  const netCashProceeds = netSaleProceeds - m.currentDebtBalance - totalTax;
  const effectiveTaxRate = capitalGain > 0 ? (totalTax / capitalGain) * 100 : 0;
  return { adjustedBasis, capitalGain, depRecapture, longTermGain, federalTax, stateTax, niit, totalTax, brokerCost, closingCosts, netSaleProceeds, netCashProceeds, effectiveTaxRate };
}

function CashSaleBaselineCard({ baseline, label }: { baseline: ReturnType<typeof getCashSaleBaseline>; label?: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{label || "Cash Sale Baseline (for comparison)"}</h4>
      <div className="flex justify-between py-1">
        <span className="text-muted-foreground text-sm">Total Tax (Cash Sale)</span>
        <span className="num font-medium text-red-600">{formatCurrency(baseline.totalTax)}</span>
      </div>
      <div className="flex justify-between py-1">
        <span className="text-muted-foreground text-sm">Net Cash Proceeds</span>
        <span className="num font-medium">{formatCurrency(baseline.netCashProceeds)}</span>
      </div>
      <div className="flex justify-between py-1">
        <span className="text-muted-foreground text-sm">Effective Tax Rate</span>
        <span className="num font-medium">{baseline.effectiveTaxRate.toFixed(1)}%</span>
      </div>
    </div>
  );
}

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
    id: "comparison", 
    name: "Strategy Comparison", 
    shortName: "Compare",
    description: "Side-by-side strategy comparison", 
    icon: Target,
    color: "text-teal-500",
    bgColor: "bg-teal-50"
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
                className="flex items-center gap-1.5 px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600"
                data-testid={`tab-${tool.id}`}
              >
                <tool.icon className={`h-3.5 w-3.5 ${activeTab === tool.id ? 'text-blue-600' : ''}`} />
                <span>{tool.shortName}</span>
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

          <TabsContent value="comparison" className="mt-6">
            <CrossStrategyComparisonPanel />
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
  const b = getCashSaleBaseline(masterInputs);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tax Analysis</CardTitle>
            <CardDescription>Capital gains and depreciation recapture breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basis Calculation</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Original Cost Basis</span>
                <span className="num font-medium">{formatCurrency(masterInputs.costBasis)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">+ Capital Improvements</span>
                <span className="num font-medium text-green-600">+{formatCurrency(masterInputs.capitalImprovements)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">- Accumulated Depreciation</span>
                <span className="num font-medium text-red-600">-{formatCurrency(masterInputs.depreciationTaken)}</span>
              </div>
              <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Adjusted Basis</span>
                <span className="num font-semibold">{formatCurrency(b.adjustedBasis)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gain Analysis</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Sale Price</span>
                <span className="num font-medium">{formatCurrency(masterInputs.salePrice)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Adjusted Basis</span>
                <span className="num font-medium">-{formatCurrency(b.adjustedBasis)}</span>
              </div>
              <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Total Capital Gain</span>
                <span className="num font-semibold text-green-600" data-testid="text-capital-gain">{formatCurrency(b.capitalGain)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax Liability</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Depreciation Recapture (25%)</span>
                <span className="num font-medium text-red-600" data-testid="text-dep-recapture">-{formatCurrency(b.depRecapture)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Federal Tax ({masterInputs.federalTaxRate}%)</span>
                <span className="num font-medium text-red-600" data-testid="text-federal-tax">-{formatCurrency(b.federalTax)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">State Tax ({masterInputs.stateTaxRate}%)</span>
                <span className="num font-medium text-red-600" data-testid="text-state-tax">-{formatCurrency(b.stateTax)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">NIIT (3.8%)</span>
                <span className="num font-medium text-red-600" data-testid="text-niit">-{formatCurrency(b.niit)}</span>
              </div>
              <div className="flex justify-between py-2.5 bg-red-50 rounded-lg px-3">
                <span className="font-semibold">Total Tax Liability</span>
                <span className="num font-bold text-red-600" data-testid="text-total-tax">{formatCurrency(b.totalTax)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Effective Tax Rate</span>
                <span className="num font-medium">{b.effectiveTaxRate.toFixed(1)}%</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Section 1250/1231 Breakdown</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Unrecaptured §1250 Gain (25%)</span>
                <span className="num font-medium">{formatCurrency(Math.min(masterInputs.depreciationTaken, Math.max(0, b.capitalGain)))}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">§1231 Long-Term Gain</span>
                <span className="num font-medium text-green-600">{formatCurrency(Math.max(0, b.capitalGain - masterInputs.depreciationTaken))}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">NIIT Threshold ($250K)</span>
                <span className={`num font-medium ${b.capitalGain > 250000 ? 'text-red-600' : 'text-green-600'}`}>
                  {b.capitalGain > 250000 ? 'Triggered — NIIT applies' : 'Below threshold'}
                </span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AMT Exposure Estimate</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">AMT Preference Items (est.)</span>
                <span className="num font-medium">{formatCurrency(masterInputs.depreciationTaken * 0.15)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Tentative AMT (28%)</span>
                <span className="num font-medium text-amber-600">{formatCurrency(masterInputs.depreciationTaken * 0.15 * 0.28)}</span>
              </div>
              <p className="text-xs text-muted-foreground italic pt-1">AMT exposure is estimated. Consult a CPA for precise calculation.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Proceeds Waterfall</CardTitle>
            <CardDescription>Step-by-step deductions from gross sale to net cash</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Gross Sale Price</span>
                <span className="num font-semibold">{formatCurrency(masterInputs.salePrice)}</span>
              </div>

              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Transaction Costs</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Broker Commission ({masterInputs.brokerFeePercent}%)</span>
                <span className="num font-medium text-red-600">-{formatCurrency(b.brokerCost)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Closing Costs</span>
                <span className="num font-medium text-red-600">-{formatCurrency(b.closingCosts)}</span>
              </div>
              <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Net Sale Proceeds</span>
                <span className="num font-semibold">{formatCurrency(b.netSaleProceeds)}</span>
              </div>

              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Obligations</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Loan Payoff</span>
                <span className="num font-medium text-red-600">-{formatCurrency(masterInputs.currentDebtBalance)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Total Taxes</span>
                <span className="num font-medium text-red-600">-{formatCurrency(b.totalTax)}</span>
              </div>

              <div className="flex justify-between py-3 bg-green-50 rounded-lg px-3">
                <span className="font-semibold">Net Cash to Seller</span>
                <span className="num font-bold text-green-600" data-testid="text-net-proceeds">{formatCurrency(b.netCashProceeds)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key Ratios</h4>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Proceeds as % of Sale</span>
                <span className="num font-medium">{masterInputs.salePrice > 0 ? ((b.netCashProceeds / masterInputs.salePrice) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Total Costs & Taxes</span>
                <span className="num font-medium text-red-600">{formatCurrency(masterInputs.salePrice - b.netCashProceeds)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Return on Basis</span>
                <span className="num font-medium text-green-600">{b.adjustedBasis > 0 ? ((b.netCashProceeds / b.adjustedBasis - 1) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>

            {(() => {
              const equityInvested = masterInputs.costBasis - masterInputs.currentDebtBalance + masterInputs.capitalImprovements;
              const proceedsPercent = equityInvested > 0 ? (b.netCashProceeds / equityInvested) * 100 : 0;
              const annualizedROE = equityInvested > 0 && masterInputs.holdingPeriod > 0
                ? (Math.pow(b.netCashProceeds / equityInvested, 1 / masterInputs.holdingPeriod) - 1) * 100
                : 0;
              const friction = b.brokerCost + b.closingCosts + b.totalTax;
              const frictionPercent = masterInputs.salePrice > 0 ? (friction / masterInputs.salePrice) * 100 : 0;
              return (
                <div className="border-t pt-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Return on Equity</h4>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Equity Invested</span>
                    <span className="num font-medium">{formatCurrency(equityInvested)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Net Proceeds as % of Equity</span>
                    <span className="num font-medium text-green-600">{proceedsPercent.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Annualized ROE</span>
                    <span className={`num font-medium ${annualizedROE >= 0 ? 'text-green-600' : 'text-red-600'}`}>{isFinite(annualizedROE) ? annualizedROE.toFixed(1) : '—'}%</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Total Transaction Friction</span>
                    <span className="num font-medium text-red-600">{formatCurrency(friction)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Friction as % of Sale Price</span>
                    <span className="num font-medium text-red-600">{frictionPercent.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Exchange1031Panel() {
  const { masterInputs } = useExitStrategiesStore();
  const baseline = getCashSaleBaseline(masterInputs);
  const [replacementValue, setReplacementValue] = useState<string>("6000000");
  const [bootReceived, setBootReceived] = useState<string>("0");
  const [exchangeCosts, setExchangeCosts] = useState<string>("25000");

  const relinquishedValue = masterInputs.salePrice;
  const gain = baseline.capitalGain;
  const boot = parseFloat(bootReceived) || 0;
  const replacement = parseFloat(replacementValue) || 0;
  const exchCosts = parseFloat(exchangeCosts) || 0;
  const deferredGain = Math.max(0, gain - boot);
  const bootTax = boot * ((masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100);
  const taxSaved = baseline.totalTax - bootTax;
  const newBasis = replacement - deferredGain;
  const equityRequired = replacement - (baseline.netSaleProceeds - masterInputs.currentDebtBalance);
  const netBenefit = taxSaved - exchCosts;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-blue-500" />
              1031 Exchange Planner
            </CardTitle>
            <CardDescription>Like-kind exchange with tax deferral analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 bg-muted/30 rounded-lg p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Relinquished Property</h4>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Sale Price</span>
                <span className="num font-medium">{formatCurrency(relinquishedValue)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Adjusted Basis</span>
                <span className="num font-medium">{formatCurrency(baseline.adjustedBasis)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Realized Gain</span>
                <span className="num font-medium text-green-600">{formatCurrency(gain)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Replacement Property Value</Label>
                <CurrencyInput value={replacementValue} onChange={setReplacementValue} />
              </div>
              <div>
                <Label className="text-xs">Boot Received</Label>
                <CurrencyInput value={bootReceived} onChange={setBootReceived} />
              </div>
              <div>
                <Label className="text-xs">Exchange Costs (QI fees, etc.)</Label>
                <CurrencyInput value={exchangeCosts} onChange={setExchangeCosts} />
              </div>
            </div>

            <CashSaleBaselineCard baseline={baseline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exchange Analysis</CardTitle>
            <CardDescription>Tax deferral and replacement property details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax Deferral</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Total Gain</span>
                <span className="num font-medium">{formatCurrency(gain)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Deferred Gain</span>
                <span className="num font-medium text-green-600">{formatCurrency(deferredGain)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Recognized Gain (Boot)</span>
                <span className="num font-medium text-red-600">{formatCurrency(boot)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Boot Tax Due</span>
                <span className="num font-medium text-red-600">{formatCurrency(bootTax)}</span>
              </div>
              <div className="flex justify-between py-2.5 bg-green-50 rounded-lg px-3">
                <span className="font-semibold">Tax Savings vs Cash Sale</span>
                <span className="num font-bold text-green-600">{formatCurrency(taxSaved)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Replacement Property</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Replacement Value</span>
                <span className="num font-medium">{formatCurrency(replacement)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">New Tax Basis</span>
                <span className="num font-medium">{formatCurrency(newBasis)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Additional Equity Needed</span>
                <span className="num font-medium">{formatCurrency(Math.max(0, equityRequired))}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Exchange Costs</span>
                <span className="num font-medium text-red-600">-{formatCurrency(exchCosts)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Net Benefit</h4>
              <div className="flex justify-between py-2.5 bg-blue-50 rounded-lg px-3">
                <span className="font-semibold">Net Benefit (Savings - Costs)</span>
                <span className={`num font-bold ${netBenefit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(netBenefit)}</span>
              </div>
            </div>

            {(() => {
              const saleDate = masterInputs.acquisitionDate 
                ? new Date(new Date(masterInputs.acquisitionDate).getTime() + masterInputs.holdingPeriod * 365.25 * 24 * 60 * 60 * 1000)
                : new Date();
              const saleDateStr = saleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const idDeadline = new Date(saleDate);
              idDeadline.setDate(idDeadline.getDate() + 45);
              const closingDeadline = new Date(saleDate);
              closingDeadline.setDate(closingDeadline.getDate() + 180);
              const taxReturnYear = saleDate.getFullYear() + 1;
              const taxReturnDeadline = new Date(taxReturnYear, 3, 15);
              return (
                <div className="border-t pt-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline Calculator</h4>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Assumed Sale Date</span>
                    <span className="num font-medium">{saleDateStr}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">ID Deadline (Day 45)</span>
                    <span className="num font-medium text-amber-600">{idDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Closing Deadline (Day 180)</span>
                    <span className="num font-medium text-amber-600">{closingDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Tax Return Deadline</span>
                    <span className="num font-medium">{taxReturnDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              );
            })()}

            <div className="border-t pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identification Rules</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">3-Property Rule</span>
                <span className="text-sm font-medium">Identify up to 3 properties regardless of value</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">200% Rule</span>
                <span className="text-sm font-medium">Any number if combined FMV ≤ {formatCurrency(relinquishedValue * 2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">95% Rule</span>
                <span className="text-sm font-medium">Acquire ≥ 95% of identified properties' value</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debt Replacement</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Relinquished Debt</span>
                <span className="num font-medium">{formatCurrency(masterInputs.currentDebtBalance)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Required Replacement Debt</span>
                <span className="num font-medium">≥ {formatCurrency(masterInputs.currentDebtBalance)}</span>
              </div>
              {replacement < relinquishedValue && (
                <div className="bg-amber-50 rounded-lg px-3 py-2">
                  <span className="text-amber-700 text-sm font-medium">⚠ Mortgage Boot Risk: Replacement value below relinquished value creates taxable boot</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Depreciation Reset</span>
                <span className="num font-medium">New basis: {formatCurrency(newBasis)} over 27.5 years</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Annual Depreciation Deduction</span>
                <span className="num font-medium text-green-600">{formatCurrency(newBasis * 0.8 / 27.5)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DSTAnalysisPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const baseline = getCashSaleBaseline(masterInputs);
  const [distributionRate, setDistributionRate] = useState<string>("5.5");
  const [appreciationRate, setAppreciationRate] = useState<string>("3");
  const [upfrontFee, setUpfrontFee] = useState<string>("6");
  const [dispositionFee, setDispositionFee] = useState<string>("3");

  const investmentAmount = masterInputs.salePrice - masterInputs.currentDebtBalance - masterInputs.closingCosts;
  const feeAmount = investmentAmount * (parseFloat(upfrontFee) / 100 || 0);
  const netInvested = investmentAmount - feeAmount;
  const annualDistribution = netInvested * (parseFloat(distributionRate) / 100 || 0);
  const totalDistributions = annualDistribution * masterInputs.holdingPeriod;
  const cashOnCash = investmentAmount > 0 ? (annualDistribution / investmentAmount) * 100 : 0;
  const exitValue = netInvested * Math.pow(1 + (parseFloat(appreciationRate) / 100 || 0), masterInputs.holdingPeriod);
  const exitFee = exitValue * (parseFloat(dispositionFee) / 100 || 0);
  const netExitProceeds = exitValue - exitFee;
  const totalReturn = totalDistributions + netExitProceeds;
  const totalProfit = totalReturn - investmentAmount;
  const deferredTax = baseline.totalTax;
  const depreciationBenefit = investmentAmount * 0.8 / 27.5 * masterInputs.holdingPeriod;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-purple-500" />
              DST Analysis
            </CardTitle>
            <CardDescription>Delaware Statutory Trust investment via 1031 exchange</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">⚠ Accredited Investors Only:</span> DST investments require accredited investor status. Minimum investment typically $100,000–$250,000. These are illiquid securities with 7–10 year hold periods.
              </p>
            </div>

            <div className="space-y-2 bg-muted/30 rounded-lg p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Investment Basis</h4>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Sale Price</span>
                <span className="num font-medium">{formatCurrency(masterInputs.salePrice)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Less: Debt Payoff</span>
                <span className="num font-medium text-red-600">-{formatCurrency(masterInputs.currentDebtBalance)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Less: Closing Costs</span>
                <span className="num font-medium text-red-600">-{formatCurrency(masterInputs.closingCosts)}</span>
              </div>
              <div className="flex justify-between py-1.5 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Net Equity to Invest</span>
                <span className="num font-semibold">{formatCurrency(investmentAmount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Distribution Rate (%)</Label>
                <PercentInput value={distributionRate} onChange={setDistributionRate} />
              </div>
              <div>
                <Label className="text-xs">Appreciation Rate (%)</Label>
                <PercentInput value={appreciationRate} onChange={setAppreciationRate} />
              </div>
              <div>
                <Label className="text-xs">Upfront Fee (%)</Label>
                <PercentInput value={upfrontFee} onChange={setUpfrontFee} />
              </div>
              <div>
                <Label className="text-xs">Disposition Fee (%)</Label>
                <PercentInput value={dispositionFee} onChange={setDispositionFee} />
              </div>
            </div>

            {(() => {
              const acquisitionFee = investmentAmount * 0.02;
              const assetMgmtFee = investmentAmount * 0.015 * masterInputs.holdingPeriod;
              const dispFee = exitFee;
              const totalFees = acquisitionFee + assetMgmtFee + dispFee;
              const feeDragPercent = investmentAmount > 0 ? (totalFees / investmentAmount) * 100 : 0;
              return (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sponsor Fee Breakdown</h4>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Acquisition Fee (typically 1-3%)</span>
                    <span className="num font-medium text-red-600">{formatCurrency(acquisitionFee)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Asset Management Fee (1-2% annually)</span>
                    <span className="num font-medium text-red-600">{formatCurrency(assetMgmtFee)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Disposition Fee</span>
                    <span className="num font-medium text-red-600">{formatCurrency(dispFee)}</span>
                  </div>
                  <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                    <span className="font-semibold text-sm">Total Fee Drag</span>
                    <span className="num font-semibold text-red-600">{formatCurrency(totalFees)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground text-sm">Fee Drag as % of Investment</span>
                    <span className="num font-medium text-red-600">{feeDragPercent.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })()}

            <CashSaleBaselineCard baseline={baseline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DST Returns Analysis</CardTitle>
            <CardDescription>Cash flow, exit projections, and tax benefits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash Flow</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Gross Investment</span>
                <span className="num font-medium">{formatCurrency(investmentAmount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Upfront Fees ({upfrontFee}%)</span>
                <span className="num font-medium text-red-600">-{formatCurrency(feeAmount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Net Working Capital</span>
                <span className="num font-medium">{formatCurrency(netInvested)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Annual Distribution</span>
                <span className="num font-medium text-green-600">{formatCurrency(annualDistribution)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Cash-on-Cash Yield</span>
                <span className="num font-medium">{cashOnCash.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Total Distributions ({masterInputs.holdingPeriod} yrs)</span>
                <span className="num font-medium text-green-600">{formatCurrency(totalDistributions)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax Character of Distributions</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Return of Capital (est. 40-60%)</span>
                <span className="num font-medium text-green-600">{formatCurrency(annualDistribution * 0.5)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Ordinary Income (est. 30-40%)</span>
                <span className="num font-medium">{formatCurrency(annualDistribution * 0.35)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Capital Gain (est. 10-20%)</span>
                <span className="num font-medium">{formatCurrency(annualDistribution * 0.15)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Annual Depreciation Shelter</span>
                <span className="num font-medium text-green-600">{formatCurrency(masterInputs.holdingPeriod > 0 ? depreciationBenefit / masterInputs.holdingPeriod : 0)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exit Projection</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Projected Exit Value</span>
                <span className="num font-medium">{formatCurrency(exitValue)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Disposition Fee ({dispositionFee}%)</span>
                <span className="num font-medium text-red-600">-{formatCurrency(exitFee)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Net Exit Proceeds</span>
                <span className="num font-medium">{formatCurrency(netExitProceeds)}</span>
              </div>
              <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Total Return</span>
                <span className="num font-semibold text-green-600">{formatCurrency(totalReturn)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Total Profit</span>
                <span className={`num font-medium ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax Benefits</h4>
              <div className="flex justify-between py-2.5 bg-green-50 rounded-lg px-3">
                <span className="font-semibold">Tax Deferred via 1031</span>
                <span className="num font-bold text-green-600">{formatCurrency(deferredTax)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Est. Depreciation Benefit ({masterInputs.holdingPeriod} yrs)</span>
                <span className="num font-medium text-green-600">{formatCurrency(depreciationBenefit)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exit Strategy Comparison</CardTitle>
          <CardDescription>Side-by-side comparison of cash sale, direct 1031, and DST</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-semibold">Metric</th>
                  <th className="p-2 text-center font-semibold">Cash Sale</th>
                  <th className="p-2 text-center font-semibold">Direct 1031</th>
                  <th className="p-2 text-center font-semibold">DST</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground">Tax Due at Close</td>
                  <td className="p-2 text-center num text-red-600">{formatCurrency(baseline.totalTax)}</td>
                  <td className="p-2 text-center text-green-600">$0 (deferred)</td>
                  <td className="p-2 text-center text-green-600">$0 (deferred)</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground">Annual Income</td>
                  <td className="p-2 text-center">$0</td>
                  <td className="p-2 text-center">Varies</td>
                  <td className="p-2 text-center num text-green-600">{formatCurrency(annualDistribution)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground">Liquidity</td>
                  <td className="p-2 text-center text-green-600">Immediate</td>
                  <td className="p-2 text-center text-amber-600">Tied to property</td>
                  <td className="p-2 text-center text-red-600">7–10 year hold</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground">Management Required</td>
                  <td className="p-2 text-center">None</td>
                  <td className="p-2 text-center">Active or hire PM</td>
                  <td className="p-2 text-center text-green-600">Passive (sponsor managed)</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground">1031 Eligible at Exit</td>
                  <td className="p-2 text-center text-muted-foreground">N/A</td>
                  <td className="p-2 text-center text-green-600">Yes</td>
                  <td className="p-2 text-center text-green-600">Yes (via UPREIT)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SellerFinancingPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const baseline = getCashSaleBaseline(masterInputs);
  const [downPaymentPercent, setDownPaymentPercent] = useState<string>("20");
  const [interestRate, setInterestRate] = useState<string>("6");
  const [term, setTerm] = useState<string>("10");
  const [discountRate, setDiscountRate] = useState<string>("8");
  const [hasBalloon, setHasBalloon] = useState(false);
  const [balloonYear, setBalloonYear] = useState<string>("5");

  const salePrice = masterInputs.salePrice;
  const downPayment = salePrice * (parseFloat(downPaymentPercent) / 100 || 0);
  const loanAmount = salePrice - downPayment;
  const annualRate = parseFloat(interestRate) / 100 || 0;
  const monthlyRate = annualRate / 12;
  const termYears = parseFloat(term) || 0;
  const months = termYears * 12;
  const balloonYr = Math.min(parseFloat(balloonYear) || 5, termYears);

  let monthlyPayment: number;
  let totalPayments: number;
  let totalInterest: number;
  let totalCashReceived: number;

  if (hasBalloon && balloonYr > 0 && balloonYr < termYears) {
    const interestOnlyMonthly = loanAmount * monthlyRate;
    const balloonMonths = balloonYr * 12;
    totalPayments = interestOnlyMonthly * balloonMonths + loanAmount;
    totalInterest = interestOnlyMonthly * balloonMonths;
    monthlyPayment = interestOnlyMonthly;
    totalCashReceived = downPayment + totalPayments;
  } else {
    monthlyPayment = monthlyRate > 0 && months > 0 ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1) : 0;
    totalPayments = monthlyPayment * months;
    totalInterest = totalPayments - loanAmount;
    totalCashReceived = downPayment + totalPayments;
  }

  const gain = salePrice - masterInputs.costBasis;
  const grossProfitRatio = salePrice > 0 ? gain / salePrice : 0;
  const year1TaxableGain = downPayment * grossProfitRatio;
  const annualPrincipal = months > 0 ? loanAmount / (termYears || 1) : 0;
  const annualTaxableGain = annualPrincipal * grossProfitRatio;
  const combinedRate = (masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100;
  const year1Tax = year1TaxableGain * combinedRate;
  const annualTax = annualTaxableGain * combinedRate;
  const totalInstallmentTax = year1Tax + annualTax * termYears;
  const taxDeferral = baseline.totalTax - year1Tax;

  const disc = parseFloat(discountRate) / 100 || 0;
  let npv = downPayment;
  if (hasBalloon && balloonYr > 0 && balloonYr < termYears) {
    for (let y = 1; y <= balloonYr; y++) {
      npv += (monthlyPayment * 12) / Math.pow(1 + disc, y);
    }
    npv += loanAmount / Math.pow(1 + disc, balloonYr);
  } else {
    for (let y = 1; y <= termYears; y++) {
      npv += (monthlyPayment * 12) / Math.pow(1 + disc, y);
    }
  }

  const amortSchedule: Array<{ year: number; principal: number; interest: number; balance: number }> = [];
  if (!hasBalloon || balloonYr >= termYears) {
    let balance = loanAmount;
    const annualPayment = monthlyPayment * 12;
    for (let y = 1; y <= Math.min(5, termYears); y++) {
      const yearInterest = balance * annualRate;
      const yearPrincipal = annualPayment - yearInterest;
      balance = Math.max(0, balance - yearPrincipal);
      amortSchedule.push({ year: y, principal: yearPrincipal, interest: yearInterest, balance });
    }
  } else {
    let balance = loanAmount;
    for (let y = 1; y <= Math.min(5, balloonYr); y++) {
      const yearInterest = balance * annualRate;
      amortSchedule.push({ year: y, principal: 0, interest: yearInterest, balance });
    }
    if (balloonYr <= 5) {
      amortSchedule.push({ year: balloonYr, principal: loanAmount, interest: 0, balance: 0 });
    }
  }

  const ltv = salePrice > 0 ? (loanAmount / salePrice) * 100 : 0;
  const prepaymentPenalty = loanAmount * 0.02;
  const sellerFinTotalTax = totalInstallmentTax + totalInterest * combinedRate;
  const npvAdvantage = npv - baseline.netCashProceeds;
  const sellerFinWins = npvAdvantage >= 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-amber-500" />
              Seller Financing
            </CardTitle>
            <CardDescription>Installment sale with tax deferral</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 bg-muted/30 rounded-lg p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Deal Structure</h4>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Sale Price</span>
                <span className="num font-medium">{formatCurrency(salePrice)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Cost Basis</span>
                <span className="num font-medium">{formatCurrency(masterInputs.costBasis)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Total Gain</span>
                <span className="num font-medium text-green-600">{formatCurrency(gain)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Gross Profit Ratio</span>
                <span className="num font-medium">{(grossProfitRatio * 100).toFixed(1)}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Down Payment %</Label>
                <PercentInput value={downPaymentPercent} onChange={setDownPaymentPercent} />
              </div>
              <div>
                <Label className="text-xs">Interest Rate</Label>
                <PercentInput value={interestRate} onChange={setInterestRate} />
              </div>
              <div>
                <Label className="text-xs">Term (Years)</Label>
                <Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Discount Rate (NPV)</Label>
                <PercentInput value={discountRate} onChange={setDiscountRate} />
              </div>
              <div className="col-span-2 flex items-center gap-3 py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBalloon}
                    onChange={(e) => setHasBalloon(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">Balloon Payment</span>
                </label>
                {hasBalloon && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Balloon Year</Label>
                    <Input
                      type="number"
                      value={balloonYear}
                      onChange={(e) => setBalloonYear(e.target.value)}
                      className="w-20"
                    />
                  </div>
                )}
              </div>
            </div>

            <CashSaleBaselineCard baseline={baseline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financing Analysis</CardTitle>
            <CardDescription>Payment structure, tax treatment, and present value</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loan Structure</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Down Payment ({downPaymentPercent}%)</span>
                <span className="num font-medium">{formatCurrency(downPayment)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Note Amount</span>
                <span className="num font-medium">{formatCurrency(loanAmount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Monthly Payment{hasBalloon ? " (Interest Only)" : ""}</span>
                <span className="num font-medium text-green-600">{formatCurrency(monthlyPayment)}</span>
              </div>
              {hasBalloon && (
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Balloon Due (Year {balloonYear})</span>
                  <span className="num font-medium text-amber-600">{formatCurrency(loanAmount)}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Total Interest Income</span>
                <span className="num font-medium text-green-600">{formatCurrency(totalInterest)}</span>
              </div>
              <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Total Cash Received</span>
                <span className="num font-semibold text-green-600">{formatCurrency(totalCashReceived)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amortization Summary</h4>
              {amortSchedule.map((row) => (
                <div key={row.year} className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Year {row.year}: Principal / Interest</span>
                  <span className="num font-medium">{formatCurrency(row.principal)} / {formatCurrency(row.interest)}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Installment Tax Treatment</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Year 1 Taxable Gain</span>
                <span className="num font-medium text-amber-600">{formatCurrency(year1TaxableGain)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Year 1 Tax Due</span>
                <span className="num font-medium text-red-600">{formatCurrency(year1Tax)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Annual Taxable Gain (Yrs 2+)</span>
                <span className="num font-medium text-amber-600">{formatCurrency(annualTaxableGain)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Total Tax Over Life</span>
                <span className="num font-medium text-red-600">{formatCurrency(totalInstallmentTax)}</span>
              </div>
              <div className="flex justify-between py-2.5 bg-green-50 rounded-lg px-3">
                <span className="font-semibold">Year 1 Tax Deferral</span>
                <span className="num font-bold text-green-600">{formatCurrency(taxDeferral)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Present Value Analysis</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">NPV at {discountRate}% Discount Rate</span>
                <span className="num font-medium">{formatCurrency(npv)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">NPV vs Cash Sale Proceeds</span>
                <span className={`num font-medium ${npv >= baseline.netCashProceeds ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(npv - baseline.netCashProceeds)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Premium Over Sale Price</span>
                <span className="num font-medium text-green-600">{formatCurrency(totalCashReceived - salePrice)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk Assessment</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Loan-to-Value (LTV)</span>
                <span className="flex items-center gap-2">
                  <span className="num font-medium">{ltv.toFixed(1)}%</span>
                  <Badge className={ltv < 70 ? 'bg-green-100 text-green-700' : ltv <= 80 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>
                    {ltv < 70 ? 'Low Risk' : ltv <= 80 ? 'Moderate' : 'High Risk'}
                  </Badge>
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Default Risk</span>
                <span className="text-sm">Seller retains 1st lien position on property</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Prepayment Penalty (est.)</span>
                <span className="num font-medium">{formatCurrency(prepaymentPenalty)}</span>
              </div>
              <p className="text-xs text-muted-foreground italic">Interest income taxed as ordinary income at marginal rate (up to 37% federal)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total Tax Comparison</CardTitle>
          <CardDescription>Cash sale vs seller financing tax analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Cash Sale: Total Tax</span>
              <span className="num font-medium text-red-600">{formatCurrency(baseline.totalTax)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Cash Sale: Year 1 Tax</span>
              <span className="num font-medium text-red-600">{formatCurrency(baseline.totalTax)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Seller Financing: Total Tax (incl. interest income)</span>
              <span className="num font-medium text-red-600">{formatCurrency(sellerFinTotalTax)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Seller Financing: Year 1 Tax</span>
              <span className="num font-medium text-amber-600">{formatCurrency(year1Tax)}</span>
            </div>
            <div className="flex justify-between py-2.5 bg-green-50 rounded-lg px-3">
              <span className="font-semibold">Year 1 Tax Deferral</span>
              <span className="num font-bold text-green-600">{formatCurrency(taxDeferral)}</span>
            </div>
            <div className="flex justify-between py-2.5 rounded-lg px-3" style={{ backgroundColor: sellerFinWins ? 'rgb(240 253 244)' : 'rgb(254 242 242)' }}>
              <span className="font-semibold">NPV Advantage/(Disadvantage)</span>
              <span className={`num font-bold ${sellerFinWins ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(npvAdvantage)}</span>
            </div>
            <p className="text-xs text-muted-foreground italic">
              {sellerFinWins ? "Seller financing produces higher NPV — favorable for the seller when accounting for time value of money." : "Cash sale produces higher NPV — seller financing may not compensate for the time value and risk."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EarnoutPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const baseline = getCashSaleBaseline(masterInputs);
  const [basePrice, setBasePrice] = useState<string>("4000000");
  const [earnoutMax, setEarnoutMax] = useState<string>("1000000");
  const [probability, setProbability] = useState<string>("60");
  const [earnoutYears, setEarnoutYears] = useState<string>("3");
  const [discountRate, setDiscountRate] = useState<string>("10");
  const [revenueTarget, setRevenueTarget] = useState<string>("2000000");
  const [ebitdaThreshold, setEbitdaThreshold] = useState<string>("500000");
  const [escrowPercent, setEscrowPercent] = useState<string>("10");

  const base = parseFloat(basePrice) || 0;
  const maxEarnout = parseFloat(earnoutMax) || 0;
  const prob = parseFloat(probability) / 100 || 0;
  const years = parseFloat(earnoutYears) || 1;
  const disc = parseFloat(discountRate) / 100 || 0;

  const expectedEarnout = maxEarnout * prob;
  const totalExpected = base + expectedEarnout;
  const maxValue = base + maxEarnout;
  const escrowAmount = maxEarnout * (parseFloat(escrowPercent) / 100 || 0);

  const combinedRate = (masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100;
  const baseTax = base > masterInputs.costBasis ? (base - masterInputs.costBasis) * combinedRate : 0;
  const earnoutTax = expectedEarnout * combinedRate;
  const totalTax = baseTax + earnoutTax;
  const netBaseProceeds = base - baseTax - masterInputs.closingCosts - (base * masterInputs.brokerFeePercent / 100) - masterInputs.currentDebtBalance;
  const netExpectedProceeds = netBaseProceeds + expectedEarnout - earnoutTax;

  const pvEarnout = expectedEarnout / Math.pow(1 + disc, years);
  const riskAdjustedTotal = base + pvEarnout;
  const guaranteedDiscount = masterInputs.salePrice - base;
  const riskPremium = maxEarnout > 0 ? ((maxEarnout - expectedEarnout) / maxEarnout * 100) : 0;

  const annualEarnoutPayment = years > 0 ? expectedEarnout / years : 0;
  const earnoutSchedule: Array<{ year: number; payment: number; pv: number }> = [];
  let totalPV = 0;
  for (let y = 1; y <= years; y++) {
    const pv = annualEarnoutPayment / Math.pow(1 + disc, y);
    totalPV += pv;
    earnoutSchedule.push({ year: y, payment: annualEarnoutPayment, pv });
  }

  const ordinaryComponent = earnoutTax * 0.4;
  const capitalGainComponent = earnoutTax * 0.6;
  const workingCapitalAdj = base * 0.03;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-500" />
              Earnout Modeling
            </CardTitle>
            <CardDescription>Contingent payment with probability-weighted analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Base Price (Guaranteed)</Label>
                <CurrencyInput value={basePrice} onChange={setBasePrice} />
              </div>
              <div>
                <Label className="text-xs">Maximum Earnout</Label>
                <CurrencyInput value={earnoutMax} onChange={setEarnoutMax} />
              </div>
              <div>
                <Label className="text-xs">Achievement Probability</Label>
                <PercentInput value={probability} onChange={setProbability} />
              </div>
              <div>
                <Label className="text-xs">Earnout Period (Years)</Label>
                <Input type="number" value={earnoutYears} onChange={(e) => setEarnoutYears(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Discount Rate (%)</Label>
                <PercentInput value={discountRate} onChange={setDiscountRate} />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Milestone Structure</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Revenue Target</Label>
                  <CurrencyInput value={revenueTarget} onChange={setRevenueTarget} />
                </div>
                <div>
                  <Label className="text-xs">EBITDA Threshold</Label>
                  <CurrencyInput value={ebitdaThreshold} onChange={setEbitdaThreshold} />
                </div>
                <div>
                  <Label className="text-xs">Escrow Holdback %</Label>
                  <PercentInput value={escrowPercent} onChange={setEscrowPercent} />
                </div>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Escrow Amount</span>
                <span className="num font-medium">{formatCurrency(escrowAmount)}</span>
              </div>
              <p className="text-xs text-muted-foreground italic">Milestone-based payout: earnout payments contingent on achieving revenue and EBITDA targets during the measurement period.</p>
            </div>

            <CashSaleBaselineCard baseline={baseline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earnout Analysis</CardTitle>
            <CardDescription>Value range, tax impact, and risk-adjusted returns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Value Range</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Minimum (Base Only)</span>
                <span className="num font-medium">{formatCurrency(base)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Expected ({(prob * 100).toFixed(0)}% probability)</span>
                <span className="num font-medium text-green-600">{formatCurrency(totalExpected)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Maximum (100% achievement)</span>
                <span className="num font-medium">{formatCurrency(maxValue)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Discount from Full Sale Price</span>
                <span className="num font-medium text-amber-600">{formatCurrency(guaranteedDiscount)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year-by-Year Earnout Schedule</h4>
              {earnoutSchedule.map((row) => (
                <div key={row.year} className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Year {row.year}: Payment / PV</span>
                  <span className="num font-medium">{formatCurrency(row.payment)} / {formatCurrency(row.pv)}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Total PV of Earnout</span>
                <span className="num font-semibold">{formatCurrency(totalPV)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax Analysis</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Tax on Base Price</span>
                <span className="num font-medium text-red-600">{formatCurrency(baseTax)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Tax on Expected Earnout</span>
                <span className="num font-medium text-red-600">{formatCurrency(earnoutTax)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Total Expected Tax</span>
                <span className="num font-medium text-red-600">{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Net Expected Proceeds</span>
                <span className="num font-semibold text-green-600">{formatCurrency(netExpectedProceeds)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax Timing</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Treatment</span>
                <span className="text-sm">Closed Transaction (taxed when received)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Open Transaction Alternative</span>
                <span className="text-sm italic">Defer until basis recovered (consult CPA)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Ordinary Income Component (est. 40%)</span>
                <span className="num font-medium text-red-600">{formatCurrency(ordinaryComponent)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Capital Gain Component (est. 60%)</span>
                <span className="num font-medium text-amber-600">{formatCurrency(capitalGainComponent)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk Analysis</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">PV of Expected Earnout ({discountRate}% disc.)</span>
                <span className="num font-medium">{formatCurrency(pvEarnout)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Risk-Adjusted Total Value</span>
                <span className="num font-medium">{formatCurrency(riskAdjustedTotal)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Risk Premium</span>
                <span className="num font-medium">{riskPremium.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between py-2.5 bg-indigo-50 rounded-lg px-3">
                <span className="font-semibold">vs Cash Sale Net Proceeds</span>
                <span className={`num font-bold ${netExpectedProceeds >= baseline.netCashProceeds ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(netExpectedProceeds - baseline.netCashProceeds)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seller Risk Scorecard</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Buyer Default Risk</span>
                <Badge className="bg-amber-100 text-amber-700">Medium</Badge>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Metric Manipulation Risk</span>
                <Badge className="bg-orange-100 text-orange-700">Medium-High</Badge>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Working Capital Adjustment</span>
                <span className="num font-medium">{formatCurrency(workingCapitalAdj)}</span>
              </div>
              <p className="text-xs text-muted-foreground italic">Consider escrow, holdback, and audit rights to mitigate earnout risks</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WaterfallPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const [totalDistribution, setTotalDistribution] = useState<string>("10000000");
  const [lpCapital, setLpCapital] = useState<string>("8000000");
  const [gpCapital, setGpCapital] = useState<string>("2000000");
  const [preferredReturn, setPreferredReturn] = useState<string>("8");
  const [carriedInterest, setCarriedInterest] = useState<string>("20");
  const [managementFee, setManagementFee] = useState<string>("1.5");

  const totalDistRaw = parseFloat(totalDistribution) || 0;
  const lpCap = parseFloat(lpCapital) || 0;
  const gpCap = parseFloat(gpCapital) || 0;
  const totalCapital = lpCap + gpCap;
  const prefRate = parseFloat(preferredReturn) / 100 || 0;
  const carryRate = parseFloat(carriedInterest) / 100 || 0;
  const mgmtFeeAmount = totalCapital * (parseFloat(managementFee) / 100 || 0) * masterInputs.holdingPeriod;
  const totalDist = totalDistRaw - mgmtFeeAmount;

  const lpPref = lpCap * prefRate * masterInputs.holdingPeriod;
  const gpPref = gpCap * prefRate * masterInputs.holdingPeriod;
  const totalPref = lpPref + gpPref;
  const afterPrefAndReturn = totalDist - totalPref - totalCapital;

  const gpCatchup = gpCap > 0 ? Math.min(Math.max(0, afterPrefAndReturn), lpPref * (carryRate / (1 - carryRate))) : 0;
  const afterCatchup = Math.max(0, afterPrefAndReturn - gpCatchup);

  const gpCarry = afterCatchup > 0 ? afterCatchup * carryRate : 0;
  const lpProfit = afterCatchup > 0 ? afterCatchup - gpCarry : 0;
  const lpTotal = lpCap + lpPref + lpProfit;
  const gpTotal = gpCap + gpPref + gpCatchup + gpCarry;
  const lpMOIC = lpCap > 0 ? lpTotal / lpCap : 0;
  const gpMOIC = gpCap > 0 ? gpTotal / gpCap : 0;
  const dealMOIC = totalCapital > 0 ? totalDist / totalCapital : 0;
  const lpIRR = lpCap > 0 && masterInputs.holdingPeriod > 0 ? (Math.pow(lpTotal / lpCap, 1 / masterInputs.holdingPeriod) - 1) * 100 : 0;

  const combinedRate = (masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100;
  const lpLTCG = lpTotal * 0.60;
  const lpDepRecapture = lpTotal * 0.15;
  const lpOrdinary = lpTotal * 0.25;
  const gpLTCG = gpTotal * 0.60;
  const gpDepRecapture = gpTotal * 0.15;
  const gpOrdinary = gpTotal * 0.25;
  const blendedLPTaxRate = (0.60 * 0.20) + (0.15 * 0.25) + (0.25 * combinedRate);
  const blendedGPTaxRate = (0.60 * 0.20) + (0.15 * 0.25) + (0.25 * combinedRate);
  const lpAfterTax = lpTotal * (1 - blendedLPTaxRate);
  const gpAfterTax = gpTotal * (1 - blendedGPTaxRate);
  const gpPromotePercent = (gpCatchup + gpCarry) / (gpCap > 0 ? gpCap : 1) * 100;
  const prefHurdle = 1 + prefRate * masterInputs.holdingPeriod;
  const hasClawback = dealMOIC < prefHurdle;
  const clawbackAmount = hasClawback ? gpCatchup + gpCarry : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-500" />
              Waterfall Analysis
            </CardTitle>
            <CardDescription>GP/LP fund distribution with preferred return and carry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Total Distribution</Label>
                <CurrencyInput value={totalDistribution} onChange={setTotalDistribution} />
              </div>
              <div>
                <Label className="text-xs">LP Capital</Label>
                <CurrencyInput value={lpCapital} onChange={setLpCapital} />
              </div>
              <div>
                <Label className="text-xs">GP Co-Invest</Label>
                <CurrencyInput value={gpCapital} onChange={setGpCapital} />
              </div>
              <div>
                <Label className="text-xs">Preferred Return</Label>
                <PercentInput value={preferredReturn} onChange={setPreferredReturn} />
              </div>
              <div>
                <Label className="text-xs">Carried Interest</Label>
                <PercentInput value={carriedInterest} onChange={setCarriedInterest} />
              </div>
              <div>
                <Label className="text-xs">Management Fee (%)</Label>
                <PercentInput value={managementFee} onChange={setManagementFee} />
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Deal Context</h4>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Property Sale Price</span>
                <span className="num font-medium">{formatCurrency(masterInputs.salePrice)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Hold Period</span>
                <span className="num font-medium">{masterInputs.holdingPeriod} years</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Total Equity</span>
                <span className="num font-medium">{formatCurrency(totalCapital)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Management Fee ({managementFee}% x {masterInputs.holdingPeriod} yrs)</span>
                <span className="num font-medium text-red-600">-{formatCurrency(mgmtFeeAmount)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Net Distributable</span>
                <span className="num font-medium">{formatCurrency(totalDist)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribution Waterfall</CardTitle>
            <CardDescription>Step-by-step allocation of proceeds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1: Preferred Return</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">LP Preferred ({preferredReturn}% x {masterInputs.holdingPeriod} yrs)</span>
                <span className="num font-medium">{formatCurrency(lpPref)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">GP Preferred ({preferredReturn}% x {masterInputs.holdingPeriod} yrs)</span>
                <span className="num font-medium">{formatCurrency(gpPref)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2: Return of Capital</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">LP Capital Return</span>
                <span className="num font-medium">{formatCurrency(lpCap)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">GP Capital Return</span>
                <span className="num font-medium">{formatCurrency(gpCap)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 2.5: GP Catchup</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">GP Catchup Amount</span>
                <span className="num font-medium">{formatCurrency(gpCatchup)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Catchup Remaining for Profit Split</span>
                <span className="num font-medium">{formatCurrency(afterCatchup)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 3: Profit Split</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Remaining Profit</span>
                <span className="num font-medium">{formatCurrency(Math.max(0, afterCatchup))}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">GP Carried Interest ({carriedInterest}%)</span>
                <span className="num font-medium">{formatCurrency(gpCarry)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">LP Profit Share ({100 - (parseFloat(carriedInterest) || 0)}%)</span>
                <span className="num font-medium text-green-600">{formatCurrency(lpProfit)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Returns Summary</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">LP Total Received</span>
                <span className="num font-semibold text-green-600">{formatCurrency(lpTotal)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">GP Total Received</span>
                <span className="num font-semibold">{formatCurrency(gpTotal)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">LP MOIC</span>
                <span className="num font-semibold">{lpMOIC.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">GP MOIC</span>
                <span className="num font-semibold">{gpMOIC.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Deal MOIC</span>
                <span className="num font-semibold">{dealMOIC.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between py-2.5 bg-cyan-50 rounded-lg px-3">
                <span className="font-semibold">LP Est. IRR</span>
                <span className="num font-bold text-cyan-600">{lpIRR.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tax Character Allocation</CardTitle>
          <CardDescription>Estimated tax treatment and after-tax returns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">LP Tax Character</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Long-Term Capital Gain (est. 60%)</span>
                <span className="num font-medium">{formatCurrency(lpLTCG)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Depreciation Recapture (est. 15%, taxed at 25%)</span>
                <span className="num font-medium">{formatCurrency(lpDepRecapture)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Ordinary Income (est. 25%)</span>
                <span className="num font-medium">{formatCurrency(lpOrdinary)}</span>
              </div>
              <div className="flex justify-between py-2.5 bg-green-50 rounded-lg px-3">
                <span className="font-semibold">LP After-Tax Return</span>
                <span className="num font-bold text-green-600">{formatCurrency(lpAfterTax)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GP Tax Character</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Long-Term Capital Gain (est. 60%)</span>
                <span className="num font-medium">{formatCurrency(gpLTCG)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Depreciation Recapture (est. 15%, taxed at 25%)</span>
                <span className="num font-medium">{formatCurrency(gpDepRecapture)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Ordinary Income (est. 25%)</span>
                <span className="num font-medium">{formatCurrency(gpOrdinary)}</span>
              </div>
              <div className="flex justify-between py-2.5 bg-cyan-50 rounded-lg px-3">
                <span className="font-semibold">GP After-Tax Return</span>
                <span className="num font-bold text-cyan-600">{formatCurrency(gpAfterTax)}</span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">GP Promote Economics</h4>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Promote as % of GP Capital</span>
              <span className="num font-semibold">{gpPromotePercent.toFixed(1)}%</span>
            </div>
            {hasClawback && (
              <div className="flex justify-between py-2.5 bg-red-50 rounded-lg px-3">
                <span className="font-semibold text-red-700">Clawback Exposure</span>
                <span className="num font-bold text-red-600">{formatCurrency(clawbackAmount)}</span>
              </div>
            )}
            {hasClawback && (
              <p className="text-xs text-red-600 italic">Deal MOIC ({dealMOIC.toFixed(2)}x) is below pref hurdle ({prefHurdle.toFixed(2)}x). GP must return carry if deal doesn't achieve pref.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IRRCalculatorPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const [initialInvestment, setInitialInvestment] = useState<string>("1000000");
  const [yearCount, setYearCount] = useState(5);
  const [cashFlows, setCashFlows] = useState<string[]>(Array(5).fill("100000"));
  const [exitValue, setExitValue] = useState<string>("1500000");
  const [targetReturn, setTargetReturn] = useState<string>("15");
  const [discountRate, setDiscountRate] = useState<string>("10");
  const [showLevered, setShowLevered] = useState(true);

  const handleYearCountChange = (newCount: number) => {
    const clamped = Math.max(1, Math.min(10, newCount));
    setCashFlows(prev => {
      const next = [...prev];
      const lastVal = prev[prev.length - 1] || "100000";
      while (next.length < clamped) next.push(lastVal);
      return next.slice(0, clamped);
    });
    setYearCount(clamped);
  };

  const updateCashFlow = (index: number, value: string) => {
    setCashFlows(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const invest = parseFloat(initialInvestment) || 0;
  const parsedCFs = cashFlows.map(cf => parseFloat(cf) || 0);
  const exit = parseFloat(exitValue) || 0;
  const target = parseFloat(targetReturn) || 0;
  const disc = parseFloat(discountRate) / 100 || 0;

  const debt = masterInputs.currentDebtBalance;
  const leveredInvest = Math.max(0, invest - debt);
  const activeInvest = showLevered ? leveredInvest : invest;

  const buildFlows = (inv: number) => {
    const flows = [-inv, ...parsedCFs.slice(0, -1), (parsedCFs[parsedCFs.length - 1] || 0) + exit];
    return flows;
  };

  const calculateIRR = (flows: number[]) => {
    let rate = 0.1;
    for (let i = 0; i < 100; i++) {
      let npvCalc = 0;
      let npvDerivative = 0;
      for (let t = 0; t < flows.length; t++) {
        npvCalc += flows[t] / Math.pow(1 + rate, t);
        npvDerivative -= t * flows[t] / Math.pow(1 + rate, t + 1);
      }
      if (Math.abs(npvCalc) < 0.01) break;
      if (npvDerivative !== 0) rate = rate - npvCalc / npvDerivative;
      else break;
    }
    return rate * 100;
  };

  const unleveredFlows = buildFlows(invest);
  const leveredFlows = buildFlows(leveredInvest);
  const activeFlows = showLevered ? leveredFlows : unleveredFlows;

  const irr = calculateIRR(activeFlows);
  const unleveredIRR = calculateIRR(unleveredFlows);
  const leveredIRR = calculateIRR(leveredFlows);

  const totalCashFlow = parsedCFs.reduce((a, b) => a + b, 0) + exit;
  const totalProfit = totalCashFlow - activeInvest;
  const multiple = activeInvest > 0 ? totalCashFlow / activeInvest : 0;

  const combinedRate = (masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100;
  const afterTaxFlows = [-activeInvest, ...parsedCFs.slice(0, -1).map(cf => cf * (1 - combinedRate * 0.3)), (parsedCFs[parsedCFs.length - 1] * (1 - combinedRate * 0.3)) + exit * (1 - combinedRate)];
  const afterTaxIRR = calculateIRR(afterTaxFlows);

  let npv = 0;
  for (let t = 0; t < activeFlows.length; t++) {
    npv += activeFlows[t] / Math.pow(1 + disc, t);
  }

  let cumulativeCF = -activeInvest;
  let paybackYear = 0;
  for (let y = 0; y < parsedCFs.length; y++) {
    cumulativeCF += parsedCFs[y];
    if (cumulativeCF >= 0 && paybackYear === 0) {
      paybackYear = y + 1;
    }
  }
  if (paybackYear === 0 && cumulativeCF + exit >= 0) paybackYear = parsedCFs.length;

  const meetsTarget = irr >= target;

  const capRateSensitivity = [5, 5.5, 6, 6.5, 7];
  const baseNOI = parsedCFs[parsedCFs.length - 1] || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-emerald-500" />
              IRR Calculator
            </CardTitle>
            <CardDescription>Multi-period return analysis with dynamic cash flows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 pb-2 border-b">
              <div className="flex-1">
                <Label className="text-xs">Hold Period (Years)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="range"
                    min={1}
                    max={10}
                    value={yearCount}
                    onChange={(e) => handleYearCountChange(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="num font-semibold text-sm w-8 text-center">{yearCount}</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">Mode</Label>
                <div className="flex items-center gap-2 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={showLevered}
                      onChange={() => setShowLevered(true)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-xs font-medium">Levered</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!showLevered}
                      onChange={() => setShowLevered(false)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-xs font-medium">Unlevered</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Initial Investment</Label>
                <CurrencyInput value={initialInvestment} onChange={setInitialInvestment} />
              </div>
              <div>
                <Label className="text-xs">Exit Value (Year {yearCount})</Label>
                <CurrencyInput value={exitValue} onChange={setExitValue} />
              </div>
              {cashFlows.map((cf, i) => (
                <div key={i}>
                  <Label className="text-xs">Year {i + 1} Cash Flow</Label>
                  <CurrencyInput value={cf} onChange={(v) => updateCashFlow(i, v)} />
                </div>
              ))}
              <div>
                <Label className="text-xs">Target Return (%)</Label>
                <PercentInput value={targetReturn} onChange={setTargetReturn} />
              </div>
              <div>
                <Label className="text-xs">Discount Rate (NPV)</Label>
                <PercentInput value={discountRate} onChange={setDiscountRate} />
              </div>
            </div>

            {showLevered && (
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leverage Adjustment</h4>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground text-sm">Total Investment</span>
                  <span className="num font-medium">{formatCurrency(invest)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground text-sm">Less: Debt</span>
                  <span className="num font-medium text-red-600">-{formatCurrency(debt)}</span>
                </div>
                <div className="flex justify-between py-1 bg-muted/50 rounded px-2">
                  <span className="font-semibold text-sm">Equity Invested</span>
                  <span className="num font-semibold">{formatCurrency(leveredInvest)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Returns Analysis</CardTitle>
            <CardDescription>IRR, NPV, multiples, and cash-on-cash returns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Core Returns</h4>
              <div className={`flex justify-between py-2.5 rounded-lg px-3 ${showLevered ? 'bg-emerald-50' : 'bg-muted/30'}`}>
                <span className="font-semibold">Levered IRR</span>
                <span className={`num font-bold ${leveredIRR >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{isFinite(leveredIRR) ? leveredIRR.toFixed(2) : '—'}%</span>
              </div>
              <div className={`flex justify-between py-2.5 rounded-lg px-3 ${!showLevered ? 'bg-emerald-50' : 'bg-muted/30'}`}>
                <span className="font-semibold">Unlevered IRR</span>
                <span className={`num font-bold ${unleveredIRR >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{isFinite(unleveredIRR) ? unleveredIRR.toFixed(2) : '—'}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">After-Tax IRR (est.)</span>
                <span className={`num font-medium ${afterTaxIRR >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{isFinite(afterTaxIRR) ? afterTaxIRR.toFixed(2) : '—'}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Equity Multiple</span>
                <span className="num font-medium">{multiple.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Total Profit</span>
                <span className={`num font-medium ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">NPV at {discountRate}%</span>
                <span className={`num font-medium ${npv >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(npv)}</span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash-on-Cash by Year</h4>
              {parsedCFs.map((cf, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Year {i + 1}: {formatCurrency(cf)}</span>
                  <span className="num font-medium">{activeInvest > 0 ? ((cf / activeInvest) * 100).toFixed(1) : 0}%</span>
                </div>
              ))}
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Avg Cash-on-Cash</span>
                <span className="num font-medium">{activeInvest > 0 ? ((parsedCFs.reduce((a, b) => a + b, 0) / parsedCFs.length / activeInvest) * 100).toFixed(1) : 0}%</span>
              </div>
              {paybackYear > 0 && (
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Payback Period</span>
                  <span className="num font-medium">{paybackYear === parsedCFs.length ? `${paybackYear} yrs (at exit)` : `${paybackYear} yrs`}</span>
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target Return</h4>
              <div className={`flex justify-between py-2.5 rounded-lg px-3 ${meetsTarget ? 'bg-green-50' : 'bg-red-50'}`}>
                <span className="font-semibold">IRR vs Target ({target}%)</span>
                <span className={`num font-bold ${meetsTarget ? 'text-green-600' : 'text-red-600'}`}>
                  {meetsTarget ? 'Exceeds' : 'Below'} by {Math.abs(irr - target).toFixed(1)}pp
                </span>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Exit Cap Rate Sensitivity</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Cap Rate</th>
                      <th className="p-2 text-center">Exit Value</th>
                      <th className="p-2 text-center">IRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capRateSensitivity.map(cr => {
                      const sensExitVal = baseNOI / (cr / 100);
                      const sensFlows = [-activeInvest, ...parsedCFs.slice(0, -1), (parsedCFs[parsedCFs.length - 1] || 0) + sensExitVal];
                      const sensIRR = calculateIRR(sensFlows);
                      return (
                        <tr key={cr} className="border-b">
                          <td className="p-2 font-medium">{cr.toFixed(1)}%</td>
                          <td className="p-2 text-center num">{formatCurrency(sensExitVal)}</td>
                          <td className={`p-2 text-center num font-medium ${sensIRR >= target ? 'text-green-600' : 'text-red-600'}`}>{isFinite(sensIRR) ? sensIRR.toFixed(2) : '—'}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SensitivityPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const [baseNOI, setBaseNOI] = useState<string>("500000");
  const [baseCapRate, setBaseCapRate] = useState<string>("6");

  const capRates = [5, 5.5, 6, 6.5, 7];
  const noiChanges = [-10, -5, 0, 5, 10];

  const calculateValue = (noi: number, capRate: number) => {
    return noi / (capRate / 100);
  };

  const holdPeriods = [3, 5, 7, 10];
  const baseValue = masterInputs.salePrice;

  const calcNetProceedsForYear = (year: number) => {
    const salePriceAtYear = baseValue * Math.pow(1.03, year);
    const adjustedBasis = masterInputs.costBasis + masterInputs.capitalImprovements - masterInputs.depreciationTaken;
    const capitalGain = salePriceAtYear - adjustedBasis;
    const depRecapture = Math.min(masterInputs.depreciationTaken, Math.max(0, capitalGain)) * 0.25;
    const longTermGain = Math.max(0, capitalGain - masterInputs.depreciationTaken);
    const federalTax = longTermGain * (masterInputs.federalTaxRate / 100);
    const stateTax = longTermGain * (masterInputs.stateTaxRate / 100);
    const niit = longTermGain > 250000 ? longTermGain * 0.038 : 0;
    const totalTax = federalTax + stateTax + depRecapture + niit;
    const brokerCost = salePriceAtYear * (masterInputs.brokerFeePercent / 100);
    const netSaleProceeds = salePriceAtYear - brokerCost - masterInputs.closingCosts;
    const netCashProceeds = netSaleProceeds - masterInputs.currentDebtBalance - totalTax;
    return { salePrice: salePriceAtYear, capitalGain, totalTax, netCashProceeds };
  };

  const taxScenarios = [
    { label: "Current Rates", fedRate: masterInputs.federalTaxRate, stateRate: masterInputs.stateTaxRate },
    { label: "+5% Increase", fedRate: masterInputs.federalTaxRate + 5, stateRate: masterInputs.stateTaxRate + 5 },
    { label: "+10% Increase", fedRate: masterInputs.federalTaxRate + 10, stateRate: masterInputs.stateTaxRate + 10 },
    { label: "Maximum Rates", fedRate: 37, stateRate: 13.3 },
  ];

  const calcTaxScenario = (fedRate: number, stateRate: number) => {
    const adjustedBasis = masterInputs.costBasis + masterInputs.capitalImprovements - masterInputs.depreciationTaken;
    const capitalGain = masterInputs.salePrice - adjustedBasis;
    const depRecapture = Math.min(masterInputs.depreciationTaken, Math.max(0, capitalGain)) * 0.25;
    const longTermGain = Math.max(0, capitalGain - masterInputs.depreciationTaken);
    const federalTax = longTermGain * (fedRate / 100);
    const stateTax = longTermGain * (stateRate / 100);
    const niit = longTermGain > 250000 ? longTermGain * 0.038 : 0;
    const totalTax = federalTax + stateTax + depRecapture + niit;
    const brokerCost = masterInputs.salePrice * (masterInputs.brokerFeePercent / 100);
    const netSaleProceeds = masterInputs.salePrice - brokerCost - masterInputs.closingCosts;
    const netCashProceeds = netSaleProceeds - masterInputs.currentDebtBalance - totalTax;
    const effectiveRate = capitalGain > 0 ? (totalTax / capitalGain) * 100 : 0;
    return { totalTax, effectiveRate, netCashProceeds };
  };

  const ltvLevels = [0.5, 0.6, 0.7, 0.8];
  const currentLTV = masterInputs.salePrice > 0 ? masterInputs.currentDebtBalance / masterInputs.salePrice : 0;
  const parsedBaseNOI = parseFloat(baseNOI) || 0;
  const baseline = getCashSaleBaseline(masterInputs);

  const bestNOI = parsedBaseNOI * 1.1;
  const baseNOIVal = parsedBaseNOI;
  const worstNOI = parsedBaseNOI * 0.9;

  const bestValue = bestNOI / 0.05;
  const baseValueCalc = baseNOIVal / ((parseFloat(baseCapRate) || 6) / 100);
  const worstValue = worstNOI / 0.07;

  const calcScenarioProceeds = (propertyValue: number, fedRateAdj: number, stateRateAdj: number) => {
    const adjustedBasis = masterInputs.costBasis + masterInputs.capitalImprovements - masterInputs.depreciationTaken;
    const capitalGain = propertyValue - adjustedBasis;
    const depRecapture = Math.min(masterInputs.depreciationTaken, Math.max(0, capitalGain)) * 0.25;
    const longTermGain = Math.max(0, capitalGain - masterInputs.depreciationTaken);
    const federalTax = longTermGain * (fedRateAdj / 100);
    const stateTax = longTermGain * (stateRateAdj / 100);
    const niit = longTermGain > 250000 ? longTermGain * 0.038 : 0;
    const totalTax = federalTax + stateTax + depRecapture + niit;
    const brokerCost = propertyValue * (masterInputs.brokerFeePercent / 100);
    const netProceeds = propertyValue - brokerCost - masterInputs.closingCosts - masterInputs.currentDebtBalance - totalTax;
    return netProceeds;
  };

  const bestProceeds = calcScenarioProceeds(bestValue, masterInputs.federalTaxRate, masterInputs.stateTaxRate);
  const baseProceeds = calcScenarioProceeds(baseValueCalc, masterInputs.federalTaxRate, masterInputs.stateTaxRate);
  const worstProceeds = calcScenarioProceeds(worstValue, masterInputs.federalTaxRate + 10, masterInputs.stateTaxRate + 10);
  const varianceRange = bestProceeds - worstProceeds;

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

      <Card>
        <CardHeader>
          <CardTitle>Exit Timing Sensitivity</CardTitle>
          <CardDescription>Net proceeds at different hold periods (3% annual appreciation)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Hold Period</th>
                  <th className="p-2 text-center">Sale Price</th>
                  <th className="p-2 text-center">Capital Gain</th>
                  <th className="p-2 text-center">Tax</th>
                  <th className="p-2 text-center">Net Proceeds</th>
                </tr>
              </thead>
              <tbody>
                {holdPeriods.map(year => {
                  const r = calcNetProceedsForYear(year);
                  return (
                    <tr key={year} className={`border-b ${year === masterInputs.holdingPeriod ? 'bg-blue-50 font-semibold' : ''}`}>
                      <td className="p-2 font-medium">Year {year}</td>
                      <td className="p-2 text-center num">{formatCurrency(r.salePrice)}</td>
                      <td className="p-2 text-center num">{formatCurrency(r.capitalGain)}</td>
                      <td className="p-2 text-center num text-red-600">{formatCurrency(r.totalTax)}</td>
                      <td className="p-2 text-center num text-green-600">{formatCurrency(r.netCashProceeds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Rate Scenario Matrix</CardTitle>
          <CardDescription>Impact of different tax rate environments on net proceeds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Scenario</th>
                  <th className="p-2 text-center">Total Tax</th>
                  <th className="p-2 text-center">Effective Rate</th>
                  <th className="p-2 text-center">Net Proceeds</th>
                </tr>
              </thead>
              <tbody>
                {taxScenarios.map((scenario, idx) => {
                  const r = calcTaxScenario(scenario.fedRate, scenario.stateRate);
                  return (
                    <tr key={idx} className={`border-b ${idx === 0 ? 'bg-blue-50 font-semibold' : ''}`}>
                      <td className="p-2 font-medium">
                        {scenario.label}
                        <span className="text-xs text-muted-foreground ml-1">({scenario.fedRate.toFixed(1)}% / {scenario.stateRate.toFixed(1)}%)</span>
                      </td>
                      <td className="p-2 text-center num text-red-600">{formatCurrency(r.totalTax)}</td>
                      <td className="p-2 text-center num">{r.effectiveRate.toFixed(1)}%</td>
                      <td className="p-2 text-center num text-green-600">{formatCurrency(r.netCashProceeds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leverage Impact Matrix</CardTitle>
          <CardDescription>Returns at different LTV levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">LTV</th>
                  <th className="p-2 text-center">Debt Amount</th>
                  <th className="p-2 text-center">Equity Required</th>
                  <th className="p-2 text-center">Cash-on-Cash</th>
                  <th className="p-2 text-center">Equity Multiple</th>
                </tr>
              </thead>
              <tbody>
                {ltvLevels.map(ltv => {
                  const debtAmt = masterInputs.salePrice * ltv;
                  const equity = masterInputs.salePrice - debtAmt;
                  const cashOnCash = equity > 0 ? (parsedBaseNOI / equity) * 100 : 0;
                  const equityMultiple = equity > 0 ? (baseline.netSaleProceeds - debtAmt) / equity : 0;
                  const closestLTV = Math.abs(ltv - currentLTV) < 0.05;
                  return (
                    <tr key={ltv} className={`border-b ${closestLTV ? 'bg-blue-50 font-semibold' : ''}`}>
                      <td className="p-2 font-medium">{(ltv * 100).toFixed(0)}% LTV {closestLTV && <Badge variant="outline" className="ml-1 text-xs">Current</Badge>}</td>
                      <td className="p-2 text-center num">{formatCurrency(debtAmt)}</td>
                      <td className="p-2 text-center num">{formatCurrency(equity)}</td>
                      <td className="p-2 text-center num">{cashOnCash.toFixed(1)}%</td>
                      <td className="p-2 text-center num">{equityMultiple.toFixed(2)}x</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Best / Base / Worst Scenario Summary</CardTitle>
          <CardDescription>Range of outcomes under different market conditions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between py-2.5 bg-green-50 rounded-lg px-3">
              <div>
                <span className="font-semibold">Best Case</span>
                <span className="text-xs text-muted-foreground ml-2">NOI +10%, Cap 5%, Current Tax</span>
              </div>
              <span className="num font-bold text-green-600">{formatCurrency(bestProceeds)}</span>
            </div>
            <div className="flex justify-between py-2.5 bg-blue-50 rounded-lg px-3">
              <div>
                <span className="font-semibold">Base Case</span>
                <span className="text-xs text-muted-foreground ml-2">Current NOI, Base Cap, Current Tax</span>
              </div>
              <span className="num font-bold text-blue-600">{formatCurrency(baseProceeds)}</span>
            </div>
            <div className="flex justify-between py-2.5 bg-red-50 rounded-lg px-3">
              <div>
                <span className="font-semibold">Worst Case</span>
                <span className="text-xs text-muted-foreground ml-2">NOI -10%, Cap 7%, +10% Tax</span>
              </div>
              <span className="num font-bold text-red-600">{formatCurrency(worstProceeds)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Variance Range (Best - Worst)</span>
              <span className="num font-semibold">{formatCurrency(varianceRange)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CrossStrategyComparisonPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const baseline = getCashSaleBaseline(masterInputs);

  const salePrice = masterInputs.salePrice;
  const combinedRate = (masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100;

  const cashSaleNet = baseline.netCashProceeds;
  const cashSaleTax = baseline.totalTax;
  const cashSaleEffRate = baseline.effectiveTaxRate;

  const exchangeCosts = 25000;
  const taxSaved1031 = baseline.totalTax;
  const netBenefit1031 = baseline.netSaleProceeds - masterInputs.currentDebtBalance - exchangeCosts;
  const tax1031 = 0;
  const effRate1031 = 0;

  const sfDownPct = 0.20;
  const sfRate = 0.06;
  const sfTerm = 10;
  const sfDown = salePrice * sfDownPct;
  const sfLoan = salePrice - sfDown;
  const sfMonthlyRate = sfRate / 12;
  const sfMonths = sfTerm * 12;
  const sfMonthlyPmt = sfMonthlyRate > 0 && sfMonths > 0 ? sfLoan * (sfMonthlyRate * Math.pow(1 + sfMonthlyRate, sfMonths)) / (Math.pow(1 + sfMonthlyRate, sfMonths) - 1) : 0;
  const sfTotalPayments = sfMonthlyPmt * sfMonths;
  const sfTotalCash = sfDown + sfTotalPayments;
  const sfGain = salePrice - masterInputs.costBasis;
  const sfGPR = salePrice > 0 ? sfGain / salePrice : 0;
  const sfYear1TaxableGain = sfDown * sfGPR;
  const sfYear1Tax = sfYear1TaxableGain * combinedRate;
  const sfDisc = 0.08;
  let sfNPV = sfDown;
  for (let y = 1; y <= sfTerm; y++) {
    sfNPV += (sfMonthlyPmt * 12) / Math.pow(1 + sfDisc, y);
  }
  const sfTotalTax = sfYear1Tax + (sfLoan / sfTerm) * sfGPR * combinedRate * sfTerm;

  const earnoutBasePrice = salePrice * 0.8;
  const earnoutContingent = salePrice * 0.2;
  const earnoutProb = 0.6;
  const earnoutExpectedValue = earnoutBasePrice + earnoutContingent * earnoutProb;
  const earnoutGain = earnoutExpectedValue - masterInputs.costBasis;
  const earnoutTax = Math.max(0, earnoutGain) * combinedRate;
  const earnoutNet = earnoutExpectedValue - earnoutTax - masterInputs.currentDebtBalance - masterInputs.closingCosts - salePrice * (masterInputs.brokerFeePercent / 100);

  const dstInvestment = salePrice - masterInputs.currentDebtBalance - masterInputs.closingCosts;
  const dstDistRate = 0.055;
  const dstApprecRate = 0.03;
  const dstFeeRate = 0.06;
  const dstFee = dstInvestment * dstFeeRate;
  const dstNetInvested = dstInvestment - dstFee;
  const dstAnnualDist = dstNetInvested * dstDistRate;
  const dstTotalDist = dstAnnualDist * masterInputs.holdingPeriod;
  const dstExitValue = dstNetInvested * Math.pow(1 + dstApprecRate, masterInputs.holdingPeriod);
  const dstExitFee = dstExitValue * 0.03;
  const dstTotalReturn = dstTotalDist + dstExitValue - dstExitFee;
  const dstDeferredTax = baseline.totalTax;

  const wfTotalEquity = salePrice - masterInputs.currentDebtBalance;
  const wfLPShare = 0.80;
  const wfPrefRate = 0.08;
  const wfLPEquity = wfTotalEquity * wfLPShare;
  const wfPrefReturn = wfLPEquity * wfPrefRate * masterInputs.holdingPeriod;
  const wfExitProceeds = salePrice * Math.pow(1.03, masterInputs.holdingPeriod);
  const wfDistributable = wfExitProceeds - masterInputs.currentDebtBalance;
  const wfLPPref = Math.min(wfDistributable, wfLPEquity + wfPrefReturn);
  const wfRemaining = Math.max(0, wfDistributable - wfLPPref);
  const wfLPTotal = wfLPPref + wfRemaining * wfLPShare;

  const strategies = [
    { name: "Cash Sale", netProceeds: cashSaleNet, totalTax: cashSaleTax, effRate: cashSaleEffRate, liquidity: "Immediate", risk: "Low", riskColor: "bg-green-100 text-green-800" },
    { name: "1031 Exchange", netProceeds: netBenefit1031, totalTax: tax1031, effRate: effRate1031, liquidity: "45-180 days", risk: "Medium", riskColor: "bg-yellow-100 text-yellow-800" },
    { name: "Seller Financing", netProceeds: sfNPV, totalTax: sfTotalTax, effRate: sfTotalTax > 0 && sfGain > 0 ? (sfTotalTax / sfGain) * 100 : 0, liquidity: "Over 10 years", risk: "Medium-High", riskColor: "bg-orange-100 text-orange-800" },
    { name: "Earnout", netProceeds: earnoutNet, totalTax: earnoutTax, effRate: earnoutGain > 0 ? (earnoutTax / earnoutGain) * 100 : 0, liquidity: "1-3 years", risk: "High", riskColor: "bg-red-100 text-red-800" },
    { name: "DST", netProceeds: dstTotalReturn, totalTax: 0, effRate: 0, liquidity: "7-10 years", risk: "Medium", riskColor: "bg-yellow-100 text-yellow-800" },
    { name: "Waterfall", netProceeds: wfLPTotal, totalTax: wfLPTotal * combinedRate * 0.6, effRate: combinedRate * 60, liquidity: "At fund exit", risk: "Medium-High", riskColor: "bg-orange-100 text-orange-800" },
  ];

  const bestStrategy = strategies.reduce((best, s) => s.netProceeds > best.netProceeds ? s : best, strategies[0]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-teal-500" />
            Cross-Strategy Comparison
          </CardTitle>
          <CardDescription>Side-by-side comparison of all exit strategies using current master inputs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-semibold">Strategy</th>
                  <th className="p-2 text-center font-semibold">Net Proceeds</th>
                  <th className="p-2 text-center font-semibold">Total Tax</th>
                  <th className="p-2 text-center font-semibold">Eff. Tax Rate</th>
                  <th className="p-2 text-center font-semibold">Liquidity</th>
                  <th className="p-2 text-center font-semibold">Risk</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s, idx) => {
                  const isBest = s.name === bestStrategy.name;
                  return (
                    <tr key={idx} className={`border-b ${isBest ? 'bg-teal-50 font-semibold' : ''}`}>
                      <td className="p-2 font-medium">{s.name} {isBest && <Badge className="ml-1 text-xs bg-teal-500">Best</Badge>}</td>
                      <td className="p-2 text-center num text-green-600">{formatCurrency(s.netProceeds)}</td>
                      <td className="p-2 text-center num text-red-600">{formatCurrency(s.totalTax)}</td>
                      <td className="p-2 text-center num">{s.effRate.toFixed(1)}%</td>
                      <td className="p-2 text-center text-xs">{s.liquidity}</td>
                      <td className="p-2 text-center"><Badge variant="outline" className={s.riskColor}>{s.risk}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opportunity Cost Analysis</CardTitle>
          <CardDescription>Cost of choosing each strategy vs. the highest-return option ({bestStrategy.name})</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {strategies.map((s, idx) => {
            const oppCost = bestStrategy.netProceeds - s.netProceeds;
            if (s.name === bestStrategy.name) {
              return (
                <div key={idx} className="flex justify-between py-2.5 bg-teal-50 rounded-lg px-3">
                  <span className="font-semibold text-teal-700">✦ {s.name} (Recommended)</span>
                  <span className="num font-bold text-teal-600">{formatCurrency(s.netProceeds)}</span>
                </div>
              );
            }
            return (
              <div key={idx} className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">{s.name} — Opportunity Cost</span>
                <span className="num font-medium text-red-600">-{formatCurrency(oppCost)}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Tradeoffs</CardTitle>
          <CardDescription>Strategic considerations for each approach</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between py-2.5 bg-green-50 rounded-lg px-3">
            <span className="font-semibold">Highest Immediate Cash</span>
            <span className="num font-bold text-green-600">Cash Sale</span>
          </div>
          <div className="flex justify-between py-2.5 bg-blue-50 rounded-lg px-3">
            <span className="font-semibold">Maximum Tax Deferral</span>
            <span className="num font-bold text-blue-600">1031 Exchange / DST</span>
          </div>
          <div className="flex justify-between py-2.5 bg-amber-50 rounded-lg px-3">
            <span className="font-semibold">Highest Total Value (w/ time value)</span>
            <span className="num font-bold text-amber-600">Seller Financing</span>
          </div>
          <div className="flex justify-between py-2.5 bg-purple-50 rounded-lg px-3">
            <span className="font-semibold">Most Passive</span>
            <span className="num font-bold text-purple-600">DST</span>
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
