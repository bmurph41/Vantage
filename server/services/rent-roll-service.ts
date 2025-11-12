import { db } from '../db';
import { rentRolls, rentRollEntries, projects } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { 
  RentRoll, 
  InsertRentRoll, 
  UpdateRentRoll,
  RentRollEntry,
  InsertRentRollEntry,
  UpdateRentRollEntry
} from '@shared/schema';

export class RentRollService {
  /**
   * Get all rent rolls for an organization
   */
  async getRentRolls(orgId: string, context?: 'operational' | 'valuation'): Promise<RentRoll[]> {
    const conditions = context
      ? and(eq(rentRolls.orgId, orgId), eq(rentRolls.context, context))
      : eq(rentRolls.orgId, orgId);

    const rolls = await db
      .select()
      .from(rentRolls)
      .where(conditions)
      .orderBy(desc(rentRolls.effectiveDate));

    return rolls;
  }

  /**
   * Get a single rent roll by ID
   */
  async getRentRollById(id: string, orgId: string): Promise<RentRoll | null> {
    const [roll] = await db
      .select()
      .from(rentRolls)
      .where(and(eq(rentRolls.id, id), eq(rentRolls.orgId, orgId)))
      .limit(1);

    return roll || null;
  }

  /**
   * Create a new rent roll
   */
  async createRentRoll(orgId: string, data: InsertRentRoll): Promise<RentRoll> {
    // Validate project ownership if projectId is provided
    if (data.projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
        .limit(1);

      if (!project) {
        throw new Error('Project not found or does not belong to your organization');
      }
    }

    const [roll] = await db
      .insert(rentRolls)
      .values({
        ...data,
        orgId,
      })
      .returning();

    return roll;
  }

  /**
   * Update a rent roll
   */
  async updateRentRoll(id: string, orgId: string, data: UpdateRentRoll): Promise<RentRoll | null> {
    // Validate project ownership if projectId is being updated
    if (data.projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, data.projectId), eq(projects.orgId, orgId)))
        .limit(1);

      if (!project) {
        throw new Error('Project not found or does not belong to your organization');
      }
    }

    const [roll] = await db
      .update(rentRolls)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(rentRolls.id, id), eq(rentRolls.orgId, orgId)))
      .returning();

    return roll || null;
  }

  /**
   * Delete a rent roll (cascades to entries)
   */
  async deleteRentRoll(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(rentRolls)
      .where(and(eq(rentRolls.id, id), eq(rentRolls.orgId, orgId)));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get all entries for a rent roll
   */
  async getRentRollEntries(rentRollId: string, orgId: string): Promise<RentRollEntry[]> {
    const entries = await db
      .select()
      .from(rentRollEntries)
      .where(and(eq(rentRollEntries.rentRollId, rentRollId), eq(rentRollEntries.orgId, orgId)))
      .orderBy(rentRollEntries.unitNumber);

    return entries;
  }

  /**
   * Get a single rent roll entry by ID
   */
  async getRentRollEntryById(id: string, orgId: string): Promise<RentRollEntry | null> {
    const [entry] = await db
      .select()
      .from(rentRollEntries)
      .where(and(eq(rentRollEntries.id, id), eq(rentRollEntries.orgId, orgId)))
      .limit(1);

    return entry || null;
  }

  /**
   * Create a new rent roll entry
   */
  async createRentRollEntry(orgId: string, data: InsertRentRollEntry): Promise<RentRollEntry> {
    // Validate parent rent roll ownership
    const parentRoll = await this.getRentRollById(data.rentRollId, orgId);
    if (!parentRoll) {
      throw new Error('Rent roll not found or does not belong to your organization');
    }

    const [entry] = await db
      .insert(rentRollEntries)
      .values({
        ...data,
        orgId,
        monthlyRate: String(data.monthlyRate),
      })
      .returning();

    return entry;
  }

  /**
   * Update a rent roll entry
   */
  async updateRentRollEntry(id: string, orgId: string, data: UpdateRentRollEntry): Promise<RentRollEntry | null> {
    // Validate entry ownership first
    const existingEntry = await this.getRentRollEntryById(id, orgId);
    if (!existingEntry) {
      throw new Error('Rent roll entry not found or does not belong to your organization');
    }

    // Validate current parent rent roll ownership
    const currentParentRoll = await this.getRentRollById(existingEntry.rentRollId, orgId);
    if (!currentParentRoll) {
      throw new Error('Current parent rent roll not found or does not belong to your organization');
    }

    // If rentRollId is being changed, validate the new parent rent roll ownership
    if (data.rentRollId && data.rentRollId !== existingEntry.rentRollId) {
      const newParentRoll = await this.getRentRollById(data.rentRollId, orgId);
      if (!newParentRoll) {
        throw new Error('New parent rent roll not found or does not belong to your organization');
      }
    }

    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.monthlyRate !== undefined) {
      updateData.monthlyRate = String(data.monthlyRate);
    }

    const [entry] = await db
      .update(rentRollEntries)
      .set(updateData)
      .where(and(eq(rentRollEntries.id, id), eq(rentRollEntries.orgId, orgId)))
      .returning();

    return entry || null;
  }

  /**
   * Delete a rent roll entry
   */
  async deleteRentRollEntry(id: string, orgId: string): Promise<boolean> {
    // Validate entry ownership first
    const existingEntry = await this.getRentRollEntryById(id, orgId);
    if (!existingEntry) {
      return false;
    }

    // Validate parent rent roll ownership
    const parentRoll = await this.getRentRollById(existingEntry.rentRollId, orgId);
    if (!parentRoll) {
      throw new Error('Parent rent roll not found or does not belong to your organization');
    }

    const result = await db
      .delete(rentRollEntries)
      .where(and(eq(rentRollEntries.id, id), eq(rentRollEntries.orgId, orgId)));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Get rent roll summary statistics
   */
  async getRentRollSummary(rentRollId: string, orgId: string): Promise<{
    totalUnits: number;
    occupiedUnits: number;
    occupancyRate: number;
    totalMonthlyRevenue: number;
    avgMonthlyRate: number;
    byType: Record<string, { count: number; revenue: number }>;
  }> {
    const entries = await this.getRentRollEntries(rentRollId, orgId);

    const totalUnits = entries.length;
    const occupiedUnits = entries.filter(e => e.status === 'active').length;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    const totalMonthlyRevenue = entries.reduce((sum, e) => 
      sum + (e.status === 'active' ? Number(e.monthlyRate) : 0), 0
    );
    const avgMonthlyRate = occupiedUnits > 0 ? totalMonthlyRevenue / occupiedUnits : 0;

    const byType: Record<string, { count: number; revenue: number }> = {};
    entries.forEach(entry => {
      if (!byType[entry.entryType]) {
        byType[entry.entryType] = { count: 0, revenue: 0 };
      }
      byType[entry.entryType].count++;
      if (entry.status === 'active') {
        byType[entry.entryType].revenue += Number(entry.monthlyRate);
      }
    });

    return {
      totalUnits,
      occupiedUnits,
      occupancyRate,
      totalMonthlyRevenue,
      avgMonthlyRate,
      byType,
    };
  }
}

export const rentRollService = new RentRollService();
