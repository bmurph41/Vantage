import { useState } from 'react';
import { useCrmLists, useCrmListMembers, LIST_COLORS } from '@/hooks/useCrmLists';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Edit2,
  Loader2,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
  Users,
  Building2,
  MapPin,
  X,
} from 'lucide-react';

interface CrmListsManagerProps {
  entityType: 'contact' | 'company' | 'property';
  onListSelect?: (listId: string) => void;
  selectedListId?: string;
  compact?: boolean;
}

export function CrmListsManager({
  entityType,
  onListSelect,
  selectedListId,
  compact = false,
}: CrmListsManagerProps) {
  const { lists, isLoading, createList, updateList, deleteList, isPending } = useCrmLists(entityType);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'blue',
  });

  const entityLabels = {
    contact: { singular: 'Contact', plural: 'Contacts', icon: Users },
    company: { singular: 'Company', plural: 'Companies', icon: Building2 },
    property: { singular: 'Property', plural: 'Properties', icon: MapPin },
  };

  const { plural: entityPlural, icon: EntityIcon } = entityLabels[entityType];

  const resetForm = () => {
    setFormData({ name: '', description: '', color: 'blue' });
    setEditingList(null);
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    await createList({
      name: formData.name,
      description: formData.description || undefined,
      entityType,
      color: formData.color,
    });
    resetForm();
    setShowCreateDialog(false);
  };

  const handleEdit = async () => {
    if (!editingList || !formData.name.trim()) return;
    await updateList({
      listId: editingList,
      data: {
        name: formData.name,
        description: formData.description || undefined,
        color: formData.color,
      },
    });
    resetForm();
    setShowCreateDialog(false);
  };

  const handleDelete = async (listId: string) => {
    if (confirm('Delete this list? Members will not be deleted, only removed from the list.')) {
      await deleteList(listId);
    }
  };

  const openEditDialog = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    setFormData({
      name: list.name,
      description: list.description || '',
      color: list.color || 'blue',
    });
    setEditingList(listId);
    setShowCreateDialog(true);
  };

  const getColorClass = (color: string | null) => {
    const found = LIST_COLORS.find(c => c.value === color);
    return found?.class || 'bg-blue-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Lists</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setShowCreateDialog(true)}
            data-testid="button-create-list-compact"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <ScrollArea className="h-32">
          <div className="space-y-1">
            {lists.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No lists created</div>
            ) : (
              lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => onListSelect?.(list.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded text-left text-sm hover:bg-muted ${
                    selectedListId === list.id ? 'bg-muted' : ''
                  }`}
                  data-testid={`button-list-${list.id}`}
                >
                  <div className={`w-2 h-2 rounded-full ${getColorClass(list.color)}`} />
                  <span className="truncate flex-1">{list.name}</span>
                  <Badge variant="outline" className="text-xs" data-testid={`badge-list-count-${list.id}`}>
                    0
                  </Badge>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        
        <ListDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          formData={formData}
          setFormData={setFormData}
          onSubmit={editingList ? handleEdit : handleCreate}
          onCancel={() => { resetForm(); setShowCreateDialog(false); }}
          isEditing={!!editingList}
          isPending={isPending}
          entityType={entityType}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              {entityPlural} Lists
            </CardTitle>
            <CardDescription>
              Organize your {entityPlural.toLowerCase()} into custom lists
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-list">
            <Plus className="h-4 w-4 mr-2" />
            Create List
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {lists.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <List className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No lists created yet.</p>
            <p className="text-sm">Create lists to organize your {entityPlural.toLowerCase()}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lists.map((list) => (
              <Card 
                key={list.id} 
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  selectedListId === list.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => onListSelect?.(list.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getColorClass(list.color)}`} />
                      <CardTitle className="text-base">{list.name}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-list-menu-${list.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); openEditDialog(list.id); }}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit List
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={(e) => { e.stopPropagation(); handleDelete(list.id); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete List
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  {list.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {list.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm" data-testid={`text-list-member-count-${list.id}`}>
                    <EntityIcon className="h-4 w-4 text-muted-foreground" />
                    <span>View members</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      
      <ListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        formData={formData}
        setFormData={setFormData}
        onSubmit={editingList ? handleEdit : handleCreate}
        onCancel={() => { resetForm(); setShowCreateDialog(false); }}
        isEditing={!!editingList}
        isPending={isPending}
        entityType={entityType}
      />
    </Card>
  );
}

interface ListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: { name: string; description: string; color: string };
  setFormData: (data: any) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEditing: boolean;
  isPending: boolean;
  entityType: 'contact' | 'company' | 'property';
}

function ListDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isEditing,
  isPending,
  entityType,
}: ListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            {isEditing ? 'Edit List' : 'Create List'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update list details.' 
              : `Create a new list to organize your ${entityType === 'property' ? 'properties' : entityType + 's'}.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="list-name">List Name</Label>
            <Input
              id="list-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Top Prospects, Priority Accounts"
              data-testid="input-list-name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="list-description">Description (optional)</Label>
            <Textarea
              id="list-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is this list for?"
              rows={2}
              data-testid="input-list-description"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {LIST_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`w-8 h-8 rounded-full ${color.class} ${
                    formData.color === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  title={color.label}
                  data-testid={`button-list-color-${color.value}`}
                />
              ))}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            onClick={onSubmit} 
            disabled={!formData.name.trim() || isPending}
            data-testid="button-save-list"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditing ? 'Update' : 'Create'} List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ListMembersPanelProps {
  listId: string;
  onClose: () => void;
}

export function ListMembersPanel({ listId, onClose }: ListMembersPanelProps) {
  const { list, members, isLoading, removeMember, isPending } = useCrmListMembers(listId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        List not found
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{list.name}</CardTitle>
            <CardDescription>{members.length} members</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No members in this list
          </div>
        ) : (
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted"
                >
                  <span className="text-sm">{member.entityId}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeMember(member.entityId)}
                    disabled={isPending}
                    data-testid={`button-remove-member-${member.entityId}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
