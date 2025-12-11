/**
 * Investment Criteria Match Scoring Engine
 * Per guidance docs: Implements hard filter and soft preference scoring for marina listings
 * 
 * Features:
 * - Hard filters (must-have requirements that auto-reject listings)
 * - Per-criterion scoring functions with importance weighting
 * - Composite score calculation (0-1 scale)
 * - Score breakdown for transparency
 */

import { db } from '../../db';
import { eq, and } from 'drizzle-orm';
import {
  investmentCriteriaProfiles,
  investmentCriteriaLocation,
  investmentCriteriaFinancial,
  investmentCriteriaOperational,
  investmentCriteriaSize,
  investmentCriteriaCapital,
  investmentCriteriaStorageMix,
  investmentCriteriaDepartments,
  investmentCriteriaStorageTypes,
  marinaListings,
  marinaListingMatches,
  type MarinaListing,
  type InvestmentCriteriaProfile,
} from '@shared/schema';

// Types for scoring
export interface CriterionScoreBreakdown {
  key: string; // e.g., "price", "capRate", "revenue", "storageMix", etc.
  score: number; // 0-1
  importance: number; // 1-5
  mustHave: boolean;
  passed: boolean;
  meta?: Record<string, any>; // Listing value vs target values
}

export interface MatchScoreResult {
  overallScore: number; // 0-1, or 0-100 for storage
  breakdown: CriterionScoreBreakdown[];
  hardFilterFailed: boolean;
  failedReasons: string[];
  passesAllMustHave: boolean;
}

export interface FullCriteriaProfile {
  profile: InvestmentCriteriaProfile;
  location: any;
  financial: any;
  operational: any;
  size: any;
  capital: any;
  storageMix: any;
  departments: any;
  storageTypes: any;
}

// Marina department constants
export const MARINA_DEPARTMENTS = [
  "Wet Slips",
  "Lift Slips", 
  "Dry Racks",
  "Moorings",
  "Trailer Storage",
  "Indoor Storage",
  "RV/Other Storage",
  "Fuel",
  "Ship Store/Retail",
  "Service",
  "Yard",
  "F&B / Restaurant",
  "Boat Sales / Brokerage",
  "Boat Rentals",
  "Boat Club",
  "Other"
] as const;

export const STORAGE_DEPARTMENTS = [
  "Wet Slips",
  "Lift Slips",
  "Dry Racks", 
  "Moorings",
  "Trailer Storage",
  "Indoor Storage"
];

class MatchScoringService {
  
  /**
   * Load full criteria profile with all related tables
   */
  async loadFullCriteriaProfile(profileId: string, orgId: string): Promise<FullCriteriaProfile | null> {
    const [profile] = await db.select()
      .from(investmentCriteriaProfiles)
      .where(and(
        eq(investmentCriteriaProfiles.id, profileId),
        eq(investmentCriteriaProfiles.orgId, orgId)
      ));
    
    if (!profile) return null;

    // Load related criteria tables in parallel
    const [locationResults, financialResults, operationalResults, sizeResults, capitalResults, storageMixResults, departmentsResults, storageTypesResults] = await Promise.all([
      db.select().from(investmentCriteriaLocation).where(eq(investmentCriteriaLocation.profileId, profileId)),
      db.select().from(investmentCriteriaFinancial).where(eq(investmentCriteriaFinancial.profileId, profileId)),
      db.select().from(investmentCriteriaOperational).where(eq(investmentCriteriaOperational.profileId, profileId)),
      db.select().from(investmentCriteriaSize).where(eq(investmentCriteriaSize.profileId, profileId)),
      db.select().from(investmentCriteriaCapital).where(eq(investmentCriteriaCapital.profileId, profileId)),
      db.select().from(investmentCriteriaStorageMix).where(eq(investmentCriteriaStorageMix.profileId, profileId)),
      db.select().from(investmentCriteriaDepartments).where(eq(investmentCriteriaDepartments.profileId, profileId)),
      db.select().from(investmentCriteriaStorageTypes).where(eq(investmentCriteriaStorageTypes.profileId, profileId)),
    ]);

    return {
      profile,
      location: locationResults[0] || null,
      financial: financialResults[0] || null,
      operational: operationalResults[0] || null,
      size: sizeResults[0] || null,
      capital: capitalResults[0] || null,
      storageMix: storageMixResults[0] || null,
      departments: departmentsResults[0] || null,
      storageTypes: storageTypesResults[0] || null,
    };
  }

  /**
   * Compute match score for a single listing against a criteria profile
   */
  computeMatchScore(criteria: FullCriteriaProfile, listing: MarinaListing): MatchScoreResult {
    const breakdown: CriterionScoreBreakdown[] = [];
    const failedReasons: string[] = [];
    let hardFilterFailed = false;

    // 1. Geography (Hard Filter if mustHave)
    if (criteria.location) {
      const geoResult = this.scoreGeography(criteria.location, listing);
      breakdown.push(geoResult);
      if (geoResult.mustHave && !geoResult.passed) {
        hardFilterFailed = true;
        failedReasons.push(`Location: ${listing.state} not in allowed states`);
      }
    }

    // 2. Price (Hard Filter if mustHave)
    if (criteria.financial) {
      const priceResult = this.scorePrice(criteria.financial, listing);
      breakdown.push(priceResult);
      if (priceResult.mustHave && !priceResult.passed) {
        hardFilterFailed = true;
        failedReasons.push(`Price: $${listing.askingPrice} outside range`);
      }

      // 3. Cap Rate
      const capRateResult = this.scoreCapRate(criteria.financial, listing);
      breakdown.push(capRateResult);
      if (capRateResult.mustHave && !capRateResult.passed) {
        hardFilterFailed = true;
        failedReasons.push(`Cap Rate outside target range`);
      }

      // 4. Revenue
      const revenueResult = this.scoreRevenue(criteria.financial, listing);
      breakdown.push(revenueResult);
      if (revenueResult.mustHave && !revenueResult.passed) {
        hardFilterFailed = true;
        failedReasons.push(`Revenue below minimum`);
      }

      // 5. EBITDA
      const ebitdaResult = this.scoreEbitda(criteria.financial, listing);
      breakdown.push(ebitdaResult);
      if (ebitdaResult.mustHave && !ebitdaResult.passed) {
        hardFilterFailed = true;
        failedReasons.push(`EBITDA below minimum`);
      }

      // 6. Operating Margin
      const marginResult = this.scoreOperatingMargin(criteria.financial, listing);
      breakdown.push(marginResult);
      if (marginResult.mustHave && !marginResult.passed) {
        hardFilterFailed = true;
        failedReasons.push(`Operating margin outside range`);
      }
    }

    // 7. Storage Mix
    if (criteria.storageMix) {
      const storageMixResult = this.scoreStorageMix(criteria.storageMix, listing);
      breakdown.push(storageMixResult);
      if (storageMixResult.mustHave && !storageMixResult.passed) {
        hardFilterFailed = true;
        failedReasons.push(`Storage revenue share below minimum`);
      }
    }

    // 8. Department Exclusions
    if (criteria.departments) {
      const deptResult = this.scoreDepartments(criteria.departments, listing);
      breakdown.push(deptResult);
      if (!deptResult.passed && criteria.departments.excludeMode === 'reject') {
        hardFilterFailed = true;
        failedReasons.push(`Contains excluded departments`);
      }
    }

    // 9. Storage Types
    if (criteria.storageTypes) {
      const storageTypesResult = this.scoreStorageTypes(criteria.storageTypes, listing);
      breakdown.push(storageTypesResult);
      if (storageTypesResult.mustHave && !storageTypesResult.passed) {
        hardFilterFailed = true;
        failedReasons.push(`Missing required storage types`);
      }
    }

    // 10. Size criteria
    if (criteria.size) {
      const sizeResult = this.scoreSize(criteria.size, listing);
      breakdown.push(sizeResult);
    }

    // Calculate composite score
    let weightedScoreSum = 0;
    let importanceSum = 0;

    for (const criterion of breakdown) {
      if (criterion.importance > 0) {
        weightedScoreSum += criterion.score * criterion.importance;
        importanceSum += criterion.importance;
      }
    }

    const overallScore = importanceSum > 0 ? weightedScoreSum / importanceSum : 0;

    return {
      overallScore,
      breakdown,
      hardFilterFailed,
      failedReasons,
      passesAllMustHave: !hardFilterFailed,
    };
  }

  /**
   * Score geography criteria
   */
  private scoreGeography(location: any, listing: MarinaListing): CriterionScoreBreakdown {
    const targetStates = location.targetStates || [];
    const excludedStates = location.excludedStates || [];
    const importance = location.geographyImportance || 5;
    const mustHave = location.geographyMustHave ?? true;

    let score = 0;
    let passed = true;

    // Check if listing state is in excluded states
    if (excludedStates.includes(listing.state)) {
      score = 0;
      passed = false;
    }
    // Check if listing state is in target states
    else if (targetStates.length > 0) {
      if (targetStates.includes(listing.state)) {
        score = 1;
        passed = true;
      } else {
        score = 0;
        passed = false;
      }
    } else {
      // No target states specified, all locations acceptable
      score = 1;
      passed = true;
    }

    return {
      key: 'geography',
      score,
      importance,
      mustHave,
      passed,
      meta: {
        listingState: listing.state,
        targetStates,
        excludedStates,
      }
    };
  }

  /**
   * Score price criteria with linear decay for out-of-range values
   */
  private scorePrice(financial: any, listing: MarinaListing): CriterionScoreBreakdown {
    const minPrice = financial.minAskingPrice ? parseFloat(financial.minAskingPrice) : null;
    const maxPrice = financial.maxAskingPrice ? parseFloat(financial.maxAskingPrice) : null;
    const importance = financial.priceImportance || 5;
    const mustHave = financial.priceMustHave ?? true;
    const listingPrice = listing.askingPrice ? parseFloat(String(listing.askingPrice)) : null;

    if (listingPrice === null) {
      return {
        key: 'price',
        score: 0.5, // Unknown price, neutral score
        importance,
        mustHave: false, // Can't fail if price unknown
        passed: true,
        meta: { listingPrice: 'unknown', minPrice, maxPrice }
      };
    }

    let score = 1;
    let passed = true;

    // Calculate score with tolerance bands
    const tolerance = 0.10; // 10% tolerance outside range

    if (minPrice !== null && maxPrice !== null) {
      if (listingPrice >= minPrice && listingPrice <= maxPrice) {
        score = 1;
      } else if (listingPrice < minPrice) {
        const toleranceBand = minPrice * tolerance;
        if (listingPrice < minPrice - toleranceBand) {
          score = 0;
          passed = false;
        } else {
          score = (listingPrice - (minPrice - toleranceBand)) / toleranceBand;
        }
      } else { // listingPrice > maxPrice
        const toleranceBand = maxPrice * tolerance;
        if (listingPrice > maxPrice + toleranceBand) {
          score = 0;
          passed = false;
        } else {
          score = ((maxPrice + toleranceBand) - listingPrice) / toleranceBand;
        }
      }
    } else if (minPrice !== null) {
      score = listingPrice >= minPrice ? 1 : Math.min(1, listingPrice / minPrice);
      passed = listingPrice >= minPrice * (1 - tolerance);
    } else if (maxPrice !== null) {
      score = listingPrice <= maxPrice ? 1 : Math.max(0, 1 - (listingPrice - maxPrice) / (maxPrice * tolerance));
      passed = listingPrice <= maxPrice * (1 + tolerance);
    }

    return {
      key: 'price',
      score: Math.max(0, Math.min(1, score)),
      importance,
      mustHave,
      passed,
      meta: { listingPrice, minPrice, maxPrice }
    };
  }

  /**
   * Score cap rate criteria
   */
  private scoreCapRate(financial: any, listing: MarinaListing): CriterionScoreBreakdown {
    const minCapRate = financial.minCapRate ? parseFloat(financial.minCapRate) : null;
    const maxCapRate = financial.maxCapRate ? parseFloat(financial.maxCapRate) : null;
    const importance = financial.capRateImportance || 4;
    const mustHave = financial.capRateMustHave ?? false;
    
    // Get listing cap rate (use existing field or calculate)
    let listingCapRate = listing.capRate ? parseFloat(String(listing.capRate)) : null;
    
    // Try to calculate if not available
    if (listingCapRate === null && listing.noi && listing.askingPrice) {
      const noi = parseFloat(String(listing.noi));
      const price = parseFloat(String(listing.askingPrice));
      if (price > 0) {
        listingCapRate = (noi / price) * 100; // As percentage
      }
    }

    if (listingCapRate === null) {
      return {
        key: 'capRate',
        score: 0.5,
        importance,
        mustHave: false,
        passed: true,
        meta: { listingCapRate: 'unknown', minCapRate, maxCapRate }
      };
    }

    let score = 1;
    let passed = true;
    const tolerance = 0.01; // 1% tolerance

    if (minCapRate !== null && maxCapRate !== null) {
      if (listingCapRate >= minCapRate && listingCapRate <= maxCapRate) {
        score = 1;
      } else if (listingCapRate < minCapRate) {
        score = Math.max(0, 1 - (minCapRate - listingCapRate) / tolerance);
        passed = listingCapRate >= minCapRate - tolerance;
      } else {
        score = Math.max(0, 1 - (listingCapRate - maxCapRate) / tolerance);
        passed = listingCapRate <= maxCapRate + tolerance;
      }
    } else if (minCapRate !== null) {
      score = listingCapRate >= minCapRate ? 1 : listingCapRate / minCapRate;
      passed = listingCapRate >= minCapRate - tolerance;
    } else if (maxCapRate !== null) {
      score = listingCapRate <= maxCapRate ? 1 : maxCapRate / listingCapRate;
      passed = listingCapRate <= maxCapRate + tolerance;
    }

    return {
      key: 'capRate',
      score: Math.max(0, Math.min(1, score)),
      importance,
      mustHave,
      passed,
      meta: { listingCapRate, minCapRate, maxCapRate }
    };
  }

  /**
   * Score revenue criteria
   */
  private scoreRevenue(financial: any, listing: MarinaListing): CriterionScoreBreakdown {
    const minRevenue = financial.minGrossRevenue ? parseFloat(financial.minGrossRevenue) : null;
    const maxRevenue = financial.maxGrossRevenue ? parseFloat(financial.maxGrossRevenue) : null;
    const importance = financial.revenueImportance || 3;
    const mustHave = financial.revenueMustHave ?? false;
    const listingRevenue = listing.totalRevenue ? parseFloat(String(listing.totalRevenue)) : null;

    if (listingRevenue === null) {
      return {
        key: 'revenue',
        score: 0.5,
        importance,
        mustHave: false,
        passed: true,
        meta: { listingRevenue: 'unknown', minRevenue, maxRevenue }
      };
    }

    let score = 1;
    let passed = true;

    if (minRevenue !== null) {
      if (listingRevenue >= minRevenue) {
        score = 1;
      } else {
        score = listingRevenue / minRevenue;
        passed = false;
      }
    }
    if (maxRevenue !== null && listingRevenue > maxRevenue) {
      score = Math.min(score, maxRevenue / listingRevenue);
    }

    return {
      key: 'revenue',
      score: Math.max(0, Math.min(1, score)),
      importance,
      mustHave,
      passed,
      meta: { listingRevenue, minRevenue, maxRevenue }
    };
  }

  /**
   * Score EBITDA criteria
   */
  private scoreEbitda(financial: any, listing: MarinaListing): CriterionScoreBreakdown {
    const minEbitda = financial.minEbitda ? parseFloat(financial.minEbitda) : null;
    const importance = financial.ebitdaImportance || 3;
    const mustHave = financial.ebitdaMustHave ?? false;
    const listingEbitda = listing.ebitda ? parseFloat(String(listing.ebitda)) : null;

    if (listingEbitda === null || minEbitda === null) {
      return {
        key: 'ebitda',
        score: 0.5,
        importance,
        mustHave: false,
        passed: true,
        meta: { listingEbitda: listingEbitda || 'unknown', minEbitda }
      };
    }

    const score = listingEbitda >= minEbitda ? 1 : Math.max(0, listingEbitda / minEbitda);
    const passed = listingEbitda >= minEbitda;

    return {
      key: 'ebitda',
      score,
      importance,
      mustHave,
      passed,
      meta: { listingEbitda, minEbitda }
    };
  }

  /**
   * Score operating margin criteria
   */
  private scoreOperatingMargin(financial: any, listing: MarinaListing): CriterionScoreBreakdown {
    const minMargin = financial.minOperatingMargin ? parseFloat(financial.minOperatingMargin) : null;
    const maxMargin = financial.maxOperatingMargin ? parseFloat(financial.maxOperatingMargin) : null;
    const importance = financial.operatingMarginImportance || 4;
    const mustHave = financial.operatingMarginMustHave ?? false;

    // Calculate margin from EBITDA/Revenue
    let listingMargin: number | null = null;
    if (listing.ebitda && listing.totalRevenue) {
      const ebitda = parseFloat(String(listing.ebitda));
      const revenue = parseFloat(String(listing.totalRevenue));
      if (revenue > 0) {
        listingMargin = ebitda / revenue; // As decimal
      }
    }

    if (listingMargin === null) {
      return {
        key: 'operatingMargin',
        score: 0.5,
        importance,
        mustHave: false,
        passed: true,
        meta: { listingMargin: 'unknown', minMargin, maxMargin }
      };
    }

    let score = 1;
    let passed = true;

    if (minMargin !== null && maxMargin !== null) {
      if (listingMargin >= minMargin && listingMargin <= maxMargin) {
        score = 1;
      } else if (listingMargin < minMargin) {
        score = listingMargin / minMargin;
        passed = false;
      } else {
        score = maxMargin / listingMargin;
      }
    } else if (minMargin !== null) {
      score = listingMargin >= minMargin ? 1 : listingMargin / minMargin;
      passed = listingMargin >= minMargin;
    }

    return {
      key: 'operatingMargin',
      score: Math.max(0, Math.min(1, score)),
      importance,
      mustHave,
      passed,
      meta: { listingMargin: (listingMargin * 100).toFixed(1) + '%', minMargin, maxMargin }
    };
  }

  /**
   * Score storage revenue mix
   */
  private scoreStorageMix(storageMix: any, listing: MarinaListing): CriterionScoreBreakdown {
    const includedDepartments = storageMix.includedDepartments || STORAGE_DEPARTMENTS;
    const minShare = storageMix.minStorageShare ? parseFloat(storageMix.minStorageShare) : null;
    const importance = storageMix.storageMixImportance || 5;
    const mustHave = storageMix.storageMixMustHave ?? true;

    // Get revenue breakdown from listing (if available in revenueByDepartment JSON field)
    const revenueByDept = listing.revenueByDepartment as Record<string, number> | null;
    
    if (!revenueByDept || !listing.totalRevenue) {
      return {
        key: 'storageMix',
        score: 0.5,
        importance,
        mustHave: false,
        passed: true,
        meta: { storageShare: 'unknown', minShare, includedDepartments }
      };
    }

    const totalRevenue = parseFloat(String(listing.totalRevenue));
    let storageRevenue = 0;

    for (const dept of includedDepartments) {
      if (revenueByDept[dept]) {
        storageRevenue += revenueByDept[dept];
      }
    }

    const storageShare = totalRevenue > 0 ? storageRevenue / totalRevenue : 0;
    const score = minShare !== null ? Math.min(1, storageShare / minShare) : 1;
    const passed = minShare === null || storageShare >= minShare;

    return {
      key: 'storageMix',
      score,
      importance,
      mustHave,
      passed,
      meta: { 
        storageShare: (storageShare * 100).toFixed(1) + '%',
        storageRevenue,
        totalRevenue,
        minShare: minShare ? (minShare * 100).toFixed(0) + '%' : null,
        includedDepartments
      }
    };
  }

  /**
   * Score department exclusions and preferences
   */
  private scoreDepartments(departments: any, listing: MarinaListing): CriterionScoreBreakdown {
    const excludedDepts = departments.excludedDepartments || [];
    const preferredDepts = departments.preferredDepartments || [];
    const maxSharePerDept = departments.maxSharePerDepartment || {};
    const excludeThreshold = departments.excludeThreshold ? parseFloat(departments.excludeThreshold) : 0.01;

    const revenueByDept = listing.revenueByDepartment as Record<string, number> | null;
    const totalRevenue = listing.totalRevenue ? parseFloat(String(listing.totalRevenue)) : 0;

    let score = 0.5; // Base score
    let passed = true;
    const violations: string[] = [];
    const bonuses: string[] = [];

    if (revenueByDept && totalRevenue > 0) {
      // Check exclusions
      for (const dept of excludedDepts) {
        const deptRevenue = revenueByDept[dept] || 0;
        const share = deptRevenue / totalRevenue;
        if (share > excludeThreshold) {
          passed = false;
          violations.push(`${dept}: ${(share * 100).toFixed(1)}%`);
        }
      }

      // Check max share limits
      for (const [dept, maxShare] of Object.entries(maxSharePerDept)) {
        const deptRevenue = revenueByDept[dept] || 0;
        const share = deptRevenue / totalRevenue;
        if (share > (maxShare as number)) {
          score -= 0.1; // Penalty for exceeding cap
          violations.push(`${dept} exceeds cap: ${(share * 100).toFixed(1)}% > ${((maxShare as number) * 100).toFixed(0)}%`);
        }
      }

      // Add bonuses for preferred departments
      for (const dept of preferredDepts) {
        if (revenueByDept[dept] && revenueByDept[dept] > 0) {
          score += 0.1;
          bonuses.push(dept);
        }
      }
    }

    return {
      key: 'departments',
      score: Math.max(0, Math.min(1, score)),
      importance: 3,
      mustHave: false,
      passed,
      meta: { violations, bonuses, excludedDepts, preferredDepts }
    };
  }

  /**
   * Score storage types and rates
   */
  private scoreStorageTypes(storageTypes: any, listing: MarinaListing): CriterionScoreBreakdown {
    const desiredTypes = storageTypes.desiredTypes || [];
    const minTotalSlips = storageTypes.minTotalSlips;
    const storageRates = storageTypes.storageRates || [];
    const importance = storageTypes.storageTypesImportance || 3;
    const mustHave = storageTypes.storageTypesMustHave ?? false;

    let score = 0;
    let passed = true;
    const presentTypes: string[] = [];
    const missingTypes: string[] = [];

    // Check slip counts (using available listing data)
    const totalSlips = listing.totalSlips || 0;
    if (minTotalSlips && totalSlips < minTotalSlips) {
      passed = false;
      score = totalSlips / minTotalSlips;
    } else {
      score = 1;
    }

    // Check desired storage types (based on listing amenities/features)
    const listingTypes: string[] = [];
    if (listing.wetSlips && listing.wetSlips > 0) listingTypes.push("Wet Slips");
    if (listing.dryStorage && listing.dryStorage > 0) listingTypes.push("Dry Racks");
    // Add more type detection as listing schema expands

    for (const type of desiredTypes) {
      if (listingTypes.includes(type)) {
        presentTypes.push(type);
      } else {
        missingTypes.push(type);
      }
    }

    // Adjust score based on type presence
    if (desiredTypes.length > 0) {
      const typeScore = presentTypes.length / desiredTypes.length;
      score = (score + typeScore) / 2;
    }

    return {
      key: 'storageTypes',
      score: Math.max(0, Math.min(1, score)),
      importance,
      mustHave,
      passed: passed && missingTypes.length === 0,
      meta: { 
        totalSlips, 
        minTotalSlips, 
        presentTypes, 
        missingTypes,
        desiredTypes 
      }
    };
  }

  /**
   * Score size criteria
   */
  private scoreSize(size: any, listing: MarinaListing): CriterionScoreBreakdown {
    let score = 1;
    const meta: Record<string, any> = {};

    const minSlips = size.minTotalSlips;
    const maxSlips = size.maxTotalSlips;
    const listingSlips = listing.totalSlips || 0;

    if (minSlips && listingSlips < minSlips) {
      score = Math.min(score, listingSlips / minSlips);
      meta.slipsBelowMin = true;
    }
    if (maxSlips && listingSlips > maxSlips) {
      score = Math.min(score, maxSlips / listingSlips);
      meta.slipsAboveMax = true;
    }

    meta.listingSlips = listingSlips;
    meta.minSlips = minSlips;
    meta.maxSlips = maxSlips;

    return {
      key: 'size',
      score: Math.max(0, Math.min(1, score)),
      importance: 3,
      mustHave: false,
      passed: true,
      meta
    };
  }

  /**
   * Score a single listing against a criteria profile and save the result
   */
  async scoreAndSaveListing(
    profileId: string, 
    listingId: string, 
    orgId: string
  ): Promise<MatchScoreResult | null> {
    // Load profile and listing
    const criteria = await this.loadFullCriteriaProfile(profileId, orgId);
    if (!criteria) return null;

    const [listing] = await db.select()
      .from(marinaListings)
      .where(eq(marinaListings.id, listingId));
    
    if (!listing) return null;

    // Compute score
    const result = this.computeMatchScore(criteria, listing);

    // Save to database
    await db.insert(marinaListingMatches)
      .values({
        listingId,
        criteriaProfileId: profileId,
        orgId,
        overallScore: Math.round(result.overallScore * 100),
        locationScore: Math.round((result.breakdown.find(b => b.key === 'geography')?.score || 0) * 100),
        financialScore: Math.round((result.breakdown.find(b => b.key === 'price')?.score || 0) * 100),
        sizeScore: Math.round((result.breakdown.find(b => b.key === 'size')?.score || 0) * 100),
        scoreBreakdown: result.breakdown,
        passesHardRequirements: result.passesAllMustHave,
        disqualificationReasons: result.failedReasons.length > 0 ? result.failedReasons : null,
      })
      .onConflictDoUpdate({
        target: [marinaListingMatches.listingId, marinaListingMatches.criteriaProfileId],
        set: {
          overallScore: Math.round(result.overallScore * 100),
          scoreBreakdown: result.breakdown,
          passesHardRequirements: result.passesAllMustHave,
          disqualificationReasons: result.failedReasons.length > 0 ? result.failedReasons : null,
          calculatedAt: new Date(),
        }
      });

    return result;
  }

  /**
   * Score all listings for a given criteria profile
   */
  async scoreAllListingsForProfile(profileId: string, orgId: string): Promise<number> {
    const criteria = await this.loadFullCriteriaProfile(profileId, orgId);
    if (!criteria) return 0;

    // Get all active listings
    const listings = await db.select()
      .from(marinaListings)
      .where(eq(marinaListings.status, 'active'));

    let scoredCount = 0;
    for (const listing of listings) {
      const result = this.computeMatchScore(criteria, listing);
      
      // Save result
      await db.insert(marinaListingMatches)
        .values({
          listingId: listing.id,
          criteriaProfileId: profileId,
          orgId,
          overallScore: Math.round(result.overallScore * 100),
          scoreBreakdown: result.breakdown,
          passesHardRequirements: result.passesAllMustHave,
          disqualificationReasons: result.failedReasons.length > 0 ? result.failedReasons : null,
        })
        .onConflictDoUpdate({
          target: [marinaListingMatches.listingId, marinaListingMatches.criteriaProfileId],
          set: {
            overallScore: Math.round(result.overallScore * 100),
            scoreBreakdown: result.breakdown,
            passesHardRequirements: result.passesAllMustHave,
            disqualificationReasons: result.failedReasons.length > 0 ? result.failedReasons : null,
            calculatedAt: new Date(),
          }
        });
      
      scoredCount++;
    }

    return scoredCount;
  }
}

export const matchScoringService = new MatchScoringService();
