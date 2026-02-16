import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BulkEditProps {
  selectedIds: string[];
  onClose: () => void;
}

export default function BulkEdit({ selectedIds, onClose }: BulkEditProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [updates, setUpdates] = useState<any>({});
  const [fieldsToUpdate, setFieldsToUpdate] = useState<Set<string>>(new Set());

  const handleFieldToggle = (field: string, checked: boolean) => {
    const newFields = new Set(fieldsToUpdate);
    if (checked) {
      newFields.add(field);
    } else {
      newFields.delete(field);
      const newUpdates = { ...updates };
      delete newUpdates[field];
      setUpdates(newUpdates);
    }
    setFieldsToUpdate(newFields);
  };

  const handleFieldChange = (field: string, value: any) => {
    setUpdates((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const filteredUpdates: any = {};
    fieldsToUpdate.forEach(field => {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one field to update",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Saving Changes...",
      description: `Updating ${selectedIds.length} selected records...`,
    });

    try {
      const response = await fetch("/api/rate-comps/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, updates: filteredUpdates }),
      });
      if (!response.ok) throw new Error("Failed to update records");
      toast({
        title: "Changes Saved",
        description: `Successfully updated ${selectedIds.length} records.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rate-comps"] });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fields = [
    { key: 'state', label: 'State', type: 'text' },
    { key: 'market', label: 'Market', type: 'text' },
    { key: 'region', label: 'Region', type: 'text' },
    { key: 'saleCondition', label: 'Sale Condition', type: 'text' },
    { key: 'broker', label: 'Broker', type: 'text' },
    { key: 'ioBoth', label: 'Storage Type', type: 'select', options: ['Inside', 'Outside', 'Both'] },
    { key: 'bodyOfWater', label: 'Body of Water', type: 'text' },
    { key: 'waterfront', label: 'Waterfront', type: 'text' },
    { key: 'capRate', label: 'Cap Rate (%)', type: 'number' },
    { key: 'occupancy', label: 'Occupancy (%)', type: 'number' },
    { key: 'yearBuilt', label: 'Year Built', type: 'number' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle>Bulk Edit Rate Comps</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              data-testid="button-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Editing {selectedIds.length} selected comps
          </p>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-6 max-h-[60vh] overflow-auto">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select the fields you want to update and enter the new values. Only checked fields will be updated.
            </p>

            {fields.map((field) => (
              <div key={field.key} className="flex items-start gap-3 p-3 border rounded-md">
                <Checkbox
                  checked={fieldsToUpdate.has(field.key)}
                  onCheckedChange={(checked) => handleFieldToggle(field.key, checked as boolean)}
                  data-testid={`checkbox-${field.key}`}
                />
                <div className="flex-1 space-y-2">
                  <Label className="text-sm font-medium">{field.label}</Label>
                  {field.type === 'select' ? (
                    <Select
                      value={updates[field.key] || ''}
                      onValueChange={(value) => handleFieldChange(field.key, value)}
                      disabled={!fieldsToUpdate.has(field.key)}
                    >
                      <SelectTrigger data-testid={`select-${field.key}`}>
                        <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type}
                      value={updates[field.key] || ''}
                      onChange={(e) => {
                        const value = field.type === 'number' 
                          ? (e.target.value ? parseFloat(e.target.value) : null)
                          : e.target.value;
                        handleFieldChange(field.key, value);
                      }}
                      disabled={!fieldsToUpdate.has(field.key)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      data-testid={`input-${field.key}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {fieldsToUpdate.size} field{fieldsToUpdate.size !== 1 ? 's' : ''} selected for update
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={fieldsToUpdate.size === 0}
                data-testid="button-update"
              >
                <Save className="h-4 w-4 mr-2" />
                Update {selectedIds.length} Comps
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
