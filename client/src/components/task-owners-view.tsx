import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, CheckCircle, Clock, PlayCircle, Calendar, AlertTriangle, X, Archive } from "lucide-react";
import { parseISO, isBefore, startOfDay, format } from "date-fns";
import { setDeadlineTo5PM } from "@/lib/date-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task } from "@shared/schema";

interface TaskOwnersViewProps {
  tasks: Task[];
  projectId?: string;
}

interface OwnerStats {
  name: string;
  totalTasks: number;
  notStarted: number;
  engaged: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  overdue: number;
  contributionPercent: number;
  overallProgress: number;
}

export function TaskOwnersView({ tasks, projectId }: TaskOwnersViewProps) {
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedOwnerName, setSelectedOwnerName] = useState<string | null>(null);
  const [archivingTaskId, setArchivingTaskId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Archive task mutation
  const archiveTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest('PATCH', `/api/dd/tasks/${taskId}/archive`);
    },
    onSuccess: (_, taskId) => {
      // Invalidate and refetch tasks if projectId is available
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ['/api/dd/projects', projectId, 'tasks'],
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/dd/projects', projectId],
        });
      }
      
      setArchivingTaskId(null);
      toast({
        title: "Task Archived",
        description: "The task has been moved to the archive.",
      });
    },
    onError: (error) => {
      console.error('Failed to archive task:', error);
      setArchivingTaskId(null);
      toast({
        title: "Error",
        description: "Failed to archive task. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleArchiveTask = async (taskId: string) => {
    setArchivingTaskId(taskId);
    archiveTaskMutation.mutate(taskId);
  };
  // Calculate stats by owner
  const calculateOwnerStats = (): OwnerStats[] => {
    const today = startOfDay(new Date());
    const ownerMap = new Map<string, {
      totalTasks: number;
      notStarted: number;
      engaged: number;
      scheduled: number;
      inProgress: number;
      completed: number;
      overdue: number;
    }>();

    // Count tasks by owner and status
    tasks.forEach(task => {
      const owner = task.assignee || "Unassigned";
      
      if (!ownerMap.has(owner)) {
        ownerMap.set(owner, {
          totalTasks: 0,
          notStarted: 0,
          engaged: 0,
          scheduled: 0,
          inProgress: 0,
          completed: 0,
          overdue: 0,
        });
      }

      const stats = ownerMap.get(owner)!;
      stats.totalTasks++;

      // Check if task is overdue (has deadline and is past due, not completed)
      const isOverdue = task.deadline && 
        task.status !== 'completed' && 
        isBefore(setDeadlineTo5PM(task.deadline), today);

      if (isOverdue) {
        stats.overdue++;
      } else {
        switch (task.status) {
          case 'not_started':
            stats.notStarted++;
            break;
          case 'engaged':
            stats.engaged++;
            break;
          case 'scheduled':
            stats.scheduled++;
            break;
          case 'in_progress':
            stats.inProgress++;
            break;
          case 'completed':
            stats.completed++;
            break;
        }
      }
    });

    const totalDistributedTasks = tasks.length;

    // Convert to OwnerStats array with calculations
    return Array.from(ownerMap.entries()).map(([name, counts]) => {
      const contributionPercent = totalDistributedTasks > 0 
        ? Math.round((counts.totalTasks / totalDistributedTasks) * 100)
        : 0;

      const overallProgress = counts.totalTasks > 0 
        ? Math.round((counts.completed / counts.totalTasks) * 100)
        : 0;

      return {
        name,
        ...counts,
        contributionPercent,
        overallProgress,
      };
    }).sort((a, b) => b.totalTasks - a.totalTasks); // Sort by task count descending
  };

  const ownerStats = calculateOwnerStats();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'in_progress':
        return 'text-blue-600 bg-blue-100';
      case 'engaged':
        return 'text-purple-600 bg-purple-100';
      case 'scheduled':
        return 'text-blue-600 bg-blue-100';
      case 'not_started':
        return 'text-gray-600 bg-gray-100';
      case 'overdue':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'in_progress':
        return <PlayCircle className="w-4 h-4" />;
      case 'engaged':
        return <User className="w-4 h-4" />;
      case 'scheduled':
        return <Calendar className="w-4 h-4" />;
      case 'not_started':
        return <Clock className="w-4 h-4" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  // Get tasks for selected owner
  const getOwnerTasks = (ownerName: string): Task[] => {
    return tasks.filter(task => {
      const taskOwner = task.assignee || "Unassigned";
      return taskOwner === ownerName;
    });
  };

  // Get tasks by status for selected owner
  const getTasksByStatus = (ownerName: string, status: string): Task[] => {
    const today = startOfDay(new Date());
    return tasks.filter(task => {
      const taskOwner = task.assignee || "Unassigned";
      if (taskOwner !== ownerName) return false;
      
      // Check if task is overdue
      const isOverdue = task.deadline && 
        task.status !== 'completed' && 
        isBefore(setDeadlineTo5PM(task.deadline), today);
      
      if (status === 'overdue') {
        return isOverdue;
      } else if (status === 'not_started') {
        return !isOverdue && (task.status === 'not_started' || task.status === 'scheduled');
      } else {
        return !isOverdue && task.status === status;
      }
    });
  };

  // Handle owner name click
  const handleOwnerClick = (ownerName: string) => {
    setSelectedOwner(ownerName);
    setSelectedOwnerName(ownerName);
    setOwnerModalOpen(true);
  };

  // Handle status button click
  const handleStatusClick = (ownerName: string, status: string) => {
    setSelectedOwner(ownerName);
    setSelectedOwnerName(ownerName);
    setSelectedStatus(status);
    setStatusModalOpen(true);
  };

  // Format status name for display
  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'engaged': return 'Engaged';
      case 'not_started': return 'Not Started';
      case 'overdue': return 'Overdue';
      case 'completed': return 'Completed';
      case 'scheduled': return 'Scheduled';
      default: return status;
    }
  };

  return (
    <div className="space-y-6" data-testid="task-owners-view">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Task Owners Overview</h2>
        <Badge variant="outline" className="text-sm">
          Total Tasks: {tasks.length}
        </Badge>
      </div>

      <div className="grid gap-6">
        {ownerStats.map((owner) => (
          <Card key={owner.name} className="overflow-hidden" data-testid={`owner-card-${owner.name}`}>
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle 
                      className="text-lg font-semibold hover:text-primary cursor-pointer transition-colors"
                      onClick={() => handleOwnerClick(owner.name)}
                      data-testid={`owner-name-${owner.name}`}
                    >
                      {owner.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      {owner.totalTasks} tasks • {owner.contributionPercent}% of project
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {owner.overallProgress}%
                  </div>
                  <p className="text-xs text-gray-500">Overall Progress</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">{owner.completed}/{owner.totalTasks} completed</span>
                  </div>
                  <Progress 
                    value={owner.overallProgress} 
                    className="h-2"
                    data-testid={`progress-${owner.name}`}
                  />
                </div>

                {/* Status Breakdown */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div 
                    className={`flex items-center space-x-2 p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor('in_progress')}`}
                    onClick={() => handleStatusClick(owner.name, 'in_progress')}
                    data-testid={`status-in-progress-${owner.name}`}
                  >
                    {getStatusIcon('in_progress')}
                    <div>
                      <div className="font-semibold text-sm" data-testid={`in-progress-${owner.name}`}>
                        {owner.inProgress}
                      </div>
                      <div className="text-xs">In Progress</div>
                    </div>
                  </div>

                  <div 
                    className={`flex items-center space-x-2 p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor('engaged')}`}
                    onClick={() => handleStatusClick(owner.name, 'engaged')}
                    data-testid={`status-engaged-${owner.name}`}
                  >
                    {getStatusIcon('engaged')}
                    <div>
                      <div className="font-semibold text-sm" data-testid={`engaged-${owner.name}`}>
                        {owner.engaged}
                      </div>
                      <div className="text-xs">Engaged</div>
                    </div>
                  </div>

                  <div 
                    className={`flex items-center space-x-2 p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor('not_started')}`}
                    onClick={() => handleStatusClick(owner.name, 'not_started')}
                    data-testid={`status-not-started-${owner.name}`}
                  >
                    {getStatusIcon('not_started')}
                    <div>
                      <div className="font-semibold text-sm" data-testid={`not-started-${owner.name}`}>
                        {owner.notStarted + owner.scheduled}
                      </div>
                      <div className="text-xs">Not Started</div>
                    </div>
                  </div>

                  <div 
                    className={`flex items-center space-x-2 p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor('overdue')}`}
                    onClick={() => handleStatusClick(owner.name, 'overdue')}
                    data-testid={`status-overdue-${owner.name}`}
                  >
                    {getStatusIcon('overdue')}
                    <div>
                      <div className="font-semibold text-sm" data-testid={`overdue-${owner.name}`}>
                        {owner.overdue}
                      </div>
                      <div className="text-xs">Overdue</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {ownerStats.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Task Owners</h3>
              <p className="text-gray-600">
                Tasks haven't been assigned to any team members yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Owner Tasks Modal */}
      <Dialog open={ownerModalOpen} onOpenChange={setOwnerModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Tasks for {selectedOwnerName}</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {selectedOwner && (
              <div className="space-y-4">
                {getOwnerTasks(selectedOwner).map((task) => {
                  const today = startOfDay(new Date());
                  const isOverdue = task.deadline && 
                    task.status !== 'completed' && 
                    isBefore(setDeadlineTo5PM(task.deadline), today);
                  
                  return (
                  <Card key={task.id} className="border-l-4" style={{ borderLeftColor: task.status === 'completed' ? '#10B981' : isOverdue ? '#EF4444' : '#3B82F6' }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline" className={getStatusColor(task.status)}>
                              {getStatusIcon(task.status)}
                              <span className="ml-1">{getStatusDisplayName(task.status)}</span>
                            </Badge>
                            {task.priority && (
                              <Badge variant="outline">
                                Priority: {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                              </Badge>
                            )}
                            {task.deadline && (
                              <Badge variant="outline">
                                Due: {format(parseISO(task.deadline), 'MMM d, yyyy')}
                              </Badge>
                            )}
                            {task.ddCategory && (
                              <Badge variant="outline">
                                {task.ddCategory}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleArchiveTask(task.id)}
                            disabled={archivingTaskId === task.id}
                            data-testid={`button-archive-${task.id}`}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            {archivingTaskId === task.id ? 'Archiving...' : 'Archive'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
                {getOwnerTasks(selectedOwner).length === 0 && (
                  <div className="text-center py-8">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No tasks found for this owner.</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Status Tasks Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedStatus && getStatusIcon(selectedStatus)}
              <span>{selectedStatus && getStatusDisplayName(selectedStatus)} Tasks for {selectedOwnerName}</span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {selectedOwner && selectedStatus && (
              <div className="space-y-4">
                {getTasksByStatus(selectedOwner, selectedStatus).map((task) => {
                  const today = startOfDay(new Date());
                  const isOverdue = task.deadline && 
                    task.status !== 'completed' && 
                    isBefore(setDeadlineTo5PM(task.deadline), today);
                  
                  return (
                  <Card key={task.id} className="border-l-4" style={{ borderLeftColor: task.status === 'completed' ? '#10B981' : isOverdue ? '#EF4444' : '#3B82F6' }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline" className={getStatusColor(task.status)}>
                              {getStatusIcon(task.status)}
                              <span className="ml-1">{getStatusDisplayName(task.status)}</span>
                            </Badge>
                            {task.priority && (
                              <Badge variant="outline">
                                Priority: {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                              </Badge>
                            )}
                            {task.deadline && (
                              <Badge variant="outline">
                                Due: {format(parseISO(task.deadline), 'MMM d, yyyy')}
                              </Badge>
                            )}
                            {task.ddCategory && (
                              <Badge variant="outline">
                                {task.ddCategory}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleArchiveTask(task.id)}
                            disabled={archivingTaskId === task.id}
                            data-testid={`button-archive-${task.id}`}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            {archivingTaskId === task.id ? 'Archiving...' : 'Archive'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
                {getTasksByStatus(selectedOwner, selectedStatus).length === 0 && (
                  <div className="text-center py-8">
                    {selectedStatus && getStatusIcon(selectedStatus)}
                    <p className="text-gray-600 mt-4">No {selectedStatus && getStatusDisplayName(selectedStatus).toLowerCase()} tasks found for this owner.</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}