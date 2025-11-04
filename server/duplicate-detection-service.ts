import { db } from './db';
import { crmContacts, crmCompanies } from '@shared/schema';
import { eq, or, ilike, sql } from 'drizzle-orm';

export interface DuplicateMatch {
  existingContact: any;
  matchedBy: 'email' | 'phone' | 'name_and_company';
  confidence: number; // 0-100
  suggestedAction: 'merge' | 'skip' | 'create_new';
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  matches: DuplicateMatch[];
  recommendation: 'merge' | 'skip' | 'create_new';
}

export class DuplicateDetectionService {
  /**
   * Find duplicate contacts
   */
  static async findDuplicates(contactData: any, ownerId: string): Promise<DuplicateDetectionResult> {
    const matches: DuplicateMatch[] = [];

    // Search by email
    if (contactData.email) {
      const emailMatches = await this.findByEmail(contactData.email, ownerId);
      matches.push(...emailMatches.map(contact => ({
        existingContact: contact,
        matchedBy: 'email' as const,
        confidence: 95,
        suggestedAction: 'merge' as const,
      })));
    }

    // Search by phone
    if (contactData.phone && matches.length === 0) {
      const phoneMatches = await this.findByPhone(contactData.phone, ownerId);
      matches.push(...phoneMatches.map(contact => ({
        existingContact: contact,
        matchedBy: 'phone' as const,
        confidence: 85,
        suggestedAction: 'merge' as const,
      })));
    }

    // Search by name + company (fuzzy match)
    if (matches.length === 0 && contactData.firstName && contactData.lastName && contactData.company) {
      const nameCompanyMatches = await this.findByNameAndCompany(
        contactData.firstName,
        contactData.lastName,
        contactData.company,
        ownerId
      );
      matches.push(...nameCompanyMatches.map(contact => ({
        existingContact: contact,
        matchedBy: 'name_and_company' as const,
        confidence: 70,
        suggestedAction: 'merge' as const,
      })));
    }

    // Determine recommendation
    let recommendation: 'merge' | 'skip' | 'create_new' = 'create_new';
    if (matches.length > 0) {
      const highestConfidence = Math.max(...matches.map(m => m.confidence));
      if (highestConfidence >= 90) {
        recommendation = 'merge';
      } else if (highestConfidence >= 70) {
        recommendation = 'merge'; // Let user decide via UI
      }
    }

    return {
      isDuplicate: matches.length > 0,
      matches,
      recommendation,
    };
  }

  /**
   * Find contacts by email
   */
  private static async findByEmail(email: string, ownerId: string): Promise<any[]> {
    const normalizedEmail = email.toLowerCase().trim();
    
    return db.select()
      .from(crmContacts)
      .where(
        sql`LOWER(${crmContacts.email}) = ${normalizedEmail} AND ${crmContacts.ownerId} = ${ownerId}`
      )
      .limit(5);
  }

  /**
   * Find contacts by phone
   */
  private static async findByPhone(phone: string, ownerId: string): Promise<any[]> {
    // Remove all non-digit characters for comparison
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Match last 10 digits (handles +1 country code)
    const last10Digits = cleanPhone.slice(-10);
    
    return db.select()
      .from(crmContacts)
      .where(
        sql`REGEXP_REPLACE(${crmContacts.phone}, '[^0-9]', '', 'g') LIKE ${'%' + last10Digits} AND ${crmContacts.ownerId} = ${ownerId}`
      )
      .limit(5);
  }

  /**
   * Find contacts by name and company
   */
  private static async findByNameAndCompany(
    firstName: string,
    lastName: string,
    company: string,
    ownerId: string
  ): Promise<any[]> {
    return db.select()
      .from(crmContacts)
      .where(
        sql`${crmContacts.firstName} ILIKE ${firstName} 
        AND ${crmContacts.lastName} ILIKE ${lastName} 
        AND ${crmContacts.company} ILIKE ${company}
        AND ${crmContacts.ownerId} = ${ownerId}`
      )
      .limit(5);
  }

  /**
   * Merge contact data (for update strategy)
   */
  static mergeContactData(existing: any, newData: any): any {
    const merged = { ...existing };

    // Update fields if new data has non-empty values
    for (const [key, value] of Object.entries(newData)) {
      if (value && value !== '') {
        // For arrays (labels), merge instead of replace
        if (Array.isArray(value) && Array.isArray(existing[key])) {
          merged[key] = [...new Set([...existing[key], ...value])];
        } else {
          merged[key] = value;
        }
      }
    }

    // Preserve original creation timestamp
    merged.createdAt = existing.createdAt;
    merged.updatedAt = new Date();

    return merged;
  }

  /**
   * Apply duplicate strategy
   */
  static async applyStrategy(
    contactData: any,
    duplicateResult: DuplicateDetectionResult,
    strategy: 'skip' | 'update' | 'create_new',
    ownerId: string
  ): Promise<{ action: string; contact: any | null; matchedBy?: string }> {
    if (!duplicateResult.isDuplicate || strategy === 'create_new') {
      return {
        action: 'created',
        contact: contactData,
      };
    }

    if (strategy === 'skip') {
      return {
        action: 'skipped',
        contact: null,
        matchedBy: duplicateResult.matches[0]?.matchedBy,
      };
    }

    if (strategy === 'update') {
      const bestMatch = duplicateResult.matches[0];
      const mergedData = this.mergeContactData(bestMatch.existingContact, contactData);
      return {
        action: 'updated',
        contact: { ...mergedData, id: bestMatch.existingContact.id },
        matchedBy: bestMatch.matchedBy,
      };
    }

    return {
      action: 'created',
      contact: contactData,
    };
  }
}
