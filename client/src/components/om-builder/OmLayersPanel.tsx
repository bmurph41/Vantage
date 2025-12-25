import { 
  Layers, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOmEditorStore, type OmBlock } from '@/stores/om-editor-store';
import { cn } from '@/lib/utils';

export function OmLayersPanel() {
  const {
    blocks,
    currentPageId,
    selectedBlockIds,
    selectBlock,
    updateBlock,
    deleteBlocks,
    duplicateBlocks,
  } = useOmEditorStore();

  const pageBlocks = blocks
    .filter(b => b.pageId === currentPageId)
    .sort((a, b) => (b.position.zIndex || 0) - (a.position.zIndex || 0));

  const moveBlockUp = (block: OmBlock) => {
    const maxZ = Math.max(...blocks.map(b => b.position.zIndex || 0));
    updateBlock(block.id, {
      position: { ...block.position, zIndex: maxZ + 1 },
    });
  };

  const moveBlockDown = (block: OmBlock) => {
    const minZ = Math.min(...blocks.map(b => b.position.zIndex || 0));
    updateBlock(block.id, {
      position: { ...block.position, zIndex: Math.max(0, minZ - 1) },
    });
  };

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'text': return 'T';
      case 'image': return '🖼';
      case 'kpi': return '#';
      case 'chart': return '📊';
      case 'table': return '⊞';
      case 'shape': return '◻';
      default: return '?';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Layers className="h-4 w-4" />
        <span className="font-medium text-sm">Layers</span>
        <span className="ml-auto text-xs text-muted-foreground">{pageBlocks.length}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {pageBlocks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No elements on this page
            </p>
          ) : (
            pageBlocks.map((block) => (
              <div
                key={block.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer group',
                  selectedBlockIds.includes(block.id)
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                )}
                onClick={() => selectBlock(block.id)}
                data-testid={`layer-item-${block.id}`}
              >
                <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                
                <span className="w-5 text-center">{getBlockIcon(block.data.type)}</span>
                
                <span className="flex-1 truncate text-xs">
                  {block.name || block.data.type}
                </span>

                <div className="hidden group-hover:flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveBlockUp(block);
                    }}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveBlockDown(block);
                    }}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateBlock(block.id, { locked: !block.locked });
                    }}
                  >
                    {block.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateBlocks([block.id]);
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBlocks([block.id]);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
