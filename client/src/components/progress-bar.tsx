import { cn } from "@/lib/utils";
import { effectiveStart, effectiveDue, daysBetween, tzNow } from "@/lib/date-utils";
import { startOfDay, isAfter, isBefore, parseISO, addDays } from "date-fns";
import type { Task, Project, ProjectSettings } from "@shared/schema";

interface ProgressBarProps {
  task: Task;
  project: Project;
  settings?: ProjectSettings | null;
  className?: string;
}

export function ProgressBar({ task, project, settings, className }: ProgressBarProps) {
  const today = startOfDay(tzNow(project.tz));
  
  // Calculate individual task start date
  const start = task.startDate 
    ? parseISO(task.startDate) 
    : project.psaSignedDate 
      ? addDays(parseISO(project.psaSignedDate), task.startOffsetDays || 0)
      : today;
  
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
  
  const due = calculateTaskDeadline(task);
  
  // Calculate project timeline bounds
  const projectStart = project.psaSignedDate ? startOfDay(parseISO(project.psaSignedDate)) : start;
  const projectEnd = project.closingDate ? startOfDay(parseISO(project.closingDate)) : due;
  
  // Calculate task position and width relative to overall timeline
  const totalProjectDays = Math.max(1, daysBetween(projectStart, projectEnd, settings?.useBusinessDays, settings?.holidayCalendar));
  const daysFromProjectStart = Math.max(0, daysBetween(projectStart, start, settings?.useBusinessDays, settings?.holidayCalendar));
  const taskDurationDays = Math.max(1, daysBetween(start, due, settings?.useBusinessDays, settings?.holidayCalendar));
  
  // Position and width as percentages of the overall timeline
  const leftPosition = (daysFromProjectStart / totalProjectDays) * 100;
  const barWidth = (taskDurationDays / totalProjectDays) * 100;
  
  // Task progress within its own duration
  const elapsed = Math.max(0, Math.min(taskDurationDays, daysBetween(start, today, settings?.useBusinessDays, settings?.holidayCalendar)));
  const remaining = Math.max(0, taskDurationDays - elapsed);
  const percentElapsed = Math.round((elapsed / taskDurationDays) * 100);
  
  const isCompleted = task.status === 'completed';
  const isOverdue = !isCompleted && isAfter(today, due);
  const isNotStarted = isBefore(today, start);

  // Format time labels
  const getTimeLabel = (days: number) => {
    if (days === 0) return "0 days";
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  return (
    <div className={cn("h-8 bg-gray-100 rounded-lg overflow-hidden relative shadow-inner", className)} data-testid="progress-bar">
      {/* Text labels above progress bars */}
      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-10">
        {isCompleted ? (
          <span className="text-black text-xs font-medium px-2 text-center whitespace-nowrap">
            Completed ({getTimeLabel(taskDurationDays)})
          </span>
        ) : isOverdue ? (
          <span className="text-black text-xs font-medium px-2 text-center whitespace-nowrap">
            Overdue ({getTimeLabel(elapsed)} elapsed)
          </span>
        ) : isNotStarted ? (
          <span className="text-black text-xs font-medium px-2 text-center whitespace-nowrap">
            {getTimeLabel(taskDurationDays)} remaining
          </span>
        ) : (
          <span className="text-black text-xs font-medium px-2 text-center whitespace-nowrap">
            {getTimeLabel(elapsed)} elapsed, {getTimeLabel(remaining)} left
          </span>
        )}
      </div>
      
      {/* Task bar spans full width from start date to end date */}
      <div 
        className="h-full bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200"
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
          <div className="h-full flex relative" data-testid="progress-in-progress">
            <div 
              className="progress-bar-elapsed bg-blue-500" 
              style={{ width: `${percentElapsed}%` }}
              data-testid="progress-elapsed"
            />
            <div 
              className="progress-bar-remaining-stripes"
              style={{ width: `${100 - percentElapsed}%` }}
              data-testid="progress-remaining"
            />
          </div>
        )}
        
        {/* Start marker */}
        <div 
          className="absolute -top-1 w-1 h-10 rounded-full shadow-sm"
          style={{ 
            left: "0px",
            backgroundColor: isCompleted ? "#16a34a" : isOverdue ? "#dc2626" : "hsl(221 83% 35%)"
          }}
          data-testid="start-marker"
        />
        
        {/* End marker */}
        <div 
          className="absolute -top-1 w-1 h-10 rounded-full shadow-sm"
          style={{ 
            right: "0px",
            backgroundColor: isCompleted ? "#16a34a" : isOverdue ? "#dc2626" : "hsl(221 83% 35%)"
          }}
          data-testid="end-marker"
        />
        
        {/* Duration label on hover */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          {taskDurationDays} days ({start.toLocaleDateString()} - {due.toLocaleDateString()})
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
