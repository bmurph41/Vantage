/**
 * ReminderCenter
 *
 * Bell icon popover that shows pending reminders for tasks and activities.
 * Groups items by Overdue, Today, and Upcoming.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Clock, Loader2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, isToday, isPast, isTomorrow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────

interface ReminderItem {
  id: string;
  title: string;
  dueDate: string;
  sourceType: "task" | "activity";
  priority?: string;
  entityName?: string;
}

interface PendingRemindersResponse {
  tasks: ReminderItem[];
  activities: ReminderItem[];
}

type ReminderGroup = "overdue" | "today" | "upcoming";

// ─── Helpers ──────────────────────────────────────────────────────

function classifyReminder(dueDate: string): ReminderGroup {
  const d = new Date(dueDate);
  if (isPast(d) && !isToday(d)) return "overdue";
  if (isToday(d)) return "today";
  return "upcoming";
}

function groupLabel(group: ReminderGroup): string {
  return group === "overdue" ? "Overdue" : group === "today" ? "Today" : "Upcoming";
}

function groupColor(group: ReminderGroup): string {
  return group === "overdue"
    ? "text-red-600"
    : group === "today"
      ? "text-amber-600"
      : "text-muted-foreground";
}

// ─── Component ────────────────────────────────────────────────────

export function ReminderCenter() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<PendingRemindersResponse>({
    queryKey: ["crm", "reminders", "pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/reminders/pending");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ sourceType, id }: { sourceType: string; id: string }) => {
      await apiRequest("POST", `/api/crm/reminders/${sourceType}/${id}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "reminders"] });
      toast({ title: "Reminder dismissed" });
    },
    onError: () => {
      toast({ title: "Failed to dismiss reminder", variant: "destructive" });
    },
  });

  const allItems: ReminderItem[] = [
    ...(data?.tasks ?? []),
    ...(data?.activities ?? []),
  ].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const grouped = allItems.reduce<Record<ReminderGroup, ReminderItem[]>>(
    (acc, item) => {
      const group = classifyReminder(item.dueDate);
      acc[group].push(item);
      return acc;
    },
    { overdue: [], today: [], upcoming: [] },
  );

  const totalCount = allItems.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs flex items-center justify-center"
            >
              {totalCount > 99 ? "99+" : totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Reminders</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalCount === 0 ? "All caught up" : `${totalCount} pending`}
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && totalCount === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No pending reminders
            </div>
          )}

          {(["overdue", "today", "upcoming"] as ReminderGroup[]).map((group) => {
            const items = grouped[group];
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className={cn("px-4 py-2 text-xs font-medium uppercase tracking-wider bg-muted/50", groupColor(group))}>
                  {groupLabel(group)} ({items.length})
                </div>
                {items.map((item) => (
                  <div
                    key={`${item.sourceType}-${item.id}`}
                    className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <Clock className={cn("h-4 w-4 mt-0.5 shrink-0", groupColor(group))} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.dueDate), "MMM d, h:mm a")}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {item.sourceType}
                        </Badge>
                      </div>
                      {item.entityName && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {item.entityName}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      disabled={dismissMutation.isPending}
                      onClick={() => dismissMutation.mutate({ sourceType: item.sourceType, id: item.id })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
