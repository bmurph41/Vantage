import { syncLoansToCapitalStack, clearDebtFromCapitalStack } from "./services/loan-to-capital-stack-sync";
import type { Express, Request, Response, NextFunction } from "express";
import { logger } from "./lib/logger";
import { createServer, type Server } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { storage } from "./storage";
import { db } from "./db";
import { eq, and, or, desc, asc, gte, lte, sql, gt, inArray, notInArray, ilike, isNull } from "drizzle-orm";
import { resolveRecipient } from "@shared/recipient-utils";
import { AIRiskAnalyzer } from "./ai-risk-analyzer";
import { AINotesEnhancer } from "./ai-notes-enhancer";
import { assigneeSubscriptionManager } from "./assignee-subscription-manager";
import { reconciliationService } from "./reconciliation-service";
import { CSVImportService } from "./csv-import-service";
import { DuplicateDetectionService } from "./duplicate-detection-service";
import { CompanyLinkingService } from "./company-linking-service";
import { CalendarService } from "./calendar-service";
import { FuelSyncService } from "./services/fuel/fuel-sync-service";
import { requireApprovalCheck } from "./services/fuel/fuel-route-utils";
import { findAllPotentialDuplicates, getDuplicateExplanation } from "./services/duplicate-finder";
import { findCompanyDuplicates, type CompanyDuplicateMatch } from "./services/company-duplicate-service";
import { requirePermission, requireRole } from "./middleware/rbac";
import { AuditService } from "./services/audit-service";
import { setTenantContext, clearTenantContext } from "./middleware/tenant-context";
import { enforceTenant, requireTenantMatch } from "./middleware/tenant-isolation";
import vdrRouter from "./vdr-routes";
import { accountingRouter } from "./routes/accounting-routes";
import { securityComplianceRouter } from "./routes/security-compliance-routes";
import { operationsEngineRouter } from "./routes/operations-engine-routes";
import { reportingEngineRouter } from "./routes/reporting-engine-routes";
import { integrationsEngineRouter } from "./routes/integrations-engine-routes";
import { workflowEnhancementsRouter } from "./routes/workflow-enhancements-routes";
import { crmEnhancementsRouter } from "./routes/crm-enhancements-routes";
import { lpPortalRouter } from "./routes/lp-portal-routes";
import { workflowAutomationRouter } from "./routes/workflow-automation-routes";
import { workflowEmailRouter } from "./routes/workflow-email-routes";
import { aiDealIntelligenceRouter } from "./routes/ai-deal-intelligence-routes";
import { investorPortalRouter } from "./routes/investor-portal-routes";
import { portfolioMarketRouter } from "./routes/portfolio-market-routes";
import { operationsManagementRouter } from "./routes/operations-management-routes";
import { capitalMarketsRouter } from "./routes/capital-markets-routes";
import { crmRelationshipIntelligenceRouter } from "./routes/crm-relationship-intelligence-routes";
import { reportingQuickWinsRouter } from "./routes/reporting-quickwins-routes";
import { crmPipelineEnhancementsRouter } from "./routes/crm-pipeline-enhancements-routes";
import { billingRouter } from "./routes/billing-routes";
import { supportRouter } from "./routes/support-routes";
import { infrastructureRouter } from "./routes/infrastructure-routes";
import { fundManagementRouter } from "./routes/fund-management-routes";
import { tenantConstructionRouter } from "./routes/tenant-construction-routes";
import { analyticsEnterpriseRouter } from "./routes/analytics-enterprise-routes";
import { complianceOnboardingRouter } from "./routes/compliance-onboarding-routes";
import { docusignRouter } from "./routes/docusign-routes";
import { publicRecordsRouter } from "./routes/public-records-routes";
import { predictiveAnalyticsRouter } from "./routes/predictive-analytics-routes";
import { apiV1Router } from "./routes/api-v1-routes";
import { googlePlacesRouter } from "./routes/google-places-routes";
import { authenticateApiKey } from "./middleware/api-key-auth";
import { cashFlowForecastingRouter } from "./routes/cash-flow-forecasting-routes";
import { aiUnderwritingRouter } from "./routes/ai-underwriting-routes";
import { dealSourcingRouter } from "./routes/deal-sourcing-routes";
import { meetingTranscriptionRouter } from "./routes/meeting-transcription-routes";
import { multiCurrencyRouter } from "./routes/multi-currency-routes";
import { masterCompsRouter } from "./routes/master-comps-routes";
import { ddFindingsRouter } from "./routes/dd-findings-routes";
import { modelingEnhancementsRouter } from "./routes/modeling-enhancements-routes";
import { onboardingRouter } from "./routes/onboarding-routes";
import { orgSettingsRouter } from "./routes/org-settings-routes";
import { integrationsMarketplaceRouter } from "./routes/integrations-marketplace-routes";
import { integrationsSyncRouter } from "./routes/integrations-sync-routes";
import { startPlatformCronJobs } from "./jobs/platform-cron";
import { evaluateAutomations } from "./services/workflow-engine";
import { vdrActivityRouter } from "./routes/vdr-activity-routes";
import { dealWorkspaceRouter } from "./routes/deal-workspace-routes";
import shipStoreRouter from "./ship-store-router";
import serviceRouter from "./service-router";
import boatRentalsRouter from "./boat-rentals-router";
import boatClubRouter from "./boat-club-router";
import boatSalesRouter from "./boat-sales-router";
import { payrollRouter } from "./routes/payroll-routes";
import { permissionsRouter } from "./routes/payroll-permissions-routes";
import { valuatorPayrollRouter } from "./routes/valuator-payroll-routes";
import { deptPnlRouter } from "./routes/dept-pnl-routes";
import integrationRouter from "./integration-routes";
import { integrationsRouter } from "./integrations";
import vantageRouter from "./marinamatch/routes";
import omRouter from "./om/routes";
import omBuilderRouter from "./routes/om-builder-routes";
import documentBuilderRouter from "./routes/document-builder-routes";
import documentExtractionRouter from "./routes/document-extraction";
import scraperV2Routes from "./docket/scraper_v2/routes";
import { liv2Routes } from "./listings/ingestion_v2";
import marketplaceRoutes from "./routes/marketplace-routes";
import pnlRouter from "./services/pnl/routes";
import valuatorExportRoutes from "./routes/valuator-export-routes";
import capitalMarketsServiceRouter from "./services/capital-markets/routes";
import rraRoutes from "./routes/rra-routes";
import modelingRentRollRoutes from "./routes/modeling-rent-roll-routes";
import marinaIntegrationsRoutes from "./routes/marina-integrations-routes";
import authRoutes from "./routes/auth-routes";
import analyticsRoutes from "./routes/analytics-routes";
import legalBenchmarkingRoutes from "./routes/legal-benchmarking-routes";
import { registerEntityLinkingRoutes, registerEventMonitoringRoutes } from "./routes/entity-linking";
import contactIntelligenceRoutes from "./routes/contact-intelligence";
import playbookRoutes from "./routes/playbook-routes";
import forecastingRoutes from "./routes/forecasting-routes";
import phaseGatesRoutes from "./routes/phase-gates-routes";
import redFlagRoutes from "./routes/red-flag-routes";
import crmActivitiesRoutes from "./routes/crm-activities-routes";
import crmTimelineRoutes from "./routes/crm-timeline-routes";
import crmPreviewRoutes from "./routes/crm-preview-routes";
import crmNotesRoutes from "./routes/crm-notes-routes";
import crmSummaryRoutes from "./routes/crm-summary-routes";
import crmRelationshipScoreRouter from './routes/crm-relationship-score';
import crmSavedViewsRoutes from "./routes/crm-saved-views-routes";
import { crmGapsRouter } from "./routes/crm-gaps-routes";
import { crmCalendarSyncRouter } from "./routes/crm-calendar-sync-routes";
import crmIntelligenceRoutes from "./routes/crm-intelligence-routes";
import crmAssociationsRoutes from "./routes/crm-associations-routes";
import crmAdvancedSearchRoutes from "./routes/crm-advanced-search-routes";
import pipelineAnalyticsRoutes from "./routes/pipeline-analytics-routes";
import { getSlaRouter } from "./routes/sla-routes";
import opssosRouter from "./routes/opssos";
import adminRouter from "./routes/admin";
import { enterpriseAuthService } from "./services/enterprise-auth-service";
import { registerCommentRoutes } from "./routes/comment-routes";
import emailMarketingRoutes from "./routes/email-marketing-routes";
import archiveRoutes from "./routes/archive-routes";
import marinalyticsRoutes from "./routes/marinalytics-routes";
import aiAssistantRoutes from "./routes/ai-assistant-routes";
import scenarioTemplateRoutes from "./routes/scenario-template-routes";
import executiveDashboardRoutes from "./routes/executive-dashboard-routes";
import marinaCompRoutes from "./routes/marina-comp-routes";
import valuationTimelineRoutes from "./routes/valuation-timeline-routes";
import dealAnalyticsRoutes from "./routes/deal-analytics-routes";
import dealDDRoutes from "./routes/deal-dd-routes";
import { ddReviewRouter } from "./routes/dd-review-routes";
import commercialTenantsRoutes from "./routes/commercial-tenants-routes";
import commercialLeaseRoutes from "./routes/commercial-lease-routes";
import unifiedLeaseRoutes from "./routes/unified-lease-routes";
import tourProgressRoutes from "./routes/tour-progress-routes";
import operationsSyncRoutes from "./routes/operations-sync-routes";
import ddAutomationRoutes from "./routes/dd-automation-routes";
import modelingValidationRoutes from "./routes/modeling-validation-routes";
import enhancedDebtRoutes from "./routes/enhanced-debt-routes";
import institutionalAnalysisRoutes from "./routes/institutional-analysis-routes";
import returnsRoutes from "./routes/returns-routes";
import budgetRoutes from "./routes/budget-routes";
import bookkeepingGlRoutes from "./routes/bookkeeping-gl-routes";
// lpPortalRoutes now imported as named export above (lpPortalRouter)
import taxWaterfallRoutes from "./routes/tax-waterfall-routes";
import operationsContextRoutes from "./routes/operations-context-routes";
import hotelOpsRoutes from "./routes/hotel-ops-routes";
import multifamilyOpsRoutes from "./routes/multifamily-ops-routes";
import selfStorageOpsRoutes from "./routes/self-storage-ops-routes";
import retailOfficeOpsRoutes from "./routes/retail-office-ops-routes";
import searchRoutes from "./routes/search-routes";
import bulkEmailRoutes from "./routes/bulk-email-routes";
import campaignScheduleRoutes from "./routes/campaign-schedule-routes";
import camReconciliationRoutes from "./routes/cam-reconciliation-routes";
import pipelineAutomationRoutes from "./routes/pipeline-automation-routes";
import dealScoringRoutes from "./routes/deal-scoring-routes";
import competitiveTrackingRoutes from "./routes/competitive-tracking-routes";
import ddStatusReportRoutes from "./routes/dd-status-report-routes";
import documentVersionRoutes from "./routes/document-version-routes";
import pipelineTemplateRoutes from "./routes/pipeline-template-routes";
import { userSessions, insertProspectingEntrySchema, users, salesComps, rateComps, industryStandards, modelingProjectConfig, insertPendingSalesCompSchema, customCatalogItems, insertCustomCatalogItemSchema, marinaListings, outreachCampaigns, outreachTemplates, insertOutreachCampaignSchema, insertOutreachTemplateSchema } from "@shared/schema";
import { customerAnalyticsService } from "./services/customer-analytics-service";
import { initializeVdrForProject } from "./services/vdr-initialization-service";
import { rentRollService } from "./services/rent-roll-service";
import { marketingService } from "./services/marketing-service";
import { personaService } from "./services/persona-service";
import { dashboardService } from "./services/dashboard-service";
import { ownedAssetsService } from "./services/owned-assets-service";
import { debtScenarioService } from "./debt-scenario-service";
import { seasonalityProfileService } from "./services/seasonality-profile-service";
import { scenarioGovernanceService } from "./services/scenario-governance-service";
import { docIntelService } from "./services/doc-intel-service";
import { jobQueueService } from "./services/job-queue-service";
import { packService, type PackType } from "./services/pack-service";
import { requirePack, requireFundManagement, requireLpPortal, requireProspecting, requireRentRoll, loadActivePacks } from "./middleware/pack-guard";
import { cacheService } from "./services/cache-service";
import { monitoringService } from "./services/monitoring-service";
import { dealPricingService } from "./services/deal-pricing-service";
import { calculateAll, type TransactionClosingData } from "./services/transactionClosingEngine";
import { ParserService } from "./services/salescomps/parser";
import { CompService } from "./services/salescomps/compService";
import { FilterBuilder } from "./services/salescomps/filterBuilder";
import { RecommendationService } from "./services/salescomps/recommendationService";
import { AICompMatchingService } from "./services/salescomps/aiCompMatchingService";
import { calculateMetrics, generateInsights, calculateCorrelationData, calculateValuationModels, getMatchedComps, getMarketTrends, generateTrendsInsights, type AnalyticsFilters, type TrendsFilters } from "./services/salescomps/analyticsService";
import { generateAIInsights } from "./services/salescomps/aiInsightsService";
import { geocodingService } from "./services/geocodingService";
import { ParserService as RcParserService } from "./services/ratecomps/parser";
import { CompService as RcCompService } from "./services/ratecomps/compService";
import { FilterBuilder as RcFilterBuilder } from "./services/ratecomps/filterBuilder";
import { RecommendationService as RcRecommendationService } from "./services/ratecomps/recommendationService";
import { 
  calculateMetrics as rcCalculateMetrics, 
  generateInsights as rcGenerateInsights, 
  calculateRateTierMetrics,
  generateRateTierInsights,
  type AnalyticsFilters as RcAnalyticsFilters,
  type RateTierAnalyticsFilters
} from "./services/ratecomps/analyticsService";
import { featureFlags, getPublicFeatureFlags } from "./config/featureFlags";
import { qboConnectorService } from "./services/finance-kernel/qbo-connector";
import { accountMappingService } from "./services/finance-kernel/account-mapping-service";
import { 
  insertProjectSchema, insertProjectSettingsSchema, insertDDTaskSchema, 
  insertProjectTemplateSchema, insertAuditLogSchema,
  insertTimelineNoteSchema, insertProjectShareSchema, insertRiskSchema,
  insertDDContactSchema, updateDDContactSchema, insertProjectContactSchema, insertNotificationSubscriptionSchema, insertNotificationLogSchema,
  insertCalendarEventSchema, insertDocumentRequirementSchema, insertProjectIntegrationSchema,
  insertTaskDependencySchema, insertTaskFileSchema, insertUserEmailSchema, insertCalendarGuestSchema,
  insertCddDocumentSchema, insertKpiSchema, insertFindingSchema, insertRecommendationSchema,
  insertCrmTaskSchema, insertCrmFileSchema, insertCalendarSettingsSchema,
  crmTasks, crmFiles, crmContacts, crmDeals, crmCompanies, crmPipelines, crmPipelineStages, crmActivities, crmProperties, crmNotes, crmContactCompanies, crmCompanyProperties,
  salesComps, rateComps, propertySalesComps, propertyRateComps,
  type InsertCrmFile,
  insertScSavedSearchSchema,
  updateScSavedSearchSchema,
  insertScAnalyticsFilterPresetSchema,
  updateScAnalyticsFilterPresetSchema,
  insertScRecommendationFeedbackSchema,
  scProjectProfileSchema,
  scWeightOverridesSchema,
  scPortfolios,
  scPortfolioComps,
  projects,
  fuelSales,
  insertFuelSaleSchema,
  updateFuelSaleSchema,
  fuelTypes,
  insertFuelTypeSchema,
  updateFuelTypeSchema,
  fuelInventory,
  insertFuelInventorySchema,
  updateFuelInventorySchema,
  fuelDeliveries,
  insertFuelDeliverySchema,
  updateFuelDeliverySchema,
  fuelFinancialProjections,
  insertFuelProjectionSchema,
  updateFuelProjectionSchema,
  fuelImportLogs,
  insertFuelImportLogSchema,
  fuelIntegrations,
  insertFuelIntegrationSchema,
  updateFuelIntegrationSchema,
  debtScenarios,
  insertDebtScenarioSchema,
  updateDebtScenarioSchema,
  rentRolls,
  rentRollEntries,
  insertRentRollSchema,
  updateRentRollSchema,
  insertRentRollEntrySchema,
  updateRentRollEntrySchema,
  marketingCampaigns,
  marketingExpenses,
  leadAttribution,
  emailCampaigns,
  insertMarketingCampaignSchema,
  updateMarketingCampaignSchema,
  insertMarketingExpenseSchema,
  updateMarketingExpenseSchema,
  insertLeadAttributionSchema,
  insertEmailCampaignSchema,
  insertUserPersonaAssignmentSchema,
  updateUserPersonaAssignmentSchema,
  insertDashboardWidgetSchema,
  updateDashboardWidgetSchema,
  insertUserDashboardLayoutSchema,
  updateUserDashboardLayoutSchema,
  insertDashboardCustomWidgetSchema,
  updateDashboardCustomWidgetSchema,
  insertDashboardSavedLayoutSchema,
  updateDashboardSavedLayoutSchema,
  userKpiPreferences,
  ownedAssets,
  insertUserKpiPreferencesSchema,
  insertOwnedAssetSchema,
  assetPerformanceSnapshots,
  updateOwnedAssetSchema,
  insertAssetPerformanceSnapshotSchema,
  marinaBudgets,
  marinaBudgetLineItems,
  marinaBudgetActuals,
  insertMarinaBudgetSchema,
  updateMarinaBudgetSchema,
  insertMarinaBudgetLineItemSchema,
  insertMarinaBudgetActualSchema,
  modelingProjects,
  insertModelingProjectSchema,
  updateModelingProjectSchema,
  insertModelingRegionSchema,
  updateModelingRegionSchema,
  transactionClosingSummary,
  closingCostLines,
  transitionCostLines,
  nwcLines,
  insertTransactionClosingSummarySchema,
  insertClosingCostLineSchema,
  insertTransitionCostLineSchema,
  insertNwcLineSchema,
  insertRateCompSchema,
  targetDemographics,
  insertTargetDemographicsSchema,
  marketTargets,
  insertMarketTargetSchema
} from "@shared/schema";
import { createCalendarEvent, checkCalendarAvailability } from "./lib/google-calendar";
import { 
  salesCompCreateSchema,
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
  columnMappingSchema,
  bulkPortfolioCreateSchema
} from "./utils/salescomps-zod-schemas";
import { PROFIT_CENTERS } from "@shared/salescomps-constants";
import { z } from "zod";
import crypto from "crypto";
import { WebhookSecurity, type WebhookEvent } from "./webhook-security";
import multer from "multer";
import { validateFileUpload } from "./middleware/file-upload-security";
import path from "path";
import fs from "fs-extra";
import { exitStudioRouter } from './routes/exit-studio-routes';
import { generateExitAIInsights } from './services/exit-ai-insights-service';
import coaRoutes from './routes/coa-routes';
import coaTaxonomyRoutes from './routes/coa-taxonomy-routes';
import { propertyDataRouter } from "./routes/property-data-routes";
import { assetClassContextRouter } from "./routes/asset-class-context-routes";
import icRouter from "./routes/ic-routes";
import lpRouter from "./routes/lp-routes";
import leadScoringRouter from "./routes/lead-scoring-routes";
import crmExtendedRouter from "./routes/crm-extended-routes";
import exitPlanningExtRouter from "./routes/exit-planning-extended-routes";
import salesCompsExtRouter from "./routes/sales-comps-extended-routes";
import docketExtRouter from "./routes/docket-extended-routes";
import { registerDDRoutes } from "./routes/dd-routes";
import { registerCRMRoutes } from "./routes/crm-routes";
import { registerModelingRoutes } from "./routes/modeling-routes";
import { registerExternalRoutes } from "./routes/external-routes";
import { registerOperationsRoutes } from "./routes/operations-routes";

// Calendar validation schemas
const calendarQuerySchema = z.object({
  eventType: z.string().optional(),
  startDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format"
  }),
  endDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format"
  }),
  status: z.string().optional(),
  isCompleted: z.string().optional().refine((val) => !val || ['true', 'false'].includes(val), {
    message: "isCompleted must be 'true' or 'false'"
  })
});

const generateIcsSchema = z.object({
  eventIds: z.array(z.string()).optional(),
  projectId: z.string().optional(),
  filters: calendarQuerySchema.optional()
}).refine(data => data.eventIds || data.projectId, {
  message: "Either eventIds or projectId is required"
});

const syncToCalendarSchema = z.object({
  eventIds: z.array(z.string()).min(1, "At least one event ID is required"),
  emailIds: z.array(z.string()).min(1, "At least one email ID is required"),
  projectId: z.string()
});

export async function registerRoutes(app: Express): Promise<Server> {

  // Setup Replit Auth (social login with Google, GitHub, X, Apple)
  await setupAuth(app);
  registerAuthRoutes(app);
  // Health check endpoints (no authentication required)
  app.get("/health", async (_req, res) => {
    try {
      const health = await monitoringService.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error: any) {
      res.status(503).json({ status: 'unhealthy', error: error.message });
    }
  });

  app.get("/health/ready", (_req, res) => {
    const readiness = monitoringService.getReadinessCheck();
    res.status(readiness.ready ? 200 : 503).json(readiness);
  });

  app.get("/health/live", (_req, res) => {
    const liveness = monitoringService.getLivenessCheck();
    res.status(liveness.alive ? 200 : 503).json(liveness);
  });

  app.get("/metrics", async (_req, res) => {
    try {
      const metrics = await monitoringService.getMetrics();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Authorization helper function to verify project ownership
  // CRITICAL: Query database directly to avoid storage.getProject() interception issue with approved projects
  const authorizeProjectAccess = async (projectId: string, orgId: string) => {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      throw new Error("Project not found");
    }
    if (project.orgId !== orgId) {
      throw new Error("Unauthorized access to project");
    }
    return project;
  };

  // Authorization helper for calendar events
  const authorizeCalendarEventAccess = async (eventId: string, orgId: string) => {
    const event = await storage.getCalendarEvent(eventId);
    if (!event) {
      throw new Error("Calendar event not found");
    }
    const project = await storage.getProject(event.projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Unauthorized access to calendar event");
    }
    return event;
  };
  // Enterprise authentication middleware with session support
  const authenticateUser = async (req: any, res: any, next: any) => {
    // Skip authentication for non-API routes (let SPA handle auth)
    // Use originalUrl since req.path is relative to the mount point
    if (!req.originalUrl.startsWith('/api/')){return next();}
    try {
      // resolvedUser will hold the normalized { id, orgId, role, email, name } shape
      let resolvedUser: { id: string; orgId: string; role: string; email: string; name: string } | null = null;

      // 1. Enterprise email/password auth — sessionToken cookie
      const sessionToken = req.cookies?.sessionToken;
      if (sessionToken) {
        const sessionData = await enterpriseAuthService.validateSession(sessionToken);
        if (sessionData) {
          resolvedUser = {
            id: sessionData.user.id,
            orgId: sessionData.user.orgId,
            role: sessionData.user.role,
            email: sessionData.user.email,
            name: sessionData.user.name,
          };
        }
      }

      // 2. Replit OAuth session (passport.js) — req.user set by passport before this middleware
      if (!resolvedUser) {
        const isAuth = typeof req.isAuthenticated === 'function' ? req.isAuthenticated() : false;
        if (isAuth) {
          const passportUser = req.user as any;
          const replitClaims = passportUser?.claims || {};
          const replitUserId = replitClaims.sub;
          if (replitUserId) {
            // Primary lookup: by Replit user ID (returning Replit OAuth users)
            const [dbUser] = await db.select().from(users).where(eq(users.id, replitUserId)).limit(1);
            if (dbUser) {
              resolvedUser = {
                id: dbUser.id,
                orgId: dbUser.orgId,
                role: dbUser.role || 'viewer',
                email: dbUser.email || replitClaims.email || '',
                name: dbUser.name || replitClaims.first_name || '',
              };
            } else if (replitClaims.email) {
              // Fallback: email match for users previously invited via enterprise flow
              const [invitedUser] = await db.select().from(users).where(eq(users.email, replitClaims.email)).limit(1);
              if (invitedUser) {
                resolvedUser = {
                  id: invitedUser.id,
                  orgId: invitedUser.orgId,
                  role: invitedUser.role || 'viewer',
                  email: invitedUser.email,
                  name: invitedUser.name || replitClaims.first_name || '',
                };
              }
            }
          }
        }
      }
      
      // 3. Development fallback — mirrors /api/auth/me behaviour so GET and POST
      //    both resolve the same admin user when no real session is present.
      if (!resolvedUser && process.env.NODE_ENV !== 'production') {
        resolvedUser = { id: "85c9cd7a-c453-4dba-9817-d032d5712c4e", orgId: "cd3719c3-ef82-4ccc-acb9-261c80fb64b4", role: "owner", email: "brettmurphy41@gmail.com", name: "Brett Murphy" };
      }
      
      if (!resolvedUser) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Overwrite req.user with normalized shape for downstream handlers
      req.user = resolvedUser;
      
      // Set tenant context for RLS
      if (req.user?.orgId) {
        await setTenantContext(req.user.orgId);
        
        // Clear tenant context when response finishes
        res.on('finish', () => {
          clearTenantContext().catch(err => {
            console.error('Error clearing tenant context:', err);
          });
        });
      }
      
      next();
    } catch (error: any) {
      console.error('Authentication/tenant context error:', error);
      next(error);
    }
  };

  // Register auth routes (no authentication required for login/register)
  app.use("/api/auth", authRoutes);

  // Public subscription tiers endpoint (no auth needed — used by pricing page and paywall)
  app.get("/api/subscription/tiers", async (_req: any, res) => {
    const { SUBSCRIPTION_TIERS } = await import("./services/pack-service");
    res.json(SUBSCRIPTION_TIERS);
  });
  app.use("/api/dd", authenticateUser, enforceTenant);
  app.use("/api/crm", authenticateUser, enforceTenant, requirePack("crm_pipeline"));
  app.use("/api/crm", playbookRoutes);
  app.use("/api/crm/forecasting", forecastingRoutes);
  app.use("/api/crm/phase-gates", phaseGatesRoutes);
  app.use("/api/crm/red-flags", redFlagRoutes);
  app.use("/api/crm/activities", crmActivitiesRoutes);
  app.use("/api/crm/timeline", crmTimelineRoutes);
  app.use("/api/crm", contactIntelligenceRoutes);
  app.use("/api/crm", crmPreviewRoutes);
  app.use("/api/crm/notes", crmNotesRoutes);
  app.use("/api/crm/summary", crmSummaryRoutes);
  app.use("/api/crm/saved-views", authenticateUser, requirePack("crm_pipeline"), crmSavedViewsRoutes);
  app.use("/api/crm", authenticateUser, enforceTenant, crmGapsRouter);
  app.use("/api/crm/calendar-sync", authenticateUser, enforceTenant, crmCalendarSyncRouter);
  app.use("/api/comments", authenticateUser, enforceTenant, crmIntelligenceRoutes);
  app.use("/api/crm", authenticateUser, enforceTenant, requirePack("crm_pipeline"), crmIntelligenceRoutes);
  app.use("/api/sla", authenticateUser, enforceTenant, requirePack("crm_pipeline"), crmIntelligenceRoutes);
  app.use("/api/crm/analytics", authenticateUser, enforceTenant, requirePack("crm_pipeline"), pipelineAnalyticsRoutes);
  app.use("/api/pipeline/automation", authenticateUser, enforceTenant, pipelineAutomationRoutes);
  app.use("/api/workflow-automations", authenticateUser, enforceTenant, workflowAutomationRouter);
  app.use("/api/workflow-email", authenticateUser, enforceTenant, workflowEmailRouter);
  app.use("/api/google-places", authenticateUser, googlePlacesRouter);

  // ── Billing (auth required except for public plan catalog and webhooks) ──
  app.use("/api/billing", (req: any, res: any, next: any) => {
    // Allow public access to plan catalog and webhook endpoints
    if (req.path === '/plans' || req.path.startsWith('/webhooks')) {
      return next();
    }
    authenticateUser(req, res, next);
  }, billingRouter);

  app.use("/api/support", authenticateUser, supportRouter);

  // ── Gap Spec (Volume 2) Feature Modules ────────────────────────────
  // A.2-A.5: RBAC, Audit Trail, SSO, 2FA
  app.use("/api/infrastructure", authenticateUser, enforceTenant, infrastructureRouter);
  // B.1-B.5: Fund Management, Formation Docs, KYC, Capital Accounts, Fees
  app.use("/api/fund-management", authenticateUser, enforceTenant, fundManagementRouter);
  // C.1-C.5 + D.1-D.2: Tenant Portal, Rent, Leasing, Construction, Renovations
  app.use("/api/tenant-ops", authenticateUser, enforceTenant, tenantConstructionRouter);
  // E.1-E.5 + F.1 + H.1-H.5: Reports, Stress Tests, Accounting, Entities, API Keys, Data Rooms
  app.use("/api/enterprise", authenticateUser, enforceTenant, analyticsEnterpriseRouter);
  // I.1-I.4 + J.2: Climate Risk, Environmental, Insurance, Regulatory, Onboarding
  app.use("/api/compliance", authenticateUser, enforceTenant, complianceOnboardingRouter);
  // F.4: DocuSign Deep Integration (webhook endpoint is unauthenticated)
  app.post("/api/docusign/webhook", docusignRouter);
  app.use("/api/docusign", authenticateUser, enforceTenant, docusignRouter);
  // F.6: Public Records / Title Data
  app.use("/api/public-records", authenticateUser, enforceTenant, publicRecordsRouter);
  // G.4 + 3.5: Predictive Analytics & Hold-Sell Optimizer
  app.use("/api/predictive", authenticateUser, enforceTenant, predictiveAnalyticsRouter);
  // H.2: White-Label API v1 (API key auth, no session)
  app.use("/api/v1", authenticateApiKey, apiV1Router);
  // E.5: Cash Flow Forecasting Engine
  app.use("/api/cash-flow", authenticateUser, enforceTenant, cashFlowForecastingRouter);
  // G.1: AI Underwriting Assistant
  app.use("/api/ai-underwriting", authenticateUser, enforceTenant, aiUnderwritingRouter);
  // G.3: AI Deal Sourcing & Buy Box
  app.use("/api/deal-sourcing", authenticateUser, enforceTenant, dealSourcingRouter);
  // G.5: Meeting Transcription + CRM Sync
  app.use("/api/meetings", authenticateUser, enforceTenant, meetingTranscriptionRouter);
  // H.3: Multi-Currency & International
  app.use("/api/currency", authenticateUser, enforceTenant, multiCurrencyRouter);
  // Master Comps Database (admin curation, subscriber access, overrides, contributions, dedup)
  app.use("/api/master-comps", authenticateUser, enforceTenant, masterCompsRouter);
  // DD Findings, KPI Dashboard & Unified Deal Team
  app.use("/api/dd-enhanced", authenticateUser, enforceTenant, ddFindingsRouter);
  // Financial Model Enhancements (rent roll sync, stress tests, approvals, loan cache, cap stack, scoring)
  app.use("/api/modeling-enhanced", authenticateUser, enforceTenant, modelingEnhancementsRouter);
  // Onboarding Wizard + Notification Center
  app.use("/api/onboarding", authenticateUser, enforceTenant, onboardingRouter);
  // Organization Settings (user-facing)
  app.use("/api/org-settings", authenticateUser, enforceTenant, orgSettingsRouter);
  // Integrations Marketplace
  app.use("/api/integrations-marketplace", authenticateUser, enforceTenant, integrationsMarketplaceRouter);
  // Integrations Sync Monitor
  app.use("/api/integrations", authenticateUser, enforceTenant, integrationsSyncRouter);

  // Start background jobs (non-blocking)
  try { startPlatformCronJobs(); } catch (e) { console.error("Failed to start cron jobs:", e); }

  // ── Master Spec Feature Modules ──────────────────────────────────────
  // Section 1: AI-Native Deal Intelligence (1.1-1.5)
  app.use("/api/ai-deal", authenticateUser, enforceTenant, aiDealIntelligenceRouter);
  // Section 2: LP / Investor Portal (2.1-2.5)
  app.use("/api/investors", authenticateUser, enforceTenant, investorPortalRouter);
  // Sections 3-4: Portfolio Intelligence + Market Intelligence (3.1-4.5)
  app.use("/api/market", authenticateUser, enforceTenant, portfolioMarketRouter);
  // Section 5: Operations & Asset Management (5.1-5.4)
  app.use("/api/operations", authenticateUser, enforceTenant, operationsManagementRouter);
  // Section 6: Capital Markets Tools (6.1-6.4)
  app.use("/api/capital-markets", authenticateUser, enforceTenant, capitalMarketsRouter);
  // Section 7: CRM Relationship Intelligence (7.1-7.5)
  app.use("/api/crm/intelligence", authenticateUser, enforceTenant, crmRelationshipIntelligenceRouter);
  // Sections 8-9: Reporting, Notifications, E-Sign, Webhooks, Stage Config, Email (8.1-9.5, 10.6)
  app.use("/api/platform", authenticateUser, enforceTenant, reportingQuickWinsRouter);
  // Section 10: CRM Pipeline Enhancements (10.2-10.5)
  app.use("/api/crm/pipeline", authenticateUser, enforceTenant, crmPipelineEnhancementsRouter);
  app.use("/api/pipeline/scoring", authenticateUser, enforceTenant, dealScoringRoutes);
  app.use("/api/pipeline/competitive", authenticateUser, enforceTenant, competitiveTrackingRoutes);
  app.use("/api/pipeline/templates", authenticateUser, enforceTenant, pipelineTemplateRoutes);
  app.use("/api/dd", authenticateUser, enforceTenant, ddStatusReportRoutes);
  app.use("/api/vdr", authenticateUser, enforceTenant, documentVersionRoutes);
  app.use("/api/crm/associations", crmAssociationsRoutes);
  app.use("/api/crm", authenticateUser, requirePack("crm_pipeline"), crmAdvancedSearchRoutes);
  app.use("/api", authenticateUser, dealAnalyticsRoutes);
  app.use("/api", authenticateUser, dealDDRoutes);
  app.use("/api/dd-review", authenticateUser, enforceTenant, ddReviewRouter);
  app.use("/api/prospecting", authenticateUser, requireProspecting());
  app.use("/api/sla", getSlaRouter());
  registerCommentRoutes(app);
  app.use("/api/email-marketing", authenticateUser, emailMarketingRoutes);
  app.use("/api/archive", authenticateUser, archiveRoutes);
  app.use("/api/modeling/scenario-templates", authenticateUser, requirePack("modeling_tools"), scenarioTemplateRoutes);
  app.use("/api/modeling", authenticateUser, requirePack("modeling_tools"), modelingValidationRoutes);
  app.use("/api/marinalytics", authenticateUser, marinalyticsRoutes);
  app.use("/api/debt", authenticateUser, enhancedDebtRoutes);
  app.use("/api/institutional-analysis", authenticateUser, institutionalAnalysisRoutes);
  app.use("/api/commercial-tenants", authenticateUser, commercialTenantsRoutes);
  app.use("/api/commercial-leases", authenticateUser, commercialLeaseRoutes);
  app.use("/api/commercial-leases", authenticateUser, unifiedLeaseRoutes);
  app.use(authenticateUser, tourProgressRoutes);
  app.use(authenticateUser, searchRoutes);
  app.use("/api/crm", authenticateUser, requirePack("crm_pipeline"), bulkEmailRoutes);
  app.use("/api/marketing", authenticateUser, campaignScheduleRoutes);
  app.use("/api/cam", authenticateUser, camReconciliationRoutes);
  // Utilization module routes
  const { createUtilizationRouter } = await import('./modules/utilization/utilization-routes');
  app.use("/api/utilization", authenticateUser, createUtilizationRouter());

  // Waitlist module routes
  const { createWaitlistRouter } = await import('./modules/utilization/waitlist-routes');
  app.use("/api/waitlist", authenticateUser, createWaitlistRouter());

  // Pricing recommendations module routes
  const { createPricingRouter } = await import('./modules/utilization/pricing-routes');
  app.use("/api/pricing", authenticateUser, createPricingRouter());

  // Payroll module routes
  app.use("/api/payroll", authenticateUser, payrollRouter);
  app.use("/api/payroll/permissions", authenticateUser, permissionsRouter);
  app.use("/api/valuator", authenticateUser, valuatorPayrollRouter);
  app.use("/api/dept-pnl", authenticateUser, deptPnlRouter);
  app.use("/api/dd/automation", authenticateUser, ddAutomationRoutes);
  // Apply authentication to CRM route aliases
  app.use("/api/leads", authenticateUser, enforceTenant);
  app.use("/api/deals", authenticateUser, enforceTenant);
  app.use("/api/contacts", authenticateUser, enforceTenant);
  app.use("/api/companies", authenticateUser, enforceTenant);
  app.use("/api/properties", authenticateUser, enforceTenant);
  app.use("/api/pipelines", authenticateUser);
  app.use("/api/stages", authenticateUser);
  app.use("/api/pipeline-stages", authenticateUser);
  app.use("/api/activities", authenticateUser);
  app.use("/api/sales-comps", authenticateUser, enforceTenant, requirePack("analysis"));
  app.use("/api/comp-columns", authenticateUser, requirePack("analysis"));
  app.use("/api/sc-projects", authenticateUser, requirePack("analysis"));
  app.use("/api/saved-searches", authenticateUser);
  app.use("/api/profit-centers", authenticateUser);
  app.use("/api/recommendations", authenticateUser);
  app.use("/api/pending-properties", authenticateUser);
  app.use("/api/pending-contacts", authenticateUser);
  app.use("/api/pending-companies", authenticateUser);
  app.use("/api/rate-comps", authenticateUser, enforceTenant, requirePack("analysis"));
  app.use("/api/rc-columns", authenticateUser, requirePack("analysis"));
  app.use("/api/rc-projects", authenticateUser, requirePack("analysis"));
  app.use("/api/rc-saved-searches", authenticateUser);
  app.use("/api/rc-recommendations", authenticateUser);
  app.use("/api/rc-pending-properties", authenticateUser);
  app.use("/api/debt-scenarios", authenticateUser);
  app.use("/api/products", authenticateUser, enforceTenant);
  app.use("/api/labels", authenticateUser, enforceTenant);
  app.use("/api/forms", authenticateUser, enforceTenant);
  app.use("/api/form-templates", authenticateUser, enforceTenant);
  app.use("/api/form-fields", authenticateUser, enforceTenant);
  app.use("/api/docket", authenticateUser, enforceTenant);
  app.use("/api/docket/v2", authenticateUser, enforceTenant, scraperV2Routes);
  app.use("/api/pnl", authenticateUser, enforceTenant, pnlRouter);

  // ─── Phase 1: PNL pipeline bridge endpoints ──────────────────────────────
// ─── PNL Pipeline Import (DocIntel upload → PNL pipeline → modelingActuals) ──
  app.post(
    '/api/modeling/projects/:projectId/pnl-pipeline-import',
    authenticateUser,
    async (req: any, res) => {
      try {
        const orgId: string =
          req.user?.organizationId ?? req.user?.orgId ?? req.user?.organization_id;
        const { projectId } = req.params;
        const { uploadId } = req.body;

        if (!orgId) return res.status(401).json({ error: 'Not authenticated' });
        if (!uploadId) return res.status(400).json({ error: 'uploadId is required' });

        const { importDocIntelToPnlPipeline } = await import(
          './services/pnl/project-bridge'
        );

        const importResult = await importDocIntelToPnlPipeline({
          orgId,
          modelingProjectId: projectId,
          docIntelUploadId: uploadId,
        });

        // Note: promote happens automatically inside setImmediate in project-bridge.ts
        // after runPnlPipeline completes. Poll /pnl-facts-summary for status.
        res.json(importResult);
      } catch (error: any) {
        console.error('[PNL Pipeline Import] Error:', error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // ─── PNL Manual Promote (re-push pnlFacts → modelingActuals) ─────────────────
  app.post(
    '/api/modeling/projects/:projectId/pnl-promote',
    authenticateUser,
    async (req: any, res) => {
      try {
        const orgId: string =
          req.user?.organizationId ?? req.user?.orgId ?? req.user?.organization_id;
        const { projectId } = req.params;
        const { documentId } = req.body ?? {};

        if (!orgId) return res.status(401).json({ error: 'Not authenticated' });

        const { manuallyPromotePnlFacts } = await import(
          './services/pnl/project-bridge'
        );

        const result = await manuallyPromotePnlFacts({
          orgId,
          modelingProjectId: projectId,
          documentId,
        });

        res.json({ success: true, ...result });
      } catch (error: any) {
        console.error('[PNL Promote] Error:', error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // ─── PNL Facts Summary (for project badge in uploads UI) ─────────────────────
  app.get(
    '/api/modeling/projects/:projectId/pnl-facts-summary',
    authenticateUser,
    async (req: any, res) => {
      try {
        const orgId: string =
          req.user?.organizationId ?? req.user?.orgId ?? req.user?.organization_id;
        const { projectId } = req.params;

        if (!orgId) return res.status(401).json({ error: 'Not authenticated' });

        const { getPnlFactsSummaryForProject } = await import(
          './services/pnl/project-bridge'
        );

        const summary = await getPnlFactsSummaryForProject(orgId, projectId);
        res.json(summary);
      } catch (error: any) {
        console.error('[PNL Facts Summary] Error:', error.message);
        res.status(500).json({ error: error.message });
      }
    }
  );

  app.use("/api/rent-roll", authenticateUser, enforceTenant, requireRentRoll(), rraRoutes);
  app.use("/api/valuator-export", authenticateUser, valuatorExportRoutes);
  app.use("/api/modeling-rent-roll", authenticateUser, enforceTenant, requirePack("modeling_tools"), modelingRentRollRoutes);
  app.use("/api/returns", authenticateUser, enforceTenant, returnsRoutes);
  app.use("/api/budgets", authenticateUser, enforceTenant, budgetRoutes);
  app.use("/api/bookkeeping", authenticateUser, enforceTenant, bookkeepingGlRoutes);
  // LP portal mount moved below (with own auth)
  app.use("/api/tax-waterfall", authenticateUser, enforceTenant, taxWaterfallRoutes);
  app.use("/api/marina-integrations", authenticateUser, enforceTenant, marinaIntegrationsRoutes);
  app.use("/api/executive-dashboard", authenticateUser, enforceTenant, requireRentRoll(), executiveDashboardRoutes);
  app.use("/api/capital-markets/services", authenticateUser, enforceTenant, capitalMarketsServiceRouter);

  app.get("/api/geocode", authenticateUser, async (req: any, res) => {
    try {
      const address = req.query.address as string;
      if (!address || address.trim().length < 5) {
        return res.status(400).json({ error: "Address is required (min 5 characters)" });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ error: "Geocoding service not configured" });
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.status !== "OK" || !data.results?.length) {
        return res.status(404).json({ error: "Address not found" });
      }

      const result = data.results[0];
      const components = result.address_components || [];

      let city = "";
      let state = "";
      let zip = "";

      for (const comp of components) {
        const types: string[] = comp.types || [];
        if (types.includes("locality")) {
          city = comp.long_name;
        } else if (types.includes("sublocality_level_1") && !city) {
          city = comp.long_name;
        } else if (types.includes("administrative_area_level_1")) {
          state = comp.short_name;
        } else if (types.includes("postal_code")) {
          zip = comp.long_name;
        }
      }

      res.json({
        city,
        state,
        zip,
        formattedAddress: result.formatted_address,
        lat: result.geometry?.location?.lat,
        lng: result.geometry?.location?.lng,
      });
    } catch (error: any) {
      console.error("Geocode error:", error.message);
      res.status(500).json({ error: "Geocoding failed" });
    }
  });

  app.get("/api/analysis/hub-stats", authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId || '';
      const [salesResult, rateResult, dealsResult] = await Promise.all([
        db.execute(sql`SELECT COUNT(*)::int as count FROM sales_comps WHERE org_id = ${orgId}`),
        db.execute(sql`SELECT COUNT(*)::int as count FROM rate_comps WHERE org_id = ${orgId}`),
        db.execute(sql`SELECT COUNT(*)::int as count FROM docket_deals WHERE org_id = ${orgId}`),
      ]);

      let marketRatesCount = 0;
      try {
        const ratesResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM fred_rate_observations`);
        marketRatesCount = (ratesResult.rows[0] as any)?.count ?? 0;
      } catch {
        marketRatesCount = 0;
      }

      res.json({
        salesCompsCount: (salesResult.rows[0] as any)?.count ?? 0,
        rateCompsCount: (rateResult.rows[0] as any)?.count ?? 0,
        dealsCount: (dealsResult.rows[0] as any)?.count ?? 0,
        marketRatesCount,
      });
    } catch (error: any) {
      console.error("Hub stats error:", error);
      res.json({ salesCompsCount: 0, rateCompsCount: 0, dealsCount: 0, marketRatesCount: 0 });
    }
  });

  // Analysis state-scoped sales comps (used by MarinaDetail and similar views)
  app.get("/api/analysis/sales-comps", authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId || '';
      const { state } = req.query as { state?: string };
      const conditions: any[] = [eq(salesComps.orgId, orgId), isNull(salesComps.deletedAt)];
      if (state) conditions.push(eq(salesComps.state, state));
      const rows = await db.select({
        id: salesComps.id,
        marinaName: salesComps.marina,
        city: salesComps.city,
        state: salesComps.state,
        saleMonth: salesComps.saleMonth,
        saleYear: salesComps.saleYear,
        salePrice: salesComps.salePrice,
        wetSlips: salesComps.wetSlips,
        dryRacks: salesComps.dryRacks,
        capRate: salesComps.capRate,
        brokerage: salesComps.brokerage,
        notes: salesComps.notes,
      }).from(salesComps).where(and(...conditions)).orderBy(desc(salesComps.createdAt)).limit(50);
      const result = rows.map(r => ({
        id: r.id,
        marinaName: r.marinaName,
        location: [r.city, r.state].filter(Boolean).join(', '),
        state: r.state,
        saleDate: r.saleYear ? `${r.saleYear}-${String(r.saleMonth || 1).padStart(2, '0')}-01` : null,
        salePrice: r.salePrice,
        pricePerSlip: r.salePrice && (r.wetSlips || r.dryRacks) ? Math.round(r.salePrice / ((r.wetSlips || 0) + (r.dryRacks || 0))) : null,
        totalSlips: (r.wetSlips || 0) + (r.dryRacks || 0) || null,
        capRate: r.capRate,
        source: r.brokerage,
      }));
      res.json(result);
    } catch (error: any) {
      console.error("Analysis sales-comps error:", error);
      res.status(500).json({ error: "Failed to fetch sales comparables" });
    }
  });

  // Analysis state-scoped rate comps (used by MarinaDetail and similar views)
  app.get("/api/analysis/rate-comps", authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user?.orgId || '';
      const { state } = req.query as { state?: string };
      const conditions: any[] = [eq(rateComps.orgId, orgId), isNull(rateComps.deletedAt)];
      if (state) conditions.push(eq(rateComps.state, state));
      const rows = await db.select({
        id: rateComps.id,
        marina: rateComps.marina,
        city: rateComps.city,
        state: rateComps.state,
        rateCollectionDate: rateComps.rateCollectionDate,
        rateAmount: rateComps.rateAmount,
        boatLengthMin: rateComps.boatLengthMin,
        boatLengthMax: rateComps.boatLengthMax,
        notes: rateComps.notes,
      }).from(rateComps).where(and(...conditions)).orderBy(desc(rateComps.createdAt)).limit(50);
      const result = rows.map(r => ({
        id: r.id,
        marinaName: r.marina,
        location: [r.city, r.state].filter(Boolean).join(', '),
        state: r.state,
        effectiveDate: r.rateCollectionDate,
        avgMonthlyRate: r.rateAmount,
        slipSize: r.boatLengthMin && r.boatLengthMax ? `${r.boatLengthMin}–${r.boatLengthMax} ft` : r.boatLengthMin ? `${r.boatLengthMin}+ ft` : null,
        amenities: null,
        notes: r.notes,
      }));
      res.json(result);
    } catch (error: any) {
      console.error("Analysis rate-comps error:", error);
      res.status(500).json({ error: "Failed to fetch rate comparables" });
    }
  });

  app.use("/api/listings/v2", authenticateUser, enforceTenant, liv2Routes);
  app.use("/api/marketplace", authenticateUser, enforceTenant, marketplaceRoutes);
  app.use("/api/funds", authenticateUser, requireFundManagement());
  app.use("/api/vdr", authenticateUser, vdrRouter);
  app.use(authenticateUser, enforceTenant, vdrActivityRouter);
  app.use(authenticateUser, enforceTenant, dealWorkspaceRouter);
  app.use("/api/ship-store", authenticateUser, requirePack("operations"), shipStoreRouter);
  app.use("/api/service", authenticateUser, requirePack("operations"), serviceRouter);
  app.use("/api/boat-rentals", authenticateUser, requirePack("operations"), boatRentalsRouter);
  app.use("/api/boat-club", authenticateUser, requirePack("operations"), boatClubRouter);
  app.use("/api/boat-sales", authenticateUser, requirePack("operations"), boatSalesRouter);
  app.use("/api/operations", authenticateUser, enforceTenant, requirePack("operations"), operationsSyncRoutes);
  app.use("/api/operations-context", authenticateUser, enforceTenant, requirePack("operations"), operationsContextRoutes);
  app.use("/api/hotel-ops", authenticateUser, enforceTenant, hotelOpsRoutes);
  app.use("/api/multifamily-ops", authenticateUser, enforceTenant, multifamilyOpsRoutes);
  app.use("/api/self-storage-ops", authenticateUser, enforceTenant, selfStorageOpsRoutes);
  app.use("/api/retail-office-ops", authenticateUser, enforceTenant, retailOfficeOpsRoutes);
  app.use("/api/opssos", authenticateUser, enforceTenant, opssosRouter);
  app.use("/api/admin", authenticateUser, enforceTenant, adminRouter);
  app.use("/api/integration", authenticateUser, integrationRouter);
  app.use(authenticateUser, enforceTenant, integrationsRouter);
  app.use("/api/vantage", authenticateUser, vantageRouter);
  app.use("/api/om", authenticateUser, omRouter);
  app.use(authenticateUser, omBuilderRouter);
  app.use("/api/document-builder", authenticateUser, documentBuilderRouter);
  app.use("/api/v1/document-extraction", authenticateUser, documentExtractionRouter);
  app.use(authenticateUser, coaRoutes);
  app.use(authenticateUser, coaTaxonomyRoutes);

  // Entity Linking API (Phase 2B) - Cross-module relationship management
  registerEntityLinkingRoutes(app);
  registerEventMonitoringRoutes(app);
  app.use("/api/analytics", authenticateUser, requirePack("analytics_pro"), analyticsRoutes);
  app.use("/api", authenticateUser, legalBenchmarkingRoutes);
  app.use("/api/ai-assistant", authenticateUser, aiAssistantRoutes);
  app.use("/api/marina-comps", authenticateUser, enforceTenant, marinaCompRoutes);
  app.use("/api/valuations", authenticateUser, enforceTenant, valuationTimelineRoutes);
  app.use(authenticateUser, propertyDataRouter);
  app.use("/api/asset-classes", authenticateUser, assetClassContextRouter);
  app.use("/api/ic", authenticateUser, enforceTenant, icRouter);
  app.use("/api/lp", authenticateUser, enforceTenant, lpRouter);
  app.use("/api/lead-scoring", authenticateUser, enforceTenant, leadScoringRouter);
  app.use("/api/crm-ext", authenticateUser, enforceTenant, crmExtendedRouter);
  app.use("/api/exit-planning", authenticateUser, enforceTenant, exitPlanningExtRouter);
  app.use("/api/exit-studio", authenticateUser, enforceTenant, exitStudioRouter);
  app.use("/api/sc", authenticateUser, enforceTenant, salesCompsExtRouter);
  app.use("/api/docket", authenticateUser, enforceTenant, docketExtRouter);
  app.use("/api/accounting", authenticateUser, enforceTenant, accountingRouter);
  app.use("/api/security", authenticateUser, enforceTenant, securityComplianceRouter);
  app.use("/api/ops-engine", authenticateUser, enforceTenant, operationsEngineRouter);
  app.use("/api/reporting", authenticateUser, enforceTenant, reportingEngineRouter);
  app.use("/api/integrations-v2", authenticateUser, enforceTenant, integrationsEngineRouter);
  app.use("/api/workflow-v2", authenticateUser, enforceTenant, workflowEnhancementsRouter);
  app.use("/api/crm-v2", authenticateUser, enforceTenant, crmEnhancementsRouter);
  app.use("/api/lp-portal", lpPortalRouter); // LP portal has its own auth

  // Dockit Marina Operations Module - mounted at /dockit/api
  try {
    const { attachDockitRoutes } = await import("../modules/dockit/server/integration");
    await attachDockitRoutes(app, (req: any, res: any, next: any) => next(), "dockit-session-secret");
    logger.info("[Dockit] Module routes registered successfully");
  } catch (error: any) {
    console.error("[Dockit] Failed to load module:", error);
  }

  // Auth endpoints
  app.get("/api/auth/me", authenticateUser, (req: any, res) => {
    res.json({
      id: req.user.id,
      orgId: req.user.orgId,
      role: req.user.role,
      email: req.user.email,
      name: req.user.name,
    });
  });

  // Feature flags config endpoint (public for frontend gating)
  app.get("/api/config", (req, res) => {
    res.json({
      featureFlags: getPublicFeatureFlags(),
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
      stripeConfigured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY),
    });
  });

  // Organization features endpoint
  app.get("/api/organization/features", authenticateUser, async (req: any, res) => {
    try {
      const features = await storage.getOrganizationFeatures(req.user.orgId);
      res.json(features);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch organization features" });
    }
  });

  // Public Pack Catalog endpoint (for signup page - no auth required)
  app.get("/api/packs/catalog", async (_req, res) => {
    try {
      const corePacks = await packService.getCorePacks();
      const addonPacks = await packService.getAddonPacks();
      
      const allPacks = [
        ...corePacks.map(p => ({
          packType: p.packType,
          info: {
            name: p.name,
            description: p.description,
            features: p.features,
            isCore: p.isCore,
            monthlyPriceCents: p.monthlyPriceCents,
          },
          isActive: false,
          dependencies: [],
          canActivate: true,
        })),
        ...addonPacks.map(p => ({
          packType: p.packType,
          info: {
            name: p.name,
            description: p.description,
            features: p.features,
            isCore: p.isCore,
            monthlyPriceCents: p.monthlyPriceCents,
          },
          isActive: false,
          dependencies: p.dependencies,
          canActivate: true,
        })),
      ];
      
      res.json(allPacks);
    } catch (error: any) {
      console.error("Failed to fetch pack catalog:", error);
      res.status(500).json({ error: "Failed to fetch pack catalog" });
    }
  });

  // Organization Packs endpoints
  // ── Subscription Tiers (authenticated endpoints) ──────────────────
  app.get("/api/subscription/current-tier", authenticateUser, async (req: any, res) => {
    try {
      const { detectTierFromPacks } = await import("./services/pack-service");
      const activePacks = await packService.getActivePacks(req.user.orgId);
      const tier = detectTierFromPacks(activePacks);
      res.json({ tier, activePacks });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscription/subscribe-tier", authenticateUser, async (req: any, res) => {
    try {
      const { SUBSCRIPTION_TIERS } = await import("./services/pack-service");
      const { tierSlug, isTrial } = req.body;
      const orgId = req.user.orgId;
      const userId = req.user.id;

      const tier = SUBSCRIPTION_TIERS.find((t: any) => t.slug === tierSlug);
      if (!tier) return res.status(400).json({ error: `Unknown tier: ${tierSlug}` });

      // Activate all packs in this tier
      const results = [];
      for (const packType of tier.packs) {
        try {
          const result = await packService.activatePack(orgId, packType as any, userId, {
            isTrial: isTrial || false,
            trialDays: isTrial ? 14 : undefined,
            notes: `Activated via ${tier.name} tier subscription`,
          });
          results.push({ packType, status: "activated" });
        } catch (e: any) {
          results.push({ packType, status: "error", message: e.message });
        }
      }

      res.json({ tier: tier.slug, tierName: tier.name, activatedPacks: results });
    } catch (error: any) {
      console.error("Subscribe-tier error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/organization/packs", authenticateUser, async (req: any, res) => {
    try {
      const packsWithStatus = await packService.getAllPacksWithStatus(req.user.orgId);
      res.json(packsWithStatus);
    } catch (error: any) {
      console.error("Failed to fetch organization packs:", error);
      res.status(500).json({ error: "Failed to fetch organization packs" });
    }
  });

  app.get("/api/organization/packs/active", authenticateUser, async (req: any, res) => {
    try {
      const activePacks = await packService.getActivePacks(req.user.orgId);
      res.json(activePacks);
    } catch (error: any) {
      console.error("Failed to fetch active packs:", error);
      res.status(500).json({ error: "Failed to fetch active packs" });
    }
  });

  app.get("/api/organization/packs/:packType", authenticateUser, async (req: any, res) => {
    try {
      const { packType } = req.params;
      const hasAccess = await packService.hasPackAccess(req.user.orgId, packType as PackType);
      const packInfo = await packService.getPackInfo(packType as PackType);
      res.json({ hasAccess, ...packInfo });
    } catch (error: any) {
      console.error("Failed to check pack access:", error);
      res.status(500).json({ error: "Failed to check pack access" });
    }
  });

  app.post("/api/organization/packs/:packType/activate", authenticateUser, async (req: any, res) => {
    try {
      const { packType } = req.params;
      const { isTrial, trialDays, expiresAt, notes } = req.body;
      
      const pack = await packService.activatePack(
        req.user.orgId,
        packType as PackType,
        req.user.id,
        { isTrial, trialDays, expiresAt: expiresAt ? new Date(expiresAt) : undefined, notes }
      );
      res.json(pack);
    } catch (error: any) {
      console.error("Failed to activate pack:", error);
      res.status(400).json({ error: error.message || "Failed to activate pack" });
    }
  });

  app.post("/api/organization/packs/:packType/deactivate", authenticateUser, requireRole("owner"), async (req: any, res) => {
    try {
      const { packType } = req.params;
      const pack = await packService.deactivatePack(req.user.orgId, packType as PackType);
      res.json(pack || { message: "Pack deactivated" });
    } catch (error: any) {
      console.error("Failed to deactivate pack:", error);
      res.status(400).json({ error: error.message || "Failed to deactivate pack" });
    }
  });

  // Bootstrap endpoint - consolidates sidebar data into a single request
  app.get("/api/bootstrap", authenticateUser, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const orgId = req.user.orgId;

      // Fetch all data in parallel for maximum speed
      // Note: getPending*ForOrg methods already filter by status='pending'
      const [persona, features, pendingProperties, pendingContacts, pendingCompanies, activePacks] = await Promise.all([
        personaService.getUserPersona(userId, orgId).catch(() => null),
        storage.getOrganizationFeatures(orgId).catch(() => []),
        storage.getPendingPropertiesForOrg(orgId).catch(() => []),
        storage.getPendingContactsForOrg(orgId).catch(() => []),
        storage.getPendingCompaniesForOrg(orgId).catch(() => []),
        packService.getActivePacks(orgId).catch(() => [])
      ]);

      res.json({
        persona,
        features,
        activePacks,
        pendingCounts: {
          properties: pendingProperties.length,
          contacts: pendingContacts.length,
          companies: pendingCompanies.length
        }
      });
    } catch (error: any) {
      console.error("Bootstrap endpoint error:", error);
      res.status(500).json({ error: "Failed to fetch bootstrap data" });
    }
  });

  // ==================== FINANCIAL KERNEL ROUTES ====================
  // Feature-flagged routes for enterprise accounting integration

  // Financial Kernel - Canonical Accounts
  app.get("/api/fk/accounts", authenticateUser, async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      const accounts = await accountMappingService.getCanonicalAccounts(req.user.orgId);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/fk/accounts", authenticateUser, requireRole("owner", "admin"), async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      const account = await accountMappingService.createCanonicalAccount({
        ...req.body,
        orgId: req.user.orgId,
      });
      res.json(account);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/fk/accounts/seed", authenticateUser, requireRole("owner", "admin"), async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      const count = await accountMappingService.seedDefaultAccounts(req.user.orgId, req.user.id);
      res.json({ success: true, count });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Financial Kernel - Account Aliases (Mappings)
  app.get("/api/fk/aliases", authenticateUser, async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      const { sourceSystem } = req.query;
      const aliases = await accountMappingService.getAccountAliasesWithTargets(
        req.user.orgId, 
        sourceSystem as string | undefined
      );
      res.json(aliases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/fk/aliases", authenticateUser, requireRole("owner", "admin"), async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      const alias = await accountMappingService.createAccountAlias(
        { ...req.body, orgId: req.user.orgId },
        req.user.id
      );
      res.json(alias);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/fk/aliases/:aliasId", authenticateUser, requireRole("owner", "admin"), async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      const alias = await accountMappingService.updateAccountAlias(
        req.user.orgId,
        req.params.aliasId,
        req.body,
        req.user.id
      );
      res.json(alias);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/fk/aliases/:aliasId", authenticateUser, requireRole("owner", "admin"), async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      await accountMappingService.deleteAccountAlias(req.user.orgId, req.params.aliasId, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/fk/aliases/stats", authenticateUser, async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      const { sourceSystem } = req.query;
      const stats = await accountMappingService.getMappingStats(req.user.orgId, sourceSystem as string || 'qbo');
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/fk/aliases/suggest", authenticateUser, async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      const { sourceAccounts } = req.body;
      const suggestions = await accountMappingService.suggestMappings(req.user.orgId, sourceAccounts);
      res.json(suggestions);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Financial Kernel - QBO Connector
  app.get("/api/fk/qbo/status", authenticateUser, async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED || !featureFlags.CONNECTOR_QBO_ENABLED) {
      return res.status(403).json({ error: "QBO Connector is not enabled" });
    }
    try {
      const isConnected = await qboConnectorService.isConnected(req.user.orgId);
      res.json({ isConnected });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/fk/qbo/accounts", authenticateUser, async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED || !featureFlags.CONNECTOR_QBO_ENABLED) {
      return res.status(403).json({ error: "QBO Connector is not enabled" });
    }
    try {
      const accounts = await qboConnectorService.getChartOfAccounts(req.user.orgId);
      res.json(accounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/fk/qbo/ingest", authenticateUser, requireRole("owner", "admin"), async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED || !featureFlags.CONNECTOR_QBO_ENABLED) {
      return res.status(403).json({ error: "QBO Connector is not enabled" });
    }
    try {
      const { entityId, startDate, endDate } = req.body;
      const result = await qboConnectorService.ingestProfitAndLoss({
        orgId: req.user.orgId,
        entityId,
        startDate,
        endDate,
        createdBy: req.user.id,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/fk/batches", authenticateUser, async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      const batches = await qboConnectorService.getPostingBatches(req.user.orgId);
      res.json(batches);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/fk/batches/:batchId/approve", authenticateUser, requireRole("owner", "admin"), async (req: any, res) => {
    if (!featureFlags.INTEGRATIONS_PLATFORM_ENABLED) {
      return res.status(403).json({ error: "Financial Kernel is not enabled" });
    }
    try {
      await qboConnectorService.approveBatch(req.user.orgId, req.params.batchId, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Initialize SalesComps services
  const parserService = new ParserService();
  const compService = new CompService(storage, parserService);
  const filterBuilder = new FilterBuilder();
  const recommendationService = new RecommendationService(storage);
  const aiCompMatchingService = new AICompMatchingService();

  // Initialize RateComps services
  const rcParserService = new RcParserService();
  const rcCompService = new RcCompService(storage, rcParserService);
  const rcFilterBuilder = new RcFilterBuilder();
  const rcRecommendationService = new RcRecommendationService(storage);

  // Multer configuration for file uploads (SalesComps CSV/Excel imports)
  const uploadSalesComps = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
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

  // Multer configuration for file uploads (RateComps CSV/Excel imports)
  const uploadRateComps = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
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


  // ==================== DD ROUTES (extracted) ====================
  registerDDRoutes(app, authenticateUser);

  // ==================== DEAL WORKSPACE ROUTES ====================

  // Get all deal workspaces for the organization
  app.get('/api/workspaces', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { status, role } = req.query;
      
      const { dealWorkspaces, crmDeals, modelingProjects, projects } = await import('@shared/schema');
      const { eq, and, isNull, desc } = await import('drizzle-orm');
      
      let query = db.select().from(dealWorkspaces).where(
        and(
          eq(dealWorkspaces.orgId, orgId),
          isNull(dealWorkspaces.archivedAt)
        )
      );
      
      const workspaces = await db.query.dealWorkspaces.findMany({
        where: and(
          eq(dealWorkspaces.orgId, orgId),
          isNull(dealWorkspaces.archivedAt),
          status ? eq(dealWorkspaces.status, status as any) : undefined,
          role ? eq(dealWorkspaces.role, role as any) : undefined
        ),
        with: {
          deal: true,
          modelingProject: true,
          ddProject: true,
          property: true,
          creator: { columns: { id: true, name: true } },
        },
        orderBy: (ws, { desc }) => [desc(ws.updatedAt)],
      });
      
      res.json(workspaces);
    } catch (error: any) {
      console.error('Failed to get workspaces:', error);
      res.status(500).json({ error: 'Failed to get workspaces' });
    }
  });

  // Get single workspace with full details
  app.get('/api/workspaces/:workspaceId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { workspaceId } = req.params;
      
      const { dealWorkspaces } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const workspace = await db.query.dealWorkspaces.findFirst({
        where: and(
          eq(dealWorkspaces.id, workspaceId),
          eq(dealWorkspaces.orgId, orgId)
        ),
        with: {
          deal: true,
          modelingProject: true,
          ddProject: true,
          property: true,
          creator: { columns: { id: true, name: true } },
        },
      });
      
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
      
      res.json(workspace);
    } catch (error: any) {
      console.error('Failed to get workspace:', error);
      res.status(500).json({ error: 'Failed to get workspace' });
    }
  });

  // Get workspace overview with aggregated data
  app.get('/api/workspaces/:workspaceId/overview', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { workspaceId } = req.params;
      
      const { dealWorkspaces, tasks, vdrDocuments, vdrFolders } = await import('@shared/schema');
      const { eq, and, sql } = await import('drizzle-orm');
      
      const workspace = await db.query.dealWorkspaces.findFirst({
        where: and(
          eq(dealWorkspaces.id, workspaceId),
          eq(dealWorkspaces.orgId, orgId)
        ),
        with: {
          deal: true,
          modelingProject: true,
          ddProject: true,
          property: true,
        },
      });
      
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
      
      // Get DD task stats if ddProject is linked
      let ddStats = { total: 0, completed: 0, pending: 0, overdue: 0 };
      if (workspace.ddProjectId) {
        const taskData = await db.select({
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where status = 'completed')`,
          pending: sql<number>`count(*) filter (where status != 'completed')`,
        }).from(tasks).where(eq(tasks.projectId, workspace.ddProjectId));
        if (taskData[0]) {
          ddStats = { ...taskData[0], overdue: 0 };
        }
      }
      
      // Get VDR document stats if ddProject is linked (VDR uses DD project ID)
      let vdrStats = { folders: 0, documents: 0, pendingRequests: 0 };
      if (workspace.ddProjectId) {
        const [folderCount] = await db.select({
          count: sql<number>`count(*)`
        }).from(vdrFolders).where(eq(vdrFolders.projectId, workspace.ddProjectId));
        
        const [docCount] = await db.select({
          count: sql<number>`count(*)`
        }).from(vdrDocuments).where(eq(vdrDocuments.projectId, workspace.ddProjectId));
        
        vdrStats = {
          folders: folderCount?.count || 0,
          documents: docCount?.count || 0,
          pendingRequests: 0,
        };
      }
      
      res.json({
        workspace,
        stats: {
          dd: ddStats,
          vdr: vdrStats,
          modeling: {
            hasProject: !!workspace.modelingProjectId,
          },
        },
      });
    } catch (error: any) {
      console.error('Failed to get workspace overview:', error);
      res.status(500).json({ error: 'Failed to get workspace overview' });
    }
  });

  // Create a new workspace
  app.post('/api/workspaces', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      
      const { dealWorkspaces, insertDealWorkspaceSchema } = await import('@shared/schema');
      
      const validated = insertDealWorkspaceSchema.parse({
        ...req.body,
        orgId,
        createdBy: userId,
      });
      
      const [workspace] = await db.insert(dealWorkspaces).values(validated).returning();
      
      res.status(201).json(workspace);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to create workspace:', error);
      res.status(500).json({ error: 'Failed to create workspace' });
    }
  });

  // Update a workspace
  app.patch('/api/workspaces/:workspaceId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { workspaceId } = req.params;
      
      const { dealWorkspaces, updateDealWorkspaceSchema } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const validated = updateDealWorkspaceSchema.parse(req.body);
      
      const [updated] = await db.update(dealWorkspaces)
        .set({ ...validated, updatedAt: new Date() })
        .where(and(
          eq(dealWorkspaces.id, workspaceId),
          eq(dealWorkspaces.orgId, orgId)
        ))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
      
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Failed to update workspace:', error);
      res.status(500).json({ error: 'Failed to update workspace' });
    }
  });

  // Archive a workspace (soft delete)
  app.delete('/api/workspaces/:workspaceId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { workspaceId } = req.params;
      
      const { dealWorkspaces } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const [archived] = await db.update(dealWorkspaces)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(dealWorkspaces.id, workspaceId),
          eq(dealWorkspaces.orgId, orgId)
        ))
        .returning();
      
      if (!archived) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
      
      res.json({ success: true, archived });
    } catch (error: any) {
      console.error('Failed to archive workspace:', error);
      res.status(500).json({ error: 'Failed to archive workspace' });
    }
  });

  // Link entities to workspace
  app.post('/api/workspaces/:workspaceId/link', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { workspaceId } = req.params;
      const { dealId, modelingProjectId, ddProjectId, propertyId } = req.body;
      
      const { dealWorkspaces } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (dealId !== undefined) updates.dealId = dealId;
      if (modelingProjectId !== undefined) updates.modelingProjectId = modelingProjectId;
      if (ddProjectId !== undefined) updates.ddProjectId = ddProjectId;
      if (propertyId !== undefined) updates.propertyId = propertyId;
      
      const [updated] = await db.update(dealWorkspaces)
        .set(updates)
        .where(and(
          eq(dealWorkspaces.id, workspaceId),
          eq(dealWorkspaces.orgId, orgId)
        ))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to link entities to workspace:', error);
      res.status(500).json({ error: 'Failed to link entities' });
    }
  });

  // Create workspace from existing deal
  app.post('/api/workspaces/from-deal/:dealId', authenticateUser, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { dealId } = req.params;
      const { role } = req.body;
      
      const { dealWorkspaces, crmDeals } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Get the deal
      const [deal] = await db.select().from(crmDeals)
        .where(and(eq(crmDeals.id, dealId), eq(crmDeals.orgId, orgId)));
      
      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }
      
      // Create workspace linked to deal
      const [workspace] = await db.insert(dealWorkspaces).values({
        orgId,
        name: deal.title || 'Untitled Workspace',
        description: deal.description,
        role: role || 'buyer',
        status: 'active',
        dealId: deal.id,
        targetPrice: deal.value,
        expectedCloseDate: deal.expectedCloseDate?.toISOString().split('T')[0],
        createdBy: userId,
      }).returning();
      
      res.status(201).json(workspace);
    } catch (error: any) {
      console.error('Failed to create workspace from deal:', error);
      res.status(500).json({ error: 'Failed to create workspace' });
    }
  });


  // ==================== CRM ROUTES (extracted) ====================
  registerCRMRoutes(app, authenticateUser, enforceTenant);


  // ==================== MODELING ROUTES (extracted) ====================
  registerModelingRoutes(app, authenticateUser, enforceTenant);


  // ==================== EXTERNAL API ROUTES (extracted) ====================
  registerExternalRoutes(app, authenticateUser);


  // ==================== OPERATIONS ROUTES (extracted) ====================
  registerOperationsRoutes(app, authenticateUser);

  // ==================== BACKGROUND JOB QUEUE ROUTES ====================
  
  app.get("/api/jobs", async (req: any, res) => {
    try {
      const status = req.query.status as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const jobs = await jobQueueService.getJobsByOrg(req.user.orgId, { 
        status: status as any, 
        limit, 
        offset 
      });
      
      res.json(jobs);
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  app.get("/api/jobs/stats", async (req: any, res) => {
    try {
      const stats = await jobQueueService.getQueueStats(req.user.orgId);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching job stats:", error);
      res.status(500).json({ error: "Failed to fetch job stats" });
    }
  });

  app.get("/api/jobs/:jobId", async (req: any, res) => {
    try {
      const job = await jobQueueService.getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.orgId && job.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.json(job);
    } catch (error: any) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  app.post("/api/jobs/:jobId/cancel", async (req: any, res) => {
    try {
      const job = await jobQueueService.getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.orgId && job.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const cancelled = await jobQueueService.cancelJob(req.params.jobId);
      
      if (!cancelled) {
        return res.status(400).json({ error: "Job cannot be cancelled" });
      }
      
      res.json(cancelled);
    } catch (error: any) {
      console.error("Error cancelling job:", error);
      res.status(500).json({ error: "Failed to cancel job" });
    }
  });

  app.post("/api/jobs/:jobId/retry", async (req: any, res) => {
    try {
      const job = await jobQueueService.getJob(req.params.jobId);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      
      if (job.orgId && job.orgId !== req.user.orgId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const retried = await jobQueueService.retryJob(req.params.jobId);
      
      if (!retried) {
        return res.status(400).json({ error: "Job cannot be retried" });
      }
      
      res.json(retried);
    } catch (error: any) {
      console.error("Error retrying job:", error);
      res.status(500).json({ error: "Failed to retry job" });
    }
  });

  jobQueueService.start().catch(err => {
    console.error("Failed to start job queue:", err);
  });

  // ==================== CACHE MANAGEMENT ROUTES ====================
  
  app.get("/api/cache/stats", async (req: any, res) => {
    try {
      const stats = cacheService.getStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ error: "Failed to fetch cache stats" });
    }
  });

  app.post("/api/cache/invalidate", async (req: any, res) => {
    try {
      const { segment, pattern } = req.body;
      
      let count = 0;
      if (segment) {
        count = await cacheService.invalidateSegment(segment);
      } else if (pattern) {
        count = await cacheService.deletePattern(pattern);
      } else {
        cacheService.clear();
        count = -1;
      }
      
      res.json({ 
        success: true, 
        cleared: count === -1 ? 'all' : count 
      });
    } catch (error: any) {
      console.error("Error invalidating cache:", error);
      res.status(500).json({ error: "Failed to invalidate cache" });
    }
  });

  // ============================================================================
  // COMPREHENSIVE AUDIT LOG API
  // ============================================================================

  // Search audit logs with advanced filtering
  app.get("/api/admin/audit-logs", authenticateUser, async (req: any, res) => {
    try {
      const { orgId } = req.user;
      
      const result = await AuditService.searchAuditLogs(orgId, {
        entityTypes: req.query.entityTypes ? String(req.query.entityTypes).split(',') : undefined,
        actions: req.query.actions ? String(req.query.actions).split(',') : undefined,
        userIds: req.query.userIds ? String(req.query.userIds).split(',') : undefined,
        startDate: req.query.startDate ? new Date(String(req.query.startDate)) : undefined,
        endDate: req.query.endDate ? new Date(String(req.query.endDate)) : undefined,
        searchTerm: req.query.search ? String(req.query.search) : undefined,
        page: req.query.page ? parseInt(String(req.query.page)) : 1,
        pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize)) : 50,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error searching audit logs:", error);
      res.status(500).json({ error: "Failed to search audit logs" });
    }
  });

  // Get security events (auth-related)
  app.get("/api/admin/security-events", authenticateUser, async (req: any, res) => {
    try {
      const { orgId } = req.user;
      
      const result = await AuditService.getSecurityEvents(orgId, {
        eventTypes: req.query.eventTypes ? String(req.query.eventTypes).split(',') : undefined,
        userIds: req.query.userIds ? String(req.query.userIds).split(',') : undefined,
        startDate: req.query.startDate ? new Date(String(req.query.startDate)) : undefined,
        endDate: req.query.endDate ? new Date(String(req.query.endDate)) : undefined,
        successOnly: req.query.successOnly ? req.query.successOnly === 'true' : undefined,
        page: req.query.page ? parseInt(String(req.query.page)) : 1,
        pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize)) : 50,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching security events:", error);
      res.status(500).json({ error: "Failed to fetch security events" });
    }
  });

  // Get audit statistics for dashboard
  app.get("/api/admin/audit-stats", authenticateUser, async (req: any, res) => {
    try {
      const { orgId } = req.user;
      const days = req.query.days ? parseInt(String(req.query.days)) : 30;
      
      const stats = await AuditService.getAuditStats(orgId, days);
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching audit stats:", error);
      res.status(500).json({ error: "Failed to fetch audit statistics" });
    }
  });

  // Export audit logs
  app.get("/api/admin/audit-logs/export", authenticateUser, async (req: any, res) => {
    try {
      const { orgId } = req.user;
      const format = (req.query.format as 'json' | 'csv') || 'csv';
      
      const exportData = await AuditService.exportAuditLogs(orgId, format, {
        entityTypes: req.query.entityTypes ? String(req.query.entityTypes).split(',') : undefined,
        startDate: req.query.startDate ? new Date(String(req.query.startDate)) : undefined,
        endDate: req.query.endDate ? new Date(String(req.query.endDate)) : undefined,
        maxRecords: req.query.maxRecords ? parseInt(String(req.query.maxRecords)) : 10000,
      });

      res.setHeader('Content-Type', exportData.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      res.send(exportData.data);
    } catch (error: any) {
      console.error("Error exporting audit logs:", error);
      res.status(500).json({ error: "Failed to export audit logs" });
    }
  });

  // Get audit log entity types (for filter dropdowns)
  app.get("/api/admin/audit-logs/entity-types", authenticateUser, async (req: any, res) => {
    try {
      const entityTypes = await db
        .selectDistinct({ entityType: auditLogs.entityType })
        .from(auditLogs)
        .where(eq(auditLogs.orgId, req.user.orgId));
      
      res.json(entityTypes.map(r => r.entityType));
    } catch (error: any) {
      console.error("Error fetching entity types:", error);
      res.status(500).json({ error: "Failed to fetch entity types" });
    }
  });

  // Get audit log actions (for filter dropdowns)
  app.get("/api/admin/audit-logs/actions", authenticateUser, async (req: any, res) => {
    try {
      const actions = await db
        .selectDistinct({ action: auditLogs.action })
        .from(auditLogs)
        .where(eq(auditLogs.orgId, req.user.orgId))
        .limit(100);
      
      res.json(actions.map(r => r.action));
    } catch (error: any) {
      console.error("Error fetching actions:", error);
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });

  // ============================================================================
  // Target Demographics API - Site Suitability Scoring
  // ============================================================================

  // Get target demographics (with optional project override)
  app.get("/api/target-demographics", authenticateUser, async (req: any, res) => {
    try {
      const { orgId, id: userId } = req.user;
      const projectId = req.query.projectId as string | undefined;

      // If projectId is specified, try to get project-specific targets first
      if (projectId) {
        const projectTargets = await db
          .select()
          .from(targetDemographics)
          .where(and(
            eq(targetDemographics.orgId, orgId),
            eq(targetDemographics.userId, userId),
            eq(targetDemographics.projectId, projectId)
          ))
          .limit(1);

        if (projectTargets.length > 0) {
          return res.json(projectTargets[0]);
        }
      }

      // Fall back to user's default targets
      const defaultTargets = await db
        .select()
        .from(targetDemographics)
        .where(and(
          eq(targetDemographics.orgId, orgId),
          eq(targetDemographics.userId, userId),
          eq(targetDemographics.isDefault, true)
        ))
        .limit(1);

      if (defaultTargets.length > 0) {
        return res.json(defaultTargets[0]);
      }

      // Return null if no targets configured
      res.json(null);
    } catch (error: any) {
      console.error("Error fetching target demographics:", error);
      res.status(500).json({ error: "Failed to fetch target demographics" });
    }
  });

  // Save/update target demographics
  app.post("/api/target-demographics", authenticateUser, async (req: any, res) => {
    try {
      const { orgId, id: userId } = req.user;
      const data = req.body;
      const projectId = data.projectId as string | undefined;

      // Validate the input
      const validated = insertTargetDemographicsSchema.parse({
        ...data,
        orgId,
        userId,
        projectId: projectId || null,
        isDefault: !projectId, // Default profile if no project specified
      });

      // Check if a record already exists for this user/project combo
      const existingQuery = projectId
        ? and(
            eq(targetDemographics.orgId, orgId),
            eq(targetDemographics.userId, userId),
            eq(targetDemographics.projectId, projectId)
          )
        : and(
            eq(targetDemographics.orgId, orgId),
            eq(targetDemographics.userId, userId),
            eq(targetDemographics.isDefault, true)
          );

      const existing = await db
        .select()
        .from(targetDemographics)
        .where(existingQuery)
        .limit(1);

      let result;
      if (existing.length > 0) {
        // Update existing record
        const updated = await db
          .update(targetDemographics)
          .set({
            ...validated,
            updatedAt: new Date(),
          })
          .where(eq(targetDemographics.id, existing[0].id))
          .returning();
        result = updated[0];
      } else {
        // Create new record
        const created = await db
          .insert(targetDemographics)
          .values(validated)
          .returning();
        result = created[0];
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error saving target demographics:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save target demographics" });
    }
  });

  // Delete target demographics
  app.delete("/api/target-demographics", authenticateUser, async (req: any, res) => {
    try {
      const { orgId, id: userId } = req.user;
      const projectId = req.query.projectId as string | undefined;

      const deleteQuery = projectId
        ? and(
            eq(targetDemographics.orgId, orgId),
            eq(targetDemographics.userId, userId),
            eq(targetDemographics.projectId, projectId)
          )
        : and(
            eq(targetDemographics.orgId, orgId),
            eq(targetDemographics.userId, userId),
            eq(targetDemographics.isDefault, true)
          );

      await db.delete(targetDemographics).where(deleteQuery);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting target demographics:", error);
      res.status(500).json({ error: "Failed to delete target demographics" });
    }
  });

  // Get all target demographic profiles for a user
  app.get("/api/target-demographics/all", authenticateUser, async (req: any, res) => {
    try {
      const { orgId, id: userId } = req.user;

      const profiles = await db
        .select()
        .from(targetDemographics)
        .where(and(
          eq(targetDemographics.orgId, orgId),
          eq(targetDemographics.userId, userId)
        ))
        .orderBy(desc(targetDemographics.isDefault), asc(targetDemographics.createdAt));

      res.json(profiles);
    } catch (error: any) {
      console.error("Error fetching target demographics profiles:", error);
      res.status(500).json({ error: "Failed to fetch target demographics profiles" });
    }
  });

  // Payment routes (Stripe)
  app.get("/api/stripe/status", async (_req, res) => {
    const configured = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
    res.json({ configured, message: configured ? "Stripe is configured" : "Stripe keys not set — free trials available during beta" });
  });

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    const key = process.env.STRIPE_PUBLISHABLE_KEY || null;
    res.json({ publishableKey: key, configured: !!key });
  });

  // ═══════════════════════════════════════════════════════════════
  // INVESTMENT CRITERIA — Account-level buy-box configuration
  // ═══════════════════════════════════════════════════════════════

  // List all criteria profiles for org
  app.get("/api/investment-criteria", async (req, res) => {
    try {
      const orgId = req.headers["x-org-id"] as string || "default";
      const profiles = await db.select()
        .from(investmentCriteriaProfiles)
        .where(eq(investmentCriteriaProfiles.orgId, orgId))
        .orderBy(investmentCriteriaProfiles.createdAt);
      res.json(profiles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get default active profile with all sub-tables
  app.get("/api/investment-criteria/default", async (req, res) => {
    try {
      const orgId = req.headers["x-org-id"] as string || "default";
      const [profile] = await db.select()
        .from(investmentCriteriaProfiles)
        .where(and(
          eq(investmentCriteriaProfiles.orgId, orgId),
          eq(investmentCriteriaProfiles.isDefault, true),
          eq(investmentCriteriaProfiles.isActive, true),
        ))
        .limit(1);
      
      if (!profile) {
        return res.json(null);
      }
      
      const [location] = await db.select().from(investmentCriteriaLocation).where(eq(investmentCriteriaLocation.profileId, profile.id));
      const [financial] = await db.select().from(investmentCriteriaFinancial).where(eq(investmentCriteriaFinancial.profileId, profile.id));
      const [operational] = await db.select().from(investmentCriteriaOperational).where(eq(investmentCriteriaOperational.profileId, profile.id));
      const [size] = await db.select().from(investmentCriteriaSize).where(eq(investmentCriteriaSize.profileId, profile.id));
      const [capital] = await db.select().from(investmentCriteriaCapital).where(eq(investmentCriteriaCapital.profileId, profile.id));
      const [involvement] = await db.select().from(investmentCriteriaInvolvement).where(eq(investmentCriteriaInvolvement.profileId, profile.id));
      
      res.json({ profile, location, financial, operational, size, capital, involvement });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single profile with all sub-tables
  app.get("/api/investment-criteria/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [profile] = await db.select().from(investmentCriteriaProfiles).where(eq(investmentCriteriaProfiles.id, id));
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      
      const [location] = await db.select().from(investmentCriteriaLocation).where(eq(investmentCriteriaLocation.profileId, id));
      const [financial] = await db.select().from(investmentCriteriaFinancial).where(eq(investmentCriteriaFinancial.profileId, id));
      const [operational] = await db.select().from(investmentCriteriaOperational).where(eq(investmentCriteriaOperational.profileId, id));
      const [size] = await db.select().from(investmentCriteriaSize).where(eq(investmentCriteriaSize.profileId, id));
      const [capital] = await db.select().from(investmentCriteriaCapital).where(eq(investmentCriteriaCapital.profileId, id));
      const [involvement] = await db.select().from(investmentCriteriaInvolvement).where(eq(investmentCriteriaInvolvement.profileId, id));
      
      res.json({ profile, location, financial, operational, size, capital, involvement });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Deal Comp Linking Endpoints ─────────────────────────────────────
  app.get('/api/integrations/deals/:dealId/sales-comps', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dealId } = req.params;
      const rows = await pool.query(
        `SELECT dsc.*, sc.marina, sc.city, sc.state, sc.sale_price, sc.cap_rate, 
                sc.sale_year, sc.wet_slips, sc.total_slips, sc.price_per_slip
         FROM deal_sales_comps dsc
         JOIN sales_comps sc ON sc.id = dsc.sales_comp_id
         WHERE dsc.deal_id = $1 AND dsc.org_id = $2
         ORDER BY dsc.is_primary DESC, dsc.relevance_score DESC NULLS LAST`,
        [dealId, orgId]
      );
      res.json(rows.rows.map((r: any) => ({
        id: r.id, dealId: r.deal_id, salesCompId: r.sales_comp_id,
        isPrimary: r.is_primary, relevanceScore: r.relevance_score,
        notes: r.notes, comparisonType: r.comparison_type,
        distanceMiles: r.distance_miles,
        salesComp: {
          id: r.sales_comp_id, marinaName: r.marina, city: r.city, state: r.state,
          salePrice: r.sale_price, capRate: r.cap_rate, saleYear: r.sale_year,
          wetSlips: r.wet_slips, totalSlips: r.total_slips, pricePerSlip: r.price_per_slip,
        },
      })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/integrations/deals/:dealId/sales-comps', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { dealId } = req.params;
      const { salesCompId, isPrimary = false, notes, comparisonType = 'similar', relevanceScore } = req.body;
      if (!salesCompId) return res.status(400).json({ error: 'salesCompId required' });
      const result = await pool.query(
        `INSERT INTO deal_sales_comps (id, org_id, deal_id, sales_comp_id, is_primary, notes, comparison_type, relevance_score, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (deal_id, sales_comp_id) DO UPDATE
           SET is_primary=$4, notes=$5, comparison_type=$6, relevance_score=$7, updated_at=NOW()
         RETURNING *`,
        [orgId, dealId, salesCompId, isPrimary, notes || null, comparisonType, relevanceScore || null, userId]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/integrations/deals/:dealId/sales-comps/:salesCompId', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dealId, salesCompId } = req.params;
      await pool.query(
        `DELETE FROM deal_sales_comps WHERE deal_id=$1 AND sales_comp_id=$2 AND org_id=$3`,
        [dealId, salesCompId, orgId]
      );
      res.status(204).send();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/integrations/deals/:dealId/rate-comps', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dealId } = req.params;
      const rows = await pool.query(
        `SELECT drc.*, rc.marina, rc.city, rc.state, rc.wet_slip_rate_avg, 
                rc.dry_slip_rate_avg, rc.total_slips, rc.occupancy_rate, rc.quality_tier
         FROM deal_rate_comps drc
         JOIN rate_comps rc ON rc.id = drc.rate_comp_id
         WHERE drc.deal_id = $1 AND drc.org_id = $2
         ORDER BY drc.is_primary DESC, drc.relevance_score DESC NULLS LAST`,
        [dealId, orgId]
      );
      res.json(rows.rows.map((r: any) => ({
        id: r.id, dealId: r.deal_id, rateCompId: r.rate_comp_id,
        isPrimary: r.is_primary, relevanceScore: r.relevance_score,
        notes: r.notes, comparisonType: r.comparison_type,
        rateVariancePercent: r.rate_variance_percent,
        rateComp: {
          id: r.rate_comp_id, marinaName: r.marina, city: r.city, state: r.state,
          wetSlipRateAvg: r.wet_slip_rate_avg, drySlipRateAvg: r.dry_slip_rate_avg,
          totalSlips: r.total_slips, occupancyRate: r.occupancy_rate, qualityTier: r.quality_tier,
        },
      })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/integrations/deals/:dealId/rate-comps', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const userId = req.user.id;
      const { dealId } = req.params;
      const { rateCompId, isPrimary = false, notes, comparisonType = 'benchmark', relevanceScore } = req.body;
      if (!rateCompId) return res.status(400).json({ error: 'rateCompId required' });
      const result = await pool.query(
        `INSERT INTO deal_rate_comps (id, org_id, deal_id, rate_comp_id, is_primary, notes, comparison_type, relevance_score, created_by)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (deal_id, rate_comp_id) DO UPDATE
           SET is_primary=$4, notes=$5, comparison_type=$6, relevance_score=$7, updated_at=NOW()
         RETURNING *`,
        [orgId, dealId, rateCompId, isPrimary, notes || null, comparisonType, relevanceScore || null, userId]
      );
      res.status(201).json(result.rows[0]);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete('/api/integrations/deals/:dealId/rate-comps/:rateCompId', authenticateUser, enforceTenant, async (req: any, res) => {
    try {
      const orgId = req.user.orgId;
      const { dealId, rateCompId } = req.params;
      await pool.query(
        `DELETE FROM deal_rate_comps WHERE deal_id=$1 AND rate_comp_id=$2 AND org_id=$3`,
        [dealId, rateCompId, orgId]
      );
      res.status(204).send();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Create new criteria profile with sub-tables
  app.post("/api/investment-criteria", async (req, res) => {
    try {
      const orgId = req.headers["x-org-id"] as string || "default";
      const { name, description, isDefault, location, financial, operational, size, capital, involvement, ...weights } = req.body;
      
      // If setting as default, unset existing defaults
      if (isDefault) {
        await db.update(investmentCriteriaProfiles)
          .set({ isDefault: false })
          .where(eq(investmentCriteriaProfiles.orgId, orgId));
      }
      
      const [profile] = await db.insert(investmentCriteriaProfiles).values({
        orgId,
        name: name || "Investment Criteria",
        description,
        isDefault: isDefault ?? true,
        isActive: true,
        ...weights,
      }).returning();
      
      // Insert sub-tables if provided
      if (location) await db.insert(investmentCriteriaLocation).values({ ...location, profileId: profile.id, orgId });
      if (financial) await db.insert(investmentCriteriaFinancial).values({ ...financial, profileId: profile.id, orgId });
      if (operational) await db.insert(investmentCriteriaOperational).values({ ...operational, profileId: profile.id, orgId });
      if (size) await db.insert(investmentCriteriaSize).values({ ...size, profileId: profile.id, orgId });
      if (capital) await db.insert(investmentCriteriaCapital).values({ ...capital, profileId: profile.id, orgId });
      if (involvement) await db.insert(investmentCriteriaInvolvement).values({ ...involvement, profileId: profile.id, orgId });
      
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update profile + upsert sub-tables
  app.put("/api/investment-criteria/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const orgId = req.headers["x-org-id"] as string || "default";
      const { location, financial, operational, size, capital, involvement, ...profileData } = req.body;
      
      // If setting as default, unset existing
      if (profileData.isDefault) {
        await db.update(investmentCriteriaProfiles)
          .set({ isDefault: false })
          .where(and(eq(investmentCriteriaProfiles.orgId, orgId), sql`id != ${id}`));
      }
      
      const [profile] = await db.update(investmentCriteriaProfiles)
        .set({ ...profileData, updatedAt: new Date() })
        .where(eq(investmentCriteriaProfiles.id, id))
        .returning();
      
      // Upsert sub-tables: delete + re-insert
      const upsert = async (table: any, data: any) => {
        if (!data) return;
        await db.delete(table).where(eq(table.profileId, id));
        await db.insert(table).values({ ...data, profileId: id, orgId });
      };
      
      await upsert(investmentCriteriaLocation, location);
      await upsert(investmentCriteriaFinancial, financial);
      await upsert(investmentCriteriaOperational, operational);
      await upsert(investmentCriteriaSize, size);
      await upsert(investmentCriteriaCapital, capital);
      await upsert(investmentCriteriaInvolvement, involvement);
      
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete profile (cascade deletes sub-tables via FK)
  app.delete("/api/investment-criteria/:id", async (req, res) => {
    try {
      await db.delete(investmentCriteriaProfiles).where(eq(investmentCriteriaProfiles.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // POST /api/stripe/checkout — create Stripe Checkout Session for pack purchase
  app.post("/api/stripe/checkout", authenticateUser, async (req: any, res) => {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
      if (!stripe) return res.status(503).json({ error: "Billing not configured — contact support to enable payments" });

      const orgId = req.user?.orgId || req.tenantId;
      const userId = req.user?.id;
      const email = req.user?.email;
      const { packType, billingCycle = "monthly", successUrl, cancelUrl } = req.body;

      if (!packType) return res.status(400).json({ error: "packType is required" });

      // Look up pack in catalog
      const [pack] = await db.select().from(packCatalog).where(eq(packCatalog.packType, packType));
      if (!pack) return res.status(404).json({ error: `Pack '${packType}' not found in catalog` });

      const priceId = billingCycle === "yearly" ? pack.stripePriceIdYearly : pack.stripePriceIdMonthly;

      // Get or create Stripe customer
      let customerId: string | undefined;
      const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
      if (existingSub?.providerCustomerId) {
        customerId = existingSub.providerCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email,
          metadata: { orgId, userId },
        });
        customerId = customer.id;
        // Persist the new Stripe customer ID so the billing portal can resolve it later
        if (existingSub) {
          await db.update(subscriptions)
            .set({ providerCustomerId: customerId, updatedAt: new Date() })
            .where(eq(subscriptions.orgId, orgId));
        } else {
          await db.insert(subscriptions).values({
            userId,
            orgId,
            provider: "stripe",
            planKey: packType,
            planName: pack.name || packType,
            status: "trialing",
            providerCustomerId: customerId,
          }).onConflictDoNothing();
        }
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: priceId
          ? [{ price: priceId, quantity: 1 }]
          : [{
              price_data: {
                currency: "usd",
                product_data: { name: pack.name || packType, description: pack.description || undefined },
                unit_amount: billingCycle === "yearly" ? (pack.yearlyPriceCents || 0) : (pack.monthlyPriceCents || 0),
                recurring: { interval: billingCycle === "yearly" ? "year" : "month" },
              },
              quantity: 1,
            }],
        success_url: successUrl || `${baseUrl}/settings/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: cancelUrl || `${baseUrl}/settings/billing?canceled=true`,
        metadata: { orgId, userId, packType, billingCycle },
        subscription_data: {
          metadata: { orgId, packType },
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/stripe/billing-portal — alias for billing portal (matches billing-service task requirement)
  app.get("/api/stripe/billing-portal", authenticateUser, async (req: any, res) => {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
      if (!stripe) return res.status(503).json({ error: "Billing not configured — contact support to enable payments" });

      const orgId = req.user?.orgId || req.tenantId;
      const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);

      if (!existingSub?.providerCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found. Subscribe to a plan first." });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: existingSub.providerCustomerId,
        return_url: (req as any).query?.returnUrl as string || `${baseUrl}/settings/billing`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe billing portal error:", error);
      res.status(500).json({ error: error.message });
    }
  });

    // POST /api/stripe/portal — open Stripe Customer Portal for subscription management
  app.post("/api/stripe/portal", authenticateUser, async (req: any, res) => {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
      if (!stripe) return res.status(503).json({ error: "Billing not configured — contact support to enable payments" });

      const orgId = req.user?.orgId || req.tenantId;
      const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);

      if (!existingSub?.providerCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found. Subscribe to a plan first." });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: existingSub.providerCustomerId,
        return_url: req.body.returnUrl || `${baseUrl}/settings/billing`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe portal error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/stripe/subscribe-pack — inline pack subscription using payment method from Stripe Elements
  app.post("/api/stripe/subscribe-pack", authenticateUser, async (req: any, res) => {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

      const orgId = req.user?.orgId || req.tenantId;
      const userId = req.user?.id;
      const email = req.user?.email;
      const { packType, paymentMethodId, billingCycle = "monthly" } = req.body;

      if (!packType) return res.status(400).json({ error: "packType is required" });

      // Look up pack in catalog
      const [pack] = await db.select().from(packCatalog).where(eq(packCatalog.packType, packType));
      if (!pack) return res.status(404).json({ error: `Pack '${packType}' not found in catalog` });

      if (stripe && paymentMethodId) {
        // Stripe path: create customer, attach payment, create subscription
        let customerId: string | undefined;
        const [existingSub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
        if (existingSub?.providerCustomerId) {
          customerId = existingSub.providerCustomerId;
        } else {
          const customer = await stripe.customers.create({
            email,
            metadata: { orgId, userId },
          });
          customerId = customer.id;
        }

        // Attach payment method and set as default
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });

        const priceId = billingCycle === "yearly" ? pack.stripePriceIdYearly : pack.stripePriceIdMonthly;
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: priceId
            ? [{ price: priceId }]
            : [{
                price_data: {
                  currency: "usd",
                  product_data: { name: pack.name || packType },
                  unit_amount: billingCycle === "yearly" ? (pack.yearlyPriceCents || 0) : (pack.monthlyPriceCents || 0),
                  recurring: { interval: billingCycle === "yearly" ? "year" : "month" },
                },
              }],
          metadata: { orgId, packType },
          payment_behavior: "default_incomplete",
          expand: ["latest_invoice.payment_intent"],
        });

        // Also activate the pack locally
        try {
          const packService = (await import("./services/pack-service")).default;
          await packService.activatePack(orgId, packType, userId);
        } catch (e: any) {
          console.warn("Pack activation after stripe subscribe:", e.message);
        }

        const invoice = subscription.latest_invoice as any;
        const paymentIntent = invoice?.payment_intent as any;

        res.json({
          subscriptionId: subscription.id,
          status: subscription.status,
          clientSecret: paymentIntent?.client_secret,
          packType,
        });
      } else {
        // No Stripe / free trial path: just activate the pack
        try {
          const packService = (await import("./services/pack-service")).default;
          await packService.activatePack(orgId, packType, userId, { isTrial: true });
        } catch (e: any) {
          console.warn("Pack trial activation:", e.message);
        }

        res.json({
          subscriptionId: null,
          status: "trialing",
          clientSecret: null,
          packType,
        });
      }
    } catch (error: any) {
      console.error("Stripe subscribe-pack error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // NOTE: POST /api/stripe/webhook is handled in server/index.ts BEFORE express.json()
  // to preserve the raw request body required for Stripe signature verification.
  // Do not re-register this route here — the handler in index.ts is authoritative.

  const httpServer = createServer(app);

  // ============================================================================
  // DCF REFACTOR — Layers 1-4 (canonical Pro Forma consumption)
  // ============================================================================
  try {
    const { registerDCFRoutes } = await import('./routes/dcf-routes');
    const { computeDirectInputFinancials } = await import('./services/direct-input-engine');
    const { computeMultiYearProjection } = await import('./services/multi-year-projection-engine');
    const debtEngine = await import('../shared/debt/debt-engine');
    const { pool } = await import('./db');
    // const { generateDebtSchedule } = await import('../shared/debt/debt-engine'); // wire when ready

    registerDCFRoutes(app, {
      pool,
      authenticateUser,
      computeDirectInputFinancials,
      computeMultiYearProjection,
      generateDebtSchedule: (tranches: any[], holdPeriod: number) => {
        // Wrapper that adapts debt engine to the expected interface
        // Each "tranche" from capital_stacks is already aggregated,
        // so we compute schedule from the tranche inputs if available
        if (!tranches || tranches.length === 0) return null;
        
        const results = tranches.map((t: any) => {
          const schedule = debtEngine.computeLoanSchedule({
            loanAmount: Number(t.loanAmount || t.amount || 0),
            termMonths: Number(t.termMonths || t.term || 60) * (t.termMonths ? 1 : 12),
            amortMonths: Number(t.amortMonths || t.amortization || 360) * (t.amortMonths ? 1 : 12),
            interestOnlyMonths: Number(t.ioMonths || t.interestOnlyMonths || 0),
            rateType: t.rateType || 'fixed',
            fixedRate: Number(t.rate || t.fixedRate || 0.05),
            capitalizeOriginationFees: false,
            prepayType: 'none',
          });
          const annual = debtEngine.computeAnnualDebtService(schedule);
          const payoff = debtEngine.computeLoanPayoffAtExit(schedule, holdPeriod * 12, {
            exitFeePct: 0, prepayType: 'none'
          });
          return { schedule, annual, payoff, amount: Number(t.loanAmount || t.amount || 0) };
        });

        const totalDebtAtClose = results.reduce((s: number, r: any) => s + r.amount, 0);
        const annualDebtService = Array.from({ length: holdPeriod }, (_, yr) =>
          results.reduce((s: number, r: any) => s + (r.annual[yr]?.totalDebtService ?? 0), 0)
        );
        const remainingBalanceAtExit = results.reduce((s: number, r: any) =>
          s + (r.payoff?.payoffBalance ?? 0), 0
        );
        const blendedRate = totalDebtAtClose > 0
          ? results.reduce((s: number, r: any) =>
              s + (Number(r.schedule[0]?.rateBps ?? 0) / 10000) * r.amount, 0
            ) / totalDebtAtClose
          : 0;

        return { totalDebtAtClose, annualDebtService, remainingBalanceAtExit, blendedRate };
      },  // TODO: wire debt engine
    });
    logger.info('[DCF] Refactored routes registered (Layers 1-4)');
  } catch (dcfErr: any) {
    console.error('[DCF] ROUTE REGISTRATION FAILED:', dcfErr.message);
    console.error(dcfErr.stack);
  }

  // POST /api/reports/send-email - Send report HTML content via email
  app.post("/api/reports/send-email", async (req: any, res) => {
    try {
      const payload = z.object({
        to: z.array(z.string().email()).min(1),
        subject: z.string().min(1),
        message: z.string().optional(),
        htmlContent: z.string().min(1),
      }).parse(req.body);

      const { getSendGridClient } = await import('./services/email-service');
      const { client, fromEmail } = await getSendGridClient();

      const bodyHtml = payload.message
        ? `<p style="font-family: Arial, sans-serif; color: #333; margin-bottom: 24px;">${payload.message.replace(/\n/g, '<br>')}</p><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />${payload.htmlContent}`
        : payload.htmlContent;

      const msg = {
        to: payload.to,
        from: {
          email: fromEmail,
          name: 'Vantage Reports',
        },
        subject: payload.subject,
        html: bodyHtml,
        text: `${payload.message || 'Please see the attached report.'}\n\n(This report is best viewed in an HTML-capable email client.)`,
      };

      await client.send(msg);

      res.json({ success: true, message: `Report emailed to ${payload.to.length} recipient(s)` });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error('Error sending report email:', error);
      res.status(500).json({ error: error.message || 'Failed to send email' });
    }
  });

  return httpServer;
}

// Helper function to generate QuickBooks CSV preview
function generateQuickBooksPreview(sales: any[], accountMappings: any, format: string) {
  const grouped = groupSalesByDateAndType(sales);
  const preview = [];

  for (const group of grouped.slice(0, 5)) {
    const fuelTypeMap: Record<string, string> = {
      'diesel': accountMappings.diesel,
      'regular_gas': accountMappings.regularGas,
      'premium_gas': accountMappings.premiumGas,
      'ethanol_free': accountMappings.ethanolFree,
    };

    const revenueAccount = fuelTypeMap[group.fuelType] || '4000';
    const arAccount = accountMappings.accountsReceivable || '1200';
    const amount = parseFloat(group.totalAmount).toFixed(2);
    const fuelTypeName = group.fuelType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const memo = `Fuel Sales - ${fuelTypeName} (${group.count} transactions)`;

    preview.push({
      date: group.date,
      account: arAccount,
      debit: amount,
      credit: '',
      memo,
      name: 'Marina Operations',
      class: 'Fuel',
    });

    preview.push({
      date: group.date,
      account: revenueAccount,
      debit: '',
      credit: amount,
      memo,
      name: 'Marina Operations',
      class: 'Fuel',
    });
  }

  return preview;
}

// Helper function to generate QuickBooks CSV
function generateQuickBooksCSV(sales: any[], accountMappings: any, format: string): string {
  const grouped = groupSalesByDateAndType(sales);
  const rows = [];

  rows.push('Date,Account,Debit,Credit,Memo,Name,Class');

  for (const group of grouped) {
    const fuelTypeMap: Record<string, string> = {
      'diesel': accountMappings.diesel,
      'regular_gas': accountMappings.regularGas,
      'premium_gas': accountMappings.premiumGas,
      'ethanol_free': accountMappings.ethanolFree,
    };

    const revenueAccount = fuelTypeMap[group.fuelType] || '4000';
    const arAccount = accountMappings.accountsReceivable || '1200';
    const amount = parseFloat(group.totalAmount).toFixed(2);
    const fuelTypeName = group.fuelType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const memo = `Fuel Sales - ${fuelTypeName} (${group.count} transactions)`;

    rows.push(`${group.date},${arAccount},${amount},,${memo},Marina Operations,Fuel`);
    rows.push(`${group.date},${revenueAccount},,${amount},${memo},Marina Operations,Fuel`);
  }

  return rows.join('\n');
}

// Helper function to group sales by date and fuel type
function groupSalesByDateAndType(sales: any[]): Array<{
  date: string;
  fuelType: string;
  totalAmount: string;
  gallons: string;
  count: number;
}> {
  const groups: Record<string, any> = {};

  for (const sale of sales) {
    const date = new Date(sale.transactionDate).toISOString().split('T')[0];
    const key = `${date}_${sale.fuelType}`;

    if (!groups[key]) {
      groups[key] = {
        date,
        fuelType: sale.fuelType,
        totalAmount: '0',
        gallons: '0',
        count: 0,
      };
    }

    groups[key].totalAmount = (parseFloat(groups[key].totalAmount) + parseFloat(sale.totalAmount)).toFixed(2);
    groups[key].gallons = (parseFloat(groups[key].gallons) + parseFloat(sale.quantityGallons)).toFixed(2);
    groups[key].count += 1;
  }

  return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
}

// Helper function to generate ICS format
function generateICS(events: Array<{
  id: string;
  summary: string;
  description: string;
  start: Date | string | null;
  end: Date | string | null;
  type: 'activity' | 'task';
}>): string {
  const formatDate = (date: Date | string | null): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const formatDateOnly = (date: Date | string | null): string => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0].replace(/-/g, '');
  };

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vantage//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    if (!event.start) continue;

    const isAllDay = event.type === 'task';
    
    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${event.id}@vantage.com`);
    ics.push(`DTSTAMP:${now}`);
    
    if (isAllDay) {
      ics.push(`DTSTART;VALUE=DATE:${formatDateOnly(event.start)}`);
      ics.push(`DTEND;VALUE=DATE:${formatDateOnly(event.end)}`);
    } else {
      ics.push(`DTSTART:${formatDate(event.start)}`);
      ics.push(`DTEND:${formatDate(event.end)}`);
    }
    
    ics.push(`SUMMARY:${event.summary.replace(/\n/g, '\\n')}`);
    
    if (event.description) {
      ics.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
    }
    
    ics.push('STATUS:CONFIRMED');
    ics.push('END:VEVENT');
  }

  ics.push('END:VCALENDAR');

  return ics.join('\r\n');
}

// Helper function to generate suggested column mappings based on header names
function generateSuggestedMappings(headers: string[], targetModule: 'salesComps' | 'rateComps' | 'marinaDatabase') {
  const mappings: Array<{ sourceColumn: string; targetField: string; confidence: number }> = [];

  const targetFieldMappings: Record<string, string[]> = {
    marina: ['marina', 'marina name', 'name', 'property', 'property name', 'facility'],
    city: ['city', 'town', 'municipality'],
    state: ['state', 'st', 'province'],
    saleDate: ['sale date', 'date', 'closing date', 'transaction date', 'sold date'],
    salePrice: ['sale price', 'price', 'purchase price', 'amount', 'total'],
    seller: ['seller', 'vendor', 'sold by'],
    buyer: ['buyer', 'purchaser', 'bought by'],
    wetSlips: ['wet slips', 'wet', 'slips', 'boat slips'],
    drySlips: ['dry slips', 'dry', 'dry storage', 'dry stacks'],
    moorings: ['moorings', 'mooring'],
    capRate: ['cap rate', 'cap', 'capitalization rate'],
    noi: ['noi', 'net operating income', 'net income'],
    grossRevenue: ['gross revenue', 'revenue', 'gross income', 'income'],
    occupancy: ['occupancy', 'occupancy rate', 'occ'],
    waterType: ['water type', 'water', 'freshwater', 'saltwater'],
    bodyOfWater: ['body of water', 'lake', 'river', 'ocean', 'bay', 'waterway'],
    transactionType: ['transaction type', 'type', 'sale type'],
    broker: ['broker', 'agent', 'realtor'],
    notes: ['notes', 'comments', 'description', 'remarks'],
    storageType: ['storage type', 'storage', 'slip type'],
    boatLengthMin: ['min length', 'minimum length', 'loa min', 'min boat'],
    boatLengthMax: ['max length', 'maximum length', 'loa max', 'max boat'],
    rateAmount: ['rate', 'rate amount', 'price', 'amount', 'cost'],
    rateType: ['rate type', 'unit', 'per'],
    ratePeriod: ['period', 'rate period', 'billing period'],
    seasonality: ['season', 'seasonality', 'seasonal'],
    electricIncluded: ['electric', 'electricity', 'electric included', 'power'],
    protectionLevel: ['protection', 'protection level', 'covered', 'enclosed'],
    effectiveDate: ['effective date', 'date', 'as of', 'valid date'],
    address: ['address', 'street', 'location'],
    zipCode: ['zip', 'zip code', 'postal code', 'postal'],
    latitude: ['lat', 'latitude'],
    longitude: ['lng', 'lon', 'longitude'],
    website: ['website', 'web', 'url', 'site'],
    phone: ['phone', 'telephone', 'tel', 'contact'],
    email: ['email', 'e-mail', 'mail'],
  };

  const usedTargets = new Set<string>();

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim();

    for (const [targetField, keywords] of Object.entries(targetFieldMappings)) {
      if (usedTargets.has(targetField)) continue;

      const match = keywords.some(keyword => {
        const normalizedKeyword = keyword.toLowerCase();
        return normalizedHeader === normalizedKeyword ||
               normalizedHeader.includes(normalizedKeyword) ||
               normalizedKeyword.includes(normalizedHeader);
      });

      if (match) {
        mappings.push({
          sourceColumn: header,
          targetField,
          confidence: normalizedHeader === keywords[0] ? 0.95 : 0.8,
        });
        usedTargets.add(targetField);
        break;
      }
    }
  }

  return mappings;
}

// Helper function to transform values for specific field types
function transformValue(value: string, fieldName: string): any {
  if (!value || value === '') return null;

  const currencyFields = ['salePrice', 'noi', 'grossRevenue', 'rateAmount'];
  const percentFields = ['capRate', 'occupancy'];
  const numberFields = ['wetSlips', 'drySlips', 'moorings', 'boatLengthMin', 'boatLengthMax', 'latitude', 'longitude'];
  const booleanFields = ['electricIncluded'];
  const dateFields = ['saleDate', 'effectiveDate'];

  if (currencyFields.includes(fieldName)) {
    const cleanedValue = String(value).replace(/[$,\s]/g, '');
    const numValue = parseFloat(cleanedValue);
    if (!isNaN(numValue)) {
      return Math.round(numValue * 100);
    }
    return null;
  }

  if (percentFields.includes(fieldName)) {
    const cleanedValue = String(value).replace(/[%\s]/g, '');
    const numValue = parseFloat(cleanedValue);
    if (!isNaN(numValue)) {
      return numValue > 1 ? numValue : numValue * 100;
    }
    return null;
  }

  if (numberFields.includes(fieldName)) {
    const numValue = parseFloat(String(value).replace(/[,\s]/g, ''));
    return isNaN(numValue) ? null : numValue;
  }

  if (booleanFields.includes(fieldName)) {
    const lowerValue = String(value).toLowerCase().trim();
    return ['yes', 'true', '1', 'y', 'included'].includes(lowerValue);
  }

  if (dateFields.includes(fieldName)) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // Return as-is if not a valid date
    }
    return value;
  }

  return String(value).trim();
}
// Force reload Sat Dec 27 06:56:26 PM UTC 2025
