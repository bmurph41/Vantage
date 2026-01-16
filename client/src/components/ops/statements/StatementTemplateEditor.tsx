import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface StatementTemplateEditorProps {
  template: any | null;
  onClose: () => void;
  onSave: () => void;
}

const DEFAULT_COLUMNS = [
  { key: "date", label: "Date", enabled: true },
  { key: "description", label: "Description", enabled: true },
  { key: "amount", label: "Amount", enabled: true },
  { key: "category", label: "Category", enabled: true },
];

export function StatementTemplateEditor({ template, onClose, onSave }: StatementTemplateEditorProps) {
  const [name, setName] = useState(template?.name || "");
  const [ownerContactId, setOwnerContactId] = useState(template?.ownerContactId || "");
  const [columns, setColumns] = useState<any[]>(template?.columns || DEFAULT_COLUMNS);
  const [filters, setFilters] = useState<any>(template?.filters || {});
  const [totals, setTotals] = useState<any>(template?.totals || { showGross: true, showNet: true });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        ownerContactId: ownerContactId || null,
        columns,
        filters,
        totals,
      };
      if (template?.id) {
        return apiRequest(`/api/opssos/statements/templates/${template.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      }
      return apiRequest("/api/opssos/statements/templates", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      onSave();
    },
  });

  const addColumn = () => {
    setColumns([...columns, { key: "", label: "", enabled: true }]);
  };

  const updateColumn = (index: number, updates: any) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], ...updates };
    setColumns(newColumns);
  };

  const removeColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {template ? "Edit Statement Template" : "Create Statement Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Monthly Owner Statement"
            />
          </div>

          <div className="space-y-2">
            <Label>Owner Contact ID (optional)</Label>
            <Input
              value={ownerContactId}
              onChange={(e) => setOwnerContactId(e.target.value)}
              placeholder="Link to specific owner contact"
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Columns</CardTitle>
                <Button variant="ghost" size="sm" onClick={addColumn}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Column
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {columns.map((column, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Checkbox
                    checked={column.enabled}
                    onCheckedChange={(checked) => updateColumn(index, { enabled: checked })}
                  />
                  <Input
                    value={column.key}
                    onChange={(e) => updateColumn(index, { key: e.target.value })}
                    placeholder="Key"
                    className="w-32"
                  />
                  <Input
                    value={column.label}
                    onChange={(e) => updateColumn(index, { label: e.target.value })}
                    placeholder="Label"
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeColumn(index)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Totals & Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={totals.showGross}
                  onCheckedChange={(checked) => setTotals({ ...totals, showGross: checked })}
                />
                <Label>Show Gross Revenue</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={totals.showNet}
                  onCheckedChange={(checked) => setTotals({ ...totals, showNet: checked })}
                />
                <Label>Show Net Revenue</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={totals.showExpenses}
                  onCheckedChange={(checked) => setTotals({ ...totals, showExpenses: checked })}
                />
                <Label>Show Expenses Breakdown</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={JSON.stringify(filters, null, 2)}
                onChange={(e) => {
                  try {
                    setFilters(JSON.parse(e.target.value));
                  } catch {}
                }}
                placeholder='{"property": "marina-1", "category": "storage"}'
                className="font-mono text-sm"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-2">
                JSON object defining filters for the statement data
              </p>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : template ? "Update Template" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
