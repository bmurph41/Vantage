import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, X, ArrowRight, CheckCircle, AlertCircle, Target, 
  Eye, EyeOff, Filter, Lightbulb, TrendingUp, Grip,
  Check, AlertTriangle, Info, Wand2, RotateCcw
} from "lucide-react";
import type { FileAnalysis, FieldConfig, BulkMappingAction } from '@/lib/salescomps/types';
import { useColumnMapper } from '@/hooks/salescomps/useColumnMapper';
import { 
  getTypeIcon, 
  getConfidenceColor, 
  getConfidenceLabel, 
  getQualityIndicator, 
  getBestExample,
  CONFIDENCE_LEVELS
} from '@/lib/salescomps/mappingUtils';

interface ColumnMapperProps {
  analysis: FileAnalysis;
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
  normalization: {
    currency: boolean;
    months: boolean;
    states: boolean;
    undisclosed: boolean;
  };
  onNormalizationChange: (normalization: any) => void;
}

export default function ColumnMapper({
  analysis,
  mapping,
  onMappingChange,
  normalization,
  onNormalizationChange
}: ColumnMapperProps) {
  const { toast } = useToast();
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomField, setNewCustomField] = useState({ key: '', label: '', type: 'text' });
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const dragImageRef = useRef<HTMLDivElement>(null);

  const {
    state,
    allTargetFields,
    mappingSummary,
    filteredHeaders,
    unmappedHeaders,
    updateMapping: originalUpdateMapping,
    clearMapping: originalClearMapping,
    clearAllMappings: originalClearAllMappings,
    applyBulkMappingAction,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
    addCustomField: addCustomFieldHook,
    removeCustomField,
    togglePreview,
    setConfidenceFilter,
    setHighlightUnmapped,
    isFieldMapped,
    getSourceForField,
    getMappingForColumn
  } = useColumnMapper({
    analysis,
    initialMapping: mapping,
    onMappingChange
  });

  // Clean up state when mappings change
  const cleanupStaleState = () => {
    const currentMappedFields = Object.values(state.mapping);
    
    // Clean up column order - remove fields that are no longer mapped
    setColumnOrder(prev => prev.filter(fieldKey => currentMappedFields.includes(fieldKey)));
    
    // Clean up hidden columns - remove fields that are no longer mapped
    setHiddenColumns(prev => {
      const newHidden = new Set(prev);
      for (const fieldKey of Array.from(prev)) {
        if (!currentMappedFields.includes(fieldKey)) {
          newHidden.delete(fieldKey);
        }
      }
      return newHidden;
    });
  };

  // Create wrapper functions that include cleanup
  const updateMapping = (column: string, field: string) => {
    originalUpdateMapping(column, field);
    cleanupStaleState();
  };

  const clearMapping = (column: string) => {
    originalClearMapping(column);
    cleanupStaleState();
  };

  const clearAllMappings = () => {
    originalClearAllMappings();
    setColumnOrder([]);
    setHiddenColumns(new Set());
  };

  // Custom field management
  const handleAddCustomField = () => {
    if (!newCustomField.key || !newCustomField.label) return;
    
    const key = newCustomField.key.replace(/[^a-zA-Z0-9_]/g, '');
    if (!key) return;
    
    addCustomFieldHook({ ...newCustomField, key });
    setNewCustomField({ key: '', label: '', type: 'text' });
    setShowAddCustom(false);
  };

  // Bulk actions
  const handleBulkAction = (action: BulkMappingAction) => {
    applyBulkMappingAction(action);
    cleanupStaleState();
  };

  // Column selection for bulk actions
  const handleColumnSelect = (column: string, selected: boolean) => {
    setSelectedColumns(prev => 
      selected 
        ? [...prev, column]
        : prev.filter(c => c !== column)
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(analysis.headers);
  };

  const clearColumnSelection = () => {
    setSelectedColumns([]);
  };

  // Drag and drop with visual feedback
  const handleColumnDragStart = (e: React.DragEvent, column: string) => {
    e.dataTransfer.setData('text/plain', column);
    e.dataTransfer.effectAllowed = 'move';
    handleDragStart(column);
    
    // Create custom drag image
    if (dragImageRef.current) {
      const dragImage = dragImageRef.current.cloneNode(true) as HTMLElement;
      dragImage.style.transform = 'rotate(5deg)';
      dragImage.style.opacity = '0.8';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 10, 10);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  const handleFieldDragOver = (e: React.DragEvent, fieldKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    handleDragOver(fieldKey);
  };

  const handleFieldDrop = (e: React.DragEvent, fieldKey: string) => {
    e.preventDefault();
    const column = e.dataTransfer.getData('text/plain');
    if (column) {
      handleDrop(fieldKey);
    }
  };

  // Render mapping summary header
  const renderMappingSummary = () => (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Mapping Overview</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              checked={state.showPreview}
              onCheckedChange={togglePreview}
              data-testid="switch-preview"
            />
            <Label htmlFor="preview-switch" className="text-sm">Preview</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllMappings}
              data-testid="button-clear-all"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{mappingSummary.mapped}</div>
            <div className="text-sm text-muted-foreground">Mapped</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{mappingSummary.unmapped}</div>
            <div className="text-sm text-muted-foreground">Unmapped</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{mappingSummary.highConfidence}</div>
            <div className="text-sm text-muted-foreground">High Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {mappingSummary.requiredFields - mappingSummary.mappedRequiredFields}
            </div>
            <div className="text-sm text-muted-foreground">Missing Required</div>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm">Progress</Label>
            <span className="text-sm text-muted-foreground">
              {mappingSummary.mapped} / {mappingSummary.total}
            </span>
          </div>
          <Progress 
            value={(mappingSummary.mapped / mappingSummary.total) * 100} 
            className="h-2"
          />
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction({ type: 'accept_high_confidence', confidence_threshold: CONFIDENCE_LEVELS.HIGH })}
            data-testid="button-accept-high-confidence"
          >
            <Wand2 className="h-4 w-4 mr-1" />
            Accept High Confidence
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction({ type: 'accept_all' })}
            data-testid="button-accept-all"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Accept All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction({ type: 'reject_all' })}
            data-testid="button-reject-all"
          >
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Render confidence filter
  const renderConfidenceFilter = () => (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-center gap-4">
          <Label className="text-sm">Filter by Confidence:</Label>
          <div className="flex-1">
            <Slider
              value={[state.filterByConfidence]}
              onValueChange={([value]) => setConfidenceFilter(value)}
              max={1}
              min={0}
              step={0.1}
              className="w-full"
              data-testid="slider-confidence-filter"
            />
          </div>
          <Badge variant="outline" className="min-w-fit">
            {Math.round(state.filterByConfidence * 100)}%
          </Badge>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Any</span>
          <span>High</span>
        </div>
      </CardContent>
    </Card>
  );

  // Data preview functions
  const getMappedColumns = (): { sourceColumn: string; targetField: string; targetLabel: string }[] => {
    const mappedCols = Object.entries(state.mapping).map(([sourceColumn, targetField]) => {
      const field = allTargetFields.find(f => f.key === targetField);
      return {
        sourceColumn,
        targetField,
        targetLabel: field?.label || targetField
      };
    });
    
    // Apply column ordering if set
    if (columnOrder.length > 0) {
      return columnOrder
        .map(fieldKey => mappedCols.find(col => col.targetField === fieldKey))
        .filter(Boolean) as typeof mappedCols;
    }
    
    return mappedCols;
  };

  const getPreviewData = () => {
    const mappedCols = getMappedColumns();
    return analysis.sampleRows.slice(0, 5).map((row, index) => {
      const transformedRow: Record<string, any> = { _rowIndex: index };
      
      mappedCols.forEach(({ sourceColumn, targetField, targetLabel }) => {
        if (!hiddenColumns.has(targetField)) {
          // Use targetField as canonical key to prevent collisions
          transformedRow[targetField] = {
            value: row[sourceColumn] || '',
            label: targetLabel,
            sourceColumn
          };
        }
      });
      
      return transformedRow;
    });
  };

  const handleColumnReorder = (fromIndex: number, toIndex: number) => {
    const mappedCols = getMappedColumns();
    const newOrder = [...(columnOrder.length > 0 ? columnOrder : mappedCols.map(c => c.targetField))];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    setColumnOrder(newOrder);
  };

  const toggleColumnVisibility = (targetField: string) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(targetField)) {
      newHidden.delete(targetField);
    } else {
      newHidden.add(targetField);
    }
    setHiddenColumns(newHidden);
  };

  const handleApproveMapping = () => {
    // Validation: check if required fields are mapped
    const requiredFields = allTargetFields.filter(f => f.required);
    const unmappedRequired = requiredFields.filter(f => !isFieldMapped(f.key));
    
    if (unmappedRequired.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please map the following required fields: ${unmappedRequired.map(f => f.label).join(', ')}`,
        variant: "destructive"
      });
      return;
    }
    
    // Show success and trigger next step
    toast({
      title: "Mapping Approved",
      description: `Successfully mapped ${Object.keys(state.mapping).length} columns`,
      variant: "default"
    });
    
    // Could trigger next step in upload process
    console.log('Mapping approved:', state.mapping);
  };

  const handleDeclineMapping = () => {
    clearAllMappings();
    toast({
      title: "Mapping Reset",
      description: "All column mappings have been cleared",
      variant: "default"
    });
  };

  // Render source column
  const renderSourceColumn = (column: string) => {
    const suggestion = state.suggestions[column];
    const isMapped = getMappingForColumn(column);
    const quality = analysis.dataQuality[column];
    const qualityIndicator = quality ? getQualityIndicator(quality) : null;
    const bestExample = getBestExample(analysis.sampleRows, column);

    return (
      <Card 
        key={column}
        className={`border transition-all duration-200 cursor-move ${
          state.dragDrop.draggedColumn === column ? 'opacity-50 scale-95' : ''
        } ${isMapped ? 'border-blue-200 bg-blue-50/50' : 'hover:border-blue-300'}`}
        draggable
        onDragStart={(e) => handleColumnDragStart(e, column)}
        onDragEnd={handleDragEnd}
        data-testid={`source-column-${column}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Grip className="h-5 w-5 text-muted-foreground mt-1 cursor-move" />
            
            <div className="flex-1 min-w-0">
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm truncate">{column}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {getTypeIcon(analysis.columnTypes[column])}
                  {analysis.columnTypes[column]}
                </Badge>
                {isMapped && (
                  <Badge variant="default" className="text-xs">
                    Mapped
                  </Badge>
                )}
              </div>

              {/* Data Quality & Examples */}
              {qualityIndicator && (
                <div className="flex items-center gap-2 mb-2">
                  <div className={`text-xs ${qualityIndicator.color}`}>
                    {qualityIndicator.label} Quality
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round(quality.completeness * 100)}% complete
                  </div>
                </div>
              )}

              {bestExample && (
                <div className="text-xs text-muted-foreground mb-2">
                  Example: "{bestExample}"
                </div>
              )}

              {/* Mapping Suggestion */}
              {suggestion && suggestion.confidence > 0 && (
                <div className="space-y-2">
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    getConfidenceColor(suggestion.confidence)
                  }`}>
                    <Target className="h-3 w-3" />
                    {getConfidenceLabel(suggestion.confidence)} ({Math.round(suggestion.confidence * 100)}%)
                  </div>
                  
                  {suggestion.targetField && (
                    <div className="text-xs">
                      <div className="font-medium">Suggested: {
                        allTargetFields.find(f => f.key === suggestion.targetField)?.label
                      }</div>
                      {suggestion.reasons.length > 0 && (
                        <div className="text-muted-foreground mt-1">
                          {suggestion.reasons.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-1">
                    {suggestion.targetField && !isMapped && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => updateMapping(column, suggestion.targetField)}
                        data-testid={`button-accept-suggestion-${column}`}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Accept
                      </Button>
                    )}
                    {isMapped && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => clearMapping(column)}
                        data-testid={`button-clear-mapping-${column}`}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Current Mapping Display */}
              {isMapped && (
                <div className="mt-2 p-2 bg-blue-50 rounded border">
                  <div className="text-xs font-medium text-blue-800">
                    Mapped to: {allTargetFields.find(f => f.key === isMapped)?.label}
                  </div>
                  {state.showPreview && state.previewData[column] && (
                    <div className="mt-1 text-xs">
                      <div className="text-muted-foreground">Preview:</div>
                      {state.previewData[column].sampleTransformation.slice(0, 2).map((sample, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-muted-foreground">"{sample.original}"</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className={sample.isValid ? 'text-green-600' : 'text-red-600'}>
                            "{sample.transformed}"
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render target field
  const renderTargetField = (field: FieldConfig) => {
    const sourceColumn = getSourceForField(field.key);
    const isMapped = !!sourceColumn;
    const isDragTarget = state.dragDrop.dropTarget === field.key;

    return (
      <Card 
        key={field.key}
        className={`border transition-all duration-200 ${
          isMapped ? 'border-green-200 bg-green-50/50' : ''
        } ${isDragTarget ? 'border-blue-400 bg-blue-100 scale-105' : ''} ${
          state.dragDrop.isDragging ? 'hover:border-blue-400 hover:bg-blue-50' : ''
        }`}
        onDragOver={(e) => handleFieldDragOver(e, field.key)}
        onDrop={(e) => handleFieldDrop(e, field.key)}
        data-testid={`target-field-${field.key}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Field Header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">{field.label}</span>
                {field.required && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
                {field.type && (
                  <Badge variant="secondary" className="text-xs">
                    {getTypeIcon(field.type)}
                  </Badge>
                )}
                {isMapped && (
                  <Badge className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Mapped
                  </Badge>
                )}
              </div>

              {/* Field Description */}
              {field.description && (
                <div className="text-xs text-muted-foreground mb-2">
                  {field.description}
                </div>
              )}

              {/* Current Mapping */}
              {isMapped ? (
                <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                  <div className="text-xs font-medium text-green-800">
                    ← {sourceColumn}
                  </div>
                  {state.showPreview && state.previewData[sourceColumn] && (
                    <div className="mt-1 text-xs">
                      {state.previewData[sourceColumn].validation.warnings.map((warning, idx) => (
                        <div key={idx} className="text-yellow-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {warning}
                        </div>
                      ))}
                      {state.previewData[sourceColumn].validation.errors.map((error, idx) => (
                        <div key={idx} className="text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 p-3 border-2 border-dashed border-muted-foreground/30 rounded text-center">
                  <div className="text-xs text-muted-foreground">
                    Drop column here or select from dropdown
                  </div>
                </div>
              )}
            </div>

            {/* Field Actions */}
            <div className="ml-2">
              <Select
                value={sourceColumn || ''}
                onValueChange={(value) => {
                  if (value === 'none') {
                    if (sourceColumn) {
                      clearMapping(sourceColumn);
                    }
                  } else {
                    updateMapping(value, field.key);
                  }
                }}
              >
                <SelectTrigger className="w-32" data-testid={`select-mapping-${field.key}`}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {analysis.headers.map((column: string) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Drag Image Template */}
      <div
        ref={dragImageRef}
        className="fixed -top-96 left-0 opacity-0 pointer-events-none z-50"
      >
        <Card className="p-2 bg-blue-100 border-blue-300">
          <div className="text-sm font-medium">Dragging column...</div>
        </Card>
      </div>

      {/* Mapping Summary */}
      {renderMappingSummary()}

      {/* Confidence Filter */}
      {renderConfidenceFilter()}

      {/* Main Mapping Interface - New Connection-Based Layout */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Column Mapping
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Connect your file columns to MarinaMatch fields. Drag from file columns to fields or use the dropdowns.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header Row */}
          <div className="grid grid-cols-5 gap-4 items-center text-sm font-medium text-muted-foreground border-b pb-2">
            <div>Your File Column</div>
            <div className="text-center">Connection</div>
            <div>MarinaMatch Field</div>
            <div className="text-center">Status</div>
            <div>Actions</div>
          </div>

          {/* Mapped Connections */}
          {Object.entries(state.mapping).map(([sourceColumn, targetField]) => {
            const field = allTargetFields.find(f => f.key === targetField);
            const suggestion = state.suggestions[sourceColumn];
            const quality = analysis.dataQuality[sourceColumn];
            const bestExample = getBestExample(analysis.sampleRows, sourceColumn);
            
            return (
              <div key={`mapped-${sourceColumn}-${targetField}`} className="grid grid-cols-5 gap-4 items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                {/* Source Column */}
                <div className="space-y-1">
                  <div className="font-medium text-sm">{sourceColumn}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {getTypeIcon(analysis.columnTypes[sourceColumn])}
                      {analysis.columnTypes[sourceColumn]}
                    </Badge>
                    {quality && (
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(quality.completeness * 100)}% complete
                      </Badge>
                    )}
                  </div>
                  {bestExample && (
                    <div className="text-xs text-muted-foreground">
                      Example: "{bestExample}"
                    </div>
                  )}
                </div>

                {/* Connection Indicator */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-1">
                    <div className="w-8 h-0.5 bg-green-500"></div>
                    <ArrowRight className="h-4 w-4 text-green-500" />
                    <div className="w-8 h-0.5 bg-green-500"></div>
                  </div>
                </div>

                {/* Target Field */}
                <div className="space-y-1">
                  <div className="font-medium text-sm">{field?.label || targetField}</div>
                  <div className="flex items-center gap-2">
                    {field?.required && (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    )}
                    {field?.type && (
                      <Badge variant="secondary" className="text-xs">
                        {getTypeIcon(field.type)}
                      </Badge>
                    )}
                    <Badge variant="default" className="text-xs">Mapped</Badge>
                  </div>
                  {field?.description && (
                    <div className="text-xs text-muted-foreground">
                      {field.description}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="text-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                  <div className="text-xs text-green-600 mt-1">Connected</div>
                  {suggestion && suggestion.confidence > 0 && (
                    <div className="text-xs mt-1">
                      <Badge className={`${getConfidenceColor(suggestion.confidence)} text-xs`}>
                        {Math.round(suggestion.confidence * 100)}% match
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => clearMapping(sourceColumn)}
                    data-testid={`button-disconnect-${sourceColumn}`}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Disconnect
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Show ALL columns if none are mapped yet, or just unmapped ones if some are already mapped */}
          {(Object.keys(state.mapping).length === 0 ? analysis.headers : unmappedHeaders).length > 0 && (
            <>
              {Object.keys(state.mapping).length > 0 && <Separator />}
              <div className="space-y-2">
                <h5 className="font-medium text-sm text-muted-foreground">
                  {Object.keys(state.mapping).length === 0 ? 'Your File Columns - Ready to Map' : 'Unmapped File Columns'}
                </h5>
                {(Object.keys(state.mapping).length === 0 ? analysis.headers : unmappedHeaders).map(column => {
                  const suggestion = state.suggestions[column];
                  const quality = analysis.dataQuality[column];
                  const bestExample = getBestExample(analysis.sampleRows, column);
                  
                  return (
                    <div key={`unmapped-${column}`} className="grid grid-cols-5 gap-4 items-center p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      {/* Source Column */}
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{column}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getTypeIcon(analysis.columnTypes[column])}
                            {analysis.columnTypes[column]}
                          </Badge>
                          {quality && (
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(quality.completeness * 100)}% complete
                            </Badge>
                          )}
                        </div>
                        {bestExample && (
                          <div className="text-xs text-muted-foreground">
                            Example: "{bestExample}"
                          </div>
                        )}
                      </div>

                      {/* Connection Placeholder */}
                      <div className="flex justify-center">
                        <div className="flex items-center gap-1 opacity-30">
                          <div className="w-8 h-0.5 bg-muted-foreground"></div>
                          <div className="w-2 h-2 border-2 border-muted-foreground rounded-full"></div>
                          <div className="w-8 h-0.5 bg-muted-foreground"></div>
                        </div>
                      </div>

                      {/* Target Field Selector */}
                      <div>
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (value === 'create-custom') {
                              setNewCustomField({ 
                                key: column.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''), 
                                label: column, 
                                type: analysis.columnTypes[column] === 'number' ? 'number' : 'text' 
                              });
                              setShowAddCustom(true);
                            } else if (value) {
                              updateMapping(column, value);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full" data-testid={`select-target-${column}`}>
                            <SelectValue placeholder="Select MarinaMatch field..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create-custom">
                              <div className="flex items-center gap-2">
                                <Plus className="h-3 w-3" />
                                Create new field "{column}"
                              </div>
                            </SelectItem>
                            {allTargetFields
                              .filter(f => !isFieldMapped(f.key))
                              .map(field => (
                                <SelectItem key={field.key} value={field.key}>
                                  <div className="flex items-center gap-2">
                                    {field.required && (
                                      <Badge variant="destructive" className="text-xs">Required</Badge>
                                    )}
                                    {field.label}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Status */}
                      <div className="text-center">
                        <AlertCircle className="h-5 w-5 text-orange-500 mx-auto" />
                        <div className="text-xs text-orange-600 mt-1">Unmapped</div>
                        {suggestion && suggestion.confidence > 0 && (
                          <div className="text-xs mt-1">
                            <Badge className={`${getConfidenceColor(suggestion.confidence)} text-xs`}>
                              Suggests: {allTargetFields.find(f => f.key === suggestion.targetField)?.label}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1">
                        {suggestion && suggestion.targetField && !isFieldMapped(suggestion.targetField) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateMapping(column, suggestion.targetField)}
                            data-testid={`button-accept-suggestion-${column}`}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Accept
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Available MarinaMatch Fields */}
          {allTargetFields.filter(f => !isFieldMapped(f.key)).length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h5 className="font-medium text-sm text-muted-foreground">Available MarinaMatch Fields</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allTargetFields
                    .filter(f => !isFieldMapped(f.key))
                    .map(field => (
                      <Card key={`available-${field.key}`} className="border-muted">
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{field.label}</span>
                              {field.required && (
                                <Badge variant="destructive" className="text-xs">Required</Badge>
                              )}
                            </div>
                            {field.description && (
                              <div className="text-xs text-muted-foreground">
                                {field.description}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              {field.type && (
                                <Badge variant="secondary" className="text-xs">
                                  {getTypeIcon(field.type)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            </>
          )}

          {/* Create Custom Field Section */}
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-sm">Custom Fields</h5>
              {!showAddCustom && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCustom(true)}
                  data-testid="button-show-add-custom-field"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Field
                </Button>
              )}
            </div>

            {showAddCustom && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-sm">Field Key</Label>
                        <Input
                          placeholder="e.g., customPrice"
                          value={newCustomField.key}
                          onChange={(e) => setNewCustomField(prev => ({ 
                            ...prev, 
                            key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') 
                          }))}
                          className="mt-1"
                          data-testid="input-custom-field-key"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Display Label</Label>
                        <Input
                          placeholder="e.g., Custom Price"
                          value={newCustomField.label}
                          onChange={(e) => setNewCustomField(prev => ({ ...prev, label: e.target.value }))}
                          className="mt-1"
                          data-testid="input-custom-field-label"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Field Type</Label>
                        <Select
                          value={newCustomField.type}
                          onValueChange={(value) => setNewCustomField(prev => ({ ...prev, type: value }))}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-custom-field-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="currency">Currency</SelectItem>
                            <SelectItem value="percent">Percent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleAddCustomField}
                        disabled={!newCustomField.key || !newCustomField.label}
                        data-testid="button-add-custom-field"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create Field
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setShowAddCustom(false);
                          setNewCustomField({ key: '', label: '', type: 'text' });
                        }}
                        data-testid="button-cancel-custom-field"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Custom Fields List */}
            {state.customFields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {state.customFields.map((field, index) => (
                  <Card key={`custom-field-${field.key}-${index}`} className="border-accent">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{field.label}</span>
                            <Badge variant="outline" className="text-xs">Custom</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {getTypeIcon(field.type)}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomField(field.key)}
                          data-testid={`button-remove-custom-${field.key}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Preview Section */}
      {Object.keys(state.mapping).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Data Preview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePreview}
                  data-testid="button-toggle-preview"
                >
                  {state.showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {state.showPreview ? 'Hide' : 'Show'} Preview
                </Button>
              </div>
            </div>
            {state.showPreview && (
              <p className="text-sm text-muted-foreground">
                This shows how your data will look after mapping. You can reorder columns and approve the mapping.
              </p>
            )}
          </CardHeader>
          {state.showPreview && (
            <CardContent>
              <div className="space-y-4">
                {/* Preview Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {getMappedColumns().length} columns mapped
                    </Badge>
                    <Badge variant="outline">
                      {analysis.sampleRows.length} sample rows
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeclineMapping}
                      data-testid="button-decline-mapping"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleApproveMapping}
                      disabled={allTargetFields.filter(f => f.required).some(f => !isFieldMapped(f.key))}
                      data-testid="button-approve-mapping"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve Mapping
                    </Button>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          {getMappedColumns().map(({ targetField, targetLabel }, index) => (
                            <th
                              key={targetField}
                              className="px-4 py-3 text-left text-sm font-medium border-b cursor-move"
                              data-testid={`preview-header-${targetField}`}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', index.toString());
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                const toIndex = index;
                                if (fromIndex !== toIndex) {
                                  handleColumnReorder(fromIndex, toIndex);
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <span>{targetLabel}</span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleColumnVisibility(targetField)}
                                    data-testid={`button-toggle-column-${targetField}`}
                                  >
                                    {hiddenColumns.has(targetField) ? 
                                      <EyeOff className="h-3 w-3" /> : 
                                      <Eye className="h-3 w-3" />
                                    }
                                  </Button>
                                  <Grip className="h-3 w-3 text-muted-foreground cursor-move" data-testid={`drag-handle-${targetField}`} />
                                </div>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getPreviewData().map((row, rowIndex) => (
                          <tr 
                            key={rowIndex}
                            className="border-b last:border-b-0 hover:bg-muted/25"
                            data-testid={`preview-row-${rowIndex}`}
                          >
                            {getMappedColumns().map(({ targetField, targetLabel }) => (
                              <td
                                key={`${rowIndex}-${targetField}`}
                                className="px-4 py-3 text-sm"
                                data-testid={`preview-cell-${rowIndex}-${targetField}`}
                              >
                                <div className="max-w-xs truncate">
                                  {row[targetField]?.value || '-'}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Column Management */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Info className="h-3 w-3 mr-1" />
                    Drag column headers to reorder
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    Click eye icon to show/hide columns
                  </Badge>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Normalization Options */}
      <Card>
        <CardHeader>
          <CardTitle>Normalization Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="normalize-currency"
                checked={normalization.currency}
                onCheckedChange={(checked) => 
                  onNormalizationChange({ ...normalization, currency: checked })
                }
                data-testid="checkbox-normalize-currency"
              />
              <Label htmlFor="normalize-currency" className="text-sm">
                Strip currency symbols and commas
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="normalize-months"
                checked={normalization.months}
                onCheckedChange={(checked) => 
                  onNormalizationChange({ ...normalization, months: checked })
                }
                data-testid="checkbox-normalize-months"
              />
              <Label htmlFor="normalize-months" className="text-sm">
                Convert month names to numbers
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="normalize-states"
                checked={normalization.states}
                onCheckedChange={(checked) => 
                  onNormalizationChange({ ...normalization, states: checked })
                }
                data-testid="checkbox-normalize-states"
              />
              <Label htmlFor="normalize-states" className="text-sm">
                Convert states to 2-letter codes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="handle-undisclosed"
                checked={normalization.undisclosed}
                onCheckedChange={(checked) => 
                  onNormalizationChange({ ...normalization, undisclosed: checked })
                }
                data-testid="checkbox-handle-undisclosed"
              />
              <Label htmlFor="handle-undisclosed" className="text-sm">
                Handle "Undisclosed" values
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}