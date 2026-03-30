import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, ExternalLink, AlertTriangle, CheckCircle2, Diamond, Flag } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export interface TimelineEvent {
  id: string;
  dealId: string;
  dealName: string;
  eventType: "key_date" | "custom_deadline" | "task" | "stage_change" | "activity" | "milestone" | "red_flag" | "playbook";
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  color: string;
  metadata?: Record<string, any>;
}

interface GanttPopoverProps {
  event: TimelineEvent;
  children: React.ReactNode;
  showDealLink?: boolean;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  key_date: "Key Date",
  custom_deadline: "Custom Deadline",
  task: "Task",
  stage_change: "Stage",
  activity: "Activity",
  milestone: "Approval",
  red_flag: "Red Flag",
  playbook: "Playbook",
};

const EVENT_TYPE_ICONS: Record<string, any> = {
  key_date: Diamond,
  custom_deadline: Calendar,
  task: CheckCircle2,
  stage_change: Flag,
  activity: Calendar,
  milestone: CheckCircle2,
  red_flag: AlertTriangle,
  playbook: CheckCircle2,
};

export default function GanttPopover({ event, children, showDealLink = true }: GanttPopoverProps) {
  const Icon = EVENT_TYPE_ICONS[event.eventType] || Calendar;
  const typeLabel = EVENT_TYPE_LABELS[event.eventType] || event.eventType;

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const isRange = startDate.getTime() !== endDate.getTime();
  const isPast = endDate < new Date();
  const isOverdue = event.eventType === 'key_date' && isPast && event.status === 'upcoming';

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start" side="top">
        <div className="space-y-2.5">
          {/* Header */}
          <div className="flex items-start gap-2">
            <div
              className="rounded-md p-1.5 shrink-0"
              style={{ backgroundColor: `${event.color}20` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: event.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{event.title}</p>
              <Badge variant="outline" className="text-[10px] mt-1 h-4">{typeLabel}</Badge>
            </div>
          </div>

          {/* Dates */}
          <div className="text-xs text-gray-500 space-y-0.5">
            {isRange ? (
              <>
                <p>Start: {format(startDate, "MMM d, yyyy")}</p>
                <p>End: {format(endDate, "MMM d, yyyy")}</p>
              </>
            ) : (
              <p>Date: {format(startDate, "MMM d, yyyy")}</p>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge
              className="text-[10px]"
              variant={isOverdue ? "destructive" : event.status === 'completed' || event.status === 'approved' ? "default" : "outline"}
            >
              {isOverdue ? "OVERDUE" : event.status}
            </Badge>
            {event.metadata?.priority && (
              <Badge variant="outline" className="text-[10px] capitalize">{event.metadata.priority}</Badge>
            )}
            {event.metadata?.severity && (
              <Badge variant="destructive" className="text-[10px] capitalize">{event.metadata.severity}</Badge>
            )}
          </div>

          {/* Deal link */}
          {showDealLink && (
            <Link href={`/deals/${event.dealId}`}>
              <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5 mt-1">
                <ExternalLink className="h-3 w-3" />
                Open {event.dealName}
              </Button>
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
