import { useState, useRef, useCallback } from "react";
import { Rnd } from "react-rnd";
import type { OmBlock, OmPage, BlockType, ShapeType } from "../types";
import { 
  Type, BarChart3, Table, Image, Gauge, AlertCircle, Info, CheckCircle, 
  AlertTriangle, Lightbulb, StickyNote, Square, Circle, Minus, Star 
} from "lucide-react";
import { CALLOUT_COLORS, type CalloutVariant } from "../types";

interface FreeformCanvasProps {
  page: OmPage | null;
  blocks: OmBlock[];
  selectedBlockIds: string[];
  zoom: number;
  showGrid: boolean;
  gridSize: number;
  onSelectBlock: (blockId: string, addToSelection?: boolean) => void;
  onClearSelection: () => void;
  onUpdateBlock: (blockId: string, updates: Partial<OmBlock>) => void;
  onUpdateBlockPosition: (blockId: string, x: number, y: number) => void;
  onUpdateBlockSize: (blockId: string, width: number, height: number) => void;
}

const CANVAS_WIDTH = 816;
const CANVAS_HEIGHT = 1056;

export function FreeformCanvas({
  page,
  blocks,
  selectedBlockIds,
  zoom,
  showGrid,
  gridSize,
  onSelectBlock,
  onClearSelection,
  onUpdateBlock,
  onUpdateBlockPosition,
  onUpdateBlockSize,
}: FreeformCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const snapToGrid = (value: number) => {
    if (!showGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onClearSelection();
    }
  };

  const renderBlockContent = (block: OmBlock) => {
    switch (block.type) {
      case 'text':
        return (
          <div className="p-3 h-full overflow-hidden text-sm">
            {block.content?.markdown || 'Double-click to edit...'}
          </div>
        );
      case 'heading':
        return (
          <div className="p-3 h-full overflow-hidden">
            <h2 className="text-xl font-bold">{block.content?.text || 'Heading'}</h2>
          </div>
        );
      case 'kpi':
        return (
          <div className="p-3 h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold">{block.content?.items?.[0]?.value || '$0'}</div>
              <div className="text-xs text-muted-foreground mt-1">{block.content?.items?.[0]?.label || 'Metric'}</div>
            </div>
          </div>
        );
      case 'chart':
        return (
          <div className="p-3 h-full flex flex-col">
            <div className="text-sm font-medium mb-2">{block.content?.title || 'Chart'}</div>
            <div className="flex-1 bg-muted/30 rounded flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
        );
      case 'image':
        return block.content?.url ? (
          <img 
            src={block.content.url} 
            alt={block.content.alt || ''} 
            className="w-full h-full object-cover rounded"
            draggable={false}
          />
        ) : (
          <div className="h-full bg-muted/30 rounded flex items-center justify-center">
            <Image className="w-8 h-8 text-muted-foreground" />
          </div>
        );
      case 'table':
        return (
          <div className="p-3 h-full flex items-center justify-center bg-muted/20">
            <Table className="w-8 h-8 text-muted-foreground" />
          </div>
        );
      case 'callout':
        const variant = (block.style?.calloutVariant || 'info') as CalloutVariant;
        const colors = CALLOUT_COLORS[variant];
        const CalloutIcon = variant === 'info' ? Info 
          : variant === 'success' ? CheckCircle 
          : variant === 'warning' ? AlertTriangle 
          : variant === 'error' ? AlertCircle 
          : variant === 'tip' ? Lightbulb 
          : StickyNote;
        return (
          <div className={`p-3 h-full ${colors.bg} border ${colors.border} rounded flex gap-2`}>
            <CalloutIcon className={`w-4 h-4 ${colors.icon} shrink-0 mt-0.5`} />
            <div className={`flex-1 ${colors.text} text-sm`}>
              {block.content?.text || 'Callout text...'}
            </div>
          </div>
        );
      case 'shape':
        const shapeType = (block.content?.shapeType || 'rect') as ShapeType;
        const fillColor = block.style?.backgroundColor || '#e5e7eb';
        const strokeColor = block.style?.border?.color || '#9ca3af';
        if (shapeType === 'circle') {
          return (
            <div 
              className="w-full h-full rounded-full" 
              style={{ backgroundColor: fillColor, border: `2px solid ${strokeColor}` }}
            />
          );
        }
        if (shapeType === 'line') {
          return (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full h-0.5" style={{ backgroundColor: strokeColor }} />
            </div>
          );
        }
        return (
          <div 
            className="w-full h-full rounded" 
            style={{ 
              backgroundColor: fillColor, 
              border: `2px solid ${strokeColor}`,
              borderRadius: block.style?.border?.radius || '4px'
            }}
          />
        );
      case 'icon':
        return (
          <div className="h-full flex items-center justify-center">
            <Star className="w-8 h-8" style={{ color: block.style?.backgroundColor || '#6b7280' }} />
          </div>
        );
      case 'divider':
        return (
          <div className="h-full flex items-center">
            <hr className="w-full border-t border-border" />
          </div>
        );
      default:
        return (
          <div className="p-3 h-full flex items-center justify-center text-muted-foreground text-sm">
            {block.type}
          </div>
        );
    }
  };

  const sortedBlocks = [...blocks].sort((a, b) => (a.meta?.zIndex || 0) - (b.meta?.zIndex || 0));

  return (
    <div 
      className="relative bg-white shadow-lg border border-gray-200"
      style={{ 
        width: CANVAS_WIDTH, 
        height: CANVAS_HEIGHT,
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
      }}
      ref={canvasRef}
      onClick={handleCanvasClick}
      data-testid="freeform-canvas"
    >
      {showGrid && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
        />
      )}
      
      {sortedBlocks.map((block) => {
        if (block.meta?.hidden) return null;
        
        const isSelected = selectedBlockIds.includes(block.id);
        const isLocked = block.meta?.locked;
        const position = block.position || { x: 50, y: 50, width: 200, height: 100 };

        return (
          <Rnd
            key={block.id}
            position={{ x: position.x, y: position.y }}
            size={{ width: position.width, height: position.height }}
            onDragStop={(e, d) => {
              if (isLocked) return;
              onUpdateBlockPosition(block.id, snapToGrid(d.x), snapToGrid(d.y));
            }}
            onResizeStop={(e, direction, ref, delta, pos) => {
              if (isLocked) return;
              onUpdateBlockSize(
                block.id,
                snapToGrid(parseInt(ref.style.width)),
                snapToGrid(parseInt(ref.style.height))
              );
              onUpdateBlockPosition(block.id, snapToGrid(pos.x), snapToGrid(pos.y));
            }}
            disableDragging={isLocked}
            enableResizing={!isLocked}
            bounds="parent"
            minWidth={40}
            minHeight={30}
            dragGrid={showGrid ? [gridSize, gridSize] : undefined}
            resizeGrid={showGrid ? [gridSize, gridSize] : undefined}
            className={`
              ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}
              ${isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-move'}
              transition-shadow
            `}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onSelectBlock(block.id, e.shiftKey);
            }}
            data-testid={`canvas-block-${block.id}`}
          >
            <div className="w-full h-full bg-background border border-border rounded overflow-hidden">
              {renderBlockContent(block)}
            </div>
          </Rnd>
        );
      })}
      
      {!page && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Type className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Select or create a page</p>
          </div>
        </div>
      )}
      
      {page && blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
          <div className="text-center">
            <Type className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Drag blocks onto the canvas</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FreeformCanvas;
