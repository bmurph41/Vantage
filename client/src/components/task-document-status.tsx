import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentRequirementsManagement } from "./document-requirements-management";
import { TaskCompletionGate } from "./task-completion-gate";
import { useTaskDocumentCompletionStatus } from "@/hooks/use-document-requirements";
import { useUpdateTask } from "@/hooks/use-tasks";
import { FileText, Shield, CheckCircle } from "lucide-react";
import type { Task } from "@shared/schema";

interface TaskDocumentStatusProps {
  task: Task;
  compact?: boolean;
  showButton?: boolean;
  userRole?: "owner" | "editor" | "viewer";
}

export function TaskDocumentStatus({ 
  task, 
  compact = false, 
  showButton = true,
  userRole = "viewer"
}: TaskDocumentStatusProps) {
  const [docRequirementsDialogOpen, setDocRequirementsDialogOpen] = useState(false);
  const updateTask = useUpdateTask();

  const {
    totalRequirements,
    verifiedCount,
    hasBlockingIssues,
    canComplete,
    requirements
  } = useTaskDocumentCompletionStatus(task.id);

  const handleStatusUpdate = async (status: string, overrideReason?: string) => {
    await updateTask.mutateAsync({
      id: task.id,
      projectId: task.projectId,
      updates: { 
        status: status as any,
        completedAt: status === "completed" ? new Date() : null
      }
    });
  };

  // No requirements - don't show anything
  if (totalRequirements === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {hasBlockingIssues && (
          <Shield className="h-4 w-4 text-red-500" />
        )}
        <Badge variant="outline" className={`text-xs ${
          hasBlockingIssues 
            ? 'text-red-700 border-red-300 bg-red-50' 
            : canComplete 
              ? 'text-green-700 border-green-300 bg-green-50'
              : 'text-orange-700 border-orange-300 bg-orange-50'
        }`}>
          <FileText className="h-3 w-3 mr-1" />
          {verifiedCount}/{totalRequirements} Docs
        </Badge>
        {showButton && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDocRequirementsDialogOpen(true)}
            data-testid={`button-documents-compact-${task.id}`}
          >
            View
          </Button>
        )}
        
        {/* Document Requirements Dialog */}
        <Dialog open={docRequirementsDialogOpen} onOpenChange={setDocRequirementsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" data-testid={`dialog-documents-${task.id}`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Requirements - {task.title}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
              <DocumentRequirementsManagement 
                taskId={task.id} 
                showHeader={false}
                compact={true}
              />
              
              {/* Task Completion Section */}
              {task.status !== "completed" && (
                <div className="border-t pt-6">
                  <h4 className="font-medium mb-4">Task Completion</h4>
                  <TaskCompletionGate
                    taskId={task.id}
                    currentStatus={task.status}
                    onStatusUpdate={handleStatusUpdate}
                    userRole={userRole}
                  />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Full display mode
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h4 className="font-medium text-sm">Document Requirements</h4>
          <div className="flex items-center space-x-2">
            {hasBlockingIssues && (
              <Shield className="h-4 w-4 text-red-500" />
            )}
            <Badge variant="outline" className={`text-xs ${
              hasBlockingIssues 
                ? 'text-red-700 border-red-300 bg-red-50' 
                : canComplete 
                  ? 'text-green-700 border-green-300 bg-green-50'
                  : 'text-orange-700 border-orange-300 bg-orange-50'
            }`}>
              <FileText className="h-3 w-3 mr-1" />
              {verifiedCount}/{totalRequirements} Verified
            </Badge>
          </div>
        </div>
        
        {showButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDocRequirementsDialogOpen(true)}
            data-testid={`button-documents-full-${task.id}`}
          >
            <FileText className="h-4 w-4 mr-2" />
            Manage Documents
          </Button>
        )}
      </div>

      {/* Requirements Summary */}
      <div className="text-sm text-muted-foreground">
        {canComplete ? (
          <div className="flex items-center space-x-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span>All document requirements verified</span>
          </div>
        ) : (
          <div>
            {hasBlockingIssues && (
              <div className="text-red-700 mb-1">
                • {requirements.filter(req => ["rejected", "external_unavailable", "outdated"].includes(req.status)).length} document(s) with issues
              </div>
            )}
            {requirements.filter(req => !["verified", "rejected", "external_unavailable"].includes(req.status)).length > 0 && (
              <div className="text-orange-700">
                • {requirements.filter(req => !["verified", "rejected", "external_unavailable"].includes(req.status)).length} document(s) pending verification
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document Requirements Dialog */}
      <Dialog open={docRequirementsDialogOpen} onOpenChange={setDocRequirementsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" data-testid={`dialog-documents-${task.id}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Requirements - {task.title}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-120px)] space-y-6">
            <DocumentRequirementsManagement 
              taskId={task.id} 
              showHeader={false}
              compact={false}
            />
            
            {/* Task Completion Section */}
            {task.status !== "completed" && (
              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Task Completion</h4>
                <TaskCompletionGate
                  taskId={task.id}
                  currentStatus={task.status}
                  onStatusUpdate={handleStatusUpdate}
                  userRole={userRole}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}