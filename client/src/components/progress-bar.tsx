import { cn } from "@/lib/utils";
import { effectiveStart, effectiveDue, daysBetween, tzNow } from "@/lib/date-utils";
import { startOfDay, isAfter, isBefore } from "date-fns";
import type { Task, Project, ProjectSettings } from "@shared/schema";

interface ProgressBarProps {
  task: Task;
  project: Project;
  settings?: ProjectSettings | null;
  className?: string;
}

export function ProgressBar({ task, project, settings, className }: ProgressBarProps) {
  const today = startOfDay(tzNow(project.tz));
  const start = effectiveStart(task, { ...project, settings });
  const due = effectiveDue(task, { ...project, settings });
  
  // Calculate project timeline bounds
  const projectStart = project.psaSignedDate ? startOfDay(new Date(project.psaSignedDate)) : start;
  const projectEnd = project.closingDate ? startOfDay(new Date(project.closingDate)) : due;
  
  // Calculate task position and width relative to overall timeline
  const totalProjectDays = Math.max(1, daysBetween(projectStart, projectEnd, settings?.useBusinessDays, settings?.holidayCalendar));
  const daysFromProjectStart = Math.max(0, daysBetween(projectStart, start, settings?.useBusinessDays, settings?.holidayCalendar));
  const taskDurationDays = Math.max(1, daysBetween(start, due, settings?.useBusinessDays, settings?.holidayCalendar));
  
  // Position and width as percentages of the overall timeline
  const leftPosition = (daysFromProjectStart / totalProjectDays) * 100;
  const barWidth = (taskDurationDays / totalProjectDays) * 100;
  
  // Task progress within its own duration
  const elapsed = Math.max(0, Math.min(taskDurationDays, daysBetween(start, today, settings?.useBusinessDays, settings?.holidayCalendar)));
  const percentElapsed = Math.round((elapsed / taskDurationDays) * 100);
  
  const isCompleted = task.status === 'completed';
  const isOverdue = !isCompleted && isAfter(today, due);
  const isNotStarted = isBefore(today, start);

  return (
    <div className={cn("h-8 bg-gray-100 rounded-lg overflow-hidden relative shadow-inner", className)} data-testid="progress-bar">
      {/* Task bar positioned relative to timeline */}
      <div 
        className="absolute h-full bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200"
        style={{ 
          left: `${leftPosition}%`, 
          width: `${barWidth}%` 
        }}
      >
        {isCompleted ? (
          <div className="h-full bg-green-600 progress-bar-completed" data-testid="progress-completed" />
        ) : isOverdue ? (
          <div className="h-full bg-red-600 progress-bar-overdue" data-testid="progress-overdue" />
        ) : isNotStarted ? (
          <div className="h-full progress-bar-remaining-stripes" data-testid="progress-not-started" />
        ) : (
          <div className="h-full flex" data-testid="progress-in-progress">
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
        
        {/* Duration label on hover */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          {taskDurationDays} days
        </div>
      </div>
    </div>
  );
}

export function ProgressLegend() {
  return (
    <div className="flex items-center space-x-8 text-sm" data-testid="progress-legend">
      <div className="flex items-center space-x-3">
        <div className="w-6 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded shadow-sm border border-blue-300" />
        <span className="font-medium text-gray-700">Time Elapsed</span>
      </div>
      <div className="flex items-center space-x-3">
        <div className="w-6 h-3 progress-bar-remaining rounded shadow-sm border border-gray-300" />
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
