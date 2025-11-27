import { useState, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GripVertical, Eye, EyeOff, Edit2, Plus, Trash2, Check, X, RotateCcw } from "lucide-react";

export interface ColumnConfig {
  key: string;
  label: string;
  originalLabel?: string;
  visible: boolean;
  width?: number;
  sortable?: boolean;
  type?: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'percent';
  isCustom?: boolean;
}

interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggleVisibility: (key: string) => void;
  onRename: (key: string) => void;
  onDelete?: (key: string) => void;
}

function SortableColumnItem({ column, onToggleVisibility, onRename, onDelete }: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-background border rounded-lg ${
        isDragging ? 'shadow-lg ring-2 ring-primary' : ''
      } ${!column.visible ? 'opacity-60' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        data-testid={`drag-handle-${column.key}`}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${!column.visible ? 'text-muted-foreground' : ''}`}>
            {column.label}
          </span>
          {column.originalLabel && column.label !== column.originalLabel && (
            <Badge variant="secondary" className="text-xs">
              renamed
            </Badge>
          )}
          {column.isCustom && (
            <Badge variant="outline" className="text-xs">
              custom
            </Badge>
          )}
        </div>
        {column.type && (
          <span className="text-xs text-muted-foreground capitalize">{column.type}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onRename(column.key)}
          data-testid={`button-rename-${column.key}`}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onToggleVisibility(column.key)}
          data-testid={`button-visibility-${column.key}`}
        >
          {column.visible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>

        {column.isCustom && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDelete(column.key)}
            data-testid={`button-delete-${column.key}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface ColumnCustomizerProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  moduleType: 'salesComps' | 'rateComps';
}

export function ColumnCustomizer({ columns, onColumnsChange, moduleType }: ColumnCustomizerProps) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<ColumnConfig | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumn, setNewColumn] = useState<{ label: string; type: ColumnConfig['type'] }>({ label: '', type: 'text' });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localColumns.findIndex((col) => col.key === active.id);
      const newIndex = localColumns.findIndex((col) => col.key === over.id);

      const reorderedColumns = arrayMove(localColumns, oldIndex, newIndex);
      setLocalColumns(reorderedColumns);
      onColumnsChange(reorderedColumns);
    }
  }, [localColumns, onColumnsChange]);

  const handleToggleVisibility = useCallback((key: string) => {
    const updated = localColumns.map((col) =>
      col.key === key ? { ...col, visible: !col.visible } : col
    );
    setLocalColumns(updated);
    onColumnsChange(updated);
  }, [localColumns, onColumnsChange]);

  const handleRename = (key: string) => {
    const column = localColumns.find((col) => col.key === key);
    if (column) {
      setEditingColumn(column);
      setNewColumnName(column.label);
      setRenameDialogOpen(true);
    }
  };

  const handleSaveRename = () => {
    if (editingColumn && newColumnName.trim()) {
      const updated = localColumns.map((col) =>
        col.key === editingColumn.key
          ? { ...col, label: newColumnName.trim(), originalLabel: col.originalLabel || col.label }
          : col
      );
      setLocalColumns(updated);
      onColumnsChange(updated);
      setRenameDialogOpen(false);
      setEditingColumn(null);
      setNewColumnName("");
    }
  };

  const handleResetName = () => {
    if (editingColumn && editingColumn.originalLabel) {
      const updated = localColumns.map((col) =>
        col.key === editingColumn.key
          ? { ...col, label: col.originalLabel || col.label, originalLabel: undefined }
          : col
      );
      setLocalColumns(updated);
      onColumnsChange(updated);
      setRenameDialogOpen(false);
      setEditingColumn(null);
    }
  };

  const handleAddColumn = () => {
    if (newColumn.label.trim()) {
      const key = `custom_${Date.now()}`;
      const newColumnConfig: ColumnConfig = {
        key,
        label: newColumn.label.trim(),
        visible: true,
        type: newColumn.type,
        isCustom: true,
        sortable: true,
      };
      const updated = [...localColumns, newColumnConfig];
      setLocalColumns(updated);
      onColumnsChange(updated);
      setAddDialogOpen(false);
      setNewColumn({ label: '', type: 'text' });
    }
  };

  const handleDeleteColumn = (key: string) => {
    const updated = localColumns.filter((col) => col.key !== key);
    setLocalColumns(updated);
    onColumnsChange(updated);
  };

  const visibleCount = localColumns.filter((col) => col.visible).length;
  const hiddenCount = localColumns.filter((col) => !col.visible).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {visibleCount} visible
          </span>
          <span className="flex items-center gap-1">
            <EyeOff className="h-4 w-4" />
            {hiddenCount} hidden
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          data-testid="button-add-column"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Column
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localColumns.map((col) => col.key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {localColumns.map((column) => (
                  <SortableColumnItem
                    key={column.key}
                    column={column}
                    onToggleVisibility={handleToggleVisibility}
                    onRename={handleRename}
                    onDelete={column.isCustom ? handleDeleteColumn : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="columnName">Column Name</Label>
              <Input
                id="columnName"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Enter column name"
                data-testid="input-column-name"
              />
            </div>
            {editingColumn?.originalLabel && editingColumn.label !== editingColumn.originalLabel && (
              <p className="text-sm text-muted-foreground">
                Original name: {editingColumn.originalLabel}
              </p>
            )}
          </div>
          <DialogFooter>
            {editingColumn?.originalLabel && (
              <Button variant="outline" onClick={handleResetName} className="mr-auto">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Original
              </Button>
            )}
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRename} data-testid="button-save-rename">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newColumnLabel">Column Name</Label>
              <Input
                id="newColumnLabel"
                value={newColumn.label}
                onChange={(e) => setNewColumn({ ...newColumn, label: e.target.value })}
                placeholder="Enter column name"
                data-testid="input-new-column-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newColumnType">Column Type</Label>
              <Select
                value={newColumn.type}
                onValueChange={(value: ColumnConfig['type']) => setNewColumn({ ...newColumn, type: value })}
              >
                <SelectTrigger data-testid="select-column-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                  <SelectItem value="percent">Percentage</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="boolean">Yes/No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddColumn} data-testid="button-confirm-add-column">
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
