/**
 * DDSegmentRow
 *
 * Renders the Due Diligence period (base DD + executed extensions + pending
 * ghost extensions) inside a gantt swimlane row, positioned via a parent-
 * provided getXPx function. Visually consistent with DDTimelineAnimation but
 * adapted for the horizontal gantt coordinate system on the deal timeline tab.
 *
 * Parent is responsible for: the row wrapper, the height (40px standard),
 * and passing getXPx. This component just paints segments + hover tooltips.
 *
 * Segment ordering (left → right):
 *   1. Base DD            (psaSignedDate → psaSignedDate + ddPeriodDays)   — Deep Marine Blue
 *   2. Executed extensions, stacked                                         — Harbor Teal
 *   3. Pending extensions, stacked after the last executed end             — Harbor Teal at 40% + dashed
 */

import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { format } from "date-fns";

export interface DDExtensionInput {
  id: string;
  extensionNumber: number;
  days: number;
  executed: boolean;
  executedDate: string | null;
}

interface Props {
  psaSignedDate: string;
  ddPeriodDays: number;
  extensions: DDExtensionInput[];
  getXPx: (d: Date) => number;
  /** Entrance animation delay offset (so the row staggers after the lane fades in). */
  baseDelay?: number;
}

const MS_PER_DAY = 86_400_000;

const COLORS = {
  base: "hsl(221, 83%, 35%)", // Deep Marine Blue
  executed: "hsl(177, 75%, 38%)", // Harbor Teal
  pending: "hsl(177, 75%, 60%)", // Lighter Harbor Teal for ghost
} as const;

export function DDSegmentRow({ psaSignedDate, ddPeriodDays, extensions, getXPx, baseDelay = 0 }: Props) {
  const psa = new Date(psaSignedDate);
  if (!ddPeriodDays || Number.isNaN(psa.getTime())) return null;

  const baseEnd = new Date(psa.getTime() + ddPeriodDays * MS_PER_DAY);

  const sorted = [...extensions].sort((a, b) => a.extensionNumber - b.extensionNumber);
  const executed = sorted.filter((e) => e.executed);
  const pending = sorted.filter((e) => !e.executed);

  // Stack executed from baseEnd
  let cursor = baseEnd;
  const executedSegs = executed.map((ext) => {
    const start = cursor;
    const end = new Date(cursor.getTime() + ext.days * MS_PER_DAY);
    cursor = end;
    return { ext, start, end };
  });

  // Pending stack after executed
  let pendingCursor = cursor;
  const pendingSegs = pending.map((ext) => {
    const start = pendingCursor;
    const end = new Date(pendingCursor.getTime() + ext.days * MS_PER_DAY);
    pendingCursor = end;
    return { ext, start, end };
  });

  const baseLeft = getXPx(psa);
  const baseRight = getXPx(baseEnd);
  const baseWidth = Math.max(2, baseRight - baseLeft);

  return (
    <TooltipProvider>
      {/* Base DD segment */}
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ scaleX: 0, transformOrigin: "left center", opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{
              delay: baseDelay + 0.05,
              duration: 0.5,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            className="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm shadow-sm cursor-default"
            style={{
              left: `${baseLeft}px`,
              width: `${baseWidth}px`,
              backgroundColor: COLORS.base,
            }}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">Original DD Period</p>
          <p className="text-muted-foreground">
            {format(psa, "MMM d")} → {format(baseEnd, "MMM d, yyyy")} · {ddPeriodDays}d
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Executed extensions */}
      {executedSegs.map((s, i) => {
        const left = getXPx(s.start);
        const right = getXPx(s.end);
        const width = Math.max(2, right - left);
        const delay = baseDelay + 0.3 + i * 0.12;
        return (
          <Tooltip key={s.ext.id}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ scaleX: 0, transformOrigin: "left center", opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm shadow-sm cursor-default"
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  backgroundColor: COLORS.executed,
                }}
              >
                {/* Brief glow pulse on first appearance */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.55, 0] }}
                  transition={{ delay: delay + 0.35, duration: 0.9, ease: "easeOut" }}
                  className="absolute inset-0 rounded-sm blur-md pointer-events-none"
                  style={{ backgroundColor: "hsl(177, 75%, 55%)" }}
                />
                {width > 28 && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: delay + 0.3, duration: 0.2 }}
                    className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white gap-0.5"
                  >
                    <Sparkles className="h-2 w-2" />
                    +{s.ext.days}d
                  </motion.span>
                )}
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-semibold">Extension #{s.ext.extensionNumber} · +{s.ext.days}d</p>
              <p className="text-muted-foreground">
                {format(s.start, "MMM d")} → {format(s.end, "MMM d, yyyy")}
              </p>
              {s.ext.executedDate && (
                <p className="text-muted-foreground">Executed {format(new Date(s.ext.executedDate), "MMM d, yyyy")}</p>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}

      {/* Pending extensions — dashed ghost */}
      {pendingSegs.map((s, i) => {
        const left = getXPx(s.start);
        const right = getXPx(s.end);
        const width = Math.max(2, right - left);
        const delay = baseDelay + 0.45 + (executedSegs.length + i) * 0.1;
        return (
          <Tooltip key={s.ext.id}>
            <TooltipTrigger asChild>
              <motion.div
                initial={{ scaleX: 0, transformOrigin: "left center", opacity: 0 }}
                animate={{ scaleX: 1, opacity: 0.75 }}
                transition={{ delay, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute top-1/2 -translate-y-1/2 h-3 rounded-sm cursor-default"
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  backgroundColor: "transparent",
                  border: `1.5px dashed ${COLORS.pending}`,
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-semibold">Extension #{s.ext.extensionNumber} · +{s.ext.days}d (pending)</p>
              <p className="text-muted-foreground">
                {format(s.start, "MMM d")} → {format(s.end, "MMM d, yyyy")}
              </p>
              <p className="text-amber-600">Not yet executed</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </TooltipProvider>
  );
}

export default DDSegmentRow;
