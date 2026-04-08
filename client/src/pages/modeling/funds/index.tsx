import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FundReporting from '@/components/funds/fund-reporting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PackGate } from '@/contexts/PackContext';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
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
  Cell
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
  ArrowRight,
  Activity,
  PieChartIcon,
  RefreshCw,
  FileText,
  ChevronRight
} from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

function formatCurrencyInput(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('en-US');
}

function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[,$\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatPercentInput(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return (num * 100).toFixed(2);
}

function parsePercentInput(value: string): number {
  const cleaned = value.replace(/[%\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num / 100;
}

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

const createFundSchema = z.object({
  name: z.string().min(1, 'Fund name is required'),
  shortName: z.string().optional(),
  vintage: z.number().min(2000).max(2100),
  targetSize: z.number().min(0).optional(),
  status: z.enum(['raising', 'investing', 'harvesting', 'closed', 'liquidated']),
  managementFeePct: z.number().min(0).max(0.1).optional(),
  carriedInterestPct: z.number().min(0).max(0.5).optional(),
  preferredReturn: z.number().min(0).max(0.3).optional(),
  investmentPeriodYears: z.number().min(1).max(10).optional(),
  fundLifeYears: z.number().min(1).max(20).optional(),
});

type CreateFundForm = z.infer<typeof createFundSchema>;

function CreateFundDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  
  const form = useForm<CreateFundForm>({
    resolver: zodResolver(createFundSchema),
    defaultValues: {
      name: '',
      shortName: '',
      vintage: new Date().getFullYear(),
      targetSize: 0,
      status: 'raising',
      managementFeePct: 0.02,
      carriedInterestPct: 0.20,
      preferredReturn: 0.08,
      investmentPeriodYears: 4,
      fundLifeYears: 10,
    },
  });

  const createFundMutation = useMutation({
    mutationFn: async (data: CreateFundForm) => {
      return await apiRequest('POST', '/api/funds', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/funds'] });
      toast({ title: 'Fund created successfully' });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to create fund', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });

  const onSubmit = (data: CreateFundForm) => {
    createFundMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Fund</DialogTitle>
          <DialogDescription>
            Set up a new private equity fund to track capital, investors, and deal allocations.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Fund Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Marina Partners Fund III" {...field} data-testid="input-fund-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shortName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Name</FormLabel>
                    <FormControl>
                      <Input placeholder="MPF III" {...field} data-testid="input-fund-short-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vintage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vintage Year</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        data-testid="input-fund-vintage" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Size</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input 
                          type="text"
                          className="pl-7"
                          placeholder="00,000,000"
                          value={formatCurrencyInput(field.value || 0)}
                          onChange={(e) => field.onChange(parseCurrencyInput(e.target.value))}
                          data-testid="input-fund-target-size" 
                        />
                      </div>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-fund-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="raising">Raising</SelectItem>
                        <SelectItem value="investing">Investing</SelectItem>
                        <SelectItem value="harvesting">Harvesting</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="managementFeePct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mgmt Fee</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="text"
                          className="pr-7"
                          placeholder="0.00"
                          value={formatPercentInput(field.value || 0)}
                          onChange={(e) => field.onChange(parsePercentInput(e.target.value))}
                          data-testid="input-fund-mgmt-fee" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carriedInterestPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carry</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="text"
                          className="pr-7"
                          placeholder="0.00"
                          value={formatPercentInput(field.value || 0)}
                          onChange={(e) => field.onChange(parsePercentInput(e.target.value))}
                          data-testid="input-fund-carry" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferredReturn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pref Return</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="text"
                          className="pr-7"
                          placeholder="0.00"
                          value={formatPercentInput(field.value || 0)}
                          onChange={(e) => field.onChange(parsePercentInput(e.target.value))}
                          data-testid="input-fund-pref-return" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createFundMutation.isPending} data-testid="button-create-fund">
                {createFundMutation.isPending ? 'Creating...' : 'Create Fund'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function FundCard({ fund }: { fund: Fund }) {
  const committed = parseFloat(fund.committedCapital || '0');
  const target = parseFloat(fund.targetSize || '0');
  const called = parseFloat(fund.calledCapital || '0');
  const distributed = parseFloat(fund.distributedCapital || '0');
  
  const commitmentProgress = target > 0 ? (committed / target) * 100 : 0;
  const deploymentProgress = committed > 0 ? (called / committed) * 100 : 0;

  return (
    <Link href={`/modeling/funds/${fund.id}`}>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow" 
        data-testid={`card-fund-${fund.id}`}
      >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{fund.name}</CardTitle>
            <CardDescription>Vintage {fund.vintage}</CardDescription>
          </div>
          <Badge className={getStatusColor(fund.status)}>
            {fund.status.charAt(0).toUpperCase() + fund.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Committed</p>
              <p className="font-semibold">{formatCurrency(committed)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Called</p>
              <p className="font-semibold">{formatCurrency(called)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Distributed</p>
              <p className="font-semibold">{formatCurrency(distributed)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Net IRR</p>
              <p className="font-semibold">{formatPercent(fund.netIrr)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Fundraising</span>
              <span>{commitmentProgress.toFixed(0)}%</span>
            </div>
            <Progress value={commitmentProgress} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>Deployment</span>
              <span>{deploymentProgress.toFixed(0)}%</span>
            </div>
            <Progress value={deploymentProgress} className="h-2" />
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {fund.investors?.length || 0} LPs
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {fund.allocations?.length || 0} Deals
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
      </Card>
    </Link>
  );
}

function FundDetailView({ fund }: { fund: Fund }) {
  const metrics = fund.metrics;
  
  const allocationData = fund.allocations?.map(a => ({
    name: a.projectName || 'Unknown',
    value: parseFloat(a.allocatedEquity || '0'),
  })) || [];

  const investorData = fund.investors?.map(i => ({
    name: i.investorName,
    type: i.investorType,
    commitment: parseFloat(i.commitmentAmount || '0'),
    called: parseFloat(i.calledCapital || '0'),
    distributed: parseFloat(i.distributedCapital || '0'),
  })) || [];

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
        <MetricCard
          title="TVPI"
          value={formatMultiple(metrics?.tvpi)}
          subtitle="Total value / paid-in"
          icon={Activity}
        />
        <MetricCard
          title="DPI"
          value={formatMultiple(metrics?.dpi)}
          subtitle="Distributions / paid-in"
          icon={DollarSign}
        />
        <MetricCard
          title="Dry Powder"
          value={formatCurrency(metrics?.dryPowder || 0)}
          subtitle="Available to deploy"
          icon={Target}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Committed Capital"
          value={formatCurrency(metrics?.committedCapital || 0)}
          subtitle={`${fund.investors?.length || 0} investors`}
          icon={Users}
        />
        <MetricCard
          title="Called Capital"
          value={formatCurrency(metrics?.calledCapital || 0)}
          subtitle={`${metrics?.calledCapital && metrics?.committedCapital ? ((metrics.calledCapital / metrics.committedCapital) * 100).toFixed(0) : 0}% of committed`}
          icon={Percent}
        />
        <MetricCard
          title="Deployed"
          value={formatCurrency(metrics?.deployedCapital || 0)}
          subtitle={`${metrics?.activeDeals || 0} active deals`}
          icon={Briefcase}
        />
        <MetricCard
          title="NAV"
          value={formatCurrency(metrics?.nav || 0)}
          subtitle="Current portfolio value"
          icon={Building2}
        />
      </div>

      <Tabs defaultValue="investors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="investors" data-testid="tab-investors">Investors</TabsTrigger>
          <TabsTrigger value="allocations" data-testid="tab-allocations">Deal Allocations</TabsTrigger>
          <TabsTrigger value="waterfall" data-testid="tab-waterfall">Waterfall</TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-reporting">Reporting</TabsTrigger>
        </TabsList>

        <TabsContent value="investors">
          <Card>
            <CardHeader>
              <CardTitle>Investor Capital Accounts</CardTitle>
              <CardDescription>LP/GP commitments and capital activity</CardDescription>
            </CardHeader>
            <CardContent>
              {investorData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Investor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Commitment</TableHead>
                      <TableHead className="text-right">Called</TableHead>
                      <TableHead className="text-right">Unfunded</TableHead>
                      <TableHead className="text-right">Distributed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {investorData.map((investor, i) => (
                      <TableRow key={i} data-testid={`row-investor-${i}`}>
                        <TableCell className="font-medium">{investor.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{investor.type.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(investor.commitment)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(investor.called)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(investor.commitment - investor.called)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(investor.distributed)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                
               </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No investors added yet</p>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Investor
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocations">
          <Card>
            <CardHeader>
              <CardTitle>Deal Allocations</CardTitle>
              <CardDescription>Capital deployed across portfolio companies</CardDescription>
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
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fund.allocations.map((alloc, i) => (
                          <TableRow key={alloc.id} data-testid={`row-allocation-${i}`}>
                            <TableCell className="font-medium">
                              <Link href={`/modeling/projects/${alloc.modelingProjectId}`}>
                                <span className="text-blue-600 hover:underline cursor-pointer">
                                  {alloc.projectName || 'Project'}
                                </span>
                              </Link>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(alloc.allocatedEquity)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(alloc.currentValue || alloc.allocatedEquity)}</TableCell>
                            <TableCell className="text-right">{formatPercent(alloc.dealIrr)}</TableCell>
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
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No deal allocations yet</p>
                      <Button variant="outline" size="sm" className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        Allocate to Deal
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
        </TabsContent>

        <TabsContent value="waterfall">
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
                        <p className="text-sm text-muted-foreground">{formatPercent(fund.preferredReturn)} annual preferred to LPs</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm">3</div>
                      <div>
                        <p className="font-medium">GP Catch-Up</p>
                        <p className="text-sm text-muted-foreground">100% to GP until at carry percentage</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">4</div>
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
        </TabsContent>

        <TabsContent value="reporting">
          <FundReporting fundId={fund.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FundManagementContent() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: funds, isLoading, error } = useQuery<Fund[]>({
    queryKey: ['/api/funds'],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500">Failed to load funds</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fund Management</h1>
          <p className="text-muted-foreground">
            Track PE fund lifecycle, investor capital, and deal allocations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-new-fund">
            <Plus className="h-4 w-4 mr-2" />
            New Fund
          </Button>
        </div>
      </div>

      {funds && funds.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {funds.map((fund) => (
            <FundCard key={fund.id} fund={fund} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No funds yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first fund to start tracking capital, investors, and deal allocations.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-fund">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Fund
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateFundDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}

export default function FundManagement() {
  return (
    <PackGate 
      pack="fund_management" 
      upgradeMessage="Fund Management is a premium add-on that helps you track PE fund lifecycle, capital allocation, and investor returns."
    >
      <FundManagementContent />
    </PackGate>
  );
}
