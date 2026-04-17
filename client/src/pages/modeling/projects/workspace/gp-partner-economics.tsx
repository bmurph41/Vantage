import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { DollarSign, Users, TrendingUp, PieChart, Save, Plus, Minus } from 'lucide-react';

interface GpPartnerEconomicsProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface ProjectData {
  id: number;
  purchasePrice?: string | number;
  ebitda?: string | number;
  customMetrics?: Record<string, any>;
  [key: string]: any;
}

interface ProFormaData {
  year1NOI?: number;
  years?: {
    year: number;
    revenue: number;
    expenses: number;
    noi: number;
    cashflow: number;
  }[];
  [key: string]: any;
}

interface WaterfallResult {
  tiers?: {
    name: string;
    gpSplit?: number;
    lpSplit?: number;
    prefRate?: number;
    carryPercent?: number;
  }[];
  carryPercent?: number;
  preferredRate?: number;
  gpSplit?: number;
  [key: string]: any;
}

interface PartnerConfig {
  partnerCount: number;
  splitMode: 'equal' | 'custom';
  partners: { name: string; ownershipPct: number }[];
}

interface PartnerRow {
  name: string;
  sharePct: number;
  coInvest: number;
  draws: number;
  roc: number;
  promote: number;
  grossTotal: number;
  netReturn: number;
}

interface MonthlyDrawData {
  month: string;
  draw: number;
}

interface SourcesUsesBar {
  name: string;
  value: number;
  color: string;
}

interface CumulativeCashData {
  month: string;
  cashPosition: number;
}

// Colors
const PROMOTE_COLOR = '#1B4D5C';
const DRAWS_COLOR = '#D4A843';
const ROC_COLOR = '#5BC0DE';
const NET_RETURN_COLOR = '#4CAF50';
const CO_INVEST_COLOR = '#E74C3C';

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${value < 0 ? '-' : ''}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${value < 0 ? '-' : ''}$${(abs / 1e3).toFixed(0)}K`;
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

const defaultPartnerConfig: PartnerConfig = {
  partnerCount: 3,
  splitMode: 'equal',
  partners: [
    { name: 'Partner 1', ownershipPct: 33.33 },
    { name: 'Partner 2', ownershipPct: 33.33 },
    { name: 'Partner 3', ownershipPct: 33.34 },
  ],
};

function buildEqualPartners(count: number): { name: string; ownershipPct: number }[] {
  const basePct = Math.floor((10000 / count)) / 100;
  const remainder = 100 - basePct * count;
  return Array.from({ length: count }, (_, i) => ({
    name: `Partner ${i + 1}`,
    ownershipPct: i === count - 1 ? basePct + Math.round(remainder * 100) / 100 : basePct,
  }));
}

function GpPartnerEconomics({ projectId, onTabChange }: GpPartnerEconomicsProps) {
  const queryClient = useQueryClient();

  // --- Data queries ---

  const { data: project } = useQuery<ProjectData>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: proForma } = useQuery<ProFormaData>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
  });

  // Fetch waterfall settings (lightweight GET)
  const { data: waterfallData } = useQuery<WaterfallResult>({
    queryKey: ['/api/tax-waterfall/projects', projectId, 'settings'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/tax-waterfall/projects/${projectId}/settings`);
        return res.json();
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 60000,
  });

  // --- Partner config state ---

  const [partnerConfig, setPartnerConfig] = useState<PartnerConfig>(defaultPartnerConfig);

  // Hydrate partner config from project.customMetrics.gpPartners
  useEffect(() => {
    const saved = project?.customMetrics?.gpPartners as PartnerConfig | undefined;
    if (saved && saved.partnerCount && saved.partners?.length) {
      setPartnerConfig(saved);
    }
  }, [project?.customMetrics?.gpPartners]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: PartnerConfig) => {
      const existing = project?.customMetrics ?? {};
      const res = await apiRequest('PATCH', `/api/modeling/projects/${projectId}`, {
        customMetrics: { ...existing, gpPartners: payload },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns/model', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'lp-reporting'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-waterfall/projects', projectId] });
      toast({ title: 'Partners Saved', description: 'GP partner configuration updated.' });
    },
    onError: () => {
      toast({ title: 'Save Failed', description: 'Could not save partner configuration.', variant: 'destructive' });
    },
  });

  const handleSavePartners = useCallback(() => {
    saveMutation.mutate(partnerConfig);
  }, [partnerConfig, saveMutation]);

  // --- Fund assumptions state (carry, GP commit, sale costs, hold period) ---

  const [fundFields, setFundFields] = useState({
    carriedInterestPct: '',
    gpCommitmentPct: '',
    saleCostsPct: '',
    holdPeriod: '',
  });
  const [fundHydrated, setFundHydrated] = useState(false);

  useEffect(() => {
    if (fundHydrated || !project) return;
    const fa = project?.customMetrics?.fundAssumptions as Record<string, unknown> | undefined;
    setFundFields({
      carriedInterestPct: fa?.carriedInterestPct != null ? ((fa.carriedInterestPct as number) * 100).toFixed(1) : '',
      gpCommitmentPct: fa?.gpCommitmentPct != null ? ((fa.gpCommitmentPct as number) * 100).toFixed(1) : '',
      saleCostsPct: fa?.saleCostsPct != null ? ((fa.saleCostsPct as number) * 100).toFixed(1) : '',
      holdPeriod: fa?.holdPeriod != null ? String(Math.round(fa.holdPeriod as number)) : '',
    });
    setFundHydrated(true);
  }, [project, fundHydrated]);

  const fundAssumptionsMutation = useMutation({
    mutationFn: async (fields: typeof fundFields) => {
      const existing = project?.customMetrics ?? {};
      const existingFa = (existing.fundAssumptions as Record<string, unknown>) ?? {};
      const updated: Record<string, number | null> = {};
      const pct = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n / 100; };
      const int = (v: string) => { const n = parseInt(v); return isNaN(n) ? null : n; };
      updated.carriedInterestPct = pct(fields.carriedInterestPct);
      updated.gpCommitmentPct = pct(fields.gpCommitmentPct);
      updated.saleCostsPct = pct(fields.saleCostsPct);
      updated.holdPeriod = int(fields.holdPeriod);
      const patch: Record<string, unknown> = {
        customMetrics: { ...existing, fundAssumptions: { ...existingFa, ...updated } },
      };
      if (updated.holdPeriod != null) patch.holdPeriodYears = updated.holdPeriod;
      const res = await apiRequest('PATCH', `/api/modeling/projects/${projectId}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/returns/model', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-waterfall/projects', projectId] });
      toast({ title: 'Assumptions Saved', description: 'Fund structure assumptions updated.' });
    },
    onError: () => {
      toast({ title: 'Save Failed', description: 'Could not save assumptions.', variant: 'destructive' });
    },
  });

  const handlePartnerCountChange = useCallback((delta: number) => {
    setPartnerConfig((prev) => {
      const newCount = Math.max(1, Math.min(10, prev.partnerCount + delta));
      if (newCount === prev.partnerCount) return prev;
      if (prev.splitMode === 'equal') {
        return {
          ...prev,
          partnerCount: newCount,
          partners: buildEqualPartners(newCount),
        };
      }
      // Custom mode: add/remove last partner
      const partners = [...prev.partners];
      if (newCount > prev.partnerCount) {
        for (let i = prev.partnerCount; i < newCount; i++) {
          partners.push({ name: `Partner ${i + 1}`, ownershipPct: 0 });
        }
      } else {
        partners.splice(newCount);
      }
      return { ...prev, partnerCount: newCount, partners };
    });
  }, []);

  const handleSplitModeToggle = useCallback(() => {
    setPartnerConfig((prev) => {
      const newMode = prev.splitMode === 'equal' ? 'custom' : 'equal';
      if (newMode === 'equal') {
        return {
          ...prev,
          splitMode: 'equal',
          partners: buildEqualPartners(prev.partnerCount),
        };
      }
      return { ...prev, splitMode: 'custom' };
    });
  }, []);

  const handlePartnerNameChange = useCallback((index: number, name: string) => {
    setPartnerConfig((prev) => {
      const partners = [...prev.partners];
      partners[index] = { ...partners[index], name };
      return { ...prev, partners };
    });
  }, []);

  const handlePartnerPctChange = useCallback((index: number, value: string) => {
    const pct = parseFloat(value);
    if (isNaN(pct)) return;
    setPartnerConfig((prev) => {
      const partners = [...prev.partners];
      partners[index] = { ...partners[index], ownershipPct: Math.max(0, Math.min(100, pct)) };
      return { ...prev, partners };
    });
  }, []);

  // --- Compute economics ---

  const economics = useMemo(() => {
    const cm = project?.customMetrics || {};
    const fundAssumptions = cm?.fundAssumptions || {};
    const fundGnA = cm?.fundGnA;

    // Read sidebar assumptions
    const carriedInterestPct = fundAssumptions.carriedInterestPct;
    const gpCommitmentPct = fundAssumptions.gpCommitmentPct;
    const saleCostsPct = fundAssumptions.saleCostsPct;

    // Extract waterfall data if available
    const waterfallCarryPct = waterfallData?.carryPercent;
    const waterfallPrefRate = waterfallData?.preferredRate;
    const waterfallGpSplit = waterfallData?.gpSplit;

    // Carry % priority: waterfall > sidebar assumptions > gpPartners legacy > default
    const carryPercent =
      waterfallCarryPct != null ? waterfallCarryPct :
      carriedInterestPct != null ? carriedInterestPct * 100 :
      cm?.gpPartners?.carryPercent ?? 20;

    // GP equity / commitment %: sidebar > legacy > default
    const gpEquityPercent =
      gpCommitmentPct != null ? gpCommitmentPct * 100 :
      cm?.gpPartners?.gpEquityPercent ?? 10;

    // Sale costs %
    const saleCostsFrac = saleCostsPct ?? 0.02;

    // Hold period from sidebar assumptions, fallback to default
    const holdPeriod = fundAssumptions.holdPeriod ?? 7;

    // Partner splits from state
    const partnerCount = partnerConfig.partnerCount;
    const partnerSplits = partnerConfig.partners;

    // Financial inputs
    const purchasePrice = Number(project?.purchasePrice) || 10_000_000;
    const totalEquity = purchasePrice * (cm?.gpPartners?.equityRatio || 0.35);
    const gpEquity = totalEquity * (gpEquityPercent / 100);

    // NOI / cashflow estimation
    const year1NOI = proForma?.year1NOI || Number(project?.ebitda) || purchasePrice * 0.08;
    const annualGrowth = 0.03;

    // G&A from Fund G&A model if available, else estimate
    let annualGA: number;
    if (fundGnA) {
      // Sum monthly totals from the G&A model data
      const benefitsRate = fundGnA.benefitsRate ?? 0.25;
      const salaryGrowth = fundGnA.annualSalaryGrowth ?? 0.03;
      let totalAnnualGA = 0;
      // Calculate 12 months of G&A for year 1
      for (let m = 0; m < 12; m++) {
        let monthTotal = 0;
        // Partner compensation
        if (fundGnA.partners) {
          for (const p of fundGnA.partners) {
            if (m + 1 >= (p.startMonth || 1)) {
              const yearIdx = Math.floor(m / 12);
              const salary = (p.annualSalary || 0) * Math.pow(1 + salaryGrowth, yearIdx);
              monthTotal += (salary * (1 + benefitsRate)) / 12;
            }
          }
        }
        // Staff compensation
        if (fundGnA.staff) {
          for (const s of fundGnA.staff) {
            if (m + 1 >= (s.hireMonth || 1)) {
              const yearIdx = Math.floor(m / 12);
              const salary = (s.annualSalary || 0) * Math.pow(1 + salaryGrowth, yearIdx);
              const allocPct = (s.gnaAllocPct ?? 100) / 100;
              monthTotal += (salary * (1 + benefitsRate) * allocPct) / 12;
            }
          }
        }
        // Overhead
        if (fundGnA.overhead) {
          for (const o of fundGnA.overhead) {
            if (m + 1 >= (o.startMonth || 1)) {
              const rampUp = o.rampUpMonths || 0;
              const monthsSinceStart = m + 1 - (o.startMonth || 1);
              const rampFactor = rampUp > 0 ? Math.min(1, (monthsSinceStart + 1) / rampUp) : 1;
              monthTotal += (o.monthlyBudget || 0) * rampFactor;
            }
          }
        }
        totalAnnualGA += monthTotal;
      }
      annualGA = totalAnnualGA;
    } else {
      annualGA = purchasePrice * 0.005;
    }

    // Build monthly cashflows
    const totalMonths = holdPeriod * 12;
    const monthlyCashflows: number[] = [];
    for (let m = 0; m < totalMonths; m++) {
      const yearIdx = Math.floor(m / 12);
      const annualNOI = year1NOI * Math.pow(1 + annualGrowth, yearIdx);
      const debtServiceRatio = 0.60;
      const monthlyOperatingCF = (annualNOI * (1 - debtServiceRatio)) / 12;
      const monthlyGA = annualGA / 12;
      monthlyCashflows.push(monthlyOperatingCF - monthlyGA);
    }

    // GP Draws: positive CF months distributed to GP proportionally
    const totalGPDraws = monthlyCashflows.reduce((sum, cf) => {
      if (cf > 0) return sum + cf * (gpEquityPercent / 100);
      return sum;
    }, 0);

    // G&A shortfall: negative CF months require GP to fund
    const totalGAShortfall = monthlyCashflows.reduce((sum, cf) => {
      if (cf < 0) return sum + Math.abs(cf) * (gpEquityPercent / 100);
      return sum;
    }, 0);

    // Exit economics
    const exitNOI = year1NOI * Math.pow(1 + annualGrowth, holdPeriod);
    const exitCapRate = cm?.dealPricing?.exitCapRate || 0.075;
    const exitValue = exitNOI / exitCapRate;
    const exitSaleCosts = exitValue * saleCostsFrac;
    const totalProfit = exitValue - exitSaleCosts - purchasePrice;
    const exitMOIC = exitValue / totalEquity;

    // Promote / carry
    const totalPromote = Math.max(0, totalProfit * (carryPercent / 100) * (gpEquityPercent / 100));

    // Build per-partner data using actual splits
    const partnerRows: PartnerRow[] = partnerSplits.map((p) => {
      const sharePct = p.ownershipPct;
      const fraction = sharePct / 100;

      const coInvest = gpEquity * fraction + totalGAShortfall * fraction;
      const draws = totalGPDraws * fraction;
      const roc = gpEquity * fraction;
      const promote = totalPromote * fraction;
      const grossTotal = draws + roc + promote;
      const netReturn = grossTotal - coInvest;

      return {
        name: p.name,
        sharePct,
        coInvest,
        draws,
        roc,
        promote,
        grossTotal,
        netReturn,
      };
    });

    const totalRow: PartnerRow = {
      name: 'TOTAL',
      sharePct: 100,
      coInvest: partnerRows.reduce((s, r) => s + r.coInvest, 0),
      draws: totalGPDraws,
      roc: gpEquity,
      promote: totalPromote,
      grossTotal: partnerRows.reduce((s, r) => s + r.grossTotal, 0),
      netReturn: partnerRows.reduce((s, r) => s + r.netReturn, 0),
    };

    // Use first partner for KPI cards (representative per-partner view based on equal share)
    const avgFraction = 1 / partnerCount;
    const perPartnerEquity = gpEquity * avgFraction;
    const perPartnerDraws = totalGPDraws * avgFraction;
    const perPartnerROC = perPartnerEquity;
    const perPartnerPromote = totalPromote * avgFraction;
    const perPartnerCapitalDeployed = perPartnerEquity + totalGAShortfall * avgFraction;
    const perPartnerGrossTotal = perPartnerDraws + perPartnerROC + perPartnerPromote;
    const perPartnerNetReturn = perPartnerGrossTotal - perPartnerCapitalDeployed;

    // Monthly draw data (average per partner)
    const monthlyDrawData: MonthlyDrawData[] = monthlyCashflows.map((cf, i) => {
      const year = Math.floor(i / 12) + 1;
      const month = (i % 12) + 1;
      const gpShare = cf * (gpEquityPercent / 100) * avgFraction;
      return {
        month: `Y${year}M${month}`,
        draw: Math.round(gpShare),
      };
    });

    // Cumulative cash position (average per partner)
    let cumulative = -perPartnerEquity;
    const cumulativeCashData: CumulativeCashData[] = monthlyCashflows.map((cf, i) => {
      const year = Math.floor(i / 12) + 1;
      const month = (i % 12) + 1;
      const gpShare = cf * (gpEquityPercent / 100) * avgFraction;
      cumulative += gpShare;
      return {
        month: `Y${year}M${month}`,
        cashPosition: Math.round(cumulative),
      };
    });
    cumulativeCashData.push({
      month: 'Exit',
      cashPosition: Math.round(cumulative + perPartnerROC + perPartnerPromote),
    });

    // Sources & Uses bars (average per partner)
    const sourcesUsesData: SourcesUsesBar[] = [
      { name: 'Co-Invest Out', value: -perPartnerCapitalDeployed, color: CO_INVEST_COLOR },
      { name: 'GP Draws', value: perPartnerDraws, color: DRAWS_COLOR },
      { name: 'ROC', value: perPartnerROC, color: ROC_COLOR },
      { name: 'Promote', value: perPartnerPromote, color: PROMOTE_COLOR },
      { name: 'Net Return', value: perPartnerNetReturn, color: NET_RETURN_COLOR },
    ];

    return {
      partnerCount,
      carryPercent,
      holdPeriod,
      exitMOIC,
      perPartnerPromote,
      perPartnerDraws,
      perPartnerROC,
      perPartnerGrossTotal,
      perPartnerNetReturn,
      perPartnerCapitalDeployed,
      monthlyDrawData,
      cumulativeCashData,
      sourcesUsesData,
      partnerRows,
      totalRow,
    };
  }, [project, proForma, waterfallData, partnerConfig]);

  const kpiCards = useMemo(() => {
    if (!economics) return [];
    return [
      {
        label: 'Promote at Exit',
        value: formatCurrency(economics.perPartnerPromote),
        subtitle: `${economics.exitMOIC.toFixed(2)}x carry`,
        icon: TrendingUp,
        color: 'text-teal-700',
        bg: 'bg-teal-50',
      },
      {
        label: 'Operating Draws',
        value: formatCurrency(economics.perPartnerDraws),
        subtitle: 'Positive CF months',
        icon: DollarSign,
        color: 'text-amber-700',
        bg: 'bg-amber-50',
      },
      {
        label: 'Return of Capital',
        value: formatCurrency(economics.perPartnerROC),
        subtitle: 'Co-invest returned at exit',
        icon: PieChart,
        color: 'text-blue-700',
        bg: 'bg-blue-50',
      },
      {
        label: `Total ${Math.round(economics.holdPeriod)}-Yr`,
        value: formatCurrency(economics.perPartnerGrossTotal),
        subtitle: 'Draws + ROC + Promote',
        icon: DollarSign,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
      },
      {
        label: 'Net After Co-Inv',
        value: formatCurrency(economics.perPartnerNetReturn),
        subtitle: 'After capital deployed',
        icon: TrendingUp,
        color: 'text-green-700',
        bg: 'bg-green-50',
      },
      {
        label: 'Capital Deployed',
        value: formatCurrency(economics.perPartnerCapitalDeployed),
        subtitle: 'Equity + funded G&A shortfall',
        icon: Users,
        color: 'text-slate-700',
        bg: 'bg-slate-50',
      },
    ];
  }, [economics]);

  // Reduce monthly draw data to show only every 3rd month for readability
  const filteredMonthlyDraws = useMemo(() => {
    return economics.monthlyDrawData.filter((_, i) => i % 3 === 0);
  }, [economics]);

  // Reduce cumulative data similarly
  const filteredCumulativeData = useMemo(() => {
    return economics.cumulativeCashData.filter((d, i) => {
      return d.month === 'Exit' || i % 3 === 0;
    });
  }, [economics]);

  const totalPctSum = partnerConfig.partners.reduce((s, p) => s + p.ownershipPct, 0);
  const pctValid = Math.abs(totalPctSum - 100) < 0.1;

  return (
    <div className="space-y-6">
      {/* Fund Structure Assumptions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Fund Structure Assumptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Carried Interest</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-8 text-sm text-right"
                  placeholder="20"
                  value={fundFields.carriedInterestPct}
                  onChange={(e) => setFundFields((p) => ({ ...p, carriedInterestPct: e.target.value }))}
                  min={0}
                  max={100}
                  step={0.5}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">GP Commit</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-8 text-sm text-right"
                  placeholder="10"
                  value={fundFields.gpCommitmentPct}
                  onChange={(e) => setFundFields((p) => ({ ...p, gpCommitmentPct: e.target.value }))}
                  min={0}
                  max={100}
                  step={0.5}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sale Costs</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-8 text-sm text-right"
                  placeholder="2"
                  value={fundFields.saleCostsPct}
                  onChange={(e) => setFundFields((p) => ({ ...p, saleCostsPct: e.target.value }))}
                  min={0}
                  max={20}
                  step={0.25}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hold Period</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="h-8 text-sm text-right"
                  placeholder="7"
                  value={fundFields.holdPeriod}
                  onChange={(e) => setFundFields((p) => ({ ...p, holdPeriod: e.target.value }))}
                  min={1}
                  max={30}
                  step={1}
                />
                <span className="text-sm text-muted-foreground">yr</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              onClick={() => fundAssumptionsMutation.mutate(fundFields)}
              disabled={fundAssumptionsMutation.isPending}
            >
              <Save className="h-3 w-3 mr-1" />
              {fundAssumptionsMutation.isPending ? 'Saving…' : 'Save Assumptions'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Partner Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Partner Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6 flex-wrap">
            {/* Partner count */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Partners</Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePartnerCountChange(-1)}
                  disabled={partnerConfig.partnerCount <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-8 text-center font-semibold">{partnerConfig.partnerCount}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePartnerCountChange(1)}
                  disabled={partnerConfig.partnerCount >= 10}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Split mode toggle */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Split</Label>
              <Button
                variant={partnerConfig.splitMode === 'equal' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => partnerConfig.splitMode !== 'equal' && handleSplitModeToggle()}
              >
                Equal
              </Button>
              <Button
                variant={partnerConfig.splitMode === 'custom' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => partnerConfig.splitMode !== 'custom' && handleSplitModeToggle()}
              >
                Custom
              </Button>
            </div>

            {/* Save button */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs ml-auto"
              onClick={handleSavePartners}
              disabled={saveMutation.isPending}
            >
              <Save className="h-3 w-3 mr-1" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>

          {/* Custom split editor */}
          {partnerConfig.splitMode === 'custom' && (
            <div className="border rounded-md p-3">
              <div className="grid gap-2">
                {partnerConfig.partners.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Input
                      value={p.name}
                      onChange={(e) => handlePartnerNameChange(i, e.target.value)}
                      className="h-7 text-sm max-w-[180px]"
                      placeholder={`Partner ${i + 1}`}
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={p.ownershipPct}
                        onChange={(e) => handlePartnerPctChange(i, e.target.value)}
                        className="h-7 text-sm w-20 text-right"
                        step="0.01"
                        min="0"
                        max="100"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className={`text-xs font-semibold ${pctValid ? 'text-green-600' : 'text-red-600'}`}>
                  {totalPctSum.toFixed(2)}%
                  {!pctValid && ' (must equal 100%)'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">GP Partner Economics</h2>
          <p className="text-muted-foreground">
            {economics.partnerCount} {partnerConfig.splitMode === 'equal' ? 'equal' : 'custom-split'} partners &middot;{' '}
            all figures shown per partner (avg)
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {economics.carryPercent}% Carry
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`rounded-md p-1.5 ${kpi.bg}`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium truncate">
                    {kpi.label}
                  </span>
                </div>
                <div className="text-lg font-bold">{kpi.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{kpi.subtitle}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sources & Uses Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Per-Partner Economics — Sources &amp; Uses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={economics.sourcesUsesData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => formatCurrency(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrencyFull(value), 'Amount']}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {economics.sourcesUsesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Cash Position */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cumulative Cash Position Per Partner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredCumulativeData}
                margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrencyFull(value), 'Cash Position']}
                  labelStyle={{ fontWeight: 600 }}
                />
                <defs>
                  <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={NET_RETURN_COLOR} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={NET_RETURN_COLOR} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="cashPosition"
                  stroke={PROMOTE_COLOR}
                  strokeWidth={2}
                  fill="url(#cashGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Partner Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Partner Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Partner</TableHead>
                  <TableHead className="text-right font-semibold">Share %</TableHead>
                  <TableHead className="text-right font-semibold">Co-Invest</TableHead>
                  <TableHead className="text-right font-semibold">Draws</TableHead>
                  <TableHead className="text-right font-semibold">ROC</TableHead>
                  <TableHead className="text-right font-semibold">Promote</TableHead>
                  <TableHead className="text-right font-semibold">Gross Total</TableHead>
                  <TableHead className="text-right font-semibold">Net Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {economics.partnerRows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right">{formatPercent(row.sharePct)}</TableCell>
                    <TableCell className="text-right text-red-600">
                      ({formatCurrency(row.coInvest)})
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.draws)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.roc)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.promote)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(row.grossTotal)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        row.netReturn >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(row.netReturn)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="border-t-2 bg-muted/50">
                  <TableCell className="font-bold">{economics.totalRow.name}</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatPercent(economics.totalRow.sharePct)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-600">
                    ({formatCurrency(economics.totalRow.coInvest)})
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(economics.totalRow.draws)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(economics.totalRow.roc)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(economics.totalRow.promote)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(economics.totalRow.grossTotal)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold ${
                      economics.totalRow.netReturn >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(economics.totalRow.netReturn)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </div>
        </CardContent>
      </Card>

      {/* Monthly Operating Draw Per Partner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Operating Draw Per Partner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredMonthlyDraws}
                margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrencyFull(value), 'Draw']}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Bar dataKey="draw" name="Draw / (Capital Call)" radius={[2, 2, 0, 0]}>
                  {filteredMonthlyDraws.map((entry, index) => (
                    <Cell
                      key={`draw-${index}`}
                      fill={entry.draw >= 0 ? DRAWS_COLOR : CO_INVEST_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GpPartnerEconomics;
