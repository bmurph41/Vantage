import { db } from '../../db';
import { 
  fkAccounts, 
  fkAccountAliases, 
  fkTransactions, 
  fkTransactionLines, 
  fkPostingBatches, 
  fkAuditLog,
  fkEntities 
} from '@shared/finance-kernel-schema';
import { quickBooksService, ProfitAndLossReport } from '../quickbooks-service';
import { eq, and } from 'drizzle-orm';
import { featureFlags } from '../../config/featureFlags';

export interface QBOIngestionOptions {
  orgId: string;
  entityId: string;
  startDate: string;
  endDate: string;
  createdBy?: string;
}

export interface IngestionResult {
  success: boolean;
  batchId: string;
  transactionCount: number;
  lineCount: number;
  unmappedAccounts: string[];
  errors: string[];
}

export class QBOConnectorService {
  async isEnabled(): Promise<boolean> {
    return featureFlags.INTEGRATIONS_PLATFORM_ENABLED && featureFlags.CONNECTOR_QBO_ENABLED;
  }

  async isConnected(orgId: string): Promise<boolean> {
    const status = await quickBooksService.getConnectionStatus(orgId);
    return status.isConnected;
  }

  async getChartOfAccounts(orgId: string): Promise<any[]> {
    return quickBooksService.getChartOfAccounts(orgId);
  }

  async fetchProfitAndLoss(orgId: string, startDate: string, endDate: string): Promise<ProfitAndLossReport> {
    return quickBooksService.getProfitAndLoss(orgId, startDate, endDate);
  }

  async ingestProfitAndLoss(options: QBOIngestionOptions): Promise<IngestionResult> {
    const { orgId, entityId, startDate, endDate, createdBy } = options;
    const errors: string[] = [];
    const unmappedAccounts: string[] = [];

    const [batch] = await db.insert(fkPostingBatches).values({
      orgId,
      name: `QBO P&L Import ${startDate} to ${endDate}`,
      sourceSystem: 'qbo',
      status: 'created',
      entityId,
      periodStart: startDate,
      periodEnd: endDate,
      createdBy,
    }).returning();

    try {
      const plReport = await this.fetchProfitAndLoss(orgId, startDate, endDate);
      
      const accountAliases = await db.select()
        .from(fkAccountAliases)
        .where(and(
          eq(fkAccountAliases.orgId, orgId),
          eq(fkAccountAliases.sourceSystem, 'qbo')
        ));

      const aliasMap = new Map(
        accountAliases.map(a => [a.sourceAccountId, a.targetAccountId])
      );

      let transactionCount = 0;
      let lineCount = 0;

      const txnDate = new Date(endDate);
      const idempotencyKey = `qbo-pl-${entityId}-${startDate}-${endDate}`;

      const existingTxn = await db.select()
        .from(fkTransactions)
        .where(and(
          eq(fkTransactions.orgId, orgId),
          eq(fkTransactions.idempotencyKey, idempotencyKey)
        ))
        .limit(1);

      if (existingTxn.length > 0) {
        errors.push('Transaction already exists for this period. Skipping to prevent duplicates.');
        return {
          success: false,
          batchId: batch.id,
          transactionCount: 0,
          lineCount: 0,
          unmappedAccounts: [],
          errors,
        };
      }

      const [transaction] = await db.insert(fkTransactions).values({
        orgId,
        batchId: batch.id,
        entityId,
        sourceSystem: 'qbo',
        sourceObjectType: 'ProfitAndLoss',
        sourceObjectId: `${startDate}_${endDate}`,
        txnDate: txnDate.toISOString().split('T')[0],
        memo: `QuickBooks P&L for period ${startDate} to ${endDate}`,
        currency: 'USD',
        postedStatus: 'draft',
        idempotencyKey,
        createdBy,
      }).returning();

      transactionCount++;

      for (const row of plReport.rows) {
        const targetAccountId = aliasMap.get(row.accountId);

        if (!targetAccountId) {
          const autoMapped = await this.autoMapAccount(orgId, row.accountId, row.account, row.type);
          if (autoMapped) {
            aliasMap.set(row.accountId, autoMapped);
          } else {
            unmappedAccounts.push(`${row.account} (${row.accountId})`);
            continue;
          }
        }

        const finalAccountId = aliasMap.get(row.accountId);
        if (!finalAccountId) continue;

        await db.insert(fkTransactionLines).values({
          orgId,
          transactionId: transaction.id,
          accountId: finalAccountId,
          amount: row.amount.toString(),
          lineMemo: row.account,
          mappingExplanation: {
            sourceAccount: row.account,
            sourceAccountId: row.accountId,
            sourceType: row.type,
            group: row.group,
          },
        });

        lineCount++;
      }

      await db.update(fkPostingBatches)
        .set({
          status: 'review',
          statsJson: {
            transactionCount,
            lineCount,
            unmappedCount: unmappedAccounts.length,
          },
          updatedAt: new Date(),
        })
        .where(eq(fkPostingBatches.id, batch.id));

      await db.insert(fkAuditLog).values({
        orgId,
        actorUserId: createdBy,
        action: 'qbo_ingest',
        resourceType: 'posting_batch',
        resourceId: batch.id,
        afterJson: {
          batchId: batch.id,
          periodStart: startDate,
          periodEnd: endDate,
          transactionCount,
          lineCount,
        },
      });

      return {
        success: true,
        batchId: batch.id,
        transactionCount,
        lineCount,
        unmappedAccounts,
        errors,
      };

    } catch (error: any) {
      await db.update(fkPostingBatches)
        .set({
          status: 'void',
          statsJson: { error: error.message },
          updatedAt: new Date(),
        })
        .where(eq(fkPostingBatches.id, batch.id));

      throw error;
    }
  }

  private async autoMapAccount(
    orgId: string,
    sourceAccountId: string,
    accountName: string,
    accountType: string
  ): Promise<string | null> {
    const mappedType = this.qbTypeToFkType(accountType);
    
    const matchingAccounts = await db.select()
      .from(fkAccounts)
      .where(and(
        eq(fkAccounts.orgId, orgId),
        eq(fkAccounts.accountType, mappedType),
        eq(fkAccounts.isActive, true)
      ));

    const lowerName = accountName.toLowerCase();
    
    for (const account of matchingAccounts) {
      if (account.name.toLowerCase() === lowerName) {
        await db.insert(fkAccountAliases).values({
          orgId,
          sourceSystem: 'qbo',
          sourceAccountId,
          sourceAccountName: accountName,
          targetAccountId: account.id,
          confidence: '0.95',
        }).onConflictDoNothing();
        
        return account.id;
      }
    }

    for (const account of matchingAccounts) {
      const similarity = this.calculateSimilarity(accountName.toLowerCase(), account.name.toLowerCase());
      if (similarity > 0.7) {
        await db.insert(fkAccountAliases).values({
          orgId,
          sourceSystem: 'qbo',
          sourceAccountId,
          sourceAccountName: accountName,
          targetAccountId: account.id,
          confidence: similarity.toFixed(2),
        }).onConflictDoNothing();
        
        return account.id;
      }
    }

    return null;
  }

  private qbTypeToFkType(qbType: string): 'income' | 'cogs' | 'expense' | 'other_income' | 'other_expense' | 'asset' | 'liability' | 'equity' {
    switch (qbType) {
      case 'Income': return 'income';
      case 'COGS': return 'cogs';
      case 'Expense': return 'expense';
      case 'Other': return 'other_expense';
      default: return 'expense';
    }
  }

  private calculateSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(/\s+/));
    const setB = new Set(b.split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  async getPostingBatches(orgId: string, limit = 20): Promise<any[]> {
    return db.select()
      .from(fkPostingBatches)
      .where(eq(fkPostingBatches.orgId, orgId))
      .orderBy(fkPostingBatches.createdAt)
      .limit(limit);
  }

  async approveBatch(orgId: string, batchId: string, userId: string): Promise<void> {
    await db.update(fkPostingBatches)
      .set({ status: 'posted', updatedAt: new Date() })
      .where(and(
        eq(fkPostingBatches.id, batchId),
        eq(fkPostingBatches.orgId, orgId)
      ));

    await db.update(fkTransactions)
      .set({ postedStatus: 'posted' })
      .where(and(
        eq(fkTransactions.batchId, batchId),
        eq(fkTransactions.orgId, orgId)
      ));

    await db.insert(fkAuditLog).values({
      orgId,
      actorUserId: userId,
      action: 'batch_approve',
      resourceType: 'posting_batch',
      resourceId: batchId,
    });
  }
}

export const qboConnectorService = new QBOConnectorService();
