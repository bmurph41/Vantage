import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Plus, Sparkles, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FileAnalysis } from '@/lib/ratecomps/types';

interface ColumnMapperSimpleProps {
  analysis: FileAnalysis;
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

// Standard fields that can be mapped to
const STANDARD_FIELDS = [
  { value: 'marina', label: 'Marina Name', required: true },
  { value: 'salePrice', label: 'Sale Price' },
  { value: 'capRate', label: 'Cap Rate' },
  { value: 'noi', label: 'NOI' },
  { value: 'saleMonth', label: 'Sale Month' },
  { value: 'saleYear', label: 'Sale Year' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'wetSlips', label: 'Wet Slips' },
  { value: 'dryRacks', label: 'Dry Racks' },
  { value: 'bodyOfWater', label: 'Body of Water' },
  { value: 'waterBodyName', label: 'Water Body Name' },
  { value: 'waterfront', label: 'Waterfront' },
  { value: 'region', label: 'Region' },
  { value: 'saleCondition', label: 'Sale Condition' },
  { value: 'daysOnMarket', label: 'Days on Market' },
  { value: 'articleLink', label: 'Article Link' },
  { value: 'acreage', label: 'Acreage' },
  { value: 'leasedLand', label: 'Leased Land' },
  { value: 'buyerName', label: 'Buyer Name' },
  { value: 'sellerName', label: 'Seller Name' },
  { value: 'brokerName', label: 'Broker Name' },
  { value: 'comments', label: 'Comments' },
  { value: 'parentPortfolioId', label: 'Portfolio' },
];

export default function ColumnMapperSimple({
  analysis,
  mapping,
  onMappingChange
}: ColumnMapperSimpleProps) {
  const { toast } = useToast();
  const [showNewColumnDialog, setShowNewColumnDialog] = useState(false);
  const [pendingColumnName, setPendingColumnName] = useState<string>("");
  const [newColumnData, setNewColumnData] = useState({
    key: '',
    label: '',
    type: 'text' as 'text' | 'number' | 'currency' | 'percent' | 'date' | 'boolean' | 'select',
    options: [] as string[]
  });
  const [newOptionInput, setNewOptionInput] = useState('');

  // Fetch custom columns for this org
  const { data: customColumns = [] } = useQuery<any[]>({
    queryKey: ['/api/rate-comps/columns'],
  });

  // Combine standard and custom fields
  const allFields = [
    ...STANDARD_FIELDS,
    ...customColumns.map(col => ({
      value: col.key,
      label: col.label,
      custom: true
    }))
  ];

  // Create new column mutation
  const createColumnMutation = useMutation({
    mutationFn: async (columnData: typeof newColumnData) => {
      return await apiRequest('POST', '/api/rate-comps/columns', columnData);
    },
    onSuccess: async (newColumn) => {
      // Invalidate and wait for the query to refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/rate-comps/columns'] });
      await queryClient.refetchQueries({ queryKey: ['/api/rate-comps/columns'] });
      
      // Auto-map the new column to the pending CSV column
      if (pendingColumnName) {
        const newMapping = { ...mapping, [pendingColumnName]: newColumn.key };
        onMappingChange(newMapping);
      }
      
      toast({
        title: "Column Created",
        description: `"${newColumn.label}" has been added and mapped`,
      });
      
      setShowNewColumnDialog(false);
      setPendingColumnName("");
      setNewColumnData({ key: '', label: '', type: 'text', options: [] });
      setNewOptionInput('');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create column",
        variant: "destructive",
      });
    },
  });

  const handleMappingChange = (csvColumn: string, targetField: string) => {
    if (targetField === '__CREATE_NEW__') {
      setPendingColumnName(csvColumn);
      setNewColumnData({
        key: csvColumn.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        label: csvColumn,
        type: 'text',
        options: []
      });
      setShowNewColumnDialog(true);
    } else if (targetField === '__SKIP__') {
      // Remove from mapping to skip this column
      const newMapping = { ...mapping };
      delete newMapping[csvColumn];
      onMappingChange(newMapping);
    } else {
      const newMapping = { ...mapping };
      newMapping[csvColumn] = targetField;
      onMappingChange(newMapping);
    }
  };

  const handleCreateColumn = () => {
    if (!newColumnData.key || !newColumnData.label) {
      toast({
        title: "Validation Error",
        description: "Please provide both a field key and label",
        variant: "destructive",
      });
      return;
    }
    
    if (newColumnData.type === 'select' && newColumnData.options.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one option for the dropdown",
        variant: "destructive",
      });
      return;
    }
    
    createColumnMutation.mutate(newColumnData);
  };

  const handleAddOption = () => {
    if (newOptionInput.trim()) {
      setNewColumnData(prev => ({
        ...prev,
        options: [...prev.options, newOptionInput.trim()]
      }));
      setNewOptionInput('');
    }
  };

  const handleRemoveOption = (index: number) => {
    setNewColumnData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  // Check if a field is auto-suggested (high confidence)
  const isAutoSuggested = (csvColumn: string): boolean => {
    const suggestion = analysis.suggestions?.[csvColumn];
    return suggestion && suggestion.confidence >= 0.8;
  };

  // Get sample data for preview
  const getSampleData = (csvColumn: string): string => {
    const preview = analysis.preview?.find(row => row[csvColumn]);
    return preview?.[csvColumn] || '';
  };

  const mappedCount = Object.keys(mapping).filter(k => mapping[k]).length;
  const totalColumns = analysis.headers?.length || 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Map CSV Columns</CardTitle>
              <CardDescription>
                Match your CSV columns to Vantage fields. Auto-detected mappings are pre-filled.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{mappedCount}/{totalColumns}</div>
              <div className="text-xs text-muted-foreground">Columns Mapped</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.headers?.map((csvColumn) => {
              const currentMapping = mapping[csvColumn] || '';
              const isAutoMapped = isAutoSuggested(csvColumn);
              const sampleData = getSampleData(csvColumn);

              return (
                <div key={csvColumn} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Label className="font-medium text-sm">{csvColumn}</Label>
                      {isAutoMapped && currentMapping && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Auto-matched
                        </Badge>
                      )}
                      {currentMapping && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    {sampleData && (
                      <div className="text-xs text-muted-foreground truncate">
                        Example: {sampleData}
                      </div>
                    )}
                  </div>
                  
                  <div className="w-64">
                    <Select
                      value={currentMapping}
                      onValueChange={(value) => handleMappingChange(csvColumn, value)}
                    >
                      <SelectTrigger data-testid={`select-mapping-${csvColumn}`}>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__SKIP__" className="text-muted-foreground">
                          Do not import
                        </SelectItem>
                        {allFields.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                            {field.required && ' *'}
                          </SelectItem>
                        ))}
                        <SelectItem value="__CREATE_NEW__" className="text-blue-600 font-medium">
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Create New Column...
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create New Column Dialog */}
      <Dialog open={showNewColumnDialog} onOpenChange={setShowNewColumnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Column</DialogTitle>
            <DialogDescription>
              Add a custom field to your rate comps database. This column will be available for all future imports.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="field-key">Field Key *</Label>
              <Input
                id="field-key"
                placeholder="e.g., parking_spaces"
                value={newColumnData.key}
                onChange={(e) => setNewColumnData(prev => ({ 
                  ...prev, 
                  key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') 
                }))}
                data-testid="input-new-column-key"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier (lowercase, underscores only)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-label">Display Label *</Label>
              <Input
                id="field-label"
                placeholder="e.g., Parking Spaces"
                value={newColumnData.label}
                onChange={(e) => setNewColumnData(prev => ({ ...prev, label: e.target.value }))}
                data-testid="input-new-column-label"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="field-type">Data Type</Label>
              <Select
                value={newColumnData.type}
                onValueChange={(value: any) => setNewColumnData(prev => ({ ...prev, type: value, options: [] }))}
              >
                <SelectTrigger id="field-type" data-testid="select-new-column-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="currency">Currency</SelectItem>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="boolean">Yes/No</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dropdown Options Input */}
          {newColumnData.type === 'select' && (
            <div className="space-y-3">
              <Label>Dropdown Options</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add an option..."
                  value={newOptionInput}
                  onChange={(e) => setNewOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                  data-testid="input-dropdown-option"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddOption}
                  disabled={!newOptionInput.trim()}
                  data-testid="button-add-option"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {newColumnData.options.length > 0 && (
                <div className="space-y-2">
                  {newColumnData.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded border bg-muted">
                      <span className="flex-1 text-sm">{option}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(index)}
                        data-testid={`button-remove-option-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {newColumnData.options.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add at least one option for the dropdown
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewColumnDialog(false);
                setPendingColumnName("");
                setNewColumnData({ key: '', label: '', type: 'text', options: [] });
                setNewOptionInput('');
              }}
              data-testid="button-cancel-new-column"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateColumn}
              disabled={!newColumnData.key || !newColumnData.label || createColumnMutation.isPending}
              data-testid="button-create-new-column"
            >
              {createColumnMutation.isPending ? "Creating..." : "Create & Map"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
