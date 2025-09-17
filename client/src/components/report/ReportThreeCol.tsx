import { cn } from "@/lib/utils";

interface ReportThreeColProps {
  children: React.ReactNode;
  className?: string;
  gap?: "sm" | "md" | "lg";
  alignTop?: boolean;
  responsive?: boolean;
}

export function ReportThreeCol({
  children,
  className,
  gap = "md",
  alignTop = false,
  responsive = true,
}: ReportThreeColProps) {
  const gapClasses = {
    sm: "gap-4",
    md: "gap-6", 
    lg: "gap-8",
  };
  
  const responsiveClasses = responsive 
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    : "grid-cols-3";
  
  return (
    <div 
      className={cn(
        "grid w-full",
        responsiveClasses,
        gapClasses[gap],
        alignTop ? "items-start" : "items-stretch",
        className
      )}
      data-testid="report-three-col"
    >
      {children}
    </div>
  );
}

export default ReportThreeCol;