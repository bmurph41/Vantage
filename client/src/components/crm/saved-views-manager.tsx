/**
 * SavedViewsManager
 * 
 * Toolbar component for CRM data tables that provides:
 * - Dropdown with saved views and built-in presets
 * - "Save Current View" to capture current filter/sort/column state
 * - Star to mark default view
 * - Edit/delete for user-created views
 * 
 * Integration: Add to CrmDataTable toolbar or any pipeline view.
 * 
 * Usage:
 *   <SavedViewsManager
 *     entityType="deal"
 *     currentConfig={{ filters, sort, columns }}
 *     onApplyView={(config) => { setFilters(config.filters); setSort(config.sort); }}
 *   />
 */

import { useState } from "react";
import {
  Bookmark,
  ChevronDown,
  Star,
  StarOff,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Filter,
  Save,
  Loader2,
  X,
  Anchor,
  Home,
  Store,
  DollarSign,
  AlertTriangle,
  Calendar,
  List,
  Users,
  Building2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useSavedViews,
  type SavedView,
  type SavedViewConfig,
  type CreateSavedViewInput,
} from "@/hooks/use-saved-views";

// ─── Types ────────────────────────────────────────────────────────

interface SavedViewsManagerProps {
  entityType: "deal" | "contact" | "company" | "property";
  currentConfig: SavedViewConfig;
  onApplyView: (config: SavedViewConfig) => void;
  activeViewId?: string | null;
  onActiveViewChange?: (id: string | null) => void;
}

// ─── Icon Map ─────────────────────────────────────────────────────

const VIEW_ICONS: Record<string, typeof List> = {
  list: List,
  "dollar-sign": DollarSign,
  calendar: Calendar,
  "alert-triangle": AlertTriangle,
  anchor: Anchor,
  home: Home,
  store: Store,
  users: Users,
  building: Building2,
  filter: Filter,
  bookmark: Bookmark,
};

const VIEW_COLORS: Record<string, string> = {
  blue: "text-blue-600 bg-blue-100 dark:bg-blue-900/40",
  green: "text-green-600 bg-green-100 dark:bg-green-900/40",
  amber: "text-amber-600 bg-amber-100 dark:bg-amber-900/40",
  red: "text-red-600 bg-red-100 dark:bg-red-900/40",
  cyan: "text-cyan-600 bg-cyan-100 dark:bg-cyan-900/40",
  purple: "text-purple-600 bg-purple-100 dark:bg-purple-900/40",
  slate: "text-slate-600 bg-slate-100 dark:bg-slate-900/40",
};

// ─── Component ────────────────────────────────────────────────────

export function SavedViewsManager({
  entityType,
  currentConfig,
  onApplyView,
  activeViewId,
  onActiveViewChange,
}: SavedViewsManagerProps) {
  const {
    views,
    savedViews,
    defaultView,
    isLoading,
    createView,
    updateView,
    deleteView,
    setDefault,
    duplicatePreset,
  } = useSavedViews(entityType);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [newViewName, setNewViewName] = useState("");
  const [newViewDescription, setNewViewDescription] = useState("");
  const [newViewShared, setNewViewShared] = useState(false);

  const activeView = views.find((v) => v.id === activeViewId);
  const userViews = views.filter((v) => !(v as any)._isPreset);
  const presetViews = views.filter((v) => (v as any)._isPreset);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleApplyView = (view: SavedView) => {
    onApplyView(view.config);
    onActiveViewChange?.(view.id);
  };

  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) return;

    if (editingView) {
      // Update existing
      updateView.mutate({
        id: editingView.id,
        data: {
          name: newViewName.trim(),
          description: newViewDescription.trim() || undefined,
          config: currentConfig,
          isShared: newViewShared,
        },
      });
    } else {
      // Create new
      createView.mutate({
        name: newViewName.trim(),
        description: newViewDescription.trim() || undefined,
        entityType,
        config: currentConfig,
        isDefault: false,
        isShared: newViewShared,
      });
    }

    setSaveDialogOpen(false);
    setNewViewName("");
    setNewViewDescription("");
    setNewViewShared(false);
    setEditingView(null);
  };

  const handleDeleteView = (view: SavedView) => {
    if (confirm(`Delete "${view.name}"?`)) {
      deleteView.mutate(view.id);
      if (activeViewId === view.id) {
        onActiveViewChange?.(null);
      }
    }
  };

  const handleEditView = (view: SavedView) => {
    setEditingView(view);
    setNewViewName(view.name);
    setNewViewDescription(view.description || "");
    setNewViewShared(view.isShared);
    setSaveDialogOpen(true);
  };

  const openSaveNew = () => {
    setEditingView(null);
    setNewViewName("");
    setNewViewDescription("");
    setNewViewShared(false);
    setSaveDialogOpen(true);
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            {activeView ? (
              <span className="max-w-[120px] truncate">{activeView.name}</span>
            ) : (
              "Views"
            )}
            <ChevronDown className="h-3 w-3 ml-0.5" />
            {activeView && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">
                Active
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {/* Clear active view */}
          {activeView && (
            <>
              <DropdownMenuItem
                className="gap-2 text-xs"
                onClick={() => {
                  onActiveViewChange?.(null);
                }}
              >
                <X className="h-3 w-3" />
                Clear active view
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* User saved views */}
          {userViews.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                My Views
              </DropdownMenuLabel>
              {userViews.map((view) => (
                <ViewMenuItem
                  key={view.id}
                  view={view}
                  isActive={activeViewId === view.id}
                  isDefault={defaultView?.id === view.id}
                  onApply={() => handleApplyView(view)}
                  onEdit={() => handleEditView(view)}
                  onDelete={() => handleDeleteView(view)}
                  onSetDefault={() => setDefault.mutate(view.id)}
                />
              ))}
            </DropdownMenuGroup>
          )}

          {userViews.length > 0 && presetViews.length > 0 && <DropdownMenuSeparator />}

          {/* Presets */}
          {presetViews.length > 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Presets
              </DropdownMenuLabel>
              {presetViews.map((view) => (
                <ViewMenuItem
                  key={view.id}
                  view={view}
                  isActive={activeViewId === view.id}
                  isPreset
                  onApply={() => handleApplyView(view)}
                  onDuplicate={() => duplicatePreset.mutate(view)}
                />
              ))}
            </DropdownMenuGroup>
          )}

          <DropdownMenuSeparator />

          {/* Actions */}
          <DropdownMenuItem className="gap-2 text-xs" onClick={openSaveNew}>
            <Plus className="h-3 w-3" />
            Save Current View
          </DropdownMenuItem>

          {userViews.length > 0 && (
            <DropdownMenuItem
              className="gap-2 text-xs"
              onClick={() => setManageDialogOpen(true)}
            >
              <Pencil className="h-3 w-3" />
              Manage Views
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ─── Save View Dialog ──────────────────────────────────── */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {editingView ? "Update View" : "Save Current View"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>View Name</Label>
              <Input
                placeholder='e.g. "My High-Value Deals"'
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveCurrentView();
                }}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What this view filters for..."
                value={newViewDescription}
                onChange={(e) => setNewViewDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Shared with team</Label>
                <p className="text-[11px] text-muted-foreground">
                  Others on your team can use this view
                </p>
              </div>
              <Switch checked={newViewShared} onCheckedChange={setNewViewShared} />
            </div>

            {/* Current config summary */}
            <div className="border rounded-md p-3 bg-muted/30 space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Current View Config
              </p>
              <div className="flex flex-wrap gap-1">
                {currentConfig.filters.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    <Filter className="h-2.5 w-2.5 mr-0.5" />
                    {currentConfig.filters.length} filter{currentConfig.filters.length !== 1 ? "s" : ""}
                  </Badge>
                )}
                {currentConfig.sort.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    Sort: {currentConfig.sort[0]?.field}
                  </Badge>
                )}
                {currentConfig.columns.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {currentConfig.columns.length} columns
                  </Badge>
                )}
                {currentConfig.assetClassFilter && (
                  <Badge variant="outline" className="text-[10px]">
                    {currentConfig.assetClassFilter.join(", ")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveCurrentView}
              disabled={
                !newViewName.trim() ||
                createView.isPending ||
                updateView.isPending
              }
            >
              {(createView.isPending || updateView.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingView ? "Update" : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Manage Views Dialog ───────────────────────────────── */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Saved Views</DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 py-2">
              {userViews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No saved views yet. Save your current filters as a view.
                </p>
              ) : (
                userViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <ViewIcon icon={view.icon} color={view.color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{view.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {view.description || `${view.config.filters.length} filters`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {view.isDefault && (
                        <Badge variant="secondary" className="text-[9px]">
                          Default
                        </Badge>
                      )}
                      {view.isShared && (
                        <Badge variant="outline" className="text-[9px]">
                          <Users className="h-2 w-2 mr-0.5" />
                          Shared
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setManageDialogOpen(false);
                          handleEditView(view);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => handleDeleteView(view)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── View Menu Item ───────────────────────────────────────────────

function ViewMenuItem({
  view,
  isActive,
  isDefault,
  isPreset,
  onApply,
  onEdit,
  onDelete,
  onSetDefault,
  onDuplicate,
}: {
  view: SavedView;
  isActive: boolean;
  isDefault?: boolean;
  isPreset?: boolean;
  onApply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetDefault?: () => void;
  onDuplicate?: () => void;
}) {
  return (
    <DropdownMenuItem
      className="flex items-center gap-2 py-2 cursor-pointer group"
      onClick={onApply}
    >
      <ViewIcon icon={view.icon} color={view.color} size="sm" />
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium truncate", isActive && "text-primary")}>
          {view.name}
        </p>
        {view.config.filters.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {view.config.filters.length} filter{view.config.filters.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {isActive && <Check className="h-3 w-3 text-primary" />}
        {isDefault && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
        {isPreset && onDuplicate && (
          <Button
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy className="h-2.5 w-2.5" />
          </Button>
        )}
      </div>
    </DropdownMenuItem>
  );
}

// ─── View Icon ────────────────────────────────────────────────────

function ViewIcon({
  icon,
  color,
  size = "md",
}: {
  icon?: string;
  color?: string;
  size?: "sm" | "md";
}) {
  const Icon = VIEW_ICONS[icon || "bookmark"] || Bookmark;
  const colorClass = VIEW_COLORS[color || "slate"] || VIEW_COLORS.slate;
  const sizeClass = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <div
      className={cn(
        "rounded-md flex items-center justify-center flex-shrink-0",
        sizeClass,
        colorClass
      )}
    >
      <Icon className={iconSize} />
    </div>
  );
}

export default SavedViewsManager;
