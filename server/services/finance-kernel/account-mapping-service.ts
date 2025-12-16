import { db } from '../../db';
import { 
  fkAccounts, 
  fkAccountAliases, 
  fkAuditLog,
  type FkAccount,
  type FkAccountAlias,
  type InsertFkAccount,
  type InsertFkAccountAlias
} from '@shared/finance-kernel-schema';
import { eq, and, ilike, sql } from 'drizzle-orm';

export interface AccountMappingSuggestion {
  sourceAccountId: string;
  sourceAccountName: string;
  suggestedTargetId: string | null;
  suggestedTargetName: string | null;
  confidence: number;
  reason: string;
}

export interface MappingStats {
  totalSourceAccounts: number;
  mappedCount: number;
  unmappedCount: number;
  averageConfidence: number;
}

export class AccountMappingService {
  async getCanonicalAccounts(orgId: string): Promise<FkAccount[]> {
    return db.select()
      .from(fkAccounts)
      .where(and(
        eq(fkAccounts.orgId, orgId),
        eq(fkAccounts.isActive, true)
      ))
      .orderBy(fkAccounts.accountType, fkAccounts.name);
  }

  async createCanonicalAccount(account: InsertFkAccount): Promise<FkAccount> {
    const [created] = await db.insert(fkAccounts)
      .values(account)
      .returning();
    return created;
  }

  async updateCanonicalAccount(orgId: string, accountId: string, updates: Partial<InsertFkAccount>): Promise<FkAccount> {
    const [updated] = await db.update(fkAccounts)
      .set(updates)
      .where(and(
        eq(fkAccounts.id, accountId),
        eq(fkAccounts.orgId, orgId)
      ))
      .returning();
    return updated;
  }

  async getAccountAliases(orgId: string, sourceSystem?: string): Promise<FkAccountAlias[]> {
    const conditions = [eq(fkAccountAliases.orgId, orgId)];
    if (sourceSystem) {
      conditions.push(eq(fkAccountAliases.sourceSystem, sourceSystem as any));
    }
    
    return db.select()
      .from(fkAccountAliases)
      .where(and(...conditions))
      .orderBy(fkAccountAliases.sourceAccountName);
  }

  async getAccountAliasesWithTargets(orgId: string, sourceSystem?: string): Promise<(FkAccountAlias & { targetAccount: FkAccount | null })[]> {
    const aliases = await this.getAccountAliases(orgId, sourceSystem);
    const accounts = await this.getCanonicalAccounts(orgId);
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    return aliases.map(alias => ({
      ...alias,
      targetAccount: accountMap.get(alias.targetAccountId) || null,
    }));
  }

  async createAccountAlias(alias: InsertFkAccountAlias, userId?: string): Promise<FkAccountAlias> {
    const [created] = await db.insert(fkAccountAliases)
      .values({ ...alias, createdBy: userId })
      .returning();

    await db.insert(fkAuditLog).values({
      orgId: alias.orgId,
      actorUserId: userId,
      action: 'create_alias',
      resourceType: 'account_alias',
      resourceId: created.id,
      afterJson: created,
    });

    return created;
  }

  async updateAccountAlias(
    orgId: string, 
    aliasId: string, 
    updates: { targetAccountId?: string; confidence?: string }, 
    userId?: string
  ): Promise<FkAccountAlias> {
    const [existing] = await db.select()
      .from(fkAccountAliases)
      .where(and(
        eq(fkAccountAliases.id, aliasId),
        eq(fkAccountAliases.orgId, orgId)
      ))
      .limit(1);

    const [updated] = await db.update(fkAccountAliases)
      .set(updates)
      .where(and(
        eq(fkAccountAliases.id, aliasId),
        eq(fkAccountAliases.orgId, orgId)
      ))
      .returning();

    await db.insert(fkAuditLog).values({
      orgId,
      actorUserId: userId,
      action: 'update_alias',
      resourceType: 'account_alias',
      resourceId: aliasId,
      beforeJson: existing,
      afterJson: updated,
    });

    return updated;
  }

  async deleteAccountAlias(orgId: string, aliasId: string, userId?: string): Promise<void> {
    const [existing] = await db.select()
      .from(fkAccountAliases)
      .where(and(
        eq(fkAccountAliases.id, aliasId),
        eq(fkAccountAliases.orgId, orgId)
      ))
      .limit(1);

    await db.delete(fkAccountAliases)
      .where(and(
        eq(fkAccountAliases.id, aliasId),
        eq(fkAccountAliases.orgId, orgId)
      ));

    await db.insert(fkAuditLog).values({
      orgId,
      actorUserId: userId,
      action: 'delete_alias',
      resourceType: 'account_alias',
      resourceId: aliasId,
      beforeJson: existing,
    });
  }

  async suggestMappings(
    orgId: string, 
    sourceAccounts: { id: string; name: string; type: string }[]
  ): Promise<AccountMappingSuggestion[]> {
    const canonicalAccounts = await this.getCanonicalAccounts(orgId);
    const existingAliases = await this.getAccountAliases(orgId, 'qbo');
    const aliasMap = new Map(existingAliases.map(a => [a.sourceAccountId, a]));

    const suggestions: AccountMappingSuggestion[] = [];

    for (const source of sourceAccounts) {
      const existing = aliasMap.get(source.id);
      if (existing) {
        const target = canonicalAccounts.find(a => a.id === existing.targetAccountId);
        suggestions.push({
          sourceAccountId: source.id,
          sourceAccountName: source.name,
          suggestedTargetId: existing.targetAccountId,
          suggestedTargetName: target?.name || null,
          confidence: parseFloat(existing.confidence?.toString() || '0'),
          reason: 'Existing mapping',
        });
        continue;
      }

      let bestMatch: { account: FkAccount; score: number; reason: string } | null = null;

      for (const canonical of canonicalAccounts) {
        if (canonical.name.toLowerCase() === source.name.toLowerCase()) {
          bestMatch = { account: canonical, score: 1.0, reason: 'Exact name match' };
          break;
        }

        const similarity = this.calculateJaccardSimilarity(
          source.name.toLowerCase(), 
          canonical.name.toLowerCase()
        );

        if (similarity > 0.6 && (!bestMatch || similarity > bestMatch.score)) {
          bestMatch = { account: canonical, score: similarity, reason: 'Similar name' };
        }

        if (this.typeMatches(source.type, canonical.accountType)) {
          const typeBonus = 0.1;
          if (bestMatch && bestMatch.account.id === canonical.id) {
            bestMatch.score += typeBonus;
          }
        }
      }

      suggestions.push({
        sourceAccountId: source.id,
        sourceAccountName: source.name,
        suggestedTargetId: bestMatch?.account.id || null,
        suggestedTargetName: bestMatch?.account.name || null,
        confidence: bestMatch?.score || 0,
        reason: bestMatch?.reason || 'No match found',
      });
    }

    return suggestions;
  }

  async getMappingStats(orgId: string, sourceSystem: string): Promise<MappingStats> {
    const aliases = await this.getAccountAliases(orgId, sourceSystem);
    
    const totalSourceAccounts = aliases.length;
    const mappedCount = aliases.filter(a => a.targetAccountId).length;
    const unmappedCount = totalSourceAccounts - mappedCount;
    
    const confidences = aliases
      .map(a => parseFloat(a.confidence?.toString() || '0'))
      .filter(c => c > 0);
    
    const averageConfidence = confidences.length > 0 
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
      : 0;

    return {
      totalSourceAccounts,
      mappedCount,
      unmappedCount,
      averageConfidence,
    };
  }

  async seedDefaultAccounts(orgId: string, userId?: string): Promise<number> {
    const defaultAccounts: InsertFkAccount[] = [
      { orgId, code: '4000', name: 'Wet Slip Revenue', accountType: 'income', normalBalance: 'credit' },
      { orgId, code: '4010', name: 'Dry Storage Revenue', accountType: 'income', normalBalance: 'credit' },
      { orgId, code: '4020', name: 'Fuel Sales', accountType: 'income', normalBalance: 'credit' },
      { orgId, code: '4030', name: 'Ship Store Revenue', accountType: 'income', normalBalance: 'credit' },
      { orgId, code: '4040', name: 'Service & Repair Revenue', accountType: 'income', normalBalance: 'credit' },
      { orgId, code: '4050', name: 'Boat Club Revenue', accountType: 'income', normalBalance: 'credit' },
      { orgId, code: '4060', name: 'Boat Rental Revenue', accountType: 'income', normalBalance: 'credit' },
      { orgId, code: '4099', name: 'Other Revenue', accountType: 'income', normalBalance: 'credit' },
      { orgId, code: '5000', name: 'Fuel Cost of Goods Sold', accountType: 'cogs', normalBalance: 'debit' },
      { orgId, code: '5010', name: 'Ship Store COGS', accountType: 'cogs', normalBalance: 'debit' },
      { orgId, code: '5020', name: 'Service Parts COGS', accountType: 'cogs', normalBalance: 'debit' },
      { orgId, code: '6000', name: 'Payroll & Benefits', accountType: 'expense', normalBalance: 'debit' },
      { orgId, code: '6010', name: 'Utilities', accountType: 'expense', normalBalance: 'debit' },
      { orgId, code: '6020', name: 'Insurance', accountType: 'expense', normalBalance: 'debit' },
      { orgId, code: '6030', name: 'Repairs & Maintenance', accountType: 'expense', normalBalance: 'debit' },
      { orgId, code: '6040', name: 'Property Taxes', accountType: 'expense', normalBalance: 'debit' },
      { orgId, code: '6050', name: 'Marketing & Advertising', accountType: 'expense', normalBalance: 'debit' },
      { orgId, code: '6060', name: 'Professional Fees', accountType: 'expense', normalBalance: 'debit' },
      { orgId, code: '6070', name: 'Management Fees', accountType: 'expense', normalBalance: 'debit' },
      { orgId, code: '6080', name: 'Office & Administrative', accountType: 'expense', normalBalance: 'debit' },
      { orgId, code: '6099', name: 'Other Operating Expenses', accountType: 'expense', normalBalance: 'debit' },
    ];

    let inserted = 0;
    for (const account of defaultAccounts) {
      try {
        await db.insert(fkAccounts).values(account).onConflictDoNothing();
        inserted++;
      } catch {
      }
    }

    await db.insert(fkAuditLog).values({
      orgId,
      actorUserId: userId,
      action: 'seed_accounts',
      resourceType: 'fk_accounts',
      afterJson: { count: inserted },
    });

    return inserted;
  }

  private calculateJaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(/\s+/).filter(w => w.length > 2));
    const setB = new Set(b.split(/\s+/).filter(w => w.length > 2));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private typeMatches(qbType: string, fkType: string): boolean {
    const mapping: Record<string, string[]> = {
      'Income': ['income', 'other_income'],
      'COGS': ['cogs'],
      'Expense': ['expense', 'other_expense'],
      'Other': ['other_income', 'other_expense'],
    };
    return mapping[qbType]?.includes(fkType) || false;
  }
}

export const accountMappingService = new AccountMappingService();
