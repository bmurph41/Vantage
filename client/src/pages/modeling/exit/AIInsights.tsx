import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  CheckCircle
} from "lucide-react";
import type { ModelingProject } from "@shared/schema";

interface AIInsightsProps {
  projectId: string;
}

export default function ExitAIInsights({ projectId }: AIInsightsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [customPrompt, setCustomPrompt] = useState("");
  
  const { data: project, isLoading: projectLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const analysisMutation = useMutation({
    mutationFn: async (prompt: string) => {
      return apiRequest(`/api/modeling/projects/${projectId}/exit/ai-analysis`, {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
    },
    onSuccess: () => {
      toast({ title: "Analysis complete" });
    },
    onError: () => {
      toast({ title: "Analysis failed", variant: "destructive" });
    }
  });

  const [insights] = useState([
    {
      id: 1,
      category: "Market Timing",
      icon: TrendingUp,
      title: "Favorable Exit Window",
      description: "Current cap rate compression in the marina sector suggests a favorable exit window. Historical data shows marina assets trading at 50-100bps tighter than 12 months ago.",
      confidence: "High",
      impact: "Positive"
    },
    {
      id: 2,
      category: "Tax Strategy",
      icon: Lightbulb,
      title: "1031 Exchange Opportunity",
      description: "Given the substantial embedded gain, a 1031 exchange into a DST structure could defer $2.1M in capital gains tax while maintaining passive income exposure to marine real estate.",
      confidence: "High",
      impact: "Positive"
    },
    {
      id: 3,
      category: "Risk Factor",
      icon: AlertTriangle,
      title: "Interest Rate Sensitivity",
      description: "With current Fed policy uncertainty, exit cap rates could expand 25-50bps if rates remain elevated. Consider stress-testing scenarios with 7.0%+ exit caps.",
      confidence: "Medium",
      impact: "Caution"
    },
    {
      id: 4,
      category: "Value Enhancement",
      icon: CheckCircle,
      title: "Pre-Exit NOI Optimization",
      description: "Implementing a fuel dock upgrade and expanding dry storage could add $150K to annual NOI, potentially increasing exit value by $2-3M at current cap rates.",
      confidence: "Medium",
      impact: "Positive"
    }
  ]);

  const recommendations = [
    "Consider a phased exit strategy with earnout provisions tied to revenue milestones",
    "Engage a marina-specialized broker to maximize competitive tension",
    "Complete environmental Phase II before going to market",
    "Document all capital improvements for basis step-up calculations",
    "Model seller financing options to expand buyer pool"
  ];

  if (projectLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight) => (
          <Card key={insight.id} data-testid={`insight-card-${insight.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    insight.impact === 'Positive' ? 'bg-green-100 text-green-600' :
                    insight.impact === 'Caution' ? 'bg-amber-100 text-amber-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    <insight.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <Badge variant="outline" className="text-xs">{insight.category}</Badge>
                  </div>
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
        ))}
      </div>

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
            {recommendations.map((rec, index) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Exit Strategy Comparison</CardTitle>
          <CardDescription>AI-generated comparison of exit options</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">Outright Sale</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Liquidity</span>
                  <span className="font-medium text-green-600">High</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax Efficiency</span>
                  <span className="font-medium text-red-500">Low</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Complexity</span>
                  <span className="font-medium text-green-600">Low</span>
                </div>
                <Separator className="my-2" />
                <p className="text-muted-foreground">
                  Best for: Immediate liquidity needs, estate planning
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold">1031 Exchange</h4>
                <Badge variant="default" className="text-xs">Recommended</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Liquidity</span>
                  <span className="font-medium text-amber-500">Medium</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax Efficiency</span>
                  <span className="font-medium text-green-600">High</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Complexity</span>
                  <span className="font-medium text-amber-500">Medium</span>
                </div>
                <Separator className="my-2" />
                <p className="text-muted-foreground">
                  Best for: Continued RE investment, tax deferral
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-2">DST Investment</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Liquidity</span>
                  <span className="font-medium text-red-500">Low</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax Efficiency</span>
                  <span className="font-medium text-green-600">High</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Complexity</span>
                  <span className="font-medium text-green-600">Low</span>
                </div>
                <Separator className="my-2" />
                <p className="text-muted-foreground">
                  Best for: Passive income, estate planning, diversification
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
