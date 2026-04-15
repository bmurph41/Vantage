/**
 * DealTimelineTab — animated deal lifecycle gantt
 *
 * Renders a horizontal multi-lane gantt for a single deal. Lanes are grouped
 * by category (stages, DD, key dates, deposits, tasks, playbook, approvals,
 * red flags, activity). All events + lane rows animate in with staggered
 * framer-motion entrance timing matching the FM Design System v2 motion
 * tokens (`--motion-ease-standard`, `--motion-duration-enter`).
 *
 * Data sources:
 *   - `GET /api/crm/pipeline-enhancements/timeline/:dealId` — main events
 *     (stage history, key dates, tasks, playbook, red flags, approvals,
 *     activities, custom deadlines)
 *   - `GET /api/crm/deals/:id/extensions` — real dealExtensions rows for
 *     the DD lane (base + executed + pending ghosts)
 *   - `GET /api/crm/deals/:id/deposits` — dealDeposits rows for the new
 *     Deposits lane (shows amount, due date, paid/pending/overdue state)
 *
 * The DD lane uses DDSegmentRow (see ../dd/... and ./dd-segment-row.tsx) to
 * render the same visual language as the standalone DDTimelineAnimation on
 * the modeling workspace overview tab.
 *
 * Collision handling: events in non-DD lanes that fall within 12px of each
 * other are stacked vertically within the row so markers don't overlap.
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calendar, AlertTriangle, CheckCircle2, Diamond, Flag, Activity,
  ListChecks, ZoomIn, ZoomOut, CalendarDays, DollarSign, Clock,
} from "lucide-react";
import {
  format, differenceInDays, addDays, startOfDay, startOfWeek, startOfMonth,
  addMonths,
} from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import GanttPopover, { type TimelineEvent } from "@/components/crm/gantt-popover";
import DDSegmentRow, { type DDExtensionInput } from "./dd-segment-row";
import DealStageProgressBar from "./deal-stage-progress-bar";

interface DealTimelineTabProps {
  dealId: string;
  deal: any;
}

type ZoomLevel = "day" | "week" | "month";

// Category order = render order top → bottom
const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; defaultOn: boolean }
> = {
  stages: { label: "Stages", icon: Flag, color: "#1B365D", defaultOn: true },
  due_diligence: { label: "Due Diligence", icon: Clock, color: "hsl(177, 75%, 38%)", defaultOn: true },
  key_dates: { label: "Key Dates", icon: Diamond, color: "#8B5CF6", defaultOn: true },
  deposits: { label: "Deposits", icon: DollarSign, color: "#EC4899", defaultOn: true },
  tasks: { label: "Tasks", icon: CheckCircle2, color: "#3B82F6", defaultOn: true },
  playbook: { label: "Playbook", icon: ListChecks, color: "#10B981", defaultOn: true },
  milestones: { label: "Approvals", icon: CheckCircle2, color: "#6366F1", defaultOn: true },
  red_flags: { label: "Red Flags", icon: AlertTriangle, color: "#EF4444", defaultOn: true },
  activities: { label: "Activity", icon: Activity, color: "#94A3B8", defaultOn: false },
};

const EVENT_TO_CATEGORY: Record<string, string> = {
  stage_change: "stages",
  key_date: "key_dates",
  custom_deadline: "key_dates",
  task: "tasks",
  playbook: "playbook",
  milestone: "milestones",
  red_flag: "red_flags",
  activity: "activities",
};

const PIXELS_PER_DAY: Record<ZoomLevel, number> = { day: 20, week: 8, month: 2 };

// The set of deal.ddExpirationDate + firstDepositDueDate + secondDepositDueDate
// key_date events become redundant once DD lane and Deposits lane are live.
// Filter them out to avoid duplication.
const SUPPRESSED_KEY_DATE_LABELS = new Set([
  "DD Deadline",
  "First Deposit Due",
  "Second Deposit Due",
]);

interface DealDeposit {
  id: string;
  dealId: string;
  depositNumber: number;
  amount: string;
  anchorEvent: string;
  calculatedDueDate: string | null;
  actualPaidDate: string | null;
  refundable: boolean;
  appliedToPrice: boolean;
  status: string;
  notes: string | null;
}

export default function DealTimelineTab({ dealId, deal }: DealTimelineTabProps) {
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(
    () => new Set(Object.entries(CATEGORY_CONFIG).filter(([, c]) => c.defaultOn).map(([k]) => k)),
  );
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Timeline endpoint (events from stage history, tasks, etc.)
  const includeParam = useMemo(() => {
    const parts: string[] = [];
    // Always fetch stages for the progression bar, even if the lane is hidden
    parts.push("stages");
    if (enabledCategories.has("key_dates")) parts.push("key_dates");
    if (enabledCategories.has("tasks")) parts.push("tasks");
    if (enabledCategories.has("playbook")) parts.push("playbook");
    if (enabledCategories.has("milestones")) parts.push("milestones");
    if (enabledCategories.has("red_flags")) parts.push("red_flags");
    if (enabledCategories.has("activities")) parts.push("activities");
    return parts.join(",");
  }, [enabledCategories]);

  const { data: events = [], isLoading } = useQuery<TimelineEvent[]>({
    queryKey: ["deal-timeline-gantt", dealId, includeParam],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/crm/pipeline-enhancements/timeline/${dealId}?include=${includeParam}`,
      );
      return res.json();
    },
    enabled: !!dealId,
  });

  // DD extensions (for DD lane)
  const { data: ddExtensions = [] } = useQuery<DDExtensionInput[]>({
    queryKey: ["deal-extensions", dealId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/deals/${dealId}/extensions`);
      return res.json();
    },
    enabled: !!dealId,
  });

  // Deposits (for Deposits lane)
  const { data: deposits = [] } = useQuery<DealDeposit[]>({
    queryKey: ["deal-deposits", dealId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/deals/${dealId}/deposits`);
      return res.json();
    },
    enabled: !!dealId,
  });

  const now = useMemo(() => startOfDay(new Date()), []);

  // Group events by category (+ suppress redundant key_dates now covered by DD/Deposits lanes)
  const eventsByCategory = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      if (ev.eventType === "key_date" && SUPPRESSED_KEY_DATE_LABELS.has(ev.title)) continue;
      const cat = EVENT_TO_CATEGORY[ev.eventType] || "activities";
      if (!enabledCategories.has(cat) && cat !== "stages") continue;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ev);
    }
    return map;
  }, [events, enabledCategories]);

  const stageEvents = useMemo(
    () => events.filter((e) => e.eventType === "stage_change"),
    [events],
  );

  // Time bounds — include DD segment end + deposits dates
  const { timeStart, timeEnd, totalDays } = useMemo(() => {
    const allDates: Date[] = events.flatMap((ev) => [new Date(ev.startDate), new Date(ev.endDate)]);
    for (const d of deposits) {
      if (d.calculatedDueDate) allDates.push(new Date(d.calculatedDueDate));
      if (d.actualPaidDate) allDates.push(new Date(d.actualPaidDate));
    }
    if (deal.psaSignedDate) allDates.push(new Date(deal.psaSignedDate));
    if (deal.ddPeriodDays && deal.psaSignedDate) {
      // Include the pending extension tail too for width computation
      const totalExtDays = (ddExtensions || []).reduce((n, e) => n + (e.days || 0), 0);
      const psa = new Date(deal.psaSignedDate);
      allDates.push(
        new Date(psa.getTime() + (deal.ddPeriodDays + totalExtDays) * 86400000),
      );
    }
    if (deal.closingDate) allDates.push(new Date(deal.closingDate));
    allDates.push(now);
    if (!allDates.length) {
      return { timeStart: addDays(now, -30), timeEnd: addDays(now, 60), totalDays: 90 };
    }
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())));
    const s = addDays(startOfDay(min), -7);
    const e = addDays(startOfDay(max), 14);
    return { timeStart: s, timeEnd: e, totalDays: Math.max(differenceInDays(e, s), 30) };
  }, [events, deposits, ddExtensions, deal, now]);

  const pxPerDay = PIXELS_PER_DAY[zoomLevel];
  const totalWidth = totalDays * pxPerDay;

  const getXPx = useCallback(
    (date: Date) => {
      const days = differenceInDays(startOfDay(date), timeStart);
      return Math.max(0, Math.min(totalWidth, days * pxPerDay));
    },
    [timeStart, pxPerDay, totalWidth],
  );

  // Grid columns
  const gridColumns = useMemo(() => {
    const cols: { start: Date; end: Date; label: string }[] = [];
    let cursor = timeStart;
    while (cursor < timeEnd) {
      if (zoomLevel === "day") {
        cols.push({ start: cursor, end: addDays(cursor, 1), label: format(cursor, "MMM d") });
        cursor = addDays(cursor, 1);
      } else if (zoomLevel === "week") {
        const ws = startOfWeek(cursor, { weekStartsOn: 1 });
        const we = addDays(ws, 7);
        cols.push({ start: ws, end: we, label: format(ws, "MMM d") });
        cursor = we;
      } else {
        const ms = startOfMonth(cursor);
        const me = addMonths(ms, 1);
        cols.push({ start: ms, end: me, label: format(ms, "MMM yyyy") });
        cursor = me;
      }
    }
    return cols;
  }, [timeStart, timeEnd, zoomLevel]);

  const todayPx = getXPx(now);

  const toggleCategory = (cat: string) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const scrollToToday = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, todayPx - scrollRef.current.clientWidth / 2);
    }
  };

  // Categories rendered (respect insertion order on CATEGORY_CONFIG)
  const visibleCategories = useMemo(() => {
    return Object.keys(CATEGORY_CONFIG).filter((cat) => enabledCategories.has(cat));
  }, [enabledCategories]);

  // Category event counts for chips (include DD + deposits synthetic counts)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [cat, list] of eventsByCategory.entries()) counts[cat] = list.length;
    counts.due_diligence =
      deal.psaSignedDate && deal.ddPeriodDays ? 1 + (ddExtensions?.length || 0) : 0;
    counts.deposits = deposits?.length || 0;
    return counts;
  }, [eventsByCategory, deal, ddExtensions, deposits]);

  const hasAnyDates =
    deal.psaSignedDate || deal.ddExpirationDate || deal.closingDate || deal.expectedCloseDate;

  if (!hasAnyDates && !events.length && !deposits.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Calendar className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Add key dates to see your deal timeline</p>
        <p className="text-xs mt-1">Set PSA, DD, or closing dates on this deal to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stage progression bar (top) */}
      {stageEvents.length > 0 && <DealStageProgressBar stageEvents={stageEvents} />}

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const isOn = enabledCategories.has(key);
            const count = categoryCounts[key] || 0;
            return (
              <button
                key={key}
                onClick={() => toggleCategory(key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  isOn
                    ? "bg-white border-gray-300 text-gray-700 shadow-sm"
                    : "bg-gray-50 border-transparent text-gray-400"
                }`}
              >
                <cfg.icon className="h-3 w-3" style={{ color: isOn ? cfg.color : undefined }} />
                {cfg.label}
                {count > 0 && isOn && (
                  <span className="text-[9px] text-gray-400 ml-0.5">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 border rounded px-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={zoomLevel === "day"}
              onClick={() => setZoomLevel(zoomLevel === "month" ? "week" : "day")}
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <span className="text-[10px] text-gray-500 w-9 text-center capitalize">{zoomLevel}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={zoomLevel === "month"}
              onClick={() => setZoomLevel(zoomLevel === "day" ? "week" : "month")}
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={scrollToToday}>
            <CalendarDays className="h-3 w-3" />
            Today
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {/* Gantt swimlanes */}
      {!isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="border rounded-lg overflow-hidden bg-white"
        >
          <div className="flex">
            {/* Left label column */}
            <div className="w-28 min-w-[112px] flex-shrink-0 border-r bg-gray-50">
              <div className="h-8 border-b px-2 flex items-center text-[10px] font-medium text-gray-500 uppercase">
                Category
              </div>
              {visibleCategories.map((cat, i) => {
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <motion.div
                    key={cat}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.15 + i * 0.06,
                      duration: 0.35,
                      ease: [0.2, 0.8, 0.2, 1],
                    }}
                    className="h-10 border-b px-2 flex items-center gap-1.5"
                  >
                    <cfg.icon className="h-3 w-3" style={{ color: cfg.color }} />
                    <span className="text-[11px] font-medium text-gray-600">{cfg.label}</span>
                  </motion.div>
                );
              })}
            </div>

            {/* Right timeline area */}
            <div className="flex-1 overflow-x-auto" ref={scrollRef}>
              <div style={{ width: `${totalWidth}px`, minWidth: "100%" }} className="relative">
                {/* Time axis header */}
                <div className="h-8 border-b bg-gray-50 relative">
                  {gridColumns.map((col, i) => {
                    const leftPx = getXPx(col.start);
                    const widthPx = getXPx(col.end) - leftPx;
                    return (
                      <div
                        key={i}
                        className="absolute text-center text-[10px] font-medium text-gray-500 border-r border-gray-200 flex items-center justify-center"
                        style={{ width: `${widthPx}px`, left: `${leftPx}px`, height: "100%" }}
                      >
                        {col.label}
                      </div>
                    );
                  })}
                </div>

                {/* Pulsing today marker */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25, duration: 0.4 }}
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: `${todayPx}px` }}
                >
                  <div className="relative h-full -translate-x-1/2">
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-amber-500/70" />
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0.5, 0.9] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute top-4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
                    />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-amber-700 uppercase tracking-wider whitespace-nowrap">
                      Today
                    </div>
                  </div>
                </motion.div>

                {/* Grid lines */}
                {gridColumns.map((col, i) => (
                  <div
                    key={`g-${i}`}
                    className="absolute top-8 bottom-0 border-l border-gray-100 pointer-events-none"
                    style={{ left: `${getXPx(col.start)}px` }}
                  />
                ))}

                {/* Swimlane rows */}
                {visibleCategories.map((cat, catIdx) => {
                  const laneDelay = 0.18 + catIdx * 0.08;

                  if (cat === "due_diligence") {
                    return (
                      <motion.div
                        key={cat}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: laneDelay, duration: 0.3 }}
                        className="h-10 border-b relative"
                      >
                        {deal.psaSignedDate && deal.ddPeriodDays ? (
                          <DDSegmentRow
                            psaSignedDate={deal.psaSignedDate}
                            ddPeriodDays={deal.ddPeriodDays}
                            extensions={ddExtensions}
                            getXPx={getXPx}
                            baseDelay={laneDelay}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center px-3 text-[10px] text-slate-400 italic">
                            DD segment appears once PSA + period are set
                          </div>
                        )}
                      </motion.div>
                    );
                  }

                  if (cat === "deposits") {
                    return (
                      <motion.div
                        key={cat}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: laneDelay, duration: 0.3 }}
                        className="h-10 border-b relative"
                      >
                        {deposits.map((d, i) => {
                          const due = d.calculatedDueDate ? new Date(d.calculatedDueDate) : null;
                          const paid = d.actualPaidDate ? new Date(d.actualPaidDate) : null;
                          const targetDate = paid || due;
                          if (!targetDate) return null;
                          const left = getXPx(targetDate);
                          const isPaid = !!paid;
                          const isOverdue = !isPaid && due && due < now;
                          return (
                            <DepositMarker
                              key={d.id}
                              deposit={d}
                              left={left}
                              isPaid={isPaid}
                              isOverdue={!!isOverdue}
                              delay={laneDelay + 0.1 + i * 0.08}
                            />
                          );
                        })}
                      </motion.div>
                    );
                  }

                  const catEvents = eventsByCategory.get(cat) || [];
                  // Simple collision: sort by x, if next is within 12px of last, bump row offset
                  const positioned = layoutEventsWithCollision(catEvents, getXPx);

                  return (
                    <motion.div
                      key={cat}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: laneDelay, duration: 0.3 }}
                      className="h-10 border-b relative"
                    >
                      {positioned.map((p, i) => (
                        <EventMarker
                          key={p.event.id}
                          event={p.event}
                          x={p.x}
                          width={p.width}
                          rowOffset={p.rowOffset}
                          delay={laneDelay + 0.08 + i * 0.04}
                          now={now}
                        />
                      ))}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Event layout with collision handling ─────────────────────────────────

interface PositionedEvent {
  event: TimelineEvent;
  x: number;
  width: number;
  rowOffset: number; // 0 = top of row, 1 = mid, 2 = bottom
}

function layoutEventsWithCollision(
  events: TimelineEvent[],
  getXPx: (d: Date) => number,
): PositionedEvent[] {
  // Point events get stacked if within 12px of each other
  const sorted = [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  const COLLISION_PX = 12;
  const lanes: number[] = []; // last-x-used for each offset row
  const out: PositionedEvent[] = [];
  for (const ev of sorted) {
    const start = getXPx(new Date(ev.startDate));
    const end = getXPx(new Date(ev.endDate));
    const isPoint = Math.abs(end - start) < 4;
    const x = start;
    const width = isPoint ? 0 : Math.max(end - start, 6);
    let rowOffset = 0;
    if (isPoint) {
      while (rowOffset < 3 && lanes[rowOffset] != null && x - lanes[rowOffset] < COLLISION_PX) {
        rowOffset++;
      }
      rowOffset = Math.min(rowOffset, 2);
      lanes[rowOffset] = x;
    }
    out.push({ event: ev, x, width, rowOffset });
  }
  return out;
}

// ─── Individual marker components ─────────────────────────────────────────

function EventMarker({
  event,
  x,
  width,
  rowOffset,
  delay,
  now,
}: {
  event: TimelineEvent;
  x: number;
  width: number;
  rowOffset: number;
  delay: number;
  now: Date;
}) {
  const isPoint = width === 0;
  const topPx = 8 + rowOffset * 8; // stagger vertically on collision (8/16/24)

  if (isPoint) {
    if (event.eventType === "red_flag") {
      return (
        <GanttPopover event={event} showDealLink={false}>
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, type: "spring", stiffness: 400, damping: 20 }}
            className="absolute cursor-pointer hover:scale-110 transition-transform"
            style={{ left: `${x - 6}px`, top: `${topPx}px` }}
          >
            <AlertTriangle className="h-4 w-4" style={{ color: event.color }} />
          </motion.div>
        </GanttPopover>
      );
    }
    if (event.eventType === "activity") {
      return (
        <GanttPopover event={event} showDealLink={false}>
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.25 }}
            className="absolute w-2 h-2 rounded-full cursor-pointer hover:scale-150 transition-transform"
            style={{ left: `${x - 4}px`, top: `${topPx + 4}px`, backgroundColor: event.color }}
          />
        </GanttPopover>
      );
    }
    if (event.eventType === "playbook") {
      return (
        <GanttPopover event={event} showDealLink={false}>
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, type: "spring", stiffness: 400, damping: 20 }}
            className="absolute cursor-pointer hover:scale-110 transition-transform"
            style={{ left: `${x - 6}px`, top: `${topPx}px` }}
          >
            {event.status === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
            )}
          </motion.div>
        </GanttPopover>
      );
    }
    if (event.eventType === "custom_deadline") {
      return (
        <GanttPopover event={event} showDealLink={false}>
          <motion.div
            initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
            animate={{ opacity: 1, scale: 1, rotate: 45 }}
            transition={{ delay, type: "spring", stiffness: 400, damping: 18 }}
            className="absolute w-3 h-3 cursor-pointer hover:scale-125 transition-transform"
            style={{
              left: `${x - 6}px`,
              top: `${topPx}px`,
              backgroundColor: "transparent",
              border: `2px solid ${event.color}`,
            }}
          />
        </GanttPopover>
      );
    }
    const isPast = new Date(event.startDate) < now;
    const isOverdue = isPast && event.status === "upcoming";
    return (
      <GanttPopover event={event} showDealLink={false}>
        <motion.div
          initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
          animate={{ opacity: 1, scale: 1, rotate: 45 }}
          transition={{ delay, type: "spring", stiffness: 400, damping: 18 }}
          className={`absolute w-3 h-3 cursor-pointer hover:scale-125 transition-transform ${
            isOverdue ? "ring-2 ring-red-400 animate-pulse" : ""
          }`}
          style={{ left: `${x - 6}px`, top: `${topPx}px`, backgroundColor: event.color }}
        />
      </GanttPopover>
    );
  }

  // Range bar
  return (
    <GanttPopover event={event} showDealLink={false}>
      <motion.div
        initial={{ scaleX: 0, transformOrigin: "left center", opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        className="absolute top-2.5 h-5 rounded cursor-pointer hover:opacity-80 transition-opacity"
        style={{
          left: `${x}px`,
          width: `${width}px`,
          backgroundColor: `${event.color}25`,
          border: `1px solid ${event.color}`,
        }}
      >
        {width > 40 && (
          <span
            className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium truncate"
            style={{ color: event.color }}
          >
            {event.title.replace("Stage: ", "")}
          </span>
        )}
      </motion.div>
    </GanttPopover>
  );
}

function DepositMarker({
  deposit,
  left,
  isPaid,
  isOverdue,
  delay,
}: {
  deposit: DealDeposit;
  left: number;
  isPaid: boolean;
  isOverdue: boolean;
  delay: number;
}) {
  const amount = Number(deposit.amount || 0);
  const amountLabel =
    amount >= 1_000_000
      ? `$${(amount / 1_000_000).toFixed(1)}M`
      : amount >= 1_000
        ? `$${(amount / 1_000).toFixed(0)}k`
        : `$${amount.toFixed(0)}`;
  const color = isPaid ? "#10B981" : isOverdue ? "#EF4444" : "#EC4899";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay, type: "spring", stiffness: 380, damping: 20 }}
            className="absolute top-2 cursor-pointer"
            style={{ left: `${left - 12}px` }}
          >
            <div
              className={`h-6 px-1.5 rounded-md flex items-center gap-0.5 shadow-sm text-[9px] font-semibold text-white ${
                isOverdue ? "animate-pulse" : ""
              }`}
              style={{ backgroundColor: color }}
            >
              {isPaid ? (
                <CheckCircle2 className="h-2.5 w-2.5" />
              ) : (
                <DollarSign className="h-2.5 w-2.5" />
              )}
              {amountLabel}
            </div>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">
            Deposit #{deposit.depositNumber} · {amountLabel}
          </p>
          <p className="text-muted-foreground">
            Anchor: {deposit.anchorEvent?.replace(/_/g, " ")}
          </p>
          {deposit.calculatedDueDate && (
            <p className="text-muted-foreground">
              Due {format(new Date(deposit.calculatedDueDate), "MMM d, yyyy")}
            </p>
          )}
          {deposit.actualPaidDate && (
            <p className="text-emerald-600">
              Paid {format(new Date(deposit.actualPaidDate), "MMM d, yyyy")}
            </p>
          )}
          {isOverdue && <p className="text-red-600 font-medium">Overdue</p>}
          {deposit.refundable && <p className="text-muted-foreground text-[10px]">Refundable</p>}
          {deposit.appliedToPrice && (
            <p className="text-muted-foreground text-[10px]">Applied to price</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
