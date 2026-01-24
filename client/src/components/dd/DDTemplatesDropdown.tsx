import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DDChecklistTemplate {
  id: string;
  orgId: string | null;
  name: string;
  description: string | null;
  templateType: string;
  category: string | null;
  tasks: any[];
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

interface DDTemplatesDropdownProps {
  projectId: string;
  onTemplateApplied?: () => void;
}

const TEMPLATE_ICONS: Record<string, string> = {
  environmental: "🌿",
  infrastructure: "🏗️",
  permits: "📋",
  financial: "💰",
  operations: "⚙️",
  custom: "📝",
};

export function DDTemplatesDropdown({ projectId, onTemplateApplied }: DDTemplatesDropdownProps) {
  const [confirmTemplate, setConfirmTemplate] = useState<DDChecklistTemplate | null>(null);
  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery<DDChecklistTemplate[]>({
    queryKey: ["/api/dd/automation/templates"],
  });

  const applyMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest(`/api/dd/automation/templates/${templateId}/apply`, {
        method: "POST",
        body: JSON.stringify({ projectId }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/projects", projectId, "tasks"] });
      setConfirmTemplate(null);
      toast({
        title: "Template Applied",
        description: `Created ${data.tasksCreated} tasks from "${data.templateName}"`,
      });
      onTemplateApplied?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to apply template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const groupedTemplates = templates.reduce((acc, template) => {
    const type = template.templateType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(template);
    return acc;
  }, {} as Record<string, DDChecklistTemplate[]>);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1" />
            Apply Template
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>DD Checklist Templates</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isLoading ? (
            <div className="p-2 text-center text-muted-foreground text-sm">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="p-2 text-center text-muted-foreground text-sm">
              No templates available
            </div>
          ) : (
            Object.entries(groupedTemplates).map(([type, typeTemplates]) => (
              <div key={type}>
                {typeTemplates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    className="flex items-start gap-2 p-3 cursor-pointer"
                    onClick={() => setConfirmTemplate(template)}
                  >
                    <span className="text-lg mt-0.5">{TEMPLATE_ICONS[template.templateType] || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{template.name}</span>
                        {template.isSystem && (
                          <Badge variant="secondary" className="text-[10px] py-0">System</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {template.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {template.tasks.length} tasks
                      </p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!confirmTemplate} onOpenChange={(open) => !open && setConfirmTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to apply the "{confirmTemplate?.name}" template to this project?
            </DialogDescription>
          </DialogHeader>
          {confirmTemplate && (
            <div className="py-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{TEMPLATE_ICONS[confirmTemplate.templateType] || "📋"}</span>
                <div>
                  <p className="font-medium">{confirmTemplate.name}</p>
                  <p className="text-sm text-muted-foreground">{confirmTemplate.description}</p>
                </div>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium mb-2">This will create:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• {confirmTemplate.tasks.length} due diligence tasks</li>
                  <li>• {confirmTemplate.tasks.filter((t: any) => t.isMilestone).length} milestone markers</li>
                  <li>• {confirmTemplate.tasks.filter((t: any) => t.isGating).length} gating items</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmTemplate && applyMutation.mutate(confirmTemplate.id)}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? (
                "Applying..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Apply Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
