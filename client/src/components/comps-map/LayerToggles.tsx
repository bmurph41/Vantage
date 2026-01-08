import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Layers, Eye, EyeOff } from 'lucide-react';
import type { LayerType, MapConfig } from './types';

interface LayerTogglesProps {
  config: MapConfig;
  visibleLayers: LayerType[];
  onToggleLayer: (layer: LayerType) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  layerCounts?: Record<LayerType, number>;
}

const LAYER_LABELS: Record<LayerType, string> = {
  subject: 'Subject Property',
  sale_comp: 'Sale Comps',
  rate_comp: 'Rate Comps',
  poi: 'Points of Interest',
  census_tract: 'Census Tracts',
};

export function LayerToggles({
  config,
  visibleLayers,
  onToggleLayer,
  onShowAll,
  onHideAll,
  layerCounts = {},
}: LayerTogglesProps) {
  const availableLayers = config.defaultVisibleLayers;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-background shadow-md"
          data-testid="button-layer-toggles"
        >
          <Layers className="h-4 w-4 mr-1" />
          Layers ({visibleLayers.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">Map Layers</Label>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onShowAll}
                data-testid="button-show-all-layers"
              >
                <Eye className="h-3 w-3 mr-1" />
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={onHideAll}
                data-testid="button-hide-all-layers"
              >
                <EyeOff className="h-3 w-3 mr-1" />
                None
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {availableLayers.map(layer => (
              <div key={layer} className="flex items-center gap-2">
                <Checkbox
                  id={`layer-${layer}`}
                  checked={visibleLayers.includes(layer)}
                  onCheckedChange={() => onToggleLayer(layer)}
                  data-testid={`checkbox-layer-${layer}`}
                />
                <Label
                  htmlFor={`layer-${layer}`}
                  className="flex-1 text-sm cursor-pointer"
                >
                  {LAYER_LABELS[layer]}
                </Label>
                {config.colors[layer] && (
                  <div
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: config.colors[layer] }}
                  />
                )}
                {layerCounts[layer] !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    ({layerCounts[layer]})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
