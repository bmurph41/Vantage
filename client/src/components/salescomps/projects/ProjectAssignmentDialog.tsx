import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { useBulkAddCompsToProject } from '@/hooks/salescomps/useProjects';
import ProjectSelector from "./ProjectSelector";
import type { SalesComp } from "@shared/schema";

interface ProjectAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  selectedCompsPreview?: SalesComp[]; // For display only - visible comps subset
  onSuccess?: () => void;
}

export default function ProjectAssignmentDialog({
  open,
  onClose,
  selectedIds,
  selectedCompsPreview = [],
  onSuccess,
}: ProjectAssignmentDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const bulkAddMutation = useBulkAddCompsToProject();

  const handleAssign = async () => {
    if (!selectedProjectId || selectedIds.length === 0) return;
    
    bulkAddMutation.mutate(
      { projectId: selectedProjectId, compIds: selectedIds },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
          setSelectedProjectId("");
        },
      }
    );
  };

  const handleClose = () => {
    if (!bulkAddMutation.isPending) {
      onClose();
      setSelectedProjectId("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-project-assignment">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Add to Project</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={bulkAddMutation.isPending}
              data-testid="button-close-dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected Comps Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Selected Sales Comps</span>
              <Badge variant="secondary" data-testid="badge-selected-count">
                {selectedIds.length} selected
              </Badge>
            </div>
            {selectedIds.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedCompsPreview.slice(0, 5).map((comp) => (
                  <div key={comp.id} className="text-sm text-muted-foreground truncate">
                    • {comp.marina} {comp.state && `(${comp.state})`}
                  </div>
                ))}
                {selectedCompsPreview.length > 5 && (
                  <div className="text-sm text-muted-foreground">
                    ... and {selectedCompsPreview.length - 5} more visible
                  </div>
                )}
                {selectedIds.length > selectedCompsPreview.length && (
                  <div className="text-sm text-muted-foreground">
                    ... and {selectedIds.length - selectedCompsPreview.length} more from other pages
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Project Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Destination Project</label>
            <ProjectSelector
              selectedProjectId={selectedProjectId}
              onProjectSelect={setSelectedProjectId}
              placeholder="Choose a project to add comps to..."
              disabled={bulkAddMutation.isPending}
              allowCreateNew={true}
            />
          </div>

          {/* Assignment Info */}
          {selectedIds.length > 0 && (
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/50 p-3 rounded-lg">
              <div className="font-medium mb-1">Assignment Details:</div>
              <ul className="space-y-1">
                <li>• Comps already in the project will be skipped</li>
                <li>• You'll see a summary of added vs. skipped comps</li>
                <li>• This action can be undone from the project view</li>
                {selectedIds.length > selectedCompsPreview.length && (
                  <li>• Including {selectedIds.length - selectedCompsPreview.length} from other pages</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={bulkAddMutation.isPending}
            data-testid="button-cancel-assignment"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedProjectId || selectedIds.length === 0 || bulkAddMutation.isPending}
            data-testid="button-confirm-assignment"
          >
            {bulkAddMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding to Project...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add {selectedIds.length} Comp{selectedIds.length !== 1 ? 's' : ''} to Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}