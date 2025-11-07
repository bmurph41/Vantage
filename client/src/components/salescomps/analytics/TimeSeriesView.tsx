import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Percent } from "lucide-react";

interface TimeSeriesData {
  year: number;
  avgPrice: number;
  count: number;
}

interface CapRateData {
  year: number;
  avgCapRate: number;
  count: number;
}

interface TimeSeriesViewProps {
  priceOverTime: TimeSeriesData[];
  capRateOverTime: CapRateData[];
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return `$${(value / 1000000).toFixed(2)}M`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function calculateGrowthRate(data: TimeSeriesData[]): string {
  if (data.length < 2) return 'N/A';
  const sorted = [...data].sort((a, b) => a.year - b.year);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const cagr = Math.pow(last.avgPrice / first.avgPrice, 1 / (last.year - first.year)) - 1;
  return `${(cagr * 100).toFixed(2)}%`;
}

export default function TimeSeriesView({ priceOverTime, capRateOverTime, isLoading }: TimeSeriesViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-muted rounded w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const sortedPriceData = [...priceOverTime].sort((a, b) => a.year - b.year);
  const sortedCapRateData = [...capRateOverTime].sort((a, b) => a.year - b.year);

  const priceDataWithGrowth = sortedPriceData.map((item, index) => {
    if (index === 0) return { ...item, yoyGrowth: 0 };
    const prev = sortedPriceData[index - 1];
    const growth = ((item.avgPrice - prev.avgPrice) / prev.avgPrice) * 100;
    return { ...item, yoyGrowth: growth };
  });

  const cagr = calculateGrowthRate(sortedPriceData);

  return (
    <div className="space-y-6" data-testid="time-series-view">
      {/* Price Trend */}
      <Card className="border-border/40" data-testid="card-price-trend">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Average Sale Price Over Time
            </CardTitle>
            <div className="text-sm text-muted-foreground" data-testid="text-cagr">
              CAGR: <span className="font-semibold text-foreground">{cagr}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={sortedPriceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="year" 
                className="text-xs"
                stroke="currentColor"
              />
              <YAxis 
                className="text-xs"
                stroke="currentColor"
                tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'avgPrice') return [formatCurrency(value), 'Avg Price'];
                  return [value, 'Count'];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgPrice"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Avg Price"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                name="Transaction Count"
                dot={{ r: 3 }}
                yAxisId="right"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Year-over-Year Growth */}
      <Card className="border-border/40" data-testid="card-yoy-growth">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Year-over-Year Price Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priceDataWithGrowth.slice(1)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="year" 
                className="text-xs"
                stroke="currentColor"
              />
              <YAxis 
                className="text-xs"
                stroke="currentColor"
                tickFormatter={(value) => `${value.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                formatter={(value: any) => [`${value.toFixed(2)}%`, 'YoY Growth']}
              />
              <Bar
                dataKey="yoyGrowth"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cap Rate Trend */}
      {sortedCapRateData.length > 0 && sortedCapRateData.some(d => d.avgCapRate > 0) && (
        <Card className="border-border/40" data-testid="card-cap-rate-trend">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Average Cap Rate Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={sortedCapRateData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="year" 
                  className="text-xs"
                  stroke="currentColor"
                />
                <YAxis 
                  className="text-xs"
                  stroke="currentColor"
                  tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'avgCapRate') return [formatPercent(value), 'Avg Cap Rate'];
                    return [value, 'Count'];
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgCapRate"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  name="Avg Cap Rate"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
