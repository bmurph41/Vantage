import { useState, useEffect, useCallback } from "react";
import type { RentRollTableConfig, RentRollColumnConfig } from "@shared/schema";
import { RENT_ROLL_CONFIG_VERSION, getDefaultColumnsForAssetClass } from "@shared/schema";
import { useRentRollConfig } from "./useRentRollConfig";

const STORAGE_KEY = "rentRollTableConfig";

/**
 * Custom hook to manage rent roll table column configuration with localStorage persistence
 * Includes automatic migration when new columns are added to the default configuration
 * Now asset-class-aware: non-marina projects hide boat/slip columns by default
 */
export function useRentRollColumns(locationId?: string | null) {
  const { assetClass } = useRentRollConfig();
  const effectiveDefaults = getDefaultColumnsForAssetClass(assetClass);
  // Generate storage key based on location (project-specific settings)
  const storageKey = locationId ? `${STORAGE_KEY}_${locationId}` : STORAGE_KEY;

  const [config, setConfig] = useState<RentRollTableConfig>(() => {
    // Try to load from localStorage
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as RentRollTableConfig;
        
        // Check if configuration version is outdated
        const isOutdated = !parsed.version || parsed.version < RENT_ROLL_CONFIG_VERSION;
        
        // Validate that stored config has all required columns
        const storedColumnIds = new Set(parsed.columns.map((c) => c.id));
        const defaultColumnIds = new Set(effectiveDefaults.map((c) => c.id));
        
        // If outdated or columns don't match, merge defaults with stored overrides
        if (isOutdated ||
            storedColumnIds.size !== defaultColumnIds.size ||
            !Array.from(defaultColumnIds).every((id) => storedColumnIds.has(id))) {
          
          // Merge: keep stored settings for existing columns, add missing ones
          const mergedColumns = effectiveDefaults.map((defaultCol, index) => {
            const storedCol = parsed.columns.find((c) => c.id === defaultCol.id);
            
            if (storedCol) {
              // Keep user preferences for existing columns
              const merged = {
                ...storedCol,
                // Update order to match new default ordering
                order: index,
              };
              
              // Force actions column to always be visible (critical for delete/edit functionality)
              if (merged.id === 'actions') {
                return { ...merged, visible: true };
              }
              
              return merged;
            } else {
              // Add new columns with default settings
              return {
                ...defaultCol,
                order: index,
              };
            }
          });
          
          return {
            columns: mergedColumns,
            sort: parsed.sort || { columnId: null, direction: null },
            version: RENT_ROLL_CONFIG_VERSION,
          };
        }
        
        // Configuration is up to date, but still enforce actions column visibility
        const enforcedColumns = parsed.columns.map((col) => {
          if (col.id === 'actions') {
            return { ...col, visible: true };
          }
          return col;
        });
        
        const sortedColumn = enforcedColumns.find((col) => col.id === parsed.sort?.columnId);
        const sortState = sortedColumn && !sortedColumn.visible
          ? { columnId: null, direction: null }
          : (parsed.sort || { columnId: null, direction: null });
        
        return {
          columns: enforcedColumns,
          sort: sortState,
          version: parsed.version || RENT_ROLL_CONFIG_VERSION,
        };
      }
    } catch (error) {
      console.error("Failed to load column config from localStorage:", error);
    }

    // Return default configuration
    return {
      columns: [...effectiveDefaults],
      sort: { columnId: null, direction: null },
      version: RENT_ROLL_CONFIG_VERSION,
    };
  });

  // Save to localStorage whenever config changes
  useEffect(() => {
    try {
      // Clear sort if sorted column is not visible
      const sortedColumn = config.columns.find((col) => col.id === config.sort.columnId);
      if (sortedColumn && !sortedColumn.visible) {
        setConfig((prev) => ({
          ...prev,
          sort: { columnId: null, direction: null },
        }));
        return; // Don't save yet, let the next effect handle it
      }
      
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch (error) {
      console.error("Failed to save column config to localStorage:", error);
    }
  }, [config, storageKey]);

  const updateConfig = useCallback((newConfig: RentRollTableConfig) => {
    setConfig(newConfig);
  }, []);

  const updateSort = useCallback((columnId: string | null, direction: 'asc' | 'desc' | null) => {
    setConfig((prev) => ({
      ...prev,
      sort: { columnId, direction },
    }));
  }, []);

  const toggleSort = useCallback((columnId: string) => {
    setConfig((prev) => {
      const currentSort = prev.sort;
      
      // If clicking the same column, cycle through: asc -> desc -> null
      if (currentSort.columnId === columnId) {
        if (currentSort.direction === 'asc') {
          return { ...prev, sort: { columnId, direction: 'desc' } };
        } else if (currentSort.direction === 'desc') {
          return { ...prev, sort: { columnId: null, direction: null } };
        }
      }
      
      // If clicking a different column, sort ascending
      return { ...prev, sort: { columnId, direction: 'asc' } };
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    // Ensure deterministic order indexes when resetting
    const resetColumns = effectiveDefaults.map((col, index) => ({
      ...col,
      order: index,
    }));
    
    setConfig({
      columns: resetColumns,
      sort: { columnId: null, direction: null },
      version: RENT_ROLL_CONFIG_VERSION,
    });
  }, []);

  // Get visible columns in display order
  const visibleColumns = config.columns
    .filter((col) => col.visible)
    .sort((a, b) => a.order - b.order);

  return {
    config,
    visibleColumns,
    updateConfig,
    updateSort,
    toggleSort,
    resetToDefaults,
  };
}
