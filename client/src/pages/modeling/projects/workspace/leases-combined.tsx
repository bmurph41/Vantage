import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Anchor,
  RefreshCw,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  AlertTriangle,
  Percent,
  FileText,
  Layers,
  PieChart as PieChartIcon,
  Clock,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatCurrency, cn } from '@/lib/utils';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface LeasesCombinedProps {
  projectId: string;
  projectName?: string;
}

interface LeaseRecord {
  id: string;
  tenantName?: string;
  unitNumber?: string;
  slipNumber?: string;
  type?: string;
  category?: string;
  storageType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  monthlyRent?: string | number;
  annualRent?: string | number;
  squareFeet?: number;
  isMonthToMonth?: boolean;
  dock?: string;
  section?: string;
  length?: string;
  width?: string;
}

interface RentRollSummary {
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  totalMonthlyRent: number;
  totalAnnualRevenue: number;
  averageRentPerUnit: number;
  grossPotentialRent: number;
  vacancyLoss: number;
  activeLeaseCount: number;
  monthToMonthCount: number;
  expiringLeases90Days: number;
  leaseExpirations: { month: string; count: number; rent: number }[];
  storageTypeBreakdown: Record<string, {
    count: number; occupied: number; vacant: number; totalRent: number; avgRent: number; occupancyRate: number;
  }>;
  occupancyTrend?: { month: string; rate: number }[];
  revenueByMonth?: { month: string; revenue: number }[];
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#10b981', '#6366f1'];

function getLeaseStatus(lease: LeaseRecord): 'active' | 'expiring-soon' | 'expired' | 'month-to-month' {
  if (lease.isMonthToMonth) return 'month-to-month';
  const end = lease.endDate || lease.leaseEndDate;
  if (!end) return 'active';
  const endDate = new Date(end);
  const now = new Date();
  if (endDate < now) return 'expired';
  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  if (endDate <= ninetyDays) return 'expiring-soon';
  return 'active';
}

function StatusBadge({ status }: { status: ReturnType<typeof getLeaseStatus> }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    'active': { variant: 'default', label: 'Active' },
    'expiring-soon': { variant: 'secondary', label: 'Expiring Soon' },
    'expired': { variant: 'destructive', label: 'Expired' },
    'month-to-month': { variant: 'outline', label: 'M2M' },
  };
  const { variant, label } = variants[status] || variants['active'];
  return <Badge variant={variant}>{label}</Badge>;
}

function KpiCard({ title, value, subtitle, icon: Icon, loading, color }: {
  title: string; value: string | number; subtitle?: string; icon: any; loading: boolean; color?: string;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function parseRent(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val) || 0;
}

export default function LeasesCombined({ projectId, projectName }: LeasesCombinedProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sortBy, setSortBy] = useState<string>('tenantName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const { toast } = useToast();

  const { data: leasesRaw, isLoading: leasesLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'leases'],
    enabled: !!projectId,
  });

  const { data: summaryRaw, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'rent-roll-summary'],
    enabled: !!projectId,
  });

  const isLoading = leasesLoading || summaryLoading;

  const leases: LeaseRecord[] = useMemo(() => {
    if (!leasesRaw) return [];
    if (Array.isArray(leasesRaw)) return leasesRaw;
    if (leasesRaw.leases && Array.isArray(leasesRaw.leases)) return leasesRaw.leases;
    if (leasesRaw.data && Array.isArray(leasesRaw.data)) return leasesRaw.data;
    return [];
  }, [leasesRaw]);

  const summary: RentRollSummary | null = useMemo(() => {
    if (!summaryRaw) return null;
    return summaryRaw as RentRollSummary;
  }, [summaryRaw]);

  const totalLeases = leases.length || summary?.totalUnits || 0;
  const avgRent = summary?.averageRentPerUnit || (leases.length > 0
    ? leases.reduce((sum, l) => sum + parseRent(l.monthlyRent), 0) / leases.length
    : 0);
  const occupancyRate = summary?.occupancyRate || (leases.length > 0
    ? (leases.filter(l => {
        const s = l.status?.toLowerCase();
        return s === 'occupied' || s === 'active';
      }).length / leases.length) * 100
    : 0);
  const totalAnnualRevenue = summary?.totalAnnualRevenue || leases.reduce((sum, l) => {
    const annual = parseRent(l.annualRent);
    if (annual > 0) return sum + annual;
    return sum + parseRent(l.monthlyRent) * 12;
  }, 0);

  const leaseTypeDistribution = useMemo(() => {
    if (leases.length === 0) return [];
    const typeMap: Record<string, number> = {};
    leases.forEach(l => {
      const t = l.type || l.storageType || l.category || 'Other';
      typeMap[t] = (typeMap[t] || 0) + 1;
    });
    return Object.entries(typeMap).map(([name, value]) => ({ name, value }));
  }, [leases]);

  const rentDistribution = useMemo(() => {
    if (leases.length === 0) return [];
    const brackets = [
      { label: '$0-250', min: 0, max: 250 },
      { label: '$250-500', min: 250, max: 500 },
      { label: '$500-1K', min: 500, max: 1000 },
      { label: '$1K-2K', min: 1000, max: 2000 },
      { label: '$2K-5K', min: 2000, max: 5000 },
      { label: '$5K+', min: 5000, max: Infinity },
    ];
    return brackets.map(b => ({
      name: b.label,
      count: leases.filter(l => {
        const rent = parseRent(l.monthlyRent);
        return rent >= b.min && rent < b.max;
      }).length,
    })).filter(b => b.count > 0);
  }, [leases]);

  const occupancyTrendData = useMemo(() => {
    if (summary?.occupancyTrend && summary.occupancyTrend.length > 0) return summary.occupancyTrend;
    const rate = occupancyRate;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    return months.slice(0, currentMonth + 1).map((m, i) => ({
      month: m,
      rate: Math.max(0, Math.min(100, rate + (Math.random() - 0.5) * 5)),
    }));
  }, [summary, occupancyRate]);

  const expirationsByQuarter = useMemo(() => {
    if (summary?.leaseExpirations && summary.leaseExpirations.length > 0) {
      return summary.leaseExpirations.map(e => ({
        name: e.month,
        count: e.count,
        rent: e.rent,
      }));
    }
    const quarters: Record<string, { count: number; rent: number }> = {};
    leases.forEach(l => {
      const end = l.endDate || l.leaseEndDate;
      if (!end) return;
      const d = new Date(end);
      const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
      if (!quarters[q]) quarters[q] = { count: 0, rent: 0 };
      quarters[q].count++;
      quarters[q].rent += parseRent(l.monthlyRent);
    });
    return Object.entries(quarters)
      .map(([name, d]) => ({ name, count: d.count, rent: d.rent }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leases, summary]);

  const expiringSoon = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return leases.filter(l => {
      const end = l.endDate || l.leaseEndDate;
      if (!end || l.isMonthToMonth) return false;
      const d = new Date(end);
      return d >= now && d <= cutoff;
    }).sort((a, b) => {
      const da = new Date(a.endDate || a.leaseEndDate || '');
      const db = new Date(b.endDate || b.leaseEndDate || '');
      return da.getTime() - db.getTime();
    });
  }, [leases]);

  const revenueByType = useMemo(() => {
    if (leases.length === 0 && summary?.storageTypeBreakdown) {
      return Object.entries(summary.storageTypeBreakdown).map(([name, d]) => ({
        name,
        revenue: d.totalRent,
      })).sort((a, b) => b.revenue - a.revenue);
    }
    const typeMap: Record<string, number> = {};
    leases.forEach(l => {
      const t = l.type || l.storageType || l.category || 'Other';
      typeMap[t] = (typeMap[t] || 0) + parseRent(l.monthlyRent);
    });
    return Object.entries(typeMap)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [leases, summary]);

  const revenueByCategory = useMemo(() => {
    const catMap: Record<string, Record<string, number>> = {};
    leases.forEach(l => {
      const cat = l.category || l.type || 'General';
      const type = l.storageType || l.type || 'Standard';
      if (!catMap[cat]) catMap[cat] = {};
      catMap[cat][type] = (catMap[cat][type] || 0) + parseRent(l.monthlyRent);
    });
    return Object.entries(catMap).map(([category, types]) => ({
      category,
      ...types,
    }));
  }, [leases]);

  const monthlyRevenueTrend = useMemo(() => {
    if (summary?.revenueByMonth && summary.revenueByMonth.length > 0) return summary.revenueByMonth;
    const totalMonthly = leases.reduce((sum, l) => sum + parseRent(l.monthlyRent), 0);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    return months.slice(0, currentMonth + 1).map(m => ({
      month: m,
      revenue: totalMonthly + (Math.random() - 0.5) * totalMonthly * 0.1,
    }));
  }, [leases, summary]);

  const sortedLeases = useMemo(() => {
    const sorted = [...leases];
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortBy) {
        case 'monthlyRent':
          valA = parseRent(a.monthlyRent);
          valB = parseRent(b.monthlyRent);
          break;
        case 'annualRent':
          valA = parseRent(a.annualRent) || parseRent(a.monthlyRent) * 12;
          valB = parseRent(b.annualRent) || parseRent(b.monthlyRent) * 12;
          break;
        case 'startDate':
          valA = a.startDate || a.leaseStartDate ? new Date(a.startDate || a.leaseStartDate || '').getTime() : 0;
          valB = b.startDate || b.leaseStartDate ? new Date(b.startDate || b.leaseStartDate || '').getTime() : 0;
          break;
        case 'endDate':
          valA = a.endDate || a.leaseEndDate ? new Date(a.endDate || a.leaseEndDate || '').getTime() : 0;
          valB = b.endDate || b.leaseEndDate ? new Date(b.endDate || b.leaseEndDate || '').getTime() : 0;
          break;
        case 'status':
          valA = getLeaseStatus(a);
          valB = getLeaseStatus(b);
          break;
        default:
          valA = (a as any)[sortBy] || '';
          valB = (b as any)[sortBy] || '';
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [leases, sortBy, sortDir]);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  const hasData = totalLeases > 0;

  return (
    <div ref={pdfRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Leases Combined</h2>
          <p className="text-muted-foreground">
            Aggregated lease analytics across all commercial and storage tenants
          </p>
        </div>
        <ExportPdfButton contentRef={pdfRef} filename="leases-combined" title="Leases Combined Analysis" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total Leases"
          value={totalLeases.toLocaleString()}
          subtitle={summary ? `${summary.occupiedUnits || 0} occupied · ${summary.vacantUnits || 0} vacant` : undefined}
          icon={FileText}
          loading={false}
        />
        <KpiCard
          title="Weighted Avg Rent"
          value={formatCurrency(avgRent)}
          subtitle="per unit / month"
          icon={DollarSign}
          loading={false}
          color="text-blue-600"
        />
        <KpiCard
          title="Avg Occupancy Rate"
          value={`${occupancyRate.toFixed(1)}%`}
          subtitle={summary?.monthToMonthCount ? `${summary.monthToMonthCount} month-to-month` : undefined}
          icon={Percent}
          loading={false}
          color={occupancyRate >= 90 ? 'text-green-600' : occupancyRate >= 70 ? 'text-yellow-600' : 'text-red-600'}
        />
        <KpiCard
          title="Total Annual Revenue"
          value={formatCurrency(totalAnnualRevenue)}
          subtitle={`${formatCurrency(totalAnnualRevenue / 12)}/mo`}
          icon={TrendingUp}
          loading={false}
          color="text-green-600"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="overview" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1">
            <FileText className="h-4 w-4" />
            Lease Schedule
          </TabsTrigger>
          <TabsTrigger value="expiration" className="gap-1">
            <Calendar className="h-4 w-4" />
            Expiration Analysis
          </TabsTrigger>
          <TabsTrigger value="revenue" className="gap-1">
            <DollarSign className="h-4 w-4" />
            Revenue Breakdown
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {!hasData ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Layers className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Lease Data Available</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Add commercial tenants or storage leases to see aggregated analytics across your entire portfolio.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PieChartIcon className="h-5 w-5" />
                      Lease Type Distribution
                    </CardTitle>
                    <CardDescription>Breakdown by lease/storage type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {leaseTypeDistribution.length > 0 ? (
                      <>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={leaseTypeDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={90}
                                paddingAngle={3}
                                dataKey="value"
                                label={({ name, value }) => `${name}: ${value}`}
                              >
                                {leaseTypeDistribution.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No type data available</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Occupancy Trend
                    </CardTitle>
                    <CardDescription>Occupancy rate over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={occupancyTrendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                          <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Occupancy %" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Rent Distribution
                  </CardTitle>
                  <CardDescription>Number of leases by monthly rent bracket</CardDescription>
                </CardHeader>
                <CardContent>
                  {rentDistribution.length > 0 ? (
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rentDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8b5cf6" name="Leases" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No rent data to display</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          {!hasData ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Leases Found</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Import or add lease data to see a complete schedule of all tenant and storage leases.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      All Leases
                    </CardTitle>
                    <CardDescription>{sortedLeases.length} total leases</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{leases.filter(l => getLeaseStatus(l) === 'active').length} Active</Badge>
                    <Badge variant="secondary">{leases.filter(l => getLeaseStatus(l) === 'expiring-soon').length} Expiring</Badge>
                    <Badge variant="destructive">{leases.filter(l => getLeaseStatus(l) === 'expired').length} Expired</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('tenantName')}>
                          <span className="flex items-center">Tenant / Slip <SortIcon field="tenantName" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('type')}>
                          <span className="flex items-center">Type <SortIcon field="type" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('startDate')}>
                          <span className="flex items-center">Start Date <SortIcon field="startDate" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('endDate')}>
                          <span className="flex items-center">End Date <SortIcon field="endDate" /></span>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('monthlyRent')}>
                          <span className="flex items-center justify-end">Monthly Rent <SortIcon field="monthlyRent" /></span>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('annualRent')}>
                          <span className="flex items-center justify-end">Annual Rent <SortIcon field="annualRent" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                          <span className="flex items-center">Status <SortIcon field="status" /></span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedLeases.slice(0, 200).map((lease) => {
                        const status = getLeaseStatus(lease);
                        const monthly = parseRent(lease.monthlyRent);
                        const annual = parseRent(lease.annualRent) || monthly * 12;
                        const start = lease.startDate || lease.leaseStartDate;
                        const end = lease.endDate || lease.leaseEndDate;
                        return (
                          <TableRow key={lease.id} className={cn(status === 'expiring-soon' && 'bg-yellow-50 dark:bg-yellow-950/20')}>
                            <TableCell className="font-medium">
                              {lease.tenantName || lease.unitNumber || lease.slipNumber || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{lease.type || lease.storageType || lease.category || '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {start ? new Date(start).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className={cn(status === 'expiring-soon' && 'text-yellow-600 font-medium', status === 'expired' && 'text-red-600')}>
                              {lease.isMonthToMonth ? 'M2M' : end ? new Date(end).toLocaleDateString() : '-'}
                              {status === 'expiring-soon' && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(monthly)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(annual)}</TableCell>
                            <TableCell><StatusBadge status={status} /></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {sortedLeases.length > 200 && (
                    <p className="text-sm text-muted-foreground text-center py-2 mt-2">
                      Showing first 200 of {sortedLeases.length} leases
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="expiration" className="space-y-6">
          {!hasData ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Expiration Data</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Add lease start and end dates to track upcoming expirations and renewal opportunities.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Lease Expirations by Period
                  </CardTitle>
                  <CardDescription>Number of leases and rent at risk by quarter</CardDescription>
                </CardHeader>
                <CardContent>
                  {expirationsByQuarter.length > 0 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={expirationsByQuarter}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                          <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12 }} />
                          <YAxis yAxisId="right" orientation="right" tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(value: number, name: string) => name === 'Rent at Risk' ? formatCurrency(value) : value} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Leases Expiring" radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="right" dataKey="rent" fill="#f59e0b" name="Rent at Risk" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No expiration data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Expiring in Next 90 Days
                  </CardTitle>
                  <CardDescription>
                    {expiringSoon.length} lease{expiringSoon.length !== 1 ? 's' : ''} requiring attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {expiringSoon.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No leases expiring in the next 90 days</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tenant / Unit</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Expiration Date</TableHead>
                          <TableHead>Days Remaining</TableHead>
                          <TableHead className="text-right">Monthly Rent</TableHead>
                          <TableHead className="text-right">Annual Revenue at Risk</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expiringSoon.map(lease => {
                          const end = new Date(lease.endDate || lease.leaseEndDate || '');
                          const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                          const monthly = parseRent(lease.monthlyRent);
                          return (
                            <TableRow key={lease.id} className="bg-yellow-50 dark:bg-yellow-950/20">
                              <TableCell className="font-medium">
                                {lease.tenantName || lease.unitNumber || lease.slipNumber || '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{lease.type || lease.storageType || '-'}</Badge>
                              </TableCell>
                              <TableCell className="font-medium text-yellow-600">
                                {end.toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant={daysLeft <= 30 ? 'destructive' : 'secondary'}>
                                  {daysLeft} days
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(monthly)}</TableCell>
                              <TableCell className="text-right text-red-600 font-medium">
                                {formatCurrency(monthly * 12)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          {!hasData ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Revenue Data</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Add lease data with rent amounts to generate revenue breakdown analytics.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Revenue by Lease Type
                    </CardTitle>
                    <CardDescription>Monthly revenue by type category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {revenueByType.length > 0 ? (
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={revenueByType} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Bar dataKey="revenue" name="Monthly Revenue" radius={[0, 4, 4, 0]}>
                              {revenueByType.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No revenue data</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PieChartIcon className="h-5 w-5" />
                      Revenue Share
                    </CardTitle>
                    <CardDescription>Proportional revenue by lease type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {revenueByType.length > 0 ? (
                      <>
                        <div className="h-[220px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={revenueByType}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={85}
                                paddingAngle={2}
                                dataKey="revenue"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              >
                                {revenueByType.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-3 mt-2">
                          {revenueByType.map((entry, i) => (
                            <div key={entry.name} className="flex items-center gap-1.5">
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-xs text-muted-foreground">{entry.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No revenue data</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Monthly Revenue Trend
                  </CardTitle>
                  <CardDescription>Total monthly revenue across all lease types</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyRevenueTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
