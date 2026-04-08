import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wrench, DollarSign, Clock, Users, 
  AlertTriangle, CheckCircle2, Loader, Plus,
  ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { Link } from "wouter";
import { ContextIntegrationsPanel } from "@/components/integrations/ContextIntegrationsPanel";

interface ServiceStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  onHold: number;
  totalRevenue: number;
  avgLaborHours: number;
}

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  boatName?: string;
  description: string;
  status: string;
  priority: string;
  jobType: string;
  scheduledDate?: string;
  totalAmount?: string;
  createdAt: string;
}

export default function ServiceDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<ServiceStats>({
    queryKey: ['/api/service/work-orders/stats'],
  });

  const { data: workOrders = [], isLoading: workOrdersLoading } = useQuery<WorkOrder[]>({
    queryKey: ['/api/service/work-orders'],
  });

  const { data: lowStockParts = [] } = useQuery({
    queryKey: ['/api/service/parts/low-stock'],
  });

  const recentWorkOrders = workOrders.slice(0, 5);
  const urgentWorkOrders = workOrders.filter(wo => wo.priority === 'urgent' || wo.priority === 'high');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'on_hold': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header 
        title="Service Department" 
        subtitle="Work orders, parts inventory, and technician management"
      />

      <div className="flex justify-between items-center">
        <Tabs defaultValue="overview" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
              <TabsTrigger value="parts">Parts</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Link href="/operations/service/work-orders">
                <Button data-testid="btn-new-work-order">
                  <Plus className="h-4 w-4 mr-2" />
                  New Work Order
                </Button>
              </Link>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Work Orders</p>
                      <p className="text-2xl font-bold" data-testid="stat-total-work-orders">{stats?.total || 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wrench className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                      <p className="text-2xl font-bold" data-testid="stat-in-progress">{stats?.inProgress || 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold" data-testid="stat-total-revenue">{formatCurrency(stats?.totalRevenue || 0)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Labor Hours</p>
                      <p className="text-2xl font-bold" data-testid="stat-avg-labor">{(stats?.avgLaborHours || 0).toFixed(1)}h</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Work Orders</CardTitle>
                  <CardDescription>Latest service requests and repairs</CardDescription>
                </CardHeader>
                <CardContent>
                  {workOrdersLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-6 w-6 animate-spin" />
                    </div>
                  ) : recentWorkOrders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No work orders found</p>
                  ) : (
                    <div className="space-y-4">
                      {recentWorkOrders.map((wo) => (
                        <div key={wo.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`work-order-${wo.id}`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{wo.workOrderNumber}</span>
                              <Badge className={getStatusColor(wo.status)}>{wo.status.replace('_', ' ')}</Badge>
                              <Badge className={getPriorityColor(wo.priority)}>{wo.priority}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{wo.boatName || wo.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{wo.totalAmount ? formatCurrency(parseFloat(wo.totalAmount)) : '-'}</p>
                            <p className="text-xs text-muted-foreground">{wo.jobType}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Urgent & High Priority
                  </CardTitle>
                  <CardDescription>Work orders requiring immediate attention</CardDescription>
                </CardHeader>
                <CardContent>
                  {urgentWorkOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                      <p className="text-muted-foreground">No urgent work orders</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {urgentWorkOrders.slice(0, 5).map((wo) => (
                        <div key={wo.id} className="flex items-center justify-between p-3 border border-orange-200 dark:border-orange-900 rounded-lg bg-orange-50 dark:bg-orange-950">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{wo.workOrderNumber}</span>
                              <Badge className={getPriorityColor(wo.priority)}>{wo.priority}</Badge>
                            </div>
                            <p className="text-sm">{wo.boatName || wo.description}</p>
                          </div>
                          <Badge className={getStatusColor(wo.status)}>{wo.status.replace('_', ' ')}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {lowStockParts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Low Stock Parts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(lowStockParts as any[]).slice(0, 8).map((part: any) => (
                      <div key={part.id} className="p-3 border rounded-lg">
                        <p className="font-medium">{part.name}</p>
                        <p className="text-sm text-muted-foreground">Part #: {part.partNumber}</p>
                        <div className="flex justify-between mt-2">
                          <span className="text-sm">In Stock: <span className="font-bold text-red-500">{part.quantityOnHand}</span></span>
                          <span className="text-sm text-muted-foreground">Reorder: {part.reorderPoint}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="work-orders">
            <Card>
              <CardHeader>
                <CardTitle>Work Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats?.inProgress || 0}</p>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats?.onHold || 0}</p>
                    <p className="text-sm text-muted-foreground">On Hold</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats?.completed || 0}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg bg-primary/5">
                    <p className="text-2xl font-bold">{stats?.total || 0}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
                <div className="mt-6">
                  <Link href="/operations/service/work-orders">
                    <Button variant="outline" className="w-full">
                      View All Work Orders
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Parts Inventory</CardTitle>
                  <CardDescription>Manage your parts and supplies</CardDescription>
                </div>
                <Link href="/operations/service/parts">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Part
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  View and manage your complete parts inventory from the Parts page.
                </p>
                <Link href="/operations/service/parts">
                  <Button variant="outline" className="w-full">
                    Go to Parts Inventory
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ContextIntegrationsPanel 
        contextKey="service"
        title="Service Integrations"
        description="Connect service and work order software to sync data with Vantage."
      />
    </div>
  );
}
