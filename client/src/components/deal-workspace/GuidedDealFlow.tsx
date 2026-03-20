import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2, Circle, Loader2, Building2, Upload, ClipboardCheck,
  Calculator, FileCheck, PartyPopper, ArrowRight, ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

interface GuidedDealFlowProps {
  workspaceId: string;
}

interface WorkspaceOverview {
  workspace: {
    id: string;
    name: string;
    status: string;
    dealId?: string | null;
    dealValue?: string | number | null;
    ddProjectId?: string | null;
    modelingProjectId?: string | null;
    closingDate?: string | null;
    loiSubmitted?: boolean;
    underContract?: boolean;
  };
  stats: {
    dd: {
      total: number;
      completed: number;
      overdue: number;
    };
    documents: {
      total: number;
    };
    members: {
      total: number;
    };
  };
}

type StepStatus = "complete" | "in_progress" | "not_started";

interface DealStep {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  actionLabel: string;
  actionHref?: string;
  onClick?: () => void;
  progress?: number;
  detail?: string;
}

function getStepIcon(status: StepStatus) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />;
    case "in_progress":
      return <Loader2 className="h-6 w-6 text-blue-500 animate-spin flex-shrink-0" />;
    case "not_started":
      return <Circle className="h-6 w-6 text-gray-300 flex-shrink-0" />;
  }
}

function getStepBadge(status: StepStatus) {
  switch (status) {
    case "complete":
      return <Badge className="bg-green-100 text-green-700 border-green-200">Complete</Badge>;
    case "in_progress":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">In Progress</Badge>;
    case "not_started":
      return <Badge variant="outline" className="text-gray-400">Not Started</Badge>;
  }
}

const STEP_ICONS = [Building2, Upload, ClipboardCheck, Calculator, FileCheck, PartyPopper];

export default function GuidedDealFlow({ workspaceId }: GuidedDealFlowProps) {
  const { data, isLoading } = useQuery<WorkspaceOverview>({
    queryKey: [`/api/workspaces/${workspaceId}/overview`],
    enabled: !!workspaceId,
  });

  const steps = useMemo<DealStep[]>(() => {
    if (!data) return [];
    const { workspace, stats } = data;

    const hasProperty = !!workspace.dealId;
    const hasDealValue = !!workspace.dealValue && Number(workspace.dealValue) > 0;
    const hasDocuments = stats.documents.total > 0;
    const hasDDProject = !!workspace.ddProjectId;
    const ddProgress = stats.dd.total > 0 ? Math.round((stats.dd.completed / stats.dd.total) * 100) : 0;
    const ddComplete = ddProgress === 100;
    const hasModeling = !!workspace.modelingProjectId;
    const loiSubmitted = !!(workspace as any).loiSubmitted;
    const underContract = !!(workspace as any).underContract || workspace.status === "under_contract";
    const isClosed = workspace.status === "closed";
    const hasClosingDate = !!workspace.closingDate;

    return [
      {
        id: "setup",
        title: "Set up deal",
        description: "Link property, set deal value, and assign stage.",
        status: (hasProperty && hasDealValue) ? "complete" : (hasProperty || hasDealValue) ? "in_progress" : "not_started",
        actionLabel: "Edit Deal Details",
        actionHref: `/workspaces/${workspaceId}?tab=overview`,
        detail: hasDealValue ? `Deal value: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(workspace.dealValue))}` : undefined,
      },
      {
        id: "documents",
        title: "Upload key documents",
        description: "CA/NDA, financials, property information.",
        status: hasDocuments ? (stats.documents.total >= 3 ? "complete" : "in_progress") : "not_started",
        actionLabel: "Upload Documents",
        actionHref: `/workspaces/${workspaceId}?tab=documents`,
        detail: hasDocuments ? `${stats.documents.total} document${stats.documents.total !== 1 ? "s" : ""} uploaded` : undefined,
      },
      {
        id: "diligence",
        title: "Complete due diligence",
        description: "Work through your DD checklist items.",
        status: ddComplete ? "complete" : hasDDProject ? "in_progress" : "not_started",
        actionLabel: hasDDProject ? "View DD Checklist" : "Start DD Checklist",
        actionHref: `/workspaces/${workspaceId}?tab=diligence`,
        progress: hasDDProject ? ddProgress : undefined,
        detail: hasDDProject ? `${stats.dd.completed}/${stats.dd.total} items complete` : undefined,
      },
      {
        id: "financials",
        title: "Review financials",
        description: "Link or create a financial model for this deal.",
        status: hasModeling ? "complete" : "not_started",
        actionLabel: hasModeling ? "View Model" : "Create Model",
        actionHref: `/workspaces/${workspaceId}?tab=financials`,
      },
      {
        id: "decision",
        title: "Make decision",
        description: "Submit LOI or move to under contract.",
        status: underContract ? "complete" : loiSubmitted ? "in_progress" : "not_started",
        actionLabel: underContract ? "View Contract" : "Update Status",
        actionHref: `/workspaces/${workspaceId}?tab=overview`,
        detail: underContract ? "Under contract" : loiSubmitted ? "LOI submitted" : undefined,
      },
      {
        id: "close",
        title: "Close deal",
        description: "Final documents and closing date.",
        status: isClosed ? "complete" : hasClosingDate ? "in_progress" : "not_started",
        actionLabel: isClosed ? "View Summary" : "Set Closing Date",
        actionHref: `/workspaces/${workspaceId}?tab=overview`,
        detail: hasClosingDate ? `Closing: ${new Date(workspace.closingDate!).toLocaleDateString()}` : undefined,
      },
    ];
  }, [data, workspaceId]);

  const overallProgress = useMemo(() => {
    if (steps.length === 0) return 0;
    const completedWeight = steps.reduce((sum, s) => {
      if (s.status === "complete") return sum + 1;
      if (s.status === "in_progress") return sum + 0.5;
      return sum;
    }, 0);
    return Math.round((completedWeight / steps.length) * 100);
  }, [steps]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
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
            <CardTitle className="text-lg">Deal Progress</CardTitle>
            <CardDescription>Follow these steps to move your deal forward.</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{overallProgress}%</p>
            <p className="text-xs text-gray-500">Overall Progress</p>
          </div>
        </div>
        <Progress value={overallProgress} className="mt-3 h-2" />
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.map((step, index) => {
          const StepIcon = STEP_ICONS[index] || Circle;
          return (
            <div
              key={step.id}
              className={`flex items-start gap-4 p-4 rounded-lg transition-colors ${
                step.status === "in_progress" ? "bg-blue-50/50 border border-blue-100" :
                step.status === "complete" ? "bg-green-50/30" : "hover:bg-gray-50"
              }`}
            >
              {/* Status + Connector */}
              <div className="flex flex-col items-center gap-1">
                {getStepIcon(step.status)}
                {index < steps.length - 1 && (
                  <div className={`w-0.5 h-8 ${step.status === "complete" ? "bg-green-200" : "bg-gray-200"}`} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StepIcon className="h-4 w-4 text-gray-400" />
                  <h4 className={`text-sm font-semibold ${step.status === "complete" ? "text-green-700" : "text-gray-900"}`}>
                    {step.title}
                  </h4>
                  {getStepBadge(step.status)}
                </div>
                <p className="text-xs text-gray-500 mb-2">{step.description}</p>
                {step.progress !== undefined && (
                  <div className="flex items-center gap-2 mb-2">
                    <Progress value={step.progress} className="h-1.5 flex-1 max-w-48" />
                    <span className="text-xs font-medium text-gray-600">{step.progress}%</span>
                  </div>
                )}
                {step.detail && (
                  <p className="text-xs text-gray-600 font-medium">{step.detail}</p>
                )}
              </div>

              {/* Action */}
              <div className="flex-shrink-0">
                {step.actionHref ? (
                  <Link href={step.actionHref}>
                    <Button
                      variant={step.status === "not_started" ? "default" : "outline"}
                      size="sm"
                      className="text-xs gap-1"
                    >
                      {step.actionLabel}
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={step.onClick}>
                    {step.actionLabel}
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {/* Switch to advanced */}
        <div className="pt-4 border-t mt-4 text-center">
          <Link href={`/workspaces/${workspaceId}`}>
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-gray-700">
              Switch to Advanced View <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
