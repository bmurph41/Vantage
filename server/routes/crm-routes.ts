import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or, desc, asc, gte, sql, inArray, notInArray, ilike, isNull, count as drizzleCount } from "drizzle-orm";
import { parsePagination, paginatedResponse } from "../utils/pagination";
import { CSVImportService } from "../csv-import-service";
import { DuplicateDetectionService } from "../duplicate-detection-service";
import { CompanyLinkingService } from "../company-linking-service";
import { CalendarService } from "../calendar-service";
import { findAllPotentialDuplicates, getDuplicateExplanation } from "../services/duplicate-finder";
import { findCompanyDuplicates, type CompanyDuplicateMatch } from "../services/company-duplicate-service";
import { evaluateAutomations } from "../services/workflow-engine";
import { packService } from "../services/pack-service";
import { customerAnalyticsService } from "../services/customer-analytics-service";
import { ownedAssetsService } from "../services/owned-assets-service";
import { marketingService } from "../services/marketing-service";
import { requireRentRoll } from "../middleware/pack-guard";
import { ParserService } from "../services/salescomps/parser";
import { FilterBuilder } from "../services/salescomps/filterBuilder";
import { generateAIInsights } from "../services/salescomps/aiInsightsService";
import {
  calculateMetrics,
  generateInsights,
  calculateCorrelationData,
  calculateValuationModels,
  getMatchedComps,
  getMarketTrends,
  generateTrendsInsights,
  type AnalyticsFilters,
  type TrendsFilters,
} from "../services/salescomps/analyticsService";
import { z } from "zod";
import multer from "multer";
import { validateFileUpload } from "../middleware/file-upload-security";
import path from "path";
import fs from "fs-extra";
import crypto from "crypto";
import {
  crmTasks,
  crmFiles,
  crmContacts,
  crmDeals,
  crmCompanies,
  crmActivities,
  crmProperties,
  crmNotes,
  crmContactCompanies,
  crmCompanyProperties,
  crmContactProperties,
  insertCrmTaskSchema,
  salesComps,
  rateComps,
  propertySalesComps,
  propertyRateComps,
  insertScSavedSearchSchema,
  updateScSavedSearchSchema,
  insertScAnalyticsFilterPresetSchema,
  updateScAnalyticsFilterPresetSchema,
  scPortfolios,
  scPortfolioComps,
  projects,
  users,
  outreachCampaigns,
  outreachTemplates,
  insertOutreachCampaignSchema,
  insertOutreachTemplateSchema,
  marinaListings,
  modelingProjectConfig,
  modelingProjects,
  modelingProjectActivity,
  marketTargets,
  insertMarketTargetSchema,
  insertModelingProjectSchema,
  dealCommissions,
  insertDealCommissionSchema,
  crmPipelineStages,
} from "@shared/schema";
import {
  salesCompCreateSchema,
  salesCompUpdateSchema,
  bulkUpdateSchema,
  compColumnCreateSchema,
  compColumnUpdateSchema,
  compFiltersSchema,
} from "../utils/salescomps-zod-schemas";

const filterBuilder = new FilterBuilder();

const uploadSalesComps = multer({
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

const parserService = new ParserService();

export function registerCRMRoutes(
  app: Express,
  authenticateUser: any,
  enforceTenant: any
) {
  // ==================== CRM ROUTES ====================

  // CRM Deals
  app.get("/api/crm/deals", async (req: any, res) => {
    try {
      let page = parseInt(req.query.page as string) || 1;
      let pageSize = parseInt(req.query.pageSize as string) || 50;
      
      if (page < 1) page = 1;
      if (pageSize < 1) pageSize = 1;
      if (pageSize > 100) pageSize = 100;
      
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortDir = (req.query.sortDir as string || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const search = req.query.search as string;
      const stageId = req.query.stageId as string;
      
      const result = await storage.getCrmDealsForOrgPaginated(req.user.orgId, {
        page,
        pageSize,
        sortBy,
        sortDir,
        search,
        stageId
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to get deals:", error);
      res.status(500).json({ error: "Failed to retrieve deals" });
    }
  });

  app.post("/api/crm/deals", async (req: any, res) => {
    try {
      const deal = await storage.createCrmDeal({ ...req.body, ownerId: req.user.id });
      // Workflow automation trigger — fire and forget
      evaluateAutomations('deal.created', 'deal', deal.id, req.user.orgId, deal).catch(() => {});
      res.json(deal);
    } catch (error: any) {
      console.error("Failed to create deal:", error);
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  app.put("/api/crm/deals/:id", async (req: any, res) => {
    try {
      let updateData = { ...req.body };
      
      // Get current deal to detect stage changes
      const currentDeal = await storage.getCrmDeal(req.params.id);
      if (!currentDeal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      
      const oldStageId = currentDeal.stageId;
      const newStageId = updateData.stageId;
      const stageChanged = newStageId && oldStageId !== newStageId;
      
      // Auto-close deal if stage name is "Closed"
      if (updateData.stageId) {
        const stage = await storage.getCrmStage(updateData.stageId);
        if (stage && stage.name.toLowerCase() === 'closed') {
          updateData.isClosed = true;
          updateData.closedAt = new Date().toISOString();
        }
      }
      
      let deal = await storage.updateCrmDeal(req.params.id, updateData);
      
      // Pipeline Stage Automation - execute after successful deal update
      if (stageChanged) {
        try {
          const newStage = await storage.getCrmStage(newStageId);
          const oldStage = oldStageId ? await storage.getCrmStage(oldStageId) : null;
          
          // Log stage change activity
          await storage.createCrmActivity({
            type: 'stage_change',
            subject: `Deal moved to ${newStage?.name || 'Unknown'}`,
            description: `Stage changed from "${oldStage?.name || 'None'}" to "${newStage?.name || 'Unknown'}"`,
            status: 'completed',
            entityType: 'deal',
            entityId: req.params.id,
            performedBy: req.user.id,
          });
          
          // Stage-based task automation rules
          const stageName = newStage?.name?.toLowerCase() || '';
          const automatedTasks: Array<{ title: string; description: string; priority: string; daysFromNow: number }> = [];
          
          // Under Contract / LOI stage - create DD prep tasks
          if (stageName.includes('contract') || stageName.includes('loi') || stageName.includes('letter of intent')) {
            automatedTasks.push(
              { title: 'Schedule site visit', description: 'Coordinate with seller to schedule property inspection', priority: 'high', daysFromNow: 3 },
              { title: 'Request financial documents', description: 'Request P&L, rent roll, and tax returns from seller', priority: 'high', daysFromNow: 2 },
              { title: 'Engage title company', description: 'Order title search and commitment', priority: 'medium', daysFromNow: 5 },
            );
          }
          
          // Due Diligence stage - create review tasks
          if (stageName.includes('due diligence') || stageName.includes('dd')) {
            automatedTasks.push(
              { title: 'Review financial statements', description: 'Analyze P&L trends, verify revenue and expense items', priority: 'high', daysFromNow: 7 },
              { title: 'Complete environmental review', description: 'Review Phase I ESA, check for fuel storage compliance', priority: 'high', daysFromNow: 10 },
              { title: 'Verify permits and licenses', description: 'Confirm marina operating permits, DNR compliance', priority: 'medium', daysFromNow: 7 },
            );
          }
          
          // Negotiation stage - create closing prep tasks
          if (stageName.includes('negotiation') || stageName.includes('closing')) {
            automatedTasks.push(
              { title: 'Prepare closing checklist', description: 'Compile all required closing documents', priority: 'high', daysFromNow: 2 },
              { title: 'Coordinate with lender', description: 'Ensure financing terms are finalized', priority: 'high', daysFromNow: 3 },
            );
          }
          
          // Get existing tasks for this deal to prevent duplicates
          const existingTasks = await db.query.crmTasks.findMany({
            where: eq(crmTasks.dealId, req.params.id),
          });
          const existingTaskTitles = new Set(existingTasks.map(t => t.title));
          
          // Create automated tasks (skip if same title already exists)
          let tasksCreated = 0;
          for (const taskDef of automatedTasks) {
            if (existingTaskTitles.has(taskDef.title)) {
              continue; // Skip duplicate
            }
            
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + taskDef.daysFromNow);
            
            await db.insert(crmTasks).values({
              title: taskDef.title,
              description: taskDef.description,
              type: 'task',
              priority: taskDef.priority,
              status: 'pending',
              dueDate: dueDate,
              completed: false,
              dealId: req.params.id,
              assigneeId: req.user.id,
            });
            tasksCreated++;
          }
          
          if (tasksCreated > 0) {
            logger.info({ dealId: req.params.id, tasksCreated, stage: newStage?.name }, "[Pipeline Automation] Created tasks for deal on stage change");
          }
        } catch (automationError) {
          // Don't fail the deal update if automation fails
          console.error("[Pipeline Automation] Error creating automated tasks:", automationError);
        }

        // Workflow engine trigger for stage changes — fire and forget
        evaluateAutomations('deal.stage_changed', 'deal', req.params.id, req.user.orgId, {
          prevStage: oldStageId,
          newStage: newStageId,
          newStageName: (await storage.getCrmStage(newStageId))?.name || '',
        }).catch(() => {});
      }

      // Workflow engine trigger for any field update — fire and forget
      evaluateAutomations('deal.field_updated', 'deal', req.params.id, req.user.orgId, {
        updatedFields: Object.keys(req.body),
      }).catch(() => {});

      // ── LOI Milestone Auto-Stage-Advance ──────────────────────────────────
      // When key milestone dates are newly set (were null, now have a value),
      // advance the deal to an appropriate stage if one matches.
      if (!updateData.stageId) {
        try {
          const milestoneStageMapping: Array<{ field: string; keywords: string[] }> = [
            { field: 'loiSubmittedAt',    keywords: ['loi', 'letter of intent', 'offer'] },
            { field: 'loiAcceptedAt',     keywords: ['negotiation', 'accepted', 'loi accepted'] },
            { field: 'termSheetSignedAt', keywords: ['term sheet', 'term', 'signed'] },
            { field: 'psaExecutedAt',     keywords: ['psa', 'under contract', 'contract', 'executed'] },
            { field: 'closingDate',       keywords: ['closed', 'close', 'won', 'done', 'closing'] },
          ];

          // Walk from most-significant to least: last match wins
          let targetStageName: string | null = null;
          let triggerField: string | null = null;
          for (const { field, keywords } of milestoneStageMapping) {
            const wasUnset = !currentDeal[field as keyof typeof currentDeal];
            const isNowSet = !!(updateData[field]);
            if (wasUnset && isNowSet) {
              targetStageName = keywords[0]; // use first keyword for logging
              triggerField = field;
            }
          }

          if (targetStageName && triggerField && deal?.pipelineId) {
            const pipelineStages = await db.select().from(crmPipelineStages)
              .where(eq(crmPipelineStages.pipelineId, deal.pipelineId))
              .orderBy(asc(crmPipelineStages.stageOrder));

            // Find the best matching stage (case-insensitive keyword match)
            const candidateKeywords = milestoneStageMapping.find(m => m.field === triggerField)?.keywords || [];
            const matchedStage = pipelineStages.find(s => {
              const lower = s.name.toLowerCase();
              return candidateKeywords.some(kw => lower.includes(kw));
            });

            if (matchedStage && matchedStage.id !== deal.stageId) {
              const autoAdvanceFields: Record<string, any> = { stageId: matchedStage.id };
              if (matchedStage.name.toLowerCase() === 'closed') {
                autoAdvanceFields.isClosed = true;
                autoAdvanceFields.closedAt = new Date().toISOString();
              }
              deal = await storage.updateCrmDeal(req.params.id, autoAdvanceFields);
              storage.createCrmActivity({
                type: 'stage_change',
                subject: `Auto-advanced to ${matchedStage.name}`,
                description: `Stage auto-advanced due to milestone "${triggerField}" being set`,
                status: 'completed',
                entityType: 'deal',
                entityId: req.params.id,
                performedBy: req.user.id,
              }).catch(() => {});
            }
          }
        } catch (milestoneError) {
          console.error('[Milestone Auto-Advance] Error:', milestoneError);
          // Non-fatal — don't fail the deal update
        }
      }

      const affectedBrokerStats = new Set<string>();
      if (currentDeal.brokerProfileId) affectedBrokerStats.add(currentDeal.brokerProfileId);
      if (deal?.brokerProfileId) affectedBrokerStats.add(deal.brokerProfileId);
      const statFieldsTouched =
        "brokerProfileId" in updateData ||
        "isClosed" in updateData ||
        "closedAt" in updateData ||
        "value" in updateData ||
        "amount" in updateData ||
        "offerPrice" in updateData ||
        "assetClass" in updateData;
      if (statFieldsTouched && affectedBrokerStats.size > 0) {
        const { recomputeAndPersistBrokerDealStats } = await import("../services/broker-deal-stats");
        const { pool } = await import("../db");
        for (const bid of affectedBrokerStats) {
          recomputeAndPersistBrokerDealStats(pool, bid).catch((e) =>
            console.error("[BrokerStats] Recompute failed for", bid, e),
          );
        }
      }

      res.json(deal);
    } catch (error: any) {
      console.error("Failed to update deal:", error);
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  app.delete("/api/crm/deals/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmDeal(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // Convert Deal to DD Project
  app.post("/api/deals/convert-to-project", async (req: any, res) => {
    try {
      const {
        dealId,
        projectName,
        includeDescription,
        includeContacts,
        includeFinancials,
        includeLocation,
        ddPeriodDays,
        createDefaultTasks,
        notes
      } = req.body;

      // Get the deal
      const deal = await storage.getCrmDeal(dealId);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      // Create the DD project with mapped data from deal
      const projectData: any = {
        name: projectName,
        orgId: req.user.orgId,
        createdBy: req.user.id,
        // Map all DD Deal Details fields from deal to project
        anchorType: deal.anchorType || 'psa',
        ddPeriodDays: deal.ddPeriodDays || ddPeriodDays,
        hasExtensions: deal.hasExtensions || false,
        extensionCount: deal.extensionCount || 0,
        extensionDays: deal.extensionDays || [],
        daysToClosing: deal.daysToClosing || null,
        tz: deal.tz || 'America/New_York',
        psaSignedDate: deal.psaSignedDate || null,
        ddExpirationDate: deal.ddExpirationDate || null,
        closingDate: deal.closingDate || null,
        // Key Contacts
        seller: deal.seller || [],
        ourAttorney: deal.ourAttorney || [],
        titleInsuranceCompany: deal.titleInsuranceCompany || null,
        lender: deal.lender || null,
        // Deposit Information
        firstDepositAmount: deal.firstDepositAmount || null,
        firstDepositDays: deal.firstDepositDays || null,
        firstDepositDueDate: deal.firstDepositDueDate || null,
        secondDepositAmount: deal.secondDepositAmount || null,
        secondDepositDays: deal.secondDepositDays || null,
        secondDepositDueDate: deal.secondDepositDueDate || null,
        customDeadlines: deal.customDeadlines || [],
        // Lease Information
        leases: deal.leases || [],
      };

      // Map description
      if (includeDescription && deal.description) {
        projectData.description = deal.description;
        if (notes) {
          projectData.description = `${deal.description}\n\n--- Conversion Notes ---\n${notes}`;
        }
      } else if (notes) {
        projectData.description = notes;
      }

      // Map location
      if (includeLocation) {
        if (deal.city) projectData.city = deal.city;
        if (deal.state) projectData.state = deal.state;
        // Store marina name and dock location in executive notes or custom field
        const locationNotes = [];
        if (deal.marinaName) locationNotes.push(`Marina: ${deal.marinaName}`);
        if (deal.dockLocation) locationNotes.push(`Dock: ${deal.dockLocation}`);
        if (locationNotes.length > 0) {
          projectData.executiveNotes = locationNotes.join('\n');
        }
      }

      // Map financials
      if (includeFinancials) {
        const dealAmount = deal.amount || deal.value;
        if (dealAmount) {
          projectData.purchasePrice = parseInt(dealAmount.toString().replace(/[^0-9]/g, '')) || 0;
        }
        
        // Map property details if available
        if (deal.propertyDetails) {
          const details = typeof deal.propertyDetails === 'string' 
            ? JSON.parse(deal.propertyDetails) 
            : deal.propertyDetails;
          
          if (details.grossRevenue) {
            projectData.projectedAnnualRevenue = parseInt(details.grossRevenue.toString().replace(/[^0-9]/g, '')) || 0;
          }
        }
      }

      // Create the project
      const project = await storage.createProject(projectData);

      // Create default project settings (map from deal if available)
      await storage.createOrUpdateProjectSettings({
        projectId: project.id,
        useBusinessDays: deal.useBusinessDays !== undefined ? deal.useBusinessDays : true,
        holidayCalendar: (deal.holidayCalendar || 'us_federal') as 'us_federal' | 'none',
        emailReminders: true,
        slackNotifications: false,
        ndaRequired: false
      });

      // Map contacts if requested
      if (includeContacts && deal.primaryContactId) {
        try {
          const contact = await storage.getCrmContact(deal.primaryContactId);
          if (contact) {
            // Create a DD contact from the CRM contact
            await storage.createDDContact({
              projectId: project.id,
              firstName: contact.firstName,
              lastName: contact.lastName,
              email: contact.email || '',
              phone: contact.phone || undefined,
              role: 'seller' as const,
              company: contact.company || undefined
            });
          }
        } catch (err) {
          console.error("Failed to map contact:", err);
          // Continue even if contact mapping fails
        }
      }

      // Create default DD tasks if requested
      if (createDefaultTasks) {
        const defaultTasks = [
          {
            name: 'Property Condition Assessment (PCA)',
            description: 'Comprehensive inspection of marina facilities and structures',
            category: 'inspection' as const,
            priority: 'high' as const,
            durationDays: 7
          },
          {
            name: 'Environmental Site Assessment (ESA Phase I)',
            description: 'Environmental assessment for potential contamination',
            category: 'ESA' as const,
            priority: 'high' as const,
            durationDays: 14
          },
          {
            name: 'Boundary Survey',
            description: 'Professional survey of property boundaries and improvements',
            category: 'survey' as const,
            priority: 'high' as const,
            durationDays: 10
          },
          {
            name: 'Title Search & Insurance',
            description: 'Title examination and commitment for title insurance',
            category: 'title' as const,
            priority: 'high' as const,
            durationDays: 7
          },
          {
            name: 'Financial Review',
            description: 'Review of financial statements and operating history',
            category: 'financial' as const,
            priority: 'med' as const,
            durationDays: 5
          },
          {
            name: 'Permits & Zoning Review',
            description: 'Verification of permits and zoning compliance',
            category: 'zoning' as const,
            priority: 'med' as const,
            durationDays: 7
          }
        ];

        for (const task of defaultTasks) {
          await storage.createTask({
            projectId: project.id,
            ...task,
            status: 'not_started' as const,
            assigneeType: 'internal' as const
          });
        }
      }

      // Update the deal to mark it as converted
      await storage.updateCrmDeal(dealId, {
        ddProjectId: project.id,
        stage: 'due_diligence',
      });

      res.json({
        success: true,
        projectId: project.id,
        message: "Deal successfully converted to DD project"
      });
    } catch (error: any) {
      console.error("Failed to convert deal to project:", error);
      res.status(500).json({ error: "Failed to convert deal to project" });
    }
  });

  // Create Modeling Project from Deal (bridges deal → modeling gap)
  app.post("/api/deals/:dealId/create-modeling-project", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { dealId } = req.params;
      const { crmDeals, modelingProjects } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const { db: database } = await import('./db');

      // Fetch the deal
      const [deal] = await database.select().from(crmDeals)
        .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));

      if (!deal) return res.status(404).json({ error: 'Deal not found' });

      // Check if deal already has a modeling project
      if (deal.modelingProjectId) {
        return res.status(400).json({ error: 'Deal already has a linked modeling project', modelingProjectId: deal.modelingProjectId });
      }

      // Check if a modeling project already references this deal
      const [existingModel] = await database.select().from(modelingProjects)
        .where(and(eq(modelingProjects.dealId, dealId), eq(modelingProjects.orgId, orgId)))
        .limit(1);

      if (existingModel) {
        // Link existing modeling project to deal
        await database.update(crmDeals)
          .set({ modelingProjectId: existingModel.id, updatedAt: new Date() })
          .where(eq(crmDeals.id, dealId));
        return res.json({ modelingProjectId: existingModel.id, message: 'Linked existing modeling project to deal' });
      }

      // Build modeling project from deal data
      const projectData: any = {
        orgId,
        dealId,
        ddProjectId: deal.ddProjectId || null,
        marinaName: deal.dealName || deal.name || 'Untitled Model',
        status: 'draft',
        purchasePrice: deal.amount ? String(deal.amount) : null,
        createdBy: userId,
      };

      // Copy location data if available
      if (deal.address) projectData.address = deal.address;
      if (deal.city) projectData.city = deal.city;
      if (deal.state) projectData.state = deal.state;
      if (deal.zipCode) projectData.zipCode = deal.zipCode;

      const [modelingProject] = await database.insert(modelingProjects)
        .values(projectData)
        .returning();

      // Update the deal with the modeling project link
      await database.update(crmDeals)
        .set({ modelingProjectId: modelingProject.id, updatedAt: new Date() })
        .where(eq(crmDeals.id, dealId));

      // Also update the DD project if it exists
      if (deal.ddProjectId) {
        const { projects } = await import('@shared/schema');
        await database.update(projects)
          .set({ modelingProjectId: modelingProject.id, updatedAt: new Date() })
          .where(eq(projects.id, deal.ddProjectId));
      }

      res.status(201).json({
        modelingProjectId: modelingProject.id,
        modelingProject,
        message: 'Modeling project created and linked to deal',
      });
    } catch (error: any) {
      console.error("Failed to create modeling project from deal:", error);
      res.status(500).json({ error: "Failed to create modeling project" });
    }
  });

  // Get deal's modeling project (lookup across both direct link and indirect via DD)
  app.get("/api/deals/:dealId/modeling-project", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dealId } = req.params;
      const { crmDeals, modelingProjects } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const { db: database } = await import('./db');

      const [deal] = await database.select().from(crmDeals)
        .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));

      if (!deal) return res.status(404).json({ error: 'Deal not found' });

      // Try direct link first
      if (deal.modelingProjectId) {
        const [project] = await database.select().from(modelingProjects)
          .where(eq(modelingProjects.id, deal.modelingProjectId));
        if (project) return res.json(project);
      }

      // Try via dealId on modeling projects
      const [byDeal] = await database.select().from(modelingProjects)
        .where(and(eq(modelingProjects.dealId, dealId), eq(modelingProjects.orgId, orgId)))
        .limit(1);
      if (byDeal) {
        // Auto-link for future lookups
        await database.update(crmDeals)
          .set({ modelingProjectId: byDeal.id, updatedAt: new Date() })
          .where(eq(crmDeals.id, dealId));
        return res.json(byDeal);
      }

      // Try via DD project
      if (deal.ddProjectId) {
        const [byDd] = await database.select().from(modelingProjects)
          .where(and(eq(modelingProjects.ddProjectId, deal.ddProjectId), eq(modelingProjects.orgId, orgId)))
          .limit(1);
        if (byDd) {
          await database.update(crmDeals)
            .set({ modelingProjectId: byDd.id, updatedAt: new Date() })
            .where(eq(crmDeals.id, dealId));
          return res.json(byDd);
        }
      }

      res.status(404).json({ error: 'No modeling project found for this deal' });
    } catch (error: any) {
      console.error("Failed to fetch deal modeling project:", error);
      res.status(500).json({ error: "Failed to fetch modeling project" });
    }
  });

  // CRM Leads
  app.get("/api/crm/leads", async (req: any, res) => {
    try {
      const pag = parsePagination(req.query, { pageSize: 50 });
      const allLeads = await storage.getCrmLeadsForOrg(req.user.orgId);
      const total = allLeads.length;
      const paged = allLeads.slice(pag.offset, pag.offset + pag.limit);
      res.json(paginatedResponse(paged, total, pag));
    } catch (error: any) {
      console.error("Failed to get leads:", error);
      res.status(500).json({ error: "Failed to retrieve leads" });
    }
  });

  app.post("/api/crm/leads", async (req: any, res) => {
    try {
      const lead = await storage.createCrmLead({ ...req.body, assignedToId: req.user.id });
      res.json(lead);
    } catch (error: any) {
      console.error("Failed to create lead:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.put("/api/crm/leads/:id", async (req: any, res) => {
    try {
      const lead = await storage.updateCrmLead(req.params.id, req.body);
      res.json(lead);
    } catch (error: any) {
      console.error("Failed to update lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/crm/leads/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmLead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete lead:", error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  app.post("/api/crm/leads/:id/convert", async (req: any, res) => {
    try {
      const leadId = req.params.id;
      const lead = await storage.getCrmLead(leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const { dealConfig, options } = req.body || {};

      let contactId: string | null = null;
      let companyId: string | null = null;

      const existingContacts = await db.select().from(crmContacts)
        .where(and(
          eq(crmContacts.orgId, req.user.orgId),
          lead.email ? eq(crmContacts.email, lead.email) : sql`false`
        ));

      if (existingContacts.length > 0) {
        contactId = existingContacts[0].id;
      } else {
        const [newContact] = await db.insert(crmContacts).values({
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email || '',
          phone: lead.phone || undefined,
          company: lead.company || undefined,
          jobTitle: lead.jobTitle || undefined,
          ownerId: req.user.id,
          orgId: req.user.orgId,
        }).returning();
        contactId = newContact.id;
      }

      if (lead.company) {
        const existingCompanies = await db.select().from(crmCompanies)
          .where(and(
            eq(crmCompanies.orgId, req.user.orgId),
            ilike(crmCompanies.name, lead.company)
          ));

        if (existingCompanies.length > 0) {
          companyId = existingCompanies[0].id;
        } else {
          const [newCompany] = await db.insert(crmCompanies).values({
            name: lead.company,
            ownerId: req.user.id,
            orgId: req.user.orgId,
          }).returning();
          companyId = newCompany.id;
        }

        if (contactId && companyId) {
          try {
            await db.insert(crmContactCompanies).values({
              contactId,
              companyId,
              orgId: req.user.orgId,
            }).onConflictDoNothing();
          } catch (linkErr) {
            console.error("Failed to link contact to company (non-fatal):", linkErr);
          }
        }
      }

      const dealName = dealConfig?.name || `${lead.firstName} ${lead.lastName} - Deal`;
      const [deal] = await db.insert(crmDeals).values({
        title: dealName,
        value: dealConfig?.value ? String(dealConfig.value) : undefined,
        stage: dealConfig?.stage || 'qualified',
        priority: dealConfig?.priority || 'medium',
        expectedCloseDate: dealConfig?.expectedCloseDate ? new Date(dealConfig.expectedCloseDate) : undefined,
        description: dealConfig?.description || undefined,
        primaryContactId: contactId,
        companyId: companyId,
        leadId: leadId,
        leadSource: lead.leadSource || lead.originalSource || undefined,
        ownerId: req.user.id,
        orgId: req.user.orgId,
      }).returning();

      if (contactId) {
        try {
          await db.insert(crmDealContacts).values({
            dealId: deal.id,
            contactId,
            role: 'primary',
            isPrimary: true,
            orgId: req.user.orgId,
          }).onConflictDoNothing();
        } catch (linkErr) {
          console.error("Failed to link deal to contact (non-fatal):", linkErr);
        }
      }

      if (companyId) {
        try {
          await db.insert(crmDealCompanies).values({
            dealId: deal.id,
            companyId,
            role: 'primary',
            isPrimary: true,
            orgId: req.user.orgId,
          }).onConflictDoNothing();
        } catch (linkErr) {
          console.error("Failed to link deal to company (non-fatal):", linkErr);
        }
      }

      await storage.updateCrmLead(leadId, {
        leadStatus: 'converted',
        convertedContactId: contactId,
        convertedDate: new Date(),
      });

      res.json({
        success: true,
        dealId: deal.id,
        contactId,
        companyId,
        message: "Lead converted successfully",
      });
    } catch (error: any) {
      console.error("Failed to convert lead:", error);
      res.status(500).json({ error: "Failed to convert lead" });
    }
  });

  // CRM Contacts
  
  // Check for duplicate email or phone (must be before /api/crm/contacts/:id)
  app.get("/api/crm/contacts/check-duplicate-field", async (req: any, res) => {
    try {
      const { field, value, excludeId } = req.query;
      
      if (!field || !value) {
        return res.status(400).json({ error: "field and value are required" });
      }
      
      if (field !== 'email' && field !== 'phone') {
        return res.status(400).json({ error: "field must be 'email' or 'phone'" });
      }
      
      const result = await storage.checkCrmContactDuplicateField(
        req.user.orgId,
        field as 'email' | 'phone',
        value as string,
        excludeId as string | undefined
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to check duplicate field:", error);
      res.status(500).json({ error: "Failed to check duplicate" });
    }
  });

  app.get("/api/crm/contacts", async (req: any, res) => {
    try {
      let page = parseInt(req.query.page as string) || 1;
      let pageSize = parseInt(req.query.pageSize as string) || 50;
      
      if (page < 1) page = 1;
      if (pageSize < 1) pageSize = 1;
      if (pageSize > 100) pageSize = 100;
      
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortDir = (req.query.sortDir as string || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const search = req.query.search as string;
      const companyId = req.query.companyId as string;
      
      const result = await storage.getCrmContactsForOrgPaginated(req.user.orgId, {
        page,
        pageSize,
        sortBy,
        sortDir,
        search,
        companyId
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to get contacts:", error);
      res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  });

  app.post("/api/crm/contacts", async (req: any, res) => {
    try {
      // Ensure required fields have values (database has notNull constraints)
      const contactData = {
        ...req.body,
        firstName: req.body.firstName || '',
        lastName: req.body.lastName || '',
        email: req.body.email || '',
        ownerId: req.user.id
      };
      const contact = await storage.createCrmContact(contactData);
      evaluateAutomations('contact.created', 'contact', contact.id, req.user.orgId, contact).catch(() => {});
      res.json(contact);
    } catch (error: any) {
      console.error("Failed to create contact:", error);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.put("/api/crm/contacts/:id", async (req: any, res) => {
    try {
      // Ensure required fields have values if provided
      const updateData = { ...req.body };
      if ('firstName' in updateData && !updateData.firstName) updateData.firstName = '';
      if ('lastName' in updateData && !updateData.lastName) updateData.lastName = '';
      if ('email' in updateData && !updateData.email) updateData.email = '';
      const contact = await storage.updateCrmContact(req.params.id, updateData);
      res.json(contact);
    } catch (error: any) {
      console.error("Failed to update contact:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/crm/contacts/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmContact(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete contact:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // CRM Companies
  app.get("/api/crm/companies", async (req: any, res) => {
    try {
      let page = parseInt(req.query.page as string) || 1;
      let pageSize = parseInt(req.query.pageSize as string) || 50;
      
      if (page < 1) page = 1;
      if (pageSize < 1) pageSize = 1;
      if (pageSize > 100) pageSize = 100;
      
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortDir = (req.query.sortDir as string || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const search = req.query.search as string;
      
      const result = await storage.getCrmCompaniesForOrgPaginated(req.user.orgId, {
        page,
        pageSize,
        sortBy,
        sortDir,
        search
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("Failed to get companies:", error);
      res.status(500).json({ error: "Failed to retrieve companies" });
    }
  });
  // Company autocomplete search for contact form
  app.get("/api/crm/companies/autocomplete", async (req: any, res) => {
    try {
      const query = (req.query.q as string || '').trim();
      if (query.length < 2) {
        return res.json([]);
      }
      
      const result = await storage.getCrmCompaniesForOrgPaginated(req.user.orgId, {
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortDir: 'asc',
        search: query
      });
      
      res.json(result.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        website: c.website,
        industry: c.industry
      })));
    } catch (error: any) {
      console.error("Failed to search companies:", error);
      res.status(500).json({ error: "Failed to search companies" });
    }
  });
  app.post("/api/crm/companies", async (req: any, res) => {
    try {
      // Ensure required fields have values (database has notNull constraints)
      const companyData = {
        ...req.body,
        name: req.body.name || '',
        ownerId: req.user.id
      };
      const company = await storage.createCrmCompany(companyData);
      res.json(company);
    } catch (error: any) {
      console.error("Failed to create company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  app.put("/api/crm/companies/:id", async (req: any, res) => {
    try {
      // Ensure required fields have values if provided
      const updateData = { ...req.body };
      if ('name' in updateData && !updateData.name) updateData.name = '';
      const company = await storage.updateCrmCompany(req.params.id, updateData);
      res.json(company);
    } catch (error: any) {
      console.error("Failed to update company:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  app.delete("/api/crm/companies/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmCompany(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete company:", error);
      res.status(500).json({ error: "Failed to delete company" });
    }
  });
  
  // Company Duplicate Detection
  app.get("/api/crm/companies/check-duplicates", async (req: any, res) => {
    try {
      const { name, address, city, state, zipCode, excludeId } = req.query;
      
      if (!name) {
        return res.json({ duplicates: [] });
      }

      const companies = await storage.getCrmCompaniesForOrg(req.user.orgId);
      const duplicates = findCompanyDuplicates(
        String(name),
        address ? String(address) : null,
        city ? String(city) : null,
        state ? String(state) : null,
        zipCode ? String(zipCode) : null,
        companies,
        excludeId ? String(excludeId) : undefined,
        40 // minimum similarity threshold
      );
      
      res.json({ duplicates });
    } catch (error: any) {
      console.error("Failed to check company duplicates:", error);
      res.status(500).json({ error: "Failed to check for duplicate companies" });
    }
  });

  // Merge Companies
  app.post("/api/crm/companies/merge", async (req: any, res) => {
    try {
      const { primaryId, secondaryId } = req.body;
      
      if (!primaryId || !secondaryId) {
        return res.status(400).json({ error: "Primary and secondary company IDs are required" });
      }
      
      if (primaryId === secondaryId) {
        return res.status(400).json({ error: "Cannot merge a company with itself" });
      }

      // Get both companies to verify they exist and belong to this org
      const primary = await storage.getCrmCompany(primaryId);
      const secondary = await storage.getCrmCompany(secondaryId);
      
      if (!primary || !secondary) {
        return res.status(404).json({ error: "One or both companies not found" });
      }
      
      // Verify org ownership
      if (primary.orgId !== req.user.orgId || secondary.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Transfer all relationships from secondary to primary
      // 1. Transfer contact-company links
      const contactCompanyLinks = await db.select().from(crmContactCompanies).where(eq(crmContactCompanies.companyId, secondaryId));
      for (const link of contactCompanyLinks) {
        // Check if this contact is already linked to primary
        const existingLink = await db.select().from(crmContactCompanies)
          .where(and(
            eq(crmContactCompanies.contactId, link.contactId),
            eq(crmContactCompanies.companyId, primaryId)
          )).limit(1);
        
        if (existingLink.length === 0) {
          // Move the link to primary
          await db.update(crmContactCompanies)
            .set({ companyId: primaryId })
            .where(eq(crmContactCompanies.id, link.id));
        } else {
          // Delete duplicate link
          await db.delete(crmContactCompanies).where(eq(crmContactCompanies.id, link.id));
        }
      }

      // 2. Transfer company-property links
      const companyPropertyLinks = await db.select().from(crmCompanyProperties).where(eq(crmCompanyProperties.companyId, secondaryId));
      for (const link of companyPropertyLinks) {
        // Check if this property is already linked to primary
        const existingLink = await db.select().from(crmCompanyProperties)
          .where(and(
            eq(crmCompanyProperties.propertyId, link.propertyId),
            eq(crmCompanyProperties.companyId, primaryId)
          )).limit(1);
        
        if (existingLink.length === 0) {
          // Move the link to primary
          await db.update(crmCompanyProperties)
            .set({ companyId: primaryId })
            .where(eq(crmCompanyProperties.id, link.id));
        } else {
          // Delete duplicate link
          await db.delete(crmCompanyProperties).where(eq(crmCompanyProperties.id, link.id));
        }
      }

      // 3. Delete the secondary company
      await storage.deleteCrmCompany(secondaryId);

      // Return the updated primary company
      const updatedPrimary = await storage.getCrmCompany(primaryId);
      res.json({ 
        success: true, 
        message: "Companies merged successfully",
        company: updatedPrimary 
      });
    } catch (error: any) {
      console.error("Failed to merge companies:", error);
      res.status(500).json({ error: "Failed to merge companies" });
    }
  });

  // CRM Pending Contacts
  app.get("/api/crm/pending-contacts", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const pendingContacts = await storage.getPendingContactsForOrg(orgId);

      const allCrmContacts = await storage.getCrmContactsForOrg(orgId);

      const enrichedPending = pendingContacts.map((pending: any) => {
        const pendingFullName = pending.fullName || `${pending.firstName || ''} ${pending.lastName || ''}`.trim();
        if (!pendingFullName && !pending.email && !pending.phone) return pending;

        const duplicates = allCrmContacts.map(contact => {
          let score = 0;
          const contactFullName = contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

          if (pendingFullName && contactFullName) {
            const np = pendingFullName.toLowerCase().trim();
            const nc = contactFullName.toLowerCase().trim();
            if (np === nc) score += 100;
            else if (np.includes(nc) || nc.includes(np)) score += 70;
          }

          if (pending.email && contact.email && pending.email.toLowerCase() === contact.email.toLowerCase()) {
            score += 80;
          }

          if (pending.phone && contact.phone) {
            const pp = pending.phone.replace(/\D/g, '');
            const cp = contact.phone.replace(/\D/g, '');
            if (pp === cp) score += 60;
          }

          return { contact, score };
        }).filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score);

        return {
          ...pending,
          suggestedDuplicates: duplicates.map(d => d.contact.id),
        };
      });

      res.json(enrichedPending);
    } catch (error: any) {
      console.error("Failed to get pending contacts:", error);
      res.status(500).json({ error: "Failed to retrieve pending contacts" });
    }
  });
  app.get("/api/crm/pending-contacts/:id", async (req: any, res) => {
    try {
      const pendingContact = await storage.getPendingContact(req.params.id);
      if (!pendingContact) {
        return res.status(404).json({ error: "Pending contact not found" });
      }
      res.json(pendingContact);
    } catch (error: any) {
      console.error("Failed to get pending contact:", error);
      res.status(500).json({ error: "Failed to retrieve pending contact" });
    }
  });

  app.post("/api/crm/pending-contacts", async (req: any, res) => {
    try {
      const { firstName, lastName, email, phone, position, companyId, linkedPropertyIds } = req.body;
      
      if (!firstName && !lastName && !email) {
        return res.status(400).json({ error: "At least one of firstName, lastName, or email is required" });
      }

      const pendingContact = await storage.createPendingContact({
        orgId: req.user.orgId,
        sourceType: 'company_form',
        sourceId: companyId || null,
        firstName: firstName || null,
        lastName: lastName || null,
        fullName: firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || null),
        email: email || null,
        phone: phone || null,
        jobTitle: position || null,
        companyId: companyId || null,
        status: 'pending',
        sourceMetadata: {
          linkedPropertyIds: linkedPropertyIds || [],
          createdFromCompanyForm: true,
        },
        createdBy: req.user.id,
      });

      res.json(pendingContact);
    } catch (error: any) {
      console.error("Failed to create pending contact:", error);
      res.status(500).json({ error: "Failed to create pending contact" });
    }
  });

  app.post("/api/crm/pending-contacts/bulk/accept", async (req: any, res) => {
    try {
      const { ids, mode = 'add_new' } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      const results = { accepted: 0, failed: 0 };
      for (const id of ids) {
        try {
          await storage.acceptPendingContact(id, req.user.id, mode);
          results.accepted++;
        } catch { results.failed++; }
      }
      res.json(results);
    } catch (error: any) {
      console.error("Failed to bulk accept pending contacts:", error);
      res.status(500).json({ error: "Failed to bulk accept pending contacts" });
    }
  });

  app.post("/api/crm/pending-contacts/bulk/reject", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      const results = { rejected: 0, failed: 0 };
      for (const id of ids) {
        try {
          await storage.rejectPendingContact(id, req.user.id);
          results.rejected++;
        } catch { results.failed++; }
      }
      res.json(results);
    } catch (error: any) {
      console.error("Failed to bulk reject pending contacts:", error);
      res.status(500).json({ error: "Failed to bulk reject pending contacts" });
    }
  });

  app.post("/api/crm/pending-contacts/:id/accept", async (req: any, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['replace', 'add_new'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'replace' or 'add_new'" });
      }
      const contact = await storage.acceptPendingContact(req.params.id, req.user.id, mode);
      res.json(contact);
    } catch (error: any) {
      console.error("Failed to accept pending contact:", error);
      res.status(500).json({ error: "Failed to accept pending contact" });
    }
  });

  app.post("/api/crm/pending-contacts/:id/reject", async (req: any, res) => {
    try {
      await storage.rejectPendingContact(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to reject pending contact:", error);
      res.status(500).json({ error: "Failed to reject pending contact" });
    }
  });

  // CRM Pending Companies
  app.get("/api/crm/pending-companies", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const pendingCompanies = await storage.getPendingCompaniesForOrg(orgId);

      const allCompanies = await storage.getCrmCompaniesForOrg(orgId);

      const enrichedPending = pendingCompanies.map((pending: any) => {
        if (!pending.name) return pending;

        const duplicates = findCompanyDuplicates(
          pending.name,
          pending.address,
          pending.city,
          pending.state,
          pending.zipCode,
          allCompanies,
          undefined,
          40
        );

        return {
          ...pending,
          suggestedDuplicates: duplicates.map(d => d.company.id),
          duplicateMatches: duplicates,
        };
      });

      res.json(enrichedPending);
    } catch (error: any) {
      console.error("Failed to get pending companies:", error);
      res.status(500).json({ error: "Failed to retrieve pending companies" });
    }
  });

  app.get("/api/crm/pending-companies/:id", async (req: any, res) => {
    try {
      const pendingCompany = await storage.getPendingCompany(req.params.id);
      if (!pendingCompany) {
        return res.status(404).json({ error: "Pending company not found" });
      }
      res.json(pendingCompany);
    } catch (error: any) {
      console.error("Failed to get pending company:", error);
      res.status(500).json({ error: "Failed to retrieve pending company" });
    }
  });

  app.post("/api/crm/pending-companies", async (req: any, res) => {
    try {
      const { name, website, phone, address, city, state, zipCode, industry } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Company name is required" });
      }

      const pendingCompany = await storage.createPendingCompany({
        orgId: req.user.orgId,
        sourceType: 'prospecting',
        sourceId: null,
        name,
        website: website || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        industry: industry || null,
        status: 'pending',
        sourceMetadata: {
          createdFromProspecting: true,
        },
        createdBy: req.user.id,
      });

      res.json(pendingCompany);
    } catch (error: any) {
      console.error("Failed to create pending company:", error);
      res.status(500).json({ error: "Failed to create pending company" });
    }
  });

  app.post("/api/crm/pending-companies/bulk/accept", async (req: any, res) => {
    try {
      const { ids, mode = 'add_new' } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      const results = { accepted: 0, failed: 0 };
      for (const id of ids) {
        try {
          await storage.acceptPendingCompany(id, req.user.id, mode);
          results.accepted++;
        } catch { results.failed++; }
      }
      res.json(results);
    } catch (error: any) {
      console.error("Failed to bulk accept pending companies:", error);
      res.status(500).json({ error: "Failed to bulk accept pending companies" });
    }
  });

  app.post("/api/crm/pending-companies/bulk/reject", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      const results = { rejected: 0, failed: 0 };
      for (const id of ids) {
        try {
          await storage.rejectPendingCompany(id, req.user.id);
          results.rejected++;
        } catch { results.failed++; }
      }
      res.json(results);
    } catch (error: any) {
      console.error("Failed to bulk reject pending companies:", error);
      res.status(500).json({ error: "Failed to bulk reject pending companies" });
    }
  });

  app.post("/api/crm/pending-companies/:id/accept", async (req: any, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['replace', 'add_new'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'replace' or 'add_new'" });
      }
      // Storage signature: acceptPendingCompany(id, userId, mode)
      const company = await storage.acceptPendingCompany(req.params.id, req.user.id, mode);
      res.json(company);
    } catch (error: any) {
      console.error("Failed to accept pending company:", error);
      res.status(500).json({ error: "Failed to accept pending company" });
    }
  });

  app.post("/api/crm/pending-companies/:id/reject", async (req: any, res) => {
    try {
      await storage.rejectPendingCompany(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to reject pending company:", error);
      res.status(500).json({ error: "Failed to reject pending company" });
    }
  });

  // CRM Pending Properties
  app.get("/api/crm/pending-properties", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const pendingProperties = await storage.getPendingProperties(orgId, 'pending');
      
      const allProperties = await storage.getCrmPropertiesForOrg(orgId);
      
      const enrichedPending = pendingProperties.map((pending: any) => {
        if (!pending.marinaName) return pending;
        
        const duplicates = findAllPotentialDuplicates(
          pending.marinaName,
          pending.city,
          pending.state,
          pending.salePrice,
          allProperties as any,
          30
        );
        
        return {
          ...pending,
          suggestedDuplicates: duplicates.map(d => d.property.id),
        };
      });
      
      res.json(enrichedPending);
    } catch (error: any) {
      console.error("Failed to get pending properties:", error);
      res.status(500).json({ error: "Failed to retrieve pending properties" });
    }
  });

  app.get("/api/crm/pending-properties/:id", async (req: any, res) => {
    try {
      const pendingProperty = await storage.getPendingProperty(req.params.id);
      if (!pendingProperty) {
        return res.status(404).json({ error: "Pending property not found" });
      }
      res.json(pendingProperty);
    } catch (error: any) {
      console.error("Failed to get pending property:", error);
      res.status(500).json({ error: "Failed to retrieve pending property" });
    }
  });

  app.post("/api/crm/pending-properties/bulk/accept", async (req: any, res) => {
    try {
      const { ids, mode = 'add_new' } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      const results = { accepted: 0, failed: 0 };
      for (const id of ids) {
        try {
          await storage.acceptPendingProperty(id, req.user.id, mode);
          results.accepted++;
        } catch { results.failed++; }
      }
      res.json(results);
    } catch (error: any) {
      console.error("Failed to bulk accept pending properties:", error);
      res.status(500).json({ error: "Failed to bulk accept pending properties" });
    }
  });

  app.post("/api/crm/pending-properties/bulk/reject", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      const results = { rejected: 0, failed: 0 };
      for (const id of ids) {
        try {
          await storage.rejectPendingProperty(id, req.user.orgId, req.user.id);
          results.rejected++;
        } catch { results.failed++; }
      }
      res.json(results);
    } catch (error: any) {
      console.error("Failed to bulk reject pending properties:", error);
      res.status(500).json({ error: "Failed to bulk reject pending properties" });
    }
  });

  app.post("/api/crm/pending-properties/:id/accept", async (req: any, res) => {
    try {
      const { mode } = req.body;
      if (!mode || !['replace', 'add_new'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'replace' or 'add_new'" });
      }
      const property = await storage.acceptPendingProperty(req.params.id, req.user.id, mode);
      res.json(property);
    } catch (error: any) {
      console.error("Failed to accept pending property:", error);
      res.status(500).json({ error: "Failed to accept pending property" });
    }
  });

  app.post("/api/crm/pending-properties/:id/reject", async (req: any, res) => {
    try {
      await storage.rejectPendingProperty(req.params.id, req.user.orgId, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to reject pending property:", error);
      res.status(500).json({ error: "Failed to reject pending property" });
    }
  });

  app.post("/api/crm/pending-properties", async (req: any, res) => {
    try {
      const { marinaName, city, state, address, companyId, ...rest } = req.body;
      
      if (!marinaName) {
        return res.status(400).json({ error: "Marina name is required" });
      }
      
      // Find potential duplicate properties
      const existingProperties = await storage.getCrmPropertiesForOrg(req.user.orgId);
      const suggestedDuplicates: string[] = [];
      
      for (const prop of existingProperties) {
        const nameMatch = prop.title?.toLowerCase().includes(marinaName.toLowerCase()) ||
                          marinaName.toLowerCase().includes(prop.title?.toLowerCase() || '');
        const cityMatch = !city || !prop.city || prop.city.toLowerCase() === city.toLowerCase();
        const stateMatch = !state || !prop.state || prop.state.toLowerCase() === state.toLowerCase();
        
        if (nameMatch && cityMatch && stateMatch) {
          suggestedDuplicates.push(prop.id);
        }
      }
      
      const pendingProperty = await storage.createPendingProperty({
        orgId: req.user.orgId,
        marinaName,
        city: city || null,
        state: state || null,
        address: address || null,
        sourceType: 'manual',
        status: 'pending',
        suggestedDuplicates,
        compMetadata: {
          ...rest,
          companyId: companyId || null,
          createdBy: req.user.id,
        },
      });
      
      res.json(pendingProperty);
    } catch (error: any) {
      console.error("Failed to create pending property:", error);
      res.status(500).json({ error: "Failed to create pending property" });
    }
  });

  // ============================================================================
  // CRM LISTS - User-defined lists for contacts, companies, properties
  // ============================================================================

  // Get all lists for org
  app.get("/api/crm/lists", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { entityType } = req.query;
      const pag = parsePagination(req.query, { pageSize: 25 });

      const { crmLists } = await import('@shared/schema');
      const { eq, and, desc, count: drizzleCountFn } = await import('drizzle-orm');

      const whereClause = entityType
        ? and(eq(crmLists.orgId, orgId), eq(crmLists.entityType, entityType))
        : eq(crmLists.orgId, orgId);

      const [{ total }] = await db.select({ total: drizzleCountFn() }).from(crmLists).where(whereClause);
      const lists = await db.select().from(crmLists).where(whereClause)
        .orderBy(desc(crmLists.updatedAt))
        .limit(pag.limit)
        .offset(pag.offset);

      res.json(paginatedResponse(lists, Number(total), pag));
    } catch (error: any) {
      console.error("Failed to get CRM lists:", error);
      res.status(500).json({ error: "Failed to retrieve lists" });
    }
  });

  // Get a single list with its members
  app.get("/api/crm/lists/:listId", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { listId } = req.params;
      
      const { crmLists, crmListMembers, crmContacts, crmCompanies, crmProperties } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const [list] = await db.select().from(crmLists)
        .where(and(eq(crmLists.id, listId), eq(crmLists.orgId, orgId)));
      
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }
      
      const members = await db.select().from(crmListMembers)
        .where(eq(crmListMembers.listId, listId));
      
      res.json({ ...list, members });
    } catch (error: any) {
      console.error("Failed to get CRM list:", error);
      res.status(500).json({ error: "Failed to retrieve list" });
    }
  });

  // Create a new list
  app.post("/api/crm/lists", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const { crmLists, insertCrmListSchema } = await import('@shared/schema');
      
      const validated = insertCrmListSchema.parse({
        ...req.body,
        orgId,
        createdBy: userId,
      });
      
      const [newList] = await db.insert(crmLists).values(validated).returning();
      res.status(201).json(newList);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error("Failed to create CRM list:", error);
      res.status(500).json({ error: "Failed to create list" });
    }
  });

  // Update a list
  app.patch("/api/crm/lists/:listId", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { listId } = req.params;
      
      const { crmLists, updateCrmListSchema } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const validated = updateCrmListSchema.parse(req.body);
      
      const [updated] = await db.update(crmLists)
        .set({ ...validated, updatedAt: new Date() })
        .where(and(eq(crmLists.id, listId), eq(crmLists.orgId, orgId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "List not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error("Failed to update CRM list:", error);
      res.status(500).json({ error: "Failed to update list" });
    }
  });

  // Delete a list
  app.delete("/api/crm/lists/:listId", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { listId } = req.params;
      
      const { crmLists } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const [deleted] = await db.delete(crmLists)
        .where(and(eq(crmLists.id, listId), eq(crmLists.orgId, orgId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "List not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete CRM list:", error);
      res.status(500).json({ error: "Failed to delete list" });
    }
  });

  // Add members to a list
  app.post("/api/crm/lists/:listId/members", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { listId } = req.params;
      const { entityIds } = req.body; // Array of entity IDs to add
      
      if (!entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
        return res.status(400).json({ error: "entityIds array is required" });
      }
      
      const { crmLists, crmListMembers } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Verify list exists and belongs to org
      const [list] = await db.select().from(crmLists)
        .where(and(eq(crmLists.id, listId), eq(crmLists.orgId, orgId)));
      
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }
      
      // Insert members (ignoring duplicates)
      const newMembers = await Promise.all(entityIds.map(async (entityId: string) => {
        try {
          const [member] = await db.insert(crmListMembers)
            .values({ listId, entityId })
            .onConflictDoNothing()
            .returning();
          return member;
        } catch {
          return null;
        }
      }));
      
      res.json({ added: newMembers.filter(Boolean).length });
    } catch (error: any) {
      console.error("Failed to add list members:", error);
      res.status(500).json({ error: "Failed to add members to list" });
    }
  });

  // Remove a member from a list
  app.delete("/api/crm/lists/:listId/members/:entityId", authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { listId, entityId } = req.params;
      
      const { crmLists, crmListMembers } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Verify list exists and belongs to org
      const [list] = await db.select().from(crmLists)
        .where(and(eq(crmLists.id, listId), eq(crmLists.orgId, orgId)));
      
      if (!list) {
        return res.status(404).json({ error: "List not found" });
      }
      
      await db.delete(crmListMembers)
        .where(and(eq(crmListMembers.listId, listId), eq(crmListMembers.entityId, entityId)));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to remove list member:", error);
      res.status(500).json({ error: "Failed to remove member from list" });
    }
  });

  // CRM Products
  app.get("/api/products", async (req: any, res) => {
    try {
      const { crmProducts } = await import("@shared/schema");
      const { count: drizzleCountFn } = await import("drizzle-orm");
      const orgId = req.user.orgId;
      const pag = parsePagination(req.query, { pageSize: 25 });

      const [{ total }] = await db.select({ total: drizzleCountFn() }).from(crmProducts)
        .where(eq(crmProducts.orgId, orgId));
      const products = await db.select().from(crmProducts)
        .where(eq(crmProducts.orgId, orgId))
        .orderBy(desc(crmProducts.createdAt))
        .limit(pag.limit)
        .offset(pag.offset);

      res.json(paginatedResponse(products, Number(total), pag));
    } catch (error: any) {
      console.error("Failed to get products:", error);
      res.status(500).json({ error: "Failed to retrieve products" });
    }
  });

  app.post("/api/products", async (req: any, res) => {
    try {
      const { crmProducts } = await import("@shared/schema");
      const [product] = await db.insert(crmProducts).values({
        ...req.body,
        ownerId: req.user.id,
        orgId: req.user.orgId,
      }).returning();
      res.json(product);
    } catch (error: any) {
      console.error("Failed to create product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", async (req: any, res) => {
    try {
      const { crmProducts } = await import("@shared/schema");
      const [existing] = await db.select().from(crmProducts)
        .where(and(eq(crmProducts.id, req.params.id), eq(crmProducts.orgId, req.user.orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }
      const [product] = await db.update(crmProducts)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(crmProducts.id, req.params.id))
        .returning();
      res.json(product);
    } catch (error: any) {
      console.error("Failed to update product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req: any, res) => {
    try {
      const { crmProducts } = await import("@shared/schema");
      const [existing] = await db.select().from(crmProducts)
        .where(and(eq(crmProducts.id, req.params.id), eq(crmProducts.orgId, req.user.orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }
      await db.delete(crmProducts).where(eq(crmProducts.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // CRM Labels
  app.get("/api/labels", async (req: any, res) => {
    try {
      const { crmContactsLabels } = await import("@shared/schema");
      const { count: drizzleCountFn } = await import("drizzle-orm");
      const orgId = req.user.orgId;
      const pag = parsePagination(req.query, { pageSize: 50 });

      const [{ total }] = await db.select({ total: drizzleCountFn() }).from(crmContactsLabels)
        .where(eq(crmContactsLabels.orgId, orgId));
      const labels = await db.select().from(crmContactsLabels)
        .where(eq(crmContactsLabels.orgId, orgId))
        .orderBy(desc(crmContactsLabels.createdAt))
        .limit(pag.limit)
        .offset(pag.offset);

      res.json(paginatedResponse(labels, Number(total), pag));
    } catch (error: any) {
      console.error("Failed to get labels:", error);
      res.status(500).json({ error: "Failed to retrieve labels" });
    }
  });

  app.post("/api/labels", async (req: any, res) => {
    try {
      const { crmContactsLabels } = await import("@shared/schema");
      const [label] = await db.insert(crmContactsLabels).values({
        ...req.body,
        createdById: req.user.id,
        orgId: req.user.orgId,
      }).returning();
      res.json(label);
    } catch (error: any) {
      console.error("Failed to create label:", error);
      res.status(500).json({ error: "Failed to create label" });
    }
  });

  app.put("/api/labels/:id", async (req: any, res) => {
    try {
      const { crmContactsLabels } = await import("@shared/schema");
      const [existing] = await db.select().from(crmContactsLabels)
        .where(and(eq(crmContactsLabels.id, req.params.id), eq(crmContactsLabels.orgId, req.user.orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Label not found" });
      }
      const [label] = await db.update(crmContactsLabels)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(crmContactsLabels.id, req.params.id))
        .returning();
      res.json(label);
    } catch (error: any) {
      console.error("Failed to update label:", error);
      res.status(500).json({ error: "Failed to update label" });
    }
  });

  app.delete("/api/labels/:id", async (req: any, res) => {
    try {
      const { crmContactsLabels } = await import("@shared/schema");
      const [existing] = await db.select().from(crmContactsLabels)
        .where(and(eq(crmContactsLabels.id, req.params.id), eq(crmContactsLabels.orgId, req.user.orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Label not found" });
      }
      await db.delete(crmContactsLabels).where(eq(crmContactsLabels.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete label:", error);
      res.status(500).json({ error: "Failed to delete label" });
    }
  });

  // CRM Forms
  app.get("/api/forms", async (req: any, res) => {
    try {
      const { crmForms } = await import("@shared/schema");
      const { count: drizzleCountFn } = await import("drizzle-orm");
      const orgId = req.user.orgId;
      const pag = parsePagination(req.query, { pageSize: 25 });

      const [{ total }] = await db.select({ total: drizzleCountFn() }).from(crmForms)
        .where(eq(crmForms.orgId, orgId));
      const forms = await db.select().from(crmForms)
        .where(eq(crmForms.orgId, orgId))
        .orderBy(desc(crmForms.createdAt))
        .limit(pag.limit)
        .offset(pag.offset);

      res.json(paginatedResponse(forms, Number(total), pag));
    } catch (error: any) {
      console.error("Failed to get forms:", error);
      res.status(500).json({ error: "Failed to retrieve forms" });
    }
  });

  app.get("/api/form-templates", async (req: any, res) => {
    try {
      res.json([
        { id: "tpl-contact", name: "Contact Form", type: "contact", description: "Basic contact information capture" },
        { id: "tpl-demo", name: "Demo Request", type: "demo_request", description: "Schedule a demo" },
        { id: "tpl-newsletter", name: "Newsletter Signup", type: "newsletter", description: "Email newsletter subscription" },
        { id: "tpl-property", name: "Property Inquiry", type: "property_inquiry", description: "Marina/property inquiry form" },
        { id: "tpl-boat", name: "Boat Inquiry", type: "boat_inquiry", description: "Boat purchase/service inquiry" },
        { id: "tpl-quote", name: "Quote Request", type: "quote_request", description: "Request a custom quote" },
        { id: "tpl-download", name: "Download Gate", type: "download", description: "Gated content download" },
      ]);
    } catch (error: any) {
      console.error("Failed to get form templates:", error);
      res.status(500).json({ error: "Failed to retrieve form templates" });
    }
  });

  app.post("/api/forms", async (req: any, res) => {
    try {
      const { crmForms } = await import("@shared/schema");
      const [form] = await db.insert(crmForms).values({
        ...req.body,
        createdById: req.user.id,
        orgId: req.user.orgId,
      }).returning();
      res.json(form);
    } catch (error: any) {
      console.error("Failed to create form:", error);
      res.status(500).json({ error: "Failed to create form" });
    }
  });

  app.put("/api/forms/:id", async (req: any, res) => {
    try {
      const { crmForms } = await import("@shared/schema");
      const [existing] = await db.select().from(crmForms)
        .where(and(eq(crmForms.id, req.params.id), eq(crmForms.orgId, req.user.orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Form not found" });
      }
      const [form] = await db.update(crmForms)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(crmForms.id, req.params.id))
        .returning();
      res.json(form);
    } catch (error: any) {
      console.error("Failed to update form:", error);
      res.status(500).json({ error: "Failed to update form" });
    }
  });

  app.delete("/api/forms/:id", async (req: any, res) => {
    try {
      const { crmForms } = await import("@shared/schema");
      const [existing] = await db.select().from(crmForms)
        .where(and(eq(crmForms.id, req.params.id), eq(crmForms.orgId, req.user.orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Form not found" });
      }
      await db.delete(crmForms).where(eq(crmForms.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete form:", error);
      res.status(500).json({ error: "Failed to delete form" });
    }
  });

  app.post("/api/forms/:id/duplicate", async (req: any, res) => {
    try {
      const { crmForms } = await import("@shared/schema");
      const [existing] = await db.select().from(crmForms)
        .where(and(eq(crmForms.id, req.params.id), eq(crmForms.orgId, req.user.orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Form not found" });
      }
      const { id, createdAt, updatedAt, submissionCount, conversionRate, ...formData } = existing;
      const [form] = await db.insert(crmForms).values({
        ...formData,
        name: req.body.name || `${existing.name} (Copy)`,
        status: 'draft',
        submissionCount: 0,
        conversionRate: '0',
        createdById: req.user.id,
        orgId: req.user.orgId,
      }).returning();
      res.json(form);
    } catch (error: any) {
      console.error("Failed to duplicate form:", error);
      res.status(500).json({ error: "Failed to duplicate form" });
    }
  });

  app.get("/api/forms/:id/submissions", async (req: any, res) => {
    try {
      const { crmFormSubmissions } = await import("@shared/schema");
      const { count: drizzleCountFn } = await import("drizzle-orm");
      const pag = parsePagination(req.query, { pageSize: 25 });
      const whereClause = and(eq(crmFormSubmissions.formId, req.params.id), eq(crmFormSubmissions.orgId, req.user.orgId));

      const [{ total }] = await db.select({ total: drizzleCountFn() }).from(crmFormSubmissions).where(whereClause);
      const submissions = await db.select().from(crmFormSubmissions)
        .where(whereClause)
        .orderBy(desc(crmFormSubmissions.createdAt))
        .limit(pag.limit)
        .offset(pag.offset);

      res.json(paginatedResponse(submissions, Number(total), pag));
    } catch (error: any) {
      console.error("Failed to get form submissions:", error);
      res.status(500).json({ error: "Failed to retrieve form submissions" });
    }
  });

  // CRM Form Fields
  app.post("/api/forms/:formId/fields", async (req: any, res) => {
    try {
      const { crmFormFields, crmForms } = await import("@shared/schema");
      const [form] = await db.select().from(crmForms)
        .where(and(eq(crmForms.id, req.params.formId), eq(crmForms.orgId, req.user.orgId)));
      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }
      const { id, createdAt, updatedAt, ...fieldData } = req.body;
      const [field] = await db.insert(crmFormFields).values({
        ...fieldData,
        formId: req.params.formId,
        orgId: req.user.orgId,
      }).returning();
      res.json(field);
    } catch (error: any) {
      console.error("Failed to create form field:", error);
      res.status(500).json({ error: "Failed to create form field" });
    }
  });

  app.put("/api/form-fields/:id", async (req: any, res) => {
    try {
      const { crmFormFields } = await import("@shared/schema");
      const [existing] = await db.select().from(crmFormFields)
        .where(and(eq(crmFormFields.id, req.params.id), eq(crmFormFields.orgId, req.user.orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Form field not found" });
      }
      const [field] = await db.update(crmFormFields)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(crmFormFields.id, req.params.id))
        .returning();
      res.json(field);
    } catch (error: any) {
      console.error("Failed to update form field:", error);
      res.status(500).json({ error: "Failed to update form field" });
    }
  });

  app.delete("/api/form-fields/:id", async (req: any, res) => {
    try {
      const { crmFormFields } = await import("@shared/schema");
      const [existing] = await db.select().from(crmFormFields)
        .where(and(eq(crmFormFields.id, req.params.id), eq(crmFormFields.orgId, req.user.orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Form field not found" });
      }
      await db.delete(crmFormFields).where(eq(crmFormFields.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete form field:", error);
      res.status(500).json({ error: "Failed to delete form field" });
    }
  });

  // CRM Pipelines
  app.get("/api/crm/pipelines", async (req: any, res) => {
    try {
      const pipelines = await storage.getCrmPipelinesForOrg(req.user.orgId);
      res.json(pipelines);
    } catch (error: any) {
      console.error("Failed to get pipelines:", error);
      res.status(500).json({ error: "Failed to retrieve pipelines" });
    }
  });

  app.post("/api/crm/pipelines", async (req: any, res) => {
    try {
      const pipeline = await storage.createCrmPipeline({ ...req.body, ownerId: req.user.id });
      res.json(pipeline);
    } catch (error: any) {
      console.error("Failed to create pipeline:", error);
      res.status(500).json({ error: "Failed to create pipeline" });
    }
  });

  app.put("/api/crm/pipelines/:id", async (req: any, res) => {
    try {
      const pipeline = await storage.updateCrmPipeline(req.params.id, req.body);
      res.json(pipeline);
    } catch (error: any) {
      console.error("Failed to update pipeline:", error);
      res.status(500).json({ error: "Failed to update pipeline" });
    }
  });

  app.delete("/api/crm/pipelines/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmPipeline(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete pipeline:", error);
      res.status(500).json({ error: "Failed to delete pipeline" });
    }
  });

  // CRM Pipeline Stages — auto-seeds default acquisition stages on first load
  app.get("/api/pipeline-stages", async (req: any, res) => {
    try {
      const orgId: string = req.user.orgId;
      let stages = await storage.getAllCrmPipelineStages(orgId);

      // Auto-seed default stages for new orgs that have no stages yet
      if (stages.length === 0) {
        // Ensure a default pipeline exists
        let pipelines = await storage.getCrmPipelinesForOrg(orgId);
        let defaultPipeline = pipelines.find((p: any) => p.isDefault) || pipelines[0];

        if (!defaultPipeline) {
          defaultPipeline = await storage.createCrmPipeline({
            name: 'Acquisitions Pipeline',
            description: 'Default deal acquisition pipeline',
            isDefault: true,
            isActive: true,
            color: '#3B82F6',
            type: 'sales',
            ownerId: req.user.id,
            orgId,
          } as any);
        }

        const DEFAULT_STAGES = [
          { name: 'Lead',             color: '#6B7280', stageOrder: 1, probability: 10,  stageType: 'active' },
          { name: 'Underwriting',     color: '#3B82F6', stageOrder: 2, probability: 25,  stageType: 'active' },
          { name: 'Submitted Offer',  color: '#F59E0B', stageOrder: 3, probability: 40,  stageType: 'active' },
          { name: 'Under LOI',        color: '#8B5CF6', stageOrder: 4, probability: 60,  stageType: 'active' },
          { name: 'Under Contract',   color: '#10B981', stageOrder: 5, probability: 80,  stageType: 'active' },
          { name: 'Closed',           color: '#22C55E', stageOrder: 6, probability: 100, stageType: 'won'    },
        ];

        for (const s of DEFAULT_STAGES) {
          await storage.createCrmPipelineStage({
            pipelineId: defaultPipeline.id,
            name: s.name,
            color: s.color,
            stageOrder: s.stageOrder,
            probability: s.probability,
            stageType: s.stageType,
            pipelineType: 'sales',
            isActive: true,
            orgId,
          } as any);
        }

        stages = await storage.getAllCrmPipelineStages(orgId);
      }

      res.json(stages);
    } catch (error: any) {
      console.error("Failed to get all pipeline stages:", error);
      res.status(500).json({ error: "Failed to retrieve pipeline stages" });
    }
  });

  app.get("/api/crm/pipelines/:pipelineId/stages", async (req: any, res) => {
    try {
      const stages = await storage.getCrmPipelineStagesByPipeline(req.params.pipelineId);
      res.json(stages);
    } catch (error: any) {
      console.error("Failed to get pipeline stages:", error);
      res.status(500).json({ error: "Failed to retrieve pipeline stages" });
    }
  });

  app.post("/api/crm/pipeline-stages", async (req: any, res) => {
    try {
      const stage = await storage.createCrmPipelineStage(req.body);
      res.json(stage);
    } catch (error: any) {
      console.error("Failed to create pipeline stage:", error);
      res.status(500).json({ error: "Failed to create pipeline stage" });
    }
  });

  app.put("/api/crm/pipeline-stages/:id", async (req: any, res) => {
    try {
      const stage = await storage.updateCrmPipelineStage(req.params.id, req.body);
      res.json(stage);
    } catch (error: any) {
      console.error("Failed to update pipeline stage:", error);
      res.status(500).json({ error: "Failed to update pipeline stage" });
    }
  });

  app.delete("/api/crm/pipeline-stages/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmPipelineStage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete pipeline stage:", error);
      res.status(500).json({ error: "Failed to delete pipeline stage" });
    }
  });

  // CRM Activities
  app.get("/api/crm/activities", async (req: any, res) => {
    try {
      const pag = parsePagination(req.query, { pageSize: 50 });
      const allActivities = await storage.getCrmActivitiesForOrg(req.user.orgId);
      const total = allActivities.length;
      const paged = allActivities.slice(pag.offset, pag.offset + pag.limit);
      res.json(paginatedResponse(paged, total, pag));
    } catch (error: any) {
      console.error("Failed to get activities:", error);
      res.status(500).json({ error: "Failed to retrieve activities" });
    }
  });

  app.post("/api/crm/activities", async (req: any, res) => {
    try {
      const activity = await storage.createCrmActivity({ ...req.body, userId: req.user.id });
      
      if (activity.entityType && activity.entityId && req.user.orgId) {
        const { associateActivity } = await import('../services/activity-association-service');
        const associations = await associateActivity(activity.id, activity.entityType, activity.entityId, req.user.orgId);
        res.json({ ...activity, associations });
      } else {
        res.json(activity);
      }
    } catch (error: any) {
      console.error("Failed to create activity:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  app.put("/api/crm/activities/:id", async (req: any, res) => {
    try {
      const activity = await storage.updateCrmActivity(req.params.id, req.body);
      res.json(activity);
    } catch (error: any) {
      console.error("Failed to update activity:", error);
      res.status(500).json({ error: "Failed to update activity" });
    }
  });

  app.delete("/api/crm/activities/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmActivity(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete activity:", error);
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });

  // CRM Notes - Cross-entity note management
  app.get("/api/crm/notes/:entityType/:entityId", async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const notes = await storage.getCrmNotesForEntity(entityType, entityId);
      res.json(notes);
    } catch (error: any) {
      console.error("Failed to get notes:", error);
      res.status(500).json({ error: "Failed to retrieve notes" });
    }
  });

  app.post("/api/crm/notes", async (req: any, res) => {
    try {
      const { content, entityType, entityId, isPinned, linkedCompanyId } = req.body;
      
      // Create note for primary entity
      const note = await storage.createCrmNote({
        content,
        entityType,
        entityId,
        isPinned: isPinned || false,
        createdById: req.user.id,
        ownerId: req.user.id,
      });
      
      // If a linked company is provided, also create note for company
      if (linkedCompanyId && entityType === "contact") {
        await storage.createCrmNote({
          content,
          entityType: "company",
          entityId: linkedCompanyId,
          isPinned: isPinned || false,
          createdById: req.user.id,
          ownerId: req.user.id,
        });
      }
      
      // If entity is company, also create note for linked contacts
      if (entityType === "company" && req.body.linkedContactIds?.length) {
        for (const contactId of req.body.linkedContactIds) {
          await storage.createCrmNote({
            content,
            entityType: "contact",
            entityId: contactId,
            isPinned: isPinned || false,
            createdById: req.user.id,
            ownerId: req.user.id,
          });
        }
      }
      
      res.json(note);
    } catch (error: any) {
      console.error("Failed to create note:", error);
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.put("/api/crm/notes/:id", async (req: any, res) => {
    try {
      const note = await storage.updateCrmNote(req.params.id, req.body);
      res.json(note);
    } catch (error: any) {
      console.error("Failed to update note:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/crm/notes/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmNote(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });
  // CRM Tasks (crm_tasks table has no org_id column — use assignee_id only)
  app.get("/api/crm/tasks", authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const { rows } = await db.execute(sql`
        SELECT * FROM crm_tasks WHERE assignee_id = ${userId}
        ORDER BY created_at DESC LIMIT 200
      `);
      res.json(rows);
    } catch (error: any) {
      console.error("Failed to get tasks:", error);
      res.status(500).json({ error: "Failed to retrieve tasks" });
    }
  });

  app.post("/api/crm/tasks", authenticateUser, async (req: any, res) => {
    try {
      const { 
        addToCalendar, 
        linkToProspecting,
        ...taskFields 
      } = req.body;

      const taskData = insertCrmTaskSchema.parse({
        ...taskFields,
        assigneeId: req.user.id,
        orgId: req.user.orgId,
      });

      const [task] = await db.insert(crmTasks).values(taskData).returning();

      // Auto-add to calendar if requested and due date exists
      if (addToCalendar && task.dueDate) {
        try {
          await db.insert(calendarEvents).values({
            title: task.title,
            description: task.description,
            startTime: task.dueDate,
            endTime: new Date(new Date(task.dueDate).getTime() + 30 * 60000), // 30 min duration
            eventType: 'task',
            entityType: task.entityType,
            entityId: task.entityId,
            relatedTaskId: task.id,
            userId: req.user.id,
            orgId: req.user.orgId,
          }).onConflictDoNothing();
          logger.info({ taskId: task.id }, "Task added to calendar");
        } catch (calError) {
          console.error("Failed to add task to calendar (non-fatal):", calError);
        }
      }

      // Log to activity timeline
      if (task.dueDate) {
        try {
          await db.insert(crmActivities).values({
            type: 'task_created',
            subject: `Task scheduled: ${task.title}`,
            description: `${task.taskType || 'Task'} due on ${new Date(task.dueDate).toLocaleDateString()}`,
            entityType: task.entityType,
            entityId: task.entityId,
            userId: req.user.id,
            orgId: req.user.orgId,
            metadata: {
              taskId: task.id,
              taskType: task.taskType,
              priority: task.priority,
              linkedToProspecting: linkToProspecting,
              addedToCalendar: addToCalendar,
            },
          }).onConflictDoNothing();
        } catch (actError) {
          console.error("Failed to log task activity (non-fatal):", actError);
        }
      }

      // Sync to prospecting if requested
      if (linkToProspecting && task.entityId) {
        try {
          await db.insert(prospectingTasks).values({
            taskId: task.id,
            entityType: task.entityType,
            entityId: task.entityId,
            status: 'pending',
            userId: req.user.id,
            orgId: req.user.orgId,
          }).onConflictDoNothing();
        } catch (prospError) {
          console.error("Failed to sync to prospecting (non-fatal):", prospError);
        }
      }

      res.json(task);
    } catch (error: any) {
      console.error("Failed to create task:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.put("/api/crm/tasks/:id", authenticateUser, async (req: any, res) => {
    try {
      // First, verify the task exists and belongs to the user
      const existingTask = await db.query.crmTasks.findFirst({
        where: eq(crmTasks.id, req.params.id),
      });

      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (existingTask.assigneeId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized: You can only update your own tasks" });
      }

      // Parse and sanitize updates - prevent changing assigneeId
      const updates = insertCrmTaskSchema.partial().parse(req.body);
      delete (updates as any).assigneeId; // Prevent reassignment

      const [task] = await db
        .update(crmTasks)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(crmTasks.id, req.params.id))
        .returning();
      res.json(task);
    } catch (error: any) {
      console.error("Failed to update task:", error);
      // Return 400 for validation errors, 500 for other errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid task data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/crm/tasks/:id", async (req: any, res) => {
    try {
      // First, verify the task exists and belongs to the user
      const existingTask = await db.query.crmTasks.findFirst({
        where: eq(crmTasks.id, req.params.id),
      });

      if (!existingTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      if (existingTask.assigneeId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized: You can only delete your own tasks" });
      }

      await db.delete(crmTasks).where(eq(crmTasks.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // ===================================================================
  // CRM Files API Routes - File attachments for CRM entities
  // ===================================================================

  // Configure multer storage for CRM files
  const crmFileStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadPath = path.join("server/uploads/crm");
      await fs.ensureDir(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
    }
  });

  const crmFileUpload = multer({
    storage: crmFileStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow common file types
      const allowedMimes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'text/plain'
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`));
      }
    }
  });

  // Upload file
  app.post("/api/crm/files", crmFileUpload.single('file'), validateFileUpload({ maxSize: 10 * 1024 * 1024 }), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { inArray } = await import('drizzle-orm');
      const orgUserIds = db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(console.error);
        return res.status(400).json({ error: "entityType and entityId are required" });
      }

      // Verify entity exists and belongs to the user
      let entity;
      if (entityType === 'contact') {
        entity = await db.query.crmContacts.findFirst({
          where: and(eq(crmContacts.id, entityId), inArray(crmContacts.ownerId, orgUserIds)),
        });
      } else if (entityType === 'company') {
        entity = await db.query.crmCompanies.findFirst({
          where: and(eq(crmCompanies.id, entityId), inArray(crmCompanies.ownerId, orgUserIds)),
        });
      } else if (entityType === 'deal') {
        entity = await db.query.crmDeals.findFirst({
          where: and(eq(crmDeals.id, entityId), inArray(crmDeals.ownerId, orgUserIds)),
        });
      }

      if (!entity) {
        // Clean up uploaded file
        await fs.unlink(req.file.path).catch(console.error);
        return res.status(404).json({ error: `${entityType} not found or unauthorized` });
      }

      const fileData: InsertCrmFile = {
        name: req.file.originalname,
        fileName: req.file.filename,
        size: req.file.size,
        mimeType: req.file.mimetype,
        url: `/uploads/crm/${req.file.filename}`,
        entityType,
        entityId,
        uploadedById: req.user.id,
        ownerId: req.user.id,
      };

      const [file] = await db.insert(crmFiles).values(fileData).returning();
      res.json(file);
    } catch (error: any) {
      console.error("Error uploading CRM file:", error);
      // Clean up file if database insert failed
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid file data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Get files for an entity
  app.get("/api/crm/files/:entityType/:entityId", async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const orgId = req.user.orgId;
      const { inArray } = await import('drizzle-orm');
      const orgUserIds = db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));

      // Verify entity exists and belongs to the user
      let entity;
      if (entityType === 'contact') {
        entity = await db.query.crmContacts.findFirst({
          where: and(eq(crmContacts.id, entityId), inArray(crmContacts.ownerId, orgUserIds)),
        });
      } else if (entityType === 'company') {
        entity = await db.query.crmCompanies.findFirst({
          where: and(eq(crmCompanies.id, entityId), inArray(crmCompanies.ownerId, orgUserIds)),
        });
      } else if (entityType === 'deal') {
        entity = await db.query.crmDeals.findFirst({
          where: and(eq(crmDeals.id, entityId), inArray(crmDeals.ownerId, orgUserIds)),
        });
      }

      if (!entity) {
        return res.status(404).json({ error: `${entityType} not found or unauthorized` });
      }

      const files = await db.query.crmFiles.findMany({
        where: and(
          eq(crmFiles.entityType, entityType),
          eq(crmFiles.entityId, entityId),
          inArray(crmFiles.ownerId, orgUserIds)
        ),
        orderBy: [desc(crmFiles.createdAt)],
      });

      res.json(files);
    } catch (error: any) {
      console.error("Failed to retrieve files:", error);
      res.status(500).json({ error: "Failed to retrieve files" });
    }
  });

  // Download file
  app.get("/api/crm/files/:id/download", async (req: any, res) => {
    try {
      const file = await db.query.crmFiles.findFirst({
        where: and(
          eq(crmFiles.id, req.params.id),
          inArray(crmFiles.ownerId, orgUserIds)
        ),
      });

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Verify the file's entity belongs to the user
      let entity;
      if (file.entityType === 'contact') {
        entity = await db.query.crmContacts.findFirst({
          where: and(eq(crmContacts.id, file.entityId), inArray(crmContacts.ownerId, orgUserIds)),
        });
      } else if (file.entityType === 'company') {
        entity = await db.query.crmCompanies.findFirst({
          where: and(eq(crmCompanies.id, file.entityId), inArray(crmCompanies.ownerId, orgUserIds)),
        });
      } else if (file.entityType === 'deal') {
        entity = await db.query.crmDeals.findFirst({
          where: and(eq(crmDeals.id, file.entityId), inArray(crmDeals.ownerId, orgUserIds)),
        });
      }

      if (!entity) {
        return res.status(403).json({ error: "Unauthorized: Entity not found or not owned by you" });
      }

      const filePath = path.join(process.cwd(), "server/uploads/crm", file.fileName);
      
      // Check if file exists
      const fileExists = await fs.pathExists(filePath);
      if (!fileExists) {
        return res.status(404).json({ error: "File not found on disk" });
      }

      res.download(filePath, file.name);
    } catch (error: any) {
      console.error("Failed to download file:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Delete file
  app.delete("/api/crm/files/:id", async (req: any, res) => {
    try {
      const file = await db.query.crmFiles.findFirst({
        where: and(
          eq(crmFiles.id, req.params.id),
          inArray(crmFiles.ownerId, orgUserIds)
        ),
      });

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Verify the file's entity belongs to the user
      let entity;
      if (file.entityType === 'contact') {
        entity = await db.query.crmContacts.findFirst({
          where: and(eq(crmContacts.id, file.entityId), inArray(crmContacts.ownerId, orgUserIds)),
        });
      } else if (file.entityType === 'company') {
        entity = await db.query.crmCompanies.findFirst({
          where: and(eq(crmCompanies.id, file.entityId), inArray(crmCompanies.ownerId, orgUserIds)),
        });
      } else if (file.entityType === 'deal') {
        entity = await db.query.crmDeals.findFirst({
          where: and(eq(crmDeals.id, file.entityId), inArray(crmDeals.ownerId, orgUserIds)),
        });
      }

      if (!entity) {
        return res.status(403).json({ error: "Unauthorized: Entity not found or not owned by you" });
      }

      // Delete from database
      await db.delete(crmFiles).where(eq(crmFiles.id, req.params.id));

      // Delete file from filesystem
      const filePath = path.join(process.cwd(), "server/uploads/crm", file.fileName);
      await fs.unlink(filePath).catch((err) => {
        console.error('Failed to delete file from disk:', err);
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // ===================================================================
  // Unified Activity Timeline - Aggregates activities, notes, and files
  // ===================================================================

  app.get("/api/crm/timeline/:entityType/:entityId", async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const orgId = req.user.orgId;
      const { inArray, or } = await import('drizzle-orm');
      const { crmActivityAssociations } = await import('@shared/schema');

      const orgUserIds = db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));

      const validTypes = ['contact', 'company', 'deal', 'property', 'lead'];
      if (!validTypes.includes(entityType)) {
        return res.status(400).json({ error: `Invalid entity type. Must be one of: ${validTypes.join(', ')}` });
      }

      let linkedCompanyIds: string[] = [];
      let linkedCompanyNames: Map<string, string> = new Map();
      if (entityType === 'contact') {
        const linkedCompanies = await storage.getContactCompanies(entityId);
        linkedCompanyIds = linkedCompanies.map(link => link.companyId);
        linkedCompanies.forEach(link => {
          if (link.company?.name) {
            linkedCompanyNames.set(link.companyId, link.company.name);
          }
        });
      }

      const associatedActivityRows = await db.select({
        activityId: crmActivityAssociations.activityId,
        isPrimary: crmActivityAssociations.isPrimary,
      }).from(crmActivityAssociations).where(
        and(
          eq(crmActivityAssociations.objectType, entityType),
          eq(crmActivityAssociations.objectId, entityId),
          eq(crmActivityAssociations.orgId, orgId)
        )
      );
      const associatedActivityIds = associatedActivityRows.map(r => r.activityId);

      let activities: any[] = [];
      if (entityType === 'contact' && linkedCompanyIds.length > 0) {
        activities = await db.query.crmActivities.findMany({
          where: and(
            or(
              and(eq(crmActivities.entityType, 'contact'), eq(crmActivities.entityId, entityId)),
              and(eq(crmActivities.entityType, 'company'), inArray(crmActivities.entityId, linkedCompanyIds)),
              ...(associatedActivityIds.length > 0 ? [inArray(crmActivities.id, associatedActivityIds)] : [])
            ),
            inArray(crmActivities.userId, orgUserIds)
          ),
          orderBy: [desc(crmActivities.createdAt)],
        });
      } else {
        const directCondition = and(eq(crmActivities.entityType, entityType), eq(crmActivities.entityId, entityId));
        const conditions = associatedActivityIds.length > 0
          ? or(directCondition, inArray(crmActivities.id, associatedActivityIds))
          : directCondition;
        
        activities = await db.query.crmActivities.findMany({
          where: and(conditions, inArray(crmActivities.userId, orgUserIds)),
          orderBy: [desc(crmActivities.createdAt)],
        });
      }

      let notes: any[] = [];
      if (entityType === 'contact' && linkedCompanyIds.length > 0) {
        notes = await db.query.crmNotes.findMany({
          where: and(
            or(
              and(eq(crmNotes.entityType, 'contact'), eq(crmNotes.entityId, entityId)),
              and(eq(crmNotes.entityType, 'company'), inArray(crmNotes.entityId, linkedCompanyIds))
            ),
            inArray(crmNotes.ownerId, orgUserIds)
          ),
          orderBy: [desc(crmNotes.createdAt)],
        });
      } else {
        notes = await db.query.crmNotes.findMany({
          where: and(
            eq(crmNotes.entityType, entityType),
            eq(crmNotes.entityId, entityId),
            inArray(crmNotes.ownerId, orgUserIds)
          ),
          orderBy: [desc(crmNotes.createdAt)],
        });
      }

      let files: any[] = [];
      if (entityType === 'contact' && linkedCompanyIds.length > 0) {
        files = await db.query.crmFiles.findMany({
          where: and(
            or(
              and(eq(crmFiles.entityType, 'contact'), eq(crmFiles.entityId, entityId)),
              and(eq(crmFiles.entityType, 'company'), inArray(crmFiles.entityId, linkedCompanyIds))
            ),
            inArray(crmFiles.ownerId, orgUserIds)
          ),
          orderBy: [desc(crmFiles.createdAt)],
        });
      } else {
        files = await db.query.crmFiles.findMany({
          where: and(
            eq(crmFiles.entityType, entityType),
            eq(crmFiles.entityId, entityId),
            inArray(crmFiles.ownerId, orgUserIds)
          ),
          orderBy: [desc(crmFiles.createdAt)],
        });
      }

      type TimelineItem = {
        id: string;
        type: 'activity' | 'note' | 'file';
        subType: string;
        title: string;
        description: string | null;
        timestamp: Date;
        metadata: Record<string, any>;
        sourceEntity?: { type: string; id: string; name?: string };
      };

      const timelineItems: TimelineItem[] = [];
      const associatedIdSet = new Set(associatedActivityIds);

      const getSourceEntity = (itemEntityType: string, itemEntityId: string, activityId?: string) => {
        if (itemEntityType !== entityType || itemEntityId !== entityId) {
          if (entityType === 'contact' && itemEntityType === 'company') {
            return {
              type: 'company',
              id: itemEntityId,
              name: linkedCompanyNames.get(itemEntityId) || 'Company'
            };
          }
          if (activityId && associatedIdSet.has(activityId)) {
            return {
              type: itemEntityType,
              id: itemEntityId,
              name: itemEntityType.charAt(0).toUpperCase() + itemEntityType.slice(1)
            };
          }
        }
        return undefined;
      };

      const seenIds = new Set<string>();
      for (const activity of activities) {
        if (seenIds.has(activity.id)) continue;
        seenIds.add(activity.id);
        timelineItems.push({
          id: activity.id,
          type: 'activity',
          subType: activity.type,
          title: activity.subject || `${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}`,
          description: activity.description,
          timestamp: activity.createdAt,
          metadata: {
            direction: activity.direction,
            duration: activity.duration,
            outcome: activity.outcome,
            status: activity.status,
            scheduledAt: activity.scheduledAt,
            completedAt: activity.completedAt,
          },
          sourceEntity: getSourceEntity(activity.entityType, activity.entityId, activity.id),
        });
      }

      for (const note of notes) {
        timelineItems.push({
          id: note.id,
          type: 'note',
          subType: note.isPinned ? 'pinned_note' : 'note',
          title: 'Note',
          description: note.content,
          timestamp: note.createdAt,
          metadata: { isPinned: note.isPinned },
          sourceEntity: getSourceEntity(note.entityType, note.entityId),
        });
      }

      for (const file of files) {
        timelineItems.push({
          id: file.id,
          type: 'file',
          subType: file.mimeType?.split('/')[0] || 'document',
          title: file.name,
          description: `File uploaded: ${file.fileName}`,
          timestamp: file.createdAt,
          metadata: {
            fileName: file.fileName,
            size: file.size,
            mimeType: file.mimeType,
            url: file.url,
          },
          sourceEntity: getSourceEntity(file.entityType, file.entityId),
        });
      }

      timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({
        items: timelineItems,
        counts: {
          activities: activities.length,
          notes: notes.length,
          files: files.length,
          total: timelineItems.length,
        },
        linkedCompanies: linkedCompanyIds.length,
        associatedActivities: associatedActivityIds.length,
      });
    } catch (error: any) {
      console.error("Failed to get unified timeline:", error);
      res.status(500).json({ error: "Failed to retrieve timeline" });
    }
  });

  // CRM Relationship Stats - Quick metrics for entity detail pages
  app.get("/api/crm/stats/:entityType/:entityId", async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const orgId = req.user.orgId;
      const { inArray } = await import('drizzle-orm');

      // Get all user IDs in this organization for org-scoped queries
      const orgUserIds = db.select({ id: users.id }).from(users).where(eq(users.orgId, orgId));

      const validTypes = ['contact', 'company', 'deal', 'property'];
      if (!validTypes.includes(entityType)) {
        return res.status(400).json({ error: `Invalid entity type. Must be one of: ${validTypes.join(', ')}` });
      }

      // Common stats for all entities (org-scoped)
      const activitiesResult = await db.query.crmActivities.findMany({
        where: and(
          eq(crmActivities.entityType, entityType),
          eq(crmActivities.entityId, entityId),
          inArray(crmActivities.userId, orgUserIds)
        ),
        orderBy: [desc(crmActivities.createdAt)],
        limit: 1,
      });

      const notesCount = await db.select({ count: sql`count(*)` })
        .from(crmNotes)
        .where(and(
          eq(crmNotes.entityType, entityType),
          eq(crmNotes.entityId, entityId),
          inArray(crmNotes.ownerId, orgUserIds)
        ));

      const filesCount = await db.select({ count: sql`count(*)` })
        .from(crmFiles)
        .where(and(
          eq(crmFiles.entityType, entityType),
          eq(crmFiles.entityId, entityId)
        ));

      const stats: Record<string, any> = {
        lastActivity: activitiesResult[0]?.createdAt || null,
        lastActivityType: activitiesResult[0]?.type || null,
        notesCount: Number(notesCount[0]?.count || 0),
        filesCount: Number(filesCount[0]?.count || 0),
      };

      // Entity-specific stats using aggregated queries
      if (entityType === 'contact') {
        // Aggregate deal stats in a single query
        const dealStats = await db.select({
          totalDeals: sql<number>`count(*)`,
          openDeals: sql<number>`count(*) filter (where stage not in ('closed_won', 'closed_lost', 'closed', 'dead_lost'))`,
          wonDeals: sql<number>`count(*) filter (where stage in ('closed_won', 'closed'))`,
          totalDealValue: sql<number>`coalesce(sum(value::numeric), 0)`,
        }).from(crmDeals).where(and(
          eq(crmDeals.primaryContactId, entityId),
          inArray(crmDeals.ownerId, orgUserIds)
        ));
        
        stats.totalDeals = Number(dealStats[0]?.totalDeals || 0);
        stats.openDeals = Number(dealStats[0]?.openDeals || 0);
        stats.wonDeals = Number(dealStats[0]?.wonDeals || 0);
        stats.totalDealValue = Number(dealStats[0]?.totalDealValue || 0);
      }

      if (entityType === 'company') {
        // Count contacts in a single query
        const contactsCount = await db.select({ count: sql`count(*)` })
          .from(crmContacts)
          .where(eq(crmContacts.companyId, entityId));
        stats.contactsCount = Number(contactsCount[0]?.count || 0);

        // Aggregate deal stats in a single query
        const dealStats = await db.select({
          totalDeals: sql<number>`count(*)`,
          openDeals: sql<number>`count(*) filter (where stage not in ('closed_won', 'closed_lost', 'closed', 'dead_lost'))`,
          totalDealValue: sql<number>`coalesce(sum(value::numeric), 0)`,
        }).from(crmDeals).where(and(
          eq(crmDeals.companyId, entityId),
          inArray(crmDeals.ownerId, orgUserIds)
        ));
        
        stats.totalDeals = Number(dealStats[0]?.totalDeals || 0);
        stats.openDeals = Number(dealStats[0]?.openDeals || 0);
        stats.totalDealValue = Number(dealStats[0]?.totalDealValue || 0);
      }

      if (entityType === 'deal') {
        // Aggregate task stats in a single query
        const taskStats = await db.select({
          totalTasks: sql<number>`count(*)`,
          openTasks: sql<number>`count(*) filter (where completed = false)`,
          overdueTasks: sql<number>`count(*) filter (where completed = false and due_date < now())`,
        }).from(crmTasks).where(eq(crmTasks.dealId, entityId));
        
        stats.totalTasks = Number(taskStats[0]?.totalTasks || 0);
        stats.openTasks = Number(taskStats[0]?.openTasks || 0);
        stats.overdueTasks = Number(taskStats[0]?.overdueTasks || 0);

        // Get the deal for additional metrics
        const deal = await storage.getCrmDeal(entityId);
        if (deal?.currentStageEnteredAt) {
          const daysInStage = Math.floor((Date.now() - new Date(deal.currentStageEnteredAt).getTime()) / (1000 * 60 * 60 * 24));
          stats.daysInCurrentStage = daysInStage;
        }
      }

      res.json(stats);
    } catch (error: any) {
      console.error("Failed to get relationship stats:", error);
      res.status(500).json({ error: "Failed to retrieve stats" });
    }
  });

  // ===================================================================
  // CRM Import System - CSV Import for Contacts
  // ===================================================================

  // Create import job - Upload CSV and auto-detect mappings
  app.post("/api/crm/imports", async (req: any, res) => {
    try {
      const { fileName, csvContent, entityType = 'contacts' } = req.body;

      if (!csvContent || !fileName) {
        return res.status(400).json({ error: "CSV content and file name are required" });
      }

      // Parse CSV
      const parsed = CSVImportService.parseCSV(csvContent);
      
      // Auto-detect field mappings based on entity type
      const fieldMappingsArray = CSVImportService.autoDetectMappings(parsed.headers, entityType);
      
      // Convert array to record for frontend
      const fieldMappingsRecord: Record<string, string> = {};
      for (const mapping of fieldMappingsArray) {
        fieldMappingsRecord[mapping.csvColumn] = mapping.crmField;
      }

      // Create import job
      const importJob = await storage.createImportJob({
        fileName,
        fileSize: csvContent.length,
        totalRows: parsed.totalRows,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        duplicatesFound: 0,
        importType: entityType,
        fieldMappings: fieldMappingsArray,
        duplicateStrategy: 'skip',
        status: 'pending',
        currentStep: 'upload_complete',
        progress: 0,
        errorLog: [],
        validationWarnings: [],
        importSummary: {},
        csvData: parsed.rows,
        originalHeaders: parsed.headers,
        canRollback: true,
        ownerId: req.user.id,
      });

      res.json({
        importJob,
        preview: {
          headers: parsed.headers,
          totalRows: parsed.totalRows,
          mappings: fieldMappingsRecord,
        },
      });
    } catch (error: any) {
      console.error("Failed to create import job:", error);
      res.status(500).json({ error: error.message || "Failed to create import job" });
    }
  });

  // Get import job details
  app.get("/api/crm/imports/:id", async (req: any, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      
      if (!importJob) {
        return res.status(404).json({ error: "Import job not found" });
      }

      if (importJob.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(importJob);
    } catch (error: any) {
      console.error("Failed to get import job:", error);
      res.status(500).json({ error: "Failed to retrieve import job" });
    }
  });

  // List all import jobs for user
  app.get("/api/crm/imports", async (req: any, res) => {
    try {
      const importJobs = await storage.getImportJobsForOrg(req.user.id);
      res.json(importJobs);
    } catch (error: any) {
      console.error("Failed to get import jobs:", error);
      res.status(500).json({ error: "Failed to retrieve import jobs" });
    }
  });

  // Generate preview with duplicate detection
  app.post("/api/crm/imports/:id/preview", async (req: any, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      
      if (!importJob) {
        return res.status(404).json({ error: "Import job not found" });
      }

      if (importJob.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { fieldMappings: fieldMappingsFromReq } = req.body;
      
      // Convert field mappings from record to array if provided
      let mappingsArray = importJob.fieldMappings as any[];
      if (fieldMappingsFromReq) {
        mappingsArray = Object.entries(fieldMappingsFromReq).map(([csvColumn, crmField]) => ({
          csvColumn,
          crmField,
        }));
        await storage.updateImportJob(req.params.id, { fieldMappings: mappingsArray });
      }

      const csvData = importJob.csvData as any[];
      const previewRows = csvData.slice(0, 50);

      // Process preview rows with duplicate detection
      const previewResults = await Promise.all(
        previewRows.map(async (row: any, index: number) => {
          const transformedContact = CSVImportService.transformRow(row, mappingsArray);
          const duplicateResult = await DuplicateDetectionService.findDuplicates(
            transformedContact,
            req.user.id
          );

          // Validate row
          const validationIssues = CSVImportService.validateContact(transformedContact);

          return {
            rowNumber: index + 1,
            data: transformedContact,
            duplicateStatus: duplicateResult.isDuplicate
              ? duplicateResult.matches[0].confidence >= 90
                ? 'Exact'
                : 'Possible'
              : 'None',
            duplicateMatch: duplicateResult.isDuplicate ? duplicateResult.matches[0].existingContact : null,
            validationIssues,
            recommendation: duplicateResult.recommendation,
          };
        })
      );

      // Update import job with preview results
      const duplicatesCount = previewResults.filter(r => r.duplicateStatus !== 'None').length;
      const warningsCount = previewResults.filter(r => r.validationIssues.length > 0).length;

      await storage.updateImportJob(req.params.id, {
        currentStep: 'preview',
        validationWarnings: previewResults
          .filter(r => r.validationIssues.length > 0)
          .map(r => ({
            row: r.rowNumber,
            issues: r.validationIssues,
          })),
      });

      res.json({
        preview: previewResults,
        summary: {
          totalRows: previewRows.length,
          duplicates: duplicatesCount,
          warnings: warningsCount,
        },
      });
    } catch (error: any) {
      console.error("Failed to generate preview:", error);
      res.status(500).json({ error: error.message || "Failed to generate preview" });
    }
  });

  // Execute import with progress tracking
  app.post("/api/crm/imports/:id/execute", async (req: any, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      
      if (!importJob) {
        return res.status(404).json({ error: "Import job not found" });
      }

      if (importJob.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { duplicateStrategy } = req.body;

      // Update import job status
      await storage.updateImportJob(req.params.id, {
        status: 'processing',
        currentStep: 'importing',
        progress: 0,
        duplicateStrategy: duplicateStrategy || 'skip',
      });

      // Process import in batches
      const csvData = importJob.csvData as any[];
      const mappings = importJob.fieldMappings as any;
      const batchSize = 100;
      
      let successfulRows = 0;
      let failedRows = 0;
      let duplicatesFound = 0;
      const errors: any[] = [];

      for (let i = 0; i < csvData.length; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);
        
        for (let j = 0; j < batch.length; j++) {
          const rowIndex = i + j;
          const row = batch[j];
          
          try {
            // Transform row to contact data
            const contactData = CSVImportService.transformRow(row, mappings);
            
            // Check for duplicates
            const duplicateResult = await DuplicateDetectionService.findDuplicates(
              contactData,
              req.user.id
            );

            let action = 'created';
            let recordId = '';
            let wasNew = true;

            if (duplicateResult.isDuplicate) {
              duplicatesFound++;
              
              if (duplicateStrategy === 'skip') {
                // Skip duplicate
                continue;
              } else if (duplicateStrategy === 'update') {
                // Update existing record based on entity type
                const existingRecord = duplicateResult.matches[0].existingContact;
                const mergedData = DuplicateDetectionService.mergeContactData(existingRecord, contactData);
                
                let updated;
                if (importJob.importType === 'companies') {
                  updated = await storage.updateCrmCompany(existingRecord.id, mergedData);
                } else if (importJob.importType === 'properties') {
                  updated = await storage.updateProperty(existingRecord.id, mergedData);
                } else {
                  updated = await storage.updateCrmContact(existingRecord.id, mergedData);
                }
                recordId = updated.id;
                action = 'updated';
                wasNew = false;
              }
            } else {
              // Create new record based on entity type
              if (importJob.importType === 'companies') {
                const company = await storage.createCrmCompany({
                  ...contactData,
                  ownerId: req.user.id,
                });
                recordId = company.id;
              } else if (importJob.importType === 'properties') {
                const property = await storage.createProperty({
                  ...contactData,
                  ownerId: req.user.id,
                });
                recordId = property.id;
              } else {
                // Link company if provided for contacts
                if (contactData.company) {
                  const companyResult = await CompanyLinkingService.linkCompany(
                    contactData.company,
                    req.user.id
                  );
                  if (companyResult.companyId) {
                    contactData.companyId = companyResult.companyId;
                  }
                }

                // Create new contact
                const contact = await storage.createCrmContact({
                  ...contactData,
                  ownerId: req.user.id,
                });
                recordId = contact.id;
              }
            }

            // Record import
            await storage.createImportedRecord({
              importJobId: req.params.id,
              recordType: importJob.importType || 'contact',
              recordId,
              action,
              rowNumber: rowIndex + 1,
              originalData: row,
              wasNew,
              matchedBy: duplicateResult.isDuplicate ? duplicateResult.matches[0].matchedBy : null,
              validationIssues: [],
            });

            successfulRows++;
          } catch (error: any) {
            failedRows++;
            errors.push({
              row: rowIndex + 1,
              error: error.message,
            });
          }
        }

        // Update progress
        const progress = Math.floor(((i + batch.length) / csvData.length) * 100);
        await storage.updateImportJob(req.params.id, {
          progress,
          processedRows: i + batch.length,
          successfulRows,
          failedRows,
          duplicatesFound,
        });
      }

      // Finalize import
      await storage.updateImportJob(req.params.id, {
        status: failedRows === 0 ? 'completed' : 'completed_with_errors',
        currentStep: 'complete',
        progress: 100,
        processedRows: csvData.length,
        successfulRows,
        failedRows,
        duplicatesFound,
        errorLog: errors,
        completedAt: new Date(),
        importSummary: {
          totalRows: csvData.length,
          successful: successfulRows,
          failed: failedRows,
          duplicates: duplicatesFound,
          strategy: duplicateStrategy || 'skip',
        },
      });

      const updatedJob = await storage.getImportJob(req.params.id);
      
      res.json({
        success: true,
        importJob: updatedJob,
        summary: {
          totalRows: csvData.length,
          successful: successfulRows,
          failed: failedRows,
          duplicates: duplicatesFound,
        },
      });
    } catch (error: any) {
      console.error("Failed to execute import:", error);
      
      // Update job status to failed
      try {
        await storage.updateImportJob(req.params.id, {
          status: 'failed',
          errorLog: [{ message: error.message }],
        });
      } catch (updateError) {
        console.error("Failed to update import job status:", updateError);
      }
      
      res.status(500).json({ error: error.message || "Failed to execute import" });
    }
  });

  // Rollback imported records
  app.post("/api/crm/imports/:id/rollback", async (req: any, res) => {
    try {
      const importJob = await storage.getImportJob(req.params.id);
      
      if (!importJob) {
        return res.status(404).json({ error: "Import job not found" });
      }

      if (importJob.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!importJob.canRollback) {
        return res.status(400).json({ error: "Import cannot be rolled back" });
      }

      if (importJob.rolledBackAt) {
        return res.status(400).json({ error: "Import has already been rolled back" });
      }

      // Get all imported records
      const importedRecords = await storage.getImportedRecordsByJob(req.params.id);
      
      // Delete records that were created (not updated)
      for (const record of importedRecords) {
        if (record.wasNew && record.recordType === 'contact') {
          try {
            await storage.deleteCrmContact(record.recordId);
          } catch (error: any) {
            console.error(`Failed to delete contact ${record.recordId}:`, error);
          }
        }
      }

      // Mark import as rolled back
      await storage.updateImportJob(req.params.id, {
        rolledBackAt: new Date(),
        rolledBackBy: req.user.id,
        canRollback: false,
      });

      res.json({
        success: true,
        message: `Rolled back ${importedRecords.filter(r => r.wasNew).length} contacts`,
      });
    } catch (error: any) {
      console.error("Failed to rollback import:", error);
      res.status(500).json({ error: error.message || "Failed to rollback import" });
    }
  });

  // ===================================================================
  // CRM Prospecting - Weekly Activity Tracking
  // ===================================================================

  // Get all prospecting entries for a user (optionally filtered by year)
  app.get("/api/prospecting/entries", async (req: any, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year) : undefined;
      const entries = await storage.getProspectingEntriesForUser(req.user.id, year);
      res.json(entries);
    } catch (error: any) {
      console.error("Failed to get prospecting entries:", error);
      res.status(500).json({ error: "Failed to retrieve prospecting entries" });
    }
  });

  // Get dashboard stats with week-over-week changes
  app.get("/api/prospecting/dashboard-stats", async (req: any, res) => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      
      // Get all entries for the current year
      const entries = await storage.getProspectingEntriesForUser(req.user.id, currentYear);
      
      // Find current week and previous week entries
      const sortedEntries = entries.sort((a: any, b: any) => {
        if (a.year !== b.year) return b.year - a.year;
        if (a.quarter !== b.quarter) return b.quarter - a.quarter;
        return b.weekNumber - a.weekNumber;
      });
      
      // Get current week entry (most recent or current)
      const currentWeekEntry = sortedEntries[0] || null;
      const previousWeekEntry = sortedEntries[1] || null;
      
      // Calculate current week totals
      const currentCalls = currentWeekEntry?.totalCalls || 0;
      const currentEmails = currentWeekEntry?.totalEmails || 0;
      const currentLeads = currentWeekEntry?.totalLeadGeneration || 0;
      const currentMeetings = currentWeekEntry?.totalMeetings || 0;
      
      // Calculate previous week totals
      const prevCalls = previousWeekEntry?.totalCalls || 0;
      const prevEmails = previousWeekEntry?.totalEmails || 0;
      const prevLeads = previousWeekEntry?.totalLeadGeneration || 0;
      const prevMeetings = previousWeekEntry?.totalMeetings || 0;
      
      // Calculate percentage changes (handle division by zero)
      const calcChange = (current: number, prev: number) => {
        if (prev === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - prev) / prev) * 100);
      };
      
      res.json({
        callsMade: currentCalls,
        emailsSent: currentEmails,
        leadsGenerated: currentLeads,
        meetingsBooked: currentMeetings,
        callsChange: calcChange(currentCalls, prevCalls),
        emailsChange: calcChange(currentEmails, prevEmails),
        leadsChange: calcChange(currentLeads, prevLeads),
        meetingsChange: calcChange(currentMeetings, prevMeetings),
        currentWeek: currentWeekEntry ? {
          year: currentWeekEntry.year,
          quarter: currentWeekEntry.quarter,
          weekNumber: currentWeekEntry.weekNumber,
        } : null,
        previousWeek: previousWeekEntry ? {
          year: previousWeekEntry.year,
          quarter: previousWeekEntry.quarter,
          weekNumber: previousWeekEntry.weekNumber,
        } : null,
      });
    } catch (error: any) {
      console.error("Failed to get prospecting dashboard stats:", error);
      res.status(500).json({ error: "Failed to retrieve dashboard stats" });
    }
  });

  // Get a specific prospecting entry by week
  app.get("/api/prospecting/entries/:year/:quarter/:weekNumber", async (req: any, res) => {
    try {
      const year = parseInt(req.params.year);
      const quarter = parseInt(req.params.quarter);
      const weekNumber = parseInt(req.params.weekNumber);
      
      const entry = await storage.getProspectingEntryByWeek(req.user.id, year, quarter, weekNumber);
      
      if (!entry) {
        return res.status(404).json({ error: "Prospecting entry not found" });
      }
      
      res.json(entry);
    } catch (error: any) {
      console.error("Failed to get prospecting entry:", error);
      res.status(500).json({ error: "Failed to retrieve prospecting entry" });
    }
  });

  // Create or update a prospecting entry
  app.post("/api/prospecting/entries", async (req: any, res) => {
    try {
      // Import schema for validation
      // Schema already imported at top of file
      
      // Convert date strings to Date objects before validation
      const bodyData = { ...req.body };
      if (bodyData.weekStartDate && typeof bodyData.weekStartDate === 'string') {
        bodyData.weekStartDate = new Date(bodyData.weekStartDate);
      }
      if (bodyData.weekEndDate && typeof bodyData.weekEndDate === 'string') {
        bodyData.weekEndDate = new Date(bodyData.weekEndDate);
      }
      
      // Validate request body
      const validated = insertProspectingEntrySchema.parse(bodyData);
      const { year, quarter, weekNumber, userId, ...entryData } = validated;
      
      // Check if entry already exists for this week
      const existing = await storage.getProspectingEntryByWeek(req.user.id, year, quarter, weekNumber);
      
      let entry;
      if (existing) {
        // Update existing entry (never allow userId to be changed)
        entry = await storage.updateProspectingEntry(existing.id, entryData);
      } else {
        // Create new entry (always use authenticated user's ID)
        entry = await storage.createProspectingEntry({
          ...entryData,
          userId: req.user.id,
          year,
          quarter,
          weekNumber,
        });
      }
      
      res.json(entry);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid prospecting entry data", details: error.errors });
      }
      console.error("Failed to save prospecting entry:", error);
      res.status(500).json({ error: "Failed to save prospecting entry" });
    }
  });

  // Update a prospecting entry (create if doesnt exist)
  app.put("/api/prospecting/entries/:year/:quarter/:weekNumber", async (req: any, res) => {
    try {
      // Import schema for validation
      // Schema already imported at top of file
      
      const year = parseInt(req.params.year);
      const quarter = parseInt(req.params.quarter);
      const weekNumber = parseInt(req.params.weekNumber);
      
      // Check if entry exists
      const existingEntry = await storage.getProspectingEntryByWeek(req.user.id, year, quarter, weekNumber);
      
      // Convert date strings to Date objects before validation
      const bodyData = { ...req.body };
      if (bodyData.weekStartDate && typeof bodyData.weekStartDate === 'string') {
        bodyData.weekStartDate = new Date(bodyData.weekStartDate);
      }
      if (bodyData.weekEndDate && typeof bodyData.weekEndDate === 'string') {
        bodyData.weekEndDate = new Date(bodyData.weekEndDate);
      }
      
      // Validate request body
      const validated = insertProspectingEntrySchema.partial().parse(bodyData);
      
      // Strip userId to prevent reassignment attacks
      const { userId, ...updateData } = validated;
      
      let result;
      if (existingEntry) {
        // Update existing entry
        result = await storage.updateProspectingEntry(existingEntry.id, updateData);
      } else {
        // Create new entry with all required fields
        result = await storage.createProspectingEntry({
          ...updateData,
          userId: req.user.id,
          year,
          quarter,
          weekNumber,
          weekStartDate: updateData.weekStartDate || new Date(),
          weekEndDate: updateData.weekEndDate || new Date(),
        });
      }
      
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        console.error("Validation error details:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Invalid prospecting entry data", details: error.errors });
      }
      console.error("Failed to update prospecting entry:", error);
      res.status(500).json({ error: "Failed to update prospecting entry" });
    }
  });

  // Delete a prospecting entry
  app.delete("/api/prospecting/entries/:id", async (req: any, res) => {
    try {
      // First verify the entry exists and belongs to the user
      const entry = await storage.getProspectingEntry(req.params.id);
      
      if (!entry) {
        return res.status(404).json({ error: "Prospecting entry not found" });
      }
      
      // Verify entry belongs to authenticated user
      if (entry.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized to delete this prospecting entry" });
      }
      
      await storage.deleteProspectingEntry(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete prospecting entry:", error);
      res.status(500).json({ error: "Failed to delete prospecting entry" });
    }
  });

  // ===================================================================
  // ===================================================================
  // CRM Prospecting Activities (persisted daily tracking)
  // ===================================================================

  app.post("/api/prospecting/activities", async (req: any, res) => {
    try {
      const { id, createdAt, updatedAt, ...body } = req.body;
      const activity = await storage.createProspectingActivity({
        ...body,
        userId: req.user.id,
        activityDate: body.activityDate ? new Date(body.activityDate) : new Date(),
      });
      res.json(activity);
    } catch (error: any) {
      console.error("Failed to create prospecting activity:", error);
      res.status(500).json({ error: "Failed to create prospecting activity" });
    }
  });

  app.patch("/api/prospecting/activities/:id", async (req: any, res) => {
    try {
      const { activityType, outcome, dayOfWeek, activityDate: rawDate, notes, contactId, companyId, propertyId, dealId } = req.body;
      const body: any = {};
      if (activityType !== undefined) body.activityType = activityType;
      if (outcome !== undefined) body.outcome = outcome;
      if (dayOfWeek !== undefined) body.dayOfWeek = dayOfWeek;
      if (rawDate !== undefined) body.activityDate = new Date(rawDate);
      if (notes !== undefined) body.notes = notes;
      if (contactId !== undefined) body.contactId = contactId;
      if (companyId !== undefined) body.companyId = companyId;
      if (propertyId !== undefined) body.propertyId = propertyId;
      if (dealId !== undefined) body.dealId = dealId;
      const activity = await storage.updateProspectingActivity(req.params.id, body, req.user.orgId);
      res.json(activity);
    } catch (error: any) {
      console.error("Failed to update prospecting activity:", error);
      res.status(500).json({ error: "Failed to update prospecting activity" });
    }
  });

  app.get("/api/prospecting/activities", async (req: any, res) => {
    try {
      const pag = parsePagination(req.query, { pageSize: 50 });
      const filters: any = {};
      if (req.query.contactId) filters.contactId = req.query.contactId;
      if (req.query.companyId) filters.companyId = req.query.companyId;
      if (req.query.propertyId) filters.propertyId = req.query.propertyId;
      if (req.query.dealId) filters.dealId = req.query.dealId;
      if (req.query.prospectingEntryId) filters.prospectingEntryId = req.query.prospectingEntryId;
      if (req.query.userId) filters.userId = req.query.userId;
      const allActivities = await storage.getProspectingActivities(req.user.orgId, filters);
      const total = allActivities.length;
      const paged = allActivities.slice(pag.offset, pag.offset + pag.limit);
      res.json(paginatedResponse(paged, total, pag));
    } catch (error: any) {
      console.error("Failed to get prospecting activities:", error);
      res.status(500).json({ error: "Failed to retrieve prospecting activities" });
    }
  });

  app.delete("/api/prospecting/activities/:id", async (req: any, res) => {
    try {
      await storage.deleteProspectingActivity(req.params.id, req.user.orgId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete prospecting activity:", error);
      res.status(500).json({ error: "Failed to delete prospecting activity" });
    }
  });

  // CRM Prospecting Settings
  // ===================================================================

  // Get user prospecting settings (create default if doesn't exist)
  app.get("/api/prospecting/settings", async (req: any, res) => {
    try {
      let settings = await storage.getProspectingUserSettings(req.user.id);
      
      // Create default settings if they don't exist
      if (!settings) {
        settings = await storage.createProspectingUserSettings({
          userId: req.user.id,
          orgId: req.user.orgId,
          weekStartDay: 'monday'
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error("Failed to get prospecting settings:", error);
      res.status(500).json({ error: "Failed to retrieve prospecting settings" });
    }
  });

  // Update user prospecting settings
  app.put("/api/prospecting/settings", async (req: any, res) => {
    try {
      const { insertCrmProspectingUserSettingsSchema } = await import("@shared/schema");
      const validated = insertCrmProspectingUserSettingsSchema.partial().parse(req.body);
      
      // Check if settings exist
      const existing = await storage.getProspectingUserSettings(req.user.id);
      
      let settings;
      if (existing) {
        settings = await storage.updateProspectingUserSettings(req.user.id, validated);
      } else {
        settings = await storage.createProspectingUserSettings({
          ...validated,
          userId: req.user.id,
          orgId: req.user.orgId
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      console.error("Failed to update prospecting settings:", error);
      res.status(500).json({ error: "Failed to update prospecting settings" });
    }
  });

  // ===================================================================
  // CRM Prospecting Goal Templates
  // ===================================================================

  // Get all goal templates for user
  app.get("/api/prospecting/goal-templates", async (req: any, res) => {
    try {
      const templates = await storage.getProspectingGoalTemplates(req.user.id);
      res.json(templates);
    } catch (error: any) {
      console.error("Failed to get goal templates:", error);
      res.status(500).json({ error: "Failed to retrieve goal templates" });
    }
  });

  // Create a new goal template
  app.post("/api/prospecting/goal-templates", async (req: any, res) => {
    try {
      const { insertCrmProspectingGoalTemplateSchema } = await import("@shared/schema");
      const validated = insertCrmProspectingGoalTemplateSchema.parse({
        ...req.body,
        userId: req.user.id,
        orgId: req.user.orgId
      });
      
      const template = await storage.createProspectingGoalTemplate(validated);
      res.json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid goal template data", details: error.errors });
      }
      console.error("Failed to create goal template:", error);
      res.status(500).json({ error: "Failed to create goal template" });
    }
  });

  // Update a goal template
  app.put("/api/prospecting/goal-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getProspectingGoalTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: "Goal template not found" });
      }
      
      if (template.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized to update this goal template" });
      }
      
      const { insertCrmProspectingGoalTemplateSchema } = await import("@shared/schema");
      const validated = insertCrmProspectingGoalTemplateSchema.partial().parse(req.body);
      
      const updated = await storage.updateProspectingGoalTemplate(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid goal template data", details: error.errors });
      }
      console.error("Failed to update goal template:", error);
      res.status(500).json({ error: "Failed to update goal template" });
    }
  });

  // Delete a goal template
  app.delete("/api/prospecting/goal-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getProspectingGoalTemplate(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: "Goal template not found" });
      }
      
      if (template.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized to delete this goal template" });
      }
      
      await storage.deleteProspectingGoalTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete goal template:", error);
      res.status(500).json({ error: "Failed to delete goal template" });
    }
  });

  // ===================================================================
  // CRM Prospecting - Market Targets CRUD
  // ===================================================================

  app.get("/api/prospecting/market-targets", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const pag = parsePagination(req.query, { pageSize: 25 });

      const [{ total }] = await db.select({ total: drizzleCount() }).from(marketTargets)
        .where(eq(marketTargets.orgId, orgId));
      const targets = await db.select().from(marketTargets)
        .where(eq(marketTargets.orgId, orgId))
        .orderBy(desc(marketTargets.createdAt))
        .limit(pag.limit)
        .offset(pag.offset);

      res.json(paginatedResponse(targets, Number(total), pag));
    } catch (error: any) {
      console.error("Failed to get market targets:", error);
      res.status(500).json({ error: "Failed to retrieve market targets" });
    }
  });

  app.post("/api/prospecting/market-targets", async (req: any, res) => {
    try {
      const validated = insertMarketTargetSchema.parse({
        ...req.body,
        orgId: req.user.orgId,
        ownerId: req.user.id,
      });
      const [target] = await db.insert(marketTargets).values(validated).returning();
      res.json(target);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid market target data", details: error.errors });
      }
      console.error("Failed to create market target:", error);
      res.status(500).json({ error: "Failed to create market target" });
    }
  });

  app.put("/api/prospecting/market-targets/:id", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const [existing] = await db.select().from(marketTargets)
        .where(and(eq(marketTargets.id, req.params.id), eq(marketTargets.orgId, orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Market target not found" });
      }
      const { id, orgId: _orgId, ownerId, createdAt, ...updateData } = req.body;
      const [updated] = await db.update(marketTargets)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(marketTargets.id, req.params.id), eq(marketTargets.orgId, orgId)))
        .returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update market target:", error);
      res.status(500).json({ error: "Failed to update market target" });
    }
  });

  app.delete("/api/prospecting/market-targets/:id", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const [existing] = await db.select().from(marketTargets)
        .where(and(eq(marketTargets.id, req.params.id), eq(marketTargets.orgId, orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Market target not found" });
      }
      await db.delete(marketTargets)
        .where(and(eq(marketTargets.id, req.params.id), eq(marketTargets.orgId, orgId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete market target:", error);
      res.status(500).json({ error: "Failed to delete market target" });
    }
  });

  // ===================================================================
  // CRM Prospecting - Outreach Campaigns CRUD
  // ===================================================================

  app.get("/api/prospecting/campaigns", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const pag = parsePagination(req.query, { pageSize: 25 });

      const [{ total }] = await db.select({ total: drizzleCount() }).from(outreachCampaigns)
        .where(eq(outreachCampaigns.orgId, orgId));
      const campaigns = await db.select().from(outreachCampaigns)
        .where(eq(outreachCampaigns.orgId, orgId))
        .orderBy(desc(outreachCampaigns.createdAt))
        .limit(pag.limit)
        .offset(pag.offset);

      res.json(paginatedResponse(campaigns, Number(total), pag));
    } catch (error: any) {
      console.error("Failed to get outreach campaigns:", error);
      res.status(500).json({ error: "Failed to retrieve outreach campaigns" });
    }
  });

  app.post("/api/prospecting/campaigns", async (req: any, res) => {
    try {
      const validated = insertOutreachCampaignSchema.parse({
        ...req.body,
        orgId: req.user.orgId,
        ownerId: req.user.id,
      });
      const [campaign] = await db.insert(outreachCampaigns).values(validated).returning();
      res.json(campaign);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid campaign data", details: error.errors });
      }
      console.error("Failed to create outreach campaign:", error);
      res.status(500).json({ error: "Failed to create outreach campaign" });
    }
  });

  app.put("/api/prospecting/campaigns/:id", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const [existing] = await db.select().from(outreachCampaigns)
        .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const { id, orgId: _orgId, ownerId, createdAt, ...updateData } = req.body;
      const [updated] = await db.update(outreachCampaigns)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)))
        .returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update outreach campaign:", error);
      res.status(500).json({ error: "Failed to update outreach campaign" });
    }
  });

  app.delete("/api/prospecting/campaigns/:id", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const [existing] = await db.select().from(outreachCampaigns)
        .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      await db.delete(outreachCampaigns)
        .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete outreach campaign:", error);
      res.status(500).json({ error: "Failed to delete outreach campaign" });
    }
  });

  app.patch("/api/prospecting/campaigns/:id/status", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.body;
      if (!status || !["draft", "active", "paused", "completed", "archived"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      const [existing] = await db.select().from(outreachCampaigns)
        .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const updateData: any = { status, updatedAt: new Date() };
      if (status === "completed") {
        updateData.endDate = new Date().toISOString().split('T')[0];
      }
      const [updated] = await db.update(outreachCampaigns)
        .set(updateData)
        .where(and(eq(outreachCampaigns.id, req.params.id), eq(outreachCampaigns.orgId, orgId)))
        .returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update campaign status:", error);
      res.status(500).json({ error: "Failed to update campaign status" });
    }
  });

  // ===================================================================
  // CRM Prospecting - Outreach Templates CRUD
  // ===================================================================

  app.get("/api/prospecting/templates", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const pag = parsePagination(req.query, { pageSize: 25 });

      const [{ total }] = await db.select({ total: drizzleCount() }).from(outreachTemplates)
        .where(eq(outreachTemplates.orgId, orgId));
      const templates = await db.select().from(outreachTemplates)
        .where(eq(outreachTemplates.orgId, orgId))
        .orderBy(desc(outreachTemplates.createdAt))
        .limit(pag.limit)
        .offset(pag.offset);

      res.json(paginatedResponse(templates, Number(total), pag));
    } catch (error: any) {
      console.error("Failed to get outreach templates:", error);
      res.status(500).json({ error: "Failed to retrieve outreach templates" });
    }
  });

  app.post("/api/prospecting/templates", async (req: any, res) => {
    try {
      const validated = insertOutreachTemplateSchema.parse({
        ...req.body,
        orgId: req.user.orgId,
        ownerId: req.user.id,
      });
      const [template] = await db.insert(outreachTemplates).values(validated).returning();
      res.json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      console.error("Failed to create outreach template:", error);
      res.status(500).json({ error: "Failed to create outreach template" });
    }
  });

  app.put("/api/prospecting/templates/:id", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const [existing] = await db.select().from(outreachTemplates)
        .where(and(eq(outreachTemplates.id, req.params.id), eq(outreachTemplates.orgId, orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Template not found" });
      }
      const { id, orgId: _orgId, ownerId, createdAt, ...updateData } = req.body;
      const [updated] = await db.update(outreachTemplates)
        .set({ ...updateData, updatedAt: new Date() })
        .where(and(eq(outreachTemplates.id, req.params.id), eq(outreachTemplates.orgId, orgId)))
        .returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update outreach template:", error);
      res.status(500).json({ error: "Failed to update outreach template" });
    }
  });

  app.delete("/api/prospecting/templates/:id", async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const [existing] = await db.select().from(outreachTemplates)
        .where(and(eq(outreachTemplates.id, req.params.id), eq(outreachTemplates.orgId, orgId)));
      if (!existing) {
        return res.status(404).json({ error: "Template not found" });
      }
      await db.delete(outreachTemplates)
        .where(and(eq(outreachTemplates.id, req.params.id), eq(outreachTemplates.orgId, orgId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete outreach template:", error);
      res.status(500).json({ error: "Failed to delete outreach template" });
    }
  });

  // ===================================================================
  // CRM Route Aliases - Frontend Integration
  // Map /api/* routes to /api/crm/* for frontend compatibility
  // ===================================================================
  
  // Leads aliases
  app.get("/api/leads", async (req: any, res) => {
    try {
      const pag = parsePagination(req.query, { pageSize: 50 });
      const allLeads = await storage.getCrmLeadsForOrg(req.user.orgId);
      const total = allLeads.length;
      const paged = allLeads.slice(pag.offset, pag.offset + pag.limit);
      res.json(paginatedResponse(paged, total, pag));
    } catch (error: any) {
      console.error("Failed to get leads:", error);
      res.status(500).json({ error: "Failed to retrieve leads" });
    }
  });
  app.post("/api/leads", async (req: any, res) => {
    try {
      const lead = await storage.createCrmLead({ ...req.body, assignedToId: req.user.id });
      res.json(lead);
    } catch (error: any) {
      console.error("Failed to create lead:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });
  app.put("/api/leads/:id", async (req: any, res) => {
    try {
      const lead = await storage.updateCrmLead(req.params.id, req.body);
      res.json(lead);
    } catch (error: any) {
      console.error("Failed to update lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });
  app.delete("/api/leads/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmLead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete lead:", error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  app.post("/api/leads/:id/convert", async (req: any, res) => {
    try {
      const leadId = req.params.id;
      const lead = await storage.getCrmLead(leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const { dealConfig, options } = req.body || {};

      let contactId: string | null = null;
      let companyId: string | null = null;

      const existingContacts = await db.select().from(crmContacts)
        .where(and(
          eq(crmContacts.orgId, req.user.orgId),
          lead.email ? eq(crmContacts.email, lead.email) : sql`false`
        ));

      if (existingContacts.length > 0) {
        contactId = existingContacts[0].id;
      } else {
        const [newContact] = await db.insert(crmContacts).values({
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email || '',
          phone: lead.phone || undefined,
          company: lead.company || undefined,
          jobTitle: lead.jobTitle || undefined,
          ownerId: req.user.id,
          orgId: req.user.orgId,
        }).returning();
        contactId = newContact.id;
      }

      if (lead.company) {
        const existingCompanies = await db.select().from(crmCompanies)
          .where(and(
            eq(crmCompanies.orgId, req.user.orgId),
            ilike(crmCompanies.name, lead.company)
          ));

        if (existingCompanies.length > 0) {
          companyId = existingCompanies[0].id;
        } else {
          const [newCompany] = await db.insert(crmCompanies).values({
            name: lead.company,
            ownerId: req.user.id,
            orgId: req.user.orgId,
          }).returning();
          companyId = newCompany.id;
        }

        if (contactId && companyId) {
          try {
            await db.insert(crmContactCompanies).values({
              contactId,
              companyId,
              orgId: req.user.orgId,
            }).onConflictDoNothing();
          } catch (linkErr) {
            console.error("Failed to link contact to company (non-fatal):", linkErr);
          }
        }
      }

      const dealName = dealConfig?.name || `${lead.firstName} ${lead.lastName} - Deal`;
      const [deal] = await db.insert(crmDeals).values({
        title: dealName,
        value: dealConfig?.value ? String(dealConfig.value) : undefined,
        stage: dealConfig?.stage || 'qualified',
        priority: dealConfig?.priority || 'medium',
        expectedCloseDate: dealConfig?.expectedCloseDate ? new Date(dealConfig.expectedCloseDate) : undefined,
        description: dealConfig?.description || undefined,
        primaryContactId: contactId,
        companyId: companyId,
        leadId: leadId,
        leadSource: lead.leadSource || lead.originalSource || undefined,
        ownerId: req.user.id,
        orgId: req.user.orgId,
      }).returning();

      if (contactId) {
        try {
          await db.insert(crmDealContacts).values({
            dealId: deal.id,
            contactId,
            role: 'primary',
            isPrimary: true,
            orgId: req.user.orgId,
          }).onConflictDoNothing();
        } catch (linkErr) {
          console.error("Failed to link deal to contact (non-fatal):", linkErr);
        }
      }

      if (companyId) {
        try {
          await db.insert(crmDealCompanies).values({
            dealId: deal.id,
            companyId,
            role: 'primary',
            isPrimary: true,
            orgId: req.user.orgId,
          }).onConflictDoNothing();
        } catch (linkErr) {
          console.error("Failed to link deal to company (non-fatal):", linkErr);
        }
      }

      await storage.updateCrmLead(leadId, {
        leadStatus: 'converted',
        convertedContactId: contactId,
        convertedDate: new Date(),
      });

      res.json({
        success: true,
        dealId: deal.id,
        contactId,
        companyId,
        message: "Lead converted successfully",
      });
    } catch (error: any) {
      console.error("Failed to convert lead:", error);
      res.status(500).json({ error: "Failed to convert lead" });
    }
  });

  // Deals aliases
  app.get("/api/deals", async (req: any, res) => {
    try {
      const pag = parsePagination(req.query, { pageSize: 50 });
      const allDeals = await storage.getCrmDealsForOrg(req.user.orgId);
      const total = allDeals.length;
      const paged = allDeals.slice(pag.offset, pag.offset + pag.limit);
      res.json(paginatedResponse(paged, total, pag));
    } catch (error: any) {
      console.error("Failed to get deals:", error);
      res.status(500).json({ error: "Failed to retrieve deals" });
    }
  });
  app.post("/api/deals", async (req: any, res) => {
    try {
      const orgId = req.user?.orgId || req.orgId;
      const userId = req.user.id;
      const { dealContacts, depositSchedule, createDDProject, ddProjectName, ...rest } = req.body;

      // --- Resolve stageId from stage name if not already provided ---
      let resolvedStageId = rest.stageId || null;
      let resolvedPipelineId = rest.pipelineId || null;
      let resolvedProbability = rest.probability ?? null;
      const stageName = rest.stage || rest.status || 'lead';

      if (!resolvedStageId && stageName) {
        const orgStages = await storage.getAllCrmPipelineStages(orgId);
        const matched = orgStages.find(
          (s: any) => s.name.toLowerCase() === stageName.toLowerCase()
        );
        if (matched) {
          resolvedStageId = matched.id;
          resolvedPipelineId = resolvedPipelineId || matched.pipelineId;
          if (resolvedProbability === null) resolvedProbability = matched.probability ?? null;
        }
      }

      const dealData = {
        ...rest,
        title: rest.title || rest.name || '',
        stage: stageName,
        stageId: resolvedStageId,
        pipelineId: resolvedPipelineId,
        probability: resolvedProbability,
        ownerId: userId,
        orgId,
        // Normalize DD city/state fields
        city: rest.ddCity || rest.city || null,
        state: rest.ddState || rest.state || null,
        // Store deposit schedule in customDeadlines if provided
        ...(depositSchedule && depositSchedule.length > 0 ? { customDeadlines: depositSchedule } : {}),
      };

      // Remove form-only fields not in DB schema
      delete dealData.ddCity;
      delete dealData.ddState;
      delete dealData.name;

      const deal = await storage.createCrmDeal(dealData);

      // Trigger workflow automations
      evaluateAutomations('deal.created', 'deal', deal.id, orgId, deal).catch(() => {});

      // Process deal contacts — link existing CRM contacts or create pending contacts/companies
      if (dealContacts && Array.isArray(dealContacts) && dealContacts.length > 0) {
        for (const entry of dealContacts) {
          if (entry.linkedContactId) {
            await db.insert(crmDealContacts).values({
              dealId: deal.id,
              contactId: entry.linkedContactId,
              role: entry.contactType || 'other',
              isPrimary: false,
              notes: entry.titleRole || '',
            });
          } else if (entry.firstName || entry.lastName || entry.email) {
            const [pending] = await db.insert(pendingContacts).values({
              orgId,
              fullName: [entry.firstName, entry.lastName].filter(Boolean).join(' '),
              email: entry.email || null,
              phone: entry.phone || null,
              sourceType: 'deal_contact',
              sourceId: deal.id,
              sourceMetadata: {
                dealId: deal.id,
                dealTitle: deal.title,
                contactType: entry.contactType,
                teamType: entry.teamType,
                titleRole: entry.titleRole,
              },
              status: 'pending',
              createdBy: userId,
            }).returning();

            if (entry.company) {
              await db.insert(pendingCompanies).values({
                orgId,
                name: entry.company,
                sourceType: 'deal_contact',
                sourceId: deal.id,
                sourceMetadata: {
                  dealId: deal.id,
                  contactType: entry.contactType,
                  pendingContactId: pending?.id,
                },
                status: 'pending',
                createdBy: userId,
              });
            }
          }
        }
      }

      // --- Auto-create DD project if requested ---
      let ddProject: any = null;
      if (createDDProject) {
        try {
          const projectData: any = {
            name: ddProjectName || `${deal.title} — DD`,
            orgId,
            createdBy: userId,
            // Map DD fields from deal
            anchorType: deal.anchorType || 'psa',
            ddPeriodDays: deal.ddPeriodDays || null,
            hasExtensions: deal.hasExtensions || false,
            extensionCount: deal.extensionCount || 0,
            extensionDays: (deal as any).extensionDays || [],
            daysToClosing: deal.daysToClosing || null,
            tz: 'America/New_York',
            psaSignedDate: deal.psaSignedDate || null,
            ddExpirationDate: deal.ddExpirationDate || null,
            closingDate: deal.closingDate || null,
            description: deal.description || null,
            city: deal.city || null,
            state: deal.state || null,
            firstDepositAmount: deal.firstDepositAmount || null,
            firstDepositDays: deal.firstDepositDays || null,
            firstDepositDueDate: deal.firstDepositDueDate || null,
            secondDepositAmount: deal.secondDepositAmount || null,
            secondDepositDays: deal.secondDepositDays || null,
            secondDepositDueDate: deal.secondDepositDueDate || null,
            customDeadlines: (deal as any).customDeadlines || [],
            leases: (deal as any).leases || [],
          };

          ddProject = await storage.createProject(projectData);

          // Link deal to DD project
          await storage.updateCrmDeal(deal.id, { ddProjectId: ddProject.id });

          // Link entity via entity-link table
          await storage.linkEntityToDDProject({
            entityType: 'deal',
            entityId: deal.id,
            ddProjectId: ddProject.id,
            relationship: 'source',
            createdBy: userId,
            orgId,
          });
        } catch (ddErr: any) {
          console.error('[CreateDeal] Failed to auto-create DD project:', ddErr?.message);
          // Don't fail the whole deal creation if DD project fails
        }
      }

      res.json({ ...deal, ddProject });
    } catch (error: any) {
      console.error("Failed to create deal:", error);
      res.status(500).json({ error: "Failed to create deal" });
    }
  });
  app.get("/api/deals/:id", async (req: any, res) => {
    try {
      const deal = await storage.getCrmDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error: any) {
      console.error("Failed to get deal:", error);
      res.status(500).json({ error: "Failed to retrieve deal" });
    }
  });

  app.get("/api/deals/:id/workspace", async (req: any, res) => {
    try {
      const dealId = req.params.id;
      const orgId = req.user?.orgId;
      
      const deal = await storage.getCrmDeal(dealId);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      const { tasks, valuationSnapshots, vdrFolders } = await import('@shared/schema');

      let ddProject = null;
      let ddTaskSummary = null;
      if (deal.ddProjectId) {
        ddProject = await db.select().from(projects).where(eq(projects.id, deal.ddProjectId)).then(r => r[0]);
        
        if (ddProject) {
          const taskStats = await db.select({
            total: sql<number>`count(*)`,
            completed: sql<number>`sum(case when ${tasks.status} = 'complete' then 1 else 0 end)`,
            inProgress: sql<number>`sum(case when ${tasks.status} = 'in_progress' then 1 else 0 end)`,
            pending: sql<number>`sum(case when ${tasks.status} = 'pending' then 1 else 0 end)`
          }).from(tasks).where(eq(tasks.projectId, ddProject.id)).then(r => r[0]);
          
          ddTaskSummary = {
            total: Number(taskStats?.total) || 0,
            completed: Number(taskStats?.completed) || 0,
            inProgress: Number(taskStats?.inProgress) || 0,
            pending: Number(taskStats?.pending) || 0,
            percentComplete: taskStats?.total ? Math.round((Number(taskStats?.completed) / Number(taskStats?.total)) * 100) : 0
          };
        }
      }

      let modelingProject = null;
      let latestValuation = null;
      if (deal.modelingProjectId) {
        modelingProject = await db.select().from(modelingProjects).where(eq(modelingProjects.id, deal.modelingProjectId)).then(r => r[0]);
      }
      
      if (ddProject?.id && !modelingProject) {
        const mp = await db.select().from(modelingProjects).where(eq(modelingProjects.ddProjectId, ddProject.id)).then(r => r[0]);
        if (mp) modelingProject = mp;
      }
      
      if (modelingProject) {
        latestValuation = await db.select().from(valuationSnapshots)
          .where(and(
            eq(valuationSnapshots.modelingProjectId, modelingProject.id),
            orgId ? eq(valuationSnapshots.orgId, orgId) : sql`true`
          ))
          .orderBy(desc(valuationSnapshots.snapshotDate))
          .limit(1)
          .then(r => r[0]);
      }

      let vdrFolder = null;
      if (ddProject?.vdrFolderId) {
        vdrFolder = await db.select().from(vdrFolders).where(eq(vdrFolders.id, ddProject.vdrFolderId)).then(r => r[0]);
      }

      const recentActivities = await db.select().from(crmActivities)
        .where(eq(crmActivities.dealId, dealId))
        .orderBy(desc(crmActivities.createdAt))
        .limit(10);

      res.json({
        deal,
        ddProject,
        ddTaskSummary,
        modelingProject,
        latestValuation,
        vdrFolder,
        recentActivities
      });
    } catch (error: any) {
      console.error("Failed to get deal workspace:", error);
      res.status(500).json({ error: "Failed to retrieve deal workspace" });
    }
  });
  app.put("/api/deals/:id", async (req: any, res) => {
    try {
      let updateData = { ...req.body };
      
      // Auto-close deal if stage name is "Closed"
      if (updateData.stageId) {
        const stage = await storage.getCrmStage(updateData.stageId);
        if (stage && stage.name.toLowerCase() === 'closed') {
          updateData.isClosed = true;
          updateData.closedAt = new Date().toISOString();
        }
      }
      
      const deal = await storage.updateCrmDeal(req.params.id, updateData);
      res.json(deal);
    } catch (error: any) {
      console.error("Failed to update deal:", error);
      res.status(500).json({ error: "Failed to update deal" });
    }
  });
  app.delete("/api/deals/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmDeal(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });
  
  // Bulk operations for deals
  app.post("/api/deals/bulk/delete", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid ids array" });
      }
      
      await Promise.all(ids.map(id => storage.deleteCrmDeal(id)));
      res.json({ success: true, deleted: ids.length });
    } catch (error: any) {
      console.error("Failed to bulk delete deals:", error);
      res.status(500).json({ error: "Failed to bulk delete deals" });
    }
  });

  // Deal-Contact Relationships (CRE role assignments)
  app.get("/api/deals/:dealId/contacts", async (req: any, res) => {
    try {
      const contacts = await storage.getDealContacts(req.params.dealId);
      res.json(contacts);
    } catch (error: any) {
      console.error("Failed to get deal contacts:", error);
      res.status(500).json({ error: "Failed to retrieve deal contacts" });
    }
  });

  app.post("/api/deals/:dealId/contacts", async (req: any, res) => {
    try {
      const { contactId, role, isPrimary, notes } = req.body;
      if (!contactId) {
        return res.status(400).json({ error: "Contact ID is required" });
      }
      const result = await storage.addContactToDeal(req.params.dealId, contactId, role, isPrimary, notes);
      res.json(result);
    } catch (error: any) {
      console.error("Failed to add contact to deal:", error);
      res.status(500).json({ error: "Failed to add contact to deal" });
    }
  });

  app.put("/api/deals/:dealId/contacts/:linkId", async (req: any, res) => {
    try {
      const { role, isPrimary, notes } = req.body;
      const result = await storage.updateDealContact(req.params.linkId, { role, isPrimary, notes });
      res.json(result);
    } catch (error: any) {
      console.error("Failed to update deal contact:", error);
      res.status(500).json({ error: "Failed to update deal contact" });
    }
  });

  app.delete("/api/deals/:dealId/contacts/:linkId", async (req: any, res) => {
    try {
      await storage.removeContactFromDeal(req.params.linkId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to remove contact from deal:", error);
      res.status(500).json({ error: "Failed to remove contact from deal" });
    }
  });

  // Deal-Company Relationships (CRE role assignments)
  app.get("/api/deals/:dealId/companies", async (req: any, res) => {
    try {
      const companies = await storage.getDealCompanies(req.params.dealId);
      res.json(companies);
    } catch (error: any) {
      console.error("Failed to get deal companies:", error);
      res.status(500).json({ error: "Failed to retrieve deal companies" });
    }
  });

  app.post("/api/deals/:dealId/companies", async (req: any, res) => {
    try {
      const { companyId, role, isPrimary, notes } = req.body;
      if (!companyId) {
        return res.status(400).json({ error: "Company ID is required" });
      }
      const result = await storage.addCompanyToDeal(req.params.dealId, companyId, role, isPrimary, notes);
      res.json(result);
    } catch (error: any) {
      console.error("Failed to add company to deal:", error);
      res.status(500).json({ error: "Failed to add company to deal" });
    }
  });

  app.put("/api/deals/:dealId/companies/:linkId", async (req: any, res) => {
    try {
      const { role, isPrimary, notes } = req.body;
      const result = await storage.updateDealCompany(req.params.linkId, { role, isPrimary, notes });
      res.json(result);
    } catch (error: any) {
      console.error("Failed to update deal company:", error);
      res.status(500).json({ error: "Failed to update deal company" });
    }
  });

  app.delete("/api/deals/:dealId/companies/:linkId", async (req: any, res) => {
    try {
      await storage.removeCompanyFromDeal(req.params.linkId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to remove company from deal:", error);
      res.status(500).json({ error: "Failed to remove company from deal" });
    }
  });

  // Stage Task Templates - Auto-create DD tasks when deal enters a stage
  app.post("/api/deals/:dealId/apply-stage-templates", async (req: any, res) => {
    try {
      const { stageId, projectId } = req.body;
      
      if (!stageId) {
        return res.status(400).json({ error: "Stage ID is required" });
      }
      
      const stage = await storage.getCrmStage(stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      
      const taskTemplates = (stage as any).taskTemplates || [];
      if (!Array.isArray(taskTemplates) || taskTemplates.length === 0) {
        return res.json({ success: true, message: "No task templates for this stage", tasksCreated: 0 });
      }
      
      const createdTasks = [];
      for (const template of taskTemplates) {
        if (!template.title) continue;
        
        const dueDate = template.daysFromNow 
          ? new Date(Date.now() + template.daysFromNow * 24 * 60 * 60 * 1000)
          : null;
        
        const task = await storage.createTask({
          projectId: projectId || req.params.dealId,
          name: template.title,
          description: template.description || '',
          status: 'not_started',
          priority: template.priority || 'medium',
          dueDate: dueDate,
          assigneeId: null,
          createdBy: req.user.id,
        });
        createdTasks.push(task);
      }
      
      res.json({ 
        success: true, 
        message: `Created ${createdTasks.length} tasks from stage templates`,
        tasksCreated: createdTasks.length,
        tasks: createdTasks
      });
    } catch (error: any) {
      console.error("Failed to apply stage templates:", error);
      res.status(500).json({ error: "Failed to apply stage templates" });
    }
  });

  // ─── Deal Commissions CRUD ────────────────────────────────────────────────
  // Helper: verify a deal belongs to the caller's org. Returns null if not found/unauthorized.
  async function verifyDealOwnership(dealId: string, orgId: string) {
    const [deal] = await db.select({ id: crmDeals.id, orgId: crmDeals.orgId })
      .from(crmDeals)
      .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));
    return deal ?? null;
  }

  app.get("/api/crm/deals/:dealId/commissions", async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const orgId: string = req.user.orgId;
      const deal = await verifyDealOwnership(dealId, orgId);
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      const rows = await db.select().from(dealCommissions)
        .where(eq(dealCommissions.dealId, dealId))
        .orderBy(asc(dealCommissions.createdAt));
      res.json(rows);
    } catch (error: any) {
      console.error("Failed to get commissions:", error);
      res.status(500).json({ error: "Failed to retrieve commissions" });
    }
  });

  app.post("/api/crm/deals/:dealId/commissions", async (req: any, res) => {
    try {
      const { dealId } = req.params;
      const orgId: string = req.user.orgId;
      const deal = await verifyDealOwnership(dealId, orgId);
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      // Strip tenancy fields from body — set server-side
      const { orgId: _o, dealId: _d, ...safeBody } = req.body;
      // Normalize empty strings to undefined for nullable/optional fields so FK and decimal constraints are safe
      const nullableFields = ['contactId', 'role', 'splitPercent', 'commissionAmount', 'paidAt', 'notes'];
      for (const field of nullableFields) {
        if (safeBody[field] === '') safeBody[field] = undefined;
      }
      const parsed = insertDealCommissionSchema.safeParse({ ...safeBody, dealId, orgId });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      // Verify contactId belongs to same org to prevent cross-tenant FK linkage
      if (parsed.data.contactId) {
        const [contact] = await db.select({ id: crmContacts.id }).from(crmContacts)
          .where(and(eq(crmContacts.id, parsed.data.contactId), eq(crmContacts.orgId, orgId)));
        if (!contact) return res.status(400).json({ error: "Contact not found in your organization" });
      }
      const [row] = await db.insert(dealCommissions).values(parsed.data).returning();
      res.status(201).json(row);
    } catch (error: any) {
      console.error("Failed to create commission:", error);
      res.status(500).json({ error: "Failed to create commission" });
    }
  });

  app.patch("/api/crm/deals/:dealId/commissions/:id", async (req: any, res) => {
    try {
      const { dealId, id } = req.params;
      const orgId: string = req.user.orgId;
      const deal = await verifyDealOwnership(dealId, orgId);
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      const patchSchema = insertDealCommissionSchema
        .pick({ recipientName: true, recipientType: true, role: true, splitPercent: true, commissionAmount: true, status: true, notes: true, contactId: true })
        .partial();
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      if (Object.keys(parsed.data).length === 0) return res.status(400).json({ error: "No valid fields provided" });
      // Verify contactId belongs to same org to prevent cross-tenant FK linkage
      if (parsed.data.contactId) {
        const [contact] = await db.select({ id: crmContacts.id }).from(crmContacts)
          .where(and(eq(crmContacts.id, parsed.data.contactId), eq(crmContacts.orgId, orgId)));
        if (!contact) return res.status(400).json({ error: "Contact not found in your organization" });
      }
      const updatePayload: Record<string, any> = { ...parsed.data, updatedAt: new Date() };
      if (parsed.data.status === 'paid' && !updatePayload.paidAt) {
        updatePayload.paidAt = new Date();
      }
      const [row] = await db.update(dealCommissions)
        .set(updatePayload)
        .where(and(eq(dealCommissions.id, id), eq(dealCommissions.dealId, dealId)))
        .returning();
      if (!row) return res.status(404).json({ error: "Commission not found" });
      res.json(row);
    } catch (error: any) {
      console.error("Failed to update commission:", error);
      res.status(500).json({ error: "Failed to update commission" });
    }
  });

  app.delete("/api/crm/deals/:dealId/commissions/:id", async (req: any, res) => {
    try {
      const { dealId, id } = req.params;
      const orgId: string = req.user.orgId;
      const deal = await verifyDealOwnership(dealId, orgId);
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      await db.delete(dealCommissions).where(and(eq(dealCommissions.id, id), eq(dealCommissions.dealId, dealId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete commission:", error);
      res.status(500).json({ error: "Failed to delete commission" });
    }
  });

  // Commission history by contact (for ContactRecordTabs) — org-scoped via deal join
  app.get("/api/crm/contacts/:contactId/commissions", async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const orgId: string = req.user.orgId;
      // Verify contact belongs to caller's org
      const [contact] = await db.select({ id: crmContacts.id })
        .from(crmContacts)
        .where(and(eq(crmContacts.id, contactId), eq(crmContacts.orgId, orgId)));
      if (!contact) return res.status(404).json({ error: "Contact not found" });
      const rows = await db.select({
        commission: dealCommissions,
        deal: { id: crmDeals.id, title: crmDeals.title, stage: crmDeals.stage },
      })
        .from(dealCommissions)
        .innerJoin(crmDeals, and(eq(dealCommissions.dealId, crmDeals.id), eq(crmDeals.orgId, orgId)))
        .where(eq(dealCommissions.contactId, contactId))
        .orderBy(desc(dealCommissions.createdAt));
      res.json(rows);
    } catch (error: any) {
      console.error("Failed to get contact commissions:", error);
      res.status(500).json({ error: "Failed to retrieve contact commissions" });
    }
  });

  // Get stage templates for a given stage
  app.get("/api/stages/:stageId/templates", async (req: any, res) => {
    try {
      const stage = await storage.getCrmStage(req.params.stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }
      
      res.json({
        stageId: stage.id,
        stageName: stage.name,
        taskTemplates: (stage as any).taskTemplates || [],
        requiredFields: (stage as any).requiredFields || [],
        slaWarningDays: (stage as any).slaWarningDays,
        slaMaxDays: (stage as any).slaMaxDays,
      });
    } catch (error: any) {
      console.error("Failed to get stage templates:", error);
      res.status(500).json({ error: "Failed to retrieve stage templates" });
    }
  });

  // Update stage templates
  app.put("/api/stages/:stageId/templates", async (req: any, res) => {
    try {
      const { taskTemplates, requiredFields, slaWarningDays, slaMaxDays } = req.body;
      
      const stage = await storage.updateCrmStage(req.params.stageId, {
        ...(taskTemplates !== undefined ? { taskTemplates } : {}),
        ...(requiredFields !== undefined ? { requiredFields } : {}),
        ...(slaWarningDays !== undefined ? { slaWarningDays } : {}),
        ...(slaMaxDays !== undefined ? { slaMaxDays } : {}),
      });
      
      res.json({
        stageId: stage.id,
        stageName: stage.name,
        taskTemplates: (stage as any).taskTemplates || [],
        requiredFields: (stage as any).requiredFields || [],
        slaWarningDays: (stage as any).slaWarningDays,
        slaMaxDays: (stage as any).slaMaxDays,
      });
    } catch (error: any) {
      console.error("Failed to update stage templates:", error);
      res.status(500).json({ error: "Failed to update stage templates" });
    }
  });
  
  // Contacts aliases  
  app.get("/api/contacts", async (req: any, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const search = req.query.search as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      if (page !== undefined || limit !== undefined) {
        const validatedPage = (page && page > 0 && Number.isInteger(page)) ? page : 1;
        const validatedLimit = (limit && limit > 0 && limit <= 1000 && Number.isInteger(limit)) ? limit : 50;

        if ((page !== undefined && (isNaN(page) || page < 1 || !Number.isInteger(page))) ||
            (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 1000 || !Number.isInteger(limit)))) {
          return res.status(400).json({ 
            error: "Invalid pagination parameters. Page must be a positive integer, limit must be between 1 and 1000." 
          });
        }

        const result = await storage.getCrmContactsForOrgPaginated(req.user.orgId, {
          page: validatedPage,
          limit: validatedLimit,
          search,
          sortBy,
          sortOrder
        });
        res.json(result);
      } else {
        const contacts = await storage.getCrmContactsForOrg(req.user.orgId);
        
        // Fetch primary company for each contact via junction table
        const contactsWithCompany = await Promise.all(
          contacts.map(async (contact) => {
            const companyLinks = await storage.getContactCompanies(contact.id);
            // Find primary company or use first linked company
            const primaryLink = companyLinks.find((link: any) => link.isPrimary) || companyLinks[0];
            const company = primaryLink?.company || null;
            return { ...contact, company };
          })
        );
        
        res.json(contactsWithCompany);
      }
    } catch (error: any) {
      console.error("Failed to get contacts:", error);
      res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  });

  // Check for duplicate contacts by first name and last name
  app.get("/api/contacts/check-duplicates", async (req: any, res) => {
    try {
      const { firstName, lastName } = req.query;
      
      if (!firstName || !lastName) {
        return res.json({ duplicates: [] });
      }

      const contacts = await storage.getCrmContactsForOrg(req.user.orgId);
      const duplicates = contacts.filter(c => 
        c.firstName?.toLowerCase().trim() === String(firstName).toLowerCase().trim() &&
        c.lastName?.toLowerCase().trim() === String(lastName).toLowerCase().trim()
      ).map(c => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        city: c.city,
        state: c.state
      }));

      res.json({ duplicates });
    } catch (error: any) {
      console.error("Failed to check duplicate contacts:", error);
      res.status(500).json({ error: "Failed to check duplicates" });
    }
  });
  app.post("/api/contacts", async (req: any, res) => {
    try {
      const { company, companyId, ...contactData } = req.body;
      
      // Check for duplicate email
      if (contactData.email && contactData.email.trim()) {
        const existingByEmail = await storage.findContactByEmail(req.user.orgId, contactData.email);
        if (existingByEmail) {
          return res.status(400).json({ 
            error: "A contact with this email already exists",
            field: "email",
            existingContact: {
              id: existingByEmail.id,
              name: `${existingByEmail.firstName} ${existingByEmail.lastName || ''}`.trim()
            }
          });
        }
      }
      
      // Check for duplicate phone
      if (contactData.phone && contactData.phone.trim()) {
        const existingByPhone = await storage.findContactByPhone(req.user.orgId, contactData.phone);
        if (existingByPhone) {
          return res.status(400).json({ 
            error: "A contact with this phone number already exists",
            field: "phone",
            existingContact: {
              id: existingByPhone.id,
              name: `${existingByPhone.firstName} ${existingByPhone.lastName || ''}`.trim()
            }
          });
        }
      }
      
      let linkedCompanyId = companyId || null;
      let pendingCompanyId = null;
      
      // If company name provided without companyId, check for existing companies first
      if (company && !companyId) {
        // First check for exact match
        const existingCompany = await storage.findCompanyByName(req.user.orgId, company);
        
        if (existingCompany) {
          // Exact match found - automatically link to this company
          linkedCompanyId = existingCompany.id;
        } else {
          // No exact match - check for similar companies to suggest as duplicates
          const similarCompanies = await storage.findSimilarCompanies(req.user.orgId, company);
          
          // Create pending company with suggested duplicates if any found
          const pendingCompany = await storage.createPendingCompany({
            orgId: req.user.orgId,
            sourceType: 'contact_form',
            sourceId: null,
            name: company,
            status: 'pending',
            suggestedDuplicates: similarCompanies.length > 0 ? similarCompanies.map(c => c.id) : null,
            createdBy: req.user.id,
          });
          pendingCompanyId = pendingCompany.id;
        }
      }
      
      // Create the contact
      const contact = await storage.createCrmContact({
        ...contactData,
        company,
        orgId: req.user.orgId,
        ownerId: req.user.id,
      });
      
      // If we have a companyId (either provided or found via exact match), link the contact to the company
      if (linkedCompanyId) {
        await storage.linkContactToCompany(contact.id, linkedCompanyId, contactData.role || null, true);
      }
      
      // If a pending company was created, update it with the creating contact's ID for auto-linking when accepted
      if (pendingCompanyId) {
        await storage.updatePendingCompany(pendingCompanyId, req.user.orgId, {
          sourceMetadata: { creatingContactId: contact.id, creatingContactRole: contactData.role || null }
        } as any);
      }
      
      // Workflow automation trigger — fire and forget
      evaluateAutomations('contact.created', 'contact', contact.id, req.user.orgId, contact).catch(() => {});

      res.json({ ...contact, linkedCompanyId, pendingCompanyId, exactMatchFound: !companyId && linkedCompanyId !== null });
    } catch (error: any) {
      console.error("Failed to create contact:", error);
      res.status(500).json({ error: "Failed to create contact" });
    }
  });
  app.put("/api/contacts/:id", async (req: any, res) => {
    try {
      const contact = await storage.updateCrmContact(req.params.id, req.body);
      res.json(contact);
    } catch (error: any) {
      console.error("Failed to update contact:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.get("/api/contacts/:id", async (req: any, res) => {
    try {
      const contact = await storage.getCrmContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error: any) {
      console.error("Failed to get contact:", error);
      res.status(500).json({ error: "Failed to retrieve contact" });
    }
  });
  app.delete("/api/contacts/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmContact(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete contact:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });
  
  // Bulk operations for contacts
  app.post("/api/contacts/bulk/delete", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid ids array" });
      }
      
      await Promise.all(ids.map(id => storage.deleteCrmContact(id)));
      res.json({ success: true, deleted: ids.length });
    } catch (error: any) {
      console.error("Failed to bulk delete contacts:", error);
      res.status(500).json({ error: "Failed to bulk delete contacts" });
    }
  });
  
  // Companies aliases
  app.get("/api/companies", async (req: any, res) => {
    try {
      const companies = await storage.getCrmCompaniesForOrg(req.user.orgId);
      res.json(companies);
    } catch (error: any) {
      console.error("Failed to get companies:", error);
      res.status(500).json({ error: "Failed to retrieve companies" });
    }
  });
  app.post("/api/companies", async (req: any, res) => {
    try {
      const company = await storage.createCrmCompany({ ...req.body, ownerId: req.user.id });
      res.json(company);
    } catch (error: any) {
      console.error("Failed to create company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  // Contact-Company junction CRUD
  app.post("/api/contact-companies", async (req: any, res) => {
    try {
      const { contactId, companyId, role, isPrimary } = req.body;
      const [link] = await db.insert(crmContactCompanies).values({
        contactId, companyId, role: role || null, isPrimary: isPrimary || false,
      }).returning();
      res.json(link);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to link contact to company" });
    }
  });
  app.put("/api/contact-companies/:id", async (req: any, res) => {
    try {
      const [updated] = await db.update(crmContactCompanies).set(req.body)
        .where(eq(crmContactCompanies.id, req.params.id)).returning();
      res.json(updated || { error: 'Not found' });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update link" });
    }
  });
  app.delete("/api/contact-companies/:id", async (req: any, res) => {
    try {
      await db.delete(crmContactCompanies).where(eq(crmContactCompanies.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove link" });
    }
  });

  // Company-Property junction CRUD
  app.post("/api/company-properties", async (req: any, res) => {
    try {
      const { companyId, propertyId, role } = req.body;
      const [link] = await db.insert(crmCompanyProperties).values({
        companyId, propertyId, role: role || null,
      }).returning();
      res.json(link);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to link company to property" });
    }
  });
  app.delete("/api/company-properties/:id", async (req: any, res) => {
    try {
      await db.delete(crmCompanyProperties).where(eq(crmCompanyProperties.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to remove link" });
    }
  });

  // Get companies KPI stats (for computed metrics) - Must be before :id routes
  app.get('/api/companies/kpi-stats', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Portfolio companies count
      const portfolioCompaniesResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM crm_companies
        WHERE org_id = ${orgId}
          AND is_portfolio_company = true
      `);
      const portfolioCompanies = parseInt(portfolioCompaniesResult.rows[0]?.count as string || '0');

      // Companies with active deals
      let companiesWithActiveDeals = 0;
      try {
        const activeDealsResult = await db.execute(sql`
          SELECT COUNT(DISTINCT c.id) as count
          FROM crm_companies c
          JOIN crm_deals d ON (d.buyer_company_id = c.id OR d.seller_company_id = c.id)
          WHERE c.org_id = ${orgId}
            AND d.org_id = ${orgId}
            AND d.status NOT IN ('closed_won', 'closed_lost', 'closed', 'dead_lost', 'dead')
        `);
        companiesWithActiveDeals = parseInt(activeDealsResult.rows[0]?.count as string || '0');
      } catch (e) {
        // Table might not exist or columns missing
      }

      // New this month
      const newThisMonthResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM crm_companies
        WHERE org_id = ${orgId}
          AND created_at >= date_trunc('month', CURRENT_DATE)
      `);
      
      // Companies with contacts
      let withContacts = 0;
      try {
        const withContactsResult = await db.execute(sql`
          SELECT COUNT(DISTINCT c.id) as count
          FROM crm_companies c
          JOIN crm_contacts ct ON ct.company_id = c.id
          WHERE c.org_id = ${orgId}
        `);
        withContacts = parseInt(withContactsResult.rows[0]?.count as string || '0');
      } catch (e) {
        // Column might not exist
      }
      
      // Total companies count
      const totalResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM crm_companies
        WHERE org_id = ${orgId}
      `);
      
      res.json({
        portfolioCompanies,
        companiesWithActiveDeals,
        newThisMonth: parseInt(newThisMonthResult.rows[0]?.count as string || '0'),
        withProperties: 0,
        withContacts,
        totalCompanies: parseInt(totalResult.rows[0]?.count as string || '0'),
      });
    } catch (error: any) {
      console.error('Failed to fetch company KPI stats:', error);
      res.status(500).json({ error: 'Failed to fetch company KPI stats' });
    }
  });
  app.get("/api/companies/:id", async (req: any, res) => {
    try {
      const company = await storage.getCrmCompany(req.params.id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error: any) {
      console.error("Failed to get company:", error);
      res.status(500).json({ error: "Failed to retrieve company" });
    }
  });
  app.put("/api/companies/:id", async (req: any, res) => {
    try {
      const company = await storage.updateCrmCompany(req.params.id, req.body);
      res.json(company);
    } catch (error: any) {
      console.error("Failed to update company:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  });
  app.delete("/api/companies/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmCompany(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete company:", error);
      res.status(500).json({ error: "Failed to delete company" });
    }
  });
  
  // Bulk operations for companies
  app.post("/api/companies/bulk/delete", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid ids array" });
      }
      
      await Promise.all(ids.map(id => storage.deleteCrmCompany(id)));
      res.json({ success: true, deleted: ids.length });
    } catch (error: any) {
      console.error("Failed to bulk delete companies:", error);
      res.status(500).json({ error: "Failed to bulk delete companies" });
    }
  });
  
  // Properties aliases (CRM Properties)
  app.get("/api/properties", async (req: any, res) => {
    try {
      const properties = await storage.getCrmPropertiesForOrg(req.user.orgId);
      res.json(properties);
    } catch (error: any) {
      console.error("Failed to get properties:", error);
      res.status(500).json({ error: "Failed to retrieve properties" });
    }
  });
  app.get("/api/properties/:id", async (req: any, res) => {
    try {
      const property = await storage.getCrmProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error: any) {
      console.error("Failed to get property:", error);
      res.status(500).json({ error: "Failed to retrieve property" });
    }
  });
  app.post("/api/properties", async (req: any, res) => {
    try {
      const orgId = req.user?.orgId || req.orgId;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID is required" });
      }
      const title = req.body.title || req.body.name || '';
      const propertyData = {
        ...req.body,
        title,
        type: req.body.type || req.body.propertyType || 'marina',
        status: req.body.status || 'available',
        ownerId: req.user.id,
        orgId,
      };

      if (title && !req.body.skipDuplicateCheck) {
        const existingProperties = await storage.getCrmPropertiesForOrg(orgId);
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedTitle = normalize(title);
        const incomingAddr = normalize(req.body.address || '');
        const duplicates = existingProperties.filter(p => {
          const n = normalize(p.title || '');
          if (!n || !normalizedTitle) return false;
          const nameMatch = n.includes(normalizedTitle) || normalizedTitle.includes(n);
          if (!nameMatch) return false;
          const existingAddr = normalize((p as any).address || '');
          const bothHaveAddr = incomingAddr.length > 0 && existingAddr.length > 0;
          const locationMatch = !bothHaveAddr || existingAddr.includes(incomingAddr) || incomingAddr.includes(existingAddr);
          return locationMatch;
        });
        if (duplicates.length > 0) {
          return res.status(409).json({
            error: "Potential duplicate detected",
            duplicates: duplicates.map(d => ({ id: d.id, title: d.title, address: (d as any).address, status: d.status })),
            message: `A property named "${duplicates[0].title}" already exists. Set skipDuplicateCheck=true to create anyway.`
          });
        }
      }

      const property = await storage.createCrmProperty(propertyData);
      res.json(property);
    } catch (error: any) {
      console.error("Failed to create property:", error);
      res.status(500).json({ error: "Failed to create property" });
    }
  });
  app.put("/api/properties/:id", async (req: any, res) => {
    try {
      // Ensure required fields have values if provided
      const updateData = { ...req.body };
      if ('title' in updateData && !updateData.title) updateData.title = '';
      const property = await storage.updateCrmProperty(req.params.id, updateData);
      res.json(property);
    } catch (error: any) {
      console.error("Failed to update property:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });
  app.delete("/api/properties/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmProperty(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete property:", error);
      res.status(500).json({ error: "Failed to delete property" });
    }
  });
  
  // Property Storage Types - Get all custom types for org
  app.get("/api/crm-storage-types", async (req: any, res) => {
    try {
      const orgId = req.user?.orgId || req.orgId || req.tenantId;
      const types = await storage.getCrmStorageTypes(orgId);
      res.json(types);
    } catch (error: any) {
      console.error("Failed to get storage types:", error);
      res.status(500).json({ error: "Failed to get storage types" });
    }
  });

  // Property Storage Types - Create custom type
  app.post("/api/crm-storage-types", async (req: any, res) => {
    try {
      const orgId = req.user?.orgId || req.orgId || req.tenantId;
      const userId = req.userId || 'user-1';
      const type = await storage.createCrmStorageType({
        ...req.body,
        orgId,
        createdBy: userId,
      });
      res.json(type);
    } catch (error: any) {
      console.error("Failed to create storage type:", error);
      res.status(500).json({ error: "Failed to create storage type" });
    }
  });

  // Property Storage Entries - Get entries for a property
  app.get("/api/properties/:id/storage-entries", async (req: any, res) => {
    try {
      const entries = await storage.getPropertyStorageEntries(req.params.id);
      res.json(entries);
    } catch (error: any) {
      console.error("Failed to get storage entries:", error);
      res.status(500).json({ error: "Failed to get storage entries" });
    }
  });

  // Property Storage Entries - Bulk upsert entries for a property
  app.put("/api/properties/:id/storage-entries", async (req: any, res) => {
    try {
      const orgId = req.user?.orgId || req.orgId || req.tenantId;
      const entries = await storage.bulkUpsertPropertyStorageEntries(
        req.params.id,
        orgId,
        req.body.entries || []
      );
      res.json(entries);
    } catch (error: any) {
      console.error("Failed to update storage entries:", error);
      res.status(500).json({ error: "Failed to update storage entries" });
    }
  });

  // Property Storage Entries - Delete a single entry
  app.delete("/api/property-storage-entries/:id", async (req: any, res) => {
    try {
      await storage.deletePropertyStorageEntry(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete storage entry:", error);
      res.status(500).json({ error: "Failed to delete storage entry" });
    }
  });

  // Property Cross-Module Aggregation - Get all linked data for a property
  app.get("/api/properties/:id/aggregate", async (req: any, res) => {
    try {
      const propertyId = req.params.id;
      const orgId = req.user?.orgId || req.orgId || req.tenantId;
      
      // Fetch property storage entries
      const storageEntries = await storage.getPropertyStorageEntries(propertyId);
      
      // Fetch linked sales comps
      const linkedSalesComps = await db.select({
        id: propertySalesComps.id,
        salesCompId: propertySalesComps.salesCompId,
        isPrimary: propertySalesComps.isPrimary,
        relevanceScore: propertySalesComps.relevanceScore,
        notes: propertySalesComps.notes,
        marina: salesComps.marina,
        salePrice: salesComps.salePrice,
        saleMonth: salesComps.saleMonth,
        saleYear: salesComps.saleYear,
        city: salesComps.city,
        state: salesComps.state,
        wetSlips: salesComps.wetSlips,
        dryRacks: salesComps.dryRacks,
        capRate: salesComps.capRate,
        noi: salesComps.noi,
      })
      .from(propertySalesComps)
      .innerJoin(salesComps, eq(propertySalesComps.salesCompId, salesComps.id))
      .where(eq(propertySalesComps.propertyId, propertyId));
      
      // Fetch linked rate comps
      const linkedRateComps = await db.select({
        id: propertyRateComps.id,
        rateCompId: propertyRateComps.rateCompId,
        isPrimary: propertyRateComps.isPrimary,
        notes: propertyRateComps.notes,
        marina: rateComps.marina,
        city: rateComps.city,
        state: rateComps.state,
        wetSlips: rateComps.wetSlips,
        dryRacks: rateComps.dryRacks,
        wetRateValue: rateComps.wetRateValue,
        rateType: rateComps.rateType,
        seasonality: rateComps.seasonality,
        bodyOfWater: rateComps.bodyOfWater,
      })
      .from(propertyRateComps)
      .innerJoin(rateComps, eq(propertyRateComps.rateCompId, rateComps.id))
      .where(eq(propertyRateComps.propertyId, propertyId));
      
      // Fetch linked DD projects
      const linkedProjects = await db.select()
      .from(projects)
      .where(eq(projects.propertyId, propertyId));
      
      res.json({
        storageEntries,
        linkedSalesComps,
        linkedRateComps,
        linkedProjects,
      });
    } catch (error: any) {
      console.error("Failed to get property aggregate data:", error);
      res.status(500).json({ error: "Failed to get property aggregate data" });
    }
  });
  // PATCH route for property updates (used by detail modal)
  app.patch("/api/properties/:id", async (req: any, res) => {
    try {
      // Ensure required fields have values if provided
      const updateData = { ...req.body };
      if ('title' in updateData && !updateData.title) updateData.title = '';
      const property = await storage.updateCrmProperty(req.params.id, updateData);
      res.json(property);
    } catch (error: any) {
      console.error("Failed to update property:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  // Property search autocomplete for comp linking
  app.get("/api/properties/search/autocomplete", async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { q, limit = 10 } = req.query;
      if (!q || typeof q !== 'string' || q.length < 2) {
        return res.json([]);
      }
      
      const { or, and, eq, sql } = await import('drizzle-orm');
      const searchTerm = `%${q.toLowerCase()}%`;
      
      const results = await db.select({
        id: crmProperties.id,
        title: crmProperties.title,
        address: crmProperties.address,
        type: crmProperties.type,
        status: crmProperties.status,
        coordinates: crmProperties.coordinates,
        specifications: crmProperties.specifications,
      })
      .from(crmProperties)
      .where(
        and(
          eq(crmProperties.orgId, orgId),
          or(
            sql`LOWER(${crmProperties.title}) LIKE ${searchTerm}`,
            sql`LOWER(${crmProperties.address}) LIKE ${searchTerm}`
          )
        )
      )
      .limit(parseInt(limit as string) || 10);
      
      // Parse specifications to extract city/state/zip/occupancy if available
      const formattedResults = results.map(p => {
        const specs = p.specifications as any || {};
        return {
          id: p.id,
          title: p.title,
          address: p.address,
          city: property.city || specs.city || '',
          state: property.state || specs.state || '',
          zip: property.zipCode || specs.zip || specs.zipCode || '',
          type: p.type,
          status: p.status,
          wetSlips: specs.wetSlips ?? specs.wet_slips,
          drySlips: specs.drySlips ?? specs.dry_slips,
          occupancy: specs.occupancy ?? specs.occupancyRate,
        };
      });
      
      res.json(formattedResults);
    } catch (error: any) {
      console.error("Failed to search properties:", error);
      res.status(500).json({ error: "Failed to search properties" });
    }
  });

  // Get property details formatted for rate comp auto-population
  app.get("/api/properties/:id/for-rate-comp", async (req: any, res) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const property = await storage.getCrmProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      
      const specs = (property.specifications as any) || {};
      const coords = (property.coordinates as any) || {};
      
      // Map CRM property fields to rate comp fields
      const rateCompData = {
        // Basic info
        marina: property.title,
        propertyId: property.id,
        address: property.address || '',
        city: property.city || specs.city || '',
        state: property.state || specs.state || '',
        zip: property.zipCode || specs.zip || specs.zipCode || '',
        lat: coords.lat,
        lng: coords.lng,
        
        // Physical characteristics
        wetSlips: property.wetSlips ?? specs.wetSlips ?? specs.wet_slips ?? null,
        dryRacks: property.drySlips ?? specs.dryRacks ?? specs.dry_slips ?? null,
        acres: specs.acres ?? specs.lotSize ?? null,
        occupancy: specs.occupancy ?? specs.occupancyRate ?? null,
        yearBuilt: specs.yearBuilt ?? null,
        
        // Water & Location
        waterType: specs.waterType ?? specs.water_type ?? null,
        bodyOfWater: specs.bodyOfWater ?? specs.body_of_water ?? null,
        waterBodyName: specs.waterBodyName ?? specs.waterfront ?? null,
        region: specs.region ?? null,
        coastalType: specs.coastalType ?? specs.waterType ?? null,
        
        // Storage types
        storageTypes: specs.storageTypes ?? [],
        ioBoth: specs.ioBoth ?? specs.storageType ?? null,
        
        // Profit Centers
        profitCenterStorage: specs.profitCenterStorage ?? specs.hasStorage ?? false,
        profitCenterEvents: specs.profitCenterEvents ?? specs.hasEvents ?? false,
        profitCenterService: specs.profitCenterService ?? specs.hasService ?? false,
        profitCenterThirdPartyLeases: specs.profitCenterThirdPartyLeases ?? false,
        profitCenterBoatRentals: specs.profitCenterBoatRentals ?? specs.hasBoatRentals ?? false,
        profitCenterBoatBrokerage: specs.profitCenterBoatBrokerage ?? false,
        profitCenterRvPark: specs.profitCenterRvPark ?? false,
        profitCenterFuel: specs.profitCenterFuel ?? specs.hasFuel ?? false,
        profitCenterShipStore: specs.profitCenterShipStore ?? specs.hasShipStore ?? false,
        profitCenterParts: specs.profitCenterParts ?? false,
        profitCenterBoatClub: specs.profitCenterBoatClub ?? specs.hasBoatClub ?? false,
        profitCenterBoatSales: specs.profitCenterBoatSales ?? specs.hasBoatSales ?? false,
        profitCenterFnb: specs.profitCenterFnb ?? specs.hasRestaurant ?? false,
        profitCenterHospitality: specs.profitCenterHospitality ?? specs.hasLodging ?? false,
        
        // Profit Center Operation Types
        profitCenterBoatRentalsType: specs.profitCenterBoatRentalsType ?? null,
        profitCenterBoatBrokerageType: specs.profitCenterBoatBrokerageType ?? null,
        profitCenterFuelType: specs.profitCenterFuelType ?? null,
        profitCenterShipStoreType: specs.profitCenterShipStoreType ?? null,
        profitCenterPartsType: specs.profitCenterPartsType ?? null,
        profitCenterBoatSalesType: specs.profitCenterBoatSalesType ?? null,
        profitCenterFnbType: specs.profitCenterFnbType ?? null,
        profitCenterHospitalityType: specs.profitCenterHospitalityType ?? null,
        profitCenterBoatClubType: specs.profitCenterBoatClubType ?? null,
        profitCenterBoatClubCompany: specs.profitCenterBoatClubCompany ?? null,
      };
      
      res.json(rateCompData);
    } catch (error: any) {
      console.error("Failed to get property for rate comp:", error);
      res.status(500).json({ error: "Failed to get property details" });
    }
  });

  // Property-Contact Links
  app.get("/api/properties/:id/contacts", async (req: any, res) => {
    try {
      const links = await storage.getPropertyContacts(req.params.id);
      res.json(links);
    } catch (error: any) {
      console.error("Failed to get property contacts:", error);
      res.status(500).json({ error: "Failed to retrieve property contacts" });
    }
  });

  app.post("/api/properties/:id/contacts", async (req: any, res) => {
    try {
      const { contactId, relationship, notes } = req.body;
      if (!contactId) {
        return res.status(400).json({ error: "contactId is required" });
      }
      const link = await storage.linkPropertyToContact(req.params.id, contactId, relationship, notes);
      res.json(link);
    } catch (error: any) {
      console.error("Failed to link property to contact:", error);
      res.status(500).json({ error: "Failed to link property to contact" });
    }
  });

  app.delete("/api/properties/:propertyId/contacts/:linkId", async (req: any, res) => {
    try {
      await storage.unlinkPropertyFromContact(req.params.linkId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to unlink property from contact:", error);
      res.status(500).json({ error: "Failed to unlink property from contact" });
    }
  });

  // Property-Company Links
  app.get("/api/properties/:id/companies", async (req: any, res) => {
    try {
      const links = await storage.getPropertyCompanies(req.params.id);
      res.json(links);
    } catch (error: any) {
      console.error("Failed to get property companies:", error);
      res.status(500).json({ error: "Failed to retrieve property companies" });
    }
  });

  app.post("/api/properties/:id/companies", async (req: any, res) => {
    try {
      const { companyId, relationship, notes } = req.body;
      if (!companyId) {
        return res.status(400).json({ error: "companyId is required" });
      }
      const link = await storage.linkPropertyToCompany(req.params.id, companyId, relationship, notes);
      res.json(link);
    } catch (error: any) {
      console.error("Failed to link property to company:", error);
      res.status(500).json({ error: "Failed to link property to company" });
    }
  });

  app.delete("/api/properties/:propertyId/companies/:linkId", async (req: any, res) => {
    try {
      await storage.unlinkPropertyFromCompany(req.params.linkId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to unlink property from company:", error);
      res.status(500).json({ error: "Failed to unlink property from company" });
    }
  });

  // Contact-Company Links
  app.get("/api/contacts/:id/companies", async (req: any, res) => {
    try {
      const links = await storage.getContactCompanies(req.params.id);
      res.json(links);
    } catch (error: any) {
      console.error("Failed to get contact companies:", error);
      res.status(500).json({ error: "Failed to retrieve contact companies" });
    }
  });

  // Contact-Property Links
  app.get("/api/contacts/:id/properties", async (req: any, res) => {
    try {
      const links = await storage.getContactProperties(req.params.id);
      res.json(links);
    } catch (error: any) {
      console.error("Failed to get contact properties:", error);
      res.status(500).json({ error: "Failed to retrieve contact properties" });
    }
  });

  app.delete("/api/contacts/:contactId/properties/:linkId", async (req: any, res) => {
    try {
      await storage.unlinkContactFromProperty(req.params.linkId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to unlink contact from property:", error);
      res.status(500).json({ error: "Failed to unlink contact from property" });
    }
  });

  // POST to link contact to company
  app.post("/api/contacts/:id/companies", async (req: any, res) => {
    try {
      const contactId = req.params.id;
      const { companyId, role, isPrimary } = req.body;
      if (!companyId) {
        return res.status(400).json({ error: "companyId is required" });
      }

      // Link contact to company
      await storage.linkContactToCompany(contactId, companyId, role || null, isPrimary || false);

      // AUTO-CASCADE: Link contact's properties to this company
      try {
        const contactProperties = await storage.getContactProperties(contactId);
        const existingCompanyProperties = await storage.getCompanyProperties(companyId);
        const existingPropertyIds = new Set(existingCompanyProperties.map((cp: any) => cp.propertyId || cp.property?.id));

        for (const cp of contactProperties) {
          const propertyId = cp.propertyId || cp.property?.id;
          if (propertyId && !existingPropertyIds.has(propertyId)) {
            try {
              await storage.linkPropertyToCompany(propertyId, companyId, cp.relationship || 'associated', null);
              logger.info({ propertyId, companyId, contactId }, "Auto-linked property to company via contact");
            } catch (linkError: any) {
              // Ignore duplicate key errors - property may already be linked
              if (!linkError.message?.includes('duplicate') && !linkError.code?.includes('23505')) {
                console.error(`Failed to auto-link property ${propertyId} to company:`, linkError.message);
              }
            }
          }
        }
      } catch (cascadeError) {
        console.error("Auto-cascade to company properties failed (non-fatal):", cascadeError);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to link contact to company:", error);
      res.status(500).json({ error: "Failed to link contact to company" });
    }
  });

  // POST to link contact to property
  app.post("/api/contacts/:id/properties", async (req: any, res) => {
    try {
      const contactId = req.params.id;
      const { propertyId, relationship, notes } = req.body;
      if (!propertyId) {
        return res.status(400).json({ error: "propertyId is required" });
      }

      // Link property to contact
      const link = await storage.linkPropertyToContact(propertyId, contactId, relationship, notes);

      // AUTO-CASCADE: Link this property to contact's companies
      try {
        const contactCompanies = await storage.getContactCompanies(contactId);

        for (const cc of contactCompanies) {
          const companyId = cc.companyId || cc.company?.id;
          if (companyId) {
            try {
              // Check if already linked
              const existingCompanyProperties = await storage.getCompanyProperties(companyId);
              const alreadyLinked = existingCompanyProperties.some((cp: any) => 
                (cp.propertyId || cp.property?.id) === propertyId
              );

              if (!alreadyLinked) {
                await storage.linkPropertyToCompany(propertyId, companyId, relationship || 'associated', null);
                logger.info({ propertyId, companyId, contactId }, "Auto-linked property to company via contact");
              }
            } catch (linkError: any) {
              // Ignore duplicate key errors
              if (!linkError.message?.includes('duplicate') && !linkError.code?.includes('23505')) {
                console.error(`Failed to auto-link property to company ${companyId}:`, linkError.message);
              }
            }
          }
        }
      } catch (cascadeError) {
        console.error("Auto-cascade to companies failed (non-fatal):", cascadeError);
      }

      res.json(link);
    } catch (error: any) {
      console.error("Failed to link contact to property:", error);
      res.status(500).json({ error: "Failed to link contact to property" });
    }
  });

  // DD Project Links for CRM Entities (contacts, companies, properties)
  app.get("/api/crm/:entityType/:entityId/dd-projects", async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      if (!['contact', 'company', 'property'].includes(entityType)) {
        return res.status(400).json({ error: "Invalid entity type" });
      }
      const links = await storage.getEntityDDProjectLinks(entityType, entityId);
      res.json(links);
    } catch (error: any) {
      console.error("Failed to get DD project links:", error);
      res.status(500).json({ error: "Failed to retrieve DD project links" });
    }
  });

  app.post("/api/crm/:entityType/:entityId/link-dd-project", async (req: any, res) => {
    try {
      const { entityType, entityId } = req.params;
      const { ddProjectId, relationship, notes } = req.body;

      if (!['contact', 'company', 'property'].includes(entityType)) {
        return res.status(400).json({ error: "Invalid entity type" });
      }
      if (!ddProjectId) {
        return res.status(400).json({ error: "ddProjectId is required" });
      }

      const link = await storage.linkEntityToDDProject({
        entityType,
        entityId,
        ddProjectId,
        relationship: relationship || null,
        notes: notes || null,
        createdBy: req.user?.id,
        orgId: req.user?.orgId,
      });
      res.json(link);
    } catch (error: any) {
      console.error("Failed to link entity to DD project:", error);
      res.status(500).json({ error: "Failed to link entity to DD project" });
    }
  });

  app.delete("/api/crm/:entityType/:entityId/dd-projects/:linkId", async (req: any, res) => {
    try {
      const { linkId } = req.params;
      await storage.unlinkEntityFromDDProject(linkId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to unlink entity from DD project:", error);
      res.status(500).json({ error: "Failed to unlink entity from DD project" });
    }
  });

  // Company-Contact Links
  app.get("/api/companies/:id/contacts", async (req: any, res) => {
    try {
      const links = await storage.getCompanyContacts(req.params.id);
      res.json(links);
    } catch (error: any) {
      console.error("Failed to get company contacts:", error);
      res.status(500).json({ error: "Failed to retrieve company contacts" });
    }
  });

  // Company Acquisitions - Sales Comps where this company is the buyer
  app.get("/api/companies/:id/acquisitions", async (req: any, res) => {
    try {
      const { orgId } = req.user || {};
      if (!orgId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const acquisitions = await storage.getSalesCompsByBuyerCompany(orgId, req.params.id);
      res.json(acquisitions);
    } catch (error: any) {
      console.error("Failed to get company acquisitions:", error);
      res.status(500).json({ error: "Failed to retrieve company acquisitions" });
    }
  });
  app.get("/api/companies/:id/brokered-comps", async (req: any, res) => {
    try {
      const { orgId } = req.user || {};
      if (!orgId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const comps = await storage.getSalesCompsByBrokerageCompany(orgId, req.params.id);
      res.json(comps);
    } catch (error: any) {
      console.error("Failed to get brokered comps:", error);
      res.status(500).json({ error: "Failed to retrieve brokered comps" });
    }
  });

  app.get("/api/contacts/:contactId/brokered-comps", async (req: any, res) => {
    try {
      const { orgId } = req.user || {};
      if (!orgId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const comps = await storage.getSalesCompsByAgentContact(orgId, req.params.contactId);
      res.json(comps);
    } catch (error: any) {
      console.error("Failed to get agent brokered comps:", error);
      res.status(500).json({ error: "Failed to retrieve agent brokered comps" });
    }
  });
  // Company-Property Links
  app.get("/api/companies/:id/properties", async (req: any, res) => {
    try {
      const links = await storage.getCompanyProperties(req.params.id);
      res.json(links);
    } catch (error: any) {
      console.error("Failed to get company properties:", error);
      res.status(500).json({ error: "Failed to retrieve company properties" });
    }
  });

  // POST to link property to company (ADD THIS NEW ENDPOINT HERE)
  app.post("/api/companies/:id/properties", async (req: any, res) => {
    try {
      const companyId = req.params.id;
      const { propertyId, relationship, notes } = req.body;
      if (!propertyId) {
        return res.status(400).json({ error: "propertyId is required" });
      }

      // Link property to company
      const link = await storage.linkPropertyToCompany(propertyId, companyId, relationship || 'owner', notes);

      // AUTO-CASCADE: Link this property to company's contacts
      try {
        const companyContacts = await storage.getCompanyContacts(companyId);

        for (const cc of companyContacts) {
          const contactId = cc.contactId || cc.contact?.id;
          if (contactId) {
            try {
              // Check if already linked
              const existingContactProperties = await storage.getContactProperties(contactId);
              const alreadyLinked = existingContactProperties.some((cp: any) => 
                (cp.propertyId || cp.property?.id) === propertyId
              );

              if (!alreadyLinked) {
                await storage.linkPropertyToContact(propertyId, contactId, relationship || 'associated', null);
                logger.info({ propertyId, contactId, companyId }, "Auto-linked property to contact via company");
              }
            } catch (linkError: any) {
              // Ignore duplicate key errors
              if (!linkError.message?.includes('duplicate') && !linkError.code?.includes('23505')) {
                console.error(`Failed to auto-link property to contact ${contactId}:`, linkError.message);
              }
            }
          }
        }
      } catch (cascadeError) {
        console.error("Auto-cascade to contacts failed (non-fatal):", cascadeError);
      }

      res.json(link);
    } catch (error: any) {
      console.error("Failed to link property to company:", error);
      res.status(500).json({ error: "Failed to link property to company" });
    }
  });

  app.delete("/api/companies/:companyId/properties/:linkId", async (req: any, res) => {
    try {
      await storage.unlinkCompanyFromProperty(req.params.linkId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to unlink company from property:", error);
      res.status(500).json({ error: "Failed to unlink company from property" });
    }
  });

  // Property Intelligence: Get sales history by matching property name/address
  app.get("/api/properties/:id/sales-history", async (req: any, res) => {
    try {
      const property = await storage.getCrmProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const orgId = req.user.orgId;
      const { salesComps, crmCompanies, crmContacts } = await import('@shared/schema');
      const { ilike, or, and, eq, isNull, desc, sql } = await import('drizzle-orm');
      
      // Build search terms from property title and address
      const searchTerms: string[] = [];
      if (property.title) searchTerms.push(property.title);
      if (property.address) {
        // Extract key parts from address for matching
        const addressParts = property.address.split(',').map(p => p.trim());
        searchTerms.push(...addressParts.filter(p => p.length > 2));
      }

      if (searchTerms.length === 0) {
        return res.json({ matches: [], property });
      }

      // Find sales comps matching by marina name, city, or address
      const conditions = searchTerms.map(term => 
        or(
          ilike(salesComps.marina, `%${term}%`),
          ilike(salesComps.city, `%${term}%`),
          ilike(salesComps.address, `%${term}%`)
        )
      );

      const results = await db
        .select()
        .from(salesComps)
        .where(and(
          eq(salesComps.orgId, orgId),
          isNull(salesComps.deletedAt),
          or(...conditions)
        ))
        .orderBy(desc(salesComps.saleYear), desc(salesComps.createdAt))
        .limit(20);

      // Collect all unique company and contact IDs for batch lookup (org-scoped)
      const companyIds = new Set<string>();
      const contactIds = new Set<string>();
      
      results.forEach(comp => {
        if (comp.sellerCompanyId) companyIds.add(comp.sellerCompanyId);
        if (comp.buyerCompanyId) companyIds.add(comp.buyerCompanyId);
        if (comp.sellerContactId) contactIds.add(comp.sellerContactId);
        if (comp.buyerContactId) contactIds.add(comp.buyerContactId);
      });

      // Batch fetch companies (org-scoped for security)
      const companyMap = new Map<string, string>();
      if (companyIds.size > 0) {
        const { inArray } = await import('drizzle-orm');
        const companies = await db.select({ id: crmCompanies.id, name: crmCompanies.name })
          .from(crmCompanies)
          .where(and(
            inArray(crmCompanies.id, Array.from(companyIds)),
            eq(crmCompanies.orgId, orgId)
          ));
        companies.forEach(c => companyMap.set(c.id, c.name));
      }

      // Batch fetch contacts (org-scoped for security)
      const contactMap = new Map<string, string>();
      if (contactIds.size > 0) {
        const { inArray } = await import('drizzle-orm');
        const contacts = await db.select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName })
          .from(crmContacts)
          .where(and(
            inArray(crmContacts.id, Array.from(contactIds)),
            eq(crmContacts.orgId, orgId)
          ));
        contacts.forEach(c => {
          const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
          if (fullName) contactMap.set(c.id, fullName);
        });
      }

      // Enrich results with company/contact names
      const enrichedResults = results.map(comp => ({
        ...comp,
        sellerCompanyName: (comp.sellerCompanyId && companyMap.get(comp.sellerCompanyId)) || comp.seller || null,
        buyerCompanyName: (comp.buyerCompanyId && companyMap.get(comp.buyerCompanyId)) || comp.buyer || comp.company || null,
        sellerContactName: (comp.sellerContactId && contactMap.get(comp.sellerContactId)) || null,
        buyerContactName: (comp.buyerContactId && contactMap.get(comp.buyerContactId)) || null,
      }));

      // Calculate match confidence for each result
      const matchesWithConfidence = enrichedResults.map(comp => {
        let confidence = 0;
        const compName = (comp.marina || '').toLowerCase();
        const propName = (property.title || '').toLowerCase();
        
        // Exact name match = highest confidence
        if (compName === propName) confidence = 100;
        // Name contains match
        else if (compName.includes(propName) || propName.includes(compName)) confidence = 80;
        // City match
        else if (comp.city && property.address?.toLowerCase().includes(comp.city.toLowerCase())) confidence = 60;
        // State match
        else if (comp.state && property.address?.toLowerCase().includes(comp.state.toLowerCase())) confidence = 40;
        else confidence = 30;

        return { ...comp, matchConfidence: confidence, marinaName: comp.marina };
      });

      // Sort by confidence, then by sale year
      matchesWithConfidence.sort((a, b) => {
        if (b.matchConfidence !== a.matchConfidence) return b.matchConfidence - a.matchConfidence;
        return (b.saleYear || 0) - (a.saleYear || 0);
      });

      res.json({ matches: matchesWithConfidence, property });
    } catch (error: any) {
      console.error("Failed to get property sales history:", error);
      res.status(500).json({ error: "Failed to retrieve sales history" });
    }
  });

  // Property Intelligence: Get rate comp data by matching property name/address
  app.get("/api/properties/:id/rate-history", async (req: any, res) => {
    try {
      const property = await storage.getCrmProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const orgId = req.user.orgId;
      const { rateComps } = await import('@shared/schema');
      const { ilike, or, and, eq, isNull, desc } = await import('drizzle-orm');
      
      // Build search terms from property title and address
      const searchTerms: string[] = [];
      if (property.title) searchTerms.push(property.title);
      if (property.address) {
        const addressParts = property.address.split(',').map(p => p.trim());
        searchTerms.push(...addressParts.filter(p => p.length > 2));
      }

      if (searchTerms.length === 0) {
        return res.json({ matches: [], property });
      }

      // Find rate comps matching by marina name, city, or address
      const conditions = searchTerms.map(term => 
        or(
          ilike(rateComps.marina, `%${term}%`),
          ilike(rateComps.city, `%${term}%`),
          ilike(rateComps.address, `%${term}%`)
        )
      );

      const results = await db
        .select()
        .from(rateComps)
        .where(and(
          eq(rateComps.orgId, orgId),
          isNull(rateComps.deletedAt),
          or(...conditions)
        ))
        .orderBy(desc(rateComps.saleYear), desc(rateComps.createdAt))
        .limit(20);

      // Calculate match confidence for each result
      const matchesWithConfidence = results.map(comp => {
        let confidence = 0;
        const compName = (comp.marina || '').toLowerCase();
        const propName = (property.title || '').toLowerCase();
        
        if (compName === propName) confidence = 100;
        else if (compName.includes(propName) || propName.includes(compName)) confidence = 80;
        else if (comp.city && property.address?.toLowerCase().includes(comp.city.toLowerCase())) confidence = 60;
        else if (comp.state && property.address?.toLowerCase().includes(comp.state.toLowerCase())) confidence = 40;
        else confidence = 30;

        return { ...comp, matchConfidence: confidence, marinaName: comp.marina };
      });

      matchesWithConfidence.sort((a, b) => {
        if (b.matchConfidence !== a.matchConfidence) return b.matchConfidence - a.matchConfidence;
        return (b.saleYear || 0) - (a.saleYear || 0);
      });

      res.json({ matches: matchesWithConfidence, property });
    } catch (error: any) {
      console.error("Failed to get property rate history:", error);
      res.status(500).json({ error: "Failed to retrieve rate history" });
    }
  });

  // Property Intelligence: Get portfolio membership
  app.get("/api/properties/:id/portfolio-status", async (req: any, res) => {
    try {
      const property = await storage.getCrmProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const orgId = req.user.orgId;
      const { ownedAssets, scPortfolios, scPortfolioComps, salesComps } = await import('@shared/schema');
      const { eq, and, ilike } = await import('drizzle-orm');

      // Check if property is an owned asset
      const ownedAsset = await db
        .select()
        .from(ownedAssets)
        .where(and(
          eq(ownedAssets.orgId, orgId),
          eq(ownedAssets.propertyId, req.params.id)
        ))
        .limit(1);

      // Find if this property appears in any Sales Comp portfolios
      const propertyName = property.title?.toLowerCase() || '';
      const portfolioComps = propertyName ? await db
        .select({
          portfolioId: scPortfolioComps.portfolioId,
          portfolioName: scPortfolios.name,
          compId: scPortfolioComps.compId,
          marina: salesComps.marina
        })
        .from(scPortfolioComps)
        .innerJoin(scPortfolios, eq(scPortfolioComps.portfolioId, scPortfolios.id))
        .innerJoin(salesComps, eq(scPortfolioComps.compId, salesComps.id))
        .where(and(
          eq(scPortfolios.orgId, orgId),
          ilike(salesComps.marina, `%${propertyName}%`)
        ))
        .limit(10) : [];

      res.json({
        property,
        isOwnedAsset: ownedAsset.length > 0,
        ownedAssetDetails: ownedAsset[0] || null,
        portfolioMemberships: portfolioComps.map(pc => ({
          portfolioId: pc.portfolioId,
          portfolioName: pc.portfolioName,
          compId: pc.compId,
          marinaName: pc.marina
        }))
      });
    } catch (error: any) {
      console.error("Failed to get property portfolio status:", error);
      res.status(500).json({ error: "Failed to retrieve portfolio status" });
    }
  });
  
  // Bulk operations for properties
  app.post("/api/properties/bulk/delete", async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid ids array" });
      }
      
      await Promise.all(ids.map(id => storage.deleteCrmProperty(id)));
      res.json({ success: true, deleted: ids.length });
    } catch (error: any) {
      console.error("Failed to bulk delete properties:", error);
      res.status(500).json({ error: "Failed to bulk delete properties" });
    }
  });

  app.post("/api/properties/bulk/update-status", async (req: any, res) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid ids array" });
      }
      const validStatuses = ['available', 'under_contract', 'sold', 'off_market'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      await Promise.all(ids.map(id => storage.updateCrmProperty(id, { status })));
      res.json({ success: true, updated: ids.length });
    } catch (error: any) {
      console.error("Failed to bulk update property status:", error);
      res.status(500).json({ error: "Failed to bulk update property status" });
    }
  });
  
  // Pipelines aliases
  app.get("/api/pipelines", async (req: any, res) => {
    try {
      const pipelines = await storage.getCrmPipelinesForOrg(req.user.orgId);
      res.json(pipelines);
    } catch (error: any) {
      console.error("Failed to get pipelines:", error);
      res.status(500).json({ error: "Failed to retrieve pipelines" });
    }
  });
  app.post("/api/pipelines", async (req: any, res) => {
    try {
      const pipeline = await storage.createCrmPipeline({ ...req.body, orgId: req.user.orgId });
      res.json(pipeline);
    } catch (error: any) {
      console.error("Failed to create pipeline:", error);
      res.status(500).json({ error: "Failed to create pipeline" });
    }
  });
  app.put("/api/pipelines/:id", async (req: any, res) => {
    try {
      const pipeline = await storage.updateCrmPipeline(req.params.id, req.body);
      res.json(pipeline);
    } catch (error: any) {
      console.error("Failed to update pipeline:", error);
      res.status(500).json({ error: "Failed to update pipeline" });
    }
  });
  app.delete("/api/pipelines/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmPipeline(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete pipeline:", error);
      res.status(500).json({ error: "Failed to delete pipeline" });
    }
  });
  app.get("/api/pipelines/:pipelineId/stages", async (req: any, res) => {
    try {
      const stages = await storage.getCrmStagesForPipeline(req.params.pipelineId);
      res.json(stages);
    } catch (error: any) {
      console.error("Failed to get pipeline stages:", error);
      res.status(500).json({ error: "Failed to retrieve pipeline stages" });
    }
  });
  
  // Pipeline Stages aliases (both /api/stages and /api/pipeline-stages)
  app.get("/api/stages", async (req: any, res) => {
    try {
      const stages = await storage.getAllCrmPipelineStages(req.user.orgId);
      res.json(stages);
    } catch (error: any) {
      console.error("Failed to get stages:", error);
      res.status(500).json({ error: "Failed to retrieve stages" });
    }
  });
  app.post("/api/stages", async (req: any, res) => {
    try {
      const stage = await storage.createCrmStage(req.body);
      res.json(stage);
    } catch (error: any) {
      console.error("Failed to create stage:", error);
      res.status(500).json({ error: "Failed to create stage" });
    }
  });
  app.put("/api/stages/:id", async (req: any, res) => {
    try {
      const stage = await storage.updateCrmStage(req.params.id, req.body);
      res.json(stage);
    } catch (error: any) {
      console.error("Failed to update stage:", error);
      res.status(500).json({ error: "Failed to update stage" });
    }
  });
  app.delete("/api/stages/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmStage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete stage:", error);
      res.status(500).json({ error: "Failed to delete stage" });
    }
  });
  app.get("/api/pipeline-stages", async (req: any, res) => {
    try {
      const stages = await storage.getAllCrmPipelineStages(req.user.orgId);
      res.json(stages);
    } catch (error: any) {
      console.error("Failed to get stages:", error);
      res.status(500).json({ error: "Failed to retrieve stages" });
    }
  });
  app.post("/api/pipeline-stages", async (req: any, res) => {
    try {
      const stage = await storage.createCrmStage(req.body);
      res.json(stage);
    } catch (error: any) {
      console.error("Failed to create stage:", error);
      res.status(500).json({ error: "Failed to create stage" });
    }
  });
  app.put("/api/pipeline-stages/:id", async (req: any, res) => {
    try {
      const stage = await storage.updateCrmStage(req.params.id, req.body);
      res.json(stage);
    } catch (error: any) {
      console.error("Failed to update stage:", error);
      res.status(500).json({ error: "Failed to update stage" });
    }
  });
  app.delete("/api/pipeline-stages/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmStage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete stage:", error);
      res.status(500).json({ error: "Failed to delete stage" });
    }
  });

  // Seed CRE Default Pipeline Stages (Oracle RCM style)
  app.post("/api/pipelines/seed-cre-defaults", async (req: any, res) => {
    try {
      const { pipelineId } = req.body;
      if (!pipelineId) {
        return res.status(400).json({ error: "Pipeline ID is required" });
      }

      // CRE Acquisitions Pipeline - Standard broker-style stages
      const creStages = [
        { name: 'Lead', color: '#94A3B8', probability: 5, stageType: 'active', slaWarningDays: 7, slaMaxDays: 14 },
        { name: 'Intro Call', color: '#3B82F6', probability: 10, stageType: 'active', slaWarningDays: 5, slaMaxDays: 10 },
        { name: 'NDA Sent', color: '#8B5CF6', probability: 15, stageType: 'active', slaWarningDays: 3, slaMaxDays: 7 },
        { name: 'NDA Signed', color: '#A855F7', probability: 20, stageType: 'active', slaWarningDays: 5, slaMaxDays: 14, requiredFields: ['ndaStatus'] },
        { name: 'OM Sent', color: '#6366F1', probability: 25, stageType: 'active', slaWarningDays: 7, slaMaxDays: 21 },
        { name: 'Site Visit', color: '#14B8A6', probability: 35, stageType: 'active', slaWarningDays: 14, slaMaxDays: 30 },
        { name: 'LOI Drafted', color: '#10B981', probability: 45, stageType: 'active', slaWarningDays: 7, slaMaxDays: 14 },
        { name: 'LOI Sent', color: '#22C55E', probability: 55, stageType: 'active', slaWarningDays: 5, slaMaxDays: 10 },
        { name: 'Best & Final', color: '#84CC16', probability: 65, stageType: 'active', slaWarningDays: 7, slaMaxDays: 14 },
        { name: 'Under Contract', color: '#EAB308', probability: 75, stageType: 'active', slaWarningDays: 30, slaMaxDays: 60,
          taskTemplates: [
            { title: 'Schedule site visit', description: 'Coordinate with seller to schedule property inspection', priority: 'high', daysFromNow: 3 },
            { title: 'Request financial documents', description: 'Request P&L, rent roll, and tax returns from seller', priority: 'high', daysFromNow: 2 },
            { title: 'Engage title company', description: 'Order title search and commitment', priority: 'medium', daysFromNow: 5 },
          ]
        },
        { name: 'Due Diligence', color: '#F97316', probability: 85, stageType: 'active', slaWarningDays: 21, slaMaxDays: 45,
          taskTemplates: [
            { title: 'Review financial statements', description: 'Analyze P&L trends, verify revenue and expense items', priority: 'high', daysFromNow: 7 },
            { title: 'Complete environmental review', description: 'Review Phase I ESA, check for fuel storage compliance', priority: 'high', daysFromNow: 10 },
            { title: 'Verify permits and licenses', description: 'Confirm marina operating permits, DNR compliance', priority: 'medium', daysFromNow: 7 },
          ]
        },
        { name: 'Financing', color: '#FB923C', probability: 90, stageType: 'active', slaWarningDays: 14, slaMaxDays: 30 },
        { name: 'Closing', color: '#16A34A', probability: 95, stageType: 'active', slaWarningDays: 7, slaMaxDays: 14,
          taskTemplates: [
            { title: 'Prepare closing checklist', description: 'Compile all required closing documents', priority: 'high', daysFromNow: 2 },
            { title: 'Coordinate with lender', description: 'Ensure financing terms are finalized', priority: 'high', daysFromNow: 3 },
          ]
        },
        { name: 'Closed Won', color: '#22C55E', probability: 100, stageType: 'won', slaWarningDays: null, slaMaxDays: null },
        { name: 'Lost', color: '#EF4444', probability: 0, stageType: 'lost', slaWarningDays: null, slaMaxDays: null },
      ];

      const createdStages = [];
      for (let i = 0; i < creStages.length; i++) {
        const stageDef = creStages[i];
        const stage = await storage.createCrmStage({
          pipelineId,
          name: stageDef.name,
          stageOrder: (i + 1) * 10,
          probability: stageDef.probability,
          color: stageDef.color,
          pipelineType: 'sales',
        });
        createdStages.push(stage);
      }

      res.json({ 
        success: true, 
        message: `Created ${createdStages.length} CRE pipeline stages`,
        stages: createdStages 
      });
    } catch (error: any) {
      console.error("Failed to seed CRE stages:", error);
      res.status(500).json({ error: "Failed to seed CRE stages" });
    }
  });
  
  // Activities — global activity log with server-side pagination, filtering, and entity enrichment
  app.get("/api/activities", async (req: any, res) => {
    try {
      const orgId = (req as any).user?.orgId || (req as any).tenantId || (req as any).orgId;
      if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 25));
      const entityType = req.query.entityType as string; // deal | contact | company | lead | property
      const actorId = req.query.actorId as string;
      const type = req.query.type as string; // call | email | meeting | note | task_created | stage_change | deal_created
      const dateRange = req.query.dateRange as string; // today | week | month
      const q = req.query.q as string;
      const offset = (page - 1) * pageSize;

      // Build WHERE conditions
      const conditions: any[] = [eq(crmActivities.orgId, orgId)];

      if (entityType && entityType !== 'all') {
        conditions.push(eq(crmActivities.entityType, entityType));
      }
      if (actorId && actorId !== 'all') {
        conditions.push(eq(crmActivities.userId, actorId));
      }
      if (type && type !== 'all') {
        conditions.push(eq(crmActivities.type, type));
      }
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        if (dateRange === 'today') {
          conditions.push(gte(crmActivities.createdAt, new Date(now.getFullYear(), now.getMonth(), now.getDate())));
        } else if (dateRange === 'week') {
          conditions.push(gte(crmActivities.createdAt, new Date(now.getTime() - 7 * 86400000)));
        } else if (dateRange === 'month') {
          conditions.push(gte(crmActivities.createdAt, new Date(now.getTime() - 30 * 86400000)));
        }
      }
      if (q) {
        conditions.push(or(
          ilike(crmActivities.subject, `%${q}%`),
          ilike(crmActivities.description, `%${q}%`)
        ));
      }

      const whereClause = and(...conditions);

      // Count total for pagination
      const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
        .from(crmActivities)
        .where(whereClause);
      const total = countResult?.count || 0;

      // Fetch page with actor join
      const rows = await db
        .select({
          activity: crmActivities,
          actorName: users.name,
          actorEmail: users.email,
        })
        .from(crmActivities)
        .leftJoin(users, eq(crmActivities.userId, users.id))
        .where(whereClause)
        .orderBy(desc(crmActivities.createdAt))
        .limit(pageSize)
        .offset(offset);

      // Collect entity IDs for batch enrichment
      const contactIds = new Set<string>();
      const dealIds = new Set<string>();
      const companyIds = new Set<string>();
      const leadIds = new Set<string>();
      const propertyIds = new Set<string>();

      for (const row of rows) {
        const a = row.activity;
        if (a.entityType === 'contact' && a.entityId) contactIds.add(a.entityId);
        if (a.entityType === 'deal' && a.entityId) dealIds.add(a.entityId);
        if (a.entityType === 'company' && a.entityId) companyIds.add(a.entityId);
        if (a.entityType === 'lead' && a.entityId) leadIds.add(a.entityId);
        if (a.entityType === 'property' && a.entityId) propertyIds.add(a.entityId);
      }

      // Batch-load entities
      const [contactMap, dealMap, companyMap, leadMap, propertyMap] = await Promise.all([
        contactIds.size > 0
          ? db.select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName })
              .from(crmContacts).where(inArray(crmContacts.id, [...contactIds]))
              .then(rows => new Map(rows.map(r => [r.id, r])))
          : Promise.resolve(new Map()),
        dealIds.size > 0
          ? db.select({ id: crmDeals.id, title: crmDeals.title, contactId: crmDeals.contactId, companyId: crmDeals.companyId })
              .from(crmDeals).where(inArray(crmDeals.id, [...dealIds]))
              .then(rows => new Map(rows.map(r => [r.id, r])))
          : Promise.resolve(new Map()),
        companyIds.size > 0
          ? db.select({ id: crmCompanies.id, name: crmCompanies.name })
              .from(crmCompanies).where(inArray(crmCompanies.id, [...companyIds]))
              .then(rows => new Map(rows.map(r => [r.id, r])))
          : Promise.resolve(new Map()),
        leadIds.size > 0
          ? (async () => {
              const { crmLeads } = await import('@shared/schema');
              return db.select({ id: crmLeads.id, firstName: crmLeads.firstName, lastName: crmLeads.lastName })
                .from(crmLeads).where(inArray(crmLeads.id, [...leadIds]))
                .then(rows => new Map(rows.map(r => [r.id, r])));
            })()
          : Promise.resolve(new Map()),
        propertyIds.size > 0
          ? db.select({ id: crmProperties.id, name: crmProperties.name })
              .from(crmProperties).where(inArray(crmProperties.id, [...propertyIds]))
              .then(rows => new Map(rows.map(r => [r.id, r])))
          : Promise.resolve(new Map()),
      ]);

      // Also batch-load deal-linked contacts and companies
      const dealContactIds = new Set<string>();
      const dealCompanyIds = new Set<string>();
      for (const deal of dealMap.values()) {
        if (deal.contactId) dealContactIds.add(deal.contactId);
        if (deal.companyId) dealCompanyIds.add(deal.companyId);
      }
      const [dealContactMap, dealCompanyMap] = await Promise.all([
        dealContactIds.size > 0
          ? db.select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName })
              .from(crmContacts).where(inArray(crmContacts.id, [...dealContactIds]))
              .then(rows => new Map(rows.map(r => [r.id, r])))
          : Promise.resolve(new Map()),
        dealCompanyIds.size > 0
          ? db.select({ id: crmCompanies.id, name: crmCompanies.name })
              .from(crmCompanies).where(inArray(crmCompanies.id, [...dealCompanyIds]))
              .then(rows => new Map(rows.map(r => [r.id, r])))
          : Promise.resolve(new Map()),
      ]);

      // Enrich activities
      const items = rows.map(row => {
        const a = row.activity;
        const enriched: any = {
          id: a.id,
          type: a.type || 'note',
          direction: a.direction || 'internal',
          subject: a.subject || a.description?.slice(0, 80) || 'Activity',
          description: a.description,
          date: a.createdAt,
          user: row.actorName || row.actorEmail || 'System',
          userId: a.userId,
          entityType: a.entityType,
        };

        if (a.entityType === 'contact' && a.entityId) {
          const c = contactMap.get(a.entityId);
          if (c) enriched.contact = { id: c.id, name: `${c.firstName || ''} ${c.lastName || ''}`.trim() };
        }
        if (a.entityType === 'deal' && a.entityId) {
          const d = dealMap.get(a.entityId);
          if (d) {
            enriched.deal = { id: d.id, name: d.title || d.name || 'Deal' };
            if (d.contactId) {
              const c = dealContactMap.get(d.contactId);
              if (c) enriched.contact = { id: c.id, name: `${c.firstName || ''} ${c.lastName || ''}`.trim() };
            }
            if (d.companyId) {
              const co = dealCompanyMap.get(d.companyId);
              if (co) enriched.company = { id: co.id, name: co.name };
            }
          }
        }
        if (a.entityType === 'company' && a.entityId) {
          const co = companyMap.get(a.entityId);
          if (co) enriched.company = { id: co.id, name: co.name };
        }
        if (a.entityType === 'lead' && a.entityId) {
          const l = leadMap.get(a.entityId);
          if (l) enriched.lead = { id: l.id, name: `${l.firstName || ''} ${l.lastName || ''}`.trim() };
        }
        if (a.entityType === 'property' && a.entityId) {
          const p = propertyMap.get(a.entityId);
          if (p) enriched.property = { id: p.id, name: p.name };
        }

        return enriched;
      });

      // Fetch distinct actors for the filter dropdown
      const actors = await db
        .selectDistinct({ id: users.id, name: users.name, email: users.email })
        .from(crmActivities)
        .innerJoin(users, eq(crmActivities.userId, users.id))
        .where(eq(crmActivities.orgId, orgId));

      res.json({
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        actors: actors.map(a => ({ id: a.id, name: a.name || a.email || 'Unknown' })),
      });
    } catch (error: any) {
      console.error("Failed to get activities:", error);
      res.status(500).json({ error: "Failed to retrieve activities" });
    }
  });
  app.post("/api/activities", async (req: any, res) => {
    try {
      const activity = await storage.createCrmActivity({ ...req.body, userId: req.user.id });
      res.json(activity);
    } catch (error: any) {
      console.error("Failed to create activity:", error);
      res.status(500).json({ error: "Failed to create activity" });
    }
  });
  app.put("/api/activities/:id", async (req: any, res) => {
    try {
      const activity = await storage.updateCrmActivity(req.params.id, req.body);
      res.json(activity);
    } catch (error: any) {
      console.error("Failed to update activity:", error);
      res.status(500).json({ error: "Failed to update activity" });
    }
  });
  app.delete("/api/activities/:id", async (req: any, res) => {
    try {
      await storage.deleteCrmActivity(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete activity:", error);
      res.status(500).json({ error: "Failed to delete activity" });
    }
  });

  // Import aliases
  app.post("/api/imports", (req, res) => req.app.handle(Object.assign(req, { url: '/api/crm/imports' }), res));
  app.get("/api/imports/:id", (req, res) => req.app.handle(Object.assign(req, { url: `/api/crm/imports/${req.params.id}` }), res));
  app.get("/api/imports", (req, res) => req.app.handle(Object.assign(req, { url: '/api/crm/imports' }), res));
  app.post("/api/imports/:id/preview", (req, res) => req.app.handle(Object.assign(req, { url: `/api/crm/imports/${req.params.id}/preview` }), res));
  app.post("/api/imports/:id/execute", (req, res) => req.app.handle(Object.assign(req, { url: `/api/crm/imports/${req.params.id}/execute` }), res));
  app.post("/api/imports/:id/rollback", (req, res) => req.app.handle(Object.assign(req, { url: `/api/crm/imports/${req.params.id}/rollback` }), res));

  // ===================================================================
  // Global Search API - Fuzzy search across all CRM entities
  // ===================================================================
  app.get("/api/search", async (req: any, res) => {
    try {
      const query = req.query.q || req.query.query || "";
      
      if (!query || query.trim().length < 2) {
        return res.json({ results: [] });
      }

      const searchTerm = `%${query.trim().toLowerCase()}%`;
      
      // Search contacts
      const contacts = await db
        .select({
          id: crmContacts.id,
          type: sql<string>`'contact'`,
          title: sql<string>`CONCAT(${crmContacts.firstName}, ' ', ${crmContacts.lastName})`,
          subtitle: crmContacts.email,
          description: crmContacts.title,
          data: crmContacts,
        })
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.orgId, req.user.orgId),
            or(
              sql`LOWER(${crmContacts.firstName}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.lastName}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.email}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.phone}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.title}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);

      // Search companies
      const companies = await db
        .select({
          id: crmCompanies.id,
          type: sql<string>`'company'`,
          title: crmCompanies.name,
          subtitle: crmCompanies.domain,
          description: crmCompanies.industry,
          data: crmCompanies,
        })
        .from(crmCompanies)
        .where(
          and(
            eq(crmCompanies.orgId, req.user.orgId),
            or(
              sql`LOWER(${crmCompanies.name}) LIKE ${searchTerm}`,
              sql`LOWER(${crmCompanies.domain}) LIKE ${searchTerm}`,
              sql`LOWER(${crmCompanies.industry}) LIKE ${searchTerm}`,
              sql`LOWER(${crmCompanies.phone}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);

      // Search deals
      const deals = await db
        .select({
          id: crmDeals.id,
          type: sql<string>`'deal'`,
          title: crmDeals.title,
          subtitle: sql<string>`CONCAT('$', ${crmDeals.amount})`,
          description: crmDeals.stage,
          data: crmDeals,
        })
        .from(crmDeals)
        .where(
          and(
            eq(crmDeals.orgId, req.user.orgId),
            or(
              sql`LOWER(${crmDeals.title}) LIKE ${searchTerm}`,
              sql`LOWER(${crmDeals.stage}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);

      // Search properties
      const properties = await db
        .select({
          id: crmProperties.id,
          type: sql<string>`'property'`,
          title: crmProperties.name,
          subtitle: sql<string>`CONCAT(${crmProperties.city}, ', ', ${crmProperties.state})`,
          description: crmProperties.propertyType,
          data: crmProperties,
        })
        .from(crmProperties)
        .where(
          and(
            eq(crmProperties.orgId, req.user.orgId),
            or(
              sql`LOWER(${crmProperties.name}) LIKE ${searchTerm}`,
              sql`LOWER(${crmProperties.city}) LIKE ${searchTerm}`,
              sql`LOWER(${crmProperties.state}) LIKE ${searchTerm}`,
              sql`LOWER(${crmProperties.propertyType}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);

      // Search modeling projects
      const models = await db
        .select({
          id: modelingProjects.id,
          type: sql<string>`'modelingProject'`,
          title: modelingProjects.name,
          subtitle: modelingProjects.status,
          description: modelingProjects.location,
          data: modelingProjects,
        })
        .from(modelingProjects)
        .where(
          and(
            eq(modelingProjects.orgId, req.user.orgId),
            or(
              sql`LOWER(${modelingProjects.name}) LIKE ${searchTerm}`,
              sql`LOWER(${modelingProjects.location}) LIKE ${searchTerm}`,
              sql`LOWER(${modelingProjects.status}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);

      // Search DD projects
      const ddProjects = await db
        .select({
          id: projects.id,
          type: sql<string>`'ddProject'`,
          title: projects.name,
          subtitle: projects.status,
          description: projects.dealType,
          data: projects,
        })
        .from(projects)
        .where(
          and(
            eq(projects.orgId, req.user.orgId),
            or(
              sql`LOWER(${projects.name}) LIKE ${searchTerm}`,
              sql`LOWER(${projects.status}) LIKE ${searchTerm}`,
              sql`LOWER(${projects.dealType}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);

      // Combine and return results
      const results = [
        ...contacts.map(c => ({ ...c, type: 'contact' as const })),
        ...companies.map(c => ({ ...c, type: 'company' as const })),
        ...deals.map(d => ({ ...d, type: 'deal' as const })),
        ...properties.map(p => ({ ...p, type: 'property' as const })),
        ...models.map(m => ({ ...m, type: 'modelingProject' as const })),
        ...ddProjects.map(p => ({ ...p, type: 'ddProject' as const })),
      ];

      res.json({ results, query });
    } catch (error: any) {
      console.error("Global search failed:", error);
      res.status(500).json({ error: "Search failed", results: [] });
    }
  });

  // Marketing Automation - Email Sequences & Templates
  app.use("/api/email-sequences", authenticateUser);
  app.use("/api/email-templates", authenticateUser);

  // Get all email sequences for a user
  app.get("/api/email-sequences", async (req: any, res) => {
    try {
      const sequences = await storage.getEmailSequencesForUser(req.user.id);
      res.json(sequences);
    } catch (error: any) {
      console.error("Failed to get email sequences:", error);
      res.status(500).json({ error: "Failed to retrieve email sequences" });
    }
  });

  // Get a specific email sequence with steps
  app.get("/api/email-sequences/:id", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.id);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const steps = await storage.getEmailSequenceStepsBySequence(req.params.id);
      res.json({ ...sequence, steps });
    } catch (error: any) {
      console.error("Failed to get email sequence:", error);
      res.status(500).json({ error: "Failed to retrieve email sequence" });
    }
  });

  // Create a new email sequence
  app.post("/api/email-sequences", async (req: any, res) => {
    try {
      const { insertEmailSequenceSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceSchema.parse({
        ...req.body,
        createdById: req.user.id,
      });
      
      const sequence = await storage.createEmailSequence(validated);
      res.status(201).json(sequence);
    } catch (error: any) {
      console.error("Failed to create email sequence:", error);
      res.status(500).json({ error: "Failed to create email sequence" });
    }
  });

  // Update an email sequence
  app.put("/api/email-sequences/:id", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.id);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailSequenceSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceSchema.partial().omit({ createdById: true }).parse(req.body);
      const updated = await storage.updateEmailSequence(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to update email sequence:", error);
      res.status(500).json({ error: "Failed to update email sequence" });
    }
  });

  // Delete an email sequence
  app.delete("/api/email-sequences/:id", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.id);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.deleteEmailSequence(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete email sequence:", error);
      res.status(500).json({ error: "Failed to delete email sequence" });
    }
  });

  // Email Sequence Steps
  app.get("/api/email-sequences/:sequenceId/steps", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.sequenceId);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }
      
      const steps = await storage.getEmailSequenceStepsBySequence(req.params.sequenceId);
      res.json(steps);
    } catch (error: any) {
      console.error("Failed to get sequence steps:", error);
      res.status(500).json({ error: "Failed to retrieve sequence steps" });
    }
  });

  app.post("/api/email-sequences/:sequenceId/steps", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.sequenceId);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailSequenceStepSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceStepSchema.parse({
        ...req.body,
        sequenceId: req.params.sequenceId,
      });
      
      const step = await storage.createEmailSequenceStep(validated);
      res.status(201).json(step);
    } catch (error: any) {
      console.error("Failed to create sequence step:", error);
      res.status(500).json({ error: "Failed to create sequence step" });
    }
  });

  app.put("/api/email-sequence-steps/:id", async (req: any, res) => {
    try {
      const step = await storage.getEmailSequenceStep(req.params.id);
      if (!step) {
        return res.status(404).json({ error: "Sequence step not found" });
      }
      
      const sequence = await storage.getEmailSequence(step.sequenceId);
      if (!sequence || sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailSequenceStepSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceStepSchema.partial().omit({ sequenceId: true }).parse(req.body);
      const updated = await storage.updateEmailSequenceStep(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to update sequence step:", error);
      res.status(500).json({ error: "Failed to update sequence step" });
    }
  });

  app.delete("/api/email-sequence-steps/:id", async (req: any, res) => {
    try {
      const step = await storage.getEmailSequenceStep(req.params.id);
      if (!step) {
        return res.status(404).json({ error: "Sequence step not found" });
      }
      
      const sequence = await storage.getEmailSequence(step.sequenceId);
      if (!sequence || sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.deleteEmailSequenceStep(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete sequence step:", error);
      res.status(500).json({ error: "Failed to delete sequence step" });
    }
  });

  // Email Templates
  app.get("/api/email-templates", async (req: any, res) => {
    try {
      const templates = await storage.getEmailTemplatesForUser(req.user.id);
      res.json(templates);
    } catch (error: any) {
      console.error("Failed to get email templates:", error);
      res.status(500).json({ error: "Failed to retrieve email templates" });
    }
  });

  app.get("/api/email-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Email template not found" });
      }
      res.json(template);
    } catch (error: any) {
      console.error("Failed to get email template:", error);
      res.status(500).json({ error: "Failed to retrieve email template" });
    }
  });

  app.post("/api/email-templates", async (req: any, res) => {
    try {
      const { insertEmailTemplateSchema } = await import("@shared/schema");
      const validated = insertEmailTemplateSchema.parse({
        ...req.body,
        createdById: req.user.id,
      });
      
      const template = await storage.createEmailTemplate(validated);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("Failed to create email template:", error);
      res.status(500).json({ error: "Failed to create email template" });
    }
  });

  app.put("/api/email-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Email template not found" });
      }
      if (template.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailTemplateSchema } = await import("@shared/schema");
      const validated = insertEmailTemplateSchema.partial().omit({ createdById: true }).parse(req.body);
      const updated = await storage.updateEmailTemplate(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to update email template:", error);
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  app.delete("/api/email-templates/:id", async (req: any, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Email template not found" });
      }
      if (template.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.deleteEmailTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete email template:", error);
      res.status(500).json({ error: "Failed to delete email template" });
    }
  });

  // Email Sequence Enrollments
  app.get("/api/email-sequence-enrollments", async (req: any, res) => {
    try {
      if (!req.user?.id) { return res.status(401).json({ error: "Unauthorized" }); } const enrollments = await storage.getEmailSequenceEnrollmentsForUser(req.user.id);
      res.json(enrollments);
    } catch (error: any) {
      console.error("Failed to get enrollments:", error);
      res.status(500).json({ error: "Failed to retrieve enrollments" });
    }
  });

  app.get("/api/email-sequences/:sequenceId/enrollments", async (req: any, res) => {
    try {
      const sequence = await storage.getEmailSequence(req.params.sequenceId);
      if (!sequence) {
        return res.status(404).json({ error: "Email sequence not found" });
      }
      if (sequence.createdById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const enrollments = await storage.getEmailSequenceEnrollmentsBySequence(req.params.sequenceId);
      res.json(enrollments);
    } catch (error: any) {
      console.error("Failed to get enrollments:", error);
      res.status(500).json({ error: "Failed to retrieve enrollments" });
    }
  });

  app.post("/api/email-sequence-enrollments", async (req: any, res) => {
    try {
      const { insertEmailSequenceEnrollmentSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceEnrollmentSchema.parse({
        ...req.body,
        enrolledById: req.user.id,
      });
      
      const enrollment = await storage.createEmailSequenceEnrollment(validated);
      res.status(201).json(enrollment);
    } catch (error: any) {
      console.error("Failed to create enrollment:", error);
      res.status(500).json({ error: "Failed to create enrollment" });
    }
  });

  app.put("/api/email-sequence-enrollments/:id", async (req: any, res) => {
    try {
      const enrollment = await storage.getEmailSequenceEnrollment(req.params.id);
      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }
      if (enrollment.enrolledById !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { insertEmailSequenceEnrollmentSchema } = await import("@shared/schema");
      const validated = insertEmailSequenceEnrollmentSchema.partial().omit({ 
        sequenceId: true,
        enrolledById: true,
        entityType: true,
        entityId: true
      }).parse(req.body);
      const updated = await storage.updateEmailSequenceEnrollment(req.params.id, validated);
      res.json(updated);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Failed to update enrollment:", error);
      res.status(500).json({ error: "Failed to update enrollment" });
    }
  });

  // Calendar Settings Routes
  app.get("/api/calendar/settings", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      
      if (!settings) {
        return res.status(404).json({ error: "Calendar settings not found" });
      }

      res.json(settings);
    } catch (error: any) {
      console.error("Failed to get calendar settings:", error);
      res.status(500).json({ error: "Failed to get calendar settings" });
    }
  });

  app.put("/api/calendar/settings", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const validated = insertCalendarSettingsSchema.partial().omit({ userId: true }).parse(req.body);

      const existingSettings = await storage.getCalendarSettings(req.user.id);
      
      let settings;
      if (existingSettings) {
        settings = await storage.updateCalendarSettings(req.user.id, validated);
      } else {
        settings = await storage.createCalendarSettings({
          ...validated,
          userId: req.user.id,
        });
      }

      res.json(settings);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      console.error("Failed to update calendar settings:", error);
      res.status(500).json({ error: "Failed to update calendar settings" });
    }
  });

  app.get("/api/calendar/status", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const isConnected = await CalendarService.isConnected();
      res.json({ connected: isConnected });
    } catch (error: any) {
      console.error("Failed to check calendar status:", error);
      res.json({ connected: false });
    }
  });

  // Calendar Sync Routes - Activities
  app.post("/api/calendar/sync/activity/:activityId", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const activity = await storage.getCrmActivity(req.params.activityId);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      if (activity.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized access to activity" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      const calendarId = settings?.defaultCalendarId || 'primary';

      let startDateTime: string;
      let endDateTime: string;

      if (activity.scheduledAt) {
        startDateTime = new Date(activity.scheduledAt).toISOString();
        const duration = activity.duration || 30;
        endDateTime = new Date(new Date(activity.scheduledAt).getTime() + duration * 60000).toISOString();
      } else {
        return res.status(400).json({ error: "Activity must have a scheduled time to sync to calendar" });
      }

      const calendarEvent = {
        summary: activity.subject || `${activity.type} - ${activity.entityType}`,
        description: activity.description || '',
        start: {
          dateTime: startDateTime,
          timeZone: 'UTC',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'UTC',
        },
      };

      const createdEvent = await CalendarService.createEvent(calendarEvent, calendarId);

      await storage.updateCrmActivity(activity.id, {
        calendarEventId: createdEvent.id,
        syncedToCalendar: true,
      });

      res.status(201).json({ 
        success: true, 
        calendarEventId: createdEvent.id,
        eventLink: createdEvent.htmlLink 
      });
    } catch (error: any) {
      console.error("Failed to sync activity to calendar:", error);
      res.status(500).json({ error: "Failed to sync activity to calendar" });
    }
  });

  app.delete("/api/calendar/sync/activity/:activityId", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const activity = await storage.getCrmActivity(req.params.activityId);
      if (!activity) {
        return res.status(404).json({ error: "Activity not found" });
      }

      if (activity.userId !== req.user.id) {
        return res.status(403).json({ error: "Unauthorized access to activity" });
      }

      if (!activity.calendarEventId) {
        return res.status(400).json({ error: "Activity is not synced to calendar" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      const calendarId = settings?.defaultCalendarId || 'primary';

      await CalendarService.deleteEvent(activity.calendarEventId, calendarId);

      await storage.updateCrmActivity(activity.id, {
        calendarEventId: null,
        syncedToCalendar: false,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to remove activity from calendar:", error);
      res.status(500).json({ error: "Failed to remove activity from calendar" });
    }
  });

  // Calendar Sync Routes - DD Tasks
  app.post("/api/calendar/sync/task/:taskId", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const project = await storage.getProject(task.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Unauthorized access to task" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      const calendarId = settings?.defaultCalendarId || 'primary';

      if (!task.deadline) {
        return res.status(400).json({ error: "Task must have a deadline to sync to calendar" });
      }

      const deadlineDate = new Date(task.deadline);
      const calendarEvent = {
        summary: task.title,
        description: task.description || '',
        start: {
          date: deadlineDate.toISOString().split('T')[0],
        },
        end: {
          date: deadlineDate.toISOString().split('T')[0],
        },
      };

      const createdEvent = await CalendarService.createEvent(calendarEvent, calendarId);

      await storage.updateTask(task.id, {
        calendarEventId: createdEvent.id,
        syncedToCalendar: true,
      });

      res.status(201).json({ 
        success: true, 
        calendarEventId: createdEvent.id,
        eventLink: createdEvent.htmlLink 
      });
    } catch (error: any) {
      console.error("Failed to sync task to calendar:", error);
      res.status(500).json({ error: "Failed to sync task to calendar" });
    }
  });

  app.delete("/api/calendar/sync/task/:taskId", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const task = await storage.getTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const project = await storage.getProject(task.projectId);
      if (!project || project.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Unauthorized access to task" });
      }

      if (!task.calendarEventId) {
        return res.status(400).json({ error: "Task is not synced to calendar" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const settings = await storage.getCalendarSettings(req.user.id);
      const calendarId = settings?.defaultCalendarId || 'primary';

      await CalendarService.deleteEvent(task.calendarEventId, calendarId);

      await storage.updateTask(task.id, {
        calendarEventId: null,
        syncedToCalendar: false,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to remove task from calendar:", error);
      res.status(500).json({ error: "Failed to remove task from calendar" });
    }
  });

  // List available Google calendars
  app.get("/api/calendar/calendars", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const isConnected = await CalendarService.isConnected();
      if (!isConnected) {
        return res.status(400).json({ error: "Google Calendar not connected" });
      }

      const calendars = await CalendarService.getCalendars();
      res.json(calendars);
    } catch (error: any) {
      console.error("Failed to get calendars:", error);
      res.status(500).json({ error: "Failed to get calendars" });
    }
  });

  // ICS Export Routes
  app.get("/api/calendar/export/activities.ics", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const activities = await db
        .select()
        .from(crmActivities)
        .where(eq(crmActivities.userId, req.user.id));

      const icsContent = generateICS(activities.map(activity => ({
        id: activity.id,
        summary: activity.subject || `${activity.type} - ${activity.entityType}`,
        description: activity.description || '',
        start: activity.scheduledAt,
        end: activity.scheduledAt ? new Date(new Date(activity.scheduledAt).getTime() + (activity.duration || 30) * 60000) : null,
        type: 'activity'
      })));

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename="activities.ics"');
      res.send(icsContent);
    } catch (error: any) {
      console.error("Failed to export activities:", error);
      res.status(500).json({ error: "Failed to export activities" });
    }
  });

  app.get("/api/calendar/export/tasks.ics", async (req: any, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const userProjects = await storage.getProjectsForOrg(req.user.orgId);
      const projectIds = userProjects.map(p => p.id);

      const allTasks = [];
      for (const projectId of projectIds) {
        const projectTasks = await storage.getTasksForProject(projectId);
        allTasks.push(...projectTasks);
      }

      const icsContent = generateICS(allTasks.map(task => ({
        id: task.id,
        summary: task.title,
        description: task.description || '',
        start: task.deadline,
        end: task.deadline,
        type: 'task'
      })));

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename="tasks.ics"');
      res.send(icsContent);
    } catch (error: any) {
      console.error("Failed to export tasks:", error);
      res.status(500).json({ error: "Failed to export tasks" });
    }
  });

  // ===========================
  // Marina Map Locations API
  // ===========================

  app.get('/api/marina-map/locations', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const source = (req.query.source as string) || 'all';
      const stateFilter = req.query.state as string | undefined;
      const searchFilter = req.query.search as string | undefined;

      const results: any[] = [];

      if (source === 'all' || source === 'properties') {
        const conditions: any[] = [
          eq(crmProperties.orgId, orgId),
          eq(crmProperties.type, 'marina'),
        ];
        if (stateFilter) conditions.push(eq(crmProperties.state, stateFilter));
        if (searchFilter) conditions.push(ilike(crmProperties.title, `%${searchFilter}%`));

        const rows = await db.select().from(crmProperties).where(and(...conditions)).limit(500);
        for (const r of rows) {
          const coords = r.coordinates as any;
          results.push({
            id: r.id,
            source: 'property' as const,
            name: r.title,
            address: r.address,
            city: r.city,
            state: r.state,
            zipCode: r.zipCode,
            lat: coords?.lat ? Number(coords.lat) : null,
            lng: coords?.lng ? Number(coords.lng) : null,
            price: r.listingPrice ? Number(r.listingPrice) : null,
            slips: r.totalCapacity ?? (((r.wetSlips ?? 0) + (r.drySlips ?? 0)) || null),
            status: r.status,
            metrics: {
              wetSlips: r.wetSlips,
              drySlips: r.drySlips,
              totalCapacity: r.totalCapacity,
              listingPrice: r.listingPrice ? Number(r.listingPrice) : null,
            },
          });
        }
      }

      if (source === 'all' || source === 'projects') {
        const conditions: any[] = [eq(modelingProjects.orgId, orgId)];
        if (stateFilter) conditions.push(eq(modelingProjects.state, stateFilter));
        if (searchFilter) conditions.push(ilike(modelingProjects.marinaName, `%${searchFilter}%`));

        const rows = await db.select({
          project: modelingProjects,
          property: crmProperties,
        }).from(modelingProjects)
          .leftJoin(crmProperties, eq(modelingProjects.propertyId, crmProperties.id))
          .where(and(...conditions)).limit(500);
        for (const { project: r, property: p } of rows) {
          if (!r.city && !r.state && !p?.city && !p?.state) continue;
          const coords = p?.coordinates as any;
          results.push({
            id: r.id,
            source: 'project' as const,
            name: r.marinaName,
            address: r.address || p?.address,
            city: r.city || p?.city,
            state: r.state || p?.state,
            zipCode: r.zipCode || p?.zipCode,
            lat: coords?.lat ? Number(coords.lat) : null,
            lng: coords?.lng ? Number(coords.lng) : null,
            price: r.purchasePrice ? Number(r.purchasePrice) : null,
            slips: r.totalStorageUnits,
            status: r.dealOutcome,
            metrics: {
              purchasePrice: r.purchasePrice ? Number(r.purchasePrice) : null,
              totalStorageUnits: r.totalStorageUnits,
              dealOutcome: r.dealOutcome,
            },
          });
        }
      }

      if (source === 'all' || source === 'comps') {
        const orgOrGlobal = or(eq(salesComps.orgId, orgId), eq(salesComps.scope, 'global'));
        const conditions: any[] = [orgOrGlobal];
        if (stateFilter) conditions.push(eq(salesComps.state, stateFilter));
        if (searchFilter) conditions.push(ilike(salesComps.marina, `%${searchFilter}%`));

        const rows = await db.select().from(salesComps).where(and(...conditions)).limit(500);
        for (const r of rows) {
          results.push({
            id: r.id,
            source: 'comp' as const,
            name: r.marina,
            address: r.address,
            city: r.city,
            state: r.state,
            zipCode: r.zip,
            lat: r.lat ? Number(r.lat) : null,
            lng: r.lng ? Number(r.lng) : null,
            price: r.salePrice ? Number(r.salePrice) : null,
            slips: (r.wetSlips ?? 0) + (r.dryRacks ?? 0) || null,
            status: null,
            metrics: {
              salePrice: r.salePrice,
              capRate: r.capRate,
              noi: r.noi,
              wetSlips: r.wetSlips,
              dryRacks: r.dryRacks,
              saleYear: r.saleYear,
              bodyOfWater: r.bodyOfWater,
              region: r.region,
            },
          });
        }
      }

      if (source === 'all' || source === 'rate_comps') {
        const orgOrGlobal = or(eq(rateComps.orgId, orgId), eq(rateComps.scope, 'global'));
        const conditions: any[] = [orgOrGlobal];
        if (stateFilter) conditions.push(eq(rateComps.state, stateFilter));
        if (searchFilter) conditions.push(ilike(rateComps.marina, `%${searchFilter}%`));

        const rows = await db.select({
          id: rateComps.id,
          marina: rateComps.marina,
          address: rateComps.address,
          city: rateComps.city,
          state: rateComps.state,
          zip: rateComps.zip,
          lat: rateComps.lat,
          lng: rateComps.lng,
          salePrice: rateComps.salePrice,
          wetSlips: rateComps.wetSlips,
          dryRacks: rateComps.dryRacks,
          rateType: rateComps.rateType,
          seasonality: rateComps.seasonality,
          bodyOfWater: rateComps.bodyOfWater,
          region: rateComps.region,
          storageTypes: rateComps.storageTypes,
        }).from(rateComps).where(and(...conditions)).limit(500);
        for (const r of rows) {
          results.push({
            id: r.id,
            source: 'rate_comp' as const,
            name: r.marina,
            address: r.address,
            city: r.city,
            state: r.state,
            zipCode: r.zip,
            lat: r.lat ? Number(r.lat) : null,
            lng: r.lng ? Number(r.lng) : null,
            price: r.salePrice ? Number(r.salePrice) : null,
            slips: (r.wetSlips ?? 0) + (r.dryRacks ?? 0) || null,
            status: null,
            metrics: {
              rateType: r.rateType,
              seasonality: r.seasonality,
              wetSlips: r.wetSlips,
              dryRacks: r.dryRacks,
              bodyOfWater: r.bodyOfWater,
              region: r.region,
              storageTypes: r.storageTypes,
            },
          });
        }
      }

      if (source === 'all' || source === 'pipeline') {
        const { dealWorkspaces: dws } = await import('@shared/schema');
        const dealConditions: any[] = [eq(crmDeals.orgId, orgId)];
        if (searchFilter) dealConditions.push(ilike(crmDeals.title, `%${searchFilter}%`));

        const dealRows = await db.select({
          deal: crmDeals,
          property: crmProperties,
        }).from(crmDeals)
          .leftJoin(dws, eq(dws.dealId, crmDeals.id))
          .leftJoin(crmProperties, eq(dws.propertyId, crmProperties.id))
          .where(and(...dealConditions))
          .limit(500);

        for (const row of dealRows) {
          const d = row.deal;
          const p = row.property;
          const coords = p?.coordinates as any;
          const lat = coords?.lat ? Number(coords.lat) : null;
          const lng = coords?.lng ? Number(coords.lng) : null;
          const city = p?.city || d.city || null;
          const state = p?.state || d.state || null;
          if (stateFilter && state !== stateFilter) continue;
          results.push({
            id: d.id,
            source: 'pipeline' as const,
            name: d.title,
            address: p?.address || null,
            city,
            state,
            zipCode: p?.zipCode || null,
            lat,
            lng,
            price: d.amount ? Number(d.amount) : null,
            slips: p ? (p.totalCapacity ?? (((p.wetSlips ?? 0) + (p.drySlips ?? 0)) || null)) : null,
            status: d.stage,
            metrics: {
              stage: d.stage,
              priority: d.priority,
              amount: d.amount ? Number(d.amount) : null,
              probability: d.probability,
              propertyName: p?.title || null,
            },
          });
        }
      }

      if (source === 'all' || source === 'listings') {
        const orgOrGlobal = or(eq(marinaListings.orgId, orgId), eq(marinaListings.scope, 'global'));
        const conditions: any[] = [orgOrGlobal];
        if (stateFilter) conditions.push(eq(marinaListings.state, stateFilter));
        if (searchFilter) {
          conditions.push(
            or(
              ilike(marinaListings.title, `%${searchFilter}%`),
              ilike(marinaListings.propertyName, `%${searchFilter}%`)
            )
          );
        }

        const rows = await db.select().from(marinaListings).where(and(...conditions)).limit(500);
        for (const r of rows) {
          results.push({
            id: r.id,
            source: 'listing' as const,
            name: r.propertyName || r.title,
            address: r.propertyAddress,
            city: r.city,
            state: r.state,
            zipCode: r.zipCode,
            lat: r.latitude ? Number(r.latitude) : null,
            lng: r.longitude ? Number(r.longitude) : null,
            price: r.askingPrice ? Number(r.askingPrice) : null,
            slips: r.totalSlips,
            status: r.status,
            metrics: {
              askingPrice: r.askingPrice ? Number(r.askingPrice) : null,
              totalSlips: r.totalSlips,
              marinaType: r.marinaType,
              dealType: r.dealType,
            },
          });
        }
      }

      const needsGeocoding = results.filter(r => r.lat == null && r.lng == null && (r.address || r.city));
      if (needsGeocoding.length > 0) {
        const { geocodingService } = await import('../services/geocodingService');
        const BATCH_LIMIT = 25;
        const toGeocode = needsGeocoding.slice(0, BATCH_LIMIT);
        const geocodePromises = toGeocode.map(async (loc) => {
          try {
            const addressStr = geocodingService.buildAddressString({
              address: loc.address || undefined,
              city: loc.city || undefined,
              state: loc.state || undefined,
              zip: loc.zipCode || undefined,
            });
            if (!addressStr) return;
            const result = await geocodingService.geocodeAddress(addressStr);
            if ('lat' in result && 'lng' in result) {
              loc.lat = result.lat;
              loc.lng = result.lng;
              try {
                if (loc.source === 'property') {
                  await db.update(crmProperties).set({ coordinates: { lat: result.lat, lng: result.lng } }).where(eq(crmProperties.id, loc.id));
                } else if (loc.source === 'comp') {
                  await db.update(salesComps).set({ lat: String(result.lat), lng: String(result.lng) }).where(eq(salesComps.id, loc.id));
                } else if (loc.source === 'rate_comp') {
                  await db.update(rateComps).set({ lat: String(result.lat), lng: String(result.lng) }).where(eq(rateComps.id, loc.id));
                } else if (loc.source === 'pipeline' && loc.metrics?.propertyId) {
                  await db.update(crmProperties).set({ coordinates: { lat: result.lat, lng: result.lng } }).where(eq(crmProperties.id, loc.metrics.propertyId));
                }
              } catch (dbErr: any) {
                console.error(`[Marina Map] Failed to persist geocode for ${loc.source}/${loc.id}:`, dbErr.message);
              }
            }
          } catch (err: any) {
            console.error(`[Marina Map] Geocode error for ${loc.name}:`, err.message);
          }
        });
        await Promise.all(geocodePromises);
      }

      const deduped: any[] = [];
      if (source === 'all') {
        const grouped = new Map<string, any[]>();
        for (const r of results) {
          const normName = (r.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
          const latBucket = r.lat != null ? Math.round(r.lat * 10) : 'none';
          const lngBucket = r.lng != null ? Math.round(r.lng * 10) : 'none';
          const key = `${normName}|${(r.city || '').toLowerCase()}|${(r.state || '').toUpperCase()}|${latBucket}|${lngBucket}`;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(r);
        }
        for (const items of grouped.values()) {
          if (items.length === 1) {
            deduped.push(items[0]);
          } else {
            const primary = items.reduce((best: any, cur: any) => {
              if (cur.lat != null && best.lat == null) return cur;
              if (cur.price != null && best.price == null) return cur;
              return best;
            }, items[0]);
            const sources = items.map((i: any) => ({
              id: i.id,
              source: i.source,
              name: i.name,
              price: i.price,
              status: i.status,
              metrics: i.metrics,
            }));
            deduped.push({
              ...primary,
              groupedSources: sources,
              groupCount: items.length,
            });
          }
        }
      } else {
        deduped.push(...results);
      }

      const withCoordinates = deduped.filter(r => r.lat != null && r.lng != null).length;
      const bySource: Record<string, number> = { property: 0, project: 0, comp: 0, rate_comp: 0, listing: 0, pipeline: 0 };
      const byState: Record<string, number> = {};
      for (const r of deduped) {
        if (r.groupedSources) {
          for (const gs of r.groupedSources) {
            bySource[gs.source] = (bySource[gs.source] || 0) + 1;
          }
        } else {
          bySource[r.source] = (bySource[r.source] || 0) + 1;
        }
        if (r.state) {
          byState[r.state] = (byState[r.state] || 0) + 1;
        }
      }

      res.json({
        locations: deduped,
        stats: {
          total: deduped.length,
          totalRaw: results.length,
          withCoordinates,
          needsGeocoding: needsGeocoding.length,
          geocodedThisRequest: Math.min(needsGeocoding.length, 25),
          bySource,
          byState,
        },
      });
    } catch (error: any) {
      console.error('Marina map locations error:', error);
      res.status(500).json({ error: 'Failed to fetch marina map locations' });
    }
  });

  // ===========================
  // SalesComps Module Routes
  // ===========================

  // Sales Comps CRUD routes
  app.get('/api/sales-comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const includeGlobal = req.query.includeGlobal === 'true';
      const scopeFilter = req.query.scope as string | undefined; // 'all' | 'org' | 'global'

      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const filters = compFiltersSchema.parse(req.query);
      const sqlFilters = filterBuilder.buildFilters(filters);
      
      // Fetch org-specific comps (unless filtering to global only)
      let comps: any[] = [];
      let total = 0;
      
      if (scopeFilter !== 'global') {
        const orgResult = await storage.getComps({
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
            .from(salesComps)
            .where(eq(salesComps.scope, "global"))
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
          console.warn("Could not fetch global comps:", globalErr);
        }
      }

      res.json({ comps, total, page: filters.page, pageSize: filters.pageSize });
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid filter parameters", issues: error.errors });
      }
      console.error("Error fetching comps:", error);
      res.status(500).json({ message: "Failed to fetch comps" });
    }
  });
  app.get('/api/sales-comps/ids', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const ids = await storage.getAllCompIds(orgId);
      res.json({ ids });
    } catch (error: any) {
      console.error('Error getting comp IDs:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get('/api/sales-comps/column-values/:column', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { column } = req.params;
      const values = await storage.getColumnUniqueValues(orgId, column);
      res.json({ values });
    } catch (error: any) {
      console.error('Error getting column values:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Custom Storage Types routes (must be before /:id route)
  app.get('/api/sales-comps/custom-storage-types', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const types = await storage.getScCustomStorageTypes(orgId);
      res.json(types);
    } catch (error: any) {
      console.error("Error fetching custom storage types:", error);
      res.status(500).json({ message: "Failed to fetch custom storage types" });
    }
  });

  app.post('/api/sales-comps/custom-storage-types', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: "Storage type name is required" });
      }

      // Check for duplicates (case-insensitive)
      const existing = await storage.getScCustomStorageTypes(orgId);
      if (existing.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
        return res.status(400).json({ message: "Storage type already exists" });
      }

      const type = await storage.createScCustomStorageType({
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

  app.delete('/api/sales-comps/custom-storage-types/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteScCustomStorageType(req.params.id, orgId);

      if (!success) return res.status(404).json({ message: "Storage type not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting custom storage type:", error);
      res.status(500).json({ message: "Failed to delete custom storage type" });
    }
  });

  // Custom Column Management routes (must be before /:id route)
  app.get('/api/sales-comps/columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const columns = await storage.getCompColumns(orgId);
      res.json(columns);
    } catch (error: any) {
      console.error("Error fetching custom columns:", error);
      res.status(500).json({ message: "Failed to fetch custom columns" });
    }
  });

  app.post('/api/sales-comps/columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { key, label, type, options, required, visible, orderIndex } = req.body;

      if (!key || !label || !type) {
        return res.status(400).json({ message: "Field key, label, and type are required" });
      }

      // Check for duplicate key
      const existing = await storage.getCompColumns(orgId);
      if (existing.some(c => c.key === key)) {
        return res.status(400).json({ message: "Column with this key already exists" });
      }

      const column = await storage.createCompColumn({
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

  app.delete('/api/sales-comps/columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteCompColumn(req.params.id, orgId);

      if (!success) return res.status(404).json({ message: "Column not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting custom column:", error);
      res.status(500).json({ message: "Failed to delete custom column" });
    }
  });

  // Pending Property Profiles routes (must be before /:id route)
  app.get('/api/sales-comps/pending-property-profiles', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const status = req.query.status as string | undefined;
      const profiles = await storage.getPendingPropertyProfiles(orgId, status);
      res.json(profiles);
    } catch (error: any) {
      console.error("Error fetching pending property profiles:", error);
      res.status(500).json({ message: "Failed to fetch pending property profiles" });
    }
  });

  app.post('/api/sales-comps/pending-property-profiles', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { compId, status } = req.body;

      if (!compId) {
        return res.status(400).json({ message: "compId is required" });
      }

      const profile = await storage.createPendingPropertyProfile({
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

  app.patch('/api/sales-comps/pending-property-profiles/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.body;
      
      // Verify ownership before updating
      const existing = await storage.getPendingPropertyProfiles(orgId);
      const profile = existing.find(p => p.id === req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Pending property profile not found" });
      }
      
      const updated = await storage.updatePendingPropertyProfile(req.params.id, { status });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating pending property profile:", error);
      res.status(500).json({ message: "Failed to update pending property profile" });
    }
  });

  app.delete('/api/sales-comps/pending-property-profiles/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Verify ownership before deleting
      const existing = await storage.getPendingPropertyProfiles(orgId);
      const profile = existing.find(p => p.id === req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Pending property profile not found" });
      }
      
      const success = await storage.deletePendingPropertyProfile(req.params.id);
      if (!success) return res.status(404).json({ message: "Pending property profile not found" });
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting pending property profile:", error);
      res.status(500).json({ message: "Failed to delete pending property profile" });
    }
  });

  app.get('/api/sales-comps/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const comp = await storage.getComp(req.params.id, orgId);
      if (!comp) return res.status(404).json({ message: "Comp not found" });
      res.json(comp);
    } catch (error: any) {
      console.error("Error fetching comp:", error);
      res.status(500).json({ message: "Failed to fetch comp" });
    }
  });

  app.post('/api/sales-comps/backfill-properties', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      
      
      const result = await storage.getComps({ orgId, pageSize: 10000 });
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
              description: `Auto-created from sales comp backfill`,
            });
            
            propertyId = newProperty.id;
            created++;
          }
          
          if (propertyId) {
            await storage.updateComp(comp.id, { propertyId }, orgId);
          }
        } catch (error: any) {
          failed++;
          console.error(`❌ Failed to process comp ${comp.id}:`, error);
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

  app.post('/api/sales-comps', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const compData = salesCompCreateSchema.parse(req.body);

      // Map user-friendly field names to database column names
      const mappedData = {
        ...compData,
        // Map sellerCompany -> seller (Seller Company in the form)
        seller: compData.sellerCompany || compData.seller,
        // Map sellerPrincipal -> owner (Seller Principal in the form)
        owner: compData.sellerPrincipal || compData.owner,
        // Map buyerCompany -> company (Buyer Company in the form)
        company: compData.buyerCompany || compData.company,
        orgId: req.user.orgId,
        // Map buyerPrincipal -> buyer (Buyer Principal in the form)
        buyer: compData.buyerPrincipal || compData.buyer,
      };

      const comp = await compService.createComp({
        ...mappedData,
        orgId,
        createdBy: userId,
      }, userId);

      // Auto-create pending company if buyerCompany was provided
      if (compData.buyerCompany) {
        try {
          await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: comp.id,
            orgId,
            userId,
            companyName: compData.buyerCompany,
            role: 'buyer',
            city: compData.city,
            state: compData.state,
          });
        } catch (companyError) {
          console.error('Error auto-creating pending buyer company:', companyError);
        }
      }

      // Auto-create pending company if sellerCompany was provided
      if (compData.sellerCompany) {
        try {
          await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: comp.id,
            orgId,
            userId,
            companyName: compData.sellerCompany,
            role: 'seller',
            city: compData.city,
            state: compData.state,
          });
        } catch (companyError) {
          console.error('Error auto-creating pending seller company:', companyError);
        }
      }

      // Auto-create pending company for brokerage if brokerage name was provided but no brokerageCompanyId linked
      if (compData.brokerage && !compData.brokerageCompanyId) {
        try {
          await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: comp.id,
            orgId,
            userId,
            companyName: compData.brokerage,
            role: 'brokerage',
            city: compData.city,
            state: compData.state,
          });
        } catch (companyError) {
          console.error('Error auto-creating pending brokerage company:', companyError);
        }
      }

      // Auto-create pending contact if agent info was provided
      if (compData.agentFirstName || compData.agentLastName) {
        try {
          await storage.autoCreatePendingContactFromSalesComp({
            salesCompId: comp.id,
            orgId,
            userId,
            agentFirstName: compData.agentFirstName,
            agentLastName: compData.agentLastName,
            brokerage: compData.brokerage,
          });
        } catch (contactError) {
          console.error('Error auto-creating pending contact:', contactError);
        }
      }

      // Auto-create pending contacts for Seller Principal and Buyer Principal
      const principalEntries = [
        { name: (compData.sellerPrincipal || '').trim(), role: 'seller_principal' },
        { name: (compData.buyerPrincipal || '').trim(), role: 'buyer_principal' },
      ];
      for (const entry of principalEntries) {
        if (entry.name) {
          try {
            const parts = entry.name.split(' ');
            const firstName = parts[0] || '';
            const lastName = parts.slice(1).join(' ') || '';
            const fullName = entry.name;

            const similarContacts = await storage.findSimilarContacts(orgId, fullName);

            await storage.createPendingContact({
              orgId,
              sourceType: 'sales_comp',
              sourceId: comp.id,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              fullName,
              status: 'pending',
              suggestedDuplicates: similarContacts.map((c: any) => c.id),
              sourceMetadata: { salesCompId: comp.id, marina: compData.marina, role: entry.role },
              createdBy: userId,
            });
          } catch (principalError) {
            console.error('Error auto-creating pending ' + entry.role + ' contact:', principalError);
          }
        }
      }

      // Auto-create pending property if marina/property data is provided but not linked to existing property
      if (!compData.propertyId && compData.marina) {
        try {
          // Check if a pending property already exists for this sales comp
          const existingPending = await storage.getPendingProperties(orgId, 'pending');
          const alreadyExists = existingPending.some((p: any) => 
            p.sourceType === 'sales_comp' && p.compId === comp.id
          );
          
          if (!alreadyExists) {
            // Find similar properties to suggest as duplicates
            const similarProperties = await storage.findSimilarProperties(
              orgId, 
              compData.marina, 
              compData.city, 
              compData.state
            );
            
            await storage.createPendingProperty({
              orgId,
              sourceType: 'sales_comp',
              compId: comp.id,
              marinaName: compData.marina,
              city: compData.city || null,
              state: compData.state || null,
              address: compData.address || null,
              salePrice: compData.salePrice ? Number(compData.salePrice) : null,
              status: 'pending',
              suggestedDuplicates: similarProperties.map((p: any) => p.id),
              compMetadata: {
                wetSlips: compData.wetSlips,
                drySlips: compData.drySlips,
                buyer: compData.buyerCompany,
                seller: compData.sellerCompany,
                saleDate: compData.saleDate,
              },
              createdBy: userId,
            });
            logger.info({ marina: compData.marina }, "[SalesComps] Created pending property");
          }
        } catch (propertyError) {
          console.error('Error auto-creating pending property:', propertyError);
        }
      }

      // Auto-create pending brokerage company if brokerage name is provided but not linked
      if (!compData.brokerageCompanyId && compData.brokerage && compData.brokerage.trim()) {
        try {
          await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: comp.id,
            orgId,
            userId,
            companyName: compData.brokerage.trim(),
            role: 'brokerage' as any,
            city: compData.city,
            state: compData.state,
          });
          logger.info({ brokerage: compData.brokerage }, "[SalesComps] Created pending brokerage company");
        } catch (brokerageError) {
          console.error('Error auto-creating pending brokerage company:', brokerageError);
        }
      }

      // Auto-create pending contacts for additional agents
      if (compData.additionalAgents && Array.isArray(compData.additionalAgents)) {
        for (let i = 0; i < compData.additionalAgents.length; i++) {
          const agent = compData.additionalAgents[i];
          // Only create pending contact if agent has a name but no linked contactId
          if (agent && agent.name && agent.name.trim() && !agent.contactId) {
            try {
              // Parse the name into first and last name
              const nameParts = agent.name.trim().split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              
              // Use a unique sourceId for each additional agent
              const agentSourceId = comp.id + ':agent:' + i;
              
              // Check if pending contact already exists for this agent
              const existingPending = await storage.getPendingContacts(orgId, 'pending');
              const alreadyExists = existingPending.some((c: any) => 
                c.sourceType === 'sales_comp' && c.sourceId === agentSourceId
              );
              
              if (!alreadyExists) {
                const similarContacts = await storage.findSimilarContacts(orgId, firstName, lastName);
                
                await storage.createPendingContact({
                  orgId,
                  sourceType: 'sales_comp',
                  sourceId: agentSourceId,
                  fullName: agent.name.trim(),
                  status: 'pending',
                  suggestedDuplicates: similarContacts.map((c: any) => c.id),
                  sourceMetadata: {
                    salesCompId: comp.id,
                    agentFirstName: firstName,
                    agentLastName: lastName,
                    brokerage: compData.brokerage,
                    isAdditionalAgent: true,
                    agentIndex: i,
                  },
                  createdBy: userId,
                });
                logger.info({ agentName: agent.name }, "[SalesComps] Created pending contact for additional agent");
              }
            } catch (agentError) {
              console.error('Error auto-creating pending contact for additional agent "' + agent.name + '":', agentError);
            }
          }
        }
      }
      res.status(201).json(comp);
    } catch (error: any) {
      console.error("Error creating comp:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      const errorMessage = error.message || "Failed to create comp";
      res.status(500).json({ message: errorMessage, details: error.code || error.name });
    }
  });

  app.patch('/api/sales-comps/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const updates = salesCompUpdateSchema.parse(req.body);

      // Map user-friendly field names to database column names
      const mappedUpdates = {
        ...updates,
        // Map sellerCompany -> seller (Seller Company in the form)
        seller: updates.sellerCompany || updates.seller,
        // Map sellerPrincipal -> owner (Seller Principal in the form)
        owner: updates.sellerPrincipal || updates.owner,
        // Map buyerCompany -> company (Buyer Company in the form)
        company: updates.buyerCompany || updates.company,
        orgId: req.user.orgId,
        // Map buyerPrincipal -> buyer (Buyer Principal in the form)
        buyer: updates.buyerPrincipal || updates.buyer,
      };

      const comp = await compService.updateComp(
        req.params.id,
        { ...mappedUpdates, updatedBy: userId },
        orgId,
        userId
      );

      if (!comp) return res.status(404).json({ message: "Comp not found" });

      // Auto-create pending company if buyerCompany was provided
      if (updates.buyerCompany) {
        try {
          await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: req.params.id,
            orgId,
            userId,
            companyName: updates.buyerCompany,
            role: 'buyer',
            city: updates.city,
            state: updates.state,
          });
        } catch (companyError) {
          console.error('Error auto-creating pending buyer company:', companyError);
        }
      }

      // Auto-create pending company if sellerCompany was provided
      if (updates.sellerCompany) {
        try {
          await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: req.params.id,
            orgId,
            userId,
            companyName: updates.sellerCompany,
            role: 'seller',
            city: updates.city,
            state: updates.state,
          });
        } catch (companyError) {
          console.error('Error auto-creating pending seller company:', companyError);
        }
      }

      // Auto-create pending company for brokerage if brokerage name was provided but no brokerageCompanyId linked
      if (updates.brokerage && !updates.brokerageCompanyId) {
        try {
          await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: req.params.id,
            orgId,
            userId,
            companyName: updates.brokerage,
            role: 'brokerage',
            city: updates.city,
            state: updates.state,
          });
        } catch (companyError) {
          console.error('Error auto-creating pending brokerage company:', companyError);
        }
      }

      // Auto-create pending contact if agent info was provided
      if (updates.agentFirstName || updates.agentLastName) {
        try {
          await storage.autoCreatePendingContactFromSalesComp({
            salesCompId: req.params.id,
            orgId,
            userId,
            agentFirstName: updates.agentFirstName,
            agentLastName: updates.agentLastName,
            brokerage: updates.brokerage,
          });
        } catch (contactError) {
          console.error('Error auto-creating pending contact:', contactError);
        }
      }

      // Auto-create pending contacts for Seller Principal and Buyer Principal
      const principalEntries = [
        { name: (updates.sellerPrincipal || '').trim(), role: 'seller_principal' },
        { name: (updates.buyerPrincipal || '').trim(), role: 'buyer_principal' },
      ];
      for (const entry of principalEntries) {
        if (entry.name) {
          try {
            const parts = entry.name.split(' ');
            const firstName = parts[0] || '';
            const lastName = parts.slice(1).join(' ') || '';
            const fullName = entry.name;

            const similarContacts = await storage.findSimilarContacts(orgId, fullName);

            await storage.createPendingContact({
              orgId,
              sourceType: 'sales_comp',
              sourceId: req.params.id,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              fullName,
              status: 'pending',
              suggestedDuplicates: similarContacts.map((c: any) => c.id),
              sourceMetadata: { salesCompId: req.params.id, marina: updates.marina, role: entry.role },
              createdBy: userId,
            });
          } catch (principalError) {
            console.error('Error auto-creating pending ' + entry.role + ' contact:', principalError);
          }
        }
      }

      // Auto-create pending property if marina/property data is updated but not linked to existing property
      if (!updates.propertyId && updates.marina) {
        try {
          const existingPending = await storage.getPendingProperties(orgId, 'pending');
          const alreadyExists = existingPending.some((p: any) => 
            p.sourceType === 'sales_comp' && p.compId === req.params.id
          );
          
          if (!alreadyExists) {
            const similarProperties = await storage.findSimilarProperties(
              orgId, 
              updates.marina, 
              updates.city, 
              updates.state
            );
            
            await storage.createPendingProperty({
              orgId,
              sourceType: 'sales_comp',
              compId: req.params.id,
              marinaName: updates.marina,
              city: updates.city || null,
              state: updates.state || null,
              address: updates.address || null,
              salePrice: updates.salePrice ? Number(updates.salePrice) : null,
              status: 'pending',
              suggestedDuplicates: similarProperties.map((p: any) => p.id),
              compMetadata: {
                wetSlips: updates.wetSlips,
                drySlips: updates.drySlips,
                buyer: updates.buyerCompany,
                seller: updates.sellerCompany,
                saleDate: updates.saleDate,
              },
              createdBy: userId,
            });
          }
        } catch (propertyError) {
          console.error('Error auto-creating pending property on update:', propertyError);
        }
      }

      // Auto-create pending brokerage company if brokerage name is updated but not linked
      if (!updates.brokerageCompanyId && updates.brokerage && updates.brokerage.trim()) {
        try {
          await storage.autoCreatePendingCompanyFromSalesComp({
            salesCompId: req.params.id,
            orgId,
            userId,
            companyName: updates.brokerage.trim(),
            role: 'brokerage' as any,
            city: updates.city,
            state: updates.state,
          });
        } catch (brokerageError) {
          console.error('Error auto-creating pending brokerage company on update:', brokerageError);
        }
      }

      // Auto-create pending contacts for additional agents on update
      if (updates.additionalAgents && Array.isArray(updates.additionalAgents)) {
        for (let i = 0; i < updates.additionalAgents.length; i++) {
          const agent = updates.additionalAgents[i];
          if (agent && agent.name && agent.name.trim() && !agent.contactId) {
            try {
              const nameParts = agent.name.trim().split(' ');
              const firstName = nameParts[0] || '';
              const lastName = nameParts.slice(1).join(' ') || '';
              const agentSourceId = req.params.id + ':agent:' + i;
              
              const existingPending = await storage.getPendingContacts(orgId, 'pending');
              const alreadyExists = existingPending.some((c: any) => 
                c.sourceType === 'sales_comp' && c.sourceId === agentSourceId
              );
              
              if (!alreadyExists) {
                const similarContacts = await storage.findSimilarContacts(orgId, firstName, lastName);
                
                await storage.createPendingContact({
                  orgId,
                  sourceType: 'sales_comp',
                  sourceId: agentSourceId,
                  fullName: agent.name.trim(),
                  status: 'pending',
                  suggestedDuplicates: similarContacts.map((c: any) => c.id),
                  sourceMetadata: {
                    salesCompId: req.params.id,
                    agentFirstName: firstName,
                    agentLastName: lastName,
                    brokerage: updates.brokerage,
                    isAdditionalAgent: true,
                    agentIndex: i,
                  },
                  createdBy: userId,
                });
              }
            } catch (agentError) {
              console.error('Error auto-creating pending contact for additional agent on update:', agentError);
            }
          }
        }
      }

      res.json(comp);
    } catch (error: any) {
      console.error("Error updating comp:", error);
      res.status(500).json({ message: "Failed to update comp" });
    }
  });

  app.delete('/api/sales-comps/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const success = await compService.deleteComp(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Comp not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting comp:", error);
      res.status(500).json({ message: "Failed to delete comp" });
    }
  });

  app.post('/api/sales-comps/:id/duplicate', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const originalComp = await storage.getCompById(id, orgId);
      if (!originalComp) {
        return res.status(404).json({ message: "Comp not found" });
      }

      const duplicatedComp = await compService.duplicateComp(id, orgId, userId);
      res.status(201).json(duplicatedComp);
    } catch (error: any) {
      console.error("Error duplicating comp:", error);
      res.status(500).json({ message: "Failed to duplicate comp" });
    }
  });

  app.post('/api/sales-comps/bulk-update', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { ids, updates } = bulkUpdateSchema.parse(req.body);
      const count = await compService.bulkUpdateComps(ids, updates, orgId, userId);

      res.json({ updated: count });
    } catch (error: any) {
      console.error("Error bulk updating comps:", error);
      res.status(500).json({ message: "Failed to bulk update comps" });
    }
  });

  app.post('/api/sales-comps/bulk-delete', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid or empty IDs array" });
      }

      const count = await compService.bulkDeleteComps(ids, orgId, userId);
      res.json({ deleted: count });
    } catch (error: any) {
      console.error("Error bulk deleting comps:", error);
      res.status(500).json({ message: "Failed to bulk delete comps" });
    }
  });

  // Geocoding endpoint
  app.post('/api/sales-comps/:id/geocode', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const comp = await storage.getCompById(id, orgId);
      if (!comp) {
        return res.status(404).json({ message: "Comp not found" });
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

      await compService.updateComp(
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
      console.error("Error geocoding comp:", error);
      res.status(500).json({ message: "Failed to geocode comp" });
    }
  });

  // Upload and Import routes
  app.post('/api/sales-comps/upload', uploadSalesComps.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const analysis = await parserService.analyzeFile(req.file);
      const fullData = await parserService.parseFullFile(req.file);
      
      
      const importRecord = await storage.createImport({
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
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.post('/api/sales-comps/import/:importId/detect-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { mapping, normalization } = req.body;
      
      const result = await compService.detectDuplicates(
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

  app.post('/api/sales-comps/import/:importId/preview', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { mapping, normalization, importMode = 'upsert', updateBlankValues = false } = req.body;
      
      const result = await compService.previewImport(
        req.params.importId,
        orgId,
        mapping,
        normalization,
        importMode,
        updateBlankValues
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error previewing import:", error);
      res.status(500).json({ message: "Failed to preview import" });
    }
  });

  app.post('/api/sales-comps/import/:importId/commit', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const { mapping, normalization, excludedRows = [], parentPortfolioId, importMode = 'upsert', updateBlankValues = false } = req.body;
      
      
      const result = await compService.processImport(
        req.params.importId,
        orgId,
        userId,
        mapping,
        normalization,
        excludedRows,
        parentPortfolioId,
        importMode,
        updateBlankValues
      );
      

      res.json(result);
    } catch (error: any) {
      console.error("Error processing import:", error);
      res.status(500).json({ message: "Failed to process import" });
    }
  });

  app.get('/api/sales-comps/import/:importId/status', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const importRecord = await storage.getImport(req.params.importId, orgId);
      if (!importRecord) return res.status(404).json({ message: "Import not found" });

      res.json(importRecord);
    } catch (error: any) {
      console.error("Error fetching import status:", error);
      res.status(500).json({ message: "Failed to fetch import status" });
    }
  });
  app.post('/api/sales-comps/import/:importId/submit-reviewed', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { reviewedRows, parentPortfolioId } = req.body;

      if (!reviewedRows || !Array.isArray(reviewedRows)) {
        return res.status(400).json({ message: "reviewedRows array is required" });
      }

      const results = {
        successCount: 0,
        errorCount: 0,
        errors: [] as Array<{ row: number; message: string }>,
      };

      for (let i = 0; i < reviewedRows.length; i++) {
        const row = reviewedRows[i];
        try {
          if (!row.marina || !String(row.marina).trim()) {
            results.errors.push({ row: i + 1, message: 'Marina name is still missing' });
            results.errorCount++;
            continue;
          }

          const insertData: any = {
            orgId,
            createdBy: userId,
            updatedBy: userId,
            marina: row.marina,
            salePrice: row.salePrice || undefined,
            isPriceDisclosed: Boolean(row.salePrice),
            capRate: row.capRate || undefined,
            isCapRateDisclosed: Boolean(row.capRate),
            noi: row.noi || undefined,
            isNoiDisclosed: Boolean(row.noi),
            saleMonth: row.saleMonth || undefined,
            saleYear: row.saleYear || undefined,
            state: row.state || undefined,
            city: row.city || undefined,
            region: row.region || undefined,
            wetSlips: row.wetSlips || undefined,
            dryRacks: row.dryRacks || undefined,
            ioBoth: row.ioBoth || undefined,
            bodyOfWater: row.bodyOfWater || undefined,
            waterfront: row.waterfront || undefined,
            saleCondition: row.saleCondition || undefined,
            daysOnMarket: row.daysOnMarket || undefined,
            broker: row.broker || undefined,
            agentFirstName: row.agentFirstName || undefined,
            agentLastName: row.agentLastName || undefined,
            brokerage: row.brokerage || undefined,
            address: row.address || undefined,
            zip: row.zip || undefined,
            seller: row.seller || undefined,
            company: row.company || undefined,
            owner: row.owner || undefined,
            listPrice: row.listPrice || undefined,
            acres: row.acres || undefined,
            occupancy: row.occupancy || undefined,
            yearBuilt: row.yearBuilt || undefined,
            notes: row.notes || undefined,
            articleUrls: row.articleUrls || [],
            parentPortfolioId: parentPortfolioId || undefined,
          };

          const createdComp = await storage.createComp(insertData);
          results.successCount++;

          // Create pending entities from reviewed rows
          if (createdComp) {
            // Pending Property - only when no existing property match found
            const matchedProperty = await storage.findPropertyByLocation(orgId, String(row.marina).trim(), row.city, row.state).catch(() => null);
            if (row.marina && String(row.marina).trim() && !matchedProperty) {
              try {
                const propDuplicates = await DuplicateDetectionService.findPropertyDuplicates({
                  title: String(row.marina).trim(),
                  city: row.city,
                  state: row.state,
                  address: row.address,
                }, orgId);
                await storage.createPendingProperty({
                  orgId,
                  sourceType: 'sales_comp',
                  compId: createdComp.id,
                  marinaName: String(row.marina).trim(),
                  city: row.city || undefined,
                  state: row.state || undefined,
                  address: row.address || undefined,
                  salePrice: row.salePrice ? parseInt(row.salePrice) : undefined,
                  status: 'pending',
                  suggestedDuplicates: propDuplicates.matches.map((m: any) => m.existingEntity.id),
                  compMetadata: { salesCompId: createdComp.id },
                  createdBy: userId,
                });
              } catch (err) { console.error('Error creating pending property from review:', err); }
            }

            // Pending Companies: Seller Company, Buyer Company, Brokerage
            const companyEntries = [
              { name: (row.sellerCompany || row.seller || '').trim(), role: 'seller' },
              { name: (row.buyerCompany || row.company || '').trim(), role: 'buyer' },
              { name: (row.brokerage || '').trim(), role: 'brokerage' },
            ];
            for (const entry of companyEntries) {
              if (entry.name) {
                try {
                  const dupes = await DuplicateDetectionService.findCompanyDuplicates({ name: entry.name }, orgId);
                  await storage.createPendingCompany({
                    orgId,
                    name: entry.name,
                    city: row.city || undefined,
                    state: row.state || undefined,
                    status: 'pending',
                    suggestedDuplicates: dupes.matches.map((m: any) => m.existingEntity.id),
                    sourceMetadata: { salesCompId: createdComp.id, role: entry.role },
                    createdBy: userId,
                  });
                } catch (err) { console.error('Error creating pending ' + entry.role + ' company from review:', err); }
              }
            }

            // Pending Contacts: Seller Principal, Buyer Principal, Agent
            const contactEntries: Array<{name: string; role: string}> = [
              { name: (row.sellerPrincipal || '').trim(), role: 'seller_principal' },
              { name: (row.buyerPrincipal || '').trim(), role: 'buyer_principal' },
            ];
            const agentName = (row.agentFirstName && row.agentLastName)
              ? (row.agentFirstName.trim() + ' ' + row.agentLastName.trim())
              : (row.broker || '').trim();
            if (agentName) contactEntries.push({ name: agentName, role: 'agent' });

            for (const entry of contactEntries) {
              if (entry.name) {
                try {
                  const parts = entry.name.split(' ');
                  const firstName = parts[0] || '';
                  const lastName = parts.slice(1).join(' ') || '';
                  const dupes = await DuplicateDetectionService.findContactDuplicates({ firstName, lastName, fullName: entry.name }, orgId);
                  await storage.createPendingContact({
                    orgId,
                    sourceType: 'sales_comp',
                    sourceId: createdComp.id,
                    firstName: firstName || undefined,
                    lastName: lastName || undefined,
                    fullName: entry.name,
                    status: 'pending',
                    suggestedDuplicates: dupes.matches.map((m: any) => m.existingEntity.id),
                    sourceMetadata: { compId: createdComp.id, marina: row.marina, role: entry.role },
                    createdBy: userId,
                  });
                } catch (err) { console.error('Error creating pending ' + entry.role + ' contact from review:', err); }
              }
            }
          }
        } catch (error) {
          results.errors.push({ row: i + 1, message: (error as Error).message });
          results.errorCount++;
        }
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error submitting reviewed records:", error);
      res.status(500).json({ message: "Failed to submit reviewed records" });
    }
  });

  // Comp Columns management routes
  app.get('/api/comp-columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const columns = await storage.getCompColumns(orgId);
      res.json(columns);
    } catch (error: any) {
      console.error("Error fetching columns:", error);
      res.status(500).json({ message: "Failed to fetch columns" });
    }
  });

  app.post('/api/comp-columns', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const columnData = compColumnCreateSchema.parse(req.body);
      const column = await storage.createCompColumn({
        ...columnData,
        orgId,
      });

      res.status(201).json(column);
    } catch (error: any) {
      console.error("Error creating column:", error);
      res.status(500).json({ message: "Failed to create column" });
    }
  });

  app.patch('/api/comp-columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const updates = compColumnUpdateSchema.parse(req.body);
      const column = await storage.updateCompColumn(req.params.id, updates, orgId);

      if (!column) return res.status(404).json({ message: "Column not found" });
      res.json(column);
    } catch (error: any) {
      console.error("Error updating column:", error);
      res.status(500).json({ message: "Failed to update column" });
    }
  });

  app.delete('/api/comp-columns/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const success = await storage.deleteCompColumn(req.params.id, orgId);
      if (!success) return res.status(404).json({ message: "Column not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting column:", error);
      res.status(500).json({ message: "Failed to delete column" });
    }
  });

  // Analytics endpoint
  app.post('/api/sales-comps/analytics', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body;

      const metrics = await calculateMetrics(orgId, filters);
      
      // Use AI-powered insights with fallback to basic insights
      let insights;
      try {
        insights = await generateAIInsights(metrics, filters);
      } catch (aiError) {
        console.error("AI insights failed, using fallback:", aiError);
        const basicInsights = await generateInsights(metrics, filters);
        // Convert basic string insights to AIInsight format
        insights = basicInsights.map(text => ({
          category: 'trend',
          title: text.substring(0, 50),
          description: text,
          confidence: 'medium',
          priority: 3,
        }));
      }

      res.json({ metrics, insights });
    } catch (error: any) {
      console.error("Error calculating analytics:", error);
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  // Correlation analysis endpoint
  app.post('/api/sales-comps/analytics/correlation', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body;

      const correlationData = await calculateCorrelationData(orgId, filters);
      res.json(correlationData);
    } catch (error: any) {
      console.error("Error calculating correlation data:", error);
      res.status(500).json({ message: "Failed to calculate correlation data" });
    }
  });

  // Valuation models endpoint
  app.post('/api/sales-comps/analytics/valuation', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body;

      const valuationModels = await calculateValuationModels(orgId, filters);
      res.json(valuationModels);
    } catch (error: any) {
      console.error("Error calculating valuation models:", error);
      res.status(500).json({ message: "Failed to calculate valuation models" });
    }
  });

  // Matched comps endpoint
  app.post('/api/sales-comps/analytics/matched-comps', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body;

      const result = await getMatchedComps(orgId, filters);
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching matched comps:", error);
      res.status(500).json({ message: "Failed to fetch matched comps" });
    }
  });

  // Market Trends endpoint
  app.post('/api/sales-comps/analytics/trends', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: TrendsFilters = req.body || {};

      const trendsData = await getMarketTrends(orgId, filters);
      const insights = await generateTrendsInsights(trendsData);

      res.json({
        ...trendsData,
        insights,
      });
    } catch (error: any) {
      console.error("Error fetching market trends:", error);
      res.status(500).json({ message: "Failed to fetch market trends" });
    }
  });

  // Analytics Filter Presets routes
  app.get('/api/sales-comps/analytics/filter-presets', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const presets = await storage.getAnalyticsFilterPresets(orgId, userId);
      res.json(presets);
    } catch (error: any) {
      console.error("Error fetching analytics filter presets:", error);
      res.status(500).json({ message: "Failed to fetch analytics filter presets" });
    }
  });

  app.post('/api/sales-comps/analytics/filter-presets', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const presetData = insertScAnalyticsFilterPresetSchema.parse(req.body);
      const preset = await storage.createAnalyticsFilterPreset({
        ...presetData,
        orgId,
        userId,
      });

      res.status(201).json(preset);
    } catch (error: any) {
      console.error("Error creating analytics filter preset:", error);
      res.status(500).json({ message: "Failed to create analytics filter preset" });
    }
  });

  app.patch('/api/sales-comps/analytics/filter-presets/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const presetData = updateScAnalyticsFilterPresetSchema.parse(req.body);
      const preset = await storage.updateAnalyticsFilterPreset(req.params.id, presetData, orgId, userId);

      if (!preset) return res.status(404).json({ message: "Analytics filter preset not found" });

      res.json(preset);
    } catch (error: any) {
      console.error("Error updating analytics filter preset:", error);
      res.status(500).json({ message: "Failed to update analytics filter preset" });
    }
  });

  app.delete('/api/sales-comps/analytics/filter-presets/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;

      const success = await storage.deleteAnalyticsFilterPreset(req.params.id, orgId, userId);

      if (!success) return res.status(404).json({ message: "Analytics filter preset not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting analytics filter preset:", error);
      res.status(500).json({ message: "Failed to delete analytics filter preset" });
    }
  });

  // ================================================================================
  // INSTITUTIONAL DATA SERVICES - Geocoding, Quality Scoring, Validation, History
  // ================================================================================

  // Geocoding Service Routes
  app.post('/api/sales-comps/geocode', async (req: any, res) => {
    try {
      const { geocodingService } = await import('../services/salescomps/geocodingService');
      const { address, city, state, zip, country } = req.body;

      if (!geocodingService.isConfigured()) {
        return res.status(503).json({ message: "Geocoding service not configured" });
      }

      const result = await geocodingService.geocodeAddress({ address, city, state, zip, country });
      if (!result) {
        return res.status(404).json({ message: "Could not geocode address" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Geocoding error:", error);
      res.status(500).json({ message: "Failed to geocode address" });
    }
  });

  app.post('/api/sales-comps/:id/geocode', async (req: any, res) => {
    try {
      const { geocodingService } = await import('../services/salescomps/geocodingService');
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const compId = req.params.id;

      const comp = await storage.getCompById(compId, orgId);
      if (!comp) {
        return res.status(404).json({ message: "Comp not found" });
      }

      if (!geocodingService.isConfigured()) {
        return res.status(503).json({ message: "Geocoding service not configured" });
      }

      const result = await geocodingService.geocodeAddress({
        address: comp.address || undefined,
        city: comp.city || undefined,
        state: comp.state || undefined,
        zip: comp.zip || undefined,
      });

      if (!result) {
        return res.status(404).json({ message: "Could not geocode comp address" });
      }

      // Update comp with geocoded data
      const updated = await storage.updateComp(compId, {
        lat: result.lat.toString(),
        lng: result.lng.toString(),
        formattedAddress: result.formattedAddress,
        placeId: result.placeId,
        county: result.county,
        country: result.country,
        geocodeAccuracy: result.geocodeAccuracy,
        geocodedAt: new Date(),
        updatedBy: userId,
      }, orgId);

      res.json({ geocodeResult: result, updatedComp: updated });
    } catch (error: any) {
      console.error("Comp geocoding error:", error);
      res.status(500).json({ message: "Failed to geocode comp" });
    }
  });

  app.post('/api/sales-comps/batch-geocode', async (req: any, res) => {
    try {
      const { geocodingService } = await import('../services/salescomps/geocodingService');
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { compIds } = req.body;

      if (!geocodingService.isConfigured()) {
        return res.status(503).json({ message: "Geocoding service not configured" });
      }

      if (!Array.isArray(compIds) || compIds.length === 0) {
        return res.status(400).json({ message: "compIds array required" });
      }

      const results: { compId: string; success: boolean; error?: string }[] = [];

      for (const compId of compIds.slice(0, 50)) { // Limit to 50 at a time
        try {
          const comp = await storage.getCompById(compId, orgId);
          if (!comp) {
            results.push({ compId, success: false, error: "Not found" });
            continue;
          }

          const result = await geocodingService.geocodeAddress({
            address: comp.address || undefined,
            city: comp.city || undefined,
            state: comp.state || undefined,
            zip: comp.zip || undefined,
          });

          if (result) {
            await storage.updateComp(compId, {
              lat: result.lat.toString(),
              lng: result.lng.toString(),
              formattedAddress: result.formattedAddress,
              placeId: result.placeId,
              county: result.county,
              country: result.country,
              geocodeAccuracy: result.geocodeAccuracy,
              geocodedAt: new Date(),
              updatedBy: userId,
            }, orgId);
            results.push({ compId, success: true });
          } else {
            results.push({ compId, success: false, error: "Could not geocode" });
          }
        } catch (err) {
          results.push({ compId, success: false, error: "Processing error" });
        }
      }

      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };

      res.json(summary);
    } catch (error: any) {
      console.error("Batch geocoding error:", error);
      res.status(500).json({ message: "Failed to batch geocode" });
    }
  });

  // Address autocomplete for real-time suggestions
  app.get('/api/sales-comps/address-autocomplete', async (req: any, res) => {
    try {
      const { geocodingService } = await import('../services/salescomps/geocodingService');
      const { input, sessionToken } = req.query;

      if (!geocodingService.isConfigured()) {
        return res.status(503).json({ message: "Geocoding service not configured" });
      }

      if (!input || typeof input !== 'string') {
        return res.json([]);
      }

      const suggestions = await geocodingService.getAddressAutocomplete(
        input,
        sessionToken as string | undefined
      );

      res.json(suggestions);
    } catch (error: any) {
      console.error("Address autocomplete error:", error);
      res.status(500).json({ message: "Failed to get address suggestions" });
    }
  });

  // Geocode by place ID (from autocomplete selection)
  app.post('/api/sales-comps/geocode-place', async (req: any, res) => {
    try {
      const { geocodingService } = await import('../services/salescomps/geocodingService');
      const { placeId } = req.body;

      if (!geocodingService.isConfigured()) {
        return res.status(503).json({ message: "Geocoding service not configured" });
      }

      if (!placeId) {
        return res.status(400).json({ message: "placeId required" });
      }

      const result = await geocodingService.geocodeByPlaceId(placeId);
      if (!result) {
        return res.status(404).json({ message: "Could not geocode place" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Place geocoding error:", error);
      res.status(500).json({ message: "Failed to geocode place" });
    }
  });

  // Geocoding service stats
  app.get('/api/sales-comps/geocoding/stats', async (req: any, res) => {
    try {
      const { geocodingService } = await import('../services/salescomps/geocodingService');

      if (!geocodingService.isConfigured()) {
        return res.json({
          configured: false,
          message: "Geocoding service not configured",
        });
      }

      const stats = geocodingService.getStats();
      res.json({ configured: true, ...stats });
    } catch (error: any) {
      console.error("Geocoding stats error:", error);
      res.status(500).json({ message: "Failed to get geocoding stats" });
    }
  });

  // Data Quality Service Routes
  app.get('/api/sales-comps/:id/quality-score', async (req: any, res) => {
    try {
      const { dataQualityService } = await import('../services/salescomps/dataQualityService');
      const orgId = req.user.orgId;
      const compId = req.params.id;

      const comp = await storage.getCompById(compId, orgId);
      if (!comp) {
        return res.status(404).json({ message: "Comp not found" });
      }

      const qualityReport = dataQualityService.calculateQualityScore(comp);
      res.json(qualityReport);
    } catch (error: any) {
      console.error("Quality score error:", error);
      res.status(500).json({ message: "Failed to calculate quality score" });
    }
  });

  app.post('/api/sales-comps/batch-quality-score', async (req: any, res) => {
    try {
      const { dataQualityService } = await import('../services/salescomps/dataQualityService');
      const orgId = req.user.orgId;
      const { compIds } = req.body;

      let comps;
      if (compIds && Array.isArray(compIds)) {
        const allComps = await storage.getComps({ orgId, pageSize: 10000 });
        comps = allComps.comps.filter(c => compIds.includes(c.id));
      } else {
        const result = await storage.getComps({ orgId, pageSize: 1000 });
        comps = result.comps;
      }

      const batchQuality = dataQualityService.calculateBatchQuality(comps);
      res.json(batchQuality);
    } catch (error: any) {
      console.error("Batch quality score error:", error);
      res.status(500).json({ message: "Failed to calculate batch quality" });
    }
  });

  app.patch('/api/sales-comps/:id/update-quality-score', async (req: any, res) => {
    try {
      const { dataQualityService } = await import('../services/salescomps/dataQualityService');
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const compId = req.params.id;

      const comp = await storage.getCompById(compId, orgId);
      if (!comp) {
        return res.status(404).json({ message: "Comp not found" });
      }

      const qualityReport = dataQualityService.calculateQualityScore(comp);
      
      const updated = await storage.updateComp(compId, {
        dataQualityScore: qualityReport.overallScore,
        dataCompleteness: qualityReport.completenessScore,
        sourceConfidence: qualityReport.sourceReliabilityScore,
        updatedBy: userId,
      }, orgId);

      res.json({ qualityReport, updatedComp: updated });
    } catch (error: any) {
      console.error("Update quality score error:", error);
      res.status(500).json({ message: "Failed to update quality score" });
    }
  });

  // Validation Service Routes
  app.get('/api/sales-comps/validation-rules', async (req: any, res) => {
    try {
      const { validationService } = await import('../services/salescomps/validationService');
      const orgId = req.user.orgId;

      const orgRules = await validationService.getOrganizationRules(orgId);
      const defaultRules = validationService.getDefaultRules();

      res.json({
        organizationRules: orgRules,
        defaultRules,
      });
    } catch (error: any) {
      console.error("Validation rules error:", error);
      res.status(500).json({ message: "Failed to fetch validation rules" });
    }
  });

  app.post('/api/sales-comps/validate', async (req: any, res) => {
    try {
      const { validationService } = await import('../services/salescomps/validationService');
      const orgId = req.user.orgId;
      const { rows } = req.body;

      if (!Array.isArray(rows)) {
        return res.status(400).json({ message: "rows array required" });
      }

      const { results, summary } = await validationService.validateBatch(rows, orgId);
      res.json({ results, summary });
    } catch (error: any) {
      console.error("Validation error:", error);
      res.status(500).json({ message: "Failed to validate data" });
    }
  });

  app.post('/api/sales-comps/detect-outliers', async (req: any, res) => {
    try {
      const { validationService } = await import('../services/salescomps/validationService');
      const { rows, field, method } = req.body;

      if (!Array.isArray(rows) || !field) {
        return res.status(400).json({ message: "rows array and field required" });
      }

      const outlierIndices = validationService.detectOutliers(rows, field, method || 'iqr');
      res.json({ field, method: method || 'iqr', outlierIndices });
    } catch (error: any) {
      console.error("Outlier detection error:", error);
      res.status(500).json({ message: "Failed to detect outliers" });
    }
  });

  // Comp History Service Routes
  app.get('/api/sales-comps/:id/history', async (req: any, res) => {
    try {
      const { compHistoryService } = await import('../services/salescomps/compHistoryService');
      const orgId = req.user.orgId;
      const compId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 50;

      const history = await compHistoryService.getCompHistory(orgId, compId, limit);
      res.json(history);
    } catch (error: any) {
      console.error("Comp history error:", error);
      res.status(500).json({ message: "Failed to fetch comp history" });
    }
  });

  app.get('/api/sales-comps/:id/history/field/:field', async (req: any, res) => {
    try {
      const { compHistoryService } = await import('../services/salescomps/compHistoryService');
      const orgId = req.user.orgId;
      const compId = req.params.id;
      const field = req.params.field;

      const fieldHistory = await compHistoryService.getFieldHistory(orgId, compId, field);
      res.json(fieldHistory);
    } catch (error: any) {
      console.error("Field history error:", error);
      res.status(500).json({ message: "Failed to fetch field history" });
    }
  });

  app.post('/api/sales-comps/:id/history/rollback/:historyId', async (req: any, res) => {
    try {
      const { compHistoryService } = await import('../services/salescomps/compHistoryService');
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const compId = req.params.id;
      const historyId = req.params.historyId;

      const success = await compHistoryService.rollbackToVersion(orgId, compId, historyId, userId);
      res.json({ success });
    } catch (error: any) {
      console.error("History rollback error:", error);
      res.status(500).json({ message: "Failed to rollback to version" });
    }
  });

  app.get('/api/sales-comps/history/recent', async (req: any, res) => {
    try {
      const { compHistoryService } = await import('../services/salescomps/compHistoryService');
      const orgId = req.user.orgId;
      const limit = parseInt(req.query.limit as string) || 100;

      const recentChanges = await compHistoryService.getRecentOrgChanges(orgId, limit);
      res.json(recentChanges);
    } catch (error: any) {
      console.error("Recent changes error:", error);
      res.status(500).json({ message: "Failed to fetch recent changes" });
    }
  });

  // Comp Adjustment Service Routes
  app.post('/api/sales-comps/:id/adjustment', async (req: any, res) => {
    try {
      const { compAdjustmentService } = await import('../services/salescomps/compAdjustmentService');
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const compId = req.params.id;
      const { targetPropertyId, projectId, ...adjustments } = req.body;

      const adjustmentId = await compAdjustmentService.saveAdjustment(
        orgId,
        userId,
        compId,
        adjustments,
        targetPropertyId,
        projectId
      );

      res.json({ adjustmentId });
    } catch (error: any) {
      console.error("Adjustment save error:", error);
      res.status(500).json({ message: "Failed to save adjustment" });
    }
  });

  app.get('/api/sales-comps/:id/adjustment', async (req: any, res) => {
    try {
      const { compAdjustmentService } = await import('../services/salescomps/compAdjustmentService');
      const orgId = req.user.orgId;
      const compId = req.params.id;
      const targetPropertyId = req.query.targetPropertyId as string | undefined;

      const adjustment = await compAdjustmentService.getAdjustment(orgId, compId, targetPropertyId);
      if (!adjustment) {
        return res.status(404).json({ message: "Adjustment not found" });
      }

      res.json(adjustment);
    } catch (error: any) {
      console.error("Adjustment fetch error:", error);
      res.status(500).json({ message: "Failed to fetch adjustment" });
    }
  });

  app.post('/api/sales-comps/:id/calculate-adjustment', async (req: any, res) => {
    try {
      const { compAdjustmentService } = await import('../services/salescomps/compAdjustmentService');
      const orgId = req.user.orgId;
      const compId = req.params.id;
      const adjustments = req.body;

      const comp = await storage.getCompById(compId, orgId);
      if (!comp) {
        return res.status(404).json({ message: "Comp not found" });
      }

      const result = compAdjustmentService.calculateAdjustment(comp, adjustments, new Date());
      res.json(result);
    } catch (error: any) {
      console.error("Calculate adjustment error:", error);
      res.status(500).json({ message: "Failed to calculate adjustment" });
    }
  });

  app.post('/api/sales-comps/comparison-grid', async (req: any, res) => {
    try {
      const { compAdjustmentService } = await import('../services/salescomps/compAdjustmentService');
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { targetPropertyId, compIds } = req.body;

      if (!targetPropertyId || !Array.isArray(compIds)) {
        return res.status(400).json({ message: "targetPropertyId and compIds array required" });
      }

      const grid = await compAdjustmentService.buildComparisonGrid(
        orgId,
        targetPropertyId,
        compIds,
        userId
      );

      res.json(grid);
    } catch (error: any) {
      console.error("Comparison grid error:", error);
      res.status(500).json({ message: "Failed to build comparison grid" });
    }
  });

  app.get('/api/sales-comps/project/:projectId/adjustments', async (req: any, res) => {
    try {
      const { compAdjustmentService } = await import('../services/salescomps/compAdjustmentService');
      const orgId = req.user.orgId;
      const projectId = req.params.projectId;

      const adjustments = await compAdjustmentService.getProjectAdjustments(orgId, projectId);
      res.json(adjustments);
    } catch (error: any) {
      console.error("Project adjustments error:", error);
      res.status(500).json({ message: "Failed to fetch project adjustments" });
    }
  });

  app.delete('/api/sales-comps/adjustment/:adjustmentId', async (req: any, res) => {
    try {
      const { compAdjustmentService } = await import('../services/salescomps/compAdjustmentService');
      const orgId = req.user.orgId;
      const adjustmentId = req.params.adjustmentId;

      const success = await compAdjustmentService.deleteAdjustment(orgId, adjustmentId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete adjustment error:", error);
      res.status(500).json({ message: "Failed to delete adjustment" });
    }
  });

  // Geocoding status check
  app.get('/api/sales-comps/geocoding/status', async (req: any, res) => {
    try {
      const { geocodingService } = await import('../services/salescomps/geocodingService');
      res.json({
        configured: geocodingService.isConfigured(),
        requestCount: geocodingService.getRequestCount(),
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get geocoding status" });
    }
  });

  // ================================================================================
  // END INSTITUTIONAL DATA SERVICES
  // ================================================================================

  // Saved Searches routes
  app.get('/api/saved-searches', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searches = await storage.getSavedSearches(orgId, userId);
      res.json(searches);
    } catch (error: any) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ message: "Failed to fetch saved searches" });
    }
  });

  app.get('/api/saved-searches/:id', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      const search = await storage.getSavedSearch(req.params.id, orgId);
      if (!search) return res.status(404).json({ message: "Saved search not found" });

      res.json(search);
    } catch (error: any) {
      console.error("Error fetching saved search:", error);
      res.status(500).json({ message: "Failed to fetch saved search" });
    }
  });

  app.post('/api/saved-searches', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searchData = insertScSavedSearchSchema.parse(req.body);
      const search = await storage.createSavedSearch({
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

  app.patch('/api/saved-searches/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const searchData = updateScSavedSearchSchema.parse(req.body);
      const search = await storage.updateSavedSearch(req.params.id, {
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

  app.delete('/api/saved-searches/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      const success = await storage.deleteSavedSearch(req.params.id, orgId, userId);
      if (!success) return res.status(404).json({ message: "Saved search not found" });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting saved search:", error);
      res.status(500).json({ message: "Failed to delete saved search" });
    }
  });

  app.post('/api/saved-searches/:id/use', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;

      await storage.incrementSavedSearchUsage(req.params.id, orgId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error incrementing saved search usage:", error);
      res.status(500).json({ message: "Failed to update saved search usage" });
    }
  });

  // Pending Properties routes - Review queue for properties created from comps
  app.get('/api/pending-properties', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.query;

      const pendingProps = await storage.getPendingProperties(orgId, status);
      res.json(pendingProps);
    } catch (error: any) {
      console.error("Error fetching pending properties:", error);
      res.status(500).json({ message: "Failed to fetch pending properties" });
    }
  });

  // Find all potential duplicates for a pending property with similarity scores
  app.get('/api/pending-properties/:id/all-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;

      // Get the pending property
      const pending = await storage.getPendingProperty(id, orgId);
      if (!pending) {
        return res.status(404).json({ message: "Pending property not found" });
      }

      // Get all properties for this organization
      const allProperties = await storage.getCrmPropertiesForOrg(orgId);

      // Helper function to parse currency strings
      const parseCurrency = (value: string | number | null | undefined): number | null => {
        if (!value) return null;
        if (typeof value === 'number') return value;
        // Remove currency symbols, commas, and whitespace
        const cleaned = value.replace(/[$,\s]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? null : parsed;
      };

      // Normalize properties with parsed prices
      const normalizedProperties = allProperties.map(prop => ({
        ...prop,
        listingPrice: parseCurrency(prop.listingPrice)?.toString() || null
      }));

      // Find all potential duplicates with similarity scoring
      const duplicateMatches = findAllPotentialDuplicates(
        pending.marinaName,
        pending.city,
        pending.state,
        pending.salePrice,
        normalizedProperties as any,
        30 // Minimum 30% similarity threshold
      );

      // Format the response with explanations
      const enhancedMatches = duplicateMatches.map(match => ({
        ...match,
        explanation: getDuplicateExplanation(match)
      }));

      res.json({
        pendingProperty: pending,
        totalMatches: enhancedMatches.length,
        matches: enhancedMatches
      });
    } catch (error: any) {
      console.error("Error finding duplicate properties:", error);
      res.status(500).json({ message: "Failed to find duplicate properties" });
    }
  });

  app.post('/api/pending-properties/:id/accept', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const { mode = 'add_new' } = req.body;
      if (mode && !['replace', 'add_new'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'replace' or 'add_new'" });
      }
      const property = await storage.acceptPendingProperty(id, userId, mode);
      if (!property) {
        return res.status(404).json({ message: "Pending property not found or already processed" });
      }

      res.json(property);
    } catch (error: any) {
      console.error("Error accepting pending property:", error);
      res.status(500).json({ message: "Failed to accept pending property" });
    }
  });

  app.post('/api/pending-properties/:id/reject', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const success = await storage.rejectPendingProperty(id, orgId, userId);
      if (!success) {
        return res.status(404).json({ message: "Pending property not found or already processed" });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("Error rejecting pending property:", error);
      res.status(500).json({ message: "Failed to reject pending property" });
    }
  });

  app.patch('/api/pending-properties/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const updates = req.body;

      const updated = await storage.updatePendingProperty(id, orgId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Pending property not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating pending property:", error);
      res.status(500).json({ message: "Failed to update pending property" });
    }
  });

  app.post('/api/pending-properties/:id/merge', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { propertyId } = req.body;

      if (!propertyId) {
        return res.status(400).json({ message: "Property ID is required" });
      }

      const result = await storage.mergePendingPropertyWithExisting(id, propertyId, orgId, userId);
      if (!result) {
        return res.status(404).json({ message: "Pending property or target property not found" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error merging pending property:", error);
      res.status(500).json({ message: "Failed to merge pending property" });
    }
  });

  // ============================================================================
  // PROPERTIES - Core CRUD
  // ============================================================================

  // GET /api/crm/properties — list all properties for the org
  // Supports ?type=marina&status=available&pipelineStage=owned&search=foo
  app.get('/api/crm/properties', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { type, status, pipelineStage, search } = req.query as Record<string, string | undefined>;

      const { crmProperties } = await import('@shared/schema');
      const { eq, and, or, ilike } = await import('drizzle-orm');

      const conditions: any[] = [eq(crmProperties.orgId, orgId)];
      if (type) conditions.push(eq(crmProperties.type, type));
      if (status) conditions.push(eq(crmProperties.status, status));
      if (pipelineStage) conditions.push(eq(crmProperties.pipelineStage, pipelineStage));
      if (search) {
        conditions.push(
          or(
            ilike(crmProperties.title, `%${search}%`),
            ilike(crmProperties.address, `%${search}%`),
            ilike(crmProperties.city, `%${search}%`),
          )
        );
      }

      const properties = await db
        .select()
        .from(crmProperties)
        .where(and(...conditions))
        .orderBy(crmProperties.createdAt);

      res.json(properties);
    } catch (error: any) {
      console.error('Error fetching CRM properties:', error);
      res.status(500).json({ error: 'Failed to fetch properties' });
    }
  });

  // ============================================================================
  // PROPERTY STATUS MANAGEMENT - Selling/on-market toggles & pipeline stages
  // ============================================================================

  // Update property status fields (selling, on-market, pipeline stage, broker, listing)
  app.patch('/api/crm/properties/:propertyId/status', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { propertyId } = req.params;
      const updates = req.body;
      
      const { crmProperties } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Validate updates - only allow status-related fields
      const allowedFields = [
        'isSelling', 'isOnMarket', 'pipelineStage', 
        'brokerContactId', 'brokerName', 'listPrice', 'listCapRate',
        'listingDate', 'listingUrl', 'listingNotes', 'ownerCompanyId', 'status'
      ];
      
      const filteredUpdates: Record<string, any> = {};
      for (const key of Object.keys(updates)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      }
      
      if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({ error: "No valid status fields provided" });
      }
      
      const [updated] = await db.update(crmProperties)
        .set({ ...filteredUpdates, updatedAt: new Date() })
        .where(and(eq(crmProperties.id, propertyId), eq(crmProperties.ownerId, orgId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: "Property not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating property status:", error);
      res.status(500).json({ error: "Failed to update property status" });
    }
  });

  // Get properties by pipeline stage
  app.get('/api/crm/properties/by-stage/:stage', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { stage } = req.params;
      
      const { crmProperties } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const properties = await db.select()
        .from(crmProperties)
        .where(and(eq(crmProperties.ownerId, orgId), eq(crmProperties.pipelineStage, stage)));
      
      res.json(properties);
    } catch (error: any) {
      console.error("Error fetching properties by stage:", error);
      res.status(500).json({ error: "Failed to fetch properties by stage" });
    }
  });

  // Get properties that are on market (for sales comps integration)
  app.get('/api/crm/properties/on-market', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      const { crmProperties, crmContacts } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const properties = await db.select({
        id: crmProperties.id,
        title: crmProperties.title,
        address: crmProperties.address,
        type: crmProperties.type,
        status: crmProperties.status,
        pipelineStage: crmProperties.pipelineStage,
        isSelling: crmProperties.isSelling,
        isOnMarket: crmProperties.isOnMarket,
        listPrice: crmProperties.listPrice,
        listCapRate: crmProperties.listCapRate,
        listingDate: crmProperties.listingDate,
        listingUrl: crmProperties.listingUrl,
        listingNotes: crmProperties.listingNotes,
        brokerContactId: crmProperties.brokerContactId,
        brokerName: crmProperties.brokerName,
        brokerContactName: crmContacts.name,
        coordinates: crmProperties.coordinates,
        specifications: crmProperties.specifications,
      })
        .from(crmProperties)
        .leftJoin(crmContacts, eq(crmProperties.brokerContactId, crmContacts.id))
        .where(and(
          eq(crmProperties.ownerId, orgId),
          eq(crmProperties.isOnMarket, true)
        ));
      
      res.json(properties);
    } catch (error: any) {
      console.error("Error fetching on-market properties:", error);
      res.status(500).json({ error: "Failed to fetch on-market properties" });
    }
  });

  // GET /api/crm/properties/:propertyId — single property (must come AFTER /by-stage and /on-market)
  app.get('/api/crm/properties/:propertyId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { propertyId } = req.params;

      const { crmProperties } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [property] = await db
        .select()
        .from(crmProperties)
        .where(and(eq(crmProperties.id, propertyId), eq(crmProperties.orgId, orgId)))
        .limit(1);

      if (!property) return res.status(404).json({ error: 'Property not found' });
      res.json(property);
    } catch (error: any) {
      console.error('Error fetching CRM property:', error);
      res.status(500).json({ error: 'Failed to fetch property' });
    }
  });

  // Close a property sale and optionally create a sales comp
  app.post('/api/crm/properties/:propertyId/close-sale', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { propertyId } = req.params;
      const { salePrice, saleDate, createComp, compData } = req.body;
      
      const { crmProperties, salesComps, insertSalesCompSchema } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Get the property
      const [property] = await db.select()
        .from(crmProperties)
        .where(and(eq(crmProperties.id, propertyId), eq(crmProperties.ownerId, orgId)));
      
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      
      // Update property status to sold
      const [updated] = await db.update(crmProperties)
        .set({
          status: 'sold',
          pipelineStage: 'owned',
          isSelling: false,
          isOnMarket: false,
          updatedAt: new Date(),
        })
        .where(eq(crmProperties.id, propertyId))
        .returning();
      
      let createdComp = null;
      
      // Optionally create a sales comp
      if (createComp) {
        const coords = property.coordinates as { lat?: number; lng?: number } | null;
        const specs = property.specifications as Record<string, any> | null;
        
        const compInsert = insertSalesCompSchema.parse({
          orgId,
          marinaName: property.title,
          address: property.address,
          city: specs?.city || '',
          state: specs?.state || '',
          salePrice: salePrice || property.listPrice,
          saleDate: saleDate || new Date().toISOString().split('T')[0],
          wetSlips: specs?.wetSlips,
          drySlips: specs?.drySlips,
          latitude: coords?.lat,
          longitude: coords?.lng,
          source: 'Internal - Property Close',
          notes: `Auto-generated from property close: ${property.title}`,
          ...compData,
        });
        
        [createdComp] = await db.insert(salesComps).values(compInsert).returning();
      }
      
      res.json({
        property: updated,
        salesComp: createdComp,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error("Error closing property sale:", error);
      res.status(500).json({ error: "Failed to close property sale" });
    }
  });

  // Duplicate detection endpoints using rule-based matching service
  app.post('/api/pending/:entityType/:id/detect-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { entityType, id } = req.params;
      
      if (!['property', 'contact', 'company'].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      
      const { duplicateMatchingService } = await import('../services/duplicateMatchingService');
      const matches = await duplicateMatchingService.runDuplicateDetection(
        orgId, 
        entityType as 'property' | 'contact' | 'company', 
        id
      );
      
      res.json({ 
        pendingId: id,
        entityType,
        matchCount: matches.length,
        matches: matches.slice(0, 10)
      });
    } catch (error: any) {
      console.error("Error detecting duplicates:", error);
      res.status(500).json({ message: "Failed to detect duplicates" });
    }
  });

  app.get('/api/pending/:entityType/:id/matches', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { entityType, id } = req.params;
      
      if (!['property', 'contact', 'company'].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      
      const { duplicateMatchingService } = await import('../services/duplicateMatchingService');
      const matches = await duplicateMatchingService.getMatchesForPending(
        orgId, 
        entityType as 'property' | 'contact' | 'company', 
        id
      );
      
      res.json(matches);
    } catch (error: any) {
      console.error("Error fetching matches:", error);
      res.status(500).json({ message: "Failed to fetch matches" });
    }
  });

  app.post('/api/pending/:entityType/:id/resolve', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { entityType, id } = req.params;
      const { resolution, targetEntityId } = req.body;
      
      if (!['property', 'contact', 'company'].includes(entityType)) {
        return res.status(400).json({ message: "Invalid entity type" });
      }
      
      if (!['merge', 'reject', 'create_new'].includes(resolution)) {
        return res.status(400).json({ message: "Invalid resolution type. Use 'merge', 'reject', or 'create_new'" });
      }
      
      if (resolution === 'merge' && !targetEntityId) {
        return res.status(400).json({ message: "Target entity ID required for merge" });
      }
      
      const { duplicateMatchingService } = await import('../services/duplicateMatchingService');
      
      if (resolution === 'merge') {
        const result = await storage.mergePendingWithExisting(
          entityType as 'property' | 'contact' | 'company',
          id, 
          targetEntityId, 
          orgId, 
          userId
        );
        await duplicateMatchingService.resolveDuplicate(
          orgId, entityType as any, id, 'merge', userId, targetEntityId
        );
        res.json({ success: true, merged: true, result });
      } else if (resolution === 'reject') {
        const success = await storage.rejectPendingEntity(
          entityType as 'property' | 'contact' | 'company',
          id, 
          orgId, 
          userId
        );
        await duplicateMatchingService.resolveDuplicate(
          orgId, entityType as any, id, 'reject', userId
        );
        res.json({ success: true, rejected: true });
      } else {
        const created = await storage.acceptPendingEntity(
          entityType as 'property' | 'contact' | 'company',
          id, 
          orgId, 
          userId
        );
        await duplicateMatchingService.resolveDuplicate(
          orgId, entityType as any, id, 'create_new', userId
        );
        res.json({ success: true, created: true, result: created });
      }
    } catch (error: any) {
      console.error("Error resolving duplicate:", error);
      res.status(500).json({ message: "Failed to resolve duplicate" });
    }
  });

  // Pending Contacts routes - Review queue for contacts created from comps or DD projects
  app.get('/api/pending-contacts', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.query;

      const pendingContacts = await storage.getPendingContacts(orgId, status);
      res.json(pendingContacts);
    } catch (error: any) {
      console.error("Error fetching pending contacts:", error);
      res.status(500).json({ message: "Failed to fetch pending contacts" });
    }
  });

  app.get('/api/pending-contacts/:id/all-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;

      const pending = await storage.getPendingContact(id, orgId);
      if (!pending) {
        return res.status(404).json({ message: "Pending contact not found" });
      }

      const allCrmContacts = await storage.getCrmContactsForOrg(orgId);

      const similarityScores = allCrmContacts.map(contact => {
        let score = 0;
        const pendingFullName = pending.fullName || `${pending.firstName || ''} ${pending.lastName || ''}`.trim();
        const contactFullName = contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

        if (pendingFullName && contactFullName) {
          const normalizedPending = pendingFullName.toLowerCase().trim();
          const normalizedContact = contactFullName.toLowerCase().trim();
          if (normalizedPending === normalizedContact) score += 100;
          else if (normalizedPending.includes(normalizedContact) || normalizedContact.includes(normalizedPending)) score += 70;
        }

        if (pending.email && contact.email && pending.email.toLowerCase() === contact.email.toLowerCase()) {
          score += 80;
        }

        if (pending.phone && contact.phone) {
          const normalizedPendingPhone = pending.phone.replace(/\D/g, '');
          const normalizedContactPhone = contact.phone.replace(/\D/g, '');
          if (normalizedPendingPhone === normalizedContactPhone) score += 60;
        }

        return { contact, score };
      }).filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);

      res.json(similarityScores);
    } catch (error: any) {
      console.error("Error finding duplicate contacts:", error);
      res.status(500).json({ message: "Failed to find duplicate contacts" });
    }
  });

  app.post('/api/pending-contacts/:id/accept', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const { mode = 'add_new' } = req.body;
      if (mode && !['replace', 'add_new'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'replace' or 'add_new'" });
      }
      const contact = await storage.acceptPendingContact(id, userId, mode);
      if (!contact) {
        return res.status(404).json({ message: "Pending contact not found or already processed" });
      }

      res.json(contact);
    } catch (error: any) {
      console.error("Error accepting pending contact:", error);
      res.status(500).json({ message: "Failed to accept pending contact" });
    }
  });

  app.post('/api/pending-contacts/:id/reject', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const success = await storage.rejectPendingContact(id, orgId, userId);
      if (!success) {
        return res.status(404).json({ message: "Pending contact not found or already processed" });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("Error rejecting pending contact:", error);
      res.status(500).json({ message: "Failed to reject pending contact" });
    }
  });

  app.patch('/api/pending-contacts/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const updates = req.body;

      const updated = await storage.updatePendingContact(id, orgId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Pending contact not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating pending contact:", error);
      res.status(500).json({ message: "Failed to update pending contact" });
    }
  });

  app.post('/api/pending-contacts/:id/merge', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { contactId } = req.body;

      if (!contactId) {
        return res.status(400).json({ message: "Contact ID is required" });
      }

      const result = await storage.mergePendingContactWithExisting(id, contactId, orgId, userId);
      if (!result) {
        return res.status(404).json({ message: "Pending contact or target contact not found" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error merging pending contact:", error);
      res.status(500).json({ message: "Failed to merge pending contact" });
    }
  });

  // Pending Companies routes - Review queue for companies created from comps or DD projects
  app.get('/api/pending-companies', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status } = req.query;

      const pendingCompanies = await storage.getPendingCompaniesForOrg(orgId);
      
      // Enrich with real-time duplicate detection using enhanced fuzzy matching
      const allCompanies = await storage.getCrmCompaniesForOrg(orgId);
      
      const enrichedPending = pendingCompanies.map((pending: any) => {
        if (!pending.name) return pending;
        
        const duplicates = findCompanyDuplicates(
          pending.name,
          pending.address,
          pending.city,
          pending.state,
          pending.zipCode,
          allCompanies,
          undefined,
          40 // 40% minimum threshold
        );
        
        // Update suggestedDuplicates with real-time matches
        return {
          ...pending,
          suggestedDuplicates: duplicates.map(d => d.company.id),
          duplicateMatches: duplicates
        };
      });
      
      res.json(enrichedPending);
    } catch (error: any) {
      console.error("Error fetching pending companies:", error);
      res.status(500).json({ message: "Failed to fetch pending companies" });
    }
  });

  app.get('/api/pending-companies/:id/all-duplicates', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;

      const pending = await storage.getPendingCompany(id, orgId);
      if (!pending) {
        return res.status(404).json({ message: "Pending company not found" });
      }

      const allCompanies = await storage.getCrmCompaniesForOrg(orgId);

      // Use enhanced fuzzy matching with entity suffix stripping
      const duplicates = findCompanyDuplicates(
        pending.name || '',
        pending.address,
        pending.city,
        pending.state,
        pending.zipCode,
        allCompanies,
        undefined,
        30 // 30% minimum threshold for broader matches
      );
      
      // Format for frontend compatibility
      const similarityScores = duplicates.map(match => ({
        company: match.company,
        orgId: req.user.orgId,
        score: match.similarityScore,
        matchReasons: match.matchReasons,
        matchDetails: match.matchDetails
      }));

      res.json(similarityScores);
    } catch (error: any) {
      console.error("Error finding duplicate companies:", error);
      res.status(500).json({ message: "Failed to find duplicate companies" });
    }
  });

  app.post('/api/pending-companies/:id/accept', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const { mode = 'add_new' } = req.body;
      if (mode && !['replace', 'add_new'].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'replace' or 'add_new'" });
      }
      const company = await storage.acceptPendingCompany(id, userId, mode);
      if (!company) {
        return res.status(404).json({ message: "Pending company not found or already processed" });
      }

      res.json(company);
    } catch (error: any) {
      console.error("Error accepting pending company:", error);
      res.status(500).json({ message: "Failed to accept pending company" });
    }
  });

  app.post('/api/pending-companies/:id/reject', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;

      const success = await storage.rejectPendingCompany(id, orgId, userId);
      if (!success) {
        return res.status(404).json({ message: "Pending company not found or already processed" });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("Error rejecting pending company:", error);
      res.status(500).json({ message: "Failed to reject pending company" });
    }
  });

  app.patch('/api/pending-companies/:id', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const updates = req.body;

      const updated = await storage.updatePendingCompany(id, orgId, updates);
      if (!updated) {
        return res.status(404).json({ message: "Pending company not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating pending company:", error);
      res.status(500).json({ message: "Failed to update pending company" });
    }
  });

  app.post('/api/pending-companies/:id/merge', async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;
      const { id } = req.params;
      const { companyId } = req.body;

      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }

      const result = await storage.mergePendingCompanyWithExisting(id, companyId, orgId, userId);
      if (!result) {
        return res.status(404).json({ message: "Pending company or target company not found" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error merging pending company:", error);
      res.status(500).json({ message: "Failed to merge pending company" });
    }
  });

  // Analytics/Metrics routes
  app.post('/api/analytics/calculate', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body.filters || {};

      const analysis = await calculateMetrics(orgId, filters);
      const insights = await generateInsights(analysis, filters);

      res.json({
        analysis,
        insights,
      });
    } catch (error: any) {
      console.error("Error calculating analytics:", error);
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  app.post('/api/analytics/insights', async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters: AnalyticsFilters = req.body.filters || {};

      const analysis = await calculateMetrics(orgId, filters);
      const insights = await generateInsights(analysis, filters);

      res.json({ insights });
    } catch (error: any) {
      console.error("Error generating insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });
  // ========================================
  // MARKET INTELLIGENCE PRO ENDPOINTS
  // ========================================

  // Get Market Intelligence Pro cross-module insights (requires analytics_pro pack)
  app.get('/api/analytics/market-intelligence-pro/insights', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Check for analytics_pro pack
      const { packService } = await import("../services/pack-service"); const activePacks = await packService.getActivePacks(orgId); const hasProAccess = activePacks.includes("analytics_pro") || 
                          req.user.role === 'admin';
      
      if (!hasProAccess) {
        return res.status(403).json({ 
          message: "Market Intelligence Pro requires the Analytics Pro pack",
          requiredPack: "analytics_pro"
        });
      }
      
      const { generateCrossModuleInsights } = await import('../services/market-intelligence-pro-service');
      const report = await generateCrossModuleInsights(orgId);
      res.json(report);
    } catch (error: any) {
      console.error("Error generating Market Intelligence Pro insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  // Get Market Intelligence Pro summary/status
  app.get('/api/analytics/market-intelligence-pro/summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { getMarketIntelligenceProSummary } = await import('../services/market-intelligence-pro-service');
      const summary = await getMarketIntelligenceProSummary(orgId);
      res.json(summary);
    } catch (error: any) {
      console.error("Error getting Market Intelligence Pro summary:", error);
      res.status(500).json({ message: "Failed to get summary" });
    }
  });
  // ========================================
  // CUSTOMER ANALYTICS ENDPOINTS
  // ========================================
  
  // Get customer analytics overview
  app.get('/api/analytics/customers/overview', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const overview = await customerAnalyticsService.getOverview(orgId);
      res.json(overview);
    } catch (error: any) {
      console.error('Failed to fetch customer analytics overview:', error);
      res.status(500).json({ error: 'Failed to fetch customer analytics overview' });
    }
  });

  // Get top customers by LTV
  app.get('/api/analytics/customers/top', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'Limit must be between 1 and 100' });
      }
      
      const topCustomers = await customerAnalyticsService.getTopCustomers(orgId, limit);
      res.json(topCustomers);
    } catch (error: any) {
      console.error('Failed to fetch top customers:', error);
      res.status(500).json({ error: 'Failed to fetch top customers' });
    }
  });

  // Get customer segments
  app.get('/api/analytics/customers/segments', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const segments = await customerAnalyticsService.getCustomerSegments(orgId);
      res.json(segments);
    } catch (error: any) {
      console.error('Failed to fetch customer segments:', error);
      res.status(500).json({ error: 'Failed to fetch customer segments' });
    }
  });

  // Get customers at churn risk
  app.get('/api/analytics/customers/churn-risk', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const churnRisk = await customerAnalyticsService.getChurnRiskCustomers(orgId);
      res.json(churnRisk);
    } catch (error: any) {
      console.error('Failed to fetch churn risk customers:', error);
      res.status(500).json({ error: 'Failed to fetch churn risk customers' });
    }
  });

  // Get LTV distribution
  app.get('/api/analytics/customers/ltv-distribution', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const distribution = await customerAnalyticsService.getLtvDistribution(orgId);
      res.json(distribution);
    } catch (error: any) {
      console.error('Failed to fetch LTV distribution:', error);
      res.status(500).json({ error: 'Failed to fetch LTV distribution' });
    }
  });

  // ========================================
  // PORTFOLIO ENDPOINTS  
  // ========================================

  app.get('/api/portfolio/map-locations', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const source = (req.query.source as string) || 'all';
      const stateFilter = req.query.state as string | undefined;
      const searchFilter = req.query.search as string | undefined;
      const results: any[] = [];

      if (source === 'all' || source === 'owned') {
        const ownedRows = await db
          .select({
            assetId: ownedAssets.id,
            propertyId: ownedAssets.propertyId,
            status: ownedAssets.status,
            acquisitionPrice: ownedAssets.acquisitionPrice,
            keyMetrics: ownedAssets.keyMetrics,
            title: crmProperties.title,
            address: crmProperties.address,
            city: crmProperties.city,
            state: crmProperties.state,
            zipCode: crmProperties.zipCode,
            coordinates: crmProperties.coordinates,
            wetSlips: crmProperties.wetSlips,
            drySlips: crmProperties.drySlips,
            totalCapacity: crmProperties.totalCapacity,
          })
          .from(ownedAssets)
          .leftJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
          .where(and(
            eq(ownedAssets.orgId, orgId),
            ...(stateFilter ? [eq(crmProperties.state, stateFilter)] : []),
            ...(searchFilter ? [ilike(crmProperties.title, `%${searchFilter}%`)] : []),
          ))
          .limit(500);

        for (const r of ownedRows) {
          const coords = r.coordinates as any;
          const metrics = (r.keyMetrics || {}) as Record<string, any>;
          results.push({
            id: r.assetId,
            source: 'owned' as const,
            name: r.title || 'Unknown Marina',
            address: r.address,
            city: r.city,
            state: r.state,
            zipCode: r.zipCode,
            lat: coords?.lat ? Number(coords.lat) : null,
            lng: coords?.lng ? Number(coords.lng) : null,
            price: r.acquisitionPrice ? Number(r.acquisitionPrice) : null,
            slips: r.totalCapacity ?? (((r.wetSlips ?? 0) + (r.drySlips ?? 0)) || null),
            status: r.status || 'under_management',
            metrics: {
              occupancy: metrics.occupancy,
              annualRevenue: metrics.annualRevenue,
              propertyId: r.propertyId,
            },
          });
        }
      }

      if (source === 'all' || source === 'pipeline') {
        const { dealWorkspaces } = await import('@shared/schema');
        const pipelineStages = ['prospect', 'initial_outreach', 'qualified', 'loi_submitted', 'loi_negotiated', 'loi_executed', 'psa_drafting', 'psa_executed', 'due_diligence', 'dd_extension', 'deposits_hard', 'financing', 'clear_to_close', 'lead', 'proposal', 'negotiation'];
        const dealConditions: any[] = [
          eq(crmDeals.orgId, orgId),
          inArray(crmDeals.stage, pipelineStages),
        ];
        if (searchFilter) dealConditions.push(ilike(crmDeals.title, `%${searchFilter}%`));

        const dealRows = await db.select({
          deal: crmDeals,
          property: crmProperties,
        }).from(crmDeals)
          .leftJoin(dealWorkspaces, eq(dealWorkspaces.dealId, crmDeals.id))
          .leftJoin(crmProperties, eq(dealWorkspaces.propertyId, crmProperties.id))
          .where(and(...dealConditions))
          .limit(500);

        for (const row of dealRows) {
          const d = row.deal;
          const p = row.property;
          const coords = p?.coordinates as any;
          const lat = coords?.lat ? Number(coords.lat) : null;
          const lng = coords?.lng ? Number(coords.lng) : null;
          const city = p?.city || d.city || null;
          const state = p?.state || d.state || null;
          if (stateFilter && state !== stateFilter) continue;
          results.push({
            id: d.id,
            source: 'pipeline' as const,
            name: d.title,
            address: p?.address || null,
            city,
            state,
            zipCode: p?.zipCode || null,
            lat,
            lng,
            price: d.amount ? Number(d.amount) : null,
            slips: p ? (p.totalCapacity ?? (((p.wetSlips ?? 0) + (p.drySlips ?? 0)) || null)) : null,
            status: d.stage,
            metrics: {
              stage: d.stage,
              priority: d.priority,
              amount: d.amount ? Number(d.amount) : null,
              probability: d.probability,
              propertyName: p?.title || null,
            },
          });
        }
      }

      const needsGeocoding = results.filter(r => r.lat == null && r.lng == null && (r.address || r.city));
      if (needsGeocoding.length > 0) {
        const { geocodingService } = await import('../services/geocodingService');
        const toGeocode = needsGeocoding.slice(0, 25);
        const geocodePromises = toGeocode.map(async (loc) => {
          try {
            const addressStr = geocodingService.buildAddressString({
              address: loc.address || undefined,
              city: loc.city || undefined,
              state: loc.state || undefined,
              zip: loc.zipCode || undefined,
            });
            if (!addressStr) return;
            const result = await geocodingService.geocodeAddress(addressStr);
            if ('lat' in result && 'lng' in result) {
              loc.lat = result.lat;
              loc.lng = result.lng;
              try {
                if (loc.source === 'owned' && loc.metrics?.propertyId) {
                  await db.update(crmProperties).set({ coordinates: { lat: result.lat, lng: result.lng } }).where(eq(crmProperties.id, loc.metrics.propertyId));
                } else if (loc.source === 'pipeline') {
                  const props = await db.select({ id: crmProperties.id }).from(crmProperties)
                    .innerJoin(dealWorkspaces, eq(dealWorkspaces.propertyId, crmProperties.id))
                    .where(eq(dealWorkspaces.dealId, loc.id)).limit(1);
                  if (props.length > 0) {
                    await db.update(crmProperties).set({ coordinates: { lat: result.lat, lng: result.lng } }).where(eq(crmProperties.id, props[0].id));
                  }
                }
              } catch (dbErr: any) {
                console.error(`[Portfolio Map] Failed to persist geocode for ${loc.source}/${loc.id}:`, dbErr.message);
              }
            }
          } catch (err: any) {
            console.error(`[Portfolio Map] Geocode error for ${loc.name}:`, err.message);
          }
        });
        await Promise.all(geocodePromises);
      }

      const bySource: Record<string, number> = {};
      const byState: Record<string, number> = {};
      let withCoords = 0;
      for (const loc of results) {
        bySource[loc.source] = (bySource[loc.source] || 0) + 1;
        if (loc.state) byState[loc.state] = (byState[loc.state] || 0) + 1;
        if (loc.lat && loc.lng) withCoords++;
      }

      res.json({
        locations: results,
        stats: {
          total: results.length,
          withCoordinates: withCoords,
          bySource,
          byState,
        },
      });
    } catch (error: any) {
      console.error('PORTFOLIO_MAP_ERROR:', error?.message || error);
      res.status(500).json({ error: 'Failed to fetch portfolio map locations' });
    }
  });

  // Get portfolio marinas (owned properties) with real operational data
  app.get('/api/portfolio/marinas', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Query owned assets with property details and aggregated operational metrics
      // Using static imports from top of file
      
      // Get base asset data with properties
      const assetsWithProperties = await db
        .select({
          id: ownedAssets.id,
          propertyId: ownedAssets.propertyId,
          projectId: ownedAssets.projectId,
          acquisitionDate: ownedAssets.acquisitionDate,
          acquisitionPrice: ownedAssets.acquisitionPrice,
          status: ownedAssets.status,
          keyMetrics: ownedAssets.keyMetrics,
          propertyTitle: crmProperties.title,
          propertyAddress: crmProperties.address,
          propertySpecs: crmProperties.specifications
        })
        .from(ownedAssets)
        .leftJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
        .where(eq(ownedAssets.orgId, orgId))
        .orderBy(desc(ownedAssets.acquisitionDate));
      
      // Enrich with real operational data for each asset
      const marinas = await Promise.all(assetsWithProperties.map(async (row) => {
        const specs = (row.propertySpecs || {}) as Record<string, any>;
        const storedMetrics = (row.keyMetrics || {}) as Record<string, any>;
        
        // Get latest performance snapshot for this asset
        const [latestSnapshot] = await db
          .select()
          .from(assetPerformanceSnapshots)
          .where(eq(assetPerformanceSnapshots.ownedAssetId, row.id))
          .orderBy(desc(assetPerformanceSnapshots.snapshotDate))
          .limit(1);
        
        const snapshotMetrics = (latestSnapshot?.metrics || {}) as Record<string, any>;
        
        // Get rent roll metrics if property is linked
        let rentRollMetrics = { totalUnits: 0, occupiedUnits: 0, monthlyRevenue: 0, occupancyRate: 0 };
        if (row.propertyId) {
          const rentRollsList = await db
            .select({ id: rentRolls.id })
            .from(rentRolls)
            .where(and(eq(rentRolls.orgId, orgId), eq(rentRolls.facilityId, row.propertyId)));
          
          if (rentRollsList.length > 0) {
            const rentRollIds = rentRollsList.map(rr => rr.id);
            const [rrMetrics] = await db
              .select({
                totalUnits: sql<number>`COUNT(*)`,
                occupiedUnits: sql<number>`COUNT(CASE WHEN ${rentRollEntries.status} = 'occupied' THEN 1 END)`,
                totalRevenue: sql<number>`COALESCE(SUM(${rentRollEntries.monthlyRate}), 0)`,
              })
              .from(rentRollEntries)
              .where(inArray(rentRollEntries.rentRollId, rentRollIds));
            
            if (rrMetrics) {
              const totalUnits = Number(rrMetrics.totalUnits) || 0;
              const occupiedUnits = Number(rrMetrics.occupiedUnits) || 0;
              rentRollMetrics = {
                totalUnits,
                occupiedUnits,
                monthlyRevenue: Number(rrMetrics.totalRevenue) || 0,
                occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0
              };
            }
          }
        }
        
        // Fuel sales metrics - skip for now as fuelSales table is org-level not property-level
        let fuelMetrics = { annualRevenue: 0 };
        
        // Calculate derived metrics from live data
        const slips = specs.slips || storedMetrics.slips || snapshotMetrics.slips || rentRollMetrics.totalUnits || 0;
        const occupancy = snapshotMetrics.occupancy || storedMetrics.occupancy || rentRollMetrics.occupancyRate || null;
        const rentRollAnnualRevenue = rentRollMetrics.monthlyRevenue * 12;
        const totalAnnualRevenue = rentRollAnnualRevenue + fuelMetrics.annualRevenue;
        const annualRevenue = snapshotMetrics.annualRevenue || storedMetrics.annualRevenue || (totalAnnualRevenue > 0 ? totalAnnualRevenue : null);
        const annualEbitda = snapshotMetrics.annualEbitda || storedMetrics.annualEbitda || (annualRevenue ? annualRevenue * 0.35 : null);
        const currentValue = snapshotMetrics.currentValue || storedMetrics.currentValue || row.acquisitionPrice || null;
        
        return {
          id: row.id,
          name: row.propertyTitle || 'Unknown Marina',
          location: row.propertyAddress?.split(',')[0]?.trim() || '',
          state: row.propertyAddress?.split(',').slice(-1)[0]?.trim() || '',
          slips,
          status: row.status || 'under_management',
          acquisitionPrice: Number(row.acquisitionPrice) || null,
          acquisitionDate: row.acquisitionDate || null,
          currentValue: Number(currentValue) || null,
          annualRevenue: Number(annualRevenue) || null,
          annualEbitda: Number(annualEbitda) || null,
          occupancy: Number(occupancy) || null,
          projectId: row.projectId || null,
          propertyId: row.propertyId,
          operationalData: {
            rentRoll: rentRollMetrics,
            fuel: fuelMetrics,
            hasLiveData: rentRollMetrics.totalUnits > 0 || fuelMetrics.annualRevenue > 0
          }
        };
      }));
      
      res.json(marinas);
    } catch (error: any) {
      console.error('PORTFOLIO_ERROR:', error?.message || error, error?.stack || '');
      res.status(500).json({ error: 'Failed to fetch portfolio marinas', details: error?.message || String(error) });
    }
  });

  // Get single portfolio marina by ID
  app.get('/api/portfolio/marinas/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      const assetWithDetails = await ownedAssetsService.getOwnedAssetWithDetails(id, orgId);
      if (!assetWithDetails) {
        return res.status(404).json({ error: 'Marina not found' });
      }
      
      const { asset, property } = assetWithDetails;
      const specs = (property?.specifications || {}) as Record<string, any>;
      const storedMetrics = (asset.keyMetrics || {}) as Record<string, any>;
      
      res.json({
        id: asset.id,
        propertyId: asset.propertyId,
        projectId: asset.projectId,
        name: property?.title || 'Unknown Marina',
        address: property?.address || '',
        city: property?.city || '',
        state: property?.state || '',
        zip: property?.zip || '',
        slips: specs.slips || storedMetrics.slips || 0,
        status: asset.status,
        holdStrategy: asset.holdStrategy,
        acquisitionDate: asset.acquisitionDate,
        acquisitionPrice: asset.acquisitionPrice,
        exitTargetDate: asset.exitTargetDate,
        keyMetrics: storedMetrics,
        notes: asset.notes,
        currentValue: storedMetrics.currentValue || asset.acquisitionPrice,
        annualRevenue: storedMetrics.annualRevenue,
        annualEbitda: storedMetrics.annualEbitda,
        occupancy: storedMetrics.occupancy,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      });
    } catch (error: any) {
      console.error('Failed to fetch portfolio marina:', error);
      res.status(500).json({ error: 'Failed to fetch marina details' });
    }
  });

  // Create a new portfolio marina (owned asset)
  app.post('/api/portfolio/marinas', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const { propertyId, projectId, acquisitionDate, acquisitionPrice, status, holdStrategy, exitTargetDate, keyMetrics, notes } = req.body;
      
      if (!propertyId) {
        return res.status(400).json({ error: 'propertyId is required' });
      }
      if (!acquisitionDate) {
        return res.status(400).json({ error: 'acquisitionDate is required' });
      }
      
      // Verify property exists and belongs to org
      const [property] = await db.select().from(crmProperties).where(and(eq(crmProperties.id, propertyId), eq(crmProperties.orgId, orgId))).limit(1);
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }
      
      // Check if property is already in portfolio
      const [existingAsset] = await db.select().from(ownedAssets).where(and(eq(ownedAssets.propertyId, propertyId), eq(ownedAssets.orgId, orgId))).limit(1);
      if (existingAsset) {
        return res.status(409).json({ error: 'Property is already in portfolio' });
      }
      
      const asset = await ownedAssetsService.createOwnedAsset(orgId, userId, {
        propertyId,
        projectId: projectId || null,
        acquisitionDate,
        acquisitionPrice: acquisitionPrice ? parseInt(acquisitionPrice) : null,
        status: status || 'under_management',
        holdStrategy: holdStrategy || null,
        exitTargetDate: exitTargetDate || null,
        keyMetrics: keyMetrics || {},
        notes: notes || null,
      });
      
      res.status(201).json(asset);
    } catch (error: any) {
      console.error('Failed to create portfolio marina:', error);
      res.status(500).json({ error: 'Failed to add marina to portfolio' });
    }
  });

  // Update a portfolio marina
  app.patch('/api/portfolio/marinas/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      const { acquisitionDate, acquisitionPrice, status, holdStrategy, exitTargetDate, keyMetrics, notes, projectId } = req.body;
      
      const updateData: any = {};
      if (acquisitionDate !== undefined) updateData.acquisitionDate = acquisitionDate;
      if (acquisitionPrice !== undefined) updateData.acquisitionPrice = acquisitionPrice ? parseInt(acquisitionPrice) : null;
      if (status !== undefined) updateData.status = status;
      if (holdStrategy !== undefined) updateData.holdStrategy = holdStrategy;
      if (exitTargetDate !== undefined) updateData.exitTargetDate = exitTargetDate;
      if (keyMetrics !== undefined) updateData.keyMetrics = keyMetrics;
      if (notes !== undefined) updateData.notes = notes;
      if (projectId !== undefined) updateData.projectId = projectId;
      
      const asset = await ownedAssetsService.updateOwnedAsset(id, orgId, updateData);
      if (!asset) {
        return res.status(404).json({ error: 'Marina not found' });
      }
      
      res.json(asset);
    } catch (error: any) {
      console.error('Failed to update portfolio marina:', error);
      res.status(500).json({ error: 'Failed to update marina' });
    }
  });

  // Delete a portfolio marina (remove from portfolio)
  app.delete('/api/portfolio/marinas/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      const deleted = await ownedAssetsService.deleteOwnedAsset(id, orgId);
      if (!deleted) {
        return res.status(404).json({ error: 'Marina not found' });
      }
      
      res.json({ success: true, message: 'Marina removed from portfolio' });
    } catch (error: any) {
      console.error('Failed to delete portfolio marina:', error);
      res.status(500).json({ error: 'Failed to remove marina from portfolio' });
    }
  });

  // Get CRM properties that can be added to portfolio (not already owned)
  app.get('/api/portfolio/available-properties', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Get all property IDs already in portfolio
      const ownedPropertyIds = await db
        .select({ propertyId: ownedAssets.propertyId })
        .from(ownedAssets)
        .where(eq(ownedAssets.orgId, orgId));
      
      const ownedIds = ownedPropertyIds.map(o => o.propertyId);
      
      // Get properties not in portfolio
      let conditions: any = eq(crmProperties.orgId, orgId);
      if (ownedIds.length > 0) {
        conditions = and(eq(crmProperties.orgId, orgId), notInArray(crmProperties.id, ownedIds));
      }
      
      const properties = await db
        .select({
          id: crmProperties.id,
          title: crmProperties.title,
          address: crmProperties.address,
          city: crmProperties.city,
          state: crmProperties.state,
          status: crmProperties.status,
          specifications: crmProperties.specifications,
        })
        .from(crmProperties)
        .where(conditions)
        .orderBy(desc(crmProperties.createdAt));
      
      res.json(properties.map(p => ({
        ...p,
        slips: (p.specifications as any)?.slips || 0,
      })));
    } catch (error: any) {
      console.error('Failed to fetch available properties:', error);
      res.status(500).json({ error: 'Failed to fetch available properties' });
    }
  });

  // Get portfolio summary
  app.get('/api/portfolio/summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const summary = await ownedAssetsService.getPortfolioSummary(orgId);
      res.json(summary);
    } catch (error: any) {
      console.error('Failed to fetch portfolio summary:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio summary' });
    }
  });

  // Portfolio breakdown by asset class
  app.get('/api/portfolio/asset-class-breakdown', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projects = await db.select({
        id: modelingProjects.id,
        marinaName: modelingProjects.marinaName,
        assetClass: modelingProjects.assetClass,
        purchasePrice: modelingProjects.purchasePrice,
        year1CapRate: modelingProjects.year1CapRate,
        dealOutcome: modelingProjects.dealOutcome,
      }).from(modelingProjects).where(eq(modelingProjects.orgId, orgId));
      const byClass: Record<string, { count: number; totalValue: number; assets: any[] }> = {};
      for (const p of projects) {
        const ac = (p as any).assetClass || 'other';
        if (!byClass[ac]) byClass[ac] = { count: 0, totalValue: 0, assets: [] };
        byClass[ac].count++;
        byClass[ac].totalValue += Number(p.purchasePrice || 0);
        byClass[ac].assets.push({ id: p.id, name: p.marinaName, value: Number(p.purchasePrice || 0), capRate: p.year1CapRate, status: p.dealOutcome });
      }
      res.json({ totalProjects: projects.length, totalValue: projects.reduce((s, p) => s + Number(p.purchasePrice || 0), 0), byAssetClass: byClass });
    } catch (error: any) {
      console.error('Failed to fetch portfolio breakdown:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio breakdown' });
    }
  });


  // Legacy endpoint - redirect to new one
  app.get('/api/operations/owned-marinas', authenticateUser, async (req: any, res) => {
    res.redirect(301, '/api/portfolio/marinas');
  });
  // ========================================
  // RENT ROLL ENDPOINTS

  // ========================================
  // MARINA BUDGET ENDPOINTS
  // ========================================

  // Get budgets for a specific marina/owned asset
  app.get('/api/operations/budgets/marina/:assetId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { assetId } = req.params;
      const { year } = req.query;

      let query = db
        .select()
        .from(marinaBudgets)
        .where(and(
          eq(marinaBudgets.orgId, orgId),
          eq(marinaBudgets.ownedAssetId, assetId)
        ))
        .orderBy(desc(marinaBudgets.fiscalYear));

      const budgets = year 
        ? await db.select().from(marinaBudgets).where(and(
            eq(marinaBudgets.orgId, orgId),
            eq(marinaBudgets.ownedAssetId, assetId),
            eq(marinaBudgets.fiscalYear, parseInt(year as string))
          ))
        : await query;

      res.json(budgets);
    } catch (error: any) {
      console.error('Failed to fetch marina budgets:', error);
      res.status(500).json({ error: 'Failed to fetch marina budgets' });
    }
  });

  // Get a single budget with line items
  app.get('/api/operations/budgets/:budgetId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { budgetId } = req.params;

      const [budget] = await db
        .select()
        .from(marinaBudgets)
        .where(and(
          eq(marinaBudgets.id, budgetId),
          eq(marinaBudgets.orgId, orgId)
        ));

      if (!budget) {
        return res.status(404).json({ error: 'Budget not found' });
      }

      const lineItems = await db
        .select()
        .from(marinaBudgetLineItems)
        .where(eq(marinaBudgetLineItems.budgetId, budgetId))
        .orderBy(marinaBudgetLineItems.category, marinaBudgetLineItems.name);

      const actuals = await db
        .select()
        .from(marinaBudgetActuals)
        .where(eq(marinaBudgetActuals.budgetId, budgetId));

      res.json({ ...budget, lineItems, actuals });
    } catch (error: any) {
      console.error('Failed to fetch budget:', error);
      res.status(500).json({ error: 'Failed to fetch budget' });
    }
  });

  // Create a new budget
  app.post('/api/operations/budgets', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const data = insertMarinaBudgetSchema.parse(req.body);

      const [existing] = await db
        .select()
        .from(marinaBudgets)
        .where(and(
          eq(marinaBudgets.ownedAssetId, data.ownedAssetId),
          eq(marinaBudgets.fiscalYear, data.fiscalYear)
        ));

      if (existing) {
        return res.status(409).json({ error: 'Budget already exists for this year' });
      }

      const [budget] = await db
        .insert(marinaBudgets)
        .values({ ...data, orgId, createdBy: userId })
        .returning();

      res.status(201).json(budget);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create budget:', error);
      res.status(500).json({ error: 'Failed to create budget' });
    }
  });

  // Update a budget
  app.patch('/api/operations/budgets/:budgetId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { budgetId } = req.params;
      const data = updateMarinaBudgetSchema.parse(req.body);

      // Validate rent roll ownership if linking
      if (data.rentRollId) {
        const [rentRoll] = await db
          .select()
          .from(rentRolls)
          .where(and(eq(rentRolls.id, data.rentRollId), eq(rentRolls.orgId, orgId)))
          .limit(1);

        if (!rentRoll) {
          return res.status(400).json({ error: 'Rent roll not found or does not belong to your organization' });
        }
      }

      const [budget] = await db
        .update(marinaBudgets)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(marinaBudgets.id, budgetId), eq(marinaBudgets.orgId, orgId)))
        .returning();

      if (!budget) {
        return res.status(404).json({ error: 'Budget not found' });
      }

      res.json(budget);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update budget:', error);
      res.status(500).json({ error: 'Failed to update budget' });
    }
  });

  // Add/update budget line items
  app.post('/api/operations/budgets/:budgetId/line-items', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { budgetId } = req.params;
      const items = req.body as any[];

      const [budget] = await db
        .select()
        .from(marinaBudgets)
        .where(and(eq(marinaBudgets.id, budgetId), eq(marinaBudgets.orgId, orgId)));

      if (!budget) {
        return res.status(404).json({ error: 'Budget not found' });
      }

      const results = await Promise.all(items.map(async (item) => {
        const validated = insertMarinaBudgetLineItemSchema.parse({ ...item, budgetId });
        
        if (item.id) {
          const [updated] = await db
            .update(marinaBudgetLineItems)
            .set({ ...validated, updatedAt: new Date() })
            .where(eq(marinaBudgetLineItems.id, item.id))
            .returning();
          return updated;
        } else {
          const [created] = await db
            .insert(marinaBudgetLineItems)
            .values(validated)
            .returning();
          return created;
        }
      }));

      const allItems = await db.select().from(marinaBudgetLineItems).where(eq(marinaBudgetLineItems.budgetId, budgetId));
      const totalBudgetAmount = allItems.reduce((sum, item) => sum + parseFloat(item.annualAmount || '0'), 0);

      await db.update(marinaBudgets).set({ totalBudgetAmount: totalBudgetAmount.toString(), updatedAt: new Date() }).where(eq(marinaBudgets.id, budgetId));

      res.json(results);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to save line items:', error);
      res.status(500).json({ error: 'Failed to save line items' });
    }
  });

  // Record actuals against budget
  app.post('/api/operations/budgets/:budgetId/actuals', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { budgetId } = req.params;
      const actuals = req.body as any[];

      const [budget] = await db
        .select()
        .from(marinaBudgets)
        .where(and(eq(marinaBudgets.id, budgetId), eq(marinaBudgets.orgId, orgId)));

      if (!budget) {
        return res.status(404).json({ error: 'Budget not found' });
      }

      const results = await Promise.all(actuals.map(async (actual) => {
        const validated = insertMarinaBudgetActualSchema.parse({ ...actual, budgetId });

        if (actual.lineItemId) {
          const [existing] = await db.select().from(marinaBudgetActuals)
            .where(and(
              eq(marinaBudgetActuals.lineItemId, actual.lineItemId),
              eq(marinaBudgetActuals.year, validated.year),
              eq(marinaBudgetActuals.month, validated.month)
            ));

          if (existing) {
            const [updated] = await db.update(marinaBudgetActuals)
              .set({ actualAmount: validated.actualAmount, notes: validated.notes })
              .where(eq(marinaBudgetActuals.id, existing.id))
              .returning();
            return updated;
          }
        }

        const [created] = await db.insert(marinaBudgetActuals).values(validated).returning();
        return created;
      }));

      res.json(results);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to record actuals:', error);
      res.status(500).json({ error: 'Failed to record actuals' });
    }
  });

  // Get budget vs actual comparison for a marina
  app.get('/api/operations/budgets/:budgetId/comparison', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { budgetId } = req.params;

      const [budget] = await db.select().from(marinaBudgets)
        .where(and(eq(marinaBudgets.id, budgetId), eq(marinaBudgets.orgId, orgId)));

      if (!budget) {
        return res.status(404).json({ error: 'Budget not found' });
      }

      const lineItems = await db.select().from(marinaBudgetLineItems).where(eq(marinaBudgetLineItems.budgetId, budgetId));
      const actuals = await db.select().from(marinaBudgetActuals).where(eq(marinaBudgetActuals.budgetId, budgetId));

      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      
      const comparison = lineItems.map(item => {
        const itemActuals = actuals.filter(a => a.lineItemId === item.id);
        
        const monthlyData = months.map((month, idx) => {
          const budgeted = parseFloat((item as any)[month] || '0');
          const actualRecord = itemActuals.find(a => a.month === idx + 1);
          const actual = actualRecord ? parseFloat(actualRecord.actualAmount || '0') : 0;
          const variance = actual - budgeted;
          const variancePercent = budgeted !== 0 ? (variance / budgeted) * 100 : 0;

          return { month: month.toUpperCase(), monthNum: idx + 1, budgeted, actual, variance, variancePercent: Math.round(variancePercent * 10) / 10 };
        });

        const totalBudgeted = parseFloat(item.annualAmount || '0');
        const totalActual = monthlyData.reduce((sum, m) => sum + m.actual, 0);
        const totalVariance = totalActual - totalBudgeted;

        return {
          id: item.id,
          category: item.category,
          name: item.name,
          annualBudget: totalBudgeted,
          ytdActual: totalActual,
          ytdVariance: totalVariance,
          ytdVariancePercent: totalBudgeted !== 0 ? Math.round((totalVariance / totalBudgeted) * 1000) / 10 : 0,
          monthlyData,
        };
      });

      res.json({
        budget,
        comparison,
        summary: {
          totalBudgeted: comparison.reduce((sum, c) => sum + c.annualBudget, 0),
          totalActual: comparison.reduce((sum, c) => sum + c.ytdActual, 0),
          totalVariance: comparison.reduce((sum, c) => sum + c.ytdVariance, 0),
        },
      });
    } catch (error: any) {
      console.error('Failed to fetch comparison:', error);
      res.status(500).json({ error: 'Failed to fetch comparison' });
    }
  });

  // Get portfolio-level budget summary
  app.get('/api/operations/budgets/portfolio/summary', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { year } = req.query;
      const fiscalYear = year ? parseInt(year as string) : new Date().getFullYear();

      const budgets = await db
        .select({ budget: marinaBudgets, asset: ownedAssets, property: crmProperties })
        .from(marinaBudgets)
        .innerJoin(ownedAssets, eq(marinaBudgets.ownedAssetId, ownedAssets.id))
        .leftJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
        .where(and(eq(marinaBudgets.orgId, orgId), eq(marinaBudgets.fiscalYear, fiscalYear)));

      const budgetIds = budgets.map(b => b.budget.id);
      
      let allLineItems: any[] = [];
      let allActuals: any[] = [];
      
      if (budgetIds.length > 0) {
        allLineItems = await db.select().from(marinaBudgetLineItems)
          .where(inArray(marinaBudgetLineItems.budgetId, budgetIds));

        allActuals = await db.select().from(marinaBudgetActuals)
          .where(inArray(marinaBudgetActuals.budgetId, budgetIds));
      }

      const categoryTotals: Record<string, { budgeted: number; actual: number }> = {};
      
      for (const item of allLineItems) {
        if (!categoryTotals[item.category]) {
          categoryTotals[item.category] = { budgeted: 0, actual: 0 };
        }
        categoryTotals[item.category].budgeted += parseFloat(item.annualAmount || '0');
        
        const itemActuals = allActuals.filter(a => a.lineItemId === item.id);
        for (const a of itemActuals) {
          categoryTotals[item.category].actual += parseFloat(a.actualAmount || '0');
        }
      }

      const marinaSummaries = budgets.map(b => {
        const lineItems = allLineItems.filter(li => li.budgetId === b.budget.id);
        const actuals = allActuals.filter(a => a.budgetId === b.budget.id);
        
        const totalBudgeted = lineItems.reduce((sum, li) => sum + parseFloat(li.annualAmount || '0'), 0);
        const totalActual = actuals.reduce((sum, a) => sum + parseFloat(a.actualAmount || '0'), 0);

        return {
          budgetId: b.budget.id,
          marinaId: b.asset.id,
          marinaName: b.property?.title || 'Unknown',
          status: b.budget.status,
          totalBudgeted,
          totalActual,
          variance: totalActual - totalBudgeted,
        };
      });

      const portfolioTotalBudgeted = marinaSummaries.reduce((sum, m) => sum + m.totalBudgeted, 0);
      const portfolioTotalActual = marinaSummaries.reduce((sum, m) => sum + m.totalActual, 0);

      res.json({
        fiscalYear,
        marinaCount: budgets.length,
        portfolioTotal: { budgeted: portfolioTotalBudgeted, actual: portfolioTotalActual, variance: portfolioTotalActual - portfolioTotalBudgeted },
        categoryBreakdown: Object.entries(categoryTotals).map(([category, totals]) => ({ category, ...totals, variance: totals.actual - totals.budgeted })),
        marinaSummaries,
      });
    } catch (error: any) {
      console.error('Failed to fetch portfolio budget summary:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio budget summary' });
    }
  });

  // ========================================
  // Get all rent rolls
  app.get('/api/operations/rent-rolls', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const context = req.query.context as 'operational' | 'valuation' | undefined;
      const rolls = await rentRollService.getRentRolls(orgId, context);
      res.json(rolls);
    } catch (error: any) {
      console.error('Failed to fetch rent rolls:', error);
      res.status(500).json({ error: 'Failed to fetch rent rolls' });
    }
  });

  // Get portfolio summary for the Rent Roll Portfolio page
  app.get('/api/operations/rent-roll/portfolio', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      // Fetch all rent roll locations with their leases
      const locations = await db.query.rraMarinaLocations.findMany({
        where: eq(rraMarinaLocations.orgId, orgId),
      });

      if (!locations || locations.length === 0) {
        return res.json([]);
      }

      const locationIds = locations.map(l => l.id);
      
      // Fetch all leases for these locations
      const leases = await db.query.rraLeases.findMany({
        where: locationIds.length > 0 
          ? inArray(rraLeases.locationId, locationIds)
          : undefined,
      });

      // Transform the data to match the PropertyData interface
      const portfolioData = locations.map(location => {
        const locationLeases = leases.filter(l => l.locationId === location.id);
        const activeLeases = locationLeases.filter(l => {
          const today = new Date();
          const expDate = l.leaseExpiration ? new Date(l.leaseExpiration) : null;
          return !expDate || expDate > today;
        });
        
        const expiringIn90Days = locationLeases.filter(l => {
          const today = new Date();
          const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
          const expDate = l.leaseExpiration ? new Date(l.leaseExpiration) : null;
          return expDate && expDate <= in90Days && expDate > today;
        }).length;

        const monthlyRevenue = activeLeases.reduce((sum, lease) => {
          const amount = lease.leaseAmount ? parseFloat(lease.leaseAmount as any) : 0;
          return sum + amount;
        }, 0);

        return {
          id: location.id,
          name: location.name || 'Unnamed Location',
          location: location.code || 'N/A',
          slips: location.capacity || 0,
          occupied: activeLeases.length,
          monthlyRevenue,
          leasesExpiringIn90Days: expiringIn90Days,
          status: location.isActive ? 'active' : 'inactive',
        };
      });

      res.json(portfolioData);
    } catch (error: any) {
      console.error('Failed to fetch rent roll portfolio:', error);
      res.status(500).json({ error: 'Failed to fetch rent roll portfolio' });
    }
  });

  // Get a single rent roll
  app.get('/api/operations/rent-rolls/:id', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const roll = await rentRollService.getRentRollById(req.params.id, orgId);
      
      if (!roll) {
        return res.status(404).json({ error: 'Rent roll not found' });
      }
      
      res.json(roll);
    } catch (error: any) {
      console.error('Failed to fetch rent roll:', error);
      res.status(500).json({ error: 'Failed to fetch rent roll' });
    }
  });

  // Create a new rent roll
  app.post('/api/operations/rent-rolls', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertRentRollSchema.parse(req.body);
      const roll = await rentRollService.createRentRoll(orgId, data);
      res.status(201).json(roll);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create rent roll:', error);
      res.status(500).json({ error: 'Failed to create rent roll' });
    }
  });

  // Update a rent roll
  app.patch('/api/operations/rent-rolls/:id', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateRentRollSchema.parse(req.body);
      const roll = await rentRollService.updateRentRoll(req.params.id, orgId, data);
      
      if (!roll) {
        return res.status(404).json({ error: 'Rent roll not found' });
      }
      
      res.json(roll);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update rent roll:', error);
      res.status(500).json({ error: 'Failed to update rent roll' });
    }
  });

  // Delete a rent roll
  app.delete('/api/operations/rent-rolls/:id', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await rentRollService.deleteRentRoll(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Rent roll not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete rent roll:', error);
      res.status(500).json({ error: 'Failed to delete rent roll' });
    }
  });

  // Get rent roll entries
  app.get('/api/operations/rent-rolls/:rentRollId/entries', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const entries = await rentRollService.getRentRollEntries(req.params.rentRollId, orgId);
      res.json(entries);
    } catch (error: any) {
      console.error('Failed to fetch rent roll entries:', error);
      res.status(500).json({ error: 'Failed to fetch rent roll entries' });
    }
  });

  // Create a rent roll entry
  app.post('/api/operations/rent-rolls/:rentRollId/entries', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertRentRollEntrySchema.parse({
        ...req.body,
        rentRollId: req.params.rentRollId,
      });
      const entry = await rentRollService.createRentRollEntry(orgId, data);
      res.status(201).json(entry);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create rent roll entry:', error);
      res.status(500).json({ error: 'Failed to create rent roll entry' });
    }
  });

  // Update a rent roll entry
  app.patch('/api/operations/rent-roll-entries/:id', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateRentRollEntrySchema.parse(req.body);
      const entry = await rentRollService.updateRentRollEntry(req.params.id, orgId, data);
      
      if (!entry) {
        return res.status(404).json({ error: 'Rent roll entry not found' });
      }
      
      res.json(entry);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update rent roll entry:', error);
      res.status(500).json({ error: 'Failed to update rent roll entry' });
    }
  });

  // Delete a rent roll entry
  app.delete('/api/operations/rent-roll-entries/:id', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await rentRollService.deleteRentRollEntry(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Rent roll entry not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete rent roll entry:', error);
      res.status(500).json({ error: 'Failed to delete rent roll entry' });
    }
  });

  // Get rent roll summary statistics
  app.get('/api/operations/rent-rolls/:rentRollId/summary', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const summary = await rentRollService.getRentRollSummary(req.params.rentRollId, orgId);
      res.json(summary);
    } catch (error: any) {
      console.error('Failed to fetch rent roll summary:', error);
      res.status(500).json({ error: 'Failed to fetch rent roll summary' });
    }
  });

  // ========================================================================

  // ========================================================================
  // RENT ROLL SNAPSHOTS ROUTES
  // ========================================================================

  // Create or update a snapshot for a rent roll
  app.post('/api/operations/rent-rolls/:rentRollId/snapshots', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { snapshotMonth, snapshotYear, ownedAssetId } = req.body;
      
      if (!snapshotMonth || !snapshotYear) {
        return res.status(400).json({ error: 'snapshotMonth and snapshotYear are required' });
      }
      
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      const snapshot = await rentRollSnapshotService.createSnapshot(
        orgId,
        req.params.rentRollId,
        snapshotMonth,
        snapshotYear,
        ownedAssetId
      );
      res.status(201).json(snapshot);
    } catch (error: any) {
      console.error('Failed to create rent roll snapshot:', error);
      res.status(500).json({ error: error.message || 'Failed to create snapshot' });
    }
  });

  // Get snapshots for a rent roll
  app.get('/api/operations/rent-rolls/:rentRollId/snapshots', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      const snapshots = await rentRollSnapshotService.getSnapshotsForRentRoll(
        req.params.rentRollId,
        orgId
      );
      res.json(snapshots);
    } catch (error: any) {
      console.error('Failed to fetch rent roll snapshots:', error);
      res.status(500).json({ error: 'Failed to fetch snapshots' });
    }
  });

  // Get snapshot details
  app.get('/api/operations/rent-roll-snapshots/:snapshotId/details', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      
      const snapshot = await rentRollSnapshotService.getSnapshot(req.params.snapshotId, orgId);
      if (!snapshot) {
        return res.status(404).json({ error: 'Snapshot not found' });
      }
      
      const details = await rentRollSnapshotService.getSnapshotDetails(snapshot.id);
      res.json({ snapshot, details });
    } catch (error: any) {
      console.error('Failed to fetch snapshot details:', error);
      res.status(500).json({ error: 'Failed to fetch snapshot details' });
    }
  });

  // Compare snapshots
  app.get('/api/operations/rent-roll-snapshots/:currentId/compare/:previousId?', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      
      const comparison = await rentRollSnapshotService.compareSnapshots(
        req.params.currentId,
        req.params.previousId || null,
        orgId
      );
      res.json(comparison);
    } catch (error: any) {
      console.error('Failed to compare snapshots:', error);
      res.status(500).json({ error: error.message || 'Failed to compare snapshots' });
    }
  });

  // Get time series for a rent roll
  app.get('/api/operations/rent-rolls/:rentRollId/time-series', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { startYear, startMonth, endYear, endMonth } = req.query;
      
      if (!startYear || !startMonth || !endYear || !endMonth) {
        return res.status(400).json({ error: 'Start and end year/month are required' });
      }
      
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      const snapshots = await rentRollSnapshotService.getTimeSeries(
        req.params.rentRollId,
        orgId,
        parseInt(startYear as string),
        parseInt(startMonth as string),
        parseInt(endYear as string),
        parseInt(endMonth as string)
      );
      res.json(snapshots);
    } catch (error: any) {
      console.error('Failed to fetch time series:', error);
      res.status(500).json({ error: 'Failed to fetch time series' });
    }
  });

  // Get portfolio aggregation
  app.get('/api/operations/rent-roll-snapshots/portfolio', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { year, month, assetIds } = req.query;
      
      if (!year || !month) {
        return res.status(400).json({ error: 'Year and month are required' });
      }
      
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      const aggregation = await rentRollSnapshotService.getPortfolioAggregation(
        orgId,
        parseInt(year as string),
        parseInt(month as string),
        assetIds ? (assetIds as string).split(',') : undefined
      );
      res.json(aggregation);
    } catch (error: any) {
      console.error('Failed to fetch portfolio aggregation:', error);
      res.status(500).json({ error: 'Failed to fetch portfolio aggregation' });
    }
  });

  // ========================================================================
  // BUDGET RENT ROLL BINDINGS ROUTES
  // ========================================================================

  // Get bindings for a budget
  app.get('/api/operations/budgets/:budgetId/rent-roll-bindings', authenticateUser, async (req: any, res) => {
    try {
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      const bindings = await rentRollSnapshotService.getBindingsForBudget(req.params.budgetId);
      res.json(bindings);
    } catch (error: any) {
      console.error('Failed to fetch budget bindings:', error);
      res.status(500).json({ error: 'Failed to fetch bindings' });
    }
  });

  // Create a binding
  app.post('/api/operations/budgets/:budgetId/rent-roll-bindings', authenticateUser, async (req: any, res) => {
    try {
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      const binding = await rentRollSnapshotService.createBinding({
        ...req.body,
        budgetId: req.params.budgetId,
      });
      res.status(201).json(binding);
    } catch (error: any) {
      console.error('Failed to create budget binding:', error);
      res.status(500).json({ error: error.message || 'Failed to create binding' });
    }
  });

  // Update a binding
  app.patch('/api/operations/rent-roll-bindings/:bindingId', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      const binding = await rentRollSnapshotService.updateBinding(req.params.bindingId, req.body);
      if (!binding) {
        return res.status(404).json({ error: 'Binding not found' });
      }
      res.json(binding);
    } catch (error: any) {
      console.error('Failed to update binding:', error);
      res.status(500).json({ error: error.message || 'Failed to update binding' });
    }
  });

  // Delete a binding
  app.delete('/api/operations/rent-roll-bindings/:bindingId', authenticateUser, requireRentRoll(), async (req: any, res) => {
    try {
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      const deleted = await rentRollSnapshotService.deleteBinding(req.params.bindingId);
      if (!deleted) {
        return res.status(404).json({ error: 'Binding not found' });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error('Failed to delete binding:', error);
      res.status(500).json({ error: 'Failed to delete binding' });
    }
  });

  // Sync budget actuals from rent roll
  app.post('/api/operations/budgets/:budgetId/sync-rent-roll', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { month, year } = req.body;
      
      if (!month || !year) {
        return res.status(400).json({ error: 'Month and year are required' });
      }
      
      const { rentRollSnapshotService } = await import('../services/rent-roll-snapshot-service');
      const result = await rentRollSnapshotService.syncBudgetActualsFromRentRoll(
        req.params.budgetId,
        orgId,
        month,
        year
      );
      res.json(result);
    } catch (error: any) {
      console.error('Failed to sync budget from rent roll:', error);
      res.status(500).json({ error: error.message || 'Failed to sync' });
    }
  });
  // MARKETING OPERATIONS ROUTES
  // ========================================================================

  // Marketing Campaigns
  app.get('/api/marketing/campaigns', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        status: req.query.status,
        channel: req.query.channel,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };
      const campaigns = await marketingService.getCampaigns(orgId, filters);
      res.json(campaigns);
    } catch (error: any) {
      console.error('Failed to fetch marketing campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch marketing campaigns' });
    }
  });

  app.get('/api/marketing/campaigns/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const campaign = await marketingService.getCampaignById(req.params.id, orgId);
      
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json(campaign);
    } catch (error: any) {
      console.error('Failed to fetch marketing campaign:', error);
      res.status(500).json({ error: 'Failed to fetch marketing campaign' });
    }
  });

  app.post('/api/marketing/campaigns', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertMarketingCampaignSchema.parse(req.body);
      const campaign = await marketingService.createCampaign(orgId, data);
      res.status(201).json(campaign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create marketing campaign:', error);
      res.status(500).json({ error: 'Failed to create marketing campaign' });
    }
  });

  app.patch('/api/marketing/campaigns/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateMarketingCampaignSchema.parse(req.body);
      const campaign = await marketingService.updateCampaign(req.params.id, orgId, data);
      
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json(campaign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update marketing campaign:', error);
      res.status(500).json({ error: 'Failed to update marketing campaign' });
    }
  });

  app.delete('/api/marketing/campaigns/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await marketingService.deleteCampaign(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete marketing campaign:', error);
      res.status(500).json({ error: 'Failed to delete marketing campaign' });
    }
  });

  // Marketing Expenses
  app.get('/api/marketing/expenses', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        campaignId: req.query.campaignId,
        status: req.query.status,
        category: req.query.category,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };
      const expenses = await marketingService.getExpenses(orgId, filters);
      res.json(expenses);
    } catch (error: any) {
      console.error('Failed to fetch marketing expenses:', error);
      res.status(500).json({ error: 'Failed to fetch marketing expenses' });
    }
  });

  app.get('/api/marketing/expenses/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const expense = await marketingService.getExpenseById(req.params.id, orgId);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json(expense);
    } catch (error: any) {
      console.error('Failed to fetch marketing expense:', error);
      res.status(500).json({ error: 'Failed to fetch marketing expense' });
    }
  });

  app.post('/api/marketing/expenses', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const data = insertMarketingExpenseSchema.parse(req.body);
      const expense = await marketingService.createExpense(orgId, userId, data);
      res.status(201).json(expense);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create marketing expense:', error);
      res.status(500).json({ error: 'Failed to create marketing expense' });
    }
  });

  app.patch('/api/marketing/expenses/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateMarketingExpenseSchema.parse(req.body);
      const expense = await marketingService.updateExpense(req.params.id, orgId, data);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json(expense);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update marketing expense:', error);
      res.status(500).json({ error: 'Failed to update marketing expense' });
    }
  });

  app.post('/api/marketing/expenses/:id/approve', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const expense = await marketingService.approveExpense(req.params.id, orgId, userId);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json(expense);
    } catch (error: any) {
      console.error('Failed to approve marketing expense:', error);
      res.status(500).json({ error: 'Failed to approve marketing expense' });
    }
  });

  app.post('/api/marketing/expenses/:id/mark-paid', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { paidDate } = req.body;
      
      if (!paidDate) {
        return res.status(400).json({ error: 'paidDate is required' });
      }
      
      const expense = await marketingService.markExpensePaid(req.params.id, orgId, paidDate);
      
      if (!expense) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json(expense);
    } catch (error: any) {
      console.error('Failed to mark expense as paid:', error);
      res.status(500).json({ error: 'Failed to mark expense as paid' });
    }
  });

  app.delete('/api/marketing/expenses/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await marketingService.deleteExpense(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Expense not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete marketing expense:', error);
      res.status(500).json({ error: 'Failed to delete marketing expense' });
    }
  });

  // Lead Attribution
  app.get('/api/marketing/attribution', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        campaignId: req.query.campaignId,
        attributionType: req.query.attributionType,
      };
      const attributions = await marketingService.getAttributions(orgId, filters);
      res.json(attributions);
    } catch (error: any) {
      console.error('Failed to fetch lead attributions:', error);
      res.status(500).json({ error: 'Failed to fetch lead attributions' });
    }
  });

  app.post('/api/marketing/attribution', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertLeadAttributionSchema.parse(req.body);
      const attribution = await marketingService.createAttribution(orgId, data);
      res.status(201).json(attribution);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create lead attribution:', error);
      res.status(500).json({ error: 'Failed to create lead attribution' });
    }
  });

  app.delete('/api/marketing/attribution/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await marketingService.deleteAttribution(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Attribution not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete lead attribution:', error);
      res.status(500).json({ error: 'Failed to delete lead attribution' });
    }
  });

  // Marketing Analytics
  app.get('/api/marketing/campaigns/:id/metrics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const metrics = await marketingService.getCampaignMetrics(req.params.id, orgId);
      res.json(metrics);
    } catch (error: any) {
      console.error('Failed to fetch campaign metrics:', error);
      res.status(500).json({ error: 'Failed to fetch campaign metrics' });
    }
  });

  app.get('/api/marketing/metrics', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const metrics = await marketingService.getOrganizationMetrics(orgId);
      res.json(metrics);
    } catch (error: any) {
      console.error('Failed to fetch organization metrics:', error);
      res.status(500).json({ error: 'Failed to fetch organization metrics' });
    }
  });

  // Email Campaigns
  app.get('/api/marketing/email-campaigns', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const filters = {
        campaignId: req.query.campaignId,
        platform: req.query.platform,
      };
      const campaigns = await marketingService.getEmailCampaigns(orgId, filters);
      res.json(campaigns);
    } catch (error: any) {
      console.error('Failed to fetch email campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch email campaigns' });
    }
  });

  app.post('/api/marketing/email-campaigns/sync', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertEmailCampaignSchema.parse(req.body);
      const campaign = await marketingService.upsertEmailCampaign(orgId, data);
      res.json(campaign);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to sync email campaign:', error);
      res.status(500).json({ error: 'Failed to sync email campaign' });
    }
  });

  // ============================================================================
  // MODELING PROJECTS - Valuation & Financial Modeling Tracking
  // ============================================================================

  // Modeling Display Preferences - Organization-level display settings
  app.get('/api/modeling/display-preferences', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { modelingDisplayPreferences } = await import('@shared/schema');
      const [prefs] = await db.select().from(modelingDisplayPreferences)
        .where(eq(modelingDisplayPreferences.orgId, orgId))
        .limit(1);
      res.json(prefs || { priceRoundingDigits: 0, ebitdaRoundingDigits: 0, lineItemRoundingDigits: 0, percentRoundingDecimals: 1, bottomLineMetric: 'noi' });
    } catch (error: any) {
      console.error('Failed to get display preferences:', error);
      res.status(500).json({ error: 'Failed to get display preferences' });
    }
  });

  app.patch('/api/modeling/display-preferences', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { priceRoundingDigits, ebitdaRoundingDigits, lineItemRoundingDigits, percentRoundingDecimals, bottomLineMetric } = req.body;

      const updates: Record<string, any> = { updatedAt: new Date() };

      if (priceRoundingDigits !== undefined) {
        if (typeof priceRoundingDigits !== 'number' || priceRoundingDigits < -1 || priceRoundingDigits > 6) {
          return res.status(400).json({ error: 'priceRoundingDigits must be a number between -1 and 6' });
        }
        updates.priceRoundingDigits = priceRoundingDigits;
      }

      if (ebitdaRoundingDigits !== undefined) {
        if (typeof ebitdaRoundingDigits !== 'number' || ebitdaRoundingDigits < -1 || ebitdaRoundingDigits > 6) {
          return res.status(400).json({ error: 'ebitdaRoundingDigits must be a number between -1 and 6' });
        }
        updates.ebitdaRoundingDigits = ebitdaRoundingDigits;
      }

      if (lineItemRoundingDigits !== undefined) {
        if (typeof lineItemRoundingDigits !== 'number' || lineItemRoundingDigits < -1 || lineItemRoundingDigits > 6) {
          return res.status(400).json({ error: 'lineItemRoundingDigits must be a number between -1 and 6' });
        }
        updates.lineItemRoundingDigits = lineItemRoundingDigits;
      }

      if (percentRoundingDecimals !== undefined) {
        if (typeof percentRoundingDecimals !== 'number' || percentRoundingDecimals < 0 || percentRoundingDecimals > 4) {
          return res.status(400).json({ error: 'percentRoundingDecimals must be a number between 0 and 4' });
        }
        updates.percentRoundingDecimals = percentRoundingDecimals;
      }

      if (bottomLineMetric !== undefined) {
        if (!['noi', 'ebitda'].includes(bottomLineMetric)) {
          return res.status(400).json({ error: 'bottomLineMetric must be "noi" or "ebitda"' });
        }
        updates.bottomLineMetric = bottomLineMetric;
      }

      const { year1Mode } = req.body;
      if (year1Mode !== undefined) {
        if (!['calendar_year_end', 'next_12_months'].includes(year1Mode)) {
          return res.status(400).json({ error: 'year1Mode must be "calendar_year_end" or "next_12_months"' });
        }
        updates.year1Mode = year1Mode;
      }

      const { modelingDisplayPreferences } = await import('@shared/schema');

      const [existing] = await db.select().from(modelingDisplayPreferences)
        .where(eq(modelingDisplayPreferences.orgId, orgId))
        .limit(1);

      if (existing) {
        const [updated] = await db.update(modelingDisplayPreferences)
          .set(updates)
          .where(eq(modelingDisplayPreferences.id, existing.id))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(modelingDisplayPreferences)
          .values({ orgId, ...updates })
          .returning();
        res.json(created);
      }
    } catch (error: any) {
      console.error('Failed to update display preferences:', error);
      res.status(500).json({ error: 'Failed to update display preferences' });
    }
  });

  // Modeling Regions - Organization-specific customizable regions
  app.get('/api/modeling/regions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const regions = await storage.getModelingRegions(orgId);
      res.json(regions);
    } catch (error: any) {
      console.error('Failed to fetch modeling regions:', error);
      res.status(500).json({ error: 'Failed to fetch modeling regions' });
    }
  });

  app.post('/api/modeling/regions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = insertModelingRegionSchema.parse(req.body);
      const region = await storage.createModelingRegion({ ...data, orgId });
      res.status(201).json(region);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create modeling region:', error);
      res.status(500).json({ error: 'Failed to create modeling region' });
    }
  });

  app.patch('/api/modeling/regions/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const data = updateModelingRegionSchema.parse(req.body);
      const region = await storage.updateModelingRegion(req.params.id, data, orgId);
      
      if (!region) {
        return res.status(404).json({ error: 'Modeling region not found' });
      }
      
      res.json(region);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update modeling region:', error);
      res.status(500).json({ error: 'Failed to update modeling region' });
    }
  });

  app.delete('/api/modeling/regions/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const deleted = await storage.deleteModelingRegion(req.params.id, orgId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Modeling region not found' });
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error('Failed to delete modeling region:', error);
      res.status(500).json({ error: 'Failed to delete modeling region' });
    }
  });

  // Search brokers - searches CRM contacts and companies together
  app.get('/api/modeling/broker-search', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const query = (req.query.q || req.query.query || '').trim();
      
      if (!query || query.length < 2) {
        return res.json({ contacts: [], companies: [] });
      }
      
      const searchTerm = `%${query.toLowerCase()}%`;
      
      // Search contacts (brokers)
      const contacts = await db
        .select({
          id: crmContacts.id,
          firstName: crmContacts.firstName,
          lastName: crmContacts.lastName,
          email: crmContacts.email,
          phone: crmContacts.phone,
          title: crmContacts.title,
          companyId: crmContacts.companyId,
        })
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.orgId, orgId),
            or(
              sql`LOWER(${crmContacts.firstName}) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.lastName}) LIKE ${searchTerm}`,
              sql`LOWER(CONCAT(${crmContacts.firstName}, ' ', ${crmContacts.lastName})) LIKE ${searchTerm}`,
              sql`LOWER(${crmContacts.email}) LIKE ${searchTerm}`
            )
          )
        )
        .limit(10);
      
      // Search companies (broker companies)
      const companies = await db
        .select({
          id: crmCompanies.id,
          name: crmCompanies.name,
          domain: crmCompanies.domain,
          phone: crmCompanies.phone,
        })
        .from(crmCompanies)
        .where(
          and(
            eq(crmCompanies.orgId, orgId),
            sql`LOWER(${crmCompanies.name}) LIKE ${searchTerm}`
          )
        )
        .limit(10);
      
      // Get company names for contacts
      const contactsWithCompany = await Promise.all(
        contacts.map(async (contact) => {
          if (contact.companyId) {
            const company = await db
              .select({ name: crmCompanies.name })
              .from(crmCompanies)
              .where(eq(crmCompanies.id, contact.companyId))
              .limit(1);
            return {
              ...contact,
              companyName: company[0]?.name || null,
            };
          }
          return { ...contact, companyName: null };
        })
      );
      
      res.json({ contacts: contactsWithCompany, companies });
    } catch (error: any) {
      console.error('Failed to search brokers:', error);
      res.status(500).json({ error: 'Failed to search brokers' });
    }
  });

  // Returns & Valuation - aggregate view of all projects with latest valuation snapshots
  app.get('/api/modeling/returns-valuation', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { modelingProjects, valuationSnapshots, modelingFinancialPeriods } = await import('@shared/schema');

      // Scope: pipeline deals only — exclude owned_marina (portfolio properties)
      const rows = await db.execute(sql`
        SELECT
          p.id, p.marina_name, p.city, p.state, p.purchase_price, p.year_1_cap_rate,
          p.ebitda, p.total_storage_units, p.deal_outcome, p.deal_source, p.updated_at,
          p.custom_metrics,
          fp.noi AS t12_noi,
          fp.total_revenue AS t12_revenue,
          fp.total_expenses AS t12_expenses,
          vs.indicated_value, vs.cap_rate AS snap_cap_rate, vs.noi AS snap_noi,
          vs.ebitda AS snap_ebitda, vs.irr, vs.equity_multiple, vs.cash_on_cash,
          vs.gross_revenue, vs.snapshot_date
        FROM modeling_projects p
        LEFT JOIN LATERAL (
          SELECT * FROM valuation_snapshots s
          WHERE s.modeling_project_id = p.id AND s.org_id = ${orgId}
          ORDER BY s.snapshot_date DESC
          LIMIT 1
        ) vs ON true
        LEFT JOIN modeling_financial_periods fp
          ON fp.modeling_project_id = p.id AND fp.org_id = ${orgId} AND fp.period_type = 't12'
        WHERE p.org_id = ${orgId}
          AND (p.deal_source IS NULL OR p.deal_source != 'owned_marina')
        ORDER BY p.updated_at DESC
      `);

      const toNum = (v: any) => v != null ? parseFloat(v) : null;

      const results = rows.rows.map((r: any) => {
        const customMetrics = (typeof r.custom_metrics === 'string' ? JSON.parse(r.custom_metrics) : r.custom_metrics) || {};
        const dp = customMetrics.dealPricing || {};
        const dpResults = customMetrics.dealPricingResults || {};
        const mcResults = customMetrics.monteCarloResults || null;

        const purchasePrice = toNum(dp.purchasePrice) || toNum(r.purchase_price);
        const t12Noi = toNum(r.t12_noi);
        const capRateFromDp = toNum(dp.goingInCapRate);
        const irrFromDp = toNum(dpResults.irr) || toNum(dp.targetIRR);

        const rawSnapCap = toNum(r.snap_cap_rate);
        const rawYearCap = toNum(r.year_1_cap_rate);
        const capVal = rawSnapCap != null
          ? (rawSnapCap < 1 ? rawSnapCap * 100 : rawSnapCap)
          : capRateFromDp != null
            ? capRateFromDp
            : rawYearCap != null
              ? (rawYearCap < 1 ? rawYearCap * 100 : rawYearCap)
              : null;

        const derivedNoi = purchasePrice && capVal ? purchasePrice * (capVal / 100) : null;
        const noiVal = toNum(r.snap_noi) ?? toNum(dpResults.noi) ?? t12Noi ?? (toNum(r.t12_revenue) != null && toNum(r.t12_expenses) != null ? toNum(r.t12_revenue)! - toNum(r.t12_expenses)! : null) ?? derivedNoi;

        const rawSnapIrr = toNum(r.irr);
        const irrVal = rawSnapIrr != null
          ? (rawSnapIrr < 1 ? rawSnapIrr * 100 : rawSnapIrr)
          : irrFromDp != null
            ? irrFromDp
            : null;

        const equityMultiple = toNum(r.equity_multiple) ?? toNum(dpResults.equityMultiple) ?? null;

        const rawCashOnCash = toNum(r.cash_on_cash) ?? toNum(dpResults.cashOnCash);
        const cashOnCash = rawCashOnCash != null
          ? (rawCashOnCash < 1 ? rawCashOnCash * 100 : rawCashOnCash)
          : (noiVal != null && purchasePrice && purchasePrice > 0 ? (noiVal / purchasePrice) * 100 : null);

        const noiByYear: number[] = Array.isArray(dpResults.noiByYear) ? dpResults.noiByYear : [];
        const cashFlowsByYear: number[] = Array.isArray(dpResults.cashFlowsByYear) ? dpResults.cashFlowsByYear : [];

        return {
          id: r.id,
          marinaName: r.marina_name,
          city: r.city,
          state: r.state,
          purchasePrice,
          year1CapRate: toNum(r.year_1_cap_rate),
          ebitda: toNum(r.ebitda),
          totalStorageUnits: r.total_storage_units,
          dealOutcome: r.deal_outcome,
          dealSource: r.deal_source,
          updatedAt: r.updated_at,
          t12Noi,
          t12Revenue: toNum(r.t12_revenue),
          t12Expenses: toNum(r.t12_expenses),
          snapshot: {
            indicatedValue: r.deal_outcome === 'won'
              ? (toNum(r.indicated_value) ?? (noiVal != null && capVal ? noiVal / (capVal / 100) : null))
              : null,
            capRate: capVal,
            noi: noiVal,
            ebitda: toNum(r.snap_ebitda) ?? toNum(r.ebitda),
            irr: irrVal,
            equityMultiple,
            cashOnCash,
            grossRevenue: toNum(r.gross_revenue) ?? toNum(r.t12_revenue),
            snapshotDate: r.snapshot_date || r.updated_at,
          },
          dealPricingInputs: {
            holdPeriod: toNum(dp.holdPeriod) ?? null,
            exitCapRate: toNum(dp.exitCapRate) ?? null,
            goingInCapRate: capRateFromDp,
            targetIRR: toNum(dp.targetIRR) ?? null,
          },
          dealPricingResults: {
            irr: toNum(dpResults.irr) ?? null,
            equityMultiple: toNum(dpResults.equityMultiple) ?? null,
            cashOnCash: toNum(dpResults.cashOnCash) ?? null,
            npv: toNum(dpResults.npv) ?? null,
            exitValue: toNum(dpResults.exitValue) ?? null,
            totalProfit: toNum(dpResults.totalProfit) ?? null,
            netExitProceeds: toNum(dpResults.netExitProceeds) ?? null,
            totalEquityInvested: toNum(dpResults.totalEquityInvested) ?? null,
            noiByYear,
            cashFlowsByYear,
          },
          monteCarlo: mcResults ? {
            hasResults: true,
            probabilityOfLoss: mcResults.results?.npv?.riskMetrics?.probabilityOfLoss ?? null,
            valueAtRisk: mcResults.results?.npv?.riskMetrics?.valueAtRisk ?? null,
            irrMean: mcResults.results?.irr?.statistics?.mean ?? null,
            irrP5: mcResults.results?.irr?.statistics?.percentiles?.p5 ?? null,
            irrP95: mcResults.results?.irr?.statistics?.percentiles?.p95 ?? null,
            npvMean: mcResults.results?.npv?.statistics?.mean ?? null,
            sharpeRatio: mcResults.results?.irr?.riskMetrics?.sharpeRatio ?? null,
            sortinoRatio: mcResults.results?.irr?.riskMetrics?.sortinoRatio ?? null,
            emMean: mcResults.results?.equityMultiple?.statistics?.mean ?? null,
            cocMean: mcResults.results?.cashOnCash?.statistics?.mean ?? null,
            iterations: mcResults.iterations ?? null,
            lastCalculated: mcResults.lastCalculated ?? null,
            sensitivityTop: mcResults.sensitivityRanking?.slice(0, 5)?.map((s: any) => ({
              variable: s.variable,
              contribution: s.contribution,
              correlationToIRR: s.correlationToIRR,
            })) ?? [],
          } : null,
        };
      });

      res.json(results);
    } catch (error: any) {
      console.error('Failed to fetch returns & valuation data:', error);
      res.status(500).json({ error: 'Failed to fetch returns & valuation data' });
    }
  });

  app.post('/api/modeling/projects/compare', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectIds } = req.body;
      
      if (!projectIds || !Array.isArray(projectIds) || projectIds.length < 2 || projectIds.length > 5) {
        return res.status(400).json({ error: 'Select 2-5 projects to compare' });
      }

      const projects = await db.select().from(modelingProjects).where(
        and(
          eq(modelingProjects.orgId, orgId),
          inArray(modelingProjects.id, projectIds)
        )
      );

      if (projects.length < 2) {
        return res.status(404).json({ error: 'Not enough projects found' });
      }

      const { modelingScenarioVersions, modelingFinancialPeriods } = await import('@shared/schema');

      const enrichedProjects = await Promise.all(projects.map(async (project) => {
        const scenarios = await db.select().from(modelingScenarioVersions).where(
          and(
            eq(modelingScenarioVersions.modelingProjectId, project.id),
            eq(modelingScenarioVersions.isCurrentVersion, true)
          )
        );
        
        const baseScenario = scenarios.find((s: any) => s.scenarioType === 'base') || scenarios[0] || null;

        const financialData = await db.select().from(modelingFinancialPeriods).where(
          eq(modelingFinancialPeriods.modelingProjectId, project.id)
        );

        return {
          ...project,
          baseScenario,
          scenarios,
          financialDocumentCount: financialData.length,
        };
      }));

      res.json(enrichedProjects);
    } catch (error: any) {
      console.error('Failed to compare acquisition projects:', error);
      res.status(500).json({ error: 'Failed to compare projects' });
    }
  });

  app.get('/api/modeling/property-coverage', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const rows = await db
        .select({ propertyId: modelingProjects.propertyId, companyId: modelingProjects.companyId })
        .from(modelingProjects)
        .where(and(eq(modelingProjects.orgId, orgId)));

      const propertyIds = [...new Set(rows.map(r => r.propertyId).filter(Boolean))] as string[];
      const directCompanyIds = [...new Set(rows.map(r => r.companyId).filter(Boolean))] as string[];

      let contactIds: string[] = [];
      let companyIdsViaProps: string[] = [];

      if (propertyIds.length > 0) {
        const contactLinks = await db
          .select({ contactId: crmContactProperties.contactId })
          .from(crmContactProperties)
          .where(inArray(crmContactProperties.propertyId, propertyIds));
        contactIds = [...new Set(contactLinks.map(r => r.contactId).filter(Boolean))] as string[];

        const companyLinks = await db
          .select({ companyId: crmCompanyProperties.companyId })
          .from(crmCompanyProperties)
          .where(inArray(crmCompanyProperties.propertyId, propertyIds));
        companyIdsViaProps = [...new Set(companyLinks.map(r => r.companyId).filter(Boolean))] as string[];
      }

      const companyIds = [...new Set([...directCompanyIds, ...companyIdsViaProps])];

      res.json({ propertyIds, companyIds, contactIds });
    } catch (error: any) {
      console.error('Failed to get model coverage:', error);
      res.status(500).json({ error: 'Failed to retrieve model coverage' });
    }
  });

  app.get('/api/modeling/projects', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const pag = parsePagination(req.query, { pageSize: 25 });
      const allProjects = await storage.getModelingProjects(orgId);
      const total = allProjects.length;
      const projects = allProjects.slice(pag.offset, pag.offset + pag.limit);

      const { modelingActuals, modelingFinancialPeriods, users: usersTable } = await import('@shared/schema');

      const userIds = [...new Set(projects.map(p => (p as any).createdBy).filter(Boolean))];
      const userNameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        try {
          const userRows = await db.select({ id: usersTable.id, name: usersTable.name })
            .from(usersTable)
            .where(inArray(usersTable.id, userIds));
          for (const u of userRows) {
            userNameMap[u.id] = u.name;
          }
        } catch (e) {
          console.warn('Failed to fetch user names for modeling projects:', e);
        }
      }
      const { proFormaEngineService } = await import('../services/pro-forma-engine-service');

      const projectsWithMetrics = await Promise.all(projects.map(async (project) => {
        let purchasePrice = project.purchasePrice ? parseFloat(project.purchasePrice.toString()) : null;
        let year1CapRate = project.year1CapRate ? parseFloat(project.year1CapRate.toString()) : null;

        let t12Ebitda: number | null = null;
        let t12Label: string | null = null;
        let year1Ebitda: number | null = null;
        let irr: number | null = null;
        let exitYear: number | null = null;

        const customMetrics = (project.customMetrics as any) || {};
        const dealPricing = customMetrics.dealPricing || null;

        if (dealPricing) {
          if (dealPricing.purchasePrice != null && dealPricing.purchasePrice > 0) {
            purchasePrice = dealPricing.purchasePrice;
          }
          if (dealPricing.targetIRR != null && dealPricing.targetIRR !== 0) {
            irr = dealPricing.targetIRR;
          }
          if (dealPricing.goingInCapRate != null && dealPricing.goingInCapRate !== 0) {
            year1CapRate = dealPricing.goingInCapRate;
          }
        }

        try {
          const financialPeriods = await db.select()
            .from(modelingFinancialPeriods)
            .where(and(
              eq(modelingFinancialPeriods.modelingProjectId, project.id),
              eq(modelingFinancialPeriods.orgId, orgId)
            ));

          const t12Period = financialPeriods.find(p => p.periodType === 't12');
          const year1Period = financialPeriods.find(p => p.periodType === 'year_1');

          if (t12Period) {
            t12Ebitda = t12Period.ebitda ? parseFloat(t12Period.ebitda) : (t12Period.noi ? parseFloat(t12Period.noi) : null);
            if (t12Period.periodStartDate && t12Period.periodEndDate) {
              t12Label = `${t12Period.periodLabel || 'T12'}`;
            } else {
              t12Label = t12Period.periodLabel || 'T12';
            }
          }

          if (year1Period) {
            year1Ebitda = year1Period.ebitda ? parseFloat(year1Period.ebitda) : (year1Period.noi ? parseFloat(year1Period.noi) : null);
          }

          if (t12Ebitda === null) {
            const actuals = await db.select({
              year: modelingActuals.year,
              month: modelingActuals.month,
              category: modelingActuals.category,
              amount: modelingActuals.amount,
            })
            .from(modelingActuals)
            .where(and(
              eq(modelingActuals.modelingProjectId, project.id),
              eq(modelingActuals.orgId, orgId)
            ));

            if (actuals.length > 0) {
              const periods = new Set(actuals.map(a => `${a.year}-${String(a.month).padStart(2, '0')}`));
              const sortedPeriods = Array.from(periods).sort().slice(-12);

              if (sortedPeriods.length > 0) {
                const validPeriods = new Set(sortedPeriods);
                let revenue = 0;
                let cogs = 0;
                let expenses = 0;

                for (const actual of actuals) {
                  const key = `${actual.year}-${String(actual.month).padStart(2, '0')}`;
                  if (!validPeriods.has(key)) continue;
                  const amt = parseFloat(actual.amount?.toString() || '0');
                  const cat = actual.category?.toLowerCase() || '';
                  if (cat === 'revenue') revenue += amt;
                  else if (cat === 'cogs') cogs += amt;
                  else if (cat === 'expenses' || cat === 'expense') expenses += amt;
                }
                t12Ebitda = revenue - cogs - expenses;

                const firstPeriod = sortedPeriods[0].split('-');
                const lastPeriod = sortedPeriods[sortedPeriods.length - 1].split('-');
                const startMonth = parseInt(firstPeriod[1]);
                const startYear = parseInt(firstPeriod[0]);
                const endMonth = parseInt(lastPeriod[1]);
                const endYear = parseInt(lastPeriod[0]);
                const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                if (sortedPeriods.length === 12 && startMonth === 1 && endMonth === 12 && startYear === endYear) {
                  t12Label = `FY ${startYear}`;
                } else {
                  t12Label = `${monthNames[startMonth - 1]} ${startYear} - ${monthNames[endMonth - 1]} ${endYear}`;
                }
              }
            }
          }

          try {
            const proForma = await proFormaEngineService.generateProForma(project.id, orgId, 'base');
            if (proForma.noi && proForma.noi.length > 0) {
              year1Ebitda = proForma.noi[0];
              if (irr === null) {
                const proFormaIrr = proForma.metrics?.irr ?? null;
                irr = (proFormaIrr !== null && proFormaIrr !== 0) ? proFormaIrr : null;
              }
              if (year1CapRate === null || year1CapRate === 0) {
                const proFormaCapRate = proForma.metrics?.goingInCapRate ?? null;
                if (proFormaCapRate != null && proFormaCapRate !== 0) {
                  year1CapRate = proFormaCapRate;
                }
              }
              const lastYear = proForma.years?.[proForma.years.length - 1];
              exitYear = lastYear ?? null;
            }
          } catch (e) {
            // Pro forma may not be available for all projects
          }
        } catch (e) {
          console.warn(`Failed to compute metrics for project ${project.id}:`, e);
        }

        return {
          ...project,
          purchasePrice,
          year1CapRate,
          t12Ebitda,
          t12Label,
          year1Ebitda,
          irr,
          exitYear,
          createdByName: (project as any).createdBy ? (userNameMap[(project as any).createdBy] || null) : null,
        };
      }));
      
      res.json(paginatedResponse(projectsWithMetrics, total, pag));
    } catch (error: any) {
      console.error('Failed to fetch modeling projects:', error);
      res.status(500).json({ error: 'Failed to fetch modeling projects' });
    }
  });

  // Get single modeling project by ID
  app.get('/api/modeling/projects/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const project = await storage.getModelingProject(req.params.id, orgId);
      
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
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
      console.error('Failed to fetch modeling project:', error);
      res.status(500).json({ error: 'Failed to fetch modeling project' });
    }
  });

  // Get modeling projects by broker
  app.get('/api/modeling/projects/broker/:brokerId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const projects = await storage.getModelingProjectsByBroker(req.params.brokerId, orgId);
      res.json(projects);
    } catch (error: any) {
      console.error('Failed to fetch modeling projects by broker:', error);
      res.status(500).json({ error: 'Failed to fetch modeling projects by broker' });
    }
  });

  // Create new modeling project
  app.post('/api/modeling/projects', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const data = insertModelingProjectSchema.parse(req.body);
      
      // Use database transaction to ensure atomicity
      const result = await db.transaction(async (tx) => {
        let dealIdToUse = data.dealId;
        
        // Only create a new CRM deal if one wasn't provided
        if (!dealIdToUse) {
          // Fetch default pipeline and stage for the organization
          const pipelines = await storage.getCrmPipelinesForOrg(orgId);
          const defaultPipeline = pipelines[0]; // Get first pipeline as default
          
          let pipelineId: string | undefined;
          let stageId: string | undefined;
          
          if (defaultPipeline) {
            pipelineId = defaultPipeline.id;
            // Get first stage of the pipeline
            const stages = await storage.getCrmPipelineStagesByPipeline(pipelineId);
            if (stages && stages.length > 0) {
              stageId = stages[0].id;
            }
          }
          
          // Create a corresponding CRM deal for this modeling project
          // Only include pipelineId/stageId if they exist (omit undefined fields)
          const [deal] = await tx.insert(crmDeals).values({
            title: data.marinaName,
            type: 'marina_acquisition',
            marinaName: data.marinaName,
            city: data.city,
            state: data.state,
            stage: 'modeling',
            ...(pipelineId && { pipelineId }),
            ...(stageId && { stageId }),
            ownerId: userId,
            orgId,
          }).returning();
          
          dealIdToUse = deal.id;
        }
        
        // Create the modeling project and link it to the deal
        const [project] = await tx.insert(modelingProjects).values({ 
          ...data as any, 
          orgId, 
          createdBy: userId,
          dealId: dealIdToUse 
        }).returning();
        
        return project;
      });
      
      // Check if a CRM property exists with this marina name
      // If not found, create a pending property for review
      try {
        const existingProperty = await storage.findPropertyByLocation(
          orgId, 
          data.marinaName, 
          data.city || undefined, 
          data.state || undefined
        );
        
        if (!existingProperty) {
          await storage.createPendingProperty({
            orgId,
            sourceType: 'modeling_project',
            marinaName: data.marinaName,
            city: data.city || null,
            state: data.state || null,
            address: data.address || null,
            createdBy: userId,
            compMetadata: { 
              fromModelingProjectId: result.id,
              fromModelingProjectName: data.marinaName 
            },
          });
        }
      } catch (pendingError) {
        console.error('Failed to create pending property (non-blocking):', pendingError);
      }
      
      res.status(201).json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create modeling project:', error?.message || error, error?.stack);
      res.status(500).json({ error: 'Failed to create modeling project', details: error?.message });
    }
  });

  // Update modeling project
  app.patch('/api/modeling/projects/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const data = updateModelingProjectSchema.parse(req.body);
      const project = await storage.updateModelingProject(req.params.id, { ...data, updatedBy: userId }, orgId);
      
      if (!project) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }

      // Log to activity feed (fire-and-forget — never blocks the response)
      void db.insert(modelingProjectActivity).values({
        projectId: req.params.id,
        userId,
        action: 'updated project assumptions',
        metadata: { changedKeys: Object.keys(data).filter(k => k !== 'updatedBy') },
      }).catch((e: unknown) => console.warn('[activity] Failed to log project update:', e instanceof Error ? e.message : e));

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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update modeling project:', error);
      res.status(500).json({ error: 'Failed to update modeling project' });
    }
  });

  // Delete modeling project

  // Compute direct input financials (live preview — no DB write)
  app.post('/api/modeling/projects/:projectId/compute-direct-input', authenticateUser, async (req: any, res) => {
    try {
      const { computeDirectInputFinancials } = await import('../services/direct-input-engine');
      const { assetClass, inputAssumptions, unitMix } = req.body;
      if (!assetClass || !inputAssumptions) {
        return res.status(400).json({ error: 'assetClass and inputAssumptions are required' });
      }
      const result = computeDirectInputFinancials(assetClass, inputAssumptions, unitMix);
      if (!result) {
        return res.json({ totalRevenue: 0, totalExpenses: 0, noi: 0, revenueLines: [], expenseLines: [], formulaBreakdowns: {} });
      }
      res.json(result);
    } catch (error: any) {
      console.error('Failed to compute direct input financials:', error);
      res.status(500).json({ error: 'Failed to compute financials' });
    }
  });

  // Multi-year pro forma projection
  app.post('/api/modeling/projects/:projectId/multi-year-projection', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { computeDirectInputFinancials } = await import('../services/direct-input-engine');
      const { computeMultiYearProjection, buildProjectionConfig } = await import('../services/multi-year-projection-engine');
      const { pool } = await import('./db');
      const r1 = await pool.query('SELECT id, asset_class, custom_metrics FROM modeling_projects WHERE id = $1 AND org_id = $2', [projectId, orgId]);
      const project = r1.rows[0];
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const r2 = await pool.query('SELECT hold_period FROM modeling_project_config WHERE modeling_project_id = $1 LIMIT 1', [projectId]);
      const projConfig = r2.rows[0] ? { holdPeriod: r2.rows[0].hold_period } : { holdPeriod: 5 };
      const r3 = await pool.query('SELECT revenue_growth_rate, expense_growth_rate, exit_cap_rate FROM modeling_scenario_versions WHERE modeling_project_id = $1 ORDER BY created_at DESC LIMIT 1', [projectId]);
      const latestScenario = r3.rows[0] ?? null;
      const bodyOverrides = Object.fromEntries(
        Object.entries({
          holdPeriod: req.body.holdPeriod,
          revenueGrowthRate: req.body.revenueGrowthRate,
          expenseGrowthRate: req.body.expenseGrowthRate,
          categoryGrowthRates: req.body.categoryGrowthRates,
          vacancyCurve: req.body.vacancyCurve,
          capexSchedule: req.body.capexSchedule,
          defaultCapExPct: req.body.defaultCapExPct,
          exitCapRate: req.body.exitCapRate,
          sellingCostPct: req.body.sellingCostPct,
        }).filter(([, v]) => v !== undefined)
      );
      const projectionConfig = buildProjectionConfig(
        projConfig,
        latestScenario ? {
          revenueGrowthRate: latestScenario.revenue_growth_rate,
          expenseGrowthRate: latestScenario.expense_growth_rate,
        } : null,
        bodyOverrides
      );
      const COMMERCIAL = new Set(['retail', 'office', 'industrial', 'mixed_use', 'medical_office', 'flex']);
      const assetClass = project.asset_class ?? 'multifamily';
      if (COMMERCIAL.has(assetClass)) {
        try {
          const { syncLeaseRollupToAssumptions } = await import('../services/commercial-lease-bridge');
          await syncLeaseRollupToAssumptions(projectId, orgId);
        } catch (leaseErr) {
          console.warn('[multiYearProjection] lease sync failed:', leaseErr);
        }
      }
      const customMetrics = (project.custom_metrics ?? {});
      const year1Financials = computeDirectInputFinancials(
        assetClass,
        customMetrics.inputAssumptions ?? {},
        customMetrics.unitMix ?? []
      );
      const result = computeMultiYearProjection(year1Financials, projectionConfig);
      res.json({ projectId, assetClass, projection: result, meta: { holdPeriod: projectionConfig.holdPeriod, revenueGrowthRate: projectionConfig.revenueGrowthRate, expenseGrowthRate: projectionConfig.expenseGrowthRate, exitCapRate: projectionConfig.exitCapRate, leaseSynced: COMMERCIAL.has(assetClass) } });
    } catch (error) {
      console.error('[multi-year-projection]', error);
      res.status(500).json({ error: error.message ?? 'Failed to compute projection' });
    }
  });

  app.delete('/api/modeling/projects/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteModelingProject(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Modeling project not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete modeling project:', error);
      res.status(500).json({ error: 'Failed to delete modeling project' });
    }
  });

  // ============================================================================
  // MODELING CASES - User-defined scenarios (e.g., Base, Conservative, Aggressive)
  // ============================================================================

  // Get all cases for a project
  app.get('/api/modeling/projects/:projectId/cases', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { modelingCases } = await import('@shared/schema');
      const { eq, and, asc } = await import('drizzle-orm');
      const cases = await db.select()
        .from(modelingCases)
        .where(and(eq(modelingCases.projectId, projectId), eq(modelingCases.orgId, orgId)))
        .orderBy(asc(modelingCases.sortOrder));
      res.json(cases);
    } catch (error: any) {
      console.error('Failed to fetch modeling cases:', error);
      res.status(500).json({ error: 'Failed to fetch modeling cases' });
    }
  });

  // Get a single case by ID
  app.get('/api/modeling/cases/:caseId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { caseId } = req.params;
      
      const { modelingCases } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const [modelCase] = await db.select()
        .from(modelingCases)
        .where(and(eq(modelingCases.id, caseId), eq(modelingCases.orgId, orgId)));
      
      if (!modelCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      res.json(modelCase);
    } catch (error: any) {
      console.error('Failed to fetch modeling case:', error);
      res.status(500).json({ error: 'Failed to fetch modeling case' });
    }
  });

  // Create a new case
  app.post('/api/modeling/projects/:projectId/cases', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { modelingCases, insertModelingCaseSchema } = await import('@shared/schema');
      const { eq, and, count } = await import('drizzle-orm');
      
      // Get current case count for display order
      const [{ value: caseCount }] = await db.select({ value: count() })
        .from(modelingCases)
        .where(and(eq(modelingCases.projectId, projectId), eq(modelingCases.orgId, orgId)));
      
      const validated = insertModelingCaseSchema.parse({
        ...req.body,
        projectId,
        orgId,
        createdBy: userId,
        displayOrder: Number(caseCount),
      });
      
      const [newCase] = await db.insert(modelingCases).values(validated).returning();
      res.status(201).json(newCase);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create modeling case:', error);
      res.status(500).json({ error: 'Failed to create modeling case' });
    }
  });

  // Update a case
  app.patch('/api/modeling/cases/:caseId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { caseId } = req.params;
      
      const { modelingCases, updateModelingCaseSchema } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const validated = updateModelingCaseSchema.parse(req.body);
      
      const [updated] = await db.update(modelingCases)
        .set({ ...validated, updatedAt: new Date() })
        .where(and(eq(modelingCases.id, caseId), eq(modelingCases.orgId, orgId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update modeling case:', error);
      res.status(500).json({ error: 'Failed to update modeling case' });
    }
  });

  // Delete a case
  app.delete('/api/modeling/cases/:caseId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { caseId } = req.params;
      
      const { modelingCases } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Prevent deletion of base case
      const [modelCase] = await db.select()
        .from(modelingCases)
        .where(and(eq(modelingCases.id, caseId), eq(modelingCases.orgId, orgId)));
      
      if (!modelCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      if (modelCase.isDefault) {
        return res.status(400).json({ error: 'Cannot delete the default case' });
      }
      
      await db.delete(modelingCases)
        .where(and(eq(modelingCases.id, caseId), eq(modelingCases.orgId, orgId)));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete modeling case:', error);
      res.status(500).json({ error: 'Failed to delete modeling case' });
    }
  });

  // Set a case as default (unsets previous default)
  app.post('/api/modeling/cases/:caseId/set-default', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { caseId } = req.params;
      
      const { modelingCases } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const [modelCase] = await db.select()
        .from(modelingCases)
        .where(and(eq(modelingCases.id, caseId), eq(modelingCases.orgId, orgId)));
      
      if (!modelCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Unset all other defaults for this project
      await db.update(modelingCases)
        .set({ isDefault: false })
        .where(and(
          eq(modelingCases.projectId, modelCase.projectId),
          eq(modelingCases.orgId, orgId)
        ));
      
      // Set this one as default
      const [updated] = await db.update(modelingCases)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(modelingCases.id, caseId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to set default case:', error);
      res.status(500).json({ error: 'Failed to set default case' });
    }
  });

  // Clone a case (copy assumptions to a new case)
  app.post('/api/modeling/cases/:caseId/clone', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { caseId } = req.params;
      const { name, description } = req.body;
      
      const { modelingCases, modelingCaseAssumptions, modelingCaseLeaseUpData } = await import('@shared/schema');
      const { eq, and, count } = await import('drizzle-orm');
      
      // Get source case
      const [sourceCase] = await db.select()
        .from(modelingCases)
        .where(and(eq(modelingCases.id, caseId), eq(modelingCases.orgId, orgId)));
      
      if (!sourceCase) {
        return res.status(404).json({ error: 'Source case not found' });
      }
      
      // Get case count for display order
      const [{ value: caseCount }] = await db.select({ value: count() })
        .from(modelingCases)
        .where(and(eq(modelingCases.projectId, sourceCase.projectId), eq(modelingCases.orgId, orgId)));
      
      // Create new case
      const [newCase] = await db.insert(modelingCases).values({
        projectId: sourceCase.projectId,
        orgId,
        name: name || `${sourceCase.name} (Copy)`,
        description: description || sourceCase.description,
        displayOrder: Number(caseCount),
        isDefault: false,
        createdBy: userId,
      }).returning();
      
      // Copy assumptions
      const sourceAssumptions = await db.select()
        .from(modelingCaseAssumptions)
        .where(eq(modelingCaseAssumptions.caseId, caseId));
      
      if (sourceAssumptions.length > 0) {
        await db.insert(modelingCaseAssumptions).values(
          sourceAssumptions.map(a => ({
            caseId: newCase.id,
            category: a.category,
            key: a.key,
            value: a.value,
            label: a.label,
            notes: a.notes,
          }))
        );
      }
      
      // Copy lease-up data
      const sourceLeaseUp = await db.select()
        .from(modelingCaseLeaseUpData)
        .where(eq(modelingCaseLeaseUpData.caseId, caseId));
      
      if (sourceLeaseUp.length > 0) {
        await db.insert(modelingCaseLeaseUpData).values(
          sourceLeaseUp.map(l => ({
            caseId: newCase.id,
            unitType: l.unitType,
            year: l.year,
            month: l.month,
            occupancy: l.occupancy,
            rate: l.rate,
            notes: l.notes,
          }))
        );
      }
      
      res.status(201).json(newCase);
    } catch (error: any) {
      console.error('Failed to clone case:', error);
      res.status(500).json({ error: 'Failed to clone case' });
    }
  });

  // ============================================================================
  // MODELING CASE ASSUMPTIONS - Case-specific assumptions
  // ============================================================================

  // Get all assumptions for a case
  app.get('/api/modeling/cases/:caseId/assumptions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { caseId } = req.params;
      
      const { modelingCases, modelingCaseAssumptions } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Verify case belongs to org
      const [modelCase] = await db.select()
        .from(modelingCases)
        .where(and(eq(modelingCases.id, caseId), eq(modelingCases.orgId, orgId)));
      
      if (!modelCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      const assumptions = await db.select()
        .from(modelingCaseAssumptions)
        .where(eq(modelingCaseAssumptions.caseId, caseId));
      
      res.json(assumptions);
    } catch (error: any) {
      console.error('Failed to fetch case assumptions:', error);
      res.status(500).json({ error: 'Failed to fetch case assumptions' });
    }
  });

  // Upsert assumptions for a case
  app.put('/api/modeling/cases/:caseId/assumptions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { caseId } = req.params;
      const { assumptions } = req.body; // Array of { category, key, value, label?, notes? }
      
      const { modelingCases, modelingCaseAssumptions } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Verify case belongs to org
      const [modelCase] = await db.select()
        .from(modelingCases)
        .where(and(eq(modelingCases.id, caseId), eq(modelingCases.orgId, orgId)));
      
      if (!modelCase) {
        return res.status(404).json({ error: 'Case not found' });
      }
      
      // Delete existing and insert new
      await db.delete(modelingCaseAssumptions).where(eq(modelingCaseAssumptions.caseId, caseId));
      
      if (assumptions && assumptions.length > 0) {
        await db.insert(modelingCaseAssumptions).values(
          assumptions.map((a: any) => ({
            caseId,
            category: a.category,
            key: a.key,
            value: a.value,
            label: a.label,
            notes: a.notes,
          }))
        );
      }
      
      const updated = await db.select()
        .from(modelingCaseAssumptions)
        .where(eq(modelingCaseAssumptions.caseId, caseId));
      
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to upsert case assumptions:', error);
      res.status(500).json({ error: 'Failed to upsert case assumptions' });
    }
  });

  // ============================================================================
  // MODELING ADDBACKS - Line item addback flags and values
  // ============================================================================

  // Get all addbacks for a project
  app.get('/api/modeling/projects/:projectId/addbacks', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { modelingAddbacks, modelingAddbackValues } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const addbacks = await db.select()
        .from(modelingAddbacks)
        .where(and(eq(modelingAddbacks.projectId, projectId), eq(modelingAddbacks.orgId, orgId)));
      
      // Get values for each addback
      const addbacksWithValues = await Promise.all(addbacks.map(async (addback) => {
        const values = await db.select()
          .from(modelingAddbackValues)
          .where(eq(modelingAddbackValues.addbackId, addback.id));
        return { ...addback, values };
      }));
      
      res.json(addbacksWithValues);
    } catch (error: any) {
      console.error('Failed to fetch addbacks:', error);
      res.status(500).json({ error: 'Failed to fetch addbacks' });
    }
  });

  // Create or update addback (supports line_item, category, month_cell scopes)
  app.post('/api/modeling/projects/:projectId/addbacks', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { lineItemKey, lineItemLabel, lineItemId, category, department, reason, notes, periodType, scope, addbackMonth, addbackYear, amount, values } = req.body;
      
      const resolvedScope = scope || 'line_item';
      const resolvedKey = lineItemKey || lineItemId;
      const resolvedLabel = lineItemLabel || lineItemId;

      if (!resolvedKey || !resolvedLabel) {
        return res.status(400).json({ error: 'lineItemKey and lineItemLabel are required' });
      }

      if (resolvedScope === 'month_cell' && (addbackMonth == null || addbackYear == null)) {
        return res.status(400).json({ error: 'addbackMonth and addbackYear are required for month_cell scope' });
      }

      if (!['line_item', 'category', 'month_cell'].includes(resolvedScope)) {
        return res.status(400).json({ error: 'scope must be line_item, category, or month_cell' });
      }

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { modelingAddbacks, modelingAddbackValues } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const conditions: any[] = [
        eq(modelingAddbacks.projectId, projectId),
        eq(modelingAddbacks.lineItemKey, resolvedKey),
        eq(modelingAddbacks.orgId, orgId),
        eq(modelingAddbacks.scope, resolvedScope),
      ];

      if (resolvedScope === 'month_cell' && addbackMonth != null && addbackYear != null) {
        conditions.push(eq(modelingAddbacks.addbackMonth, addbackMonth));
        conditions.push(eq(modelingAddbacks.addbackYear, addbackYear));
      }

      const [existing] = await db.select()
        .from(modelingAddbacks)
        .where(and(...conditions));
      
      let addback;
      if (existing) {
        [addback] = await db.update(modelingAddbacks)
          .set({ 
            reason: reason || existing.reason, 
            notes: notes !== undefined ? notes : existing.notes, 
            periodType: periodType || existing.periodType, 
            category: category || existing.category,
            department: department || existing.department, 
            isActive: true, 
            updatedAt: new Date() 
          })
          .where(eq(modelingAddbacks.id, existing.id))
          .returning();
        
        await db.delete(modelingAddbackValues).where(eq(modelingAddbackValues.addbackId, existing.id));
      } else {
        [addback] = await db.insert(modelingAddbacks).values({
          projectId,
          orgId,
          lineItemKey: resolvedKey,
          lineItemLabel: resolvedLabel,
          category: category || null,
          department: department || null,
          reason: reason || null,
          notes: notes || null,
          periodType: periodType || (resolvedScope === 'month_cell' ? 'monthly' : 'yearly'),
          scope: resolvedScope,
          addbackMonth: addbackMonth != null ? addbackMonth : null,
          addbackYear: addbackYear != null ? addbackYear : null,
          isActive: true,
          createdBy: userId,
        }).returning();
      }
      
      if (values && values.length > 0) {
        await db.insert(modelingAddbackValues).values(
          values.map((v: any) => ({
            addbackId: addback.id,
            year: v.year,
            month: v.month != null ? v.month : null,
            amount: String(v.amount || '0'),
          }))
        );
      } else if (amount != null && amount !== '') {
        if (resolvedScope === 'month_cell' && addbackYear != null && addbackMonth != null) {
          await db.insert(modelingAddbackValues).values({
            addbackId: addback.id,
            year: addbackYear,
            month: addbackMonth,
            amount: String(amount),
          });
        } else if (resolvedScope === 'line_item' || resolvedScope === 'category') {
          await db.insert(modelingAddbackValues).values({
            addbackId: addback.id,
            year: addbackYear || new Date().getFullYear(),
            month: null,
            amount: String(amount),
          });
        }
      }
      
      const addbackValues = await db.select()
        .from(modelingAddbackValues)
        .where(eq(modelingAddbackValues.addbackId, addback.id));
      
      res.json({ ...addback, values: addbackValues });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create/update addback:', error);
      res.status(500).json({ error: 'Failed to create/update addback', details: error.message });
    }
  });

  // Toggle addback active/inactive (for inline P&L toggling)
  app.patch('/api/modeling/addbacks/:addbackId/toggle', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { addbackId } = req.params;
      const { isActive } = req.body;
      
      const { modelingAddbacks } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const [updated] = await db.update(modelingAddbacks)
        .set({ isActive: isActive !== undefined ? isActive : true, updatedAt: new Date() })
        .where(and(eq(modelingAddbacks.id, addbackId), eq(modelingAddbacks.orgId, orgId)))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Addback not found' });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to toggle addback:', error);
      res.status(500).json({ error: 'Failed to toggle addback' });
    }
  });

  // Bulk addback all months for a line item
  app.post('/api/modeling/projects/:projectId/addbacks/bulk-months', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { lineItemKey, lineItemLabel, category, department, reason, notes, months: monthEntries } = req.body;

      if (!lineItemKey || !category || !monthEntries || !Array.isArray(monthEntries) || monthEntries.length === 0) {
        return res.status(400).json({ error: 'lineItemKey, category, and months array are required' });
      }

      const { modelingAddbacks, modelingAddbackValues, modelingProjects } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [project] = await db.select().from(modelingProjects)
        .where(and(eq(modelingProjects.id, projectId), eq(modelingProjects.orgId, orgId)));
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const seen = new Set<string>();
      const deduped = monthEntries.filter((entry: any) => {
        const key = `${entry.year}-${entry.month}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const results: any[] = [];

      for (const entry of deduped) {
        const { year, month, amount } = entry;
        if (year == null || month == null || month < 1 || month > 12) continue;

        const conditions = [
          eq(modelingAddbacks.projectId, projectId),
          eq(modelingAddbacks.lineItemKey, lineItemKey),
          eq(modelingAddbacks.orgId, orgId),
          eq(modelingAddbacks.scope, 'month_cell'),
          eq(modelingAddbacks.addbackMonth, month),
          eq(modelingAddbacks.addbackYear, year),
        ];

        const [existing] = await db.select()
          .from(modelingAddbacks)
          .where(and(...conditions));

        let addback;
        if (existing) {
          [addback] = await db.update(modelingAddbacks)
            .set({
              lineItemLabel: lineItemLabel || existing.lineItemLabel,
              category: category || existing.category,
              department: department || existing.department,
              reason: reason || existing.reason || 'other',
              notes: notes || existing.notes,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(eq(modelingAddbacks.id, existing.id))
            .returning();

          await db.delete(modelingAddbackValues).where(eq(modelingAddbackValues.addbackId, existing.id));
        } else {
          [addback] = await db.insert(modelingAddbacks).values({
            projectId,
            orgId,
            lineItemKey,
            lineItemLabel: lineItemLabel || lineItemKey,
            category: category || null,
            department: department || null,
            scope: 'month_cell',
            reason: reason || 'other',
            notes: notes || null,
            periodType: 'monthly',
            isActive: true,
            addbackMonth: month,
            addbackYear: year,
            createdBy: userId,
          }).returning();
        }

        const amountStr = amount != null ? String(amount) : '0';
        await db.insert(modelingAddbackValues).values({
          addbackId: addback.id,
          year,
          month,
          amount: amountStr,
        });

        const addbackValues = await db.select()
          .from(modelingAddbackValues)
          .where(eq(modelingAddbackValues.addbackId, addback.id));

        results.push({ ...addback, values: addbackValues });
      }

      res.json(results);
    } catch (error: any) {
      console.error('Failed to bulk create addbacks:', error);
      res.status(500).json({ error: 'Failed to bulk create addbacks', details: error.message });
    }
  });

  // Delete an addback
  app.delete('/api/modeling/addbacks/:addbackId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { addbackId } = req.params;
      
      const { modelingAddbacks } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const [deleted] = await db.delete(modelingAddbacks)
        .where(and(eq(modelingAddbacks.id, addbackId), eq(modelingAddbacks.orgId, orgId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: 'Addback not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete addback:', error);
      res.status(500).json({ error: 'Failed to delete addback' });
    }
  });
  // ============================================================================
  // P&L LINE ITEM OVERRIDES - Department moves and exclusions
  // ============================================================================

  app.get('/api/modeling/projects/:projectId/pnl-overrides', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { modelingPnlOverrides } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const overrides = await db.select()
        .from(modelingPnlOverrides)
        .where(and(eq(modelingPnlOverrides.projectId, projectId), eq(modelingPnlOverrides.orgId, orgId)));

      res.json(overrides);
    } catch (error: any) {
      console.error('Failed to fetch P&L overrides:', error);
      res.status(500).json({ error: 'Failed to fetch P&L overrides' });
    }
  });

  app.post('/api/modeling/projects/:projectId/pnl-overrides', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { lineItemKey, category, overrideType, overrideDepartment, overrideCategory, notes } = req.body;

      if (!lineItemKey || !overrideType) {
        return res.status(400).json({ error: 'lineItemKey and overrideType are required' });
      }
      if (overrideType === 'department' && !overrideDepartment && !overrideCategory) {
        return res.status(400).json({ error: 'overrideDepartment or overrideCategory is required for department overrides' });
      }

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { modelingPnlOverrides } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [existing] = await db.select()
        .from(modelingPnlOverrides)
        .where(and(
          eq(modelingPnlOverrides.projectId, projectId),
          eq(modelingPnlOverrides.lineItemKey, lineItemKey),
          eq(modelingPnlOverrides.overrideType, overrideType),
        ));

      let result;
      if (existing) {
        [result] = await db.update(modelingPnlOverrides)
          .set({
            category: category || existing.category,
            overrideDepartment: overrideDepartment !== undefined ? (overrideDepartment || existing.overrideDepartment) : existing.overrideDepartment,
            overrideCategory: overrideCategory !== undefined ? (overrideCategory || null) : existing.overrideCategory,
            notes: notes !== undefined ? notes : existing.notes,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(modelingPnlOverrides.id, existing.id))
          .returning();
      } else {
        [result] = await db.insert(modelingPnlOverrides).values({
          projectId,
          orgId,
          lineItemKey,
          category: category || null,
          overrideType,
          overrideDepartment: overrideDepartment || null,
          overrideCategory: overrideCategory || null,
          isActive: true,
          notes: notes || null,
          createdBy: userId,
        }).returning();
      }

      res.json(result);
    } catch (error: any) {
      console.error('Failed to upsert P&L override:', error);
      res.status(500).json({ error: 'Failed to save P&L override' });
    }
  });

  app.patch('/api/modeling/projects/:projectId/pnl-overrides/:overrideId/clear-category', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, overrideId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { modelingPnlOverrides } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [existing] = await db.select()
        .from(modelingPnlOverrides)
        .where(and(eq(modelingPnlOverrides.id, overrideId), eq(modelingPnlOverrides.orgId, orgId)));

      if (!existing) return res.status(404).json({ error: 'Override not found' });

      if (existing.overrideDepartment) {
        const [updated] = await db.update(modelingPnlOverrides)
          .set({ overrideCategory: null, updatedAt: new Date() })
          .where(eq(modelingPnlOverrides.id, overrideId))
          .returning();
        res.json(updated);
      } else {
        const [deleted] = await db.delete(modelingPnlOverrides)
          .where(eq(modelingPnlOverrides.id, overrideId))
          .returning();
        res.json({ success: true });
      }
    } catch (error: any) {
      console.error('Failed to clear category override:', error);
      res.status(500).json({ error: 'Failed to clear category override' });
    }
  });

  app.delete('/api/modeling/projects/:projectId/pnl-overrides/:overrideId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, overrideId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const { modelingPnlOverrides } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const [deleted] = await db.delete(modelingPnlOverrides)
        .where(and(eq(modelingPnlOverrides.id, overrideId), eq(modelingPnlOverrides.orgId, orgId)))
        .returning();

      if (!deleted) return res.status(404).json({ error: 'Override not found' });
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete P&L override:', error);
      res.status(500).json({ error: 'Failed to delete P&L override' });
    }
  });

  // ============================================================================
  // DISPLAY NAME OVERRIDES - Project-level and org-level name customization
  // ============================================================================

  // Get all name overrides for a project (includes org defaults for unset items)
  app.get('/api/modeling/projects/:projectId/name-overrides', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const { modelingNameOverrides, orgPnlDisplayDefaults } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const overrides = await db.select()
        .from(modelingNameOverrides)
        .where(and(eq(modelingNameOverrides.projectId, projectId), eq(modelingNameOverrides.orgId, orgId)));
      
      const orgDefaults = await db.select()
        .from(orgPnlDisplayDefaults)
        .where(and(eq(orgPnlDisplayDefaults.orgId, orgId), eq(orgPnlDisplayDefaults.isActive, true)));
      
      res.json({ overrides, orgDefaults });
    } catch (error: any) {
      console.error('Failed to fetch name overrides:', error);
      res.status(500).json({ error: 'Failed to fetch name overrides' });
    }
  });

  // Create or update a name override (also upserts org default)
  app.post('/api/modeling/projects/:projectId/name-overrides', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { scope, originalName, displayName, category, department } = req.body;
      
      if (!scope || !originalName || !displayName) {
        return res.status(400).json({ error: 'scope, originalName, and displayName are required' });
      }
      
      const { modelingNameOverrides, orgPnlDisplayDefaults } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const overrideConditions = [
        eq(modelingNameOverrides.projectId, projectId),
        eq(modelingNameOverrides.orgId, orgId),
        eq(modelingNameOverrides.scope, scope),
        eq(modelingNameOverrides.originalName, originalName),
      ];
      if (scope === 'line_item' && category) {
        overrideConditions.push(eq(modelingNameOverrides.category, category));
      }
      const [existing] = await db.select()
        .from(modelingNameOverrides)
        .where(and(...overrideConditions));
      
      let override;
      if (existing) {
        [override] = await db.update(modelingNameOverrides)
          .set({ displayName, category, department, updatedAt: new Date() })
          .where(eq(modelingNameOverrides.id, existing.id))
          .returning();
      } else {
        [override] = await db.insert(modelingNameOverrides).values({
          orgId,
          projectId,
          scope,
          originalName,
          displayName,
          category: category || null,
          department: department || null,
          createdBy: userId,
        }).returning();
      }
      
      // Upsert org-level default
      const [existingDefault] = await db.select()
        .from(orgPnlDisplayDefaults)
        .where(and(
          eq(orgPnlDisplayDefaults.orgId, orgId),
          eq(orgPnlDisplayDefaults.scope, scope),
          eq(orgPnlDisplayDefaults.originalName, originalName)
        ));
      
      if (existingDefault) {
        await db.update(orgPnlDisplayDefaults)
          .set({
            displayName,
            timesUsed: (existingDefault.timesUsed || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(orgPnlDisplayDefaults.id, existingDefault.id));
      } else {
        await db.insert(orgPnlDisplayDefaults).values({
          orgId,
          scope,
          originalName,
          displayName,
          category: category || null,
          department: department || null,
        });
      }
      
      res.json(override);
    } catch (error: any) {
      console.error('Failed to save name override:', error);
      res.status(500).json({ error: 'Failed to save name override' });
    }
  });

  // Delete a name override (reverts to original name for this project)
  app.delete('/api/modeling/projects/:projectId/name-overrides/:overrideId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { overrideId } = req.params;
      
      const { modelingNameOverrides } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const [deleted] = await db.delete(modelingNameOverrides)
        .where(and(eq(modelingNameOverrides.id, overrideId), eq(modelingNameOverrides.orgId, orgId)))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: 'Override not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete name override:', error);
      res.status(500).json({ error: 'Failed to delete name override' });
    }
  });
  // ============================================================================
  // MODELING FINANCIAL PERIODS - Year-based financial data for pricing/yields
  // ============================================================================

  // Get all financial periods for a project
  app.get('/api/modeling/projects/:projectId/financial-periods', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const periods = await storage.getModelingFinancialPeriods(projectId, orgId);
      res.json(periods);
    } catch (error: any) {
      console.error('Failed to fetch financial periods:', error);
      res.status(500).json({ error: 'Failed to fetch financial periods' });
    }
  });

  // Get available period options for year selector (returns just period type and label)
  app.get('/api/modeling/projects/:projectId/available-periods', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const periods = await storage.getAvailableFinancialPeriods(projectId, orgId);
      res.json(periods);
    } catch (error: any) {
      console.error('Failed to fetch available periods:', error);
      res.status(500).json({ error: 'Failed to fetch available periods' });
    }
  });

  // Get a specific financial period by ID
  app.get('/api/modeling/financial-periods/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const period = await storage.getModelingFinancialPeriod(req.params.id, orgId);
      
      if (!period) {
        return res.status(404).json({ error: 'Financial period not found' });
      }
      
      res.json(period);
    } catch (error: any) {
      console.error('Failed to fetch financial period:', error);
      res.status(500).json({ error: 'Failed to fetch financial period' });
    }
  });

  // Get financial period by label for a project
  app.get('/api/modeling/projects/:projectId/financial-periods/by-label/:label', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, label } = req.params;
      
      const period = await storage.getModelingFinancialPeriodByLabel(projectId, label, orgId);
      
      if (!period) {
        return res.status(404).json({ error: 'Financial period not found' });
      }
      
      res.json(period);
    } catch (error: any) {
      console.error('Failed to fetch financial period by label:', error);
      res.status(500).json({ error: 'Failed to fetch financial period by label' });
    }
  });

  // Create a new financial period
  app.post('/api/modeling/projects/:projectId/financial-periods', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const data = {
        ...req.body,
        orgId,
        modelingProjectId: projectId,
        createdBy: userId
      };
      
      const period = await storage.createModelingFinancialPeriod(data);
      res.status(201).json(period);
    } catch (error: any) {
      console.error('Failed to create financial period:', error);
      res.status(500).json({ error: 'Failed to create financial period' });
    }
  });

  // Update a financial period
  app.patch('/api/modeling/financial-periods/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      
      const period = await storage.updateModelingFinancialPeriod(req.params.id, req.body, orgId);
      
      if (!period) {
        return res.status(404).json({ error: 'Financial period not found' });
      }
      
      res.json(period);
    } catch (error: any) {
      console.error('Failed to update financial period:', error);
      res.status(500).json({ error: 'Failed to update financial period' });
    }
  });

  // Delete a financial period
  app.delete('/api/modeling/financial-periods/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteModelingFinancialPeriod(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Financial period not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete financial period:', error);
      res.status(500).json({ error: 'Failed to delete financial period' });
    }
  });

  // Recalculate yields for a financial period (based on purchase price and NOI)
  app.post('/api/modeling/financial-periods/:id/recalculate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { purchasePrice, totalUnits } = req.body;
      
      const period = await storage.getModelingFinancialPeriod(req.params.id, orgId);
      if (!period) {
        return res.status(404).json({ error: 'Financial period not found' });
      }
      
      // Calculate yields
      const noi = period.noi ? Number(period.noi) : 0;
      const price = purchasePrice || Number(period.purchasePrice) || 0;
      const units = totalUnits || period.totalUnits || 0;
      const revenue = period.totalRevenue ? Number(period.totalRevenue) : 0;
      
      const capRate = price > 0 ? noi / price : 0;
      const pricePerUnit = units > 0 ? price / units : 0;
      const noiMargin = revenue > 0 ? noi / revenue : 0;
      
      const updated = await storage.updateModelingFinancialPeriod(
        req.params.id,
        {
          purchasePrice: price.toString(),
          capRate: capRate.toString(),
          pricePerUnit: pricePerUnit.toString(),
          noiMargin: noiMargin.toString(),
          totalUnits: units,
          lastCalculatedAt: new Date()
        },
        orgId
      );
      
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to recalculate financial period:', error);
      res.status(500).json({ error: 'Failed to recalculate financial period' });
    }
  });

  // ============================================================================
  // MODELING PERIOD ADJUSTMENTS - Normalization adjustments for financial periods
  // ============================================================================

  // Get all adjustments for a project (optionally filtered by period)
  app.get('/api/modeling/projects/:projectId/adjustments', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { periodLabel } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const adjustments = await storage.getModelingPeriodAdjustments(
        projectId, 
        orgId, 
        periodLabel as string | undefined
      );
      res.json(adjustments);
    } catch (error: any) {
      console.error('Failed to fetch adjustments:', error);
      res.status(500).json({ error: 'Failed to fetch adjustments' });
    }
  });

  // Get active adjustments for a specific period
  app.get('/api/modeling/projects/:projectId/adjustments/period/:periodLabel', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, periodLabel } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const adjustments = await storage.getActiveAdjustmentsForPeriod(projectId, periodLabel, orgId);
      res.json(adjustments);
    } catch (error: any) {
      console.error('Failed to fetch adjustments for period:', error);
      res.status(500).json({ error: 'Failed to fetch adjustments for period' });
    }
  });

  // Create a new adjustment
  app.post('/api/modeling/projects/:projectId/adjustments', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const data = {
        ...req.body,
        orgId,
        modelingProjectId: projectId,
        createdBy: userId
      };
      
      const adjustment = await storage.createModelingPeriodAdjustment(data);
      res.status(201).json(adjustment);
    } catch (error: any) {
      console.error('Failed to create adjustment:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'An adjustment for this target already exists for this period' });
      }
      res.status(500).json({ error: 'Failed to create adjustment' });
    }
  });

  // Update an adjustment
  app.patch('/api/modeling/adjustments/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const adjustment = await storage.updateModelingPeriodAdjustment(
        req.params.id,
        { ...req.body, updatedBy: userId },
        orgId
      );
      
      if (!adjustment) {
        return res.status(404).json({ error: 'Adjustment not found' });
      }
      
      res.json(adjustment);
    } catch (error: any) {
      console.error('Failed to update adjustment:', error);
      res.status(500).json({ error: 'Failed to update adjustment' });
    }
  });

  // Toggle adjustment active state
  app.patch('/api/modeling/adjustments/:id/toggle', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { isActive } = req.body;
      
      const adjustment = await storage.toggleAdjustmentActive(req.params.id, isActive, orgId);
      
      if (!adjustment) {
        return res.status(404).json({ error: 'Adjustment not found' });
      }
      
      res.json(adjustment);
    } catch (error: any) {
      console.error('Failed to toggle adjustment:', error);
      res.status(500).json({ error: 'Failed to toggle adjustment' });
    }
  });

  // Delete an adjustment
  app.delete('/api/modeling/adjustments/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const success = await storage.deleteModelingPeriodAdjustment(req.params.id, orgId);
      
      if (!success) {
        return res.status(404).json({ error: 'Adjustment not found' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete adjustment:', error);
      res.status(500).json({ error: 'Failed to delete adjustment' });
    }
  });

  // ============================================================================
  // MODELING ANALYTICS - Drill-down analytics for financial data
  // ============================================================================

  // Get category-level aggregations
  app.get('/api/modeling/projects/:projectId/analytics/categories', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const categories = await storage.getActualsAggregationByCategory(projectId, orgId);
      res.json(categories);
    } catch (error: any) {
      console.error('Failed to fetch category analytics:', error);
      res.status(500).json({ error: 'Failed to fetch category analytics' });
    }
  });

  // Get subcategory-level (department) aggregations for a category
  app.get('/api/modeling/projects/:projectId/analytics/categories/:category/subcategories', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, category } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const subcategories = await storage.getActualsAggregationBySubcategory(projectId, category, orgId);
      res.json(subcategories);
    } catch (error: any) {
      console.error('Failed to fetch subcategory analytics:', error);
      res.status(500).json({ error: 'Failed to fetch subcategory analytics' });
    }
  });

  // Get line item-level aggregations for a subcategory
  app.get('/api/modeling/projects/:projectId/analytics/categories/:category/subcategories/:subcategory/line-items', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, category, subcategory } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const lineItems = await storage.getActualsAggregationByLineItem(projectId, category, subcategory, orgId);
      res.json(lineItems);
    } catch (error: any) {
      console.error('Failed to fetch line item analytics:', error);
      res.status(500).json({ error: 'Failed to fetch line item analytics' });
    }
  });

  // Get financial summary with adjustments applied
  app.get('/api/modeling/projects/:projectId/analytics/summary/:periodLabel', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, periodLabel } = req.params;
      const applyAdjustments = req.query.applyAdjustments !== 'false';
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const summary = await storage.getFinancialSummaryWithAdjustments(
        projectId,
        periodLabel,
        orgId,
        applyAdjustments
      );
      res.json(summary);
    } catch (error: any) {
      console.error('Failed to fetch financial summary:', error);
      res.status(500).json({ error: 'Failed to fetch financial summary' });
    }
  });

  // =============================================
  // Unified Marina Catalog - Custom Profit Centers & Amenities
  // =============================================

  app.get('/api/catalog/items', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const type = req.query.type as string | undefined;
      
      let query = db.select().from(customCatalogItems).where(eq(customCatalogItems.orgId, orgId));
      if (type) {
        query = db.select().from(customCatalogItems).where(and(eq(customCatalogItems.orgId, orgId), eq(customCatalogItems.type, type)));
      }
      
      const items = await query;
      // ── Learning: auto-classify pending items on load ─────────────────
      try {
        const { appliedCount } = await applyLearningRules(orgId, items as any);
        if (appliedCount > 0) logger.info(`[Learning] Applied ${appliedCount} rule(s) on items fetch`);
      } catch (e) {
        console.warn('[Learning] applyLearningRules failed silently:', e);
      }
      res.json(items);
    } catch (error: any) {
      console.error('Failed to fetch catalog items:', error);
      res.status(500).json({ error: 'Failed to fetch catalog items' });
    }
  });

  app.post('/api/catalog/items', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const parsed = insertCustomCatalogItemSchema.parse({
        ...req.body,
        orgId,
        createdBy: userId,
      });

      const existing = await db.select().from(customCatalogItems).where(
        and(
          eq(customCatalogItems.orgId, orgId),
          eq(customCatalogItems.type, parsed.type),
          eq(customCatalogItems.name, parsed.name)
        )
      );
      
      if (existing.length > 0) {
        return res.json(existing[0]);
      }

      const [item] = await db.insert(customCatalogItems).values(parsed).returning();
      res.status(201).json(item);
    } catch (error: any) {
      console.error('Failed to create catalog item:', error);
      res.status(500).json({ error: 'Failed to create catalog item' });
    }
  });

  app.delete('/api/catalog/items/:id', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { id } = req.params;
      
      await db.delete(customCatalogItems).where(
        and(eq(customCatalogItems.id, id), eq(customCatalogItems.orgId, orgId))
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete catalog item:', error);
      res.status(500).json({ error: 'Failed to delete catalog item' });
    }
  });

  // Project Workspace - Configuration
  app.get('/api/modeling/projects/:projectId/config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const cm = (project.customMetrics as any) || {};
      const configDefault = { holdPeriod: 5, startDate: '2026-01-31', cashFlowGranularity: 'annual', seasonMonths: [4, 5, 6, 7, 8, 9, 10], departments: {} };
      const config = { ...configDefault, ...(cm.config || {}) };

      if (cm.profitCenters && !config.profitCenters) {
        const wizardToInputsKeyMap: Record<string, string> = {
          commercialTenants: 'pc_commercial_leases',
          fuelSales: 'pc_fuel_dock',
          shipStore: 'pc_ships_store',
          serviceDepartment: 'pc_service',
          boatRentals: 'pc_rental_boats',
          boatClub: 'pc_boat_club',
          boatSales: 'pc_boat_sales',
        };
        const allKnownProfitCenterIds = [
          'pc_fuel_dock', 'pc_marina_amenities', 'pc_ships_store',
          'pc_commercial_leases', 'pc_service', 'pc_parts',
          'pc_boat_club', 'pc_rental_boats', 'pc_boat_sales',
          'pc_boat_finance', 'pc_boat_brokerage', 'pc_fb',
          'pc_rv_park', 'pc_hospitality',
        ];
        const translated: Record<string, any> = {};
        for (const pcId of allKnownProfitCenterIds) {
          translated[pcId] = { isEnabled: false };
        }
        for (const [wizardKey, wizardVal] of Object.entries(cm.profitCenters)) {
          const inputsKey = wizardToInputsKeyMap[wizardKey];
          if (inputsKey && wizardVal && typeof wizardVal === 'object') {
            translated[inputsKey] = { isEnabled: (wizardVal as any).enabled ?? false };
          }
        }
        config.profitCenters = translated;
        if (cm.profitCenters.commercialTenants?.enabled && cm.profitCenters.commercialTenants?.numberOfSuites) {
          config.commercialLeaseCount = cm.profitCenters.commercialTenants.numberOfSuites;
        }
      }
      if (cm.seasonality?.profile && !cm.config?.seasonalityProfile) {
        config.seasonalityProfile = cm.seasonality.profile;
      }
      if (cm.underwriting?.holdPeriodYears && !cm.config?.holdPeriod) {
        config.holdPeriod = cm.underwriting.holdPeriodYears;
      }
      if (cm.seasonality?.seasonStartMonth && cm.seasonality?.seasonEndMonth && !cm.config?.seasonMonths) {
        const start = parseInt(String(cm.seasonality.seasonStartMonth), 10);
        const end = parseInt(String(cm.seasonality.seasonEndMonth), 10);
        if (!isNaN(start) && !isNaN(end) && start >= 1 && start <= 12 && end >= 1 && end <= 12) {
          const months: number[] = [];
          if (start <= end) {
            for (let m = start; m <= end; m++) months.push(m);
          } else {
            for (let m = start; m <= 12; m++) months.push(m);
            for (let m = 1; m <= end; m++) months.push(m);
          }
          config.seasonMonths = months;
        }
      }
      if (cm.storageMix && !config.departments) {
        config.departments = {};
      }
      if (cm.storageMix?.items && Object.keys(config.departments).length === 0) {
        const depts: Record<string, any> = {};
        const isYearRound = cm.seasonality?.profile === 'year_round';
        const wizardStorageIds = new Set<string>();
        for (const item of cm.storageMix.items) {
          if (item.storageType) {
            wizardStorageIds.add(item.storageType);
            const count = parseInt(String(item.count)) || 0;
            const occMode = item.occupancyInputMode || 'percentage';
            let occupiedCount = '';
            let occupancyPercent = '';
            if (occMode === 'count' && item.occupiedCount != null && item.occupiedCount !== '') {
              occupiedCount = String(item.occupiedCount);
              if (count > 0) {
                occupancyPercent = String(Math.round((parseInt(String(item.occupiedCount)) / count) * 100));
              }
            } else if (item.currentOccupancy != null && item.currentOccupancy !== '') {
              occupancyPercent = String(item.currentOccupancy);
              if (count > 0) {
                occupiedCount = String(Math.round((parseFloat(String(item.currentOccupancy)) / 100) * count));
              }
            }
            depts[item.storageType] = {
              isEnabled: true,
              section: 'storage',
              seasons: isYearRound ? ['annual'] : ['seasonal'],
              capacity: count > 0 ? String(count) : '',
              leasable: '',
              occupiedCount,
              occupancyPercent,
              occupancyInputMode: occMode,
              hasDesignatedSpaces: false,
              designatedSpaceIds: [],
            };
          }
        }
        const allKnownStorageTypes = [
          'wet_slips', 'lift_slips', 'moorings', 'dinghies', 'jet_skis',
          'dry_racks_indoor', 'dry_racks_outdoor', 'land_storage',
          'boats_on_trailers', 'trailers', 'carports', 'houseboats',
          'liveaboards', 'rv_sites'
        ];
        for (const stId of allKnownStorageTypes) {
          if (!wizardStorageIds.has(stId)) {
            depts[stId] = {
              isEnabled: false,
              section: 'storage',
              seasons: isYearRound ? ['annual'] : ['seasonal'],
              capacity: '', leasable: '', occupiedCount: '', occupancyPercent: '',
              occupancyInputMode: 'percentage',
              hasDesignatedSpaces: false, designatedSpaceIds: [],
            };
          }
        }
        config.departments = depts;
      }
      
      res.json(config);
    } catch (error: any) {
      console.error('Failed to fetch project config:', error);
      res.status(500).json({ error: 'Failed to fetch project config' });
    }
  });

  app.post('/api/modeling/projects/:projectId/config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const existingMetrics = (project.customMetrics as any) || {};
      const updatedMetrics = {
        ...existingMetrics,
        config: req.body
      };
      
      const updated = await storage.updateModelingProject(
        projectId,
        { customMetrics: updatedMetrics, updatedBy: userId },
        orgId
      );
      
      res.json(req.body);
    } catch (error: any) {
      console.error('Failed to save project config:', error);
      res.status(500).json({ error: 'Failed to save project config' });
    }
  });

  app.patch('/api/modeling/projects/:projectId/config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const existingMetrics = (project.customMetrics as any) || {};
      const existingConfig = existingMetrics.config || {};
      const mergedConfig = { ...existingConfig, ...req.body };

      const updatedMetrics = {
        ...existingMetrics,
        config: mergedConfig,
      };

      await storage.updateModelingProject(
        projectId,
        { customMetrics: updatedMetrics, updatedBy: userId },
        orgId
      );

      if (req.body.holdPeriod !== undefined) {
        const existingMPC = await db.select().from(modelingProjectConfig).where(eq(modelingProjectConfig.modelingProjectId, projectId)).limit(1);
        if (existingMPC.length > 0) {
          await db.update(modelingProjectConfig)
            .set({ holdPeriod: Number(req.body.holdPeriod), updatedAt: new Date() })
            .where(eq(modelingProjectConfig.modelingProjectId, projectId));
        }
      }

      res.json(mergedConfig);
    } catch (error: any) {
      console.error('Failed to patch project config:', error);
      res.status(500).json({ error: 'Failed to patch project config' });
    }
  });

  // Update timeline configuration (Phase 1 - Institutional Grade)
  app.patch('/api/modeling/projects/:projectId/config/timeline', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { projectionStartRule, irrDisplayPreference, stabilizedNoiMode, stabilizedNoiYear, acquisitionCloseDate, ttmEndDate } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Update or create modeling_project_config record
      const existingConfig = await db.select().from(modelingProjectConfig).where(eq(modelingProjectConfig.modelingProjectId, projectId)).limit(1);
      
      const timelineFields = {
        projectionStartRule: projectionStartRule || 'acq_close_year',
        irrDisplayPreference: irrDisplayPreference || 'monthly',
        stabilizedNoiMode: stabilizedNoiMode || 'fixed_year',
        stabilizedNoiYear: stabilizedNoiYear || 3,
        acquisitionCloseDate: acquisitionCloseDate ? new Date(acquisitionCloseDate) : null,
        ttmEndDate: ttmEndDate ? new Date(ttmEndDate) : null,
      };
      
      let result;
      if (existingConfig.length > 0) {
        [result] = await db.update(modelingProjectConfig)
          .set(timelineFields)
          .where(eq(modelingProjectConfig.modelingProjectId, projectId))
          .returning();
      } else {
        [result] = await db.insert(modelingProjectConfig)
          .values({ modelingProjectId: projectId, ...timelineFields })
          .returning();
      }
      
      // Also update customMetrics.config for backward compatibility
      const existingMetrics = (project.customMetrics as any) || {};
      const updatedMetrics = {
        ...existingMetrics,
        config: { ...(existingMetrics.config || {}), ...timelineFields }
      };
      await storage.updateModelingProject(projectId, { customMetrics: updatedMetrics, updatedBy: userId }, orgId);
      
      res.json({ success: true, config: result });
    } catch (error: any) {
      console.error('Failed to update timeline config:', error);
      res.status(500).json({ error: 'Failed to update timeline configuration' });
    }
  });

  // ============================================
  // SEASONALITY PROFILES (Phase 3)
  // ============================================
  
  // Get all seasonality profiles for org
  app.get('/api/modeling/seasonality-profiles', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const profiles = await seasonalityProfileService.getProfiles(orgId);
      res.json(profiles);
    } catch (error: any) {
      console.error('Failed to fetch seasonality profiles:', error);
      res.status(500).json({ error: 'Failed to fetch seasonality profiles' });
    }
  });
  
  // Get a specific profile
  app.get('/api/modeling/seasonality-profiles/:profileId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { profileId } = req.params;
      const profile = await seasonalityProfileService.getProfile(profileId, orgId);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      res.json(profile);
    } catch (error: any) {
      console.error('Failed to fetch seasonality profile:', error);
      res.status(500).json({ error: 'Failed to fetch seasonality profile' });
    }
  });
  
  // Create a new profile
  app.post('/api/modeling/seasonality-profiles', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { name, months, description, isDefault } = req.body;
      if (!name || !months || !Array.isArray(months)) {
        return res.status(400).json({ error: 'Name and months array required' });
      }
      const profile = await seasonalityProfileService.createProfile(orgId, name, months, { description, isDefault });
      res.json(profile);
    } catch (error: any) {
      console.error('Failed to create seasonality profile:', error);
      res.status(500).json({ error: 'Failed to create seasonality profile' });
    }
  });
  
  // Update a profile
  app.patch('/api/modeling/seasonality-profiles/:profileId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { profileId } = req.params;
      const updates = req.body;
      const profile = await seasonalityProfileService.updateProfile(profileId, orgId, updates);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      res.json(profile);
    } catch (error: any) {
      if (error.message === 'Cannot modify system profiles') {
        return res.status(403).json({ error: error.message });
      }
      console.error('Failed to update seasonality profile:', error);
      res.status(500).json({ error: 'Failed to update seasonality profile' });
    }
  });
  
  // Delete a profile
  app.delete('/api/modeling/seasonality-profiles/:profileId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { profileId } = req.params;
      const deleted = await seasonalityProfileService.deleteProfile(profileId, orgId);
      if (!deleted) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      res.json({ success: true });
    } catch (error: any) {
      if (error.message === 'Cannot delete system profiles') {
        return res.status(403).json({ error: error.message });
      }
      console.error('Failed to delete seasonality profile:', error);
      res.status(500).json({ error: 'Failed to delete seasonality profile' });
    }
  });
  
  // Get project seasonality
  app.get('/api/modeling/projects/:projectId/seasonality', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const profile = await seasonalityProfileService.getProjectSeasonality(projectId, orgId);
      res.json(profile);
    } catch (error: any) {
      console.error('Failed to fetch project seasonality:', error);
      res.status(500).json({ error: 'Failed to fetch project seasonality' });
    }
  });
  
  // Set project seasonality
  app.patch('/api/modeling/projects/:projectId/seasonality', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { profileId } = req.body;
      if (!profileId) {
        return res.status(400).json({ error: 'profileId required' });
      }
      await seasonalityProfileService.setProjectSeasonality(projectId, profileId, orgId);
      const profile = await seasonalityProfileService.getProjectSeasonality(projectId, orgId);
      res.json({ success: true, profile });
    } catch (error: any) {
      console.error('Failed to set project seasonality:', error);
      res.status(500).json({ error: 'Failed to set project seasonality' });
    }
  });
  // ============================================
  // SCENARIO GOVERNANCE (Phase 5)
  // ============================================
  
  // Check if scenario can be modified
  app.get('/api/modeling/projects/:projectId/scenarios/:scenarioId/can-modify', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { scenarioId } = req.params;
      const result = await scenarioGovernanceService.canModifyScenario(scenarioId, orgId);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to check scenario modifiability:', error);
      res.status(500).json({ error: 'Failed to check scenario' });
    }
  });
  
  // Fork a scenario (creates editable copy)
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/fork', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { scenarioId } = req.params;
      const { name, description } = req.body;
      const result = await scenarioGovernanceService.forkScenario(scenarioId, orgId, userId, { name, description });
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result.newScenario);
    } catch (error: any) {
      console.error('Failed to fork scenario:', error);
      res.status(500).json({ error: 'Failed to fork scenario' });
    }
  });
  
  // Submit scenario for approval
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/submit', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { scenarioId } = req.params;
      const { notes } = req.body;
      const result = await scenarioGovernanceService.submitForApproval(scenarioId, orgId, userId, notes);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to submit scenario:', error);
      res.status(500).json({ error: 'Failed to submit scenario' });
    }
  });
  
  // Approve scenario (makes it IMMUTABLE)
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/approve', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { scenarioId } = req.params;
      const { notes } = req.body;
      const result = await scenarioGovernanceService.approveScenario(scenarioId, orgId, userId, notes);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true, message: 'Scenario approved and is now immutable' });
    } catch (error: any) {
      console.error('Failed to approve scenario:', error);
      res.status(500).json({ error: 'Failed to approve scenario' });
    }
  });
  
  // Reject scenario
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/reject', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { scenarioId } = req.params;
      const { notes } = req.body;
      if (!notes) {
        return res.status(400).json({ error: 'Rejection reason required' });
      }
      const result = await scenarioGovernanceService.rejectScenario(scenarioId, orgId, userId, notes);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to reject scenario:', error);
      res.status(500).json({ error: 'Failed to reject scenario' });
    }
  });
  
  // Withdraw approval submission
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/withdraw', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { scenarioId } = req.params;
      const { reason } = req.body;
      const result = await scenarioGovernanceService.withdrawSubmission(scenarioId, orgId, userId, reason);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to withdraw submission:', error);
      res.status(500).json({ error: 'Failed to withdraw submission' });
    }
  });
  
  // Get version history
  app.get('/api/modeling/projects/:projectId/scenarios/:scenarioType/history', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioType } = req.params;
      const history = await scenarioGovernanceService.getVersionHistory(projectId, scenarioType, orgId);
      res.json(history);
    } catch (error: any) {
      console.error('Failed to get version history:', error);
      res.status(500).json({ error: 'Failed to get version history' });
    }
  });
  
  // Compare two versions
  app.get('/api/modeling/projects/:projectId/scenarios/compare', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { baseVersionId, compareVersionId } = req.query;
      if (!baseVersionId || !compareVersionId) {
        return res.status(400).json({ error: 'baseVersionId and compareVersionId required' });
      }
      const comparison = await scenarioGovernanceService.compareVersions(
        baseVersionId as string,
        compareVersionId as string,
        orgId
      );
      if (!comparison) {
        return res.status(404).json({ error: 'Versions not found' });
      }
      res.json(comparison);
    } catch (error: any) {
      console.error('Failed to compare versions:', error);
      res.status(500).json({ error: 'Failed to compare versions' });
    }
  });
  
  // Rollback to previous version
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/rollback', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { scenarioId } = req.params;
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: 'Rollback reason required' });
      }
      const result = await scenarioGovernanceService.rollbackToVersion(scenarioId, orgId, userId, reason);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result.newScenario);
    } catch (error: any) {
      console.error('Failed to rollback:', error);
      res.status(500).json({ error: 'Failed to rollback' });
    }
  });
  
  // Get audit log
  app.get('/api/modeling/projects/:projectId/audit-log', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioVersionId, limit } = req.query;
      const logs = await scenarioGovernanceService.getAuditLog(orgId, {
        projectId,
        scenarioVersionId: scenarioVersionId as string | undefined,
        limit: limit ? parseInt(limit as string) : 100,
      });
      res.json(logs);
    } catch (error: any) {
      console.error('Failed to get audit log:', error);
      res.status(500).json({ error: 'Failed to get audit log' });
    }
  });

  // Project Workspace - Unified Deal Pricing (single-driver model)
  app.post('/api/modeling/projects/:projectId/deal-pricing/unified', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const {
        pricingDriver = 'targetIRR',
        purchasePrice,
        targetIRR,
        goingInCapRate,
        targetYearCapRate,
        targetYear,
        holdPeriod = 5,
        exitCapRate = 7.5,
        lockedInputs = [],
        periodLabel,
        periodNOI,
        periodRevenue,
        periodExpenses,
        useNormalizedData = true,
      } = req.body;

      let adjustedNOI = periodNOI ? Number(periodNOI) : undefined;
      let adjustedRevenue = periodRevenue ? Number(periodRevenue) : undefined;
      let adjustedExpenses = periodExpenses ? Number(periodExpenses) : undefined;

      if (useNormalizedData && periodLabel) {
        try {
          const adjustments = await storage.getActiveAdjustmentsForPeriod(projectId, periodLabel, orgId);
          if (adjustments.length > 0) {
            for (const adj of adjustments) {
              const target = (adj.targetIdentifier || '').toLowerCase();
              const value = Number(adj.adjustmentValue) || 0;
              const adjType = adj.adjustmentType;
              if (target === 'revenue' || target.includes('revenue')) {
                const base = adjustedRevenue || 0;
                if (adjType === 'absolute') adjustedRevenue = base + value;
                else if (adjType === 'percentage') adjustedRevenue = base * (1 + value / 100);
                else if (adjType === 'replace') adjustedRevenue = value;
              } else if (target === 'expenses' || target.includes('expense')) {
                const base = adjustedExpenses || 0;
                if (adjType === 'absolute') adjustedExpenses = base + value;
                else if (adjType === 'percentage') adjustedExpenses = base * (1 + value / 100);
                else if (adjType === 'replace') adjustedExpenses = value;
              } else if (target === 'noi' || target.includes('noi')) {
                const base = adjustedNOI || 0;
                if (adjType === 'absolute') adjustedNOI = base + value;
                else if (adjType === 'percentage') adjustedNOI = base * (1 + value / 100);
                else if (adjType === 'replace') adjustedNOI = value;
              }
            }
            if (adjustedRevenue !== undefined && adjustedExpenses !== undefined) {
              const recalcNOI = adjustedRevenue - adjustedExpenses;
              if (adjustedNOI === undefined || adjustedNOI === (periodNOI ? Number(periodNOI) : undefined)) {
                adjustedNOI = recalcNOI;
              }
            }
          }
        } catch (adjError) {
          console.warn('Failed to apply period adjustments:', adjError);
        }
      }

      const result = await dealPricingService.calculateUnified(projectId, orgId, {
        pricingDriver,
        purchasePrice: purchasePrice ? Number(purchasePrice) : undefined,
        targetIRR: targetIRR ? Number(targetIRR) : undefined,
        goingInCapRate: goingInCapRate ? Number(goingInCapRate) : undefined,
        targetYearCapRate: targetYearCapRate ? Number(targetYearCapRate) : undefined,
        targetYear: targetYear ? Number(targetYear) : undefined,
        holdPeriod: Number(holdPeriod),
        exitCapRate: Number(exitCapRate),
        lockedInputs: Array.isArray(lockedInputs) ? lockedInputs : [],
        periodLabel,
        periodNOI: adjustedNOI,
        periodRevenue: adjustedRevenue,
        periodExpenses: adjustedExpenses,
      });

      try {
        const project = await storage.getModelingProject(projectId, orgId);
        if (project) {
          const cm = { ...((project.customMetrics as any) || {}) };
          cm.dealPricingResults = {
            irr: result.irr,
            equityMultiple: result.equityMultiple,
            cashOnCash: result.averageCashOnCash,
            noi: result.projectFinancials.year1NOI,
            purchasePrice: result.purchasePrice,
            goingInCapRate: result.goingInCapRate,
            exitValue: result.exitValue,
            npv: result.npv,
            moic: result.moic,
            updatedAt: new Date().toISOString(),
          };
          await storage.updateModelingProject(projectId, { customMetrics: cm, updatedBy: req.user.id } as any, orgId);
        }
      } catch (persistErr) {
        console.warn('Failed to persist deal pricing results:', persistErr);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Failed to calculate unified deal pricing:', error);
      res.status(500).json({ error: error.message || 'Failed to calculate deal pricing' });
    }
  });

  // Project Workspace - Deal Pricing (legacy bidirectional solve-for calculations)
  app.post('/api/modeling/projects/:projectId/deal-pricing', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const {
        manualPurchasePrice,
        targetIRR,
        goingInCapRate,
        targetYearCapRate,
        targetYear,
        holdPeriod = 5,
        exitCapRate = 7.5,
        revenueGrowthRate,
        expenseGrowthRate,
        periodLabel,
        periodNOI,
        periodRevenue,
        periodExpenses,
        useNormalizedData = true,
      } = req.body;

      let adjustedNOI = periodNOI ? Number(periodNOI) : undefined;
      let adjustedRevenue = periodRevenue ? Number(periodRevenue) : undefined;
      let adjustedExpenses = periodExpenses ? Number(periodExpenses) : undefined;

      if (useNormalizedData && periodLabel) {
        try {
          const adjustments = await storage.getActiveAdjustmentsForPeriod(projectId, periodLabel, orgId);
          if (adjustments.length > 0) {
            for (const adj of adjustments) {
              const target = (adj.targetIdentifier || '').toLowerCase();
              const value = Number(adj.adjustmentValue) || 0;
              const adjType = adj.adjustmentType;

              if (target === 'revenue' || target.includes('revenue')) {
                const base = adjustedRevenue || 0;
                if (adjType === 'absolute') adjustedRevenue = base + value;
                else if (adjType === 'percentage') adjustedRevenue = base * (1 + value / 100);
                else if (adjType === 'replace') adjustedRevenue = value;
              } else if (target === 'expenses' || target.includes('expense')) {
                const base = adjustedExpenses || 0;
                if (adjType === 'absolute') adjustedExpenses = base + value;
                else if (adjType === 'percentage') adjustedExpenses = base * (1 + value / 100);
                else if (adjType === 'replace') adjustedExpenses = value;
              } else if (target === 'noi' || target.includes('noi')) {
                const base = adjustedNOI || 0;
                if (adjType === 'absolute') adjustedNOI = base + value;
                else if (adjType === 'percentage') adjustedNOI = base * (1 + value / 100);
                else if (adjType === 'replace') adjustedNOI = value;
              }
            }
            if (adjustedRevenue !== undefined && adjustedExpenses !== undefined) {
              const recalcNOI = adjustedRevenue - adjustedExpenses;
              if (adjustedNOI === undefined || adjustedNOI === (periodNOI ? Number(periodNOI) : undefined)) {
                adjustedNOI = recalcNOI;
              }
            }
          }
        } catch (adjError) {
          console.warn('Failed to apply period adjustments:', adjError);
        }
      }

      const results = await dealPricingService.calculateAllPricingModes(
        projectId,
        orgId,
        {
          manualPurchasePrice: manualPurchasePrice ? Number(manualPurchasePrice) : undefined,
          targetIRR: targetIRR ? Number(targetIRR) : undefined,
          goingInCapRate: goingInCapRate ? Number(goingInCapRate) : undefined,
          targetYearCapRate: targetYearCapRate ? Number(targetYearCapRate) : undefined,
          targetYear: targetYear ? Number(targetYear) : undefined,
          holdPeriod: Number(holdPeriod),
          exitCapRate: Number(exitCapRate),
          revenueGrowthRate: revenueGrowthRate ? Number(revenueGrowthRate) / 100 : undefined,
          expenseGrowthRate: expenseGrowthRate ? Number(expenseGrowthRate) / 100 : undefined,
          periodLabel,
          periodNOI: adjustedNOI,
          periodRevenue: adjustedRevenue,
          periodExpenses: adjustedExpenses,
        }
      );

      res.json({
        ...results,
        usingNormalizedData: useNormalizedData,
      });
    } catch (error: any) {
      console.error('Failed to calculate deal pricing:', error);
      res.status(500).json({ error: error.message || 'Failed to calculate deal pricing' });
    }
  });

  // Get persisted deal pricing inputs
    // ── Seasonal config for annual uploads ──────────────────────────────────
  app.patch('/api/modeling/projects/:projectId/documents/:uploadId/seasonal-config', authenticateUser, async (req: any, res) => {
    try {
      const { projectId, uploadId } = req.params;
      const orgId = req.user?.orgId;
      const { seasonalConfig } = req.body;
      if (!seasonalConfig) return res.status(400).json({ error: 'seasonalConfig required' });
      await pool.query(
        `UPDATE doc_intel_uploads SET seasonal_config = $1, seasonal_profile = $2 WHERE id = $3 AND org_id = $4 AND modeling_project_id = $5`,
        [JSON.stringify(seasonalConfig), seasonalConfig.defaultProfile ?? 'custom', uploadId, orgId, projectId]
      );
      return res.json({ success: true });
    } catch (e: any) {
      console.error('[seasonal-config PATCH]', e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/modeling/projects/:projectId/deal-pricing/inputs', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      const customMetrics = (project.customMetrics as any) || {};
      const dealPricing = customMetrics.dealPricing || null;
      res.json(dealPricing);
    } catch (error: any) {
      console.error('Failed to get deal pricing inputs:', error);
      res.status(500).json({ error: error.message || 'Failed to get deal pricing inputs' });
    }
  });

  // Persist deal pricing inputs (auto-save as user changes them)
  app.put('/api/modeling/projects/:projectId/deal-pricing/inputs', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { targetIRR, goingInCapRate, exitCapRate, holdPeriod, pricingDriver, purchasePrice, lockedInputs } = req.body;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const customMetrics = { ...((project.customMetrics as any) || {}) };
      customMetrics.dealPricing = {
        targetIRR,
        goingInCapRate,
        exitCapRate,
        holdPeriod,
        pricingDriver,
        purchasePrice,
        lockedInputs: Array.isArray(lockedInputs) ? lockedInputs : [],
        updatedAt: new Date().toISOString(),
      };

      const updates: any = { customMetrics, updatedBy: userId };
      if (purchasePrice !== undefined && purchasePrice !== null) {
        updates.purchasePrice = String(purchasePrice);
      }
      if (goingInCapRate !== undefined && goingInCapRate !== null) {
        updates.year1CapRate = String(goingInCapRate);
      }

      const updated = await storage.updateModelingProject(projectId, updates, orgId);

      void db.insert(modelingProjectActivity).values({
        projectId,
        userId,
        action: 'updated deal pricing assumptions',
        metadata: { pricingDriver: pricingDriver ?? null },
      }).catch((e: unknown) => console.warn('[activity] Failed to log deal pricing update:', e instanceof Error ? e.message : e));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to save deal pricing inputs:', error);
      res.status(500).json({ error: error.message || 'Failed to save deal pricing inputs' });
    }
  });

  app.post('/api/modeling/projects/:projectId/save', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;

      const project = await storage.updateModelingProject(projectId, { updatedBy: userId } as any, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      void db.insert(modelingProjectActivity).values({
        projectId,
        userId,
        action: 'saved project',
        metadata: {},
      }).catch((e: unknown) => console.warn('[activity] Failed to log project save:', e instanceof Error ? e.message : e));

      res.json({ success: true, updatedAt: project.updatedAt });
    } catch (error: any) {
      console.error('Failed to save project:', error);
      res.status(500).json({ error: error.message || 'Failed to save project' });
    }
  });

  app.put('/api/modeling/projects/:projectId/target-price', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { targetPrice } = req.body;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const customMetrics = { ...((project.customMetrics as any) || {}) };
      customMetrics.targetPrice = targetPrice;

      await storage.updateModelingProject(projectId, { customMetrics, updatedBy: userId }, orgId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to save target price:', error);
      res.status(500).json({ error: error.message || 'Failed to save target price' });
    }
  });

  // Save deal pricing configuration (legacy explicit save button)
  app.post('/api/modeling/projects/:projectId/deal-pricing/save', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { purchasePrice, year1CapRate } = req.body;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const updates: any = { updatedBy: userId };
      if (purchasePrice !== undefined) {
        updates.purchasePrice = String(purchasePrice);
      }
      if (year1CapRate !== undefined) {
        updates.year1CapRate = String(year1CapRate);
      }

      const updated = await storage.updateModelingProject(projectId, updates, orgId);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to save deal pricing:', error);
      res.status(500).json({ error: error.message || 'Failed to save deal pricing' });
    }
  });

  // Project Workspace - Period Adjustments (Analytics & Normalization)
  app.get('/api/modeling/projects/:projectId/period-adjustments', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { periodLabel } = req.query;

      const adjustments = await storage.getModelingPeriodAdjustments(projectId, orgId, periodLabel as string);
      res.json(adjustments);
    } catch (error: any) {
      console.error('Failed to fetch period adjustments:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch period adjustments' });
    }
  });

  app.post('/api/modeling/projects/:projectId/period-adjustments', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const {
        periodLabel,
        scope,
        targetIdentifier,
        targetLabel,
        adjustmentType,
        adjustmentValue,
        originalValue,
        adjustedValue,
        reason,
        isActive = true
      } = req.body;

      const adjustment = await storage.createModelingPeriodAdjustment({
        id: crypto.randomUUID(),
        orgId,
        modelingProjectId: projectId,
        periodLabel,
        scope,
        targetIdentifier,
        targetLabel,
        adjustmentType,
        adjustmentValue: String(adjustmentValue),
        originalValue: originalValue ? String(originalValue) : null,
        adjustedValue: adjustedValue ? String(adjustedValue) : null,
        reason,
        isActive,
        createdBy: userId,
      });

      res.json(adjustment);
    } catch (error: any) {
      console.error('Failed to create period adjustment:', error);
      res.status(500).json({ error: error.message || 'Failed to create period adjustment' });
    }
  });

  app.patch('/api/modeling/projects/:projectId/period-adjustments/:adjustmentId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, adjustmentId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const adjustment = await storage.getModelingPeriodAdjustment(adjustmentId, orgId);
      if (!adjustment) {
        return res.status(404).json({ error: 'Adjustment not found' });
      }

      const {
        adjustmentType,
        adjustmentValue,
        originalValue,
        adjustedValue,
        reason,
        isActive
      } = req.body;

      const updates: any = { updatedBy: userId };
      if (adjustmentType !== undefined) updates.adjustmentType = adjustmentType;
      if (adjustmentValue !== undefined) updates.adjustmentValue = String(adjustmentValue);
      if (originalValue !== undefined) updates.originalValue = String(originalValue);
      if (adjustedValue !== undefined) updates.adjustedValue = String(adjustedValue);
      if (reason !== undefined) updates.reason = reason;
      if (isActive !== undefined) updates.isActive = isActive;

      const updated = await storage.updateModelingPeriodAdjustment(adjustmentId, updates, orgId);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to update period adjustment:', error);
      res.status(500).json({ error: error.message || 'Failed to update period adjustment' });
    }
  });

  app.delete('/api/modeling/projects/:projectId/period-adjustments/:adjustmentId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, adjustmentId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const deleted = await storage.deleteModelingPeriodAdjustment(adjustmentId, orgId);
      if (!deleted) {
        return res.status(404).json({ error: 'Adjustment not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete period adjustment:', error);
      res.status(500).json({ error: error.message || 'Failed to delete period adjustment' });
    }
  });

  // Project Workspace - Assumptions
  app.get('/api/modeling/projects/:projectId/assumptions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const assumptions = (project.customMetrics as any)?.assumptions || null;
      res.json(assumptions);
    } catch (error: any) {
      console.error('Failed to fetch project assumptions:', error);
      res.status(500).json({ error: 'Failed to fetch project assumptions' });
    }
  });

  app.post('/api/modeling/projects/:projectId/assumptions', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const existingMetrics = (project.customMetrics as any) || {};
      const updatedMetrics = {
        ...existingMetrics,
        assumptions: req.body
      };
      
      const updated = await storage.updateModelingProject(
        projectId,
        { customMetrics: updatedMetrics, updatedBy: userId },
        orgId
      );
      
      res.json(req.body);
    } catch (error: any) {
      console.error('Failed to save project assumptions:', error);
      res.status(500).json({ error: 'Failed to save project assumptions' });
    }
  });

  // Project Workspace - Multi-Year Historical P&L
  app.get('/api/modeling/projects/:projectId/historical-pl', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { proFormaEngineService } = await import('../services/pro-forma-engine-service');
      const multiYearData = await proFormaEngineService.getMultiYearHistoricalPL(projectId, orgId);
      res.json(multiYearData);
    } catch (error: any) {
      console.error('Failed to fetch multi-year historical P&L:', error);
      res.status(500).json({ error: 'Failed to fetch multi-year historical P&L' });
    }
  });

  // Project Workspace - Historical P&L with data binding (single year)
  app.get('/api/modeling/projects/:projectId/historical-pl/:year', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, year } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { proFormaEngineService } = await import('../services/pro-forma-engine-service');
      const historicalData = await proFormaEngineService.getHistoricalPL(
        projectId, 
        orgId, 
        year ? parseInt(year) : undefined
      );
      res.json(historicalData);
    } catch (error: any) {
      console.error('Failed to fetch historical P&L:', error);
      res.status(500).json({ error: 'Failed to fetch historical P&L' });
    }
  });

  // Project Workspace - Pro Forma with real-time calculations
  app.get('/api/modeling/projects/:projectId/pro-forma', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const scenarioType = (req.query.scenario as string) || 'base';
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { proFormaEngineService } = await import('../services/pro-forma-engine-service');
      const proFormaData = await proFormaEngineService.generateProForma(projectId, orgId, scenarioType);
      res.json(proFormaData);
    } catch (error: any) {
      console.error('Failed to fetch pro forma:', error);
      res.status(500).json({ error: 'Failed to fetch pro forma' });
    }
  });

  app.get('/api/modeling/projects/:projectId/scenario-comparison', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { proFormaEngineService } = await import('../services/pro-forma-engine-service');

      const scenarioTypes = ['base', 'aggressive', 'conservative'];
      const scenarioLabels: Record<string, { name: string; description: string }> = {
        base: { name: 'Base Case', description: 'Conservative assumptions based on historical performance' },
        aggressive: { name: 'Upside Case', description: 'Optimistic scenario with value-add initiatives' },
        conservative: { name: 'Downside Case', description: 'Stress test with adverse market conditions' },
      };

      const proFormaResults = await Promise.all(
        scenarioTypes.map(async (st) => {
          try {
            const pf = await proFormaEngineService.generateProForma(projectId, orgId, st);
            return { scenarioType: st, data: pf, error: null };
          } catch (err: any) {
            return { scenarioType: st, data: null, error: err.message };
          }
        })
      );

      const safe = (v: number) => (isFinite(v) ? v : 0);

      const scenarios = proFormaResults
        .filter(r => r.data)
        .map(r => {
          const pf = r.data!;
          const m = pf.metrics;
          const noiMargin = (pf.revenue.totals?.[0] ?? 0) > 0
            ? (safe(pf.noi?.[0] ?? 0) / pf.revenue.totals[0]) * 100
            : 0;

          const revenueBreakdown = pf.revenue.lineItems.map(li => ({
            name: li.name || li.subcategory || li.department || 'Other',
            value: li.projections?.[0] ?? li.baseAmount ?? 0,
          })).filter(r => r.value > 0);

          const irr = safe(m.irr);
          const eqMult = safe(m.equityMultiple);
          const exitVal = safe(m.exitValue);
          const purchasePrice = safe(m.purchasePrice);

          const risks: Array<{ id: string; severity: 'low' | 'medium' | 'high'; message: string }> = [];
          if (irr < 10) risks.push({ id: 'low_irr', severity: 'high', message: `IRR of ${irr.toFixed(1)}% is below 10% threshold` });
          else if (irr < 15) risks.push({ id: 'moderate_irr', severity: 'medium', message: `IRR of ${irr.toFixed(1)}% is below 15% target` });
          if (noiMargin < 30) risks.push({ id: 'thin_margin', severity: 'high', message: `NOI margin of ${noiMargin.toFixed(1)}% is below 30%` });
          else if (noiMargin < 40) risks.push({ id: 'moderate_margin', severity: 'medium', message: `NOI margin of ${noiMargin.toFixed(1)}% is below 40%` });
          if (eqMult < 1.5) risks.push({ id: 'low_equity', severity: 'high', message: `Equity multiple of ${eqMult.toFixed(2)}x is below 1.5x` });
          if (m.minDscr !== undefined && isFinite(m.minDscr) && m.minDscr < 1.2) risks.push({ id: 'low_dscr', severity: 'high', message: `Min DSCR of ${m.minDscr.toFixed(2)}x is below 1.2x` });
          if (exitVal < purchasePrice && purchasePrice > 0) risks.push({ id: 'value_loss', severity: 'high', message: 'Exit value is below purchase price' });

          const label = scenarioLabels[r.scenarioType] || { name: r.scenarioType, description: '' };

          return {
            id: r.scenarioType,
            name: label.name,
            description: label.description,
            color: r.scenarioType === 'base' ? '#3b82f6' : r.scenarioType === 'aggressive' ? '#10b981' : '#ef4444',
            metrics: {
              purchasePrice: purchasePrice,
              noi: safe(m.year1Noi),
              stabilizedNoi: safe(m.stabilizedNoi),
              capRate: safe(m.goingInCapRate),
              exitCapRate: safe(m.exitCapRate),
              irr,
              unleveredIrr: safe(m.unleveredIrr),
              equityMultiple: eqMult,
              cashOnCash: purchasePrice > 0 ? safe((pf.leveredCashFlow?.[0] ?? 0) / purchasePrice) * 100 : 0,
              exitValue: exitVal,
              totalRevenue: pf.revenue.totals?.[0] ?? 0,
              totalExpenses: pf.expenses.totals?.[0] ?? 0,
              noiMargin: safe(noiMargin),
              totalReturn: safe(m.totalReturn),
              minDscr: m.minDscr !== undefined ? safe(m.minDscr) : undefined,
              avgDscr: m.avgDscr !== undefined ? safe(m.avgDscr) : undefined,
            },
            assumptions: {
              revenueGrowth: m.revenueGrowthRate,
              expenseGrowth: m.expenseGrowthRate,
              exitCapRate: m.exitCapRate,
            },
            yearlyData: (pf.annualProjections || []).map(ap => ({
              year: (ap.yearIndex ?? 0) + 1,
              label: ap.label || `Year ${(ap.yearIndex ?? 0) + 1}`,
              revenue: safe(ap.revenue),
              expenses: safe(ap.expenses),
              noi: safe(ap.noi),
              cashFlow: safe(ap.leveredCashFlow),
              debtService: safe(ap.debtService),
            })),
            revenueBreakdown,
            risks,
          };
        });

      const baseMetrics = scenarios.find(s => s.id === 'base')?.metrics;
      const metricDefs = [
        { id: 'purchasePrice', name: 'Purchase Price', unit: 'currency' },
        { id: 'noi', name: 'Year 1 NOI', unit: 'currency' },
        { id: 'capRate', name: 'Going-In Cap Rate', unit: 'percent' },
        { id: 'irr', name: 'Levered IRR', unit: 'percent' },
        { id: 'equityMultiple', name: 'Equity Multiple', unit: 'multiple' },
        { id: 'exitValue', name: 'Exit Value', unit: 'currency' },
        { id: 'noiMargin', name: 'NOI Margin', unit: 'percent' },
        { id: 'totalReturn', name: 'Total Return', unit: 'currency' },
      ];

      const comparisonMetrics = metricDefs.map(md => ({
        id: md.id,
        name: md.name,
        unit: md.unit,
        metric: md.name,
        scenarios: scenarios.map(s => {
          const val = (s.metrics as any)[md.id] ?? 0;
          const baseVal = baseMetrics ? (baseMetrics as any)[md.id] ?? 0 : val;
          return {
            id: s.id,
            value: val,
            variance: baseVal !== 0 && s.id !== 'base' ? ((val - baseVal) / Math.abs(baseVal)) * 100 : 0,
          };
        }),
      }));

      res.json({ projectId, scenarios, comparisonMetrics });
    } catch (error: any) {
      console.error('Failed to generate scenario comparison:', error);
      res.status(500).json({ error: 'Failed to generate scenario comparison' });
    }
  });

  // Project Workspace - Executive Summary with real-time calculations
  app.get('/api/modeling/projects/:projectId/executive-summary/:scenario', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenario } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { proFormaEngineService } = await import('../services/pro-forma-engine-service');
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, scenario);
      
      const summaryData = {
        scenario,
        projectName: project.marinaName || project.name,
        purchasePrice: proForma.metrics.purchasePrice,
        totalUnits: project.totalUnits,
        acreage: project.acreage,
        leveredIRR: proForma.metrics.irr,
        unleveredIRR: proForma.metrics.unleveredIrr,
        equityMultiple: proForma.metrics.equityMultiple,
        unleveredEquityMultiple: proForma.metrics.unleveredEquityMultiple,
        metrics: {
          goingInCapRate: proForma.metrics.goingInCapRate,
          exitCapRate: proForma.metrics.exitCapRate,
          irr: proForma.metrics.irr,
          equityMultiple: proForma.metrics.equityMultiple,
          totalReturn: proForma.metrics.totalReturn
        },
        yearOne: {
          revenue: proForma.revenue.totals[0],
          expenses: proForma.expenses.totals[0],
          noi: proForma.noi[0]
        },
        exitYear: {
          revenue: proForma.revenue.totals[proForma.revenue.totals.length - 1],
          expenses: proForma.expenses.totals[proForma.expenses.totals.length - 1],
          noi: proForma.noi[proForma.noi.length - 1],
          exitValue: proForma.metrics.exitValue
        },
        growthRates: {
          revenue: proForma.metrics.revenueGrowthRate,
          expenses: proForma.metrics.expenseGrowthRate
        },
        projectionYears: proForma.years,
        noiByyear: proForma.noi
      };
      
      res.json(summaryData);
    } catch (error: any) {
      console.error('Failed to fetch executive summary:', error);
      res.status(500).json({ error: 'Failed to fetch executive summary' });
    }
  });

  // ============================================================================
  // CAPITAL STACK: Pro Forma-Fed Projections (Single Source of Truth)
  // ============================================================================
  app.post('/api/capital-stack/:capitalStackId/projections/from-pro-forma', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { capitalStackId } = req.params;
      const { projectId, scenario = 'base' } = req.body;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });
      
      const { proFormaEngineService } = await import('../services/pro-forma-engine-service');
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, scenario);
      
      const proFormaData = {
        noi: proForma.noi,
        revenue: proForma.revenue.totals,
        expenses: proForma.expenses.totals,
        capex: proForma.capex,
        leveredCashFlow: proForma.leveredCashFlow,
        cashFlowBeforeDebtService: proForma.cashFlowBeforeDebtService,
        managementFee: proForma.managementFee,
        reserves: proForma.reserves,
        holdPeriod: proForma.holdPeriod,
        purchasePrice: proForma.metrics.purchasePrice,
        exitValue: proForma.metrics.exitValue,
      };
      
      const { capitalStackService } = await import('../services/capital-stack-service');
      const projections = await capitalStackService.generateProjectionsFromProForma(orgId, capitalStackId, proFormaData);
      
      res.json({
        projections,
        source: 'pro_forma',
        scenario,
        proFormaMetrics: {
          irr: proForma.metrics.irr,
          unleveredIrr: proForma.metrics.unleveredIrr,
          equityMultiple: proForma.metrics.equityMultiple,
          exitValue: proForma.metrics.exitValue,
          goingInCapRate: proForma.metrics.goingInCapRate,
        }
      });
    } catch (error: any) {
      console.error('Failed Pro Forma-fed projections:', error);
      res.status(500).json({ error: error.message || 'Failed to generate projections' });
    }
  });

  // ============================================================================
  // DEAL PRICING: Pro Forma-Fed Price Solving (Single Source of Truth)
  // ============================================================================
  app.post('/api/deal-pricing/solve-from-pro-forma', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenario = 'base', targetMetric, targetValue } = req.body;
      if (!projectId || !targetMetric || targetValue === undefined) {
        return res.status(400).json({ error: 'projectId, targetMetric, and targetValue are required' });
      }
      
      const { proFormaEngineService } = await import('../services/pro-forma-engine-service');
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, scenario);
      const m = proForma.metrics;
      
      const { dealPricingService } = await import('../services/deal-pricing-service');
      let result: any;
      
      if (targetMetric === 'irr') {
        const proFormaCashFlows = {
          noiProjections: proForma.noi,
          leveredCashFlows: proForma.leveredCashFlow,
          loanProceeds: m.debtSchedule?.totalDebtAtClose || 0,
          loanPayoffAtExit: m.loanPayoff || 0,
          sellingFeePct: m.sellingFees && m.exitValue ? m.sellingFees / m.exitValue : 0.02,
          workingCapitalAmount: m.workingCapitalRecovery || 0,
          workingCapitalRecoveryPct: 1.0,
          year1NOI: proForma.noi[0] || 0,
          baseRevenue: proForma.revenue.totals[0] || 0,
          baseExpenses: proForma.expenses.totals[0] || 0,
          holdPeriod: proForma.holdPeriod,
        };
        result = dealPricingService.solveForPriceFromProForma(proFormaCashFlows, targetValue / 100, m.exitValue);
      } else if (targetMetric === 'cap_rate') {
        result = {
          purchasePrice: dealPricingService.solveForPriceFromCapRate(proForma.noi[0] || 0, targetValue),
          metricType: 'cap_rate',
          year1CapRate: targetValue,
        };
      }
      
      res.json({
        ...result,
        source: 'pro_forma',
        proFormaMetrics: {
          irr: m.irr, unleveredIrr: m.unleveredIrr,
          equityMultiple: m.equityMultiple, exitValue: m.exitValue,
          year1Noi: m.year1Noi, noiByYear: proForma.noi,
        }
      });
    } catch (error: any) {
      console.error('Failed Pro Forma-fed pricing:', error);
      res.status(500).json({ error: error.message || 'Failed to solve pricing' });
    }
  });

  // ============================================================================
  // [REPLACED] // MONTE CARLO SIMULATION - Stochastic Analysis Engine
  // ============================================================================

  // Get persisted Monte Carlo results and config (does NOT auto-run)
  /* === OLD ROUTE (replaced by dcf-routes.ts) === GET /monte-carlo
  app.get('/api/modeling/projects/:projectId/monte-carlo', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const customMetrics = (project.customMetrics as any) || {};
      const savedResults = customMetrics.monteCarloResults || null;
      const savedConfig = customMetrics.monteCarloConfig || null;

      if (!savedResults) {
        const { monteCarloService } = await import('../services/monte-carlo-service');
        const baseFinancials = await (await import('../services/deal-pricing-service')).dealPricingService.getProjectFinancials(projectId, orgId);
        const dealPricingInputs = customMetrics.dealPricing || {};
        const purchasePrice = dealPricingInputs.purchasePrice || (baseFinancials.purchasePrice ? Number(baseFinancials.purchasePrice) : 5000000);
        const year1NOI = baseFinancials.year1NOI || 500000;
        const defaultVariables = monteCarloService.buildDefaultVariables(purchasePrice, year1NOI, dealPricingInputs);
        return res.json({ hasResults: false, config: savedConfig, defaultVariables });
      }

      res.json({ hasResults: true, ...savedResults, config: savedConfig });
    } catch (error: any) {
      console.error('Failed to get Monte Carlo data:', error);
      res.status(500).json({ error: 'Failed to get Monte Carlo data' });
    }
  });
  === END OLD ROUTE === */

  // Run Monte Carlo simulation and persist results
  /* === OLD ROUTE (replaced by dcf-routes.ts) === POST /monte-carlo/run
  app.post('/api/modeling/projects/:projectId/monte-carlo/run', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { variables, iterations = 10000, confidenceLevel = 0.95 } = req.body;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { monteCarloService } = await import('../services/monte-carlo-service');
      const simulationInput: { iterations: number; confidenceLevel: number; variables?: any } = {
        iterations,
        confidenceLevel,
      };
      if (variables) {
        simulationInput.variables = variables;
      }

      const analysis = await monteCarloService.runSimulation(projectId, orgId, simulationInput);

      const resultsToSave = {
        ...analysis,
        results: {
          irr: { ...analysis.results.irr, values: [] },
          npv: { ...analysis.results.npv, values: [] },
          equityMultiple: { ...analysis.results.equityMultiple, values: [] },
          cashOnCash: { ...analysis.results.cashOnCash, values: [] },
        },
      };

      const customMetrics = { ...((project.customMetrics as any) || {}) };
      customMetrics.monteCarloResults = resultsToSave;
      customMetrics.monteCarloConfig = {
        variables: analysis.variables,
        iterations,
        confidenceLevel,
        updatedAt: new Date().toISOString(),
      };

      await storage.updateModelingProject(projectId, { customMetrics, updatedBy: userId }, orgId);

      res.json(analysis);
    } catch (error: any) {
      console.error('Failed to run Monte Carlo simulation:', error);
      res.status(500).json({ error: 'Failed to run Monte Carlo simulation' });
    }
  });
  === END OLD ROUTE === */

  // Save Monte Carlo configuration (variable distributions)
  /* === OLD ROUTE (replaced by dcf-routes.ts) === POST /monte-carlo/config
  app.post('/api/modeling/projects/:projectId/monte-carlo/config', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { variables, iterations, confidenceLevel } = req.body;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const customMetrics = { ...((project.customMetrics as any) || {}) };
      customMetrics.monteCarloConfig = {
        variables,
        iterations: iterations || 10000,
        confidenceLevel: confidenceLevel || 0.95,
        updatedAt: new Date().toISOString(),
      };

      await storage.updateModelingProject(projectId, { customMetrics, updatedBy: userId }, orgId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to save Monte Carlo config:', error);
      res.status(500).json({ error: 'Failed to save Monte Carlo config' });
    }
  });
  === END OLD ROUTE === */

  // Quick simulation for real-time feedback
  /* === OLD ROUTE (replaced by dcf-routes.ts) === GET /monte-carlo/quick
  app.get('/api/modeling/projects/:projectId/monte-carlo/quick', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { monteCarloService } = await import('../services/monte-carlo-service');
      const quickResult = await monteCarloService.quickSimulation(projectId, orgId);
      res.json(quickResult);
    } catch (error: any) {
      console.error('Failed to run quick Monte Carlo:', error);
      res.status(500).json({ error: 'Failed to run quick Monte Carlo' });
    }
  });
  === END OLD ROUTE === */

  // ============================================================================
  // [REPLACED] // DCF CALCULATOR - Real-Time Discounted Cash Flow Analysis
  // ============================================================================

  // Perform full DCF analysis with multiple scenarios
  /* === OLD ROUTE (replaced by dcf-routes.ts) === GET /dcf
  app.get('/api/modeling/projects/:projectId/dcf', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { dcfCalculatorService } = await import('../services/dcf-calculator-service');
      const analysis = await dcfCalculatorService.performDCFAnalysis(projectId, orgId);
      res.json(analysis);
    } catch (error: any) {
      console.error('Failed to perform DCF analysis:', error);
      res.status(500).json({ error: 'Failed to perform DCF analysis' });
    }
  });
  === END OLD ROUTE === */

  // Calculate DCF with custom scenarios
  /* === OLD ROUTE (replaced by dcf-routes.ts) === POST /dcf/calculate
  app.post('/api/modeling/projects/:projectId/dcf/calculate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarios } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { dcfCalculatorService } = await import('../services/dcf-calculator-service');
      const analysis = await dcfCalculatorService.performDCFAnalysis(projectId, orgId, scenarios);
      res.json(analysis);
    } catch (error: any) {
      console.error('Failed to calculate custom DCF:', error);
      res.status(500).json({ error: 'Failed to calculate custom DCF' });
    }
  });
  === END OLD ROUTE === */

  // Quick IRR calculation for real-time updates (returns full metrics)
  /* === OLD ROUTE (replaced by dcf-routes.ts) === POST /dcf/quick-irr
  app.post('/api/dcf/quick-irr', authenticateUser, async (req: any, res) => {
    try {
      const { input } = req.body;
      
      const { dcfCalculatorService } = await import('../services/dcf-calculator-service');
      const result = dcfCalculatorService.quickCalculate(input);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to calculate quick IRR:', error);
      res.status(500).json({ error: 'Failed to calculate quick IRR' });
    }
  });
  === END OLD ROUTE === */

  // Quick NPV calculation for real-time updates
  /* === OLD ROUTE (replaced by dcf-routes.ts) === POST /dcf/quick-npv
  app.post('/api/dcf/quick-npv', authenticateUser, async (req: any, res) => {
    try {
      const { input } = req.body;
      
      const { dcfCalculatorService } = await import('../services/dcf-calculator-service');
      const npv = dcfCalculatorService.quickNPV(input);
      res.json({ npv });
    } catch (error: any) {
      console.error('Failed to calculate quick NPV:', error);
      res.status(500).json({ error: 'Failed to calculate quick NPV' });
    }
  });
  === END OLD ROUTE === */

  // Generate sensitivity matrix
  /* === OLD ROUTE (replaced by dcf-routes.ts) === POST /dcf/sensitivity
  app.post('/api/dcf/sensitivity', authenticateUser, async (req: any, res) => {
    try {
      const { baseInput, var1Config, var2Config, metric } = req.body;
      
      const { dcfCalculatorService } = await import('../services/dcf-calculator-service');
      const matrix = dcfCalculatorService.generateSensitivityMatrix(
        baseInput,
        var1Config,
        var2Config,
        metric
      );
      res.json(matrix);
    } catch (error: any) {
      console.error('Failed to generate sensitivity matrix:', error);
      res.status(500).json({ error: 'Failed to generate sensitivity matrix' });
    }
  });
  === END OLD ROUTE === */

  // ============================================================================
  // MARINA PROFIT CENTER MODULE - Multi-Revenue Stream Financial Modeling
  // ============================================================================

  // Get comprehensive marina profit center analysis
  app.get('/api/modeling/projects/:projectId/profit-centers', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { marinaProfitCenterService } = await import('../services/marina-profit-center-service');
      const financialModel = await marinaProfitCenterService.calculateMarinaFinancials(projectId, orgId);
      res.json(financialModel);
    } catch (error: any) {
      console.error('Failed to calculate profit centers:', error);
      res.status(500).json({ error: 'Failed to calculate profit centers' });
    }
  });

  // Get profit center breakdown for a specific year
  app.get('/api/modeling/projects/:projectId/profit-centers/breakdown', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { marinaProfitCenterService } = await import('../services/marina-profit-center-service');
      const breakdown = await marinaProfitCenterService.getProfitCenterBreakdown(projectId, orgId, year);
      res.json(breakdown);
    } catch (error: any) {
      console.error('Failed to get profit center breakdown:', error);
      res.status(500).json({ error: 'Failed to get profit center breakdown' });
    }
  });

  // Calculate with custom assumptions
  app.post('/api/modeling/projects/:projectId/profit-centers/calculate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { assumptions } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { marinaProfitCenterService } = await import('../services/marina-profit-center-service');
      const financialModel = await marinaProfitCenterService.calculateMarinaFinancials(projectId, orgId, assumptions);
      res.json(financialModel);
    } catch (error: any) {
      console.error('Failed to calculate custom profit centers:', error);
      res.status(500).json({ error: 'Failed to calculate custom profit centers' });
    }
  });

  // ============================================================================
  // LEASE CASH FLOW ENGINE - Argus-Style Lease-by-Lease DCF
  // ============================================================================

  // Get full lease-by-lease cash flow analysis
  app.get('/api/modeling/projects/:projectId/lease-cashflow', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const scenarioType = (req.query.scenario as string) || 'base';
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { leaseCashFlowEngine } = await import('../services/lease-cashflow-engine');
      const cashFlowData = await leaseCashFlowEngine.calculatePropertyCashFlow(
        projectId, 
        orgId, 
        scenarioType
      );
      res.json(cashFlowData);
    } catch (error: any) {
      console.error('Failed to calculate lease cash flow:', error);
      res.status(500).json({ error: 'Failed to calculate lease cash flow' });
    }
  });

  // Get rollover schedule (lease expirations by year)
  app.get('/api/modeling/projects/:projectId/rollover-schedule', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { leaseCashFlowEngine } = await import('../services/lease-cashflow-engine');
      const rolloverData = await leaseCashFlowEngine.getRolloverSchedule(projectId, orgId);
      res.json(rolloverData);
    } catch (error: any) {
      console.error('Failed to get rollover schedule:', error);
      res.status(500).json({ error: 'Failed to get rollover schedule' });
    }
  });

  // Get tenant performance metrics
  app.get('/api/modeling/projects/:projectId/tenant-performance', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { leaseCashFlowEngine } = await import('../services/lease-cashflow-engine');
      const tenantData = await leaseCashFlowEngine.getTenantPerformance(projectId, orgId);
      res.json(tenantData);
    } catch (error: any) {
      console.error('Failed to get tenant performance:', error);
      res.status(500).json({ error: 'Failed to get tenant performance' });
    }
  });

  // Calculate custom scenario with overridden assumptions
  app.post('/api/modeling/projects/:projectId/lease-cashflow/calculate', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioType, assumptions } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const { leaseCashFlowEngine } = await import('../services/lease-cashflow-engine');
      const cashFlowData = await leaseCashFlowEngine.calculatePropertyCashFlow(
        projectId, 
        orgId, 
        scenarioType || 'base',
        assumptions
      );
      res.json(cashFlowData);
    } catch (error: any) {
      console.error('Failed to calculate custom scenario:', error);
      res.status(500).json({ error: 'Failed to calculate custom scenario' });
    }
  });

  // ============================================================================
  // OPERATIONS DATA SYNC - Sync Rent Roll, Fuel Sales, Ship Store to Modeling
  // ============================================================================

  // Trigger operations data sync for a modeling project
  app.post('/api/modeling/projects/:projectId/sync-operations', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { dataSources, dateRangeStart, dateRangeEnd, syncType } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('../services/operations-data-sync-service');
      
      const result = await operationsDataSyncService.syncOperationsData({
        projectId,
        orgId,
        userId,
        dataSources: dataSources || ['rent_roll', 'fuel_sales', 'ship_store'],
        dateRangeStart: dateRangeStart ? new Date(dateRangeStart) : undefined,
        dateRangeEnd: dateRangeEnd ? new Date(dateRangeEnd) : undefined,
        syncType: syncType || 'manual'
      });

      res.json(result);
    } catch (error: any) {
      console.error('Failed to sync operations data:', error);
      res.status(500).json({ error: 'Failed to sync operations data' });
    }
  });

  // Get actuals data for a modeling project
  app.get('/api/modeling/projects/:projectId/actuals', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { year } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('../services/operations-data-sync-service');
      
      const actuals = await operationsDataSyncService.getActualsForProject(
        projectId, 
        year ? parseInt(year as string) : undefined
      );

      const { modelingPnlOverrides } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const overrides = await db.select()
        .from(modelingPnlOverrides)
        .where(and(eq(modelingPnlOverrides.projectId, projectId), eq(modelingPnlOverrides.orgId, orgId)));

      const excludeSet = new Set(
        overrides.filter(o => o.overrideType === 'exclude' && o.isActive).map(o => o.lineItemKey)
      );
      const deptOverrideMap: Record<string, string> = {};
      overrides.filter(o => o.overrideType === 'department' && o.isActive && o.overrideDepartment)
        .forEach(o => { deptOverrideMap[o.lineItemKey] = o.overrideDepartment!; });

      // Group by category and subcategory for P&L display
      const { inferDepartment } = await import('../utils/department-mapping');
      const grouped = actuals.reduce((acc: any, item) => {
        const subcategory = item.subcategory || '';
        if (excludeSet.has(subcategory)) return acc;

        const key = `${item.category}-${subcategory}`;
        if (!acc[key]) {
          const dept = deptOverrideMap[subcategory] || item.department || inferDepartment(subcategory, item.category);
          acc[key] = {
            category: item.category,
            subcategory,
            department: dept,
            monthlyData: {},
            annualTotal: 0
          };
        }
        const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const monthKey = MONTH_KEYS[(item.month - 1) % 12];
        const amount = parseFloat(item.amount);
        acc[key].monthlyData[monthKey] = (acc[key].monthlyData[monthKey] || 0) + amount;
        acc[key].annualTotal += amount;
        return acc;
      }, {});
      res.json({
        raw: actuals,
        grouped: Object.values(grouped),
        year: year ? parseInt(year as string) : undefined
      });

    } catch (error: any) {
      console.error('Failed to fetch actuals:', error);
      res.status(500).json({ error: 'Failed to fetch actuals' });
    }
  });

  // ─── Manual Actuals CRUD (ad-hoc line items in Pro Forma) ──────────────

  // Create a manual actuals line item (spread evenly across 12 months)
  app.post('/api/modeling/projects/:projectId/actuals/manual', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { category, subcategory, department, annualAmount, year } = req.body;

      if (!category || !subcategory || annualAmount === undefined || !year) {
        return res.status(400).json({ error: 'category, subcategory, annualAmount, and year are required' });
      }

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const monthlyAmount = (parseFloat(annualAmount) / 12).toFixed(2);
      const { inferDepartment } = await import('../utils/department-mapping');
      const dept = department || inferDepartment(subcategory, category);
      const lineDesc = `${dept}: ${subcategory}`;
      const inserted: string[] = [];

      for (let month = 1; month <= 12; month++) {
        const result = await pool.query(`
          INSERT INTO modeling_actuals
            (id, org_id, modeling_project_id, year, month, category, subcategory, department,
             line_item_description, amount, data_source, source_record_type, created_at, updated_at, synced_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual_entry', 'ad_hoc', NOW(), NOW(), NOW())
          ON CONFLICT (modeling_project_id, year, month, category, subcategory, line_item_description)
          DO UPDATE SET amount = EXCLUDED.amount, department = EXCLUDED.department, updated_at = NOW()
          RETURNING id
        `, [orgId, projectId, year, month, category, subcategory, dept, lineDesc, monthlyAmount]);
        if (result.rows[0]) inserted.push(result.rows[0].id);
      }

      res.json({ success: true, inserted: inserted.length, subcategory, category, department: dept, year });
    } catch (error: any) {
      console.error('Failed to create manual actuals:', error);
      res.status(500).json({ error: 'Failed to create manual line item' });
    }
  });

  // Update a manual actuals line item amount (updates all 12 months)
  app.put('/api/modeling/projects/:projectId/actuals/manual', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { category, subcategory, annualAmount, year, monthlyAmounts } = req.body;

      if (!category || !subcategory || !year) {
        return res.status(400).json({ error: 'category, subcategory, and year are required' });
      }

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      if (monthlyAmounts && typeof monthlyAmounts === 'object') {
        // Update individual months
        for (const [monthStr, amount] of Object.entries(monthlyAmounts)) {
          const month = parseInt(monthStr, 10);
          if (month < 1 || month > 12) continue;
          await pool.query(`
            UPDATE modeling_actuals SET amount = $1, updated_at = NOW()
            WHERE modeling_project_id = $2 AND org_id = $3
              AND year = $4 AND month = $5
              AND category = $6 AND subcategory = $7
              AND data_source = 'manual_entry'
          `, [parseFloat(amount as string).toFixed(2), projectId, orgId, year, month, category, subcategory]);
        }
      } else if (annualAmount !== undefined) {
        // Spread annual amount evenly across 12 months
        const monthlyAmount = (parseFloat(annualAmount) / 12).toFixed(2);
        await pool.query(`
          UPDATE modeling_actuals SET amount = $1, updated_at = NOW()
          WHERE modeling_project_id = $2 AND org_id = $3
            AND year = $4 AND category = $5 AND subcategory = $6
            AND data_source = 'manual_entry'
        `, [monthlyAmount, projectId, orgId, year, category, subcategory]);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to update manual actuals:', error);
      res.status(500).json({ error: 'Failed to update manual line item' });
    }
  });

  // Delete a manual actuals line item (all 12 months)
  app.delete('/api/modeling/projects/:projectId/actuals/manual', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { category, subcategory, year } = req.body;

      if (!category || !subcategory || !year) {
        return res.status(400).json({ error: 'category, subcategory, and year are required' });
      }

      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const result = await pool.query(`
        DELETE FROM modeling_actuals
        WHERE modeling_project_id = $1 AND org_id = $2
          AND year = $3 AND category = $4 AND subcategory = $5
          AND data_source = 'manual_entry'
      `, [projectId, orgId, year, category, subcategory]);

      res.json({ success: true, deleted: result.rowCount });
    } catch (error: any) {
      console.error('Failed to delete manual actuals:', error);
      res.status(500).json({ error: 'Failed to delete manual line item' });
    }
  });

  // Get available years for actuals data
  app.get('/api/modeling/projects/:projectId/actuals/years', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('../services/operations-data-sync-service');
      const years = await operationsDataSyncService.getAvailableYears(projectId);

      res.json({ years });
    } catch (error: any) {
      console.error('Failed to fetch available years:', error);
      res.status(500).json({ error: 'Failed to fetch available years' });
    }
  });

  // Get actuals for multiple years for comparison
  app.get('/api/modeling/projects/:projectId/actuals/multi-year', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { years } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('../services/operations-data-sync-service');
      const yearList = years ? String(years).split(',').map(Number) : [];
      const actualsData = await operationsDataSyncService.getActualsForMultipleYears(projectId, yearList);

      const { modelingPnlOverrides } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const overrides = await db.select()
        .from(modelingPnlOverrides)
        .where(and(eq(modelingPnlOverrides.projectId, projectId), eq(modelingPnlOverrides.orgId, orgId)));
      const excludeSet = new Set(
        overrides.filter(o => o.overrideType === 'exclude' && o.isActive).map(o => o.lineItemKey)
      );
      const deptOverrideMap: Record<string, string> = {};
      overrides.filter(o => o.overrideType === 'department' && o.isActive && o.overrideDepartment)
        .forEach(o => { deptOverrideMap[o.lineItemKey] = o.overrideDepartment!; });
      const categoryOverrideMap: Record<string, string> = {};
      overrides.filter(o => o.overrideType === 'department' && o.isActive && o.overrideCategory)
        .forEach(o => { categoryOverrideMap[o.lineItemKey] = o.overrideCategory!; });

      const { inferDepartment: inferDepartmentFn } = await import('../utils/department-mapping');
      // Group each year's data
      const groupedByYear: Record<number, any> = {};
      for (const [year, actuals] of Object.entries(actualsData)) {
        const grouped = (actuals as any[]).reduce((acc: any, item) => {
          const subcategory = item.subcategory || '';
          if (excludeSet.has(subcategory)) return acc;

          const effectiveCategory = categoryOverrideMap[subcategory] || item.category;
          const key = `${effectiveCategory}-${subcategory}`;
          if (!acc[key]) {
            const dept = deptOverrideMap[subcategory] || item.department || inferDepartmentFn(subcategory, effectiveCategory);
            acc[key] = {
              category: effectiveCategory,
              subcategory,
              department: dept,
              monthlyData: {},
              annualTotal: 0
            };
          }
          const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; const monthKey = MONTH_KEYS[(item.month - 1) % 12];
          const amount = parseFloat(item.amount);
          acc[key].monthlyData[monthKey] = (acc[key].monthlyData[monthKey] || 0) + amount;
          acc[key].annualTotal += amount;
          return acc;
        }, {});
        groupedByYear[Number(year)] = Object.values(grouped);
      }

      res.json({ byYear: groupedByYear, years: yearList });
    } catch (error: any) {
      console.error('Failed to fetch multi-year actuals:', error);
      res.status(500).json({ error: 'Failed to fetch multi-year actuals' });
    }
  });

  // Get sync job history for a project
  app.get('/api/modeling/projects/:projectId/sync-history', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('../services/operations-data-sync-service');
      const history = await operationsDataSyncService.getSyncJobHistory(projectId);

      res.json(history);
    } catch (error: any) {
      console.error('Failed to fetch sync history:', error);
      res.status(500).json({ error: 'Failed to fetch sync history' });
    }
  });

  // Get data source summary for a project
  app.get('/api/modeling/projects/:projectId/data-sources', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { operationsDataSyncService } = await import('../services/operations-data-sync-service');
      const summary = await operationsDataSyncService.getDataSourceSummary(projectId);

      res.json(summary);
    } catch (error: any) {
      console.error('Failed to fetch data sources:', error);
      res.status(500).json({ error: 'Failed to fetch data sources' });
    }
  });

  // ============================================================================
  // SCENARIO VERSIONING - Institutional-grade scenario management with history
  // ============================================================================

  // Get all current scenarios for a project
  app.get('/api/modeling/projects/:projectId/scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const scenarios = await scenarioVersioningService.getCurrentScenarios(projectId);

      res.json(scenarios);
    } catch (error: any) {
      console.error('Failed to fetch scenarios:', error);
      res.status(500).json({ error: 'Failed to fetch scenarios' });
    }
  });

  // Initialize default scenarios for a project
  app.post('/api/modeling/projects/:projectId/scenarios/init', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const scenarios = await scenarioVersioningService.initializeDefaultScenarios(projectId, orgId, userId);

      res.json(scenarios);
    } catch (error: any) {
      console.error('Failed to initialize scenarios:', error);
      res.status(500).json({ error: 'Failed to initialize scenarios' });
    }
  });

  // Create a new scenario
  app.post('/api/modeling/projects/:projectId/scenarios', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const { scenarioType, name, description, revenueGrowthRate, expenseGrowthRate, exitCapRate, assumptions } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.createScenario({
        orgId,
        projectId,
        userId,
        scenarioType,
        name,
        description,
        revenueGrowthRate,
        expenseGrowthRate,
        exitCapRate,
        assumptions
      });

      res.json(scenario);
    } catch (error: any) {
      console.error('Failed to create scenario:', error);
      res.status(500).json({ error: 'Failed to create scenario' });
    }
  });

  // Get a specific scenario by ID
  app.get('/api/modeling/projects/:projectId/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.getScenarioById(scenarioId);

      if (!scenario) {
        return res.status(404).json({ error: 'Scenario not found' });
      }

      res.json(scenario);
    } catch (error: any) {
      console.error('Failed to fetch scenario:', error);
      res.status(500).json({ error: 'Failed to fetch scenario' });
    }
  });

  // Update a scenario (optionally create new version)
  app.patch('/api/modeling/projects/:projectId/scenarios/:scenarioId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { name, description, revenueGrowthRate, expenseGrowthRate, exitCapRate, assumptions, createNewVersion } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.updateScenario({
        scenarioId,
        userId,
        name,
        description,
        revenueGrowthRate,
        expenseGrowthRate,
        exitCapRate,
        assumptions,
        createNewVersion
      });

      res.json(scenario);
    } catch (error: any) {
      console.error('Failed to update scenario:', error);
      res.status(500).json({ error: 'Failed to update scenario' });
    }
  });

  // Get version history for a scenario type
  app.get('/api/modeling/projects/:projectId/scenarios/:scenarioType/history', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId, scenarioType } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const history = await scenarioVersioningService.getScenarioVersionHistory(projectId, scenarioType as any, limit);

      res.json(history);
    } catch (error: any) {
      console.error('Failed to fetch scenario history:', error);
      res.status(500).json({ error: 'Failed to fetch scenario history' });
    }
  });

  // Restore a previous scenario version
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/restore', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const restored = await scenarioVersioningService.restoreVersion(scenarioId, userId);

      res.json(restored);
    } catch (error: any) {
      console.error('Failed to restore scenario:', error);
      res.status(500).json({ error: 'Failed to restore scenario' });
    }
  });

  // Submit scenario for approval
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/submit', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.submitForApproval(scenarioId, userId);

      res.json(scenario);
    } catch (error: any) {
      console.error('Failed to submit scenario:', error);
      res.status(500).json({ error: 'Failed to submit scenario' });
    }
  });

  // Approve a scenario
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/approve', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { notes } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.approveScenario(scenarioId, userId, notes);

      res.json(scenario);
    } catch (error: any) {
      console.error('Failed to approve scenario:', error);
      res.status(500).json({ error: 'Failed to approve scenario' });
    }
  });

  // Reject a scenario
  app.post('/api/modeling/projects/:projectId/scenarios/:scenarioId/reject', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId, scenarioId } = req.params;
      const { notes } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const scenario = await scenarioVersioningService.rejectScenario(scenarioId, userId, notes);

      res.json(scenario);
    } catch (error: any) {
      console.error('Failed to reject scenario:', error);
      res.status(500).json({ error: 'Failed to reject scenario' });
    }
  });

  // Get audit history for a project
  app.get('/api/modeling/projects/:projectId/audit', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { limit, entityType } = req.query;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const history = await scenarioVersioningService.getAuditHistory(projectId, {
        limit: limit ? parseInt(limit as string) : undefined,
        entityType: entityType as string
      });

      res.json(history);
    } catch (error: any) {
      console.error('Failed to fetch audit history:', error);
      res.status(500).json({ error: 'Failed to fetch audit history' });
    }
  });

  // Compare multiple scenarios
  app.post('/api/modeling/projects/:projectId/scenarios/compare', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const { scenarioIds } = req.body;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const comparison = await scenarioVersioningService.compareScenarios(projectId, scenarioIds);

      res.json(comparison);
    } catch (error: any) {
      console.error('Failed to compare scenarios:', error);
      res.status(500).json({ error: 'Failed to compare scenarios' });
    }
  });

  // Generate IC Memo for a project
  app.get('/api/modeling/projects/:projectId/ic-memo', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { projectId } = req.params;
      const format = (req.query.format as string) || 'json';
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { icMemoService } = await import('../services/ic-memo-service');
      const memoData = await icMemoService.generateMemoData(projectId, orgId, userId);

      if (format === 'text') {
        const memoText = icMemoService.formatMemoAsText(memoData);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="IC_Memo_${project.marinaName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Project'}_${new Date().toISOString().split('T')[0]}.txt"`);
        return res.send(memoText);
      }

      res.json(memoData);
    } catch (error: any) {
      console.error('Failed to generate IC memo:', error);
      res.status(500).json({ error: 'Failed to generate IC memo' });
    }
  });

  // Get audit trail for a project
  app.get('/api/modeling/projects/:projectId/audit-log', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { projectId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const entityType = req.query.entityType as string | undefined;
      
      const project = await storage.getModelingProject(projectId, orgId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const { scenarioVersioningService } = await import('../services/scenario-versioning-service');
      const auditLog = await scenarioVersioningService.getAuditHistory(projectId, { 
        limit, 
        entityType 
      });

      res.json(auditLog);
    } catch (error: any) {
      console.error('Failed to fetch audit log:', error);
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  });
}
