import { PL_TO_PROFORMA_MAP, RENT_ROLL_TO_PROFORMA_MAP, FIELD_DISPLAY_LABELS, FIELD_GROUPS } from './proforma-mapper.js';

export interface FlatField {
  schema_key: string;
  display_label: string;
  field_group: string;
  raw_value: string | null;
  normalized_value: number | null;
  value_type: 'currency' | 'percentage' | 'integer' | 'text' | 'date';
  period_label: string | null;
  confidence_score: number;
  source_page: number | null;
  source_sheet: string | null;
  source_row: number | null;
  source_snippet: string | null;
  proforma_field_key: string | null;
}

export function flattenExtractionResult(
  data: Record<string, any>,
  confidenceScores: Record<string, number>,
  sourceReferences: Record<string, any>,
  docType: 'pl' | 'rent_roll'
): FlatField[] {
  const fields: FlatField[] = [];
  const proformaMap = docType === 'pl' ? PL_TO_PROFORMA_MAP : RENT_ROLL_TO_PROFORMA_MAP;

  if (docType === 'pl') {
    flattenPL(data, confidenceScores, sourceReferences, proformaMap, fields);
  } else {
    flattenRentRoll(data, confidenceScores, sourceReferences, proformaMap, fields);
  }

  return fields;
}

function makeField(
  schemaKey: string,
  value: any,
  confidenceScores: Record<string, number>,
  sourceReferences: Record<string, any>,
  proformaMap: Record<string, string>,
  group?: string,
  periodLabel?: string
): FlatField | null {
  if (value === null || value === undefined) return null;

  const numericValue = typeof value === 'number' ? value
    : typeof value === 'string' ? parseFloat(value.replace(/[$,\(\)]/g, '')) || null
    : null;

  const ref = sourceReferences[schemaKey] || {};
  const confidence = confidenceScores[schemaKey] ?? 0.5;

  return {
    schema_key: schemaKey,
    display_label: FIELD_DISPLAY_LABELS[schemaKey] || schemaKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    field_group: group || FIELD_GROUPS[schemaKey] || 'other',
    raw_value: String(value),
    normalized_value: numericValue,
    value_type: detectValueType(schemaKey, numericValue),
    period_label: periodLabel || null,
    confidence_score: confidence,
    source_page: ref.page || null,
    source_sheet: ref.sheet || null,
    source_row: ref.row || null,
    source_snippet: ref.snippet || null,
    proforma_field_key: proformaMap[schemaKey] || null,
  };
}

function detectValueType(key: string, value: number | null): 'currency' | 'percentage' | 'integer' | 'text' | 'date' {
  if (key.includes('rate') || key.includes('pct') || key === 'occupancy_rate') return 'percentage';
  if (key.includes('units') || key.includes('count') || key.includes('pages')) return 'integer';
  if (key.includes('date') || key.includes('start') || key.includes('end')) return 'date';
  if (value !== null && Math.abs(value) > 100) return 'currency';
  return 'currency';
}

function flattenPL(
  data: Record<string, any>,
  confidenceScores: Record<string, number>,
  sourceReferences: Record<string, any>,
  proformaMap: Record<string, string>,
  out: FlatField[]
) {
  const topLevelKeys = [
    'gross_potential_rent', 'vacancy_loss', 'concessions', 'bad_debt',
    'effective_gross_income', 'parking_income', 'laundry_income', 'late_fees',
    'pet_fees', 'storage_income', 'utility_reimbursements', 'total_other_income',
    'total_revenue', 'management_fees', 'payroll', 'repairs_maintenance',
    'contract_services', 'utilities', 'insurance', 'real_estate_taxes',
    'landscaping', 'administrative', 'advertising_marketing', 'reserves',
    'total_operating_expenses', 'net_operating_income', 'mortgage_payment',
    'interest_expense', 'principal_payment', 'net_cash_flow'
  ];

  for (const key of topLevelKeys) {
    if (data[key] !== undefined) {
      const f = makeField(key, data[key], confidenceScores, sourceReferences, proformaMap);
      if (f) out.push(f);
    }
  }

  // Other income line items
  if (Array.isArray(data.other_income_line_items)) {
    data.other_income_line_items.forEach((item: any, idx: number) => {
      const key = `other_income_${idx}`;
      out.push({
        schema_key: key,
        display_label: item.label || `Other Income ${idx + 1}`,
        field_group: 'other_income',
        raw_value: String(item.amount),
        normalized_value: typeof item.amount === 'number' ? item.amount : null,
        value_type: 'currency',
        period_label: null,
        confidence_score: confidenceScores[key] ?? 0.7,
        source_page: null,
        source_sheet: null,
        source_row: null,
        source_snippet: null,
        proforma_field_key: null,
      });
    });
  }

  // Other expense line items
  if (Array.isArray(data.other_expense_line_items)) {
    data.other_expense_line_items.forEach((item: any, idx: number) => {
      const key = `other_expense_${idx}`;
      out.push({
        schema_key: key,
        display_label: item.label || `Other Expense ${idx + 1}`,
        field_group: 'expenses',
        raw_value: String(item.amount),
        normalized_value: typeof item.amount === 'number' ? item.amount : null,
        value_type: 'currency',
        period_label: null,
        confidence_score: confidenceScores[key] ?? 0.7,
        source_page: null,
        source_sheet: null,
        source_row: null,
        source_snippet: null,
        proforma_field_key: null,
      });
    });
  }

  // Monthly breakdown
  if (Array.isArray(data.monthly_breakdown)) {
    data.monthly_breakdown.forEach((month: any) => {
      const period = month.period || 'Unknown Period';
      const safePeriod = period.toLowerCase().replace(/\s/g, '_');

      [
        ['effective_gross_income', 'EGI', 'income'],
        ['total_operating_expenses', 'Total OpEx', 'expenses'],
        ['net_operating_income', 'NOI', 'summary'],
      ].forEach(([key, label, group]) => {
        if (month[key] !== null && month[key] !== undefined) {
          out.push({
            schema_key: `monthly.${safePeriod}.${key}`,
            display_label: `${period} — ${label}`,
            field_group: `monthly_${group}`,
            raw_value: String(month[key]),
            normalized_value: typeof month[key] === 'number' ? month[key] : null,
            value_type: 'currency',
            period_label: period,
            confidence_score: 0.8,
            source_page: null,
            source_sheet: null,
            source_row: null,
            source_snippet: null,
            proforma_field_key: null,
          });
        }
      });
    });
  }
}

function flattenRentRoll(
  data: Record<string, any>,
  confidenceScores: Record<string, number>,
  sourceReferences: Record<string, any>,
  proformaMap: Record<string, string>,
  out: FlatField[]
) {
  const summaryKeys = [
    'total_units', 'total_sqft', 'occupancy_rate',
    'occupied_units', 'vacant_units', 'total_potential_rent', 'total_actual_rent'
  ];

  for (const key of summaryKeys) {
    if (data[key] !== undefined) {
      const f = makeField(key, data[key], confidenceScores, sourceReferences, proformaMap, 'summary');
      if (f) out.push(f);
    }
  }

  if (Array.isArray(data.units)) {
    data.units.forEach((unit: any) => {
      const unitNum = unit.unit_number || 'unknown';
      const unitFields: [string, string, string][] = [
        ['contract_rent', 'Contract Rent', 'currency'],
        ['market_rent', 'Market Rent', 'currency'],
        ['sqft', 'Sq Ft', 'integer'],
        ['status', 'Status', 'text'],
      ];

      unitFields.forEach(([field, label, type]) => {
        if (unit[field] !== undefined && unit[field] !== null) {
          const key = `unit.${unitNum}.${field}`;
          out.push({
            schema_key: key,
            display_label: `Unit ${unitNum} — ${label}`,
            field_group: 'unit_mix',
            raw_value: String(unit[field]),
            normalized_value: typeof unit[field] === 'number' ? unit[field] : null,
            value_type: type as any,
            period_label: null,
            confidence_score: confidenceScores[key] ?? confidenceScores['units'] ?? 0.75,
            source_page: sourceReferences['units']?.page || null,
            source_sheet: sourceReferences['units']?.sheet || null,
            source_row: unit._row || null,
            source_snippet: null,
            proforma_field_key: null,
          });
        }
      });
    });
  }
}
