import { db } from "@db";
import { eq, and, desc, or, ilike } from "drizzle-orm";
import { 
  archivedContacts, 
  archivedCompanies, 
  archivePropertyAssociations,
  crmContacts,
  crmCompanies,
  crmContactProperties,
  crmCompanyProperties,
  crmProperties,
  salesComps,
  InsertArchivedContact,
  InsertArchivedCompany,
  InsertArchivePropertyAssociation,
  ArchivedContact,
  ArchivedCompany,
  ArchivePropertyAssociation
} from "@shared/schema";

export type ArchiveReason = "property_sold" | "out_of_industry" | "duplicate" | "inactive" | "deceased" | "other";

export interface ArchiveContactOptions {
  contactId: string;
  orgId: string;
  userId: string;
  archiveReason: ArchiveReason;
  archiveNotes?: string;
  salesCompId?: string;
  saleDate?: Date;
  deleteOriginal?: boolean;
}

export interface ArchiveCompanyOptions {
  companyId: string;
  orgId: string;
  userId: string;
  archiveReason: ArchiveReason;
  archiveNotes?: string;
  salesCompId?: string;
  saleDate?: Date;
  deleteOriginal?: boolean;
}

export interface SalesCompArchiveCheck {
  salesCompId: string;
  sellerContactId: string | null;
  sellerCompanyId: string | null;
  sellerContact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    company: string | null;
  } | null;
  sellerCompany: {
    id: string;
    name: string;
    domain: string | null;
  } | null;
  propertyName: string;
  saleDate: Date | null;
}

class ArchiveService {
  async archiveContact(options: ArchiveContactOptions): Promise<ArchivedContact> {
    const { contactId, orgId, userId, archiveReason, archiveNotes, salesCompId, saleDate, deleteOriginal = true } = options;

    const [contact] = await db.select()
      .from(crmContacts)
      .where(and(
        eq(crmContacts.id, contactId),
        eq(crmContacts.orgId, orgId)
      ))
      .limit(1);

    if (!contact) {
      throw new Error("Contact not found");
    }

    const contactProperties = await db.select({
      propertyId: crmContactProperties.propertyId,
      relationship: crmContactProperties.relationship,
      propertyName: crmProperties.name,
      propertyAddress: crmProperties.address,
      propertyCity: crmProperties.city,
      propertyState: crmProperties.state,
    })
      .from(crmContactProperties)
      .leftJoin(crmProperties, eq(crmContactProperties.propertyId, crmProperties.id))
      .where(eq(crmContactProperties.contactId, contactId));

    const archiveData: InsertArchivedContact = {
      orgId,
      originalContactId: contactId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      phones: contact.phones,
      position: contact.position,
      address: contact.address,
      unit: contact.unit,
      city: contact.city,
      state: contact.state,
      zipCode: contact.zipCode,
      company: contact.company,
      role: contact.role,
      contactType: contact.contactType,
      contactTag: contact.contactTag,
      labels: contact.labels,
      linkedinUrl: contact.linkedinUrl,
      twitterHandle: contact.twitterHandle,
      photoDataUrl: contact.photoDataUrl,
      archiveReason,
      archiveNotes,
      archivedBy: userId,
      salesCompId,
      saleDate,
      originalCreatedAt: contact.createdAt,
      originalUpdatedAt: contact.updatedAt,
    };

    const [archivedContact] = await db.insert(archivedContacts)
      .values(archiveData)
      .returning();

    for (const prop of contactProperties) {
      if (prop.propertyName) {
        const assocData: InsertArchivePropertyAssociation = {
          orgId,
          archivedContactId: archivedContact.id,
          propertyId: prop.propertyId,
          propertyName: prop.propertyName,
          propertyAddress: prop.propertyAddress,
          propertyCity: prop.propertyCity,
          propertyState: prop.propertyState,
          salesCompId,
          relationship: prop.relationship,
          ownershipEndDate: saleDate,
        };
        await db.insert(archivePropertyAssociations).values(assocData);
      }
    }

    if (deleteOriginal) {
      await db.delete(crmContactProperties)
        .where(eq(crmContactProperties.contactId, contactId));
      await db.delete(crmContacts)
        .where(eq(crmContacts.id, contactId));
    }

    return archivedContact;
  }

  async archiveCompany(options: ArchiveCompanyOptions): Promise<ArchivedCompany> {
    const { companyId, orgId, userId, archiveReason, archiveNotes, salesCompId, saleDate, deleteOriginal = true } = options;

    const [company] = await db.select()
      .from(crmCompanies)
      .where(and(
        eq(crmCompanies.id, companyId),
        eq(crmCompanies.orgId, orgId)
      ))
      .limit(1);

    if (!company) {
      throw new Error("Company not found");
    }

    const companyProperties = await db.select({
      propertyId: crmCompanyProperties.propertyId,
      relationship: crmCompanyProperties.relationship,
      propertyName: crmProperties.name,
      propertyAddress: crmProperties.address,
      propertyCity: crmProperties.city,
      propertyState: crmProperties.state,
    })
      .from(crmCompanyProperties)
      .leftJoin(crmProperties, eq(crmCompanyProperties.propertyId, crmProperties.id))
      .where(eq(crmCompanyProperties.companyId, companyId));

    const archiveData: InsertArchivedCompany = {
      orgId,
      originalCompanyId: companyId,
      name: company.name,
      domain: company.domain,
      industry: company.industry,
      size: company.size,
      address: company.address,
      phone: company.phone,
      website: company.website,
      description: company.description,
      labels: company.labels,
      annualRevenue: company.annualRevenue,
      annualMarinaSpend: company.annualMarinaSpend,
      acquisitionInterest: company.acquisitionInterest,
      portfolioCount: company.portfolioCount,
      archiveReason,
      archiveNotes,
      archivedBy: userId,
      salesCompId,
      saleDate,
      originalCreatedAt: company.createdAt,
      originalUpdatedAt: company.updatedAt,
      originalOwnerId: company.ownerId,
    };

    const [archivedCompany] = await db.insert(archivedCompanies)
      .values(archiveData)
      .returning();

    for (const prop of companyProperties) {
      if (prop.propertyName) {
        const assocData: InsertArchivePropertyAssociation = {
          orgId,
          archivedCompanyId: archivedCompany.id,
          propertyId: prop.propertyId,
          propertyName: prop.propertyName,
          propertyAddress: prop.propertyAddress,
          propertyCity: prop.propertyCity,
          propertyState: prop.propertyState,
          salesCompId,
          relationship: prop.relationship,
          ownershipEndDate: saleDate,
        };
        await db.insert(archivePropertyAssociations).values(assocData);
      }
    }

    if (deleteOriginal) {
      await db.delete(crmCompanyProperties)
        .where(eq(crmCompanyProperties.companyId, companyId));
      await db.delete(crmCompanies)
        .where(eq(crmCompanies.id, companyId));
    }

    return archivedCompany;
  }

  async getArchivedContacts(orgId: string, options?: { 
    search?: string; 
    salesCompId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ArchivedContact[]> {
    let query = db.select()
      .from(archivedContacts)
      .where(eq(archivedContacts.orgId, orgId))
      .orderBy(desc(archivedContacts.archivedAt));

    if (options?.salesCompId) {
      query = query.where(and(
        eq(archivedContacts.orgId, orgId),
        eq(archivedContacts.salesCompId, options.salesCompId)
      ));
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  async getArchivedCompanies(orgId: string, options?: { 
    search?: string; 
    salesCompId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ArchivedCompany[]> {
    let query = db.select()
      .from(archivedCompanies)
      .where(eq(archivedCompanies.orgId, orgId))
      .orderBy(desc(archivedCompanies.archivedAt));

    if (options?.salesCompId) {
      query = query.where(and(
        eq(archivedCompanies.orgId, orgId),
        eq(archivedCompanies.salesCompId, options.salesCompId)
      ));
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    return await query;
  }

  async getArchivePropertyAssociations(orgId: string, entityId: string, entityType: 'contact' | 'company'): Promise<ArchivePropertyAssociation[]> {
    if (entityType === 'contact') {
      return await db.select()
        .from(archivePropertyAssociations)
        .where(and(
          eq(archivePropertyAssociations.orgId, orgId),
          eq(archivePropertyAssociations.archivedContactId, entityId)
        ));
    } else {
      return await db.select()
        .from(archivePropertyAssociations)
        .where(and(
          eq(archivePropertyAssociations.orgId, orgId),
          eq(archivePropertyAssociations.archivedCompanyId, entityId)
        ));
    }
  }

  async restoreContact(archivedContactId: string, orgId: string, userId: string): Promise<{ contactId: string }> {
    const [archived] = await db.select()
      .from(archivedContacts)
      .where(and(
        eq(archivedContacts.id, archivedContactId),
        eq(archivedContacts.orgId, orgId)
      ))
      .limit(1);

    if (!archived) {
      throw new Error("Archived contact not found");
    }

    const [existingContact] = await db.select()
      .from(crmContacts)
      .where(and(
        eq(crmContacts.orgId, orgId),
        eq(crmContacts.email, archived.email || '')
      ))
      .limit(1);

    if (existingContact) {
      throw new Error("A contact with this email already exists in the CRM");
    }

    const [restoredContact] = await db.insert(crmContacts)
      .values({
        orgId,
        firstName: archived.firstName,
        lastName: archived.lastName,
        email: archived.email || '',
        phone: archived.phone,
        phones: archived.phones,
        position: archived.position,
        address: archived.address,
        unit: archived.unit,
        city: archived.city,
        state: archived.state,
        zipCode: archived.zipCode,
        company: archived.company,
        role: archived.role,
        contactType: archived.contactType,
        labels: archived.labels,
        linkedinUrl: archived.linkedinUrl,
        twitterHandle: archived.twitterHandle,
        photoDataUrl: archived.photoDataUrl,
        ownerId: userId,
      })
      .returning();

    await db.delete(archivePropertyAssociations)
      .where(eq(archivePropertyAssociations.archivedContactId, archivedContactId));

    await db.delete(archivedContacts)
      .where(eq(archivedContacts.id, archivedContactId));

    return { contactId: restoredContact.id };
  }

  async restoreCompany(archivedCompanyId: string, orgId: string, userId: string): Promise<{ companyId: string }> {
    const [archived] = await db.select()
      .from(archivedCompanies)
      .where(and(
        eq(archivedCompanies.id, archivedCompanyId),
        eq(archivedCompanies.orgId, orgId)
      ))
      .limit(1);

    if (!archived) {
      throw new Error("Archived company not found");
    }

    const [existingCompany] = await db.select()
      .from(crmCompanies)
      .where(and(
        eq(crmCompanies.orgId, orgId),
        ilike(crmCompanies.name, archived.name)
      ))
      .limit(1);

    if (existingCompany) {
      throw new Error("A company with this name already exists in the CRM");
    }

    const [restoredCompany] = await db.insert(crmCompanies)
      .values({
        orgId,
        name: archived.name,
        domain: archived.domain,
        industry: archived.industry,
        size: archived.size,
        address: archived.address,
        phone: archived.phone,
        website: archived.website,
        description: archived.description,
        labels: archived.labels,
        annualRevenue: archived.annualRevenue,
        annualMarinaSpend: archived.annualMarinaSpend,
        acquisitionInterest: archived.acquisitionInterest,
        portfolioCount: archived.portfolioCount,
        ownerId: userId,
      })
      .returning();

    await db.delete(archivePropertyAssociations)
      .where(eq(archivePropertyAssociations.archivedCompanyId, archivedCompanyId));

    await db.delete(archivedCompanies)
      .where(eq(archivedCompanies.id, archivedCompanyId));

    return { companyId: restoredCompany.id };
  }

  async checkSalesCompForArchiveCandidates(salesCompId: string, orgId: string): Promise<SalesCompArchiveCheck | null> {
    const [comp] = await db.select()
      .from(salesComps)
      .where(and(
        eq(salesComps.id, salesCompId),
        eq(salesComps.orgId, orgId)
      ))
      .limit(1);

    if (!comp) {
      return null;
    }

    let sellerContact = null;
    let sellerCompany = null;

    if (comp.sellerContactId) {
      const [contact] = await db.select({
        id: crmContacts.id,
        firstName: crmContacts.firstName,
        lastName: crmContacts.lastName,
        email: crmContacts.email,
        company: crmContacts.company,
      })
        .from(crmContacts)
        .where(eq(crmContacts.id, comp.sellerContactId))
        .limit(1);
      sellerContact = contact || null;
    }

    if (comp.sellerCompanyId) {
      const [company] = await db.select({
        id: crmCompanies.id,
        name: crmCompanies.name,
        domain: crmCompanies.domain,
      })
        .from(crmCompanies)
        .where(eq(crmCompanies.id, comp.sellerCompanyId))
        .limit(1);
      sellerCompany = company || null;
    }

    return {
      salesCompId: comp.id,
      sellerContactId: comp.sellerContactId,
      sellerCompanyId: comp.sellerCompanyId,
      sellerContact,
      sellerCompany,
      propertyName: comp.marina,
      saleDate: comp.saleYear && comp.saleMonth 
        ? new Date(comp.saleYear, comp.saleMonth - 1, 1) 
        : null,
    };
  }

  async getArchivedContactById(id: string, orgId: string): Promise<ArchivedContact | null> {
    const [archived] = await db.select()
      .from(archivedContacts)
      .where(and(
        eq(archivedContacts.id, id),
        eq(archivedContacts.orgId, orgId)
      ))
      .limit(1);
    return archived || null;
  }

  async getArchivedCompanyById(id: string, orgId: string): Promise<ArchivedCompany | null> {
    const [archived] = await db.select()
      .from(archivedCompanies)
      .where(and(
        eq(archivedCompanies.id, id),
        eq(archivedCompanies.orgId, orgId)
      ))
      .limit(1);
    return archived || null;
  }
}

export const archiveService = new ArchiveService();
