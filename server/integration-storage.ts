import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  dealSalesComps, dealRateComps, dealVdrLinks, dealDdConversions,
  propertySalesComps, propertyRateComps, modelingProjectComps, crossModuleAuditLog,
  crmDeals, salesComps, rateComps, vdrFolders, projects, crmProperties, modelingProjects,
  type DealSalesComp, type InsertDealSalesComp, type DealRateComp, type InsertDealRateComp,
  type DealVdrLink, type InsertDealVdrLink, type DealDdConversion, type InsertDealDdConversion,
  type PropertySalesComp, type InsertPropertySalesComp, type PropertyRateComp, type InsertPropertyRateComp,
  type ModelingProjectComp, type InsertModelingProjectComp, type CrossModuleAuditLog, type InsertCrossModuleAuditLog
} from "@shared/schema";

export interface IIntegrationStorage {
  // Deal ↔ Sales Comps Integration
  getDealSalesComps(dealId: string, orgId: string): Promise<DealSalesComp[]>;
  linkDealToSalesComp(data: InsertDealSalesComp): Promise<DealSalesComp>;
  unlinkDealFromSalesComp(dealId: string, salesCompId: string, orgId: string): Promise<boolean>;
  getSalesCompsForDeal(dealId: string, orgId: string): Promise<any[]>;

  // Deal ↔ Rate Comps Integration
  getDealRateComps(dealId: string, orgId: string): Promise<DealRateComp[]>;
  linkDealToRateComp(data: InsertDealRateComp): Promise<DealRateComp>;
  unlinkDealFromRateComp(dealId: string, rateCompId: string, orgId: string): Promise<boolean>;
  getRateCompsForDeal(dealId: string, orgId: string): Promise<any[]>;

  // Deal ↔ VDR Integration
  getDealVdrLinks(dealId: string, orgId: string): Promise<DealVdrLink[]>;
  linkDealToVdr(data: InsertDealVdrLink): Promise<DealVdrLink>;
  unlinkDealFromVdr(dealId: string, vdrFolderId: string, orgId: string): Promise<boolean>;
  getVdrFoldersForDeal(dealId: string, orgId: string): Promise<any[]>;

  // Deal → DD Project Conversion
  getDealDdConversions(dealId: string, orgId: string): Promise<DealDdConversion[]>;
  createDealDdConversion(data: InsertDealDdConversion): Promise<DealDdConversion>;
  convertDealToProject(dealId: string, userId: string, orgId: string, options?: {
    templateId?: string;
    createVdrFolder?: boolean;
    vdrTemplateId?: string;
  }): Promise<{ ddProjectId: string; vdrFolderId?: string; conversion: DealDdConversion }>;

  // Property ↔ Sales Comps Integration
  getPropertySalesComps(propertyId: string, orgId: string): Promise<PropertySalesComp[]>;
  linkPropertyToSalesComp(data: InsertPropertySalesComp): Promise<PropertySalesComp>;
  unlinkPropertyFromSalesComp(propertyId: string, salesCompId: string, orgId: string): Promise<boolean>;

  // Property ↔ Rate Comps Integration
  getPropertyRateComps(propertyId: string, orgId: string): Promise<PropertyRateComp[]>;
  linkPropertyToRateComp(data: InsertPropertyRateComp): Promise<PropertyRateComp>;
  unlinkPropertyFromRateComp(propertyId: string, rateCompId: string, orgId: string): Promise<boolean>;

  // Modeling Project ↔ Comps Integration
  getModelingProjectComps(projectId: string, orgId: string): Promise<ModelingProjectComp[]>;
  linkModelingProjectToComp(data: InsertModelingProjectComp): Promise<ModelingProjectComp>;
  unlinkModelingProjectFromComp(id: string, orgId: string): Promise<boolean>;

  // Cross-Module Audit
  logCrossModuleAction(data: InsertCrossModuleAuditLog): Promise<CrossModuleAuditLog>;
  getCrossModuleAuditLog(orgId: string, filters?: {
    sourceModule?: string;
    targetModule?: string;
    action?: string;
    limit?: number;
  }): Promise<CrossModuleAuditLog[]>;
}

export class IntegrationStorage implements IIntegrationStorage {
  // ============================================================================
  // DEAL ↔ SALES COMPS
  // ============================================================================

  async getDealSalesComps(dealId: string, orgId: string): Promise<DealSalesComp[]> {
    return db
      .select()
      .from(dealSalesComps)
      .where(and(eq(dealSalesComps.dealId, dealId), eq(dealSalesComps.orgId, orgId)))
      .orderBy(desc(dealSalesComps.relevanceScore));
  }

  async linkDealToSalesComp(data: InsertDealSalesComp): Promise<DealSalesComp> {
    const [created] = await db.insert(dealSalesComps).values(data).returning();
    return created;
  }

  async unlinkDealFromSalesComp(dealId: string, salesCompId: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(dealSalesComps)
      .where(
        and(
          eq(dealSalesComps.dealId, dealId),
          eq(dealSalesComps.salesCompId, salesCompId),
          eq(dealSalesComps.orgId, orgId)
        )
      );
    return true;
  }

  async getSalesCompsForDeal(dealId: string, orgId: string): Promise<any[]> {
    const links = await this.getDealSalesComps(dealId, orgId);
    if (links.length === 0) return [];

    const compIds = links.map((l) => l.salesCompId);
    const comps = await db
      .select()
      .from(salesComps)
      .where(inArray(salesComps.id, compIds));

    return comps.map((comp) => {
      const link = links.find((l) => l.salesCompId === comp.id);
      return {
        ...comp,
        linkMetadata: {
          relevanceScore: link?.relevanceScore,
          isPrimary: link?.isPrimary,
          comparisonType: link?.comparisonType,
          notes: link?.notes,
          distanceMiles: link?.distanceMiles,
          priceDifferencePercent: link?.priceDifferencePercent,
        },
      };
    });
  }

  // ============================================================================
  // DEAL ↔ RATE COMPS
  // ============================================================================

  async getDealRateComps(dealId: string, orgId: string): Promise<DealRateComp[]> {
    return db
      .select()
      .from(dealRateComps)
      .where(and(eq(dealRateComps.dealId, dealId), eq(dealRateComps.orgId, orgId)))
      .orderBy(desc(dealRateComps.relevanceScore));
  }

  async linkDealToRateComp(data: InsertDealRateComp): Promise<DealRateComp> {
    const [created] = await db.insert(dealRateComps).values(data).returning();
    return created;
  }

  async unlinkDealFromRateComp(dealId: string, rateCompId: string, orgId: string): Promise<boolean> {
    await db
      .delete(dealRateComps)
      .where(
        and(
          eq(dealRateComps.dealId, dealId),
          eq(dealRateComps.rateCompId, rateCompId),
          eq(dealRateComps.orgId, orgId)
        )
      );
    return true;
  }

  async getRateCompsForDeal(dealId: string, orgId: string): Promise<any[]> {
    const links = await this.getDealRateComps(dealId, orgId);
    if (links.length === 0) return [];

    const compIds = links.map((l) => l.rateCompId);
    const comps = await db
      .select()
      .from(rateComps)
      .where(inArray(rateComps.id, compIds));

    return comps.map((comp) => {
      const link = links.find((l) => l.rateCompId === comp.id);
      return {
        ...comp,
        linkMetadata: {
          relevanceScore: link?.relevanceScore,
          isPrimary: link?.isPrimary,
          comparisonType: link?.comparisonType,
          notes: link?.notes,
          rateVariancePercent: link?.rateVariancePercent,
        },
      };
    });
  }

  // ============================================================================
  // DEAL ↔ VDR FOLDERS
  // ============================================================================

  async getDealVdrLinks(dealId: string, orgId: string): Promise<DealVdrLink[]> {
    return db
      .select()
      .from(dealVdrLinks)
      .where(and(eq(dealVdrLinks.dealId, dealId), eq(dealVdrLinks.orgId, orgId)));
  }

  async linkDealToVdr(data: InsertDealVdrLink): Promise<DealVdrLink> {
    const [created] = await db.insert(dealVdrLinks).values(data).returning();
    return created;
  }

  async unlinkDealFromVdr(dealId: string, vdrFolderId: string, orgId: string): Promise<boolean> {
    await db
      .delete(dealVdrLinks)
      .where(
        and(
          eq(dealVdrLinks.dealId, dealId),
          eq(dealVdrLinks.vdrFolderId, vdrFolderId),
          eq(dealVdrLinks.orgId, orgId)
        )
      );
    return true;
  }

  async getVdrFoldersForDeal(dealId: string, orgId: string): Promise<any[]> {
    const links = await this.getDealVdrLinks(dealId, orgId);
    if (links.length === 0) return [];

    const folderIds = links.map((l) => l.vdrFolderId);
    const folders = await db
      .select()
      .from(vdrFolders)
      .where(inArray(vdrFolders.id, folderIds));

    return folders.map((folder) => {
      const link = links.find((l) => l.vdrFolderId === folder.id);
      return {
        ...folder,
        linkMetadata: {
          linkType: link?.linkType,
          isActive: link?.isActive,
        },
      };
    });
  }

  // ============================================================================
  // DEAL → DD PROJECT CONVERSION
  // ============================================================================

  async getDealDdConversions(dealId: string, orgId: string): Promise<DealDdConversion[]> {
    return db
      .select()
      .from(dealDdConversions)
      .where(and(eq(dealDdConversions.dealId, dealId), eq(dealDdConversions.orgId, orgId)))
      .orderBy(desc(dealDdConversions.convertedAt));
  }

  async createDealDdConversion(data: InsertDealDdConversion): Promise<DealDdConversion> {
    const [created] = await db.insert(dealDdConversions).values(data).returning();
    return created;
  }

  async convertDealToProject(
    dealId: string,
    userId: string,
    orgId: string,
    options?: {
      templateId?: string;
      createVdrFolder?: boolean;
      vdrTemplateId?: string;
    }
  ): Promise<{ ddProjectId: string; vdrFolderId?: string; conversion: DealDdConversion }> {
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, dealId));
    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    const [ddProject] = await db
      .insert(projects)
      .values({
        orgId,
        name: deal.title || `DD Project from Deal`,
        description: `Due diligence project converted from CRM deal: ${deal.title}`,
        status: "active",
        createdBy: userId,
      })
      .returning();

    let vdrFolderId: string | undefined;

    if (options?.createVdrFolder) {
      const [folder] = await db
        .insert(vdrFolders)
        .values({
          projectId: ddProject.id,
          name: deal.title || "Deal Documents",
          path: `/${deal.title || "Deal Documents"}`,
          orgId,
          createdBy: userId,
        })
        .returning();
      vdrFolderId = folder.id;
    }

    const conversion = await this.createDealDdConversion({
      orgId,
      dealId,
      ddProjectId: ddProject.id,
      conversionType: "manual",
      conversionStatus: "completed",
      contactsMigrated: 0,
      documentsMigrated: 0,
      taskTemplateUsed: options?.templateId,
      vdrFolderCreated: !!vdrFolderId,
      vdrFolderId,
      vdrTemplateUsed: options?.vdrTemplateId,
      convertedBy: userId,
    });

    await db
      .update(crmDeals)
      .set({ projectId: ddProject.id })
      .where(eq(crmDeals.id, dealId));

    await this.logCrossModuleAction({
      orgId,
      userId,
      sourceModule: "crm",
      targetModule: "dd",
      sourceEntityType: "deal",
      sourceEntityId: dealId,
      targetEntityType: "project",
      targetEntityId: ddProject.id,
      action: "convert",
      actionStatus: "completed",
    });

    return {
      ddProjectId: ddProject.id,
      vdrFolderId,
      conversion,
    };
  }

  // ============================================================================
  // PROPERTY ↔ SALES COMPS
  // ============================================================================

  async getPropertySalesComps(propertyId: string, orgId: string): Promise<PropertySalesComp[]> {
    return db
      .select()
      .from(propertySalesComps)
      .where(and(eq(propertySalesComps.propertyId, propertyId), eq(propertySalesComps.orgId, orgId)));
  }

  async linkPropertyToSalesComp(data: InsertPropertySalesComp): Promise<PropertySalesComp> {
    const [created] = await db.insert(propertySalesComps).values(data).returning();
    return created;
  }

  async unlinkPropertyFromSalesComp(propertyId: string, salesCompId: string, orgId: string): Promise<boolean> {
    await db
      .delete(propertySalesComps)
      .where(
        and(
          eq(propertySalesComps.propertyId, propertyId),
          eq(propertySalesComps.salesCompId, salesCompId),
          eq(propertySalesComps.orgId, orgId)
        )
      );
    return true;
  }

  // ============================================================================
  // PROPERTY ↔ RATE COMPS
  // ============================================================================

  async getPropertyRateComps(propertyId: string, orgId: string): Promise<PropertyRateComp[]> {
    return db
      .select()
      .from(propertyRateComps)
      .where(and(eq(propertyRateComps.propertyId, propertyId), eq(propertyRateComps.orgId, orgId)));
  }

  async linkPropertyToRateComp(data: InsertPropertyRateComp): Promise<PropertyRateComp> {
    const [created] = await db.insert(propertyRateComps).values(data).returning();
    return created;
  }

  async unlinkPropertyFromRateComp(propertyId: string, rateCompId: string, orgId: string): Promise<boolean> {
    await db
      .delete(propertyRateComps)
      .where(
        and(
          eq(propertyRateComps.propertyId, propertyId),
          eq(propertyRateComps.rateCompId, rateCompId),
          eq(propertyRateComps.orgId, orgId)
        )
      );
    return true;
  }

  // ============================================================================
  // MODELING PROJECT ↔ COMPS
  // ============================================================================

  async getModelingProjectComps(projectId: string, orgId: string): Promise<ModelingProjectComp[]> {
    return db
      .select()
      .from(modelingProjectComps)
      .where(and(eq(modelingProjectComps.modelingProjectId, projectId), eq(modelingProjectComps.orgId, orgId)));
  }

  async linkModelingProjectToComp(data: InsertModelingProjectComp): Promise<ModelingProjectComp> {
    const [created] = await db.insert(modelingProjectComps).values(data).returning();
    return created;
  }

  async unlinkModelingProjectFromComp(id: string, orgId: string): Promise<boolean> {
    await db
      .delete(modelingProjectComps)
      .where(and(eq(modelingProjectComps.id, id), eq(modelingProjectComps.orgId, orgId)));
    return true;
  }

  // ============================================================================
  // CROSS-MODULE AUDIT LOG
  // ============================================================================

  async logCrossModuleAction(data: InsertCrossModuleAuditLog): Promise<CrossModuleAuditLog> {
    const [created] = await db.insert(crossModuleAuditLog).values(data).returning();
    return created;
  }

  async getCrossModuleAuditLog(
    orgId: string,
    filters?: {
      sourceModule?: string;
      targetModule?: string;
      action?: string;
      limit?: number;
    }
  ): Promise<CrossModuleAuditLog[]> {
    let query = db
      .select()
      .from(crossModuleAuditLog)
      .where(eq(crossModuleAuditLog.orgId, orgId))
      .orderBy(desc(crossModuleAuditLog.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    return query;
  }
}

export const integrationStorage = new IntegrationStorage();
