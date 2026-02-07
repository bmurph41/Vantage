/**
 * validate.ts — Validation gate for parsed P&L statements.
 *
 * Runs a series of deterministic checks on the parsed payload and returns
 * an overall status (pass | warn | fail) plus individual check results.
 * Used to gate the pipeline: FAIL → force needs_review + create __VALIDATION__ review item.
 */

import type { ParsedStatementPayload, ParsedRow, ParsedPeriod } from '@shared/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationStatus = 'pass' | 'warn' | 'fail';

export interface ValidationCheck {
  name: string;
  status: ValidationStatus;
  message: string;
  detail?: any;
}

export interface ValidationResult {
  status: ValidationStatus;
  checks: ValidationCheck[];
  summary: string;
}

// ─── Main validation ──────────────────────────────────────────────────────────

export function validateParsedStatement(payload: ParsedStatementPayload): ValidationResult {
  const checks: ValidationCheck[] = [];

  checks.push(checkPeriodsPresent(payload));
  checks.push(checkPeriodDuplicates(payload));
  checks.push(checkRowCountMin(payload));
  checks.push(checkNumericDensity(payload));
  checks.push(checkPeriodAlignment(payload));
  checks.push(checkTotalsSanity(payload));

  // Determine overall status
  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');

  const status: ValidationStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass';

  const failedChecks = checks.filter(c => c.status === 'fail').map(c => c.name);
  const warnChecks = checks.filter(c => c.status === 'warn').map(c => c.name);

  let summary = `Validation ${status.toUpperCase()}`;
  if (failedChecks.length) summary += ` — failed: ${failedChecks.join(', ')}`;
  if (warnChecks.length) summary += ` — warnings: ${warnChecks.join(', ')}`;

  return { status, checks, summary };
}

// ─── Individual checks ───────────────────────────────────────────────────────

function checkPeriodsPresent(payload: ParsedStatementPayload): ValidationCheck {
  const count = (payload.periods ?? []).length;
  if (count === 0) {
    return {
      name: 'PERIODS_PRESENT',
      status: 'fail',
      message: 'No periods detected in the document.',
    };
  }
  return {
    name: 'PERIODS_PRESENT',
    status: 'pass',
    message: `${count} period(s) detected.`,
  };
}

function checkPeriodDuplicates(payload: ParsedStatementPayload): ValidationCheck {
  const periods = payload.periods ?? [];
  if (periods.length < 2) {
    return { name: 'PERIOD_DUPLICATES', status: 'pass', message: 'Less than 2 periods; skipped.' };
  }

  const keys = periods.map(p => `${p.type}-${p.year}-${p.periodNo}`);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const k of keys) {
    if (seen.has(k)) duplicates.push(k);
    seen.add(k);
  }

  if (duplicates.length > 0) {
    return {
      name: 'PERIOD_DUPLICATES',
      status: duplicates.length >= periods.length / 2 ? 'fail' : 'warn',
      message: `Found ${duplicates.length} duplicate period key(s).`,
      detail: { duplicates },
    };
  }
  return { name: 'PERIOD_DUPLICATES', status: 'pass', message: 'No duplicate periods.' };
}

function checkRowCountMin(payload: ParsedStatementPayload): ValidationCheck {
  const count = (payload.rows ?? []).length;
  if (count < 3) {
    return {
      name: 'ROW_COUNT_MIN',
      status: 'fail',
      message: `Only ${count} row(s) extracted; expected at least 3.`,
    };
  }
  if (count < 10) {
    return {
      name: 'ROW_COUNT_MIN',
      status: 'warn',
      message: `Only ${count} row(s) extracted; expected at least 10 for a typical P&L.`,
    };
  }
  return { name: 'ROW_COUNT_MIN', status: 'pass', message: `${count} rows extracted.` };
}

function checkNumericDensity(payload: ParsedStatementPayload): ValidationCheck {
  const rows = payload.rows ?? [];
  if (rows.length === 0) {
    return { name: 'NUMERIC_DENSITY', status: 'fail', message: 'No rows to evaluate.' };
  }

  let totalValues = 0;
  let nonNullValues = 0;
  for (const row of rows) {
    for (const v of row.values ?? []) {
      totalValues++;
      if (v.value !== null && v.value !== undefined) nonNullValues++;
    }
  }

  if (totalValues === 0) {
    return { name: 'NUMERIC_DENSITY', status: 'fail', message: 'No numeric cells found.' };
  }

  const density = nonNullValues / totalValues;
  const cellsPerRow = totalValues / rows.length;

  if (cellsPerRow < 0.5) {
    return {
      name: 'NUMERIC_DENSITY',
      status: 'warn',
      message: `Low numeric density: ${cellsPerRow.toFixed(2)} cells/row (${nonNullValues} non-null of ${totalValues} total).`,
      detail: { density, cellsPerRow, nonNullValues, totalValues },
    };
  }

  return {
    name: 'NUMERIC_DENSITY',
    status: 'pass',
    message: `Density OK: ${nonNullValues}/${totalValues} cells non-null (${(density * 100).toFixed(1)}%).`,
    detail: { density, cellsPerRow, nonNullValues, totalValues },
  };
}

function checkPeriodAlignment(payload: ParsedStatementPayload): ValidationCheck {
  const rows = payload.rows ?? [];
  const periods = payload.periods ?? [];

  if (periods.length < 2 || rows.length < 3) {
    return { name: 'PERIOD_ALIGNMENT', status: 'pass', message: 'Not enough data for alignment check.' };
  }

  // Count how many rows have ALL values mapped to the same periodIndex
  let sameIndexRows = 0;
  for (const row of rows) {
    const vals = (row.values ?? []).filter(v => v.value !== null);
    if (vals.length < 2) continue;
    const indices = new Set(vals.map(v => v.periodIndex));
    if (indices.size === 1) sameIndexRows++;
  }

  const multiValueRows = rows.filter(r => (r.values ?? []).filter(v => v.value !== null).length >= 2).length;
  if (multiValueRows === 0) {
    return { name: 'PERIOD_ALIGNMENT', status: 'pass', message: 'No multi-value rows to check.' };
  }

  const sameIndexRatio = sameIndexRows / multiValueRows;

  if (sameIndexRatio > 0.6) {
    return {
      name: 'PERIOD_ALIGNMENT',
      status: 'fail',
      message: `${(sameIndexRatio * 100).toFixed(0)}% of multi-value rows have all values in the same periodIndex — likely header alignment failure.`,
      detail: { sameIndexRows, multiValueRows, ratio: sameIndexRatio },
    };
  }

  if (sameIndexRatio > 0.3) {
    return {
      name: 'PERIOD_ALIGNMENT',
      status: 'warn',
      message: `${(sameIndexRatio * 100).toFixed(0)}% of rows may have misaligned periods.`,
      detail: { sameIndexRows, multiValueRows, ratio: sameIndexRatio },
    };
  }

  return { name: 'PERIOD_ALIGNMENT', status: 'pass', message: 'Period alignment looks correct.' };
}

function checkTotalsSanity(payload: ParsedStatementPayload): ValidationCheck {
  const rows = payload.rows ?? [];
  if (rows.length < 5) {
    return { name: 'TOTALS_SANITY', status: 'pass', message: 'Not enough rows for totals check.' };
  }

  // Best-effort: look for rows whose label includes common totals keywords
  const totalPatterns = [
    { regex: /\btotal\s+revenue\b/i, type: 'total_revenue' },
    { regex: /\btotal\s+(?:operating\s+)?expense/i, type: 'total_expense' },
    { regex: /\bnet\s+(?:operating\s+)?income\b|\bnoi\b/i, type: 'noi' },
    { regex: /\btotal\s+cogs?\b|\bcost\s+of\s+(?:goods\s+)?sold/i, type: 'total_cogs' },
  ];

  const foundTotals: string[] = [];
  for (const row of rows) {
    const label = (row.label ?? '').toLowerCase();
    for (const p of totalPatterns) {
      if (p.regex.test(label)) foundTotals.push(p.type);
    }
  }

  // We won't fail on totals since we skip totals rows during extraction
  // Just note whether key totals are present or absent
  if (foundTotals.length === 0) {
    return {
      name: 'TOTALS_SANITY',
      status: 'pass',
      message: 'No total rows found (totals may have been excluded during extraction).',
    };
  }

  return {
    name: 'TOTALS_SANITY',
    status: 'pass',
    message: `Found total-like rows: ${foundTotals.join(', ')}.`,
    detail: { foundTotals },
  };
}
