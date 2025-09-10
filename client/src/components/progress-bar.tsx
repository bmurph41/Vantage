import { cn } from "@/lib/utils";
import { effectiveStart, effectiveDue, daysBetween, tzNow, getTimelineWindow, percentOfRange, clampDate } from "@/lib/date-utils";
import { startOfDay, isAfter, isBefore, parseISO, addDays } from "date-fns";
import type { Task, Project, ProjectSettings } from "@shared/schema";

interface ProgressBarProps {
  task: Task;
  project: Project;
  settings?: ProjectSettings | null;
  className?: string;
  granularity?: string; // Add granularity for timeline window calculation
}

export function ProgressBar({ task, project, settings, className, granularity = 'weekly' }: ProgressBarProps) {
  const today = startOfDay(tzNow('America/New_York'));
  
  // Get dynamic timeline window bounds
  const { start: timelineStart, end: timelineEnd } = getTimelineWindow(granularity);
  
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
  
  const taskDeadline = startOfDay(calculateTaskDeadline(task));
  
  // DYNAMIC SLIDING WINDOW SYSTEM: Progress bars start from task start and extend to today/deadline
  const progressStart = taskStart; // Start from actual task start
  const progressEnd = task.status === 'completed' 
    ? taskDeadline // Completed tasks extend to their deadline
    : isAfter(today, taskDeadline) 
      ? taskDeadline // Overdue tasks extend to their deadline
      : clampDate(today, taskStart, taskDeadline); // Active tasks extend to today (within task bounds)
  
  // Calculate positioning using dynamic timeline window percentages  
  const startPosition = percentOfRange(progressStart, timelineStart, timelineEnd);
  const endPosition = percentOfRange(progressEnd, timelineStart, timelineEnd);
  const barWidth = Math.max(1, endPosition - startPosition); // Bar width from task start to progress end
  
  // Task deadline position for reference
  const deadlinePosition = percentOfRange(taskDeadline, timelineStart, timelineEnd);
  const taskStartPosition = percentOfRange(taskStart, timelineStart, timelineEnd);
  
  // Calculate progress statistics for labels
  const taskDurationDays = Math.max(1, daysBetween(taskStart, taskDeadline, settings?.useBusinessDays, settings?.holidayCalendar));
  const elapsed = Math.max(0, Math.min(taskDurationDays, daysBetween(taskStart, today < taskDeadline ? today : taskDeadline, settings?.useBusinessDays, settings?.holidayCalendar)));
  const remaining = Math.max(0, taskDurationDays - elapsed);
  
  const isCompleted = task.status === 'completed';
  const isOverdue = !isCompleted && isAfter(today, taskDeadline);
  const isNotStarted = isBefore(today, taskStart);

  // Format time labels
  const getTimeLabel = (days: number) => {
    if (days === 0) return "0 days";
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  return (
    <div className={cn("h-8 bg-gray-100 rounded-lg overflow-hidden relative shadow-inner", className)} data-testid="progress-bar">
      {/* Text labels above progress bars - positioned at center of progress bar */}
      <div 
        className="absolute -top-6 z-10"
        style={{
          left: `${startPosition + barWidth/2}%`,
          transform: 'translateX(-50%)'
        }}
      >
        {isCompleted ? (
          <span className="text-black text-xs font-medium px-2 text-center whitespace-nowrap leader-obstacle">
            Completed ({getTimeLabel(taskDurationDays)})
          </span>
        ) : isOverdue ? (
          <span className="text-black text-xs font-medium px-2 text-center whitespace-nowrap leader-obstacle">
            Overdue ({getTimeLabel(elapsed)} elapsed)
          </span>
        ) : isNotStarted ? (
          <span className="text-black text-xs font-medium px-2 text-center whitespace-nowrap leader-obstacle">
            {getTimeLabel(taskDurationDays)} remaining
          </span>
        ) : (
          <span className="text-black text-xs font-medium px-2 text-center whitespace-nowrap leader-obstacle">
            {getTimeLabel(elapsed)} elapsed, {getTimeLabel(remaining)} left
          </span>
        )}
      </div>
      
      {/* Progress bar spanning from project start to today/deadline */}
      <div 
        className="h-full bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 absolute"
        style={{
          left: `${startPosition}%`,
          width: `${barWidth}%`
        }}
      >
        {isCompleted ? (
          <div className="h-full bg-green-600 progress-bar-completed relative" data-testid="progress-completed">
          </div>
        ) : isOverdue ? (
          <div className="h-full bg-red-600 progress-bar-overdue relative" data-testid="progress-overdue">
          </div>
        ) : isNotStarted ? (
          <div className="h-full progress-bar-remaining-stripes relative" data-testid="progress-not-started">
          </div>
        ) : (
          <div className="h-full bg-blue-500 progress-bar-elapsed relative" data-testid="progress-in-progress">
            {/* For the new system, the entire bar represents progress from start to today */}
          </div>
        )}
        
        {/* Task start marker - shows where the task actually begins */}
        <div 
          className="absolute -top-1 w-1 h-10 rounded-full shadow-sm bg-orange-500"
          style={{ 
            left: `${((taskStartPosition - startPosition) / barWidth) * 100}%`,
          }}
          data-testid="task-start-marker"
        />
        
        {/* Task deadline marker - shows where the task should end */}
        <div 
          className="absolute -top-1 w-1 h-10 rounded-full shadow-sm"
          style={{ 
            left: `${Math.min(100, ((deadlinePosition - startPosition) / barWidth) * 100)}%`,
            backgroundColor: isCompleted ? "#16a34a" : isOverdue ? "#dc2626" : "hsl(221 83% 35%)"
          }}
          data-testid="task-deadline-marker"
        />
        
        {/* Duration label on hover */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          {taskDurationDays} days ({taskStart.toLocaleDateString()} - {taskDeadline.toLocaleDateString()})
        </div>
      </div>
    </div>
  );
}

export function ProgressLegend() {
  return (
    <div className="flex items-center space-x-8 text-sm" data-testid="progress-legend">
      <div className="flex items-center space-x-3">
        <div className="w-6 h-3 bg-blue-500 rounded shadow-sm border border-blue-300" />
        <span className="font-medium text-gray-700">Time Elapsed</span>
      </div>
      <div className="flex items-center space-x-3">
        <div className="w-6 h-3 progress-bar-remaining-stripes rounded shadow-sm border border-gray-300" />
        <span className="font-medium text-gray-700">Time Remaining</span>
      </div>
      <div className="flex items-center space-x-3">
        <div className="w-6 h-3 bg-gradient-to-r from-green-500 to-green-600 rounded shadow-sm border border-green-300" />
        <span className="font-medium text-gray-700">Completed</span>
      </div>
      <div className="flex items-center space-x-3">
        <div className="w-6 h-3 bg-gradient-to-r from-red-500 to-red-600 rounded shadow-sm border border-red-300" />
        <span className="font-medium text-gray-700">Overdue</span>
      </div>
    </div>
  );
}
