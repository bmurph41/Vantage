import { describe, it, expect } from 'vitest';
import {
  sanitizeImportNumber,
  sanitizeImportDate,
  validateRentRollImport,
  validateSalesCompImport,
  sanitizeImportRow,
} from './import-validators';

describe('sanitizeImportNumber', () => {
  it('parses numeric values', () => {
    expect(sanitizeImportNumber(500)).toBe(500);
    expect(sanitizeImportNumber(99.99)).toBeCloseTo(99.99);
  });

  it('parses string numbers', () => {
    expect(sanitizeImportNumber('500')).toBe(500);
    expect(sanitizeImportNumber('1000.50')).toBeCloseTo(1000.50);
  });

  it('strips currency formatting', () => {
    expect(sanitizeImportNumber('$500')).toBe(500);
    expect(sanitizeImportNumber('$1,000')).toBe(1000);
    expect(sanitizeImportNumber('$1,234.56')).toBeCloseTo(1234.56);
  });

  it('strips whitespace', () => {
    expect(sanitizeImportNumber(' 500 ')).toBe(500);
  });

  it('returns default for invalid values', () => {
    expect(sanitizeImportNumber(null, 99)).toBe(99);
    expect(sanitizeImportNumber(undefined, 99)).toBe(99);
    expect(sanitizeImportNumber('', 99)).toBe(99);
    expect(sanitizeImportNumber('invalid', 99)).toBe(99);
    expect(sanitizeImportNumber(NaN, 99)).toBe(99);
  });

  it('handles negative numbers', () => {
    expect(sanitizeImportNumber(-100)).toBe(-100);
    expect(sanitizeImportNumber('-100')).toBe(-100);
  });
});

describe('sanitizeImportDate', () => {
  it('parses ISO date format', () => {
    const result = sanitizeImportDate('2024-01-15');
    expect(result).toBe('2024-01-15');
  });

  it('parses MM/DD/YYYY format', () => {
    const result = sanitizeImportDate('01/15/2024');
    expect(result).not.toBeNull();
  });

  it('parses MM-DD-YYYY format', () => {
    const result = sanitizeImportDate('01-15-2024');
    expect(result).not.toBeNull();
  });

  it('returns null for empty values', () => {
    expect(sanitizeImportDate(null)).toBeNull();
    expect(sanitizeImportDate(undefined)).toBeNull();
    expect(sanitizeImportDate('')).toBeNull();
  });

  it('returns null for invalid dates', () => {
    expect(sanitizeImportDate('not a date')).toBeNull();
  });

  it('trims whitespace', () => {
    const result = sanitizeImportDate('  2024-01-15  ');
    expect(result).not.toBeNull();
  });
});

describe('validateRentRollImport', () => {
  const validPayload = {
    locationId: '550e8400-e29b-41d4-a716-446655440000',
    rows: [
      { tenantName: 'John Doe', unitNumber: 'A-101', monthlyRent: 500 },
      { tenantName: 'Jane Smith', slipNumber: 'B-202', monthlyRent: 600 },
    ],
  };

  it('validates correct payload', () => {
    const result = validateRentRollImport(validPayload);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('requires at least one row', () => {
    const payload = { locationId: '550e8400-e29b-41d4-a716-446655440000', rows: [] };
    const result = validateRentRollImport(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('requires valid location ID', () => {
    const payload = { locationId: 'invalid', rows: [{ tenantName: 'Test' }] };
    const result = validateRentRollImport(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'locationId')).toBe(true);
  });

  it('requires tenant name', () => {
    const payload = {
      locationId: '550e8400-e29b-41d4-a716-446655440000',
      rows: [{ tenantName: '' }],
    };
    const result = validateRentRollImport(payload);
    expect(result.success).toBe(false);
  });

  it('warns when monthly and annual rent mismatch', () => {
    const payload = {
      locationId: '550e8400-e29b-41d4-a716-446655440000',
      rows: [{ tenantName: 'Test', monthlyRent: 500, annualRent: 5000 }],
    };
    const result = validateRentRollImport(payload);
    expect(result.success).toBe(true);
    expect(result.warnings?.some(w => w.field === 'rent')).toBe(true);
  });

  it('errors when lease end is before start', () => {
    const payload = {
      locationId: '550e8400-e29b-41d4-a716-446655440000',
      rows: [{ tenantName: 'Test', leaseStart: '2024-12-01', leaseEnd: '2024-01-01' }],
    };
    const result = validateRentRollImport(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'leaseEnd')).toBe(true);
  });

  it('errors on negative rent', () => {
    const payload = {
      locationId: '550e8400-e29b-41d4-a716-446655440000',
      rows: [{ tenantName: 'Test', monthlyRent: -100 }],
    };
    const result = validateRentRollImport(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'rent')).toBe(true);
  });

  it('handles currency formatted rent', () => {
    const payload = {
      locationId: '550e8400-e29b-41d4-a716-446655440000',
      rows: [{ tenantName: 'Test', monthlyRent: '$1,500' }],
    };
    const result = validateRentRollImport(payload);
    expect(result.success).toBe(true);
  });

  it('accepts optional options', () => {
    const payload = {
      ...validPayload,
      options: { skipDuplicates: true, updateExisting: false },
    };
    const result = validateRentRollImport(payload);
    expect(result.success).toBe(true);
    expect(result.data?.options?.skipDuplicates).toBe(true);
  });
});

describe('validateSalesCompImport', () => {
  const validPayload = {
    rows: [
      { propertyName: 'Marina One', salePrice: 5000000, slipCount: 100 },
      { propertyName: 'Marina Two', salePrice: 3000000, slipCount: 75 },
    ],
  };

  it('validates correct payload', () => {
    const result = validateSalesCompImport(validPayload);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('requires at least one row', () => {
    const result = validateSalesCompImport({ rows: [] });
    expect(result.success).toBe(false);
  });

  it('requires property name', () => {
    const result = validateSalesCompImport({ rows: [{ propertyName: '' }] });
    expect(result.success).toBe(false);
  });

  it('errors on negative sale price', () => {
    const payload = { rows: [{ propertyName: 'Test', salePrice: -1000 }] };
    const result = validateSalesCompImport(payload);
    expect(result.success).toBe(false);
    expect(result.errors?.some(e => e.field === 'salePrice')).toBe(true);
  });

  it('warns on invalid cap rate', () => {
    const payload = { rows: [{ propertyName: 'Test', capRate: 150 }] };
    const result = validateSalesCompImport(payload);
    expect(result.success).toBe(true);
    expect(result.warnings?.some(w => w.field === 'capRate')).toBe(true);
  });

  it('handles currency formatted prices', () => {
    const payload = { rows: [{ propertyName: 'Test', salePrice: '$5,000,000' }] };
    const result = validateSalesCompImport(payload);
    expect(result.success).toBe(true);
  });
});

describe('sanitizeImportRow', () => {
  it('sanitizes numeric fields', () => {
    const row = { amount: '$1,500', name: 'Test' };
    const result = sanitizeImportRow(row, ['amount'], []);
    expect(result.amount).toBe(1500);
    expect(result.name).toBe('Test');
  });

  it('sanitizes date fields', () => {
    const row = { startDate: '01/15/2024', name: 'Test' };
    const result = sanitizeImportRow(row, [], ['startDate']);
    expect(result.startDate).not.toBeNull();
    expect(result.name).toBe('Test');
  });

  it('handles mixed field types', () => {
    const row = { amount: '$500', date: '2024-01-15', note: 'memo' };
    const result = sanitizeImportRow(row, ['amount'], ['date']);
    expect(result.amount).toBe(500);
    expect(result.date).not.toBeNull();
    expect(result.note).toBe('memo');
  });

  it('preserves unspecified fields', () => {
    const row = { price: '$100', extra: 'value' };
    const result = sanitizeImportRow(row, ['price'], []);
    expect(result.extra).toBe('value');
  });
});
