import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Phone, Mail, Calendar, StickyNote, CheckSquare, Clock,
  MapPin, FileText, MessageSquare, Eye, Share2, Activity
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type ActivityItem = {
  id: string;
  type: string;
  subject: string | null;
  description: string;
  status: string | null;
  entityType: string;
  entityId: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

type ActivitiesResponse = {
  items: ActivityItem[];
  counts: { overdue: number; today: number; upcoming: number };
};

const activityTypeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  call: { icon: Phone, color: "text-blue-600", bg: "bg-blue-50" },
  email: { icon: Mail, color: "text-purple-600", bg: "bg-purple-50" },
  meeting: { icon: Calendar, color: "text-green-600", bg: "bg-green-50" },
  note: { icon: StickyNote, color: "text-yellow-600", bg: "bg-yellow-50" },
  task: { icon: CheckSquare, color: "text-indigo-600", bg: "bg-indigo-50" },
  follow_up: { icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
  site_visit: { icon: MapPin, color: "text-teal-600", bg: "bg-teal-50" },
  document: { icon: FileText, color: "text-gray-600", bg: "bg-gray-50" },
  sms: { icon: MessageSquare, color: "text-pink-600", bg: "bg-pink-50" },
  showing: { icon: Eye, color: "text-cyan-600", bg: "bg-cyan-50" },
  social_media: { icon: Share2, color: "text-rose-600", bg: "bg-rose-50" },
};

function getActivityConfig(type: string) {
  return activityTypeConfig[type] || { icon: Activity, color: "text-gray-600", bg: "bg-gray-50" };
}

function StatsCards({ counts, isLoading }: { counts: ActivitiesResponse["counts"] | undefined; isLoading: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <Card className="bg-white border shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-gray-500">Overdue</p>
          {isLoading ? (
            <Skeleton className="h-7 w-12 mt-1" />
          ) : (
            <p className={`text-xl font-bold mt-0.5 ${(counts?.overdue || 0) > 0 ? "text-red-600" : "text-gray-900"}`}>
              {counts?.overdue || 0}
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="bg-white border shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-gray-500">Due Today</p>
          {isLoading ? (
            <Skeleton className="h-7 w-12 mt-1" />
          ) : (
            <p className="text-xl font-bold text-blue-600 mt-0.5">{counts?.today || 0}</p>
          )}
        </CardContent>
      </Card>
      <Card className="bg-white border shadow-sm">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-gray-500">Upcoming</p>
          {isLoading ? (
            <Skeleton className="h-7 w-12 mt-1" />
          ) : (
            <p className="text-xl font-bold text-green-600 mt-0.5">{counts?.upcoming || 0}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ActivityView() {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<ActivitiesResponse>({
    queryKey: ["/api/crm/activities", { status: "all", limit: 50 }],
    queryFn: async () => {
      const res = await fetch("/api/crm/activities?status=all&limit=50");
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
  });

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (typeFilter === "all") return data.items;
    return data.items.filter((a) => a.type === typeFilter);
  }, [data, typeFilter]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white border shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-7 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6">
      <StatsCards counts={data?.counts} isLoading={isLoading} />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="call">Calls</SelectItem>
            <SelectItem value="email">Emails</SelectItem>
            <SelectItem value="meeting">Meetings</SelectItem>
            <SelectItem value="note">Notes</SelectItem>
            <SelectItem value="task">Tasks</SelectItem>
            <SelectItem value="follow_up">Follow-ups</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No activities found</p>
          <p className="text-gray-400 text-xs mt-1">Activities will appear here as they are logged</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((activity) => {
            const config = getActivityConfig(activity.type);
            const Icon = config.icon;
            const timeStr = activity.scheduledAt || activity.createdAt;

            return (
              <Card key={activity.id} className="bg-white border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {activity.subject || activity.description}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                          {activity.type.replace(/_/g, " ")}
                        </Badge>
                        {activity.status && activity.status !== "completed" && (
                          <Badge
                            variant={activity.status === "scheduled" ? "secondary" : "default"}
                            className="text-xs flex-shrink-0"
                          >
                            {activity.status}
                          </Badge>
                        )}
                      </div>
                      {activity.subject && activity.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">{activity.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="capitalize">{activity.entityType}</span>
                        {activity.owner?.name && <span>by {activity.owner.name}</span>}
                        <span>
                          {formatDistanceToNow(new Date(timeStr), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
