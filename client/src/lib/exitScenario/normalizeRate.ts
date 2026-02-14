/**
 * normalizeRate — Ensures rates are in decimal form (0.05 not 5).
 *
 * If the input is > 1, assumes it's a percentage and divides by 100.
 * Logs a console.warn in dev so the caller can track down the source.
 */
export function normalizeRate(value: number, label?: string): number {
  if (value > 1) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[normalizeRate] "${label ?? 'rate'}" was ${value}, treating as percent → ${value / 100}. ` +
        `Pass a decimal (e.g. 0.05 not 5) to suppress this warning.`
      );
    }
    return value / 100;
  }
  return value;
}

/**
 * ensurePercent — Opposite direction: guarantee the value is in percent form
 * (5 not 0.05). Used for UI display when the source is a decimal.
 */
export function ensurePercent(value: number): number {
  if (value > 0 && value < 1) {
    return value * 100;
  }
  return value;
}
