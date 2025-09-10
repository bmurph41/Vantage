import React, { useState, useEffect, useRef } from "react";
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
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [costFilter, setCostFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState("all");
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [granularity, setGranularity] = useState('weekly');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false);
  const [taskDisplay, setTaskDisplay] = useState<'all' | 'critical' | 'none' | 'selected'>('all');
  const [selectedTaskPriorities, setSelectedTaskPriorities] = useState<Set<string>>(new Set(['high', 'med', 'low']));
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<'daysRemaining' | 'cost' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleSort = (column: 'daysRemaining' | 'cost') => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending (highest first)
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: 'daysRemaining' | 'cost') => {
    if (sortColumn !== column) {
      return null;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 ml-1" />
    );
  };
  // Removed floating timeline to prevent scroll issues
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = tasks
    .filter(task => {
      // Search filter (title, description, company hired)
      const matchesSearch = searchTerm === "" || 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.companyHired || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      
      // Payment filter
      const matchesPayment = paymentFilter === "all" || task.paymentStatus === paymentFilter;
      
      // Assignee filter
      const matchesAssignee = assigneeFilter === "all" || 
        (assigneeFilter === "unassigned" && !task.assignee) ||
        (task.assignee && task.assignee.toLowerCase().includes(assigneeFilter.toLowerCase()));
      
      // Cost filter
      const matchesCost = costFilter === "all" ||
        (costFilter === "has_cost" && task.cost && task.cost.trim() !== "") ||
        (costFilter === "no_cost" && (!task.cost || task.cost.trim() === ""));
      
      // Completion filter
      const matchesCompletion = completionFilter === "all" ||
        (completionFilter === "completed" && task.completedAt) ||
        (completionFilter === "pending" && !task.completedAt);
      
      return matchesSearch && matchesStatus && matchesPayment && matchesAssignee && matchesCost && matchesCompletion;
    })
    .sort((a, b) => {
      // If sorting is active, handle that first
      if (sortColumn && sortColumn !== null) {
        let aValue: number;
        let bValue: number;
        
        if (sortColumn === 'daysRemaining') {
          aValue = calculateDaysRemaining(a);
          bValue = calculateDaysRemaining(b);
        } else if (sortColumn === 'cost') {
          // Parse cost as number, treating empty/null as 0
          aValue = a.cost ? parseFloat(a.cost.replace(/[^0-9.-]/g, '')) || 0 : 0;
          bValue = b.cost ? parseFloat(b.cost.replace(/[^0-9.-]/g, '')) || 0 : 0;
        } else {
          aValue = 0;
          bValue = 0;
        }
        
        const result = sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        if (result !== 0) return result;
      }
      
      // Stack completed tasks at bottom, sorted by completion date
      const aCompleted = a.status === 'completed';
      const bCompleted = b.status === 'completed';
      
      // If one is completed and other is not, completed goes to bottom
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      
      // If both are completed, sort by completion date (oldest completed first)
      if (aCompleted && bCompleted) {
        const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return aDate - bDate;
      }
      
      // If both are not completed, maintain original order (by index in original tasks array)
      return tasks.indexOf(a) - tasks.indexOf(b);
    });

  // Removed all scroll detection to prevent glitches

  // Removed task refs to prevent scroll glitches

  const getStatusBadge = (status: string) => {
    const colors = {
      'to_do': 'bg-gray-100 text-gray-800 border-gray-200',
      'scheduled': 'bg-blue-100 text-blue-800 border-blue-200',
      'in_progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'completed': 'bg-green-100 text-green-800 border-green-200',
      // Legacy status values for backward compatibility
      'not_started': 'bg-gray-100 text-gray-800 border-gray-200',
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
        status: newStatus as any
      }
    });
  };

  const handlePaymentStatusChange = (taskId: string, newPaymentStatus: string) => {
    updateTask.mutate({
      id: taskId,
      updates: { 
        paymentStatus: newPaymentStatus as any
      }
    });
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    const colors = {
      'not_paid': 'bg-red-100 text-red-800 border-red-200',
      'paid': 'bg-green-100 text-green-800 border-green-200'
    } as const;

    return (
      <div 
        className={`px-2 py-1 text-xs font-medium border ${colors[paymentStatus as keyof typeof colors] || colors.not_paid}`}
        data-testid={`payment-status-${paymentStatus}`}
      >
        {paymentStatus === 'not_paid' ? 'Not Paid' : 'Paid'}
      </div>
    );
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

  // Generate timeline header dates based on selected granularity + task dates
  const generateTimelineDates = () => {
    const dates = new Set<number>(); // Use timestamps to avoid duplicates
    
    // Always include start and end dates
    dates.add(projectStart.getTime());
    dates.add(projectEnd.getTime());
    
    // Add tick marks based on selected granularity with proper spacing
    const intervalDays = selectedGranularity.days;
    let current = new Date(projectStart);
    
    // Add regular interval tick marks
    while (current < projectEnd) {
      dates.add(current.getTime());
      
      // Calculate next interval date
      const nextDate = new Date(current);
      nextDate.setDate(nextDate.getDate() + intervalDays);
      
      // If next date would exceed project end, we're done with regular intervals
      if (nextDate >= projectEnd) {
        break;
      }
      
      current = nextDate;
    }
    
    // Add milestone dates if they exist
    if (project?.ddExpirationDate) {
      dates.add(parseISO(project.ddExpirationDate).getTime());
    }
    
    // Add important task dates to ensure they have tick marks (when tasks are toggled on timeline)
    tasks.filter(t => t.showOnTimeline && (!showCriticalPath || t.priority === 'high')).forEach(task => {
      // Add task deadline dates
      if (task.deadlineType === 'days_after_psa' && task.deadlineDays && project?.psaSignedDate) {
        const psaDate = parseISO(project.psaSignedDate);
        const taskDeadline = new Date(psaDate);
        taskDeadline.setDate(taskDeadline.getDate() + task.deadlineDays);
        dates.add(taskDeadline.getTime());
      } else if (task.deadlineType === 'dd_expiration' && project?.ddExpirationDate) {
        dates.add(parseISO(project.ddExpirationDate).getTime());
      } else if (task.startDate) {
        // Add both start date and calculated end date if available
        const startDate = parseISO(task.startDate);
        dates.add(startDate.getTime());
        
        if (task.durationDays) {
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + task.durationDays);
          dates.add(endDate.getTime());
        }
      }
      
      // If task has a specific completion date, add that too
      if (task.completedAt) {
        dates.add(new Date(task.completedAt).getTime());
      }
    });
    
    // Convert back to dates and sort chronologically
    return Array.from(dates)
      .map(timestamp => new Date(timestamp))
      .sort((a, b) => a.getTime() - b.getTime());
  };

  const timelineDates = generateTimelineDates();

  // Get milestone positions as percentages
  const getMilestonePosition = (date: string) => {
    const milestoneDate = parseISO(date);
    const totalDuration = projectEnd.getTime() - projectStart.getTime();
    const elapsed = milestoneDate.getTime() - projectStart.getTime();
    return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
  };

  // Get visible tasks based on display filter
  const getVisibleTasks = () => {
    switch (taskDisplay) {
      case 'none':
        return [];
      case 'critical':
        return tasks.filter(t => t.priority === 'high');
      case 'selected':
        return tasks.filter(t => selectedTaskPriorities.has(t.priority));
      case 'all':
      default:
        return tasks;
    }
  };

  // Get task progress for timeline
  const getTaskProgress = (task: Task) => {
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
    
    // Calculate progress
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    let progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
    
    // Determine status
    let status: string;
    if (task.status === 'completed') {
      progress = 100;
      status = 'completed';
    } else if (today > endDate) {
      status = 'overdue';
    } else if (task.status === 'in_progress') {
      status = 'in_progress';
    } else {
      status = 'pending';
    }
    
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
        {/* Professional DD Timeline Section - Static */}
        <div className="mb-10 bg-white border border-gray-200 shadow-sm">
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
                <div className="flex items-center space-x-2">
                  <Select value={taskDisplay} onValueChange={(value) => setTaskDisplay(value as 'all' | 'critical' | 'none' | 'selected')}>
                    <SelectTrigger className="w-32 bg-white border-gray-300 text-sm" data-testid="select-task-display">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tasks</SelectItem>
                      <SelectItem value="critical">Critical Only</SelectItem>
                      <SelectItem value="selected">By Priority</SelectItem>
                      <SelectItem value="none">Hide Tasks</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {taskDisplay === 'selected' && (
                    <div className="flex items-center space-x-1">
                      {['high', 'med', 'low'].map(priority => (
                        <Button
                          key={priority}
                          variant={selectedTaskPriorities.has(priority) ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newSet = new Set(selectedTaskPriorities);
                            if (newSet.has(priority)) {
                              newSet.delete(priority);
                            } else {
                              newSet.add(priority);
                            }
                            setSelectedTaskPriorities(newSet);
                          }}
                          className={`h-6 px-2 text-xs ${
                            priority === 'high' ? 'border-red-300 text-red-700' :
                            priority === 'med' ? 'border-yellow-300 text-yellow-700' :
                            'border-green-300 text-green-700'
                          }`}
                          data-testid={`button-priority-${priority}`}
                        >
                          {priority === 'high' ? 'H' : priority === 'med' ? 'M' : 'L'}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 border border-gray-200">
                  {getVisibleTasks().length} of {tasks.length} Tasks
                </div>
              </div>
            )}
          </div>

          {/* Clean Professional Timeline */}
          {!isTimelineCollapsed && project && (
            <div className="bg-white border-t border-gray-200 px-6 pb-6">
              {/* Start/End Date Headers */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-800"></div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">START</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {format(projectStart, 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide text-right">CLOSE</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {format(projectEnd, 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className="w-3 h-3 bg-gray-800"></div>
                </div>
              </div>

              {/* Timeline Track */}
              <div className="relative mb-8">
                {/* Clean tick marks - only start, milestone, and end */}
                <div className="flex justify-between items-end mb-2">
                  {/* Start date */}
                  <div className="text-xs text-gray-600">
                    {format(projectStart, 'M/d')}
                  </div>
                  
                  {/* DD Expiration date if exists */}
                  {project?.ddExpirationDate && (
                    <div className="text-xs text-gray-600">
                      {format(parseISO(project.ddExpirationDate), 'M/d')}
                    </div>
                  )}
                  
                  {/* End date */}
                  <div className="text-xs text-gray-600">
                    {format(projectEnd, 'M/d')}
                  </div>
                </div>

                {/* Main Timeline Bar with multiple task rows */}
                <div className="space-y-2">
                  {/* Main project progress bar */}
                  <div className="relative h-6 bg-gray-200 border border-gray-300 rounded">
                    <div 
                      className="absolute left-0 top-0 h-full bg-blue-500 rounded-l"
                      style={{ 
                        width: `${Math.min(100, Math.max(0, ((new Date().getTime() - projectStart.getTime()) / (projectEnd.getTime() - projectStart.getTime())) * 100))}%` 
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                      Project Progress
                    </div>
                  </div>

                  {/* Task Progress Overlays - Each task gets its own row */}
                  {getVisibleTasks().length > 0 && (
                    <div className="space-y-1">
                      {getVisibleTasks().map((task, taskIndex) => {
                        const taskProgress = getTaskProgress(task);
                        
                        return (
                          <div key={task.id} className="relative h-4 bg-gray-100 border border-gray-200 rounded group">
                            {/* Task duration bar */}
                            <div 
                              className={`absolute top-0 h-full border border-gray-300 opacity-90 rounded ${
                                task.priority === 'high' ? 'bg-red-200' :
                                task.priority === 'med' ? 'bg-yellow-200' :
                                'bg-green-200'
                              }`}
                              style={{ 
                                left: `${taskProgress.startPosition}%`, 
                                width: `${taskProgress.width}%`
                              }}
                            >
                              {/* Progress within task */}
                              <div 
                                className={`h-full rounded-l ${
                                  taskProgress.status === 'completed' ? 'bg-green-500' :
                                  taskProgress.status === 'overdue' ? 'bg-red-500' :
                                  taskProgress.status === 'in_progress' ? 'bg-blue-500' :
                                  'bg-gray-400'
                                }`}
                                style={{ width: `${taskProgress.progress}%` }}
                              ></div>
                            </div>
                            
                            {/* Task label */}
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-xs font-medium text-gray-700 truncate">
                                {task.title}
                              </span>
                            </div>
                            
                            {/* Priority indicator */}
                            <div className={`absolute right-1 top-1 w-2 h-2 rounded-full ${
                              task.priority === 'high' ? 'bg-red-500' :
                              task.priority === 'med' ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}></div>
                            
                            {/* Enhanced hover tooltip */}
                            <div className="absolute -top-12 left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20 pointer-events-none">
                              <div className="text-xs bg-gray-900 text-white px-3 py-2 rounded shadow-lg whitespace-nowrap">
                                <div className="font-medium">{task.title}</div>
                                <div className="text-gray-300">
                                  Progress: {Math.round(taskProgress.progress)}% • 
                                  Priority: {task.priority.toUpperCase()} • 
                                  Status: {task.status.replace('_', ' ').toUpperCase()}
                                </div>
                                {task.assignee && <div className="text-gray-300">Assigned: {task.assignee}</div>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Milestone Markers Below Timeline */}
                <div className="relative mt-2">
                  {/* PSA Signed */}
                  {project.psaSignedDate && (
                    <div 
                      className="absolute transform -translate-x-1/2"
                      style={{ left: `${getMilestonePosition(project.psaSignedDate)}%`, top: '0px' }}
                    >
                      <div className="w-3 h-3 bg-gray-800 border border-white"></div>
                      <div className="absolute top-4 -translate-x-1/2 left-1/2 min-w-max">
                        <div className="text-xs font-semibold text-gray-900">PSA Signed</div>
                        <div className="text-xs text-gray-600">{format(parseISO(project.psaSignedDate), 'MMM d, yyyy')}</div>
                      </div>
                    </div>
                  )}

                  {/* DD Expiration */}
                  {project.ddExpirationDate && (
                    <div 
                      className="absolute transform -translate-x-1/2"
                      style={{ left: `${getMilestonePosition(project.ddExpirationDate)}%`, top: '0px' }}
                    >
                      <div className="w-3 h-3 bg-orange-500 border border-white"></div>
                      <div className="absolute top-4 -translate-x-1/2 left-1/2 min-w-max">
                        <div className="text-xs font-semibold text-gray-900">DD Expiration</div>
                        <div className="text-xs text-gray-600">{format(parseISO(project.ddExpirationDate), 'MMM d, yyyy')}</div>
                      </div>
                    </div>
                  )}

                  {/* Target Close */}
                  {project.closingDate && (
                    <div 
                      className="absolute transform -translate-x-1/2"
                      style={{ left: `${getMilestonePosition(project.closingDate)}%`, top: '0px' }}
                    >
                      <div className="w-3 h-3 bg-gray-800 border border-white"></div>
                      <div className="absolute top-4 -translate-x-1/2 left-1/2 min-w-max">
                        <div className="text-xs font-semibold text-gray-900">Target Close</div>
                        <div className="text-xs text-gray-600">{format(parseISO(project.closingDate), 'MMM d, yyyy')}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Clean Legend */}
              <div className="mt-16 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-semibold text-gray-900">Legend</h5>
                  <div className="text-xs text-gray-600">
                    Duration: {differenceInDays(projectEnd, projectStart)} days
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-3 bg-blue-500"></div>
                    <span className="text-xs text-gray-700">Time Elapsed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-3 bg-gray-200"></div>
                    <span className="text-xs text-gray-700">Time Remaining</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-3 bg-green-500"></div>
                    <span className="text-xs text-gray-700">Completed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-3 bg-red-500"></div>
                    <span className="text-xs text-gray-700">Overdue</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Task content section */}
        <div>
          <div className="mb-4 space-y-4">
            {/* Search and Primary Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-wrap">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search tasks, companies, descriptions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-80"
                    data-testid="input-search"
                  />
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
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
            
            {/* Filter Row */}
            <div className="flex items-center space-x-3 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="to_do">To Do</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-36" data-testid="select-payment-filter">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="not_paid">Not Paid</SelectItem>
                </SelectContent>
              </Select>

              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-36" data-testid="select-assignee-filter">
                  <SelectValue placeholder="Task Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {Array.from(new Set(tasks.filter(t => t.assignee).map(t => t.assignee))).map((assignee) => (
                    <SelectItem key={assignee} value={assignee || ""}>{assignee}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={costFilter} onValueChange={setCostFilter}>
                <SelectTrigger className="w-32" data-testid="select-cost-filter">
                  <SelectValue placeholder="Cost" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cost</SelectItem>
                  <SelectItem value="has_cost">Has Cost</SelectItem>
                  <SelectItem value="no_cost">No Cost</SelectItem>
                </SelectContent>
              </Select>

              <Select value={completionFilter} onValueChange={setCompletionFilter}>
                <SelectTrigger className="w-36" data-testid="select-completion-filter">
                  <SelectValue placeholder="Completion" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters Button */}
              {(statusFilter !== "all" || paymentFilter !== "all" || assigneeFilter !== "all" || 
                costFilter !== "all" || completionFilter !== "all" || searchTerm !== "") && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setPaymentFilter("all");
                    setAssigneeFilter("all");
                    setCostFilter("all");
                    setCompletionFilter("all");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              )}
            </div>
        </div>

        {/* Reports Table */}
        <div className="border rounded-lg">
          <table className="w-full" data-testid="tasks-table">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-4 py-3 text-left text-sm font-semibold w-[30%]">Task</th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-[20%]">Task Owner</th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-[25%]">Company Hired</th>
                <th className="px-4 py-3 text-left text-sm font-semibold w-[15%]">Status</th>
                <th 
                  className="px-4 py-3 text-left text-sm font-semibold w-[10%] cursor-pointer hover:bg-primary/80 transition-colors"
                  onClick={() => handleSort('daysRemaining')}
                  data-testid="header-days-remaining"
                >
                  <div className="flex items-center">
                    Days Remaining
                    {getSortIcon('daysRemaining')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTasks.map((task, index) => (
                <React.Fragment key={task.id}>
                  <tr 
                    className={`hover:bg-accent/50 transition-colors cursor-pointer ${index % 2 === 1 ? 'bg-accent/30' : ''}`}
                    onClick={() => toggleTaskExpansion(task.id)}
                    data-testid={`row-task-${task.id}`}
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium text-sm leading-tight" title={task.title} data-testid={`text-task-title-${task.id}`}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2" title={task.description} data-testid={`text-task-description-${task.id}`}>
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {task.assignee ? (
                        <div className="flex items-center space-x-2" data-testid={`assignee-${task.id}`}>
                          <div className={`w-6 h-6 ${getUserColor(task.assignee)} rounded-full flex items-center justify-center text-xs text-white flex-shrink-0`}>
                            {getUserInitials(task.assignee)}
                          </div>
                          <span className="text-sm" title={task.assignee}>{task.assignee}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4" data-testid={`text-company-${task.id}`}>
                      {task.companyHired ? (
                        <div>
                          <div className="font-medium text-sm leading-tight" title={task.companyHired}>{task.companyHired}</div>
                          {(task.repName || task.repEmail || task.repPhone) && (
                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                              {task.repName && <div className="truncate" title={`Rep: ${task.repName}`}>Rep: {task.repName}</div>}
                              {task.repEmail && <div className="truncate" title={task.repEmail}>📧 {task.repEmail}</div>}
                              {task.repPhone && <div className="truncate" title={task.repPhone}>📞 {task.repPhone}</div>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={task.status}
                        onValueChange={(value) => handleStatusChange(task.id, value)}
                      >
                        <SelectTrigger className="w-full h-8" data-testid={`select-status-${task.id}`}>
                          <SelectValue>
                            {getStatusBadge(task.status)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="to_do">To Do</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-center" data-testid={`text-days-remaining-${task.id}`}>
                      {(() => {
                        const daysRemaining = calculateDaysRemaining(task);
                        if (task.status === 'completed') {
                          return <span className="text-green-600 font-medium text-sm">Complete</span>;
                        } else if (daysRemaining === 0) {
                          return <span className="text-red-600 font-medium text-sm">Due Today</span>;
                        } else if (daysRemaining < 0) {
                          return <span className="text-red-600 font-medium text-sm">Overdue</span>;
                        } else {
                          return <span className={`font-medium text-sm ${daysRemaining <= 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                            {daysRemaining}d
                          </span>;
                        }
                      })()}
                    </td>
                  </tr>
                  
                  {/* Expanded row with additional details */}
                  {expandedTasks.has(task.id) && (
                    <tr className={`${index % 2 === 1 ? 'bg-accent/30' : 'bg-gray-50'} border-t border-gray-200`}>
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid grid-cols-4 gap-4">
                          {/* Payment Status */}
                          <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1">Payment</label>
                            <Select
                              value={task.paymentStatus || 'not_paid'}
                              onValueChange={(value) => handlePaymentStatusChange(task.id, value)}
                            >
                              <SelectTrigger className="w-full h-8" data-testid={`select-payment-${task.id}`}>
                                <SelectValue>
                                  {getPaymentStatusBadge(task.paymentStatus || 'not_paid')}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_paid">Not Paid</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Cost */}
                          <div>
                            <label 
                              className="text-xs font-medium text-gray-700 block mb-1 cursor-pointer hover:text-gray-900 flex items-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSort('cost');
                              }}
                              data-testid="header-cost"
                            >
                              Cost {getSortIcon('cost')}
                            </label>
                            <div className="text-sm text-gray-900 py-1.5" data-testid={`text-cost-${task.id}`}>
                              {task.cost || '-'}
                            </div>
                          </div>
                          
                          {/* Completion Date */}
                          <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1">Completion Date</label>
                            <Input
                              type="datetime-local"
                              value={task.completedAt ? new Date(task.completedAt).toISOString().slice(0, 16) : ''}
                              onChange={(e) => {
                                const newCompletedAt = e.target.value ? new Date(e.target.value) : undefined;
                                updateTask.mutate({
                                  id: task.id,
                                  updates: { completedAt: newCompletedAt }
                                });
                              }}
                              className="w-full text-xs h-8"
                              data-testid={`input-completion-date-${task.id}`}
                            />
                          </div>
                          
                          {/* Actions */}
                          <div>
                            <label className="text-xs font-medium text-gray-700 block mb-1">Actions</label>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
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
                                    variant="outline" 
                                    size="sm"
                                    className="text-destructive hover:text-destructive h-8 px-2"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`button-delete-${task.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
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
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground" data-testid="text-no-tasks">
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
