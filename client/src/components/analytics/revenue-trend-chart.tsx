import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, RefreshCw, AlertCircle } from "lucide-react";
import { useState } from "react";

interface RevenueTrendData {
  month: string;
  revenue: number;
  deals: number;
}

interface RevenueTrendChartProps {
  dateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export default function RevenueTrendChart({ dateRange }: RevenueTrendChartProps) {
  const { toast } = useToast();
  const [period, setPeriod] = useState("6months");

  const { data: trendData = [], isLoading, error, refetch } = useQuery<RevenueTrendData[]>({
    queryKey: ['/api/analytics/revenue-trend', { period, dateRange }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', period);
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/analytics/revenue-trend?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch revenue trend data: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  // Handle errors with toast
  if (error && !isLoading) {
    toast({
      title: "Failed to load revenue trend",
      description: error instanceof Error ? error.message : "Please try again later.",
      variant: "destructive",
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 animate-pulse">
            <div className="flex justify-end mb-4">
              <div className="h-8 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="h-64 bg-gray-50 rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 flex items-end justify-around p-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-gray-200 rounded-t" style={{ 
                    height: `${Math.random() * 60 + 20}%`, 
                    width: '12%',
                    animationDelay: `${i * 0.1}s`
                  }}></div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-300"></div>
              <div className="absolute bottom-0 left-0 top-0 w-px bg-gray-300"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Revenue Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-900 font-medium mb-2">Failed to load revenue trend</p>
              <p className="text-gray-500 text-sm mb-4">
                {error instanceof Error ? error.message : "Something went wrong"}
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Revenue Trend
        </CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6months">6 Months</SelectItem>
            <SelectItem value="12months">12 Months</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
