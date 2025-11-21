/**
 * Normalization helpers for DockTalk mutations
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
 * Explicitly includes all fields with proper null normalization
 */
export function normalizeSavedSearchData(data: {
  searchName?: string;
  queryText?: string;
  categories?: string[] | null;
  entities?: string[] | null;
  emailAlerts?: boolean;
  alertFrequency?: string | null;
}) {
  const result: any = {};
  
  if (data.searchName !== undefined) {
    result.searchName = data.searchName.trim();
  }
  
  if (data.queryText !== undefined) {
    result.queryText = data.queryText.trim();
  }
  
  if (data.categories !== undefined) {
    result.categories = normalizeArray(data.categories);
  }
  
  if (data.entities !== undefined) {
    result.entities = normalizeArray(data.entities);
  }
  
  if (data.emailAlerts !== undefined) {
    result.emailAlerts = data.emailAlerts;
  }
  
  if (data.alertFrequency !== undefined) {
    result.alertFrequency = normalizeString(data.alertFrequency);
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
