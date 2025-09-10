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
  const [granularity, setGranularity] = useState('weekly');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false);
  const [taskDisplay, setTaskDisplay] = useState<'all' | 'critical' | 'none' | 'selected'>('all');
  const [selectedTaskPriorities, setSelectedTaskPriorities] = useState<Set<string>>(new Set(['high', 'med', 'low']));
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

  const calculateDaysRemaining = (task: Task) => {
    if (task.status === 'completed') return 0;
    
    const today = new Date();
    const deadlineDate = calculateDeadlineDate(task);
    
    // Calculate days remaining
    const daysRemaining = differenceInDays(deadlineDate, today);
    
    // Allow negative values to show overdue tasks, but ensure we have a reasonable calculation
    return daysRemaining;
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
        } else if (sortColumn === 'deadline') {
          // Sort by deadline date
          const aDeadline = calculateDeadlineDate(a);
          const bDeadline = calculateDeadlineDate(b);
          aValue = aDeadline.getTime();
          bValue = bDeadline.getTime();
        } else {
          aValue = 0;
          bValue = 0;
        }
        
        const result = sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        if (result !== 0) return result;
      }
      
      // Always maintain original order (by sortOrder field) regardless of status
      const aSortOrder = a.sortOrder || 0;
      const bSortOrder = b.sortOrder || 0;
      return aSortOrder - bSortOrder;
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
        
        // Use a default task duration for display purposes
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7); // Default to 7 days
        dates.add(endDate.getTime());
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
      endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Default to 7 days
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

  // Get task progress info for timeline
  const getTaskTimelineProgress = (task: Task) => {
    const progress = calculateTaskProgress(task);
    
    // Calculate task start and end positions
    const taskStartDate = task.startDate 
      ? parseISO(task.startDate) 
      : project?.psaSignedDate 
        ? addDays(parseISO(project.psaSignedDate), task.startOffsetDays || 0)
        : new Date();
    
    const taskDeadlineDate = calculateDeadlineDate(task);
    
    const startPosition = getMilestonePosition(taskStartDate.toISOString());
    const endPosition = getMilestonePosition(taskDeadlineDate.toISOString());
    const width = Math.abs(endPosition - startPosition);
    
    return {
      progress,
      status: task.status,
      startPosition,
      endPosition,
      width
    };
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
              <h3>Tasks ({filteredTasks.length})</h3>
              {filteredTasks.map((task) => (
                <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                  {/* Header Section */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                      )}
                      
                      {/* Company Badge */}
                      {task.companyHired && (
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-semibold text-purple-600">
                                {task.companyHired.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                            <button
                              data-testid={`button-company-${task.id}`}
                              className="text-sm font-medium text-gray-900 hover:text-primary"
                              onClick={() => handleCompanyClick(task)}
                            >
                              {task.companyHired}
                            </button>
                          </div>
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
                        </div>
                      )}
                    </div>
                    
                    {/* Days Remaining, Cost and Actions */}
                    <div className="flex items-center space-x-4">
                      {/* Days Remaining */}
                      <div className="text-center">
                        <div className="text-sm text-gray-500">Days Remaining</div>
                        <div className="text-lg font-bold text-blue-600">
                          {calculateDaysRemaining(task)}
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm text-gray-500">Cost</div>
                        {editingCostTaskId === task.id ? (
                          <Input
                            data-testid={`input-cost-${task.id}`}
                            type="number"
                            value={editingCostValue}
                            onChange={(e) => setEditingCostValue(e.target.value)}
                            onBlur={() => handleSaveCost(task.id)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveCost(task.id)}
                            className="w-24 text-center"
                            autoFocus
                          />
                        ) : (
                          <div 
                            className="text-lg font-semibold text-gray-900 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                            onClick={() => handleEditCost(task.id, task.cost?.toString() || '0')}
                          >
                            {formatCurrency(task.cost || '')}
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
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
                  </div>
                  
                  {/* Date Fields Section */}
                  <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deadline</label>
                      <div className="mt-1">
                        {task.deadline ? (
                          <input 
                            type="date" 
                            value={task.deadline} 
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                            readOnly
                          />
                        ) : (
                          <div className="text-sm text-gray-400 italic">mm/dd/yyyy</div>
                        )}
                      </div>
                    </div>
                    
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
            </div>

            {/* Timeline Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Timeline View</h3>
                <Button
                  data-testid="button-toggle-timeline"
                  variant="outline"
                  onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
                >
                  {isTimelineCollapsed ? "Show Timeline" : "Hide Timeline"}
                </Button>
              </div>

              {!isTimelineCollapsed && (
                <div className="space-y-4 border rounded-lg p-4">
                  {/* Timeline Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Select value={granularity} onValueChange={setGranularity}>
                        <SelectTrigger data-testid="select-granularity" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select value={taskDisplay} onValueChange={(value) => setTaskDisplay(value as any)}>
                        <SelectTrigger data-testid="select-task-display" className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tasks</SelectItem>
                          <SelectItem value="critical">Critical Path</SelectItem>
                          <SelectItem value="selected">Selected</SelectItem>
                          <SelectItem value="none">Hide Tasks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Timeline Visualization */}
                  {!isTimelineCollapsed && project && (
                    <div className="relative overflow-x-auto">
                      {/* Date Headers */}
                      <div className="flex items-center h-8 border-b">
                        {timelineDates.map((date, index) => (
                          <div
                            key={index}
                            className="flex-shrink-0 text-xs text-center border-r px-2"
                            style={{ width: `${100 / timelineDates.length}%` }}
                          >
                            {format(new Date(date), granularity === 'daily' ? 'MM/dd' : 'MM/dd')}
                          </div>
                        ))}
                      </div>

                      {/* Project Milestones */}
                      <div className="relative h-12 bg-gray-50 border-b">
                        {/* PSA Signed */}
                        {project.psaSignedDate && (
                          <div
                            className="absolute top-2 w-2 h-8 bg-green-500 rounded"
                            style={{
                              left: `${getMilestonePosition(project.psaSignedDate)}%`
                            }}
                            title={`PSA Signed: ${format(parseISO(project.psaSignedDate), 'MM/dd/yyyy')}`}
                          />
                        )}

                        {/* DD Expiration */}
                        {project.ddExpirationDate && (
                          <div
                            className="absolute top-2 w-2 h-8 bg-orange-500 rounded"
                            style={{
                              left: `${getMilestonePosition(project.ddExpirationDate)}%`
                            }}
                            title={`DD Expiration: ${format(parseISO(project.ddExpirationDate), 'MM/dd/yyyy')}`}
                          />
                        )}

                        {/* Closing Date */}
                        {project.closingDate && (
                          <div
                            className="absolute top-2 w-2 h-8 bg-blue-500 rounded"
                            style={{
                              left: `${getMilestonePosition(project.closingDate)}%`
                            }}
                            title={`Closing: ${format(parseISO(project.closingDate), 'MM/dd/yyyy')}`}
                          />
                        )}
                      </div>

                      {/* Task Bars */}
                      <div className="space-y-1">
                        {getVisibleTasks().map((task, taskIndex) => {
                          const progress = getTaskTimelineProgress(task);
                          return (
                            <div key={task.id} className="relative h-8 border-b">
                              <div className="flex items-center h-full">
                                <div className="w-40 px-2 text-xs truncate">
                                  {task.title}
                                </div>
                                <div className="flex-1 relative">
                                  {/* Task Progress Bar */}
                                  <div
                                    className="absolute top-1 h-6 bg-blue-200 border rounded"
                                    style={{
                                      left: `${progress.startPosition}%`,
                                      width: `${progress.width}%`
                                    }}
                                  >
                                    <div
                                      className="h-full bg-blue-500 rounded"
                                      style={{ width: `${progress.progress}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
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
