import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sidebar } from "@/components/om-builder/sidebar";
import { Canvas } from "@/components/om-builder/canvas";
import { Inspector } from "@/components/om-builder/inspector";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, closestCenter } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { OmPage, OmBlock, OmProject, BlockType, OmTheme } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { FileDown, ArrowLeft, FileText } from "lucide-react";
import { useOmContext } from "@/lib/om-context";

// Initial Mock Data
const initialProject: OmProject = {
  id: "proj_1",
  name: "Sunset Marina – Investor OM v1",
  pages: [
    {
      id: "page_1",
      title: "Cover Page",
      blocks: [
        {
          id: "block_1",
          type: "text",
          content: { markdown: "# Sunset Marina\n## Exclusive Investment Opportunity\n\n**San Diego, CA**" },
          style: { textAlign: "center", paddingTop: "100px" }
        },
        {
           id: "block_image_1",
           type: "image",
           content: { url: "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?auto=format&fit=crop&q=80&w=1000", alt: "Marina Sunset" },
           style: { height: "300px", objectFit: "cover", width: "100%" }
        }
      ]
    },
    {
      id: "page_2",
      title: "Executive Summary",
      blocks: [
        {
          id: "block_2",
          type: "text",
          content: { markdown: "### Executive Summary\nSunset Marina is a premier 450-slip facility located in the heart of San Diego's waterfront district. This offering represents a unique opportunity to acquire a stabilized asset with significant value-add potential through slip reconfiguration and operational efficiencies." }
        },
        {
          id: "block_kpi_1",
          type: "kpi",
          content: { 
            items: [
              { label: "Purchase Price", value: "$12,500,000", subtext: "$27k per slip" },
              { label: "Cap Rate (Yr 1)", value: "6.5%", subtext: "Pro Forma: 7.8%" },
              { label: "Occupancy", value: "94%", subtext: "Waitlist: 45 boats" }
            ]
          }
        }
      ]
    },
    {
       id: "page_3",
       title: "Financial Overview",
       blocks: [
         {
           id: "block_chart_1",
           type: "chart",
           content: { 
             title: "Net Operating Income (5-Year Projection)",
             chartType: "bar",
             data: [
               { name: 'Yr 1', value: 812500 },
               { name: 'Yr 2', value: 850000 },
               { name: 'Yr 3', value: 910000 },
               { name: 'Yr 4', value: 980000 },
               { name: 'Yr 5', value: 1050000 },
             ]
           }
         },
         {
            id: "block_table_1",
            type: "table",
            content: {},
            style: { marginTop: '20px' }
         }
       ]
    }
  ]
};

export default function OMBuilder() {
  const { setProject: setContextProject } = useOmContext();
  const [project, setProject] = useState<OmProject>(initialProject);
  const [activePageId, setActivePageId] = useState<string>(initialProject.pages[0].id);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<OmBlock | null>(null);

  const activePage = project.pages.find(p => p.id === activePageId);

  // Sync project state to context for export view access
  useEffect(() => {
    setContextProject(project);
  }, [project, setContextProject]);

  // Apply theme to CSS variables when project theme changes
  useEffect(() => {
    if (project.theme) {
       // Theme CSS variable application would go here
    }
  }, [project.theme]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const block = activePage?.blocks.find(b => b.id === active.id);
    if (block) setDraggedBlock(block);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedBlock(null);

    if (activePage && over && active.id !== over.id) {
      const oldIndex = activePage.blocks.findIndex((b) => b.id === active.id);
      const newIndex = activePage.blocks.findIndex((b) => b.id === over.id);

      const newBlocks = arrayMove(activePage.blocks, oldIndex, newIndex);
      updatePageBlocks(activePageId, newBlocks);
    }
  };

  const updatePageBlocks = (pageId: string, blocks: OmBlock[]) => {
    setProject(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === pageId ? { ...p, blocks } : p)
    }));
  };

  const addBlock = (type: BlockType) => {
    if (!activePage) return;
    
    const newBlock: OmBlock = {
      id: `block_${Date.now()}`,
      type,
      content: getDefaultContentForType(type),
      style: {}
    };

    updatePageBlocks(activePageId, [...activePage.blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const updateBlock = (blockId: string, updates: Partial<OmBlock>) => {
    if (!activePage) return;
    const newBlocks = activePage.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b);
    updatePageBlocks(activePageId, newBlocks);
  };

  const updatePage = (updates: Partial<OmPage>) => {
    if (!activePage) return;
    setProject(prev => ({
        ...prev,
        pages: prev.pages.map(p => p.id === activePageId ? { ...p, ...updates } : p)
    }));
  };

  const handleThemeSelect = (theme: OmTheme) => {
      setProject(prev => ({ ...prev, theme }));
      // In a real app, we'd probably apply this to the document root or a theme provider context
      // For this mockup, we can use inline styles on the canvas or just CSS vars
      document.documentElement.style.setProperty('--font-serif', theme.typography.headingFont === 'font-serif' ? "'Libre Baskerville', serif" : "'Inter', sans-serif");
      document.documentElement.style.setProperty('--font-sans', theme.typography.bodyFont === 'font-sans' ? "'Inter', sans-serif" : "'Libre Baskerville', serif");
      // Add more variable mappings here for colors if we converted hex to HSL
  };

  const handleAiAction = (action: string) => {
      if (!activePage) return;

      toast({
          title: "AI Agent Working...",
          description: "Analyzing deal data and generating content."
      });

      setTimeout(() => {
          if (action === 'draft_exec_summary') {
              const newBlock: OmBlock = {
                  id: `ai_block_${Date.now()}`,
                  type: 'text',
                  content: { 
                      markdown: "### Investment Highlights\n\n*   **Prime Location:** Situated in the high-demand San Diego waterfront district, ensuring consistent occupancy and premium rates.\n*   **Value-Add Potential:** Opportunity to increase revenue by 15% through slip reconfiguration and introducing concierge services.\n*   **Strong Financials:** Consistent historical NOI with projected 6.5% cap rate in Year 1.\n\n### Market Overview\n\nThe San Diego marina market remains tight with waitlists at all major competitors. Demand for 50'+ slips has outpaced supply by 3:1 over the last 24 months." 
                  },
                  style: { marginTop: '20px' }
              };
              updatePageBlocks(activePageId, [...activePage.blocks, newBlock]);
              setSelectedBlockId(newBlock.id);
              toast({ title: "Draft Created", description: "Executive summary draft added to page." });
          } else if (action === 'generate_market') {
               const newBlock: OmBlock = {
                  id: `ai_block_${Date.now()}`,
                  type: 'chart',
                  content: {
                      title: "Market Rent Growth (Last 5 Years)",
                      chartType: "line",
                      data: [
                          { name: '2020', value: 22 },
                          { name: '2021', value: 24 },
                          { name: '2022', value: 25 },
                          { name: '2023', value: 28 },
                          { name: '2024', value: 31 }
                      ]
                  },
                  style: { marginTop: '20px' }
              };
              updatePageBlocks(activePageId, [...activePage.blocks, newBlock]);
              setSelectedBlockId(newBlock.id);
              toast({ title: "Analysis Generated", description: "Market growth chart added." });
          }
      }, 1500);
  };

  const handleInsertAiContent = (content: string) => {
    if (!activePage) return;

    const newBlock: OmBlock = {
      id: `ai_block_${Date.now()}`,
      type: 'text',
      content: { markdown: content },
      style: { marginTop: '20px' }
    };
    
    updatePageBlocks(activePageId, [...activePage.blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    toast({ title: "Content Added", description: "AI-generated content has been inserted into the page." });
  };

  const addPage = () => {
    const newPage: OmPage = {
      id: `page_${Date.now()}`,
      title: `New Page ${project.pages.length + 1}`,
      blocks: []
    };
    setProject(prev => ({
      ...prev,
      pages: [...prev.pages, newPage]
    }));
    setActivePageId(newPage.id);
    setSelectedBlockId(null);
    toast({ title: "Page Added", description: "New page has been added to your document." });
  };

  const deleteBlock = () => {
    if (!activePage || !selectedBlockId) return;
    const newBlocks = activePage.blocks.filter(b => b.id !== selectedBlockId);
    updatePageBlocks(activePageId, newBlocks);
    setSelectedBlockId(null);
    toast({ title: "Block Deleted", description: "The block has been removed from the page." });
  };

  const handleAiRefine = async (content: string) => {
    if (!content.trim()) {
      toast({ title: "No Content", description: "Please add some text to refine.", variant: "destructive" });
      return;
    }
    
    toast({ title: "AI Refining...", description: "Improving your content." });
    
    try {
      const response = await fetch('/api/ai/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, instruction: 'Make this more professional and compelling for an investment memorandum.' })
      });
      
      if (!response.ok) throw new Error('Failed to refine');
      
      const result = await response.json();
      if (selectedBlockId && result.content) {
        updateBlock(selectedBlockId, { content: { markdown: result.content } });
        toast({ title: "Content Refined", description: "Your text has been improved by AI." });
      }
    } catch (error) {
      toast({ title: "Refinement Failed", description: "Could not refine content. Please try again.", variant: "destructive" });
    }
  };

  const getDefaultContentForType = (type: BlockType): any => {
    switch (type) {
      case 'text': return { markdown: "Double click to edit text..." };
      case 'kpi': return { items: [{ label: "Metric", value: "$0", subtext: "Description" }] };
      case 'chart': return { title: "New Chart", chartType: "bar", data: [
          { name: 'A', value: 100 }, { name: 'B', value: 200 }, { name: 'C', value: 150 }
      ] };
      case 'image': return { url: "https://placehold.co/600x400", alt: "Placeholder" };
      case 'table': return {};
      default: return {};
    }
  };

  const activeBlock = activePage?.blocks.find(b => b.id === selectedBlockId);
  
  const selectedBlockContent = activeBlock?.type === 'text' && activeBlock.content?.markdown 
    ? String(activeBlock.content.markdown) 
    : undefined;

  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col">
      {/* Header - 48px height, breadcrumbs, filters */}
      <header className="h-12 border-b border-border bg-background flex items-center px-4 justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-dashboard">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight" data-testid="text-project-name">{project.name}</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">Last saved just now</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/export" className="h-9 px-4 py-2 text-sm border border-input bg-background hover:bg-accent rounded-md text-foreground font-medium transition-colors flex items-center gap-2" data-testid="link-preview">
            Preview
          </Link>
          <Link href="/export" className="h-9 px-4 py-2 text-sm bg-primary hover:brightness-110 rounded-md text-primary-foreground font-medium transition-all flex items-center gap-2" data-testid="link-export-pdf">
            <FileDown className="w-4 h-4" />
            Export PDF
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          
          {/* Left Sidebar - 256px (16rem) width */}
          <ResizablePanel defaultSize={18} minSize={15} maxSize={25} className="bg-sidebar">
            <Sidebar 
              pages={project.pages} 
              activePageId={activePageId} 
              currentTheme={project.theme}
              projectId={project.id}
              selectedBlockId={selectedBlockId || undefined}
              selectedBlockContent={selectedBlockContent}
              onPageSelect={setActivePageId}
              onAddBlock={addBlock}
              onAddPage={addPage}
              onAiAction={handleAiAction}
              onThemeSelect={handleThemeSelect}
              onInsertAiContent={handleInsertAiContent}
            />
          </ResizablePanel>
          
          <ResizableHandle />

          {/* Center Canvas */}
          <ResizablePanel defaultSize={57} className="bg-muted/50 relative">
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragStart={handleDragStart} 
              onDragEnd={handleDragEnd}
            >
              <Canvas 
                page={activePage} 
                selectedBlockId={selectedBlockId}
                onSelectBlock={setSelectedBlockId}
                onUpdateBlock={updateBlock}
              />
              <DragOverlay>
                 {draggedBlock ? <div className="bg-white p-4 border shadow-lg rounded opacity-80 w-64">Moving Block...</div> : null}
              </DragOverlay>
            </DndContext>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Inspector */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="bg-card border-l border-border">
            <Inspector 
              block={activeBlock} 
              page={activePage}
              onUpdateBlock={(updates) => activeBlock && updateBlock(activeBlock.id, updates)}
              onUpdatePage={updatePage}
              onDeleteBlock={deleteBlock}
              onAiRefine={handleAiRefine}
            />
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
    </div>
  );
}
