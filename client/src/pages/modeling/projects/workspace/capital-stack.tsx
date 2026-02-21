import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Edit,
  Building2,
  DollarSign,
  Percent,
  Layers,
  PieChart,
  TrendingUp,
  Calculator,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Save,
  X,
  Info,
  ArrowUpDown,
  Copy,
  Settings2,
  Briefcase,
  Link,
  Unlink,
  ChevronDown,
  Landmark,
  Anchor,
  Loader2
, Users} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CapitalStack, DebtTranche, EquityLayer, CapitalStackProjection, Fund, FundDealAllocation, FundCapitalStackTemplate } from '@shared/schema';
import { useSearch } from 'wouter';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { MarketRatePicker } from '@/components/modeling/MarketRatePicker';
import WorkspaceDebtScenarios from './debt-scenarios';
import LoanBuilder from '@/components/modeling/LoanBuilder';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';

interface CapitalStackWorkspaceProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const DEBT_TRANCHE_TYPES = [
  { value: 'senior', label: 'Senior Debt', description: 'First lien position, lowest risk' },
  { value: 'mezzanine', label: 'Mezzanine', description: 'Subordinate debt with higher returns' },
  { value: 'bridge', label: 'Bridge Loan', description: 'Short-term financing for transitional assets' },
  { value: 'construction', label: 'Construction Loan', description: 'Draw-down financing for development' },
  { value: 'sba', label: 'SBA 504/7(a)', description: 'Government-backed small business loans' },
  { value: 'cmbs', label: 'CMBS', description: 'Securitized commercial mortgage' },
  { value: 'credit_union', label: 'Credit Union', description: 'Member-owned financial institution' },
  { value: 'other', label: 'Other', description: 'Custom debt structure' },
];

const EQUITY_LAYER_TYPES = [
  { value: 'solo', label: 'Solo / Personal', description: 'You are the sole equity investor' },
  { value: 'partnership', label: 'Partnership', description: 'Two or more partners splitting equity' },
  { value: 'common', label: 'Common Equity', description: 'Standard equity with no preferred returns' },
  { value: 'preferred', label: 'Preferred Equity', description: 'Priority distribution with fixed return' },
  { value: 'promote', label: 'GP Promote', description: 'Incentive allocation for sponsor' },
  { value: 'co_invest', label: 'Co-Invest', description: 'Side-by-side investment opportunity' },
];

const INDEX_RATES = [
  { value: 'fixed', label: 'Fixed Rate' },
  { value: 'SOFR', label: 'SOFR' },
  { value: 'Prime', label: 'Prime Rate' },
  { value: 'Treasury', label: 'Treasury Rate' },
  { value: 'LIBOR', label: 'LIBOR (Legacy)' },
];

const PREFERRED_RETURN_TYPES = [
  { value: 'simple', label: 'Simple', description: 'Non-compounding accrual' },
  { value: 'compounding', label: 'Compounding', description: 'Accrues on unpaid distributions' },
  { value: 'cumulative', label: 'Cumulative', description: 'Carries forward if not paid' },
  { value: 'non_cumulative', label: 'Non-Cumulative', description: 'Does not carry forward' },
];

const INVESTOR_TYPES = [
  { value: 'principal', label: 'Principal / Owner' },
  { value: 'partner', label: 'Partner' },
  { value: 'gp', label: 'General Partner (GP)' },
  { value: 'lp', label: 'Limited Partner (LP)' },
  { value: 'co_invest', label: 'Co-Investor' },
  { value: 'fundOfFunds', label: 'Fund of Funds' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'institutional', label: 'Institutional' },
];

// Which equity types get which tabs
const ADVANCED_EQUITY_TYPES = ['preferred', 'promote', 'co_invest'];
const needsAdvancedTabs = (layerType: string) => ADVANCED_EQUITY_TYPES.includes(layerType);

function formatDecimal(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '0' : num.toFixed(2);
}

function parseNumber(value: string | number | null | undefined, defaultVal = 0): number {
  if (value === null || value === undefined) return defaultVal;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? defaultVal : num;
}

const debtTrancheFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  trancheType: z.string().min(1, 'Type is required'),
  lenderName: z.string().optional(),
  principal: z.string().min(1, 'Principal is required'),
  interestRate: z.string().min(1, 'Interest rate is required'),
  indexRate: z.string().optional(),
  spreadBps: z.string().optional(),
  floorRate: z.string().optional(),
  termYears: z.string().min(1, 'Term is required'),
  amortizationYears: z.string().optional(),
  interestOnlyMonths: z.string().optional(),
  originationFeePct: z.string().optional(),
  exitFeePct: z.string().optional(),
  prepaymentPenalty: z.string().optional(),
  minDscr: z.string().optional(),
  maxLtv: z.string().optional(),
  minDebtYield: z.string().optional(),
});

const equityLayerFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  layerType: z.string().min(1, 'Type is required'),
  investorName: z.string().optional(),
  investorType: z.string().optional(),
  commitmentAmount: z.string().min(1, 'Commitment is required'),
  fundedAmount: z.string().optional(),
  ownershipPct: z.string().min(1, 'Ownership % is required'),
  preferredReturn: z.string().optional(),
  preferredReturnType: z.string().optional(),
  isParticipating: z.boolean().optional(),
  catchUpPct: z.string().optional(),
  promoteTiers: z.array(z.object({
    irrHurdle: z.number(),
    gpSplit: z.number(),
    lpSplit: z.number(),
  })).optional(),
});

type DebtTrancheFormData = z.infer<typeof debtTrancheFormSchema>;
type EquityLayerFormData = z.infer<typeof equityLayerFormSchema>;

interface SofrForwardRatePreviewProps {
  holdYears: number;
  spreadBps: number;
  floorRate?: number;
}

function SofrForwardRatePreview({ holdYears, spreadBps, floorRate }: SofrForwardRatePreviewProps) {
  const clampedHoldYears = Math.min(Math.max(holdYears || 5, 1), 30);
  const params = new URLSearchParams({
    spreadBps: String(spreadBps || 0),
    ...(floorRate ? { rateFloor: String(floorRate) } : {}),
  });

  const { data, isLoading } = useQuery<{
    holdYears: number;
    startYear: number;
    spreadBps: number;
    forwardCurveAvailable: boolean;
    yearlyRates: {
      year: number;
      yearIndex: number;
      baseSofrRate: number;
      spreadBps: number;
      allInRate: number;
      allInRateCapped: number;
    }[];
  }>({
    queryKey: ['sofr-forward-rates', clampedHoldYears, spreadBps, floorRate],
    queryFn: async () => {
      const res = await fetch(`/api/capital-markets/sofr-forward-rates/${clampedHoldYears}?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch forward rates');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">SOFR Forward Curve Rates</span>
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data || !data.forwardCurveAvailable || data.yearlyRates.length === 0) {
    return (
      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-700 dark:text-amber-300">
            SOFR forward curve data not available. Refresh market data in Capital Markets to enable variable rate modeling.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">SOFR Forward Curve — Projected Year-by-Year Rates</span>
        <Badge variant="outline" className="text-xs ml-auto">
          {data.forwardCurveAvailable ? 'Live Data' : 'Estimated'}
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs py-1 px-2 h-auto">Year</TableHead>
              <TableHead className="text-xs py-1 px-2 h-auto text-right">Base SOFR</TableHead>
              <TableHead className="text-xs py-1 px-2 h-auto text-right">Spread</TableHead>
              <TableHead className="text-xs py-1 px-2 h-auto text-right font-semibold">All-In Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.yearlyRates.map((yr) => (
              <TableRow key={yr.year} className="hover:bg-blue-100/50 dark:hover:bg-blue-900/30">
                <TableCell className="text-xs py-1 px-2 font-medium">Yr {yr.yearIndex} ({yr.year})</TableCell>
                <TableCell className="text-xs py-1 px-2 text-right">{(yr.baseSofrRate * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-xs py-1 px-2 text-right">+{yr.spreadBps}bps</TableCell>
                <TableCell className="text-xs py-1 px-2 text-right font-semibold text-blue-700 dark:text-blue-300">
                  {(yr.allInRateCapped * 100).toFixed(2)}%
                  {yr.allInRate !== yr.allInRateCapped && (
                    <span className="text-amber-600 ml-1">(capped)</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Forward rates auto-applied to Pro Forma debt service calculations for floating-rate tranches.
      </p>
    </div>
  );
}

export default function CapitalStackWorkspace({ projectId, onTabChange }: CapitalStackWorkspaceProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const searchString = useSearch();
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const [showCreateStack, setShowCreateStack] = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showAddEquity, setShowAddEquity] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtTranche | null>(null);
  const [editingEquity, setEditingEquity] = useState<EquityLayer | null>(null);
  const [noi, setNoi] = useState('1000000');
  const [noiGrowthRate, setNoiGrowthRate] = useState('0.02');
  const [promoteTiers, setPromoteTiers] = useState<{ irrHurdle: number; gpSplit: number; lpSplit: number }[]>([
    { irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 },
  ]);
  const [showFundInheritance, setShowFundInheritance] = useState(false);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState("capital-stack");
  const [showMarketRates, setShowMarketRates] = useState(false);
  const [capitalMarketsParams, setCapitalMarketsParams] = useState<{
    debtSpread?: string;
    debtIndex?: string;
    debtTerm?: string;
    debtFloor?: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const debtSpread = params.get('debtSpread');
    const debtIndex = params.get('debtIndex');
    if (debtSpread || debtIndex) {
      setCapitalMarketsParams({
        debtSpread: debtSpread || undefined,
        debtIndex: debtIndex || undefined,
        debtTerm: params.get('debtTerm') || undefined,
        debtFloor: params.get('debtFloor') || undefined,
      });
      setShowMarketRates(true);
      toast({
        title: "Capital Markets Configuration Applied",
        description: `${debtIndex || 'SOFR'} + ${debtSpread || '250'}bps loaded from Capital Markets debt modeling`,
      });
    }
  }, [searchString]);
  
  const [stackPartners, setStackPartners] = useState<{
    id: string;
    name: string;
    type: 'gp' | 'lp';
    commitmentAmount: string;
    ownershipPct: string;
    preferredReturn: string;
  }[]>([
    { id: crypto.randomUUID(), name: 'GP Sponsor', type: 'gp', commitmentAmount: '500000', ownershipPct: '10', preferredReturn: '8' },
    { id: crypto.randomUUID(), name: 'LP Investor 1', type: 'lp', commitmentAmount: '2000000', ownershipPct: '40', preferredReturn: '8' },
  ]);
  const [stackPromoteTiers, setStackPromoteTiers] = useState<{
    id: string;
    irrHurdle: string;
    gpSplit: string;
    lpSplit: string;
  }[]>([
    { id: crypto.randomUUID(), irrHurdle: '8', gpSplit: '20', lpSplit: '80' },
    { id: crypto.randomUUID(), irrHurdle: '12', gpSplit: '30', lpSplit: '70' },
    { id: crypto.randomUUID(), irrHurdle: '15', gpSplit: '40', lpSplit: '60' },
  ]);
  
  const addStackPartner = () => {
    setStackPartners([...stackPartners, {
      id: crypto.randomUUID(),
      name: `LP Investor ${stackPartners.filter(p => p.type === 'lp').length + 1}`,
      type: 'lp',
      commitmentAmount: '',
      ownershipPct: '',
      preferredReturn: '8',
    }]);
  };
  
  const removeStackPartner = (id: string) => {
    if (stackPartners.length > 1) {
      setStackPartners(stackPartners.filter(p => p.id !== id));
    }
  };
  
  const updateStackPartner = (id: string, field: string, value: string) => {
    setStackPartners(stackPartners.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  
  const addStackPromoteTier = () => {
    const lastTier = stackPromoteTiers[stackPromoteTiers.length - 1];
    const nextHurdle = lastTier ? parseFloat(lastTier.irrHurdle) + 5 : 8;
    setStackPromoteTiers([...stackPromoteTiers, {
      id: crypto.randomUUID(),
      irrHurdle: String(nextHurdle),
      gpSplit: '30',
      lpSplit: '70',
    }]);
  };
  
  const removeStackPromoteTier = (id: string) => {
    if (stackPromoteTiers.length > 1) {
      setStackPromoteTiers(stackPromoteTiers.filter(t => t.id !== id));
    }
  };
  
  const updateStackPromoteTier = (id: string, field: string, value: string) => {
    setStackPromoteTiers(stackPromoteTiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };
  
  const [wizardStep, setWizardStep] = useState(1);
  const wizardScrollRef = useRef<HTMLDivElement>(null);

  const [wizardStackName, setWizardStackName] = useState('');
  const [wizardStackDescription, setWizardStackDescription] = useState('');
  const [wizardPurchasePrice, setWizardPurchasePrice] = useState('');
  const [wizardClosingCosts, setWizardClosingCosts] = useState('');
  const [wizardCapexReserves, setWizardCapexReserves] = useState('');
  const [wizardWorkingCapital, setWizardWorkingCapital] = useState('');
  const [wizardHoldPeriod, setWizardHoldPeriod] = useState('5');
  const [wizardExitCapRate, setWizardExitCapRate] = useState('7');
  const [wizardNoiGrowthRate, setWizardNoiGrowthRate] = useState('2');

  interface WizardLender {
    id: string;
    lenderName: string;
    trancheType: string;
    principal: string;
    interestRate: string;
    indexRate: string;
    spreadBps: string;
    floorRate: string;
    termYears: string;
    amortizationYears: string;
    interestOnlyMonths: string;
    originationFeePct: string;
    exitFeePct: string;
    prepaymentPenalty: string;
    minDscr: string;
    maxLtv: string;
  }

  const createEmptyLender = (index: number): WizardLender => ({
    id: crypto.randomUUID(),
    lenderName: `Lender ${index + 1}`,
    trancheType: 'senior',
    principal: '',
    interestRate: '',
    indexRate: 'fixed',
    spreadBps: '',
    floorRate: '',
    termYears: '10',
    amortizationYears: '25',
    interestOnlyMonths: '0',
    originationFeePct: '1',
    exitFeePct: '0',
    prepaymentPenalty: '',
    minDscr: '',
    maxLtv: '',
  });

  const [wizardLenders, setWizardLenders] = useState<WizardLender[]>([createEmptyLender(0)]);

  const addWizardLender = () => {
    if (wizardLenders.length < 10) {
      setWizardLenders([...wizardLenders, createEmptyLender(wizardLenders.length)]);
    }
  };

  const removeWizardLender = (id: string) => {
    if (wizardLenders.length > 1) {
      setWizardLenders(wizardLenders.filter(l => l.id !== id));
    }
  };

  const updateWizardLender = (id: string, field: keyof WizardLender, value: string) => {
    setWizardLenders(wizardLenders.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const WIZARD_STEPS = [
    { id: 1, title: 'Stack Details', icon: Settings2 },
    { id: 2, title: 'Uses of Funds', icon: DollarSign },
    { id: 3, title: 'Advanced Debt', icon: Landmark },
    { id: 4, title: 'Partners', icon: Building2 },
    { id: 5, title: 'Promote', icon: PieChart },
    { id: 6, title: 'Exit Strategy', icon: TrendingUp },
  ];

  const wizardProgress = (wizardStep / WIZARD_STEPS.length) * 100;

  const handleWizardNext = () => {
    if (wizardStep === 1 && !wizardStackName.trim()) {
      toast({ title: 'Stack name is required', variant: 'destructive' });
      return;
    }
    if (wizardStep === 2 && !parseFloat(wizardPurchasePrice)) {
      toast({ title: 'Purchase price is required', variant: 'destructive' });
      return;
    }
    if (wizardStep < WIZARD_STEPS.length) {
      setWizardStep(s => s + 1);
      wizardScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleWizardBack = () => {
    if (wizardStep > 1) {
      setWizardStep(s => s - 1);
      wizardScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizardStackName('');
    setWizardStackDescription('');
    setWizardPurchasePrice('');
    setWizardClosingCosts('');
    setWizardCapexReserves('');
    setWizardWorkingCapital('');
    setWizardHoldPeriod('5');
    setWizardExitCapRate('7');
    setWizardNoiGrowthRate('2');
    setStackPartners([
      { id: crypto.randomUUID(), name: 'GP Sponsor', type: 'gp', commitmentAmount: '500000', ownershipPct: '10', preferredReturn: '8' },
      { id: crypto.randomUUID(), name: 'LP Investor 1', type: 'lp', commitmentAmount: '2000000', ownershipPct: '40', preferredReturn: '8' },
    ]);
    setStackPromoteTiers([
      { id: crypto.randomUUID(), irrHurdle: '8', gpSplit: '20', lpSplit: '80' },
      { id: crypto.randomUUID(), irrHurdle: '12', gpSplit: '30', lpSplit: '70' },
      { id: crypto.randomUUID(), irrHurdle: '15', gpSplit: '40', lpSplit: '60' },
    ]);
    setWizardLenders([createEmptyLender(0)]);
  };

  const totalPartnerCommitment = stackPartners.reduce((sum, p) => sum + (parseFloat(p.commitmentAmount) || 0), 0);
  const totalOwnership = stackPartners.reduce((sum, p) => sum + (parseFloat(p.ownershipPct) || 0), 0);

  const { data: stacks, isLoading: stacksLoading } = useQuery<CapitalStack[]>({
    queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'],
  });

  // Fund management queries for capital stack inheritance
  const { data: funds } = useQuery<Fund[]>({
    queryKey: ['/api/funds'],
  });

  const { data: dealAllocation } = useQuery<FundDealAllocation>({
    queryKey: ['/api/funds/allocations/by-project', projectId],
    enabled: !!projectId,
  });

  const { data: fundTemplates } = useQuery<FundCapitalStackTemplate[]>({
    queryKey: ['/api/funds', selectedFundId, 'capital-stack-templates'],
    enabled: !!selectedFundId,
  });

  const { data: stackDetails, isLoading: detailsLoading } = useQuery<{
    stack: CapitalStack;
    debtTranches: DebtTranche[];
    equityLayers: EquityLayer[];
    projections: CapitalStackProjection[];
  }>({
    queryKey: ['/api/modeling/capital-stacks', selectedStackId],
    enabled: !!selectedStackId,
  });

  const holdYearsForMarket = capitalMarketsParams?.debtTerm 
    ? Math.min(Math.max(parseInt(capitalMarketsParams.debtTerm), 1), 30)
    : stackDetails?.stack 
      ? Math.min(Math.max(parseInt(String(stackDetails.stack.holdPeriod || 5)), 1), 30) 
      : 5;
  const spreadBpsForMarket = capitalMarketsParams?.debtSpread ? parseInt(capitalMarketsParams.debtSpread) : 250;
  const { data: marketForwardRates, isLoading: marketRatesLoading } = useQuery<{
    holdYears: number;
    startYear: number;
    spreadBps: number;
    forwardCurveAvailable: boolean;
    yearlyRates: {
      year: number;
      yearIndex: number;
      baseSofrRate: number;
      spreadBps: number;
      allInRate: number;
      allInRateCapped: number;
    }[];
  }>({
    queryKey: ['sofr-forward-rates', holdYearsForMarket, spreadBpsForMarket],
    queryFn: async () => {
      const params = new URLSearchParams({ spreadBps: String(spreadBpsForMarket) });
      if (capitalMarketsParams?.debtFloor) params.set('rateFloor', capitalMarketsParams.debtFloor);
      const res = await fetch(`/api/capital-markets/sofr-forward-rates/${holdYearsForMarket}?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch forward rates');
      return res.json();
    },
  });

  const debtForm = useForm<DebtTrancheFormData>({
    resolver: zodResolver(debtTrancheFormSchema),
    defaultValues: {
      name: '',
      trancheType: 'senior',
      lenderName: '',
      principal: '',
      interestRate: '',
      indexRate: 'fixed',
      spreadBps: '',
      floorRate: '',
      termYears: '10',
      amortizationYears: '30',
      interestOnlyMonths: '0',
      originationFeePct: '0.01',
      exitFeePct: '0',
      prepaymentPenalty: '',
      minDscr: '1.25',
      maxLtv: '0.75',
      minDebtYield: '',
    },
  });

  const equityForm = useForm<EquityLayerFormData>({
    resolver: zodResolver(equityLayerFormSchema),
    defaultValues: {
      name: '',
      layerType: 'common',
      investorName: '',
      investorType: 'lp',
      commitmentAmount: '',
      fundedAmount: '',
      ownershipPct: '',
      preferredReturn: '',
      preferredReturnType: 'simple',
      isParticipating: true,
      catchUpPct: '',
      promoteTiers: [],
    },
  });

  useEffect(() => {
    if (capitalMarketsParams && !editingDebt) {
      debtForm.reset({
        name: 'SOFR Floating Rate',
        trancheType: 'senior',
        lenderName: '',
        principal: '',
        interestRate: '',
        indexRate: capitalMarketsParams.debtIndex || 'SOFR',
        spreadBps: capitalMarketsParams.debtSpread || '250',
        floorRate: capitalMarketsParams.debtFloor || '',
        termYears: capitalMarketsParams.debtTerm || '10',
        amortizationYears: '30',
        interestOnlyMonths: '0',
        originationFeePct: '0.01',
        exitFeePct: '0',
        prepaymentPenalty: '',
        minDscr: '1.25',
        maxLtv: '0.75',
        minDebtYield: '',
      });
    }
  }, [capitalMarketsParams]);

  useEffect(() => {
    if (editingDebt) {
      debtForm.reset({
        name: editingDebt.name,
        trancheType: editingDebt.trancheType,
        lenderName: editingDebt.lenderName || '',
        principal: editingDebt.principal?.toString() || '',
        interestRate: editingDebt.interestRate?.toString() || '',
        indexRate: editingDebt.indexRate || 'fixed',
        spreadBps: editingDebt.spreadBps?.toString() || '',
        floorRate: editingDebt.floorRate?.toString() || '',
        termYears: editingDebt.termYears?.toString() || '',
        amortizationYears: editingDebt.amortizationYears?.toString() || '',
        interestOnlyMonths: editingDebt.interestOnlyMonths?.toString() || '0',
        originationFeePct: editingDebt.originationFeePct?.toString() || '0.01',
        exitFeePct: editingDebt.exitFeePct?.toString() || '0',
        prepaymentPenalty: editingDebt.prepaymentPenalty || '',
        minDscr: editingDebt.minDscr?.toString() || '',
        maxLtv: editingDebt.maxLtv?.toString() || '',
        minDebtYield: editingDebt.minDebtYield?.toString() || '',
      });
      setShowAddDebt(true);
    }
  }, [editingDebt, debtForm]);

  useEffect(() => {
    if (editingEquity) {
      const tiers = editingEquity.promoteTiers as { irrHurdle: number; gpSplit: number; lpSplit: number }[] || [];
      setPromoteTiers(tiers.length > 0 ? tiers : [{ irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 }]);
      equityForm.reset({
        name: editingEquity.name,
        layerType: editingEquity.layerType,
        investorName: editingEquity.investorName || '',
        investorType: editingEquity.investorType || 'lp',
        commitmentAmount: editingEquity.commitmentAmount?.toString() || '',
        fundedAmount: editingEquity.fundedAmount?.toString() || '',
        ownershipPct: editingEquity.ownershipPct?.toString() || '',
        preferredReturn: editingEquity.preferredReturn?.toString() || '',
        preferredReturnType: editingEquity.preferredReturnType || 'simple',
        isParticipating: editingEquity.isParticipating ?? true,
        catchUpPct: editingEquity.catchUpPct?.toString() || '',
        promoteTiers: tiers,
      });
      setShowAddEquity(true);
    }
  }, [editingEquity, equityForm]);

  const createStackMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/modeling/projects/${projectId}/capital-stacks`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'] });
      setShowCreateStack(false);
      toast({ title: 'Capital stack created' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create capital stack', description: error.message, variant: 'destructive' });
    },
  });

  const deleteStackMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/modeling/capital-stacks/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'] });
      setSelectedStackId(null);
      toast({ title: 'Capital stack deleted' });
    },
  });

  const createDebtMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/modeling/capital-stacks/${selectedStackId}/debt-tranches`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      setShowAddDebt(false);
      setEditingDebt(null);
      debtForm.reset();
      toast({ title: 'Debt tranche added' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add debt tranche', description: error.message, variant: 'destructive' });
    },
  });

  const updateDebtMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/modeling/debt-tranches/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      setShowAddDebt(false);
      setEditingDebt(null);
      debtForm.reset();
      toast({ title: 'Debt tranche updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update debt tranche', description: error.message, variant: 'destructive' });
    },
  });

  const deleteDebtMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/modeling/debt-tranches/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      toast({ title: 'Debt tranche deleted' });
    },
  });

  const createEquityMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/modeling/capital-stacks/${selectedStackId}/equity-layers`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      setShowAddEquity(false);
      setEditingEquity(null);
      equityForm.reset();
      setPromoteTiers([{ irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 }]);
      toast({ title: 'Equity layer added' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add equity layer', description: error.message, variant: 'destructive' });
    },
  });

  const updateEquityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PATCH', `/api/modeling/equity-layers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      setShowAddEquity(false);
      setEditingEquity(null);
      equityForm.reset();
      setPromoteTiers([{ irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 }]);
      toast({ title: 'Equity layer updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update equity layer', description: error.message, variant: 'destructive' });
    },
  });

  const deleteEquityMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/modeling/equity-layers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      toast({ title: 'Equity layer deleted' });
    },
  });

  const generateProjectionsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/modeling/capital-stacks/${selectedStackId}/projections/generate`, {
        method: 'POST',
        body: JSON.stringify({ noi: parseFloat(noi), noiGrowthRate: parseFloat(noiGrowthRate) }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
      toast({ title: 'Projections generated' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to generate projections', description: error.message, variant: 'destructive' });
    },
  });

  // Fund inheritance mutations
  const linkFundMutation = useMutation({
    mutationFn: async (data: { fundId: string; templateId?: string }) => {
      const allocationResult = await apiRequest(`/api/funds/allocations`, {
        method: 'POST',
        body: JSON.stringify({
          fundId: data.fundId,
          modelingProjectId: projectId,
          allocationPct: '1.0',
          allocatedEquity: '0',
          usesFundCapitalStack: true,
          capitalStackTemplateId: data.templateId || null,
        }),
      });
      
      if (data.templateId) {
        await apiRequest(`/api/modeling/projects/${projectId}/capital-stacks/apply-template`, {
          method: 'POST',
          body: JSON.stringify({ templateId: data.templateId }),
        });
      }
      
      return allocationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/funds/allocations/by-project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/funds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'] });
      setShowFundInheritance(false);
      toast({ title: 'Fund linked successfully', description: 'This deal now inherits the fund\'s capital structure' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to link fund', description: error.message, variant: 'destructive' });
    },
  });

  const unlinkFundMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      return apiRequest(`/api/funds/allocations/${allocationId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/funds/allocations/by-project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/funds'] });
      toast({ title: 'Fund unlinked', description: 'This deal will now use its own capital structure' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to unlink fund', description: error.message, variant: 'destructive' });
    },
  });

  const toggleInheritanceMutation = useMutation({
    mutationFn: async (useInheritance: boolean) => {
      if (!dealAllocation) throw new Error('No fund allocation found');
      return apiRequest(`/api/funds/allocations/${dealAllocation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ usesFundCapitalStack: useInheritance }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/funds/allocations/by-project', projectId] });
      toast({ title: 'Inheritance setting updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update inheritance', description: error.message, variant: 'destructive' });
    },
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest(`/api/modeling/projects/${projectId}/capital-stacks/apply-template`, {
        method: 'POST',
        body: JSON.stringify({ templateId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'] });
      toast({ title: 'Template applied', description: 'Capital stack created from fund template' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to apply template', description: error.message, variant: 'destructive' });
    },
  });

  const handleDebtSubmit = (data: DebtTrancheFormData) => {
    const payload = {
      name: data.name,
      trancheType: data.trancheType,
      lenderName: data.lenderName || null,
      principal: data.principal,
      interestRate: data.interestRate,
      indexRate: data.indexRate === 'fixed' ? null : data.indexRate,
      spreadBps: data.spreadBps ? parseInt(data.spreadBps) : null,
      floorRate: data.floorRate || null,
      termYears: parseInt(data.termYears),
      amortizationYears: data.amortizationYears ? parseInt(data.amortizationYears) : null,
      interestOnlyMonths: data.interestOnlyMonths ? parseInt(data.interestOnlyMonths) : 0,
      originationFeePct: data.originationFeePct || '0.01',
      exitFeePct: data.exitFeePct || '0',
      prepaymentPenalty: data.prepaymentPenalty || null,
      minDscr: data.minDscr || null,
      maxLtv: data.maxLtv || null,
      minDebtYield: data.minDebtYield || null,
      priority: (stackDetails?.debtTranches.length || 0) + 1,
    };

    if (editingDebt) {
      updateDebtMutation.mutate({ id: editingDebt.id, data: payload });
    } else {
      createDebtMutation.mutate(payload);
    }
  };

  const handleEquitySubmit = (data: EquityLayerFormData) => {
    const ownershipValue = parseFloat(data.ownershipPct) || 0;
    const normalizedOwnership = ownershipValue > 1 ? ownershipValue / 100 : ownershipValue;
    const prefReturnValue = parseFloat(data.preferredReturn || '0');
    const normalizedPrefReturn = prefReturnValue > 1 ? prefReturnValue / 100 : prefReturnValue;
    const catchUpValue = parseFloat(data.catchUpPct || '0');
    const normalizedCatchUp = catchUpValue > 1 ? catchUpValue / 100 : catchUpValue;
    
    const payload = {
      name: data.name,
      layerType: data.layerType,
      investorName: data.investorName || null,
      investorType: data.investorType || null,
      commitmentAmount: data.commitmentAmount,
      fundedAmount: data.fundedAmount || '0',
      ownershipPct: String(normalizedOwnership),
      preferredReturn: data.preferredReturn ? String(normalizedPrefReturn) : null,
      preferredReturnType: data.preferredReturnType || null,
      isParticipating: data.isParticipating ?? true,
      catchUpPct: data.catchUpPct ? String(normalizedCatchUp) : null,
      promoteTiers: data.layerType === 'promote' ? promoteTiers : null,
      waterfallPriority: (stackDetails?.equityLayers.length || 0) + 1,
    };

    if (editingEquity) {
      updateEquityMutation.mutate({ id: editingEquity.id, data: payload });
    } else {
      createEquityMutation.mutate(payload);
    }
  };

  const addPromoteTier = () => {
    const lastTier = promoteTiers[promoteTiers.length - 1];
    setPromoteTiers([
      ...promoteTiers,
      {
        irrHurdle: lastTier ? lastTier.irrHurdle + 0.05 : 0.12,
        gpSplit: Math.min((lastTier?.gpSplit || 0.20) + 0.10, 0.50),
        lpSplit: Math.max((lastTier?.lpSplit || 0.80) - 0.10, 0.50),
      },
    ]);
  };

  const removePromoteTier = (index: number) => {
    setPromoteTiers(promoteTiers.filter((_, i) => i !== index));
  };

  const updatePromoteTier = (index: number, field: string, value: number) => {
    const updated = [...promoteTiers];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'gpSplit') {
      updated[index].lpSplit = 1 - value;
    } else if (field === 'lpSplit') {
      updated[index].gpSplit = 1 - value;
    }
    setPromoteTiers(updated);
  };

  if (stacksLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const stack = stackDetails?.stack;
  const debtTranches = stackDetails?.debtTranches || [];
  const equityLayers = stackDetails?.equityLayers || [];
  const projections = stackDetails?.projections || [];

  const totalDebt = debtTranches.reduce((sum, t) => sum + parseNumber(t.principal), 0);
  const totalEquity = equityLayers.reduce((sum, l) => sum + parseNumber(l.commitmentAmount), 0);
  const totalCap = totalDebt + totalEquity;
  const ltv = totalCap > 0 ? (totalDebt / totalCap) * 100 : 0;
  const annualDebtService = debtTranches.reduce((sum, t) => sum + parseNumber(t.annualDebtService), 0);

  const layerType = equityForm.watch('layerType');

  // ── Smart Equity: Auto-calculate from purchase price & debt ──
  const purchasePrice = parseNumber(stackDetails?.stack?.purchasePrice) || 0;
  const computedEquity = Math.max(0, purchasePrice - totalDebt);
  const hasComputedEquity = purchasePrice > 0;

  // ── Refi Scenario State ──
  const [refiYear, setRefiYear] = useState<number>(3);
  const [refiRate, setRefiRate] = useState<string>('5.5');
  const [refiTermYears, setRefiTermYears] = useState<string>('10');
  const [refiAmortYears, setRefiAmortYears] = useState<string>('30');
  const [refiLtv, setRefiLtv] = useState<string>('65');
  const [refiIoMonths, setRefiIoMonths] = useState<string>('0');

  // Dynamic partner rows for Partnership/JV structures
  const [equityPartners, setEquityPartners] = useState<{
    id: string;
    name: string;
    role: 'gp' | 'lp' | 'partner';
    amount: string;
    ownershipPct: string;
  }[]>([]);

  // Initialize partner rows when equity type changes
  useEffect(() => {
    if (layerType === 'solo' && !editingEquity) {
      // Solo: auto-fill total equity and 100% ownership
      if (hasComputedEquity) {
        equityForm.setValue('commitmentAmount', String(Math.round(computedEquity)));
      }
      equityForm.setValue('ownershipPct', '100');
      setEquityPartners([]);
    } else if (layerType === 'partnership' && !editingEquity) {
      // Partnership: 2 partners, split equity evenly
      if (equityPartners.length === 0) {
        const halfEquity = Math.round(computedEquity / 2);
        setEquityPartners([
          { id: crypto.randomUUID(), name: 'Partner 1', role: 'partner', amount: hasComputedEquity ? String(halfEquity) : '', ownershipPct: '50' },
          { id: crypto.randomUUID(), name: 'Partner 2', role: 'partner', amount: hasComputedEquity ? String(halfEquity) : '', ownershipPct: '50' },
        ]);
      }
      if (hasComputedEquity) {
        equityForm.setValue('commitmentAmount', String(Math.round(computedEquity)));
      }
    } else if ((layerType === 'promote' || layerType === 'co_invest') && !editingEquity) {
      // GP/LP structures: default GP 10% / LP 90%
      if (equityPartners.length === 0) {
        const gpAmount = Math.round(computedEquity * 0.1);
        const lpAmount = Math.round(computedEquity * 0.9);
        setEquityPartners([
          { id: crypto.randomUUID(), name: 'GP Sponsor', role: 'gp', amount: hasComputedEquity ? String(gpAmount) : '', ownershipPct: '10' },
          { id: crypto.randomUUID(), name: 'LP Investor', role: 'lp', amount: hasComputedEquity ? String(lpAmount) : '', ownershipPct: '90' },
        ]);
      }
      if (hasComputedEquity) {
        equityForm.setValue('commitmentAmount', String(Math.round(computedEquity)));
      }
    }
  }, [layerType]);

  // Reactively update commitment when debt or purchase price changes
  useEffect(() => {
    if (hasComputedEquity && !editingEquity) {
      const currentType = equityForm.getValues('layerType');
      equityForm.setValue('commitmentAmount', String(Math.round(computedEquity)));
      
      // Redistribute among partners
      if (equityPartners.length > 0) {
        setEquityPartners(prev => prev.map(p => {
          const pct = parseFloat(p.ownershipPct) || 0;
          return { ...p, amount: String(Math.round(computedEquity * pct / 100)) };
        }));
      }
    }
  }, [computedEquity]);

  // Partner helper functions
  const addEquityPartner = () => {
    const remaining = 100 - equityPartners.reduce((s, p) => s + (parseFloat(p.ownershipPct) || 0), 0);
    setEquityPartners([...equityPartners, {
      id: crypto.randomUUID(),
      name: layerType === 'promote' || layerType === 'co_invest'
        ? `LP Investor ${equityPartners.filter(p => p.role === 'lp').length + 1}`
        : `Partner ${equityPartners.length + 1}`,
      role: layerType === 'promote' || layerType === 'co_invest' ? 'lp' : 'partner',
      amount: hasComputedEquity ? String(Math.round(computedEquity * Math.max(0, remaining) / 100)) : '',
      ownershipPct: String(Math.max(0, remaining).toFixed(1)),
    }]);
  };

  const removeEquityPartner = (id: string) => {
    if (equityPartners.length > 2) {
      setEquityPartners(equityPartners.filter(p => p.id !== id));
    }
  };

  const updateEquityPartner = (id: string, field: string, value: string) => {
    setEquityPartners(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      // When ownership % changes, recalc amount
      if (field === 'ownershipPct' && hasComputedEquity) {
        updated.amount = String(Math.round(computedEquity * (parseFloat(value) || 0) / 100));
      }
      // When amount changes, recalc ownership %
      if (field === 'amount' && computedEquity > 0) {
        updated.ownershipPct = ((parseFloat(value) || 0) / computedEquity * 100).toFixed(1);
      }
      return updated;
    }));
  };

  const totalPartnerOwnership = equityPartners.reduce((s, p) => s + (parseFloat(p.ownershipPct) || 0), 0);
  const totalPartnerAmount = equityPartners.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  return (
    <div className="space-y-6" ref={pdfRef}>
      {onTabChange && (
        <WorkflowNavigation currentTab="capital" onNavigate={onTabChange} />
      )}

      <div className="flex items-center justify-end">
        <ExportPdfButton contentRef={pdfRef} filename="capital-stack" title="Capital Stack" />
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="capital-stack" className="gap-2">
            <Building2 className="h-4 w-4" />
            Capital Stack
          </TabsTrigger>
          <TabsTrigger value="advanced-debt" className="gap-2">
            <Layers className="h-4 w-4" />
            Advanced Debt
          </TabsTrigger>
          <TabsTrigger value="debt-scenarios" className="gap-2">
            <Calculator className="h-4 w-4" />
            Debt Scenarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="advanced-debt" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Multi-Loan Debt Modeling</CardTitle>
              <CardDescription>
                Build complex loan structures, view blended metrics, compare scenarios, and run DSCR covenant testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoanBuilder 
                projectId={projectId}
                purchasePrice={stackDetails?.stack?.purchasePrice ? parseNumber(stackDetails.stack.purchasePrice) : 10000000}
                noi={parseFloat(noi) || 1000000}
                onUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debt-scenarios" className="space-y-6">
          <WorkspaceDebtScenarios projectId={projectId} onTabChange={onTabChange} />
        </TabsContent>

        <TabsContent value="capital-stack" className="space-y-6">

      {capitalMarketsParams && (
        <Alert className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
          <Landmark className="h-4 w-4 text-indigo-600" />
          <AlertTitle className="text-indigo-800 dark:text-indigo-200">Capital Markets Configuration Active</AlertTitle>
          <AlertDescription className="text-indigo-700 dark:text-indigo-300">
            {capitalMarketsParams.debtIndex || 'SOFR'} + {capitalMarketsParams.debtSpread || '250'}bps over {capitalMarketsParams.debtTerm || '5'}-year hold
            {capitalMarketsParams.debtFloor ? ` · Floor: ${(parseFloat(capitalMarketsParams.debtFloor) * 100).toFixed(1)}%` : ''}
            . Add a new floating-rate tranche below to use these rates, or view the forward curve in the Market Rates panel.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Capital Stack Builder</h2>
          <p className="text-muted-foreground">Configure multi-tranche debt, equity layers, and waterfall distributions</p>
        </div>
        <Dialog open={showCreateStack} onOpenChange={(open) => { setShowCreateStack(open); if (!open) resetWizard(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-capital-stack">
              <Plus className="h-4 w-4 mr-2" />
              New Capital Stack
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="shrink-0 px-6 pt-6 pb-3">
              <div className="flex items-center justify-between mb-2">
                <DialogTitle className="flex items-center gap-2">
                  <Anchor className="h-5 w-5 text-[#1E4FAB]" />
                  Create Capital Stack
                </DialogTitle>
                <div className="flex items-center gap-1.5 mr-6 -mt-1">
                  {WIZARD_STEPS.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "w-2.5 h-2.5 rounded-full transition-colors border cursor-pointer",
                        wizardStep >= s.id
                          ? "bg-[#1E4FAB] border-[#1E4FAB]"
                          : "bg-transparent border-[#1E4FAB]/30"
                      )}
                      onClick={() => {
                        if (s.id > wizardStep) {
                          if (!wizardStackName.trim()) { toast({ title: 'Stack name is required', variant: 'destructive' }); return; }
                          if (s.id > 2 && !parseFloat(wizardPurchasePrice)) { toast({ title: 'Purchase price is required', variant: 'destructive' }); return; }
                        }
                        setWizardStep(s.id);
                      }}
                    />
                  ))}
                </div>
              </div>
              <Progress value={wizardProgress} className="h-1" />
              <DialogDescription className="text-sm text-muted-foreground pt-1">
                Step {wizardStep} of {WIZARD_STEPS.length}: {WIZARD_STEPS.find(s => s.id === wizardStep)?.title}
              </DialogDescription>
            </DialogHeader>

            <div ref={wizardScrollRef} className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Settings2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">Stack Details</h3>
                      <p className="text-sm text-muted-foreground">Name and describe this capital structure scenario</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="wizard-name">Stack Name *</Label>
                      <Input id="wizard-name" value={wizardStackName} onChange={(e) => setWizardStackName(e.target.value)} placeholder="e.g., Base Case, Conservative, Aggressive" />
                    </div>
                    <div>
                      <Label htmlFor="wizard-description">Description</Label>
                      <Textarea id="wizard-description" value={wizardStackDescription} onChange={(e) => setWizardStackDescription(e.target.value)} placeholder="Deal assumptions, strategy notes, and key considerations..." rows={3} />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">Uses of Funds</h3>
                      <p className="text-sm text-muted-foreground">Define the total capital required for this deal</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Purchase Price *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="number" value={wizardPurchasePrice} onChange={(e) => setWizardPurchasePrice(e.target.value)} placeholder="10,000,000" className="pl-8" />
                      </div>
                    </div>
                    <div>
                      <Label>Closing Costs</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="number" value={wizardClosingCosts} onChange={(e) => setWizardClosingCosts(e.target.value)} placeholder="150,000" className="pl-8" />
                      </div>
                    </div>
                    <div>
                      <Label>CapEx Reserves</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="number" value={wizardCapexReserves} onChange={(e) => setWizardCapexReserves(e.target.value)} placeholder="200,000" className="pl-8" />
                      </div>
                    </div>
                    <div>
                      <Label>Working Capital</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="number" value={wizardWorkingCapital} onChange={(e) => setWizardWorkingCapital(e.target.value)} placeholder="50,000" className="pl-8" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <Landmark className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">Advanced Debt</h3>
                        <p className="text-sm text-muted-foreground">Configure up to 10 lenders side-by-side</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addWizardLender}
                      disabled={wizardLenders.length >= 10}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Lender ({wizardLenders.length}/10)
                    </Button>
                  </div>

                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                          <th className="sticky left-0 bg-slate-50 dark:bg-slate-800/50 z-10 text-left px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[160px] border-r">Field</th>
                          {wizardLenders.map((lender, i) => (
                            <th key={lender.id} className="text-center px-2 py-2 min-w-[150px]">
                              <div className="flex items-center justify-center gap-1">
                                <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                                  {i + 1}
                                </Badge>
                                {wizardLenders.length > 1 && (
                                  <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-400 hover:text-red-600" onClick={() => removeWizardLender(lender.id)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="sticky left-0 bg-white dark:bg-background z-10 px-3 py-1.5 text-xs font-medium border-r">Lender Name</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" value={l.lenderName} onChange={(e) => updateWizardLender(l.id, 'lenderName', e.target.value)} placeholder="Lender name" />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t bg-slate-50/50 dark:bg-slate-800/20">
                          <td className="sticky left-0 bg-slate-50/50 dark:bg-slate-800/20 z-10 px-3 py-1.5 text-xs font-medium border-r">Loan Type</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Select value={l.trancheType} onValueChange={(v) => updateWizardLender(l.id, 'trancheType', v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {DEBT_TRANCHE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t">
                          <td className="sticky left-0 bg-white dark:bg-background z-10 px-3 py-1.5 text-xs font-medium border-r">Principal ($)</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" type="number" value={l.principal} onChange={(e) => updateWizardLender(l.id, 'principal', e.target.value)} placeholder="5,000,000" />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t bg-slate-50/50 dark:bg-slate-800/20">
                          <td className="sticky left-0 bg-slate-50/50 dark:bg-slate-800/20 z-10 px-3 py-1.5 text-xs font-medium border-r">Rate Type</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Select value={l.indexRate} onValueChange={(v) => updateWizardLender(l.id, 'indexRate', v)}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {INDEX_RATES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t">
                          <td className="sticky left-0 bg-white dark:bg-background z-10 px-3 py-1.5 text-xs font-medium border-r">Interest Rate (%)</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" type="number" step="0.01" value={l.interestRate} onChange={(e) => updateWizardLender(l.id, 'interestRate', e.target.value)} placeholder="5.50" />
                            </td>
                          ))}
                        </tr>
                        {wizardLenders.some(l => l.indexRate !== 'fixed') && (
                          <>
                            <tr className="border-t bg-slate-50/50 dark:bg-slate-800/20">
                              <td className="sticky left-0 bg-slate-50/50 dark:bg-slate-800/20 z-10 px-3 py-1.5 text-xs font-medium border-r">Spread (bps)</td>
                              {wizardLenders.map(l => (
                                <td key={l.id} className="px-2 py-1.5">
                                  <Input className="h-7 text-xs" type="number" value={l.spreadBps} onChange={(e) => updateWizardLender(l.id, 'spreadBps', e.target.value)} placeholder="250" disabled={l.indexRate === 'fixed'} />
                                </td>
                              ))}
                            </tr>
                            <tr className="border-t">
                              <td className="sticky left-0 bg-white dark:bg-background z-10 px-3 py-1.5 text-xs font-medium border-r">Floor Rate (%)</td>
                              {wizardLenders.map(l => (
                                <td key={l.id} className="px-2 py-1.5">
                                  <Input className="h-7 text-xs" type="number" step="0.01" value={l.floorRate} onChange={(e) => updateWizardLender(l.id, 'floorRate', e.target.value)} placeholder="4.00" disabled={l.indexRate === 'fixed'} />
                                </td>
                              ))}
                            </tr>
                          </>
                        )}
                        <tr className="border-t bg-blue-50/30 dark:bg-blue-950/10">
                          <td colSpan={wizardLenders.length + 1} className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">Loan Structure</td>
                        </tr>
                        <tr className="border-t">
                          <td className="sticky left-0 bg-white dark:bg-background z-10 px-3 py-1.5 text-xs font-medium border-r">Term (Years)</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" type="number" value={l.termYears} onChange={(e) => updateWizardLender(l.id, 'termYears', e.target.value)} placeholder="10" />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t bg-slate-50/50 dark:bg-slate-800/20">
                          <td className="sticky left-0 bg-slate-50/50 dark:bg-slate-800/20 z-10 px-3 py-1.5 text-xs font-medium border-r">Amortization (Years)</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" type="number" value={l.amortizationYears} onChange={(e) => updateWizardLender(l.id, 'amortizationYears', e.target.value)} placeholder="25" />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t">
                          <td className="sticky left-0 bg-white dark:bg-background z-10 px-3 py-1.5 text-xs font-medium border-r">IO Period (Months)</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" type="number" value={l.interestOnlyMonths} onChange={(e) => updateWizardLender(l.id, 'interestOnlyMonths', e.target.value)} placeholder="12" />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t bg-blue-50/30 dark:bg-blue-950/10">
                          <td colSpan={wizardLenders.length + 1} className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">Fees & Covenants</td>
                        </tr>
                        <tr className="border-t bg-slate-50/50 dark:bg-slate-800/20">
                          <td className="sticky left-0 bg-slate-50/50 dark:bg-slate-800/20 z-10 px-3 py-1.5 text-xs font-medium border-r">Origination Fee (%)</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" type="number" step="0.1" value={l.originationFeePct} onChange={(e) => updateWizardLender(l.id, 'originationFeePct', e.target.value)} placeholder="1.0" />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t">
                          <td className="sticky left-0 bg-white dark:bg-background z-10 px-3 py-1.5 text-xs font-medium border-r">Exit Fee (%)</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" type="number" step="0.1" value={l.exitFeePct} onChange={(e) => updateWizardLender(l.id, 'exitFeePct', e.target.value)} placeholder="0" />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t bg-slate-50/50 dark:bg-slate-800/20">
                          <td className="sticky left-0 bg-slate-50/50 dark:bg-slate-800/20 z-10 px-3 py-1.5 text-xs font-medium border-r">Prepayment Terms</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" value={l.prepaymentPenalty} onChange={(e) => updateWizardLender(l.id, 'prepaymentPenalty', e.target.value)} placeholder="5-4-3-2-1" />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t">
                          <td className="sticky left-0 bg-white dark:bg-background z-10 px-3 py-1.5 text-xs font-medium border-r">Min DSCR</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" type="number" step="0.01" value={l.minDscr} onChange={(e) => updateWizardLender(l.id, 'minDscr', e.target.value)} placeholder="1.25" />
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t bg-slate-50/50 dark:bg-slate-800/20">
                          <td className="sticky left-0 bg-slate-50/50 dark:bg-slate-800/20 z-10 px-3 py-1.5 text-xs font-medium border-r">Max LTV (%)</td>
                          {wizardLenders.map(l => (
                            <td key={l.id} className="px-2 py-1.5">
                              <Input className="h-7 text-xs" type="number" step="0.1" value={l.maxLtv} onChange={(e) => updateWizardLender(l.id, 'maxLtv', e.target.value)} placeholder="75" />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {wizardLenders.some(l => parseFloat(l.principal) > 0) && (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-indigo-700 dark:text-indigo-300">Total Debt:</span>
                        <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                          {formatCurrency(wizardLenders.reduce((sum, l) => sum + (parseFloat(l.principal) || 0), 0))}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                        <span>Active Lenders:</span>
                        <span>{wizardLenders.filter(l => parseFloat(l.principal) > 0).length}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">Capital Partners</h3>
                        <p className="text-sm text-muted-foreground">Add GP and LP partners with contributions and ownership</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addStackPartner}>
                      <Plus className="h-4 w-4 mr-1" /> Add Partner
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {stackPartners.map((partner) => (
                      <Card key={partner.id} className={cn("p-3", partner.type === 'gp' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 'bg-white dark:bg-background border-green-200 dark:border-green-800')}>
                        <div className="flex items-center gap-3">
                          <Badge variant={partner.type === 'gp' ? 'default' : 'secondary'} className={partner.type === 'gp' ? 'bg-amber-600' : 'bg-green-600 text-white'}>
                            {partner.type === 'gp' ? 'GP' : 'LP'}
                          </Badge>
                          <div className="flex-1 grid grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs">Partner Name</Label>
                              <Input value={partner.name} onChange={(e) => updateStackPartner(partner.id, 'name', e.target.value)} placeholder="Partner name" className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Commitment ($)</Label>
                              <Input type="number" value={partner.commitmentAmount} onChange={(e) => updateStackPartner(partner.id, 'commitmentAmount', e.target.value)} placeholder="1,000,000" className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Ownership %</Label>
                              <Input type="number" value={partner.ownershipPct} onChange={(e) => updateStackPartner(partner.id, 'ownershipPct', e.target.value)} placeholder="25" className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Pref Return %</Label>
                              <Input type="number" value={partner.preferredReturn} onChange={(e) => updateStackPartner(partner.id, 'preferredReturn', e.target.value)} placeholder="8" className="h-8 text-sm" />
                            </div>
                          </div>
                          <Select value={partner.type} onValueChange={(v) => updateStackPartner(partner.id, 'type', v)}>
                            <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gp">GP</SelectItem>
                              <SelectItem value="lp">LP</SelectItem>
                            </SelectContent>
                          </Select>
                          {stackPartners.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 w-8 p-0" onClick={() => removeStackPartner(partner.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border">
                    <div className="flex justify-between text-sm">
                      <span>Total Commitment:</span>
                      <span className="font-semibold">{formatCurrency(totalPartnerCommitment)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span>Total Ownership:</span>
                      <span className={cn("font-semibold", totalOwnership === 100 ? 'text-green-600' : totalOwnership > 100 ? 'text-red-600' : 'text-amber-600')}>
                        {totalOwnership.toFixed(1)}%
                        {totalOwnership !== 100 && <span className="text-xs ml-1">({totalOwnership < 100 ? `${(100 - totalOwnership).toFixed(1)}% remaining` : 'exceeds 100%'})</span>}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <PieChart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">Promote / Waterfall Tiers</h3>
                        <p className="text-sm text-muted-foreground">Define tiered promote structure based on IRR hurdles</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addStackPromoteTier}>
                      <Plus className="h-4 w-4 mr-1" /> Add Tier
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {stackPromoteTiers.map((tier, index) => (
                      <Card key={tier.id} className="p-3 bg-white dark:bg-background border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-purple-600 text-white">Tier {index + 1}</Badge>
                          <div className="flex-1 grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs">IRR Hurdle (%)</Label>
                              <div className="relative">
                                <Percent className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input type="number" value={tier.irrHurdle} onChange={(e) => updateStackPromoteTier(tier.id, 'irrHurdle', e.target.value)} placeholder="8" className="h-8 text-sm pl-7" />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-green-700 dark:text-green-400">GP Split (%)</Label>
                              <div className="relative">
                                <Percent className="absolute left-2 top-2 h-3.5 w-3.5 text-green-600" />
                                <Input type="number" value={tier.gpSplit} onChange={(e) => updateStackPromoteTier(tier.id, 'gpSplit', e.target.value)} placeholder="20" className="h-8 text-sm pl-7 border-green-200" />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-blue-700 dark:text-blue-400">LP Split (%)</Label>
                              <div className="relative">
                                <Percent className="absolute left-2 top-2 h-3.5 w-3.5 text-blue-600" />
                                <Input type="number" value={tier.lpSplit} onChange={(e) => updateStackPromoteTier(tier.id, 'lpSplit', e.target.value)} placeholder="80" className="h-8 text-sm pl-7 border-blue-200" />
                              </div>
                            </div>
                          </div>
                          {stackPromoteTiers.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 w-8 p-0" onClick={() => removeStackPromoteTier(tier.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="mt-2 p-2 bg-purple-50 dark:bg-purple-950/20 rounded text-xs text-purple-700 dark:text-purple-300">
                          Above {tier.irrHurdle}% IRR: GP receives {tier.gpSplit}%, LP receives {tier.lpSplit}%
                        </div>
                      </Card>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border">
                    <h5 className="text-xs font-medium mb-2 text-muted-foreground">Waterfall Summary</h5>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>1. Return of Capital</span>
                        <span className="text-muted-foreground">100% to Investors</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2. Preferred Return</span>
                        <span className="text-muted-foreground">100% to LPs (until pref met)</span>
                      </div>
                      {stackPromoteTiers.map((tier, i) => (
                        <div key={tier.id} className="flex justify-between">
                          <span>{i + 3}. Above {tier.irrHurdle}% IRR</span>
                          <span className="text-muted-foreground">GP {tier.gpSplit}% / LP {tier.lpSplit}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 6 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">Exit Strategy</h3>
                      <p className="text-sm text-muted-foreground">Define hold period and exit assumptions</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Hold Period (Years)</Label>
                      <Input type="number" value={wizardHoldPeriod} onChange={(e) => setWizardHoldPeriod(e.target.value)} placeholder="5" />
                    </div>
                    <div>
                      <Label>Exit Cap Rate (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="number" step="0.1" value={wizardExitCapRate} onChange={(e) => setWizardExitCapRate(e.target.value)} placeholder="7" className="pl-8" />
                      </div>
                    </div>
                    <div>
                      <Label>NOI Growth Rate (%)</Label>
                      <div className="relative">
                        <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="number" step="0.1" value={wizardNoiGrowthRate} onChange={(e) => setWizardNoiGrowthRate(e.target.value)} placeholder="2" className="pl-8" />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <h5 className="text-sm font-medium mb-3 text-orange-700 dark:text-orange-300">Summary</h5>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Debt:</span>
                        <span className="font-medium">{formatCurrency(wizardLenders.reduce((sum, l) => sum + (parseFloat(l.principal) || 0), 0))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Equity:</span>
                        <span className="font-medium">{formatCurrency(totalPartnerCommitment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lenders:</span>
                        <span className="font-medium">{wizardLenders.filter(l => parseFloat(l.principal) > 0).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Partners:</span>
                        <span className="font-medium">{stackPartners.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Promote Tiers:</span>
                        <span className="font-medium">{stackPromoteTiers.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ownership:</span>
                        <span className={cn("font-medium", totalOwnership === 100 ? 'text-green-600' : 'text-amber-600')}>{totalOwnership.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between px-6 py-4 border-t shrink-0">
              <Button variant="ghost" onClick={handleWizardBack} disabled={wizardStep === 1}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => { setShowCreateStack(false); resetWizard(); }}>
                  Cancel
                </Button>
                {wizardStep < WIZARD_STEPS.length ? (
                  <Button onClick={handleWizardNext} className="bg-[#1E4FAB] hover:bg-[#1a4294]">
                    Continue
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    className="bg-[#1E4FAB] hover:bg-[#1a4294]"
                    disabled={createStackMutation.isPending}
                    onClick={() => {
                      const purchasePrice = parseFloat(wizardPurchasePrice) || 0;
                      const closingCosts = parseFloat(wizardClosingCosts) || 0;
                      const capexReserves = parseFloat(wizardCapexReserves) || 0;
                      const workingCapital = parseFloat(wizardWorkingCapital) || 0;

                      if (!wizardStackName.trim()) {
                        toast({ title: 'Stack name is required', variant: 'destructive' });
                        setWizardStep(1);
                        return;
                      }

                      createStackMutation.mutate({
                        name: wizardStackName,
                        description: wizardStackDescription,
                        purchasePrice,
                        closingCosts,
                        capexReserves,
                        workingCapital,
                        totalCapitalization: purchasePrice + closingCosts + capexReserves + workingCapital,
                        holdPeriodYears: parseInt(wizardHoldPeriod) || 5,
                        exitCapRate: wizardExitCapRate || '0.07',
                        noiGrowthRate: wizardNoiGrowthRate || '0.02',
                        partners: stackPartners.map(p => ({
                          name: p.name,
                          type: p.type,
                          commitmentAmount: parseFloat(p.commitmentAmount) || 0,
                          ownershipPct: (parseFloat(p.ownershipPct) || 0) / 100,
                          preferredReturn: (parseFloat(p.preferredReturn) || 0) / 100,
                        })),
                        promoteTiers: stackPromoteTiers.map(t => ({
                          irrHurdle: (parseFloat(t.irrHurdle) || 0) / 100,
                          gpSplit: (parseFloat(t.gpSplit) || 0) / 100,
                          lpSplit: (parseFloat(t.lpSplit) || 0) / 100,
                        })),
                        debtTranches: wizardLenders
                          .filter(l => parseFloat(l.principal) > 0)
                          .map((l, i) => ({
                            name: l.lenderName || `Tranche ${i + 1}`,
                            trancheType: l.trancheType,
                            lenderName: l.lenderName,
                            principal: parseFloat(l.principal) || 0,
                            interestRate: (parseFloat(l.interestRate) || 0) / 100,
                            indexRate: l.indexRate === 'fixed' ? null : l.indexRate,
                            spreadBps: parseInt(l.spreadBps) || 0,
                            floorRate: l.floorRate ? (parseFloat(l.floorRate) / 100).toString() : null,
                            termYears: parseInt(l.termYears) || 10,
                            amortizationYears: parseInt(l.amortizationYears) || 25,
                            interestOnlyMonths: parseInt(l.interestOnlyMonths) || 0,
                            originationFeePct: l.originationFeePct ? (parseFloat(l.originationFeePct) / 100).toString() : '0.01',
                            exitFeePct: l.exitFeePct ? (parseFloat(l.exitFeePct) / 100).toString() : '0',
                            prepaymentPenalty: l.prepaymentPenalty || null,
                            minDscr: l.minDscr ? l.minDscr : null,
                            maxLtv: l.maxLtv ? (parseFloat(l.maxLtv) / 100).toString() : null,
                            priority: i + 1,
                          })),
                      });
                    }}
                  >
                    {createStackMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : 'Create Stack'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <button
          onClick={() => setShowMarketRates(!showMarketRates)}
          className="w-full flex items-center justify-between p-4 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold">Market Rates & SOFR Forward Curve</h3>
              <p className="text-xs text-muted-foreground">
                {marketForwardRates?.forwardCurveAvailable 
                  ? `Live forward curve data · Avg rate: ${(marketForwardRates.yearlyRates.reduce((s, r) => s + r.allInRateCapped, 0) / marketForwardRates.yearlyRates.length * 100).toFixed(2)}% over ${holdYearsForMarket}yr`
                  : 'View current market conditions for debt pricing'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {marketForwardRates?.forwardCurveAvailable && (
              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                Live Data
              </Badge>
            )}
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showMarketRates ? 'rotate-90' : ''}`} />
          </div>
        </button>
        
        {showMarketRates && (
          <div className="px-4 pb-4 space-y-4">
            <Separator />
            {marketRatesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : marketForwardRates?.forwardCurveAvailable ? (
              <>
                <div className="grid grid-cols-4 gap-3">
                  <Card className="p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Current SOFR</p>
                    <p className="text-lg font-bold tabular-nums">{(marketForwardRates.yearlyRates[0]?.baseSofrRate * 100).toFixed(2)}%</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Avg Forward</p>
                    <p className="text-lg font-bold tabular-nums">
                      {(marketForwardRates.yearlyRates.reduce((s, r) => s + r.baseSofrRate, 0) / marketForwardRates.yearlyRates.length * 100).toFixed(2)}%
                    </p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">+250bps All-In</p>
                    <p className="text-lg font-bold tabular-nums">
                      {(marketForwardRates.yearlyRates.reduce((s, r) => s + r.allInRateCapped, 0) / marketForwardRates.yearlyRates.length * 100).toFixed(2)}%
                    </p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Hold Period</p>
                    <p className="text-lg font-bold tabular-nums">{holdYearsForMarket}yr</p>
                  </Card>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs py-1 h-auto">Year</TableHead>
                      <TableHead className="text-xs py-1 h-auto text-right">Base SOFR</TableHead>
                      <TableHead className="text-xs py-1 h-auto text-right">+250bps</TableHead>
                      <TableHead className="text-xs py-1 h-auto text-right font-semibold">All-In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marketForwardRates.yearlyRates.map((yr) => (
                      <TableRow key={yr.year} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30">
                        <TableCell className="text-xs py-1.5 font-medium">Yr {yr.yearIndex} ({yr.year})</TableCell>
                        <TableCell className="text-xs py-1.5 text-right tabular-nums">{(yr.baseSofrRate * 100).toFixed(2)}%</TableCell>
                        <TableCell className="text-xs py-1.5 text-right tabular-nums text-amber-600">+{yr.spreadBps}bps</TableCell>
                        <TableCell className="text-xs py-1.5 text-right tabular-nums font-semibold text-blue-700 dark:text-blue-300">{(yr.allInRateCapped * 100).toFixed(2)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">Forward rates auto-applied to floating-rate tranche debt service in Pro Forma</p>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.location.href = '/analysis/capital-markets?tab=debt-modeling'}>
                    <ArrowUpDown className="h-3 w-3" />
                    Open Capital Markets
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No SOFR forward curve data available yet</p>
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/analysis/capital-markets'}>
                  Go to Capital Markets to Refresh Data
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fund Inheritance Section */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Fund Inheritance</h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Link this deal to a fund to inherit its capital structure, waterfall terms, and promote splits. Fund-level returns will aggregate this deal's performance.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-muted-foreground">
                  {dealAllocation 
                    ? `Linked to fund • ${dealAllocation.usesFundCapitalStack ? 'Inheriting fund structure' : 'Using deal-specific structure'}`
                    : 'Not linked to a fund'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {dealAllocation ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Inherit Fund Structure</span>
                    <Switch
                      checked={dealAllocation.usesFundCapitalStack ?? true}
                      onCheckedChange={(checked) => toggleInheritanceMutation.mutate(checked)}
                      disabled={toggleInheritanceMutation.isPending}
                      data-testid="toggle-fund-inheritance"
                    />
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dealAllocation && unlinkFundMutation.mutate(dealAllocation.id)}
                    disabled={unlinkFundMutation.isPending}
                    data-testid="button-unlink-fund"
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    Unlink
                  </Button>
                </>
              ) : (
                <Dialog open={showFundInheritance} onOpenChange={setShowFundInheritance}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-link-fund">
                      <Link className="h-4 w-4 mr-2" />
                      Link to Fund
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Link Deal to Fund</DialogTitle>
                      <DialogDescription>
                        Select a fund to link this deal to. The deal will inherit the fund's capital structure and waterfall terms.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Select Fund</Label>
                        <Select onValueChange={setSelectedFundId} value={selectedFundId || ''}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a fund..." />
                          </SelectTrigger>
                          <SelectContent>
                            {funds?.map((fund) => (
                              <SelectItem key={fund.id} value={fund.id}>
                                <div className="flex items-center gap-2">
                                  <span>{fund.name}</span>
                                  {fund.vintage && (
                                    <Badge variant="secondary" className="text-xs">
                                      Vintage {fund.vintage}
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {selectedFundId && fundTemplates && fundTemplates.length > 0 && (
                        <div>
                          <Label>Capital Stack Template</Label>
                          <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId || ''}>
                            <SelectTrigger>
                              <SelectValue placeholder="Use fund's default template" />
                            </SelectTrigger>
                            <SelectContent>
                              {fundTemplates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{template.name}</span>
                                    {template.isDefault && (
                                      <Badge variant="outline" className="text-xs">Default</Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Templates define standard debt/equity structures and waterfall terms
                          </p>
                        </div>
                      )}
                      
                      {selectedFundId && (
                        <Alert>
                          <Briefcase className="h-4 w-4" />
                          <AlertTitle>Fund Attribution</AlertTitle>
                          <AlertDescription>
                            This deal's returns will be included in fund-level IRR, TVPI, and DPI calculations.
                            Capital calls and distributions will be tracked at the fund level.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Template Preview */}
                      {selectedTemplateId && fundTemplates && (() => {
                        const tmpl = fundTemplates.find(t => t.id === selectedTemplateId);
                        if (!tmpl) return null;
                        const config = (tmpl as any).config || {};
                        return (
                          <Card className="bg-slate-50 border-dashed">
                            <CardContent className="pt-4">
                              <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Template Preview: {tmpl.name}
                              </h5>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                {config.targetLtv && (
                                  <div><span className="text-muted-foreground">Target LTV:</span> <span className="font-medium">{config.targetLtv}%</span></div>
                                )}
                                {config.preferredReturn && (
                                  <div><span className="text-muted-foreground">Pref Return:</span> <span className="font-medium">{config.preferredReturn}%</span></div>
                                )}
                                {config.gpSplit && (
                                  <div><span className="text-muted-foreground">GP/LP Split:</span> <span className="font-medium">{config.gpSplit}/{100 - config.gpSplit}</span></div>
                                )}
                                {config.catchUp && (
                                  <div><span className="text-muted-foreground">GP Catch-Up:</span> <span className="font-medium">{config.catchUp}%</span></div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">This structure will be applied to the new capital stack</p>
                            </CardContent>
                          </Card>
                        );
                      })()}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowFundInheritance(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => selectedFundId && linkFundMutation.mutate({ 
                          fundId: selectedFundId, 
                          templateId: selectedTemplateId || undefined 
                        })}
                        disabled={!selectedFundId || linkFundMutation.isPending}
                      >
                        {linkFundMutation.isPending ? 'Linking...' : 'Link Fund'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
          
          {/* Fund Template Actions when linked */}
          {dealAllocation && dealAllocation.usesFundCapitalStack && fundTemplates && fundTemplates.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Apply Fund Template</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select onValueChange={setSelectedTemplateId} value={selectedTemplateId || ''}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fundTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                          {template.isDefault && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm"
                    onClick={() => selectedTemplateId && applyTemplateMutation.mutate(selectedTemplateId)}
                    disabled={!selectedTemplateId || applyTemplateMutation.isPending}
                  >
                    {applyTemplateMutation.isPending ? 'Applying...' : 'Apply'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Applying a template will create a new capital stack with the fund's standard debt/equity structure
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {stacksLoading ? (
        <Card className="p-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <Skeleton className="h-10 w-40 mx-auto" />
          </div>
        </Card>
      ) : (!stacks || stacks.length === 0) ? (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Capital Stacks</h3>
          <p className="text-muted-foreground mb-4">Create a capital stack to model debt and equity structure with waterfall distributions</p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => setShowCreateStack(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Capital Stack
            </Button>
            {dealAllocation && fundTemplates && fundTemplates.length > 0 && (
              <Button 
                variant="outline" 
                onClick={() => {
                  const defaultTemplate = fundTemplates.find(t => t.isDefault) || fundTemplates[0];
                  if (defaultTemplate) applyTemplateMutation.mutate(defaultTemplate.id);
                  // Also pre-fill equity form from template if it has equity config
                  if (defaultTemplate && (defaultTemplate as any).equityConfig) {
                    const ec = (defaultTemplate as any).equityConfig;
                    if (ec.preferredReturn) equityForm.setValue('preferredReturn', String(ec.preferredReturn));
                    if (ec.gpSplit) {
                      setPromoteTiers([{ irrHurdle: (ec.preferredReturn || 8) / 100, gpSplit: ec.gpSplit / 100, lpSplit: (100 - ec.gpSplit) / 100 }]);
                    }
                  }
                }}
                disabled={applyTemplateMutation.isPending}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Use Fund Template
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Capital Stacks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stacks.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedStackId === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedStackId(s.id)}
                    data-testid={`stack-item-${s.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.name}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                    <div className="text-sm opacity-80">
                      {formatCurrency(parseNumber(s.purchasePrice))}
                    </div>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-9">
            {!selectedStackId ? (
              <Card className="p-8 text-center">
                <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Capital Stack</h3>
                <p className="text-muted-foreground">Choose a capital stack from the left to view and edit</p>
              </Card>
            ) : detailsLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xl font-bold">{formatCurrency(parseNumber(stack?.purchasePrice))}</div>
                      <div className="text-xs text-muted-foreground">Purchase Price</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xl font-bold text-blue-600">{formatCurrency(totalDebt)}</div>
                      <div className="text-xs text-muted-foreground">Total Debt</div>
                      <Progress value={ltv} className="mt-2 h-1" />
                      <div className="text-xs text-muted-foreground mt-1">{ltv.toFixed(1)}% LTV</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xl font-bold text-green-600">{formatCurrency(totalEquity)}</div>
                      <div className="text-xs text-muted-foreground">Total Equity</div>
                      <Progress value={100 - ltv} className="mt-2 h-1" />
                      <div className="text-xs text-muted-foreground mt-1">{(100 - ltv).toFixed(1)}%</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xl font-bold">{formatCurrency(annualDebtService)}</div>
                      <div className="text-xs text-muted-foreground">Annual D/S</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-xl font-bold">{stack?.holdPeriodYears || 5} yrs</div>
                      <div className="text-xs text-muted-foreground">Hold Period</div>
                      <div className="text-xs text-muted-foreground mt-1">@ {formatPercent(parseNumber(stack?.exitCapRate) * 100)} Exit</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Visual Capital Stack */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Capital Structure
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex h-8 rounded-lg overflow-hidden">
                      {debtTranches.map((t, i) => {
                        const pct = totalCap > 0 ? (parseNumber(t.principal) / totalCap) * 100 : 0;
                        const colors = ['bg-blue-500', 'bg-blue-400', 'bg-blue-300', 'bg-sky-400', 'bg-cyan-400'];
                        return (
                          <div
                            key={t.id}
                            className={`${colors[i % colors.length]} flex items-center justify-center text-xs text-white font-medium`}
                            style={{ width: `${pct}%` }}
                            title={`${t.name}: ${formatCurrency(parseNumber(t.principal))} (${pct.toFixed(1)}%)`}
                          >
                            {pct > 10 && t.name.slice(0, 8)}
                          </div>
                        );
                      })}
                      {equityLayers.map((l, i) => {
                        const pct = totalCap > 0 ? (parseNumber(l.commitmentAmount) / totalCap) * 100 : 0;
                        const colors = ['bg-green-500', 'bg-green-400', 'bg-emerald-400', 'bg-teal-400'];
                        return (
                          <div
                            key={l.id}
                            className={`${colors[i % colors.length]} flex items-center justify-center text-xs text-white font-medium`}
                            style={{ width: `${pct}%` }}
                            title={`${l.name}: ${formatCurrency(parseNumber(l.commitmentAmount))} (${pct.toFixed(1)}%)`}
                          >
                            {pct > 10 && l.name.slice(0, 8)}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>Debt: {ltv.toFixed(1)}%</span>
                      <span>Equity: {(100 - ltv).toFixed(1)}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="debt" className="space-y-4">
                  <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="debt" className="gap-1.5 text-xs">
                      <DollarSign className="h-3.5 w-3.5" />
                      Debt ({debtTranches.length})
                    </TabsTrigger>
                    <TabsTrigger value="equity" className="gap-1.5 text-xs">
                      <PieChart className="h-3.5 w-3.5" />
                      Equity ({equityLayers.length})
                    </TabsTrigger>
                    <TabsTrigger value="waterfall" className="gap-1.5 text-xs">
                      <Layers className="h-3.5 w-3.5" />
                      Waterfall
                    </TabsTrigger>
                    <TabsTrigger value="partners" className="gap-1.5 text-xs">
                      <Briefcase className="h-3.5 w-3.5" />
                      Partners
                    </TabsTrigger>
                    <TabsTrigger value="returns" className="gap-1.5 text-xs">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Returns
                    </TabsTrigger>
                    <TabsTrigger value="projections" className="gap-1.5 text-xs">
                      <Calculator className="h-3.5 w-3.5" />
                      Projections
                    </TabsTrigger>
                    <TabsTrigger value="sources-uses" className="gap-1.5 text-xs">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Sources & Uses
                    </TabsTrigger>
                    <TabsTrigger value="sensitivity" className="gap-1.5 text-xs">
                      <Calculator className="h-3.5 w-3.5" />
                      Sensitivity
                    </TabsTrigger>
                    <TabsTrigger value="refi" className="gap-1.5 text-xs">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refi Scenario
                    </TabsTrigger>
                  </TabsList>

                  {/* DEBT TRANCHES TAB */}
                  <TabsContent value="debt" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Debt Tranches</h3>
                      <Dialog open={showAddDebt} onOpenChange={(open) => {
                        setShowAddDebt(open);
                        if (!open) {
                          setEditingDebt(null);
                          debtForm.reset();
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-add-debt">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Tranche
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{editingDebt ? 'Edit' : 'Add'} Debt Tranche</DialogTitle>
                            <DialogDescription>Configure loan terms, rates, and covenants</DialogDescription>
                          </DialogHeader>
                          <Form {...debtForm}>
                            <form onSubmit={debtForm.handleSubmit(handleDebtSubmit)} className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={debtForm.control} name="name" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Tranche Name *</FormLabel>
                                    <FormControl><Input {...field} placeholder="Senior Loan" /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={debtForm.control} name="trancheType" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Type *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {DEBT_TRANCHE_TYPES.map((t) => (
                                          <SelectItem key={t.value} value={t.value}>
                                            <div>
                                              <div>{t.label}</div>
                                              <div className="text-xs text-muted-foreground">{t.description}</div>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                              </div>

                              <FormField control={debtForm.control} name="lenderName" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Lender Name</FormLabel>
                                  <FormControl><Input {...field} placeholder="First National Bank" /></FormControl>
                                </FormItem>
                              )} />

                              <Separator />
                              <h4 className="font-medium text-sm">Loan Terms</h4>

                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={debtForm.control} name="principal" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Principal Amount *</FormLabel>
                                    <FormControl><Input {...field} type="number" placeholder="5000000" /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={debtForm.control} name="indexRate" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Rate Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {INDEX_RATES.map((r) => (
                                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                              </div>

                              <div className="grid grid-cols-3 gap-4">
                                <FormField control={debtForm.control} name="interestRate" render={({ field }) => (
                                  <FormItem>
                                    <div className="flex items-center justify-between">
                                      <FormLabel>{debtForm.watch('indexRate') === 'fixed' ? 'Interest Rate *' : 'All-In Rate *'}</FormLabel>
                                      <MarketRatePicker 
                                        compact
                                        onSelectRate={(rate, label) => {
                                          field.onChange((rate / 100).toFixed(4));
                                        }}
                                        currentValue={parseFloat(field.value) * 100}
                                      />
                                    </div>
                                    <FormControl><Input {...field} type="number" step="0.0001" placeholder="0.065" /></FormControl>
                                    <FormDescription>As decimal (e.g., 0.065 = 6.5%)</FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                {debtForm.watch('indexRate') !== 'fixed' && (
                                  <>
                                    <FormField control={debtForm.control} name="spreadBps" render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Spread (bps)</FormLabel>
                                        <FormControl><Input {...field} type="number" placeholder="250" /></FormControl>
                                        <FormDescription>Basis points over index</FormDescription>
                                      </FormItem>
                                    )} />
                                    <FormField control={debtForm.control} name="floorRate" render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Floor Rate</FormLabel>
                                        <FormControl><Input {...field} type="number" step="0.0001" placeholder="0.04" /></FormControl>
                                        <FormDescription>Minimum rate</FormDescription>
                                      </FormItem>
                                    )} />
                                  </>
                                )}
                              </div>

                              {debtForm.watch('indexRate') === 'SOFR' && (
                                <SofrForwardRatePreview
                                  holdYears={parseInt(debtForm.watch('termYears') || '5') || 5}
                                  spreadBps={parseInt(debtForm.watch('spreadBps') || '0') || 0}
                                  floorRate={debtForm.watch('floorRate') ? parseFloat(debtForm.watch('floorRate')!) : undefined}
                                />
                              )}

                              <div className="grid grid-cols-3 gap-4">
                                <FormField control={debtForm.control} name="termYears" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Loan Term (Years) *</FormLabel>
                                    <FormControl><Input {...field} type="number" placeholder="10" /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={debtForm.control} name="amortizationYears" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Amortization (Years)</FormLabel>
                                    <FormControl><Input {...field} type="number" placeholder="30" /></FormControl>
                                    <FormDescription>Leave blank for I/O</FormDescription>
                                  </FormItem>
                                )} />
                                <FormField control={debtForm.control} name="interestOnlyMonths" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>I/O Period (Months)</FormLabel>
                                    <FormControl><Input {...field} type="number" placeholder="24" /></FormControl>
                                  </FormItem>
                                )} />
                              </div>

                              <Separator />
                              <h4 className="font-medium text-sm">Fees & Prepayment</h4>

                              <div className="grid grid-cols-3 gap-4">
                                <FormField control={debtForm.control} name="originationFeePct" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Origination Fee</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.001" placeholder="0.01" /></FormControl>
                                    <FormDescription>As decimal (1% = 0.01)</FormDescription>
                                  </FormItem>
                                )} />
                                <FormField control={debtForm.control} name="exitFeePct" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Exit Fee</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.001" placeholder="0" /></FormControl>
                                  </FormItem>
                                )} />
                                <FormField control={debtForm.control} name="prepaymentPenalty" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Prepayment Terms</FormLabel>
                                    <FormControl><Input {...field} placeholder="5-4-3-2-1" /></FormControl>
                                    <FormDescription>Penalty schedule</FormDescription>
                                  </FormItem>
                                )} />
                              </div>

                              <Separator />
                              <h4 className="font-medium text-sm">Covenants</h4>

                              <div className="grid grid-cols-3 gap-4">
                                <FormField control={debtForm.control} name="minDscr" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Min DSCR</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.01" placeholder="1.25" /></FormControl>
                                  </FormItem>
                                )} />
                                <FormField control={debtForm.control} name="maxLtv" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Max LTV</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.01" placeholder="0.75" /></FormControl>
                                  </FormItem>
                                )} />
                                <FormField control={debtForm.control} name="minDebtYield" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Min Debt Yield</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.001" placeholder="0.08" /></FormControl>
                                  </FormItem>
                                )} />
                              </div>

                              <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => { setShowAddDebt(false); setEditingDebt(null); }}>Cancel</Button>
                                <Button type="submit" disabled={createDebtMutation.isPending || updateDebtMutation.isPending}>
                                  <Save className="h-4 w-4 mr-2" />
                                  {editingDebt ? 'Update' : 'Add'} Tranche
                                </Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {debtTranches.length === 0 ? (
                      <Card className="p-6 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No debt tranches configured</p>
                      </Card>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Priority</TableHead>
                            <TableHead>Name / Lender</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Principal</TableHead>
                            <TableHead>Rate</TableHead>
                            <TableHead>Term / Amort</TableHead>
                            <TableHead>Annual D/S</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debtTranches.map((tranche) => (
                            <TableRow key={tranche.id}>
                              <TableCell>
                                <Badge variant="outline">{tranche.priority}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{tranche.name}</div>
                                {tranche.lenderName && <div className="text-xs text-muted-foreground">{tranche.lenderName}</div>}
                              </TableCell>
                              <TableCell>
                                <Badge>{DEBT_TRANCHE_TYPES.find(t => t.value === tranche.trancheType)?.label || tranche.trancheType}</Badge>
                                {tranche.indexRate && tranche.indexRate !== 'fixed' && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                      {tranche.indexRate} + {tranche.spreadBps}bps
                                    </Badge>
                                    <TrendingUp className="h-3 w-3 text-blue-500" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{formatCurrency(parseNumber(tranche.principal))}</TableCell>
                              <TableCell>
                                {formatPercent(parseNumber(tranche.interestRate) * 100)}
                                {tranche.indexRate && tranche.indexRate !== 'fixed' && (
                                  <div className="text-[10px] text-blue-600 dark:text-blue-400">Variable (fwd curve)</div>
                                )}
                                {tranche.floorRate && <div className="text-xs text-muted-foreground">Floor: {formatPercent(parseNumber(tranche.floorRate) * 100)}</div>}
                              </TableCell>
                              <TableCell>
                                {tranche.termYears}y / {tranche.amortizationYears ? `${tranche.amortizationYears}y` : 'I/O'}
                                {(tranche.interestOnlyMonths ?? 0) > 0 && <div className="text-xs text-muted-foreground">{tranche.interestOnlyMonths}mo I/O</div>}
                              </TableCell>
                              <TableCell>{formatCurrency(parseNumber(tranche.annualDebtService))}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => setEditingDebt(tranche)} data-testid={`button-edit-debt-${tranche.id}`}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => deleteDebtMutation.mutate(tranche.id)} data-testid={`button-delete-debt-${tranche.id}`}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  {/* EQUITY LAYERS TAB */}
                  <TabsContent value="equity" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Equity Layers & Waterfall</h3>
                      <Dialog open={showAddEquity} onOpenChange={(open) => {
                        setShowAddEquity(open);
                        if (!open) {
                          setEditingEquity(null);
                          equityForm.reset();
                          setPromoteTiers([{ irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 }]);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-add-equity">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Layer
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader className="pb-4 border-b">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <Layers className="h-5 w-5 text-green-600" />
                              </div>
                              <div>
                                <DialogTitle className="text-lg">{editingEquity ? 'Edit' : 'Add'} Equity Layer</DialogTitle>
                                <DialogDescription>Configure investor details, capital commitment, return structure, and promote tiers</DialogDescription>
                              </div>
                            </div>
                          </DialogHeader>
                          <Form {...equityForm}>
                            <form onSubmit={equityForm.handleSubmit(handleEquitySubmit)} className="space-y-0">
                              <Tabs defaultValue="investor" className="w-full">
                                <TabsList className={`grid w-full mb-4 ${needsAdvancedTabs(layerType) ? 'grid-cols-4' : 'grid-cols-2'}`}>
                                  <TabsTrigger value="investor" className="text-xs gap-1">
                                    <Briefcase className="h-3.5 w-3.5" />
                                    {layerType === 'solo' ? 'Owner' : layerType === 'partnership' ? 'Partners' : 'Investor'}
                                  </TabsTrigger>
                                  <TabsTrigger value="contribution" className="text-xs gap-1">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    {layerType === 'solo' || layerType === 'partnership' ? 'Equity' : 'Contribution'}
                                  </TabsTrigger>
                                  {needsAdvancedTabs(layerType) && (
                                    <TabsTrigger value="returns" className="text-xs gap-1">
                                      <TrendingUp className="h-3.5 w-3.5" />
                                      Returns
                                    </TabsTrigger>
                                  )}
                                  {needsAdvancedTabs(layerType) && (
                                    <TabsTrigger value="promote" className="text-xs gap-1">
                                      <PieChart className="h-3.5 w-3.5" />
                                      Promote
                                    </TabsTrigger>
                                  )}
                                </TabsList>

                                <TabsContent value="investor" className="space-y-4 mt-0">
                                  <Card className="p-4 bg-slate-50/50">
                                    <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
                                      <Briefcase className="h-4 w-4 text-slate-600" />
                                      Investor Information
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField control={equityForm.control} name="name" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Layer Name *</FormLabel>
                                          <FormControl>
                                            <Input {...field} placeholder="e.g., LP Class A Equity" className="bg-white" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                      <FormField control={equityForm.control} name="layerType" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Equity Type *</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger className="bg-white"><SelectValue placeholder="Select type..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {EQUITY_LAYER_TYPES.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>
                                                  <div className="flex flex-col">
                                                    <span className="font-medium">{t.label}</span>
                                                    <span className="text-xs text-muted-foreground">{t.description}</span>
                                                  </div>
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                    </div>

                                    <Separator className="my-4" />

                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField control={equityForm.control} name="investorName" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Investor / Entity Name</FormLabel>
                                          <FormControl>
                                            <Input {...field} placeholder="e.g., ABC Capital Partners, LP" className="bg-white" />
                                          </FormControl>
                                          <FormDescription>Legal name of the investing entity</FormDescription>
                                        </FormItem>
                                      )} />
                                      <FormField control={equityForm.control} name="investorType" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Investor Classification</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger className="bg-white"><SelectValue placeholder="Select classification..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {INVESTOR_TYPES.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <FormDescription>Type of investor for reporting</FormDescription>
                                        </FormItem>
                                      )} />
                                    </div>
                                  </Card>
                                </TabsContent>

                                <TabsContent value="contribution" className="space-y-4 mt-0">
                                  <Card className="p-4 bg-blue-50/50">
                                    <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
                                      <DollarSign className="h-4 w-4 text-blue-600" />
                                      {layerType === 'solo' ? 'Your Equity Investment' : layerType === 'partnership' ? 'Partnership Equity' : 'Capital Contribution Details'}
                                    </h4>

                                    {/* Auto-calculated equity summary */}
                                    {hasComputedEquity && (
                                      <div className="mb-4 p-3 bg-white rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Info className="h-3.5 w-3.5 text-blue-500" />
                                          <span className="text-xs font-medium text-blue-700">Auto-Calculated from Capital Stack</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                          <div>
                                            <span className="text-muted-foreground text-xs">Purchase Price</span>
                                            <p className="font-semibold">${purchasePrice.toLocaleString()}</p>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground text-xs">Total Debt</span>
                                            <p className="font-semibold text-red-600">({totalDebt.toLocaleString()})</p>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground text-xs">Required Equity</span>
                                            <p className="font-bold text-green-600">${computedEquity.toLocaleString()}</p>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Total Equity + Ownership (always shown) */}
                                    <div className="grid grid-cols-3 gap-4">
                                      <FormField control={equityForm.control} name="commitmentAmount" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>{layerType === 'solo' || layerType === 'partnership' ? 'Total Equity *' : 'Capital Commitment *'}</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" placeholder="5,000,000" className={`pl-9 bg-white ${hasComputedEquity ? 'border-green-300 bg-green-50/30' : ''}`} />
                                            </div>
                                          </FormControl>
                                          <FormDescription>{hasComputedEquity ? 'Auto-filled: Purchase Price − Debt' : 'Total equity required'}</FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                      {needsAdvancedTabs(layerType) && (
                                      <FormField control={equityForm.control} name="fundedAmount" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Funded to Date</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" placeholder="5,000,000" className="pl-9 bg-white" />
                                            </div>
                                          </FormControl>
                                          <FormDescription>Capital already called</FormDescription>
                                        </FormItem>
                                      )} />
                                      )}
                                      <FormField control={equityForm.control} name="ownershipPct" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Ownership Percentage *</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" step="0.01" placeholder="90" className={`pl-9 bg-white ${layerType === 'solo' ? 'border-green-300 bg-green-50/30' : ''}`}
                                                readOnly={layerType === 'solo'} />
                                            </div>
                                          </FormControl>
                                          <FormDescription>{layerType === 'solo' ? 'Auto-set to 100%' : 'Enter as % (e.g., 90 for 90%)'}</FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                    </div>

                                    {/* Dynamic Partner Rows — for Partnership/JV/GP-LP structures */}
                                    {equityPartners.length > 0 && (
                                      <div className="mt-4">
                                        <div className="flex justify-between items-center mb-3">
                                          <h5 className="text-sm font-medium flex items-center gap-2">
                                            <Users className="h-4 w-4 text-blue-600" />
                                            {layerType === 'partnership' ? 'Partners' : 'Equity Participants'}
                                          </h5>
                                          <Button type="button" variant="outline" size="sm" onClick={addEquityPartner} className="bg-white">
                                            <Plus className="h-3.5 w-3.5 mr-1" /> Add {layerType === 'partnership' ? 'Partner' : 'Investor'}
                                          </Button>
                                        </div>
                                        <div className="space-y-2">
                                          {equityPartners.map((partner, idx) => (
                                            <div key={partner.id} className="p-3 bg-white rounded-lg border flex items-center gap-3">
                                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                                <span className="text-xs font-bold text-blue-700">{idx + 1}</span>
                                              </div>
                                              <div className="flex-1 grid grid-cols-4 gap-3">
                                                <div>
                                                  <Label className="text-xs">Name</Label>
                                                  <Input
                                                    value={partner.name}
                                                    onChange={(e) => updateEquityPartner(partner.id, 'name', e.target.value)}
                                                    placeholder="Partner name"
                                                    className="h-8 text-sm mt-1"
                                                  />
                                                </div>
                                                <div>
                                                  <Label className="text-xs">Role</Label>
                                                  <Select value={partner.role} onValueChange={(v) => updateEquityPartner(partner.id, 'role', v)}>
                                                    <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                      {layerType === 'partnership' ? (
                                                        <SelectItem value="partner">Partner</SelectItem>
                                                      ) : (
                                                        <>
                                                          <SelectItem value="gp">GP</SelectItem>
                                                          <SelectItem value="lp">LP</SelectItem>
                                                        </>
                                                      )}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                                <div>
                                                  <Label className="text-xs">Amount ($)</Label>
                                                  <Input
                                                    type="number"
                                                    value={partner.amount}
                                                    onChange={(e) => updateEquityPartner(partner.id, 'amount', e.target.value)}
                                                    placeholder="0"
                                                    className="h-8 text-sm mt-1"
                                                  />
                                                </div>
                                                <div className="flex items-end gap-1">
                                                  <div className="flex-1">
                                                    <Label className="text-xs">Ownership %</Label>
                                                    <Input
                                                      type="number"
                                                      step="0.1"
                                                      value={partner.ownershipPct}
                                                      onChange={(e) => updateEquityPartner(partner.id, 'ownershipPct', e.target.value)}
                                                      placeholder="0"
                                                      className="h-8 text-sm mt-1"
                                                    />
                                                  </div>
                                                  {equityPartners.length > 2 && (
                                                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                                                      onClick={() => removeEquityPartner(partner.id)}>
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Partner totals validation */}
                                        <div className={`mt-3 p-2 rounded-lg border text-xs flex justify-between items-center ${Math.abs(totalPartnerOwnership - 100) < 0.1 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                          <span>
                                            Total: ${totalPartnerAmount.toLocaleString()} commitment / {totalPartnerOwnership.toFixed(1)}% ownership
                                          </span>
                                          {Math.abs(totalPartnerOwnership - 100) >= 0.1 && (
                                            <span className="font-medium">⚠ Ownership must total 100%</span>
                                          )}
                                          {Math.abs(totalPartnerOwnership - 100) < 0.1 && (
                                            <span className="font-medium">✓ Balanced</span>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Funding Progress (for advanced types) */}
                                    {needsAdvancedTabs(layerType) && (
                                    <div className="mt-4 p-3 bg-white rounded-lg border">
                                      <div className="flex justify-between text-sm mb-2">
                                        <span className="text-muted-foreground">Funding Progress</span>
                                        <span className="font-medium">
                                          {equityForm.watch('fundedAmount') && equityForm.watch('commitmentAmount') 
                                            ? `${((parseFloat(equityForm.watch('fundedAmount') || '0') / parseFloat(equityForm.watch('commitmentAmount') || '1')) * 100).toFixed(0)}%`
                                            : '0%'}
                                        </span>
                                      </div>
                                      <Progress 
                                        value={
                                          equityForm.watch('fundedAmount') && equityForm.watch('commitmentAmount')
                                            ? (parseFloat(equityForm.watch('fundedAmount') || '0') / parseFloat(equityForm.watch('commitmentAmount') || '1')) * 100
                                            : 0
                                        } 
                                        className="h-2"
                                      />
                                    </div>
                                    )}
                                  </Card>
                                </TabsContent>

                                <TabsContent value="returns" className="space-y-4 mt-0">
                                  <Card className="p-4 bg-green-50/50">
                                    <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
                                      <TrendingUp className="h-4 w-4 text-green-600" />
                                      Return Structure
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                      <FormField control={equityForm.control} name="preferredReturn" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Preferred Return Rate</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" step="0.1" placeholder="8" className="pl-9 bg-white" />
                                            </div>
                                          </FormControl>
                                          <FormDescription>Annual pref rate (e.g., 8 for 8%)</FormDescription>
                                        </FormItem>
                                      )} />
                                      <FormField control={equityForm.control} name="preferredReturnType" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Accrual Method</FormLabel>
                                          <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger className="bg-white"><SelectValue placeholder="Select method..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {PREFERRED_RETURN_TYPES.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>
                                                  <div className="flex flex-col">
                                                    <span>{t.label}</span>
                                                    <span className="text-xs text-muted-foreground">{t.description}</span>
                                                  </div>
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                      )} />
                                      <FormField control={equityForm.control} name="catchUpPct" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>GP Catch-Up</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" step="1" placeholder="100" className="pl-9 bg-white" />
                                            </div>
                                          </FormControl>
                                          <FormDescription>% of profit to GP until caught up</FormDescription>
                                        </FormItem>
                                      )} />
                                    </div>

                                    <Separator className="my-4" />

                                    <FormField control={equityForm.control} name="isParticipating" render={({ field }) => (
                                      <FormItem className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                        <div className="space-y-0.5">
                                          <FormLabel className="text-base">Participating Equity</FormLabel>
                                          <FormDescription>
                                            Investor participates in distributions beyond the preferred return
                                          </FormDescription>
                                        </div>
                                        <FormControl>
                                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                      </FormItem>
                                    )} />
                                  </Card>
                                </TabsContent>

                                <TabsContent value="promote" className="space-y-4 mt-0">
                                  <Card className="p-4 bg-purple-50/50">
                                    <div className="flex justify-between items-center mb-4">
                                      <h4 className="font-medium text-sm flex items-center gap-2">
                                        <PieChart className="h-4 w-4 text-purple-600" />
                                        Promote / Carried Interest Tiers
                                      </h4>
                                      <Button type="button" variant="outline" size="sm" onClick={addPromoteTier} className="bg-white">
                                        <Plus className="h-4 w-4 mr-1" /> Add Tier
                                      </Button>
                                    </div>

                                    <p className="text-xs text-muted-foreground mb-4">
                                      Define tiered promote structure based on IRR hurdles. Each tier specifies how profits are split between GP and LP above that return threshold.
                                    </p>

                                    <div className="space-y-3">
                                      {promoteTiers.map((tier, index) => (
                                        <Card key={index} className="p-4 bg-white border-purple-200">
                                          <div className="flex items-start gap-4">
                                            <div className="flex flex-col items-center">
                                              <Badge className="bg-purple-600 text-white">Tier {index + 1}</Badge>
                                              {index > 0 && (
                                                <div className="text-xs text-muted-foreground mt-1">Above Tier {index}</div>
                                              )}
                                            </div>
                                            <div className="flex-1 grid grid-cols-3 gap-4">
                                              <div>
                                                <Label className="text-xs font-medium">IRR Hurdle</Label>
                                                <div className="relative mt-1">
                                                  <Percent className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                                  <Input
                                                    type="number"
                                                    step="1"
                                                    value={(tier.irrHurdle * 100).toFixed(0)}
                                                    onChange={(e) => updatePromoteTier(index, 'irrHurdle', parseFloat(e.target.value) / 100)}
                                                    placeholder="8"
                                                    className="pl-8 h-9"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <Label className="text-xs font-medium text-green-700">GP Split</Label>
                                                <div className="relative mt-1">
                                                  <Percent className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-green-600" />
                                                  <Input
                                                    type="number"
                                                    step="1"
                                                    value={(tier.gpSplit * 100).toFixed(0)}
                                                    onChange={(e) => updatePromoteTier(index, 'gpSplit', parseFloat(e.target.value) / 100)}
                                                    placeholder="20"
                                                    className="pl-8 h-9 border-green-200 focus:border-green-400"
                                                  />
                                                </div>
                                              </div>
                                              <div>
                                                <Label className="text-xs font-medium text-blue-700">LP Split</Label>
                                                <div className="relative mt-1">
                                                  <Percent className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-blue-600" />
                                                  <Input
                                                    type="number"
                                                    step="1"
                                                    value={(tier.lpSplit * 100).toFixed(0)}
                                                    onChange={(e) => updatePromoteTier(index, 'lpSplit', parseFloat(e.target.value) / 100)}
                                                    placeholder="80"
                                                    className="pl-8 h-9 border-blue-200 focus:border-blue-400"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                            {promoteTiers.length > 1 && (
                                              <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removePromoteTier(index)}>
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            )}
                                          </div>
                                          <div className="mt-3 p-2 bg-purple-50 rounded text-xs text-purple-700 flex items-center gap-2">
                                            <Info className="h-3.5 w-3.5" />
                                            Above {(tier.irrHurdle * 100).toFixed(0)}% IRR: GP receives {(tier.gpSplit * 100).toFixed(0)}%, LP receives {(tier.lpSplit * 100).toFixed(0)}%
                                          </div>
                                        </Card>
                                      ))}
                                    </div>

                                    {/* Waterfall Preview */}
                                    <div className="mt-4 p-3 bg-white rounded-lg border">
                                      <h5 className="text-xs font-medium mb-2 text-muted-foreground">Waterfall Preview</h5>
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                          <span>1. Return of Capital</span>
                                          <span className="text-muted-foreground">100% to Investors</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span>2. Preferred Return</span>
                                          <span className="text-muted-foreground">
                                            {equityForm.watch('preferredReturn') ? `${equityForm.watch('preferredReturn')}% to LP` : 'Not set'}
                                          </span>
                                        </div>
                                        {equityForm.watch('catchUpPct') && (
                                          <div className="flex justify-between text-xs">
                                            <span>3. GP Catch-Up</span>
                                            <span className="text-muted-foreground">{equityForm.watch('catchUpPct')}% to GP</span>
                                          </div>
                                        )}
                                        {promoteTiers.map((tier, i) => (
                                          <div key={i} className="flex justify-between text-xs">
                                            <span>{i + 3 + (equityForm.watch('catchUpPct') ? 1 : 0)}. Above {(tier.irrHurdle * 100).toFixed(0)}% IRR</span>
                                            <span className="text-muted-foreground">{(tier.gpSplit * 100).toFixed(0)}% GP / {(tier.lpSplit * 100).toFixed(0)}% LP</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </Card>
                                </TabsContent>
                              </Tabs>

                              <DialogFooter className="pt-4 mt-4 border-t">
                                <Button type="button" variant="outline" onClick={() => { setShowAddEquity(false); setEditingEquity(null); }}>Cancel</Button>
                                <Button type="submit" disabled={createEquityMutation.isPending || updateEquityMutation.isPending} className="bg-green-600 hover:bg-green-700">
                                  <Save className="h-4 w-4 mr-2" />
                                  {editingEquity ? 'Update' : 'Add'} Equity Layer
                                </Button>
                              </DialogFooter>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {equityLayers.length === 0 ? (
                      <Card className="p-6 text-center">
                        <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No equity layers configured</p>
                      </Card>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Priority</TableHead>
                            <TableHead>Name / Investor</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Commitment</TableHead>
                            <TableHead>Ownership</TableHead>
                            <TableHead>Pref Return</TableHead>
                            <TableHead>Promote</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {equityLayers.map((layer) => {
                            const tiers = layer.promoteTiers as { irrHurdle: number; gpSplit: number; lpSplit: number }[] || [];
                            return (
                              <TableRow key={layer.id}>
                                <TableCell>
                                  <Badge variant="outline">{layer.waterfallPriority}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium">{layer.name}</div>
                                  {layer.investorName && <div className="text-xs text-muted-foreground">{layer.investorName}</div>}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{EQUITY_LAYER_TYPES.find(t => t.value === layer.layerType)?.label || layer.layerType}</Badge>
                                  {layer.investorType && <div className="text-xs text-muted-foreground mt-1">{INVESTOR_TYPES.find(t => t.value === layer.investorType)?.label}</div>}
                                </TableCell>
                                <TableCell>{formatCurrency(parseNumber(layer.commitmentAmount))}</TableCell>
                                <TableCell>{formatPercent(parseNumber(layer.ownershipPct) * 100)}</TableCell>
                                <TableCell>
                                  {layer.preferredReturn ? (
                                    <div>
                                      {formatPercent(parseNumber(layer.preferredReturn) * 100)}
                                      {layer.preferredReturnType && <div className="text-xs text-muted-foreground">{layer.preferredReturnType}</div>}
                                    </div>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  {tiers.length > 0 ? (
                                    <div className="text-xs">
                                      {tiers.map((t, i) => (
                                        <div key={i}>&gt;{formatPercent(t.irrHurdle * 100)}: {formatPercent(t.gpSplit * 100)} GP</div>
                                      ))}
                                    </div>
                                  ) : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => setEditingEquity(layer)} data-testid={`button-edit-equity-${layer.id}`}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => deleteEquityMutation.mutate(layer.id)} data-testid={`button-delete-equity-${layer.id}`}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  {/* PROJECTIONS TAB */}
                  <TabsContent value="projections" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">Cash Flow Projections</CardTitle>
                            <CardDescription>Auto-generated from Pro Forma engine or manual NOI input</CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await apiRequest(`/api/capital-stack/${selectedStackId}/projections/from-pro-forma`, {
                                    method: 'POST',
                                    body: JSON.stringify({ projectId, scenario: 'base' }),
                                  });
                                  queryClient.invalidateQueries({ queryKey: ['/api/modeling/capital-stacks', selectedStackId] });
                                  toast({ title: 'Projections synced from Pro Forma' });
                                } catch (e: any) {
                                  toast({ title: 'Pro Forma sync failed', description: e.message, variant: 'destructive' });
                                }
                              }}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Sync from Pro Forma
                            </Button>
                            <Button
                              onClick={() => generateProjectionsMutation.mutate()}
                              disabled={generateProjectionsMutation.isPending}
                              size="sm"
                              variant="secondary"
                              data-testid="button-generate-projections"
                            >
                              <Calculator className="h-4 w-4 mr-2" />
                              Manual Generate
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 items-end mb-4 p-3 bg-muted/30 rounded-lg">
                          <div>
                            <Label htmlFor="noi" className="text-xs">Starting NOI ($)</Label>
                            <Input
                              id="noi"
                              type="number"
                              value={noi}
                              onChange={(e) => setNoi(e.target.value)}
                              placeholder="1000000"
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label htmlFor="noiGrowth" className="text-xs">Annual Growth</Label>
                            <Input
                              id="noiGrowth"
                              type="number"
                              step="0.01"
                              value={noiGrowthRate}
                              onChange={(e) => setNoiGrowthRate(e.target.value)}
                              placeholder="0.02"
                              className="h-8"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground pb-2">Used for manual generation only. "Sync from Pro Forma" uses actual projected values.</p>
                        </div>
                      </CardContent>
                    </Card>

                    {projections.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Cash Flow Projections
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Year</TableHead>
                                <TableHead>NOI</TableHead>
                                <TableHead>Debt Service</TableHead>
                                <TableHead>Cash Flow</TableHead>
                                <TableHead>DSCR</TableHead>
                                <TableHead>Cash on Cash</TableHead>
                                <TableHead>Exit Value</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {projections.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium">Year {p.year}</TableCell>
                                  <TableCell>{formatCurrency(parseNumber(p.noi))}</TableCell>
                                  <TableCell>{formatCurrency(parseNumber(p.totalDebtService))}</TableCell>
                                  <TableCell className={parseNumber(p.cashFlowAfterDebt) < 0 ? 'text-destructive' : ''}>
                                    {formatCurrency(parseNumber(p.cashFlowAfterDebt))}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={parseNumber(p.dscr) >= 1.25 ? 'default' : 'destructive'}>
                                      {formatDecimal(p.dscr)}x
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{formatPercent(parseNumber(p.cashOnCash) * 100)}</TableCell>
                                  <TableCell>{p.exitValue ? formatCurrency(parseNumber(p.exitValue)) : '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>

                          {projections.length > 0 && projections[projections.length - 1].irr && (
                            <div className="mt-6 grid grid-cols-4 gap-4">
                              <Card className="bg-primary/5">
                                <CardContent className="pt-4 text-center">
                                  <div className="text-3xl font-bold text-primary">
                                    {formatPercent(parseNumber(projections[projections.length - 1].irr) * 100)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Levered IRR</div>
                                </CardContent>
                              </Card>
                              <Card className="bg-primary/5">
                                <CardContent className="pt-4 text-center">
                                  <div className="text-3xl font-bold text-primary">
                                    {formatDecimal(projections[projections.length - 1].equityMultiple)}x
                                  </div>
                                  <div className="text-sm text-muted-foreground">Equity Multiple</div>
                                </CardContent>
                              </Card>
                              <Card className="bg-primary/5">
                                <CardContent className="pt-4 text-center">
                                  <div className="text-3xl font-bold text-primary">
                                    {formatCurrency(parseNumber(projections[projections.length - 1].netSaleProceeds))}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Net Proceeds</div>
                                </CardContent>
                              </Card>
                              <Card className="bg-primary/5">
                                <CardContent className="pt-4 text-center">
                                  <div className="text-3xl font-bold text-primary">
                                    {formatPercent(parseNumber(projections[projections.length - 1].cashOnCash) * 100)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">Avg Cash on Cash</div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* WATERFALL TAB - Fund Distribution Structure */}
                  <TabsContent value="waterfall" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Layers className="h-5 w-5" />
                              Distribution Waterfall
                            </CardTitle>
                            <CardDescription>Configure 4-tier waterfall structure with promote and catch-up</CardDescription>
                          </div>
                          <Select defaultValue="american">
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Structure Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="american">American (Deal)</SelectItem>
                              <SelectItem value="european">European (Fund)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* 4-Tier Waterfall Visual */}
                        <div className="grid gap-3">
                          {/* Tier 1: Return of Capital */}
                          <div className="flex items-center gap-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">1</div>
                            <div className="flex-1">
                              <div className="font-medium">Return of Capital</div>
                              <div className="text-sm text-muted-foreground">100% to LPs until initial capital is returned</div>
                            </div>
                            <Badge variant="secondary">100% LP</Badge>
                          </div>

                          {/* Tier 2: Preferred Return */}
                          <div className="flex items-center gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">2</div>
                            <div className="flex-1">
                              <div className="font-medium">Preferred Return</div>
                              <div className="text-sm text-muted-foreground">100% to LPs until target IRR achieved</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {(() => {
                                  const prefLayer = equityLayers.find(l => l.preferredReturn);
                                  return prefLayer ? `${parseNumber(prefLayer.preferredReturn).toFixed(1)}%` : '8.0%';
                                })()}
                              </span>
                              <span className="text-xs text-muted-foreground">Pref Return</span>
                            </div>
                          </div>

                          {/* Tier 3: GP Catch-Up */}
                          <div className="flex items-center gap-4 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">3</div>
                            <div className="flex-1">
                              <div className="font-medium">GP Catch-Up</div>
                              <div className="text-sm text-muted-foreground">GP receives distributions until promote target achieved</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input className="w-16 h-8 text-sm" defaultValue="100%" />
                              <span className="text-xs text-muted-foreground">to GP</span>
                              <Switch defaultChecked />
                            </div>
                          </div>

                          {/* Tier 4: Carried Interest / Promote */}
                          <div className="flex items-center gap-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-sm">4</div>
                            <div className="flex-1">
                              <div className="font-medium">Carried Interest / Promote</div>
                              <div className="text-sm text-muted-foreground">Split remaining profits between LP and GP</div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">LP</span>
                              <span className="font-medium">
                                {(() => {
                                  const promoLayer = equityLayers.find(l => l.promoteTiers && (l.promoteTiers as any[]).length > 0);
                                  if (promoLayer) {
                                    const tiers = promoLayer.promoteTiers as { lpSplit: number }[];
                                    return `${(tiers[tiers.length - 1]?.lpSplit * 100 || 80).toFixed(0)}%`;
                                  }
                                  return '80%';
                                })()}
                              </span>
                              <span className="text-muted-foreground">/</span>
                              <span className="font-medium">
                                {(() => {
                                  const promoLayer = equityLayers.find(l => l.promoteTiers && (l.promoteTiers as any[]).length > 0);
                                  if (promoLayer) {
                                    const tiers = promoLayer.promoteTiers as { gpSplit: number }[];
                                    return `${(tiers[tiers.length - 1]?.gpSplit * 100 || 20).toFixed(0)}%`;
                                  }
                                  return '20%';
                                })()}
                              </span>
                              <span className="text-muted-foreground">GP</span>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Tiered Promote Schedule */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-medium">Tiered Promote Schedule</div>
                            <Button variant="outline" size="sm">
                              <Plus className="h-3 w-3 mr-1" />
                              Add Tier
                            </Button>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>IRR Hurdle</TableHead>
                                <TableHead>LP Split</TableHead>
                                <TableHead>GP Split (Promote)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                const promoLayer = equityLayers.find(l => l.promoteTiers && (l.promoteTiers as any[]).length > 0);
                                const tiers = promoLayer?.promoteTiers as { irrHurdle: number; lpSplit: number; gpSplit: number }[] || [];
                                
                                if (tiers.length === 0) {
                                  return (
                                    <>
                                      <TableRow><TableCell>0% - 8%</TableCell><TableCell>100%</TableCell><TableCell>0%</TableCell></TableRow>
                                      <TableRow><TableCell>8% - 12%</TableCell><TableCell>80%</TableCell><TableCell>20%</TableCell></TableRow>
                                      <TableRow><TableCell>12%+</TableCell><TableCell>70%</TableCell><TableCell>30%</TableCell></TableRow>
                                    </>
                                  );
                                }
                                
                                // Tier 0: below first hurdle = 100% LP
                                const rows = [
                                  <TableRow key="base" className="bg-blue-50/30">
                                    <TableCell>0% - {(tiers[0].irrHurdle * 100).toFixed(0)}%</TableCell>
                                    <TableCell>100%</TableCell>
                                    <TableCell>0%</TableCell>
                                  </TableRow>
                                ];
                                
                                tiers.forEach((tier, i) => {
                                  const nextHurdle = tiers[i + 1]?.irrHurdle;
                                  rows.push(
                                    <TableRow key={i}>
                                      <TableCell>{(tier.irrHurdle * 100).toFixed(0)}%{nextHurdle ? ` - ${(nextHurdle * 100).toFixed(0)}%` : '+'}</TableCell>
                                      <TableCell>{(tier.lpSplit * 100).toFixed(0)}%</TableCell>
                                      <TableCell className="font-medium text-purple-600">{(tier.gpSplit * 100).toFixed(0)}%</TableCell>
                                    </TableRow>
                                  );
                                });
                                
                                return rows;
                              })()}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* PARTNERS TAB - LP/GP Management with Yields & Returns */}
                  <TabsContent value="partners" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Partners & Commitments</h3>
                      <Button size="sm" onClick={() => {
                        setEditingEquity(null);
                        equityForm.reset();
                        setShowAddEquity(true);
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Partner
                      </Button>
                    </div>

                    {(() => {
                      const gpPartners = equityLayers.filter(l => l.investorType === 'gp' || l.investorType === 'sponsor');
                      const lpPartners = equityLayers.filter(l => l.investorType === 'lp' || l.investorType === 'institutional' || l.investorType === 'family_office' || l.investorType === 'hnwi');
                      const gpTotal = gpPartners.reduce((sum, p) => sum + parseNumber(p.commitmentAmount), 0);
                      const lpTotal = lpPartners.reduce((sum, p) => sum + parseNumber(p.commitmentAmount), 0);
                      const grandTotal = gpTotal + lpTotal;
                      
                      const holdPeriod = stack?.holdPeriodYears || 5;
                      const exitCapRate = Math.max(parseNumber(stack?.exitCapRate) || 0.07, 0.01);
                      const noiGrowthRate = parseNumber(stack?.noiGrowthRate) || 0.02;
                      const currentNoi = parseNumber(noi);
                      const terminalNoi = currentNoi * Math.pow(1 + noiGrowthRate, holdPeriod);
                      const exitValue = exitCapRate > 0 ? terminalNoi / exitCapRate : 0;
                      const grossProceeds = Math.max(0, exitValue - totalDebt);
                      const totalProfit = Math.max(0, grossProceeds - grandTotal);
                      
                      const totalPrefAccrued = equityLayers.reduce((sum, p) => {
                        const commitment = parseNumber(p.commitmentAmount);
                        const pref = parseNumber(p.preferredReturn) || 0.08;
                        return sum + (commitment * pref * holdPeriod);
                      }, 0);
                      const profitAfterPref = Math.max(0, totalProfit - totalPrefAccrued);
                      
                      const gpPromotePercent = gpPartners.length > 0 ? (parseNumber(gpPartners[0].promoteSplit) || 0.20) : 0.20;
                      const lpProfitPercent = 1 - gpPromotePercent;
                      
                      const calcPartnerReturns = (commitment: number, ownershipPct: number, prefReturn: number, isGp: boolean) => {
                        if (commitment <= 0 || grandTotal <= 0) {
                          return { irr: 0, multiple: 0, totalDistribution: 0, cashOnCash: 0 };
                        }
                        const effectiveOwnership = ownershipPct > 0 ? ownershipPct : commitment / grandTotal;
                        const lpOwnershipShare = lpTotal > 0 ? commitment / lpTotal : 0;
                        
                        const capitalReturn = commitment;
                        const prefAccrued = commitment * prefReturn * holdPeriod;
                        
                        let promoteShare = 0;
                        if (isGp) {
                          promoteShare = profitAfterPref * gpPromotePercent * (gpTotal > 0 ? commitment / gpTotal : 1);
                        } else {
                          promoteShare = profitAfterPref * lpProfitPercent * lpOwnershipShare;
                        }
                        
                        const totalDistribution = capitalReturn + prefAccrued + promoteShare;
                        const multiple = totalDistribution / commitment;
                        const irr = holdPeriod > 0 ? Math.pow(Math.max(multiple, 0), 1 / holdPeriod) - 1 : 0;
                        const cashOnCash = prefReturn;
                        
                        return {
                          irr: Math.min(Math.max(irr, -1), 2),
                          multiple: Math.max(multiple, 0),
                          totalDistribution: Math.max(totalDistribution, 0),
                          cashOnCash,
                        };
                      };
                      
                      const gpWeightedIRR = gpTotal > 0 
                        ? gpPartners.reduce((sum, p) => {
                            const commitment = parseNumber(p.commitmentAmount);
                            const returns = calcPartnerReturns(commitment, parseNumber(p.ownershipPct), parseNumber(p.preferredReturn) || 0.08, true);
                            return sum + (returns.irr * commitment);
                          }, 0) / gpTotal
                        : 0;
                        
                      const lpWeightedIRR = lpTotal > 0
                        ? lpPartners.reduce((sum, p) => {
                            const commitment = parseNumber(p.commitmentAmount);
                            const returns = calcPartnerReturns(commitment, parseNumber(p.ownershipPct), parseNumber(p.preferredReturn) || 0.08, false);
                            return sum + (returns.irr * commitment);
                          }, 0) / lpTotal
                        : 0;
                        
                      const lpWeightedPref = lpTotal > 0
                        ? lpPartners.reduce((sum, p) => {
                            const commitment = parseNumber(p.commitmentAmount);
                            const pref = parseNumber(p.preferredReturn) || 0.08;
                            return sum + (pref * commitment);
                          }, 0) / lpTotal
                        : 0.08;

                      return (
                        <>
                          <div className="grid gap-4 md:grid-cols-2">
                            <Card className="border-2 border-amber-500/30 bg-amber-50/30">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Badge className="bg-amber-600">GP</Badge>
                                  General Partners ({gpPartners.length})
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Total GP Capital</span>
                                  <span className="font-medium">{formatCurrency(gpTotal)} ({grandTotal > 0 ? ((gpTotal / grandTotal) * 100).toFixed(1) : 0}%)</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Promote Structure</span>
                                  <span className="font-medium">{formatPercent(gpPromotePercent * 100)} above pref</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Wtd. Proj. IRR</span>
                                  <span className={`font-medium ${gpWeightedIRR >= 0.15 ? 'text-green-600' : gpWeightedIRR >= 0.08 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {gpPartners.length > 0 ? formatPercent(gpWeightedIRR * 100) : '—'}
                                  </span>
                                </div>
                                <Separator />
                                <div className="flex justify-between text-sm font-medium">
                                  <span>Projected Returns</span>
                                  <span className="text-green-600">
                                    {formatCurrency(gpPartners.reduce((sum, p) => {
                                      const commitment = parseNumber(p.commitmentAmount);
                                      const returns = calcPartnerReturns(commitment, parseNumber(p.ownershipPct), parseNumber(p.preferredReturn) || 0.08, true);
                                      return sum + returns.totalDistribution;
                                    }, 0))}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="border-2 border-green-500/30 bg-green-50/30">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Badge className="bg-green-600 text-white">LP</Badge>
                                  Limited Partners ({lpPartners.length})
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Total LP Capital</span>
                                  <span className="font-medium">{formatCurrency(lpTotal)} ({grandTotal > 0 ? ((lpTotal / grandTotal) * 100).toFixed(1) : 0}%)</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Wtd. Preferred Return</span>
                                  <span className="font-medium">{formatPercent(lpWeightedPref * 100)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Wtd. Proj. IRR</span>
                                  <span className={`font-medium ${lpWeightedIRR >= 0.15 ? 'text-green-600' : lpWeightedIRR >= 0.08 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {lpPartners.length > 0 ? formatPercent(lpWeightedIRR * 100) : '—'}
                                  </span>
                                </div>
                                <Separator />
                                <div className="flex justify-between text-sm font-medium">
                                  <span>Projected Returns</span>
                                  <span className="text-green-600">
                                    {formatCurrency(lpPartners.reduce((sum, p) => {
                                      const commitment = parseNumber(p.commitmentAmount);
                                      const returns = calcPartnerReturns(commitment, parseNumber(p.ownershipPct), parseNumber(p.preferredReturn) || 0.08, false);
                                      return sum + returns.totalDistribution;
                                    }, 0))}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <PieChart className="h-4 w-4" />
                                Partner-Level Returns Analysis
                              </CardTitle>
                              <CardDescription>
                                Based on {holdPeriod}-year hold, {formatPercent(exitCapRate * 100)} exit cap, {formatPercent(noiGrowthRate * 100)} NOI growth
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {equityLayers.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p>No partners added yet. Add equity layers to see partner returns.</p>
                                </div>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Partner</TableHead>
                                      <TableHead>Type</TableHead>
                                      <TableHead className="text-right">Commitment</TableHead>
                                      <TableHead className="text-right">Ownership</TableHead>
                                      <TableHead className="text-right">Pref Return</TableHead>
                                      <TableHead className="text-right">Cash-on-Cash</TableHead>
                                      <TableHead className="text-right">Equity Multiple</TableHead>
                                      <TableHead className="text-right">Proj. IRR</TableHead>
                                      <TableHead className="text-right">Total Distribution</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {equityLayers.map((layer) => {
                                      const commitment = parseNumber(layer.commitmentAmount);
                                      const ownership = parseNumber(layer.ownershipPct);
                                      const prefReturn = parseNumber(layer.preferredReturn) || 0.08;
                                      const isGp = layer.investorType === 'gp' || layer.investorType === 'sponsor';
                                      const returns = calcPartnerReturns(commitment, ownership, prefReturn, isGp);
                                      
                                      return (
                                        <TableRow key={layer.id}>
                                          <TableCell className="font-medium">{layer.name}</TableCell>
                                          <TableCell>
                                            <Badge className={isGp ? 'bg-amber-600' : 'bg-green-600 text-white'}>
                                              {isGp ? 'GP' : 'LP'}
                                            </Badge>
                                          </TableCell>
                                          <TableCell className="text-right">{formatCurrency(commitment)}</TableCell>
                                          <TableCell className="text-right">
                                            {ownership > 0 ? formatPercent(ownership * 100) : formatPercent((grandTotal > 0 ? commitment / grandTotal : 0) * 100)}
                                          </TableCell>
                                          <TableCell className="text-right">{formatPercent(prefReturn * 100)}</TableCell>
                                          <TableCell className="text-right">{formatPercent(returns.cashOnCash * 100)}</TableCell>
                                          <TableCell className="text-right font-medium">{returns.multiple.toFixed(2)}x</TableCell>
                                          <TableCell className="text-right">
                                            <span className={`font-medium ${returns.irr >= 0.15 ? 'text-green-600' : returns.irr >= 0.08 ? 'text-amber-600' : 'text-red-600'}`}>
                                              {formatPercent(returns.irr * 100)}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-right font-medium text-green-600">
                                            {formatCurrency(returns.totalDistribution)}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                  <tfoot>
                                    <TableRow className="bg-muted/50 font-medium">
                                      <TableCell>Total</TableCell>
                                      <TableCell>{equityLayers.length} Partners</TableCell>
                                      <TableCell className="text-right">{formatCurrency(grandTotal)}</TableCell>
                                      <TableCell className="text-right">100.0%</TableCell>
                                      <TableCell className="text-right">—</TableCell>
                                      <TableCell className="text-right">—</TableCell>
                                      <TableCell className="text-right">
                                        {grandTotal > 0 ? (grossProceeds / grandTotal).toFixed(2) : '0.00'}x
                                      </TableCell>
                                      <TableCell className="text-right">—</TableCell>
                                      <TableCell className="text-right text-green-600">{formatCurrency(grossProceeds)}</TableCell>
                                    </TableRow>
                                  </tfoot>
                                </Table>
                              )}
                            </CardContent>
                          </Card>

                          <Card className="bg-slate-50">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Calculator className="h-4 w-4" />
                                Waterfall Assumptions
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground block">Exit Value</span>
                                  <span className="font-semibold">{formatCurrency(exitValue)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Less: Debt Payoff</span>
                                  <span className="font-semibold text-red-600">({formatCurrency(totalDebt)})</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Gross Proceeds</span>
                                  <span className="font-semibold text-green-600">{formatCurrency(grossProceeds)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Total Profit</span>
                                  <span className="font-semibold text-green-600">{formatCurrency(totalProfit)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </>
                      );
                    })()}
                  </TabsContent>

                  {/* RETURNS TAB - Investor Returns Analysis */}
                  <TabsContent value="returns" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <TrendingUp className="h-5 w-5" />
                              Investor Returns Analysis
                            </CardTitle>
                            <CardDescription>Computed from actual projections and capital structure</CardDescription>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => generateProjectionsMutation.mutate()} disabled={generateProjectionsMutation.isPending}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${generateProjectionsMutation.isPending ? 'animate-spin' : ''}`} />
                            Recalculate
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const lastProj = projections[projections.length - 1];
                          const exitVal = lastProj ? parseNumber(lastProj.exitValue) : 0;
                          const loanPayoff = lastProj ? parseNumber(lastProj.loanPayoff) : 0;
                          const netSaleProceeds = lastProj ? parseNumber(lastProj.netSaleProceeds) : 0;
                          const totalCashFlows = projections.reduce((s, p) => s + parseNumber(p.cashFlowAfterDebt), 0);
                          const totalProceeds = totalCashFlows + netSaleProceeds;
                          const totalProfit = totalProceeds - totalEquity;
                          const projIrr = lastProj ? parseNumber(lastProj.irr) : 0;
                          const projEqMult = lastProj ? parseNumber(lastProj.equityMultiple) : 0;
                          const avgCoC = projections.length > 0
                            ? projections.reduce((s, p) => s + parseNumber(p.cashOnCash), 0) / projections.length : 0;
                          
                          const gpLayers = equityLayers.filter(l => l.investorType === 'gp' || l.layerType === 'promote');
                          const lpLayers = equityLayers.filter(l => l.investorType !== 'gp' && l.layerType !== 'promote');
                          const gpEquity = gpLayers.reduce((s, l) => s + parseNumber(l.commitmentAmount), 0);
                          const lpEquity = lpLayers.reduce((s, l) => s + parseNumber(l.commitmentAmount), 0);
                          const gpPct = totalEquity > 0 ? gpEquity / totalEquity : 0;
                          const lpPct = totalEquity > 0 ? lpEquity / totalEquity : 1;

                          // Simple waterfall calc
                          let remaining = totalProceeds;
                          const t1_roc = Math.min(remaining, totalEquity);
                          remaining -= t1_roc;
                          const prefRate = gpLayers[0]?.preferredReturn ? parseNumber(gpLayers[0].preferredReturn) / 100 : 0.08;
                          const holdYrs = projections.length || 5;
                          const prefAmount = totalEquity * prefRate * holdYrs;
                          const t2_pref = Math.min(remaining, prefAmount);
                          remaining -= t2_pref;
                          const catchUpPct = gpLayers[0]?.catchUpPct ? parseNumber(gpLayers[0].catchUpPct) / 100 : 1;
                          const gpCatchUp = Math.min(remaining, t2_pref * gpPct / (1 - gpPct)) * catchUpPct;
                          const t3_catchup = Math.min(remaining, gpCatchUp);
                          remaining -= t3_catchup;
                          const promoteSplit = 0.2;
                          const t4_gp = remaining * promoteSplit;
                          const t4_lp = remaining * (1 - promoteSplit);

                          if (projections.length === 0) {
                            return (
                              <div className="text-center py-8 text-muted-foreground">
                                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Generate projections to see returns analysis</p>
                              </div>
                            );
                          }

                          return (
                            <>
                              <div className="grid gap-4 md:grid-cols-4 mb-6">
                                <Card className="bg-blue-500/10 border-blue-500/20">
                                  <CardContent className="pt-4 text-center">
                                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalProceeds)}</div>
                                    <div className="text-xs text-muted-foreground">Total Proceeds</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-green-500/10 border-green-500/20">
                                  <CardContent className="pt-4 text-center">
                                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalProfit)}</div>
                                    <div className="text-xs text-muted-foreground">Total Profit</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-purple-500/10 border-purple-500/20">
                                  <CardContent className="pt-4 text-center">
                                    <div className="text-2xl font-bold text-purple-600">{projIrr.toFixed(1)}%</div>
                                    <div className="text-xs text-muted-foreground">Levered IRR</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-orange-500/10 border-orange-500/20">
                                  <CardContent className="pt-4 text-center">
                                    <div className="text-2xl font-bold text-orange-600">{projEqMult.toFixed(2)}x</div>
                                    <div className="text-xs text-muted-foreground">Equity Multiple</div>
                                  </CardContent>
                                </Card>
                              </div>

                              {/* Waterfall Distribution */}
                              <div className="space-y-3">
                                <h4 className="font-medium">Waterfall Distribution</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Tier</TableHead>
                                      <TableHead>Description</TableHead>
                                      <TableHead>Amount</TableHead>
                                      <TableHead>LP Share</TableHead>
                                      <TableHead>GP Share</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow className="bg-blue-500/5">
                                      <TableCell><Badge variant="outline">Tier 1</Badge></TableCell>
                                      <TableCell>Return of Capital</TableCell>
                                      <TableCell className="font-medium">{formatCurrency(t1_roc)}</TableCell>
                                      <TableCell>{formatCurrency(t1_roc * lpPct)}</TableCell>
                                      <TableCell>{formatCurrency(t1_roc * gpPct)}</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-green-500/5">
                                      <TableCell><Badge variant="outline">Tier 2</Badge></TableCell>
                                      <TableCell>Preferred Return ({(prefRate * 100).toFixed(0)}%)</TableCell>
                                      <TableCell className="font-medium">{formatCurrency(t2_pref)}</TableCell>
                                      <TableCell>{formatCurrency(t2_pref)}</TableCell>
                                      <TableCell>$0</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-orange-500/5">
                                      <TableCell><Badge variant="outline">Tier 3</Badge></TableCell>
                                      <TableCell>GP Catch-Up</TableCell>
                                      <TableCell className="font-medium">{formatCurrency(t3_catchup)}</TableCell>
                                      <TableCell>$0</TableCell>
                                      <TableCell>{formatCurrency(t3_catchup)}</TableCell>
                                    </TableRow>
                                    <TableRow className="bg-purple-500/5">
                                      <TableCell><Badge variant="outline">Tier 4</Badge></TableCell>
                                      <TableCell>Carried Interest / Promote</TableCell>
                                      <TableCell className="font-medium">{formatCurrency(t4_gp + t4_lp)}</TableCell>
                                      <TableCell>{formatCurrency(t4_lp)}</TableCell>
                                      <TableCell>{formatCurrency(t4_gp)}</TableCell>
                                    </TableRow>
                                    <TableRow className="border-t-2 font-bold">
                                      <TableCell></TableCell>
                                      <TableCell>Total</TableCell>
                                      <TableCell>{formatCurrency(totalProceeds)}</TableCell>
                                      <TableCell className="text-green-600">{formatCurrency(t1_roc * lpPct + t2_pref + t4_lp)}</TableCell>
                                      <TableCell className="text-blue-600">{formatCurrency(t1_roc * gpPct + t3_catchup + t4_gp)}</TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>

                              {/* Per-Investor LP Report */}
                              {equityLayers.length > 0 && (
                                <div className="mt-6 space-y-3">
                                  <h4 className="font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Per-Investor Returns
                                  </h4>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Investor</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Contributed</TableHead>
                                        <TableHead>Ownership</TableHead>
                                        <TableHead>Distributions</TableHead>
                                        <TableHead>Profit</TableHead>
                                        <TableHead>Multiple</TableHead>
                                        <TableHead>IRR</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {equityLayers.map(layer => {
                                        const pct = parseNumber(layer.ownershipPct) / 100;
                                        const contributed = parseNumber(layer.commitmentAmount);
                                        const isGp = layer.investorType === 'gp' || layer.layerType === 'promote';
                                        const distributions = isGp
                                          ? (t1_roc * gpPct + t3_catchup + t4_gp) * (contributed / Math.max(gpEquity, 1))
                                          : (t1_roc * lpPct + t2_pref + t4_lp) * (contributed / Math.max(lpEquity, 1));
                                        const profit = distributions - contributed;
                                        const multiple = contributed > 0 ? distributions / contributed : 0;
                                        const investorIrr = contributed > 0 ? ((Math.pow(multiple, 1 / holdYrs) - 1) * 100) : 0;
                                        
                                        return (
                                          <TableRow key={layer.id}>
                                            <TableCell className="font-medium">{layer.name}</TableCell>
                                            <TableCell>
                                              <Badge variant={isGp ? 'default' : 'secondary'} className="text-xs">
                                                {isGp ? 'GP' : 'LP'}
                                              </Badge>
                                            </TableCell>
                                            <TableCell>{formatCurrency(contributed)}</TableCell>
                                            <TableCell>{parseNumber(layer.ownershipPct).toFixed(1)}%</TableCell>
                                            <TableCell className="font-medium text-green-600">{formatCurrency(distributions)}</TableCell>
                                            <TableCell className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(profit)}</TableCell>
                                            <TableCell className="font-medium">{multiple.toFixed(2)}x</TableCell>
                                            <TableCell className={investorIrr >= 15 ? 'text-green-600 font-medium' : ''}>{investorIrr.toFixed(1)}%</TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* REFI SCENARIO TAB */}
                  <TabsContent value="refi" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <RefreshCw className="h-5 w-5" />
                          Refinance Scenario
                        </CardTitle>
                        <CardDescription>Model mid-hold refinancing. Bridge/mezz debt is called first, then senior debt is replaced.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Current Debt Stack */}
                        <div>
                          <h4 className="font-medium text-sm mb-3">Current Debt Stack</h4>
                          <div className="space-y-2">
                            {debtTranches.map(t => {
                              const isBridgeMezz = t.trancheType === 'bridge' || t.trancheType === 'mezzanine';
                              return (
                                <div key={t.id} className={`p-3 rounded-lg border flex items-center justify-between ${isBridgeMezz ? 'bg-amber-50 border-amber-200' : 'bg-slate-50'}`}>
                                  <div className="flex items-center gap-3">
                                    <Badge variant={isBridgeMezz ? 'destructive' : 'secondary'} className="text-xs">
                                      {t.trancheType}
                                    </Badge>
                                    <span className="font-medium text-sm">{t.name}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span>{formatCurrency(parseNumber(t.principal))}</span>
                                    <span className="text-muted-foreground">{parseNumber(t.interestRate).toFixed(2)}%</span>
                                    <span className="text-muted-foreground">{t.termYears}yr</span>
                                    {isBridgeMezz && (
                                      <Badge className="bg-amber-600 text-xs">Called at refi</Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {debtTranches.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">No debt tranches configured</p>
                            )}
                          </div>
                        </div>

                        <Separator />

                        {/* Refi Parameters */}
                        <div>
                          <h4 className="font-medium text-sm mb-3">Refinance Parameters</h4>
                          <div className="grid grid-cols-6 gap-4">
                            <div>
                              <Label className="text-xs">Refi Year</Label>
                              <Select value={String(refiYear)} onValueChange={(v) => setRefiYear(parseInt(v))}>
                                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: parseInt(stack?.holdPeriodYears?.toString() || '5') - 1 }, (_, i) => i + 1).map(yr => (
                                    <SelectItem key={yr} value={String(yr)}>Year {yr}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">New Rate (%)</Label>
                              <Input type="number" step="0.1" value={refiRate} onChange={e => setRefiRate(e.target.value)} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">Term (yrs)</Label>
                              <Input type="number" value={refiTermYears} onChange={e => setRefiTermYears(e.target.value)} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">Amort (yrs)</Label>
                              <Input type="number" value={refiAmortYears} onChange={e => setRefiAmortYears(e.target.value)} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">New LTV (%)</Label>
                              <Input type="number" step="1" value={refiLtv} onChange={e => setRefiLtv(e.target.value)} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs">I/O Months</Label>
                              <Input type="number" value={refiIoMonths} onChange={e => setRefiIoMonths(e.target.value)} className="h-8 mt-1" />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Before vs After Comparison */}
                        <div>
                          <h4 className="font-medium text-sm mb-3">Before vs After Refinance</h4>
                          {(() => {
                            const holdYears = parseInt(stack?.holdPeriodYears?.toString() || '5');
                            const baseNoi = projections[0]?.noi ? parseNumber(projections[0].noi) : 0;
                            
                            if (baseNoi === 0 || debtTranches.length === 0) {
                              return (
                                <div className="text-center py-6 text-muted-foreground">
                                  <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p>Generate projections and add debt tranches to model refinancing</p>
                                </div>
                              );
                            }

                            // Current debt metrics
                            const currentDS = annualDebtService;
                            const currentDscr = baseNoi > 0 && currentDS > 0 ? baseNoi / currentDS : 0;
                            const currentWeightedRate = debtTranches.reduce((s, t) => s + parseNumber(t.principal) * parseNumber(t.interestRate), 0) / totalDebt;

                            // Bridge/mezz debt to be called
                            const calledTranches = debtTranches.filter(t => t.trancheType === 'bridge' || t.trancheType === 'mezzanine');
                            const calledAmount = calledTranches.reduce((s, t) => s + parseNumber(t.principal), 0);
                            const remainingSenior = debtTranches.filter(t => t.trancheType !== 'bridge' && t.trancheType !== 'mezzanine');
                            const remainingSeniorPrincipal = remainingSenior.reduce((s, t) => s + parseNumber(t.principal), 0);

                            // Refi: new permanent loan replaces everything
                            const refiNoi = baseNoi * Math.pow(1.02, refiYear);
                            const refiPropertyValue = refiNoi / (parseFloat(stack?.exitCapRate?.toString() || '7') / 100);
                            const newLoanAmount = refiPropertyValue * (parseFloat(refiLtv) / 100);
                            const newRate = parseFloat(refiRate) / 100;
                            const newAmort = parseInt(refiAmortYears);
                            const monthlyRate = newRate / 12;
                            const numPayments = newAmort * 12;
                            const monthlyPayment = newLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
                            const ioMonths = parseInt(refiIoMonths);
                            const annualDSNew = ioMonths >= 12 ? newLoanAmount * newRate : monthlyPayment * 12;
                            const newDscr = refiNoi / annualDSNew;
                            const cashOutProceeds = newLoanAmount - totalDebt;

                            // IRR impact: simple before/after comparison
                            const calcIrr = (cfs: number[]) => {
                              let lo = -0.99, hi = 5, irr = 0;
                              for (let i = 0; i < 100; i++) {
                                irr = (lo + hi) / 2;
                                let npv = 0;
                                for (let j = 0; j < cfs.length; j++) npv += cfs[j] / Math.pow(1 + irr, j);
                                if (Math.abs(npv) < 1) break;
                                if (npv > 0) lo = irr; else hi = irr;
                              }
                              return irr;
                            };

                            const exitNoi = baseNoi * Math.pow(1.02, holdYears);
                            const exitVal = exitNoi / (parseFloat(stack?.exitCapRate?.toString() || '7') / 100);

                            // Before refi cash flows
                            const cfsBefore = [-totalEquity];
                            for (let yr = 1; yr <= holdYears; yr++) {
                              const yrNoi = baseNoi * Math.pow(1.02, yr);
                              const cf = yrNoi - currentDS;
                              cfsBefore.push(yr === holdYears ? cf + exitVal - totalDebt * 0.92 : cf);
                            }
                            const irrBefore = calcIrr(cfsBefore) * 100;

                            // After refi cash flows
                            const cfsAfter = [-totalEquity];
                            for (let yr = 1; yr <= holdYears; yr++) {
                              const yrNoi = baseNoi * Math.pow(1.02, yr);
                              if (yr < refiYear) {
                                cfsAfter.push(yrNoi - currentDS);
                              } else if (yr === refiYear) {
                                // Refi year: old DS for part, new DS for part, plus cash-out
                                cfsAfter.push(yrNoi - annualDSNew + (cashOutProceeds > 0 ? cashOutProceeds : 0));
                              } else {
                                const cf = yrNoi - annualDSNew;
                                const loanBal = newLoanAmount * 0.95;
                                cfsAfter.push(yr === holdYears ? cf + exitVal - loanBal : cf);
                              }
                            }
                            const irrAfter = calcIrr(cfsAfter) * 100;

                            return (
                              <div className="space-y-4">
                                {/* Called Debt Alert */}
                                {calledTranches.length > 0 && (
                                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                      <AlertCircle className="h-4 w-4 text-amber-600" />
                                      <span className="font-medium text-sm text-amber-800">Debt Called at Year {refiYear}</span>
                                    </div>
                                    <div className="text-xs text-amber-700 space-y-1">
                                      {calledTranches.map(t => (
                                        <div key={t.id} className="flex justify-between">
                                          <span>{t.name} ({t.trancheType})</span>
                                          <span className="font-medium">{formatCurrency(parseNumber(t.principal))}</span>
                                        </div>
                                      ))}
                                      <div className="flex justify-between pt-1 border-t border-amber-300 font-medium">
                                        <span>Total Called</span>
                                        <span>{formatCurrency(calledAmount)}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Cash-Out Proceeds */}
                                {cashOutProceeds > 0 && (
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <DollarSign className="h-4 w-4 text-green-600" />
                                      <span className="font-medium text-sm text-green-800">Cash-Out Refi Proceeds</span>
                                    </div>
                                    <span className="font-bold text-green-700">{formatCurrency(cashOutProceeds)}</span>
                                  </div>
                                )}

                                {/* Comparison Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                  <Card className="bg-slate-50">
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm">Before Refi (Acquisition)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                      <div className="flex justify-between"><span className="text-muted-foreground">Total Debt</span><span className="font-medium">{formatCurrency(totalDebt)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Weighted Rate</span><span className="font-medium">{currentWeightedRate.toFixed(2)}%</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Annual D/S</span><span className="font-medium">{formatCurrency(currentDS)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">DSCR</span><span className={`font-medium ${currentDscr >= 1.25 ? 'text-green-600' : 'text-red-600'}`}>{currentDscr.toFixed(2)}x</span></div>
                                      <Separator />
                                      <div className="flex justify-between font-medium"><span>Levered IRR</span><span className={irrBefore >= 15 ? 'text-green-600' : ''}>{irrBefore.toFixed(1)}%</span></div>
                                    </CardContent>
                                  </Card>
                                  <Card className="bg-blue-50/50 border-blue-200">
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-sm text-blue-700">After Refi (Year {refiYear})</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                      <div className="flex justify-between"><span className="text-muted-foreground">New Loan</span><span className="font-medium">{formatCurrency(newLoanAmount)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span className="font-medium">{refiRate}%</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">Annual D/S</span><span className="font-medium">{formatCurrency(annualDSNew)}</span></div>
                                      <div className="flex justify-between"><span className="text-muted-foreground">DSCR</span><span className={`font-medium ${newDscr >= 1.25 ? 'text-green-600' : 'text-red-600'}`}>{newDscr.toFixed(2)}x</span></div>
                                      <Separator />
                                      <div className="flex justify-between font-medium"><span>Levered IRR</span><span className={irrAfter >= 15 ? 'text-green-600' : ''}>{irrAfter.toFixed(1)}%</span></div>
                                    </CardContent>
                                  </Card>
                                </div>

                                {/* IRR Impact Summary */}
                                <div className={`p-3 rounded-lg border text-sm flex justify-between items-center ${irrAfter > irrBefore ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                  <span className="font-medium">IRR Impact</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{irrBefore.toFixed(1)}%</span>
                                    <span>&#8594;</span>
                                    <span className={`font-bold ${irrAfter > irrBefore ? 'text-green-700' : 'text-red-700'}`}>{irrAfter.toFixed(1)}%</span>
                                    <Badge className={irrAfter > irrBefore ? 'bg-green-600' : 'bg-red-600'}>
                                      {irrAfter > irrBefore ? '+' : ''}{(irrAfter - irrBefore).toFixed(1)}%
                                    </Badge>
                                  </div>
                                </div>

                                {/* Year-by-Year Cash Flow */}
                                <div>
                                  <h5 className="text-sm font-medium mb-2">Year-by-Year Cash Flow Comparison</h5>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Year</TableHead>
                                        <TableHead className="text-xs">NOI</TableHead>
                                        <TableHead className="text-xs">Before Refi CF</TableHead>
                                        <TableHead className="text-xs">After Refi CF</TableHead>
                                        <TableHead className="text-xs">Delta</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {Array.from({ length: holdYears }, (_, i) => i + 1).map(yr => {
                                        const yrNoi = baseNoi * Math.pow(1.02, yr);
                                        const before = cfsBefore[yr];
                                        const after = cfsAfter[yr];
                                        const delta = after - before;
                                        return (
                                          <TableRow key={yr} className={yr === refiYear ? 'bg-blue-50' : ''}>
                                            <TableCell className="text-xs font-medium">
                                              {yr}{yr === refiYear && <Badge className="ml-1 text-[9px] bg-blue-600">REFI</Badge>}
                                            </TableCell>
                                            <TableCell className="text-xs">{formatCurrency(yrNoi)}</TableCell>
                                            <TableCell className="text-xs">{formatCurrency(before)}</TableCell>
                                            <TableCell className="text-xs font-medium">{formatCurrency(after)}</TableCell>
                                            <TableCell className={`text-xs font-medium ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : ''}`}>
                                              {delta > 0 ? '+' : ''}{formatCurrency(delta)}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* SOURCES & USES TAB */}
                  <TabsContent value="sources-uses" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Sources &amp; Uses of Funds
                        </CardTitle>
                        <CardDescription>Closing statement auto-balanced from capital stack</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-sm mb-3 text-green-700 flex items-center gap-2">
                              <DollarSign className="h-4 w-4" /> Sources
                            </h4>
                            <Table>
                              <TableBody>
                                {debtTranches.map((t) => (
                                  <TableRow key={t.id}>
                                    <TableCell className="text-sm">{t.name}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(parseNumber(t.principal))}</TableCell>
                                  </TableRow>
                                ))}
                                {equityLayers.map((l) => (
                                  <TableRow key={l.id}>
                                    <TableCell className="text-sm">{l.name} (Equity)</TableCell>
                                    <TableCell className="text-right font-medium text-green-600">{formatCurrency(parseNumber(l.commitmentAmount))}</TableCell>
                                  </TableRow>
                                ))}
                                <TableRow className="border-t-2 font-bold">
                                  <TableCell>Total Sources</TableCell>
                                  <TableCell className="text-right">{formatCurrency(totalDebt + totalEquity)}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm mb-3 text-blue-700 flex items-center gap-2">
                              <Building2 className="h-4 w-4" /> Uses
                            </h4>
                            <Table>
                              <TableBody>
                                <TableRow>
                                  <TableCell className="text-sm">Purchase Price</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(purchasePrice)}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="text-sm">Closing Costs</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(parseNumber(stack?.closingCosts))}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="text-sm">CapEx Reserves</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(parseNumber(stack?.capexReserves))}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell className="text-sm">Working Capital</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(parseNumber(stack?.workingCapital))}</TableCell>
                                </TableRow>
                                {(() => {
                                  const totalUses = purchasePrice + parseNumber(stack?.closingCosts) + parseNumber(stack?.capexReserves) + parseNumber(stack?.workingCapital);
                                  const origFees = debtTranches.reduce((sum, t) => sum + parseNumber(t.principal) * parseNumber(t.originationFeePct), 0);
                                  return (
                                    <>
                                      {origFees > 0 && (
                                        <TableRow>
                                          <TableCell className="text-sm">Loan Origination Fees</TableCell>
                                          <TableCell className="text-right font-medium">{formatCurrency(origFees)}</TableCell>
                                        </TableRow>
                                      )}
                                      <TableRow className="border-t-2 font-bold">
                                        <TableCell>Total Uses</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totalUses + origFees)}</TableCell>
                                      </TableRow>
                                    </>
                                  );
                                })()}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                        {(() => {
                          const totalSources = totalDebt + totalEquity;
                          const origFees = debtTranches.reduce((sum, t) => sum + parseNumber(t.principal) * parseNumber(t.originationFeePct), 0);
                          const totalUses = purchasePrice + parseNumber(stack?.closingCosts) + parseNumber(stack?.capexReserves) + parseNumber(stack?.workingCapital) + origFees;
                          const gap = totalSources - totalUses;
                          return (
                            <div className={`mt-4 p-3 rounded-lg border text-sm flex justify-between items-center ${Math.abs(gap) < 100 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                              <span>Sources - Uses = {formatCurrency(gap)}</span>
                              {Math.abs(gap) < 100 ? (
                                <Badge className="bg-green-600">Balanced</Badge>
                              ) : gap > 0 ? (
                                <Badge variant="outline" className="border-amber-500 text-amber-700">Excess: {formatCurrency(gap)}</Badge>
                              ) : (
                                <Badge variant="outline" className="border-red-500 text-red-700">Gap: {formatCurrency(Math.abs(gap))}</Badge>
                              )}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* SENSITIVITY MATRIX TAB */}
                  <TabsContent value="sensitivity" className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          Sensitivity Matrix
                        </CardTitle>
                        <CardDescription>How returns change with different cap rates and LTV</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const baseCapRate = parseFloat(stack?.exitCapRate?.toString() || '7') / 100;
                          const capRates = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map(d => baseCapRate + d / 100);
                          const ltvLevels = [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80];
                          const baseNoi = projections[0]?.noi ? parseNumber(projections[0].noi) : 0;
                          if (baseNoi === 0) {
                            return (
                              <div className="text-center py-8 text-muted-foreground">
                                <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Generate projections first to see the sensitivity matrix</p>
                              </div>
                            );
                          }
                          return (
                            <div className="overflow-x-auto">
                              <p className="text-xs text-muted-foreground mb-3">Estimated Levered IRR. Green 15%+, yellow 10%+, red below.</p>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs font-bold">Exit Cap / LTV</TableHead>
                                    {ltvLevels.map(l => (
                                      <TableHead key={l} className="text-xs text-center">{(l * 100).toFixed(0)}%</TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {capRates.map(cr => {
                                    const exitNoi = baseNoi * Math.pow(1 + parseFloat(stack?.noiGrowthRate?.toString() || '0.02'), parseInt(stack?.holdPeriodYears?.toString() || '5'));
                                    const exitVal = exitNoi / cr;
                                    return (
                                      <TableRow key={cr}>
                                        <TableCell className="text-xs font-semibold">{(cr * 100).toFixed(1)}%</TableCell>
                                        {ltvLevels.map(ltvPct => {
                                          const debtAmt = purchasePrice * ltvPct;
                                          const eqAmt = purchasePrice - debtAmt;
                                          if (eqAmt <= 0) return <TableCell key={ltvPct} className="text-center text-xs">-</TableCell>;
                                          const avgRate = debtTranches.length > 0
                                            ? debtTranches.reduce((s, t) => s + parseNumber(t.interestRate), 0) / debtTranches.length / 100 : 0.06;
                                          const annualDS = debtAmt * (avgRate + 0.02);
                                          const holdYears = parseInt(stack?.holdPeriodYears?.toString() || '5');
                                          const cfs = [-eqAmt];
                                          for (let yr = 1; yr <= holdYears; yr++) {
                                            const yrNoi = baseNoi * Math.pow(1.02, yr);
                                            const cf = yrNoi - annualDS;
                                            cfs.push(yr === holdYears ? cf + exitVal - debtAmt * 0.92 : cf);
                                          }
                                          let lo = -0.99, hi = 5, irr = 0;
                                          for (let i = 0; i < 100; i++) {
                                            irr = (lo + hi) / 2;
                                            let npv = 0;
                                            for (let j = 0; j < cfs.length; j++) npv += cfs[j] / Math.pow(1 + irr, j);
                                            if (Math.abs(npv) < 1) break;
                                            if (npv > 0) lo = irr; else hi = irr;
                                          }
                                          const irrPct = irr * 100;
                                          const isBase = Math.abs(cr - baseCapRate) < 0.001 && Math.abs(ltvPct - ltv / 100) < 0.03;
                                          return (
                                            <TableCell key={ltvPct} className={`text-center text-xs font-medium ${isBase ? 'ring-2 ring-blue-500 bg-blue-50' : ''} ${irrPct >= 15 ? 'text-green-700 bg-green-50/50' : irrPct >= 10 ? 'text-yellow-700 bg-yellow-50/50' : 'text-red-700 bg-red-50/50'}`}>
                                              {irrPct.toFixed(1)}%
                                            </TableCell>
                                          );
                                        })}
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                              <p className="text-xs text-muted-foreground mt-2">Blue ring = current position.</p>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </TabsContent>

                </Tabs>

                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Delete this capital stack?')) {
                        deleteStackMutation.mutate(selectedStackId);
                      }
                    }}
                    data-testid="button-delete-stack"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Stack
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

        </TabsContent>
      </Tabs>
    </div>
  );
}
