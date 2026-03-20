import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays, Ship } from "lucide-react";
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

interface BoatRentalReservation {
  id: string;
  guestName?: string | null;
  boatName?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  totalCharge?: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  CONFIRMED: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", label: "Confirmed" },
  PENDING: { bg: "bg-yellow-100 dark:bg-yellow-900/40", text: "text-yellow-700 dark:text-yellow-300", label: "Pending" },
  CHECKED_IN: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", label: "Checked In" },
  COMPLETED: { bg: "bg-gray-100 dark:bg-gray-900/40", text: "text-gray-700 dark:text-gray-300", label: "Completed" },
  CANCELLED: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "Cancelled" },
};

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.PENDING;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BoatRentalsCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStr = format(currentMonth, "yyyy-MM");

  const { data, isLoading } = useQuery<{ data: BoatRentalReservation[] }>({
    queryKey: ["/api/operations-context/boat-rentals", { month: monthStr }],
    queryFn: async () => {
      const res = await fetch(`/api/operations-context/boat-rentals?month=${monthStr}`);
      if (res.status === 404) return { data: [] };
      if (!res.ok) return { data: [] };
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const reservations = data?.data || [];

  // Build a map of date -> reservations for the month
  const reservationsByDate = useMemo(() => {
    const map = new Map<string, BoatRentalReservation[]>();
    for (const r of reservations) {
      const start = new Date(r.startDate);
      const end = r.endDate ? new Date(r.endDate) : start;
      const days = eachDayOfInterval({ start, end });
      for (const day of days) {
        if (isSameMonth(day, currentMonth)) {
          const key = format(day, "yyyy-MM-dd");
          const existing = map.get(key) || [];
          existing.push(r);
          map.set(key, existing);
        }
      }
    }
    return map;
  }, [reservations, currentMonth]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  // Pad with empty cells for alignment
  const paddedDays: (Date | null)[] = [
    ...Array.from({ length: startDayOfWeek }, () => null),
    ...calendarDays,
  ];

  // Fill remaining cells to complete the last row
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

  const selectedDateReservations = selectedDate
    ? reservationsByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
    : [];

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Reservation Calendar
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
            {Object.entries(STATUS_COLORS).map(([key, style]) => (
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
                    const dayReservations = reservationsByDate.get(dateKey) || [];
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isTodayDate = isToday(day);

                    // Count by status
                    const statusCounts = new Map<string, number>();
                    for (const r of dayReservations) {
                      const count = statusCounts.get(r.status) || 0;
                      statusCounts.set(r.status, count + 1);
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
                          {dayReservations.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                              {dayReservations.length}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {Array.from(statusCounts.entries())
                            .slice(0, 3)
                            .map(([status, count]) => {
                              const style = getStatusStyle(status);
                              return (
                                <div
                                  key={status}
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
              Reservations for {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateReservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Ship className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No reservations for this date.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateReservations.map((r) => {
                  const style = getStatusStyle(r.status);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {r.guestName || "Unknown Guest"}
                        </div>
                        {r.boatName && (
                          <div className="text-xs text-muted-foreground">
                            Boat: {r.boatName}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(r.startDate), "MMM d")} -{" "}
                          {format(new Date(r.endDate), "MMM d, yyyy")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.totalCharge && (
                          <span className="text-sm font-medium">
                            ${Number(r.totalCharge).toLocaleString()}
                          </span>
                        )}
                        <Badge className={`${style.bg} ${style.text} border-0`}>
                          {style.label}
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
