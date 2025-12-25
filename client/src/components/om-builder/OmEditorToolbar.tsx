import { 
  MousePointer2, 
  Type, 
  Image, 
  Square, 
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  Magnet,
  Eye,
  EyeOff,
  Undo2,
  Redo2,
  Save,
  Download,
  Share2,
  Settings,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useOmEditorStore } from '@/stores/om-editor-store';
import { cn } from '@/lib/utils';

interface OmEditorToolbarProps {
  isSaving?: boolean;
  onSave?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onSettings?: () => void;
}

export function OmEditorToolbar({
  isSaving,
  onSave,
  onExport,
  onShare,
  onSettings,
}: OmEditorToolbarProps) {
  const {
    activeTool,
    setActiveTool,
    zoom,
    zoomIn,
    zoomOut,
    zoomToFit,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    showBleed,
    setShowBleed,
    isDirty,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useOmEditorStore();

  const tools = [
    { id: 'select' as const, icon: MousePointer2, label: 'Select (V)' },
    { id: 'text' as const, icon: Type, label: 'Text (T)' },
    { id: 'image' as const, icon: Image, label: 'Image (I)' },
    { id: 'shape' as const, icon: Square, label: 'Shape (S)' },
    { id: 'pan' as const, icon: Hand, label: 'Pan (Space)' },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 p-2 border-b bg-background">
        <div className="flex items-center gap-1">
          {tools.map(tool => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTool === tool.id ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => setActiveTool(tool.id)}
                  data-testid={`tool-${tool.id}`}
                >
                  <tool.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tool.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => undo()}
                disabled={!canUndo()}
                data-testid="btn-undo"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (⌘Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => redo()}
                disabled={!canRedo()}
                data-testid="btn-redo"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomOut}
                data-testid="btn-zoom-out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>

          <span className="w-12 text-center text-sm tabular-nums">
            {Math.round(zoom * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomIn}
                data-testid="btn-zoom-in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={zoomToFit}
                data-testid="btn-zoom-fit"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to View</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-6" />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={showGrid}
                onPressedChange={setShowGrid}
                size="sm"
                data-testid="toggle-grid"
              >
                <Grid3X3 className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Toggle Grid</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={snapToGrid}
                onPressedChange={setSnapToGrid}
                size="sm"
                data-testid="toggle-snap"
              >
                <Magnet className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Snap to Grid</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={showBleed}
                onPressedChange={setShowBleed}
                size="sm"
                data-testid="toggle-bleed"
              >
                {showBleed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Show Bleed/Safety Guides</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSave}
                disabled={isSaving || !isDirty}
                data-testid="btn-save"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save (⌘S)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onExport}
                data-testid="btn-export"
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export PDF</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onShare}
                data-testid="btn-share"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onSettings}
                data-testid="btn-settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
