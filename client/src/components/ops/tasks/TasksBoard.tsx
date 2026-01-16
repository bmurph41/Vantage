import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Clock, 
  User, 
  CheckSquare,
  MoreVertical,
  Calendar
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface TasksBoardProps {
  tasks: any[];
  searchQuery: string;
  viewMode: "board" | "list";
}

const COLUMNS = [
  { id: "todo", title: "To Do", color: "bg-slate-400" },
  { id: "doing", title: "In Progress", color: "bg-blue-500" },
  { id: "done", title: "Done", color: "bg-green-500" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TasksBoard({ tasks, searchQuery, viewMode }: TasksBoardProps) {
  const queryClient = useQueryClient();

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/api/opssos/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opssos/tasks"] });
    },
  });

  const filteredTasks = tasks.filter((task) => {
    if (!searchQuery) return true;
    return (
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {filteredTasks.map((task) => (
          <Card key={task.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckSquare
                    className={`w-5 h-5 ${
                      task.status === "done" ? "text-green-500" : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    <p className={`font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {task.dueAt && (
                    <div className={`flex items-center gap-1 text-sm ${
                      new Date(task.dueAt) < new Date() && task.status !== "done"
                        ? "text-red-500"
                        : "text-muted-foreground"
                    }`}>
                      <Calendar className="w-4 h-4" />
                      {formatDistanceToNow(new Date(task.dueAt), { addSuffix: true })}
                    </div>
                  )}
                  <Badge variant={
                    task.status === "done" ? "default" :
                    task.status === "doing" ? "secondary" : "outline"
                  }>
                    {task.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {COLUMNS.map((column) => {
        const columnTasks = filteredTasks.filter((t) => t.status === column.id);
        return (
          <div key={column.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${column.color}`} />
              <h3 className="font-medium">{column.title}</h3>
              <Badge variant="secondary" className="ml-auto">
                {columnTasks.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[200px] p-2 bg-muted/30 rounded-lg">
              {columnTasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-sm">{task.title}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-2">
                        {task.dueAt && (
                          <div className={`flex items-center gap-1 text-xs ${
                            new Date(task.dueAt) < new Date() && task.status !== "done"
                              ? "text-red-500"
                              : "text-muted-foreground"
                          }`}>
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(task.dueAt))}
                          </div>
                        )}
                        {task.assignedUserName && (
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(task.assignedUserName)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      {task.costCents && (
                        <Badge variant="outline" className="text-xs">
                          ${(task.costCents / 100).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
