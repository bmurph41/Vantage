import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertCircle, Calendar, CheckCircle2, FileText, Mail, 
  MessageSquare, Phone, Pin, Plus, Upload, Clock 
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { CrmActionComposerModal } from './CrmActionComposerModal';

interface FocusHistoryTimelineProps {
  entityType: 'deal' | 'lead' | 'contact' | 'company' | 'property' | 'project';
  entityId: string;
  entityName: string;
}

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'notes', label: 'Notes' },
  { value: 'activities', label: 'Activities' },
  { value: 'emails', label: 'Emails' },
  { value: 'files', label: 'Files' },
  { value: 'changelog', label: 'Changes' },
];

const eventTypeIcons: Record<string, React.ComponentType<any>> = {
  activity_created: Calendar,
  activity_completed: CheckCircle2,
  activity_reopened: Clock,
  note_created: FileText,
  note_updated: FileText,
  file_uploaded: Upload,
  stage_changed: AlertCircle,
  email_logged: Mail,
  call_logged: Phone,
  comment_created: MessageSquare,
  deal_created: Calendar,
  deal_updated: Calendar,
  contact_linked: Calendar,
  company_linked: Calendar,
};

const eventTypeColors: Record<string, string> = {
  activity_created: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  activity_completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  activity_reopened: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  note_created: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  note_updated: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  file_uploaded: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  stage_changed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  email_logged: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  call_logged: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
};

export function FocusHistoryTimeline({
  entityType,
  entityId,
  entityName,
}: FocusHistoryTimelineProps) {
  const [filter, setFilter] = useState('all');
  const [showComposer, setShowComposer] = useState(false);
  
  const { data: focusData, isLoading: focusLoading } = useQuery({
    queryKey: ['crmTimelineFocus', entityType, entityId],
    queryFn: () => apiRequest(`/api/crm/timeline/focus?entityType=${entityType}&entityId=${entityId}`),
    staleTime: 30000,
  });
  
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['crmTimeline', entityType, entityId, filter],
    queryFn: () => apiRequest(`/api/crm/timeline?entityType=${entityType}&entityId=${entityId}&filter=${filter}`),
    staleTime: 30000,
  });
  
  const hasOverdue = focusData?.overdue?.length > 0;
  const hasToday = focusData?.today?.length > 0;
  const hasUpcoming = focusData?.upcoming?.length > 0;
  const hasPinnedNotes = focusData?.pinnedNotes?.length > 0;
  const hasFocusItems = hasOverdue || hasToday || hasUpcoming || hasPinnedNotes;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Activity & Timeline</h3>
        <Button size="sm" onClick={() => setShowComposer(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      
      {focusLoading ? (
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      ) : hasFocusItems && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Focus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasOverdue && (
              <div className="space-y-2">
                {focusData.overdue.map((activity: any) => (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-3 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  >
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.subject || activity.description?.substring(0, 50)}</p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Overdue: {activity.scheduledAt && formatDistanceToNow(new Date(activity.scheduledAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {hasToday && (
              <div className="space-y-2">
                {focusData.today.map((activity: any) => (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-3 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                  >
                    <Calendar className="h-4 w-4 text-orange-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.subject || activity.description?.substring(0, 50)}</p>
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        Today {activity.scheduledAt && format(new Date(activity.scheduledAt), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {hasUpcoming && (
              <div className="space-y-2">
                {focusData.upcoming.map((activity: any) => (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                  >
                    <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.subject || activity.description?.substring(0, 50)}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {activity.scheduledAt && format(new Date(activity.scheduledAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {hasPinnedNotes && (
              <div className="space-y-2">
                {focusData.pinnedNotes.map((note: any) => (
                  <div 
                    key={note.id} 
                    className="flex items-start gap-3 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                  >
                    <Pin className="h-4 w-4 text-purple-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{note.content.substring(0, 100)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">History</CardTitle>
            <div className="flex gap-1">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={filter === option.value ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : historyData?.items?.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {historyData.items.map((event: any) => {
                  const Icon = eventTypeIcons[event.eventType] || Calendar;
                  const colorClass = eventTypeColors[event.eventType] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
                  
                  return (
                    <div key={event.id} className="relative pl-10">
                      <div className={cn(
                        'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center',
                        colorClass
                      )}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="bg-card border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{event.title}</p>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(event.occurredAt), { addSuffix: true })}
                          </span>
                        </div>
                        {event.actor && (
                          <p className="text-xs text-muted-foreground mt-2">
                            by {event.actor.name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm">No timeline events yet</p>
              <Button 
                variant="link" 
                size="sm" 
                className="mt-1"
                onClick={() => setShowComposer(true)}
              >
                Add first activity or note
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      <CrmActionComposerModal
        open={showComposer}
        onOpenChange={setShowComposer}
        context={{
          entityType,
          entityId,
          entityName,
        }}
        defaultTab="activity"
      />
    </div>
  );
}
