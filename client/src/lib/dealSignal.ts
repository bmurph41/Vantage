export type DealSignal = 'Buy' | 'Conditional' | 'Pass';

export interface DealSignalInput {
  irr?: number | null;
  capRate?: number | null;
  equityMultiple?: number | null;
  cashOnCash?: number | null;
  purchasePrice?: number | null;
  exitValue?: number | null;
  noiGrowthRate?: number | null;
  totalProfit?: number | null;
  exitNetProceeds?: number | null;
  exitMoic?: number | null;
  exitIrr?: number | null;
}

export interface DealSignalResult {
  signal: DealSignal;
  score: number;
  reasons: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}

export function computeDealSignal(input: DealSignalInput): DealSignalResult {
  let score = 50;
  const reasons: string[] = [];
  let dataPoints = 0;

  const irr = normalizePercent(input.irr);
  if (irr != null) {
    dataPoints++;
    if (irr >= 20) { score += 15; reasons.push(`Strong IRR of ${irr.toFixed(1)}% exceeds 20% threshold`); }
    else if (irr >= 15) { score += 10; reasons.push(`Solid IRR of ${irr.toFixed(1)}% meets 15% target`); }
    else if (irr >= 12) { score += 3; reasons.push(`Moderate IRR of ${irr.toFixed(1)}% — below 15% ideal`); }
    else if (irr >= 8) { score -= 5; reasons.push(`Below-target IRR of ${irr.toFixed(1)}% — value-add needed`); }
    else { score -= 15; reasons.push(`Weak IRR of ${irr.toFixed(1)}% — does not meet institutional minimums`); }
  }

  const capRate = normalizePercent(input.capRate);
  if (capRate != null) {
    dataPoints++;
    if (capRate >= 8) { score += 12; reasons.push(`Attractive ${capRate.toFixed(1)}% going-in cap rate`); }
    else if (capRate >= 7) { score += 8; reasons.push(`Healthy ${capRate.toFixed(1)}% going-in cap rate`); }
    else if (capRate >= 6) { score += 2; reasons.push(`Market-rate ${capRate.toFixed(1)}% cap — limited margin of safety`); }
    else if (capRate >= 5) { score -= 5; reasons.push(`Thin ${capRate.toFixed(1)}% cap rate — premium pricing`); }
    else { score -= 12; reasons.push(`Sub-5% cap rate signals aggressive pricing`); }
  }

  const em = input.equityMultiple != null && !isNaN(input.equityMultiple) ? input.equityMultiple : null;
  if (em != null && em > 0) {
    dataPoints++;
    if (em >= 2.5) { score += 10; reasons.push(`Excellent ${em.toFixed(2)}x equity multiple`); }
    else if (em >= 2.0) { score += 7; reasons.push(`Strong ${em.toFixed(2)}x equity multiple`); }
    else if (em >= 1.5) { score += 3; reasons.push(`Adequate ${em.toFixed(2)}x equity multiple`); }
    else { score -= 8; reasons.push(`Low ${em.toFixed(2)}x equity multiple — limited return of capital`); }
  }

  const coc = normalizePercent(input.cashOnCash);
  if (coc != null) {
    dataPoints++;
    if (coc >= 10) { score += 8; reasons.push(`Strong ${coc.toFixed(1)}% cash-on-cash yield`); }
    else if (coc >= 8) { score += 5; reasons.push(`Good ${coc.toFixed(1)}% cash-on-cash yield`); }
    else if (coc >= 6) { score += 1; }
    else { score -= 5; reasons.push(`Low ${coc.toFixed(1)}% cash-on-cash — cash flow constrained`); }
  }

  if (input.purchasePrice != null && input.exitValue != null && input.purchasePrice > 0) {
    dataPoints++;
    const appreciation = ((input.exitValue - input.purchasePrice) / input.purchasePrice) * 100;
    if (appreciation >= 50) { score += 10; reasons.push(`${appreciation.toFixed(0)}% projected value creation`); }
    else if (appreciation >= 25) { score += 5; reasons.push(`${appreciation.toFixed(0)}% projected appreciation`); }
    else if (appreciation >= 10) { score += 2; }
    else if (appreciation < 0) { score -= 10; reasons.push(`Negative value creation — exit below purchase`); }
  }

  if (input.totalProfit != null) {
    dataPoints++;
    if (input.totalProfit > 0) { score += 5; }
    else { score -= 10; reasons.push('Negative total profit projection'); }
  }

  const growth = normalizePercent(input.noiGrowthRate);
  if (growth != null) {
    dataPoints++;
    if (growth >= 3) { score += 5; }
    else if (growth >= 1) { score += 2; }
    else if (growth < 0) { score -= 5; reasons.push('Negative NOI growth trajectory'); }
  }

  if (input.exitNetProceeds != null && input.purchasePrice != null && input.purchasePrice > 0) {
    dataPoints++;
    const exitReturn = ((input.exitNetProceeds - input.purchasePrice) / input.purchasePrice) * 100;
    if (exitReturn >= 100) { score += 12; reasons.push(`Exit net proceeds ${exitReturn.toFixed(0)}% above purchase — strong exit`); }
    else if (exitReturn >= 50) { score += 8; reasons.push(`Exit net proceeds ${exitReturn.toFixed(0)}% above purchase`); }
    else if (exitReturn >= 20) { score += 4; reasons.push(`Modest ${exitReturn.toFixed(0)}% exit gain after costs`); }
    else if (exitReturn >= 0) { score += 1; }
    else { score -= 10; reasons.push(`Exit net proceeds below purchase price — capital loss risk`); }
  } else if (input.exitNetProceeds != null && input.exitNetProceeds > 0 && !input.purchasePrice) {
    dataPoints++;
    score += 3;
    reasons.push(`Exit net proceeds: $${(input.exitNetProceeds / 1000000).toFixed(1)}M modeled`);
  }

  const exitMoic = input.exitMoic != null && !isNaN(input.exitMoic) ? input.exitMoic : null;
  if (exitMoic != null && exitMoic > 0) {
    dataPoints++;
    if (exitMoic >= 3.0) { score += 10; reasons.push(`Exceptional ${exitMoic.toFixed(2)}x exit MOIC`); }
    else if (exitMoic >= 2.0) { score += 7; reasons.push(`Strong ${exitMoic.toFixed(2)}x exit MOIC`); }
    else if (exitMoic >= 1.5) { score += 3; reasons.push(`Adequate ${exitMoic.toFixed(2)}x exit MOIC`); }
    else if (exitMoic >= 1.0) { score -= 2; reasons.push(`Marginal ${exitMoic.toFixed(2)}x exit MOIC`); }
    else { score -= 8; reasons.push(`Below-par ${exitMoic.toFixed(2)}x exit MOIC — capital erosion`); }
  }

  const exitIrr = normalizePercent(input.exitIrr);
  if (exitIrr != null) {
    dataPoints++;
    if (exitIrr >= 25) { score += 8; reasons.push(`Exit-modeled IRR of ${exitIrr.toFixed(1)}% exceeds institutional hurdles`); }
    else if (exitIrr >= 18) { score += 5; reasons.push(`Solid ${exitIrr.toFixed(1)}% exit-modeled IRR`); }
    else if (exitIrr >= 12) { score += 2; }
    else if (exitIrr < 8) { score -= 5; reasons.push(`Weak ${exitIrr.toFixed(1)}% exit-modeled IRR`); }
  }

  if (dataPoints < 2) {
    return {
      signal: 'Conditional',
      score: 0,
      reasons: ['Insufficient data to generate recommendation — add pricing inputs'],
      color: 'text-gray-500',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      borderColor: 'border-gray-300 dark:border-gray-600',
    };
  }

  score = Math.max(0, Math.min(100, score));

  const topReasons = reasons.slice(0, 4);

  if (score >= 70) {
    return {
      signal: 'Buy',
      score,
      reasons: topReasons,
      color: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-300 dark:border-green-700',
    };
  } else if (score >= 50) {
    return {
      signal: 'Conditional',
      score,
      reasons: topReasons,
      color: 'text-amber-700 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-300 dark:border-amber-700',
    };
  } else {
    return {
      signal: 'Pass',
      score,
      reasons: topReasons,
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-300 dark:border-red-700',
    };
  }
}

function normalizePercent(value: number | null | undefined): number | null {
  if (value == null || isNaN(value)) return null;
  if (Math.abs(value) < 1 && value !== 0) return value * 100;
  return value;
}

export function getSignalBadgeProps(signal: DealSignal): { label: string; className: string } {
  switch (signal) {
    case 'Buy':
      return { label: 'Buy', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-200' };
    case 'Conditional':
      return { label: 'Conditional', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 border-amber-200' };
    case 'Pass':
      return { label: 'Pass', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-200' };
  }
}
