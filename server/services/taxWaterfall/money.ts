export const ZERO = 0n;

export function toCents(dollars: number): bigint {
  return BigInt(Math.round(dollars * 100));
}

export function fromCents(cents: bigint): number {
  return Number(cents) / 100;
}

export function fromCentsStr(cents: bigint): string {
  return cents.toString();
}

export function parseCentsStr(s: string | null | undefined): bigint {
  if (!s) return ZERO;
  return BigInt(s);
}

export function safeMultiplyRate(cents: bigint, rate: number): bigint {
  if (rate === 0) return ZERO;
  const scaled = Number(cents) * rate;
  return BigInt(Math.round(scaled));
}

export function allocateProRata(totalCents: bigint, weights: { id: string; weight: number }[]): Map<string, bigint> {
  const result = new Map<string, bigint>();
  if (weights.length === 0 || totalCents === ZERO) return result;

  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  if (totalWeight === 0) return result;

  let allocated = ZERO;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (i === weights.length - 1) {
      result.set(w.id, totalCents - allocated);
    } else {
      const share = BigInt(Math.round(Number(totalCents) * (w.weight / totalWeight)));
      result.set(w.id, share);
      allocated += share;
    }
  }
  return result;
}

export function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function absBigInt(a: bigint): bigint {
  return a < 0n ? -a : a;
}

export function sumMap(m: Map<string, bigint>): bigint {
  let total = ZERO;
  for (const v of m.values()) total += v;
  return total;
}
