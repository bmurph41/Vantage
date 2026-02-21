"""
Enhanced Deal Signal: Criteria-Aware Scoring
=============================================
Replaces hardcoded thresholds with user's investment criteria.
Falls back to current hardcoded logic when no criteria are set.

Run from workspace root: python3 apply-criteria-signal.py
"""

def read(p):
    with open(p) as f: return f.read()
def write(p, c):
    with open(p,'w') as f: f.write(c)

changes = 0
DS = "client/src/lib/dealSignal.ts"
ds = read(DS)

print("=== Enhancing dealSignal.ts with criteria awareness ===")

# We'll add the criteria-aware interface and function AFTER the existing code
# so existing callers still work, and the new function can be used by deal-pricing

new_code = '''

// ═══════════════════════════════════════════════════════════════
// CRITERIA-AWARE DEAL SIGNAL
// ═══════════════════════════════════════════════════════════════

export interface InvestmentCriteria {
  financial?: {
    minCapRate?: number | null;
    maxCapRate?: number | null;
    minNoi?: number | null;
    minEbitda?: number | null;
    minOperatingMargin?: number | null;
  } | null;
  capital?: {
    minIrrTarget?: number | null;
    minCashOnCashReturn?: number | null;
    targetLtvRatio?: number | null;
    targetHoldPeriod?: number | null;
    maxEquityPerDeal?: number | null;
  } | null;
  size?: {
    minTotalSlips?: number | null;
    maxTotalSlips?: number | null;
  } | null;
  location?: {
    targetStates?: string[] | null;
    targetRegions?: string[] | null;
  } | null;
  involvement?: {
    involvementLevel?: string | null;
    requireManagementInPlace?: boolean | null;
  } | null;
  operational?: {
    minOccupancyRate?: number | null;
  } | null;
  weights?: {
    financialWeight?: number;
    capitalWeight?: number;
    locationWeight?: number;
    operationalWeight?: number;
    sizeWeight?: number;
    involvementWeight?: number;
  };
}

export interface CriteriaMatchResult {
  signal: DealSignal;
  score: number;
  reasons: string[];
  criteriaMatches: CriteriaMatch[];
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface CriteriaMatch {
  category: string;
  criterion: string;
  target: string;
  actual: string;
  met: boolean;
  mustHave: boolean;
  impact: number; // -20 to +20
}

export interface DealForCriteria extends DealSignalInput {
  noi?: number | null;
  ebitda?: number | null;
  occupancyRate?: number | null;
  totalSlips?: number | null;
  state?: string | null;
  region?: string | null;
  operatingMargin?: number | null;
  ltv?: number | null;
  equityRequired?: number | null;
  holdPeriod?: number | null;
  hasManagementInPlace?: boolean | null;
}

export function computeCriteriaSignal(
  deal: DealForCriteria,
  criteria: InvestmentCriteria | null
): CriteriaMatchResult {
  // If no criteria, fall back to standard scoring
  if (!criteria) {
    const base = computeDealSignal(deal);
    return { ...base, criteriaMatches: [] };
  }

  let score = 50;
  const reasons: string[] = [];
  const matches: CriteriaMatch[] = [];
  let mustHaveFails = 0;

  const w = criteria.weights || {
    financialWeight: 25, capitalWeight: 10, locationWeight: 20,
    operationalWeight: 15, sizeWeight: 15, involvementWeight: 5,
  };
  const totalWeight = (w.financialWeight || 0) + (w.capitalWeight || 0) + (w.locationWeight || 0) +
    (w.operationalWeight || 0) + (w.sizeWeight || 0) + (w.involvementWeight || 0);

  // ── Financial Criteria ──
  const fin = criteria.financial;
  if (fin) {
    const fWeight = ((w.financialWeight || 25) / Math.max(totalWeight, 1)) * 50;

    // Cap Rate
    const capRate = normalizePercent(deal.capRate);
    if (fin.minCapRate != null && capRate != null) {
      const target = parseFloat(String(fin.minCapRate));
      const met = capRate >= target;
      matches.push({ category: 'Financial', criterion: 'Going-In Cap Rate', target: `≥ ${target}%`, actual: `${capRate.toFixed(1)}%`, met, mustHave: false, impact: met ? fWeight * 0.3 : -fWeight * 0.3 });
      if (met) { score += fWeight * 0.3; reasons.push(`Cap rate ${capRate.toFixed(1)}% meets your ${target}% minimum`); }
      else { score -= fWeight * 0.3; reasons.push(`Cap rate ${capRate.toFixed(1)}% below your ${target}% minimum`); }
    }

    // NOI
    if (fin.minNoi != null && deal.noi != null) {
      const target = parseFloat(String(fin.minNoi));
      const met = deal.noi >= target;
      matches.push({ category: 'Financial', criterion: 'NOI', target: `≥ $${(target/1000).toFixed(0)}K`, actual: `$${(deal.noi/1000).toFixed(0)}K`, met, mustHave: false, impact: met ? fWeight * 0.3 : -fWeight * 0.3 });
      if (met) { score += fWeight * 0.2; } else { score -= fWeight * 0.2; }
    }

    // EBITDA
    if (fin.minEbitda != null && deal.ebitda != null) {
      const target = parseFloat(String(fin.minEbitda));
      const met = deal.ebitda >= target;
      matches.push({ category: 'Financial', criterion: 'EBITDA', target: `≥ $${(target/1000).toFixed(0)}K`, actual: `$${(deal.ebitda/1000).toFixed(0)}K`, met, mustHave: false, impact: met ? fWeight * 0.2 : -fWeight * 0.2 });
      if (met) { score += fWeight * 0.2; } else { score -= fWeight * 0.2; }
    }

    // Operating Margin
    if (fin.minOperatingMargin != null && deal.operatingMargin != null) {
      const target = parseFloat(String(fin.minOperatingMargin)) * 100;
      const actual = deal.operatingMargin * 100;
      const met = actual >= target;
      matches.push({ category: 'Financial', criterion: 'Operating Margin', target: `≥ ${target.toFixed(0)}%`, actual: `${actual.toFixed(0)}%`, met, mustHave: false, impact: met ? fWeight * 0.2 : -fWeight * 0.2 });
      if (met) { score += fWeight * 0.15; } else { score -= fWeight * 0.15; }
    }
  }

  // ── Capital / Returns Criteria ──
  const cap = criteria.capital;
  if (cap) {
    const cWeight = ((w.capitalWeight || 10) / Math.max(totalWeight, 1)) * 50;

    // IRR Target
    const irr = normalizePercent(deal.irr);
    if (cap.minIrrTarget != null && irr != null) {
      const target = parseFloat(String(cap.minIrrTarget));
      const met = irr >= target;
      matches.push({ category: 'Returns', criterion: 'Levered IRR', target: `≥ ${target}%`, actual: `${irr.toFixed(1)}%`, met, mustHave: true, impact: met ? cWeight * 0.5 : -cWeight * 0.5 });
      if (met) { score += cWeight * 0.4; reasons.push(`IRR ${irr.toFixed(1)}% meets your ${target}% target`); }
      else { score -= cWeight * 0.4; reasons.push(`IRR ${irr.toFixed(1)}% misses your ${target}% target`); mustHaveFails++; }
    }

    // Cash on Cash
    const coc = normalizePercent(deal.cashOnCash);
    if (cap.minCashOnCashReturn != null && coc != null) {
      const target = parseFloat(String(cap.minCashOnCashReturn));
      const met = coc >= target;
      matches.push({ category: 'Returns', criterion: 'Cash-on-Cash', target: `≥ ${target}%`, actual: `${coc.toFixed(1)}%`, met, mustHave: false, impact: met ? cWeight * 0.3 : -cWeight * 0.3 });
      if (met) { score += cWeight * 0.3; } else { score -= cWeight * 0.25; }
    }

    // Max equity per deal
    if (cap.maxEquityPerDeal != null && deal.equityRequired != null) {
      const target = parseFloat(String(cap.maxEquityPerDeal));
      const met = deal.equityRequired <= target;
      matches.push({ category: 'Capital', criterion: 'Max Equity', target: `≤ $${(target/1e6).toFixed(1)}M`, actual: `$${(deal.equityRequired/1e6).toFixed(1)}M`, met, mustHave: true, impact: met ? cWeight * 0.2 : -cWeight * 0.3 });
      if (!met) { score -= cWeight * 0.3; reasons.push(`Equity required $${(deal.equityRequired/1e6).toFixed(1)}M exceeds your $${(target/1e6).toFixed(1)}M limit`); mustHaveFails++; }
    }
  }

  // ── Operational Criteria ──
  const ops = criteria.operational;
  if (ops) {
    const oWeight = ((w.operationalWeight || 15) / Math.max(totalWeight, 1)) * 50;

    if (ops.minOccupancyRate != null && deal.occupancyRate != null) {
      const target = parseFloat(String(ops.minOccupancyRate));
      const met = deal.occupancyRate >= target;
      matches.push({ category: 'Operational', criterion: 'Occupancy', target: `≥ ${target}%`, actual: `${deal.occupancyRate.toFixed(0)}%`, met, mustHave: false, impact: met ? oWeight * 0.5 : -oWeight * 0.5 });
      if (met) { score += oWeight * 0.3; } else { score -= oWeight * 0.3; reasons.push(`Occupancy ${deal.occupancyRate.toFixed(0)}% below your ${target}% minimum`); }
    }
  }

  // ── Size Criteria ──
  const sz = criteria.size;
  if (sz) {
    const sWeight = ((w.sizeWeight || 15) / Math.max(totalWeight, 1)) * 50;

    if (sz.minTotalSlips != null && deal.totalSlips != null) {
      const target = sz.minTotalSlips;
      const met = deal.totalSlips >= target;
      matches.push({ category: 'Size', criterion: 'Total Slips', target: `≥ ${target}`, actual: `${deal.totalSlips}`, met, mustHave: false, impact: met ? sWeight * 0.5 : -sWeight * 0.5 });
      if (met) { score += sWeight * 0.3; } else { score -= sWeight * 0.2; }
    }
  }

  // ── Location Criteria ──
  const loc = criteria.location;
  if (loc && deal.state) {
    const lWeight = ((w.locationWeight || 20) / Math.max(totalWeight, 1)) * 50;

    if (loc.targetStates && loc.targetStates.length > 0) {
      const met = loc.targetStates.includes(deal.state);
      matches.push({ category: 'Location', criterion: 'Target State', target: loc.targetStates.join(', '), actual: deal.state, met, mustHave: false, impact: met ? lWeight * 0.5 : -lWeight * 0.3 });
      if (met) { score += lWeight * 0.4; reasons.push(`Located in target state: ${deal.state}`); }
      else { score -= lWeight * 0.2; reasons.push(`${deal.state} not in your target states`); }
    }
  }

  // ── Involvement Criteria ──
  const inv = criteria.involvement;
  if (inv) {
    const iWeight = ((w.involvementWeight || 5) / Math.max(totalWeight, 1)) * 50;

    if (inv.requireManagementInPlace && deal.hasManagementInPlace != null) {
      const met = deal.hasManagementInPlace;
      matches.push({ category: 'Involvement', criterion: 'Management in Place', target: 'Required', actual: met ? 'Yes' : 'No', met, mustHave: false, impact: met ? iWeight * 0.5 : -iWeight * 0.5 });
      if (!met) { score -= iWeight * 0.3; reasons.push('No management in place — you require existing management'); }
    }
  }

  // Add standard metrics scoring (IRR, cap rate, equity multiple) if not already covered by criteria
  if (!criteria.capital?.minIrrTarget) {
    const irr = normalizePercent(deal.irr);
    if (irr != null) {
      if (irr >= 20) score += 10;
      else if (irr >= 15) score += 5;
      else if (irr < 8) score -= 10;
    }
  }

  const em = deal.equityMultiple;
  if (em != null && em > 0) {
    if (em >= 2.5) score += 5;
    else if (em >= 2.0) score += 3;
    else if (em < 1.2) score -= 5;
  }

  // Must-have failures cap the score
  if (mustHaveFails > 0) {
    score = Math.min(score, 45);
    reasons.unshift(`${mustHaveFails} must-have criteria not met`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const topReasons = reasons.slice(0, 5);
  const signal: DealSignal = score >= 70 ? 'Buy' : score >= 50 ? 'Conditional' : 'Pass';

  const colorMap = {
    Buy: { color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950/30', borderColor: 'border-green-300 dark:border-green-700' },
    Conditional: { color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/30', borderColor: 'border-amber-300 dark:border-amber-700' },
    Pass: { color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950/30', borderColor: 'border-red-300 dark:border-red-700' },
  };

  return {
    signal,
    score,
    reasons: topReasons,
    criteriaMatches: matches,
    ...colorMap[signal],
  };
}
'''

if 'computeCriteriaSignal' not in ds:
    ds += new_code
    changes += 1
    print("  OK Added computeCriteriaSignal, InvestmentCriteria, CriteriaMatch interfaces")
else:
    print("  SKIP: computeCriteriaSignal already exists")

write(DS, ds)
print(f"\n=== Criteria Signal: {changes} patches ===")
