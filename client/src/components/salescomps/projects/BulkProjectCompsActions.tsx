import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Trash2, 
  Edit, 
  X, 
  Loader2,
  FolderPlus,
  Download
} from "lucide-react";
import { useBulkRemoveCompsFromProject } from '@/hooks/salescomps/useProjects';
import BulkEdit from "@/pages/sales-comps/BulkEdit";
import ProjectAssignmentDialog from "./ProjectAssignmentDialog";
import { useAuth } from "@/hooks/useAuth";
import type { SalesComp, User } from "@shared/schema";

interface BulkProjectCompsActionsProps {
  selectedIds: string[];
  selectedCompsPreview: SalesComp[];
  projectId: string;
  projectName: string;
  onClearSelection: () => void;
  onRefresh?: () => void;
}

export default function BulkProjectCompsActions({
  selectedIds,
  selectedCompsPreview,
  projectId,
  projectName,
  onClearSelection,
  onRefresh,
}: BulkProjectCompsActionsProps) {
  const { user } = useAuth();
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showProjectAssignment, setShowProjectAssignment] = useState(false);

  const bulkRemoveMutation = useBulkRemoveCompsFromProject();

  // Permission checks
  const canEdit = Boolean(user && ['Owner', 'Broker', 'Analyst', 'Admin'].includes((user as User).role));
  const canDelete = Boolean(user && ['Owner', 'Broker', 'Admin'].includes((user as User).role));

  const handleBulkRemove = () => {
    if (selectedIds.length === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to remove ${selectedIds.length} selected comps from "${projectName}"? This will not delete the comps from the database, only remove them from this project.`
    );
    
    if (confirmed) {
      bulkRemoveMutation.mutate(
        { projectId, compIds: selectedIds },
        {
          onSuccess: () => {
            onClearSelection();
            onRefresh?.();
          },
        }
      );
    }
  };

  const handleExportSelected = () => {
    // Basic CSV export functionality
    const headers = ['Marina', 'State', 'Sale Year', 'Sale Price', 'Market', 'Wet Slips', 'Dry Racks'];
    const csvContent = [
      headers.join(','),
      ...selectedCompsPreview.map(comp => [
        `"${comp.marina}"`,
        comp.state || '',
        comp.saleYear || '',
        comp.salePrice || '',
        `"${comp.market || ''}"`,
        comp.wetSlips || '',
        comp.dryRacks || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${projectName}_selected_comps.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <>
      {/* Bulk Actions Bar */}
      <Card className="sticky bottom-0 z-10 border-t border-border shadow-lg">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" data-testid="bulk-selected-count">
                {selectedIds.length} selected
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                data-testid="button-clear-selection"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="text-sm text-muted-foreground">
              {selectedIds.length} comp{selectedIds.length !== 1 ? 's' : ''} selected in "{projectName}"
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Selected */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelected}
              data-testid="button-export-selected"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>

            {/* Add to Another Project */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProjectAssignment(true)}
              data-testid="button-add-to-project"
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Add to Project
            </Button>

            {/* Bulk Edit */}
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkEdit(true)}
                data-testid="button-bulk-edit"
              >
                <Edit className="mr-2 h-4 w-4" />
                Bulk Edit
              </Button>
            )}

            {/* Bulk Remove */}
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkRemove}
                disabled={bulkRemoveMutation.isPending}
                data-testid="button-bulk-remove"
              >
                {bulkRemoveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove from Project
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <BulkEdit
          selectedIds={selectedIds}
          onClose={() => setShowBulkEdit(false)}
        />
      )}

      {/* Project Assignment Modal */}
      {showProjectAssignment && (
        <ProjectAssignmentDialog
          open={showProjectAssignment}
          onClose={() => setShowProjectAssignment(false)}
          selectedIds={selectedIds}
          selectedCompsPreview={selectedCompsPreview}
          onSuccess={() => {
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}