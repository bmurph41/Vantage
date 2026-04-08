import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FolderTree, CheckCircle2 } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  isDefault: boolean;
};

type TemplateFolder = {
  id: string;
  name: string;
  parentFolderId: string | null;
};

type TemplateSelectorProps = {
  projectId: string;
  open: boolean;
  onClose: () => void;
};

export function TemplateSelector({ projectId, open, onClose }: TemplateSelectorProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: templates = [], isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ['/api/vdr/templates'],
    enabled: open,
  });

  const { data: templateDetails, isLoading: detailsLoading } = useQuery<Template & { folders: TemplateFolder[] }>({
    queryKey: ['/api/vdr/templates', selectedTemplateId],
    enabled: !!selectedTemplateId,
  });

  const applyMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest(`/api/vdr/projects/${projectId}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vdr/projects/${projectId}/folders`] });
      toast({
        title: "Template Applied",
        description: "Folder structure created successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply template",
        variant: "destructive",
      });
    },
  });

  const handleApply = () => {
    if (selectedTemplateId) {
      applyMutation.mutate(selectedTemplateId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Choose Folder Template</DialogTitle>
          <DialogDescription>
            Select a pre-configured folder structure for your data room
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Available Templates</h3>
            {templatesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-colors ${
                      selectedTemplateId === template.id
                        ? "border-blue-600 bg-blue-50"
                        : "hover:border-gray-400"
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                    data-testid={`template-${template.id}`}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {template.isDefault && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                        {template.name}
                      </CardTitle>
                      <CardDescription className="text-xs">{template.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Folder Preview</h3>
            {detailsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : templateDetails ? (
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-1">
                    {templateDetails.folders
                      .filter(f => !f.parentFolderId)
                      .map((folder) => (
                        <div key={folder.id} className="text-sm">
                          <div className="flex items-center gap-2 font-medium">
                            <FolderTree className="h-4 w-4 text-blue-600" />
                            {folder.name}
                          </div>
                          {templateDetails.folders
                            .filter(f => f.parentFolderId === folder.id)
                            .map((subfolder) => (
                              <div key={subfolder.id} className="ml-6 text-gray-600 flex items-center gap-2">
                                <span className="text-gray-400">→</span>
                                {subfolder.name}
                              </div>
                            ))}
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center text-gray-500 py-8 text-sm">
                Select a template to preview its structure
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={applyMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedTemplateId || applyMutation.isPending}
            data-testid="button-apply-template"
          >
            {applyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
