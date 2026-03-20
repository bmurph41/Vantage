import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, Wrench } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";

interface ServiceWorkOrder {
  id: string;
  woNumber?: string | null;
  description?: string | null;
  status: string;
  priority?: string | null;
  openedDate: string;
  closedDate?: string | null;
  serviceType?: string | null;
  laborRevenue?: string | null;
  partsRevenue?: string | null;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  URGENT: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "Urgent" },
  HIGH: { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300", label: "High" },
  NORMAL: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", label: "Normal" },
  LOW: { bg: "bg-gray-100 dark:bg-gray-900/40", text: "text-gray-600 dark:text-gray-400", label: "Low" },
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function getPriorityStyle(priority: string | null | undefined) {
  return PRIORITY_COLORS[priority || "NORMAL"] || PRIORITY_COLORS.NORMAL;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ServiceCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStr = format(currentMonth, "yyyy-MM");

  const { data, isLoading } = useQuery<{ data: ServiceWorkOrder[] }>({
    queryKey: ["/api/operations-context/service-work-orders", { month: monthStr }],
    queryFn: async () => {
      const res = await fetch(`/api/operations-context/service-work-orders?month=${monthStr}`);
      if (res.status === 404) return { data: [] };
      if (!res.ok) return { data: [] };
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const workOrders = data?.data || [];

  // Build map of date -> work orders
  const workOrdersByDate = useMemo(() => {
    const map = new Map<string, ServiceWorkOrder[]>();
    for (const wo of workOrders) {
      const openDate = new Date(wo.openedDate);
      if (isSameMonth(openDate, currentMonth)) {
        const key = format(openDate, "yyyy-MM-dd");
        const existing = map.get(key) || [];
        existing.push(wo);
        map.set(key, existing);
      }
    }
    return map;
  }, [workOrders, currentMonth]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const paddedDays: (Date | null)[] = [
    ...Array.from({ length: startDayOfWeek }, () => null),
    ...calendarDays,
  ];

  const remainder = paddedDays.length % 7;
  if (remainder > 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      paddedDays.push(null);
    }
  }

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    rows.push(paddedDays.slice(i, i + 7));
  }

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const selectedDateWorkOrders = selectedDate
    ? workOrdersByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
    : [];

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Work Order Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold ml-2">
                {format(currentMonth, "MMMM yyyy")}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {Object.entries(PRIORITY_COLORS).map(([key, style]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <div className={`w-3 h-3 rounded-sm ${style.bg}`} />
                <span className="text-muted-foreground">{style.label}</span>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              Loading calendar...
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 bg-muted">
                {DAY_NAMES.map((day) => (
                  <div
                    key={day}
                    className="px-2 py-2 text-center text-xs font-medium text-muted-foreground border-b"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar rows */}
              {rows.map((row, rowIdx) => (
                <div key={rowIdx} className="grid grid-cols-7">
                  {row.map((day, colIdx) => {
                    if (!day) {
                      return (
                        <div
                          key={`empty-${colIdx}`}
                          className="min-h-[80px] border-b border-r last:border-r-0 bg-muted/20"
                        />
                      );
                    }

                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayWorkOrders = workOrdersByDate.get(dateKey) || [];
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isTodayDate = isToday(day);

                    // Count by priority
                    const priorityCounts = new Map<string, number>();
                    for (const wo of dayWorkOrders) {
                      const priority = wo.priority || "NORMAL";
                      const count = priorityCounts.get(priority) || 0;
                      priorityCounts.set(priority, count + 1);
                    }

                    return (
                      <button
                        key={dateKey}
                        onClick={() => setSelectedDate(day)}
                        className={`min-h-[80px] border-b border-r last:border-r-0 p-1.5 text-left transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset ${
                          isSelected ? "bg-accent ring-2 ring-primary ring-inset" : ""
                        } ${isTodayDate ? "bg-primary/5" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-sm font-medium ${
                              isTodayDate
                                ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs"
                                : "text-foreground"
                            }`}
                          >
                            {format(day, "d")}
                          </span>
                          {dayWorkOrders.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                              {dayWorkOrders.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {Array.from(priorityCounts.entries())
                            .sort((a, b) => {
                              const order = ["URGENT", "HIGH", "NORMAL", "LOW"];
                              return order.indexOf(a[0]) - order.indexOf(b[0]);
                            })
                            .slice(0, 3)
                            .map(([priority, count]) => {
                              const style = getPriorityStyle(priority);
                              return (
                                <div
                                  key={priority}
                                  className={`text-[10px] px-1 py-0.5 rounded ${style.bg} ${style.text} truncate`}
                                >
                                  {count} {style.label}
                                </div>
                              );
                            })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected day detail */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Work Orders for {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateWorkOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No work orders for this date.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateWorkOrders.map((wo) => {
                  const priorityStyle = getPriorityStyle(wo.priority);
                  return (
                    <div
                      key={wo.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {wo.woNumber && (
                            <span className="text-muted-foreground">#{wo.woNumber}</span>
                          )}
                          {wo.serviceType && <span>{wo.serviceType}</span>}
                        </div>
                        {wo.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {wo.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Status: {STATUS_LABELS[wo.status] || wo.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(wo.laborRevenue || wo.partsRevenue) && (
                          <span className="text-sm font-medium">
                            ${(Number(wo.laborRevenue || 0) + Number(wo.partsRevenue || 0)).toLocaleString()}
                          </span>
                        )}
                        <Badge className={`${priorityStyle.bg} ${priorityStyle.text} border-0`}>
                          {priorityStyle.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
