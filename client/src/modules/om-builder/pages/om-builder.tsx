import { useState, useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "@/hooks/use-toast";
import { FileDown, ArrowLeft, FileText, Plus, Trash2, GripVertical, Settings, Sparkles, Type, BarChart3, Table, Image, Gauge, Database, History, AlertCircle, Info, CheckCircle, AlertTriangle, Lightbulb, StickyNote, LayoutTemplate, Link2, Palette, AlignLeft, AlignCenter, AlignRight, Minus, RotateCcw, PenTool, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Toggle } from "@/components/ui/toggle";
import type { ModelingProject } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Om, OmPage as OmPageDb, OmBlock as OmBlockDb } from "@shared/schema";
import type { OmPage, OmBlock, BlockType, OmTheme, OmPageOrientation, CalloutVariant, FontFamily, ElementPosition } from "../types";
import { defaultThemes, CALLOUT_COLORS, FONT_FAMILIES, FONT_SIZES } from "../types";
import { DataBindingPanel } from "../components/data-binding-panel";
import { VersionHistoryPanel } from "../components/version-history-panel";
import { OmEditorShell } from "../components/OmEditorShell";

interface SortableBlockProps {
  block: OmBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<OmBlock>) => void;
}

function SortableBlock({ block, isSelected, onSelect, onUpdate }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case 'text':
        return (
          <div className="p-4 prose prose-sm max-w-none dark:prose-invert">
            {block.content?.markdown || 'Click to edit text...'}
          </div>
        );
      case 'kpi':
        return (
          <div className="p-4 flex gap-4 flex-wrap">
            {(block.content?.items || []).map((item: any, i: number) => (
              <div key={i} className="flex-1 min-w-[120px] text-center p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{item.value}</div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        );
      case 'chart':
        return (
          <div className="p-4">
            <div className="text-sm font-medium mb-2">{block.content?.title || 'Chart'}</div>
            <div className="h-32 bg-muted/50 rounded-lg flex items-center justify-center text-muted-foreground">
              <BarChart3 className="w-8 h-8" />
            </div>
          </div>
        );
      case 'image':
        return (
          <div className="p-4">
            {block.content?.url ? (
              <img src={block.content.url} alt={block.content.alt} className="w-full h-auto rounded-lg" />
            ) : (
              <div className="h-32 bg-muted/50 rounded-lg flex items-center justify-center text-muted-foreground">
                <Image className="w-8 h-8" />
              </div>
            )}
          </div>
        );
      case 'table':
        return (
          <div className="p-4">
            <div className="h-24 bg-muted/50 rounded-lg flex items-center justify-center text-muted-foreground">
              <Table className="w-8 h-8" />
            </div>
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
          <div className={`p-4 ${colors.bg} border ${colors.border} rounded-lg flex gap-3`}>
            <CalloutIcon className={`w-5 h-5 ${colors.icon} shrink-0 mt-0.5`} />
            <div className={`flex-1 ${colors.text} text-sm`}>
              {block.content?.text || 'Click to edit callout...'}
            </div>
          </div>
        );
      case 'divider':
        return (
          <div className="py-4">
            <hr className="border-t border-border" />
          </div>
        );
      case 'spacer':
        return (
          <div className="h-8 flex items-center justify-center text-muted-foreground/50">
            <Minus className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="p-4 text-muted-foreground text-sm">
            {block.type} block
          </div>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg bg-background mb-2 transition-all ${isSelected ? 'ring-2 ring-primary border-primary' : 'border-border hover:border-muted-foreground/50'}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-muted/30">
        <button {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-muted rounded">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground capitalize">{block.type}</span>
      </div>
      {renderBlockContent()}
    </div>
  );
}

export default function OMBuilder() {
  const [, params] = useRoute("/om/builder/:omId");
  const omId = params?.omId;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [pages, setPages] = useState<OmPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<OmBlock | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localModelingProjectId, setLocalModelingProjectId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'classic' | 'freeform'>('classic');

  const { data: om, isLoading: omLoading } = useQuery<Om>({
    queryKey: ['/api/om/oms', omId],
    enabled: !!omId,
  });

  useEffect(() => {
    if (om?.modelingProjectId !== undefined) {
      setLocalModelingProjectId(om.modelingProjectId);
    }
  }, [om?.modelingProjectId]);

  const { data: modelingProjects = [] } = useQuery<ModelingProject[]>({
    queryKey: ['/api/modeling/projects'],
  });

  const updateOmMutation = useMutation({
    mutationFn: async (data: { modelingProjectId?: string | null }) => {
      const result = await apiRequest('PATCH', `/api/om/oms/${omId}`, data);
      return result;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/om/oms', omId], data);
      setSettingsOpen(false);
      toast({ title: "Settings Updated" });
    },
    onError: () => {
      setLocalModelingProjectId(om?.modelingProjectId || null);
      toast({ title: "Error", description: "Failed to update settings", variant: "destructive" });
    },
  });

  const updatePageMutation = useMutation({
    mutationFn: (data: { pageId: string; title?: string; layout?: any }) =>
      apiRequest('PATCH', `/api/om/pages/${data.pageId}`, { title: data.title, layout: data.layout }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms', omId, 'pages'] });
    },
  });

  const { data: dbPages = [] } = useQuery<OmPageDb[]>({
    queryKey: ['/api/om/oms', omId, 'pages'],
    enabled: !!omId,
  });

  useEffect(() => {
    if (dbPages.length > 0) {
      const mappedPages = dbPages.map(p => ({
        id: p.id,
        title: p.title,
        layout: p.layout as any,
        blocks: [],
      }));
      setPages(mappedPages);
      if (!activePageId) {
        setActivePageId(mappedPages[0]?.id || null);
      }
    }
  }, [dbPages]);

  const createPageMutation = useMutation({
    mutationFn: (data: { omId: string; title: string; orderIndex: number }) =>
      apiRequest('POST', '/api/om/pages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms', omId, 'pages'] });
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: (data: { pageId: string; type: string; orderIndex: number; content: any }) =>
      apiRequest('POST', '/api/om/blocks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/pages', activePageId, 'blocks'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const activePage = pages.find(p => p.id === activePageId);

  const handleDragStart = (event: DragStartEvent) => {
    const block = activePage?.blocks.find(b => b.id === event.active.id);
    if (block) setDraggedBlock(block);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedBlock(null);

    if (activePage && over && active.id !== over.id) {
      const oldIndex = activePage.blocks.findIndex((b) => b.id === active.id);
      const newIndex = activePage.blocks.findIndex((b) => b.id === over.id);

      const newBlocks = arrayMove(activePage.blocks, oldIndex, newIndex);
      setPages(prev => prev.map(p => 
        p.id === activePageId ? { ...p, blocks: newBlocks } : p
      ));
    }
  };

  const addBlock = (type: BlockType) => {
    if (!activePageId) return;
    
    const newBlock: OmBlock = {
      id: `block_${Date.now()}`,
      type,
      content: getDefaultContentForType(type),
      style: getDefaultStyleForType(type)
    };

    setPages(prev => prev.map(p => 
      p.id === activePageId ? { ...p, blocks: [...p.blocks, newBlock] } : p
    ));
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (blockId: string, updates: Partial<OmBlock>) => {
    if (!activePage) return;
    setPages(prev => prev.map(p => 
      p.id === activePageId 
        ? { ...p, blocks: p.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b) }
        : p
    ));
  };

  const deleteBlock = () => {
    if (!activePage || !selectedBlockId) return;
    setPages(prev => prev.map(p => 
      p.id === activePageId 
        ? { ...p, blocks: p.blocks.filter(b => b.id !== selectedBlockId) }
        : p
    ));
    setSelectedBlockId(null);
    toast({ title: "Block Deleted" });
  };

  const addPage = async () => {
    if (!omId) return;
    
    try {
      const newPage = await createPageMutation.mutateAsync({
        omId,
        title: `Page ${pages.length + 1}`,
        orderIndex: pages.length,
      });
      
      const localPage: OmPage = {
        id: newPage.id,
        title: newPage.title,
        blocks: [],
      };
      
      setPages(prev => [...prev, localPage]);
      setActivePageId(newPage.id);
      setSelectedBlockId(null);
      toast({ title: "Page Added" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add page", variant: "destructive" });
    }
  };

  const getDefaultContentForType = (type: BlockType): any => {
    switch (type) {
      case 'text': return { markdown: "Double click to edit text..." };
      case 'kpi': return { items: [{ label: "Metric", value: "$0", subtext: "Description" }] };
      case 'chart': return { title: "New Chart", chartType: "bar", data: [
        { name: 'A', value: 100 }, { name: 'B', value: 200 }, { name: 'C', value: 150 }
      ]};
      case 'image': return { url: "", alt: "Placeholder" };
      case 'table': return { columns: [], rows: [] };
      case 'callout': return { text: "Add your callout text here..." };
      case 'divider': return {};
      case 'spacer': return { height: '2rem' };
      default: return {};
    }
  };

  const getDefaultStyleForType = (type: BlockType): any => {
    switch (type) {
      case 'callout': return { calloutVariant: 'info' };
      default: return {};
    }
  };

  const activeBlock = activePage?.blocks.find(b => b.id === selectedBlockId);

  if (omLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full bg-background overflow-hidden flex flex-col">
      <header className="h-12 border-b border-border bg-background flex items-center px-4 justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/om" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-oms">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight" data-testid="text-om-name">
                {om?.name || "Offering Memorandum"}
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">Draft</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={editorMode === 'classic' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setEditorMode('classic')}
              data-testid="button-mode-classic"
            >
              <Type className="w-3.5 h-3.5 mr-1" />
              Classic
            </Button>
            <Button
              variant={editorMode === 'freeform' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => setEditorMode('freeform')}
              data-testid="button-mode-freeform"
            >
              <Layers className="w-3.5 h-3.5 mr-1" />
              Design
            </Button>
          </div>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-doc-settings">
                <Settings className="w-4 h-4 mr-1" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Document Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium">Linked Modeling Project</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Link this document to a modeling project to bind financial data
                  </p>
                  <Select 
                    value={localModelingProjectId || 'none'}
                    onValueChange={(value) => {
                      const newValue = value === 'none' ? null : value;
                      setLocalModelingProjectId(newValue);
                      updateOmMutation.mutate({ modelingProjectId: newValue });
                    }}
                  >
                    <SelectTrigger data-testid="select-modeling-project">
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked project</SelectItem>
                      {modelingProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {localModelingProjectId && (
                    <div className="mt-2 p-2 bg-muted rounded-md flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-primary" />
                      <span className="text-xs">
                        Linked to: {modelingProjects.find(p => p.id === localModelingProjectId)?.name || 'Unknown'}
                      </span>
                    </div>
                  )}
                </div>
                <Separator />
                <div>
                  <Label className="text-sm font-medium">Document Name</Label>
                  <Input 
                    value={om?.name || ''} 
                    className="mt-2"
                    disabled
                    data-testid="input-doc-name"
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Link href={`/om/export/${omId}`} className="h-9 px-4 py-2 text-sm border border-input bg-background hover:bg-accent rounded-md text-foreground font-medium transition-colors flex items-center gap-2" data-testid="link-preview">
            Preview
          </Link>
          <Link href={`/om/export/${omId}`} className="h-9 px-4 py-2 text-sm bg-primary hover:brightness-110 rounded-md text-primary-foreground font-medium transition-all flex items-center gap-2" data-testid="link-export-pdf">
            <FileDown className="w-4 h-4" />
            Export PDF
          </Link>
        </div>
      </header>

      {editorMode === 'freeform' ? (
        <OmEditorShell
          pages={pages}
          activePageId={activePageId}
          blocks={activePage?.blocks || []}
          onUpdateBlocks={(newBlocks) => {
            setPages(prev => prev.map(p => 
              p.id === activePageId ? { ...p, blocks: newBlocks } : p
            ));
          }}
          onAddBlock={(type) => {
            if (!activePageId) return;
            const newBlock: OmBlock = {
              id: `block_${Date.now()}`,
              type,
              content: getDefaultContentForType(type),
              style: getDefaultStyleForType(type),
              position: { x: 50, y: 50, width: 200, height: 100 },
              meta: { zIndex: (activePage?.blocks.length || 0) + 1 }
            };
            setPages(prev => prev.map(p => 
              p.id === activePageId ? { ...p, blocks: [...p.blocks, newBlock] } : p
            ));
          }}
          onSelectPage={(pageId) => {
            setActivePageId(pageId);
            setSelectedBlockId(null);
          }}
          onAddPage={addPage}
        />
      ) : (
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={18} minSize={15} maxSize={25} className="bg-sidebar">
            <div className="h-full flex flex-col">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pages</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addPage} data-testid="button-add-page">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <ScrollArea className="h-40">
                  {pages.map((page, index) => (
                    <button
                      key={page.id}
                      onClick={() => { setActivePageId(page.id); setSelectedBlockId(null); }}
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
                  {pages.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No pages yet. Click + to add.
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="p-3 border-b">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Add Block</span>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { type: 'text' as BlockType, icon: Type, label: 'Text' },
                    { type: 'kpi' as BlockType, icon: Gauge, label: 'KPI' },
                    { type: 'chart' as BlockType, icon: BarChart3, label: 'Chart' },
                    { type: 'table' as BlockType, icon: Table, label: 'Table' },
                    { type: 'image' as BlockType, icon: Image, label: 'Image' },
                    { type: 'callout' as BlockType, icon: AlertCircle, label: 'Callout' },
                    { type: 'divider' as BlockType, icon: Minus, label: 'Divider' },
                  ].map(({ type, icon: Icon, label }) => (
                    <button
                      key={type}
                      onClick={() => addBlock(type)}
                      className="flex flex-col items-center justify-center p-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
                      data-testid={`button-add-${type}`}
                    >
                      <Icon className="w-4 h-4 mb-1" />
                      <span className="text-[10px]">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 flex-1">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Theme</span>
                <div className="space-y-1">
                  {defaultThemes.slice(0, 3).map((theme) => (
                    <div
                      key={theme.id}
                      className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: theme.colors.primary }}
                      />
                      <span className="text-xs">{theme.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ResizablePanel>
          
          <ResizableHandle />

          <ResizablePanel defaultSize={57} className="bg-muted/50 relative">
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragStart={handleDragStart} 
              onDragEnd={handleDragEnd}
            >
              <ScrollArea className="h-full">
                <div className="p-6 max-w-3xl mx-auto">
                  <div className="bg-background border border-border rounded-lg shadow-sm min-h-[800px] p-8">
                    {activePage ? (
                      <>
                        <h2 className="text-xl font-semibold mb-4 text-center">{activePage.title}</h2>
                        <SortableContext items={activePage.blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                          {activePage.blocks.map((block) => (
                            <SortableBlock
                              key={block.id}
                              block={block}
                              isSelected={block.id === selectedBlockId}
                              onSelect={() => setSelectedBlockId(block.id)}
                              onUpdate={(updates) => updateBlock(block.id, updates)}
                            />
                          ))}
                        </SortableContext>
                        {activePage.blocks.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                            <FileText className="w-12 h-12 mb-4" />
                            <p className="text-sm">This page is empty</p>
                            <p className="text-xs">Add blocks from the sidebar</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                        <FileText className="w-12 h-12 mb-4" />
                        <p className="text-sm">No page selected</p>
                        <p className="text-xs">Create a page to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
              <DragOverlay>
                {draggedBlock ? (
                  <div className="bg-white p-4 border shadow-lg rounded opacity-80 w-64">
                    Moving Block...
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="bg-card border-l border-border">
            <Tabs defaultValue="properties" className="h-full flex flex-col">
              <div className="p-2 border-b">
                <TabsList className="w-full grid grid-cols-3">
                  <TabsTrigger value="properties" className="text-xs" data-testid="tab-properties">
                    <Settings className="w-3 h-3 mr-1" />
                    Properties
                  </TabsTrigger>
                  <TabsTrigger value="data" className="text-xs" data-testid="tab-data">
                    <Database className="w-3 h-3 mr-1" />
                    Data
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs" data-testid="tab-history">
                    <History className="w-3 h-3 mr-1" />
                    Versions
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="properties" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full p-3">
                  {activeBlock ? (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs">Block Type</Label>
                        <div className="text-sm font-medium capitalize mt-1">{activeBlock.type}</div>
                      </div>
                      
                      {activeBlock.type === 'text' && (
                        <div>
                          <Label className="text-xs">Content</Label>
                          <Textarea 
                            value={activeBlock.content?.markdown || ''}
                            onChange={(e) => updateBlock(activeBlock.id, { 
                              content: { ...activeBlock.content, markdown: e.target.value }
                            })}
                            className="mt-1 min-h-[120px]"
                            data-testid="textarea-block-content"
                          />
                        </div>
                      )}

                      {activeBlock.type === 'chart' && (
                        <div>
                          <Label className="text-xs">Chart Title</Label>
                          <Input 
                            value={activeBlock.content?.title || ''}
                            onChange={(e) => updateBlock(activeBlock.id, { 
                              content: { ...activeBlock.content, title: e.target.value }
                            })}
                            className="mt-1"
                            data-testid="input-chart-title"
                          />
                        </div>
                      )}

                      {activeBlock.type === 'image' && (
                        <div>
                          <Label className="text-xs">Image URL</Label>
                          <Input 
                            value={activeBlock.content?.url || ''}
                            onChange={(e) => updateBlock(activeBlock.id, { 
                              content: { ...activeBlock.content, url: e.target.value }
                            })}
                            className="mt-1"
                            placeholder="https://..."
                            data-testid="input-image-url"
                          />
                        </div>
                      )}

                      {activeBlock.type === 'callout' && (
                        <>
                          <div>
                            <Label className="text-xs">Callout Text</Label>
                            <Textarea 
                              value={activeBlock.content?.text || ''}
                              onChange={(e) => updateBlock(activeBlock.id, { 
                                content: { ...activeBlock.content, text: e.target.value }
                              })}
                              className="mt-1 min-h-[80px]"
                              data-testid="textarea-callout-text"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Callout Style</Label>
                            <Select 
                              value={activeBlock.style?.calloutVariant || 'info'}
                              onValueChange={(value) => updateBlock(activeBlock.id, { 
                                style: { ...activeBlock.style, calloutVariant: value as CalloutVariant }
                              })}
                            >
                              <SelectTrigger className="mt-1" data-testid="select-callout-variant">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="info">Info</SelectItem>
                                <SelectItem value="success">Success</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="error">Error</SelectItem>
                                <SelectItem value="tip">Tip</SelectItem>
                                <SelectItem value="note">Note</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      {(activeBlock.type === 'text' || activeBlock.type === 'callout') && (
                        <div className="pt-2 border-t">
                          <Label className="text-xs font-medium flex items-center gap-1 mb-2">
                            <Palette className="w-3 h-3" />
                            Typography
                          </Label>
                          <div className="space-y-2">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Font Family</Label>
                              <Select 
                                value={activeBlock.style?.typography?.fontFamily || 'sans'}
                                onValueChange={(value) => updateBlock(activeBlock.id, { 
                                  style: { 
                                    ...activeBlock.style, 
                                    typography: { ...activeBlock.style?.typography, fontFamily: value as FontFamily }
                                  }
                                })}
                              >
                                <SelectTrigger className="mt-1 h-8" data-testid="select-font-family">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sans">Sans Serif</SelectItem>
                                  <SelectItem value="serif">Serif</SelectItem>
                                  <SelectItem value="mono">Monospace</SelectItem>
                                  <SelectItem value="display">Display</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Font Size</Label>
                              <Select 
                                value={activeBlock.style?.typography?.fontSize || 'base'}
                                onValueChange={(value) => updateBlock(activeBlock.id, { 
                                  style: { 
                                    ...activeBlock.style, 
                                    typography: { ...activeBlock.style?.typography, fontSize: value }
                                  }
                                })}
                              >
                                <SelectTrigger className="mt-1 h-8" data-testid="select-font-size">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FONT_SIZES.map(({ value, label }) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Alignment</Label>
                              <div className="flex gap-1 mt-1">
                                {[
                                  { value: 'left', icon: AlignLeft },
                                  { value: 'center', icon: AlignCenter },
                                  { value: 'right', icon: AlignRight },
                                ].map(({ value, icon: Icon }) => (
                                  <Button
                                    key={value}
                                    variant={activeBlock.style?.textAlign === value ? 'secondary' : 'ghost'}
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => updateBlock(activeBlock.id, { 
                                      style: { ...activeBlock.style, textAlign: value as 'left' | 'center' | 'right' }
                                    })}
                                    data-testid={`button-align-${value}`}
                                  >
                                    <Icon className="w-3 h-3" />
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="pt-2 border-t">
                        <Label className="text-xs font-medium flex items-center gap-1 mb-2">
                          <LayoutTemplate className="w-3 h-3" />
                          Block Appearance
                        </Label>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Background Color</Label>
                            <div className="flex gap-2 mt-1">
                              <Input 
                                type="color"
                                value={activeBlock.style?.backgroundColor || '#ffffff'}
                                onChange={(e) => updateBlock(activeBlock.id, { 
                                  style: { ...activeBlock.style, backgroundColor: e.target.value }
                                })}
                                className="h-8 w-12 p-1"
                                data-testid="input-block-bg-color"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => updateBlock(activeBlock.id, { 
                                  style: { ...activeBlock.style, backgroundColor: undefined }
                                })}
                              >
                                Clear
                              </Button>
                            </div>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Border Style</Label>
                            <Select 
                              value={activeBlock.style?.border?.style || 'none'}
                              onValueChange={(value) => updateBlock(activeBlock.id, { 
                                style: { 
                                  ...activeBlock.style, 
                                  border: { 
                                    ...activeBlock.style?.border, 
                                    style: value as 'solid' | 'dashed' | 'dotted' | 'none',
                                    width: value !== 'none' ? (activeBlock.style?.border?.width || '1px') : undefined
                                  }
                                }
                              })}
                            >
                              <SelectTrigger className="mt-1 h-8" data-testid="select-border-style">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="solid">Solid</SelectItem>
                                <SelectItem value="dashed">Dashed</SelectItem>
                                <SelectItem value="dotted">Dotted</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {activeBlock.style?.border?.style && activeBlock.style.border.style !== 'none' && (
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Border Color</Label>
                              <Input 
                                type="color"
                                value={activeBlock.style?.border?.color || '#e5e5e5'}
                                onChange={(e) => updateBlock(activeBlock.id, { 
                                  style: { 
                                    ...activeBlock.style, 
                                    border: { ...activeBlock.style?.border, color: e.target.value }
                                  }
                                })}
                                className="mt-1 h-8 w-full p-1"
                                data-testid="input-border-color"
                              />
                            </div>
                          )}
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Shadow</Label>
                            <Select 
                              value={activeBlock.style?.shadow || 'none'}
                              onValueChange={(value) => updateBlock(activeBlock.id, { 
                                style: { ...activeBlock.style, shadow: value as 'none' | 'sm' | 'md' | 'lg' }
                              })}
                            >
                              <SelectTrigger className="mt-1 h-8" data-testid="select-shadow">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="sm">Small</SelectItem>
                                <SelectItem value="md">Medium</SelectItem>
                                <SelectItem value="lg">Large</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Corner Radius</Label>
                            <Select 
                              value={activeBlock.style?.border?.radius || 'md'}
                              onValueChange={(value) => updateBlock(activeBlock.id, { 
                                style: { 
                                  ...activeBlock.style, 
                                  border: { ...activeBlock.style?.border, radius: value }
                                }
                              })}
                            >
                              <SelectTrigger className="mt-1 h-8" data-testid="select-radius">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="sm">Small</SelectItem>
                                <SelectItem value="md">Medium</SelectItem>
                                <SelectItem value="lg">Large</SelectItem>
                                <SelectItem value="full">Full</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Padding</Label>
                            <Select 
                              value={activeBlock.style?.padding || 'md'}
                              onValueChange={(value) => updateBlock(activeBlock.id, { 
                                style: { ...activeBlock.style, padding: value }
                              })}
                            >
                              <SelectTrigger className="mt-1 h-8" data-testid="select-padding">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="sm">Small</SelectItem>
                                <SelectItem value="md">Medium</SelectItem>
                                <SelectItem value="lg">Large</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="w-full" 
                          onClick={deleteBlock}
                          data-testid="button-delete-block"
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          Delete Block
                        </Button>
                      </div>
                    </div>
                  ) : activePage ? (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs">Page Title</Label>
                        <Input 
                          value={activePage.title}
                          onChange={(e) => {
                            setPages(prev => prev.map(p => 
                              p.id === activePageId ? { ...p, title: e.target.value } : p
                            ));
                          }}
                          onBlur={(e) => {
                            if (activePage.id) {
                              updatePageMutation.mutate({ pageId: activePage.id, title: e.target.value });
                            }
                          }}
                          className="mt-1"
                          data-testid="input-page-title"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Layout</Label>
                        <Select 
                          value={activePage.layout?.layoutType || 'single-column'}
                          onValueChange={(value) => {
                            const newLayout = { ...activePage.layout, layoutType: value as any };
                            setPages(prev => prev.map(p => 
                              p.id === activePageId ? { ...p, layout: newLayout } : p
                            ));
                            updatePageMutation.mutate({ pageId: activePage.id, layout: newLayout });
                          }}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-page-layout">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single-column">Single Column</SelectItem>
                            <SelectItem value="two-column">Two Column</SelectItem>
                            <SelectItem value="cover">Cover Page</SelectItem>
                            <SelectItem value="grid">Grid Layout</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Orientation</Label>
                        <Select 
                          value={activePage.layout?.orientation || 'portrait'}
                          onValueChange={(value) => {
                            const newLayout = { ...activePage.layout, orientation: value as OmPageOrientation };
                            setPages(prev => prev.map(p => 
                              p.id === activePageId ? { ...p, layout: newLayout } : p
                            ));
                            updatePageMutation.mutate({ pageId: activePage.id, layout: newLayout });
                          }}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-page-orientation">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portrait">Portrait</SelectItem>
                            <SelectItem value="landscape">Landscape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Background Color</Label>
                        <Input 
                          type="color"
                          value={activePage.layout?.backgroundColor || '#ffffff'}
                          onChange={(e) => {
                            const newLayout = { ...activePage.layout, backgroundColor: e.target.value };
                            setPages(prev => prev.map(p => 
                              p.id === activePageId ? { ...p, layout: newLayout } : p
                            ));
                          }}
                          onBlur={(e) => {
                            if (activePage.id) {
                              updatePageMutation.mutate({ 
                                pageId: activePage.id, 
                                layout: { ...activePage.layout, backgroundColor: e.target.value }
                              });
                            }
                          }}
                          className="mt-1 h-8 w-full p-1"
                          data-testid="input-page-bg-color"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm py-8">
                      Select a page or block to edit properties
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="data" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full p-3">
                  <DataBindingPanel
                    omId={omId || ''}
                    dealId={om?.dealId}
                    modelingProjectId={om?.modelingProjectId}
                    selectedBlock={activeBlock}
                    onBindField={(blockId, fieldPath, fieldValue) => {
                      if (activeBlock?.type === 'text') {
                        const currentContent = activeBlock.content?.markdown || '';
                        const insertText = fieldValue !== null && fieldValue !== undefined 
                          ? String(fieldValue) 
                          : '';
                        updateBlock(blockId, {
                          content: { 
                            ...activeBlock.content, 
                            markdown: currentContent + (currentContent ? ' ' : '') + insertText 
                          }
                        });
                        toast({
                          title: "Field Inserted",
                          description: `Added value to text block.`,
                        });
                      }
                    }}
                  />
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="history" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full p-3">
                  {omId && (
                    <VersionHistoryPanel
                      omId={omId}
                      currentSnapshot={{ pages }}
                      onRestore={(snapshot) => {
                        if (snapshot?.pages) {
                          setPages(snapshot.pages);
                          toast({
                            title: "Version Restored",
                            description: "Document has been restored to the selected version.",
                          });
                        }
                      }}
                    />
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
      )}
    </div>
  );
}
