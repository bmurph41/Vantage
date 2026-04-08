import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Clock,
  Percent,
  ShoppingBag,
} from 'lucide-react';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// Sample data
const salesVolumeData = [
  { month: 'Jan', units: 8, revenue: 320000 },
  { month: 'Feb', units: 12, revenue: 480000 },
  { month: 'Mar', units: 18, revenue: 720000 },
  { month: 'Apr', units: 25, revenue: 1100000 },
  { month: 'May', units: 32, revenue: 1600000 },
  { month: 'Jun', units: 35, revenue: 1750000 },
  { month: 'Jul', units: 30, revenue: 1500000 },
  { month: 'Aug', units: 28, revenue: 1400000 },
  { month: 'Sep', units: 22, revenue: 1100000 },
  { month: 'Oct', units: 15, revenue: 600000 },
  { month: 'Nov', units: 10, revenue: 400000 },
  { month: 'Dec', units: 6, revenue: 240000 },
];

const revenueByType = [
  { type: 'Center Console', revenue: 3200000, units: 45, avgPrice: 71111 },
  { type: 'Pontoon', revenue: 2100000, units: 60, avgPrice: 35000 },
  { type: 'Bowrider', revenue: 1800000, units: 40, avgPrice: 45000 },
  { type: 'Cruiser', revenue: 1500000, units: 12, avgPrice: 125000 },
  { type: 'Fishing', revenue: 1200000, units: 30, avgPrice: 40000 },
  { type: 'Sailboat', revenue: 600000, units: 8, avgPrice: 75000 },
];

const marginTrendData = [
  { month: 'Jan', grossMargin: 18.5, netMargin: 8.2 },
  { month: 'Feb', grossMargin: 19.2, netMargin: 9.1 },
  { month: 'Mar', grossMargin: 20.1, netMargin: 10.5 },
  { month: 'Apr', grossMargin: 22.3, netMargin: 12.1 },
  { month: 'May', grossMargin: 21.8, netMargin: 11.8 },
  { month: 'Jun', grossMargin: 20.5, netMargin: 10.2 },
  { month: 'Jul', grossMargin: 19.8, netMargin: 9.5 },
  { month: 'Aug', grossMargin: 20.2, netMargin: 10.0 },
  { month: 'Sep', grossMargin: 21.0, netMargin: 11.2 },
  { month: 'Oct', grossMargin: 19.5, netMargin: 9.8 },
  { month: 'Nov', grossMargin: 18.8, netMargin: 8.5 },
  { month: 'Dec', grossMargin: 17.5, netMargin: 7.2 },
];

const topModels = [
  { model: 'Boston Whaler 230 Outrage', units: 18, revenue: 1620000, margin: 22.5, avgDaysOnLot: 28 },
  { model: 'Bennington 23 SSRX', units: 15, revenue: 675000, margin: 19.8, avgDaysOnLot: 35 },
  { model: 'Sea Ray 320 Sundancer', units: 8, revenue: 1200000, margin: 24.1, avgDaysOnLot: 45 },
  { model: 'Grady-White 271 Canyon', units: 12, revenue: 960000, margin: 21.3, avgDaysOnLot: 32 },
  { model: 'Yamaha 252SD', units: 20, revenue: 800000, margin: 18.5, avgDaysOnLot: 22 },
];

export default function BoatSalesAnalytics() {
  const totalUnits = salesVolumeData.reduce((s, d) => s + d.units, 0);
  const totalRevenue = salesVolumeData.reduce((s, d) => s + d.revenue, 0);
  const avgDaysOnLot = 34;
  const avgMargin = marginTrendData.reduce((s, d) => s + d.grossMargin, 0) / marginTrendData.length;

  return (
    <div className="space-y-6 p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Units Sold (YTD)</div>
              <ShoppingBag className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{totalUnits}</div>
            <div className="text-xs text-green-600 mt-1">+12% vs prior year</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Revenue (YTD)</div>
              <DollarSign className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{fmt.format(totalRevenue)}</div>
            <div className="text-xs text-green-600 mt-1">+8% vs prior year</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Avg Days on Lot</div>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{avgDaysOnLot}</div>
            <div className="text-xs text-green-600 mt-1">-5 days vs prior year</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Avg Gross Margin</div>
              <Percent className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{avgMargin.toFixed(1)}%</div>
            <div className="text-xs text-green-600 mt-1">+1.2% vs prior year</div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Volume Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Volume Trend</CardTitle>
          <CardDescription>Monthly unit sales and revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesVolumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(value: number, name: string) =>
                  name === 'revenue' ? fmt.format(value) : value
                } />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="units" stroke="#3b82f6" strokeWidth={2} name="Units Sold" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Revenue by Boat Type */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Boat Type</CardTitle>
            <CardDescription>Breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                  <YAxis type="category" dataKey="type" width={110} />
                  <Tooltip formatter={(value: number) => fmt.format(value)} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Margin Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Margin Analysis</CardTitle>
            <CardDescription>Gross profit % trend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={marginTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="grossMargin" stroke="#8b5cf6" strokeWidth={2} name="Gross Margin" />
                  <Line type="monotone" dataKey="netMargin" stroke="#06b6d4" strokeWidth={2} name="Net Margin" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Models */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Models</CardTitle>
          <CardDescription>Best sellers by unit volume and revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Units Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                <TableHead className="text-right">Avg Days on Lot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topModels.map((model, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{model.model}</TableCell>
                  <TableCell className="text-right">{model.units}</TableCell>
                  <TableCell className="text-right">{fmt.format(model.revenue)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={model.margin > 20 ? 'default' : 'secondary'}>
                      {model.margin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{model.avgDaysOnLot} days</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
