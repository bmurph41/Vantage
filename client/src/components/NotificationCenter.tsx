import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Bell, CheckCheck, Briefcase, AlertTriangle, Users, Clock, MessageSquare, Shield } from "lucide-react";

const typeIcons: Record<string, any> = {
  deal_update: Briefcase,
  assignment: Users,
  approval: Shield,
  deadline: Clock,
  red_flag: AlertTriangle,
  mention: MessageSquare,
  thread_update: MessageSquare,
  system: Bell,
};

export default function NotificationCenter() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery<any>({
    queryKey: ["/api/onboarding/notifications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/onboarding/notifications?limit=30");
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30s
  });

  const markRead = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/onboarding/notifications/mark-read", payload);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/onboarding/notifications"] }),
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={() => markRead.mutate({ markAll: true })}>
                <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-1 max-h-[calc(100vh-120px)] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((n: any) => {
              const Icon = typeIcons[n.type] || Bell;
              return (
                <div
                  key={n.id}
                  className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-colors ${n.isRead ? "opacity-60" : "bg-blue-50/50 hover:bg-blue-50"}`}
                  onClick={() => {
                    if (!n.isRead) markRead.mutate({ notificationIds: [n.id] });
                  }}
                >
                  <div className="mt-0.5">
                    <Icon className={`h-4 w-4 ${n.type === "red_flag" ? "text-red-500" : n.type === "deadline" ? "text-orange-500" : "text-blue-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
