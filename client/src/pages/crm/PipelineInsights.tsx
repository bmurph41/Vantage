import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Lightbulb,
  Target,
  ShieldAlert,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  DollarSign,
  BarChart3,
  Layers,
  Sparkles,
  CheckCircle2,
  XCircle,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TrendItem {
  title: string;
  description: string;
  direction: "up" | "down" | "stable";
  impact: "positive" | "negative" | "neutral";
}

interface RiskItem {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  recommendation: string;
}

interface OpportunityItem {
  title: string;
  description: string;
  potentialValue: string;
  timeframe: "short" | "medium" | "long";
}

interface RecommendationItem {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: string;
}

interface PipelineInsightsData {
  pipelineData: {
    totalDeals: number;
    totalPipelineValue: number;
    weightedPipelineValue: number;
    atRiskDeals: number;
    healthyDeals: number;
    winRate: number;
    wonCount: number;
    lostCount: number;
    stageDistribution: Array<{ stage: string; count: number; value: number }>;
    priorityBreakdown: Record<string, number>;
    sourceBreakdown: Record<string, number>;
    recentDealsCount: number;
    staleDeals: Array<{ title: string; stage: string; daysInStage: number; value: number }>;
  };
  insights: {
    healthScore: number;
    healthLabel: string;
    summary: string;
    trends: TrendItem[];
    risks: RiskItem[];
    opportunities: OpportunityItem[];
    recommendations: RecommendationItem[];
  };
  generatedAt: string;
}

const STAGE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function HealthScoreRing({ score, label }: { score: number; label: string }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : score >= 40 ? "#F97316" : "#EF4444";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <Badge variant="outline" className="mt-2 text-sm" style={{ borderColor: color, color }}>{label}</Badge>
    </div>
  );
}

function DirectionIcon({ direction, impact }: { direction: string; impact: string }) {
  if (direction === "up") {
    return impact === "positive"
      ? <ArrowUpRight className="w-4 h-4 text-green-500" />
      : <ArrowUpRight className="w-4 h-4 text-red-500" />;
  }
  if (direction === "down") {
    return impact === "negative"
      ? <ArrowDownRight className="w-4 h-4 text-red-500" />
      : <ArrowDownRight className="w-4 h-4 text-green-500" />;
  }
  return <Minus className="w-4 h-4 text-gray-400" />;
}

export default function PipelineInsights() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<PipelineInsightsData>({
    queryKey: ["/api/crm/analytics/pipeline-insights"],
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Brain className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Unable to Generate Insights</h3>
            <p className="text-sm text-muted-foreground mb-4">There was an issue analyzing your pipeline data. Please try again.</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { pipelineData, insights, generatedAt } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-600" />
            AI Pipeline Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered analysis of your deal pipeline trends and recommendations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Generated {new Date(generatedAt).toLocaleString()}
          </span>
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Health</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <HealthScoreRing score={insights.healthScore} label={insights.healthLabel} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed mb-4">{insights.summary}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">{pipelineData.totalDeals}</div>
                <div className="text-xs text-blue-600">Total Deals</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{formatCurrency(pipelineData.weightedPipelineValue)}</div>
                <div className="text-xs text-green-600">Weighted Pipeline</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="text-2xl font-bold text-amber-700">{pipelineData.winRate}%</div>
                <div className="text-xs text-amber-600">Win Rate</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-700">{pipelineData.atRiskDeals}</div>
                <div className="text-xs text-red-600">At Risk</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Key Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(insights.trends || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No trends identified yet</p>
              ) : (
                insights.trends.map((trend, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="mt-0.5">
                      <DirectionIcon direction={trend.direction} impact={trend.impact} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{trend.title}</span>
                        <Badge variant="outline" className={`text-xs ${
                          trend.impact === "positive" ? "border-green-300 text-green-700 bg-green-50" :
                          trend.impact === "negative" ? "border-red-300 text-red-700 bg-red-50" :
                          "border-gray-300 text-gray-600"
                        }`}>
                          {trend.impact}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{trend.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Risk Alerts
              {(insights.risks || []).filter(r => r.severity === "high").length > 0 && (
                <Badge variant="destructive" className="text-xs">{insights.risks.filter(r => r.severity === "high").length} High</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(insights.risks || []).length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No significant risks detected</p>
                </div>
              ) : (
                insights.risks.map((risk, i) => (
                  <div key={i} className={`p-3 rounded-lg border-l-4 ${
                    risk.severity === "high" ? "border-l-red-500 bg-red-50/50" :
                    risk.severity === "medium" ? "border-l-amber-500 bg-amber-50/50" :
                    "border-l-gray-400 bg-gray-50/50"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`w-4 h-4 ${
                        risk.severity === "high" ? "text-red-500" :
                        risk.severity === "medium" ? "text-amber-500" : "text-gray-400"
                      }`} />
                      <span className="font-medium text-sm">{risk.title}</span>
                      <Badge variant="outline" className="text-xs ml-auto capitalize">{risk.severity}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1.5">{risk.description}</p>
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" />
                      {risk.recommendation}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              Stage Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipelineData.stageDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No stage data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pipelineData.stageDistribution} margin={{ top: 5, right: 5, bottom: 60, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === "count" ? `${value} deals` : formatCurrency(value),
                      name === "count" ? "Deals" : "Value"
                    ]}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="count" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-green-500" />
              Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(insights.opportunities || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Analyzing pipeline for opportunities...</p>
              ) : (
                insights.opportunities.map((opp, i) => (
                  <div key={i} className="p-3 rounded-lg bg-green-50/50 border border-green-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-sm">{opp.title}</span>
                      <Badge variant="outline" className="text-xs ml-auto border-green-300 text-green-700 capitalize">
                        {opp.timeframe} term
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{opp.description}</p>
                    {opp.potentialValue && (
                      <p className="text-xs text-green-700 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Potential impact: {opp.potentialValue}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(insights.recommendations || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 col-span-2">No recommendations at this time</p>
            ) : (
              insights.recommendations.map((rec, i) => (
                <div key={i} className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${
                      rec.priority === "high" ? "bg-red-500" :
                      rec.priority === "medium" ? "bg-amber-500" : "bg-gray-400"
                    }`} />
                    <span className="font-medium text-sm">{rec.title}</span>
                    <Badge variant="outline" className="text-xs ml-auto capitalize">{rec.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.description}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {pipelineData.staleDeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Stale Deals Requiring Attention
              <Badge variant="outline" className="text-xs">{pipelineData.staleDeals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pipelineData.staleDeals.map((deal, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-orange-50/50 border border-orange-100">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-sm">{deal.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Badge variant="outline" className="text-xs capitalize">{deal.stage}</Badge>
                        <span>{deal.daysInStage} days in stage</span>
                      </div>
                    </div>
                  </div>
                  {deal.value > 0 && (
                    <span className="text-sm font-medium text-orange-700">{formatCurrency(deal.value)}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
