import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  content: string;
  tip?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  iconClassName?: string;
}

export function InfoTooltip({ content, tip, side = "top", className, iconClassName }: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center cursor-help", className)}>
            <Info className={cn("h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary transition-colors", iconClassName)} />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          <p>{content}</p>
          {tip && (
            <p className="mt-1 pt-1 border-t border-primary-foreground/20 font-medium italic">
              Tip: {tip}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface StrategyOverviewProps {
  title: string;
  description: string;
  bestFor: string;
  keyConsideration: string;
  riskLevel: "Low" | "Moderate" | "High";
}

export function StrategyOverview({ title, description, bestFor, keyConsideration, riskLevel }: StrategyOverviewProps) {
  const riskColors = {
    Low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Moderate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    High: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 dark:border-blue-800 px-3 py-2 space-y-1">
      <div className="flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">{title}</h4>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", riskColors[riskLevel])}>
              {riskLevel} Risk
            </span>
          </div>
          <p className="text-xs text-blue-800/80 dark:text-blue-300/70 leading-relaxed">{description}</p>
          <div className="flex flex-col sm:flex-row gap-1.5">
            <div className="flex-1 rounded bg-white/60 dark:bg-white/5 px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600/70 dark:text-blue-400/60">Best For</span>
              <p className="text-[11px] text-foreground/80 mt-0.5 leading-snug">{bestFor}</p>
            </div>
            <div className="flex-1 rounded bg-white/60 dark:bg-white/5 px-2 py-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600/70 dark:text-blue-400/60">Key Consideration</span>
              <p className="text-[11px] text-foreground/80 mt-0.5 leading-snug">{keyConsideration}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
