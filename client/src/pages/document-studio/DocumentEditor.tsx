/**
 * DocumentEditor - Unified Document Studio Editor
 * Combines OM Builder canvas editing with Document Builder wizard capabilities
 * into a single three-panel editing experience.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  useDocument as useDocumentQuery,
  useSectionLibrary,
  useUpdateDocument,
  useAddSection,
  useRemoveSection,
  useReorderSections,
  useUpdateSectionContent,
  useBindingsCatalog,
  useResolveBindings,
  useGenerateContent,
  useCreateExportJob,
  useExportJob,
  type DocumentData,
  type BindingsCatalog,
  type ReorderSectionsInput,
} from '@/lib/document-builder-api';
import type {
  DocumentSection,
  SectionDefinition,
  SectionCategory,
  BlockType,
  DataSource,
  CompletionStatus,
} from '@shared/document-builder/types';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { queryClient } from '@/lib/queryClient';

import {
  FileText, ArrowLeft, Save, Download, Share2, Settings, Eye, Sparkles,
  Plus, GripVertical, Trash2, Copy, ChevronRight, ChevronDown, Link2,
  Unlink, RefreshCw, Check, AlertCircle, Type, Hash, BarChart3, Image,
  Map, Table, List, Minus, Quote, Layout, Palette, Database, FolderOpen,
  Clock, ZoomIn, ZoomOut, Maximize,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface DocumentEditorProps {
  documentId: number;
}

interface ContentBlock {
  id: string;
  type: BlockType | 'heading' | 'metric_grid' | 'image_grid' | 'bullet_list' | 'quote';
  content: Record<string, any>;
  order: number;
  bindings?: Record<string, { source: DataSource; field: string }>;
}

interface SectionCategoryConfig {
  key: SectionCategory;
  label: string;
  icon: React.ElementType;
}

interface BlockTypeConfig {
  type: ContentBlock['type'];
  label: string;
  icon: React.ElementType;
  description: string;
}

// =============================================================================
// Constants
// =============================================================================

const SECTION_CATEGORIES: SectionCategoryConfig[] = [
  { key: 'cover', label: 'Cover', icon: Layout },
  { key: 'summary', label: 'Summary', icon: FileText },
  { key: 'property', label: 'Property', icon: FolderOpen },
  { key: 'location', label: 'Location', icon: Map },
  { key: 'market', label: 'Market', icon: BarChart3 },
  { key: 'financial', label: 'Financial', icon: Hash },
  { key: 'operations', label: 'Operations', icon: Settings },
  { key: 'due_diligence', label: 'Due Diligence', icon: Check },
  { key: 'appendix', label: 'Appendix', icon: FolderOpen },
  { key: 'legal', label: 'Legal', icon: FileText },
];

const BLOCK_TYPES: BlockTypeConfig[] = [
  { type: 'text', label: 'Text', icon: Type, description: 'Rich text paragraph' },
  { type: 'heading', label: 'Heading', icon: Type, description: 'Section heading' },
  { type: 'kpi', label: 'Metric / KPI', icon: Hash, description: 'Key metric with label' },
  { type: 'metric_grid', label: 'Metric Grid', icon: Hash, description: 'Grid of KPI metrics' },
  { type: 'table', label: 'Table', icon: Table, description: 'Data table with rows/columns' },
  { type: 'chart', label: 'Chart', icon: BarChart3, description: 'Bar, line, pie, or area chart' },
  { type: 'image', label: 'Image', icon: Image, description: 'Upload or URL image' },
  { type: 'image_grid', label: 'Image Grid', icon: Image, description: 'Multi-image gallery' },
  { type: 'map', label: 'Map', icon: Map, description: 'Location map preview' },
  { type: 'bullet_list', label: 'Bullet List', icon: List, description: 'Ordered or unordered list' },
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Horizontal separator' },
  { type: 'spacer', label: 'Spacer', icon: Minus, description: 'Vertical space' },
  { type: 'quote', label: 'Quote', icon: Quote, description: 'Blockquote or callout' },
];

const DATA_SOURCES: { key: DataSource; label: string; fields: string[] }[] = [
  { key: 'deal', label: 'Deal', fields: ['name', 'status', 'askingPrice', 'capRate', 'noi', 'closingDate', 'dealType', 'stage'] },
  { key: 'property', label: 'Property', fields: ['name', 'address', 'city', 'state', 'zip', 'acreage', 'slipCount', 'yearBuilt', 'assetClass'] },
  { key: 'modeling', label: 'Financial Model', fields: ['irr', 'cashOnCash', 'debtServiceCoverage', 'leveragedReturn', 'holdPeriod', 'exitCapRate'] },
  { key: 'rent_roll', label: 'Rent Roll', fields: ['totalUnits', 'occupiedUnits', 'occupancyRate', 'avgRent', 'grossPotentialRent', 'effectiveGrossIncome'] },
  { key: 'sales_comps', label: 'Sales Comps', fields: ['avgPricePerSlip', 'avgCapRate', 'medianSalePrice', 'compCount'] },
  { key: 'demographics', label: 'Demographics', fields: ['population', 'medianIncome', 'populationGrowth', 'employmentRate'] },
  { key: 'due_diligence', label: 'Due Diligence', fields: ['environmentalStatus', 'titleStatus', 'surveyStatus', 'inspectionStatus'] },
];

const ZOOM_LEVELS = [50, 75, 100, 125, 150];

// =============================================================================
// Subcomponents
// =============================================================================

function CompletionIcon({ status }: { status?: CompletionStatus | string }) {
  if (status === 'complete') return <Check className="w-3.5 h-3.5 text-green-500" />;
  if (status === 'partial') return <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />;
  return <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30" />;
}

function SectionNavigatorItem({
  section,
  definition,
  isActive,
  onSelect,
  onToggle,
  onRemove,
}: {
  section: DocumentSection;
  definition?: SectionDefinition;
  isActive: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const Icon = SECTION_CATEGORIES.find(c => c.key === definition?.category)?.icon ?? FileText;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
        isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted',
        !section.enabled && 'opacity-50'
      )}
      onClick={onSelect}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm truncate">
        {section.customTitle || definition?.name || section.sectionKey}
      </span>
      <CompletionIcon status={section.completionStatus as string} />
      <div className="hidden group-hover:flex items-center gap-1">
        <Switch checked={section.enabled} onCheckedChange={onToggle} className="scale-75" />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function BlockRenderer({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
  onCopy,
}: {
  block: ContentBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (content: Record<string, any>) => void;
  onRemove: () => void;
  onCopy: () => void;
}) {
  const hasBoundFields = block.bindings && Object.keys(block.bindings).length > 0;

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-all',
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-border',
        hasBoundFields && 'border-l-2 border-l-blue-400'
      )}
      onClick={onSelect}
    >
      {/* Drag handle + toolbar */}
      <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
      </div>
      <div className="absolute -right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Trash2 className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onCopy(); }}>
          <Copy className="w-3 h-3" />
        </Button>
      </div>

      <div className="p-4">
        {block.type === 'text' && (
          <Textarea
            className="min-h-[80px] border-none p-0 resize-none focus-visible:ring-0 text-sm leading-relaxed"
            placeholder="Type your content here..."
            value={block.content.text || ''}
            onChange={(e) => onUpdate({ ...block.content, text: e.target.value })}
          />
        )}
        {block.type === 'heading' && (
          <Input
            className="border-none p-0 text-xl font-bold focus-visible:ring-0"
            placeholder="Section Heading"
            value={block.content.text || ''}
            onChange={(e) => onUpdate({ ...block.content, text: e.target.value })}
          />
        )}
        {block.type === 'kpi' && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <Input
                className="border-none p-0 text-2xl font-bold text-center focus-visible:ring-0 w-32"
                placeholder="$0"
                value={block.content.value || ''}
                onChange={(e) => onUpdate({ ...block.content, value: e.target.value })}
              />
              <Input
                className="border-none p-0 text-xs text-muted-foreground text-center focus-visible:ring-0 w-32"
                placeholder="Label"
                value={block.content.label || ''}
                onChange={(e) => onUpdate({ ...block.content, label: e.target.value })}
              />
            </div>
            {block.content.trend && (
              <Badge variant={block.content.trend > 0 ? 'default' : 'destructive'} className="text-xs">
                {block.content.trend > 0 ? '+' : ''}{block.content.trend}%
              </Badge>
            )}
          </div>
        )}
        {block.type === 'metric_grid' && (
          <div className="grid grid-cols-3 gap-3">
            {(block.content.metrics || [{ value: '', label: '' }, { value: '', label: '' }, { value: '', label: '' }]).map(
              (m: { value: string; label: string }, i: number) => (
                <div key={i} className="text-center p-3 bg-muted/50 rounded-md">
                  <div className="text-lg font-semibold">{m.value || '--'}</div>
                  <div className="text-xs text-muted-foreground">{m.label || 'Metric'}</div>
                </div>
              )
            )}
          </div>
        )}
        {block.type === 'table' && (
          <div className="border rounded-md overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              Table: {block.content.title || 'Untitled'} ({block.content.rows?.length || 0} rows)
            </div>
            <div className="p-3 text-sm text-muted-foreground italic">
              Click to edit table data
            </div>
          </div>
        )}
        {block.type === 'chart' && (
          <div className="border rounded-md overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Chart: {block.content.title || 'Untitled'}
              </span>
              <Badge variant="outline" className="text-xs">{block.content.chartType || 'bar'}</Badge>
            </div>
            <div className="h-40 flex items-center justify-center text-muted-foreground">
              <BarChart3 className="w-8 h-8 opacity-30" />
            </div>
          </div>
        )}
        {block.type === 'image' && (
          <div className="border-2 border-dashed rounded-md p-6 text-center">
            {block.content.url ? (
              <img src={block.content.url} alt={block.content.caption || ''} className="max-h-48 mx-auto rounded" />
            ) : (
              <div className="text-muted-foreground">
                <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Drop image or click to upload</p>
              </div>
            )}
            <Input
              className="mt-2 text-xs text-center border-none focus-visible:ring-0"
              placeholder="Caption (optional)"
              value={block.content.caption || ''}
              onChange={(e) => onUpdate({ ...block.content, caption: e.target.value })}
            />
          </div>
        )}
        {block.type === 'map' && (
          <div className="border rounded-md overflow-hidden">
            <div className="bg-muted/50 px-3 py-2">
              <Input
                className="border-none p-0 text-sm focus-visible:ring-0"
                placeholder="Enter address..."
                value={block.content.address || ''}
                onChange={(e) => onUpdate({ ...block.content, address: e.target.value })}
              />
            </div>
            <div className="h-40 bg-muted flex items-center justify-center">
              <Map className="w-8 h-8 text-muted-foreground opacity-30" />
            </div>
          </div>
        )}
        {block.type === 'bullet_list' && (
          <Textarea
            className="min-h-[60px] border-none p-0 resize-none focus-visible:ring-0 text-sm"
            placeholder="- Item 1&#10;- Item 2&#10;- Item 3"
            value={block.content.text || ''}
            onChange={(e) => onUpdate({ ...block.content, text: e.target.value })}
          />
        )}
        {block.type === 'divider' && <Separator className="my-2" />}
        {block.type === 'spacer' && <div className="h-8" />}
        {block.type === 'quote' && (
          <div className="border-l-4 border-primary/40 pl-4 italic">
            <Textarea
              className="min-h-[40px] border-none p-0 resize-none focus-visible:ring-0 text-sm italic"
              placeholder="Quote or callout text..."
              value={block.content.text || ''}
              onChange={(e) => onUpdate({ ...block.content, text: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AddBlockButton({ onAdd }: { onAdd: (type: ContentBlock['type']) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex justify-center py-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-3 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <Plus className="w-3 h-3 mr-1" /> Add Block
      </Button>
      {open && (
        <Card className="absolute top-8 z-50 w-64 p-2 grid grid-cols-2 gap-1 shadow-lg">
          {BLOCK_TYPES.map((bt) => {
            const Icon = bt.icon;
            return (
              <Button
                key={bt.type}
                variant="ghost"
                size="sm"
                className="justify-start text-xs h-8"
                onClick={() => { onAdd(bt.type); setOpen(false); }}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {bt.label}
              </Button>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// Version History Panel (right sidebar)
// =============================================================================

function VersionHistoryPanel({ documentId }: { documentId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: versions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/document-builder/documents/${documentId}/versions`],
    queryFn: async () => {
      const res = await fetch(`/api/document-builder/documents/${documentId}/versions`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const saveVersion = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/document-builder/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ changeDescription: description || undefined }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: [`/api/document-builder/documents/${documentId}/versions`] });
        toast({ title: 'Version saved' });
        setDescription('');
      }
    } catch {
      toast({ title: 'Failed to save version', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = async (versionId: string, versionNumber: number) => {
    try {
      const res = await fetch(`/api/document-builder/documents/${documentId}/versions/${versionId}/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['document-builder'] });
        toast({ title: `Restored to version ${versionNumber}` });
      }
    } catch {
      toast({ title: 'Failed to restore', variant: 'destructive' });
    }
  };

  return (
    <div className="py-3 space-y-4">
      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Save Version</h4>
        <Input
          className="h-8 text-xs mb-2"
          placeholder="Version description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button size="sm" className="w-full text-xs" onClick={saveVersion} disabled={saving}>
          {saving ? 'Saving...' : 'Save Current Version'}
        </Button>
      </div>

      <Separator />

      <div>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Version History ({versions.length})
        </h4>
        {isLoading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-14" />)}</div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No versions saved yet</p>
        ) : (
          <div className="space-y-2">
            {versions.map((v: any) => (
              <Card key={v.id} className="p-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-medium">v{v.versionNumber}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {v.changeDescription || v.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => restoreVersion(v.id, v.versionNumber)}
                  >
                    Restore
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main DocumentEditor Component
// =============================================================================

export default function DocumentEditor({ documentId }: DocumentEditorProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // --- Data fetching ---
  const { data: document, isLoading: docLoading, error: docError } = useDocumentQuery(documentId);
  const { data: sectionLibrary } = useSectionLibrary();
  const { data: bindingsCatalog } = useBindingsCatalog();

  // --- Mutations ---
  const updateDocMutation = useUpdateDocument(documentId);
  const addSectionMutation = useAddSection(documentId);
  const removeSectionMutation = useRemoveSection(documentId);
  const reorderSectionsMutation = useReorderSections(documentId);
  const generateContentMutation = useGenerateContent();
  const createExportMutation = useCreateExportJob(documentId);

  // --- Local state ---
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<'sections' | 'blocks'>('sections');
  const [rightTab, setRightTab] = useState<'properties' | 'data' | 'project' | 'versions'>('properties');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsType, setSettingsType] = useState('');
  const [settingsAudience, setSettingsAudience] = useState('');
  const [settingsStatus, setSettingsStatus] = useState('');
  const [showChangeProject, setShowChangeProject] = useState(false);
  const [newDealId, setNewDealId] = useState('');
  const [showSectionLibrary, setShowSectionLibrary] = useState(false);
  const [exportJobId, setExportJobId] = useState<number | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  // --- Section blocks (local state per section) ---
  const [sectionBlocks, setSectionBlocks] = useState<Record<string, ContentBlock[]>>({});
  const sectionBlocksRef = useRef(sectionBlocks);
  useEffect(() => { sectionBlocksRef.current = sectionBlocks; }, [sectionBlocks]);

  // --- Auto-save ---
  const lastSavedRef = useRef<Date | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Export job polling
  const { data: exportJob } = useExportJob(exportJobId);

  // Initialize section blocks from document data
  useEffect(() => {
    if (document?.sections) {
      const blocks: Record<string, ContentBlock[]> = {};
      document.sections.forEach((section) => {
        if (!sectionBlocks[section.id]) {
          const content = section.content || {};
          const existingBlocks: ContentBlock[] = [];
          let order = 0;
          if (content.narrative) {
            existingBlocks.push({ id: `${section.id}-text-0`, type: 'text', content: { text: content.narrative }, order: order++ });
          }
          if (content.bullets?.length) {
            existingBlocks.push({ id: `${section.id}-list-0`, type: 'bullet_list', content: { text: content.bullets.join('\n') }, order: order++ });
          }
          if (content.tables?.length) {
            content.tables.forEach((t: any, i: number) => {
              existingBlocks.push({ id: `${section.id}-table-${i}`, type: 'table', content: t, order: order++ });
            });
          }
          if (content.charts?.length) {
            content.charts.forEach((c: any, i: number) => {
              existingBlocks.push({ id: `${section.id}-chart-${i}`, type: 'chart', content: c, order: order++ });
            });
          }
          blocks[section.id] = existingBlocks.length > 0 ? existingBlocks : [
            { id: `${section.id}-text-new`, type: 'text', content: { text: '' }, order: 0 },
          ];
        }
      });
      setSectionBlocks((prev) => ({ ...prev, ...blocks }));
      if (!activeSectionId && document.sections.length > 0) {
        setActiveSectionId(document.sections[0].id);
      }
    }
  }, [document?.sections]);

  // Auto-save interval
  useEffect(() => {
    saveTimerRef.current = setInterval(() => {
      if (document && activeSectionId) {
        handleAutoSave();
      }
    }, 30_000);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [document, activeSectionId]);

  // Export job completion notification
  useEffect(() => {
    if (exportJob?.status === 'completed') {
      toast({ title: 'Export Complete', description: 'Your document is ready for download.' });
      setExportJobId(null);
    } else if (exportJob?.status === 'failed') {
      toast({ title: 'Export Failed', description: 'There was an error exporting your document.', variant: 'destructive' });
      setExportJobId(null);
    }
  }, [exportJob?.status]);

  // Sync settings dialog values when opened
  useEffect(() => {
    if (showSettings && document) {
      setSettingsTitle(document.title);
      setSettingsType(document.documentType);
      setSettingsAudience(document.audience || '');
      setSettingsStatus(document.status);
    }
  }, [showSettings, document]);

  // --- Callbacks ---

  const handleAutoSave = useCallback(async () => {
    if (!document || !activeSectionId) return;
    setIsSaving(true);
    try {
      const blocks = sectionBlocksRef.current[activeSectionId] || [];
      const narrative = blocks.filter(b => b.type === 'text' || b.type === 'heading').map(b => b.content.text).filter(Boolean).join('\n\n');
      const bullets = blocks.filter(b => b.type === 'bullet_list').flatMap(b => (b.content.text || '').split('\n').filter(Boolean));
      const tables = blocks.filter(b => b.type === 'table').map(b => b.content);
      const charts = blocks.filter(b => b.type === 'chart').map(b => b.content);
      const kpis = blocks.filter(b => b.type === 'kpi' || b.type === 'metric_grid').map(b => b.content);
      const images = blocks.filter(b => b.type === 'image' || b.type === 'image_grid').map(b => b.content);

      const sectionContent = {
        narrative,
        bullets,
        tables,
        charts,
        kpis,
        images,
        blocks: blocks.map(b => ({ id: b.id, type: b.type, content: b.content, order: b.order, bindings: b.bindings })),
      };

      await updateDocMutation.mutateAsync({
        metadata: {
          ...document.metadata,
          lastAutoSave: new Date().toISOString(),
          sectionContent: {
            ...(document.metadata?.sectionContent || {}),
            [activeSectionId]: sectionContent,
          },
        },
      });
      lastSavedRef.current = new Date();
    } catch (err) {
      console.warn('Auto-save failed:', err);
      // Don't show error toast to avoid spamming user, but log it
    } finally {
      setIsSaving(false);
    }
  }, [document, activeSectionId, updateDocMutation]);

  const handleTitleSave = useCallback(() => {
    if (titleDraft.trim() && titleDraft !== document?.title) {
      updateDocMutation.mutate({ title: titleDraft.trim() });
    }
    setEditingTitle(false);
  }, [titleDraft, document?.title, updateDocMutation]);

  const handleAddSection = useCallback((sectionKey: string) => {
    addSectionMutation.mutate({ sectionKey }, {
      onSuccess: () => {
        toast({ title: 'Section Added', description: `Added ${sectionKey} section.` });
        setShowSectionLibrary(false);
      },
    });
  }, [addSectionMutation, toast]);

  const handleRemoveSection = useCallback((sectionId: number) => {
    removeSectionMutation.mutate(sectionId, {
      onSuccess: () => toast({ title: 'Section Removed' }),
    });
  }, [removeSectionMutation, toast]);

  const handleToggleSection = useCallback((sectionId: string, currentEnabled: boolean) => {
    const disabledSections = { ...(document?.metadata?.disabledSections || {}) };
    if (currentEnabled) {
      disabledSections[sectionId] = true;
    } else {
      delete disabledSections[sectionId];
    }
    updateDocMutation.mutate({
      metadata: { ...document?.metadata, disabledSections },
    });
  }, [document?.metadata, updateDocMutation]);

  const handleCopyBlock = useCallback((sectionId: string, block: ContentBlock) => {
    setSectionBlocks((prev) => {
      const current = prev[sectionId] || [];
      const idx = current.findIndex(b => b.id === block.id);
      const newBlock: ContentBlock = {
        id: `${sectionId}-${block.type}-${Date.now()}`,
        type: block.type,
        content: { ...block.content },
        order: block.order + 0.5,
        bindings: block.bindings ? { ...block.bindings } : undefined,
      };
      const updated = [...current];
      updated.splice(idx + 1, 0, newBlock);
      return { ...prev, [sectionId]: updated.map((b, i) => ({ ...b, order: i })) };
    });
    toast({ title: 'Block duplicated' });
  }, [toast]);

  const handleAddBlock = useCallback((sectionId: string, type: ContentBlock['type']) => {
    setSectionBlocks((prev) => {
      const current = prev[sectionId] || [];
      const newBlock: ContentBlock = {
        id: `${sectionId}-${type}-${Date.now()}`,
        type,
        content: {},
        order: current.length,
      };
      return { ...prev, [sectionId]: [...current, newBlock] };
    });
  }, []);

  const handleUpdateBlock = useCallback((sectionId: string, blockId: string, content: Record<string, any>, bindings?: Record<string, any>) => {
    setSectionBlocks((prev) => {
      const current = prev[sectionId] || [];
      return {
        ...prev,
        [sectionId]: current.map((b) =>
          b.id === blockId ? { ...b, content, ...(bindings !== undefined ? { bindings } : {}) } : b
        ),
      };
    });
  }, []);

  const handleRemoveBlock = useCallback((sectionId: string, blockId: string) => {
    setSectionBlocks((prev) => {
      const current = prev[sectionId] || [];
      return { ...prev, [sectionId]: current.filter(b => b.id !== blockId) };
    });
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  }, [selectedBlockId]);

  const handleGenerateAI = useCallback(async (sectionKey: string) => {
    if (!document) return;
    toast({ title: 'Generating Content...', description: 'AI is writing content for this section.' });
    try {
      const result = await generateContentMutation.mutateAsync({
        sectionKey,
        promptKey: 'default',
        context: { dealId: document.dealId, documentType: document.documentType },
      });
      if (activeSectionId) {
        setSectionBlocks((prev) => ({
          ...prev,
          [activeSectionId]: [
            { id: `${activeSectionId}-ai-${Date.now()}`, type: 'text', content: { text: result.content }, order: 0 },
          ],
        }));
      }
      toast({ title: 'Content Generated', description: 'AI content has been added to this section.' });
    } catch {
      toast({ title: 'Generation Failed', description: 'Could not generate content.', variant: 'destructive' });
    }
  }, [document, activeSectionId, generateContentMutation, toast]);

  const handleExport = useCallback((format: 'pdf' | 'docx' | 'pptx') => {
    createExportMutation.mutate({ format, options: { quality: 'high' } }, {
      onSuccess: (job) => {
        setExportJobId(job.id);
        toast({ title: 'Export Started', description: `Generating ${format.toUpperCase()}...` });
      },
      onError: () => toast({ title: 'Export Failed', variant: 'destructive' }),
    });
  }, [createExportMutation, toast]);

  const resolveBindingsMutation = useResolveBindings();

  const handleResolveAll = useCallback(() => {
    if (!document?.dealId) {
      toast({ title: 'No project linked', description: 'Link a project to resolve data bindings.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Resolving Bindings', description: 'Populating bound fields from project data...' });
    // Collect all bindings from all section blocks
    const allBindings: Array<{ key: string; source: string; field: string }> = [];
    Object.values(sectionBlocks).forEach((blocks) => {
      blocks.forEach((block) => {
        if (block.bindings) {
          Object.entries(block.bindings).forEach(([key, binding]) => {
            allBindings.push({ key: `${block.id}.${key}`, source: binding.source, field: binding.field });
          });
        }
      });
    });

    if (allBindings.length === 0) {
      toast({ title: 'No bindings found', description: 'Add data bindings to blocks first.', variant: 'destructive' });
      return;
    }

    resolveBindingsMutation.mutate(
      { dealId: document.dealId, bindings: allBindings },
      {
        onSuccess: (resolved) => {
          setSectionBlocks((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((sectionId) => {
              updated[sectionId] = updated[sectionId].map((block) => {
                if (block.bindings) {
                  const newContent = { ...block.content };
                  Object.entries(block.bindings).forEach(([key, binding]) => {
                    const resolvedVal = resolved?.[`${block.id}.${key}`];
                    if (resolvedVal !== undefined) {
                      const value = typeof resolvedVal === 'object' && resolvedVal !== null && 'value' in resolvedVal ? resolvedVal.value : resolvedVal;
                      newContent[key] = value;
                    }
                  });
                  return { ...block, content: newContent };
                }
                return block;
              });
            });
            return updated;
          });
          toast({ title: 'Bindings Resolved', description: 'Data fields have been populated from the project.' });
        },
        onError: () => {
          toast({ title: 'Resolution Failed', description: 'Could not resolve bindings.', variant: 'destructive' });
        },
      }
    );
  }, [document?.dealId, sectionBlocks, resolveBindingsMutation, toast]);

  // --- Derived data ---

  const activeSection = useMemo(() => {
    return document?.sections.find(s => s.id === activeSectionId) ?? null;
  }, [document?.sections, activeSectionId]);

  const activeSectionDef = useMemo(() => {
    if (!activeSection || !sectionLibrary) return null;
    return sectionLibrary[activeSection.sectionKey] ?? null;
  }, [activeSection, sectionLibrary]);

  const activeBlocks = useMemo(() => {
    if (!activeSectionId) return [];
    return (sectionBlocks[activeSectionId] || []).sort((a, b) => a.order - b.order);
  }, [activeSectionId, sectionBlocks]);

  const selectedBlock = useMemo(() => {
    return activeBlocks.find(b => b.id === selectedBlockId) ?? null;
  }, [activeBlocks, selectedBlockId]);

  const [localSectionTitle, setLocalSectionTitle] = useState('');

  useEffect(() => {
    if (activeSection) {
      setLocalSectionTitle(activeSection.customTitle || activeSectionDef?.name || activeSection.sectionKey);
    }
  }, [activeSectionId, activeSection?.customTitle, activeSectionDef?.name]);

  const sortedSections = useMemo(() => {
    return [...(document?.sections || [])].sort((a, b) => a.order - b.order);
  }, [document?.sections]);

  const wordCount = useMemo(() => {
    let count = 0;
    Object.values(sectionBlocks).forEach(blocks => {
      blocks.forEach(b => {
        const text = b.content.text || b.content.narrative || '';
        count += text.split(/\s+/).filter(Boolean).length;
      });
    });
    return count;
  }, [sectionBlocks]);

  const pageEstimate = Math.max(1, Math.ceil(wordCount / 300));

  // --- Loading / Error states ---

  if (docLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
          <div className="flex gap-2 justify-center">
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-10 w-10 rounded" />
            <Skeleton className="h-10 w-10 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (docError || !document) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Document Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {docError instanceof Error ? docError.message : 'Unable to load the requested document.'}
          </p>
          <Button onClick={() => navigate('/document-studio')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Documents
          </Button>
        </Card>
      </div>
    );
  }

  // --- Render ---

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        {/* ================================================================ */}
        {/* Top Toolbar                                                       */}
        {/* ================================================================ */}
        <header className="flex items-center gap-2 px-4 h-14 border-b bg-background shrink-0 z-20">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => navigate('/document-studio')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to hub</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          {/* Document title */}
          {editingTitle ? (
            <Input
              autoFocus
              className="w-56 h-8 text-sm font-semibold"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
            />
          ) : (
            <button
              className="text-sm font-semibold hover:underline truncate max-w-[200px]"
              onClick={() => { setTitleDraft(document.title); setEditingTitle(true); }}
            >
              {document.title || 'Untitled Document'}
            </button>
          )}

          {/* Project badge */}
          {document.dealId && (
            <Badge variant="outline" className="text-xs cursor-pointer shrink-0">
              <Link2 className="w-3 h-3 mr-1" />
              Deal #{document.dealId}
            </Badge>
          )}

          {/* Status badge */}
          <Badge
            variant={document.status === 'draft' ? 'secondary' : document.status === 'completed' ? 'default' : 'outline'}
            className="text-xs capitalize shrink-0"
          >
            {document.status.replace('_', ' ')}
          </Badge>

          {/* Auto-save indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-1 shrink-0">
            {isSaving ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Saving...</span>
              </>
            ) : lastSavedRef.current ? (
              <>
                <Check className="w-3 h-3 text-green-500" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                <span>Auto-save on</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Right-side toolbar buttons */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                handleAutoSave();
                window.open(`/document-builder/${documentId}?preview=true`, '_blank', 'width=900,height=700');
              }}>
                <Eye className="w-4 h-4 mr-1" /> Preview
              </Button>
            </TooltipTrigger>
            <TooltipContent>Preview document</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs">
                <Download className="w-4 h-4 mr-1" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="w-4 h-4 mr-2" /> Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('docx')}>
                <FileText className="w-4 h-4 mr-2" /> Export as DOCX
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pptx')}>
                <FileText className="w-4 h-4 mr-2" /> Export as PPTX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => {
                const shareUrl = `${window.location.origin}/document-studio/editor/${documentId}`;
                navigator.clipboard.writeText(shareUrl).then(() => {
                  toast({ title: 'Link Copied', description: 'Document link copied to clipboard.' });
                }).catch(() => {
                  toast({ title: 'Copy Failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
                });
              }}>
                <Share2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          <Button variant="default" size="sm" className="text-xs gap-1.5">
            <Sparkles className="w-4 h-4" /> AI Assistant
          </Button>
        </header>

        {/* ================================================================ */}
        {/* Main Content: Three-panel layout                                  */}
        {/* ================================================================ */}
        <div className="flex flex-1 overflow-hidden">
          {/* -------------------------------------------------------------- */}
          {/* Left Sidebar                                                     */}
          {/* -------------------------------------------------------------- */}
          {leftSidebarOpen && (
            <aside className="w-[280px] border-r bg-muted/20 flex flex-col shrink-0">
              <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as typeof leftTab)} className="flex flex-col flex-1">
                <TabsList className="mx-3 mt-3 grid grid-cols-2">
                  <TabsTrigger value="sections" className="text-xs">Sections</TabsTrigger>
                  <TabsTrigger value="blocks" className="text-xs">Blocks</TabsTrigger>
                </TabsList>

                {/* Section Navigator */}
                <TabsContent value="sections" className="flex-1 flex flex-col mt-0 px-3 pb-3">
                  <ScrollArea className="flex-1">
                    <div className="space-y-1 py-2">
                      {sortedSections.map((section) => (
                        <SectionNavigatorItem
                          key={section.id}
                          section={section}
                          definition={sectionLibrary?.[section.sectionKey]}
                          isActive={section.id === activeSectionId}
                          onSelect={() => { setActiveSectionId(section.id); setSelectedBlockId(null); }}
                          onToggle={() => handleToggleSection(section.id, section.enabled)}
                          onRemove={() => handleRemoveSection(Number(section.id))}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowSectionLibrary(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Section
                  </Button>
                </TabsContent>

                {/* Content Blocks Library */}
                <TabsContent value="blocks" className="flex-1 mt-0 px-3 pb-3">
                  <ScrollArea className="h-full">
                    <div className="space-y-1 py-2">
                      {BLOCK_TYPES.map((bt) => {
                        const Icon = bt.icon;
                        return (
                          <button
                            key={bt.type}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-left"
                            onClick={() => activeSectionId && handleAddBlock(activeSectionId, bt.type)}
                            disabled={!activeSectionId}
                          >
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium text-xs">{bt.label}</div>
                              <div className="text-[10px] text-muted-foreground">{bt.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </aside>
          )}

          {/* Toggle left sidebar */}
          <button
            className="w-5 flex items-center justify-center hover:bg-muted transition-colors shrink-0 border-r"
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          >
            <ChevronRight className={cn('w-3 h-3 text-muted-foreground transition-transform', leftSidebarOpen && 'rotate-180')} />
          </button>

          {/* -------------------------------------------------------------- */}
          {/* Center Canvas                                                    */}
          {/* -------------------------------------------------------------- */}
          <main className="flex-1 flex flex-col overflow-hidden bg-muted/30">
            <ScrollArea className="flex-1">
              <div
                className="max-w-3xl mx-auto py-8 px-6"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              >
                {activeSection ? (
                  <>
                    {/* Section header */}
                    <div className="flex items-center gap-3 mb-6">
                      <Input
                        className="text-xl font-bold border-none p-0 focus-visible:ring-0 flex-1"
                        value={localSectionTitle}
                        onChange={(e) => setLocalSectionTitle(e.target.value)}
                        onBlur={() => {
                          if (activeSection && localSectionTitle !== (activeSection.customTitle || activeSectionDef?.name || activeSection.sectionKey)) {
                            updateDocMutation.mutate({
                              metadata: { ...document.metadata, sectionTitles: { ...(document.metadata?.sectionTitles || {}), [activeSection.sectionKey]: localSectionTitle } },
                            });
                          }
                        }}
                        placeholder="Section Title"
                      />
                      <Badge variant="outline" className="text-xs capitalize shrink-0">
                        {activeSectionDef?.category || 'custom'}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 shrink-0"
                        disabled={generateContentMutation.isPending}
                        onClick={() => handleGenerateAI(activeSection.sectionKey)}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {generateContentMutation.isPending ? 'Generating...' : 'Generate with AI'}
                      </Button>
                    </div>

                    {/* Blocks */}
                    <div className="space-y-1 pl-8">
                      {activeBlocks.map((block) => (
                        <React.Fragment key={block.id}>
                          <BlockRenderer
                            block={block}
                            isSelected={block.id === selectedBlockId}
                            onSelect={() => setSelectedBlockId(block.id)}
                            onUpdate={(content) => { if (!activeSectionId) return; handleUpdateBlock(activeSectionId, block.id, content); }}
                            onRemove={() => { if (!activeSectionId) return; handleRemoveBlock(activeSectionId, block.id); }}
                            onCopy={() => { if (!activeSectionId) return; handleCopyBlock(activeSectionId, block); }}
                          />
                          <AddBlockButton onAdd={(type) => { if (!activeSectionId) return; handleAddBlock(activeSectionId, type); }} />
                        </React.Fragment>
                      ))}
                      {activeBlocks.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <Type className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="text-sm mb-3">This section is empty</p>
                          <AddBlockButton onAdd={(type) => { if (!activeSectionId) return; handleAddBlock(activeSectionId, type); }} />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-20 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <h3 className="font-medium mb-1">Select a Section</h3>
                    <p className="text-sm">Choose a section from the sidebar to start editing</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </main>

          {/* Toggle right sidebar */}
          <button
            className="w-5 flex items-center justify-center hover:bg-muted transition-colors shrink-0 border-l"
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
          >
            <ChevronRight className={cn('w-3 h-3 text-muted-foreground transition-transform', !rightSidebarOpen && 'rotate-180')} />
          </button>

          {/* -------------------------------------------------------------- */}
          {/* Right Sidebar                                                    */}
          {/* -------------------------------------------------------------- */}
          {rightSidebarOpen && (
            <aside className="w-[320px] border-l bg-muted/20 flex flex-col shrink-0">
              <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as typeof rightTab)} className="flex flex-col flex-1">
                <TabsList className="mx-3 mt-3 grid grid-cols-4">
                  <TabsTrigger value="properties" className="text-xs">Properties</TabsTrigger>
                  <TabsTrigger value="data" className="text-xs">Data</TabsTrigger>
                  <TabsTrigger value="project" className="text-xs">Project</TabsTrigger>
                  <TabsTrigger value="versions" className="text-xs">Versions</TabsTrigger>
                </TabsList>

                {/* Properties Tab */}
                <TabsContent value="properties" className="flex-1 mt-0 px-3 pb-3 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 py-3">
                      {/* Section properties */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Section</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Layout Variant</label>
                            <Select defaultValue="default">
                              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">Default</SelectItem>
                                <SelectItem value="two-column">Two Column</SelectItem>
                                <SelectItem value="full-bleed">Full Bleed</SelectItem>
                                <SelectItem value="sidebar">With Sidebar</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Background</label>
                            <Input className="h-8 text-xs mt-1" type="color" defaultValue="#ffffff" />
                          </div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs text-muted-foreground">Page Break Before</label>
                            <Switch
                              checked={activeSection?.content?.pageBreakBefore || false}
                              onCheckedChange={(checked) => {
                                if (activeSection) {
                                  updateDocMutation.mutate({
                                    metadata: { ...document.metadata, pageBreaks: { ...(document.metadata?.pageBreaks || {}), [activeSection.sectionKey]: checked } },
                                  });
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Block properties */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Block</h4>
                        {selectedBlock ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-muted-foreground">Type</label>
                              <div className="text-sm font-medium mt-0.5 capitalize">{selectedBlock.type.replace('_', ' ')}</div>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Font Size</label>
                              <Slider
                                value={[selectedBlock?.content?.fontSize || 14]}
                                min={10} max={36} step={1}
                                className="mt-2"
                                onValueChange={([val]) => {
                                  if (selectedBlock && activeSectionId) {
                                    handleUpdateBlock(activeSectionId, selectedBlock.id, { ...selectedBlock.content, fontSize: val });
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Alignment</label>
                              <Select
                                value={selectedBlock?.content?.alignment || 'left'}
                                onValueChange={(val) => {
                                  if (selectedBlock && activeSectionId) {
                                    handleUpdateBlock(activeSectionId, selectedBlock.id, { ...selectedBlock.content, alignment: val });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="left">Left</SelectItem>
                                  <SelectItem value="center">Center</SelectItem>
                                  <SelectItem value="right">Right</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Text Color</label>
                              <Input
                                type="color"
                                value={selectedBlock?.content?.color || '#000000'}
                                className="h-8 w-full cursor-pointer mt-1"
                                onChange={(e) => {
                                  if (selectedBlock && activeSectionId) {
                                    handleUpdateBlock(activeSectionId, selectedBlock.id, { ...selectedBlock.content, color: e.target.value });
                                  }
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Padding</label>
                              <Slider
                                value={[selectedBlock?.content?.padding || 0]}
                                min={0} max={48} step={4}
                                className="mt-2"
                                onValueChange={([val]) => {
                                  if (selectedBlock && activeSectionId) {
                                    handleUpdateBlock(activeSectionId, selectedBlock.id, { ...selectedBlock.content, padding: val });
                                  }
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-muted-foreground">Visible</label>
                              <Switch
                                checked={selectedBlock?.content?.visible !== false}
                                onCheckedChange={(checked) => {
                                  if (selectedBlock && activeSectionId) {
                                    handleUpdateBlock(activeSectionId, selectedBlock.id, { ...selectedBlock.content, visible: checked });
                                  }
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Select a block to edit its properties</p>
                        )}
                      </div>

                      <Separator />

                      {/* Theme / brand */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                          <Palette className="w-3 h-3 inline mr-1" /> Theme
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Primary Color</label>
                            <Input className="h-8 text-xs mt-1" type="color" defaultValue="#2563eb" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Font Family</label>
                            <Select defaultValue="inter">
                              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="inter">Inter</SelectItem>
                                <SelectItem value="georgia">Georgia</SelectItem>
                                <SelectItem value="arial">Arial</SelectItem>
                                <SelectItem value="times">Times New Roman</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Logo</label>
                            <label className="cursor-pointer">
                              <Button variant="outline" size="sm" className="w-full text-xs mt-1" asChild>
                                <span><Image className="w-3.5 h-3.5 mr-1" /> Upload Logo</span>
                              </Button>
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 5 * 1024 * 1024) {
                                  toast({ title: 'File too large', description: 'Logo must be under 5MB.', variant: 'destructive' });
                                  return;
                                }
                                if (!file.type.startsWith('image/')) {
                                  toast({ title: 'Invalid file', description: 'Please select an image file.', variant: 'destructive' });
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  updateDocMutation.mutate({
                                    metadata: { ...document.metadata, logoUrl: reader.result as string },
                                  });
                                  toast({ title: 'Logo uploaded' });
                                };
                                reader.readAsDataURL(file);
                              }} />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Data Bindings Tab */}
                <TabsContent value="data" className="flex-1 mt-0 px-3 pb-3 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="py-3 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Data Sources</h4>
                        <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={handleResolveAll}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Resolve All
                        </Button>
                      </div>

                      {DATA_SOURCES.map((source) => {
                        const isExpanded = expandedSources.has(source.key);
                        return (
                          <div key={source.key} className="border rounded-md">
                            <button
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                              onClick={() => {
                                setExpandedSources(prev => {
                                  const next = new Set(prev);
                                  if (next.has(source.key)) next.delete(source.key);
                                  else next.add(source.key);
                                  return next;
                                });
                              }}
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              <Database className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="flex-1 text-left font-medium text-xs">{source.label}</span>
                              <Badge variant="outline" className="text-[10px]">{source.fields.length}</Badge>
                            </button>
                            {isExpanded && (
                              <div className="px-3 pb-2 space-y-1">
                                {source.fields.map((field) => (
                                  <div
                                    key={field}
                                    className="flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-muted/50 cursor-pointer group"
                                  >
                                    <span className="text-muted-foreground">{field}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-2 text-[10px] opacity-0 group-hover:opacity-100"
                                      onClick={() => {
                                        if (selectedBlock && activeSectionId) {
                                          const updatedBindings = {
                                            ...(selectedBlock.bindings || {}),
                                            [field]: { source: source.key, field },
                                          };
                                          handleUpdateBlock(activeSectionId, selectedBlock.id, selectedBlock.content, updatedBindings);
                                          toast({ title: 'Binding Added', description: `Bound ${source.label}.${field}` });
                                        }
                                      }}
                                    >
                                      <Link2 className="w-3 h-3 mr-0.5" /> Bind
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Project Connection Tab */}
                <TabsContent value="project" className="flex-1 mt-0 px-3 pb-3 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="py-3 space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Linked Project</h4>
                        <Card className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FolderOpen className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Deal #{document.dealId}</span>
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>Type: <span className="text-foreground capitalize">{document.documentType.replace('_', ' ')}</span></div>
                            <div>Asset Class: <span className="text-foreground capitalize">{document.assetClass || 'N/A'}</span></div>
                          </div>
                          <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => setShowChangeProject(true)}>
                            Change Project
                          </Button>
                        </Card>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Data Freshness</h4>
                        <div className="space-y-2">
                          {DATA_SOURCES.slice(0, 5).map((source) => (
                            <div key={source.key} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{source.label}</span>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {document?.updatedAt ? new Date(document.updatedAt).toLocaleDateString() : '--'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button variant="outline" size="sm" className="w-full mt-3 text-xs" onClick={() => {
                          if (document?.dealId) {
                            toast({ title: 'Refreshing data...', description: 'Pulling latest data from project.' });
                            queryClient.invalidateQueries({ queryKey: ['document-builder'] });
                          } else {
                            toast({ title: 'No project linked', description: 'Link a project first to refresh data.', variant: 'destructive' });
                          }
                        }}>
                          <RefreshCw className="w-3 h-3 mr-1" /> Refresh Data
                        </Button>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Section Bindings</h4>
                        <div className="space-y-1">
                          {sortedSections.map((section) => {
                            const bindingCount = section.dataBindings?.length || 0;
                            return (
                              <div key={section.id} className="flex items-center justify-between text-xs py-1">
                                <span className="truncate max-w-[160px]">
                                  {section.customTitle || sectionLibrary?.[section.sectionKey]?.name || section.sectionKey}
                                </span>
                                {bindingCount > 0 ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    <Link2 className="w-2.5 h-2.5 mr-0.5" /> {bindingCount}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">--</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Versions Tab */}
                <TabsContent value="versions" className="flex-1 mt-0 px-3 pb-3 overflow-hidden">
                  <ScrollArea className="h-full">
                    <VersionHistoryPanel documentId={documentId} />
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </aside>
          )}
        </div>

        {/* ================================================================ */}
        {/* Bottom Bar                                                        */}
        {/* ================================================================ */}
        <footer className="flex items-center justify-between px-4 h-9 border-t bg-background text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-3">
            <span>
              Page {sortedSections.findIndex(s => s.id === activeSectionId) + 1} of {sortedSections.length || 1}
            </span>
            <Separator orientation="vertical" className="h-4" />
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              disabled={!activeSectionId || sortedSections.findIndex(s => s.id === activeSectionId) === 0}
              onClick={() => {
                const idx = sortedSections.findIndex(s => s.id === activeSectionId);
                if (idx > 0) setActiveSectionId(sortedSections[idx - 1].id);
              }}
            >
              <ChevronRight className="w-3 h-3 rotate-180" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              disabled={!activeSectionId || sortedSections.findIndex(s => s.id === activeSectionId) === sortedSections.length - 1}
              onClick={() => {
                const idx = sortedSections.findIndex(s => s.id === activeSectionId);
                if (idx < sortedSections.length - 1) setActiveSectionId(sortedSections[idx + 1].id);
              }}
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}>
                <ZoomOut className="w-3 h-3" />
              </Button>
              <Select value={String(zoomLevel)} onValueChange={(v) => setZoomLevel(Number(v))}>
                <SelectTrigger className="h-6 w-16 text-xs border-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ZOOM_LEVELS.map((z) => (
                    <SelectItem key={z} value={String(z)}>{z}%</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoomLevel(Math.min(150, zoomLevel + 25))}>
                <ZoomIn className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoomLevel(100)}>
                <Maximize className="w-3 h-3" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <span>{wordCount.toLocaleString()} words</span>
            <span>~{pageEstimate} {pageEstimate === 1 ? 'page' : 'pages'}</span>
            {lastSavedRef.current && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>Last saved {lastSavedRef.current.toLocaleTimeString()}</span>
              </>
            )}
          </div>
        </footer>

        {/* ================================================================ */}
        {/* Section Library Dialog                                            */}
        {/* ================================================================ */}
        <Dialog open={showSectionLibrary} onOpenChange={setShowSectionLibrary}>
          <DialogContent className="max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Add Section</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {SECTION_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const items = sectionLibrary
                    ? Object.values(sectionLibrary).filter(s => s.category === cat.key)
                    : [];
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.key}>
                      <h4 className="flex items-center gap-2 text-sm font-semibold mb-2">
                        <Icon className="w-4 h-4" /> {cat.label}
                      </h4>
                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <div
                            key={item.sectionKey}
                            className="flex items-center justify-between p-2.5 rounded-md border hover:bg-muted/50 transition-colors"
                          >
                            <div>
                              <div className="text-sm font-medium">{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.description}</div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs shrink-0 ml-3"
                              onClick={() => handleAddSection(item.sectionKey)}
                              disabled={addSectionMutation.isPending}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* ================================================================ */}
        {/* Settings Dialog                                                   */}
        {/* ================================================================ */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Document Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Document Title</label>
                <Input className="mt-1" value={settingsTitle} onChange={(e) => setSettingsTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Document Type</label>
                <Select value={settingsType} onValueChange={setSettingsType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offering_memorandum">Offering Memorandum</SelectItem>
                    <SelectItem value="executive_summary">Executive Summary</SelectItem>
                    <SelectItem value="pitch_deck">Pitch Deck</SelectItem>
                    <SelectItem value="ic_memo">IC Memo</SelectItem>
                    <SelectItem value="teaser">Teaser</SelectItem>
                    <SelectItem value="lender_package">Lender Package</SelectItem>
                    <SelectItem value="due_diligence_summary">DD Summary</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Audience</label>
                <Select value={settingsAudience} onValueChange={setSettingsAudience}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select audience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institutional_investor">Institutional Investor</SelectItem>
                    <SelectItem value="private_equity">Private Equity</SelectItem>
                    <SelectItem value="family_office">Family Office</SelectItem>
                    <SelectItem value="lender">Lender</SelectItem>
                    <SelectItem value="potential_buyer">Potential Buyer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={settingsStatus} onValueChange={setSettingsStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="completed">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
              <Button onClick={() => {
                updateDocMutation.mutate({
                  title: settingsTitle,
                  audience: (settingsAudience || null) as any,
                  status: settingsStatus as any,
                  metadata: { ...document.metadata, documentType: settingsType },
                }, {
                  onSuccess: () => {
                    toast({ title: 'Settings saved' });
                    setShowSettings(false);
                  },
                });
              }} disabled={updateDocMutation.isPending}>
                {updateDocMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ================================================================ */}
        {/* Change Project Dialog                                             */}
        {/* ================================================================ */}
        <Dialog open={showChangeProject} onOpenChange={setShowChangeProject}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Linked Project</DialogTitle>
            </DialogHeader>
            <div>
              <label className="text-sm font-medium">Deal ID</label>
              <Input className="mt-1" type="number" placeholder="Enter deal ID..." value={newDealId} onChange={(e) => setNewDealId(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowChangeProject(false)}>Cancel</Button>
              <Button onClick={() => {
                const dealId = parseInt(newDealId, 10);
                if (isNaN(dealId) || dealId <= 0) {
                  toast({ title: 'Invalid deal ID', variant: 'destructive' });
                  return;
                }
                updateDocMutation.mutate({ dealId: String(dealId), metadata: { ...document.metadata, linkedDealId: dealId } }, {
                  onSuccess: () => {
                    toast({ title: 'Project updated' });
                    setShowChangeProject(false);
                    setNewDealId('');
                  },
                });
              }} disabled={!newDealId || updateDocMutation.isPending}>
                Link Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
