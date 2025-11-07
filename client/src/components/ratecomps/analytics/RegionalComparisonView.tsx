import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MapPin, DollarSign, TrendingUp } from "lucide-react";

interface MetricResult {
  metric: string;
  value: number;
  sampleSize: number;
  groupValue?: string;
}

interface RegionalComparisonViewProps {
  byState?: Record<string, MetricResult[]>;
  byWaterType?: Record<string, MetricResult[]>;
  isLoading?: boolean;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
];

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export default function RegionalComparisonView({ byState, byWaterType, isLoading }: RegionalComparisonViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-muted rounded w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-80 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stateData = byState ? Object.entries(byState).map(([state, metrics]) => ({
    state,
    count: metrics.find(m => m.metric === 'count')?.value || 0,
    avgPrice: metrics.find(m => m.metric === 'avgPrice')?.value || 0,
    medianPrice: metrics.find(m => m.metric === 'medianPrice')?.value || 0,
    avgPricePerSlip: metrics.find(m => m.metric === 'avgPricePerSlip')?.value || 0,
    avgCapRate: metrics.find(m => m.metric === 'avgCapRate')?.value || 0,
  })).sort((a, b) => b.avgPrice - a.avgPrice).slice(0, 15) : [];

  const waterTypeData = byWaterType ? Object.entries(byWaterType).map(([type, metrics]) => ({
    type,
    count: metrics.find(m => m.metric === 'count')?.value || 0,
    avgPrice: metrics.find(m => m.metric === 'avgPrice')?.value || 0,
    avgPricePerSlip: metrics.find(m => m.metric === 'avgPricePerSlip')?.value || 0,
    avgCapRate: metrics.find(m => m.metric === 'avgCapRate')?.value || 0,
  })).sort((a, b) => b.count - a.count) : [];

  const stateDistribution = stateData.map((item, index) => ({
    name: item.state,
    value: item.count,
    fill: COLORS[index % COLORS.length]
  }));

  return (
    <div className="space-y-6" data-testid="regional-comparison-view">
      {/* States - Average Price Comparison */}
      {stateData.length > 0 && (
        <Card className="border-border/40" data-testid="card-state-avg-price">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Average Price by State (Top 15)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={stateData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number"
                  className="text-xs"
                  stroke="currentColor"
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <YAxis 
                  type="category"
                  dataKey="state"
                  className="text-xs"
                  stroke="currentColor"
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'avgPrice') return [formatCurrency(value), 'Avg Price'];
                    if (name === 'medianPrice') return [formatCurrency(value), 'Median Price'];
                    if (name === 'count') return [value, 'Count'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar dataKey="avgPrice" fill="hsl(var(--primary))" name="Avg Price" radius={[0, 4, 4, 0]} />
                <Bar dataKey="medianPrice" fill="hsl(var(--chart-2))" name="Median Price" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* States - Transaction Count Distribution */}
      {stateDistribution.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/40" data-testid="card-state-distribution">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Transaction Distribution by State
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stateDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stateDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/40" data-testid="card-price-per-slip-state">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Price Per Slip by State
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stateData.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number"
                    className="text-xs"
                    stroke="currentColor"
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <YAxis 
                    type="category"
                    dataKey="state"
                    className="text-xs"
                    stroke="currentColor"
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: any) => [formatCurrency(value), 'Avg Price/Slip']}
                  />
                  <Bar 
                    dataKey="avgPricePerSlip" 
                    fill="hsl(var(--chart-3))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Water Type Comparison */}
      {waterTypeData.length > 0 && (
        <Card className="border-border/40" data-testid="card-water-type-comparison">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Comparison by Water Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={waterTypeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="type"
                  className="text-xs"
                  stroke="currentColor"
                />
                <YAxis 
                  className="text-xs"
                  stroke="currentColor"
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'avgPrice') return [formatCurrency(value), 'Avg Price'];
                    if (name === 'avgPricePerSlip') return [formatCurrency(value), 'Avg Price/Slip'];
                    if (name === 'count') return [value, 'Count'];
                    return [value, name];
                  }}
                />
                <Legend />
                <Bar dataKey="avgPrice" fill="hsl(var(--primary))" name="Avg Price" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgPricePerSlip" fill="hsl(var(--chart-2))" name="Avg Price/Slip" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
