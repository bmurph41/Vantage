import { db } from "../../db";
import { scValidationRules } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface ValidationResult {
  passed: boolean;
  field: string;
  value: any;
  ruleId: string;
  ruleName: string;
  severity: 'warning' | 'error';
  message: string;
  suggestedAction?: string;
  autoFixValue?: string | null;
}

export interface RowValidationResult {
  rowIndex: number;
  passed: boolean;
  results: ValidationResult[];
  warnings: ValidationResult[];
  errors: ValidationResult[];
}

export interface BatchValidationSummary {
  totalRows: number;
  passedRows: number;
  warningRows: number;
  errorRows: number;
  outliers: Array<{ row: number; field: string; value: any; reason: string }>;
  byField: Record<string, { warnings: number; errors: number }>;
}

const DEFAULT_VALIDATION_RULES = [
  {
    name: 'Cap Rate Range',
    field: 'capRate',
    ruleType: 'range',
    severity: 'warning',
    minValue: 300, // 3%
    maxValue: 1500, // 15%
    suggestedAction: 'flag',
  },
  {
    name: 'Sale Price Minimum',
    field: 'salePrice',
    ruleType: 'range',
    severity: 'warning',
    minValue: 100000, // $100k minimum
    maxValue: 500000000, // $500M maximum
    suggestedAction: 'flag',
  },
  {
    name: 'Sale Year Valid',
    field: 'saleYear',
    ruleType: 'range',
    severity: 'error',
    minValue: 1990,
    maxValue: new Date().getFullYear() + 1,
    suggestedAction: 'exclude',
  },
  {
    name: 'Wet Slips Reasonable',
    field: 'wetSlips',
    ruleType: 'range',
    severity: 'warning',
    minValue: 0,
    maxValue: 2000,
    suggestedAction: 'flag',
  },
  {
    name: 'Dry Racks Reasonable',
    field: 'dryRacks',
    ruleType: 'range',
    severity: 'warning',
    minValue: 0,
    maxValue: 5000,
    suggestedAction: 'flag',
  },
  {
    name: 'State Code Valid',
    field: 'state',
    ruleType: 'format',
    severity: 'warning',
    pattern: '^[A-Z]{2}$',
    suggestedAction: 'auto_fix',
  },
  {
    name: 'Sale Month Valid',
    field: 'saleMonth',
    ruleType: 'range',
    severity: 'error',
    minValue: 1,
    maxValue: 12,
    suggestedAction: 'exclude',
  },
  {
    name: 'NOI Non-Negative',
    field: 'noi',
    ruleType: 'range',
    severity: 'warning',
    minValue: -1000000, // Allow some negative for distressed assets
    maxValue: 100000000, // $100M max NOI
    suggestedAction: 'flag',
  },
  {
    name: 'Price Per Slip Reasonable',
    field: 'pricePerSlip',
    ruleType: 'range',
    severity: 'warning',
    minValue: 5000, // $5k per slip
    maxValue: 1000000, // $1M per slip
    suggestedAction: 'flag',
  },
  {
    name: 'Occupancy Percentage',
    field: 'occupancy',
    ruleType: 'range',
    severity: 'warning',
    minValue: 0,
    maxValue: 100,
    suggestedAction: 'auto_fix',
  },
];

export class ValidationService {

  async getOrganizationRules(orgId: string): Promise<typeof scValidationRules.$inferSelect[]> {
    try {
      const rules = await db.select()
        .from(scValidationRules)
        .where(and(
          eq(scValidationRules.orgId, orgId),
          eq(scValidationRules.isActive, true)
        ));
      
      return rules;
    } catch (error) {
      console.error('[Validation] Error fetching rules:', error);
      return [];
    }
  }

  getDefaultRules(): typeof DEFAULT_VALIDATION_RULES {
    return DEFAULT_VALIDATION_RULES;
  }

  async validateRow(
    row: Record<string, any>,
    rowIndex: number,
    orgId?: string
  ): Promise<RowValidationResult> {
    let rules = this.getDefaultRules();
    
    if (orgId) {
      const orgRules = await this.getOrganizationRules(orgId);
      if (orgRules.length > 0) {
        rules = orgRules.map(r => ({
          name: r.name,
          field: r.field,
          ruleType: r.ruleType,
          severity: (r.severity || 'warning') as 'warning' | 'error',
          minValue: r.minValue ? parseFloat(r.minValue) : undefined,
          maxValue: r.maxValue ? parseFloat(r.maxValue) : undefined,
          pattern: r.pattern || undefined,
          suggestedAction: r.suggestedAction || 'flag',
          autoFixValue: r.autoFixValue || undefined,
        }));
      }
    }

    const results: ValidationResult[] = [];
    
    for (const rule of rules) {
      const value = row[rule.field];
      
      if (value === null || value === undefined || value === '') {
        continue;
      }

      const result = this.applyRule(rule, value);
      if (result) {
        results.push({
          ...result,
          field: rule.field,
          ruleId: rule.name.toLowerCase().replace(/\s+/g, '_'),
          ruleName: rule.name,
        });
      }
    }

    const warnings = results.filter(r => r.severity === 'warning');
    const errors = results.filter(r => r.severity === 'error');

    return {
      rowIndex,
      passed: errors.length === 0,
      results,
      warnings,
      errors,
    };
  }

  private applyRule(
    rule: typeof DEFAULT_VALIDATION_RULES[0],
    value: any
  ): Omit<ValidationResult, 'field' | 'ruleId' | 'ruleName'> | null {
    switch (rule.ruleType) {
      case 'range':
        return this.validateRange(rule, value);
      case 'format':
        return this.validateFormat(rule, value);
      case 'required':
        return this.validateRequired(rule, value);
      default:
        return null;
    }
  }

  private validateRange(
    rule: typeof DEFAULT_VALIDATION_RULES[0],
    value: any
  ): Omit<ValidationResult, 'field' | 'ruleId' | 'ruleName'> | null {
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    
    if (isNaN(numValue)) {
      return null;
    }

    if (rule.minValue !== undefined && numValue < rule.minValue) {
      return {
        passed: false,
        value,
        severity: rule.severity as 'warning' | 'error',
        message: `${rule.name}: Value ${numValue} is below minimum ${rule.minValue}`,
        suggestedAction: rule.suggestedAction,
        autoFixValue: rule.minValue?.toString(),
      };
    }

    if (rule.maxValue !== undefined && numValue > rule.maxValue) {
      return {
        passed: false,
        value,
        severity: rule.severity as 'warning' | 'error',
        message: `${rule.name}: Value ${numValue} exceeds maximum ${rule.maxValue}`,
        suggestedAction: rule.suggestedAction,
        autoFixValue: rule.maxValue?.toString(),
      };
    }

    return null;
  }

  private validateFormat(
    rule: typeof DEFAULT_VALIDATION_RULES[0],
    value: any
  ): Omit<ValidationResult, 'field' | 'ruleId' | 'ruleName'> | null {
    if (!rule.pattern) return null;

    const strValue = String(value);
    const regex = new RegExp(rule.pattern);

    if (!regex.test(strValue)) {
      return {
        passed: false,
        value,
        severity: rule.severity as 'warning' | 'error',
        message: `${rule.name}: Value "${strValue}" does not match expected format`,
        suggestedAction: rule.suggestedAction,
        autoFixValue: null,
      };
    }

    return null;
  }

  private validateRequired(
    rule: typeof DEFAULT_VALIDATION_RULES[0],
    value: any
  ): Omit<ValidationResult, 'field' | 'ruleId' | 'ruleName'> | null {
    if (value === null || value === undefined || value === '') {
      return {
        passed: false,
        value,
        severity: rule.severity as 'warning' | 'error',
        message: `${rule.name}: Required field is missing`,
        suggestedAction: rule.suggestedAction,
        autoFixValue: null,
      };
    }

    return null;
  }

  async validateBatch(
    rows: Record<string, any>[],
    orgId?: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<{
    results: RowValidationResult[];
    summary: BatchValidationSummary;
  }> {
    const results: RowValidationResult[] = [];
    const byField: Record<string, { warnings: number; errors: number }> = {};
    const outliers: BatchValidationSummary['outliers'] = [];

    for (let i = 0; i < rows.length; i++) {
      const result = await this.validateRow(rows[i], i, orgId);
      results.push(result);

      for (const validation of result.results) {
        if (!byField[validation.field]) {
          byField[validation.field] = { warnings: 0, errors: 0 };
        }
        if (validation.severity === 'warning') {
          byField[validation.field].warnings++;
          outliers.push({
            row: i,
            field: validation.field,
            value: validation.value,
            reason: validation.message,
          });
        } else {
          byField[validation.field].errors++;
        }
      }

      if (onProgress) {
        onProgress(i + 1, rows.length);
      }
    }

    const summary: BatchValidationSummary = {
      totalRows: rows.length,
      passedRows: results.filter(r => r.passed && r.warnings.length === 0).length,
      warningRows: results.filter(r => r.passed && r.warnings.length > 0).length,
      errorRows: results.filter(r => !r.passed).length,
      outliers: outliers.slice(0, 100), // Limit to first 100 outliers
      byField,
    };

    return { results, summary };
  }

  detectOutliers(
    rows: Record<string, any>[],
    field: string,
    method: 'iqr' | 'zscore' = 'iqr'
  ): number[] {
    const values = rows
      .map((row, index) => ({ index, value: parseFloat(row[field]) }))
      .filter(v => !isNaN(v.value));

    if (values.length < 4) {
      return [];
    }

    if (method === 'zscore') {
      return this.detectOutliersZScore(values);
    }

    return this.detectOutliersIQR(values);
  }

  private detectOutliersIQR(
    values: { index: number; value: number }[]
  ): number[] {
    const sorted = [...values].sort((a, b) => a.value - b.value);
    const n = sorted.length;
    
    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);
    
    const q1 = sorted[q1Index].value;
    const q3 = sorted[q3Index].value;
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return values
      .filter(v => v.value < lowerBound || v.value > upperBound)
      .map(v => v.index);
  }

  private detectOutliersZScore(
    values: { index: number; value: number }[]
  ): number[] {
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v.value, 0) / n;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v.value - mean, 2), 0) / n
    );

    if (stdDev === 0) {
      return [];
    }

    const threshold = 3;

    return values
      .filter(v => Math.abs((v.value - mean) / stdDev) > threshold)
      .map(v => v.index);
  }
}

export const validationService = new ValidationService();
