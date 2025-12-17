import {
  type Om,
  type InsertOm,
  type OmPage,
  type InsertOmPage,
  type OmBlock,
  type InsertOmBlock,
  type OmTemplate,
  type InsertOmTemplate,
  type OmDataset,
  type InsertOmDataset,
  type OmBrandKit,
  type InsertOmBrandKit,
  type OmDocumentVersion,
  type InsertOmDocumentVersion,
  type OmAsset,
  type InsertOmAsset,
  oms,
  omPages,
  omBlocks,
  omTemplates,
  omDatasets,
  omBrandKits,
  omDocumentVersions,
  omAssets,
} from "@shared/schema";
import { db } from "../db";
import { eq, desc, and, sql, max } from "drizzle-orm";

export interface IOmStorage {
  getOmById(id: string): Promise<Om | undefined>;
  getOmsByProjectId(projectId: string): Promise<Om[]>;
  getOmsByOrganizationId(organizationId: string): Promise<Om[]>;
  getOmsByDealId(dealId: string): Promise<Om[]>;
  getOmsByModelingProjectId(modelingProjectId: string): Promise<Om[]>;
  createOm(om: InsertOm): Promise<Om>;
  updateOm(id: string, om: Partial<InsertOm>): Promise<Om | undefined>;
  deleteOm(id: string): Promise<void>;
  cloneOm(id: string): Promise<Om | undefined>;

  getPagesByOmId(omId: string): Promise<OmPage[]>;
  getPageById(id: string): Promise<OmPage | undefined>;
  createPage(page: InsertOmPage): Promise<OmPage>;
  updatePage(id: string, page: Partial<InsertOmPage>): Promise<OmPage | undefined>;
  deletePage(id: string): Promise<void>;
  reorderPages(omId: string, pageIds: string[]): Promise<void>;

  getBlocksByPageId(pageId: string): Promise<OmBlock[]>;
  getBlockById(id: string): Promise<OmBlock | undefined>;
  createBlock(block: InsertOmBlock): Promise<OmBlock>;
  updateBlock(id: string, block: Partial<InsertOmBlock>): Promise<OmBlock | undefined>;
  deleteBlock(id: string): Promise<void>;
  reorderBlocks(pageId: string, blockIds: string[]): Promise<void>;

  getTemplates(filters?: { scope?: string; category?: string; organizationId?: string }): Promise<OmTemplate[]>;
  getTemplateById(id: string): Promise<OmTemplate | undefined>;
  createTemplate(template: InsertOmTemplate): Promise<OmTemplate>;
  deleteTemplate(id: string): Promise<void>;

  getDatasetsByProjectId(projectId: string): Promise<OmDataset[]>;
  getDatasetById(id: string): Promise<OmDataset | undefined>;
  createDataset(dataset: InsertOmDataset): Promise<OmDataset>;
  updateDataset(id: string, dataset: Partial<InsertOmDataset>): Promise<OmDataset | undefined>;
  deleteDataset(id: string): Promise<void>;

  // Brand Kits
  getBrandKits(organizationId?: string): Promise<OmBrandKit[]>;
  getBrandKitById(id: string): Promise<OmBrandKit | undefined>;
  createBrandKit(brandKit: InsertOmBrandKit): Promise<OmBrandKit>;
  updateBrandKit(id: string, brandKit: Partial<InsertOmBrandKit>): Promise<OmBrandKit | undefined>;
  deleteBrandKit(id: string): Promise<void>;

  // Document Versions
  getVersionsByOmId(omId: string): Promise<OmDocumentVersion[]>;
  getVersionById(id: string): Promise<OmDocumentVersion | undefined>;
  createVersion(omId: string, snapshot: any, userId?: string): Promise<OmDocumentVersion>;
  getLatestVersionNumber(omId: string): Promise<number>;

  // Assets
  getAssetsByOrganization(organizationId: string): Promise<OmAsset[]>;
  getAssetById(id: string): Promise<OmAsset | undefined>;
  createAsset(asset: InsertOmAsset): Promise<OmAsset>;
  deleteAsset(id: string): Promise<void>;
}

export class OmDbStorage implements IOmStorage {
  async getOmById(id: string): Promise<Om | undefined> {
    const [om] = await db.select().from(oms).where(eq(oms.id, id));
    return om;
  }

  async getOmsByProjectId(projectId: string): Promise<Om[]> {
    return db
      .select()
      .from(oms)
      .where(eq(oms.projectId, projectId))
      .orderBy(desc(oms.updatedAt));
  }

  async getOmsByOrganizationId(organizationId: string): Promise<Om[]> {
    return db
      .select()
      .from(oms)
      .where(eq(oms.organizationId, organizationId))
      .orderBy(desc(oms.updatedAt));
  }

  async getOmsByDealId(dealId: string): Promise<Om[]> {
    return db
      .select()
      .from(oms)
      .where(eq(oms.dealId, dealId))
      .orderBy(desc(oms.updatedAt));
  }

  async getOmsByModelingProjectId(modelingProjectId: string): Promise<Om[]> {
    return db
      .select()
      .from(oms)
      .where(eq(oms.modelingProjectId, modelingProjectId))
      .orderBy(desc(oms.updatedAt));
  }

  async createOm(om: InsertOm): Promise<Om> {
    const [created] = await db.insert(oms).values(om).returning();
    return created;
  }

  async updateOm(id: string, om: Partial<InsertOm>): Promise<Om | undefined> {
    const [updated] = await db
      .update(oms)
      .set({ ...om, updatedAt: new Date() })
      .where(eq(oms.id, id))
      .returning();
    return updated;
  }

  async deleteOm(id: string): Promise<void> {
    await db.delete(oms).where(eq(oms.id, id));
  }

  async cloneOm(id: string): Promise<Om | undefined> {
    return db.transaction(async (tx) => {
      const [original] = await tx.select().from(oms).where(eq(oms.id, id));
      if (!original) return undefined;

      const [cloned] = await tx
        .insert(oms)
        .values({
          projectId: original.projectId,
          organizationId: original.organizationId,
          name: `${original.name} (Copy)`,
          status: 'draft',
          version: original.version + 1,
          settings: original.settings,
          createdBy: original.createdBy,
          updatedBy: original.updatedBy,
        })
        .returning();

      const originalPages = await tx
        .select()
        .from(omPages)
        .where(eq(omPages.omId, id))
        .orderBy(omPages.orderIndex);

      for (const page of originalPages) {
        const [clonedPage] = await tx
          .insert(omPages)
          .values({
            omId: cloned.id,
            title: page.title,
            orderIndex: page.orderIndex,
            layout: page.layout,
          })
          .returning();

        const originalBlocks = await tx
          .select()
          .from(omBlocks)
          .where(eq(omBlocks.pageId, page.id))
          .orderBy(omBlocks.orderIndex);

        for (const block of originalBlocks) {
          await tx.insert(omBlocks).values({
            pageId: clonedPage.id,
            type: block.type,
            orderIndex: block.orderIndex,
            content: block.content,
            dataBinding: block.dataBinding,
            style: block.style,
            aiMetadata: block.aiMetadata,
          });
        }
      }

      return cloned;
    });
  }

  async getPagesByOmId(omId: string): Promise<OmPage[]> {
    return db
      .select()
      .from(omPages)
      .where(eq(omPages.omId, omId))
      .orderBy(omPages.orderIndex);
  }

  async getPageById(id: string): Promise<OmPage | undefined> {
    const [page] = await db.select().from(omPages).where(eq(omPages.id, id));
    return page;
  }

  async createPage(page: InsertOmPage): Promise<OmPage> {
    const [created] = await db.insert(omPages).values(page).returning();
    return created;
  }

  async updatePage(id: string, page: Partial<InsertOmPage>): Promise<OmPage | undefined> {
    const [updated] = await db
      .update(omPages)
      .set({ ...page, updatedAt: new Date() })
      .where(eq(omPages.id, id))
      .returning();
    return updated;
  }

  async deletePage(id: string): Promise<void> {
    await db.delete(omPages).where(eq(omPages.id, id));
  }

  async reorderPages(omId: string, pageIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < pageIds.length; i++) {
        await tx
          .update(omPages)
          .set({ orderIndex: i, updatedAt: new Date() })
          .where(and(eq(omPages.id, pageIds[i]), eq(omPages.omId, omId)));
      }
    });
  }

  async getBlocksByPageId(pageId: string): Promise<OmBlock[]> {
    return db
      .select()
      .from(omBlocks)
      .where(eq(omBlocks.pageId, pageId))
      .orderBy(omBlocks.orderIndex);
  }

  async getBlockById(id: string): Promise<OmBlock | undefined> {
    const [block] = await db.select().from(omBlocks).where(eq(omBlocks.id, id));
    return block;
  }

  async createBlock(block: InsertOmBlock): Promise<OmBlock> {
    const [created] = await db.insert(omBlocks).values(block).returning();
    return created;
  }

  async updateBlock(id: string, block: Partial<InsertOmBlock>): Promise<OmBlock | undefined> {
    const [updated] = await db
      .update(omBlocks)
      .set({ ...block, updatedAt: new Date() })
      .where(eq(omBlocks.id, id))
      .returning();
    return updated;
  }

  async deleteBlock(id: string): Promise<void> {
    await db.delete(omBlocks).where(eq(omBlocks.id, id));
  }

  async reorderBlocks(pageId: string, blockIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < blockIds.length; i++) {
        await tx
          .update(omBlocks)
          .set({ orderIndex: i, updatedAt: new Date() })
          .where(and(eq(omBlocks.id, blockIds[i]), eq(omBlocks.pageId, pageId)));
      }
    });
  }

  async getTemplates(filters?: { scope?: string; category?: string; organizationId?: string }): Promise<OmTemplate[]> {
    let query = db.select().from(omTemplates);

    if (filters?.scope) {
      query = query.where(eq(omTemplates.scope, filters.scope as any)) as any;
    }
    if (filters?.category) {
      query = query.where(eq(omTemplates.category, filters.category)) as any;
    }

    return query.orderBy(desc(omTemplates.createdAt));
  }

  async getTemplateById(id: string): Promise<OmTemplate | undefined> {
    const [template] = await db.select().from(omTemplates).where(eq(omTemplates.id, id));
    return template;
  }

  async createTemplate(template: InsertOmTemplate): Promise<OmTemplate> {
    const [created] = await db.insert(omTemplates).values(template).returning();
    return created;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(omTemplates).where(eq(omTemplates.id, id));
  }

  async getDatasetsByProjectId(projectId: string): Promise<OmDataset[]> {
    return db
      .select()
      .from(omDatasets)
      .where(eq(omDatasets.projectId, projectId))
      .orderBy(desc(omDatasets.updatedAt));
  }

  async getDatasetById(id: string): Promise<OmDataset | undefined> {
    const [dataset] = await db.select().from(omDatasets).where(eq(omDatasets.id, id));
    return dataset;
  }

  async createDataset(dataset: InsertOmDataset): Promise<OmDataset> {
    const [created] = await db.insert(omDatasets).values(dataset).returning();
    return created;
  }

  async updateDataset(id: string, dataset: Partial<InsertOmDataset>): Promise<OmDataset | undefined> {
    const [updated] = await db
      .update(omDatasets)
      .set({ ...dataset, updatedAt: new Date() })
      .where(eq(omDatasets.id, id))
      .returning();
    return updated;
  }

  async deleteDataset(id: string): Promise<void> {
    await db.delete(omDatasets).where(eq(omDatasets.id, id));
  }

  // ============================================================================
  // Brand Kits
  // ============================================================================
  async getBrandKits(organizationId?: string): Promise<OmBrandKit[]> {
    if (organizationId) {
      return db
        .select()
        .from(omBrandKits)
        .where(eq(omBrandKits.organizationId, organizationId))
        .orderBy(desc(omBrandKits.updatedAt));
    }
    return db.select().from(omBrandKits).orderBy(desc(omBrandKits.updatedAt));
  }

  async getBrandKitById(id: string): Promise<OmBrandKit | undefined> {
    const [kit] = await db.select().from(omBrandKits).where(eq(omBrandKits.id, id));
    return kit;
  }

  async createBrandKit(brandKit: InsertOmBrandKit): Promise<OmBrandKit> {
    const [created] = await db.insert(omBrandKits).values(brandKit).returning();
    return created;
  }

  async updateBrandKit(id: string, brandKit: Partial<InsertOmBrandKit>): Promise<OmBrandKit | undefined> {
    const [updated] = await db
      .update(omBrandKits)
      .set({ ...brandKit, updatedAt: new Date() })
      .where(eq(omBrandKits.id, id))
      .returning();
    return updated;
  }

  async deleteBrandKit(id: string): Promise<void> {
    await db.delete(omBrandKits).where(eq(omBrandKits.id, id));
  }

  // ============================================================================
  // Document Versions
  // ============================================================================
  async getVersionsByOmId(omId: string): Promise<OmDocumentVersion[]> {
    return db
      .select()
      .from(omDocumentVersions)
      .where(eq(omDocumentVersions.omId, omId))
      .orderBy(desc(omDocumentVersions.versionNumber));
  }

  async getVersionById(id: string): Promise<OmDocumentVersion | undefined> {
    const [version] = await db.select().from(omDocumentVersions).where(eq(omDocumentVersions.id, id));
    return version;
  }

  async getLatestVersionNumber(omId: string): Promise<number> {
    const result = await db
      .select({ maxVersion: max(omDocumentVersions.versionNumber) })
      .from(omDocumentVersions)
      .where(eq(omDocumentVersions.omId, omId));
    return result[0]?.maxVersion || 0;
  }

  async createVersion(omId: string, snapshot: any, userId?: string): Promise<OmDocumentVersion> {
    const latestVersion = await this.getLatestVersionNumber(omId);
    const [created] = await db
      .insert(omDocumentVersions)
      .values({
        omId,
        versionNumber: latestVersion + 1,
        snapshotJson: snapshot,
        createdBy: userId,
      })
      .returning();
    return created;
  }

  // ============================================================================
  // Assets
  // ============================================================================
  async getAssetsByOrganization(organizationId: string): Promise<OmAsset[]> {
    return db
      .select()
      .from(omAssets)
      .where(eq(omAssets.organizationId, organizationId))
      .orderBy(desc(omAssets.createdAt));
  }

  async getAssetById(id: string): Promise<OmAsset | undefined> {
    const [asset] = await db.select().from(omAssets).where(eq(omAssets.id, id));
    return asset;
  }

  async createAsset(asset: InsertOmAsset): Promise<OmAsset> {
    const [created] = await db.insert(omAssets).values(asset).returning();
    return created;
  }

  async deleteAsset(id: string): Promise<void> {
    await db.delete(omAssets).where(eq(omAssets.id, id));
  }
}

export const omStorage = new OmDbStorage();
