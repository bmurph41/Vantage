import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ProgressBar, ProgressLegend } from "./progress-bar";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO } from "date-fns";
import type { Task, Project, ProjectSettings } from "@shared/schema";
import { TIMELINE_GRANULARITIES } from "@/types/dd";

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
    switch (granularity) {
      case 'daily':
        return eachDayOfInterval({ start: projectStart, end: projectEnd });
      case 'weekly':
      case 'biweekly':
        const weeklyStart = startOfWeek(projectStart);
        const weeklyEnd = projectEnd; // End at closing date, not end of week
        return eachWeekOfInterval({ start: weeklyStart, end: weeklyEnd });
      case 'monthly':
        const monthlyStart = startOfMonth(projectStart);
        const monthlyEnd = projectEnd; // End at closing date, not end of month
        return eachMonthOfInterval({ start: monthlyStart, end: monthlyEnd });
      default:
        const defaultStart = startOfWeek(projectStart);
        const defaultEnd = projectEnd; // End at closing date, not end of week
        return eachWeekOfInterval({ start: defaultStart, end: defaultEnd });
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
      
      <CardContent className="p-0">
        {/* Timeline Header with Dates */}
        <div className="border-b bg-gray-50/50 p-6">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Project Timeline</h3>
            <div className="relative">
              {/* Timeline Grid Background */}
              <div className="absolute inset-0 timeline-grid opacity-30"></div>
              
              {/* Date Headers */}
              <div className="grid gap-4 w-full text-center relative z-10" style={{ gridTemplateColumns: `repeat(${Math.min(12, timelineDates.length)}, 1fr)` }}>
                {timelineDates.slice(0, 12).map((date, index) => (
                  <div key={index} className="py-2" data-testid={`timeline-date-${index}`}>
                    <div className="text-xs font-medium text-gray-900">
                      {format(date, 
                        granularity === 'daily' ? 'M/d' : 
                        granularity === 'monthly' ? 'MMM' : 
                        granularity === 'weekly' || granularity === 'biweekly' ? 'M/d' : 
                        'M/d'
                      )}
                    </div>
                    {granularity === 'monthly' && (
                      <div className="text-xs text-gray-500 mt-1">
                        {format(date, 'yyyy')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Milestone Timeline Track */}
          <div className="relative">
            {/* Timeline Track */}
            <div className="h-1 bg-gray-200 rounded-full mb-6">
              <div className="absolute w-full h-1 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-full"></div>
            </div>
            
            {/* Milestone Markers */}
            <div className="relative -mt-8 mb-2">
              {project.psaSignedDate && (
                <div 
                  className="absolute flex flex-col items-center transform -translate-x-1/2"
                  style={{ left: "2%" }}
                  data-testid="milestone-psa"
                >
                  <div className="milestone-marker mb-2"></div>
                  <div className="bg-white px-2 py-1 rounded shadow-sm border">
                    <span className="text-xs font-semibold text-primary">PSA Signed</span>
                    <div className="text-xs text-gray-500">{format(parseISO(project.psaSignedDate), 'M/d/yy')}</div>
                  </div>
                </div>
              )}
              {project.ddExpirationDate && (
                <div 
                  className="absolute flex flex-col items-center transform -translate-x-1/2"
                  style={{ left: `${getMilestonePosition(project.ddExpirationDate)}%` }}
                  data-testid="milestone-dd-expiration"
                >
                  <div className="milestone-marker mb-2 bg-amber-500 border-amber-600"></div>
                  <div className="bg-white px-2 py-1 rounded shadow-sm border">
                    <span className="text-xs font-semibold text-amber-600">DD Expiration</span>
                    <div className="text-xs text-gray-500">{format(parseISO(project.ddExpirationDate), 'M/d/yy')}</div>
                  </div>
                </div>
              )}
              {project.closingDate && (
                <div 
                  className="absolute flex flex-col items-center transform -translate-x-1/2"
                  style={{ right: "2%" }}
                  data-testid="milestone-closing"
                >
                  <div className="milestone-marker mb-2 bg-green-600 border-green-700"></div>
                  <div className="bg-white px-2 py-1 rounded shadow-sm border">
                    <span className="text-xs font-semibold text-green-600">Closing</span>
                    <div className="text-xs text-gray-500">{format(parseISO(project.closingDate), 'M/d/yy')}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Tasks */}
        <div className="p-6">
          <div className="space-y-4">
            {tasks.map((task, index) => (
              <div key={task.id} className={`group hover:bg-gray-50/50 -mx-2 px-2 py-3 rounded-lg transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`} data-testid={`timeline-task-${task.id}`}>
                <div className="flex items-center">
                  <div className="w-48 pr-6 flex-shrink-0" data-testid={`timeline-task-name-${task.id}`}>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">
                        {task.title}
                      </h4>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        {task.assignee && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                            {task.assignee}
                          </span>
                        )}
                        {task.priority && (
                          <span className={`px-2 py-0.5 rounded-full ${
                            task.priority === 'high' ? 'bg-red-100 text-red-700' :
                            task.priority === 'med' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {task.priority.toUpperCase()}
                          </span>
                        )}
                        {task.status && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            task.status === 'blocked' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {task.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 relative">
                    <ProgressBar 
                      task={task} 
                      project={project} 
                      settings={settings}
                      className={showCriticalPath && task.priority === 'high' ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {tasks.length === 0 && (
            <div className="text-center py-12" data-testid="text-no-tasks">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tasks Yet</h3>
                <p className="text-gray-500">Add some tasks to see them displayed in the timeline.</p>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="border-t bg-gray-50/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Legend</h4>
            <ProgressLegend />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
