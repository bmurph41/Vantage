import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus, Edit, Trash2, Target, TrendingUp, DollarSign, 
  Building, RefreshCw, Check, Calendar
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface MarinaMatchGoal {
  id: string;
  goalType: string;
  goalName: string;
  targetValue: string;
  currentValue: string;
  timePeriod?: string;
  startDate?: string;
  endDate?: string;
  priority: number;
  isPrimary: boolean;
  displayFormat: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
}

const GOAL_TYPES = [
  { value: "marinas_acquired", label: "Marinas Acquired", icon: Building, format: "number" },
  { value: "gross_revenue_portfolio", label: "Total Portfolio Revenue", icon: DollarSign, format: "currency" },
  { value: "gross_revenue_avg", label: "Avg Marina Revenue", icon: DollarSign, format: "currency" },
  { value: "ebitda_portfolio", label: "Total Portfolio EBITDA", icon: TrendingUp, format: "currency" },
  { value: "ebitda_avg", label: "Avg Marina EBITDA", icon: TrendingUp, format: "currency" },
  { value: "capital_invested", label: "Capital Invested", icon: DollarSign, format: "currency" },
  { value: "slips_acquired", label: "Total Slips", icon: Building, format: "number" },
];

const TIME_PERIODS = [
  { value: "ytd", label: "Year to Date" },
  { value: "this_year", label: "This Year" },
  { value: "all_time", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

export function GoalsDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingGoal, setEditingGoal] = useState<MarinaMatchGoal | null>(null);

  const { data: goals, isLoading: goalsLoading } = useQuery<MarinaMatchGoal[]>({
    queryKey: ["/api/marinamatch/intel/goals"],
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/marinamatch/intel/goals", data);
    },
    onSuccess: () => {
      toast({ title: "Goal created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/goals"] });
      setIsCreating(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create goal", description: error.message, variant: "destructive" });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/marinamatch/intel/goals/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Goal updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/goals"] });
      setEditingGoal(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update goal", description: error.message, variant: "destructive" });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/marinamatch/intel/goals/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Goal deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/goals"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete goal", description: error.message, variant: "destructive" });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ goalId, value, notes }: { goalId: string; value: number; notes?: string }) => {
      return apiRequest("POST", `/api/marinamatch/intel/goals/${goalId}/progress`, { recordedValue: value, notes });
    },
    onSuccess: () => {
      toast({ title: "Progress updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/marinamatch/intel/goals"] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update progress", description: error.message, variant: "destructive" });
    },
  });

  const formatValue = (value: string | number, format: string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "—";
    
    if (format === "currency") {
      return formatCurrency(num);
    }
    return formatNumber(num);
  };

  const getGoalIcon = (goalType: string) => {
    const goalConfig = GOAL_TYPES.find(g => g.value === goalType);
    return goalConfig?.icon || Target;
  };

  const getProgressPercent = (current: string, target: string) => {
    const currentNum = parseFloat(current) || 0;
    const targetNum = parseFloat(target) || 1;
    return Math.min(100, Math.round((currentNum / targetNum) * 100));
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500";
    if (percent >= 75) return "bg-blue-500";
    if (percent >= 50) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const primaryGoals = goals?.filter(g => g.isPrimary) || [];
  const secondaryGoals = goals?.filter(g => !g.isPrimary) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Acquisition Goals</h2>
          <p className="text-muted-foreground">
            Track progress toward your marina acquisition targets
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} data-testid="button-create-goal">
          <Plus className="h-4 w-4 mr-2" />
          New Goal
        </Button>
      </div>

      {goalsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : goals?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No goals yet</h3>
            <p className="text-muted-foreground mb-4">
              Set acquisition goals to track your progress toward building your marina portfolio
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {primaryGoals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {primaryGoals.map((goal) => {
                const Icon = getGoalIcon(goal.goalType);
                const progress = getProgressPercent(goal.currentValue, goal.targetValue);
                const goalConfig = GOAL_TYPES.find(g => g.value === goal.goalType);
                
                return (
                  <Card key={goal.id} className="relative overflow-hidden" data-testid={`goal-card-${goal.id}`}>
                    <div 
                      className={`absolute top-0 left-0 h-1 ${getProgressColor(progress)}`}
                      style={{ width: `${progress}%` }}
                    />
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardDescription className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {goal.goalName}
                        </CardDescription>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setEditingGoal(goal)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <CardTitle className="text-3xl">
                        {formatValue(goal.currentValue, goalConfig?.format || "number")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Progress value={progress} className="h-2" />
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{progress}% complete</span>
                          <span>Target: {formatValue(goal.targetValue, goalConfig?.format || "number")}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {secondaryGoals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Goals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {secondaryGoals.map((goal) => {
                    const Icon = getGoalIcon(goal.goalType);
                    const progress = getProgressPercent(goal.currentValue, goal.targetValue);
                    const goalConfig = GOAL_TYPES.find(g => g.value === goal.goalType);
                    
                    return (
                      <div
                        key={goal.id}
                        className="flex items-center gap-4 p-3 border rounded-lg"
                        data-testid={`goal-row-${goal.id}`}
                      >
                        <div className="p-2 bg-muted rounded-lg">
                          <Icon className="h-5 w-5" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{goal.goalName}</span>
                            {goal.timePeriod && (
                              <Badge variant="outline" className="text-xs">
                                {TIME_PERIODS.find(t => t.value === goal.timePeriod)?.label || goal.timePeriod}
                              </Badge>
                            )}
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="text-right min-w-[100px]">
                          <p className="font-semibold">
                            {formatValue(goal.currentValue, goalConfig?.format || "number")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            of {formatValue(goal.targetValue, goalConfig?.format || "number")}
                          </p>
                        </div>

                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingGoal(goal)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (confirm("Delete this goal?")) {
                                deleteGoalMutation.mutate(goal.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Acquisition Goal</DialogTitle>
          </DialogHeader>
          <GoalForm
            onSubmit={(data) => createGoalMutation.mutate(data)}
            isLoading={createGoalMutation.isPending}
            onCancel={() => setIsCreating(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGoal} onOpenChange={() => setEditingGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
          </DialogHeader>
          {editingGoal && (
            <GoalForm
              goal={editingGoal}
              onSubmit={(data) => updateGoalMutation.mutate({ id: editingGoal.id, data })}
              isLoading={updateGoalMutation.isPending}
              onCancel={() => setEditingGoal(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoalForm({
  goal,
  onSubmit,
  isLoading,
  onCancel,
}: {
  goal?: MarinaMatchGoal;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  onCancel: () => void;
}) {
  const form = useForm({
    defaultValues: {
      goalName: goal?.goalName || "",
      goalType: goal?.goalType || "marinas_acquired",
      targetValue: goal?.targetValue || "",
      currentValue: goal?.currentValue || "0",
      timePeriod: goal?.timePeriod || "all_time",
      isPrimary: goal?.isPrimary ?? false,
      isActive: goal?.isActive ?? true,
    },
  });

  const selectedGoalType = form.watch("goalType");
  const goalConfig = GOAL_TYPES.find(g => g.value === selectedGoalType);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="goalName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Goal Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Q4 Acquisitions" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="goalType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Goal Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select goal type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {GOAL_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="targetValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target Value</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={goalConfig?.format === "currency" ? "1000000" : "10"}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currentValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Value</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="timePeriod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time Period</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TIME_PERIODS.map(period => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isPrimary"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={field.onChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </FormControl>
              <FormLabel className="!mt-0">Show as primary goal (featured on dashboard)</FormLabel>
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            {goal ? "Update Goal" : "Create Goal"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
