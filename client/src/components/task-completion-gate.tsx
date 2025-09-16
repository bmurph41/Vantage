import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentStatusChip, isDocumentStatusBlocking } from "./document-status-chip";
import { useTaskDocumentCompletionStatus } from "@/hooks/use-document-requirements";
import { 
  CheckCircle, 
  AlertTriangle, 
  Shield, 
  Clock,
  FileText,
  Lock,
  Unlock
} from "lucide-react";
import type { DocumentRequirement } from "@shared/schema";

interface TaskCompletionGateProps {
  taskId: string;
  currentStatus: string;
  onStatusUpdate: (status: string, overrideReason?: string) => Promise<void>;
  disabled?: boolean;
  userRole?: "owner" | "editor" | "viewer";
}

export function TaskCompletionGate({ 
  taskId, 
  currentStatus, 
  onStatusUpdate, 
  disabled = false,
  userRole = "viewer"
}: TaskCompletionGateProps) {
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const {
    requirements,
    isLoading,
    allRequirementsVerified,
    hasBlockingIssues,
    pendingRequirements,
    canComplete,
    totalRequirements,
    verifiedCount
  } = useTaskDocumentCompletionStatus(taskId);

  const canOverride = ["owner", "editor"].includes(userRole);
  const isCompleted = currentStatus === "completed";
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 animate-spin" />
        Checking document requirements...
      </div>
    );
  }

  const handleMarkComplete = async (withOverride = false) => {
    setIsUpdating(true);
    try {
      await onStatusUpdate(
        "completed", 
        withOverride ? "Manually completed despite unverified documents" : undefined
      );
    } finally {
      setIsUpdating(false);
      setShowOverrideDialog(false);
      setOverrideConfirmed(false);
    }
  };

  const handleCompleteAttempt = () => {
    if (canComplete) {
      handleMarkComplete(false);
    } else {
      setShowOverrideDialog(true);
    }
  };

  // No requirements exist - allow normal completion
  if (totalRequirements === 0) {
    return (
      <Button
        onClick={() => handleMarkComplete(false)}
        disabled={disabled || isUpdating || isCompleted}
        className="w-full"
        data-testid="button-complete-task-no-requirements"
      >
        {isUpdating ? "Updating..." : isCompleted ? "Completed" : "Mark Complete"}
      </Button>
    );
  }

  // Requirements exist - show gating logic
  const blockingRequirements = requirements.filter((req: DocumentRequirement) => 
    isDocumentStatusBlocking(req.status)
  );
  
  const unverifiedRequirements = requirements.filter((req: DocumentRequirement) => 
    req.status !== "verified" && !isDocumentStatusBlocking(req.status)
  );

  return (
    <div className="space-y-4" data-testid="task-completion-gate">
      {/* Document Requirements Summary */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium text-sm">Document Requirements</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {verifiedCount}/{totalRequirements} Verified
            </Badge>
          </div>
          
          {/* Status Indicators */}
          <div className="space-y-2">
            {allRequirementsVerified && (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4" />
                All document requirements verified
              </div>
            )}
            
            {hasBlockingIssues && (
              <div className="flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" />
                {blockingRequirements.length} document{blockingRequirements.length !== 1 ? 's' : ''} with issues
              </div>
            )}
            
            {unverifiedRequirements.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-orange-700">
                <Clock className="h-4 w-4" />
                {unverifiedRequirements.length} document{unverifiedRequirements.length !== 1 ? 's' : ''} pending verification
              </div>
            )}
          </div>

          {/* Show problematic requirements */}
          {(blockingRequirements.length > 0 || unverifiedRequirements.length > 0) && (
            <div className="mt-3 space-y-2">
              {blockingRequirements.slice(0, 3).map((req: DocumentRequirement) => (
                <div key={req.id} className="flex items-center gap-2 text-xs">
                  <DocumentStatusChip status={req.status} showIcon={false} />
                  <span className="truncate">{req.title}</span>
                </div>
              ))}
              {unverifiedRequirements.slice(0, 3).map((req: DocumentRequirement) => (
                <div key={req.id} className="flex items-center gap-2 text-xs">
                  <DocumentStatusChip status={req.status} showIcon={false} />
                  <span className="truncate">{req.title}</span>
                </div>
              ))}
              {(blockingRequirements.length + unverifiedRequirements.length) > 6 && (
                <div className="text-xs text-muted-foreground">
                  ...and {(blockingRequirements.length + unverifiedRequirements.length) - 6} more
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion Buttons */}
      <div className="space-y-2">
        {canComplete ? (
          <Button
            onClick={handleCompleteAttempt}
            disabled={disabled || isUpdating || isCompleted}
            className="w-full"
            data-testid="button-complete-task-verified"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {isUpdating ? "Updating..." : isCompleted ? "Completed" : "Mark Complete"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={handleCompleteAttempt}
              disabled={disabled || isUpdating || isCompleted}
              className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
              data-testid="button-complete-task-unverified"
            >
              <Lock className="h-4 w-4 mr-2" />
              Complete with Unverified Documents
            </Button>
            
            {!canOverride && (
              <p className="text-xs text-muted-foreground text-center">
                Contact a project owner or editor to override document requirements
              </p>
            )}
          </div>
        )}
      </div>

      {/* Override Dialog */}
      <AlertDialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <AlertDialogContent data-testid="dialog-completion-override">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              Override Document Requirements
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This task has unverified document requirements. Completing it now will bypass 
                the normal verification process.
              </p>
              
              {blockingRequirements.length > 0 && (
                <div className="bg-red-50 p-3 rounded border border-red-200">
                  <p className="font-medium text-red-800 text-sm mb-2">
                    Documents with Issues ({blockingRequirements.length}):
                  </p>
                  <div className="space-y-1">
                    {blockingRequirements.map((req: DocumentRequirement) => (
                      <div key={req.id} className="flex items-center gap-2 text-xs">
                        <DocumentStatusChip status={req.status} showIcon={false} />
                        <span>{req.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {unverifiedRequirements.length > 0 && (
                <div className="bg-orange-50 p-3 rounded border border-orange-200">
                  <p className="font-medium text-orange-800 text-sm mb-2">
                    Unverified Documents ({unverifiedRequirements.length}):
                  </p>
                  <div className="space-y-1">
                    {unverifiedRequirements.map((req: DocumentRequirement) => (
                      <div key={req.id} className="flex items-center gap-2 text-xs">
                        <DocumentStatusChip status={req.status} showIcon={false} />
                        <span>{req.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {canOverride && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="override-confirm"
                    checked={overrideConfirmed}
                    onCheckedChange={setOverrideConfirmed}
                    data-testid="checkbox-override-confirm"
                  />
                  <label 
                    htmlFor="override-confirm" 
                    className="text-sm font-medium cursor-pointer"
                  >
                    I understand the risks and want to proceed
                  </label>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-override">
              Cancel
            </AlertDialogCancel>
            {canOverride && (
              <AlertDialogAction
                onClick={() => handleMarkComplete(true)}
                disabled={!overrideConfirmed || isUpdating}
                className="bg-orange-600 text-white hover:bg-orange-700"
                data-testid="button-confirm-override"
              >
                <Unlock className="h-4 w-4 mr-2" />
                {isUpdating ? "Updating..." : "Override & Complete"}
              </AlertDialogAction>
            )}
            {!canOverride && (
              <AlertDialogAction
                disabled
                className="bg-gray-400"
                data-testid="button-override-disabled"
              >
                Override Disabled
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}