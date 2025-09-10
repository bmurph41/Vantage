import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ProgressBar, ProgressLegend } from "./progress-bar";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO, isToday, isPast, isFuture } from "date-fns";
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

      {/* Premium Task Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <span className="w-1 h-8 bg-gradient-to-b from-slate-600 to-slate-800 rounded-sm mr-4"></span>
            Timeline Tasks
          </h2>
          <div className="text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
            {tasks.filter(t => t.showOnTimeline && t.status !== 'completed').length} of {tasks.filter(t => t.showOnTimeline).length} active
          </div>
        </div>
        
        <div className="grid gap-6">
          {tasks.filter(t => t.showOnTimeline).map((task, index) => {
            const isPriorityHigh = task.priority === 'high';
            const isCompleted = task.status === 'completed';
            const isBlocked = task.status === 'blocked';
            
            return (
              <Card key={task.id} className={`group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border-l-4 ${
                isPriorityHigh && showCriticalPath ? 'border-l-amber-400 bg-gradient-to-r from-amber-50 to-white shadow-amber-100' :
                isCompleted ? 'border-l-green-500 bg-gradient-to-r from-green-50 to-white' :
                isBlocked ? 'border-l-red-500 bg-gradient-to-r from-red-50 to-white' :
                'border-l-blue-500 bg-gradient-to-r from-blue-50 to-white'
              } relative overflow-hidden`} data-testid={`timeline-task-${task.id}`}>
                
                {/* Subtle Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute inset-0 bg-grid-pattern"></div>
                </div>
                
                <CardContent className="p-8 relative z-10">
                  <div className="space-y-6">
                    {/* Task Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1" data-testid={`timeline-task-name-${task.id}`}>
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className={`text-xl font-bold ${
                            isCompleted ? 'text-green-700' :
                            isBlocked ? 'text-red-700' :
                            'text-gray-900'
                          } group-hover:text-blue-600 transition-colors`}>
                            {task.title}
                          </h3>
                                  {isPriorityHigh && showCriticalPath && (
                            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-md border border-amber-300">CRITICAL</span>
                          )}
                        </div>
                        
                        {/* Enhanced Badges */}
                        <div className="flex items-center space-x-3 text-sm">
                          {task.assignee && (
                            <div className="flex items-center space-x-2 bg-white rounded-full px-4 py-2 shadow-sm border border-gray-200">
                              <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                                {task.assignee.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-700">{task.assignee}</span>
                            </div>
                          )}
                          
                          {task.priority && (
                            <span className={`px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${
                              task.priority === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                              task.priority === 'med' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                              'bg-green-100 text-green-700 border-green-200'
                            }`}>
                              {task.priority === 'high' ? 'HIGH' : task.priority === 'med' ? 'MEDIUM' : 'LOW'}
                            </span>
                          )}
                          
                          {task.status && (
                            <span className={`px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${
                              task.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                              task.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              task.status === 'blocked' ? 'bg-red-100 text-red-800 border-red-200' :
                              'bg-gray-100 text-gray-800 border-gray-200'
                            }`}>
                              {task.status === 'completed' ? 'COMPLETED' :
                               task.status === 'in_progress' ? 'IN PROGRESS' :
                               task.status === 'blocked' ? 'BLOCKED' :
                               'NOT STARTED'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Enhanced Progress Bar */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-600">Progress Timeline</span>
                        <span className="text-gray-500">Hover for details</span>
                      </div>
                      <div className="relative">
                        <ProgressBar 
                          task={task} 
                          project={project} 
                          settings={settings}
                          className={`${showCriticalPath && task.priority === 'high' ? 'ring-2 ring-amber-400 ring-opacity-50 shadow-lg' : 'shadow-md'} group-hover:shadow-xl transition-shadow duration-300`}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
          
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
