import { cn } from "@/lib/utils";

interface ReportSectionProps {
  title: string;
  children: React.ReactNode;
  index?: number;
  pageBreak?: "before" | "after" | "avoid" | "none";
  className?: string;
  headingLevel?: 1 | 2 | 3 | 4;
  spacing?: "tight" | "normal" | "loose";
}

export function ReportSection({
  title,
  children,
  index,
  pageBreak = "none",
  className,
  headingLevel = 2,
  spacing = "normal",
}: ReportSectionProps) {
  const HeadingTag = `h${headingLevel}` as keyof JSX.IntrinsicElements;
  
  const pageBreakClasses = {
    before: "pb-break",
    after: "pb-break-after", 
    avoid: "no-break",
    none: "",
  };
  
  const spacingClasses = {
    tight: "space-y-4",
    normal: "space-y-6", 
    loose: "space-y-8",
  };
  
  const headingSizes = {
    1: "text-4xl font-bold",
    2: "text-3xl font-semibold",
    3: "text-2xl font-semibold", 
    4: "text-xl font-medium",
  };
  
  return (
    <section 
      className={cn(
        "w-full",
        pageBreakClasses[pageBreak],
        spacing !== "normal" && spacingClasses[spacing],
        className
      )}
      data-testid={`report-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {/* Section Header with optional index */}
      <div className="keep-with-next mb-6 border-b border-neutral-200 pb-3">
        <HeadingTag 
          className={cn(
            "font-report-serif tracking-tight text-neutral-900",
            headingSizes[headingLevel],
            "flex items-center gap-3"
          )}
          data-testid="report-section-title"
        >
          {index && (
            <span 
              className="flex-shrink-0 text-emerald-600 font-mono text-sm font-medium"
              data-testid="report-section-index"
            >
              {String(index).padStart(2, '0')}.
            </span>
          )}
          {title}
        </HeadingTag>
      </div>
      
      {/* Section Content */}
      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}

export default ReportSection;