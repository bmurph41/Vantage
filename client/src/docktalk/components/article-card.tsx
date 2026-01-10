import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateBookmarkStatus, toggleArticleLike, recordArticleView } from "../lib/api";
import { Article } from "../types/article";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Bookmark, Share2, ExternalLink, Heart, Clock, Building2 } from "lucide-react";

interface ArticleCardProps {
  article: Article;
  featured?: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Macro": { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-400", border: "border-l-blue-500" },
  "M&A": { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400", border: "border-l-orange-500" },
  "Development": { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-400", border: "border-l-purple-500" },
  "Operations": { bg: "bg-slate-50 dark:bg-slate-950/40", text: "text-slate-700 dark:text-slate-400", border: "border-l-slate-500" },
  "Regulatory": { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-400", border: "border-l-red-500" },
  "Environmental": { bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-700 dark:text-green-400", border: "border-l-green-500" },
  "Technology": { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-400", border: "border-l-indigo-500" },
  "General": { bg: "bg-gray-50 dark:bg-gray-900/40", text: "text-gray-700 dark:text-gray-400", border: "border-l-gray-400" },
  "Boat Sales": { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-400", border: "border-l-cyan-500" },
  "Boat Show": { bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-400", border: "border-l-pink-500" },
  "Manufacturing": { bg: "bg-stone-50 dark:bg-stone-950/40", text: "text-stone-700 dark:text-stone-400", border: "border-l-stone-500" },
  "Industry Trends": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", border: "border-l-amber-500" },
  "Marina Sale": { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-400", border: "border-l-rose-500" },
  "Education": { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", border: "border-l-emerald-500" },
  "Insurance": { bg: "bg-yellow-50 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-400", border: "border-l-yellow-500" },
  "Legal": { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", text: "text-fuchsia-700 dark:text-fuchsia-400", border: "border-l-fuchsia-500" },
  "People Moves": { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-400", border: "border-l-teal-500" },
  "Company Earnings": { bg: "bg-lime-50 dark:bg-lime-950/40", text: "text-lime-700 dark:text-lime-400", border: "border-l-lime-500" },
  "Awards": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", border: "border-l-amber-500" },
  "Business Planning": { bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-400", border: "border-l-violet-500" },
  "International": { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-400", border: "border-l-sky-500" },
  "Interview": { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", text: "text-fuchsia-700 dark:text-fuchsia-400", border: "border-l-fuchsia-500" }
};

interface ExtendedArticle extends Article {
  isLiked?: boolean;
  likeCount?: number;
  viewCount?: number;
}

export default function ArticleCard({ article, featured = false }: ArticleCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const extArticle = article as ExtendedArticle;
  const [isLiked, setIsLiked] = useState(extArticle.isLiked || false);

  const primaryCategory = (article.categories && article.categories[0]) || article.category || "General";
  const primaryCategoryStyle = CATEGORY_COLORS[primaryCategory] || CATEGORY_COLORS["General"];

  const likeMutation = useMutation({
    mutationFn: () => toggleArticleLike(article.id),
    onMutate: async () => {
      setIsLiked(!isLiked);
    },
    onSuccess: (data) => {
      setIsLiked(data.liked);
      queryClient.invalidateQueries({ queryKey: ['/api/docktalk/articles/trending'] });
    },
    onError: () => {
      setIsLiked(extArticle.isLiked || false);
      toast({
        title: "Error",
        description: "Failed to update like status",
        variant: "destructive",
      });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: ({ id, isBookmarked }: { id: number; isBookmarked: boolean }) =>
      updateBookmarkStatus(id, isBookmarked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
      toast({
        title: article.isBookmarked ? "Bookmark removed" : "Article bookmarked",
        description: article.isBookmarked 
          ? "Article removed from your saved items"
          : "Article saved to your bookmarks",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update bookmark",
        variant: "destructive",
      });
    },
  });

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    bookmarkMutation.mutate({
      id: article.id,
      isBookmarked: !article.isBookmarked
    });
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: article.title,
        url: article.url,
      });
    } else {
      navigator.clipboard.writeText(article.url);
      toast({
        title: "Link copied",
        description: "Article link copied to clipboard",
      });
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    likeMutation.mutate();
  };

  const handleClick = () => {
    recordArticleView(article.id).catch(() => {});
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article 
      className={cn(
        "group bg-white dark:bg-gray-900 rounded-lg overflow-hidden transition-all duration-200",
        "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer",
        "border border-gray-200 dark:border-gray-800",
        "border-l-4",
        primaryCategoryStyle.border
      )}
      onClick={handleClick}
      data-testid={`article-card-${article.id}`}
    >
      <div className={cn("p-5", featured && "p-6")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              {article.categories && article.categories.length > 0 && (
                <>
                  {article.categories.slice(0, 3).map((cat) => {
                    const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS["General"];
                    return (
                      <Badge 
                        key={cat}
                        variant="secondary"
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5",
                          style.bg,
                          style.text,
                          "border-0"
                        )}
                        data-testid={`badge-category-${cat.toLowerCase().replace(/ /g, '-')}`}
                      >
                        {cat}
                      </Badge>
                    );
                  })}
                  {article.categories.length > 3 && (
                    <Badge 
                      variant="secondary"
                      className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500"
                    >
                      +{article.categories.length - 3}
                    </Badge>
                  )}
                </>
              )}
            </div>

            <h3 
              className={cn(
                "font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-2",
                "group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
                featured ? "text-lg" : "text-base"
              )}
              data-testid={`title-article-${article.id}`}
            >
              {article.title}
            </h3>

            {article.summary && (
              <p 
                className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3"
                data-testid={`summary-article-${article.id}`}
              >
                {article.summary}
              </p>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                  <Building2 className="h-3.5 w-3.5" />
                  {article.source}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {article.publishedAt 
                    ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
                    : "Unknown date"
                  }
                </span>
                {article.relevanceScore && article.relevanceScore >= 70 && (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {article.relevanceScore}% relevant
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLike}
                  disabled={likeMutation.isPending}
                  className={cn(
                    "h-7 w-7",
                    isLiked ? "text-red-500 hover:text-red-600" : "text-gray-400 hover:text-gray-600"
                  )}
                  data-testid={`button-like-${article.id}`}
                >
                  <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBookmark}
                  disabled={bookmarkMutation.isPending}
                  className={cn(
                    "h-7 w-7",
                    article.isBookmarked ? "text-amber-500 hover:text-amber-600" : "text-gray-400 hover:text-gray-600"
                  )}
                  data-testid={`button-bookmark-${article.id}`}
                >
                  <Bookmark className={cn("h-3.5 w-3.5", article.isBookmarked && "fill-current")} />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShare}
                  className="h-7 w-7 text-gray-400 hover:text-gray-600"
                  data-testid={`button-share-${article.id}`}
                >
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  className="ml-2 h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick();
                  }}
                  data-testid={`button-read-${article.id}`}
                >
                  Read Full Story
                  <ExternalLink className="h-3 w-3 ml-1.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
