export function normalizeLineItemLabel(raw: string): string {
  if (!raw) return '';
  
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[:–—-]+$/, '')
    .trim();
}
