import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit, GripVertical, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const FIELD_TYPES = [
  "text", "number", "date", "select", "checkbox",
  "url", "email", "phone", "textarea", "currency",
] as const;

type FieldType = typeof FIELD_TYPES[number];

interface FieldDefinition {
  id: string;
  entityType: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: FieldType;
  description?: string;
  isRequired: boolean;
  defaultValue?: string;
  options?: string[];
  sortOrder: number;
  isActive: boolean;
}

interface FormState {
  fieldKey: string;
  fieldLabel: string;
  fieldType: FieldType;
  description: string;
  isRequired: boolean;
  defaultValue: string;
  options: string[];
  sortOrder: number;
}

const emptyForm: FormState = {
  fieldKey: "",
  fieldLabel: "",
  fieldType: "text",
  description: "",
  isRequired: false,
  defaultValue: "",
  options: [],
  sortOrder: 0,
};

interface Props {
  entityType: "contact" | "company" | "deal" | "property";
}

export function CustomFieldDefinitionsManager({ entityType }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newOption, setNewOption] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = [`/api/crm/custom-fields/${entityType}`];

  const { data: fields = [], isLoading } = useQuery<FieldDefinition[]>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/custom-fields/${entityType}`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/crm/custom-fields", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Field definition created" });
      closeDialog();
    },
    onError: () => toast({ title: "Failed to create field", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => {
      const res = await apiRequest("PUT", `/api/crm/custom-fields/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Field definition updated" });
      closeDialog();
    },
    onError: () => toast({ title: "Failed to update field", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/crm/custom-fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Field definition deactivated" });
    },
    onError: () => toast({ title: "Failed to deactivate field", variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setNewOption("");
  };

  const openCreate = () => {
    setForm({ ...emptyForm, sortOrder: fields.length + 1 });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (f: FieldDefinition) => {
    setForm({
      fieldKey: f.fieldKey,
      fieldLabel: f.fieldLabel,
      fieldType: f.fieldType,
      description: f.description || "",
      isRequired: f.isRequired,
      defaultValue: f.defaultValue || "",
      options: f.options || [],
      sortOrder: f.sortOrder,
    });
    setEditingId(f.id);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.fieldKey.trim() || !form.fieldLabel.trim()) {
      toast({ title: "Field key and label are required", variant: "destructive" });
      return;
    }
    const body = { ...form, entityType, options: form.fieldType === "select" ? form.options : undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const addOption = () => {
    const val = newOption.trim();
    if (!val || form.options.includes(val)) return;
    setForm({ ...form, options: [...form.options, val] });
    setNewOption("");
  };

  const removeOption = (opt: string) => {
    setForm({ ...form, options: form.options.filter((o) => o !== opt) });
  };

  const activeFields = fields.filter((f) => f.isActive !== false);
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Custom Field Definitions</h3>
          <p className="text-xs text-muted-foreground capitalize">{entityType} fields</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Field
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : activeFields.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No custom fields defined</p>
          <p className="text-sm">Click "Add Field" to define your first custom field schema</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeFields
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background group">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{f.fieldLabel}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{f.fieldType}</Badge>
                    {f.isRequired && <Badge variant="secondary" className="text-xs shrink-0">Required</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    Key: {f.fieldKey}
                    {f.description ? ` — ${f.description}` : ""}
                    {f.fieldType === "select" && f.options?.length ? ` — ${f.options.length} options` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">#{f.sortOrder}</span>
                <Button variant="ghost" size="icon" onClick={() => openEdit(f)} className="shrink-0 opacity-0 group-hover:opacity-100">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteMutation.mutate(f.id)}
                  className="text-destructive hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Create"} Field Definition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Field Key</Label>
                <Input
                  placeholder="e.g. investor_type"
                  value={form.fieldKey}
                  onChange={(e) => setForm({ ...form, fieldKey: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                  disabled={!!editingId}
                />
              </div>
              <div>
                <Label>Label</Label>
                <Input placeholder="e.g. Investor Type" value={form.fieldLabel} onChange={(e) => setForm({ ...form, fieldLabel: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.fieldType} onValueChange={(v) => setForm({ ...form, fieldType: v as FieldType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea placeholder="Optional description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>

            <div>
              <Label>Default Value</Label>
              <Input placeholder="Optional default" value={form.defaultValue} onChange={(e) => setForm({ ...form, defaultValue: e.target.value })} />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.isRequired} onCheckedChange={(v) => setForm({ ...form, isRequired: v })} />
              <Label>Required field</Label>
            </div>

            {form.fieldType === "select" && (
              <div>
                <Label>Options</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Add option"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
                  />
                  <Button variant="outline" size="sm" onClick={addOption} type="button">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {form.options.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {form.options.map((opt) => (
                      <Badge key={opt} variant="secondary" className="gap-1">
                        {opt}
                        <button onClick={() => removeOption(opt)} className="hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
