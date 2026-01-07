import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  Legend,
} from "recharts";
import { 
  Building2, 
  Users, 
  TrendingUp, 
  DollarSign,
  Anchor,
  Calendar,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

type OccupancyData = {
  locationId: string;
  locationName: string;
  totalSlips: number;
  occupiedSlips: number;
  occupancyRate: number;
  monthlyRevenue: number;
};

type RevenueData = {
  month: string;
  scheduled: number;
  actual: number;
  variance: number;
};

type LeaseData = {
  id: string;
  tenantName: string;
  locationName: string;
  slipNumber?: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string;
  status: string;
};

type ExpiringLease = LeaseData & {
  daysUntilExpiry: number;
};

export function OccupancyModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: occupancyData, isLoading } = useQuery<OccupancyData[]>({
    queryKey: ['/api/rent-roll/analytics/occupancy'],
    enabled: open,
  });

  const totalSlips = occupancyData?.reduce((sum, d) => sum + d.totalSlips, 0) || 0;
  const occupiedSlips = occupancyData?.reduce((sum, d) => sum + d.occupiedSlips, 0) || 0;
  const overallRate = totalSlips > 0 ? (occupiedSlips / totalSlips) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Portfolio Occupancy Analysis
          </DialogTitle>
          <DialogDescription>
            Detailed occupancy breakdown by marina location
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Slips</p>
                <p className="text-2xl font-bold">{totalSlips}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Occupied</p>
                <p className="text-2xl font-bold">{occupiedSlips}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                <p className="text-2xl font-bold">{overallRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Slips</TableHead>
                  <TableHead className="text-center">Occupied</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead className="text-right">Monthly Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!occupancyData || occupancyData.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No occupancy data available
                    </TableCell>
                  </TableRow>
                ) : (
                  occupancyData.map((loc) => (
                    <TableRow key={loc.locationId}>
                      <TableCell className="font-medium">{loc.locationName}</TableCell>
                      <TableCell className="text-center">{loc.totalSlips}</TableCell>
                      <TableCell className="text-center">{loc.occupiedSlips}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={loc.occupancyRate} className="w-20" />
                          <span className="text-sm">{loc.occupancyRate.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(loc.monthlyRevenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RevenueModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: revenueData, isLoading } = useQuery<RevenueData[]>({
    queryKey: ['/api/rent-roll/analytics/revenue'],
    enabled: open,
  });

  const totalScheduled = revenueData?.reduce((sum, d) => sum + d.scheduled, 0) || 0;
  const totalActual = revenueData?.reduce((sum, d) => sum + d.actual, 0) || 0;
  const totalVariance = totalActual - totalScheduled;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Revenue Analysis
          </DialogTitle>
          <DialogDescription>
            Scheduled vs actual revenue comparison
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold">{formatCurrency(totalScheduled)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Actual</p>
                <p className="text-2xl font-bold">{formatCurrency(totalActual)}</p>
              </CardContent>
            </Card>
            <Card className={cn(
              totalVariance >= 0 ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"
            )}>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Variance</p>
                <p className={cn(
                  "text-2xl font-bold",
                  totalVariance >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {totalVariance >= 0 && '+'}{formatCurrency(totalVariance)}
                </p>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend />
                  <Bar dataKey="scheduled" name="Scheduled" fill="#8884d8" />
                  <Bar dataKey="actual" name="Actual" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ActiveLeasesModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: leases, isLoading } = useQuery<LeaseData[]>({
    queryKey: ['/api/rent-roll/leases', { status: 'active' }],
    enabled: open,
  });

  const totalMonthlyRent = leases?.reduce((sum, l) => sum + (l.monthlyRent || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Leases ({leases?.length || 0})
          </DialogTitle>
          <DialogDescription>
            All currently active lease agreements | Total Monthly: {formatCurrency(totalMonthlyRent)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Slip</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!leases || leases.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No active leases found
                  </TableCell>
                </TableRow>
              ) : (
                leases.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell className="font-medium">{lease.tenantName}</TableCell>
                    <TableCell>{lease.locationName}</TableCell>
                    <TableCell>{lease.slipNumber || '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(lease.monthlyRent)}
                    </TableCell>
                    <TableCell>{new Date(lease.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ExpiringLeasesModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: leases, isLoading } = useQuery<ExpiringLease[]>({
    queryKey: ['/api/rent-roll/leases/expiring'],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Expiring Leases ({leases?.length || 0})
          </DialogTitle>
          <DialogDescription>
            Leases expiring within the next 90 days
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Days Left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!leases || leases.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No leases expiring in the next 90 days
                  </TableCell>
                </TableRow>
              ) : (
                leases.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell className="font-medium">{lease.tenantName}</TableCell>
                    <TableCell>{lease.locationName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(lease.monthlyRent)}
                    </TableCell>
                    <TableCell>
                      {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        lease.daysUntilExpiry <= 30 ? "destructive" : 
                        lease.daysUntilExpiry <= 60 ? "secondary" : "outline"
                      }>
                        {lease.daysUntilExpiry} days
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function StorageTypesModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: storageData, isLoading } = useQuery<{ type: string; count: number; revenue: number }[]>({
    queryKey: ['/api/rent-roll/analytics/storage-types'],
    enabled: open,
  });

  const chartData = storageData?.map((item, idx) => ({
    name: item.type,
    value: item.count,
    revenue: item.revenue,
    fill: COLORS[idx % COLORS.length]
  })) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Anchor className="h-5 w-5" />
            Storage Type Distribution
          </DialogTitle>
          <DialogDescription>
            Breakdown of leased storage by type
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name) => [value, name === 'value' ? 'Count' : name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Count</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: item.fill }}
                          />
                          {item.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{item.value}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LeaseTermsModal({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: termData, isLoading } = useQuery<{ term: string; count: number; avgRent: number }[]>({
    queryKey: ['/api/rent-roll/analytics/lease-terms'],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lease Term Analysis
          </DialogTitle>
          <DialogDescription>
            Distribution of lease agreements by term length
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead className="text-center">Count</TableHead>
                <TableHead className="text-right">Avg. Monthly Rent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!termData || termData.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No lease term data available
                  </TableCell>
                </TableRow>
              ) : (
                termData.map((term, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{term.term}</TableCell>
                    <TableCell className="text-center">{term.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(term.avgRent)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default {
  OccupancyModal,
  RevenueModal,
  ActiveLeasesModal,
  ExpiringLeasesModal,
  StorageTypesModal,
  LeaseTermsModal
};
