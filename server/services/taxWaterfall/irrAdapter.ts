import { calculateXIRR, calculateMOIC } from '@shared/exit/irr-calculator';
import { fromCents } from './money';

export interface PartnerCashflowEntry {
  periodIndex: number;
  date: Date;
  investmentCents: bigint;
  distributionCents: bigint;
}

export function computePartnerIRR(entries: PartnerCashflowEntry[]): number | null {
  if (entries.length < 2) return null;

  const xirrFlows = entries
    .map(e => ({
      date: e.date,
      amount: fromCents(e.distributionCents - e.investmentCents),
    }))
    .filter(cf => cf.amount !== 0);

  if (xirrFlows.length < 2) return null;

  const hasPositive = xirrFlows.some(cf => cf.amount > 0);
  const hasNegative = xirrFlows.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  return calculateXIRR(xirrFlows);
}

export function computePartnerMOIC(totalInvestedCents: bigint, totalDistributedCents: bigint): number | null {
  if (totalInvestedCents === 0n) return null;
  return calculateMOIC(fromCents(totalInvestedCents), fromCents(totalDistributedCents));
}
