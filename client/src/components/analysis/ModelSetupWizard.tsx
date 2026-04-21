import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  DollarSign,
  TrendingUp,
  Calendar,
  Banknote,
  Target,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { AssetClassUpgradeModal } from '@/components/billing/AssetClassUpgradeModal';
import { AssetClassPicker } from '@/components/AssetClassPicker';
import { PROPERTY_TYPE_TO_ASSET_CLASS_KEY, resolveAssetClassKey } from '@shared/billing-constants';
import { postJson, type TypedFetchError } from '@/lib/queryClient';

interface ModelSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: (projectId: string) => void;
}

const PROPERTY_TYPES = [
  { value: 'MARINA', label: 'Marina' },
  { value: 'RV_PARK', label: 'RV Park' },
  { value: 'MULTIFAMILY', label: 'Multifamily' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'MIXED_USE', label: 'Mixed Use' },
  { value: 'SELF_STORAGE', label: 'Self Storage' },
  { value: 'MOBILE_HOME_PARK', label: 'Mobile Home Park' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Wizard property-type values — drives the picker options shown to the user.
 * PROPERTY_TYPE_TO_ASSET_CLASS_KEY (from shared billing-constants) is the canonical
 * mapping from these values to their entitled asset-class key; use it instead of a
 * local copy to avoid drift between client and server.
 */
const WIZARD_PROPERTY_TYPE_VALUES = PROPERTY_TYPES.map((t) => t.value);

/** Reverse mapping: asset-class key → wizard PROPERTY_TYPES value (uppercase). */
const ASSET_CLASS_TO_PROPERTY_TYPE: Record<string, string> = Object.fromEntries(
  WIZARD_PROPERTY_TYPE_VALUES
    .map((v) => [PROPERTY_TYPE_TO_ASSET_CLASS_KEY[v], v] as [string | null | undefined, string])
    .filter((pair): pair is [string, string] => pair[0] !== null && pair[0] !== undefined)
);

/** Asset class keys available for wizard selection (excludes null/undefined-mapped types). */
const WIZARD_ALLOWED_ASSET_KEYS = WIZARD_PROPERTY_TYPE_VALUES
  .map((v) => PROPERTY_TYPE_TO_ASSET_CLASS_KEY[v])
  .filter((v): v is string => v !== null && v !== undefined);

interface OrgEntitlements {
  assetClasses: string[];
  assetClassTier: string;
  assetClassTierName: string;
  assetClassCount: number;
}

const STEPS = [
  { id: 'basics', label: 'Property Basics', icon: Building2 },
  { id: 'purchase', label: 'Purchase Info', icon: DollarSign },
  { id: 'revenue', label: 'Revenue', icon: TrendingUp },
  { id: 'expenses', label: 'Expenses', icon: Banknote },
  { id: 'financing', label: 'Financing', icon: Banknote },
  { id: 'hold', label: 'Hold Period', icon: Calendar },
  { id: 'review', label: 'Review & Create', icon: CheckCircle2 },
];

interface WizardData {
  // Step 1: Property Basics
  name: string;
  address: string;
  city: string;
  state: string;
  propertyType: string;
  units: string;
  yearBuilt: string;
  // Step 2: Purchase Info
  purchasePrice: string;
  closingCostsPct: string;
  acquisitionDate: string;
  // Step 3: Revenue
  grossRevenue: string;
  vacancyRate: string;
  otherIncome: string;
  // Step 4: Expenses
  totalExpenses: string;
  usePercentOfRevenue: boolean;
  expensePercentOfRevenue: string;
  // Step 5: Financing
  isCashPurchase: boolean;
  loanAmountOrLtv: string;
  useLtv: boolean;
  interestRate: string;
  loanTerm: string;
  amortization: string;
  // Step 6: Hold Period
  holdYears: string;
  exitCapRate: string;
  revenueGrowthRate: string;
}

const defaultData: WizardData = {
  name: '',
  address: '',
  city: '',
  state: '',
  propertyType: 'MARINA',
  units: '',
  yearBuilt: '',
  purchasePrice: '',
  closingCostsPct: '2',
  acquisitionDate: '',
  grossRevenue: '',
  vacancyRate: '5',
  otherIncome: '0',
  totalExpenses: '',
  usePercentOfRevenue: false,
  expensePercentOfRevenue: '45',
  isCashPurchase: false,
  loanAmountOrLtv: '65',
  useLtv: true,
  interestRate: '6.5',
  loanTerm: '10',
  amortization: '25',
  holdYears: '5',
  exitCapRate: '7',
  revenueGrowthRate: '3',
};

function parseNum(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

export default function ModelSetupWizard({ open, onOpenChange, onProjectCreated }: ModelSetupWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...defaultData });
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [upgradeModalKey, setUpgradeModalKey] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { data: entitlements } = useQuery<OrgEntitlements>({
    queryKey: ['/api/orgs/me/entitlements'],
    enabled: open,
  });

  const entitledKeys = entitlements?.assetClasses ?? [];

  const isPropertyTypeLocked = (typeValue: string): boolean => {
    if (!entitlements) return false; // still loading — optimistic unlock
    const assetKey = resolveAssetClassKey(typeValue);
    if (assetKey === null) return false; // gating-exempt type (e.g. MIXED_USE) — always allowed
    if (assetKey === undefined) return true; // unrecognised alias — pre-emptively lock to avoid a backend 400
    return !entitledKeys.includes(assetKey);
  };

  const updateField = useCallback(
    <K extends keyof WizardData>(field: K, value: WizardData[K]) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // When entitlements load, auto-correct the default property type if it's locked.
  useEffect(() => {
    if (!entitlements) return;
    const currentKey = resolveAssetClassKey(data.propertyType);
    const isCurrentLocked = currentKey != null && !entitlements.assetClasses.includes(currentKey);
    if (!isCurrentLocked) return;
    const firstUnlocked = PROPERTY_TYPES.find((t) => {
      const k = resolveAssetClassKey(t.value);
      return k === null || k === undefined || entitlements.assetClasses.includes(k);
    });
    if (firstUnlocked) {
      updateField('propertyType', firstUnlocked.value);
    }
  }, [entitlements]);

  const progress = ((step + 1) / STEPS.length) * 100;

  const canProceed = (() => {
    switch (step) {
      case 0:
        return data.name.trim().length > 0 && !isPropertyTypeLocked(data.propertyType);
      case 1:
        return parseNum(data.purchasePrice) > 0;
      case 2:
        return parseNum(data.grossRevenue) > 0;
      case 3:
        return data.usePercentOfRevenue
          ? parseNum(data.expensePercentOfRevenue) > 0
          : parseNum(data.totalExpenses) > 0;
      case 4:
        return data.isCashPurchase || parseNum(data.interestRate) > 0;
      case 5:
        return parseNum(data.holdYears) > 0 && parseNum(data.exitCapRate) > 0;
      case 6:
        return true;
      default:
        return true;
    }
  })();

  const createMutation = useMutation({
    mutationFn: async () => {
      const pp = parseNum(data.purchasePrice);
      const grossRev = parseNum(data.grossRevenue);
      const vacancy = parseNum(data.vacancyRate) / 100;
      const expenses = data.usePercentOfRevenue
        ? grossRev * (parseNum(data.expensePercentOfRevenue) / 100)
        : parseNum(data.totalExpenses);
      const noi = grossRev * (1 - vacancy) + parseNum(data.otherIncome) - expenses;

      const loanAmount = data.isCashPurchase
        ? 0
        : data.useLtv
        ? pp * (parseNum(data.loanAmountOrLtv) / 100)
        : parseNum(data.loanAmountOrLtv);

      return postJson('/api/modeling/projects', {
        marinaName: data.name.trim(),
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        assetClass: data.propertyType,
        totalStorageUnits: parseNum(data.units) || undefined,
        purchasePrice: pp.toString(),
        customMetrics: {
          yearBuilt: parseNum(data.yearBuilt) || undefined,
          closingCostsPct: parseNum(data.closingCostsPct),
          acquisitionDate: data.acquisitionDate || undefined,
          grossRevenue: grossRev,
          vacancyRate: parseNum(data.vacancyRate),
          otherIncome: parseNum(data.otherIncome),
          totalExpenses: expenses,
          noi,
          isCashPurchase: data.isCashPurchase,
          loanAmount,
          ltv: data.isCashPurchase ? 0 : parseNum(data.loanAmountOrLtv),
          interestRate: parseNum(data.interestRate),
          loanTerm: parseNum(data.loanTerm),
          amortization: parseNum(data.amortization),
          holdYears: parseNum(data.holdYears),
          exitCapRate: parseNum(data.exitCapRate),
          revenueGrowthRate: parseNum(data.revenueGrowthRate),
          createdVia: 'simplified_wizard',
        },
      });
    },
    onSuccess: (result) => {
      toast({ title: 'Model Created', description: `${data.name} has been created.` });
      onOpenChange(false);
      setStep(0);
      setData({ ...defaultData });
      const projectId = (result?.id ?? result?.projectId) as string | undefined;
      if (projectId && onProjectCreated) {
        onProjectCreated(projectId);
      } else if (projectId) {
        navigate(`/modeling/projects/${projectId}`);
      }
    },
    onError: (error: unknown) => {
      const apiErr = error as Partial<TypedFetchError>;
      if (apiErr.status === 403 && apiErr.body) {
        const key = typeof apiErr.body.assetClass === 'string' ? apiErr.body.assetClass : '';
        if (key) {
          setUpgradeModalKey(key);
          setShowUpgradeModal(true);
        }
        toast({
          title: 'Asset Class Not In Your Plan',
          description: typeof apiErr.body.message === 'string'
            ? apiErr.body.message
            : 'Upgrade your plan to create projects of this type.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Error', description: 'Failed to create model. Please try again.', variant: 'destructive' });
    },
  });

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Property Name *</Label>
              <Input id="name" placeholder="e.g., Sunset Marina" value={data.name} onChange={(e) => updateField('name', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" placeholder="123 Harbor Dr" value={data.address} onChange={(e) => updateField('address', e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" placeholder="Miami" value={data.city} onChange={(e) => updateField('city', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input id="state" placeholder="FL" value={data.state} onChange={(e) => updateField('state', e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Property Type</Label>
              {!entitlements ? (
                <Skeleton className="h-32 rounded-md" />
              ) : (
                <AssetClassPicker
                  selected={(() => {
                    const key = resolveAssetClassKey(data.propertyType);
                    return key ? [key] : [];
                  })()}
                  onChange={(keys) => {
                    const key = keys[0];
                    if (key && ASSET_CLASS_TO_PROPERTY_TYPE[key]) {
                      updateField('propertyType', ASSET_CLASS_TO_PROPERTY_TYPE[key]);
                    }
                  }}
                  entitledKeys={entitlements ? entitledKeys : undefined}
                  onUpgradeRequest={(key) => {
                    setUpgradeModalKey(key);
                    setShowUpgradeModal(true);
                  }}
                  maxSelections={1}
                  allowedKeys={WIZARD_ALLOWED_ASSET_KEYS}
                />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="units">Units / SF</Label>
                <Input id="units" type="number" placeholder="100" value={data.units} onChange={(e) => updateField('units', e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Number of slips, units, or square feet</p>
              </div>
              <div>
                <Label htmlFor="yearBuilt">Year Built</Label>
                <Input id="yearBuilt" type="number" placeholder="1985" value={data.yearBuilt} onChange={(e) => updateField('yearBuilt', e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="purchasePrice">Purchase Price *</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="purchasePrice" type="number" placeholder="5,000,000" value={data.purchasePrice} onChange={(e) => updateField('purchasePrice', e.target.value)} className="pl-8" />
              </div>
              {parseNum(data.purchasePrice) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(parseNum(data.purchasePrice))}</p>
              )}
            </div>
            <div>
              <Label htmlFor="closingCosts">Closing Costs (%)</Label>
              <Input id="closingCosts" type="number" step="0.1" placeholder="2" value={data.closingCostsPct} onChange={(e) => updateField('closingCostsPct', e.target.value)} className="mt-1" />
              {parseNum(data.purchasePrice) > 0 && parseNum(data.closingCostsPct) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Estimated: {formatCurrency(parseNum(data.purchasePrice) * parseNum(data.closingCostsPct) / 100)}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="acquisitionDate">Acquisition Date</Label>
              <Input id="acquisitionDate" type="date" value={data.acquisitionDate} onChange={(e) => updateField('acquisitionDate', e.target.value)} className="mt-1" />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="grossRevenue">Gross Annual Revenue *</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="grossRevenue" type="number" placeholder="1,200,000" value={data.grossRevenue} onChange={(e) => updateField('grossRevenue', e.target.value)} className="pl-8" />
              </div>
              {parseNum(data.grossRevenue) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(parseNum(data.grossRevenue))}</p>
              )}
            </div>
            <div>
              <Label htmlFor="vacancyRate">Vacancy Rate (%)</Label>
              <Input id="vacancyRate" type="number" step="0.5" placeholder="5" value={data.vacancyRate} onChange={(e) => updateField('vacancyRate', e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Typical range: 3-10%</p>
            </div>
            <div>
              <Label htmlFor="otherIncome">Other Income</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="otherIncome" type="number" placeholder="0" value={data.otherIncome} onChange={(e) => updateField('otherIncome', e.target.value)} className="pl-8" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Laundry, parking, late fees, etc.</p>
            </div>
            {parseNum(data.grossRevenue) > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Effective Revenue (after vacancy)</p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(
                      parseNum(data.grossRevenue) * (1 - parseNum(data.vacancyRate) / 100) +
                        parseNum(data.otherIncome)
                    )}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Use % of Revenue shortcut</Label>
              <Switch checked={data.usePercentOfRevenue} onCheckedChange={(v) => updateField('usePercentOfRevenue', v)} />
            </div>

            {data.usePercentOfRevenue ? (
              <div>
                <Label htmlFor="expensePct">Operating Expenses (% of Revenue)</Label>
                <Input id="expensePct" type="number" step="1" placeholder="45" value={data.expensePercentOfRevenue} onChange={(e) => updateField('expensePercentOfRevenue', e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Typical range: 35-55% for marinas</p>
                {parseNum(data.grossRevenue) > 0 && (
                  <Card className="bg-muted/50 mt-3">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Estimated OpEx</p>
                      <p className="text-sm font-semibold">
                        {formatCurrency(
                          parseNum(data.grossRevenue) * (parseNum(data.expensePercentOfRevenue) / 100)
                        )}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div>
                <Label htmlFor="totalExpenses">Total Operating Expenses *</Label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="totalExpenses" type="number" placeholder="540,000" value={data.totalExpenses} onChange={(e) => updateField('totalExpenses', e.target.value)} className="pl-8" />
                </div>
                {parseNum(data.totalExpenses) > 0 && parseNum(data.grossRevenue) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {((parseNum(data.totalExpenses) / parseNum(data.grossRevenue)) * 100).toFixed(1)}% of revenue
                  </p>
                )}
              </div>
            )}

            {parseNum(data.grossRevenue) > 0 && (
              <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Estimated NOI</p>
                  {(() => {
                    const rev = parseNum(data.grossRevenue);
                    const vacancy = parseNum(data.vacancyRate) / 100;
                    const expenses = data.usePercentOfRevenue
                      ? rev * (parseNum(data.expensePercentOfRevenue) / 100)
                      : parseNum(data.totalExpenses);
                    const noi = rev * (1 - vacancy) + parseNum(data.otherIncome) - expenses;
                    const capRate = parseNum(data.purchasePrice) > 0 ? (noi / parseNum(data.purchasePrice)) * 100 : 0;
                    return (
                      <>
                        <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(noi)}</p>
                        {capRate > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">Implied Cap Rate: {capRate.toFixed(2)}%</p>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <Label className="font-semibold">Cash Purchase (No Financing)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Toggle on to skip financing details</p>
              </div>
              <Switch checked={data.isCashPurchase} onCheckedChange={(v) => updateField('isCashPurchase', v)} />
            </div>

            {!data.isCashPurchase && (
              <>
                <div className="flex items-center justify-between">
                  <Label>Input as LTV%</Label>
                  <Switch checked={data.useLtv} onCheckedChange={(v) => updateField('useLtv', v)} />
                </div>
                <div>
                  <Label htmlFor="loanAmount">{data.useLtv ? 'Loan-to-Value (%)' : 'Loan Amount'}</Label>
                  {data.useLtv ? (
                    <Input id="loanAmount" type="number" step="1" placeholder="65" value={data.loanAmountOrLtv} onChange={(e) => updateField('loanAmountOrLtv', e.target.value)} className="mt-1" />
                  ) : (
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="loanAmount" type="number" placeholder="3,250,000" value={data.loanAmountOrLtv} onChange={(e) => updateField('loanAmountOrLtv', e.target.value)} className="pl-8" />
                    </div>
                  )}
                  {data.useLtv && parseNum(data.purchasePrice) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Loan Amount: {formatCurrency(parseNum(data.purchasePrice) * parseNum(data.loanAmountOrLtv) / 100)}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="interestRate">Interest Rate (%)</Label>
                    <Input id="interestRate" type="number" step="0.125" placeholder="6.5" value={data.interestRate} onChange={(e) => updateField('interestRate', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="loanTerm">Term (years)</Label>
                    <Input id="loanTerm" type="number" placeholder="10" value={data.loanTerm} onChange={(e) => updateField('loanTerm', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="amortization">Amortization (years)</Label>
                    <Input id="amortization" type="number" placeholder="25" value={data.amortization} onChange={(e) => updateField('amortization', e.target.value)} className="mt-1" />
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="holdYears">Hold Period (years) *</Label>
              <Input id="holdYears" type="number" placeholder="5" value={data.holdYears} onChange={(e) => updateField('holdYears', e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">How long you plan to hold the property</p>
            </div>
            <div>
              <Label htmlFor="exitCapRate">Exit Cap Rate (%) *</Label>
              <Input id="exitCapRate" type="number" step="0.25" placeholder="7" value={data.exitCapRate} onChange={(e) => updateField('exitCapRate', e.target.value)} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Expected cap rate at time of sale. Typically 0.5-1% higher than going-in.</p>
            </div>
            <div>
              <Label htmlFor="revenueGrowth">Annual Revenue Growth Rate (%)</Label>
              <Input id="revenueGrowth" type="number" step="0.5" placeholder="3" value={data.revenueGrowthRate} onChange={(e) => updateField('revenueGrowthRate', e.target.value)} className="mt-1" />
            </div>
          </div>
        );

      case 6: {
        const pp = parseNum(data.purchasePrice);
        const grossRev = parseNum(data.grossRevenue);
        const vacancy = parseNum(data.vacancyRate) / 100;
        const expenses = data.usePercentOfRevenue
          ? grossRev * (parseNum(data.expensePercentOfRevenue) / 100)
          : parseNum(data.totalExpenses);
        const noi = grossRev * (1 - vacancy) + parseNum(data.otherIncome) - expenses;
        const capRate = pp > 0 ? (noi / pp) * 100 : 0;
        const loanAmount = data.isCashPurchase
          ? 0
          : data.useLtv
          ? pp * (parseNum(data.loanAmountOrLtv) / 100)
          : parseNum(data.loanAmountOrLtv);

        return (
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Property:</span>
                    <span className="ml-2 font-medium">{data.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <span className="ml-2 font-medium">{PROPERTY_TYPES.find((t) => t.value === data.propertyType)?.label}</span>
                  </div>
                  {data.city && (
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <span className="ml-2 font-medium">{[data.city, data.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {data.units && (
                    <div>
                      <span className="text-muted-foreground">Units:</span>
                      <span className="ml-2 font-medium">{data.units}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Purchase Price</p>
                  <p className="text-base font-bold">{formatCurrency(pp)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">NOI</p>
                  <p className="text-base font-bold text-green-600">{formatCurrency(noi)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Cap Rate</p>
                  <p className="text-base font-bold">{capRate.toFixed(2)}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{data.isCashPurchase ? 'All Cash' : 'Loan'}</p>
                  <p className="text-base font-bold">{data.isCashPurchase ? 'Yes' : formatCurrency(loanAmount)}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium">{formatCurrency(grossRev)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vacancy ({data.vacancyRate}%)</span>
                  <span className="font-medium text-red-600">-{formatCurrency(grossRev * vacancy)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expenses</span>
                  <span className="font-medium text-red-600">-{formatCurrency(expenses)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <span>NOI</span>
                  <span className="text-green-600">{formatCurrency(noi)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>Hold Period: {data.holdYears} years | Exit Cap: {data.exitCapRate}% | Revenue Growth: {data.revenueGrowthRate}%</p>
              {!data.isCashPurchase && (
                <p>Financing: {data.interestRate}% rate | {data.loanTerm}yr term | {data.amortization}yr amortization</p>
              )}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const StepIcon = STEPS[step].icon;

  return (<>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StepIcon className="h-5 w-5 text-blue-600" />
            {STEPS[step].label}
          </DialogTitle>
          <DialogDescription>
            Step {step + 1} of {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-1.5 mb-2" />

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step ? 'bg-blue-500' : i === step ? 'bg-blue-400' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {renderStep()}

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (step > 0 ? setStep(step - 1) : onOpenChange(false))}
            disabled={createMutation.isPending}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canProceed}>
              Next
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Create Model
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Upgrade modal for locked asset class types */}
    <AssetClassUpgradeModal
      open={showUpgradeModal}
      onOpenChange={setShowUpgradeModal}
      pendingKeys={upgradeModalKey ? [upgradeModalKey] : []}
    />
  </>);
}
