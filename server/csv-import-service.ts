import Papa from 'papaparse';

export interface CSVRow {
  [key: string]: string;
}

export interface FieldMapping {
  csvColumn: string;
  crmField: string;
  transform?: (value: string) => any;
}

export interface ParsedCSV {
  headers: string[];
  rows: CSVRow[];
  totalRows: number;
}

export interface ValidationIssue {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// Pipedrive field mapping rules
const PIPEDRIVE_FIELD_MAPPINGS: Record<string, { crmField: string; transform?: (val: string) => any }> = {
  'Person - Name': { crmField: 'fullName' },
  'Person - First name': { crmField: 'firstName' },
  'Person - Last name': { crmField: 'lastName' },
  'Person - Email - Work': { crmField: 'email' },
  'Person - Email - Home': { crmField: 'emailHome' },
  'Person - Email - Other': { crmField: 'emailOther' },
  'Person - Phone - Work': { crmField: 'phone' },
  'Person - Phone - Home': { crmField: 'phoneHome' },
  'Person - Phone - Mobile': { crmField: 'phoneMobile' },
  'Person - Phone - Other': { crmField: 'phoneOther' },
  'Person - Organization': { crmField: 'company' },
  'Organization - Name of Marina(s)': { crmField: 'marinaName' },
  'Person - Labels': { crmField: 'labels', transform: (val) => val ? val.split(', ').map(l => l.trim()) : [] },
  'Person - Last activity date': { crmField: 'lastActivityDate', transform: (val) => val ? new Date(val).toISOString() : null },
  'Person - Next activity date': { crmField: 'nextActivityDate', transform: (val) => val ? new Date(val).toISOString() : null },
  'Person - State': { crmField: 'state' },
  'Organization - Address': { crmField: 'address' },
  'Organization - House number of Address': { crmField: 'houseNumber' },
  'Organization - Street/road name of Address': { crmField: 'street' },
  'Organization - Apartment/suite number of Address': { crmField: 'unit' },
  'Organization - City of Address': { crmField: 'city' },
  'Organization - State/province of Address': { crmField: 'state' },
  'Organization - Zip code of Address': { crmField: 'zipCode' },
  'Organization - Full address of Address': { crmField: 'fullAddress' },
};

export class CSVImportService {
  /**
   * Parse CSV file content
   */
  static parseCSV(csvContent: string): ParsedCSV {
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (result.errors && result.errors.length > 0) {
      throw new Error(`CSV parsing error: ${result.errors[0].message}`);
    }

    return {
      headers: result.meta.fields || [],
      rows: result.data as CSVRow[],
      totalRows: result.data.length,
    };
  }

  /**
   * Auto-detect field mappings based on column names
   */
  static autoDetectMappings(headers: string[], entityType: string = 'contacts'): FieldMapping[] {
    const mappings: FieldMapping[] = [];

    for (const header of headers) {
      const mapping = PIPEDRIVE_FIELD_MAPPINGS[header];
      if (mapping) {
        mappings.push({
          csvColumn: header,
          crmField: mapping.crmField,
          transform: mapping.transform,
        });
      } else {
        // For unmapped fields, create custom field mapping
        const customFieldName = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        mappings.push({
          csvColumn: header,
          crmField: `custom_${customFieldName}`,
        });
      }
    }

    return mappings;
  }

  /**
   * Transform CSV row to contact object based on field mappings
   */
  static transformRow(row: CSVRow, mappings: FieldMapping[]): any {
    const contact: any = {};
    const customFields: any = {};

    for (const mapping of mappings) {
      const value = row[mapping.csvColumn];
      
      if (!value || value.trim() === '') {
        continue;
      }

      const transformedValue = mapping.transform 
        ? mapping.transform(value)
        : value.trim();

      if (mapping.crmField.startsWith('custom_')) {
        customFields[mapping.crmField] = transformedValue;
      } else {
        contact[mapping.crmField] = transformedValue;
      }
    }

    // Handle special case: split full name if firstName/lastName not provided
    if (contact.fullName && !contact.firstName && !contact.lastName) {
      const nameParts = contact.fullName.split(' ');
      contact.firstName = nameParts[0] || '';
      contact.lastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
      delete contact.fullName;
    }

    // Handle multiple emails
    const emails = [contact.email, contact.emailHome, contact.emailOther]
      .filter(e => e)
      .join(', ');
    if (emails) {
      contact.email = contact.email || contact.emailHome || contact.emailOther;
      if (Object.keys({ emailHome: contact.emailHome, emailOther: contact.emailOther }).length > 0) {
        customFields.additionalEmails = emails;
      }
    }

    // Handle multiple phones
    const phones = [contact.phone, contact.phoneHome, contact.phoneMobile, contact.phoneOther]
      .filter(p => p)
      .join(', ');
    if (phones) {
      contact.phone = contact.phone || contact.phoneMobile || contact.phoneHome || contact.phoneOther;
      if (Object.keys({ phoneHome: contact.phoneHome, phoneMobile: contact.phoneMobile, phoneOther: contact.phoneOther }).length > 0) {
        customFields.additionalPhones = phones;
      }
    }

    // Attach custom fields as JSONB
    if (Object.keys(customFields).length > 0) {
      contact.customFields = customFields;
    }

    return contact;
  }

  /**
   * Validate contact data
   */
  static validateContact(contact: any, rowNumber: number): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Required fields
    if (!contact.firstName && !contact.lastName) {
      issues.push({
        row: rowNumber,
        field: 'name',
        message: 'Either first name or last name is required',
        severity: 'error',
      });
    }

    if (!contact.email && !contact.phone) {
      issues.push({
        row: rowNumber,
        field: 'contact',
        message: 'Either email or phone is required',
        severity: 'error',
      });
    }

    // Email validation
    if (contact.email && !this.isValidEmail(contact.email)) {
      issues.push({
        row: rowNumber,
        field: 'email',
        message: `Invalid email format: ${contact.email}`,
        severity: 'warning',
      });
    }

    // Phone validation (basic cleanup)
    if (contact.phone) {
      contact.phone = this.cleanPhone(contact.phone);
    }

    return issues;
  }

  /**
   * Email validation
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Clean phone number
   */
  private static cleanPhone(phone: string): string {
    // Remove common formatting characters
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Extract emails from comma-separated list
   */
  static extractEmails(value: string): string[] {
    if (!value) return [];
    return value.split(',').map(e => e.trim()).filter(e => e);
  }

  /**
   * Extract phones from comma-separated list
   */
  static extractPhones(value: string): string[] {
    if (!value) return [];
    return value.split(',').map(p => p.trim()).filter(p => p);
  }
}
