import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  GripVertical,
  Copy,
  Settings2,
  TrendingUp,
  Layers,
  DollarSign,
  Percent,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import type { ModelingProject } from "@shared/schema";
import { ExitProForma, type ProFormaCashFlowRow, type ProFormaLineItem } from "@/components/exit-strategies/ExitProForma";

interface WaterfallProps {
  projectId: string;
}

interface PromoteTier {
  id: string;
  name: string;
  hurdleRate: number;
  lpSplit: number;
  gpSplit: number;
  catchUp?: number;
}

interface Investor {
  id: string;
  name: string;
  contribution: number;
  isGP: boolean;
  commitmentDate?: string;
}

interface WaterfallPreset {
  id: string;
  name: string;
  description: string;
  tiers: PromoteTier[];
  preferredReturn: number;
  gpCatchUpPercentage: number;
  isEuropean: boolean;
  clawbackProvision: boolean;
}

const TIER_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-500', text: 'text-green-700 dark:text-green-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-500', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-500', text: 'text-pink-700 dark:text-pink-300' },
];

const PRESET_TEMPLATES: WaterfallPreset[] = [
  {
    id: 'simple-80-20',
    name: 'Simple 80/20 Split',
    description: 'Basic LP/GP split after 8% preferred return',
    tiers: [
      { id: 't1', name: 'Base Split', hurdleRate: 0, lpSplit: 80, gpSplit: 20 }
    ],
    preferredReturn: 8,
    gpCatchUpPercentage: 0,
    isEuropean: false,
    clawbackProvision: false
  },
  {
    id: 'institutional-tiered',
    name: 'Institutional Tiered',
    description: 'Multi-tier structure with GP catch-up and escalating promote',
    tiers: [
      { id: 't1', name: 'Tier 1 (0-12% IRR)', hurdleRate: 12, lpSplit: 80, gpSplit: 20 },
      { id: 't2', name: 'Tier 2 (12-18% IRR)', hurdleRate: 18, lpSplit: 70, gpSplit: 30 },
      { id: 't3', name: 'Tier 3 (18%+ IRR)', hurdleRate: 100, lpSplit: 60, gpSplit: 40 }
    ],
    preferredReturn: 8,
    gpCatchUpPercentage: 20,
    isEuropean: false,
    clawbackProvision: true
  },
  {
    id: 'european-waterfall',
    name: 'European Waterfall',
    description: 'Full return of capital before any profit split (LP-friendly)',
    tiers: [
      { id: 't1', name: 'Profit Split', hurdleRate: 0, lpSplit: 70, gpSplit: 30 }
    ],
    preferredReturn: 8,
    gpCatchUpPercentage: 0,
    isEuropean: true,
    clawbackProvision: true
  },
  {
    id: 'aggressive-promote',
    name: 'Aggressive Promote',
    description: 'Higher GP promote for value-add deals with multiple hurdles',
    tiers: [
      { id: 't1', name: 'Tier 1 (0-15% IRR)', hurdleRate: 15, lpSplit: 70, gpSplit: 30 },
      { id: 't2', name: 'Tier 2 (15-20% IRR)', hurdleRate: 20, lpSplit: 60, gpSplit: 40 },
      { id: 't3', name: 'Tier 3 (20%+ IRR)', hurdleRate: 100, lpSplit: 50, gpSplit: 50 }
    ],
    preferredReturn: 10,
    gpCatchUpPercentage: 50,
    isEuropean: false,
    clawbackProvision: true
  },
  {
    id: 'family-office',
    name: 'Family Office Friendly',
    description: 'Lower promote, no catch-up, simple structure',
    tiers: [
      { id: 't1', name: 'Profit Split', hurdleRate: 0, lpSplit: 85, gpSplit: 15 }
    ],
    preferredReturn: 6,
    gpCatchUpPercentage: 0,
    isEuropean: true,
    clawbackProvision: false
  },
  {
    id: 'marina-standard',
    name: 'Marina Standard',
    description: 'Typical marina acquisition structure with moderate promote',
    tiers: [
      { id: 't1', name: 'Base (0-10% IRR)', hurdleRate: 10, lpSplit: 80, gpSplit: 20 },
      { id: 't2', name: 'Performance (10-15% IRR)', hurdleRate: 15, lpSplit: 75, gpSplit: 25 },
      { id: 't3', name: 'Outperformance (15%+ IRR)', hurdleRate: 100, lpSplit: 65, gpSplit: 35 }
    ],
    preferredReturn: 8,
    gpCatchUpPercentage: 25,
    isEuropean: false,
    clawbackProvision: true
  }
];

function generateId(): string {
  return `tier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function ExitWaterfall({ projectId }: WaterfallProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [inputs, setInputs] = useState({
    totalDistribution: 15000000,
    holdingPeriodYears: 5,
    waterfallType: 'american' as 'american' | 'european',
    preferredReturn: 8,
    preferredCompounding: 'annual' as 'annual' | 'quarterly' | 'continuous',
    gpCatchUpPercentage: 20,
    clawbackProvision: true,
  });

  const [tiers, setTiers] = useState<PromoteTier[]>([
    { id: 't1', name: 'Base Split', hurdleRate: 12, lpSplit: 80, gpSplit: 20 },
    { id: 't2', name: 'Performance Tier', hurdleRate: 18, lpSplit: 70, gpSplit: 30 },
  ]);

  const [investors, setInvestors] = useState<Investor[]>([
    { id: 'i1', name: "Limited Partners", contribution: 8000000, isGP: false },
    { id: 'i2', name: "General Partner", contribution: 2000000, isGP: true },
  ]);

  const [editingTier, setEditingTier] = useState<PromoteTier | null>(null);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('structure');

  const totalContributed = useMemo(() => 
    investors.reduce((sum, i) => sum + i.contribution, 0), 
    [investors]
  );
  
  const lpContribution = useMemo(() => 
    investors.filter(i => !i.isGP).reduce((sum, i) => sum + i.contribution, 0), 
    [investors]
  );
  
  const gpContribution = useMemo(() => 
    investors.filter(i => i.isGP).reduce((sum, i) => sum + i.contribution, 0), 
    [investors]
  );

  const addTier = () => {
    const newTier: PromoteTier = {
      id: generateId(),
      name: `Tier ${tiers.length + 1}`,
      hurdleRate: tiers.length > 0 ? (tiers[tiers.length - 1].hurdleRate || 0) + 5 : 15,
      lpSplit: 70,
      gpSplit: 30,
    };
    setTiers([...tiers, newTier]);
  };

  const removeTier = (id: string) => {
    setTiers(tiers.filter(t => t.id !== id));
  };

  const updateTier = (id: string, updates: Partial<PromoteTier>) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const moveTier = (id: string, direction: 'up' | 'down') => {
    const idx = tiers.findIndex(t => t.id === id);
    if (idx === -1) return;
    
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= tiers.length) return;
    
    const newTiers = [...tiers];
    [newTiers[idx], newTiers[newIdx]] = [newTiers[newIdx], newTiers[idx]];
    setTiers(newTiers);
  };

  const duplicateTier = (tier: PromoteTier) => {
    const newTier: PromoteTier = {
      ...tier,
      id: generateId(),
      name: `${tier.name} (Copy)`,
    };
    setTiers([...tiers, newTier]);
  };

  const applyPreset = (preset: WaterfallPreset) => {
    setTiers(preset.tiers.map(t => ({ ...t, id: generateId() })));
    setInputs(prev => ({
      ...prev,
      preferredReturn: preset.preferredReturn,
      gpCatchUpPercentage: preset.gpCatchUpPercentage,
      waterfallType: preset.isEuropean ? 'european' : 'american',
      clawbackProvision: preset.clawbackProvision,
    }));
  };

  const addInvestor = () => {
    const newInvestor: Investor = {
      id: `inv-${Date.now()}`,
      name: `Investor ${investors.length + 1}`,
      contribution: 1000000,
      isGP: false,
    };
    setInvestors([...investors, newInvestor]);
  };

  const removeInvestor = (id: string) => {
    setInvestors(investors.filter(i => i.id !== id));
  };

  const updateInvestor = (id: string, updates: Partial<Investor>) => {
    setInvestors(investors.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const computeWaterfallDistribution = (
    distribution: number,
    tierConfig: PromoteTier[],
    prefReturn: number,
    catchUpPct: number,
    holdingYears: number,
    totalCap: number,
    lpCap: number,
    gpCap: number
  ) => {
    let remaining = distribution;
    const sortedTiers = [...tierConfig].sort((a, b) => (a.hurdleRate || 0) - (b.hurdleRate || 0));
    
    const roc = Math.min(remaining, totalCap);
    remaining -= roc;

    const prefReturnAmount = totalCap * (prefReturn / 100) * holdingYears;
    const pref = Math.min(remaining, prefReturnAmount);
    remaining -= pref;

    let catchUp = 0;
    if (catchUpPct > 0 && remaining > 0) {
      const gpPromoteRate = sortedTiers.length > 0 ? sortedTiers[0].gpSplit / 100 : 0.2;
      const targetCatchUp = (pref * gpPromoteRate) / (1 - gpPromoteRate);
      const catchUpAmount = targetCatchUp * (catchUpPct / 100);
      catchUp = Math.min(remaining, catchUpAmount);
      remaining -= catchUp;
    }

    let lpPromote = 0;
    let gpPromote = 0;
    const tierBreakdown: { tier: PromoteTier; lpAmount: number; gpAmount: number }[] = [];

    if (remaining > 0 && sortedTiers.length > 0) {
      const achievedIRR = ((distribution / totalCap) - 1) * 100 / holdingYears;
      
      for (let i = 0; i < sortedTiers.length; i++) {
        if (remaining <= 0) break;
        
        const tier = sortedTiers[i];
        let tierAllocation = 0;
        
        if (i === sortedTiers.length - 1) {
          tierAllocation = remaining;
        } else {
          const nextTierHurdle = sortedTiers[i + 1].hurdleRate;
          if (achievedIRR <= tier.hurdleRate) {
            tierAllocation = remaining;
          } else if (achievedIRR > tier.hurdleRate && achievedIRR <= nextTierHurdle) {
            tierAllocation = remaining;
          } else {
            const hurdleSpread = nextTierHurdle - tier.hurdleRate;
            const irrSpread = achievedIRR - tier.hurdleRate;
            tierAllocation = remaining * Math.min(1, hurdleSpread / irrSpread);
          }
        }
        
        const lpAmt = tierAllocation * (tier.lpSplit / 100);
        const gpAmt = tierAllocation * (tier.gpSplit / 100);
        
        tierBreakdown.push({ tier, lpAmount: lpAmt, gpAmount: gpAmt });
        lpPromote += lpAmt;
        gpPromote += gpAmt;
        
        remaining -= tierAllocation;
      }
    }

    const lpShare = lpCap / totalCap;
    const gpShare = gpCap / totalCap;
    
    const lpTotal = (roc * lpShare) + (pref * lpShare) + lpPromote;
    const gpTotal = (roc * gpShare) + (pref * gpShare) + catchUp + gpPromote;
    
    return { roc, pref, catchUp, lpPromote, gpPromote, lpTotal, gpTotal, tierBreakdown };
  };

  const calculateWaterfall = useMemo(() => {
    let remaining = inputs.totalDistribution;
    const sortedTiers = [...tiers].sort((a, b) => (a.hurdleRate || 0) - (b.hurdleRate || 0));
    
    const result = {
      returnOfCapital: 0,
      preferredReturn: 0,
      gpCatchUp: 0,
      tierDistributions: [] as { tier: PromoteTier; lpAmount: number; gpAmount: number }[],
      lpTotal: 0,
      gpTotal: 0,
    };

    result.returnOfCapital = Math.min(remaining, totalContributed);
    remaining -= result.returnOfCapital;

    const prefReturnAmount = totalContributed * (inputs.preferredReturn / 100) * inputs.holdingPeriodYears;
    result.preferredReturn = Math.min(remaining, prefReturnAmount);
    remaining -= result.preferredReturn;

    if (inputs.gpCatchUpPercentage > 0 && remaining > 0) {
      const gpPromoteRate = sortedTiers.length > 0 ? sortedTiers[0].gpSplit / 100 : 0.2;
      const targetCatchUp = (result.preferredReturn * gpPromoteRate) / (1 - gpPromoteRate);
      const catchUpAmount = targetCatchUp * (inputs.gpCatchUpPercentage / 100);
      result.gpCatchUp = Math.min(remaining, catchUpAmount);
      remaining -= result.gpCatchUp;
    }

    if (remaining > 0 && sortedTiers.length > 0) {
      const achievedIRR = ((inputs.totalDistribution / totalContributed) - 1) * 100 / inputs.holdingPeriodYears;
      
      for (let i = 0; i < sortedTiers.length; i++) {
        if (remaining <= 0) break;
        
        const tier = sortedTiers[i];
        const nextTierHurdle = i < sortedTiers.length - 1 ? sortedTiers[i + 1].hurdleRate : Infinity;
        
        let tierAllocation = 0;
        if (achievedIRR <= tier.hurdleRate) {
          tierAllocation = remaining;
        } else if (achievedIRR > tier.hurdleRate && achievedIRR <= nextTierHurdle) {
          const hurdleSpread = nextTierHurdle - tier.hurdleRate;
          const irrAboveHurdle = achievedIRR - tier.hurdleRate;
          if (nextTierHurdle === Infinity) {
            tierAllocation = remaining;
          } else {
            const tierPortion = Math.min(1, irrAboveHurdle / hurdleSpread);
            tierAllocation = remaining * tierPortion;
          }
        } else if (achievedIRR > nextTierHurdle) {
          const hurdleSpread = nextTierHurdle - tier.hurdleRate;
          tierAllocation = remaining * (hurdleSpread / (achievedIRR - tier.hurdleRate));
        }
        
        if (i === sortedTiers.length - 1) {
          tierAllocation = remaining;
        }
        
        const lpAmount = tierAllocation * (tier.lpSplit / 100);
        const gpAmount = tierAllocation * (tier.gpSplit / 100);
        
        result.tierDistributions.push({
          tier,
          lpAmount,
          gpAmount,
        });
        
        remaining -= tierAllocation;
      }
    }

    const lpShare = lpContribution / totalContributed;
    const gpShare = gpContribution / totalContributed;

    result.lpTotal = (result.returnOfCapital * lpShare) + 
                     (result.preferredReturn * lpShare) + 
                     result.tierDistributions.reduce((sum, td) => sum + td.lpAmount, 0);
    result.gpTotal = (result.returnOfCapital * gpShare) + 
                     (result.preferredReturn * gpShare) + 
                     result.gpCatchUp + 
                     result.tierDistributions.reduce((sum, td) => sum + td.gpAmount, 0);

    return result;
  }, [inputs, tiers, investors, totalContributed, lpContribution, gpContribution]);

  const lpMOIC = lpContribution > 0 ? calculateWaterfall.lpTotal / lpContribution : 0;
  const gpMOIC = gpContribution > 0 ? calculateWaterfall.gpTotal / gpContribution : 0;

  const proFormaConfig = useMemo(() => {
    const holdPeriodYears = inputs.holdingPeriodYears || 5;
    const totalMonths = holdPeriodYears * 12;
    const rows: ProFormaCashFlowRow[] = [];

    const annualCashOnCash = totalContributed * (inputs.preferredReturn / 100);
    const monthlyDistribution = annualCashOnCash / 12;

    const firstTier = tiers[0];
    const lpPct = firstTier ? firstTier.lpSplit / 100 : 0.8;
    const gpPct = 1 - lpPct;

    for (let m = 1; m <= totalMonths; m++) {
      const year = Math.ceil(m / 12);
      const month = ((m - 1) % 12) + 1;
      const isExitMonth = m === totalMonths;

      const values: Record<string, number> = {
        "LP Distribution": monthlyDistribution * lpPct,
        "GP Promote": monthlyDistribution * gpPct,
        "Total Distribution": monthlyDistribution,
      };

      if (isExitMonth) {
        const exitProceeds = inputs.totalDistribution;
        const gain = Math.max(0, exitProceeds - totalContributed);
        values["Exit - LP Share"] = gain * lpPct;
        values["Exit - GP Share"] = gain * gpPct;
        values["Return of Capital"] = totalContributed;
        values["Total Distribution"] += exitProceeds;
      }

      rows.push({ period: m, year, month, values, isExitMonth });
    }

    const lineItems: ProFormaLineItem[] = [
      { label: "LP Distribution" },
      { label: "GP Promote" },
      { label: "Exit - LP Share" },
      { label: "Exit - GP Share" },
      { label: "Return of Capital" },
      { label: "Total Distribution", isSubtotal: true, isBold: true },
    ];

    const totalCF = rows.reduce((s, r) => s + (r.values["Total Distribution"] || 0), 0);

    return {
      strategyName: "Waterfall Distribution",
      holdPeriodYears,
      lineItems,
      rows,
      summaryMetrics: [
        { label: "Total Distributions", value: `$${Math.round(totalCF).toLocaleString()}` },
        { label: "Total Capital", value: `$${Math.round(totalContributed).toLocaleString()}` },
        { label: "LP Split", value: `${(lpPct * 100).toFixed(0)}%` },
        { label: "GP Promote", value: `${(gpPct * 100).toFixed(0)}%` },
      ],
    };
  }, [investors, tiers, inputs.holdingPeriodYears, inputs.preferredReturn, inputs.totalDistribution, totalContributed]);

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
                Exit Strategy Suite
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">Waterfall Analysis</span>
            </div>
            <h1 className="text-3xl font-bold" data-testid="waterfall-title">Waterfall Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Multi-tier fund distribution modeling with GP/LP splits
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLocation(basePath)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Strategies
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="btn-presets">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Presets
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {PRESET_TEMPLATES.map((preset) => (
                  <DropdownMenuItem 
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className="flex flex-col items-start py-3"
                  >
                    <span className="font-medium">{preset.name}</span>
                    <span className="text-xs text-muted-foreground">{preset.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" data-testid="btn-export-waterfall">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Total Distribution</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(inputs.totalDistribution)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">LP MOIC</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{lpMOIC.toFixed(2)}x</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">GP MOIC</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{gpMOIC.toFixed(2)}x</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Layers className="h-4 w-4" />
                <span className="text-sm">Promote Tiers</span>
              </div>
              <p className="text-2xl font-bold">{tiers.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="structure" data-testid="tab-structure" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Structure
            </TabsTrigger>
            <TabsTrigger value="partners" data-testid="tab-partners" className="gap-1.5 text-xs">
              <DollarSign className="h-3.5 w-3.5" />
              Partners
            </TabsTrigger>
            <TabsTrigger value="returns" data-testid="tab-returns" className="gap-1.5 text-xs">
              <TrendingUp className="h-3.5 w-3.5" />
              Returns
            </TabsTrigger>
            <TabsTrigger value="distribution" data-testid="tab-distribution" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Distribution
            </TabsTrigger>
            <TabsTrigger value="sensitivity" data-testid="tab-sensitivity" className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Sensitivity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="structure" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Waterfall Parameters
                  </CardTitle>
                  <CardDescription>Configure base distribution parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="totalDistribution">Total Distribution ($)</Label>
                      <Input
                        id="totalDistribution"
                        type="number"
                        value={inputs.totalDistribution}
                        onChange={(e) => setInputs({ ...inputs, totalDistribution: Number(e.target.value) })}
                        data-testid="input-total-distribution"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="holdingPeriod">Holding Period (Years)</Label>
                      <Input
                        id="holdingPeriod"
                        type="number"
                        value={inputs.holdingPeriodYears}
                        onChange={(e) => setInputs({ ...inputs, holdingPeriodYears: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="waterfallType">Waterfall Type</Label>
                      <Select 
                        value={inputs.waterfallType}
                        onValueChange={(value: 'american' | 'european') => setInputs({ ...inputs, waterfallType: value })}
                      >
                        <SelectTrigger data-testid="select-waterfall-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="american">American (Deal-by-Deal)</SelectItem>
                          <SelectItem value="european">European (Whole Fund)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferredCompounding">Preferred Compounding</Label>
                      <Select 
                        value={inputs.preferredCompounding}
                        onValueChange={(value: 'annual' | 'quarterly' | 'continuous') => 
                          setInputs({ ...inputs, preferredCompounding: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="continuous">Continuous</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="preferredReturn">Preferred Return (%)</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Annual rate of return LPs receive before GP earns any promote</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[inputs.preferredReturn]}
                          onValueChange={([value]) => setInputs({ ...inputs, preferredReturn: value })}
                          min={0}
                          max={20}
                          step={0.5}
                          className="flex-1"
                        />
                        <span className="w-12 text-right font-medium">{inputs.preferredReturn}%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="catchUp">GP Catch-up (%)</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Percentage of profits GP receives to "catch up" after preferred return</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[inputs.gpCatchUpPercentage]}
                          onValueChange={([value]) => setInputs({ ...inputs, gpCatchUpPercentage: value })}
                          min={0}
                          max={100}
                          step={5}
                          className="flex-1"
                        />
                        <span className="w-12 text-right font-medium">{inputs.gpCatchUpPercentage}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="clawback">GP Clawback Provision</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Requires GP to return excess promote if fund underperforms overall</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Switch
                      id="clawback"
                      checked={inputs.clawbackProvision}
                      onCheckedChange={(checked) => setInputs({ ...inputs, clawbackProvision: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Promote Tranches
                    </CardTitle>
                    <CardDescription>Configure tiered profit splits above hurdle rates</CardDescription>
                  </div>
                  <Button onClick={addTier} size="sm" data-testid="btn-add-tier">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tier
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[350px] pr-4">
                    <div className="space-y-3">
                      {tiers.map((tier, idx) => {
                        const colors = TIER_COLORS[idx % TIER_COLORS.length];
                        const isExpanded = expandedTier === tier.id;
                        
                        return (
                          <div 
                            key={tier.id}
                            className={`border rounded-lg p-4 ${colors.bg} ${colors.border} border-l-4`}
                            data-testid={`tier-${tier.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`font-semibold ${colors.text}`}>{tier.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {tier.hurdleRate}% IRR Hurdle
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground mt-0.5">
                                    LP {tier.lpSplit}% / GP {tier.gpSplit}%
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveTier(tier.id, 'up')}
                                  disabled={idx === 0}
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveTier(tier.id, 'down')}
                                  disabled={idx === tiers.length - 1}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedTier(isExpanded ? null : tier.id)}
                                >
                                  <Settings2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => duplicateTier(tier)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeTier(tier.id)}
                                  className="text-red-500 hover:text-red-600"
                                  disabled={tiers.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Tier Name</Label>
                                    <Input
                                      value={tier.name}
                                      onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Hurdle Rate (%)</Label>
                                    <Input
                                      type="number"
                                      value={tier.hurdleRate}
                                      onChange={(e) => updateTier(tier.id, { hurdleRate: Number(e.target.value) })}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>LP/GP Split</Label>
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                      <Slider
                                        value={[tier.lpSplit]}
                                        onValueChange={([value]) => updateTier(tier.id, { lpSplit: value, gpSplit: 100 - value })}
                                        min={0}
                                        max={100}
                                        step={5}
                                      />
                                    </div>
                                    <div className="flex items-center gap-2 w-32">
                                      <Badge variant="secondary">LP {tier.lpSplit}%</Badge>
                                      <Badge variant="default">GP {tier.gpSplit}%</Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Waterfall Visualization</CardTitle>
                <CardDescription>Visual representation of profit distribution tiers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-64 relative">
                  <div className="flex-1 flex flex-col justify-end">
                    <div 
                      className="bg-blue-500 rounded-t flex items-center justify-center text-white text-xs font-medium"
                      style={{ height: `${(calculateWaterfall.returnOfCapital / inputs.totalDistribution) * 100}%`, minHeight: calculateWaterfall.returnOfCapital > 0 ? '30px' : '0' }}
                    >
                      {calculateWaterfall.returnOfCapital > 0 && 'Return of Capital'}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-end">
                    <div 
                      className="bg-green-500 rounded-t flex items-center justify-center text-white text-xs font-medium"
                      style={{ height: `${(calculateWaterfall.preferredReturn / inputs.totalDistribution) * 100}%`, minHeight: calculateWaterfall.preferredReturn > 0 ? '30px' : '0' }}
                    >
                      {calculateWaterfall.preferredReturn > 0 && 'Preferred'}
                    </div>
                  </div>
                  {inputs.gpCatchUpPercentage > 0 && (
                    <div className="flex-1 flex flex-col justify-end">
                      <div 
                        className="bg-purple-500 rounded-t flex items-center justify-center text-white text-xs font-medium"
                        style={{ height: `${(calculateWaterfall.gpCatchUp / inputs.totalDistribution) * 100}%`, minHeight: calculateWaterfall.gpCatchUp > 0 ? '30px' : '0' }}
                      >
                        {calculateWaterfall.gpCatchUp > 0 && 'Catch-up'}
                      </div>
                    </div>
                  )}
                  {calculateWaterfall.tierDistributions.map((td, idx) => (
                    <div key={td.tier.id} className="flex-1 flex flex-col justify-end">
                      <div 
                        className={`${TIER_COLORS[idx % TIER_COLORS.length].bg.replace('/30', '')} rounded-t flex flex-col items-center justify-center text-xs font-medium p-1`}
                        style={{ 
                          height: `${((td.lpAmount + td.gpAmount) / inputs.totalDistribution) * 100}%`, 
                          minHeight: (td.lpAmount + td.gpAmount) > 0 ? '50px' : '0',
                          backgroundColor: ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899'][idx % 5]
                        }}
                      >
                        <span className="text-white">{td.tier.name}</span>
                        <span className="text-white/80 text-[10px]">
                          LP {td.tier.lpSplit}% / GP {td.tier.gpSplit}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 text-sm text-muted-foreground border-t pt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span>Return of Capital</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span>Preferred Return</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500 rounded"></div>
                      <span>GP Catch-up</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="investors" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Capital Contributors</CardTitle>
                  <CardDescription>LP and GP capital contributions</CardDescription>
                </div>
                <Button onClick={addInvestor} size="sm" data-testid="btn-add-investor">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Investor
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {investors.map((investor) => (
                    <div 
                      key={investor.id} 
                      className="flex items-center gap-3 p-3 border rounded-lg"
                      data-testid={`investor-${investor.id}`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <Input
                        value={investor.name}
                        onChange={(e) => updateInvestor(investor.id, { name: e.target.value })}
                        className="flex-1"
                        placeholder="Investor Name"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">$</span>
                        <Input
                          type="number"
                          value={investor.contribution}
                          onChange={(e) => updateInvestor(investor.id, { contribution: Number(e.target.value) })}
                          className="w-36"
                        />
                      </div>
                      <Select
                        value={investor.isGP ? 'gp' : 'lp'}
                        onValueChange={(value) => updateInvestor(investor.id, { isGP: value === 'gp' })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lp">LP</SelectItem>
                          <SelectItem value="gp">GP</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeInvestor(investor.id)}
                        className="text-red-500"
                        disabled={investors.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <Separator className="my-4" />
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Contributed</p>
                    <p className="text-xl font-bold">{formatCurrency(totalContributed)}</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">LP Capital</p>
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(lpContribution)}</p>
                    <p className="text-xs text-muted-foreground">{((lpContribution / totalContributed) * 100).toFixed(1)}% of total</p>
                  </div>
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">GP Capital</p>
                    <p className="text-xl font-bold text-purple-600">{formatCurrency(gpContribution)}</p>
                    <p className="text-xs text-muted-foreground">{((gpContribution / totalContributed) * 100).toFixed(1)}% of total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PARTNERS TAB - GP/LP Management with Commitments */}
          <TabsContent value="partners" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Partners & Commitments</h3>
              <Button size="sm" onClick={addInvestor}>
                <Plus className="h-4 w-4 mr-2" />
                Add Partner
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-2 border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge className="bg-primary">GP</Badge>
                    General Partner
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Co-Investment</span>
                    <span className="font-medium">{formatCurrency(gpContribution)} ({((gpContribution / totalContributed) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Promote (at Pref)</span>
                    <span className="font-medium">{tiers[0]?.gpSplit || 20}% of profits</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Catch-Up</span>
                    <span className="font-medium">{inputs.gpCatchUpPercentage}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm font-medium">
                    <span>Projected Returns</span>
                    <span className="text-green-600">{formatCurrency(calculateWaterfall.gpTotal)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="secondary">LP</Badge>
                    Limited Partners ({investors.filter(i => !i.isGP).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total LP Capital</span>
                    <span className="font-medium">{formatCurrency(lpContribution)} ({((lpContribution / totalContributed) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Preferred Return</span>
                    <span className="font-medium">{inputs.preferredReturn}% IRR</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Profit Split</span>
                    <span className="font-medium">{tiers[0]?.lpSplit || 80}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm font-medium">
                    <span>Projected Returns</span>
                    <span className="text-green-600">{formatCurrency(calculateWaterfall.lpTotal)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Investor Detail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Investor</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Commitment</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Ownership %</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Pref Return</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Proj. MOIC</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investors.map((investor) => {
                        const ownership = (investor.contribution / totalContributed) * 100;
                        const projMoic = investor.isGP ? gpMOIC : lpMOIC;
                        return (
                          <tr key={investor.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">{investor.name}</td>
                            <td className="text-center py-3 px-4">
                              <Badge className={investor.isGP ? "bg-primary text-xs" : ""} variant={investor.isGP ? "default" : "secondary"}>
                                {investor.isGP ? 'GP' : 'LP'}
                              </Badge>
                            </td>
                            <td className="text-right py-3 px-4">{formatCurrency(investor.contribution)}</td>
                            <td className="text-right py-3 px-4">{ownership.toFixed(1)}%</td>
                            <td className="text-right py-3 px-4">{investor.isGP ? '—' : `${inputs.preferredReturn}%`}</td>
                            <td className="text-right py-3 px-4">
                              <span className="text-green-600 font-medium">{projMoic.toFixed(2)}x</span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <Button variant="ghost" size="sm" onClick={() => removeInvestor(investor.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RETURNS TAB - Investor Returns Analysis */}
          <TabsContent value="returns" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Investor Returns Analysis
                    </CardTitle>
                    <CardDescription>Waterfall distribution based on exit scenario</CardDescription>
                  </div>
                  <Badge variant="outline">
                    {inputs.waterfallType === 'european' ? 'European' : 'American'} Waterfall
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  <Card className="bg-blue-500/10 border-blue-500/20">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{formatCurrency(inputs.totalDistribution)}</div>
                      <div className="text-xs text-muted-foreground">Total Proceeds</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-500/10 border-green-500/20">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{formatCurrency(inputs.totalDistribution - totalContributed)}</div>
                      <div className="text-xs text-muted-foreground">Total Profit</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-purple-500/10 border-purple-500/20">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">{(((inputs.totalDistribution / totalContributed) - 1) * 100 / inputs.holdingPeriodYears).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Fund IRR</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-orange-500/10 border-orange-500/20">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{(inputs.totalDistribution / totalContributed).toFixed(2)}x</div>
                      <div className="text-xs text-muted-foreground">Equity Multiple</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Waterfall Distribution</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tier</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">LP Share</th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">GP Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-blue-500/5">
                          <td className="py-3 px-4"><Badge variant="outline">Tier 1</Badge></td>
                          <td className="py-3 px-4">Return of Capital</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(calculateWaterfall.returnOfCapital)}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(calculateWaterfall.returnOfCapital * (lpContribution / totalContributed))}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(calculateWaterfall.returnOfCapital * (gpContribution / totalContributed))}</td>
                        </tr>
                        <tr className="bg-green-500/5">
                          <td className="py-3 px-4"><Badge variant="outline">Tier 2</Badge></td>
                          <td className="py-3 px-4">Preferred Return ({inputs.preferredReturn}% IRR)</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(calculateWaterfall.preferredReturn)}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(calculateWaterfall.preferredReturn * (lpContribution / totalContributed))}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(calculateWaterfall.preferredReturn * (gpContribution / totalContributed))}</td>
                        </tr>
                        <tr className="bg-orange-500/5">
                          <td className="py-3 px-4"><Badge variant="outline">Tier 3</Badge></td>
                          <td className="py-3 px-4">GP Catch-Up ({inputs.gpCatchUpPercentage}%)</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrency(calculateWaterfall.gpCatchUp)}</td>
                          <td className="py-3 px-4 text-right">$0</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(calculateWaterfall.gpCatchUp)}</td>
                        </tr>
                        {calculateWaterfall.tierDistributions.map((tierDist, idx) => (
                          <tr key={idx} className="bg-purple-500/5">
                            <td className="py-3 px-4"><Badge variant="outline">Tier {4 + idx}</Badge></td>
                            <td className="py-3 px-4">{tierDist.tier.name} ({tierDist.tier.lpSplit}/{tierDist.tier.gpSplit})</td>
                            <td className="py-3 px-4 text-right font-medium">{formatCurrency(tierDist.lpAmount + tierDist.gpAmount)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(tierDist.lpAmount)}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(tierDist.gpAmount)}</td>
                          </tr>
                        ))}
                        <tr className="font-bold border-t-2">
                          <td className="py-3 px-4"></td>
                          <td className="py-3 px-4">Total Distributions</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(calculateWaterfall.lpTotal + calculateWaterfall.gpTotal)}</td>
                          <td className="py-3 px-4 text-right text-blue-600">{formatCurrency(calculateWaterfall.lpTotal)}</td>
                          <td className="py-3 px-4 text-right text-green-600">{formatCurrency(calculateWaterfall.gpTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">LP Returns Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capital Invested</span>
                        <span>{formatCurrency(lpContribution)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Distributions</span>
                        <span>{formatCurrency(calculateWaterfall.lpTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Net Profit</span>
                        <span className="text-green-600">{formatCurrency(calculateWaterfall.lpTotal - lpContribution)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>LP IRR</span>
                        <span className="text-green-600">{((lpMOIC - 1) * 100 / inputs.holdingPeriodYears).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>LP Multiple</span>
                        <span className="text-green-600">{lpMOIC.toFixed(2)}x</span>
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
                        <span>{formatCurrency(gpContribution)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Co-Invest Return</span>
                        <span>{formatCurrency(calculateWaterfall.returnOfCapital * (gpContribution / totalContributed))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Promote (Carry)</span>
                        <span className="text-green-600">{formatCurrency(calculateWaterfall.gpCatchUp + calculateWaterfall.tierDistributions.reduce((sum, t) => sum + t.gpAmount, 0))}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>GP IRR</span>
                        <span className="text-green-600">{((gpMOIC - 1) * 100 / inputs.holdingPeriodYears).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>GP Multiple</span>
                        <span className="text-green-600">{gpMOIC.toFixed(2)}x</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Waterfall Distribution Summary</CardTitle>
                <CardDescription>Step-by-step distribution breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">1. Return of Capital</p>
                      <p className="text-xl font-bold">{formatCurrency(calculateWaterfall.returnOfCapital)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">2. Preferred Return ({inputs.preferredReturn}%)</p>
                      <p className="text-xl font-bold">{formatCurrency(calculateWaterfall.preferredReturn)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">3. GP Catch-up</p>
                      <p className="text-xl font-bold text-purple-600">{formatCurrency(calculateWaterfall.gpCatchUp)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">4. Promote Split</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(calculateWaterfall.tierDistributions.reduce((sum, td) => sum + td.lpAmount + td.gpAmount, 0))}
                      </p>
                    </div>
                  </div>

                  {calculateWaterfall.tierDistributions.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-semibold mb-3">Promote Tier Breakdown</h4>
                        <div className="space-y-2">
                          {calculateWaterfall.tierDistributions.map((td, idx) => (
                            <div key={td.tier.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-3 h-3 rounded"
                                  style={{ backgroundColor: ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899'][idx % 5] }}
                                ></div>
                                <div>
                                  <span className="font-medium">{td.tier.name}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {td.tier.hurdleRate}% IRR Hurdle
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">LP ({td.tier.lpSplit}%)</p>
                                  <p className="font-medium text-blue-600">{formatCurrency(td.lpAmount)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">GP ({td.tier.gpSplit}%)</p>
                                  <p className="font-medium text-purple-600">{formatCurrency(td.gpAmount)}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Badge className="bg-blue-500">LP</Badge>
                        Limited Partner Returns
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Capital Returned</span>
                          <span>{formatCurrency(calculateWaterfall.returnOfCapital * (lpContribution / totalContributed))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Preferred Return</span>
                          <span>{formatCurrency(calculateWaterfall.preferredReturn * (lpContribution / totalContributed))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Profit Share</span>
                          <span>{formatCurrency(calculateWaterfall.tierDistributions.reduce((sum, td) => sum + td.lpAmount, 0))}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Total LP Distribution</span>
                          <span className="text-green-600" data-testid="text-lp-total">{formatCurrency(calculateWaterfall.lpTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">LP MOIC</span>
                          <span className="font-medium">{lpMOIC.toFixed(2)}x</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/20">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Badge className="bg-purple-500">GP</Badge>
                        General Partner Returns
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Capital Returned</span>
                          <span>{formatCurrency(calculateWaterfall.returnOfCapital * (gpContribution / totalContributed))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Preferred Return</span>
                          <span>{formatCurrency(calculateWaterfall.preferredReturn * (gpContribution / totalContributed))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Catch-up</span>
                          <span>{formatCurrency(calculateWaterfall.gpCatchUp)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Carried Interest</span>
                          <span>{formatCurrency(calculateWaterfall.tierDistributions.reduce((sum, td) => sum + td.gpAmount, 0))}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Total GP Distribution</span>
                          <span className="text-purple-600" data-testid="text-gp-total">{formatCurrency(calculateWaterfall.gpTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GP MOIC</span>
                          <span className="font-medium">{gpMOIC.toFixed(2)}x</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sensitivity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Sensitivity Analysis
                </CardTitle>
                <CardDescription>
                  Compare how different exit scenarios affect LP and GP returns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Exit Multiple</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Proceeds</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">LP Distribution</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">LP MOIC</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">GP Distribution</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">GP MOIC</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Effective GP %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0.8, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0].map((multiple) => {
                        const scenarioDistribution = totalContributed * multiple;
                        const result = computeWaterfallDistribution(
                          scenarioDistribution,
                          tiers,
                          inputs.preferredReturn,
                          inputs.gpCatchUpPercentage,
                          inputs.holdingPeriodYears,
                          totalContributed,
                          lpContribution,
                          gpContribution
                        );
                        
                        const lpMoic = lpContribution > 0 ? result.lpTotal / lpContribution : 0;
                        const gpMoic = gpContribution > 0 ? result.gpTotal / gpContribution : 0;
                        const gpPercent = scenarioDistribution > 0 ? (result.gpTotal / scenarioDistribution) * 100 : 0;
                        
                        const isCurrentScenario = Math.abs(multiple - (inputs.totalDistribution / totalContributed)) < 0.05;
                        
                        return (
                          <tr 
                            key={multiple} 
                            className={`border-b hover:bg-muted/50 ${isCurrentScenario ? 'bg-primary/10 font-medium' : ''}`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {multiple.toFixed(2)}x
                                {isCurrentScenario && (
                                  <Badge variant="outline" className="text-xs">Current</Badge>
                                )}
                              </div>
                            </td>
                            <td className="text-right py-3 px-4">{formatCurrency(scenarioDistribution)}</td>
                            <td className="text-right py-3 px-4 text-blue-600">{formatCurrency(result.lpTotal)}</td>
                            <td className="text-right py-3 px-4">
                              <span className={lpMoic >= 1 ? 'text-green-600' : 'text-red-600'}>
                                {lpMoic.toFixed(2)}x
                              </span>
                            </td>
                            <td className="text-right py-3 px-4 text-purple-600">{formatCurrency(result.gpTotal)}</td>
                            <td className="text-right py-3 px-4">
                              <span className={gpMoic >= 1 ? 'text-green-600' : 'text-red-600'}>
                                {gpMoic.toFixed(2)}x
                              </span>
                            </td>
                            <td className="text-right py-3 px-4">{gpPercent.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preset Structure Comparison</CardTitle>
                <CardDescription>
                  Compare current structure against standard templates at your exit value
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Structure</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Pref Return</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Tiers</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">LP MOIC</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">GP MOIC</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PRESET_TEMPLATES.map((preset) => {
                        const result = computeWaterfallDistribution(
                          inputs.totalDistribution,
                          preset.tiers,
                          preset.preferredReturn,
                          preset.gpCatchUpPercentage,
                          inputs.holdingPeriodYears,
                          totalContributed,
                          lpContribution,
                          gpContribution
                        );
                        
                        const presetLpMoic = lpContribution > 0 ? result.lpTotal / lpContribution : 0;
                        const presetGpMoic = gpContribution > 0 ? result.gpTotal / gpContribution : 0;
                        
                        return (
                          <tr key={preset.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">
                              <div>
                                <div className="font-medium">{preset.name}</div>
                                <div className="text-xs text-muted-foreground">{preset.description}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={preset.isEuropean ? 'secondary' : 'outline'}>
                                {preset.isEuropean ? 'European' : 'American'}
                              </Badge>
                            </td>
                            <td className="text-right py-3 px-4">{preset.preferredReturn}%</td>
                            <td className="text-right py-3 px-4">{preset.tiers.length}</td>
                            <td className="text-right py-3 px-4">
                              <span className={presetLpMoic >= lpMOIC ? 'text-green-600' : 'text-orange-600'}>
                                {presetLpMoic.toFixed(2)}x
                              </span>
                            </td>
                            <td className="text-right py-3 px-4">
                              <span className={presetGpMoic >= gpMOIC ? 'text-green-600' : 'text-orange-600'}>
                                {presetGpMoic.toFixed(2)}x
                              </span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => applyPreset(preset)}
                              >
                                Apply
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ExitProForma config={proFormaConfig} />
      </div>
    </TooltipProvider>
  );
}
