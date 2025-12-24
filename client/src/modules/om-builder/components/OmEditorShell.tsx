import { useState, useCallback, useEffect } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Layers, Type, BarChart3, Table, Image, Gauge, 
  Square, Circle, Minus, Star, FileText, AlertCircle, Palette,
  Undo2, Redo2, Trash2
} from "lucide-react";
import type { OmBlock, OmPage, BlockType, ElementPosition } from "../types";
import { FreeformCanvas } from "./FreeformCanvas";
import { LayersPanel } from "./LayersPanel";
import { ZoomControls } from "./ZoomControls";
import { toast } from "@/hooks/use-toast";

interface OmEditorShellProps {
  pages: OmPage[];
  activePageId: string | null;
  blocks: OmBlock[];
  onUpdateBlocks: (blocks: OmBlock[]) => void;
  onAddBlock: (type: BlockType) => void;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
}

const BLOCK_PALETTE = [
  { type: 'text' as BlockType, icon: Type, label: 'Text' },
  { type: 'heading' as BlockType, icon: Type, label: 'Heading' },
  { type: 'kpi' as BlockType, icon: Gauge, label: 'KPI Card' },
  { type: 'chart' as BlockType, icon: BarChart3, label: 'Chart' },
  { type: 'table' as BlockType, icon: Table, label: 'Table' },
  { type: 'image' as BlockType, icon: Image, label: 'Image' },
  { type: 'callout' as BlockType, icon: AlertCircle, label: 'Callout' },
  { type: 'shape' as BlockType, icon: Square, label: 'Shape' },
  { type: 'icon' as BlockType, icon: Star, label: 'Icon' },
  { type: 'divider' as BlockType, icon: Minus, label: 'Divider' },
];

export function OmEditorShell({
  pages,
  activePageId,
  blocks,
  onUpdateBlocks,
  onAddBlock,
  onSelectPage,
  onAddPage,
}: OmEditorShellProps) {
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.75);
  const [showGrid, setShowGrid] = useState(true);
  const [leftTab, setLeftTab] = useState<'pages' | 'blocks' | 'layers'>('blocks');

  const activePage = pages.find(p => p.id === activePageId) || null;

  const handleSelectBlock = useCallback((blockId: string, addToSelection = false) => {
    if (addToSelection) {
      setSelectedBlockIds(prev => 
        prev.includes(blockId) 
          ? prev.filter(id => id !== blockId)
          : [...prev, blockId]
      );
    } else {
      setSelectedBlockIds([blockId]);
    }
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedBlockIds([]);
  }, []);

  const handleUpdateBlock = useCallback((blockId: string, updates: Partial<OmBlock>) => {
    const updatedBlocks = blocks.map(b => 
      b.id === blockId ? { ...b, ...updates } : b
    );
    onUpdateBlocks(updatedBlocks);
  }, [blocks, onUpdateBlocks]);

  const handleUpdateBlockPosition = useCallback((blockId: string, x: number, y: number) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const updatedBlocks = blocks.map(b => 
      b.id === blockId 
        ? { ...b, position: { ...b.position, x, y, width: b.position?.width || 200, height: b.position?.height || 100 } }
        : b
    );
    onUpdateBlocks(updatedBlocks);
  }, [blocks, onUpdateBlocks]);

  const handleUpdateBlockSize = useCallback((blockId: string, width: number, height: number) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const updatedBlocks = blocks.map(b => 
      b.id === blockId 
        ? { ...b, position: { ...b.position, x: b.position?.x || 50, y: b.position?.y || 50, width, height } }
        : b
    );
    onUpdateBlocks(updatedBlocks);
  }, [blocks, onUpdateBlocks]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    const updatedBlocks = blocks.filter(b => b.id !== blockId);
    onUpdateBlocks(updatedBlocks);
    setSelectedBlockIds(prev => prev.filter(id => id !== blockId));
    toast({ title: "Element deleted" });
  }, [blocks, onUpdateBlocks]);

  const handleDuplicateBlock = useCallback((blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const newBlock: OmBlock = {
      ...block,
      id: `block_${Date.now()}`,
      position: {
        x: (block.position?.x || 50) + 20,
        y: (block.position?.y || 50) + 20,
        width: block.position?.width || 200,
        height: block.position?.height || 100,
      },
      meta: {
        ...block.meta,
        name: `${block.meta?.name || block.type} copy`,
        zIndex: Math.max(...blocks.map(b => b.meta?.zIndex || 0)) + 1,
      }
    };
    
    onUpdateBlocks([...blocks, newBlock]);
    setSelectedBlockIds([newBlock.id]);
    toast({ title: "Element duplicated" });
  }, [blocks, onUpdateBlocks]);

  const handleReorderBlocks = useCallback((reorderedBlocks: OmBlock[]) => {
    onUpdateBlocks(reorderedBlocks);
  }, [onUpdateBlocks]);

  const handleBringForward = useCallback((blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const currentZ = block.meta?.zIndex || 0;
    const maxZ = Math.max(...blocks.map(b => b.meta?.zIndex || 0));
    
    if (currentZ < maxZ) {
      const updatedBlocks = blocks.map(b => 
        b.id === blockId 
          ? { ...b, meta: { ...b.meta, zIndex: maxZ + 1 } }
          : b
      );
      onUpdateBlocks(updatedBlocks);
    }
  }, [blocks, onUpdateBlocks]);

  const handleSendBackward = useCallback((blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    const currentZ = block.meta?.zIndex || 0;
    const minZ = Math.min(...blocks.map(b => b.meta?.zIndex || 0));
    
    if (currentZ > minZ) {
      const updatedBlocks = blocks.map(b => 
        b.id === blockId 
          ? { ...b, meta: { ...b.meta, zIndex: minZ - 1 } }
          : b
      );
      onUpdateBlocks(updatedBlocks);
    }
  }, [blocks, onUpdateBlocks]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedBlockIds.length === 0) return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      selectedBlockIds.forEach(id => handleDeleteBlock(id));
    }
    
    const nudgeAmount = e.shiftKey ? 10 : 1;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      selectedBlockIds.forEach(blockId => {
        const block = blocks.find(b => b.id === blockId);
        if (!block || block.meta?.locked) return;
        
        const pos = block.position || { x: 50, y: 50, width: 200, height: 100 };
        let newX = pos.x;
        let newY = pos.y;
        
        switch (e.key) {
          case 'ArrowUp': newY -= nudgeAmount; break;
          case 'ArrowDown': newY += nudgeAmount; break;
          case 'ArrowLeft': newX -= nudgeAmount; break;
          case 'ArrowRight': newX += nudgeAmount; break;
        }
        
        handleUpdateBlockPosition(blockId, newX, newY);
      });
    }
  }, [selectedBlockIds, blocks, handleDeleteBlock, handleUpdateBlockPosition]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-sidebar">
            <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as any)} className="h-full flex flex-col">
              <div className="p-2 border-b shrink-0">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="pages" className="text-xs" data-testid="tab-pages">
                    <FileText className="w-3 h-3 mr-1" />
                    Pages
                  </TabsTrigger>
                  <TabsTrigger value="blocks" className="text-xs" data-testid="tab-blocks">
                    <Plus className="w-3 h-3 mr-1" />
                    Blocks
                  </TabsTrigger>
                  <TabsTrigger value="layers" className="text-xs" data-testid="tab-layers">
                    <Layers className="w-3 h-3 mr-1" />
                    Layers
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="pages" className="flex-1 m-0 overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pages</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddPage} data-testid="button-add-page">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <ScrollArea className="h-[calc(100vh-200px)]">
                    {pages.map((page, index) => (
                      <button
                        key={page.id}
                        onClick={() => onSelectPage(page.id)}
                        className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors mb-1 ${
                          page.id === activePageId 
                            ? 'bg-primary/10 text-primary font-medium' 
                            : 'text-foreground hover:bg-muted'
                        }`}
                        data-testid={`button-page-${index}`}
                      >
                        {page.title}
                      </button>
                    ))}
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="blocks" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                      Add Elements
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {BLOCK_PALETTE.map(({ type, icon: Icon, label }) => (
                        <button
                          key={type}
                          onClick={() => onAddBlock(type)}
                          className="flex flex-col items-center justify-center p-3 rounded-md border border-border hover:bg-muted/50 hover:border-primary/30 transition-colors"
                          data-testid={`button-add-${type}`}
                        >
                          <Icon className="w-5 h-5 mb-1.5 text-muted-foreground" />
                          <span className="text-[11px]">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="layers" className="flex-1 m-0 overflow-hidden">
                <LayersPanel
                  blocks={blocks}
                  selectedBlockIds={selectedBlockIds}
                  onSelectBlock={handleSelectBlock}
                  onUpdateBlock={handleUpdateBlock}
                  onDeleteBlock={handleDeleteBlock}
                  onDuplicateBlock={handleDuplicateBlock}
                  onReorderBlocks={handleReorderBlocks}
                  onBringForward={handleBringForward}
                  onSendBackward={handleSendBackward}
                />
              </TabsContent>
            </Tabs>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={55} className="bg-muted/30 relative">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <ZoomControls
                zoom={zoom}
                showGrid={showGrid}
                onZoomChange={setZoom}
                onToggleGrid={() => setShowGrid(!showGrid)}
                onFitToScreen={() => setZoom(0.6)}
                onResetZoom={() => setZoom(1)}
              />
            </div>
            
            <ScrollArea className="h-full">
              <div 
                className="p-12 flex justify-center"
                style={{ minHeight: '100%' }}
              >
                <FreeformCanvas
                  page={activePage}
                  blocks={blocks}
                  selectedBlockIds={selectedBlockIds}
                  zoom={zoom}
                  showGrid={showGrid}
                  gridSize={8}
                  onSelectBlock={handleSelectBlock}
                  onClearSelection={handleClearSelection}
                  onUpdateBlock={handleUpdateBlock}
                  onUpdateBlockPosition={handleUpdateBlockPosition}
                  onUpdateBlockSize={handleUpdateBlockSize}
                />
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="bg-card border-l border-border">
            <div className="p-3 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Inspector
              </span>
            </div>
            <ScrollArea className="h-[calc(100%-40px)]">
              <div className="p-3">
                {selectedBlockIds.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Palette className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select an element</p>
                    <p className="text-xs">to view properties</p>
                  </div>
                ) : selectedBlockIds.length === 1 ? (
                  <BlockInspector 
                    block={blocks.find(b => b.id === selectedBlockIds[0])}
                    onUpdate={(updates) => handleUpdateBlock(selectedBlockIds[0], updates)}
                  />
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">{selectedBlockIds.length} elements selected</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => selectedBlockIds.forEach(id => handleDeleteBlock(id))}
                      data-testid="button-delete-selected"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete All
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function BlockInspector({ block, onUpdate }: { block?: OmBlock; onUpdate: (updates: Partial<OmBlock>) => void }) {
  if (!block) return null;
  
  const position = block.position || { x: 0, y: 0, width: 200, height: 100 };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <div className="text-sm font-medium capitalize mt-1">{block.type}</div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">X</label>
          <input
            type="number"
            value={Math.round(position.x)}
            onChange={(e) => onUpdate({
              position: { ...position, x: parseInt(e.target.value) || 0 }
            })}
            className="w-full h-7 px-2 text-xs border rounded bg-background"
            data-testid="input-pos-x"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Y</label>
          <input
            type="number"
            value={Math.round(position.y)}
            onChange={(e) => onUpdate({
              position: { ...position, y: parseInt(e.target.value) || 0 }
            })}
            className="w-full h-7 px-2 text-xs border rounded bg-background"
            data-testid="input-pos-y"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Width</label>
          <input
            type="number"
            value={Math.round(position.width)}
            onChange={(e) => onUpdate({
              position: { ...position, width: parseInt(e.target.value) || 100 }
            })}
            className="w-full h-7 px-2 text-xs border rounded bg-background"
            data-testid="input-pos-width"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Height</label>
          <input
            type="number"
            value={Math.round(position.height)}
            onChange={(e) => onUpdate({
              position: { ...position, height: parseInt(e.target.value) || 100 }
            })}
            className="w-full h-7 px-2 text-xs border rounded bg-background"
            data-testid="input-pos-height"
          />
        </div>
      </div>

      <div className="pt-2 border-t">
        <label className="text-xs font-medium text-muted-foreground">Background</label>
        <div className="flex gap-2 mt-1">
          <input
            type="color"
            value={block.style?.backgroundColor || '#ffffff'}
            onChange={(e) => onUpdate({
              style: { ...block.style, backgroundColor: e.target.value }
            })}
            className="h-7 w-10 p-0.5 rounded border cursor-pointer"
            data-testid="input-bg-color"
          />
          <button
            onClick={() => onUpdate({
              style: { ...block.style, backgroundColor: undefined }
            })}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="pt-2 border-t">
        <label className="text-xs font-medium text-muted-foreground">Layer</label>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs">Z-Index: {block.meta?.zIndex || 0}</span>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={block.meta?.locked || false}
              onChange={(e) => onUpdate({
                meta: { ...block.meta, locked: e.target.checked }
              })}
              data-testid="checkbox-locked"
            />
            Locked
          </label>
        </div>
      </div>
    </div>
  );
}

export default OmEditorShell;
