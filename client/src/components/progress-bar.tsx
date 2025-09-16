import { cn } from "@/lib/utils";
import { effectiveStart, effectiveDue, daysBetween, tzNow, getProjectBounds, percentOfRange, clampDate, setDeadlineTo5PM } from "@/lib/date-utils";
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
    <div className={cn("h-8 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg overflow-hidden relative shadow-inner border border-gray-200/50", className)} data-testid="progress-bar">
      {/* Text labels above progress bars - positioned at center of task timeline */}
      <div 
        className="absolute -top-6 z-10"
        style={{
          left: `${percentOfRange(taskStart, timelineStart, timelineEnd) + (taskDeadlinePosition - percentOfRange(taskStart, timelineStart, timelineEnd))/2}%`,
          transform: 'translateX(-50%)'
        }}
      >
        {isCompleted ? (
          <span className="text-gray-900 text-xs font-semibold px-3 py-1 bg-white/90 backdrop-blur-sm rounded-md border border-gray-200/80 shadow-sm text-center whitespace-nowrap leader-obstacle">
            Completed ({getTimeLabel(taskDurationDays)})
          </span>
        ) : isOverdue ? (
          <span className={`${getTextColorClass()} text-xs font-semibold px-3 py-1 bg-white/90 backdrop-blur-sm rounded-md border border-red-200/80 shadow-sm text-center whitespace-nowrap leader-obstacle`}>
            Overdue ({getTimeLabel(elapsed)} elapsed)
          </span>
        ) : isNotStarted ? (
          <span className={`${getTextColorClass()} text-xs font-semibold px-3 py-1 bg-white/90 backdrop-blur-sm rounded-md border border-gray-200/80 shadow-sm text-center whitespace-nowrap leader-obstacle`}>
            {getTimeLabel(taskDurationDays)} remaining
          </span>
        ) : (
          <span className={`${getTextColorClass()} text-xs font-semibold px-3 py-1 bg-white/90 backdrop-blur-sm rounded-md border border-blue-200/80 shadow-sm text-center whitespace-nowrap leader-obstacle`}>
            {getTimeLabel(elapsed)} elapsed, {getTimeLabel(remaining)} left
          </span>
        )}
      </div>
      
      {/* Progress bar spanning from task start to task deadline */}
      <div 
        className="h-full bg-white rounded-lg overflow-hidden shadow-md border border-gray-300/60 absolute ring-1 ring-gray-200/40"
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
        
        {/* Task start marker - Enhanced - shows where the task actually begins */}
        <div 
          className="absolute -top-2 z-50 group cursor-pointer transform -translate-x-1/2"
          style={{ 
            left: '0%', // Always at the start of the task bar
          }}
          data-testid="task-start-marker"
        >
          <div className="w-3 h-12 rounded-full shadow-xl bg-gradient-to-b from-orange-400 via-orange-500 to-orange-600 border-2 border-orange-300/60 ring-2 ring-orange-200/40 hover:scale-110 transition-all duration-300 hover:shadow-2xl" />
          <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-white to-orange-50/95 backdrop-blur-sm border-2 border-orange-200/80 rounded-xl px-3 py-2 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 ring-1 ring-orange-100/60">
            <div className="text-sm font-bold text-orange-700 mb-1 flex items-center">
              <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
              Task Start
            </div>
            <div className="text-xs text-gray-600 font-medium">{taskStart.toLocaleDateString()}</div>
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-white to-orange-50/95 border-t-2 border-l-2 border-orange-200/80 rotate-45"></div>
          </div>
        </div>
        
        {/* Task deadline marker - Enhanced - shows where the task should end */}
        <div 
          className="absolute -top-2 z-50 group cursor-pointer transform -translate-x-1/2"
          style={{ 
            left: `100%`,
          }}
          data-testid="task-deadline-marker"
        >
          <div 
            className={`w-3 h-12 rounded-full shadow-xl border-2 ring-2 hover:scale-110 transition-all duration-300 hover:shadow-2xl ${
              isCompleted 
                ? 'bg-gradient-to-b from-green-400 via-green-500 to-green-600 border-green-300/60 ring-green-200/40' 
                : isOverdue 
                  ? 'bg-gradient-to-b from-red-400 via-red-500 to-red-600 border-red-300/60 ring-red-200/40'
                  : 'bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 border-blue-300/60 ring-blue-200/40'
            }`} 
          />
          <div 
            className={`absolute top-14 left-1/2 transform -translate-x-1/2 backdrop-blur-sm border-2 rounded-xl px-3 py-2 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 ring-1 ${
              isCompleted 
                ? 'bg-gradient-to-br from-white to-green-50/95 border-green-200/80 ring-green-100/60' 
                : isOverdue 
                  ? 'bg-gradient-to-br from-white to-red-50/95 border-red-200/80 ring-red-100/60'
                  : 'bg-gradient-to-br from-white to-blue-50/95 border-blue-200/80 ring-blue-100/60'
            }`}
          >
            <div 
              className={`text-sm font-bold mb-1 flex items-center ${
                isCompleted 
                  ? 'text-green-700' 
                  : isOverdue 
                    ? 'text-red-700'
                    : 'text-blue-700'
              }`}
            >
              <div 
                className={`w-2 h-2 rounded-full mr-2 ${
                  isCompleted 
                    ? 'bg-green-500' 
                    : isOverdue 
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                }`}
              ></div>
              {isCompleted ? 'Completed' : isOverdue ? 'Deadline (Overdue)' : 'Deadline'}
            </div>
            <div className="text-xs text-gray-600 font-medium">{taskDeadline.toLocaleDateString()}</div>
            <div 
              className={`absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 border-t-2 border-l-2 rotate-45 ${
                isCompleted 
                  ? 'bg-gradient-to-br from-white to-green-50/95 border-green-200/80' 
                  : isOverdue 
                    ? 'bg-gradient-to-br from-white to-red-50/95 border-red-200/80'
                    : 'bg-gradient-to-br from-white to-blue-50/95 border-blue-200/80'
              }`}
            ></div>
          </div>
        </div>
        
        {/* Duration label on hover - Enhanced */}
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm px-4 py-2 rounded-lg whitespace-nowrap z-40 shadow-xl ring-1 ring-white/20">
          <div className="font-semibold">{taskDurationDays} days duration</div>
          <div className="text-xs text-gray-300 mt-1">{taskStart.toLocaleDateString()} - {taskDeadline.toLocaleDateString()}</div>
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
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
