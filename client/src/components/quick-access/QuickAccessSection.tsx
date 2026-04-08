// @refresh reset
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pin,
  Clock,
  Star,
  ExternalLink,
  MoreVertical,
  Trash2,
  GripVertical,
  Building2,
  DollarSign,
  FileText,
  Users,
  TrendingUp,
  BarChart3,
  Fuel,
  ShoppingCart,
  Newspaper,
  FolderOpen,
  MapPin,
  AlertCircle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { BrowseToolsModal } from './BrowseToolsModal';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { UserPinnedItem, UserRecentItem, UserFavorite } from '@shared/schema';

interface ValidatedPinnedItem extends UserPinnedItem {
  isValid?: boolean;
  liveData?: {
    title: string;
    subtitle?: string;
    metadata?: Record<string, any>;
  };
}
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  DollarSign,
  FileText,
  Users,
  TrendingUp,
  BarChart3,
  Fuel,
  ShoppingCart,
  Newspaper,
  FolderOpen,
  MapPin,
  Pin,
  Star,
  Clock,
};

const itemTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  modeling_project: TrendingUp,
  deal: DollarSign,
  sales_comp: Building2,
  contact: Users,
  company: Building2,
  property: MapPin,
  report: FileText,
  page: FolderOpen,
};

function getIcon(iconName?: string | null, itemType?: string) {
  if (iconName && iconMap[iconName]) {
    return iconMap[iconName];
  }
  if (itemType && itemTypeIcons[itemType]) {
    return itemTypeIcons[itemType];
  }
  return FileText;
}

function SortablePinnedItem({ 
  item, 
  onRemove 
}: { 
  item: ValidatedPinnedItem; 
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getIcon(item.icon, item.itemType);
  const isStale = item.isValid === false;
  const displayTitle = item.liveData?.title || item.title;
  const displaySubtitle = item.liveData?.subtitle || item.description;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors group relative',
        isDragging && 'shadow-lg',
        isStale && 'opacity-60 border-destructive/50'
      )}
    >
      {!isStale && (
        <Link href={item.link} className="absolute inset-0 z-0" data-testid={`link-pinned-${item.id}`} />
      )}
      <div {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div 
        className="h-8 w-8 rounded-md flex items-center justify-center relative z-10 pointer-events-none"
        style={{ backgroundColor: item.color ? `${item.color}20` : 'hsl(var(--muted))' }}
      >
        <Icon className="h-4 w-4" style={{ color: item.color || 'hsl(var(--muted-foreground))' }} />
        {isStale && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute -top-1 -right-1 pointer-events-auto">
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>This item no longer exists</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex-1 min-w-0 z-10 pointer-events-none">
        <span className={cn(
          "font-medium text-sm truncate block",
          isStale && "line-through text-muted-foreground"
        )}>
          {displayTitle}
        </span>
        {displaySubtitle && (
          <p className="text-xs text-muted-foreground truncate">{displaySubtitle}</p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isStale && (
            <DropdownMenuItem asChild>
              <Link href={item.link}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem 
            onClick={() => onRemove(item.id)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function RecentItemRow({ item }: { item: UserRecentItem }) {
  const Icon = getIcon(item.icon, item.itemType);
  const timeAgo = item.accessedAt ? formatDistanceToNow(new Date(item.accessedAt), { addSuffix: true }) : '';

  return (
    <Link href={item.link}>
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer" data-testid={`link-recent-${item.id}`}>
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        <Badge variant="outline" className="text-xs capitalize">
          {item.itemType.replace('_', ' ')}
        </Badge>
      </div>
    </Link>
  );
}

function FavoriteItemRow({ 
  item, 
  onRemove 
}: { 
  item: UserFavorite; 
  onRemove: (id: string) => void;
}) {
  const Icon = getIcon(item.icon, item.itemType);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group relative">
      <Link href={item.link} className="absolute inset-0 z-0" data-testid={`link-favorite-${item.id}`} />
      <div className="h-8 w-8 rounded-md bg-yellow-500/10 flex items-center justify-center z-10 pointer-events-none">
        <Icon className="h-4 w-4 text-yellow-600" />
      </div>
      <div className="flex-1 min-w-0 z-10 pointer-events-none">
        <span className="font-medium text-sm truncate block">
          {item.title}
        </span>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}
      </div>
      <Badge variant="outline" className="text-xs capitalize z-10 pointer-events-none">
        {item.itemType.replace('_', ' ')}
      </Badge>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-yellow-500 hover:text-yellow-600 z-10"
        onClick={() => onRemove(item.id)}
      >
        <Star className="h-4 w-4 fill-current" />
      </Button>
    </div>
  );
}

export function QuickAccessSection() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pinned');
  const [isValidating, setIsValidating] = useState(false);
  const [isBrowseToolsOpen, setIsBrowseToolsOpen] = useState(false);
  
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const sensors = useSensors(pointerSensor);

  const { data: _pinnedItems, isLoading: pinnedLoading, refetch: refetchPinned } = useQuery<ValidatedPinnedItem[]>({
    queryKey: ['/api/quick-access/pinned'],
  });
  const pinnedItems: ValidatedPinnedItem[] = _pinnedItems ?? [];

  const { data: _validatedPinnedItems, refetch: refetchValidated } = useQuery<ValidatedPinnedItem[]>({
    queryKey: ['/api/quick-access/pinned', 'validated'],
    queryFn: async () => {
      const response = await fetch('/api/quick-access/pinned?validate=true');
      if (!response.ok) throw new Error('Failed to validate pinned items');
      return response.json();
    },
    enabled: false,
  });
  const validatedPinnedItems: ValidatedPinnedItem[] = _validatedPinnedItems ?? [];

  const { data: _recentItems, isLoading: recentLoading } = useQuery<UserRecentItem[]>({
    queryKey: ['/api/quick-access/recent'],
  });
  const recentItems: UserRecentItem[] = _recentItems ?? [];

  const { data: _favorites, isLoading: favoritesLoading } = useQuery<UserFavorite[]>({
    queryKey: ['/api/quick-access/favorites'],
  });
  const favorites: UserFavorite[] = _favorites ?? [];

  const displayPinnedItems = (validatedPinnedItems ?? []).length > 0 ? (validatedPinnedItems ?? []) : (pinnedItems ?? []);
  const staleItems = (displayPinnedItems ?? []).filter(item => item.isValid === false);

  const removePinMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/quick-access/pinned/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/pinned'] });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/quick-access/favorites/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/favorites'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (itemIds: string[]) => apiRequest('PUT', '/api/quick-access/pinned/reorder', { itemIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/pinned'] });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: (staleItemIds: string[]) => apiRequest('POST', '/api/quick-access/pinned/cleanup', { staleItemIds }),
    onSuccess: (data: { deleted: number }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/pinned'] });
      toast({ 
        title: 'Cleanup Complete', 
        description: `Removed ${data.deleted} stale item${data.deleted === 1 ? '' : 's'}.` 
      });
    },
  });

  const clearRecentMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', '/api/quick-access/recent'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/recent'] });
      toast({ title: 'Cleared', description: 'Recent items have been cleared.' });
    },
  });

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      await refetchValidated();
    } finally {
      setIsValidating(false);
    }
  };

  const handleCleanup = () => {
    const staleIds = staleItems.map(item => item.id);
    if (staleIds.length > 0) {
      cleanupMutation.mutate(staleIds);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = displayPinnedItems.findIndex(item => item.id === active.id);
    const newIndex = displayPinnedItems.findIndex(item => item.id === over.id);

    const newOrder = [...displayPinnedItems];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);

    reorderMutation.mutate(newOrder.map(item => item.id));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Pin className="h-5 w-5 text-primary" />
              Quick Access
            </CardTitle>
            <CardDescription>
              Your pinned items, recent activity, and favorites
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBrowseToolsOpen(true)}
                    className="h-8 gap-1.5"
                    data-testid="button-browse-tools"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Tools</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Browse and pin tools & reports</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {staleItems.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCleanup}
                      disabled={cleanupMutation.isPending}
                      className="h-8 px-2 text-destructive hover:text-destructive"
                      data-testid="button-cleanup-stale"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {staleItems.length}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove {staleItems.length} stale item{staleItems.length === 1 ? '' : 's'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleValidate}
                    disabled={isValidating}
                    className="h-8 w-8 p-0"
                    data-testid="button-validate-items"
                  >
                    <RefreshCw className={cn("h-4 w-4", isValidating && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Check for stale items</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="pinned" className="flex-1 gap-2" data-testid="tab-pinned">
              <Pin className="h-4 w-4" />
              Pinned
              {displayPinnedItems.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {displayPinnedItems.length}
                </Badge>
              )}
              {staleItems.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {staleItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex-1 gap-2" data-testid="tab-recent">
              <Clock className="h-4 w-4" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1 gap-2" data-testid="tab-favorites">
              <Star className="h-4 w-4" />
              Favorites
              {favorites.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {favorites.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pinned" className="mt-0">
            {pinnedLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : displayPinnedItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Pin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pinned items yet</p>
                <p className="text-xs mt-1">Pin reports or tools for quick access</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={displayPinnedItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {displayPinnedItems.map(item => (
                        <SortablePinnedItem 
                          key={item.id} 
                          item={item} 
                          onRemove={(id) => removePinMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent value="recent" className="mt-0">
            {recentLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : recentItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No recent items</p>
                <p className="text-xs mt-1">Your recently viewed items will appear here</p>
              </div>
            ) : (
              <>
                <ScrollArea className="max-h-[280px]">
                  <div className="space-y-1">
                    {recentItems.map(item => (
                      <RecentItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex justify-end mt-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => clearRecentMutation.mutate()}
                    disabled={clearRecentMutation.isPending}
                    className="text-xs"
                    data-testid="button-clear-recent"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear History
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="favorites" className="mt-0">
            {favoritesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No favorites yet</p>
                <p className="text-xs mt-1">Star items to add them here</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1">
                  {favorites.map(item => (
                    <FavoriteItemRow 
                      key={item.id} 
                      item={item} 
                      onRemove={(id) => removeFavoriteMutation.mutate(id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <BrowseToolsModal
        open={isBrowseToolsOpen}
        onOpenChange={setIsBrowseToolsOpen}
      />
    </Card>
  );
}
