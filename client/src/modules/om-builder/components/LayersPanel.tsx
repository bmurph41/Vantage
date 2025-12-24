import { 
  Eye, EyeOff, Lock, Unlock, GripVertical, 
  ChevronUp, ChevronDown, Trash2, Copy 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import type { OmBlock } from "../types";
import { useState } from "react";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface LayersPanelProps {
  blocks: OmBlock[];
  selectedBlockIds: string[];
  onSelectBlock: (blockId: string, addToSelection?: boolean) => void;
  onUpdateBlock: (blockId: string, updates: Partial<OmBlock>) => void;
  onDeleteBlock: (blockId: string) => void;
  onDuplicateBlock: (blockId: string) => void;
  onReorderBlocks: (blocks: OmBlock[]) => void;
  onBringForward: (blockId: string) => void;
  onSendBackward: (blockId: string) => void;
}

function SortableLayerItem({
  block,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onDelete,
  onDuplicate,
}: {
  block: OmBlock;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(block.meta?.name || block.type);
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: block.id 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditName(block.meta?.name || block.type);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editName.trim() && editName !== block.meta?.name) {
      onRename(editName.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(block.meta?.name || block.type);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-1 px-2 py-1.5 rounded-md text-sm group
        ${isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}
        ${block.meta?.hidden ? 'opacity-50' : ''}
      `}
      onClick={onSelect}
      data-testid={`layer-item-${block.id}`}
    >
      <button 
        {...attributes} 
        {...listeners} 
        className="cursor-grab p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid={`layer-drag-${block.id}`}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </button>
      
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
        className="p-0.5 hover:bg-muted rounded"
        data-testid={`layer-visibility-${block.id}`}
      >
        {block.meta?.hidden ? (
          <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      
      <button
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
        className="p-0.5 hover:bg-muted rounded"
        data-testid={`layer-lock-${block.id}`}
      >
        {block.meta?.locked ? (
          <Lock className="w-3.5 h-3.5 text-amber-500" />
        ) : (
          <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
      
      <div className="flex-1 min-w-0" onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="h-6 text-xs px-1"
            autoFocus
            data-testid={`layer-name-input-${block.id}`}
          />
        ) : (
          <span className="truncate block text-xs capitalize" data-testid={`layer-name-${block.id}`}>
            {block.meta?.name || block.type}
          </span>
        )}
      </div>
      
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="p-0.5 hover:bg-muted rounded"
          title="Duplicate"
          data-testid={`layer-duplicate-${block.id}`}
        >
          <Copy className="w-3 h-3 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 hover:bg-red-100 rounded"
          title="Delete"
          data-testid={`layer-delete-${block.id}`}
        >
          <Trash2 className="w-3 h-3 text-red-500" />
        </button>
      </div>
    </div>
  );
}

export function LayersPanel({
  blocks,
  selectedBlockIds,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onReorderBlocks,
  onBringForward,
  onSendBackward,
}: LayersPanelProps) {
  const sortedBlocks = [...blocks].sort((a, b) => 
    (b.meta?.zIndex || 0) - (a.meta?.zIndex || 0)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedBlocks.findIndex(b => b.id === active.id);
    const newIndex = sortedBlocks.findIndex(b => b.id === over.id);
    
    const reordered = arrayMove(sortedBlocks, oldIndex, newIndex);
    const withNewZIndex = reordered.map((block, index) => ({
      ...block,
      meta: { ...block.meta, zIndex: reordered.length - index }
    }));
    
    onReorderBlocks(withNewZIndex);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Layers
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => selectedBlockIds[0] && onBringForward(selectedBlockIds[0])}
            disabled={selectedBlockIds.length !== 1}
            title="Bring Forward"
            data-testid="button-bring-forward"
          >
            <ChevronUp className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => selectedBlockIds[0] && onSendBackward(selectedBlockIds[0])}
            disabled={selectedBlockIds.length !== 1}
            title="Send Backward"
            data-testid="button-send-backward"
          >
            <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {blocks.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No elements on this page
            </div>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedBlocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {sortedBlocks.map((block) => (
                  <SortableLayerItem
                    key={block.id}
                    block={block}
                    isSelected={selectedBlockIds.includes(block.id)}
                    onSelect={(e) => onSelectBlock(block.id, e.shiftKey)}
                    onToggleVisibility={() => onUpdateBlock(block.id, {
                      meta: { ...block.meta, hidden: !block.meta?.hidden }
                    })}
                    onToggleLock={() => onUpdateBlock(block.id, {
                      meta: { ...block.meta, locked: !block.meta?.locked }
                    })}
                    onRename={(name) => onUpdateBlock(block.id, {
                      meta: { ...block.meta, name }
                    })}
                    onDelete={() => onDeleteBlock(block.id)}
                    onDuplicate={() => onDuplicateBlock(block.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default LayersPanel;
