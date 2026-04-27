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
import { Settings, Plus, Trash2, GripVertical, Users, Layers, Tag, Shield, Webhook, ChevronRight, ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";
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
  '#60a5fa', '#a78bfa', '#34d399', '#f59e0b', '#fb923c',
  '#f87171', '#e879f9', '#10b981', '#6b7280', '#94a3b8',
  '#0ea5e9', '#8b5cf6', '#22c55e', '#ef4444', '#f97316',
];

function PipelineStagesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stages = [], isLoading } = useQuery<PipelineStage[]>({
    queryKey: ['/api/pipeline-stages'],
  });

  const [editStages, setEditStages] = useState<PipelineStage[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (stages.length > 0) {
      setEditStages([...stages].sort((a, b) => (a.stageOrder ?? 0) - (b.stageOrder ?? 0)));
      setHasChanges(false);
    }
  }, [stages]);

  const { data: pipelines = [] } = useQuery<any[]>({ queryKey: ['/api/crm/pipelines'] });

  const createMutation = useMutation({
    mutationFn: async (stage: { name: string; color: string; probability: number; stageOrder: number }) => {
      let pipelineId = pipelines[0]?.id;
      if (!pipelineId) {
        const pRes = await apiRequest('POST', '/api/crm/pipelines', {
          name: 'Default Pipeline', description: 'Main deal pipeline', pipelineType: 'sales',
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
      toast({ title: 'Stage added' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (stage: { id: string; name: string; color: string; probability: number; stageOrder: number }) => {
      const res = await apiRequest('PUT', `/api/crm/pipeline-stages/${stage.id}`, stage);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest('DELETE', `/api/crm/pipeline-stages/${id}`); },
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
    if (!confirm(`Delete stage "${stage.name}"? Deals in this stage will not be deleted.`)) return;
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

  const handleMove = (index: number, direction: 'up' | 'down') => {
    setEditStages(prev => {
      const arr = [...prev];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return arr;
      [arr[index], arr[swapIdx]] = [arr[swapIdx], arr[index]];
      return arr;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await Promise.all(
        editStages.map((s, i) =>
          updateMutation.mutateAsync({
            id: s.id, name: s.name,
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
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-11" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Pipeline Stages</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {editStages.length} stages · drag to reorder · click a stage to edit
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleAddStage} disabled={createMutation.isPending} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Stage
          </Button>
        </div>
      </div>

      {/* ── Visual Pipeline Flow Strip ── */}
      {editStages.length > 0 && (
        <div className="bg-muted/40 border rounded-xl p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Pipeline Flow — {editStages.length} stages
          </p>
          <div className="overflow-x-auto pb-1">
            <div className="flex items-stretch gap-0 min-w-max">
              {editStages.map((stage, i) => {
                const color = stage.color || '#6b7280';
                const isLast = i === editStages.length - 1;
                const isEditing = editingId === stage.id;
                return (
                  <div key={stage.id} className="flex items-stretch">
                    <button
                      onClick={() => setEditingId(isEditing ? null : stage.id)}
                      className="group flex flex-col items-center justify-center px-4 py-2.5 rounded-lg border-2 transition-all hover:shadow-md min-w-[90px] max-w-[120px] bg-white dark:bg-card"
                      style={{
                        borderColor: isEditing ? color : 'transparent',
                        boxShadow: isEditing ? `0 0 0 3px ${color}22` : undefined,
                        borderLeftWidth: 3,
                        borderLeftColor: color,
                        borderLeftStyle: 'solid',
                        borderTopColor: isEditing ? color : 'hsl(var(--border))',
                        borderRightColor: isEditing ? color : 'hsl(var(--border))',
                        borderBottomColor: isEditing ? color : 'hsl(var(--border))',
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full mb-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[11px] font-semibold text-center leading-tight line-clamp-2 text-foreground">
                        {stage.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-1">{stage.probability ?? 0}%</span>
                    </button>
                    {!isLast && (
                      <div className="flex items-center px-1 text-muted-foreground/40">
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Probability progression bar */}
          <div className="mt-3 flex rounded-full overflow-hidden h-1.5">
            {editStages.map((stage, i) => (
              <div
                key={stage.id}
                className="flex-1 transition-all"
                style={{ backgroundColor: stage.color || '#6b7280', opacity: 0.6 + (i / editStages.length) * 0.4 }}
                title={`${stage.name}: ${stage.probability ?? 0}%`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Editable Stage List ── */}
      {editStages.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-10 text-center text-muted-foreground">
          <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No stages yet. Click "Add Stage" to build your pipeline.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <div className="w-5 flex-shrink-0" />
            <div className="w-5 flex-shrink-0" />
            <div className="flex-1">Stage Name</div>
            <div className="w-24 text-center flex-shrink-0">Win Probability</div>
            <div className="w-16 flex-shrink-0" />
          </div>

          <div className="divide-y">
            {editStages.map((stage, i) => {
              const color = stage.color || '#6b7280';
              const isExpanded = editingId === stage.id;
              return (
                <div key={stage.id} className="group">
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setEditingId(isExpanded ? null : stage.id)}
                  >
                    {/* Order controls */}
                    <div className="flex flex-col gap-0 flex-shrink-0 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMove(i, 'up'); }}
                        disabled={i === 0}
                        className="h-3.5 w-5 flex items-center justify-center disabled:opacity-20 hover:text-primary"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMove(i, 'down'); }}
                        disabled={i === editStages.length - 1}
                        className="h-3.5 w-5 flex items-center justify-center disabled:opacity-20 hover:text-primary"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Color swatch */}
                    <div
                      className="w-5 h-5 rounded flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />

                    {/* Name */}
                    <span className="flex-1 text-sm font-medium truncate">{stage.name}</span>

                    {/* Probability bar */}
                    <div className="w-24 flex items-center gap-1.5 flex-shrink-0">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${stage.probability ?? 0}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
                        {stage.probability ?? 0}%
                      </span>
                    </div>

                    {/* Delete */}
                    <div className="w-16 flex items-center justify-end gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(stage); }}
                        disabled={deleteMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                        title="Delete stage"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded edit panel */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 bg-muted/20 border-t border-dashed space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs mb-1 block">Stage Name</Label>
                          <Input
                            value={stage.name}
                            className="h-8 text-sm"
                            onChange={(e) => handleFieldChange(i, 'name', e.target.value)}
                            placeholder="e.g., Due Diligence"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">Win Probability (%)</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={stage.probability ?? 0}
                              onChange={(e) => handleFieldChange(i, 'probability', parseInt(e.target.value))}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 h-2 accent-primary"
                            />
                            <Input
                              type="number"
                              value={stage.probability ?? 0}
                              className="w-16 h-8 text-center text-sm"
                              min={0} max={100}
                              onChange={(e) => handleFieldChange(i, 'probability', parseInt(e.target.value) || 0)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs mb-2 block">Stage Color</Label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {STAGE_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={(e) => { e.stopPropagation(); handleFieldChange(i, 'color', c); }}
                              className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                              style={{
                                backgroundColor: c,
                                borderColor: stage.color === c ? 'hsl(var(--foreground))' : 'transparent',
                                boxShadow: stage.color === c ? `0 0 0 1px ${c}` : undefined,
                              }}
                            />
                          ))}
                          <input
                            type="color"
                            value={stage.color || '#6b7280'}
                            onChange={(e) => { e.stopPropagation(); handleFieldChange(i, 'color', e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 rounded-full cursor-pointer border border-border p-0 bg-transparent"
                            title="Custom color"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasChanges && (
        <Button className="w-full gap-2" onClick={handleSave} disabled={updateMutation.isPending}>
          <CheckCircle2 className="h-4 w-4" />
          {updateMutation.isPending ? 'Saving…' : `Save ${editStages.length} Stage Configuration`}
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
