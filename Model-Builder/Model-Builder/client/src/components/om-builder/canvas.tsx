import React, { useCallback, useMemo } from 'react';
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { OmPage, OmBlock, OmPageLayoutConfig, GridLayout as GridLayoutType } from "@/lib/types";
import { BlockRenderer } from "./block-renderer";
import { cn } from "@/lib/utils";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import * as RGL from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

type RGLLayout = RGL.Layout;
const GridLayout = RGL.default;

interface CanvasProps {
  page?: OmPage;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock?: (blockId: string, updates: Partial<OmBlock>) => void;
}

const GRID_COLS = 12;
const GRID_ROW_HEIGHT = 30;
const CANVAS_WIDTH = 800;

function getDefaultGridLayout(type: string, index: number): GridLayoutType {
  const defaults: Record<string, Partial<GridLayoutType>> = {
    text: { w: 12, h: 4, minH: 2 },
    heading: { w: 12, h: 2, minH: 1 },
    callout: { w: 12, h: 3, minH: 2 },
    kpi: { w: 12, h: 4, minH: 3 },
    chart: { w: 12, h: 10, minH: 6 },
    'line-chart': { w: 12, h: 10, minH: 6 },
    'pie-chart': { w: 6, h: 10, minH: 6 },
    'area-chart': { w: 12, h: 10, minH: 6 },
    table: { w: 12, h: 8, minH: 4 },
    image: { w: 6, h: 8, minH: 4 },
    map: { w: 12, h: 10, minH: 6 },
  };

  const typeDefaults = defaults[type] || { w: 12, h: 4, minH: 2 };
  return {
    x: 0,
    y: index * 4,
    w: typeDefaults.w || 12,
    h: typeDefaults.h || 4,
    minW: 3,
    minH: typeDefaults.minH || 2,
  };
}

export function Canvas({ page, selectedBlockId, onSelectBlock, onUpdateBlock }: CanvasProps) {
  if (!page) return <div className="flex items-center justify-center h-full text-muted-foreground">Select a page to edit</div>;

  const layout = page.layout || { layoutType: 'single-column' };
  const isFreeform = layout.layoutType === 'freeform';

  const gridLayoutItems = useMemo(() => {
    return page.blocks.map((block, idx) => {
      const gl = block.style?.gridLayout || getDefaultGridLayout(block.type, idx);
      return {
        i: block.id,
        x: gl.x,
        y: gl.y,
        w: gl.w,
        h: gl.h,
        minW: gl.minW || 3,
        minH: gl.minH || 2,
        static: gl.static || false,
      };
    });
  }, [page.blocks]);

  const handleLayoutChange = useCallback((newLayout: RGLLayout[]) => {
    if (!onUpdateBlock) return;
    
    newLayout.forEach((item) => {
      const block = page.blocks.find(b => b.id === item.i);
      if (block) {
        const currentLayout = block.style?.gridLayout;
        const hasChanged = 
          !currentLayout ||
          currentLayout.x !== item.x ||
          currentLayout.y !== item.y ||
          currentLayout.w !== item.w ||
          currentLayout.h !== item.h;
        
        if (hasChanged) {
          onUpdateBlock(item.i, {
            style: {
              ...block.style,
              gridLayout: {
                x: item.x,
                y: item.y,
                w: item.w,
                h: item.h,
                minW: item.minW,
                minH: item.minH,
              }
            }
          });
        }
      }
    });
  }, [page.blocks, onUpdateBlock]);

  return (
    <div className="h-full w-full overflow-y-auto p-8 flex justify-center bg-muted/50" onClick={() => onSelectBlock(null)}>
      <div 
        className="w-[800px] min-h-[1131px] bg-white shadow-sm border border-border rounded-sm relative transition-all flex flex-col group"
        style={{ padding: '0px' }}
      >
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />

        {(layout.layoutType === 'cover' || layout.layoutType === 'hero-with-body') && layout.heroImageUrl && (
            <div className="relative w-full h-[400px] overflow-hidden shrink-0">
                <img src={layout.heroImageUrl} className="w-full h-full object-cover" alt="Hero" />
                {layout.heroOverlay && <div className="absolute inset-0 bg-black/40" />}
                
                {layout.layoutType === 'cover' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-12">
                         <h1 className="text-5xl font-serif font-bold tracking-tight mb-4 drop-shadow-md">{page.title}</h1>
                         <p className="text-xl font-light tracking-wide opacity-90">INVESTMENT MEMORANDUM</p>
                    </div>
                )}
            </div>
        )}

        <div className="flex-1 flex flex-col" style={{ padding: '60px' }}>
            
            {layout.showHeader !== false && layout.layoutType !== 'cover' && (
                <div className="mb-8 pb-4 border-b flex justify-between items-end shrink-0">
                    <h2 className="text-2xl font-serif font-bold text-foreground">{page.title}</h2>
                    <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Sunset Marina OM</span>
                </div>
            )}

            {isFreeform ? (
              <div className="flex-1 relative">
                <GridLayout
                  className="layout"
                  layout={gridLayoutItems}
                  cols={GRID_COLS}
                  rowHeight={GRID_ROW_HEIGHT}
                  width={CANVAS_WIDTH - 120}
                  onLayoutChange={handleLayoutChange}
                  draggableHandle=".grid-drag-handle"
                  isResizable={true}
                  isDraggable={true}
                  compactType={null}
                  preventCollision={false}
                  margin={[16, 16]}
                  containerPadding={[0, 0]}
                >
                  {page.blocks.map((block) => (
                    <div
                      key={block.id}
                      onClick={(e) => { e.stopPropagation(); onSelectBlock(block.id); }}
                      className={cn(
                        "relative group rounded-lg transition-all outline-none bg-white",
                        selectedBlockId === block.id 
                          ? "ring-2 ring-primary ring-offset-2 z-10" 
                          : "hover:ring-1 hover:ring-primary/30"
                      )}
                    >
                      <div 
                        className={cn(
                          "grid-drag-handle absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-muted rounded-full cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-20",
                          selectedBlockId === block.id && "opacity-100"
                        )}
                      >
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 bg-muted-foreground/50 rounded-full" />
                          <div className="w-1 h-1 bg-muted-foreground/50 rounded-full" />
                          <div className="w-1 h-1 bg-muted-foreground/50 rounded-full" />
                        </div>
                      </div>
                      <div className="h-full overflow-hidden">
                        <BlockRenderer block={block} />
                      </div>
                    </div>
                  ))}
                </GridLayout>

                {page.blocks.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-40 w-full border-2 border-dashed border-muted rounded-lg flex items-center justify-center text-muted-foreground bg-muted/20">
                      Drag and drop blocks here from the sidebar
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <SortableContext items={page.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {layout.layoutType === 'two-column' ? (
                    <div className="flex gap-8 flex-1">
                        <div className="flex-1 flex flex-col gap-6" style={{ flex: `${layout.columns?.leftWidthPercent || 50} 1 0%` }}>
                            {page.blocks.filter(b => b.style?.column === 'left' || (!b.style?.column) || b.style?.column === 'auto').map(block => (
                               <SortableBlock key={block.id} block={block} isSelected={selectedBlockId === block.id} onSelect={(e) => { e.stopPropagation(); onSelectBlock(block.id); }} />
                            ))}
                        </div>
                        <div className="flex-1 flex flex-col gap-6" style={{ flex: `${layout.columns?.rightWidthPercent || 50} 1 0%` }}>
                            {page.blocks.filter(b => b.style?.column === 'right').map(block => (
                               <SortableBlock key={block.id} block={block} isSelected={selectedBlockId === block.id} onSelect={(e) => { e.stopPropagation(); onSelectBlock(block.id); }} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 flex-1">
                        {page.blocks.map((block) => (
                          <SortableBlock 
                              key={block.id} 
                              block={block} 
                              isSelected={selectedBlockId === block.id}
                              onSelect={(e) => { e.stopPropagation(); onSelectBlock(block.id); }}
                          />
                        ))}
                        {page.blocks.length === 0 && layout.layoutType !== 'cover' && (
                            <div className="h-40 border-2 border-dashed border-muted rounded-lg flex items-center justify-center text-muted-foreground bg-muted/20">
                                Drag and drop blocks here from the sidebar
                            </div>
                        )}
                    </div>
                )}
              </SortableContext>
            )}
            
            {layout.showFooter !== false && (
                <div className="mt-auto pt-8 border-t flex justify-between text-[10px] text-muted-foreground shrink-0">
                    <span>Confidential & Proprietary</span>
                    {layout.showPageNumber !== false && <span>Page {page.id.split('_')[1]}</span>}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

function SortableBlock({ block, isSelected, onSelect }: { block: OmBlock, isSelected: boolean, onSelect: (e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      onClick={onSelect}
      className={cn(
        "relative group rounded-sm transition-all outline-none",
        isSelected ? "ring-2 ring-primary ring-offset-4 ring-offset-white z-10" : "hover:ring-1 hover:ring-primary/30 hover:ring-offset-2"
      )}
    >
        <div 
            {...listeners} 
            className={cn(
                "absolute -left-8 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 transition-opacity",
                (isSelected || "group-hover:opacity-100") 
            )}
        >
            <div className="w-1.5 h-6 bg-muted-foreground/30 rounded-full" />
        </div>

      <BlockRenderer block={block} />
    </div>
  );
}
