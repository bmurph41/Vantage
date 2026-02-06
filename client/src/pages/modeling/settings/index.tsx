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
import { Plus, Pencil, Trash2, GripVertical, Loader2, Settings, BookText, ChevronRight, Download } from 'lucide-react';
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
          <h1 className="text-2xl font-bold" data-testid="text-settings-title">Modeling Settings</h1>
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
          <CardTitle>Export Valuator & Operations Code</CardTitle>
          <CardDescription>
            Download a ZIP archive containing all Valuator workspace files, Operations modules,
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
