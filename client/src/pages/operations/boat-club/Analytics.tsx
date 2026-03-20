import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  DollarSign,
  TrendingDown,
  BarChart3,
} from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// Sample data
const membershipGrowthData = [
  { month: 'Jan', members: 145, newMembers: 8, churned: 3 },
  { month: 'Feb', members: 150, newMembers: 10, churned: 5 },
  { month: 'Mar', members: 162, newMembers: 18, churned: 6 },
  { month: 'Apr', members: 178, newMembers: 22, churned: 6 },
  { month: 'May', members: 198, newMembers: 25, churned: 5 },
  { month: 'Jun', members: 220, newMembers: 28, churned: 6 },
  { month: 'Jul', members: 235, newMembers: 22, churned: 7 },
  { month: 'Aug', members: 240, newMembers: 12, churned: 7 },
  { month: 'Sep', members: 235, newMembers: 5, churned: 10 },
  { month: 'Oct', members: 225, newMembers: 4, churned: 14 },
  { month: 'Nov', members: 218, newMembers: 3, churned: 10 },
  { month: 'Dec', members: 215, newMembers: 5, churned: 8 },
];

const churnRateData = [
  { month: 'Jan', churnRate: 2.1 },
  { month: 'Feb', churnRate: 3.3 },
  { month: 'Mar', churnRate: 3.7 },
  { month: 'Apr', churnRate: 3.4 },
  { month: 'May', churnRate: 2.5 },
  { month: 'Jun', churnRate: 2.7 },
  { month: 'Jul', churnRate: 3.0 },
  { month: 'Aug', churnRate: 2.9 },
  { month: 'Sep', churnRate: 4.3 },
  { month: 'Oct', churnRate: 6.2 },
  { month: 'Nov', churnRate: 4.6 },
  { month: 'Dec', churnRate: 3.7 },
];

const utilizationByBoat = [
  { boat: 'Pontoon 1', utilization: 82 },
  { boat: 'Pontoon 2', utilization: 75 },
  { boat: 'Center Console 1', utilization: 90 },
  { boat: 'Center Console 2', utilization: 85 },
  { boat: 'Bowrider 1', utilization: 78 },
  { boat: 'Bowrider 2', utilization: 65 },
  { boat: 'Cruiser 1', utilization: 55 },
  { boat: 'Fishing Boat 1', utilization: 88 },
];

const tierData = [
  { name: 'Gold', members: 85, revenue: 340000, color: '#f59e0b' },
  { name: 'Silver', members: 65, revenue: 195000, color: '#94a3b8' },
  { name: 'Platinum', members: 35, revenue: 210000, color: '#8b5cf6' },
  { name: 'Basic', members: 30, revenue: 60000, color: '#3b82f6' },
];

const COLORS = ['#f59e0b', '#94a3b8', '#8b5cf6', '#3b82f6'];

export default function BoatClubAnalytics() {
  const totalMembers = 215;
  const avgRevenuePerMember = 3750;
  const avgChurnRate = churnRateData.reduce((s, d) => s + d.churnRate, 0) / churnRateData.length;
  const avgUtilization = utilizationByBoat.reduce((s, d) => s + d.utilization, 0) / utilizationByBoat.length;

  return (
    <div className="space-y-6 p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Active Members</div>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{totalMembers}</div>
            <div className="text-xs text-green-600 mt-1">+48% vs Jan start</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Revenue / Member</div>
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{fmt.format(avgRevenuePerMember)}</div>
            <div className="text-xs text-muted-foreground mt-1">Annual average</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Avg Monthly Churn</div>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{avgChurnRate.toFixed(1)}%</div>
            <div className="text-xs text-amber-600 mt-1">Target: &lt;3.0%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Avg Utilization</div>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{avgUtilization.toFixed(0)}%</div>
            <div className="text-xs text-green-600 mt-1">Above 70% target</div>
          </CardContent>
        </Card>
      </div>

      {/* Membership Growth Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Membership Growth</CardTitle>
          <CardDescription>Active member count and new member acquisition</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={membershipGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="members"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  name="Active Members"
                />
                <Area
                  type="monotone"
                  dataKey="newMembers"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  name="New Members"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Churn Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Churn Rate Trend</CardTitle>
            <CardDescription>Monthly membership cancellation rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={churnRateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Line
                    type="monotone"
                    dataKey="churnRate"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Churn Rate"
                    dot={{ fill: '#ef4444' }}
                  />
                  {/* Target line */}
                  <Line
                    type="monotone"
                    dataKey={() => 3.0}
                    stroke="#94a3b8"
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    name="Target (3%)"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Membership Tier Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Membership Tier Breakdown</CardTitle>
            <CardDescription>Distribution of members by plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center">
              <div className="w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tierData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="members"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {tierData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-3">
                {tierData.map((tier) => (
                  <div key={tier.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }} />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{tier.name}</div>
                      <div className="text-xs text-muted-foreground">{tier.members} members</div>
                    </div>
                    <div className="text-sm font-medium">{fmt.format(tier.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Utilization by Boat */}
      <Card>
        <CardHeader>
          <CardTitle>Utilization by Boat</CardTitle>
          <CardDescription>Fleet utilization percentage over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilizationByBoat} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="boat" width={120} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Bar dataKey="utilization" name="Utilization %" radius={[0, 4, 4, 0]}>
                  {utilizationByBoat.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.utilization > 80 ? '#10b981' : entry.utilization > 60 ? '#f59e0b' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
