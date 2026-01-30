import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Phone, Mail, CheckSquare, Calendar, MapPin, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { EntityQuickPreviewPopover } from './EntityQuickPreviewPopover';

interface Activity {
  id: string;
  type: string;
  subject?: string;
  description: string;
  scheduledAt?: string;
  status: string;
  completedAt?: string;
  entityType?: string;
  entityId?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
}

interface ActivitiesTableProps {
  activities: Activity[];
  isLoading?: boolean;
  onRowClick?: (activity: Activity) => void;
  showEntityLinks?: boolean;
}

const activityTypeConfig: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  call: { icon: Phone, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Call' },
  email: { icon: Mail, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', label: 'Email' },
  follow_up: { icon: CheckSquare, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', label: 'Follow Up' },
  task: { icon: CheckSquare, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: 'Task' },
  meeting: { icon: Calendar, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Meeting' },
  site_visit: { icon: MapPin, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', label: 'Site Visit' },
  deadline: { icon: AlertCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Deadline' },
  note: { icon: CheckSquare, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: 'Note' },
  sms: { icon: Phone, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'SMS' },
  showing: { icon: MapPin, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', label: 'Showing' },
  document: { icon: CheckSquare, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: 'Document' },
};

export function ActivitiesTable({ 
  activities, 
  isLoading, 
  onRowClick,
  showEntityLinks = true 
}: ActivitiesTableProps) {
  const queryClient = useQueryClient();
  
  const completeMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return apiRequest(`/api/crm/activities/${activityId}/complete`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crmActivities'] });
      queryClient.invalidateQueries({ queryKey: ['crmTimeline'] });
      queryClient.invalidateQueries({ queryKey: ['crmTimelineFocus'] });
    },
  });
  
  const reopenMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return apiRequest(`/api/crm/activities/${activityId}/reopen`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crmActivities'] });
      queryClient.invalidateQueries({ queryKey: ['crmTimeline'] });
      queryClient.invalidateQueries({ queryKey: ['crmTimelineFocus'] });
    },
  });
  
  const handleToggleDone = (activity: Activity, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activity.status === 'completed') {
      reopenMutation.mutate(activity.id);
    } else {
      completeMutation.mutate(activity.id);
    }
  };
  
  const getDueLabel = (scheduledAt: string | undefined, status: string) => {
    if (status === 'completed') {
      return { label: 'Done', className: 'text-green-600 dark:text-green-400' };
    }
    
    if (!scheduledAt) {
      return { label: 'No due date', className: 'text-gray-400' };
    }
    
    const dueDate = new Date(scheduledAt);
    
    if (isPast(dueDate) && !isToday(dueDate)) {
      return { 
        label: `Overdue (${formatDistanceToNow(dueDate, { addSuffix: true })})`, 
        className: 'text-red-600 dark:text-red-400 font-medium' 
      };
    }
    
    if (isToday(dueDate)) {
      return { label: `Today, ${format(dueDate, 'h:mm a')}`, className: 'text-orange-600 dark:text-orange-400 font-medium' };
    }
    
    if (isTomorrow(dueDate)) {
      return { label: `Tomorrow, ${format(dueDate, 'h:mm a')}`, className: 'text-blue-600 dark:text-blue-400' };
    }
    
    return { label: format(dueDate, 'MMM d, h:mm a'), className: 'text-gray-600 dark:text-gray-400' };
  };
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  
  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CheckSquare className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="mt-2">No activities found</p>
      </div>
    );
  }
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Done</TableHead>
          <TableHead className="w-40">Due</TableHead>
          <TableHead>Subject</TableHead>
          {showEntityLinks && <TableHead className="w-40">Entity</TableHead>}
          <TableHead className="w-32">Owner</TableHead>
          <TableHead className="w-28">Type</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activities.map((activity) => {
          const typeConfig = activityTypeConfig[activity.type] || activityTypeConfig.task;
          const TypeIcon = typeConfig.icon;
          const dueInfo = getDueLabel(activity.scheduledAt, activity.status);
          
          return (
            <TableRow 
              key={activity.id}
              className={cn(
                'cursor-pointer hover:bg-muted/50',
                activity.status === 'completed' && 'opacity-60'
              )}
              onClick={() => onRowClick?.(activity)}
            >
              <TableCell>
                <Checkbox
                  checked={activity.status === 'completed'}
                  onClick={(e) => handleToggleDone(activity, e as any)}
                />
              </TableCell>
              <TableCell>
                <span className={cn('text-sm', dueInfo.className)}>
                  {dueInfo.label}
                </span>
              </TableCell>
              <TableCell>
                <span className={cn(
                  'font-medium',
                  activity.status === 'completed' && 'line-through'
                )}>
                  {activity.subject || activity.description?.substring(0, 50)}
                </span>
                {activity.description && activity.subject && (
                  <p className="text-sm text-muted-foreground truncate max-w-md">
                    {activity.description}
                  </p>
                )}
              </TableCell>
              {showEntityLinks && (
                <TableCell>
                  {activity.entityType === 'deal' && activity.entityId && (
                    <EntityQuickPreviewPopover
                      entityType="deal"
                      entityId={activity.entityId}
                    />
                  )}
                  {activity.entityType === 'lead' && activity.entityId && (
                    <EntityQuickPreviewPopover
                      entityType="lead"
                      entityId={activity.entityId}
                    />
                  )}
                  {activity.entityType && !['deal', 'lead'].includes(activity.entityType) && (
                    <span className="text-sm text-muted-foreground capitalize">
                      {activity.entityType}
                    </span>
                  )}
                </TableCell>
              )}
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {activity.owner?.name || 'Unassigned'}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn('gap-1', typeConfig.color)}>
                  <TypeIcon className="h-3 w-3" />
                  {typeConfig.label}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
