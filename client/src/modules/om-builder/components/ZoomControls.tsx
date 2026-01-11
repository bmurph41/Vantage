import { ZoomIn, ZoomOut, Maximize, Grid3X3, RotateCcw, Ruler, Layout, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";

interface ZoomControlsProps {
  zoom: number;
  showGrid: boolean;
  showRulers?: boolean;
  showBleedMargins?: boolean;
  snapToGrid?: boolean;
  onZoomChange: (zoom: number) => void;
  onToggleGrid: () => void;
  onToggleRulers?: () => void;
  onToggleBleedMargins?: () => void;
  onToggleSnapToGrid?: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
}

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export function ZoomControls({
  zoom,
  showGrid,
  showRulers = true,
  showBleedMargins = false,
  snapToGrid = true,
  onZoomChange,
  onToggleGrid,
  onToggleRulers,
  onToggleBleedMargins,
  onToggleSnapToGrid,
  onFitToScreen,
  onResetZoom,
}: ZoomControlsProps) {
  const zoomPercent = Math.round(zoom * 100);

  const zoomIn = () => {
    const nextPreset = ZOOM_PRESETS.find(z => z > zoom);
    onZoomChange(nextPreset || 2);
  };

  const zoomOut = () => {
    const prevPreset = [...ZOOM_PRESETS].reverse().find(z => z < zoom);
    onZoomChange(prevPreset || 0.25);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 bg-background/95 backdrop-blur border rounded-lg px-2 py-1 shadow-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={zoomOut}
              disabled={zoom <= 0.25}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <div className="w-20">
          <Slider
            value={[zoom]}
            min={0.25}
            max={2}
            step={0.05}
            onValueChange={([value]) => onZoomChange(value)}
            data-testid="slider-zoom"
          />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={zoomIn}
              disabled={zoom >= 2}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <span className="text-xs text-muted-foreground w-9 text-center" data-testid="text-zoom-percent">
          {zoomPercent}%
        </span>

        <Separator orientation="vertical" className="h-4 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onResetZoom}
              data-testid="button-reset-zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset to 100%</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onFitToScreen}
              data-testid="button-fit-screen"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit to Screen</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={showGrid}
              onPressedChange={onToggleGrid}
              size="sm"
              className="h-7 w-7 p-0"
              data-testid="toggle-grid"
            >
              <Grid3X3 className="h-4 w-4" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Toggle Grid {snapToGrid ? '(Snap On)' : '(Snap Off)'}</TooltipContent>
        </Tooltip>

        {onToggleRulers && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={showRulers}
                onPressedChange={onToggleRulers}
                size="sm"
                className="h-7 w-7 p-0"
                data-testid="toggle-rulers"
              >
                <Ruler className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Toggle Rulers</TooltipContent>
          </Tooltip>
        )}

        {onToggleBleedMargins && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={showBleedMargins}
                onPressedChange={onToggleBleedMargins}
                size="sm"
                className="h-7 w-7 p-0"
                data-testid="toggle-bleed"
              >
                <Layout className="h-4 w-4" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Toggle Print Margins</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

export default ZoomControls;
