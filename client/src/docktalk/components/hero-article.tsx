import { Article } from "../types/article";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";

interface HeroArticleProps {
  article: Article;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Macro": { bg: "bg-blue-600/90", text: "text-white" },
  "M&A": { bg: "bg-orange-600/90", text: "text-white" },
  "Development": { bg: "bg-purple-600/90", text: "text-white" },
  "Operations": { bg: "bg-slate-600/90", text: "text-white" },
  "Regulatory": { bg: "bg-red-600/90", text: "text-white" },
  "Environmental": { bg: "bg-green-600/90", text: "text-white" },
  "Technology": { bg: "bg-indigo-600/90", text: "text-white" },
  "General": { bg: "bg-gray-600/90", text: "text-white" },
  "Boat Sales": { bg: "bg-cyan-600/90", text: "text-white" },
  "Boat Show": { bg: "bg-pink-600/90", text: "text-white" },
  "Manufacturing": { bg: "bg-stone-600/90", text: "text-white" },
  "Industry Trends": { bg: "bg-amber-600/90", text: "text-white" },
  "Marina Sale": { bg: "bg-rose-600/90", text: "text-white" },
  "Education": { bg: "bg-emerald-600/90", text: "text-white" },
  "Insurance": { bg: "bg-yellow-600/90", text: "text-white" },
  "Legal": { bg: "bg-fuchsia-600/90", text: "text-white" },
  "People Moves": { bg: "bg-teal-600/90", text: "text-white" },
  "Company Earnings": { bg: "bg-lime-600/90", text: "text-white" },
  "Awards": { bg: "bg-amber-600/90", text: "text-white" },
  "Business Planning": { bg: "bg-violet-600/90", text: "text-white" }
};

export default function HeroArticle({ article }: HeroArticleProps) {
  const categoryStyle = CATEGORY_COLORS[article.category || "General"] || CATEGORY_COLORS["General"];

  const handleClick = () => {
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  // If no image, render as a large card instead of full hero
  if (!article.imageUrl) {
    return (
      <article 
        className="relative w-full rounded-xl overflow-hidden group cursor-pointer bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 lg:p-12"
        onClick={handleClick}
        data-testid={`hero-article-${article.id}`}
      >
        {/* Category Badge */}
        {article.category && (
          <Badge 
            className={cn(
              "w-fit mb-4 uppercase text-xs font-bold tracking-wider",
              categoryStyle.bg,
              categoryStyle.text,
              "border-0 px-4 py-1.5"
            )}
            data-testid={`hero-badge-category-${article.category.toLowerCase()}`}
          >
            {article.category}
          </Badge>
        )}

        {/* Headline */}
        <h1 
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight"
          data-testid={`hero-title-${article.id}`}
        >
          {article.title}
        </h1>

        {/* Summary */}
        {article.summary && (
          <p 
            className="text-lg text-gray-600 dark:text-gray-300 mb-6 max-w-3xl"
            data-testid={`hero-summary-${article.id}`}
          >
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Source and Date */}
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span 
              className="font-medium text-gray-900 dark:text-white"
              data-testid={`hero-source-${article.id}`}
            >
              {article.source}
            </span>
            <span className="text-gray-400">•</span>
            <span data-testid={`hero-published-${article.id}`}>
              {article.publishedAt 
                ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
                : "Unknown date"
              }
            </span>
          </div>

          {/* CTA Button */}
          <Button
            variant="default"
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
      </article>
    );
  }

  return (
    <article 
      className="relative w-full h-[500px] lg:h-[600px] rounded-xl overflow-hidden group cursor-pointer"
      onClick={handleClick}
      data-testid={`hero-article-${article.id}`}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          src={article.imageUrl}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          data-testid={`hero-image-${article.id}`}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-12">
        {/* Category Badge */}
        {article.category && (
          <Badge 
            className={cn(
              "w-fit mb-4 uppercase text-xs font-bold tracking-wider",
              categoryStyle.bg,
              categoryStyle.text,
              "border-0 px-4 py-1.5"
            )}
            data-testid={`hero-badge-category-${article.category.toLowerCase()}`}
          >
            {article.category}
          </Badge>
        )}

        {/* Headline */}
        <h1 
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight max-w-4xl"
          data-testid={`hero-title-${article.id}`}
        >
          {article.title}
        </h1>

        {/* Summary */}
        {article.summary && (
          <p 
            className="text-lg text-gray-200 mb-6 max-w-3xl line-clamp-2"
            data-testid={`hero-summary-${article.id}`}
          >
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Source and Date */}
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <span 
              className="font-medium text-white"
              data-testid={`hero-source-${article.id}`}
            >
              {article.source}
            </span>
            <span className="text-gray-400">•</span>
            <span data-testid={`hero-published-${article.id}`}>
              {article.publishedAt 
                ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
                : "Unknown date"
              }
            </span>
          </div>

          {/* CTA Button */}
          <Button
            variant="outline"
            className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 hover:border-white/30"
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
