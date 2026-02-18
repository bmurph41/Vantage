import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, Clock, AlertTriangle, Calendar } from "lucide-react";
import { formatDistanceToNow, isToday, isPast, parseISO, format } from "date-fns";

type TaskItem = {
  id: string;
  type: string;
  subject: string | null;
  description: string;
  status: string | null;
  entityType: string;
  entityId: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  owner?: { id: string; name: string | null; email: string | null } | null;
};

type ActivitiesResponse = {
  items: TaskItem[];
  counts: { overdue: number; today: number; upcoming: number };
};

function TaskCard({ task, onComplete }: { task: TaskItem; onComplete: (id: string) => void }) {
  const isCompleted = task.status === "completed";
  const scheduledDate = task.scheduledAt ? parseISO(task.scheduledAt) : null;
  const isOverdue = scheduledDate && !isCompleted && isPast(scheduledDate) && !isToday(scheduledDate);
  const isDueToday = scheduledDate && isToday(scheduledDate);

  return (
    <Card className={`bg-white border shadow-sm transition-all ${isOverdue ? "border-red-200 bg-red-50/30" : ""} ${isCompleted ? "opacity-60" : "hover:shadow-md"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => {
              if (!isCompleted) onComplete(task.id);
            }}
            disabled={isCompleted}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-medium text-sm ${isCompleted ? "line-through text-gray-400" : "text-gray-900"}`}>
                {task.subject || task.description}
              </span>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs flex-shrink-0">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Overdue
                </Badge>
              )}
              {isDueToday && !isCompleted && (
                <Badge className="text-xs bg-blue-100 text-blue-700 flex-shrink-0">
                  Due Today
                </Badge>
              )}
              <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
                {task.type.replace(/_/g, " ")}
              </Badge>
            </div>
            {task.subject && task.description && (
              <p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="capitalize">{task.entityType}</span>
              {scheduledDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(scheduledDate, "MMM d, yyyy")}
                </span>
              )}
              {task.owner?.name && <span>Assigned to {task.owner.name}</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TasksView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ActivitiesResponse>({
    queryKey: ["/api/crm/activities", { status: "all", limit: 100 }],
    queryFn: async () => {
      const res = await fetch("/api/crm/activities?status=all&limit=100");
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PUT", `/api/crm/activities/${id}`, { status: "completed", completedAt: new Date().toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Task marked as complete" });
    },
    onError: () => {
      toast({ title: "Failed to complete task", variant: "destructive" });
    },
  });

  const { overdueTasks, todayTasks, upcomingTasks, completedTasks } = useMemo(() => {
    if (!data?.items) return { overdueTasks: [], todayTasks: [], upcomingTasks: [], completedTasks: [] };

    const tasks = data.items.filter((a) => a.type === "task" || a.type === "follow_up" || a.type === "deadline");
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const overdueTasks: TaskItem[] = [];
    const todayTasks: TaskItem[] = [];
    const upcomingTasks: TaskItem[] = [];
    const completedTasks: TaskItem[] = [];

    tasks.forEach((task) => {
      if (task.status === "completed") {
        completedTasks.push(task);
        return;
      }

      const scheduled = task.scheduledAt ? parseISO(task.scheduledAt) : null;
      if (!scheduled) {
        upcomingTasks.push(task);
        return;
      }

      if (isPast(scheduled) && !isToday(scheduled)) {
        overdueTasks.push(task);
      } else if (isToday(scheduled)) {
        todayTasks.push(task);
      } else {
        upcomingTasks.push(task);
      }
    });

    overdueTasks.sort((a, b) => {
      const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return dateA - dateB;
    });

    upcomingTasks.sort((a, b) => {
      const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
      const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
      return dateA - dateB;
    });

    return { overdueTasks, todayTasks, upcomingTasks, completedTasks };
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const totalTasks = overdueTasks.length + todayTasks.length + upcomingTasks.length + completedTasks.length;

  if (totalTasks === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No tasks found</p>
          <p className="text-gray-400 text-xs mt-1">Tasks and follow-ups will appear here when created</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-white border shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-gray-500">Overdue</p>
            <p className={`text-lg font-bold ${overdueTasks.length > 0 ? "text-red-600" : "text-gray-900"}`}>
              {overdueTasks.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-gray-500">Due Today</p>
            <p className="text-lg font-bold text-blue-600">{todayTasks.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-gray-500">Upcoming</p>
            <p className="text-lg font-bold text-green-600">{upcomingTasks.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium text-gray-500">Completed</p>
            <p className="text-lg font-bold text-gray-600">{completedTasks.length}</p>
          </CardContent>
        </Card>
      </div>

      {overdueTasks.length > 0 && (
        <div>
          <CardHeader className="px-0 pt-0 pb-2">
            <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Overdue ({overdueTasks.length})
            </CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {overdueTasks.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={(id) => completeMutation.mutate(id)} />
            ))}
          </div>
        </div>
      )}

      {todayTasks.length > 0 && (
        <div>
          <CardHeader className="px-0 pt-0 pb-2">
            <CardTitle className="text-sm font-semibold text-blue-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Due Today ({todayTasks.length})
            </CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={(id) => completeMutation.mutate(id)} />
            ))}
          </div>
        </div>
      )}

      {upcomingTasks.length > 0 && (
        <div>
          <CardHeader className="px-0 pt-0 pb-2">
            <CardTitle className="text-sm font-semibold text-green-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Upcoming ({upcomingTasks.length})
            </CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {upcomingTasks.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={(id) => completeMutation.mutate(id)} />
            ))}
          </div>
        </div>
      )}

      {completedTasks.length > 0 && (
        <div>
          <CardHeader className="px-0 pt-0 pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Completed ({completedTasks.length})
            </CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={(id) => completeMutation.mutate(id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
