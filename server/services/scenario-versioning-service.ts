import { db } from '../db';
import { 
  modelingScenarioVersions,
  modelingAuditLog,
  modelingProjects
} from '@shared/schema';
import { eq, and, desc, sql, ne } from 'drizzle-orm';

export type ScenarioType = 'base' | 'aggressive' | 'conservative' | 'custom';
export type ScenarioStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

export interface ScenarioAssumptions {
  growthRates?: Record<string, number>;
  expenseGrowth?: Record<string, number>;
  occupancy?: Record<string, Record<string, number>>;
  margins?: Record<string, { historical: number; projected: number }>;
  exitCapRate?: number;
  holdPeriod?: number;
  [key: string]: any;
}

export interface CreateScenarioInput {
  orgId: string;
  projectId: string;
  userId: string;
  scenarioType: ScenarioType;
  name: string;
  description?: string;
  revenueGrowthRate?: number;
  expenseGrowthRate?: number;
  exitCapRate?: number;
  assumptions?: ScenarioAssumptions;
}

export interface UpdateScenarioInput {
  scenarioId: string;
  userId: string;
  name?: string;
  description?: string;
  revenueGrowthRate?: number;
  expenseGrowthRate?: number;
  exitCapRate?: number;
  assumptions?: ScenarioAssumptions;
  createNewVersion?: boolean;
}

export class ScenarioVersioningService {
  async createScenario(input: CreateScenarioInput) {
    const existingCurrent = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, input.projectId),
        eq(modelingScenarioVersions.scenarioType, input.scenarioType),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .limit(1);

    if (existingCurrent.length > 0) {
      await db.update(modelingScenarioVersions)
        .set({ isCurrentVersion: false })
        .where(eq(modelingScenarioVersions.id, existingCurrent[0].id));
    }

    const [scenario] = await db.insert(modelingScenarioVersions).values({
      orgId: input.orgId,
      modelingProjectId: input.projectId,
      scenarioType: input.scenarioType,
      name: input.name,
      description: input.description,
      version: existingCurrent.length > 0 ? (existingCurrent[0].version || 0) + 1 : 1,
      isCurrentVersion: true,
      previousVersionId: existingCurrent.length > 0 ? existingCurrent[0].id : null,
      revenueGrowthRate: input.revenueGrowthRate?.toString(),
      expenseGrowthRate: input.expenseGrowthRate?.toString(),
      exitCapRate: input.exitCapRate?.toString(),
      assumptions: input.assumptions || {},
      status: 'draft',
      createdBy: input.userId,
      updatedBy: input.userId
    }).returning();

    await this.logAuditEvent({
      orgId: input.orgId,
      projectId: input.projectId,
      eventType: 'scenario_created',
      entityType: 'scenario',
      entityId: scenario.id,
      newValue: scenario,
      userId: input.userId
    });

    return scenario;
  }

  async updateScenario(input: UpdateScenarioInput) {
    const existing = await db.select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.id, input.scenarioId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Scenario not found');
    }

    const currentScenario = existing[0];

    // SCENARIO LOCKING: Approved scenarios are immutable - must create new version
    if (currentScenario.status === 'approved' && !input.createNewVersion) {
      throw new Error('SCENARIO_LOCKED: Approved scenarios cannot be edited directly. Create a new version to make changes.');
    }

    if (input.createNewVersion) {
      await db.update(modelingScenarioVersions)
        .set({ isCurrentVersion: false })
        .where(eq(modelingScenarioVersions.id, currentScenario.id));

      const [newVersion] = await db.insert(modelingScenarioVersions).values({
        orgId: currentScenario.orgId,
        modelingProjectId: currentScenario.modelingProjectId,
        scenarioType: currentScenario.scenarioType,
        name: input.name || currentScenario.name,
        description: input.description || currentScenario.description,
        version: (currentScenario.version || 0) + 1,
        isCurrentVersion: true,
        previousVersionId: currentScenario.id,
        revenueGrowthRate: input.revenueGrowthRate?.toString() || currentScenario.revenueGrowthRate,
        expenseGrowthRate: input.expenseGrowthRate?.toString() || currentScenario.expenseGrowthRate,
        exitCapRate: input.exitCapRate?.toString() || currentScenario.exitCapRate,
        assumptions: input.assumptions || currentScenario.assumptions || {},
        status: 'draft',
        createdBy: currentScenario.createdBy,
        updatedBy: input.userId
      }).returning();

      await this.logAuditEvent({
        orgId: currentScenario.orgId,
        projectId: currentScenario.modelingProjectId,
        eventType: 'scenario_version_created',
        entityType: 'scenario',
        entityId: newVersion.id,
        previousValue: currentScenario,
        newValue: newVersion,
        userId: input.userId
      });

      return newVersion;
    } else {
      const updateData: any = { updatedBy: input.userId, updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.revenueGrowthRate !== undefined) updateData.revenueGrowthRate = input.revenueGrowthRate.toString();
      if (input.expenseGrowthRate !== undefined) updateData.expenseGrowthRate = input.expenseGrowthRate.toString();
      if (input.exitCapRate !== undefined) updateData.exitCapRate = input.exitCapRate.toString();
      if (input.assumptions !== undefined) updateData.assumptions = input.assumptions;

      const [updated] = await db.update(modelingScenarioVersions)
        .set(updateData)
        .where(eq(modelingScenarioVersions.id, input.scenarioId))
        .returning();

      await this.logAuditEvent({
        orgId: currentScenario.orgId,
        projectId: currentScenario.modelingProjectId,
        eventType: 'scenario_updated',
        entityType: 'scenario',
        entityId: updated.id,
        previousValue: currentScenario,
        newValue: updated,
        changedFields: Object.keys(updateData).filter(k => k !== 'updatedBy' && k !== 'updatedAt'),
        userId: input.userId
      });

      return updated;
    }
  }

  async getCurrentScenarios(projectId: string) {
    return db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .orderBy(modelingScenarioVersions.scenarioType);
  }

  async getScenarioById(scenarioId: string) {
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.id, scenarioId))
      .limit(1);
    return scenario;
  }

  async getScenariosByType(projectId: string, scenarioType: ScenarioType) {
    return db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, scenarioType)
      ))
      .orderBy(desc(modelingScenarioVersions.version));
  }

  async getScenarioVersionHistory(projectId: string, scenarioType: ScenarioType, limit = 10) {
    return db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, scenarioType)
      ))
      .orderBy(desc(modelingScenarioVersions.version))
      .limit(limit);
  }

  async restoreVersion(scenarioId: string, userId: string) {
    const targetVersion = await this.getScenarioById(scenarioId);
    if (!targetVersion) {
      throw new Error('Scenario version not found');
    }

    await db.update(modelingScenarioVersions)
      .set({ isCurrentVersion: false })
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, targetVersion.modelingProjectId),
        eq(modelingScenarioVersions.scenarioType, targetVersion.scenarioType),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ));

    const currentVersions = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, targetVersion.modelingProjectId),
        eq(modelingScenarioVersions.scenarioType, targetVersion.scenarioType)
      ))
      .orderBy(desc(modelingScenarioVersions.version))
      .limit(1);

    const maxVersion = currentVersions.length > 0 ? (currentVersions[0].version || 0) : 0;

    const [restored] = await db.insert(modelingScenarioVersions).values({
      orgId: targetVersion.orgId,
      modelingProjectId: targetVersion.modelingProjectId,
      scenarioType: targetVersion.scenarioType,
      name: `${targetVersion.name} (Restored from v${targetVersion.version})`,
      description: targetVersion.description,
      version: maxVersion + 1,
      isCurrentVersion: true,
      previousVersionId: targetVersion.id,
      revenueGrowthRate: targetVersion.revenueGrowthRate,
      expenseGrowthRate: targetVersion.expenseGrowthRate,
      exitCapRate: targetVersion.exitCapRate,
      assumptions: targetVersion.assumptions || {},
      status: 'draft',
      createdBy: targetVersion.createdBy,
      updatedBy: userId
    }).returning();

    await this.logAuditEvent({
      orgId: targetVersion.orgId,
      projectId: targetVersion.modelingProjectId,
      eventType: 'scenario_restored',
      entityType: 'scenario',
      entityId: restored.id,
      previousValue: { restoredFromId: scenarioId, restoredFromVersion: targetVersion.version },
      newValue: restored,
      userId
    });

    return restored;
  }

  async submitForApproval(scenarioId: string, userId: string) {
    const [updated] = await db.update(modelingScenarioVersions)
      .set({ 
        status: 'pending_approval',
        updatedBy: userId,
        updatedAt: new Date()
      })
      .where(eq(modelingScenarioVersions.id, scenarioId))
      .returning();

    await this.logAuditEvent({
      orgId: updated.orgId,
      projectId: updated.modelingProjectId,
      eventType: 'scenario_submitted_for_approval',
      entityType: 'scenario',
      entityId: updated.id,
      newValue: { status: 'pending_approval' },
      userId
    });

    return updated;
  }

  async approveScenario(scenarioId: string, approverId: string, notes?: string) {
    const [updated] = await db.update(modelingScenarioVersions)
      .set({ 
        status: 'approved',
        approvedBy: approverId,
        approvedAt: new Date(),
        approvalNotes: notes,
        updatedBy: approverId,
        updatedAt: new Date()
      })
      .where(eq(modelingScenarioVersions.id, scenarioId))
      .returning();

    await this.logAuditEvent({
      orgId: updated.orgId,
      projectId: updated.modelingProjectId,
      eventType: 'scenario_approved',
      entityType: 'scenario',
      entityId: updated.id,
      newValue: { status: 'approved', approvedBy: approverId, notes },
      userId: approverId
    });

    return updated;
  }

  async rejectScenario(scenarioId: string, rejecterId: string, notes?: string) {
    const [updated] = await db.update(modelingScenarioVersions)
      .set({ 
        status: 'rejected',
        approvalNotes: notes,
        updatedBy: rejecterId,
        updatedAt: new Date()
      })
      .where(eq(modelingScenarioVersions.id, scenarioId))
      .returning();

    await this.logAuditEvent({
      orgId: updated.orgId,
      projectId: updated.modelingProjectId,
      eventType: 'scenario_rejected',
      entityType: 'scenario',
      entityId: updated.id,
      newValue: { status: 'rejected', notes },
      userId: rejecterId
    });

    return updated;
  }

  async initializeDefaultScenarios(projectId: string, orgId: string, userId: string) {
    const existing = await this.getCurrentScenarios(projectId);
    
    if (existing.length > 0) {
      return existing;
    }

    const defaultScenarios = [
      {
        scenarioType: 'base' as ScenarioType,
        name: 'Base Case',
        description: 'Most likely scenario based on historical performance and market conditions',
        revenueGrowthRate: 3.0,
        expenseGrowthRate: 2.5,
        exitCapRate: 7.0
      },
      {
        scenarioType: 'aggressive' as ScenarioType,
        name: 'Aggressive Case',
        description: 'Upside scenario with optimistic growth assumptions',
        revenueGrowthRate: 5.0,
        expenseGrowthRate: 2.0,
        exitCapRate: 6.5
      },
      {
        scenarioType: 'conservative' as ScenarioType,
        name: 'Conservative Case',
        description: 'Downside scenario with cautious assumptions',
        revenueGrowthRate: 1.5,
        expenseGrowthRate: 3.0,
        exitCapRate: 7.5
      }
    ];

    const created = [];
    for (const scenario of defaultScenarios) {
      const result = await this.createScenario({
        orgId,
        projectId,
        userId,
        ...scenario,
        assumptions: {
          growthRates: {},
          expenseGrowth: {},
          occupancy: {},
          margins: {}
        }
      });
      created.push(result);
    }

    return created;
  }

  async getAuditHistory(projectId: string, options?: { limit?: number; entityType?: string }) {
    const conditions = [eq(modelingAuditLog.modelingProjectId, projectId)];
    if (options?.entityType) {
      conditions.push(eq(modelingAuditLog.entityType, options.entityType));
    }

    return db.select()
      .from(modelingAuditLog)
      .where(and(...conditions))
      .orderBy(desc(modelingAuditLog.createdAt))
      .limit(options?.limit || 50);
  }

  private async logAuditEvent(input: {
    orgId: string;
    projectId: string;
    eventType: string;
    entityType: string;
    entityId?: string;
    previousValue?: any;
    newValue?: any;
    changedFields?: string[];
    userId: string;
    userEmail?: string;
  }) {
    await db.insert(modelingAuditLog).values({
      orgId: input.orgId,
      modelingProjectId: input.projectId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      previousValue: input.previousValue,
      newValue: input.newValue,
      changedFields: input.changedFields,
      userId: input.userId,
      userEmail: input.userEmail
    });
  }

  async compareScenarios(projectId: string, scenarioIds: string[]) {
    const scenarios = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        sql`${modelingScenarioVersions.id} = ANY(ARRAY[${scenarioIds.map(id => `'${id}'`).join(',')}]::varchar[])`
      ));

    return scenarios.map(s => ({
      id: s.id,
      name: s.name,
      scenarioType: s.scenarioType,
      version: s.version,
      status: s.status,
      revenueGrowthRate: s.revenueGrowthRate ? parseFloat(s.revenueGrowthRate) : null,
      expenseGrowthRate: s.expenseGrowthRate ? parseFloat(s.expenseGrowthRate) : null,
      exitCapRate: s.exitCapRate ? parseFloat(s.exitCapRate) : null,
      assumptions: s.assumptions,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }));
  }
}

export const scenarioVersioningService = new ScenarioVersioningService();
