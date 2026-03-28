import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, BellDot, Check, CheckCheck, X, AlertTriangle, Zap, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface Notification {
  id: string;
  type: 'automation' | 'deal_rot' | 'task_due' | 'stage_alert' | 'system';
  title: string;
  body?: string;
  dealId?: string;
  readAt?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

function NotificationIcon({ type }: { type: string }) {
  switch (type) {
    case 'deal_rot': return <span className="text-red-500">🔥</span>;
    case 'automation': return <Zap className="h-3.5 w-3.5 text-purple-500" />;
    case 'task_due': return <Clock className="h-3.5 w-3.5 text-orange-500" />;
    case 'stage_alert': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    default: return <Info className="h-3.5 w-3.5 text-blue-500" />;
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000, // poll every 30s
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count || 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  // Scan for rot on mount
  useEffect(() => {
    apiRequest("POST", "/api/notifications/scan-rot", { threshold: 30 }).catch(() => {});
  }, []);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative h-8 w-8 p-0"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <BellDot className="h-4 w-4 text-gray-600" />
        ) : (
          <Bell className="h-4 w-4 text-gray-500" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge className="bg-red-500 text-white text-[9px] h-4 px-1">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                    onClick={() => markAllReadMutation.mutate()}
                  >
                    <CheckCheck className="h-3 w-3" />
                    All read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="ml-2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <ScrollArea className="max-h-[380px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Bell className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">You're all caught up</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 transition-colors cursor-default ${
                        !n.readAt ? "bg-blue-50/60 hover:bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                        <NotificationIcon type={n.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-medium leading-snug ${!n.readAt ? "text-gray-900" : "text-gray-600"}`}>
                            {n.title}
                          </p>
                          {!n.readAt && (
                            <button
                              className="flex-shrink-0 text-gray-300 hover:text-blue-500"
                              onClick={() => markReadMutation.mutate(n.id)}
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {n.body && (
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </span>
                          {n.dealId && (
                            <Link
                              href={`/crm/deals/${n.dealId}`}
                              onClick={() => setIsOpen(false)}
                              className="text-[10px] text-blue-500 hover:text-blue-600"
                            >
                              View deal →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="border-t border-gray-100 px-4 py-2">
              <Link
                href="/crm/activity"
                onClick={() => setIsOpen(false)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                View all activity →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
