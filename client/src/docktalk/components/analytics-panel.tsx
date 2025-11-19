import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTrendingTopics, fetchSourceDistribution, triggerManualFetch } from "@/lib/api";
import { SystemStats } from "@/types/article";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AnalyticsPanelProps {
  systemStats?: SystemStats;
  statsLoading: boolean;
}

function StatusIndicator({ status }: { status: string | null }) {
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "online":
      case "active":  
      case "healthy":
        return "bg-green-500";
      case "processing":
      case "warning":
        return "bg-yellow-500";
      case "offline":
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string | null) => {
    switch (status) {
      case "online": return "Online";
      case "active": return "Active";
      case "processing": return "Processing";
      case "healthy": return "Healthy";
      case "warning": return "Warning";
      case "offline": return "Offline";
      case "error": return "Error";
      default: return "Unknown";
    }
  };

  return (
    <div className="flex items-center">
      <span className={cn("w-2 h-2 rounded-full mr-2", getStatusColor(status))} />
      <span className={cn(
        "text-sm",
        status === "online" || status === "active" || status === "healthy" ? "text-green-600" : 
        status === "processing" || status === "warning" ? "text-yellow-600" : 
        "text-red-600"
      )}>
        {getStatusText(status)}
      </span>
    </div>
  );
}

export default function AnalyticsPanel({ systemStats, statsLoading }: AnalyticsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: trendingTopics = [], isLoading: trendingLoading } = useQuery({
    queryKey: ['/api/analytics/trending'],
    queryFn: fetchTrendingTopics,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: sourceDistribution = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['/api/analytics/sources'],
    queryFn: fetchSourceDistribution,
    refetchInterval: 5 * 60 * 1000,
  });

  const manualFetchMutation = useMutation({
    mutationFn: triggerManualFetch,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
      toast({
        title: "Fetch completed",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Fetch failed",
        description: error instanceof Error ? error.message : "Failed to fetch articles",
        variant: "destructive",
      });
    },
  });

  const handleManualFetch = () => {
    manualFetchMutation.mutate();
  };

  // Calculate RSS vs Scraped percentages
  const totalSources = sourceDistribution.reduce((sum, s) => sum + s.count, 0);
  const rssCount = sourceDistribution.filter(s => s.type === 'rss').reduce((sum, s) => sum + s.count, 0);
  const scrapedCount = totalSources - rssCount;
  const rssPercentage = totalSources > 0 ? Math.round((rssCount / totalSources) * 100) : 0;
  const scrapedPercentage = 100 - rssPercentage;

  return (
    <div className="w-80 bg-card border-l border-border p-6 overflow-y-auto">
      {/* Analytics Overview */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Analytics Overview</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-muted rounded-lg p-4">
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-20" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground" data-testid="stat-today-articles">
                  {systemStats?.todayArticles || 0}
                </div>
                <div className="text-sm text-muted-foreground">Today's Articles</div>
              </>
            )}
          </div>
          <div className="bg-muted rounded-lg p-4">
            {statsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-20" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground" data-testid="stat-avg-relevance">
                  {systemStats?.avgRelevance || 0}%
                </div>
                <div className="text-sm text-muted-foreground">Avg Relevance</div>
              </>
            )}
          </div>
        </div>
        
        <div className="bg-muted rounded-lg p-4 mb-4">
          <div className="text-sm text-muted-foreground mb-2">Source Distribution</div>
          {sourcesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">RSS Feeds</span>
                <span className="text-sm font-medium" data-testid="text-rss-percentage">
                  {rssPercentage}%
                </span>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${rssPercentage}%` }}
                />
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Web Scraping</span>
                <span className="text-sm font-medium" data-testid="text-scraped-percentage">
                  {scrapedPercentage}%
                </span>
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div 
                  className="bg-secondary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${scrapedPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trending Topics */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Trending Topics</h3>
        {trendingLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {trendingTopics.slice(0, 4).map((topic, index) => (
              <div key={topic.topic} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium" data-testid={`trending-topic-${index}`}>
                  {topic.topic}
                </span>
                <Badge 
                  className={cn(
                    "text-xs px-2 py-1 rounded-full",
                    topic.growth > 20 ? "bg-green-100 text-green-800" :
                    topic.growth > 10 ? "bg-blue-100 text-blue-800" :
                    topic.growth > 5 ? "bg-purple-100 text-purple-800" :
                    "bg-red-100 text-red-800"
                  )}
                  data-testid={`trending-growth-${index}`}
                >
                  +{topic.growth}%
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Status */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">System Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">RSS Aggregator</span>
            <StatusIndicator status={systemStats?.rssFeedStatus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Web Scraper</span>
            <StatusIndicator status={systemStats?.scraperStatus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">AI Summarizer</span>
            <StatusIndicator status={systemStats?.aiStatus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Database</span>
            <StatusIndicator status={systemStats?.dbStatus} />
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Next scheduled update</div>
          <div className="text-sm font-medium" data-testid="text-next-update">
            In 42 minutes
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="space-y-2">
          <Button 
            className="w-full"
            onClick={handleManualFetch}
            disabled={manualFetchMutation.isPending}
            data-testid="button-force-update"
          >
            <i className="fas fa-sync-alt mr-2"></i>
            {manualFetchMutation.isPending ? "Updating..." : "Force Update Now"}
          </Button>
          <Button 
            variant="outline"
            className="w-full"
            data-testid="button-export"
          >
            <i className="fas fa-download mr-2"></i>
            Export Articles
          </Button>
          <Button 
            variant="outline"
            className="w-full"
            data-testid="button-add-source"
          >
            <i className="fas fa-plus mr-2"></i>
            Add RSS Source
          </Button>
        </div>
      </div>
    </div>
  );
}

// Missing Badge import - let's add it
import { Badge } from "@/components/ui/badge";
