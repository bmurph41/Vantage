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
    <div className={cn("h-6 bg-transparent rounded-sm overflow-hidden relative", className)} data-testid="progress-bar">
      {/* Task bar positioned relative to timeline */}
      <div 
        className="absolute h-full bg-muted rounded-sm overflow-hidden"
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
          <div className="h-full bg-muted progress-bar-remaining" data-testid="progress-not-started" />
        ) : (
          <div className="h-full flex" data-testid="progress-in-progress">
            <div 
              className="progress-bar-elapsed bg-primary" 
              style={{ width: `${percentElapsed}%` }}
              data-testid="progress-elapsed"
            />
            <div 
              className="progress-bar-remaining"
              style={{ width: `${100 - percentElapsed}%` }}
              data-testid="progress-remaining"
            />
          </div>
        )}
        
        {/* Start marker */}
        <div 
          className="absolute -top-1 w-2 h-8 rounded-sm"
          style={{ 
            left: "0px",
            backgroundColor: isCompleted ? "#16a34a" : isOverdue ? "#dc2626" : "hsl(221 83% 35%)"
          }}
          data-testid="start-marker"
        />
      </div>
    </div>
  );
}

export function ProgressLegend() {
  return (
    <div className="flex items-center space-x-6 text-xs" data-testid="progress-legend">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-3 bg-primary rounded-sm" />
        <span>Time Elapsed</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-4 h-3 progress-bar-remaining rounded-sm" />
        <span>Time Remaining</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-4 h-3 bg-green-600 rounded-sm" />
        <span>Completed</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-4 h-3 bg-red-600 rounded-sm" />
        <span>Overdue</span>
      </div>
    </div>
  );
}
