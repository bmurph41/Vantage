import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateBookmarkStatus, toggleArticleLike, recordArticleView } from "../lib/api";
import { Article } from "../types/article";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Bookmark, Share2, ExternalLink, Heart } from "lucide-react";

interface ArticleCardProps {
  article: Article;
  featured?: boolean;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Macro": { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", border: "border-l-blue-500" },
  "Development": { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-400", border: "border-l-purple-500" },
  "Operations": { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", border: "border-l-orange-500" },
  "Regulatory": { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-l-red-500" },
  "Environmental": { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", border: "border-l-green-500" },
  "Technology": { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-400", border: "border-l-indigo-500" },
  "General": { bg: "bg-gray-50 dark:bg-gray-900/30", text: "text-gray-700 dark:text-gray-400", border: "border-l-gray-500" },
  "Boat Sales": { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-700 dark:text-cyan-400", border: "border-l-cyan-500" },
  "Industry Trends": { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", border: "border-l-amber-500" },
  "Marina Sale": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", border: "border-l-rose-500" },
  "Education": { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", border: "border-l-emerald-500" },
  "Insurance": { bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-700 dark:text-yellow-400", border: "border-l-yellow-500" },
  "Legal": { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-700 dark:text-pink-400", border: "border-l-pink-500" }
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

  // Get primary category for border color (first category or fall back to legacy category)
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
    // Record the view (fire and forget - don't block the click)
    recordArticleView(article.id).catch(() => {});
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article 
      className={cn(
        "group bg-white dark:bg-gray-900 rounded-lg overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-1 cursor-pointer border border-gray-200 dark:border-gray-800",
        featured && "border-l-4", 
        featured && primaryCategoryStyle.border
      )}
      onClick={handleClick}
      data-testid={`article-card-${article.id}`}
    >
      {/* Article Image - Only show if imageUrl exists */}
      {article.imageUrl && (
        <div className={cn(
          "relative overflow-hidden",
          featured ? "aspect-[16/9]" : "aspect-[4/3]"
        )}>
          <img 
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            data-testid={`image-article-${article.id}`}
          />
          
          {/* Category Badges Overlay */}
          {(article.categories && article.categories.length > 0) && (
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[calc(100%-24px)]">
              {article.categories.slice(0, 3).map((cat) => {
                const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS["General"];
                return (
                  <Badge 
                    key={cat}
                    className={cn(
                      "uppercase text-xs font-semibold",
                      style.bg,
                      style.text,
                      "border-0 shadow-sm"
                    )}
                    data-testid={`badge-category-${cat.toLowerCase().replace(/ /g, '-')}`}
                  >
                    {cat}
                  </Badge>
                );
              })}
              {article.categories.length > 3 && (
                <Badge 
                  className="bg-gray-50 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400 uppercase text-xs font-semibold border-0 shadow-sm"
                >
                  +{article.categories.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* Article Content */}
      <div className={cn("p-6", featured && "p-8")}>
        {/* Category Badges - Show inline if no image */}
        {!article.imageUrl && article.categories && article.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {article.categories.map((cat) => {
              const style = CATEGORY_COLORS[cat] || CATEGORY_COLORS["General"];
              return (
                <Badge 
                  key={cat}
                  className={cn(
                    "w-fit uppercase text-xs font-semibold",
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
          </div>
        )}
        {/* Headline */}
        <h3 
          className={cn(
            "font-semibold text-gray-900 dark:text-gray-100 mb-3 line-clamp-2",
            "group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
            featured ? "text-2xl leading-tight" : "text-xl leading-snug"
          )}
          data-testid={`title-article-${article.id}`}
        >
          {article.title}
        </h3>

        {/* Summary */}
        {article.summary && (
          <p 
            className={cn(
              "text-gray-600 dark:text-gray-400 mb-3",
              featured ? "text-base line-clamp-3" : "text-sm line-clamp-2"
            )}
            data-testid={`summary-article-${article.id}`}
          >
            {article.summary}
          </p>
        )}

        {/* Footer: Metadata + Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
          {/* Source and Date */}
          <div className="flex flex-col gap-1">
            <span 
              className="text-sm font-medium text-gray-900 dark:text-gray-100"
              data-testid={`source-${article.id}`}
            >
              {article.source}
            </span>
            <span 
              className="text-xs text-gray-500 dark:text-gray-500"
              data-testid={`published-${article.id}`}
            >
              {article.publishedAt 
                ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
                : "Unknown date"
              }
              {article.relevanceScore && article.relevanceScore >= 70 && (
                <span className="ml-2 text-green-600 dark:text-green-400">
                  • {article.relevanceScore}% relevance
                </span>
              )}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLike}
              disabled={likeMutation.isPending}
              className={cn(
                "h-8 w-8",
                isLiked && "text-red-500 hover:text-red-600"
              )}
              data-testid={`button-like-${article.id}`}
            >
              <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleBookmark}
              disabled={bookmarkMutation.isPending}
              className={cn(
                "h-8 w-8",
                article.isBookmarked && "text-amber-500 hover:text-amber-600"
              )}
              data-testid={`button-bookmark-${article.id}`}
            >
              <Bookmark className={cn("h-4 w-4", article.isBookmarked && "fill-current")} />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="h-8 w-8"
              data-testid={`button-share-${article.id}`}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              data-testid={`button-external-${article.id}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
