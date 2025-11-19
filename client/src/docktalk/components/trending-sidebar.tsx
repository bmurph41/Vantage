import { Article } from "../types/article";
import { formatDistanceToNow } from "date-fns";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendingSidebarProps {
  articles: Article[];
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

export default function TrendingSidebar({ articles }: TrendingSidebarProps) {
  const topArticles = articles.slice(0, 10);

  return (
    <aside 
      className="sticky top-24 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 h-fit"
      data-testid="trending-sidebar"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        <TrendingUp className="h-5 w-5 text-red-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Trending Now
        </h2>
      </div>

      {/* Trending List */}
      <div className="space-y-4">
        {topArticles.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No trending articles yet
          </p>
        ) : (
          topArticles.map((article, index) => (
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
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
