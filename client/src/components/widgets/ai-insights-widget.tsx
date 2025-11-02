import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  Zap,
  Brain,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { useState } from "react";

interface AiInsight {
  id: string;
  category: string;
  insight: string;
  confidence: number;
  actionable: boolean;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  impact?: string;
  timeframe?: string;
}

interface AiInsightsResponse {
  insights: AiInsight[];
  summary: {
    totalInsights: number;
    highPriorityCount: number;
    actionableCount: number;
    avgConfidence: number;
  };
}

const priorityColors = {
  high: 'destructive',
  medium: 'default', 
  low: 'secondary'
} as const;

const priorityIcons = {
  high: AlertTriangle,
  medium: Target,
  low: Lightbulb
};

const categoryIcons = {
  'pipeline': TrendingUp,
  'deals': Target,
  'performance': Sparkles,
  'automation': Zap,
  'forecasting': Brain,
  'general': Lightbulb
};

export default function AiInsightsWidget() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: insightsData, isLoading, refetch } = useQuery<AiInsightsResponse>({
    queryKey: ['/api/ai-insights'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const formatTimeAgo = (dateString: string) => {
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
      <Card className="h-full" data-testid="ai-insights-widget">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              AI Insights
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const insights = insightsData?.insights || [];
  const summary = insightsData?.summary;

  return (
    <Card className="h-full" data-testid="ai-insights-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            AI Insights
            {summary && (
              <Badge variant="outline" className="ml-2">
                {summary.totalInsights} insights
              </Badge>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="refresh-insights"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        {summary && (
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span>{summary.highPriorityCount} high priority</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-blue-500" />
              <span>{summary.actionableCount} actionable</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span>{Math.round(summary.avgConfidence)}% avg confidence</span>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {insights.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Brain className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No AI insights available</p>
                <p className="text-sm">Check back later for new recommendations</p>
              </div>
            ) : (
              insights.map((insight, index) => {
                const PriorityIcon = priorityIcons[insight.priority];
                const CategoryIcon = categoryIcons[insight.category as keyof typeof categoryIcons] || Lightbulb;
                
                return (
                  <div key={insight.id}>
                    <div className="space-y-2" data-testid={`insight-${index}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="p-1.5 bg-gray-100 rounded-md">
                            <CategoryIcon className="w-3.5 h-3.5 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge 
                                variant={priorityColors[insight.priority]}
                                className="text-xs"
                              >
                                <PriorityIcon className="w-3 h-3 mr-1" />
                                {insight.priority}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {insight.category}
                              </Badge>
                              {insight.actionable && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  Actionable
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-900 leading-relaxed">
                              {insight.insight}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {Math.round(insight.confidence)}% confidence
                              </span>
                              {insight.impact && (
                                <span className="flex items-center gap-1">
                                  <Target className="w-3 h-3" />
                                  {insight.impact} impact
                                </span>
                              )}
                              {insight.timeframe && (
                                <span className="flex items-center gap-1">
                                  <Zap className="w-3 h-3" />
                                  {insight.timeframe}
                                </span>
                              )}
                              <span>{formatTimeAgo(insight.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < insights.length - 1 && <Separator className="my-3" />}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}