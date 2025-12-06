import { db } from "../db";
import { 
  crmMatchResults, 
  crmProperties, 
  crmContacts, 
  crmCompanies,
  pendingProperties,
  pendingContacts,
  pendingCompanies,
  propertyCompanies,
  contactProperties
} from "@shared/schema";
import { eq, and, or, ilike, sql, inArray } from "drizzle-orm";

type MatchReason = 
  | 'name_match'
  | 'address_match' 
  | 'company_match'
  | 'state_match'
  | 'property_match'
  | 'principal_match'
  | 'first_last_name_match';

interface MatchResult {
  entityId: string;
  entityType: 'property' | 'contact' | 'company';
  confidenceScore: number;
  matchedFields: string[];
  matchReasons: MatchReason[];
  fieldScores: Record<string, number>;
  matchReason: string;
}

function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

function fuzzyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA || !normB) return false;
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

function calculateConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export class DuplicateMatchingService {
  
  async findPropertyDuplicates(orgId: string, pending: {
    marinaName: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  }): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];
    
    const existingProperties = await db.select({
      id: crmProperties.id,
      name: crmProperties.name,
      address: crmProperties.address,
      city: crmProperties.city,
      state: crmProperties.state,
      ownerCompanyId: crmProperties.ownerCompanyId,
      ownerContactId: crmProperties.ownerContactId,
    })
    .from(crmProperties)
    .where(eq(crmProperties.orgId, orgId));
    
    for (const prop of existingProperties) {
      const matchReasons: MatchReason[] = [];
      const matchedFields: string[] = [];
      const fieldScores: Record<string, number> = {};
      let totalScore = 0;
      
      if (fuzzyMatch(pending.marinaName, prop.name)) {
        matchReasons.push('name_match');
        matchedFields.push('name');
        fieldScores.name = 40;
        totalScore += 40;
      }
      
      if (fuzzyMatch(pending.address, prop.address)) {
        matchReasons.push('address_match');
        matchedFields.push('address');
        fieldScores.address = 35;
        totalScore += 35;
      }
      
      if (pending.city && prop.city && fuzzyMatch(pending.city, prop.city)) {
        matchedFields.push('city');
        fieldScores.city = 10;
        totalScore += 10;
      }
      
      if (pending.state && prop.state && normalizeText(pending.state) === normalizeText(prop.state)) {
        matchedFields.push('state');
        fieldScores.state = 5;
        totalScore += 5;
      }
      
      if (matchReasons.length > 0) {
        matches.push({
          entityId: prop.id,
          entityType: 'property',
          confidenceScore: Math.min(totalScore, 100),
          matchedFields,
          matchReasons,
          fieldScores,
          matchReason: `Matched on: ${matchedFields.join(', ')}`
        });
      }
    }
    
    return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
  
  async findContactDuplicates(orgId: string, pending: {
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    email: string | null;
    companyId: string | null;
  }): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];
    
    const existingContacts = await db.select({
      id: crmContacts.id,
      firstName: crmContacts.firstName,
      lastName: crmContacts.lastName,
      email: crmContacts.email,
      companyId: crmContacts.companyId,
    })
    .from(crmContacts)
    .where(eq(crmContacts.orgId, orgId));
    
    let pendingCompanyState: string | null = null;
    if (pending.companyId) {
      const [company] = await db.select({ state: crmCompanies.state })
        .from(crmCompanies)
        .where(and(eq(crmCompanies.id, pending.companyId), eq(crmCompanies.orgId, orgId)))
        .limit(1);
      pendingCompanyState = company?.state || null;
    }
    
    for (const contact of existingContacts) {
      const matchReasons: MatchReason[] = [];
      const matchedFields: string[] = [];
      const fieldScores: Record<string, number> = {};
      let totalScore = 0;
      
      const pendingFirstName = pending.firstName || pending.fullName?.split(' ')[0];
      const pendingLastName = pending.lastName || pending.fullName?.split(' ').slice(1).join(' ');
      
      if (fuzzyMatch(pendingFirstName, contact.firstName) && fuzzyMatch(pendingLastName, contact.lastName)) {
        matchReasons.push('first_last_name_match');
        matchedFields.push('firstName', 'lastName');
        fieldScores.firstName = 25;
        fieldScores.lastName = 25;
        totalScore += 50;
      }
      
      if (pending.companyId && contact.companyId && pending.companyId === contact.companyId) {
        matchReasons.push('company_match');
        matchedFields.push('companyId');
        fieldScores.companyId = 20;
        totalScore += 20;
      }
      
      if (pendingCompanyState && contact.companyId) {
        const [contactCompany] = await db.select({ state: crmCompanies.state })
          .from(crmCompanies)
          .where(and(eq(crmCompanies.id, contact.companyId), eq(crmCompanies.orgId, orgId)))
          .limit(1);
        if (contactCompany?.state && normalizeText(pendingCompanyState) === normalizeText(contactCompany.state)) {
          matchReasons.push('state_match');
          matchedFields.push('companyState');
          fieldScores.companyState = 10;
          totalScore += 10;
        }
      }
      
      if (matchReasons.length > 0) {
        matches.push({
          entityId: contact.id,
          entityType: 'contact',
          confidenceScore: Math.min(totalScore, 100),
          matchedFields,
          matchReasons,
          fieldScores,
          matchReason: `Matched on: ${matchedFields.join(', ')}`
        });
      }
    }
    
    return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
  
  async findCompanyDuplicates(orgId: string, pending: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
  }): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];
    
    const existingCompanies = await db.select({
      id: crmCompanies.id,
      name: crmCompanies.name,
      address: crmCompanies.address,
      city: crmCompanies.city,
      state: crmCompanies.state,
    })
    .from(crmCompanies)
    .where(eq(crmCompanies.orgId, orgId));
    
    for (const company of existingCompanies) {
      const matchReasons: MatchReason[] = [];
      const matchedFields: string[] = [];
      const fieldScores: Record<string, number> = {};
      let totalScore = 0;
      
      if (fuzzyMatch(pending.name, company.name)) {
        matchReasons.push('name_match');
        matchedFields.push('name');
        fieldScores.name = 50;
        totalScore += 50;
      }
      
      if (fuzzyMatch(pending.address, company.address)) {
        matchReasons.push('address_match');
        matchedFields.push('address');
        fieldScores.address = 25;
        totalScore += 25;
      }
      
      if (pending.city && company.city && fuzzyMatch(pending.city, company.city)) {
        matchedFields.push('city');
        fieldScores.city = 10;
        totalScore += 10;
      }
      
      if (pending.state && company.state && normalizeText(pending.state) === normalizeText(company.state)) {
        matchedFields.push('state');
        fieldScores.state = 5;
        totalScore += 5;
      }
      
      if (matchReasons.length > 0) {
        matches.push({
          entityId: company.id,
          entityType: 'company',
          confidenceScore: Math.min(totalScore, 100),
          matchedFields,
          matchReasons,
          fieldScores,
          matchReason: `Matched on: ${matchedFields.join(', ')}`
        });
      }
    }
    
    return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
  
  async runDuplicateDetection(
    orgId: string,
    pendingType: 'property' | 'contact' | 'company',
    pendingId: string
  ): Promise<MatchResult[]> {
    await db.delete(crmMatchResults)
      .where(and(
        eq(crmMatchResults.orgId, orgId),
        eq(crmMatchResults.pendingType, pendingType),
        eq(crmMatchResults.pendingId, pendingId)
      ));
    
    let matches: MatchResult[] = [];
    
    if (pendingType === 'property') {
      const [pending] = await db.select()
        .from(pendingProperties)
        .where(and(eq(pendingProperties.id, pendingId), eq(pendingProperties.orgId, orgId)))
        .limit(1);
      
      if (pending) {
        matches = await this.findPropertyDuplicates(orgId, {
          marinaName: pending.marinaName,
          address: pending.address,
          city: pending.city,
          state: pending.state,
        });
      }
    } else if (pendingType === 'contact') {
      const [pending] = await db.select()
        .from(pendingContacts)
        .where(and(eq(pendingContacts.id, pendingId), eq(pendingContacts.orgId, orgId)))
        .limit(1);
      
      if (pending) {
        matches = await this.findContactDuplicates(orgId, {
          firstName: pending.firstName,
          lastName: pending.lastName,
          fullName: pending.fullName,
          email: pending.email,
          companyId: pending.companyId,
        });
      }
    } else if (pendingType === 'company') {
      const [pending] = await db.select()
        .from(pendingCompanies)
        .where(and(eq(pendingCompanies.id, pendingId), eq(pendingCompanies.orgId, orgId)))
        .limit(1);
      
      if (pending) {
        matches = await this.findCompanyDuplicates(orgId, {
          name: pending.name,
          address: pending.address,
          city: pending.city,
          state: pending.state,
        });
      }
    }
    
    if (matches.length > 0) {
      const matchRecords = matches.slice(0, 5).map(match => ({
        orgId,
        pendingType,
        pendingId,
        matchEntityType: match.entityType,
        matchEntityId: match.entityId,
        confidenceScore: match.confidenceScore,
        confidenceLevel: calculateConfidenceLevel(match.confidenceScore),
        matchedFields: match.matchedFields,
        fieldScores: match.fieldScores,
        matchReason: match.matchReason,
      }));
      
      await db.insert(crmMatchResults).values(matchRecords);
    }
    
    return matches;
  }
  
  async getMatchesForPending(
    orgId: string,
    pendingType: 'property' | 'contact' | 'company',
    pendingId: string
  ) {
    return db.select()
      .from(crmMatchResults)
      .where(and(
        eq(crmMatchResults.orgId, orgId),
        eq(crmMatchResults.pendingType, pendingType),
        eq(crmMatchResults.pendingId, pendingId),
        sql`${crmMatchResults.resolution} IS NULL`
      ))
      .orderBy(sql`${crmMatchResults.confidenceScore} DESC`);
  }
  
  async resolveDuplicate(
    orgId: string,
    pendingType: 'property' | 'contact' | 'company',
    pendingId: string,
    resolution: 'merge' | 'reject' | 'create_new',
    resolvedBy: string,
    targetEntityId?: string
  ) {
    if (resolution === 'merge' && targetEntityId) {
      await db.update(crmMatchResults)
        .set({
          resolution: 'merged',
          resolvedBy,
          resolvedAt: new Date(),
        })
        .where(and(
          eq(crmMatchResults.orgId, orgId),
          eq(crmMatchResults.pendingId, pendingId),
          eq(crmMatchResults.matchEntityId, targetEntityId)
        ));
    }
    
    await db.update(crmMatchResults)
      .set({
        resolution: resolution === 'create_new' ? 'accepted' : resolution === 'reject' ? 'rejected' : 'merged',
        resolvedBy,
        resolvedAt: new Date(),
      })
      .where(and(
        eq(crmMatchResults.orgId, orgId),
        eq(crmMatchResults.pendingId, pendingId)
      ));
    
    return { success: true };
  }
}

export const duplicateMatchingService = new DuplicateMatchingService();
