import { type InsertCustomer, type InsertBoat, type InsertSlip, type InsertLease } from "@shared/schema";

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: any) => any;
  required?: boolean;
}

export interface MappingConfig {
  entity: 'customer' | 'boat' | 'slip' | 'lease';
  mappings: ColumnMapping[];
  duplicateStrategy: 'skip' | 'update' | 'error';
}

export class DataMapper {
  // Common column mappings for different rent roll formats
  static readonly COMMON_MAPPINGS = {
    customer: {
      // Standard variations for customer fields
      firstName: ['first_name', 'firstname', 'fname', 'customer_first_name', 'tenant_first_name'],
      lastName: ['last_name', 'lastname', 'lname', 'customer_last_name', 'tenant_last_name'],
      email: ['email', 'email_address', 'customer_email', 'tenant_email', 'contact_email'],
      phone: ['phone', 'phone_number', 'telephone', 'customer_phone', 'tenant_phone', 'contact_phone'],
      address: ['address', 'street_address', 'customer_address', 'tenant_address', 'mailing_address']
    },
    boat: {
      name: ['boat_name', 'vessel_name', 'boat', 'vessel', 'name'],
      make: ['make', 'manufacturer', 'boat_make', 'vessel_make'],
      model: ['model', 'boat_model', 'vessel_model'],
      year: ['year', 'boat_year', 'vessel_year', 'model_year'],
      length: ['length', 'boat_length', 'vessel_length', 'loa', 'overall_length'],
      beam: ['beam', 'boat_beam', 'vessel_beam', 'width'],
      draft: ['draft', 'boat_draft', 'vessel_draft'],
      hullId: ['hull_id', 'hull_number', 'hin', 'boat_id', 'vessel_id'],
      registrationNumber: ['registration', 'registration_number', 'reg_number', 'state_registration']
    },
    slip: {
      number: ['slip_number', 'slip', 'berth', 'berth_number', 'dock_number'],
      type: ['slip_type', 'berth_type', 'type'],
      section: ['section', 'dock', 'pier', 'marina_section'],
      maxLength: ['max_length', 'slip_length', 'berth_length'],
      maxBeam: ['max_beam', 'slip_beam', 'berth_beam', 'max_width'],
      maxDraft: ['max_draft', 'slip_draft', 'berth_draft'],
      monthlyRate: ['monthly_rate', 'rate', 'monthly_rent', 'slip_rate', 'berth_rate']
    },
    lease: {
      startDate: ['start_date', 'lease_start', 'move_in_date', 'begin_date'],
      endDate: ['end_date', 'lease_end', 'move_out_date', 'expiry_date'],
      monthlyRate: ['monthly_rate', 'rate', 'monthly_rent', 'lease_rate'],
      depositAmount: ['deposit', 'security_deposit', 'deposit_amount']
    }
  };

  static detectColumnMappings(headers: string[], entity: 'customer' | 'boat' | 'slip' | 'lease'): ColumnMapping[] {
    const mappings: ColumnMapping[] = [];
    const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    const commonMappings = this.COMMON_MAPPINGS[entity];

    for (const [targetField, variations] of Object.entries(commonMappings)) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const normalizedHeader = normalizedHeaders[i];
        if (variations.some(variation => normalizedHeader.includes(variation))) {
          mappings.push({
            sourceColumn: headers[i],
            targetField,
            transform: this.getTransformFunction(targetField),
            required: this.isRequiredField(entity, targetField)
          });
          break; // Use first match only
        }
      }
    }

    return mappings;
  }

  static mapRowToEntity(
    row: Record<string, any>, 
    mappings: ColumnMapping[], 
    entity: 'customer' | 'boat' | 'slip' | 'lease'
  ): Partial<InsertCustomer | InsertBoat | InsertSlip | InsertLease> {
    const mapped: Record<string, any> = {};

    for (const mapping of mappings) {
      let value = row[mapping.sourceColumn];
      
      // Skip empty values
      if (value === null || value === undefined || value === '') {
        continue;
      }

      // Apply transformation if specified
      if (mapping.transform) {
        try {
          value = mapping.transform(value);
        } catch (error) {
          console.warn(`Transform failed for ${mapping.targetField}:`, error);
          continue;
        }
      }

      mapped[mapping.targetField] = value;
    }

    return mapped;
  }

  private static getTransformFunction(fieldName: string): ((value: any) => any) | undefined {
    const transforms: Record<string, (value: any) => any> = {
      email: (value: any) => String(value).toLowerCase().trim(),
      phone: (value: any) => String(value).replace(/[^\d+\-\(\)\s]/g, '').trim(),
      year: (value: any) => {
        const num = parseInt(String(value));
        return isNaN(num) ? null : num;
      },
      length: (value: any) => this.parseDecimal(value),
      beam: (value: any) => this.parseDecimal(value),
      draft: (value: any) => this.parseDecimal(value),
      maxLength: (value: any) => this.parseDecimal(value),
      maxBeam: (value: any) => this.parseDecimal(value),
      maxDraft: (value: any) => this.parseDecimal(value),
      monthlyRate: (value: any) => this.parseDecimal(value),
      depositAmount: (value: any) => this.parseDecimal(value),
      startDate: (value: any) => this.parseDate(value),
      endDate: (value: any) => this.parseDate(value),
      type: (value: any) => this.normalizeSlipType(value)
    };

    return transforms[fieldName];
  }

  private static parseDecimal(value: any): string | null {
    if (typeof value === 'number') {
      return value.toString();
    }
    
    const cleaned = String(value).replace(/[^\d.,]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num.toString();
  }

  private static parseDate(value: any): Date | null {
    if (value instanceof Date) {
      return value;
    }
    
    if (typeof value === 'number') {
      // Excel date serial number
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }
    
    const parsed = new Date(String(value));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private static normalizeSlipType(value: any): string {
    const normalized = String(value).toLowerCase().trim();
    
    if (normalized.includes('wet') || normalized.includes('water')) {
      return 'wet';
    } else if (normalized.includes('dry') || normalized.includes('stack')) {
      return 'dry_stack';
    } else if (normalized.includes('trailer')) {
      return 'trailer';
    }
    
    return 'wet'; // Default
  }

  private static isRequiredField(entity: string, fieldName: string): boolean {
    const requiredFields: Record<string, string[]> = {
      customer: ['firstName', 'lastName', 'email'],
      boat: ['name', 'make', 'model', 'year', 'length', 'beam'],
      slip: ['number', 'type', 'section', 'maxLength', 'maxBeam', 'monthlyRate'],
      lease: ['startDate', 'monthlyRate']
    };

    return requiredFields[entity]?.includes(fieldName) || false;
  }

  static generateMappingSuggestions(headers: string[]): Record<string, ColumnMapping[]> {
    return {
      customer: this.detectColumnMappings(headers, 'customer'),
      boat: this.detectColumnMappings(headers, 'boat'),
      slip: this.detectColumnMappings(headers, 'slip'),
      lease: this.detectColumnMappings(headers, 'lease')
    };
  }

  static validateMappings(mappings: ColumnMapping[], entity: string): string[] {
    const errors: string[] = [];
    const requiredFields = this.isRequiredField.toString(); // Get required fields logic
    
    // Check for missing required mappings
    const mappedFields = mappings.map(m => m.targetField);
    const required = this.getRequiredFields(entity);
    
    for (const field of required) {
      if (!mappedFields.includes(field)) {
        errors.push(`Missing required mapping for field: ${field}`);
      }
    }

    return errors;
  }

  private static getRequiredFields(entity: string): string[] {
    const requiredFields: Record<string, string[]> = {
      customer: ['firstName', 'lastName', 'email'],
      boat: ['name', 'make', 'model', 'year', 'length', 'beam'],
      slip: ['number', 'type', 'section', 'maxLength', 'maxBeam', 'monthlyRate'],
      lease: ['startDate', 'monthlyRate']
    };

    return requiredFields[entity] || [];
  }
}