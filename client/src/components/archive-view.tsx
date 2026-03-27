import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, RotateCcw, Calendar, User, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task } from "@shared/schema";

interface ArchiveViewProps {
  projectId: string;
}

export function ArchiveView({ projectId }: ArchiveViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [unarchivingTaskId, setUnarchivingTaskId] = useState<string | null>(null);

  // Fetch archived tasks for the project
  const { data: archivedTasks = [], isLoading, error } = useQuery<Task[]>({
    queryKey: ['/api/dd/projects', projectId, 'tasks', 'archived'],
    queryFn: async () => {
      const response = await fetch(`/api/dd/projects/${projectId}/tasks?includeArchived=true`);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const allTasks = await response.json();
      // Filter to only archived tasks
      return allTasks.filter((task: Task) => task.archived);
    },
  });

  // Unarchive task mutation
  const unarchiveTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest('PATCH', `/api/dd/tasks/${taskId}/unarchive`);
    },
    onSuccess: (_, taskId) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({
        queryKey: ['/api/dd/projects', projectId, 'tasks'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/dd/projects', projectId, 'tasks', 'archived'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/dd/projects', projectId],
      });
      
      setUnarchivingTaskId(null);
      toast({
        title: "Task Unarchived",
        description: "The task has been moved back to active tasks.",
      });
    },
    onError: (error) => {
      console.error('Failed to unarchive task:', error);
      setUnarchivingTaskId(null);
      toast({
        title: "Error",
        description: "Failed to unarchive task. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUnarchiveTask = async (taskId: string) => {
    setUnarchivingTaskId(taskId);
    unarchiveTaskMutation.mutate(taskId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-48 mb-4"></div>
            <div className="space-y-3">
              <div className="h-20 bg-muted rounded"></div>
              <div className="h-20 bg-muted rounded"></div>
              <div className="h-20 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Archive className="h-5 w-5 mr-2" />
            Archived Tasks
          </h3>
          <div className="text-center py-8">
            <p className="text-destructive">Failed to load archived tasks. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Archive className="h-5 w-5 mr-2" />
              Archived Tasks
            </div>
            <Badge variant="secondary" className="text-sm">
              {archivedTasks.length} {archivedTasks.length === 1 ? 'task' : 'tasks'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {archivedTasks.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">No Archived Tasks</h3>
              <p className="text-muted-foreground">
                Tasks that are archived will appear here. You can archive tasks using the Archive button on individual tasks.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {archivedTasks.map((task) => (
                <Card key={task.id} className="border border-border bg-muted/20" data-testid={`archived-task-card-${task.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-base font-medium text-foreground line-clamp-1">
                            {task.title}
                          </h4>
                          <Badge 
                            variant={task.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          {task.assignee && (
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              {task.assignee}
                            </div>
                          )}
                          
                          {task.deadline && (
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {format(new Date(task.deadline), 'MM/dd/yyyy')}
                            </div>
                          )}
                          
                          {task.cost && (
                            <div className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-1" />
                              {task.cost}
                            </div>
                          )}
                          
                          {task.archivedAt && (
                            <div className="flex items-center">
                              <Archive className="h-4 w-4 mr-1" />
                              Archived {format(new Date(task.archivedAt), 'MM/dd/yyyy')}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnarchiveTask(task.id)}
                          disabled={unarchivingTaskId === task.id}
                          data-testid={`button-unarchive-${task.id}`}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          {unarchivingTaskId === task.id ? 'Unarchiving...' : 'Unarchive'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </div>
    </div>
  );
}