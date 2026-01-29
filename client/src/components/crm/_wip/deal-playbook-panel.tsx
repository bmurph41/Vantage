import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  AlertCircle,
  MoreHorizontal,
  Plus,
  PlayCircle,
  Ban,
  Shield,
  Milestone,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface PlaybookItem {
  id: string;
  title: string;
  description?: string;
  itemType: string;
  sortOrder: number;
  isRequired: boolean;
  dueDaysOffset?: number;
  documentType?: string;
  approvalRequiredBy?: string[];
}

interface PlaybookProgress {
  progress: {
    id: string;
    dealId: string;
    playbookId: string;
    playbookItemId: string;
    status: string;
    completedById?: string;
    completedAt?: string;
    skippedReason?: string;
    dueDate?: string;
    notes?: string;
    documentUrl?: string;
    approvedById?: string;
    approvedAt?: string;
  };
  item: PlaybookItem;
  playbook: {
    id: string;
    name: string;
    description?: string;
  };
}

interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  dealType: string;
  items: Array<{
    title: string;
    itemType: string;
    isRequired: boolean;
    dueDaysOffset?: number;
    documentType?: string;
  }>;
}

interface DealPlaybookPanelProps {
  dealId: string;
  dealType?: string;
  stageId?: string;
  pipelineId?: string;
}

const itemTypeIcons: Record<string, typeof CheckCircle2> = {
  checklist: CheckCircle2,
  task: Clock,
  document: FileText,
  approval: Shield,
  milestone: Milestone,
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  skipped: "bg-yellow-100 text-yellow-700",
  blocked: "bg-red-100 text-red-700",
};

export function DealPlaybookPanel({
  dealId,
  dealType,
  stageId,
  pipelineId,
}: DealPlaybookPanelProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [showSkipDialog, setShowSkipDialog] = useState<string | null>(null);

  const { data: progress, isLoading: progressLoading } = useQuery<PlaybookProgress[]>({
    queryKey: ["/api/crm/deals", dealId, "playbook-progress"],
    queryFn: async () => {
      const response = await fetch(`/api/crm/deals/${dealId}/playbook-progress`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch playbook progress");
      return response.json();
    },
  });

  const { data: templates } = useQuery<PlaybookTemplate[]>({
    queryKey: ["/api/crm/playbook-templates"],
    queryFn: async () => {
      const response = await fetch("/api/crm/playbook-templates", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  const { data: playbooks } = useQuery<any[]>({
    queryKey: ["/api/crm/playbooks", { dealType, stageId, pipelineId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dealType) params.append("dealType", dealType);
      if (stageId) params.append("stageId", stageId);
      if (pipelineId) params.append("pipelineId", pipelineId);
      const response = await fetch(`/api/crm/playbooks?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch playbooks");
      return response.json();
    },
  });

  const applyPlaybookMutation = useMutation({
    mutationFn: async (playbookId: string) => {
      return apiRequest("POST", `/api/crm/deals/${dealId}/apply-playbook/${playbookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", dealId, "playbook-progress"] });
      toast({
        title: "Playbook applied",
        description: "The playbook checklist has been added to this deal.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply playbook",
        variant: "destructive",
      });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({
      progressId,
      status,
      notes,
      skippedReason,
    }: {
      progressId: string;
      status: string;
      notes?: string;
      skippedReason?: string;
    }) => {
      return apiRequest("PATCH", `/api/crm/deals/${dealId}/playbook-progress/${progressId}`, {
        status,
        notes,
        skippedReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", dealId, "playbook-progress"] });
      setShowSkipDialog(null);
      setSkipReason("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update progress",
        variant: "destructive",
      });
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const result = await apiRequest("POST", `/api/crm/playbooks/from-template/${templateId}`, {
        pipelineId,
        stageId,
      });
      if (result.id) {
        await apiRequest("POST", `/api/crm/deals/${dealId}/apply-playbook/${result.id}`);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals", dealId, "playbook-progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/playbooks"] });
      setSelectedTemplate(null);
      toast({
        title: "Playbook created and applied",
        description: "The playbook has been added to this deal.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create playbook from template",
        variant: "destructive",
      });
    },
  });

  const groupedProgress = progress?.reduce((acc, item) => {
    const playbookId = item.playbook.id;
    if (!acc[playbookId]) {
      acc[playbookId] = {
        playbook: item.playbook,
        items: [],
      };
    }
    acc[playbookId].items.push(item);
    return acc;
  }, {} as Record<string, { playbook: any; items: PlaybookProgress[] }>);

  const calculateProgress = (items: PlaybookProgress[]) => {
    if (!items.length) return 0;
    const completed = items.filter(
      (i) => i.progress.status === "completed" || i.progress.status === "skipped"
    ).length;
    return Math.round((completed / items.length) * 100);
  };

  if (progressLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Deal Playbook</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasProgress = progress && progress.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Deal Playbook</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="add-playbook-btn">
                <Plus className="h-4 w-4 mr-1" />
                Add Playbook
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {templates?.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => createFromTemplateMutation.mutate(template.id)}
                  data-testid={`template-${template.id}`}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  {template.name}
                </DropdownMenuItem>
              ))}
              {playbooks?.map((playbook) => (
                <DropdownMenuItem
                  key={playbook.id}
                  onClick={() => applyPlaybookMutation.mutate(playbook.id)}
                  data-testid={`playbook-${playbook.id}`}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {playbook.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {!hasProgress ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No playbook applied to this deal yet.</p>
            <p className="text-xs mt-1">Add a playbook to track your progress.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.values(groupedProgress || {}).map(({ playbook, items }) => (
              <div key={playbook.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">{playbook.name}</h4>
                  <span className="text-xs text-muted-foreground">
                    {calculateProgress(items)}% complete
                  </span>
                </div>
                <Progress value={calculateProgress(items)} className="h-2" />
                <div className="space-y-2">
                  {items
                    .sort((a, b) => a.item.sortOrder - b.item.sortOrder)
                    .map((item) => {
                      const Icon = itemTypeIcons[item.item.itemType] || Circle;
                      const isCompleted = item.progress.status === "completed";
                      const isSkipped = item.progress.status === "skipped";
                      const isOverdue =
                        item.progress.dueDate &&
                        new Date(item.progress.dueDate) < new Date() &&
                        !isCompleted &&
                        !isSkipped;

                      return (
                        <div
                          key={item.progress.id}
                          className={`flex items-start gap-3 p-2 rounded-md border ${
                            isCompleted
                              ? "bg-green-50 border-green-200"
                              : isSkipped
                              ? "bg-yellow-50 border-yellow-200"
                              : isOverdue
                              ? "bg-red-50 border-red-200"
                              : "bg-white"
                          }`}
                          data-testid={`playbook-item-${item.item.id}`}
                        >
                          <Checkbox
                            checked={isCompleted}
                            onCheckedChange={(checked) => {
                              updateProgressMutation.mutate({
                                progressId: item.progress.id,
                                status: checked ? "completed" : "pending",
                              });
                            }}
                            disabled={isSkipped}
                            data-testid={`checkbox-${item.item.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span
                                className={`text-sm ${
                                  isCompleted ? "line-through text-muted-foreground" : ""
                                }`}
                              >
                                {item.item.title}
                              </span>
                              {item.item.isRequired && (
                                <Badge variant="outline" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                            {item.progress.dueDate && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                Due: {format(new Date(item.progress.dueDate), "MMM d, yyyy")}
                                {isOverdue && (
                                  <Badge variant="destructive" className="text-xs ml-1">
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                            )}
                            {item.progress.completedAt && (
                              <div className="text-xs text-green-600 mt-1">
                                Completed {format(new Date(item.progress.completedAt), "MMM d, yyyy")}
                              </div>
                            )}
                            {item.progress.skippedReason && (
                              <div className="text-xs text-yellow-600 mt-1">
                                Skipped: {item.progress.skippedReason}
                              </div>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                data-testid={`item-menu-${item.item.id}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  updateProgressMutation.mutate({
                                    progressId: item.progress.id,
                                    status: "completed",
                                  })
                                }
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark Complete
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateProgressMutation.mutate({
                                    progressId: item.progress.id,
                                    status: "in_progress",
                                  })
                                }
                              >
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Mark In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setShowSkipDialog(item.progress.id)}
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Skip Item
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!showSkipDialog} onOpenChange={() => setShowSkipDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Skip Checklist Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Please provide a reason for skipping this item:
              </p>
              <Textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="Reason for skipping..."
                data-testid="skip-reason-input"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSkipDialog(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (showSkipDialog) {
                      updateProgressMutation.mutate({
                        progressId: showSkipDialog,
                        status: "skipped",
                        skippedReason: skipReason,
                      });
                    }
                  }}
                  disabled={!skipReason.trim()}
                  data-testid="confirm-skip-btn"
                >
                  Skip Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
