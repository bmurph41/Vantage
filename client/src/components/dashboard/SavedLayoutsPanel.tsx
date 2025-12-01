import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Save, Download, Trash2, MoreVertical, ChevronDown, 
  Layout, Check, Star, StarOff, Clock 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SavedLayout {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  layoutData: {
    moduleOrder: string[];
    collapsedModules: string[];
    visibleModules: string[];
    customWidgets?: any[];
  };
  createdAt: string;
  updatedAt: string;
}

interface SavedLayoutsPanelProps {
  currentModuleOrder: string[];
  currentCollapsedModules: string[];
  currentVisibleModules: string[];
  onLoadLayout: (layout: SavedLayout['layoutData']) => void;
}

export function SavedLayoutsPanel({
  currentModuleOrder,
  currentCollapsedModules,
  currentVisibleModules,
  onLoadLayout,
}: SavedLayoutsPanelProps) {
  const { toast } = useToast();
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [layoutDescription, setLayoutDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const { data: savedLayouts, isLoading } = useQuery<SavedLayout[]>({
    queryKey: ['/api/dashboards/saved-layouts'],
  });

  const createLayoutMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; isDefault: boolean; layoutData: any }) => {
      return apiRequest('/api/dashboards/saved-layouts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/saved-layouts'] });
      toast({
        title: 'Layout Saved',
        description: 'Your dashboard layout has been saved.',
      });
      setIsSaveDialogOpen(false);
      setLayoutName('');
      setLayoutDescription('');
      setIsDefault(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save layout. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const updateLayoutMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/dashboards/saved-layouts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/saved-layouts'] });
      toast({
        title: 'Layout Updated',
        description: 'Your dashboard layout has been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update layout. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deleteLayoutMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/dashboards/saved-layouts/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards/saved-layouts'] });
      toast({
        title: 'Layout Deleted',
        description: 'The layout has been deleted.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete layout. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSaveLayout = () => {
    if (!layoutName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for your layout.',
        variant: 'destructive',
      });
      return;
    }

    createLayoutMutation.mutate({
      name: layoutName,
      description: layoutDescription || undefined,
      isDefault,
      layoutData: {
        moduleOrder: currentModuleOrder,
        collapsedModules: currentCollapsedModules,
        visibleModules: currentVisibleModules,
      },
    });
  };

  const handleLoadLayout = (layout: SavedLayout) => {
    onLoadLayout(layout.layoutData);
    toast({
      title: 'Layout Loaded',
      description: `"${layout.name}" has been applied to your dashboard.`,
    });
  };

  const handleSetDefault = (layout: SavedLayout) => {
    updateLayoutMutation.mutate({
      id: layout.id,
      data: { isDefault: true },
    });
  };

  const handleUpdateLayoutData = (layout: SavedLayout) => {
    updateLayoutMutation.mutate({
      id: layout.id,
      data: {
        layoutData: {
          moduleOrder: currentModuleOrder,
          collapsedModules: currentCollapsedModules,
          visibleModules: currentVisibleModules,
        },
      },
    });
  };

  const defaultLayout = savedLayouts?.find(l => l.isDefault);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-layouts">
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Layouts</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <div className="p-2">
            <p className="text-sm font-medium mb-2">Saved Layouts</p>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : savedLayouts && savedLayouts.length > 0 ? (
              <ScrollArea className="max-h-64">
                <div className="space-y-1">
                  {savedLayouts.map((layout) => (
                    <div
                      key={layout.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-gray-100 group"
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={() => handleLoadLayout(layout)}
                        data-testid={`load-layout-${layout.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{layout.name}</span>
                          {layout.isDefault && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {layout.description && (
                          <p className="text-xs text-gray-500 truncate max-w-40">
                            {layout.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(layout.updatedAt), { addSuffix: true })}
                        </p>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleLoadLayout(layout)}>
                            <Download className="h-4 w-4 mr-2" />
                            Load Layout
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateLayoutData(layout)}>
                            <Save className="h-4 w-4 mr-2" />
                            Update with Current
                          </DropdownMenuItem>
                          {!layout.isDefault && (
                            <DropdownMenuItem onClick={() => handleSetDefault(layout)}>
                              <Star className="h-4 w-4 mr-2" />
                              Set as Default
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteLayoutMutation.mutate(layout.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">
                No saved layouts yet
              </p>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsSaveDialogOpen(true)}>
            <Save className="h-4 w-4 mr-2" />
            Save Current Layout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Dashboard Layout</DialogTitle>
            <DialogDescription>
              Save your current dashboard configuration for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="layout-name">Layout Name</Label>
              <Input
                id="layout-name"
                placeholder="e.g., Investment Review, Weekly Analysis"
                value={layoutName}
                onChange={(e) => setLayoutName(e.target.value)}
                data-testid="input-layout-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="layout-description">Description (optional)</Label>
              <Input
                id="layout-description"
                placeholder="Describe this layout..."
                value={layoutDescription}
                onChange={(e) => setLayoutDescription(e.target.value)}
                data-testid="input-layout-description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md border text-sm",
                  isDefault ? "border-yellow-400 bg-yellow-50" : "border-gray-200"
                )}
                onClick={() => setIsDefault(!isDefault)}
                data-testid="toggle-default-layout"
              >
                {isDefault ? (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                ) : (
                  <StarOff className="h-4 w-4 text-gray-400" />
                )}
                Set as default layout
              </button>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
              <p className="font-medium">Current Layout Includes:</p>
              <ul className="list-disc list-inside text-gray-600 text-xs space-y-1">
                <li>{currentVisibleModules.length} visible modules</li>
                <li>{currentCollapsedModules.length} collapsed modules</li>
                <li>Custom module order</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveLayout}
              disabled={createLayoutMutation.isPending}
              data-testid="button-save-layout"
            >
              {createLayoutMutation.isPending ? 'Saving...' : 'Save Layout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SavedLayoutsPanel;
