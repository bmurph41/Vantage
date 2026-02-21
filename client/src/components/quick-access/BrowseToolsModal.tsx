import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Pin,
  PinOff,
  Search,
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  FileText,
  Fuel,
  ShoppingCart,
  MapPin,
  FolderOpen,
  Radio,
  Home,
  Database,
  Calendar,
  CheckSquare,
  Anchor,
  Rocket,
  PieChart,
  LineChart,
  Target,
  Briefcase,
  Ship,
  Compass,
  Settings,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { UserPinnedItem } from '@shared/schema';

interface ToolItem {
  id: string;
  title: string;
  description: string;
  link: string;
  icon: string;
  category: 'analytics' | 'crm' | 'operations' | 'finance' | 'tools' | 'reports';
  color: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  FileText,
  Fuel,
  ShoppingCart,
  MapPin,
  FolderOpen,
  Radio,
  Home,
  Database,
  Calendar,
  CheckSquare,
  Anchor,
  Rocket,
  PieChart,
  LineChart,
  Target,
  Briefcase,
  Ship,
  Compass,
  Settings,
  Activity,
  Pin,
};

const AVAILABLE_TOOLS: ToolItem[] = [
  {
    id: 'crm-dashboard',
    title: 'CRM Dashboard',
    description: 'Overview of deals, contacts, and pipeline health',
    link: '/crm',
    icon: 'Users',
    category: 'crm',
    color: '#3b82f6',
  },
  {
    id: 'crm-deals',
    title: 'Deal Pipeline',
    description: 'Manage active deals and track progress',
    link: '/crm/deals',
    icon: 'DollarSign',
    category: 'crm',
    color: '#10b981',
  },
  {
    id: 'crm-contacts',
    title: 'Contacts',
    description: 'Manage contacts and relationships',
    link: '/crm/contacts',
    icon: 'Users',
    category: 'crm',
    color: '#6366f1',
  },
  {
    id: 'crm-companies',
    title: 'Companies',
    description: 'Company profiles and account management',
    link: '/crm/companies',
    icon: 'Building2',
    category: 'crm',
    color: '#8b5cf6',
  },
  {
    id: 'crm-properties',
    title: 'Properties',
    description: 'Marina property database',
    link: '/crm/properties',
    icon: 'MapPin',
    category: 'crm',
    color: '#f59e0b',
  },
  {
    id: 'crm-analytics',
    title: 'CRM Analytics',
    description: 'Deal analytics and performance metrics',
    link: '/crm/analytics',
    icon: 'BarChart3',
    category: 'analytics',
    color: '#ec4899',
  },
  {
    id: 'sales-comps',
    title: 'Sales Comps',
    description: 'Marina sales comparables database',
    link: '/analysis/sales-comps',
    icon: 'Building2',
    category: 'analytics',
    color: '#14b8a6',
  },
  {
    id: 'sales-comps-analytics',
    title: 'Comps Analytics',
    description: 'Sales comparables analytics and trends',
    link: '/analysis/sales-comps/analytics',
    icon: 'PieChart',
    category: 'analytics',
    color: '#f97316',
  },
  {
    id: 'modeling-projects',
    title: 'Modeling Projects',
    description: 'Marina valuation and financial models',
    link: '/modeling',
    icon: 'TrendingUp',
    category: 'finance',
    color: '#0ea5e9',
  },
  {
    id: 'portfolio-rollups',
    title: 'Portfolio Roll-ups',
    description: 'Aggregate portfolio performance',
    link: '/modeling/portfolio',
    icon: 'Briefcase',
    category: 'finance',
    color: '#7c3aed',
  },
  {
    id: 'due-diligence',
    title: 'Due Diligence',
    description: 'Project tracking and task management',
    link: '/projects',
    icon: 'CheckSquare',
    category: 'tools',
    color: '#22c55e',
  },
  {
    id: 'rent-roll',
    title: 'Rent Roll',
    description: 'Marina unit occupancy and income',
    link: '/rent-roll',
    icon: 'Home',
    category: 'operations',
    color: '#ef4444',
  },
  {
    id: 'customer-analytics',
    title: 'Customer Analytics',
    description: 'Customer metrics and retention analysis',
    link: '/rent-roll/customers',
    icon: 'Activity',
    category: 'analytics',
    color: '#a855f7',
  },
  {
    id: 'fuel-operations',
    title: 'Fuel Operations',
    description: 'Fuel sales and inventory management',
    link: '/fuel',
    icon: 'Fuel',
    category: 'operations',
    color: '#f59e0b',
  },
  {
    id: 'fuel-analytics',
    title: 'Fuel Analytics',
    description: 'Fuel sales analytics and trends',
    link: '/fuel/analytics',
    icon: 'LineChart',
    category: 'analytics',
    color: '#eab308',
  },
  {
    id: 'ship-store',
    title: 'Ship Store',
    description: 'POS and inventory management',
    link: '/ship-store',
    icon: 'ShoppingCart',
    category: 'operations',
    color: '#84cc16',
  },
  {
    id: 'ship-store-analytics',
    title: 'Store Analytics',
    description: 'Ship store performance metrics',
    link: '/ship-store/analytics',
    icon: 'BarChart3',
    category: 'analytics',
    color: '#65a30d',
  },
  {
    id: 'vdr',
    title: 'Virtual Data Room',
    description: 'Secure document management',
    link: '/vdr',
    icon: 'FolderOpen',
    category: 'tools',
    color: '#6366f1',
  },
  {
    id: 'docket',
    title: 'The Docket',
    description: 'Marina industry intelligence',
    link: '/docket',
    icon: 'Radio',
    category: 'tools',
    color: '#0891b2',
  },
  {
    id: 'launch-operations',
    title: 'Launch Operations',
    description: 'Boat launch and haul management',
    link: '/operations/dockit',
    icon: 'Anchor',
    category: 'operations',
    color: '#0d9488',
  },
  {
    id: 'market-demographics',
    title: 'Market Demographics',
    description: 'Regional market analysis',
    link: '/market-demographics',
    icon: 'Compass',
    category: 'analytics',
    color: '#8b5cf6',
  },
  {
    id: 'rate-comps',
    title: 'Rate Comps',
    description: 'Slip rate comparables',
    link: '/analysis/rate-comps',
    icon: 'Target',
    category: 'analytics',
    color: '#e11d48',
  },
];

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  all: { label: 'All Tools', description: 'Browse all available tools and reports' },
  analytics: { label: 'Analytics', description: 'Reports and data analysis tools' },
  crm: { label: 'CRM', description: 'Customer relationship management' },
  operations: { label: 'Operations', description: 'Day-to-day marina operations' },
  finance: { label: 'Finance', description: 'Financial modeling and analysis' },
  tools: { label: 'Tools', description: 'Productivity and management tools' },
};

interface BrowseToolsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrowseToolsModal({ open, onOpenChange }: BrowseToolsModalProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const { data: pinnedItems = [] } = useQuery<UserPinnedItem[]>({
    queryKey: ['/api/quick-access/pinned'],
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (tool: ToolItem) =>
      apiRequest('POST', '/api/quick-access/pinned', {
        itemType: 'page',
        itemId: tool.id,
        title: tool.title,
        description: tool.description,
        link: tool.link,
        icon: tool.icon,
        color: tool.color,
      }),
    onSuccess: (_, tool) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/pinned'] });
      toast({
        title: 'Pinned to dashboard',
        description: `${tool.title} has been added to your quick access.`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to pin item.',
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (pinId: string) =>
      apiRequest('DELETE', `/api/quick-access/pinned/${pinId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quick-access/pinned'] });
      toast({
        title: 'Unpinned',
        description: 'Item has been removed from quick access.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to unpin item.',
        variant: 'destructive',
      });
    },
  });

  const filteredTools = useMemo(() => {
    let tools = AVAILABLE_TOOLS;

    if (activeCategory !== 'all') {
      tools = tools.filter((t) => t.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }

    return tools;
  }, [activeCategory, searchQuery]);

  const isPinned = (toolId: string, link: string) => {
    return pinnedItems.some(
      (p) => (p.itemId === toolId || p.link === link) && p.itemType === 'page'
    );
  };

  const getPinId = (toolId: string, link: string) => {
    const pin = pinnedItems.find(
      (p) => (p.itemId === toolId || p.link === link) && p.itemType === 'page'
    );
    return pin?.id;
  };

  const handleTogglePin = (tool: ToolItem) => {
    const pinId = getPinId(tool.id, tool.link);
    if (pinId) {
      removeMutation.mutate(pinId);
    } else {
      addMutation.mutate(tool);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pin className="h-5 w-5 text-primary" />
            Pin Tools & Reports
          </DialogTitle>
          <DialogDescription>
            Browse and pin your frequently used reports and tools for quick access
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools and reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-tools"
              />
            </div>
          </div>

          <Tabs
            value={activeCategory}
            onValueChange={setActiveCategory}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 p-1">
              {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="text-xs px-3 py-1.5"
                  data-testid={`tab-category-${key}`}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeCategory} className="flex-1 mt-4 overflow-hidden">
              <ScrollArea className="h-[400px]">
                {filteredTools.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No tools found</p>
                    <p className="text-xs mt-1">Try adjusting your search or category</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-4">
                    {filteredTools.map((tool) => {
                      const Icon = iconMap[tool.icon] || FileText;
                      const pinned = isPinned(tool.id, tool.link);
                      const isPending =
                        addMutation.isPending || removeMutation.isPending;

                      return (
                        <div
                          key={tool.id}
                          className={cn(
                            'flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors group',
                            pinned && 'border-primary/50 bg-primary/5'
                          )}
                        >
                          <div
                            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${tool.color}20` }}
                          >
                            <Icon
                              className="h-5 w-5"
                              style={{ color: tool.color }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm truncate">
                                {tool.title}
                              </h4>
                              <Badge
                                variant="outline"
                                className="text-[10px] capitalize shrink-0"
                              >
                                {tool.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {tool.description}
                            </p>
                          </div>
                          <Button
                            variant={pinned ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleTogglePin(tool)}
                            disabled={isPending}
                            className={cn(
                              'shrink-0 h-8 w-8 p-0',
                              pinned && 'bg-primary text-primary-foreground'
                            )}
                            data-testid={`button-pin-tool-${tool.id}`}
                          >
                            {pinned ? (
                              <PinOff className="h-4 w-4" />
                            ) : (
                              <Pin className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {pinnedItems.filter((p) => p.itemType === 'page').length} tools
              pinned to your dashboard
            </p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
