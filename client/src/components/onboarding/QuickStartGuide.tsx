import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Rocket,
  CheckCircle2,
  Circle,
  ChevronRight,
  X,
  Sparkles,
  Users,
  FileText,
  TrendingUp,
  Radio,
  Briefcase,
  Shield,
  BarChart3,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";

interface QuickStartStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  tourId?: string;
  category: "essential" | "explore" | "advanced";
}

const QUICK_START_STEPS: QuickStartStep[] = [
  {
    id: "create-deal",
    title: "Create Your First Deal",
    description: "Add a marina acquisition to start tracking in CRM and modeling tools",
    icon: Briefcase,
    href: "/crm",
    tourId: "crm-deals",
    category: "essential",
  },
  {
    id: "add-contacts",
    title: "Add Contacts & Companies",
    description: "Build your CRM with brokers, sellers, and key contacts",
    icon: Users,
    href: "/crm/contacts",
    tourId: "crm-contacts",
    category: "essential",
  },
  {
    id: "explore-pipeline",
    title: "View Your Deal Pipeline",
    description: "Manage deal flow from lead to close on the pipeline board",
    icon: TrendingUp,
    href: "/pipeline/deal-board",
    category: "essential",
  },
  {
    id: "explore-docktalk",
    title: "Explore DockTalk Intelligence",
    description: "Stay current with marina M&A news, trends, and market alerts",
    icon: Radio,
    href: "/analysis/docktalk",
    tourId: "docktalk",
    category: "explore",
  },
  {
    id: "financial-model",
    title: "Build a Financial Model",
    description: "Create pro forma projections and valuation scenarios",
    icon: BarChart3,
    href: "/modeling/projects",
    tourId: "valuator",
    category: "explore",
  },
  {
    id: "upload-documents",
    title: "Upload Documents to Data Room",
    description: "Store and share deal documents securely in your VDR",
    icon: FileText,
    href: "/vdr",
    tourId: "vdr",
    category: "explore",
  },
  {
    id: "due-diligence",
    title: "Set Up Due Diligence",
    description: "Create checklists and track diligence items for active deals",
    icon: Shield,
    href: "/dd/projects",
    tourId: "due-diligence",
    category: "advanced",
  },
  {
    id: "sales-comps",
    title: "Review Sales Comparables",
    description: "Analyze recent marina transactions and market pricing",
    icon: Sparkles,
    href: "/analysis/sales-comps",
    tourId: "sales-comps",
    category: "advanced",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  essential: "Getting Started",
  explore: "Explore Features",
  advanced: "Advanced Tools",
};

export function QuickStartGuide() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { data: allTourProgress } = useQuery<{ tours: Record<string, boolean> }>({
    queryKey: ["/api/tour-progress"],
    staleTime: 1000 * 60 * 2,
  });

  const { data: quickStartState } = useQuery<{ dismissed: boolean }>({
    queryKey: ["/api/tour-progress", "quick-start-guide"],
    staleTime: 1000 * 60 * 5,
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tour-progress", {
        tourId: "quick-start-guide",
        status: "completed",
        lastStepIndex: 0,
        totalSteps: QUICK_START_STEPS.length,
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/tour-progress", "quick-start-guide"], { completed: true });
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
    },
  });

  const markStepComplete = useMutation({
    mutationFn: async (stepId: string) => {
      return apiRequest("POST", "/api/tour-progress", {
        tourId: `quickstart-${stepId}`,
        status: "completed",
        lastStepIndex: 0,
        totalSteps: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
    },
  });

  const resetGuideMutation = useMutation({
    mutationFn: async () => {
      const deletePromises = [
        apiRequest("DELETE", "/api/tour-progress/quick-start-guide"),
        ...QUICK_START_STEPS.map(step =>
          apiRequest("DELETE", `/api/tour-progress/quickstart-${step.id}`)
        ),
      ];
      await Promise.allSettled(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-progress"] });
    },
  });

  const isStepCompleted = useCallback(
    (step: QuickStartStep) => {
      if (!allTourProgress?.tours) return false;
      if (allTourProgress.tours[`quickstart-${step.id}`]) return true;
      if (step.tourId && allTourProgress.tours[step.tourId]) return true;
      return false;
    },
    [allTourProgress]
  );

  const completedCount = QUICK_START_STEPS.filter(isStepCompleted).length;
  const progressPercent = Math.round((completedCount / QUICK_START_STEPS.length) * 100);
  const isDismissed = quickStartState?.dismissed || (quickStartState as any)?.completed;

  if (isDismissed && completedCount < QUICK_START_STEPS.length) {
    return null;
  }

  if (completedCount === QUICK_START_STEPS.length) {
    return null;
  }

  const handleStepClick = (step: QuickStartStep) => {
    markStepComplete.mutate(step.id);
    navigate(step.href);
  };

  const categories = ["essential", "explore", "advanced"] as const;

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-background" data-tour="quick-start-guide">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600 text-white">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Quick Start Guide</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {completedCount === 0
                  ? "Get started with the key features of the platform"
                  : `${completedCount} of ${QUICK_START_STEPS.length} steps completed`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {progressPercent}%
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => dismissMutation.mutate()}
              title="Dismiss guide"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Progress value={progressPercent} className="h-1.5 mt-3" />
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-0 pb-4">
          <div className="space-y-4">
            {categories.map((category) => {
              const stepsInCategory = QUICK_START_STEPS.filter(
                (s) => s.category === category
              );
              if (stepsInCategory.length === 0) return null;

              return (
                <div key={category}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {CATEGORY_LABELS[category]}
                  </h4>
                  <div className="space-y-1">
                    {stepsInCategory.map((step) => {
                      const completed = isStepCompleted(step);
                      const StepIcon = step.icon;

                      return (
                        <button
                          key={step.id}
                          onClick={() => handleStepClick(step)}
                          className={cn(
                            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all group",
                            completed
                              ? "bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30"
                              : "hover:bg-blue-50 dark:hover:bg-blue-950/20"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {completed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                            )}
                          </div>
                          <StepIcon
                            className={cn(
                              "h-4 w-4 flex-shrink-0",
                              completed
                                ? "text-green-600/60"
                                : "text-gray-400 group-hover:text-blue-500 transition-colors"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-medium",
                                completed
                                  ? "text-green-800 dark:text-green-400 line-through opacity-60"
                                  : "text-foreground"
                              )}
                            >
                              {step.title}
                            </p>
                            <p
                              className={cn(
                                "text-xs mt-0.5",
                                completed
                                  ? "text-green-600/50 dark:text-green-500/50"
                                  : "text-muted-foreground"
                              )}
                            >
                              {step.description}
                            </p>
                          </div>
                          {!completed && (
                            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <button
              onClick={() => dismissMutation.mutate()}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Dismiss guide
            </button>
            {completedCount > 0 && (
              <button
                onClick={() => resetGuideMutation.mutate()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Reset progress
              </button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function useQuickStartVisible() {
  const { data: quickStartState } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/tour-progress", "quick-start-guide"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: allTourProgress } = useQuery<{ tours: Record<string, boolean> }>({
    queryKey: ["/api/tour-progress"],
    staleTime: 1000 * 60 * 2,
  });

  const isDismissed = quickStartState?.completed;
  const completedCount = QUICK_START_STEPS.filter((step) => {
    if (!allTourProgress?.tours) return false;
    if (allTourProgress.tours[`quickstart-${step.id}`]) return true;
    if (step.tourId && allTourProgress.tours[step.tourId]) return true;
    return false;
  }).length;

  const allComplete = completedCount === QUICK_START_STEPS.length;

  return { isDismissed, allComplete, completedCount, totalSteps: QUICK_START_STEPS.length };
}
