import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calendar, AlertTriangle, CheckCircle2, Diamond, Flag, Activity,
  ListChecks, ZoomIn, ZoomOut, CalendarDays,
} from "lucide-react";
import {
  format, differenceInDays, addDays, startOfDay, startOfWeek, startOfMonth,
  addMonths,
} from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import GanttPopover, { type TimelineEvent } from "@/components/crm/gantt-popover";
import DealTimelineVisualizer from "./deal-timeline-visualizer";

interface DealTimelineTabProps {
  dealId: string;
  deal: any;
}

type ZoomLevel = "day" | "week" | "month";

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; defaultOn: boolean }> = {
  stages: { label: "Stages", icon: Flag, color: "#4A6FA5", defaultOn: true },
  key_dates: { label: "Key Dates", icon: Diamond, color: "#8B5CF6", defaultOn: true },
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

export default function DealTimelineTab({ dealId, deal }: DealTimelineTabProps) {
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(
    () => new Set(Object.entries(CATEGORY_CONFIG).filter(([, c]) => c.defaultOn).map(([k]) => k)),
  );
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build include param from enabled categories
  const includeParam = useMemo(() => {
    const parts: string[] = [];
    if (enabledCategories.has("stages")) parts.push("stages");
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

  const now = useMemo(() => startOfDay(new Date()), []);

  // Group events by category
  const eventsByCategory = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      const cat = EVENT_TO_CATEGORY[ev.eventType] || "activities";
      if (!enabledCategories.has(cat)) continue;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ev);
    }
    return map;
  }, [events, enabledCategories]);

  // Time bounds
  const { timeStart, timeEnd, totalDays } = useMemo(() => {
    const allDates = events.flatMap((ev) => [new Date(ev.startDate), new Date(ev.endDate)]);
    allDates.push(now);
    if (!allDates.length) {
      return { timeStart: addDays(now, -30), timeEnd: addDays(now, 60), totalDays: 90 };
    }
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())));
    const s = addDays(startOfDay(min), -7);
    const e = addDays(startOfDay(max), 14);
    return { timeStart: s, timeEnd: e, totalDays: Math.max(differenceInDays(e, s), 30) };
  }, [events, now]);

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

  // Categories in display order (only ones with events or that are enabled)
  const visibleCategories = useMemo(() => {
    return Object.keys(CATEGORY_CONFIG).filter((cat) => enabledCategories.has(cat));
  }, [enabledCategories]);

  const hasAnyDates = deal.psaSignedDate || deal.ddExpirationDate || deal.closingDate || deal.expectedCloseDate;

  if (!hasAnyDates && !events.length) {
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
      {/* Compact DealTimelineVisualizer at top */}
      {hasAnyDates && (
        <DealTimelineVisualizer
          psaSignedDate={deal.psaSignedDate}
          ddExpirationDate={deal.ddExpirationDate}
          closingDate={deal.closingDate}
          ddPeriodDays={deal.ddPeriodDays}
          daysToClosing={deal.daysToClosing}
          extensions={deal.hasExtensions && deal.extensionDays ? deal.extensionDays.map((days: number, i: number) => ({
            id: `ext-${i}`,
            days,
            executed: i < (deal.extensionCount || 0),
          })) : []}
          variant="compact"
        />
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Category filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
            const isOn = enabledCategories.has(key);
            const count = eventsByCategory.get(key)?.length || 0;
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

        {/* Zoom + Today */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 border rounded px-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={zoomLevel === "day"}
              onClick={() => setZoomLevel(zoomLevel === "month" ? "week" : "day")}>
              <ZoomIn className="h-3 w-3" />
            </Button>
            <span className="text-[10px] text-gray-500 w-9 text-center capitalize">{zoomLevel}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={zoomLevel === "month"}
              onClick={() => setZoomLevel(zoomLevel === "day" ? "week" : "month")}>
              <ZoomOut className="h-3 w-3" />
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={scrollToToday}>
            <CalendarDays className="h-3 w-3" />
            Today
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}

      {/* Gantt swimlanes */}
      {!isLoading && (
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="flex">
            {/* Left label column */}
            <div className="w-28 min-w-[112px] flex-shrink-0 border-r bg-gray-50">
              <div className="h-8 border-b px-2 flex items-center text-[10px] font-medium text-gray-500 uppercase">
                Category
              </div>
              {visibleCategories.map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <div key={cat} className="h-10 border-b px-2 flex items-center gap-1.5">
                    <cfg.icon className="h-3 w-3" style={{ color: cfg.color }} />
                    <span className="text-[11px] font-medium text-gray-600">{cfg.label}</span>
                  </div>
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

                {/* Today line */}
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: `${todayPx}px`, width: "2px", borderLeft: "2px dashed #2DD4BF" }}
                />

                {/* Grid lines */}
                {gridColumns.map((col, i) => (
                  <div
                    key={`g-${i}`}
                    className="absolute top-8 bottom-0 border-l border-gray-100 pointer-events-none"
                    style={{ left: `${getXPx(col.start)}px` }}
                  />
                ))}

                {/* Swimlane rows */}
                {visibleCategories.map((cat) => {
                  const catEvents = eventsByCategory.get(cat) || [];
                  const cfg = CATEGORY_CONFIG[cat];
                  return (
                    <div key={cat} className="h-10 border-b relative">
                      {catEvents.map((ev) => {
                        const start = getXPx(new Date(ev.startDate));
                        const end = getXPx(new Date(ev.endDate));
                        const isPoint = start === end || Math.abs(end - start) < 4;

                        if (isPoint) {
                          // Point event: diamond or icon
                          if (ev.eventType === "red_flag") {
                            return (
                              <GanttPopover key={ev.id} event={ev} showDealLink={false}>
                                <div className="absolute top-2 cursor-pointer hover:scale-110 transition-transform" style={{ left: `${start - 6}px` }}>
                                  <AlertTriangle className="h-4 w-4" style={{ color: ev.color }} />
                                </div>
                              </GanttPopover>
                            );
                          }
                          if (ev.eventType === "activity") {
                            return (
                              <GanttPopover key={ev.id} event={ev} showDealLink={false}>
                                <div
                                  className="absolute top-4 w-2 h-2 rounded-full cursor-pointer hover:scale-150 transition-transform"
                                  style={{ left: `${start - 4}px`, backgroundColor: ev.color }}
                                />
                              </GanttPopover>
                            );
                          }
                          if (ev.eventType === "playbook") {
                            return (
                              <GanttPopover key={ev.id} event={ev} showDealLink={false}>
                                <div className="absolute top-2 cursor-pointer hover:scale-110 transition-transform" style={{ left: `${start - 6}px` }}>
                                  {ev.status === "completed" ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                                  )}
                                </div>
                              </GanttPopover>
                            );
                          }
                          // Default point: diamond
                          const isPast = new Date(ev.startDate) < now;
                          return (
                            <GanttPopover key={ev.id} event={ev} showDealLink={false}>
                              <div
                                className={`absolute top-3 w-3 h-3 rotate-45 cursor-pointer hover:scale-125 transition-transform ${
                                  isPast && ev.status === "upcoming" ? "animate-pulse ring-2 ring-red-400" : ""
                                }`}
                                style={{ left: `${start - 6}px`, backgroundColor: ev.color }}
                              />
                            </GanttPopover>
                          );
                        }

                        // Range event: bar
                        const width = Math.max(end - start, 6);
                        return (
                          <GanttPopover key={ev.id} event={ev} showDealLink={false}>
                            <div
                              className="absolute top-2.5 h-5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                              style={{
                                left: `${start}px`,
                                width: `${width}px`,
                                backgroundColor: `${ev.color}25`,
                                border: `1px solid ${ev.color}`,
                              }}
                            >
                              {width > 40 && (
                                <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium truncate" style={{ color: ev.color }}>
                                  {ev.title.replace("Stage: ", "")}
                                </span>
                              )}
                            </div>
                          </GanttPopover>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
