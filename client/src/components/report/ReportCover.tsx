import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ReportCoverProps {
  title: string;
  subtitle?: string;
  heroImage?: string;
  heroImageAlt?: string;
  badges?: Array<{
    text: string;
    variant?: "default" | "secondary" | "outline";
  }>;
  overlay?: boolean;
  className?: string;
}

export function ReportCover({
  title,
  subtitle,
  heroImage,
  heroImageAlt = "Property hero image",
  badges = [],
  overlay = true,
  className,
}: ReportCoverProps) {
  return (
    <div 
      className={cn(
        "relative w-full pb-break-after",
        "min-h-[500px] md:min-h-[600px]",
        "flex flex-col justify-end",
        "overflow-hidden rounded-lg",
        className
      )}
      data-testid="report-cover"
    >
      {/* Hero Image */}
      {heroImage && (
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt={heroImageAlt}
            className="w-full h-full object-cover"
            data-testid="report-cover-hero-image"
          />
          {overlay && (
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 via-neutral-900/20 to-transparent" />
          )}
        </div>
      )}
      
      {/* Content Overlay */}
      <div className={cn(
        "relative z-10 p-8 md:p-12",
        heroImage ? "text-white" : "text-neutral-900 bg-neutral-50"
      )}>
        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6" data-testid="report-cover-badges">
            {badges.map((badge, index) => (
              <Badge
                key={index}
                variant={badge.variant || "default"}
                className={cn(
                  "text-sm font-medium",
                  heroImage && "bg-white/20 backdrop-blur-sm text-white border-white/30"
                )}
              >
                {badge.text}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Title Block */}
        <div className="space-y-4">
          <h1 
            className={cn(
              "font-report-serif font-bold leading-tight",
              "text-4xl md:text-5xl lg:text-6xl",
              "tracking-tight"
            )}
            data-testid="report-cover-title"
          >
            {title}
          </h1>
          
          {subtitle && (
            <p 
              className={cn(
                "text-xl md:text-2xl font-light leading-relaxed",
                "max-w-3xl",
                heroImage ? "text-white/90" : "text-neutral-600"
              )}
              data-testid="report-cover-subtitle"
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportCover;