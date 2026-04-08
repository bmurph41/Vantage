import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { 
  TrendingUp, 
  Brain, 
  Calendar, 
  Target,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  Activity,
  BarChart3,
  Zap
} from "lucide-react";
import { useState } from "react";

interface PredictiveData {
  revenue: {
    forecast: number;
    confidence: number;
    trend: 'up' | 'down' | 'stable';
    scenarios: {
      optimistic: number;
      realistic: number;
      pessimistic: number;
    };
  };
  deals: {
    expectedClosures: number;
    pipelineValue: number;
    conversionRate: number;
    confidence: number;
  };
  chartData: {
    month: string;
    actual?: number;
    predicted: number;
    optimistic: number;
    pessimistic: number;
  }[];
  insights: {
    message: string;
    type: 'positive' | 'negative' | 'neutral';
    confidence: number;
  }[];
  lastUpdated: string;
}

const trendColors = {
  up: 'text-green-600',
  down: 'text-red-600',
  stable: 'text-gray-600'
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Activity
};

const insightTypeColors = {
  positive: 'bg-green-50 border-green-200 text-green-800',
  negative: 'bg-red-50 border-red-200 text-red-800',
  neutral: 'bg-blue-50 border-blue-200 text-blue-800'
};

export default function PredictiveAnalyticsWidget() {
  const [timeHorizon, setTimeHorizon] = useState('6_months');
  
  const { data: predictiveData, isLoading } = useQuery<PredictiveData>({
    queryKey: ['/api/predictive-analytics', timeHorizon],
    refetchInterval: 600000, // Refresh every 10 minutes
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full" data-testid="predictive-analytics-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Predictive Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
            <div className="h-40 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!predictiveData) {
    return (
      <Card className="h-full" data-testid="predictive-analytics-widget">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Predictive Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Insufficient data for predictions</p>
            <p className="text-sm">More data needed to generate accurate forecasts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trendIcons[predictiveData.revenue.trend];

  return (
    <Card className="h-full" data-testid="predictive-analytics-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Predictive Analytics
            <Badge variant="outline" className="ml-2">
              {formatPercentage(predictiveData.revenue.confidence)} confidence
            </Badge>
          </CardTitle>
          <Select value={timeHorizon} onValueChange={setTimeHorizon}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3_months">3 Months</SelectItem>
              <SelectItem value="6_months">6 Months</SelectItem>
              <SelectItem value="12_months">12 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="text-center">
            <div className={`text-lg font-bold ${trendColors[predictiveData.revenue.trend]} flex items-center justify-center gap-1`}>
              <TrendIcon className="w-4 h-4" />
              {formatCurrency(predictiveData.revenue.forecast)}
            </div>
            <div className="text-xs text-gray-500">Revenue Forecast</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">
              {predictiveData.deals.expectedClosures}
            </div>
            <div className="text-xs text-gray-500">Expected Deals</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <Tabs defaultValue="forecast" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          
          <TabsContent value="forecast" className="mt-4">
            <div className="space-y-4">
              {/* Chart */}
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={predictiveData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      axisLine={false}
                      tickFormatter={(value) => `$${(value / 1000)}k`}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        formatCurrency(value), 
                        name.charAt(0).toUpperCase() + name.slice(1)
                      ]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="predicted" 
                      stroke="#8B5CF6" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Pipeline Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Pipeline Value</span>
                  </div>
                  <div className="text-lg font-bold text-blue-900">
                    {formatCurrency(predictiveData.deals.pipelineValue)}
                  </div>
                  <div className="text-xs text-blue-700">
                    {formatPercentage(predictiveData.deals.confidence)} confidence
                  </div>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Conversion Rate</span>
                  </div>
                  <div className="text-lg font-bold text-green-900">
                    {formatPercentage(predictiveData.deals.conversionRate)}
                  </div>
                  <div className="text-xs text-green-700">Predicted</div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="scenarios" className="mt-4">
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-900 mb-3">Revenue Scenarios</div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Optimistic</span>
                  </div>
                  <div className="font-bold text-green-900">
                    {formatCurrency(predictiveData.revenue.scenarios.optimistic)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Realistic</span>
                  </div>
                  <div className="font-bold text-blue-900">
                    {formatCurrency(predictiveData.revenue.scenarios.realistic)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-900">Pessimistic</span>
                  </div>
                  <div className="font-bold text-red-900">
                    {formatCurrency(predictiveData.revenue.scenarios.pessimistic)}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-start gap-2">
                  <Brain className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-800">
                    <div className="font-medium mb-1">Model Notes</div>
                    <p className="text-xs">
                      Scenarios based on historical performance, current pipeline, 
                      and market conditions. Updated every 10 minutes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="insights" className="mt-4">
            <div className="space-y-3 max-h-52 overflow-y-auto">
              {predictiveData.insights.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <Zap className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No insights available</p>
                </div>
              ) : (
                predictiveData.insights.map((insight, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border ${insightTypeColors[insight.type]}`}
                    data-testid={`prediction-insight-${index}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">
                          {insight.message}
                        </p>
                        <div className="text-xs opacity-80">
                          {formatPercentage(insight.confidence)} confidence
                        </div>
                      </div>
                      {insight.type === 'positive' && <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                      {insight.type === 'negative' && <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                      {insight.type === 'neutral' && <Activity className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {predictiveData.lastUpdated && (
              <div className="mt-4 text-xs text-gray-500 text-center">
                Last updated: {getTimeAgo(predictiveData.lastUpdated)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}