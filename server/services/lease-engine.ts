/**
 * Commercial Lease Calculation Engine
 * ====================================
 * Pure functions: no DB calls. Accept data in, return cashflow rows out.
 * Calendar month_end is the controlling axis.
 *
 * Rules implemented:
 * A) Monthly schedule with day-count proration
 * B) Term selection (initial + unlimited options)
 * C) Base rent with 5 escalation types
 * D) Charge lines with escalation
 * E) Abatements (free rent, percent discount, fixed credit)
 * F) TI programs with draws, participation, amortization
 * G) Percent rent with natural/artificial breakpoints, calendar/fiscal year, tiers
 * H) Base year stops / expense stops per recovery category
 */

import type {
  CommercialLease,
  LeaseTerm,
  LeaseChargeLine,
  LeaseAbatement,
  LeaseSale,
  LeasePercentRentRule,
  LeaseTiProgram,
  LeaseTiDraw,
  LeaseRecoveryModel,
  LeaseRecoveryCategoryRow,
  LeaseMonthlyCashflow,
  PercentRentTier,
  RecoveryCategory,
} from "@shared/commercial-lease-types";

// ─── Date Utilities ──────────────────────────────────────────────────────────

/** Parse YYYY-MM-DD to Date (UTC) */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Get last day of month as YYYY-MM-DD */
function monthEnd(year: number, month: number): string {
  // month is 1-indexed
  const d = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of month
  return d.toISOString().slice(0, 10);
}

/** Get first day of month */
function monthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

/** Days in a month */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getDate();
}

/** Generate array of month_end strings from start to end (inclusive) */
function generateMonthEnds(from: string, to: string): string[] {
  const start = parseDate(from);
  const end = parseDate(to);
  const results: string[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth() + 1; // 1-indexed
  while (true) {
    const me = monthEnd(y, m);
    if (parseDate(me) > end) break;
    if (parseDate(me) >= start) results.push(me);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return results;
}

/** Compute proration: intersection of [termStart, termEnd] with [monthStart, monthEnd] / daysInMonth */
function computeProration(
  termStartStr: string,
  termEndStr: string,
  meStr: string
): number {
  const me = parseDate(meStr);
  const year = me.getUTCFullYear();
  const month = me.getUTCMonth() + 1;
  const ms = monthStart(year, month);
  const dim = daysInMonth(year, month);

  const tStart = parseDate(termStartStr);
  const tEnd = parseDate(termEndStr);

  const overlapStart = tStart > ms ? tStart : ms;
  const overlapEnd = tEnd < me ? tEnd : me;

  if (overlapStart > overlapEnd) return 0;

  const occupiedDays =
    (overlapEnd.getTime() - overlapStart.getTime()) / 86400000 + 1;
  return Math.min(1, Math.max(0, occupiedDays / dim));
}

/** Months between two dates (approximate, for escalation cycle tracking) */
function monthsBetween(from: string, to: string): number {
  const f = parseDate(from);
  const t = parseDate(to);
  return (
    (t.getUTCFullYear() - f.getUTCFullYear()) * 12 +
    (t.getUTCMonth() - f.getUTCMonth())
  );
}

/** Get year and month from month_end string */
function getYM(meStr: string): { year: number; month: number } {
  const d = parseDate(meStr);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

// ─── Escalation Helpers ──────────────────────────────────────────────────────

interface EscalationConfig {
  type: string;
  value: number;
  cycleMonths: number;
}

/** Compute escalated rate for a given month relative to term start */
function applyEscalation(
  baseRate: number,
  esc: EscalationConfig,
  monthsFromTermStart: number,
  sf: number
): number {
  if (esc.type === "NONE" || esc.cycleMonths <= 0) return baseRate;
  const cycles = Math.floor(monthsFromTermStart / esc.cycleMonths);
  if (cycles <= 0) return baseRate;

  switch (esc.type) {
    case "FIXED_DOLLAR":
      return baseRate + esc.value * cycles;
    case "FIXED_PER_SF":
      // escalationValue is per-SF annual increase; we add cycles * (sf * val / 12) to the monthly rate
      // But baseRate is already monthly. The escalation adds per cycle:
      // For PER_SF_YEAR mode: rate is $/SF/year, so add esc.value each cycle
      // Since this is applied to the raw rate before mode conversion, add directly
      return baseRate + esc.value * cycles;
    case "PERCENT":
      return baseRate * Math.pow(1 + esc.value, cycles);
    case "CPI":
      // No-op unless CPI index exists; treat as no escalation
      return baseRate;
    default:
      return baseRate;
  }
}

// ─── A/B/C) Base Rent Computation ────────────────────────────────────────────

interface TermCashflow {
  monthEnd: string;
  baseRent: number;
  termIndex: number;
  proration: number;
}

function computeBaseRent(
  lease: CommercialLease,
  terms: LeaseTerm[],
  monthEnds: string[]
): TermCashflow[] {
  const sf = parseFloat(lease.sf) || 0;
  const sorted = [...terms].sort((a, b) => a.termIndex - b.termIndex);
  const results: TermCashflow[] = [];

  for (const me of monthEnds) {
    let found = false;
    for (const term of sorted) {
      const proration = computeProration(term.startDate, term.endDate, me);
      if (proration <= 0) continue;

      const monthsFromStart = monthsBetween(term.startDate, me);
      const rawRate = parseFloat(term.baseRentValue) || 0;
      const esc: EscalationConfig = {
        type: term.escalationType,
        value: parseFloat(term.escalationValue) || 0,
        cycleMonths: term.escalationCycleMonths || 12,
      };

      const escalatedRate = applyEscalation(rawRate, esc, monthsFromStart, sf);

      let monthlyRent: number;
      switch (term.baseRentMode) {
        case "PER_SF_YEAR":
          monthlyRent = (sf * escalatedRate) / 12;
          break;
        case "PER_MONTH":
          monthlyRent = escalatedRate;
          break;
        case "PER_YEAR":
          monthlyRent = escalatedRate / 12;
          break;
        default:
          monthlyRent = 0;
      }

      results.push({
        monthEnd: me,
        baseRent: Math.round(monthlyRent * proration * 100) / 100,
        termIndex: term.termIndex,
        proration,
      });
      found = true;
      break; // first matching term wins (they shouldn't overlap)
    }
    if (!found) {
      results.push({ monthEnd: me, baseRent: 0, termIndex: -1, proration: 0 });
    }
  }
  return results;
}

// ─── D) Charge Lines ─────────────────────────────────────────────────────────

interface ChargeLineResult {
  monthEnd: string;
  lineType: string;
  amount: number;
}

function computeChargeLines(
  lease: CommercialLease,
  chargeLines: LeaseChargeLine[],
  monthEnds: string[]
): ChargeLineResult[] {
  const sf = parseFloat(lease.sf) || 0;
  const results: ChargeLineResult[] = [];

  for (const cl of chargeLines) {
    const clEnd = cl.endDate || lease.expirationDate;
    for (const me of monthEnds) {
      const proration = computeProration(cl.startDate, clEnd, me);
      if (proration <= 0) continue;

      const monthsFromStart = monthsBetween(cl.startDate, me);
      const rawAmount = parseFloat(cl.amountValue) || 0;
      const esc: EscalationConfig = {
        type: cl.escalationType || "NONE",
        value: parseFloat(cl.escalationValue || "0"),
        cycleMonths: cl.escalationCycleMonths || 12,
      };

      const escalatedAmount = applyEscalation(rawAmount, esc, monthsFromStart, sf);

      let monthly: number;
      switch (cl.amountMode) {
        case "PER_SF_MONTHLY":
          monthly = sf * escalatedAmount;
          break;
        case "FIXED_MONTHLY":
        default:
          monthly = escalatedAmount;
      }

      const sign = cl.lineType === "DISCOUNT" ? -1 : 1;
      results.push({
        monthEnd: me,
        lineType: cl.lineType,
        amount: Math.round(monthly * proration * sign * 100) / 100,
      });
    }
  }
  return results;
}

// ─── E) Abatements ───────────────────────────────────────────────────────────

interface MonthCharges {
  baseRent: number;
  recoveries: number; // sum of CAM+TAX+INS+UTIL
  miscIncome: number;
  discounts: number;
  tiAmortization: number;
}

function applyAbatements(
  charges: MonthCharges,
  abatements: LeaseAbatement[],
  meStr: string
): MonthCharges {
  let result = { ...charges };

  for (const abat of abatements) {
    const proration = computeProration(abat.startDate, abat.endDate, meStr);
    if (proration <= 0) continue;

    const val = parseFloat(abat.value) || 0;

    switch (abat.abatementType) {
      case "FREE_RENT":
        if (abat.appliesTo === "BASE_ONLY") {
          result.baseRent = result.baseRent * (1 - proration);
        } else if (abat.appliesTo === "BASE_PLUS_RECOVERIES") {
          result.baseRent = result.baseRent * (1 - proration);
          result.recoveries = result.recoveries * (1 - proration);
        } else {
          // ALL_CHARGES
          result.baseRent = result.baseRent * (1 - proration);
          result.recoveries = result.recoveries * (1 - proration);
          result.miscIncome = result.miscIncome * (1 - proration);
          result.tiAmortization = result.tiAmortization * (1 - proration);
        }
        break;
      case "PERCENT_DISCOUNT":
        const disc = val * proration;
        if (abat.appliesTo === "BASE_ONLY") {
          result.baseRent = result.baseRent * (1 - disc);
        } else if (abat.appliesTo === "BASE_PLUS_RECOVERIES") {
          result.baseRent = result.baseRent * (1 - disc);
          result.recoveries = result.recoveries * (1 - disc);
        } else {
          result.baseRent = result.baseRent * (1 - disc);
          result.recoveries = result.recoveries * (1 - disc);
          result.miscIncome = result.miscIncome * (1 - disc);
          result.tiAmortization = result.tiAmortization * (1 - disc);
        }
        break;
      case "FIXED_CREDIT": {
        const credit = val * proration;
        if (abat.appliesTo === "BASE_ONLY") {
          result.baseRent = Math.max(0, result.baseRent - credit);
        } else if (abat.appliesTo === "BASE_PLUS_RECOVERIES") {
          let remaining = credit;
          const baseReduction = Math.min(result.baseRent, remaining);
          result.baseRent -= baseReduction;
          remaining -= baseReduction;
          result.recoveries = Math.max(0, result.recoveries - remaining);
        } else {
          let remaining = credit;
          const baseReduction = Math.min(result.baseRent, remaining);
          result.baseRent -= baseReduction;
          remaining -= baseReduction;
          const recReduction = Math.min(result.recoveries, remaining);
          result.recoveries -= recReduction;
          remaining -= recReduction;
          result.miscIncome = Math.max(0, result.miscIncome - remaining);
        }
        break;
      }
    }
  }

  return result;
}

// ─── F) TI Program ──────────────────────────────────────────────────────────

interface TiMonthlyResult {
  monthEnd: string;
  landlordCapex: number;
  tenantContribution: number;
  amortizationCharge: number;
}

function computeTi(
  lease: CommercialLease,
  tiPrograms: LeaseTiProgram[],
  tiDraws: LeaseTiDraw[],
  monthEnds: string[]
): TiMonthlyResult[] {
  if (!tiPrograms.length) {
    return monthEnds.map((me) => ({
      monthEnd: me,
      landlordCapex: 0,
      tenantContribution: 0,
      amortizationCharge: 0,
    }));
  }

  const program = tiPrograms[0]; // primary TI program
  const sf = parseFloat(lease.sf) || 0;

  // 1) Total allowance
  const allowance =
    program.allowanceMode === "PER_SF"
      ? sf * (parseFloat(program.allowanceValue) || 0)
      : parseFloat(program.allowanceValue) || 0;

  const landlordCap =
    program.landlordCapTotal != null
      ? parseFloat(program.landlordCapTotal)
      : Infinity;

  // 2) Total draws
  const totalDraws = tiDraws.reduce(
    (sum, d) => sum + (parseFloat(d.amount) || 0),
    0
  );

  // 3) Allocate landlord vs tenant
  let landlordTotal: number;
  let tenantTotal: number;

  const participationValue = parseFloat(program.tenantParticipationValue || "0");
  const fixedContrib = parseFloat(program.tenantFixedContribution || "0");

  switch (program.tenantParticipationMode) {
    case "PERCENT_ABOVE_ALLOWANCE": {
      const overAllowance = Math.max(0, totalDraws - allowance);
      tenantTotal = overAllowance * participationValue;
      landlordTotal = Math.min(totalDraws - tenantTotal, landlordCap);
      tenantTotal = totalDraws - landlordTotal;
      break;
    }
    case "FIXED_CONTRIBUTION": {
      tenantTotal = Math.min(fixedContrib, totalDraws);
      landlordTotal = Math.min(totalDraws - tenantTotal, landlordCap);
      tenantTotal = totalDraws - landlordTotal;
      break;
    }
    case "COMBO": {
      // Fixed contribution first, then percent above allowance
      let tenantFixed = Math.min(fixedContrib, totalDraws);
      const remaining = totalDraws - tenantFixed;
      const overAllowance = Math.max(0, remaining - allowance);
      const tenantPercent = overAllowance * participationValue;
      tenantTotal = tenantFixed + tenantPercent;
      landlordTotal = Math.min(totalDraws - tenantTotal, landlordCap);
      tenantTotal = totalDraws - landlordTotal;
      break;
    }
    default:
      // NONE
      landlordTotal = Math.min(totalDraws, allowance, landlordCap);
      tenantTotal = totalDraws - landlordTotal;
  }

  // Proportion for allocation of each draw
  const landlordRatio = totalDraws > 0 ? landlordTotal / totalDraws : 0;
  const tenantRatio = totalDraws > 0 ? tenantTotal / totalDraws : 0;

  // 4) Map draws to month_ends
  const drawsByMonth = new Map<string, { landlord: number; tenant: number }>();
  for (const draw of tiDraws) {
    const dd = parseDate(draw.drawDate);
    const me = monthEnd(dd.getUTCFullYear(), dd.getUTCMonth() + 1);
    const existing = drawsByMonth.get(me) || { landlord: 0, tenant: 0 };
    const amt = parseFloat(draw.amount) || 0;
    existing.landlord += amt * landlordRatio;
    existing.tenant += amt * tenantRatio;
    drawsByMonth.set(me, existing);
  }

  // 5) Amortization schedule
  const amortByMonth = new Map<string, number>();
  if (program.amortizeEnabled) {
    const amortBasis =
      program.amortizeAmountBasis === "LANDLORD_PLUS_TENANT"
        ? totalDraws
        : landlordTotal;
    const rate = parseFloat(program.amortizeRateAnnual || "0");
    const termMonths = program.amortizeTermMonths || 120;
    const startMe =
      program.amortizeStartMonthEnd ||
      lease.rentCommencementDate ||
      lease.commencementDate;

    let monthlyPayment: number;
    if (rate > 0) {
      // Standard amortization: PMT formula
      const monthlyRate = rate / 12;
      monthlyPayment =
        (amortBasis * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
    } else {
      // Straight-line
      monthlyPayment = amortBasis / termMonths;
    }
    monthlyPayment = Math.round(monthlyPayment * 100) / 100;

    const startDate = parseDate(startMe);
    let y = startDate.getUTCFullYear();
    let m = startDate.getUTCMonth() + 1;
    for (let i = 0; i < termMonths; i++) {
      const me = monthEnd(y, m);
      amortByMonth.set(me, monthlyPayment);
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  // 6) Build results
  return monthEnds.map((me) => ({
    monthEnd: me,
    landlordCapex: Math.round((drawsByMonth.get(me)?.landlord || 0) * 100) / 100,
    tenantContribution: Math.round((drawsByMonth.get(me)?.tenant || 0) * 100) / 100,
    amortizationCharge: amortByMonth.get(me) || 0,
  }));
}

// ─── G) Percent Rent ─────────────────────────────────────────────────────────

interface PercentRentResult {
  monthEnd: string;
  percentRent: number;
}

function computePercentRent(
  lease: CommercialLease,
  rules: LeasePercentRentRule[],
  sales: LeaseSale[],
  baseRentByMonth: Map<string, number>,
  monthEnds: string[]
): PercentRentResult[] {
  if (!rules.length) {
    return monthEnds.map((me) => ({ monthEnd: me, percentRent: 0 }));
  }

  const rule = rules[0]; // primary rule
  const tiers: PercentRentTier[] = (rule.tiersJson as PercentRentTier[]) || [];
  if (!tiers.length || tiers.every((t) => t.rate === 0)) {
    return monthEnds.map((me) => ({ monthEnd: me, percentRent: 0 }));
  }

  const fyEndMonth =
    rule.trueupYearBasis === "TENANT_FISCAL"
      ? lease.fiscalYearEndMonth
      : 12;

  // Build sales lookup: month_end -> sales amount
  const salesMap = new Map<string, number>();
  for (const s of sales) salesMap.set(s.monthEnd, parseFloat(s.salesAmount) || 0);

  // Forecast missing sales using growth rate
  const growthRate = parseFloat(rule.salesGrowthRate || "0");
  for (const me of monthEnds) {
    if (!salesMap.has(me)) {
      // Use last known sales * (1 + growth)^months_elapsed / 12
      // Simple: just use 0 if no data
      salesMap.set(me, 0);
    }
  }

  // Determine annual base rent for natural breakpoint
  const annualBaseRent = Array.from(baseRentByMonth.values()).reduce(
    (sum, v) => sum + v,
    0
  );
  const avgAnnualBaseRent =
    monthEnds.length > 0
      ? (annualBaseRent / monthEnds.length) * 12
      : 0;

  // Annual breakpoint
  let annualBreakpoint: number;
  if (rule.breakpointType === "NATURAL") {
    const primaryRate = tiers[0]?.rate || 0;
    annualBreakpoint = primaryRate > 0 ? avgAnnualBaseRent / primaryRate : Infinity;
  } else {
    annualBreakpoint = parseFloat(rule.artificialBreakpointAmount || "0");
  }

  // Group months into fiscal years
  const yearGroups = new Map<string, string[]>(); // yearKey -> monthEnds[]
  for (const me of monthEnds) {
    const { year, month } = getYM(me);
    let fyKey: string;
    if (fyEndMonth === 12) {
      fyKey = `${year}`;
    } else {
      // FY ends in fyEndMonth; months after fyEndMonth belong to next FY
      fyKey = month > fyEndMonth ? `FY${year + 1}` : `FY${year}`;
    }
    if (!yearGroups.has(fyKey)) yearGroups.set(fyKey, []);
    yearGroups.get(fyKey)!.push(me);
  }

  const results = new Map<string, number>();
  monthEnds.forEach((me) => results.set(me, 0));

  for (const [fyKey, fyMonths] of yearGroups) {
    // Sort months chronologically
    fyMonths.sort();
    const fyTotalSales = fyMonths.reduce(
      (sum, me) => sum + (salesMap.get(me) || 0),
      0
    );

    // Compute tiered overage
    const computeTieredOverage = (totalSales: number, bp: number): number => {
      if (totalSales <= bp) return 0;
      let overage = 0;
      const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);
      for (let i = 0; i < sortedTiers.length; i++) {
        const tier = sortedTiers[i];
        const tierFloor = Math.max(bp, tier.threshold);
        const tierCeiling =
          i + 1 < sortedTiers.length
            ? sortedTiers[i + 1].threshold
            : Infinity;
        if (totalSales <= tierFloor) continue;
        const taxable = Math.min(totalSales, tierCeiling) - tierFloor;
        if (taxable > 0) overage += taxable * tier.rate;
      }
      return Math.max(0, overage);
    };

    switch (rule.timing) {
      case "ANNUAL_TRUEUP": {
        // Book entire overage in the FY end month
        const overage = computeTieredOverage(fyTotalSales, annualBreakpoint);
        // Find the FY end month in this group
        const endMonth = fyMonths[fyMonths.length - 1];
        results.set(endMonth, Math.round(overage * 100) / 100);
        break;
      }
      case "MONTHLY": {
        // YTD approach: compute cumulative and recognize incremental each month
        let prevCumOverage = 0;
        for (let i = 0; i < fyMonths.length; i++) {
          const me = fyMonths[i];
          const ytdSales = fyMonths
            .slice(0, i + 1)
            .reduce((s, m) => s + (salesMap.get(m) || 0), 0);
          const elapsedMonths = i + 1;
          const proRatedBP = (annualBreakpoint * elapsedMonths) / 12;
          const ytdOverage = computeTieredOverage(ytdSales, proRatedBP);
          const monthlyInc = Math.max(0, ytdOverage - prevCumOverage);
          results.set(me, Math.round(monthlyInc * 100) / 100);
          prevCumOverage = ytdOverage;
        }
        break;
      }
      case "QUARTERLY": {
        // Group into quarters within the FY, book in quarter-end month
        for (let q = 0; q < 4; q++) {
          const qMonths = fyMonths.slice(q * 3, (q + 1) * 3);
          if (!qMonths.length) continue;
          const qSales = qMonths.reduce(
            (s, m) => s + (salesMap.get(m) || 0),
            0
          );
          const qBP = annualBreakpoint / 4;
          const qOverage = computeTieredOverage(qSales, qBP);
          const endMonth = qMonths[qMonths.length - 1];
          results.set(endMonth, Math.round(qOverage * 100) / 100);
        }
        break;
      }
    }
  }

  return monthEnds.map((me) => ({
    monthEnd: me,
    percentRent: results.get(me) || 0,
  }));
}

// ─── H) Recovery Stops ───────────────────────────────────────────────────────

type RecoveryCategoryMap = {
  [K in RecoveryCategory]?: number;
};

interface RecoveryResult {
  monthEnd: string;
  cam: number;
  tax: number;
  insurance: number;
  utilities: number;
}

function computeRecoveries(
  lease: CommercialLease,
  recoveryModels: LeaseRecoveryModel[],
  categories: LeaseRecoveryCategoryRow[],
  monthEnds: string[]
): RecoveryResult[] {
  if (!recoveryModels.length) {
    return monthEnds.map((me) => ({
      monthEnd: me,
      cam: 0,
      tax: 0,
      insurance: 0,
      utilities: 0,
    }));
  }

  const model = recoveryModels[0];
  const sf = parseFloat(lease.sf) || 0;
  const totalNra = parseFloat(model.totalPropertyNraSf || "0");

  // Tenant share
  let tenantShare: number;
  if (model.tenantShareMode === "FIXED_PERCENT") {
    tenantShare = parseFloat(model.tenantSharePercent || "0");
  } else {
    tenantShare = totalNra > 0 ? sf / totalNra : 0;
  }

  // Build category lookup
  const catMap = new Map<RecoveryCategory, LeaseRecoveryCategoryRow>();
  for (const cat of categories) catMap.set(cat.category, cat);

  const catKeys: RecoveryCategory[] = ["CAM", "TAX", "INSURANCE", "UTILITIES"];

  return monthEnds.map((me) => {
    const { year, month } = getYM(me);
    const proration = computeProration(
      lease.commencementDate,
      lease.expirationDate,
      me
    );
    if (proration <= 0) {
      return { monthEnd: me, cam: 0, tax: 0, insurance: 0, utilities: 0 };
    }

    const result: RecoveryCategoryMap = {};

    for (const catKey of catKeys) {
      const cat = catMap.get(catKey);
      if (!cat) {
        result[catKey] = 0;
        continue;
      }

      // Determine annual expense for this year
      let annualExpense: number;
      const forecast = cat.annualExpenseForecast as Record<string, number> | null;
      if (forecast && forecast[String(year)] != null) {
        annualExpense = forecast[String(year)];
      } else if (cat.annualGrowthRate && cat.baseYearAmountTotal) {
        const baseYearAmt = parseFloat(cat.baseYearAmountTotal) || 0;
        const growth = parseFloat(cat.annualGrowthRate) || 0;
        const baseYear = model.baseYear || year;
        const yearsElapsed = year - baseYear;
        annualExpense = baseYearAmt * Math.pow(1 + growth, Math.max(0, yearsElapsed));
      } else {
        annualExpense = parseFloat(cat.baseYearAmountTotal || "0");
      }

      // Gross-up
      if (model.grossupEnabled && model.grossupOccupancyThreshold) {
        const threshold = parseFloat(model.grossupOccupancyThreshold);
        if (threshold > 0 && threshold < 1) {
          // Assume variable expenses scale with occupancy; gross up to threshold
          annualExpense = annualExpense / threshold;
        }
      }

      const monthlyExpense = annualExpense / 12;

      // Apply stop rules
      let tenantMonthlyCharge: number;
      switch (cat.stopType) {
        case "BASE_YEAR_STOP": {
          const baseYearTotal = parseFloat(cat.baseYearAmountTotal || "0");
          const baseMonthly = baseYearTotal / 12;
          const overage = Math.max(0, monthlyExpense - baseMonthly);
          tenantMonthlyCharge = overage * tenantShare;
          break;
        }
        case "EXPENSE_STOP_PER_SF": {
          const stopPerSf = parseFloat(cat.expenseStopPerSf || "0");
          const stopTotal = stopPerSf * totalNra; // annual property-level stop
          const monthlyStop = stopTotal / 12;
          const overage = Math.max(0, monthlyExpense - monthlyStop);
          tenantMonthlyCharge = overage * tenantShare;
          break;
        }
        case "NONE":
        default:
          tenantMonthlyCharge = monthlyExpense * tenantShare;
      }

      result[catKey] = Math.round(tenantMonthlyCharge * proration * 100) / 100;
    }

    return {
      monthEnd: me,
      cam: result.CAM || 0,
      tax: result.TAX || 0,
      insurance: result.INSURANCE || 0,
      utilities: result.UTILITIES || 0,
    };
  });
}

// ─── MAIN ENGINE ─────────────────────────────────────────────────────────────

export interface LeaseComputeInput {
  lease: CommercialLease;
  terms: LeaseTerm[];
  chargeLines: LeaseChargeLine[];
  abatements: LeaseAbatement[];
  sales: LeaseSale[];
  percentRentRules: LeasePercentRentRule[];
  tiPrograms: LeaseTiProgram[];
  tiDraws: LeaseTiDraw[];
  recoveryModels: LeaseRecoveryModel[];
  recoveryCategories: LeaseRecoveryCategoryRow[];
}

export interface ComputedCashflowRow {
  leaseId: string;
  monthEnd: string;
  baseRent: number;
  recoveriesCam: number;
  recoveriesTax: number;
  recoveriesInsurance: number;
  recoveriesUtilities: number;
  miscIncome: number;
  discounts: number;
  percentRent: number;
  tiLandlordCapex: number;
  tiTenantContribution: number;
  tiAmortizationCharge: number;
  totalRent: number;
  meta: Record<string, unknown>;
}

/**
 * computeLeaseMonthlyCashflows — PURE FUNCTION
 * Calendar month_end is the controlling axis.
 * Returns one row per month_end within [startMonthEnd, endMonthEnd].
 */
export function computeLeaseMonthlyCashflows(
  input: LeaseComputeInput,
  startMonthEnd: string,
  endMonthEnd: string
): ComputedCashflowRow[] {
  const { lease, terms, chargeLines, abatements, sales, percentRentRules, tiPrograms, tiDraws, recoveryModels, recoveryCategories } = input;

  // Clamp to lease dates
  const effectiveStart =
    startMonthEnd > lease.commencementDate
      ? startMonthEnd
      : lease.commencementDate;
  const effectiveEnd =
    endMonthEnd < lease.expirationDate
      ? endMonthEnd
      : lease.expirationDate;

  const monthEnds = generateMonthEnds(effectiveStart, effectiveEnd);
  if (!monthEnds.length) return [];

  // A/B/C) Base rent
  const baseRentRows = computeBaseRent(lease, terms, monthEnds);
  const baseRentMap = new Map<string, number>();
  const termIndexMap = new Map<string, number>();
  for (const row of baseRentRows) {
    baseRentMap.set(row.monthEnd, row.baseRent);
    termIndexMap.set(row.monthEnd, row.termIndex);
  }

  // D) Charge lines
  const chargeLineRows = computeChargeLines(lease, chargeLines, monthEnds);
  const clByMonth = new Map<string, { misc: number; discounts: number; tiAmort: number }>();
  for (const me of monthEnds) {
    clByMonth.set(me, { misc: 0, discounts: 0, tiAmort: 0 });
  }
  for (const cl of chargeLineRows) {
    const entry = clByMonth.get(cl.monthEnd);
    if (!entry) continue;
    if (cl.lineType === "DISCOUNT") {
      entry.discounts += cl.amount; // already negative
    } else if (cl.lineType === "TI_AMORTIZATION") {
      entry.tiAmort += cl.amount;
    } else if (cl.lineType === "MISC_INCOME") {
      entry.misc += cl.amount;
    }
    // RECOVERY_ types from charge lines are intentionally separate from recovery model;
    // they represent manual overrides. Add to misc for now.
    if (
      cl.lineType.startsWith("RECOVERY_") &&
      cl.lineType !== "RECOVERY_CAM" &&
      cl.lineType !== "RECOVERY_TAX" &&
      cl.lineType !== "RECOVERY_INSURANCE" &&
      cl.lineType !== "RECOVERY_UTILITIES"
    ) {
      entry.misc += cl.amount;
    }
  }

  // Recovery charge lines (manual overrides via charge_lines table)
  const recoveryCLByMonth = new Map<
    string,
    { cam: number; tax: number; insurance: number; utilities: number }
  >();
  for (const me of monthEnds) {
    recoveryCLByMonth.set(me, { cam: 0, tax: 0, insurance: 0, utilities: 0 });
  }
  for (const cl of chargeLineRows) {
    const entry = recoveryCLByMonth.get(cl.monthEnd);
    if (!entry) continue;
    switch (cl.lineType) {
      case "RECOVERY_CAM": entry.cam += cl.amount; break;
      case "RECOVERY_TAX": entry.tax += cl.amount; break;
      case "RECOVERY_INSURANCE": entry.insurance += cl.amount; break;
      case "RECOVERY_UTILITIES": entry.utilities += cl.amount; break;
    }
  }

  // F) TI
  const tiRows = computeTi(lease, tiPrograms, tiDraws, monthEnds);
  const tiMap = new Map<string, TiMonthlyResult>();
  for (const ti of tiRows) tiMap.set(ti.monthEnd, ti);

  // H) Recovery stops
  const recoveryRows = computeRecoveries(
    lease,
    recoveryModels,
    recoveryCategories,
    monthEnds
  );
  const recoveryMap = new Map<string, RecoveryResult>();
  for (const r of recoveryRows) recoveryMap.set(r.monthEnd, r);

  // G) Percent rent (needs base rent map)
  const percentRentRows = computePercentRent(
    lease,
    percentRentRules,
    sales,
    baseRentMap,
    monthEnds
  );
  const percentRentMap = new Map<string, number>();
  for (const pr of percentRentRows) percentRentMap.set(pr.monthEnd, pr.percentRent);

  // Assemble and apply abatements
  return monthEnds.map((me) => {
    const ti = tiMap.get(me) || {
      landlordCapex: 0,
      tenantContribution: 0,
      amortizationCharge: 0,
    };
    const rec = recoveryMap.get(me) || { cam: 0, tax: 0, insurance: 0, utilities: 0 };
    const recCL = recoveryCLByMonth.get(me) || { cam: 0, tax: 0, insurance: 0, utilities: 0 };
    const cl = clByMonth.get(me) || { misc: 0, discounts: 0, tiAmort: 0 };

    // Combine recovery model results with manual charge line recoveries
    const totalRecCam = rec.cam + recCL.cam;
    const totalRecTax = rec.tax + recCL.tax;
    const totalRecIns = rec.insurance + recCL.insurance;
    const totalRecUtil = rec.utilities + recCL.utilities;

    // Pre-abatement charges
    const preAbatement: MonthCharges = {
      baseRent: baseRentMap.get(me) || 0,
      recoveries: totalRecCam + totalRecTax + totalRecIns + totalRecUtil,
      miscIncome: cl.misc,
      discounts: cl.discounts,
      tiAmortization: ti.amortizationCharge + cl.tiAmort,
    };

    // E) Apply abatements
    const postAbatement = applyAbatements(preAbatement, abatements, me);

    // Distribute recoveries back proportionally after abatement
    const recTotal = totalRecCam + totalRecTax + totalRecIns + totalRecUtil;
    const recRatio = recTotal > 0 ? postAbatement.recoveries / recTotal : 0;

    const finalCam = Math.round(totalRecCam * recRatio * 100) / 100;
    const finalTax = Math.round(totalRecTax * recRatio * 100) / 100;
    const finalIns = Math.round(totalRecIns * recRatio * 100) / 100;
    const finalUtil = Math.round(totalRecUtil * recRatio * 100) / 100;

    const pctRent = percentRentMap.get(me) || 0;

    const baseRent = Math.round(postAbatement.baseRent * 100) / 100;
    const miscIncome = Math.round(postAbatement.miscIncome * 100) / 100;
    const discounts = Math.round(postAbatement.discounts * 100) / 100;
    const tiAmortCharge = Math.round(postAbatement.tiAmortization * 100) / 100;

    const totalRent =
      baseRent +
      finalCam + finalTax + finalIns + finalUtil +
      miscIncome +
      discounts + // already negative for discounts
      pctRent +
      tiAmortCharge;

    return {
      leaseId: lease.id,
      monthEnd: me,
      baseRent,
      recoveriesCam: finalCam,
      recoveriesTax: finalTax,
      recoveriesInsurance: finalIns,
      recoveriesUtilities: finalUtil,
      miscIncome,
      discounts,
      percentRent: pctRent,
      tiLandlordCapex: ti.landlordCapex,
      tiTenantContribution: ti.tenantContribution,
      tiAmortizationCharge: tiAmortCharge,
      totalRent: Math.round(totalRent * 100) / 100,
      meta: {
        termIndex: termIndexMap.get(me) ?? -1,
        isAbatement: postAbatement.baseRent !== (baseRentMap.get(me) || 0),
        isTrueupMonth: (percentRentMap.get(me) || 0) > 0,
        fyBasisUsed:
          percentRentRules[0]?.trueupYearBasis || "CALENDAR",
      },
    };
  });
}
