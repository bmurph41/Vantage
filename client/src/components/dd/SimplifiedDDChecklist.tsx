import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, DollarSign, Search, Scale, FolderCheck,
  CheckCircle2, ChevronDown, ChevronRight, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorkspaceTasks, useUpdateTask } from "@/hooks/useDealWorkspaces";

interface SimplifiedDDChecklistProps {
  workspaceId: string;
}

interface DDTask {
  id: string;
  title: string;
  status: string;
  ddCategory?: string;
}

// Simplified categories mapping from institutional DD categories
const SIMPLIFIED_CATEGORIES = [
  {
    id: "property_docs",
    label: "Property Documents",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    items: [
      { label: "Title report", categories: ["title"] },
      { label: "Survey", categories: ["survey"] },
      { label: "Insurance policy", categories: ["insurance"] },
      { label: "Permits & licenses", categories: ["permits"] },
    ],
  },
  {
    id: "financial_review",
    label: "Financial Review",
    icon: DollarSign,
    color: "text-green-600",
    bgColor: "bg-green-50",
    items: [
      { label: "P&L statements (3 years)", categories: ["financial"] },
      { label: "Current rent roll", categories: ["financial"] },
      { label: "Tax returns", categories: ["financial"] },
      { label: "Operating budget", categories: ["financial"] },
    ],
  },
  {
    id: "inspections",
    label: "Inspections",
    icon: Search,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    items: [
      { label: "Property inspection", categories: ["inspection"] },
      { label: "Environmental (Phase I)", categories: ["ESA"] },
      { label: "Appraisal", categories: ["appraisal"] },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    icon: Scale,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    items: [
      { label: "Purchase agreement review", categories: ["legal"] },
      { label: "Lease review", categories: ["legal"] },
      { label: "Zoning compliance", categories: ["zoning"] },
      { label: "Entity / corporate docs", categories: ["legal"] },
    ],
  },
  {
    id: "closing_prep",
    label: "Closing Prep",
    icon: FolderCheck,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    items: [
      { label: "Loan documents", categories: ["other"] },
      { label: "Title insurance", categories: ["title"] },
      { label: "Closing statement", categories: ["other"] },
      { label: "Transfer documents", categories: ["other"] },
    ],
  },
];

export default function SimplifiedDDChecklist({ workspaceId }: SimplifiedDDChecklistProps) {
  const { toast } = useToast();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(SIMPLIFIED_CATEGORIES.map((c) => c.id))
  );

  // Fetch actual DD tasks from backend
  const { data: tasks = [], isLoading } = useWorkspaceTasks(workspaceId) as { data: DDTask[]; isLoading: boolean };
  const updateTask = useUpdateTask();

  // Build a map of task completion: key = "categoryId-itemLabel" -> task
  const taskMap = useMemo(() => {
    const map = new Map<string, DDTask>();
    for (const task of tasks) {
      // Match tasks to simplified checklist items by title and ddCategory
      for (const category of SIMPLIFIED_CATEGORIES) {
        for (const item of category.items) {
          if (
            item.categories.includes(task.ddCategory || "") ||
            task.title?.toLowerCase().includes(item.label.toLowerCase().split(" ")[0])
          ) {
            map.set(`${category.id}-${item.label}`, task);
          }
        }
      }
    }
    return map;
  }, [tasks]);

  // Track which items are checked — based on backend task status
  const isItemChecked = useCallback((categoryId: string, itemLabel: string) => {
    const task = taskMap.get(`${categoryId}-${itemLabel}`);
    return task?.status === "completed";
  }, [taskMap]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const toggleItem = useCallback((categoryId: string, itemLabel: string) => {
    const itemKey = `${categoryId}-${itemLabel}`;
    const task = taskMap.get(itemKey);
    if (task) {
      // Toggle status via backend
      const newStatus = task.status === "completed" ? "not_started" : "completed";
      updateTask.mutate(
        { workspaceId, taskId: task.id, status: newStatus },
        {
          onError: () => {
            toast({ title: "Failed to update task", variant: "destructive" });
          },
        }
      );
    } else {
      // No matching backend task — show guidance
      toast({
        title: "No matching task found",
        description: "Create a DD task in the full checklist to track this item.",
      });
    }
  }, [taskMap, workspaceId, updateTask, toast]);

  const markAllComplete = useCallback((categoryId: string) => {
    const category = SIMPLIFIED_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return;

    const promises = category.items.map((item) => {
      const task = taskMap.get(`${categoryId}-${item.label}`);
      if (task && task.status !== "completed") {
        return updateTask.mutateAsync({ workspaceId, taskId: task.id, status: "completed" });
      }
      return Promise.resolve();
    });

    Promise.all(promises).then(() => {
      toast({ title: `${category.label} marked complete` });
    }).catch(() => {
      toast({ title: "Some tasks could not be updated", variant: "destructive" });
    });
  }, [taskMap, workspaceId, updateTask, toast]);

  const getCategoryProgress = useCallback((categoryId: string) => {
    const category = SIMPLIFIED_CATEGORIES.find((c) => c.id === categoryId);
    if (!category) return { completed: 0, total: 0, percent: 0 };
    const total = category.items.length;
    const completed = category.items.filter((item) =>
      isItemChecked(categoryId, item.label)
    ).length;
    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [isItemChecked]);

  const overallProgress = useMemo(() => {
    const totalItems = SIMPLIFIED_CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);
    const completedItems = SIMPLIFIED_CATEGORIES.reduce((sum, c) => {
      return sum + c.items.filter((item) => isItemChecked(c.id, item.label)).length;
    }, 0);
    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  }, [isItemChecked]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Due Diligence Checklist
            </CardTitle>
            <CardDescription>
              Simplified checklist for your deal. Track key items across 5 categories.
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600">{overallProgress}%</p>
            <p className="text-xs text-gray-500">Complete</p>
          </div>
        </div>
        <Progress value={overallProgress} className="mt-3 h-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        {SIMPLIFIED_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const progress = getCategoryProgress(category.id);
          const isExpanded = expandedCategories.has(category.id);
          const allComplete = progress.percent === 100;

          return (
            <div key={category.id} className={`border rounded-lg overflow-hidden ${allComplete ? "border-green-200" : ""}`}>
              {/* Category Header */}
              <div
                className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                  allComplete ? "bg-green-50" : "bg-gray-50 hover:bg-gray-100"
                }`}
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <div className={`p-1.5 rounded ${category.bgColor}`}>
                    <Icon className={`h-4 w-4 ${category.color}`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">{category.label}</h4>
                    <p className="text-xs text-gray-500">
                      {progress.completed}/{progress.total} items
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={progress.percent} className="w-20 h-1.5" />
                  {!allComplete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAllComplete(category.id);
                      }}
                    >
                      Mark All
                    </Button>
                  )}
                  {allComplete && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Done</Badge>
                  )}
                </div>
              </div>

              {/* Category Items */}
              {isExpanded && (
                <div className="divide-y">
                  {category.items.map((item) => {
                    const checked = isItemChecked(category.id, item.label);
                    const hasTask = taskMap.has(`${category.id}-${item.label}`);
                    return (
                      <div
                        key={`${category.id}-${item.label}`}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          checked ? "bg-green-50/50" : "hover:bg-gray-50"
                        }`}
                        onClick={() => toggleItem(category.id, item.label)}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleItem(category.id, item.label)}
                          className="flex-shrink-0"
                        />
                        <span className={`text-sm ${checked ? "text-gray-400 line-through" : "text-gray-700"}`}>
                          {item.label}
                        </span>
                        {!hasTask && (
                          <span className="text-xs text-gray-400 ml-auto">(no task linked)</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Switch to advanced */}
        <div className="pt-3 border-t mt-4 text-center">
          <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-gray-700"
            onClick={() => {
              const store = (window as any).__displayModeStore;
              if (store?.getState) {
                store.getState().toggleSimplifiedMode();
              }
            }}
          >
            Switch to Full DD Checklist (11 categories) <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
