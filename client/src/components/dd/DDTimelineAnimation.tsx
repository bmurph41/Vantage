/**
 * DDTimelineAnimation
 *
 * Horizontal, animated Due Diligence timeline rendered on the modeling
 * workspace overview tab for deals that have a PSA signed (i.e. LOI+).
 *
 * Layout (left → right):
 *
 *   [PSA signed] ━━━ original DD ━━━╗
 *                                    ╚━━ ext #1 ━━━╗
 *                                                  ╚━━ ext #2 ━━━● closing
 *                         ▲ today
 *
 * Animation moments:
 *   1. Mount (~0.9s total)
 *      - Rail draws left→right
 *      - PSA node pops in (spring)
 *      - Original segment grows from 0 → full width
 *      - Executed extensions stagger in with a brief Harbor Teal glow
 *      - Today marker slides down and pulses
 *      - Labels fade in
 *   2. On grant (live)
 *      - When a new extension row turns `executed=true`, framer-motion's
 *        `layout` animation slides the end cap rightward, the new segment
 *        grows from the old cap, and a "+N days" chip bumps in above it.
 *
 * Props are deliberately pre-computed by the caller (useDDTimelineData hook
 * in workspace.tsx) so this component stays presentational and easy to
 * reuse in dd-progress-report.tsx later.
 */

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, Flag, Sparkles } from "lucide-react";

export interface DDExtensionInput {
  id: string;
  extensionNumber: number;
  days: number;
  executed: boolean;
  executedDate: string | null;
}

export interface DDTimelineData {
  psaSignedDate: string | null;
  ddPeriodDays: number | null;
  ddExpirationDate: string | null;
  closingDate: string | null;
  extensions: DDExtensionInput[];
}

interface Props {
  data: DDTimelineData;
  /** Deal stage label; used only when PSA hasn't been signed yet. */
  stageLabel?: string;
}

// ─── Date math ────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

interface Segment {
  key: string;
  kind: "original" | "extension";
  label: string;
  startDate: Date;
  endDate: Date;
  days: number;
  /** Percent of rail this segment occupies. */
  widthPct: number;
  leftPct: number;
  executedDate: Date | null;
}

interface TimelineGeometry {
  psa: Date;
  rangeEnd: Date;
  totalDays: number;
  originalEnd: Date;
  segments: Segment[];
  todayPct: number | null;
  closingPct: number | null;
  closingDate: Date | null;
}

function computeGeometry(data: DDTimelineData): TimelineGeometry | null {
  const psa = toDate(data.psaSignedDate);
  if (!psa || !data.ddPeriodDays) return null;

  const originalEnd = new Date(psa.getTime() + data.ddPeriodDays * MS_PER_DAY);

  const executed = (data.extensions || [])
    .filter((e) => e.executed)
    .sort((a, b) => a.extensionNumber - b.extensionNumber);

  // Running cursor for extension stacking
  let cursor = originalEnd;
  const extSegments: Array<Omit<Segment, "widthPct" | "leftPct">> = [];
  for (const ext of executed) {
    const next = new Date(cursor.getTime() + ext.days * MS_PER_DAY);
    extSegments.push({
      key: ext.id,
      kind: "extension",
      label: `Ext #${ext.extensionNumber} · +${ext.days}d`,
      startDate: cursor,
      endDate: next,
      days: ext.days,
      executedDate: toDate(ext.executedDate),
    });
    cursor = next;
  }

  const ddExpiration = cursor; // either originalEnd or end of last executed extension
  const closing = toDate(data.closingDate);

  // Range: psa → max(ddExpiration, closing, today + 7d pad)
  const today = new Date();
  const candidates = [ddExpiration.getTime(), closing?.getTime() ?? 0, today.getTime() + 7 * MS_PER_DAY];
  const rangeEnd = new Date(Math.max(...candidates));
  const totalDays = Math.max(1, daysBetween(psa, rangeEnd));

  const pctOf = (d: Date) => ((d.getTime() - psa.getTime()) / (rangeEnd.getTime() - psa.getTime())) * 100;

  const originalSeg: Segment = {
    key: "original",
    kind: "original",
    label: `Original DD · ${data.ddPeriodDays}d`,
    startDate: psa,
    endDate: originalEnd,
    days: data.ddPeriodDays,
    leftPct: 0,
    widthPct: pctOf(originalEnd),
    executedDate: null,
  };

  const segments: Segment[] = [originalSeg];
  for (const s of extSegments) {
    segments.push({
      ...s,
      leftPct: pctOf(s.startDate),
      widthPct: pctOf(s.endDate) - pctOf(s.startDate),
    });
  }

  const todayPct =
    today >= psa && today <= rangeEnd ? pctOf(today) : today < psa ? 0 : 100;

  return {
    psa,
    rangeEnd,
    totalDays,
    originalEnd,
    segments,
    todayPct,
    closingPct: closing ? pctOf(closing) : null,
    closingDate: closing,
  };
}

// ─── Presentation ─────────────────────────────────────────────────────────

const SEGMENT_COLORS = {
  original: "bg-[hsl(221,83%,35%)]", // Deep Marine Blue
  extension: "bg-[hsl(177,75%,38%)]", // Harbor Teal (slightly lighter than --teal)
} as const;

export function DDTimelineAnimation({ data, stageLabel }: Props) {
  const geom = useMemo(() => computeGeometry(data), [data]);

  if (!geom) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-slate-500" />
            Due Diligence Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground italic">
            {stageLabel ? `Deal in ${stageLabel}. ` : ""}
            Timeline appears once the PSA is signed.
          </div>
        </CardContent>
      </Card>
    );
  }

  const { psa, rangeEnd, segments, todayPct, closingPct, closingDate, originalEnd } = geom;
  const ddExpiration = segments[segments.length - 1].endDate;
  const totalDDDays = daysBetween(psa, ddExpiration);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-slate-500" />
            Due Diligence Timeline
          </span>
          <span className="text-[10px] font-normal text-muted-foreground font-mono">
            {totalDDDays} day{totalDDDays === 1 ? "" : "s"}
            {segments.length > 1 ? ` · ${segments.length - 1} extension${segments.length - 1 === 1 ? "" : "s"}` : ""}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2 pb-8">
        <div className="relative pt-8 pb-10 px-2">
          {/* Rail (draws left→right on mount) */}
          <motion.div
            initial={{ scaleX: 0, transformOrigin: "left center" }}
            animate={{ scaleX: 1 }}
            transition={{
              duration: 0.5,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            className="absolute left-2 right-2 top-[50%] h-[2px] bg-slate-200 rounded-full"
          />

          {/* Segments */}
          <div className="relative h-10 mx-2">
            {segments.map((seg, i) => (
              <SegmentBar key={seg.key} segment={seg} index={i} />
            ))}

            {/* PSA node */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.55, type: "spring", stiffness: 400, damping: 18 }}
              className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 z-20"
            >
              <div className="relative">
                <div className="h-3 w-3 rounded-full bg-[hsl(221,83%,35%)] ring-2 ring-white shadow-md" />
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.3 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-slate-700 uppercase tracking-wider"
                >
                  PSA
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.85, duration: 0.3 }}
                  className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-500 font-mono"
                >
                  {fmtDate(psa)}
                </motion.div>
              </div>
            </motion.div>

            {/* DD expiration cap — uses layout animation so it slides when extensions grant */}
            <motion.div
              layout
              transition={{ layout: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
              style={{ left: `${pctOfRange(ddExpiration, psa, rangeEnd)}%` }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.9, type: "spring", stiffness: 400, damping: 20 }}
                className="h-3 w-3 rounded-full bg-[hsl(177,75%,38%)] ring-2 ring-white shadow-md"
              />
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.3 }}
                className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-[hsl(177,75%,28%)] font-mono font-semibold"
              >
                {fmtDate(ddExpiration)}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.3 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-slate-700 uppercase tracking-wider"
              >
                DD ends
              </motion.div>
            </motion.div>

            {/* Closing node */}
            {closingDate && closingPct != null && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.05, type: "spring", stiffness: 400, damping: 20 }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
                style={{ left: `${closingPct}%` }}
              >
                <div className="relative">
                  <div className="h-3.5 w-3.5 rounded-full bg-emerald-600 ring-2 ring-white shadow-md flex items-center justify-center">
                    <Flag className="h-2 w-2 text-white" />
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.15, duration: 0.3 }}
                    className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-emerald-700 font-mono font-semibold"
                  >
                    {fmtDate(closingDate)}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.15, duration: 0.3 }}
                    className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-emerald-700 uppercase tracking-wider"
                  >
                    Close
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Today marker */}
            {todayPct != null && todayPct > 0 && todayPct < 100 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{ left: `${todayPct}%` }}
              >
                <div className="relative h-full -translate-x-1/2">
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-amber-500/70" />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0.5, 0.9] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
                  />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-[9px] font-semibold text-amber-700 uppercase tracking-wider whitespace-nowrap">
                    Today
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-4 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-[hsl(221,83%,35%)]" />
              Original DD ({data.ddPeriodDays}d from {fmtDate(psa)})
            </span>
            {segments.length > 1 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3 rounded-sm bg-[hsl(177,75%,38%)]" />
                Executed extensions
              </span>
            )}
            {closingDate && (
              <span className="inline-flex items-center gap-1.5">
                <Flag className="h-2.5 w-2.5 text-emerald-600" />
                Target close
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function pctOfRange(d: Date, start: Date, end: Date): number {
  return ((d.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100;
}

function SegmentBar({ segment, index }: { segment: Segment; index: number }) {
  const isExt = segment.kind === "extension";
  const color = SEGMENT_COLORS[segment.kind];
  const delayBase = isExt ? 0.7 + index * 0.15 : 0.4;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 h-2 group"
      style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }}
    >
      <motion.div
        initial={{ scaleX: 0, transformOrigin: "left center" }}
        animate={{ scaleX: 1 }}
        transition={{
          delay: delayBase,
          duration: isExt ? 0.4 : 0.5,
          ease: [0.2, 0.8, 0.2, 1],
        }}
        className={`h-full w-full rounded-full ${color} shadow-sm`}
      />
      {/* Glow pulse for extensions when they appear */}
      {isExt && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ delay: delayBase + 0.4, duration: 0.9, ease: "easeOut" }}
          className="absolute inset-0 rounded-full bg-[hsl(177,75%,50%)] blur-md pointer-events-none"
        />
      )}
      {/* Chip above extension segments */}
      {isExt && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delayBase + 0.25, duration: 0.3 }}
          className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-[hsl(177,75%,28%)] bg-[hsl(177,75%,95%)] border border-[hsl(177,75%,80%)] rounded-full px-1.5 py-0.5 inline-flex items-center gap-1"
        >
          <Sparkles className="h-2 w-2" />
          +{segment.days}d
        </motion.div>
      )}
      {/* Hover tooltip */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-8 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="text-[10px] bg-slate-900 text-white rounded px-1.5 py-0.5 shadow">
          {segment.label} · {fmtDate(segment.startDate)} → {fmtDate(segment.endDate)}
        </div>
      </div>
    </div>
  );
}

export default DDTimelineAnimation;
