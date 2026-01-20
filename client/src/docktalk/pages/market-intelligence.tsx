import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "../lib/queryClient";
import { usePacks } from "@/contexts/PackContext";
import { PaywallModal } from "@/components/PaywallModal";
import { 
  TrendingUp, 
  Sparkles, 
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit3,
  Save,
  X,
  Crown,
  Lock,
  BarChart3,
  AlertTriangle,
  Target,
  Lightbulb,
  Building,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CategorySummary {
  id: number;
  category: string;
  period: "daily" | "weekly";
  summaryText: string;
  keyTrends: string[] | null;
  articleCount: number;
  avgRelevance: number | null;
  topSources: string[] | null;
  comparisonText: string | null;
  previousPeriodCount: number | null;
  growthPercentage: number | null;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  isEdited: boolean;
  editedBy: string | null;
  editedAt: string | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  'M&A': '🤝',
  'Operations': '⚙️',
  'Development': '🏗️',
  'Technology': '💻',
  'Regulatory': '⚖️',
  'Market Trends': '📈',
  'Finance': '💰',
  'Environmental': '🌿',
  'Macro': '🌍',
  'General': '📰',
  'Boat Sales': '⛵',
  'Boat Show': '🎪',
  'Manufacturing': '🏭',
  'Industry Trends': '📊',
  'Marina Sale': '🏖️',
  'Education': '🎓',
  'Insurance': '🛡️',
  'Legal': '⚖️',
  'People Moves': '👥',
  'Company Earnings': '💵',
  'Awards': '🏆',
  'Business Planning': '📋',
  'International': '🌐'
};

interface CrossModuleInsight {
  id: string;
  category: 'market_trend' | 'deal_opportunity' | 'risk_alert' | 'strategic_recommendation' | 'competitive_intel';
  title: string;
  summary: string;
  details: string;
  confidence: 'high' | 'medium' | 'low';
  priority: number;
  relatedModules: string[];
  actionItems?: string[];
}

interface MarketIntelligenceProReport {
  executiveSummary: string;
  insights: CrossModuleInsight[];
  marketOverview: {
    totalDealsInPipeline: number;
    totalDealValue: number;
    activeDdProjects: number;
    modelingProjectsCount: number;
    recentNewsCount: number;
  };
  trends: {
    dealVelocity: string;
    marketSentiment: string;
    competitiveActivity: string;
  };
  generatedAt: string;
}

const INSIGHT_ICONS: Record<string, typeof TrendingUp> = {
  market_trend: TrendingUp,
  deal_opportunity: Target,
  risk_alert: AlertTriangle,
  strategic_recommendation: Lightbulb,
  competitive_intel: Building,
};

const INSIGHT_COLORS: Record<string, string> = {
  market_trend: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  deal_opportunity: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  risk_alert: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  strategic_recommendation: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  competitive_intel: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function ProInsightsSection() {
  const { toast } = useToast();
  
  const { data: report, isLoading, error, refetch, isFetching } = useQuery<MarketIntelligenceProReport>({
    queryKey: ['/api/analytics/market-intelligence-pro/insights'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">Analyzing cross-module data...</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card className="p-6 mb-6 border-red-200 bg-red-50 dark:bg-red-900/10">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <span>Unable to load cross-module insights. Please try again.</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-semibold">Cross-Module Intelligence</h2>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            AI-Powered
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Executive Summary */}
      <Card className="p-4 mb-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <p className="text-sm font-medium text-muted-foreground mb-1">Executive Summary</p>
        <p className="text-foreground">{report.executiveSummary}</p>
      </Card>

      {/* Market Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{report.marketOverview.totalDealsInPipeline}</p>
          <p className="text-xs text-muted-foreground">Active Deals</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            ${(report.marketOverview.totalDealValue / 1000000).toFixed(1)}M
          </p>
          <p className="text-xs text-muted-foreground">Pipeline Value</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{report.marketOverview.activeDdProjects}</p>
          <p className="text-xs text-muted-foreground">DD Projects</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">{report.marketOverview.modelingProjectsCount}</p>
          <p className="text-xs text-muted-foreground">Models</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{report.marketOverview.recentNewsCount}</p>
          <p className="text-xs text-muted-foreground">News Articles</p>
        </Card>
      </div>

      {/* Insights List */}
      <div className="space-y-3">
        {report.insights.map((insight) => {
          const Icon = INSIGHT_ICONS[insight.category] || Sparkles;
          const colorClass = INSIGHT_COLORS[insight.category] || 'bg-gray-100 text-gray-800';
          
          return (
            <Card key={insight.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-foreground">{insight.title}</h3>
                    <Badge variant="outline" className="text-xs">
                      {insight.confidence} confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{insight.summary}</p>
                  <p className="text-sm text-foreground">{insight.details}</p>
                  {insight.actionItems && insight.actionItems.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {insight.actionItems.map((action, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {action}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-1">
                    {insight.relatedModules.map((mod, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {mod}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({ 
  summary, 
  isPro, 
  canEdit 
}: { 
  summary: CategorySummary; 
  isPro: boolean;
  canEdit: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(summary.summaryText);
  const { toast } = useToast();

  const editMutation = useMutation({
    mutationFn: async (summaryText: string) => {
      await apiRequest(`/api/summaries/${summary.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ summaryText })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/summaries'] });
      setIsEditing(false);
      toast({
        title: "Summary updated",
        description: "Your edits have been saved successfully."
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to save your edits. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    editMutation.mutate(editedText);
  };

  const handleCancel = () => {
    setEditedText(summary.summaryText);
    setIsEditing(false);
  };

  const growthColor = summary.growthPercentage 
    ? summary.growthPercentage > 0 
      ? "text-green-600 dark:text-green-400" 
      : summary.growthPercentage < 0
        ? "text-red-600 dark:text-red-400"
        : "text-gray-600 dark:text-gray-400"
    : "text-gray-600 dark:text-gray-400";

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow" data-testid={`card-summary-${summary.category}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{CATEGORY_ICONS[summary.category] || '📊'}</span>
          <div>
            <h3 className="text-xl font-bold text-foreground" data-testid={`text-category-${summary.category}`}>
              {summary.category}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs" data-testid={`badge-period-${summary.category}`}>
                {summary.period === 'daily' ? 'Past 24 Hours' : 'Past Week'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {summary.articleCount} {summary.articleCount === 1 ? 'article' : 'articles'}
              </span>
              {summary.growthPercentage !== null && (
                <span className={`text-xs font-medium ${growthColor}`}>
                  {summary.growthPercentage > 0 ? '+' : ''}{summary.growthPercentage}% vs previous
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary.isEdited && (
            <Badge variant="outline" className="text-xs">
              Edited
            </Badge>
          )}
          {canEdit && !isEditing && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid={`button-edit-${summary.category}`}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Summary Text */}
      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="min-h-[200px] font-normal"
            data-testid={`textarea-edit-${summary.category}`}
          />
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleSave}
              disabled={editMutation.isPending}
              size="sm"
              data-testid={`button-save-${summary.category}`}
            >
              <Save className="h-4 w-4 mr-1" />
              {editMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button 
              onClick={handleCancel}
              variant="outline"
              size="sm"
              data-testid={`button-cancel-${summary.category}`}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {!isPro ? (
            <div className="bg-muted/50 rounded-lg p-6 text-center border-2 border-dashed border-muted-foreground/20">
              <Crown className="h-12 w-12 text-amber-500 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium mb-2">Pro Feature</p>
              <p className="text-sm text-muted-foreground mb-4">
                Upgrade to Pro to access AI-powered category summaries with trend analysis and insights
              </p>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600" data-testid={`button-upgrade-${summary.category}`}>
                <Crown className="h-4 w-4 mr-1" />
                Upgrade to Pro
              </Button>
            </div>
          ) : (
            <div className={`text-muted-foreground ${!isExpanded && 'line-clamp-3'}`} data-testid={`text-summary-${summary.category}`}>
              {summary.summaryText.split('\n').map((line, idx) => (
                <p key={idx} className="mb-2">{line}</p>
              ))}
            </div>
          )}
        </>
      )}

      {/* Key Trends */}
      {isPro && summary.keyTrends && summary.keyTrends.length > 0 && isExpanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Key Trends
          </h4>
          <ul className="space-y-1">
            {summary.keyTrends.map((trend, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{trend}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top Sources */}
      {isPro && summary.topSources && summary.topSources.length > 0 && isExpanded && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-foreground mb-2">Top Sources</h4>
          <div className="flex flex-wrap gap-2">
            {summary.topSources.map((source, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {source}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {isPro && (
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Generated {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}</span>
            {summary.avgRelevance && (
              <>
                <span>•</span>
                <BarChart3 className="h-3 w-3" />
                <span>Avg relevance: {summary.avgRelevance}%</span>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid={`button-expand-${summary.category}`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show more
              </>
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}

function GenerateSummariesButton() {
  const { toast } = useToast();
  
  const generateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('/api/admin/generate-summaries', {
        method: 'POST',
        body: JSON.stringify({})
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/summaries'] });
      toast({
        title: "Summaries generated",
        description: "AI summaries have been successfully generated for all categories.",
      });
    },
    onError: () => {
      toast({
        title: "Generation failed",
        description: "Failed to generate summaries. Please try again.",
        variant: "destructive"
      });
    }
  });

  return (
    <Button 
      onClick={() => generateMutation.mutate()}
      disabled={generateMutation.isPending}
      data-testid="button-generate-summaries"
    >
      <Sparkles className="h-4 w-4 mr-2" />
      {generateMutation.isPending ? "Generating..." : "Generate Summaries Now"}
    </Button>
  );
}

export default function MarketIntelligence() {
  const { isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const [periodFilter, setPeriodFilter] = useState<"daily" | "weekly" | "">("");
  const [showPaywall, setShowPaywall] = useState(false);
  
  // Check for analytics_pro pack or admin role for Pro access
  const { hasAnalyticsPro, isLoading: packsLoading } = usePacks();
  const isPro = hasAnalyticsPro || user?.role === "admin";
  const canEdit = user?.role && ['admin', 'analyst', 'partner'].includes(user.role);
  
  const { data: summaries, isLoading, error } = useQuery<CategorySummary[]>({
    queryKey: ['/api/summaries', { period: periodFilter || undefined }],
    enabled: isAuthenticated && isPro,
  });

  const displaySummaries = summaries || [];

  return (
    <div className="h-full bg-background overflow-auto p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-primary" />
                    Market Intelligence
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    AI-powered category summaries with trend analysis and insights
                  </p>
                </div>
                {isPro && (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-lg px-4 py-2">
                    <Crown className="h-4 w-4 mr-1" />
                    Pro
                  </Badge>
                )}
              </div>

              {/* Period Filter */}
              {isPro && (
                <div className="flex items-center gap-3">
                  <Button
                    variant={periodFilter === "" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriodFilter("")}
                    data-testid="button-filter-all"
                  >
                    All Periods
                  </Button>
                  <Button
                    variant={periodFilter === "daily" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriodFilter("daily")}
                    data-testid="button-filter-daily"
                  >
                    Daily
                  </Button>
                  <Button
                    variant={periodFilter === "weekly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPeriodFilter("weekly")}
                    data-testid="button-filter-weekly"
                  >
                    Weekly
                  </Button>
                </div>
              )}
            </div>

            {/* Authentication Required - Note: Now handled by MarinaMatch auth */}
            {!isAuthenticated && (
              <Card className="p-12 text-center" data-testid="card-auth-required">
                <Lock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Access Required
                </h3>
                <p className="text-muted-foreground">
                  Market Intelligence is an institutional-grade feature. Please sign in to MarinaMatch to access AI-powered category summaries.
                </p>
              </Card>
            )}

            {/* Pro Upgrade CTA for Free Users */}
            {isAuthenticated && !isPro && (
              <Card className="p-12 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800" data-testid="card-pro-upgrade">
                <Crown className="h-20 w-20 text-amber-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-foreground mb-3">
                  Unlock Market Intelligence with Pro
                </h3>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Get AI-powered category summaries, trend analysis, historical comparisons, and institutional-grade insights to stay ahead of the marina industry.
                </p>
                <div className="grid md:grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto">
                  <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                    <Sparkles className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="font-medium text-foreground">AI Summaries</p>
                    <p className="text-sm text-muted-foreground">AI-powered insights</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                    <TrendingUp className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="font-medium text-foreground">Trend Analysis</p>
                    <p className="text-sm text-muted-foreground">Track changes over time</p>
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
                    <BarChart3 className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="font-medium text-foreground">Key Insights</p>
                    <p className="text-sm text-muted-foreground">Strategic intelligence</p>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  className="bg-amber-500 hover:bg-amber-600"
                  onClick={() => setShowPaywall(true)}
                  data-testid="button-upgrade-pro"
                >
                  <Crown className="h-5 w-5 mr-2" />
                  Upgrade to Pro
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  Preview available below with limited access
                </p>
              </Card>
            )}

            {/* Cross-Module Insights Section - Pro Only */}
            {isAuthenticated && isPro && (
              <ProInsightsSection />
            )}

            {/* Loading State */}
            {isAuthenticated && isPro && isLoading && (
              <div className="space-y-4 mt-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-64 w-full" />
                ))}
              </div>
            )}

            {/* Error State */}
            {isAuthenticated && isPro && error && (
              <Card className="p-12 text-center mt-6">
                <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Failed to load summaries
                </h3>
                <p className="text-muted-foreground">
                  Please try again later or contact support if the issue persists.
                </p>
              </Card>
            )}

            {/* Empty State */}
            {isAuthenticated && isPro && !isLoading && displaySummaries.length === 0 && (
              <Card className="p-12 text-center mt-6">
                <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No summaries available yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  AI summaries are generated automatically each day. Check back soon for the latest insights.
                </p>
                {user?.role === "admin" && (
                  <GenerateSummariesButton />
                )}
              </Card>
            )}

            {/* Summary Cards */}
            {isAuthenticated && !isLoading && displaySummaries.length > 0 && (
              <div className="space-y-6 mt-6">
                {displaySummaries.map((summary) => (
                  <SummaryCard 
                    key={summary.id} 
                    summary={summary} 
                    isPro={isPro}
                    canEdit={canEdit || false}
                  />
                ))}
              </div>
            )}

            {/* Preview for Free Users */}
            {isAuthenticated && !isPro && (
              <div className="space-y-6 mt-6">
                {['M&A', 'Operations', 'Development'].map((category) => (
                  <SummaryCard 
                    key={category}
                    summary={{
                      id: 0,
                      category,
                      period: 'daily',
                      summaryText: '',
                      keyTrends: null,
                      articleCount: 0,
                      avgRelevance: null,
                      topSources: null,
                      comparisonText: null,
                      previousPeriodCount: null,
                      growthPercentage: null,
                      generatedAt: new Date().toISOString(),
                      periodStart: new Date().toISOString(),
                      periodEnd: new Date().toISOString(),
                      isEdited: false,
                      editedBy: null,
                      editedAt: null
                    }}
                    isPro={false}
                    canEdit={false}
                  />
                ))}
              </div>
            )}
        </div>
        
        {/* Paywall Modal */}
        <PaywallModal
          open={showPaywall}
          onOpenChange={setShowPaywall}
          packType="analytics_pro"
          featureName="Market Intelligence Pro"
        />
    </div>
  );
}
