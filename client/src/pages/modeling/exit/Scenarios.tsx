import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  FileSpreadsheet, 
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ArrowLeft
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModelingProject, ExitScenario } from "@shared/schema";

interface ExitScenariosProps {
  projectId: string;
}

export default function ExitScenarios({ projectId }: ExitScenariosProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newScenario, setNewScenario] = useState({
    name: "",
    description: "",
    exitYear: new Date().getFullYear() + 5,
    exitCapRate: "",
    status: "draft" as const
  });

  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: scenarios = [], isLoading } = useQuery<ExitScenario[]>({
    queryKey: ['/api/modeling/projects', projectId, 'exit', 'scenarios'],
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newScenario) => {
      return apiRequest(`/api/modeling/projects/${projectId}/exit/scenarios`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'exit', 'scenarios'] });
      setIsCreateOpen(false);
      setNewScenario({ name: "", description: "", exitYear: new Date().getFullYear() + 5, exitCapRate: "", status: "draft" });
      toast({ title: "Scenario created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create scenario", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      return apiRequest(`/api/modeling/projects/${projectId}/exit/scenarios/${scenarioId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'exit', 'scenarios'] });
      toast({ title: "Scenario deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete scenario", variant: "destructive" });
    }
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const handleCreate = () => {
    if (!newScenario.name.trim()) {
      toast({ title: "Please enter a scenario name", variant: "destructive" });
      return;
    }
    createMutation.mutate(newScenario);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button 
              onClick={() => setLocation(basePath)}
              className="hover:text-primary transition-colors"
            >
              Exit Strategy Suite
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Scenarios</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="scenarios-title">Exit Scenarios</h1>
          <p className="text-muted-foreground mt-1">
            Manage exit scenarios for {project?.propertyName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => setLocation(basePath)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategies
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-create-scenario">
                <Plus className="h-4 w-4 mr-2" />
                New Scenario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Exit Scenario</DialogTitle>
                <DialogDescription>
                  Define a new exit scenario for this property
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Scenario Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Base Case Exit Year 5"
                    value={newScenario.name}
                    onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
                    data-testid="input-scenario-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this scenario..."
                    value={newScenario.description}
                    onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })}
                    data-testid="input-scenario-description"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="exitYear">Exit Year</Label>
                    <Input
                      id="exitYear"
                      type="number"
                      value={newScenario.exitYear}
                      onChange={(e) => setNewScenario({ ...newScenario, exitYear: parseInt(e.target.value) })}
                      data-testid="input-exit-year"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exitCapRate">Exit Cap Rate (%)</Label>
                    <Input
                      id="exitCapRate"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 7.5"
                      value={newScenario.exitCapRate}
                      onChange={(e) => setNewScenario({ ...newScenario, exitCapRate: e.target.value })}
                      data-testid="input-exit-cap-rate"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={newScenario.status} 
                    onValueChange={(value: "draft" | "active" | "archived") => setNewScenario({ ...newScenario, status: value })}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={createMutation.isPending}
                  data-testid="btn-submit-scenario"
                >
                  {createMutation.isPending ? "Creating..." : "Create Scenario"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Exit Scenarios</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first exit scenario to start modeling different exit strategies
            </p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="btn-create-first-scenario">
              <Plus className="h-4 w-4 mr-2" />
              Create First Scenario
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((scenario) => (
            <Card 
              key={scenario.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation(`${basePath}/scenarios/${scenario.id}`)}
              data-testid={`card-scenario-${scenario.id}`}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {scenario.description || 'No description'}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`${basePath}/scenarios/${scenario.id}`);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                      <Copy className="h-4 w-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(scenario.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Exit Year</span>
                    <span className="font-medium">{scenario.exitYear || 'TBD'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Exit Cap Rate</span>
                    <span className="font-medium">
                      {scenario.exitCapRate ? `${scenario.exitCapRate}%` : 'TBD'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={scenario.status === 'active' ? 'default' : 'secondary'}>
                      {scenario.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
