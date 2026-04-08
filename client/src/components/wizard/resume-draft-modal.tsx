/**
 * RESUME DRAFT MODAL
 * Shows when user returns with an existing draft
 */

import { formatDistanceToNow } from "date-fns";
import { RotateCcw, Play, X, Clock, AlertTriangle, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { WizardDraft } from "@/hooks/use-wizard-draft";

interface ResumeDraftModalProps<T = Record<string, any>> {
  open: boolean;
  draft: WizardDraft<T> | null;
  needsVersionMigration?: boolean;
  stepLabels?: Record<string, string>;
  onResume: () => void;
  onStartOver: () => void;
  onDismiss: () => void;
}

export function ResumeDraftModal<T extends Record<string, any>>({
  open,
  draft,
  needsVersionMigration = false,
  stepLabels = {},
  onResume,
  onStartOver,
  onDismiss,
}: ResumeDraftModalProps<T>) {
  if (!draft) return null;

  const lastUpdated = formatDistanceToNow(new Date(draft.updatedAt), { addSuffix: true });
  const completedCount = draft.completedStepIds.length;
  const currentStepLabel = stepLabels[draft.currentStepId] || draft.currentStepId;

  const projectName = (draft.payload as any)?.name || "Untitled Project";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Resume Setup?
          </DialogTitle>
          <DialogDescription>
            We saved your progress from last time.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{projectName}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Current Step</span>
                <p className="font-medium">{currentStepLabel}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Progress</span>
                <p className="font-medium">{completedCount} steps completed</p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
              Last updated {lastUpdated}
            </div>
          </div>

          {needsVersionMigration && (
            <Alert variant="default" className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                The Setup Wizard has been updated. Some fields may need to be re-entered.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onStartOver}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Start Over
          </Button>
          <Button
            onClick={onResume}
            className="w-full sm:w-auto"
          >
            <Play className="h-4 w-4 mr-2" />
            Resume
          </Button>
        </DialogFooter>

        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  );
}