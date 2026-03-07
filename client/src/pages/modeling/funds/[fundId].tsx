import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { 
  Building2, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Calendar,
  Plus,
  Users,
  Briefcase,
  Target,
  ArrowLeft,
  Activity,
  RefreshCw,
  Settings,
  Edit,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FundMetrics {
  committedCapital: number;
  calledCapital: number;
  unfundedCommitments: number;
  distributedCapital: number;
  recycledCapital: number;
  dryPowder: number;
  deployedCapital: number;
  grossIrr: number | null;
  netIrr: number | null;
  grossMoic: number | null;
  netMoic: number | null;
  tvpi: number | null;
  dpi: number | null;
  rvpi: number | null;
  nav: number;
  dealCount: number;
  activeDeals: number;
  exitedDeals: number;
}

interface FundInvestor {
  id: string;
  investorName: string;
  investorType: string;
  commitmentAmount: string;
  calledCapital: string;
  unfundedCommitment: string;
  distributedCapital: string;
  capitalAccountBalance: string;
  isActive: boolean;
}

interface FundDealAllocation {
  id: string;
  modelingProjectId: string;
  projectName?: string;
  allocationPct: string;
  allocatedEquity: string;
  fundedAmount: string;
  currentValue: string;
  dealIrr: string | null;
  dealMoic: string | null;
  exitStatus: string;
  investmentDate: string | null;
}

interface Fund {
  id: string;
  name: string;
  shortName: string | null;
  status: 'raising' | 'investing' | 'harvesting' | 'closed' | 'liquidated';
  targetSize: string | null;
  hardCap: string | null;
  committedCapital: string;
  calledCapital: string;
  distributedCapital: string;
  vintage: number;
  firstCloseDate: string | null;
  finalCloseDate: string | null;
  investmentPeriodYears: number;
  fundLifeYears: number;
  managementFeePct: string;
  carriedInterestPct: string;
  preferredReturn: string;
  waterfallStyle: string;
  grossIrr: string | null;
  netIrr: string | null;
  tvpi: string | null;
  dpi: string | null;
  rvpi: string | null;
  investors?: FundInvestor[];
  allocations?: FundDealAllocation[];
  metrics?: FundMetrics;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const STATUS_ORDER: Fund['status'][] = ['raising', 'investing', 'harvesting', 'closed', 'liquidated'];

function formatMultiple(value: number | string | null): string {
  if (value === null) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${num.toFixed(2)}x`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'raising': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'investing': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'harvesting': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    case 'liquidated': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getNextStatus(currentStatus: Fund['status']): Fund['status'] | null {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  if (currentIndex < STATUS_ORDER.length - 1) {
    return STATUS_ORDER[currentIndex + 1];
  }
  return null;
}

function getStatusDescription(status: Fund['status']): string {
  switch (status) {
    case 'raising': return 'Actively fundraising from LPs';
    case 'investing': return 'Deploying capital into deals';
    case 'harvesting': return 'Managing portfolio, preparing exits';
    case 'closed': return 'Fund term ended, final distributions';
    case 'liquidated': return 'Fully liquidated and wound down';
    default: return '';
  }
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  variant = 'default'
}: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon: any;
  variant?: 'default' | 'success' | 'warning';
}) {
  const variantStyles = {
    default: '',
    success: 'border-green-200 dark:border-green-800',
    warning: 'border-amber-200 dark:border-amber-800'
  };

  return (
    <Card className={variantStyles[variant]} data-testid={`card-metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

const updateFundSchema = z.object({
  name: z.string().min(1, 'Fund name is required'),
  shortName: z.string().optional(),
  status: z.enum(['raising', 'investing', 'harvesting', 'closed', 'liquidated']),
  targetSize: z.string().optional(),
  managementFeePct: z.string().optional(),
  carriedInterestPct: z.string().optional(),
  preferredReturn: z.string().optional(),
});

type UpdateFundForm = z.infer<typeof updateFundSchema>;

function EditFundDialog({ 
  fund,
  open, 
  onOpenChange 
}: { 
  fund: Fund;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<UpdateFundForm>({
    resolver: zodResolver(updateFundSchema),
    defaultValues: {
      name: fund.name,
      shortName: fund.shortName || '',
      status: fund.status,
      targetSize: fund.targetSize || '',
      managementFeePct: fund.managementFeePct || '0.02',
      carriedInterestPct: fund.carriedInterestPct || '0.20',
      preferredReturn: fund.preferredReturn || '0.08',
    },
  });

  const updateFundMutation = useMutation({
    mutationFn: async (data: UpdateFundForm) => {
      return await apiRequest('PATCH', `/api/funds/${fund.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/funds', fund.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/funds'] });
      toast({ title: 'Fund updated successfully' });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update fund', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const onSubmit = (data: UpdateFundForm) => {
    updateFundMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Fund</DialogTitle>
          <DialogDescription>
            Update fund settings and terms
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fund Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-fund-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="shortName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-fund-short-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-fund-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="raising">Raising</SelectItem>
                        <SelectItem value="investing">Investing</SelectItem>
                        <SelectItem value="harvesting">Harvesting</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="liquidated">Liquidated</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateFundMutation.isPending} data-testid="button-save-fund">
                {updateFundMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function StatusTransitionDialog({
  fund,
  nextStatus,
  open,
  onOpenChange,
}: {
  fund: Fund;
  nextStatus: Fund['status'];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const transitionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('PATCH', `/api/funds/${fund.id}`, { status: nextStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/funds', fund.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/funds'] });
      toast({ title: `Fund transitioned to ${nextStatus}` });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to transition fund', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transition Fund Status</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to transition <strong>{fund.name}</strong> from{' '}
            <Badge className={getStatusColor(fund.status)}>{fund.status}</Badge> to{' '}
            <Badge className={getStatusColor(nextStatus)}>{nextStatus}</Badge>?
            <br /><br />
            <span className="text-muted-foreground">{getStatusDescription(nextStatus)}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => transitionMutation.mutate()}
            disabled={transitionMutation.isPending}
          >
            {transitionMutation.isPending ? 'Transitioning...' : 'Confirm Transition'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function OverviewTab({ fund, numPartners }: { fund: Fund; numPartners: number }) {
  const metrics = fund.metrics;
  const committed = parseFloat(fund.committedCapital || '0');
  const target = parseFloat(fund.targetSize || '0');
  const called = parseFloat(fund.calledCapital || '0');
  const distributed = parseFloat(fund.distributedCapital || '0');
  const carryPct = parseFloat(fund.carriedInterestPct || '0.20');
  const prefPct = parseFloat(fund.preferredReturn || '0.08');
  const mgmtFeePct = parseFloat(fund.managementFeePct || '0.02');
  const fundLife = fund.fundLifeYears || 10;

  const commitmentProgress = target > 0 ? (committed / target) * 100 : 0;
  const deploymentProgress = committed > 0 ? (called / committed) * 100 : 0;

  const capitalData = [
    { name: 'Committed', value: committed },
    { name: 'Called', value: called },
    { name: 'Distributed', value: distributed },
    { name: 'Dry Powder', value: metrics?.dryPowder || 0 },
  ];

  const lpPct = 0.98;
  const lpEquityIn = called * lpPct;
  const nav = metrics?.nav || 0;
  const lpProceeds = distributed * lpPct + nav * lpPct;
  const holdYrs = Math.min(fundLife, 7);
  const totalPrefAccrued = lpEquityIn * prefPct * holdYrs;
  const upside = Math.max(0, lpProceeds - lpEquityIn - totalPrefAccrued);
  const gpPromote = upside * carryPct;
  const amPmFees = mgmtFeePct * called * fundLife;
  const gpNet = gpPromote + amPmFees;
  const perPartner = numPartners > 0 ? gpNet / numPartners : 0;

  const baseNoi = (nav > 0 ? nav : called) * 0.065;
  const noiGrowthData = Array.from({ length: Math.max(fundLife, 1) }, (_, i) => ({
    year: `Yr ${i + 1}`,
    noi: baseNoi * Math.pow(1.03, i),
  }));

  const assetIrrData = (fund.allocations || [])
    .filter(a => a.dealIrr !== null && a.dealIrr !== undefined && parseFloat(a.dealIrr) !== 0)
    .map(a => ({
      name: a.projectName ? a.projectName.substring(0, 12) : 'Asset',
      irr: parseFloat(a.dealIrr || '0') * 100,
    }));

  const investMonths = Math.max((fund.investmentPeriodYears || 3) * 12, 6);
  const deploymentData = Array.from({ length: investMonths }, (_, i) => {
    const m = i + 1;
    const progress = 1 / (1 + Math.exp(-0.25 * (m - investMonths / 2)));
    return { month: `M${m}`, deployed: called * progress };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Net IRR"
          value={formatPercent(metrics?.netIrr)}
          subtitle="Since inception"
          icon={TrendingUp}
          variant={metrics?.netIrr && parseFloat(String(metrics.netIrr)) > 0.15 ? 'success' : 'default'}
        />
        <MetricCard title="TVPI" value={formatMultiple(metrics?.tvpi)} subtitle="Total value / paid-in" icon={Activity} />
        <MetricCard title="DPI" value={formatMultiple(metrics?.dpi)} subtitle="Distributions / paid-in" icon={DollarSign} />
        <MetricCard title="Dry Powder" value={formatCurrency(metrics?.dryPowder || 0)} subtitle="Available to deploy" icon={Target} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Committed Capital" value={formatCurrency(metrics?.committedCapital || 0)} subtitle={`${fund.investors?.length || 0} investors`} icon={Users} />
        <MetricCard
          title="Called Capital"
          value={formatCurrency(metrics?.calledCapital || 0)}
          subtitle={`${metrics?.calledCapital && metrics?.committedCapital ? ((metrics.calledCapital / metrics.committedCapital) * 100).toFixed(0) : 0}% of committed`}
          icon={Percent}
        />
        <MetricCard title="Deployed" value={formatCurrency(metrics?.deployedCapital || 0)} subtitle={`${metrics?.activeDeals || 0} active deals`} icon={Briefcase} />
        <MetricCard title="NAV" value={formatCurrency(metrics?.nav || 0)} subtitle="Current portfolio value" icon={Building2} />
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">LP Returns</p>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">LP Net IRR</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatPercent(metrics?.netIrr)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Net of fees + promote</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">LP MOIC</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{formatMultiple(metrics?.netMoic)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Multiple on invested capital</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">LP Equity In</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{formatCurrency(lpEquityIn)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{(lpPct * 100).toFixed(0)}% of total equity</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">Pref Hurdle</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{formatPercent(fund.preferredReturn)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Annual preferred return</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">LP Proceeds</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{formatCurrency(lpProceeds)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Total at exit (est.)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">GP Economics</p>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">GP Promote</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(gpPromote)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{(carryPct * 100).toFixed(0)}% carry above pref (est.)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">AM + PM Fees</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{formatCurrency(amPmFees)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{fundLife}-yr fee income (est.)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">Per Partner</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{formatCurrency(perPartner)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">1 of {numPartners} partners</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">GP Net</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-xl font-bold">{formatCurrency(gpNet)}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Promote + fees (est.)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Portfolio NOI Growth</CardTitle>
            <CardDescription className="text-xs">Estimated year-by-year across all deals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={noiGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} tick={{ fontSize: 10 }} width={48} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="noi" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Asset-Level IRRs</CardTitle>
            <CardDescription className="text-xs">By deal allocation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[160px]">
              {assetIrrData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assetIrrData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 10 }} width={36} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Bar dataKey="irr" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-xs text-muted-foreground px-4">
                  Add deal allocations with IRRs to see asset-level comparison
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">LP Capital Deployment</CardTitle>
            <CardDescription className="text-xs">Cumulative over investment period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={deploymentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={Math.floor(deploymentData.length / 5)} />
                  <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="deployed" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fundraising Progress</CardTitle>
            <CardDescription>Target: {formatCurrency(target)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Committed</span>
                  <span className="font-medium">{formatCurrency(committed)} ({commitmentProgress.toFixed(0)}%)</span>
                </div>
                <Progress value={commitmentProgress} className="h-3" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Deployed</span>
                  <span className="font-medium">{formatCurrency(called)} ({deploymentProgress.toFixed(0)}%)</span>
                </div>
                <Progress value={deploymentProgress} className="h-3 bg-blue-100" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capital Breakdown</CardTitle>
            <CardDescription>Current capital allocation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={capitalData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fund Timeline</CardTitle>
          <CardDescription>Key dates and lifecycle status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {STATUS_ORDER.map((status, index) => {
              const isActive = fund.status === status;
              const isPast = STATUS_ORDER.indexOf(fund.status) > index;
              return (
                <div key={status} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-blue-600 text-white' : isPast ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isPast ? <CheckCircle className="h-5 w-5" /> : isActive ? <Clock className="h-5 w-5" /> : <div className="w-3 h-3 rounded-full bg-gray-400" />}
                    </div>
                    <span className={`mt-2 text-xs font-medium capitalize ${isActive ? 'text-blue-600' : 'text-muted-foreground'}`}>{status}</span>
                  </div>
                  {index < STATUS_ORDER.length - 1 && (
                    <div className={`w-16 h-0.5 mx-2 ${isPast ? 'bg-green-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InvestorsTab({ fund }: { fund: Fund }) {
  const investorData = fund.investors?.map(i => ({
    id: i.id,
    name: i.investorName,
    type: i.investorType,
    commitment: parseFloat(i.commitmentAmount || '0'),
    called: parseFloat(i.calledCapital || '0'),
    unfunded: parseFloat(i.unfundedCommitment || '0'),
    distributed: parseFloat(i.distributedCapital || '0'),
    balance: parseFloat(i.capitalAccountBalance || '0'),
    isActive: i.isActive,
  })) || [];

  const totalCommitment = investorData.reduce((sum, i) => sum + i.commitment, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Investor Capital Accounts</CardTitle>
          <CardDescription>LP/GP commitments and capital activity</CardDescription>
        </div>
        <Button size="sm" data-testid="button-add-investor">
          <Plus className="h-4 w-4 mr-2" />
          Add Investor
        </Button>
      </CardHeader>
      <CardContent>
        {investorData.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Commitment</TableHead>
                <TableHead className="text-right">% of Fund</TableHead>
                <TableHead className="text-right">Called</TableHead>
                <TableHead className="text-right">Unfunded</TableHead>
                <TableHead className="text-right">Distributed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investorData.map((investor, i) => (
                <TableRow key={investor.id} data-testid={`row-investor-${i}`}>
                  <TableCell className="font-medium">{investor.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{investor.type.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(investor.commitment)}</TableCell>
                  <TableCell className="text-right">
                    {totalCommitment > 0 ? ((investor.commitment / totalCommitment) * 100).toFixed(1) : 0}%
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(investor.called)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(investor.unfunded)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(investor.distributed)}</TableCell>
                  <TableCell>
                    <Badge variant={investor.isActive ? 'default' : 'secondary'}>
                      {investor.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">No investors added yet</p>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add First Investor
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AllocationsTab({ fund }: { fund: Fund }) {
  const allocationData = fund.allocations?.map(a => ({
    name: a.projectName || 'Unknown',
    value: parseFloat(a.allocatedEquity || '0'),
  })) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Deal Allocations</CardTitle>
            <CardDescription>Capital deployed across portfolio companies</CardDescription>
          </div>
          <Button size="sm" data-testid="button-allocate-deal">
            <Plus className="h-4 w-4 mr-2" />
            Allocate to Deal
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              {fund.allocations && fund.allocations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Current Value</TableHead>
                      <TableHead className="text-right">IRR</TableHead>
                      <TableHead className="text-right">MOIC</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fund.allocations.map((alloc, i) => (
                      <TableRow key={alloc.id} data-testid={`row-allocation-${i}`}>
                        <TableCell className="font-medium">
                          <Link href={`/modeling/projects/${alloc.modelingProjectId}`}>
                            <span className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                              {alloc.projectName || 'Project'}
                              <ArrowUpRight className="h-3 w-3" />
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(alloc.allocatedEquity)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(alloc.currentValue || alloc.allocatedEquity)}</TableCell>
                        <TableCell className="text-right">{formatPercent(alloc.dealIrr)}</TableCell>
                        <TableCell className="text-right">{formatMultiple(alloc.dealMoic)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            alloc.exitStatus === 'active' ? 'border-green-500 text-green-700' :
                            alloc.exitStatus === 'exited' ? 'border-blue-500 text-blue-700' :
                            'border-gray-500 text-gray-700'
                          }>
                            {alloc.exitStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">No deal allocations yet</p>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Allocate to First Deal
                  </Button>
                </div>
              )}
            </div>
            
            {allocationData.length > 0 && (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {allocationData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WaterfallTab({ fund, prefType, setPrefType, gpCatchUp, setGpCatchUp, numPartners, setNumPartners }: {
  fund: Fund;
  prefType: 'simple' | 'compound';
  setPrefType: (v: 'simple' | 'compound') => void;
  gpCatchUp: 'none' | 'full';
  setGpCatchUp: (v: 'none' | 'full') => void;
  numPartners: number;
  setNumPartners: (v: number) => void;
}) {
  const splitStep = gpCatchUp === 'full' ? 4 : 3;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waterfall Distribution</CardTitle>
        <CardDescription>
          {fund.waterfallStyle === 'european' ? 'European' : 'American'} waterfall with{' '}
          {formatPercent(fund.preferredReturn)} preferred return
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="p-4 border rounded-lg bg-muted/20">
            <h4 className="font-medium mb-4">Waterfall Terms</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Preferred Return Type</Label>
                <div className="flex rounded-md overflow-hidden border h-9">
                  <button
                    className={`flex-1 px-3 text-sm font-medium transition-colors ${prefType === 'simple' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setPrefType('simple')}
                  >Simple</button>
                  <button
                    className={`flex-1 px-3 text-sm font-medium transition-colors ${prefType === 'compound' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setPrefType('compound')}
                  >Compound</button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {prefType === 'simple' ? 'Capital × rate × years' : 'Accrues on unpaid balance'}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">GP Catch-Up</Label>
                <div className="flex rounded-md overflow-hidden border h-9">
                  <button
                    className={`flex-1 px-3 text-sm font-medium transition-colors ${gpCatchUp === 'none' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setGpCatchUp('none')}
                  >None</button>
                  <button
                    className={`flex-1 px-3 text-sm font-medium transition-colors ${gpCatchUp === 'full' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setGpCatchUp('full')}
                  >Full</button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {gpCatchUp === 'none' ? 'No GP catch-up provision' : 'GP takes 100% above pref until at carry %'}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground"># of GP Partners</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={numPartners}
                  onChange={(e) => setNumPartners(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">Drives per-partner view on Overview</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Management Fee</p>
              <p className="text-2xl font-bold">{formatPercent(fund.managementFeePct)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Carried Interest</p>
              <p className="text-2xl font-bold">{formatPercent(fund.carriedInterestPct)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Preferred Return</p>
              <p className="text-2xl font-bold">{formatPercent(fund.preferredReturn)}</p>
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-4">Distribution Priority</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">1</div>
                <div>
                  <p className="font-medium">Return of Capital</p>
                  <p className="text-sm text-muted-foreground">100% to LPs until capital returned</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">2</div>
                <div>
                  <p className="font-medium">Preferred Return</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPercent(fund.preferredReturn)} annual to LPs — <span className="font-medium">{prefType === 'simple' ? 'simple' : 'compounded'}</span>
                  </p>
                </div>
              </div>
              {gpCatchUp === 'full' && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">3</div>
                  <div>
                    <p className="font-medium">GP Catch-Up</p>
                    <p className="text-sm text-muted-foreground">100% to GP until at carry percentage</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">{splitStep}</div>
                <div>
                  <p className="font-medium">Profit Split</p>
                  <p className="text-sm text-muted-foreground">
                    {((1 - parseFloat(fund.carriedInterestPct || '0.20')) * 100).toFixed(0)}% LP /{' '}
                    {(parseFloat(fund.carriedInterestPct || '0.20') * 100).toFixed(0)}% GP
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsTab({ fund }: { fund: Fund }) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const nextStatus = getNextStatus(fund.status);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fund Status</CardTitle>
          <CardDescription>Current lifecycle stage and transition controls</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <Badge className={`${getStatusColor(fund.status)} text-lg px-4 py-2`}>
                {fund.status.charAt(0).toUpperCase() + fund.status.slice(1)}
              </Badge>
              <div>
                <p className="font-medium">Current Status</p>
                <p className="text-sm text-muted-foreground">{getStatusDescription(fund.status)}</p>
              </div>
            </div>
            {nextStatus && (
              <Button onClick={() => setTransitionDialogOpen(true)} data-testid="button-transition-status">
                Transition to {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fund Details</CardTitle>
            <CardDescription>Basic fund information and terms</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)} data-testid="button-edit-fund">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Fund Name</Label>
                <p className="font-medium">{fund.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Short Name</Label>
                <p className="font-medium">{fund.shortName || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Vintage Year</Label>
                <p className="font-medium">{fund.vintage}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Target Size</Label>
                <p className="font-medium">{formatCurrency(fund.targetSize || 0)}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Investment Period</Label>
                <p className="font-medium">{fund.investmentPeriodYears} years</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Fund Life</Label>
                <p className="font-medium">{fund.fundLifeYears} years</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Waterfall Style</Label>
                <p className="font-medium capitalize">{fund.waterfallStyle}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee Structure</CardTitle>
          <CardDescription>Management fees and carried interest terms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <Label className="text-muted-foreground">Management Fee</Label>
              <p className="text-2xl font-bold">{formatPercent(fund.managementFeePct)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <Label className="text-muted-foreground">Carried Interest</Label>
              <p className="text-2xl font-bold">{formatPercent(fund.carriedInterestPct)}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <Label className="text-muted-foreground">Preferred Return</Label>
              <p className="text-2xl font-bold">{formatPercent(fund.preferredReturn)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditFundDialog fund={fund} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
      {nextStatus && (
        <StatusTransitionDialog 
          fund={fund} 
          nextStatus={nextStatus} 
          open={transitionDialogOpen} 
          onOpenChange={setTransitionDialogOpen} 
        />
      )}
    </div>
  );
}

export default function FundDetailPage() {
  const [, params] = useRoute('/modeling/funds/:fundId');
  const fundId = params?.fundId;
  const { toast } = useToast();
  const [numPartners, setNumPartners] = useState(3);
  const [prefType, setPrefType] = useState<'simple' | 'compound'>('simple');
  const [gpCatchUp, setGpCatchUp] = useState<'none' | 'full'>('none');

  const { data: fund, isLoading, error } = useQuery<Fund>({
    queryKey: ['/api/funds', fundId],
    enabled: !!fundId,
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/funds/${fundId}/recalculate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/funds', fundId] });
      toast({ title: 'Metrics recalculated' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to recalculate', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !fund) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-medium mb-2">Fund Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The fund you're looking for doesn't exist or you don't have access to it.
            </p>
            <Link href="/modeling/funds">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Funds
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/modeling/funds">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{fund.name}</h1>
              <Badge className={getStatusColor(fund.status)}>
                {fund.status.charAt(0).toUpperCase() + fund.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Vintage {fund.vintage} • {fund.investors?.length || 0} investors • {fund.allocations?.length || 0} deals
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            data-testid="button-recalculate"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="investors" data-testid="tab-investors">Investors</TabsTrigger>
          <TabsTrigger value="allocations" data-testid="tab-allocations">Deal Allocations</TabsTrigger>
          <TabsTrigger value="waterfall" data-testid="tab-waterfall">Waterfall</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab fund={fund} numPartners={numPartners} />
        </TabsContent>

        <TabsContent value="investors">
          <InvestorsTab fund={fund} />
        </TabsContent>

        <TabsContent value="allocations">
          <AllocationsTab fund={fund} />
        </TabsContent>

        <TabsContent value="waterfall">
          <WaterfallTab
            fund={fund}
            prefType={prefType}
            setPrefType={setPrefType}
            gpCatchUp={gpCatchUp}
            setGpCatchUp={setGpCatchUp}
            numPartners={numPartners}
            setNumPartners={setNumPartners}
          />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab fund={fund} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
