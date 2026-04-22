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

interface CanonicalStage {
  id: string;
  name: string;
  stageOrder: number;
}

interface Props {
  stageEvents: TimelineEvent[];
  /** Optional canonical pipeline stage list. When provided, stages the deal
   *  has not yet entered (or skipped past) render as ghost markers in slate
   *  so users see the full intended path. */
  canonicalStages?: CanonicalStage[];
}

interface RenderedStage {
  key: string;
  label: string;
  state: 'past' | 'current' | 'future' | 'skipped';
  startDate?: string;
  endDate?: string;
  stageOrder: number;
}

export function DealStageProgressBar({ stageEvents, canonicalStages }: Props) {
  if ((!stageEvents || stageEvents.length === 0) && (!canonicalStages || canonicalStages.length === 0)) {
    return null;
  }

  // Sort entered stages chronologically
  const enteredSorted = [...(stageEvents ?? [])].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  const activeIdx = enteredSorted.findIndex((s) => s.status === "active");
  const currentEnteredIdx = activeIdx >= 0 ? activeIdx : enteredSorted.length - 1;
  const currentEntered = currentEnteredIdx >= 0 ? enteredSorted[currentEnteredIdx] : null;

  // Build the rendered list: prefer canonicalStages when provided so we can
  // include skipped/future ghost markers; fall back to entered-only behavior.
  let rendered: RenderedStage[];
  if (canonicalStages && canonicalStages.length > 0) {
    const enteredByLabel = new Map<string, TimelineEvent>();
    for (const e of enteredSorted) {
      const label = e.title.replace(/^Stage:\s*/, "").trim().toLowerCase();
      enteredByLabel.set(label, e);
    }
    const currentLabel = currentEntered ? currentEntered.title.replace(/^Stage:\s*/, "").trim().toLowerCase() : null;
    const currentOrder = currentLabel ? canonicalStages.find(s => s.name.trim().toLowerCase() === currentLabel)?.stageOrder ?? null : null;

    rendered = [...canonicalStages]
      .sort((a, b) => a.stageOrder - b.stageOrder)
      .map((cs): RenderedStage => {
        const matched = enteredByLabel.get(cs.name.trim().toLowerCase());
        if (matched) {
          const isCurrent = currentLabel === cs.name.trim().toLowerCase();
          return {
            key: cs.id,
            label: cs.name,
            state: isCurrent ? 'current' : 'past',
            startDate: matched.startDate,
            endDate: matched.endDate,
            stageOrder: cs.stageOrder,
          };
        }
        // Not entered. If its order is < current, it was SKIPPED; otherwise FUTURE.
        const state: RenderedStage['state'] =
          currentOrder != null && cs.stageOrder < currentOrder ? 'skipped' : 'future';
        return { key: cs.id, label: cs.name, state, stageOrder: cs.stageOrder };
      });
  } else {
    // Legacy: entered-only.
    rendered = enteredSorted.map((s, i): RenderedStage => ({
      key: s.id,
      label: s.title.replace(/^Stage:\s*/, ""),
      state: i === currentEnteredIdx ? 'current' : 'past',
      startDate: s.startDate,
      endDate: s.endDate,
      stageOrder: i,
    }));
  }

  // Style by state. Past = filled blue. Current = teal pulse. Future = slate
  // ghost (canonical stages not yet reached). Skipped = slate dashed (canonical
  // stages the deal jumped over).
  const styleFor = (state: RenderedStage['state']) => {
    switch (state) {
      case 'current':
        return { dot: 'hsl(177, 75%, 38%)', text: 'hsl(177, 75%, 28%)', connector: 'hsl(220, 13%, 90%)', dashed: false };
      case 'past':
        return { dot: 'hsl(221, 83%, 35%)', text: 'hsl(221, 83%, 35%)', connector: 'hsl(221, 83%, 35%)', dashed: false };
      case 'skipped':
        return { dot: 'hsl(220, 13%, 75%)', text: 'hsl(220, 13%, 60%)', connector: 'hsl(220, 13%, 90%)', dashed: true };
      case 'future':
      default:
        return { dot: 'hsl(220, 13%, 85%)', text: '#94A3B8', connector: 'hsl(220, 13%, 90%)', dashed: false };
    }
  };

  return (
    <TooltipProvider>
      <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Stage Progression
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {rendered.length} stage{rendered.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="relative flex items-center">
          {rendered.map((s, i) => {
            const sty = styleFor(s.state);
            const isCurrent = s.state === 'current';
            return (
              <div key={s.key} className="flex items-center flex-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: s.state === 'future' || s.state === 'skipped' ? 0.6 : 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.08, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                      className="flex items-center gap-1.5 cursor-default min-w-0 flex-1"
                    >
                      <motion.div
                        className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ring-2 ring-white ${
                          s.state === 'skipped' ? 'border border-dashed' : ''
                        }`}
                        style={{
                          backgroundColor: s.state === 'skipped' ? 'transparent' : sty.dot,
                          borderColor: s.state === 'skipped' ? sty.dot : undefined,
                        }}
                        animate={isCurrent ? { scale: [1, 1.25, 1] } : {}}
                        transition={isCurrent ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                      />
                      <span
                        className="text-[10px] font-medium truncate"
                        style={{ color: sty.text }}
                      >
                        {s.label}
                      </span>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p className="font-semibold">{s.label}</p>
                    {s.state === 'skipped' && <p className="text-muted-foreground italic">Skipped</p>}
                    {s.state === 'future' && <p className="text-muted-foreground italic">Not yet reached</p>}
                    {s.startDate && (
                      <p className="text-muted-foreground">
                        Entered {format(new Date(s.startDate), "MMM d, yyyy")}
                      </p>
                    )}
                    {!isCurrent && s.endDate && (
                      <p className="text-muted-foreground">
                        Exited {format(new Date(s.endDate), "MMM d, yyyy")}
                      </p>
                    )}
                    {isCurrent && <p className="text-[hsl(177,75%,28%)] font-medium">Current</p>}
                  </TooltipContent>
                </Tooltip>
                {i < rendered.length - 1 && (
                  <motion.div
                    initial={{ scaleX: 0, transformOrigin: "left center" }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.15 + i * 0.08, duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                    className={`h-0.5 flex-1 mx-2 ${sty.dashed ? 'border-t border-dashed' : ''}`}
                    style={{ backgroundColor: sty.dashed ? 'transparent' : sty.connector, borderColor: sty.dashed ? sty.connector : undefined }}
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
