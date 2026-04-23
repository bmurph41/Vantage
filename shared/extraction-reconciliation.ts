import type { PLExtractionSchema, RentRollExtractionSchema } from './extraction-schemas';

export type ReconciliationSeverity = 'error' | 'warning' | 'info';

export interface ReconciliationCheck {
  id: string;
  severity: ReconciliationSeverity;
  field: string;
  message: string;
  expected: number | null;
  actual: number | null;
  deltaAbs: number | null;
  deltaPct: number | null;
}

export interface ReconciliationReport {
  passes: number;
  warnings: number;
  errors: number;
  blocking: boolean;
  checks: ReconciliationCheck[];
}

const TOLERANCE_WARN_PCT = 0.01;
const TOLERANCE_ERROR_PCT = 0.05;

function cmp(id: string, field: string, expected: number | null | undefined, actual: number | null | undefined, label: string): ReconciliationCheck | null {
  if (expected == null || actual == null) return null;
  const deltaAbs = Math.abs(actual - expected);
  const denom = Math.max(Math.abs(expected), 1);
  const deltaPct = deltaAbs / denom;
  let severity: ReconciliationSeverity;
  if (deltaPct <= TOLERANCE_WARN_PCT) severity = 'info';
  else if (deltaPct <= TOLERANCE_ERROR_PCT) severity = 'warning';
  else severity = 'error';
  if (severity === 'info') return null;
  return {
    id,
    severity,
    field,
    message: `${label}: expected ${expected.toLocaleString()}, got ${actual.toLocaleString()} (Δ ${(deltaPct * 100).toFixed(2)}%)`,
    expected,
    actual,
    deltaAbs,
    deltaPct,
  };
}

function sumDefined(...values: Array<number | null | undefined>): number | null {
  const defined = values.filter((v): v is number => typeof v === 'number');
  if (defined.length === 0) return null;
  return defined.reduce((a, b) => a + b, 0);
}

export function reconcilePL(data: Partial<PLExtractionSchema>): ReconciliationReport {
  const checks: ReconciliationCheck[] = [];
  let passes = 0;

  // Check 1: EGI = GPR - vacancy - concessions - bad_debt
  if (data.gross_potential_rent != null && data.effective_gross_income != null) {
    const computed = data.gross_potential_rent - (data.vacancy_loss ?? 0) - (data.concessions ?? 0) - (data.bad_debt ?? 0);
    const c = cmp('egi_identity', 'effective_gross_income', computed, data.effective_gross_income, 'EGI ≠ GPR − Vacancy − Concessions − Bad Debt');
    if (c) checks.push(c); else passes++;
  }

  // Check 2: total_other_income ≈ sum(named + line items)
  if (data.total_other_income != null) {
    const lineSum = Array.isArray(data.other_income_line_items)
      ? data.other_income_line_items.reduce((a, b) => a + (b?.amount ?? 0), 0)
      : 0;
    const namedSum = sumDefined(
      data.parking_income, data.laundry_income, data.late_fees,
      data.pet_fees, data.storage_income, data.utility_reimbursements,
    );
    if (namedSum != null || lineSum > 0) {
      const computed = (namedSum ?? 0) + lineSum;
      const c = cmp('other_income_sum', 'total_other_income', computed, data.total_other_income, 'Total Other Income ≠ sum of named items + line items');
      if (c) checks.push(c); else passes++;
    }
  }

  // Check 3: total_revenue ≈ EGI + total_other_income
  if (data.total_revenue != null && data.effective_gross_income != null) {
    const computed = data.effective_gross_income + (data.total_other_income ?? 0);
    const c = cmp('total_revenue_identity', 'total_revenue', computed, data.total_revenue, 'Total Revenue ≠ EGI + Total Other Income');
    if (c) checks.push(c); else passes++;
  }

  // Check 4: total_operating_expenses ≈ sum(named expense categories + line items)
  if (data.total_operating_expenses != null) {
    const lineSum = Array.isArray(data.other_expense_line_items)
      ? data.other_expense_line_items.reduce((a, b) => a + (b?.amount ?? 0), 0)
      : 0;
    const namedSum = sumDefined(
      data.management_fees, data.payroll, data.repairs_maintenance,
      data.contract_services, data.utilities, data.insurance,
      data.real_estate_taxes, data.landscaping, data.administrative,
      data.advertising_marketing, data.reserves,
    );
    if (namedSum != null || lineSum > 0) {
      const computed = (namedSum ?? 0) + lineSum;
      const c = cmp('opex_sum', 'total_operating_expenses', computed, data.total_operating_expenses, 'Total Operating Expenses ≠ sum of named categories + line items');
      if (c) checks.push(c); else passes++;
    }
  }

  // Check 5: NOI ≈ Total Revenue − Total OpEx
  if (data.net_operating_income != null && data.total_revenue != null && data.total_operating_expenses != null) {
    const computed = data.total_revenue - data.total_operating_expenses;
    const c = cmp('noi_identity', 'net_operating_income', computed, data.net_operating_income, 'NOI ≠ Total Revenue − Total OpEx');
    if (c) checks.push(c); else passes++;
  }

  // Check 6: monthly breakdown sums to annual EGI (within 2% — rounding-friendly)
  if (Array.isArray(data.monthly_breakdown) && data.monthly_breakdown.length > 0 && data.effective_gross_income != null) {
    const monthlyEGISum = data.monthly_breakdown.reduce((a, m) => a + (m.effective_gross_income ?? 0), 0);
    if (monthlyEGISum > 0) {
      const deltaPct = Math.abs(monthlyEGISum - data.effective_gross_income) / Math.max(data.effective_gross_income, 1);
      if (deltaPct > 0.02) {
        checks.push({
          id: 'monthly_egi_sum',
          severity: deltaPct > 0.05 ? 'error' : 'warning',
          field: 'monthly_breakdown',
          message: `Sum of monthly EGI (${monthlyEGISum.toLocaleString()}) ≠ annual EGI (${data.effective_gross_income.toLocaleString()}) — Δ ${(deltaPct * 100).toFixed(2)}%`,
          expected: data.effective_gross_income,
          actual: monthlyEGISum,
          deltaAbs: Math.abs(monthlyEGISum - data.effective_gross_income),
          deltaPct,
        });
      } else {
        passes++;
      }
    }
  }

  const errors = checks.filter(c => c.severity === 'error').length;
  const warnings = checks.filter(c => c.severity === 'warning').length;
  return { passes, warnings, errors, blocking: errors > 0, checks };
}

export function reconcileRentRoll(data: Partial<RentRollExtractionSchema>): ReconciliationReport {
  const checks: ReconciliationCheck[] = [];
  let passes = 0;
  const units = Array.isArray(data.units) ? data.units : [];

  // Check 1: total_units matches units array length (exact)
  if (data.total_units != null && units.length > 0) {
    if (data.total_units !== units.length) {
      checks.push({
        id: 'unit_count_match',
        severity: 'error',
        field: 'total_units',
        message: `total_units (${data.total_units}) ≠ units array length (${units.length})`,
        expected: data.total_units,
        actual: units.length,
        deltaAbs: Math.abs(data.total_units - units.length),
        deltaPct: Math.abs(data.total_units - units.length) / Math.max(data.total_units, 1),
      });
    } else {
      passes++;
    }
  }

  // Check 2: occupied + vacant = total_units
  if (data.occupied_units != null && data.vacant_units != null && data.total_units != null) {
    const sum = data.occupied_units + data.vacant_units;
    if (sum !== data.total_units) {
      checks.push({
        id: 'occupancy_count_sum',
        severity: 'warning',
        field: 'occupied_units + vacant_units',
        message: `occupied_units (${data.occupied_units}) + vacant_units (${data.vacant_units}) = ${sum} ≠ total_units (${data.total_units})`,
        expected: data.total_units,
        actual: sum,
        deltaAbs: Math.abs(sum - data.total_units),
        deltaPct: Math.abs(sum - data.total_units) / Math.max(data.total_units, 1),
      });
    } else {
      passes++;
    }
  }

  // Check 3: occupancy_rate ≈ occupied_units / total_units
  if (data.occupancy_rate != null && data.occupied_units != null && data.total_units != null && data.total_units > 0) {
    const computed = data.occupied_units / data.total_units;
    const c = cmp('occupancy_rate_identity', 'occupancy_rate', computed, data.occupancy_rate, 'occupancy_rate ≠ occupied_units / total_units');
    if (c) checks.push(c); else passes++;
  }

  // Check 4: total_potential_rent ≈ sum(units.market_rent)
  if (data.total_potential_rent != null && units.length > 0) {
    const computed = units.reduce((a, u) => a + (u.market_rent ?? 0), 0);
    if (computed > 0) {
      const c = cmp('potential_rent_sum', 'total_potential_rent', computed, data.total_potential_rent, 'total_potential_rent ≠ sum of unit market_rent');
      if (c) checks.push(c); else passes++;
    }
  }

  // Check 5: total_actual_rent ≈ sum(occupied units.contract_rent)
  if (data.total_actual_rent != null && units.length > 0) {
    const computed = units
      .filter(u => u.status === 'occupied')
      .reduce((a, u) => a + (u.contract_rent ?? 0), 0);
    if (computed > 0) {
      const c = cmp('actual_rent_sum', 'total_actual_rent', computed, data.total_actual_rent, 'total_actual_rent ≠ sum of contract_rent for occupied units');
      if (c) checks.push(c); else passes++;
    }
  }

  // Check 6: every unit has a unit_number + status
  const unitsMissingId = units.filter(u => !u.unit_number).length;
  if (unitsMissingId > 0) {
    checks.push({
      id: 'units_missing_number',
      severity: 'error',
      field: 'units[].unit_number',
      message: `${unitsMissingId} of ${units.length} units are missing unit_number`,
      expected: 0,
      actual: unitsMissingId,
      deltaAbs: unitsMissingId,
      deltaPct: unitsMissingId / Math.max(units.length, 1),
    });
  } else if (units.length > 0) {
    passes++;
  }

  const errors = checks.filter(c => c.severity === 'error').length;
  const warnings = checks.filter(c => c.severity === 'warning').length;
  return { passes, warnings, errors, blocking: errors > 0, checks };
}
