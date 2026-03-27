import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calendar, ChevronLeft, ChevronRight, AlertTriangle, Clock, Building2,
  DollarSign, ZoomIn, ZoomOut,
} from "lucide-react";
import { format, differenceInDays, addMonths, startOfMonth, endOfMonth, isWithinInterval, isBefore, addDays } from "date-fns";
import type { Deal, Contact, Company, PipelineStage } from "@shared/schema";
import { formatCompactCurrency } from "@shared/crm-constants";

type DealWithRelations = Deal & { contact?: Contact | null; company?: Company | null };

interface TimelineViewProps {
  searchQuery: string;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Color palette for deal bars
const getBarColor = (deal: DealWithRelations, now: Date) => {
  const ddExp = deal.ddExpirationDate ? new Date(deal.ddExpirationDate) : null;
  const closing = deal.closingDate ? new Date(deal.closingDate) : null;

  // DD expiry < 7 days = red
  if (ddExp && differenceInDays(ddExp, now) <= 7 && differenceInDays(ddExp, now) >= 0) {
    return { bg: "rgba(239,68,68,0.25)", border: "#ef4444", text: "text-red-700" };
  }
  // DD expiry < 14 days = amber
  if (ddExp && differenceInDays(ddExp, now) <= 14 && differenceInDays(ddExp, now) > 7) {
    return { bg: "rgba(245,158,11,0.25)", border: "#f59e0b", text: "text-amber-700" };
  }
  // Overdue closing
  if (closing && isBefore(closing, now)) {
    return { bg: "rgba(239,68,68,0.15)", border: "#ef4444", text: "text-red-600" };
  }
  // Default: blue
  return { bg: "rgba(59,130,246,0.2)", border: "#3b82f6", text: "text-blue-700" };
};

export default function TimelineView({ searchQuery }: TimelineViewProps) {
  const [, setLocation] = useLocation();
  const now = useMemo(() => new Date(), []);
  const [monthsToShow, setMonthsToShow] = useState(6);
  const [startMonth, setStartMonth] = useState(() => startOfMonth(now));
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: deals = [], isLoading } = useQuery<DealWithRelations[]>({ queryKey: ["/api/deals"] });
  const { data: stages = [] } = useQuery<PipelineStage[]>({ queryKey: ["/api/stages"] });

  // Filter to open deals with at least one date
  const timelineDeals = useMemo(() => {
    return deals
      .filter((d) => {
        if (d.isClosed) return false;
        const hasDate = d.psaSignedDate || d.ddExpirationDate || d.closingDate || d.expectedCloseDate;
        if (!hasDate) return false;

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matches =
            d.title?.toLowerCase().includes(q) ||
            d.company?.name?.toLowerCase().includes(q) ||
            d.contact?.firstName?.toLowerCase().includes(q) ||
            d.contact?.lastName?.toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aStart = a.psaSignedDate || a.createdAt;
        const bStart = b.psaSignedDate || b.createdAt;
        return new Date(aStart!).getTime() - new Date(bStart!).getTime();
      });
  }, [deals, searchQuery]);

  // Generate month columns
  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < monthsToShow; i++) {
      const m = addMonths(startMonth, i);
      result.push({ start: startOfMonth(m), end: endOfMonth(m), label: format(m, "MMM yyyy") });
    }
    return result;
  }, [startMonth, monthsToShow]);

  const timelineStart = months[0].start;
  const timelineEnd = months[months.length - 1].end;
  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;

  // Get x-position as percentage
  const getXPercent = (date: Date) => {
    const days = differenceInDays(date, timelineStart);
    return Math.max(0, Math.min(100, (days / totalDays) * 100));
  };

  // Today marker position
  const todayPercent = getXPercent(now);

  const handlePrev = () => setStartMonth((prev) => addMonths(prev, -1));
  const handleNext = () => setStartMonth((prev) => addMonths(prev, 1));

  const getStageName = (stageId: string | null | undefined) => {
    if (!stageId) return "";
    const stage = stages.find((s) => s.id === stageId);
    return stage?.name?.replace(/_/g, " ") || "";
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
            {format(months[0].start, "MMM yyyy")} — {format(months[months.length - 1].start, "MMM yyyy")}
          </span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{timelineDeals.length} deals with dates</span>
          <Button
            variant="outline" size="sm" className="h-8 gap-1 text-xs"
            onClick={() => setMonthsToShow((m) => Math.max(3, m - 1))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="sm" className="h-8 gap-1 text-xs"
            onClick={() => setMonthsToShow((m) => Math.min(12, m + 1))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 border-b bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" /> PSA Signed
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-500" /> DD Expiry
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" /> Closing
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-red-500" /> Today
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-sm bg-red-200 border border-red-400" /> DD &lt; 7 days
        </div>
      </div>

      {/* Gantt area */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <div className="min-w-[900px]">
          {/* Month header row */}
          <div className="flex border-b bg-white sticky top-0 z-10">
            {/* Deal name column */}
            <div className="w-64 min-w-[256px] flex-shrink-0 px-4 py-2 border-r bg-gray-50 font-medium text-xs text-gray-500 uppercase tracking-wider">
              Deal
            </div>
            {/* Month columns */}
            <div className="flex-1 flex relative">
              {months.map((month, i) => {
                const widthPct = (differenceInDays(month.end, month.start) + 1) / totalDays * 100;
                return (
                  <div
                    key={i}
                    className="text-center text-xs font-medium text-gray-500 py-2 border-r border-gray-200"
                    style={{ width: `${widthPct}%` }}
                  >
                    {month.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deal rows */}
          {timelineDeals.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No deals with timeline dates</p>
              <p className="text-xs mt-1">Add PSA, DD expiry, or closing dates to deals to see them here</p>
            </div>
          ) : (
            timelineDeals.map((deal) => {
              const barColor = getBarColor(deal, now);
              const psaDate = deal.psaSignedDate ? new Date(deal.psaSignedDate) : null;
              const ddDate = deal.ddExpirationDate ? new Date(deal.ddExpirationDate) : null;
              const closeDate = deal.closingDate ? new Date(deal.closingDate) : null;
              const expClose = deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null;

              // Bar spans from earliest to latest date
              const allDates = [psaDate, ddDate, closeDate, expClose].filter(Boolean) as Date[];
              const barStart = new Date(Math.min(...allDates.map((d) => d.getTime())));
              const barEnd = new Date(Math.max(...allDates.map((d) => d.getTime())));

              const barLeftPct = getXPercent(barStart);
              const barWidthPct = Math.max(1.5, getXPercent(barEnd) - barLeftPct);

              const ddUrgent = ddDate && differenceInDays(ddDate, now) <= 7 && differenceInDays(ddDate, now) >= 0;
              const stageName = getStageName(deal.stageId);

              return (
                <div
                  key={deal.id}
                  className="flex border-b hover:bg-blue-50/30 transition-colors cursor-pointer group"
                  onClick={() => setLocation(`/deals/${deal.id}`)}
                >
                  {/* Deal info column */}
                  <div className="w-64 min-w-[256px] flex-shrink-0 px-4 py-2.5 border-r">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 truncate leading-tight">
                          {deal.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          {deal.company && (
                            <span className="text-[11px] text-gray-500 truncate flex items-center gap-0.5">
                              <Building2 className="h-3 w-3" />
                              {deal.company.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-medium text-green-600 flex items-center gap-0.5">
                            <DollarSign className="h-3 w-3" />
                            {formatCompactCurrency(Number(deal.amount) || 0)}
                          </span>
                          {stageName && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              {stageName}
                            </Badge>
                          )}
                          {ddUrgent && (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1 gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              DD urgent
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline bar area */}
                  <div className="flex-1 relative py-2">
                    {/* Today line */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-400 z-10 pointer-events-none"
                      style={{ left: `${todayPercent}%` }}
                    />

                    {/* Deal bar */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute top-2 h-8 rounded-md border transition-shadow group-hover:shadow-md"
                            style={{
                              left: `${barLeftPct}%`,
                              width: `${barWidthPct}%`,
                              backgroundColor: barColor.bg,
                              borderColor: barColor.border,
                              minWidth: "20px",
                            }}
                          >
                            {/* Bar label */}
                            <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
                              <span className={`text-[10px] font-medium truncate ${barColor.text}`}>
                                {deal.title}
                              </span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-xs">
                          <p className="font-semibold">{deal.title}</p>
                          {psaDate && <p>PSA: {format(psaDate, "MM/dd/yyyy")}</p>}
                          {ddDate && (
                            <p className={ddUrgent ? "text-red-600 font-medium" : ""}>
                              DD Expiry: {format(ddDate, "MM/dd/yyyy")}
                              {ddUrgent && ` (${differenceInDays(ddDate, now)}d left)`}
                            </p>
                          )}
                          {closeDate && <p>Closing: {format(closeDate, "MM/dd/yyyy")}</p>}
                          {expClose && !closeDate && <p>Expected Close: {format(expClose, "MM/dd/yyyy")}</p>}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Date markers */}
                    {psaDate && (
                      <div
                        className="absolute top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm z-20"
                        style={{ left: `calc(${getXPercent(psaDate)}% - 5px)` }}
                        title={`PSA: ${format(psaDate, "MMM d")}`}
                      />
                    )}
                    {ddDate && (
                      <div
                        className={`absolute top-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-20 ${
                          ddUrgent ? "bg-red-500 animate-pulse" : "bg-amber-500"
                        }`}
                        style={{ left: `calc(${getXPercent(ddDate)}% - 5px)` }}
                        title={`DD Expiry: ${format(ddDate, "MMM d")}`}
                      />
                    )}
                    {closeDate && (
                      <div
                        className="absolute top-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white shadow-sm z-20"
                        style={{ left: `calc(${getXPercent(closeDate)}% - 5px)` }}
                        title={`Closing: ${format(closeDate, "MMM d")}`}
                      />
                    )}
                    {expClose && !closeDate && (
                      <div
                        className="absolute top-1 w-2.5 h-2.5 rounded-full bg-green-300 border-2 border-white shadow-sm z-20"
                        style={{ left: `calc(${getXPercent(expClose)}% - 5px)` }}
                        title={`Expected Close: ${format(expClose, "MMM d")}`}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
