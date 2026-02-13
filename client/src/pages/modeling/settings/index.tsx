import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, GripVertical, Loader2, Settings, BookText, ChevronRight, Download, DollarSign, Calendar } from 'lucide-react';
import { Link } from 'wouter';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ModelingRegion = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

const DEFAULT_REGIONS = [
  'Mid-Atlantic',
  'Mid-West',
  'Northeast',
  'Pacific Northwest',
  'South-Southwest',
  'Southeast',
  'West',
];

function SortableRow({ region, onEdit, onDelete }: {
  region: ModelingRegion;
  onEdit: (region: ModelingRegion) => void;
  onDelete: (region: ModelingRegion) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: region.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-12">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-1 hover:bg-muted rounded"
          data-testid={`drag-handle-${region.id}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-medium" data-testid={`region-name-${region.id}`}>
        {region.name}
      </TableCell>
      <TableCell>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            region.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          }`}
          data-testid={`region-status-${region.id}`}
        >
          {region.isActive ? 'Active' : 'Inactive'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(region)}
            data-testid={`button-edit-region-${region.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(region)}
            data-testid={`button-delete-region-${region.id}`}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

type DisplayPreferences = {
  priceRoundingDigits: number;
  ebitdaRoundingDigits: number;
  lineItemRoundingDigits: number;
  percentRoundingDecimals: number;
  bottomLineMetric: 'noi' | 'ebitda';
  year1Mode: 'calendar_year_end' | 'next_12_months';
};

const ROUNDING_OPTIONS = [
  { value: -1, label: 'No rounding', example: '$3,287,567' },
  { value: 0, label: 'Nearest $1', example: '$3,287,567' },
  { value: 1, label: 'Nearest $10', example: '$3,287,570' },
  { value: 2, label: 'Nearest $100', example: '$3,287,600' },
  { value: 3, label: 'Nearest $1,000', example: '$3,288,000' },
  { value: 4, label: 'Nearest $10,000', example: '$3,290,000' },
  { value: 5, label: 'Nearest $100,000', example: '$3,300,000' },
  { value: 6, label: 'Nearest $1,000,000', example: '$3,000,000' },
];

const EBITDA_ROUNDING_OPTIONS = [
  { value: -1, label: 'No rounding', example: '$1,287,567' },
  { value: 0, label: 'Nearest $1', example: '$1,287,567' },
  { value: 1, label: 'Nearest $10', example: '$1,287,570' },
  { value: 2, label: 'Nearest $100', example: '$1,287,600' },
  { value: 3, label: 'Nearest $1,000', example: '$1,288,000' },
  { value: 4, label: 'Nearest $10,000', example: '$1,290,000' },
  { value: 5, label: 'Nearest $100,000', example: '$1,300,000' },
  { value: 6, label: 'Nearest $1,000,000', example: '$1,000,000' },
];

const LINE_ITEM_ROUNDING_OPTIONS = [
  { value: -1, label: 'No rounding', example: '$47,823' },
  { value: 0, label: 'Nearest $1', example: '$47,823' },
  { value: 1, label: 'Nearest $10', example: '$47,820' },
  { value: 2, label: 'Nearest $100', example: '$47,800' },
  { value: 3, label: 'Nearest $1,000', example: '$48,000' },
];

const PERCENT_ROUNDING_OPTIONS = [
  { value: 0, label: 'Whole number', example: '5%' },
  { value: 1, label: '1 decimal', example: '5.2%' },
  { value: 2, label: '2 decimals', example: '5.25%' },
  { value: 3, label: '3 decimals', example: '5.250%' },
  { value: 4, label: '4 decimals', example: '5.2500%' },
];

export default function ModelingSettings() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<ModelingRegion | null>(null);
  const [deletingRegion, setDeletingRegion] = useState<ModelingRegion | null>(null);
  const [formData, setFormData] = useState({ name: '', isActive: true });

  const { data: regions = [], isLoading } = useQuery<ModelingRegion[]>({
    queryKey: ['/api/modeling/regions'],
  });

  const { data: displayPrefs } = useQuery<DisplayPreferences>({
    queryKey: ['/api/modeling/display-preferences'],
  });

  const updatePrefsMutation = useMutation({
    mutationFn: async (updates: Partial<DisplayPreferences>) => {
      return apiRequest('PATCH', '/api/modeling/display-preferences', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/display-preferences'] });
      toast({ title: 'Success', description: 'Display preferences updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update preferences', variant: 'destructive' });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; isActive: boolean; sortOrder: number }) => {
      return apiRequest('POST', '/api/modeling/regions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/regions'] });
      toast({ title: 'Success', description: 'Region created successfully' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create region', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; isActive?: boolean; sortOrder?: number } }) => {
      return apiRequest('PATCH', `/api/modeling/regions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/regions'] });
      toast({ title: 'Success', description: 'Region updated successfully' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update region', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/modeling/regions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/regions'] });
      toast({ title: 'Success', description: 'Region deleted successfully' });
      setIsDeleteDialogOpen(false);
      setDeletingRegion(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete region', variant: 'destructive' });
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      const sortedDefaults = [...DEFAULT_REGIONS].sort();
      const promises = sortedDefaults.map((name, index) =>
        apiRequest('POST', '/api/modeling/regions', {
          name,
          isActive: true,
          sortOrder: index,
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/regions'] });
      toast({ title: 'Success', description: 'Default regions added successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add default regions', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', isActive: true });
    setEditingRegion(null);
  };

  const handleOpenDialog = (region?: ModelingRegion) => {
    if (region) {
      setEditingRegion(region);
      setFormData({ name: region.name, isActive: region.isActive });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Region name is required', variant: 'destructive' });
      return;
    }

    if (editingRegion) {
      updateMutation.mutate({
        id: editingRegion.id,
        data: { name: formData.name, isActive: formData.isActive },
      });
    } else {
      const maxSortOrder = regions.length > 0 
        ? Math.max(...regions.map(r => r.sortOrder)) + 1 
        : 0;
      createMutation.mutate({
        name: formData.name,
        isActive: formData.isActive,
        sortOrder: maxSortOrder,
      });
    }
  };

  const handleDelete = (region: ModelingRegion) => {
    setDeletingRegion(region);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingRegion) {
      deleteMutation.mutate(deletingRegion.id);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = regions.findIndex(r => r.id === active.id);
      const newIndex = regions.findIndex(r => r.id === over.id);
      
      const reordered = [...regions];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);
      
      reordered.forEach((region, index) => {
        if (region.sortOrder !== index) {
          updateMutation.mutate({
            id: region.id,
            data: { sortOrder: index },
          });
        }
      });
    }
  };

  const sortedRegions = [...regions].sort((a, b) => a.sortOrder - b.sortOrder);
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">Model Settings</h1>
          <p className="text-muted-foreground">Configure regions and preferences for modeling projects</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/modeling/pnl/keyword-bank" data-testid="link-keyword-bank">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors" data-testid="card-keyword-bank">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BookText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">P&L Keyword Bank</CardTitle>
                    <CardDescription>
                      Manage keyword rules for automatic P&L classification
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Display Rounding</CardTitle>
              <CardDescription>
                Control how values are rounded throughout the financial models
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Label className="min-w-[160px] font-medium">Purchase Price</Label>
                <Select
                  value={String(displayPrefs?.priceRoundingDigits ?? 0)}
                  onValueChange={(val) => updatePrefsMutation.mutate({ priceRoundingDigits: Number(val) })}
                >
                  <SelectTrigger className="w-[220px]" data-testid="select-rounding-price">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUNDING_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updatePrefsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 ml-[176px]">
                Preview: {ROUNDING_OPTIONS.find(o => o.value === (displayPrefs?.priceRoundingDigits ?? 0))?.example || '$3,287,567'}
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-4">
                <Label className="min-w-[160px] font-medium">EBITDA / NOI</Label>
                <Select
                  value={String(displayPrefs?.ebitdaRoundingDigits ?? 0)}
                  onValueChange={(val) => updatePrefsMutation.mutate({ ebitdaRoundingDigits: Number(val) })}
                >
                  <SelectTrigger className="w-[220px]" data-testid="select-rounding-ebitda">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EBITDA_ROUNDING_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updatePrefsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 ml-[176px]">
                Preview: {EBITDA_ROUNDING_OPTIONS.find(o => o.value === (displayPrefs?.ebitdaRoundingDigits ?? 0))?.example || '$1,287,567'}
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-4">
                <Label className="min-w-[160px] font-medium">Line Item Values</Label>
                <Select
                  value={String(displayPrefs?.lineItemRoundingDigits ?? 0)}
                  onValueChange={(val) => updatePrefsMutation.mutate({ lineItemRoundingDigits: Number(val) })}
                >
                  <SelectTrigger className="w-[220px]" data-testid="select-rounding-lineitem">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_ITEM_ROUNDING_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updatePrefsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 ml-[176px]">
                Preview: {LINE_ITEM_ROUNDING_OPTIONS.find(o => o.value === (displayPrefs?.lineItemRoundingDigits ?? 0))?.example || '$47,823'}
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-4">
                <Label className="min-w-[160px] font-medium">Percentages</Label>
                <Select
                  value={String(displayPrefs?.percentRoundingDecimals ?? 1)}
                  onValueChange={(val) => updatePrefsMutation.mutate({ percentRoundingDecimals: Number(val) })}
                >
                  <SelectTrigger className="w-[220px]" data-testid="select-rounding-percent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERCENT_ROUNDING_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {updatePrefsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 ml-[176px]">
                Preview: {PERCENT_ROUNDING_OPTIONS.find(o => o.value === (displayPrefs?.percentRoundingDecimals ?? 1))?.example || '5.2%'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Bottom Line Metric</CardTitle>
              <CardDescription>
                Choose whether to display NOI or EBITDA throughout your financial models
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Label className="min-w-[120px]">Metric</Label>
              <Select
                value={displayPrefs?.bottomLineMetric ?? 'noi'}
                onValueChange={(val) => updatePrefsMutation.mutate({ bottomLineMetric: val as 'noi' | 'ebitda' })}
              >
                <SelectTrigger className="w-[280px]" data-testid="select-bottom-line-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="noi">NOI (Net Operating Income)</SelectItem>
                  <SelectItem value="ebitda">EBITDA</SelectItem>
                </SelectContent>
              </Select>
              {updatePrefsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              This selection flows through the Projects list, Historical P&L, Pro Forma, and Exit calculations
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Year 1 Definition</CardTitle>
              <CardDescription>
                Control how Year 1 is defined when a T12 (Trailing 12 Months) is the most recent data source
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Label className="min-w-[120px]">Year 1 Mode</Label>
              <Select
                value={displayPrefs?.year1Mode ?? 'calendar_year_end'}
                onValueChange={(val) => updatePrefsMutation.mutate({ year1Mode: val as 'calendar_year_end' | 'next_12_months' })}
              >
                <SelectTrigger className="w-[280px]" data-testid="select-year1-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar_year_end">Calendar Year-End</SelectItem>
                  <SelectItem value="next_12_months">Next 12 Months (Rolling)</SelectItem>
                </SelectContent>
              </Select>
              {updatePrefsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2 space-y-2">
              {(displayPrefs?.year1Mode ?? 'calendar_year_end') === 'calendar_year_end' ? (
                <>
                  <p><span className="font-medium">Calendar Year-End:</span> Year 1 aligns to the calendar year. Months covered by T12 data within that year are shown as <span className="text-green-600 dark:text-green-400 font-medium">Actual</span>, and remaining months are <span className="text-blue-600 dark:text-blue-400 font-medium">Forecast</span>.</p>
                  <p className="text-xs">Example: T12 Aug 2025–Jul 2026 → Year 1 = Jan–Dec 2026. Jan–Jul = Actual, Aug–Dec = Forecast.</p>
                </>
              ) : (
                <>
                  <p><span className="font-medium">Next 12 Months:</span> Year 1 starts the month after the T12 ends, running a full 12-month rolling period. All subsequent years follow the same rolling pattern.</p>
                  <p className="text-xs">Example: T12 Aug 2025–Jul 2026 → Year 1 = Aug 2026–Jul 2027. Year 2 = Aug 2027–Jul 2028.</p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Regions</CardTitle>
              <CardDescription>
                Define geographic regions for categorizing modeling projects. Drag to reorder.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {regions.length === 0 && (
                <Button
                  variant="outline"
                  onClick={() => seedDefaultsMutation.mutate()}
                  disabled={seedDefaultsMutation.isPending}
                  data-testid="button-seed-defaults"
                >
                  {seedDefaultsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Default Regions
                </Button>
              )}
              <Button onClick={() => handleOpenDialog()} data-testid="button-add-region">
                <Plus className="mr-2 h-4 w-4" />
                Add Region
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedRegions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No regions configured yet.</p>
              <p className="text-sm mt-1">Click "Add Default Regions" to get started with standard regions.</p>
            </div>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedRegions.map(r => r.id)} strategy={verticalListSortingStrategy}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRegions.map((region) => (
                      <SortableRow
                        key={region.id}
                        region={region}
                        onEdit={handleOpenDialog}
                        onDelete={handleDelete}
                      />
                    ))}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Financial Model & Operations Code</CardTitle>
          <CardDescription>
            Download a ZIP archive containing all Financial Model workspace files, Operations modules,
            Pro Forma engine, Document Intelligence pipeline, and a comprehensive guide on
            how everything connects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                const link = document.createElement('a');
                link.href = '/api/valuator-export/download';
                link.download = 'valuator-operations-export.zip';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download ZIP Archive
            </Button>
            <span className="text-sm text-muted-foreground">
              Includes 200+ files with GUIDE.md documentation
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRegion ? 'Edit Region' : 'Add Region'}</DialogTitle>
            <DialogDescription>
              {editingRegion ? 'Update the region details' : 'Create a new region for modeling projects'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="region-name">Region Name</Label>
              <Input
                id="region-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Southeast"
                data-testid="input-region-name"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="region-active">Active</Label>
              <Switch
                id="region-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                data-testid="switch-region-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-region">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-region">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRegion ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Region</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingRegion?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
