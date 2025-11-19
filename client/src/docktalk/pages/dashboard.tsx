import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { useAuth } from "../hooks/use-auth";
import { Bell, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const SESSION_STORAGE_KEY = 'docktalk_filters';

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const wsControllerRef = useRef<WebSocketController | null>(null);
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const prevUserIdRef = useRef<string | null>(user?.id || null);
  
  // Parse URL query params for filters
  const urlParams = new URLSearchParams(window.location.search);
  const filterParam = urlParams.get('filter');
  
  // Load filters from sessionStorage or use defaults
  const getInitialFilters = (): ArticleFilters => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          limit: 50,
          offset: 0,
        };
      }
    } catch (e) {
      console.error('Failed to parse stored filters:', e);
    }
    
    return {
      limit: 50,
      offset: 0,
      sortBy: 'newest'
    };
  };
  
  const [filters, setFilters] = useState<ArticleFilters>(getInitialFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [showBookmarked, setShowBookmarked] = useState(false);
  
  // Save filters to sessionStorage whenever they change
  useEffect(() => {
    if (filtersInitialized) {
      try {
        const filtersToStore = {
          categories: filters.categories,
          sources: filters.sources,
          regions: filters.regions,
          fromDate: filters.fromDate,
          minRelevance: filters.minRelevance,
          sortBy: filters.sortBy,
        };
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(filtersToStore));
      } catch (e) {
        console.error('Failed to save filters to sessionStorage:', e);
      }
    }
  }, [filters, filtersInitialized]);
  
  // Clear sessionStorage when user ID changes (including logout, session expiry, login)
  // This prevents filter bleed between users
  useEffect(() => {
    const currentUserId = user?.id || null;
    
    // Only clear state if there was a previous user ID (skip initial auth resolution)
    // This prevents clearing sessionStorage on page load when auth resolves from null → userID
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== currentUserId) {
      // User ID changed - either logged out, logged in as different user, or session expired
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      
      // Reset ALL filter-related state to prevent UI state bleed
      setFilters({
        limit: 50,
        offset: 0,
        sortBy: 'newest'
      });
      setSearchQuery(""); // Clear search input
      setShowBookmarked(false); // Clear bookmark filter
      
      // Reset initialization to reload defaults for new user
      setFiltersInitialized(false);
      
      // Invalidate preferences query to force refetch for new user (prevent stale cache)
      queryClient.invalidateQueries({ queryKey: ['/api/user/filter-preferences'] });
    }
    
    prevUserIdRef.current = currentUserId;
  }, [user, queryClient]);

  // Apply URL filter params on mount
  useEffect(() => {
    if (filterParam === 'high-relevance') {
      setFilters(prev => ({ ...prev, minRelevance: 80 }));
    } else if (filterParam === 'recent') {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      setFilters(prev => ({ ...prev, fromDate: oneDayAgo.toISOString() }));
    }
  }, [filterParam]);

  // Fetch user filter preferences (user-scoped query key prevents cache bleed)
  const { data: savedPreferences, isFetched: preferencesFetched, isFetching: preferencesFetching } = useQuery<{
    categories?: string[];
    sources?: string[];
    regions?: string[];
    fromDate?: string;
    minRelevance?: number;
    sortBy?: string;
  } | null>({
    queryKey: ['/api/user/filter-preferences', user?.id],
    enabled: !!user, // Only fetch when user is authenticated
  });

  // Load saved preferences ONLY if sessionStorage is empty (first visit)
  // Wait until preferences query has settled before marking as initialized
  useEffect(() => {
    if (preferencesFetched && !filtersInitialized) {
      const hasSessionFilters = sessionStorage.getItem(SESSION_STORAGE_KEY);
      
      // Load from saved defaults only if no session filters exist
      if (!hasSessionFilters && savedPreferences) {
        setFilters(prev => ({
          ...prev,
          categories: savedPreferences.categories || undefined,
          sources: savedPreferences.sources || undefined,
          regions: savedPreferences.regions || undefined,
          fromDate: savedPreferences.fromDate || undefined,
          minRelevance: savedPreferences.minRelevance || undefined,
          sortBy: (savedPreferences.sortBy as 'newest' | 'relevance') || 'newest',
        }));
      }
      
      // Mark as initialized once preferences query has settled
      // This enables sessionStorage writes for all users (with or without saved defaults)
      setFiltersInitialized(true);
    }
  }, [preferencesFetched, savedPreferences, filtersInitialized]);

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
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const handleResetToDefaults = () => {
    if (savedPreferences) {
      setFilters({
        limit: 50,
        offset: 0,
        categories: savedPreferences.categories || undefined,
        sources: savedPreferences.sources || undefined,
        regions: savedPreferences.regions || undefined,
        fromDate: savedPreferences.fromDate || undefined,
        minRelevance: savedPreferences.minRelevance || undefined,
        sortBy: (savedPreferences.sortBy as 'newest' | 'relevance') || 'newest',
      });
      setSearchQuery("");
      setShowBookmarked(false);
      toast({
        title: "Filters Reset",
        description: "Your saved default filters have been applied.",
      });
    }
  };

  const handleLoadFavorite = () => {
    // Don't execute if preferences are still loading
    if (preferencesFetching || !preferencesFetched) {
      return;
    }
    
    if (savedPreferences) {
      setFilters({
        limit: 50,
        offset: 0,
        categories: savedPreferences.categories || undefined,
        sources: savedPreferences.sources || undefined,
        regions: savedPreferences.regions || undefined,
        fromDate: savedPreferences.fromDate || undefined,
        minRelevance: savedPreferences.minRelevance || undefined,
        sortBy: (savedPreferences.sortBy as 'newest' | 'relevance') || 'newest',
      });
      setSearchQuery("");
      setShowBookmarked(false);
      // Clear session storage so the favorite settings become the new session baseline
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      toast({
        title: "Favorite Loaded",
        description: "Your favorite filter settings have been applied.",
      });
    } else {
      toast({
        title: "No Favorite Saved",
        description: "You haven't saved any favorite filter settings yet.",
        variant: "destructive",
      });
    }
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
            {/* Action Bar with Fetch Button and Favorite */}
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
              
              {user && (
                <Button 
                  variant="default"
                  onClick={handleLoadFavorite}
                  disabled={preferencesFetching || !preferencesFetched}
                  size="sm"
                  data-testid="button-load-favorite"
                >
                  <i className="fas fa-star mr-2"></i>
                  {(preferencesFetching || !preferencesFetched) ? "Loading..." : "Favorite"}
                </Button>
              )}
            </div>

            {/* Filter Bar */}
            <FilterBar 
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              onResetToDefaults={handleResetToDefaults}
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
  );
}
