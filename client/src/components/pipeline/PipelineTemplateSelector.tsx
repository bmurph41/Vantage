import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LayoutTemplate, Plus, ArrowRight, Loader2, FileStack, Star,
  Building2, RefreshCw, Briefcase, Landmark,
} from "lucide-react";

interface PipelineTemplate {
  id: string;
  name: string;
  dealType: string;
  stages: Array<{
    name: string;
    order: number;
    defaultDays?: number;
    requiredFields?: string[];
  }>;
  defaultChecklistTemplate: string | null;
  isDefault: boolean;
  createdAt: string;
}

const DEAL_TYPE_ICONS: Record<string, typeof Building2> = {
  acquisition: Building2,
  disposition: Briefcase,
  refinance: RefreshCw,
  development: Landmark,
};

const DEAL_TYPE_COLORS: Record<string, string> = {
  acquisition: "bg-blue-100 text-blue-700 border-blue-200",
  disposition: "bg-green-100 text-green-700 border-green-200",
  refinance: "bg-purple-100 text-purple-700 border-purple-200",
  development: "bg-amber-100 text-amber-700 border-amber-200",
};

const DEAL_TYPES = [
  { value: "acquisition", label: "Acquisition" },
  { value: "disposition", label: "Disposition" },
  { value: "refinance", label: "Refinance" },
  { value: "development", label: "Development" },
];

interface PipelineTemplateSelectorProps {
  onDealCreated?: (deal: any) => void;
  pipelineId?: string;
}

export default function PipelineTemplateSelector({ onDealCreated, pipelineId }: PipelineTemplateSelectorProps) {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null);
  const [applyForm, setApplyForm] = useState({ dealTitle: "", dealValue: "" });

  // Template creation form
  const [createForm, setCreateForm] = useState({
    name: "",
    dealType: "acquisition",
    stages: [
      { name: "Lead", order: 0, defaultDays: 14 },
      { name: "Qualified", order: 1, defaultDays: 7 },
      { name: "LOI", order: 2, defaultDays: 21 },
      { name: "Due Diligence", order: 3, defaultDays: 45 },
      { name: "Under Contract", order: 4, defaultDays: 30 },
      { name: "Closing", order: 5, defaultDays: 14 },
    ] as Array<{ name: string; order: number; defaultDays: number }>,
  });

  const { data: templates = [], isLoading } = useQuery<PipelineTemplate[]>({
    queryKey: ["/api/pipeline/templates/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/pipeline/templates/templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/templates/templates"] });
      toast({ title: "Template created" });
      setShowCreateDialog(false);
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const applyMutation = useMutation({
    mutationFn: async ({ templateId, ...data }: any) => {
      const res = await apiRequest("POST", `/api/pipeline/templates/templates/${templateId}/apply`, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Deal created from template" });
      setShowApplyDialog(false);
      setApplyForm({ dealTitle: "", dealValue: "" });
      onDealCreated?.(data.deal);
    },
    onError: () => toast({ title: "Failed to create deal", variant: "destructive" }),
  });

  function handleCreateTemplate() {
    if (!createForm.name.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate(createForm);
  }

  function handleApply() {
    if (!applyForm.dealTitle.trim() || !selectedTemplate) {
      toast({ title: "Deal title is required", variant: "destructive" });
      return;
    }
    applyMutation.mutate({
      templateId: selectedTemplate.id,
      dealTitle: applyForm.dealTitle,
      dealValue: applyForm.dealValue ? Number(applyForm.dealValue) : undefined,
      pipelineId,
    });
  }

  function addStage() {
    setCreateForm(prev => ({
      ...prev,
      stages: [...prev.stages, { name: "", order: prev.stages.length, defaultDays: 14 }],
    }));
  }

  function removeStage(index: number) {
    setCreateForm(prev => ({
      ...prev,
      stages: prev.stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })),
    }));
  }

  function updateStage(index: number, field: string, value: any) {
    setCreateForm(prev => ({
      ...prev,
      stages: prev.stages.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-indigo-500" />
              Pipeline Templates
            </CardTitle>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileStack className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No pipeline templates</p>
              <p className="text-xs text-gray-400 mt-1">Create templates to quickly set up deals with pre-configured stages</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((template) => {
                const Icon = DEAL_TYPE_ICONS[template.dealType] || Building2;
                const colorClass = DEAL_TYPE_COLORS[template.dealType] || "bg-gray-100 text-gray-700 border-gray-200";
                const stages = (template.stages as any[]) || [];
                return (
                  <div
                    key={template.id}
                    className="border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => { setSelectedTemplate(template); setShowApplyDialog(true); }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass} border`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate">{template.name}</h4>
                        <Badge variant="outline" className="text-[10px] capitalize">{template.dealType}</Badge>
                      </div>
                      {template.isDefault && <Star className="h-4 w-4 text-amber-400" />}
                    </div>

                    {/* Stage preview */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {stages.slice(0, 6).map((stage, i) => (
                        <div key={i} className="flex items-center gap-0.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {stage.name}
                          </Badge>
                          {i < Math.min(stages.length, 6) - 1 && (
                            <ArrowRight className="h-2.5 w-2.5 text-gray-300" />
                          )}
                        </div>
                      ))}
                      {stages.length > 6 && (
                        <span className="text-[10px] text-gray-400">+{stages.length - 6} more</span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setSelectedTemplate(template); setShowApplyDialog(true); }}
                    >
                      Use Template
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Pipeline Template</DialogTitle>
            <DialogDescription>Define a reusable pipeline structure for a specific deal type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Template Name</Label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g., Standard Acquisition"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Deal Type</Label>
                <Select value={createForm.dealType} onValueChange={(v) => setCreateForm({ ...createForm, dealType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEAL_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Stages</Label>
                <Button variant="outline" size="sm" onClick={addStage}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Stage
                </Button>
              </div>
              <div className="space-y-2">
                {createForm.stages.map((stage, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <span className="text-xs text-gray-400 w-6 text-center">{i + 1}</span>
                    <Input
                      value={stage.name}
                      onChange={(e) => updateStage(i, "name", e.target.value)}
                      placeholder="Stage name"
                      className="flex-1 h-8 text-sm"
                    />
                    <Input
                      type="number"
                      value={stage.defaultDays}
                      onChange={(e) => updateStage(i, "defaultDays", Number(e.target.value))}
                      className="w-20 h-8 text-sm"
                      title="Default days in stage"
                    />
                    <span className="text-xs text-gray-400">days</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-600"
                      onClick={() => removeStage(i)}
                      disabled={createForm.stages.length <= 1}
                    >
                      &times;
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Deal from Template</DialogTitle>
            <DialogDescription>
              Using template: {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedTemplate && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-2">Stages:</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {((selectedTemplate.stages as any[]) || []).map((stage, i) => (
                    <div key={i} className="flex items-center gap-0.5">
                      <Badge variant="secondary" className="text-[10px]">{stage.name}</Badge>
                      {i < (selectedTemplate.stages as any[]).length - 1 && (
                        <ArrowRight className="h-2.5 w-2.5 text-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label className="text-sm">Deal Title *</Label>
              <Input
                value={applyForm.dealTitle}
                onChange={(e) => setApplyForm({ ...applyForm, dealTitle: e.target.value })}
                placeholder="e.g., Marina Bay Acquisition"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Deal Value</Label>
              <Input
                type="number"
                value={applyForm.dealValue}
                onChange={(e) => setApplyForm({ ...applyForm, dealValue: e.target.value })}
                placeholder="$0"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>Cancel</Button>
            <Button onClick={handleApply} disabled={applyMutation.isPending}>
              {applyMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
