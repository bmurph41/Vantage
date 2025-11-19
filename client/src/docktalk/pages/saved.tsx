import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchArticles, fetchSystemStats, triggerManualFetch } from "../lib/api";
import { ArticleFilters } from "../types/article";
import Navigation from "../components/navigation";
import Sidebar from "../components/sidebar";
import FilterBar from "../components/filter-bar";
import ArticleCard from "../components/article-card";
import HeroArticle from "../components/hero-article";
import TrendingSidebar from "../components/trending-sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { connectWebSocket, type WebSocketMessage, type WebSocketController } from "../lib/websocket";
import { useToast } from "@/hooks/use-toast";
import { Bell, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function SavedArticles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsControllerRef = useRef<WebSocketController | null>(null);
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  
  const [filters, setFilters] = useState<ArticleFilters>({
    limit: 50,
    offset: 0,
    sortBy: 'newest',
    bookmarked: true
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showBookmarked, setShowBookmarked] = useState(true);

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
    data: articles = [], 
    isLoading: articlesLoading,
    error: articlesError,
    refetch: refetchArticles
  } = useQuery({
    queryKey: ['/api/articles', filters],
    queryFn: () => fetchArticles(filters),
    refetchInterval: 5 * 60 * 1000,
  });

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
    queryKey: ['/api/analytics/stats'],
    queryFn: fetchSystemStats,
    refetchInterval: 60 * 1000,
  });

  // Manual fetch mutation
  const manualFetchMutation = useMutation({
    mutationFn: triggerManualFetch,
    onSuccess: (data) => {
      refetchArticles();
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/stats'] });
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

  const filteredArticles = useMemo(() => {
    if (!showBookmarked) return articles;
    return articles.filter(article => article.isBookmarked);
  }, [articles, showBookmarked]);

  // Split articles for layout
  const heroArticle = filteredArticles[0];
  const featuredArticles = filteredArticles.slice(1, 3);
  const regularArticles = filteredArticles.slice(3);

  const handleLoadMore = () => {
    setFilters(prev => ({
      ...prev,
      offset: (prev.offset || 0) + (prev.limit || 50)
    }));
  };

  const handleFilterChange = (newFilters: Partial<ArticleFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, offset: 0 }));
  };

  const handleClearFilters = () => {
    setFilters({
      limit: 50,
      offset: 0,
      sortBy: 'newest'
    });
    setSearchQuery("");
    setShowBookmarked(false);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        data-testid="main-navigation"
      />
      
      <div className="flex">
        <Sidebar 
          selectedCategories={filters.categories || []}
          onCategoryToggle={(category) => {
            const currentCategories = filters.categories || [];
            const newCategories = currentCategories.includes(category)
              ? currentCategories.filter(c => c !== category)
              : [...currentCategories, category];
            
            handleFilterChange({ 
              categories: newCategories.length > 0 ? newCategories : undefined 
            });
          }}
          onClearCategories={() => {
            handleFilterChange({ categories: undefined });
          }}
          showBookmarked={showBookmarked}
          onBookmarkedChange={setShowBookmarked}
          data-testid="sidebar"
        />
        
        <div className="flex-1 p-6 lg:p-8">
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
            ) : filteredArticles.length === 0 ? (
              <div className="text-center py-20" data-testid="no-articles">
                <div className="text-muted-foreground mb-6">
                  <div className="text-6xl mb-4">📰</div>
                  <h3 className="text-2xl font-semibold mb-2">No articles found</h3>
                  <p className="text-lg">Try adjusting your filters or search terms</p>
                </div>
                <Button variant="outline" size="lg" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="space-y-8 mt-6">
                {/* Hero Article */}
                {heroArticle && (
                  <HeroArticle article={heroArticle} />
                )}

                {/* Main Content + Trending Sidebar */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Main Content Column */}
                  <div className="lg:col-span-2 space-y-8">
                    {/* Featured Articles Section */}
                    {featuredArticles.length > 0 && (
                      <section>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 pb-2 border-b-2 border-primary">
                          Top Stories
                        </h2>
                        <div className="grid gap-6">
                          {featuredArticles.map((article) => (
                            <ArticleCard 
                              key={article.id} 
                              article={article}
                              featured={true}
                              data-testid={`article-card-featured-${article.id}`}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Latest News Section */}
                    {regularArticles.length > 0 && (
                      <section>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 pb-2 border-b-2 border-primary">
                          Latest News
                        </h2>
                        <div className="grid gap-6 md:grid-cols-2">
                          {regularArticles.map((article) => (
                            <ArticleCard 
                              key={article.id} 
                              article={article}
                              data-testid={`article-card-${article.id}`}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Load More */}
                    {filteredArticles.length >= (filters.limit || 50) && (
                      <div className="text-center pt-4">
                        <Button 
                          variant="outline" 
                          size="lg"
                          onClick={handleLoadMore}
                          data-testid="button-load-more"
                        >
                          Load More Articles
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Trending Sidebar */}
                  <div className="lg:col-span-1">
                    <TrendingSidebar articles={filteredArticles} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
