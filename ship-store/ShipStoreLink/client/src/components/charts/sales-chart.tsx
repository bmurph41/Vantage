import { useQuery } from "@tanstack/react-query";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export default function SalesChart() {
  const { data: salesData, isLoading } = useQuery({
    queryKey: ["/api/dashboard/sales-data", "7"],
  });

  if (isLoading) {
    return (
      <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center animate-pulse">
        <div className="text-muted-foreground">Loading sales data...</div>
      </div>
    );
  }

  if (!salesData || salesData.length === 0) {
    return (
      <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <i className="fas fa-chart-line text-4xl mb-4"></i>
          <p>No sales data available</p>
        </div>
      </div>
    );
  }

  // Transform the data for the chart
  const chartData = salesData.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    sales: Number(item.sales),
  }));

  return (
    <div className="h-64" data-testid="sales-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={{ stroke: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip 
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Sales']}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            contentStyle={{ 
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="sales" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
            name="Daily Sales"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
