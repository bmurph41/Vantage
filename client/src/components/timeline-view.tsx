import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ProgressBar, ProgressLegend } from "./progress-bar";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO, isToday, isPast, isFuture, differenceInDays } from "date-fns";
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
        return eachDayOfInterval({ start: projectStart, end: projectEnd });
    }
  };

  const timelineDates = generateTimelineDates();

  // Get milestone position along timeline (0-100%)
  const getMilestonePosition = (dateString: string) => {
    const date = parseISO(dateString);
    const totalDuration = differenceInDays(projectEnd, projectStart);
    const elapsed = differenceInDays(date, projectStart);
    return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
  };

  return (
    <div className="space-y-6" data-testid="timeline-view">
      {/* Professional Header */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">Project Timeline</h1>
              <p className="text-gray-600">Due diligence milestones and task tracking</p>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger className="w-32" data-testid="select-granularity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_GRANULARITIES.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showCriticalPath ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCriticalPath(!showCriticalPath)}
                data-testid="button-critical-path"
              >
                Critical Path
              </Button>
            </div>
          </div>

          {/* Clean Date Headers */}
          <div className="mb-4">
            <div className="grid gap-1 w-full text-center py-3 bg-gray-50 rounded border" style={{ gridTemplateColumns: `repeat(${Math.min(12, timelineDates.length)}, 1fr)` }}>
              {timelineDates.slice(0, 12).map((date, index) => {
                const isCurrentPeriod = isToday(date);
                return (
                  <div key={index} className={`py-2 px-1 text-xs ${
                    isCurrentPeriod ? 'bg-blue-50 text-blue-700 font-medium rounded' : 'text-gray-600'
                  }`} data-testid={`timeline-date-${index}`}>
                    <div>
                      {format(date, 
                        granularity === 'daily' ? 'MMM d' : 
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
                );
              })}
            </div>
          </div>

          {/* Overall Progress Bar */}
          {project.closingDate && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Overall Progress to Closing
                </h3>
                <div className="text-xs text-gray-600">
                  {(() => {
                    const startDate = parseISO(project.psaSignedDate || (project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt) || new Date().toISOString());
                    const closingDate = parseISO(project.closingDate);
                    const today = new Date();
                    
                    if (today >= closingDate) return '100% - Closing reached';
                    
                    const totalDuration = differenceInDays(closingDate, startDate);
                    const elapsed = differenceInDays(today, startDate);
                    const percentage = Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100)));
                    
                    return `${percentage}% elapsed`;
                  })()}
                </div>
              </div>
              
              <div className="h-3 bg-gray-200 rounded-full relative overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${(() => {
                      const startDate = parseISO(project.psaSignedDate || (project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt) || new Date().toISOString());
                      const closingDate = parseISO(project.closingDate);
                      const today = new Date();
                      
                      if (today >= closingDate) return 100;
                      
                      const totalDuration = differenceInDays(closingDate, startDate);
                      const elapsed = differenceInDays(today, startDate);
                      return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
                    })()}%`
                  }}
                />
              </div>
            </div>
          )}

          {/* Task Progress Bars */}
          {tasks.filter(t => t.showOnTimeline).length > 0 && (
            <div className="mb-6 space-y-3">
              {tasks.filter(t => t.showOnTimeline).map((task) => (
                <div key={task.id} className="bg-gray-50 rounded-lg p-3 border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${
                        task.status === 'completed' ? 'bg-green-500' :
                        task.status === 'in_progress' ? 'bg-blue-500' :
                        task.status === 'scheduled' ? 'bg-blue-600' :
                        'bg-gray-400'
                      }`} />
                      <span className="text-sm font-medium text-gray-900">{task.title}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {task.assignee || 'Unassigned'}
                    </div>
                  </div>
                  <ProgressBar 
                    task={task} 
                    project={project} 
                    settings={settings}
                    className="shadow-sm"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Simple Timeline Track */}
          <div className="relative mb-6">
            <div className="h-2 bg-gray-200 rounded-full relative overflow-hidden">
              {/* Milestone Markers with Hover Labels */}
              {project.psaSignedDate && (
                <div 
                  className="absolute top-0 transform -translate-x-1/2 z-10 group cursor-pointer"
                  style={{ left: "0%" }}
                  data-testid="milestone-psa"
                >
                  <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-sm -mt-1 hover:scale-110 transition-transform" />
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <div className="text-xs font-medium text-blue-600">PSA Signed</div>
                    <div className="text-xs text-gray-600">{format(parseISO(project.psaSignedDate), 'MMM d, yyyy')}</div>
                  </div>
                </div>
              )}
              {project.ddExpirationDate && (
                <div 
                  className="absolute top-0 transform -translate-x-1/2 z-10 group cursor-pointer"
                  style={{ left: `${getMilestonePosition(project.ddExpirationDate)}%` }}
                  data-testid="milestone-dd-expiration"
                >
                  <div className="w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-sm -mt-1 hover:scale-110 transition-transform" />
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <div className="text-xs font-medium text-amber-600">DD Expiration</div>
                    <div className="text-xs text-gray-600">{format(parseISO(project.ddExpirationDate), 'MMM d, yyyy')}</div>
                  </div>
                </div>
              )}
              {project.closingDate && (
                <div 
                  className="absolute top-0 transform -translate-x-1/2 z-10 group cursor-pointer"
                  style={{ left: "100%" }}
                  data-testid="milestone-closing"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm -mt-1 hover:scale-110 transition-transform" />
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <div className="text-xs font-medium text-green-600">Closing</div>
                    <div className="text-xs text-gray-600">{format(parseISO(project.closingDate), 'MMM d, yyyy')}</div>
                  </div>
                </div>
              )}
              
              {/* Task Dots */}
              {tasks.filter(t => t.showOnTimeline && t.deadline).map((task) => (
                <div
                  key={task.id}
                  className="absolute top-0 transform -translate-x-1/2 z-10 group cursor-pointer"
                  style={{ left: `${getMilestonePosition(task.deadline!)}%` }}
                  data-testid={`task-dot-${task.id}`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm -mt-0.5 hover:scale-110 transition-transform ${
                    task.status === 'completed' ? 'bg-green-500' :
                    task.status === 'in_progress' ? 'bg-blue-500' :
                    task.status === 'scheduled' ? 'bg-blue-600' :
                    'bg-gray-400'
                  }`} />
                  <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <div className="text-xs font-medium text-gray-900">{task.title}</div>
                    <div className="text-xs text-gray-600">{format(parseISO(task.deadline!), 'MMM d, yyyy')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Timeline Legend</h4>
            <ProgressLegend />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}