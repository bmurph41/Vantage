import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, User, CheckCircle, Clock, ArrowRight, Edit, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TaskFormModal from "@/components/modals/task-form-modal";
import type { Task, Deal, Contact, Company } from "@shared/schema";

interface UpcomingTasksProps {
  showFullView?: boolean;
}

type TaskWithRelations = Task & { 
  deal?: Deal | null; 
  contact?: Contact | null; 
  company?: Company | null;
};

export default function UpcomingTasks({ showFullView = false }: UpcomingTasksProps) {
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery<TaskWithRelations[]>({
    queryKey: ['/api/tasks/upcoming'],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      return await apiRequest('PUT', `/api/tasks/${taskId}`, { completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: "Task updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: "Task deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete task", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleTaskCompletion = (taskId: string, completed: boolean) => {
    updateTaskMutation.mutate({ taskId, completed });
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleDelete = (task: Task) => {
    if (confirm(`Are you sure you want to delete "${task.title}"? This action cannot be undone.`)) {
      deleteTaskMutation.mutate(task.id);
    }
  };

  const handleAdd = () => {
    setEditingTask(null);
    setIsTaskFormOpen(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case 'call': return '📞';
      case 'email': return '📧';
      case 'meeting': return '🤝';
      case 'follow_up': return '🔄';
      default: return '📋';
    }
  };

  const formatDueDate = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    return `In ${diffDays} days`;
  };

  const isOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    return due < now;
  };

  if (isLoading) {
    return (
      <Card className="border border-gray-100">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-lg font-semibold text-gray-900">Upcoming Tasks</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-start space-x-3 p-3 animate-pulse">
                <div className="w-4 h-4 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border border-gray-100" data-testid="upcoming-tasks">
        <CardHeader className="border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">Upcoming Tasks</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary hover:text-primary/80 font-medium"
              onClick={handleAdd}
              data-testid="button-add-task"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {tasks.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming tasks</h3>
                <p className="text-gray-500 mb-6">Create tasks to stay organized and on track</p>
                <Button onClick={handleAdd} data-testid="button-add-first-task">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </div>
            ) : (
              tasks.slice(0, showFullView ? tasks.length : 4).map((task: TaskWithRelations) => (
                <div 
                  key={task.id} 
                  className={`group flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${
                    task.completed ? 'opacity-60' : ''
                  }`}
                  data-testid={`task-${task.id}`}
                >
                  <Checkbox
                    checked={task.completed || false}
                    onCheckedChange={(checked) => handleTaskCompletion(task.id, checked as boolean)}
                    className="mt-1"
                    data-testid={`task-checkbox-${task.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getTaskTypeIcon(task.type)}</span>
                        <h3 
                          className={`font-medium text-gray-900 text-sm ${task.completed ? 'line-through' : ''}`}
                          data-testid={`task-title-${task.id}`}
                        >
                          {task.title}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          className={getPriorityColor(task.priority)}
                          data-testid={`task-priority-${task.id}`}
                        >
                          {task.priority}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(task);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6 hover:bg-gray-100"
                          data-testid={`button-edit-task-${task.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(task);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6 hover:bg-gray-100 text-red-600 hover:text-red-700"
                          data-testid={`button-delete-task-${task.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {(task.deal || task.contact || task.company) && (
                      <p className="text-sm text-gray-600 mb-2" data-testid={`task-related-${task.id}`}>
                        Related to: {task.deal?.title || task.contact?.firstName + ' ' + task.contact?.lastName || task.company?.name}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      {task.dueDate && (
                        <span 
                          className={`flex items-center ${isOverdue(task.dueDate?.toISOString()) ? 'text-red-600' : ''}`}
                          data-testid={`task-due-date-${task.id}`}
                        >
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDueDate(task.dueDate?.toISOString())}
                        </span>
                      )}
                      <span className="flex items-center" data-testid={`task-assignee-${task.id}`}>
                        <User className="w-3 h-3 mr-1" />
                        Assigned to me
                      </span>
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2" data-testid={`task-description-${task.id}`}>
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {!showFullView && tasks.length > 4 && (
            <Button variant="ghost" className="w-full mt-6 text-sm text-gray-500 hover:text-gray-700 py-2" data-testid="button-view-all-tasks">
              View all tasks
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>

      <TaskFormModal
        isOpen={isTaskFormOpen}
        onClose={() => {
          setIsTaskFormOpen(false);
          setEditingTask(null);
        }}
        task={editingTask}
      />
    </>
  );
}
