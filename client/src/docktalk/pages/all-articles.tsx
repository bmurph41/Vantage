import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchArticles, fetchSystemStats, triggerManualFetch } from "../lib/api";
import { ArticleFilters } from "../types/article";
import FilterBar from "../components/filter-bar";
import ArticleCard from "../components/article-card";
import HeroArticle from "../components/hero-article";
import TrendingSidebar from "../components/trending-sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { connectWebSocket, type WebSocketMessage, type WebSocketController } from "../lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { Bell, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AllArticles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsControllerRef = useRef<WebSocketController | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const [allArticles, setAllArticles] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreArticles, setHasMoreArticles] = useState(true);
  
  const [filters, setFilters] = useState<ArticleFilters>({
    limit: 50,
    offset: 0,
    sortBy: 'newest'
  });
  
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update search filter when debounced search changes
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      search: debouncedSearch || undefined,
      offset: 0
    }));
  }, [debouncedSearch]);

  // Fetch articles data
  const { 
    data: articlesData = [], 
    isLoading: articlesLoading,
    error: articlesError,
    refetch: refetchArticles
  } = useQuery({
    queryKey: ['/api/docktalk/articles', filters],
    queryFn: () => fetchArticles(filters),
    refetchInterval: 5 * 60 * 1000,
  });

  // Handle both array and paginated response formats
  const fetchedArticles = Array.isArray(articlesData) ? articlesData : (articlesData as any).items || [];

  // Update accumulated articles when new data arrives
  useEffect(() => {
    if (!articlesLoading && fetchedArticles.length > 0) {
      if (filters.offset === 0) {
        // Reset - new search or filter change
        setAllArticles(fetchedArticles);
        setHasMoreArticles(fetchedArticles.length >= (filters.limit || 50));
        setIsLoadingMore(false);
      } else {
        // Append - loading more articles
        setAllArticles(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newArticles = fetchedArticles.filter(a => !existingIds.has(a.id));
          return [...prev, ...newArticles];
        });
        setHasMoreArticles(fetchedArticles.length >= (filters.limit || 50));
        setIsLoadingMore(false);
      }
    } else if (!articlesLoading && fetchedArticles.length === 0 && filters.offset > 0) {
      // No more articles to load
      setHasMoreArticles(false);
      setIsLoadingMore(false);
    }
  }, [articlesData, articlesLoading, fetchedArticles.length, filters.offset, filters.limit]);

  const articles = allArticles;

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMoreArticles || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreArticles && !isLoadingMore && !articlesLoading) {
          setIsLoadingMore(true);
          setFilters(prev => ({
            ...prev,
            offset: (prev.offset || 0) + (prev.limit || 50)
          }));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreArticles, isLoadingMore, articlesLoading]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    wsControllerRef.current = connectWebSocket((message: WebSocketMessage) => {
      if (message.type === "new_article") {
        setNewArticlesCount(prev => prev + 1);
        
        toast({
          title: "New Article Available",
          description: (
            <div className="flex items-start gap-2">
              <Bell className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{message.payload.title}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {message.payload.source} • {message.payload.category}
                </p>
              </div>
            </div>
          ),
          action: (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                setNewArticlesCount(0);
                refetchArticles();
              }}
            >
              Refresh
            </Button>
          ),
        });
      }
    });

    return () => {
      if (wsControllerRef.current) {
        wsControllerRef.current.stop();
        wsControllerRef.current = null;
      }
    };
  }, [toast, refetchArticles]);

  const { 
    data: systemStats,
    isLoading: statsLoading 
  } = useQuery({
    queryKey: ['/api/docktalk/analytics/stats'],
    queryFn: fetchSystemStats,
    refetchInterval: 60 * 1000,
  });

  // Manual fetch mutation
  const manualFetchMutation = useMutation({
    mutationFn: triggerManualFetch,
    onSuccess: (data) => {
      refetchArticles();
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/analytics/stats'] });
      toast({
        title: "Fetch Complete",
        description: `Found ${data.newArticles} new article${data.newArticles !== 1 ? 's' : ''}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Fetch Failed",
        description: error instanceof Error ? error.message : "Failed to fetch RSS feeds",
        variant: "destructive",
      });
    },
  });

  // Split articles for layout
  const heroArticle = articles[0];
  const featuredArticles = articles.slice(1, 3);
  const regularArticles = articles.slice(3);

  const handleFilterChange = (newFilters: Partial<ArticleFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, offset: 0 }));
    setAllArticles([]);
    setHasMoreArticles(true);
    setIsLoadingMore(false);
  };

  const handleClearFilters = () => {
    setFilters({
      limit: 50,
      offset: 0,
      sortBy: 'newest'
    });
    setSearchQuery("");
    setAllArticles([]);
    setHasMoreArticles(true);
    setIsLoadingMore(false);
  };

  if (articlesError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Articles</h2>
          <p className="text-muted-foreground mb-4">
            {articlesError instanceof Error ? articlesError.message : "An unexpected error occurred"}
          </p>
          <Button onClick={() => refetchArticles()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-950">
      <div className="h-full overflow-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Action Bar with Fetch Button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => manualFetchMutation.mutate()}
                  disabled={manualFetchMutation.isPending}
                  variant="outline"
                  size="sm"
                  data-testid="button-fetch-now"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${manualFetchMutation.isPending ? 'animate-spin' : ''}`} />
                  {manualFetchMutation.isPending ? 'Fetching...' : 'Fetch Now'}
                </Button>
                
                {systemStats?.lastUpdate && (
                  <span className="text-sm text-gray-500 dark:text-gray-400" data-testid="text-last-update">
                    Last updated {formatDistanceToNow(new Date(systemStats.lastUpdate), { addSuffix: true })}
                  </span>
                )}
              </div>

              {newArticlesCount > 0 && (
                <Button
                  onClick={() => {
                    setNewArticlesCount(0);
                    refetchArticles();
                  }}
                  variant="default"
                  size="sm"
                  data-testid="button-load-new-articles"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  {newArticlesCount} New Article{newArticlesCount !== 1 ? 's' : ''}
                </Button>
              )}
            </div>

            {/* Filter Bar */}
            <FilterBar 
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              lastUpdate={systemStats?.lastUpdate}
              data-testid="filter-bar"
            />

            {articlesLoading ? (
              <div className="space-y-8 mt-6">
                <div className="w-full h-[500px] bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-80 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
                    ))}
                  </div>
                  <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
                </div>
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No articles found. Try adjusting your filters or fetch new content.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Hero Article */}
                  {heroArticle && (
                    <HeroArticle article={heroArticle} data-testid="hero-article" />
                  )}

                  {/* Regular Articles */}
                  <div className="space-y-6">
                    {regularArticles.map((article) => (
                      <ArticleCard 
                        key={article.id} 
                        article={article}
                        data-testid={`article-card-${article.id}`}
                      />
                    ))}
                  </div>

                  {/* Infinite Scroll Sentinel & Loading Indicator */}
                  <div ref={sentinelRef} className="text-center py-6">
                    {isLoadingMore && (
                      <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Loading more articles...</span>
                      </div>
                    )}
                    {!hasMoreArticles && articles.length > 0 && (
                      <p className="text-gray-500 dark:text-gray-400">
                        You've reached the end of all articles
                      </p>
                    )}
                  </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                  <TrendingSidebar data-testid="trending-sidebar" />
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
