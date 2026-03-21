import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Search,
  Filter,
  Briefcase,
  Users,
  DollarSign,
  Shield,
  Settings,
  Clock,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Archive,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string;
  type: "deal" | "crm" | "financial" | "operations" | "security" | "system";
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type NotificationType = Notification["type"];

const FILTER_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "deal", label: "Deals" },
  { value: "crm", label: "CRM" },
  { value: "financial", label: "Financial" },
  { value: "operations", label: "Operations" },
  { value: "system", label: "System" },
];

function getTypeConfig(type: NotificationType) {
  const map: Record<
    NotificationType,
    { icon: React.ReactNode; accent: string; bg: string; label: string }
  > = {
    deal: {
      icon: <Briefcase className="h-4 w-4" />,
      accent: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
      label: "Deal Update",
    },
    crm: {
      icon: <Users className="h-4 w-4" />,
      accent: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
      label: "CRM Activity",
    },
    financial: {
      icon: <DollarSign className="h-4 w-4" />,
      accent: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950",
      label: "Financial Alert",
    },
    operations: {
      icon: <Settings className="h-4 w-4" />,
      accent: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950",
      label: "Operations",
    },
    security: {
      icon: <Shield className="h-4 w-4" />,
      accent: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950",
      label: "Security",
    },
    system: {
      icon: <Bell className="h-4 w-4" />,
      accent: "text-gray-600",
      bg: "bg-gray-50 dark:bg-gray-950",
      label: "System",
    },
  };
  return map[type] ?? map.system;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationsCenterPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Preferences toggles (local state - would persist via API in production)
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // ---- Data fetching ----

  const { data: notificationsData, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications", { filter, page }],
    placeholderData: { notifications: [], total: 0, hasMore: false },
  });

  const notifications: Notification[] = notificationsData?.notifications ?? [];
  const hasMore = notificationsData?.hasMore ?? false;

  // ---- Mutations ----

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark notification as read.", variant: "destructive" });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Done", description: "All notifications marked as read." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark all as read.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("DELETE", `/api/notifications/${notificationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Deleted", description: "Notification removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete notification.", variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("PATCH", `/api/notifications/${notificationId}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Archived", description: "Notification archived." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to archive notification.", variant: "destructive" });
    },
  });

  // ---- Derived data ----

  const filtered = notifications.filter((n) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filter === "unread") return !n.read;
    if (filter !== "all") return n.type === filter;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const thisWeekCount = notifications.filter((n) => {
    const diff = Date.now() - new Date(n.createdAt).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const toggleExpand = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    [],
  );

  // ---- Loading skeleton ----

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Bell className="h-7 w-7 text-muted-foreground animate-pulse" />
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ---- Render ----

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-7 w-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-1">
              {unreadCount}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending || unreadCount === 0}
        >
          <CheckCheck className="h-4 w-4 mr-2" />
          Mark all as read
        </Button>
      </div>

      {/* ---------- Filter bar + search ---------- */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center mb-6">
        <Tabs value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }} className="w-full md:w-auto">
          <TabsList className="flex flex-wrap h-auto">
            {FILTER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs md:text-sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ---------- Main layout: list + sidebar ---------- */}
      <div className="flex gap-6">
        {/* ---- Notification list ---- */}
        <div className="flex-1 min-w-0 space-y-2">
          {filtered.length === 0 ? (
            <Card className="py-16">
              <CardContent className="flex flex-col items-center justify-center text-center">
                {notifications.length === 0 ? (
                  <>
                    <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-1">You're all caught up!</h3>
                    <p className="text-muted-foreground text-sm">
                      No notifications to display right now.
                    </p>
                  </>
                ) : (
                  <>
                    <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-1">No notifications match your filter</h3>
                    <p className="text-muted-foreground text-sm">
                      Try adjusting your search or filter criteria.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setFilter("all");
                        setSearchQuery("");
                      }}
                    >
                      Clear filters
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-280px)]">
              <div className="space-y-2 pr-2">
                {filtered.map((notification) => {
                  const config = getTypeConfig(notification.type);
                  const isExpanded = expandedId === notification.id;

                  return (
                    <Card
                      key={notification.id}
                      className={`transition-colors cursor-pointer hover:bg-accent/50 ${
                        !notification.read ? "border-l-4 border-l-primary" : ""
                      }`}
                      onClick={() => toggleExpand(notification.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Type icon */}
                          <div
                            className={`flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-full ${config.bg} ${config.accent}`}
                          >
                            {config.icon}
                          </div>

                          {/* Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-sm truncate">
                                {notification.title}
                              </span>
                              {!notification.read && (
                                <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {notification.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {config.label}
                              </Badge>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {relativeTime(notification.createdAt)}
                              </span>
                            </div>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="mt-3 pt-3 border-t space-y-3">
                                <p className="text-sm text-foreground">{notification.description}</p>
                                {notification.metadata &&
                                  Object.keys(notification.metadata).length > 0 && (
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      {Object.entries(notification.metadata).map(([key, value]) => (
                                        <div key={key}>
                                          <span className="font-medium capitalize">
                                            {key.replace(/([A-Z])/g, " $1")}:
                                          </span>{" "}
                                          {String(value)}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                <div className="flex items-center gap-2">
                                  {!notification.read && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        markReadMutation.mutate(notification.id);
                                      }}
                                      disabled={markReadMutation.isPending}
                                    >
                                      <Check className="h-3.5 w-3.5 mr-1" />
                                      Mark read
                                    </Button>
                                  )}
                                  {notification.actionUrl && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.location.href = notification.actionUrl!;
                                      }}
                                    >
                                      View details
                                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Actions dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!notification.read && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markReadMutation.mutate(notification.id);
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Mark as read
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  archiveMutation.mutate(notification.id);
                                }}
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteMutation.mutate(notification.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {/* ---- Right sidebar (desktop only) ---- */}
        <aside className="hidden lg:flex flex-col gap-4 w-72 flex-shrink-0">
          {/* Quick preferences */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Quick Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center justify-between text-sm">
                <span>Email notifications</span>
                <button
                  onClick={() => setEmailEnabled(!emailEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    emailEnabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      emailEnabled ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between text-sm">
                <span>Push notifications</span>
                <button
                  onClick={() => setPushEnabled(!pushEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    pushEnabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      pushEnabled ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between text-sm">
                <span>Sound alerts</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    soundEnabled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      soundEnabled ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Notification Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Unread</span>
                <Badge variant={unreadCount > 0 ? "destructive" : "secondary"}>
                  {unreadCount}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">This week</span>
                <Badge variant="secondary">{thisWeekCount}</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <Badge variant="outline">{notificationsData?.total ?? 0}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Link to full settings */}
          <Button variant="outline" className="w-full" asChild>
            <a href="/user/settings">
              <Settings className="h-4 w-4 mr-2" />
              Notification Settings
            </a>
          </Button>
        </aside>
      </div>
    </div>
  );
}
