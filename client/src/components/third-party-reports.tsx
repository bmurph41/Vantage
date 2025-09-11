import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Upload, Trash2, ChevronUp, ChevronDown, MessageCircle, FileDown } from "lucide-react";
import type { Task, Project, ProjectSettings } from "@shared/schema";
import { useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { useQuery } from "@tanstack/react-query";
import { ddClient } from "@/lib/ddClient";
import { AddTaskModal } from "@/components/add-task-modal";
import { TimelineNotes } from "@/components/timeline-notes";
import { ExportReportModal } from "@/components/export-report-modal";
import { CompanyDetailsModal } from "@/components/company-details-modal";
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
  const [timelineNotesTask, setTimelineNotesTask] = useState<Task | null>(null);
  const [editingCostTaskId, setEditingCostTaskId] = useState<string | null>(null);
  const [editingCostValue, setEditingCostValue] = useState<string>('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<'daysRemaining' | 'cost' | 'deadline' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [companyModalData, setCompanyModalData] = useState<{
    isOpen: boolean;
    companyName: string;
    contactInfo: {
      repName?: string;
      repEmail?: string;
      repPhone?: string;
      companyAddress?: string;
      companyCity?: string;
      companyState?: string;
      companyZip?: string;
    };
  }>({ isOpen: false, companyName: '', contactInfo: {} });

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleSort = (column: 'daysRemaining' | 'cost' | 'deadline') => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending (highest first)
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: 'daysRemaining' | 'cost' | 'deadline') => {
    if (sortColumn !== column) {
      return null;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 ml-1" />
    );
  };

  const calculateDeadlineDate = (task: Task): Date => {
    const today = new Date();
    let deadlineDate: Date;
    
    // First priority: Use direct deadline field if set
    if (task.deadline) {
      deadlineDate = parseISO(task.deadline);
    } else if (task.deadlineType === 'dd_expiration' && project?.ddExpirationDate) {
      deadlineDate = parseISO(project.ddExpirationDate);
    } else if (task.deadlineType === 'days_after_psa' && task.deadlineDays && project?.psaSignedDate) {
      const psaDate = parseISO(project.psaSignedDate);
      deadlineDate = addDays(psaDate, task.deadlineDays);
    } else {
      // Enhanced fallback calculation for tasks without specific deadline types
      const startDate = task.startDate 
        ? parseISO(task.startDate) 
        : project?.psaSignedDate 
          ? addDays(parseISO(project.psaSignedDate), task.startOffsetDays || 0)
          : today;
      
      // Use smart defaults based on priority for task duration
      const defaultDuration = task.priority === 'high' ? 5 : task.priority === 'med' ? 10 : 21;
      
      deadlineDate = addDays(startDate, defaultDuration);
    }
    
    return deadlineDate;
  };

  const calculateDaysRemaining = (task: Task): number | string => {
    if (task.status === 'completed') return 0;
    
    const today = new Date();
    const deadlineDate = calculateDeadlineDate(task);
    
    // Calculate days remaining
    const daysRemaining = differenceInDays(deadlineDate, today);
    
    // Return "Overdue" if negative, otherwise return the number of days
    return daysRemaining < 0 ? "Overdue" : daysRemaining;
  };

  // Calculate progress based on task's specific start date and deadline
  const calculateTaskProgress = (task: Task): number => {
    if (task.status === 'completed') return 100;
    
    const today = new Date();
    
    // Get task's specific start date
    const taskStartDate = task.startDate 
      ? parseISO(task.startDate) 
      : project?.psaSignedDate 
        ? addDays(parseISO(project.psaSignedDate), task.startOffsetDays || 0)
        : today;
    
    // Get task's specific deadline
    const taskDeadlineDate = calculateDeadlineDate(task);
    
    // Calculate total days for this task
    const totalDays = differenceInDays(taskDeadlineDate, taskStartDate);
    
    // Calculate elapsed days
    const elapsedDays = differenceInDays(today, taskStartDate);
    
    // Calculate progress percentage
    if (totalDays <= 0) return 0;
    
    const progress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
    return progress;
  };

  // Removed floating timeline to prevent scroll issues
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  // Split into completed and non-completed tasks with filtering
  const completedTasks = tasks.filter(task => {
    const baseFilter = searchTerm === "" || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.companyHired || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPayment = paymentFilter === "all" || task.paymentStatus === paymentFilter;
    const matchesAssignee = assigneeFilter === "all" || 
      (assigneeFilter === "unassigned" && !task.assignee) ||
      (task.assignee && task.assignee.toLowerCase().includes(assigneeFilter.toLowerCase()));
    const matchesCost = costFilter === "all" ||
      (costFilter === "has_cost" && task.cost && task.cost.trim() !== "") ||
      (costFilter === "no_cost" && (!task.cost || task.cost.trim() === ""));
    const matchesCompletion = completionFilter === "all" ||
      (completionFilter === "completed" && task.completedAt) ||
      (completionFilter === "pending" && !task.completedAt);
    
    return task.status === 'completed' && baseFilter && matchesStatus && matchesPayment && matchesAssignee && matchesCost && matchesCompletion;
  }).sort((a, b) => {
    // Sort completed tasks by completion date, most recent first
    const aCompleted = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bCompleted = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bCompleted - aCompleted;
  });

  const activeTasks = tasks.filter(task => {
    const baseFilter = searchTerm === "" || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.companyHired || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPayment = paymentFilter === "all" || task.paymentStatus === paymentFilter;
    const matchesAssignee = assigneeFilter === "all" || 
      (assigneeFilter === "unassigned" && !task.assignee) ||
      (task.assignee && task.assignee.toLowerCase().includes(assigneeFilter.toLowerCase()));
    const matchesCost = costFilter === "all" ||
      (costFilter === "has_cost" && task.cost && task.cost.trim() !== "") ||
      (costFilter === "no_cost" && (!task.cost || task.cost.trim() === ""));
    const matchesCompletion = completionFilter === "all" ||
      (completionFilter === "completed" && task.completedAt) ||
      (completionFilter === "pending" && !task.completedAt);
    
    return task.status !== 'completed' && baseFilter && matchesStatus && matchesPayment && matchesAssignee && matchesCost && matchesCompletion;
  }).sort((a, b) => {
    // For active tasks, maintain fixed position based on creation order
    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    return aCreated - bCreated; // Oldest first to maintain stable order
  });

  const filteredTasks = [...activeTasks, ...completedTasks];

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

  // Currency formatting utility
  const formatCurrency = (value: string): string => {
    if (!value) return "-";
    
    // If already formatted with $, return as is
    if (value.startsWith("$")) return value;
    
    // Remove any non-numeric characters except decimal points
    const numericValue = value.replace(/[^\d.]/g, "");
    
    // If empty or just a decimal point, return dash
    if (!numericValue || numericValue === ".") return "-";
    
    // Parse as number and format with commas and dollar sign
    const number = parseFloat(numericValue);
    if (isNaN(number)) return value; // Return original if can't parse
    
    // Format with dollar sign and commas, no decimal places for whole numbers
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: number % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(number);
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

  const handleOnSiteInspectionChange = (taskId: string, checked: boolean) => {
    updateTask.mutate({
      id: taskId,
      updates: { 
        requiresOnSiteInspection: checked
      }
    });
  };

  const handleTimelineToggle = (taskId: string, checked: boolean) => {
    updateTask.mutate({
      id: taskId,
      updates: { 
        showOnTimeline: checked
      }
    });
  };

  const handleArchiveTask = (taskId: string) => {
    // Move task to bottom by setting sortOrder to a high value
    const maxSortOrder = Math.max(...tasks.map(t => t.sortOrder || 0));
    updateTask.mutate({
      id: taskId,
      updates: { 
        sortOrder: maxSortOrder + 1000
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

  const handleDateFieldChange = (taskId: string, fieldName: string, newValue: string) => {
    updateTask.mutate({
      id: taskId,
      updates: { 
        [fieldName]: newValue || null
      }
    });
  };

  const getPaymentStatusBadge = (paymentStatus: string) => {
    const colors = {
      'not_paid': 'bg-red-100 text-red-800 border-red-200',
      'paid': 'bg-green-100 text-green-800 border-green-200',
      'no_cost': 'bg-gray-100 text-gray-800 border-gray-200'
    } as const;

    const labels = {
      'not_paid': 'Not Paid',
      'paid': 'Paid',
      'no_cost': 'No Cost'
    } as const;

    return (
      <div 
        className={`px-2 py-1 text-xs font-medium border ${colors[paymentStatus as keyof typeof colors] || colors.not_paid}`}
        data-testid={`payment-status-${paymentStatus}`}
      >
        {labels[paymentStatus as keyof typeof labels] || 'Not Paid'}
      </div>
    );
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask.mutate(taskId);
  };

  // Handle company click to show details modal
  const handleCompanyClick = (task: Task) => {
    if (!task.companyHired) return;
    
    setCompanyModalData({
      isOpen: true,
      companyName: task.companyHired,
      contactInfo: {
        repName: task.repName || undefined,
        repEmail: task.repEmail || undefined,
        repPhone: task.repPhone || undefined,
        companyAddress: task.companyAddress || undefined,
        companyCity: task.companyCity || undefined,
        companyState: task.companyState || undefined,
        companyZip: task.companyZip || undefined,
      },
    });
  };

  // Query for all projects to find company usage
  const { data: allProjects = [] } = useQuery({
    queryKey: ['/api/dd/projects'],
    queryFn: () => ddClient.getProjects(),
    enabled: companyModalData.isOpen,
  });

  // Query for all tasks from all projects when modal is open
  const { data: allTasks = [] } = useQuery({
    queryKey: ['/api/dd/all-tasks', companyModalData.companyName],
    queryFn: async () => {
      if (!companyModalData.isOpen || !companyModalData.companyName) return [];
      
      const tasksPromises = allProjects.map(project => 
        ddClient.getTasks(project.id).catch(() => [])
      );
      const allProjectTasks = await Promise.all(tasksPromises);
      return allProjectTasks.flat();
    },
    enabled: companyModalData.isOpen && allProjects.length > 0,
  });

  // Calculate related projects data for the modal
  const relatedProjectsData = React.useMemo(() => {
    if (!companyModalData.isOpen || !companyModalData.companyName) return [];
    
    const companyTasks = allTasks.filter(task => 
      task.companyHired === companyModalData.companyName
    );
    
    const projectTasksMap = new Map<string, Task[]>();
    companyTasks.forEach(task => {
      if (!projectTasksMap.has(task.projectId)) {
        projectTasksMap.set(task.projectId, []);
      }
      projectTasksMap.get(task.projectId)!.push(task);
    });
    
    return Array.from(projectTasksMap.entries()).map(([projectId, tasks]) => {
      const project = allProjects.find(p => p.id === projectId);
      return project ? { project, tasks } : null;
    }).filter(Boolean) as Array<{ project: any; tasks: Task[]; }>;
  }, [companyModalData.isOpen, companyModalData.companyName, allTasks, allProjects]);

  // Handle updating contact information for all tasks of this company
  const handleContactInfoUpdate = async (newContactInfo: {
    repName?: string;
    repEmail?: string;
    repPhone?: string;
    companyAddress?: string;
    companyCity?: string;
    companyState?: string;
    companyZip?: string;
  }) => {
    if (!companyModalData.companyName) return;
    
    // Find all tasks for this company across all projects
    const companyTasks = allTasks.filter(task => 
      task.companyHired === companyModalData.companyName
    );
    
    // Update each task with the new contact information
    const updatePromises = companyTasks.map(task => 
      updateTask.mutateAsync({
        id: task.id,
        updates: {
          repName: newContactInfo.repName || null,
          repEmail: newContactInfo.repEmail || null,
          repPhone: newContactInfo.repPhone || null,
          companyAddress: newContactInfo.companyAddress || null,
          companyCity: newContactInfo.companyCity || null,
          companyState: newContactInfo.companyState || null,
          companyZip: newContactInfo.companyZip || null,
        }
      })
    );
    
    await Promise.all(updatePromises);
    
    // Update the modal state with new contact info
    setCompanyModalData(prev => ({
      ...prev,
      contactInfo: newContactInfo,
    }));
  };



  // Handle edit task
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsAddTaskModalOpen(true);
  };

  // Handle edit cost
  const handleEditCost = (taskId: string, currentCost: string) => {
    setEditingCostTaskId(taskId);
    setEditingCostValue(currentCost);
  };

  // Handle save cost
  const handleSaveCost = (taskId: string) => {
    const cost = editingCostValue.trim() === '' ? null : editingCostValue;
    updateTask.mutate({
      id: taskId,
      updates: { cost: cost }
    });
    setEditingCostTaskId(null);
    setEditingCostValue('');
  };

  // Get border color class based on task status
  const getTaskBorderColor = (task: Task) => {
    switch (task.status) {
      case 'completed':
        return 'border-green-400';
      case 'in_progress':
        return 'border-blue-400';
      case 'scheduled':
        return 'border-blue-500';
      case 'not_started':
        return 'border-gray-300';
      default:
        return 'border-gray-200';
    }
  };

  return (
    <div>
      <Card data-testid="third-party-reports">
        <CardHeader className="bg-primary text-primary-foreground">
          <CardTitle>DD Timeline</CardTitle>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Header Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Input
                    data-testid="input-search"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="select-status" className="w-48">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger data-testid="select-payment" className="w-48">
                      <SelectValue placeholder="Filter by payment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Payment Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="not_paid">Not Paid</SelectItem>
                      <SelectItem value="no_cost">No Cost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button data-testid="button-add-task" onClick={() => setIsAddTaskModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </div>
            </div>

            {/* Task List */}
            <div className="space-y-3">
              {/* Active Tasks Section */}
              {activeTasks.length > 0 && (
                <>
                  <h3>Active Tasks ({activeTasks.length})</h3>
                  {activeTasks.map((task) => (
                    <div key={task.id} className={`bg-white border ${getTaskBorderColor(task)} border-l-4 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow`}>
                      {/* Header Section */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                          )}
                          
                          {/* Company Badge - Always show either company name or "Internal" */}
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="flex items-center space-x-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                task.companyHired 
                                  ? 'bg-purple-100' 
                                  : 'bg-gray-100'
                              }`}>
                                <span className={`text-xs font-semibold ${
                                  task.companyHired 
                                    ? 'text-purple-600' 
                                    : 'text-gray-600'
                                }`}>
                                  {task.companyHired 
                                    ? task.companyHired.split(' ').map(n => n[0]).join('').toUpperCase()
                                    : 'IN'
                                  }
                                </span>
                              </div>
                              {task.companyHired ? (
                                <button
                                  data-testid={`button-company-${task.id}`}
                                  className="text-sm font-medium text-gray-900 hover:text-primary"
                                  onClick={() => handleCompanyClick(task)}
                                >
                                  {task.companyHired}
                                </button>
                              ) : (
                                <span className="text-sm font-medium text-gray-600">
                                  Internal
                                </span>
                              )}
                            </div>
                            
                            {/* Status Selector - Always visible */}
                            <Select 
                              value={task.status} 
                              onValueChange={(value) => handleStatusChange(task.id, value)}
                            >
                              <SelectTrigger 
                                data-testid={`select-status-${task.id}`} 
                                className="w-32 h-8 text-xs"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {/* Checkboxes - Timeline always visible, On-Site only for external tasks */}
                            <div className="flex items-center space-x-4">
                              {/* Only show On-Site Inspection checkbox for external tasks */}
                              {task.companyHired && (
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`on-site-${task.id}`}
                                    checked={task.requiresOnSiteInspection || false}
                                    onCheckedChange={(checked) => handleOnSiteInspectionChange(task.id, checked as boolean)}
                                    data-testid={`checkbox-on-site-${task.id}`}
                                  />
                                  <label 
                                    htmlFor={`on-site-${task.id}`}
                                    className="text-xs text-gray-600 cursor-pointer"
                                  >
                                    On-Site Inspection
                                  </label>
                                </div>
                              )}
                              
                              {/* Timeline checkbox always visible */}
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`timeline-${task.id}`}
                                  checked={task.showOnTimeline || false}
                                  onCheckedChange={(checked) => handleTimelineToggle(task.id, checked as boolean)}
                                  data-testid={`checkbox-timeline-${task.id}`}
                                />
                                <label 
                                  htmlFor={`timeline-${task.id}`}
                                  className="text-xs text-gray-600 cursor-pointer"
                                >
                                  Show on Timeline
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Cost and Days Remaining - Top Right */}
                        <div className="flex flex-col items-end space-y-3 mr-4">
                          {/* Cost section - only show if paymentStatus is not "no_cost" */}
                          {task.paymentStatus !== 'no_cost' && (
                            <div className="text-center">
                              <label className="block text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Cost</label>
                              <input 
                                type="text" 
                                value={task.cost || ""} 
                                onChange={(e) => handleDateFieldChange(task.id, 'cost', e.target.value)}
                                onBlur={(e) => {
                                  const formatted = formatCurrency(e.target.value);
                                  handleDateFieldChange(task.id, 'cost', formatted);
                                }}
                                placeholder="$0.00"
                                className="w-24 text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                                data-testid={`input-cost-${task.id}`}
                              />
                            </div>
                          )}
                          
                          {/* Days Remaining */}
                          <div className="text-center">
                            <div className="text-sm text-gray-500 mb-1">Days Remaining</div>
                            <div className={`text-base font-bold ${
                              calculateDaysRemaining(task) === "Overdue" ? "text-red-600" : "text-blue-600"
                            }`}>
                              {calculateDaysRemaining(task)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Action Buttons - Right side */}
                        <div className="flex items-center space-x-2 ml-4">
                          <Button
                            data-testid={`button-edit-${task.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTask(task)}
                            className="h-8 w-8 p-0"
                          >
                            ✏️
                          </Button>
                          <Button
                            data-testid={`button-duplicate-${task.id}`}
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            📋
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                data-testid={`button-delete-${task.id}`}
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                🗑️
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
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTask(task.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      {/* Date Fields Section */}
                      <div className={`grid gap-4 pt-4 border-t border-gray-100 ${
                        task.companyHired ? 'grid-cols-4' : 'grid-cols-2'
                      }`}>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deadline</label>
                          <div className="mt-1">
                            {task.deadline ? (
                              <input 
                                type="date" 
                                value={task.deadline} 
                                onChange={!task.companyHired ? (e) => handleDateFieldChange(task.id, 'deadline', e.target.value) : undefined}
                                className={`w-full text-sm border border-gray-200 rounded px-2 py-1 ${
                                  !task.companyHired ? 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500' : 'bg-gray-50'
                                }`}
                                readOnly={!!task.companyHired}
                                data-testid={`input-deadline-${task.id}`}
                              />
                            ) : !task.companyHired ? (
                              <input 
                                type="date" 
                                value=""
                                onChange={(e) => handleDateFieldChange(task.id, 'deadline', e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                data-testid={`input-deadline-${task.id}`}
                              />
                            ) : (
                              <div className="text-sm text-gray-400 italic">mm/dd/yyyy</div>
                            )}
                          </div>
                        </div>
                        
                        {/* Only show Engaged field for external tasks */}
                        {task.companyHired && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Engaged</label>
                            <div className="mt-1">
                              {task.status !== "not_started" ? (
                                <input 
                                  type="date" 
                                  value={task.orderedAt || ""} 
                                  onChange={(e) => handleDateFieldChange(task.id, 'orderedAt', e.target.value)}
                                  className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  data-testid={`input-ordered-${task.id}`}
                                />
                              ) : task.orderedAt ? (
                                <input 
                                  type="date" 
                                  value={task.orderedAt} 
                                  className="w-full text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50"
                                  readOnly
                                />
                              ) : (
                                <div className="text-sm text-gray-400 italic">mm/dd/yyyy</div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Only show On-Site field for external tasks */}
                        {task.companyHired && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">On-Site</label>
                            <div className="mt-1">
                              {task.requiresOnSiteInspection && task.status !== "not_started" ? (
                                <input 
                                  type="date" 
                                  value={task.dateOnSite || ""} 
                                  onChange={(e) => handleDateFieldChange(task.id, 'dateOnSite', e.target.value)}
                                  className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  data-testid={`input-on-site-${task.id}`}
                                />
                              ) : task.dateOnSite ? (
                                <input 
                                  type="date" 
                                  value={task.dateOnSite} 
                                  className="w-full text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50"
                                  readOnly
                                />
                              ) : (
                                <div className="text-sm text-gray-400 italic">mm/dd/yyyy</div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</label>
                          <div className="mt-1">
                            {task.status === "completed" ? (
                              <input 
                                type="date" 
                                value={task.completedAt ? new Date(task.completedAt).toISOString().split('T')[0] : ""} 
                                onChange={(e) => handleDateFieldChange(task.id, 'completedAt', e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                data-testid={`input-completed-${task.id}`}
                              />
                            ) : task.completedAt ? (
                              <input 
                                type="date" 
                                value={new Date(task.completedAt).toISOString().split('T')[0]} 
                                className="w-full text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50"
                                readOnly
                              />
                            ) : (
                              <div className="text-sm text-gray-400 italic">mm/dd/yyyy</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Task Owner and Progress Row */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                        <div className="flex items-center space-x-4">
                          {/* Additional Info */}
                          <div className="flex items-center space-x-4">
                            <button
                              className="px-2 py-1 bg-orange-100 text-orange-700 border border-orange-200 rounded hover:bg-orange-200 transition-colors"
                              onClick={() => project?.ddExpirationDate && handleDateFieldChange(task.id, 'deadline', project.ddExpirationDate)}
                              disabled={!project?.ddExpirationDate}
                              data-testid={`button-dd-exp-${task.id}`}
                              title={project?.ddExpirationDate ? `Set deadline to DD Expiration: ${format(parseISO(project.ddExpirationDate), 'MM/dd/yyyy')}` : 'No DD Expiration date set'}
                            >
                              DD Exp
                            </button>
                            <button
                              className="px-2 py-1 bg-green-100 text-green-700 border border-green-200 rounded hover:bg-green-200 transition-colors"
                              onClick={() => project?.closingDate && handleDateFieldChange(task.id, 'deadline', project.closingDate)}
                              disabled={!project?.closingDate}
                              data-testid={`button-closing-${task.id}`}
                              title={project?.closingDate ? `Set deadline to Closing: ${format(parseISO(project.closingDate), 'MM/dd/yyyy')}` : 'No Closing date set'}
                            >
                              Closing
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Task Owner: {task.assignee || "Unassigned"}</div>
                          <div className="text-xs text-gray-500">Progress: {Math.round(calculateTaskProgress(task))}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Completed Tasks Section */}
              {completedTasks.length > 0 && (
                <>
                  <div className="pt-6">
                    <h3 className="text-lg font-semibold text-gray-600 mb-3 pb-2 border-b border-gray-200">
                      Completed ({completedTasks.length})
                    </h3>
                  </div>
                  {completedTasks.map((task) => (
                <div key={task.id} className={`bg-white border ${getTaskBorderColor(task)} border-l-4 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow`}>
                  {/* Header Section */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      )}
                      
                      {/* Company Badge - Always show either company name or "Internal" */}
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="flex items-center space-x-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            task.companyHired 
                              ? 'bg-purple-100' 
                              : 'bg-gray-100'
                          }`}>
                            <span className={`text-xs font-semibold ${
                              task.companyHired 
                                ? 'text-purple-600' 
                                : 'text-gray-600'
                            }`}>
                              {task.companyHired 
                                ? task.companyHired.split(' ').map(n => n[0]).join('').toUpperCase()
                                : 'IN'
                              }
                            </span>
                          </div>
                          {task.companyHired ? (
                            <button
                              data-testid={`button-company-${task.id}`}
                              className="text-sm font-medium text-gray-900 hover:text-primary"
                              onClick={() => handleCompanyClick(task)}
                            >
                              {task.companyHired}
                            </button>
                          ) : (
                            <span className="text-sm font-medium text-gray-600">
                              Internal
                            </span>
                          )}
                        </div>
                        
                        {/* Status Selector - Always visible */}
                        <Select 
                          value={task.status} 
                          onValueChange={(value) => handleStatusChange(task.id, value)}
                        >
                          <SelectTrigger 
                            data-testid={`select-status-${task.id}`} 
                            className="w-32 h-8 text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_started">Not Started</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {/* Checkboxes - Timeline always visible, On-Site only for external tasks */}
                        <div className="flex items-center space-x-4">
                          {/* Only show On-Site Inspection checkbox for external tasks */}
                          {task.companyHired && (
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`on-site-${task.id}`}
                                checked={task.requiresOnSiteInspection || false}
                                onCheckedChange={(checked) => handleOnSiteInspectionChange(task.id, checked as boolean)}
                                data-testid={`checkbox-on-site-${task.id}`}
                              />
                              <label 
                                htmlFor={`on-site-${task.id}`}
                                className="text-xs text-gray-600 cursor-pointer"
                              >
                                On-Site Inspection
                              </label>
                            </div>
                          )}
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`timeline-${task.id}`}
                              checked={task.showOnTimeline || false}
                              onCheckedChange={(checked) => handleTimelineToggle(task.id, checked as boolean)}
                              data-testid={`checkbox-timeline-${task.id}`}
                            />
                            <label 
                              htmlFor={`timeline-${task.id}`}
                              className="text-xs text-gray-600 cursor-pointer"
                            >
                              Add to Timeline
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Cost and Days Remaining - Top Right */}
                    <div className="flex flex-col items-end space-y-3 mr-4">
                      {/* Cost section - only show if paymentStatus is not "no_cost" */}
                      {task.paymentStatus !== 'no_cost' && (
                        <div className="text-center">
                          <div className="text-sm text-gray-500 mb-1">Cost</div>
                          {editingCostTaskId === task.id ? (
                            <Input
                              data-testid={`input-cost-${task.id}`}
                              type="number"
                              value={editingCostValue}
                              onChange={(e) => setEditingCostValue(e.target.value)}
                              onBlur={() => handleSaveCost(task.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveCost(task.id)}
                              className="w-24 text-sm text-center"
                              autoFocus
                            />
                          ) : (
                            <div 
                              className="text-base font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                              onClick={() => handleEditCost(task.id, task.cost?.toString() || '0')}
                            >
                              {formatCurrency(task.cost || '')}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Days Remaining */}
                      <div className="text-center">
                        <div className="text-sm text-gray-500 mb-1">Days Remaining</div>
                        <div className={`text-base font-bold ${
                          calculateDaysRemaining(task) === "Overdue" ? "text-red-600" : "text-blue-600"
                        }`}>
                          {calculateDaysRemaining(task)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons - Right side */}
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        data-testid={`button-edit-${task.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTask(task)}
                        className="h-8 w-8 p-0"
                      >
                        ✏️
                      </Button>
                      <Button
                        data-testid={`button-duplicate-${task.id}`}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        📋
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            data-testid={`button-delete-${task.id}`}
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            🗑️
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
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTask(task.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  
                  {/* Date Fields Section */}
                  <div className={`grid gap-4 pt-4 border-t border-gray-100 ${
                    task.companyHired ? 'grid-cols-4' : 'grid-cols-2'
                  }`}>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deadline</label>
                      <div className="mt-1">
                        {task.deadline ? (
                          <input 
                            type="date" 
                            value={task.deadline} 
                            onChange={!task.companyHired ? (e) => handleDateFieldChange(task.id, 'deadline', e.target.value) : undefined}
                            className={`w-full text-sm border border-gray-200 rounded px-2 py-1 ${
                              !task.companyHired ? 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500' : 'bg-gray-50'
                            }`}
                            readOnly={!!task.companyHired}
                            data-testid={`input-deadline-${task.id}`}
                          />
                        ) : !task.companyHired ? (
                          <input 
                            type="date" 
                            value=""
                            onChange={(e) => handleDateFieldChange(task.id, 'deadline', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            data-testid={`input-deadline-${task.id}`}
                          />
                        ) : (
                          <div className="text-sm text-gray-400 italic">mm/dd/yyyy</div>
                        )}
                      </div>
                    </div>
                    
                    {/* Only show Engaged field for external tasks */}
                    {task.companyHired && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Engaged</label>
                        <div className="mt-1">
                          {task.status !== "not_started" ? (
                            <input 
                              type="date" 
                              value={task.orderedAt || ""} 
                              onChange={(e) => handleDateFieldChange(task.id, 'orderedAt', e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              data-testid={`input-ordered-${task.id}`}
                            />
                          ) : task.orderedAt ? (
                            <input 
                              type="date" 
                              value={task.orderedAt} 
                              className="w-full text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50"
                              readOnly
                            />
                          ) : (
                            <div className="text-sm text-gray-400 italic">mm/dd/yyyy</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Only show On-Site field for external tasks */}
                    {task.companyHired && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">On-Site</label>
                        <div className="mt-1">
                          {task.requiresOnSiteInspection && task.status !== "not_started" ? (
                            <input 
                              type="date" 
                              value={task.dateOnSite || ""} 
                              onChange={(e) => handleDateFieldChange(task.id, 'dateOnSite', e.target.value)}
                              className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              data-testid={`input-on-site-${task.id}`}
                            />
                          ) : task.dateOnSite ? (
                            <input 
                              type="date" 
                              value={task.dateOnSite} 
                              className="w-full text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50"
                              readOnly
                            />
                          ) : (
                            <div className="text-sm text-gray-400 italic">mm/dd/yyyy</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</label>
                      <div className="mt-1">
                        {task.status === "completed" ? (
                          <input 
                            type="date" 
                            value={task.completedAt ? format(task.completedAt, 'yyyy-MM-dd') : ""} 
                            onChange={(e) => handleDateFieldChange(task.id, 'completedAt', e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            data-testid={`input-completed-${task.id}`}
                          />
                        ) : task.completedAt ? (
                          <input 
                            type="date" 
                            value={format(task.completedAt, 'yyyy-MM-dd')} 
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50"
                            readOnly
                          />
                        ) : (
                          <div className="text-sm text-gray-400 italic">mm/dd/yyyy</div>
                        )}
                      </div>
                      {task.status === "completed" && task.completedAt && (
                        <div className="mt-2">
                          <button
                            onClick={() => handleArchiveTask(task.id)}
                            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 border border-gray-200 rounded hover:bg-gray-200 transition-colors"
                            data-testid={`button-archive-${task.id}`}
                          >
                            Archive
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Additional Info */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                      <button
                        className="px-2 py-1 bg-orange-100 text-orange-700 border border-orange-200 rounded hover:bg-orange-200 transition-colors"
                        onClick={() => project?.ddExpirationDate && handleDateFieldChange(task.id, 'deadline', project.ddExpirationDate)}
                        disabled={!project?.ddExpirationDate}
                        data-testid={`button-dd-exp-${task.id}`}
                        title={project?.ddExpirationDate ? `Set deadline to DD Expiration: ${format(parseISO(project.ddExpirationDate), 'MM/dd/yyyy')}` : 'No DD Expiration date set'}
                      >
                        DD Exp
                      </button>
                      <button
                        className="px-2 py-1 bg-green-100 text-green-700 border border-green-200 rounded hover:bg-green-200 transition-colors"
                        onClick={() => project?.closingDate && handleDateFieldChange(task.id, 'deadline', project.closingDate)}
                        disabled={!project?.closingDate}
                        data-testid={`button-closing-${task.id}`}
                        title={project?.closingDate ? `Set deadline to Closing: ${format(parseISO(project.closingDate), 'MM/dd/yyyy')}` : 'No Closing date set'}
                      >
                        Closing
                      </button>
                    </div>
                    <div className="text-right">
                      <div>Task Owner: {task.assignee || "Unassigned"}</div>
                      <div>Progress: {Math.round(calculateTaskProgress(task))}%</div>
                    </div>
                  </div>
                </div>
              ))}
                </>
              )}
            </div>

          </div>
        </CardContent>
    </Card>

    {/* Add/Edit Task Modal */}
    <AddTaskModal
      isOpen={isAddTaskModalOpen}
      onClose={() => {
        setIsAddTaskModalOpen(false);
        setEditingTask(null);
      }}
      projectId={projectId}
      editingTask={editingTask}
    />

    {/* Company Details Modal */}
    {companyModalData.isOpen && (
      <CompanyDetailsModal
        isOpen={companyModalData.isOpen}
        onClose={() => setCompanyModalData(prev => ({ ...prev, isOpen: false }))}
        companyName={companyModalData.companyName}
        contactInfo={companyModalData.contactInfo}
        relatedProjects={relatedProjectsData}
        onContactInfoUpdate={handleContactInfoUpdate}
      />
    )}

    {/* Export Modal */}
    <ExportReportModal
      isOpen={isExportModalOpen}
      onClose={() => setIsExportModalOpen(false)}
      tasks={filteredTasks}
      project={project}
    />
    </div>
  );
}
