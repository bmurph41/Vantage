/**
 * PNL Alias Matcher Service
 * Uses the 525+ line item aliases to auto-categorize P&L items
 */

import { db } from '../db';
import { pnlLineItemAliases, pnlCanonicalLineItems } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface AliasMatch {
  coaCode: string;
  displayName: string;
  majorGroup: 'Revenue' | 'COGS' | 'OpEx' | 'Payroll' | 'Other';
  subcategoryGroup: string;
  confidence: number;
  matchType: 'exact' | 'normalized' | 'fuzzy';
}

function coaCodeToTier(coaCode: string): 'revenue' | 'cogs' | 'expense' {
  if (coaCode.startsWith('REV_')) return 'revenue';
  if (coaCode.startsWith('COGS_')) return 'cogs';
  return 'expense';
}

function subcategoryToDept(subcategory: string): string {
  const mapping: Record<string, string> = {
    'Storage': 'storage',
    'Fuel': 'fuel',
    'Marina & Amenities': 'marina_amenities',
    'Ship Store/Retail': 'ship_store_retail',
    'Service': 'service',
    'Parts': 'parts',
    'Third-Party Leases': 'third_party_leases',
    'Boat Club': 'boat_club',
    'Boat Rentals': 'boat_rentals',
    'Boat Sales': 'boat_sales',
    'Boat Brokerage': 'boat_brokerage',
    'Boat Finance': 'boat_finance',
    'F&B': 'fb',
    'RV Park': 'rv_park',
    'Hospitality/Lodging': 'hospitality_lodging',
    'Miscellaneous': 'miscellaneous',
    'Payroll': 'payroll',
    'General & Administrative': 'general_admin',
    'Advertising': 'advertising',
    'Repairs & Maintenance': 'repairs_maintenance',
    'Utilities': 'utilities',
    'Licenses & Permits': 'licenses_permits',
    'Security & Contract Services': 'security_contract_services',
    'Bank & CC Fees': 'bank_cc_fees',
    'Professional Services': 'professional_services',
    'Insurance': 'insurance',
    'Taxes': 'taxes',
    'Leases': 'leases',
  };
  return mapping[subcategory] || 'miscellaneous';
}

function normalizeLabel(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

let aliasCache: Map<string, { coaCode: string; confidence: number }> | null = null;
let canonicalCache: Map<string, { displayName: string; majorGroup: string; subcategoryGroup: string }> | null = null;

async function loadCaches() {
  if (aliasCache && canonicalCache) return;

  const aliases = await db.select().from(pnlLineItemAliases).where(eq(pnlLineItemAliases.isActive, true));
  aliasCache = new Map();
  for (const alias of aliases) {
    aliasCache.set(alias.normalizedLabel, { coaCode: alias.canonicalCoaCode, confidence: parseFloat(alias.confidence || '1.0') });
  }

  const canonicals = await db.select().from(pnlCanonicalLineItems).where(eq(pnlCanonicalLineItems.isActive, true));
  canonicalCache = new Map();
  for (const item of canonicals) {
    canonicalCache.set(item.coaCode, { displayName: item.displayName, majorGroup: item.majorGroup, subcategoryGroup: item.subcategoryGroup });
  }

  console.log(`[AliasMatcher] Loaded ${aliasCache.size} aliases and ${canonicalCache.size} canonical items`);
}

export async function findAliasMatch(rawText: string, sectionHint?: 'income' | 'cogs' | 'expense'): Promise<AliasMatch | null> {
  await loadCaches();
  if (!aliasCache || !canonicalCache) return null;

  const normalized = normalizeLabel(rawText);

  // Exact normalized match
  const exactMatch = aliasCache.get(normalized);
  if (exactMatch) {
    const canonical = canonicalCache.get(exactMatch.coaCode);
    if (canonical) {
      return {
        coaCode: exactMatch.coaCode,
        displayName: canonical.displayName,
        majorGroup: canonical.majorGroup as AliasMatch['majorGroup'],
        subcategoryGroup: canonical.subcategoryGroup,
        confidence: exactMatch.confidence,
        matchType: 'exact',
      };
    }
  }

  // Fuzzy match
  const words = normalized.split(' ').filter(w => w.length > 2);
  let bestMatch: { coaCode: string; confidence: number } | null = null;

  for (const [aliasLabel, aliasData] of aliasCache.entries()) {
    let matchCount = 0;
    for (const word of words) {
      if (aliasLabel.includes(word)) matchCount++;
    }
    if (matchCount > 0) {
      const score = matchCount / Math.max(words.length, aliasLabel.split(' ').length);
      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = { coaCode: aliasData.coaCode, confidence: score * 0.8 };
      }
    }
  }

  if (bestMatch && bestMatch.confidence > 0.4) {
    const canonical = canonicalCache.get(bestMatch.coaCode);
    if (canonical) {
      return {
        coaCode: bestMatch.coaCode,
        displayName: canonical.displayName,
        majorGroup: canonical.majorGroup as AliasMatch['majorGroup'],
        subcategoryGroup: canonical.subcategoryGroup,
        confidence: bestMatch.confidence,
        matchType: 'fuzzy',
      };
    }
  }

  // Section hint fallback
  if (sectionHint) {
    const fallbackCode = sectionHint === 'income' ? 'REV_MISCELLANEOUS' : sectionHint === 'cogs' ? 'COGS_MISCELLANEOUS' : 'OPEX_MISCELLANEOUS';
    const fallbackGroup = sectionHint === 'income' ? 'Revenue' : sectionHint === 'cogs' ? 'COGS' : 'OpEx';
    return {
      coaCode: fallbackCode,
      displayName: 'Miscellaneous',
      majorGroup: fallbackGroup as AliasMatch['majorGroup'],
      subcategoryGroup: 'Miscellaneous',
      confidence: 0.3,
      matchType: 'fuzzy',
    };
  }

  return null;
}

export function getMatchResult(match: AliasMatch): {
  categoryTier: 'revenue' | 'cogs' | 'expense';
  revenueCogsDept: string | null;
  expenseDept: string | null;
} {
  const tier = coaCodeToTier(match.coaCode);
  const dept = subcategoryToDept(match.subcategoryGroup);
  return {
    categoryTier: tier,
    revenueCogsDept: tier === 'revenue' || tier === 'cogs' ? dept : null,
    expenseDept: tier === 'expense' ? dept : null,
  };
}

export async function clearAliasCache() {
  aliasCache = null;
  canonicalCache = null;
}
