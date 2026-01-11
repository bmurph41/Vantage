import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import type { RentRollTableConfig } from "@shared/schema";
import { DEFAULT_RENT_ROLL_COLUMNS } from "@shared/schema";

interface ColumnSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: RentRollTableConfig;
  onSave: (config: RentRollTableConfig) => void;
}

export default function ColumnSettingsDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: ColumnSettingsDialogProps) {
  const [localConfig, setLocalConfig] = useState<RentRollTableConfig>(config);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalConfig(config);
    }
    onOpenChange(newOpen);
  };

  const handleToggleVisibility = (columnId: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      ),
    }));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    
    setLocalConfig((prev) => {
      const newColumns = [...prev.columns];
      const temp = newColumns[index];
      newColumns[index] = newColumns[index - 1];
      newColumns[index - 1] = temp;
      
      return {
        ...prev,
        columns: newColumns.map((col, idx) => ({ ...col, order: idx })),
      };
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === localConfig.columns.length - 1) return;
    
    setLocalConfig((prev) => {
      const newColumns = [...prev.columns];
      const temp = newColumns[index];
      newColumns[index] = newColumns[index + 1];
      newColumns[index + 1] = temp;
      
      return {
        ...prev,
        columns: newColumns.map((col, idx) => ({ ...col, order: idx })),
      };
    });
  };

  const handleUpdateLabel = (columnId: string, newLabel: string) => {
    setLocalConfig((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId ? { ...col, label: newLabel } : col
      ),
    }));
  };

  const handleResetToDefaults = () => {
    setLocalConfig({
      columns: [...DEFAULT_RENT_ROLL_COLUMNS],
      sort: { columnId: null, direction: null },
    });
  };

  const handleSave = () => {
    const sortedColumns = [...localConfig.columns].sort((a, b) => a.order - b.order);
    
    const enforcedConfig = {
      ...localConfig,
      columns: sortedColumns.map((col, index) => {
        if (col.id === 'actions') {
          return { ...col, visible: true, order: index };
        }
        return { ...col, order: index };
      }),
    };
    
    onSave(enforcedConfig);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalConfig(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-column-settings">
        <DialogHeader>
          <DialogTitle>Table Settings</DialogTitle>
          <DialogDescription>
            Customize visibility, order, and labels for your rent roll table columns
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[450px] overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Show</TableHead>
                <TableHead className="w-16 text-center">Order</TableHead>
                <TableHead className="w-24 text-center">Move</TableHead>
                <TableHead className="w-40">Column</TableHead>
                <TableHead>Custom Label</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localConfig.columns.map((column, index) => {
                const defaultLabel = DEFAULT_RENT_ROLL_COLUMNS.find((c) => c.id === column.id)?.label || column.id;
                return (
                  <TableRow key={column.id}>
                    <TableCell className="text-center">
                      <Switch
                        checked={column.visible}
                        onCheckedChange={() => handleToggleVisibility(column.id)}
                        disabled={column.id === 'actions'}
                        data-testid={`switch-column-${column.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-center font-medium tabular-nums">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          data-testid={`button-move-up-${column.id}`}
                        >
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === localConfig.columns.length - 1}
                          data-testid={`button-move-down-${column.id}`}
                        >
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground">
                      {defaultLabel}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={column.label}
                        onChange={(e) => handleUpdateLabel(column.id, e.target.value)}
                        placeholder={defaultLabel}
                        className="h-8"
                        data-testid={`input-label-${column.id}`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        <p className="text-xs text-muted-foreground">
          Note: The "Actions" column is always visible
        </p>

        <DialogFooter className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            onClick={handleResetToDefaults}
            data-testid="button-reset-defaults"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-save">
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
