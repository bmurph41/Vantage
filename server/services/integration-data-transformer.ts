import type { DataMapping } from '../integrations/registry';

export type TransformResult = {
  success: boolean;
  data?: Record<string, any>;
  errors?: string[];
  warnings?: string[];
};

export type BulkTransformResult = {
  successful: TransformResult[];
  failed: TransformResult[];
  totalRecords: number;
  successCount: number;
  failureCount: number;
  warnings: string[];
};

const TRANSFORM_FUNCTIONS: Record<string, (value: any, context?: Record<string, any>) => any> = {
  qbo_pnl_transform: (rows: any[]) => {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => ({
      account: row.ColData?.[0]?.value || row.account,
      amount: parseFloat(row.ColData?.[1]?.value || row.amount || '0'),
    }));
  },
  
  date_to_iso: (value: any) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  },
  
  date_to_date_only: (value: any) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  },
  
  string_to_decimal: (value: any) => {
    if (value === null || value === undefined) return null;
    const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? null : num.toFixed(2);
  },
  
  cents_to_dollars: (value: any) => {
    if (value === null || value === undefined) return null;
    const cents = parseInt(String(value), 10);
    return isNaN(cents) ? null : (cents / 100).toFixed(2);
  },
  
  boolean_to_string: (value: any) => {
    return value ? 'true' : 'false';
  },
  
  string_to_boolean: (value: any) => {
    if (typeof value === 'boolean') return value;
    const str = String(value).toLowerCase();
    return str === 'true' || str === '1' || str === 'yes';
  },
  
  uppercase: (value: any) => {
    return typeof value === 'string' ? value.toUpperCase() : value;
  },
  
  lowercase: (value: any) => {
    return typeof value === 'string' ? value.toLowerCase() : value;
  },
  
  trim: (value: any) => {
    return typeof value === 'string' ? value.trim() : value;
  },
  
  phone_normalize: (value: any) => {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return value;
  },
  
  email_lowercase: (value: any) => {
    return typeof value === 'string' ? value.toLowerCase().trim() : value;
  },
  
  feet_to_meters: (value: any) => {
    if (value === null || value === undefined) return null;
    const feet = parseFloat(String(value));
    return isNaN(feet) ? null : (feet * 0.3048).toFixed(2);
  },
  
  meters_to_feet: (value: any) => {
    if (value === null || value === undefined) return null;
    const meters = parseFloat(String(value));
    return isNaN(meters) ? null : (meters / 0.3048).toFixed(2);
  },
  
  gallons_to_liters: (value: any) => {
    if (value === null || value === undefined) return null;
    const gallons = parseFloat(String(value));
    return isNaN(gallons) ? null : (gallons * 3.78541).toFixed(2);
  },
};

export function getNestedValue(obj: Record<string, any>, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (key.includes('[') && key.includes(']')) {
      const arrayKey = key.slice(0, key.indexOf('['));
      const index = parseInt(key.slice(key.indexOf('[') + 1, key.indexOf(']')), 10);
      current = current[arrayKey]?.[index];
    } else {
      current = current[key];
    }
  }
  
  return current;
}

export function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

export function applyTransform(value: any, transformName?: string, context?: Record<string, any>): any {
  if (!transformName) return value;
  
  const transformFn = TRANSFORM_FUNCTIONS[transformName];
  if (!transformFn) {
    console.warn(`Unknown transform function: ${transformName}`);
    return value;
  }
  
  try {
    return transformFn(value, context);
  } catch (error) {
    console.error(`Transform error for ${transformName}:`, error);
    return value;
  }
}

export function transformRecord(
  sourceData: Record<string, any>,
  fieldMappings: DataMapping['fields'],
  context?: Record<string, any>
): TransformResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const result: Record<string, any> = {};
  
  for (const mapping of fieldMappings) {
    try {
      let sourceValue = getNestedValue(sourceData, mapping.source);
      
      if (sourceValue === undefined) {
        warnings.push(`Source field "${mapping.source}" not found in source data`);
        continue;
      }
      
      const transformedValue = applyTransform(sourceValue, mapping.transform, context);
      setNestedValue(result, mapping.target, transformedValue);
    } catch (error) {
      errors.push(`Error mapping ${mapping.source} -> ${mapping.target}: ${error}`);
    }
  }
  
  if (errors.length > 0) {
    return { success: false, data: result, errors, warnings };
  }
  
  return { success: true, data: result, warnings };
}

export function transformBulkRecords(
  sourceRecords: Record<string, any>[],
  fieldMappings: DataMapping['fields'],
  context?: Record<string, any>
): BulkTransformResult {
  const successful: TransformResult[] = [];
  const failed: TransformResult[] = [];
  const warnings: string[] = [];
  
  for (const record of sourceRecords) {
    const result = transformRecord(record, fieldMappings, context);
    
    if (result.success) {
      successful.push(result);
    } else {
      failed.push(result);
    }
    
    if (result.warnings && result.warnings.length > 0) {
      warnings.push(...result.warnings);
    }
  }
  
  return {
    successful,
    failed,
    totalRecords: sourceRecords.length,
    successCount: successful.length,
    failureCount: failed.length,
    warnings: [...new Set(warnings)],
  };
}

export const ENTITY_FIELD_REQUIREMENTS: Record<string, { required: string[]; optional: string[] }> = {
  'crm.contacts': {
    required: ['firstName', 'lastName', 'email'],
    optional: ['phone', 'company', 'position', 'address', 'city', 'state', 'zipCode', 'externalId'],
  },
  'rentRoll.tenants': {
    required: ['firstName', 'lastName'],
    optional: ['email', 'phone', 'address', 'city', 'state', 'zipCode', 'boatName', 'boatLength', 'externalId'],
  },
  'rentRoll.locations': {
    required: ['code'],
    optional: ['name', 'length', 'width', 'monthlyRate', 'annualRate', 'hasElectric', 'hasWater', 'externalId'],
  },
  'rentRoll.leases': {
    required: ['startDate', 'endDate', 'monthlyRent'],
    optional: ['tenantId', 'storageLocationId', 'leaseNumber', 'status', 'externalId'],
  },
  'boatRentals.reservations': {
    required: ['startDate', 'endDate'],
    optional: ['customerId', 'boatId', 'status', 'totalAmount', 'externalId'],
  },
  'financials.invoices': {
    required: ['amount', 'dueDate'],
    optional: ['customerId', 'invoiceNumber', 'status', 'paidDate', 'externalId'],
  },
  'service.workOrders': {
    required: ['description', 'jobType'],
    optional: ['customerId', 'boatId', 'status', 'priority', 'estimatedCost', 'totalAmount', 'externalId'],
  },
};

export function validateTransformedData(
  data: Record<string, any>,
  targetModule: string,
  targetEntity: string
): { valid: boolean; missingFields: string[]; warnings: string[] } {
  const entityKey = `${targetModule}.${targetEntity}`;
  const requirements = ENTITY_FIELD_REQUIREMENTS[entityKey];
  
  if (!requirements) {
    return { valid: true, missingFields: [], warnings: [`No validation rules for ${entityKey}`] };
  }
  
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  for (const field of requirements.required) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    }
  }
  
  return {
    valid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

export class IntegrationDataTransformer {
  private integrationKey: string;
  private orgId: string;
  
  constructor(integrationKey: string, orgId: string) {
    this.integrationKey = integrationKey;
    this.orgId = orgId;
  }
  
  async transformAndValidate(
    sourceRecords: Record<string, any>[],
    dataMapping: DataMapping
  ): Promise<{
    validRecords: Record<string, any>[];
    invalidRecords: Array<{ record: Record<string, any>; errors: string[] }>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      warnings: string[];
    };
  }> {
    const validRecords: Record<string, any>[] = [];
    const invalidRecords: Array<{ record: Record<string, any>; errors: string[] }> = [];
    const warnings: string[] = [];
    
    const context = {
      integrationKey: this.integrationKey,
      orgId: this.orgId,
      targetModule: dataMapping.targetModule,
      targetEntity: dataMapping.targetEntity,
    };
    
    for (const sourceRecord of sourceRecords) {
      const transformResult = transformRecord(sourceRecord, dataMapping.fields, context);
      
      if (!transformResult.success || !transformResult.data) {
        invalidRecords.push({
          record: sourceRecord,
          errors: transformResult.errors || ['Transform failed'],
        });
        continue;
      }
      
      const validation = validateTransformedData(
        transformResult.data,
        dataMapping.targetModule,
        dataMapping.targetEntity
      );
      
      if (!validation.valid) {
        invalidRecords.push({
          record: sourceRecord,
          errors: [`Missing required fields: ${validation.missingFields.join(', ')}`],
        });
        continue;
      }
      
      transformResult.data.externalId = sourceRecord.id || sourceRecord.pk || sourceRecord.externalId;
      transformResult.data.integrationSource = this.integrationKey;
      transformResult.data.lastSyncedAt = new Date();
      
      validRecords.push(transformResult.data);
      
      if (transformResult.warnings) {
        warnings.push(...transformResult.warnings);
      }
      if (validation.warnings) {
        warnings.push(...validation.warnings);
      }
    }
    
    return {
      validRecords,
      invalidRecords,
      summary: {
        total: sourceRecords.length,
        valid: validRecords.length,
        invalid: invalidRecords.length,
        warnings: [...new Set(warnings)],
      },
    };
  }
}

export default IntegrationDataTransformer;
