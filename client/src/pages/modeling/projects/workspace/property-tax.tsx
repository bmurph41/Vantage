import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AutosaveIndicator } from '@/components/ui/autosave-indicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import type { AutoSaveStatus } from '@/hooks/use-local-autosave';
import {
  Building2,
  Calculator,
  DollarSign,
  TrendingUp,
  Save,
  Info,
  AlertTriangle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PropertyTaxConfig {
  purchasePrice: number;
  taxableValue: number;
  taxableValueMode: 'manual' | 'purchase_price' | 'pct_of_purchase';
  assessedValuePct: number;
  millageRate: number;
  millageRatePer: 100 | 1000;
  reassessOnSale: boolean;
  reassessmentMonth: number;
  reassessmentYear: number;
  historicalAnnualTax: number;
  year1TaxJumpPct: number;
  standardGrowthRate: number;
  lastReassessmentDate: string;
  useCustomSchedule: boolean;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DEFAULT_CONFIG: PropertyTaxConfig = {
  purchasePrice: 0,
  taxableValue: 0,
  taxableValueMode: 'purchase_price',
  assessedValuePct: 85,
  millageRate: 0,
  millageRatePer: 1000,
  reassessOnSale: true,
  reassessmentMonth: 1,
  reassessmentYear: new Date().getFullYear(),
  historicalAnnualTax: 0,
  year1TaxJumpPct: 0,
  standardGrowthRate: 2,
  lastReassessmentDate: '',
  useCustomSchedule: false,
};

function formatCurrencyVal(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatNumberWithCommas(value: number): string {
  if (!value && value !== 0) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function parseFormattedNumber(str: string): number {
  const cleaned = str.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}

function CurrencyInput({ value, onChange, placeholder }: { value: number; onChange: (val: number) => void; placeholder?: string }) {
  const [displayValue, setDisplayValue] = useState(value ? formatNumberWithCommas(value) : '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value ? formatNumberWithCommas(value) : '');
    }
  }, [value, isFocused]);

  return (
    <div className="relative">
      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        inputMode="numeric"
        className="pl-8"
        value={displayValue}
        onFocus={() => {
          setIsFocused(true);
          setDisplayValue(value ? String(value) : '');
        }}
        onBlur={() => {
          setIsFocused(false);
          setDisplayValue(value ? formatNumberWithCommas(value) : '');
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setDisplayValue(raw);
          const parsed = parseFormattedNumber(raw);
          onChange(parsed);
        }}
        placeholder={placeholder || 'Enter amount'}
      />
    </div>
  );
}

function PercentInput({ value, onChange, placeholder, step }: { value: number; onChange: (val: number) => void; placeholder?: string; step?: string }) {
  return (
    <div className="relative">
      <Input
        type="number"
        step={step || '1'}
        className="pr-8"
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder={placeholder || '0'}
      />
      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground ml-1 inline cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function PropertyTaxTab({ projectId, onTabChange }: { projectId: string; onTabChange?: (tab: string) => void }) {
  const [config, setConfig] = useState<PropertyTaxConfig>({ ...DEFAULT_CONFIG });
  const [hasChanges, setHasChanges] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutoSaveStatus>('idle');
  const statusResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: scenarios, isLoading: scenariosLoading } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios'],
  });

  const activeScenario = useMemo(() => {
    if (!scenarios?.length) return null;
    return scenarios.find((s: any) => s.scenarioType === 'base') || scenarios[0];
  }, [scenarios]);

  const holdPeriod = project?.holdPeriod || 5;
  const baseYear = project?.baseYear || new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: holdPeriod }, (_, i) => baseYear + i), [baseYear, holdPeriod]);

  useEffect(() => {
    if (activeScenario?.assumptions?.propertyTax) {
      setConfig({ ...DEFAULT_CONFIG, ...activeScenario.assumptions.propertyTax });
      setHasChanges(false);
    } else {
      const pp = project?.purchasePrice || project?.estimatedValue || 0;
      setConfig(prev => ({
        ...DEFAULT_CONFIG,
        purchasePrice: pp,
        taxableValue: pp,
        reassessmentYear: baseYear,
      }));
      setHasChanges(false);
    }
  }, [activeScenario, project]);

  const updateField = useCallback(<K extends keyof PropertyTaxConfig>(field: K, value: PropertyTaxConfig[K]) => {
    setConfig(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'taxableValueMode' && value === 'purchase_price') {
        next.taxableValue = next.purchasePrice;
      }
      if (field === 'taxableValueMode' && value === 'pct_of_purchase') {
        next.taxableValue = Math.round(next.purchasePrice * (next.assessedValuePct / 100));
      }
      if (field === 'purchasePrice' && prev.taxableValueMode === 'purchase_price') {
        next.taxableValue = value as number;
      }
      if (field === 'purchasePrice' && prev.taxableValueMode === 'pct_of_purchase') {
        next.taxableValue = Math.round((value as number) * (prev.assessedValuePct / 100));
      }
      if (field === 'assessedValuePct') {
        next.taxableValue = Math.round(next.purchasePrice * ((value as number) / 100));
      }
      return next;
    });
    setHasChanges(true);
  }, []);

  useEffect(() => {
    if (!hasChanges) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveMutation.mutate({ isAutosave: true });
    }, 2000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [hasChanges, config]);

  const saveMutation = useMutation({
    mutationFn: ({ isAutosave }: { isAutosave?: boolean }) => {
      if (isAutosave) {
        setAutosaveStatus('saving');
      }
      if (!activeScenario) {
        return apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios`, {
          scenarioType: 'base',
          name: 'Base Case',
          assumptions: { propertyTax: config },
        });
      }
      const existingAssumptions = activeScenario.assumptions || {};
      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        assumptions: { ...existingAssumptions, propertyTax: config },
      });
    },
    onSuccess: (_, { isAutosave }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      setHasChanges(false);
      if (isAutosave) {
        setAutosaveStatus('saved');
        if (statusResetTimerRef.current) clearTimeout(statusResetTimerRef.current);
        statusResetTimerRef.current = setTimeout(() => setAutosaveStatus('idle'), 3000);
      } else {
        toast({ title: 'Saved', description: 'Property tax assumptions have been saved.' });
      }
    },
    onError: () => {
      if (autosaveStatus === 'saving') setAutosaveStatus('idle');
      toast({ title: 'Error', description: 'Failed to save property tax assumptions.', variant: 'destructive' });
    },
  });

  const effectiveTaxableValue = config.taxableValueMode === 'purchase_price'
    ? config.purchasePrice
    : config.taxableValueMode === 'pct_of_purchase'
      ? Math.round(config.purchasePrice * (config.assessedValuePct / 100))
      : config.taxableValue;

  const calculateTax = (taxableVal: number): number => {
    if (config.millageRatePer === 1000) {
      return (taxableVal / 1000) * config.millageRate;
    }
    return (taxableVal / 100) * config.millageRate;
  };

  const taxProjections = useMemo(() => {
    const projections: { year: number; label: string; taxableValue: number; tax: number; monthlyTax: number; growthApplied: string }[] = [];

    const newAnnualTax = calculateTax(effectiveTaxableValue);
    const reassessYear = config.reassessOnSale ? config.reassessmentYear : 0;
    const reassessMonth = config.reassessOnSale ? config.reassessmentMonth : 1;
    const oldAnnualTax = config.historicalAnnualTax || 0;

    let postReassessTaxable = effectiveTaxableValue;

    for (let i = 0; i < holdPeriod; i++) {
      const yr = baseYear + i;
      let annualTax = 0;
      let growthDesc = '';
      let displayTaxable = 0;

      if (!config.reassessOnSale) {
        if (i === 0) {
          displayTaxable = effectiveTaxableValue;
          growthDesc = 'Base';
        } else {
          postReassessTaxable = (i === 1 ? effectiveTaxableValue : postReassessTaxable) * (1 + config.standardGrowthRate / 100);
          displayTaxable = postReassessTaxable;
          growthDesc = `+${config.standardGrowthRate}%`;
        }
        annualTax = calculateTax(displayTaxable);
      } else if (yr < reassessYear) {
        const yearsFromBase = i;
        const grownOldTax = oldAnnualTax * Math.pow(1 + config.standardGrowthRate / 100, yearsFromBase);
        annualTax = grownOldTax;
        displayTaxable = 0;
        growthDesc = yearsFromBase === 0 ? 'Historical' : `Historical +${config.standardGrowthRate}%`;
      } else if (yr === reassessYear) {
        const monthsOld = reassessMonth - 1;
        const monthsNew = 12 - monthsOld;
        const yearsFromBase = i;
        const grownOldMonthly = (oldAnnualTax * Math.pow(1 + config.standardGrowthRate / 100, yearsFromBase)) / 12;
        const newMonthly = newAnnualTax / 12;
        annualTax = (grownOldMonthly * monthsOld) + (newMonthly * monthsNew);
        displayTaxable = effectiveTaxableValue;
        postReassessTaxable = effectiveTaxableValue;
        growthDesc = `Reassessed ${MONTH_NAMES[reassessMonth - 1]}`;
      } else {
        const yearsAfterReassess = yr - reassessYear;
        postReassessTaxable = effectiveTaxableValue * Math.pow(1 + config.standardGrowthRate / 100, yearsAfterReassess);
        displayTaxable = postReassessTaxable;
        annualTax = calculateTax(postReassessTaxable);
        growthDesc = `+${config.standardGrowthRate}%`;
      }

      projections.push({
        year: yr,
        label: `Year ${i + 1} (${yr})`,
        taxableValue: Math.round(displayTaxable),
        tax: Math.round(annualTax),
        monthlyTax: Math.round(annualTax / 12),
        growthApplied: growthDesc,
      });
    }
    return projections;
  }, [effectiveTaxableValue, config.millageRate, config.millageRatePer, config.reassessOnSale, config.reassessmentMonth, config.reassessmentYear, config.historicalAnnualTax, config.standardGrowthRate, holdPeriod, baseYear]);

  const currentAnnualTax = calculateTax(effectiveTaxableValue);

  if (projectLoading || scenariosLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Property Tax Assumptions</h2>
          <p className="text-xs text-muted-foreground">
            Configure property tax calculations for Pro Forma projections
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutosaveIndicator status={autosaveStatus} />
          <Button
            onClick={() => saveMutation.mutate({ isAutosave: false })}
            disabled={!hasChanges || saveMutation.isPending}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center">
            Property Tax Reassessment
            <InfoTip text="When enabled, property taxes will be recalculated based on the new assessed value starting at the reassessment date. This is common when a marina is acquired and the county reassesses property value." />
          </Label>
          <Switch
            checked={config.reassessOnSale}
            onCheckedChange={(checked) => updateField('reassessOnSale', checked)}
          />
        </div>
        {config.reassessOnSale && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 ml-6">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            New tax replaces historical starting at reassessment date
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              Property Valuation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0 px-4 pb-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Purchase Price</Label>
              <CurrencyInput
                value={config.purchasePrice}
                onChange={(val) => updateField('purchasePrice', val)}
                placeholder="Enter purchase price"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center">
                Taxable Value Basis
                <InfoTip text="Choose whether to base taxable value on the purchase price, a percentage of purchase price, or enter a custom value (e.g., county assessed value)" />
              </Label>
              <Select
                value={config.taxableValueMode}
                onValueChange={(val) => updateField('taxableValueMode', val as 'manual' | 'purchase_price' | 'pct_of_purchase')}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase_price">Use Purchase Price (100%)</SelectItem>
                  <SelectItem value="pct_of_purchase">% of Purchase Price</SelectItem>
                  <SelectItem value="manual">Custom Assessed Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.taxableValueMode === 'pct_of_purchase' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center">
                  Assessed Value %
                  <InfoTip text="The percentage of the purchase price used as the taxable/assessed value. For example, 85% means the county assesses property at 85% of purchase price." />
                </Label>
                <PercentInput
                  value={config.assessedValuePct}
                  onChange={(val) => updateField('assessedValuePct', val)}
                  placeholder="85"
                  step="0.1"
                />
                <div className="text-[10px] text-muted-foreground">
                  {config.assessedValuePct}% of {formatCurrencyVal(config.purchasePrice)} = {formatCurrencyVal(effectiveTaxableValue)}
                </div>
              </div>
            )}

            {config.taxableValueMode === 'manual' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Custom Taxable Value</Label>
                <CurrencyInput
                  value={config.taxableValue}
                  onChange={(val) => updateField('taxableValue', val)}
                  placeholder="Enter assessed value"
                />
              </div>
            )}

            <div className="bg-muted/50 rounded-md p-2.5 mt-1">
              <div className="text-[10px] text-muted-foreground">Effective Taxable Value</div>
              <div className="text-base font-bold">{formatCurrencyVal(effectiveTaxableValue)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calculator className="h-4 w-4" />
              Tax Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0 px-4 pb-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center">
                Millage Rate
                <InfoTip text="The tax rate applied to property value. Check your county's tax assessor for the current millage rate." />
              </Label>
              <Input
                type="number"
                step="0.001"
                className="h-8"
                value={config.millageRate || ''}
                onChange={(e) => updateField('millageRate', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 12.5"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rate Applied Per</Label>
              <Select
                value={String(config.millageRatePer)}
                onValueChange={(val) => updateField('millageRatePer', parseInt(val) as 100 | 1000)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">Per $1,000 of Assessed Value</SelectItem>
                  <SelectItem value="100">Per $100 of Assessed Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 rounded-md p-2.5 mt-1">
              <div className="text-[10px] text-muted-foreground">Current Annual Property Tax</div>
              <div className="text-base font-bold">{formatCurrencyVal(currentAnnualTax)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {formatCurrencyVal(effectiveTaxableValue)} / {config.millageRatePer.toLocaleString()} × {config.millageRate}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4" />
              Growth & Tax Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0 px-4 pb-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center">
                Annual Growth Rate (%)
                <InfoTip text="The rate at which property taxes increase each year." />
              </Label>
              <PercentInput
                value={config.standardGrowthRate}
                onChange={(val) => updateField('standardGrowthRate', val)}
                placeholder="2"
                step="0.1"
              />
            </div>

            {config.reassessOnSale && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center">
                    Historical Annual Tax
                    <InfoTip text="The current/prior annual property tax before reassessment." />
                  </Label>
                  <CurrencyInput
                    value={config.historicalAnnualTax}
                    onChange={(val) => updateField('historicalAnnualTax', val)}
                    placeholder="Prior annual tax"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center">
                      Reassess Month
                      <InfoTip text="The month when the new assessed tax goes into effect." />
                    </Label>
                    <Select
                      value={String(config.reassessmentMonth)}
                      onValueChange={(val) => updateField('reassessmentMonth', parseInt(val))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((name, idx) => (
                          <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center">
                      Reassess Year
                      <InfoTip text="The calendar year when the reassessment takes effect." />
                    </Label>
                    <Select
                      value={String(config.reassessmentYear)}
                      onValueChange={(val) => updateField('reassessmentYear', parseInt(val))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((yr) => (
                          <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-md p-2 text-[11px] space-y-0.5">
                  <div className="text-[10px] text-muted-foreground font-medium">Reassessment Summary</div>
                  <div>
                    <span className="font-medium">Before {MONTH_NAMES[config.reassessmentMonth - 1]} {config.reassessmentYear}:</span>{' '}
                    {formatCurrencyVal(config.historicalAnnualTax)}/yr
                  </div>
                  <div>
                    <span className="font-medium">After:</span>{' '}
                    {formatCurrencyVal(currentAnnualTax)}/yr
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4" />
            Property Tax Projection
          </CardTitle>
          <CardDescription className="text-xs">
            Projected over the {holdPeriod}-year hold period
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-4">
          <div className="rounded-md border">
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs py-2">Year</TableHead>
                  <TableHead className="text-xs text-right py-2">Taxable Value</TableHead>
                  <TableHead className="text-xs text-right py-2">Annual Tax</TableHead>
                  <TableHead className="text-xs text-right py-2">Monthly Tax</TableHead>
                  <TableHead className="text-xs py-2">Growth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxProjections.map((proj) => (
                  <TableRow key={proj.year}>
                    <TableCell className="font-medium text-xs py-1.5">{proj.label}</TableCell>
                    <TableCell className="text-right text-xs py-1.5">{formatCurrencyVal(proj.taxableValue)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold py-1.5">{formatCurrencyVal(proj.tax)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground py-1.5">{formatCurrencyVal(proj.monthlyTax)}</TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant={proj.growthApplied.startsWith('Reassess') ? 'default' : proj.growthApplied === 'Base' || proj.growthApplied === 'Historical' ? 'secondary' : 'outline'} className="text-[10px] py-0 px-1.5">
                        {proj.growthApplied}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Total property tax over {holdPeriod} years: <span className="font-semibold">{formatCurrencyVal(taxProjections.reduce((sum, p) => sum + p.tax, 0))}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}