import { SalesComp } from "@shared/schema";

export interface DataQualityReport {
  overallScore: number; // 0-100
  completenessScore: number; // 0-100
  recencyScore: number; // 0-100
  sourceReliabilityScore: number; // 0-100
  verificationScore: number; // 0-100
  breakdown: QualityBreakdown;
  recommendations: string[];
  warnings: string[];
}

export interface QualityBreakdown {
  presentFields: string[];
  missingFields: string[];
  staleFields: string[];
  unverifiedFields: string[];
  fieldScores: Record<string, number>;
}

const CORE_FIELDS = [
  'marina',
  'city',
  'state',
  'salePrice',
  'saleYear',
];

const IMPORTANT_FIELDS = [
  'capRate',
  'noi',
  'wetSlips',
  'dryRacks',
  'address',
  'zip',
  'saleMonth',
];

const OPTIONAL_FIELDS = [
  'acres',
  'occupancy',
  'yearBuilt',
  'bodyOfWater',
  'region',
  'broker',
  'brokerage',
  'seller',
  'buyer',
  'notes',
  'lat',
  'lng',
];

const SOURCE_RELIABILITY_SCORES: Record<string, number> = {
  'costar': 95,
  'broker': 85,
  'loopnet': 75,
  'crexi': 75,
  'bizbuysell': 70,
  'public_records': 90,
  'direct_research': 80,
  'internal': 60,
  'unknown': 30,
};

const STALE_THRESHOLD_DAYS = 365; // Data older than 1 year is considered stale for verification

export class DataQualityService {

  calculateQualityScore(comp: SalesComp): DataQualityReport {
    const completenessScore = this.calculateCompletenessScore(comp);
    const recencyScore = this.calculateRecencyScore(comp);
    const sourceReliabilityScore = this.calculateSourceReliabilityScore(comp);
    const verificationScore = this.calculateVerificationScore(comp);

    const overallScore = Math.round(
      completenessScore * 0.35 +
      recencyScore * 0.25 +
      sourceReliabilityScore * 0.20 +
      verificationScore * 0.20
    );

    const breakdown = this.generateBreakdown(comp);
    const recommendations = this.generateRecommendations(comp, breakdown);
    const warnings = this.generateWarnings(comp, breakdown);

    return {
      overallScore,
      completenessScore,
      recencyScore,
      sourceReliabilityScore,
      verificationScore,
      breakdown,
      recommendations,
      warnings,
    };
  }

  calculateCompletenessScore(comp: SalesComp): number {
    let score = 0;
    let maxScore = 0;

    for (const field of CORE_FIELDS) {
      maxScore += 20;
      if (this.hasValue(comp, field)) {
        score += 20;
      }
    }

    for (const field of IMPORTANT_FIELDS) {
      maxScore += 8;
      if (this.hasValue(comp, field)) {
        score += 8;
      }
    }

    for (const field of OPTIONAL_FIELDS) {
      maxScore += 2;
      if (this.hasValue(comp, field)) {
        score += 2;
      }
    }

    return Math.round((score / maxScore) * 100);
  }

  calculateRecencyScore(comp: SalesComp): number {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (!comp.saleYear) {
      return 30;
    }

    const saleMonth = comp.saleMonth || 6;
    const saleDate = new Date(comp.saleYear, saleMonth - 1, 15);
    const monthsAgo = (currentYear - comp.saleYear) * 12 + (currentMonth - saleMonth);

    if (monthsAgo <= 6) return 100;
    if (monthsAgo <= 12) return 90;
    if (monthsAgo <= 24) return 75;
    if (monthsAgo <= 36) return 60;
    if (monthsAgo <= 60) return 40;
    return 25;
  }

  calculateSourceReliabilityScore(comp: SalesComp): number {
    const source = (comp.dataSource || 'unknown').toLowerCase();
    return SOURCE_RELIABILITY_SCORES[source] || SOURCE_RELIABILITY_SCORES['unknown'];
  }

  calculateVerificationScore(comp: SalesComp): number {
    if (!comp.verificationStatus || comp.verificationStatus === 'unverified') {
      return 30;
    }

    if (comp.verificationStatus === 'verified') {
      if (comp.lastVerifiedAt) {
        const daysSinceVerification = Math.floor(
          (Date.now() - new Date(comp.lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceVerification <= 90) return 100;
        if (daysSinceVerification <= 180) return 85;
        if (daysSinceVerification <= 365) return 70;
        return 50;
      }
      return 80;
    }

    if (comp.verificationStatus === 'pending') {
      return 50;
    }

    if (comp.verificationStatus === 'stale') {
      return 20;
    }

    return 30;
  }

  private hasValue(comp: SalesComp, field: string): boolean {
    const value = (comp as any)[field];
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }

  private generateBreakdown(comp: SalesComp): QualityBreakdown {
    const allFields = [...CORE_FIELDS, ...IMPORTANT_FIELDS, ...OPTIONAL_FIELDS];
    const presentFields: string[] = [];
    const missingFields: string[] = [];
    const staleFields: string[] = [];
    const unverifiedFields: string[] = [];
    const fieldScores: Record<string, number> = {};

    for (const field of allFields) {
      if (this.hasValue(comp, field)) {
        presentFields.push(field);
        fieldScores[field] = 100;
      } else {
        missingFields.push(field);
        fieldScores[field] = 0;
      }
    }

    if (!comp.lastVerifiedAt || 
        (Date.now() - new Date(comp.lastVerifiedAt).getTime()) > STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000) {
      staleFields.push(...presentFields.slice(0, 5));
    }

    if (comp.verificationStatus !== 'verified') {
      unverifiedFields.push(...CORE_FIELDS.filter(f => this.hasValue(comp, f)));
    }

    return {
      presentFields,
      missingFields,
      staleFields,
      unverifiedFields,
      fieldScores,
    };
  }

  private generateRecommendations(comp: SalesComp, breakdown: QualityBreakdown): string[] {
    const recommendations: string[] = [];

    const missingCore = CORE_FIELDS.filter(f => breakdown.missingFields.includes(f));
    if (missingCore.length > 0) {
      recommendations.push(`Add missing core fields: ${missingCore.join(', ')}`);
    }

    if (!comp.lat || !comp.lng) {
      recommendations.push('Geocode this property to enable map-based analysis');
    }

    if (!comp.dataSource) {
      recommendations.push('Add data source attribution for compliance tracking');
    }

    if (comp.verificationStatus !== 'verified') {
      recommendations.push('Verify this comp data for improved reliability');
    }

    const missingImportant = IMPORTANT_FIELDS.filter(f => breakdown.missingFields.includes(f));
    if (missingImportant.length > 3) {
      recommendations.push(`Consider adding important fields: ${missingImportant.slice(0, 3).join(', ')}`);
    }

    return recommendations;
  }

  private generateWarnings(comp: SalesComp, breakdown: QualityBreakdown): string[] {
    const warnings: string[] = [];

    if (!comp.saleYear) {
      warnings.push('Sale year is missing - unable to calculate recency');
    }

    if (comp.salePrice && comp.capRate) {
      const impliedNOI = comp.salePrice * (comp.capRate / 10000);
      if (comp.noi && Math.abs(comp.noi - impliedNOI) > impliedNOI * 0.1) {
        warnings.push('NOI does not match implied NOI from price and cap rate');
      }
    }

    if (comp.capRate) {
      if (comp.capRate < 300) {
        warnings.push('Cap rate appears unusually low (< 3%)');
      }
      if (comp.capRate > 1500) {
        warnings.push('Cap rate appears unusually high (> 15%)');
      }
    }

    if (comp.salePrice && comp.wetSlips) {
      const pricePerSlip = comp.salePrice / comp.wetSlips;
      if (pricePerSlip < 10000) {
        warnings.push('Price per slip appears unusually low');
      }
      if (pricePerSlip > 500000) {
        warnings.push('Price per slip appears unusually high');
      }
    }

    if (breakdown.staleFields.length > 5) {
      warnings.push('Data verification is overdue - consider re-validating');
    }

    return warnings;
  }

  calculateBatchQuality(comps: SalesComp[]): {
    averageScore: number;
    scoreDistribution: Record<string, number>;
    commonIssues: { issue: string; count: number }[];
  } {
    if (comps.length === 0) {
      return { averageScore: 0, scoreDistribution: {}, commonIssues: [] };
    }

    const scores = comps.map(comp => this.calculateQualityScore(comp));
    const averageScore = Math.round(
      scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length
    );

    const scoreDistribution: Record<string, number> = {
      excellent: scores.filter(s => s.overallScore >= 90).length,
      good: scores.filter(s => s.overallScore >= 70 && s.overallScore < 90).length,
      fair: scores.filter(s => s.overallScore >= 50 && s.overallScore < 70).length,
      poor: scores.filter(s => s.overallScore < 50).length,
    };

    const issueCounter: Record<string, number> = {};
    for (const score of scores) {
      for (const warning of score.warnings) {
        issueCounter[warning] = (issueCounter[warning] || 0) + 1;
      }
      for (const recommendation of score.recommendations) {
        issueCounter[recommendation] = (issueCounter[recommendation] || 0) + 1;
      }
    }

    const commonIssues = Object.entries(issueCounter)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { averageScore, scoreDistribution, commonIssues };
  }

  calculateCompleteness(comp: SalesComp): number {
    return this.calculateCompletenessScore(comp);
  }

  computeStatisticalMetrics(comp: Partial<SalesComp>): {
    pricePerSlip: number | null;
    pricePerAcre: number | null;
    noiPerSlip: number | null;
    totalUnits: number | null;
  } {
    const totalUnits = (comp.wetSlips || 0) + (comp.dryRacks || 0);
    
    return {
      pricePerSlip: comp.salePrice && totalUnits > 0 
        ? Math.round(comp.salePrice / totalUnits) 
        : null,
      pricePerAcre: comp.salePrice && comp.acres && comp.acres > 0 
        ? Math.round(comp.salePrice / comp.acres) 
        : null,
      noiPerSlip: comp.noi && totalUnits > 0 
        ? Math.round(comp.noi / totalUnits) 
        : null,
      totalUnits: totalUnits > 0 ? totalUnits : null,
    };
  }
}

export const dataQualityService = new DataQualityService();
