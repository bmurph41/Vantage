import { db } from "../db";
import { 
  crmProperties, 
  crmContacts, 
  crmCompanies, 
  crmMatchResults,
  salesComps,
  InsertCrmMatchResult
} from "@shared/schema";
import { eq, and, ilike, or, sql, inArray, not } from "drizzle-orm";
import { logger } from "../utils/logger";

export interface MatchResult {
  entityId: string;
  entityType: 'property' | 'contact' | 'company';
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  matchedFields: Array<{ field: string; sourceValue: string; matchValue: string; score: number }>;
  fieldScores: Record<string, number>;
  matchReason: string;
  isInPortfolio?: boolean;
  isOnWatchlist?: boolean;
}

export interface MatchCandidate {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  email?: string;
  phone?: string;
  website?: string;
}

const CONFIDENCE_THRESHOLDS = {
  HIGH: 85,
  MEDIUM: 70,
  LOW: 50,
};

const FIELD_WEIGHTS = {
  name: 40,
  address: 25,
  city: 10,
  state: 5,
  zipCode: 10,
  email: 30,
  phone: 25,
  website: 20,
};

function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[s1.length][s2.length];
}

function jaroWinklerSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchWindow = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 1);
  
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(marina|llc|inc|corp|ltd|co|company|enterprises?|holdings?|group|properties)\b/gi, '')
    .trim();
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

function normalizeAddress(address: string | null | undefined): string {
  if (!address) return '';
  return address
    .toLowerCase()
    .replace(/\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|place|pl|way|highway|hwy|parkway|pkwy|circle|cir)\b/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateFieldScore(sourceValue: string | null | undefined, targetValue: string | null | undefined, isAddress = false, isPhone = false): number {
  if (!sourceValue || !targetValue) return 0;
  
  let s1 = isAddress ? normalizeAddress(sourceValue) : isPhone ? normalizePhone(sourceValue) : normalizeString(sourceValue);
  let s2 = isAddress ? normalizeAddress(targetValue) : isPhone ? normalizePhone(targetValue) : normalizeString(targetValue);
  
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 100;

  const jaroScore = jaroWinklerSimilarity(s1, s2) * 100;
  
  const maxLen = Math.max(s1.length, s2.length);
  const levDist = levenshteinDistance(s1, s2);
  const levScore = ((maxLen - levDist) / maxLen) * 100;
  
  return Math.round((jaroScore * 0.6 + levScore * 0.4));
}

function calculateConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

export class CrmMatchingService {
  async findPropertyMatches(
    orgId: string,
    candidate: MatchCandidate,
    excludeIds: string[] = []
  ): Promise<MatchResult[]> {
    const results: MatchResult[] = [];
    
    const properties = await db
      .select()
      .from(crmProperties)
      .where(
        and(
          eq(crmProperties.orgId, orgId),
          excludeIds.length > 0 ? not(inArray(crmProperties.id, excludeIds)) : undefined
        )
      );

    for (const property of properties) {
      const matchedFields: MatchResult['matchedFields'] = [];
      const fieldScores: Record<string, number> = {};
      let totalWeight = 0;
      let weightedScore = 0;

      if (candidate.name && property.name) {
        const score = calculateFieldScore(candidate.name, property.name);
        fieldScores.name = score;
        if (score > 0) {
          matchedFields.push({ field: 'name', sourceValue: candidate.name, matchValue: property.name, score });
          weightedScore += score * FIELD_WEIGHTS.name;
          totalWeight += FIELD_WEIGHTS.name;
        }
      }

      if (candidate.address && property.address) {
        const score = calculateFieldScore(candidate.address, property.address, true);
        fieldScores.address = score;
        if (score > 0) {
          matchedFields.push({ field: 'address', sourceValue: candidate.address, matchValue: property.address, score });
          weightedScore += score * FIELD_WEIGHTS.address;
          totalWeight += FIELD_WEIGHTS.address;
        }
      }

      if (candidate.city && property.city) {
        const score = calculateFieldScore(candidate.city, property.city);
        fieldScores.city = score;
        if (score > 0) {
          matchedFields.push({ field: 'city', sourceValue: candidate.city, matchValue: property.city, score });
          weightedScore += score * FIELD_WEIGHTS.city;
          totalWeight += FIELD_WEIGHTS.city;
        }
      }

      if (candidate.state && property.state) {
        const score = candidate.state.toLowerCase() === property.state.toLowerCase() ? 100 : 0;
        fieldScores.state = score;
        if (score > 0) {
          matchedFields.push({ field: 'state', sourceValue: candidate.state, matchValue: property.state, score });
          weightedScore += score * FIELD_WEIGHTS.state;
          totalWeight += FIELD_WEIGHTS.state;
        }
      }

      if (candidate.zipCode && property.zipCode) {
        const score = candidate.zipCode === property.zipCode ? 100 : 
                     candidate.zipCode.substring(0, 5) === property.zipCode?.substring(0, 5) ? 90 : 0;
        fieldScores.zipCode = score;
        if (score > 0) {
          matchedFields.push({ field: 'zipCode', sourceValue: candidate.zipCode, matchValue: property.zipCode || '', score });
          weightedScore += score * FIELD_WEIGHTS.zipCode;
          totalWeight += FIELD_WEIGHTS.zipCode;
        }
      }

      if (totalWeight === 0) continue;

      const confidenceScore = Math.round(weightedScore / totalWeight);
      const confidenceLevel = calculateConfidenceLevel(confidenceScore);

      if (confidenceScore >= CONFIDENCE_THRESHOLDS.LOW) {
        results.push({
          entityId: property.id,
          entityType: 'property',
          confidenceScore,
          confidenceLevel,
          matchedFields,
          fieldScores,
          matchReason: `Matched on ${matchedFields.map(f => f.field).join(', ')}`,
          isInPortfolio: property.isInPortfolio || false,
          isOnWatchlist: property.isOnWatchlist || false,
        });
      }
    }

    return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  async findContactMatches(
    orgId: string,
    candidate: MatchCandidate & { firstName?: string; lastName?: string },
    excludeIds: string[] = []
  ): Promise<MatchResult[]> {
    const results: MatchResult[] = [];
    
    const contacts = await db
      .select()
      .from(crmContacts)
      .where(
        and(
          eq(crmContacts.orgId, orgId),
          excludeIds.length > 0 ? not(inArray(crmContacts.id, excludeIds)) : undefined
        )
      );

    for (const contact of contacts) {
      const matchedFields: MatchResult['matchedFields'] = [];
      const fieldScores: Record<string, number> = {};
      let totalWeight = 0;
      let weightedScore = 0;

      const candidateName = candidate.name || 
        [candidate.firstName, candidate.lastName].filter(Boolean).join(' ');
      const contactFullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

      if (candidateName && contactFullName) {
        const score = calculateFieldScore(candidateName, contactFullName);
        fieldScores.name = score;
        if (score > 0) {
          matchedFields.push({ field: 'name', sourceValue: candidateName, matchValue: contactFullName, score });
          weightedScore += score * FIELD_WEIGHTS.name;
          totalWeight += FIELD_WEIGHTS.name;
        }
      }

      if (candidate.email && contact.email) {
        const sourceEmail = candidate.email.toLowerCase().trim();
        const targetEmail = contact.email.toLowerCase().trim();
        const score = sourceEmail === targetEmail ? 100 : calculateFieldScore(sourceEmail, targetEmail);
        fieldScores.email = score;
        if (score > 0) {
          matchedFields.push({ field: 'email', sourceValue: candidate.email, matchValue: contact.email, score });
          weightedScore += score * FIELD_WEIGHTS.email;
          totalWeight += FIELD_WEIGHTS.email;
        }
      }

      if (candidate.phone && contact.phone) {
        const score = calculateFieldScore(candidate.phone, contact.phone, false, true);
        fieldScores.phone = score;
        if (score > 0) {
          matchedFields.push({ field: 'phone', sourceValue: candidate.phone, matchValue: contact.phone, score });
          weightedScore += score * FIELD_WEIGHTS.phone;
          totalWeight += FIELD_WEIGHTS.phone;
        }
      }

      if (totalWeight === 0) continue;

      const confidenceScore = Math.round(weightedScore / totalWeight);
      const confidenceLevel = calculateConfidenceLevel(confidenceScore);

      if (confidenceScore >= CONFIDENCE_THRESHOLDS.LOW) {
        results.push({
          entityId: contact.id,
          entityType: 'contact',
          confidenceScore,
          confidenceLevel,
          matchedFields,
          fieldScores,
          matchReason: `Matched on ${matchedFields.map(f => f.field).join(', ')}`,
        });
      }
    }

    return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  async findCompanyMatches(
    orgId: string,
    candidate: MatchCandidate,
    excludeIds: string[] = []
  ): Promise<MatchResult[]> {
    const results: MatchResult[] = [];
    
    const companies = await db
      .select()
      .from(crmCompanies)
      .where(
        and(
          eq(crmCompanies.orgId, orgId),
          excludeIds.length > 0 ? not(inArray(crmCompanies.id, excludeIds)) : undefined
        )
      );

    for (const company of companies) {
      const matchedFields: MatchResult['matchedFields'] = [];
      const fieldScores: Record<string, number> = {};
      let totalWeight = 0;
      let weightedScore = 0;

      if (candidate.name && company.name) {
        const score = calculateFieldScore(candidate.name, company.name);
        fieldScores.name = score;
        if (score > 0) {
          matchedFields.push({ field: 'name', sourceValue: candidate.name, matchValue: company.name, score });
          weightedScore += score * FIELD_WEIGHTS.name;
          totalWeight += FIELD_WEIGHTS.name;
        }
      }

      if (candidate.address && company.address) {
        const score = calculateFieldScore(candidate.address, company.address, true);
        fieldScores.address = score;
        if (score > 0) {
          matchedFields.push({ field: 'address', sourceValue: candidate.address, matchValue: company.address, score });
          weightedScore += score * FIELD_WEIGHTS.address;
          totalWeight += FIELD_WEIGHTS.address;
        }
      }

      if (candidate.city && company.city) {
        const score = calculateFieldScore(candidate.city, company.city);
        fieldScores.city = score;
        if (score > 0) {
          matchedFields.push({ field: 'city', sourceValue: candidate.city, matchValue: company.city, score });
          weightedScore += score * FIELD_WEIGHTS.city;
          totalWeight += FIELD_WEIGHTS.city;
        }
      }

      if (candidate.state && company.state) {
        const score = candidate.state.toLowerCase() === company.state.toLowerCase() ? 100 : 0;
        fieldScores.state = score;
        if (score > 0) {
          matchedFields.push({ field: 'state', sourceValue: candidate.state, matchValue: company.state, score });
          weightedScore += score * FIELD_WEIGHTS.state;
          totalWeight += FIELD_WEIGHTS.state;
        }
      }

      if (candidate.website && company.website) {
        const normUrl = (url: string) => url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const sourceUrl = normUrl(candidate.website);
        const targetUrl = normUrl(company.website);
        const score = sourceUrl === targetUrl ? 100 : calculateFieldScore(sourceUrl, targetUrl);
        fieldScores.website = score;
        if (score > 0) {
          matchedFields.push({ field: 'website', sourceValue: candidate.website, matchValue: company.website, score });
          weightedScore += score * FIELD_WEIGHTS.website;
          totalWeight += FIELD_WEIGHTS.website;
        }
      }

      if (totalWeight === 0) continue;

      const confidenceScore = Math.round(weightedScore / totalWeight);
      const confidenceLevel = calculateConfidenceLevel(confidenceScore);

      if (confidenceScore >= CONFIDENCE_THRESHOLDS.LOW) {
        results.push({
          entityId: company.id,
          entityType: 'company',
          confidenceScore,
          confidenceLevel,
          matchedFields,
          fieldScores,
          matchReason: `Matched on ${matchedFields.map(f => f.field).join(', ')}`,
        });
      }
    }

    return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }

  async storeMatchResult(
    orgId: string,
    pendingType: 'property' | 'contact' | 'company',
    pendingId: string,
    match: MatchResult
  ): Promise<void> {
    const insertData: InsertCrmMatchResult = {
      orgId,
      pendingType,
      pendingId,
      matchEntityType: match.entityType,
      matchEntityId: match.entityId,
      confidenceScore: match.confidenceScore,
      confidenceLevel: match.confidenceLevel,
      matchedFields: match.matchedFields,
      fieldScores: match.fieldScores,
      matchReason: match.matchReason,
      isInPortfolio: match.isInPortfolio || false,
      isOnWatchlist: match.isOnWatchlist || false,
    };

    await db.insert(crmMatchResults).values(insertData);
    
    logger.info({ pendingType, pendingId, matchId: match.entityId, score: match.confidenceScore }, 
      'Stored match result');
  }

  async storeAllMatches(
    orgId: string,
    pendingType: 'property' | 'contact' | 'company',
    pendingId: string,
    matches: MatchResult[]
  ): Promise<void> {
    if (matches.length === 0) return;

    const insertData = matches.map(match => ({
      orgId,
      pendingType,
      pendingId,
      matchEntityType: match.entityType,
      matchEntityId: match.entityId,
      confidenceScore: match.confidenceScore,
      confidenceLevel: match.confidenceLevel,
      matchedFields: match.matchedFields,
      fieldScores: match.fieldScores,
      matchReason: match.matchReason,
      isInPortfolio: match.isInPortfolio || false,
      isOnWatchlist: match.isOnWatchlist || false,
    }));

    await db.insert(crmMatchResults).values(insertData);
    
    logger.info({ pendingType, pendingId, matchCount: matches.length }, 
      'Stored all match results');
  }

  async getMatchesForPending(pendingId: string): Promise<MatchResult[]> {
    const matches = await db
      .select()
      .from(crmMatchResults)
      .where(eq(crmMatchResults.pendingId, pendingId));

    return matches.map(m => ({
      entityId: m.matchEntityId,
      entityType: m.matchEntityType as 'property' | 'contact' | 'company',
      confidenceScore: m.confidenceScore,
      confidenceLevel: m.confidenceLevel as 'high' | 'medium' | 'low',
      matchedFields: m.matchedFields as MatchResult['matchedFields'],
      fieldScores: m.fieldScores as Record<string, number>,
      matchReason: m.matchReason || '',
      isInPortfolio: m.isInPortfolio || false,
      isOnWatchlist: m.isOnWatchlist || false,
    }));
  }

  async resolveMatch(
    matchId: string,
    resolution: 'link' | 'merge' | 'create_new' | 'skip',
    resolvedBy: string
  ): Promise<void> {
    await db
      .update(crmMatchResults)
      .set({
        resolution,
        resolvedBy,
        resolvedAt: new Date(),
      })
      .where(eq(crmMatchResults.id, matchId));

    logger.info({ matchId, resolution, resolvedBy }, 'Resolved match');
  }

  async getUnresolvedMatchesByOrg(orgId: string): Promise<any[]> {
    return db
      .select()
      .from(crmMatchResults)
      .where(
        and(
          eq(crmMatchResults.orgId, orgId),
          sql`${crmMatchResults.resolution} IS NULL`
        )
      );
  }
}

export const crmMatchingService = new CrmMatchingService();
