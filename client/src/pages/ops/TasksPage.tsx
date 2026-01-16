import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  CheckSquare, 
  Clock, 
  User,
  Calendar,
  MoreVertical
} from "lucide-react";
import { TasksBoard } from "@/components/ops/tasks/TasksBoard";
import { apiRequest } from "@/lib/queryClient";

export default function TasksPage() {
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["/api/opssos/tasks"],
  });

  const todoTasks = tasks?.filter((t: any) => t.status === "todo") || [];
  const doingTasks = tasks?.filter((t: any) => t.status === "doing") || [];
  const doneTasks = tasks?.filter((t: any) => t.status === "done") || [];

  const overdueTasks = tasks?.filter((t: any) => {
    if (!t.dueAt || t.status === "done") return false;
    return new Date(t.dueAt) < new Date();
  }) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Manage tasks and checklists across your deals and assets
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-slate-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">To Do</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todoTasks.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{doingTasks.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{doneTasks.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{overdueTasks.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === "board" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("board")}
          >
            Board
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            List
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading tasks...</div>
      ) : tasks?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No tasks yet</p>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create your first task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TasksBoard
          tasks={tasks || []}
          searchQuery={searchQuery}
          viewMode={viewMode}
        />
      )}
    </div>
  );
}
