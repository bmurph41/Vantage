import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  Plus, 
  Trash2, 
  Edit, 
  Copy, 
  Anchor, 
  Building, 
  Truck, 
  Fuel, 
  Square,
  RotateCw,
  Move,
  ZoomIn,
  ZoomOut,
  Grid3X3
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { MarinaLayout, InsertMarinaLayout } from "@shared/schema";

interface CanvasArea {
  id: string;
  type: 'wet_slips' | 'dry_stack' | 'land_storage' | 'ramp' | 'fuel_dock' | 'building';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  config: {
    rows?: number;
    columns?: number;
    slipSize?: { width: number; height: number };
    spacing?: { horizontal: number; vertical: number };
    startNumber?: string;
    numbering?: 'sequential' | 'section_based';
  };
}

interface CanvasConnection {
  id: string;
  type: 'road' | 'walkway' | 'dock';
  points: Array<{ x: number; y: number }>;
  width: number;
}

interface CanvasState {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface PhysicalMapEditorProps {
  className?: string;
}

export default function PhysicalMapEditor({ className }: PhysicalMapEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();

  // State management
  const [currentLayout, setCurrentLayout] = useState<MarinaLayout | null>(null);
  const [layoutName, setLayoutName] = useState("");
  const [layoutDescription, setLayoutDescription] = useState("");
  const [canvasState, setCanvasState] = useState<CanvasState>({
    width: 1200,
    height: 800,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const [areas, setAreas] = useState<CanvasArea[]>([]);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [selectedArea, setSelectedArea] = useState<CanvasArea | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingType, setDrawingType] = useState<CanvasArea['type'] | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showAreaDialog, setShowAreaDialog] = useState(false);

  // Fetch existing layouts
  const { data: layouts = [] } = useQuery<MarinaLayout[]>({
    queryKey: ['/api/marina/layouts'],
  });

  // Save layout mutation
  const saveLayoutMutation = useMutation({
    mutationFn: async (data: { 
      id?: string;
      name: string; 
      description: string; 
      layoutData: any;
    }) => {
      const method = data.id ? 'PUT' : 'POST';
      const endpoint = data.id ? `/api/marina/layouts/${data.id}` : '/api/marina/layouts';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          layoutData: {
            canvas: canvasState,
            areas,
            connections,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save layout');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marina/layouts'] });
      setShowAreaDialog(false);
    },
  });

  // Load layout
  const loadLayout = (layout: MarinaLayout) => {
    setCurrentLayout(layout);
    setLayoutName(layout.name);
    setLayoutDescription(layout.description || "");
    
    if (layout.layoutData) {
      setCanvasState(layout.layoutData.canvas || {
        width: 1200,
        height: 800,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      });
      setAreas(layout.layoutData.areas || []);
      setConnections(layout.layoutData.connections || []);
    }
  };

  // Canvas drawing functions
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply transformations
    ctx.save();
    ctx.scale(canvasState.scale, canvasState.scale);
    ctx.translate(canvasState.offsetX, canvasState.offsetY);

    // Draw grid
    if (showGrid) {
      drawGrid(ctx);
    }

    // Draw connections first (roads, walkways, docks)
    connections.forEach(connection => drawConnection(ctx, connection));

    // Draw areas
    areas.forEach(area => drawArea(ctx, area, area.id === selectedArea?.id));

    ctx.restore();
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const gridSize = 20;
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let x = 0; x < canvasState.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasState.height);
      ctx.stroke();
    }

    for (let y = 0; y < canvasState.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasState.width, y);
      ctx.stroke();
    }
  };

  const drawArea = (ctx: CanvasRenderingContext2D, area: CanvasArea, isSelected: boolean) => {
    ctx.save();
    
    // Move to center for rotation
    ctx.translate(area.x + area.width / 2, area.y + area.height / 2);
    ctx.rotate(area.rotation * Math.PI / 180);
    ctx.translate(-area.width / 2, -area.height / 2);

    // Set colors based on type
    const colors = {
      wet_slips: { fill: '#dbeafe', stroke: '#3b82f6' },
      dry_stack: { fill: '#fef3c7', stroke: '#f59e0b' },
      land_storage: { fill: '#d1fae5', stroke: '#10b981' },
      ramp: { fill: '#f3e8ff', stroke: '#8b5cf6' },
      fuel_dock: { fill: '#fed7d7', stroke: '#f56565' },
      building: { fill: '#e2e8f0', stroke: '#64748b' },
    };

    const color = colors[area.type];
    
    // Draw main rectangle
    ctx.fillStyle = color.fill;
    ctx.strokeStyle = isSelected ? '#ef4444' : color.stroke;
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.fillRect(0, 0, area.width, area.height);
    ctx.strokeRect(0, 0, area.width, area.height);

    // Draw internal elements for slip areas
    if (area.type === 'wet_slips' || area.type === 'dry_stack') {
      drawSlipLayout(ctx, area);
    }

    // Draw label
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(area.name, area.width / 2, area.height / 2 + 4);

    ctx.restore();
  };

  const drawSlipLayout = (ctx: CanvasRenderingContext2D, area: CanvasArea) => {
    const { config } = area;
    if (!config.rows || !config.columns || !config.slipSize) return;

    const slipWidth = config.slipSize.width;
    const slipHeight = config.slipSize.height;
    const spacingX = config.spacing?.horizontal || 2;
    const spacingY = config.spacing?.vertical || 2;

    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1;

    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.columns; col++) {
        const x = col * (slipWidth + spacingX) + 10;
        const y = row * (slipHeight + spacingY) + 10;
        
        ctx.strokeRect(x, y, slipWidth, slipHeight);
      }
    }
  };

  const drawConnection = (ctx: CanvasRenderingContext2D, connection: CanvasConnection) => {
    if (connection.points.length < 2) return;

    const colors = {
      road: '#64748b',
      walkway: '#9ca3af',
      dock: '#3b82f6',
    };

    ctx.strokeStyle = colors[connection.type];
    ctx.lineWidth = connection.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(connection.points[0].x, connection.points[0].y);
    
    for (let i = 1; i < connection.points.length; i++) {
      ctx.lineTo(connection.points[i].x, connection.points[i].y);
    }
    
    ctx.stroke();
  };

  // Canvas event handlers
  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingType) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    // Proper coordinate mapping without double-scaling
    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const xCanvas = (cssX / rect.width) * canvas.width;
    const yCanvas = (cssY / rect.height) * canvas.height;
    const worldX = (xCanvas / canvasState.scale) - canvasState.offsetX;
    const worldY = (yCanvas / canvasState.scale) - canvasState.offsetY;

    console.debug('Canvas click:', { cssX, cssY, xCanvas, yCanvas, worldX, worldY, drawingType });

    // Create new area
    const newArea: CanvasArea = {
      id: `area_${Date.now()}`,
      type: drawingType,
      name: `${drawingType.replace('_', ' ').toUpperCase()} ${areas.length + 1}`,
      x: Math.max(0, worldX - 50),
      y: Math.max(0, worldY - 30),
      width: 100,
      height: 60,
      rotation: 0,
      config: {
        rows: drawingType.includes('slip') ? 2 : undefined,
        columns: drawingType.includes('slip') ? 4 : undefined,
        slipSize: drawingType.includes('slip') ? { width: 20, height: 35 } : undefined,
        spacing: drawingType.includes('slip') ? { horizontal: 2, vertical: 2 } : undefined,
        startNumber: drawingType.includes('slip') ? 'A-01' : undefined,
        numbering: 'section_based',
      },
    };

    setAreas([...areas, newArea]);
    setSelectedArea(newArea);
    setDrawingType(null);
  };

  // Update canvas on state changes
  useEffect(() => {
    drawCanvas();
  }, [canvasState, areas, connections, selectedArea, showGrid]);

  const areaTypes = [
    { type: 'wet_slips' as const, label: 'Wet Slips', icon: Anchor },
    { type: 'dry_stack' as const, label: 'Dry Stack', icon: Building },
    { type: 'land_storage' as const, label: 'Land Storage', icon: Truck },
    { type: 'ramp' as const, label: 'Boat Ramp', icon: Square },
    { type: 'fuel_dock' as const, label: 'Fuel Dock', icon: Fuel },
    { type: 'building' as const, label: 'Building', icon: Building },
  ];

  const handleSaveLayout = () => {
    if (!layoutName.trim()) return;

    saveLayoutMutation.mutate({
      id: currentLayout?.id,
      name: layoutName,
      description: layoutDescription,
      layoutData: {
        canvas: canvasState,
        areas,
        connections,
      },
    });
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Grid3X3 size={20} />
            <span>Physical Map Designer</span>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <Select value={currentLayout?.id || ""} onValueChange={(id) => {
              const layout = layouts.find(l => l.id === id);
              if (layout) loadLayout(layout);
            }}>
              <SelectTrigger className="w-48" data-testid="select-layout">
                <SelectValue placeholder="Select a layout..." />
              </SelectTrigger>
              <SelectContent>
                {layouts.map((layout) => (
                  <SelectItem key={layout.id} value={layout.id}>
                    {layout.name}
                    {layout.isActive && <Badge className="ml-2" variant="default">Active</Badge>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={showAreaDialog} onOpenChange={setShowAreaDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-new-layout">
                  <Plus size={16} className="mr-2" />
                  New Layout
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {currentLayout ? 'Edit Layout' : 'Create New Layout'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="layout-name">Layout Name *</Label>
                    <Input
                      id="layout-name"
                      value={layoutName}
                      onChange={(e) => setLayoutName(e.target.value)}
                      placeholder="e.g., Main Marina Layout"
                      data-testid="input-layout-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="layout-description">Description</Label>
                    <Textarea
                      id="layout-description"
                      value={layoutDescription}
                      onChange={(e) => setLayoutDescription(e.target.value)}
                      placeholder="Optional description..."
                      rows={3}
                      data-testid="input-layout-description"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAreaDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveLayout}
                      disabled={!layoutName.trim() || saveLayoutMutation.isPending}
                      data-testid="button-save-layout"
                    >
                      <Save size={16} className="mr-2" />
                      {saveLayoutMutation.isPending ? 'Saving...' : 'Save Layout'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              {areaTypes.map(({ type, label, icon: Icon }) => (
                <Button
                  key={type}
                  variant={drawingType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDrawingType(drawingType === type ? null : type)}
                  data-testid={`button-add-${type}`}
                >
                  <Icon size={14} className="mr-1" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              data-testid="button-toggle-grid"
            >
              <Grid3X3 size={14} className="mr-1" />
              {showGrid ? 'Hide' : 'Show'} Grid
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCanvasState(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }))}
            >
              <ZoomIn size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCanvasState(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.5) }))}
            >
              <ZoomOut size={14} />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Canvas and Properties */}
        <div className="flex space-x-4">
          {/* Canvas */}
          <div className="flex-1">
            <div className="border rounded-lg overflow-hidden bg-white">
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={canvasState.width}
                  height={canvasState.height}
                  className="block"
                  data-testid="canvas-map-editor"
                  style={{
                    width: canvasState.width,
                    height: canvasState.height,
                    pointerEvents: 'none',
                  }}
                />
                {/* Transparent hit-target overlay for reliable testing and interaction */}
                <div
                  className="absolute inset-0 cursor-crosshair"
                  style={{
                    pointerEvents: 'auto',
                    zIndex: 10,
                  }}
                  onPointerDown={handleCanvasPointerDown}
                  data-testid="canvas-hit-target"
                />
              </div>
            </div>
            
            {drawingType && (
              <div className="mt-2 p-2 bg-blue-50 text-blue-800 text-sm rounded">
                Click on the canvas to place a new {drawingType.replace('_', ' ')} area
              </div>
            )}
          </div>

          {/* Properties Panel */}
          <div className="w-80 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Area Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedArea ? (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={selectedArea.name}
                        onChange={(e) => {
                          const updated = { ...selectedArea, name: e.target.value };
                          setSelectedArea(updated);
                          setAreas(areas.map(a => a.id === updated.id ? updated : a));
                        }}
                        className="h-8"
                        data-testid="input-area-name"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Width</Label>
                        <Input
                          type="number"
                          value={selectedArea.width}
                          onChange={(e) => {
                            const updated = { ...selectedArea, width: parseInt(e.target.value) || 0 };
                            setSelectedArea(updated);
                            setAreas(areas.map(a => a.id === updated.id ? updated : a));
                          }}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Height</Label>
                        <Input
                          type="number"
                          value={selectedArea.height}
                          onChange={(e) => {
                            const updated = { ...selectedArea, height: parseInt(e.target.value) || 0 };
                            setSelectedArea(updated);
                            setAreas(areas.map(a => a.id === updated.id ? updated : a));
                          }}
                          className="h-8"
                        />
                      </div>
                    </div>

                    {(selectedArea.type === 'wet_slips' || selectedArea.type === 'dry_stack') && (
                      <div className="space-y-2">
                        <Separator />
                        <Label className="text-xs font-semibold">Slip Configuration</Label>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Rows</Label>
                            <Input
                              type="number"
                              value={selectedArea.config.rows || 1}
                              onChange={(e) => {
                                const updated = {
                                  ...selectedArea,
                                  config: { ...selectedArea.config, rows: parseInt(e.target.value) || 1 }
                                };
                                setSelectedArea(updated);
                                setAreas(areas.map(a => a.id === updated.id ? updated : a));
                              }}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Columns</Label>
                            <Input
                              type="number"
                              value={selectedArea.config.columns || 1}
                              onChange={(e) => {
                                const updated = {
                                  ...selectedArea,
                                  config: { ...selectedArea.config, columns: parseInt(e.target.value) || 1 }
                                };
                                setSelectedArea(updated);
                                setAreas(areas.map(a => a.id === updated.id ? updated : a));
                              }}
                              className="h-8"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <Separator />
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAreas(areas.filter(a => a.id !== selectedArea.id));
                          setSelectedArea(null);
                        }}
                        data-testid="button-delete-area"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select an area to edit its properties
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Areas List */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Areas ({areas.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {areas.map((area) => (
                    <div
                      key={area.id}
                      className={`p-2 rounded cursor-pointer text-sm ${
                        selectedArea?.id === area.id 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedArea(area)}
                      data-testid={`area-item-${area.id}`}
                    >
                      <div className="font-medium">{area.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {area.type.replace('_', ' ')} • {area.width}×{area.height}
                      </div>
                    </div>
                  ))}
                  
                  {areas.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No areas added yet. Use the toolbar above to add areas.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}