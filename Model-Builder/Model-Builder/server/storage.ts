import {
  type User,
  type InsertUser,
  type Om,
  type InsertOm,
  type OmPage,
  type InsertOmPage,
  type OmBlock,
  type InsertOmBlock,
  type OmTemplate,
  type InsertOmTemplate,
  type Dataset,
  type InsertDataset,
  users,
  oms,
  omPages,
  omBlocks,
  omTemplates,
  datasets,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // OM methods
  getOmById(id: string): Promise<Om | undefined>;
  getOmsByProjectId(projectId: string): Promise<Om[]>;
  createOm(om: InsertOm): Promise<Om>;
  updateOm(id: string, om: Partial<InsertOm>): Promise<Om | undefined>;
  deleteOm(id: string): Promise<void>;
  cloneOm(id: string): Promise<Om | undefined>;

  // OM Page methods
  getPagesByOmId(omId: string): Promise<OmPage[]>;
  getPageById(id: string): Promise<OmPage | undefined>;
  createPage(page: InsertOmPage): Promise<OmPage>;
  updatePage(id: string, page: Partial<InsertOmPage>): Promise<OmPage | undefined>;
  deletePage(id: string): Promise<void>;
  reorderPages(omId: string, pageIds: string[]): Promise<void>;

  // OM Block methods
  getBlocksByPageId(pageId: string): Promise<OmBlock[]>;
  getBlockById(id: string): Promise<OmBlock | undefined>;
  createBlock(block: InsertOmBlock): Promise<OmBlock>;
  updateBlock(id: string, block: Partial<InsertOmBlock>): Promise<OmBlock | undefined>;
  deleteBlock(id: string): Promise<void>;
  reorderBlocks(pageId: string, blockIds: string[]): Promise<void>;

  // Template methods
  getTemplates(filters?: { scope?: string; category?: string }): Promise<OmTemplate[]>;
  createTemplate(template: InsertOmTemplate): Promise<OmTemplate>;
  deleteTemplate(id: string): Promise<void>;

  // Dataset methods
  getDatasetsByProjectId(projectId: string): Promise<Dataset[]>;
  getDatasetById(id: string): Promise<Dataset | undefined>;
  createDataset(dataset: InsertDataset): Promise<Dataset>;
  updateDataset(id: string, dataset: Partial<InsertDataset>): Promise<Dataset | undefined>;
  deleteDataset(id: string): Promise<void>;
}

export class DbStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // OM methods
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
      // Get original OM
      const [original] = await tx.select().from(oms).where(eq(oms.id, id));
      if (!original) return undefined;

      // Create cloned OM
      const [cloned] = await tx
        .insert(oms)
        .values({
          projectId: original.projectId,
          name: `${original.name} v${original.version + 1}`,
          status: 'draft',
          version: original.version + 1,
          settings: original.settings,
          createdBy: original.createdBy,
          updatedBy: original.updatedBy,
        })
        .returning();

      // Get original pages
      const originalPages = await tx
        .select()
        .from(omPages)
        .where(eq(omPages.omId, id))
        .orderBy(omPages.orderIndex);

      // Clone pages and blocks
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

        // Get and clone blocks
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

  // OM Page methods
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

  async updatePage(
    id: string,
    page: Partial<InsertOmPage>,
  ): Promise<OmPage | undefined> {
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

  // OM Block methods
  async getBlocksByPageId(pageId: string): Promise<OmBlock[]> {
    return db
      .select()
      .from(omBlocks)
      .where(eq(omBlocks.pageId, pageId))
      .orderBy(omBlocks.orderIndex);
  }

  async getBlockById(id: string): Promise<OmBlock | undefined> {
    const [block] = await db
      .select()
      .from(omBlocks)
      .where(eq(omBlocks.id, id));
    return block;
  }

  async createBlock(block: InsertOmBlock): Promise<OmBlock> {
    const [created] = await db.insert(omBlocks).values(block).returning();
    return created;
  }

  async updateBlock(
    id: string,
    block: Partial<InsertOmBlock>,
  ): Promise<OmBlock | undefined> {
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

  // Template methods
  async getTemplates(filters?: {
    scope?: string;
    category?: string;
  }): Promise<OmTemplate[]> {
    let query = db.select().from(omTemplates);

    if (filters?.scope) {
      query = query.where(eq(omTemplates.scope, filters.scope)) as any;
    }
    if (filters?.category) {
      query = query.where(eq(omTemplates.category, filters.category)) as any;
    }

    return query.orderBy(desc(omTemplates.createdAt));
  }

  async createTemplate(template: InsertOmTemplate): Promise<OmTemplate> {
    const [created] = await db
      .insert(omTemplates)
      .values(template)
      .returning();
    return created;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(omTemplates).where(eq(omTemplates.id, id));
  }

  // Dataset methods
  async getDatasetsByProjectId(projectId: string): Promise<Dataset[]> {
    return db
      .select()
      .from(datasets)
      .where(eq(datasets.projectId, projectId))
      .orderBy(desc(datasets.updatedAt));
  }

  async getDatasetById(id: string): Promise<Dataset | undefined> {
    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, id));
    return dataset;
  }

  async createDataset(dataset: InsertDataset): Promise<Dataset> {
    const [created] = await db.insert(datasets).values(dataset).returning();
    return created;
  }

  async updateDataset(id: string, dataset: Partial<InsertDataset>): Promise<Dataset | undefined> {
    const [updated] = await db
      .update(datasets)
      .set({ ...dataset, updatedAt: new Date() })
      .where(eq(datasets.id, id))
      .returning();
    return updated;
  }

  async deleteDataset(id: string): Promise<void> {
    await db.delete(datasets).where(eq(datasets.id, id));
  }
}

export const storage = new DbStorage();
