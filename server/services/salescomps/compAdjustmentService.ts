import { db } from "../../db";
import { scCompAdjustments, salesComps, crmProperties } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface AdjustmentInput {
  timeAdjustment?: number;
  locationAdjustment?: number;
  sizeAdjustment?: number;
  conditionAdjustment?: number;
  amenitiesAdjustment?: number;
  marketAdjustment?: number;
  customAdjustment?: number;
  notes?: string;
  adjustmentDetails?: {
    timeNotes?: string;
    locationNotes?: string;
    sizeNotes?: string;
    conditionNotes?: string;
    amenitiesNotes?: string;
    marketNotes?: string;
    customNotes?: string;
  };
  compWeight?: number;
}

export interface AdjustmentResult {
  originalPrice: number;
  adjustedPrice: number;
  netAdjustmentPercent: number;
  grossAdjustmentPercent: number;
  adjustedCapRate: number | null;
  breakdown: {
    time: { percent: number; amount: number };
    location: { percent: number; amount: number };
    size: { percent: number; amount: number };
    condition: { percent: number; amount: number };
    amenities: { percent: number; amount: number };
    market: { percent: number; amount: number };
    custom: { percent: number; amount: number };
  };
}

export interface ComparisonGrid {
  targetProperty: {
    id: string;
    name: string;
    city: string;
    state: string;
    wetSlips?: number;
    dryRacks?: number;
  };
  comparables: Array<{
    comp: typeof salesComps.$inferSelect;
    adjustment: AdjustmentResult;
    weight: number;
    adjustmentId?: string;
  }>;
  weightedAveragePrice: number;
  weightedAverageCapRate: number | null;
  recommendedValueRange: { low: number; high: number };
}

const TIME_ADJUSTMENT_RATE = 0.005; // 0.5% per month appreciation
const LOCATION_MULTIPLIERS: Record<string, number> = {
  'FL': 1.1,
  'CA': 1.15,
  'TX': 1.0,
  'NY': 1.05,
  'NC': 0.95,
  'SC': 0.95,
  'MD': 1.0,
  'VA': 0.98,
  'NJ': 1.05,
  'MA': 1.08,
};

export class CompAdjustmentService {

  calculateAdjustment(
    comp: typeof salesComps.$inferSelect,
    adjustments: AdjustmentInput,
    targetDate?: Date
  ): AdjustmentResult {
    const originalPrice = comp.salePrice || 0;
    
    let timeAdj = adjustments.timeAdjustment || 0;
    if (!adjustments.timeAdjustment && comp.saleYear && comp.saleMonth && targetDate) {
      timeAdj = this.calculateTimeAdjustment(comp.saleYear, comp.saleMonth, targetDate);
    }

    const locationAdj = adjustments.locationAdjustment || 0;
    const sizeAdj = adjustments.sizeAdjustment || 0;
    const conditionAdj = adjustments.conditionAdjustment || 0;
    const amenitiesAdj = adjustments.amenitiesAdjustment || 0;
    const marketAdj = adjustments.marketAdjustment || 0;
    const customAdj = adjustments.customAdjustment || 0;

    const netAdjustmentPercent = timeAdj + locationAdj + sizeAdj + conditionAdj + amenitiesAdj + marketAdj + customAdj;
    const grossAdjustmentPercent = Math.abs(timeAdj) + Math.abs(locationAdj) + Math.abs(sizeAdj) + 
      Math.abs(conditionAdj) + Math.abs(amenitiesAdj) + Math.abs(marketAdj) + Math.abs(customAdj);

    const adjustedPrice = Math.round(originalPrice * (1 + netAdjustmentPercent / 100));

    let adjustedCapRate: number | null = null;
    if (comp.capRate && comp.noi && adjustedPrice > 0) {
      adjustedCapRate = Math.round((comp.noi / adjustedPrice) * 10000);
    }

    return {
      originalPrice,
      adjustedPrice,
      netAdjustmentPercent,
      grossAdjustmentPercent,
      adjustedCapRate,
      breakdown: {
        time: { percent: timeAdj, amount: Math.round(originalPrice * timeAdj / 100) },
        location: { percent: locationAdj, amount: Math.round(originalPrice * locationAdj / 100) },
        size: { percent: sizeAdj, amount: Math.round(originalPrice * sizeAdj / 100) },
        condition: { percent: conditionAdj, amount: Math.round(originalPrice * conditionAdj / 100) },
        amenities: { percent: amenitiesAdj, amount: Math.round(originalPrice * amenitiesAdj / 100) },
        market: { percent: marketAdj, amount: Math.round(originalPrice * marketAdj / 100) },
        custom: { percent: customAdj, amount: Math.round(originalPrice * customAdj / 100) },
      },
    };
  }

  calculateTimeAdjustment(saleYear: number, saleMonth: number, targetDate: Date): number {
    const saleDate = new Date(saleYear, saleMonth - 1, 15);
    const monthsDiff = (targetDate.getFullYear() - saleDate.getFullYear()) * 12 + 
      (targetDate.getMonth() - saleDate.getMonth());
    
    return Math.round(monthsDiff * TIME_ADJUSTMENT_RATE * 100 * 100) / 100;
  }

  suggestLocationAdjustment(
    compState: string,
    targetState: string
  ): number {
    const compMultiplier = LOCATION_MULTIPLIERS[compState] || 1.0;
    const targetMultiplier = LOCATION_MULTIPLIERS[targetState] || 1.0;
    
    const adjustment = ((targetMultiplier / compMultiplier) - 1) * 100;
    return Math.round(adjustment * 100) / 100;
  }

  suggestSizeAdjustment(
    compUnits: number,
    targetUnits: number
  ): number {
    if (compUnits <= 0 || targetUnits <= 0) return 0;
    
    const sizeRatio = targetUnits / compUnits;
    
    if (sizeRatio >= 0.9 && sizeRatio <= 1.1) return 0;
    
    const adjustment = (sizeRatio - 1) * 50 * -1;
    return Math.min(Math.max(adjustment, -20), 20);
  }

  async saveAdjustment(
    orgId: string,
    userId: string,
    compId: string,
    adjustments: AdjustmentInput,
    targetPropertyId?: string,
    projectId?: string
  ): Promise<string> {
    const [comp] = await db.select()
      .from(salesComps)
      .where(eq(salesComps.id, compId))
      .limit(1);

    if (!comp) {
      throw new Error('Comp not found');
    }

    const result = this.calculateAdjustment(comp, adjustments, new Date());

    const existing = await db.select()
      .from(scCompAdjustments)
      .where(and(
        eq(scCompAdjustments.orgId, orgId),
        eq(scCompAdjustments.compId, compId),
        targetPropertyId ? eq(scCompAdjustments.targetPropertyId, targetPropertyId) : undefined
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(scCompAdjustments)
        .set({
          timeAdjustment: adjustments.timeAdjustment?.toString() || null,
          locationAdjustment: adjustments.locationAdjustment?.toString() || null,
          sizeAdjustment: adjustments.sizeAdjustment?.toString() || null,
          conditionAdjustment: adjustments.conditionAdjustment?.toString() || null,
          amenitiesAdjustment: adjustments.amenitiesAdjustment?.toString() || null,
          marketAdjustment: adjustments.marketAdjustment?.toString() || null,
          customAdjustment: adjustments.customAdjustment?.toString() || null,
          grossAdjustment: result.grossAdjustmentPercent.toString(),
          netAdjustment: result.netAdjustmentPercent.toString(),
          adjustedPrice: result.adjustedPrice,
          adjustedCapRate: result.adjustedCapRate?.toString() || null,
          notes: adjustments.notes,
          adjustmentDetails: adjustments.adjustmentDetails || {},
          compWeight: adjustments.compWeight?.toString() || '1',
          updatedAt: new Date(),
        })
        .where(eq(scCompAdjustments.id, existing[0].id));

      return existing[0].id;
    }

    const [record] = await db.insert(scCompAdjustments)
      .values({
        orgId,
        createdBy: userId,
        compId,
        targetPropertyId,
        projectId,
        timeAdjustment: adjustments.timeAdjustment?.toString() || null,
        locationAdjustment: adjustments.locationAdjustment?.toString() || null,
        sizeAdjustment: adjustments.sizeAdjustment?.toString() || null,
        conditionAdjustment: adjustments.conditionAdjustment?.toString() || null,
        amenitiesAdjustment: adjustments.amenitiesAdjustment?.toString() || null,
        marketAdjustment: adjustments.marketAdjustment?.toString() || null,
        customAdjustment: adjustments.customAdjustment?.toString() || null,
        grossAdjustment: result.grossAdjustmentPercent.toString(),
        netAdjustment: result.netAdjustmentPercent.toString(),
        adjustedPrice: result.adjustedPrice,
        adjustedCapRate: result.adjustedCapRate?.toString() || null,
        notes: adjustments.notes,
        adjustmentDetails: adjustments.adjustmentDetails || {},
        compWeight: adjustments.compWeight?.toString() || '1',
      })
      .returning();

    return record.id;
  }

  async getAdjustment(
    orgId: string,
    compId: string,
    targetPropertyId?: string
  ): Promise<typeof scCompAdjustments.$inferSelect | null> {
    const conditions = [
      eq(scCompAdjustments.orgId, orgId),
      eq(scCompAdjustments.compId, compId),
    ];

    if (targetPropertyId) {
      conditions.push(eq(scCompAdjustments.targetPropertyId, targetPropertyId));
    }

    const [adjustment] = await db.select()
      .from(scCompAdjustments)
      .where(and(...conditions))
      .limit(1);

    return adjustment || null;
  }

  async buildComparisonGrid(
    orgId: string,
    targetPropertyId: string,
    compIds: string[],
    userId: string
  ): Promise<ComparisonGrid> {
    const [targetProperty] = await db.select()
      .from(crmProperties)
      .where(eq(crmProperties.id, targetPropertyId))
      .limit(1);

    if (!targetProperty) {
      throw new Error('Target property not found');
    }

    const comps = await db.select()
      .from(salesComps)
      .where(and(
        eq(salesComps.orgId, orgId)
      ));

    const selectedComps = comps.filter(c => compIds.includes(c.id));

    const comparables: ComparisonGrid['comparables'] = [];
    let totalWeight = 0;
    let weightedPriceSum = 0;
    let weightedCapRateSum = 0;
    let capRateCount = 0;

    for (const comp of selectedComps) {
      const existingAdjustment = await this.getAdjustment(orgId, comp.id, targetPropertyId);

      let adjustmentInput: AdjustmentInput = {
        compWeight: 1,
      };

      if (existingAdjustment) {
        adjustmentInput = {
          timeAdjustment: existingAdjustment.timeAdjustment ? parseFloat(existingAdjustment.timeAdjustment) : undefined,
          locationAdjustment: existingAdjustment.locationAdjustment ? parseFloat(existingAdjustment.locationAdjustment) : undefined,
          sizeAdjustment: existingAdjustment.sizeAdjustment ? parseFloat(existingAdjustment.sizeAdjustment) : undefined,
          conditionAdjustment: existingAdjustment.conditionAdjustment ? parseFloat(existingAdjustment.conditionAdjustment) : undefined,
          amenitiesAdjustment: existingAdjustment.amenitiesAdjustment ? parseFloat(existingAdjustment.amenitiesAdjustment) : undefined,
          marketAdjustment: existingAdjustment.marketAdjustment ? parseFloat(existingAdjustment.marketAdjustment) : undefined,
          customAdjustment: existingAdjustment.customAdjustment ? parseFloat(existingAdjustment.customAdjustment) : undefined,
          compWeight: existingAdjustment.compWeight ? parseFloat(existingAdjustment.compWeight) : 1,
        };
      } else {
        adjustmentInput.timeAdjustment = comp.saleYear && comp.saleMonth 
          ? this.calculateTimeAdjustment(comp.saleYear, comp.saleMonth, new Date())
          : 0;
        
        if (comp.state && targetProperty.state) {
          adjustmentInput.locationAdjustment = this.suggestLocationAdjustment(
            comp.state,
            targetProperty.state
          );
        }
      }

      const adjustmentResult = this.calculateAdjustment(comp, adjustmentInput, new Date());
      const weight = adjustmentInput.compWeight || 1;

      comparables.push({
        comp,
        adjustment: adjustmentResult,
        weight,
        adjustmentId: existingAdjustment?.id,
      });

      totalWeight += weight;
      weightedPriceSum += adjustmentResult.adjustedPrice * weight;
      
      if (adjustmentResult.adjustedCapRate) {
        weightedCapRateSum += adjustmentResult.adjustedCapRate * weight;
        capRateCount += weight;
      }
    }

    const weightedAveragePrice = totalWeight > 0 ? Math.round(weightedPriceSum / totalWeight) : 0;
    const weightedAverageCapRate = capRateCount > 0 ? Math.round(weightedCapRateSum / capRateCount) : null;

    const adjustedPrices = comparables.map(c => c.adjustment.adjustedPrice).sort((a, b) => a - b);
    const low = adjustedPrices.length > 0 ? adjustedPrices[0] : 0;
    const high = adjustedPrices.length > 0 ? adjustedPrices[adjustedPrices.length - 1] : 0;

    return {
      targetProperty: {
        id: targetProperty.id,
        name: targetProperty.name,
        city: targetProperty.city || '',
        state: targetProperty.state || '',
        wetSlips: targetProperty.wetSlips || undefined,
        dryRacks: targetProperty.drySlips || undefined,
      },
      comparables,
      weightedAveragePrice,
      weightedAverageCapRate,
      recommendedValueRange: { low, high },
    };
  }

  async getProjectAdjustments(
    orgId: string,
    projectId: string
  ): Promise<Array<typeof scCompAdjustments.$inferSelect>> {
    return db.select()
      .from(scCompAdjustments)
      .where(and(
        eq(scCompAdjustments.orgId, orgId),
        eq(scCompAdjustments.projectId, projectId)
      ))
      .orderBy(desc(scCompAdjustments.createdAt));
  }

  async deleteAdjustment(
    orgId: string,
    adjustmentId: string
  ): Promise<boolean> {
    const result = await db.delete(scCompAdjustments)
      .where(and(
        eq(scCompAdjustments.orgId, orgId),
        eq(scCompAdjustments.id, adjustmentId)
      ));

    return true;
  }
}

export const compAdjustmentService = new CompAdjustmentService();
