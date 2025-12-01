import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Anchor, Ship, Calendar, Users, CreditCard, Warehouse, 
  TrendingUp, Clock, AlertCircle, ChevronRight, Upload, 
  DollarSign, BarChart3, AlertTriangle
} from "lucide-react";
import DockitAppShell from "@/components/dockit/DockitAppShell";

interface DashboardStats {
  totalCustomers?: number;
  activeLeases?: number;
  pendingPayments?: number;
  todaysLaunches?: number;
  totalSlips?: number;
  occupiedSlips?: number;
  monthlyRevenue?: number;
  occupancyRate?: number;
  overduePayments?: number;
  availableSlips?: number;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  createdAt?: string;
}

interface Launch {
  id: string;
  customerId: string;
  boatId: string;
  scheduledDate: string;
  scheduledTime?: string;
  status: string;
  launchType: string;
}

export default function DockitDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/dockit/api/dashboard/stats"],
    retry: false,
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/dockit/api/customers"],
    retry: false,
  });

  const { data: todaysLaunches = [], isLoading: launchesLoading } = useQuery<Launch[]>({
    queryKey: ["/dockit/api/launches/today"],
    retry: false,
  });

  const quickActions = [
    { name: "Schedule Launch", href: "/operations/dockit/launches", icon: Calendar, color: "bg-blue-500" },
    { name: "Add Customer", href: "/operations/dockit/customers", icon: Users, color: "bg-green-500" },
    { name: "Manage Slips", href: "/operations/dockit/slips", icon: Anchor, color: "bg-purple-500" },
    { name: "Import Data", href: "/operations/dockit/imports", icon: Upload, color: "bg-orange-500" },
  ];

  const StatCard = ({ title, value, subtitle, icon: Icon, trend, isLoading }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    trend?: { value: number; positive: boolean };
    isLoading: boolean;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24 mb-1" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {trend && (
            <span className={trend.positive ? "text-green-600" : "text-red-600"}>
              {trend.positive ? "+" : ""}{trend.value}%
            </span>
          )}
          {subtitle}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <DockitAppShell title="Marina Operations Dashboard" description="Manage your marina with Dockit">
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link href={action.href} key={action.name}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`quick-action-${action.name.toLowerCase().replace(/ /g, '-')}`}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-medium text-sm">{action.name}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Customers"
            value={stats?.totalCustomers ?? customers.length ?? 0}
            subtitle="Active marina members"
            icon={Users}
            isLoading={statsLoading && customersLoading}
          />
          
          <StatCard
            title="Today's Launches"
            value={stats?.todaysLaunches ?? todaysLaunches.length ?? 0}
            subtitle="Scheduled for today"
            icon={Ship}
            isLoading={statsLoading && launchesLoading}
          />
          
          <StatCard
            title="Slip Occupancy"
            value={statsLoading ? "..." : `${stats?.occupiedSlips || 0}/${stats?.totalSlips || 0}`}
            subtitle={`${stats?.occupancyRate ? Math.round(stats.occupancyRate) : 0}% occupied`}
            icon={Anchor}
            isLoading={statsLoading}
          />
          
          <StatCard
            title="Monthly Revenue"
            value={statsLoading ? "..." : `$${((stats?.monthlyRevenue || 0) / 100).toLocaleString()}`}
            subtitle="This month"
            icon={DollarSign}
            isLoading={statsLoading}
          />
        </div>

        {/* Alerts Row */}
        {(stats?.overduePayments ?? 0) > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="flex items-center gap-4 p-4">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div className="flex-1">
                <p className="font-medium text-orange-900">
                  {stats?.overduePayments} overdue payment{stats?.overduePayments !== 1 ? 's' : ''} need attention
                </p>
                <p className="text-sm text-orange-700">Review and send reminders to customers with pending balances</p>
              </div>
              <Link href="/operations/dockit/payments">
                <Button variant="outline" size="sm" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                  View Payments
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Today's Launch Schedule
              </CardTitle>
              <CardDescription>Upcoming launches and hauling</CardDescription>
            </CardHeader>
            <CardContent>
              {launchesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : todaysLaunches.length > 0 ? (
                <div className="space-y-3">
                  {todaysLaunches.slice(0, 5).map((launch) => (
                    <div key={launch.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Ship className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">
                            {launch.launchType === 'launch' ? 'Launch' : 'Haul'} - {launch.scheduledTime || 'TBD'}
                          </p>
                          <p className="text-xs text-muted-foreground">Boat #{launch.boatId}</p>
                        </div>
                      </div>
                      <Badge variant={launch.status === 'completed' ? 'default' : 'secondary'}>
                        {launch.status}
                      </Badge>
                    </div>
                  ))}
                  {todaysLaunches.length > 5 && (
                    <Link href="/operations/dockit/launches">
                      <Button variant="ghost" size="sm" className="w-full">
                        View all {todaysLaunches.length} launches
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg text-muted-foreground">
                  <div className="text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No launches scheduled for today</p>
                    <Link href="/operations/dockit/launches">
                      <Button variant="link" size="sm" className="mt-2">
                        Schedule a launch <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Customers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recent Customers
              </CardTitle>
              <CardDescription>Latest marina members</CardDescription>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : customers.length > 0 ? (
                <div className="space-y-3">
                  {customers.slice(0, 5).map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-700">
                            {customer.firstName?.[0]}{customer.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {customer.firstName} {customer.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{customer.email}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                  {customers.length > 5 && (
                    <Link href="/operations/dockit/customers">
                      <Button variant="ghost" size="sm" className="w-full">
                        View all {customers.length} customers
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No customers yet</p>
                    <p className="text-xs mt-1">Add customers or import data</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Getting Started Banner */}
        {customers.length === 0 && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Warehouse className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Get Started with Dockit</h3>
                  <p className="text-sm text-muted-foreground">
                    Import your existing marina data or start adding customers and slips manually.
                  </p>
                </div>
              </div>
              <Link href="/operations/dockit/imports">
                <Button data-testid="button-import-data">
                  Import Data
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </DockitAppShell>
  );
}
