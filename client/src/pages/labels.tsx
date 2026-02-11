import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ContactsLabel } from "@shared/schema";

export default function LabelsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<ContactsLabel | null>(null);
  const [filterScope, setFilterScope] = useState<string>("all");
  const { toast } = useToast();

  const { data: labels = [], isLoading } = useQuery<ContactsLabel[]>({
    queryKey: ['/api/labels'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { key: string; name: string; color: string; scope: string }) => {
      return await apiRequest('/api/labels', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/labels'] });
      setIsCreateOpen(false);
      toast({ title: "Label created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create label", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContactsLabel> }) => {
      return await apiRequest(`/api/labels/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/labels'] });
      setEditingLabel(null);
      toast({ title: "Label updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update label", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/labels/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/labels'] });
      toast({ title: "Label deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete label", description: error.message, variant: "destructive" });
    },
  });

  const filteredLabels = labels.filter(label => {
    if (filterScope === "all") return true;
    return label.scope === filterScope || label.scope === "both";
  });

  return (
    <div className="h-full overflow-auto bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Tag className="h-8 w-8" />
              Labels
            </h1>
            <p className="text-gray-600 mt-1">
              Manage labels for categorizing contacts and organizations
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-label">
                <Plus className="h-4 w-4 mr-2" />
                Create Label
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateLabelForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setIsCreateOpen(false)}
                isPending={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <Select value={filterScope} onValueChange={setFilterScope}>
            <SelectTrigger className="w-[200px]" data-testid="select-filter-scope">
              <SelectValue placeholder="Filter by scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Labels</SelectItem>
              <SelectItem value="person">People Only</SelectItem>
              <SelectItem value="organization">Organizations Only</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-12">Loading...</div>
        ) : filteredLabels.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No labels found. Create your first label to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLabels.map((label) => (
              <Card key={label.id} data-testid={`card-label-${label.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      <CardTitle className="text-lg">{label.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingLabel(label)}
                        data-testid={`button-edit-${label.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this label?")) {
                            deleteMutation.mutate(label.id);
                          }
                        }}
                        data-testid={`button-delete-${label.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Key:</span> {label.key}
                    </div>
                    <Badge variant="outline" data-testid={`text-scope-${label.id}`}>
                      {label.scope === "both" ? "People & Organizations" : 
                       label.scope === "person" ? "People Only" : "Organizations Only"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {editingLabel && (
          <Dialog open={!!editingLabel} onOpenChange={() => setEditingLabel(null)}>
            <DialogContent>
              <EditLabelForm
                label={editingLabel}
                onSubmit={(data) => updateMutation.mutate({ id: editingLabel.id, data })}
                onCancel={() => setEditingLabel(null)}
                isPending={updateMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

function CreateLabelForm({
  onSubmit,
  onCancel,
  isPending,
}: {
  onSubmit: (data: { key: string; name: string; color: string; scope: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    key: "",
    name: "",
    color: "#6366f1",
    scope: "both",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Create New Label</DialogTitle>
        <DialogDescription>
          Add a new label for categorizing contacts and organizations
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Label Name</Label>
          <Input
            id="name"
            data-testid="input-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
            placeholder="e.g., Owner, Broker, Investor"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="key">Key (slug)</Label>
          <Input
            id="key"
            data-testid="input-key"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
            placeholder="e.g., owner, broker, investor"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="color">Color</Label>
          <div className="flex gap-2">
            <Input
              id="color"
              type="color"
              data-testid="input-color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-20 h-10"
            />
            <Input
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              placeholder="#6366f1"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="scope">Scope</Label>
          <Select
            value={formData.scope}
            onValueChange={(value) => setFormData({ ...formData, scope: value })}
          >
            <SelectTrigger data-testid="select-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="person">People Only</SelectItem>
              <SelectItem value="organization">Organizations Only</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-submit">
          {isPending ? "Creating..." : "Create Label"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditLabelForm({
  label,
  onSubmit,
  onCancel,
  isPending,
}: {
  label: ContactsLabel;
  onSubmit: (data: Partial<ContactsLabel>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    name: label.name,
    color: label.color,
    scope: label.scope,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Edit Label</DialogTitle>
        <DialogDescription>
          Update the label details
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-name">Label Name</Label>
          <Input
            id="edit-name"
            data-testid="input-edit-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-color">Color</Label>
          <div className="flex gap-2">
            <Input
              id="edit-color"
              type="color"
              data-testid="input-edit-color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-20 h-10"
            />
            <Input
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-scope">Scope</Label>
          <Select
            value={formData.scope}
            onValueChange={(value) => setFormData({ ...formData, scope: value })}
          >
            <SelectTrigger data-testid="select-edit-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="person">People Only</SelectItem>
              <SelectItem value="organization">Organizations Only</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-edit-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} data-testid="button-edit-submit">
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
