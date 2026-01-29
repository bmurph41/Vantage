/**
 * Scenario Governance Service
 * 
 * Phase 5: Institutional-Grade Scenario Management
 * 
 * Enforces:
 * - Immutability of approved scenarios
 * - Fork-based editing (approved scenarios can't be modified)
 * - Full audit trail for compliance
 * - Version comparisons for due diligence
 * - Rollback capabilities
 */

import { db } from '../db';
import { 
  modelingScenarioVersions,
  scenarioAuditLogs,
  scenarioAssumptionPayloads,
  modelingProjects
} from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import * as crypto from 'crypto';

// ============================================
// TYPES
// ============================================

export type ScenarioStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'archived';
export type AuditEventType = 
  | 'created' 
  | 'updated' 
  | 'submitted_for_approval' 
  | 'approved' 
  | 'rejected' 
  | 'forked'
  | 'rolled_back'
  | 'archived'
  | 'assumptions_changed'
  | 'sensitivity_analysis_saved';

export interface ScenarioVersion {
  id: string;
  orgId: string;
  modelingProjectId: string;
  scenarioType: string;
  name: string;
  description?: string;
  version: number;
  isCurrentVersion: boolean;
  previousVersionId?: string;
  status: ScenarioStatus;
  assumptions: Record<string, any>;
  revenueGrowthRate?: number;
  expenseGrowthRate?: number;
  exitCapRate?: number;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogEntry {
  id: string;
  orgId: string;
  projectId: string;
  scenarioId?: string;
  scenarioVersionId?: string;
  userId: string;
  eventType: AuditEventType;
  summary: string;
  diffJson?: Record<string, any>;
  payloadHash?: string;
  createdAt: Date;
}

export interface ForkOptions {
  name?: string;
  description?: string;
  resetToVersion?: number;  // Fork from specific version instead of current
}

export interface VersionComparison {
  baseVersion: ScenarioVersion;
  compareVersion: ScenarioVersion;
  changes: FieldChange[];
  assumptionsDiff: AssumptionDiff;
}

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

export interface AssumptionDiff {
  added: string[];
  removed: string[];
  modified: Array<{ key: string; oldValue: any; newValue: any }>;
}

// ============================================
// SERVICE CLASS
// ============================================

export class ScenarioGovernanceService {

  // ============================================
  // IMMUTABILITY ENFORCEMENT
  // ============================================

  /**
   * Check if a scenario can be modified.
   * Approved scenarios are IMMUTABLE.
   */
  async canModifyScenario(
    scenarioVersionId: string,
    orgId: string
  ): Promise<{ canModify: boolean; reason?: string }> {
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.id, scenarioVersionId),
        eq(modelingScenarioVersions.orgId, orgId)
      ))
      .limit(1);
    
    if (!scenario) {
      return { canModify: false, reason: 'Scenario not found' };
    }
    
    if (scenario.status === 'approved') {
      return { 
        canModify: false, 
        reason: 'Approved scenarios are immutable. Fork this scenario to make changes.' 
      };
    }
    
    if (scenario.status === 'archived') {
      return { 
        canModify: false, 
        reason: 'Archived scenarios cannot be modified.' 
      };
    }
    
    if (scenario.status === 'pending_approval') {
      return { 
        canModify: false, 
        reason: 'Scenario is pending approval. Withdraw submission first to make changes.' 
      };
    }
    
    return { canModify: true };
  }

  /**
   * Update scenario assumptions with immutability check.
   */
  async updateAssumptions(
    scenarioVersionId: string,
    orgId: string,
    userId: string,
    assumptions: Record<string, any>,
    options?: { bypassImmutability?: boolean; reason?: string }
  ): Promise<{ success: boolean; error?: string; scenario?: ScenarioVersion }> {
    // Check immutability
    if (!options?.bypassImmutability) {
      const { canModify, reason } = await this.canModifyScenario(scenarioVersionId, orgId);
      if (!canModify) {
        return { success: false, error: reason };
      }
    }
    
    // Get current scenario for diff
    const [current] = await db.select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.id, scenarioVersionId))
      .limit(1);
    
    if (!current) {
      return { success: false, error: 'Scenario not found' };
    }
    
    // Calculate diff
    const diff = this.calculateAssumptionsDiff(
      (current.assumptions as Record<string, any>) || {},
      assumptions
    );
    
    // Generate payload hash for integrity
    const payloadHash = this.hashPayload(assumptions);
    
    // Update scenario
    const [updated] = await db.update(modelingScenarioVersions)
      .set({
        assumptions,
        updatedAt: new Date(),
      })
      .where(eq(modelingScenarioVersions.id, scenarioVersionId))
      .returning();
    
    // Store versioned payload
    await db.insert(scenarioAssumptionPayloads).values({
      scenarioVersionId,
      payload: assumptions,
      payloadSchemaVersion: '1.0',
      payloadHash,
    });
    
    // Log audit event
    await this.logAuditEvent({
      orgId,
      projectId: current.modelingProjectId,
      scenarioId: current.scenarioType,
      scenarioVersionId,
      userId,
      eventType: 'assumptions_changed',
      summary: `Assumptions updated: ${diff.modified.length} fields modified, ${diff.added.length} added, ${diff.removed.length} removed`,
      diffJson: diff,
      payloadHash,
    });
    
    return { 
      success: true, 
      scenario: this.mapToScenarioVersion(updated)
    };
  }

  // ============================================
  // FORKING
  // ============================================

  /**
   * Fork a scenario to create an editable copy.
   * This is the ONLY way to modify an approved scenario.
   */
  async forkScenario(
    scenarioVersionId: string,
    orgId: string,
    userId: string,
    options?: ForkOptions
  ): Promise<{ success: boolean; error?: string; newScenario?: ScenarioVersion }> {
    // Get source scenario
    const [source] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.id, scenarioVersionId),
        eq(modelingScenarioVersions.orgId, orgId)
      ))
      .limit(1);
    
    if (!source) {
      return { success: false, error: 'Source scenario not found' };
    }
    
    // Get max version number for this scenario type
    const [maxVersion] = await db.select({ maxV: modelingScenarioVersions.version })
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, source.modelingProjectId),
        eq(modelingScenarioVersions.scenarioType, source.scenarioType)
      ))
      .orderBy(desc(modelingScenarioVersions.version))
      .limit(1);
    
    const newVersion = (maxVersion?.maxV || 0) + 1;
    
    // Mark current version as not current
    await db.update(modelingScenarioVersions)
      .set({ isCurrentVersion: false })
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, source.modelingProjectId),
        eq(modelingScenarioVersions.scenarioType, source.scenarioType),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ));
    
    // Create forked scenario
    const [forked] = await db.insert(modelingScenarioVersions).values({
      orgId,
      modelingProjectId: source.modelingProjectId,
      scenarioType: source.scenarioType,
      name: options?.name || `${source.name} (Fork v${newVersion})`,
      description: options?.description || `Forked from v${source.version}`,
      version: newVersion,
      isCurrentVersion: true,
      previousVersionId: scenarioVersionId,
      status: 'draft',
      assumptions: source.assumptions,
      revenueGrowthRate: source.revenueGrowthRate,
      expenseGrowthRate: source.expenseGrowthRate,
      exitCapRate: source.exitCapRate,
      createdBy: userId,
    }).returning();
    
    // Log audit event
    await this.logAuditEvent({
      orgId,
      projectId: source.modelingProjectId,
      scenarioId: source.scenarioType,
      scenarioVersionId: forked.id,
      userId,
      eventType: 'forked',
      summary: `Forked from v${source.version} (${source.status}) to create v${newVersion}`,
      diffJson: {
        sourceVersionId: scenarioVersionId,
        sourceVersion: source.version,
        sourceStatus: source.status,
        newVersion,
      },
    });
    
    return {
      success: true,
      newScenario: this.mapToScenarioVersion(forked),
    };
  }

  // ============================================
  // APPROVAL WORKFLOW
  // ============================================

  /**
   * Submit scenario for approval.
   */
  async submitForApproval(
    scenarioVersionId: string,
    orgId: string,
    userId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { canModify, reason } = await this.canModifyScenario(scenarioVersionId, orgId);
    
    // Only draft scenarios can be submitted
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(eq(modelingScenarioVersions.id, scenarioVersionId))
      .limit(1);
    
    if (!scenario) {
      return { success: false, error: 'Scenario not found' };
    }
    
    if (scenario.status !== 'draft') {
      return { success: false, error: `Cannot submit ${scenario.status} scenario for approval` };
    }
    
    // Generate hash of current assumptions for integrity check
    const payloadHash = this.hashPayload(scenario.assumptions);
    
    await db.update(modelingScenarioVersions)
      .set({
        status: 'pending_approval',
        updatedAt: new Date(),
      })
      .where(eq(modelingScenarioVersions.id, scenarioVersionId));
    
    await this.logAuditEvent({
      orgId,
      projectId: scenario.modelingProjectId,
      scenarioId: scenario.scenarioType,
      scenarioVersionId,
      userId,
      eventType: 'submitted_for_approval',
      summary: `Submitted v${scenario.version} for approval`,
      diffJson: notes ? { notes } : undefined,
      payloadHash,
    });
    
    return { success: true };
  }

  /**
   * Approve a scenario.
   */
  async approveScenario(
    scenarioVersionId: string,
    orgId: string,
    approverId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.id, scenarioVersionId),
        eq(modelingScenarioVersions.orgId, orgId)
      ))
      .limit(1);
    
    if (!scenario) {
      return { success: false, error: 'Scenario not found' };
    }
    
    if (scenario.status !== 'pending_approval') {
      return { success: false, error: `Cannot approve ${scenario.status} scenario` };
    }
    
    // Once approved, scenario becomes IMMUTABLE
    await db.update(modelingScenarioVersions)
      .set({
        status: 'approved',
        approvedBy: approverId,
        approvedAt: new Date(),
        approvalNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(modelingScenarioVersions.id, scenarioVersionId));
    
    const payloadHash = this.hashPayload(scenario.assumptions);
    
    await this.logAuditEvent({
      orgId,
      projectId: scenario.modelingProjectId,
      scenarioId: scenario.scenarioType,
      scenarioVersionId,
      userId: approverId,
      eventType: 'approved',
      summary: `Approved v${scenario.version}. Scenario is now IMMUTABLE.`,
      diffJson: notes ? { notes } : undefined,
      payloadHash,
    });
    
    return { success: true };
  }

  /**
   * Reject a scenario.
   */
  async rejectScenario(
    scenarioVersionId: string,
    orgId: string,
    rejecterId: string,
    notes: string
  ): Promise<{ success: boolean; error?: string }> {
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.id, scenarioVersionId),
        eq(modelingScenarioVersions.orgId, orgId)
      ))
      .limit(1);
    
    if (!scenario) {
      return { success: false, error: 'Scenario not found' };
    }
    
    if (scenario.status !== 'pending_approval') {
      return { success: false, error: `Cannot reject ${scenario.status} scenario` };
    }
    
    // Rejected scenarios return to draft status
    await db.update(modelingScenarioVersions)
      .set({
        status: 'rejected',
        approvalNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(modelingScenarioVersions.id, scenarioVersionId));
    
    await this.logAuditEvent({
      orgId,
      projectId: scenario.modelingProjectId,
      scenarioId: scenario.scenarioType,
      scenarioVersionId,
      userId: rejecterId,
      eventType: 'rejected',
      summary: `Rejected v${scenario.version}: ${notes}`,
      diffJson: { notes },
    });
    
    return { success: true };
  }

  /**
   * Withdraw approval submission.
   */
  async withdrawSubmission(
    scenarioVersionId: string,
    orgId: string,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.id, scenarioVersionId),
        eq(modelingScenarioVersions.orgId, orgId)
      ))
      .limit(1);
    
    if (!scenario) {
      return { success: false, error: 'Scenario not found' };
    }
    
    if (scenario.status !== 'pending_approval') {
      return { success: false, error: 'Scenario is not pending approval' };
    }
    
    await db.update(modelingScenarioVersions)
      .set({
        status: 'draft',
        updatedAt: new Date(),
      })
      .where(eq(modelingScenarioVersions.id, scenarioVersionId));
    
    await this.logAuditEvent({
      orgId,
      projectId: scenario.modelingProjectId,
      scenarioId: scenario.scenarioType,
      scenarioVersionId,
      userId,
      eventType: 'updated',
      summary: `Withdrew approval submission: ${reason || 'No reason provided'}`,
      diffJson: { previousStatus: 'pending_approval', newStatus: 'draft', reason },
    });
    
    return { success: true };
  }

  // ============================================
  // VERSION HISTORY & COMPARISON
  // ============================================

  /**
   * Get version history for a scenario type.
   */
  async getVersionHistory(
    projectId: string,
    scenarioType: string,
    orgId: string
  ): Promise<ScenarioVersion[]> {
    const versions = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, scenarioType),
        eq(modelingScenarioVersions.orgId, orgId)
      ))
      .orderBy(desc(modelingScenarioVersions.version));
    
    return versions.map(v => this.mapToScenarioVersion(v));
  }

  /**
   * Compare two scenario versions.
   */
  async compareVersions(
    baseVersionId: string,
    compareVersionId: string,
    orgId: string
  ): Promise<VersionComparison | null> {
    const [base, compare] = await Promise.all([
      db.select().from(modelingScenarioVersions)
        .where(and(
          eq(modelingScenarioVersions.id, baseVersionId),
          eq(modelingScenarioVersions.orgId, orgId)
        )).limit(1),
      db.select().from(modelingScenarioVersions)
        .where(and(
          eq(modelingScenarioVersions.id, compareVersionId),
          eq(modelingScenarioVersions.orgId, orgId)
        )).limit(1),
    ]);
    
    if (!base[0] || !compare[0]) return null;
    
    const baseVersion = this.mapToScenarioVersion(base[0]);
    const compareVersion = this.mapToScenarioVersion(compare[0]);
    
    const changes: FieldChange[] = [];
    
    // Compare top-level fields
    const fieldsToCompare = ['name', 'description', 'revenueGrowthRate', 'expenseGrowthRate', 'exitCapRate'];
    for (const field of fieldsToCompare) {
      const oldVal = (baseVersion as any)[field];
      const newVal = (compareVersion as any)[field];
      if (oldVal !== newVal) {
        changes.push({
          field,
          oldValue: oldVal,
          newValue: newVal,
          changeType: 'modified',
        });
      }
    }
    
    // Compare assumptions
    const assumptionsDiff = this.calculateAssumptionsDiff(
      baseVersion.assumptions || {},
      compareVersion.assumptions || {}
    );
    
    return {
      baseVersion,
      compareVersion,
      changes,
      assumptionsDiff,
    };
  }

  /**
   * Rollback to a previous version.
   */
  async rollbackToVersion(
    targetVersionId: string,
    orgId: string,
    userId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string; newScenario?: ScenarioVersion }> {
    // Get target version
    const [target] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.id, targetVersionId),
        eq(modelingScenarioVersions.orgId, orgId)
      ))
      .limit(1);
    
    if (!target) {
      return { success: false, error: 'Target version not found' };
    }
    
    // Create a new version based on the target (fork-style rollback)
    const result = await this.forkScenario(targetVersionId, orgId, userId, {
      name: target.name,
      description: `Rolled back to v${target.version}: ${reason}`,
    });
    
    if (result.success && result.newScenario) {
      await this.logAuditEvent({
        orgId,
        projectId: target.modelingProjectId,
        scenarioId: target.scenarioType,
        scenarioVersionId: result.newScenario.id,
        userId,
        eventType: 'rolled_back',
        summary: `Rolled back to v${target.version}: ${reason}`,
        diffJson: { 
          targetVersionId, 
          targetVersion: target.version,
          reason 
        },
      });
    }
    
    return result;
  }

  // ============================================
  // AUDIT TRAIL
  // ============================================

  /**
   * Get audit log for a project or scenario.
   */
  async getAuditLog(
    orgId: string,
    options: {
      projectId?: string;
      scenarioVersionId?: string;
      limit?: number;
    }
  ): Promise<AuditLogEntry[]> {
    let query = db.select()
      .from(scenarioAuditLogs)
      .where(eq(scenarioAuditLogs.orgId, orgId));
    
    const conditions = [eq(scenarioAuditLogs.orgId, orgId)];
    
    if (options.projectId) {
      conditions.push(eq(scenarioAuditLogs.projectId, options.projectId));
    }
    
    if (options.scenarioVersionId) {
      conditions.push(eq(scenarioAuditLogs.scenarioVersionId, options.scenarioVersionId));
    }
    
    const logs = await db.select()
      .from(scenarioAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(scenarioAuditLogs.createdAt))
      .limit(options.limit || 100);
    
    return logs.map(l => ({
      id: l.id,
      orgId: l.orgId,
      projectId: l.projectId,
      scenarioId: l.scenarioId || undefined,
      scenarioVersionId: l.scenarioVersionId || undefined,
      userId: l.userId,
      eventType: l.eventType as AuditEventType,
      summary: l.summary,
      diffJson: (l.diffJson as Record<string, any>) || undefined,
      payloadHash: l.payloadHash || undefined,
      createdAt: l.createdAt,
    }));
  }

  /**
   * Log an audit event.
   */
  private async logAuditEvent(params: {
    orgId: string;
    projectId: string;
    scenarioId?: string;
    scenarioVersionId?: string;
    userId: string;
    eventType: AuditEventType;
    summary: string;
    diffJson?: Record<string, any>;
    payloadHash?: string;
  }): Promise<void> {
    await db.insert(scenarioAuditLogs).values({
      orgId: params.orgId,
      projectId: params.projectId,
      scenarioId: params.scenarioId,
      scenarioVersionId: params.scenarioVersionId,
      userId: params.userId,
      eventType: params.eventType,
      summary: params.summary,
      diffJson: params.diffJson,
      payloadHash: params.payloadHash,
    });
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate hash of assumptions payload for integrity verification.
   */
  private hashPayload(payload: any): string {
    const json = JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
    return crypto.createHash('sha256').update(json).digest('hex').substring(0, 16);
  }

  /**
   * Calculate diff between two assumption objects.
   */
  private calculateAssumptionsDiff(
    oldAssumptions: Record<string, any>,
    newAssumptions: Record<string, any>
  ): AssumptionDiff {
    const oldKeys = new Set(Object.keys(oldAssumptions));
    const newKeys = new Set(Object.keys(newAssumptions));
    
    const added: string[] = [];
    const removed: string[] = [];
    const modified: Array<{ key: string; oldValue: any; newValue: any }> = [];
    
    // Find added keys
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        added.push(key);
      }
    }
    
    // Find removed keys
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        removed.push(key);
      }
    }
    
    // Find modified keys
    for (const key of oldKeys) {
      if (newKeys.has(key)) {
        const oldVal = JSON.stringify(oldAssumptions[key]);
        const newVal = JSON.stringify(newAssumptions[key]);
        if (oldVal !== newVal) {
          modified.push({
            key,
            oldValue: oldAssumptions[key],
            newValue: newAssumptions[key],
          });
        }
      }
    }
    
    return { added, removed, modified };
  }

  /**
   * Map database row to ScenarioVersion type.
   */
  private mapToScenarioVersion(row: any): ScenarioVersion {
    return {
      id: row.id,
      orgId: row.orgId,
      modelingProjectId: row.modelingProjectId,
      scenarioType: row.scenarioType,
      name: row.name,
      description: row.description || undefined,
      version: row.version,
      isCurrentVersion: row.isCurrentVersion,
      previousVersionId: row.previousVersionId || undefined,
      status: row.status as ScenarioStatus,
      assumptions: (row.assumptions as Record<string, any>) || {},
      revenueGrowthRate: row.revenueGrowthRate ? parseFloat(row.revenueGrowthRate) : undefined,
      expenseGrowthRate: row.expenseGrowthRate ? parseFloat(row.expenseGrowthRate) : undefined,
      exitCapRate: row.exitCapRate ? parseFloat(row.exitCapRate) : undefined,
      approvedBy: row.approvedBy || undefined,
      approvedAt: row.approvedAt || undefined,
      approvalNotes: row.approvalNotes || undefined,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const scenarioGovernanceService = new ScenarioGovernanceService();
