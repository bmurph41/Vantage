/**
 * Line Item Normalization Utility
 * Provides deterministic text normalization for line item matching.
 */

const STRIPPABLE_SUFFIXES = [
  ' misc',
  ' miscellaneous',
  ' other',
  ' general',
  ' expense',
  ' expenses',
  ' exp',
  ' cost',
  ' costs',
  ' fee',
  ' fees',
  ' charge',
  ' charges',
  ' payment',
  ' payments',
] as const;

const STRIPPABLE_PREFIXES = [
  'total ',
  'subtotal ',
  'net ',
  'gross ',
] as const;

const REPLACEMENTS: [RegExp, string][] = [
  [/&/g, ' and '],
  [/\+/g, ' and '],
  [/\//g, ' or '],
  [/\s*-\s*/g, ' '],
  [/\s*_\s*/g, ' '],
  [/#/g, ' number '],
  [/%/g, ' percent '],
  [/\$/g, ''],
  [/,/g, ''],
  [/\./g, ''],
  [/'/g, ''],
  [/"/g, ''],
  [/\(/g, ' '],
  [/\)/g, ' '],
  [/\[/g, ' '],
  [/\]/g, ' '],
  [/:/g, ' '],
  [/;/g, ' '],
];

export interface NormalizationOptions {
  stripSuffixes?: boolean;
  stripPrefixes?: boolean;
  aggressive?: boolean;
}

export function normalizeLineItem(
  lineItem: string,
  options: NormalizationOptions = {}
): string {
  const {
    stripSuffixes = true,
    stripPrefixes = true,
    aggressive = false,
  } = options;

  if (!lineItem || typeof lineItem !== 'string') {
    return '';
  }

  let normalized = lineItem;
  normalized = normalized.toLowerCase();
  normalized = normalized.trim();

  for (const [pattern, replacement] of REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  if (stripSuffixes) {
    for (const suffix of STRIPPABLE_SUFFIXES) {
      if (normalized.endsWith(suffix)) {
        normalized = normalized.slice(0, -suffix.length).trim();
        break;
      }
    }
  }

  if (stripPrefixes) {
    for (const prefix of STRIPPABLE_PREFIXES) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length).trim();
        break;
      }
    }
  }

  if (aggressive) {
    const fillerWords = ['the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'at'];
    const words = normalized.split(' ');
    normalized = words.filter(w => !fillerWords.includes(w)).join(' ');
    normalized = normalized.replace(/\s+\d+$/, '');
  }

  normalized = normalized.trim();

  return normalized;
}

export function lineItemsMatch(
  lineItem1: string,
  lineItem2: string,
  options: NormalizationOptions = {}
): boolean {
  const norm1 = normalizeLineItem(lineItem1, options);
  const norm2 = normalizeLineItem(lineItem2, options);
  
  return norm1 === norm2 && norm1.length > 0;
}
