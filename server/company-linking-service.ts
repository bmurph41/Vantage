import { db } from './db';
import { crmCompanies } from '@shared/schema';
import { eq, ilike, sql } from 'drizzle-orm';

export interface CompanyLinkingResult {
  companyId: string | null;
  companyName: string;
  wasCreated: boolean;
  wasLinked: boolean;
}

export class CompanyLinkingService {
  /**
   * Parse and link company from contact data
   * Creates company if it doesn't exist, or links to existing company
   */
  static async linkCompany(
    companyName: string | null | undefined,
    ownerId: string
  ): Promise<CompanyLinkingResult> {
    if (!companyName || companyName.trim() === '') {
      return {
        companyId: null,
        companyName: '',
        wasCreated: false,
        wasLinked: false,
      };
    }

    const normalizedName = this.normalizeCompanyName(companyName);

    // Try to find existing company (case-insensitive search)
    const existingCompany = await this.findExistingCompany(normalizedName, ownerId);

    if (existingCompany) {
      return {
        companyId: existingCompany.id,
        companyName: existingCompany.name,
        wasCreated: false,
        wasLinked: true,
      };
    }

    // Create new company
    const newCompany = await this.createCompany(normalizedName, ownerId);

    return {
      companyId: newCompany.id,
      companyName: newCompany.name,
      wasCreated: true,
      wasLinked: false,
    };
  }

  /**
   * Normalize company name for consistent storage
   */
  private static normalizeCompanyName(name: string): string {
    // Trim whitespace
    let normalized = name.trim();

    // Remove common suffixes and standardize them
    const suffixMap: Record<string, string> = {
      ' LLC': ', LLC',
      ' Inc': ', Inc.',
      ' Corp': ', Corp.',
      ' Corporation': ', Corp.',
      ' Company': ', Co.',
      ' Co': ', Co.',
      ' Ltd': ', Ltd.',
      ' Limited': ', Ltd.',
      ' LP': ', LP',
      ' LLP': ', LLP',
      ' PA': ', PA',
      ' PC': ', PC',
    };

    for (const [suffix, replacement] of Object.entries(suffixMap)) {
      const regex = new RegExp(`${suffix}$`, 'i');
      if (regex.test(normalized)) {
        normalized = normalized.replace(regex, replacement);
        break;
      }
    }

    return normalized;
  }

  /**
   * Find existing company by name (case-insensitive, fuzzy match)
   */
  private static async findExistingCompany(
    name: string,
    ownerId: string
  ): Promise<any | null> {
    // Try exact match first (case-insensitive)
    const exactMatch = await db
      .select()
      .from(crmCompanies)
      .where(sql`LOWER(${crmCompanies.name}) = LOWER(${name}) AND ${crmCompanies.ownerId} = ${ownerId}`)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      return exactMatch[0];
    }

    // Try fuzzy match (similar names)
    const fuzzyMatch = await db
      .select()
      .from(crmCompanies)
      .where(sql`LOWER(${crmCompanies.name}) LIKE LOWER(${name + '%'}) AND ${crmCompanies.ownerId} = ${ownerId}`)
      .limit(1);

    if (fuzzyMatch && fuzzyMatch.length > 0) {
      return fuzzyMatch[0];
    }

    return null;
  }

  /**
   * Create new company
   */
  private static async createCompany(name: string, ownerId: string): Promise<any> {
    const [company] = await db
      .insert(crmCompanies)
      .values({
        name,
        ownerId,
      })
      .returning();

    return company;
  }

  /**
   * Batch link companies for multiple contacts
   */
  static async batchLinkCompanies(
    companyNames: string[],
    ownerId: string
  ): Promise<Map<string, CompanyLinkingResult>> {
    const results = new Map<string, CompanyLinkingResult>();
    const uniqueNames = [...new Set(companyNames.filter(name => name && name.trim() !== ''))];

    for (const name of uniqueNames) {
      const result = await this.linkCompany(name, ownerId);
      results.set(name, result);
    }

    return results;
  }
}
