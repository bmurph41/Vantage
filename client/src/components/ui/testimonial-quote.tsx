import { cn } from "@/lib/utils";
import { Quote } from "lucide-react";

interface TestimonialQuoteProps {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatarUrl?: string;
  variant?: "default" | "accent" | "minimal";
  className?: string;
}

export function TestimonialQuote({
  quote,
  author,
  role,
  company,
  avatarUrl,
  variant = "default",
  className,
}: TestimonialQuoteProps) {
  const variantStyles = {
    default: "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800",
    accent: "bg-gradient-to-br from-primary/5 to-white dark:from-primary/10 dark:to-gray-900 border border-primary/10",
    minimal: "bg-transparent border-l-4 border-primary pl-6",
  };

  return (
    <div className={cn("rounded-xl p-6", variantStyles[variant], className)}>
      {variant !== "minimal" && (
        <div className="mb-4">
          <Quote className="w-8 h-8 text-primary/30" />
        </div>
      )}
      <blockquote className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 leading-relaxed">
        "{quote}"
      </blockquote>
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={author}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">
              {author.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </span>
          </div>
        )}
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{author}</div>
          {(role || company) && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {role}{role && company && " · "}{company}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface QuickStatBannerProps {
  stats: Array<{
    value: string | number;
    label: string;
  }>;
  variant?: "default" | "accent";
  className?: string;
}

export function QuickStatBanner({
  stats,
  variant = "default",
  className,
}: QuickStatBannerProps) {
  const variantStyles = {
    default: "bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800",
    accent: "bg-gradient-to-r from-primary to-blue-600 text-white",
  };

  return (
    <div className={cn("rounded-xl p-6", variantStyles[variant], className)}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="text-center">
            <div className={cn(
              "text-2xl md:text-3xl font-bold mb-1",
              variant === "accent" ? "text-white" : "text-gray-900 dark:text-gray-100"
            )}>
              {stat.value}
            </div>
            <div className={cn(
              "text-sm",
              variant === "accent" ? "text-white/80" : "text-gray-500 dark:text-gray-400"
            )}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  action: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  icon?: React.ReactNode;
  variant?: "default" | "accent" | "success";
  className?: string;
}

export function ActionCard({
  title,
  description,
  action,
  icon,
  variant = "default",
  className,
}: ActionCardProps) {
  const variantStyles = {
    default: {
      container: "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800",
      button: "bg-primary hover:bg-primary/90 text-white",
    },
    accent: {
      container: "bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 border border-primary/20",
      button: "bg-primary hover:bg-primary/90 text-white",
    },
    success: {
      container: "bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-gray-900 border border-green-200 dark:border-green-900/50",
      button: "bg-green-600 hover:bg-green-700 text-white",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn("rounded-xl p-6", styles.container, className)}>
      {icon && (
        <div className="mb-4">{icon}</div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
        {description}
      </p>
      {action.href ? (
        <a
          href={action.href}
          className={cn(
            "inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors",
            styles.button
          )}
        >
          {action.label}
        </a>
      ) : (
        <button
          onClick={action.onClick}
          className={cn(
            "inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg transition-colors",
            styles.button
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between mb-6", className)}>
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        action.href ? (
          <a
            href={action.href}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
