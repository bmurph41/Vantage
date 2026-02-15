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
  Settings2,
  Briefcase,
  Link,
  Unlink
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { CapitalStack, DebtTranche, EquityLayer, CapitalStackProjection, Fund, FundDealAllocation, FundCapitalStackTemplate } from '@shared/schema';
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

export default function CapitalStackWorkspace({ projectId, onTabChange }: CapitalStackWorkspaceProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
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
  const [showFundInheritance, setShowFundInheritance] = useState(false);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState("capital-stack");
  
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Create Capital Stack</DialogTitle>
              <DialogDescription>Define the capital structure, partners, and waterfall for this deal</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="basics" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basics">Basics</TabsTrigger>
                <TabsTrigger value="partners">Partners</TabsTrigger>
                <TabsTrigger value="promote">Promote</TabsTrigger>
                <TabsTrigger value="exit">Exit</TabsTrigger>
              </TabsList>
              
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
                });
              }}>
                <div className="max-h-[55vh] overflow-y-auto py-4">
                  <TabsContent value="basics" className="space-y-4 mt-0">
                    <Card className="p-4 bg-slate-50/50">
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                        <Settings2 className="h-4 w-4 text-slate-600" />
                        Stack Details
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="name">Stack Name *</Label>
                          <Input id="name" name="name" placeholder="Base Case" required />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea id="description" name="description" placeholder="Deal assumptions and notes..." rows={2} />
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-4 bg-blue-50/50">
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        Uses of Funds
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="purchasePrice">Purchase Price *</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input id="purchasePrice" name="purchasePrice" type="number" placeholder="10,000,000" className="pl-8" required />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="closingCosts">Closing Costs</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input id="closingCosts" name="closingCosts" type="number" placeholder="150,000" className="pl-8" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="capexReserves">CapEx Reserves</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input id="capexReserves" name="capexReserves" type="number" placeholder="200,000" className="pl-8" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="workingCapital">Working Capital</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input id="workingCapital" name="workingCapital" type="number" placeholder="50,000" className="pl-8" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="partners" className="space-y-4 mt-0">
                    <Card className="p-4 bg-green-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-green-600" />
                          Capital Partners
                        </h4>
                        <Button type="button" variant="outline" size="sm" onClick={addStackPartner} className="bg-white">
                          <Plus className="h-4 w-4 mr-1" /> Add Partner
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Add GP and LP partners with their capital contributions and ownership percentages.
                      </p>
                      
                      <div className="space-y-3">
                        {stackPartners.map((partner, index) => (
                          <Card key={partner.id} className={`p-3 ${partner.type === 'gp' ? 'bg-amber-50 border-amber-200' : 'bg-white border-green-200'}`}>
                            <div className="flex items-center gap-3">
                              <Badge variant={partner.type === 'gp' ? 'default' : 'secondary'} className={partner.type === 'gp' ? 'bg-amber-600' : 'bg-green-600 text-white'}>
                                {partner.type === 'gp' ? 'GP' : 'LP'}
                              </Badge>
                              <div className="flex-1 grid grid-cols-4 gap-3">
                                <div>
                                  <Label className="text-xs">Partner Name</Label>
                                  <Input
                                    value={partner.name}
                                    onChange={(e) => updateStackPartner(partner.id, 'name', e.target.value)}
                                    placeholder="Partner name"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Commitment ($)</Label>
                                  <Input
                                    type="number"
                                    value={partner.commitmentAmount}
                                    onChange={(e) => updateStackPartner(partner.id, 'commitmentAmount', e.target.value)}
                                    placeholder="1,000,000"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Ownership %</Label>
                                  <Input
                                    type="number"
                                    value={partner.ownershipPct}
                                    onChange={(e) => updateStackPartner(partner.id, 'ownershipPct', e.target.value)}
                                    placeholder="25"
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Pref Return %</Label>
                                  <Input
                                    type="number"
                                    value={partner.preferredReturn}
                                    onChange={(e) => updateStackPartner(partner.id, 'preferredReturn', e.target.value)}
                                    placeholder="8"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                              <Select value={partner.type} onValueChange={(v) => updateStackPartner(partner.id, 'type', v)}>
                                <SelectTrigger className="w-20 h-8">
                                  <SelectValue />
                                </SelectTrigger>
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
                      
                      <div className="mt-4 p-3 bg-white rounded-lg border">
                        <div className="flex justify-between text-sm">
                          <span>Total Commitment:</span>
                          <span className="font-semibold">{formatCurrency(totalPartnerCommitment)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span>Total Ownership:</span>
                          <span className={`font-semibold ${totalOwnership === 100 ? 'text-green-600' : totalOwnership > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                            {totalOwnership.toFixed(1)}%
                            {totalOwnership !== 100 && <span className="text-xs ml-1">({totalOwnership < 100 ? `${(100 - totalOwnership).toFixed(1)}% remaining` : 'exceeds 100%'})</span>}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="promote" className="space-y-4 mt-0">
                    <Card className="p-4 bg-purple-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <PieChart className="h-4 w-4 text-purple-600" />
                          Promote / Waterfall Tiers
                        </h4>
                        <Button type="button" variant="outline" size="sm" onClick={addStackPromoteTier} className="bg-white">
                          <Plus className="h-4 w-4 mr-1" /> Add Tier
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        Define tiered promote structure based on IRR hurdles. GP receive increasing share of profits above each threshold.
                      </p>
                      
                      <div className="space-y-3">
                        {stackPromoteTiers.map((tier, index) => (
                          <Card key={tier.id} className="p-3 bg-white border-purple-200">
                            <div className="flex items-center gap-3">
                              <Badge className="bg-purple-600 text-white">Tier {index + 1}</Badge>
                              <div className="flex-1 grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs">IRR Hurdle (%)</Label>
                                  <div className="relative">
                                    <Percent className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                      type="number"
                                      value={tier.irrHurdle}
                                      onChange={(e) => updateStackPromoteTier(tier.id, 'irrHurdle', e.target.value)}
                                      placeholder="8"
                                      className="h-8 text-sm pl-7"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-green-700">GP Split (%)</Label>
                                  <div className="relative">
                                    <Percent className="absolute left-2 top-2 h-3.5 w-3.5 text-green-600" />
                                    <Input
                                      type="number"
                                      value={tier.gpSplit}
                                      onChange={(e) => updateStackPromoteTier(tier.id, 'gpSplit', e.target.value)}
                                      placeholder="20"
                                      className="h-8 text-sm pl-7 border-green-200"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-xs text-blue-700">LP Split (%)</Label>
                                  <div className="relative">
                                    <Percent className="absolute left-2 top-2 h-3.5 w-3.5 text-blue-600" />
                                    <Input
                                      type="number"
                                      value={tier.lpSplit}
                                      onChange={(e) => updateStackPromoteTier(tier.id, 'lpSplit', e.target.value)}
                                      placeholder="80"
                                      className="h-8 text-sm pl-7 border-blue-200"
                                    />
                                  </div>
                                </div>
                              </div>
                              {stackPromoteTiers.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 w-8 p-0" onClick={() => removeStackPromoteTier(tier.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="mt-2 p-2 bg-purple-50 rounded text-xs text-purple-700">
                              Above {tier.irrHurdle}% IRR: GP receives {tier.gpSplit}%, LP receives {tier.lpSplit}%
                            </div>
                          </Card>
                        ))}
                      </div>
                      
                      <div className="mt-4 p-3 bg-white rounded-lg border">
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
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="exit" className="space-y-4 mt-0">
                    <Card className="p-4 bg-orange-50/50">
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4 text-orange-600" />
                        Exit Assumptions
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="holdPeriodYears">Hold Period (Years)</Label>
                          <Input id="holdPeriodYears" name="holdPeriodYears" type="number" placeholder="5" defaultValue="5" />
                        </div>
                        <div>
                          <Label htmlFor="exitCapRate">Exit Cap Rate</Label>
                          <div className="relative">
                            <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input id="exitCapRate" name="exitCapRate" type="number" step="0.1" placeholder="7" defaultValue="7" className="pl-8" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="noiGrowthRate">NOI Growth Rate</Label>
                          <div className="relative">
                            <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input id="noiGrowthRate" name="noiGrowthRate" type="number" step="0.1" placeholder="2" defaultValue="2" className="pl-8" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </TabsContent>
                </div>
                
                <DialogFooter className="border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowCreateStack(false)}>Cancel</Button>
                  <Button type="submit" disabled={createStackMutation.isPending}>
                    {createStackMutation.isPending ? 'Creating...' : 'Create Stack'}
                  </Button>
                </DialogFooter>
              </form>
            </Tabs>
          </DialogContent>
        </Dialog>
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
                                <TabsList className="grid w-full grid-cols-4 mb-4">
                                  <TabsTrigger value="investor" className="text-xs gap-1">
                                    <Briefcase className="h-3.5 w-3.5" />
                                    Investor
                                  </TabsTrigger>
                                  <TabsTrigger value="contribution" className="text-xs gap-1">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    Contribution
                                  </TabsTrigger>
                                  <TabsTrigger value="returns" className="text-xs gap-1">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    Returns
                                  </TabsTrigger>
                                  <TabsTrigger value="promote" className="text-xs gap-1">
                                    <PieChart className="h-3.5 w-3.5" />
                                    Promote
                                  </TabsTrigger>
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
                                      Capital Contribution Details
                                    </h4>
                                    <div className="grid grid-cols-3 gap-4">
                                      <FormField control={equityForm.control} name="commitmentAmount" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Capital Commitment *</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" placeholder="5,000,000" className="pl-9 bg-white" />
                                            </div>
                                          </FormControl>
                                          <FormDescription>Total committed capital</FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
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
                                      <FormField control={equityForm.control} name="ownershipPct" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Ownership Percentage *</FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                              <Input {...field} type="number" step="0.01" placeholder="90" className="pl-9 bg-white" />
                                            </div>
                                          </FormControl>
                                          <FormDescription>Enter as % (e.g., 90 for 90%)</FormDescription>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                    </div>

                                    {/* Funding Progress */}
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
                              <Input className="w-16 h-8 text-sm" defaultValue="8.0%" />
                              <span className="text-xs text-muted-foreground">IRR</span>
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
                              <Input className="w-14 h-8 text-sm" defaultValue="80%" />
                              <span className="text-muted-foreground">/</span>
                              <Input className="w-14 h-8 text-sm" defaultValue="20%" />
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
                                <TableHead className="w-16"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow>
                                <TableCell>0% - 8%</TableCell>
                                <TableCell>100%</TableCell>
                                <TableCell>0%</TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>8% - 12%</TableCell>
                                <TableCell>80%</TableCell>
                                <TableCell>20%</TableCell>
                                <TableCell><Button variant="ghost" size="sm"><Trash2 className="h-3 w-3" /></Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>12% - 18%</TableCell>
                                <TableCell>70%</TableCell>
                                <TableCell>30%</TableCell>
                                <TableCell><Button variant="ghost" size="sm"><Trash2 className="h-3 w-3" /></Button></TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>18%+</TableCell>
                                <TableCell>60%</TableCell>
                                <TableCell>40%</TableCell>
                                <TableCell><Button variant="ghost" size="sm"><Trash2 className="h-3 w-3" /></Button></TableCell>
                              </TableRow>
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
                            <CardDescription>Waterfall distribution based on exit scenario</CardDescription>
                          </div>
                          <Button variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Calculate Returns
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Summary Cards */}
                        <div className="grid gap-4 md:grid-cols-4 mb-6">
                          <Card className="bg-blue-500/10 border-blue-500/20">
                            <CardContent className="pt-4 text-center">
                              <div className="text-2xl font-bold text-blue-600">$15,500,000</div>
                              <div className="text-xs text-muted-foreground">Total Proceeds</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-green-500/10 border-green-500/20">
                            <CardContent className="pt-4 text-center">
                              <div className="text-2xl font-bold text-green-600">$5,500,000</div>
                              <div className="text-xs text-muted-foreground">Total Profit</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-purple-500/10 border-purple-500/20">
                            <CardContent className="pt-4 text-center">
                              <div className="text-2xl font-bold text-purple-600">18.5%</div>
                              <div className="text-xs text-muted-foreground">Fund IRR</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-orange-500/10 border-orange-500/20">
                            <CardContent className="pt-4 text-center">
                              <div className="text-2xl font-bold text-orange-600">1.55x</div>
                              <div className="text-xs text-muted-foreground">Equity Multiple</div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Waterfall Distribution Table */}
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
                                <TableCell className="font-medium">$10,000,000</TableCell>
                                <TableCell>$9,500,000</TableCell>
                                <TableCell>$500,000</TableCell>
                              </TableRow>
                              <TableRow className="bg-green-500/5">
                                <TableCell><Badge variant="outline">Tier 2</Badge></TableCell>
                                <TableCell>Preferred Return (8% IRR)</TableCell>
                                <TableCell className="font-medium">$3,200,000</TableCell>
                                <TableCell>$3,200,000</TableCell>
                                <TableCell>$0</TableCell>
                              </TableRow>
                              <TableRow className="bg-orange-500/5">
                                <TableCell><Badge variant="outline">Tier 3</Badge></TableCell>
                                <TableCell>GP Catch-Up (100%)</TableCell>
                                <TableCell className="font-medium">$800,000</TableCell>
                                <TableCell>$0</TableCell>
                                <TableCell>$800,000</TableCell>
                              </TableRow>
                              <TableRow className="bg-purple-500/5">
                                <TableCell><Badge variant="outline">Tier 4</Badge></TableCell>
                                <TableCell>Promote Split (80/20)</TableCell>
                                <TableCell className="font-medium">$1,500,000</TableCell>
                                <TableCell>$1,200,000</TableCell>
                                <TableCell>$300,000</TableCell>
                              </TableRow>
                              <TableRow className="font-bold border-t-2">
                                <TableCell></TableCell>
                                <TableCell>Total Distributions</TableCell>
                                <TableCell>$15,500,000</TableCell>
                                <TableCell className="text-blue-600">$13,900,000</TableCell>
                                <TableCell className="text-green-600">$1,600,000</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>

                        <Separator className="my-6" />

                        {/* LP vs GP Returns Comparison */}
                        <div className="grid gap-4 md:grid-cols-2">
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">LP Returns Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Capital Invested</span>
                                <span>$9,500,000</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Distributions</span>
                                <span>$13,900,000</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Net Profit</span>
                                <span className="text-green-600">$4,400,000</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between font-medium">
                                <span>LP IRR</span>
                                <span className="text-green-600">16.8%</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>LP Multiple</span>
                                <span className="text-green-600">1.46x</span>
                              </div>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">GP Returns Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Capital Invested</span>
                                <span>$500,000</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Co-Invest Return</span>
                                <span>$500,000</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Promote (Carry)</span>
                                <span className="text-green-600">$1,100,000</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between font-medium">
                                <span>GP IRR</span>
                                <span className="text-green-600">42.5%</span>
                              </div>
                              <div className="flex justify-between font-medium">
                                <span>GP Multiple</span>
                                <span className="text-green-600">3.20x</span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
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
