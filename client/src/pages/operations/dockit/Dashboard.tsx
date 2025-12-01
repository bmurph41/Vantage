import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Anchor, Ship, Calendar, Users, CreditCard, Warehouse, 
  TrendingUp, Clock, AlertCircle, ChevronRight, Upload
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
}

export default function DockitDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/dockit/api/dashboard/stats"],
    retry: false,
  });

  const quickActions = [
    { name: "Schedule Launch", href: "/operations/dockit/launches", icon: Calendar, color: "bg-blue-500" },
    { name: "Add Customer", href: "/operations/dockit/customers", icon: Users, color: "bg-green-500" },
    { name: "Record Payment", href: "/operations/dockit/payments", icon: CreditCard, color: "bg-purple-500" },
    { name: "Import Data", href: "/operations/dockit/imports", icon: Upload, color: "bg-orange-500" },
  ];

  return (
    <DockitAppShell title="Marina Operations Dashboard" description="Manage your marina with Dockit">
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link href={action.href} key={action.name}>
              <Card className="cursor-pointer hover:shadow-md transition-shadow">
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : stats?.totalCustomers || 0}
              </div>
              <p className="text-xs text-muted-foreground">Active marina members</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Launches</CardTitle>
              <Ship className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : stats?.todaysLaunches || 0}
              </div>
              <p className="text-xs text-muted-foreground">Scheduled for today</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Slip Occupancy</CardTitle>
              <Anchor className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : `${stats?.occupiedSlips || 0}/${stats?.totalSlips || 0}`}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.totalSlips ? Math.round(((stats?.occupiedSlips || 0) / stats.totalSlips) * 100) : 0}% occupied
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : stats?.pendingPayments || 0}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting processing</p>
            </CardContent>
          </Card>
        </div>

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
              <div className="space-y-4">
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
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest marina operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg text-muted-foreground">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">Import data to get started</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started Banner */}
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
      </div>
    </DockitAppShell>
  );
}
