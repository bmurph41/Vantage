import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useDealWorkspaces, useCreateWorkspace, useArchiveWorkspace } from '@/hooks/useDealWorkspaces';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Briefcase,
  Building2,
  Calculator,
  ClipboardList,
  FolderOpen,
  Calendar,
  TrendingUp,
  Archive,
  Edit,
  Users,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-blue-500' },
  pending: { label: 'Pending', color: 'bg-gray-500' },
  under_contract: { label: 'Under Contract', color: 'bg-amber-500' },
  due_diligence: { label: 'Due Diligence', color: 'bg-purple-500' },
  closing: { label: 'Closing', color: 'bg-indigo-500' },
  closed: { label: 'Closed', color: 'bg-green-500' },
  dead: { label: 'Dead', color: 'bg-red-500' },
  on_hold: { label: 'On Hold', color: 'bg-orange-500' },
};

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Briefcase }> = {
  buyer: { label: 'Buyer', icon: Briefcase },
  seller: { label: 'Seller', icon: Building2 },
  broker: { label: 'Broker', icon: Users },
  lender: { label: 'Lender', icon: DollarSign },
  consultant: { label: 'Consultant', icon: ClipboardList },
};

export default function WorkspacesListPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({
    name: '',
    description: '',
    role: 'buyer',
    status: 'active',
  });

  const { data: workspaces = [], isLoading } = useDealWorkspaces();
  const createMutation = useCreateWorkspace();
  const archiveMutation = useArchiveWorkspace();

  const filteredWorkspaces = workspaces.filter((ws) => {
    const matchesSearch = ws.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ws.status === statusFilter;
    const matchesRole = roleFilter === 'all' || ws.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const handleCreate = async () => {
    if (!newWorkspace.name.trim()) return;
    
    try {
      const result = await createMutation.mutateAsync(newWorkspace);
      setShowCreateDialog(false);
      setNewWorkspace({ name: '', description: '', role: 'buyer', status: 'active' });
      toast({ title: 'Workspace Created', description: 'Your new workspace is ready.' });
      navigate(`/workspaces/${result.id}`);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create workspace', variant: 'destructive' });
    }
  };

  const handleArchive = async (id: string, name: string) => {
    try {
      await archiveMutation.mutateAsync(id);
      toast({ title: 'Archived', description: `${name} has been archived.` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to archive workspace', variant: 'destructive' });
    }
  };

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Deal Workspaces</h1>
          <p className="text-muted-foreground">
            Unified view of your deals with modeling, due diligence, and documents
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-workspace">
              <Plus className="h-4 w-4 mr-2" />
              New Workspace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Deal Workspace</DialogTitle>
              <DialogDescription>
                Create a unified workspace to manage modeling, due diligence, and documents for a deal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                  placeholder="Marina Acquisition - Example Marina"
                  data-testid="input-workspace-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                  placeholder="Brief description of this deal..."
                  data-testid="input-workspace-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Your Role</Label>
                  <Select
                    value={newWorkspace.role}
                    onValueChange={(v) => setNewWorkspace({ ...newWorkspace, role: v })}
                  >
                    <SelectTrigger data-testid="select-workspace-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_CONFIG).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={newWorkspace.status}
                    onValueChange={(v) => setNewWorkspace({ ...newWorkspace, status: v })}
                  >
                    <SelectTrigger data-testid="select-workspace-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!newWorkspace.name.trim() || createMutation.isPending}
                data-testid="button-submit-workspace"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Workspace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-workspaces"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="filter-status">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40" data-testid="filter-role">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {Object.entries(ROLE_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No workspaces found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all' || roleFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first deal workspace to get started'}
            </p>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first">
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkspaces.map((workspace) => {
            const statusConfig = STATUS_CONFIG[workspace.status] || STATUS_CONFIG.active;
            const roleConfig = ROLE_CONFIG[workspace.role] || ROLE_CONFIG.buyer;
            const RoleIcon = roleConfig.icon;

            return (
              <Card 
                key={workspace.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                data-testid={`card-workspace-${workspace.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <Link href={`/workspaces/${workspace.id}`}>
                        <CardTitle className="text-lg truncate hover:text-blue-600">
                          {workspace.name}
                        </CardTitle>
                      </Link>
                      <CardDescription className="line-clamp-2">
                        {workspace.description || 'No description'}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/workspaces/${workspace.id}`)}>
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/workspaces/${workspace.id}/settings`)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleArchive(workspace.id, workspace.name)}
                          className="text-red-600"
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={`${statusConfig.color} text-white`}>
                      {statusConfig.label}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <RoleIcon className="h-3 w-3" />
                      {roleConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calculator className="h-4 w-4" />
                      <span>{workspace.modelingProjectId ? 'Model' : '-'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ClipboardList className="h-4 w-4" />
                      <span>{workspace.openDdTasks || 0}/{workspace.totalDdTasks || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FolderOpen className="h-4 w-4" />
                      <span>{workspace.pendingDocuments || 0} docs</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm">
                    {workspace.targetPrice ? (
                      <span className="font-medium text-green-600">
                        {formatCurrency(workspace.targetPrice)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No target price</span>
                    )}
                    {workspace.expectedCloseDate && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(workspace.expectedCloseDate), 'MM/dd/yyyy')}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
