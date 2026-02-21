/**
 * Entity Linking API - Phase 2B
 * 
 * Unified API endpoints to manage cross-module relationships:
 * - Link contacts/companies to deals
 * - Link deals to DD projects
 * - Link DD projects to modeling projects
 * - Link Docket articles to CRM entities
 * 
 * These endpoints provide a consistent interface for entity relationship
 * management across the entire platform.
 */

import { Express, Request, Response } from "express";
import { db } from "../db";
import { dealOrchestrator } from "../services/deal-orchestrator";
import {
  crmDealContacts,
  crmDealCompanies,
  crmContacts,
  crmCompanies,
  crmProperties,
  crmDeals,
  projects,
  modelingProjects,
} from "@shared/schema";
import {
  articles as docketArticles,
  articleCrmLinks,
  docketCrmEntityLinkTypeEnum,
} from "@shared/docket-schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

// ============================================================================
// Validation Schemas
// ============================================================================

const linkContactToDealSchema = z.object({
  contactId: z.string().min(1),
  role: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

const linkCompanyToDealSchema = z.object({
  companyId: z.string().min(1),
  role: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

const linkDDProjectToDealSchema = z.object({
  dealId: z.string().min(1),
  projectId: z.string().min(1),
});

const linkModelingProjectSchema = z.object({
  dealId: z.string().min(1),
  modelingProjectId: z.string().min(1),
});

const linkArticleToCrmSchema = z.object({
  articleId: z.number().int().positive(),
  entityType: z.enum(['contact', 'company', 'property', 'deal']),
  entityId: z.string().min(1),
  linkSource: z.string().optional().default('manual'),
  confidence: z.number().int().min(0).max(100).optional().default(100),
  notes: z.string().optional(),
});

const bulkLinkArticlesSchema = z.object({
  articleId: z.number().int().positive(),
  links: z.array(z.object({
    entityType: z.enum(['contact', 'company', 'property', 'deal']),
    entityId: z.string().min(1),
    notes: z.string().optional(),
  })),
});

// ============================================================================
// Route Registration
// ============================================================================

export function registerEntityLinkingRoutes(app: Express) {
  
  // -------------------------------------------------------------------------
  // Deal → Entity Linking
  // -------------------------------------------------------------------------

  /**
   * Get all entities linked to a deal
   */
  app.get("/api/entity-links/deals/:dealId", async (req: any, res: Response) => {
    try {
      const { dealId } = req.params;
      const deal = await dealOrchestrator.getDealWithRelations(dealId);
      
      res.json({
        dealId,
        contacts: deal.contacts || [],
        companies: deal.companies || [],
        ddProject: deal.ddProject,
        modelingProject: deal.modelingProject,
      });
    } catch (error) {
      console.error("Error fetching deal entities:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch deal entities" });
    }
  });

  /**
   * Link a contact to a deal
   */
  app.post("/api/entity-links/deals/:dealId/contacts", async (req: any, res: Response) => {
    try {
      const { dealId } = req.params;
      const body = linkContactToDealSchema.parse(req.body);
      
      await dealOrchestrator.linkContact(
        dealId, 
        body.contactId, 
        body.role, 
        body.isPrimary
      );
      
      const updated = await dealOrchestrator.getDealWithRelations(dealId);
      res.json({ success: true, contacts: updated.contacts });
    } catch (error) {
      console.error("Error linking contact to deal:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to link contact" });
    }
  });

  /**
   * Unlink a contact from a deal
   */
  app.delete("/api/entity-links/deals/:dealId/contacts/:contactId", async (req: any, res: Response) => {
    try {
      const { dealId, contactId } = req.params;
      
      await db.delete(crmDealContacts)
        .where(and(
          eq(crmDealContacts.dealId, dealId),
          eq(crmDealContacts.contactId, contactId)
        ));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking contact from deal:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to unlink contact" });
    }
  });

  /**
   * Link a company to a deal
   */
  app.post("/api/entity-links/deals/:dealId/companies", async (req: any, res: Response) => {
    try {
      const { dealId } = req.params;
      const body = linkCompanyToDealSchema.parse(req.body);
      
      await dealOrchestrator.linkCompany(
        dealId, 
        body.companyId, 
        body.role, 
        body.isPrimary
      );
      
      const updated = await dealOrchestrator.getDealWithRelations(dealId);
      res.json({ success: true, companies: updated.companies });
    } catch (error) {
      console.error("Error linking company to deal:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to link company" });
    }
  });

  /**
   * Unlink a company from a deal
   */
  app.delete("/api/entity-links/deals/:dealId/companies/:companyId", async (req: any, res: Response) => {
    try {
      const { dealId, companyId } = req.params;
      
      await db.delete(crmDealCompanies)
        .where(and(
          eq(crmDealCompanies.dealId, dealId),
          eq(crmDealCompanies.companyId, companyId)
        ));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking company from deal:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to unlink company" });
    }
  });

  // -------------------------------------------------------------------------
  // Deal → DD Project Linking
  // -------------------------------------------------------------------------

  /**
   * Link a DD project to a deal (bidirectional)
   */
  app.post("/api/entity-links/deals/dd-project", async (req: any, res: Response) => {
    try {
      const body = linkDDProjectToDealSchema.parse(req.body);
      
      await dealOrchestrator.linkDDProject(body.dealId, body.projectId);
      
      const updated = await dealOrchestrator.getDealWithRelations(body.dealId);
      res.json({ 
        success: true, 
        dealId: body.dealId,
        ddProject: updated.ddProject,
      });
    } catch (error) {
      console.error("Error linking DD project to deal:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to link DD project" });
    }
  });

  /**
   * Unlink DD project from a deal
   */
  app.delete("/api/entity-links/deals/:dealId/dd-project", async (req: any, res: Response) => {
    try {
      const { dealId } = req.params;
      
      // Get current deal to find project
      const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, dealId));
      
      if (deal?.ddProjectId) {
        // Remove deal reference from project
        await db.update(projects)
          .set({ dealId: null })
          .where(eq(projects.id, deal.ddProjectId));
      }
      
      // Remove project reference from deal
      await db.update(crmDeals)
        .set({ ddProjectId: null, updatedAt: new Date() })
        .where(eq(crmDeals.id, dealId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking DD project from deal:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to unlink DD project" });
    }
  });

  // -------------------------------------------------------------------------
  // DD Project → Modeling Project Linking
  // -------------------------------------------------------------------------

  /**
   * Link a modeling project to a deal (via DD project)
   */
  app.post("/api/entity-links/deals/modeling-project", async (req: any, res: Response) => {
    try {
      const body = linkModelingProjectSchema.parse(req.body);
      
      await dealOrchestrator.linkModelingProject(body.dealId, body.modelingProjectId);
      
      const updated = await dealOrchestrator.getDealWithRelations(body.dealId);
      res.json({ 
        success: true, 
        dealId: body.dealId,
        modelingProject: updated.modelingProject,
      });
    } catch (error) {
      console.error("Error linking modeling project:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to link modeling project" });
    }
  });

  // -------------------------------------------------------------------------
  // Docket Article → CRM Entity Linking
  // -------------------------------------------------------------------------

  /**
   * Link a Docket article to a CRM entity
   */
  app.post("/api/entity-links/docket-articles", async (req: any, res: Response) => {
    try {
      const body = linkArticleToCrmSchema.parse(req.body);
      const orgId = req.user?.organizationId || 'org-1';
      const userId = req.user?.id;
      
      const [link] = await db.insert(articleCrmLinks).values({
        orgId,
        articleId: body.articleId,
        entityType: body.entityType,
        entityId: body.entityId,
        linkSource: body.linkSource,
        confidence: body.confidence,
        notes: body.notes,
        createdBy: userId,
      }).onConflictDoUpdate({
        target: [articleCrmLinks.articleId, articleCrmLinks.entityType, articleCrmLinks.entityId],
        set: {
          notes: body.notes,
          confidence: body.confidence,
        },
      }).returning();
      
      res.json({ success: true, link });
    } catch (error) {
      console.error("Error linking article to CRM entity:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to link article" });
    }
  });

  /**
   * Bulk link an article to multiple CRM entities
   */
  app.post("/api/entity-links/docket-articles/bulk", async (req: any, res: Response) => {
    try {
      const body = bulkLinkArticlesSchema.parse(req.body);
      const orgId = req.user?.organizationId || 'org-1';
      const userId = req.user?.id;
      
      const links = await Promise.all(body.links.map(async (l) => {
        const [link] = await db.insert(articleCrmLinks).values({
          orgId,
          articleId: body.articleId,
          entityType: l.entityType,
          entityId: l.entityId,
          linkSource: 'manual',
          confidence: 100,
          notes: l.notes,
          createdBy: userId,
        }).onConflictDoNothing().returning();
        return link;
      }));
      
      res.json({ success: true, links: links.filter(Boolean) });
    } catch (error) {
      console.error("Error bulk linking articles:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to bulk link articles" });
    }
  });

  /**
   * Get all CRM links for an article
   */
  app.get("/api/entity-links/docket-articles/:articleId", async (req: any, res: Response) => {
    try {
      const articleId = parseInt(req.params.articleId);
      if (isNaN(articleId)) {
        return res.status(400).json({ error: "Invalid article ID" });
      }
      
      const links = await db.select()
        .from(articleCrmLinks)
        .where(eq(articleCrmLinks.articleId, articleId));
      
      // Enrich with entity details
      const enrichedLinks = await Promise.all(links.map(async (link) => {
        let entity = null;
        switch (link.entityType) {
          case 'contact':
            [entity] = await db.select({ id: crmContacts.id, name: crmContacts.name, email: crmContacts.email })
              .from(crmContacts)
              .where(eq(crmContacts.id, link.entityId));
            break;
          case 'company':
            [entity] = await db.select({ id: crmCompanies.id, name: crmCompanies.name })
              .from(crmCompanies)
              .where(eq(crmCompanies.id, link.entityId));
            break;
          case 'property':
            [entity] = await db.select({ id: crmProperties.id, name: crmProperties.name, address: crmProperties.address })
              .from(crmProperties)
              .where(eq(crmProperties.id, link.entityId));
            break;
          case 'deal':
            [entity] = await db.select({ id: crmDeals.id, title: crmDeals.title, stage: crmDeals.stage })
              .from(crmDeals)
              .where(eq(crmDeals.id, link.entityId));
            break;
        }
        return { ...link, entity };
      }));
      
      res.json(enrichedLinks);
    } catch (error) {
      console.error("Error fetching article CRM links:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch links" });
    }
  });

  /**
   * Get all articles linked to a CRM entity
   */
  app.get("/api/entity-links/crm/:entityType/:entityId/articles", async (req: any, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      
      if (!['contact', 'company', 'property', 'deal'].includes(entityType)) {
        return res.status(400).json({ error: "Invalid entity type" });
      }
      
      const links = await db.select({
        link: articleCrmLinks,
        article: docketArticles,
      })
      .from(articleCrmLinks)
      .leftJoin(docketArticles, eq(articleCrmLinks.articleId, docketArticles.id))
      .where(and(
        eq(articleCrmLinks.entityType, entityType as any),
        eq(articleCrmLinks.entityId, entityId)
      ));
      
      res.json(links.map(l => ({
        ...l.link,
        article: l.article,
      })));
    } catch (error) {
      console.error("Error fetching entity articles:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch articles" });
    }
  });

  /**
   * Unlink an article from a CRM entity
   */
  app.delete("/api/entity-links/docket-articles/:articleId/:entityType/:entityId", async (req: any, res: Response) => {
    try {
      const articleId = parseInt(req.params.articleId);
      const { entityType, entityId } = req.params;
      
      if (isNaN(articleId)) {
        return res.status(400).json({ error: "Invalid article ID" });
      }
      
      await db.delete(articleCrmLinks)
        .where(and(
          eq(articleCrmLinks.articleId, articleId),
          eq(articleCrmLinks.entityType, entityType as any),
          eq(articleCrmLinks.entityId, entityId)
        ));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error unlinking article:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to unlink article" });
    }
  });

  // -------------------------------------------------------------------------
  // Cross-Module Entity Lookup
  // -------------------------------------------------------------------------

  /**
   * Find all related entities for a given entity
   * Returns connected contacts, companies, deals, projects, articles
   */
  app.get("/api/entity-links/:entityType/:entityId/related", async (req: any, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const related: Record<string, unknown[]> = {};
      
      switch (entityType) {
        case 'contact': {
          // Get deals linked to this contact
          const dealLinks = await db.select({ deal: crmDeals })
            .from(crmDealContacts)
            .leftJoin(crmDeals, eq(crmDealContacts.dealId, crmDeals.id))
            .where(eq(crmDealContacts.contactId, entityId));
          related.deals = dealLinks.map(d => d.deal).filter(Boolean);
          
          // Get articles linked to this contact
          const articleLinks = await db.select({ article: docketArticles })
            .from(articleCrmLinks)
            .leftJoin(docketArticles, eq(articleCrmLinks.articleId, docketArticles.id))
            .where(and(
              eq(articleCrmLinks.entityType, 'contact'),
              eq(articleCrmLinks.entityId, entityId)
            ));
          related.articles = articleLinks.map(a => a.article).filter(Boolean);
          break;
        }
        case 'company': {
          // Get deals linked to this company
          const dealLinks = await db.select({ deal: crmDeals })
            .from(crmDealCompanies)
            .leftJoin(crmDeals, eq(crmDealCompanies.dealId, crmDeals.id))
            .where(eq(crmDealCompanies.companyId, entityId));
          related.deals = dealLinks.map(d => d.deal).filter(Boolean);
          
          // Get contacts at this company
          const contacts = await db.select()
            .from(crmContacts)
            .where(eq(crmContacts.companyId, entityId));
          related.contacts = contacts;
          
          // Get articles linked to this company
          const articleLinks = await db.select({ article: docketArticles })
            .from(articleCrmLinks)
            .leftJoin(docketArticles, eq(articleCrmLinks.articleId, docketArticles.id))
            .where(and(
              eq(articleCrmLinks.entityType, 'company'),
              eq(articleCrmLinks.entityId, entityId)
            ));
          related.articles = articleLinks.map(a => a.article).filter(Boolean);
          break;
        }
        case 'deal': {
          const deal = await dealOrchestrator.getDealWithRelations(entityId);
          related.contacts = deal.contacts || [];
          related.companies = deal.companies || [];
          related.ddProject = deal.ddProject ? [deal.ddProject] : [];
          related.modelingProject = deal.modelingProject ? [deal.modelingProject] : [];
          
          // Get articles linked to this deal
          const articleLinks = await db.select({ article: docketArticles })
            .from(articleCrmLinks)
            .leftJoin(docketArticles, eq(articleCrmLinks.articleId, docketArticles.id))
            .where(and(
              eq(articleCrmLinks.entityType, 'deal'),
              eq(articleCrmLinks.entityId, entityId)
            ));
          related.articles = articleLinks.map(a => a.article).filter(Boolean);
          break;
        }
        case 'property': {
          // Get DD projects for this property
          const projs = await db.select()
            .from(projects)
            .where(eq(projects.propertyId, entityId));
          related.ddProjects = projs;
          
          // Get deals via DD projects
          const dealIds = projs.map(p => p.dealId).filter(Boolean) as string[];
          if (dealIds.length) {
            const deals = await db.select()
              .from(crmDeals)
              .where(sql`${crmDeals.id} IN (${sql.join(dealIds.map(id => sql`${id}`), sql`, `)})`);
            related.deals = deals;
          }
          
          // Get articles linked to this property
          const articleLinks = await db.select({ article: docketArticles })
            .from(articleCrmLinks)
            .leftJoin(docketArticles, eq(articleCrmLinks.articleId, docketArticles.id))
            .where(and(
              eq(articleCrmLinks.entityType, 'property'),
              eq(articleCrmLinks.entityId, entityId)
            ));
          related.articles = articleLinks.map(a => a.article).filter(Boolean);
          break;
        }
      }
      
      res.json({ entityType, entityId, related });
    } catch (error) {
      console.error("Error fetching related entities:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch related entities" });
    }
  });

  console.log("Entity linking routes registered");
}

// ============================================================================
// Cross-Module Events API
// ============================================================================


/**
 * Register event monitoring routes
 */
export function registerEventMonitoringRoutes(app: Express) {
  /**
   * Get recent cross-module events (for monitoring/debugging)
   */
  app.get("/api/events/recent", async (req: any, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const type = req.query.type as string;
      const action = req.query.action as string;
      
      const events = eventBus.getRecentEvents(limit, {
        type: type as any,
        action: action as any,
      });
      
      res.json({ events, count: events.length });
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch events" });
    }
  });

  /**
   * Get events for a specific entity
   */
  app.get("/api/events/:entityType/:entityId", async (req: any, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const events = eventBus.getEntityEvents(entityType, entityId, limit);
      
      res.json({ events, count: events.length });
    } catch (error) {
      console.error("Error fetching entity events:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to fetch events" });
    }
  });

  console.log("Event monitoring routes registered");
}
