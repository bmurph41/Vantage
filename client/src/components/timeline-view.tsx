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
    <div className="space-y-8" data-testid="timeline-view">
      {/* Professional Header */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-lg shadow-lg border border-slate-700">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Due Diligence Timeline</h1>
              <p className="text-blue-200/80 text-lg">Project milestones and task progress overview</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1">
                <Select value={granularity} onValueChange={setGranularity}>
                  <SelectTrigger className="w-36 bg-transparent border-0 text-white focus:ring-2 focus:ring-blue-400" data-testid="select-granularity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {TIMELINE_GRANULARITIES.map(g => (
                      <SelectItem key={g.value} value={g.value} className="text-white focus:bg-slate-700">{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant={showCriticalPath ? "default" : "ghost"}
                size="lg"
                onClick={() => setShowCriticalPath(!showCriticalPath)}
                className={`${
                  showCriticalPath 
                    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg" 
                    : "bg-white/10 hover:bg-white/20 text-white border-white/20"
                } transition-all duration-200 font-semibold px-6`}
                data-testid="button-critical-path"
              >
                Critical Path
              </Button>
            </div>
          </div>
      
          {/* Enhanced Timeline Header */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <span className="w-1 h-6 bg-blue-400 rounded-full mr-3"></span>
                  Project Timeline Overview
                </h2>
                <div className="text-sm text-blue-200/70 bg-white/5 px-4 py-2 rounded-lg border border-white/10">
                  {tasks.filter(t => t.showOnTimeline).length} Timeline Tasks
                </div>
              </div>
              
              {/* Enhanced Date Headers */}
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 rounded-lg opacity-30"></div>
                <div className="grid gap-2 w-full text-center relative z-10 py-4" style={{ gridTemplateColumns: `repeat(${Math.min(12, timelineDates.length)}, 1fr)` }}>
                  {timelineDates.slice(0, 12).map((date, index) => {
                    const isCurrentPeriod = isToday(date);
                    return (
                      <div key={index} className={`py-3 px-2 rounded-lg transition-all duration-200 ${
                        isCurrentPeriod ? 'bg-blue-500/20 border border-blue-400/30 shadow-lg' : 'hover:bg-white/5'
                      }`} data-testid={`timeline-date-${index}`}>
                        <div className={`text-sm font-bold ${
                          isCurrentPeriod ? 'text-blue-300' : 'text-white'
                        }`}>
                          {format(date, 
                            granularity === 'daily' ? 'MMM d' : 
                            granularity === 'monthly' ? 'MMM' : 
                            granularity === 'weekly' || granularity === 'biweekly' ? 'M/d' : 
                            'M/d'
                          )}
                        </div>
                        {granularity === 'monthly' && (
                          <div className="text-xs text-blue-200/60 mt-1">
                            {format(date, 'yyyy')}
                          </div>
                        )}
                        {isCurrentPeriod && (
                          <div className="text-xs text-blue-300 mt-1 font-medium">Today</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
          
              {/* General Progress Bar - Time Towards Closing */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <span className="w-1 h-5 bg-green-400 rounded-full mr-3"></span>
                    Overall Progress to Closing
                  </h3>
                  <div className="text-sm text-green-200/70 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                    {(() => {
                      if (!project.closingDate) return 'No closing date set';
                      const startDate = parseISO(project.startDate || project.createdAt || new Date().toISOString());
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
                
                <div className="h-4 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-full shadow-inner relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
                  {project.closingDate && (
                    <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full shadow-md transition-all duration-1000 ease-out"
                      style={{
                        width: `${(() => {
                          const startDate = parseISO(project.startDate || project.createdAt || new Date().toISOString());
                          const closingDate = parseISO(project.closingDate);
                          const today = new Date();
                          
                          if (today >= closingDate) return 100;
                          
                          const totalDuration = differenceInDays(closingDate, startDate);
                          const elapsed = differenceInDays(today, startDate);
                          return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
                        })()}%`
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Premium Milestone Timeline */}
              <div className="relative">
                {/* Animated Timeline Track */}
                <div className="h-3 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-full shadow-inner relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/30 via-purple-400/30 to-green-400/30 rounded-full"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                </div>
                
                {/* Enhanced Milestone Markers */}
                <div className="relative -mt-10 mb-8">
                  {project.psaSignedDate && (
                    <div 
                      className="absolute flex flex-col items-center transform -translate-x-1/2 z-20 group"
                      style={{ left: "3%" }}
                      data-testid="milestone-psa"
                    >
                      <div className="relative">
                        <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full border-2 border-white shadow-lg transition-transform duration-200">
                        </div>
                      </div>
                      <div className="mt-3 bg-white shadow-lg rounded-lg border border-slate-200 px-3 py-2 group-hover:shadow-xl transition-shadow duration-200">
                        <div className="text-center">
                          <span className="text-xs font-bold text-blue-600 block">PSA Signed</span>
                          <div className="text-xs text-slate-600 mt-1">{format(parseISO(project.psaSignedDate), 'MMM d, yyyy')}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {project.ddExpirationDate && (
                    <div 
                      className="absolute flex flex-col items-center transform -translate-x-1/2 z-20 group"
                      style={{ left: `${getMilestonePosition(project.ddExpirationDate)}%` }}
                      data-testid="milestone-dd-expiration"
                    >
                      <div className="relative">
                        <div className="w-4 h-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full border-2 border-white shadow-lg transition-transform duration-200">
                        </div>
                      </div>
                      <div className="mt-3 bg-white shadow-lg rounded-lg border border-slate-200 px-3 py-2 group-hover:shadow-xl transition-shadow duration-200">
                        <div className="text-center">
                          <span className="text-xs font-bold text-amber-600 block">DD Expiration</span>
                          <div className="text-xs text-slate-600 mt-1">{format(parseISO(project.ddExpirationDate), 'MMM d, yyyy')}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {project.closingDate && (
                    <div 
                      className="absolute flex flex-col items-center transform -translate-x-1/2 z-20 group"
                      style={{ right: "3%" }}
                      data-testid="milestone-closing"
                    >
                      <div className="relative">
                        <div className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full border-2 border-white shadow-lg transition-transform duration-200">
                        </div>
                      </div>
                      <div className="mt-3 bg-white shadow-lg rounded-lg border border-slate-200 px-3 py-2 group-hover:shadow-xl transition-shadow duration-200">
                        <div className="text-center">
                          <span className="text-xs font-bold text-green-600 block">Closing</span>
                          <div className="text-xs text-slate-600 mt-1">{format(parseISO(project.closingDate), 'MMM d, yyyy')}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task Dots on Timeline */}
      <div className="relative -mt-6 mb-4">
        {tasks.filter(t => t.showOnTimeline).map((task, index) => {
          const taskDeadline = task.deadline;
          if (!taskDeadline) return null;
          
          const taskPosition = getMilestonePosition(taskDeadline);
          
          return (
            <div 
              key={task.id}
              className="absolute flex flex-col items-center transform -translate-x-1/2 z-10 group"
              style={{ left: `${taskPosition}%` }}
              data-testid={`task-dot-${task.id}`}
            >
              <div className="relative">
                <div className={`w-3 h-3 rounded-full border-2 border-white shadow-md transition-transform duration-200 ${
                  task.status === 'completed' ? 'bg-green-500' :
                  task.status === 'in_progress' ? 'bg-blue-500' :
                  task.status === 'scheduled' ? 'bg-orange-500' :
                  'bg-gray-400'
                }`}>
                </div>
              </div>
              <div className="mt-2 bg-white shadow-lg rounded-lg border border-slate-200 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="text-center">
                  <span className="text-xs font-bold text-gray-700 block">{task.title}</span>
                  <div className="text-xs text-slate-600 mt-1">{format(parseISO(taskDeadline), 'MMM d, yyyy')}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Task Progress Bars Below Timeline */}
      <div className="space-y-2 mt-6">
        {tasks.filter(t => t.showOnTimeline).map((task, index) => (
          <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <span className={`w-3 h-3 rounded-full ${
                  task.status === 'completed' ? 'bg-green-500' :
                  task.status === 'in_progress' ? 'bg-blue-500' :
                  task.status === 'scheduled' ? 'bg-orange-500' :
                  'bg-gray-400'
                }`}></span>
                <span className="text-sm font-medium text-gray-900">{task.title}</span>
              </div>
              <span className="text-xs text-gray-500">
                {task.assignee || 'Unassigned'}
              </span>
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

      {/* Enhanced Legend */}
      <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h4 className="text-lg font-semibold text-gray-900">Timeline Legend</h4>
              <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-md border border-gray-200">Progress Indicators</span>
            </div>
            <div className="flex items-center space-x-8">
              <ProgressLegend />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
