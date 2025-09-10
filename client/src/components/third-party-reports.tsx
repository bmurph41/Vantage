import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Plus, Upload, Trash2 } from "lucide-react";
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
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  // Calculate timeline bounds
  const projectStart = project?.psaSignedDate ? parseISO(project.psaSignedDate) : new Date();
  const projectEnd = project?.closingDate ? parseISO(project.closingDate) : addDays(projectStart, 120);

  // Generate timeline header dates
  const generateTimelineDates = () => {
    switch (granularity) {
      case 'daily':
        return eachDayOfInterval({ start: projectStart, end: projectEnd });
      case 'weekly':
      case 'biweekly':
        const weeklyStart = startOfWeek(projectStart);
        const weeklyEnd = projectEnd;
        return eachWeekOfInterval({ start: weeklyStart, end: weeklyEnd });
      case 'monthly':
        const monthlyStart = startOfMonth(projectStart);
        const monthlyEnd = projectEnd;
        return eachMonthOfInterval({ start: monthlyStart, end: monthlyEnd });
      default:
        const defaultStart = startOfWeek(projectStart);
        const defaultEnd = projectEnd;
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
    <Card data-testid="third-party-reports">
      <CardHeader className="bg-primary text-primary-foreground">
        <CardTitle>DD Timeline</CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        {/* DD Timeline Section */}
        <div className="mb-8 space-y-6">
          {/* Timeline Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold text-gray-900">Project Timeline</h3>
              <div className="bg-gray-100 rounded-lg p-1">
                <Select value={granularity} onValueChange={setGranularity}>
                  <SelectTrigger className="w-32 bg-transparent border-0" data-testid="select-granularity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMELINE_GRANULARITIES.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant={showCriticalPath ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCriticalPath(!showCriticalPath)}
                className={showCriticalPath ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                data-testid="button-critical-path"
              >
                Critical Path
              </Button>
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-lg border">
                {tasks.filter(t => t.showOnTimeline).length} Timeline Tasks
              </div>
            </div>
          </div>

          {/* Timeline Track */}
          {project && (
            <div className="bg-gray-50 rounded-lg p-6 border">
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Key Milestones</h4>
                
                {/* Date Headers */}
                <div className="flex justify-between mb-2 text-xs text-gray-500">
                  {timelineDates.slice(0, 8).map((date, index) => (
                    <div key={index}>
                      {format(date, granularity === 'monthly' ? 'MMM yyyy' : 'MMM d')}
                    </div>
                  ))}
                </div>
                
                {/* Timeline Track */}
                <div className="relative h-12 bg-white rounded border shadow-sm overflow-hidden">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex">
                    {timelineDates.slice(0, 8).map((date, index) => (
                      <div key={index} className="flex-1 border-r border-gray-100 last:border-r-0"></div>
                    ))}
                  </div>

                  {/* Milestone markers */}
                  <div className="absolute inset-0 flex items-center">
                    {/* PSA Signed */}
                    {project.psaSignedDate && (
                      <div 
                        className="absolute flex flex-col items-center transform -translate-x-1/2"
                        style={{ left: `${getMilestonePosition(project.psaSignedDate)}%` }}
                      >
                        <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-md"></div>
                        <div className="absolute -bottom-8 bg-white shadow-sm rounded px-2 py-1 border border-gray-200 min-w-max">
                          <div className="text-xs font-semibold text-blue-600">PSA Signed</div>
                          <div className="text-xs text-gray-500">{format(parseISO(project.psaSignedDate), 'MMM d')}</div>
                        </div>
                      </div>
                    )}

                    {/* DD Expiration */}
                    {project.ddExpirationDate && (
                      <div 
                        className="absolute flex flex-col items-center transform -translate-x-1/2"
                        style={{ left: `${getMilestonePosition(project.ddExpirationDate)}%` }}
                      >
                        <div className="w-3 h-3 bg-amber-600 rounded-full border-2 border-white shadow-md"></div>
                        <div className="absolute -bottom-8 bg-white shadow-sm rounded px-2 py-1 border border-gray-200 min-w-max">
                          <div className="text-xs font-semibold text-amber-600">DD Expiration</div>
                          <div className="text-xs text-gray-500">{format(parseISO(project.ddExpirationDate), 'MMM d')}</div>
                        </div>
                      </div>
                    )}

                    {/* Closing */}
                    {project.closingDate && (
                      <div 
                        className="absolute flex flex-col items-center transform -translate-x-1/2"
                        style={{ left: `${getMilestonePosition(project.closingDate)}%` }}
                      >
                        <div className="w-3 h-3 bg-green-600 rounded-full border-2 border-white shadow-md"></div>
                        <div className="absolute -bottom-8 bg-white shadow-sm rounded px-2 py-1 border border-gray-200 min-w-max">
                          <div className="text-xs font-semibold text-green-600">Closing</div>
                          <div className="text-xs text-gray-500">{format(parseISO(project.closingDate), 'MMM d')}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Progress Legend */}
              <div className="mt-8">
                <ProgressLegend />
              </div>
            </div>
          )}
        </div>
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
