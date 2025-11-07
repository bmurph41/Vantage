import { useState, useEffect, useCallback, useMemo } from 'react';

export interface ChartColumn {
  id: string;
  label: string;
  dataKey: string;
  color: string;
  type: 'bar' | 'line' | 'area';
  yAxisId?: 'left' | 'right';
  enabled: boolean;
  order: number;
  formatType?: 'currency' | 'percent' | 'number';
  unit?: string;
}

export interface ChartColumnConfig {
  [chartId: string]: ChartColumn[];
}

export interface UseChartColumnsOptions {
  chartId: string;
  defaultColumns: ChartColumn[];
  storageKey?: string;
  onConfigChange?: (columns: ChartColumn[]) => void;
}

export interface UseChartColumnsReturn {
  columns: ChartColumn[];
  enabledColumns: ChartColumn[];
  isConfigOpen: boolean;
  setConfigOpen: (open: boolean) => void;
  toggleColumn: (columnId: string) => void;
  reorderColumns: (fromIndex: number, toIndex: number) => void;
  updateColumn: (columnId: string, updates: Partial<ChartColumn>) => void;
  resetToDefault: () => void;
  applyConfig: () => void;
  draftColumns: ChartColumn[];
  hasPendingChanges: boolean;
  getColumnConfig: (chartType: string) => Record<string, any>;
  getChartConfig: () => Record<string, any>;
}

const DEFAULT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const STORAGE_PREFIX = 'chart-columns';

function getStorageKey(chartId: string, storageKey?: string): string {
  return storageKey || `${STORAGE_PREFIX}-${chartId}`;
}

function loadColumnsFromStorage(storageKey: string, defaultColumns: ChartColumn[]): ChartColumn[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return defaultColumns;
    
    const storedColumns: ChartColumn[] = JSON.parse(stored);
    
    const columnMap = new Map(storedColumns.map(col => [col.id, col]));
    const mergedColumns = defaultColumns.map(defaultCol => {
      const storedCol = columnMap.get(defaultCol.id);
      if (storedCol) {
        return {
          ...defaultCol,
          ...storedCol,
          label: defaultCol.label,
          dataKey: defaultCol.dataKey,
          type: defaultCol.type,
          formatType: defaultCol.formatType,
          unit: defaultCol.unit,
        };
      }
      return defaultCol;
    });
    
    return mergedColumns.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.warn('Failed to load chart columns from storage:', error);
    return defaultColumns;
  }
}

function saveColumnsToStorage(storageKey: string, columns: ChartColumn[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(columns));
  } catch (error) {
    console.warn('Failed to save chart columns to storage:', error);
  }
}

export function useChartColumns({
  chartId,
  defaultColumns,
  storageKey,
  onConfigChange,
}: UseChartColumnsOptions): UseChartColumnsReturn {
  const finalStorageKey = getStorageKey(chartId, storageKey);
  
  const [columns, setColumns] = useState<ChartColumn[]>(() => 
    loadColumnsFromStorage(finalStorageKey, defaultColumns)
  );
  
  const [draftColumns, setDraftColumns] = useState<ChartColumn[]>(columns);
  const [isConfigOpen, setConfigOpen] = useState(false);
  
  const hasPendingChanges = useMemo(() => {
    return JSON.stringify(columns) !== JSON.stringify(draftColumns);
  }, [columns, draftColumns]);
  
  const enabledColumns = useMemo(() => {
    return columns
      .filter(col => col.enabled)
      .sort((a, b) => a.order - b.order);
  }, [columns]);
  
  useEffect(() => {
    if (isConfigOpen) {
      setDraftColumns([...columns]);
    }
  }, [isConfigOpen, columns]);
  
  const toggleColumn = useCallback((columnId: string) => {
    setDraftColumns(prev => 
      prev.map(col => 
        col.id === columnId ? { ...col, enabled: !col.enabled } : col
      )
    );
  }, []);
  
  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setDraftColumns(prev => {
      const newColumns = [...prev];
      const [moved] = newColumns.splice(fromIndex, 1);
      newColumns.splice(toIndex, 0, moved);
      
      return newColumns.map((col, index) => ({
        ...col,
        order: index,
      }));
    });
  }, []);
  
  const updateColumn = useCallback((columnId: string, updates: Partial<ChartColumn>) => {
    setDraftColumns(prev => 
      prev.map(col => 
        col.id === columnId ? { ...col, ...updates } : col
      )
    );
  }, []);
  
  const resetToDefault = useCallback(() => {
    const resetColumns = defaultColumns.map((col, index) => ({
      ...col,
      order: index,
      enabled: true,
    }));
    setDraftColumns(resetColumns);
  }, [defaultColumns]);
  
  const applyConfig = useCallback(() => {
    const newColumns = [...draftColumns];
    setColumns(newColumns);
    saveColumnsToStorage(finalStorageKey, newColumns);
    onConfigChange?.(newColumns);
    setConfigOpen(false);
  }, [draftColumns, finalStorageKey, onConfigChange]);
  
  const getColumnConfig = useCallback((chartType: string) => {
    const config: Record<string, any> = {};
    
    enabledColumns.forEach((col, index) => {
      config[col.id] = {
        label: col.label,
        color: col.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        dataKey: col.dataKey,
        type: col.type,
        yAxisId: col.yAxisId,
        formatType: col.formatType,
        unit: col.unit,
      };
    });
    
    return config;
  }, [enabledColumns]);
  
  const getChartConfig = useCallback(() => {
    const config: Record<string, any> = {};
    
    enabledColumns.forEach((col, index) => {
      config[col.dataKey] = {
        label: col.label,
        color: col.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      };
    });
    
    return config;
  }, [enabledColumns]);
  
  useEffect(() => {
    saveColumnsToStorage(finalStorageKey, columns);
  }, [columns, finalStorageKey]);
  
  return {
    columns,
    enabledColumns,
    isConfigOpen,
    setConfigOpen,
    toggleColumn,
    reorderColumns,
    updateColumn,
    resetToDefault,
    applyConfig,
    draftColumns,
    hasPendingChanges,
    getColumnConfig,
    getChartConfig,
  };
}

export const CHART_COLUMN_PRESETS = {
  timeSeries: [
    {
      id: 'count',
      label: 'Transaction Count',
      dataKey: 'count',
      color: 'hsl(var(--chart-1))',
      type: 'bar' as const,
      yAxisId: 'left' as const,
      enabled: true,
      order: 0,
      formatType: 'number' as const,
    },
    {
      id: 'totalVolume',
      label: 'Total Volume',
      dataKey: 'totalVolume',
      color: 'hsl(var(--chart-2))',
      type: 'line' as const,
      yAxisId: 'right' as const,
      enabled: true,
      order: 1,
      formatType: 'currency' as const,
    },
    {
      id: 'avgPrice',
      label: 'Average Price',
      dataKey: 'avgPrice',
      color: 'hsl(var(--chart-3))',
      type: 'line' as const,
      yAxisId: 'right' as const,
      enabled: true,
      order: 2,
      formatType: 'currency' as const,
    },
    {
      id: 'avgCapRate',
      label: 'Average Cap Rate',
      dataKey: 'avgCapRate',
      color: 'hsl(var(--chart-4))',
      type: 'line' as const,
      yAxisId: 'left' as const,
      enabled: false,
      order: 3,
      formatType: 'percent' as const,
    },
  ],
  
  distribution: [
    {
      id: 'count',
      label: 'Count',
      dataKey: 'count',
      color: 'hsl(var(--chart-1))',
      type: 'bar' as const,
      enabled: true,
      order: 0,
      formatType: 'number' as const,
    },
  ],
  
  geographic: [
    {
      id: 'count',
      label: 'Transaction Count',
      dataKey: 'count',
      color: 'hsl(var(--chart-1))',
      type: 'bar' as const,
      yAxisId: 'left' as const,
      enabled: true,
      order: 0,
      formatType: 'number' as const,
    },
    {
      id: 'value',
      label: 'Total Value',
      dataKey: 'totalVolume',
      color: 'hsl(var(--chart-2))',
      type: 'bar' as const,
      yAxisId: 'right' as const,
      enabled: false,
      order: 1,
      formatType: 'currency' as const,
    },
    {
      id: 'avgPrice',
      label: 'Average Price',
      dataKey: 'avgPrice',
      color: 'hsl(var(--chart-3))',
      type: 'line' as const,
      yAxisId: 'right' as const,
      enabled: false,
      order: 2,
      formatType: 'currency' as const,
    },
  ],
};
