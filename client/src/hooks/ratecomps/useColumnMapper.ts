import { useState, useCallback, useMemo } from 'react';
import type { 
  ColumnMapperState,
  FileAnalysis,
  MappingSuggestion,
  MappingPreview,
  DragDropState,
  FieldConfig,
  BulkMappingAction
} from '@/lib/ratecomps/types';
import { 
  STANDARD_FIELDS, 
  generateMappingPreview, 
  applyBulkAction,
  getMappingSummary 
} from '@/lib/ratecomps/mappingUtils';

interface UseColumnMapperProps {
  analysis: FileAnalysis;
  initialMapping?: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

export function useColumnMapper({
  analysis,
  initialMapping = {},
  onMappingChange
}: UseColumnMapperProps) {
  const [state, setState] = useState<ColumnMapperState>({
    mapping: initialMapping || analysis.suggestedMapping || {},
    suggestions: analysis.mappingSuggestions || {},
    previewData: {},
    dragDrop: {
      isDragging: false,
      draggedColumn: null,
      dropTarget: null,
      dragPreview: false
    },
    showPreview: true,
    filterByConfidence: 0,
    highlightUnmapped: false,
    customFields: []
  });

  // Memoized computed values
  const allTargetFields = useMemo(() => [
    ...STANDARD_FIELDS,
    ...state.customFields
  ], [state.customFields]);

  const mappingSummary = useMemo(() => 
    getMappingSummary(analysis.headers, state.mapping, state.suggestions),
    [analysis.headers, state.mapping, state.suggestions]
  );

  const filteredHeaders = useMemo(() => {
    if (state.filterByConfidence === 0) return analysis.headers;
    
    return analysis.headers.filter(header => {
      const suggestion = state.suggestions[header];
      return suggestion && suggestion.confidence >= state.filterByConfidence;
    });
  }, [analysis.headers, state.suggestions, state.filterByConfidence]);

  const unmappedHeaders = useMemo(() => 
    analysis.headers.filter(header => !state.mapping[header]),
    [analysis.headers, state.mapping]
  );

  const mappedFields = useMemo(() => 
    Object.values(state.mapping),
    [state.mapping]
  );

  // Mapping management
  const updateMapping = useCallback((sourceColumn: string, targetField: string) => {
    setState(prev => {
      const newMapping = { ...prev.mapping };
      
      // Remove this target field from any existing mappings
      Object.keys(newMapping).forEach(key => {
        if (newMapping[key] === targetField) {
          delete newMapping[key];
        }
      });
      
      // Set new mapping
      if (targetField && targetField !== 'none') {
        newMapping[sourceColumn] = targetField;
      } else {
        delete newMapping[sourceColumn];
      }
      
      // Update preview data if preview is enabled
      const newPreviewData = prev.showPreview ? {
        ...prev.previewData
      } : prev.previewData;
      
      // Add or remove preview data for this specific column
      if (prev.showPreview && targetField) {
        newPreviewData[sourceColumn] = generateMappingPreview(
          sourceColumn,
          targetField,
          analysis.sampleRows,
          allTargetFields.find(f => f.key === targetField)?.type || 'text'
        );
      } else if (prev.showPreview) {
        delete newPreviewData[sourceColumn];
      }

      const newState = {
        ...prev,
        mapping: newMapping,
        previewData: newPreviewData
      };

      onMappingChange(newMapping);
      return newState;
    });
  }, [analysis.sampleRows, allTargetFields, onMappingChange]);

  const clearMapping = useCallback((sourceColumn: string) => {
    updateMapping(sourceColumn, '');
  }, [updateMapping]);

  const clearAllMappings = useCallback(() => {
    setState(prev => {
      const newState = {
        ...prev,
        mapping: {},
        previewData: {}
      };
      onMappingChange({});
      return newState;
    });
  }, [onMappingChange]);

  // Bulk actions
  const applyBulkMappingAction = useCallback((action: BulkMappingAction) => {
    setState(prev => {
      const newMapping = applyBulkAction(action, prev.mapping, prev.suggestions);
      
      // Update preview data for all changed mappings
      const newPreviewData = prev.showPreview ? 
        Object.keys(newMapping).reduce((acc, column) => {
          const targetField = newMapping[column];
          if (targetField) {
            acc[column] = generateMappingPreview(
              column,
              targetField,
              analysis.sampleRows,
              allTargetFields.find(f => f.key === targetField)?.type || 'text'
            );
          }
          return acc;
        }, {} as Record<string, MappingPreview>) 
        : {};

      const newState = {
        ...prev,
        mapping: newMapping,
        previewData: newPreviewData
      };

      onMappingChange(newMapping);
      return newState;
    });
  }, [analysis.sampleRows, allTargetFields, onMappingChange]);

  // Drag and drop handlers
  const handleDragStart = useCallback((sourceColumn: string) => {
    setState(prev => ({
      ...prev,
      dragDrop: {
        ...prev.dragDrop,
        isDragging: true,
        draggedColumn: sourceColumn,
        dragPreview: true
      }
    }));
  }, []);

  const handleDragOver = useCallback((targetField: string) => {
    setState(prev => ({
      ...prev,
      dragDrop: {
        ...prev.dragDrop,
        dropTarget: targetField
      }
    }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setState(prev => {
      const { draggedColumn, dropTarget } = prev.dragDrop;
      
      let newState = {
        ...prev,
        dragDrop: {
          isDragging: false,
          draggedColumn: null,
          dropTarget: null,
          dragPreview: false
        }
      };

      // Apply the mapping if valid drop
      if (draggedColumn && dropTarget) {
        updateMapping(draggedColumn, dropTarget);
      }

      return newState;
    });
  }, [updateMapping]);

  const handleDrop = useCallback((targetField: string) => {
    setState(prev => {
      const { draggedColumn } = prev.dragDrop;
      
      if (draggedColumn) {
        updateMapping(draggedColumn, targetField);
      }

      return {
        ...prev,
        dragDrop: {
          isDragging: false,
          draggedColumn: null,
          dropTarget: null,
          dragPreview: false
        }
      };
    });
  }, [updateMapping]);

  // Custom fields management
  const addCustomField = useCallback((field: FieldConfig) => {
    setState(prev => ({
      ...prev,
      customFields: [...prev.customFields, field]
    }));
  }, []);

  const removeCustomField = useCallback((fieldKey: string) => {
    setState(prev => {
      const newCustomFields = prev.customFields.filter(f => f.key !== fieldKey);
      
      // Remove any mappings to this custom field
      const newMapping = { ...prev.mapping };
      Object.keys(newMapping).forEach(key => {
        if (newMapping[key] === fieldKey) {
          delete newMapping[key];
        }
      });

      const newState = {
        ...prev,
        customFields: newCustomFields,
        mapping: newMapping
      };

      if (Object.keys(newMapping).length !== Object.keys(prev.mapping).length) {
        onMappingChange(newMapping);
      }

      return newState;
    });
  }, [onMappingChange]);

  // UI state management
  const togglePreview = useCallback(() => {
    setState(prev => {
      const showPreview = !prev.showPreview;
      const newPreviewData = showPreview ? 
        Object.keys(prev.mapping).reduce((acc, column) => {
          const targetField = prev.mapping[column];
          if (targetField) {
            acc[column] = generateMappingPreview(
              column,
              targetField,
              analysis.sampleRows,
              allTargetFields.find(f => f.key === targetField)?.type || 'text'
            );
          }
          return acc;
        }, {} as Record<string, MappingPreview>)
        : {};

      return {
        ...prev,
        showPreview,
        previewData: newPreviewData
      };
    });
  }, [analysis.sampleRows, allTargetFields]);

  const setConfidenceFilter = useCallback((threshold: number) => {
    setState(prev => ({
      ...prev,
      filterByConfidence: threshold
    }));
  }, []);

  const setHighlightUnmapped = useCallback((highlight: boolean) => {
    setState(prev => ({
      ...prev,
      highlightUnmapped: highlight
    }));
  }, []);

  // Utility methods
  const isFieldMapped = useCallback((fieldKey: string) => 
    Object.values(state.mapping).includes(fieldKey), 
    [state.mapping]
  );

  const getSourceForField = useCallback((fieldKey: string) => 
    Object.keys(state.mapping).find(key => state.mapping[key] === fieldKey),
    [state.mapping]
  );

  const getMappingForColumn = useCallback((column: string) => 
    state.mapping[column],
    [state.mapping]
  );

  return {
    // State
    state,
    allTargetFields,
    mappingSummary,
    filteredHeaders,
    unmappedHeaders,
    mappedFields,

    // Mapping actions
    updateMapping,
    clearMapping,
    clearAllMappings,
    applyBulkMappingAction,

    // Drag and drop
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,

    // Custom fields
    addCustomField,
    removeCustomField,

    // UI state
    togglePreview,
    setConfidenceFilter,
    setHighlightUnmapped,

    // Utilities
    isFieldMapped,
    getSourceForField,
    getMappingForColumn
  };
}
