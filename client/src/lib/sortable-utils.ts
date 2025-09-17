/**
 * Utility functions for drag & drop sorting with decimal spacing
 */

export interface SortUpdate {
  id: string;
  sortOrder: number;
}

/**
 * Generate new sort order values with proper decimal spacing
 * Uses spacing of 10 by default (10, 20, 30...) to allow insertions
 * 
 * @param oldOrderIds - Original order of item IDs
 * @param newOrderIds - New order of item IDs after drag & drop
 * @param spacing - Spacing between sort values (default: 10)
 * @returns Array of sort updates
 */
export function getSortedUpdates(
  oldOrderIds: string[], 
  newOrderIds: string[], 
  spacing: number = 10
): SortUpdate[] {
  const updates: SortUpdate[] = [];
  
  newOrderIds.forEach((id, index) => {
    const newSortOrder = (index + 1) * spacing;
    updates.push({ id, sortOrder: newSortOrder });
  });
  
  return updates;
}

/**
 * Calculate sort order for inserting an item between two existing items
 * Uses the midpoint between adjacent sort orders
 * 
 * @param previousSort - Sort order of the item before the insertion point
 * @param nextSort - Sort order of the item after the insertion point
 * @returns New sort order that fits between the two values
 */
export function getInsertSortOrder(previousSort: number, nextSort: number): number {
  return (previousSort + nextSort) / 2;
}

/**
 * Normalize sort orders to maintain proper spacing
 * Useful when sort orders become too densely packed
 * 
 * @param items - Array of items with sortOrder property
 * @param spacing - Desired spacing between items (default: 10)
 * @returns Array of sort updates to normalize spacing
 */
export function normalizeSortOrders<T extends { id: string; sortOrder: number }>(
  items: T[], 
  spacing: number = 10
): SortUpdate[] {
  // Sort items by current sort order
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  
  return sortedItems.map((item, index) => ({
    id: item.id,
    sortOrder: (index + 1) * spacing,
  }));
}

/**
 * Check if sort orders need normalization
 * Returns true if any adjacent items have less than minimum gap
 * 
 * @param items - Array of items with sortOrder property
 * @param minGap - Minimum required gap between items (default: 1)
 * @returns Whether normalization is needed
 */
export function needsNormalization<T extends { sortOrder: number }>(
  items: T[], 
  minGap: number = 1
): boolean {
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  
  for (let i = 1; i < sortedItems.length; i++) {
    const gap = sortedItems[i].sortOrder - sortedItems[i - 1].sortOrder;
    if (gap < minGap) {
      return true;
    }
  }
  
  return false;
}

/**
 * Batch update utility for optimistic UI updates
 * Applies sort order changes to a local array without mutating the original
 * 
 * @param items - Original array of items
 * @param updates - Sort order updates to apply
 * @returns New array with updated sort orders
 */
export function applyOptimisticSortUpdates<T extends { id: string; sortOrder: number }>(
  items: T[], 
  updates: SortUpdate[]
): T[] {
  const updateMap = new Map(updates.map(update => [update.id, update.sortOrder]));
  
  return items
    .map(item => {
      const newSortOrder = updateMap.get(item.id);
      return newSortOrder !== undefined 
        ? { ...item, sortOrder: newSortOrder }
        : item;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Validation function to ensure sort order consistency
 * Checks for duplicates and proper ordering
 * 
 * @param items - Array of items to validate
 * @returns Validation result with any errors found
 */
export function validateSortOrders<T extends { id: string; sortOrder: number }>(
  items: T[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const sortOrders = items.map(item => item.sortOrder);
  
  // Check for duplicates
  const duplicates = sortOrders.filter((order, index) => sortOrders.indexOf(order) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate sort orders found: ${duplicates.join(', ')}`);
  }
  
  // Check for negative values
  const negativeOrders = sortOrders.filter(order => order < 0);
  if (negativeOrders.length > 0) {
    errors.push(`Negative sort orders found: ${negativeOrders.join(', ')}`);
  }
  
  // Check for non-numeric values
  const nonNumeric = sortOrders.filter(order => !Number.isFinite(order));
  if (nonNumeric.length > 0) {
    errors.push(`Non-numeric sort orders found: ${nonNumeric.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}