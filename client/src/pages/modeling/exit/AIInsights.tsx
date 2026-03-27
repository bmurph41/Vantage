import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  Download,
  Sparkles,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Shield,
  Target,
} from "lucide-react";
import type { ModelingProject } from "@shared/schema";

interface AIInsightsProps {
  projectId: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  market_timing: TrendingUp,
  tax_strategy: Lightbulb,
  risk_factor: AlertTriangle,
  value_enhancement: CheckCircle,
  strategic: Target,
};

const IMPACT_STYLES: Record<string, string> = {
  Positive: 'bg-green-100 text-green-600',
  Caution: 'bg-amber-100 text-amber-600',
  Neutral: 'bg-blue-100 text-blue-600',
};

export default function ExitAIInsights({ projectId }: AIInsightsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customPrompt, setCustomPrompt] = useState("");

  const { data: project, isLoading: projectLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  // Load initial AI insights
  const { data: analysis, isLoading: analysisLoading } = useQuery<{
    insights: any[];
    recommendations: string[];
    strategyComparison: any[];
  }>({
    queryKey: ['/api/modeling/projects', projectId, 'exit', 'ai-analysis'],
    queryFn: async () => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/exit/ai-analysis`, {});
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  // Custom prompt mutation
  const analysisMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/exit/ai-analysis`, { prompt });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['/api/modeling/projects', projectId, 'exit', 'ai-analysis'],
        data,
      );
      toast({ title: "Analysis complete" });
    },
    onError: () => {
      toast({ title: "Analysis failed", variant: "destructive" });
    },
  });

  const insights = analysis?.insights || [];
  const recommendations = analysis?.recommendations || [];
  const strategyComparison = analysis?.strategyComparison || [];

  if (projectLoading || analysisLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy Suite
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">AI Insights</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="ai-insights-title">AI Exit Insights</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered exit strategy recommendations for {project?.propertyName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategies
          </Button>
          <Button variant="outline" data-testid="btn-export-insights">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Custom Analysis
          </CardTitle>
          <CardDescription>
            Ask AI for specific exit strategy analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Ask about specific exit strategies, tax implications, market timing, or any other exit-related questions..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            data-testid="input-custom-prompt"
          />
          <div className="flex gap-2">
            <Button
              onClick={() => analysisMutation.mutate(customPrompt)}
              disabled={!customPrompt.trim() || analysisMutation.isPending}
              data-testid="btn-analyze"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {analysisMutation.isPending ? "Analyzing..." : "Analyze"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCustomPrompt("What is the optimal exit timing given current market conditions?")}
            >
              Suggest Timing
            </Button>
            <Button
              variant="outline"
              onClick={() => setCustomPrompt("Compare 1031 exchange vs DST vs outright sale for tax efficiency")}
            >
              Tax Comparison
            </Button>
          </div>
        </CardContent>
      </Card>

      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight: any, index: number) => {
            const Icon = CATEGORY_ICONS[insight.category] || Shield;
            const impactStyle = IMPACT_STYLES[insight.impact] || IMPACT_STYLES.Neutral;

            return (
              <Card key={index} data-testid={`insight-card-${index}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${impactStyle}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {insight.category?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <Badge variant={insight.confidence === 'High' ? 'default' : 'secondary'}>
                      {insight.confidence} Confidence
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{insight.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Key Recommendations
            </CardTitle>
            <CardDescription>
              Actionable steps to optimize your exit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec: string, index: number) => (
                <div key={index} className="flex items-start gap-3" data-testid={`recommendation-${index}`}>
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <p className="text-sm pt-0.5">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {strategyComparison.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Exit Strategy Comparison</CardTitle>
            <CardDescription>AI-generated comparison of exit options</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {strategyComparison.map((strat: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg ${strat.recommended ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{strat.strategy}</h4>
                    {strat.recommended && (
                      <Badge variant="default" className="text-xs">Recommended</Badge>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    {(['liquidity', 'taxEfficiency', 'complexity'] as const).map((key) => {
                      const label = key === 'taxEfficiency' ? 'Tax Efficiency' : key.charAt(0).toUpperCase() + key.slice(1);
                      const val = strat[key];
                      const color = val === 'High'
                        ? (key === 'complexity' ? 'text-red-500' : 'text-green-600')
                        : val === 'Low'
                          ? (key === 'complexity' ? 'text-green-600' : 'text-red-500')
                          : 'text-amber-500';
                      return (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={`font-medium ${color}`}>{val}</span>
                        </div>
                      );
                    })}
                    <Separator className="my-2" />
                    <p className="text-muted-foreground">Best for: {strat.bestFor}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
