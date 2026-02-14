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

            <div className="border-t pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deadlines</h4>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Property Identification</span>
                <span className="num font-medium">45 days</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground text-sm">Exchange Closing</span>
                <span className="num font-medium">180 days</span>
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

  const salePrice = masterInputs.salePrice;
  const downPayment = salePrice * (parseFloat(downPaymentPercent) / 100 || 0);
  const loanAmount = salePrice - downPayment;
  const monthlyRate = (parseFloat(interestRate) / 100 || 0) / 12;
  const months = (parseFloat(term) || 0) * 12;
  const monthlyPayment = monthlyRate > 0 && months > 0 ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1) : 0;
  const totalPayments = monthlyPayment * months;
  const totalInterest = totalPayments - loanAmount;
  const totalCashReceived = downPayment + totalPayments;

  const gain = salePrice - masterInputs.costBasis;
  const grossProfitRatio = salePrice > 0 ? gain / salePrice : 0;
  const year1TaxableGain = downPayment * grossProfitRatio;
  const annualPrincipal = months > 0 ? loanAmount / (parseFloat(term) || 1) : 0;
  const annualTaxableGain = annualPrincipal * grossProfitRatio;
  const combinedRate = (masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100;
  const year1Tax = year1TaxableGain * combinedRate;
  const annualTax = annualTaxableGain * combinedRate;
  const totalInstallmentTax = year1Tax + annualTax * (parseFloat(term) || 0);
  const taxDeferral = baseline.totalTax - year1Tax;

  const disc = parseFloat(discountRate) / 100 || 0;
  let npv = downPayment;
  for (let y = 1; y <= (parseFloat(term) || 0); y++) {
    npv += (monthlyPayment * 12) / Math.pow(1 + disc, y);
  }

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
                <span className="text-muted-foreground text-sm">Monthly Payment</span>
                <span className="num font-medium text-green-600">{formatCurrency(monthlyPayment)}</span>
              </div>
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
          </CardContent>
        </Card>
      </div>
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

  const base = parseFloat(basePrice) || 0;
  const maxEarnout = parseFloat(earnoutMax) || 0;
  const prob = parseFloat(probability) / 100 || 0;
  const years = parseFloat(earnoutYears) || 1;
  const disc = parseFloat(discountRate) / 100 || 0;

  const expectedEarnout = maxEarnout * prob;
  const totalExpected = base + expectedEarnout;
  const maxValue = base + maxEarnout;

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

  const totalDist = parseFloat(totalDistribution) || 0;
  const lpCap = parseFloat(lpCapital) || 0;
  const gpCap = parseFloat(gpCapital) || 0;
  const totalCapital = lpCap + gpCap;
  const prefRate = parseFloat(preferredReturn) / 100 || 0;
  const carryRate = parseFloat(carriedInterest) / 100 || 0;

  const lpPref = lpCap * prefRate * masterInputs.holdingPeriod;
  const gpPref = gpCap * prefRate * masterInputs.holdingPeriod;
  const totalPref = lpPref + gpPref;
  const afterPrefAndReturn = totalDist - totalPref - totalCapital;
  const gpCarry = afterPrefAndReturn > 0 ? afterPrefAndReturn * carryRate : 0;
  const lpProfit = afterPrefAndReturn > 0 ? afterPrefAndReturn - gpCarry : 0;
  const lpTotal = lpCap + lpPref + lpProfit;
  const gpTotal = gpCap + gpPref + gpCarry;
  const lpMOIC = lpCap > 0 ? lpTotal / lpCap : 0;
  const gpMOIC = gpCap > 0 ? gpTotal / gpCap : 0;
  const dealMOIC = totalCapital > 0 ? totalDist / totalCapital : 0;
  const lpIRR = lpCap > 0 && masterInputs.holdingPeriod > 0 ? (Math.pow(lpTotal / lpCap, 1 / masterInputs.holdingPeriod) - 1) * 100 : 0;

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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 3: Profit Split</h4>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Remaining Profit</span>
                <span className="num font-medium">{formatCurrency(Math.max(0, afterPrefAndReturn))}</span>
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
    </div>
  );
}

function IRRCalculatorPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const [initialInvestment, setInitialInvestment] = useState<string>("1000000");
  const [year1, setYear1] = useState<string>("100000");
  const [year2, setYear2] = useState<string>("150000");
  const [year3, setYear3] = useState<string>("200000");
  const [exitValue, setExitValue] = useState<string>("1500000");
  const [targetReturn, setTargetReturn] = useState<string>("15");
  const [discountRate, setDiscountRate] = useState<string>("10");

  const invest = parseFloat(initialInvestment) || 0;
  const cf1 = parseFloat(year1) || 0;
  const cf2 = parseFloat(year2) || 0;
  const cf3 = parseFloat(year3) || 0;
  const exit = parseFloat(exitValue) || 0;
  const target = parseFloat(targetReturn) || 0;
  const disc = parseFloat(discountRate) / 100 || 0;

  const cashFlows = [-invest, cf1, cf2, cf3 + exit];
  const annualCFs = [cf1, cf2, cf3];

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
      if (npvDerivative !== 0) rate = rate - npv / npvDerivative;
      else break;
    }
    return rate * 100;
  };

  const irr = calculateIRR(cashFlows);
  const totalCashFlow = cf1 + cf2 + cf3 + exit;
  const totalProfit = totalCashFlow - invest;
  const multiple = invest > 0 ? totalCashFlow / invest : 0;

  const combinedRate = (masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100;
  const afterTaxCFs = [-invest, cf1 * (1 - combinedRate * 0.3), cf2 * (1 - combinedRate * 0.3), (cf3 * (1 - combinedRate * 0.3)) + exit * (1 - combinedRate)];
  const afterTaxIRR = calculateIRR(afterTaxCFs);

  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + disc, t);
  }

  let cumulativeCF = -invest;
  let paybackYear = 0;
  for (let y = 0; y < annualCFs.length; y++) {
    cumulativeCF += annualCFs[y];
    if (cumulativeCF >= 0 && paybackYear === 0) {
      paybackYear = y + 1;
    }
  }
  if (paybackYear === 0 && cumulativeCF + exit >= 0) paybackYear = annualCFs.length;

  const meetsTarget = irr >= target;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-emerald-500" />
              IRR Calculator
            </CardTitle>
            <CardDescription>Multi-period return analysis with tax adjustment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Initial Investment</Label>
                <CurrencyInput value={initialInvestment} onChange={setInitialInvestment} />
              </div>
              <div>
                <Label className="text-xs">Year 1 Cash Flow</Label>
                <CurrencyInput value={year1} onChange={setYear1} />
              </div>
              <div>
                <Label className="text-xs">Year 2 Cash Flow</Label>
                <CurrencyInput value={year2} onChange={setYear2} />
              </div>
              <div>
                <Label className="text-xs">Year 3 Cash Flow</Label>
                <CurrencyInput value={year3} onChange={setYear3} />
              </div>
              <div>
                <Label className="text-xs">Exit Value (Year 3)</Label>
                <CurrencyInput value={exitValue} onChange={setExitValue} />
              </div>
              <div>
                <Label className="text-xs">Target Return (%)</Label>
                <PercentInput value={targetReturn} onChange={setTargetReturn} />
              </div>
              <div>
                <Label className="text-xs">Discount Rate (NPV)</Label>
                <PercentInput value={discountRate} onChange={setDiscountRate} />
              </div>
            </div>
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
              <div className="flex justify-between py-2.5 bg-emerald-50 rounded-lg px-3">
                <span className="font-semibold">Pre-Tax IRR</span>
                <span className={`num font-bold ${irr >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{irr.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">After-Tax IRR (est.)</span>
                <span className={`num font-medium ${afterTaxIRR >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{afterTaxIRR.toFixed(2)}%</span>
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
              {annualCFs.map((cf, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Year {i + 1}: {formatCurrency(cf)}</span>
                  <span className="num font-medium">{invest > 0 ? ((cf / invest) * 100).toFixed(1) : 0}%</span>
                </div>
              ))}
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Avg Cash-on-Cash</span>
                <span className="num font-medium">{invest > 0 ? ((annualCFs.reduce((a, b) => a + b, 0) / annualCFs.length / invest) * 100).toFixed(1) : 0}%</span>
              </div>
              {paybackYear > 0 && (
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Payback Period</span>
                  <span className="num font-medium">{paybackYear === annualCFs.length ? `${paybackYear} yrs (at exit)` : `${paybackYear} yrs`}</span>
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
          </CardContent>
        </Card>
      </div>
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
