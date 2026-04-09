import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PipelineStage } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Plus, Trash2, GripVertical, Users, Layers, Tag, Shield, Webhook } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { lazy, Suspense } from "react";
const WebhookManager = lazy(() => import("@/components/crm/webhook-manager").then(m => ({ default: m.WebhookManager })));
const CustomFieldDefinitionsManager = lazy(() => import("@/components/crm/custom-field-definitions-manager").then(m => ({ default: m.CustomFieldDefinitionsManager })));


// Custom Fields Management
function CustomFieldsTab() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newField, setNewField] = useState({ name: "", type: "text", entityType: "contact", options: "" });

  const { data: fields = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/crm/settings/custom-fields"],
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Custom Fields</h3>
          <p className="text-sm text-muted-foreground">Add custom data fields to contacts, companies, and properties</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Field</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Custom Field</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Field Name</Label>
                <Input value={newField.name} onChange={e => setNewField({...newField, name: e.target.value})} placeholder="e.g., Investment Thesis" />
              </div>
              <div>
                <Label>Field Type</Label>
                <Select value={newField.type} onValueChange={v => setNewField({...newField, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                    <SelectItem value="boolean">Yes/No</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Entity Type</Label>
                <Select value={newField.entityType} onValueChange={v => setNewField({...newField, entityType: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">Contact</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="property">Property</SelectItem>
                    <SelectItem value="deal">Deal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newField.type === "select" && (
                <div>
                  <Label>Options (comma-separated)</Label>
                  <Input value={newField.options} onChange={e => setNewField({...newField, options: e.target.value})} placeholder="Option 1, Option 2, Option 3" />
                </div>
              )}
              <Button className="w-full" onClick={() => setShowAddDialog(false)}>Create Field</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {fields.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No custom fields configured. Add fields to track additional data on your CRM entities.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg divide-y">
          {fields.map((field: any) => (
            <div key={field.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">{field.name}</span>
                  <div className="flex gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{field.type}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{field.entityType}</Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Pipeline Stages Configuration — live DB-connected
const STAGE_COLORS = [
  '#94a3b8', '#60a5fa', '#a78bfa', '#f59e0b', '#fb923c',
  '#34d399', '#10b981', '#f87171', '#e879f9', '#6b7280',
];

function PipelineStagesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stages = [], isLoading } = useQuery<PipelineStage[]>({
    queryKey: ['/api/pipeline-stages'],
  });

  // Local edit state mirrors DB stages so edits are instant
  const [editStages, setEditStages] = useState<PipelineStage[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (stages.length > 0) {
      setEditStages([...stages].sort((a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0)));
      setHasChanges(false);
    }
  }, [stages]);

  // Fetch default pipeline for new stages
  const { data: pipelines = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/pipelines'],
  });

  const createMutation = useMutation({
    mutationFn: async (stage: { name: string; color: string; probability: number; stageOrder: number }) => {
      let pipelineId = pipelines[0]?.id;
      if (!pipelineId) {
        // Auto-create default pipeline if none exists
        const pRes = await apiRequest('POST', '/api/crm/pipelines', {
          name: 'Default Pipeline',
          description: 'Main deal pipeline',
          pipelineType: 'sales',
        });
        const newPipeline = await pRes.json();
        pipelineId = newPipeline.id;
        queryClient.invalidateQueries({ queryKey: ['/api/crm/pipelines'] });
      }
      const res = await apiRequest('POST', '/api/crm/pipeline-stages', { ...stage, pipelineId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
      toast({ title: 'Stage created' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (stage: { id: string; name: string; color: string; probability: number; stageOrder: number }) => {
      const res = await apiRequest('PUT', `/api/crm/pipeline-stages/${stage.id}`, stage);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/crm/pipeline-stages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
      toast({ title: 'Stage deleted' });
    },
  });

  const handleAddStage = () => {
    const maxOrder = editStages.reduce((max, s) => Math.max(max, s.stageOrder ?? 0), 0);
    createMutation.mutate({
      name: 'New Stage',
      color: STAGE_COLORS[editStages.length % STAGE_COLORS.length],
      probability: 50,
      stageOrder: maxOrder + 1,
    });
  };

  const handleDelete = (stage: PipelineStage) => {
    setEditStages(prev => prev.filter(s => s.id !== stage.id));
    deleteMutation.mutate(stage.id);
  };

  const handleFieldChange = (index: number, field: string, value: any) => {
    setEditStages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value } as PipelineStage;
      return updated;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await Promise.all(
        editStages.map((s, i) =>
          updateMutation.mutateAsync({
            id: s.id,
            name: s.name,
            color: s.color || '#6b7280',
            probability: s.probability ?? 50,
            stageOrder: i + 1,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-stages'] });
      setHasChanges(false);
      toast({ title: 'Pipeline stages saved' });
    } catch {
      toast({ title: 'Failed to save stages', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Pipeline Stages</h3>
          <p className="text-sm text-muted-foreground">Configure deal stages and default win probabilities. Changes here apply to all deals.</p>
        </div>
        <Button size="sm" onClick={handleAddStage} disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Add Stage
        </Button>
      </div>

      <div className="border rounded-lg divide-y">
        {editStages.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No stages configured yet. Click "Add Stage" to create your first pipeline stage.
          </div>
        )}
        {editStages.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-3 px-4 py-3">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />
            <input
              type="color"
              value={stage.color || '#6b7280'}
              onChange={(e) => handleFieldChange(i, 'color', e.target.value)}
              className="w-6 h-6 rounded border-0 cursor-pointer flex-shrink-0 p-0"
              title="Stage color"
            />
            <Input
              value={stage.name}
              className="flex-1 h-8"
              onChange={(e) => handleFieldChange(i, 'name', e.target.value)}
              placeholder="Stage name"
            />
            <div className="flex items-center gap-1 text-sm flex-shrink-0">
              <Input
                type="number"
                value={stage.probability ?? 0}
                className="w-16 h-8 text-center"
                min={0}
                max={100}
                onChange={(e) => handleFieldChange(i, 'probability', parseInt(e.target.value) || 0)}
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(stage)}
              disabled={deleteMutation.isPending}
              className="flex-shrink-0"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      {hasChanges && (
        <Button className="w-full" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Stage Configuration'}
        </Button>
      )}
    </div>
  );
}

// Lead Sources
function LeadSourcesTab() {
  const defaultSources = ["Referral", "Cold Outreach", "Inbound", "Broker Network", "Conference", "Website", "CoStar", "LoopNet", "Other"];
  const [sources, setSources] = useState(defaultSources);
  const [newSource, setNewSource] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">Lead Sources</h3>
        <p className="text-sm text-muted-foreground">Manage the list of lead/deal sources for attribution tracking</p>
      </div>
      <div className="flex gap-2">
        <Input value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="Add new source..." className="flex-1" />
        <Button size="sm" onClick={() => { if (newSource.trim()) { setSources([...sources, newSource.trim()]); setNewSource(""); } }}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map(source => (
          <Badge key={source} variant="secondary" className="text-sm py-1 px-3 gap-2">
            {source}
            <button onClick={() => setSources(sources.filter(s => s !== source))} className="hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

// Team Permissions
function TeamPermissionsTab() {
  const { data: team = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/crm/settings/team"],
  });

  const roles = [
    { value: "admin", label: "Admin", description: "Full access to all CRM features" },
    { value: "editor", label: "Editor", description: "Can create, edit, and delete records" },
    { value: "viewer", label: "Viewer", description: "Read-only access to CRM data" },
  ];

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">Team Permissions</h3>
        <p className="text-sm text-muted-foreground">Manage team member access to CRM features</p>
      </div>
      {team.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Team members will appear here once invited to the organization.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg divide-y">
          {team.map((member: any) => (
            <div key={member.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-medium">{member.name || member.email}</span>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
              <Select defaultValue={member.role || "editor"}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CrmSettings() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" /> CRM Settings
        </h1>
        <p className="text-muted-foreground">Configure your CRM fields, stages, sources, and team access</p>
      </div>

      <Tabs defaultValue="fields">
        <TabsList className="mb-6">
          <TabsTrigger value="fields" className="gap-1"><Layers className="h-4 w-4" /> Custom Fields</TabsTrigger>
          <TabsTrigger value="stages" className="gap-1"><GripVertical className="h-4 w-4" /> Pipeline Stages</TabsTrigger>
          <TabsTrigger value="sources" className="gap-1"><Tag className="h-4 w-4" /> Lead Sources</TabsTrigger>
          <TabsTrigger value="team" className="gap-1"><Shield className="h-4 w-4" /> Team Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="fields"><CustomFieldsTab /></TabsContent>
        <TabsContent value="stages"><PipelineStagesTab /></TabsContent>
        <TabsContent value="sources"><LeadSourcesTab /></TabsContent>
        <TabsContent value="team"><TeamPermissionsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
