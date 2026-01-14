import { z } from 'zod';

export const rentRollImportRowSchema = z.object({
  tenantName: z.string().min(1, 'Tenant name is required').max(255),
  unitNumber: z.string().optional(),
  slipNumber: z.string().optional(),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
  monthlyRent: z.union([z.number(), z.string()]).optional(),
  annualRent: z.union([z.number(), z.string()]).optional(),
  squareFeet: z.union([z.number(), z.string()]).optional(),
  boatLength: z.union([z.number(), z.string()]).optional(),
  boatBeam: z.union([z.number(), z.string()]).optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

export const rentRollImportSchema = z.object({
  locationId: z.string().uuid('Invalid location ID'),
  rows: z.array(rentRollImportRowSchema).min(1, 'At least one row is required'),
  options: z.object({
    skipDuplicates: z.boolean().default(false),
    updateExisting: z.boolean().default(false),
  }).optional(),
});

export type RentRollImportRow = z.infer<typeof rentRollImportRowSchema>;
export type RentRollImportPayload = z.infer<typeof rentRollImportSchema>;

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    row?: number;
    field: string;
    message: string;
  }>;
  warnings?: Array<{
    row?: number;
    field: string;
    message: string;
  }>;
}

export function sanitizeImportNumber(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  const strValue = String(value).replace(/[$,\s]/g, '');
  const num = parseFloat(strValue);
  
  if (isNaN(num) || !isFinite(num)) {
    return defaultValue;
  }
  
  return num;
}

export function sanitizeImportDate(value: unknown): string | null {
  if (!value) return null;
  
  const strValue = String(value).trim();
  
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{1,2}\/\d{1,2}\/\d{4}$/,
    /^\d{1,2}-\d{1,2}-\d{4}$/,
  ];
  
  for (const pattern of datePatterns) {
    if (pattern.test(strValue)) {
      const date = new Date(strValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  const date = new Date(strValue);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

export function validateRentRollImport(payload: unknown): ValidationResult<RentRollImportPayload> {
  const errors: Array<{ row?: number; field: string; message: string }> = [];
  const warnings: Array<{ row?: number; field: string; message: string }> = [];
  
  const parseResult = rentRollImportSchema.safeParse(payload);
  
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        field: issue.path.join('.'),
        message: issue.message,
      });
    }
    return { success: false, errors, warnings };
  }
  
  const data = parseResult.data;
  
  data.rows.forEach((row, index) => {
    if (row.monthlyRent !== undefined && row.annualRent !== undefined) {
      const monthly = sanitizeImportNumber(row.monthlyRent);
      const annual = sanitizeImportNumber(row.annualRent);
      
      if (monthly > 0 && annual > 0 && Math.abs(monthly * 12 - annual) > 1) {
        warnings.push({
          row: index + 1,
          field: 'rent',
          message: `Monthly rent ($${monthly}) doesn't match annual rent ($${annual}). Using monthly rent.`,
        });
      }
    }
    
    if (row.leaseStart && row.leaseEnd) {
      const start = new Date(row.leaseStart);
      const end = new Date(row.leaseEnd);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
        errors.push({
          row: index + 1,
          field: 'leaseEnd',
          message: 'Lease end date cannot be before start date',
        });
      }
    }
    
    const rent = row.monthlyRent || row.annualRent;
    if (rent) {
      const rentValue = sanitizeImportNumber(rent);
      if (rentValue < 0) {
        errors.push({
          row: index + 1,
          field: 'rent',
          message: 'Rent cannot be negative',
        });
      }
    }
  });
  
  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }
  
  return { success: true, data, warnings };
}

export const salesCompImportRowSchema = z.object({
  propertyName: z.string().min(1, 'Property name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  saleDate: z.string().optional(),
  salePrice: z.union([z.number(), z.string()]).optional(),
  slipCount: z.union([z.number(), z.string()]).optional(),
  acreage: z.union([z.number(), z.string()]).optional(),
  pricePerSlip: z.union([z.number(), z.string()]).optional(),
  capRate: z.union([z.number(), z.string()]).optional(),
  notes: z.string().optional(),
});

export const salesCompImportSchema = z.object({
  rows: z.array(salesCompImportRowSchema).min(1, 'At least one row is required'),
  options: z.object({
    skipDuplicates: z.boolean().default(false),
    updateExisting: z.boolean().default(false),
  }).optional(),
});

export type SalesCompImportRow = z.infer<typeof salesCompImportRowSchema>;
export type SalesCompImportPayload = z.infer<typeof salesCompImportSchema>;

export function validateSalesCompImport(payload: unknown): ValidationResult<SalesCompImportPayload> {
  const errors: Array<{ row?: number; field: string; message: string }> = [];
  const warnings: Array<{ row?: number; field: string; message: string }> = [];
  
  const parseResult = salesCompImportSchema.safeParse(payload);
  
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        field: issue.path.join('.'),
        message: issue.message,
      });
    }
    return { success: false, errors, warnings };
  }
  
  const data = parseResult.data;
  
  data.rows.forEach((row, index) => {
    if (row.salePrice) {
      const price = sanitizeImportNumber(row.salePrice);
      if (price < 0) {
        errors.push({
          row: index + 1,
          field: 'salePrice',
          message: 'Sale price cannot be negative',
        });
      }
    }
    
    if (row.capRate) {
      const cap = sanitizeImportNumber(row.capRate);
      if (cap < 0 || cap > 100) {
        warnings.push({
          row: index + 1,
          field: 'capRate',
          message: 'Cap rate should be between 0 and 100',
        });
      }
    }
  });
  
  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }
  
  return { success: true, data, warnings };
}

export function sanitizeImportRow<T extends Record<string, unknown>>(
  row: T,
  numericFields: string[],
  dateFields: string[]
): T {
  const sanitized = { ...row };
  
  for (const field of numericFields) {
    if (field in sanitized) {
      (sanitized as any)[field] = sanitizeImportNumber(sanitized[field]);
    }
  }
  
  for (const field of dateFields) {
    if (field in sanitized) {
      (sanitized as any)[field] = sanitizeImportDate(sanitized[field]);
    }
  }
  
  return sanitized;
}
