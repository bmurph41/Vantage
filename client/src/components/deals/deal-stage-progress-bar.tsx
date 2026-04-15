/**
 * DealStageProgressBar
 *
 * A connected horizontal progression bar rendered above the Deal Timeline
 * gantt. Reads from the stage_change events produced by the timeline endpoint
 * (which come from crm_deal_stage_history). Shows completed stages in Deep
 * Marine Blue, the current stage in Harbor Teal, and (optionally) upcoming
 * stages as slate ghosts when a canonical stage order is provided.
 *
 * This component is purely presentational — stage events come in as props
 * already filtered from the timeline response.
 */

import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import type { TimelineEvent } from "@/components/crm/gantt-popover";

interface Props {
  stageEvents: TimelineEvent[];
}

export function DealStageProgressBar({ stageEvents }: Props) {
  if (!stageEvents || stageEvents.length === 0) return null;

  // Sort chronologically by enteredAt (startDate)
  const sorted = [...stageEvents].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  // The current stage is the one whose status === 'active' (from the endpoint),
  // or the last one if none are marked active.
  const activeIdx = sorted.findIndex((s) => s.status === "active");
  const currentIdx = activeIdx >= 0 ? activeIdx : sorted.length - 1;

  return (
    <TooltipProvider>
      <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Stage Progression
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {sorted.length} stage{sorted.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="relative flex items-center">
          {sorted.map((s, i) => {
            const isCurrent = i === currentIdx;
            const isPast = i < currentIdx;
            const color = isCurrent
              ? "hsl(177, 75%, 38%)"
              : isPast
                ? "hsl(221, 83%, 35%)"
                : "hsl(220, 13%, 85%)";
            const label = s.title.replace(/^Stage:\s*/, "");
            return (
              <div key={s.id} className="flex items-center flex-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.08, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                      className="flex items-center gap-1.5 cursor-default min-w-0 flex-1"
                    >
                      <motion.div
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-white"
                        style={{ backgroundColor: color }}
                        animate={isCurrent ? { scale: [1, 1.25, 1] } : {}}
                        transition={isCurrent ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                      />
                      <span
                        className="text-[10px] font-medium truncate"
                        style={{ color: isCurrent ? "hsl(177, 75%, 28%)" : isPast ? "hsl(221, 83%, 35%)" : "#94A3B8" }}
                      >
                        {label}
                      </span>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-semibold">{label}</p>
                    <p className="text-muted-foreground">
                      Entered {format(new Date(s.startDate), "MMM d, yyyy")}
                    </p>
                    {!isCurrent && s.endDate && (
                      <p className="text-muted-foreground">
                        Exited {format(new Date(s.endDate), "MMM d, yyyy")}
                      </p>
                    )}
                    {isCurrent && <p className="text-[hsl(177,75%,28%)] font-medium">Current</p>}
                  </TooltipContent>
                </Tooltip>
                {i < sorted.length - 1 && (
                  <motion.div
                    initial={{ scaleX: 0, transformOrigin: "left center" }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.15 + i * 0.08, duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-0.5 flex-1 mx-2"
                    style={{ backgroundColor: isPast ? "hsl(221, 83%, 35%)" : "hsl(220, 13%, 90%)" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default DealStageProgressBar;
