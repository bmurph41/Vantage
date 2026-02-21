import { Article } from "../types/article";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Building2, Clock, TrendingUp } from "lucide-react";

interface HeroArticleProps {
  article: Article;
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

export default function HeroArticle({ article }: HeroArticleProps) {
  const primaryCategory = (article.categories && article.categories[0]) || article.category || "General";
  const categoryStyle = CATEGORY_COLORS[primaryCategory] || CATEGORY_COLORS["General"];

  const handleClick = () => {
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article 
      className={cn(
        "relative w-full rounded-xl overflow-hidden group cursor-pointer",
        "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800",
        "border-l-4",
        categoryStyle.border,
        "hover:shadow-lg transition-shadow duration-200"
      )}
      onClick={handleClick}
      data-testid={`hero-article-${article.id}`}
    >
      <div className="p-8 lg:p-10">
        <div className="flex items-start gap-3 mb-4">
          <Badge 
            variant="secondary"
            className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-0 text-xs font-semibold uppercase px-2.5 py-1"
          >
            <TrendingUp className="h-3 w-3 mr-1.5" />
            Featured
          </Badge>
          {(article.categories || [article.category]).filter(Boolean).slice(0, 3).map((cat) => {
            const style = CATEGORY_COLORS[cat as string] || CATEGORY_COLORS["General"];
            return (
              <Badge 
                key={cat}
                variant="secondary"
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide px-2.5 py-1",
                  style.bg,
                  style.text,
                  "border-0"
                )}
                data-testid={`hero-badge-category-${(cat as string).toLowerCase()}`}
              >
                {cat}
              </Badge>
            );
          })}
        </div>

        <h1 
          className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
          data-testid={`hero-title-${article.id}`}
        >
          {article.title}
        </h1>

        {article.summary && (
          <p 
            className="text-base lg:text-lg text-gray-600 dark:text-gray-300 mb-6 max-w-4xl line-clamp-3"
            data-testid={`hero-summary-${article.id}`}
          >
            {article.summary}
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-5 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
              <Building2 className="h-4 w-4" />
              {article.source}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
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

          <Button
            variant="default"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            data-testid={`hero-button-read-${article.id}`}
          >
            Read Full Story
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}
