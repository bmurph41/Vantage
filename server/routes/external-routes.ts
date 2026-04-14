import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { geocodingService } from "../services/geocodingService";
import { ownedAssetsService } from "../services/owned-assets-service";
import { dashboardService } from "../services/dashboard-service";
import { CompService } from "../services/salescomps/compService";
import { FilterBuilder } from "../services/salescomps/filterBuilder";
import { RecommendationService } from "../services/salescomps/recommendationService";
import { AICompMatchingService } from "../services/salescomps/aiCompMatchingService";
import { ParserService as RcParserService } from "../services/ratecomps/parser";
import { CompService as RcCompService } from "../services/ratecomps/compService";
import { FilterBuilder as RcFilterBuilder } from "../services/ratecomps/filterBuilder";
import { RecommendationService as RcRecommendationService } from "../services/ratecomps/recommendationService";
import {
  calculateMetrics as rcCalculateMetrics,
  generateInsights as rcGenerateInsights,
  calculateRateTierMetrics,
  generateRateTierInsights,
  type AnalyticsFilters as RcAnalyticsFilters,
  type RateTierAnalyticsFilters,
} from "../services/ratecomps/analyticsService";
import multer from "multer";
import { z } from "zod";
import { enforceTenant } from "../middleware/tenant-isolation";
import {
  salesComps,
  rateComps,
  insertPendingSalesCompSchema,
  insertRateCompSchema,
  insertOwnedAssetSchema,
  updateOwnedAssetSchema,
  insertAssetPerformanceSnapshotSchema,
  scPortfolios,
  scPortfolioComps,
  insertScSavedSearchSchema,
  updateScSavedSearchSchema,
  insertScRecommendationFeedbackSchema,
  scProjectProfileSchema,
  scWeightOverridesSchema,
  industryStandards,
} from "@shared/schema";
import {
  salesCompUpdateSchema,
  bulkUpdateSchema,
  compColumnCreateSchema,
  compColumnUpdateSchema,
  compFiltersSchema,
  projectCreateSchema as scProjectCreateSchema,
  projectUpdateSchema as scProjectUpdateSchema,
  projectCompCreateSchema,
  projectCompUpdateSchema,
  projectCompBulkSchema,
  bulkPortfolioCreateSchema,
} from "../utils/salescomps-zod-schemas";
import { PROFIT_CENTERS } from "@shared/salescomps-constants";

const uploadRateComps = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

const rcParserService = new RcParserService();
const rcCompService = new RcCompService(storage, rcParserService);
const rcFilterBuilder = new RcFilterBuilder();
const rcRecommendationService = new RcRecommendationService(storage);
const compService = new CompService(storage, rcParserService as any);
const filterBuilder = new FilterBuilder();
const recommendationService = new RecommendationService(storage);
const aiCompMatchingService = new AICompMatchingService();

export function registerExternalRoutes(
  app: Express,
  authenticateUser: any
) {
  // Custom Dashboard Modules CRUD
  // Get all custom modules for the user
  app.get('/api/dashboards/custom-modules', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dashboardCustomModules } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const modules = await db
        .select()
        .from(dashboardCustomModules)
        .where(eq(dashboardCustomModules.userId, userId))
        .orderBy(desc(dashboardCustomModules.displayOrder));

      res.json(modules);
    } catch (error: any) {
      console.error('Failed to fetch custom modules:', error);
      res.status(500).json({ error: 'Failed to fetch custom modules' });
    }
  });

  // Create a new custom module
  app.post('/api/dashboards/custom-modules', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { dashboardCustomModules, insertDashboardCustomModuleSchema } = await import('@shared/schema');
      
      const validated = insertDashboardCustomModuleSchema.parse({
        title: req.body.title,
        moduleType: req.body.moduleType,
        filters: req.body.filters || {},
        visualizationType: req.body.visualizationType || 'table',
        chartConfig: req.body.chartConfig || {},
        userId,
        orgId,
      });

      const [newModule] = await db
        .insert(dashboardCustomModules)
        .values(validated)
        .returning();

      res.json(newModule);
    } catch (error: any) {
      console.error('Failed to create custom module:', error);
      res.status(500).json({ error: 'Failed to create custom module' });
    }
  });

  // Update a custom module
  app.put('/api/dashboards/custom-modules/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const moduleId = req.params.id;
      const { dashboardCustomModules } = await import('@shared/schema');
      const { and } = await import('drizzle-orm');
      
      // Verify ownership
      const existing = await db
        .select()
        .from(dashboardCustomModules)
        .where(and(
          eq(dashboardCustomModules.id, moduleId),
          eq(dashboardCustomModules.userId, userId)
        ))
        .limit(1);

      if (!existing || existing.length === 0) {
        return res.status(404).json({ error: 'Custom module not found' });
      }

      const [updated] = await db
        .update(dashboardCustomModules)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(dashboardCustomModules.id, moduleId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update custom module:', error);
      res.status(500).json({ error: 'Failed to update custom module' });
    }
  });

  // Delete a custom module
  app.delete('/api/dashboards/custom-modules/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const moduleId = req.params.id;
      const { dashboardCustomModules } = await import('@shared/schema');
      const { and } = await import('drizzle-orm');
      
      // Verify ownership
      const existing = await db
        .select()
        .from(dashboardCustomModules)
        .where(and(
          eq(dashboardCustomModules.id, moduleId),
          eq(dashboardCustomModules.userId, userId)
        ))
        .limit(1);

      if (!existing || existing.length === 0) {
        return res.status(404).json({ error: 'Custom module not found' });
      }

      await db
        .delete(dashboardCustomModules)
        .where(eq(dashboardCustomModules.id, moduleId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete custom module:', error);
      res.status(500).json({ error: 'Failed to delete custom module' });
    }
  });

  // Get filtered data for custom module
  app.post('/api/dashboards/custom-modules/data', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { moduleType, filters, limit } = req.body;
      const { getFilteredModuleData } = await import('../services/custom-module-service');
      
      const data = await getFilteredModuleData({ moduleType, filters, limit }, orgId);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to fetch custom module data:', error);
      res.status(500).json({ error: 'Failed to fetch custom module data' });
    }
  });

  // Generate preview data for custom module
  app.post('/api/dashboards/custom-modules/preview', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { visualizationType, moduleType, config } = req.body;
      const { dashboardService } = await import('../services/dashboard-service');
      
      const previewData = await dashboardService.generateModulePreview(
        orgId,
        visualizationType,
        moduleType,
        config
      );
      
      res.json(previewData);
    } catch (error: any) {
      console.error('Failed to generate preview data:', error);
      res.status(500).json({ error: 'Failed to generate preview data' });
    }
  });

  // Get user dashboard module preferences
  app.get('/api/dashboards/modules', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { users } = await import('@shared/schema');
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user || user.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const config = user[0].dashboardConfig as any || {};
      const selectedModules = config.selectedModules || [];
      
      res.json({ selectedModules });
    } catch (error: any) {
      console.error('Failed to fetch dashboard modules:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard modules' });
    }
  });

  // Save user dashboard module preferences
  app.put('/api/dashboards/modules', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { selectedModules } = req.body;
      const { users } = await import('@shared/schema');

      if (!Array.isArray(selectedModules)) {
        return res.status(400).json({ error: 'selectedModules must be an array' });
      }

      // Validate module IDs
      const validModuleIds = [
        'crm-pipeline',
        'modeling-projects',
        'sales-comps',
        'rent-roll',
        'due-diligence',
        'vdr-activity',
        'docket-feed',
        'fuel-operations',
        'ship-store',
      ];

      const invalidModules = selectedModules.filter(id => !validModuleIds.includes(id));
      if (invalidModules.length > 0) {
        return res.status(400).json({ 
          error: 'Invalid module IDs',
          invalidModules 
        });
      }

      await db.update(users)
        .set({ 
          dashboardConfig: sql`jsonb_set(COALESCE(dashboard_config, '{}'::jsonb), '{selectedModules}', ${JSON.stringify(selectedModules)}::jsonb)`
        })
        .where(eq(users.id, userId));

      res.json({ success: true, selectedModules });
    } catch (error: any) {
      console.error('Failed to save dashboard modules:', error);
      res.status(500).json({ error: 'Failed to save dashboard modules' });
    }
  });

  // ========================================================================
  // QUICK ACCESS (Pinned Items, Recent Items, Favorites)
  // ========================================================================

  // Batched validation of quick access items - groups by type and uses IN clauses for efficiency
  async function batchValidateQuickAccessItems(items: Array<{ id: string; itemType: string; itemId: string }>, orgId: string): Promise<Map<string, { exists: boolean; liveData?: any }>> {
    const results = new Map<string, { exists: boolean; liveData?: any }>();
    
    const groupedByType: Record<string, Array<{ id: string; itemId: string }>> = {};
    for (const item of items) {
      if (!groupedByType[item.itemType]) {
        groupedByType[item.itemType] = [];
      }
      groupedByType[item.itemType].push({ id: item.id, itemId: item.itemId });
    }
    
    await Promise.all(Object.entries(groupedByType).map(async ([itemType, typeItems]) => {
      const itemIds = typeItems.map(i => i.itemId);
      if (itemIds.length === 0) return;
      
      try {
        switch (itemType) {
          case 'deal': {
            const deals = await db.select({ id: crmDeals.id, name: crmDeals.name, amount: crmDeals.amount, status: crmDeals.status })
              .from(crmDeals)
              .where(and(eq(crmDeals.orgId, orgId), inArray(crmDeals.id, itemIds)));
            const dealsMap = new Map(deals.map(d => [d.id, d]));
            for (const item of typeItems) {
              const deal = dealsMap.get(item.itemId);
              results.set(item.id, deal 
                ? { exists: true, liveData: { title: deal.name, subtitle: deal.status, metadata: { amount: deal.amount } } }
                : { exists: false });
            }
            break;
          }
          case 'contact': {
            const contacts = await db.select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName, email: crmContacts.email })
              .from(crmContacts)
              .where(and(eq(crmContacts.orgId, orgId), inArray(crmContacts.id, itemIds)));
            const contactsMap = new Map(contacts.map(c => [c.id, c]));
            for (const item of typeItems) {
              const contact = contactsMap.get(item.itemId);
              results.set(item.id, contact 
                ? { exists: true, liveData: { title: `${contact.firstName} ${contact.lastName}`, subtitle: contact.email } }
                : { exists: false });
            }
            break;
          }
          case 'company': {
            const companies = await db.select({ id: crmCompanies.id, name: crmCompanies.name, industry: crmCompanies.industry })
              .from(crmCompanies)
              .where(and(eq(crmCompanies.orgId, orgId), inArray(crmCompanies.id, itemIds)));
            const companiesMap = new Map(companies.map(c => [c.id, c]));
            for (const item of typeItems) {
              const company = companiesMap.get(item.itemId);
              results.set(item.id, company 
                ? { exists: true, liveData: { title: company.name, subtitle: company.industry } }
                : { exists: false });
            }
            break;
          }
          case 'property': {
            const properties = await db.select({ id: crmProperties.id, name: crmProperties.name, city: crmProperties.city, state: crmProperties.state })
              .from(crmProperties)
              .where(and(eq(crmProperties.orgId, orgId), inArray(crmProperties.id, itemIds)));
            const propertiesMap = new Map(properties.map(p => [p.id, p]));
            for (const item of typeItems) {
              const property = propertiesMap.get(item.itemId);
              results.set(item.id, property 
                ? { exists: true, liveData: { title: property.name, subtitle: property.city ? `${property.city}, ${property.state}` : property.state } }
                : { exists: false });
            }
            break;
          }
          case 'modelingProject': {
            const models = await db.select({ id: modelingProjects.id, name: modelingProjects.name, status: modelingProjects.status, location: modelingProjects.location })
              .from(modelingProjects)
              .where(and(eq(modelingProjects.orgId, orgId), inArray(modelingProjects.id, itemIds)));
            const modelsMap = new Map(models.map(m => [m.id, m]));
            for (const item of typeItems) {
              const model = modelsMap.get(item.itemId);
              results.set(item.id, model 
                ? { exists: true, liveData: { title: model.name, subtitle: model.status || model.location } }
                : { exists: false });
            }
            break;
          }
          case 'ddProject': {
            const ddProjects = await db.select({ id: projects.id, name: projects.name, status: projects.status })
              .from(projects)
              .where(and(eq(projects.orgId, orgId), inArray(projects.id, itemIds)));
            const projectsMap = new Map(ddProjects.map(p => [p.id, p]));
            for (const item of typeItems) {
              const project = projectsMap.get(item.itemId);
              results.set(item.id, project 
                ? { exists: true, liveData: { title: project.name, subtitle: project.status } }
                : { exists: false });
            }
            break;
          }
          default:
            for (const item of typeItems) {
              results.set(item.id, { exists: true });
            }
        }
      } catch (error: any) {
        console.error(`Error batch validating ${itemType} items:`, error);
        for (const item of typeItems) {
          results.set(item.id, { exists: true });
        }
      }
    }));
    
    return results;
  }

  // Get all pinned items for user (with optional batched validation)
  app.get('/api/quick-access/pinned', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const validate = req.query.validate === 'true';
      const { userPinnedItems } = await import('@shared/schema');
      
      const items = await db.select()
        .from(userPinnedItems)
        .where(and(
          eq(userPinnedItems.userId, userId),
          eq(userPinnedItems.orgId, orgId)
        ))
        .orderBy(userPinnedItems.sortOrder);
      
      if (validate && items.length > 0) {
        const validationResults = await batchValidateQuickAccessItems(
          items.map(i => ({ id: i.id, itemType: i.itemType, itemId: i.itemId })),
          orgId
        );
        const validatedItems = items.map(item => {
          const validation = validationResults.get(item.id) || { exists: true };
          return {
            ...item,
            isValid: validation.exists,
            ...(validation.liveData && { liveData: validation.liveData })
          };
        });
        res.json(validatedItems);
      } else {
        res.json(items);
      }
    } catch (error: any) {
      console.error('Failed to fetch pinned items:', error);
      res.status(500).json({ error: 'Failed to fetch pinned items' });
    }
  });
  
  // Cleanup stale pinned items (call periodically or when UI detects stale items)
  app.post('/api/quick-access/pinned/cleanup', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { staleItemIds } = req.body;
      const { userPinnedItems } = await import('@shared/schema');
      
      if (!Array.isArray(staleItemIds) || staleItemIds.length === 0) {
        return res.json({ deleted: 0 });
      }
      
      const deleted = await db.delete(userPinnedItems)
        .where(and(
          eq(userPinnedItems.userId, userId),
          eq(userPinnedItems.orgId, orgId),
          inArray(userPinnedItems.id, staleItemIds)
        ))
        .returning();
      
      res.json({ deleted: deleted.length });
    } catch (error: any) {
      console.error('Failed to cleanup stale pinned items:', error);
      res.status(500).json({ error: 'Failed to cleanup stale items' });
    }
  });

  // Add a pinned item
  app.post('/api/quick-access/pinned', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { userPinnedItems, insertUserPinnedItemSchema } = await import('@shared/schema');
      
      const validatedData = insertUserPinnedItemSchema.parse(req.body);
      
      const existingCount = await db.select({ count: sql<number>`count(*)` })
        .from(userPinnedItems)
        .where(and(
          eq(userPinnedItems.userId, userId),
          eq(userPinnedItems.orgId, orgId)
        ));
      
      const sortOrder = Number(existingCount[0]?.count) || 0;
      
      const [newItem] = await db.insert(userPinnedItems)
        .values({
          ...validatedData,
          userId,
          orgId,
          sortOrder,
        })
        .returning();
      
      res.json(newItem);
    } catch (error: any) {
      console.error('Failed to add pinned item:', error);
      res.status(500).json({ error: error.message || 'Failed to add pinned item' });
    }
  });

  // Update pinned item (reorder or edit)
  app.put('/api/quick-access/pinned/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { userPinnedItems, updateUserPinnedItemSchema } = await import('@shared/schema');
      
      const validatedData = updateUserPinnedItemSchema.parse(req.body);
      
      const [updated] = await db.update(userPinnedItems)
        .set(validatedData)
        .where(and(
          eq(userPinnedItems.id, id),
          eq(userPinnedItems.userId, userId),
          eq(userPinnedItems.orgId, orgId)
        ))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Pinned item not found' });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update pinned item:', error);
      res.status(500).json({ error: error.message || 'Failed to update pinned item' });
    }
  });

  // Remove a pinned item
  app.delete('/api/quick-access/pinned/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { userPinnedItems } = await import('@shared/schema');
      
      const [deleted] = await db.delete(userPinnedItems)
        .where(and(
          eq(userPinnedItems.id, id),
          eq(userPinnedItems.userId, userId),
          eq(userPinnedItems.orgId, orgId)
        ))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: 'Pinned item not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to remove pinned item:', error);
      res.status(500).json({ error: 'Failed to remove pinned item' });
    }
  });

  // Reorder pinned items
  app.put('/api/quick-access/pinned/reorder', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { itemIds } = req.body;
      const { userPinnedItems } = await import('@shared/schema');
      
      if (!Array.isArray(itemIds)) {
        return res.status(400).json({ error: 'itemIds must be an array' });
      }
      
      for (let i = 0; i < itemIds.length; i++) {
        await db.update(userPinnedItems)
          .set({ sortOrder: i })
          .where(and(
            eq(userPinnedItems.id, itemIds[i]),
            eq(userPinnedItems.userId, userId),
            eq(userPinnedItems.orgId, orgId)
          ));
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to reorder pinned items:', error);
      res.status(500).json({ error: 'Failed to reorder pinned items' });
    }
  });

  // Get recent items for user
  app.get('/api/quick-access/recent', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const { userRecentItems } = await import('@shared/schema');
      
      const items = await db.select()
        .from(userRecentItems)
        .where(and(
          eq(userRecentItems.userId, userId),
          eq(userRecentItems.orgId, orgId)
        ))
        .orderBy(desc(userRecentItems.accessedAt))
        .limit(limit);
      
      res.json(items);
    } catch (error: any) {
      console.error('Failed to fetch recent items:', error);
      res.status(500).json({ error: 'Failed to fetch recent items' });
    }
  });

  // Record a recent item access (upsert)
  app.post('/api/quick-access/recent', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { userRecentItems, insertUserRecentItemSchema } = await import('@shared/schema');
      
      const validatedData = insertUserRecentItemSchema.parse(req.body);
      
      const [existing] = await db.select()
        .from(userRecentItems)
        .where(and(
          eq(userRecentItems.userId, userId),
          eq(userRecentItems.orgId, orgId),
          eq(userRecentItems.itemType, validatedData.itemType),
          validatedData.itemId ? eq(userRecentItems.itemId, validatedData.itemId) : sql`item_id IS NULL`
        ))
        .limit(1);
      
      let result;
      if (existing) {
        [result] = await db.update(userRecentItems)
          .set({
            title: validatedData.title,
            link: validatedData.link,
            icon: validatedData.icon,
            accessedAt: new Date(),
          })
          .where(eq(userRecentItems.id, existing.id))
          .returning();
      } else {
        [result] = await db.insert(userRecentItems)
          .values({
            ...validatedData,
            userId,
            orgId,
          })
          .returning();
        
        const count = await db.select({ count: sql<number>`count(*)` })
          .from(userRecentItems)
          .where(and(
            eq(userRecentItems.userId, userId),
            eq(userRecentItems.orgId, orgId)
          ));
        
        if (Number(count[0]?.count) > 50) {
          const oldItems = await db.select({ id: userRecentItems.id })
            .from(userRecentItems)
            .where(and(
              eq(userRecentItems.userId, userId),
              eq(userRecentItems.orgId, orgId)
            ))
            .orderBy(desc(userRecentItems.accessedAt))
            .offset(50);
          
          if (oldItems.length > 0) {
            await db.delete(userRecentItems)
              .where(sql`id IN (${oldItems.map(i => i.id).join(',')})`);
          }
        }
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('Failed to record recent item:', error);
      res.status(500).json({ error: error.message || 'Failed to record recent item' });
    }
  });

  // Clear recent items
  app.delete('/api/quick-access/recent', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { userRecentItems } = await import('@shared/schema');
      
      await db.delete(userRecentItems)
        .where(and(
          eq(userRecentItems.userId, userId),
          eq(userRecentItems.orgId, orgId)
        ));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to clear recent items:', error);
      res.status(500).json({ error: 'Failed to clear recent items' });
    }
  });

  // Get all favorites for user
  app.get('/api/quick-access/favorites', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const itemType = req.query.itemType as string | undefined;
      const { userFavorites } = await import('@shared/schema');
      
      let query = db.select()
        .from(userFavorites)
        .where(and(
          eq(userFavorites.userId, userId),
          eq(userFavorites.orgId, orgId),
          itemType ? eq(userFavorites.itemType, itemType) : sql`true`
        ))
        .orderBy(desc(userFavorites.favoritedAt));
      
      const items = await query;
      res.json(items);
    } catch (error: any) {
      console.error('Failed to fetch favorites:', error);
      res.status(500).json({ error: 'Failed to fetch favorites' });
    }
  });

  // Check if an item is favorited
  app.get('/api/quick-access/favorites/check', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { itemType, itemId } = req.query;
      const { userFavorites } = await import('@shared/schema');
      
      if (!itemType || !itemId) {
        return res.status(400).json({ error: 'itemType and itemId are required' });
      }
      
      const [existing] = await db.select()
        .from(userFavorites)
        .where(and(
          eq(userFavorites.userId, userId),
          eq(userFavorites.orgId, orgId),
          eq(userFavorites.itemType, itemType as string),
          eq(userFavorites.itemId, itemId as string)
        ))
        .limit(1);
      
      res.json({ isFavorited: !!existing, favorite: existing || null });
    } catch (error: any) {
      console.error('Failed to check favorite status:', error);
      res.status(500).json({ error: 'Failed to check favorite status' });
    }
  });

  // Add a favorite (toggle on)
  app.post('/api/quick-access/favorites', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { userFavorites, insertUserFavoriteSchema } = await import('@shared/schema');
      
      const validatedData = insertUserFavoriteSchema.parse(req.body);
      
      const [existing] = await db.select()
        .from(userFavorites)
        .where(and(
          eq(userFavorites.userId, userId),
          eq(userFavorites.orgId, orgId),
          eq(userFavorites.itemType, validatedData.itemType),
          eq(userFavorites.itemId, validatedData.itemId)
        ))
        .limit(1);
      
      if (existing) {
        return res.json(existing);
      }
      
      const [newFavorite] = await db.insert(userFavorites)
        .values({
          ...validatedData,
          userId,
          orgId,
        })
        .returning();
      
      res.json(newFavorite);
    } catch (error: any) {
      console.error('Failed to add favorite:', error);
      res.status(500).json({ error: error.message || 'Failed to add favorite' });
    }
  });

  // Remove a favorite (toggle off)
  app.delete('/api/quick-access/favorites/:id', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { userFavorites } = await import('@shared/schema');
      
      const [deleted] = await db.delete(userFavorites)
        .where(and(
          eq(userFavorites.id, id),
          eq(userFavorites.userId, userId),
          eq(userFavorites.orgId, orgId)
        ))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: 'Favorite not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to remove favorite:', error);
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });

  // Remove a favorite by item type and ID
  app.delete('/api/quick-access/favorites/item/:itemType/:itemId', authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { itemType, itemId } = req.params;
      const { userFavorites } = await import('@shared/schema');
      
      const [deleted] = await db.delete(userFavorites)
        .where(and(
          eq(userFavorites.userId, userId),
          eq(userFavorites.orgId, orgId),
          eq(userFavorites.itemType, itemType),
          eq(userFavorites.itemId, itemId)
        ))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: 'Favorite not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to remove favorite:', error);
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  });

  // ========================================================================
  // OWNED ASSETS & PORTFOLIO
  // ========================================================================

  // Get all owned assets
  app.get('/api/owned-assets', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        status: req.query.status,
        holdStrategy: req.query.holdStrategy,
        propertyId: req.query.propertyId,
      };
      const assets = await ownedAssetsService.getOwnedAssets(orgId, filters);
      res.json(assets);
    } catch (error: any) {
      console.error('Failed to fetch owned assets:', error);
      res.status(500).json({ error: 'Failed to fetch owned assets' });
    }
  });

  // Get owned asset by ID with details
  app.get('/api/owned-assets/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const asset = await ownedAssetsService.getOwnedAssetWithDetails(req.params.id, orgId);
      
      if (!asset) {
        return res.status(404).json({ error: 'Owned asset not found' });
      }
      
      res.json(asset);
    } catch (error: any) {
      console.error('Failed to fetch owned asset:', error);
      res.status(500).json({ error: 'Failed to fetch owned asset' });
    }
  });

  // Create owned asset
  app.post('/api/owned-assets', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const data = insertOwnedAssetSchema.parse(req.body);
      const asset = await ownedAssetsService.createOwnedAsset(orgId, userId, data);
      res.status(201).json(asset);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create owned asset:', error);
      res.status(500).json({ error: 'Failed to create owned asset' });
    }
  });

  // Update owned asset
  app.patch('/api/owned-assets/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateOwnedAssetSchema.parse(req.body);
      const asset = await ownedAssetsService.updateOwnedAsset(req.params.id, orgId, data);
      
      if (!asset) {
        return res.status(404).json({ error: 'Owned asset not found' });
      }
      
      res.json(asset);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update owned asset:', error);
      res.status(500).json({ error: 'Failed to update owned asset' });
    }
  });

  // Delete owned asset
  app.delete('/api/owned-assets/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await ownedAssetsService.deleteOwnedAsset(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Owned asset not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete owned asset:', error);
      res.status(500).json({ error: 'Failed to delete owned asset' });
    }
  });

  // Get asset performance metrics
  app.get('/api/owned-assets/:id/performance', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const performance = await ownedAssetsService.getAssetPerformance(req.params.id, orgId);
      
      if (!performance) {
        return res.status(404).json({ error: 'Owned asset not found' });
      }
      
      res.json(performance);
    } catch (error: any) {
      console.error('Failed to fetch asset performance:', error);
      res.status(500).json({ error: 'Failed to fetch asset performance' });
    }
  });

  // Get performance snapshots for an asset
  app.get('/api/owned-assets/:id/snapshots', authenticateUser, async (req: any, res) => {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      };
      const snapshots = await ownedAssetsService.getAssetPerformanceSnapshots(req.params.id, filters);
      res.json(snapshots);
    } catch (error: any) {
      console.error('Failed to fetch performance snapshots:', error);
      res.status(500).json({ error: 'Failed to fetch performance snapshots' });
    }
  });

  // Create performance snapshot
  app.post('/api/owned-assets/:id/snapshots', authenticateUser, async (req: any, res) => {
    try {
      const data = insertAssetPerformanceSnapshotSchema.parse(req.body);
      const snapshot = await ownedAssetsService.createPerformanceSnapshot(req.params.id, data);
      res.status(201).json(snapshot);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create performance snapshot:', error);
      res.status(500).json({ error: 'Failed to create performance snapshot' });
    }
  });

  // Get portfolio summary
  app.get('/api/owned-assets/portfolio/summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const summary = await ownedAssetsService.getPortfolioSummary(orgId);
      res.json(summary);
    } catch (error: any) {
      console.error('Failed to fetch portfolio summary:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio summary' });
    }
  });

  // Convert deal to owned asset
  app.post('/api/owned-assets/convert-deal', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { propertyId, projectId, acquisitionPrice, acquisitionDate, holdStrategy } = req.body;
      
      if (!propertyId || !acquisitionDate) {
        return res.status(400).json({ error: 'propertyId and acquisitionDate are required' });
      }
      
      const asset = await ownedAssetsService.convertDealToOwnedAsset(orgId, userId, {
        propertyId,
        projectId,
        acquisitionPrice,
        acquisitionDate,
        holdStrategy,
      });
      
      res.status(201).json(asset);
    } catch (error: any) {
      console.error('Failed to convert deal to owned asset:', error);
      res.status(500).json({ error: 'Failed to convert deal to owned asset' });
    }
  });

  // Portfolio bulk creation routes
  app.post('/api/sales-comps/portfolios', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      // Validate request body using Zod schema
      const validatedData = bulkPortfolioCreateSchema.parse(req.body);
      const { portfolio, comps } = validatedData;

      // Wrap everything in a transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Create portfolio first
        const [createdPortfolio] = await tx.insert(scPortfolios).values({
          orgId,
          createdBy: userId,
          name: portfolio.name,
          description: portfolio.description || null,
          notes: portfolio.notes || null,
        }).returning();

        // Create all comps and link to portfolio
        const createdComps = [];
        for (let i = 0; i < comps.length; i++) {
          const compData = comps[i];
          
          // Create the comp using compService (handles property linking, etc.)
          const comp = await compService.createComp({
            ...compData,
            orgId,
            createdBy: userId,
          }, userId);
          
          createdComps.push(comp);

          // Link comp to portfolio
          await tx.insert(scPortfolioComps).values({
            orgId,
            portfolioId: createdPortfolio.id,
            salesCompId: comp.id,
            addedBy: userId,
            orderIndex: i,
          });
        }

        return {
          portfolio: createdPortfolio,
          comps: createdComps,
        };
      });

      // Create audit log (outside transaction since it's not critical)
      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'sc_portfolio',
        entityId: result.portfolio.id,
        action: 'create',
        after: {
          portfolio: result.portfolio,
          compCount: result.comps.length,
        },
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating portfolio:", error);
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create portfolio", error: error instanceof Error ? error.message : String(error) });
    }
  });
  // Pending Sales Comps routes
  app.get('/api/pending-sales-comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const comps = await storage.getPendingSalesComps(orgId);
      res.json(comps);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get pending sales comps", error: error.message });
    }
  });

  app.get('/api/pending-sales-comps/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const comp = await storage.getPendingSalesComp(req.params.id, orgId);
      if (!comp) return res.status(404).json({ message: "Pending sales comp not found" });
      res.json(comp);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get pending sales comp", error: error.message });
    }
  });

  app.post('/api/pending-sales-comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const validated = insertPendingSalesCompSchema.parse({
        ...req.body,
        orgId,
        createdBy: userId,
      });
      const comp = await storage.createPendingSalesComp(validated);
      res.status(201).json(comp);
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create pending sales comp", error: error.message });
    }
  });

  app.patch('/api/pending-sales-comps/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const comp = await storage.updatePendingSalesComp(req.params.id, req.body, orgId);
      if (!comp) return res.status(404).json({ message: "Pending sales comp not found" });
      res.json(comp);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update pending sales comp", error: error.message });
    }
  });

  app.delete('/api/pending-sales-comps/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const deleted = await storage.deletePendingSalesComp(req.params.id, orgId);
      if (!deleted) return res.status(404).json({ message: "Pending sales comp not found" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete pending sales comp", error: error.message });
    }
  });

  app.post('/api/pending-sales-comps/:id/accept', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const pending = await storage.getPendingSalesComp(req.params.id, orgId);
      if (!pending) return res.status(404).json({ message: "Pending sales comp not found" });

      const salesComp = await storage.createSalesComp({
        orgId,
        marina: pending.marina || '',
        address: pending.address || '',
        city: pending.city || '',
        state: pending.state || '',
        salePrice: pending.salePrice,
        saleMonth: pending.saleMonth,
        saleYear: pending.saleYear,
        capRate: pending.capRate,
        sellerName: pending.sellerName,
        buyerName: pending.buyerName,
        brokerName: pending.brokerName,
        transactionType: pending.transactionType || 'sale',
        notes: pending.notes,
        createdBy: userId,
        source: 'property_history',
      });

      const updated = await storage.acceptPendingSalesComp(req.params.id, orgId, userId, salesComp.id);
      res.json({ pendingSalesComp: updated, salesComp });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to accept pending sales comp", error: error.message });
    }
  });

  app.post('/api/pending-sales-comps/:id/reject', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const comp = await storage.rejectPendingSalesComp(req.params.id, orgId, userId);
      if (!comp) return res.status(404).json({ message: "Pending sales comp not found" });
      res.json(comp);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to reject pending sales comp", error: error.message });
    }
  });

  // SC Projects routes
  app.get('/api/sc-projects', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projects = await storage.getScProjects(orgId, userId);
      res.json(projects);
    } catch (error: any) {
      console.error("Error fetching SC projects:", error);
      res.status(500).json({ message: "Failed to fetch SC projects" });
    }
  });

  app.get('/api/sc-projects/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // Create child projects for portfolio properties
      const childProjects: any[] = [];
      if (req.body.projectType === "portfolio" && Array.isArray(req.body.portfolioProperties)) {
        for (const prop of req.body.portfolioProperties) {
          if (!prop.name) continue;
          try {
            let childPropertyId = null;
            try {
              const newProperty = await storage.createCrmProperty({
                orgId: req.user.orgId,
                title: prop.name,
                type: "marina",
                status: "pending",
                address: prop.address,
                city: prop.city,
                state: prop.state,
                zipCode: prop.zipCode,
                coordinates: prop.coordinates,
                ownerId: req.user.id,
                pipelineStage: "lead",
              });
              childPropertyId = newProperty.id;
            } catch (propError) {
              console.error("[Portfolio] Failed to auto-create property:", propError);
            }
            const childProjectData = insertProjectSchema.parse({
              name: prop.name,
              projectType: "single",
              parentProjectId: project.id,
              propertyId: childPropertyId,
              address: prop.address,
              city: prop.city,
              state: prop.state,
              zipCode: prop.zipCode,
              orgId: req.user.orgId,
              createdBy: req.user.id,
            });
            const childProject = await storage.createProject(childProjectData);
            childProjects.push(childProject);
            await storage.createProjectSettings({
              projectId: childProject.id,
              useBusinessDays: false,
              holidayCalendar: "us_federal",
              notificationsJson: {},
              ndaRequired: false,
            });
            try {
              await initializeVdrForProject(childProject.id, req.user.orgId, req.user.id);
            } catch (vdrError) {
              console.error("[Portfolio] Failed to init VDR:", vdrError);
            }
          } catch (childError) {
            console.error("[Portfolio] Failed to create child:", childError);
          }
        }
      }
      res.json({ ...project, childProjects });
    } catch (error: any) {
      console.error("Error fetching SC project:", error);
      res.status(500).json({ message: "Failed to fetch SC project" });
    }
  });

  app.post('/api/sc-projects', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projectData = scProjectCreateSchema.parse(req.body);
      const project = await storage.createScProject({
        ...projectData,
        orgId,
        createdBy: userId,
      });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'sc_project',
        entityId: project.id,
        action: 'create',
        after: project,
      });
      
      // Initialize VDR Data Room with default template
      try {
        await initializeVdrForProject(project.id, req.user.orgId, req.user.id);
      } catch (vdrError) {
        console.error("[DD Project] Failed to initialize VDR:", vdrError);
      }

      // Auto-run recommendations and add matching comps if project has meaningful profile criteria
      let recommendations = null;
      let addedCount = 0;
      
      // Helper function to check if a value is meaningful
      const isMeaningfulValue = (value: any): boolean => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'object' && !Array.isArray(value)) {
          // For objects, check if any nested value is meaningful
          return Object.values(value).some(isMeaningfulValue);
        }
        // Allow all other values including 0, false, etc.
        return true;
      };
      
      // Deep normalize profile by removing all undefined/null/empty values
      const normalizedProfile = project.profile ? 
        Object.fromEntries(
          Object.entries(project.profile)
            .filter(([_, value]) => isMeaningfulValue(value))
        ) : {};
      
      const hasValidCriteria = Object.keys(normalizedProfile).length > 0;
      
      if (hasValidCriteria) {
        try {
          const projectProfile = normalizedProfile as ProjectProfile;
          const userWeightOverrides = (project.weightOverrides as any) || undefined;
          
          recommendations = await recommendationService.getRecommendations({
            orgId,
            projectProfile,
            userWeightOverrides,
            limit: 50,
          });

          // Auto-add top 30 matching comps to the project
          if (recommendations && recommendations.items && recommendations.items.length > 0) {
            const topComps = recommendations.items.slice(0, 30);
            for (const rec of topComps) {
              try {
                await storage.addCompToScProject(
                  project.id,
                  rec.id,
                  orgId,
                  userId
                );
                addedCount++;
              } catch (addError: any) {
                // Skip duplicates or errors, continue adding others
                if (!addError.message?.includes('duplicate key')) {
                  console.error("Error auto-adding comp:", addError);
                }
              }
            }
          }
        } catch (recError) {
          console.error("Error generating recommendations for new SC project:", recError);
          // Don't fail project creation if recommendations fail
        }
      } else {
      }

      res.status(201).json({ project, recommendations, addedCount });
    } catch (error: any) {
      console.error("Error creating SC project:", error);
      res.status(500).json({ message: "Failed to create SC project" });
    }
  });

  app.put('/api/sc-projects/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const currentProject = await storage.getScProject(req.params.id, orgId);
      if (!currentProject) return res.status(404).json({ message: "Project not found" });

      const updates = scProjectUpdateSchema.parse(req.body);
      const updatedProject = await storage.updateScProject(req.params.id, {
        ...updates,
        updatedBy: userId,
      }, orgId);

      if (!updatedProject) return res.status(404).json({ message: "Project not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'sc_project',
        entityId: updatedProject.id,
        action: 'update',
        before: currentProject,
        after: updatedProject,
      });

      res.json(updatedProject);
    } catch (error: any) {
      console.error("Error updating SC project:", error);
      res.status(500).json({ message: "Failed to update SC project" });
    }
  });

  app.delete('/api/sc-projects/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const currentProject = await storage.getScProject(req.params.id, orgId);
      if (!currentProject) return res.status(404).json({ message: "Project not found" });

      const success = await storage.deleteScProject(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Project not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'sc_project',
        entityId: req.params.id,
        action: 'delete',
        before: currentProject,
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting SC project:", error);
      res.status(500).json({ message: "Failed to delete SC project" });
    }
  });

  // SC Project Comps routes
  app.get('/api/sc-projects/:id/comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const projectComps = await storage.getScProjectComps(req.params.id, orgId);
      res.json(projectComps);
    } catch (error: any) {
      console.error("Error fetching SC project comps:", error);
      res.status(500).json({ message: "Failed to fetch SC project comps" });
    }
  });

  app.post('/api/sc-projects/:id/comps', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const compData = projectCompCreateSchema.parse(req.body);
      
      try {
        const projectComp = await storage.addCompToScProject(
          req.params.id,
          compData.salesCompId,
          orgId,
          userId
        );

        await storage.createAuditLog({
          orgId,
          userId,
          entityType: 'sc_project_comp',
          entityId: projectComp.id,
          action: 'create',
          after: projectComp,
        });

        res.status(201).json(projectComp);
      } catch (error: any) {
        if (error.message.includes('duplicate key value') || error.code === '23505') {
          return res.status(409).json({ message: "Sales comp is already added to this project" });
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Error adding comp to SC project:", error);
      res.status(500).json({ message: "Failed to add comp to SC project" });
    }
  });

  app.post('/api/sc-projects/:id/comps/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const bulkData = projectCompBulkSchema.parse(req.body);
      const results: { success: any[]; failed: any[] } = { success: [], failed: [] };

      for (const salesCompId of bulkData.salesCompIds) {
        try {
          const projectComp = await storage.addCompToScProject(
            req.params.id,
            salesCompId,
            orgId,
            userId
          );

          await storage.createAuditLog({
            orgId,
            userId,
            entityType: 'sc_project_comp',
            entityId: projectComp.id,
            action: 'create',
            after: projectComp,
          });

          results.success.push({ salesCompId, projectComp });
        } catch (error: any) {
          results.failed.push({ 
            salesCompId, 
            error: error.message.includes('duplicate key') ? 'Already in project' : 'Failed to add' 
          });
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error bulk adding comps to SC project:", error);
      res.status(500).json({ message: "Failed to bulk add comps to SC project" });
    }
  });

  app.delete('/api/sc-projects/:id/comps/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { compIds } = req.body;
      if (!Array.isArray(compIds) || compIds.length === 0) {
        return res.status(400).json({ message: "Invalid or empty comp IDs array" });
      }

      let removedCount = 0;
      for (const compId of compIds) {
        try {
          const success = await storage.removeCompFromScProject(
            req.params.id,
            compId,
            orgId
          );
          
          if (success) {
            removedCount++;
            await storage.createAuditLog({
              orgId,
              userId,
              entityType: 'sc_project_comp',
              entityId: compId,
              action: 'delete',
              before: { projectId: req.params.id, salesCompId: compId },
            });
          }
        } catch (error: any) {
          console.error(`Error removing comp ${compId} from SC project:`, error);
        }
      }

      res.json({ removed: removedCount });
    } catch (error: any) {
      console.error("Error bulk removing comps from SC project:", error);
      res.status(500).json({ message: "Failed to bulk remove comps from SC project" });
    }
  });

  app.delete('/api/sc-projects/:id/comps/:compId', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const success = await storage.removeCompFromScProject(
        req.params.id,
        req.params.compId,
        orgId
      );
      
      if (!success) return res.status(404).json({ message: "Comp not found in project" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'sc_project_comp',
        entityId: req.params.compId,
        action: 'delete',
        before: { projectId: req.params.id, salesCompId: req.params.compId },
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error removing comp from SC project:", error);
      res.status(500).json({ message: "Failed to remove comp from SC project" });
    }
  });

  app.patch('/api/sc-projects/:id/comps/:compId', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getScProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const updates = projectCompUpdateSchema.parse(req.body);
      const updatedProjectComp = await storage.updateScProjectComp(
        req.params.compId,
        updates,
        orgId
      );

      if (!updatedProjectComp) return res.status(404).json({ message: "Project comp not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'sc_project_comp',
        entityId: req.params.compId,
        action: 'update',
        after: updatedProjectComp,
      });

      res.json(updatedProjectComp);
    } catch (error: any) {
      console.error("Error updating SC project comp:", error);
      res.status(500).json({ message: "Failed to update SC project comp" });
    }
  });

  // Recommendations routes
  app.get('/api/profit-centers', async (req: any, res) => {
    try {
      res.json(PROFIT_CENTERS);
    } catch (error: any) {
      console.error("Error fetching profit centers:", error);
      res.status(500).json({ message: "Failed to fetch profit centers" });
    }
  });

  app.get('/api/sc-projects/:id/recommendations', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getScProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const limit = parseInt(req.query.limit as string) || 50;
      const excludeAssigned = req.query.excludeAssigned === 'true';

      let excludeCompIds: string[] = [];
      if (excludeAssigned) {
        const projectComps = await storage.getScProjectComps(projectId, orgId);
        excludeCompIds = projectComps.map(pc => pc.salesCompId);
      }

      const projectProfile = (project.profile as any) || {};
      const userWeightOverrides = (project.weightOverrides as any) || undefined;

      const recommendations = await recommendationService.getRecommendations({
        orgId,
        projectProfile,
        userWeightOverrides,
        excludeCompIds,
        limit,
      });

      res.json({
        items: recommendations,
        total: recommendations.length,
        projectProfile,
        weights: userWeightOverrides,
      });
    } catch (error: any) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  app.post('/api/sc-projects/:id/auto-populate', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const projectId = req.params.id;
      
      const project = await storage.getScProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // Get configuration from request body
      const limit = req.body.limit || 30;
      const minScore = req.body.minScore || 0.3; // Only add comps with score >= 0.3
      const useAI = req.body.useAI !== false; // Default to true, allow disabling
      
      // Get existing comps to exclude
      const projectComps = await storage.getScProjectComps(projectId, orgId);
      const excludeCompIds = projectComps.map(pc => pc.salesCompId);

      // Get recommendations from rule-based system
      const projectProfile = (project.profile as any) || {};
      const userWeightOverrides = (project.weightOverrides as any) || undefined;
      
      // Get larger candidate pool for AI to evaluate
      const candidateLimit = useAI && aiCompMatchingService.isEnabled() ? 100 : limit * 2;
      const recommendations = await recommendationService.getRecommendations({
        orgId,
        projectProfile,
        userWeightOverrides,
        excludeCompIds,
        limit: candidateLimit,
      });

      let topRecommendations = recommendations;
      let aiUsed = false;

      // Enhance with AI scoring if enabled
      if (useAI && aiCompMatchingService.isEnabled() && recommendations.length > 0) {
        try {
          // Take top 30 rule-based candidates for AI evaluation
          const aiCandidates = recommendations.slice(0, 30);
          
          const aiScores = await aiCompMatchingService.scoreComps(
            projectProfile,
            aiCandidates.map(r => r.comp),
            aiCandidates.map(r => ({ compId: r.comp.id, ruleBasedScore: r.score }))
          );

          if (aiScores && aiScores.scores.length > 0) {
            // Combine AI and rule-based scores
            const combinedRecs = aiCandidates.map(rec => {
              const aiScore = aiScores.scores.find(s => s.compId === rec.comp.id);
              if (aiScore) {
                // 60% AI, 40% rule-based
                const combinedScore = aiCompMatchingService.combineScores(rec.score, aiScore.aiScore, 0.6);
                return {
                  ...rec,
                  score: combinedScore,
                  aiScore: aiScore.aiScore,
                  aiRationale: aiScore.rationale,
                  aiKeyFactors: aiScore.keyFactors,
                  aiConfidence: aiScore.confidence,
                  ruleBasedScore: rec.score
                };
              }
              return rec;
            });

            // Re-sort by combined score
            combinedRecs.sort((a, b) => b.score - a.score);
            
            // Merge AI-enhanced top 30 with remaining rule-based candidates
            const remainingCandidates = recommendations.slice(30);
            topRecommendations = [...combinedRecs, ...remainingCandidates];
            topRecommendations.sort((a, b) => b.score - a.score);
            
            aiUsed = true;
          } else {
          }
        } catch (aiError) {
          console.error('AI scoring failed, falling back to rule-based only:', aiError);
          // Continue with rule-based scores
        }
      }

      // Filter by minimum score and take top N
      topRecommendations = topRecommendations
        .filter(rec => rec.score >= minScore)
        .slice(0, limit);

      // Auto-add to project
      let addedCount = 0;
      let skippedCount = 0;
      const addedComps = [];

      for (const rec of topRecommendations) {
        try {
          const projectComp = await storage.addCompToScProject(
            projectId,
            rec.comp.id,
            orgId,
            userId
          );
          addedComps.push({
            ...projectComp,
            score: rec.score,
            reasons: rec.reasons,
            ...(rec.aiScore !== undefined && {
              aiScore: rec.aiScore,
              aiRationale: rec.aiRationale,
              aiKeyFactors: rec.aiKeyFactors,
              aiConfidence: rec.aiConfidence,
              ruleBasedScore: rec.ruleBasedScore
            })
          });
          addedCount++;
        } catch (addError: any) {
          // Skip duplicates or errors
          if (addError.message?.includes('duplicate key')) {
            skippedCount++;
          } else {
            console.error("Error auto-adding comp:", addError);
          }
        }
      }

      res.json({
        success: true,
        addedCount,
        skippedCount,
        totalRecommendations: recommendations.length,
        addedComps,
        message: `Successfully added ${addedCount} comp${addedCount !== 1 ? 's' : ''} to project${skippedCount > 0 ? ` (${skippedCount} already in project)` : ''}`
      });
    } catch (error: any) {
      console.error("Error auto-populating SC project:", error);
      res.status(500).json({ message: "Failed to auto-populate project" });
    }
  });

  app.get('/api/sc-projects/:id/preferences', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getScProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      res.json({
        profile: project.profile || {},
        weightOverrides: project.weightOverrides || {},
      });
    } catch (error: any) {
      console.error("Error fetching SC project preferences:", error);
      res.status(500).json({ message: "Failed to fetch SC project preferences" });
    }
  });

  app.put('/api/sc-projects/:id/preferences', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getScProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { profile, weightOverrides } = req.body;

      let validatedProfile, validatedWeights;
      
      try {
        validatedProfile = profile ? scProjectProfileSchema.parse(profile) : project.profile;
        validatedWeights = weightOverrides ? scWeightOverridesSchema.parse(weightOverrides) : project.weightOverrides;
      } catch (validationError: any) {
        console.error("Validation error in SC project preferences:", validationError);
        return res.status(400).json({ 
          message: "Invalid SC project preferences data", 
          details: validationError?.errors || validationError?.message 
        });
      }

      const updatedProject = await storage.updateScProject(projectId, {
        profile: validatedProfile,
        weightOverrides: validatedWeights,
        updatedBy: userId,
      }, orgId);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json({
        profile: updatedProject.profile,
        weightOverrides: updatedProject.weightOverrides,
      });
    } catch (error: any) {
      console.error("Error updating SC project preferences:", error);
      res.status(500).json({ message: "Failed to update SC project preferences" });
    }
  });

  app.post('/api/recommendations/feedback', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const feedbackData = insertScRecommendationFeedbackSchema.parse({
        ...req.body,
        orgId,
        userId,
      });

      const feedback = await storage.createRecommendationFeedback(feedbackData);

      if (['selected', 'rejected', 'liked'].includes(feedbackData.action)) {
        const project = await storage.getScProject(feedbackData.projectId, orgId);
        const comp = await storage.getComp(feedbackData.salesCompId, orgId);
        
        if (project && comp) {
          const projectProfile = (project.profile as any) || {};
          
          let scoreBreakdown = req.body.breakdown;
          let currentScore = parseFloat(req.body.scoreAtTime) || 0;
          
          if (!scoreBreakdown) {
            const recommendations = await recommendationService.getRecommendations({
              orgId,
              projectProfile,
              userWeightOverrides: (project.weightOverrides as any) || undefined,
              excludeCompIds: [],
              limit: 1000,
            });

            const matchingRec = recommendations.find(r => r.comp.id === comp.id);
            if (matchingRec) {
              scoreBreakdown = matchingRec.breakdown;
              currentScore = matchingRec.score;
            }
          }
          
          if (scoreBreakdown) {
            await recommendationService.updateLearningWeights({
              orgId,
              projectProfile,
              selectedComp: comp,
              action: feedbackData.action as 'selected' | 'rejected' | 'liked',
              currentScore,
              breakdown: scoreBreakdown,
            });
          }
        }
      }

      res.json(feedback);
    } catch (error: any) {
      console.error("Error submitting recommendation feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // ============ RATE COMPS API ROUTES ============

  // Rate Comps CRUD routes
  app.get('/api/rate-comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const includeGlobal = req.query.includeGlobal === 'true';
      const scopeFilter = req.query.scope as string | undefined; // 'all' | 'org' | 'global'

      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const filters = compFiltersSchema.parse(req.query);
      const sqlFilters = rcFilterBuilder.buildFilters(filters);
      
      // Fetch org-specific comps (unless filtering to global only)
      let comps: any[] = [];
      let total = 0;
      
      if (scopeFilter !== 'global') {
        const orgResult = await storage.getRateComps({
          orgId,
          filters: sqlFilters,
          sortBy: filters.sortBy,
          sortDir: filters.sortDir,
          page: filters.page,
          pageSize: filters.pageSize,
        });
        comps = orgResult.comps.map((c: any) => ({ ...c, _source: 'org' }));
        total = orgResult.total;
      }
      
      // Include global curated comps if requested (users with Analysis pack)
      if (includeGlobal || scopeFilter === 'all' || scopeFilter === 'global') {
        try {
          const globalComps = await db
            .select()
            .from(rateComps)
            .where(eq(rateComps.scope, "global"))
            .limit(filters.pageSize || 50);
          
          // Add source tag and merge
          const taggedGlobal = globalComps.map((c: any) => ({ ...c, _source: 'global' }));
          
          if (scopeFilter === 'global') {
            comps = taggedGlobal;
            total = taggedGlobal.length;
          } else {
            comps = [...comps, ...taggedGlobal];
            total += taggedGlobal.length;
          }
        } catch (globalErr) {
          console.warn("Could not fetch global rate comps:", globalErr);
        }
      }

      res.json({ comps, total, page: filters.page, pageSize: filters.pageSize });
    } catch (error: any) {
      console.error("Error fetching rate comps:", error);
      res.status(500).json({ message: "Failed to fetch rate comps" });
    }
  });

  // Industry Standards - Public API (pack-gated access)
  // Industry Standards - Public API (pack-gated access)
  app.get('/api/industry-standards', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const { category, region, year } = req.query;
      const userPacks = req.user?.packs || [];
      
      const conditions = [eq(industryStandards.scope, "global")];
      
      if (category) {
        conditions.push(eq(industryStandards.category, category as string));
      }
      if (region) {
        conditions.push(eq(industryStandards.region, region as string));
      }
      if (year) {
        conditions.push(eq(industryStandards.effectiveYear, parseInt(year as string)));
      }

      const allStandards = await db
        .select()
        .from(industryStandards)
        .where(and(...conditions))
        .orderBy(desc(industryStandards.effectiveYear), industryStandards.category)
        .limit(200);

      // Filter by pack access - only return standards where user has the required pack
      const accessibleStandards = allStandards.filter(std => {
        if (!std.requiredPack) return true; // No pack required
        return userPacks.includes(std.requiredPack) || req.user?.role === 'owner';
      });

      res.json(accessibleStandards);
    } catch (error) {
      console.error("Error fetching industry standards:", error);
      res.status(500).json({ error: "Failed to fetch industry standards" });
    }
  });
  app.get('/api/rate-comps/ids', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const ids = await storage.getAllRateCompIds(orgId);
      res.json({ ids });
    } catch (error: any) {
      console.error('Error getting rate comp IDs:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/rate-comps/column-values/:column', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { column } = req.params;
      const values = await storage.getRateCompColumnUniqueValues(orgId, column);
      res.json({ values });
    } catch (error: any) {
      console.error('Error getting column values:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Cross-reference API - Pull enriched filter options from Sales Comps and CRM Properties
  app.get('/api/rate-comps/cross-reference/filters', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Get unique values from Sales Comps for cross-referencing
      const salesCompsStates = await storage.getColumnUniqueValues(orgId, 'state');
      const salesCompsWaterTypes = await storage.getColumnUniqueValues(orgId, 'waterType');
      const salesCompsRegions = await storage.getColumnUniqueValues(orgId, 'region');
      const salesCompsBodiesOfWater = await storage.getColumnUniqueValues(orgId, 'bodyOfWater');
      
      // Get unique values from CRM Properties for enrichment
      const crmProperties = await storage.getCrmPropertiesForOrg(orgId);
      const crmStates = [...new Set(crmProperties.filter(p => p.state).map(p => p.state))];
      const crmCities = [...new Set(crmProperties.filter(p => p.city).map(p => p.city))];
      
      // Merge and deduplicate filter options
      const crossRefFilters = {
        // Merged state options from all sources
        states: {
          salesComps: salesCompsStates,
          crmProperties: crmStates,
          merged: [...new Set([...salesCompsStates, ...crmStates])].sort()
        },
        // Water types from Sales Comps
        waterTypes: {
          salesComps: salesCompsWaterTypes,
          merged: salesCompsWaterTypes
        },
        // Regions from Sales Comps
        regions: {
          salesComps: salesCompsRegions,
          merged: salesCompsRegions
        },
        // Bodies of water from Sales Comps
        bodiesOfWater: {
          salesComps: salesCompsBodiesOfWater,
          merged: salesCompsBodiesOfWater
        },
        // Cities from CRM Properties
        cities: {
          crmProperties: crmCities,
          merged: crmCities
        },
        // Data source metadata
        sources: {
          salesCompsCount: salesCompsStates.length > 0 ? 'available' : 'empty',
          crmPropertiesCount: crmProperties.length
        }
      };
      
      res.json(crossRefFilters);
    } catch (error: any) {
      console.error('Error getting cross-reference filters:', error);
      res.status(500).json({ message: "Failed to fetch cross-reference filters" });
    }
  });

  // Cross-reference API - Get Marina Database lookup
  app.get('/api/rate-comps/cross-reference/marinas', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { q, limit } = req.query;
      
      if (!q || q.trim().length < 2) {
        return res.json([]);
      }
      
      const marinas = await storage.searchMarinas(orgId, q.trim(), limit ? parseInt(limit) : 20);
      res.json(marinas);
    } catch (error: any) {
      console.error('Error searching marinas for cross-reference:', error);
      res.status(500).json({ message: "Failed to search marinas" });
    }
  });

  // Custom Storage Types routes (must be before /:id route)
  app.get('/api/rate-comps/custom-storage-types', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const types = await storage.getRcCustomStorageTypes(orgId);
      res.json(types);
    } catch (error: any) {
      console.error("Error fetching custom storage types:", error);
      res.status(500).json({ message: "Failed to fetch custom storage types" });
    }
  });

  app.post('/api/rate-comps/custom-storage-types', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: "Storage type name is required" });
      }

      // Check for duplicates (case-insensitive)
      const existing = await storage.getRcCustomStorageTypes(orgId);
      if (existing.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
        return res.status(400).json({ message: "Storage type already exists" });
      }

      const type = await storage.createRcCustomStorageType({
        orgId,
        name: name.trim(),
        createdBy: userId,
      });

      res.status(201).json(type);
    } catch (error: any) {
      console.error("Error creating custom storage type:", error);
      res.status(500).json({ message: "Failed to create custom storage type" });
    }
  });

  app.delete('/api/rate-comps/custom-storage-types/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteRcCustomStorageType(req.params.id, orgId);

      if (!success) return res.status(404).json({ message: "Storage type not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting custom storage type:", error);
      res.status(500).json({ message: "Failed to delete custom storage type" });
    }
  });

  // Custom Column Management routes (must be before /:id route)
  app.get('/api/rate-comps/columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const columns = await storage.getRateCompColumns(orgId);
      res.json(columns);
    } catch (error: any) {
      console.error("Error fetching custom columns:", error);
      res.status(500).json({ message: "Failed to fetch custom columns" });
    }
  });

  app.post('/api/rate-comps/columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { key, label, type, options, required, visible, orderIndex } = req.body;

      if (!key || !label || !type) {
        return res.status(400).json({ message: "Field key, label, and type are required" });
      }

      // Check for duplicate key
      const existing = await storage.getRateCompColumns(orgId);
      if (existing.some(c => c.key === key)) {
        return res.status(400).json({ message: "Column with this key already exists" });
      }

      const column = await storage.createRateCompColumn({
        orgId,
        key,
        label,
        type,
        options: options || null,
        required: required || false,
        visible: visible !== false,
        orderIndex: orderIndex || 0,
      });

      res.status(201).json(column);
    } catch (error: any) {
      console.error("Error creating custom column:", error);
      res.status(500).json({ message: "Failed to create custom column" });
    }
  });

  app.delete('/api/rate-comps/columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteRateCompColumn(req.params.id, orgId);

      if (!success) return res.status(404).json({ message: "Column not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting custom column:", error);
      res.status(500).json({ message: "Failed to delete custom column" });
    }
  });

  // Pending Property Profiles routes (must be before /:id route)
  app.get('/api/rate-comps/pending-property-profiles', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const status = req.query.status as string | undefined;
      const profiles = await storage.getRcPendingPropertyProfiles(orgId, status);
      res.json(profiles);
    } catch (error: any) {
      console.error("Error fetching pending property profiles:", error);
      res.status(500).json({ message: "Failed to fetch pending property profiles" });
    }
  });

  app.post('/api/rate-comps/pending-property-profiles', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { compId, status } = req.body;

      if (!compId) {
        return res.status(400).json({ message: "compId is required" });
      }

      const profile = await storage.createRcPendingPropertyProfile({
        compId,
        orgId,
        status: status || 'pending',
      });

      res.status(201).json(profile);
    } catch (error: any) {
      console.error("Error creating pending property profile:", error);
      res.status(500).json({ message: "Failed to create pending property profile" });
    }
  });

  app.patch('/api/rate-comps/pending-property-profiles/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.body;
      
      // Verify ownership before updating
      const existing = await storage.getRcPendingPropertyProfiles(orgId);
      const profile = existing.find(p => p.id === req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Pending property profile not found" });
      }
      
      const updated = await storage.updateRcPendingPropertyProfile(req.params.id, { status });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating pending property profile:", error);
      res.status(500).json({ message: "Failed to update pending property profile" });
    }
  });

  app.delete('/api/rate-comps/pending-property-profiles/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Verify ownership before deleting
      const existing = await storage.getRcPendingPropertyProfiles(orgId);
      const profile = existing.find(p => p.id === req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Pending property profile not found" });
      }
      
      const success = await storage.deleteRcPendingPropertyProfile(req.params.id);
      if (!success) return res.status(404).json({ message: "Pending property profile not found" });
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting pending property profile:", error);
      res.status(500).json({ message: "Failed to delete pending property profile" });
    }
  });

  app.get('/api/rate-comps/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const comp = await storage.getRateComp(req.params.id, orgId);
      if (!comp) return res.status(404).json({ message: "Rate comp not found" });
      res.json(comp);
    } catch (error: any) {
      console.error("Error fetching rate comp:", error);
      res.status(500).json({ message: "Failed to fetch rate comp" });
    }
  });

  app.post('/api/rate-comps/backfill-properties', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      
      
      const result = await storage.getRateComps({ orgId, pageSize: 10000 });
      const comps = result.comps;
      const compsWithoutProperty = comps.filter(comp => !comp.propertyId && comp.marina);
      
      
      let created = 0;
      let matched = 0;
      let failed = 0;
      
      for (const comp of compsWithoutProperty) {
        try {
          let propertyId = null;
          
          const matchedProperty = await storage.findPropertyByLocation(
            orgId,
            comp.marina!,
            comp.city || undefined,
            comp.state || undefined
          );
          
          if (matchedProperty) {
            propertyId = matchedProperty.id;
            matched++;
          } else {
            const address = [
              comp.address,
              comp.city && comp.state ? `${comp.city}, ${comp.state}` : comp.city || comp.state
            ].filter(Boolean).join(', ');
            
            const newProperty = await storage.createCrmProperty({
              title: comp.marina!,
              type: 'marina',
              status: 'available',
              address: address || undefined,
              ownerId: orgId,
              listingPrice: comp.salePrice ? String(comp.salePrice) : undefined,
              description: `Auto-created from rate comp backfill`,
            });
            
            propertyId = newProperty.id;
            created++;
          }
          
          if (propertyId) {
            await storage.updateRateComp(comp.id, { propertyId }, orgId);
          }
        } catch (error: any) {
          failed++;
          console.error(`❌ Failed to process rate comp ${comp.id}:`, error);
        }
      }
      
      const summary = {
        total: compsWithoutProperty.length,
        propertiesCreated: created,
        propertiesMatched: matched,
        failed,
      };
      
      
      res.json(summary);
    } catch (error: any) {
      console.error("Error during property backfill:", error);
      res.status(500).json({ message: "Failed to backfill properties" });
    }
  });

  app.post('/api/rate-comps', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const compData = insertRateCompSchema.parse(req.body);

      const comp = await rcCompService.createComp({
        ...compData,
        orgId,
        createdBy: userId,
      }, userId);

      // Auto-create pending property profile if propertyId is not provided
      if (!compData.propertyId) {
        try {
          await storage.createRcPendingPropertyProfile({
            compId: comp.id,
            orgId,
            status: 'pending',
          });
        } catch (pendingError) {
          console.error('Error auto-creating pending property profile for rate comp:', pendingError);
        }
      }

      res.status(201).json(comp);
    } catch (error: any) {
      console.error("Error creating rate comp:", error);
      res.status(500).json({ message: "Failed to create rate comp" });
    }
  });

  app.patch('/api/rate-comps/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const updates = salesCompUpdateSchema.parse(req.body);

      const comp = await rcCompService.updateComp(
        req.params.id,
        { ...updates, updatedBy: userId },
        orgId,
        userId
      );

      if (!comp) return res.status(404).json({ message: "Rate comp not found" });
      
      // Bidirectional sync: Update CRM property if propertyId is linked
      // Only sync fields that were explicitly updated in the request
      const propertyId = (comp as any).propertyId;
      if (propertyId && Object.keys(updates).length > 0) {
        try {
          const existingProperty = await storage.getCrmProperty(propertyId);
          if (existingProperty && existingProperty.orgId === orgId) {
            const currentSpecs = (existingProperty.specifications as any) || {};
            
            // Only sync fields that were actually in the update request
            const syncableFields = ['wetSlips', 'dryRacks', 'acres', 'occupancy', 'yearBuilt', 
              'waterType', 'bodyOfWater', 'waterBodyName', 'region', 'storageTypes',
              'profitCenterStorage', 'profitCenterEvents', 'profitCenterService', 
              'profitCenterThirdPartyLeases', 'profitCenterBoatRentals', 'profitCenterBoatBrokerage',
              'profitCenterRvPark', 'profitCenterFuel', 'profitCenterShipStore', 'profitCenterParts',
              'profitCenterBoatClub', 'profitCenterBoatSales', 'profitCenterFnb', 'profitCenterHospitality'];
            
            const updatedSpecs = { ...currentSpecs };
            let hasChanges = false;
            
            for (const field of syncableFields) {
              if (field in updates && updates[field] !== undefined) {
                updatedSpecs[field] = updates[field];
                hasChanges = true;
              }
            }
            
            if (hasChanges) {
              updatedSpecs.lastSyncedFromRateComp = new Date().toISOString();
              
              const propertyUpdates: any = { specifications: updatedSpecs };
              if ('address' in updates && updates.address !== undefined) {
                propertyUpdates.address = updates.address;
              }
              
              await storage.updateCrmProperty(propertyId, propertyUpdates);
            }
          }
        } catch (syncError) {
          console.error('Error syncing rate comp to CRM property:', syncError);
          // Don't fail the request if sync fails - the rate comp update succeeded
        }
      }
      
      res.json(comp);
    } catch (error: any) {
      console.error("Error updating rate comp:", error);
      res.status(500).json({ message: "Failed to update rate comp" });
    }
  });

  app.delete('/api/rate-comps/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const success = await rcCompService.deleteComp(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Rate comp not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting rate comp:", error);
      res.status(500).json({ message: "Failed to delete rate comp" });
    }
  });

  app.post('/api/rate-comps/bulk-update', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { ids, updates } = bulkUpdateSchema.parse(req.body);
      const count = await rcCompService.bulkUpdateComps(ids, updates, orgId, userId);

      res.json({ updated: count });
    } catch (error: any) {
      console.error("Error bulk updating rate comps:", error);
      res.status(500).json({ message: "Failed to bulk update rate comps" });
    }
  });

  app.post('/api/rate-comps/bulk-delete', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }

      const count = await rcCompService.bulkDeleteComps(ids, orgId, userId);
      res.json({ deleted: count });
    } catch (error: any) {
      console.error("Error bulk deleting rate comps:", error);
      res.status(500).json({ message: "Failed to bulk delete rate comps" });
    }
  });

  // Geocoding endpoint
  app.post('/api/rate-comps/:id/geocode', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const comp = await storage.getRateCompById(id, orgId);
      if (!comp) {
        return res.status(404).json({ message: "Rate comp not found" });
      }

      const addressString = geocodingService.buildAddressString({
        marina: comp.marina,
        address: comp.address || undefined,
        city: comp.city || undefined,
        state: comp.state || undefined,
        zip: comp.zip || undefined,
      });

      if (!addressString) {
        return res.status(400).json({ message: "No address information available to geocode" });
      }

      const result = await geocodingService.geocodeAddress(addressString);

      if ('error' in result) {
        return res.status(400).json(result);
      }

      await rcCompService.updateComp(
        id,
        { 
          lat: result.lat.toString(),
          lng: result.lng.toString(),
          updatedBy: userId 
        },
        orgId,
        userId
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error geocoding rate comp:", error);
      res.status(500).json({ message: "Failed to geocode rate comp" });
    }
  });

  // Upload and Import routes
  app.post('/api/rate-comps/upload', uploadRateComps.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const analysis = await rcParserService.analyzeFile(req.file);
      const fullData = await rcParserService.parseFullFile(req.file);
      
      
      const importRecord = await storage.createRateCompImport({
        orgId,
        createdBy: userId,
        filename: req.file.originalname,
        status: 'mapping',
        parsedData: fullData,
        summary: {
          totalRows: fullData.length,
          successCount: 0,
          errorCount: 0,
          warningCount: 0,
          errors: []
        }
      });

      res.json({
        importId: importRecord.id,
        analysis,
      });
    } catch (error: any) {
      console.error("Error uploading rate comp file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.post('/api/rate-comps/import/:importId/detect-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { mapping, normalization } = req.body;
      
      const result = await rcCompService.detectDuplicates(
        req.params.importId,
        orgId,
        mapping,
        normalization
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error detecting duplicates:", error);
      res.status(500).json({ message: "Failed to detect duplicates" });
    }
  });

  app.post('/api/rate-comps/import/:importId/commit', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { mapping, normalization, excludedRows = [], parentPortfolioId } = req.body;
      
      
      const result = await rcCompService.processImport(
        req.params.importId,
        orgId,
        userId,
        mapping,
        normalization,
        excludedRows,
        parentPortfolioId
      );
      

      res.json(result);
    } catch (error: any) {
      console.error("Error processing rate comp import:", error);
      res.status(500).json({ message: "Failed to process import" });
    }
  });

  app.get('/api/rate-comps/import/:importId/status', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const importRecord = await storage.getRateCompImport(req.params.importId, orgId);
      if (!importRecord) return res.status(404).json({ message: "Import not found" });

      res.json(importRecord);
    } catch (error: any) {
      console.error("Error fetching import status:", error);
      res.status(500).json({ message: "Failed to fetch import status" });
    }
  });

  // Rate Comp Columns management routes
  app.get('/api/rc-columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const columns = await storage.getRateCompColumns(orgId);
      res.json(columns);
    } catch (error: any) {
      console.error("Error fetching rate comp columns:", error);
      res.status(500).json({ message: "Failed to fetch columns" });
    }
  });

  app.post('/api/rc-columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const columnData = compColumnCreateSchema.parse(req.body);
      const column = await storage.createRateCompColumn({
        ...columnData,
        orgId,
      });

      res.status(201).json(column);
    } catch (error: any) {
      console.error("Error creating rate comp column:", error);
      res.status(500).json({ message: "Failed to create column" });
    }
  });

  app.patch('/api/rc-columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const updates = compColumnUpdateSchema.parse(req.body);
      const column = await storage.updateRateCompColumn(req.params.id, updates, orgId);

      if (!column) return res.status(404).json({ message: "Column not found" });
      res.json(column);
    } catch (error: any) {
      console.error("Error updating rate comp column:", error);
      res.status(500).json({ message: "Failed to update column" });
    }
  });

  app.delete('/api/rc-columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const success = await storage.deleteRateCompColumn(req.params.id, orgId);
      if (!success) return res.status(404).json({ message: "Column not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting rate comp column:", error);
      res.status(500).json({ message: "Failed to delete column" });
    }
  });

  // Rate Tiers routes (flexible pricing tiers)
  app.get('/api/rate-comps/:rateCompId/tiers', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { rateCompId } = req.params;

      const tiers = await storage.getRateTiersByRateComp(rateCompId, orgId);
      res.json(tiers);
    } catch (error: any) {
      console.error("Error fetching rate tiers:", error);
      res.status(500).json({ message: "Failed to fetch rate tiers" });
    }
  });

  app.get('/api/rate-tiers', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { storageType, isCurrentRate, loaMin, loaMax } = req.query;

      const filters: any = {};
      if (storageType) filters.storageType = storageType;
      if (isCurrentRate !== undefined) filters.isCurrentRate = isCurrentRate === 'true';
      if (loaMin || loaMax) {
        filters.loaRange = {};
        if (loaMin) filters.loaRange.min = parseFloat(loaMin);
        if (loaMax) filters.loaRange.max = parseFloat(loaMax);
      }

      const tiers = await storage.getRateTiersByOrg(orgId, Object.keys(filters).length > 0 ? filters : undefined);
      res.json(tiers);
    } catch (error: any) {
      console.error("Error fetching rate tiers:", error);
      res.status(500).json({ message: "Failed to fetch rate tiers" });
    }
  });

  app.get('/api/rate-tiers/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const tier = await storage.getRateTier(req.params.id, orgId);
      if (!tier) return res.status(404).json({ message: "Rate tier not found" });
      res.json(tier);
    } catch (error: any) {
      console.error("Error fetching rate tier:", error);
      res.status(500).json({ message: "Failed to fetch rate tier" });
    }
  });

  app.post('/api/rate-comps/:rateCompId/tiers', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { rateCompId } = req.params;

      const comp = await storage.getRateComp(rateCompId, orgId);
      if (!comp) return res.status(404).json({ message: "Rate comp not found" });

      const tierData = req.body;
      const tier = await storage.createRateTier({
        ...tierData,
        rateCompId,
        orgId,
        createdBy: userId,
      });

      await storage.createRcAuditLog({
        orgId,
        userId,
        entity: 'rate_tier',
        entityId: tier.id,
        action: 'create',
        after: tier,
      });

      res.status(201).json(tier);
    } catch (error: any) {
      console.error("Error creating rate tier:", error);
      res.status(500).json({ message: "Failed to create rate tier" });
    }
  });

  app.post('/api/rate-comps/:rateCompId/tiers/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { rateCompId } = req.params;

      const comp = await storage.getRateComp(rateCompId, orgId);
      if (!comp) return res.status(404).json({ message: "Rate comp not found" });

      const tiersData = req.body.tiers;
      if (!Array.isArray(tiersData) || tiersData.length === 0) {
        return res.status(400).json({ message: "Invalid or empty tiers array" });
      }

      const tiersToCreate = tiersData.map(tier => ({
        ...tier,
        rateCompId,
        orgId,
        createdBy: userId,
      }));

      const createdTiers = await storage.bulkCreateRateTiers(tiersToCreate);

      await storage.createRcAuditLog({
        orgId,
        userId,
        entity: 'rate_tier',
        entityId: rateCompId,
        action: 'bulk_create',
        after: { count: createdTiers.length },
      });

      res.status(201).json(createdTiers);
    } catch (error: any) {
      console.error("Error bulk creating rate tiers:", error);
      res.status(500).json({ message: "Failed to create rate tiers" });
    }
  });

  app.patch('/api/rate-tiers/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const tier = await storage.getRateTier(req.params.id, orgId);
      if (!tier) return res.status(404).json({ message: "Rate tier not found" });

      const updates = { ...req.body, updatedBy: userId };
      const updatedTier = await storage.updateRateTier(req.params.id, updates, orgId);

      await storage.createRcAuditLog({
        orgId,
        userId,
        entity: 'rate_tier',
        entityId: req.params.id,
        action: 'update',
        before: tier,
        after: updatedTier,
      });

      res.json(updatedTier);
    } catch (error: any) {
      console.error("Error updating rate tier:", error);
      res.status(500).json({ message: "Failed to update rate tier" });
    }
  });

  app.delete('/api/rate-tiers/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const tier = await storage.getRateTier(req.params.id, orgId);
      if (!tier) return res.status(404).json({ message: "Rate tier not found" });

      await storage.deleteRateTier(req.params.id, orgId);

      await storage.createRcAuditLog({
        orgId,
        userId,
        entity: 'rate_tier',
        entityId: req.params.id,
        action: 'delete',
        before: tier,
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting rate tier:", error);
      res.status(500).json({ message: "Failed to delete rate tier" });
    }
  });

  app.get('/api/rate-comps/:id/with-tiers', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const compWithTiers = await storage.getRateCompWithTiers(req.params.id, orgId);
      if (!compWithTiers) return res.status(404).json({ message: "Rate comp not found" });
      res.json(compWithTiers);
    } catch (error: any) {
      console.error("Error fetching rate comp with tiers:", error);
      res.status(500).json({ message: "Failed to fetch rate comp with tiers" });
    }
  });

  app.post('/api/rate-comps/with-tiers', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = req.body.filters || {};
      const compsWithTiers = await storage.getRateCompsWithTiers(orgId, filters);
      res.json(compsWithTiers);
    } catch (error: any) {
      console.error("Error fetching rate comps with tiers:", error);
      res.status(500).json({ message: "Failed to fetch rate comps with tiers" });
    }
  });

  // ============================================================================
  // MARINA RATE DATABASE ROUTES
  // ============================================================================

  // List marinas with filtering, sorting, and pagination
  app.get('/api/marina-database', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { q, states, regions, waterTypes, isActive, sortBy, sortDir, page, pageSize } = req.query;

      const filters: Record<string, any> = {};
      if (q) filters.q = q;
      if (states) filters.states = Array.isArray(states) ? states : states.split(',');
      if (regions) filters.regions = Array.isArray(regions) ? regions : regions.split(',');
      if (waterTypes) filters.waterTypes = Array.isArray(waterTypes) ? waterTypes : waterTypes.split(',');
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const result = await storage.getMarinas({
        orgId,
        filters,
        sortBy: sortBy || 'marinaName',
        sortDir: sortDir || 'asc',
        page: page ? parseInt(page) : 1,
        pageSize: pageSize ? parseInt(pageSize) : 25
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching marinas:", error);
      res.status(500).json({ message: "Failed to fetch marinas" });
    }
  });

  // Search marinas for autocomplete
  app.get('/api/marina-database/search', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { q, limit } = req.query;

      if (!q || q.trim().length < 2) {
        return res.json([]);
      }

      const marinas = await storage.searchMarinas(orgId, q.trim(), limit ? parseInt(limit) : 20);
      res.json(marinas);
    } catch (error: any) {
      console.error("Error searching marinas:", error);
      res.status(500).json({ message: "Failed to search marinas" });
    }
  });

  // Get single marina
  app.get('/api/marina-database/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const marina = await storage.getMarina(req.params.id, orgId);
      if (!marina) return res.status(404).json({ message: "Marina not found" });
      res.json(marina);
    } catch (error: any) {
      console.error("Error fetching marina:", error);
      res.status(500).json({ message: "Failed to fetch marina" });
    }
  });

  // Get marina with all rates (current and historical)
  app.get('/api/marina-database/:id/with-rates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const marinaWithRates = await storage.getMarinaWithRates(req.params.id, orgId);
      if (!marinaWithRates) return res.status(404).json({ message: "Marina not found" });
      res.json(marinaWithRates);
    } catch (error: any) {
      console.error("Error fetching marina with rates:", error);
      res.status(500).json({ message: "Failed to fetch marina with rates" });
    }
  });

  // Create marina
  app.post('/api/marina-database', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const marina = await storage.createMarina({
        ...req.body,
        orgId,
        createdBy: userId
      });

      res.status(201).json(marina);
    } catch (error: any) {
      console.error("Error creating marina:", error);
      res.status(500).json({ message: "Failed to create marina" });
    }
  });

  // Update marina
  app.patch('/api/marina-database/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const existing = await storage.getMarina(req.params.id, orgId);
      if (!existing) return res.status(404).json({ message: "Marina not found" });

      const marina = await storage.updateMarina(req.params.id, { ...req.body, updatedBy: userId }, orgId);
      res.json(marina);
    } catch (error: any) {
      console.error("Error updating marina:", error);
      res.status(500).json({ message: "Failed to update marina" });
    }
  });

  // Delete marina (soft delete)
  app.delete('/api/marina-database/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const existing = await storage.getMarina(req.params.id, orgId);
      if (!existing) return res.status(404).json({ message: "Marina not found" });

      await storage.deleteMarina(req.params.id, orgId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting marina:", error);
      res.status(500).json({ message: "Failed to delete marina" });
    }
  });

  // ============================================================================
  // MARINA RATES ROUTES (Historical Rate Tracking)
  // ============================================================================

  // Get rates for a marina with optional filters
  app.get('/api/marina-database/:marinaId/rates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { marinaId } = req.params;
      const { rateYear, storageType, isCurrentRate } = req.query;

      const filters: any = {};
      if (rateYear) filters.rateYear = parseInt(rateYear);
      if (storageType) filters.storageType = storageType;
      if (isCurrentRate !== undefined) filters.isCurrentRate = isCurrentRate === 'true';

      const rates = await storage.getMarinaRates(marinaId, orgId, Object.keys(filters).length > 0 ? filters : undefined);
      res.json(rates);
    } catch (error: any) {
      console.error("Error fetching marina rates:", error);
      res.status(500).json({ message: "Failed to fetch marina rates" });
    }
  });

  // Get rate history for a marina (all rates over time)
  app.get('/api/marina-database/:marinaId/rate-history', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { marinaId } = req.params;
      const { storageType } = req.query;

      const history = await storage.getMarinaRateHistory(marinaId, orgId, storageType);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching marina rate history:", error);
      res.status(500).json({ message: "Failed to fetch marina rate history" });
    }
  });

  // Get latest/current rates for a marina
  app.get('/api/marina-database/:marinaId/rates/current', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { marinaId } = req.params;

      const rates = await storage.getLatestMarinaRates(marinaId, orgId);
      res.json(rates);
    } catch (error: any) {
      console.error("Error fetching current marina rates:", error);
      res.status(500).json({ message: "Failed to fetch current marina rates" });
    }
  });

  // Create a new rate entry (marks previous rates as historical if needed)
  app.post('/api/marina-database/:marinaId/rates', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { marinaId } = req.params;

      const marina = await storage.getMarina(marinaId, orgId);
      if (!marina) return res.status(404).json({ message: "Marina not found" });

      const { storageType, rateYear, rateSeason, markPreviousAsHistorical = true } = req.body;

      // If this is a current rate, mark previous rates for same type/year as historical
      if (req.body.isCurrentRate !== false && markPreviousAsHistorical) {
        await storage.markPreviousRatesHistorical(marinaId, storageType, rateYear, orgId);
      }

      const rate = await storage.createMarinaRate({
        ...req.body,
        marinaId,
        orgId,
        createdBy: userId,
        isCurrentRate: req.body.isCurrentRate !== false
      });

      res.status(201).json(rate);
    } catch (error: any) {
      console.error("Error creating marina rate:", error);
      res.status(500).json({ message: "Failed to create marina rate" });
    }
  });

  // Bulk create rates
  app.post('/api/marina-database/:marinaId/rates/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { marinaId } = req.params;

      const marina = await storage.getMarina(marinaId, orgId);
      if (!marina) return res.status(404).json({ message: "Marina not found" });

      const { rates, markPreviousAsHistorical = true } = req.body;

      if (!Array.isArray(rates) || rates.length === 0) {
        return res.status(400).json({ message: "Invalid or empty rates array" });
      }

      // If marking previous as historical, do it for each unique storage type/year combo
      if (markPreviousAsHistorical) {
        const combos = new Set(rates.map((r: any) => `${r.storageType}|${r.rateYear}`));
        for (const combo of combos) {
          const [storageType, rateYear] = combo.split('|');
          await storage.markPreviousRatesHistorical(marinaId, storageType, parseInt(rateYear), orgId);
        }
      }

      const ratesToCreate = rates.map((rate: any) => ({
        ...rate,
        marinaId,
        orgId,
        createdBy: userId,
        isCurrentRate: rate.isCurrentRate !== false
      }));

      const createdRates = await storage.bulkCreateMarinaRates(ratesToCreate);
      res.status(201).json(createdRates);
    } catch (error: any) {
      console.error("Error bulk creating marina rates:", error);
      res.status(500).json({ message: "Failed to create marina rates" });
    }
  });

  // Update a rate
  app.patch('/api/marina-rates/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const existing = await storage.getMarinaRate(req.params.id, orgId);
      if (!existing) return res.status(404).json({ message: "Rate not found" });

      const rate = await storage.updateMarinaRate(req.params.id, { ...req.body, updatedBy: userId }, orgId);
      res.json(rate);
    } catch (error: any) {
      console.error("Error updating marina rate:", error);
      res.status(500).json({ message: "Failed to update marina rate" });
    }
  });

  // Delete a rate
  app.delete('/api/marina-rates/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const existing = await storage.getMarinaRate(req.params.id, orgId);
      if (!existing) return res.status(404).json({ message: "Rate not found" });

      await storage.deleteMarinaRate(req.params.id, orgId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting marina rate:", error);
      res.status(500).json({ message: "Failed to delete marina rate" });
    }
  });

  // Rate Comps Analytics endpoint - returns rate tier metrics
  app.post('/api/rate-comps/analytics', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = req.body || {};

      const tierAnalysis = await calculateRateTierMetrics(orgId, {
        states: filters.states,
        storageTypes: filters.storageTypes,
        electricRequired: filters.electricIncluded,
        protectionLevels: filters.protectionLevels,
        sizeMin: filters.loaMin,
        sizeMax: filters.loaMax,
      });

      const stats = {
        count: tierAnalysis.overall.count,
        avgRatePerFt: tierAnalysis.overall.avgNormalizedRate / 100,
        medianRatePerFt: tierAnalysis.overall.medianNormalizedRate / 100,
        minRatePerFt: tierAnalysis.overall.minNormalizedRate / 100,
        maxRatePerFt: tierAnalysis.overall.maxNormalizedRate / 100,
        avgMonthlyRate: (tierAnalysis.overall.avgNormalizedRate / 100) * 35,
        medianMonthlyRate: (tierAnalysis.overall.medianNormalizedRate / 100) * 35,
        avgLoaSize: tierAnalysis.bySize 
          ? (tierAnalysis.bySize.small.count * 20 + tierAnalysis.bySize.medium.count * 32 + 
             tierAnalysis.bySize.large.count * 50 + tierAnalysis.bySize.mega.count * 75) / 
            (tierAnalysis.bySize.small.count + tierAnalysis.bySize.medium.count + 
             tierAnalysis.bySize.large.count + tierAnalysis.bySize.mega.count || 1)
          : 35,
        uniqueMarinas: new Set(tierAnalysis.tiers.map(t => t.rateCompId)).size,
      };

      const byState = Object.entries(tierAnalysis.byState || {}).map(([state, data]: [string, any]) => ({
        state,
        avgRatePerFt: data.avgNormalizedRate / 100,
        medianRatePerFt: data.medianNormalizedRate / 100,
        count: data.count,
      }));

      const byStorageType = Object.entries(tierAnalysis.byStorageType || {}).map(([storageType, data]: [string, any]) => ({
        storageType,
        avgRatePerFt: data.avgNormalizedRate / 100,
        medianRatePerFt: data.medianNormalizedRate / 100,
        count: data.count,
        avgMonthlyRate: (data.avgNormalizedRate / 100) * 35,
      }));

      const rateRanges = [
        { range: '$0-$10', count: 0, avgRate: 0 },
        { range: '$10-$20', count: 0, avgRate: 0 },
        { range: '$20-$30', count: 0, avgRate: 0 },
        { range: '$30-$50', count: 0, avgRate: 0 },
        { range: '$50+', count: 0, avgRate: 0 },
      ];
      
      const loaRanges = [
        { range: 'Under 25\'', count: tierAnalysis.bySize?.small.count || 0, avgRate: (tierAnalysis.bySize?.small.avgRate || 0) / 100 },
        { range: '25\'-40\'', count: tierAnalysis.bySize?.medium.count || 0, avgRate: (tierAnalysis.bySize?.medium.avgRate || 0) / 100 },
        { range: '40\'-60\'', count: tierAnalysis.bySize?.large.count || 0, avgRate: (tierAnalysis.bySize?.large.avgRate || 0) / 100 },
        { range: 'Over 60\'', count: tierAnalysis.bySize?.mega.count || 0, avgRate: (tierAnalysis.bySize?.mega.avgRate || 0) / 100 },
      ];

      tierAnalysis.tiers.forEach(t => {
        const rateDollars = t.normalizedRate / 100;
        if (rateDollars < 10) { rateRanges[0].count++; rateRanges[0].avgRate = (rateRanges[0].avgRate * (rateRanges[0].count - 1) + rateDollars) / rateRanges[0].count; }
        else if (rateDollars < 20) { rateRanges[1].count++; rateRanges[1].avgRate = (rateRanges[1].avgRate * (rateRanges[1].count - 1) + rateDollars) / rateRanges[1].count; }
        else if (rateDollars < 30) { rateRanges[2].count++; rateRanges[2].avgRate = (rateRanges[2].avgRate * (rateRanges[2].count - 1) + rateDollars) / rateRanges[2].count; }
        else if (rateDollars < 50) { rateRanges[3].count++; rateRanges[3].avgRate = (rateRanges[3].avgRate * (rateRanges[3].count - 1) + rateDollars) / rateRanges[3].count; }
        else { rateRanges[4].count++; rateRanges[4].avgRate = (rateRanges[4].avgRate * (rateRanges[4].count - 1) + rateDollars) / rateRanges[4].count; }
      });

      const seasonalityBreakdown = [
        { seasonality: 'annual', count: 0, avgRate: 0 },
        { seasonality: 'seasonal', count: 0, avgRate: 0 },
        { seasonality: 'peak', count: 0, avgRate: 0 },
      ];

      tierAnalysis.tiers.forEach(t => {
        const s = t.seasonality || 'annual';
        const rateDollars = t.normalizedRate / 100;
        const entry = seasonalityBreakdown.find(e => e.seasonality === s);
        if (entry) {
          entry.count++;
          entry.avgRate = (entry.avgRate * (entry.count - 1) + rateDollars) / entry.count;
        } else {
          seasonalityBreakdown[0].count++;
          seasonalityBreakdown[0].avgRate = (seasonalityBreakdown[0].avgRate * (seasonalityBreakdown[0].count - 1) + rateDollars) / seasonalityBreakdown[0].count;
        }
      });
      res.json({
        stats,
        byState,
        byStorageType,
        byYear: (() => {
          const byYearMap: Record<number, { rates: number[]; count: number }> = {};
          tierAnalysis.tiers.forEach((t: any) => {
            const year = t.rateYear || new Date().getFullYear();
            if (!byYearMap[year]) byYearMap[year] = { rates: [], count: 0 };
            byYearMap[year].rates.push(t.normalizedRate / 100);
            byYearMap[year].count++;
          });
          return Object.entries(byYearMap).map(([year, data]) => {
            const sorted = [...data.rates].sort((a, b) => a - b);
            const avg = data.rates.reduce((a, b) => a + b, 0) / data.rates.length;
            const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
            return { year: parseInt(year), avgRatePerFt: avg, medianRatePerFt: median, count: data.count };
          }).sort((a, b) => a.year - b.year);
        })(),
        byBoatSize: (() => {
          const ranges = [
            { loaRange: "Under 25'", minLoa: 0, maxLoa: 25 },
            { loaRange: "25' - 35'", minLoa: 25, maxLoa: 35 },
            { loaRange: "35' - 45'", minLoa: 35, maxLoa: 45 },
            { loaRange: "45' - 60'", minLoa: 45, maxLoa: 60 },
            { loaRange: "60' - 80'", minLoa: 60, maxLoa: 80 },
            { loaRange: "Over 80'", minLoa: 80, maxLoa: 999 },
          ];
          const map: Record<string, { rates: number[]; count: number; minLoa: number; maxLoa: number }> = {};
          ranges.forEach(r => map[r.loaRange] = { rates: [], count: 0, minLoa: r.minLoa, maxLoa: r.maxLoa });
          tierAnalysis.tiers.forEach((t: any) => {
            const avgLoa = t.loaMin && t.loaMax ? (t.loaMin + t.loaMax) / 2 : t.loaMin || t.loaMax || 35;
            const range = ranges.find(r => avgLoa >= r.minLoa && avgLoa < r.maxLoa) || ranges[ranges.length - 1];
            map[range.loaRange].rates.push(t.normalizedRate / 100);
            map[range.loaRange].count++;
          });
          return Object.entries(map).filter(([_, d]) => d.count > 0).map(([loaRange, d]) => {
            const sorted = [...d.rates].sort((a, b) => a - b);
            const avg = d.rates.reduce((a, b) => a + b, 0) / d.rates.length;
            const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
            return { loaRange, minLoa: d.minLoa, maxLoa: d.maxLoa, avgRatePerFt: avg, medianRatePerFt: median, count: d.count };
          });
        })(),
        distribution: {
          rateRanges: rateRanges.filter(r => r.count > 0),
          loaRanges: loaRanges.filter(r => r.count > 0),
          seasonalityBreakdown: seasonalityBreakdown.filter(s => s.count > 0),
        },
      });
    } catch (error: any) {
      console.error("Error calculating rate comp analytics:", error);
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  // Matched rates for analytics
  app.post('/api/rate-comps/analytics/matched-rates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = req.body || {};

      const tierAnalysis = await calculateRateTierMetrics(orgId, {
        states: filters.states,
        storageTypes: filters.storageTypes,
        electricRequired: filters.electricIncluded,
        protectionLevels: filters.protectionLevels,
        sizeMin: filters.loaMin,
        sizeMax: filters.loaMax,
      });

      const rates = tierAnalysis.tiers.map(t => {
        const isPerFoot = t.rateUnit === 'per_foot' || t.rateUnit === 'per_foot_loa';
        const avgLoa = t.loaMin && t.loaMax 
          ? (t.loaMin + t.loaMax) / 2 
          : t.loaMax || t.loaMin || 35;
        
        let ratePerFtDollars: number | null = null;
        let monthlyRateDollars: number;
        
        if (isPerFoot) {
          ratePerFtDollars = t.normalizedRate / 100;
          monthlyRateDollars = ratePerFtDollars * avgLoa;
        } else {
          let monthlyAmountCents = t.amountCents;
          if (t.ratePeriod === 'annual') {
            monthlyAmountCents = t.amountCents / 12;
          } else if (t.ratePeriod === 'daily') {
            monthlyAmountCents = t.amountCents * 30;
          } else if (t.ratePeriod === 'weekly') {
            monthlyAmountCents = t.amountCents * 4.33;
          }
          monthlyRateDollars = monthlyAmountCents / 100;
        }
        
        return {
          id: t.id,
          marina: t.marinaName,
          state: t.state,
          city: t.city,
          storageType: t.storageType,
          ratePeriod: t.ratePeriod,
          rateUnit: t.rateUnit,
          ratePerFt: ratePerFtDollars,
          monthlyRate: monthlyRateDollars,
          loaMin: t.loaMin,
          loaMax: t.loaMax,
          seasonality: t.seasonality || 'annual',
          electricIncluded: t.electricIncluded,
          waterIncluded: true,
        };
      });

      res.json({ rates, total: rates.length });
    } catch (error: any) {
      console.error("Error fetching matched rates:", error);
      res.status(500).json({ message: "Failed to fetch matched rates" });
    }
  });

  // Saved Searches routes
  app.get('/api/rc-saved-searches', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searches = await storage.getRcSavedSearches(orgId, userId);
      res.json(searches);
    } catch (error: any) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ message: "Failed to fetch saved searches" });
    }
  });

  app.get('/api/rc-saved-searches/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const search = await storage.getRcSavedSearch(req.params.id, orgId);
      if (!search) return res.status(404).json({ message: "Saved search not found" });

      res.json(search);
    } catch (error: any) {
      console.error("Error fetching saved search:", error);
      res.status(500).json({ message: "Failed to fetch saved search" });
    }
  });

  app.post('/api/rc-saved-searches', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searchData = insertScSavedSearchSchema.parse(req.body);
      const search = await storage.createRcSavedSearch({
        ...searchData,
        orgId,
        createdBy: userId,
      } as any);

      res.status(201).json(search);
    } catch (error: any) {
      console.error("Error creating saved search:", error);
      res.status(500).json({ message: "Failed to create saved search" });
    }
  });

  app.patch('/api/rc-saved-searches/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searchData = updateScSavedSearchSchema.parse(req.body);
      const search = await storage.updateRcSavedSearch(req.params.id, {
        ...searchData,
        updatedBy: userId,
      }, orgId);

      if (!search) return res.status(404).json({ message: "Saved search not found" });

      res.json(search);
    } catch (error: any) {
      console.error("Error updating saved search:", error);
      res.status(500).json({ message: "Failed to update saved search" });
    }
  });

  app.delete('/api/rc-saved-searches/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const success = await storage.deleteRcSavedSearch(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Saved search not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ message: "Failed to delete saved search" });
    }
  });

  app.post('/api/rc-saved-searches/:id/use', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      await storage.incrementRcSavedSearchUsage(req.params.id, orgId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error incrementing saved search usage:", error);
      res.status(500).json({ message: "Failed to update saved search usage" });
    }
  });

  // Pending Properties routes - Review queue for properties created from rate comps
  app.get('/api/rc-pending-properties', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.query;

      const pendingProps = await storage.getRcPendingProperties(orgId, status);
      res.json(pendingProps);
    } catch (error: any) {
      console.error("Error fetching pending properties:", error);
      res.status(500).json({ message: "Failed to fetch pending properties" });
    }
  });

  app.post('/api/rc-pending-properties/:id/accept', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const property = await storage.acceptRcPendingProperty(id, orgId, userId);
      if (!property) {
        return res.status(404).json({ message: "Pending property not found or already processed" });
      }

      res.json(property);
    } catch (error: any) {
      console.error("Error accepting pending property:", error);
      res.status(500).json({ message: "Failed to accept pending property" });
    }
  });

  app.post('/api/rc-pending-properties/:id/reject', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const success = await storage.rejectRcPendingProperty(id, orgId, userId);
      if (!success) {
        return res.status(404).json({ message: "Pending property not found or already processed" });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("Error rejecting pending property:", error);
      res.status(500).json({ message: "Failed to reject pending property" });
    }
  });

  // Analytics/Metrics routes
  app.post('/api/rc-analytics/calculate', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: RcAnalyticsFilters = req.body.filters || {};

      const analysis = await rcCalculateMetrics(orgId, filters);
      const insights = await rcGenerateInsights(analysis, filters);

      res.json({
        analysis,
        insights,
      });
    } catch (error: any) {
      console.error("Error calculating rate comp analytics:", error);
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  app.post('/api/rc-analytics/insights', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: RcAnalyticsFilters = req.body.filters || {};

      const analysis = await rcCalculateMetrics(orgId, filters);
      const insights = await rcGenerateInsights(analysis, filters);

      res.json({ insights });
    } catch (error: any) {
      console.error("Error generating insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  // Rate Tier Analytics endpoints
  app.post('/api/rate-tiers/analytics', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: RateTierAnalyticsFilters = req.body.filters || {};

      const analysis = await calculateRateTierMetrics(orgId, filters);
      const insights = await generateRateTierInsights(analysis, filters);

      res.json({
        analysis,
        insights,
      });
    } catch (error: any) {
      console.error("Error calculating rate tier analytics:", error);
      res.status(500).json({ message: "Failed to calculate rate tier analytics" });
    }
  });

  app.post('/api/rate-tiers/analytics/normalized-rates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: RateTierAnalyticsFilters = req.body.filters || {};

      const analysis = await calculateRateTierMetrics(orgId, filters);

      res.json({
        overall: analysis.overall,
        byStorageType: analysis.byStorageType,
        byState: analysis.byState,
        bySize: analysis.bySize,
        tiers: analysis.tiers,
      });
    } catch (error: any) {
      console.error("Error getting normalized rates:", error);
      res.status(500).json({ message: "Failed to get normalized rates" });
    }
  });

  app.post('/api/rate-tiers/analytics/compare', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { targetLoa, targetStorageType, filters } = req.body;

      const analysis = await calculateRateTierMetrics(orgId, filters || {});
      
      // Find matching tiers for comparison
      let matchingTiers = analysis.tiers;
      
      if (targetStorageType) {
        matchingTiers = matchingTiers.filter(t => t.storageType === targetStorageType);
      }
      
      if (targetLoa) {
        matchingTiers = matchingTiers.filter(t => {
          if (t.exactLoa) return t.exactLoa === targetLoa;
          const min = t.sizeMin || 0;
          const max = t.sizeMax || Infinity;
          return targetLoa >= min && targetLoa <= max;
        });
      }

      // Calculate comparison stats
      const rates = matchingTiers.map(t => t.normalizedRate);
      const count = rates.length;
      
      const comparison = {
        matchingTierCount: count,
        avgNormalizedRate: count > 0 ? rates.reduce((a, b) => a + b, 0) / count : 0,
        minNormalizedRate: count > 0 ? Math.min(...rates) : 0,
        maxNormalizedRate: count > 0 ? Math.max(...rates) : 0,
        tiers: matchingTiers.slice(0, 20), // Return top 20 matching tiers
        percentiles: count > 3 ? {
          p25: rates.sort((a, b) => a - b)[Math.floor(count * 0.25)] || 0,
          p50: rates.sort((a, b) => a - b)[Math.floor(count * 0.5)] || 0,
          p75: rates.sort((a, b) => a - b)[Math.floor(count * 0.75)] || 0,
        } : null,
      };

      res.json(comparison);
    } catch (error: any) {
      console.error("Error comparing rates:", error);
      res.status(500).json({ message: "Failed to compare rates" });
    }
  });

  // Portfolio bulk creation routes
  app.post('/api/rate-comps/portfolios', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      // Validate request body using Zod schema
      const validatedData = bulkPortfolioCreateSchema.parse(req.body);
      const { portfolio, comps } = validatedData;

      // Wrap everything in a transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        // Create portfolio first
        const [createdPortfolio] = await tx.insert(scPortfolios).values({
          orgId,
          createdBy: userId,
          name: portfolio.name,
          description: portfolio.description || null,
          notes: portfolio.notes || null,
        }).returning();

        // Create all comps and link to portfolio
        const createdComps = [];
        for (let i = 0; i < comps.length; i++) {
          const compData = comps[i];
          
          // Create the comp using rcCompService (handles property linking, etc.)
          const comp = await rcCompService.createComp({
            ...compData,
            orgId,
            createdBy: userId,
          }, userId);
          
          createdComps.push(comp);

          // Link comp to portfolio
          await tx.insert(scPortfolioComps).values({
            orgId,
            portfolioId: createdPortfolio.id,
            salesCompId: comp.id,
            addedBy: userId,
            orderIndex: i,
          });
        }

        return {
          portfolio: createdPortfolio,
          comps: createdComps,
        };
      });

      // Create audit log (outside transaction since it's not critical)
      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_portfolio',
        entityId: result.portfolio.id,
        action: 'create',
        after: {
          portfolio: result.portfolio,
          compCount: result.comps.length,
        },
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating portfolio:", error);
      
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Failed to create portfolio", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // RC Projects routes
  app.get('/api/rc-projects', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projects = await storage.getRcProjects(orgId, userId);
      res.json(projects);
    } catch (error: any) {
      console.error("Error fetching RC projects:", error);
      res.status(500).json({ message: "Failed to fetch RC projects" });
    }
  });

  app.get('/api/rc-projects/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // Create child projects for portfolio properties
      const childProjects: any[] = [];
      if (req.body.projectType === "portfolio" && Array.isArray(req.body.portfolioProperties)) {
        for (const prop of req.body.portfolioProperties) {
          if (!prop.name) continue;
          try {
            let childPropertyId = null;
            try {
              const newProperty = await storage.createCrmProperty({
                orgId: req.user.orgId,
                title: prop.name,
                type: "marina",
                status: "pending",
                address: prop.address,
                city: prop.city,
                state: prop.state,
                zipCode: prop.zipCode,
                coordinates: prop.coordinates,
                ownerId: req.user.id,
                pipelineStage: "lead",
              });
              childPropertyId = newProperty.id;
            } catch (propError) {
              console.error("[Portfolio] Failed to auto-create property:", propError);
            }
            const childProjectData = insertProjectSchema.parse({
              name: prop.name,
              projectType: "single",
              parentProjectId: project.id,
              propertyId: childPropertyId,
              address: prop.address,
              city: prop.city,
              state: prop.state,
              zipCode: prop.zipCode,
              orgId: req.user.orgId,
              createdBy: req.user.id,
            });
            const childProject = await storage.createProject(childProjectData);
            childProjects.push(childProject);
            await storage.createProjectSettings({
              projectId: childProject.id,
              useBusinessDays: false,
              holidayCalendar: "us_federal",
              notificationsJson: {},
              ndaRequired: false,
            });
            try {
              await initializeVdrForProject(childProject.id, req.user.orgId, req.user.id);
            } catch (vdrError) {
              console.error("[Portfolio] Failed to init VDR:", vdrError);
            }
          } catch (childError) {
            console.error("[Portfolio] Failed to create child:", childError);
          }
        }
      }
      res.json({ ...project, childProjects });
    } catch (error: any) {
      console.error("Error fetching RC project:", error);
      res.status(500).json({ message: "Failed to fetch RC project" });
    }
  });

  app.post('/api/rc-projects', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projectData = scProjectCreateSchema.parse(req.body);
      const project = await storage.createRcProject({
        ...projectData,
        orgId,
        createdBy: userId,
      });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project',
        entityId: project.id,
        action: 'create',
        after: project,
      });
      
      // Initialize VDR Data Room with default template
      try {
        await initializeVdrForProject(project.id, req.user.orgId, req.user.id);
      } catch (vdrError) {
        console.error("[DD Project] Failed to initialize VDR:", vdrError);
      }

      // Auto-run recommendations and add matching comps if project has meaningful profile criteria
      let recommendations = null;
      let addedCount = 0;
      
      // Helper function to check if a value is meaningful
      const isMeaningfulValue = (value: any): boolean => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'object' && !Array.isArray(value)) {
          // For objects, check if any nested value is meaningful
          return Object.values(value).some(isMeaningfulValue);
        }
        // Allow all other values including 0, false, etc.
        return true;
      };
      
      // Deep normalize profile by removing all undefined/null/empty values
      const normalizedProfile = project.profile ? 
        Object.fromEntries(
          Object.entries(project.profile)
            .filter(([_, value]) => isMeaningfulValue(value))
        ) : {};
      
      const hasValidCriteria = Object.keys(normalizedProfile).length > 0;
      
      if (hasValidCriteria) {
        try {
          const projectProfile = normalizedProfile as ProjectProfile;
          const userWeightOverrides = (project.weightOverrides as any) || undefined;
          
          recommendations = await rcRecommendationService.getRecommendations({
            orgId,
            projectProfile,
            userWeightOverrides,
            limit: 50,
          });

          // Auto-add top 30 matching comps to the project
          if (recommendations && recommendations.items && recommendations.items.length > 0) {
            const topComps = recommendations.items.slice(0, 30);
            for (const rec of topComps) {
              try {
                await storage.addCompToRcProject(
                  project.id,
                  rec.id,
                  orgId,
                  userId
                );
                addedCount++;
              } catch (addError: any) {
                // Skip duplicates or errors, continue adding others
                if (!addError.message?.includes('duplicate key')) {
                  console.error("Error auto-adding comp:", addError);
                }
              }
            }
          }
        } catch (recError) {
          console.error("Error generating recommendations for new RC project:", recError);
          // Don't fail project creation if recommendations fail
        }
      } else {
      }

      res.status(201).json({ project, recommendations, addedCount });
    } catch (error: any) {
      console.error("Error creating RC project:", error);
      res.status(500).json({ message: "Failed to create RC project" });
    }
  });

  app.put('/api/rc-projects/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const currentProject = await storage.getRcProject(req.params.id, orgId);
      if (!currentProject) return res.status(404).json({ message: "Project not found" });

      const updates = scProjectUpdateSchema.parse(req.body);
      const updatedProject = await storage.updateRcProject(req.params.id, {
        ...updates,
        updatedBy: userId,
      }, orgId);

      if (!updatedProject) return res.status(404).json({ message: "Project not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project',
        entityId: updatedProject.id,
        action: 'update',
        before: currentProject,
        after: updatedProject,
      });

      res.json(updatedProject);
    } catch (error: any) {
      console.error("Error updating RC project:", error);
      res.status(500).json({ message: "Failed to update RC project" });
    }
  });

  app.delete('/api/rc-projects/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const currentProject = await storage.getRcProject(req.params.id, orgId);
      if (!currentProject) return res.status(404).json({ message: "Project not found" });

      const success = await storage.deleteRcProject(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Project not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project',
        entityId: req.params.id,
        action: 'delete',
        before: currentProject,
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting RC project:", error);
      res.status(500).json({ message: "Failed to delete RC project" });
    }
  });

  // RC Project Comps routes
  app.get('/api/rc-projects/:id/comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const projectComps = await storage.getRcProjectComps(req.params.id, orgId);
      res.json(projectComps);
    } catch (error: any) {
      console.error("Error fetching RC project comps:", error);
      res.status(500).json({ message: "Failed to fetch RC project comps" });
    }
  });

  app.post('/api/rc-projects/:id/comps', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const compData = projectCompCreateSchema.parse(req.body);
      
      try {
        const projectComp = await storage.addCompToRcProject(
          req.params.id,
          compData.salesCompId,
          orgId,
          userId
        );

        await storage.createAuditLog({
          orgId,
          userId,
          entityType: 'rc_project_comp',
          entityId: projectComp.id,
          action: 'create',
          after: projectComp,
        });

        res.status(201).json(projectComp);
      } catch (error: any) {
        if (error.message.includes('duplicate key value') || error.code === '23505') {
          return res.status(409).json({ message: "Rate comp is already added to this project" });
        }
        throw error;
      }
    } catch (error: any) {
      console.error("Error adding comp to RC project:", error);
      res.status(500).json({ message: "Failed to add comp to RC project" });
    }
  });

  app.post('/api/rc-projects/:id/comps/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const bulkData = projectCompBulkSchema.parse(req.body);
      const results: { success: any[]; failed: any[] } = { success: [], failed: [] };

      for (const rateCompId of bulkData.salesCompIds) {
        try {
          const projectComp = await storage.addCompToRcProject(
            req.params.id,
            rateCompId,
            orgId,
            userId
          );

          await storage.createAuditLog({
            orgId,
            userId,
            entityType: 'rc_project_comp',
            entityId: projectComp.id,
            action: 'create',
            after: projectComp,
          });

          results.success.push({ rateCompId, projectComp });
        } catch (error: any) {
          results.failed.push({ 
            rateCompId, 
            error: error.message.includes('duplicate key') ? 'Already in project' : 'Failed to add' 
          });
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error bulk adding comps to RC project:", error);
      res.status(500).json({ message: "Failed to bulk add comps to RC project" });
    }
  });

  app.delete('/api/rc-projects/:id/comps/bulk', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { compIds } = req.body;
      if (!Array.isArray(compIds) || compIds.length === 0) {
        return res.status(400).json({ message: "Invalid or empty comp IDs array" });
      }

      let removedCount = 0;
      for (const compId of compIds) {
        try {
          const success = await storage.removeCompFromRcProject(
            req.params.id,
            compId,
            orgId
          );
          
          if (success) {
            removedCount++;
            await storage.createAuditLog({
              orgId,
              userId,
              entityType: 'rc_project_comp',
              entityId: compId,
              action: 'delete',
              before: { projectId: req.params.id, rateCompId: compId },
            });
          }
        } catch (error: any) {
          console.error(`Error removing rate comp ${compId} from RC project:`, error);
        }
      }

      res.json({ removed: removedCount });
    } catch (error: any) {
      console.error("Error bulk removing comps from RC project:", error);
      res.status(500).json({ message: "Failed to bulk remove comps from RC project" });
    }
  });

  app.delete('/api/rc-projects/:id/comps/:compId', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const success = await storage.removeCompFromRcProject(
        req.params.id,
        req.params.compId,
        orgId
      );
      
      if (!success) return res.status(404).json({ message: "Comp not found in project" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project_comp',
        entityId: req.params.compId,
        action: 'delete',
        before: { projectId: req.params.id, rateCompId: req.params.compId },
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error removing comp from RC project:", error);
      res.status(500).json({ message: "Failed to remove comp from RC project" });
    }
  });

  app.patch('/api/rc-projects/:id/comps/:compId', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const project = await storage.getRcProject(req.params.id, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const updates = projectCompUpdateSchema.parse(req.body);
      const updatedProjectComp = await storage.updateRcProjectComp(
        req.params.compId,
        updates,
        orgId
      );

      if (!updatedProjectComp) return res.status(404).json({ message: "Project comp not found" });

      await storage.createAuditLog({
        orgId,
        userId,
        entityType: 'rc_project_comp',
        entityId: req.params.compId,
        action: 'update',
        after: updatedProjectComp,
      });

      res.json(updatedProjectComp);
    } catch (error: any) {
      console.error("Error updating RC project comp:", error);
      res.status(500).json({ message: "Failed to update RC project comp" });
    }
  });

  // Recommendations routes
  app.get('/api/rc-projects/:id/recommendations', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getRcProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const limit = parseInt(req.query.limit as string) || 50;
      const excludeAssigned = req.query.excludeAssigned === 'true';

      let excludeCompIds: string[] = [];
      if (excludeAssigned) {
        const projectComps = await storage.getRcProjectComps(projectId, orgId);
        excludeCompIds = projectComps.map(pc => pc.rateCompId);
      }

      const projectProfile = (project.profile as any) || {};
      const userWeightOverrides = (project.weightOverrides as any) || undefined;

      const recommendations = await rcRecommendationService.getRecommendations({
        orgId,
        projectProfile,
        userWeightOverrides,
        excludeCompIds,
        limit,
      });

      res.json({
        items: recommendations,
        total: recommendations.length,
        projectProfile,
        weights: userWeightOverrides,
      });
    } catch (error: any) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  app.get('/api/rc-projects/:id/preferences', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getRcProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      res.json({
        profile: project.profile || {},
        weightOverrides: project.weightOverrides || {},
      });
    } catch (error: any) {
      console.error("Error fetching RC project preferences:", error);
      res.status(500).json({ message: "Failed to fetch RC project preferences" });
    }
  });

  app.put('/api/rc-projects/:id/preferences', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const projectId = req.params.id;
      const project = await storage.getRcProject(projectId, orgId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const { profile, weightOverrides } = req.body;

      let validatedProfile, validatedWeights;
      
      try {
        validatedProfile = profile ? scProjectProfileSchema.parse(profile) : project.profile;
        validatedWeights = weightOverrides ? scWeightOverridesSchema.parse(weightOverrides) : project.weightOverrides;
      } catch (validationError: any) {
        console.error("Validation error in RC project preferences:", validationError);
        return res.status(400).json({ 
          message: "Invalid RC project preferences data", 
          details: validationError?.errors || validationError?.message 
        });
      }

      const updatedProject = await storage.updateRcProject(projectId, {
        profile: validatedProfile,
        weightOverrides: validatedWeights,
        updatedBy: userId,
      }, orgId);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json({
        profile: updatedProject.profile,
        weightOverrides: updatedProject.weightOverrides,
      });
    } catch (error: any) {
      console.error("Error updating RC project preferences:", error);
      res.status(500).json({ message: "Failed to update RC project preferences" });
    }
  });

  app.post('/api/rc-recommendations/feedback', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const feedbackData = insertScRecommendationFeedbackSchema.parse({
        ...req.body,
        orgId,
        userId,
      });

      const feedback = await storage.createRcRecommendationFeedback(feedbackData);

      if (['selected', 'rejected', 'liked'].includes(feedbackData.action)) {
        const project = await storage.getRcProject(feedbackData.projectId, orgId);
        const comp = await storage.getRateComp(feedbackData.salesCompId, orgId);
        
        if (project && comp) {
          const projectProfile = (project.profile as any) || {};
          
          let scoreBreakdown = req.body.breakdown;
          let currentScore = parseFloat(req.body.scoreAtTime) || 0;
          
          if (!scoreBreakdown) {
            const recommendations = await rcRecommendationService.getRecommendations({
              orgId,
              projectProfile,
              userWeightOverrides: (project.weightOverrides as any) || undefined,
              excludeCompIds: [],
              limit: 1000,
            });

            const matchingRec = recommendations.find(r => r.comp.id === comp.id);
            if (matchingRec) {
              scoreBreakdown = matchingRec.breakdown;
              currentScore = matchingRec.score;
            }
          }
          
          if (scoreBreakdown) {
            await rcRecommendationService.updateLearningWeights({
              orgId,
              projectProfile,
              selectedComp: comp,
              action: feedbackData.action as 'selected' | 'rejected' | 'liked',
              currentScore,
              breakdown: scoreBreakdown,
            });
          }
        }
      }

      res.json(feedback);
    } catch (error: any) {
      console.error("Error submitting rate comp recommendation feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // Google Maps API key endpoint
  app.get("/api/config/google-maps-key", (req, res) => {
    res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "" });
  });

}
