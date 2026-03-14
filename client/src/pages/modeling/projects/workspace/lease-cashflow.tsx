import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  Building2, 
  Users, 
  Calendar,
  DollarSign,
  BarChart3,
  PieChart,
  RefreshCw,
  Download,
  Settings2,
  ChevronRight,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';

interface MarketAssumptions {
  marketRentPerUnit: number;
  marketRentGrowth: number;
  vacancyRate: number;
  creditLoss: number;
  downtimeMonths: number;
  tiPerSF: number;
  lcRate: number;
  lcMonths: number;
  cpiRate: number;
  camPerUnit: number;
  camGrowthRate: number;
  taxPerUnit: number;
  taxGrowthRate: number;
  insurancePerUnit: number;
  insuranceGrowthRate: number;
  managementFeeRate: number;
  replacementReserveRate: number;
}

interface YearlyCashFlowSummary {
  year: number;
  potentialBaseRent: number;
  scheduledBaseRent: number;
  absorptionVacancy: number;
  freeRent: number;
  effectiveBaseRent: number;
  camRecoveries: number;
  taxRecoveries: number;
  insuranceRecoveries: number;
  totalRecoveries: number;
  percentageRent: number;
  miscIncome: number;
  totalPotentialRevenue: number;
  vacancyCredit: number;
  effectiveGrossRevenue: number;
  camExpenses: number;
  taxExpenses: number;
  insuranceExpenses: number;
  managementFee: number;
  utilities: number;
  repairsAndMaintenance: number;
  generalAndAdmin: number;
  otherExpenses: number;
  totalOperatingExpenses: number;
  netOperatingIncome: number;
  tenantImprovements: number;
  leasingCommissions: number;
  capitalReserves: number;
  totalCapitalCosts: number;
  cashFlowBeforeDebt: number;
  occupancyRate: number;
  avgRentPerUnit: number;
  expenseRatio: number;
}

interface ValuationMetrics {
  purchasePrice: number;
  goingInCapRate: number;
  pricePerUnit: number;
  exitCapRate: number;
  exitNOI: number;
  exitValue: number;
  saleCosts: number;
  netSaleProceeds: number;
  unleveredIRR: number;
  leveredIRR: number;
  equityMultiple: number;
  cashOnCash: number[];
  avgCashOnCash: number;
  npv: number;
  discountRate: number;
  breakEvenOccupancy: number;
}

interface LeaseYearCashFlow {
  year: number;
  period: number;
  tenantId: string;
  tenantName: string;
  unitId: string;
  baseRent: number;
  escalatedRent: number;
  freeRentAbatement: number;
  netBaseRent: number;
  camRecovery: number;
  taxRecovery: number;
  insuranceRecovery: number;
  totalRecoveries: number;
  effectiveGrossRent: number;
  tenantImprovements: number;
  leasingCommissions: number;
  netEffectiveRent: number;
  isRenewal: boolean;
  isNewLease: boolean;
  isVacant: boolean;
  monthsOccupied: number;
}

interface RolloverEvent {
  year: number;
  unitId: string;
  tenantName: string;
  expiringRent: number;
  renewalProbability: number;
  outcome: 'renewal' | 'turnover' | 'vacant';
  newRent: number;
  downtimeMonths: number;
  tiCost: number;
  lcCost: number;
}

interface PropertyCashFlow {
  projectId: string;
  scenarioType: string;
  analysisDate: string;
  holdPeriod: number;
  yearlyTotals: YearlyCashFlowSummary[];
  leaseSchedule: LeaseYearCashFlow[];
  rolloverSchedule: RolloverEvent[];
  metrics: ValuationMetrics;
  assumptions: MarketAssumptions;
  lastCalculated: string;
}

export default function LeaseCashFlowPage() {
  const pdfRef = useRef<HTMLDivElement>(null);
  const { projectId } = useParams<{ projectId: string }>();
  const [scenario, setScenario] = useState('base');
  const [activeTab, setActiveTab] = useState('summary');
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [customAssumptions, setCustomAssumptions] = useState<Partial<MarketAssumptions>>({});

  const { data: cashFlowData, isLoading, refetch } = useQuery<PropertyCashFlow>({
    queryKey: ['/api/modeling/projects', projectId, 'lease-cashflow', scenario],
    enabled: !!projectId,
  });

  const calculateMutation = useMutation({
    mutationFn: (assumptions: Partial<MarketAssumptions>) =>
      apiRequest(`/api/modeling/projects/${projectId}/lease-cashflow/calculate`, {
        method: 'POST',
        body: JSON.stringify({ scenarioType: scenario, assumptions }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/modeling/projects', projectId, 'lease-cashflow'] 
      });
    },
  });

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const metrics = cashFlowData?.metrics;
  const yearlyTotals = cashFlowData?.yearlyTotals || [];

  return (
    <div ref={pdfRef} className="space-y-6 p-6" data-testid="lease-cashflow-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lease Cash Flow Analysis</h1>
          <p className="text-muted-foreground">
            Argus-style lease-by-lease DCF modeling with rollover analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={scenario} onValueChange={setScenario}>
            <SelectTrigger className="w-40" data-testid="scenario-select">
              <SelectValue placeholder="Scenario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Base Case</SelectItem>
              <SelectItem value="aggressive">Aggressive</SelectItem>
              <SelectItem value="conservative">Conservative</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowAssumptions(!showAssumptions)}
            data-testid="toggle-assumptions"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            data-testid="refresh-cashflow"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" data-testid="export-cashflow">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <ExportPdfButton contentRef={pdfRef} filename="lease-cashflow" title="Lease Cash Flow Analysis" />
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-irr">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unlevered IRR</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatPercent(metrics?.unleveredIRR || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-equity-multiple">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Equity Multiple</p>
                <p className="text-2xl font-bold">
                  {metrics?.equityMultiple.toFixed(2)}x
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-cap-rate">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Going-In Cap</p>
                <p className="text-2xl font-bold">
                  {formatPercent(metrics?.goingInCapRate || 0)}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-exit-value">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Exit Value</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(metrics?.exitValue || 0)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assumptions Panel */}
      {showAssumptions && (
        <Card data-testid="assumptions-panel">
          <CardHeader>
            <CardTitle className="text-lg">Market Assumptions</CardTitle>
            <CardDescription>
              Adjust assumptions to see real-time impact on valuations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Market Rent Growth</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[(customAssumptions.marketRentGrowth || cashFlowData?.assumptions.marketRentGrowth || 0) * 100]}
                    onValueChange={([v]) => setCustomAssumptions(prev => ({ ...prev, marketRentGrowth: v / 100 }))}
                    min={0}
                    max={10}
                    step={0.5}
                    className="flex-1"
                  />
                  <span className="text-sm w-12 text-right">
                    {formatPercent((customAssumptions.marketRentGrowth || cashFlowData?.assumptions.marketRentGrowth || 0) * 100)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Vacancy Rate</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[(customAssumptions.vacancyRate || cashFlowData?.assumptions.vacancyRate || 0.05) * 100]}
                    onValueChange={([v]) => setCustomAssumptions(prev => ({ ...prev, vacancyRate: v / 100 }))}
                    min={0}
                    max={20}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-12 text-right">
                    {formatPercent((customAssumptions.vacancyRate || cashFlowData?.assumptions.vacancyRate || 0.05) * 100)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>TI Per SF (New)</Label>
                <Input
                  type="number"
                  value={customAssumptions.tiPerSF || cashFlowData?.assumptions.tiPerSF || 15}
                  onChange={(e) => setCustomAssumptions(prev => ({ ...prev, tiPerSF: parseFloat(e.target.value) }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Downtime (Months)</Label>
                <Input
                  type="number"
                  value={customAssumptions.downtimeMonths || cashFlowData?.assumptions.downtimeMonths || 2}
                  onChange={(e) => setCustomAssumptions(prev => ({ ...prev, downtimeMonths: parseFloat(e.target.value) }))}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button 
                onClick={() => calculateMutation.mutate(customAssumptions)}
                disabled={calculateMutation.isPending}
                data-testid="recalculate-btn"
              >
                {calculateMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Recalculate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary" data-testid="tab-summary">Cash Flow Summary</TabsTrigger>
          <TabsTrigger value="detailed" data-testid="tab-detailed">Detailed Pro Forma</TabsTrigger>
          <TabsTrigger value="leases" data-testid="tab-leases">Lease Schedule</TabsTrigger>
          <TabsTrigger value="rollover" data-testid="tab-rollover">Rollover Analysis</TabsTrigger>
          <TabsTrigger value="tenants" data-testid="tab-tenants">Tenant Performance</TabsTrigger>
        </TabsList>

        {/* Cash Flow Summary Tab */}
        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Year Cash Flow Summary</CardTitle>
              <CardDescription>
                {cashFlowData?.holdPeriod || 10}-year projection with NOI and cash flow metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Line Item</TableHead>
                      {yearlyTotals.map((yt) => (
                        <TableHead key={yt.year} className="text-right min-w-[100px]">
                          {yt.year}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Revenue Section */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="sticky left-0 bg-muted/50">REVENUE</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} />
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Potential Base Rent</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.potentialBaseRent)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Less: Vacancy & Credit Loss</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right text-red-600">
                          ({formatCurrency(yt.absorptionVacancy + yt.vacancyCredit)})
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Less: Free Rent</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right text-red-600">
                          ({formatCurrency(yt.freeRent)})
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Expense Recoveries</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.totalRecoveries)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Other Income</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.percentageRent + yt.miscIncome)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="font-semibold border-t">
                      <TableCell className="sticky left-0 bg-background">Effective Gross Revenue</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.effectiveGrossRevenue)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Expenses Section */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="sticky left-0 bg-muted/50">OPERATING EXPENSES</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} />
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">CAM / Common Area</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.camExpenses)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Real Estate Taxes</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.taxExpenses)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Insurance</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.insuranceExpenses)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Management Fee</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.managementFee)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Utilities</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.utilities)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">R&M</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.repairsAndMaintenance)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">G&A</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.generalAndAdmin)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="font-semibold border-t">
                      <TableCell className="sticky left-0 bg-background">Total Operating Expenses</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          {formatCurrency(yt.totalOperatingExpenses)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* NOI */}
                    <TableRow className="bg-green-50 dark:bg-green-950 font-bold text-lg">
                      <TableCell className="sticky left-0 bg-green-50 dark:bg-green-950">NET OPERATING INCOME</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right text-green-700 dark:text-green-400">
                          {formatCurrency(yt.netOperatingIncome)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Below Line */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="sticky left-0 bg-muted/50">CAPITAL COSTS</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} />
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Tenant Improvements</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          ({formatCurrency(yt.tenantImprovements)})
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Leasing Commissions</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          ({formatCurrency(yt.leasingCommissions)})
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-background pl-6">Capital Reserves</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right">
                          ({formatCurrency(yt.capitalReserves)})
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Cash Flow */}
                    <TableRow className="bg-blue-50 dark:bg-blue-950 font-bold text-lg border-t-2">
                      <TableCell className="sticky left-0 bg-blue-50 dark:bg-blue-950">CASH FLOW BEFORE DEBT</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right text-blue-700 dark:text-blue-400">
                          {formatCurrency(yt.cashFlowBeforeDebt)}
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Metrics */}
                    <TableRow className="bg-muted/30">
                      <TableCell className="sticky left-0 bg-muted/30 text-muted-foreground">Occupancy Rate</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right text-muted-foreground">
                          {formatPercent(yt.occupancyRate * 100)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="sticky left-0 bg-muted/30 text-muted-foreground">Expense Ratio</TableCell>
                      {yearlyTotals.map((yt) => (
                        <TableCell key={yt.year} className="text-right text-muted-foreground">
                          {formatPercent(yt.expenseRatio * 100)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detailed Pro Forma Tab */}
        <TabsContent value="detailed" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Valuation Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Purchase Price</p>
                    <p className="text-lg font-semibold">{formatCurrency(metrics?.purchasePrice || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Price Per Unit</p>
                    <p className="text-lg font-semibold">{formatCurrency(metrics?.pricePerUnit || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Going-In Cap Rate</p>
                    <p className="text-lg font-semibold">{formatPercent(metrics?.goingInCapRate || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Exit Cap Rate</p>
                    <p className="text-lg font-semibold">{formatPercent(metrics?.exitCapRate || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Exit NOI</p>
                    <p className="text-lg font-semibold">{formatCurrency(metrics?.exitNOI || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Exit Value</p>
                    <p className="text-lg font-semibold">{formatCurrency(metrics?.exitValue || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Sale Costs</p>
                    <p className="text-lg font-semibold text-red-600">({formatCurrency(metrics?.saleCosts || 0)})</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Net Sale Proceeds</p>
                    <p className="text-lg font-semibold text-green-600">{formatCurrency(metrics?.netSaleProceeds || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Return Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Unlevered IRR</p>
                    <p className="text-2xl font-bold text-green-600">{formatPercent(metrics?.unleveredIRR || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Levered IRR</p>
                    <p className="text-2xl font-bold text-green-600">{formatPercent(metrics?.leveredIRR || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Equity Multiple</p>
                    <p className="text-2xl font-bold">{metrics?.equityMultiple.toFixed(2)}x</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Avg Cash-on-Cash</p>
                    <p className="text-2xl font-bold">{formatPercent(metrics?.avgCashOnCash || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">NPV @ {metrics?.discountRate}%</p>
                    <p className="text-lg font-semibold">{formatCurrency(metrics?.npv || 0)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Break-Even Occupancy</p>
                    <p className="text-lg font-semibold">{formatPercent(metrics?.breakEvenOccupancy || 0)}</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Cash-on-Cash by Year</p>
                  <div className="flex gap-2 flex-wrap">
                    {metrics?.cashOnCash.map((coc, i) => (
                      <Badge key={i} variant="outline">
                        Y{i + 1}: {formatPercent(coc)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Lease Schedule Tab */}
        <TabsContent value="leases" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Lease-by-Lease Cash Flow Detail</CardTitle>
              <CardDescription>
                Individual tenant cash flows by year with escalations and recoveries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">Base Rent</TableHead>
                      <TableHead className="text-right">Escalated</TableHead>
                      <TableHead className="text-right">Recoveries</TableHead>
                      <TableHead className="text-right">EGR</TableHead>
                      <TableHead className="text-right">TI/LC</TableHead>
                      <TableHead className="text-right">Net Eff.</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashFlowData?.leaseSchedule.slice(0, 100).map((lease, idx) => (
                      <TableRow key={`${lease.tenantId}-${lease.year}-${idx}`}>
                        <TableCell>{lease.year}</TableCell>
                        <TableCell className="font-mono">{lease.unitId}</TableCell>
                        <TableCell>{lease.tenantName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(lease.baseRent)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(lease.escalatedRent)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(lease.totalRecoveries)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(lease.effectiveGrossRent)}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {lease.tenantImprovements + lease.leasingCommissions > 0 
                            ? `(${formatCurrency(lease.tenantImprovements + lease.leasingCommissions)})` 
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(lease.netEffectiveRent)}</TableCell>
                        <TableCell>
                          {lease.isVacant ? (
                            <Badge variant="destructive">Vacant</Badge>
                          ) : lease.isNewLease ? (
                            <Badge variant="default">New</Badge>
                          ) : lease.isRenewal ? (
                            <Badge variant="secondary">Renewal</Badge>
                          ) : (
                            <Badge variant="outline">In-Place</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rollover Analysis Tab */}
        <TabsContent value="rollover" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Lease Rollover Schedule</CardTitle>
                <CardDescription>
                  Expiring leases by year with renewal outcomes and costs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">Expiring Rent</TableHead>
                      <TableHead className="text-right">Renewal Prob.</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="text-right">New Rent</TableHead>
                      <TableHead className="text-right">TI Cost</TableHead>
                      <TableHead className="text-right">LC Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashFlowData?.rolloverSchedule.map((event, idx) => (
                      <TableRow key={`${event.unitId}-${event.year}-${idx}`}>
                        <TableCell>{event.year}</TableCell>
                        <TableCell className="font-mono">{event.unitId}</TableCell>
                        <TableCell>{event.tenantName}</TableCell>
                        <TableCell className="text-right">{formatCurrency(event.expiringRent)}</TableCell>
                        <TableCell className="text-right">{formatPercent(event.renewalProbability * 100)}</TableCell>
                        <TableCell>
                          {event.outcome === 'renewal' ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Renewal
                            </Badge>
                          ) : event.outcome === 'turnover' ? (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Turnover
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Vacant
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(event.newRent)}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {event.tiCost > 0 ? `(${formatCurrency(event.tiCost)})` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {event.lcCost > 0 ? `(${formatCurrency(event.lcCost)})` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rollover Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const rolloverByYear: Record<number, { count: number; rent: number; renewals: number; turnovers: number }> = {};
                  cashFlowData?.rolloverSchedule.forEach(e => {
                    if (!rolloverByYear[e.year]) {
                      rolloverByYear[e.year] = { count: 0, rent: 0, renewals: 0, turnovers: 0 };
                    }
                    rolloverByYear[e.year].count++;
                    rolloverByYear[e.year].rent += e.expiringRent;
                    if (e.outcome === 'renewal') rolloverByYear[e.year].renewals++;
                    else rolloverByYear[e.year].turnovers++;
                  });

                  return Object.entries(rolloverByYear)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([year, data]) => (
                      <div key={year} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-semibold">{year}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.count} units · {formatCurrency(data.rent)}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-green-600">
                              {data.renewals} renewals
                            </Badge>
                            <Badge variant="outline" className="text-yellow-600">
                              {data.turnovers} turns
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ));
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tenant Performance Tab */}
        <TabsContent value="tenants" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Performance Analysis</CardTitle>
              <CardDescription>
                Year 1 tenant contribution and lease metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Annual Rent</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                    <TableHead className="text-right">Months Occupied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashFlowData?.leaseSchedule
                    .filter(l => l.period === 1)
                    .sort((a, b) => b.effectiveGrossRent - a.effectiveGrossRent)
                    .slice(0, 50)
                    .map((lease, idx) => {
                      const totalRent = cashFlowData?.yearlyTotals[0]?.effectiveGrossRevenue || 1;
                      const pctOfTotal = (lease.effectiveGrossRent / totalRent) * 100;
                      
                      return (
                        <TableRow key={`${lease.tenantId}-${idx}`}>
                          <TableCell className="font-medium">{lease.tenantName}</TableCell>
                          <TableCell className="font-mono">{lease.unitId}</TableCell>
                          <TableCell className="text-right">{formatCurrency(lease.effectiveGrossRent)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full" 
                                  style={{ width: `${Math.min(pctOfTotal * 10, 100)}%` }} 
                                />
                              </div>
                              <span>{formatPercent(pctOfTotal)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{lease.monthsOccupied}</TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
