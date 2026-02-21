/**
 * DealTimelineVisualizer
 * 
 * Reusable visual bar timeline:
 * | PSA | ---- DD ---- | ---- Extension 1 ---- | ---- Extension 2 ---- | Closing |
 */

import { useMemo } from "react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Calendar, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export interface TimelineExtension {
  id: string;
  days: number;
  executed: boolean;
  basedOnEvent?: string;
  label?: string;
}

export interface DealTimelineVisualizerProps {
  psaSignedDate?: string;
  ddExpirationDate?: string;
  closingDate?: string;
  extensions?: TimelineExtension[];
  ddPeriodDays?: number;
  daysToClosing?: number;
  ddPeriodMode?: string;
  useBusinessDays?: boolean;
  className?: string;
  variant?: "compact" | "full";
}

const SEGMENT_STYLES: Record<string, { barColor: string }> = {
  base_dd: { barColor: "bg-blue-500" },
  extension_executed: { barColor: "bg-amber-500" },
  extension_potential: { barColor: "bg-amber-300/50" },
  closing: { barColor: "bg-emerald-500" },
};

interface Segment {
  label: string;
  startDate: Date | null;
  endDate: Date | null;
  days: number;
  type: string;
  icon?: React.ReactNode;
}

export function DealTimelineVisualizer({
  psaSignedDate,
  ddExpirationDate,
  closingDate,
  extensions = [],
  ddPeriodDays,
  daysToClosing,
  ddPeriodMode = "auto",
  useBusinessDays = false,
  className,
  variant = "full",
}: DealTimelineVisualizerProps) {
  const segments = useMemo(() => {
    const segs: Segment[] = [];
    if (!psaSignedDate) return segs;

    const psaDate = parseISO(psaSignedDate);

    if (ddExpirationDate) {
      const ddExpDate = parseISO(ddExpirationDate);
      const baseDays = ddPeriodDays || differenceInCalendarDays(ddExpDate, psaDate);
      const executedExtDays = extensions
        .filter((e) => e.executed)
        .reduce((sum, e) => sum + e.days, 0);
      const actualBaseDays = Math.max(baseDays - executedExtDays, 0);

      segs.push({
        label: "Due Diligence",
        startDate: psaDate,
        endDate: new Date(psaDate.getTime() + actualBaseDays * 86400000),
        days: actualBaseDays,
        type: "base_dd",
        icon: <Clock className="w-3 h-3" />,
      });

      extensions.forEach((ext, i) => {
        segs.push({
          label: ext.label || `Extension ${i + 1}`,
          startDate: null,
          endDate: null,
          days: ext.days,
          type: ext.executed ? "extension_executed" : "extension_potential",
          icon: ext.executed ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />,
        });
      });

      if (closingDate) {
        const closeDate = parseISO(closingDate);
        const closingDays = daysToClosing || differenceInCalendarDays(closeDate, ddExpDate);
        if (closingDays > 0) {
          segs.push({
            label: "To Closing",
            startDate: ddExpDate,
            endDate: closeDate,
            days: closingDays,
            type: "closing",
            icon: <Calendar className="w-3 h-3" />,
          });
        }
      }
    }

    return segs;
  }, [psaSignedDate, ddExpirationDate, closingDate, extensions, ddPeriodDays, daysToClosing]);

  const totalDays = useMemo(
    () => segments.reduce((sum, s) => sum + s.days, 0),
    [segments]
  );

  if (!psaSignedDate || segments.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-gray-300 p-4 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          Set PSA Signed Date and DD period to view timeline
        </p>
      </div>
    );
  }

  // ─── Compact Variant ────────────────────────────────────────────
  if (variant === "compact") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Timeline</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            {ddPeriodMode === "auto" ? "Auto" : "Custom"}
          </Badge>
          {useBusinessDays && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">Biz Days</Badge>
          )}
        </div>
        <TooltipProvider>
          <div className="flex h-6 rounded-md overflow-hidden border border-gray-200">
            {segments.map((seg, i) => {
              const widthPct = totalDays > 0 ? Math.max((seg.days / totalDays) * 100, 3) : 0;
              const style = SEGMENT_STYLES[seg.type] || SEGMENT_STYLES.base_dd;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center justify-center text-[9px] font-medium cursor-default",
                        style.barColor,
                        seg.type === "extension_potential" && "opacity-50",
                        i > 0 && "border-l border-white/30"
                      )}
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className="text-white drop-shadow-sm truncate px-0.5">{seg.days}d</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p className="font-semibold">{seg.label}</p>
                    <p>{seg.days} {useBusinessDays ? "business" : "calendar"} days</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>PSA: {format(parseISO(psaSignedDate), "M/d/yy")}</span>
          {closingDate && <span>Close: {format(parseISO(closingDate), "M/d/yy")}</span>}
        </div>
      </div>
    );
  }

  // ─── Full Variant (DD Report) ───────────────────────────────────
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Deal Timeline</h4>
          <Badge variant="outline" className="text-[10px] h-5">
            {ddPeriodMode === "auto" ? "Auto-Calculated" : "Custom"}
          </Badge>
          {useBusinessDays && (
            <Badge variant="secondary" className="text-[10px] h-5">Business Days</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">Total: {totalDays} days</span>
      </div>

      <TooltipProvider>
        <div className="relative">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-[10px] font-medium text-slate-600">
              PSA Signed — {format(parseISO(psaSignedDate), "MMM d, yyyy")}
            </span>
          </div>

          <div className="flex h-10 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            {segments.map((seg, i) => {
              const widthPct = totalDays > 0 ? Math.max((seg.days / totalDays) * 100, 5) : 0;
              const style = SEGMENT_STYLES[seg.type] || SEGMENT_STYLES.base_dd;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center justify-center gap-1 text-xs font-medium cursor-default",
                        style.barColor,
                        seg.type === "extension_potential" && "opacity-60",
                        i > 0 && "border-l-2 border-white/40"
                      )}
                      style={{ width: `${widthPct}%`, minWidth: "40px" }}
                    >
                      <span className="text-white drop-shadow-sm truncate flex items-center gap-1">
                        {seg.icon}
                        <span className="hidden sm:inline">{seg.label}</span>
                        <span className="sm:hidden">{seg.days}d</span>
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <div className="space-y-1">
                      <p className="font-semibold">{seg.label}</p>
                      <p className="text-muted-foreground">
                        {seg.days} {useBusinessDays ? "business" : "calendar"} days
                      </p>
                      {seg.startDate && (
                        <p className="text-muted-foreground">Start: {format(seg.startDate, "MMM d, yyyy")}</p>
                      )}
                      {seg.endDate && (
                        <p className="text-muted-foreground">End: {format(seg.endDate, "MMM d, yyyy")}</p>
                      )}
                      {seg.type === "extension_potential" && (
                        <p className="text-amber-600 text-[10px]">Not yet executed</p>
                      )}
                      {seg.type === "extension_executed" && (
                        <p className="text-amber-700 text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Executed
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {closingDate && (
            <div className="flex items-center gap-1 mt-1 justify-end">
              <span className="text-[10px] font-medium text-emerald-600">
                Closing — {format(parseISO(closingDate), "MMM d, yyyy")}
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          )}
        </div>
      </TooltipProvider>

      <div className="flex flex-wrap gap-3 text-[10px]">
        {segments.map((seg, i) => {
          const style = SEGMENT_STYLES[seg.type] || SEGMENT_STYLES.base_dd;
          return (
            <div key={i} className="flex items-center gap-1.5">
              <div className={cn("w-3 h-3 rounded-sm", style.barColor, seg.type === "extension_potential" && "opacity-50")} />
              <span className="text-muted-foreground">{seg.label}: {seg.days}d</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2 border-t">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">PSA Signed</p>
          <p className="text-sm font-semibold">{format(parseISO(psaSignedDate), "MMM d, yyyy")}</p>
        </div>
        {ddExpirationDate && (
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">DD Expiration</p>
            <p className="text-sm font-semibold">{format(parseISO(ddExpirationDate), "MMM d, yyyy")}</p>
          </div>
        )}
        {closingDate && (
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Closing</p>
            <p className="text-sm font-semibold">{format(parseISO(closingDate), "MMM d, yyyy")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DealTimelineVisualizer;
