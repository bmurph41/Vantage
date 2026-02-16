import { db } from '../db';
import {
  chartOfAccounts,
  coaAuditLog,
  type ChartOfAccount,
  type InsertChartOfAccount,
  type CoaAuditLog,
} from '@shared/schema';
import { eq, and, desc, sql, asc, isNull } from 'drizzle-orm';

const HEADER_MAP: Record<string, string> = {
  account_name: 'accountName',
  name: 'accountName',
  account: 'accountName',
  accountname: 'accountName',
  account_number: 'accountNumber',
  number: 'accountNumber',
  acct_no: 'accountNumber',
  accountnumber: 'accountNumber',
  acctno: 'accountNumber',
  type: 'accountType',
  account_type: 'accountType',
  accounttype: 'accountType',
  detail_type: 'detailType',
  detailtype: 'detailType',
  parent: 'parentExternalId',
  parent_account: 'parentExternalId',
  parentaccount: 'parentExternalId',
  parentexternalid: 'parentExternalId',
};

function normalizeHeaderKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
}

class CoaService {
  async listAccounts(orgId: string, asTree?: boolean): Promise<any[]> {
    const accounts = await db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.orgId, orgId))
      .orderBy(asc(chartOfAccounts.accountName));

    if (!asTree) return accounts;

    return this.buildTree(accounts);
  }

  async getAccount(orgId: string, id: string): Promise<ChartOfAccount | null> {
    const [account] = await db
      .select()
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.orgId, orgId)));
    return account || null;
  }

  async createAccount(orgId: string, data: InsertChartOfAccount): Promise<ChartOfAccount> {
    const [account] = await db
      .insert(chartOfAccounts)
      .values({ ...data, orgId })
      .returning();

    await this.logAudit(orgId, null, 'create', 'chart_of_accounts', account.id, {
      accountName: account.accountName,
    });

    return account;
  }

  async updateAccount(orgId: string, id: string, data: Partial<InsertChartOfAccount>): Promise<ChartOfAccount> {
    const [account] = await db
      .update(chartOfAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.orgId, orgId)))
      .returning();

    if (!account) {
      throw new Error(`Account ${id} not found for org ${orgId}`);
    }

    await this.logAudit(orgId, null, 'update', 'chart_of_accounts', id, {
      updatedFields: Object.keys(data),
    });

    return account;
  }

  async deleteAccount(orgId: string, id: string): Promise<void> {
    await db
      .update(chartOfAccounts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(chartOfAccounts.id, id), eq(chartOfAccounts.orgId, orgId)));

    await this.logAudit(orgId, null, 'soft_delete', 'chart_of_accounts', id);
  }

  async importFromCsv(
    orgId: string,
    rows: Record<string, string>[],
    userId?: string
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    if (!rows.length) {
      return { imported, skipped, errors: ['No rows provided'] };
    }

    const rawHeaders = Object.keys(rows[0]);
    const headerMapping: Record<string, string> = {};
    for (const raw of rawHeaders) {
      const normalized = normalizeHeaderKey(raw);
      const mapped = HEADER_MAP[normalized];
      if (mapped) {
        headerMapping[raw] = mapped;
      }
    }

    if (!Object.values(headerMapping).includes('accountName')) {
      errors.push('Could not find an account name column. Expected: account_name, name, or account');
      return { imported, skipped, errors };
    }

    if (!Object.values(headerMapping).includes('accountType')) {
      errors.push('Could not find an account type column. Expected: type or account_type');
      return { imported, skipped, errors };
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const mapped: Record<string, string> = {};
      for (const [rawKey, mappedKey] of Object.entries(headerMapping)) {
        const val = row[rawKey]?.trim();
        if (val) mapped[mappedKey] = val;
      }

      if (!mapped.accountName) {
        skipped++;
        errors.push(`Row ${i + 1}: Missing account name, skipped`);
        continue;
      }

      if (!mapped.accountType) {
        skipped++;
        errors.push(`Row ${i + 1}: Missing account type for "${mapped.accountName}", skipped`);
        continue;
      }

      try {
        const insertData: InsertChartOfAccount = {
          orgId,
          source: 'csv_import',
          accountName: mapped.accountName,
          accountType: mapped.accountType,
          accountNumber: mapped.accountNumber || null,
          detailType: mapped.detailType || null,
          parentExternalId: mapped.parentExternalId || null,
        };

        await db.insert(chartOfAccounts).values(insertData);
        imported++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: Failed to import "${mapped.accountName}" - ${err.message}`);
        skipped++;
      }
    }

    const resolved = await this.resolveParentReferences(orgId);

    await this.logAudit(orgId, userId || null, 'csv_import', 'chart_of_accounts', undefined, {
      totalRows: rows.length,
      imported,
      skipped,
      parentRefsResolved: resolved,
      errorCount: errors.length,
    });

    return { imported, skipped, errors };
  }

  async resolveParentReferences(orgId: string): Promise<number> {
    const accounts = await db
      .select()
      .from(chartOfAccounts)
      .where(
        and(
          eq(chartOfAccounts.orgId, orgId),
          isNull(chartOfAccounts.parentId),
          sql`${chartOfAccounts.parentExternalId} IS NOT NULL`
        )
      );

    let resolved = 0;

    for (const account of accounts) {
      if (!account.parentExternalId) continue;

      const [parent] = await db
        .select()
        .from(chartOfAccounts)
        .where(
          and(
            eq(chartOfAccounts.orgId, orgId),
            eq(chartOfAccounts.accountName, account.parentExternalId)
          )
        )
        .limit(1);

      if (!parent) {
        const [parentByNumber] = await db
          .select()
          .from(chartOfAccounts)
          .where(
            and(
              eq(chartOfAccounts.orgId, orgId),
              eq(chartOfAccounts.accountNumber, account.parentExternalId)
            )
          )
          .limit(1);

        if (parentByNumber) {
          await db
            .update(chartOfAccounts)
            .set({ parentId: parentByNumber.id, updatedAt: new Date() })
            .where(eq(chartOfAccounts.id, account.id));
          resolved++;
        }
      } else {
        await db
          .update(chartOfAccounts)
          .set({ parentId: parent.id, updatedAt: new Date() })
          .where(eq(chartOfAccounts.id, account.id));
        resolved++;
      }
    }

    return resolved;
  }

  async logAudit(
    orgId: string,
    userId: string | null,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: any
  ): Promise<void> {
    try {
      await db.insert(coaAuditLog).values({
        orgId,
        userId,
        action,
        entityType,
        entityId: entityId || null,
        metadata: metadata || null,
      });
    } catch (err) {
      console.error('[CoaService] Failed to write audit log:', err);
    }
  }

  async getAuditLog(orgId: string, limit: number = 50): Promise<CoaAuditLog[]> {
    return db
      .select()
      .from(coaAuditLog)
      .where(eq(coaAuditLog.orgId, orgId))
      .orderBy(desc(coaAuditLog.createdAt))
      .limit(limit);
  }

  private buildTree(accounts: ChartOfAccount[]): (ChartOfAccount & { children: ChartOfAccount[] })[] {
    const map = new Map<string, ChartOfAccount & { children: ChartOfAccount[] }>();
    const roots: (ChartOfAccount & { children: ChartOfAccount[] })[] = [];

    for (const acct of accounts) {
      map.set(acct.id, { ...acct, children: [] });
    }

    for (const acct of accounts) {
      const node = map.get(acct.id)!;
      if (acct.parentId && map.has(acct.parentId)) {
        map.get(acct.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}

export const coaService = new CoaService();
