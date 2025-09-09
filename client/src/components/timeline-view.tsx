import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ProgressBar, ProgressLegend } from "./progress-bar";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, eachWeekOfInterval } from "date-fns";
import type { Task, Project, ProjectSettings } from "@shared/schema";
import { TIMELINE_GRANULARITIES } from "@/types/dd";
import { parseISO } from "date-fns";

interface TimelineViewProps {
  tasks: Task[];
  project: Project;
  settings?: ProjectSettings | null;
}

export function TimelineView({ tasks, project, settings }: TimelineViewProps) {
  const [granularity, setGranularity] = useState('weekly');
  const [showCriticalPath, setShowCriticalPath] = useState(false);

  const selectedGranularity = TIMELINE_GRANULARITIES.find(g => g.value === granularity) || TIMELINE_GRANULARITIES[1];

  // Calculate timeline bounds
  const projectStart = project.psaSignedDate ? parseISO(project.psaSignedDate) : new Date();
  const projectEnd = project.closingDate ? parseISO(project.closingDate) : addDays(projectStart, 120);

  // Generate timeline header dates
  const generateTimelineDates = () => {
    const start = startOfWeek(projectStart);
    const end = endOfWeek(projectEnd);

    switch (granularity) {
      case 'daily':
        return eachDayOfInterval({ start, end });
      case 'weekly':
      case 'biweekly':
        return eachWeekOfInterval({ start, end });
      default:
        return eachWeekOfInterval({ start, end });
    }
  };

  const timelineDates = generateTimelineDates();

  // Get milestone positions as percentages
  const getMilestonePosition = (date: string) => {
    const milestoneDate = parseISO(date);
    const totalDuration = projectEnd.getTime() - projectStart.getTime();
    const elapsed = milestoneDate.getTime() - projectStart.getTime();
    return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
  };

  return (
    <Card data-testid="timeline-view">
      <CardHeader className="bg-primary text-primary-foreground">
        <div className="flex items-center justify-between">
          <CardTitle>DD Timeline</CardTitle>
          <div className="flex items-center space-x-4">
            <Select value={granularity} onValueChange={setGranularity}>
              <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white" data-testid="select-granularity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMELINE_GRANULARITIES.map(g => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showCriticalPath ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowCriticalPath(!showCriticalPath)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
              data-testid="button-critical-path"
            >
              Critical Path
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Timeline Header with Dates */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="grid gap-4 w-full text-center text-sm text-muted-foreground" style={{ gridTemplateColumns: `repeat(${Math.min(12, timelineDates.length)}, 1fr)` }}>
              {timelineDates.slice(0, 12).map((date, index) => (
                <div key={index} data-testid={`timeline-date-${index}`}>
                  {format(date, granularity === 'daily' ? 'M/d' : 'M/d')}
                </div>
              ))}
            </div>
          </div>
          
          {/* Milestone Markers */}
          <div className="relative mb-4 h-10 bg-gradient-to-r from-muted via-muted to-muted rounded-sm">
            {project.psaSignedDate && (
              <div 
                className="absolute top-2 flex items-center"
                style={{ left: "0%" }}
                data-testid="milestone-psa"
              >
                <div className="w-3 h-3 bg-primary rounded-full border-2 border-white shadow-md"></div>
                <span className="ml-2 text-xs font-medium text-primary">PSA Signed</span>
              </div>
            )}
            {project.ddExpirationDate && (
              <div 
                className="absolute top-2"
                style={{ left: `${getMilestonePosition(project.ddExpirationDate)}%` }}
                data-testid="milestone-dd-expiration"
              >
                <div className="w-3 h-3 bg-primary rounded-full border-2 border-white shadow-md"></div>
                <span className="ml-2 text-xs font-medium text-primary">DD Expiration</span>
              </div>
            )}
            {project.closingDate && (
              <div 
                className="absolute top-2 flex items-center justify-end"
                style={{ right: "0%" }}
                data-testid="milestone-closing"
              >
                <span className="mr-2 text-xs font-medium text-primary">Closing</span>
                <div className="w-3 h-3 bg-primary rounded-full border-2 border-white shadow-md"></div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline Tasks */}
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center" data-testid={`timeline-task-${task.id}`}>
              <div className="w-32 text-sm font-medium text-right pr-4" data-testid={`timeline-task-name-${task.id}`}>
                {task.title}
              </div>
              <div className="flex-1 relative">
                <ProgressBar 
                  task={task} 
                  project={project} 
                  settings={settings}
                  className={showCriticalPath && task.priority === 'high' ? 'ring-2 ring-yellow-400' : ''}
                />
              </div>
            </div>
          ))}
          
          {tasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-tasks">
              No tasks to display in timeline.
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-border">
          <ProgressLegend />
        </div>
      </CardContent>
    </Card>
  );
}
