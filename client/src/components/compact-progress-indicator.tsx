import { cn } from "@/lib/utils";
import { daysBetween, tzNow, getProjectBounds, percentOfRange, setDeadlineTo5PM } from "@/lib/date-utils";
import { startOfDay, isAfter, isBefore, parseISO, addDays, format } from "date-fns";
import type { Task, Project, ProjectSettings } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Clock } from "lucide-react";

interface CompactProgressIndicatorProps {
  task: Task;
  project: Project;
  settings?: ProjectSettings | null;
  className?: string;
  onTaskClick?: (taskId: string) => void;
}

export function CompactProgressIndicator({ 
  task, 
  project, 
  settings, 
  className,
  onTaskClick 
}: CompactProgressIndicatorProps) {
  const today = startOfDay(tzNow('America/New_York'));
  
  // Get fixed project timeline bounds (PSA Signed Date to Closing Date)
  const { start: timelineStart, end: timelineEnd } = getProjectBounds(project);
  
  // Calculate individual task start date
  const taskStart = startOfDay(task.startDate 
    ? parseISO(task.startDate) 
    : project.psaSignedDate 
      ? addDays(parseISO(project.psaSignedDate), task.startOffsetDays || 0)
      : today);
  
  // Calculate individual task deadline using same logic as reports
  const calculateTaskDeadline = (task: Task): Date => {
    // First priority: Use direct deadline field if set
    if (task.deadline) {
      return parseISO(task.deadline);
    } else if (task.deadlineType === 'dd_expiration' && project.ddExpirationDate) {
      return parseISO(project.ddExpirationDate);
    } else if (task.deadlineType === 'days_after_psa' && task.deadlineDays && project.psaSignedDate) {
      const psaDate = parseISO(project.psaSignedDate);
      return addDays(psaDate, task.deadlineDays);
    } else {
      // Enhanced fallback calculation for tasks without specific deadline types
      const startDate = task.startDate 
        ? parseISO(task.startDate) 
        : project.psaSignedDate 
          ? addDays(parseISO(project.psaSignedDate), task.startOffsetDays || 0)
          : today;
      
      // Use smart defaults based on priority for task duration
      const defaultDuration = task.priority === 'high' ? 5 : task.priority === 'med' ? 10 : 21;
      
      return addDays(startDate, defaultDuration);
    }
  };
  
  const taskDeadline = setDeadlineTo5PM(calculateTaskDeadline(task));
  
  // Calculate task status variables first - these are used throughout the component
  const isCompleted = task.status === 'completed';
  const isOverdue = !isCompleted && isAfter(today, taskDeadline);
  const isNotStarted = isBefore(today, taskStart);
  
  // ALL BARS START FROM PSA: Progress bars span from PSA start to task deadline
  const psaStartPosition = percentOfRange(timelineStart, timelineStart, timelineEnd); // PSA start is 0%
  const taskDeadlinePosition = percentOfRange(taskDeadline, timelineStart, timelineEnd);
  const todayPosition = percentOfRange(today, timelineStart, timelineEnd);
  
  // Progress bar spans from PSA start to task deadline (full duration)
  const barStartPosition = psaStartPosition; // Always start at PSA
  const barEndPosition = taskDeadlinePosition;
  const barWidth = Math.max(1, barEndPosition - barStartPosition);
  
  // Calculate elapsed time within the task timeline
  let elapsedWidth: number;
  let remainingWidth: number;
  
  if (isCompleted) {
    // For completed tasks, elapsed goes from PSA to today (or deadline if past today)
    elapsedWidth = Math.max(0, Math.min(todayPosition, taskDeadlinePosition) - psaStartPosition);
    remainingWidth = Math.max(0, taskDeadlinePosition - Math.min(todayPosition, taskDeadlinePosition));
  } else if (isNotStarted) {
    // For tasks that haven't started, elapsed goes from PSA to today
    elapsedWidth = Math.max(0, todayPosition - psaStartPosition);
    remainingWidth = Math.max(0, taskDeadlinePosition - todayPosition);
  } else if (isOverdue) {
    // For overdue tasks, elapsed goes from PSA to today
    elapsedWidth = Math.max(0, todayPosition - psaStartPosition);
    remainingWidth = Math.max(0, taskDeadlinePosition - todayPosition);
  } else {
    // For in-progress tasks, elapsed goes from PSA to today (never past deadline)
    elapsedWidth = Math.max(0, Math.min(todayPosition, taskDeadlinePosition) - psaStartPosition);
    remainingWidth = Math.max(0, taskDeadlinePosition - Math.min(todayPosition, taskDeadlinePosition));
  }
  
  // Calculate progress statistics for tooltip
  const taskDurationDays = Math.max(1, daysBetween(taskStart, taskDeadline, settings?.useBusinessDays, settings?.holidayCalendar));
  
  // Calculate elapsed and remaining days
  let elapsed: number;
  let remaining: number;
  
  if (isCompleted) {
    elapsed = taskDurationDays;
    remaining = 0;
  } else if (isNotStarted) {
    elapsed = 0;
    remaining = taskDurationDays;
  } else if (isOverdue) {
    elapsed = taskDurationDays;
    remaining = 0;
  } else {
    // For in-progress tasks, calculate actual elapsed time from task start to today
    elapsed = Math.max(0, daysBetween(taskStart, today, settings?.useBusinessDays, settings?.holidayCalendar));
    remaining = Math.max(0, taskDurationDays - elapsed);
  }

  // Format time labels
  const getTimeLabel = (days: number) => {
    if (days === 0) return "0 days";
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  const getStatusText = () => {
    if (isCompleted) return "Completed";
    if (isOverdue) return "Overdue";
    if (isNotStarted) return "Not Started";
    return "In Progress";
  };

  const getProgressColor = () => {
    if (isCompleted) return "bg-green-600";
    if (isOverdue) return "bg-red-600";
    return "bg-blue-600";
  };

  const getRemainingColor = () => {
    if (isOverdue) return "bg-red-100";
    return "bg-gray-100";
  };

  const handleClick = () => {
    if (onTaskClick) {
      onTaskClick(task.id);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "h-2 bg-gray-100 rounded-full overflow-hidden relative cursor-pointer hover:h-3 transition-all duration-200 shadow-sm border border-gray-200/50",
              className
            )} 
            onClick={handleClick}
            data-testid={`compact-progress-${task.id}`}
          >
            {/* Progress bar spanning from task start to task deadline */}
            <div 
              className="h-full bg-white rounded-full overflow-hidden shadow-sm border border-gray-300/60 absolute"
              style={{
                left: `${barStartPosition}%`,
                width: `${barWidth}%`
              }}
            >
              {/* Elapsed time section - solid color fill */}
              {elapsedWidth > 0 && (
                <div 
                  className={`h-full absolute ${getProgressColor()}`}
                  style={{
                    left: '0%',
                    width: `${(elapsedWidth / barWidth) * 100}%`
                  }}
                  data-testid="compact-progress-elapsed"
                />
              )}
              
              {/* Remaining time section - lighter background */}
              {remainingWidth > 0 && !isCompleted && (
                <div 
                  className={`h-full absolute ${getRemainingColor()}`}
                  style={{
                    left: `${(elapsedWidth / barWidth) * 100}%`,
                    width: `${(remainingWidth / barWidth) * 100}%`
                  }}
                  data-testid="compact-progress-remaining"
                />
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs p-3 bg-white border border-gray-200 shadow-lg z-[100]"
          data-testid={`tooltip-${task.id}`}
        >
          <div className="space-y-2">
            <div className="font-semibold text-gray-900 text-sm">{task.title}</div>
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <Calendar className="h-3 w-3" />
              <span>Deadline: {format(taskDeadline, 'MMM dd, yyyy')}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <Clock className="h-3 w-3" />
              <span>
                Status: {getStatusText()}
                {!isCompleted && remaining > 0 && ` (${getTimeLabel(remaining)} left)`}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Duration: {getTimeLabel(taskDurationDays)}
            </div>
            {task.assignee && (
              <div className="text-xs text-gray-500">
                Assigned to: {task.assignee}
              </div>
            )}
            <div className="text-xs text-blue-600 font-medium mt-2">
              Click to view task details
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}