/**
 * Normalization helpers for Docket mutations
 * Ensures all optional fields are properly normalized to null instead of undefined
 * to match backend Zod schema expectations
 */

export function normalizeArray<T>(arr: T[] | undefined | null): T[] | null {
  if (!arr || arr.length === 0) return null;
  return arr;
}

export function normalizeString(str: string | undefined | null): string | null {
  if (!str || str.trim() === '') return null;
  return str.trim();
}

export function normalizeOptional<T>(value: T | undefined | null): T | null {
  if (value === undefined || value === null) return null;
  return value;
}

/**
 * Normalize saved search data for create/update mutations
 * Transforms frontend field names to match backend schema:
 *   searchName -> name
 *   queryText, categories, entities -> criteria (JSON object)
 *   alertFrequency -> alertFrequency
 * Note: isActive defaults to true in the database, toggle is handled separately
 */
export function normalizeSavedSearchData(data: {
  searchName?: string;
  queryText?: string;
  categories?: string[] | null;
  entities?: string[] | null;
  emailAlerts?: boolean;
  alertFrequency?: string | null;
  deliveryTime?: string | null;
}) {
  const result: any = {};
  
  if (data.searchName !== undefined) {
    result.name = data.searchName.trim();
  }
  
  const hasCriteriaFields = data.queryText !== undefined || data.categories !== undefined || data.entities !== undefined;
  if (hasCriteriaFields) {
    result.criteria = {};
    if (data.queryText !== undefined) {
      result.criteria.search = data.queryText.trim();
    }
    if (data.categories !== undefined) {
      result.criteria.categories = normalizeArray(data.categories);
    }
    if (data.entities !== undefined) {
      result.criteria.entities = normalizeArray(data.entities);
    }
  }
  
  if (data.alertFrequency !== undefined) {
    result.alertFrequency = normalizeString(data.alertFrequency) || "none";
  }

  if (data.deliveryTime !== undefined) {
    result.deliveryTime = data.deliveryTime || "09:00";
  }
  
  return result;
}

/**
 * Normalize user preferences data for update mutations
 * Always includes all provided fields with proper null normalization
 */
export function normalizeUserPreferences(data: {
  emailNotifications?: boolean;
  alertFrequency?: string | null;
  categoriesFilter?: string[];
}) {
  const result: any = {};
  
  if (data.emailNotifications !== undefined) {
    result.emailNotifications = data.emailNotifications;
    // When emailNotifications changes, always normalize alertFrequency
    if (data.alertFrequency !== undefined) {
      result.alertFrequency = normalizeString(data.alertFrequency);
    }
  } else {
    // When only changing alertFrequency, normalize it
    if (data.alertFrequency !== undefined) {
      result.alertFrequency = normalizeString(data.alertFrequency);
    }
  }
  
  if (data.categoriesFilter !== undefined) {
    result.categoriesFilter = normalizeArray(data.categoriesFilter);
  }
  
  return result;
}
