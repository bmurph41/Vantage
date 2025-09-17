import { cn } from "@/lib/utils";

interface ReportTwoColProps {
  children: React.ReactNode;
  className?: string;
  leftWidth?: "1/3" | "1/2" | "2/3";
  gap?: "sm" | "md" | "lg";
  alignTop?: boolean;
}

export function ReportTwoCol({
  children,
  className,
  leftWidth = "1/2",
  gap = "md",
  alignTop = false,
}: ReportTwoColProps) {
  const widthClasses = {
    "1/3": "grid-cols-1 md:grid-cols-[1fr_2fr]",
    "1/2": "grid-cols-1 md:grid-cols-2", 
    "2/3": "grid-cols-1 md:grid-cols-[2fr_1fr]",
  };
  
  const gapClasses = {
    sm: "gap-4",
    md: "gap-6",
    lg: "gap-8",
  };
  
  return (
    <div 
      className={cn(
        "grid w-full",
        widthClasses[leftWidth],
        gapClasses[gap],
        alignTop ? "items-start" : "items-stretch",
        className
      )}
      data-testid="report-two-col"
    >
      {children}
    </div>
  );
}

export default ReportTwoCol;