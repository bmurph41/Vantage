import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Pencil, Check, X, RotateCcw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InlineEditableNameProps {
  originalName: string;
  displayName: string;
  isOverridden: boolean;
  onSave: (newName: string) => Promise<void>;
  onRevert?: () => Promise<void>;
  isPending?: boolean;
  className?: string;
  suggestion?: string;
}

export function InlineEditableName({
  originalName,
  displayName,
  isOverridden,
  onSave,
  onRevert,
  isPending,
  className = '',
  suggestion,
}: InlineEditableNameProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(displayName);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === displayName) {
      setIsEditing(false);
      return;
    }
    await onSave(trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(displayName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleRevert = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRevert) await onRevert();
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-5 text-[11px] px-1.5 py-0 w-[140px] border-blue-400 focus-visible:ring-blue-400"
          disabled={isPending}
        />
        <button
          className="h-4 w-4 shrink-0 text-green-600 hover:text-green-700"
          onClick={(e) => { e.stopPropagation(); handleSave(); }}
          disabled={isPending}
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          className="h-4 w-4 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); handleCancel(); }}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 group/edit ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={`cursor-pointer hover:underline hover:decoration-dotted ${isOverridden ? 'text-blue-700 dark:text-blue-400' : ''}`}
              onDoubleClick={handleStartEdit}
            >
              {displayName}
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs max-w-[200px]">
            <div>
              {isOverridden ? (
                <>
                  <div>Original: {originalName}</div>
                  <div className="text-muted-foreground mt-0.5">Double-click to edit</div>
                </>
              ) : suggestion && suggestion !== originalName ? (
                <>
                  <div>Suggested: {suggestion}</div>
                  <div className="text-muted-foreground mt-0.5">Double-click to rename</div>
                </>
              ) : (
                <div>Double-click to rename</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <button
        className="h-3 w-3 shrink-0 opacity-0 group-hover/edit:opacity-60 hover:!opacity-100 text-muted-foreground"
        onClick={handleStartEdit}
        title="Rename"
      >
        <Pencil className="h-2.5 w-2.5" />
      </button>
      {isOverridden && onRevert && (
        <button
          className="h-3 w-3 shrink-0 opacity-0 group-hover/edit:opacity-60 hover:!opacity-100 text-muted-foreground"
          onClick={handleRevert}
          title="Revert to original name"
          disabled={isPending}
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
