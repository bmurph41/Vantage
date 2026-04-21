/**
 * shared/finance/xirr.ts
 * 
 * Canonical XIRR types and implementation.
 * All IRR calculations across DCF, Pro Forma, Quick IRR, and Monte Carlo
 * MUST use this single implementation.
 * 
 * If your project already has calculateXIRR in server/utils/financial-calculations.ts,
 * replace that implementation's internals with a call to this, or copy this there
 * and re-export from here. The goal: ONE function, ONE definition.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DatedCashFlow {
  date: string;   // ISO date string e.g. "2026-01-15"
  amount: number; // negative = outflow (equity invested), positive = inflow
}

export interface XIRRResult {
  irr: number;          // as PERCENT (e.g. 14.25, not 0.1425)
  converged: boolean;
  iterations: number;
}

// ─── Implementation ──────────────────────────────────────────────────────────

const DAYS_PER_YEAR = 365.25;
const MAX_ITERATIONS = 200;
const TOLERANCE = 1e-10;

/**
 * Compute XIRR using Newton-Raphson on dated cash flows.
 * Returns IRR as a PERCENT (e.g. 14.25 for 14.25%).
 * 
 * Day-count basis: Actual/365.25
 * 
 * @param flows - Array of { date, amount } where date is ISO string
 * @param guess - Initial guess as decimal (default 0.1 = 10%)
 * @returns XIRRResult with irr in percent
 */
export function calculateXIRR(flows: DatedCashFlow[], guess: number = 0.1): XIRRResult {
  if (flows.length < 2) {
    return { irr: 0, converged: false, iterations: 0 };
  }

  // Ensure at least one positive and one negative flow
  const hasPositive = flows.some(f => f.amount > 0);
  const hasNegative = flows.some(f => f.amount < 0);
  if (!hasPositive || !hasNegative) {
    return { irr: 0, converged: false, iterations: 0 };
  }

  // Parse dates in UTC to avoid timezone-dependent variations in IRR calculations
  const dates = flows.map(f => {
    const d = f.date.includes('T') ? new Date(f.date) : new Date(f.date + 'T00:00:00Z');
    return d.getTime();
  });
  const d0 = dates[0];
  const amounts = flows.map(f => f.amount);

  // Year fractions from first date
  const yearFracs = dates.map(d => (d - d0) / (DAYS_PER_YEAR * 86400000));

  // Pure NPV at rate (decimal) using yearFracs already computed.
  const npvAt = (r: number): number => {
    let s = 0;
    for (let i = 0; i < amounts.length; i++) {
      const factor = Math.pow(1 + r, yearFracs[i]);
      if (!isFinite(factor)) return Number.NaN;
      s += amounts[i] / factor;
    }
    return s;
  };

  // ── Pass 1: Newton-Raphson with damping ─────────────────────────────────
  let rate = guess;
  let nrIters = 0;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    nrIters = iter + 1;
    let npv = 0;
    let dnpv = 0;

    for (let i = 0; i < amounts.length; i++) {
      const t = yearFracs[i];
      const factor = Math.pow(1 + rate, t);
      if (!isFinite(factor) || factor === 0) {
        rate = 0.1;
        continue;
      }
      npv += amounts[i] / factor;
      dnpv -= t * amounts[i] / (factor * (1 + rate));
    }

    if (Math.abs(npv) < TOLERANCE) {
      return { irr: rate * 100, converged: true, iterations: nrIters };
    }

    if (Math.abs(dnpv) < 1e-20) break; // bail to bisection

    const newRate = rate - npv / dnpv;

    // Clamp + damp to prevent wild divergence
    if (newRate < -0.99) {
      rate = (rate + (-0.99)) / 2; // halve the step toward the lower bound
    } else if (newRate > 10) {
      rate = (rate + 10) / 2;
    } else {
      rate = newRate;
    }
  }

  // ── Pass 2: Bisection fallback ──────────────────────────────────────────
  // Newton-Raphson can oscillate on j-curve flows (multiple capital calls
  // before a single large exit). Bisection is slower but always converges
  // when a sign change exists in the bracket.
  let lo = -0.999;
  let hi = 10.0;
  let fLo = npvAt(lo);
  let fHi = npvAt(hi);

  // Try to widen if we don't have a sign bracket
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) {
    const candidates = [-0.95, -0.5, 0, 0.05, 0.1, 0.25, 0.5, 1, 2, 5];
    let prevR = lo;
    let prevF = fLo;
    let bracketed = false;
    for (const r of candidates) {
      const f = npvAt(r);
      if (isFinite(f) && isFinite(prevF) && prevF * f < 0) {
        lo = prevR;
        hi = r;
        fLo = prevF;
        fHi = f;
        bracketed = true;
        break;
      }
      prevR = r;
      prevF = f;
    }
    if (!bracketed) {
      return { irr: rate * 100, converged: false, iterations: nrIters };
    }
  }

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const f = npvAt(mid);
    if (Math.abs(f) < TOLERANCE || (hi - lo) < 1e-12) {
      return { irr: mid * 100, converged: true, iterations: nrIters + i + 1 };
    }
    if (fLo * f < 0) {
      hi = mid;
      fHi = f;
    } else {
      lo = mid;
      fLo = f;
    }
  }

  // Bisection didn't converge tightly — return midpoint as best estimate
  return { irr: ((lo + hi) / 2) * 100, converged: false, iterations: nrIters + 200 };
}

/**
 * Compute NPV at a given discount rate (as percent, e.g. 10 for 10%).
 * Uses same dated cash flow convention as XIRR.
 */
export function calculateNPV(flows: DatedCashFlow[], discountRatePercent: number): number {
  if (flows.length === 0) return 0;

  const rate = discountRatePercent / 100;
  const d0 = new Date(flows[0].date).getTime();

  let npv = 0;
  for (const flow of flows) {
    const t = (new Date(flow.date).getTime() - d0) / (DAYS_PER_YEAR * 86400000);
    npv += flow.amount / Math.pow(1 + rate, t);
  }
  return npv;
}

/**
 * Compute equity multiple from dated cash flows.
 * EM = total inflows / abs(total outflows)
 */
export function calculateEquityMultiple(flows: DatedCashFlow[]): number {
  let totalIn = 0;
  let totalOut = 0;
  for (const f of flows) {
    if (f.amount > 0) totalIn += f.amount;
    else totalOut += Math.abs(f.amount);
  }
  return totalOut > 0 ? totalIn / totalOut : 0;
}
