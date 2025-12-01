import { useState, useEffect } from 'react';
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
  BarChart3,
  Save,
  X,
  Info,
  ArrowUpDown,
  Copy,
  Settings2
} from 'lucide-react';
import type { CapitalStack, DebtTranche, EquityLayer, CapitalStackProjection } from '@shared/schema';

interface CapitalStackWorkspaceProps {
  projectId: string;
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
  { value: 'gp', label: 'General Partner (GP)' },
  { value: 'lp', label: 'Limited Partner (LP)' },
  { value: 'co_invest', label: 'Co-Investor' },
  { value: 'fundOfFunds', label: 'Fund of Funds' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'institutional', label: 'Institutional' },
];

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

export default function CapitalStackWorkspace({ projectId }: CapitalStackWorkspaceProps) {
  const { toast } = useToast();
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

  const { data: stacks, isLoading: stacksLoading } = useQuery<CapitalStack[]>({
    queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'],
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
      return apiRequest(`/api/modeling/capital-stacks/${selectedStackId}/equity-layers`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
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
      return apiRequest(`/api/modeling/equity-layers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
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
      return apiRequest(`/api/modeling/equity-layers/${id}`, { method: 'DELETE' });
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
    const payload = {
      name: data.name,
      layerType: data.layerType,
      investorName: data.investorName || null,
      investorType: data.investorType || null,
      commitmentAmount: data.commitmentAmount,
      fundedAmount: data.fundedAmount || '0',
      ownershipPct: data.ownershipPct,
      preferredReturn: data.preferredReturn || null,
      preferredReturnType: data.preferredReturnType || null,
      isParticipating: data.isParticipating ?? true,
      catchUpPct: data.catchUpPct || null,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Capital Stack Builder</h2>
          <p className="text-muted-foreground">Configure multi-tranche debt, equity layers, and waterfall distributions</p>
        </div>
        <Dialog open={showCreateStack} onOpenChange={setShowCreateStack}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-capital-stack">
              <Plus className="h-4 w-4 mr-2" />
              New Capital Stack
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Capital Stack</DialogTitle>
              <DialogDescription>Define the capital structure for this deal</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const purchasePrice = parseFloat(formData.get('purchasePrice') as string) || 0;
              const closingCosts = parseFloat(formData.get('closingCosts') as string) || 0;
              const capexReserves = parseFloat(formData.get('capexReserves') as string) || 0;
              const workingCapital = parseFloat(formData.get('workingCapital') as string) || 0;
              createStackMutation.mutate({
                name: formData.get('name'),
                description: formData.get('description'),
                purchasePrice: purchasePrice,
                closingCosts: closingCosts,
                capexReserves: capexReserves,
                workingCapital: workingCapital,
                totalCapitalization: purchasePrice + closingCosts + capexReserves + workingCapital,
                holdPeriodYears: parseInt(formData.get('holdPeriodYears') as string) || 5,
                exitCapRate: formData.get('exitCapRate') || '0.07',
                noiGrowthRate: formData.get('noiGrowthRate') || '0.02',
              });
            }}>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <Label htmlFor="name">Stack Name *</Label>
                  <Input id="name" name="name" placeholder="Base Case" required />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="Deal assumptions and notes..." rows={2} />
                </div>
                <Separator />
                <h4 className="font-medium text-sm">Uses of Funds</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchasePrice">Purchase Price *</Label>
                    <Input id="purchasePrice" name="purchasePrice" type="number" placeholder="10000000" required />
                  </div>
                  <div>
                    <Label htmlFor="closingCosts">Closing Costs</Label>
                    <Input id="closingCosts" name="closingCosts" type="number" placeholder="150000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="capexReserves">CapEx Reserves</Label>
                    <Input id="capexReserves" name="capexReserves" type="number" placeholder="200000" />
                  </div>
                  <div>
                    <Label htmlFor="workingCapital">Working Capital</Label>
                    <Input id="workingCapital" name="workingCapital" type="number" placeholder="50000" />
                  </div>
                </div>
                <Separator />
                <h4 className="font-medium text-sm">Exit Assumptions</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="holdPeriodYears">Hold Period (Years)</Label>
                    <Input id="holdPeriodYears" name="holdPeriodYears" type="number" placeholder="5" defaultValue="5" />
                  </div>
                  <div>
                    <Label htmlFor="exitCapRate">Exit Cap Rate</Label>
                    <Input id="exitCapRate" name="exitCapRate" type="number" step="0.001" placeholder="0.07" defaultValue="0.07" />
                  </div>
                  <div>
                    <Label htmlFor="noiGrowthRate">NOI Growth Rate</Label>
                    <Input id="noiGrowthRate" name="noiGrowthRate" type="number" step="0.001" placeholder="0.02" defaultValue="0.02" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateStack(false)}>Cancel</Button>
                <Button type="submit" disabled={createStackMutation.isPending}>
                  {createStackMutation.isPending ? 'Creating...' : 'Create Stack'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(!stacks || stacks.length === 0) ? (
        <Card className="p-8 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Capital Stacks</h3>
          <p className="text-muted-foreground mb-4">Create a capital stack to model debt and equity structure with waterfall distributions</p>
          <Button onClick={() => setShowCreateStack(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Capital Stack
          </Button>
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
                  <TabsList>
                    <TabsTrigger value="debt" className="gap-2">
                      <DollarSign className="h-4 w-4" />
                      Debt Tranches ({debtTranches.length})
                    </TabsTrigger>
                    <TabsTrigger value="equity" className="gap-2">
                      <PieChart className="h-4 w-4" />
                      Equity Layers ({equityLayers.length})
                    </TabsTrigger>
                    <TabsTrigger value="projections" className="gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Projections
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
                                    <FormLabel>{debtForm.watch('indexRate') === 'fixed' ? 'Interest Rate *' : 'All-In Rate *'}</FormLabel>
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
                                  <div className="text-xs text-muted-foreground mt-1">{tranche.indexRate} + {tranche.spreadBps}bps</div>
                                )}
                              </TableCell>
                              <TableCell>{formatCurrency(parseNumber(tranche.principal))}</TableCell>
                              <TableCell>
                                {formatPercent(parseNumber(tranche.interestRate) * 100)}
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
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{editingEquity ? 'Edit' : 'Add'} Equity Layer</DialogTitle>
                            <DialogDescription>Configure equity contribution, returns, and promote structure</DialogDescription>
                          </DialogHeader>
                          <Form {...equityForm}>
                            <form onSubmit={equityForm.handleSubmit(handleEquitySubmit)} className="space-y-6">
                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={equityForm.control} name="name" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Layer Name *</FormLabel>
                                    <FormControl><Input {...field} placeholder="LP Equity" /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={equityForm.control} name="layerType" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Type *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {EQUITY_LAYER_TYPES.map((t) => (
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

                              <div className="grid grid-cols-2 gap-4">
                                <FormField control={equityForm.control} name="investorName" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Investor Name</FormLabel>
                                    <FormControl><Input {...field} placeholder="ABC Capital Partners" /></FormControl>
                                  </FormItem>
                                )} />
                                <FormField control={equityForm.control} name="investorType" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Investor Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {INVESTOR_TYPES.map((t) => (
                                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                              </div>

                              <Separator />
                              <h4 className="font-medium text-sm">Contribution</h4>

                              <div className="grid grid-cols-3 gap-4">
                                <FormField control={equityForm.control} name="commitmentAmount" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Commitment Amount *</FormLabel>
                                    <FormControl><Input {...field} type="number" placeholder="5000000" /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={equityForm.control} name="fundedAmount" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Funded Amount</FormLabel>
                                    <FormControl><Input {...field} type="number" placeholder="5000000" /></FormControl>
                                    <FormDescription>Initial funding</FormDescription>
                                  </FormItem>
                                )} />
                                <FormField control={equityForm.control} name="ownershipPct" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Ownership % *</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.0001" placeholder="0.90" /></FormControl>
                                    <FormDescription>As decimal (90% = 0.90)</FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                              </div>

                              <Separator />
                              <h4 className="font-medium text-sm">Return Structure</h4>

                              <div className="grid grid-cols-3 gap-4">
                                <FormField control={equityForm.control} name="preferredReturn" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Preferred Return</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.01" placeholder="0.08" /></FormControl>
                                    <FormDescription>Annual pref rate (8% = 0.08)</FormDescription>
                                  </FormItem>
                                )} />
                                <FormField control={equityForm.control} name="preferredReturnType" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Pref Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {PREFERRED_RETURN_TYPES.map((t) => (
                                          <SelectItem key={t.value} value={t.value}>
                                            <div>
                                              <div>{t.label}</div>
                                              <div className="text-xs text-muted-foreground">{t.description}</div>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )} />
                                <FormField control={equityForm.control} name="catchUpPct" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>GP Catch-Up %</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.01" placeholder="0.50" /></FormControl>
                                    <FormDescription>After LP pref is met</FormDescription>
                                  </FormItem>
                                )} />
                              </div>

                              <FormField control={equityForm.control} name="isParticipating" render={({ field }) => (
                                <FormItem className="flex items-center gap-3">
                                  <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <div>
                                    <FormLabel>Participating Equity</FormLabel>
                                    <FormDescription>Participates in distributions after preferred return</FormDescription>
                                  </div>
                                </FormItem>
                              )} />

                              {layerType === 'promote' && (
                                <>
                                  <Separator />
                                  <div className="flex justify-between items-center">
                                    <h4 className="font-medium text-sm">Promote Tiers (Waterfall)</h4>
                                    <Button type="button" variant="outline" size="sm" onClick={addPromoteTier}>
                                      <Plus className="h-4 w-4 mr-1" /> Add Tier
                                    </Button>
                                  </div>

                                  <div className="space-y-3">
                                    {promoteTiers.map((tier, index) => (
                                      <Card key={index} className="p-3">
                                        <div className="flex items-center gap-4">
                                          <Badge variant="outline">Tier {index + 1}</Badge>
                                          <div className="flex-1 grid grid-cols-3 gap-3">
                                            <div>
                                              <Label className="text-xs">IRR Hurdle</Label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={tier.irrHurdle}
                                                onChange={(e) => updatePromoteTier(index, 'irrHurdle', parseFloat(e.target.value))}
                                                placeholder="0.08"
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-xs">GP Split</Label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={tier.gpSplit}
                                                onChange={(e) => updatePromoteTier(index, 'gpSplit', parseFloat(e.target.value))}
                                                placeholder="0.20"
                                              />
                                            </div>
                                            <div>
                                              <Label className="text-xs">LP Split</Label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={tier.lpSplit}
                                                onChange={(e) => updatePromoteTier(index, 'lpSplit', parseFloat(e.target.value))}
                                                placeholder="0.80"
                                              />
                                            </div>
                                          </div>
                                          {promoteTiers.length > 1 && (
                                            <Button type="button" variant="ghost" size="sm" onClick={() => removePromoteTier(index)}>
                                              <X className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-2">
                                          Above {formatPercent(tier.irrHurdle * 100)} IRR: GP receives {formatPercent(tier.gpSplit * 100)}, LP receives {formatPercent(tier.lpSplit * 100)}
                                        </div>
                                      </Card>
                                    ))}
                                  </div>
                                </>
                              )}

                              <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => { setShowAddEquity(false); setEditingEquity(null); }}>Cancel</Button>
                                <Button type="submit" disabled={createEquityMutation.isPending || updateEquityMutation.isPending}>
                                  <Save className="h-4 w-4 mr-2" />
                                  {editingEquity ? 'Update' : 'Add'} Layer
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
                        <CardTitle className="text-lg">Generate Projections</CardTitle>
                        <CardDescription>Calculate cash flows and returns based on NOI assumptions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 items-end">
                          <div>
                            <Label htmlFor="noi">Starting NOI ($)</Label>
                            <Input
                              id="noi"
                              type="number"
                              value={noi}
                              onChange={(e) => setNoi(e.target.value)}
                              placeholder="1000000"
                            />
                          </div>
                          <div>
                            <Label htmlFor="noiGrowth">Annual Growth Rate</Label>
                            <Input
                              id="noiGrowth"
                              type="number"
                              step="0.01"
                              value={noiGrowthRate}
                              onChange={(e) => setNoiGrowthRate(e.target.value)}
                              placeholder="0.02"
                            />
                          </div>
                          <Button
                            onClick={() => generateProjectionsMutation.mutate()}
                            disabled={generateProjectionsMutation.isPending}
                            data-testid="button-generate-projections"
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${generateProjectionsMutation.isPending ? 'animate-spin' : ''}`} />
                            Generate
                          </Button>
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
    </div>
  );
}
