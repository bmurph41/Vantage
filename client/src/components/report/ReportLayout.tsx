import { cn } from "@/lib/utils";
import type { AccentColor } from "@/theme/reportTheme";
import { generateCSSCustomProperties } from "@/theme/reportTheme";

interface ReportLayoutProps {
  children: React.ReactNode;
  accentColor?: AccentColor;
  pageSize?: "letter" | "a4";
  className?: string;
  style?: React.CSSProperties;
}

export function ReportLayout({ 
  children, 
  accentColor = "emerald", 
  pageSize = "letter",
  className,
  style = {},
}: ReportLayoutProps) {
  const customProperties = generateCSSCustomProperties(accentColor);
  const maxWidth = pageSize === "letter" ? "max-w-page-letter" : "max-w-page-a4";
  
  return (
    <div 
      className={cn(
        "report-container mx-auto bg-white text-neutral-900",
        "font-report-sans antialiased",
        maxWidth,
        className
      )}
      style={{ ...customProperties, ...style }}
      data-testid="report-layout"
    >
      <div className="print:p-0 px-6 py-8">
        {children}
      </div>
    </div>
  );
}

export default ReportLayout;