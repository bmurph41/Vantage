import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Bookmark, Pin, Edit2, Trash2, MoreHorizontal, PlusCircle, Check } from "lucide-react";
import { savedSearchesApi } from '@/lib/ratecomps/api';
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FilterState } from '@/lib/ratecomps/types';
import type { RcSavedSearch, InsertRcSavedSearch, UpdateRcSavedSearch } from "@shared/schema";

interface SavedSearchesMenuProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  activeSavedSearchId: string | null;
  onActiveSavedSearchChange: (id: string | null, name: string | null) => void;
}

const COLOR_OPTIONS = [
  { value: "#EF4444", label: "Red" },
  { value: "#F59E0B", label: "Orange" },
  { value: "#10B981", label: "Green" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EC4899", label: "Pink" },
  { value: "#6B7280", label: "Gray" },
];

export default function SavedSearchesMenu({
  filters,
  onFiltersChange,
  activeSavedSearchId,
  onActiveSavedSearchChange,
}: SavedSearchesMenuProps) {
  const { toast } = useToast();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState<RcSavedSearch | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: COLOR_OPTIONS[0].value,
    isPinned: false,
  });

  const { data: savedSearches = [] } = useQuery<RcSavedSearch[]>({
    queryKey: ['saved-searches'],
    queryFn: async () => savedSearchesApi.getSavedSearches(),
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertRcSavedSearch) => savedSearchesApi.createSavedSearch(data),
    onSuccess: (newSearch) => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      toast({
        title: "Search saved",
        description: `"${newSearch.name}" has been saved successfully.`,
      });
      setSaveDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save search",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRcSavedSearch }) =>
      savedSearchesApi.updateSavedSearch(id, updates),
    onSuccess: (updatedSearch) => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      toast({
        title: "Search updated",
        description: `"${updatedSearch.name}" has been updated successfully.`,
      });
      setEditDialogOpen(false);
      setSelectedSearch(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update search",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => savedSearchesApi.deleteSavedSearch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      toast({
        title: "Search deleted",
        description: "The saved search has been deleted.",
      });
      setDeleteDialogOpen(false);
      setSelectedSearch(null);
      if (activeSavedSearchId === selectedSearch?.id) {
        onActiveSavedSearchChange(null, null);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete search",
        variant: "destructive",
      });
    },
  });

  const useMutation_ = useMutation({
    mutationFn: (id: string) => savedSearchesApi.useSavedSearch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: COLOR_OPTIONS[0].value,
      isPinned: false,
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'q') return false;
    if (key === 'columnFilters') {
      return Object.keys(value as Record<string, string[]>).length > 0;
    }
    return value !== "" && value !== false;
  });

  const handleSaveSearch = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this search",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      name: formData.name,
      description: formData.description || null,
      filters: filters as any,
      isPinned: formData.isPinned,
      color: formData.color,
      emailAlertsEnabled: false,
      alertFrequency: null,
      lastAlertSent: null,
      lastUsedAt: null,
      useCount: 0,
      updatedBy: null,
    });
  };

  const handleUpdateSearch = () => {
    if (!selectedSearch || !formData.name.trim()) return;

    updateMutation.mutate({
      id: selectedSearch.id,
      updates: {
        name: formData.name,
        description: formData.description || null,
        isPinned: formData.isPinned,
        color: formData.color,
        updatedBy: null,
      },
    });
  };

  const handleLoadSearch = async (search: RcSavedSearch) => {
    try {
      await useMutation_.mutateAsync(search.id);
      onFiltersChange(search.filters as FilterState);
      onActiveSavedSearchChange(search.id, search.name);
      toast({
        title: "Search loaded",
        description: `Applied filters from "${search.name}"`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load search",
        variant: "destructive",
      });
    }
  };

  const handleTogglePin = async (search: RcSavedSearch) => {
    try {
      await updateMutation.mutateAsync({
        id: search.id,
        updates: {
          isPinned: !(search.isPinned ?? false),
          updatedBy: null,
        },
      });
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  };

  const handleOpenEdit = (search: RcSavedSearch) => {
    setSelectedSearch(search);
    setFormData({
      name: search.name,
      description: search.description || "",
      color: search.color || COLOR_OPTIONS[0].value,
      isPinned: search.isPinned ?? false,
    });
    setEditDialogOpen(true);
  };

  const handleOpenDelete = (search: RcSavedSearch) => {
    setSelectedSearch(search);
    setDeleteDialogOpen(true);
  };

  const handleOpenSaveDialog = () => {
    resetForm();
    setSaveDialogOpen(true);
  };

  const pinnedSearches = savedSearches.filter(s => s.isPinned);
  const recentSearches = savedSearches
    .filter(s => !s.isPinned)
    .sort((a, b) => {
      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 10);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={activeSavedSearchId ? "default" : "outline"}
            size="sm"
            className="gap-2"
            data-testid="button-saved-searches"
          >
            <Bookmark className="h-4 w-4" />
            {activeSavedSearchId ? (
              <span className="flex items-center gap-2">
                <Check className="h-3 w-3" />
                {savedSearches.find(s => s.id === activeSavedSearchId)?.name || "Saved Search"}
              </span>
            ) : (
              "Saved Searches"
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Saved Searches</span>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleOpenSaveDialog}
                data-testid="button-save-current-search"
              >
                <PlusCircle className="h-3 w-3 mr-1" />
                Save Current
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {savedSearches.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No saved searches yet.
              <br />
              {hasActiveFilters ? "Click 'Save Current' to get started." : "Apply filters and save them for quick access."}
            </div>
          ) : (
            <>
              {pinnedSearches.length > 0 && (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2">
                      Pinned
                    </DropdownMenuLabel>
                    {pinnedSearches.map((search) => (
                      <SearchMenuItem
                        key={search.id}
                        search={search}
                        isActive={activeSavedSearchId === search.id}
                        onLoad={handleLoadSearch}
                        onEdit={handleOpenEdit}
                        onDelete={handleOpenDelete}
                        onTogglePin={handleTogglePin}
                      />
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              )}

              {recentSearches.length > 0 && (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2">
                    Recent
                  </DropdownMenuLabel>
                  {recentSearches.map((search) => (
                    <SearchMenuItem
                      key={search.id}
                      search={search}
                      isActive={activeSavedSearchId === search.id}
                      onLoad={handleLoadSearch}
                      onEdit={handleOpenEdit}
                      onDelete={handleOpenDelete}
                      onTogglePin={handleTogglePin}
                    />
                  ))}
                </DropdownMenuGroup>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent data-testid="dialog-save-search">
          <DialogHeader>
            <DialogTitle>Save Current Search</DialogTitle>
            <DialogDescription>
              Save your current filter configuration for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="search-name">Name *</Label>
              <Input
                id="search-name"
                placeholder="e.g., Florida Marinas 2023-2024"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-search-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-description">Description (optional)</Label>
              <Textarea
                id="search-description"
                placeholder="Add a description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                data-testid="input-search-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    title={color.label}
                    data-testid={`color-${color.label.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pin-search"
                checked={formData.isPinned}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPinned: checked as boolean })
                }
                data-testid="checkbox-pin-search"
              />
              <Label
                htmlFor="pin-search"
                className="text-sm font-normal cursor-pointer flex items-center gap-2"
              >
                <Pin className="h-3 w-3" />
                Pin to top
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              data-testid="button-cancel-save"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSearch}
              disabled={createMutation.isPending}
              data-testid="button-confirm-save"
            >
              {createMutation.isPending ? "Saving..." : "Save Search"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-search">
          <DialogHeader>
            <DialogTitle>Edit Saved Search</DialogTitle>
            <DialogDescription>
              Update the details of your saved search.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-search-name">Name *</Label>
              <Input
                id="edit-search-name"
                placeholder="Search name..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-search-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-search-description">Description (optional)</Label>
              <Textarea
                id="edit-search-description"
                placeholder="Add a description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                data-testid="input-edit-search-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    title={color.label}
                    data-testid={`edit-color-${color.label.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-pin-search"
                checked={formData.isPinned}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPinned: checked as boolean })
                }
                data-testid="checkbox-edit-pin-search"
              />
              <Label
                htmlFor="edit-pin-search"
                className="text-sm font-normal cursor-pointer flex items-center gap-2"
              >
                <Pin className="h-3 w-3" />
                Pin to top
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedSearch(null);
                resetForm();
              }}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSearch}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? "Updating..." : "Update Search"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-search">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved Search?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedSearch?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedSearch && deleteMutation.mutate(selectedSearch.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface SearchMenuItemProps {
  search: RcSavedSearch;
  isActive: boolean;
  onLoad: (search: RcSavedSearch) => void;
  onEdit: (search: RcSavedSearch) => void;
  onDelete: (search: RcSavedSearch) => void;
  onTogglePin: (search: RcSavedSearch) => void;
}

function SearchMenuItem({
  search,
  isActive,
  onLoad,
  onEdit,
  onDelete,
  onTogglePin,
}: SearchMenuItemProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-sm group">
      <button
        className="flex-1 flex items-start gap-2 text-left min-w-0"
        onClick={() => onLoad(search)}
        data-testid={`search-item-${search.id}`}
      >
        <div
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: search.color || "#6B7280" }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${isActive ? "text-primary" : ""}`}>
              {search.name}
            </span>
            {search.isPinned && (
              <Pin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
            {isActive && (
              <Check className="h-3 w-3 text-primary flex-shrink-0" />
            )}
          </div>
          {search.description && (
            <p className="text-xs text-muted-foreground truncate">
              {search.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            {(search.useCount ?? 0) > 0 && (
              <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                {search.useCount} {search.useCount === 1 ? 'use' : 'uses'}
              </Badge>
            )}
          </div>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            data-testid={`search-menu-${search.id}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onTogglePin(search)} data-testid="menu-toggle-pin">
            <Pin className="h-4 w-4 mr-2" />
            {search.isPinned ? "Unpin" : "Pin to top"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(search)} data-testid="menu-edit">
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(search)}
            className="text-destructive focus:text-destructive"
            data-testid="menu-delete"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
