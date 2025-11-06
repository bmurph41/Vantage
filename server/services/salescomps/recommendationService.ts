import type { IStorage } from "../../storage";
import type { SalesComp, ProjectProfile, WeightOverrides, TenantPreferences, ScOrgPreferences } from "@shared/schema";
import { 
  DEFAULT_RECOMMENDATION_WEIGHTS, 
  PROFIT_CENTERS, 
  generateSegmentKey, 
  getCapacityBucket 
} from "@shared/salescomps-constants";

export interface RecommendationScore {
  comp: SalesComp;
  score: number;
  breakdown: {
    capacityScore: number;
    financialScore: number;
    profitCentersScore: number;
    regionalScore: number;
    geoScore: number;
  };
  reasons: string[];
}

export interface RecommendationWeights {
  capacity: number;
  financial: number;
  profitCenters: number;
  regional: number;
  geo: number;
}

export class RecommendationService {
  constructor(private storage: IStorage) {}

  /**
   * Get personalized recommendation weights for a tenant and project profile
   */
  private async getEffectiveWeights(
    orgId: string, 
    profile: ProjectProfile,
    userOverrides?: WeightOverrides
  ): Promise<RecommendationWeights> {
    // Generate segment key for learning system
    const segmentKey = generateSegmentKey(profile.coastalType, profile.targetCapacity);
    
    // Get learned weights from database
    let learnedWeights: RecommendationWeights = { 
      capacity: DEFAULT_RECOMMENDATION_WEIGHTS.capacity,
      financial: DEFAULT_RECOMMENDATION_WEIGHTS.financial,
      profitCenters: DEFAULT_RECOMMENDATION_WEIGHTS.profitCenters,
      regional: DEFAULT_RECOMMENDATION_WEIGHTS.regional,
      geo: DEFAULT_RECOMMENDATION_WEIGHTS.geo
    };
    const tenantPrefs = await this.storage.getOrgPreferences(orgId, segmentKey);
    if (tenantPrefs?.weights) {
      learnedWeights = tenantPrefs.weights as RecommendationWeights;
    }
    
    // Blend learned weights with user overrides (70% user, 30% learned by default)
    const alpha = 0.7;
    const effectiveWeights: RecommendationWeights = {
      capacity: (userOverrides?.capacity ?? DEFAULT_RECOMMENDATION_WEIGHTS.capacity) * alpha + 
                learnedWeights.capacity * (1 - alpha),
      financial: (userOverrides?.financial ?? DEFAULT_RECOMMENDATION_WEIGHTS.financial) * alpha + 
                 learnedWeights.financial * (1 - alpha),
      profitCenters: (userOverrides?.profitCenters ?? DEFAULT_RECOMMENDATION_WEIGHTS.profitCenters) * alpha + 
                     learnedWeights.profitCenters * (1 - alpha),
      regional: (userOverrides?.regional ?? DEFAULT_RECOMMENDATION_WEIGHTS.regional) * alpha + 
                learnedWeights.regional * (1 - alpha),
      geo: (userOverrides?.geo ?? DEFAULT_RECOMMENDATION_WEIGHTS.geo) * alpha + 
           learnedWeights.geo * (1 - alpha),
    };

    // Normalize weights to sum to 1
    const sum = Object.values(effectiveWeights).reduce((acc, val) => acc + val, 0);
    Object.keys(effectiveWeights).forEach(key => {
      effectiveWeights[key as keyof RecommendationWeights] /= sum;
    });

    return effectiveWeights;
  }

  /**
   * Calculate capacity similarity score
   */
  private calculateCapacityScore(comp: SalesComp, targetCapacity?: number): number {
    if (!targetCapacity) return 0.5; // neutral score if no target

    const compCapacity = (comp.wetSlips || 0) + (comp.dryRacks || 0);
    if (compCapacity === 0) return 0.1; // penalize comps with no capacity data
    
    // Use relative difference normalized by the maximum of the two values
    const maxCapacity = Math.max(targetCapacity, compCapacity);
    const difference = Math.abs(targetCapacity - compCapacity);
    
    // Score decreases as relative difference increases
    return Math.max(0, 1 - (difference / maxCapacity));
  }

  /**
   * Calculate financial/NOI similarity score
   */
  private calculateFinancialScore(comp: SalesComp, profile: ProjectProfile): number {
    let score = 0;
    let components = 0;

    // NOI similarity (60% weight)
    if (profile.targetNOI && comp.noi) {
      const noiScore = this.calculateSimilarity(
        parseFloat(comp.noi.toString()), 
        profile.targetNOI
      );
      score += noiScore * 0.6;
      components += 0.6;
    }

    // Price per NOI ratio similarity (40% weight)
    if (profile.targetNOI && comp.noi && comp.salePrice) {
      const compPricePerNOI = parseFloat(comp.salePrice.toString()) / parseFloat(comp.noi.toString());
      
      // Calculate target price per NOI from profile
      let targetPricePerNOI: number | undefined;
      if (profile.targetPriceMin && profile.targetPriceMax) {
        const avgTargetPrice = (profile.targetPriceMin + profile.targetPriceMax) / 2;
        targetPricePerNOI = avgTargetPrice / profile.targetNOI;
      } else if (profile.targetPriceMin) {
        targetPricePerNOI = profile.targetPriceMin / profile.targetNOI;
      }

      if (targetPricePerNOI) {
        const ratioScore = this.calculateSimilarity(compPricePerNOI, targetPricePerNOI);
        score += ratioScore * 0.4;
        components += 0.4;
      }
    }

    return components > 0 ? score / components : 0.5; // neutral if no financial data
  }

  /**
   * Calculate profit centers overlap score using Jaccard similarity
   */
  private calculateProfitCentersScore(comp: SalesComp, profile: ProjectProfile): number {
    const compProfitCenters = comp.profitCenters || [];
    const mustHave = profile.mustHaveProfitCenters || [];
    const niceToHave = profile.niceToHaveProfitCenters || [];

    // Hard filter: if must-have centers are specified, comp must have all of them
    if (mustHave.length > 0) {
      for (const required of mustHave) {
        if (!compProfitCenters.includes(required)) {
          return 0; // Comp doesn't meet must-have requirements
        }
      }
    }

    // Calculate Jaccard similarity with preferred profit centers
    const allPreferred = [...mustHave, ...niceToHave];
    if (allPreferred.length === 0) return 0.5; // neutral if no preferences

    const intersection = compProfitCenters.filter(x => allPreferred.includes(x as any));
    const unionArray = [...compProfitCenters, ...allPreferred];
    const union = Array.from(new Set(unionArray));
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  /**
   * Calculate regional/coastal matching score
   */
  private calculateRegionalScore(comp: SalesComp, profile: ProjectProfile): number {
    let score = 0;
    let components = 0;

    // Coastal type match (60% weight)
    if (profile.coastalType) {
      if (comp.coastalType === profile.coastalType) {
        score += 1.0 * 0.6;
      }
      components += 0.6;
    }

    // Region match (40% weight)  
    if (profile.regions && profile.regions.length > 0) {
      const compRegion = comp.region?.toLowerCase();
      const matchesRegion = compRegion && profile.regions.some(r => r.toLowerCase() === compRegion);
      if (matchesRegion) {
        score += 1.0 * 0.4;
      }
      components += 0.4;
    }

    return components > 0 ? score / components : 0.5; // neutral if no regional data
  }

  /**
   * Calculate geographic proximity score
   */
  private calculateGeoScore(comp: SalesComp, profile: ProjectProfile): number {
    // Use state matching first (higher priority), then fall back to regions
    let stateScore = 0;
    let hasStateData = false;
    
    // State matching
    if (profile.states && profile.states.length > 0) {
      const compState = comp.state?.toLowerCase();
      if (compState) {
        hasStateData = true;
        stateScore = profile.states.some(s => s.toLowerCase() === compState) ? 1.0 : 0.2;
      }
    }
    
    // If we have state data, use that; otherwise fall back to regions
    if (hasStateData) {
      return stateScore;
    }
    
    // Region-based fallback
    if (profile.regions && profile.regions.length > 0 && comp.region) {
      const compRegion = comp.region.toLowerCase();
      return profile.regions.some(r => r.toLowerCase() === compRegion) ? 1.0 : 0.3;
    }
    
    return 0.5; // neutral if no geographic data
  }

  /**
   * Helper function to calculate similarity between two numbers
   */
  private calculateSimilarity(value1: number, value2: number): number {
    if (value1 === 0 && value2 === 0) return 1;
    const maxValue = Math.max(Math.abs(value1), Math.abs(value2));
    if (maxValue === 0) return 1;
    
    const difference = Math.abs(value1 - value2);
    return Math.max(0, 1 - (difference / maxValue));
  }

  /**
   * Generate explanation reasons for a recommendation
   */
  private generateReasons(score: RecommendationScore, weights: RecommendationWeights): string[] {
    const reasons: string[] = [];
    const { breakdown, comp } = score;

    // Sort features by weighted contribution
    const contributions = [
      { feature: 'capacity', score: breakdown.capacityScore, weight: weights.capacity, label: 'Size Match' },
      { feature: 'financial', score: breakdown.financialScore, weight: weights.financial, label: 'Financial Match' },
      { feature: 'profitCenters', score: breakdown.profitCentersScore, weight: weights.profitCenters, label: 'Profit Centers' },
      { feature: 'regional', score: breakdown.regionalScore, weight: weights.regional, label: 'Regional Match' },
      { feature: 'geo', score: breakdown.geoScore, weight: weights.geo, label: 'Location' }
    ].sort((a, b) => (b.score * b.weight) - (a.score * a.weight));

    // Add top contributing reasons
    contributions.slice(0, 3).forEach(contrib => {
      if (contrib.score > 0.7) {
        reasons.push(`Strong ${contrib.label.toLowerCase()}`);
      } else if (contrib.score > 0.5) {
        reasons.push(`Good ${contrib.label.toLowerCase()}`);
      }
    });

    // Add specific details
    if (breakdown.capacityScore > 0.8) {
      const capacity = (comp.wetSlips || 0) + (comp.dryRacks || 0);
      reasons.push(`${capacity} total slips/racks`);
    }

    if (breakdown.financialScore > 0.8 && comp.noi) {
      reasons.push(`$${parseFloat(comp.noi.toString()).toLocaleString()} NOI`);
    }

    if (breakdown.profitCentersScore > 0.7) {
      const profitCenters = comp.profitCenters || [];
      if (profitCenters.length > 0) {
        reasons.push(`${profitCenters.length} profit centers`);
      }
    }

    return reasons.slice(0, 4); // Limit to top 4 reasons
  }

  /**
   * Get recommendations for a project
   */
  async getRecommendations(params: {
    orgId: string;
    projectProfile: ProjectProfile;
    userWeightOverrides?: WeightOverrides;
    excludeCompIds?: string[];
    limit?: number;
  }): Promise<RecommendationScore[]> {
    const { orgId, projectProfile, userWeightOverrides, excludeCompIds = [], limit = 50 } = params;

    // Get effective weights (learned + user preferences)
    const weights = await this.getEffectiveWeights(orgId, projectProfile, userWeightOverrides);

    // Get candidate comps from database with prefiltering
    const comps = await this.storage.getCompsForRecommendation({
      orgId,
      filters: {
        regions: projectProfile.regions,
        states: projectProfile.states,
        coastalType: projectProfile.coastalType,
        excludeIds: excludeCompIds,
        mustHaveProfitCenters: projectProfile.mustHaveProfitCenters,
        targetCapacity: projectProfile.targetCapacity,
      }
    });

    // Additional hard filter for must-have profit centers (safety check)
    const filteredComps = comps.filter(comp => {
      const mustHave = projectProfile.mustHaveProfitCenters || [];
      if (mustHave.length > 0) {
        const compProfitCenters = comp.profitCenters || [];
        return mustHave.every(required => compProfitCenters.includes(required));
      }
      return true;
    });

    // Score each comp
    const scoredComps: RecommendationScore[] = filteredComps.map(comp => {
      const capacityScore = this.calculateCapacityScore(comp, projectProfile.targetCapacity);
      const financialScore = this.calculateFinancialScore(comp, projectProfile);
      const profitCentersScore = this.calculateProfitCentersScore(comp, projectProfile);
      const regionalScore = this.calculateRegionalScore(comp, projectProfile);
      const geoScore = this.calculateGeoScore(comp, projectProfile);

      const breakdown = {
        capacityScore,
        financialScore,
        profitCentersScore,
        regionalScore,
        geoScore
      };

      // Calculate weighted overall score
      const score = 
        capacityScore * weights.capacity +
        financialScore * weights.financial +
        profitCentersScore * weights.profitCenters +
        regionalScore * weights.regional +
        geoScore * weights.geo;

      const recommendation: RecommendationScore = {
        comp,
        score,
        breakdown,
        reasons: []
      };

      // Generate explanation reasons
      recommendation.reasons = this.generateReasons(recommendation, weights);

      return recommendation;
    });

    // Sort by score and return top results
    return scoredComps
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Update learned preferences based on user feedback
   */
  async updateLearningWeights(params: {
    orgId: string;
    projectProfile: ProjectProfile;
    selectedComp: SalesComp;
    action: 'selected' | 'rejected' | 'liked';
    currentScore: number;
    breakdown: RecommendationScore['breakdown'];
  }): Promise<void> {
    const { orgId, projectProfile, action, breakdown } = params;
    
    // Generate segment key
    const segmentKey = generateSegmentKey(projectProfile.coastalType, projectProfile.targetCapacity);
    
    // Get current learned weights
    let currentWeights: RecommendationWeights = { 
      capacity: DEFAULT_RECOMMENDATION_WEIGHTS.capacity,
      financial: DEFAULT_RECOMMENDATION_WEIGHTS.financial,
      profitCenters: DEFAULT_RECOMMENDATION_WEIGHTS.profitCenters,
      regional: DEFAULT_RECOMMENDATION_WEIGHTS.regional,
      geo: DEFAULT_RECOMMENDATION_WEIGHTS.geo
    };
    const tenantPrefs = await this.storage.getOrgPreferences(orgId, segmentKey);
    if (tenantPrefs?.weights) {
      currentWeights = tenantPrefs.weights as RecommendationWeights;
    }

    // Calculate reward (+1 for positive actions, -0.3 for negative)
    const reward = action === 'selected' || action === 'liked' ? 1.0 : -0.3;
    
    // Learning rate (small updates)
    const learningRate = 0.1;

    // Update weights based on which features scored well
    const newWeights = { ...currentWeights };
    
    // Increase weights for features that scored well on positive feedback
    // Decrease weights for features that scored well on negative feedback
    Object.keys(breakdown).forEach(feature => {
      const mappedFeature = feature.replace('Score', '') as keyof RecommendationWeights;
      if (mappedFeature in newWeights) {
        const featureScore = breakdown[feature as keyof typeof breakdown];
        const adjustment = reward * learningRate * featureScore;
        newWeights[mappedFeature] = Math.max(0.05, Math.min(0.7, 
          newWeights[mappedFeature] + adjustment
        ));
      }
    });

    // Normalize weights to sum to 1
    const sum = Object.values(newWeights).reduce((acc, val) => acc + val, 0);
    Object.keys(newWeights).forEach(key => {
      newWeights[key as keyof RecommendationWeights] /= sum;
    });

    // Update or create tenant preferences
    await this.storage.upsertOrgPreferences({
      orgId,
      segmentKey,
      weights: newWeights,
    });
  }
}