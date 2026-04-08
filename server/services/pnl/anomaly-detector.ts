/**
 * anomaly-detector.ts — Post-extraction anomaly detection for P&L statements.
 *
 * Implements the "Anomaly detection from raw numbers" pattern described in the
 * Vantage guidance document:
 *   - Large YoY swings (>40% period-over-period change)
 *   - Payroll rate anomalies (payroll > 35% of revenue in any period)
 *   - Negative revenue in any period
 *   - Missing/sparse periods (< 20% of rows have values)
 *   - COGS percentage shift (> 10pp across periods)
 *   - Suspicious small values (ratio > 50x between adjacent periods)
 *   - Add-back candidate identification (depreciation, amortization, owner comp)
 */

import type { ParsedRow, ParsedPeriod } from '../../../shared/pnl-pipeline-schema';

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface PnlAnomaly {
  type: string;
  severity: AnomalySeverity;
  message: string;
  rowLabel?: string;
  periodLabel?: string;
  periodIndex?: number;
  value?: number;
  comparison?: number;
  changePercent?: number;
}

export interface AddBackCandidate {
  rowLabel: string;
  normalizedLabel: string;
  reason: string;
  totalValue: number;
  byPeriod: { periodIndex: number; value: number }[];
}

export interface AnomalyDetectionResult {
  anomalies: PnlAnomaly[];
  addBackCandidates: AddBackCandidate[];
  dataQualityScore: number; // 0–100
  hasRedFlags: boolean;
}

// ─── Keyword banks ────────────────────────────────────────────────────────────

const PAYROLL_KEYWORDS = [
  'payroll', 'labor', 'labour', 'wages', 'salaries', 'salary',
  'employee', 'staff', 'personnel', 'compensation', 'benefits',
  'workers comp', 'worker comp', 'fica', 'health insurance',
];

const REVENUE_KEYWORDS = [
  'revenue', 'income', 'sales', 'gross sales', 'total revenue',
  'total income', 'gross income', 'egi', 'effective gross income',
  'rental income', 'slip income', 'fuel sales', 'total sales',
];

const COGS_KEYWORDS = [
  'cost of goods', 'cogs', 'cost of sales', 'cost of revenue',
  'direct costs', 'direct cost', 'cost of fuel', 'cost of merchandise',
];

const ADDBACK_KEYWORDS = [
  'depreciation', 'amortization', 'depletion', 'owner', 'owners',
  'personal', 'management fee', 'management fees', 'interest expense',
  'interest income', "officer's comp", 'officer comp', 'family member',
  'related party', 'non-recurring', 'one-time', 'extraordinary',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function matchesAny(label: string, keywords: string[]): boolean {
  const lower = label.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function getValueForPeriod(row: ParsedRow, periodIndex: number): number | null {
  const v = row.values.find(v => v.periodIndex === periodIndex);
  return v?.value ?? null;
}

function getValuesForRow(row: ParsedRow, numPeriods: number): (number | null)[] {
  const vals: (number | null)[] = [];
  for (let i = 0; i < numPeriods; i++) {
    vals.push(getValueForPeriod(row, i));
  }
  return vals;
}

// ─── Main Detector ────────────────────────────────────────────────────────────

export function detectAnomalies(
  rows: ParsedRow[],
  periods: ParsedPeriod[]
): AnomalyDetectionResult {
  const anomalies: PnlAnomaly[] = [];
  const addBackCandidates: AddBackCandidate[] = [];
  const n = periods.length;

  if (n === 0 || rows.length === 0) {
    return { anomalies, addBackCandidates, dataQualityScore: 50, hasRedFlags: false };
  }

  // ─── Find key row groups ─────────────────────────────────────────────────
  const revenueRows = rows.filter(r =>
    matchesAny(r.normalizedLabel, REVENUE_KEYWORDS) ||
    r.sectionHint === 'revenue'
  );
  const payrollRows = rows.filter(r =>
    matchesAny(r.normalizedLabel, PAYROLL_KEYWORDS) ||
    r.sectionHint === 'payroll'
  );
  const cogsRows = rows.filter(r =>
    matchesAny(r.normalizedLabel, COGS_KEYWORDS) ||
    r.sectionHint === 'cogs'
  );

  // Aggregate revenue per period
  const revByPeriod: (number | null)[] = [];
  for (let pi = 0; pi < n; pi++) {
    let total: number | null = null;
    for (const r of revenueRows) {
      const v = getValueForPeriod(r, pi);
      if (v !== null) total = (total ?? 0) + v;
    }
    revByPeriod.push(total);
  }

  // ─── 1. Negative Revenue ─────────────────────────────────────────────────
  for (let pi = 0; pi < n; pi++) {
    const rev = revByPeriod[pi];
    if (rev !== null && rev < 0) {
      anomalies.push({
        type: 'negative_revenue',
        severity: 'critical',
        message: `Revenue is negative ($${rev.toLocaleString()}) for period "${periods[pi].label}"`,
        periodLabel: periods[pi].label,
        periodIndex: pi,
        value: rev,
      });
    }
  }

  // ─── 2. YoY Swing Detection (>40% change) ───────────────────────────────
  for (const row of rows) {
    const vals = getValuesForRow(row, n);
    for (let pi = 1; pi < n; pi++) {
      const prev = vals[pi - 1];
      const curr = vals[pi];
      if (prev === null || curr === null) continue;
      if (Math.abs(prev) < 500) continue; // skip tiny base values

      const changePct = (curr - prev) / Math.abs(prev);
      if (Math.abs(changePct) >= 0.40) {
        const dir = changePct > 0 ? 'increase' : 'decrease';
        const severity: AnomalySeverity =
          Math.abs(changePct) >= 0.75 ? 'critical'
          : Math.abs(changePct) >= 0.40 ? 'warning'
          : 'info';

        anomalies.push({
          type: 'large_yoy_swing',
          severity,
          message: `"${row.label}" shows a ${Math.round(Math.abs(changePct) * 100)}% ${dir} from ${periods[pi - 1].label} to ${periods[pi].label}`,
          rowLabel: row.label,
          periodLabel: periods[pi].label,
          periodIndex: pi,
          value: curr,
          comparison: prev,
          changePercent: changePct,
        });
      }
    }
  }

  // ─── 3. Suspicious Small Value (ratio > 50x between adjacent periods) ────
  for (const row of rows) {
    const vals = getValuesForRow(row, n);
    for (let pi = 1; pi < n; pi++) {
      const prev = vals[pi - 1];
      const curr = vals[pi];
      if (prev === null || curr === null || curr === 0 || prev === 0) continue;
      if (Math.abs(prev) < 100 || Math.abs(curr) < 100) continue;

      const ratio = Math.max(Math.abs(prev), Math.abs(curr)) /
                    Math.min(Math.abs(prev), Math.abs(curr));

      if (ratio > 50) {
        const smaller = Math.abs(curr) < Math.abs(prev) ? curr : prev;
        const larger = Math.abs(curr) > Math.abs(prev) ? curr : prev;
        anomalies.push({
          type: 'suspicious_magnitude_shift',
          severity: 'critical',
          message: `"${row.label}" shows a suspicious ${Math.round(ratio)}x magnitude difference: $${Math.abs(smaller).toLocaleString()} vs $${Math.abs(larger).toLocaleString()} — possible data entry error`,
          rowLabel: row.label,
          periodLabel: periods[pi].label,
          periodIndex: pi,
          value: curr,
          comparison: prev,
        });
      }
    }
  }

  // ─── 4. Payroll Rate Anomaly (payroll > 35% of revenue) ─────────────────
  if (payrollRows.length > 0 && revenueRows.length > 0) {
    for (let pi = 0; pi < n; pi++) {
      const rev = revByPeriod[pi];
      if (!rev || rev <= 0) continue;

      let payrollTotal = 0;
      for (const r of payrollRows) {
        const v = getValueForPeriod(r, pi);
        if (v !== null) payrollTotal += Math.abs(v);
      }

      const rate = payrollTotal / rev;
      if (rate > 0.35) {
        anomalies.push({
          type: 'payroll_rate_anomaly',
          severity: rate > 0.50 ? 'critical' : 'warning',
          message: `Payroll/labor is ${Math.round(rate * 100)}% of revenue for ${periods[pi].label} — typical range is 20–35%`,
          periodLabel: periods[pi].label,
          periodIndex: pi,
          value: payrollTotal,
          comparison: rev,
          changePercent: rate,
        });
      }
    }
  }

  // ─── 5. COGS Percentage Shift (> 10pp across periods) ───────────────────
  if (cogsRows.length > 0 && revenueRows.length > 0) {
    const cogsPct: (number | null)[] = [];
    for (let pi = 0; pi < n; pi++) {
      const rev = revByPeriod[pi];
      if (!rev || rev <= 0) { cogsPct.push(null); continue; }
      let cogsTotal = 0;
      for (const r of cogsRows) {
        const v = getValueForPeriod(r, pi);
        if (v !== null) cogsTotal += Math.abs(v);
      }
      cogsPct.push(cogsTotal / rev);
    }

    const defined = cogsPct.filter(v => v !== null) as number[];
    if (defined.length >= 2) {
      const range = Math.max(...defined) - Math.min(...defined);
      if (range > 0.10) {
        anomalies.push({
          type: 'cogs_pct_shift',
          severity: range > 0.20 ? 'critical' : 'warning',
          message: `COGS as % of revenue shifts ${Math.round(range * 100)} percentage points across periods (${defined.map(v => `${Math.round(v * 100)}%`).join(' → ')}) — may indicate reclassification or data inconsistency`,
          changePercent: range,
        });
      }
    }
  }

  // ─── 6. Missing/Sparse Periods ───────────────────────────────────────────
  for (let pi = 0; pi < n; pi++) {
    let nonNullCount = 0;
    for (const row of rows) {
      const v = getValueForPeriod(row, pi);
      if (v !== null && v !== 0) nonNullCount++;
    }
    const coverage = nonNullCount / rows.length;
    if (coverage < 0.20) {
      anomalies.push({
        type: 'sparse_period',
        severity: coverage < 0.05 ? 'critical' : 'warning',
        message: `Period "${periods[pi].label}" has very low data coverage (${Math.round(coverage * 100)}% of rows have values) — data may be incomplete`,
        periodLabel: periods[pi].label,
        periodIndex: pi,
        value: coverage,
      });
    }
  }

  // ─── 7. Add-Back Candidate Identification ───────────────────────────────
  for (const row of rows) {
    if (!matchesAny(row.normalizedLabel, ADDBACK_KEYWORDS)) continue;

    const vals = getValuesForRow(row, n);
    const nonNull = vals.filter(v => v !== null) as number[];
    if (nonNull.length === 0) continue;
    const total = nonNull.reduce((a, b) => a + Math.abs(b), 0);
    if (total < 100) continue;

    const reason = ADDBACK_KEYWORDS.find(k => row.normalizedLabel.toLowerCase().includes(k)) || 'add-back candidate';

    addBackCandidates.push({
      rowLabel: row.label,
      normalizedLabel: row.normalizedLabel,
      reason: `Contains "${reason}" — commonly added back for buyer normalization`,
      totalValue: total / nonNull.length, // average
      byPeriod: vals.map((v, i) => ({ periodIndex: i, value: v ?? 0 }))
        .filter(x => x.value !== 0),
    });
  }

  // ─── Data Quality Score ──────────────────────────────────────────────────
  let qualityDeductions = 0;
  const criticals = anomalies.filter(a => a.severity === 'critical').length;
  const warnings = anomalies.filter(a => a.severity === 'warning').length;
  qualityDeductions += criticals * 15;
  qualityDeductions += warnings * 5;
  const dataQualityScore = Math.max(0, Math.min(100, 100 - qualityDeductions));
  const hasRedFlags = criticals > 0 || anomalies.some(a => a.type === 'suspicious_magnitude_shift');

  return { anomalies, addBackCandidates, dataQualityScore, hasRedFlags };
}
