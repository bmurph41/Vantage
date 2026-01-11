import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calculator,
  Plus,
  Trash2,
  TrendingUp,
  DollarSign,
  Clock,
  ArrowLeft,
  RefreshCw,
  Building2,
  BarChart3,
  Percent
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DashboardNav from "../components/navigation/DashboardNav";
import type { Scenario, MarinaLocation } from "@shared/schema";

interface ScenarioWithCashFlows extends Scenario {
  cashFlows?: {
    year: number;
    calendarYear: number;
    revenue: string;
    expenses: string;
    noi: string;
    cashFlow: string;
    terminalValue: string;
  }[];
}

interface CalculationResult {
  npv: number;
  irr: number | null;
  paybackYears: number | null;
  cashFlowProjections: {
    year: number;
    calendarYear: number;
    revenue: number;
    expenses: number;
    noi: number;
    cashFlow: number;
    terminalValue: number;
    cumulativeCashFlow: number;
  }[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${(value * 100).toFixed(2)}%`;
}

export default function ScenariosPage() {
  const { toast } = useToast();
  const [selectedScenario, setSelectedScenario] = useState<ScenarioWithCashFlows | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    projectId: "",
    initialInvestment: "",
    discountRate: "8",
    revenueGrowthRate: "3",
    expenseGrowthRate: "2",
    exitCapRate: "7",
    holdingPeriodYears: "5",
  });

  const { data: scenarios, isLoading: scenariosLoading } = useQuery<Scenario[]>({
    queryKey: ['/api/scenarios'],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<MarinaLocation[]>({
    queryKey: ['/api/marina-locations'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest('POST', '/api/scenarios', {
        name: data.name,
        projectId: data.projectId || null,
        initialInvestment: data.initialInvestment,
        discountRate: (parseFloat(data.discountRate) / 100).toString(),
        revenueGrowthRate: (parseFloat(data.revenueGrowthRate) / 100).toString(),
        expenseGrowthRate: (parseFloat(data.expenseGrowthRate) / 100).toString(),
        exitCapRate: (parseFloat(data.exitCapRate) / 100).toString(),
        holdingPeriodYears: parseInt(data.holdingPeriodYears),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scenarios'] });
      setCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Scenario created",
        description: "Your investment scenario has been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create scenario",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/scenarios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scenarios'] });
      setSelectedScenario(null);
      setCalculationResult(null);
      toast({
        title: "Scenario deleted",
        description: "The scenario has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete scenario",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const calculateMutation = useMutation<CalculationResult, Error, string>({
    mutationFn: async (scenarioId: string) => {
      const response = await apiRequest('POST', `/api/scenarios/${scenarioId}/calculate`);
      return response.json();
    },
    onSuccess: (data) => {
      setCalculationResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/scenarios'] });
      toast({
        title: "Calculation complete",
        description: "Financial metrics have been calculated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Calculation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      projectId: "",
      initialInvestment: "",
      discountRate: "8",
      revenueGrowthRate: "3",
      expenseGrowthRate: "2",
      exitCapRate: "7",
      holdingPeriodYears: "5",
    });
  };

  const handleSelectScenario = async (scenario: Scenario) => {
    setSelectedScenario(scenario);
    if (scenario.calculatedNpv) {
      setCalculationResult({
        npv: parseFloat(scenario.calculatedNpv),
        irr: scenario.calculatedIrr ? parseFloat(scenario.calculatedIrr) : null,
        paybackYears: scenario.calculatedPaybackYears ? parseFloat(scenario.calculatedPaybackYears) : null,
        cashFlowProjections: [],
      });
    } else {
      setCalculationResult(null);
    }
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId || !projects) return "Portfolio-wide";
    const project = projects.find(p => p.id === projectId);
    return project?.name || "Unknown Project";
  };

  if (scenariosLoading || projectsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="mb-4">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <DashboardNav />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">
              Marina Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
              Key performance metrics and trends
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DashboardNav />
            <Button data-testid="button-create-scenario" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Scenario
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Investment Scenario</DialogTitle>
                <DialogDescription>
                  Define your investment assumptions for financial analysis.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Scenario Name</Label>
                  <Input
                    id="name"
                    data-testid="input-scenario-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Base Case Acquisition"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="project">Project (optional)</Label>
                  <Select
                    value={formData.projectId || "portfolio-wide"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value === "portfolio-wide" ? "" : value }))}
                  >
                    <SelectTrigger data-testid="select-project">
                      <SelectValue placeholder="Select a project or leave blank for portfolio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portfolio-wide">Portfolio-wide</SelectItem>
                      {projects?.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="investment">Initial Investment ($)</Label>
                  <Input
                    id="investment"
                    type="number"
                    data-testid="input-initial-investment"
                    value={formData.initialInvestment}
                    onChange={(e) => setFormData(prev => ({ ...prev, initialInvestment: e.target.value }))}
                    placeholder="1,000,000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="discount">Discount Rate (%)</Label>
                    <Input
                      id="discount"
                      type="number"
                      step="0.5"
                      data-testid="input-discount-rate"
                      value={formData.discountRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, discountRate: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="holding">Holding Period (years)</Label>
                    <Input
                      id="holding"
                      type="number"
                      data-testid="input-holding-period"
                      value={formData.holdingPeriodYears}
                      onChange={(e) => setFormData(prev => ({ ...prev, holdingPeriodYears: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="revenue-growth">Revenue Growth (%)</Label>
                    <Input
                      id="revenue-growth"
                      type="number"
                      step="0.5"
                      data-testid="input-revenue-growth"
                      value={formData.revenueGrowthRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, revenueGrowthRate: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="expense-growth">Expense Growth (%)</Label>
                    <Input
                      id="expense-growth"
                      type="number"
                      step="0.5"
                      data-testid="input-expense-growth"
                      value={formData.expenseGrowthRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, expenseGrowthRate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="exit-cap">Exit Cap Rate (%)</Label>
                  <Input
                    id="exit-cap"
                    type="number"
                    step="0.25"
                    data-testid="input-exit-cap"
                    value={formData.exitCapRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, exitCapRate: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  data-testid="button-save-scenario"
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.name || !formData.initialInvestment || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Scenario"}
                </Button>
              </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scenarios</CardTitle>
                <CardDescription>Select a scenario to view analysis</CardDescription>
              </CardHeader>
              <CardContent>
                {scenarios && scenarios.length > 0 ? (
                  <div className="space-y-2">
                    {scenarios.map((scenario) => (
                      <div
                        key={scenario.id}
                        data-testid={`scenario-item-${scenario.id}`}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedScenario?.id === scenario.id
                            ? "border-primary bg-accent"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => handleSelectScenario(scenario)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{scenario.name}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Building2 className="h-3 w-3" />
                              {getProjectName(scenario.projectId)}
                            </div>
                          </div>
                          {scenario.calculatedIrr && (
                            <Badge variant="secondary" className="shrink-0">
                              {formatPercent(parseFloat(scenario.calculatedIrr))} IRR
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {formatCurrency(parseFloat(scenario.initialInvestment || "0"))} investment
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No scenarios yet</p>
                    <p className="text-sm mt-1">Create your first investment scenario</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            {selectedScenario ? (
              <Tabs defaultValue="overview" className="space-y-4">
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                    <TabsTrigger value="cashflows" data-testid="tab-cashflows">Cash Flows</TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="button-calculate"
                      onClick={() => calculateMutation.mutate(selectedScenario.id)}
                      disabled={calculateMutation.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${calculateMutation.isPending ? "animate-spin" : ""}`} />
                      {calculateMutation.isPending ? "Calculating..." : "Recalculate"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      data-testid="button-delete-scenario"
                      onClick={() => deleteMutation.mutate(selectedScenario.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Present Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="metric-npv">
                          {calculationResult?.npv !== undefined
                            ? formatCurrency(calculationResult.npv)
                            : "—"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          At {parseFloat(selectedScenario.discountRate || "0") * 100}% discount rate
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Internal Rate of Return</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="metric-irr">
                          {calculationResult?.irr !== undefined
                            ? formatPercent(calculationResult.irr)
                            : "—"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Annualized return
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Payback Period</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="metric-payback">
                          {calculationResult?.paybackYears !== undefined && calculationResult.paybackYears !== null
                            ? `${calculationResult.paybackYears.toFixed(1)} years`
                            : "—"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Time to recover investment
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Scenario Assumptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Initial Investment</span>
                            <span className="font-medium">{formatCurrency(parseFloat(selectedScenario.initialInvestment || "0"))}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Holding Period</span>
                            <span className="font-medium">{selectedScenario.holdingPeriodYears} years</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Discount Rate</span>
                            <span className="font-medium">{parseFloat(selectedScenario.discountRate || "0") * 100}%</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue Growth</span>
                            <span className="font-medium">{parseFloat(selectedScenario.revenueGrowthRate || "0") * 100}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Expense Growth</span>
                            <span className="font-medium">{parseFloat(selectedScenario.expenseGrowthRate || "0") * 100}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Exit Cap Rate</span>
                            <span className="font-medium">{parseFloat(selectedScenario.exitCapRate || "0") * 100}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cashflows">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Projected Cash Flows</CardTitle>
                      <CardDescription>
                        Year-by-year financial projections for the holding period
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {calculationResult?.cashFlowProjections && calculationResult.cashFlowProjections.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Year</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                              <TableHead className="text-right">Expenses</TableHead>
                              <TableHead className="text-right">NOI</TableHead>
                              <TableHead className="text-right">Cash Flow</TableHead>
                              <TableHead className="text-right">Terminal Value</TableHead>
                              <TableHead className="text-right">Cumulative</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="bg-muted/50">
                              <TableCell className="font-medium">0 (Initial)</TableCell>
                              <TableCell className="text-right">—</TableCell>
                              <TableCell className="text-right">—</TableCell>
                              <TableCell className="text-right">—</TableCell>
                              <TableCell className="text-right text-destructive">
                                {formatCurrency(-parseFloat(selectedScenario.initialInvestment || "0"))}
                              </TableCell>
                              <TableCell className="text-right">—</TableCell>
                              <TableCell className="text-right text-destructive">
                                {formatCurrency(-parseFloat(selectedScenario.initialInvestment || "0"))}
                              </TableCell>
                            </TableRow>
                            {calculationResult.cashFlowProjections.map((cf) => (
                              <TableRow key={cf.year}>
                                <TableCell className="font-medium">
                                  {cf.year} ({cf.calendarYear})
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(cf.revenue)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(cf.expenses)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(cf.noi)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(cf.cashFlow)}</TableCell>
                                <TableCell className="text-right">
                                  {cf.terminalValue > 0 ? formatCurrency(cf.terminalValue) : "—"}
                                </TableCell>
                                <TableCell className={`text-right ${cf.cumulativeCashFlow >= 0 ? "text-green-600" : "text-destructive"}`}>
                                  {formatCurrency(cf.cumulativeCashFlow)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No projections calculated yet</p>
                          <p className="text-sm mt-1">Click "Recalculate" to generate cash flow projections</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Select a Scenario</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Choose a scenario from the list to view its IRR, NPV, and projected cash flows.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
