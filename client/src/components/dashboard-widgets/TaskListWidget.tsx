import { useQuery, useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

type Task = {
  id: string;
  title: string;
  priority: "low" | "med" | "high";
  status: string;
  dueDate: string | null;
  projectId: string;
  projectName?: string;
};

type Project = {
  id: string;
  name: string;
};

export default function TaskListWidget() {
  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/dd/projects'],
  });

  const projectIds = projects?.map(p => p.id) || [];
  
  const taskQueries = useQueries({
    queries: projectIds.map(projectId => ({
      queryKey: ['/api/dd/projects', projectId, 'tasks'],
      queryFn: async () => {
        const response = await fetch(`/api/dd/projects/${projectId}/tasks`);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        return response.json() as Promise<Task[]>;
      },
      enabled: !!projectId,
    })),
  });

  const isLoading = projectsLoading || taskQueries.some(q => q.isLoading);

  const allTasks = taskQueries
    .flatMap(q => q.data || [])
    .filter(task => task.status !== 'completed')
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'med':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="widget-task-list">
        <CardHeader>
          <CardTitle className="text-sm">Upcoming Tasks</CardTitle>
          <CardDescription className="text-xs">Your next 5 tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allTasks.length === 0) {
    return (
      <Card data-testid="widget-task-list">
        <CardHeader>
          <CardTitle className="text-sm">Upcoming Tasks</CardTitle>
          <CardDescription className="text-xs">Your next 5 tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 text-sm">
            No upcoming tasks
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-task-list">
      <CardHeader>
        <CardTitle className="text-sm">Upcoming Tasks</CardTitle>
        <CardDescription className="text-xs">Your next 5 tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {allTasks.map((task) => (
            <Link
              key={task.id}
              href={`/projects/${task.projectId}`}
              className="block p-2 hover:bg-gray-50 rounded-lg transition-colors"
              data-testid={`task-item-${task.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2 flex-1 min-w-0">
                  {getPriorityIcon(task.priority)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {task.title}
                    </p>
                    {task.dueDate && (
                      <p className="text-xs text-gray-500">
                        Due: {format(new Date(task.dueDate), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs ml-2">
                  {task.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
