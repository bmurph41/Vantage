import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  TrendingUp, 
  DollarSign, 
  Anchor, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  Target
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import type { Marina, Organization, Payment, Slip, Lease } from "@shared/schema";

interface PortfolioStats {
  totalMarinas: number;
  totalSlips: number;
  occupiedSlips: number;
  totalMonthlyRevenue: number;
  totalOverdue: number;
  averageOccupancy: number;
}

interface MarinaSummary {
  marina: Marina;
  slipCount: number;
  occupiedSlips: number;
  occupancyRate: number;
  monthlyRevenue: number;
  overdueAmount: number;
  launchesToday: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function PortfolioDashboard() {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [selectedMarinaId, setSelectedMarinaId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: organizations = [], isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  const { data: marinas = [], isLoading: marinasLoading } = useQuery<Marina[]>({
    queryKey: ['/api/marinas'],
  });

  const { data: slips = [], isLoading: slipsLoading } = useQuery<Slip[]>({
    queryKey: ['/api/slips'],
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
  });

  const { data: leases = [] } = useQuery<Lease[]>({
    queryKey: ['/api/leases'],
  });

  const filteredMarinas = useMemo(() => {
    if (selectedOrgId === "all") return marinas;
    return marinas.filter(m => m.organizationId === selectedOrgId);
  }, [marinas, selectedOrgId]);

  const marinaSummaries: MarinaSummary[] = useMemo(() => {
    const marinasToProcess = selectedMarinaId === "all" 
      ? filteredMarinas 
      : filteredMarinas.filter(m => m.id === selectedMarinaId);

    return marinasToProcess.map(marina => {
      const marinaSlips = slips.filter(s => s.marinaId === marina.id);
      const occupiedSlips = marinaSlips.filter(s => s.isOccupied).length;
      const slipCount = marinaSlips.length;
      
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const marinaPayments = payments.filter(p => p.marinaId === marina.id);
      const monthlyRevenue = marinaPayments
        .filter(p => {
          const dateStr = p.paidDate || p.dueDate;
          if (!dateStr) return false;
          const date = new Date(dateStr);
          return date.getMonth() === currentMonth && 
                 date.getFullYear() === currentYear && 
                 p.status === 'paid';
        })
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const overdueAmount = marinaPayments
        .filter(p => p.status === 'overdue' || (p.status === 'pending' && new Date(p.dueDate) < new Date()))
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      return {
        marina,
        slipCount,
        occupiedSlips,
        occupancyRate: slipCount > 0 ? (occupiedSlips / slipCount) * 100 : 0,
        monthlyRevenue,
        overdueAmount,
        launchesToday: 0,
      };
    });
  }, [filteredMarinas, selectedMarinaId, slips, payments]);

  const portfolioStats: PortfolioStats = useMemo(() => {
    const totalSlips = marinaSummaries.reduce((sum, m) => sum + m.slipCount, 0);
    const occupiedSlips = marinaSummaries.reduce((sum, m) => sum + m.occupiedSlips, 0);
    const totalMonthlyRevenue = marinaSummaries.reduce((sum, m) => sum + m.monthlyRevenue, 0);
    const totalOverdue = marinaSummaries.reduce((sum, m) => sum + m.overdueAmount, 0);
    
    return {
      totalMarinas: marinaSummaries.length,
      totalSlips,
      occupiedSlips,
      totalMonthlyRevenue,
      totalOverdue,
      averageOccupancy: totalSlips > 0 ? (occupiedSlips / totalSlips) * 100 : 0,
    };
  }, [marinaSummaries]);

  const occupancyChartData = marinaSummaries.map(m => ({
    name: m.marina.name.length > 15 ? m.marina.name.substring(0, 15) + '...' : m.marina.name,
    occupancy: Math.round(m.occupancyRate),
    target: 85,
  }));

  const revenueChartData = marinaSummaries.map(m => ({
    name: m.marina.name.length > 15 ? m.marina.name.substring(0, 15) + '...' : m.marina.name,
    revenue: m.monthlyRevenue,
    overdue: m.overdueAmount,
  }));

  const slipDistributionData = marinaSummaries.map((m, i) => ({
    name: m.marina.name,
    value: m.slipCount,
    fill: COLORS[i % COLORS.length],
  }));

  const isLoading = orgsLoading || marinasLoading || slipsLoading;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <TopBar />
        
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Portfolio Dashboard</h1>
              <p className="text-muted-foreground">Multi-marina performance overview and analytics</p>
            </div>

            <div className="flex gap-3">
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger className="w-[180px]" data-testid="select-organization">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMarinaId} onValueChange={setSelectedMarinaId}>
                <SelectTrigger className="w-[180px]" data-testid="select-marina">
                  <Anchor className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Marina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Marinas</SelectItem>
                  {filteredMarinas.map(marina => (
                    <SelectItem key={marina.id} value={marina.id}>{marina.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Marinas</p>
                      <p className="text-3xl font-bold text-foreground" data-testid="stat-total-marinas">
                        {portfolioStats.totalMarinas}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Anchor className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Slips</p>
                      <p className="text-3xl font-bold text-foreground" data-testid="stat-total-slips">
                        {portfolioStats.occupiedSlips}/{portfolioStats.totalSlips}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {portfolioStats.averageOccupancy.toFixed(1)}% occupancy
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Target className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                      <p className="text-3xl font-bold text-foreground" data-testid="stat-monthly-revenue">
                        ${portfolioStats.totalMonthlyRevenue.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Overdue Balance</p>
                      <p className="text-3xl font-bold text-destructive" data-testid="stat-overdue">
                        ${portfolioStats.totalOverdue.toLocaleString()}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-red-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="occupancy" data-testid="tab-occupancy">Occupancy</TabsTrigger>
              <TabsTrigger value="financials" data-testid="tab-financials">Financials</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Occupancy by Marina
                    </CardTitle>
                    <CardDescription>Current occupancy rates vs 85% target</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {marinaSummaries.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={occupancyChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                          <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                          />
                          <Bar dataKey="occupancy" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Occupancy %" />
                          <Line type="monotone" dataKey="target" stroke="#10b981" strokeDasharray="5 5" name="Target" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No marina data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Revenue by Marina
                    </CardTitle>
                    <CardDescription>Monthly revenue and outstanding balances</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {marinaSummaries.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                          <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                          />
                          <Legend />
                          <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
                          <Bar dataKey="overdue" fill="#ef4444" radius={[4, 4, 0, 0]} name="Overdue" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No revenue data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Marina Performance Summary</CardTitle>
                  <CardDescription>Comparative view of all marinas in portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : marinaSummaries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No marinas found. Add marinas to see portfolio performance.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {marinaSummaries.map((summary) => (
                        <div 
                          key={summary.marina.id} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                          data-testid={`marina-summary-${summary.marina.id}`}
                        >
                          <div className="flex items-center gap-4 mb-4 sm:mb-0">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Anchor className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{summary.marina.name}</h3>
                              <p className="text-sm text-muted-foreground">{summary.marina.location}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
                            <div className="text-center sm:text-right">
                              <p className="text-sm text-muted-foreground">Slips</p>
                              <p className="font-semibold">{summary.occupiedSlips}/{summary.slipCount}</p>
                            </div>
                            <div className="text-center sm:text-right">
                              <p className="text-sm text-muted-foreground">Occupancy</p>
                              <div className="flex items-center justify-center sm:justify-end gap-2">
                                <Progress value={summary.occupancyRate} className="w-16 h-2" />
                                <span className="font-semibold">{summary.occupancyRate.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="text-center sm:text-right">
                              <p className="text-sm text-muted-foreground">Revenue</p>
                              <p className="font-semibold text-green-600">${summary.monthlyRevenue.toLocaleString()}</p>
                            </div>
                            <div className="text-center sm:text-right">
                              <p className="text-sm text-muted-foreground">Overdue</p>
                              <p className={`font-semibold ${summary.overdueAmount > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                ${summary.overdueAmount.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="occupancy" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Occupancy Trends</CardTitle>
                    <CardDescription>Portfolio-wide occupancy performance</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={occupancyChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="occupancy" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                          {occupancyChartData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.occupancy >= 85 ? '#10b981' : entry.occupancy >= 70 ? '#f59e0b' : '#ef4444'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Slip Distribution</CardTitle>
                    <CardDescription>Total slips by marina</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={slipDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value }) => `${name.substring(0, 10)}: ${value}`}
                        >
                          {slipDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Occupancy Status by Marina</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {marinaSummaries.map((summary) => (
                      <div 
                        key={summary.marina.id}
                        className="p-4 rounded-lg border"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium">{summary.marina.name}</h4>
                          <Badge 
                            variant={summary.occupancyRate >= 85 ? "default" : summary.occupancyRate >= 70 ? "secondary" : "destructive"}
                          >
                            {summary.occupancyRate.toFixed(0)}%
                          </Badge>
                        </div>
                        <Progress value={summary.occupancyRate} className="h-2 mb-2" />
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{summary.occupiedSlips} occupied</span>
                          <span>{summary.slipCount - summary.occupiedSlips} available</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financials" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Portfolio Revenue (MTD)</p>
                        <p className="text-2xl font-bold">${portfolioStats.totalMonthlyRevenue.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Overdue</p>
                        <p className="text-2xl font-bold text-destructive">${portfolioStats.totalOverdue.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Revenue/Slip</p>
                        <p className="text-2xl font-bold">
                          ${portfolioStats.occupiedSlips > 0 
                            ? Math.round(portfolioStats.totalMonthlyRevenue / portfolioStats.occupiedSlips).toLocaleString()
                            : 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Comparison</CardTitle>
                  <CardDescription>Monthly revenue by marina with outstanding balances</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Legend />
                      <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} name="Revenue" />
                      <Bar dataKey="overdue" fill="#ef4444" radius={[0, 4, 4, 0]} name="Overdue" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Financial Summary by Marina</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">Marina</th>
                          <th className="text-right py-3 px-4 font-medium">Slips</th>
                          <th className="text-right py-3 px-4 font-medium">Occupancy</th>
                          <th className="text-right py-3 px-4 font-medium">Revenue (MTD)</th>
                          <th className="text-right py-3 px-4 font-medium">Overdue</th>
                          <th className="text-right py-3 px-4 font-medium">Rev/Slip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marinaSummaries.map((summary) => (
                          <tr key={summary.marina.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">
                              <div className="font-medium">{summary.marina.name}</div>
                              <div className="text-sm text-muted-foreground">{summary.marina.location}</div>
                            </td>
                            <td className="text-right py-3 px-4">{summary.occupiedSlips}/{summary.slipCount}</td>
                            <td className="text-right py-3 px-4">
                              <Badge 
                                variant={summary.occupancyRate >= 85 ? "default" : summary.occupancyRate >= 70 ? "secondary" : "destructive"}
                              >
                                {summary.occupancyRate.toFixed(0)}%
                              </Badge>
                            </td>
                            <td className="text-right py-3 px-4 text-green-600 font-medium">
                              ${summary.monthlyRevenue.toLocaleString()}
                            </td>
                            <td className={`text-right py-3 px-4 font-medium ${summary.overdueAmount > 0 ? 'text-red-600' : ''}`}>
                              ${summary.overdueAmount.toLocaleString()}
                            </td>
                            <td className="text-right py-3 px-4">
                              ${summary.occupiedSlips > 0 
                                ? Math.round(summary.monthlyRevenue / summary.occupiedSlips).toLocaleString()
                                : 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/50 font-medium">
                          <td className="py-3 px-4">Portfolio Total</td>
                          <td className="text-right py-3 px-4">{portfolioStats.occupiedSlips}/{portfolioStats.totalSlips}</td>
                          <td className="text-right py-3 px-4">
                            <Badge>{portfolioStats.averageOccupancy.toFixed(0)}%</Badge>
                          </td>
                          <td className="text-right py-3 px-4 text-green-600">
                            ${portfolioStats.totalMonthlyRevenue.toLocaleString()}
                          </td>
                          <td className={`text-right py-3 px-4 ${portfolioStats.totalOverdue > 0 ? 'text-red-600' : ''}`}>
                            ${portfolioStats.totalOverdue.toLocaleString()}
                          </td>
                          <td className="text-right py-3 px-4">
                            ${portfolioStats.occupiedSlips > 0 
                              ? Math.round(portfolioStats.totalMonthlyRevenue / portfolioStats.occupiedSlips).toLocaleString()
                              : 0}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
