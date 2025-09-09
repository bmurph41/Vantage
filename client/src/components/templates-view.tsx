import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ddClient } from "@/lib/ddClient";

interface TemplatesViewProps {
  projectId: string;
}

export function TemplatesView({ projectId }: TemplatesViewProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { data: taskTemplates = [] } = useQuery({
    queryKey: ['/api/dd/task-templates'],
    queryFn: () => ddClient.getTaskTemplates(),
  });

  const { data: projectTemplates = [] } = useQuery({
    queryKey: ['/api/dd/project-templates'],
    queryFn: () => ddClient.getProjectTemplates(),
  });

  // Mock template preview data - in real app this would come from API
  const mockTemplatePreview = [
    { name: "Title Report", startOffset: 0, duration: 7 },
    { name: "Survey", startOffset: 1, duration: 14 },
    { name: "Environmental Assessment", startOffset: 3, duration: 10 },
    { name: "Insurance Quotes", startOffset: 5, duration: 7 },
  ];

  const handleApplyTemplate = async () => {
    if (selectedTemplate) {
      try {
        await ddClient.applyTemplate(projectId, selectedTemplate);
        // In real app, would show success message and refresh tasks
      } catch (error) {
        // Handle error
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="templates-view">
      {/* Task Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Task Templates</CardTitle>
            <Button size="sm" data-testid="button-new-task-template">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {taskTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No task templates available
              </div>
            ) : (
              taskTemplates.map((template) => (
                <div 
                  key={template.id}
                  className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  data-testid={`task-template-${template.id}`}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-sm text-muted-foreground">{template.description}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Duration: {template.durationDays} days • Offset: +{template.startOffsetDays} days
                  </div>
                </div>
              ))
            )}
            
            {/* Mock templates for demo */}
            <div 
              className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => setSelectedTemplate('third-party-reports')}
              data-testid="template-third-party-reports"
            >
              <div className="font-medium">Third-Party Reports</div>
              <div className="text-sm text-muted-foreground">Standard due diligence reports package</div>
              <div className="text-xs text-muted-foreground mt-1">7 tasks • 60 days duration</div>
            </div>
            <div 
              className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              data-testid="template-financing-package"
            >
              <div className="font-medium">Financing Package</div>
              <div className="text-sm text-muted-foreground">Loan documentation and approval</div>
              <div className="text-xs text-muted-foreground mt-1">5 tasks • 45 days duration</div>
            </div>
            <div 
              className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              data-testid="template-legal-review"
            >
              <div className="font-medium">Legal Review</div>
              <div className="text-sm text-muted-foreground">Contract and legal documentation</div>
              <div className="text-xs text-muted-foreground mt-1">4 tasks • 30 days duration</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Project Templates</CardTitle>
            <Button size="sm" data-testid="button-new-project-template">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projectTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No project templates available
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
            
            {/* Mock templates for demo */}
            <div 
              className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              data-testid="template-marina-acquisition"
            >
              <div className="font-medium">Marina Acquisition</div>
              <div className="text-sm text-muted-foreground">Complete marina acquisition workflow</div>
              <div className="text-xs text-muted-foreground mt-1">16 tasks • 75 days duration</div>
            </div>
            <div 
              className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              data-testid="template-office-building"
            >
              <div className="font-medium">Office Building Purchase</div>
              <div className="text-sm text-muted-foreground">Commercial office acquisition</div>
              <div className="text-xs text-muted-foreground mt-1">12 tasks • 60 days duration</div>
            </div>
            <div 
              className="p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              data-testid="template-land-development"
            >
              <div className="font-medium">Land Development</div>
              <div className="text-sm text-muted-foreground">Raw land acquisition and entitlements</div>
              <div className="text-xs text-muted-foreground mt-1">20 tasks • 120 days duration</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Preview */}
      {selectedTemplate && (
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Template Preview: Third-Party Reports</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2" data-testid="template-preview">
                {mockTemplatePreview.map((task, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-2 bg-accent/30 rounded"
                    data-testid={`preview-task-${index}`}
                  >
                    <span className="text-sm">{task.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Start: +{task.startOffset} days • Duration: {task.duration} days
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTemplate(null)}
                  data-testid="button-cancel-template"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleApplyTemplate}
                  data-testid="button-apply-template"
                >
                  Apply Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
