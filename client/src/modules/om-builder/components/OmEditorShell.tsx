import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, Layers, Type, BarChart3, Table, Image, Gauge, 
  Square, Circle, Minus, Star, FileText, AlertCircle, Palette
} from "lucide-react";
import type { OmBlock, OmPage, BlockType, ElementPosition } from "../types";
import { FreeformCanvas } from "./FreeformCanvas";
import { LayersPanel } from "./LayersPanel";
import { ZoomControls } from "./ZoomControls";
import { EditorToolbar } from "./EditorToolbar";
import { CanvasRulers } from "./CanvasRulers";
import { PrintMarginOverlay } from "./PrintMarginOverlay";
import { MarqueeSelection } from "./MarqueeSelection";
import { useEditorStore } from "../store/editor-store";
import { useEditorKeyboard } from "../hooks/useEditorKeyboard";
import { useAutosave } from "../hooks/useAutosave";
import { toast } from "@/hooks/use-toast";

function areBlocksEqual(a: OmBlock[], b: OmBlock[] | null): boolean {
  if (b === null) return false;
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

interface OmEditorShellProps {
  omId?: string;
  pages: OmPage[];
  activePageId: string | null;
  blocks: OmBlock[];
  canvasWidth?: number;
  canvasHeight?: number;
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
  omId,
  pages,
  activePageId,
  blocks: externalBlocks,
  canvasWidth = 816,
  canvasHeight = 1056,
  onUpdateBlocks,
  onAddBlock,
  onSelectPage,
  onAddPage,
}: OmEditorShellProps) {
  const [leftTab, setLeftTab] = useState<'pages' | 'blocks' | 'layers'>('blocks');
  const lastSyncedBlocksRef = useRef<OmBlock[] | null>(null);
  const isSyncingFromExternalRef = useRef(true);
  
  const {
    blocks,
    selectedBlockIds,
    zoom,
    showGrid,
    showRulers,
    showBleedMargins,
    snapToGrid,
    gridSize,
    autosave,
    setBlocks,
    setPages,
    setSelectedBlockIds,
    selectBlock,
    clearSelection,
    updateBlock,
    updateBlockPosition,
    updateBlockSize,
    deleteBlock,
    duplicateBlock,
    bringForward,
    sendBackward,
    pushToHistory,
    setZoom,
    setShowGrid,
    setShowRulers,
    setShowBleedMargins,
    setSnapToGrid,
  } = useEditorStore();
  
  useEditorKeyboard();
  
  const { isSaving, lastSavedAt, hasUnsavedChanges, error: autosaveError } = useAutosave({
    omId: omId || null,
    enabled: !!omId,
  });

  useLayoutEffect(() => {
    if (!areBlocksEqual(externalBlocks, lastSyncedBlocksRef.current)) {
      isSyncingFromExternalRef.current = true;
      lastSyncedBlocksRef.current = externalBlocks;
      setBlocks(externalBlocks);
    }
  }, [externalBlocks, setBlocks]);

  useEffect(() => {
    if (isSyncingFromExternalRef.current) {
      isSyncingFromExternalRef.current = false;
      return;
    }
    if (!areBlocksEqual(blocks, lastSyncedBlocksRef.current)) {
      lastSyncedBlocksRef.current = blocks;
      onUpdateBlocks(blocks);
    }
  }, [blocks, onUpdateBlocks]);

  useEffect(() => {
    setPages(pages);
  }, [pages, setPages]);

  const activePage = pages.find(p => p.id === activePageId) || null;

  const handleSelectBlock = useCallback((blockId: string, addToSelection = false) => {
    selectBlock(blockId, addToSelection);
  }, [selectBlock]);

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleUpdateBlock = useCallback((blockId: string, updates: Partial<OmBlock>) => {
    updateBlock(blockId, updates);
  }, [updateBlock]);

  const handleUpdateBlockPosition = useCallback((blockId: string, x: number, y: number) => {
    updateBlockPosition(blockId, x, y);
  }, [updateBlockPosition]);

  const handleUpdateBlockSize = useCallback((blockId: string, width: number, height: number) => {
    updateBlockSize(blockId, width, height);
  }, [updateBlockSize]);

  const handleDeleteBlock = useCallback((blockId: string) => {
    deleteBlock(blockId);
    toast({ title: "Element deleted" });
  }, [deleteBlock]);

  const handleDuplicateBlock = useCallback((blockId: string) => {
    duplicateBlock(blockId);
    toast({ title: "Element duplicated" });
  }, [duplicateBlock]);

  const handleReorderBlocks = useCallback((reorderedBlocks: OmBlock[]) => {
    setBlocks(reorderedBlocks);
  }, [setBlocks]);

  const handleBringForward = useCallback((blockId: string) => {
    bringForward(blockId);
  }, [bringForward]);

  const handleSendBackward = useCallback((blockId: string) => {
    sendBackward(blockId);
  }, [sendBackward]);

  const handleMarqueeSelect = useCallback((blockIds: string[]) => {
    setSelectedBlockIds(blockIds);
  }, [setSelectedBlockIds]);

  return (
    <div className="h-full flex flex-col">
      <EditorToolbar
        omId={omId}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        hasUnsavedChanges={hasUnsavedChanges}
        autosaveError={autosaveError}
      />
      
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
                  <ScrollArea className="h-[calc(100dvh-200px)]">
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
                showRulers={showRulers}
                showBleedMargins={showBleedMargins}
                snapToGrid={snapToGrid}
                onZoomChange={setZoom}
                onToggleGrid={() => setShowGrid(!showGrid)}
                onToggleRulers={() => setShowRulers(!showRulers)}
                onToggleBleedMargins={() => setShowBleedMargins(!showBleedMargins)}
                onToggleSnapToGrid={() => setSnapToGrid(!snapToGrid)}
                onFitToScreen={() => setZoom(0.6)}
                onResetZoom={() => setZoom(1)}
              />
            </div>
            
            <ScrollArea className="h-full">
              <div 
                className="p-12 flex justify-center relative"
                style={{ minHeight: '100%' }}
              >
                <div className="relative">
                  {showRulers && (
                    <CanvasRulers
                      width={canvasWidth}
                      height={canvasHeight}
                      zoom={zoom}
                    />
                  )}
                  
                  <div style={{ marginLeft: showRulers ? 20 : 0, marginTop: showRulers ? 20 : 0 }}>
                    <MarqueeSelection
                      blocks={blocks}
                      zoom={zoom}
                      onSelectionComplete={handleMarqueeSelect}
                    >
                      <div className="relative">
                        <FreeformCanvas
                          page={activePage}
                          blocks={blocks}
                          selectedBlockIds={selectedBlockIds}
                          zoom={zoom}
                          showGrid={showGrid}
                          gridSize={gridSize}
                          canvasWidth={canvasWidth}
                          canvasHeight={canvasHeight}
                          showGuides={true}
                          snapToGrid={snapToGrid}
                          onSelectBlock={handleSelectBlock}
                          onClearSelection={handleClearSelection}
                          onUpdateBlock={handleUpdateBlock}
                          onUpdateBlockPosition={handleUpdateBlockPosition}
                          onUpdateBlockSize={handleUpdateBlockSize}
                          onHistoryPush={pushToHistory}
                        />
                        
                        {showBleedMargins && (
                          <PrintMarginOverlay
                            canvasWidth={canvasWidth}
                            canvasHeight={canvasHeight}
                            zoom={zoom}
                            showBleed={true}
                            showTrim={true}
                            showSafety={true}
                          />
                        )}
                      </div>
                    </MarqueeSelection>
                  </div>
                </div>
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
                    <p className="text-xs mt-1 text-muted-foreground/70">
                      Ctrl+G to group
                    </p>
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
