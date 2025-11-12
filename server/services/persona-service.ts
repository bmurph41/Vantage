import { db } from '../db';
import {
  personaFeatureFlags,
  userPersonaAssignments,
  users,
} from '@shared/schema';
import { eq, and, or } from 'drizzle-orm';
import type {
  PersonaFeatureFlag,
  UserPersonaAssignment,
  InsertUserPersonaAssignment,
  UpdateUserPersonaAssignment,
} from '@shared/schema';

export class PersonaService {
  // ================================================================================
  // USER PERSONA ASSIGNMENTS
  // ================================================================================

  /**
   * Get user's persona assignment for an organization
   */
  async getUserPersona(userId: string, orgId: string): Promise<UserPersonaAssignment | null> {
    const [assignment] = await db
      .select()
      .from(userPersonaAssignments)
      .where(and(
        eq(userPersonaAssignments.userId, userId),
        eq(userPersonaAssignments.orgId, orgId)
      ))
      .limit(1);

    return assignment || null;
  }

  /**
   * Get all persona assignments for a user (across all orgs)
   */
  async getUserPersonas(userId: string): Promise<UserPersonaAssignment[]> {
    const assignments = await db
      .select()
      .from(userPersonaAssignments)
      .where(eq(userPersonaAssignments.userId, userId));

    return assignments;
  }

  /**
   * Assign or update a persona for a user
   */
  async assignPersona(
    userId: string,
    orgId: string,
    data: InsertUserPersonaAssignment
  ): Promise<UserPersonaAssignment> {
    // Check if assignment already exists
    const existing = await this.getUserPersona(userId, orgId);

    if (existing) {
      // Update existing assignment
      const [updated] = await db
        .update(userPersonaAssignments)
        .set({
          ...data,
          userId,
          orgId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(userPersonaAssignments.userId, userId),
          eq(userPersonaAssignments.orgId, orgId)
        ))
        .returning();

      return updated;
    } else {
      // Create new assignment
      const [created] = await db
        .insert(userPersonaAssignments)
        .values({
          ...data,
          userId,
          orgId,
        })
        .returning();

      return created;
    }
  }

  /**
   * Update persona assignment
   */
  async updatePersona(
    userId: string,
    orgId: string,
    data: UpdateUserPersonaAssignment
  ): Promise<UserPersonaAssignment | null> {
    const [updated] = await db
      .update(userPersonaAssignments)
      .set({
        ...data,
        userId,
        orgId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userPersonaAssignments.userId, userId),
        eq(userPersonaAssignments.orgId, orgId)
      ))
      .returning();

    return updated || null;
  }

  /**
   * Delete persona assignment
   */
  async deletePersona(userId: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(userPersonaAssignments)
      .where(and(
        eq(userPersonaAssignments.userId, userId),
        eq(userPersonaAssignments.orgId, orgId)
      ));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ================================================================================
  // FEATURE ACCESS & PERMISSIONS
  // ================================================================================

  /**
   * Get all feature flags for a persona type
   */
  async getPersonaFeatures(personaType: string): Promise<PersonaFeatureFlag[]> {
    const features = await db
      .select()
      .from(personaFeatureFlags)
      .where(and(
        eq(personaFeatureFlags.personaType, personaType as any),
        eq(personaFeatureFlags.enabled, true)
      ));

    return features;
  }

  /**
   * Get all features accessible to a user (primary + secondary persona + overrides)
   */
  async getUserFeatures(userId: string, orgId: string): Promise<string[]> {
    const assignment = await this.getUserPersona(userId, orgId);
    
    if (!assignment) {
      return [];
    }

    // Get features for primary persona
    const primaryFeatures = await this.getPersonaFeatures(assignment.primaryPersona);
    const featureKeys = new Set(primaryFeatures.map(f => f.featureKey));

    // Get features for secondary persona (if exists)
    if (assignment.secondaryPersona) {
      const secondaryFeatures = await this.getPersonaFeatures(assignment.secondaryPersona);
      secondaryFeatures.forEach(f => featureKeys.add(f.featureKey));
    }

    // Apply user-specific overrides
    const overrides = assignment.featureOverrides as Record<string, boolean> || {};
    Object.entries(overrides).forEach(([feature, enabled]) => {
      if (enabled) {
        featureKeys.add(feature);
      } else {
        featureKeys.delete(feature);
      }
    });

    return Array.from(featureKeys);
  }

  /**
   * Check if a user has access to a specific feature
   */
  async checkPermission(userId: string, orgId: string, featureKey: string): Promise<boolean> {
    const features = await this.getUserFeatures(userId, orgId);
    return features.includes(featureKey);
  }

  /**
   * Check if a user has any of the specified features
   */
  async checkAnyPermission(userId: string, orgId: string, featureKeys: string[]): Promise<boolean> {
    const features = await this.getUserFeatures(userId, orgId);
    return featureKeys.some(key => features.includes(key));
  }

  /**
   * Check if a user has all of the specified features
   */
  async checkAllPermissions(userId: string, orgId: string, featureKeys: string[]): Promise<boolean> {
    const features = await this.getUserFeatures(userId, orgId);
    return featureKeys.every(key => features.includes(key));
  }

  // ================================================================================
  // PERSONA FEATURE FLAGS MANAGEMENT
  // ================================================================================

  /**
   * Get all feature flags
   */
  async getAllFeatureFlags(): Promise<PersonaFeatureFlag[]> {
    const flags = await db
      .select()
      .from(personaFeatureFlags);

    return flags;
  }

  /**
   * Create a feature flag
   */
  async createFeatureFlag(data: {
    personaType: string;
    featureKey: string;
    description?: string;
    enabled?: boolean;
  }): Promise<PersonaFeatureFlag> {
    const [flag] = await db
      .insert(personaFeatureFlags)
      .values(data as any)
      .returning();

    return flag;
  }

  /**
   * Update a feature flag
   */
  async updateFeatureFlag(id: string, data: { enabled?: boolean; description?: string }): Promise<PersonaFeatureFlag | null> {
    const [flag] = await db
      .update(personaFeatureFlags)
      .set(data)
      .where(eq(personaFeatureFlags.id, id))
      .returning();

    return flag || null;
  }

  /**
   * Delete a feature flag
   */
  async deleteFeatureFlag(id: string): Promise<boolean> {
    const result = await db
      .delete(personaFeatureFlags)
      .where(eq(personaFeatureFlags.id, id));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ================================================================================
  // HELPER METHODS
  // ================================================================================

  /**
   * Get persona assignment with user details
   */
  async getUserPersonaWithDetails(userId: string, orgId: string) {
    const [result] = await db
      .select({
        assignment: userPersonaAssignments,
        user: users,
      })
      .from(userPersonaAssignments)
      .leftJoin(users, eq(userPersonaAssignments.userId, users.id))
      .where(and(
        eq(userPersonaAssignments.userId, userId),
        eq(userPersonaAssignments.orgId, orgId)
      ))
      .limit(1);

    return result || null;
  }

  /**
   * Get all persona assignments for an organization
   */
  async getOrgPersonaAssignments(orgId: string) {
    const assignments = await db
      .select({
        assignment: userPersonaAssignments,
        user: users,
      })
      .from(userPersonaAssignments)
      .leftJoin(users, eq(userPersonaAssignments.userId, users.id))
      .where(eq(userPersonaAssignments.orgId, orgId));

    return assignments;
  }
}

export const personaService = new PersonaService();
