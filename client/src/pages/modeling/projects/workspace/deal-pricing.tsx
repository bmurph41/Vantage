import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Calculator,
  DollarSign,
  Percent,
  TrendingUp,
  Target,
  Save,
  RefreshCw,
  Info,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  SlidersHorizontal,
  AlertTriangle,
  Link2,
  Unlink,
} from 'lucide-react';
import type { ModelingProject, ModelingFinancialPeriod } from '@shared/schema';
import debounce from 'lodash.debounce';
import YearSelector from '@/components/modeling/YearSelector';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';

interface DealPricingProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface PricingResult {
  purchasePrice: number;
  year1CapRate: number;
  exitCapRate: number;
  irr: number;
  equityMultiple: number;
  averageCashOnCash: number;
  noiByYear: number[];
  cashFlowsByYear: number[];
  exitValue: number;
  totalProfit: number;
}

interface SolveForPriceResult {
  purchasePrice: number;
  achievedMetric: number;
  metricType: 'irr' | 'cap_rate' | 'year_cap_rate';
  year1CapRate: number;
  irr: number;
  equityMultiple: number;
}

interface PricingResponse {
  fromPurchasePrice: PricingResult | null;
  fromTargetIRR: SolveForPriceResult | null;
  fromGoingInCapRate: SolveForPriceResult | null;
  fromTargetYearCapRate: SolveForPriceResult | null;
  projectFinancials: {
    year1NOI: number;
    baseRevenue: number;
    baseExpenses: number;
    storedPurchasePrice: number | null;
  };
  noiProjections: number[];
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '$00,000,000';
  const absValue = Math.abs(Math.round(value));
  const paddedNum = absValue.toString().padStart(8, '0');
  const formatted = paddedNum.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  return `${value.toFixed(2)}%`;
};

const formatMultiple = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '0.00x';
  return `${value.toFixed(2)}x`;
};

const parseCurrencyInput = (value: string): number => {
  const num = value.replace(/[^0-9.-]/g, '');
  return parseFloat(num) || 0;
};

const parsePercentInput = (value: string): number => {
  const num = value.replace(/[^0-9.-]/g, '');
  return parseFloat(num) || 0;
};

export default function DealPricing({ projectId, onTabChange }: DealPricingProps) {
  const { toast } = useToast();
  
  const [manualPurchasePrice, setManualPurchasePrice] = useState<string>('');
  const [targetIRR, setTargetIRR] = useState<string>('15');
  const [goingInCapRate, setGoingInCapRate] = useState<string>('7.5');
  const [targetYearCapRate, setTargetYearCapRate] = useState<string>('7.0');
  const [targetYear, setTargetYear] = useState<string>('3');
  const [holdPeriod, setHoldPeriod] = useState<string>('5');
  const [exitCapRate, setExitCapRate] = useState<string>('7.5');
  const [revenueGrowthRate, setRevenueGrowthRate] = useState<string>('3.0');
  const [expenseGrowthRate, setExpenseGrowthRate] = useState<string>('2.0');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [selectedPeriodData, setSelectedPeriodData] = useState<ModelingFinancialPeriod | null>(null);
  const [useNormalizedData, setUseNormalizedData] = useState<boolean>(true);
  
  // Two-way linking: tracks which field was last edited to drive calculation direction
  const [pricingDriver, setPricingDriver] = useState<'price' | 'exitCap'>('price');
  const [isLinked, setIsLinked] = useState<boolean>(true);

  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const { data: adjustments } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'period-adjustments'],
    enabled: !!projectId,
  });

  const activeAdjustmentsCount = adjustments?.filter(
    adj => !selectedPeriod || adj.periodLabel === selectedPeriod
  ).length || 0;

  const handlePeriodChange = useCallback((periodLabel: string, periodData: ModelingFinancialPeriod | null) => {
    setSelectedPeriod(periodLabel);
    setSelectedPeriodData(periodData);
  }, []);

  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project?.purchasePrice) {
      setManualPurchasePrice(String(project.purchasePrice));
    }
    if (config?.holdPeriod) {
      setHoldPeriod(String(config.holdPeriod));
    }
  }, [project, config]);

  const calculateMutation = useMutation({
    mutationFn: (inputs: any) => 
      apiRequest('POST', `/api/modeling/projects/${projectId}/deal-pricing`, inputs),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { purchasePrice?: number; year1CapRate?: number }) =>
      apiRequest('POST', `/api/modeling/projects/${projectId}/deal-pricing/save`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
      toast({ title: 'Saved', description: 'Deal pricing has been saved to the project.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save deal pricing.', variant: 'destructive' });
    },
  });

  // Handlers for bidirectional updates
  const handlePurchasePriceChange = (value: string) => {
    setManualPurchasePrice(value);
    if (isLinked) setPricingDriver('price');
  };

  const handleExitCapRateChange = (value: string) => {
    setExitCapRate(value);
    if (isLinked) setPricingDriver('exitCap');
  };

  const debouncedCalculate = useCallback(
    debounce(() => {
      const periodOverrides = selectedPeriodData ? {
        periodLabel: selectedPeriod,
        periodNOI: selectedPeriodData.noi ? Number(selectedPeriodData.noi) : undefined,
        periodRevenue: selectedPeriodData.totalRevenue ? Number(selectedPeriodData.totalRevenue) : undefined,
        periodExpenses: selectedPeriodData.totalExpenses ? Number(selectedPeriodData.totalExpenses) : undefined,
      } : {};
      
      calculateMutation.mutate({
        manualPurchasePrice: manualPurchasePrice ? parseCurrencyInput(manualPurchasePrice) : undefined,
        targetIRR: targetIRR ? parsePercentInput(targetIRR) : undefined,
        goingInCapRate: goingInCapRate ? parsePercentInput(goingInCapRate) : undefined,
        targetYearCapRate: targetYearCapRate ? parsePercentInput(targetYearCapRate) : undefined,
        targetYear: targetYear ? parseInt(targetYear) : undefined,
        holdPeriod: parseInt(holdPeriod) || 5,
        exitCapRate: parsePercentInput(exitCapRate) || 7.5,
        revenueGrowthRate: parsePercentInput(revenueGrowthRate),
        expenseGrowthRate: parsePercentInput(expenseGrowthRate),
        useNormalizedData,
        pricingDriver: isLinked ? pricingDriver : undefined,
        ...periodOverrides,
      });
    }, 500),
    [manualPurchasePrice, targetIRR, goingInCapRate, targetYearCapRate, targetYear, holdPeriod, exitCapRate, revenueGrowthRate, expenseGrowthRate, selectedPeriod, selectedPeriodData, useNormalizedData, pricingDriver, isLinked]
  );

  useEffect(() => {
    debouncedCalculate();
    return () => debouncedCalculate.cancel();
  }, [debouncedCalculate]);

  const pricingData = calculateMutation.data as PricingResponse | undefined;

  // Bidirectional update: when exit cap changes and is driving, derive purchase price
  // Exit Cap Rate -> Price: Price = Exit Year NOI / Exit Cap Rate (discounted back)
  useEffect(() => {
    if (!isLinked || pricingDriver !== 'exitCap') return;
    
    const exitCap = parsePercentInput(exitCapRate) / 100;
    const holdYears = parseInt(holdPeriod) || 5;
    const revenueGrowth = parsePercentInput(revenueGrowthRate) / 100;
    const expenseGrowth = parsePercentInput(expenseGrowthRate) / 100;
    
    // Use year1NOI from pricing data, or estimate from project
    const year1NOI = pricingData?.projectFinancials?.year1NOI || 500000; // Default NOI if not available
    
    if (exitCap > 0 && year1NOI > 0) {
      // Project NOI to exit year using net growth rate
      const netGrowth = revenueGrowth - expenseGrowth;
      const projectedExitNOI = year1NOI * Math.pow(1 + netGrowth, holdYears);
      
      // Exit Value = Exit NOI / Exit Cap Rate
      const exitValue = projectedExitNOI / exitCap;
      
      // Calculate cumulative cash flows (sum of annual NOIs)
      let cumulativeCashFlows = 0;
      for (let i = 1; i <= holdYears; i++) {
        cumulativeCashFlows += year1NOI * Math.pow(1 + netGrowth, i - 1);
      }
      
      // For a target IRR, derive max purchase price using simple approximation:
      // IRR formula: 0 = -Price + sum(CF_t/(1+IRR)^t) + ExitValue/(1+IRR)^n
      // Simplified: Price ≈ (ExitValue + CumulativeCF * 0.85) / (1 + targetIRR)^(holdYears/2)
      const targetReturn = parsePercentInput(targetIRR) / 100 || 0.15;
      const discountFactor = Math.pow(1 + targetReturn, holdYears * 0.6);
      const derivedPrice = (exitValue + cumulativeCashFlows * 0.85) / discountFactor;
      
      // Only update if meaningfully different to avoid infinite loops
      const currentPrice = parseCurrencyInput(manualPurchasePrice);
      const priceDiff = Math.abs(derivedPrice - currentPrice);
      
      if (priceDiff > 50000 && derivedPrice > 0) {
        setManualPurchasePrice(Math.round(derivedPrice).toLocaleString());
      }
    }
  }, [exitCapRate, pricingDriver, isLinked, holdPeriod, revenueGrowthRate, expenseGrowthRate, targetIRR, pricingData?.projectFinancials?.year1NOI]);

  const handleSavePurchasePrice = (price: number, capRate?: number) => {
    saveMutation.mutate({ 
      purchasePrice: price,
      year1CapRate: capRate,
    });
  };

  const years = Array.from({ length: parseInt(holdPeriod) || 5 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Deal Pricing</h2>
          <p className="text-sm text-muted-foreground">
            Price the deal from multiple angles - enter a price, target IRR, or cap rate
          </p>
        </div>
        <div className="flex items-center gap-3">
          <YearSelector
            projectId={projectId}
            selectedPeriod={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            showAddButton={true}
            size="sm"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => debouncedCalculate()}
            disabled={calculateMutation.isPending}
            data-testid="button-refresh-pricing"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${calculateMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
        </div>
      </div>

      {activeAdjustmentsCount > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-sm">
                    {activeAdjustmentsCount} Normalization Adjustment{activeAdjustmentsCount !== 1 ? 's' : ''} Active
                    {selectedPeriod ? ` for ${selectedPeriod}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {useNormalizedData 
                      ? 'Financial calculations include normalized adjustments'
                      : 'Using raw financial data (normalizations disabled)'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseNormalizedData(!useNormalizedData)}
                  className="text-xs"
                  data-testid="button-toggle-normalization"
                >
                  {useNormalizedData ? 'Use Raw Data' : 'Use Normalized'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const tabsList = document.querySelector('[data-testid="tab-analytics"]') as HTMLElement;
                    if (tabsList) tabsList.click();
                  }}
                  className="text-xs gap-1"
                  data-testid="button-view-analytics"
                >
                  <SlidersHorizontal className="h-3 w-3" />
                  View Analytics
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(pricingData?.projectFinancials || selectedPeriodData) && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              {selectedPeriod ? `${selectedPeriod} Financials` : 'Project Financials'}
              {selectedPeriodData && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {selectedPeriodData.periodType?.replace('_', ' ') || 'Period'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">
                  {selectedPeriod ? `${selectedPeriod} NOI` : 'Year 1 NOI'}
                </p>
                <p className="font-semibold text-lg" data-testid="text-period-noi">
                  {selectedPeriodData?.noi 
                    ? formatCurrency(Number(selectedPeriodData.noi))
                    : formatCurrency(pricingData?.projectFinancials?.year1NOI)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Revenue</p>
                <p className="font-semibold text-lg" data-testid="text-period-revenue">
                  {selectedPeriodData?.totalRevenue
                    ? formatCurrency(Number(selectedPeriodData.totalRevenue))
                    : formatCurrency(pricingData?.projectFinancials?.baseRevenue)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Expenses</p>
                <p className="font-semibold text-lg" data-testid="text-period-expenses">
                  {selectedPeriodData?.totalExpenses
                    ? formatCurrency(Number(selectedPeriodData.totalExpenses))
                    : formatCurrency(pricingData?.projectFinancials?.baseExpenses)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Cap Rate</p>
                <p className="font-semibold text-lg" data-testid="text-period-cap-rate">
                  {selectedPeriodData?.capRate
                    ? formatPercent(Number(selectedPeriodData.capRate) * 100)
                    : pricingData?.fromPurchasePrice?.year1CapRate
                      ? formatPercent(pricingData.fromPurchasePrice.year1CapRate)
                      : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Purchase Price</p>
                <p className="font-semibold text-lg" data-testid="text-period-price">
                  {selectedPeriodData?.purchasePrice 
                    ? formatCurrency(Number(selectedPeriodData.purchasePrice))
                    : pricingData?.projectFinancials?.storedPurchasePrice 
                      ? formatCurrency(pricingData.projectFinancials.storedPurchasePrice)
                      : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Hold Period</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={holdPeriod} onValueChange={setHoldPeriod}>
              <SelectTrigger data-testid="select-hold-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10].map(y => (
                  <SelectItem key={y} value={String(y)}>{y} Years</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card className={pricingDriver === 'exitCap' && isLinked ? 'ring-2 ring-primary/50' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Exit Cap Rate</CardTitle>
              {pricingDriver === 'exitCap' && isLinked && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Driving
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                value={exitCapRate}
                onChange={(e) => handleExitCapRateChange(e.target.value)}
                className="pr-8"
                data-testid="input-exit-cap-rate"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Revenue Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                value={revenueGrowthRate}
                onChange={(e) => setRevenueGrowthRate(e.target.value)}
                className="pr-8"
                data-testid="input-revenue-growth"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Expense Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                value={expenseGrowthRate}
                onChange={(e) => setExpenseGrowthRate(e.target.value)}
                className="pr-8"
                data-testid="input-expense-growth"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {isLinked && (
        <div className="flex items-center justify-center gap-3 py-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            pricingDriver === 'exitCap' 
              ? 'bg-primary/10 text-primary' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <Percent className="h-3.5 w-3.5" />
            Exit Cap Rate
          </div>
          <div className="flex items-center">
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            pricingDriver === 'price' 
              ? 'bg-primary/10 text-primary' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <DollarSign className="h-3.5 w-3.5" />
            Purchase Price
          </div>
          <span className="text-xs text-muted-foreground ml-2">
            {pricingDriver === 'price' 
              ? '→ Yields update when price changes' 
              : '→ Price updates when cap rate changes'}
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={`border-2 ${pricingDriver === 'price' && isLinked ? 'border-primary ring-2 ring-primary/30' : 'border-primary/20'}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                From Purchase Price
              </CardTitle>
              {pricingDriver === 'price' && isLinked && (
                <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5">
                  Driving
                </Badge>
              )}
            </div>
            <CardDescription>
              Enter a purchase price to see resulting returns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Purchase Price</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isLinked ? "default" : "outline"}
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={() => setIsLinked(!isLinked)}
                      >
                        <Link2 className={`h-3 w-3 ${!isLinked ? 'opacity-50' : ''}`} />
                        {isLinked ? 'Linked' : 'Unlinked'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px]">
                      <p className="text-xs">
                        {isLinked 
                          ? 'Price & Exit Cap are linked. Editing one updates the other.' 
                          : 'Price & Exit Cap are independent. Click to link.'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={manualPurchasePrice}
                  onChange={(e) => handlePurchasePriceChange(e.target.value)}
                  placeholder="10,000,000"
                  className="pl-8"
                  data-testid="input-purchase-price"
                />
              </div>
            </div>

            {calculateMutation.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : pricingData?.fromPurchasePrice ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-muted-foreground">IRR</p>
                    <p className="text-xl font-bold text-green-600" data-testid="text-price-irr">
                      {formatPercent(pricingData.fromPurchasePrice.irr)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <p className="text-xs text-muted-foreground">Year 1 Cap Rate</p>
                    <p className="text-xl font-bold text-blue-600" data-testid="text-price-cap-rate">
                      {formatPercent(pricingData.fromPurchasePrice.year1CapRate)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <p className="text-xs text-muted-foreground">Equity Multiple</p>
                    <p className="text-xl font-bold text-purple-600">
                      {formatMultiple(pricingData.fromPurchasePrice.equityMultiple)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <p className="text-xs text-muted-foreground">Avg Cash-on-Cash</p>
                    <p className="text-xl font-bold text-orange-600">
                      {formatPercent(pricingData.fromPurchasePrice.averageCashOnCash)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <div>
                    <span className="text-muted-foreground">Exit Value: </span>
                    <span className="font-medium">{formatCurrency(pricingData.fromPurchasePrice.exitValue)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Profit: </span>
                    <span className="font-medium text-green-600">{formatCurrency(pricingData.fromPurchasePrice.totalProfit)}</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleSavePurchasePrice(
                    pricingData.fromPurchasePrice!.purchasePrice,
                    pricingData.fromPurchasePrice!.year1CapRate
                  )}
                  disabled={saveMutation.isPending}
                  className="w-full"
                  data-testid="button-save-from-price"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save This Price to Project
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a purchase price to calculate returns</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-green-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              From Target IRR
            </CardTitle>
            <CardDescription>
              Enter your target IRR to find the max purchase price
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Target IRR</Label>
              <div className="relative mt-1">
                <Input
                  value={targetIRR}
                  onChange={(e) => setTargetIRR(e.target.value)}
                  placeholder="15"
                  className="pr-8"
                  data-testid="input-target-irr"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {calculateMutation.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : pricingData?.fromTargetIRR ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-600">Max Purchase Price</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-irr-price">
                    {formatCurrency(pricingData.fromTargetIRR.purchasePrice)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    To achieve {formatPercent(pricingData.fromTargetIRR.achievedMetric)} IRR
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Year 1 Cap Rate: </span>
                    <span className="font-medium">{formatPercent(pricingData.fromTargetIRR.year1CapRate)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equity Multiple: </span>
                    <span className="font-medium">{formatMultiple(pricingData.fromTargetIRR.equityMultiple)}</span>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => handleSavePurchasePrice(
                    pricingData.fromTargetIRR!.purchasePrice,
                    pricingData.fromTargetIRR!.year1CapRate
                  )}
                  disabled={saveMutation.isPending}
                  className="w-full"
                  data-testid="button-save-from-irr"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Use This Price
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a target IRR to solve for price</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-blue-600" />
              From Going-In Cap Rate
            </CardTitle>
            <CardDescription>
              Enter a Year 1 cap rate to calculate price from NOI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Going-In Cap Rate (Year 1)</Label>
              <div className="relative mt-1">
                <Input
                  value={goingInCapRate}
                  onChange={(e) => setGoingInCapRate(e.target.value)}
                  placeholder="7.5"
                  className="pr-8"
                  data-testid="input-going-in-cap"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {calculateMutation.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : pricingData?.fromGoingInCapRate ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-600">Implied Purchase Price</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-cap-price">
                    {formatCurrency(pricingData.fromGoingInCapRate.purchasePrice)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    At {formatPercent(pricingData.fromGoingInCapRate.achievedMetric)} cap rate
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">IRR: </span>
                    <span className="font-medium text-green-600">{formatPercent(pricingData.fromGoingInCapRate.irr)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equity Multiple: </span>
                    <span className="font-medium">{formatMultiple(pricingData.fromGoingInCapRate.equityMultiple)}</span>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => handleSavePurchasePrice(
                    pricingData.fromGoingInCapRate!.purchasePrice,
                    pricingData.fromGoingInCapRate!.achievedMetric
                  )}
                  disabled={saveMutation.isPending}
                  className="w-full"
                  data-testid="button-save-from-cap"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Use This Price
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a cap rate to calculate price</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              From Target Year Cap Rate
            </CardTitle>
            <CardDescription>
              Price based on projected stabilized NOI in a future year
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Target Year</Label>
                <Select value={targetYear} onValueChange={setTargetYear}>
                  <SelectTrigger className="mt-1" data-testid="select-target-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Cap Rate</Label>
                <div className="relative mt-1">
                  <Input
                    value={targetYearCapRate}
                    onChange={(e) => setTargetYearCapRate(e.target.value)}
                    placeholder="7.0"
                    className="pr-8"
                    data-testid="input-target-year-cap"
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {calculateMutation.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : pricingData?.fromTargetYearCapRate ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-600">Implied Purchase Price</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-year-cap-price">
                    {formatCurrency(pricingData.fromTargetYearCapRate.purchasePrice)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Year {targetYear} NOI at {formatPercent(pricingData.fromTargetYearCapRate.achievedMetric)} cap
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Year 1 Cap: </span>
                    <span className="font-medium">{formatPercent(pricingData.fromTargetYearCapRate.year1CapRate)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">IRR: </span>
                    <span className="font-medium text-green-600">{formatPercent(pricingData.fromTargetYearCapRate.irr)}</span>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  onClick={() => handleSavePurchasePrice(
                    pricingData.fromTargetYearCapRate!.purchasePrice,
                    pricingData.fromTargetYearCapRate!.year1CapRate
                  )}
                  disabled={saveMutation.isPending}
                  className="w-full"
                  data-testid="button-save-from-year-cap"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Use This Price
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a year and cap rate to calculate</p>
            )}
          </CardContent>
        </Card>
      </div>

      {pricingData?.noiProjections && pricingData.noiProjections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">NOI Projections</CardTitle>
            <CardDescription>
              Projected Net Operating Income over the hold period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              {pricingData.noiProjections.map((noi, index) => (
                <div key={index} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Year {index + 1}</p>
                  <p className="font-semibold">{formatCurrency(noi)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {onTabChange && (
        <WorkflowNavigation currentTab="pricing" onNavigate={onTabChange} />
      )}
    </div>
  );
}
