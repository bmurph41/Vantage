import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Anchor,
  Ship,
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  AlertTriangle,
  Percent,
  Building2,
  Clock,
  FileText,
  ChevronRight,
  Link2,
  ExternalLink,
  Layers,
  PieChart,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts';
import { formatCurrency, cn } from '@/lib/utils';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';

interface RentRollAnalysisProps {
  projectId: string;
  projectName?: string;
  onTabChange?: (tab: string) => void;
}

interface AnalysisData {
  projectName: string;
  dataSourceMode: string;
  linkedRraLocationId: string | null;
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
  dockBreakdown: Record<string, { count: number; occupied: number; totalRent: number }>;
  recentActivity: { type: string; description: string; date: string }[];
}

interface RentRollUnit {
  id: string;
  unitNumber: string;
  storageType: string;
  status: string;
  length?: string;
  width?: string;
  monthlyRent: string;
  annualRent?: string;
  tenantName?: string;
  boatName?: string;
  boatType?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  isMonthToMonth?: boolean;
  electricCharge?: string;
  waterCharge?: string;
  otherCharges?: string;
  isLiveaboard?: boolean;
  liveaboardRate?: string;
  sewerCharge?: string;
  pumpoutCharge?: string;
  taxesCharge?: string;
  dock?: string;
  section?: string;
  notes?: string;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
  loading,
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  trend?: { direction: 'up' | 'down'; value: string };
  color?: string;
  loading: boolean;
  onClick?: () => void;
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
    <Card className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            {trend && (
              <div className={`flex items-center text-xs ${trend.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {trend.direction === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {trend.value}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StorageTypeTable({ breakdown }: { breakdown: AnalysisData['storageTypeBreakdown'] }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1].totalRent - a[1].totalRent);

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Storage Type Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No units data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Storage Type Breakdown
        </CardTitle>
        <CardDescription>Occupancy and revenue by storage category</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Occupied</TableHead>
              <TableHead className="text-right">Vacant</TableHead>
              <TableHead className="text-right">Occupancy</TableHead>
              <TableHead className="text-right">Monthly Rev</TableHead>
              <TableHead className="text-right">Avg Rent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([type, data]) => (
              <TableRow key={type}>
                <TableCell className="font-medium">{type}</TableCell>
                <TableCell className="text-right">{data.count}</TableCell>
                <TableCell className="text-right text-green-600">{data.occupied}</TableCell>
                <TableCell className="text-right text-red-600">{data.vacant}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={data.occupancyRate >= 90 ? "default" : data.occupancyRate >= 70 ? "secondary" : "destructive"}>
                    {data.occupancyRate.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(data.totalRent)}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.avgRent)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OccupancyByType({ breakdown }: { breakdown: AnalysisData['storageTypeBreakdown'] }) {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Occupancy by Storage Type
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {entries.map(([type, data]) => (
            <div key={type}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{type}</span>
                <span className="text-sm text-muted-foreground">
                  {data.occupied}/{data.count} ({data.occupancyRate.toFixed(1)}%)
                </span>
              </div>
              <Progress value={data.occupancyRate} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RevenueChart({ breakdown }: { breakdown: AnalysisData['storageTypeBreakdown'] }) {
  const chartData = useMemo(() => {
    return Object.entries(breakdown)
      .sort((a, b) => b[1].totalRent - a[1].totalRent)
      .map(([type, data]) => ({
        name: type,
        revenue: data.totalRent,
        avgRent: data.avgRent,
      }));
  }, [breakdown]);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Revenue by Storage Type
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="revenue" fill="#3b82f6" name="Monthly Revenue" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function OccupancyPieChart({ data }: { data: AnalysisData }) {
  const pieData = [
    { name: 'Occupied', value: data.occupiedUnits, color: '#22c55e' },
    { name: 'Vacant', value: data.vacantUnits, color: '#ef4444' },
  ];

  if (data.totalUnits === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <PieChart className="h-5 w-5" />
          Occupancy Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPie>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPie>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2">
          {pieData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-sm text-muted-foreground">{entry.name}: {entry.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ExpirationTimeline({ expirations }: { expirations: AnalysisData['leaseExpirations'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Lease Expirations
        </CardTitle>
        <CardDescription>Next 12 months by rental revenue at risk</CardDescription>
      </CardHeader>
      <CardContent>
        {expirations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No lease expirations in the next 12 months
          </p>
        ) : (
          <div className="space-y-3">
            {expirations.slice(0, 8).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant={item.count > 5 ? "destructive" : "secondary"}>
                    {item.count}
                  </Badge>
                  <span className="text-sm font-medium">{item.month}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(item.rent)}/mo at risk
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DockBreakdownTable({ breakdown }: { breakdown: AnalysisData['dockBreakdown'] }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1].count - a[1].count);
  if (entries.length <= 1 && entries[0]?.[0] === 'Unassigned') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          By Dock / Section
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dock</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Occupied</TableHead>
              <TableHead className="text-right">Occupancy</TableHead>
              <TableHead className="text-right">Monthly Rev</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([dock, data]) => (
              <TableRow key={dock}>
                <TableCell className="font-medium">{dock}</TableCell>
                <TableCell className="text-right">{data.count}</TableCell>
                <TableCell className="text-right">{data.occupied}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={data.count > 0 && (data.occupied / data.count) >= 0.9 ? "default" : "secondary"}>
                    {data.count > 0 ? ((data.occupied / data.count) * 100).toFixed(1) : 0}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(data.totalRent)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecentActivity({ activities }: { activities: AnalysisData['recentActivity'] }) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lease': return FileText;
      case 'tenant': return Users;
      case 'payment': return DollarSign;
      default: return Clock;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, idx) => {
              const ActivityIcon = getActivityIcon(activity.type);
              return (
                <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeaseListSection({ units, loading }: { units: RentRollUnit[]; loading: boolean }) {
  const [sortBy, setSortBy] = useState<'unitNumber' | 'monthlyRent' | 'tenantName' | 'leaseEndDate'>('unitNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'occupied' | 'vacant'>('all');

  const filteredUnits = useMemo(() => {
    let filtered = [...units];
    if (filterStatus !== 'all') {
      filtered = filtered.filter(u => u.status === filterStatus);
    }
    filtered.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortBy) {
        case 'monthlyRent':
          valA = parseFloat(a.monthlyRent || '0');
          valB = parseFloat(b.monthlyRent || '0');
          break;
        case 'leaseEndDate':
          valA = a.leaseEndDate ? new Date(a.leaseEndDate).getTime() : 0;
          valB = b.leaseEndDate ? new Date(b.leaseEndDate).getTime() : 0;
          break;
        default:
          valA = (a as any)[sortBy] || '';
          valB = (b as any)[sortBy] || '';
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [units, filterStatus, sortBy, sortDir]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Lease Summary
            </CardTitle>
            <CardDescription>{filteredUnits.length} of {units.length} units shown</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterStatus('all')}
            >
              All ({units.length})
            </Badge>
            <Badge
              variant={filterStatus === 'occupied' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterStatus('occupied')}
            >
              Occupied ({units.filter(u => u.status === 'occupied').length})
            </Badge>
            <Badge
              variant={filterStatus === 'vacant' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilterStatus('vacant')}
            >
              Vacant ({units.filter(u => u.status === 'vacant').length})
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No units match the current filter. Add units in the Lease Data tab.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('unitNumber')}>
                    Unit {sortBy === 'unitNumber' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('tenantName')}>
                    Tenant {sortBy === 'tenantName' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('monthlyRent')}>
                    Monthly Rent {sortBy === 'monthlyRent' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('leaseEndDate')}>
                    Lease End {sortBy === 'leaseEndDate' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Dock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.slice(0, 100).map((unit) => {
                  const isExpiringSoon = unit.leaseEndDate && !unit.isMonthToMonth &&
                    new Date(unit.leaseEndDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                  return (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{unit.storageType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={unit.status === 'occupied' ? 'default' : 'destructive'}>
                          {unit.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{unit.tenantName || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{unit.boatType || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {unit.length ? `${unit.length}'` : ''}{unit.width ? ` x ${unit.width}'` : ''}
                        {!unit.length && !unit.width && '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(parseFloat(unit.monthlyRent || '0'))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {(() => {
                          const total = [
                            unit.electricCharge, unit.waterCharge, unit.sewerCharge,
                            unit.pumpoutCharge, unit.taxesCharge, unit.liveaboardRate
                          ].reduce((sum, v) => sum + parseFloat(v || '0'), 0);
                          return total > 0 ? formatCurrency(total) : '—';
                        })()}
                      </TableCell>
                      <TableCell>
                        {unit.isMonthToMonth ? (
                          <Badge variant="secondary">M2M</Badge>
                        ) : unit.leaseEndDate ? (
                          <span className={cn(isExpiringSoon && "text-red-600 font-medium")}>
                            {new Date(unit.leaseEndDate).toLocaleDateString()}
                            {isExpiringSoon && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{unit.dock || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filteredUnits.length > 100 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Showing first 100 of {filteredUnits.length} units
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RentRollAnalysis({ projectId, projectName, onTabChange }: RentRollAnalysisProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'leases' | 'analytics'>('dashboard');

  const { data: analysis, isLoading } = useQuery<AnalysisData>({
    queryKey: ['/api/modeling-rent-roll/projects', projectId, 'analysis'],
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery<RentRollUnit[]>({
    queryKey: ['/api/modeling-rent-roll/projects', projectId, 'units'],
  });

  const data = analysis || {
    projectName: projectName || '',
    dataSourceMode: 'standalone',
    linkedRraLocationId: null,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    occupancyRate: 0,
    totalMonthlyRent: 0,
    totalAnnualRevenue: 0,
    averageRentPerUnit: 0,
    grossPotentialRent: 0,
    vacancyLoss: 0,
    activeLeaseCount: 0,
    monthToMonthCount: 0,
    expiringLeases90Days: 0,
    leaseExpirations: [],
    storageTypeBreakdown: {},
    dockBreakdown: {},
    recentActivity: [],
  };

  return (
    <div ref={pdfRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Anchor className="h-5 w-5" />
            Rent Roll Analysis
          </h2>
          <p className="text-sm text-muted-foreground">
            Comprehensive rent roll analytics for {data.projectName || projectName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPdfButton contentRef={pdfRef} filename="rent-roll-analysis" title="Rent Roll Analysis" />
          {data.dataSourceMode === 'linked' && data.linkedRraLocationId && (
            <Badge variant="outline" className="gap-1">
              <Link2 className="h-3 w-3" />
              Linked to Portfolio
            </Badge>
          )}
          {data.totalUnits === 0 && (
            <Button variant="outline" size="sm" onClick={() => onTabChange?.('storage-leases')}>
              <ChevronRight className="h-4 w-4 mr-1" />
              Add Lease Data
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="leases" className="gap-2">
            <FileText className="h-4 w-4" />
            Leases
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Units"
              value={data.totalUnits}
              subtitle={`${data.occupiedUnits} occupied, ${data.vacantUnits} vacant`}
              icon={Anchor}
              loading={isLoading}
            />
            <MetricCard
              title="Occupancy Rate"
              value={`${data.occupancyRate.toFixed(1)}%`}
              subtitle={`${data.occupiedUnits} of ${data.totalUnits} units`}
              icon={Percent}
              loading={isLoading}
              color={data.occupancyRate >= 90 ? 'text-green-600' : data.occupancyRate >= 70 ? 'text-amber-600' : 'text-red-600'}
            />
            <MetricCard
              title="Monthly Revenue"
              value={formatCurrency(data.totalMonthlyRent)}
              subtitle={`${formatCurrency(data.totalAnnualRevenue)}/year`}
              icon={DollarSign}
              loading={isLoading}
              color="text-green-600"
            />
            <MetricCard
              title="Avg Rent/Unit"
              value={formatCurrency(data.averageRentPerUnit)}
              subtitle="Per occupied unit"
              icon={Building2}
              loading={isLoading}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Gross Potential"
              value={formatCurrency(data.grossPotentialRent)}
              subtitle="If 100% occupied"
              icon={TrendingUp}
              loading={isLoading}
              color="text-blue-600"
            />
            <MetricCard
              title="Vacancy Loss"
              value={formatCurrency(data.vacancyLoss)}
              subtitle={`${data.vacantUnits} vacant units`}
              icon={TrendingDown}
              loading={isLoading}
              color="text-red-600"
            />
            <MetricCard
              title="Active Leases"
              value={data.activeLeaseCount}
              subtitle={`${data.monthToMonthCount} month-to-month`}
              icon={FileText}
              loading={isLoading}
            />
            <MetricCard
              title="Expiring (90 days)"
              value={data.expiringLeases90Days}
              subtitle="Leases expiring soon"
              icon={AlertTriangle}
              loading={isLoading}
              color={data.expiringLeases90Days > 0 ? 'text-amber-600' : undefined}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <OccupancyByType breakdown={data.storageTypeBreakdown} />
            <ExpirationTimeline expirations={data.leaseExpirations} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Storage Types</p>
                    <p className="text-2xl font-bold">{Object.keys(data.storageTypeBreakdown).length}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Docks/Sections</p>
                    <p className="text-2xl font-bold">{Object.keys(data.dockBreakdown).length}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Month-to-Month</p>
                    <p className="text-2xl font-bold">{data.monthToMonthCount}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Annual Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(data.totalAnnualRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <RecentActivity activities={data.recentActivity} />
          </div>
        </TabsContent>

        <TabsContent value="leases" className="space-y-6 mt-4">
          <LeaseListSection units={units} loading={unitsLoading} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-4">
          <StorageTypeTable breakdown={data.storageTypeBreakdown} />

          <div className="grid gap-6 lg:grid-cols-2">
            <RevenueChart breakdown={data.storageTypeBreakdown} />
            <OccupancyPieChart data={data} />
          </div>

          <DockBreakdownTable breakdown={data.dockBreakdown} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
