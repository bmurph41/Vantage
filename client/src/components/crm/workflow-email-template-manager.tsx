import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Mail, Edit, Trash2, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import WorkflowEmailTemplateEditor from "./workflow-email-template-editor";

interface WorkflowEmailTemplate {
  id: string;
  orgId: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  category: string;
  tokensUsed: string[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WorkflowEmailTemplateManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | undefined>();
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ templates: WorkflowEmailTemplate[] }>({
    queryKey: ['/api/workflow-email/templates', categoryFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/workflow-email/templates?${params}`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/workflow-email/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflow-email/templates'] });
      toast({ title: 'Template deactivated' });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('POST', `/api/workflow-email/templates/${id}/preview`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      setPreviewHtml(data.bodyHtml);
    },
  });

  const templates = data?.templates || [];

  const categoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'workflow': return 'bg-blue-100 text-blue-800';
      case 'notification': return 'bg-purple-100 text-purple-800';
      case 'follow_up': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5" />
              Email Templates
            </CardTitle>
            <Button size="sm" onClick={() => { setEditingTemplateId(undefined); setEditorOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="workflow">Workflow</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
                <SelectItem value="follow_up">Follow-Up</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Mail className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>No email templates found</p>
            </div>
          ) : (
            <div className="divide-y">
              {templates.map((tpl) => (
                <div key={tpl.id} className="py-3 flex items-center justify-between group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{tpl.name}</span>
                      <Badge className={`text-xs ${categoryBadgeColor(tpl.category)}`}>
                        {tpl.category}
                      </Badge>
                      {!tpl.isActive && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{tpl.subject}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => previewMutation.mutate(tpl.id)}
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingTemplateId(tpl.id); setEditorOpen(true); }}
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => {
                        if (confirm('Deactivate this template?')) deleteMutation.mutate(tpl.id);
                      }}
                      title="Deactivate"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editorOpen && (
        <WorkflowEmailTemplateEditor
          templateId={editingTemplateId}
          onSave={() => {
            setEditorOpen(false);
            queryClient.invalidateQueries({ queryKey: ['/api/workflow-email/templates'] });
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {previewHtml && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-3 border-b">
              <span className="font-medium">Email Preview</span>
              <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)}>Close</Button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      )}
    </>
  );
}
