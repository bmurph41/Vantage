/**
 * Format Helpers for Token Substitution Engine
 *
 * Provides format-aware rendering of token values (currency, percent, number, date, text)
 * and template string interpolation with {{TOKEN}} placeholders.
 *
 * Used by: Document Studio render endpoints, Workflow email templates, AI content generation.
 */

import { MASTER_TOKEN_MAP } from './templates';
import type { TokenDefinition } from './templates';

/**
 * Format a raw token value for display based on its format type.
 * Uses Intl.NumberFormat for locale-aware formatting.
 */
export function formatTokenValue(
  raw: string | number | null | undefined,
  format: 'currency' | 'percent' | 'number' | 'date' | 'text' | undefined
): string {
  if (raw === null || raw === undefined) return '';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(Number(raw));

    case 'percent': {
      // Values may be stored as decimals (0.184) or whole numbers (18.4)
      const num = Number(raw);
      if (isNaN(num)) return String(raw);
      const pct = num > 1 ? num : num * 100;
      return `${pct.toFixed(1)}%`;
    }

    case 'number':
      return new Intl.NumberFormat('en-US').format(Number(raw));

    case 'date':
      try {
        return new Date(String(raw)).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        return String(raw);
      }

    case 'text':
    default:
      return String(raw);
  }
}

/** Map of token name -> TokenDefinition for fast lookup */
const tokenDefMap = new Map<string, TokenDefinition>();
for (const def of MASTER_TOKEN_MAP) {
  tokenDefMap.set(def.token, def);
}

/**
 * Get a token definition by name (O(1) lookup).
 */
export function getTokenDef(tokenName: string): TokenDefinition | undefined {
  return tokenDefMap.get(tokenName);
}

export interface ResolvedTokenEntry {
  raw: string | number | null;
  formatted: string;
  source: string;
  isManual: boolean;
  isResolved: boolean;
  format: string;
  label: string;
}

/**
 * Build a structured token map with raw + formatted values and metadata.
 */
export function buildFormattedTokenMap(
  resolved: Record<string, any>,
  overrides?: Record<string, string | number>,
  tokenFilter?: string[],
  documentType?: 'ic_deck' | 'om'
): Record<string, ResolvedTokenEntry> {
  const result: Record<string, ResolvedTokenEntry> = {};

  // Determine which tokens to process
  let tokensToProcess = MASTER_TOKEN_MAP;
  if (documentType) {
    tokensToProcess = tokensToProcess.filter(t => t.usedIn.includes(documentType));
  }
  if (tokenFilter && tokenFilter.length > 0) {
    const filterSet = new Set(tokenFilter);
    tokensToProcess = tokensToProcess.filter(t => filterSet.has(t.token));
  }

  for (const def of tokensToProcess) {
    // Apply override if present
    const hasOverride = overrides && def.token in overrides;
    const raw = hasOverride ? overrides[def.token] : (resolved[def.token] ?? null);
    const isResolved = raw !== null && raw !== undefined;

    result[def.token] = {
      raw: isResolved ? raw : null,
      formatted: isResolved ? formatTokenValue(raw, def.format) : '',
      source: def.source,
      isManual: def.source === 'manual',
      isResolved,
      format: def.format || 'text',
      label: def.label,
    };
  }

  return result;
}

/**
 * Replace all {{TOKEN}} placeholders in a template string with formatted values.
 * Unresolved tokens remain as {{TOKEN_NAME}} in the output.
 *
 * If format is 'html', wraps resolved values in styled spans.
 */
export function renderTemplate(
  template: string,
  formattedTokens: Record<string, ResolvedTokenEntry>,
  format: 'html' | 'text' = 'text'
): { rendered: string; unresolvedTokens: string[]; tokenCount: number; resolvedCount: number } {
  const unresolvedTokens: string[] = [];
  let tokenCount = 0;
  let resolvedCount = 0;

  const rendered = template.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, tokenName) => {
    tokenCount++;
    const entry = formattedTokens[tokenName];

    if (!entry || !entry.isResolved) {
      unresolvedTokens.push(tokenName);
      return match; // leave placeholder in place
    }

    resolvedCount++;

    if (format === 'html') {
      const cssClass = `token-value token-${entry.format}`;
      return `<span class="${cssClass}" data-token="${tokenName}">${entry.formatted}</span>`;
    }

    return entry.formatted;
  });

  return { rendered, unresolvedTokens, tokenCount, resolvedCount };
}
