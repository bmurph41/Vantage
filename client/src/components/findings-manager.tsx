import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertCircle, Plus, Edit2, Trash2, Loader2, FileWarning } from "lucide-react";
import type { Finding, InsertFinding } from "@shared/schema";

interface FindingsManagerProps {
  projectId: string;
}

type SeverityLevel = "low" | "med" | "high" | "critical";

const severityConfig = {
  low: { label: "Low", color: "bg-blue-500", variant: "default" as const },
  med: { label: "Medium", color: "bg-yellow-500", variant: "secondary" as const },
  high: { label: "High", color: "bg-orange-500", variant: "default" as const },
  critical: { label: "Critical", color: "bg-red-500", variant: "destructive" as const },
};

export function FindingsManager({ projectId }: FindingsManagerProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<SeverityLevel>("low");
  const [bodyMd, setBodyMd] = useState("");
  const [sources, setSources] = useState("");

  // Fetch findings
  const { data: findings = [], isLoading } = useQuery<Finding[]>({
    queryKey: ['/api/dd/projects', projectId, 'findings'],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Omit<InsertFinding, 'createdBy'>) => {
      return await apiRequest('/api/dd/findings', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'findings'] });
      toast({ title: "Finding created", description: "The finding has been added successfully" });
      resetForm();
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create finding",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertFinding> }) => {
      return await apiRequest(`/api/dd/findings/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'findings'] });
      toast({ title: "Finding updated", description: "The finding has been updated successfully" });
      resetForm();
      setIsEditDialogOpen(false);
      setEditingFinding(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update finding",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/dd/findings/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId, 'findings'] });
      toast({ title: "Finding deleted", description: "The finding has been removed" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete finding",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTitle("");
    setSeverity("low");
    setBodyMd("");
    setSources("");
  };

  const handleCreate = () => {
    if (!title.trim() || !bodyMd.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please provide a title and description",
        variant: "destructive",
      });
      return;
    }

    const sourcesArray = sources.trim() 
      ? sources.split('\n').filter(s => s.trim()).map(s => ({ text: s.trim() }))
      : [];

    createMutation.mutate({
      projectId,
      title: title.trim(),
      severity,
      bodyMd: bodyMd.trim(),
      sources: sourcesArray,
    });
  };

  const handleEdit = (finding: Finding) => {
    setEditingFinding(finding);
    setTitle(finding.title);
    setSeverity(finding.severity as SeverityLevel);
    setBodyMd(finding.bodyMd);
    setSources(
      Array.isArray(finding.sources) 
        ? finding.sources.map((s: any) => s.text || '').join('\n')
        : ''
    );
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingFinding || !title.trim() || !bodyMd.trim()) {
      toast({
        title: "Missing required fields",
        description: "Please provide a title and description",
        variant: "destructive",
      });
      return;
    }

    const sourcesArray = sources.trim()
      ? sources.split('\n').filter(s => s.trim()).map(s => ({ text: s.trim() }))
      : [];

    updateMutation.mutate({
      id: editingFinding.id,
      data: {
        title: title.trim(),
        severity,
        bodyMd: bodyMd.trim(),
        sources: sourcesArray,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this finding?")) {
      deleteMutation.mutate(id);
    }
  };

  const getSeverityBadge = (severity: SeverityLevel) => {
    const config = severityConfig[severity];
    return (
      <Badge variant={config.variant} className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Findings
            </CardTitle>
            <CardDescription>
              Track issues and observations from due diligence
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} data-testid="button-create-finding">
                <Plus className="h-4 w-4 mr-2" />
                Add Finding
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Finding</DialogTitle>
                <DialogDescription>
                  Create a new due diligence finding or issue
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-title">Title *</Label>
                  <Input
                    id="create-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Deferred maintenance on main dock"
                    data-testid="input-create-finding-title"
                  />
                </div>
                <div>
                  <Label htmlFor="create-severity">Severity *</Label>
                  <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityLevel)}>
                    <SelectTrigger id="create-severity" data-testid="select-create-finding-severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="med">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-body">Description (Markdown) *</Label>
                  <Textarea
                    id="create-body"
                    value={bodyMd}
                    onChange={(e) => setBodyMd(e.target.value)}
                    placeholder="Detailed description of the finding..."
                    className="min-h-[150px] font-mono text-sm"
                    data-testid="input-create-finding-body"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports Markdown formatting
                  </p>
                </div>
                <div>
                  <Label htmlFor="create-sources">Sources (optional)</Label>
                  <Textarea
                    id="create-sources"
                    value={sources}
                    onChange={(e) => setSources(e.target.value)}
                    placeholder="Document references (one per line)"
                    className="min-h-[80px] text-sm"
                    data-testid="input-create-finding-sources"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create-finding"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Finding
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        ) : findings.length === 0 ? (
          <div className="text-center py-12">
            <FileWarning className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No findings recorded yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Add Finding" to create your first finding
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {findings.map((finding) => (
                <Card key={finding.id} className="p-4" data-testid={`finding-card-${finding.id}`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getSeverityBadge(finding.severity as SeverityLevel)}
                          <h4 className="font-semibold truncate">{finding.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {finding.bodyMd}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(finding)}
                          data-testid={`button-edit-finding-${finding.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(finding.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-finding-${finding.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {Array.isArray(finding.sources) && finding.sources.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Sources:</strong> {finding.sources.map((s: any, i: number) => s.text).join(', ')}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(finding.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Finding</DialogTitle>
              <DialogDescription>
                Update the finding details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-edit-finding-title"
                />
              </div>
              <div>
                <Label htmlFor="edit-severity">Severity *</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityLevel)}>
                  <SelectTrigger id="edit-severity" data-testid="select-edit-finding-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="med">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-body">Description (Markdown) *</Label>
                <Textarea
                  id="edit-body"
                  value={bodyMd}
                  onChange={(e) => setBodyMd(e.target.value)}
                  className="min-h-[150px] font-mono text-sm"
                  data-testid="input-edit-finding-body"
                />
              </div>
              <div>
                <Label htmlFor="edit-sources">Sources (optional)</Label>
                <Textarea
                  id="edit-sources"
                  value={sources}
                  onChange={(e) => setSources(e.target.value)}
                  className="min-h-[80px] text-sm"
                  data-testid="input-edit-finding-sources"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdate} 
                disabled={updateMutation.isPending}
                data-testid="button-submit-edit-finding"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Finding
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
