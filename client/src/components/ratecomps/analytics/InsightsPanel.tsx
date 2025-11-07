import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, AlertCircle, Info } from "lucide-react";

interface InsightsPanelProps {
  insights: string[];
  isLoading?: boolean;
}

function categorizeInsight(insight: string): 'trend' | 'alert' | 'info' {
  const lowerInsight = insight.toLowerCase();
  if (lowerInsight.includes('increased') || lowerInsight.includes('decreased') || lowerInsight.includes('growth')) {
    return 'trend';
  }
  if (lowerInsight.includes('highest') || lowerInsight.includes('lowest') || lowerInsight.includes('command')) {
    return 'alert';
  }
  return 'info';
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
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Apply filters to generate market insights</p>
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
            Market Insights
          </CardTitle>
          <Badge variant="secondary" data-testid="badge-insights-count">{insights.length} insights</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const category = categorizeInsight(insight);
            const Icon = category === 'trend' ? TrendingUp : category === 'alert' ? AlertCircle : Info;
            const bgColor = category === 'trend' 
              ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
              : category === 'alert'
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
            const iconColor = category === 'trend'
              ? 'text-blue-600 dark:text-blue-400'
              : category === 'alert'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-gray-600 dark:text-gray-400';

            return (
              <div
                key={index}
                className={`flex items-start gap-3 p-4 rounded-lg border ${bgColor} transition-all hover:shadow-sm`}
                data-testid={`insight-${index}`}
              >
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                <p className="text-sm text-foreground leading-relaxed">{insight}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
