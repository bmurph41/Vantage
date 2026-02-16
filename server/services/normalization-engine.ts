import { db } from '../db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import {
  docIntelExtractedItems, docIntelUploads,
  chartOfAccounts, coaMapping, coaMappingSuggestions, mmStandardAccounts,
  financialLineItemsNormalized, coaAuditLog,
  type DocIntelExtractedItem, type FinancialLineItemNormalized
} from '@shared/schema';

type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
type MmStandardAccount = typeof mmStandardAccounts.$inferSelect;

interface NormalizationResult {
  totalLines: number;
  mappedViaCoa: number;
  mappedViaSuggestion: number;
  mappedViaFallback: number;
  unmapped: number;
  lines: FinancialLineItemNormalized[];
}

interface ClassifiedLine {
  mmStandardAccountId: string | null;
  coaAccountId: string | null;
  categoryGroup: string | null;
  profitCenterTag: string | null;
  confidenceScore: number;
  classificationSource: 'coa_mapping' | 'ai_suggested' | 'rules_fallback' | 'unmapped';
}

interface KeywordRule {
  keywords: string[];
  category: string;
  categoryGroups: string[];
  confidence: number;
}

const KEYWORD_RULES: KeywordRule[] = [
  { keywords: ['fuel', 'gas', 'diesel', 'petroleum'], category: 'Fuel Sales', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['fuel', 'gas', 'diesel', 'petroleum'], category: 'Fuel COGS', categoryGroups: ['COGS'], confidence: 85 },
  { keywords: ['dock', 'slip', 'wet slip', 'berth', 'mooring'], category: 'Wet Slips', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['dry storage', 'rack', 'indoor', 'outdoor storage'], category: 'Dry Storage', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['lift', 'hoist', 'forklift'], category: 'Lift Slips', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['service', 'mechanic', 'repair', 'maintenance yard'], category: 'Service Yard', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['service', 'mechanic', 'repair', 'maintenance yard'], category: 'Repairs & Maintenance', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['retail', 'merch', 'ship store', 'chandlery'], category: 'Retail / Ship Store', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['retail', 'merch', 'ship store', 'chandlery'], category: 'Retail COGS', categoryGroups: ['COGS'], confidence: 85 },
  { keywords: ['boat club', 'membership'], category: 'Boat Club', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['boat sale'], category: 'Boat Sales', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['brokerage'], category: 'Boat Brokerage', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['rental', 'charter'], category: 'Boat Rentals', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['restaurant', 'food', 'beverage', 'bar', 'grill'], category: 'Restaurant / Food & Beverage', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['tenant', 'lease', 'commercial'], category: 'Commercial Tenants', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['launch', 'ramp'], category: 'Launch / Ramp Fees', categoryGroups: ['Revenue'], confidence: 85 },
  { keywords: ['payroll', 'salary', 'wage', 'compensation', 'benefits'], category: 'Payroll', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['utility', 'electric', 'water', 'sewer', 'power'], category: 'Utilities', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['insurance'], category: 'Insurance', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['property tax'], category: 'Property Taxes', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['tax', 'license', 'permit'], category: 'Taxes & Licenses', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['marketing', 'advertising', 'promotion'], category: 'Marketing', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['office', 'admin', 'supplies'], category: 'Office & Admin', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['contract labor', 'contractor'], category: 'Contract Labor', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['dredge', 'marine service'], category: 'Dredging / Marine Services', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['security', 'guard'], category: 'Security', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['waste', 'trash', 'environmental'], category: 'Waste / Environmental', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['legal', 'accounting', 'professional', 'consulting'], category: 'Professional Fees', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['rent', 'lease'], category: 'Rent / Lease', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['software', 'technology', 'it'], category: 'Technology / Software', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['interest'], category: 'Interest Expense', categoryGroups: ['OperatingExpense'], confidence: 85 },
  { keywords: ['depreciation', 'amortization'], category: 'Depreciation & Amortization', categoryGroups: ['OperatingExpense'], confidence: 85 },
];

const CATEGORY_TIER_TO_GROUPS: Record<string, string[]> = {
  'revenue': ['Revenue'],
  'cogs': ['COGS'],
  'expense': ['OperatingExpense'],
};

const MONTH_NAMES: Record<string, number> = {
  'jan': 1, 'january': 1,
  'feb': 2, 'february': 2,
  'mar': 3, 'march': 3,
  'apr': 4, 'april': 4,
  'may': 5,
  'jun': 6, 'june': 6,
  'jul': 7, 'july': 7,
  'aug': 8, 'august': 8,
  'sep': 9, 'sept': 9, 'september': 9,
  'oct': 10, 'october': 10,
  'nov': 11, 'november': 11,
  'dec': 12, 'december': 12,
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parsePeriodKey(periodKey: string | null, fallbackYear?: number | null): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const defaultYear = fallbackYear || now.getFullYear();

  if (!periodKey || !periodKey.trim()) {
    return {
      periodStart: `${defaultYear}-01-01`,
      periodEnd: `${defaultYear}-12-31`,
    };
  }

  const trimmed = periodKey.trim();

  const monthYearMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const monthName = monthYearMatch[1].toLowerCase();
    const year = parseInt(monthYearMatch[2], 10);
    const month = MONTH_NAMES[monthName];
    if (month) {
      const mm = String(month).padStart(2, '0');
      const lastDay = daysInMonth(year, month);
      return {
        periodStart: `${year}-${mm}-01`,
        periodEnd: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      };
    }
  }

  const quarterMatch = trimmed.match(/^Q(\d)\s+(\d{4})$/i);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1], 10);
    const year = parseInt(quarterMatch[2], 10);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = daysInMonth(year, endMonth);
    return {
      periodStart: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      periodEnd: `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  const fyMatch = trimmed.match(/^(?:FY\s*)?(\d{4})$/i);
  if (fyMatch) {
    const year = parseInt(fyMatch[1], 10);
    return {
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
    };
  }

  return {
    periodStart: `${defaultYear}-01-01`,
    periodEnd: `${defaultYear}-12-31`,
  };
}

class NormalizationEngine {
  async run(orgId: string, options: {
    projectId?: string;
    sourceDocId?: string;
    userId?: string;
    autoApplySuggestions?: boolean;
    confidenceThreshold?: number;
  }): Promise<NormalizationResult> {
    const autoApplySuggestions = options.autoApplySuggestions ?? false;
    const confidenceThreshold = options.confidenceThreshold ?? 75;

    const uploadIds: string[] = [];
    const uploadMap = new Map<string, typeof docIntelUploads.$inferSelect>();

    if (options.sourceDocId) {
      const [upload] = await db
        .select()
        .from(docIntelUploads)
        .where(and(eq(docIntelUploads.id, options.sourceDocId), eq(docIntelUploads.orgId, orgId)));
      if (upload) {
        uploadIds.push(upload.id);
        uploadMap.set(upload.id, upload);
      }
    } else if (options.projectId) {
      const uploads = await db
        .select()
        .from(docIntelUploads)
        .where(and(eq(docIntelUploads.orgId, orgId), eq(docIntelUploads.modelingProjectId, options.projectId)));
      for (const u of uploads) {
        uploadIds.push(u.id);
        uploadMap.set(u.id, u);
      }
    }

    if (uploadIds.length === 0) {
      return { totalLines: 0, mappedViaCoa: 0, mappedViaSuggestion: 0, mappedViaFallback: 0, unmapped: 0, lines: [] };
    }

    const extractedItems = await db
      .select()
      .from(docIntelExtractedItems)
      .where(and(
        eq(docIntelExtractedItems.orgId, orgId),
        inArray(docIntelExtractedItems.uploadId, uploadIds)
      ));

    if (extractedItems.length === 0) {
      return { totalLines: 0, mappedViaCoa: 0, mappedViaSuggestion: 0, mappedViaFallback: 0, unmapped: 0, lines: [] };
    }

    const coaAccounts = await db
      .select()
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.orgId, orgId), eq(chartOfAccounts.isActive, true)));

    const coaAccountIds = coaAccounts.map(a => a.id);

    const mappingsRaw = coaAccountIds.length > 0
      ? await db
          .select()
          .from(coaMapping)
          .where(and(eq(coaMapping.orgId, orgId), eq(coaMapping.locked, true)))
      : [];

    const mappings = new Map<string, { mmStandardAccountId: string; confidenceScore: number }>();
    for (const m of mappingsRaw) {
      mappings.set(m.coaAccountId, {
        mmStandardAccountId: m.mmStandardAccountId,
        confidenceScore: parseFloat(m.confidenceScore || '0'),
      });
    }

    const suggestionsRaw = coaAccountIds.length > 0
      ? await db
          .select()
          .from(coaMappingSuggestions)
          .where(and(eq(coaMappingSuggestions.orgId, orgId), eq(coaMappingSuggestions.status, 'pending')))
      : [];

    const suggestions = new Map<string, { mmStandardAccountId: string; confidenceScore: number }>();
    for (const s of suggestionsRaw) {
      suggestions.set(s.coaAccountId, {
        mmStandardAccountId: s.suggestedMmStandardAccountId,
        confidenceScore: parseFloat(s.confidenceScore || '0'),
      });
    }

    const stdAccountsRaw = await db
      .select()
      .from(mmStandardAccounts)
      .where(eq(mmStandardAccounts.isActive, true));

    const standardAccounts = new Map<string, MmStandardAccount>();
    for (const sa of stdAccountsRaw) {
      standardAccounts.set(sa.id, sa);
    }

    const result: NormalizationResult = {
      totalLines: extractedItems.length,
      mappedViaCoa: 0,
      mappedViaSuggestion: 0,
      mappedViaFallback: 0,
      unmapped: 0,
      lines: [],
    };

    const dedupSourceDocIds = new Set<string>();
    for (const item of extractedItems) {
      dedupSourceDocIds.add(item.uploadId);
    }
    for (const srcDocId of dedupSourceDocIds) {
      await db
        .delete(financialLineItemsNormalized)
        .where(and(
          eq(financialLineItemsNormalized.orgId, orgId),
          eq(financialLineItemsNormalized.sourceDocId, srcDocId)
        ));
    }

    for (const item of extractedItems) {
      const classified = await this.classifyLine(
        item, coaAccounts, mappings, suggestions, standardAccounts,
        autoApplySuggestions, confidenceThreshold
      );

      const upload = uploadMap.get(item.uploadId);
      const { periodStart, periodEnd } = parsePeriodKey(item.periodKey, upload?.year);

      const stdAccount = classified.mmStandardAccountId
        ? standardAccounts.get(classified.mmStandardAccountId)
        : null;

      const [inserted] = await db
        .insert(financialLineItemsNormalized)
        .values({
          orgId,
          projectId: options.projectId || upload?.modelingProjectId || null,
          sourceDocId: item.uploadId,
          periodStart,
          periodEnd,
          currency: 'USD',
          coaAccountId: classified.coaAccountId,
          rawCategoryName: item.rawText,
          rawLineName: item.rawText,
          amount: item.amount || '0',
          mmStandardAccountId: classified.mmStandardAccountId,
          categoryGroup: classified.categoryGroup || stdAccount?.categoryGroup || null,
          profitCenterTag: classified.profitCenterTag || null,
          confidenceScore: classified.confidenceScore.toString(),
          classificationSource: classified.classificationSource,
        })
        .returning();

      result.lines.push(inserted);

      switch (classified.classificationSource) {
        case 'coa_mapping':
          result.mappedViaCoa++;
          break;
        case 'ai_suggested':
          result.mappedViaSuggestion++;
          break;
        case 'rules_fallback':
          result.mappedViaFallback++;
          break;
        case 'unmapped':
          result.unmapped++;
          break;
      }
    }

    try {
      await db.insert(coaAuditLog).values({
        orgId,
        userId: options.userId || null,
        action: 'generated_normalized_lines',
        entityType: 'financial_line_items_normalized',
        entityId: options.sourceDocId || options.projectId || null,
        metadata: {
          totalLines: result.totalLines,
          mappedViaCoa: result.mappedViaCoa,
          mappedViaSuggestion: result.mappedViaSuggestion,
          mappedViaFallback: result.mappedViaFallback,
          unmapped: result.unmapped,
          sourceDocId: options.sourceDocId,
          projectId: options.projectId,
        },
      });
    } catch (err) {
      console.error('[NormalizationEngine] Failed to write audit log:', err);
    }

    return result;
  }

  private async classifyLine(
    line: DocIntelExtractedItem,
    coaAccounts: ChartOfAccount[],
    mappings: Map<string, { mmStandardAccountId: string; confidenceScore: number }>,
    suggestions: Map<string, { mmStandardAccountId: string; confidenceScore: number }>,
    standardAccounts: Map<string, MmStandardAccount>,
    autoApplySuggestions: boolean,
    confidenceThreshold: number
  ): Promise<ClassifiedLine> {
    const matchedCoa = this.matchToCoa(line.rawText, coaAccounts);

    if (matchedCoa) {
      const mapping = mappings.get(matchedCoa.id);
      if (mapping) {
        const stdAcct = standardAccounts.get(mapping.mmStandardAccountId);
        return {
          mmStandardAccountId: mapping.mmStandardAccountId,
          coaAccountId: matchedCoa.id,
          categoryGroup: stdAcct?.categoryGroup || null,
          profitCenterTag: stdAcct?.subCategory || null,
          confidenceScore: mapping.confidenceScore,
          classificationSource: 'coa_mapping',
        };
      }

      if (autoApplySuggestions) {
        const suggestion = suggestions.get(matchedCoa.id);
        if (suggestion && suggestion.confidenceScore >= confidenceThreshold) {
          const stdAcct = standardAccounts.get(suggestion.mmStandardAccountId);
          return {
            mmStandardAccountId: suggestion.mmStandardAccountId,
            coaAccountId: matchedCoa.id,
            categoryGroup: stdAcct?.categoryGroup || null,
            profitCenterTag: stdAcct?.subCategory || null,
            confidenceScore: suggestion.confidenceScore,
            classificationSource: 'ai_suggested',
          };
        }
      }
    }

    const categoryTier = (line.categoryTierConfirmed || line.categoryTierSuggested) as string | undefined;
    const ruleResult = this.classifyByRules(line.rawText, categoryTier, standardAccounts);
    if (ruleResult.mmStandardAccountId) {
      const stdAcct = standardAccounts.get(ruleResult.mmStandardAccountId);
      return {
        mmStandardAccountId: ruleResult.mmStandardAccountId,
        coaAccountId: matchedCoa?.id || null,
        categoryGroup: stdAcct?.categoryGroup || null,
        profitCenterTag: stdAcct?.subCategory || null,
        confidenceScore: ruleResult.confidence,
        classificationSource: 'rules_fallback',
      };
    }

    return {
      mmStandardAccountId: null,
      coaAccountId: matchedCoa?.id || null,
      categoryGroup: null,
      profitCenterTag: null,
      confidenceScore: 0,
      classificationSource: 'unmapped',
    };
  }

  private classifyByRules(
    rawText: string,
    categoryTier?: string,
    standardAccountsMap?: Map<string, MmStandardAccount>
  ): { mmStandardAccountId: string | null; confidence: number; rationale: string } {
    const normalized = normalizeText(rawText);
    const allowedGroups = categoryTier ? (CATEGORY_TIER_TO_GROUPS[categoryTier] || []) : [];

    let bestMatch: { rule: KeywordRule; keyword: string; confidence: number } | null = null;

    for (const rule of KEYWORD_RULES) {
      if (allowedGroups.length > 0 && !rule.categoryGroups.some(g => allowedGroups.includes(g))) {
        continue;
      }

      for (const keyword of rule.keywords) {
        const keywordNorm = normalizeText(keyword);
        let confidence = 0;

        if (normalized === keywordNorm) {
          confidence = 85;
        } else if (normalized.includes(keywordNorm)) {
          confidence = 85;
        } else {
          const words = keywordNorm.split(' ');
          if (words.length === 1) {
            const normWords = normalized.split(/\s+/);
            const partialMatch = normWords.some(
              w => w.length > 2 && (w.startsWith(keywordNorm.slice(0, 3)) || keywordNorm.startsWith(w.slice(0, 3)))
            );
            if (partialMatch) {
              confidence = 65;
            }
          }
        }

        if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = { rule, keyword, confidence };
        }
      }
    }

    if (!bestMatch || !standardAccountsMap) {
      return { mmStandardAccountId: null, confidence: 0, rationale: 'No keyword match found' };
    }

    let matchedStdAccount: MmStandardAccount | undefined;
    for (const [, sa] of standardAccountsMap) {
      if (
        sa.category.toLowerCase() === bestMatch.rule.category.toLowerCase() &&
        bestMatch.rule.categoryGroups.includes(sa.categoryGroup)
      ) {
        matchedStdAccount = sa;
        break;
      }
    }

    if (!matchedStdAccount) {
      return { mmStandardAccountId: null, confidence: 0, rationale: `Keyword '${bestMatch.keyword}' matched but no standard account found for category '${bestMatch.rule.category}'` };
    }

    return {
      mmStandardAccountId: matchedStdAccount.id,
      confidence: bestMatch.confidence,
      rationale: `Keyword '${bestMatch.keyword}' matched in raw text "${rawText}" → ${bestMatch.rule.category}`,
    };
  }

  private matchToCoa(rawText: string, coaAccounts: ChartOfAccount[]): ChartOfAccount | null {
    const normalizedRaw = normalizeText(rawText);
    if (!normalizedRaw) return null;

    let bestMatch: ChartOfAccount | null = null;
    let bestScore = 0;

    for (const account of coaAccounts) {
      const normalizedAcct = normalizeText(account.accountName);
      if (!normalizedAcct) continue;

      if (normalizedRaw === normalizedAcct) {
        return account;
      }

      if (normalizedAcct.includes(normalizedRaw) || normalizedRaw.includes(normalizedAcct)) {
        const score = Math.min(normalizedRaw.length, normalizedAcct.length) / Math.max(normalizedRaw.length, normalizedAcct.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = account;
        }
      }

      if (!bestMatch) {
        if (normalizedAcct.startsWith(normalizedRaw) || normalizedRaw.startsWith(normalizedAcct)) {
          const score = (Math.min(normalizedRaw.length, normalizedAcct.length) / Math.max(normalizedRaw.length, normalizedAcct.length)) * 0.8;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = account;
          }
        }
      }
    }

    return bestScore > 0.3 ? bestMatch : null;
  }
}

export const normalizationEngine = new NormalizationEngine();
