import { useRef, useCallback, useEffect, useState } from 'react';
import { Rnd, type RndResizeCallback, type RndDragCallback } from 'react-rnd';
import { useOmEditorStore, type OmBlock, type OmPage } from '@/stores/om-editor-store';
import { cn } from '@/lib/utils';

const BLEED_PX = 9;
const TRIM_PX = 0;
const SAFETY_PX = 36;

interface OmCanvasProps {
  className?: string;
}

export function OmCanvas({ className }: OmCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  const {
    pages,
    blocks,
    currentPageId,
    selectedBlockIds,
    hoveredBlockId,
    zoom,
    panX,
    panY,
    showGrid,
    snapToGrid,
    gridSize,
    showGuides,
    showBleed,
    activeTool,
    selectBlock,
    deselectAll,
    updateBlockPosition,
    setHoveredBlock,
    pushHistory,
  } = useOmEditorStore();

  const currentPage = pages.find(p => p.id === currentPageId);
  const pageBlocks = blocks.filter(b => b.pageId === currentPageId);

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(() => {
      if (canvasRef.current) {
        setCanvasSize({
          width: canvasRef.current.offsetWidth,
          height: canvasRef.current.offsetHeight,
        });
      }
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  const snapToGridValue = useCallback((value: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid, gridSize]);

  const handleDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const handleDrag: RndDragCallback = useCallback((e, data) => {
    const blockId = (e.target as HTMLElement).closest('[data-block-id]')?.getAttribute('data-block-id');
    if (!blockId) return;
    
    const x = snapToGridValue(data.x);
    const y = snapToGridValue(data.y);
    
    updateBlockPosition(blockId, { x, y });
  }, [snapToGridValue, updateBlockPosition]);

  const handleResizeStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const handleResize: RndResizeCallback = useCallback((e, direction, ref, delta, position) => {
    const blockId = ref.closest('[data-block-id]')?.getAttribute('data-block-id');
    if (!blockId) return;
    
    const width = snapToGridValue(parseInt(ref.style.width, 10));
    const height = snapToGridValue(parseInt(ref.style.height, 10));
    const x = snapToGridValue(position.x);
    const y = snapToGridValue(position.y);
    
    updateBlockPosition(blockId, { x, y, width, height });
  }, [snapToGridValue, updateBlockPosition]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-canvas-area]')) {
      deselectAll();
    }
  }, [deselectAll]);

  const handleBlockClick = useCallback((e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    const addToSelection = e.shiftKey || e.metaKey || e.ctrlKey;
    selectBlock(blockId, addToSelection);
  }, [selectBlock]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        useOmEditorStore.getState().selectAll();
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const ids = useOmEditorStore.getState().selectedBlockIds;
        if (ids.length > 0) {
          useOmEditorStore.getState().deleteBlocks(ids);
        }
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault();
        useOmEditorStore.getState().copy();
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        useOmEditorStore.getState().paste();
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'x') {
        e.preventDefault();
        useOmEditorStore.getState().cut();
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        const ids = useOmEditorStore.getState().selectedBlockIds;
        if (ids.length > 0) {
          useOmEditorStore.getState().duplicateBlocks(ids);
        }
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useOmEditorStore.getState().redo();
        } else {
          useOmEditorStore.getState().undo();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!currentPage) {
    return (
      <div className={cn('flex items-center justify-center bg-muted/50', className)}>
        <p className="text-muted-foreground">No page selected</p>
      </div>
    );
  }

  const pageWidth = currentPage.width;
  const pageHeight = currentPage.height;

  return (
    <div 
      ref={canvasRef}
      className={cn('relative overflow-auto bg-muted/30', className)}
      onClick={handleCanvasClick}
      data-canvas-area
    >
      <div 
        className="absolute origin-top-left"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          left: Math.max(0, (canvasSize.width - pageWidth * zoom) / 2),
          top: 40,
        }}
      >
        {showBleed && (
          <div
            className="absolute border border-red-400 border-dashed pointer-events-none"
            style={{
              left: -BLEED_PX,
              top: -BLEED_PX,
              width: pageWidth + BLEED_PX * 2,
              height: pageHeight + BLEED_PX * 2,
            }}
          >
            <span className="absolute -top-5 left-0 text-[10px] text-red-400">Bleed</span>
          </div>
        )}
        
        <div
          className="relative bg-white shadow-xl"
          style={{
            width: pageWidth,
            height: pageHeight,
          }}
        >
          {showBleed && (
            <div
              className="absolute border border-blue-400 border-dashed pointer-events-none z-50"
              style={{
                left: SAFETY_PX,
                top: SAFETY_PX,
                width: pageWidth - SAFETY_PX * 2,
                height: pageHeight - SAFETY_PX * 2,
              }}
            >
              <span className="absolute -top-5 left-0 text-[10px] text-blue-400">Safety</span>
            </div>
          )}
          
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
                `,
                backgroundSize: `${gridSize}px ${gridSize}px`,
              }}
            />
          )}
          
          {pageBlocks.map((block) => (
            <Rnd
              key={block.id}
              data-block-id={block.id}
              data-testid={`canvas-block-${block.id}`}
              position={{ x: block.position.x, y: block.position.y }}
              size={{ width: block.position.width, height: block.position.height }}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onResizeStart={handleResizeStart}
              onResize={handleResize}
              bounds="parent"
              enableResizing={!block.locked && activeTool === 'select'}
              disableDragging={block.locked || activeTool !== 'select'}
              resizeGrid={snapToGrid ? [gridSize, gridSize] : undefined}
              dragGrid={snapToGrid ? [gridSize, gridSize] : undefined}
              style={{ zIndex: block.position.zIndex }}
              className={cn(
                'group transition-shadow',
                selectedBlockIds.includes(block.id) && 'ring-2 ring-primary',
                hoveredBlockId === block.id && !selectedBlockIds.includes(block.id) && 'ring-1 ring-primary/50',
                block.locked && 'opacity-75'
              )}
              onClick={(e) => handleBlockClick(e as unknown as React.MouseEvent, block.id)}
              onMouseEnter={() => setHoveredBlock(block.id)}
              onMouseLeave={() => setHoveredBlock(null)}
            >
              <BlockRenderer block={block} isSelected={selectedBlockIds.includes(block.id)} />
            </Rnd>
          ))}
        </div>
        
        <div className="mt-4 text-center text-xs text-muted-foreground">
          Page {(currentPage.order || 0) + 1} - {currentPage.name || 'Untitled'} ({pageWidth} × {pageHeight}px)
        </div>
      </div>
    </div>
  );
}

interface BlockRendererProps {
  block: OmBlock;
  isSelected: boolean;
}

function BlockRenderer({ block, isSelected }: BlockRendererProps) {
  const { style, data } = block;
  
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: style.backgroundColor || 'transparent',
    borderColor: style.borderColor || 'transparent',
    borderWidth: style.borderWidth || 0,
    borderStyle: style.borderWidth ? 'solid' : 'none',
    borderRadius: style.borderRadius || 0,
    padding: style.padding || 0,
    opacity: style.opacity ?? 1,
    boxShadow: getShadowValue(style.shadow),
    overflow: 'hidden',
  };

  return (
    <div style={containerStyle} className="relative">
      {data.type === 'text' && <TextBlock data={data} />}
      {data.type === 'image' && <ImageBlock data={data} />}
      {data.type === 'kpi' && <KpiBlock data={data} />}
      {data.type === 'chart' && <ChartBlock data={data} />}
      {data.type === 'table' && <TableBlock data={data} />}
      {data.type === 'shape' && <ShapeBlock data={data} />}
      
      {isSelected && (
        <div className="absolute -top-6 left-0 px-1 py-0.5 bg-primary text-primary-foreground text-[10px] rounded-t">
          {block.name || data.type}
        </div>
      )}
    </div>
  );
}

function getShadowValue(shadow?: string): string {
  switch (shadow) {
    case 'sm': return '0 1px 2px rgba(0,0,0,0.05)';
    case 'md': return '0 4px 6px rgba(0,0,0,0.1)';
    case 'lg': return '0 10px 15px rgba(0,0,0,0.15)';
    default: return 'none';
  }
}

function TextBlock({ data }: { data: { type: 'text'; content: string; fontSize?: number; fontFamily?: string; fontWeight?: string; textAlign?: string; lineHeight?: number; color?: string } }) {
  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{
        fontSize: data.fontSize || 14,
        fontFamily: data.fontFamily || 'inherit',
        fontWeight: data.fontWeight || 'normal',
        textAlign: (data.textAlign as any) || 'left',
        lineHeight: data.lineHeight || 1.5,
        color: data.color || 'inherit',
      }}
      dangerouslySetInnerHTML={{ __html: data.content }}
    />
  );
}

function ImageBlock({ data }: { data: { type: 'image'; src: string; alt?: string; fit: string } }) {
  if (!data.src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm">
        No image
      </div>
    );
  }
  
  return (
    <img
      src={data.src}
      alt={data.alt || ''}
      className="w-full h-full"
      style={{ objectFit: data.fit as any || 'cover' }}
    />
  );
}

function KpiBlock({ data }: { data: { type: 'kpi'; label: string; value: string | number; format?: string; prefix?: string; suffix?: string } }) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (data.format === 'currency') return `$${val.toLocaleString()}`;
      if (data.format === 'percent') return `${(val * 100).toFixed(1)}%`;
      return val.toLocaleString();
    }
    return val;
  };
  
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{data.label}</div>
      <div className="text-2xl font-bold mt-1">
        {data.prefix}{formatValue(data.value)}{data.suffix}
      </div>
    </div>
  );
}

function ChartBlock({ data }: { data: { type: 'chart'; chartType: string } }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-muted/50 text-muted-foreground text-sm">
      [Chart: {data.chartType}]
    </div>
  );
}

function TableBlock({ data }: { data: { type: 'table'; columns: { key: string; label: string }[]; rows: Record<string, any>[] } }) {
  if (!data.columns || data.columns.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/50 text-muted-foreground text-sm">
        Empty table
      </div>
    );
  }
  
  return (
    <div className="w-full h-full overflow-auto text-xs">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {data.columns.map(col => (
              <th key={col.key} className="border p-1 bg-muted text-left font-medium">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data.rows || []).map((row, idx) => (
            <tr key={idx}>
              {data.columns.map(col => (
                <td key={col.key} className="border p-1">{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShapeBlock({ data }: { data: { type: 'shape'; shapeType: string; fillColor?: string; strokeColor?: string; strokeWidth?: number } }) {
  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: data.fillColor || 'transparent',
    borderColor: data.strokeColor || 'transparent',
    borderWidth: data.strokeWidth || 0,
    borderStyle: data.strokeWidth ? 'solid' : 'none',
  };
  
  if (data.shapeType === 'circle') {
    return <div style={{ ...baseStyle, borderRadius: '50%' }} />;
  }
  
  if (data.shapeType === 'line') {
    return (
      <div className="w-full h-full flex items-center">
        <div 
          className="w-full" 
          style={{ 
            height: data.strokeWidth || 2, 
            backgroundColor: data.strokeColor || '#000' 
          }} 
        />
      </div>
    );
  }
  
  return <div style={baseStyle} />;
}
