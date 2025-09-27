import { cn } from "@/lib/utils";
import { effectiveStart, effectiveDue, daysBetween, tzNow, getProjectBounds, percentOfRange, clampDate, setDeadlineTo5PM, getGranularityAwareProgressPositions } from "@/lib/date-utils";
import { startOfDay, isAfter, isBefore, parseISO, addDays } from "date-fns";
import type { Task, Project, ProjectSettings } from "@shared/schema";

interface ProgressBarProps {
  task: Task;
  project: Project;
  settings?: ProjectSettings | null;
  className?: string;
  onTaskClick?: (taskId: string) => void;
  granularity?: string; // Add granularity prop for timeline alignment
}

export function ProgressBar({ task, project, settings, className, onTaskClick, granularity = 'weekly' }: ProgressBarProps) {
  const today = startOfDay(tzNow('America/New_York'));
  
  // Use granularity-aware positioning for timeline alignment
  const {
    taskStart,
    taskDeadline,
    barStartPosition,
    barEndPosition,
    todayPosition,
    timelineStart,
    timelineEnd
  } = getGranularityAwareProgressPositions(task, project, granularity, settings);
  
  // Calculate task status variables first - these are used throughout the component
  const isCompleted = task.status === 'completed';
  const isOverdue = !isCompleted && isAfter(today, taskDeadline);
  const isNotStarted = isBefore(today, taskStart);
  
  // Progress bar spans from PSA start to task deadline (full duration)
  const barWidth = Math.max(1, barEndPosition - barStartPosition);
  
  // Calculate elapsed time within the task timeline
  let elapsedEndPosition: number;
  let elapsedWidth: number;
  let remainingWidth: number;
  
  if (isCompleted) {
    // For completed tasks, elapsed goes from PSA to today (or deadline if past today)
    elapsedEndPosition = Math.min(todayPosition, barEndPosition);
    elapsedWidth = Math.max(0, Math.min(todayPosition, barEndPosition) - barStartPosition);
    remainingWidth = Math.max(0, barEndPosition - Math.min(todayPosition, barEndPosition));
  } else if (isNotStarted) {
    // For tasks that haven't started, elapsed goes from PSA to today
    elapsedEndPosition = todayPosition;
    elapsedWidth = Math.max(0, todayPosition - barStartPosition);
    remainingWidth = Math.max(0, barEndPosition - todayPosition);
  } else if (isOverdue) {
    // For overdue tasks, elapsed goes from PSA to today
    elapsedEndPosition = todayPosition;
    elapsedWidth = Math.max(0, todayPosition - barStartPosition);
    remainingWidth = Math.max(0, barEndPosition - todayPosition);
  } else {
    // For in-progress tasks, elapsed goes from PSA to today (never past deadline)
    elapsedEndPosition = Math.min(todayPosition, barEndPosition);
    elapsedWidth = Math.max(0, Math.min(todayPosition, barEndPosition) - barStartPosition);
    remainingWidth = Math.max(0, barEndPosition - Math.min(todayPosition, barEndPosition));
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

  // Get border color class based on remaining days and task status
  const getBorderColorClass = () => {
    if (isOverdue || remaining <= 5) {
      return "border-red-200/80";
    } else if (remaining >= 6 && remaining <= 14) {
      return "border-orange-200/80";
    }
    return "border-gray-200/80";
  };

  // Get main container styling for urgency
  const getContainerUrgencyClass = () => {
    if (isOverdue || remaining <= 5) {
      return "border-red-400/60 shadow-red-100 bg-gradient-to-r from-red-50/30 to-red-100/30 ring-2 ring-red-200/40";
    } else if (remaining >= 6 && remaining <= 14) {
      return "border-orange-300/50 shadow-orange-50 bg-gradient-to-r from-orange-50/20 to-orange-100/20";
    }
    return "border-gray-200/50";
  };

  const handleClick = () => {
    if (onTaskClick) {
      onTaskClick(task.id);
    }
  };

  return (
    <div 
      className={cn("h-8 rounded-lg overflow-hidden relative shadow-inner border cursor-pointer hover:shadow-md transition-all duration-200", 
        getContainerUrgencyClass(),
        className
      )} 
      onClick={handleClick}
      data-testid="progress-bar"
    >
      {/* Text labels above progress bars - positioned at center of task timeline */}
      <div 
        className="absolute -top-6 z-10"
        style={{
          left: `${barStartPosition + (barEndPosition - barStartPosition)/2}%`,
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
          <span className={`${getTextColorClass()} text-xs font-semibold px-3 py-1 bg-white/90 backdrop-blur-sm rounded-md border ${getBorderColorClass()} shadow-sm text-center whitespace-nowrap leader-obstacle`}>
            {getTimeLabel(taskDurationDays)} remaining
          </span>
        ) : (
          <span className={`${getTextColorClass()} text-xs font-semibold px-3 py-1 bg-white/90 backdrop-blur-sm rounded-md border ${getBorderColorClass()} shadow-sm text-center whitespace-nowrap leader-obstacle`}>
            {getTimeLabel(elapsed)} elapsed, {getTimeLabel(remaining)} left
          </span>
        )}
      </div>
      
      {/* Progress bar spanning from task start to task deadline */}
      <div 
        className={`h-full bg-white rounded-lg overflow-hidden shadow-lg border-2 absolute ring-2 ${
          isCompleted 
            ? 'border-green-600/80 ring-green-300/60 shadow-green-200'
            : isOverdue || remaining <= 5 
              ? 'border-red-600/80 ring-red-300/60 shadow-red-200' 
              : remaining >= 6 && remaining <= 14
                ? 'border-orange-500/80 ring-orange-300/60 shadow-orange-200'
                : 'border-blue-600/80 ring-blue-300/60 shadow-blue-200'
        }`}
        style={{
          left: `${barStartPosition}%`,
          width: `${barWidth}%`
        }}
      >
        {/* Elapsed time section (task start to today) - solid color fill */}
        {elapsedWidth > 0 && (
          <div 
            className={`h-full absolute border-r-4 ${
              isCompleted ? 'bg-green-600 border-green-600' : 
              isOverdue || remaining <= 5 ? 'bg-red-600 border-red-600' : 
              remaining >= 6 && remaining <= 14 ? 'bg-orange-500 border-orange-500' :
              'bg-blue-600 border-blue-600'
            }`}
            style={{
              left: '0%',
              width: `${(elapsedWidth / barWidth) * 100}%`
            }}
            data-testid="progress-elapsed"
          />
        )}
        
        {/* Remaining time section (today to task deadline) - enhanced visual distinction */}
        {remainingWidth > 0 && !isCompleted && (
          <div 
            className={`h-full absolute relative overflow-hidden border-l-4 border-r-2 border-t-2 border-b-2 ${
              isOverdue 
                ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-400 shadow-inner' 
                : remaining <= 5
                  ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-400 shadow-inner'
                  : remaining >= 6 && remaining <= 14
                    ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-orange-400 shadow-inner'
                    : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-400 shadow-inner'
            }`}
            style={{
              left: `${(elapsedWidth / barWidth) * 100}%`,
              width: `${(remainingWidth / barWidth) * 100}%`
            }}
            data-testid="progress-remaining"
          >
            {/* Enhanced visual pattern for remaining time - Diagonal stripes texture */}
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  -45deg,
                  ${isOverdue 
                    ? 'rgba(239, 68, 68, 0.8)' 
                    : remaining <= 5
                      ? 'rgba(239, 68, 68, 0.8)'
                      : remaining >= 6 && remaining <= 14
                        ? 'rgba(249, 115, 22, 0.8)'
                        : 'rgba(59, 130, 246, 0.8)'
                  },
                  ${isOverdue 
                    ? 'rgba(239, 68, 68, 0.8)' 
                    : remaining <= 5
                      ? 'rgba(239, 68, 68, 0.8)'
                      : remaining >= 6 && remaining <= 14
                        ? 'rgba(249, 115, 22, 0.8)'
                        : 'rgba(59, 130, 246, 0.8)'
                  } 4px,
                  rgba(255, 255, 255, 0.9) 4px,
                  rgba(255, 255, 255, 0.9) 8px
                )`,
                opacity: 0.7
              }}
            />
            
            {/* Additional dotted overlay for extra texture clarity */}
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(
                  circle at 25% 25%,
                  ${isOverdue 
                    ? 'rgba(185, 28, 28, 0.4)' 
                    : remaining <= 5
                      ? 'rgba(185, 28, 28, 0.4)'
                      : remaining >= 6 && remaining <= 14
                        ? 'rgba(194, 65, 12, 0.4)'
                        : 'rgba(37, 99, 235, 0.4)'
                  } 1px,
                  transparent 1px
                )`,
                backgroundSize: '6px 6px',
                opacity: 0.6
              }}
            />
            
            {/* Remaining time indicator overlay with enhanced visibility */}
            {remaining > 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`text-xs font-bold px-2 py-1 rounded-md backdrop-blur-sm border-2 shadow-lg ${
                  isOverdue 
                    ? 'bg-white/95 border-red-500 text-red-700 ring-2 ring-red-200' 
                    : remaining <= 5
                      ? 'bg-white/95 border-red-500 text-red-700 ring-2 ring-red-200'
                      : remaining >= 6 && remaining <= 14
                        ? 'bg-white/95 border-orange-500 text-orange-700 ring-2 ring-orange-200'
                        : 'bg-white/95 border-blue-500 text-blue-700 ring-2 ring-blue-200'
                }`}>
                  {getTimeLabel(remaining)} left
                </div>
              </div>
            )}
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
