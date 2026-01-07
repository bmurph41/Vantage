import { db } from "../../db";
import { scCompHistory, salesComps } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface ChangeRecord {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface HistoryEntry {
  id: string;
  compId: string;
  changedBy: string;
  changedAt: Date;
  changeType: 'create' | 'update' | 'merge' | 'bulk_update';
  changeSource: 'manual' | 'import' | 'api' | 'system';
  importBatchId?: string;
  previousValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  changeReason?: string;
  affectedFields: string[];
}

export class CompHistoryService {

  async recordChange(params: {
    orgId: string;
    compId: string;
    changedBy: string;
    changeType: 'create' | 'update' | 'merge' | 'bulk_update';
    changeSource: 'manual' | 'import' | 'api' | 'system';
    importBatchId?: string;
    previousValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
    changeReason?: string;
  }): Promise<string> {
    const affectedFields = this.getAffectedFields(params.previousValues, params.newValues);

    const [record] = await db.insert(scCompHistory)
      .values({
        orgId: params.orgId,
        compId: params.compId,
        changedBy: params.changedBy,
        changeType: params.changeType,
        changeSource: params.changeSource,
        importBatchId: params.importBatchId,
        previousValues: params.previousValues,
        newValues: params.newValues,
        changeReason: params.changeReason,
        affectedFields,
      })
      .returning();

    await this.updateCompChangeHistory(params.compId, {
      field: affectedFields.join(', '),
      oldValue: params.previousValues,
      newValue: params.newValues,
      changedAt: new Date().toISOString(),
      changedBy: params.changedBy,
      changeReason: params.changeReason,
    });

    return record.id;
  }

  async getCompHistory(
    orgId: string,
    compId: string,
    limit = 50
  ): Promise<HistoryEntry[]> {
    const records = await db.select()
      .from(scCompHistory)
      .where(and(
        eq(scCompHistory.orgId, orgId),
        eq(scCompHistory.compId, compId)
      ))
      .orderBy(desc(scCompHistory.changedAt))
      .limit(limit);

    return records.map(r => ({
      id: r.id,
      compId: r.compId,
      changedBy: r.changedBy,
      changedAt: r.changedAt,
      changeType: r.changeType as HistoryEntry['changeType'],
      changeSource: r.changeSource as HistoryEntry['changeSource'],
      importBatchId: r.importBatchId || undefined,
      previousValues: (r.previousValues || {}) as Record<string, unknown>,
      newValues: (r.newValues || {}) as Record<string, unknown>,
      changeReason: r.changeReason || undefined,
      affectedFields: r.affectedFields || [],
    }));
  }

  async getFieldHistory(
    orgId: string,
    compId: string,
    field: string
  ): Promise<Array<{
    changedAt: Date;
    changedBy: string;
    oldValue: unknown;
    newValue: unknown;
    changeReason?: string;
  }>> {
    const history = await this.getCompHistory(orgId, compId, 100);
    
    return history
      .filter(entry => entry.affectedFields.includes(field))
      .map(entry => ({
        changedAt: entry.changedAt,
        changedBy: entry.changedBy,
        oldValue: entry.previousValues[field],
        newValue: entry.newValues[field],
        changeReason: entry.changeReason,
      }));
  }

  async rollbackToVersion(
    orgId: string,
    compId: string,
    historyId: string,
    userId: string
  ): Promise<boolean> {
    const history = await db.select()
      .from(scCompHistory)
      .where(and(
        eq(scCompHistory.id, historyId),
        eq(scCompHistory.orgId, orgId),
        eq(scCompHistory.compId, compId)
      ))
      .limit(1);

    if (history.length === 0) {
      throw new Error('History record not found');
    }

    const record = history[0];
    const previousValues = record.previousValues as Record<string, unknown>;

    const [currentComp] = await db.select()
      .from(salesComps)
      .where(eq(salesComps.id, compId))
      .limit(1);

    if (!currentComp) {
      throw new Error('Comp not found');
    }

    const currentValues: Record<string, unknown> = {};
    for (const field of Object.keys(previousValues)) {
      currentValues[field] = (currentComp as any)[field];
    }

    await db.update(salesComps)
      .set({
        ...previousValues,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(salesComps.id, compId));

    await this.recordChange({
      orgId,
      compId,
      changedBy: userId,
      changeType: 'update',
      changeSource: 'manual',
      previousValues: currentValues,
      newValues: previousValues,
      changeReason: `Rollback to version from ${record.changedAt?.toISOString()}`,
    });

    return true;
  }

  async getRecentOrgChanges(
    orgId: string,
    limit = 100
  ): Promise<HistoryEntry[]> {
    const records = await db.select()
      .from(scCompHistory)
      .where(eq(scCompHistory.orgId, orgId))
      .orderBy(desc(scCompHistory.changedAt))
      .limit(limit);

    return records.map(r => ({
      id: r.id,
      compId: r.compId,
      changedBy: r.changedBy,
      changedAt: r.changedAt,
      changeType: r.changeType as HistoryEntry['changeType'],
      changeSource: r.changeSource as HistoryEntry['changeSource'],
      importBatchId: r.importBatchId || undefined,
      previousValues: (r.previousValues || {}) as Record<string, unknown>,
      newValues: (r.newValues || {}) as Record<string, unknown>,
      changeReason: r.changeReason || undefined,
      affectedFields: r.affectedFields || [],
    }));
  }

  async getImportBatchHistory(
    orgId: string,
    batchId: string
  ): Promise<HistoryEntry[]> {
    const records = await db.select()
      .from(scCompHistory)
      .where(and(
        eq(scCompHistory.orgId, orgId),
        eq(scCompHistory.importBatchId, batchId)
      ))
      .orderBy(desc(scCompHistory.changedAt));

    return records.map(r => ({
      id: r.id,
      compId: r.compId,
      changedBy: r.changedBy,
      changedAt: r.changedAt,
      changeType: r.changeType as HistoryEntry['changeType'],
      changeSource: r.changeSource as HistoryEntry['changeSource'],
      importBatchId: r.importBatchId || undefined,
      previousValues: (r.previousValues || {}) as Record<string, unknown>,
      newValues: (r.newValues || {}) as Record<string, unknown>,
      changeReason: r.changeReason || undefined,
      affectedFields: r.affectedFields || [],
    }));
  }

  private getAffectedFields(
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>
  ): string[] {
    const fields = new Set<string>();
    
    for (const key of Object.keys(oldValues)) {
      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        fields.add(key);
      }
    }
    
    for (const key of Object.keys(newValues)) {
      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        fields.add(key);
      }
    }
    
    return Array.from(fields);
  }

  private async updateCompChangeHistory(
    compId: string,
    change: {
      field: string;
      oldValue: unknown;
      newValue: unknown;
      changedAt: string;
      changedBy: string;
      changeReason?: string;
    }
  ): Promise<void> {
    try {
      const [comp] = await db.select({ changeHistory: salesComps.changeHistory })
        .from(salesComps)
        .where(eq(salesComps.id, compId))
        .limit(1);

      if (!comp) return;

      const currentHistory = (comp.changeHistory || []) as Array<typeof change>;
      const updatedHistory = [...currentHistory, change].slice(-50);

      await db.update(salesComps)
        .set({ changeHistory: updatedHistory })
        .where(eq(salesComps.id, compId));
    } catch (error) {
      console.error('[CompHistory] Error updating inline history:', error);
    }
  }

  async compareVersions(
    orgId: string,
    historyId1: string,
    historyId2: string
  ): Promise<{
    differences: Array<{
      field: string;
      version1Value: unknown;
      version2Value: unknown;
    }>;
    version1: HistoryEntry;
    version2: HistoryEntry;
  }> {
    const records = await db.select()
      .from(scCompHistory)
      .where(and(
        eq(scCompHistory.orgId, orgId)
      ));

    const v1 = records.find(r => r.id === historyId1);
    const v2 = records.find(r => r.id === historyId2);

    if (!v1 || !v2) {
      throw new Error('One or both history records not found');
    }

    const v1Values = v1.newValues as Record<string, unknown>;
    const v2Values = v2.newValues as Record<string, unknown>;

    const allFields = new Set([...Object.keys(v1Values), ...Object.keys(v2Values)]);
    const differences: Array<{
      field: string;
      version1Value: unknown;
      version2Value: unknown;
    }> = [];

    for (const field of allFields) {
      if (JSON.stringify(v1Values[field]) !== JSON.stringify(v2Values[field])) {
        differences.push({
          field,
          version1Value: v1Values[field],
          version2Value: v2Values[field],
        });
      }
    }

    return {
      differences,
      version1: {
        id: v1.id,
        compId: v1.compId,
        changedBy: v1.changedBy,
        changedAt: v1.changedAt,
        changeType: v1.changeType as HistoryEntry['changeType'],
        changeSource: v1.changeSource as HistoryEntry['changeSource'],
        previousValues: (v1.previousValues || {}) as Record<string, unknown>,
        newValues: v1Values,
        affectedFields: v1.affectedFields || [],
      },
      version2: {
        id: v2.id,
        compId: v2.compId,
        changedBy: v2.changedBy,
        changedAt: v2.changedAt,
        changeType: v2.changeType as HistoryEntry['changeType'],
        changeSource: v2.changeSource as HistoryEntry['changeSource'],
        previousValues: (v2.previousValues || {}) as Record<string, unknown>,
        newValues: v2Values,
        affectedFields: v2.affectedFields || [],
      },
    };
  }
}

export const compHistoryService = new CompHistoryService();
