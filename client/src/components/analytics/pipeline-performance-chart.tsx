import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, RefreshCw, AlertCircle } from "lucide-react";

interface PipelineData {
  name: string;
  count: number;
  value: number;
}

interface PipelinePerformanceChartProps {
  dateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export default function PipelinePerformanceChart({ dateRange }: PipelinePerformanceChartProps) {
  const { toast } = useToast();
  const { data: pipelineData = [], isLoading, error, refetch } = useQuery<PipelineData[]>({
    queryKey: ['/api/analytics/pipeline-performance', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/analytics/pipeline-performance?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch pipeline performance data: ${response.status} ${response.statusText}`);
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
      title: "Failed to load pipeline performance",
      description: error instanceof Error ? error.message : "Please try again later.",
      variant: "destructive",
    });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Pipeline Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 animate-pulse">
            <div className="h-64 bg-gray-50 rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 flex items-end justify-around p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-gray-200 rounded-t" style={{ 
                    height: `${Math.random() * 70 + 15}%`, 
                    width: '15%',
                    animationDelay: `${i * 0.15}s`
                  }}></div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-300"></div>
              <div className="absolute bottom-0 left-0 top-0 w-px bg-gray-300"></div>
            </div>
            <div className="mt-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-3 bg-gray-200 rounded w-20" style={{ animationDelay: `${i * 0.1}s` }}></div>
              ))}
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
            <BarChart3 className="w-5 h-5" />
            Pipeline Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-900 font-medium mb-2">Failed to load pipeline data</p>
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Pipeline Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === 'count' ? value : `$${value.toLocaleString()}`,
                  name === 'count' ? 'Deals' : 'Value'
                ]}
                labelStyle={{ color: '#374151' }}
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="count" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
                name="count"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
