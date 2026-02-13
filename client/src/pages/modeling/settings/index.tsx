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
      <TableCell className="w-8 py-1.5 pr-0">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none p-0.5 hover:bg-muted rounded"
          data-testid={`drag-handle-${region.id}`}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell className="font-medium py-1.5 text-sm" data-testid={`region-name-${region.id}`}>
        {region.name}
      </TableCell>
      <TableCell className="py-1.5">
        <span
          className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${
            region.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
          }`}
          data-testid={`region-status-${region.id}`}
        >
          {region.isActive ? 'Active' : 'Inactive'}
        </span>
      </TableCell>
      <TableCell className="text-right py-1.5">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(region)}
            data-testid={`button-edit-region-${region.id}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDelete(region)}
            data-testid={`button-delete-region-${region.id}`}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
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

function RoundingRow({ label, value, options, onUpdate, isPending, testId }: {
  label: string;
  value: number;
  options: { value: number; label: string; example: string }[];
  onUpdate: (val: number) => void;
  isPending: boolean;
  testId: string;
}) {
  const preview = options.find(o => o.value === value)?.example;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Label className="min-w-[120px] text-sm">{label}</Label>
      <Select
        value={String(value)}
        onValueChange={(val) => onUpdate(Number(val))}
      >
        <SelectTrigger className="w-[180px] h-8 text-sm" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground tabular-nums">{preview}</span>
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}

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
    <div className="container mx-auto py-4 max-w-4xl space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold leading-tight" data-testid="text-settings-title">Model Settings</h1>
          <p className="text-sm text-muted-foreground">Configure regions and preferences for modeling projects</p>
        </div>
      </div>

      <Link href="/modeling/pnl/keyword-bank" data-testid="link-keyword-bank">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" data-testid="card-keyword-bank">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 rounded-md">
                <BookText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">P&L Keyword Bank</p>
                <p className="text-xs text-muted-foreground">Manage keyword rules for automatic P&L classification</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Card>
      </Link>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Display Rounding</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="divide-y">
              <RoundingRow
                label="Purchase Price"
                value={displayPrefs?.priceRoundingDigits ?? 0}
                options={ROUNDING_OPTIONS}
                onUpdate={(val) => updatePrefsMutation.mutate({ priceRoundingDigits: val })}
                isPending={updatePrefsMutation.isPending}
                testId="select-rounding-price"
              />
              <RoundingRow
                label="EBITDA / NOI"
                value={displayPrefs?.ebitdaRoundingDigits ?? 0}
                options={EBITDA_ROUNDING_OPTIONS}
                onUpdate={(val) => updatePrefsMutation.mutate({ ebitdaRoundingDigits: val })}
                isPending={updatePrefsMutation.isPending}
                testId="select-rounding-ebitda"
              />
              <RoundingRow
                label="Line Items"
                value={displayPrefs?.lineItemRoundingDigits ?? 0}
                options={LINE_ITEM_ROUNDING_OPTIONS}
                onUpdate={(val) => updatePrefsMutation.mutate({ lineItemRoundingDigits: val })}
                isPending={updatePrefsMutation.isPending}
                testId="select-rounding-lineitem"
              />
              <RoundingRow
                label="Percentages"
                value={displayPrefs?.percentRoundingDecimals ?? 1}
                options={PERCENT_ROUNDING_OPTIONS}
                onUpdate={(val) => updatePrefsMutation.mutate({ percentRoundingDecimals: val })}
                isPending={updatePrefsMutation.isPending}
                testId="select-rounding-percent"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Bottom Line Metric</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="flex items-center gap-3 py-1">
                <Label className="min-w-[60px] text-sm">Metric</Label>
                <Select
                  value={displayPrefs?.bottomLineMetric ?? 'noi'}
                  onValueChange={(val) => updatePrefsMutation.mutate({ bottomLineMetric: val as 'noi' | 'ebitda' })}
                >
                  <SelectTrigger className="w-full h-8 text-sm" data-testid="select-bottom-line-metric">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="noi">NOI (Net Operating Income)</SelectItem>
                    <SelectItem value="ebitda">EBITDA</SelectItem>
                  </SelectContent>
                </Select>
                {updatePrefsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                Flows through Projects list, Historical P&L, Pro Forma, and Exit calculations.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Year 1 Definition</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="flex items-center gap-3 py-1">
                <Label className="min-w-[60px] text-sm">Mode</Label>
                <Select
                  value={displayPrefs?.year1Mode ?? 'calendar_year_end'}
                  onValueChange={(val) => updatePrefsMutation.mutate({ year1Mode: val as 'calendar_year_end' | 'next_12_months' })}
                >
                  <SelectTrigger className="w-full h-8 text-sm" data-testid="select-year1-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar_year_end">Calendar Year-End</SelectItem>
                    <SelectItem value="next_12_months">Next 12 Months (Rolling)</SelectItem>
                  </SelectContent>
                </Select>
                {updatePrefsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                {(displayPrefs?.year1Mode ?? 'calendar_year_end') === 'calendar_year_end' ? (
                  <p>T12 months within the calendar year show as <span className="text-green-600 dark:text-green-400 font-medium">Actual</span>, remaining as <span className="text-blue-600 dark:text-blue-400 font-medium">Forecast</span>.</p>
                ) : (
                  <p>Year 1 starts the month after T12 ends, rolling forward 12 months each year.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Regions</CardTitle>
            <div className="flex gap-1.5">
              {regions.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => seedDefaultsMutation.mutate()}
                  disabled={seedDefaultsMutation.isPending}
                  data-testid="button-seed-defaults"
                >
                  {seedDefaultsMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Add Defaults
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs" onClick={() => handleOpenDialog()} data-testid="button-add-region">
                <Plus className="mr-1 h-3 w-3" />
                Add Region
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs mt-0.5">
            Geographic regions for categorizing modeling projects. Drag to reorder.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sortedRegions.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <p>No regions configured yet.</p>
              <p className="text-xs mt-0.5">Click "Add Defaults" to get started.</p>
            </div>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortedRegions.map(r => r.id)} strategy={verticalListSortingStrategy}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 py-1.5"></TableHead>
                      <TableHead className="py-1.5 text-xs">Name</TableHead>
                      <TableHead className="py-1.5 text-xs">Status</TableHead>
                      <TableHead className="text-right py-1.5 text-xs">Actions</TableHead>
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
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Export Financial Model & Operations Code</p>
            <p className="text-xs text-muted-foreground">Download ZIP with all workspace files, Pro Forma engine, and GUIDE.md</p>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const link = document.createElement('a');
              link.href = '/api/valuator-export/download';
              link.download = 'valuator-operations-export.zip';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            <Download className="mr-1 h-3 w-3" />
            Download ZIP
          </Button>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base">{editingRegion ? 'Edit Region' : 'Add Region'}</DialogTitle>
            <DialogDescription className="text-xs">
              {editingRegion ? 'Update the region details' : 'Create a new region for modeling projects'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="region-name" className="text-sm">Region Name</Label>
              <Input
                id="region-name"
                className="h-8"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Southeast"
                data-testid="input-region-name"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="region-active" className="text-sm">Active</Label>
              <Switch
                id="region-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                data-testid="switch-region-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel-region">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isPending} data-testid="button-save-region">
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {editingRegion ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete Region</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
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
              {deleteMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
