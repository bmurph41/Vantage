import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ddClient } from "@/lib/ddClient";

interface TemplatesViewProps {
  projectId: string;
}

export function TemplatesView({ projectId }: TemplatesViewProps) {
  const { data: projectTemplates = [] } = useQuery({
    queryKey: ['/api/dd/project-templates'],
    queryFn: () => ddClient.getProjectTemplates(),
  });

  return (
    <div className="max-w-4xl mx-auto" data-testid="templates-view">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Templates</CardTitle>
            <Button size="sm" data-testid="button-new-template">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projectTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No templates available
              </div>
            ) : (
              projectTemplates.map((template) => (
                <div 
                  key={template.id}
                  className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  data-testid={`project-template-${template.id}`}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-sm text-muted-foreground">{template.description}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}