import { cn } from "@/lib/utils";
import { effectiveStart, effectiveDue, daysBetween, tzNow, getProjectBounds, percentOfRange, clampDate } from "@/lib/date-utils";
import { startOfDay, isAfter, isBefore, parseISO, addDays } from "date-fns";
import type { Task, Project, ProjectSettings } from "@shared/schema";

interface ProgressBarProps {
  task: Task;
  project: Project;
  settings?: ProjectSettings | null;
  className?: string;
}

export function ProgressBar({ task, project, settings, className }: ProgressBarProps) {
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
  
  const taskDeadline = startOfDay(calculateTaskDeadline(task));
  
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
  // CRITICAL FIX: Only show elapsed progress if task has actually started
  let elapsedEndPosition: number;
  let elapsedWidth: number;
  let remainingWidth: number;
  
  if (isCompleted) {
    // For completed tasks, elapsed goes from PSA to today (or deadline if past today)
    elapsedEndPosition = Math.min(todayPosition, taskDeadlinePosition);
    elapsedWidth = Math.max(0, Math.min(todayPosition, taskDeadlinePosition) - psaStartPosition);
    remainingWidth = Math.max(0, taskDeadlinePosition - Math.min(todayPosition, taskDeadlinePosition));
  } else if (isNotStarted) {
    // For tasks that haven't started, elapsed goes from PSA to today
    elapsedEndPosition = todayPosition;
    elapsedWidth = Math.max(0, todayPosition - psaStartPosition);
    remainingWidth = Math.max(0, taskDeadlinePosition - todayPosition);
  } else if (isOverdue) {
    // For overdue tasks, elapsed goes from PSA to today
    elapsedEndPosition = todayPosition;
    elapsedWidth = Math.max(0, todayPosition - psaStartPosition);
    remainingWidth = Math.max(0, taskDeadlinePosition - todayPosition);
  } else {
    // For in-progress tasks, elapsed goes from PSA to today (never past deadline)
    elapsedEndPosition = Math.min(todayPosition, taskDeadlinePosition);
    elapsedWidth = Math.max(0, Math.min(todayPosition, taskDeadlinePosition) - psaStartPosition);
    remainingWidth = Math.max(0, taskDeadlinePosition - Math.min(todayPosition, taskDeadlinePosition));
  }
  
  // Calculate progress statistics for labels
  const taskDurationDays = Math.max(1, daysBetween(taskStart, taskDeadline, settings?.useBusinessDays, settings?.holidayCalendar));
  
  // CRITICAL FIX: Only calculate elapsed days if task has started
  let elapsed: number;
  let remaining: number;
  
  if (isCompleted) {
    elapsed = taskDurationDays; // Full duration for completed tasks
    remaining = 0;
  } else if (isNotStarted) {
    elapsed = 0; // No elapsed time for unstarted tasks
    remaining = taskDurationDays; // Full duration remaining
  } else if (isOverdue) {
    elapsed = taskDurationDays; // Full duration elapsed for overdue tasks
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

  // Get text color class based on remaining days and task status
  const getTextColorClass = () => {
    if (isOverdue || remaining <= 5) {
      return "text-red-600";
    } else if (remaining >= 6 && remaining <= 14) {
      return "text-orange-600";
    }
    return "text-black";
  };

  return (
    <div className={cn("h-8 bg-gray-100 rounded-lg overflow-hidden relative shadow-inner", className)} data-testid="progress-bar">
      {/* Text labels above progress bars - positioned at center of task timeline */}
      <div 
        className="absolute -top-6 z-10"
        style={{
          left: `${percentOfRange(taskStart, timelineStart, timelineEnd) + (taskDeadlinePosition - percentOfRange(taskStart, timelineStart, timelineEnd))/2}%`,
          transform: 'translateX(-50%)'
        }}
      >
        {isCompleted ? (
          <span className="text-black text-xs font-medium px-2 text-center whitespace-nowrap leader-obstacle">
            Completed ({getTimeLabel(taskDurationDays)})
          </span>
        ) : isOverdue ? (
          <span className={`${getTextColorClass()} text-xs font-medium px-2 text-center whitespace-nowrap leader-obstacle`}>
            Overdue ({getTimeLabel(elapsed)} elapsed)
          </span>
        ) : isNotStarted ? (
          <span className={`${getTextColorClass()} text-xs font-medium px-2 text-center whitespace-nowrap leader-obstacle`}>
            {getTimeLabel(taskDurationDays)} remaining
          </span>
        ) : (
          <span className={`${getTextColorClass()} text-xs font-medium px-2 text-center whitespace-nowrap leader-obstacle`}>
            {getTimeLabel(elapsed)} elapsed, {getTimeLabel(remaining)} left
          </span>
        )}
      </div>
      
      {/* Progress bar spanning from task start to task deadline */}
      <div 
        className="h-full bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 absolute"
        style={{
          left: `${barStartPosition}%`,
          width: `${barWidth}%`
        }}
      >
        {/* Elapsed time section (task start to today) - solid color fill */}
        {elapsedWidth > 0 && (
          <div 
            className={`h-full absolute ${
              isCompleted ? 'bg-green-600' : 
              isOverdue ? 'bg-red-600' : 
              'bg-blue-600'
            }`}
            style={{
              left: '0%',
              width: `${(elapsedWidth / barWidth) * 100}%`
            }}
            data-testid="progress-elapsed"
          />
        )}
        
        {/* Remaining time section (today to task deadline) - striped pattern */}
        {remainingWidth > 0 && !isCompleted && (
          <div 
            className={`h-full absolute relative overflow-hidden ${
              isOverdue ? 'bg-red-100' : 'bg-gray-50'
            }`}
            style={{
              left: `${(elapsedWidth / barWidth) * 100}%`,
              width: `${(remainingWidth / barWidth) * 100}%`
            }}
            data-testid="progress-remaining"
          >
            {/* Diagonal striped pattern for remaining time */}
            <div 
              className={`absolute inset-0 ${
                isOverdue ? 'bg-red-200' : 'bg-blue-200'
              }`}
              style={{
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 4px,
                  rgba(255,255,255,0.3) 4px,
                  rgba(255,255,255,0.3) 8px
                )`
              }}
            />
          </div>
        )}
        
        {/* Task start marker - shows where the task actually begins */}
        <div 
          className="absolute -top-1 w-1 h-10 rounded-full shadow-sm bg-orange-500"
          style={{ 
            left: '0%', // Always at the start of the task bar
          }}
          data-testid="task-start-marker"
        />
        
        {/* Task deadline marker - shows where the task should end */}
        <div 
          className="absolute -top-1 w-1 h-10 rounded-full shadow-sm"
          style={{ 
            left: `100%`,
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
