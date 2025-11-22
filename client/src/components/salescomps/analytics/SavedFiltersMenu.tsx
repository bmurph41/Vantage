import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Save, Bookmark, Star, Trash2, Edit2 } from "lucide-react";

export interface AnalyticsFilters {
  minSlips?: number;
  maxSlips?: number;
  minYear?: number;
  maxYear?: number;
  minSalePrice?: number;
  maxSalePrice?: number;
  states?: string[];
  cities?: string[];
  storageTypes?: string[];
  coastalType?: string[];
  region?: string[];
  broker?: string[];
  isPortfolio?: boolean | null;
  profitCenterType?: string[];
}

interface SavedFilterPreset {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  filters: AnalyticsFilters;
  isPinned: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SavedFiltersMenuProps {
  currentFilters: AnalyticsFilters;
  onLoadFilters: (filters: AnalyticsFilters) => void;
}

export function SavedFiltersMenu({ currentFilters, onLoadFilters }: SavedFiltersMenuProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<SavedFilterPreset | null>(null);
  const [presetName, setPresetName] = useState("");

  const { data: presets = [] } = useQuery<SavedFilterPreset[]>({
    queryKey: ["/api/sales-comps/analytics/filter-presets"],
  });

  const createPresetMutation = useMutation({
    mutationFn: async (data: { name: string; filters: AnalyticsFilters }) => {
      return await apiRequest("/api/sales-comps/analytics/filter-presets", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-comps/analytics/filter-presets"] });
      setSaveDialogOpen(false);
      setPresetName("");
      toast({
        title: "Filter preset saved",
        description: "Your filter settings have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error saving preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePresetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SavedFilterPreset> }) => {
      return await apiRequest(`/api/sales-comps/analytics/filter-presets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-comps/analytics/filter-presets"] });
      setEditingPreset(null);
      setPresetName("");
      toast({
        title: "Filter preset updated",
        description: "Your filter settings have been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePresetMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/sales-comps/analytics/filter-presets/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-comps/analytics/filter-presets"] });
      toast({
        title: "Filter preset deleted",
        description: "The filter preset has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting preset",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLoadPreset = (preset: SavedFilterPreset) => {
    onLoadFilters(preset.filters);
    setIsOpen(false);
    toast({
      title: "Filter preset loaded",
      description: `Loaded "${preset.name}" filter settings.`,
    });
  };

  const handleSaveNewPreset = () => {
    if (!presetName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this filter preset.",
        variant: "destructive",
      });
      return;
    }

    createPresetMutation.mutate({
      name: presetName.trim(),
      filters: currentFilters,
    });
  };

  const handleUpdatePreset = () => {
    if (!editingPreset) return;
    
    if (!presetName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this filter preset.",
        variant: "destructive",
      });
      return;
    }

    updatePresetMutation.mutate({
      id: editingPreset.id,
      data: {
        name: presetName.trim(),
        filters: currentFilters,
      },
    });
  };

  const handleTogglePin = (preset: SavedFilterPreset) => {
    updatePresetMutation.mutate({
      id: preset.id,
      data: {
        isPinned: !preset.isPinned,
      },
    });
  };

  const pinnedPresets = presets.filter((p) => p.isPinned);
  const unpinnedPresets = presets.filter((p) => !p.isPinned);

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-saved-filters">
            <Bookmark className="h-4 w-4 mr-2" />
            Saved Filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Filter Presets</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {pinnedPresets.length > 0 && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Pinned</DropdownMenuLabel>
                {pinnedPresets.map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => handleLoadPreset(preset)}
                    className="flex items-center justify-between group"
                    data-testid={`item-preset-${preset.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {preset.name}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPreset(preset);
                          setPresetName(preset.name);
                        }}
                        data-testid={`button-edit-${preset.id}`}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePin(preset);
                        }}
                        data-testid={`button-unpin-${preset.id}`}
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePresetMutation.mutate(preset.id);
                        }}
                        data-testid={`button-delete-${preset.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}

          {unpinnedPresets.length > 0 && (
            <DropdownMenuGroup>
              {pinnedPresets.length === 0 && (
                <DropdownMenuLabel className="text-xs text-muted-foreground">All Presets</DropdownMenuLabel>
              )}
              {unpinnedPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset)}
                  className="flex items-center justify-between group"
                  data-testid={`item-preset-${preset.id}`}
                >
                  <span>{preset.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPreset(preset);
                        setPresetName(preset.name);
                      }}
                      data-testid={`button-edit-${preset.id}`}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePin(preset);
                      }}
                      data-testid={`button-pin-${preset.id}`}
                    >
                      <Star className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePresetMutation.mutate(preset.id);
                      }}
                      data-testid={`button-delete-${preset.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )}

          {presets.length === 0 && (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No saved filter presets
            </div>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setSaveDialogOpen(true)}
            className="flex items-center gap-2"
            data-testid="button-save-new-preset"
          >
            <Save className="h-4 w-4" />
            Save Current Filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen || !!editingPreset} onOpenChange={(open) => {
        if (!open) {
          setSaveDialogOpen(false);
          setEditingPreset(null);
          setPresetName("");
        }
      }}>
        <DialogContent data-testid="dialog-save-preset">
          <DialogHeader>
            <DialogTitle>{editingPreset ? "Update Filter Preset" : "Save Filter Preset"}</DialogTitle>
            <DialogDescription>
              {editingPreset 
                ? "Update the name and filters for this preset."
                : "Save your current filter settings for quick access later."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                placeholder="e.g., Florida Marinas 100+ Slips"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                data-testid="input-preset-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSaveDialogOpen(false);
                setEditingPreset(null);
                setPresetName("");
              }}
              data-testid="button-cancel-save"
            >
              Cancel
            </Button>
            <Button
              onClick={editingPreset ? handleUpdatePreset : handleSaveNewPreset}
              disabled={createPresetMutation.isPending || updatePresetMutation.isPending}
              data-testid="button-confirm-save"
            >
              {editingPreset ? "Update" : "Save"} Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
