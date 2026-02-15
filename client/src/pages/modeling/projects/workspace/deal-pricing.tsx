import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { useHoldPeriod } from '@/hooks/use-hold-period';
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
  Minus,
  Plus,
  Calendar,
  BarChart3,
  Brain,
  ThumbsUp,
  ThumbsDown,
  AlertCircle as AlertCircleIcon,
} from 'lucide-react';
import type { ModelingProject, ModelingFinancialPeriod } from '@shared/schema';
import type { ProjectConfig } from '@/types/modeling';
import debounce from 'lodash.debounce';
import { computeDealSignal, getSignalBadgeProps, type DealSignalResult } from '@/lib/dealSignal';
import YearSelector from '@/components/modeling/YearSelector';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';

interface DealPricingProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

type PricingDriver = 'price' | 'targetIRR' | 'goingInCap' | 'targetYearCap' | 'exitCap' | 'holdPeriod';

interface UnifiedPricingResult {
  driver: string;
  purchasePrice: number;
  year1CapRate: number;
  goingInCapRate: number;
  exitCapRate: number;
  irr: number;
  equityMultiple: number;
  moic: number;
  averageCashOnCash: number;
  noiByYear: number[];
  cashFlowsByYear: number[];
  exitValue: number;
  totalProfit: number;
  netExitProceeds: number;
  totalEquityInvested: number;
  usedProFormaData: boolean;
  projectFinancials: {
    year1NOI: number;
    baseRevenue: number;
    baseExpenses: number;
    storedPurchasePrice: number | null;
  };
  noiProjections: number[];
  proFormaIntegrated: boolean;
  stabilizedCapRate: number;
}

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

interface PercentStepperProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  icon: typeof DollarSign;
  step?: number;
  min?: number;
  max?: number;
  isActive?: boolean;
  activeBadge?: string;
  activeColor?: string;
  'data-testid'?: string;
}

function PercentStepper({ 
  value, label, icon: Icon, onChange, step = 0.5, min = -100, max = 100,
  isActive, activeBadge, activeColor = 'blue',
  ...props
}: PercentStepperProps) {
  const numVal = parsePercentInput(value);
  const decrement = () => onChange(Math.max(min, +(numVal - step).toFixed(2)).toString());
  const increment = () => onChange(Math.min(max, +(numVal + step).toFixed(2)).toString());
  
  const colorMap: Record<string, { ring: string; badge: string; iconBg: string; iconText: string }> = {
    blue: { ring: 'ring-blue-500/40 border-blue-300 dark:border-blue-700', badge: 'bg-blue-600', iconBg: 'bg-blue-50 dark:bg-blue-950/50', iconText: 'text-blue-600 dark:text-blue-400' },
    green: { ring: 'ring-green-500/40 border-green-300 dark:border-green-700', badge: 'bg-green-600', iconBg: 'bg-green-50 dark:bg-green-950/50', iconText: 'text-green-600 dark:text-green-400' },
    purple: { ring: 'ring-purple-500/40 border-purple-300 dark:border-purple-700', badge: 'bg-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-950/50', iconText: 'text-purple-600 dark:text-purple-400' },
    slate: { ring: 'ring-slate-400/40 border-slate-300 dark:border-slate-600', badge: 'bg-slate-600', iconBg: 'bg-slate-100 dark:bg-slate-800', iconText: 'text-slate-500 dark:text-slate-400' },
  };
  const colors = colorMap[activeColor] || colorMap.blue;
  
  return (
    <div className={cn(
      "flex flex-col gap-2 py-2.5 px-3 rounded-lg transition-all duration-150 border",
      isActive 
        ? `ring-2 ${colors.ring}` 
        : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600"
    )}>
      <div className="flex items-center gap-2">
        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0", colors.iconBg, colors.iconText)}>
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400 truncate">{label}</span>
        {isActive && activeBadge && (
          <Badge className={cn("text-white text-[8px] px-1.5 py-0 h-4 flex-shrink-0 ml-auto", colors.badge)}>
            {activeBadge}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1.5 justify-center">
        <button
          onClick={decrement}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600 flex-shrink-0"
          tabIndex={-1}
        >
          <Minus className="w-3 h-3" />
        </button>
        <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.\-]/g, '');
              onChange(raw);
            }}
            onBlur={() => {
              const v = parsePercentInput(value);
              onChange(Math.min(max, Math.max(min, v)).toString());
            }}
            className="w-14 text-center text-[13px] font-mono py-1 bg-transparent outline-none text-slate-700 dark:text-slate-300"
            data-testid={props['data-testid']}
          />
          <span className="text-[11px] text-slate-400 dark:text-slate-500 pr-2 font-medium select-none flex-shrink-0">%</span>
        </div>
        <button
          onClick={increment}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600 flex-shrink-0"
          tabIndex={-1}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

interface CurrencyStepperProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  icon: typeof DollarSign;
  step?: number;
  isActive?: boolean;
  activeBadge?: string;
  activeColor?: string;
  'data-testid'?: string;
}

function CurrencyStepper({
  value, label, icon: Icon, onChange, step = 500000,
  isActive, activeBadge, activeColor = 'blue',
  ...props
}: CurrencyStepperProps) {
  const numVal = parseCurrencyInput(value) || 0;
  const decrement = () => {
    const newVal = Math.max(0, numVal - step);
    onChange(newVal.toLocaleString());
  };
  const increment = () => {
    const newVal = numVal + step;
    onChange(newVal.toLocaleString());
  };

  const colorMap: Record<string, { ring: string; badge: string; iconBg: string; iconText: string }> = {
    blue: { ring: 'ring-blue-500/40 border-blue-300 dark:border-blue-700', badge: 'bg-blue-600', iconBg: 'bg-blue-50 dark:bg-blue-950/50', iconText: 'text-blue-600 dark:text-blue-400' },
    primary: { ring: 'ring-primary/40 border-primary/50', badge: 'bg-primary', iconBg: 'bg-primary/10', iconText: 'text-primary' },
  };
  const colors = colorMap[activeColor] || colorMap.primary;

  return (
    <div className={cn(
      "flex flex-col gap-2 py-2.5 px-3 rounded-lg transition-all duration-150 border",
      isActive
        ? `ring-2 ${colors.ring}`
        : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600"
    )}>
      <div className="flex items-center gap-2">
        <div className={cn("w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0", colors.iconBg, colors.iconText)}>
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400 truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={decrement}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600 flex-shrink-0"
          tabIndex={-1}
        >
          <Minus className="w-3 h-3" />
        </button>
        <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-600 overflow-hidden flex-1 min-w-0">
          <span className="text-[11px] text-slate-400 dark:text-slate-500 pl-2.5 font-medium select-none flex-shrink-0">$</span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9,.-]/g, ''))}
            className="w-full text-center text-[13px] font-mono py-1.5 bg-transparent outline-none text-slate-700 dark:text-slate-300"
            placeholder="10,000,000"
            data-testid={props['data-testid']}
          />
        </div>
        <button
          onClick={increment}
          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600 flex-shrink-0"
          tabIndex={-1}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function DealPricing({ projectId, onTabChange }: DealPricingProps) {
  const { toast } = useToast();
  
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [targetIRR, setTargetIRR] = useState<string>('15');
  const [goingInCapRate, setGoingInCapRate] = useState<string>('7.5');
  const [targetYearCapRate, setTargetYearCapRate] = useState<string>('7.0');
  const [targetYear, setTargetYear] = useState<string>('3');
  const { holdPeriod: holdPeriodNum, setHoldPeriod: setHoldPeriodNum } = useHoldPeriod(projectId);
  const [exitCapRate, setExitCapRate] = useState<string>('7.5');
  const [revenueGrowthRate, setRevenueGrowthRate] = useState<string>('3.0');
  const [expenseGrowthRate, setExpenseGrowthRate] = useState<string>('2.0');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [selectedPeriodData, setSelectedPeriodData] = useState<ModelingFinancialPeriod | null>(null);
  const [useNormalizedData, setUseNormalizedData] = useState<boolean>(true);
  
  const [pricingDriver, setPricingDriver] = useState<PricingDriver>('targetIRR');

  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const { data: scenarios = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios'],
    enabled: !!projectId,
  });
  const activeScenario = scenarios.find((s: any) => s.scenarioType === 'base' && s.isCurrentVersion);

  useEffect(() => {
    if (activeScenario?.exitCapRate) {
      const capRatePercent = parseFloat(activeScenario.exitCapRate) * 100;
      if (capRatePercent > 0 && Math.abs(capRatePercent - parseFloat(exitCapRate)) > 0.01) {
        setExitCapRate(capRatePercent.toString());
      }
    }
  }, [activeScenario?.exitCapRate]);

  const saveExitCapRateToScenario = useMutation({
    mutationFn: (exitCapRatePercent: number) => {
      if (!activeScenario?.id) return Promise.resolve();
      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        exitCapRate: (exitCapRatePercent / 100).toFixed(4),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'dcf'] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
    },
  });

  const debouncedSaveCapRate = useCallback(
    debounce((exitCapRatePercent: number) => {
      saveExitCapRateToScenario.mutate(exitCapRatePercent);
    }, 500),
    [activeScenario?.id]
  );

  const { data: exitScenarios = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'exit', 'scenarios'],
    enabled: !!projectId,
  });

  const bestExitScenario = exitScenarios.reduce((best: any, s: any) => {
    const np = s.netProceeds ? parseFloat(s.netProceeds) : 0;
    const bestNp = best?.netProceeds ? parseFloat(best.netProceeds) : 0;
    return np > bestNp ? s : best;
  }, exitScenarios[0] || null);

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

  const { data: config } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project?.purchasePrice && !purchasePrice) {
      setPurchasePrice(String(project.purchasePrice));
    }
  }, [project]);

  const calculateMutation = useMutation({
    mutationFn: async (inputs: any) => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/deal-pricing/unified`, inputs);
      return res.json() as Promise<UnifiedPricingResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
    },
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

  const makeDriverHandler = (driver: PricingDriver, setter: (v: string) => void) => {
    return (value: string) => {
      setter(value);
      setPricingDriver(driver);
    };
  };

  const handlePurchasePriceChange = makeDriverHandler('price', setPurchasePrice);
  const handleTargetIRRChange = makeDriverHandler('targetIRR', setTargetIRR);
  const handleGoingInCapRateChange = makeDriverHandler('goingInCap', setGoingInCapRate);

  const handleExitCapRateChange = (value: string) => {
    setExitCapRate(value);
    setPricingDriver('exitCap');
    const numVal = parseFloat(value);
    if (numVal > 0) {
      debouncedSaveCapRate(numVal);
    }
  };

  const handleHoldPeriodChange = (value: string) => {
    setHoldPeriodNum(parseInt(value));
    setPricingDriver('holdPeriod');
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
        pricingDriver,
        purchasePrice: purchasePrice ? parseCurrencyInput(purchasePrice) : undefined,
        targetIRR: targetIRR ? parsePercentInput(targetIRR) : undefined,
        goingInCapRate: goingInCapRate ? parsePercentInput(goingInCapRate) : undefined,
        targetYearCapRate: targetYearCapRate ? parsePercentInput(targetYearCapRate) : undefined,
        targetYear: targetYear ? parseInt(targetYear) : undefined,
        holdPeriod: holdPeriodNum,
        exitCapRate: parsePercentInput(exitCapRate) || 7.5,
        revenueGrowthRate: parsePercentInput(revenueGrowthRate),
        expenseGrowthRate: parsePercentInput(expenseGrowthRate),
        useNormalizedData,
        ...periodOverrides,
      });
    }, 400),
    [purchasePrice, targetIRR, goingInCapRate, targetYearCapRate, targetYear, holdPeriodNum, exitCapRate, revenueGrowthRate, expenseGrowthRate, selectedPeriod, selectedPeriodData, useNormalizedData, pricingDriver]
  );

  useEffect(() => {
    debouncedCalculate();
    return () => debouncedCalculate.cancel();
  }, [debouncedCalculate]);

  const pricingData = calculateMutation.data as UnifiedPricingResult | undefined;

  useEffect(() => {
    if (!pricingData) return;
    const d = pricingData;
    const driver = d.driver as PricingDriver;

    if (driver !== 'price' && d.purchasePrice > 0) {
      const current = parseCurrencyInput(purchasePrice);
      if (Math.abs(current - d.purchasePrice) > 1) {
        setPurchasePrice(Math.round(d.purchasePrice).toLocaleString());
      }
    }
    if (driver !== 'targetIRR' && d.irr > 0 && d.irr < 200) {
      const current = parsePercentInput(targetIRR);
      if (Math.abs(current - d.irr) > 0.05) {
        setTargetIRR(d.irr.toFixed(1));
      }
    }
    if (driver !== 'goingInCap' && d.goingInCapRate > 0 && d.goingInCapRate < 100) {
      const current = parsePercentInput(goingInCapRate);
      if (Math.abs(current - d.goingInCapRate) > 0.01) {
        setGoingInCapRate(d.goingInCapRate.toFixed(2));
      }
    }
  }, [pricingData]);

  const handleSavePurchasePrice = (price: number, capRate?: number) => {
    saveMutation.mutate({ 
      purchasePrice: price,
      year1CapRate: capRate,
    });
  };

  const years = Array.from({ length: holdPeriodNum }, (_, i) => i + 1);

  const driverLabels: Record<PricingDriver, { label: string; description: string; color: string }> = {
    price: { label: 'Purchase Price', description: 'Editing price updates all yield metrics', color: 'primary' },
    targetIRR: { label: 'Target IRR', description: 'IRR target solves for purchase price', color: 'green-600' },
    goingInCap: { label: 'Going-In Cap', description: 'Cap rate solves for purchase price', color: 'blue-600' },
    targetYearCap: { label: 'Year Cap Rate', description: 'Year cap rate solves for purchase price', color: 'purple-600' },
    exitCap: { label: 'Exit Cap Rate', description: 'Exit cap change recalculates returns', color: 'purple-600' },
    holdPeriod: { label: 'Hold Period', description: 'Hold period change recalculates returns', color: 'slate-600' },
  };

  return (
    <div className="space-y-6">
      {onTabChange && (
        <WorkflowNavigation currentTab="pricing" onNavigate={onTabChange} />
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Deal Pricing</h2>
          <p className="text-sm text-muted-foreground">
            Interconnected pricing — change any input and all metrics update dynamically
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {pricingData?.projectFinancials && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              {selectedPeriod ? `${selectedPeriod} Financials` : 'Project Financials'}
              {pricingData.proFormaIntegrated && (
                <Badge variant="secondary" className="ml-2 text-[10px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 border-indigo-200">
                  Pro Forma Engine
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Year 1 NOI</p>
                <p className="font-semibold text-lg" data-testid="text-period-noi">
                  {formatCurrency(pricingData.projectFinancials.year1NOI)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Revenue</p>
                <p className="font-semibold text-lg" data-testid="text-period-revenue">
                  {formatCurrency(pricingData.projectFinancials.baseRevenue)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Expenses</p>
                <p className="font-semibold text-lg" data-testid="text-period-expenses">
                  {formatCurrency(pricingData.projectFinancials.baseExpenses)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Stored Price</p>
                <p className="font-semibold text-lg" data-testid="text-period-price">
                  {pricingData.projectFinancials.storedPurchasePrice
                    ? formatCurrency(pricingData.projectFinancials.storedPurchasePrice)
                    : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 border-l-4 border-l-slate-400 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Assumptions</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Hold period, cap rates, and growth rates</p>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            <div className={cn(
              "flex flex-col gap-2 py-2.5 px-3 rounded-lg transition-all duration-150 border",
              pricingDriver === 'holdPeriod'
                ? "ring-2 ring-slate-400/40 border-slate-300 dark:border-slate-600"
                : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600"
            )}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3 h-3" />
                </div>
                <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Hold Period</span>
                {pricingDriver === 'holdPeriod' && (
                  <Badge className="bg-slate-600 text-white text-[8px] px-1.5 py-0 h-4 flex-shrink-0 ml-auto">
                    Driving
                  </Badge>
                )}
              </div>
              <Select value={String(holdPeriodNum)} onValueChange={handleHoldPeriodChange}>
                <SelectTrigger className="w-full h-8 text-[13px] font-mono bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600" data-testid="select-hold-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 5, 7, 10, 15].map(y => (
                    <SelectItem key={y} value={String(y)}>{y} Years</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PercentStepper
              label="Exit Cap"
              icon={TrendingUp}
              value={exitCapRate}
              onChange={handleExitCapRateChange}
              step={0.25}
              isActive={pricingDriver === 'exitCap'}
              activeBadge="Driving"
              activeColor="purple"
              data-testid="input-exit-cap-rate"
            />
            <PercentStepper
              label="Rev Growth"
              icon={TrendingUp}
              value={revenueGrowthRate}
              onChange={setRevenueGrowthRate}
              step={0.5}
              activeColor="green"
              data-testid="input-revenue-growth"
            />
            <PercentStepper
              label="Exp Growth"
              icon={BarChart3}
              value={expenseGrowthRate}
              onChange={setExpenseGrowthRate}
              step={0.5}
              activeColor="slate"
              data-testid="input-expense-growth"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex items-center justify-center gap-2 py-2 flex-wrap">
        {(['targetIRR', 'goingInCap', 'price', 'exitCap', 'holdPeriod'] as PricingDriver[]).map((d) => {
          const isActive = pricingDriver === d;
          const colorClass = isActive 
            ? d === 'targetIRR' ? 'bg-green-600 text-white' 
              : d === 'goingInCap' ? 'bg-blue-600 text-white'
              : d === 'price' ? 'bg-primary text-primary-foreground'
              : d === 'exitCap' ? 'bg-purple-600 text-white'
              : 'bg-slate-600 text-white'
            : 'bg-muted text-muted-foreground';
          const IconComp = d === 'targetIRR' ? Target : d === 'goingInCap' ? Percent : d === 'price' ? DollarSign : d === 'exitCap' ? TrendingUp : Calendar;
          return (
            <div key={d} className="flex items-center gap-1.5">
              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all", colorClass)}>
                <IconComp className="h-3 w-3" />
                {driverLabels[d].label}
              </div>
              {d !== 'holdPeriod' && <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          );
        })}
        <span className="text-xs text-muted-foreground ml-2">
          {driverLabels[pricingDriver].description}
        </span>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className={cn(
          "border overflow-hidden",
          pricingDriver === 'targetIRR' ? 'border-green-500 ring-2 ring-green-500/30' : ''
        )}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Target className="h-4 w-4 text-green-600" />
                Target IRR
              </CardTitle>
              {pricingDriver === 'targetIRR' && (
                <Badge className="bg-green-600 text-white text-[9px] px-1.5 py-0">Driving</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <PercentStepper
              label="Target"
              icon={Target}
              value={targetIRR}
              onChange={handleTargetIRRChange}
              step={0.5}
              isActive={pricingDriver === 'targetIRR'}
              activeBadge="Driving"
              activeColor="green"
              data-testid="input-target-irr"
            />
            {pricingDriver === 'targetIRR' && pricingData && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-xs text-muted-foreground mb-1">Solved Purchase Price</p>
                <p className="num text-xl font-bold" data-testid="text-irr-price">
                  {formatCurrency(pricingData.purchasePrice)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(
          "border overflow-hidden",
          pricingDriver === 'goingInCap' ? 'border-blue-500 ring-2 ring-blue-500/30' : ''
        )}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Percent className="h-4 w-4 text-blue-600" />
                Going-In Cap Rate
              </CardTitle>
              {pricingDriver === 'goingInCap' && (
                <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0">Driving</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <PercentStepper
              label="Going-In Rate"
              icon={Percent}
              value={goingInCapRate}
              onChange={handleGoingInCapRateChange}
              step={0.25}
              isActive={pricingDriver === 'goingInCap'}
              activeBadge="Driving"
              activeColor="blue"
              data-testid="input-going-in-cap"
            />
            {pricingDriver === 'goingInCap' && pricingData && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-muted-foreground mb-1">Implied Purchase Price</p>
                <p className="num text-xl font-bold" data-testid="text-cap-price">
                  {formatCurrency(pricingData.purchasePrice)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(
          "border overflow-hidden",
          pricingDriver === 'price' ? 'border-primary ring-2 ring-primary/30' : ''
        )}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-primary" />
                Purchase Price
              </CardTitle>
              {pricingDriver === 'price' && (
                <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0">Driving</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <CurrencyStepper
              label="Enter Amount"
              icon={DollarSign}
              value={purchasePrice}
              onChange={handlePurchasePriceChange}
              step={500000}
              isActive={pricingDriver === 'price'}
              activeColor="primary"
              data-testid="input-purchase-price"
            />
            {pricingDriver === 'price' && pricingData && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Resulting IRR</p>
                <p className="num text-xl font-bold text-green-600" data-testid="text-price-irr">
                  {formatPercent(pricingData.irr)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {calculateMutation.isPending ? (
        <Card>
          <CardContent className="py-6">
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ) : pricingData && pricingData.purchasePrice > 0 ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Return Metrics
                </CardTitle>
                {pricingData.usedProFormaData && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    Pro Forma Engine
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Purchase Price</p>
                  <p className="num text-2xl font-bold" data-testid="text-result-price">
                    {formatCurrency(pricingData.purchasePrice)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-muted-foreground">IRR</p>
                  <p className="num text-2xl font-bold text-green-600" data-testid="text-result-irr">
                    {formatPercent(pricingData.irr)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-muted-foreground">Year 1 Cap Rate</p>
                  <p className="num text-2xl font-bold text-blue-600" data-testid="text-result-cap-rate">
                    {formatPercent(pricingData.year1CapRate)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <p className="text-xs text-muted-foreground">MOIC</p>
                  <p className="num text-2xl font-bold text-purple-600" data-testid="text-result-moic">
                    {formatMultiple(pricingData.moic)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="text-xs text-muted-foreground">Avg Cash-on-Cash</p>
                  <p className="num text-lg font-bold text-orange-600">
                    {formatPercent(pricingData.averageCashOnCash)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-muted-foreground">Equity Multiple</p>
                  <p className="num text-lg font-bold">
                    {formatMultiple(pricingData.equityMultiple)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-muted-foreground">Stabilized Cap Rate</p>
                  <p className="num text-lg font-bold">
                    {formatPercent(pricingData.stabilizedCapRate)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-muted-foreground">Going-In Cap</p>
                  <p className="num text-lg font-bold">
                    {formatPercent(pricingData.goingInCapRate)}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Exit Value: </span>
                  <span className="num font-medium">{formatCurrency(pricingData.exitValue)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Net Exit Proceeds: </span>
                  <span className="num font-medium">{formatCurrency(pricingData.netExitProceeds)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Equity: </span>
                  <span className="num font-medium">{formatCurrency(pricingData.totalEquityInvested)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Profit: </span>
                  <span className="num font-medium text-green-600">{formatCurrency(pricingData.totalProfit)}</span>
                </div>
              </div>

              <div className="mt-4">
                <Button 
                  onClick={() => handleSavePurchasePrice(pricingData.purchasePrice, pricingData.year1CapRate)}
                  disabled={saveMutation.isPending}
                  className="w-full sm:w-auto"
                  data-testid="button-save-from-price"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Price & Cap Rate to Project
                </Button>
              </div>
            </CardContent>
          </Card>

          {pricingData.noiProjections && pricingData.noiProjections.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">NOI Projections</CardTitle>
                    <CardDescription>
                      Projected Net Operating Income over the hold period
                    </CardDescription>
                  </div>
                  {pricingData.proFormaIntegrated && (
                    <Badge variant="secondary" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 border-indigo-200">
                      Pro Forma Engine
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  {pricingData.noiProjections.map((noi, index) => (
                    <div key={index} className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Year {index + 1}</p>
                      <p className="num font-semibold">{formatCurrency(noi)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                Target Year Cap Rate (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-2 py-2.5 px-3 rounded-lg transition-all duration-150 border bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
                      <Calendar className="w-3 h-3" />
                    </div>
                    <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">Target Year</span>
                  </div>
                  <Select value={targetYear} onValueChange={setTargetYear}>
                    <SelectTrigger className="w-full h-8 text-[13px] font-mono bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600" data-testid="select-target-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(y => (
                        <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <PercentStepper
                  label="Cap Rate"
                  icon={Percent}
                  value={targetYearCapRate}
                  onChange={(v) => {
                    setTargetYearCapRate(v);
                    setPricingDriver('targetYearCap');
                  }}
                  step={0.25}
                  isActive={pricingDriver === 'targetYearCap'}
                  activeBadge="Driving"
                  activeColor="purple"
                  data-testid="input-target-year-cap"
                />
              </div>
              {pricingDriver === 'targetYearCap' && pricingData && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
                    <span className="text-xs font-medium text-purple-600">Implied Purchase Price</span>
                  </div>
                  <p className="num text-xl font-bold" data-testid="text-year-cap-price">
                    {formatCurrency(pricingData.purchasePrice)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Year {targetYear} NOI at {targetYearCapRate}% cap → IRR: {formatPercent(pricingData.irr)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : !calculateMutation.isPending && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Calculator className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>Set a target IRR, cap rate, or purchase price to see return metrics</p>
          </CardContent>
        </Card>
      )}

      {(() => {
        if (!pricingData || pricingData.purchasePrice <= 0) return null;
        const exitNp = bestExitScenario?.netProceeds ? parseFloat(bestExitScenario.netProceeds) : null;
        const exitMoicVal = bestExitScenario?.moic ? parseFloat(bestExitScenario.moic) : null;
        const exitIrrVal = bestExitScenario?.irr ? parseFloat(bestExitScenario.irr) : null;
        const dealSignal = computeDealSignal({
          irr: pricingData.irr ?? null,
          capRate: pricingData.goingInCapRate ?? null,
          equityMultiple: pricingData.equityMultiple ?? null,
          cashOnCash: pricingData.averageCashOnCash ?? null,
          purchasePrice: pricingData.purchasePrice ?? null,
          exitValue: pricingData.exitValue ?? null,
          totalProfit: pricingData.totalProfit ?? null,
          noiGrowthRate: parsePercentInput(revenueGrowthRate) > 0 || parsePercentInput(expenseGrowthRate) > 0 ? (parsePercentInput(revenueGrowthRate) - parsePercentInput(expenseGrowthRate)) : null,
          exitNetProceeds: exitNp,
          exitMoic: exitMoicVal,
          exitIrr: exitIrrVal,
        });
        const signalBadge = getSignalBadgeProps(dealSignal.signal);
        const SignalIcon = dealSignal.signal === 'Buy' ? ThumbsUp : dealSignal.signal === 'Pass' ? ThumbsDown : AlertCircleIcon;

        return (
          <Card className={cn("border-2 overflow-hidden", dealSignal.borderColor)} data-testid="card-deal-signal">
            <div className={cn("px-6 py-4 flex items-center justify-between", dealSignal.bgColor)}>
              <div className="flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl", dealSignal.signal === 'Buy' ? 'bg-green-100 dark:bg-green-900/50' : dealSignal.signal === 'Pass' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-amber-100 dark:bg-amber-900/50')}>
                  <SignalIcon className={cn("h-6 w-6", dealSignal.color)} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-foreground">AI Deal Recommendation</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Institutional-grade Buy/Pass signal based on pricing + exit strategy analysis
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right mr-2">
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className="text-lg font-bold font-mono">{dealSignal.score}<span className="text-xs text-muted-foreground">/100</span></p>
                </div>
                <span className={cn("inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-base font-bold border-2 shadow-sm", signalBadge.className)} data-testid="badge-deal-signal">
                  <SignalIcon className="h-4 w-4" />
                  {signalBadge.label}
                </span>
              </div>
            </div>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        dealSignal.score >= 70 ? "bg-green-500" : dealSignal.score >= 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${dealSignal.score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Pass (0-49)</span>
                    <span>Conditional (50-69)</span>
                    <span>Buy (70-100)</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dealSignal.reasons.length > 0 && (
                  <div className={cn("rounded-lg p-3 space-y-1.5", dealSignal.bgColor)}>
                    <p className={cn("text-xs font-semibold uppercase tracking-wider", dealSignal.color)}>Key Factors</p>
                    {dealSignal.reasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className={cn("mt-0.5 flex-shrink-0 text-xs", dealSignal.color)}>
                          {dealSignal.signal === 'Buy' ? '✓' : dealSignal.signal === 'Pass' ? '✗' : '•'}
                        </span>
                        <span className="text-foreground/80">{reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Data Sources</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Going-In Cap</span>
                      <span className="font-medium">{pricingData.goingInCapRate > 0 ? formatPercent(pricingData.goingInCapRate) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IRR</span>
                      <span className="font-medium">{pricingData.irr > 0 ? formatPercent(pricingData.irr) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">MOIC</span>
                      <span className="font-medium">{pricingData.moic > 0 ? formatMultiple(pricingData.moic) : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cash-on-Cash</span>
                      <span className="font-medium">{pricingData.averageCashOnCash > 0 ? formatPercent(pricingData.averageCashOnCash) : '—'}</span>
                    </div>
                    {exitNp != null && (
                      <div className="flex justify-between col-span-2 pt-1 border-t border-slate-200 dark:border-slate-600 mt-1">
                        <span className="text-muted-foreground">Best Exit Net Proceeds</span>
                        <span className="font-medium text-green-600">{formatCurrency(exitNp)}</span>
                      </div>
                    )}
                    {exitMoicVal != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Exit MOIC</span>
                        <span className="font-medium">{exitMoicVal.toFixed(2)}x</span>
                      </div>
                    )}
                    {exitIrrVal != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Exit IRR</span>
                        <span className="font-medium">{formatPercent(exitIrrVal)}</span>
                      </div>
                    )}
                  </div>
                  {exitScenarios.length === 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-1">
                      No exit strategies modeled — add exit scenarios to strengthen this signal
                    </p>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                Adjust pricing inputs or model exit strategies to update this recommendation.
                {exitScenarios.length > 0 && ` Using best of ${exitScenarios.length} exit scenario${exitScenarios.length > 1 ? 's' : ''}.`}
              </p>
            </CardContent>
          </Card>
        );
      })()}

    </div>
  );
}
