import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, X, Edit } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CustomFieldsEditorProps {
  entityType: "contact" | "company" | "deal" | "property";
  entityId: string;
  customFields: Record<string, any>;
}

export function CustomFieldsEditor({
  entityType,
  entityId,
  customFields = {},
}: CustomFieldsEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(() => 
    Object.fromEntries(
      Object.entries(customFields || {}).map(([k, v]) => [k, String(v)])
    )
  );
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (newFields: Record<string, string>) => {
      const response = await apiRequest('PUT', `/api/${entityType}s/${entityId}`, {
        customFields: newFields,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}s`] });
      queryClient.invalidateQueries({ queryKey: [`/api/${entityType}s`, entityId] });
      toast({ title: "Custom fields updated successfully" });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update custom fields",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(fields);
  };

  const handleCancel = () => {
    setFields(
      Object.fromEntries(
        Object.entries(customFields || {}).map(([k, v]) => [k, String(v)])
      )
    );
    setIsEditing(false);
  };

  const handleAddField = () => {
    if (!newFieldKey.trim()) {
      toast({
        title: "Field name required",
        description: "Please enter a name for the custom field",
        variant: "destructive",
      });
      return;
    }
    if (fields[newFieldKey]) {
      toast({
        title: "Field already exists",
        description: "A field with this name already exists",
        variant: "destructive",
      });
      return;
    }
    setFields({ ...fields, [newFieldKey.trim()]: newFieldValue });
    setNewFieldKey("");
    setNewFieldValue("");
    setIsAddingNew(false);
    setIsEditing(true);
  };

  const handleDeleteField = (key: string) => {
    const newFields = { ...fields };
    delete newFields[key];
    setFields(newFields);
    setIsEditing(true);
  };

  const handleFieldChange = (key: string, value: string) => {
    setFields({ ...fields, [key]: value });
    setIsEditing(true);
  };

  const fieldEntries = Object.entries(fields);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Custom Fields</h3>
        <div className="flex gap-2">
          {isEditing && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
                data-testid="button-cancel-custom-fields"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save-custom-fields"
              >
                <Save className="h-4 w-4 mr-1" />
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          )}
          {!isAddingNew && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingNew(true)}
              data-testid="button-add-custom-field"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Field
            </Button>
          )}
        </div>
      </div>

      {isAddingNew && (
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="new-field-key">Field Name</Label>
              <Input
                id="new-field-key"
                placeholder="e.g., Preferred Contact Time"
                value={newFieldKey}
                onChange={(e) => setNewFieldKey(e.target.value)}
                data-testid="input-new-field-key"
              />
            </div>
            <div>
              <Label htmlFor="new-field-value">Value</Label>
              <Input
                id="new-field-value"
                placeholder="e.g., Morning"
                value={newFieldValue}
                onChange={(e) => setNewFieldValue(e.target.value)}
                data-testid="input-new-field-value"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAddField}
              data-testid="button-confirm-add-field"
            >
              Add Field
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAddingNew(false);
                setNewFieldKey("");
                setNewFieldValue("");
              }}
              data-testid="button-cancel-add-field"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {fieldEntries.length === 0 && !isAddingNew ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No custom fields yet</p>
          <p className="text-sm">Click "Add Field" to create your first custom field</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fieldEntries.map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-3 p-3 border rounded-lg bg-background"
              data-testid={`custom-field-${key}`}
            >
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">{key}</Label>
                <Input
                  value={value}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="mt-1"
                  data-testid={`input-custom-field-${key}`}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteField(key)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                data-testid={`button-delete-field-${key}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
