import { useState } from "react";
import { Article } from "../types/article";
import { formatDistanceToNow } from "date-fns";
import { TrendingUp, Heart, Eye, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTrendingArticles, toggleArticleLike, TrendingArticle } from "../lib/api";
import { Skeleton } from "@/components/ui/skeleton";

interface TrendingSidebarProps {
  articles?: Article[];
}

const CATEGORY_COLORS: Record<string, string> = {
  "Macro": "bg-blue-600",
  "Development": "bg-purple-600",
  "Operations": "bg-orange-600",
  "Regulatory": "bg-red-600",
  "Environmental": "bg-green-600",
  "Technology": "bg-indigo-600",
  "Marina Sale": "bg-rose-600",
  "Education": "bg-emerald-600",
  "General": "bg-gray-600"
};

export default function TrendingSidebar({ articles: fallbackArticles }: TrendingSidebarProps) {
  const queryClient = useQueryClient();
  const [optimisticLikes, setOptimisticLikes] = useState<Record<number, boolean>>({});

  const { data: trendingArticles, isLoading } = useQuery<TrendingArticle[]>({
    queryKey: ['/api/docktalk/articles/trending'],
    queryFn: () => fetchTrendingArticles(10, 48),
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const likeMutation = useMutation({
    mutationFn: (articleId: number) => toggleArticleLike(articleId),
    onMutate: async (articleId) => {
      const currentLiked = trendingArticles?.find(a => a.id === articleId)?.isLiked;
      setOptimisticLikes(prev => ({ ...prev, [articleId]: !currentLiked }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/articles/trending'] });
    },
    onSettled: (_, __, articleId) => {
      setOptimisticLikes(prev => {
        const newState = { ...prev };
        delete newState[articleId];
        return newState;
      });
    },
  });

  const handleLike = (e: React.MouseEvent, articleId: number) => {
    e.stopPropagation();
    likeMutation.mutate(articleId);
  };

  const getIsLiked = (article: TrendingArticle) => {
    if (optimisticLikes[article.id] !== undefined) {
      return optimisticLikes[article.id];
    }
    return article.isLiked;
  };

  const displayArticles = trendingArticles && trendingArticles.length > 0 
    ? trendingArticles 
    : (fallbackArticles?.slice(0, 10).map(a => ({ ...a, viewCount: 0, likeCount: 0, engagementScore: 0, isLiked: false })) || []);

  const hasTrendingData = trendingArticles && trendingArticles.length > 0 && trendingArticles.some(a => a.engagementScore > 0);

  return (
    <aside 
      className="sticky top-24 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 h-fit"
      data-testid="trending-sidebar"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        {hasTrendingData ? (
          <Flame className="h-5 w-5 text-orange-500" />
        ) : (
          <TrendingUp className="h-5 w-5 text-red-500" />
        )}
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {hasTrendingData ? "Trending Now" : "Top Stories"}
        </h2>
        {hasTrendingData && (
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            Last 48h
          </span>
        )}
      </div>

      {/* Trending List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))
        ) : displayArticles.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No trending articles yet. Start engaging with articles to see what's popular!
          </p>
        ) : (
          displayArticles.map((article, index) => {
            const trendingArticle = article as TrendingArticle;
            const isLiked = getIsLiked(trendingArticle);
            
            return (
              <article
                key={article.id}
                className="flex gap-3 group cursor-pointer"
                onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
                data-testid={`trending-article-${index + 1}`}
              >
                {/* Number Badge */}
                <div 
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm",
                    CATEGORY_COLORS[article.category || "General"] || CATEGORY_COLORS["General"]
                  )}
                  data-testid={`trending-badge-${index + 1}`}
                >
                  {index + 1}
                </div>

                {/* Article Info */}
                <div className="flex-1 min-w-0">
                  <h3 
                    className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1"
                    data-testid={`trending-title-${index + 1}`}
                  >
                    {article.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                    {article.category && (
                      <>
                        <span 
                          className="font-medium"
                          data-testid={`trending-category-${index + 1}`}
                        >
                          {article.category}
                        </span>
                        <span>•</span>
                      </>
                    )}
                    <span data-testid={`trending-time-${index + 1}`}>
                      {article.publishedAt 
                        ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
                        : "Unknown"
                      }
                    </span>
                  </div>

                  {/* Engagement Stats */}
                  {hasTrendingData && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        onClick={(e) => handleLike(e, article.id)}
                        className={cn(
                          "flex items-center gap-1 text-xs transition-colors",
                          isLiked 
                            ? "text-red-500" 
                            : "text-gray-400 hover:text-red-500"
                        )}
                        data-testid={`trending-like-${index + 1}`}
                      >
                        <Heart 
                          className={cn("h-3.5 w-3.5", isLiked && "fill-current")} 
                        />
                        <span>{trendingArticle.likeCount || 0}</span>
                      </button>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Eye className="h-3.5 w-3.5" />
                        <span>{trendingArticle.viewCount || 0}</span>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
