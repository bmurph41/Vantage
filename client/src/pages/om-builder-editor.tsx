import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, PanelLeftClose, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useOmEditorStore } from '@/stores/om-editor-store';
import { useAutosave } from '@/hooks/use-autosave';
import { useOmWithPages, usePublishOm, useShareOm } from '@/lib/om-builder-api';
import { OmCanvas, OmEditorToolbar, OmLayersPanel, OmInspectorPanel, OmPagesPanel } from '@/components/om-builder';

export default function OmBuilderEditorPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const omId = params.id || null;
  
  const {
    document: doc,
    sidebarOpen,
    toggleSidebar,
    loadFromSnapshot,
    reset,
    getSnapshot,
  } = useOmEditorStore();

  const { data: omData, isLoading, error } = useOmWithPages(omId);
  const publishMutation = usePublishOm(omId || '');
  const shareMutation = useShareOm(omId || '');
  
  const { isSaving, forceSave } = useAutosave(omId, 'user-1', {
    enabled: Boolean(omId),
  });

  useEffect(() => {
    if (omData) {
      const pages = omData.pages.map(p => ({
        id: p.id,
        name: p.name,
        order: p.order,
        pageSize: (p.pageSize as any) || 'letter',
        orientation: (p.orientation as any) || 'portrait',
        width: p.width || 612,
        height: p.height || 792,
        backgroundColor: (p.content as any)?.backgroundColor,
        backgroundImage: (p.content as any)?.backgroundImage,
      }));

      const blocks = omData.pages.flatMap(p => 
        (p.blocks || []).map(b => ({
          id: b.id,
          pageId: p.id,
          position: (b.config as any)?.position || { x: 0, y: 0, width: 200, height: 100, zIndex: 0 },
          style: (b.config as any)?.style || {},
          data: {
            type: b.blockType as any,
            ...(b.content || {}),
          },
          locked: (b.config as any)?.locked,
          name: (b.config as any)?.name,
        }))
      );

      loadFromSnapshot({
        document: {
          id: omData.om.id,
          name: omData.om.name,
          docType: omData.om.docType,
          status: omData.om.status as any,
          brandKitId: omData.om.brandKitId || undefined,
        },
        pages,
        blocks,
      });
    }

    return () => {
      reset();
    };
  }, [omData, loadFromSnapshot, reset]);

  const handleSave = () => {
    forceSave();
  };

  const handleExport = () => {
    toast({ title: 'Export', description: 'PDF export coming soon' });
  };

  const handleShare = async () => {
    try {
      const result = await shareMutation.mutateAsync();
      const shareUrl = window.location.origin + (result as any).shareUrl;
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied', description: 'Share link copied to clipboard' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to generate share link', variant: 'destructive' });
    }
  };

  const handleSettings = () => {
    toast({ title: 'Settings', description: 'Document settings coming soon' });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading document...</div>
      </div>
    );
  }

  if (error || !omId) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-destructive">Failed to load document</div>
        <Button onClick={() => navigate('/modeling/om-builder')}>
          Back to OM Builder
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/modeling/om-builder')}
          data-testid="btn-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{doc?.name || 'Untitled'}</h1>
          <p className="text-xs text-muted-foreground">{doc?.docType || 'Document'}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleSidebar('left')}
          data-testid="toggle-left-sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleSidebar('right')}
          data-testid="toggle-right-sidebar"
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      </div>

      <OmEditorToolbar
        isSaving={isSaving}
        onSave={handleSave}
        onExport={handleExport}
        onShare={handleShare}
        onSettings={handleSettings}
      />

      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen.left && (
          <div className="w-64 border-r flex flex-col bg-background">
            <Tabs defaultValue="pages" className="flex-1 flex flex-col">
              <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
                <TabsTrigger value="pages" className="text-xs">Pages</TabsTrigger>
                <TabsTrigger value="layers" className="text-xs">Layers</TabsTrigger>
              </TabsList>
              <TabsContent value="pages" className="flex-1 m-0">
                <OmPagesPanel />
              </TabsContent>
              <TabsContent value="layers" className="flex-1 m-0">
                <OmLayersPanel />
              </TabsContent>
            </Tabs>
          </div>
        )}

        <OmCanvas className="flex-1" />

        {sidebarOpen.right && (
          <div className="w-72 border-l bg-background">
            <OmInspectorPanel />
          </div>
        )}
      </div>
    </div>
  );
}
