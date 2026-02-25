export interface FilterState {
  q: string;
  states: string[];
  regions: string[];
  saleYearMin: string;
  saleYearMax: string;
  priceMin: string;
  priceMax: string;
  capRateMin: string;
  capRateMax: string;
  occupancyMin: string;
  occupancyMax: string;
  wetSlipsMin: string;
  wetSlipsMax: string;
  dryRacksMin: string;
  dryRacksMax: string;
  ioBoth: string;
  disclosedOnly: boolean;
  disclosedCapRateOnly: boolean;
  portfoliosOnly: boolean;
  columnFilters: Record<string, string[]>;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface ColumnMapping {
  source: string;
  target: string;
  type: string;
}

export interface FileUploadState {
  file: File | null;
  analysis: any;
  mapping: Record<string, string>;
  step: 'upload' | 'mapping' | 'processing' | 'complete';
  progress: {
    current: number;
    total: number;
    status: string;
  };
}

export interface BulkEditState {
  selectedIds: string[];
  updates: Record<string, any>;
  isOpen: boolean;
}

export interface EditingCell {
  rowId: string;
  field: string;
  value: any;
  originalValue: any;
}

export interface MappingSuggestion {
  targetField: string;
  confidence: number;
  reasons: string[];
  alternatives: Array<{ field: string; confidence: number }>;
}

export interface DataQuality {
  completeness: number;
  consistency: number;
  examples: string[];
  warnings: string[];
}

export interface FieldConfig {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface DragDropState {
  isDragging: boolean;
  draggedColumn: string | null;
  dropTarget: string | null;
  dragPreview: boolean;
}

export interface MappingPreview {
  sourceColumn: string;
  targetField: string;
  sampleTransformation: Array<{
    original: any;
    transformed: any;
    isValid: boolean;
    warning?: string;
  }>;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface BulkMappingAction {
  type: 'accept_all' | 'reject_all' | 'accept_high_confidence' | 'apply_suggestions';
  confidence_threshold?: number;
  selected_fields?: string[];
}

export interface ColumnMapperState {
  mapping: Record<string, string>;
  suggestions: Record<string, MappingSuggestion>;
  previewData: Record<string, MappingPreview>;
  dragDrop: DragDropState;
  showPreview: boolean;
  filterByConfidence: number;
  highlightUnmapped: boolean;
  customFields: FieldConfig[];
}

export interface FileAnalysis {
  headers: string[];
  sampleRows: Record<string, any>[];
  estimatedRows: number;
  suggestedMapping: Record<string, string>;
  mappingSuggestions: Record<string, MappingSuggestion>;
  columnTypes: Record<string, string>;
  dataQuality: Record<string, DataQuality>;
}

// Import System Types (Constant Contact-style)
export type ImportMode = 'insert' | 'update' | 'upsert';

export interface RowMatchResult {
  rowIndex: number;
  rowData: Record<string, any>;
  matchedCompId?: string;
  matchedComp?: any;
  confidence: number; // 0-1
  matchType: 'exact' | 'fuzzy' | 'none';
  action: 'insert' | 'update' | 'skip';
  reason?: string;
  fieldChanges?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    willUpdate: boolean;
  }>;
}

export interface ImportPlan {
  mode: ImportMode;
  updateBlankValues: boolean;
  rows: RowMatchResult[];
  summary: {
    totalRows: number;
    toInsert: number;
    toUpdate: number;
    toSkip: number;
  };
}

export interface ImportPreviewData {
  toInsert: number;
  toUpdate: number;
  toSkip: number;
  duplicateMatches: Array<{
    row: Record<string, any>;
    match: any;
    confidence: number;
    action: 'insert' | 'update' | 'skip';
    rowIndex: number;
  }>;
  plan: ImportPlan;
}
