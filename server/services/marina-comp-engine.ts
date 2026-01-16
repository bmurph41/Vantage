import { db } from '../db';
import { 
  rateComps, 
  salesComps, 
  marinaSubjects, 
  compSets, 
  compSetItems,
  type MarinaSubject,
  type RateComp,
  type SalesComp,
  type CompSet,
  type CompSetItem,
  type ScoringConfig,
  type SlipMix,
  type MarinaCapabilities,
} from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

// Default scoring weights
const DEFAULT_WEIGHTS = {
  geo: 0.25,
  travelTime: 0.10,
  capacity: 0.20,
  slipMix: 0.15,
  capabilities: 0.20,
  condition: 0.10,
};

// Haversine distance calculation (miles)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Score geo distance (0-100) - closer = higher score
function scoreGeoDistance(distanceMiles: number, maxDistance: number = 100): number {
  if (distanceMiles >= maxDistance) return 0;
  return Math.round(100 * (1 - distanceMiles / maxDistance));
}

// Compute capacity index: slips + racks * 0.75
export function computeCapacityIndex(slips: number = 0, racks: number = 0): number {
  return slips + racks * 0.75;
}

// Score capacity similarity (0-100)
function scoreCapacity(subjectCapacity: number, compCapacity: number): number {
  if (subjectCapacity === 0 && compCapacity === 0) return 100;
  if (subjectCapacity === 0 || compCapacity === 0) return 0;
  
  const ratio = Math.min(subjectCapacity, compCapacity) / Math.max(subjectCapacity, compCapacity);
  return Math.round(100 * ratio);
}

// Score slip mix similarity using cosine similarity (0-100)
function scoreSlipMix(subjectMix: SlipMix | null, compMix: SlipMix | null): number {
  if (!subjectMix || !compMix) return 50; // Default score if no data
  
  const keys: (keyof SlipMix)[] = [
    'slips_under_30ft', 'slips_30_40ft', 'slips_40_50ft', 
    'slips_50_60ft', 'slips_over_60ft'
  ];
  
  const subjectVec = keys.map(k => subjectMix[k] ?? 0);
  const compVec = keys.map(k => compMix[k] ?? 0);
  
  // Cosine similarity
  let dotProduct = 0;
  let subjectMag = 0;
  let compMag = 0;
  
  for (let i = 0; i < keys.length; i++) {
    dotProduct += subjectVec[i] * compVec[i];
    subjectMag += subjectVec[i] * subjectVec[i];
    compMag += compVec[i] * compVec[i];
  }
  
  subjectMag = Math.sqrt(subjectMag);
  compMag = Math.sqrt(compMag);
  
  if (subjectMag === 0 || compMag === 0) return 50;
  
  const similarity = dotProduct / (subjectMag * compMag);
  return Math.round(100 * similarity);
}

// Score capabilities using Jaccard similarity (0-100)
function scoreCapabilities(
  subjectCaps: MarinaCapabilities | null, 
  compCaps: MarinaCapabilities | null
): number {
  if (!subjectCaps || !compCaps) return 50; // Default if no data
  
  const booleanKeys: (keyof MarinaCapabilities)[] = [
    'fuelDock', 'serviceYard', 'shipStore', 'brokerage', 
    'rentals', 'boatClub'
  ];
  
  let intersection = 0;
  let union = 0;
  
  for (const key of booleanKeys) {
    const subjectHas = !!subjectCaps[key];
    const compHas = !!compCaps[key];
    
    if (subjectHas || compHas) {
      union++;
      if (subjectHas && compHas) {
        intersection++;
      }
    }
  }
  
  if (union === 0) return 100; // Both have no capabilities = identical
  
  return Math.round(100 * (intersection / union));
}

// Score condition based on quality tier (0-100)
function scoreCondition(subjectTier: string | null, compTier: string | null): number {
  const tierValues: Record<string, number> = { 'A': 4, 'B': 3, 'C': 2, 'D': 1 };
  
  if (!subjectTier || !compTier) return 50; // Default if no data
  
  const subjectVal = tierValues[subjectTier] ?? 2.5;
  const compVal = tierValues[compTier] ?? 2.5;
  
  const diff = Math.abs(subjectVal - compVal);
  return Math.round(100 * (1 - diff / 3));
}

// Main similarity scoring function
export interface ScoringResult {
  similarityScore: number;
  geoScore: number;
  travelTimeScore: number;
  capacityScore: number;
  slipMixScore: number;
  capabilitiesScore: number;
  conditionScore: number;
  normalizedWeight: number;
}

export function computeSimilarityScore(
  subject: {
    lat: number | null;
    lng: number | null;
    slipsTotal: number | null;
    racksTotal: number | null;
    slipMix: SlipMix | null;
    capabilities: MarinaCapabilities | null;
    qualityTier?: string | null;
  },
  comp: {
    lat: number | null;
    lng: number | null;
    wetSlips: number | null;
    dryRacks: number | null;
    slipMix: SlipMix | Record<string, unknown> | null;
    capabilities: MarinaCapabilities | Record<string, unknown> | null;
    qualityTier?: string | null;
  },
  config: ScoringConfig = {}
): ScoringResult {
  const weights = config.weights || DEFAULT_WEIGHTS;
  
  // Calculate individual scores
  let geoScore = 50;
  if (subject.lat && subject.lng && comp.lat && comp.lng) {
    const distance = haversineDistance(
      Number(subject.lat), 
      Number(subject.lng), 
      Number(comp.lat), 
      Number(comp.lng)
    );
    geoScore = scoreGeoDistance(distance);
  }
  
  const travelTimeScore = 50; // Would require Google Distance Matrix API
  
  const subjectCapacity = computeCapacityIndex(
    subject.slipsTotal ?? 0, 
    subject.racksTotal ?? 0
  );
  const compCapacity = computeCapacityIndex(
    comp.wetSlips ?? 0, 
    comp.dryRacks ?? 0
  );
  const capacityScore = scoreCapacity(subjectCapacity, compCapacity);
  
  const slipMixScore = scoreSlipMix(
    subject.slipMix, 
    comp.slipMix as SlipMix | null
  );
  
  const capabilitiesScore = scoreCapabilities(
    subject.capabilities, 
    comp.capabilities as MarinaCapabilities | null
  );
  
  const conditionScore = scoreCondition(
    subject.qualityTier ?? null, 
    comp.qualityTier ?? null
  );
  
  // Compute weighted similarity score
  const useTravelTime = config.useTravelTime ?? false;
  
  let totalWeight = weights.geo + weights.capacity + weights.slipMix + 
                    weights.capabilities + weights.condition;
  if (useTravelTime) {
    totalWeight += weights.travelTime;
  }
  
  let weightedSum = 
    geoScore * weights.geo +
    capacityScore * weights.capacity +
    slipMixScore * weights.slipMix +
    capabilitiesScore * weights.capabilities +
    conditionScore * weights.condition;
  
  if (useTravelTime) {
    weightedSum += travelTimeScore * weights.travelTime;
  }
  
  const similarityScore = Math.round(weightedSum / totalWeight);
  
  return {
    similarityScore,
    geoScore,
    travelTimeScore,
    capacityScore,
    slipMixScore,
    capabilitiesScore,
    conditionScore,
    normalizedWeight: 0, // Will be computed after all comps are scored
  };
}

// Normalize weights across all comps in a set (higher similarity = higher weight)
export function normalizeWeights(
  items: Array<{ similarityScore: number; included: boolean; manualWeightOverride?: number | null }>
): Array<{ normalizedWeight: number }> {
  const includedItems = items.filter(item => item.included);
  
  if (includedItems.length === 0) {
    return items.map(() => ({ normalizedWeight: 0 }));
  }
  
  // Use exponential weighting (higher scores get more weight)
  const p = 2; // Exponent
  
  const weights = includedItems.map(item => {
    if (item.manualWeightOverride !== null && item.manualWeightOverride !== undefined) {
      return Number(item.manualWeightOverride);
    }
    return Math.pow(item.similarityScore / 100, p);
  });
  
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  
  let includedIdx = 0;
  return items.map(item => {
    if (!item.included) {
      return { normalizedWeight: 0 };
    }
    const rawWeight = item.manualWeightOverride !== null && item.manualWeightOverride !== undefined
      ? Number(item.manualWeightOverride)
      : Math.pow(item.similarityScore / 100, p);
    const normalizedWeight = totalWeight > 0 ? rawWeight / totalWeight : 0;
    includedIdx++;
    return { normalizedWeight };
  });
}

// Rate Set Indication Calculation
export interface RateSetIndicationResult {
  indicatedWetRate: number | null;
  indicatedRackRate: number | null;
  indicatedLandRate: number | null;
  wetRateUnit: string | null;
  rackRateUnit: string | null;
  landRateUnit: string | null;
  compsUsed: number;
  outliersTrimmed: number;
  computedAt: string;
}

export function computeRateSetIndication(
  items: Array<{
    included: boolean;
    normalizedWeight: number;
    wetRateValue?: number | string | null;
    rackRateValue?: number | string | null;
    landRateValue?: number | string | null;
    wetRateUnit?: string | null;
    rackRateUnit?: string | null;
    landRateUnit?: string | null;
  }>
): RateSetIndicationResult {
  const includedItems = items.filter(item => item.included && item.normalizedWeight > 0);
  
  if (includedItems.length === 0) {
    return {
      indicatedWetRate: null,
      indicatedRackRate: null,
      indicatedLandRate: null,
      wetRateUnit: null,
      rackRateUnit: null,
      landRateUnit: null,
      compsUsed: 0,
      outliersTrimmed: 0,
      computedAt: new Date().toISOString(),
    };
  }
  
  // Compute weighted averages
  let wetRateSum = 0, wetWeightSum = 0;
  let rackRateSum = 0, rackWeightSum = 0;
  let landRateSum = 0, landWeightSum = 0;
  let wetRateUnit: string | null = null;
  let rackRateUnit: string | null = null;
  let landRateUnit: string | null = null;
  
  for (const item of includedItems) {
    if (item.wetRateValue !== null && item.wetRateValue !== undefined) {
      wetRateSum += Number(item.wetRateValue) * item.normalizedWeight;
      wetWeightSum += item.normalizedWeight;
      if (!wetRateUnit) wetRateUnit = item.wetRateUnit ?? null;
    }
    if (item.rackRateValue !== null && item.rackRateValue !== undefined) {
      rackRateSum += Number(item.rackRateValue) * item.normalizedWeight;
      rackWeightSum += item.normalizedWeight;
      if (!rackRateUnit) rackRateUnit = item.rackRateUnit ?? null;
    }
    if (item.landRateValue !== null && item.landRateValue !== undefined) {
      landRateSum += Number(item.landRateValue) * item.normalizedWeight;
      landWeightSum += item.normalizedWeight;
      if (!landRateUnit) landRateUnit = item.landRateUnit ?? null;
    }
  }
  
  return {
    indicatedWetRate: wetWeightSum > 0 ? Math.round(wetRateSum / wetWeightSum * 100) / 100 : null,
    indicatedRackRate: rackWeightSum > 0 ? Math.round(rackRateSum / rackWeightSum * 100) / 100 : null,
    indicatedLandRate: landWeightSum > 0 ? Math.round(landRateSum / landWeightSum * 100) / 100 : null,
    wetRateUnit,
    rackRateUnit,
    landRateUnit,
    compsUsed: includedItems.length,
    outliersTrimmed: 0,
    computedAt: new Date().toISOString(),
  };
}

// Sales Set Indication Calculation
export interface SalesSetIndicationResult {
  indicatedPricePerSlip: number | null;
  indicatedPricePerRack: number | null;
  indicatedPricePerCapacityIndex: number | null;
  indicatedTotalValue: number | null;
  subjectCapacityIndex: number | null;
  compsUsed: number;
  outliersTrimmed: number;
  computedAt: string;
}

export function computeSalesSetIndication(
  items: Array<{
    included: boolean;
    normalizedWeight: number;
    salePrice?: number | null;
    wetSlips?: number | null;
    dryRacks?: number | null;
    pricePerSlip?: number | null;
    pricePerRack?: number | null;
    pricePerCapacityIndex?: number | string | null;
    capacityIndex?: number | string | null;
  }>,
  subjectCapacityIndex: number
): SalesSetIndicationResult {
  const includedItems = items.filter(item => item.included && item.normalizedWeight > 0);
  
  if (includedItems.length === 0) {
    return {
      indicatedPricePerSlip: null,
      indicatedPricePerRack: null,
      indicatedPricePerCapacityIndex: null,
      indicatedTotalValue: null,
      subjectCapacityIndex,
      compsUsed: 0,
      outliersTrimmed: 0,
      computedAt: new Date().toISOString(),
    };
  }
  
  let pricePerSlipSum = 0, slipWeightSum = 0;
  let pricePerRackSum = 0, rackWeightSum = 0;
  let pricePerCapIdxSum = 0, capIdxWeightSum = 0;
  
  for (const item of includedItems) {
    // Price per slip
    if (item.pricePerSlip !== null && item.pricePerSlip !== undefined) {
      pricePerSlipSum += Number(item.pricePerSlip) * item.normalizedWeight;
      slipWeightSum += item.normalizedWeight;
    }
    
    // Price per rack
    if (item.pricePerRack !== null && item.pricePerRack !== undefined) {
      pricePerRackSum += Number(item.pricePerRack) * item.normalizedWeight;
      rackWeightSum += item.normalizedWeight;
    }
    
    // Price per capacity index
    let ppci = item.pricePerCapacityIndex;
    if (ppci === null || ppci === undefined) {
      // Calculate from sale price and capacity
      const compCapIdx = item.capacityIndex ?? computeCapacityIndex(item.wetSlips ?? 0, item.dryRacks ?? 0);
      if (item.salePrice && Number(compCapIdx) > 0) {
        ppci = item.salePrice / Number(compCapIdx);
      }
    }
    
    if (ppci !== null && ppci !== undefined) {
      pricePerCapIdxSum += Number(ppci) * item.normalizedWeight;
      capIdxWeightSum += item.normalizedWeight;
    }
  }
  
  const indicatedPricePerSlip = slipWeightSum > 0 
    ? Math.round(pricePerSlipSum / slipWeightSum) 
    : null;
  const indicatedPricePerRack = rackWeightSum > 0 
    ? Math.round(pricePerRackSum / rackWeightSum) 
    : null;
  const indicatedPricePerCapacityIndex = capIdxWeightSum > 0 
    ? Math.round(pricePerCapIdxSum / capIdxWeightSum) 
    : null;
  const indicatedTotalValue = indicatedPricePerCapacityIndex !== null && subjectCapacityIndex > 0
    ? Math.round(indicatedPricePerCapacityIndex * subjectCapacityIndex)
    : null;
  
  return {
    indicatedPricePerSlip,
    indicatedPricePerRack,
    indicatedPricePerCapacityIndex,
    indicatedTotalValue,
    subjectCapacityIndex,
    compsUsed: includedItems.length,
    outliersTrimmed: 0,
    computedAt: new Date().toISOString(),
  };
}

// Full comp set computation
export async function computeCompSet(
  compSetId: string,
  orgId: string
): Promise<{
  success: boolean;
  result?: RateSetIndicationResult | SalesSetIndicationResult;
  error?: string;
}> {
  try {
    // Get comp set
    const [compSet] = await db
      .select()
      .from(compSets)
      .where(and(eq(compSets.id, compSetId), eq(compSets.orgId, orgId)));
    
    if (!compSet) {
      return { success: false, error: 'Comp set not found' };
    }
    
    // Get subject
    let subject: MarinaSubject | null = null;
    if (compSet.subjectId) {
      const [s] = await db
        .select()
        .from(marinaSubjects)
        .where(and(eq(marinaSubjects.id, compSet.subjectId), eq(marinaSubjects.orgId, orgId)));
      subject = s || null;
    }
    
    if (!subject) {
      return { success: false, error: 'Subject marina not found' };
    }
    
    // Get comp set items
    const items = await db
      .select()
      .from(compSetItems)
      .where(and(eq(compSetItems.compSetId, compSetId), eq(compSetItems.orgId, orgId)));
    
    if (items.length === 0) {
      return { success: false, error: 'No comps in set' };
    }
    
    const scoringConfig = (compSet.scoringConfig || {}) as ScoringConfig;
    
    if (compSet.compType === 'RATE') {
      // Get rate comps
      const rateCompIds = items
        .filter(i => i.rateCompId)
        .map(i => i.rateCompId!);
      
      if (rateCompIds.length === 0) {
        return { success: false, error: 'No rate comps in set' };
      }
      
      const rateCompData = await db
        .select()
        .from(rateComps)
        .where(and(
          inArray(rateComps.id, rateCompIds),
          eq(rateComps.orgId, orgId)
        ));
      
      // Score each comp
      const scoredItems = items.map(item => {
        const comp = rateCompData.find(c => c.id === item.rateCompId);
        if (!comp) return { ...item, scoring: null };
        
        const scoring = computeSimilarityScore(
          {
            lat: Number(subject!.lat),
            lng: Number(subject!.lng),
            slipsTotal: subject!.slipsTotal,
            racksTotal: subject!.racksTotal,
            slipMix: subject!.slipMix as SlipMix | null,
            capabilities: subject!.capabilities as MarinaCapabilities | null,
          },
          {
            lat: comp.lat ? Number(comp.lat) : null,
            lng: comp.lng ? Number(comp.lng) : null,
            wetSlips: comp.wetSlips,
            dryRacks: comp.dryRacks,
            slipMix: comp.slipMix as SlipMix | null,
            capabilities: comp.capabilities as MarinaCapabilities | null,
            qualityTier: comp.qualityTier,
          },
          scoringConfig
        );
        
        return { 
          ...item, 
          scoring,
          comp,
        };
      });
      
      // Normalize weights
      const normalizedWeights = normalizeWeights(
        scoredItems.map(i => ({
          similarityScore: i.scoring?.similarityScore ?? 50,
          included: i.included,
          manualWeightOverride: i.manualWeightOverride ? Number(i.manualWeightOverride) : null,
        }))
      );
      
      // Update items with scores
      for (let i = 0; i < scoredItems.length; i++) {
        if (scoredItems[i].scoring) {
          await db
            .update(compSetItems)
            .set({
              similarityScore: scoredItems[i].scoring!.similarityScore,
              geoScore: scoredItems[i].scoring!.geoScore,
              capacityScore: scoredItems[i].scoring!.capacityScore,
              slipMixScore: scoredItems[i].scoring!.slipMixScore,
              capabilitiesScore: scoredItems[i].scoring!.capabilitiesScore,
              conditionScore: scoredItems[i].scoring!.conditionScore,
              normalizedWeight: String(normalizedWeights[i].normalizedWeight),
            })
            .where(eq(compSetItems.id, scoredItems[i].id));
        }
      }
      
      // Compute indication
      const indicationItems = scoredItems
        .filter(i => i.comp)
        .map((i, idx) => ({
          included: i.included,
          normalizedWeight: normalizedWeights[idx].normalizedWeight,
          wetRateValue: i.comp?.wetRateValue,
          rackRateValue: i.comp?.rackRateValue,
          landRateValue: i.comp?.landRateValue,
          wetRateUnit: i.comp?.wetRateUnit,
          rackRateUnit: i.comp?.rackRateUnit,
          landRateUnit: i.comp?.landRateUnit,
        }));
      
      const result = computeRateSetIndication(indicationItems);
      
      // Update comp set with result
      await db
        .update(compSets)
        .set({
          lastComputeResult: result,
          lastComputedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(compSets.id, compSetId));
      
      return { success: true, result };
      
    } else {
      // SALE type
      const salesCompIds = items
        .filter(i => i.salesCompId)
        .map(i => i.salesCompId!);
      
      if (salesCompIds.length === 0) {
        return { success: false, error: 'No sales comps in set' };
      }
      
      const salesCompData = await db
        .select()
        .from(salesComps)
        .where(and(
          inArray(salesComps.id, salesCompIds),
          eq(salesComps.orgId, orgId)
        ));
      
      // Score each comp
      const scoredItems = items.map(item => {
        const comp = salesCompData.find(c => c.id === item.salesCompId);
        if (!comp) return { ...item, scoring: null };
        
        const scoring = computeSimilarityScore(
          {
            lat: Number(subject!.lat),
            lng: Number(subject!.lng),
            slipsTotal: subject!.slipsTotal,
            racksTotal: subject!.racksTotal,
            slipMix: subject!.slipMix as SlipMix | null,
            capabilities: subject!.capabilities as MarinaCapabilities | null,
          },
          {
            lat: comp.lat ? Number(comp.lat) : null,
            lng: comp.lng ? Number(comp.lng) : null,
            wetSlips: comp.wetSlips,
            dryRacks: comp.dryRacks,
            slipMix: comp.slipMix as SlipMix | null,
            capabilities: comp.capabilities as MarinaCapabilities | null,
            qualityTier: comp.qualityTier,
          },
          scoringConfig
        );
        
        return { 
          ...item, 
          scoring,
          comp,
        };
      });
      
      // Normalize weights
      const normalizedWeights = normalizeWeights(
        scoredItems.map(i => ({
          similarityScore: i.scoring?.similarityScore ?? 50,
          included: i.included,
          manualWeightOverride: i.manualWeightOverride ? Number(i.manualWeightOverride) : null,
        }))
      );
      
      // Update items with scores
      for (let i = 0; i < scoredItems.length; i++) {
        if (scoredItems[i].scoring) {
          await db
            .update(compSetItems)
            .set({
              similarityScore: scoredItems[i].scoring!.similarityScore,
              geoScore: scoredItems[i].scoring!.geoScore,
              capacityScore: scoredItems[i].scoring!.capacityScore,
              slipMixScore: scoredItems[i].scoring!.slipMixScore,
              capabilitiesScore: scoredItems[i].scoring!.capabilitiesScore,
              conditionScore: scoredItems[i].scoring!.conditionScore,
              normalizedWeight: String(normalizedWeights[i].normalizedWeight),
            })
            .where(eq(compSetItems.id, scoredItems[i].id));
        }
      }
      
      // Compute indication
      const subjectCapIdx = computeCapacityIndex(
        subject.slipsTotal ?? 0, 
        subject.racksTotal ?? 0
      );
      
      const indicationItems = scoredItems
        .filter(i => i.comp)
        .map((i, idx) => ({
          included: i.included,
          normalizedWeight: normalizedWeights[idx].normalizedWeight,
          salePrice: i.comp?.salePrice,
          wetSlips: i.comp?.wetSlips,
          dryRacks: i.comp?.dryRacks,
          pricePerSlip: i.comp?.pricePerSlip,
          pricePerRack: i.comp?.pricePerRack,
          pricePerCapacityIndex: i.comp?.pricePerCapacityIndex,
          capacityIndex: i.comp?.capacityIndex,
        }));
      
      const result = computeSalesSetIndication(indicationItems, subjectCapIdx);
      
      // Update comp set with result
      await db
        .update(compSets)
        .set({
          lastComputeResult: result,
          lastComputedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(compSets.id, compSetId));
      
      return { success: true, result };
    }
  } catch (error) {
    console.error('Error computing comp set:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
