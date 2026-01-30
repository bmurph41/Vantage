import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterCounts {
  overdue: number;
  today: number;
  upcoming: number;
  total?: number;
}

interface TeamMember {
  id: string;
  name: string;
}

interface ActivitiesFilterBarProps {
  timeWindow: string;
  onTimeWindowChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  type: string;
  onTypeChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  ownerId?: string;
  onOwnerChange?: (value: string) => void;
  teamMembers?: TeamMember[];
  counts?: FilterCounts;
  onAddClick?: () => void;
}

const timeWindows = [
  { value: 'all', label: 'All Time' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_week', label: 'Next Week' },
];

const activityTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'task', label: 'Task' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'deadline', label: 'Deadline' },
];

export function ActivitiesFilterBar({
  timeWindow,
  onTimeWindowChange,
  status,
  onStatusChange,
  type,
  onTypeChange,
  search,
  onSearchChange,
  ownerId,
  onOwnerChange,
  teamMembers,
  counts,
  onAddClick,
}: ActivitiesFilterBarProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {timeWindows.slice(0, 5).map((tw) => {
          const count = tw.value === 'overdue' ? counts?.overdue :
                        tw.value === 'today' ? counts?.today :
                        tw.value === 'tomorrow' || tw.value === 'this_week' || tw.value === 'next_week' ? counts?.upcoming : null;
          
          return (
            <Button
              key={tw.value}
              variant={timeWindow === tw.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTimeWindowChange(tw.value)}
              className={cn(
                tw.value === 'overdue' && timeWindow !== tw.value && (counts?.overdue || 0) > 0 && 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400'
              )}
            >
              {tw.label}
              {count !== null && count > 0 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    'ml-2 h-5 px-1.5',
                    tw.value === 'overdue' && 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  )}
                >
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
      
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={type} onValueChange={onTypeChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {activityTypes.map((at) => (
              <SelectItem key={at.value} value={at.value}>
                {at.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {onOwnerChange && teamMembers && teamMembers.length > 0 && (
          <Select value={ownerId || 'all'} onValueChange={onOwnerChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              <SelectItem value="me">Assigned to Me</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {onAddClick && (
          <Button onClick={onAddClick} className="ml-auto">
            <Plus className="h-4 w-4 mr-2" />
            Activity
          </Button>
        )}
      </div>
    </div>
  );
}
