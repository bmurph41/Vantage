/**
 * Seasonality Profile Service
 * 
 * Manages monthly seasonality multipliers for marina properties.
 * Default "Marina Standard" profile is auto-attached to marina projects.
 */

import { db } from '../db';
import { 
  seasonalityProfiles,
  seasonalityProfileMonths,
  modelingProjectConfig
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// ============================================
// TYPES
// ============================================

export interface SeasonalityMonth {
  month: number;  // 1-12
  occupancyMultiplier: number;
  rateMultiplier: number;
  revenueMultiplier: number;
}

export interface SeasonalityProfileData {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isSystem: boolean;
  months: SeasonalityMonth[];
  createdAt: Date;
  updatedAt: Date;
}

// Default Marina Standard seasonality (peak summer)
export const MARINA_STANDARD_SEASONALITY: SeasonalityMonth[] = [
  { month: 1,  occupancyMultiplier: 0.45, rateMultiplier: 0.85, revenueMultiplier: 0.40 },
  { month: 2,  occupancyMultiplier: 0.50, rateMultiplier: 0.85, revenueMultiplier: 0.45 },
  { month: 3,  occupancyMultiplier: 0.60, rateMultiplier: 0.90, revenueMultiplier: 0.55 },
  { month: 4,  occupancyMultiplier: 0.75, rateMultiplier: 0.95, revenueMultiplier: 0.72 },
  { month: 5,  occupancyMultiplier: 0.90, rateMultiplier: 1.00, revenueMultiplier: 0.90 },
  { month: 6,  occupancyMultiplier: 0.98, rateMultiplier: 1.05, revenueMultiplier: 1.03 },
  { month: 7,  occupancyMultiplier: 1.00, rateMultiplier: 1.10, revenueMultiplier: 1.10 },
  { month: 8,  occupancyMultiplier: 1.00, rateMultiplier: 1.10, revenueMultiplier: 1.10 },
  { month: 9,  occupancyMultiplier: 0.85, rateMultiplier: 1.00, revenueMultiplier: 0.85 },
  { month: 10, occupancyMultiplier: 0.70, rateMultiplier: 0.95, revenueMultiplier: 0.67 },
  { month: 11, occupancyMultiplier: 0.55, rateMultiplier: 0.90, revenueMultiplier: 0.50 },
  { month: 12, occupancyMultiplier: 0.48, rateMultiplier: 0.85, revenueMultiplier: 0.42 },
];

// Flat (no seasonality) profile
export const FLAT_SEASONALITY: SeasonalityMonth[] = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  occupancyMultiplier: 1.0,
  rateMultiplier: 1.0,
  revenueMultiplier: 1.0,
}));

// ============================================
// SERVICE CLASS
// ============================================

export class SeasonalityProfileService {
  
  /**
   * Get all seasonality profiles for an organization.
   */
  async getProfiles(orgId: string): Promise<SeasonalityProfileData[]> {
    const profiles = await db.select()
      .from(seasonalityProfiles)
      .where(eq(seasonalityProfiles.orgId, orgId));
    
    const result: SeasonalityProfileData[] = [];
    
    for (const profile of profiles) {
      const months = await db.select()
        .from(seasonalityProfileMonths)
        .where(eq(seasonalityProfileMonths.profileId, profile.id));
      
      result.push({
        id: profile.id,
        orgId: profile.orgId,
        name: profile.name,
        description: profile.description || undefined,
        isDefault: profile.isDefault || false,
        isSystem: profile.isSystem || false,
        months: months.map(m => ({
          month: m.month,
          occupancyMultiplier: parseFloat(m.occupancyMultiplier?.toString() || '1'),
          rateMultiplier: parseFloat(m.rateMultiplier?.toString() || '1'),
          revenueMultiplier: parseFloat(m.revenueMultiplier?.toString() || '1'),
        })).sort((a, b) => a.month - b.month),
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      });
    }
    
    return result;
  }

  /**
   * Get a specific profile by ID.
   */
  async getProfile(profileId: string, orgId: string): Promise<SeasonalityProfileData | null> {
    const [profile] = await db.select()
      .from(seasonalityProfiles)
      .where(and(
        eq(seasonalityProfiles.id, profileId),
        eq(seasonalityProfiles.orgId, orgId)
      ))
      .limit(1);
    
    if (!profile) return null;
    
    const months = await db.select()
      .from(seasonalityProfileMonths)
      .where(eq(seasonalityProfileMonths.profileId, profileId));
    
    return {
      id: profile.id,
      orgId: profile.orgId,
      name: profile.name,
      description: profile.description || undefined,
      isDefault: profile.isDefault || false,
      isSystem: profile.isSystem || false,
      months: months.map(m => ({
        month: m.month,
        occupancyMultiplier: parseFloat(m.occupancyMultiplier?.toString() || '1'),
        rateMultiplier: parseFloat(m.rateMultiplier?.toString() || '1'),
        revenueMultiplier: parseFloat(m.revenueMultiplier?.toString() || '1'),
      })).sort((a, b) => a.month - b.month),
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Create a new seasonality profile.
   */
  async createProfile(
    orgId: string,
    name: string,
    months: SeasonalityMonth[],
    options?: { description?: string; isDefault?: boolean }
  ): Promise<SeasonalityProfileData> {
    // If setting as default, unset other defaults
    if (options?.isDefault) {
      await db.update(seasonalityProfiles)
        .set({ isDefault: false })
        .where(eq(seasonalityProfiles.orgId, orgId));
    }
    
    const [profile] = await db.insert(seasonalityProfiles)
      .values({
        orgId,
        name,
        description: options?.description,
        isDefault: options?.isDefault || false,
        isSystem: false,
      })
      .returning();
    
    // Insert months
    for (const month of months) {
      await db.insert(seasonalityProfileMonths).values({
        profileId: profile.id,
        month: month.month,
        occupancyMultiplier: month.occupancyMultiplier.toString(),
        rateMultiplier: month.rateMultiplier.toString(),
        revenueMultiplier: month.revenueMultiplier.toString(),
      });
    }
    
    return this.getProfile(profile.id, orgId) as Promise<SeasonalityProfileData>;
  }

  /**
   * Update an existing profile.
   */
  async updateProfile(
    profileId: string,
    orgId: string,
    updates: {
      name?: string;
      description?: string;
      isDefault?: boolean;
      months?: SeasonalityMonth[];
    }
  ): Promise<SeasonalityProfileData | null> {
    const existing = await this.getProfile(profileId, orgId);
    if (!existing) return null;
    
    // Don't allow editing system profiles
    if (existing.isSystem) {
      throw new Error('Cannot modify system profiles');
    }
    
    // If setting as default, unset other defaults
    if (updates.isDefault) {
      await db.update(seasonalityProfiles)
        .set({ isDefault: false })
        .where(eq(seasonalityProfiles.orgId, orgId));
    }
    
    // Update profile
    await db.update(seasonalityProfiles)
      .set({
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description,
        isDefault: updates.isDefault ?? existing.isDefault,
      })
      .where(eq(seasonalityProfiles.id, profileId));
    
    // Update months if provided
    if (updates.months) {
      await db.delete(seasonalityProfileMonths)
        .where(eq(seasonalityProfileMonths.profileId, profileId));
      
      for (const month of updates.months) {
        await db.insert(seasonalityProfileMonths).values({
          profileId,
          month: month.month,
          occupancyMultiplier: month.occupancyMultiplier.toString(),
          rateMultiplier: month.rateMultiplier.toString(),
          revenueMultiplier: month.revenueMultiplier.toString(),
        });
      }
    }
    
    return this.getProfile(profileId, orgId);
  }

  /**
   * Delete a profile.
   */
  async deleteProfile(profileId: string, orgId: string): Promise<boolean> {
    const existing = await this.getProfile(profileId, orgId);
    if (!existing) return false;
    
    // Don't allow deleting system profiles
    if (existing.isSystem) {
      throw new Error('Cannot delete system profiles');
    }
    
    await db.delete(seasonalityProfiles)
      .where(and(
        eq(seasonalityProfiles.id, profileId),
        eq(seasonalityProfiles.orgId, orgId)
      ));
    
    return true;
  }

  /**
   * Ensure default "Marina Standard" profile exists for an org.
   * Called when creating a marina project.
   */
  async ensureDefaultProfile(orgId: string): Promise<SeasonalityProfileData> {
    const existing = await db.select()
      .from(seasonalityProfiles)
      .where(and(
        eq(seasonalityProfiles.orgId, orgId),
        eq(seasonalityProfiles.isDefault, true)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return this.getProfile(existing[0].id, orgId) as Promise<SeasonalityProfileData>;
    }
    
    // Create default Marina Standard profile
    return this.createProfile(
      orgId,
      'Marina Standard',
      MARINA_STANDARD_SEASONALITY,
      { 
        description: 'Default seasonality profile for marina properties with peak summer season',
        isDefault: true 
      }
    );
  }

  /**
   * Get the seasonality profile attached to a project.
   */
  async getProjectSeasonality(projectId: string, orgId: string): Promise<SeasonalityProfileData | null> {
    const [config] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);
    
    if (!config?.seasonalityProfileId) {
      // Return default profile if none attached
      const defaultProfile = await this.ensureDefaultProfile(orgId);
      return defaultProfile;
    }
    
    return this.getProfile(config.seasonalityProfileId, orgId);
  }

  /**
   * Attach a seasonality profile to a project.
   */
  async setProjectSeasonality(
    projectId: string,
    profileId: string,
    orgId: string
  ): Promise<void> {
    // Verify profile exists
    const profile = await this.getProfile(profileId, orgId);
    if (!profile) {
      throw new Error('Seasonality profile not found');
    }
    
    const [existing] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);
    
    if (existing) {
      await db.update(modelingProjectConfig)
        .set({ seasonalityProfileId: profileId })
        .where(eq(modelingProjectConfig.modelingProjectId, projectId));
    } else {
      await db.insert(modelingProjectConfig)
        .values({
          modelingProjectId: projectId,
          seasonalityProfileId: profileId,
        });
    }
  }

  /**
   * Get seasonality multipliers for a specific month.
   * Useful for pro forma calculations.
   */
  getMonthMultipliers(
    profile: SeasonalityProfileData,
    month: number
  ): { occupancy: number; rate: number; revenue: number } {
    const monthData = profile.months.find(m => m.month === month);
    if (!monthData) {
      return { occupancy: 1, rate: 1, revenue: 1 };
    }
    return {
      occupancy: monthData.occupancyMultiplier,
      rate: monthData.rateMultiplier,
      revenue: monthData.revenueMultiplier,
    };
  }
}

export const seasonalityProfileService = new SeasonalityProfileService();
