import React, { useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OmPage, BlockType, OmTheme } from "@/lib/types";
import { 
  FileText, BarChart3, Image as ImageIcon, LayoutTemplate, Type, Table, Map, Wand2, Upload, Database, 
  FileSpreadsheet, Trash2, Loader2, Sparkles, Heading, Quote, LineChart as LineChartIcon, 
  PieChart as PieChartIcon, AreaChart as AreaChartIcon, TrendingUp, Activity, Gauge, Target, 
  DollarSign, Percent, Hash, Grid3X3, List, GalleryHorizontal 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandingPanel } from "./branding-panel";
import { AiPanel } from "./ai-panel";
import { useDatasets, useUploadDataset, useDeleteDataset, type DataSource } from "@/lib/api";
import type { Dataset } from "@shared/schema";

interface SidebarProps {
  pages: OmPage[];
  activePageId: string;
  currentTheme?: OmTheme;
  projectId: string;
  selectedBlockId?: string;
  selectedBlockContent?: string;
  onPageSelect: (id: string) => void;
  onAddBlock: (type: BlockType) => void;
  onAddPage: () => void;
  onAiAction: (action: string) => void;
  onThemeSelect: (theme: OmTheme) => void;
  onBindData?: (datasetId: string, sheetName?: string) => void;
  onInsertAiContent?: (content: string) => void;
}

export function Sidebar({ pages, activePageId, currentTheme, projectId, selectedBlockId, selectedBlockContent, onPageSelect, onAddBlock, onAddPage, onAiAction, onThemeSelect, onBindData, onInsertAiContent }: SidebarProps) {
  return (
    <div className="h-full w-64 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <h3 className="font-medium text-lg tracking-tight">OM Builder</h3>
      </div>
      
      <Tabs defaultValue="pages" className="flex-1 flex flex-col">
        <div className="px-4 pt-4">
          <TabsList className="w-full bg-muted grid grid-cols-6 h-9 p-1 rounded-md">
            <TabsTrigger value="pages" className="text-xs font-medium py-1.5 px-1 rounded-md">Pages</TabsTrigger>
            <TabsTrigger value="blocks" className="text-xs font-medium py-1.5 px-1 rounded-md">Blocks</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs font-medium py-1.5 px-1 rounded-md flex items-center gap-0.5">
              <Sparkles className="w-3 h-3" />AI
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs font-medium py-1.5 px-1 rounded-md">Data</TabsTrigger>
            <TabsTrigger value="style" className="text-xs font-medium py-1.5 px-1 rounded-md">Style</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs font-medium py-1.5 px-1 rounded-md">Tmpls</TabsTrigger>
          </TabsList>
        </div>

        {/* Pages Tab */}
        <TabsContent value="pages" className="flex-1 flex flex-col mt-0 h-full">
          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-2">
              {pages.map((page, index) => (
                <div
                  key={page.id}
                  onClick={() => onPageSelect(page.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl text-sm cursor-pointer transition-all",
                    activePageId === page.id 
                      ? "bg-background shadow-sm border border-border" 
                      : "hover:brightness-95 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="w-7 h-9 bg-card border border-border rounded-md flex items-center justify-center shrink-0">
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">{index + 1}</span>
                  </div>
                  <span className="font-medium truncate text-sm">{page.title}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-sidebar-border">
            <Button variant="outline" className="w-full gap-2" onClick={onAddPage} data-testid="button-add-page">
              <FileText className="w-4 h-4" />
              Add New Page
            </Button>
          </div>
        </TabsContent>

        {/* Blocks Tab */}
        <TabsContent value="blocks" className="flex-1 mt-0">
          <ScrollArea className="h-full px-4 py-4">
            {/* Text & Content */}
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wider mb-3">Content</h3>
              <div className="grid grid-cols-3 gap-3">
                <BlockButton icon={Type} label="Text" onClick={() => onAddBlock('text')} />
                <BlockButton icon={Heading} label="Heading" onClick={() => onAddBlock('heading')} />
                <BlockButton icon={Quote} label="Callout" onClick={() => onAddBlock('callout')} />
              </div>
            </div>

            {/* Charts & Graphs */}
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wider mb-3">Charts</h3>
              <div className="grid grid-cols-3 gap-3">
                <BlockButton icon={BarChart3} label="Bar" onClick={() => onAddBlock('chart')} />
                <BlockButton icon={LineChartIcon} label="Line" onClick={() => onAddBlock('line-chart')} />
                <BlockButton icon={PieChartIcon} label="Pie" onClick={() => onAddBlock('pie-chart')} />
                <BlockButton icon={AreaChartIcon} label="Area" onClick={() => onAddBlock('area-chart')} />
                <BlockButton icon={TrendingUp} label="Trend" onClick={() => onAddBlock('trend-chart')} />
                <BlockButton icon={Activity} label="Combo" onClick={() => onAddBlock('combo-chart')} />
              </div>
            </div>

            {/* KPIs & Metrics */}
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wider mb-3">KPIs & Metrics</h3>
              <div className="grid grid-cols-3 gap-3">
                <BlockButton icon={LayoutTemplate} label="KPI Strip" onClick={() => onAddBlock('kpi')} />
                <BlockButton icon={Gauge} label="Gauge" onClick={() => onAddBlock('gauge')} />
                <BlockButton icon={Target} label="Target" onClick={() => onAddBlock('target-kpi')} />
                <BlockButton icon={DollarSign} label="Currency" onClick={() => onAddBlock('currency-kpi')} />
                <BlockButton icon={Percent} label="Percent" onClick={() => onAddBlock('percent-kpi')} />
                <BlockButton icon={Hash} label="Number" onClick={() => onAddBlock('number-kpi')} />
              </div>
            </div>

            {/* Data Display */}
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wider mb-3">Data</h3>
              <div className="grid grid-cols-3 gap-3">
                <BlockButton icon={Table} label="Table" onClick={() => onAddBlock('table')} />
                <BlockButton icon={Grid3X3} label="Matrix" onClick={() => onAddBlock('matrix')} />
                <BlockButton icon={List} label="List" onClick={() => onAddBlock('list')} />
              </div>
            </div>

            {/* Media & Location */}
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wider mb-3">Media</h3>
              <div className="grid grid-cols-3 gap-3">
                <BlockButton icon={ImageIcon} label="Image" onClick={() => onAddBlock('image')} />
                <BlockButton icon={GalleryHorizontal} label="Gallery" onClick={() => onAddBlock('gallery')} />
                <BlockButton icon={Map} label="Map" onClick={() => onAddBlock('map')} />
              </div>
            </div>

            {/* AI Quick Actions */}
            <div className="mt-6 pt-6 border-t border-border">
               <div className="flex items-center gap-2 mb-3">
                 <Wand2 className="w-4 h-4 text-primary" />
                 <h3 className="text-xs font-medium uppercase text-muted-foreground tracking-wider">AI Quick Add</h3>
               </div>
               <div className="space-y-2">
                 <Button 
                    variant="outline" 
                    className="w-full justify-start text-sm"
                    onClick={() => onAiAction('draft_exec_summary')}
                 >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Draft Executive Summary
                 </Button>
                 <Button 
                    variant="outline" 
                    className="w-full justify-start text-sm"
                    onClick={() => onAiAction('generate_market')}
                 >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Market Analysis
                 </Button>
               </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* AI Tab */}
        <TabsContent value="ai" className="flex-1 mt-0 h-full">
          <AiPanel 
            onInsertContent={onInsertAiContent || (() => {})} 
            selectedBlockId={selectedBlockId}
            selectedBlockContent={selectedBlockContent}
          />
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="flex-1 mt-0 h-full">
          <DataPanel projectId={projectId} onBindData={onBindData} />
        </TabsContent>

        {/* Style / Branding Tab */}
        <TabsContent value="style" className="flex-1 mt-0 h-full">
            <BrandingPanel currentTheme={currentTheme} onThemeSelect={onThemeSelect} />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="flex-1 mt-0">
          <div className="p-8 text-center text-muted-foreground">
            <LayoutTemplate className="w-10 h-10 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Templates coming soon...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BlockButton({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-border bg-card hover:brightness-95 transition-all group shadow-sm"
    >
      <Icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  );
}

interface DataPanelProps {
  projectId: string;
  onBindData?: (datasetId: string, sheetName?: string) => void;
}

function DataPanel({ projectId, onBindData }: DataPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadType, setUploadType] = useState<string>('underwriting');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expandedDataset, setExpandedDataset] = useState<string | null>(null);

  const { data: datasets = [], isLoading } = useDatasets(projectId);
  const uploadMutation = useUploadDataset();
  const deleteMutation = useDeleteDataset();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadName) {
        setUploadName(file.name.replace(/\.(xlsx?|csv)$/i, ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadName) return;
    
    try {
      await uploadMutation.mutateAsync({
        file: selectedFile,
        projectId,
        name: uploadName,
        type: uploadType,
      });
      setSelectedFile(null);
      setUploadName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this dataset?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Upload className="w-3 h-3 text-blue-400" />
            <h3 className="text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">Upload Data</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-sidebar-foreground/70">File (Excel or CSV)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-file-upload"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-1 justify-start text-xs"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-select-file"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {selectedFile ? selectedFile.name : 'Select file...'}
              </Button>
            </div>

            <div>
              <Label className="text-xs text-sidebar-foreground/70">Dataset Name</Label>
              <Input
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g., Q4 Underwriting"
                className="mt-1 h-8 text-xs"
                data-testid="input-dataset-name"
              />
            </div>

            <div>
              <Label className="text-xs text-sidebar-foreground/70">Type</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger className="mt-1 h-8 text-xs" data-testid="select-dataset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="underwriting">Underwriting Model</SelectItem>
                  <SelectItem value="sales_comps">Sales Comps</SelectItem>
                  <SelectItem value="rent_comps">Rent Comps</SelectItem>
                  <SelectItem value="custom">Custom Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!selectedFile || !uploadName || uploadMutation.isPending}
              className="w-full gap-2"
              size="sm"
              data-testid="button-upload-dataset"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Upload & Parse
            </Button>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-3 h-3 text-green-400" />
            <h3 className="text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider">Available Data</h3>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-sidebar-foreground/50" />
            </div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-4 text-xs text-sidebar-foreground/50">
              <FileSpreadsheet className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p>No datasets uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {datasets.map((dataset: Dataset) => (
                <DatasetItem
                  key={dataset.id}
                  dataset={dataset}
                  isExpanded={expandedDataset === dataset.id}
                  onToggle={() => setExpandedDataset(expandedDataset === dataset.id ? null : dataset.id)}
                  onDelete={() => handleDelete(dataset.id)}
                  onBindData={onBindData}
                />
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-sidebar-border">
            <p className="text-[10px] text-sidebar-foreground/40 mb-2">External Sources</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 p-2 rounded bg-sidebar-accent/30 text-xs">
                <Database className="w-3 h-3 text-purple-400" />
                <span>Market Data</span>
                <span className="ml-auto text-[10px] text-sidebar-foreground/40">API</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-sidebar-accent/30 text-xs">
                <Database className="w-3 h-3 text-purple-400" />
                <span>Demographics</span>
                <span className="ml-auto text-[10px] text-sidebar-foreground/40">API</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

interface DatasetItemProps {
  dataset: Dataset;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onBindData?: (datasetId: string, sheetName?: string) => void;
}

function DatasetItem({ dataset, isExpanded, onToggle, onDelete, onBindData }: DatasetItemProps) {
  const sheetNames = dataset.sheetNames || [];
  const metadata = dataset.metadata as any;

  return (
    <div className="border border-sidebar-border rounded-md overflow-hidden" data-testid={`dataset-item-${dataset.id}`}>
      <div 
        className="flex items-center gap-2 p-2 bg-sidebar-accent/20 cursor-pointer hover:bg-sidebar-accent/40 transition-colors"
        onClick={onToggle}
      >
        <FileSpreadsheet className="w-4 h-4 text-green-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{dataset.name}</p>
          <p className="text-[10px] text-sidebar-foreground/50">{dataset.type} • {sheetNames.length} sheet(s)</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          data-testid={`button-delete-dataset-${dataset.id}`}
        >
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </div>
      
      {isExpanded && sheetNames.length > 0 && (
        <div className="p-2 space-y-1 bg-sidebar-accent/10">
          {sheetNames.map((sheetName) => {
            const sheetMeta = metadata?.sheets?.[sheetName];
            return (
              <div
                key={sheetName}
                className="flex items-center justify-between p-2 rounded bg-background/50 text-xs"
              >
                <div>
                  <p className="font-medium">{sheetName}</p>
                  <p className="text-[10px] text-sidebar-foreground/50">
                    {sheetMeta?.rowCount || 0} rows
                  </p>
                </div>
                {onBindData && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => onBindData(dataset.id, sheetName)}
                    data-testid={`button-bind-${dataset.id}-${sheetName}`}
                  >
                    Use Data
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
