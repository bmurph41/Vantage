import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Phone, Mail, MessageSquare, Calendar, FileText, 
  Clock, ArrowRight, PhoneCall, PhoneIncoming,
  PhoneOutgoing, Plus, Filter
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { Activity } from "@shared/schema";

interface CommunicationTimelineProps {
  entityType: 'contact' | 'deal' | 'property' | 'company';
  entityId: string;
  canAddActivity?: boolean;
}

type ExtendedActivity = Activity & {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
};

export default function CommunicationTimeline({ 
  entityType, 
  entityId, 
  canAddActivity = false 
}: CommunicationTimelineProps) {
  const [filter, setFilter] = useState<string>('all');

  const { data: activities = [], isLoading } = useQuery<ExtendedActivity[]>({
    queryKey: [`/api/${entityType}/${entityId}/activities`],
  });

  const getActivityIcon = (activity: ExtendedActivity) => {
    switch (activity.type) {
      case 'call':
        if (activity.direction === 'incoming') return PhoneIncoming;
        if (activity.direction === 'outgoing') return PhoneOutgoing;
        return Phone;
      case 'email':
        return Mail;
      case 'sms':
        return MessageSquare;
      case 'meeting':
      case 'showing':
        return Calendar;
      case 'note':
      case 'document':
        return FileText;
      default:
        return FileText;
    }
  };

  const getActivityColor = (activity: ExtendedActivity) => {
    switch (activity.type) {
      case 'call':
        return activity.direction === 'incoming' 
          ? 'bg-blue-100 text-blue-600' 
          : 'bg-green-100 text-green-600';
      case 'email':
        return 'bg-purple-100 text-purple-600';
      case 'sms':
        return 'bg-orange-100 text-orange-600';
      case 'meeting':
      case 'showing':
        return 'bg-indigo-100 text-indigo-600';
      case 'note':
        return 'bg-gray-100 text-gray-600';
      case 'document':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return null;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getActivitySummary = (activity: ExtendedActivity) => {
    const metadata = activity.metadata as any;
    
    switch (activity.type) {
      case 'call':
        return `${activity.direction === 'incoming' ? 'Received' : 'Made'} call${metadata?.phoneNumber ? ` to ${metadata.phoneNumber}` : ''}`;
      case 'email':
        return activity.subject || 'Email sent';
      case 'sms':
        return `Text message${metadata?.phoneNumber ? ` to ${metadata.phoneNumber}` : ''}`;
      case 'meeting':
        return `Meeting${activity.scheduledAt ? ` scheduled for ${format(new Date(activity.scheduledAt), 'MMM d, h:mm a')}` : ''}`;
      case 'showing':
        return `Property showing${activity.scheduledAt ? ` scheduled for ${format(new Date(activity.scheduledAt), 'MMM d, h:mm a')}` : ''}`;
      case 'document':
        return `Document shared: ${metadata?.documentName || 'Unknown document'}`;
      default:
        return activity.subject || activity.description;
    }
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.type === filter;
  });

  const activityTypes = ['all', 'call', 'email', 'sms', 'meeting', 'showing', 'note', 'document'];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Communication Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Communication Timeline
          </CardTitle>
          {canAddActivity && (
            <Button size="sm" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Log Activity
            </Button>
          )}
        </div>
        
        {/* Filter buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          {activityTypes.map((type) => (
            <Button
              key={type}
              variant={filter === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(type)}
              className="capitalize"
            >
              {type === 'sms' ? 'SMS' : type}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        {filteredActivities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {filter === 'all' 
              ? 'No communication history yet' 
              : `No ${filter} activities found`}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredActivities.map((activity, index) => {
              const Icon = getActivityIcon(activity);
              const iconColor = getActivityColor(activity);
              
              return (
                <div key={activity.id} className="flex items-start gap-4 relative">
                  {/* Timeline line */}
                  {index < filteredActivities.length - 1 && (
                    <div className="absolute left-5 top-12 bottom-0 w-px bg-gray-200"></div>
                  )}
                  
                  {/* Activity icon */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  {/* Activity content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900">
                            {getActivitySummary(activity)}
                          </p>
                          {activity.duration && (
                            <Badge variant="secondary" className="text-xs">
                              {formatDuration(activity.duration)}
                            </Badge>
                          )}
                          {activity.outcome && (
                            <Badge 
                              variant={activity.outcome === 'successful' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {activity.outcome}
                            </Badge>
                          )}
                        </div>
                        
                        {activity.description && (
                          <p className="text-sm text-gray-600 mb-2">
                            {activity.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={activity.user.avatar} />
                              <AvatarFallback className="text-xs">
                                {activity.user.firstName[0]}{activity.user.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {activity.user.firstName} {activity.user.lastName}
                            </span>
                          </div>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </span>
                          {activity.scheduledAt && (
                            <>
                              <span>•</span>
                              <span>
                                Scheduled: {format(new Date(activity.scheduledAt), 'MMM d, h:mm a')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right text-xs text-gray-500">
                        {format(new Date(activity.createdAt), 'MMM d, h:mm a')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
