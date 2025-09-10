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
    <div className="space-y-6" data-testid="timeline-view">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 rounded-2xl shadow-2xl border border-slate-800">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Due Diligence Timeline</h1>
              <p className="text-blue-200/80 text-lg">Track project milestones and task progress</p>
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
                    ? "bg-amber-500 hover:bg-amber-600 text-amber-900 shadow-lg shadow-amber-500/25" 
                    : "bg-white/10 hover:bg-white/20 text-white border-white/20"
                } transition-all duration-200 font-semibold px-6`}
                data-testid="button-critical-path"
              >
                ⚡ Critical Path
              </Button>
            </div>
          </div>
      
          {/* Enhanced Timeline Header */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-3 animate-pulse"></span>
                  Project Timeline Overview
                </h2>
                <div className="text-sm text-blue-200/70 bg-white/5 px-3 py-1 rounded-full">
                  {tasks.length} Active Tasks
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
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-4 border-white shadow-xl group-hover:scale-110 transition-transform duration-200 flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        </div>
                        <div className="absolute -inset-2 bg-blue-400/20 rounded-full animate-ping group-hover:animate-none"></div>
                      </div>
                      <div className="mt-3 bg-white shadow-xl rounded-lg border border-slate-200 px-4 py-3 group-hover:shadow-2xl transition-shadow duration-200">
                        <div className="text-center">
                          <span className="text-sm font-bold text-blue-600 block">🏁 PSA Signed</span>
                          <div className="text-xs text-slate-600 mt-1 font-medium">{format(parseISO(project.psaSignedDate), 'MMM d, yyyy')}</div>
                          <div className="text-xs text-green-600 mt-1">✓ Completed</div>
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
                        <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full border-4 border-white shadow-xl group-hover:scale-110 transition-transform duration-200 flex items-center justify-center">
                          <div className="text-xs">⚠️</div>
                        </div>
                        <div className="absolute -inset-2 bg-amber-400/20 rounded-full animate-ping group-hover:animate-none"></div>
                      </div>
                      <div className="mt-3 bg-white shadow-xl rounded-lg border border-slate-200 px-4 py-3 group-hover:shadow-2xl transition-shadow duration-200">
                        <div className="text-center">
                          <span className="text-sm font-bold text-amber-600 block">⏰ DD Expiration</span>
                          <div className="text-xs text-slate-600 mt-1 font-medium">{format(parseISO(project.ddExpirationDate), 'MMM d, yyyy')}</div>
                          <div className="text-xs text-amber-600 mt-1">Critical Deadline</div>
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
                        <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full border-4 border-white shadow-xl group-hover:scale-110 transition-transform duration-200 flex items-center justify-center">
                          <div className="text-xs">🎯</div>
                        </div>
                        <div className="absolute -inset-2 bg-green-400/20 rounded-full animate-ping group-hover:animate-none"></div>
                      </div>
                      <div className="mt-3 bg-white shadow-xl rounded-lg border border-slate-200 px-4 py-3 group-hover:shadow-2xl transition-shadow duration-200">
                        <div className="text-center">
                          <span className="text-sm font-bold text-green-600 block">🏠 Closing</span>
                          <div className="text-xs text-slate-600 mt-1 font-medium">{format(parseISO(project.closingDate), 'MMM d, yyyy')}</div>
                          <div className="text-xs text-green-600 mt-1">Final Goal</div>
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <span className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full mr-4"></span>
            Active Tasks
          </h2>
          <div className="text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-full border">
            {tasks.filter(t => t.status !== 'completed').length} of {tasks.length} remaining
          </div>
        </div>
        
        <div className="grid gap-6">
          {tasks.map((task, index) => {
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
                            <div className="animate-pulse">
                              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full border border-amber-300">⚡ CRITICAL</span>
                            </div>
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
                            <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm border ${
                              task.priority === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                              task.priority === 'med' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                              'bg-green-100 text-green-700 border-green-200'
                            }`}>
                              {task.priority === 'high' ? '🔥 HIGH' : task.priority === 'med' ? '⚡ MEDIUM' : '✅ LOW'}
                            </span>
                          )}
                          
                          {task.status && (
                            <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm border ${
                              task.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' :
                              task.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              task.status === 'blocked' ? 'bg-red-100 text-red-800 border-red-200' :
                              'bg-gray-100 text-gray-800 border-gray-200'
                            }`}>
                              {task.status === 'completed' ? '✅ COMPLETED' :
                               task.status === 'in_progress' ? '🔄 IN PROGRESS' :
                               task.status === 'blocked' ? '🚫 BLOCKED' :
                               '⏸️ NOT STARTED'}
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
          
        {tasks.length === 0 && (
          <Card className="border-2 border-dashed border-gray-300" data-testid="text-no-tasks">
            <CardContent className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No Tasks Yet</h3>
                <p className="text-gray-600 mb-6">Add some tasks to see them displayed in the timeline.</p>
                <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200">
                  + Add Your First Task
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Enhanced Legend */}
      <Card className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h4 className="text-lg font-bold text-gray-900">📊 Timeline Legend</h4>
              <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border">Visual Guide</span>
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
