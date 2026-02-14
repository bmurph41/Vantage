import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Search, 
  Plus, 
  Calendar as CalendarIcon,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  X,
  Handshake,
  Home,
  FolderOpen,
} from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task } from "@shared/schema";

const TASK_COLUMNS = [
  { id: "pending", name: "To-Do", color: "#6366f1", icon: Clock },
  { id: "in_progress", name: "In Progress", color: "#f59e0b", icon: AlertCircle },
  { id: "completed", name: "Done", color: "#10b981", icon: CheckCircle2 },
  { id: "cancelled", name: "Blocked", color: "#ef4444", icon: X },
] as const;

type TaskStatus = typeof TASK_COLUMNS[number]["id"];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-yellow-500";
    case "low":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

const getPriorityVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (priority) {
    case "urgent":
      return "destructive";
    case "high":
      return "destructive";
    case "medium":
      return "default";
    case "low":
      return "secondary";
    default:
      return "outline";
  }
};

const getInitials = (name?: string) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== "completed";
  const isDueToday = task.dueDate && isToday(new Date(task.dueDate));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`mb-3 ${isDragging ? "opacity-50 scale-105 rotate-1" : ""}`}
      data-testid={`task-card-${task.id}`}
    >
      <Card
        className={`
          cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-200
          ${isDragging ? "shadow-2xl border-blue-400" : "hover:border-blue-200"}
          ${isOverdue ? "border-l-4 border-l-red-500" : ""}
        `}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 
                className="font-semibold text-sm text-gray-900 line-clamp-2 flex-1"
                data-testid={`task-title-${task.id}`}
              >
                {task.title}
              </h4>
              {task.priority && (
                <Badge 
                  variant={getPriorityVariant(task.priority)}
                  className="text-xs flex-shrink-0"
                  data-testid={`task-priority-${task.id}`}
                >
                  {task.priority}
                </Badge>
              )}
            </div>

            {task.description && (
              <p 
                className="text-xs text-gray-600 line-clamp-2"
                data-testid={`task-description-${task.id}`}
              >
                {task.description}
              </p>
            )}

            {task.dueDate && (
              <div 
                className={`flex items-center space-x-1 text-xs ${
                  isOverdue ? "text-red-600 font-semibold" : 
                  isDueToday ? "text-orange-600 font-medium" : 
                  "text-gray-500"
                }`}
                data-testid={`task-due-date-${task.id}`}
              >
                <CalendarIcon className="h-3 w-3" />
                <span>
                  {isOverdue ? "Overdue: " : isDueToday ? "Due today: " : ""}
                  {format(new Date(task.dueDate), "MMM dd, yyyy")}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div 
                className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm"
                data-testid={`task-assignee-${task.id}`}
                title="Assignee"
              >
                {getInitials()}
              </div>
              
              {task.type && task.type !== "task" && (
                <Badge variant="outline" className="text-xs">
                  {task.type}
                </Badge>
              )}
            </div>

            {((task as any).dealId || (task as any).contactId || (task as any).propertyId || (task as any).projectId) && (
              <div className="flex flex-wrap gap-1 pt-1">
                {(task as any).dealId && (
                  <Link href={`/crm/deals/${(task as any).dealId}`} onClick={(e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); window.location.href = `/crm/deals/${(task as any).dealId}`; }}>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-blue-50 gap-0.5">
                      <Handshake className="h-2.5 w-2.5" />
                      Deal
                    </Badge>
                  </Link>
                )}
                {(task as any).contactId && (
                  <Link href={`/crm/contacts/${(task as any).contactId}`} onClick={(e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); window.location.href = `/crm/contacts/${(task as any).contactId}`; }}>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-green-50 gap-0.5">
                      <User className="h-2.5 w-2.5" />
                      Contact
                    </Badge>
                  </Link>
                )}
                {(task as any).propertyId && (
                  <Link href={`/crm/properties/${(task as any).propertyId}`} onClick={(e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); window.location.href = `/crm/properties/${(task as any).propertyId}`; }}>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-purple-50 gap-0.5">
                      <Home className="h-2.5 w-2.5" />
                      Property
                    </Badge>
                  </Link>
                )}
                {(task as any).projectId && (
                  <Link href={`/workspaces/${(task as any).projectId}`} onClick={(e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); window.location.href = `/workspaces/${(task as any).projectId}`; }}>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-orange-50 gap-0.5">
                      <FolderOpen className="h-2.5 w-2.5" />
                      Project
                    </Badge>
                  </Link>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TaskColumnProps {
  column: typeof TASK_COLUMNS[number];
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}

function TaskColumn({ column, tasks, onTaskClick, onAddTask }: TaskColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<string>("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>();
  const { toast } = useToast();

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      priority: string;
      status: string;
      dueDate?: Date;
    }) => {
      const response = await apiRequest("POST", "/api/crm/tasks", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
      toast({ title: "Task created successfully" });
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setNewTaskDueDate(undefined);
      setIsAddingTask(false);
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) {
      toast({ title: "Task title is required", variant: "destructive" });
      return;
    }

    createTaskMutation.mutate({
      title: newTaskTitle,
      description: newTaskDescription || undefined,
      priority: newTaskPriority,
      status: column.id,
      dueDate: newTaskDueDate,
    });
  };

  const Icon = column.icon;

  return (
    <div
      className="flex-shrink-0 w-80 bg-white rounded-lg border border-gray-200 shadow-sm"
      data-testid={`task-column-${column.id}`}
    >
      <div 
        className="px-4 py-3 border-b border-gray-200"
        style={{ 
          backgroundColor: `${column.color}15`,
          borderTopColor: column.color,
          borderTopWidth: "3px",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: column.color }}
            />
            <Icon className="h-4 w-4" style={{ color: column.color }} />
            <h3 
              className="font-semibold text-gray-900 text-sm"
              data-testid={`column-name-${column.id}`}
            >
              {column.name}
            </h3>
            <Badge 
              variant="secondary" 
              className="text-xs"
              data-testid={`column-count-${column.id}`}
            >
              {tasks.length}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setIsAddingTask(!isAddingTask)}
            data-testid={`button-add-task-${column.id}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isAddingTask && (
        <div className="p-3 border-b border-gray-200 bg-gray-50 space-y-2">
          <Input
            placeholder="Task title..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="text-sm"
            data-testid={`input-new-task-title-${column.id}`}
          />
          <Textarea
            placeholder="Description (optional)..."
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            className="text-sm min-h-[60px]"
            data-testid={`input-new-task-description-${column.id}`}
          />
          <div className="flex items-center gap-2">
            <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
              <SelectTrigger className="text-xs h-8" data-testid={`select-new-task-priority-${column.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="text-xs h-8 justify-start"
                  data-testid={`button-due-date-${column.id}`}
                >
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {newTaskDueDate ? format(newTaskDueDate, "MMM dd") : "Due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newTaskDueDate}
                  onSelect={setNewTaskDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleCreateTask}
              disabled={createTaskMutation.isPending}
              className="flex-1"
              data-testid={`button-create-task-${column.id}`}
            >
              {createTaskMutation.isPending ? "Creating..." : "Add Task"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsAddingTask(false);
                setNewTaskTitle("");
                setNewTaskDescription("");
              }}
              data-testid={`button-cancel-task-${column.id}`}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`p-3 min-h-[500px] max-h-[calc(100vh-300px)] overflow-y-auto transition-colors ${
            isOver ? "bg-blue-50" : "bg-gray-50"
          }`}
          data-testid={`column-drop-zone-${column.id}`}
        >
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {isOver ? "Drop here" : (
                column.id === "pending" ? "No pending tasks. Click + to add one." :
                column.id === "in_progress" ? "Nothing in progress. Drag a task here." :
                column.id === "completed" ? "No completed tasks yet." :
                column.id === "cancelled" ? "Nothing blocked. Great!" :
                "No tasks"
              )}
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onClick={() => onTaskClick(task)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function CrmTasks() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterDueDate, setFilterDueDate] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/crm/tasks"],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/crm/tasks/${taskId}`, { status });
      return response.json();
    },
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/crm/tasks"] });
      const previousTasks = queryClient.getQueryData(["/api/crm/tasks"]);

      queryClient.setQueryData(["/api/crm/tasks"], (old: Task[] = []) =>
        old.map((task) =>
          task.id === taskId ? { ...task, status, completed: status === "completed" } : task
        )
      );

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(["/api/crm/tasks"], context.previousTasks);
      }
      toast({ title: "Failed to update task", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/tasks"] });
    },
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchTerm && !task.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (filterPriority !== "all" && task.priority !== filterPriority) {
        return false;
      }
      if (filterType !== "all" && task.type !== filterType) {
        return false;
      }
      if (filterDueDate === "overdue" && task.dueDate) {
        if (!isPast(new Date(task.dueDate)) || task.status === "completed") {
          return false;
        }
      }
      if (filterDueDate === "today" && task.dueDate) {
        if (!isToday(new Date(task.dueDate))) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, searchTerm, filterPriority, filterDueDate, filterType]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      cancelled: [],
    };

    filteredTasks.forEach((task) => {
      const status = task.status as TaskStatus;
      if (grouped[status]) {
        grouped[status].push(task);
      }
    });

    return grouped;
  }, [filteredTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    updateTaskMutation.mutate({ taskId, status: newStatus });
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const overdueTasks = tasks.filter((t) => t.dueDate && isPast(new Date(t.dueDate)) && t.status !== "completed").length;
  const todayTasks = tasks.filter((t) => t.dueDate && isToday(new Date(t.dueDate)) && t.status !== "completed").length;

  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;

  const analytics = useMemo(() => {
    if (totalTasks === 0) return null;
    const completionRate = Math.round((completedTasks / totalTasks) * 100);
    const overdueRatio = Math.round((overdueTasks / totalTasks) * 100);
    const avgTasksPerDay = (completedTasks / 30).toFixed(1);
    const overdueColor = overdueRatio > 25 ? "text-red-600" : overdueRatio >= 10 ? "text-yellow-600" : "text-green-600";
    const overdueBg = overdueRatio > 25 ? "bg-red-100" : overdueRatio >= 10 ? "bg-yellow-100" : "bg-green-100";
    return { completionRate, overdueRatio, avgTasksPerDay, overdueColor, overdueBg };
  }, [totalTasks, completedTasks, overdueTasks]);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div>
                      <Skeleton className="h-6 w-12 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-80 flex-shrink-0">
                <Skeleton className="h-[500px] rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Follow-Ups & Tasks</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage your tasks and track progress across deals</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900" data-testid="metric-total">{totalTasks}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-gray-900">{inProgressTasks}</div>
                  <div className="text-xs text-gray-500">In Progress</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600" data-testid="metric-completed">{completedTasks}</div>
                  <div className="text-xs text-gray-500">Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-red-600" data-testid="metric-overdue">{overdueTasks}</div>
                  <div className="text-xs text-gray-500">Overdue</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <div className="text-xl font-bold text-orange-600" data-testid="metric-today">{todayTasks}</div>
                  <div className="text-xs text-gray-500">Due Today</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-40" data-testid="select-filter-priority">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterDueDate} onValueChange={setFilterDueDate}>
            <SelectTrigger className="w-40" data-testid="select-filter-due-date">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Due Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Due Today</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40" data-testid="select-filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="task">Task</SelectItem>
              <SelectItem value="follow_up">Follow Up</SelectItem>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {analytics && (
          <Card className="mb-4 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Completion Rate</span>
                    <span className="text-sm font-bold text-gray-900">{analytics.completionRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${analytics.completionRate}%` }} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Overdue Ratio</span>
                    <span className={`text-sm font-bold ${analytics.overdueColor}`}>{analytics.overdueRatio}%</span>
                  </div>
                  <div className={`h-2 rounded-full ${analytics.overdueBg}`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        analytics.overdueRatio > 25 ? "bg-red-500" : analytics.overdueRatio >= 10 ? "bg-yellow-500" : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(analytics.overdueRatio, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-gray-500">Avg Tasks/Day</span>
                  <div className="text-xl font-bold text-gray-900">{analytics.avgTasksPerDay}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 h-full">
            {TASK_COLUMNS.map((column) => (
              <TaskColumn
                key={column.id}
                column={column}
                tasks={tasksByStatus[column.id]}
                onTaskClick={setSelectedTask}
                onAddTask={(status) => {}}
              />
            ))}
          </div>

          <DragOverlay>
            {activeId ? (
              <div className="opacity-80">
                <TaskCard 
                  task={tasks.find((t) => t.id === activeId)!} 
                  onClick={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
