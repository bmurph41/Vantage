import { db } from "../db";
import { 
  pendingProperties, 
  pendingContacts, 
  pendingCompanies,
  crmProperties, 
  crmContacts, 
  crmCompanies, 
  crmMatchResults,
  propertyOwnershipHistory,
  salesComps,
  InsertCrmProperty,
  InsertCrmContact,
  InsertCrmCompany,
  InsertPropertyOwnershipHistory,
} from "@shared/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { logger } from "../utils/logger";
import { crmMatchingService, MatchResult } from "./crm-matching-service";
import { auditService } from "./audit-service";

export interface ReviewActionResult {
  success: boolean;
  message: string;
  createdEntityId?: string;
  linkedEntityId?: string;
  ownershipHistoryId?: string;
}

export interface PendingItem {
  id: string;
  type: 'property' | 'contact' | 'company';
  status: string;
  data: any;
  matches: MatchResult[];
  bestMatch?: MatchResult;
  salesCompId?: string;
  createdAt: Date;
}

export class PendingCompReviewService {
  async getPendingItems(orgId: string, options?: {
    type?: 'property' | 'contact' | 'company';
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: PendingItem[]; total: number }> {
    const items: PendingItem[] = [];
    const filters = options || {};
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const shouldIncludeProperties = !filters.type || filters.type === 'property';
    const shouldIncludeContacts = !filters.type || filters.type === 'contact';
    const shouldIncludeCompanies = !filters.type || filters.type === 'company';

    if (shouldIncludeProperties) {
      const whereConditions = [eq(pendingProperties.orgId, orgId)];
      if (filters.status) {
        whereConditions.push(eq(pendingProperties.status, filters.status));
      }

      const properties = await db
        .select()
        .from(pendingProperties)
        .where(and(...whereConditions))
        .orderBy(desc(pendingProperties.createdAt))
        .limit(limit)
        .offset(offset);

      for (const prop of properties) {
        const matches = await crmMatchingService.getMatchesForPending(prop.id);
        items.push({
          id: prop.id,
          type: 'property',
          status: prop.status,
          data: {
            name: prop.marinaName,
            marinaName: prop.marinaName,
            address: prop.address,
            city: prop.city,
            state: prop.state,
            salePrice: prop.salePrice,
            compMetadata: prop.compMetadata,
            ...prop,
          },
          matches,
          bestMatch: matches.length > 0 ? matches[0] : undefined,
          salesCompId: prop.compId || undefined,
          createdAt: prop.createdAt,
        });
      }
    }

    if (shouldIncludeContacts) {
      const whereConditions = [eq(pendingContacts.orgId, orgId)];
      if (filters.status) {
        whereConditions.push(eq(pendingContacts.status, filters.status));
      }

      const contacts = await db
        .select()
        .from(pendingContacts)
        .where(and(...whereConditions))
        .orderBy(desc(pendingContacts.createdAt))
        .limit(limit)
        .offset(offset);

      for (const contact of contacts) {
        const matches = await crmMatchingService.getMatchesForPending(contact.id);
        items.push({
          id: contact.id,
          type: 'contact',
          status: contact.status,
          data: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            role: contact.role,
            ...contact,
          },
          matches,
          bestMatch: matches.length > 0 ? matches[0] : undefined,
          createdAt: contact.createdAt,
        });
      }
    }

    if (shouldIncludeCompanies) {
      const whereConditions = [eq(pendingCompanies.orgId, orgId)];
      if (filters.status) {
        whereConditions.push(eq(pendingCompanies.status, filters.status));
      }

      const companies = await db
        .select()
        .from(pendingCompanies)
        .where(and(...whereConditions))
        .orderBy(desc(pendingCompanies.createdAt))
        .limit(limit)
        .offset(offset);

      for (const company of companies) {
        const matches = await crmMatchingService.getMatchesForPending(company.id);
        items.push({
          id: company.id,
          type: 'company',
          status: company.status,
          data: {
            name: company.name,
            address: company.address,
            city: company.city,
            state: company.state,
            website: company.website,
            ...company,
          },
          matches,
          bestMatch: matches.length > 0 ? matches[0] : undefined,
          createdAt: company.createdAt,
        });
      }
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      items: items.slice(0, limit),
      total: items.length,
    };
  }

  async acceptAsNew(
    orgId: string,
    pendingType: 'property' | 'contact' | 'company',
    pendingId: string,
    userId: string
  ): Promise<ReviewActionResult> {
    try {
      if (pendingType === 'property') {
        return await this.acceptPropertyAsNew(orgId, pendingId, userId);
      } else if (pendingType === 'contact') {
        return await this.acceptContactAsNew(orgId, pendingId, userId);
      } else if (pendingType === 'company') {
        return await this.acceptCompanyAsNew(orgId, pendingId, userId);
      }
      return { success: false, message: 'Invalid pending type' };
    } catch (error) {
      logger.error({ error, pendingType, pendingId }, 'Failed to accept as new');
      return { success: false, message: `Failed to create: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async acceptPropertyAsNew(orgId: string, pendingId: string, userId: string): Promise<ReviewActionResult> {
    const [pending] = await db
      .select()
      .from(pendingProperties)
      .where(and(eq(pendingProperties.id, pendingId), eq(pendingProperties.orgId, orgId)));

    if (!pending) {
      return { success: false, message: 'Pending property not found' };
    }

    const compMetadata = (pending.compMetadata || {}) as Record<string, any>;
    
    const propertyData: InsertCrmProperty = {
      orgId,
      name: pending.marinaName,
      address: pending.address || null,
      city: pending.city || null,
      state: pending.state || null,
      zipCode: null,
      slips: compMetadata.slips || null,
      propertyType: 'marina',
      isInPortfolio: false,
      isOnWatchlist: false,
      createdBy: userId,
    };

    const [newProperty] = await db.insert(crmProperties).values(propertyData).returning();

    if (pending.compId) {
      const ownershipData: InsertPropertyOwnershipHistory = {
        orgId,
        propertyId: newProperty.id,
        salesCompId: pending.compId,
        transactionDate: compMetadata.saleDate ? new Date(compMetadata.saleDate) : null,
        salePrice: pending.salePrice ? Number(pending.salePrice) : null,
        pricePerSlip: compMetadata.slips && pending.salePrice 
          ? Math.round(Number(pending.salePrice) / compMetadata.slips) 
          : null,
        buyerName: compMetadata.buyerName || null,
        sellerName: compMetadata.sellerName || null,
        transactionType: 'sale',
        source: 'sales_comp',
        createdBy: userId,
      };

      const [ownership] = await db.insert(propertyOwnershipHistory).values(ownershipData).returning();

      await db
        .update(salesComps)
        .set({ crmPropertyId: newProperty.id })
        .where(eq(salesComps.id, pending.compId));

      await db
        .update(pendingProperties)
        .set({
          status: 'accepted',
          reviewedAt: new Date(),
          reviewedBy: userId,
          createdPropertyId: newProperty.id,
        })
        .where(eq(pendingProperties.id, pendingId));

      await this.resolveAllMatchesForPending(pendingId, 'create_new', userId);

      await auditService.log({
        orgId,
        userId,
        action: 'pending_property_accepted',
        entityType: 'property',
        entityId: newProperty.id,
        metadata: { pendingId, salesCompId: pending.compId, ownershipHistoryId: ownership.id },
      });

      logger.info({ pendingId, propertyId: newProperty.id, ownershipId: ownership.id }, 
        'Accepted pending property as new with ownership history');

      return {
        success: true,
        message: 'Created new property with ownership history',
        createdEntityId: newProperty.id,
        ownershipHistoryId: ownership.id,
      };
    }

    await db
      .update(pendingProperties)
      .set({
        status: 'accepted',
        reviewedAt: new Date(),
        reviewedBy: userId,
        createdPropertyId: newProperty.id,
      })
      .where(eq(pendingProperties.id, pendingId));

    await this.resolveAllMatchesForPending(pendingId, 'create_new', userId);

    logger.info({ pendingId, propertyId: newProperty.id }, 'Accepted pending property as new');

    return {
      success: true,
      message: 'Created new property',
      createdEntityId: newProperty.id,
    };
  }

  private async acceptContactAsNew(orgId: string, pendingId: string, userId: string): Promise<ReviewActionResult> {
    const [pending] = await db
      .select()
      .from(pendingContacts)
      .where(and(eq(pendingContacts.id, pendingId), eq(pendingContacts.orgId, orgId)));

    if (!pending) {
      return { success: false, message: 'Pending contact not found' };
    }

    const contactData: InsertCrmContact = {
      orgId,
      firstName: pending.firstName,
      lastName: pending.lastName,
      email: pending.email || null,
      phone: pending.phone || null,
      title: pending.role || null,
      createdBy: userId,
    };

    const [newContact] = await db.insert(crmContacts).values(contactData).returning();

    await db
      .update(pendingContacts)
      .set({
        status: 'accepted',
        reviewedAt: new Date(),
        reviewedBy: userId,
        resolution: 'create_new',
        createdContactId: newContact.id,
      })
      .where(eq(pendingContacts.id, pendingId));

    await this.resolveAllMatchesForPending(pendingId, 'create_new', userId);

    logger.info({ pendingId, contactId: newContact.id }, 'Accepted pending contact as new');

    return {
      success: true,
      message: 'Created new contact',
      createdEntityId: newContact.id,
    };
  }

  private async acceptCompanyAsNew(orgId: string, pendingId: string, userId: string): Promise<ReviewActionResult> {
    const [pending] = await db
      .select()
      .from(pendingCompanies)
      .where(and(eq(pendingCompanies.id, pendingId), eq(pendingCompanies.orgId, orgId)));

    if (!pending) {
      return { success: false, message: 'Pending company not found' };
    }

    const companyData: InsertCrmCompany = {
      orgId,
      name: pending.name,
      address: pending.address || null,
      city: pending.city || null,
      state: pending.state || null,
      website: pending.website || null,
      createdBy: userId,
    };

    const [newCompany] = await db.insert(crmCompanies).values(companyData).returning();

    await db
      .update(pendingCompanies)
      .set({
        status: 'accepted',
        reviewedAt: new Date(),
        reviewedBy: userId,
        resolution: 'create_new',
        createdCompanyId: newCompany.id,
      })
      .where(eq(pendingCompanies.id, pendingId));

    await this.resolveAllMatchesForPending(pendingId, 'create_new', userId);

    logger.info({ pendingId, companyId: newCompany.id }, 'Accepted pending company as new');

    return {
      success: true,
      message: 'Created new company',
      createdEntityId: newCompany.id,
    };
  }

  async linkToExisting(
    orgId: string,
    pendingType: 'property' | 'contact' | 'company',
    pendingId: string,
    targetEntityId: string,
    userId: string
  ): Promise<ReviewActionResult> {
    try {
      if (pendingType === 'property') {
        return await this.linkPropertyToExisting(orgId, pendingId, targetEntityId, userId);
      } else if (pendingType === 'contact') {
        return await this.linkContactToExisting(orgId, pendingId, targetEntityId, userId);
      } else if (pendingType === 'company') {
        return await this.linkCompanyToExisting(orgId, pendingId, targetEntityId, userId);
      }
      return { success: false, message: 'Invalid pending type' };
    } catch (error) {
      logger.error({ error, pendingType, pendingId, targetEntityId }, 'Failed to link to existing');
      return { success: false, message: `Failed to link: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async linkPropertyToExisting(
    orgId: string, 
    pendingId: string, 
    targetPropertyId: string, 
    userId: string
  ): Promise<ReviewActionResult> {
    const [pending] = await db
      .select()
      .from(pendingProperties)
      .where(and(eq(pendingProperties.id, pendingId), eq(pendingProperties.orgId, orgId)));

    if (!pending) {
      return { success: false, message: 'Pending property not found' };
    }

    const [targetProperty] = await db
      .select()
      .from(crmProperties)
      .where(and(eq(crmProperties.id, targetPropertyId), eq(crmProperties.orgId, orgId)));

    if (!targetProperty) {
      return { success: false, message: 'Target property not found' };
    }

    const compMetadata = (pending.compMetadata || {}) as Record<string, any>;
    let ownershipHistoryId: string | undefined;

    if (pending.compId) {
      const ownershipData: InsertPropertyOwnershipHistory = {
        orgId,
        propertyId: targetPropertyId,
        salesCompId: pending.compId,
        transactionDate: compMetadata.saleDate ? new Date(compMetadata.saleDate) : null,
        salePrice: pending.salePrice ? Number(pending.salePrice) : null,
        pricePerSlip: compMetadata.slips && pending.salePrice 
          ? Math.round(Number(pending.salePrice) / compMetadata.slips) 
          : null,
        buyerName: compMetadata.buyerName || null,
        sellerName: compMetadata.sellerName || null,
        transactionType: 'sale',
        source: 'sales_comp',
        createdBy: userId,
      };

      const [ownership] = await db.insert(propertyOwnershipHistory).values(ownershipData).returning();
      ownershipHistoryId = ownership.id;

      await db
        .update(salesComps)
        .set({ crmPropertyId: targetPropertyId })
        .where(eq(salesComps.id, pending.compId));
    }

    await db
      .update(pendingProperties)
      .set({
        status: 'accepted',
        reviewedAt: new Date(),
        reviewedBy: userId,
        createdPropertyId: targetPropertyId,
      })
      .where(eq(pendingProperties.id, pendingId));

    await this.resolveAllMatchesForPending(pendingId, 'link', userId);

    await auditService.log({
      orgId,
      userId,
      action: 'pending_property_linked',
      entityType: 'property',
      entityId: targetPropertyId,
      metadata: { pendingId, salesCompId: pending.compId, ownershipHistoryId },
    });

    logger.info({ pendingId, targetPropertyId, ownershipHistoryId }, 'Linked pending property to existing');

    return {
      success: true,
      message: 'Linked to existing property with ownership history',
      linkedEntityId: targetPropertyId,
      ownershipHistoryId,
    };
  }

  private async linkContactToExisting(
    orgId: string, 
    pendingId: string, 
    targetContactId: string, 
    userId: string
  ): Promise<ReviewActionResult> {
    const [pending] = await db
      .select()
      .from(pendingContacts)
      .where(and(eq(pendingContacts.id, pendingId), eq(pendingContacts.orgId, orgId)));

    if (!pending) {
      return { success: false, message: 'Pending contact not found' };
    }

    await db
      .update(pendingContacts)
      .set({
        status: 'linked',
        reviewedAt: new Date(),
        reviewedBy: userId,
        resolution: 'link',
        linkedContactId: targetContactId,
      })
      .where(eq(pendingContacts.id, pendingId));

    await this.resolveAllMatchesForPending(pendingId, 'link', userId);

    logger.info({ pendingId, targetContactId }, 'Linked pending contact to existing');

    return {
      success: true,
      message: 'Linked to existing contact',
      linkedEntityId: targetContactId,
    };
  }

  private async linkCompanyToExisting(
    orgId: string, 
    pendingId: string, 
    targetCompanyId: string, 
    userId: string
  ): Promise<ReviewActionResult> {
    const [pending] = await db
      .select()
      .from(pendingCompanies)
      .where(and(eq(pendingCompanies.id, pendingId), eq(pendingCompanies.orgId, orgId)));

    if (!pending) {
      return { success: false, message: 'Pending company not found' };
    }

    await db
      .update(pendingCompanies)
      .set({
        status: 'linked',
        reviewedAt: new Date(),
        reviewedBy: userId,
        resolution: 'link',
        linkedCompanyId: targetCompanyId,
      })
      .where(eq(pendingCompanies.id, pendingId));

    await this.resolveAllMatchesForPending(pendingId, 'link', userId);

    logger.info({ pendingId, targetCompanyId }, 'Linked pending company to existing');

    return {
      success: true,
      message: 'Linked to existing company',
      linkedEntityId: targetCompanyId,
    };
  }

  async mergeIntoExisting(
    orgId: string,
    pendingType: 'property' | 'contact' | 'company',
    pendingId: string,
    targetEntityId: string,
    fieldsToMerge: string[],
    userId: string
  ): Promise<ReviewActionResult> {
    try {
      if (pendingType === 'property') {
        return await this.mergePropertyIntoExisting(orgId, pendingId, targetEntityId, fieldsToMerge, userId);
      } else if (pendingType === 'contact') {
        return await this.mergeContactIntoExisting(orgId, pendingId, targetEntityId, fieldsToMerge, userId);
      } else if (pendingType === 'company') {
        return await this.mergeCompanyIntoExisting(orgId, pendingId, targetEntityId, fieldsToMerge, userId);
      }
      return { success: false, message: 'Invalid pending type' };
    } catch (error) {
      logger.error({ error, pendingType, pendingId, targetEntityId }, 'Failed to merge');
      return { success: false, message: `Failed to merge: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async mergePropertyIntoExisting(
    orgId: string,
    pendingId: string,
    targetPropertyId: string,
    fieldsToMerge: string[],
    userId: string
  ): Promise<ReviewActionResult> {
    const [pending] = await db
      .select()
      .from(pendingProperties)
      .where(and(eq(pendingProperties.id, pendingId), eq(pendingProperties.orgId, orgId)));

    if (!pending) {
      return { success: false, message: 'Pending property not found' };
    }

    const compMetadata = (pending.compMetadata || {}) as Record<string, any>;
    const updateData: Record<string, any> = {};
    const allowedFields = ['name', 'address', 'city', 'state'];
    const fieldMapping: Record<string, string> = { name: 'marinaName' };
    
    for (const field of fieldsToMerge) {
      const sourceField = fieldMapping[field] || field;
      if (allowedFields.includes(field) && (pending[sourceField as keyof typeof pending] || compMetadata[field])) {
        updateData[field] = pending[sourceField as keyof typeof pending] || compMetadata[field];
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(crmProperties)
        .set(updateData)
        .where(eq(crmProperties.id, targetPropertyId));
    }

    let ownershipHistoryId: string | undefined;
    if (pending.compId) {
      const ownershipData: InsertPropertyOwnershipHistory = {
        orgId,
        propertyId: targetPropertyId,
        salesCompId: pending.compId,
        transactionDate: compMetadata.saleDate ? new Date(compMetadata.saleDate) : null,
        salePrice: pending.salePrice ? Number(pending.salePrice) : null,
        pricePerSlip: compMetadata.slips && pending.salePrice 
          ? Math.round(Number(pending.salePrice) / compMetadata.slips) 
          : null,
        buyerName: compMetadata.buyerName || null,
        sellerName: compMetadata.sellerName || null,
        transactionType: 'sale',
        source: 'sales_comp',
        createdBy: userId,
      };

      const [ownership] = await db.insert(propertyOwnershipHistory).values(ownershipData).returning();
      ownershipHistoryId = ownership.id;

      await db
        .update(salesComps)
        .set({ crmPropertyId: targetPropertyId })
        .where(eq(salesComps.id, pending.compId));
    }

    await db
      .update(pendingProperties)
      .set({
        status: 'accepted',
        reviewedAt: new Date(),
        reviewedBy: userId,
        createdPropertyId: targetPropertyId,
      })
      .where(eq(pendingProperties.id, pendingId));

    await this.resolveAllMatchesForPending(pendingId, 'merge', userId);

    logger.info({ pendingId, targetPropertyId, fieldsToMerge, ownershipHistoryId }, 'Merged pending property');

    return {
      success: true,
      message: `Merged fields: ${fieldsToMerge.join(', ')}`,
      linkedEntityId: targetPropertyId,
      ownershipHistoryId,
    };
  }

  private async mergeContactIntoExisting(
    orgId: string,
    pendingId: string,
    targetContactId: string,
    fieldsToMerge: string[],
    userId: string
  ): Promise<ReviewActionResult> {
    const [pending] = await db
      .select()
      .from(pendingContacts)
      .where(and(eq(pendingContacts.id, pendingId), eq(pendingContacts.orgId, orgId)));

    if (!pending) {
      return { success: false, message: 'Pending contact not found' };
    }

    const updateData: Record<string, any> = {};
    const allowedFields = ['firstName', 'lastName', 'email', 'phone', 'title'];
    const fieldMapping: Record<string, string> = { role: 'title' };
    
    for (const field of fieldsToMerge) {
      const mappedField = fieldMapping[field] || field;
      if (allowedFields.includes(mappedField) && pending[field as keyof typeof pending]) {
        updateData[mappedField] = pending[field as keyof typeof pending];
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(crmContacts)
        .set(updateData)
        .where(eq(crmContacts.id, targetContactId));
    }

    await db
      .update(pendingContacts)
      .set({
        status: 'merged',
        reviewedAt: new Date(),
        reviewedBy: userId,
        resolution: 'merge',
        linkedContactId: targetContactId,
      })
      .where(eq(pendingContacts.id, pendingId));

    await this.resolveAllMatchesForPending(pendingId, 'merge', userId);

    logger.info({ pendingId, targetContactId, fieldsToMerge }, 'Merged pending contact');

    return {
      success: true,
      message: `Merged fields: ${fieldsToMerge.join(', ')}`,
      linkedEntityId: targetContactId,
    };
  }

  private async mergeCompanyIntoExisting(
    orgId: string,
    pendingId: string,
    targetCompanyId: string,
    fieldsToMerge: string[],
    userId: string
  ): Promise<ReviewActionResult> {
    const [pending] = await db
      .select()
      .from(pendingCompanies)
      .where(and(eq(pendingCompanies.id, pendingId), eq(pendingCompanies.orgId, orgId)));

    if (!pending) {
      return { success: false, message: 'Pending company not found' };
    }

    const updateData: Record<string, any> = {};
    const allowedFields = ['name', 'address', 'city', 'state', 'website'];
    
    for (const field of fieldsToMerge) {
      if (allowedFields.includes(field) && pending[field as keyof typeof pending]) {
        updateData[field] = pending[field as keyof typeof pending];
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(crmCompanies)
        .set(updateData)
        .where(eq(crmCompanies.id, targetCompanyId));
    }

    await db
      .update(pendingCompanies)
      .set({
        status: 'merged',
        reviewedAt: new Date(),
        reviewedBy: userId,
        resolution: 'merge',
        linkedCompanyId: targetCompanyId,
      })
      .where(eq(pendingCompanies.id, pendingId));

    await this.resolveAllMatchesForPending(pendingId, 'merge', userId);

    logger.info({ pendingId, targetCompanyId, fieldsToMerge }, 'Merged pending company');

    return {
      success: true,
      message: `Merged fields: ${fieldsToMerge.join(', ')}`,
      linkedEntityId: targetCompanyId,
    };
  }

  async reject(
    orgId: string,
    pendingType: 'property' | 'contact' | 'company',
    pendingId: string,
    reason: string,
    userId: string
  ): Promise<ReviewActionResult> {
    try {
      if (pendingType === 'property') {
        await db
          .update(pendingProperties)
          .set({
            status: 'rejected',
            reviewedAt: new Date(),
            reviewedBy: userId,
            resolution: 'skip',
            rejectionReason: reason,
          })
          .where(and(eq(pendingProperties.id, pendingId), eq(pendingProperties.orgId, orgId)));
      } else if (pendingType === 'contact') {
        await db
          .update(pendingContacts)
          .set({
            status: 'rejected',
            reviewedAt: new Date(),
            reviewedBy: userId,
            resolution: 'skip',
            rejectionReason: reason,
          })
          .where(and(eq(pendingContacts.id, pendingId), eq(pendingContacts.orgId, orgId)));
      } else if (pendingType === 'company') {
        await db
          .update(pendingCompanies)
          .set({
            status: 'rejected',
            reviewedAt: new Date(),
            reviewedBy: userId,
            resolution: 'skip',
            rejectionReason: reason,
          })
          .where(and(eq(pendingCompanies.id, pendingId), eq(pendingCompanies.orgId, orgId)));
      }

      await this.resolveAllMatchesForPending(pendingId, 'skip', userId);

      logger.info({ pendingType, pendingId, reason }, 'Rejected pending item');

      return { success: true, message: 'Item rejected' };
    } catch (error) {
      logger.error({ error, pendingType, pendingId }, 'Failed to reject');
      return { success: false, message: `Failed to reject: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async bulkAcceptAsNew(
    orgId: string,
    pendingItems: Array<{ type: 'property' | 'contact' | 'company'; id: string }>,
    userId: string
  ): Promise<{ success: number; failed: number; results: ReviewActionResult[] }> {
    const results: ReviewActionResult[] = [];
    let success = 0;
    let failed = 0;

    for (const item of pendingItems) {
      const result = await this.acceptAsNew(orgId, item.type, item.id, userId);
      results.push(result);
      if (result.success) success++;
      else failed++;
    }

    return { success, failed, results };
  }

  async bulkReject(
    orgId: string,
    pendingItems: Array<{ type: 'property' | 'contact' | 'company'; id: string }>,
    reason: string,
    userId: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const item of pendingItems) {
      const result = await this.reject(orgId, item.type, item.id, reason, userId);
      if (result.success) success++;
      else failed++;
    }

    return { success, failed };
  }

  private async resolveAllMatchesForPending(
    pendingId: string,
    resolution: string,
    userId: string
  ): Promise<void> {
    await db
      .update(crmMatchResults)
      .set({
        resolution,
        resolvedBy: userId,
        resolvedAt: new Date(),
      })
      .where(eq(crmMatchResults.pendingId, pendingId));
  }

  async getPendingCounts(orgId: string): Promise<{
    total: number;
    byType: { property: number; contact: number; company: number };
    byConfidence: { high: number; medium: number; low: number; noMatch: number };
  }> {
    const [propertyCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pendingProperties)
      .where(and(eq(pendingProperties.orgId, orgId), eq(pendingProperties.status, 'pending')));

    const [contactCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pendingContacts)
      .where(and(eq(pendingContacts.orgId, orgId), eq(pendingContacts.status, 'pending')));

    const [companyCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(pendingCompanies)
      .where(and(eq(pendingCompanies.orgId, orgId), eq(pendingCompanies.status, 'pending')));

    const matches = await db
      .select()
      .from(crmMatchResults)
      .where(and(eq(crmMatchResults.orgId, orgId), sql`${crmMatchResults.resolution} IS NULL`));

    const pendingIds = new Set<string>();
    const confidenceCounts = { high: 0, medium: 0, low: 0, noMatch: 0 };
    const highConfidencePending = new Set<string>();
    const mediumConfidencePending = new Set<string>();
    const lowConfidencePending = new Set<string>();

    for (const match of matches) {
      pendingIds.add(match.pendingId);
      if (match.confidenceLevel === 'high') highConfidencePending.add(match.pendingId);
      else if (match.confidenceLevel === 'medium') mediumConfidencePending.add(match.pendingId);
      else lowConfidencePending.add(match.pendingId);
    }

    confidenceCounts.high = highConfidencePending.size;
    confidenceCounts.medium = mediumConfidencePending.size - highConfidencePending.size;
    confidenceCounts.low = lowConfidencePending.size - mediumConfidencePending.size;
    
    const totalPending = Number(propertyCount?.count || 0) + Number(contactCount?.count || 0) + Number(companyCount?.count || 0);
    confidenceCounts.noMatch = totalPending - pendingIds.size;

    return {
      total: totalPending,
      byType: {
        property: Number(propertyCount?.count || 0),
        contact: Number(contactCount?.count || 0),
        company: Number(companyCount?.count || 0),
      },
      byConfidence: confidenceCounts,
    };
  }
}

export const pendingCompReviewService = new PendingCompReviewService();
