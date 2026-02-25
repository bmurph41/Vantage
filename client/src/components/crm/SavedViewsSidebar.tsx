import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Plus, Star, MoreHorizontal, Pencil, Trash2, Share2, Eye, Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SavedView {
  id: string;
  name: string;
  objectType: string;
  filters: Record<string, any>;
  columns: string[];
  sortBy: string | null;
  sortOrder: string;
  isDefault: boolean;
  isShared: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface SavedViewsSidebarProps {
  objectType: 'contact' | 'company' | 'property';
  activeViewId: string | null;
  onSelectView: (view: SavedView | null) => void;
  currentFilters: Record<string, any>;
}

const defaultViews: Record<string, Array<{ name: string; filters: Record<string, any> }>> = {
  contact: [
    { name: 'All Contacts', filters: {} },
    { name: 'Active Leads', filters: { contactTag: 'lead', leadStatus: 'qualified' } },
    { name: 'Brokers', filters: { contactTag: 'broker' } },
    { name: 'Recent (7 days)', filters: { dateRange: '7d' } },
  ],
  company: [
    { name: 'All Companies', filters: {} },
    { name: 'Marina Operators', filters: { industry: 'marina' } },
    { name: 'Recent (7 days)', filters: { dateRange: '7d' } },
  ],
  property: [
    { name: 'All Properties', filters: {} },
    { name: 'Available', filters: { status: 'available' } },
    { name: 'Under Contract', filters: { status: 'under_contract' } },
    { name: 'Properties', filters: { propertyType: 'marina' } },
  ],
};

export function SavedViewsSidebar({ objectType, activeViewId, onSelectView, currentFilters }: SavedViewsSidebarProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewShared, setNewViewShared] = useState(false);
  const [editingView, setEditingView] = useState<SavedView | null>(null);

  const { data: savedViews = [] } = useQuery<SavedView[]>({
    queryKey: ['/api/crm/saved-views', objectType],
    queryFn: async () => {
      const res = await fetch(`/api/crm/saved-views?objectType=${objectType}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; isShared: boolean }) => {
      const res = await apiRequest('POST', '/api/crm/saved-views', {
        name: data.name,
        objectType,
        filters: currentFilters,
        isShared: data.isShared,
      });
      return res.json();
    },
    onSuccess: (view) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/saved-views', objectType] });
      onSelectView(view);
      setShowCreateDialog(false);
      setNewViewName('');
      toast({ title: 'View saved' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/crm/saved-views/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/saved-views', objectType] });
      onSelectView(null);
      toast({ title: 'View deleted' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; filters?: Record<string, any>; isDefault?: boolean }) => {
      const res = await apiRequest('PATCH', `/api/crm/saved-views/${id}`, { ...data, objectType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/saved-views', objectType] });
      setEditingView(null);
      toast({ title: 'View updated' });
    },
  });

  const builtInViews = defaultViews[objectType] || [];

  return (
    <div className="w-56 border-r bg-white dark:bg-gray-900 flex flex-col h-full">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3 w-3" />
            Views
          </h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-2 py-1.5">
            Default
          </div>
          {builtInViews.map((view, idx) => (
            <button
              key={`default-${idx}`}
              onClick={() => onSelectView({ id: `default-${idx}`, name: view.name, objectType, filters: view.filters, columns: [], sortBy: null, sortOrder: 'asc', isDefault: false, isShared: false, userId: '', createdAt: '', updatedAt: '' })}
              className={cn(
                "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2",
                activeViewId === `default-${idx}`
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <Eye className="h-3 w-3 flex-shrink-0 opacity-50" />
              <span className="truncate">{view.name}</span>
            </button>
          ))}

          {savedViews.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-2 py-1.5">
                My Views
              </div>
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className={cn(
                    "flex items-center gap-1 rounded-md transition-colors group",
                    activeViewId === view.id
                      ? "bg-primary/10"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <button
                    onClick={() => onSelectView(view)}
                    className={cn(
                      "flex-1 text-left px-2.5 py-1.5 text-xs flex items-center gap-2 min-w-0",
                      activeViewId === view.id ? "text-primary font-medium" : "text-gray-700 dark:text-gray-300"
                    )}
                  >
                    {view.isDefault ? <Star className="h-3 w-3 flex-shrink-0 text-amber-500" /> : <Eye className="h-3 w-3 flex-shrink-0 opacity-50" />}
                    <span className="truncate">{view.name}</span>
                    {view.isShared && <Share2 className="h-2.5 w-2.5 flex-shrink-0 opacity-40" />}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 mr-1 flex-shrink-0">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => updateMutation.mutate({ id: view.id, filters: currentFilters })}>
                        <Filter className="h-3.5 w-3.5 mr-2" /> Update Filters
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateMutation.mutate({ id: view.id, isDefault: !view.isDefault })}>
                        <Star className="h-3.5 w-3.5 mr-2" /> {view.isDefault ? 'Unset Default' : 'Set Default'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingView(view)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(view.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base">Save Current View</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">View Name</Label>
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., Active Leads"
                className="h-8"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Share with team</Label>
              <Switch checked={newViewShared} onCheckedChange={setNewViewShared} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button size="sm" disabled={!newViewName.trim()} onClick={() => createMutation.mutate({ name: newViewName, isShared: newViewShared })}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingView} onOpenChange={(open) => !open && setEditingView(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="text-base">Rename View</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={editingView?.name || ''}
              onChange={(e) => editingView && setEditingView({ ...editingView, name: e.target.value })}
              className="h-8"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingView(null)}>Cancel</Button>
            <Button size="sm" disabled={!editingView?.name?.trim()} onClick={() => editingView && updateMutation.mutate({ id: editingView.id, name: editingView.name })}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
