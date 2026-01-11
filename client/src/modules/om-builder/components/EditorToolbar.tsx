import { 
  Undo2, Redo2, Trash2, Copy, Group, Ungroup, 
  Lock, Unlock, Eye, EyeOff, ArrowUpToLine, ArrowDownToLine,
  MoveUp, MoveDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEditorStore } from '../store/editor-store';
import { AutosaveIndicator } from './AutosaveIndicator';

interface EditorToolbarProps {
  omId?: string;
  isSaving?: boolean;
  lastSavedAt?: number | null;
  hasUnsavedChanges?: boolean;
  autosaveError?: string | null;
}

export function EditorToolbar({
  omId,
  isSaving = false,
  lastSavedAt = null,
  hasUnsavedChanges = false,
  autosaveError = null,
}: EditorToolbarProps) {
  const {
    selectedBlockIds,
    blocks,
    undo,
    redo,
    canUndo,
    canRedo,
    deleteBlocks,
    duplicateBlock,
    groupBlocks,
    ungroupBlock,
    lockBlock,
    unlockBlock,
    toggleBlockVisibility,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  } = useEditorStore();

  const selectedBlock = selectedBlockIds.length === 1 
    ? blocks.find(b => b.id === selectedBlockIds[0]) 
    : null;

  const isLocked = selectedBlock?.meta?.locked ?? false;
  const isHidden = selectedBlock?.meta?.hidden ?? false;
  const isGroup = selectedBlock?.type === 'group';

  const handleDelete = () => {
    if (selectedBlockIds.length > 0) {
      deleteBlocks(selectedBlockIds);
    }
  };

  const handleDuplicate = () => {
    if (selectedBlockIds.length === 1) {
      duplicateBlock(selectedBlockIds[0]);
    }
  };

  const handleGroup = () => {
    if (selectedBlockIds.length >= 2) {
      groupBlocks(selectedBlockIds);
    }
  };

  const handleUngroup = () => {
    if (selectedBlockIds.length === 1 && isGroup) {
      ungroupBlock(selectedBlockIds[0]);
    }
  };

  const handleLockToggle = () => {
    if (selectedBlockIds.length === 1) {
      if (isLocked) {
        unlockBlock(selectedBlockIds[0]);
      } else {
        lockBlock(selectedBlockIds[0]);
      }
    }
  };

  const handleVisibilityToggle = () => {
    if (selectedBlockIds.length === 1) {
      toggleBlockVisibility(selectedBlockIds[0]);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-background/95">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={undo}
                disabled={!canUndo()}
                data-testid="button-undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={redo}
                disabled={!canRedo()}
                data-testid="button-redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDuplicate}
                disabled={selectedBlockIds.length !== 1}
                data-testid="button-duplicate"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate (Ctrl+D)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDelete}
                disabled={selectedBlockIds.length === 0}
                data-testid="button-delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete (Delete)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleGroup}
                disabled={selectedBlockIds.length < 2}
                data-testid="button-group"
              >
                <Group className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Group (Ctrl+G)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleUngroup}
                disabled={!isGroup}
                data-testid="button-ungroup"
              >
                <Ungroup className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ungroup (Ctrl+Shift+G)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleLockToggle}
                disabled={selectedBlockIds.length !== 1}
                data-testid="button-lock"
              >
                {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isLocked ? 'Unlock' : 'Lock'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleVisibilityToggle}
                disabled={selectedBlockIds.length !== 1}
                data-testid="button-visibility"
              >
                {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isHidden ? 'Show' : 'Hide'}</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => selectedBlockIds.forEach(id => bringToFront(id))}
                disabled={selectedBlockIds.length === 0}
                data-testid="button-bring-front"
              >
                <ArrowUpToLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bring to Front (Ctrl+])</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => selectedBlockIds.forEach(id => bringForward(id))}
                disabled={selectedBlockIds.length === 0}
                data-testid="button-bring-forward"
              >
                <MoveUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bring Forward</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => selectedBlockIds.forEach(id => sendBackward(id))}
                disabled={selectedBlockIds.length === 0}
                data-testid="button-send-backward"
              >
                <MoveDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send Backward</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => selectedBlockIds.forEach(id => sendToBack(id))}
                disabled={selectedBlockIds.length === 0}
                data-testid="button-send-back"
              >
                <ArrowDownToLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send to Back (Ctrl+[)</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-3">
          <AutosaveIndicator
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
            hasUnsavedChanges={hasUnsavedChanges}
            error={autosaveError}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

export default EditorToolbar;
