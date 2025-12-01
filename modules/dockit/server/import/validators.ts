import { z } from "zod";
import { 
  insertCustomerSchema, insertBoatSchema, 
  insertSlipSchema, insertLeaseSchema 
} from "@shared/schema";

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export class ImportValidator {
  // Enhanced validation schemas for import context
  private static readonly customerImportSchema = insertCustomerSchema.extend({
    email: z.string().email("Invalid email format").min(1, "Email is required"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().optional().refine(
      (val) => !val || /^[\d\s\-\+\(\)\.]+$/.test(val),
      "Invalid phone number format"
    ),
  });

  private static readonly boatImportSchema = insertBoatSchema.extend({
    name: z.string().min(1, "Boat name is required"),
    make: z.string().min(1, "Boat make is required"),
    model: z.string().min(1, "Boat model is required"),
    year: z.number().min(1900, "Year must be after 1900").max(new Date().getFullYear() + 1, "Year cannot be in the future"),
    length: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num < 1000;
      },
      "Length must be a positive number less than 1000 feet"
    ),
    beam: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num < 100;
      },
      "Beam must be a positive number less than 100 feet"
    ),
    draft: z.string().optional().refine(
      (val) => {
        if (!val) return true;
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num < 50;
      },
      "Draft must be a positive number less than 50 feet"
    ),
  });

  private static readonly slipImportSchema = insertSlipSchema.extend({
    number: z.string().min(1, "Slip number is required"),
    type: z.enum(["wet", "dry_stack", "trailer"], {
      errorMap: () => ({ message: "Slip type must be 'wet', 'dry_stack', or 'trailer'" })
    }),
    section: z.string().min(1, "Section is required"),
    monthlyRate: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0;
      },
      "Monthly rate must be a positive number"
    ),
    maxLength: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num < 1000;
      },
      "Max length must be a positive number less than 1000 feet"
    ),
    maxBeam: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0 && num < 100;
      },
      "Max beam must be a positive number less than 100 feet"
    ),
  });

  private static readonly leaseImportSchema = insertLeaseSchema.extend({
    startDate: z.date({
      errorMap: () => ({ message: "Valid start date is required" })
    }),
    endDate: z.date().optional().refine(
      (val, ctx) => {
        if (!val) return true;
        const startDate = (ctx.parent as any).startDate;
        return !startDate || val > startDate;
      },
      "End date must be after start date"
    ),
    monthlyRate: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0;
      },
      "Monthly rate must be a positive number"
    ),
  });

  static validateCustomer(data: any): ValidationResult {
    return this.validate(this.customerImportSchema, data, 'customer');
  }

  static validateBoat(data: any): ValidationResult {
    return this.validate(this.boatImportSchema, data, 'boat');
  }

  static validateSlip(data: any): ValidationResult {
    return this.validate(this.slipImportSchema, data, 'slip');
  }

  static validateLease(data: any): ValidationResult {
    return this.validate(this.leaseImportSchema, data, 'lease');
  }

  private static validate(schema: z.ZodSchema, data: any, entityType: string): ValidationResult {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: []
    };

    try {
      schema.parse(data);
    } catch (error) {
      result.success = false;
      
      if (error instanceof z.ZodError) {
        result.errors = error.errors.map(err => {
          const path = err.path.length > 0 ? ` (${err.path.join('.')})` : '';
          return `${err.message}${path}`;
        });
      } else {
        result.errors = [error.message || `Unknown validation error for ${entityType}`];
      }
    }

    // Add business logic warnings
    result.warnings.push(...this.getBusinessWarnings(data, entityType));

    return result;
  }

  private static getBusinessWarnings(data: any, entityType: string): string[] {
    const warnings: string[] = [];

    switch (entityType) {
      case 'customer':
        if (data.phone && !/^\+?1?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}$/.test(data.phone)) {
          warnings.push('Phone number format may not be US standard');
        }
        break;

      case 'boat':
        if (data.year && data.year < 1950) {
          warnings.push('Boat year is very old, please verify');
        }
        if (data.length && parseFloat(data.length) > 100) {
          warnings.push('Boat length is unusually large, please verify');
        }
        break;

      case 'slip':
        if (data.monthlyRate && parseFloat(data.monthlyRate) > 10000) {
          warnings.push('Monthly rate is unusually high, please verify');
        }
        if (data.monthlyRate && parseFloat(data.monthlyRate) < 50) {
          warnings.push('Monthly rate is unusually low, please verify');
        }
        break;

      case 'lease':
        if (data.startDate && data.startDate > new Date()) {
          const monthsOut = Math.floor((data.startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 30));
          if (monthsOut > 12) {
            warnings.push('Lease start date is more than a year in the future');
          }
        }
        break;
    }

    return warnings;
  }

  static validateImportFile(fileName: string, fileSize: number): ValidationResult {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: []
    };

    // File extension validation
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(extension)) {
      result.success = false;
      result.errors.push(`File type ${extension} is not supported. Allowed types: ${allowedExtensions.join(', ')}`);
    }

    // File size validation (20MB limit)
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (fileSize > maxSize) {
      result.success = false;
      result.errors.push(`File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds the maximum allowed size of 20MB`);
    }

    // File size warnings
    if (fileSize > 10 * 1024 * 1024) { // 10MB
      result.warnings.push('Large file detected. Processing may take several minutes.');
    }

    return result;
  }

  static validateColumnMapping(mappings: any[], entity: string): ValidationResult {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: []
    };

    // Required field mappings by entity
    const requiredMappings: Record<string, string[]> = {
      customer: ['firstName', 'lastName', 'email'],
      boat: ['name', 'make', 'model', 'year', 'length', 'beam'],
      slip: ['number', 'type', 'section', 'maxLength', 'maxBeam', 'monthlyRate'],
      lease: ['startDate', 'monthlyRate']
    };

    const requiredFields = requiredMappings[entity] || [];
    const mappedFields = mappings.map(m => m.targetField);

    // Check for missing required mappings
    for (const field of requiredFields) {
      if (!mappedFields.includes(field)) {
        result.errors.push(`Missing required mapping for field: ${field}`);
        result.success = false;
      }
    }

    // Check for duplicate mappings
    const duplicates = mappedFields.filter((field, index) => mappedFields.indexOf(field) !== index);
    if (duplicates.length > 0) {
      result.errors.push(`Duplicate mappings found for fields: ${duplicates.join(', ')}`);
      result.success = false;
    }

    // Warnings for optional but recommended fields
    const recommendedMappings: Record<string, string[]> = {
      customer: ['phone', 'address'],
      boat: ['hullId', 'registrationNumber'],
      slip: ['utilities'],
      lease: ['endDate', 'depositAmount']
    };

    const recommendedFields = recommendedMappings[entity] || [];
    for (const field of recommendedFields) {
      if (!mappedFields.includes(field)) {
        result.warnings.push(`Recommended field not mapped: ${field}`);
      }
    }

    return result;
  }

  static validateRowData(row: Record<string, any>, rowIndex: number): ValidationResult {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: []
    };

    // Check for completely empty rows
    const hasData = Object.values(row).some(value => 
      value !== null && value !== undefined && value !== ''
    );

    if (!hasData) {
      result.warnings.push(`Row ${rowIndex + 1} appears to be empty`);
      return result;
    }

    // Check for suspicious data patterns
    const values = Object.values(row).map(v => String(v).trim());
    
    // All values are the same (possible header row or test data)
    if (values.length > 1 && values.every(v => v === values[0] && v !== '')) {
      result.warnings.push(`Row ${rowIndex + 1} has all identical values, may be test data`);
    }

    // Check for HTML/XML content (possible copy-paste from web)
    if (values.some(v => /<[^>]+>/.test(v))) {
      result.warnings.push(`Row ${rowIndex + 1} contains HTML/XML content`);
    }

    return result;
  }
}