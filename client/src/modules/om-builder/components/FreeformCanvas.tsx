import { useState, useRef, useCallback } from "react";
import { Rnd } from "react-rnd";
import type { OmBlock, OmPage, BlockType, ShapeType } from "../types";
import { 
  Type, BarChart3, Table, Image, Gauge, AlertCircle, Info, CheckCircle, 
  AlertTriangle, Lightbulb, StickyNote, Square, Circle, Minus, Star,
  TrendingUp, MapPin, Users, FileText, LayoutGrid, Building2
} from "lucide-react";
import type { MetricStripContent, ImageGridContent, TeamGridContent, DisclaimerContent, PortfolioTableContent, SectionDividerContent, MapPageContent } from "../types";
import { CALLOUT_COLORS, type CalloutVariant } from "../types";

interface FreeformCanvasProps {
  page: OmPage | null;
  blocks: OmBlock[];
  selectedBlockIds: string[];
  zoom: number;
  showGrid: boolean;
  gridSize: number;
  canvasWidth?: number;
  canvasHeight?: number;
  onSelectBlock: (blockId: string, addToSelection?: boolean) => void;
  onClearSelection: () => void;
  onUpdateBlock: (blockId: string, updates: Partial<OmBlock>) => void;
  onUpdateBlockPosition: (blockId: string, x: number, y: number) => void;
  onUpdateBlockSize: (blockId: string, width: number, height: number) => void;
}

const DEFAULT_CANVAS_WIDTH = 816;
const DEFAULT_CANVAS_HEIGHT = 1056;

export function FreeformCanvas({
  page,
  blocks,
  selectedBlockIds,
  zoom,
  showGrid,
  gridSize,
  canvasWidth = DEFAULT_CANVAS_WIDTH,
  canvasHeight = DEFAULT_CANVAS_HEIGHT,
  onSelectBlock,
  onClearSelection,
  onUpdateBlock,
  onUpdateBlockPosition,
  onUpdateBlockSize,
}: FreeformCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const snapToGrid = (value: number) => {
    if (!showGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onClearSelection();
    }
  };

  const renderBlockContent = (block: OmBlock) => {
    switch (block.type) {
      case 'text':
        return (
          <div className="p-3 h-full overflow-hidden text-sm">
            {block.content?.markdown || 'Double-click to edit...'}
          </div>
        );
      case 'heading':
        return (
          <div className="p-3 h-full overflow-hidden">
            <h2 className="text-xl font-bold">{block.content?.text || 'Heading'}</h2>
          </div>
        );
      case 'kpi':
        return (
          <div className="p-3 h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-bold">{block.content?.items?.[0]?.value || '$0'}</div>
              <div className="text-xs text-muted-foreground mt-1">{block.content?.items?.[0]?.label || 'Metric'}</div>
            </div>
          </div>
        );
      case 'chart':
        return (
          <div className="p-3 h-full flex flex-col">
            <div className="text-sm font-medium mb-2">{block.content?.title || 'Chart'}</div>
            <div className="flex-1 bg-muted/30 rounded flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
        );
      case 'image':
        return block.content?.url ? (
          <img 
            src={block.content.url} 
            alt={block.content.alt || ''} 
            className="w-full h-full object-cover rounded"
            draggable={false}
          />
        ) : (
          <div className="h-full bg-muted/30 rounded flex items-center justify-center">
            <Image className="w-8 h-8 text-muted-foreground" />
          </div>
        );
      case 'table':
        return (
          <div className="p-3 h-full flex items-center justify-center bg-muted/20">
            <Table className="w-8 h-8 text-muted-foreground" />
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
          <div className={`p-3 h-full ${colors.bg} border ${colors.border} rounded flex gap-2`}>
            <CalloutIcon className={`w-4 h-4 ${colors.icon} shrink-0 mt-0.5`} />
            <div className={`flex-1 ${colors.text} text-sm`}>
              {block.content?.text || 'Callout text...'}
            </div>
          </div>
        );
      case 'shape':
        const shapeType = (block.content?.shapeType || 'rect') as ShapeType;
        const fillColor = block.style?.backgroundColor || '#e5e7eb';
        const strokeColor = block.style?.border?.color || '#9ca3af';
        if (shapeType === 'circle') {
          return (
            <div 
              className="w-full h-full rounded-full" 
              style={{ backgroundColor: fillColor, border: `2px solid ${strokeColor}` }}
            />
          );
        }
        if (shapeType === 'line') {
          return (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full h-0.5" style={{ backgroundColor: strokeColor }} />
            </div>
          );
        }
        return (
          <div 
            className="w-full h-full rounded" 
            style={{ 
              backgroundColor: fillColor, 
              border: `2px solid ${strokeColor}`,
              borderRadius: block.style?.border?.radius || '4px'
            }}
          />
        );
      case 'icon':
        return (
          <div className="h-full flex items-center justify-center">
            <Star className="w-8 h-8" style={{ color: block.style?.backgroundColor || '#6b7280' }} />
          </div>
        );
      case 'divider':
        return (
          <div className="h-full flex items-center">
            <hr className="w-full border-t border-border" />
          </div>
        );
      case 'metricStrip': {
        const stripContent = block.content as MetricStripContent | undefined;
        const metrics = stripContent?.metrics || [];
        return (
          <div className="h-full flex items-stretch bg-slate-800 rounded-lg overflow-hidden">
            {metrics.length > 0 ? metrics.map((metric, i) => (
              <div key={metric.id || i} className="flex-1 flex flex-col items-center justify-center p-3 border-r border-slate-700 last:border-r-0">
                <div className="text-2xl font-bold text-white">{metric.value}{metric.unit}</div>
                <div className="text-xs text-slate-400 mt-1">{metric.label}</div>
              </div>
            )) : (
              <div className="flex-1 flex items-center justify-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-400" />
                <span className="text-slate-400 text-sm">Metric Strip</span>
              </div>
            )}
          </div>
        );
      }
      case 'imageGrid': {
        const gridContent = block.content as ImageGridContent | undefined;
        const images = gridContent?.images || [];
        const layout = gridContent?.layout || '2x2';
        const gridClass = layout === '3x1' ? 'grid-cols-3' : layout === '1x3' ? 'grid-cols-1' : layout === '3x2' ? 'grid-cols-3' : 'grid-cols-2';
        return (
          <div className={`h-full grid ${gridClass} gap-1 p-1`}>
            {images.length > 0 ? images.map((img, i) => (
              <div key={img.id || i} className="relative bg-muted rounded overflow-hidden">
                <img src={img.url} alt={img.alt || ''} className="w-full h-full object-cover" />
                {gridContent?.showCaptions && img.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">{img.caption}</div>
                )}
              </div>
            )) : (
              <>
                <div className="bg-muted/30 rounded flex items-center justify-center"><Image className="w-6 h-6 text-muted-foreground" /></div>
                <div className="bg-muted/30 rounded flex items-center justify-center"><Image className="w-6 h-6 text-muted-foreground" /></div>
                <div className="bg-muted/30 rounded flex items-center justify-center"><Image className="w-6 h-6 text-muted-foreground" /></div>
                <div className="bg-muted/30 rounded flex items-center justify-center"><Image className="w-6 h-6 text-muted-foreground" /></div>
              </>
            )}
          </div>
        );
      }
      case 'mapPage': {
        const mapContent = block.content as MapPageContent | undefined;
        return mapContent?.mapImageUrl ? (
          <div className="h-full relative">
            <img src={mapContent.mapImageUrl} alt="Map" className="w-full h-full object-cover" />
            {mapContent.showSubjectMarker && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <MapPin className="w-8 h-8 text-red-600 drop-shadow-lg" />
              </div>
            )}
          </div>
        ) : (
          <div className="h-full bg-gradient-to-br from-blue-100 to-green-100 rounded flex items-center justify-center">
            <MapPin className="w-10 h-10 text-blue-500" />
          </div>
        );
      }
      case 'sectionDivider': {
        const dividerContent = block.content as SectionDividerContent | undefined;
        const variant = dividerContent?.variant || 'solid';
        return (
          <div 
            className="h-full flex flex-col items-center justify-center relative overflow-hidden"
            style={variant === 'imageOverlay' && dividerContent?.backgroundImageUrl ? {
              backgroundImage: `url(${dividerContent.backgroundImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : { backgroundColor: '#1e3a5f' }}
          >
            {variant === 'imageOverlay' && <div className="absolute inset-0 bg-black/40" />}
            <div className="relative z-10 text-center text-white px-6">
              {dividerContent?.sectionNumber && (
                <div className="text-sm uppercase tracking-widest mb-2 opacity-80">Section {dividerContent.sectionNumber}</div>
              )}
              <h2 className="text-3xl font-bold">{dividerContent?.title || 'Section Title'}</h2>
              {dividerContent?.subtitle && <p className="text-lg mt-2 opacity-80">{dividerContent.subtitle}</p>}
            </div>
          </div>
        );
      }
      case 'teamGrid': {
        const teamContent = block.content as TeamGridContent | undefined;
        const members = teamContent?.members || [];
        const cols = teamContent?.columns || 3;
        return (
          <div className={`h-full grid gap-3 p-3`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {members.length > 0 ? members.map((member, i) => (
              <div key={member.id || i} className="flex flex-col items-center text-center">
                {member.headshotUrl ? (
                  <img src={member.headshotUrl} alt={member.name} className="w-16 h-16 rounded-full object-cover mb-2" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-2">
                    <Users className="w-8 h-8 text-slate-400" />
                  </div>
                )}
                <div className="font-semibold text-sm">{member.name}</div>
                <div className="text-xs text-muted-foreground">{member.title}</div>
                {member.firm && <div className="text-xs text-muted-foreground">{member.firm}</div>}
              </div>
            )) : (
              <div className="col-span-full flex items-center justify-center gap-2 text-muted-foreground">
                <Users className="w-6 h-6" />
                <span className="text-sm">Team Grid</span>
              </div>
            )}
          </div>
        );
      }
      case 'disclaimer': {
        const disclaimerContent = block.content as DisclaimerContent | undefined;
        const layout = disclaimerContent?.layout || 'fullWidth';
        return (
          <div className="h-full p-4 overflow-auto bg-slate-50 border border-slate-200 rounded">
            <h3 className="font-bold text-sm mb-2 text-slate-700">{disclaimerContent?.title || 'Disclaimer'}</h3>
            <div className={`text-xs text-slate-600 leading-relaxed ${layout === 'twoColumn' ? 'columns-2 gap-4' : ''}`}>
              {disclaimerContent?.body || 'This document is for informational purposes only and does not constitute an offer to sell or a solicitation of an offer to buy any securities.'}
            </div>
          </div>
        );
      }
      case 'portfolioTable': {
        const tableContent = block.content as PortfolioTableContent | undefined;
        const columns = tableContent?.columns || [];
        const rows = tableContent?.rows || [];
        return (
          <div className="h-full overflow-auto p-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  {columns.length > 0 ? columns.map((col, i) => (
                    <th key={col.id || i} className={`p-2 border text-${col.alignment || 'left'} font-semibold`}>{col.label}</th>
                  )) : (
                    <>
                      <th className="p-2 border font-semibold">Property</th>
                      <th className="p-2 border font-semibold text-right">Value</th>
                      <th className="p-2 border font-semibold text-center">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    {columns.map((col, j) => (
                      <td key={j} className={`p-2 border text-${col.alignment || 'left'}`}>{row[col.field] || '-'}</td>
                    ))}
                  </tr>
                )) : (
                  <tr><td colSpan={columns.length || 3} className="p-4 border text-center text-muted-foreground">
                    <Building2 className="w-6 h-6 mx-auto mb-1" />
                    Portfolio Table
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return (
          <div className="p-3 h-full flex items-center justify-center text-muted-foreground text-sm">
            {block.type}
          </div>
        );
    }
  };

  const sortedBlocks = [...blocks].sort((a, b) => (a.meta?.zIndex || 0) - (b.meta?.zIndex || 0));

  return (
    <div 
      className="relative bg-white shadow-lg border border-gray-200"
      style={{ 
        width: canvasWidth, 
        height: canvasHeight,
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
      }}
      ref={canvasRef}
      onClick={handleCanvasClick}
      data-testid="freeform-canvas"
    >
      {showGrid && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(to right, #e5e7eb 1px, transparent 1px),
              linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
        />
      )}
      
      {sortedBlocks.map((block) => {
        if (block.meta?.hidden) return null;
        
        const isSelected = selectedBlockIds.includes(block.id);
        const isLocked = block.meta?.locked;
        const position = block.position || { x: 50, y: 50, width: 200, height: 100 };

        return (
          <Rnd
            key={block.id}
            position={{ x: position.x, y: position.y }}
            size={{ width: position.width, height: position.height }}
            onDragStop={(e, d) => {
              if (isLocked) return;
              onUpdateBlockPosition(block.id, snapToGrid(d.x), snapToGrid(d.y));
            }}
            onResizeStop={(e, direction, ref, delta, pos) => {
              if (isLocked) return;
              onUpdateBlockSize(
                block.id,
                snapToGrid(parseInt(ref.style.width)),
                snapToGrid(parseInt(ref.style.height))
              );
              onUpdateBlockPosition(block.id, snapToGrid(pos.x), snapToGrid(pos.y));
            }}
            disableDragging={isLocked}
            enableResizing={!isLocked}
            bounds="parent"
            minWidth={40}
            minHeight={30}
            dragGrid={showGrid ? [gridSize, gridSize] : undefined}
            resizeGrid={showGrid ? [gridSize, gridSize] : undefined}
            className={`
              ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}
              ${isLocked ? 'cursor-not-allowed opacity-80' : 'cursor-move'}
              transition-shadow
            `}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onSelectBlock(block.id, e.shiftKey);
            }}
            data-testid={`canvas-block-${block.id}`}
          >
            <div className="w-full h-full bg-background border border-border rounded overflow-hidden">
              {renderBlockContent(block)}
            </div>
          </Rnd>
        );
      })}
      
      {!page && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Type className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Select or create a page</p>
          </div>
        </div>
      )}
      
      {page && blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
          <div className="text-center">
            <Type className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Drag blocks onto the canvas</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FreeformCanvas;
