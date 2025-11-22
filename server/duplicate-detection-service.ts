import { db } from './db';
import { crmContacts, crmCompanies, crmProperties } from '@shared/schema';
import { eq, or, ilike, sql } from 'drizzle-orm';

type MatchField = 'email' | 'phone' | 'name' | 'name_and_company' | 'address' | 'website' | 'marina_name_and_city';

export interface DuplicateMatch {
  existingEntity: any;
  matchedBy: MatchField;
  confidence: number; // 0-100
  suggestedAction: 'merge' | 'skip' | 'create_new';
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  recommendation: 'auto_merge' | 'prompt_user' | 'create_pending' | 'create_new';
  highestConfidence: number;
}

export class DuplicateDetectionService {
  /**
   * Find duplicate contacts
   */
  static async findContactDuplicates(contactData: any, orgId: string): Promise<DuplicateDetectionResult> {
    const matches: DuplicateMatch[] = [];

    // Search by email (95% confidence - exact match)
    if (contactData.email) {
      const emailMatches = await this.findContactsByEmail(contactData.email, orgId);
      matches.push(...emailMatches.map(contact => ({
        existingEntity: contact,
        matchedBy: 'email' as const,
        confidence: 95,
        suggestedAction: 'merge' as const,
      })));
    }

    // Search by phone (85% confidence - phone formatting variations)
    if (contactData.phone && matches.length === 0) {
      const phoneMatches = await this.findContactsByPhone(contactData.phone, orgId);
      matches.push(...phoneMatches.map(contact => ({
        existingEntity: contact,
        matchedBy: 'phone' as const,
        confidence: 85,
        suggestedAction: 'merge' as const,
      })));
    }

    // Search by name + company (70% confidence - fuzzy match)
    if (matches.length === 0 && contactData.firstName && contactData.lastName) {
      const nameMatches = await this.findContactsByName(
        contactData.firstName,
        contactData.lastName,
        orgId
      );
      matches.push(...nameMatches.map(contact => ({
        existingEntity: contact,
        matchedBy: 'name' as const,
        confidence: 70,
        suggestedAction: 'merge' as const,
      })));
    }

    return this.buildResult(matches);
  }

  /**
   * Find duplicate companies
   */
  static async findCompanyDuplicates(companyData: any, orgId: string): Promise<DuplicateDetectionResult> {
    const matches: DuplicateMatch[] = [];

    // Search by exact name (95% confidence)
    if (companyData.name) {
      const nameMatches = await this.findCompaniesByName(companyData.name, orgId);
      matches.push(...nameMatches.map(company => ({
        existingEntity: company,
        matchedBy: 'name' as const,
        confidence: 95,
        suggestedAction: 'merge' as const,
      })));
    }

    // Search by website (90% confidence)
    if (companyData.website && matches.length === 0) {
      const websiteMatches = await this.findCompaniesByWebsite(companyData.website, orgId);
      matches.push(...websiteMatches.map(company => ({
        existingEntity: company,
        matchedBy: 'website' as const,
        confidence: 90,
        suggestedAction: 'merge' as const,
      })));
    }

    // Search by phone (75% confidence)
    if (companyData.phone && matches.length === 0) {
      const phoneMatches = await this.findCompaniesByPhone(companyData.phone, orgId);
      matches.push(...phoneMatches.map(company => ({
        existingEntity: company,
        matchedBy: 'phone' as const,
        confidence: 75,
        suggestedAction: 'merge' as const,
      })));
    }

    return this.buildResult(matches);
  }

  /**
   * Find duplicate properties
   */
  static async findPropertyDuplicates(propertyData: any, orgId: string): Promise<DuplicateDetectionResult> {
    const matches: DuplicateMatch[] = [];

    // Search by marina name + city (95% confidence - exact match)
    if (propertyData.marinaName && propertyData.city) {
      const marinaMatches = await this.findPropertiesByMarinaNameAndCity(
        propertyData.marinaName,
        propertyData.city,
        orgId
      );
      matches.push(...marinaMatches.map(property => ({
        existingEntity: property,
        matchedBy: 'marina_name_and_city' as const,
        confidence: 95,
        suggestedAction: 'merge' as const,
      })));
    }

    // Search by full address (90% confidence)
    if (propertyData.address && matches.length === 0) {
      const addressMatches = await this.findPropertiesByAddress(propertyData.address, orgId);
      matches.push(...addressMatches.map(property => ({
        existingEntity: property,
        matchedBy: 'address' as const,
        confidence: 90,
        suggestedAction: 'merge' as const,
      })));
    }

    return this.buildResult(matches);
  }

  /**
   * Build result with confidence-based recommendation
   * 95%+ = auto_merge (exact matches like email, marina name+city)
   * 70-94% = prompt_user (similar but not exact)
   * <70% = create_pending (uncertain, needs manual review)
   */
  private static buildResult(matches: DuplicateMatch[]): DuplicateDetectionResult {
    const highestConfidence = matches.length > 0 ? Math.max(...matches.map(m => m.confidence)) : 0;
    
    let recommendation: 'auto_merge' | 'prompt_user' | 'create_pending' | 'create_new' = 'create_new';
    
    if (highestConfidence >= 95) {
      recommendation = 'auto_merge';
    } else if (highestConfidence >= 70) {
      recommendation = 'prompt_user';
    } else if (matches.length > 0) {
      recommendation = 'create_pending';
    }

    return {
      isDuplicate: matches.length > 0,
      matches,
      recommendation,
      highestConfidence,
    };
  }

  /**
   * Find contacts by email
   */
  private static async findContactsByEmail(email: string, orgId: string): Promise<any[]> {
    const normalizedEmail = email.toLowerCase().trim();
    
    return db.select()
      .from(crmContacts)
      .where(
        sql`LOWER(${crmContacts.email}) = ${normalizedEmail} AND ${crmContacts.ownerId} IN (SELECT id FROM users WHERE org_id = ${orgId})`
      )
      .limit(5);
  }

  /**
   * Find contacts by phone
   */
  private static async findContactsByPhone(phone: string, orgId: string): Promise<any[]> {
    const cleanPhone = phone.replace(/\D/g, '');
    const last10Digits = cleanPhone.slice(-10);
    
    return db.select()
      .from(crmContacts)
      .where(
        sql`REGEXP_REPLACE(${crmContacts.phone}, '[^0-9]', '', 'g') LIKE ${'%' + last10Digits} 
        AND ${crmContacts.ownerId} IN (SELECT id FROM users WHERE org_id = ${orgId})`
      )
      .limit(5);
  }

  /**
   * Find contacts by name
   */
  private static async findContactsByName(
    firstName: string,
    lastName: string,
    orgId: string
  ): Promise<any[]> {
    return db.select()
      .from(crmContacts)
      .where(
        sql`${crmContacts.firstName} ILIKE ${firstName} 
        AND ${crmContacts.lastName} ILIKE ${lastName}
        AND ${crmContacts.ownerId} IN (SELECT id FROM users WHERE org_id = ${orgId})`
      )
      .limit(5);
  }

  /**
   * Find companies by exact name
   */
  private static async findCompaniesByName(name: string, orgId: string): Promise<any[]> {
    const normalizedName = name.trim();
    
    return db.select()
      .from(crmCompanies)
      .where(
        sql`LOWER(${crmCompanies.name}) = LOWER(${normalizedName}) 
        AND ${crmCompanies.ownerId} IN (SELECT id FROM users WHERE org_id = ${orgId})`
      )
      .limit(5);
  }

  /**
   * Find companies by website
   */
  private static async findCompaniesByWebsite(website: string, orgId: string): Promise<any[]> {
    const normalizedWebsite = website.toLowerCase().trim().replace(/^(https?:\/\/)?(www\.)?/, '');
    
    return db.select()
      .from(crmCompanies)
      .where(
        sql`LOWER(REGEXP_REPLACE(COALESCE(${crmCompanies.website}, ''), '^(https?://)?(www\.)?', '', 'g')) = ${normalizedWebsite}
        AND ${crmCompanies.ownerId} IN (SELECT id FROM users WHERE org_id = ${orgId})`
      )
      .limit(5);
  }

  /**
   * Find companies by phone
   */
  private static async findCompaniesByPhone(phone: string, orgId: string): Promise<any[]> {
    const cleanPhone = phone.replace(/\D/g, '');
    const last10Digits = cleanPhone.slice(-10);
    
    return db.select()
      .from(crmCompanies)
      .where(
        sql`REGEXP_REPLACE(${crmCompanies.phone}, '[^0-9]', '', 'g') LIKE ${'%' + last10Digits}
        AND ${crmCompanies.ownerId} IN (SELECT id FROM users WHERE org_id = ${orgId})`
      )
      .limit(5);
  }

  /**
   * Find properties by marina name and city
   */
  private static async findPropertiesByMarinaNameAndCity(
    marinaName: string,
    city: string,
    orgId: string
  ): Promise<any[]> {
    const normalizedMarinaName = marinaName.trim();
    const normalizedCity = city.trim();
    
    return db.select()
      .from(crmProperties)
      .where(
        sql`LOWER(${crmProperties.title}) = LOWER(${normalizedMarinaName})
        AND LOWER(COALESCE((${crmProperties.specifications}->>'city')::text, '')) = LOWER(${normalizedCity})
        AND ${crmProperties.ownerId} IN (SELECT id FROM users WHERE org_id = ${orgId})`
      )
      .limit(5);
  }

  /**
   * Find properties by address
   */
  private static async findPropertiesByAddress(address: string, orgId: string): Promise<any[]> {
    const normalizedAddress = address.toLowerCase().trim();
    
    return db.select()
      .from(crmProperties)
      .where(
        sql`LOWER(${crmProperties.address}) = ${normalizedAddress}
        AND ${crmProperties.ownerId} IN (SELECT id FROM users WHERE org_id = ${orgId})`
      )
      .limit(5);
  }

  /**
   * Merge entity data (for auto-merge strategy)
   * Enriches existing data with new non-empty values
   */
  static mergeEntityData(existing: any, newData: any): any {
    const merged = { ...existing };

    for (const [key, value] of Object.entries(newData)) {
      if (value && value !== '') {
        if (Array.isArray(value) && Array.isArray(existing[key])) {
          merged[key] = [...new Set([...existing[key], ...value])];
        } else {
          merged[key] = value;
        }
      }
    }

    merged.createdAt = existing.createdAt;
    merged.updatedAt = new Date();

    return merged;
  }

  /**
   * Legacy method - kept for backwards compatibility
   */
  static mergeContactData(existing: any, newData: any): any {
    return this.mergeEntityData(existing, newData);
  }
}
