import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { 
  TrendingUp, Target, DollarSign, Calendar,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Clock, Zap
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, addMonths, startOfMonth } from "date-fns";
import { formatCurrency, formatPercent } from "@/lib/utils";

interface ForecastData {
  period: string;
  totalPipeline: number;
  weightedPipeline: number;
  bestCase: number;
  mostLikely: number;
  worstCase: number;
  committed: number;
  closed: number;
  target: number;
  confidence: number;
}

interface DealForecast {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
  expectedCloseDate: string;
  weightedValue: number;
  agent: {
    name: string;
    avatar?: string;
  };
  property?: {
    title: string;
    type: string;
  };
  riskFactors: string[];
  lastActivity: string;
  daysInStage: number;
}

interface ForecastingData {
  // Current period overview
  currentPeriod: ForecastData;
  
  // Historical accuracy
  historicalAccuracy: {
    period: string;
    predicted: number;
    actual: number;
    accuracy: number;
  }[];
  
  // Future periods
  futurePeriods: ForecastData[];
  
  // Deal-level forecasts
  deals: {
    thisMonth: DealForecast[];
    nextMonth: DealForecast[];
    atRisk: DealForecast[];
    highConfidence: DealForecast[];
  };
  
  // Trends and insights
  trends: {
    pipelineGrowth: number;
    averageDealSize: number;
    salesCycleLength: number;
    conversionRate: number;
    seasonalFactors: {
      month: string;
      factor: number;
      description: string;
    }[];
  };
  
  // Predictive insights
  insights: {
    type: 'warning' | 'opportunity' | 'risk' | 'success';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    action?: string;
  }[];
}

interface ForecastingDashboardProps {
  timeframe?: 'month' | 'quarter' | 'year';
}

export default function ForecastingDashboard({ timeframe = 'month' }: ForecastingDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current');
  const [confidenceLevel, setConfidenceLevel] = useState<'conservative' | 'optimistic' | 'realistic'>('realistic');

  const { data: forecastData, isLoading } = useQuery<ForecastingData>({
    queryKey: ['/api/analytics/forecasting', timeframe, confidenceLevel],
    queryFn: async () => {
      const params = new URLSearchParams({ timeframe, confidenceLevel });
      const response = await fetch(`/api/analytics/forecasting?${params}`);
      if (!response.ok) throw new Error('Failed to fetch forecasting data');
      return response.json();
    },
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning': return AlertTriangle;
      case 'opportunity': return TrendingUp;
      case 'risk': return AlertTriangle;
      case 'success': return CheckCircle;
      default: return Clock;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'opportunity': return 'border-green-200 bg-green-50';
      case 'risk': return 'border-red-200 bg-red-50';
      case 'success': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getRiskLevel = (deal: DealForecast) => {
    const riskFactors = deal.riskFactors.length;
    const daysInStage = deal.daysInStage;
    const probability = deal.probability;
    
    if (riskFactors >= 3 || daysInStage > 60 || probability < 30) return 'high';
    if (riskFactors >= 2 || daysInStage > 30 || probability < 60) return 'medium';
    return 'low';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!forecastData) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Sales Forecasting
          </h2>
          <p className="text-gray-600">
            Predictive analytics and revenue forecasting based on current pipeline and historical trends.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={confidenceLevel} onValueChange={(value: any) => setConfidenceLevel(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservative</SelectItem>
              <SelectItem value="realistic">Realistic</SelectItem>
              <SelectItem value="optimistic">Optimistic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Current Period Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pipeline</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(forecastData.currentPeriod.totalPipeline)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <PieChart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-sm text-gray-600">
                Weighted: {formatCurrency(forecastData.currentPeriod.weightedPipeline)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Most Likely</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(forecastData.currentPeriod.mostLikely)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <Target className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className={`text-sm px-2 py-1 rounded-full inline-block ${getConfidenceColor(forecastData.currentPeriod.confidence)}`}>
                {forecastData.currentPeriod.confidence}% confidence
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Target Progress</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatPercent((forecastData.currentPeriod.closed / forecastData.currentPeriod.target) * 100)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <Progress 
                value={(forecastData.currentPeriod.closed / forecastData.currentPeriod.target) * 100} 
                className="h-2" 
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Committed</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(forecastData.currentPeriod.committed)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-orange-100">
                <CheckCircle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex gap-2 text-xs">
                <span className="text-gray-600">Best: {formatCurrency(forecastData.currentPeriod.bestCase)}</span>
                <span className="text-gray-600">Worst: {formatCurrency(forecastData.currentPeriod.worstCase)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="deals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deals">Deal Forecast</TabsTrigger>
          <TabsTrigger value="trends">Trends & Insights</TabsTrigger>
          <TabsTrigger value="accuracy">Historical Accuracy</TabsTrigger>
          <TabsTrigger value="future">Future Periods</TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* This Month's Deals */}
            <Card>
              <CardHeader>
                <CardTitle>Closing This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {forecastData.deals.thisMonth.slice(0, 8).map((deal) => {
                    const riskLevel = getRiskLevel(deal);
                    
                    return (
                      <div key={deal.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{deal.title}</div>
                          <div className="text-sm text-gray-600">
                            {deal.agent.name} • {deal.stage}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getRiskColor(riskLevel)}>
                              {riskLevel} risk
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {deal.daysInStage} days in stage
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(deal.weightedValue)}</div>
                          <div className="text-sm text-gray-600">{deal.probability}% likely</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(deal.expectedCloseDate), 'MMM d')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* At-Risk Deals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  At-Risk Deals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {forecastData.deals.atRisk.map((deal) => (
                    <div key={deal.id} className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{deal.title}</div>
                        <div className="font-bold text-yellow-700">{formatCurrency(deal.value)}</div>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        {deal.agent.name} • {deal.daysInStage} days in {deal.stage}
                      </div>
                      
                      <div className="space-y-1">
                        {deal.riskFactors.slice(0, 2).map((factor, index) => (
                          <div key={index} className="text-xs text-yellow-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {factor}
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-2 pt-2 border-t border-yellow-200">
                        <div className="text-xs text-gray-500">
                          Last activity: {format(new Date(deal.lastActivity), 'MMM d')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Key Performance Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Pipeline Growth</div>
                      <div className="text-sm text-gray-600">Month over month</div>
                    </div>
                    <div className={`flex items-center gap-1 ${
                      forecastData.trends.pipelineGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {forecastData.trends.pipelineGrowth >= 0 ? 
                        <ArrowUpRight className="w-4 h-4" /> : 
                        <ArrowDownRight className="w-4 h-4" />
                      }
                      <span className="font-bold">
                        {formatPercent(forecastData.trends.pipelineGrowth)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Average Deal Size</div>
                      <div className="text-sm text-gray-600">Current period</div>
                    </div>
                    <div className="font-bold text-blue-600">
                      {formatCurrency(forecastData.trends.averageDealSize)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Sales Cycle Length</div>
                      <div className="text-sm text-gray-600">Average days</div>
                    </div>
                    <div className="font-bold text-purple-600">
                      {forecastData.trends.salesCycleLength} days
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Conversion Rate</div>
                      <div className="text-sm text-gray-600">Lead to close</div>
                    </div>
                    <div className="font-bold text-green-600">
                      {formatPercent(forecastData.trends.conversionRate)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Predictive Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Predictive Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {forecastData.insights.map((insight, index) => {
                    const Icon = getInsightIcon(insight.type);
                    const colorClass = getInsightColor(insight.type);
                    
                    return (
                      <div key={index} className={`p-3 border rounded-lg ${colorClass}`}>
                        <div className="flex items-start gap-3">
                          <Icon className="w-5 h-5 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-medium">{insight.title}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {insight.description}
                            </div>
                            {insight.action && (
                              <div className="text-sm font-medium mt-2">
                                Recommended: {insight.action}
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary" className="capitalize">
                            {insight.impact}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seasonal Factors */}
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {forecastData.trends.seasonalFactors.map((factor) => (
                  <div key={factor.month} className="p-3 border rounded-lg text-center">
                    <div className="font-medium">{factor.month}</div>
                    <div className={`text-lg font-bold ${
                      factor.factor >= 1 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {factor.factor.toFixed(2)}x
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {factor.description}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accuracy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Forecast Accuracy Track Record</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {forecastData.historicalAccuracy.map((period) => (
                  <div key={period.period} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="font-medium">
                      {format(new Date(period.period), 'MMM yyyy')}
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Predicted</div>
                        <div className="font-medium">{formatCurrency(period.predicted)}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Actual</div>
                        <div className="font-medium">{formatCurrency(period.actual)}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Accuracy</div>
                        <div className={`font-bold ${
                          period.accuracy >= 90 ? 'text-green-600' :
                          period.accuracy >= 75 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {formatPercent(period.accuracy)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="future" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Future Period Forecasts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {forecastData.futurePeriods.map((period) => (
                  <div key={period.period} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-medium text-lg">
                        {format(new Date(period.period), 'MMM yyyy')}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm ${getConfidenceColor(period.confidence)}`}>
                        {period.confidence}% confidence
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Most Likely</div>
                        <div className="font-bold text-green-600">{formatCurrency(period.mostLikely)}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Best Case</div>
                        <div className="font-bold text-blue-600">{formatCurrency(period.bestCase)}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Worst Case</div>
                        <div className="font-bold text-red-600">{formatCurrency(period.worstCase)}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Target</div>
                        <div className="font-bold text-purple-600">{formatCurrency(period.target)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
