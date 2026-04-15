import { createHash } from 'crypto';

/**
 * Compute a deterministic dedupe hash for a listing across any source.
 * Matches the spirit of server/listings/ingestion_v2/identity/identityResolver
 * but uses the universal marketplace field set (title + location + price).
 */
export function computeDedupeHash(input: {
  title: string;
  city?: string | null;
  state?: string | null;
  askingPrice?: number | null;
}): string {
  const norm = (s: string | null | undefined) =>
    (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const price =
    typeof input.askingPrice === 'number' && isFinite(input.askingPrice)
      ? Math.round(input.askingPrice).toString()
      : '';

  const key = [norm(input.title), norm(input.city), norm(input.state), price].join('|');
  return createHash('md5').update(key).digest('hex');
}
