// TODO: Missing SalesComps-specific utilities:
// - @/lib/api (columnsApi)
// - @/lib/queryKeys
// - @/lib/authUtils
// - @shared/schema types (CompColumn, InsertCompColumn, UpdateCompColumn)

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, X, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ColumnManagerProps {
  onClose: () => void;
}

export default function ColumnManager({ onClose }: ColumnManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingColumn, setEditingColumn] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<any>({
    key: '',
    label: '',
    type: 'text',
    required: false,
    visible: true,
    orderIndex: 0,
  });

  // TODO: Fetch columns when API is available
  const columns: any[] = [];
  const isLoading = false;

  const resetForm = () => {
    setFormData({
      key: '',
      label: '',
      type: 'text',
      required: false,
      visible: true,
      orderIndex: 0,
    });
  };

  const handleCreate = () => {
    if (!formData.key || !formData.label || !formData.type) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // TODO: Implement create when API is available
    toast({
      title: "TODO",
      description: "Column creation pending API integration",
      variant: "destructive",
    });
  };

  const handleUpdate = (column: any, updates: any) => {
    // TODO: Implement update when API is available
    toast({
      title: "TODO",
      description: "Column update pending API integration",
      variant: "destructive",
    });
  };

  const handleDelete = (column: any) => {
    if (window.confirm(`Are you sure you want to delete the column "${column.label}"?`)) {
      // TODO: Implement delete when API is available
      toast({
        title: "TODO",
        description: "Column deletion pending API integration",
        variant: "destructive",
      });
    }
  };

  const startEdit = (column: any) => {
    setEditingColumn(column);
  };

  const cancelEdit = () => {
    setEditingColumn(null);
  };

  const columnTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'currency', label: 'Currency' },
    { value: 'percent', label: 'Percentage' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'select', label: 'Select' },
  ];

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-4xl">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading columns...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle>Column Manager</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowCreateForm(true)}
                data-testid="button-add-column"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                data-testid="button-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Manage custom columns for sales comps data
          </p>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-6 max-h-[70vh] overflow-auto">
          {/* Create Form */}
          {showCreateForm && (
            <Card className="mb-6 border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-lg">Create New Column</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Key *</Label>
                    <Input
                      value={formData.key}
                      onChange={(e) => setFormData((prev: any) => ({ 
                        ...prev, 
                        key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') 
                      }))}
                      placeholder="field_name"
                      data-testid="input-column-key"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Unique identifier (letters, numbers, underscores only)
                    </p>
                  </div>
                  <div>
                    <Label>Label *</Label>
                    <Input
                      value={formData.label}
                      onChange={(e) => setFormData((prev: any) => ({ ...prev, label: e.target.value }))}
                      placeholder="Display Name"
                      data-testid="input-column-label"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCreate}
                    data-testid="button-create-column"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Create Column
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      resetForm();
                    }}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Columns List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Existing Columns</h3>
            {columns && columns.length > 0 ? (
              <div className="space-y-2">
                {columns.map((column: any) => (
                  <Card key={column.id} className="border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{column.label}</span>
                              <Badge variant="outline">{column.type}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">Key: {column.key}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(column)}
                            data-testid={`button-edit-${column.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(column)}
                            data-testid={`button-delete-${column.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No custom columns created yet</p>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(true)}
                    className="mt-4"
                    data-testid="button-create-first-column"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Column
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {columns?.length || 0} custom column{columns?.length !== 1 ? 's' : ''}
            </p>
            <Button onClick={onClose} data-testid="button-done">
              Done
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
