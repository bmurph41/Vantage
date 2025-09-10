import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Plus, Upload, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { Task, Project, ProjectSettings } from "@shared/schema";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { AddTaskModal } from "@/components/add-task-modal";
import { differenceInDays, parseISO, format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isToday, isPast, isFuture } from "date-fns";
import { ProgressBar, ProgressLegend } from "./progress-bar";
import { TIMELINE_GRANULARITIES } from "@/types/dd";

interface ThirdPartyReportsProps {
  tasks: Task[];
  projectId: string;
  project?: Project;
  settings?: ProjectSettings | null;
}

export function ThirdPartyReports({ tasks, projectId, project, settings }: ThirdPartyReportsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [granularity, setGranularity] = useState('weekly');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false);
  const [currentTaskInView, setCurrentTaskInView] = useState<string | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const taskRefs = useRef<{ [key: string]: HTMLTableRowElement | null }>({});
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Scroll detection for floating timeline with throttling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const handleScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        const scrollTop = window.scrollY;
        const newIsAtTop = scrollTop < 300; // Consider "at top" if within 300px of top
        
        // Only update if there's actually a change to prevent layout thrashing
        if (newIsAtTop !== isAtTop) {
          setIsAtTop(newIsAtTop);
        }
        
        if (!isTimelineCollapsed && !newIsAtTop) {
          // Find which task is currently in view - only when not at top
          let currentTask = null;
          const viewportTop = scrollTop;
          const viewportBottom = scrollTop + window.innerHeight;
          const viewportCenter = scrollTop + (window.innerHeight * 0.4); // Use 40% down from top instead of center
          
          for (const [taskId, ref] of Object.entries(taskRefs.current)) {
            if (ref) {
              const rect = ref.getBoundingClientRect();
              const elementTop = rect.top + scrollTop;
              const elementBottom = elementTop + rect.height;
              
              // Check if element is in the upper portion of viewport
              if (elementTop <= viewportCenter && elementBottom >= viewportCenter) {
                currentTask = taskId;
                break;
              }
            }
          }
          
          if (currentTask !== currentTaskInView) {
            setCurrentTaskInView(currentTask);
          }
        } else if (newIsAtTop && currentTaskInView) {
          // Clear current task when at top
          setCurrentTaskInView(null);
        }
      }, 16); // Throttle to ~60fps
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isTimelineCollapsed, isAtTop, currentTaskInView]);

  // Register task refs
  const setTaskRef = (taskId: string) => (ref: HTMLTableRowElement | null) => {
    taskRefs.current[taskId] = ref;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      'not_started': 'bg-gray-100 text-gray-800 border-gray-200',
      'in_progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'blocked': 'bg-red-100 text-red-800 border-red-200'
    } as const;

    return (
      <div 
        className={`px-2 py-1 text-xs font-medium border ${colors[status as keyof typeof colors] || colors.not_started}`}
        data-testid={`status-${status}`}
      >
        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </div>
    );
  };

  const getUserInitials = (assignee: string | null) => {
    if (!assignee) return '?';
    return assignee.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getUserColor = (assignee: string | null) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
    if (!assignee) return 'bg-gray-500';
    const hash = assignee.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTask.mutate({
      id: taskId,
      updates: { 
        status: newStatus as any,
        completedAt: newStatus === 'completed' ? new Date() : undefined
      }
    });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask.mutate(taskId);
  };

  const calculateDaysRemaining = (task: Task) => {
    if (task.status === 'completed') return 0;
    
    const today = new Date();
    let deadlineDate: Date;
    
    if (task.deadlineType === 'dd_expiration' && project?.ddExpirationDate) {
      deadlineDate = parseISO(project.ddExpirationDate);
    } else if (task.deadlineType === 'days_after_psa' && task.deadlineDays && project?.psaSignedDate) {
      const psaDate = parseISO(project.psaSignedDate);
      deadlineDate = new Date(psaDate);
      deadlineDate.setDate(deadlineDate.getDate() + task.deadlineDays);
    } else {
      // Fallback to old duration calculation if new fields aren't available
      const startDate = task.startDate 
        ? parseISO(task.startDate) 
        : project?.psaSignedDate 
          ? new Date(parseISO(project.psaSignedDate).getTime() + (task.startOffsetDays || 0) * 24 * 60 * 60 * 1000)
          : today;
      deadlineDate = new Date(startDate.getTime() + (task.durationDays || 7) * 24 * 60 * 60 * 1000);
    }
    
    const daysRemaining = differenceInDays(deadlineDate, today);
    return Math.max(0, daysRemaining);
  };

  // Timeline logic
  const selectedGranularity = TIMELINE_GRANULARITIES.find(g => g.value === granularity) || TIMELINE_GRANULARITIES[1];

  // Calculate timeline bounds - MUST start at PSA and end at Closing
  const projectStart = project?.psaSignedDate ? parseISO(project.psaSignedDate) : new Date();
  const projectEnd = project?.closingDate ? parseISO(project.closingDate) : addDays(projectStart, 120);

  // Generate timeline header dates based on granularity
  const generateTimelineDates = () => {
    switch (granularity) {
      case 'daily':
        return eachDayOfInterval({ start: projectStart, end: projectEnd });
      case 'weekly':
        return eachWeekOfInterval({ start: projectStart, end: projectEnd });
      case 'biweekly':
        const biweeklyDates = [];
        let current = new Date(projectStart);
        while (current <= projectEnd) {
          biweeklyDates.push(new Date(current));
          current.setDate(current.getDate() + 14);
        }
        if (biweeklyDates[biweeklyDates.length - 1] < projectEnd) {
          biweeklyDates.push(new Date(projectEnd));
        }
        return biweeklyDates;
      case 'monthly':
        return eachMonthOfInterval({ start: projectStart, end: projectEnd });
      default:
        return eachWeekOfInterval({ start: projectStart, end: projectEnd });
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

  // Get task progress for timeline
  const getTaskProgress = (task: Task) => {
    if (task.status === 'completed') return { progress: 100, status: 'completed' };
    
    const today = new Date();
    let startDate: Date, endDate: Date;
    
    if (task.deadlineType === 'dd_expiration' && project?.ddExpirationDate) {
      endDate = parseISO(project.ddExpirationDate);
      startDate = project?.psaSignedDate ? parseISO(project.psaSignedDate) : today;
    } else if (task.deadlineType === 'days_after_psa' && task.deadlineDays && project?.psaSignedDate) {
      const psaDate = parseISO(project.psaSignedDate);
      startDate = new Date(psaDate);
      endDate = new Date(psaDate);
      endDate.setDate(endDate.getDate() + task.deadlineDays);
    } else {
      // Fallback calculation
      startDate = task.startDate 
        ? parseISO(task.startDate) 
        : project?.psaSignedDate 
          ? new Date(parseISO(project.psaSignedDate).getTime() + (task.startOffsetDays || 0) * 24 * 60 * 60 * 1000)
          : today;
      endDate = new Date(startDate.getTime() + (task.durationDays || 7) * 24 * 60 * 60 * 1000);
    }
    
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
    
    const isOverdue = today > endDate && task.status !== 'completed';
    const status = isOverdue ? 'overdue' : task.status === 'in_progress' ? 'in_progress' : 'pending';
    
    return { 
      progress, 
      status,
      startPosition: getMilestonePosition(startDate.toISOString()),
      endPosition: getMilestonePosition(endDate.toISOString()),
      width: Math.abs(getMilestonePosition(endDate.toISOString()) - getMilestonePosition(startDate.toISOString()))
    };
  };

  return (
    <Card data-testid="third-party-reports">
      <CardHeader className="bg-primary text-primary-foreground">
        <CardTitle>DD Timeline</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* Professional DD Timeline Section - Collapsible & Floating */}
        <div className={`mb-10 transition-all duration-300 ease-in-out ${
          !isTimelineCollapsed && !isAtTop 
            ? 'fixed top-4 left-4 right-4 z-50 bg-white/95 backdrop-blur-lg border border-gray-200 shadow-xl' 
            : 'bg-white border border-gray-200 shadow-sm'
        }`}>
          {/* Professional Timeline Header */}
          <div className="flex items-center justify-between mb-6 p-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-gray-600 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Project Timeline</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-500"
                  data-testid="button-toggle-timeline"
                >
                  {isTimelineCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
              {!isTimelineCollapsed && (
                <div className="bg-gray-50 border border-gray-200 p-1">
                  <Select value={granularity} onValueChange={setGranularity}>
                    <SelectTrigger className="w-32 bg-transparent border-0 text-sm" data-testid="select-granularity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMELINE_GRANULARITIES.map(g => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {!isTimelineCollapsed && (
              <div className="flex items-center space-x-4">
                <Button
                  variant={showCriticalPath ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowCriticalPath(!showCriticalPath)}
                  className={showCriticalPath ? "bg-gray-800 hover:bg-gray-900 text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}
                  data-testid="button-critical-path"
                >
                  Critical Path
                </Button>
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 border border-gray-200">
                  {tasks.filter(t => t.showOnTimeline).length} Tasks
                  {!isAtTop && currentTaskInView && (
                    <span className="ml-2 text-xs text-gray-500">
                      • {tasks.find(t => t.id === currentTaskInView)?.title.substring(0, 15)}...
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Professional Timeline Track */}
          {!isTimelineCollapsed && project && (
            <div className="bg-white border-t border-gray-200 px-6 pb-6">
              {/* Professional Date Headers */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-700"></div>
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Start</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {format(projectStart, 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div>
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide text-right">Close</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {format(projectEnd, 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div className="w-2 h-2 bg-gray-700"></div>
                  </div>
                </div>
                
                {/* Professional Timeline Container */}
                <div className="bg-gray-50 border border-gray-200 p-4">
                  {/* Date Markers */}
                  <div className="flex justify-between items-end mb-3">
                    {timelineDates.map((date, index) => {
                      const maxTicks = granularity === 'daily' ? 6 : granularity === 'weekly' ? 5 : 4;
                      const shouldShow = index % Math.ceil(timelineDates.length / maxTicks) === 0 || 
                                        index === timelineDates.length - 1 ||
                                        index === 0;
                      
                      if (shouldShow) {
                        return (
                          <div key={index} className="flex flex-col items-center">
                            <div className="text-xs text-gray-600 mb-1">
                              {format(date, granularity === 'daily' ? 'M/d' : granularity === 'monthly' ? 'MMM' : 'M/d')}
                            </div>
                            <div className="w-px h-3 bg-gray-400"></div>
                          </div>
                        );
                      }
                      return <div key={index} className="flex-1"></div>;
                    })}
                  </div>
                  
                  {/* Professional Timeline Track */}
                  <div className="relative h-16 bg-white border border-gray-300 overflow-visible">
                    {/* Base Timeline Line */}
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-400 transform -translate-y-1/2"></div>
                    
                    {/* Vertical Grid Lines */}
                    <div className="absolute inset-0">
                      {timelineDates.map((date, index) => {
                        const maxTicks = granularity === 'daily' ? 6 : granularity === 'weekly' ? 5 : 4;
                        const shouldShow = index % Math.ceil(timelineDates.length / maxTicks) === 0 || 
                                          index === timelineDates.length - 1 ||
                                          index === 0;
                        
                        if (shouldShow && index !== 0 && index !== timelineDates.length - 1) {
                          return (
                            <div 
                              key={index} 
                              className="absolute w-px h-full bg-gray-300" 
                              style={{ left: `${(index / (timelineDates.length - 1)) * 100}%` }}
                            ></div>
                          );
                        }
                        return null;
                      })}
                    </div>

                    {/* Professional Task Progress Bars */}
                    <div className="absolute inset-0 pt-2 pb-2">
                      {tasks.filter(t => {
                        const basicFilter = t.showOnTimeline && (!showCriticalPath || t.priority === 'high');
                        if (isAtTop || !currentTaskInView) {
                          return basicFilter;
                        }
                        return basicFilter && t.id === currentTaskInView;
                      }).map((task, taskIndex) => {
                        const taskProgress = getTaskProgress(task);
                        const yPosition = 4 + (taskIndex * 10);
                        
                        return (
                          <div key={task.id} className="absolute group" style={{ 
                            left: `${taskProgress.startPosition}%`, 
                            width: `${taskProgress.width}%`,
                            top: `${yPosition}px`,
                            height: '8px'
                          }}>
                            <div className="relative h-full">
                              {/* Task Bar */}
                              <div className={`h-full border ${
                                taskProgress.status === 'completed' ? 'bg-green-600 border-green-700' :
                                taskProgress.status === 'overdue' ? 'bg-red-600 border-red-700' :
                                taskProgress.status === 'in_progress' ? 'bg-blue-600 border-blue-700' :
                                'bg-gray-400 border-gray-500'
                              }`}>
                                {/* Progress Fill */}
                                <div 
                                  className={`h-full ${
                                    taskProgress.status === 'completed' ? 'bg-green-700' :
                                    taskProgress.status === 'overdue' ? 'bg-red-700' :
                                    taskProgress.status === 'in_progress' ? 'bg-blue-700' :
                                    'bg-gray-600'
                                  }`}
                                  style={{ width: `${taskProgress.progress}%` }}
                                ></div>
                              </div>
                              
                              {/* Task Label */}
                              <div className="absolute -top-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                <div className="text-xs font-medium text-gray-900 bg-white px-2 py-1 border border-gray-300 shadow whitespace-nowrap">
                                  {task.title}
                                  <div className="text-xs text-gray-600">
                                    {taskProgress.progress}% complete
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Professional Milestone Markers */}
                    <div className="absolute inset-0 flex items-center z-10">
                      {/* PSA Signed - Always at 0% */}
                      {project.psaSignedDate && (
                        <div 
                          className="absolute flex flex-col items-center transform -translate-x-1/2"
                          style={{ left: '0%' }}
                        >
                          <div className="w-4 h-4 bg-gray-700 border-2 border-white shadow"></div>
                          <div className="absolute -bottom-12 bg-white border border-gray-300 shadow px-3 py-1 min-w-max">
                            <div className="text-xs font-semibold text-gray-900">PSA Signed</div>
                            <div className="text-xs text-gray-600">{format(parseISO(project.psaSignedDate), 'MMM d, yyyy')}</div>
                          </div>
                        </div>
                      )}

                      {/* DD Expiration */}
                      {project.ddExpirationDate && (
                        <div 
                          className="absolute flex flex-col items-center transform -translate-x-1/2"
                          style={{ left: `${getMilestonePosition(project.ddExpirationDate)}%` }}
                        >
                          <div className="w-4 h-4 bg-orange-600 border-2 border-white shadow"></div>
                          <div className="absolute -bottom-12 bg-white border border-gray-300 shadow px-3 py-1 min-w-max">
                            <div className="text-xs font-semibold text-gray-900">DD Expiration</div>
                            <div className="text-xs text-gray-600">{format(parseISO(project.ddExpirationDate), 'MMM d, yyyy')}</div>
                          </div>
                        </div>
                      )}

                      {/* Closing - Always at 100% */}
                      {project.closingDate && (
                        <div 
                          className="absolute flex flex-col items-center transform -translate-x-1/2"
                          style={{ left: '100%' }}
                        >
                          <div className="w-4 h-4 bg-gray-700 border-2 border-white shadow"></div>
                          <div className="absolute -bottom-12 bg-white border border-gray-300 shadow px-3 py-1 min-w-max">
                            <div className="text-xs font-semibold text-gray-900">Target Close</div>
                            <div className="text-xs text-gray-600">{format(parseISO(project.closingDate), 'MMM d, yyyy')}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Professional Legend */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-semibold text-gray-900">Legend</h5>
                  <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1">
                    Duration: {differenceInDays(projectEnd, projectStart)} days
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-3">
                  <ProgressLegend />
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Add spacing when timeline is floating - only when actually floating */}
        <div className={`${!isTimelineCollapsed && !isAtTop ? 'pt-28' : ''} transition-all duration-200 ease-in-out`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2"
                  data-testid="input-search"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not_started">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" data-testid="button-import-csv">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button size="sm" onClick={() => setIsAddTaskModalOpen(true)} data-testid="button-add-task">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Reports Table */}
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="tasks-table">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-4 py-3 text-left text-sm font-semibold">Task</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Task Owner</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Company Hired</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Days Remaining</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Completion Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Cost</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTasks.map((task, index) => (
                <tr 
                  key={task.id} 
                  ref={setTaskRef(task.id)}
                  className={`hover:bg-accent/50 transition-colors ${index % 2 === 1 ? 'bg-accent/30' : ''} ${
                    currentTaskInView === task.id ? 'ring-2 ring-blue-300 bg-blue-50' : ''
                  }`}
                  data-testid={`row-task-${task.id}`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium" data-testid={`text-task-title-${task.id}`}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-sm text-muted-foreground" data-testid={`text-task-description-${task.id}`}>
                        {task.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {task.assignee ? (
                      <div className="flex items-center space-x-2" data-testid={`assignee-${task.id}`}>
                        <div className={`w-6 h-6 ${getUserColor(task.assignee)} rounded-full flex items-center justify-center text-xs text-white`}>
                          {getUserInitials(task.assignee)}
                        </div>
                        <span>{task.assignee}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3" data-testid={`text-company-${task.id}`}>
                    {task.companyHired ? (
                      <div>
                        <div className="font-medium">{task.companyHired}</div>
                        {(task.repName || task.repEmail || task.repPhone) && (
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {task.repName && <div>Rep: {task.repName}</div>}
                            {task.repEmail && <div>📧 {task.repEmail}</div>}
                            {task.repPhone && <div>📞 {task.repPhone}</div>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={task.status}
                      onValueChange={(value) => handleStatusChange(task.id, value)}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-status-${task.id}`}>
                        <SelectValue>
                          {getStatusBadge(task.status)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">To Do</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3" data-testid={`text-days-remaining-${task.id}`}>
                    {(() => {
                      const daysRemaining = calculateDaysRemaining(task);
                      if (task.status === 'completed') {
                        return <span className="text-green-600 font-medium">Complete</span>;
                      } else if (daysRemaining === 0) {
                        return <span className="text-red-600 font-medium">Due Today</span>;
                      } else if (daysRemaining < 0) {
                        return <span className="text-red-600 font-medium">Overdue</span>;
                      } else {
                        return <span className={`font-medium ${daysRemaining <= 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                          {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                        </span>;
                      }
                    })()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" data-testid={`text-completion-date-${task.id}`}>
                    {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" data-testid={`text-cost-${task.id}`}>
                    {task.cost || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setEditingTask(task);
                          setIsAddTaskModalOpen(true);
                        }}
                        data-testid={`button-edit-${task.id}`}
                      >
                        Edit
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-${task.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Task</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{task.title}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid={`button-cancel-delete-${task.id}`}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteTask(task.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-${task.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground" data-testid="text-no-tasks">
                    No tasks found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </CardContent>
      
      <AddTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => {
          setIsAddTaskModalOpen(false);
          setEditingTask(null);
        }}
        projectId={projectId}
        editingTask={editingTask}
      />
    </Card>
  );
}
