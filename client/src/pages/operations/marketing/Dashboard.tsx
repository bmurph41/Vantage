import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Target, Activity } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function MarketingDashboard() {
  const { data: campaigns = [] } = useQuery({ queryKey: ['/api/marketing/campaigns'] });
  const { data: expenses = [] } = useQuery({ queryKey: ['/api/marketing/expenses'] });
  const { data: attribution = [] } = useQuery({ queryKey: ['/api/marketing/attribution'] });

  const totalSpend = expenses.reduce((sum: number, exp: any) => sum + parseFloat(exp.amount || 0), 0);
  const activeCampaigns = campaigns.filter((c: any) => c.status === 'active').length;
  const leadsGenerated = attribution.length;
  
  const totalRevenue = attribution.reduce((sum: number, attr: any) => sum + parseFloat(attr.revenue || 0), 0);
  const roas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0;

  const spendByChannel = campaigns.reduce((acc: any, campaign: any) => {
    const channel = campaign.channel || 'other';
    const budgetActual = parseFloat(campaign.budgetActual || 0);
    if (!acc[channel]) acc[channel] = 0;
    acc[channel] += budgetActual;
    return acc;
  }, {});

  const channelData = Object.entries(spendByChannel).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    value
  }));

  const monthlySpend = expenses.reduce((acc: any, expense: any) => {
    const month = expense.date ? new Date(expense.date).toLocaleDateString('en-US', { month: 'short' }) : 'Unknown';
    if (!acc[month]) acc[month] = 0;
    acc[month] += parseFloat(expense.amount || 0);
    return acc;
  }, {});

  const spendTrendData = Object.entries(monthlySpend).map(([month, amount]) => ({
    month,
    amount
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" data-testid="page-title">Marketing Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-spend">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-total-spend">
              ${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              From {expenses.length} expenses
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-leads-generated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Generated</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-leads-generated">{leadsGenerated}</div>
            <p className="text-xs text-muted-foreground">
              Across all campaigns
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-roas">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROAS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-roas">
              {roas.toFixed(2)}x
            </div>
            <p className="text-xs text-muted-foreground">
              Return on Ad Spend
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-campaigns">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-active-campaigns">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              Out of {campaigns.length} total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-spend-trend">
          <CardHeader>
            <CardTitle>Spend Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {spendTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={spendTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No expense data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-spend-by-channel">
          <CardHeader>
            <CardTitle>Spend by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No campaign data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
