import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, AlertCircle, Target, Shield, Zap } from "lucide-react";

interface AIInsight {
  category: 'trend' | 'opportunity' | 'risk' | 'anomaly' | 'strategic';
  title: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  priority: number;
}

interface InsightsPanelProps {
  insights: AIInsight[];
  isLoading?: boolean;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'trend':
      return TrendingUp;
    case 'opportunity':
      return Target;
    case 'risk':
      return AlertCircle;
    case 'anomaly':
      return Zap;
    case 'strategic':
      return Shield;
    default:
      return Lightbulb;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'trend':
      return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100';
    case 'opportunity':
      return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100';
    case 'risk':
      return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100';
    case 'anomaly':
      return 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-100';
    case 'strategic':
      return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100';
    default:
      return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100';
  }
}

function getConfidenceBadgeVariant(confidence: string): 'default' | 'secondary' | 'outline' {
  switch (confidence) {
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
    default:
      return 'secondary';
  }
}

export default function InsightsPanel({ insights, isLoading }: InsightsPanelProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 bg-muted rounded w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            AI Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Apply filters to generate AI-powered market insights</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40" data-testid="card-insights">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            AI Market Insights
          </CardTitle>
          <Badge variant="secondary" data-testid="badge-insights-count">
            {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = getCategoryIcon(insight.category);
            const bgColor = getCategoryColor(insight.category);

            return (
              <div
                key={index}
                className={`rounded-lg border ${bgColor} transition-all hover:shadow-sm`}
                data-testid={`insight-${index}`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{insight.title}</h4>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={getConfidenceBadgeVariant(insight.confidence)} className="text-xs">
                            {insight.confidence}
                          </Badge>
                          {insight.priority >= 4 && (
                            <Badge className="bg-orange-500 text-white text-xs">Priority</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
