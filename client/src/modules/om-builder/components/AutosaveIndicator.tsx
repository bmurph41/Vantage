import { Cloud, CloudOff, Loader2, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AutosaveIndicatorProps {
  isSaving: boolean;
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean;
  error: string | null;
}

export function AutosaveIndicator({
  isSaving,
  lastSavedAt,
  hasUnsavedChanges,
  error,
}: AutosaveIndicatorProps) {
  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive">
        <CloudOff className="w-3.5 h-3.5" />
        <span>Save failed</span>
      </div>
    );
  }

  if (isSaving) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Cloud className="w-3.5 h-3.5" />
        <span>Unsaved changes</span>
      </div>
    );
  }

  if (lastSavedAt) {
    const timeAgo = formatDistanceToNow(lastSavedAt, { addSuffix: true });
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="w-3.5 h-3.5 text-green-500" />
        <span>Saved {timeAgo}</span>
      </div>
    );
  }

  return null;
}
