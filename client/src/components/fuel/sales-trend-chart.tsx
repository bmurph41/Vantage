import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState } from "react";

interface SalesTrendChartProps {
  data: Array<{
    date: string;
    revenue: string;
    gallons: string;
  }>;
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const [timeRange, setTimeRange] = useState("30");

  const chartData = data.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: parseFloat(item.revenue),
    gallons: parseFloat(item.gallons),
  }));

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle data-testid="chart-title-sales-trend">Sales Trend</CardTitle>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40" data-testid="select-time-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="chart-container" style={{ width: '100%', height: '300px' }} data-testid="sales-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="revenue"
                orientation="left"
                className="text-xs"
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="gallons"
                orientation="right"
                className="text-xs"
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value, name) => [
                  `${name === 'revenue' ? '$' : ''}${Number(value).toLocaleString()}${name === 'gallons' ? ' gal' : ''}`,
                  name === 'revenue' ? 'Revenue' : 'Gallons'
                ]}
              />
              <Legend />
              <Line 
                yAxisId="revenue"
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                name="Revenue"
              />
              <Line 
                yAxisId="gallons"
                type="monotone" 
                dataKey="gallons" 
                stroke="hsl(var(--accent))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--accent))', r: 4 }}
                name="Gallons"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
