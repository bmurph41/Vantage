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
  // Removed floating timeline to prevent scroll issues
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
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
        status: newStatus as any,
        completedAt: newStatus === 'completed' ? new Date() : undefined
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

  // Generate timeline header dates - 7-day intervals from PSA + task dates
  const generateTimelineDates = () => {
    const dates = new Set<number>(); // Use timestamps to avoid duplicates
    
    // Always include start and end dates
    dates.add(projectStart.getTime());
    dates.add(projectEnd.getTime());
    
    // Add 7-day interval tick marks from PSA signed date
    let current = new Date(projectStart);
    while (current <= projectEnd) {
      dates.add(current.getTime());
      current = new Date(current.getTime() + (7 * 24 * 60 * 60 * 1000)); // Add 7 days
    }
    
    // Add milestone dates if they exist
    if (project?.ddExpirationDate) {
      dates.add(parseISO(project.ddExpirationDate).getTime());
    }
    
    // Add important task dates to ensure they have tick marks
    tasks.filter(t => t.showOnTimeline && (!showCriticalPath || t.priority === 'high')).forEach(task => {
      // Add task start dates
      if (task.deadlineType === 'days_after_psa' && task.deadlineDays && project?.psaSignedDate) {
        const psaDate = parseISO(project.psaSignedDate);
        const taskEnd = new Date(psaDate);
        taskEnd.setDate(taskEnd.getDate() + task.deadlineDays);
        dates.add(taskEnd.getTime());
      } else if (task.deadlineType === 'dd_expiration' && project?.ddExpirationDate) {
        dates.add(parseISO(project.ddExpirationDate).getTime());
      } else if (task.startDate) {
        dates.add(parseISO(task.startDate).getTime());
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

                {/* Main Timeline Bar */}
                <div className="relative h-8 bg-gray-200 border border-gray-300">
                  {/* Progress bar showing elapsed time */}
                  <div 
                    className="absolute left-0 top-0 h-full bg-blue-500"
                    style={{ 
                      width: `${Math.min(100, Math.max(0, ((new Date().getTime() - projectStart.getTime()) / (projectEnd.getTime() - projectStart.getTime())) * 100))}%` 
                    }}
                  ></div>

                  {/* Task Progress Overlays */}
                  {tasks.filter(t => t.showOnTimeline && (!showCriticalPath || t.priority === 'high')).map((task, taskIndex) => {
                    const taskProgress = getTaskProgress(task);
                    
                    return (
                      <div 
                        key={task.id} 
                        className="absolute top-0 h-full group"
                        style={{ 
                          left: `${taskProgress.startPosition}%`, 
                          width: `${taskProgress.width}%`
                        }}
                      >
                        {/* Task bar with status color */}
                        <div className={`h-full opacity-80 ${
                          taskProgress.status === 'completed' ? 'bg-green-500' :
                          taskProgress.status === 'overdue' ? 'bg-red-500' :
                          taskProgress.status === 'in_progress' ? 'bg-blue-600' :
                          'bg-gray-400'
                        }`}>
                          {/* Progress within task */}
                          <div 
                            className={`h-full ${
                              taskProgress.status === 'completed' ? 'bg-green-600' :
                              taskProgress.status === 'overdue' ? 'bg-red-600' :
                              taskProgress.status === 'in_progress' ? 'bg-blue-700' :
                              'bg-gray-500'
                            }`}
                            style={{ width: `${taskProgress.progress}%` }}
                          ></div>
                        </div>
                        
                        {/* Hover tooltip */}
                        <div className="absolute -top-10 left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                          <div className="text-xs font-medium text-gray-900 bg-white px-2 py-1 border border-gray-300 shadow whitespace-nowrap rounded">
                            {task.title} - {taskProgress.progress}% complete
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Milestone Markers Below Timeline */}
                <div className="relative mt-2">
                  {/* PSA Signed */}
                  {project.psaSignedDate && (
                    <div 
                      className="absolute transform -translate-x-1/2"
                      style={{ left: '0%', top: '0px' }}
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
                      style={{ left: '100%', top: '0px' }}
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
                  <SelectItem value="to_do">To Do</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
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
                <th className="px-4 py-3 text-left text-sm font-semibold">Payment</th>
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
                      className={`hover:bg-accent/50 transition-colors ${index % 2 === 1 ? 'bg-accent/30' : ''}`}
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
                        <SelectItem value="to_do">To Do</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={task.paymentStatus || 'not_paid'}
                      onValueChange={(value) => handlePaymentStatusChange(task.id, value)}
                    >
                      <SelectTrigger className="w-28" data-testid={`select-payment-${task.id}`}>
                        <SelectValue>
                          {getPaymentStatusBadge(task.paymentStatus || 'not_paid')}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_paid">Not Paid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
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
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground" data-testid="text-no-tasks">
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
