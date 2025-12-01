import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, DollarSign, AlertTriangle, Download, Calendar, CreditCard, Clock, Users } from "lucide-react";
import type { Payment, Lease, Slip, BillingSchedule } from "@shared/schema";

interface ARSummary {
  totalOutstanding: number;
  totalOverdue: number;
  autopayEnrolled: number;
  upcomingBillings: number;
  customersWithOverdue: number;
}

interface AgingReport {
  current: { count: number; total: number };
  days1to30: { count: number; total: number };
  days31to60: { count: number; total: number };
  days61to90: { count: number; total: number };
  over90: { count: number; total: number };
}

export default function FinancialReports() {
  const [selectedPeriod, setSelectedPeriod] = useState("this-month");
  const [activeTab, setActiveTab] = useState("revenue");

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
  });

  const { data: leases = [] } = useQuery<Lease[]>({
    queryKey: ['/api/leases'],
  });

  const { data: slips = [] } = useQuery<Slip[]>({
    queryKey: ['/api/slips'],
  });

  const { data: overduePayments = [] } = useQuery<Payment[]>({
    queryKey: ['/api/payments/overdue'],
  });

  const { data: arSummary } = useQuery<ARSummary>({
    queryKey: ['/api/billing/ar-summary'],
  });

  const { data: agingReport } = useQuery<AgingReport>({
    queryKey: ['/api/billing/aging-report'],
  });

  const { data: billingSchedules = [] } = useQuery<BillingSchedule[]>({
    queryKey: ['/api/billing/schedules'],
  });

  // Calculate financial metrics
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const thisMonthRevenue = payments
    .filter(payment => {
      const dateStr = payment.paidDate || payment.dueDate;
      if (!dateStr) return false;
      const paymentDate = new Date(dateStr);
      return paymentDate.getMonth() === currentMonth && 
             paymentDate.getFullYear() === currentYear &&
             payment.status === 'paid';
    })
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

  const lastMonthRevenue = payments
    .filter(payment => {
      const dateStr = payment.paidDate || payment.dueDate;
      if (!dateStr) return false;
      const paymentDate = new Date(dateStr);
      return paymentDate.getMonth() === lastMonth && 
             paymentDate.getFullYear() === lastMonthYear &&
             payment.status === 'paid';
    })
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

  const yearlyRevenue = payments
    .filter(payment => {
      const dateStr = payment.paidDate || payment.dueDate;
      if (!dateStr) return false;
      const paymentDate = new Date(dateStr);
      return paymentDate.getFullYear() === currentYear && payment.status === 'paid';
    })
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

  const outstandingAmount = overduePayments
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

  const totalSlips = slips.length;
  const occupiedSlips = slips.filter(s => s.isOccupied).length;
  const occupancyRate = totalSlips > 0 ? (occupiedSlips / totalSlips) * 100 : 0;

  const revenueGrowth = lastMonthRevenue > 0 
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
    : 0;

  // Generate monthly revenue data for the chart
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const monthRevenue = payments
      .filter(payment => {
        const dateStr = payment.paidDate || payment.dueDate;
        if (!dateStr) return false;
        const paymentDate = new Date(dateStr);
        return paymentDate.getMonth() === i && 
               paymentDate.getFullYear() === currentYear &&
               payment.status === 'paid';
      })
      .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    return {
      month: new Date(currentYear, i).toLocaleString('default', { month: 'short' }),
      revenue: monthRevenue,
    };
  });

  const maxRevenue = Math.max(...monthlyData.map(d => d.revenue));

  // Revenue by slip type
  const revenueByType = {
    wet: 0,
    dry_stack: 0,
    trailer: 0,
  };

  leases
    .filter(lease => lease.status === 'active')
    .forEach(lease => {
      const slip = slips.find(s => s.id === lease.slipId);
      if (slip) {
        revenueByType[slip.type as keyof typeof revenueByType] += parseFloat(lease.monthlyRate);
      }
    });

  if (paymentsLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <TopBar />
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-64" />
              <div className="grid gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <TopBar />
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Financial Reports</h1>
              <p className="text-muted-foreground">Revenue tracking, accounts receivable, and financial analytics</p>
            </div>
            <div className="flex items-center space-x-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40" data-testid="select-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                </SelectContent>
              </Select>
              <Button data-testid="button-export">
                <Download size={16} className="mr-2" />
                Export Report
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="revenue" data-testid="tab-revenue">
                <DollarSign size={16} className="mr-2" />
                Revenue
              </TabsTrigger>
              <TabsTrigger value="ar" data-testid="tab-ar">
                <CreditCard size={16} className="mr-2" />
                Receivables
              </TabsTrigger>
              <TabsTrigger value="billing" data-testid="tab-billing">
                <Clock size={16} className="mr-2" />
                Billing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card data-testid="monthly-revenue">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                    <p className="text-3xl font-bold text-foreground">
                      ${thisMonthRevenue.toLocaleString()}
                    </p>
                    <p className={`text-sm ${revenueGrowth >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {revenueGrowth >= 0 ? '+' : ''}{revenueGrowth.toFixed(1)}% from last month
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-chart-1 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-white" size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="yearly-revenue">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Yearly Revenue</p>
                    <p className="text-3xl font-bold text-foreground">
                      ${yearlyRevenue.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      YTD through {new Date().toLocaleString('default', { month: 'short' })}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-chart-2 rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-white" size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="occupancy-rate">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                    <p className="text-3xl font-bold text-foreground">
                      {occupancyRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {occupiedSlips} of {totalSlips} slips
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-chart-3 rounded-lg flex items-center justify-center">
                    <BarChart3 className="text-white" size={20} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="outstanding-amount">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Outstanding</p>
                    <p className="text-3xl font-bold text-foreground">
                      ${outstandingAmount.toLocaleString()}
                    </p>
                    <p className="text-sm text-destructive">
                      {overduePayments.length} overdue accounts
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-destructive rounded-lg flex items-center justify-center">
                    <AlertTriangle className="text-white" size={20} />
                  </div>
                </div>
              </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2" data-testid="revenue-chart">
              <CardHeader>
                <h3 className="text-lg font-semibold">Monthly Revenue Trend</h3>
              </CardHeader>
              <CardContent>
                <div className="chart-container rounded-lg p-6 text-white">
                  <div className="h-64 flex items-end justify-between space-x-2">
                    {monthlyData.map((data, index) => (
                      <div key={data.month} className="flex flex-col items-center">
                        <div
                          className="bg-white rounded-t w-8 mb-2"
                          style={{ 
                            height: maxRevenue > 0 ? `${(data.revenue / maxRevenue) * 200}px` : '4px',
                            minHeight: '4px'
                          }}
                        />
                        <span className="text-xs opacity-80">{data.month}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="revenue-breakdown">
              <CardHeader>
                <h3 className="text-lg font-semibold">Revenue by Slip Type</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Wet Slips</span>
                    <span className="text-sm">${revenueByType.wet.toLocaleString()}/mo</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-chart-1 h-2 rounded-full"
                      style={{ 
                        width: `${revenueByType.wet > 0 ? (revenueByType.wet / (revenueByType.wet + revenueByType.dry_stack + revenueByType.trailer)) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Dry Storage</span>
                    <span className="text-sm">${revenueByType.dry_stack.toLocaleString()}/mo</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-chart-2 h-2 rounded-full"
                      style={{ 
                        width: `${revenueByType.dry_stack > 0 ? (revenueByType.dry_stack / (revenueByType.wet + revenueByType.dry_stack + revenueByType.trailer)) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Trailer Storage</span>
                    <span className="text-sm">${revenueByType.trailer.toLocaleString()}/mo</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-chart-3 h-2 rounded-full"
                      style={{ 
                        width: `${revenueByType.trailer > 0 ? (revenueByType.trailer / (revenueByType.wet + revenueByType.dry_stack + revenueByType.trailer)) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between font-medium">
                    <span>Total Monthly</span>
                    <span>${(revenueByType.wet + revenueByType.dry_stack + revenueByType.trailer).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
              </div>

              <Card data-testid="payment-status-summary">
                <CardHeader>
                  <h3 className="text-lg font-semibold">Payment Status Summary</h3>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-accent">
                        {payments.filter(p => p.status === 'paid').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Paid</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-chart-4">
                        {payments.filter(p => p.status === 'pending' && new Date(p.dueDate) >= new Date()).length}
                      </p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-destructive">
                        {overduePayments.length}
                      </p>
                      <p className="text-sm text-muted-foreground">Overdue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-muted-foreground">
                        {payments.filter(p => p.status === 'cancelled').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Cancelled</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ar" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card data-testid="ar-total-outstanding">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Outstanding</p>
                        <p className="text-2xl font-bold">${arSummary?.totalOutstanding?.toLocaleString() || 0}</p>
                      </div>
                      <DollarSign className="text-chart-1" size={24} />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="ar-total-overdue">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Overdue</p>
                        <p className="text-2xl font-bold text-destructive">${arSummary?.totalOverdue?.toLocaleString() || 0}</p>
                      </div>
                      <AlertTriangle className="text-destructive" size={24} />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="ar-autopay-enrolled">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Autopay Enrolled</p>
                        <p className="text-2xl font-bold">{arSummary?.autopayEnrolled || 0}</p>
                      </div>
                      <CreditCard className="text-chart-2" size={24} />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="ar-upcoming-billings">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Upcoming Billings</p>
                        <p className="text-2xl font-bold">{arSummary?.upcomingBillings || 0}</p>
                      </div>
                      <Calendar className="text-chart-3" size={24} />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="ar-customers-overdue">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Customers Overdue</p>
                        <p className="text-2xl font-bold">{arSummary?.customersWithOverdue || 0}</p>
                      </div>
                      <Users className="text-chart-4" size={24} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="aging-report">
                <CardHeader>
                  <h3 className="text-lg font-semibold">Aging Report</h3>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="text-center p-4 bg-accent/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">Current</p>
                      <p className="text-2xl font-bold text-accent">${agingReport?.current?.total?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">{agingReport?.current?.count || 0} invoices</p>
                    </div>
                    <div className="text-center p-4 bg-chart-4/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">1-30 Days</p>
                      <p className="text-2xl font-bold text-chart-4">${agingReport?.days1to30?.total?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">{agingReport?.days1to30?.count || 0} invoices</p>
                    </div>
                    <div className="text-center p-4 bg-orange-500/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">31-60 Days</p>
                      <p className="text-2xl font-bold text-orange-500">${agingReport?.days31to60?.total?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">{agingReport?.days31to60?.count || 0} invoices</p>
                    </div>
                    <div className="text-center p-4 bg-red-400/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">61-90 Days</p>
                      <p className="text-2xl font-bold text-red-400">${agingReport?.days61to90?.total?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">{agingReport?.days61to90?.count || 0} invoices</p>
                    </div>
                    <div className="text-center p-4 bg-destructive/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">90+ Days</p>
                      <p className="text-2xl font-bold text-destructive">${agingReport?.over90?.total?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">{agingReport?.over90?.count || 0} invoices</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <Card data-testid="billing-schedules">
                <CardHeader className="flex flex-row items-center justify-between">
                  <h3 className="text-lg font-semibold">Active Billing Schedules</h3>
                  <Button variant="outline" size="sm" data-testid="button-new-schedule">
                    <Clock size={16} className="mr-2" />
                    New Schedule
                  </Button>
                </CardHeader>
                <CardContent>
                  {billingSchedules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No billing schedules configured</p>
                      <p className="text-sm">Create a billing schedule to automate recurring payments</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {billingSchedules.map((schedule) => (
                        <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`billing-schedule-${schedule.id}`}>
                          <div>
                            <p className="font-medium">{schedule.name}</p>
                            <p className="text-sm text-muted-foreground">
                              ${Number(schedule.amount).toLocaleString()} / {schedule.frequency}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm">Next Billing</p>
                              <p className="text-sm text-muted-foreground">
                                {schedule.nextBillingDate ? new Date(schedule.nextBillingDate).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-medium ${
                              schedule.status === 'active' ? 'bg-accent/10 text-accent' :
                              schedule.status === 'paused' ? 'bg-chart-4/10 text-chart-4' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {schedule.status}
                            </div>
                            {schedule.autopayEnabled && (
                              <div className="px-2 py-1 rounded text-xs font-medium bg-chart-2/10 text-chart-2">
                                Autopay
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
