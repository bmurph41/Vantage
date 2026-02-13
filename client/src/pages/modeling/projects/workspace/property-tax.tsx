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
  taxableValueMode: 'manual' | 'purchase_price';
  millageRate: number;
  millageRatePer: 100 | 1000;
  reassessOnSale: boolean;
  reassessmentYear: number;
  year1TaxJumpPct: number;
  standardGrowthRate: number;
  lastReassessmentDate: string;
  useCustomSchedule: boolean;
}

const DEFAULT_CONFIG: PropertyTaxConfig = {
  purchasePrice: 0,
  taxableValue: 0,
  taxableValueMode: 'purchase_price',
  millageRate: 0,
  millageRatePer: 1000,
  reassessOnSale: true,
  reassessmentYear: 1,
  year1TaxJumpPct: 0,
  standardGrowthRate: 2,
  lastReassessmentDate: '',
  useCustomSchedule: false,
};

function formatCurrencyVal(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
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
      if (field === 'purchasePrice' && prev.taxableValueMode === 'purchase_price') {
        next.taxableValue = value as number;
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

  const effectiveTaxableValue = config.taxableValueMode === 'purchase_price' ? config.purchasePrice : config.taxableValue;

  const calculateTax = (taxableVal: number): number => {
    if (config.millageRatePer === 1000) {
      return (taxableVal / 1000) * config.millageRate;
    }
    return (taxableVal / 100) * config.millageRate;
  };

  const taxProjections = useMemo(() => {
    const projections: { year: number; label: string; taxableValue: number; tax: number; growthApplied: string }[] = [];
    let currentTaxable = effectiveTaxableValue;

    for (let i = 0; i < holdPeriod; i++) {
      const yr = baseYear + i;
      let growthDesc = '';

      if (i === 0) {
        if (config.reassessOnSale && config.year1TaxJumpPct > 0) {
          currentTaxable = effectiveTaxableValue * (1 + config.year1TaxJumpPct / 100);
          growthDesc = `Reassessment +${config.year1TaxJumpPct}%`;
        } else {
          growthDesc = 'Base';
        }
      } else {
        currentTaxable = currentTaxable * (1 + config.standardGrowthRate / 100);
        growthDesc = `+${config.standardGrowthRate}%`;
      }

      const tax = calculateTax(currentTaxable);
      projections.push({
        year: yr,
        label: `Year ${i + 1} (${yr})`,
        taxableValue: Math.round(currentTaxable),
        tax: Math.round(tax),
        growthApplied: growthDesc,
      });
    }
    return projections;
  }, [effectiveTaxableValue, config.millageRate, config.millageRatePer, config.reassessOnSale, config.year1TaxJumpPct, config.standardGrowthRate, holdPeriod, baseYear]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Property Tax Assumptions</h2>
          <p className="text-muted-foreground">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Property Valuation
            </CardTitle>
            <CardDescription>
              Purchase price and taxable value for property tax calculation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Purchase Price</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  className="pl-8"
                  value={config.purchasePrice || ''}
                  onChange={(e) => updateField('purchasePrice', parseFloat(e.target.value) || 0)}
                  placeholder="Enter purchase price"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center">
                Taxable Value Basis
                <InfoTip text="Choose whether to base taxable value on the purchase price or enter a custom value (e.g., county assessed value)" />
              </Label>
              <Select
                value={config.taxableValueMode}
                onValueChange={(val) => updateField('taxableValueMode', val as 'manual' | 'purchase_price')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase_price">Use Purchase Price</SelectItem>
                  <SelectItem value="manual">Custom Assessed Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.taxableValueMode === 'manual' && (
              <div className="space-y-2">
                <Label>Custom Taxable Value</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    className="pl-8"
                    value={config.taxableValue || ''}
                    onChange={(e) => updateField('taxableValue', parseFloat(e.target.value) || 0)}
                    placeholder="Enter assessed value"
                  />
                </div>
              </div>
            )}

            <Separator />

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Effective Taxable Value</div>
              <div className="text-xl font-bold">{formatCurrencyVal(effectiveTaxableValue)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Tax Rate
            </CardTitle>
            <CardDescription>
              Millage rate and calculation method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center">
                Millage Rate
                <InfoTip text="The tax rate applied to property value. Check your county's tax assessor for the current millage rate." />
              </Label>
              <Input
                type="number"
                step="0.001"
                value={config.millageRate || ''}
                onChange={(e) => updateField('millageRate', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 12.5"
              />
            </div>

            <div className="space-y-2">
              <Label>Rate Applied Per</Label>
              <Select
                value={String(config.millageRatePer)}
                onValueChange={(val) => updateField('millageRatePer', parseInt(val) as 100 | 1000)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">Per $1,000 of Assessed Value</SelectItem>
                  <SelectItem value="100">Per $100 of Assessed Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Current Annual Property Tax</div>
              <div className="text-xl font-bold">{formatCurrencyVal(currentAnnualTax)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatCurrencyVal(effectiveTaxableValue)} / {config.millageRatePer.toLocaleString()} × {config.millageRate}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Growth & Reassessment
          </CardTitle>
          <CardDescription>
            How property taxes change over the hold period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center">
                  Reassessment on Sale
                  <InfoTip text="When enabled, the property is reassessed at purchase, which can cause a Year 1 tax increase if the assessed value differs from the prior owner's taxable value." />
                </Label>
                <Switch
                  checked={config.reassessOnSale}
                  onCheckedChange={(checked) => updateField('reassessOnSale', checked)}
                />
              </div>
              {config.reassessOnSale && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Tax may jump in Year 1 due to reassessment
                </div>
              )}
            </div>

            {config.reassessOnSale && (
              <div className="space-y-2">
                <Label className="flex items-center">
                  Year 1 Tax Increase (%)
                  <InfoTip text="The percentage increase in taxable value due to reassessment at acquisition. For example, if the previous assessment was $800K and the purchase price triggers reassessment to $1M, that's a 25% jump." />
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.year1TaxJumpPct || ''}
                  onChange={(e) => updateField('year1TaxJumpPct', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 25"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="flex items-center">
                Standard Annual Growth Rate (%)
                <InfoTip text="The rate at which property taxes increase each year after Year 1. Typically 1-3% in most jurisdictions." />
              </Label>
              <Input
                type="number"
                step="0.1"
                value={config.standardGrowthRate || ''}
                onChange={(e) => updateField('standardGrowthRate', parseFloat(e.target.value) || 0)}
                placeholder="e.g., 2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Property Tax Projection
          </CardTitle>
          <CardDescription>
            Projected property taxes over the {holdPeriod}-year hold period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">Annual Tax</TableHead>
                  <TableHead className="text-right">Monthly Tax</TableHead>
                  <TableHead>Growth Applied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxProjections.map((proj) => (
                  <TableRow key={proj.year}>
                    <TableCell className="font-medium">{proj.label}</TableCell>
                    <TableCell className="text-right">{formatCurrencyVal(proj.taxableValue)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrencyVal(proj.tax)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrencyVal(Math.round(proj.tax / 12))}</TableCell>
                    <TableCell>
                      <Badge variant={proj.growthApplied === 'Base' ? 'secondary' : 'outline'} className="text-xs">
                        {proj.growthApplied}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Total property tax over {holdPeriod} years: {formatCurrencyVal(taxProjections.reduce((sum, p) => sum + p.tax, 0))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}