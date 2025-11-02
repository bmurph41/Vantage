import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Edit2, Trash2, GripVertical, Check, X, Settings2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PipelineStage, Pipeline } from "@shared/schema";

interface PipelineSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
}

const defaultColors = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#3b82f6", // Blue
  "#0ea5e9", // Sky
  "#14b8a6", // Teal
  "#10b981", // Green
  "#f59e0b", // Amber
  "#f97316", // Orange
  "#ef4444", // Red
  "#ec4899", // Pink
];

export default function PipelineSettingsModal({
  open,
  onOpenChange,
  pipelineId,
}: PipelineSettingsModalProps) {
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editProbability, setEditProbability] = useState(0);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState(defaultColors[0]);
  const [newStageProbability, setNewStageProbability] = useState(50);
  
  const { toast } = useToast();

  // Fetch pipeline info
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
  });

  const currentPipeline = pipelines.find(p => p.id === pipelineId);

  // Fetch stages
  const { data: allStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
    enabled: open,
  });

  const stages = allStages
    .filter(stage => stage.pipelineId === pipelineId)
    .sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));

  // Create stage mutation
  const createStageMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; probability: number }) => {
      const maxOrder = Math.max(...stages.map(s => s.stageOrder || 0), 0);
      const response = await apiRequest("POST", "/api/pipeline-stages", {
        name: data.name,
        color: data.color,
        probability: data.probability,
        stageOrder: maxOrder + 1,
        pipelineId,
        pipelineType: "sales",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      toast({ title: "Stage created successfully" });
      setIsAddingNew(false);
      setNewStageName("");
      setNewStageColor(defaultColors[0]);
      setNewStageProbability(50);
    },
    onError: () => {
      toast({ title: "Failed to create stage", variant: "destructive" });
    },
  });

  // Update stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PipelineStage> }) => {
      const response = await apiRequest("PUT", `/api/pipeline-stages/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      toast({ title: "Stage updated successfully" });
      setEditingStageId(null);
    },
    onError: () => {
      toast({ title: "Failed to update stage", variant: "destructive" });
    },
  });

  // Delete stage mutation
  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/pipeline-stages/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      toast({ title: "Stage deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete stage", variant: "destructive" });
    },
  });

  const startEditing = (stage: PipelineStage) => {
    setEditingStageId(stage.id);
    setEditName(stage.name);
    setEditColor(stage.color || defaultColors[0]);
    setEditProbability(stage.probability || 0);
  };

  const cancelEditing = () => {
    setEditingStageId(null);
    setEditName("");
    setEditColor("");
    setEditProbability(0);
  };

  const saveEdit = (stageId: string) => {
    if (!editName.trim()) {
      toast({ title: "Stage name is required", variant: "destructive" });
      return;
    }
    
    updateStageMutation.mutate({
      id: stageId,
      data: {
        name: editName,
        color: editColor,
        probability: editProbability,
      },
    });
  };

  const handleCreateStage = () => {
    if (!newStageName.trim()) {
      toast({ title: "Stage name is required", variant: "destructive" });
      return;
    }

    createStageMutation.mutate({
      name: newStageName,
      color: newStageColor,
      probability: newStageProbability,
    });
  };

  const handleDeleteStage = (stageId: string) => {
    if (confirm("Are you sure you want to delete this stage? Deals in this stage will need to be reassigned.")) {
      deleteStageMutation.mutate(stageId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Pipeline Settings - {currentPipeline?.name || "Pipeline"}
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-1">
            Manage stages for this pipeline. Drag to reorder, click to edit.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-3">
            {stages.map((stage, index) => (
              <Card key={stage.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {editingStageId === stage.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Stage Name</Label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Enter stage name"
                            data-testid="input-edit-stage-name"
                          />
                        </div>
                        <div>
                          <Label>Win Probability (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={editProbability}
                            onChange={(e) => setEditProbability(parseInt(e.target.value) || 0)}
                            data-testid="input-edit-stage-probability"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Stage Color</Label>
                        <div className="flex items-center gap-2 mt-2">
                          {defaultColors.map((color) => (
                            <button
                              key={color}
                              onClick={() => setEditColor(color)}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                editColor === color ? "border-gray-900 scale-110" : "border-gray-300"
                              }`}
                              style={{ backgroundColor: color }}
                              data-testid={`color-${color}`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelEditing}
                          data-testid="button-cancel-edit"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveEdit(stage.id)}
                          disabled={updateStageMutation.isPending}
                          data-testid="button-save-edit"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.color || defaultColors[0] }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900" data-testid={`stage-name-${index}`}>
                              {stage.name}
                            </h4>
                            <Badge variant="secondary" className="text-xs">
                              Order: {stage.stageOrder}
                            </Badge>
                            {stage.probability !== null && stage.probability !== undefined && (
                              <Badge variant="outline" className="text-xs">
                                {stage.probability}% win probability
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(stage)}
                          data-testid={`button-edit-stage-${index}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStage(stage.id)}
                          disabled={deleteStageMutation.isPending}
                          data-testid={`button-delete-stage-${index}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Add New Stage */}
            {isAddingNew ? (
              <Card className="border-2 border-dashed border-blue-300 bg-blue-50/50">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Stage Name</Label>
                        <Input
                          value={newStageName}
                          onChange={(e) => setNewStageName(e.target.value)}
                          placeholder="e.g., Qualified, Proposal"
                          data-testid="input-new-stage-name"
                        />
                      </div>
                      <div>
                        <Label>Win Probability (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={newStageProbability}
                          onChange={(e) => setNewStageProbability(parseInt(e.target.value) || 0)}
                          data-testid="input-new-stage-probability"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Stage Color</Label>
                      <div className="flex items-center gap-2 mt-2">
                        {defaultColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewStageColor(color)}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              newStageColor === color ? "border-gray-900 scale-110" : "border-gray-300"
                            }`}
                            style={{ backgroundColor: color }}
                            data-testid={`new-color-${color}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsAddingNew(false);
                          setNewStageName("");
                          setNewStageColor(defaultColors[0]);
                          setNewStageProbability(50);
                        }}
                        data-testid="button-cancel-new"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateStage}
                        disabled={createStageMutation.isPending}
                        data-testid="button-create-stage"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Create Stage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button
                variant="outline"
                className="w-full border-2 border-dashed hover:border-blue-500 hover:bg-blue-50"
                onClick={() => setIsAddingNew(true)}
                data-testid="button-add-stage"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Stage
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-close-settings"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
