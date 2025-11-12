import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

type SalesComp = {
  id: string;
  marinaName: string;
  city: string;
  state: string;
  yearSold: number | null;
  salePrice: number | null;
  status: string;
};

type ChartData = {
  year: string;
  avgPrice: number;
  count: number;
};

export default function MarketTrendsChart() {
  const { data: comps, isLoading } = useQuery<SalesComp[]>({
    queryKey: ['/api/sales-comps'],
  });

  const filteredComps = comps?.filter(c => 
    c.yearSold && c.yearSold >= 2018 && c.salePrice && c.salePrice > 0
  ) || [];

  const dataByYear = filteredComps.reduce((acc, comp) => {
    const year = comp.yearSold!.toString();
    if (!acc[year]) {
      acc[year] = { totalPrice: 0, count: 0 };
    }
    acc[year].totalPrice += comp.salePrice!;
    acc[year].count += 1;
    return acc;
  }, {} as Record<string, { totalPrice: number; count: number }>);

  const chartData: ChartData[] = Object.entries(dataByYear)
    .map(([year, data]) => ({
      year,
      avgPrice: Math.round(data.totalPrice / data.count / 1000000), // In millions
      count: data.count,
    }))
    .sort((a, b) => parseInt(a.year) - parseInt(b.year));

  if (isLoading) {
    return (
      <Card data-testid="widget-market-trends">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Market Trends
          </CardTitle>
          <CardDescription className="text-xs">Average sale prices over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-100 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card data-testid="widget-market-trends">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Market Trends
          </CardTitle>
          <CardDescription className="text-xs">Average sale prices over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500 text-sm">
            No market data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-market-trends">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Market Trends
        </CardTitle>
        <CardDescription className="text-xs">Average sale prices over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="year" 
              tick={{ fontSize: 12 }}
              stroke="#888"
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke="#888"
              label={{ value: 'Avg Price ($M)', angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <Tooltip 
              contentStyle={{ fontSize: 12 }}
              formatter={(value: number, name: string) => {
                if (name === 'avgPrice') return [`$${value}M`, 'Avg Price'];
                return [value, 'Sales Count'];
              }}
            />
            <Line 
              type="monotone" 
              dataKey="avgPrice" 
              stroke="#2563eb" 
              strokeWidth={2}
              dot={{ fill: '#2563eb', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-2 text-xs text-gray-500 text-center">
          Based on {filteredComps.length} sales comps since 2018
        </div>
      </CardContent>
    </Card>
  );
}
