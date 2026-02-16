import { db } from '../db';
import { eq, and, desc, sql, asc, inArray } from 'drizzle-orm';
import { 
  chartOfAccounts, coaMapping, coaMappingSuggestions, mmStandardAccounts,
  coaAuditLog,
  type ChartOfAccount, type CoaMapping, type InsertCoaMapping,
  type CoaMappingSuggestion, type MmStandardAccount
} from '@shared/schema';

interface KeywordRule {
  keywords: string[];
  category: string;
  subCategory?: string;
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

const ACCOUNT_TYPE_TO_CATEGORY_GROUP: Record<string, string[]> = {
  'Income': ['Revenue'],
  'Revenue': ['Revenue'],
  'COGS': ['COGS'],
  'Cost of Goods Sold': ['COGS'],
  'Expense': ['OperatingExpense'],
  'Expenses': ['OperatingExpense'],
  'Other Expense': ['OperatingExpense'],
  'Other Income': ['Revenue'],
};

class CoaMappingService {
  async listMappings(orgId: string): Promise<any[]> {
    const results = await db
      .select({
        mapping: coaMapping,
        coaAccountName: chartOfAccounts.accountName,
        coaAccountNumber: chartOfAccounts.accountNumber,
        coaAccountType: chartOfAccounts.accountType,
        standardCategory: mmStandardAccounts.category,
        standardCategoryGroup: mmStandardAccounts.categoryGroup,
        standardSubCategory: mmStandardAccounts.subCategory,
      })
      .from(coaMapping)
      .innerJoin(chartOfAccounts, eq(coaMapping.coaAccountId, chartOfAccounts.id))
      .innerJoin(mmStandardAccounts, eq(coaMapping.mmStandardAccountId, mmStandardAccounts.id))
      .where(eq(coaMapping.orgId, orgId))
      .orderBy(asc(chartOfAccounts.accountName));

    return results.map((r) => ({
      ...r.mapping,
      coaAccountName: r.coaAccountName,
      coaAccountNumber: r.coaAccountNumber,
      coaAccountType: r.coaAccountType,
      standardCategory: r.standardCategory,
      standardCategoryGroup: r.standardCategoryGroup,
      standardSubCategory: r.standardSubCategory,
    }));
  }

  async upsertMapping(
    orgId: string,
    data: {
      coaAccountId: string;
      mmStandardAccountId: string;
      confidenceScore?: number;
      mappingSource?: string;
      notes?: string;
      locked?: boolean;
    }
  ): Promise<CoaMapping> {
    const existing = await db
      .select()
      .from(coaMapping)
      .where(
        and(
          eq(coaMapping.orgId, orgId),
          eq(coaMapping.coaAccountId, data.coaAccountId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(coaMapping)
        .set({
          mmStandardAccountId: data.mmStandardAccountId,
          confidenceScore: data.confidenceScore?.toString() ?? existing[0].confidenceScore,
          mappingSource: data.mappingSource ?? existing[0].mappingSource,
          notes: data.notes ?? existing[0].notes,
          locked: data.locked ?? existing[0].locked,
          updatedAt: new Date(),
        })
        .where(eq(coaMapping.id, existing[0].id))
        .returning();

      await this.logAudit(orgId, 'update_mapping', 'coa_mapping', updated.id, {
        coaAccountId: data.coaAccountId,
        mmStandardAccountId: data.mmStandardAccountId,
      });

      return updated;
    }

    const [created] = await db
      .insert(coaMapping)
      .values({
        orgId,
        coaAccountId: data.coaAccountId,
        mmStandardAccountId: data.mmStandardAccountId,
        confidenceScore: (data.confidenceScore ?? 100).toString(),
        mappingSource: data.mappingSource ?? 'manual',
        notes: data.notes ?? null,
        locked: data.locked ?? true,
      })
      .returning();

    await this.logAudit(orgId, 'create_mapping', 'coa_mapping', created.id, {
      coaAccountId: data.coaAccountId,
      mmStandardAccountId: data.mmStandardAccountId,
    });

    return created;
  }

  async bulkUpsertMappings(
    orgId: string,
    mappings: Array<{
      coaAccountId: string;
      mmStandardAccountId: string;
      mappingSource?: string;
    }>
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const m of mappings) {
      const existing = await db
        .select()
        .from(coaMapping)
        .where(
          and(
            eq(coaMapping.orgId, orgId),
            eq(coaMapping.coaAccountId, m.coaAccountId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(coaMapping)
          .set({
            mmStandardAccountId: m.mmStandardAccountId,
            mappingSource: m.mappingSource ?? 'bulk',
            updatedAt: new Date(),
          })
          .where(eq(coaMapping.id, existing[0].id));
        updated++;
      } else {
        await db.insert(coaMapping).values({
          orgId,
          coaAccountId: m.coaAccountId,
          mmStandardAccountId: m.mmStandardAccountId,
          mappingSource: m.mappingSource ?? 'bulk',
          confidenceScore: '100',
          locked: true,
        });
        created++;
      }
    }

    await this.logAudit(orgId, 'bulk_upsert_mapping', 'coa_mapping', undefined, {
      total: mappings.length,
      created,
      updated,
    });

    return { created, updated };
  }

  async deleteMapping(orgId: string, id: string): Promise<void> {
    await db
      .delete(coaMapping)
      .where(and(eq(coaMapping.id, id), eq(coaMapping.orgId, orgId)));

    await this.logAudit(orgId, 'delete_mapping', 'coa_mapping', id);
  }

  async getMappingProgress(
    orgId: string
  ): Promise<{
    total: number;
    mapped: number;
    unmapped: number;
    byType: Record<string, { total: number; mapped: number }>;
  }> {
    const allAccounts = await db
      .select()
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.orgId, orgId),
          eq(chartOfAccounts.isActive, true)
        )
      );

    const existingMappings = await db
      .select({ coaAccountId: coaMapping.coaAccountId })
      .from(coaMapping)
      .where(eq(coaMapping.orgId, orgId));

    const mappedIds = new Set(existingMappings.map((m) => m.coaAccountId));

    const byType: Record<string, { total: number; mapped: number }> = {};

    for (const acct of allAccounts) {
      const type = acct.accountType || 'Unknown';
      if (!byType[type]) {
        byType[type] = { total: 0, mapped: 0 };
      }
      byType[type].total++;
      if (mappedIds.has(acct.id)) {
        byType[type].mapped++;
      }
    }

    return {
      total: allAccounts.length,
      mapped: mappedIds.size,
      unmapped: allAccounts.length - mappedIds.size,
      byType,
    };
  }

  async generateSuggestions(
    orgId: string
  ): Promise<{ generated: number; suggestions: CoaMappingSuggestion[] }> {
    const allAccounts = await db
      .select()
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.orgId, orgId),
          eq(chartOfAccounts.isActive, true)
        )
      );

    const existingMappings = await db
      .select({ coaAccountId: coaMapping.coaAccountId })
      .from(coaMapping)
      .where(eq(coaMapping.orgId, orgId));

    const mappedIds = new Set(existingMappings.map((m) => m.coaAccountId));
    const unmappedAccounts = allAccounts.filter((a) => !mappedIds.has(a.id));

    const standardAccounts = await db
      .select()
      .from(mmStandardAccounts)
      .where(eq(mmStandardAccounts.isActive, true));

    await db
      .delete(coaMappingSuggestions)
      .where(
        and(
          eq(coaMappingSuggestions.orgId, orgId),
          eq(coaMappingSuggestions.status, 'pending')
        )
      );

    const suggestions: CoaMappingSuggestion[] = [];

    for (const account of unmappedAccounts) {
      const match = this.findBestMatch(account, standardAccounts);
      if (!match) continue;

      const [suggestion] = await db
        .insert(coaMappingSuggestions)
        .values({
          orgId,
          coaAccountId: account.id,
          suggestedMmStandardAccountId: match.standardAccountId,
          confidenceScore: match.confidence.toString(),
          rationale: match.rationale,
          status: 'pending',
        })
        .returning();

      suggestions.push(suggestion);
    }

    await this.logAudit(orgId, 'generate_suggestions', 'coa_mapping_suggestions', undefined, {
      unmappedCount: unmappedAccounts.length,
      generated: suggestions.length,
    });

    return { generated: suggestions.length, suggestions };
  }

  private findBestMatch(
    account: ChartOfAccount,
    standardAccounts: MmStandardAccount[]
  ): { standardAccountId: string; confidence: number; rationale: string } | null {
    const accountName = (account.accountName || '').toLowerCase();
    const accountType = (account.accountType || '').trim();
    const allowedGroups = ACCOUNT_TYPE_TO_CATEGORY_GROUP[accountType] || [];

    let bestMatch: { standardAccountId: string; confidence: number; rationale: string } | null = null;

    for (const rule of KEYWORD_RULES) {
      if (allowedGroups.length > 0 && !rule.categoryGroups.some((g) => allowedGroups.includes(g))) {
        continue;
      }

      for (const keyword of rule.keywords) {
        const keywordLower = keyword.toLowerCase();
        let confidence = 0;
        let matchType = '';

        if (accountName === keywordLower || accountName.includes(keywordLower)) {
          if (accountName === keywordLower) {
            confidence = 85;
            matchType = 'exact';
          } else {
            confidence = 85;
            matchType = 'keyword';
          }
        } else {
          const words = keywordLower.split(' ');
          if (words.length > 1) continue;
          const accountWords = accountName.split(/[\s\-_\/&,]+/);
          const partialMatch = accountWords.some(
            (w) => w.length > 2 && (w.startsWith(keywordLower.slice(0, 3)) || keywordLower.startsWith(w.slice(0, 3)))
          );
          if (partialMatch) {
            confidence = 65;
            matchType = 'partial';
          }
        }

        if (confidence > 0) {
          const matchingStd = standardAccounts.find(
            (s) =>
              s.category.toLowerCase() === rule.category.toLowerCase() &&
              rule.categoryGroups.includes(s.categoryGroup)
          );

          if (matchingStd && (!bestMatch || confidence > bestMatch.confidence)) {
            bestMatch = {
              standardAccountId: matchingStd.id,
              confidence,
              rationale: `Keyword '${keyword}' ${matchType === 'exact' ? 'exactly matched' : matchType === 'keyword' ? 'matched in' : 'partially matched in'} account name "${account.accountName}"`,
            };
          }
        }
      }
    }

    if (!bestMatch && allowedGroups.length > 0) {
      const typeMatch = standardAccounts.find((s) => allowedGroups.includes(s.categoryGroup));
      if (typeMatch) {
        bestMatch = {
          standardAccountId: typeMatch.id,
          confidence: 40,
          rationale: `Account type '${accountType}' matched to category group '${typeMatch.categoryGroup}'`,
        };
      }
    }

    return bestMatch;
  }

  async acceptSuggestion(orgId: string, suggestionId: string): Promise<CoaMapping> {
    const [suggestion] = await db
      .select()
      .from(coaMappingSuggestions)
      .where(
        and(
          eq(coaMappingSuggestions.id, suggestionId),
          eq(coaMappingSuggestions.orgId, orgId)
        )
      );

    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    const mapping = await this.upsertMapping(orgId, {
      coaAccountId: suggestion.coaAccountId,
      mmStandardAccountId: suggestion.suggestedMmStandardAccountId,
      confidenceScore: parseFloat(suggestion.confidenceScore || '0'),
      mappingSource: 'suggestion_accepted',
      locked: true,
    });

    await db
      .update(coaMappingSuggestions)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(coaMappingSuggestions.id, suggestionId));

    await this.logAudit(orgId, 'accept_suggestion', 'coa_mapping_suggestions', suggestionId, {
      mappingId: mapping.id,
    });

    return mapping;
  }

  async rejectSuggestion(orgId: string, suggestionId: string): Promise<void> {
    const [suggestion] = await db
      .select()
      .from(coaMappingSuggestions)
      .where(
        and(
          eq(coaMappingSuggestions.id, suggestionId),
          eq(coaMappingSuggestions.orgId, orgId)
        )
      );

    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    await db
      .update(coaMappingSuggestions)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(coaMappingSuggestions.id, suggestionId));

    await this.logAudit(orgId, 'reject_suggestion', 'coa_mapping_suggestions', suggestionId);
  }

  async listSuggestions(orgId: string, status?: string): Promise<any[]> {
    const conditions = [eq(coaMappingSuggestions.orgId, orgId)];
    if (status) {
      conditions.push(eq(coaMappingSuggestions.status, status));
    }

    const results = await db
      .select({
        suggestion: coaMappingSuggestions,
        coaAccountName: chartOfAccounts.accountName,
        coaAccountNumber: chartOfAccounts.accountNumber,
        coaAccountType: chartOfAccounts.accountType,
        standardCategory: mmStandardAccounts.category,
        standardCategoryGroup: mmStandardAccounts.categoryGroup,
        standardSubCategory: mmStandardAccounts.subCategory,
      })
      .from(coaMappingSuggestions)
      .innerJoin(chartOfAccounts, eq(coaMappingSuggestions.coaAccountId, chartOfAccounts.id))
      .innerJoin(mmStandardAccounts, eq(coaMappingSuggestions.suggestedMmStandardAccountId, mmStandardAccounts.id))
      .where(and(...conditions))
      .orderBy(desc(coaMappingSuggestions.confidenceScore));

    return results.map((r) => ({
      ...r.suggestion,
      coaAccountName: r.coaAccountName,
      coaAccountNumber: r.coaAccountNumber,
      coaAccountType: r.coaAccountType,
      standardCategory: r.standardCategory,
      standardCategoryGroup: r.standardCategoryGroup,
      standardSubCategory: r.standardSubCategory,
    }));
  }

  private async logAudit(
    orgId: string,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: any
  ): Promise<void> {
    try {
      await db.insert(coaAuditLog).values({
        orgId,
        userId: null,
        action,
        entityType,
        entityId: entityId || null,
        metadata: metadata || null,
      });
    } catch (err) {
      console.error('[CoaMappingService] Failed to write audit log:', err);
    }
  }
}

export const coaMappingService = new CoaMappingService();
