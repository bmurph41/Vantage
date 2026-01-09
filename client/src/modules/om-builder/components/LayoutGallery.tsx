import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, LayoutTemplate, Plus, FileText, BarChart3, Users, Image, Map, AlertCircle, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { OmPageLayoutDefinition, OmLayoutType } from "../types";

interface LayoutGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelectLayout: (layout: OmPageLayoutDefinition) => void;
}

interface LayoutFromApi {
  id: string;
  name: string;
  description: string | null;
  layoutType: OmLayoutType;
  themeId: string | null;
  organizationId: string | null;
  userId: string | null;
  isSystemDefault: boolean;
  thumbnail: string | null;
  structure: OmPageLayoutDefinition['structure'];
  createdAt: string;
  updatedAt: string;
}

function mapApiLayoutToDefinition(apiLayout: LayoutFromApi): OmPageLayoutDefinition {
  return {
    id: apiLayout.id,
    name: apiLayout.name,
    description: apiLayout.description ?? undefined,
    layoutType: apiLayout.layoutType,
    themeId: apiLayout.themeId ?? undefined,
    organizationId: apiLayout.organizationId ?? undefined,
    userId: apiLayout.userId ?? undefined,
    isSystemDefault: apiLayout.isSystemDefault,
    thumbnail: apiLayout.thumbnail ?? undefined,
    structure: apiLayout.structure,
  };
}

const LAYOUT_TYPE_ICONS: Record<OmLayoutType, typeof FileText> = {
  cover: FileText,
  sectionDivider: LayoutTemplate,
  execSummary: FileText,
  financials: BarChart3,
  market: Map,
  photos: Image,
  portfolio: Building2,
  team: Users,
  disclaimer: AlertCircle,
  custom: LayoutTemplate,
};

const LAYOUT_TYPE_LABELS: Record<OmLayoutType, string> = {
  cover: 'Cover Page',
  sectionDivider: 'Section Divider',
  execSummary: 'Executive Summary',
  financials: 'Financials',
  market: 'Market Analysis',
  photos: 'Photo Gallery',
  portfolio: 'Portfolio',
  team: 'Team',
  disclaimer: 'Disclaimer',
  custom: 'Custom',
};

const DEFAULT_LAYOUTS: OmPageLayoutDefinition[] = [
  {
    id: 'cover-default',
    name: 'Standard Cover',
    layoutType: 'cover',
    isSystemDefault: true,
    structure: {
      gridColumns: 1,
      gridGap: '0',
      placeholders: [
        { id: 'logo', blockType: 'image', x: 50, y: 80, width: 100, height: 50, label: 'Logo' },
        { id: 'title', blockType: 'heading', x: 50, y: 300, width: 700, height: 80, label: 'Title' },
        { id: 'subtitle', blockType: 'text', x: 50, y: 400, width: 700, height: 40, label: 'Subtitle' },
        { id: 'hero', blockType: 'image', x: 50, y: 500, width: 700, height: 400, label: 'Hero Image' },
      ],
    },
  },
  {
    id: 'exec-summary-default',
    name: 'Executive Summary',
    layoutType: 'execSummary',
    isSystemDefault: true,
    structure: {
      gridColumns: 2,
      gridGap: '1.5rem',
      placeholders: [
        { id: 'metrics', blockType: 'metricStrip', x: 50, y: 80, width: 700, height: 80, label: 'Key Metrics' },
        { id: 'overview', blockType: 'text', x: 50, y: 180, width: 340, height: 300, label: 'Overview' },
        { id: 'highlights', blockType: 'callout', x: 410, y: 180, width: 340, height: 300, label: 'Highlights' },
      ],
    },
  },
  {
    id: 'financials-default',
    name: 'Financial Overview',
    layoutType: 'financials',
    isSystemDefault: true,
    structure: {
      gridColumns: 2,
      gridGap: '1rem',
      placeholders: [
        { id: 'income-chart', blockType: 'chart', x: 50, y: 100, width: 340, height: 250, label: 'Revenue Chart' },
        { id: 'expense-chart', blockType: 'chart', x: 410, y: 100, width: 340, height: 250, label: 'Expense Chart' },
        { id: 'kpis', blockType: 'metricStrip', x: 50, y: 370, width: 700, height: 80, label: 'Financial KPIs' },
        { id: 'table', blockType: 'table', x: 50, y: 470, width: 700, height: 300, label: 'P&L Summary' },
      ],
    },
  },
  {
    id: 'photos-default',
    name: 'Photo Gallery',
    layoutType: 'photos',
    isSystemDefault: true,
    structure: {
      gridColumns: 2,
      gridGap: '0.5rem',
      placeholders: [
        { id: 'hero', blockType: 'image', x: 50, y: 80, width: 700, height: 350, label: 'Hero Image' },
        { id: 'gallery', blockType: 'imageGrid', x: 50, y: 450, width: 700, height: 350, label: 'Image Gallery' },
      ],
    },
  },
  {
    id: 'team-default',
    name: 'Team Page',
    layoutType: 'team',
    isSystemDefault: true,
    structure: {
      gridColumns: 1,
      gridGap: '1rem',
      placeholders: [
        { id: 'heading', blockType: 'heading', x: 50, y: 80, width: 700, height: 60, label: 'Section Title' },
        { id: 'team', blockType: 'teamGrid', x: 50, y: 160, width: 700, height: 500, label: 'Team Members' },
      ],
    },
  },
  {
    id: 'section-default',
    name: 'Section Divider',
    layoutType: 'sectionDivider',
    isSystemDefault: true,
    structure: {
      gridColumns: 1,
      gridGap: '0',
      placeholders: [
        { id: 'divider', blockType: 'sectionDivider', x: 0, y: 0, width: 816, height: 1056, label: 'Section Divider' },
      ],
    },
  },
  {
    id: 'disclaimer-default',
    name: 'Disclaimer',
    layoutType: 'disclaimer',
    isSystemDefault: true,
    structure: {
      gridColumns: 1,
      gridGap: '1rem',
      placeholders: [
        { id: 'disclaimer', blockType: 'disclaimer', x: 50, y: 80, width: 700, height: 800, label: 'Disclaimer Text' },
      ],
    },
  },
  {
    id: 'portfolio-default',
    name: 'Portfolio Summary',
    layoutType: 'portfolio',
    isSystemDefault: true,
    structure: {
      gridColumns: 1,
      gridGap: '1rem',
      placeholders: [
        { id: 'heading', blockType: 'heading', x: 50, y: 80, width: 700, height: 60, label: 'Portfolio Overview' },
        { id: 'metrics', blockType: 'metricStrip', x: 50, y: 160, width: 700, height: 80, label: 'Portfolio Metrics' },
        { id: 'table', blockType: 'portfolioTable', x: 50, y: 260, width: 700, height: 500, label: 'Properties Table' },
      ],
    },
  },
  {
    id: 'zilculator-exec-summary',
    name: 'Zilculator Executive Summary',
    description: 'Professional OM-style executive summary with hero KPIs, investment thesis, and property description',
    layoutType: 'execSummary',
    isSystemDefault: true,
    structure: {
      gridColumns: 1,
      gridGap: '1rem',
      placeholders: [
        { id: 'hero-kpis', blockType: 'heroKpiGrid', x: 50, y: 60, width: 700, height: 100, label: 'Hero KPI Cards (Purchase Price, Rent, Cash Flow, CoC)' },
        { id: 'exec-summary', blockType: 'executiveSummary', x: 50, y: 180, width: 700, height: 350, label: 'Executive Summary with Investment Thesis' },
        { id: 'property-image', blockType: 'image', x: 50, y: 550, width: 700, height: 300, label: 'Property Hero Image' },
      ],
    },
  },
  {
    id: 'zilculator-financial-analysis',
    name: 'Zilculator Financial Analysis',
    description: 'Comprehensive financial metrics with analysis tables and return ratios',
    layoutType: 'financials',
    isSystemDefault: true,
    structure: {
      gridColumns: 2,
      gridGap: '1rem',
      placeholders: [
        { id: 'financial-measures', blockType: 'financialAnalysis', x: 50, y: 60, width: 340, height: 200, label: 'Financial Measures (NPV, IRR, PI)' },
        { id: 'investment-returns', blockType: 'investmentReturns', x: 410, y: 60, width: 340, height: 200, label: 'Investment Return Ratios' },
        { id: 'financial-breakdown', blockType: 'financialBreakdown', x: 50, y: 280, width: 340, height: 280, label: 'Financial Breakdown' },
        { id: 'financing-overview', blockType: 'financingOverview', x: 410, y: 280, width: 340, height: 280, label: 'Financing Overview' },
        { id: 'goi-chart', blockType: 'combo-chart', x: 50, y: 580, width: 700, height: 250, label: 'GOI, NOI and CF Over Holding Period' },
      ],
    },
  },
  {
    id: 'zilculator-operating-analysis',
    name: 'Zilculator Operating Analysis',
    description: 'Detailed income and expense breakdown with operating ratios',
    layoutType: 'financials',
    isSystemDefault: true,
    structure: {
      gridColumns: 2,
      gridGap: '1rem',
      placeholders: [
        { id: 'operating-analysis', blockType: 'operatingAnalysis', x: 50, y: 60, width: 450, height: 400, label: 'Annual Property Operating Data' },
        { id: 'income-pie', blockType: 'pie-chart', x: 520, y: 60, width: 230, height: 200, label: 'GOI Distribution' },
        { id: 'operating-ratios', blockType: 'financialAnalysis', x: 520, y: 280, width: 230, height: 180, label: 'Operating Ratios (OER, BER)' },
        { id: 'cashflow-year1', blockType: 'financialAnalysis', x: 50, y: 480, width: 700, height: 200, label: 'Cash Flow Year 1' },
      ],
    },
  },
  {
    id: 'zilculator-cash-flow-forecast',
    name: 'Zilculator Cash Flow Forecast',
    description: '5-year cash flow projection with annual breakdown',
    layoutType: 'financials',
    isSystemDefault: true,
    structure: {
      gridColumns: 1,
      gridGap: '1rem',
      placeholders: [
        { id: 'forecast-heading', blockType: 'heading', x: 50, y: 60, width: 700, height: 50, label: 'Long-term Cash Flow Forecast' },
        { id: 'cash-flow-table', blockType: 'cashFlowForecast', x: 50, y: 130, width: 700, height: 400, label: '5-Year Cash Flow Forecast Table' },
        { id: 'equity-chart', blockType: 'area-chart', x: 50, y: 550, width: 700, height: 280, label: 'Cumulative Equity vs Debt Chart' },
      ],
    },
  },
  {
    id: 'zilculator-marina-kpis',
    name: 'Marina Performance Metrics',
    description: 'Marina-specific KPIs including slip occupancy, REVPS, and ancillary revenue',
    layoutType: 'financials',
    isSystemDefault: true,
    structure: {
      gridColumns: 1,
      gridGap: '1rem',
      placeholders: [
        { id: 'marina-heading', blockType: 'heading', x: 50, y: 60, width: 700, height: 50, label: 'Marina Performance Overview' },
        { id: 'marina-kpis', blockType: 'marinaKpis', x: 50, y: 130, width: 700, height: 180, label: 'Marina KPIs (Occupancy, REVPS, Ancillary, Fuel)' },
        { id: 'slip-mix-chart', blockType: 'pie-chart', x: 50, y: 330, width: 340, height: 200, label: 'Slip Mix by Size' },
        { id: 'revenue-mix-chart', blockType: 'pie-chart', x: 410, y: 330, width: 340, height: 200, label: 'Revenue Mix' },
        { id: 'marina-description', blockType: 'text', x: 50, y: 550, width: 700, height: 280, label: 'Marina Description & Amenities' },
      ],
    },
  },
];

export function LayoutGallery({ open, onClose, onSelectLayout }: LayoutGalleryProps) {
  const [selectedLayoutType, setSelectedLayoutType] = useState<OmLayoutType | 'all'>('all');
  const [selectedLayout, setSelectedLayout] = useState<OmPageLayoutDefinition | null>(null);

  const { data: apiLayouts = [], isLoading } = useQuery<LayoutFromApi[]>({
    queryKey: ['/api/om/layouts'],
    enabled: open,
  });

  const allLayouts: OmPageLayoutDefinition[] = [
    ...DEFAULT_LAYOUTS,
    ...apiLayouts.map(mapApiLayoutToDefinition).filter(l => !l.isSystemDefault),
  ];

  const filteredLayouts = selectedLayoutType === 'all' 
    ? allLayouts 
    : allLayouts.filter(l => l.layoutType === selectedLayoutType);

  const handleSelect = (layout: OmPageLayoutDefinition) => {
    setSelectedLayout(layout);
  };

  const handleConfirm = () => {
    if (selectedLayout) {
      onSelectLayout(selectedLayout);
      onClose();
      setSelectedLayout(null);
    }
  };

  const renderLayoutPreview = (layout: OmPageLayoutDefinition) => {
    const Icon = LAYOUT_TYPE_ICONS[layout.layoutType] || LayoutTemplate;
    
    return (
      <div className="w-full aspect-[8.5/11] bg-white border border-gray-200 rounded relative overflow-hidden">
        <div className="absolute inset-2 flex flex-col">
          {layout.structure.placeholders.slice(0, 4).map((placeholder, i) => {
            const widthPercent = (placeholder.width / 816) * 100;
            const heightPercent = (placeholder.height / 1056) * 100;
            const leftPercent = (placeholder.x / 816) * 100;
            const topPercent = (placeholder.y / 1056) * 100;
            
            return (
              <div
                key={placeholder.id}
                className="absolute bg-slate-100 border border-dashed border-slate-300 rounded-sm flex items-center justify-center"
                style={{
                  width: `${Math.min(widthPercent, 100)}%`,
                  height: `${Math.min(heightPercent, 30)}%`,
                  left: `${leftPercent}%`,
                  top: `${Math.min(topPercent / 2, i * 25)}%`,
                }}
              >
                <div className="w-2 h-2 bg-slate-300 rounded-full" />
              </div>
            );
          })}
        </div>
        <div className="absolute bottom-1 right-1">
          <Icon className="w-3 h-3 text-slate-400" />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5" />
            Choose a Layout
          </DialogTitle>
          <DialogDescription>
            Select a pre-designed layout for your new page or start with a blank canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="w-48 shrink-0 border-r pr-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Filter by Type</Label>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedLayoutType('all')}
                className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors ${
                  selectedLayoutType === 'all' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                }`}
                data-testid="button-filter-all"
              >
                All Layouts
              </button>
              {(Object.keys(LAYOUT_TYPE_LABELS) as OmLayoutType[]).map((type) => {
                const Icon = LAYOUT_TYPE_ICONS[type];
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedLayoutType(type)}
                    className={`w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors flex items-center gap-2 ${
                      selectedLayoutType === type ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                    }`}
                    data-testid={`button-filter-${type}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {LAYOUT_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <ScrollArea className="flex-1 h-[400px]">
            <div className="grid grid-cols-3 gap-4 pr-4">
              <Card
                className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
                  selectedLayout === null ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedLayout(null)}
                data-testid="layout-option-blank"
              >
                <CardContent className="p-3">
                  <div className="w-full aspect-[8.5/11] bg-slate-50 border border-dashed border-slate-200 rounded flex items-center justify-center">
                    <div className="text-center">
                      <Plus className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <span className="text-xs text-slate-400">Blank Page</span>
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-medium">Blank Canvas</div>
                    <div className="text-xs text-muted-foreground">Start from scratch</div>
                  </div>
                </CardContent>
              </Card>

              {isLoading ? (
                <div className="col-span-2 flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground">Loading layouts...</div>
                </div>
              ) : (
                filteredLayouts.map((layout) => {
                  const Icon = LAYOUT_TYPE_ICONS[layout.layoutType];
                  const isSelected = selectedLayout?.id === layout.id;
                  
                  return (
                    <Card
                      key={layout.id}
                      className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
                        isSelected ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleSelect(layout)}
                      data-testid={`layout-option-${layout.id}`}
                    >
                      <CardContent className="p-3 relative">
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center z-10">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {renderLayoutPreview(layout)}
                        <div className="mt-2">
                          <div className="flex items-center gap-1">
                            <Icon className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm font-medium truncate">{layout.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {LAYOUT_TYPE_LABELS[layout.layoutType]}
                            {layout.isSystemDefault && ' • System'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="button-use-layout">
            {selectedLayout ? `Use "${selectedLayout.name}"` : 'Create Blank Page'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
