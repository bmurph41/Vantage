import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, DollarSign, Calendar, AlertTriangle } from "lucide-react";
import {
  format, differenceInDays, addDays, startOfDay, startOfWeek, startOfMonth,
  addMonths, addWeeks, endOfMonth, endOfWeek,
} from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { formatCompactCurrency } from "@shared/crm-constants";
import GanttToolbar, { type ZoomLevel, type GroupBy } from "./gantt-toolbar";
import GanttPopover, { type TimelineEvent } from "./gantt-popover";
import { toPng } from "html-to-image";

interface DealGanttViewProps {
  pipelineId?: string;
  className?: string;
}

interface DealSummary {
  id: string;
  title: string;
  stage: string;
  stageName: string;
  stageColor: string;
  owner: { id: string; name: string } | null;
  priority: string;
  probability: number;
  value: string | null;
  expectedCloseDate: string | null;
  daysInCurrentStage: number;
  slaStatus: "ok" | "warning" | "overdue";
}

const PIXELS_PER_DAY: Record<ZoomLevel, number> = {
  day: 20,
  week: 8,
  month: 2,
};

const SLA_ROW_BG: Record<string, string> = {
  ok: "",
  warning: "bg-amber-50/50",
  overdue: "bg-red-50/50",
};

export default function DealGanttView({ pipelineId, className = "" }: DealGanttViewProps) {
  const [, setLocation] = useLocation();
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("week");
  const [groupBy, setGroupBy] = useState<GroupBy>("deal");
  const scrollRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const [hoveredDealId, setHoveredDealId] = useState<string | null>(null);

  const now = useMemo(() => startOfDay(new Date()), []);

  const { data, isLoading } = useQuery<{ deals: DealSummary[]; events: TimelineEvent[]; timeRange: { start: string; end: string } }>({
    queryKey: ["/api/crm/pipeline/timeline", pipelineId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (pipelineId) params.set("pipelineId", pipelineId);
      params.set("groupBy", groupBy);
      const res = await apiRequest("GET", `/api/crm/pipeline/timeline?${params}`);
      return res.json();
    },
  });

  const deals = data?.deals || [];
  const events = data?.events || [];

  // Compute time bounds from events
  const { timeStart, timeEnd, totalDays } = useMemo(() => {
    if (!events.length && !deals.length) {
      const s = addDays(now, -30);
      const e = addDays(now, 60);
      return { timeStart: s, timeEnd: e, totalDays: 90 };
    }
    const allDates = events.flatMap((ev) => [new Date(ev.startDate), new Date(ev.endDate)]);
    allDates.push(now);
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())));
    const s = addDays(startOfDay(min), -7);
    const e = addDays(startOfDay(max), 14);
    return {
      timeStart: s,
      timeEnd: e,
      totalDays: Math.max(differenceInDays(e, s), 30),
    };
  }, [events, deals, now]);

  const pxPerDay = PIXELS_PER_DAY[zoomLevel];
  const totalWidth = totalDays * pxPerDay;

  const getXPx = useCallback(
    (date: Date) => {
      const days = differenceInDays(startOfDay(date), timeStart);
      return Math.max(0, Math.min(totalWidth, days * pxPerDay));
    },
    [timeStart, pxPerDay, totalWidth],
  );

  // Generate grid columns based on zoom
  const gridColumns = useMemo(() => {
    const cols: { start: Date; end: Date; label: string }[] = [];
    let cursor = timeStart;
    while (cursor < timeEnd) {
      if (zoomLevel === "day") {
        cols.push({ start: cursor, end: addDays(cursor, 1), label: format(cursor, "MMM d") });
        cursor = addDays(cursor, 1);
      } else if (zoomLevel === "week") {
        const weekStart = startOfWeek(cursor, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 7);
        cols.push({ start: weekStart, end: weekEnd, label: format(weekStart, "MMM d") });
        cursor = weekEnd;
      } else {
        const mStart = startOfMonth(cursor);
        const mEnd = addMonths(mStart, 1);
        cols.push({ start: mStart, end: mEnd, label: format(mStart, "MMM yyyy") });
        cursor = mEnd;
      }
    }
    return cols;
  }, [timeStart, timeEnd, zoomLevel]);

  // Group events by deal
  const eventsByDeal = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      if (!map.has(ev.dealId)) map.set(ev.dealId, []);
      map.get(ev.dealId)!.push(ev);
    }
    return map;
  }, [events]);

  // Group deals
  const groupedDeals = useMemo(() => {
    if (groupBy === "stage") {
      const groups = new Map<string, { label: string; deals: DealSummary[] }>();
      for (const d of deals) {
        const key = d.stageName || "No Stage";
        if (!groups.has(key)) groups.set(key, { label: key, deals: [] });
        groups.get(key)!.deals.push(d);
      }
      return Array.from(groups.values());
    }
    if (groupBy === "owner") {
      const groups = new Map<string, { label: string; deals: DealSummary[] }>();
      for (const d of deals) {
        const key = d.owner?.name || "Unassigned";
        if (!groups.has(key)) groups.set(key, { label: key, deals: [] });
        groups.get(key)!.deals.push(d);
      }
      return Array.from(groups.values());
    }
    return [{ label: "", deals }];
  }, [deals, groupBy]);

  const todayPx = getXPx(now);

  const scrollToToday = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, todayPx - scrollRef.current.clientWidth / 2);
    }
  }, [todayPx]);

  const handleExportPng = useCallback(async () => {
    if (!ganttRef.current) return;
    try {
      const dataUrl = await toPng(ganttRef.current, { backgroundColor: "#fff" });
      const link = document.createElement("a");
      link.download = `deal-gantt-${format(new Date(), "yyyy-MM-dd")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, []);

  const handlePrint = useCallback(() => window.print(), []);

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-10 w-full" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!deals.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Calendar className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-sm font-medium">No deals in this pipeline</p>
        <p className="text-xs mt-1">Add deals with key dates to see the timeline view</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`} ref={ganttRef}>
      {/* Toolbar */}
      <GanttToolbar
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        showGroupBy
        onTodayClick={scrollToToday}
        onExportPng={handleExportPng}
        onPrint={handlePrint}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-b bg-gray-50 text-[11px] text-gray-500 print:hidden">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rotate-45 bg-purple-500" /> Key Date
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2 rounded-sm bg-[#4A6FA5]" /> Stage
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-1.5 rounded-sm bg-blue-500" /> Task
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-red-500" /> Red Flag
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-px h-3 bg-[#2DD4BF]" style={{ borderLeft: '2px dashed #2DD4BF' }} /> Today
        </div>
      </div>

      {/* Gantt body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left panel: deal names */}
        <div className="w-40 md:w-60 min-w-[160px] md:min-w-[240px] flex-shrink-0 border-r bg-white overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gray-50 border-b px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider h-9 flex items-center">
            Deal
          </div>
          {groupedDeals.map((group) => (
            <div key={group.label}>
              {group.label && groupBy !== "deal" && (
                <div className="px-3 py-1.5 bg-gray-100 text-[11px] font-semibold text-gray-600 uppercase tracking-wider border-b">
                  {group.label}
                </div>
              )}
              {group.deals.map((deal) => (
                <div
                  key={deal.id}
                  className={`flex items-center px-3 py-2 border-b cursor-pointer hover:bg-blue-50/40 transition-colors h-12 ${
                    hoveredDealId === deal.id ? "bg-blue-50/40" : SLA_ROW_BG[deal.slaStatus]
                  }`}
                  onMouseEnter={() => setHoveredDealId(deal.id)}
                  onMouseLeave={() => setHoveredDealId(null)}
                  onClick={() => setLocation(`/deals/${deal.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{deal.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {deal.value && (
                        <span className="text-[10px] font-medium text-emerald-600">
                          {formatCompactCurrency(Number(deal.value))}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[9px] h-3.5 px-1 leading-none"
                        style={{ borderColor: deal.stageColor, color: deal.stageColor }}
                      >
                        {deal.stageName}
                      </Badge>
                      {deal.slaStatus === "overdue" && (
                        <Badge variant="destructive" className="text-[9px] h-3.5 px-1">SLA</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right panel: timeline */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div style={{ width: `${totalWidth}px`, minWidth: "100%" }} className="relative">
            {/* Time axis header */}
            <div className="sticky top-0 z-10 bg-gray-50 border-b flex h-9">
              {gridColumns.map((col, i) => {
                const leftPx = getXPx(col.start);
                const widthPx = getXPx(col.end) - leftPx;
                return (
                  <div
                    key={i}
                    className="text-center text-[11px] font-medium text-gray-500 border-r border-gray-200 flex items-center justify-center shrink-0"
                    style={{ width: `${widthPx}px`, position: "absolute", left: `${leftPx}px`, height: "100%" }}
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

            {/* Grid lines (subtle) */}
            {gridColumns.map((col, i) => {
              const leftPx = getXPx(col.start);
              return (
                <div
                  key={`grid-${i}`}
                  className="absolute top-9 bottom-0 border-l border-gray-100 pointer-events-none"
                  style={{ left: `${leftPx}px` }}
                />
              );
            })}

            {/* Deal rows */}
            {groupedDeals.map((group) => (
              <div key={group.label}>
                {group.label && groupBy !== "deal" && (
                  <div className="h-[26px] bg-gray-100 border-b" />
                )}
                {group.deals.map((deal) => {
                  const dealEvents = eventsByDeal.get(deal.id) || [];
                  const stageEvents = dealEvents.filter((e) => e.eventType === "stage_change");
                  const keyDateEvents = dealEvents.filter((e) => e.eventType === "key_date" || e.eventType === "custom_deadline");
                  const taskEvents = dealEvents.filter((e) => e.eventType === "task");
                  const redFlagEvents = dealEvents.filter((e) => e.eventType === "red_flag");
                  const milestoneEvents = dealEvents.filter((e) => e.eventType === "milestone");

                  return (
                    <div
                      key={deal.id}
                      className={`relative border-b h-12 ${
                        hoveredDealId === deal.id ? "bg-blue-50/30" : SLA_ROW_BG[deal.slaStatus]
                      }`}
                      onMouseEnter={() => setHoveredDealId(deal.id)}
                      onMouseLeave={() => setHoveredDealId(null)}
                    >
                      {/* Stage bars */}
                      {stageEvents.map((ev) => {
                        const left = getXPx(new Date(ev.startDate));
                        const right = getXPx(new Date(ev.endDate));
                        const width = Math.max(right - left, 4);
                        return (
                          <GanttPopover key={ev.id} event={ev}>
                            <div
                              className="absolute top-2 h-5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                              style={{
                                left: `${left}px`,
                                width: `${width}px`,
                                backgroundColor: `${ev.color}30`,
                                border: `1px solid ${ev.color}`,
                              }}
                            >
                              {width > 50 && (
                                <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-medium truncate" style={{ color: ev.color }}>
                                  {ev.title.replace("Stage: ", "")}
                                </span>
                              )}
                            </div>
                          </GanttPopover>
                        );
                      })}

                      {/* Task bars (thinner, below stage) */}
                      {taskEvents.map((ev) => {
                        const left = getXPx(new Date(ev.startDate));
                        const right = getXPx(new Date(ev.endDate));
                        const width = Math.max(right - left, 6);
                        return (
                          <GanttPopover key={ev.id} event={ev}>
                            <div
                              className="absolute top-8 h-2 rounded-sm cursor-pointer hover:opacity-70"
                              style={{
                                left: `${left}px`,
                                width: `${width}px`,
                                backgroundColor: ev.color,
                              }}
                              title={ev.title}
                            />
                          </GanttPopover>
                        );
                      })}

                      {/* Key date diamonds */}
                      {keyDateEvents.map((ev) => {
                        const x = getXPx(new Date(ev.startDate));
                        const isPast = new Date(ev.startDate) < now;
                        return (
                          <GanttPopover key={ev.id} event={ev}>
                            <div
                              className={`absolute top-3 w-3 h-3 rotate-45 cursor-pointer hover:scale-125 transition-transform ${
                                isPast && ev.status === "upcoming" ? "animate-pulse ring-2 ring-red-400" : ""
                              }`}
                              style={{
                                left: `${x - 6}px`,
                                backgroundColor: ev.color,
                              }}
                              title={ev.title}
                            />
                          </GanttPopover>
                        );
                      })}

                      {/* Red flag markers */}
                      {redFlagEvents.map((ev) => {
                        const x = getXPx(new Date(ev.startDate));
                        return (
                          <GanttPopover key={ev.id} event={ev}>
                            <div
                              className="absolute top-1 cursor-pointer hover:scale-110 transition-transform"
                              style={{ left: `${x - 6}px` }}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" style={{ color: ev.color }} />
                            </div>
                          </GanttPopover>
                        );
                      })}

                      {/* Milestone diamonds (outlined) */}
                      {milestoneEvents.map((ev) => {
                        const x = getXPx(new Date(ev.startDate));
                        return (
                          <GanttPopover key={ev.id} event={ev}>
                            <div
                              className="absolute top-3 w-3 h-3 rotate-45 cursor-pointer border-2 hover:scale-125 transition-transform"
                              style={{
                                left: `${x - 6}px`,
                                borderColor: ev.color,
                                backgroundColor: ev.status === "approved" ? ev.color : "white",
                              }}
                              title={ev.title}
                            />
                          </GanttPopover>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
