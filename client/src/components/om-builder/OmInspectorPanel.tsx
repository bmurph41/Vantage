import { 
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Link2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOmEditorStore } from '@/stores/om-editor-store';

export function OmInspectorPanel() {
  const {
    blocks,
    selectedBlockIds,
    updateBlockStyle,
    updateBlockData,
    updateBlockPosition,
  } = useOmEditorStore();

  const selectedBlocks = blocks.filter(b => selectedBlockIds.includes(b.id));
  const selectedBlock = selectedBlocks.length === 1 ? selectedBlocks[0] : null;

  if (!selectedBlock) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Palette className="h-4 w-4" />
          <span className="font-medium text-sm">Inspector</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            {selectedBlocks.length > 1
              ? `${selectedBlocks.length} elements selected`
              : 'Select an element to edit'}
          </p>
        </div>
      </div>
    );
  }

  const { style, data, position } = selectedBlock;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Palette className="h-4 w-4" />
        <span className="font-medium text-sm">Inspector</span>
      </div>

      <ScrollArea className="flex-1">
        <Tabs defaultValue="style" className="w-full">
          <TabsList className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <TabsTrigger value="style" className="text-xs">Style</TabsTrigger>
            <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
            <TabsTrigger value="position" className="text-xs">Position</TabsTrigger>
          </TabsList>

          <TabsContent value="style" className="p-3 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Background</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={style.backgroundColor || '#ffffff'}
                  onChange={(e) => updateBlockStyle(selectedBlock.id, { backgroundColor: e.target.value })}
                  className="w-10 h-8 p-1"
                  data-testid="input-bg-color"
                />
                <Input
                  value={style.backgroundColor || ''}
                  onChange={(e) => updateBlockStyle(selectedBlock.id, { backgroundColor: e.target.value })}
                  placeholder="transparent"
                  className="flex-1 h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Border</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={style.borderColor || '#000000'}
                  onChange={(e) => updateBlockStyle(selectedBlock.id, { borderColor: e.target.value })}
                  className="w-10 h-8 p-1"
                />
                <Input
                  type="number"
                  value={style.borderWidth || 0}
                  onChange={(e) => updateBlockStyle(selectedBlock.id, { borderWidth: parseInt(e.target.value) || 0 })}
                  className="w-16 h-8 text-xs"
                  min={0}
                  max={20}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Border Radius</Label>
              <Slider
                value={[style.borderRadius || 0]}
                onValueChange={([v]) => updateBlockStyle(selectedBlock.id, { borderRadius: v })}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Padding</Label>
              <Slider
                value={[style.padding || 0]}
                onValueChange={([v]) => updateBlockStyle(selectedBlock.id, { padding: v })}
                max={50}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Opacity</Label>
              <Slider
                value={[(style.opacity ?? 1) * 100]}
                onValueChange={([v]) => updateBlockStyle(selectedBlock.id, { opacity: v / 100 })}
                max={100}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Shadow</Label>
              <Select
                value={style.shadow || 'none'}
                onValueChange={(v) => updateBlockStyle(selectedBlock.id, { shadow: v as any })}
              >
                <SelectTrigger className="h-8 text-xs">
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
          </TabsContent>

          <TabsContent value="content" className="p-3 space-y-4">
            {data.type === 'text' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Font Size</Label>
                  <Input
                    type="number"
                    value={data.fontSize || 14}
                    onChange={(e) => updateBlockData(selectedBlock.id, { fontSize: parseInt(e.target.value) || 14 })}
                    className="h-8 text-xs"
                    min={8}
                    max={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Font Family</Label>
                  <Select
                    value={data.fontFamily || 'inherit'}
                    onValueChange={(v) => updateBlockData(selectedBlock.id, { fontFamily: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inherit">Default</SelectItem>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Courier New">Courier New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Text Align</Label>
                  <div className="flex gap-1">
                    <Button
                      variant={data.textAlign === 'left' ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-7 w-7"
                      onClick={() => updateBlockData(selectedBlock.id, { textAlign: 'left' })}
                    >
                      <AlignLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={data.textAlign === 'center' ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-7 w-7"
                      onClick={() => updateBlockData(selectedBlock.id, { textAlign: 'center' })}
                    >
                      <AlignCenter className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={data.textAlign === 'right' ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-7 w-7"
                      onClick={() => updateBlockData(selectedBlock.id, { textAlign: 'right' })}
                    >
                      <AlignRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={data.color || '#000000'}
                      onChange={(e) => updateBlockData(selectedBlock.id, { color: e.target.value })}
                      className="w-10 h-8 p-1"
                    />
                    <Input
                      value={data.color || ''}
                      onChange={(e) => updateBlockData(selectedBlock.id, { color: e.target.value })}
                      placeholder="#000000"
                      className="flex-1 h-8 text-xs"
                    />
                  </div>
                </div>
              </>
            )}

            {data.type === 'image' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Image URL</Label>
                  <Input
                    value={data.src || ''}
                    onChange={(e) => updateBlockData(selectedBlock.id, { src: e.target.value })}
                    placeholder="https://..."
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Alt Text</Label>
                  <Input
                    value={data.alt || ''}
                    onChange={(e) => updateBlockData(selectedBlock.id, { alt: e.target.value })}
                    placeholder="Image description"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Object Fit</Label>
                  <Select
                    value={data.fit || 'cover'}
                    onValueChange={(v) => updateBlockData(selectedBlock.id, { fit: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cover">Cover</SelectItem>
                      <SelectItem value="contain">Contain</SelectItem>
                      <SelectItem value="fill">Fill</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {data.type === 'kpi' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={data.label || ''}
                    onChange={(e) => updateBlockData(selectedBlock.id, { label: e.target.value })}
                    placeholder="Metric name"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Value</Label>
                  <Input
                    value={data.value || ''}
                    onChange={(e) => updateBlockData(selectedBlock.id, { value: e.target.value })}
                    placeholder="0"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Format</Label>
                  <Select
                    value={data.format || 'number'}
                    onValueChange={(v) => updateBlockData(selectedBlock.id, { format: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="currency">Currency</SelectItem>
                      <SelectItem value="percent">Percent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {data.type === 'shape' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Shape Type</Label>
                  <Select
                    value={data.shapeType || 'rectangle'}
                    onValueChange={(v) => updateBlockData(selectedBlock.id, { shapeType: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rectangle">Rectangle</SelectItem>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="line">Line</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Fill Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={data.fillColor || '#cccccc'}
                      onChange={(e) => updateBlockData(selectedBlock.id, { fillColor: e.target.value })}
                      className="w-10 h-8 p-1"
                    />
                    <Input
                      value={data.fillColor || ''}
                      onChange={(e) => updateBlockData(selectedBlock.id, { fillColor: e.target.value })}
                      placeholder="transparent"
                      className="flex-1 h-8 text-xs"
                    />
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="position" className="p-3 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">X</Label>
                <Input
                  type="number"
                  value={position.x}
                  onChange={(e) => updateBlockPosition(selectedBlock.id, { x: parseInt(e.target.value) || 0 })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Y</Label>
                <Input
                  type="number"
                  value={position.y}
                  onChange={(e) => updateBlockPosition(selectedBlock.id, { y: parseInt(e.target.value) || 0 })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Width</Label>
                <Input
                  type="number"
                  value={position.width}
                  onChange={(e) => updateBlockPosition(selectedBlock.id, { width: parseInt(e.target.value) || 100 })}
                  className="h-8 text-xs"
                  min={10}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Height</Label>
                <Input
                  type="number"
                  value={position.height}
                  onChange={(e) => updateBlockPosition(selectedBlock.id, { height: parseInt(e.target.value) || 100 })}
                  className="h-8 text-xs"
                  min={10}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Rotation (degrees)</Label>
              <Slider
                value={[position.rotation || 0]}
                onValueChange={([v]) => updateBlockPosition(selectedBlock.id, { rotation: v })}
                min={-180}
                max={180}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Z-Index (layer order)</Label>
              <Input
                type="number"
                value={position.zIndex || 0}
                onChange={(e) => updateBlockPosition(selectedBlock.id, { zIndex: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs"
                min={0}
              />
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
