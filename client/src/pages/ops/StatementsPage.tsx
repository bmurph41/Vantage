import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileSpreadsheet, 
  Plus, 
  Download, 
  Eye,
  Calendar,
  User,
  CheckCircle,
  Clock
} from "lucide-react";
import { StatementTemplateEditor } from "@/components/ops/statements/StatementTemplateEditor";
import { apiRequest } from "@/lib/queryClient";

export default function StatementsPage() {
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/opssos/statements/templates"],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/opssos/statements/generate", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opssos/statements"] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Owner Statements</h1>
          <p className="text-sm text-muted-foreground">
            Generate and export owner statements
          </p>
        </div>
        <Button onClick={() => { setSelectedTemplate(null); setShowTemplateEditor(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{templates?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Published This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="generated">Generated Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {templatesLoading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : templates?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No statement templates yet</p>
                <Button onClick={() => setShowTemplateEditor(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates?.map((template: any) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {template.ownerContactId && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="w-4 h-4" />
                          <span>Owner linked</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Created {new Date(template.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => { setSelectedTemplate(template); setShowTemplateEditor(true); }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => generateMutation.mutate({ templateId: template.id })}
                          disabled={generateMutation.isPending}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Generate
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="generated" className="space-y-4">
          <Card>
            <CardContent className="py-12 text-center">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No statements generated yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create a template and generate your first statement
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showTemplateEditor && (
        <StatementTemplateEditor
          template={selectedTemplate}
          onClose={() => setShowTemplateEditor(false)}
          onSave={() => {
            setShowTemplateEditor(false);
            queryClient.invalidateQueries({ queryKey: ["/api/opssos/statements/templates"] });
          }}
        />
      )}
    </div>
  );
}
