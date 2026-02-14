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
  MapPin,
  Save,
  Copy,
  Trash2,
  Printer,
  Plus,
  Minus,
  X,
  AlertTriangle,
  Hammer,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ArrowRightLeft,
  GitBranch,
  Clock,
  MapPinned,
  Users,
  CheckCircle2,
  Building,
  Star,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Lightbulb,
  FileText,
  TrendingDown,
  BarChart2,
  DollarSign
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useExitStrategiesStore, type MasterInputs, type SavedScenario } from "@/stores/exitStrategiesStore";
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
  const [isNamingScenario, setIsNamingScenario] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const { 
    masterInputs, setMasterInput, reset,
    savedScenarios, activeScenarioId,
    saveScenario, loadScenario, deleteScenario
  } = useExitStrategiesStore();

  const activeScenario = savedScenarios.find((s) => s.id === activeScenarioId);

  const hasUnsavedChanges = activeScenario
    ? JSON.stringify(activeScenario.inputs) !== JSON.stringify(masterInputs)
    : false;

  const handleInputChange = <K extends keyof MasterInputs>(key: K, value: string) => {
    const numValue = parseFloat(value) || 0;
    setMasterInput(key, numValue as MasterInputs[K]);
  };

  const handleSave = () => {
    if (activeScenarioId && activeScenario) {
      saveScenario(activeScenario.name);
    } else {
      setScenarioName("");
      setIsNamingScenario(true);
    }
  };

  const handleSaveAs = () => {
    setScenarioName("");
    setIsNamingScenario(true);
  };

  const handleConfirmSave = () => {
    if (scenarioName.trim()) {
      const store = useExitStrategiesStore.getState();
      if (isNamingScenario && activeScenarioId) {
        const newScenario = {
          id: Date.now().toString(),
          name: scenarioName.trim(),
          savedAt: new Date().toISOString(),
          inputs: { ...store.masterInputs },
        };
        useExitStrategiesStore.setState((s) => ({
          savedScenarios: [...s.savedScenarios, newScenario],
          activeScenarioId: newScenario.id,
        }));
      } else {
        saveScenario(scenarioName.trim());
      }
      setIsNamingScenario(false);
      setScenarioName("");
    }
  };

  const handleScenarioSelect = (value: string) => {
    if (value === "__new__") {
      useExitStrategiesStore.setState({ activeScenarioId: null });
    } else {
      loadScenario(value);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Master Inputs</CardTitle>
              {activeScenario && (
                <Badge variant={hasUnsavedChanges ? "outline" : "secondary"} className="text-xs ml-1">
                  {hasUnsavedChanges ? "Unsaved changes" : `Scenario: ${activeScenario.name}`}
                </Badge>
              )}
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
          <CardContent className="pt-0 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={activeScenarioId || "__new__"} onValueChange={handleScenarioSelect}>
                <SelectTrigger className="w-[220px] h-8 text-xs">
                  <SelectValue placeholder="Select scenario..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">New Scenario</SelectItem>
                  {savedScenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {new Date(s.savedAt).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8" onClick={handleSave} title="Save">
                <Save className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={handleSaveAs} title="Save As">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {activeScenarioId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={() => deleteScenario(activeScenarioId)}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {isNamingScenario && (
              <div className="flex items-center gap-2">
                <Input
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Scenario name..."
                  className="h-8 text-xs w-[200px]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmSave();
                    if (e.key === "Escape") setIsNamingScenario(false);
                  }}
                />
                <Button size="sm" className="h-8 text-xs" onClick={handleConfirmSave}>Save</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setIsNamingScenario(false)}>Cancel</Button>
              </div>
            )}
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
    name: "Advisor Insights", 
    shortName: "Advisor",
    description: "AI-powered advisory analysis", 
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
  const { savedScenarios, activeScenarioId } = useExitStrategiesStore();

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
        <div className="flex items-center justify-end gap-2" data-no-print>
          <Button
            variant="outline"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
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

        <Card className="bg-blue-50 border-blue-200" data-no-print>
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

        <div data-no-print>
          <SharedInputsPanel />
        </div>

        <div className="print-header" style={{ display: 'none' }}>
          <h1>Exit Strategy Analysis</h1>
          <p>{exitTools.find(t => t.id === activeTab)?.name || activeTab}</p>
          <p>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          {activeScenarioId && (
            <p>Scenario: {savedScenarios.find(s => s.id === activeScenarioId)?.name}</p>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1" data-no-print>
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
            <AdvisorInsightsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function TaxAndProceedsPanel() {
  const { masterInputs, setMasterInput } = useExitStrategiesStore();
  const b = getCashSaleBaseline(masterInputs);

  const stateTaxOptions = [
    { label: "Florida (0%)", value: 0 },
    { label: "Texas (0%)", value: 0 },
    { label: "California (13.3%)", value: 13.3 },
    { label: "New York (10.9%)", value: 10.9 },
    { label: "New Jersey (10.75%)", value: 10.75 },
    { label: "Illinois (4.95%)", value: 4.95 },
    { label: "Massachusetts (9%)", value: 9 },
  ];

  const matchedState = stateTaxOptions.find(s => s.value === masterInputs.stateTaxRate);
  const selectedStateKey = matchedState ? matchedState.label : "custom";

  const handleStateSelect = (val: string) => {
    if (val === "custom") return;
    const opt = stateTaxOptions.find(s => s.label === val);
    if (opt) setMasterInput('stateTaxRate', opt.value);
  };

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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">State Tax Rate</h4>
              <Select value={selectedStateKey} onValueChange={handleStateSelect}>
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder="Select state..." />
                </SelectTrigger>
                <SelectContent>
                  {stateTaxOptions.map((s) => (
                    <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom ({masterInputs.stateTaxRate}%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

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

            {(() => {
              const combinedRate = (masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100;
              const personalProperty = masterInputs.costBasis * 0.20;
              const landImprovements = masterInputs.costBasis * 0.12;
              const standardAnnual = masterInputs.costBasis * 0.80 / 27.5;
              const yearOneSavings = personalProperty * combinedRate + landImprovements * combinedRate * (1/15 - 1/27.5) * masterInputs.holdingPeriod;
              const studyCostEst = 25000;
              const roi = studyCostEst > 0 ? (yearOneSavings / studyCostEst) * 100 : 0;
              return (
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost Segregation Study Impact</h4>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Personal Property Portion (est. 20%)</span>
                    <span className="num font-medium">{formatCurrency(personalProperty)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Land Improvements (est. 12%)</span>
                    <span className="num font-medium">{formatCurrency(landImprovements)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Standard Annual Deduction (27.5-yr SL)</span>
                    <span className="num font-medium">{formatCurrency(standardAnnual)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Year 1 Tax Savings (w/ Bonus Depr.)</span>
                    <span className="num font-medium text-green-600">{formatCurrency(yearOneSavings)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Estimated Study Cost</span>
                    <span className="num font-medium">$15,000 – $40,000</span>
                  </div>
                  <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                    <span className="font-semibold text-sm">ROI of Study (vs. $25K avg cost)</span>
                    <span className={`num font-semibold ${roi >= 100 ? 'text-green-600' : 'text-amber-600'}`}>{roi.toFixed(0)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground italic pt-1">Estimates assume 100% bonus depreciation on personal property. Consult a tax advisor for actual cost seg analysis.</p>
                </div>
              );
            })()}
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

      {(() => {
        const combinedRate = (masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100;
        const capitalGain = b.capitalGain;
        const taxDeferred = capitalGain * combinedRate;
        const holdingPeriod = masterInputs.holdingPeriod;
        const projectedQOZValue = capitalGain * Math.pow(1.08, holdingPeriod);
        const qozAppreciation = projectedQOZValue - capitalGain;
        const cashSalePath = b.netCashProceeds * Math.pow(1.08, holdingPeriod);
        const qozPath = capitalGain * Math.pow(1.08, holdingPeriod);
        const qozAdvantage = qozPath - cashSalePath;
        return (
          <Card>
            <CardHeader>
              <CardTitle>Qualified Opportunity Zone (QOZ) Comparison</CardTitle>
              <CardDescription>Capital gains reinvestment into a QOZ fund</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">QOZ Investment</h4>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Capital Gain Eligible for QOZ</span>
                  <span className="num font-medium">{formatCurrency(capitalGain)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">QOZ Investment Amount</span>
                  <span className="num font-medium">{formatCurrency(capitalGain)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Tax Deferred (until 2026 or sale)</span>
                  <span className="num font-medium text-green-600">{formatCurrency(taxDeferred)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Capital Gains on QOZ Appreciation (10+ yr hold)</span>
                  <span className="num font-medium text-green-600">$0 (tax-free growth)</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projected QOZ Growth (8% Annual Return)</h4>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Projected QOZ Value at Exit ({holdingPeriod} yrs)</span>
                  <span className="num font-medium">{formatCurrency(projectedQOZValue)}</span>
                </div>
                <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                  <span className="font-semibold text-sm">QOZ Tax-Free Appreciation</span>
                  <span className="num font-semibold text-green-600">{formatCurrency(qozAppreciation)}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cash Sale vs QOZ Comparison</h4>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Cash Sale Path (reinvested at 8%)</span>
                  <span className="num font-medium">{formatCurrency(cashSalePath)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">QOZ Path (tax-free appreciation)</span>
                  <span className="num font-medium">{formatCurrency(qozPath)}</span>
                </div>
                <div className={`flex justify-between py-2.5 rounded-lg px-3 ${qozAdvantage >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className="font-semibold">QOZ Advantage</span>
                  <span className={`num font-bold ${qozAdvantage >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(qozAdvantage)}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic pt-1">QOZ benefits require 10+ year hold and investment in designated Opportunity Zones</p>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

function Exchange1031Panel() {
  const { masterInputs } = useExitStrategiesStore();
  const baseline = getCashSaleBaseline(masterInputs);
  const [properties, setProperties] = useState<Array<{name: string; value: string; type: string}>>([
    { name: "Property 1", value: "6000000", type: "marina" }
  ]);
  const [bootReceived, setBootReceived] = useState<string>("0");
  const [exchangeCosts, setExchangeCosts] = useState<string>("25000");
  const [isReverseExchange, setIsReverseExchange] = useState(false);
  const [isImprovementExchange, setIsImprovementExchange] = useState(false);
  const [constructionBudget, setConstructionBudget] = useState<string>("500000");
  const [landCost, setLandCost] = useState<string>("1000000");

  const relinquishedValue = masterInputs.salePrice;
  const gain = baseline.capitalGain;
  const boot = parseFloat(bootReceived) || 0;
  const replacement = properties.reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);
  const exchCosts = parseFloat(exchangeCosts) || 0;
  const effectiveExchCosts = isReverseExchange ? exchCosts * 1.5 : exchCosts;
  const deferredGain = Math.max(0, gain - boot);
  const bootTax = boot * ((masterInputs.federalTaxRate + masterInputs.stateTaxRate) / 100);
  const taxSaved = baseline.totalTax - bootTax;
  const newBasis = replacement - deferredGain;
  const equityRequired = replacement - (baseline.netSaleProceeds - masterInputs.currentDebtBalance);
  const netBenefit = taxSaved - effectiveExchCosts;
  const twoHundredPercentLimit = relinquishedValue * 2;
  const passes200Rule = replacement <= twoHundredPercentLimit;

  const consBudget = parseFloat(constructionBudget) || 0;
  const land = parseFloat(landCost) || 0;
  const totalImprovedValue = land + consBudget;
  const improvedBasis = newBasis + consBudget;

  const addProperty = () => {
    if (properties.length < 3) {
      setProperties([...properties, { name: `Property ${properties.length + 1}`, value: "0", type: "marina" }]);
    }
  };

  const removeProperty = (index: number) => {
    if (properties.length > 1) {
      setProperties(properties.filter((_, i) => i !== index));
    }
  };

  const updateProperty = (index: number, field: string, value: string) => {
    setProperties(properties.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identified Replacement Properties</h4>
                {properties.length < 3 && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addProperty}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Property
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">3-Property Rule: Identify up to 3 properties regardless of value</p>
              {properties.map((prop, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Property {index + 1}</span>
                    {properties.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => removeProperty(index)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={prop.name}
                        onChange={(e) => updateProperty(index, 'name', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Value</Label>
                      <CurrencyInput value={prop.value} onChange={(v) => updateProperty(index, 'value', v)} />
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select value={prop.type} onValueChange={(v) => updateProperty(index, 'type', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="marina">Marina</SelectItem>
                          <SelectItem value="multifamily">Multifamily</SelectItem>
                          <SelectItem value="industrial">Industrial</SelectItem>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="mixed-use">Mixed-Use</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                <span className="font-semibold text-sm">Total Replacement Value</span>
                <span className="num font-semibold">{formatCurrency(replacement)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground text-sm">200% Rule Check (≤ {formatCurrency(twoHundredPercentLimit)})</span>
                <span className={`text-sm font-medium ${passes200Rule ? 'text-green-600' : 'text-red-600'}`}>
                  {passes200Rule ? '✓ Passes' : '✗ Exceeds limit'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Boot Received</Label>
                <CurrencyInput value={bootReceived} onChange={setBootReceived} />
              </div>
              <div>
                <Label className="text-xs">Exchange Costs (QI fees, etc.)</Label>
                <CurrencyInput value={exchangeCosts} onChange={setExchangeCosts} />
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReverseExchange}
                  onChange={(e) => setIsReverseExchange(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">Reverse Exchange (buy before sell)</span>
              </label>
              {isReverseExchange && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 font-medium">Reverse exchanges require more capital upfront and higher QI fees</p>
                  </div>
                  <p className="text-xs text-amber-700">In a reverse exchange, the replacement property is acquired before the relinquished property is sold.</p>
                  <div className="space-y-1.5 text-xs text-amber-700">
                    <div className="flex justify-between">
                      <span>EAT (Exchange Accommodation Titleholder) holds the property</span>
                    </div>
                    <div className="flex justify-between">
                      <span>180-day deadline applies from acquisition of replacement</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="font-medium">Estimated Reverse Exchange Costs</span>
                      <span className="num font-medium text-red-600">{formatCurrency(exchCosts * 1.5)}</span>
                    </div>
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isImprovementExchange}
                  onChange={(e) => setIsImprovementExchange(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">Improvement Exchange (Build-to-Suit)</span>
              </label>
              {isImprovementExchange && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <Hammer className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-800 font-medium">Build-to-suit exchange allows improvements using exchange proceeds</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Land Cost</Label>
                      <CurrencyInput value={landCost} onChange={setLandCost} />
                    </div>
                    <div>
                      <Label className="text-xs">Construction Budget</Label>
                      <CurrencyInput value={constructionBudget} onChange={setConstructionBudget} />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-blue-700">
                    <div className="flex justify-between py-1 border-b border-blue-200">
                      <span>Total Improved Value</span>
                      <span className="num font-medium">{formatCurrency(totalImprovedValue)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-blue-200">
                      <span>Tax Basis of Improved Property</span>
                      <span className="num font-medium">{formatCurrency(improvedBasis)}</span>
                    </div>
                    <p className="pt-1">Improvements must be substantially complete within 180 days</p>
                    <p>EAT holds title during construction period</p>
                    <p>Financing available: can use exchange proceeds for construction</p>
                  </div>
                </div>
              )}
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
                <span className="text-muted-foreground text-sm">Total Replacement Value ({properties.length} {properties.length === 1 ? 'property' : 'properties'})</span>
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
                <span className="text-muted-foreground text-sm">Exchange Costs{isReverseExchange ? ' (Reverse)' : ''}</span>
                <span className="num font-medium text-red-600">-{formatCurrency(effectiveExchCosts)}</span>
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
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Timeline Calculator{isReverseExchange ? ' (Reverse Exchange)' : ''}
                  </h4>
                  {isReverseExchange && (
                    <p className="text-xs text-amber-600 italic">In a reverse exchange, the 180-day deadline runs from acquisition of the replacement property</p>
                  )}
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">{isReverseExchange ? 'Replacement Acquisition Date' : 'Assumed Sale Date'}</span>
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
                <span className={`text-sm font-medium ${passes200Rule ? '' : 'text-red-600'}`}>
                  Combined FMV ≤ {formatCurrency(twoHundredPercentLimit)} {passes200Rule ? '✓' : '✗'}
                </span>
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
                <span className="num font-medium">New basis: {formatCurrency(isImprovementExchange ? improvedBasis : newBasis)} over 27.5 years</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">Annual Depreciation Deduction</span>
                <span className="num font-medium text-green-600">{formatCurrency((isImprovementExchange ? improvedBasis : newBasis) * 0.8 / 27.5)}</span>
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

  const [useDiversification, setUseDiversification] = useState(false);
  const [dstAllocations, setDstAllocations] = useState<Array<{
    name: string;
    allocationPercent: string;
    distributionRate: string;
    appreciationRate: string;
    propertyType: string;
  }>>([
    { name: "DST A", allocationPercent: "50", distributionRate: "5.5", appreciationRate: "3", propertyType: "multifamily" },
    { name: "DST B", allocationPercent: "30", distributionRate: "6.0", appreciationRate: "2.5", propertyType: "industrial" },
    { name: "DST C", allocationPercent: "20", distributionRate: "5.0", appreciationRate: "3.5", propertyType: "medical-office" },
  ]);

  const [tenantConcentration, setTenantConcentration] = useState("multi-2-5");
  const [remainingLeaseTerm, setRemainingLeaseTerm] = useState<string>("10");
  const [sponsorTrackRecord, setSponsorTrackRecord] = useState("5-plus");
  const [leverageLevel, setLeverageLevel] = useState<string>("50");
  const [geoDiversification, setGeoDiversification] = useState("multi-market");

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

  const totalAllocationPercent = dstAllocations.reduce((sum, d) => sum + (parseFloat(d.allocationPercent) || 0), 0);
  const blendedDistRate = dstAllocations.reduce((sum, d) => {
    const alloc = (parseFloat(d.allocationPercent) || 0) / 100;
    return sum + alloc * (parseFloat(d.distributionRate) || 0);
  }, 0);
  const blendedApprecRate = dstAllocations.reduce((sum, d) => {
    const alloc = (parseFloat(d.allocationPercent) || 0) / 100;
    return sum + alloc * (parseFloat(d.appreciationRate) || 0);
  }, 0);

  const perDstMetrics = dstAllocations.map((d) => {
    const alloc = (parseFloat(d.allocationPercent) || 0) / 100;
    const dstInvestment = netInvested * alloc;
    const dstDistRate = parseFloat(d.distributionRate) / 100 || 0;
    const dstApprecRate = parseFloat(d.appreciationRate) / 100 || 0;
    const annDist = dstInvestment * dstDistRate;
    const dstExitVal = dstInvestment * Math.pow(1 + dstApprecRate, masterInputs.holdingPeriod);
    return { ...d, dstInvestment, annDist, dstExitVal };
  });
  const blendedTotalAnnualDist = perDstMetrics.reduce((sum, d) => sum + d.annDist, 0);
  const blendedExitValue = perDstMetrics.reduce((sum, d) => sum + d.dstExitVal, 0);
  const blendedNetExitProceeds = blendedExitValue - blendedExitValue * (parseFloat(dispositionFee) / 100 || 0);

  const updateDstAllocation = (index: number, field: string, value: string) => {
    setDstAllocations(dstAllocations.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const leaseTermYears = parseFloat(remainingLeaseTerm) || 0;
  const ltv = parseFloat(leverageLevel) || 0;
  const tenantRiskScore = tenantConcentration === "single" ? 3 : tenantConcentration === "multi-2-5" ? 2 : 1;
  const leaseRiskScore = leaseTermYears < 5 ? 3 : leaseTermYears <= 10 ? 2 : 1;
  const sponsorRiskScore = sponsorTrackRecord === "first-time" ? 3 : sponsorTrackRecord === "5-plus" ? 2 : 1;
  const leverageRiskScore = ltv > 60 ? 3 : ltv >= 40 ? 2 : 1;
  const geoRiskScore = geoDiversification === "single-market" ? 2 : 1;
  const compositeRiskRaw = (tenantRiskScore + leaseRiskScore + sponsorRiskScore + leverageRiskScore + geoRiskScore);
  const compositeRiskScore = Math.min(10, Math.max(1, Math.round((compositeRiskRaw / 14) * 10)));
  const riskLabel = compositeRiskScore <= 3 ? "Low" : compositeRiskScore <= 6 ? "Medium" : "High";
  const riskColor = compositeRiskScore <= 3 ? "text-green-600" : compositeRiskScore <= 6 ? "text-amber-600" : "text-red-600";
  const riskBg = compositeRiskScore <= 3 ? "bg-green-50" : compositeRiskScore <= 6 ? "bg-amber-50" : "bg-red-50";

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

            <div className="border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDiversification}
                  onChange={(e) => setUseDiversification(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Diversify Across Multiple DSTs</span>
                <GitBranch className="h-4 w-4 text-purple-500" />
              </label>
            </div>

            {useDiversification && (
              <div className="border rounded-lg p-4 space-y-3 bg-purple-50/30">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  Multi-DST Allocation
                </h4>
                {dstAllocations.map((dst, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-white space-y-2">
                    <span className="text-xs font-semibold text-purple-700">{dst.name}</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Allocation %</Label>
                        <Input
                          type="number"
                          value={dst.allocationPercent}
                          onChange={(e) => updateDstAllocation(index, 'allocationPercent', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Distribution %</Label>
                        <Input
                          type="number"
                          value={dst.distributionRate}
                          onChange={(e) => updateDstAllocation(index, 'distributionRate', e.target.value)}
                          className="h-8 text-xs"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Appreciation %</Label>
                        <Input
                          type="number"
                          value={dst.appreciationRate}
                          onChange={(e) => updateDstAllocation(index, 'appreciationRate', e.target.value)}
                          className="h-8 text-xs"
                          step="0.1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Property Type</Label>
                        <Select value={dst.propertyType} onValueChange={(v) => updateDstAllocation(index, 'propertyType', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multifamily">Multifamily</SelectItem>
                            <SelectItem value="industrial">Industrial</SelectItem>
                            <SelectItem value="medical-office">Medical Office</SelectItem>
                            <SelectItem value="retail">Retail</SelectItem>
                            <SelectItem value="self-storage">Self Storage</SelectItem>
                            <SelectItem value="office">Office</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
                <div className={`flex justify-between py-1.5 rounded px-2 ${Math.abs(totalAllocationPercent - 100) < 0.01 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className="font-semibold text-sm">Total Allocation</span>
                  <span className={`num font-semibold ${Math.abs(totalAllocationPercent - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalAllocationPercent.toFixed(1)}%
                    {Math.abs(totalAllocationPercent - 100) >= 0.01 && " (must equal 100%)"}
                  </span>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blended Returns</h4>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground text-sm">Weighted Avg Distribution Rate</span>
                    <span className="num font-medium">{blendedDistRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground text-sm">Weighted Avg Appreciation Rate</span>
                    <span className="num font-medium">{blendedApprecRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground text-sm">Blended Exit Value</span>
                    <span className="num font-medium">{formatCurrency(blendedExitValue)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-muted/50 rounded px-2">
                    <span className="font-semibold text-sm">Blended Net Exit Proceeds</span>
                    <span className="num font-semibold text-green-600">{formatCurrency(blendedNetExitProceeds)}</span>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Per-DST Annual Distributions</h4>
                  {perDstMetrics.map((dst, index) => (
                    <div key={index} className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground text-sm">{dst.name} ({dst.allocationPercent}% — {formatCurrency(dst.dstInvestment)})</span>
                      <span className="num font-medium text-green-600">{formatCurrency(dst.annDist)}/yr</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-1.5 bg-green-50 rounded px-2">
                    <span className="font-semibold text-sm">Total Annual Distributions</span>
                    <span className="num font-semibold text-green-600">{formatCurrency(blendedTotalAnnualDist)}</span>
                  </div>
                </div>
              </div>
            )}

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

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                Risk Assessment
              </h4>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tenant Concentration</Label>
                    <Select value={tenantConcentration} onValueChange={setTenantConcentration}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single-Tenant</SelectItem>
                        <SelectItem value="multi-2-5">Multi-Tenant (2-5)</SelectItem>
                        <SelectItem value="multi-5-plus">Multi-Tenant (5+)</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className={`text-xs mt-0.5 block ${tenantConcentration === "single" ? "text-red-600" : tenantConcentration === "multi-2-5" ? "text-amber-600" : "text-green-600"}`}>
                      {tenantConcentration === "single" ? "High Risk" : tenantConcentration === "multi-2-5" ? "Medium Risk" : "Low Risk"}
                    </span>
                  </div>
                  <div>
                    <Label className="text-xs">Remaining Lease Term (yrs)</Label>
                    <Input
                      type="number"
                      value={remainingLeaseTerm}
                      onChange={(e) => setRemainingLeaseTerm(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className={`text-xs mt-0.5 block ${leaseTermYears < 5 ? "text-red-600" : leaseTermYears <= 10 ? "text-amber-600" : "text-green-600"}`}>
                      {leaseTermYears < 5 ? "High Risk" : leaseTermYears <= 10 ? "Medium Risk" : "Low Risk"}
                    </span>
                  </div>
                  <div>
                    <Label className="text-xs">Sponsor Track Record</Label>
                    <Select value={sponsorTrackRecord} onValueChange={setSponsorTrackRecord}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first-time">First-Time Sponsor</SelectItem>
                        <SelectItem value="5-plus">5+ Deals</SelectItem>
                        <SelectItem value="20-plus">20+ Deals</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className={`text-xs mt-0.5 block ${sponsorTrackRecord === "first-time" ? "text-red-600" : sponsorTrackRecord === "5-plus" ? "text-amber-600" : "text-green-600"}`}>
                      {sponsorTrackRecord === "first-time" ? "High Risk" : sponsorTrackRecord === "5-plus" ? "Medium Risk" : "Low Risk"}
                    </span>
                  </div>
                  <div>
                    <Label className="text-xs">Leverage Level (LTV %)</Label>
                    <Input
                      type="number"
                      value={leverageLevel}
                      onChange={(e) => setLeverageLevel(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <span className={`text-xs mt-0.5 block ${ltv > 60 ? "text-red-600" : ltv >= 40 ? "text-amber-600" : "text-green-600"}`}>
                      {ltv > 60 ? "High Risk (>60%)" : ltv >= 40 ? "Medium Risk (40-60%)" : "Low Risk (<40%)"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Geographic Diversification</Label>
                    <Select value={geoDiversification} onValueChange={setGeoDiversification}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single-market">Single Market</SelectItem>
                        <SelectItem value="multi-market">Multi-Market</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className={`text-xs mt-0.5 block ${geoDiversification === "single-market" ? "text-amber-600" : "text-green-600"}`}>
                      {geoDiversification === "single-market" ? "Higher Risk" : "Lower Risk"}
                    </span>
                  </div>
                </div>

                <div className={`flex items-center justify-between py-3 rounded-lg px-4 ${riskBg}`}>
                  <div className="flex items-center gap-2">
                    {compositeRiskScore <= 3 ? <ShieldCheck className="h-5 w-5 text-green-600" /> :
                     compositeRiskScore <= 6 ? <Shield className="h-5 w-5 text-amber-600" /> :
                     <ShieldAlert className="h-5 w-5 text-red-600" />}
                    <span className="font-semibold text-sm">Composite Risk Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${riskColor}`}>{compositeRiskScore}</span>
                    <span className={`text-xs font-medium ${riskColor}`}>/ 10 ({riskLabel})</span>
                  </div>
                </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-indigo-500" />
            UPREIT Conversion Path
          </CardTitle>
          <CardDescription>Converting DST interest to REIT operating partnership units</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversion Overview</h4>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">DST Exit Value (Net Proceeds)</span>
              <span className="num font-medium">{formatCurrency(netExitProceeds)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">UPREIT Conversion</span>
              <span className="text-sm font-medium text-indigo-600">Exchange DST interest for OP units</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Tax Treatment</span>
              <span className="text-sm font-medium text-green-600">Tax-deferred (Section 721)</span>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Key Advantages</h4>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                <span className="text-xs text-indigo-800"><span className="font-semibold">Liquidity:</span> OP units can eventually convert to publicly traded REIT shares</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                <span className="text-xs text-indigo-800"><span className="font-semibold">Diversification:</span> Exposure to a large, diversified real estate portfolio</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                <span className="text-xs text-indigo-800"><span className="font-semibold">Professional Management:</span> Institutional-grade asset and portfolio management</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">REIT Income Projection</h4>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">OP Units Value</span>
              <span className="num font-medium">{formatCurrency(netExitProceeds)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Typical REIT Dividend Yield</span>
              <span className="num font-medium">4.0%</span>
            </div>
            <div className="flex justify-between py-2.5 bg-green-50 rounded-lg px-3">
              <span className="font-semibold">Annual REIT Dividend Estimate</span>
              <span className="num font-bold text-green-600">{formatCurrency(netExitProceeds * 0.04)}</span>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estate Planning Benefit</h4>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <span className="text-xs text-green-800"><span className="font-semibold">Step-Up in Basis at Death:</span> Heirs receive stepped-up basis, eliminating all deferred capital gains and depreciation recapture</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Timeline
            </h4>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Typical Lock-Up Period</span>
              <span className="num font-medium text-amber-600">2 years</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Conversion to REIT Shares</span>
              <span className="text-sm font-medium">After lock-up expiration</span>
            </div>
            <p className="text-xs text-muted-foreground italic pt-1">OP unit holders typically face a 2-year lock-up period before units can be redeemed or converted to publicly traded REIT shares. Conversion ratios and timing may vary by REIT.</p>
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
  const [amortizationPeriod, setAmortizationPeriod] = useState<string>("30");
  const [useVariableRate, setUseVariableRate] = useState(false);
  const [rateAdjustment, setRateAdjustment] = useState<string>("2");
  const [adjustmentYear, setAdjustmentYear] = useState<string>("5");
  const [noteDiscount, setNoteDiscount] = useState<string>("15");
  const [noteSaleYear, setNoteSaleYear] = useState<string>("3");

  const salePrice = masterInputs.salePrice;
  const downPayment = salePrice * (parseFloat(downPaymentPercent) / 100 || 0);
  const loanAmount = salePrice - downPayment;
  const annualRate = parseFloat(interestRate) / 100 || 0;
  const monthlyRate = annualRate / 12;
  const termYears = parseFloat(term) || 0;
  const months = termYears * 12;
  const balloonYr = Math.min(parseFloat(balloonYear) || 5, termYears);
  const amortPeriodYears = parseFloat(amortizationPeriod) || 30;
  const amortMonths = amortPeriodYears * 12;
  const hasExtendedAmort = amortPeriodYears > termYears && !hasBalloon;

  let monthlyPayment: number;
  let totalPayments: number;
  let totalInterest: number;
  let totalCashReceived: number;
  let amortBalloonBalance = 0;

  if (hasBalloon && balloonYr > 0 && balloonYr < termYears) {
    const interestOnlyMonthly = loanAmount * monthlyRate;
    const balloonMonths = balloonYr * 12;
    totalPayments = interestOnlyMonthly * balloonMonths + loanAmount;
    totalInterest = interestOnlyMonthly * balloonMonths;
    monthlyPayment = interestOnlyMonthly;
    totalCashReceived = downPayment + totalPayments;
  } else if (hasExtendedAmort) {
    monthlyPayment = monthlyRate > 0 && amortMonths > 0 ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths)) / (Math.pow(1 + monthlyRate, amortMonths) - 1) : 0;
    let bal = loanAmount;
    for (let m = 0; m < months; m++) {
      const mInterest = bal * monthlyRate;
      const mPrincipal = monthlyPayment - mInterest;
      bal = Math.max(0, bal - mPrincipal);
    }
    amortBalloonBalance = bal;
    totalPayments = monthlyPayment * months + amortBalloonBalance;
    totalInterest = totalPayments - loanAmount;
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

  const adjYear = Math.min(parseFloat(adjustmentYear) || 5, termYears);
  const adjRate = (parseFloat(interestRate) + parseFloat(rateAdjustment)) / 100 || 0;
  const adjMonthlyRate = adjRate / 12;
  let variableTotalInterest = 0;
  if (useVariableRate && termYears > 0) {
    let bal = loanAmount;
    const fixedPayment = monthlyRate > 0 && months > 0 ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1) : 0;
    for (let m = 1; m <= months; m++) {
      const yr = Math.ceil(m / 12);
      const curRate = yr <= adjYear ? monthlyRate : adjMonthlyRate;
      const mInt = bal * curRate;
      const mPrin = fixedPayment - mInt;
      variableTotalInterest += mInt;
      bal = Math.max(0, bal - mPrin);
    }
  }
  const variableInterestDiff = variableTotalInterest - totalInterest;

  const noteSaleYr = Math.min(parseFloat(noteSaleYear) || 3, termYears);
  const noteDiscPct = parseFloat(noteDiscount) / 100 || 0;
  let noteOutstandingBalance = loanAmount;
  let notePmtsReceived = 0;
  {
    let bal = loanAmount;
    for (let m = 1; m <= noteSaleYr * 12; m++) {
      const mInt = bal * monthlyRate;
      const mPrin = monthlyPayment - mInt;
      bal = Math.max(0, bal - mPrin);
    }
    noteOutstandingBalance = bal;
    notePmtsReceived = monthlyPayment * 12 * noteSaleYr;
  }
  const remainingMonths = months - noteSaleYr * 12;
  let noteFaceValue = noteOutstandingBalance;
  for (let m = 1; m <= remainingMonths; m++) {
    noteFaceValue += (noteOutstandingBalance * monthlyRate);
  }
  noteFaceValue = noteOutstandingBalance;
  let pvRemainingPayments = 0;
  {
    let bal = noteOutstandingBalance;
    for (let m = 1; m <= remainingMonths; m++) {
      const mInt = bal * monthlyRate;
      const mPrin = monthlyPayment - mInt;
      pvRemainingPayments += monthlyPayment;
      bal = Math.max(0, bal - mPrin);
    }
    if (hasExtendedAmort) {
      pvRemainingPayments += amortBalloonBalance;
    }
  }
  const noteSaleProceeds = noteOutstandingBalance * (1 - noteDiscPct);
  const totalReceivedWithNoteSale = downPayment + notePmtsReceived + noteSaleProceeds;
  const noteSaleVsCash = totalReceivedWithNoteSale - baseline.netCashProceeds;

  const investorCost = noteSaleProceeds;
  const investorCashFlows: number[] = [-investorCost];
  {
    let bal = noteOutstandingBalance;
    for (let y = 1; y <= Math.ceil(remainingMonths / 12); y++) {
      let yearCF = 0;
      for (let m = 1; m <= 12 && ((y - 1) * 12 + m) <= remainingMonths; m++) {
        yearCF += monthlyPayment;
        const mInt = bal * monthlyRate;
        const mPrin = monthlyPayment - mInt;
        bal = Math.max(0, bal - mPrin);
      }
      if (y === Math.ceil(remainingMonths / 12) && hasExtendedAmort) {
        yearCF += amortBalloonBalance;
      }
      investorCashFlows.push(yearCF);
    }
  }
  let investorYield = 0;
  if (investorCashFlows.length > 1 && investorCost > 0) {
    let lo = -0.5, hi = 2.0;
    for (let iter = 0; iter < 100; iter++) {
      const mid = (lo + hi) / 2;
      let npvCalc = 0;
      for (let i = 0; i < investorCashFlows.length; i++) {
        npvCalc += investorCashFlows[i] / Math.pow(1 + mid, i);
      }
      if (npvCalc > 0) lo = mid; else hi = mid;
    }
    investorYield = ((lo + hi) / 2) * 100;
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
                <Label className="text-xs">Amortization (Years)</Label>
                <Input type="number" value={amortizationPeriod} onChange={(e) => setAmortizationPeriod(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Discount Rate (NPV)</Label>
                <PercentInput value={discountRate} onChange={setDiscountRate} />
              </div>
              {hasExtendedAmort && (
                <div className="col-span-2">
                  <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>Monthly payment based on {amortizationPeriod}-year amortization with {term}-year balloon ({formatCurrency(amortBalloonBalance)} due at term end)</span>
                  </div>
                </div>
              )}
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
              {hasExtendedAmort && (
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Balloon Due at Term End (Year {term})</span>
                  <span className="num font-medium text-amber-600">{formatCurrency(amortBalloonBalance)}</span>
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

            <div className="border-t pt-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useVariableRate}
                  onChange={(e) => setUseVariableRate(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Variable Rate Scenario</span>
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </label>
              {useVariableRate && (
                <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Rate Adjustment (+/- %)</Label>
                      <Input
                        type="number"
                        value={rateAdjustment}
                        onChange={(e) => setRateAdjustment(e.target.value)}
                        step="0.25"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Adjustment Year</Label>
                      <Input
                        type="number"
                        value={adjustmentYear}
                        onChange={(e) => setAdjustmentYear(e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-amber-700 space-y-1">
                    <p>Rate changes from {interestRate}% to {(parseFloat(interestRate) + parseFloat(rateAdjustment)).toFixed(2)}% in year {adjustmentYear}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-amber-200">
                      <span className="text-muted-foreground text-sm">Total Interest (Fixed Rate)</span>
                      <span className="num font-medium">{formatCurrency(totalInterest)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-amber-200">
                      <span className="text-muted-foreground text-sm">Total Interest (Variable Rate)</span>
                      <span className="num font-medium">{formatCurrency(variableTotalInterest)}</span>
                    </div>
                    <div className="flex justify-between py-2 rounded-lg px-2" style={{ backgroundColor: variableInterestDiff >= 0 ? 'rgb(254 242 242)' : 'rgb(240 253 244)' }}>
                      <span className="font-semibold text-sm">Interest Difference</span>
                      <span className={`num font-semibold ${variableInterestDiff >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {variableInterestDiff >= 0 ? '+' : ''}{formatCurrency(variableInterestDiff)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-indigo-500" />
            Note Sale Analysis
          </CardTitle>
          <CardDescription>Value of selling the promissory note to an investor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Note Sale Year</Label>
              <Input
                type="number"
                value={noteSaleYear}
                onChange={(e) => setNoteSaleYear(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Investor Discount (%)</Label>
              <PercentInput value={noteDiscount} onChange={setNoteDiscount} />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note Valuation</h4>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Outstanding Balance at Year {noteSaleYear}</span>
              <span className="num font-medium">{formatCurrency(noteOutstandingBalance)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Note Face Value (Remaining Balance)</span>
              <span className="num font-medium">{formatCurrency(noteOutstandingBalance)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Investor Discount</span>
              <span className="num font-medium text-red-600">-{noteDiscount}%</span>
            </div>
            <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
              <span className="font-semibold text-sm">Cash Proceeds from Note Sale</span>
              <span className="num font-semibold text-green-600">{formatCurrency(noteSaleProceeds)}</span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Proceeds Summary</h4>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Down Payment Received</span>
              <span className="num font-medium">{formatCurrency(downPayment)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Payments Received (Years 1-{noteSaleYear})</span>
              <span className="num font-medium">{formatCurrency(notePmtsReceived)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Note Sale Proceeds</span>
              <span className="num font-medium">{formatCurrency(noteSaleProceeds)}</span>
            </div>
            <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
              <span className="font-semibold text-sm">Total Received</span>
              <span className="num font-semibold">{formatCurrency(totalReceivedWithNoteSale)}</span>
            </div>
            <div className="flex justify-between py-2.5 rounded-lg px-3" style={{ backgroundColor: noteSaleVsCash >= 0 ? 'rgb(240 253 244)' : 'rgb(254 242 242)' }}>
              <span className="font-semibold">vs Cash Sale Net Proceeds</span>
              <span className={`num font-bold ${noteSaleVsCash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {noteSaleVsCash >= 0 ? '+' : ''}{formatCurrency(noteSaleVsCash)}
              </span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Investor Analysis</h4>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Investor Purchase Price</span>
              <span className="num font-medium">{formatCurrency(noteSaleProceeds)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Remaining Term</span>
              <span className="num font-medium">{(remainingMonths / 12).toFixed(1)} years</span>
            </div>
            <div className="flex justify-between py-2 bg-indigo-50 rounded px-2">
              <span className="font-semibold text-sm">Effective Yield to Investor (IRR)</span>
              <span className="num font-semibold text-indigo-600">{investorYield.toFixed(2)}%</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-800">
              Note buyers typically require 10-20% discounts for seller-financed commercial real estate notes. Higher discounts reflect greater perceived risk (buyer creditworthiness, property condition, note seasoning).
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
  const [useTiers, setUseTiers] = useState(false);
  const [tiers, setTiers] = useState<Array<{
    label: string;
    threshold: string;
    payoutPercent: string;
    probability: string;
  }>>([
    { label: "Threshold", threshold: "70", payoutPercent: "50", probability: "80" },
    { label: "Target", threshold: "100", payoutPercent: "100", probability: "60" },
    { label: "Stretch", threshold: "130", payoutPercent: "150", probability: "25" },
  ]);
  const [hasClawback, setHasClawback] = useState(false);
  const [clawbackPercent, setClawbackPercent] = useState<string>("25");
  const [indemnityCapPercent, setIndemnityCapPercent] = useState<string>("50");
  const [survivalPeriod, setSurvivalPeriod] = useState<string>("18");

  const updateTier = (index: number, field: string, value: string) => {
    setTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

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

  const tieredWeightedPayout = tiers.reduce((sum, t) => {
    return sum + maxEarnout * (parseFloat(t.payoutPercent) / 100 || 0) * (parseFloat(t.probability) / 100 || 0);
  }, 0);

  const clawbackExposure = expectedEarnout * (parseFloat(clawbackPercent) / 100 || 0);
  const indemnityCapAmount = (base + expectedEarnout) * (parseFloat(indemnityCapPercent) / 100 || 0);
  const netAtRisk = Math.min(clawbackExposure, indemnityCapAmount);
  const riskAdjustedNetEarnout = expectedEarnout - netAtRisk;

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

            <div className="border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useTiers}
                  onChange={(e) => setUseTiers(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Use Milestone Tiers</span>
                <Target className="h-4 w-4 text-indigo-500" />
              </label>
            </div>

            {useTiers && (
              <div className="border rounded-lg p-4 space-y-3 bg-indigo-50/30">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Milestone Tiers
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-left font-semibold text-xs">Tier</th>
                        <th className="p-2 text-center font-semibold text-xs">Achievement %</th>
                        <th className="p-2 text-center font-semibold text-xs">Payout %</th>
                        <th className="p-2 text-center font-semibold text-xs">Probability %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2 text-sm font-medium">{tier.label}</td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={tier.threshold}
                              onChange={(e) => updateTier(idx, 'threshold', e.target.value)}
                              className="h-7 text-xs text-center w-20 mx-auto"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={tier.payoutPercent}
                              onChange={(e) => updateTier(idx, 'payoutPercent', e.target.value)}
                              className="h-7 text-xs text-center w-20 mx-auto"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={tier.probability}
                              onChange={(e) => updateTier(idx, 'probability', e.target.value)}
                              className="h-7 text-xs text-center w-20 mx-auto"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Tiered Weighted Expected Payout</span>
                    <span className="num font-semibold text-indigo-600">{formatCurrency(tieredWeightedPayout)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground text-sm">Simple Expected Value ({(prob * 100).toFixed(0)}%)</span>
                    <span className="num font-medium">{formatCurrency(expectedEarnout)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-muted/50 rounded px-2">
                    <span className="font-semibold text-sm">Difference</span>
                    <span className={`num font-semibold ${tieredWeightedPayout >= expectedEarnout ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(tieredWeightedPayout - expectedEarnout)}
                    </span>
                  </div>
                </div>
              </div>
            )}

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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payout Probability Spectrum</h4>
              {useTiers ? (() => {
                const thresholdProb = parseFloat(tiers[0]?.probability) || 0;
                const targetProb = parseFloat(tiers[1]?.probability) || 0;
                const stretchProb = parseFloat(tiers[2]?.probability) || 0;
                const missProb = 100 - thresholdProb;
                const thresholdOnlyProb = thresholdProb - targetProb;
                const targetOnlyProb = targetProb - stretchProb;
                const blueSkyProb = 5;
                const thresholdPayout = maxEarnout * (parseFloat(tiers[0]?.payoutPercent) / 100 || 0);
                const targetPayout = maxEarnout * (parseFloat(tiers[1]?.payoutPercent) / 100 || 0);
                const stretchPayout = maxEarnout * (parseFloat(tiers[2]?.payoutPercent) / 100 || 0);
                const outcomes = [
                  { label: "$0 (miss all targets)", amount: 0, prob: missProb, color: "#ef4444" },
                  { label: `${formatCurrency(thresholdPayout)} (threshold)`, amount: thresholdPayout, prob: thresholdOnlyProb, color: "#f59e0b" },
                  { label: `${formatCurrency(targetPayout)} (target)`, amount: targetPayout, prob: targetOnlyProb, color: "#3b82f6" },
                  { label: `${formatCurrency(stretchPayout)} (stretch)`, amount: stretchPayout, prob: stretchProb, color: "#10b981" },
                  { label: `${formatCurrency(maxEarnout)} (max earnout)`, amount: maxEarnout, prob: blueSkyProb, color: "#6366f1" },
                ];
                const maxProb = Math.max(...outcomes.map(o => Math.abs(o.prob)), 1);
                return (
                  <div className="space-y-2">
                    {outcomes.map((o, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{o.label}</span>
                          <span className="font-medium">{o.prob.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center justify-end pr-1"
                            style={{ width: `${Math.max((Math.abs(o.prob) / maxProb) * 100, 2)}%`, backgroundColor: o.color }}
                          >
                            <span className="text-white text-[10px] font-medium">{o.prob.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })() : (() => {
                const missProb = (1 - prob) * 100;
                const expectedProb = prob * 100;
                const blueSkyProb = 5;
                const outcomes = [
                  { label: `$0 (miss)`, prob: missProb, color: "#ef4444" },
                  { label: `${formatCurrency(expectedEarnout)} (expected)`, prob: expectedProb, color: "#3b82f6" },
                  { label: `${formatCurrency(maxEarnout)} (max upside)`, prob: blueSkyProb, color: "#6366f1" },
                ];
                const maxP = Math.max(...outcomes.map(o => o.prob), 1);
                return (
                  <div className="space-y-2">
                    {outcomes.map((o, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{o.label}</span>
                          <span className="font-medium">{o.prob.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full rounded-full flex items-center justify-end pr-1"
                            style={{ width: `${Math.max((o.prob / maxP) * 100, 2)}%`, backgroundColor: o.color }}
                          >
                            <span className="text-white text-[10px] font-medium">{o.prob.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
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

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                Clawback & Indemnity Provisions
              </h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasClawback}
                  onChange={(e) => setHasClawback(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Include Clawback Provision</span>
              </label>
              {hasClawback && (
                <div className="border rounded-lg p-4 space-y-3 bg-red-50/30">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Clawback %</Label>
                      <PercentInput value={clawbackPercent} onChange={setClawbackPercent} />
                      <span className="text-[10px] text-muted-foreground">% of earnout subject to clawback</span>
                    </div>
                    <div>
                      <Label className="text-xs">Indemnity Cap %</Label>
                      <PercentInput value={indemnityCapPercent} onChange={setIndemnityCapPercent} />
                      <span className="text-[10px] text-muted-foreground">Max % of total consideration</span>
                    </div>
                    <div>
                      <Label className="text-xs">Survival Period (months)</Label>
                      <Input
                        type="number"
                        value={survivalPeriod}
                        onChange={(e) => setSurvivalPeriod(e.target.value)}
                      />
                      <span className="text-[10px] text-muted-foreground">Reps/warranties survive closing</span>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground text-sm">Clawback Exposure</span>
                      <span className="num font-medium text-red-600">{formatCurrency(clawbackExposure)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground text-sm">Indemnity Cap Amount</span>
                      <span className="num font-medium text-red-600">{formatCurrency(indemnityCapAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground text-sm">Net At-Risk Amount</span>
                      <span className="num font-semibold text-red-600">{formatCurrency(netAtRisk)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground text-sm">Survival Period</span>
                      <span className="num font-medium">{survivalPeriod} months</span>
                    </div>
                    <div className="flex justify-between py-2 bg-muted/50 rounded px-2">
                      <span className="font-semibold text-sm">Risk-Adjusted Net Earnout</span>
                      <span className={`num font-semibold ${riskAdjustedNetEarnout >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(riskAdjustedNetEarnout)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
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
  const [useMultiTier, setUseMultiTier] = useState(false);
  const [promoteTiers, setPromoteTiers] = useState<Array<{
    returnHurdle: string;
    carryRate: string;
  }>>([
    { returnHurdle: "8", carryRate: "20" },
    { returnHurdle: "15", carryRate: "30" },
    { returnHurdle: "20", carryRate: "40" },
  ]);
  const [waterfallType, setWaterfallType] = useState<'american' | 'european'>('american');

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

  let gpCatchup = 0;
  let afterCatchup = 0;
  let gpCarry = 0;
  let lpProfit = 0;
  let tierBreakdown: Array<{ label: string; hurdlePct: number; carryPct: number; profit: number; gpShare: number; lpShare: number }> = [];
  let blendedCarryRate = 0;

  if (useMultiTier && promoteTiers.length > 0) {
    const remaining = Math.max(0, afterPrefAndReturn);
    let allocated = 0;
    let totalGpFromTiers = 0;
    let totalLpFromTiers = 0;

    for (let i = 0; i < promoteTiers.length; i++) {
      const hurdle = parseFloat(promoteTiers[i].returnHurdle) / 100 || 0;
      const carry = parseFloat(promoteTiers[i].carryRate) / 100 || 0;
      const prevHurdle = i > 0 ? (parseFloat(promoteTiers[i - 1].returnHurdle) / 100 || 0) : 0;

      const tierCeiling = totalCapital * hurdle;
      const prevCeiling = totalCapital * prevHurdle;
      const tierSize = tierCeiling - prevCeiling;

      const isLastTier = i === promoteTiers.length - 1;
      const availableForTier = remaining - allocated;

      let tierProfit: number;
      if (isLastTier) {
        tierProfit = Math.max(0, availableForTier);
      } else {
        tierProfit = Math.max(0, Math.min(tierSize, availableForTier));
      }

      const gpShare = tierProfit * carry;
      const lpShare = tierProfit - gpShare;

      tierBreakdown.push({
        label: isLastTier ? `Above ${(prevHurdle * 100).toFixed(0)}% MOIC` : `${(prevHurdle * 100).toFixed(0)}%–${(hurdle * 100).toFixed(0)}% MOIC`,
        hurdlePct: hurdle * 100,
        carryPct: carry * 100,
        profit: tierProfit,
        gpShare,
        lpShare,
      });

      totalGpFromTiers += gpShare;
      totalLpFromTiers += lpShare;
      allocated += tierProfit;
    }

    gpCarry = totalGpFromTiers;
    lpProfit = totalLpFromTiers;
    gpCatchup = 0;
    afterCatchup = remaining;
    blendedCarryRate = remaining > 0 ? (totalGpFromTiers / remaining) * 100 : 0;
  } else {
    gpCatchup = gpCap > 0 ? Math.min(Math.max(0, afterPrefAndReturn), lpPref * (carryRate / (1 - carryRate))) : 0;
    afterCatchup = Math.max(0, afterPrefAndReturn - gpCatchup);
    gpCarry = afterCatchup > 0 ? afterCatchup * carryRate : 0;
    lpProfit = afterCatchup > 0 ? afterCatchup - gpCarry : 0;
  }

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

  const gpEscrowAmount = gpCatchup + gpCarry;
  const lpReleaseCondition = lpCap + lpPref;

  const addTier = () => {
    if (promoteTiers.length < 5) {
      const lastHurdle = parseFloat(promoteTiers[promoteTiers.length - 1]?.returnHurdle || "20") + 10;
      setPromoteTiers([...promoteTiers, { returnHurdle: lastHurdle.toString(), carryRate: "50" }]);
    }
  };

  const removeTier = (index: number) => {
    if (promoteTiers.length > 1) {
      setPromoteTiers(promoteTiers.filter((_, i) => i !== index));
    }
  };

  const updateTier = (index: number, field: 'returnHurdle' | 'carryRate', value: string) => {
    setPromoteTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

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
              {!useMultiTier && (
                <div>
                  <Label className="text-xs">Carried Interest</Label>
                  <PercentInput value={carriedInterest} onChange={setCarriedInterest} />
                </div>
              )}
              <div>
                <Label className="text-xs">Management Fee (%)</Label>
                <PercentInput value={managementFee} onChange={setManagementFee} />
              </div>
            </div>

            <div className="flex items-center gap-2 py-2 border-t border-b">
              <input
                type="checkbox"
                id="multi-tier-toggle"
                checked={useMultiTier}
                onChange={(e) => setUseMultiTier(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="multi-tier-toggle" className="text-xs font-medium cursor-pointer">Multi-Tier Promote</Label>
            </div>

            {useMultiTier && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-1.5 text-left text-xs font-semibold text-muted-foreground">Tier</th>
                        <th className="p-1.5 text-left text-xs font-semibold text-muted-foreground">Return Hurdle %</th>
                        <th className="p-1.5 text-left text-xs font-semibold text-muted-foreground">GP Carry %</th>
                        <th className="p-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {promoteTiers.map((tier, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-1.5 text-xs font-medium text-muted-foreground">Tier {i + 1}</td>
                          <td className="p-1.5">
                            <Input
                              type="number"
                              value={tier.returnHurdle}
                              onChange={(e) => updateTier(i, 'returnHurdle', e.target.value)}
                              className="h-7 text-xs w-20"
                              step="1"
                            />
                          </td>
                          <td className="p-1.5">
                            <Input
                              type="number"
                              value={tier.carryRate}
                              onChange={(e) => updateTier(i, 'carryRate', e.target.value)}
                              className="h-7 text-xs w-20"
                              step="1"
                            />
                          </td>
                          <td className="p-1.5">
                            {promoteTiers.length > 1 && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeTier(i)}>
                                <Minus className="h-3 w-3 text-red-500" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {promoteTiers.length < 5 && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addTier}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Tier
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2 py-2 border-t">
              <Label className="text-xs font-semibold">Waterfall Structure</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={waterfallType === 'american'}
                    onChange={() => setWaterfallType('american')}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium">American (Deal-by-Deal)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    checked={waterfallType === 'european'}
                    onChange={() => setWaterfallType('european')}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs font-medium">European (Fund-Level)</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground italic">
                {waterfallType === 'american'
                  ? "GP receive carry on each deal as distributions occur. More GP-friendly."
                  : "GP receives carry only after all LP capital + preferred return is returned across the entire fund. More LP-friendly."}
              </p>
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

            {useMultiTier ? (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 3: Multi-Tier Profit Split</h4>
                {tierBreakdown.map((tier, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between py-1 bg-muted/20 rounded px-2">
                      <span className="text-xs font-semibold text-muted-foreground">Tier {i + 1}: {tier.label} — GP {tier.carryPct.toFixed(0)}%</span>
                      <span className="num text-xs font-medium">{formatCurrency(tier.profit)}</span>
                    </div>
                    <div className="flex justify-between py-1 pl-4 border-b">
                      <span className="text-muted-foreground text-xs">GP Share ({tier.carryPct.toFixed(0)}%)</span>
                      <span className="num text-xs font-medium">{formatCurrency(tier.gpShare)}</span>
                    </div>
                    <div className="flex justify-between py-1 pl-4 border-b">
                      <span className="text-muted-foreground text-xs">LP Share ({(100 - tier.carryPct).toFixed(0)}%)</span>
                      <span className="num text-xs font-medium text-green-600">{formatCurrency(tier.lpShare)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between py-2 bg-cyan-50 rounded-lg px-3 mt-2">
                  <span className="font-semibold text-sm">GP Weighted Blended Carry</span>
                  <span className="num font-bold text-cyan-600">{blendedCarryRate.toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}

            {waterfallType === 'european' && (
              <div className="space-y-3 border-t pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  European Waterfall — Escrow
                </h4>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-amber-800">GP Escrow Amount</span>
                    <span className="num font-semibold text-amber-700">{formatCurrency(gpEscrowAmount)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-amber-800">Release Condition</span>
                    <span className="text-xs font-medium text-amber-700">LP receives {formatCurrency(lpReleaseCondition)}</span>
                  </div>
                  <p className="text-xs text-amber-700 italic">GP carry held in escrow until full LP pref + capital is returned.</p>
                  <p className="text-xs text-amber-700 italic">Clawback risk is lower in European waterfalls.</p>
                  <p className="text-xs text-amber-600 mt-1">GP receives carry later, potentially years after distributions begin.</p>
                </div>
              </div>
            )}

            {waterfallType === 'american' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <p className="text-xs text-green-700">No escrow — GP receives carry as each deal distributes.</p>
              </div>
            )}

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-indigo-500" />
            American vs European Waterfall Comparison
          </CardTitle>
          <CardDescription>Key differences between waterfall structures</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-semibold">Feature</th>
                  <th className={`p-2 text-center font-semibold ${waterfallType === 'american' ? 'bg-cyan-50' : ''}`}>American</th>
                  <th className={`p-2 text-center font-semibold ${waterfallType === 'european' ? 'bg-cyan-50' : ''}`}>European</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground">GP Carry Timing</td>
                  <td className={`p-2 text-center ${waterfallType === 'american' ? 'bg-cyan-50 font-medium' : ''}`}>Immediate per deal</td>
                  <td className={`p-2 text-center ${waterfallType === 'european' ? 'bg-cyan-50 font-medium' : ''}`}>After full LP return</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground">GP Cash Flow</td>
                  <td className={`p-2 text-center ${waterfallType === 'american' ? 'bg-cyan-50 font-medium' : ''}`}>Earlier</td>
                  <td className={`p-2 text-center ${waterfallType === 'european' ? 'bg-cyan-50 font-medium' : ''}`}>Later</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground">LP Protection</td>
                  <td className={`p-2 text-center ${waterfallType === 'american' ? 'bg-cyan-50 font-medium' : ''}`}>Lower (clawback)</td>
                  <td className={`p-2 text-center ${waterfallType === 'european' ? 'bg-cyan-50 font-medium' : ''}`}>Higher (escrow)</td>
                </tr>
                <tr className="border-b">
                  <td className="p-2 text-muted-foreground">Common For</td>
                  <td className={`p-2 text-center ${waterfallType === 'american' ? 'bg-cyan-50 font-medium' : ''}`}>Real Estate JVs</td>
                  <td className={`p-2 text-center ${waterfallType === 'european' ? 'bg-cyan-50 font-medium' : ''}`}>PE Funds</td>
                </tr>
              </tbody>
            </table>
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
  const [useMonthly, setUseMonthly] = useState(false);
  const [annualDebtService, setAnnualDebtService] = useState<string>("0");

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

  const discountRateValue = parseFloat(discountRate) || 10;
  const reinvestmentRate = discountRateValue;
  const financeRate = masterInputs.currentDebtBalance > 0 ? 5 : discountRateValue;

  const calculateMIRR = (flows: number[], reinvRate: number, finRate: number, n: number) => {
    const reinvDecimal = reinvRate / 100;
    const finDecimal = finRate / 100;
    let fvPositive = 0;
    let pvNegative = 0;
    for (let t = 0; t < flows.length; t++) {
      if (flows[t] >= 0) {
        fvPositive += flows[t] * Math.pow(1 + reinvDecimal, n - t);
      } else {
        pvNegative += Math.abs(flows[t]) / Math.pow(1 + finDecimal, t);
      }
    }
    if (pvNegative === 0 || fvPositive === 0 || n === 0) return 0;
    return (Math.pow(fvPositive / pvNegative, 1 / n) - 1) * 100;
  };

  const mirr = calculateMIRR(activeFlows, reinvestmentRate, financeRate, yearCount);

  const calculateMonthlyIRR = (flows: number[]) => {
    const monthlyFlows: number[] = [];
    for (let i = 0; i < flows.length; i++) {
      if (i === 0) {
        monthlyFlows.push(flows[i]);
        for (let m = 1; m < 12; m++) monthlyFlows.push(0);
      } else {
        const monthlyCF = flows[i] / 12;
        for (let m = 0; m < 12; m++) monthlyFlows.push(monthlyCF);
      }
    }
    let rate = 0.01;
    for (let iter = 0; iter < 200; iter++) {
      let npvCalc = 0;
      let npvDeriv = 0;
      for (let t = 0; t < monthlyFlows.length; t++) {
        npvCalc += monthlyFlows[t] / Math.pow(1 + rate, t);
        npvDeriv -= t * monthlyFlows[t] / Math.pow(1 + rate, t + 1);
      }
      if (Math.abs(npvCalc) < 0.001) break;
      if (npvDeriv !== 0) rate = rate - npvCalc / npvDeriv;
      else break;
    }
    const annualizedIRR = (Math.pow(1 + rate, 12) - 1) * 100;
    return annualizedIRR;
  };

  const displayIRR = useMonthly ? calculateMonthlyIRR(activeFlows) : irr;
  const displayUnleveredIRR = useMonthly ? calculateMonthlyIRR(unleveredFlows) : unleveredIRR;
  const displayLeveredIRR = useMonthly ? calculateMonthlyIRR(leveredFlows) : leveredIRR;
  const displayAfterTaxIRR = useMonthly ? calculateMonthlyIRR(afterTaxFlows) : afterTaxIRR;

  const parsedDebtService = parseFloat(annualDebtService) || 0;
  const dscrByYear = parsedCFs.map(cf => parsedDebtService > 0 ? cf / parsedDebtService : 0);
  const avgDSCR = parsedDebtService > 0 ? dscrByYear.reduce((a, b) => a + b, 0) / dscrByYear.length : 0;
  const minDSCR = parsedDebtService > 0 ? Math.min(...dscrByYear) : 0;
  const minDSCRYear = parsedDebtService > 0 ? dscrByYear.indexOf(minDSCR) + 1 : 0;

  const getDSCRColor = (dscr: number) => {
    if (dscr < 1.0) return 'text-red-600';
    if (dscr < 1.25) return 'text-amber-600';
    return 'text-green-600';
  };

  const getDSCRBadge = (dscr: number) => {
    if (dscr < 1.0) return { label: 'Below Coverage', className: 'bg-red-100 text-red-700' };
    if (dscr < 1.25) return { label: 'Tight', className: 'bg-amber-100 text-amber-700' };
    return { label: 'Healthy', className: 'bg-green-100 text-green-700' };
  };

  const meetsTargetDisplay = displayIRR >= target;

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
              <div>
                <Label className="text-xs">Annual Debt Service</Label>
                <CurrencyInput value={annualDebtService} onChange={setAnnualDebtService} />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-2 border-t">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMonthly}
                  onChange={(e) => setUseMonthly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Monthly Granularity</span>
              </label>
              {useMonthly && (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>Monthly granularity calculates IRR using monthly intervals (annual CFs distributed across 12 months). Annualized result shown.</span>
                </div>
              )}
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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Core Returns{useMonthly ? ' (Monthly Compounding)' : ''}
              </h4>
              <div className={`flex justify-between py-2.5 rounded-lg px-3 ${showLevered ? 'bg-emerald-50' : 'bg-muted/30'}`}>
                <span className="font-semibold">Levered IRR</span>
                <span className={`num font-bold ${displayLeveredIRR >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{isFinite(displayLeveredIRR) ? displayLeveredIRR.toFixed(2) : '—'}%</span>
              </div>
              <div className={`flex justify-between py-2.5 rounded-lg px-3 ${!showLevered ? 'bg-emerald-50' : 'bg-muted/30'}`}>
                <span className="font-semibold">Unlevered IRR</span>
                <span className={`num font-bold ${displayUnleveredIRR >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{isFinite(displayUnleveredIRR) ? displayUnleveredIRR.toFixed(2) : '—'}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">After-Tax IRR (est.)</span>
                <span className={`num font-medium ${displayAfterTaxIRR >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{isFinite(displayAfterTaxIRR) ? displayAfterTaxIRR.toFixed(2) : '—'}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground text-sm">MIRR ({reinvestmentRate}% reinvest)</span>
                <span className={`num font-medium ${mirr >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{isFinite(mirr) ? mirr.toFixed(2) : '—'}%</span>
              </div>
              <p className="text-xs text-muted-foreground italic">MIRR uses a reinvestment rate assumption, making it more conservative than standard IRR for projects with interim cash flows.</p>
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

            {parsedDebtService > 0 && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debt Service Coverage</h4>
                {dscrByYear.map((dscr, i) => {
                  const badge = getDSCRBadge(dscr);
                  return (
                    <div key={i} className="flex justify-between py-1.5 border-b">
                      <span className="text-muted-foreground text-sm">Year {i + 1} DSCR</span>
                      <span className="flex items-center gap-2">
                        <span className={`num font-medium ${getDSCRColor(dscr)}`}>{dscr.toFixed(2)}x</span>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </span>
                    </div>
                  );
                })}
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Average DSCR</span>
                  <span className={`num font-medium ${getDSCRColor(avgDSCR)}`}>{avgDSCR.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between py-1.5 border-b">
                  <span className="text-muted-foreground text-sm">Minimum DSCR (Year {minDSCRYear})</span>
                  <span className={`num font-medium ${getDSCRColor(minDSCR)}`}>{minDSCR.toFixed(2)}x</span>
                </div>
                <p className="text-xs text-muted-foreground italic">Lenders typically require minimum DSCR of 1.20-1.25x for commercial real estate.</p>
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target Return</h4>
              <div className={`flex justify-between py-2.5 rounded-lg px-3 ${meetsTargetDisplay ? 'bg-green-50' : 'bg-red-50'}`}>
                <span className="font-semibold">IRR vs Target ({target}%)</span>
                <span className={`num font-bold ${meetsTargetDisplay ? 'text-green-600' : 'text-red-600'}`}>
                  {meetsTargetDisplay ? 'Exceeds' : 'Below'} by {Math.abs(displayIRR - target).toFixed(1)}pp
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
  const { masterInputs, saveScenario } = useExitStrategiesStore();
  const { toast } = useToast();
  const [baseNOI, setBaseNOI] = useState<string>("500000");
  const [baseCapRate, setBaseCapRate] = useState<string>("6");
  const [scenarioName, setScenarioName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

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

  const grossRevenue = parsedBaseNOI * 1.5;
  const baseVacancyRate = (masterInputs as any).vacancyRate || 5;
  const baseCapExPercent = 5;

  const calcProceedsWithAdjustment = (adjustmentAmount: number) => {
    return baseProceeds - adjustmentAmount;
  };

  const dimensions = [
    {
      name: "Cap Rate",
      lowLabel: "5.0%",
      baseLabel: `${parseFloat(baseCapRate) || 6}%`,
      highLabel: "7.0%",
      lowProceeds: calcScenarioProceeds(parsedBaseNOI / 0.05, masterInputs.federalTaxRate, masterInputs.stateTaxRate),
      baseProceeds: baseProceeds,
      highProceeds: calcScenarioProceeds(parsedBaseNOI / 0.07, masterInputs.federalTaxRate, masterInputs.stateTaxRate),
    },
    {
      name: "Operating Expenses",
      lowLabel: "-10%",
      baseLabel: "Base",
      highLabel: "+10%",
      lowProceeds: calcScenarioProceeds(baseValueCalc * 1.05, masterInputs.federalTaxRate, masterInputs.stateTaxRate),
      baseProceeds: baseProceeds,
      highProceeds: calcScenarioProceeds(baseValueCalc * 0.95, masterInputs.federalTaxRate, masterInputs.stateTaxRate),
    },
    {
      name: "Revenue Growth",
      lowLabel: "-10%",
      baseLabel: "Base",
      highLabel: "+10%",
      lowProceeds: calcScenarioProceeds(worstValue, masterInputs.federalTaxRate, masterInputs.stateTaxRate),
      baseProceeds: baseProceeds,
      highProceeds: calcScenarioProceeds(bestValue, masterInputs.federalTaxRate, masterInputs.stateTaxRate),
    },
    {
      name: "Interest Rate",
      lowLabel: "Current",
      baseLabel: "+5%",
      highLabel: "+10%",
      lowProceeds: calcTaxScenario(masterInputs.federalTaxRate, masterInputs.stateTaxRate).netCashProceeds,
      baseProceeds: calcTaxScenario(masterInputs.federalTaxRate + 5, masterInputs.stateTaxRate + 5).netCashProceeds,
      highProceeds: calcTaxScenario(masterInputs.federalTaxRate + 10, masterInputs.stateTaxRate + 10).netCashProceeds,
    },
    {
      name: "Hold Period",
      lowLabel: "3 Years",
      baseLabel: `${masterInputs.holdingPeriod} Years`,
      highLabel: "10 Years",
      lowProceeds: calcNetProceedsForYear(3).netCashProceeds,
      baseProceeds: calcNetProceedsForYear(masterInputs.holdingPeriod).netCashProceeds,
      highProceeds: calcNetProceedsForYear(10).netCashProceeds,
    },
    {
      name: "Vacancy Rate",
      lowLabel: `${Math.max(0, baseVacancyRate - 2).toFixed(1)}%`,
      baseLabel: `${baseVacancyRate}%`,
      highLabel: `${(baseVacancyRate + 5).toFixed(1)}%`,
      lowProceeds: calcProceedsWithAdjustment(-((2 / 100) * grossRevenue)),
      baseProceeds: baseProceeds,
      highProceeds: calcProceedsWithAdjustment((5 / 100) * grossRevenue),
    },
    {
      name: "Cap Ex (% of Revenue)",
      lowLabel: "3%",
      baseLabel: `${baseCapExPercent}%`,
      highLabel: "10%",
      lowProceeds: calcProceedsWithAdjustment((3 / 100) * grossRevenue - (baseCapExPercent / 100) * grossRevenue),
      baseProceeds: baseProceeds,
      highProceeds: calcProceedsWithAdjustment((10 / 100) * grossRevenue - (baseCapExPercent / 100) * grossRevenue),
    },
  ];

  const sortedByImpact = dimensions.map(d => ({
    ...d,
    impact: Math.abs(d.highProceeds - d.lowProceeds)
  })).sort((a, b) => b.impact - a.impact);

  const maxImpact = sortedByImpact.length > 0 ? sortedByImpact[0].impact : 1;

  const handleSaveScenario = () => {
    const name = scenarioName.trim() || `Sensitivity - ${new Date().toLocaleDateString()}`;
    saveScenario(name);
    toast({
      title: "Scenario Saved",
      description: `"${name}" has been saved successfully.`,
    });
    setScenarioName("");
    setIsSaving(false);
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
          <CardTitle>Multi-Dimension Sensitivity Table</CardTitle>
          <CardDescription>Low / Base / High net proceeds across all sensitivity dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Dimension</th>
                  <th className="p-2 text-center">Low</th>
                  <th className="p-2 text-center">Base</th>
                  <th className="p-2 text-center">High</th>
                  <th className="p-2 text-center">Range</th>
                </tr>
              </thead>
              <tbody>
                {dimensions.map((d, idx) => {
                  const range = Math.abs(d.highProceeds - d.lowProceeds);
                  return (
                    <tr key={idx} className="border-b">
                      <td className="p-2 font-medium">{d.name}</td>
                      <td className="p-2 text-center num text-red-600">{formatCurrency(Math.min(d.lowProceeds, d.highProceeds))}</td>
                      <td className="p-2 text-center num font-semibold">{formatCurrency(d.baseProceeds)}</td>
                      <td className="p-2 text-center num text-green-600">{formatCurrency(Math.max(d.lowProceeds, d.highProceeds))}</td>
                      <td className="p-2 text-center num">{formatCurrency(range)}</td>
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
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-500" />
            Sensitivity Ranking (Tornado)
          </CardTitle>
          <CardDescription>Dimensions ranked by absolute impact on net proceeds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {sortedByImpact.map((d, idx) => {
              const lowVal = Math.min(d.lowProceeds, d.highProceeds);
              const highVal = Math.max(d.lowProceeds, d.highProceeds);
              const downside = d.baseProceeds - lowVal;
              const upside = highVal - d.baseProceeds;
              const maxSide = Math.max(downside, upside, 1);
              const downsideWidth = maxImpact > 0 ? (downside / (maxImpact / 2)) * 100 : 0;
              const upsideWidth = maxImpact > 0 ? (upside / (maxImpact / 2)) * 100 : 0;

              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-36 text-sm font-medium text-right shrink-0 truncate">{d.name}</div>
                  <div className="flex-1 flex items-center">
                    <div className="w-1/2 flex justify-end">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground num">{formatCurrency(lowVal)}</span>
                        <div
                          className="h-6 bg-red-400/80 rounded-l"
                          style={{ width: `${Math.min(downsideWidth, 100)}%`, minWidth: downside > 0 ? '4px' : '0' }}
                        />
                      </div>
                    </div>
                    <div className="w-px h-8 bg-gray-400 shrink-0" />
                    <div className="w-1/2 flex justify-start">
                      <div className="flex items-center gap-1">
                        <div
                          className="h-6 bg-green-500/80 rounded-r"
                          style={{ width: `${Math.min(upsideWidth, 100)}%`, minWidth: upside > 0 ? '4px' : '0' }}
                        />
                        <span className="text-xs text-muted-foreground num">{formatCurrency(highVal)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-400/80 rounded" />
              <span>Downside</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500/80 rounded" />
              <span>Upside</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-px h-3 bg-gray-400" />
              <span>Base Value</span>
            </div>
          </div>

          {sortedByImpact.length > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-sm font-medium text-amber-800">
                Top Risk Factor: {sortedByImpact[0].name}
              </span>
              <span className="text-xs text-amber-600 ml-1">
                (impact range: {formatCurrency(sortedByImpact[0].impact)})
              </span>
            </div>
          )}
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

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk Assessment</h4>
            {(() => {
              const riskLevel = varianceRange > 2000000 ? "High" : varianceRange > 500000 ? "Moderate" : "Low";
              const riskColor = riskLevel === "High" ? "bg-red-100 text-red-700" : riskLevel === "Moderate" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
              return (
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground text-sm">Overall Risk Level</span>
                  <Badge className={riskColor}>{riskLevel}</Badge>
                </div>
              );
            })()}
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Downside Exposure (Base - Worst)</span>
              <span className="num font-medium text-red-600">{formatCurrency(baseProceeds - worstProceeds)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground text-sm">Upside Potential (Best - Base)</span>
              <span className="num font-medium text-green-600">{formatCurrency(bestProceeds - baseProceeds)}</span>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key Findings</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Most impactful factor: <span className="font-medium text-foreground">{sortedByImpact[0]?.name || "N/A"}</span></li>
              <li>Least impactful factor: <span className="font-medium text-foreground">{sortedByImpact[sortedByImpact.length - 1]?.name || "N/A"}</span></li>
              <li>Total variance range across all dimensions: <span className="font-medium text-foreground">{formatCurrency(varianceRange)}</span></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            Save Current Analysis
          </CardTitle>
          <CardDescription>Save the current sensitivity configuration as a named scenario</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSaving ? (
            <div className="flex items-center gap-2">
              <Input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder={`Sensitivity - ${new Date().toLocaleDateString()}`}
                className="h-9 text-sm flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveScenario();
                  if (e.key === "Escape") setIsSaving(false);
                }}
              />
              <Button size="sm" onClick={handleSaveScenario}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsSaving(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => { setScenarioName(`Sensitivity - ${new Date().toLocaleDateString()}`); setIsSaving(true); }}>
              <Save className="h-4 w-4 mr-2" />
              Save Sensitivity Scenario
            </Button>
          )}
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
  const earnoutYears = 3;
  const earnoutDiscRate = 0.10;
  const earnoutExpectedValue = earnoutBasePrice + earnoutContingent * earnoutProb;
  const earnoutGain = earnoutExpectedValue - masterInputs.costBasis;
  const earnoutTax = Math.max(0, earnoutGain) * combinedRate;
  const earnoutExpectedEarnout = earnoutContingent * earnoutProb;
  const earnoutPV = earnoutExpectedEarnout / Math.pow(1 + earnoutDiscRate, earnoutYears);
  const earnoutNPVTotal = earnoutBasePrice + earnoutPV;
  const earnoutNet = earnoutNPVTotal - earnoutTax - masterInputs.currentDebtBalance - masterInputs.closingCosts - salePrice * (masterInputs.brokerFeePercent / 100);

  const dstSponsorFeeRate = 0.10;
  const dstInvestment = baseline.netSaleProceeds - masterInputs.currentDebtBalance;
  const dstDistRate = 0.055;
  const dstApprecRate = 0.03;
  const dstFee = dstInvestment * dstSponsorFeeRate;
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
  const wfCarriedInterest = 0.20;
  const wfLPEquity = wfTotalEquity * wfLPShare;
  const wfPrefReturn = wfLPEquity * wfPrefRate * masterInputs.holdingPeriod;
  const wfExitProceeds = salePrice * Math.pow(1.03, masterInputs.holdingPeriod);
  const wfDistributable = wfExitProceeds - masterInputs.currentDebtBalance;
  const wfLPPref = Math.min(wfDistributable, wfLPEquity + wfPrefReturn);
  const wfRemaining = Math.max(0, wfDistributable - wfLPPref);
  const wfGPCarry = wfRemaining * wfCarriedInterest;
  const wfLPTotal = wfLPPref + wfRemaining * (1 - wfCarriedInterest);
  const wfLPTax = wfLPTotal > wfLPEquity ? (wfLPTotal - wfLPEquity) * combinedRate : 0;

  const strategies = [
    { name: "Cash Sale", netProceeds: cashSaleNet, totalTax: cashSaleTax, effRate: cashSaleEffRate, liquidity: "Immediate", risk: "Low", riskColor: "bg-green-100 text-green-800" },
    { name: "1031 Exchange", netProceeds: netBenefit1031, totalTax: tax1031, effRate: effRate1031, liquidity: "45-180 days", risk: "Medium", riskColor: "bg-yellow-100 text-yellow-800" },
    { name: "DST", netProceeds: dstTotalReturn, totalTax: 0, effRate: 0, liquidity: "7-10 years", risk: "Medium", riskColor: "bg-yellow-100 text-yellow-800" },
    { name: "Seller Financing", netProceeds: sfNPV, totalTax: sfTotalTax, effRate: sfTotalTax > 0 && sfGain > 0 ? (sfTotalTax / sfGain) * 100 : 0, liquidity: "Over 10 years", risk: "Medium-High", riskColor: "bg-orange-100 text-orange-800" },
    { name: "Earnout", netProceeds: earnoutNet, totalTax: earnoutTax, effRate: earnoutGain > 0 ? (earnoutTax / earnoutGain) * 100 : 0, liquidity: "1-3 years", risk: "High", riskColor: "bg-red-100 text-red-800" },
    { name: "Waterfall", netProceeds: wfLPTotal, totalTax: wfLPTax, effRate: wfLPTotal > wfLPEquity ? ((wfLPTax / (wfLPTotal - wfLPEquity)) * 100) : 0, liquidity: "At fund exit", risk: "Medium-High", riskColor: "bg-orange-100 text-orange-800" },
  ];

  const bestStrategy = strategies.reduce((best, s) => s.netProceeds > best.netProceeds ? s : best, strategies[0]);

  const [scoringCriteria, setScoringCriteria] = useState<Array<{
    criterion: string;
    weight: string;
  }>>([
    { criterion: "Net Proceeds", weight: "30" },
    { criterion: "Tax Efficiency", weight: "25" },
    { criterion: "Speed/Simplicity", weight: "15" },
    { criterion: "Risk Level", weight: "15" },
    { criterion: "Flexibility", weight: "15" },
  ]);

  const totalWeight = scoringCriteria.reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);

  const updateWeight = (index: number, value: string) => {
    setScoringCriteria(prev => prev.map((c, i) => i === index ? { ...c, weight: value } : c));
  };

  const strategyKeys = ["Cash Sale", "1031 Exchange", "DST", "Seller Financing", "Earnout", "Waterfall"] as const;

  const taxEfficiencyScores: Record<string, number> = { "Cash Sale": 3, "1031 Exchange": 9, "DST": 8, "Seller Financing": 6, "Earnout": 5, "Waterfall": 4 };
  const speedScores: Record<string, number> = { "Cash Sale": 10, "1031 Exchange": 5, "DST": 4, "Seller Financing": 6, "Earnout": 3, "Waterfall": 2 };
  const riskScores: Record<string, number> = { "Cash Sale": 9, "1031 Exchange": 5, "DST": 4, "Seller Financing": 6, "Earnout": 3, "Waterfall": 5 };
  const flexScores: Record<string, number> = { "Cash Sale": 10, "1031 Exchange": 3, "DST": 4, "Seller Financing": 7, "Earnout": 6, "Waterfall": 5 };

  const netProceedsValues = strategies.map(s => s.netProceeds);
  const minNet = Math.min(...netProceedsValues);
  const maxNet = Math.max(...netProceedsValues);
  const netRange = maxNet - minNet;

  const getNetProceedsScore = (val: number) => {
    if (netRange === 0) return 5;
    return 1 + ((val - minNet) / netRange) * 9;
  };

  const getScores = (strategyName: string, netProceeds: number) => {
    return {
      "Net Proceeds": getNetProceedsScore(netProceeds),
      "Tax Efficiency": taxEfficiencyScores[strategyName] || 5,
      "Speed/Simplicity": speedScores[strategyName] || 5,
      "Risk Level": riskScores[strategyName] || 5,
      "Flexibility": flexScores[strategyName] || 5,
    };
  };

  const strategyScores = strategies.map(s => ({
    ...s,
    scores: getScores(s.name, s.netProceeds),
  }));

  const strategyWeightedTotals = strategyScores.map(s => {
    let weightedTotal = 0;
    scoringCriteria.forEach(c => {
      const w = (parseFloat(c.weight) || 0) / (totalWeight || 1);
      const score = s.scores[c.criterion as keyof typeof s.scores] || 0;
      weightedTotal += score * w;
    });
    return { ...s, weightedTotal };
  });

  const bestScoringStrategy = strategyWeightedTotals.reduce((best, s) => s.weightedTotal > best.weightedTotal ? s : best, strategyWeightedTotals[0]);

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
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-teal-500" />
            Weighted Decision Matrix
          </CardTitle>
          <CardDescription>
            Multi-criteria scoring model — adjust weights to reflect your priorities (must total 100%)
            {totalWeight !== 100 && (
              <span className="ml-2 text-red-500 font-medium">
                ⚠ Weights total {totalWeight.toFixed(0)}% (should be 100%)
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left font-semibold">Criterion</th>
                  <th className="p-2 text-center font-semibold w-20">Weight</th>
                  {strategyWeightedTotals.map((s) => (
                    <th
                      key={s.name}
                      className={`p-2 text-center font-semibold ${s.name === bestScoringStrategy.name ? 'bg-green-50' : ''}`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{s.name}</span>
                        {s.name === bestScoringStrategy.name && (
                          <Badge className="text-[10px] bg-green-500 px-1.5 py-0">Recommended</Badge>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scoringCriteria.map((c, cIdx) => (
                  <tr key={c.criterion} className="border-b">
                    <td className="p-2 font-medium text-sm">{c.criterion}</td>
                    <td className="p-2 text-center">
                      <Input
                        type="number"
                        value={c.weight}
                        onChange={(e) => updateWeight(cIdx, e.target.value)}
                        className="h-7 text-xs text-center w-16 mx-auto"
                        min="0"
                        max="100"
                      />
                    </td>
                    {strategyWeightedTotals.map((s) => {
                      const score = s.scores[c.criterion as keyof typeof s.scores] || 0;
                      const w = (parseFloat(c.weight) || 0) / (totalWeight || 1);
                      const weighted = score * w;
                      return (
                        <td
                          key={s.name}
                          className={`p-2 text-center ${s.name === bestScoringStrategy.name ? 'bg-green-50' : ''}`}
                        >
                          <div className="flex flex-col items-center">
                            <span className="num font-medium">{score.toFixed(1)}</span>
                            <span className="text-[10px] text-muted-foreground">({weighted.toFixed(2)})</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="p-2 font-bold">Weighted Total</td>
                  <td className="p-2 text-center text-xs">{totalWeight.toFixed(0)}%</td>
                  {strategyWeightedTotals.map((s) => (
                    <td
                      key={s.name}
                      className={`p-2 text-center ${s.name === bestScoringStrategy.name ? 'bg-green-100' : ''}`}
                    >
                      <span className={`num font-bold text-lg ${s.name === bestScoringStrategy.name ? 'text-green-700' : ''}`}>
                        {s.weightedTotal.toFixed(2)}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
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

function AdvisorInsightsPanel() {
  const { masterInputs } = useExitStrategiesStore();
  const baseline = getCashSaleBaseline(masterInputs);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const toggleCheck = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const capitalGainsTax = baseline.federalTax + baseline.stateTax + baseline.niit;
  const effectiveTaxRate = baseline.effectiveTaxRate;
  const federalCapGainsRate = masterInputs.federalTaxRate / 100;

  const recommendation = baseline.capitalGain > 5_000_000
    ? { text: "Consider 1031 Exchange or DST for tax deferral", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" }
    : baseline.capitalGain > 1_000_000
    ? { text: "Evaluate Seller Financing for installment tax treatment", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" }
    : { text: "Cash sale may be most efficient given transaction costs", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };

  const timingRisk = masterInputs.holdingPeriod < 2
    ? { label: "High", detail: "Short-term gains exposure", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200" }
    : masterInputs.holdingPeriod <= 5
    ? { label: "Moderate", detail: "Medium hold period", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200" }
    : { label: "Low", detail: "Long-term capital gains rate applies", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" };

  const strategies = [
    {
      name: "Qualified Opportunity Zone",
      savings: capitalGainsTax * 0.10,
      complexity: 4,
      timeline: "Must invest within 180 days",
      description: "Invest capital gains in a QOZ fund for 10% deferral benefit and potential exclusion of future gains."
    },
    {
      name: "Installment Sale",
      savings: capitalGainsTax * 0.15,
      complexity: 2,
      timeline: "Structure before closing",
      description: "Spread taxable gain across multiple years to reduce annual tax burden and potentially stay in lower brackets."
    },
    {
      name: "Cost Segregation",
      savings: masterInputs.salePrice * 0.15 * federalCapGainsRate,
      complexity: 3,
      timeline: "Commission study post-acquisition",
      description: "Accelerate depreciation on replacement property components to offset gains in early years."
    },
    {
      name: "Charitable Remainder Trust",
      savings: baseline.capitalGain * 0.30 * (effectiveTaxRate / 100),
      complexity: 5,
      timeline: "Establish trust before sale",
      description: "Donate a portion of the asset to a CRT, avoiding gains on the donated portion while receiving income stream."
    },
    {
      name: "Delaware Statutory Trust",
      savings: capitalGainsTax * 0.95,
      complexity: 2,
      timeline: "Identify within 45 days of sale",
      description: "Passive 1031 exchange alternative — invest in institutional-grade real estate without management responsibility."
    },
  ];

  const risks = [
    {
      name: "Market Risk",
      icon: TrendingDown,
      level: effectiveTaxRate > 30 ? "High" : effectiveTaxRate > 20 ? "Moderate" : "Low",
      detail: `Effective tax rate of ${effectiveTaxRate.toFixed(1)}% ${effectiveTaxRate > 28 ? "above" : "within"} typical range`,
    },
    {
      name: "Tax Risk",
      icon: ShieldAlert,
      level: "Moderate",
      detail: "Capital gains rates subject to legislative changes",
    },
    {
      name: "Timing Risk",
      icon: Clock,
      level: timingRisk.label,
      detail: timingRisk.detail,
    },
    {
      name: "Execution Risk",
      icon: AlertTriangle,
      level: baseline.capitalGain > 5_000_000 ? "High" : "Moderate",
      detail: baseline.capitalGain > 5_000_000 ? "Complex structuring required for large gain" : "Standard transaction complexity",
    },
    {
      name: "Concentration Risk",
      icon: Target,
      level: "High",
      detail: "Single asset exposure — consider diversification post-sale",
    },
  ];

  const actionItems = [
    { text: "Engage qualified intermediary for 1031 exchange (if applicable)", priority: "High" as const },
    { text: "Obtain cost segregation study for replacement property", priority: "Medium" as const },
    { text: "Review state tax implications in your state", priority: "High" as const },
    { text: "Model seller financing terms with buyer", priority: "Medium" as const },
    { text: "Consult estate planning attorney for step-up basis strategy", priority: "Low" as const },
    { text: "Request DST offerings from sponsor firms", priority: "Medium" as const },
  ];

  const equityMultiple = masterInputs.costBasis > 0 ? masterInputs.salePrice / masterInputs.costBasis : 0;
  const impliedCapRate = masterInputs.salePrice > 0 ? ((masterInputs.salePrice * 0.07) / masterInputs.salePrice) * 100 : 0;

  const benchmarks = [
    {
      metric: "Effective Tax Rate",
      yourValue: `${effectiveTaxRate.toFixed(1)}%`,
      benchmarkRange: "22–28%",
      benchmarkMid: 25,
      actualValue: effectiveTaxRate,
      isAbove: effectiveTaxRate > 28,
      isBelow: effectiveTaxRate < 22,
    },
    {
      metric: "Hold Period",
      yourValue: `${masterInputs.holdingPeriod} yrs`,
      benchmarkRange: "5–7 years",
      benchmarkMid: 6,
      actualValue: masterInputs.holdingPeriod,
      isAbove: masterInputs.holdingPeriod > 7,
      isBelow: masterInputs.holdingPeriod < 5,
    },
    {
      metric: "Equity Multiple",
      yourValue: `${equityMultiple.toFixed(2)}x`,
      benchmarkRange: "2.0–2.5x",
      benchmarkMid: 2.25,
      actualValue: equityMultiple,
      isAbove: equityMultiple > 2.5,
      isBelow: equityMultiple < 2.0,
    },
    {
      metric: "Gain / Basis Ratio",
      yourValue: `${masterInputs.costBasis > 0 ? ((baseline.capitalGain / masterInputs.costBasis) * 100).toFixed(0) : 0}%`,
      benchmarkRange: "80–150%",
      benchmarkMid: 115,
      actualValue: masterInputs.costBasis > 0 ? (baseline.capitalGain / masterInputs.costBasis) * 100 : 0,
      isAbove: masterInputs.costBasis > 0 && (baseline.capitalGain / masterInputs.costBasis) * 100 > 150,
      isBelow: masterInputs.costBasis > 0 && (baseline.capitalGain / masterInputs.costBasis) * 100 < 80,
    },
  ];

  const riskColor = (level: string) => {
    if (level === "Low") return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200";
    if (level === "Moderate") return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200";
    return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200";
  };

  const priorityColor = (p: string) => {
    if (p === "High") return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200";
    if (p === "Medium") return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200";
    return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-pink-500" />
                Advisor Insights
              </CardTitle>
              <CardDescription>Client-side advisory analysis based on your master inputs</CardDescription>
            </div>
            <Badge className={recommendation.color + " text-xs font-medium px-3 py-1"}>
              <Lightbulb className="h-3 w-3 mr-1.5 inline" />
              {recommendation.text}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Sale Price</p>
              <p className="text-lg font-bold">{formatCurrency(masterInputs.salePrice)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Current Basis</p>
              <p className="text-lg font-bold">{formatCurrency(baseline.adjustedBasis)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Gain</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(baseline.capitalGain)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Hold Period</p>
              <p className="text-lg font-bold">{masterInputs.holdingPeriod} years</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Tax Optimization Strategies
            </CardTitle>
            <CardDescription className="text-xs">Potential savings calculated from your inputs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {strategies.map((s, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold">{s.name}</h4>
                  <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
                    {formatCurrency(s.savings)} savings
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Complexity:</span>
                    <span className="flex">
                      {Array.from({ length: 5 }, (_, si) => (
                        <Star
                          key={si}
                          className={`h-3 w-3 ${si < s.complexity ? "text-amber-400 fill-amber-400" : "text-gray-300"}`}
                        />
                      ))}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{s.timeline}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Risk Assessment
            </CardTitle>
            <CardDescription className="text-xs">Key risk factors for this transaction</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {risks.map((r, i) => (
              <div key={i} className="flex items-center gap-3 border rounded-lg p-3">
                <div className="shrink-0">
                  <r.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold">{r.name}</h4>
                    <Badge className={`${riskColor(r.level)} text-xs shrink-0`}>{r.level}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
            Action Items
          </CardTitle>
          <CardDescription className="text-xs">Prioritized recommended actions for this exit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {actionItems.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  checkedItems[idx] ? "bg-muted/40 opacity-60" : "hover:bg-muted/20"
                }`}
                onClick={() => toggleCheck(idx)}
              >
                {checkedItems[idx] ? (
                  <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={`text-sm flex-1 ${checkedItems[idx] ? "line-through text-muted-foreground" : ""}`}>
                  {item.text}
                </span>
                <Badge className={`${priorityColor(item.priority)} text-xs shrink-0`}>
                  {item.priority}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-indigo-500" />
            Peer Benchmarking
          </CardTitle>
          <CardDescription className="text-xs">How this deal compares to typical marina transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Metric</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Your Deal</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Industry Benchmark</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((b, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 px-3 font-medium">{b.metric}</td>
                    <td className="py-3 px-3 text-center font-semibold">{b.yourValue}</td>
                    <td className="py-3 px-3 text-center text-muted-foreground">{b.benchmarkRange}</td>
                    <td className="py-3 px-3 text-center">
                      {b.isAbove ? (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                          <ArrowUp className="h-3 w-3" /> Above
                        </span>
                      ) : b.isBelow ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                          <ArrowDown className="h-3 w-3" /> Below
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          <CheckCircle2 className="h-3 w-3" /> In Range
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
