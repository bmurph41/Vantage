import { db } from '../../db';
import { salesComps } from '../../../shared/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { AnalyticsFilters } from './analyticsService';

export interface SimilarityScore {
  compId: string;
  targetCompId: string;
  overallScore: number; // 0-100
  confidence: 'high' | 'medium' | 'low';
  breakdown: {
    location: number; // 0-100
    financials: number; // 0-100
    physical: number; // 0-100
    timing: number; // 0-100
  };
  reasoning: string[];
  keyMatches: string[];
  keyDifferences: string[];
}

export interface SalesCompData {
  id: string;
  marina: string | null;
  state: string | null;
  city: string | null;
  region: string | null;
  coastalType: string | null;
  waterType: string | null;
  salePrice: string | null;
  pricePerSlip: string | null;
  capRate: string | null;
  slipCapacity: string | null;
  saleDate: Date | null;
  profitCenters: string[] | null;
  storageTypes: string[] | null;
  isPortfolio: boolean | null;
}

// Weighted scoring algorithm
const WEIGHTS = {
  location: 0.35,  // 35% - Geographic proximity and market similarity
  financials: 0.30, // 30% - Price, cap rate, revenue metrics
  physical: 0.25,   // 25% - Size, amenities, facilities
  timing: 0.10      // 10% - How recent the sale was
};

/**
 * Calculate similarity score between two marina sales comps
 */
export function calculateSimilarityScore(
  comp: SalesCompData,
  target: SalesCompData
): SimilarityScore {
  const breakdown = {
    location: calculateLocationScore(comp, target),
    financials: calculateFinancialScore(comp, target),
    physical: calculatePhysicalScore(comp, target),
    timing: calculateTimingScore(comp, target)
  };

  const overallScore = Math.round(
    breakdown.location * WEIGHTS.location +
    breakdown.financials * WEIGHTS.financials +
    breakdown.physical * WEIGHTS.physical +
    breakdown.timing * WEIGHTS.timing
  );

  const { reasoning, keyMatches, keyDifferences } = generateReasoning(comp, target, breakdown);
  const confidence = determineConfidence(overallScore, breakdown);

  return {
    compId: comp.id,
    targetCompId: target.id,
    overallScore,
    confidence,
    breakdown,
    reasoning,
    keyMatches,
    keyDifferences
  };
}

/**
 * Location similarity: state, region, coastal type, water type
 */
function calculateLocationScore(comp: SalesCompData, target: SalesCompData): number {
  let score = 0;
  let factors = 0;

  // Same state = 40 points
  if (comp.state && target.state) {
    factors++;
    if (comp.state === target.state) score += 40;
  }

  // Same region = 25 points
  if (comp.region && target.region) {
    factors++;
    if (comp.region === target.region) score += 25;
  }

  // Same coastal type = 20 points
  if (comp.coastalType && target.coastalType) {
    factors++;
    if (comp.coastalType === target.coastalType) score += 20;
  }

  // Same water type = 15 points
  if (comp.waterType && target.waterType) {
    factors++;
    if (comp.waterType === target.waterType) score += 15;
  }

  return factors > 0 ? Math.round((score / factors) * (100 / 100)) : 50;
}

/**
 * Financial similarity: price, price per slip, cap rate
 */
function calculateFinancialScore(comp: SalesCompData, target: SalesCompData): number {
  let score = 0;
  let factors = 0;

  // Price similarity (within 30% = 100, within 50% = 75, within 100% = 50)
  if (comp.salePrice && target.salePrice) {
    factors++;
    const compPrice = parseFloat(comp.salePrice);
    const targetPrice = parseFloat(target.salePrice);
    const priceDiff = Math.abs(compPrice - targetPrice) / targetPrice;
    
    if (priceDiff <= 0.3) score += 100;
    else if (priceDiff <= 0.5) score += 75;
    else if (priceDiff <= 1.0) score += 50;
    else score += 25;
  }

  // Price per slip similarity
  if (comp.pricePerSlip && target.pricePerSlip) {
    factors++;
    const compPPS = parseFloat(comp.pricePerSlip);
    const targetPPS = parseFloat(target.pricePerSlip);
    const ppsDiff = Math.abs(compPPS - targetPPS) / targetPPS;
    
    if (ppsDiff <= 0.2) score += 100;
    else if (ppsDiff <= 0.4) score += 75;
    else if (ppsDiff <= 0.8) score += 50;
    else score += 25;
  }

  // Cap rate similarity
  if (comp.capRate && target.capRate) {
    factors++;
    const compCap = parseFloat(comp.capRate);
    const targetCap = parseFloat(target.capRate);
    const capDiff = Math.abs(compCap - targetCap);
    
    if (capDiff <= 0.01) score += 100; // Within 1%
    else if (capDiff <= 0.02) score += 75; // Within 2%
    else if (capDiff <= 0.04) score += 50; // Within 4%
    else score += 25;
  }

  return factors > 0 ? Math.round(score / factors) : 50;
}

/**
 * Physical similarity: capacity, amenities, storage types
 */
function calculatePhysicalScore(comp: SalesCompData, target: SalesCompData): number {
  let score = 0;
  let factors = 0;

  // Capacity similarity
  if (comp.slipCapacity && target.slipCapacity) {
    factors++;
    const compCap = parseInt(comp.slipCapacity);
    const targetCap = parseInt(target.slipCapacity);
    const capDiff = Math.abs(compCap - targetCap) / targetCap;
    
    if (capDiff <= 0.2) score += 100;
    else if (capDiff <= 0.4) score += 75;
    else if (capDiff <= 0.8) score += 50;
    else score += 25;
  }

  // Profit centers overlap
  if (comp.profitCenters && target.profitCenters && comp.profitCenters.length > 0 && target.profitCenters.length > 0) {
    factors++;
    const overlap = comp.profitCenters.filter(pc => target.profitCenters?.includes(pc)).length;
    const union = new Set([...comp.profitCenters, ...target.profitCenters]).size;
    const jaccardIndex = overlap / union;
    score += Math.round(jaccardIndex * 100);
  }

  // Storage types overlap
  if (comp.storageTypes && target.storageTypes && comp.storageTypes.length > 0 && target.storageTypes.length > 0) {
    factors++;
    const overlap = comp.storageTypes.filter(st => target.storageTypes?.includes(st)).length;
    const union = new Set([...comp.storageTypes, ...target.storageTypes]).size;
    const jaccardIndex = overlap / union;
    score += Math.round(jaccardIndex * 100);
  }

  // Portfolio match
  if (comp.isPortfolio !== null && target.isPortfolio !== null) {
    factors++;
    if (comp.isPortfolio === target.isPortfolio) score += 100;
  }

  return factors > 0 ? Math.round(score / factors) : 50;
}

/**
 * Timing similarity: how recent the sale was
 */
function calculateTimingScore(comp: SalesCompData, target: SalesCompData): number {
  if (!comp.saleDate || !target.saleDate) return 50;

  const compDate = new Date(comp.saleDate);
  const targetDate = new Date(target.saleDate);
  const daysDiff = Math.abs(compDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Same year = 100
  if (daysDiff <= 365) return 100;
  // Within 2 years = 80
  if (daysDiff <= 730) return 80;
  // Within 3 years = 60
  if (daysDiff <= 1095) return 60;
  // Within 5 years = 40
  if (daysDiff <= 1825) return 40;
  // Older = 20
  return 20;
}

/**
 * Generate human-readable reasoning for the match
 */
function generateReasoning(
  comp: SalesCompData,
  target: SalesCompData,
  breakdown: SimilarityScore['breakdown']
): { reasoning: string[]; keyMatches: string[]; keyDifferences: string[] } {
  const reasoning: string[] = [];
  const keyMatches: string[] = [];
  const keyDifferences: string[] = [];

  // Location analysis
  if (comp.state === target.state) {
    keyMatches.push(`Both located in ${comp.state}`);
  } else if (comp.state && target.state) {
    keyDifferences.push(`Different states: ${comp.state} vs ${target.state}`);
  }

  if (comp.waterType === target.waterType && comp.waterType) {
    keyMatches.push(`Same water type: ${comp.waterType}`);
  } else if (comp.waterType && target.waterType) {
    keyDifferences.push(`Different water types: ${comp.waterType} vs ${target.waterType}`);
  }

  // Financial analysis
  if (comp.salePrice && target.salePrice) {
    const compPrice = parseFloat(comp.salePrice);
    const targetPrice = parseFloat(target.salePrice);
    const priceDiff = ((compPrice - targetPrice) / targetPrice) * 100;
    
    if (Math.abs(priceDiff) <= 30) {
      keyMatches.push(`Similar sale prices (${Math.abs(priceDiff).toFixed(1)}% difference)`);
    } else {
      keyDifferences.push(`Sale price ${priceDiff > 0 ? 'higher' : 'lower'} by ${Math.abs(priceDiff).toFixed(1)}%`);
    }
  }

  if (comp.pricePerSlip && target.pricePerSlip) {
    const compPPS = parseFloat(comp.pricePerSlip);
    const targetPPS = parseFloat(target.pricePerSlip);
    const ppsDiff = ((compPPS - targetPPS) / targetPPS) * 100;
    
    if (Math.abs(ppsDiff) <= 20) {
      keyMatches.push(`Comparable price per slip`);
    }
  }

  // Physical analysis
  if (comp.slipCapacity && target.slipCapacity) {
    const compCap = parseInt(comp.slipCapacity);
    const targetCap = parseInt(target.slipCapacity);
    const capDiff = ((compCap - targetCap) / targetCap) * 100;
    
    if (Math.abs(capDiff) <= 20) {
      keyMatches.push(`Similar capacity: ${compCap} vs ${targetCap} slips`);
    } else {
      keyDifferences.push(`Capacity ${capDiff > 0 ? 'larger' : 'smaller'} by ${Math.abs(capDiff).toFixed(0)}%`);
    }
  }

  // Generate overall reasoning
  if (breakdown.location >= 80) {
    reasoning.push('Strong geographic similarity - same market characteristics');
  } else if (breakdown.location >= 60) {
    reasoning.push('Moderate geographic similarity - comparable regional markets');
  }

  if (breakdown.financials >= 80) {
    reasoning.push('Excellent financial comparability - similar pricing metrics');
  } else if (breakdown.financials >= 60) {
    reasoning.push('Good financial alignment - within reasonable valuation range');
  }

  if (breakdown.physical >= 80) {
    reasoning.push('Highly comparable physical attributes and amenities');
  }

  if (breakdown.timing >= 80) {
    reasoning.push('Recent transaction - reflects current market conditions');
  }

  return { reasoning, keyMatches, keyDifferences };
}

/**
 * Determine confidence level based on score and data completeness
 */
function determineConfidence(
  overallScore: number,
  breakdown: SimilarityScore['breakdown']
): 'high' | 'medium' | 'low' {
  const avgBreakdown = (breakdown.location + breakdown.financials + breakdown.physical + breakdown.timing) / 4;
  const variance = Math.abs(avgBreakdown - overallScore);

  if (overallScore >= 75 && variance < 10) return 'high';
  if (overallScore >= 60 && variance < 15) return 'medium';
  return 'low';
}

/**
 * Find the most similar comps for a given target comp
 */
export async function findSimilarComps(
  orgId: string,
  targetCompId: string,
  limit: number = 10
): Promise<Array<SalesCompData & { similarityScore: SimilarityScore }>> {
  // Get target comp
  const targetComp = await db
    .select()
    .from(salesComps)
    .where(and(
      eq(salesComps.id, targetCompId),
      eq(salesComps.orgId, orgId),
      isNull(salesComps.deletedAt)
    ))
    .limit(1);

  if (targetComp.length === 0) {
    throw new Error('Target comp not found');
  }

  const target = targetComp[0];

  // Get all other comps
  const allComps = await db
    .select()
    .from(salesComps)
    .where(and(
      eq(salesComps.orgId, orgId),
      isNull(salesComps.deletedAt)
    ))
    .limit(500);

  // Calculate similarity scores
  const scoredComps = allComps
    .filter(comp => comp.id !== targetCompId)
    .map(comp => ({
      ...comp,
      similarityScore: calculateSimilarityScore(comp, target)
    }))
    .sort((a, b) => b.similarityScore.overallScore - a.similarityScore.overallScore)
    .slice(0, limit);

  return scoredComps;
}
