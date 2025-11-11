import type { 
  MappingSuggestion, 
  DataQuality, 
  FieldConfig, 
  MappingPreview, 
  FileAnalysis,
  BulkMappingAction 
} from '@/lib/salescomps/types';

export const FIELD_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  CURRENCY: 'currency',
  PERCENT: 'percent',
  MONTH: 'month',
  STATE: 'state',
  DATE: 'date',
  BOOLEAN: 'boolean'
} as const;

export const CONFIDENCE_LEVELS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.3
} as const;

export const STANDARD_FIELDS: FieldConfig[] = [
  { key: 'marina', label: 'Marina Name', type: FIELD_TYPES.TEXT, required: true, description: 'Marina or facility name' },
  { key: 'salePrice', label: 'Sale Price', type: FIELD_TYPES.CURRENCY, description: 'Final sale price' },
  { key: 'capRate', label: 'Cap Rate', type: FIELD_TYPES.PERCENT, description: 'Capitalization rate' },
  { key: 'noi', label: 'NOI', type: FIELD_TYPES.CURRENCY, description: 'Net Operating Income' },
  { key: 'saleMonth', label: 'Sale Month', type: FIELD_TYPES.MONTH, description: 'Month of sale' },
  { key: 'saleYear', label: 'Sale Year', type: FIELD_TYPES.NUMBER, description: 'Year of sale' },
  { key: 'state', label: 'State', type: FIELD_TYPES.STATE, description: 'State' },
  { key: 'city', label: 'City', type: FIELD_TYPES.TEXT, description: 'City location' },
  { key: 'region', label: 'Region', type: FIELD_TYPES.TEXT, description: 'Geographic region' },
  { key: 'wetSlips', label: 'Wet Slips', type: FIELD_TYPES.NUMBER, description: 'Number of wet slips' },
  { key: 'dryRacks', label: 'Dry Racks', type: FIELD_TYPES.NUMBER, description: 'Number of dry storage racks' },
  { key: 'ioBoth', label: 'Storage Type', type: FIELD_TYPES.TEXT, description: 'Storage location type' },
  { key: 'bodyOfWater', label: 'Body of Water', type: FIELD_TYPES.TEXT, description: 'Body of water location' },
  { key: 'waterfront', label: 'Waterfront', type: FIELD_TYPES.TEXT, description: 'Waterfront access type' },
  { key: 'saleCondition', label: 'Sale Condition', type: FIELD_TYPES.TEXT, description: 'Sale conditions or terms' },
  { key: 'daysOnMarket', label: 'Days on Market', type: FIELD_TYPES.NUMBER, description: 'Days on market' },
  { key: 'broker', label: 'Broker (Legacy)', type: FIELD_TYPES.TEXT, description: 'Listing broker or agent (legacy field)' },
  { key: 'brokerage', label: 'Brokerage', type: FIELD_TYPES.TEXT, description: 'Brokerage company name' },
  { key: 'agentFirstName', label: 'Agent First Name', type: FIELD_TYPES.TEXT, description: 'Agent first name' },
  { key: 'agentLastName', label: 'Agent Last Name', type: FIELD_TYPES.TEXT, description: 'Agent last name' },
  { key: 'address', label: 'Address', type: FIELD_TYPES.TEXT, description: 'Property address' },
  { key: 'zip', label: 'Zip Code', type: FIELD_TYPES.TEXT, description: 'Postal/ZIP code' },
  { key: 'seller', label: 'Seller', type: FIELD_TYPES.TEXT, description: 'Seller name' },
  { key: 'company', label: 'Company', type: FIELD_TYPES.TEXT, description: 'Company or business entity' },
  { key: 'owner', label: 'Owner', type: FIELD_TYPES.TEXT, description: 'Property owner' },
  { key: 'listPrice', label: 'List Price', type: FIELD_TYPES.CURRENCY, description: 'Original listing price' },
  { key: 'acres', label: 'Acres', type: FIELD_TYPES.NUMBER, description: 'Property size in acres' },
  { key: 'occupancy', label: 'Occupancy', type: FIELD_TYPES.PERCENT, description: 'Occupancy rate' },
  { key: 'yearBuilt', label: 'Year Built', type: FIELD_TYPES.NUMBER, description: 'Year built or constructed' },
  { key: 'notes', label: 'Notes', type: FIELD_TYPES.TEXT, description: 'Additional notes or comments' }
];

/**
 * Get the appropriate icon for a field type
 */
export function getTypeIcon(type: string): string {
  switch (type) {
    case FIELD_TYPES.CURRENCY: return '$';
    case FIELD_TYPES.PERCENT: return '%';
    case FIELD_TYPES.NUMBER: return '#';
    case FIELD_TYPES.MONTH: return '📅';
    case FIELD_TYPES.STATE: return '🗺️';
    case FIELD_TYPES.DATE: return '📆';
    case FIELD_TYPES.BOOLEAN: return '✓';
    default: return 'T';
  }
}

/**
 * Get the color class for confidence level
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= CONFIDENCE_LEVELS.HIGH) return 'text-green-600 bg-green-50 border-green-200';
  if (confidence >= CONFIDENCE_LEVELS.MEDIUM) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  if (confidence >= CONFIDENCE_LEVELS.LOW) return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(confidence: number): string {
  if (confidence >= CONFIDENCE_LEVELS.HIGH) return 'High';
  if (confidence >= CONFIDENCE_LEVELS.MEDIUM) return 'Medium';
  if (confidence >= CONFIDENCE_LEVELS.LOW) return 'Low';
  return 'Poor';
}

/**
 * Get data quality color and label
 */
export function getQualityIndicator(quality: DataQuality): { color: string; label: string; score: number } {
  const score = (quality.completeness + quality.consistency) / 2;
  
  if (score >= 0.8) return { color: 'text-green-600', label: 'Excellent', score };
  if (score >= 0.6) return { color: 'text-blue-600', label: 'Good', score };
  if (score >= 0.4) return { color: 'text-yellow-600', label: 'Fair', score };
  return { color: 'text-red-600', label: 'Poor', score };
}

/**
 * Get the best example value from a column
 */
export function getBestExample(sampleRows: Record<string, any>[], column: string): string {
  const values = sampleRows
    .map(row => row[column])
    .filter(val => val !== null && val !== undefined && val !== '')
    .map(val => val.toString().trim())
    .filter(val => val.length > 0 && val.length < 50); // Reasonable length
  
  if (values.length === 0) return '';
  
  // Return the most common value, or first if all unique
  const frequencies = values.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostCommon = Object.entries(frequencies)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];
  
  return mostCommon ? mostCommon[0] : values[0];
}

/**
 * Generate mapping preview for a specific field
 */
export function generateMappingPreview(
  sourceColumn: string,
  targetField: string,
  sampleRows: Record<string, any>[],
  fieldType: string
): MappingPreview {
  const sampleTransformation = sampleRows.slice(0, 3).map(row => {
    const original = row[sourceColumn];
    const transformed = simulateTransformation(original, fieldType);
    
    return {
      original,
      transformed: transformed.value,
      isValid: transformed.isValid,
      warning: transformed.warning
    };
  });

  const validation = validateMapping(sourceColumn, targetField, sampleRows, fieldType);

  return {
    sourceColumn,
    targetField,
    sampleTransformation,
    validation
  };
}

/**
 * Simulate data transformation for preview
 */
function simulateTransformation(value: any, targetType: string): { 
  value: any; 
  isValid: boolean; 
  warning?: string; 
} {
  if (value === null || value === undefined || value === '') {
    return { value: null, isValid: true };
  }

  const strValue = value.toString().trim();

  switch (targetType) {
    case FIELD_TYPES.CURRENCY:
      const cleaned = strValue.replace(/[$,]/g, '');
      const num = parseFloat(cleaned);
      if (isNaN(num)) {
        return { value: strValue, isValid: false, warning: 'Not a valid currency format' };
      }
      return { value: num, isValid: true };

    case FIELD_TYPES.PERCENT:
      const percentValue = strValue.replace('%', '');
      const percent = parseFloat(percentValue);
      if (isNaN(percent)) {
        return { value: strValue, isValid: false, warning: 'Not a valid percentage' };
      }
      return { value: percent, isValid: true };

    case FIELD_TYPES.NUMBER:
      const numValue = parseFloat(strValue);
      if (isNaN(numValue)) {
        return { value: strValue, isValid: false, warning: 'Not a valid number' };
      }
      return { value: numValue, isValid: true };

    case FIELD_TYPES.MONTH:
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];
      
      const monthIndex = monthNames.findIndex(month => 
        month.toLowerCase() === strValue.toLowerCase()
      );
      
      if (monthIndex >= 0) {
        return { value: monthIndex + 1, isValid: true };
      }
      
      const monthNum = parseInt(strValue);
      if (monthNum >= 1 && monthNum <= 12) {
        return { value: monthNum, isValid: true };
      }
      
      return { value: strValue, isValid: false, warning: 'Not a valid month' };

    case FIELD_TYPES.STATE:
      if (strValue.length === 2) {
        return { value: strValue.toUpperCase(), isValid: true };
      }
      
      // Would need state name mapping here
      return { value: strValue, isValid: true, warning: 'Consider using 2-letter state code' };

    default:
      return { value: strValue, isValid: true };
  }
}

/**
 * Validate a mapping configuration
 */
function validateMapping(
  sourceColumn: string,
  targetField: string,
  sampleRows: Record<string, any>[],
  fieldType: string
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for required fields
  const fieldConfig = STANDARD_FIELDS.find(f => f.key === targetField);
  if (fieldConfig?.required) {
    const hasData = sampleRows.some(row => 
      row[sourceColumn] !== null && 
      row[sourceColumn] !== undefined && 
      row[sourceColumn] !== ''
    );
    
    if (!hasData) {
      errors.push('Required field has no data');
    }
  }

  // Check type compatibility
  const values = sampleRows
    .map(row => row[sourceColumn])
    .filter(val => val !== null && val !== undefined && val !== '');

  if (values.length > 0) {
    const validCount = values.reduce((count, value) => {
      const result = simulateTransformation(value, fieldType);
      return count + (result.isValid ? 1 : 0);
    }, 0);

    const validPercentage = validCount / values.length;
    
    if (validPercentage < 0.5) {
      errors.push(`Only ${Math.round(validPercentage * 100)}% of values are valid for ${fieldType} type`);
    } else if (validPercentage < 0.8) {
      warnings.push(`${Math.round((1 - validPercentage) * 100)}% of values may need transformation`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Apply bulk mapping action
 */
export function applyBulkAction(
  action: BulkMappingAction,
  currentMapping: Record<string, string>,
  suggestions: Record<string, MappingSuggestion>
): Record<string, string> {
  const newMapping = { ...currentMapping };

  switch (action.type) {
    case 'accept_all':
      Object.keys(suggestions).forEach(column => {
        if (suggestions[column].targetField) {
          newMapping[column] = suggestions[column].targetField;
        }
      });
      break;

    case 'reject_all':
      Object.keys(suggestions).forEach(column => {
        delete newMapping[column];
      });
      break;

    case 'accept_high_confidence':
      const threshold = action.confidence_threshold || CONFIDENCE_LEVELS.HIGH;
      Object.keys(suggestions).forEach(column => {
        if (suggestions[column].confidence >= threshold && suggestions[column].targetField) {
          newMapping[column] = suggestions[column].targetField;
        }
      });
      break;

    case 'apply_suggestions':
      if (action.selected_fields) {
        action.selected_fields.forEach(column => {
          if (suggestions[column]?.targetField) {
            newMapping[column] = suggestions[column].targetField;
          }
        });
      }
      break;
  }

  return newMapping;
}

/**
 * Get mapping summary statistics
 */
export function getMappingSummary(
  headers: string[],
  mapping: Record<string, string>,
  suggestions: Record<string, MappingSuggestion>
) {
  const mapped = Object.keys(mapping).length;
  const highConfidence = Object.values(suggestions).filter(s => s.confidence >= CONFIDENCE_LEVELS.HIGH).length;
  const mediumConfidence = Object.values(suggestions).filter(s => 
    s.confidence >= CONFIDENCE_LEVELS.MEDIUM && s.confidence < CONFIDENCE_LEVELS.HIGH
  ).length;
  const lowConfidence = Object.values(suggestions).filter(s => 
    s.confidence >= CONFIDENCE_LEVELS.LOW && s.confidence < CONFIDENCE_LEVELS.MEDIUM
  ).length;
  const unmapped = headers.length - mapped;

  const requiredFields = STANDARD_FIELDS.filter(f => f.required);
  const mappedRequiredFields = requiredFields.filter(field => 
    Object.values(mapping).includes(field.key)
  );

  return {
    total: headers.length,
    mapped,
    unmapped,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    requiredFields: requiredFields.length,
    mappedRequiredFields: mappedRequiredFields.length,
    isComplete: mappedRequiredFields.length === requiredFields.length
  };
}