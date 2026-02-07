import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, MessageSquare, Linkedin, Video, Activity, PhoneOff, PhoneMissed, ThumbsDown } from "lucide-react";
import { format } from "date-fns";

interface ProspectingActivity {
  id: string;
  activityType: string;
  outcome: string;
  dayOfWeek: string;
  activityDate: string;
  duration?: number | null;
  notes?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  propertyId?: string | null;
  dealId?: string | null;
}

interface ProspectingActivitiesSectionProps {
  entityType: 'contact' | 'company' | 'property';
  entityId: string | number;
}

const activityIcons: Record<string, any> = {
  call: Phone,
  voicemail: PhoneOff,
  no_answer: PhoneMissed,
  not_interested: ThumbsDown,
  text: MessageSquare,
  linkedin: Linkedin,
  email: Mail,
  meeting: Video,
};

const outcomeColors: Record<string, string> = {
  connected: "bg-green-100 text-green-800",
  left_voicemail: "bg-yellow-100 text-yellow-800",
  no_answer: "bg-gray-100 text-gray-800",
  not_interested: "bg-red-100 text-red-800",
  callback_requested: "bg-blue-100 text-blue-800",
  call_back: "bg-blue-100 text-blue-800",
  meeting_scheduled: "bg-purple-100 text-purple-800",
  sent: "bg-indigo-100 text-indigo-800",
  opened: "bg-cyan-100 text-cyan-800",
  replied: "bg-emerald-100 text-emerald-800",
};

export function ProspectingActivitiesSection({ entityType, entityId }: ProspectingActivitiesSectionProps) {
  const filterParam = entityType === 'contact' ? 'contactId' 
    : entityType === 'company' ? 'companyId' 
    : 'propertyId';

  const { data: activities = [], isLoading } = useQuery<ProspectingActivity[]>({
    queryKey: ['/api/prospecting/activities', filterParam, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/prospecting/activities?${filterParam}=${entityId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!entityId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No prospecting activities</p>
          <p className="text-sm mt-1">Prospecting activities linked to this {entityType} will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => {
        const IconComponent = activityIcons[activity.activityType] || Activity;
        const outcomeClass = outcomeColors[activity.outcome] || "bg-gray-100 text-gray-800";
        return (
          <Card key={activity.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-gray-100 flex-shrink-0">
                  <IconComponent className="w-4 h-4 text-gray-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium capitalize">{activity.activityType.replace('_', ' ')}</p>
                      <Badge variant="outline" className={outcomeClass}>
                        {activity.outcome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(activity.activityDate), "MMM dd, yyyy")}
                    </span>
                  </div>
                  {activity.notes && (
                    <p className="text-sm text-muted-foreground mt-1">{activity.notes}</p>
                  )}
                  {activity.duration && (
                    <p className="text-xs text-muted-foreground mt-1">{activity.duration} min</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
