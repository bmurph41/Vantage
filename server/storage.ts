import { 
  organizations, users, projects, projectSettings, tasks, 
  projectTemplates, auditLogs, timelineNotes, projectShares, risks,
  contacts, projectContacts, projectPendingContacts, notificationSubscriptions, notificationsLog, calendarEvents,
  documentRequirements, projectIntegrations, taskDependencies, taskFiles, userEmails, calendarGuests,
  cddDocuments, docPages, kpis, findings, recommendations, vectorChunks, cddReports, comps, checklistItems,
  crmDeals, crmLeads, crmContacts, crmCompanies, crmProperties, crmContactProperties, crmCompanyProperties, pendingProperties, pendingContacts, pendingCompanies, crmPipelines, crmPipelineStages, crmActivities, crmDealContacts, crmDealCompanies,
  crmImportJobs, crmImportedRecords, crmProspectingEntries, crmProspectingUserSettings, crmProspectingGoalTemplates,
  crmEmailSequences, crmEmailTemplates, crmEmailSequenceSteps, crmEmailSequenceEnrollments, crmEmailSequenceStepExecutions,
  calendarSettings,
  salesComps, compColumns, compImports, scProjects, scProjectComps, scAuditLog, scRecommendationFeedback, scOrgPreferences, scSavedSearches, scAnalyticsFilterPresets, scCustomStorageTypes, scPortfolios, scPortfolioComps, scPendingPropertyProfiles, scDuplicateAuditLog, scMetricSeries, scMetricPoints, scMetricAlerts,
  rateComps, rateCompColumns, rateCompImports, rcProjects, rcProjectComps, rcAuditLog, rcRecommendationFeedback, rcOrgPreferences, rcSavedSearches, rcCustomStorageTypes, rcPortfolios, rcPortfolioComps, rcPendingPropertyProfiles, rcMetricSeries, rcMetricPoints, rcMetricAlerts, rateTiers,
  fuelIntegrations, fuelImportLogs, debtScenarios, modelingRegions, modelingProjects,
  vdrFolders, vdrDocuments, vdrDocumentPermissions, vdrWatermarks, vdrAuditLogs,
  diligenceRequests, requestDocuments, requestComments, requestTemplates,
  externalUsers, externalUserProjectAccess,
  docktalkDeals,
  exitScenarios, exitTaxCalculations, exitSellerFinancing, exitEarnouts, exit1031Exchanges,
  exitDstAnalyses, exitFunds, exitWaterfallStructures, exitInvestors, exitCashFlows, exitActivities,
  type Organization, type User, type Project, type ProjectSettings, 
  type DDTask, type ProjectTemplate, type AuditLog,
  type TimelineNote, type ProjectShare, type Risk, type DDContact, type ProjectContact, type ProjectPendingContact, type NotificationSubscription, type NotificationLog, type CalendarEvent,
  type DocumentRequirement, type ProjectIntegration, type TaskDependency, type TaskFile, type UserEmail, type CalendarGuest,
  type CddDocument, type DocPage, type Kpi, type Finding, type Recommendation, type VectorChunk, type CddReport, type Comp, type ChecklistItem,
  type CrmDeal, type CrmLead, type CrmContact, type CrmCompany, type Property, type PendingProperty, type PendingContact, type PendingCompany, type CrmPipeline, type CrmPipelineStage, type CrmActivity,
  type CrmImportJob, type CrmImportedRecord, type ProspectingEntry, type CrmProspectingUserSettings, type CrmProspectingGoalTemplate,
  type EmailSequence, type EmailTemplate, type EmailSequenceStep, type EmailSequenceEnrollment, type EmailSequenceStepExecution,
  type CalendarSettings,
  type SalesComp, type CompColumn, type CompImport, type ScProject, type ScProjectComp, type ScAuditLog, type ScRecommendationFeedback, type ScOrgPreferences, type ScSavedSearch, type ScAnalyticsFilterPreset, type ScCustomStorageType, type ScPendingPropertyProfile, type ScDuplicateAuditLog, type ScMetricSeries, type ScMetricPoint, type ScMetricAlert,
  type RateComp, type RateCompColumn, type RateCompImport, type RcProject, type RcProjectComp, type RcAuditLog, type RcRecommendationFeedback, type RcOrgPreferences, type RcSavedSearch, type RcCustomStorageType, type RcPendingPropertyProfile, type RcMetricSeries, type RcMetricPoint, type RcMetricAlert,
  type FuelIntegration, type FuelImportLog,
  type DebtScenario, type InsertDebtScenario, type UpdateDebtScenario,
  type VdrFolder, type VdrDocument, type VdrDocumentPermission, type VdrWatermark, type VdrAuditLog,
  type DiligenceRequest, type RequestDocument, type RequestComment, type RequestTemplate,
  type ExternalUser, type ExternalUserProjectAccess,
  type DocktalkDeal, type InsertDocktalkDeal, type UpdateDocktalkDeal,
  type InsertOrganization, type InsertUser, type InsertProject, 
  type InsertProjectSettings, type InsertDDTask,
  type InsertProjectTemplate, type InsertAuditLog, type InsertTimelineNote, type InsertProjectShare, type InsertRisk,
  type InsertDDContact, type UpdateDDContact, type InsertProjectContact, type InsertProjectPendingContact, type InsertNotificationSubscription, type InsertNotificationLog, type InsertCalendarEvent,
  type InsertDocumentRequirement, type InsertProjectIntegration, type InsertTaskDependency, type InsertTaskFile, type InsertUserEmail, type InsertCalendarGuest,
  type InsertCddDocument, type InsertDocPage, type InsertKpi, type InsertFinding, type InsertRecommendation, type InsertVectorChunk, type InsertCddReport, type InsertComp, type InsertChecklistItem,
  type InsertCrmDeal, type InsertCrmLead, type InsertCrmContact, type InsertCrmCompany, type InsertProperty, type InsertPendingProperty, type InsertPendingContact, type InsertPendingCompany, type InsertCrmPipeline, type InsertCrmPipelineStage, type InsertCrmActivity,
  type InsertCrmImportJob, type InsertCrmImportedRecord, type InsertProspectingEntry, type InsertCrmProspectingUserSettings, type InsertCrmProspectingGoalTemplate,
  type InsertEmailSequence, type InsertEmailTemplate, type InsertEmailSequenceStep, type InsertEmailSequenceEnrollment, type InsertEmailSequenceStepExecution,
  type InsertCalendarSettings,
  type InsertSalesComp, type UpdateSalesComp, type InsertCompColumn, type UpdateCompColumn, type InsertCompImport,
  type InsertScProject, type UpdateScProject, type InsertScProjectComp, type UpdateScProjectComp,
  type InsertScRecommendationFeedback, type InsertScOrgPreferences, type UpdateScOrgPreferences,
  type InsertScSavedSearch, type UpdateScSavedSearch, type InsertScAnalyticsFilterPreset, type UpdateScAnalyticsFilterPreset, type InsertScCustomStorageType, type InsertScPendingPropertyProfile, type InsertScDuplicateAuditLog,
  type InsertScMetricSeries, type UpdateScMetricSeries, type InsertScMetricPoint, type InsertScMetricAlert, type UpdateScMetricAlert,
  type InsertRateComp, type UpdateRateComp, type InsertRateCompColumn, type UpdateRateCompColumn, type InsertRateCompImport,
  type InsertRcProject, type UpdateRcProject, type InsertRcProjectComp, type UpdateRcProjectComp,
  type InsertRcRecommendationFeedback, type InsertRcOrgPreferences, type UpdateRcOrgPreferences,
  type InsertRcSavedSearch, type UpdateRcSavedSearch, type InsertRcCustomStorageType, type InsertRcPendingPropertyProfile,
  type InsertRcMetricSeries, type UpdateRcMetricSeries, type InsertRcMetricPoint, type InsertRcMetricAlert, type UpdateRcMetricAlert,
  type RateTier, type InsertRateTier, type UpdateRateTier, type RateCompWithTiers,
  marinaRateDatabase, marinaRates,
  type MarinaRateDatabase, type InsertMarinaRateDatabase, type UpdateMarinaRateDatabase,
  type MarinaRate, type InsertMarinaRate, type UpdateMarinaRate, type MarinaWithRates,
  type InsertFuelIntegration, type UpdateFuelIntegration, type InsertFuelImportLog,
  type InsertVdrFolder, type InsertVdrDocument, type InsertVdrDocumentPermission, type InsertVdrWatermark, type InsertVdrAuditLog,
  type InsertDiligenceRequest, type InsertRequestDocument, type InsertRequestComment, type InsertRequestTemplate,
  type InsertExternalUser, type InsertExternalUserProjectAccess,
  type ModelingRegion, type InsertModelingRegion, type UpdateModelingRegion,
  type ModelingProject, type InsertModelingProject, type UpdateModelingProject,
  modelingFinancialPeriods, type ModelingFinancialPeriod, type InsertModelingFinancialPeriod, type UpdateModelingFinancialPeriod,
  modelingPeriodAdjustments, type ModelingPeriodAdjustment, type InsertModelingPeriodAdjustment, type UpdateModelingPeriodAdjustment,
  modelingActuals, type ModelingActuals,
  type ExitScenario, type InsertExitScenario, type UpdateExitScenario,
  type ExitTaxCalculation, type InsertExitTaxCalculation, type UpdateExitTaxCalculation,
  type ExitSellerFinancing, type InsertExitSellerFinancing, type UpdateExitSellerFinancing,
  type ExitEarnout, type InsertExitEarnout, type UpdateExitEarnout,
  type Exit1031Exchange, type InsertExit1031Exchange, type UpdateExit1031Exchange,
  type ExitDstAnalysis, type InsertExitDstAnalysis, type UpdateExitDstAnalysis,
  type ExitFund, type InsertExitFund, type UpdateExitFund,
  type ExitWaterfallStructure, type InsertExitWaterfallStructure, type UpdateExitWaterfallStructure,
  type ExitInvestor, type InsertExitInvestor, type UpdateExitInvestor,
  type ExitCashFlow, type InsertExitCashFlow,
  type ExitActivity, type InsertExitActivity
} from "@shared/schema";
import { organizationFeatures, type OrganizationFeature } from "@shared/docktalk-schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray, isNull, isNotNull, or, count, ilike } from "drizzle-orm";
import { VdrStorage } from "./vdr-storage";
import { VdrPermissionService } from "./vdr-permission-service";

export interface IStorage {
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganizationFeatures(orgId: string): Promise<OrganizationFeature[]>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjectsForOrg(orgId: string): Promise<Project[]>;
  getAllActiveProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Project Settings
  getProjectSettings(projectId: string): Promise<ProjectSettings | undefined>;
  createProjectSettings(settings: InsertProjectSettings): Promise<ProjectSettings>;
  updateProjectSettings(projectId: string, updates: Partial<InsertProjectSettings>): Promise<ProjectSettings>;

  // Tasks
  getTask(id: string): Promise<DDTask | undefined>;
  getTasksForProject(projectId: string, includeArchived?: boolean): Promise<DDTask[]>;
  getProjectAssignees(projectId: string): Promise<string[]>;
  createTask(task: InsertDDTask): Promise<DDTask>;
  updateTask(id: string, updates: Partial<InsertDDTask>): Promise<DDTask>;
  deleteTask(id: string): Promise<void>;

  // Task Files
  getTaskFile(id: string): Promise<TaskFile | undefined>;
  getTaskFilesForTask(taskId: string): Promise<TaskFile[]>;
  createTaskFile(file: InsertTaskFile): Promise<TaskFile>;
  deleteTaskFile(id: string): Promise<void>;

  // Project Shares
  getProjectShare(shareToken: string): Promise<ProjectShare | undefined>;
  getProjectShares(projectId: string): Promise<ProjectShare[]>;
  createProjectShare(share: InsertProjectShare): Promise<ProjectShare>;
  updateProjectShare(id: string, updates: Partial<InsertProjectShare>): Promise<ProjectShare>;
  deleteProjectShare(id: string): Promise<void>;


  // Project Templates
  getProjectTemplate(id: string): Promise<ProjectTemplate | undefined>;
  getProjectTemplatesForOrg(orgId: string): Promise<ProjectTemplate[]>;
  createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate>;

  // Timeline Notes
  getTimelineNotesForTask(taskId: string): Promise<TimelineNote[]>;
  createTimelineNote(note: InsertTimelineNote): Promise<TimelineNote>;
  updateTimelineNote(id: string, updates: Partial<InsertTimelineNote>): Promise<TimelineNote>;
  deleteTimelineNote(id: string): Promise<void>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsForProject(projectId: string): Promise<AuditLog[]>;
  getAuditLogsForOrg(orgId: string, filters?: {
    action?: string;
    entityType?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLog[]>;

  // Risk Management
  getRisk(id: string): Promise<Risk | undefined>;
  getRisksForProject(projectId: string): Promise<Risk[]>;
  getHighestRisksByScore(projectId: string, limit?: number): Promise<Risk[]>;
  getRisksByCategory(projectId: string, category: string): Promise<Risk[]>;
  getRisksByStatus(projectId: string, status: string): Promise<Risk[]>;
  createRisk(risk: InsertRisk): Promise<Risk>;
  updateRisk(id: string, updates: Partial<InsertRisk>): Promise<Risk>;
  deleteRisk(id: string): Promise<void>;
  bulkUpdateRiskScores(projectId: string): Promise<void>;
  
  // Risk Analytics
  getProjectRiskSummary(projectId: string): Promise<{
    totalRisks: number;
    risksBySeverity: { high: number; medium: number; low: number };
    totalCostAtRisk: number;
    totalScheduleAtRisk: number;
    categoryDistribution: Array<{ category: string; count: number; avgScore: number }>;
  }>;

  // Dependency Validation
  hasCircularDependency(projectId: string, taskId: string, dependencies: string[]): Promise<boolean>;

  // Enhanced Task Dependencies (CPM Support)
  getTaskDependency(id: string): Promise<TaskDependency | undefined>;
  getTaskDependencies(taskId: string): Promise<TaskDependency[]>;
  getTaskDependenciesForProject(projectId: string): Promise<TaskDependency[]>;
  createTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency>;
  updateTaskDependency(id: string, updates: Partial<InsertTaskDependency>): Promise<TaskDependency>;
  deleteTaskDependency(id: string): Promise<void>;
  deleteTaskDependencies(taskId: string): Promise<void>;

  // Contact Management
  createContact(contact: InsertDDContact): Promise<DDContact>;
  getContactsByOrg(orgId: string): Promise<DDContact[]>;
  getContactById(id: string): Promise<DDContact | undefined>;
  updateContact(id: string, updates: UpdateDDContact): Promise<DDContact>;
  deleteContact(id: string): Promise<void>;
  
  // Project-Contact Associations
  addContactToProject(projectContact: InsertProjectContact): Promise<ProjectContact>;
  getProjectContacts(projectId: string): Promise<Array<ProjectContact & { contact: DDContact }>>;
  removeContactFromProject(projectId: string, contactId: string, role: string): Promise<void>;

  // Notification Subscription Management
  createSubscription(subscription: InsertNotificationSubscription): Promise<NotificationSubscription>;
  getSubscriptionsByProject(projectId: string): Promise<NotificationSubscription[]>;
  getSubscriptionsByTask(taskId: string): Promise<NotificationSubscription[]>;
  getSubscriptionsByRecipient(recipientType: "user" | "contact", recipientId: string): Promise<NotificationSubscription[]>;
  updateSubscription(id: string, updates: Partial<InsertNotificationSubscription>): Promise<NotificationSubscription>;
  deleteSubscription(id: string): Promise<void>;

  // Notification Logging & De-duplication
  createNotificationLog(notification: InsertNotificationLog): Promise<NotificationLog>;
  checkNotificationExists(
    projectId: string, 
    taskId: string | null, 
    event: string, 
    channel: string,
    recipientType: "user" | "contact", 
    recipientId: string, 
    leadOffsetDays: number
  ): Promise<boolean>;
  getNotificationHistory(projectId: string, taskId?: string): Promise<NotificationLog[]>;
  getScheduledNotifications(beforeDate: Date): Promise<NotificationLog[]>;
  markNotificationSent(notificationId: string, sentAt: Date, providerMessageId?: string): Promise<NotificationLog>;

  // Test Notification Support
  sendTestNotification(recipientEmail: string, templateType: string): Promise<boolean>;
  validateNotificationChannels(channels: string[]): Promise<{ valid: boolean; errors: string[] }>;

  // Calendar Events Management
  getCalendarEvent(id: string): Promise<CalendarEvent | undefined>;
  getProjectCalendarEvents(projectId: string, filters?: {
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    isCompleted?: boolean;
  }): Promise<CalendarEvent[]>;
  getEventsByType(projectId: string, eventType: string): Promise<CalendarEvent[]>;
  getEventsByDateRange(projectId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  deleteCalendarEvent(id: string): Promise<void>;
  syncProjectEvents(projectId: string): Promise<CalendarEvent[]>;
  validateEventSelection(eventIds: string[]): Promise<{ valid: boolean; invalidIds: string[] }>;

  // ICS Generation
  generateICSFile(events: CalendarEvent[]): Promise<string>;
  generateProjectICS(projectId: string, filters?: {
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<string>;

  // Document Requirements CRUD
  createDocumentRequirement(requirement: InsertDocumentRequirement): Promise<DocumentRequirement>;
  getDocumentRequirement(id: string): Promise<DocumentRequirement | undefined>;
  updateDocumentRequirement(id: string, updates: Partial<InsertDocumentRequirement>): Promise<DocumentRequirement>;
  deleteDocumentRequirement(id: string): Promise<void>;
  getDocumentRequirementsByTask(taskId: string): Promise<DocumentRequirement[]>;
  getDocumentRequirementsByProject(projectId: string): Promise<DocumentRequirement[]>;
  bulkUpsertDocumentRequirements(projectId: string, taskId: string, requirements: Partial<InsertDocumentRequirement>[]): Promise<DocumentRequirement[]>;

  // Project Integrations CRUD
  createProjectIntegration(integration: InsertProjectIntegration): Promise<ProjectIntegration>;
  getProjectIntegration(id: string): Promise<ProjectIntegration | undefined>;
  getProjectIntegrationsByProject(projectId: string): Promise<ProjectIntegration[]>;
  updateProjectIntegration(id: string, updates: Partial<InsertProjectIntegration>): Promise<ProjectIntegration>;
  deleteProjectIntegration(id: string): Promise<void>;
  getProjectIntegrationByProvider(projectId: string, provider: string): Promise<ProjectIntegration | undefined>;
  updateLastSyncCursor(projectId: string, provider: string, lastSyncCursor: string): Promise<ProjectIntegration>;

  // Query methods
  getRequirementsByStatus(projectId: string, status: string): Promise<DocumentRequirement[]>;
  checkTaskCompletionGating(taskId: string): Promise<{ canComplete: boolean; unverifiedRequirements: DocumentRequirement[] }>;

  // Automatic Calendar Event Management
  syncTaskCalendarEvent(task: Task): Promise<CalendarEvent | null>;
  deleteTaskCalendarEvent(taskId: string): Promise<void>;
  updateTaskCalendarEvent(task: Task): Promise<CalendarEvent | null>;

  // User Email Management
  getUserEmails(userId: string): Promise<UserEmail[]>;
  createUserEmail(email: InsertUserEmail): Promise<UserEmail>;
  updateUserEmail(id: string, updates: Partial<InsertUserEmail>): Promise<UserEmail>;
  deleteUserEmail(id: string): Promise<void>;
  setDefaultUserEmail(userId: string, emailId: string): Promise<void>;

  // Calendar Guest Management
  getProjectGuests(projectId: string): Promise<CalendarGuest[]>;
  createCalendarGuest(guest: InsertCalendarGuest): Promise<CalendarGuest>;
  updateCalendarGuest(id: string, updates: Partial<InsertCalendarGuest>): Promise<CalendarGuest>;
  deleteCalendarGuest(id: string): Promise<void>;
  updateGuestStatus(id: string, status: 'pending' | 'accepted' | 'declined'): Promise<CalendarGuest>;

  // CDD Documents
  getCddDocument(id: string): Promise<CddDocument | undefined>;
  getCddDocumentsForProject(projectId: string): Promise<CddDocument[]>;
  createCddDocument(document: InsertCddDocument): Promise<CddDocument>;
  updateCddDocument(id: string, updates: Partial<InsertCddDocument>): Promise<CddDocument>;
  deleteCddDocument(id: string): Promise<void>;

  // Document Pages
  getDocPagesForDocument(documentId: string): Promise<DocPage[]>;
  createDocPages(pages: InsertDocPage[]): Promise<DocPage[]>;
  deleteDocPagesForDocument(documentId: string): Promise<void>;

  // Vector Chunks
  getVectorChunksForDocument(documentId: string): Promise<VectorChunk[]>;
  createVectorChunks(chunks: InsertVectorChunk[]): Promise<VectorChunk[]>;
  deleteVectorChunksForDocument(documentId: string): Promise<void>;
  searchVectorChunks(projectId: string, queryEmbedding: number[], limit?: number): Promise<any[]>;

  // KPIs
  getKpi(id: string): Promise<Kpi | undefined>;
  getKpisForProject(projectId: string): Promise<Kpi[]>;
  createKpi(kpi: InsertKpi): Promise<Kpi>;
  updateKpi(id: string, updates: Partial<InsertKpi>): Promise<Kpi>;
  deleteKpi(id: string): Promise<void>;

  // Findings
  getFinding(id: string): Promise<Finding | undefined>;
  getFindingsForProject(projectId: string): Promise<Finding[]>;
  createFinding(finding: InsertFinding): Promise<Finding>;
  updateFinding(id: string, updates: Partial<InsertFinding>): Promise<Finding>;
  deleteFinding(id: string): Promise<void>;

  // Recommendations
  getRecommendation(id: string): Promise<Recommendation | undefined>;
  getRecommendationsForProject(projectId: string): Promise<Recommendation[]>;
  createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation>;
  updateRecommendation(id: string, updates: Partial<InsertRecommendation>): Promise<Recommendation>;
  deleteRecommendation(id: string): Promise<void>;

  // CDD Reports
  getCddReport(id: string): Promise<CddReport | undefined>;
  getCddReportsForProject(projectId: string): Promise<CddReport[]>;
  createCddReport(report: InsertCddReport): Promise<CddReport>;
  updateCddReport(id: string, updates: Partial<InsertCddReport>): Promise<CddReport>;
  deleteCddReport(id: string): Promise<void>;

  // CRM - Deals
  getCrmDeal(id: string): Promise<CrmDeal | undefined>;
  getCrmDealsForOrg(orgId: string): Promise<CrmDeal[]>;
  getCrmDealsForOrgPaginated(orgId: string, options: { page: number; pageSize: number; sortBy?: string; sortDir?: 'asc' | 'desc'; search?: string; stageId?: string }): Promise<{ data: CrmDeal[]; total: number; page: number; pageSize: number; totalPages: number }>;
  getCrmDealsByPipeline(pipelineId: string): Promise<CrmDeal[]>;
  getCrmDealsByStage(stageId: string): Promise<CrmDeal[]>;
  createCrmDeal(deal: InsertCrmDeal): Promise<CrmDeal>;
  updateCrmDeal(id: string, updates: Partial<InsertCrmDeal>): Promise<CrmDeal>;
  deleteCrmDeal(id: string): Promise<void>;

  // CRM - Deal-Contact Relationships (many-to-many with roles)
  getDealContacts(dealId: string): Promise<Array<{ id: string; dealId: string; contactId: string; role: string | null; isPrimary: boolean; notes: string | null; contact?: CrmContact }>>;
  addContactToDeal(dealId: string, contactId: string, role?: string, isPrimary?: boolean, notes?: string): Promise<{ id: string }>;
  updateDealContact(id: string, updates: { role?: string; isPrimary?: boolean; notes?: string }): Promise<{ id: string }>;
  removeContactFromDeal(id: string): Promise<void>;

  // CRM - Deal-Company Relationships (many-to-many with roles)
  getDealCompanies(dealId: string): Promise<Array<{ id: string; dealId: string; companyId: string; role: string | null; isPrimary: boolean; notes: string | null; company?: CrmCompany }>>;
  addCompanyToDeal(dealId: string, companyId: string, role?: string, isPrimary?: boolean, notes?: string): Promise<{ id: string }>;
  updateDealCompany(id: string, updates: { role?: string; isPrimary?: boolean; notes?: string }): Promise<{ id: string }>;
  removeCompanyFromDeal(id: string): Promise<void>;

  // CRM - Leads
  getCrmLead(id: string): Promise<CrmLead | undefined>;
  getCrmLeadsForOrg(orgId: string): Promise<CrmLead[]>;
  getCrmLeadsByStatus(orgId: string, status: string): Promise<CrmLead[]>;
  createCrmLead(lead: InsertCrmLead): Promise<CrmLead>;
  updateCrmLead(id: string, updates: Partial<InsertCrmLead>): Promise<CrmLead>;
  deleteCrmLead(id: string): Promise<void>;

  // CRM - Contacts
  getCrmContact(id: string): Promise<CrmContact | undefined>;
  getCrmContactsForOrg(orgId: string): Promise<CrmContact[]>;
  getCrmContactsForOrgPaginated(orgId: string, options: { page: number; pageSize: number; sortBy?: string; sortDir?: 'asc' | 'desc'; search?: string; companyId?: string }): Promise<{ data: CrmContact[]; total: number; page: number; pageSize: number; totalPages: number }>;
  getCrmContactsByCompany(companyId: string): Promise<CrmContact[]>;
  createCrmContact(contact: InsertCrmContact): Promise<CrmContact>;
  updateCrmContact(id: string, updates: Partial<InsertCrmContact>): Promise<CrmContact>;
  deleteCrmContact(id: string): Promise<void>;

  // CRM - Companies
  getCrmCompany(id: string): Promise<CrmCompany | undefined>;
  getCrmCompaniesForOrg(orgId: string): Promise<CrmCompany[]>;
  getCrmCompaniesForOrgPaginated(orgId: string, options: { page: number; pageSize: number; sortBy?: string; sortDir?: 'asc' | 'desc'; search?: string }): Promise<{ data: CrmCompany[]; total: number; page: number; pageSize: number; totalPages: number }>;
  createCrmCompany(company: InsertCrmCompany): Promise<CrmCompany>;
  updateCrmCompany(id: string, updates: Partial<InsertCrmCompany>): Promise<CrmCompany>;
  deleteCrmCompany(id: string): Promise<void>;

  // CRM - Properties
  getCrmProperty(id: string): Promise<Property | undefined>;
  getCrmPropertiesForOrg(orgId: string): Promise<Property[]>;
  createCrmProperty(property: InsertProperty): Promise<Property>;
  updateCrmProperty(id: string, updates: Partial<InsertProperty>): Promise<Property>;
  deleteCrmProperty(id: string): Promise<void>;
  
  // CRM - Property-Contact/Company Links
  getPropertyContacts(propertyId: string): Promise<Array<{ id: string; contactId: string; propertyId: string; relationship?: string | null; notes?: string | null; contact?: any }>>;
  getPropertyCompanies(propertyId: string): Promise<Array<{ id: string; companyId: string; propertyId: string; relationship?: string | null; notes?: string | null; company?: any }>>;
  linkPropertyToContact(propertyId: string, contactId: string, relationship?: string, notes?: string): Promise<{ id: string }>;
  linkPropertyToCompany(propertyId: string, companyId: string, relationship?: string, notes?: string): Promise<{ id: string }>;
  unlinkPropertyFromContact(linkId: string): Promise<void>;
  unlinkPropertyFromCompany(linkId: string): Promise<void>;

  // CRM - Contact Links
  getContactCompanies(contactId: string): Promise<Array<{ id: string; contactId: string; companyId: string; role?: string | null; isPrimary: boolean; company?: any }>>;
  getContactProperties(contactId: string): Promise<Array<{ id: string; contactId: string; propertyId: string; relationship?: string | null; property?: any }>>;
  unlinkContactFromProperty(linkId: string): Promise<void>;

  // CRM - Company Links
  getCompanyContacts(companyId: string): Promise<Array<{ id: string; contactId: string; companyId: string; role?: string | null; isPrimary: boolean; contact?: any }>>;
  getCompanyProperties(companyId: string): Promise<Array<{ id: string; companyId: string; propertyId: string; relationship?: string | null; property?: any }>>;
  unlinkCompanyFromProperty(linkId: string): Promise<void>;

  // CRM - Pending Contacts
  getPendingContact(id: string): Promise<PendingContact | undefined>;
  getPendingContactsForOrg(orgId: string): Promise<PendingContact[]>;
  createPendingContact(contact: InsertPendingContact): Promise<PendingContact>;
  acceptPendingContact(id: string, userId: string, mode: 'replace' | 'add_new'): Promise<CrmContact>;
  rejectPendingContact(id: string, userId: string): Promise<void>;

  // CRM - Pending Companies
  getPendingCompany(id: string): Promise<PendingCompany | undefined>;
  getPendingCompaniesForOrg(orgId: string): Promise<PendingCompany[]>;
  createPendingCompany(company: InsertPendingCompany): Promise<PendingCompany>;
  acceptPendingCompany(id: string, userId: string, mode: 'replace' | 'add_new'): Promise<CrmCompany>;
  rejectPendingCompany(id: string, userId: string): Promise<void>;

  // CRM - Pending Properties
  getPendingProperty(id: string): Promise<PendingProperty | undefined>;
  getPendingPropertiesForOrg(orgId: string): Promise<PendingProperty[]>;
  createPendingProperty(property: InsertPendingProperty): Promise<PendingProperty>;
  acceptPendingProperty(id: string, userId: string, mode: 'replace' | 'add_new'): Promise<Property>;
  rejectPendingProperty(id: string, userId: string): Promise<void>;

  // CRM - Pipelines
  getCrmPipeline(id: string): Promise<CrmPipeline | undefined>;
  getCrmPipelinesForOrg(orgId: string): Promise<CrmPipeline[]>;
  createCrmPipeline(pipeline: InsertCrmPipeline): Promise<CrmPipeline>;
  updateCrmPipeline(id: string, updates: Partial<InsertCrmPipeline>): Promise<CrmPipeline>;
  deleteCrmPipeline(id: string): Promise<void>;

  // CRM - Pipeline Stages
  getCrmPipelineStage(id: string): Promise<CrmPipelineStage | undefined>;
  getAllCrmPipelineStages(orgId: string): Promise<CrmPipelineStage[]>;
  getCrmPipelineStagesByPipeline(pipelineId: string): Promise<CrmPipelineStage[]>;
  createCrmPipelineStage(stage: InsertCrmPipelineStage): Promise<CrmPipelineStage>;
  updateCrmPipelineStage(id: string, updates: Partial<InsertCrmPipelineStage>): Promise<CrmPipelineStage>;
  deleteCrmPipelineStage(id: string): Promise<void>;

  // CRM - Activities
  getCrmActivity(id: string): Promise<CrmActivity | undefined>;
  getCrmActivitiesForOrg(orgId: string): Promise<CrmActivity[]>;
  getCrmActivitiesByDeal(dealId: string): Promise<CrmActivity[]>;
  getCrmActivitiesByLead(leadId: string): Promise<CrmActivity[]>;
  getCrmActivitiesByContact(contactId: string): Promise<CrmActivity[]>;
  createCrmActivity(activity: InsertCrmActivity): Promise<CrmActivity>;
  updateCrmActivity(id: string, updates: Partial<InsertCrmActivity>): Promise<CrmActivity>;
  deleteCrmActivity(id: string): Promise<void>;

  // CRM - Import Jobs
  getImportJob(id: string): Promise<CrmImportJob | undefined>;
  getImportJobsForOrg(ownerId: string): Promise<CrmImportJob[]>;
  createImportJob(job: InsertCrmImportJob): Promise<CrmImportJob>;
  updateImportJob(id: string, updates: Partial<InsertCrmImportJob>): Promise<CrmImportJob>;
  createImportedRecord(record: InsertCrmImportedRecord): Promise<CrmImportedRecord>;
  getImportedRecordsByJob(importJobId: string): Promise<CrmImportedRecord[]>;

  // CRM - Prospecting
  getProspectingEntry(id: string): Promise<ProspectingEntry | undefined>;
  getProspectingEntryByWeek(userId: string, year: number, quarter: number, weekNumber: number): Promise<ProspectingEntry | undefined>;
  getProspectingEntriesForUser(userId: string, year?: number): Promise<ProspectingEntry[]>;
  createProspectingEntry(entry: InsertProspectingEntry): Promise<ProspectingEntry>;
  updateProspectingEntry(id: string, updates: Partial<InsertProspectingEntry>): Promise<ProspectingEntry>;
  deleteProspectingEntry(id: string): Promise<void>;
  
  // CRM - Prospecting Settings
  getProspectingUserSettings(userId: string): Promise<CrmProspectingUserSettings | undefined>;
  createProspectingUserSettings(settings: InsertCrmProspectingUserSettings): Promise<CrmProspectingUserSettings>;
  updateProspectingUserSettings(userId: string, updates: Partial<InsertCrmProspectingUserSettings>): Promise<CrmProspectingUserSettings>;
  
  // CRM - Prospecting Goal Templates
  getProspectingGoalTemplates(userId: string): Promise<CrmProspectingGoalTemplate[]>;
  getProspectingGoalTemplate(id: string): Promise<CrmProspectingGoalTemplate | undefined>;
  createProspectingGoalTemplate(template: InsertCrmProspectingGoalTemplate): Promise<CrmProspectingGoalTemplate>;
  updateProspectingGoalTemplate(id: string, updates: Partial<InsertCrmProspectingGoalTemplate>): Promise<CrmProspectingGoalTemplate>;
  deleteProspectingGoalTemplate(id: string): Promise<void>;

  // Marketing Automation - Email Sequences
  getEmailSequence(id: string): Promise<EmailSequence | undefined>;
  getEmailSequencesForUser(userId: string): Promise<EmailSequence[]>;
  createEmailSequence(sequence: InsertEmailSequence): Promise<EmailSequence>;
  updateEmailSequence(id: string, updates: Partial<InsertEmailSequence>): Promise<EmailSequence>;
  deleteEmailSequence(id: string): Promise<void>;

  // Marketing Automation - Email Templates
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplatesForUser(userId: string): Promise<EmailTemplate[]>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate>;
  deleteEmailTemplate(id: string): Promise<void>;

  // Marketing Automation - Sequence Steps
  getEmailSequenceStep(id: string): Promise<EmailSequenceStep | undefined>;
  getEmailSequenceStepsBySequence(sequenceId: string): Promise<EmailSequenceStep[]>;
  createEmailSequenceStep(step: InsertEmailSequenceStep): Promise<EmailSequenceStep>;
  updateEmailSequenceStep(id: string, updates: Partial<InsertEmailSequenceStep>): Promise<EmailSequenceStep>;
  deleteEmailSequenceStep(id: string): Promise<void>;

  // Marketing Automation - Enrollments
  getEmailSequenceEnrollment(id: string): Promise<EmailSequenceEnrollment | undefined>;
  getEmailSequenceEnrollmentsForUser(userId: string): Promise<EmailSequenceEnrollment[]>;
  getEmailSequenceEnrollmentsBySequence(sequenceId: string): Promise<EmailSequenceEnrollment[]>;
  getEmailSequenceEnrollmentsByEntity(entityType: string, entityId: string): Promise<EmailSequenceEnrollment[]>;
  createEmailSequenceEnrollment(enrollment: InsertEmailSequenceEnrollment): Promise<EmailSequenceEnrollment>;
  updateEmailSequenceEnrollment(id: string, updates: Partial<InsertEmailSequenceEnrollment>): Promise<EmailSequenceEnrollment>;
  deleteEmailSequenceEnrollment(id: string): Promise<void>;

  // Marketing Automation - Step Executions
  getEmailSequenceStepExecution(id: string): Promise<EmailSequenceStepExecution | undefined>;
  getEmailSequenceStepExecutionsByEnrollment(enrollmentId: string): Promise<EmailSequenceStepExecution[]>;
  createEmailSequenceStepExecution(execution: InsertEmailSequenceStepExecution): Promise<EmailSequenceStepExecution>;
  updateEmailSequenceStepExecution(id: string, updates: Partial<InsertEmailSequenceStepExecution>): Promise<EmailSequenceStepExecution>;

  // Calendar Settings
  getCalendarSettings(userId: string): Promise<CalendarSettings | undefined>;
  createCalendarSettings(settings: InsertCalendarSettings): Promise<CalendarSettings>;
  updateCalendarSettings(userId: string, updates: Partial<InsertCalendarSettings>): Promise<CalendarSettings>;

  // SalesComps - Sales Comparables Operations
  getSalesComps(params: {
    orgId: string;
    filters?: Record<string, any>;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<{ comps: SalesComp[]; total: number }>;
  getAllSalesCompIds(orgId: string): Promise<string[]>;
  getColumnUniqueValues(orgId: string, column: string): Promise<string[]>;
  getSalesComp(id: string, orgId: string): Promise<SalesComp | undefined>;
  createSalesComp(comp: InsertSalesComp): Promise<SalesComp>;
  updateSalesComp(id: string, comp: UpdateSalesComp, orgId: string): Promise<SalesComp | undefined>;
  deleteSalesComp(id: string, orgId: string, deletedBy: string): Promise<boolean>;
  bulkUpdateSalesComps(ids: string[], updates: UpdateSalesComp, orgId: string): Promise<number>;
  bulkDeleteSalesComps(ids: string[], orgId: string, deletedBy: string): Promise<number>;
  findPortfoliosByOwner(orgId: string, ownerCompanyId: string, ownershipRole?: 'buyer' | 'seller'): Promise<SalesComp[]>;

  // SalesComps - Columns Management
  getCompColumns(orgId: string): Promise<CompColumn[]>;
  createCompColumn(column: InsertCompColumn): Promise<CompColumn>;
  updateCompColumn(id: string, column: UpdateCompColumn, orgId: string): Promise<CompColumn | undefined>;
  deleteCompColumn(id: string, orgId: string): Promise<boolean>;

  // SalesComps - Import Operations
  createCompImport(importData: InsertCompImport): Promise<CompImport>;
  getCompImport(id: string, orgId: string): Promise<CompImport | undefined>;
  updateCompImport(id: string, updates: Partial<CompImport>, orgId: string): Promise<CompImport | undefined>;

  // SalesComps - Duplicate Detection
  findPotentialDuplicates(orgId: string, marina: string, state?: string, saleYear?: number): Promise<SalesComp[]>;
  bulkFindCompsByLocation(orgId: string, rows: Array<{ marina?: string; city?: string; state?: string }>): Promise<SalesComp[]>;

  // SalesComps - Project Operations
  getScProjects(orgId: string, userId: string): Promise<ScProject[]>;
  getScProject(id: string, orgId: string): Promise<ScProject | undefined>;
  createScProject(data: InsertScProject): Promise<ScProject>;
  updateScProject(id: string, data: UpdateScProject, orgId: string): Promise<ScProject | undefined>;
  deleteScProject(id: string, orgId: string, deletedBy: string): Promise<boolean>;

  // SalesComps - Project-Comp Associations
  getScProjectComps(projectId: string, orgId: string): Promise<(ScProjectComp & { salesComp: SalesComp })[]>;
  addCompToScProject(projectId: string, salesCompId: string, orgId: string, userId: string): Promise<ScProjectComp>;
  removeCompFromScProject(projectId: string, salesCompId: string, orgId: string): Promise<boolean>;
  updateScProjectComp(id: string, data: UpdateScProjectComp, orgId: string): Promise<ScProjectComp | undefined>;

  // SalesComps - Audit Operations
  createScAuditLog(log: {
    orgId: string;
    userId: string;
    entity: string;
    entityId: string;
    action: string;
    before?: any;
    after?: any;
  }): Promise<ScAuditLog>;

  // SalesComps - Recommendation System
  getSalesCompsForRecommendation(params: {
    orgId: string;
    filters?: Record<string, any>;
  }): Promise<SalesComp[]>;

  // SalesComps - Recommendation Feedback
  createScRecommendationFeedback(feedback: InsertScRecommendationFeedback): Promise<ScRecommendationFeedback>;
  getScRecommendationFeedback(orgId: string, projectId?: string): Promise<ScRecommendationFeedback[]>;

  // SalesComps - Organization Preferences
  getScOrgPreferences(orgId: string, segmentKey: string): Promise<ScOrgPreferences | undefined>;
  upsertScOrgPreferences(preferences: InsertScOrgPreferences): Promise<ScOrgPreferences>;
  updateScOrgPreferences(orgId: string, segmentKey: string, updates: UpdateScOrgPreferences): Promise<ScOrgPreferences | undefined>;

  // SalesComps - Saved Searches
  getScSavedSearches(orgId: string, userId?: string): Promise<ScSavedSearch[]>;
  getScSavedSearch(id: string, orgId: string): Promise<ScSavedSearch | undefined>;
  createScSavedSearch(data: InsertScSavedSearch): Promise<ScSavedSearch>;
  updateScSavedSearch(id: string, data: UpdateScSavedSearch, orgId: string): Promise<ScSavedSearch | undefined>;
  deleteScSavedSearch(id: string, orgId: string, deletedBy: string): Promise<boolean>;
  incrementScSavedSearchUsage(id: string, orgId: string): Promise<void>;

  // SalesComps - Custom Storage Types
  getScCustomStorageTypes(orgId: string): Promise<ScCustomStorageType[]>;
  createScCustomStorageType(data: InsertScCustomStorageType): Promise<ScCustomStorageType>;
  deleteScCustomStorageType(id: string, orgId: string): Promise<boolean>;

  // SalesComps - Pending Property Profiles
  getPendingPropertyProfiles(orgId: string, status?: string): Promise<ScPendingPropertyProfile[]>;
  createPendingPropertyProfile(data: InsertScPendingPropertyProfile): Promise<ScPendingPropertyProfile>;
  updatePendingPropertyProfile(id: string, data: Partial<InsertScPendingPropertyProfile>): Promise<ScPendingPropertyProfile>;
  deletePendingPropertyProfile(id: string): Promise<boolean>;
  
  // Duplicate Audit Log
  createDuplicateAuditLog(data: InsertScDuplicateAuditLog): Promise<ScDuplicateAuditLog>;
  
  // CRM Properties - search by name/city/state
  findPropertyByLocation(orgId: string, marina: string, city?: string, state?: string): Promise<Property | undefined>;
  findSimilarProperties(orgId: string, marina: string, city?: string, state?: string): Promise<Property[]>;
  
  // CRM Companies - search by name
  findCompanyByName(orgId: string, companyName: string): Promise<CRMCompany | undefined>;
  findSimilarCompanies(orgId: string, companyName: string): Promise<CRMCompany[]>;
  
  // CRM Contacts - search by name
  findContactByName(orgId: string, contactName: string): Promise<CRMContact | undefined>;
  findSimilarContacts(orgId: string, contactName: string): Promise<CRMContact[]>;
  
  // Pending Properties - Review queue for properties created from comps
  getPendingProperties(orgId: string, status?: string): Promise<PendingProperty[]>;

  // DockTalk M&A Spotlight - Deal Tracking
  getDocktalkDeals(params: {
    orgId: string;
    origin?: 'marinaMatch' | 'aiExtraction';
    page?: number;
    pageSize?: number;
  }): Promise<{ deals: DocktalkDeal[]; total: number }>;
  getDocktalkDeal(id: string, orgId: string): Promise<DocktalkDeal | undefined>;
  getDocktalkDealByExternalId(externalId: string, orgId: string): Promise<DocktalkDeal | undefined>;
  createDocktalkDeal(deal: InsertDocktalkDeal): Promise<DocktalkDeal>;
  updateDocktalkDeal(id: string, deal: UpdateDocktalkDeal, orgId: string): Promise<DocktalkDeal | undefined>;
  deleteDocktalkDeal(id: string, orgId: string): Promise<boolean>;
  upsertDocktalkDealByExternalId(externalId: string, orgId: string, deal: InsertDocktalkDeal): Promise<DocktalkDeal>;
  getPendingProperty(id: string, orgId: string): Promise<PendingProperty | undefined>;
  createPendingProperty(data: InsertPendingProperty): Promise<PendingProperty>;
  acceptPendingProperty(id: string, orgId: string, userId: string): Promise<Property | undefined>;
  rejectPendingProperty(id: string, orgId: string, userId: string): Promise<boolean>;
  updatePendingProperty(id: string, orgId: string, updates: Partial<PendingProperty>): Promise<PendingProperty | undefined>;
  mergePendingPropertyWithExisting(pendingId: string, propertyId: string, orgId: string, userId: string): Promise<Property | undefined>;

  // Pending Contacts - Review queue for contacts created from sales comps or DD projects
  getPendingContacts(orgId: string, status?: string): Promise<PendingContact[]>;
  getPendingContact(id: string, orgId: string): Promise<PendingContact | undefined>;
  createPendingContact(data: InsertPendingContact): Promise<PendingContact>;
  acceptPendingContact(id: string, orgId: string, userId: string): Promise<CrmContact | undefined>;
  rejectPendingContact(id: string, orgId: string, userId: string): Promise<boolean>;
  updatePendingContact(id: string, orgId: string, updates: Partial<PendingContact>): Promise<PendingContact | undefined>;
  mergePendingContactWithExisting(pendingId: string, contactId: string, orgId: string, userId: string): Promise<CrmContact | undefined>;

  // Project Pending Contacts - Linking pending contacts to DD projects
  addPendingContactToProject(data: InsertProjectPendingContact): Promise<ProjectPendingContact>;
  getProjectPendingContacts(projectId: string): Promise<Array<ProjectPendingContact & { pendingContact: PendingContact }>>;
  removePendingContactFromProject(projectId: string, pendingContactId: string, role: string): Promise<void>;

  // Pending Companies - Review queue for companies created from sales comps or DD projects
  getPendingCompanies(orgId: string, status?: string): Promise<PendingCompany[]>;
  getPendingCompany(id: string, orgId: string): Promise<PendingCompany | undefined>;
  createPendingCompany(data: InsertPendingCompany): Promise<PendingCompany>;
  acceptPendingCompany(id: string, orgId: string, userId: string): Promise<CrmCompany | undefined>;
  rejectPendingCompany(id: string, orgId: string, userId: string): Promise<boolean>;
  updatePendingCompany(id: string, orgId: string, updates: Partial<PendingCompany>): Promise<PendingCompany | undefined>;
  mergePendingCompanyWithExisting(pendingId: string, companyId: string, orgId: string, userId: string): Promise<CrmCompany | undefined>;

  // Generic pending entity resolution (delegates to type-specific methods)
  mergePendingWithExisting(entityType: 'property' | 'contact' | 'company', pendingId: string, targetEntityId: string, orgId: string, userId: string): Promise<any>;
  rejectPendingEntity(entityType: 'property' | 'contact' | 'company', pendingId: string, orgId: string, userId: string): Promise<boolean>;
  acceptPendingEntity(entityType: 'property' | 'contact' | 'company', pendingId: string, orgId: string, userId: string): Promise<any>;

  // Auto-create pending records from sales comps with deduplication
  autoCreatePendingCompanyFromSalesComp(params: {
    salesCompId: string;
    orgId: string;
    userId: string;
    buyerCompany: string;
    city?: string;
    state?: string;
  }): Promise<{ created: boolean; pendingCompany?: PendingCompany; reason?: string }>;
  
  autoCreatePendingContactFromSalesComp(params: {
    salesCompId: string;
    orgId: string;
    userId: string;
    agentFirstName?: string;
    agentLastName?: string;
    brokerage?: string;
  }): Promise<{ created: boolean; pendingContact?: PendingContact; reason?: string }>;

  // RateComps - Rate Comparables Operations
  getRateComps(params: {
    orgId: string;
    filters?: Record<string, any>;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<{ comps: RateComp[]; total: number }>;
  getAllRateCompIds(orgId: string): Promise<string[]>;
  getRateCompColumnUniqueValues(orgId: string, column: string): Promise<string[]>;
  getRateComp(id: string, orgId: string): Promise<RateComp | undefined>;
  createRateComp(comp: InsertRateComp): Promise<RateComp>;
  updateRateComp(id: string, comp: UpdateRateComp, orgId: string): Promise<RateComp | undefined>;
  deleteRateComp(id: string, orgId: string, deletedBy: string): Promise<boolean>;
  bulkUpdateRateComps(ids: string[], updates: UpdateRateComp, orgId: string): Promise<number>;
  bulkDeleteRateComps(ids: string[], orgId: string, deletedBy: string): Promise<number>;

  // RateComps - Columns Management
  getRateCompColumns(orgId: string): Promise<RateCompColumn[]>;
  createRateCompColumn(column: InsertRateCompColumn): Promise<RateCompColumn>;
  updateRateCompColumn(id: string, column: UpdateRateCompColumn, orgId: string): Promise<RateCompColumn | undefined>;
  deleteRateCompColumn(id: string, orgId: string): Promise<boolean>;

  // RateComps - Import Operations
  createRateCompImport(importData: InsertRateCompImport): Promise<RateCompImport>;
  getRateCompImport(id: string, orgId: string): Promise<RateCompImport | undefined>;
  updateRateCompImport(id: string, updates: Partial<RateCompImport>, orgId: string): Promise<RateCompImport | undefined>;

  // RateComps - Duplicate Detection
  findPotentialRateCompDuplicates(orgId: string, marina: string, state?: string, saleYear?: number): Promise<RateComp[]>;

  // RateComps - Project Operations
  getRcProjects(orgId: string, userId: string): Promise<RcProject[]>;
  getRcProject(id: string, orgId: string): Promise<RcProject | undefined>;
  createRcProject(data: InsertRcProject): Promise<RcProject>;
  updateRcProject(id: string, data: UpdateRcProject, orgId: string): Promise<RcProject | undefined>;
  deleteRcProject(id: string, orgId: string, deletedBy: string): Promise<boolean>;

  // RateComps - Project-Comp Associations
  getRcProjectComps(projectId: string, orgId: string): Promise<(RcProjectComp & { rateComp: RateComp })[]>;
  addCompToRcProject(projectId: string, rateCompId: string, orgId: string, userId: string): Promise<RcProjectComp>;
  removeCompFromRcProject(projectId: string, rateCompId: string, orgId: string): Promise<boolean>;
  updateRcProjectComp(id: string, data: UpdateRcProjectComp, orgId: string): Promise<RcProjectComp | undefined>;

  // RateComps - Audit Operations
  createRcAuditLog(log: {
    orgId: string;
    userId: string;
    entity: string;
    entityId: string;
    action: string;
    before?: any;
    after?: any;
  }): Promise<RcAuditLog>;

  // RateComps - Recommendation System
  getRateCompsForRecommendation(params: {
    orgId: string;
    filters?: Record<string, any>;
  }): Promise<RateComp[]>;

  // RateComps - Recommendation Feedback
  createRcRecommendationFeedback(feedback: InsertRcRecommendationFeedback): Promise<RcRecommendationFeedback>;
  getRcRecommendationFeedback(orgId: string, projectId?: string): Promise<RcRecommendationFeedback[]>;

  // RateComps - Organization Preferences
  getRcOrgPreferences(orgId: string, segmentKey: string): Promise<RcOrgPreferences | undefined>;
  upsertRcOrgPreferences(preferences: InsertRcOrgPreferences): Promise<RcOrgPreferences>;
  updateRcOrgPreferences(orgId: string, segmentKey: string, updates: UpdateRcOrgPreferences): Promise<RcOrgPreferences | undefined>;

  // RateComps - Saved Searches
  getRcSavedSearches(orgId: string, userId?: string): Promise<RcSavedSearch[]>;
  getRcSavedSearch(id: string, orgId: string): Promise<RcSavedSearch | undefined>;
  createRcSavedSearch(data: InsertRcSavedSearch): Promise<RcSavedSearch>;
  updateRcSavedSearch(id: string, data: UpdateRcSavedSearch, orgId: string): Promise<RcSavedSearch | undefined>;
  deleteRcSavedSearch(id: string, orgId: string, deletedBy: string): Promise<boolean>;
  incrementRcSavedSearchUsage(id: string, orgId: string): Promise<void>;

  // RateComps - Custom Storage Types
  getRcCustomStorageTypes(orgId: string): Promise<RcCustomStorageType[]>;
  createRcCustomStorageType(data: InsertRcCustomStorageType): Promise<RcCustomStorageType>;
  deleteRcCustomStorageType(id: string, orgId: string): Promise<boolean>;

  // RateComps - Pending Property Profiles
  getRcPendingPropertyProfiles(orgId: string, status?: string): Promise<RcPendingPropertyProfile[]>;
  createRcPendingPropertyProfile(data: InsertRcPendingPropertyProfile): Promise<RcPendingPropertyProfile>;
  updateRcPendingPropertyProfile(id: string, data: Partial<InsertRcPendingPropertyProfile>): Promise<RcPendingPropertyProfile>;
  deleteRcPendingPropertyProfile(id: string): Promise<boolean>;

  // RateComps - Rate Tiers (flexible pricing tiers)
  getRateTiersByRateComp(rateCompId: string, orgId: string): Promise<RateTier[]>;
  getRateTiersByOrg(orgId: string, filters?: { storageType?: string; isCurrentRate?: boolean; loaRange?: { min?: number; max?: number } }): Promise<RateTier[]>;
  getRateTier(id: string, orgId: string): Promise<RateTier | undefined>;
  createRateTier(tier: InsertRateTier): Promise<RateTier>;
  updateRateTier(id: string, updates: UpdateRateTier, orgId: string): Promise<RateTier | undefined>;
  deleteRateTier(id: string, orgId: string): Promise<boolean>;
  bulkCreateRateTiers(tiers: InsertRateTier[]): Promise<RateTier[]>;
  getRateCompWithTiers(rateCompId: string, orgId: string): Promise<RateCompWithTiers | undefined>;
  getRateCompsWithTiers(orgId: string, filters?: Record<string, any>): Promise<RateCompWithTiers[]>;

  // Marina Rate Database - US Marina Registry with Historical Rate Tracking
  getMarinas(params: { orgId: string; filters?: Record<string, any>; sortBy?: string; sortDir?: 'asc' | 'desc'; page?: number; pageSize?: number }): Promise<{ marinas: MarinaRateDatabase[]; total: number }>;
  getMarina(id: string, orgId: string): Promise<MarinaRateDatabase | undefined>;
  createMarina(marina: InsertMarinaRateDatabase): Promise<MarinaRateDatabase>;
  updateMarina(id: string, updates: UpdateMarinaRateDatabase, orgId: string): Promise<MarinaRateDatabase | undefined>;
  deleteMarina(id: string, orgId: string): Promise<boolean>;
  getMarinaWithRates(id: string, orgId: string): Promise<MarinaWithRates | undefined>;
  searchMarinas(orgId: string, query: string, limit?: number): Promise<MarinaRateDatabase[]>;

  // Marina Rate History
  getMarinaRates(marinaId: string, orgId: string, filters?: { rateYear?: number; storageType?: string; isCurrentRate?: boolean }): Promise<MarinaRate[]>;
  getMarinaRate(id: string, orgId: string): Promise<MarinaRate | undefined>;
  createMarinaRate(rate: InsertMarinaRate): Promise<MarinaRate>;
  updateMarinaRate(id: string, updates: UpdateMarinaRate, orgId: string): Promise<MarinaRate | undefined>;
  deleteMarinaRate(id: string, orgId: string): Promise<boolean>;
  getMarinaRateHistory(marinaId: string, orgId: string, storageType?: string): Promise<MarinaRate[]>;
  getLatestMarinaRates(marinaId: string, orgId: string): Promise<MarinaRate[]>;
  bulkCreateMarinaRates(rates: InsertMarinaRate[]): Promise<MarinaRate[]>;
  markPreviousRatesHistorical(marinaId: string, storageType: string, rateYear: number, orgId: string): Promise<void>;

  // Fuel Integrations
  getFuelIntegration(orgId: string): Promise<FuelIntegration | undefined>;
  getFuelIntegrationById(id: string): Promise<FuelIntegration | undefined>;
  createFuelIntegration(data: InsertFuelIntegration): Promise<FuelIntegration>;
  updateFuelIntegration(id: string, data: UpdateFuelIntegration): Promise<FuelIntegration | undefined>;
  deleteFuelIntegration(id: string): Promise<boolean>;

  // Fuel Import Logs
  getFuelImportLogs(orgId: string, limit?: number): Promise<FuelImportLog[]>;
  getFuelImportLogsByIntegration(integrationId: string, limit?: number): Promise<FuelImportLog[]>;
  createFuelImportLog(data: InsertFuelImportLog): Promise<FuelImportLog>;
  updateFuelImportLog(id: string, data: Partial<InsertFuelImportLog>): Promise<FuelImportLog | undefined>;

  // Debt Scenarios
  getDebtScenario(id: string, orgId: string): Promise<DebtScenario | undefined>;
  getDebtScenarios(orgId: string): Promise<DebtScenario[]>;
  getDebtScenariosByProject(projectId: string, orgId: string): Promise<DebtScenario[]>;
  createDebtScenario(data: InsertDebtScenario): Promise<DebtScenario>;
  updateDebtScenario(id: string, updates: UpdateDebtScenario, orgId: string): Promise<DebtScenario | undefined>;
  deleteDebtScenario(id: string, orgId: string): Promise<boolean>;

  // Modeling Regions - Organization-specific customizable regions
  getModelingRegions(orgId: string): Promise<ModelingRegion[]>;
  createModelingRegion(data: InsertModelingRegion): Promise<ModelingRegion>;
  updateModelingRegion(id: string, data: UpdateModelingRegion, orgId: string): Promise<ModelingRegion | undefined>;
  deleteModelingRegion(id: string, orgId: string): Promise<boolean>;

  // Modeling Projects - Valuation & Financial Modeling
  getModelingProjects(orgId: string): Promise<ModelingProject[]>;
  getModelingProject(id: string, orgId: string): Promise<ModelingProject | undefined>;
  getModelingProjectsByBroker(brokerId: string, orgId: string): Promise<ModelingProject[]>;
  createModelingProject(data: InsertModelingProject): Promise<ModelingProject>;
  updateModelingProject(id: string, data: UpdateModelingProject, orgId: string): Promise<ModelingProject | undefined>;
  deleteModelingProject(id: string, orgId: string): Promise<boolean>;
  
  // Modeling Projects Analytics
  getModelingAnalytics(orgId: string, filters?: {
    region?: string;
    state?: string;
    dealOutcome?: string;
    brokerId?: string;
    minPrice?: number;
    maxPrice?: number;
    minSize?: number;
    maxSize?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalDeals: number;
    totalPurchasePrice: number;
    avgCapRate: number;
    avgEbitda: number;
    successRate: number;
    dealsByOutcome: Array<{ outcome: string; count: number }>;
    dealsByBroker: Array<{ brokerId: string; brokerName: string; count: number; totalValue: number }>;
    dealsByRegion: Array<{ region: string; count: number; totalValue: number }>;
  }>;

  // Modeling Financial Periods - Year-based financial summaries for pricing calculations
  getModelingFinancialPeriods(modelingProjectId: string, orgId: string): Promise<ModelingFinancialPeriod[]>;
  getModelingFinancialPeriod(id: string, orgId: string): Promise<ModelingFinancialPeriod | undefined>;
  getModelingFinancialPeriodByLabel(modelingProjectId: string, periodLabel: string, orgId: string): Promise<ModelingFinancialPeriod | undefined>;
  createModelingFinancialPeriod(data: InsertModelingFinancialPeriod): Promise<ModelingFinancialPeriod>;
  updateModelingFinancialPeriod(id: string, data: UpdateModelingFinancialPeriod, orgId: string): Promise<ModelingFinancialPeriod | undefined>;
  deleteModelingFinancialPeriod(id: string, orgId: string): Promise<boolean>;
  getAvailableFinancialPeriods(modelingProjectId: string, orgId: string): Promise<Array<{ periodType: string; periodLabel: string; periodYear: number | null }>>;

  // Exit Strategy Suite - Exit Scenarios
  getExitScenarios(modelingProjectId: string, orgId: string): Promise<ExitScenario[]>;
  getExitScenario(id: string, orgId: string): Promise<ExitScenario | undefined>;
  createExitScenario(data: InsertExitScenario & { orgId: string; createdBy?: string }): Promise<ExitScenario>;
  updateExitScenario(id: string, data: UpdateExitScenario & { updatedBy?: string }, orgId: string): Promise<ExitScenario | undefined>;
  deleteExitScenario(id: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - Tax Calculations
  getExitTaxCalculations(exitScenarioId: string, orgId: string): Promise<ExitTaxCalculation[]>;
  getExitTaxCalculation(id: string, orgId: string): Promise<ExitTaxCalculation | undefined>;
  createExitTaxCalculation(data: InsertExitTaxCalculation & { orgId: string }): Promise<ExitTaxCalculation>;
  updateExitTaxCalculation(id: string, data: UpdateExitTaxCalculation, orgId: string): Promise<ExitTaxCalculation | undefined>;
  deleteExitTaxCalculation(id: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - Seller Financing
  getExitSellerFinancing(exitScenarioId: string, orgId: string): Promise<ExitSellerFinancing[]>;
  getExitSellerFinancingById(id: string, orgId: string): Promise<ExitSellerFinancing | undefined>;
  createExitSellerFinancing(data: InsertExitSellerFinancing & { orgId: string }): Promise<ExitSellerFinancing>;
  updateExitSellerFinancing(id: string, data: UpdateExitSellerFinancing, orgId: string): Promise<ExitSellerFinancing | undefined>;
  deleteExitSellerFinancing(id: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - Earnouts
  getExitEarnouts(exitScenarioId: string, orgId: string): Promise<ExitEarnout[]>;
  getExitEarnout(id: string, orgId: string): Promise<ExitEarnout | undefined>;
  createExitEarnout(data: InsertExitEarnout & { orgId: string }): Promise<ExitEarnout>;
  updateExitEarnout(id: string, data: UpdateExitEarnout, orgId: string): Promise<ExitEarnout | undefined>;
  deleteExitEarnout(id: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - 1031 Exchanges
  getExit1031Exchanges(exitScenarioId: string, orgId: string): Promise<Exit1031Exchange[]>;
  getExit1031Exchange(id: string, orgId: string): Promise<Exit1031Exchange | undefined>;
  createExit1031Exchange(data: InsertExit1031Exchange & { orgId: string }): Promise<Exit1031Exchange>;
  updateExit1031Exchange(id: string, data: UpdateExit1031Exchange, orgId: string): Promise<Exit1031Exchange | undefined>;
  deleteExit1031Exchange(id: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - DST Analyses
  getExitDstAnalyses(exitScenarioId: string, orgId: string): Promise<ExitDstAnalysis[]>;
  getExitDstAnalysis(id: string, orgId: string): Promise<ExitDstAnalysis | undefined>;
  createExitDstAnalysis(data: InsertExitDstAnalysis & { orgId: string }): Promise<ExitDstAnalysis>;
  updateExitDstAnalysis(id: string, data: UpdateExitDstAnalysis, orgId: string): Promise<ExitDstAnalysis | undefined>;
  deleteExitDstAnalysis(id: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - Funds
  getExitFunds(orgId: string): Promise<ExitFund[]>;
  getExitFund(id: string, orgId: string): Promise<ExitFund | undefined>;
  createExitFund(data: InsertExitFund & { orgId: string }): Promise<ExitFund>;
  updateExitFund(id: string, data: UpdateExitFund, orgId: string): Promise<ExitFund | undefined>;
  deleteExitFund(id: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - Waterfall Structures
  getExitWaterfallStructures(exitScenarioId: string, orgId: string): Promise<ExitWaterfallStructure[]>;
  getExitWaterfallStructure(id: string, orgId: string): Promise<ExitWaterfallStructure | undefined>;
  createExitWaterfallStructure(data: InsertExitWaterfallStructure & { orgId: string }): Promise<ExitWaterfallStructure>;
  updateExitWaterfallStructure(id: string, data: UpdateExitWaterfallStructure, orgId: string): Promise<ExitWaterfallStructure | undefined>;
  deleteExitWaterfallStructure(id: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - Investors
  getExitInvestors(fundId: string, orgId: string): Promise<ExitInvestor[]>;
  getExitInvestor(id: string, orgId: string): Promise<ExitInvestor | undefined>;
  createExitInvestor(data: InsertExitInvestor & { orgId: string }): Promise<ExitInvestor>;
  updateExitInvestor(id: string, data: UpdateExitInvestor, orgId: string): Promise<ExitInvestor | undefined>;
  deleteExitInvestor(id: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - Cash Flows
  getExitCashFlows(exitScenarioId: string, orgId: string): Promise<ExitCashFlow[]>;
  createExitCashFlow(data: InsertExitCashFlow & { orgId: string }): Promise<ExitCashFlow>;
  deleteExitCashFlows(exitScenarioId: string, orgId: string): Promise<boolean>;

  // Exit Strategy Suite - Activities
  getExitActivities(exitScenarioId: string | null, modelingProjectId: string | null, orgId: string): Promise<ExitActivity[]>;
  createExitActivity(data: InsertExitActivity & { orgId: string }): Promise<ExitActivity>;

  // Virtual Data Room - Composed VDR storage access
  vdr: import("./vdr-storage").IVdrStorage;
}

export class DatabaseStorage implements IStorage {
  vdr: import("./vdr-storage").IVdrStorage;
  private permissionService: VdrPermissionService;

  constructor() {
    this.vdr = new VdrStorage();
    this.permissionService = new VdrPermissionService(this.vdr);
    
    if (this.vdr.permissions && 'setPermissionService' in this.vdr.permissions) {
      (this.vdr.permissions as any).setPermissionService(this.permissionService);
    }
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  async getOrganizationFeatures(orgId: string): Promise<OrganizationFeature[]> {
    return db
      .select()
      .from(organizationFeatures)
      .where(
        and(
          eq(organizationFeatures.orgId, orgId),
          eq(organizationFeatures.isActive, true)
        )
      );
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getProjectsForOrg(orgId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.orgId, orgId));
  }

  async getAllActiveProjects(): Promise<Project[]> {
    try {
      // Get all projects that have tasks with deadlines (indicating active projects)
      const activeProjects = await db
        .selectDistinct({
          id: projects.id,
          orgId: projects.orgId,
          name: projects.name,
          description: projects.description,
          anchorType: projects.anchorType,
          psaSignedDate: projects.psaSignedDate,
          ddExpirationDate: projects.ddExpirationDate,
          closingDate: projects.closingDate,
          ddPeriodDays: projects.ddPeriodDays,
          hasExtensions: projects.hasExtensions,
          extensionCount: projects.extensionCount,
          extensionDays: projects.extensionDays,
          daysToClosing: projects.daysToClosing,
          seller: projects.seller,
          ourAttorney: projects.ourAttorney,
          titleInsuranceCompany: projects.titleInsuranceCompany,
          lender: projects.lender,
          firstDepositAmount: projects.firstDepositAmount,
          firstDepositDueDate: projects.firstDepositDueDate,
          secondDepositAmount: projects.secondDepositAmount,
          secondDepositDueDate: projects.secondDepositDueDate,
          tz: projects.tz,
          executiveNotes: projects.executiveNotes,
          purchasePrice: projects.purchasePrice,
          estimatedRenovationCost: projects.estimatedRenovationCost,
          projectedAnnualRevenue: projects.projectedAnnualRevenue,
          investmentThesis: projects.investmentThesis,
          dealHealthScore: projects.dealHealthScore,
          healthScoreUpdatedAt: projects.healthScoreUpdatedAt,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .innerJoin(tasks, eq(projects.id, tasks.projectId))
        .where(
          and(
            sql`${tasks.deadline} IS NOT NULL`,
            sql`${tasks.status} != 'completed'`
          )
        );

      return activeProjects;
    } catch (error) {
      console.error('Failed to get active projects:', error);
      return [];
    }
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    // Delete related data first (cascade delete)
    await db.delete(auditLogs).where(eq(auditLogs.projectId, id));
    await db.delete(projectShares).where(eq(projectShares.projectId, id));
    await db.delete(calendarEvents).where(eq(calendarEvents.projectId, id));
    await db.delete(documentRequirements).where(eq(documentRequirements.projectId, id));
    await db.delete(projectIntegrations).where(eq(projectIntegrations.projectId, id));
    
    // Delete tasks for this project (timeline_notes will cascade delete automatically)
    await db.delete(tasks).where(eq(tasks.projectId, id));
    
    // Delete project settings
    await db.delete(projectSettings).where(eq(projectSettings.projectId, id));
    
    // Finally delete the project itself
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getProjectSettings(projectId: string): Promise<ProjectSettings | undefined> {
    const [settings] = await db.select().from(projectSettings).where(eq(projectSettings.projectId, projectId));
    return settings || undefined;
  }

  async createProjectSettings(settings: InsertProjectSettings): Promise<ProjectSettings> {
    const [created] = await db.insert(projectSettings).values(settings).returning();
    return created;
  }

  async updateProjectSettings(projectId: string, updates: Partial<InsertProjectSettings>): Promise<ProjectSettings> {
    const [updated] = await db.update(projectSettings)
      .set(updates)
      .where(eq(projectSettings.projectId, projectId))
      .returning();
    return updated;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async getTasksForProject(projectId: string, includeArchived: boolean = false): Promise<Task[]> {
    const whereConditions = [eq(tasks.projectId, projectId)];
    
    if (!includeArchived) {
      whereConditions.push(eq(tasks.archived, false));
    }

    return db.select()
      .from(tasks)
      .where(and(...whereConditions))
      .orderBy(
        sql`CASE WHEN ${tasks.sortOrder} IS NULL THEN 1 ELSE 0 END`, // nulls last
        asc(tasks.sortOrder), // primary sort by sortOrder
        asc(tasks.createdAt) // tie breaker
      );
  }

  async getProjectAssignees(projectId: string): Promise<string[]> {
    const assignees = await db
      .selectDistinct({ assignee: tasks.assignee })
      .from(tasks)
      .where(and(
        eq(tasks.projectId, projectId), 
        sql`${tasks.assignee} IS NOT NULL AND ${tasks.assignee} != ''`,
        eq(tasks.archived, false)
      ));

    // Filter out null or undefined assignees and return only the assignee names
    return assignees
      .map(a => a.assignee)
      .filter((assignee): assignee is string => assignee !== null && assignee !== undefined && assignee.trim() !== '');
  }

  async createTask(task: InsertTask): Promise<Task> {
    // Get the highest sortOrder for this project to assign the next order
    const maxSortOrder = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(sort_order), 0)` })
      .from(tasks)
      .where(eq(tasks.projectId, task.projectId));

    const nextSortOrder = (maxSortOrder[0]?.maxOrder || 0) + 1;

    const [created] = await db.insert(tasks).values({
      ...task,
      sortOrder: nextSortOrder
    }).returning();
    return created;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task> {
    // If status is being changed to 'completed', automatically set completedAt
    if (updates.status === 'completed' && !updates.completedAt) {
      updates.completedAt = new Date();
    }
    // If status is being changed from 'completed' to something else, clear completedAt
    if (updates.status && updates.status !== 'completed') {
      updates.completedAt = null;
    }
    
    const [updated] = await db.update(tasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }


  async getProjectTemplate(id: string): Promise<ProjectTemplate | undefined> {
    const [template] = await db.select().from(projectTemplates).where(eq(projectTemplates.id, id));
    return template || undefined;
  }

  async getProjectTemplatesForOrg(orgId: string): Promise<ProjectTemplate[]> {
    return db.select().from(projectTemplates).where(eq(projectTemplates.orgId, orgId));
  }


  async createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate> {
    const [created] = await db.insert(projectTemplates).values(template).returning();
    return created;
  }

  async getTimelineNotesForTask(taskId: string): Promise<TimelineNote[]> {
    return db.select().from(timelineNotes)
      .where(eq(timelineNotes.taskId, taskId))
      .orderBy(desc(timelineNotes.createdAt));
  }

  async createTimelineNote(note: InsertTimelineNote): Promise<TimelineNote> {
    const [created] = await db.insert(timelineNotes).values(note).returning();
    return created;
  }

  async updateTimelineNote(id: string, updates: Partial<InsertTimelineNote>): Promise<TimelineNote> {
    const [updated] = await db.update(timelineNotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(timelineNotes.id, id))
      .returning();
    return updated;
  }

  async deleteTimelineNote(id: string): Promise<void> {
    await db.delete(timelineNotes).where(eq(timelineNotes.id, id));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogsForProject(projectId: string): Promise<AuditLog[]> {
    return db.select().from(auditLogs)
      .where(eq(auditLogs.projectId, projectId))
      .orderBy(desc(auditLogs.createdAt));
  }

  async getAuditLogsForOrg(orgId: string, filters?: {
    action?: string;
    entityType?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLog[]> {
    const conditions = [eq(auditLogs.orgId, orgId)];
    
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.startDate) {
      conditions.push(sql`${auditLogs.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${auditLogs.createdAt} <= ${filters.endDate}`);
    }

    let query = db.select().from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }

    return query;
  }

  async getProjectShare(shareToken: string): Promise<ProjectShare | undefined> {
    const [share] = await db.select().from(projectShares)
      .where(and(eq(projectShares.shareToken, shareToken), eq(projectShares.isActive, true)));
    return share || undefined;
  }

  async getProjectShares(projectId: string): Promise<ProjectShare[]> {
    return db.select().from(projectShares)
      .where(eq(projectShares.projectId, projectId))
      .orderBy(desc(projectShares.createdAt));
  }

  async createProjectShare(share: InsertProjectShare): Promise<ProjectShare> {
    const [created] = await db.insert(projectShares).values(share).returning();
    return created;
  }

  async updateProjectShare(id: string, updates: Partial<InsertProjectShare>): Promise<ProjectShare> {
    const [updated] = await db.update(projectShares)
      .set(updates)
      .where(eq(projectShares.id, id))
      .returning();
    return updated;
  }

  async deleteProjectShare(id: string): Promise<void> {
    await db.delete(projectShares).where(eq(projectShares.id, id));
  }

  // Risk Management Implementation
  async getRisk(id: string): Promise<Risk | undefined> {
    const [risk] = await db.select().from(risks).where(eq(risks.id, id));
    return risk || undefined;
  }

  async getRisksForProject(projectId: string): Promise<Risk[]> {
    return db.select().from(risks).where(eq(risks.projectId, projectId)).orderBy(desc(risks.riskScore));
  }

  async getHighestRisksByScore(projectId: string, limit: number = 3): Promise<Risk[]> {
    return db.select().from(risks)
      .where(eq(risks.projectId, projectId))
      .orderBy(desc(risks.riskScore))
      .limit(limit);
  }

  async getRisksByCategory(projectId: string, category: string): Promise<Risk[]> {
    return db.select().from(risks)
      .where(and(
        eq(risks.projectId, projectId), 
        sql`${risks.category} = ${category}`
      ))
      .orderBy(desc(risks.riskScore));
  }

  async getRisksByStatus(projectId: string, status: string): Promise<Risk[]> {
    return db.select().from(risks)
      .where(and(
        eq(risks.projectId, projectId), 
        sql`${risks.status} = ${status}`
      ))
      .orderBy(desc(risks.riskScore));
  }

  async createRisk(risk: InsertRisk): Promise<Risk> {
    // Auto-calculate risk score before insertion
    const likelihood = parseInt(risk.likelihood || "3");
    const impact = parseInt(risk.impact || "3");
    const riskScore = likelihood * impact;
    
    // Calculate residual score if residual values are provided
    let residualScore = null;
    if (risk.residualLikelihood && risk.residualImpact) {
      const residualL = parseInt(risk.residualLikelihood);
      const residualI = parseInt(risk.residualImpact);
      residualScore = residualL * residualI;
    }

    const [created] = await db.insert(risks).values({
      ...risk,
      riskScore,
      residualScore,
    }).returning();
    return created;
  }

  async updateRisk(id: string, updates: Partial<InsertRisk>): Promise<Risk> {
    // Auto-calculate risk scores if likelihood or impact are being updated
    const updateData: any = { ...updates, updatedAt: new Date() };
    
    if (updates.likelihood || updates.impact) {
      // Get current risk to calculate new score
      const currentRisk = await this.getRisk(id);
      if (currentRisk) {
        const likelihood = parseInt(updates.likelihood || currentRisk.likelihood);
        const impact = parseInt(updates.impact || currentRisk.impact);
        updateData.riskScore = likelihood * impact;
      }
    }
    
    if (updates.residualLikelihood || updates.residualImpact) {
      // Get current risk for residual calculation
      const currentRisk = await this.getRisk(id);
      if (currentRisk) {
        const residualL = parseInt(updates.residualLikelihood || currentRisk.residualLikelihood || "0");
        const residualI = parseInt(updates.residualImpact || currentRisk.residualImpact || "0");
        updateData.residualScore = residualL * residualI;
      }
    }

    const [updated] = await db.update(risks)
      .set(updateData)
      .where(eq(risks.id, id))
      .returning();
    return updated;
  }

  async deleteRisk(id: string): Promise<void> {
    await db.delete(risks).where(eq(risks.id, id));
  }

  async bulkUpdateRiskScores(projectId: string): Promise<void> {
    // Recalculate all risk scores for a project
    const projectRisks = await this.getRisksForProject(projectId);
    
    for (const risk of projectRisks) {
      const likelihood = parseInt(risk.likelihood);
      const impact = parseInt(risk.impact);
      const riskScore = likelihood * impact;
      
      let residualScore = null;
      if (risk.residualLikelihood && risk.residualImpact) {
        const residualL = parseInt(risk.residualLikelihood);
        const residualI = parseInt(risk.residualImpact);
        residualScore = residualL * residualI;
      }

      await db.update(risks)
        .set({ riskScore, residualScore, updatedAt: new Date() })
        .where(eq(risks.id, risk.id));
    }
  }

  async getProjectRiskSummary(projectId: string): Promise<{
    totalRisks: number;
    risksBySeverity: { high: number; medium: number; low: number };
    totalCostAtRisk: number;
    totalScheduleAtRisk: number;
    categoryDistribution: Array<{ category: string; count: number; avgScore: number }>;
  }> {
    const projectRisks = await this.getRisksForProject(projectId);
    
    // Calculate risk severity distribution
    const risksBySeverity = {
      high: projectRisks.filter(r => r.riskScore > 15).length,
      medium: projectRisks.filter(r => r.riskScore >= 8 && r.riskScore <= 15).length,
      low: projectRisks.filter(r => r.riskScore < 8).length,
    };
    
    // Calculate financial and schedule impact
    const totalCostAtRisk = projectRisks.reduce((sum, risk) => sum + (risk.impactCostUSD || 0), 0);
    const totalScheduleAtRisk = projectRisks.reduce((sum, risk) => sum + (risk.impactScheduleDays || 0), 0);
    
    // Calculate category distribution
    const categoryMap = new Map<string, { count: number; totalScore: number }>();
    projectRisks.forEach(risk => {
      const category = risk.category;
      const existing = categoryMap.get(category) || { count: 0, totalScore: 0 };
      categoryMap.set(category, {
        count: existing.count + 1,
        totalScore: existing.totalScore + risk.riskScore
      });
    });
    
    const categoryDistribution = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      avgScore: Math.round((data.totalScore / data.count) * 100) / 100
    }));

    return {
      totalRisks: projectRisks.length,
      risksBySeverity,
      totalCostAtRisk,
      totalScheduleAtRisk,
      categoryDistribution,
    };
  }

  async hasCircularDependency(projectId: string, taskId: string, dependencies: string[]): Promise<boolean> {
    // Get all tasks for the project to build the dependency graph
    const allTasks = await this.getTasksForProject(projectId);
    
    // Build a dependency map: taskId -> dependencies[]
    const dependencyMap = new Map<string, string[]>();
    
    // Add existing dependencies from all tasks
    for (const task of allTasks) {
      // Skip the task being created/updated to simulate the new dependency state
      if (task.id !== taskId) {
        dependencyMap.set(task.id, task.dependencies || []);
      }
    }
    
    // Add the new/updated task with its proposed dependencies
    dependencyMap.set(taskId, dependencies);
    
    // Use DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycleDFS = (currentTaskId: string): boolean => {
      // Mark current task as visited and in recursion stack
      visited.add(currentTaskId);
      recursionStack.add(currentTaskId);
      
      // Get dependencies for current task
      const taskDependencies = dependencyMap.get(currentTaskId) || [];
      
      // Visit all dependencies
      for (const depId of taskDependencies) {
        // Skip empty or null dependencies
        if (!depId || depId.trim() === '') continue;
        
        // If dependency is in recursion stack, we found a cycle
        if (recursionStack.has(depId)) {
          return true;
        }
        
        // If dependency hasn't been visited, recursively check it
        if (!visited.has(depId) && hasCycleDFS(depId)) {
          return true;
        }
      }
      
      // Remove current task from recursion stack
      recursionStack.delete(currentTaskId);
      return false;
    };
    
    // Check for cycles starting from the task being created/updated
    return hasCycleDFS(taskId);
  }

  // Contact Management
  async createContact(contact: InsertDDContact): Promise<DDContact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async getContactsByOrg(orgId: string): Promise<DDContact[]> {
    return db.select().from(contacts)
      .where(eq(contacts.orgId, orgId))
      .orderBy(contacts.name);
  }

  async getContactById(id: string): Promise<DDContact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async updateContact(id: string, updates: UpdateDDContact): Promise<DDContact> {
    const [updated] = await db.update(contacts)
      .set(updates)
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async deleteContact(id: string): Promise<void> {
    // Check for active subscriptions first
    const activeSubscriptions = await db.select()
      .from(notificationSubscriptions)
      .where(and(
        eq(notificationSubscriptions.recipientType, "contact"),
        eq(notificationSubscriptions.recipientId, id),
        eq(notificationSubscriptions.active, true)
      ));
    
    if (activeSubscriptions.length > 0) {
      throw new Error(`Cannot delete contact: ${activeSubscriptions.length} active notification subscriptions exist`);
    }
    
    await db.delete(contacts).where(eq(contacts.id, id));
  }
  
  // Project-Contact Associations
  async addContactToProject(projectContact: InsertProjectContact): Promise<ProjectContact> {
    const [created] = await db.insert(projectContacts).values(projectContact).returning();
    return created;
  }

  async getProjectContacts(projectId: string): Promise<Array<ProjectContact & { contact: DDContact }>> {
    const results = await db.select()
      .from(projectContacts)
      .leftJoin(contacts, eq(projectContacts.contactId, contacts.id))
      .where(eq(projectContacts.projectId, projectId))
      .orderBy(projectContacts.role);
    
    return results.map(result => ({
      ...result.project_contacts,
      contact: result.contacts!
    }));
  }

  async removeContactFromProject(projectId: string, contactId: string, role: string): Promise<void> {
    await db.delete(projectContacts)
      .where(and(
        eq(projectContacts.projectId, projectId),
        eq(projectContacts.contactId, contactId),
        eq(projectContacts.role, role)
      ));
  }

  // Notification Subscription Management
  async createSubscription(subscription: InsertNotificationSubscription): Promise<NotificationSubscription> {
    const [created] = await db.insert(notificationSubscriptions).values(subscription).returning();
    return created;
  }

  async getSubscriptionsByProject(projectId: string): Promise<NotificationSubscription[]> {
    return db.select().from(notificationSubscriptions)
      .where(and(
        eq(notificationSubscriptions.projectId, projectId),
        eq(notificationSubscriptions.active, true)
      ))
      .orderBy(notificationSubscriptions.createdAt);
  }

  async getSubscriptionsByTask(taskId: string): Promise<NotificationSubscription[]> {
    return db.select().from(notificationSubscriptions)
      .where(and(
        eq(notificationSubscriptions.taskId, taskId),
        eq(notificationSubscriptions.active, true)
      ))
      .orderBy(notificationSubscriptions.createdAt);
  }

  async getSubscriptionsByRecipient(recipientType: "user" | "contact", recipientId: string): Promise<NotificationSubscription[]> {
    return db.select().from(notificationSubscriptions)
      .where(and(
        eq(notificationSubscriptions.recipientType, recipientType),
        eq(notificationSubscriptions.recipientId, recipientId),
        eq(notificationSubscriptions.active, true)
      ))
      .orderBy(notificationSubscriptions.createdAt);
  }

  async updateSubscription(id: string, updates: Partial<InsertNotificationSubscription>): Promise<NotificationSubscription> {
    const [updated] = await db.update(notificationSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notificationSubscriptions.id, id))
      .returning();
    return updated;
  }

  async deleteSubscription(id: string): Promise<void> {
    await db.delete(notificationSubscriptions).where(eq(notificationSubscriptions.id, id));
  }

  // Notification Logging & De-duplication
  async createNotificationLog(notification: InsertNotificationLog): Promise<NotificationLog> {
    const [created] = await db.insert(notificationsLog).values(notification).returning();
    return created;
  }

  async checkNotificationExists(
    projectId: string,
    taskId: string | null,
    event: string,
    channel: string,
    recipientType: "user" | "contact",
    recipientId: string,
    leadOffsetDays: number
  ): Promise<boolean> {
    const existing = await db.select()
      .from(notificationsLog)
      .where(and(
        eq(notificationsLog.projectId, projectId),
        taskId ? eq(notificationsLog.taskId, taskId) : sql`${notificationsLog.taskId} IS NULL`,
        sql`${notificationsLog.event} = ${event}`,
        sql`${notificationsLog.channel} = ${channel}`,
        sql`${notificationsLog.recipientType} = ${recipientType}`,
        eq(notificationsLog.recipientId, recipientId),
        eq(notificationsLog.leadOffsetDays, leadOffsetDays)
      ))
      .limit(1);
    
    return existing.length > 0;
  }

  async getNotificationHistory(projectId: string, taskId?: string): Promise<NotificationLog[]> {
    const whereConditions = [eq(notificationsLog.projectId, projectId)];
    
    if (taskId) {
      whereConditions.push(eq(notificationsLog.taskId, taskId));
    }
    
    return db.select().from(notificationsLog)
      .where(and(...whereConditions))
      .orderBy(desc(notificationsLog.createdAt));
  }

  async getScheduledNotifications(beforeDate: Date): Promise<NotificationLog[]> {
    return db.select().from(notificationsLog)
      .where(and(
        sql`${notificationsLog.scheduledFor} <= ${beforeDate}`,
        eq(notificationsLog.status, "pending"),
        sql`${notificationsLog.sentAt} IS NULL`
      ))
      .orderBy(notificationsLog.scheduledFor);
  }

  async markNotificationSent(notificationId: string, sentAt: Date, providerMessageId?: string): Promise<NotificationLog> {
    const updateData: any = {
      sentAt,
      status: "sent" as const,
    };
    
    if (providerMessageId) {
      updateData.providerMessageId = providerMessageId;
    }
    
    const [updated] = await db.update(notificationsLog)
      .set(updateData)
      .where(eq(notificationsLog.id, notificationId))
      .returning();
    return updated;
  }

  // Test Notification Support
  async sendTestNotification(recipientEmail: string, templateType: string): Promise<boolean> {
    // Use the real NotificationService for SendGrid integration
    try {
      const { notificationService } = await import('./notification-service');
      return await notificationService.sendTestNotification(recipientEmail, templateType);
    } catch (error) {
      console.error("Failed to send test notification:", error);
      return false;
    }
  }

  async validateNotificationChannels(channels: string[]): Promise<{ valid: boolean; errors: string[] }> {
    const validChannels = ["email", "sms"];
    const errors: string[] = [];
    
    for (const channel of channels) {
      if (!validChannels.includes(channel)) {
        errors.push(`Invalid notification channel: ${channel}`);
      }
    }
    
    // Check if email is configured (SendGrid API key exists)
    // In a real implementation, this would check environment variables
    const hasEmailConfig = process.env.SENDGRID_API_KEY !== undefined;
    if (channels.includes("email") && !hasEmailConfig) {
      errors.push("Email notifications not configured: SendGrid API key missing");
    }
    
    // Check if SMS is configured
    const hasSmsConfig = process.env.TWILIO_ACCOUNT_SID !== undefined && process.env.TWILIO_AUTH_TOKEN !== undefined;
    if (channels.includes("sms") && !hasSmsConfig) {
      errors.push("SMS notifications not configured: Twilio credentials missing");
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Calendar Events Management
  async getCalendarEvent(id: string): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    return event || undefined;
  }

  async getProjectCalendarEvents(projectId: string, filters?: {
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    status?: string;
    isCompleted?: boolean;
  }): Promise<CalendarEvent[]> {
    const whereConditions = [eq(calendarEvents.projectId, projectId)];
    
    if (filters?.eventType) {
      whereConditions.push(eq(calendarEvents.eventType, filters.eventType as any));
    }
    
    if (filters?.startDate) {
      whereConditions.push(sql`${calendarEvents.startDate} >= ${filters.startDate}`);
    }
    
    if (filters?.endDate) {
      whereConditions.push(sql`${calendarEvents.startDate} <= ${filters.endDate}`);
    }
    
    if (filters?.status) {
      whereConditions.push(eq(calendarEvents.status, filters.status as any));
    }
    
    // Filter by completion status if specified
    if (filters?.isCompleted !== undefined) {
      if (filters.isCompleted) {
        whereConditions.push(eq(calendarEvents.status, "completed"));
      } else {
        whereConditions.push(sql`${calendarEvents.status} != 'completed'`);
      }
    }
    
    return db.select().from(calendarEvents)
      .where(and(...whereConditions))
      .orderBy(calendarEvents.startDate);
  }

  async getEventsByType(projectId: string, eventType: string): Promise<CalendarEvent[]> {
    return db.select().from(calendarEvents)
      .where(and(
        eq(calendarEvents.projectId, projectId),
        eq(calendarEvents.eventType, eventType as any)
      ))
      .orderBy(calendarEvents.startDate);
  }

  async getEventsByDateRange(projectId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    return db.select().from(calendarEvents)
      .where(and(
        eq(calendarEvents.projectId, projectId),
        sql`${calendarEvents.startDate} >= ${startDate}`,
        sql`${calendarEvents.startDate} <= ${endDate}`
      ))
      .orderBy(calendarEvents.startDate);
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const eventData = {
      ...event,
      icalUid: event.icalUid || `${Date.now()}-${Math.random().toString(36).substring(2)}@dd.local`,
    };
    
    const [created] = await db.insert(calendarEvents).values(eventData).returning();
    return created;
  }

  async updateCalendarEvent(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(calendarEvents)
      .set(updateData)
      .where(eq(calendarEvents.id, id))
      .returning();
    return updated;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  }

  async syncProjectEvents(projectId: string): Promise<CalendarEvent[]> {
    // Get all tasks for the project to generate calendar events
    const tasks = await this.getTasksForProject(projectId);
    const project = await this.getProject(projectId);
    
    if (!project) {
      return [];
    }

    // Get all existing calendar events for this project
    const existingEvents = await db.select().from(calendarEvents)
      .where(eq(calendarEvents.projectId, projectId));

    const createdOrUpdatedEvents: CalendarEvent[] = [];
    const processedTaskIds: Set<string> = new Set();
    
    // Process tasks with deadlines - create or update events
    for (const task of tasks) {
      if (task.deadline) {
        processedTaskIds.add(task.id);
        
        const existingTaskEvent = existingEvents.find(e => 
          e.taskId === task.id && e.eventType === "task_deadline"
        );

        // Map task status to valid database calendar event status
        const mapTaskStatusToEventStatus = (taskStatus: string): "not_started" | "engaged" | "scheduled" | "in_progress" | "completed" => {
          switch (taskStatus) {
            case 'engaged': return 'engaged';
            case 'not_started': return 'not_started';
            case 'scheduled': return 'scheduled';  
            case 'in_progress': return 'in_progress';
            case 'completed': return 'completed';
            default: return 'not_started';
          }
        };

        const eventData = {
          projectId,
          taskId: task.id,
          eventType: "task_deadline" as const,
          title: `${task.title} - Due`,
          description: task.description || '',
          startDate: new Date(`${task.deadline}T09:00:00`),
          isAllDay: true,
          timezone: project.tz,
          priority: task.priority,
          status: mapTaskStatusToEventStatus(task.status),
        };

        if (existingTaskEvent) {
          // Update existing event if details have changed
          const needsUpdate = 
            existingTaskEvent.title !== eventData.title ||
            existingTaskEvent.description !== eventData.description ||
            new Date(existingTaskEvent.startDate).getTime() !== eventData.startDate.getTime() ||
            existingTaskEvent.priority !== eventData.priority ||
            existingTaskEvent.status !== eventData.status ||
            existingTaskEvent.timezone !== eventData.timezone;

          if (needsUpdate) {
            const updated = await this.updateCalendarEvent(existingTaskEvent.id, eventData);
            createdOrUpdatedEvents.push(updated);
          } else {
            createdOrUpdatedEvents.push(existingTaskEvent);
          }
        } else {
          // Create new event
          const created = await this.createCalendarEvent(eventData);
          createdOrUpdatedEvents.push(created);
        }
      }
    }

    // Clean up task events for tasks that no longer have deadlines
    const orphanedTaskEvents = existingEvents.filter(e => 
      e.eventType === "task_deadline" && 
      e.taskId && 
      !processedTaskIds.has(e.taskId)
    );

    for (const orphanedEvent of orphanedTaskEvents) {
      await this.deleteCalendarEvent(orphanedEvent.id);
    }
    
    // Handle DD expiration event
    const existingDdEvent = existingEvents.find(e => e.eventType === "dd_expiration");
    
    if (project.ddExpirationDate) {
      const ddEventData = {
        projectId,
        eventType: "dd_expiration" as const,
        title: `${project.name} - DD Expiration`,
        description: `Due diligence period expires for ${project.name}`,
        startDate: new Date(`${project.ddExpirationDate}T23:59:00`),
        isAllDay: true,
        timezone: project.tz,
        priority: "high" as const,
        status: "not_started" as const,
      };

      if (existingDdEvent) {
        // Update existing DD event if details have changed
        const needsUpdate = 
          existingDdEvent.title !== ddEventData.title ||
          existingDdEvent.description !== ddEventData.description ||
          new Date(existingDdEvent.startDate).getTime() !== ddEventData.startDate.getTime() ||
          existingDdEvent.timezone !== ddEventData.timezone;

        if (needsUpdate) {
          const updated = await this.updateCalendarEvent(existingDdEvent.id, ddEventData);
          createdOrUpdatedEvents.push(updated);
        } else {
          createdOrUpdatedEvents.push(existingDdEvent);
        }
      } else {
        // Create new DD event
        const created = await this.createCalendarEvent(ddEventData);
        createdOrUpdatedEvents.push(created);
      }
    } else if (existingDdEvent) {
      // Remove DD event if project no longer has DD expiration date
      await this.deleteCalendarEvent(existingDdEvent.id);
    }
    
    // Handle closing event
    const existingClosingEvent = existingEvents.find(e => e.eventType === "closing");
    
    if (project.closingDate) {
      const closingEventData = {
        projectId,
        eventType: "closing" as const,
        title: `${project.name} - Closing`,
        description: `Project closing date for ${project.name}`,
        startDate: new Date(`${project.closingDate}T10:00:00`),
        endDate: new Date(`${project.closingDate}T17:00:00`),
        isAllDay: false,
        timezone: project.tz,
        priority: "high" as const,
        status: "not_started" as const,
      };

      if (existingClosingEvent) {
        // Update existing closing event if details have changed
        const needsUpdate = 
          existingClosingEvent.title !== closingEventData.title ||
          existingClosingEvent.description !== closingEventData.description ||
          new Date(existingClosingEvent.startDate).getTime() !== closingEventData.startDate.getTime() ||
          (existingClosingEvent.endDate && new Date(existingClosingEvent.endDate).getTime() !== closingEventData.endDate!.getTime()) ||
          existingClosingEvent.timezone !== closingEventData.timezone;

        if (needsUpdate) {
          const updated = await this.updateCalendarEvent(existingClosingEvent.id, closingEventData);
          createdOrUpdatedEvents.push(updated);
        } else {
          createdOrUpdatedEvents.push(existingClosingEvent);
        }
      } else {
        // Create new closing event
        const created = await this.createCalendarEvent(closingEventData);
        createdOrUpdatedEvents.push(created);
      }
    } else if (existingClosingEvent) {
      // Remove closing event if project no longer has closing date
      await this.deleteCalendarEvent(existingClosingEvent.id);
    }
    
    return createdOrUpdatedEvents;
  }

  async validateEventSelection(eventIds: string[]): Promise<{ valid: boolean; invalidIds: string[] }> {
    if (eventIds.length === 0) {
      return { valid: true, invalidIds: [] };
    }
    
    const existingEvents = await db.select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(inArray(calendarEvents.id, eventIds));
    
    const existingIds = existingEvents.map(e => e.id);
    const invalidIds = eventIds.filter(id => !existingIds.includes(id));
    
    return {
      valid: invalidIds.length === 0,
      invalidIds
    };
  }

  // ICS Generation
  async generateICSFile(events: CalendarEvent[]): Promise<string> {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
    
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Due Diligence App//Calendar Export//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];
    
    // Add timezone definition for America/New_York (most common)
    icsContent.push(
      'BEGIN:VTIMEZONE',
      'TZID:America/New_York',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:-0500',
      'TZOFFSETTO:-0400',
      'TZNAME:EDT',
      'DTSTART:20070311T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:-0400',
      'TZOFFSETTO:-0500',
      'TZNAME:EST',
      'DTSTART:20071104T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    );
    
    // Add each event as a VEVENT
    for (const event of events) {
      const startDate = new Date(event.startDate);
      const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      
      // Format dates for ICS
      const formatICSDate = (date: Date, isAllDay: boolean = false, timezone?: string) => {
        if (isAllDay) {
          return date.toISOString().substr(0, 10).replace(/-/g, '');
        } else {
          const isoString = date.toISOString().replace(/[:-]/g, '').replace(/\.\d{3}/, '');
          return timezone ? `TZID=${timezone}:${isoString.substr(0, -1)}` : isoString;
        }
      };
      
      const dtStart = event.isAllDay ? 
        formatICSDate(startDate, true) : 
        formatICSDate(startDate, false, event.timezone);
        
      const dtEnd = event.isAllDay ?
        formatICSDate(endDate, true) :
        formatICSDate(endDate, false, event.timezone);
      
      const eventLines: string[] = [
        'BEGIN:VEVENT',
        `UID:${event.icalUid || event.id}`,
        `DTSTAMP:${timestamp}`,
        event.isAllDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART;${dtStart}`,
        event.isAllDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND;${dtEnd}`,
        `SUMMARY:${event.title.replace(/[,;]/g, '\\$&')}`,
        `DESCRIPTION:${(event.description || '').replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n')}`,
        `STATUS:${event.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}`,
        `PRIORITY:${event.priority === 'high' ? '1' : event.priority === 'med' ? '5' : '9'}`,
        event.location ? `LOCATION:${event.location.replace(/[,;]/g, '\\$&')}` : '',
        'END:VEVENT'
      ].filter((line: string) => line !== ''); // Remove empty lines
      
      icsContent.push(...eventLines);
    }
    
    icsContent.push('END:VCALENDAR');
    
    return icsContent.join('\r\n');
  }

  async generateProjectICS(projectId: string, filters?: {
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<string> {
    // First sync project events to ensure we have the latest data
    await this.syncProjectEvents(projectId);
    
    // Get filtered events
    const events = await this.getProjectCalendarEvents(projectId, filters);
    
    return this.generateICSFile(events);
  }

  // Document Requirements CRUD Implementation
  async createDocumentRequirement(requirement: InsertDocumentRequirement): Promise<DocumentRequirement> {
    try {
      const [created] = await db.insert(documentRequirements).values(requirement).returning();
      return created;
    } catch (error) {
      console.error('Failed to create document requirement:', error);
      throw error;
    }
  }

  async getDocumentRequirement(id: string): Promise<DocumentRequirement | undefined> {
    try {
      const [requirement] = await db.select().from(documentRequirements).where(eq(documentRequirements.id, id));
      return requirement || undefined;
    } catch (error) {
      console.error('Failed to get document requirement:', error);
      throw error;
    }
  }

  async updateDocumentRequirement(id: string, updates: Partial<InsertDocumentRequirement>): Promise<DocumentRequirement> {
    try {
      const updateData = { ...updates, updatedAt: new Date() };
      const [updated] = await db.update(documentRequirements)
        .set(updateData)
        .where(eq(documentRequirements.id, id))
        .returning();
      
      if (!updated) {
        throw new Error(`Document requirement with id ${id} not found`);
      }
      
      return updated;
    } catch (error) {
      console.error('Failed to update document requirement:', error);
      throw error;
    }
  }

  async deleteDocumentRequirement(id: string): Promise<void> {
    try {
      await db.delete(documentRequirements).where(eq(documentRequirements.id, id));
    } catch (error) {
      console.error('Failed to delete document requirement:', error);
      throw error;
    }
  }

  async getDocumentRequirementsByTask(taskId: string): Promise<DocumentRequirement[]> {
    try {
      return await db.select().from(documentRequirements)
        .where(eq(documentRequirements.taskId, taskId))
        .orderBy(documentRequirements.createdAt);
    } catch (error) {
      console.error('Failed to get document requirements by task:', error);
      throw error;
    }
  }

  async getDocumentRequirementsByProject(projectId: string): Promise<DocumentRequirement[]> {
    try {
      return await db.select().from(documentRequirements)
        .where(eq(documentRequirements.projectId, projectId))
        .orderBy(documentRequirements.createdAt);
    } catch (error) {
      console.error('Failed to get document requirements by project:', error);
      throw error;
    }
  }

  async bulkUpsertDocumentRequirements(
    projectId: string, 
    taskId: string, 
    requirements: Partial<InsertDocumentRequirement>[]
  ): Promise<DocumentRequirement[]> {
    try {
      const results: DocumentRequirement[] = [];
      
      for (const requirement of requirements) {
        // Check if requirement exists by externalDocId and taskId
        if (requirement.externalDocId) {
          const existing = await db.select().from(documentRequirements)
            .where(and(
              eq(documentRequirements.taskId, taskId),
              eq(documentRequirements.externalDocId, requirement.externalDocId)
            ));
          
          if (existing.length > 0) {
            // Update existing requirement
            const updated = await this.updateDocumentRequirement(existing[0].id, requirement);
            results.push(updated);
          } else {
            // Create new requirement
            const created = await this.createDocumentRequirement({
              projectId,
              taskId,
              requirementKey: requirement.requirementKey || '',
              title: requirement.title || '',
              provider: requirement.provider || '',
              ...requirement
            });
            results.push(created);
          }
        } else {
          // Create new requirement without externalDocId
          const created = await this.createDocumentRequirement({
            projectId,
            taskId,
            requirementKey: requirement.requirementKey || '',
            title: requirement.title || '',
            provider: requirement.provider || '',
            ...requirement
          });
          results.push(created);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Failed to bulk upsert document requirements:', error);
      throw error;
    }
  }

  // Project Integrations CRUD Implementation
  async createProjectIntegration(integration: InsertProjectIntegration): Promise<ProjectIntegration> {
    try {
      const [created] = await db.insert(projectIntegrations).values(integration).returning();
      return created;
    } catch (error) {
      console.error('Failed to create project integration:', error);
      throw error;
    }
  }

  async getProjectIntegration(id: string): Promise<ProjectIntegration | undefined> {
    try {
      const [integration] = await db.select().from(projectIntegrations).where(eq(projectIntegrations.id, id));
      return integration || undefined;
    } catch (error) {
      console.error('Failed to get project integration:', error);
      throw error;
    }
  }

  async getProjectIntegrationsByProject(projectId: string): Promise<ProjectIntegration[]> {
    try {
      const integrations = await db.select().from(projectIntegrations)
        .where(eq(projectIntegrations.projectId, projectId));
      return integrations;
    } catch (error) {
      console.error('Failed to get project integrations:', error);
      throw error;
    }
  }

  async updateProjectIntegration(id: string, updates: Partial<InsertProjectIntegration>): Promise<ProjectIntegration> {
    try {
      const updateData = { ...updates, updatedAt: new Date() };
      const [updated] = await db.update(projectIntegrations)
        .set(updateData)
        .where(eq(projectIntegrations.id, id))
        .returning();
      
      if (!updated) {
        throw new Error(`Project integration with id ${id} not found`);
      }
      
      return updated;
    } catch (error) {
      console.error('Failed to update project integration:', error);
      throw error;
    }
  }

  async deleteProjectIntegration(id: string): Promise<void> {
    try {
      await db.delete(projectIntegrations).where(eq(projectIntegrations.id, id));
    } catch (error) {
      console.error('Failed to delete project integration:', error);
      throw error;
    }
  }

  async getProjectIntegrationByProvider(projectId: string, provider: string): Promise<ProjectIntegration | undefined> {
    try {
      const [integration] = await db.select().from(projectIntegrations)
        .where(and(
          eq(projectIntegrations.projectId, projectId),
          eq(projectIntegrations.provider, provider)
        ));
      return integration || undefined;
    } catch (error) {
      console.error('Failed to get project integration by provider:', error);
      throw error;
    }
  }

  async updateLastSyncCursor(projectId: string, provider: string, lastSyncCursor: string): Promise<ProjectIntegration> {
    try {
      // Get existing integration
      const existing = await this.getProjectIntegrationByProvider(projectId, provider);
      if (!existing) {
        throw new Error(`Project integration not found for project ${projectId} and provider ${provider}`);
      }
      
      // Update config with new lastSyncCursor
      const updatedConfig = { 
        ...(existing.config as object), 
        lastSyncCursor 
      };
      
      return await this.updateProjectIntegration(existing.id, {
        config: updatedConfig
      });
    } catch (error) {
      console.error('Failed to update last sync cursor:', error);
      throw error;
    }
  }

  // Query Methods Implementation
  async getRequirementsByStatus(projectId: string, status: string): Promise<DocumentRequirement[]> {
    try {
      return await db.select().from(documentRequirements)
        .where(and(
          eq(documentRequirements.projectId, projectId),
          sql`${documentRequirements.status} = ${status}`
        ))
        .orderBy(documentRequirements.createdAt);
    } catch (error) {
      console.error('Failed to get requirements by status:', error);
      throw error;
    }
  }

  async checkTaskCompletionGating(taskId: string): Promise<{ canComplete: boolean; unverifiedRequirements: DocumentRequirement[] }> {
    try {
      // Get all requirements for this task that are not in verified status
      const unverifiedRequirements = await db.select().from(documentRequirements)
        .where(and(
          eq(documentRequirements.taskId, taskId),
          sql`${documentRequirements.status} != 'verified'`
        ));
      
      return {
        canComplete: unverifiedRequirements.length === 0,
        unverifiedRequirements
      };
    } catch (error) {
      console.error('Failed to check task completion gating:', error);
      throw error;
    }
  }

  // Automatic Calendar Event Management Implementation
  async syncTaskCalendarEvent(task: Task): Promise<CalendarEvent | null> {
    try {
      // Only create calendar events for tasks with deadlines
      if (!task.deadline) {
        // If task has no deadline, delete any existing calendar event
        await this.deleteTaskCalendarEvent(task.id);
        return null;
      }

      const project = await this.getProject(task.projectId);
      if (!project) {
        console.error(`Project not found for task ${task.id}`);
        return null;
      }

      // Check if calendar event already exists for this task
      const existingEvents = await db.select().from(calendarEvents)
        .where(and(
          eq(calendarEvents.projectId, task.projectId),
          eq(calendarEvents.taskId, task.id),
          eq(calendarEvents.eventType, "task_deadline")
        ));

      const eventData = {
        projectId: task.projectId,
        taskId: task.id,
        eventType: "task_deadline" as const,
        title: `${task.title} - Due`,
        description: task.description || '',
        startDate: new Date(`${task.deadline}T09:00:00`),
        isAllDay: true,
        timezone: project.tz,
        priority: task.priority,
        status: task.status,
      };

      if (existingEvents.length > 0) {
        // Update existing calendar event
        const existingEvent = existingEvents[0];
        const updated = await this.updateCalendarEvent(existingEvent.id, eventData);
        return updated;
      } else {
        // Create new calendar event
        const created = await this.createCalendarEvent(eventData);
        return created;
      }
    } catch (error) {
      console.error('Failed to sync task calendar event:', error);
      throw error;
    }
  }

  async deleteTaskCalendarEvent(taskId: string): Promise<void> {
    try {
      // Delete all calendar events associated with this task
      await db.delete(calendarEvents)
        .where(and(
          eq(calendarEvents.taskId, taskId),
          eq(calendarEvents.eventType, "task_deadline")
        ));
    } catch (error) {
      console.error('Failed to delete task calendar event:', error);
      throw error;
    }
  }

  async updateTaskCalendarEvent(task: Task): Promise<CalendarEvent | null> {
    // This method is an alias for syncTaskCalendarEvent for clarity
    return this.syncTaskCalendarEvent(task);
  }

  // User Email Management
  async getUserEmails(userId: string): Promise<UserEmail[]> {
    return db.select().from(userEmails).where(eq(userEmails.userId, userId));
  }

  async createUserEmail(email: InsertUserEmail): Promise<UserEmail> {
    const [created] = await db.insert(userEmails).values(email).returning();
    return created;
  }

  async updateUserEmail(id: string, updates: Partial<InsertUserEmail>): Promise<UserEmail> {
    const [updated] = await db.update(userEmails)
      .set(updates)
      .where(eq(userEmails.id, id))
      .returning();
    return updated;
  }

  async deleteUserEmail(id: string): Promise<void> {
    await db.delete(userEmails).where(eq(userEmails.id, id));
  }

  async setDefaultUserEmail(userId: string, emailId: string): Promise<void> {
    // First unset all defaults for this user
    await db.update(userEmails)
      .set({ isDefault: false })
      .where(eq(userEmails.userId, userId));
    
    // Set the new default
    await db.update(userEmails)
      .set({ isDefault: true })
      .where(eq(userEmails.id, emailId));
  }

  // Calendar Guest Management
  async getProjectGuests(projectId: string): Promise<CalendarGuest[]> {
    return db.select().from(calendarGuests).where(eq(calendarGuests.projectId, projectId));
  }

  async createCalendarGuest(guest: InsertCalendarGuest): Promise<CalendarGuest> {
    const [created] = await db.insert(calendarGuests).values(guest).returning();
    return created;
  }

  async updateCalendarGuest(id: string, updates: Partial<InsertCalendarGuest>): Promise<CalendarGuest> {
    const [updated] = await db.update(calendarGuests)
      .set(updates)
      .where(eq(calendarGuests.id, id))
      .returning();
    return updated;
  }

  async deleteCalendarGuest(id: string): Promise<void> {
    await db.delete(calendarGuests).where(eq(calendarGuests.id, id));
  }

  async updateGuestStatus(id: string, status: 'pending' | 'accepted' | 'declined'): Promise<CalendarGuest> {
    const [updated] = await db.update(calendarGuests)
      .set({ status, respondedAt: new Date() })
      .where(eq(calendarGuests.id, id))
      .returning();
    return updated;
  }

  // Enhanced Task Dependencies (CPM Support)
  async getTaskDependency(id: string): Promise<TaskDependency | undefined> {
    const [dependency] = await db.select().from(taskDependencies).where(eq(taskDependencies.id, id));
    return dependency || undefined;
  }

  async getTaskDependencies(taskId: string): Promise<TaskDependency[]> {
    return db.select()
      .from(taskDependencies)
      .where(eq(taskDependencies.successorId, taskId))
      .orderBy(taskDependencies.createdAt);
  }

  async getTaskDependenciesForProject(projectId: string): Promise<TaskDependency[]> {
    // Get all task dependencies for tasks in this project
    return db.select({
      id: taskDependencies.id,
      successorId: taskDependencies.successorId,
      predecessorId: taskDependencies.predecessorId,
      type: taskDependencies.type,
      lagDays: taskDependencies.lagDays,
      isActive: taskDependencies.isActive,
      createdAt: taskDependencies.createdAt,
      updatedAt: taskDependencies.updatedAt
    })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.successorId, tasks.id))
    .where(eq(tasks.projectId, projectId))
    .orderBy(taskDependencies.createdAt);
  }

  async createTaskDependency(dependency: InsertTaskDependency): Promise<TaskDependency> {
    const [created] = await db.insert(taskDependencies).values(dependency).returning();
    return created;
  }

  async updateTaskDependency(id: string, updates: Partial<InsertTaskDependency>): Promise<TaskDependency> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(taskDependencies)
      .set(updateData)
      .where(eq(taskDependencies.id, id))
      .returning();
    return updated;
  }

  async deleteTaskDependency(id: string): Promise<void> {
    await db.delete(taskDependencies).where(eq(taskDependencies.id, id));
  }

  async deleteTaskDependencies(taskId: string): Promise<void> {
    // Delete all dependencies where this task is a successor or predecessor
    await db.delete(taskDependencies)
      .where(
        sql`${taskDependencies.successorId} = ${taskId} OR ${taskDependencies.predecessorId} = ${taskId}`
      );
  }

  // Task File Management
  async getTaskFile(id: string): Promise<TaskFile | undefined> {
    const [file] = await db.select().from(taskFiles).where(eq(taskFiles.id, id));
    return file || undefined;
  }

  async getTaskFilesForTask(taskId: string): Promise<TaskFile[]> {
    return db.select()
      .from(taskFiles)
      .where(eq(taskFiles.taskId, taskId))
      .orderBy(desc(taskFiles.createdAt));
  }

  async createTaskFile(file: InsertTaskFile): Promise<TaskFile> {
    const [created] = await db.insert(taskFiles).values(file).returning();
    return created;
  }

  async deleteTaskFile(id: string): Promise<void> {
    await db.delete(taskFiles).where(eq(taskFiles.id, id));
  }

  // CDD Documents
  async getCddDocument(id: string): Promise<CddDocument | undefined> {
    const [document] = await db.select().from(cddDocuments).where(eq(cddDocuments.id, id));
    return document || undefined;
  }

  async getCddDocumentsForProject(projectId: string): Promise<CddDocument[]> {
    return db.select()
      .from(cddDocuments)
      .where(eq(cddDocuments.projectId, projectId))
      .orderBy(desc(cddDocuments.uploadedAt));
  }

  async createCddDocument(document: InsertCddDocument): Promise<CddDocument> {
    const [created] = await db.insert(cddDocuments).values(document).returning();
    return created;
  }

  async updateCddDocument(id: string, updates: Partial<InsertCddDocument>): Promise<CddDocument> {
    const [updated] = await db.update(cddDocuments)
      .set(updates)
      .where(eq(cddDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteCddDocument(id: string): Promise<void> {
    await db.delete(cddDocuments).where(eq(cddDocuments.id, id));
  }

  // Document Pages
  async getDocPagesForDocument(documentId: string): Promise<DocPage[]> {
    return db.select()
      .from(docPages)
      .where(eq(docPages.documentId, documentId))
      .orderBy(docPages.pageNo);
  }

  async createDocPages(pages: InsertDocPage[]): Promise<DocPage[]> {
    if (pages.length === 0) return [];
    const created = await db.insert(docPages).values(pages).returning();
    return created;
  }

  async deleteDocPagesForDocument(documentId: string): Promise<void> {
    await db.delete(docPages).where(eq(docPages.documentId, documentId));
  }

  // Vector Chunks
  async getVectorChunksForDocument(documentId: string): Promise<VectorChunk[]> {
    return db.select()
      .from(vectorChunks)
      .where(
        sql`${vectorChunks.metadata}->>'documentId' = ${documentId}`
      )
      .orderBy(
        sql`(${vectorChunks.metadata}->>'pageNo')::int`,
        sql`(${vectorChunks.metadata}->>'chunkIndex')::int`
      );
  }

  async createVectorChunks(chunks: InsertVectorChunk[]): Promise<VectorChunk[]> {
    if (chunks.length === 0) return [];
    const created = await db.insert(vectorChunks).values(chunks).returning();
    return created;
  }

  async deleteVectorChunksForDocument(documentId: string): Promise<void> {
    await db.delete(vectorChunks).where(
      sql`${vectorChunks.metadata}->>'documentId' = ${documentId}`
    );
  }

  async searchVectorChunks(projectId: string, queryEmbedding: number[], limit: number = 10): Promise<any[]> {
    // Use pgvector's <=> operator for cosine distance (lower is better)
    // 1 - distance gives us similarity (higher is better)
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    
    const results = await db.execute(sql`
      SELECT 
        id,
        project_id as "projectId",
        source_type as "sourceType",
        source_id as "sourceId",
        content_text as "contentText",
        metadata,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM vector_chunks
      WHERE project_id = ${projectId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    return results.rows as any[];
  }

  // KPIs
  async getKpi(id: string): Promise<Kpi | undefined> {
    const [kpi] = await db.select().from(kpis).where(eq(kpis.id, id));
    return kpi || undefined;
  }

  async getKpisForProject(projectId: string): Promise<Kpi[]> {
    return db.select()
      .from(kpis)
      .where(eq(kpis.projectId, projectId))
      .orderBy(kpis.category, kpis.name);
  }

  async createKpi(kpi: InsertKpi): Promise<Kpi> {
    const [created] = await db.insert(kpis).values(kpi).returning();
    return created;
  }

  async updateKpi(id: string, updates: Partial<InsertKpi>): Promise<Kpi> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(kpis)
      .set(updateData)
      .where(eq(kpis.id, id))
      .returning();
    return updated;
  }

  async deleteKpi(id: string): Promise<void> {
    await db.delete(kpis).where(eq(kpis.id, id));
  }

  // Findings
  async getFinding(id: string): Promise<Finding | undefined> {
    const [finding] = await db.select().from(findings).where(eq(findings.id, id));
    return finding || undefined;
  }

  async getFindingsForProject(projectId: string): Promise<Finding[]> {
    return db.select()
      .from(findings)
      .where(eq(findings.projectId, projectId))
      .orderBy(desc(findings.createdAt));
  }

  async createFinding(finding: InsertFinding): Promise<Finding> {
    const [created] = await db.insert(findings).values(finding).returning();
    return created;
  }

  async updateFinding(id: string, updates: Partial<InsertFinding>): Promise<Finding> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(findings)
      .set(updateData)
      .where(eq(findings.id, id))
      .returning();
    return updated;
  }

  async deleteFinding(id: string): Promise<void> {
    await db.delete(findings).where(eq(findings.id, id));
  }

  // Recommendations
  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    const [recommendation] = await db.select().from(recommendations).where(eq(recommendations.id, id));
    return recommendation || undefined;
  }

  async getRecommendationsForProject(projectId: string): Promise<Recommendation[]> {
    return db.select()
      .from(recommendations)
      .where(eq(recommendations.projectId, projectId))
      .orderBy(desc(recommendations.createdAt));
  }

  async createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation> {
    const [created] = await db.insert(recommendations).values(recommendation).returning();
    return created;
  }

  async updateRecommendation(id: string, updates: Partial<InsertRecommendation>): Promise<Recommendation> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(recommendations)
      .set(updateData)
      .where(eq(recommendations.id, id))
      .returning();
    return updated;
  }

  async deleteRecommendation(id: string): Promise<void> {
    await db.delete(recommendations).where(eq(recommendations.id, id));
  }

  // CDD Reports
  async getCddReport(id: string): Promise<CddReport | undefined> {
    const [report] = await db.select().from(cddReports).where(eq(cddReports.id, id));
    return report || undefined;
  }

  async getCddReportsForProject(projectId: string): Promise<CddReport[]> {
    return db.select()
      .from(cddReports)
      .where(eq(cddReports.projectId, projectId))
      .orderBy(desc(cddReports.version), desc(cddReports.createdAt));
  }

  async createCddReport(report: InsertCddReport): Promise<CddReport> {
    const [created] = await db.insert(cddReports).values(report).returning();
    return created;
  }

  async updateCddReport(id: string, updates: Partial<InsertCddReport>): Promise<CddReport> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(cddReports)
      .set(updateData)
      .where(eq(cddReports.id, id))
      .returning();
    return updated;
  }

  async deleteCddReport(id: string): Promise<void> {
    await db.delete(cddReports).where(eq(cddReports.id, id));
  }

  // CRM - Deals
  async getCrmDeal(id: string): Promise<CrmDeal | undefined> {
    const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, id));
    return deal || undefined;
  }

  async getCrmDealsForOrg(orgId: string): Promise<CrmDeal[]> {
    return db.select().from(crmDeals).where(eq(crmDeals.ownerId, orgId)).orderBy(desc(crmDeals.createdAt));
  }

  async getCrmDealsForOrgPaginated(
    orgId: string,
    options: { page: number; pageSize: number; sortBy?: string; sortDir?: 'asc' | 'desc'; search?: string; stageId?: string }
  ): Promise<{ data: CrmDeal[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const { page, pageSize, search, sortBy = 'createdAt', sortDir = 'desc', stageId } = options;
    const offset = (page - 1) * pageSize;

    let whereConditions: any = eq(crmDeals.ownerId, orgId);

    if (stageId) {
      whereConditions = and(whereConditions, eq(crmDeals.stageId, stageId));
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.toLowerCase()}%`;
      whereConditions = and(
        whereConditions,
        or(
          sql`LOWER(${crmDeals.name}) LIKE ${searchTerm}`,
          sql`LOWER(${crmDeals.description}) LIKE ${searchTerm}`
        )
      );
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmDeals)
      .where(whereConditions);
    
    const total = countResult?.count || 0;

    const orderColumn = sortBy === 'name' ? crmDeals.name :
                        sortBy === 'value' ? crmDeals.value :
                        sortBy === 'createdAt' ? crmDeals.createdAt :
                        sortBy === 'updatedAt' ? crmDeals.updatedAt :
                        crmDeals.createdAt;

    const data = await db
      .select()
      .from(crmDeals)
      .where(whereConditions)
      .orderBy(sortDir === 'asc' ? asc(orderColumn) : desc(orderColumn))
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async getCrmDealsByPipeline(pipelineId: string): Promise<CrmDeal[]> {
    return db.select().from(crmDeals).where(eq(crmDeals.pipelineId, pipelineId)).orderBy(desc(crmDeals.createdAt));
  }

  async getCrmDealsByStage(stageId: string): Promise<CrmDeal[]> {
    return db.select().from(crmDeals).where(eq(crmDeals.stageId, stageId)).orderBy(desc(crmDeals.createdAt));
  }

  async createCrmDeal(deal: InsertCrmDeal): Promise<CrmDeal> {
    const [created] = await db.insert(crmDeals).values(deal).returning();
    return created;
  }

  async updateCrmDeal(id: string, updates: Partial<InsertCrmDeal>): Promise<CrmDeal> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmDeals)
      .set(updateData)
      .where(eq(crmDeals.id, id))
      .returning();
    return updated;
  }

  async deleteCrmDeal(id: string): Promise<void> {
    await db.delete(crmDeals).where(eq(crmDeals.id, id));
  }

  // CRM - Deal-Contact Relationships
  async getDealContacts(dealId: string): Promise<Array<{ id: string; dealId: string; contactId: string; role: string | null; isPrimary: boolean; notes: string | null; contact?: CrmContact }>> {
    const results = await db
      .select({
        id: crmDealContacts.id,
        dealId: crmDealContacts.dealId,
        contactId: crmDealContacts.contactId,
        role: crmDealContacts.role,
        isPrimary: crmDealContacts.isPrimary,
        notes: crmDealContacts.notes,
        contact: crmContacts,
      })
      .from(crmDealContacts)
      .leftJoin(crmContacts, eq(crmDealContacts.contactId, crmContacts.id))
      .where(eq(crmDealContacts.dealId, dealId));
    return results.map(r => ({
      ...r,
      isPrimary: r.isPrimary ?? false,
      contact: r.contact || undefined,
    }));
  }

  async addContactToDeal(dealId: string, contactId: string, role?: string, isPrimary?: boolean, notes?: string): Promise<{ id: string }> {
    const [created] = await db.insert(crmDealContacts).values({
      dealId,
      contactId,
      role: role || null,
      isPrimary: isPrimary ?? false,
      notes: notes || null,
    }).returning({ id: crmDealContacts.id });
    return created;
  }

  async updateDealContact(id: string, updates: { role?: string; isPrimary?: boolean; notes?: string }): Promise<{ id: string }> {
    const [updated] = await db.update(crmDealContacts)
      .set({
        ...(updates.role !== undefined ? { role: updates.role } : {}),
        ...(updates.isPrimary !== undefined ? { isPrimary: updates.isPrimary } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      })
      .where(eq(crmDealContacts.id, id))
      .returning({ id: crmDealContacts.id });
    return updated;
  }

  async removeContactFromDeal(id: string): Promise<void> {
    await db.delete(crmDealContacts).where(eq(crmDealContacts.id, id));
  }

  // CRM - Deal-Company Relationships
  async getDealCompanies(dealId: string): Promise<Array<{ id: string; dealId: string; companyId: string; role: string | null; isPrimary: boolean; notes: string | null; company?: CrmCompany }>> {
    const results = await db
      .select({
        id: crmDealCompanies.id,
        dealId: crmDealCompanies.dealId,
        companyId: crmDealCompanies.companyId,
        role: crmDealCompanies.role,
        isPrimary: crmDealCompanies.isPrimary,
        notes: crmDealCompanies.notes,
        company: crmCompanies,
      })
      .from(crmDealCompanies)
      .leftJoin(crmCompanies, eq(crmDealCompanies.companyId, crmCompanies.id))
      .where(eq(crmDealCompanies.dealId, dealId));
    return results.map(r => ({
      ...r,
      isPrimary: r.isPrimary ?? false,
      company: r.company || undefined,
    }));
  }

  async addCompanyToDeal(dealId: string, companyId: string, role?: string, isPrimary?: boolean, notes?: string): Promise<{ id: string }> {
    const [created] = await db.insert(crmDealCompanies).values({
      dealId,
      companyId,
      role: role || null,
      isPrimary: isPrimary ?? false,
      notes: notes || null,
    }).returning({ id: crmDealCompanies.id });
    return created;
  }

  async updateDealCompany(id: string, updates: { role?: string; isPrimary?: boolean; notes?: string }): Promise<{ id: string }> {
    const [updated] = await db.update(crmDealCompanies)
      .set({
        ...(updates.role !== undefined ? { role: updates.role } : {}),
        ...(updates.isPrimary !== undefined ? { isPrimary: updates.isPrimary } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      })
      .where(eq(crmDealCompanies.id, id))
      .returning({ id: crmDealCompanies.id });
    return updated;
  }

  async removeCompanyFromDeal(id: string): Promise<void> {
    await db.delete(crmDealCompanies).where(eq(crmDealCompanies.id, id));
  }

  // CRM - Leads
  async getCrmLead(id: string): Promise<CrmLead | undefined> {
    const [lead] = await db.select().from(crmLeads).where(eq(crmLeads.id, id));
    return lead || undefined;
  }

  async getCrmLeadsForOrg(orgId: string): Promise<CrmLead[]> {
    return db.select().from(crmLeads).where(eq(crmLeads.assignedToId, orgId)).orderBy(desc(crmLeads.createdAt));
  }

  async getCrmLeadsByStatus(orgId: string, status: string): Promise<CrmLead[]> {
    return db.select().from(crmLeads)
      .where(and(eq(crmLeads.assignedToId, orgId), eq(crmLeads.leadStatus, status)))
      .orderBy(desc(crmLeads.createdAt));
  }

  async createCrmLead(lead: InsertCrmLead): Promise<CrmLead> {
    const [created] = await db.insert(crmLeads).values(lead).returning();
    return created;
  }

  async updateCrmLead(id: string, updates: Partial<InsertCrmLead>): Promise<CrmLead> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmLeads)
      .set(updateData)
      .where(eq(crmLeads.id, id))
      .returning();
    return updated;
  }

  async deleteCrmLead(id: string): Promise<void> {
    await db.delete(crmLeads).where(eq(crmLeads.id, id));
  }

  // CRM - Contacts
  async getCrmContact(id: string): Promise<CrmContact | undefined> {
    const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, id));
    return contact || undefined;
  }

  async getCrmContactsForOrg(orgId: string): Promise<CrmContact[]> {
    return db.select().from(crmContacts).where(eq(crmContacts.ownerId, orgId)).orderBy(desc(crmContacts.createdAt));
  }

  async getCrmContactsForOrgPaginated(
    orgId: string,
    options: { page: number; pageSize: number; sortBy?: string; sortDir?: 'asc' | 'desc'; search?: string; companyId?: string }
  ): Promise<{ data: CrmContact[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const { page, pageSize, search, sortBy = 'createdAt', sortDir = 'desc', companyId } = options;
    const offset = (page - 1) * pageSize;

    let whereConditions: any = eq(crmContacts.ownerId, orgId);

    if (companyId) {
      whereConditions = and(whereConditions, eq(crmContacts.companyId, companyId));
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.toLowerCase()}%`;
      whereConditions = and(
        whereConditions,
        or(
          sql`LOWER(${crmContacts.firstName}) LIKE ${searchTerm}`,
          sql`LOWER(${crmContacts.lastName}) LIKE ${searchTerm}`,
          sql`LOWER(${crmContacts.email}) LIKE ${searchTerm}`,
          sql`LOWER(${crmContacts.phone}) LIKE ${searchTerm}`,
          sql`LOWER(${crmContacts.companyName}) LIKE ${searchTerm}`
        )
      );
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmContacts)
      .where(whereConditions);
    
    const total = countResult?.count || 0;

    const orderColumn = sortBy === 'firstName' ? crmContacts.firstName :
                        sortBy === 'lastName' ? crmContacts.lastName :
                        sortBy === 'email' ? crmContacts.email :
                        sortBy === 'createdAt' ? crmContacts.createdAt :
                        crmContacts.createdAt;

    const data = await db
      .select()
      .from(crmContacts)
      .where(whereConditions)
      .orderBy(sortDir === 'asc' ? asc(orderColumn) : desc(orderColumn))
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async getCrmContactsByCompany(companyId: string): Promise<CrmContact[]> {
    return db.select().from(crmContacts).where(eq(crmContacts.companyId, companyId)).orderBy(asc(crmContacts.lastName));
  }

  async createCrmContact(contact: InsertCrmContact): Promise<CrmContact> {
    const [created] = await db.insert(crmContacts).values(contact).returning();
    return created;
  }

  async updateCrmContact(id: string, updates: Partial<InsertCrmContact>): Promise<CrmContact> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmContacts)
      .set(updateData)
      .where(eq(crmContacts.id, id))
      .returning();
    return updated;
  }

  async deleteCrmContact(id: string): Promise<void> {
    await db.delete(crmContacts).where(eq(crmContacts.id, id));
  }

  // CRM - Companies
  async getCrmCompany(id: string): Promise<CrmCompany | undefined> {
    const [company] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, id));
    return company || undefined;
  }

  async getCrmCompaniesForOrg(orgId: string): Promise<CrmCompany[]> {
    return db.select().from(crmCompanies).where(eq(crmCompanies.ownerId, orgId)).orderBy(asc(crmCompanies.name));
  }

  async getCrmCompaniesForOrgPaginated(
    orgId: string,
    options: { page: number; pageSize: number; sortBy?: string; sortDir?: 'asc' | 'desc'; search?: string }
  ): Promise<{ data: CrmCompany[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const { page, pageSize, search, sortBy = 'name', sortDir = 'asc' } = options;
    const offset = (page - 1) * pageSize;

    let whereConditions: any = eq(crmCompanies.ownerId, orgId);

    if (search && search.trim()) {
      const searchTerm = `%${search.toLowerCase()}%`;
      whereConditions = and(
        whereConditions,
        or(
          sql`LOWER(${crmCompanies.name}) LIKE ${searchTerm}`,
          sql`LOWER(${crmCompanies.website}) LIKE ${searchTerm}`,
          sql`LOWER(${crmCompanies.industry}) LIKE ${searchTerm}`
        )
      );
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crmCompanies)
      .where(whereConditions);
    
    const total = countResult?.count || 0;

    const orderColumn = sortBy === 'name' ? crmCompanies.name :
                        sortBy === 'createdAt' ? crmCompanies.createdAt :
                        sortBy === 'updatedAt' ? crmCompanies.updatedAt :
                        crmCompanies.name;

    const data = await db
      .select()
      .from(crmCompanies)
      .where(whereConditions)
      .orderBy(sortDir === 'asc' ? asc(orderColumn) : desc(orderColumn))
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async createCrmCompany(company: InsertCrmCompany): Promise<CrmCompany> {
    const [created] = await db.insert(crmCompanies).values(company).returning();
    return created;
  }

  async updateCrmCompany(id: string, updates: Partial<InsertCrmCompany>): Promise<CrmCompany> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmCompanies)
      .set(updateData)
      .where(eq(crmCompanies.id, id))
      .returning();
    return updated;
  }

  async deleteCrmCompany(id: string): Promise<void> {
    await db.delete(crmCompanies).where(eq(crmCompanies.id, id));
  }

  // CRM - Properties
  async getCrmProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select()
      .from(crmProperties)
      .where(eq(crmProperties.id, id));
    return property || undefined;
  }

  async getCrmPropertiesForOrg(orgId: string): Promise<Property[]> {
    return await db.select()
      .from(crmProperties)
      .where(eq(crmProperties.ownerId, orgId));
  }

  async createCrmProperty(property: InsertProperty): Promise<Property> {
    const [created] = await db.insert(crmProperties).values(property).returning();
    return created;
  }

  async updateCrmProperty(id: string, updates: Partial<InsertProperty>): Promise<Property> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmProperties)
      .set(updateData)
      .where(eq(crmProperties.id, id))
      .returning();
    return updated;
  }

  async deleteCrmProperty(id: string): Promise<void> {
    await db.delete(crmProperties).where(eq(crmProperties.id, id));
  }

  // CRM - Property-Contact/Company Links
  async getPropertyContacts(propertyId: string): Promise<Array<{ id: string; contactId: string; propertyId: string; relationship?: string | null; notes?: string | null; contact?: any }>> {
    const links = await db.select({
      id: crmContactProperties.id,
      contactId: crmContactProperties.contactId,
      propertyId: crmContactProperties.propertyId,
      relationship: crmContactProperties.relationship,
      notes: crmContactProperties.notes,
      contact: crmContacts
    })
    .from(crmContactProperties)
    .leftJoin(crmContacts, eq(crmContactProperties.contactId, crmContacts.id))
    .where(eq(crmContactProperties.propertyId, propertyId));
    return links;
  }

  async getPropertyCompanies(propertyId: string): Promise<Array<{ id: string; companyId: string; propertyId: string; relationship?: string | null; notes?: string | null; company?: any }>> {
    const links = await db.select({
      id: crmCompanyProperties.id,
      companyId: crmCompanyProperties.companyId,
      propertyId: crmCompanyProperties.propertyId,
      relationship: crmCompanyProperties.relationship,
      notes: crmCompanyProperties.notes,
      company: crmCompanies
    })
    .from(crmCompanyProperties)
    .leftJoin(crmCompanies, eq(crmCompanyProperties.companyId, crmCompanies.id))
    .where(eq(crmCompanyProperties.propertyId, propertyId));
    return links;
  }

  async linkPropertyToContact(propertyId: string, contactId: string, relationship?: string, notes?: string): Promise<{ id: string }> {
    const [link] = await db.insert(crmContactProperties).values({
      propertyId,
      contactId,
      relationship: relationship || null,
      notes: notes || null
    }).returning({ id: crmContactProperties.id });
    return link;
  }

  async linkPropertyToCompany(propertyId: string, companyId: string, relationship?: string, notes?: string): Promise<{ id: string }> {
    const [link] = await db.insert(crmCompanyProperties).values({
      propertyId,
      companyId,
      relationship: relationship || null,
      notes: notes || null
    }).returning({ id: crmCompanyProperties.id });
    return link;
  }

  async unlinkPropertyFromContact(linkId: string): Promise<void> {
    await db.delete(crmContactProperties).where(eq(crmContactProperties.id, linkId));
  }

  async unlinkPropertyFromCompany(linkId: string): Promise<void> {
    await db.delete(crmCompanyProperties).where(eq(crmCompanyProperties.id, linkId));
  }

  // CRM - Contact Links
  async getContactCompanies(contactId: string): Promise<Array<{ id: string; contactId: string; companyId: string; role?: string | null; isPrimary: boolean; company?: any }>> {
    const links = await db.select({
      id: crmContactCompanies.id,
      contactId: crmContactCompanies.contactId,
      companyId: crmContactCompanies.companyId,
      role: crmContactCompanies.role,
      isPrimary: crmContactCompanies.isPrimary,
      company: crmCompanies
    })
    .from(crmContactCompanies)
    .leftJoin(crmCompanies, eq(crmContactCompanies.companyId, crmCompanies.id))
    .where(eq(crmContactCompanies.contactId, contactId));
    return links;
  }

  async getContactProperties(contactId: string): Promise<Array<{ id: string; contactId: string; propertyId: string; relationship?: string | null; property?: any }>> {
    const links = await db.select({
      id: crmContactProperties.id,
      contactId: crmContactProperties.contactId,
      propertyId: crmContactProperties.propertyId,
      relationship: crmContactProperties.relationship,
      property: crmProperties
    })
    .from(crmContactProperties)
    .leftJoin(crmProperties, eq(crmContactProperties.propertyId, crmProperties.id))
    .where(eq(crmContactProperties.contactId, contactId));
    return links;
  }

  async unlinkContactFromProperty(linkId: string): Promise<void> {
    await db.delete(crmContactProperties).where(eq(crmContactProperties.id, linkId));
  }

  // CRM - Company Links
  async getCompanyContacts(companyId: string): Promise<Array<{ id: string; contactId: string; companyId: string; role?: string | null; isPrimary: boolean; contact?: any }>> {
    const links = await db.select({
      id: crmContactCompanies.id,
      contactId: crmContactCompanies.contactId,
      companyId: crmContactCompanies.companyId,
      role: crmContactCompanies.role,
      isPrimary: crmContactCompanies.isPrimary,
      contact: crmContacts
    })
    .from(crmContactCompanies)
    .leftJoin(crmContacts, eq(crmContactCompanies.contactId, crmContacts.id))
    .where(eq(crmContactCompanies.companyId, companyId));
    return links;
  }

  async getCompanyProperties(companyId: string): Promise<Array<{ id: string; companyId: string; propertyId: string; relationship?: string | null; property?: any }>> {
    const links = await db.select({
      id: crmCompanyProperties.id,
      companyId: crmCompanyProperties.companyId,
      propertyId: crmCompanyProperties.propertyId,
      relationship: crmCompanyProperties.relationship,
      property: crmProperties
    })
    .from(crmCompanyProperties)
    .leftJoin(crmProperties, eq(crmCompanyProperties.propertyId, crmProperties.id))
    .where(eq(crmCompanyProperties.companyId, companyId));
    return links;
  }

  async unlinkCompanyFromProperty(linkId: string): Promise<void> {
    await db.delete(crmCompanyProperties).where(eq(crmCompanyProperties.id, linkId));
  }

  // CRM - Pending Contacts
  async getPendingContact(id: string): Promise<PendingContact | undefined> {
    const [contact] = await db.select()
      .from(pendingContacts)
      .where(eq(pendingContacts.id, id));
    return contact || undefined;
  }

  async getPendingContactsForOrg(orgId: string): Promise<PendingContact[]> {
    return await db.select()
      .from(pendingContacts)
      .where(and(
        eq(pendingContacts.orgId, orgId),
        eq(pendingContacts.status, 'pending')
      ))
      .orderBy(desc(pendingContacts.createdAt));
  }

  async createPendingContact(contact: InsertPendingContact): Promise<PendingContact> {
    const [created] = await db.insert(pendingContacts).values(contact).returning();
    return created;
  }

  async acceptPendingContact(id: string, userId: string, mode: 'replace' | 'add_new'): Promise<CrmContact> {
    const pending = await this.getPendingContact(id);
    if (!pending) throw new Error('Pending contact not found');

    let createdContact: CrmContact;

    if (mode === 'replace' && pending.suggestedDuplicates && Array.isArray(pending.suggestedDuplicates) && pending.suggestedDuplicates.length > 0) {
      const duplicateId = pending.suggestedDuplicates[0] as string;
      const updateData: Partial<InsertCrmContact> = {
        firstName: pending.firstName || undefined,
        lastName: pending.lastName || undefined,
        email: pending.email || undefined,
        phone: pending.phone || undefined,
        companyId: pending.companyId || undefined,
        jobTitle: pending.jobTitle || undefined,
        updatedAt: new Date()
      };
      createdContact = await this.updateCrmContact(duplicateId, updateData);
    } else {
      const contactData: InsertCrmContact = {
        ownerId: pending.orgId,
        firstName: pending.firstName || '',
        lastName: pending.lastName || '',
        fullName: pending.fullName || `${pending.firstName || ''} ${pending.lastName || ''}`.trim(),
        email: pending.email || undefined,
        phone: pending.phone || undefined,
        companyId: pending.companyId || undefined,
        jobTitle: pending.jobTitle || undefined,
        contactTag: 'other',
        leadStatus: 'none',
        createdBy: userId
      };
      createdContact = await this.createCrmContact(contactData);
    }

    await db.update(pendingContacts)
      .set({ 
        status: 'accepted',
        createdContactId: createdContact.id,
        reviewedBy: userId,
        reviewedAt: new Date()
      })
      .where(eq(pendingContacts.id, id));

    return createdContact;
  }

  async rejectPendingContact(id: string, userId: string): Promise<void> {
    await db.update(pendingContacts)
      .set({ 
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date()
      })
      .where(eq(pendingContacts.id, id));
  }

  // CRM - Pending Companies
  async getPendingCompany(id: string): Promise<PendingCompany | undefined> {
    const [company] = await db.select()
      .from(pendingCompanies)
      .where(eq(pendingCompanies.id, id));
    return company || undefined;
  }

  async getPendingCompaniesForOrg(orgId: string): Promise<PendingCompany[]> {
    return await db.select()
      .from(pendingCompanies)
      .where(and(
        eq(pendingCompanies.orgId, orgId),
        eq(pendingCompanies.status, 'pending')
      ))
      .orderBy(desc(pendingCompanies.createdAt));
  }

  async createPendingCompany(company: InsertPendingCompany): Promise<PendingCompany> {
    const [created] = await db.insert(pendingCompanies).values(company).returning();
    return created;
  }

  async acceptPendingCompany(id: string, userId: string, mode: 'replace' | 'add_new'): Promise<CrmCompany> {
    const pending = await this.getPendingCompany(id);
    if (!pending) throw new Error('Pending company not found');

    let createdCompany: CrmCompany;

    if (mode === 'replace' && pending.suggestedDuplicates && Array.isArray(pending.suggestedDuplicates) && pending.suggestedDuplicates.length > 0) {
      const duplicateId = pending.suggestedDuplicates[0] as string;
      const updateData: Partial<InsertCrmCompany> = {
        name: pending.name,
        website: pending.website || undefined,
        phone: pending.phone || undefined,
        address: pending.address || undefined,
        city: pending.city || undefined,
        state: pending.state || undefined,
        zipCode: pending.zipCode || undefined,
        industry: pending.industry || undefined,
        updatedAt: new Date()
      };
      createdCompany = await this.updateCrmCompany(duplicateId, updateData);
    } else {
      const companyData: InsertCrmCompany = {
        ownerId: pending.orgId,
        name: pending.name,
        website: pending.website || undefined,
        phone: pending.phone || undefined,
        address: pending.address || undefined,
        city: pending.city || undefined,
        state: pending.state || undefined,
        zipCode: pending.zipCode || undefined,
        industry: pending.industry || undefined,
        createdBy: userId
      };
      createdCompany = await this.createCrmCompany(companyData);
    }

    await db.update(pendingCompanies)
      .set({ 
        status: 'accepted',
        createdCompanyId: createdCompany.id,
        reviewedBy: userId,
        reviewedAt: new Date()
      })
      .where(eq(pendingCompanies.id, id));

    return createdCompany;
  }

  async rejectPendingCompany(id: string, userId: string): Promise<void> {
    await db.update(pendingCompanies)
      .set({ 
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date()
      })
      .where(eq(pendingCompanies.id, id));
  }

  // CRM - Pending Properties
  async getPendingProperty(id: string): Promise<PendingProperty | undefined> {
    const [property] = await db.select()
      .from(pendingProperties)
      .where(eq(pendingProperties.id, id));
    return property || undefined;
  }

  async getPendingPropertiesForOrg(orgId: string): Promise<PendingProperty[]> {
    return await db.select()
      .from(pendingProperties)
      .where(and(
        eq(pendingProperties.orgId, orgId),
        eq(pendingProperties.status, 'pending')
      ))
      .orderBy(desc(pendingProperties.createdAt));
  }

  async createPendingProperty(property: InsertPendingProperty): Promise<PendingProperty> {
    const [created] = await db.insert(pendingProperties).values(property).returning();
    return created;
  }

  async acceptPendingProperty(id: string, userId: string, mode: 'replace' | 'add_new'): Promise<Property> {
    const pending = await this.getPendingProperty(id);
    if (!pending) throw new Error('Pending property not found');

    let createdProperty: Property;

    if (mode === 'replace' && pending.suggestedDuplicates && Array.isArray(pending.suggestedDuplicates) && pending.suggestedDuplicates.length > 0) {
      const duplicateId = pending.suggestedDuplicates[0] as string;
      const updateData: Partial<InsertProperty> = {
        marinaName: pending.marinaName,
        city: pending.city || undefined,
        state: pending.state || undefined,
        address: pending.address || undefined,
        listingPrice: pending.salePrice || undefined,
        updatedAt: new Date()
      };
      createdProperty = await this.updateCrmProperty(duplicateId, updateData);
    } else {
      const propertyData: InsertProperty = {
        ownerId: pending.orgId,
        marinaName: pending.marinaName,
        city: pending.city || undefined,
        state: pending.state || undefined,
        address: pending.address || undefined,
        listingPrice: pending.salePrice || undefined,
        status: 'For Sale',
        createdBy: userId
      };
      createdProperty = await this.createCrmProperty(propertyData);
    }

    await db.update(pendingProperties)
      .set({ 
        status: 'accepted',
        createdPropertyId: createdProperty.id,
        reviewedBy: userId,
        reviewedAt: new Date()
      })
      .where(eq(pendingProperties.id, id));

    return createdProperty;
  }

  async rejectPendingProperty(id: string, userId: string): Promise<void> {
    await db.update(pendingProperties)
      .set({ 
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date()
      })
      .where(eq(pendingProperties.id, id));
  }

  // CRM - Pipelines
  async getCrmPipeline(id: string): Promise<CrmPipeline | undefined> {
    const [pipeline] = await db.select().from(crmPipelines).where(eq(crmPipelines.id, id));
    return pipeline || undefined;
  }

  async getCrmPipelinesForOrg(orgId: string): Promise<CrmPipeline[]> {
    return db.select().from(crmPipelines).where(eq(crmPipelines.ownerId, orgId)).orderBy(asc(crmPipelines.name));
  }

  async createCrmPipeline(pipeline: InsertCrmPipeline): Promise<CrmPipeline> {
    const [created] = await db.insert(crmPipelines).values(pipeline).returning();
    return created;
  }

  async updateCrmPipeline(id: string, updates: Partial<InsertCrmPipeline>): Promise<CrmPipeline> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmPipelines)
      .set(updateData)
      .where(eq(crmPipelines.id, id))
      .returning();
    return updated;
  }

  async deleteCrmPipeline(id: string): Promise<void> {
    await db.delete(crmPipelines).where(eq(crmPipelines.id, id));
  }

  // CRM - Pipeline Stages
  async getCrmPipelineStage(id: string): Promise<CrmPipelineStage | undefined> {
    const [stage] = await db.select().from(crmPipelineStages).where(eq(crmPipelineStages.id, id));
    return stage || undefined;
  }

  async getAllCrmPipelineStages(orgId: string): Promise<CrmPipelineStage[]> {
    // Get all pipelines for the org first
    const pipelines = await db.select().from(crmPipelines).where(eq(crmPipelines.ownerId, orgId));
    const pipelineIds = pipelines.map(p => p.id);
    
    if (pipelineIds.length === 0) return [];
    
    // Get all stages for those pipelines
    return db.select().from(crmPipelineStages)
      .where(sql`${crmPipelineStages.pipelineId} IN ${pipelineIds}`)
      .orderBy(asc(crmPipelineStages.stageOrder));
  }

  async getCrmPipelineStagesByPipeline(pipelineId: string): Promise<CrmPipelineStage[]> {
    return db.select().from(crmPipelineStages)
      .where(eq(crmPipelineStages.pipelineId, pipelineId))
      .orderBy(asc(crmPipelineStages.stageOrder));
  }

  async createCrmPipelineStage(stage: InsertCrmPipelineStage): Promise<CrmPipelineStage> {
    const [created] = await db.insert(crmPipelineStages).values(stage).returning();
    return created;
  }

  async updateCrmPipelineStage(id: string, updates: Partial<InsertCrmPipelineStage>): Promise<CrmPipelineStage> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmPipelineStages)
      .set(updateData)
      .where(eq(crmPipelineStages.id, id))
      .returning();
    return updated;
  }

  async deleteCrmPipelineStage(id: string): Promise<void> {
    await db.delete(crmPipelineStages).where(eq(crmPipelineStages.id, id));
  }

  // CRM - Activities
  async getCrmActivity(id: string): Promise<CrmActivity | undefined> {
    const [activity] = await db.select().from(crmActivities).where(eq(crmActivities.id, id));
    return activity || undefined;
  }

  async getCrmActivitiesForOrg(orgId: string): Promise<CrmActivity[]> {
    return db.select().from(crmActivities).where(eq(crmActivities.userId, orgId)).orderBy(desc(crmActivities.createdAt));
  }

  async getCrmActivitiesByDeal(dealId: string): Promise<CrmActivity[]> {
    return db.select().from(crmActivities)
      .where(and(eq(crmActivities.entityType, 'deal'), eq(crmActivities.entityId, dealId)))
      .orderBy(desc(crmActivities.createdAt));
  }

  async getCrmActivitiesByLead(leadId: string): Promise<CrmActivity[]> {
    return db.select().from(crmActivities)
      .where(and(eq(crmActivities.entityType, 'lead'), eq(crmActivities.entityId, leadId)))
      .orderBy(desc(crmActivities.createdAt));
  }

  async getCrmActivitiesByContact(contactId: string): Promise<CrmActivity[]> {
    return db.select().from(crmActivities)
      .where(and(eq(crmActivities.entityType, 'contact'), eq(crmActivities.entityId, contactId)))
      .orderBy(desc(crmActivities.createdAt));
  }

  async createCrmActivity(activity: InsertCrmActivity): Promise<CrmActivity> {
    const [created] = await db.insert(crmActivities).values(activity).returning();
    return created;
  }

  async updateCrmActivity(id: string, updates: Partial<InsertCrmActivity>): Promise<CrmActivity> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmActivities)
      .set(updateData)
      .where(eq(crmActivities.id, id))
      .returning();
    return updated;
  }

  async deleteCrmActivity(id: string): Promise<void> {
    await db.delete(crmActivities).where(eq(crmActivities.id, id));
  }

  // CRM - Import Jobs
  async getImportJob(id: string): Promise<CrmImportJob | undefined> {
    const [job] = await db.select().from(crmImportJobs).where(eq(crmImportJobs.id, id));
    return job || undefined;
  }

  async getImportJobsForOrg(ownerId: string): Promise<CrmImportJob[]> {
    return db.select().from(crmImportJobs)
      .where(eq(crmImportJobs.ownerId, ownerId))
      .orderBy(desc(crmImportJobs.createdAt));
  }

  async createImportJob(job: InsertCrmImportJob): Promise<CrmImportJob> {
    const [created] = await db.insert(crmImportJobs).values(job).returning();
    return created;
  }

  async updateImportJob(id: string, updates: Partial<InsertCrmImportJob>): Promise<CrmImportJob> {
    const [updated] = await db.update(crmImportJobs)
      .set(updates)
      .where(eq(crmImportJobs.id, id))
      .returning();
    return updated;
  }

  async createImportedRecord(record: InsertCrmImportedRecord): Promise<CrmImportedRecord> {
    const [created] = await db.insert(crmImportedRecords).values(record).returning();
    return created;
  }

  async getImportedRecordsByJob(importJobId: string): Promise<CrmImportedRecord[]> {
    return db.select().from(crmImportedRecords)
      .where(eq(crmImportedRecords.importJobId, importJobId))
      .orderBy(asc(crmImportedRecords.rowNumber));
  }

  // CRM - Prospecting
  async getProspectingEntry(id: string): Promise<ProspectingEntry | undefined> {
    const [entry] = await db.select().from(crmProspectingEntries).where(eq(crmProspectingEntries.id, id));
    return entry || undefined;
  }

  async getProspectingEntryByWeek(userId: string, year: number, quarter: number, weekNumber: number): Promise<ProspectingEntry | undefined> {
    const [entry] = await db.select().from(crmProspectingEntries)
      .where(and(
        eq(crmProspectingEntries.userId, userId),
        eq(crmProspectingEntries.year, year),
        eq(crmProspectingEntries.quarter, quarter),
        eq(crmProspectingEntries.weekNumber, weekNumber)
      ));
    return entry || undefined;
  }

  async getProspectingEntriesForUser(userId: string, year?: number): Promise<ProspectingEntry[]> {
    if (year) {
      return db.select().from(crmProspectingEntries)
        .where(and(
          eq(crmProspectingEntries.userId, userId),
          eq(crmProspectingEntries.year, year)
        ))
        .orderBy(asc(crmProspectingEntries.quarter), asc(crmProspectingEntries.weekNumber));
    } else {
      return db.select().from(crmProspectingEntries)
        .where(eq(crmProspectingEntries.userId, userId))
        .orderBy(desc(crmProspectingEntries.year), asc(crmProspectingEntries.quarter), asc(crmProspectingEntries.weekNumber));
    }
  }

  async createProspectingEntry(entry: InsertProspectingEntry): Promise<ProspectingEntry> {
    const [created] = await db.insert(crmProspectingEntries).values(entry).returning();
    return created;
  }

  async updateProspectingEntry(id: string, updates: Partial<InsertProspectingEntry>): Promise<ProspectingEntry> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmProspectingEntries)
      .set(updateData)
      .where(eq(crmProspectingEntries.id, id))
      .returning();
    return updated;
  }

  async deleteProspectingEntry(id: string): Promise<void> {
    await db.delete(crmProspectingEntries).where(eq(crmProspectingEntries.id, id));
  }

  // CRM - Prospecting Settings
  
  async getProspectingUserSettings(userId: string): Promise<CrmProspectingUserSettings | undefined> {
    const [settings] = await db.select().from(crmProspectingUserSettings)
      .where(eq(crmProspectingUserSettings.userId, userId));
    return settings || undefined;
  }

  async createProspectingUserSettings(settings: InsertCrmProspectingUserSettings): Promise<CrmProspectingUserSettings> {
    const [created] = await db.insert(crmProspectingUserSettings).values(settings).returning();
    return created;
  }

  async updateProspectingUserSettings(userId: string, updates: Partial<InsertCrmProspectingUserSettings>): Promise<CrmProspectingUserSettings> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmProspectingUserSettings)
      .set(updateData)
      .where(eq(crmProspectingUserSettings.userId, userId))
      .returning();
    return updated;
  }

  // CRM - Prospecting Goal Templates
  
  async getProspectingGoalTemplates(userId: string): Promise<CrmProspectingGoalTemplate[]> {
    return db.select().from(crmProspectingGoalTemplates)
      .where(and(
        eq(crmProspectingGoalTemplates.userId, userId),
        eq(crmProspectingGoalTemplates.isActive, true)
      ))
      .orderBy(desc(crmProspectingGoalTemplates.createdAt));
  }

  async getProspectingGoalTemplate(id: string): Promise<CrmProspectingGoalTemplate | undefined> {
    const [template] = await db.select().from(crmProspectingGoalTemplates)
      .where(eq(crmProspectingGoalTemplates.id, id));
    return template || undefined;
  }

  async createProspectingGoalTemplate(template: InsertCrmProspectingGoalTemplate): Promise<CrmProspectingGoalTemplate> {
    const [created] = await db.insert(crmProspectingGoalTemplates).values(template).returning();
    return created;
  }

  async updateProspectingGoalTemplate(id: string, updates: Partial<InsertCrmProspectingGoalTemplate>): Promise<CrmProspectingGoalTemplate> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmProspectingGoalTemplates)
      .set(updateData)
      .where(eq(crmProspectingGoalTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteProspectingGoalTemplate(id: string): Promise<void> {
    // Soft delete by marking as inactive
    await db.update(crmProspectingGoalTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(crmProspectingGoalTemplates.id, id));
  }

  // Marketing Automation - Email Sequences

  async getEmailSequence(id: string): Promise<EmailSequence | undefined> {
    const [sequence] = await db.select().from(crmEmailSequences).where(eq(crmEmailSequences.id, id));
    return sequence || undefined;
  }

  async getEmailSequencesForUser(userId: string): Promise<EmailSequence[]> {
    return db.select().from(crmEmailSequences)
      .where(eq(crmEmailSequences.createdById, userId))
      .orderBy(desc(crmEmailSequences.createdAt));
  }

  async createEmailSequence(sequence: InsertEmailSequence): Promise<EmailSequence> {
    const [created] = await db.insert(crmEmailSequences).values(sequence).returning();
    return created;
  }

  async updateEmailSequence(id: string, updates: Partial<InsertEmailSequence>): Promise<EmailSequence> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmEmailSequences)
      .set(updateData)
      .where(eq(crmEmailSequences.id, id))
      .returning();
    return updated;
  }

  async deleteEmailSequence(id: string): Promise<void> {
    await db.delete(crmEmailSequences).where(eq(crmEmailSequences.id, id));
  }

  // Marketing Automation - Email Templates

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(crmEmailTemplates).where(eq(crmEmailTemplates.id, id));
    return template || undefined;
  }

  async getEmailTemplatesForUser(userId: string): Promise<EmailTemplate[]> {
    return db.select().from(crmEmailTemplates)
      .where(eq(crmEmailTemplates.createdById, userId))
      .orderBy(desc(crmEmailTemplates.createdAt));
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [created] = await db.insert(crmEmailTemplates).values(template).returning();
    return created;
  }

  async updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmEmailTemplates)
      .set(updateData)
      .where(eq(crmEmailTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(crmEmailTemplates).where(eq(crmEmailTemplates.id, id));
  }

  // Marketing Automation - Sequence Steps

  async getEmailSequenceStep(id: string): Promise<EmailSequenceStep | undefined> {
    const [step] = await db.select().from(crmEmailSequenceSteps).where(eq(crmEmailSequenceSteps.id, id));
    return step || undefined;
  }

  async getEmailSequenceStepsBySequence(sequenceId: string): Promise<EmailSequenceStep[]> {
    return db.select().from(crmEmailSequenceSteps)
      .where(eq(crmEmailSequenceSteps.sequenceId, sequenceId))
      .orderBy(asc(crmEmailSequenceSteps.stepOrder));
  }

  async createEmailSequenceStep(step: InsertEmailSequenceStep): Promise<EmailSequenceStep> {
    const [created] = await db.insert(crmEmailSequenceSteps).values(step).returning();
    return created;
  }

  async updateEmailSequenceStep(id: string, updates: Partial<InsertEmailSequenceStep>): Promise<EmailSequenceStep> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmEmailSequenceSteps)
      .set(updateData)
      .where(eq(crmEmailSequenceSteps.id, id))
      .returning();
    return updated;
  }

  async deleteEmailSequenceStep(id: string): Promise<void> {
    await db.delete(crmEmailSequenceSteps).where(eq(crmEmailSequenceSteps.id, id));
  }

  // Marketing Automation - Enrollments

  async getEmailSequenceEnrollment(id: string): Promise<EmailSequenceEnrollment | undefined> {
    const [enrollment] = await db.select().from(crmEmailSequenceEnrollments).where(eq(crmEmailSequenceEnrollments.id, id));
    return enrollment || undefined;
  }

  async getEmailSequenceEnrollmentsForUser(userId: string): Promise<EmailSequenceEnrollment[]> {
    return db.select().from(crmEmailSequenceEnrollments)
      .where(eq(crmEmailSequenceEnrollments.enrolledById, userId))
      .orderBy(desc(crmEmailSequenceEnrollments.enrolledAt));
  }

  async getEmailSequenceEnrollmentsBySequence(sequenceId: string): Promise<EmailSequenceEnrollment[]> {
    return db.select().from(crmEmailSequenceEnrollments)
      .where(eq(crmEmailSequenceEnrollments.sequenceId, sequenceId))
      .orderBy(desc(crmEmailSequenceEnrollments.enrolledAt));
  }

  async getEmailSequenceEnrollmentsByEntity(entityType: string, entityId: string): Promise<EmailSequenceEnrollment[]> {
    return db.select().from(crmEmailSequenceEnrollments)
      .where(and(
        eq(crmEmailSequenceEnrollments.entityType, entityType),
        eq(crmEmailSequenceEnrollments.entityId, entityId)
      ))
      .orderBy(desc(crmEmailSequenceEnrollments.enrolledAt));
  }

  async createEmailSequenceEnrollment(enrollment: InsertEmailSequenceEnrollment): Promise<EmailSequenceEnrollment> {
    const [created] = await db.insert(crmEmailSequenceEnrollments).values(enrollment).returning();
    return created;
  }

  async updateEmailSequenceEnrollment(id: string, updates: Partial<InsertEmailSequenceEnrollment>): Promise<EmailSequenceEnrollment> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmEmailSequenceEnrollments)
      .set(updateData)
      .where(eq(crmEmailSequenceEnrollments.id, id))
      .returning();
    return updated;
  }

  async deleteEmailSequenceEnrollment(id: string): Promise<void> {
    await db.delete(crmEmailSequenceEnrollments).where(eq(crmEmailSequenceEnrollments.id, id));
  }

  // Marketing Automation - Step Executions

  async getEmailSequenceStepExecution(id: string): Promise<EmailSequenceStepExecution | undefined> {
    const [execution] = await db.select().from(crmEmailSequenceStepExecutions).where(eq(crmEmailSequenceStepExecutions.id, id));
    return execution || undefined;
  }

  async getEmailSequenceStepExecutionsByEnrollment(enrollmentId: string): Promise<EmailSequenceStepExecution[]> {
    return db.select().from(crmEmailSequenceStepExecutions)
      .where(eq(crmEmailSequenceStepExecutions.enrollmentId, enrollmentId))
      .orderBy(asc(crmEmailSequenceStepExecutions.scheduledAt));
  }

  async createEmailSequenceStepExecution(execution: InsertEmailSequenceStepExecution): Promise<EmailSequenceStepExecution> {
    const [created] = await db.insert(crmEmailSequenceStepExecutions).values(execution).returning();
    return created;
  }

  async updateEmailSequenceStepExecution(id: string, updates: Partial<InsertEmailSequenceStepExecution>): Promise<EmailSequenceStepExecution> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(crmEmailSequenceStepExecutions)
      .set(updateData)
      .where(eq(crmEmailSequenceStepExecutions.id, id))
      .returning();
    return updated;
  }

  // Calendar Settings

  async getCalendarSettings(userId: string): Promise<CalendarSettings | undefined> {
    const [settings] = await db.select().from(calendarSettings).where(eq(calendarSettings.userId, userId));
    return settings || undefined;
  }

  async createCalendarSettings(settings: InsertCalendarSettings): Promise<CalendarSettings> {
    const [created] = await db.insert(calendarSettings).values(settings).returning();
    return created;
  }

  async updateCalendarSettings(userId: string, updates: Partial<InsertCalendarSettings>): Promise<CalendarSettings> {
    const updateData = { ...updates, updatedAt: new Date() };
    const [updated] = await db.update(calendarSettings)
      .set(updateData)
      .where(eq(calendarSettings.userId, userId))
      .returning();
    return updated;
  }

  // ============================================================================
  // SALESCOMPS STORAGE METHODS
  // ============================================================================

  // Sales Comps Operations
  async getSalesComps(params: {
    orgId: string;
    filters?: Record<string, any>;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<{ comps: SalesComp[]; total: number }> {
    const { orgId, filters = {}, sortBy = 'createdAt', sortDir = 'desc', page = 1, pageSize = 25 } = params;
    
    const conditions = [eq(salesComps.orgId, orgId), isNull(salesComps.deletedAt)];
    
    if (filters.q) {
      conditions.push(sql`${salesComps.marina} ILIKE ${`%${filters.q}%`}`);
    }
    if (filters.states && filters.states.length > 0) {
      conditions.push(inArray(salesComps.state, filters.states));
    }
    if (filters.saleYearMin) {
      conditions.push(sql`${salesComps.saleYear} >= ${filters.saleYearMin}`);
    }
    if (filters.saleYearMax) {
      conditions.push(sql`${salesComps.saleYear} <= ${filters.saleYearMax}`);
    }
    if (filters.priceMin) {
      conditions.push(sql`${salesComps.salePrice} >= ${filters.priceMin}`);
    }
    if (filters.priceMax) {
      conditions.push(sql`${salesComps.salePrice} <= ${filters.priceMax}`);
    }
    if (filters.disclosedOnly) {
      conditions.push(isNotNull(salesComps.salePrice));
    }
    if (filters.disclosedCapRateOnly) {
      conditions.push(isNotNull(salesComps.capRate));
    }
    if (filters.portfoliosOnly) {
      conditions.push(eq(salesComps.isPortfolio, true));
    }

    const [{ total }] = await db.select({ total: count() })
      .from(salesComps)
      .where(and(...conditions));

    const orderColumn = sortBy === 'marina' ? salesComps.marina :
                       sortBy === 'saleYear' ? salesComps.saleYear :
                       sortBy === 'salePrice' ? salesComps.salePrice :
                       sortBy === 'state' ? salesComps.state :
                       salesComps.createdAt;
    
    const orderFn = sortDir === 'asc' ? asc : desc;

    const comps = await db.select().from(salesComps)
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { comps, total };
  }

  async getAllSalesCompIds(orgId: string): Promise<string[]> {
    const comps = await db.select({ id: salesComps.id })
      .from(salesComps)
      .where(and(
        eq(salesComps.orgId, orgId),
        isNull(salesComps.deletedAt)
      ));
    return comps.map(comp => comp.id);
  }

  async getColumnUniqueValues(orgId: string, column: string): Promise<string[]> {
    try {
      let dbColumn;
      switch (column) {
        case 'marina':
          dbColumn = salesComps.marina;
          break;
        case 'state':
          dbColumn = salesComps.state;
          break;
        case 'saleYear':
          dbColumn = salesComps.saleYear;
          break;
        case 'region':
          dbColumn = salesComps.region;
          break;
        default:
          return [];
      }

      const results = await db
        .selectDistinct({ value: dbColumn })
        .from(salesComps)
        .where(and(
          eq(salesComps.orgId, orgId),
          isNull(salesComps.deletedAt),
          column === 'saleYear' ? 
            sql`${dbColumn} IS NOT NULL AND ${dbColumn}::text != '' AND ${dbColumn} > 0` : 
            sql`${dbColumn} IS NOT NULL AND ${dbColumn} != ''`
        ))
        .orderBy(asc(dbColumn));

      return results.map(r => String(r.value)).filter(Boolean);
    } catch (error) {
      console.error(`Error getting unique values for column ${column}:`, error);
      return [];
    }
  }

  async getSalesComp(id: string, orgId: string): Promise<SalesComp | undefined> {
    const [comp] = await db.select().from(salesComps)
      .where(and(
        eq(salesComps.id, id),
        eq(salesComps.orgId, orgId),
        isNull(salesComps.deletedAt)
      ));
    return comp;
  }

  async createSalesComp(comp: InsertSalesComp): Promise<SalesComp> {
    const [newComp] = await db.insert(salesComps).values(comp as any).returning();
    return newComp;
  }

  async updateSalesComp(id: string, comp: UpdateSalesComp, orgId: string): Promise<SalesComp | undefined> {
    const [updatedComp] = await db.update(salesComps)
      .set({ ...comp, updatedAt: new Date() } as any)
      .where(and(
        eq(salesComps.id, id),
        eq(salesComps.orgId, orgId),
        isNull(salesComps.deletedAt)
      ))
      .returning();
    return updatedComp;
  }

  async deleteSalesComp(id: string, orgId: string, deletedBy: string): Promise<boolean> {
    const [deletedComp] = await db.update(salesComps)
      .set({ deletedAt: new Date(), updatedBy: deletedBy })
      .where(and(
        eq(salesComps.id, id),
        eq(salesComps.orgId, orgId),
        isNull(salesComps.deletedAt)
      ))
      .returning();
    return !!deletedComp;
  }

  async bulkUpdateSalesComps(ids: string[], updates: UpdateSalesComp, orgId: string): Promise<number> {
    const result = await db.update(salesComps)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(and(
        inArray(salesComps.id, ids),
        eq(salesComps.orgId, orgId),
        isNull(salesComps.deletedAt)
      ));
    return result.rowCount || 0;
  }

  async bulkDeleteSalesComps(ids: string[], orgId: string, deletedBy: string): Promise<number> {
    const CHUNK_SIZE = 1000;
    let totalDeleted = 0;

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const result = await db.update(salesComps)
        .set({ deletedAt: new Date(), updatedBy: deletedBy })
        .where(and(
          inArray(salesComps.id, chunk),
          eq(salesComps.orgId, orgId),
          isNull(salesComps.deletedAt)
        ));
      totalDeleted += result.rowCount || 0;
    }
    
    return totalDeleted;
  }

  async findPortfoliosByOwner(orgId: string, ownerCompanyId: string, ownershipRole?: 'buyer' | 'seller'): Promise<SalesComp[]> {
    const conditions = [
      eq(salesComps.orgId, orgId),
      eq(salesComps.isPortfolio, true),
      eq(salesComps.ownerCompanyId, ownerCompanyId),
      isNull(salesComps.deletedAt)
    ];

    // Add ownershipRole filter if provided
    if (ownershipRole) {
      conditions.push(eq(salesComps.ownershipRole, ownershipRole));
    }

    return await db.select().from(salesComps)
      .where(and(...conditions))
      .orderBy(desc(salesComps.createdAt));
  }

  // Search by marina name for import conflict detection
  async getSalesCompsByMarinaName(orgId: string, marinaName: string): Promise<SalesComp[]> {
    return await db.select().from(salesComps)
      .where(and(
        eq(salesComps.orgId, orgId),
        sql`LOWER(${salesComps.marina}) = LOWER(${marinaName})`,
        isNull(salesComps.deletedAt)
      ))
      .limit(5);
  }

  // Columns Operations
  async getCompColumns(orgId: string): Promise<CompColumn[]> {
    return await db.select().from(compColumns)
      .where(eq(compColumns.orgId, orgId))
      .orderBy(asc(compColumns.orderIndex));
  }

  async createCompColumn(column: InsertCompColumn): Promise<CompColumn> {
    const [newColumn] = await db.insert(compColumns).values(column as any).returning();
    return newColumn;
  }

  async updateCompColumn(id: string, column: UpdateCompColumn, orgId: string): Promise<CompColumn | undefined> {
    const [updatedColumn] = await db.update(compColumns)
      .set({ ...column, updatedAt: new Date() } as any)
      .where(and(eq(compColumns.id, id), eq(compColumns.orgId, orgId)))
      .returning();
    return updatedColumn;
  }

  async deleteCompColumn(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(compColumns)
      .where(and(eq(compColumns.id, id), eq(compColumns.orgId, orgId)));
    return (result.rowCount || 0) > 0;
  }

  // Import Operations
  async createCompImport(importData: InsertCompImport): Promise<CompImport> {
    const [newImport] = await db.insert(compImports).values(importData as any).returning();
    return newImport;
  }

  async getCompImport(id: string, orgId: string): Promise<CompImport | undefined> {
    const [importRecord] = await db.select().from(compImports)
      .where(and(eq(compImports.id, id), eq(compImports.orgId, orgId)));
    return importRecord;
  }

  async updateCompImport(id: string, updates: Partial<CompImport>, orgId: string): Promise<CompImport | undefined> {
    const [updatedImport] = await db.update(compImports)
      .set(updates)
      .where(and(eq(compImports.id, id), eq(compImports.orgId, orgId)))
      .returning();
    return updatedImport;
  }

  // Duplicate Detection
  async findPotentialDuplicates(orgId: string, marina: string, state?: string, saleYear?: number): Promise<SalesComp[]> {
    const duplicates = await db.select()
      .from(salesComps)
      .where(and(
        eq(salesComps.orgId, orgId),
        isNull(salesComps.deletedAt),
        sql`LOWER(${salesComps.marina}) = LOWER(${marina})`,
        state ? sql`LOWER(${salesComps.state}) = LOWER(${state})` : sql`1=1`,
        saleYear ? eq(salesComps.saleYear, saleYear) : sql`1=1`
      ))
      .limit(10);
    
    return duplicates;
  }

  async bulkFindCompsByLocation(
    orgId: string, 
    rows: Array<{ marina?: string; city?: string; state?: string }>
  ): Promise<SalesComp[]> {
    if (rows.length === 0) return [];

    const uniqueStates = [...new Set(rows.map(r => r.state).filter(Boolean))];
    
    if (uniqueStates.length === 0) return [];

    const allComps = await db.select()
      .from(salesComps)
      .where(and(
        eq(salesComps.orgId, orgId),
        isNull(salesComps.deletedAt),
        sql`${salesComps.state} IN ${uniqueStates}`
      ));

    return allComps;
  }

  // SC Project Operations
  async getScProjects(orgId: string, userId: string): Promise<ScProject[]> {
    return await db.select().from(scProjects)
      .where(and(
        eq(scProjects.orgId, orgId),
        isNull(scProjects.deletedAt)
      ))
      .orderBy(desc(scProjects.updatedAt));
  }

  async getScProject(id: string, orgId: string): Promise<ScProject | undefined> {
    const [project] = await db.select().from(scProjects)
      .where(and(
        eq(scProjects.id, id),
        eq(scProjects.orgId, orgId),
        isNull(scProjects.deletedAt)
      ));
    return project;
  }

  async createScProject(data: InsertScProject): Promise<ScProject> {
    const [newProject] = await db.insert(scProjects).values(data as any).returning();
    return newProject;
  }

  async updateScProject(id: string, data: UpdateScProject, orgId: string): Promise<ScProject | undefined> {
    const [updatedProject] = await db.update(scProjects)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(
        eq(scProjects.id, id),
        eq(scProjects.orgId, orgId),
        isNull(scProjects.deletedAt)
      ))
      .returning();
    return updatedProject;
  }

  async deleteScProject(id: string, orgId: string, deletedBy: string): Promise<boolean> {
    const [deletedProject] = await db.update(scProjects)
      .set({ deletedAt: new Date(), updatedBy: deletedBy })
      .where(and(
        eq(scProjects.id, id),
        eq(scProjects.orgId, orgId),
        isNull(scProjects.deletedAt)
      ))
      .returning();
    return !!deletedProject;
  }

  // Project-Comp Operations
  async getScProjectComps(projectId: string, orgId: string): Promise<(ScProjectComp & { salesComp: SalesComp })[]> {
    const results = await db.select({
      id: scProjectComps.id,
      orgId: scProjectComps.orgId,
      scProjectId: scProjectComps.scProjectId,
      salesCompId: scProjectComps.salesCompId,
      addedBy: scProjectComps.addedBy,
      addedAt: scProjectComps.addedAt,
      notes: scProjectComps.notes,
      salesComp: salesComps,
    })
      .from(scProjectComps)
      .innerJoin(salesComps, and(
        eq(scProjectComps.salesCompId, salesComps.id),
        eq(salesComps.orgId, scProjectComps.orgId),
        isNull(salesComps.deletedAt)
      ))
      .where(and(
        eq(scProjectComps.scProjectId, projectId),
        eq(scProjectComps.orgId, orgId)
      ))
      .orderBy(desc(scProjectComps.addedAt));

    return results as (ScProjectComp & { salesComp: SalesComp })[];
  }

  async addCompToScProject(projectId: string, salesCompId: string, orgId: string, userId: string): Promise<ScProjectComp> {
    const project = await this.getScProject(projectId, orgId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const salesComp = await this.getSalesComp(salesCompId, orgId);
    if (!salesComp) {
      throw new Error('Sales comp not found or access denied');
    }

    const [projectComp] = await db.insert(scProjectComps).values({
      orgId,
      scProjectId: projectId,
      salesCompId,
      addedBy: userId,
    } as any).returning();
    return projectComp;
  }

  async removeCompFromScProject(projectId: string, salesCompId: string, orgId: string): Promise<boolean> {
    const result = await db.delete(scProjectComps)
      .where(and(
        eq(scProjectComps.scProjectId, projectId),
        eq(scProjectComps.salesCompId, salesCompId),
        eq(scProjectComps.orgId, orgId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async updateScProjectComp(id: string, data: UpdateScProjectComp, orgId: string): Promise<ScProjectComp | undefined> {
    const [updatedProjectComp] = await db.update(scProjectComps)
      .set(data as any)
      .where(and(
        eq(scProjectComps.id, id),
        eq(scProjectComps.orgId, orgId)
      ))
      .returning();
    return updatedProjectComp;
  }

  // Audit Operations
  async createScAuditLog(log: {
    orgId: string;
    userId: string;
    entity: string;
    entityId: string;
    action: string;
    before?: any;
    after?: any;
  }): Promise<ScAuditLog> {
    const [auditEntry] = await db.insert(scAuditLog).values(log).returning();
    return auditEntry;
  }

  // Recommendation System
  async getSalesCompsForRecommendation(params: {
    orgId: string;
    filters?: Record<string, any>;
  }): Promise<SalesComp[]> {
    const { orgId, filters = {} } = params;
    
    const conditions = [
      eq(salesComps.orgId, orgId),
      isNull(salesComps.deletedAt)
    ];

    // Geographic filters
    if (filters.regions && filters.regions.length > 0) {
      conditions.push(inArray(salesComps.region, filters.regions));
    }
    if (filters.states && filters.states.length > 0) {
      conditions.push(inArray(salesComps.state, filters.states));
    }
    if (filters.coastalType) {
      conditions.push(eq(salesComps.coastalType, filters.coastalType));
    }
    
    // Price range filters
    if (filters.priceMin !== undefined && filters.priceMin !== null) {
      conditions.push(sql`COALESCE(${salesComps.salePrice}, 0) >= ${filters.priceMin}`);
    }
    if (filters.priceMax !== undefined && filters.priceMax !== null) {
      conditions.push(sql`COALESCE(${salesComps.salePrice}, 0) <= ${filters.priceMax}`);
    }
    
    // NOI range filters
    if (filters.noiMin !== undefined && filters.noiMin !== null) {
      conditions.push(sql`COALESCE(${salesComps.noi}, 0) >= ${filters.noiMin}`);
    }
    if (filters.noiMax !== undefined && filters.noiMax !== null) {
      conditions.push(sql`COALESCE(${salesComps.noi}, 0) <= ${filters.noiMax}`);
    }
    
    // Storage capacity filters
    if (filters.wetSlipsMin !== undefined && filters.wetSlipsMin !== null) {
      conditions.push(sql`COALESCE(${salesComps.wetSlips}, 0) >= ${filters.wetSlipsMin}`);
    }
    if (filters.wetSlipsMax !== undefined && filters.wetSlipsMax !== null) {
      conditions.push(sql`COALESCE(${salesComps.wetSlips}, 0) <= ${filters.wetSlipsMax}`);
    }
    if (filters.dryRacksMin !== undefined && filters.dryRacksMin !== null) {
      conditions.push(sql`COALESCE(${salesComps.dryRacks}, 0) >= ${filters.dryRacksMin}`);
    }
    if (filters.dryRacksMax !== undefined && filters.dryRacksMax !== null) {
      conditions.push(sql`COALESCE(${salesComps.dryRacks}, 0) <= ${filters.dryRacksMax}`);
    }
    
    // Exclude IDs
    if (filters.excludeIds && filters.excludeIds.length > 0) {
      conditions.push(sql`${salesComps.id} NOT IN (${sql.join(filters.excludeIds.map((id: string) => sql`${id}`), sql`, `)})`);
    }

    const comps = await db.select().from(salesComps)
      .where(and(...conditions))
      .orderBy(desc(salesComps.createdAt));

    return comps;
  }

  // Recommendation Feedback
  async createScRecommendationFeedback(feedback: InsertScRecommendationFeedback): Promise<ScRecommendationFeedback> {
    const [newFeedback] = await db.insert(scRecommendationFeedback)
      .values(feedback as any)
      .returning();
    return newFeedback;
  }

  async getScRecommendationFeedback(orgId: string, projectId?: string): Promise<ScRecommendationFeedback[]> {
    const conditions = [eq(scRecommendationFeedback.orgId, orgId)];
    if (projectId) {
      conditions.push(eq(scRecommendationFeedback.scProjectId, projectId));
    }

    return await db.select().from(scRecommendationFeedback)
      .where(and(...conditions))
      .orderBy(desc(scRecommendationFeedback.createdAt));
  }

  // Organization Preferences
  async getScOrgPreferences(orgId: string, segmentKey: string): Promise<ScOrgPreferences | undefined> {
    const [preferences] = await db.select().from(scOrgPreferences)
      .where(and(
        eq(scOrgPreferences.orgId, orgId),
        eq(scOrgPreferences.segmentKey, segmentKey)
      ));
    return preferences;
  }

  async upsertScOrgPreferences(preferences: InsertScOrgPreferences): Promise<ScOrgPreferences> {
    const [result] = await db.insert(scOrgPreferences)
      .values(preferences as any)
      .onConflictDoUpdate({
        target: [scOrgPreferences.orgId, scOrgPreferences.segmentKey],
        set: {
          weights: preferences.weights,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateScOrgPreferences(orgId: string, segmentKey: string, updates: UpdateScOrgPreferences): Promise<ScOrgPreferences | undefined> {
    const [updatedPreferences] = await db.update(scOrgPreferences)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(and(
        eq(scOrgPreferences.orgId, orgId),
        eq(scOrgPreferences.segmentKey, segmentKey)
      ))
      .returning();
    return updatedPreferences;
  }

  // Saved Searches
  async getScSavedSearches(orgId: string, userId?: string): Promise<ScSavedSearch[]> {
    const conditions = [
      eq(scSavedSearches.orgId, orgId),
      isNull(scSavedSearches.deletedAt)
    ];
    
    if (userId) {
      conditions.push(eq(scSavedSearches.createdBy, userId));
    }

    return await db.select().from(scSavedSearches)
      .where(and(...conditions))
      .orderBy(desc(scSavedSearches.isPinned), desc(scSavedSearches.lastUsedAt));
  }

  async getScSavedSearch(id: string, orgId: string): Promise<ScSavedSearch | undefined> {
    const [savedSearch] = await db.select().from(scSavedSearches)
      .where(and(
        eq(scSavedSearches.id, id),
        eq(scSavedSearches.orgId, orgId),
        isNull(scSavedSearches.deletedAt)
      ));
    return savedSearch;
  }

  async createScSavedSearch(data: InsertScSavedSearch): Promise<ScSavedSearch> {
    const [newSearch] = await db.insert(scSavedSearches).values(data as any).returning();
    return newSearch;
  }

  async updateScSavedSearch(id: string, data: UpdateScSavedSearch, orgId: string): Promise<ScSavedSearch | undefined> {
    const [updatedSearch] = await db.update(scSavedSearches)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(
        eq(scSavedSearches.id, id),
        eq(scSavedSearches.orgId, orgId),
        isNull(scSavedSearches.deletedAt)
      ))
      .returning();
    return updatedSearch;
  }

  async deleteScSavedSearch(id: string, orgId: string, deletedBy: string): Promise<boolean> {
    const [deletedSearch] = await db.update(scSavedSearches)
      .set({ deletedAt: new Date(), updatedBy: deletedBy })
      .where(and(
        eq(scSavedSearches.id, id),
        eq(scSavedSearches.orgId, orgId),
        isNull(scSavedSearches.deletedAt)
      ))
      .returning();
    return !!deletedSearch;
  }

  async incrementScSavedSearchUsage(id: string, orgId: string): Promise<void> {
    await db.update(scSavedSearches)
      .set({
        useCount: sql`${scSavedSearches.useCount} + 1`,
        lastUsedAt: new Date()
      })
      .where(and(
        eq(scSavedSearches.id, id),
        eq(scSavedSearches.orgId, orgId),
        isNull(scSavedSearches.deletedAt)
      ));
  }

  // Analytics Filter Presets
  async getScAnalyticsFilterPresets(orgId: string, userId: string): Promise<ScAnalyticsFilterPreset[]> {
    return await db.select().from(scAnalyticsFilterPresets)
      .where(and(
        eq(scAnalyticsFilterPresets.orgId, orgId),
        eq(scAnalyticsFilterPresets.userId, userId)
      ))
      .orderBy(desc(scAnalyticsFilterPresets.isPinned), desc(scAnalyticsFilterPresets.lastUsedAt));
  }

  async createScAnalyticsFilterPreset(data: InsertScAnalyticsFilterPreset): Promise<ScAnalyticsFilterPreset> {
    const [newPreset] = await db.insert(scAnalyticsFilterPresets).values(data as any).returning();
    return newPreset;
  }

  async updateScAnalyticsFilterPreset(id: string, data: UpdateScAnalyticsFilterPreset, orgId: string, userId: string): Promise<ScAnalyticsFilterPreset | undefined> {
    const [updatedPreset] = await db.update(scAnalyticsFilterPresets)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(
        eq(scAnalyticsFilterPresets.id, id),
        eq(scAnalyticsFilterPresets.orgId, orgId),
        eq(scAnalyticsFilterPresets.userId, userId)
      ))
      .returning();
    return updatedPreset;
  }

  async deleteScAnalyticsFilterPreset(id: string, orgId: string, userId: string): Promise<boolean> {
    const result = await db.delete(scAnalyticsFilterPresets)
      .where(and(
        eq(scAnalyticsFilterPresets.id, id),
        eq(scAnalyticsFilterPresets.orgId, orgId),
        eq(scAnalyticsFilterPresets.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  // Custom Storage Types
  async getScCustomStorageTypes(orgId: string): Promise<ScCustomStorageType[]> {
    return await db.select()
      .from(scCustomStorageTypes)
      .where(eq(scCustomStorageTypes.orgId, orgId))
      .orderBy(asc(scCustomStorageTypes.name));
  }

  async createScCustomStorageType(data: InsertScCustomStorageType): Promise<ScCustomStorageType> {
    const [created] = await db.insert(scCustomStorageTypes)
      .values(data as any)
      .returning();
    return created;
  }

  async deleteScCustomStorageType(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(scCustomStorageTypes)
      .where(and(
        eq(scCustomStorageTypes.id, id),
        eq(scCustomStorageTypes.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Pending Property Profiles
  async getPendingPropertyProfiles(orgId: string, status?: string): Promise<ScPendingPropertyProfile[]> {
    const conditions = [eq(scPendingPropertyProfiles.orgId, orgId)];
    if (status) {
      conditions.push(eq(scPendingPropertyProfiles.status, status));
    }
    return await db.select()
      .from(scPendingPropertyProfiles)
      .where(and(...conditions))
      .orderBy(desc(scPendingPropertyProfiles.createdAt));
  }

  async createPendingPropertyProfile(data: InsertScPendingPropertyProfile): Promise<ScPendingPropertyProfile> {
    const [created] = await db.insert(scPendingPropertyProfiles)
      .values(data as any)
      .returning();
    return created;
  }
  
  async createDuplicateAuditLog(data: InsertScDuplicateAuditLog): Promise<ScDuplicateAuditLog> {
    const [created] = await db.insert(scDuplicateAuditLog)
      .values(data as any)
      .returning();
    return created;
  }

  async updatePendingPropertyProfile(id: string, data: Partial<InsertScPendingPropertyProfile>): Promise<ScPendingPropertyProfile> {
    const [updated] = await db.update(scPendingPropertyProfiles)
      .set(data)
      .where(eq(scPendingPropertyProfiles.id, id))
      .returning();
    return updated;
  }

  async deletePendingPropertyProfile(id: string): Promise<boolean> {
    const result = await db.delete(scPendingPropertyProfiles)
      .where(eq(scPendingPropertyProfiles.id, id))
      .returning();
    return result.length > 0;
  }

  // ============================================================================
  // DOCKTALK M&A SPOTLIGHT METHODS
  // ============================================================================

  async getDocktalkDeals(params: {
    orgId: string;
    origin?: 'marinaMatch' | 'aiExtraction';
    page?: number;
    pageSize?: number;
  }): Promise<{ deals: DocktalkDeal[]; total: number }> {
    const { orgId, origin, page = 1, pageSize = 25 } = params;
    
    const conditions = [
      eq(docktalkDeals.orgId, orgId),
      isNull(docktalkDeals.deletedAt)
    ];
    
    if (origin) {
      conditions.push(eq(docktalkDeals.origin, origin));
    }

    const [{ total }] = await db.select({ total: count() })
      .from(docktalkDeals)
      .where(and(...conditions));

    const deals = await db.select().from(docktalkDeals)
      .where(and(...conditions))
      .orderBy(desc(docktalkDeals.dealDate))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { deals, total };
  }

  async getDocktalkDeal(id: string, orgId: string): Promise<DocktalkDeal | undefined> {
    const [deal] = await db.select()
      .from(docktalkDeals)
      .where(and(
        eq(docktalkDeals.id, id),
        eq(docktalkDeals.orgId, orgId),
        isNull(docktalkDeals.deletedAt)
      ));
    return deal || undefined;
  }

  async getDocktalkDealByExternalId(externalId: string, orgId: string): Promise<DocktalkDeal | undefined> {
    const [deal] = await db.select()
      .from(docktalkDeals)
      .where(and(
        eq(docktalkDeals.externalId, externalId),
        eq(docktalkDeals.orgId, orgId),
        isNull(docktalkDeals.deletedAt)
      ));
    return deal || undefined;
  }

  async createDocktalkDeal(deal: InsertDocktalkDeal): Promise<DocktalkDeal> {
    const [created] = await db.insert(docktalkDeals)
      .values(deal as any)
      .returning();
    return created;
  }

  async updateDocktalkDeal(id: string, deal: UpdateDocktalkDeal, orgId: string): Promise<DocktalkDeal | undefined> {
    const updateData = { ...deal, updatedAt: new Date() };
    const [updated] = await db.update(docktalkDeals)
      .set(updateData)
      .where(and(
        eq(docktalkDeals.id, id),
        eq(docktalkDeals.orgId, orgId),
        isNull(docktalkDeals.deletedAt)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteDocktalkDeal(id: string, orgId: string): Promise<boolean> {
    const [deleted] = await db.update(docktalkDeals)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(docktalkDeals.id, id),
        eq(docktalkDeals.orgId, orgId)
      ))
      .returning();
    return !!deleted;
  }

  async upsertDocktalkDealByExternalId(externalId: string, orgId: string, deal: InsertDocktalkDeal): Promise<DocktalkDeal> {
    const existing = await this.getDocktalkDealByExternalId(externalId, orgId);
    if (existing) {
      const updated = await this.updateDocktalkDeal(existing.id, deal, orgId);
      return updated!;
    } else {
      return await this.createDocktalkDeal({ ...deal, externalId, orgId });
    }
  }

  async findPropertyByLocation(orgId: string, marina: string, city?: string, state?: string): Promise<Property | undefined> {
    // Validate input - marina name is required
    if (!marina || marina.trim().length === 0) {
      return undefined;
    }
    
    const conditions = [eq(crmProperties.orgId, orgId)];
    
    // Normalize marina name for comparison (case-insensitive, trim whitespace)
    const normalizedMarina = marina.trim().toLowerCase();
    conditions.push(ilike(crmProperties.title, normalizedMarina));
    
    // If city is provided, match it (case-insensitive)
    if (city && city.trim().length > 0) {
      const cityPattern = `%${city.trim()}%`;
      conditions.push(ilike(crmProperties.address, cityPattern));
    }
    
    // If state is provided, match it (case-insensitive)
    if (state && state.trim().length > 0) {
      const statePattern = `%${state.trim()}%`;
      conditions.push(ilike(crmProperties.address, statePattern));
    }
    
    const [property] = await db.select()
      .from(crmProperties)
      .where(and(...conditions))
      .limit(1);
    
    return property || undefined;
  }

  async findSimilarProperties(orgId: string, marina: string, city?: string, state?: string): Promise<Property[]> {
    // Validate input
    if (!marina || marina.trim().length === 0) {
      return [];
    }
    
    const normalizedMarina = marina.trim().toLowerCase();
    
    // Build comprehensive similarity query
    // 1. Exact match on title
    // 2. Title contains any significant word from marina name (3+ chars)
    const marinaWords = normalizedMarina.split(/\s+/).filter(w => w.length >= 3);
    
    // Build title conditions using ilike for safety
    const titleConditions = [
      ilike(crmProperties.title, normalizedMarina), // Exact match (case-insensitive)
      ilike(crmProperties.title, `%${normalizedMarina}%`), // Title contains marina name
    ];
    
    // Add word-based matching only if we have significant words
    marinaWords.forEach(word => {
      titleConditions.push(ilike(crmProperties.title, `%${word}%`));
    });
    
    // Ensure we have at least one valid condition
    const similarityCondition = titleConditions.length > 0 ? or(...titleConditions) : ilike(crmProperties.title, `%${normalizedMarina}%`);
    
    // Base conditions
    const conditions = [
      eq(crmProperties.orgId, orgId),
    ];
    
    // Only add similarity condition if valid
    if (similarityCondition) {
      conditions.push(similarityCondition);
    }
    
    // Add location filters if provided
    if (city && city.trim().length > 0) {
      const cityPattern = `%${city.trim()}%`;
      conditions.push(ilike(crmProperties.address, cityPattern));
    }
    
    if (state && state.trim().length > 0) {
      const statePattern = `%${state.trim()}%`;
      conditions.push(ilike(crmProperties.address, statePattern));
    }
    
    const properties = await db.select()
      .from(crmProperties)
      .where(and(...conditions))
      .limit(10); // Increased limit for better suggestions
    
    return properties;
  }

  // ============================================================================
  // CRM Companies - Search by name
  // ============================================================================

  async findCompanyByName(orgId: string, companyName: string): Promise<CRMCompany | undefined> {
    // Validate input
    if (!companyName || companyName.trim().length === 0) {
      return undefined;
    }
    
    // Normalize company name for comparison (case-insensitive, trim whitespace)
    const normalizedName = companyName.trim();
    
    const [company] = await db.select()
      .from(crmCompanies)
      .where(and(
        eq(crmCompanies.orgId, orgId),
        ilike(crmCompanies.name, normalizedName)
      ))
      .limit(1);
    
    return company || undefined;
  }

  async findSimilarCompanies(orgId: string, companyName: string): Promise<CRMCompany[]> {
    // Validate input
    if (!companyName || companyName.trim().length === 0) {
      return [];
    }
    
    const normalizedName = companyName.trim().toLowerCase();
    
    // Build similarity query
    const nameWords = normalizedName.split(/\s+/).filter(w => w.length >= 3);
    
    // Build name conditions using ilike for safety
    const nameConditions = [
      ilike(crmCompanies.name, normalizedName), // Exact match (case-insensitive)
      ilike(crmCompanies.name, `%${normalizedName}%`), // Name contains search term
    ];
    
    // Add word-based matching
    nameWords.forEach(word => {
      nameConditions.push(ilike(crmCompanies.name, `%${word}%`));
    });
    
    const similarityCondition = nameConditions.length > 0 ? or(...nameConditions) : ilike(crmCompanies.name, `%${normalizedName}%`);
    
    const companies = await db.select()
      .from(crmCompanies)
      .where(and(
        eq(crmCompanies.orgId, orgId),
        similarityCondition
      ))
      .limit(10);
    
    return companies;
  }

  // ============================================================================
  // CRM Contacts - Search by name
  // ============================================================================

  async findContactByName(orgId: string, contactName: string): Promise<CRMContact | undefined> {
    // Validate input
    if (!contactName || contactName.trim().length === 0) {
      return undefined;
    }
    
    // Normalize contact name for comparison
    const normalizedName = contactName.trim();
    const nameParts = normalizedName.split(/\s+/);
    
    // Try to match by first name and last name if both provided
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      
      const [contact] = await db.select()
        .from(crmContacts)
        .where(and(
          eq(crmContacts.orgId, orgId),
          ilike(crmContacts.firstName, firstName),
          ilike(crmContacts.lastName, lastName)
        ))
        .limit(1);
      
      if (contact) return contact;
    }
    
    // Fallback: search by either first or last name
    const [contact] = await db.select()
      .from(crmContacts)
      .where(and(
        eq(crmContacts.orgId, orgId),
        or(
          ilike(crmContacts.firstName, normalizedName),
          ilike(crmContacts.lastName, normalizedName)
        )
      ))
      .limit(1);
    
    return contact || undefined;
  }

  async findSimilarContacts(orgId: string, contactName: string): Promise<CRMContact[]> {
    // Validate input
    if (!contactName || contactName.trim().length === 0) {
      return [];
    }
    
    const normalizedName = contactName.trim().toLowerCase();
    
    // Build similarity query
    const nameWords = normalizedName.split(/\s+/).filter(w => w.length >= 2);
    
    // Build name conditions using ilike for safety
    const nameConditions: any[] = [];
    
    // Match full name parts
    nameWords.forEach(word => {
      nameConditions.push(ilike(crmContacts.firstName, `%${word}%`));
      nameConditions.push(ilike(crmContacts.lastName, `%${word}%`));
    });
    
    // If no valid words, search by the full name
    if (nameConditions.length === 0) {
      nameConditions.push(ilike(crmContacts.firstName, `%${normalizedName}%`));
      nameConditions.push(ilike(crmContacts.lastName, `%${normalizedName}%`));
    }
    
    const similarityCondition = or(...nameConditions);
    
    const contacts = await db.select()
      .from(crmContacts)
      .where(and(
        eq(crmContacts.orgId, orgId),
        similarityCondition
      ))
      .limit(10);
    
    return contacts;
  }

  // ============================================================================
  // Pending Properties - Review queue for properties created from comps
  // ============================================================================

  async getPendingProperties(orgId: string, status?: string): Promise<PendingProperty[]> {
    const conditions = [eq(pendingProperties.orgId, orgId)];
    if (status) {
      conditions.push(eq(pendingProperties.status, status as any));
    }
    return await db.select()
      .from(pendingProperties)
      .where(and(...conditions))
      .orderBy(desc(pendingProperties.createdAt));
  }

  async getPendingProperty(id: string, orgId: string): Promise<PendingProperty | undefined> {
    const [property] = await db.select()
      .from(pendingProperties)
      .where(and(
        eq(pendingProperties.id, id),
        eq(pendingProperties.orgId, orgId)
      ));
    return property || undefined;
  }

  async createPendingProperty(data: InsertPendingProperty): Promise<PendingProperty> {
    const [created] = await db.insert(pendingProperties)
      .values(data as any)
      .returning();
    return created;
  }

  async acceptPendingProperty(id: string, orgId: string, userId: string): Promise<Property | undefined> {
    // Use transaction to ensure atomicity across all updates
    return await db.transaction(async (tx) => {
      // Get and lock the pending property with concurrency check
      const [pending] = await tx.select()
        .from(pendingProperties)
        .where(and(
          eq(pendingProperties.id, id),
          eq(pendingProperties.orgId, orgId),
          eq(pendingProperties.status, 'pending' as any) // Only accept if still pending
        ))
        .limit(1);

      if (!pending) {
        return undefined; // Already processed or not found
      }

      // Get the sales comp to extract company/contact data
      const [comp] = await tx.select()
        .from(salesComps)
        .where(eq(salesComps.id, pending.compId))
        .limit(1);

      // Create the actual property
      const address = [
        pending.address,
        pending.city && pending.state ? `${pending.city}, ${pending.state}` : pending.city || pending.state
      ].filter(Boolean).join(', ');

      const [newProperty] = await tx.insert(crmProperties).values({
        title: pending.marinaName,
        type: 'marina',
        status: 'available',
        address: address || undefined,
        ownerId: orgId,
        listingPrice: pending.salePrice ? String(pending.salePrice) : undefined,
        description: `Created from sales comp`,
      }).returning();

      // Update pending property status (with WHERE clause to prevent race conditions)
      await tx.update(pendingProperties)
        .set({
          status: 'accepted',
          reviewedBy: userId,
          reviewedAt: new Date(),
          createdPropertyId: newProperty.id,
        })
        .where(and(
          eq(pendingProperties.id, id),
          eq(pendingProperties.status, 'pending' as any) // Double-check still pending
        ));

      // Update the comp to link to the new property
      await tx.update(salesComps)
        .set({ propertyId: newProperty.id })
        .where(eq(salesComps.id, pending.compId));

      // Create pending companies and contacts from comp data
      if (comp) {
        // Create pending company from buyer company data (company field)
        if (comp.company && comp.company.trim() && !comp.buyerCompanyId) {
          try {
            const similarCompanies = await this.findSimilarCompanies(orgId, comp.company.trim());
            await tx.insert(pendingCompanies).values({
              orgId,
              sourceType: 'sales_comp',
              sourceId: comp.id,
              companyName: comp.company.trim(),
              status: 'pending',
              suggestedDuplicates: similarCompanies.map(c => c.id),
              sourceMetadata: {
                salesCompId: comp.id,
                propertyId: newProperty.id,
                role: 'buyer',
              },
              createdBy: userId,
            });
          } catch (error) {
            console.error('Error creating pending company for buyer:', error);
          }
        }

        // Create pending company from seller data (seller field)
        if (comp.seller && comp.seller.trim() && !comp.sellerCompanyId) {
          try {
            const similarCompanies = await this.findSimilarCompanies(orgId, comp.seller.trim());
            await tx.insert(pendingCompanies).values({
              orgId,
              sourceType: 'sales_comp',
              sourceId: comp.id,
              companyName: comp.seller.trim(),
              status: 'pending',
              suggestedDuplicates: similarCompanies.map(c => c.id),
              sourceMetadata: {
                salesCompId: comp.id,
                propertyId: newProperty.id,
                role: 'seller',
              },
              createdBy: userId,
            });
          } catch (error) {
            console.error('Error creating pending company for seller:', error);
          }
        }

        // Create pending contact from broker/agent data
        if (comp.agentFirstName && comp.agentLastName && 
            comp.agentFirstName.trim() && comp.agentLastName.trim() &&
            !comp.agentContactId) {
          try {
            const fullName = `${comp.agentFirstName.trim()} ${comp.agentLastName.trim()}`;
            const similarContacts = await this.findSimilarContacts(
              orgId,
              comp.agentFirstName.trim(),
              comp.agentLastName.trim()
            );
            await tx.insert(pendingContacts).values({
              orgId,
              sourceType: 'sales_comp',
              sourceId: comp.id,
              fullName,
              status: 'pending',
              suggestedDuplicates: similarContacts.map(c => c.id),
              sourceMetadata: {
                salesCompId: comp.id,
                propertyId: newProperty.id,
                agentFirstName: comp.agentFirstName.trim(),
                agentLastName: comp.agentLastName.trim(),
                brokerage: comp.brokerage?.trim(),
                role: 'broker',
              },
              createdBy: userId,
            });
          } catch (error) {
            console.error('Error creating pending contact for broker:', error);
          }
        }
      }

      return newProperty;
    });
  }

  async rejectPendingProperty(id: string, orgId: string, userId: string): Promise<boolean> {
    // Use WHERE clause with status check to prevent race conditions
    const result = await db.update(pendingProperties)
      .set({
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date(),
      })
      .where(and(
        eq(pendingProperties.id, id),
        eq(pendingProperties.orgId, orgId),
        eq(pendingProperties.status, 'pending' as any) // Only reject if still pending
      ))
      .returning();

    return result.length > 0;
  }

  async updatePendingProperty(id: string, orgId: string, updates: Partial<PendingProperty>): Promise<PendingProperty | undefined> {
    // Only allow updating specific fields
    const allowedUpdates: any = {};
    if (updates.marinaName !== undefined) allowedUpdates.marinaName = updates.marinaName;
    if (updates.city !== undefined) allowedUpdates.city = updates.city;
    if (updates.state !== undefined) allowedUpdates.state = updates.state;
    if (updates.address !== undefined) allowedUpdates.address = updates.address;
    if (updates.salePrice !== undefined) allowedUpdates.salePrice = updates.salePrice;
    
    // Deep merge compMetadata to preserve existing fields
    if (updates.compMetadata !== undefined) {
      const current = await this.getPendingProperty(id, orgId);
      if (current) {
        allowedUpdates.compMetadata = {
          ...(current.compMetadata || {}),
          ...updates.compMetadata,
        };
      } else {
        allowedUpdates.compMetadata = updates.compMetadata;
      }
    }

    if (Object.keys(allowedUpdates).length === 0) {
      // No valid updates
      return this.getPendingProperty(id, orgId);
    }

    const result = await db.update(pendingProperties)
      .set(allowedUpdates)
      .where(and(
        eq(pendingProperties.id, id),
        eq(pendingProperties.orgId, orgId)
      ))
      .returning();

    return result.length > 0 ? result[0] : undefined;
  }

  async mergePendingPropertyWithExisting(pendingId: string, propertyId: string, orgId: string, userId: string): Promise<Property | undefined> {
    return await db.transaction(async (tx) => {
      // Get the pending property
      const [pending] = await tx.select()
        .from(pendingProperties)
        .where(and(
          eq(pendingProperties.id, pendingId),
          eq(pendingProperties.orgId, orgId),
          eq(pendingProperties.status, 'pending' as any)
        ))
        .limit(1);

      if (!pending) {
        return undefined;
      }

      // Get the existing property
      const [existingProperty] = await tx.select()
        .from(crmProperties)
        .where(and(
          eq(crmProperties.id, propertyId),
          eq(crmProperties.ownerId, orgId)
        ))
        .limit(1);

      if (!existingProperty) {
        return undefined;
      }

      // Mark the pending property as accepted and linked to existing property
      await tx.update(pendingProperties)
        .set({
          status: 'accepted',
          reviewedBy: userId,
          reviewedAt: new Date(),
          createdPropertyId: propertyId,
        })
        .where(and(
          eq(pendingProperties.id, pendingId),
          eq(pendingProperties.status, 'pending' as any)
        ));

      // Link the comp to the existing property
      await tx.update(salesComps)
        .set({ propertyId: propertyId })
        .where(eq(salesComps.id, pending.compId));

      return existingProperty;
    });
  }

  // ============================================================================
  // Pending Contacts - Review queue for contacts from comps/DD projects
  // ============================================================================

  async getPendingContacts(orgId: string, status?: string): Promise<PendingContact[]> {
    const conditions = [eq(pendingContacts.orgId, orgId)];
    if (status) {
      conditions.push(eq(pendingContacts.status, status as any));
    }
    return await db.select()
      .from(pendingContacts)
      .where(and(...conditions))
      .orderBy(desc(pendingContacts.createdAt));
  }

  async getPendingContact(id: string, orgId: string): Promise<PendingContact | undefined> {
    const [contact] = await db.select()
      .from(pendingContacts)
      .where(and(
        eq(pendingContacts.id, id),
        eq(pendingContacts.orgId, orgId)
      ));
    return contact || undefined;
  }

  async createPendingContact(data: InsertPendingContact): Promise<PendingContact> {
    const [created] = await db.insert(pendingContacts)
      .values(data as any)
      .returning();
    return created;
  }

  async acceptPendingContact(id: string, orgId: string, userId: string): Promise<CrmContact | undefined> {
    return await db.transaction(async (tx) => {
      const [pending] = await tx.select()
        .from(pendingContacts)
        .where(and(
          eq(pendingContacts.id, id),
          eq(pendingContacts.orgId, orgId),
          eq(pendingContacts.status, 'pending' as any)
        ))
        .limit(1);

      if (!pending) {
        return undefined;
      }

      const [newContact] = await tx.insert(crmContacts).values({
        firstName: pending.firstName || '',
        lastName: pending.lastName || '',
        fullName: pending.fullName,
        email: pending.email,
        phone: pending.phone,
        companyId: pending.companyId,
        jobTitle: pending.jobTitle,
        ownerId: userId,
      }).returning();

      await tx.update(pendingContacts)
        .set({
          status: 'accepted',
          reviewedBy: userId,
          reviewedAt: new Date(),
          createdContactId: newContact.id,
        })
        .where(and(
          eq(pendingContacts.id, id),
          eq(pendingContacts.status, 'pending' as any)
        ));

      return newContact;
    });
  }

  async rejectPendingContact(id: string, orgId: string, userId: string): Promise<boolean> {
    const result = await db.update(pendingContacts)
      .set({
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date(),
      })
      .where(and(
        eq(pendingContacts.id, id),
        eq(pendingContacts.orgId, orgId),
        eq(pendingContacts.status, 'pending' as any)
      ))
      .returning();

    return result.length > 0;
  }

  async updatePendingContact(id: string, orgId: string, updates: Partial<PendingContact>): Promise<PendingContact | undefined> {
    const allowedUpdates: any = {};
    if (updates.firstName !== undefined) allowedUpdates.firstName = updates.firstName;
    if (updates.lastName !== undefined) allowedUpdates.lastName = updates.lastName;
    if (updates.fullName !== undefined) allowedUpdates.fullName = updates.fullName;
    if (updates.email !== undefined) allowedUpdates.email = updates.email;
    if (updates.phone !== undefined) allowedUpdates.phone = updates.phone;
    if (updates.companyId !== undefined) allowedUpdates.companyId = updates.companyId;
    if (updates.jobTitle !== undefined) allowedUpdates.jobTitle = updates.jobTitle;

    if (Object.keys(allowedUpdates).length === 0) {
      return this.getPendingContact(id, orgId);
    }

    const result = await db.update(pendingContacts)
      .set(allowedUpdates)
      .where(and(
        eq(pendingContacts.id, id),
        eq(pendingContacts.orgId, orgId)
      ))
      .returning();

    return result.length > 0 ? result[0] : undefined;
  }

  async mergePendingContactWithExisting(pendingId: string, contactId: string, orgId: string, userId: string): Promise<CrmContact | undefined> {
    return await db.transaction(async (tx) => {
      const [pending] = await tx.select()
        .from(pendingContacts)
        .where(and(
          eq(pendingContacts.id, pendingId),
          eq(pendingContacts.orgId, orgId),
          eq(pendingContacts.status, 'pending' as any)
        ))
        .limit(1);

      if (!pending) {
        return undefined;
      }

      const [existingContact] = await tx.select()
        .from(crmContacts)
        .where(eq(crmContacts.id, contactId))
        .limit(1);

      if (!existingContact) {
        return undefined;
      }

      await tx.update(pendingContacts)
        .set({
          status: 'accepted',
          reviewedBy: userId,
          reviewedAt: new Date(),
          createdContactId: contactId,
        })
        .where(and(
          eq(pendingContacts.id, pendingId),
          eq(pendingContacts.status, 'pending' as any)
        ));

      return existingContact;
    });
  }

  // ============================================================================
  // Project Pending Contacts - Linking pending contacts to DD projects
  // ============================================================================

  async addPendingContactToProject(data: InsertProjectPendingContact): Promise<ProjectPendingContact> {
    const [created] = await db.insert(projectPendingContacts)
      .values(data as any)
      .returning();
    return created;
  }

  async getProjectPendingContacts(projectId: string): Promise<Array<ProjectPendingContact & { pendingContact: PendingContact }>> {
    const results = await db.select()
      .from(projectPendingContacts)
      .leftJoin(pendingContacts, eq(projectPendingContacts.pendingContactId, pendingContacts.id))
      .where(eq(projectPendingContacts.projectId, projectId))
      .orderBy(projectPendingContacts.role);

    return results.map(row => ({
      ...row.project_pending_contacts!,
      pendingContact: row.pending_contacts!,
    }));
  }

  async removePendingContactFromProject(projectId: string, pendingContactId: string, role: string): Promise<void> {
    await db.delete(projectPendingContacts)
      .where(and(
        eq(projectPendingContacts.projectId, projectId),
        eq(projectPendingContacts.pendingContactId, pendingContactId),
        eq(projectPendingContacts.role, role as any)
      ));
  }

  // ============================================================================
  // Pending Companies - Review queue for companies from comps/DD projects
  // ============================================================================

  async getPendingCompanies(orgId: string, status?: string): Promise<PendingCompany[]> {
    const conditions = [eq(pendingCompanies.orgId, orgId)];
    if (status) {
      conditions.push(eq(pendingCompanies.status, status as any));
    }
    return await db.select()
      .from(pendingCompanies)
      .where(and(...conditions))
      .orderBy(desc(pendingCompanies.createdAt));
  }

  async getPendingCompany(id: string, orgId: string): Promise<PendingCompany | undefined> {
    const [company] = await db.select()
      .from(pendingCompanies)
      .where(and(
        eq(pendingCompanies.id, id),
        eq(pendingCompanies.orgId, orgId)
      ));
    return company || undefined;
  }

  async createPendingCompany(data: InsertPendingCompany): Promise<PendingCompany> {
    const [created] = await db.insert(pendingCompanies)
      .values(data as any)
      .returning();
    return created;
  }

  async acceptPendingCompany(id: string, orgId: string, userId: string): Promise<CrmCompany | undefined> {
    return await db.transaction(async (tx) => {
      const [pending] = await tx.select()
        .from(pendingCompanies)
        .where(and(
          eq(pendingCompanies.id, id),
          eq(pendingCompanies.orgId, orgId),
          eq(pendingCompanies.status, 'pending' as any)
        ))
        .limit(1);

      if (!pending) {
        return undefined;
      }

      const [newCompany] = await tx.insert(crmCompanies).values({
        name: pending.name,
        website: pending.website,
        phone: pending.phone,
        address: pending.address,
        city: pending.city,
        state: pending.state,
        zipCode: pending.zipCode,
        industry: pending.industry,
        ownerId: userId,
      }).returning();

      await tx.update(pendingCompanies)
        .set({
          status: 'accepted',
          reviewedBy: userId,
          reviewedAt: new Date(),
          createdCompanyId: newCompany.id,
        })
        .where(and(
          eq(pendingCompanies.id, id),
          eq(pendingCompanies.status, 'pending' as any)
        ));

      return newCompany;
    });
  }

  async rejectPendingCompany(id: string, orgId: string, userId: string): Promise<boolean> {
    const result = await db.update(pendingCompanies)
      .set({
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date(),
      })
      .where(and(
        eq(pendingCompanies.id, id),
        eq(pendingCompanies.orgId, orgId),
        eq(pendingCompanies.status, 'pending' as any)
      ))
      .returning();

    return result.length > 0;
  }

  async updatePendingCompany(id: string, orgId: string, updates: Partial<PendingCompany>): Promise<PendingCompany | undefined> {
    const allowedUpdates: any = {};
    if (updates.name !== undefined) allowedUpdates.name = updates.name;
    if (updates.website !== undefined) allowedUpdates.website = updates.website;
    if (updates.phone !== undefined) allowedUpdates.phone = updates.phone;
    if (updates.address !== undefined) allowedUpdates.address = updates.address;
    if (updates.city !== undefined) allowedUpdates.city = updates.city;
    if (updates.state !== undefined) allowedUpdates.state = updates.state;
    if (updates.zipCode !== undefined) allowedUpdates.zipCode = updates.zipCode;
    if (updates.industry !== undefined) allowedUpdates.industry = updates.industry;

    if (Object.keys(allowedUpdates).length === 0) {
      return this.getPendingCompany(id, orgId);
    }

    const result = await db.update(pendingCompanies)
      .set(allowedUpdates)
      .where(and(
        eq(pendingCompanies.id, id),
        eq(pendingCompanies.orgId, orgId)
      ))
      .returning();

    return result.length > 0 ? result[0] : undefined;
  }

  async mergePendingCompanyWithExisting(pendingId: string, companyId: string, orgId: string, userId: string): Promise<CrmCompany | undefined> {
    return await db.transaction(async (tx) => {
      const [pending] = await tx.select()
        .from(pendingCompanies)
        .where(and(
          eq(pendingCompanies.id, pendingId),
          eq(pendingCompanies.orgId, orgId),
          eq(pendingCompanies.status, 'pending' as any)
        ))
        .limit(1);

      if (!pending) {
        return undefined;
      }

      const [existingCompany] = await tx.select()
        .from(crmCompanies)
        .where(eq(crmCompanies.id, companyId))
        .limit(1);

      if (!existingCompany) {
        return undefined;
      }

      await tx.update(pendingCompanies)
        .set({
          status: 'accepted',
          reviewedBy: userId,
          reviewedAt: new Date(),
          createdCompanyId: companyId,
        })
        .where(and(
          eq(pendingCompanies.id, pendingId),
          eq(pendingCompanies.status, 'pending' as any)
        ));

      return existingCompany;
    });
  }

  // ============================================================================
  // Generic pending entity resolution (delegates to type-specific methods)
  // ============================================================================
  
  async mergePendingWithExisting(
    entityType: 'property' | 'contact' | 'company',
    pendingId: string,
    targetEntityId: string,
    orgId: string,
    userId: string
  ): Promise<any> {
    switch (entityType) {
      case 'property':
        return this.mergePendingPropertyWithExisting(pendingId, targetEntityId, orgId, userId);
      case 'contact':
        return this.mergePendingContactWithExisting(pendingId, targetEntityId, orgId, userId);
      case 'company':
        return this.mergePendingCompanyWithExisting(pendingId, targetEntityId, orgId, userId);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }
  
  async rejectPendingEntity(
    entityType: 'property' | 'contact' | 'company',
    pendingId: string,
    orgId: string,
    userId: string
  ): Promise<boolean> {
    switch (entityType) {
      case 'property':
        return this.rejectPendingProperty(pendingId, orgId, userId);
      case 'contact':
        return this.rejectPendingContact(pendingId, orgId, userId);
      case 'company':
        return this.rejectPendingCompany(pendingId, orgId, userId);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }
  
  async acceptPendingEntity(
    entityType: 'property' | 'contact' | 'company',
    pendingId: string,
    orgId: string,
    userId: string
  ): Promise<any> {
    switch (entityType) {
      case 'property':
        return this.acceptPendingProperty(pendingId, orgId, userId);
      case 'contact':
        return this.acceptPendingContact(pendingId, orgId, userId);
      case 'company':
        return this.acceptPendingCompany(pendingId, orgId, userId);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  // ============================================================================
  // Auto-create pending records from sales comps with deduplication
  // ============================================================================

  async autoCreatePendingCompanyFromSalesComp(params: {
    salesCompId: string;
    orgId: string;
    userId: string;
    buyerCompany: string;
    city?: string;
    state?: string;
  }): Promise<{ created: boolean; pendingCompany?: PendingCompany; reason?: string }> {
    const { salesCompId, orgId, userId, buyerCompany, city, state } = params;

    if (!buyerCompany || buyerCompany.trim() === '') {
      return { created: false, reason: 'No buyer company name provided' };
    }

    const companyName = buyerCompany.trim();

    // Check if ANY pending company record already exists for this sales comp (regardless of status)
    // This prevents re-creating records that have already been accepted or rejected
    const existingPending = await db.select()
      .from(pendingCompanies)
      .where(and(
        eq(pendingCompanies.orgId, orgId),
        eq(pendingCompanies.sourceType, 'sales_comp'),
        eq(pendingCompanies.sourceId, salesCompId)
      ))
      .limit(1);

    if (existingPending.length > 0) {
      return { 
        created: false, 
        pendingCompany: existingPending[0],
        reason: `Pending company already processed for this comp (status: ${existingPending[0].status})` 
      };
    }

    // Check if similar company already exists in CRM
    const similarCompanies = await this.findSimilarCompanies(orgId, companyName);
    if (similarCompanies.length > 0) {
      // Create pending company with suggested duplicates for user review
      const pendingCompany = await this.createPendingCompany({
        orgId,
        sourceType: 'sales_comp',
        sourceId: salesCompId,
        name: companyName,
        city,
        state,
        status: 'pending',
        suggestedDuplicates: similarCompanies.map(c => c.id),
        sourceMetadata: { salesCompId, buyerCompany },
        createdBy: userId,
      });
      return { 
        created: true, 
        pendingCompany,
        reason: `Created with ${similarCompanies.length} potential duplicate(s) found` 
      };
    }

    // No duplicates found, create pending company
    const pendingCompany = await this.createPendingCompany({
      orgId,
      sourceType: 'sales_comp',
      sourceId: salesCompId,
      name: companyName,
      city,
      state,
      status: 'pending',
      sourceMetadata: { salesCompId, buyerCompany },
      createdBy: userId,
    });

    return { created: true, pendingCompany };
  }

  async autoCreatePendingContactFromSalesComp(params: {
    salesCompId: string;
    orgId: string;
    userId: string;
    agentFirstName?: string;
    agentLastName?: string;
    brokerage?: string;
  }): Promise<{ created: boolean; pendingContact?: PendingContact; reason?: string }> {
    const { salesCompId, orgId, userId, agentFirstName, agentLastName, brokerage } = params;

    // Need at least one name field
    if ((!agentFirstName || agentFirstName.trim() === '') && 
        (!agentLastName || agentLastName.trim() === '')) {
      return { created: false, reason: 'No agent name provided' };
    }

    const firstName = agentFirstName?.trim() || '';
    const lastName = agentLastName?.trim() || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    // Check if ANY pending contact record already exists for this sales comp (regardless of status)
    // This prevents re-creating records that have already been accepted or rejected
    const existingPending = await db.select()
      .from(pendingContacts)
      .where(and(
        eq(pendingContacts.orgId, orgId),
        eq(pendingContacts.sourceType, 'sales_comp'),
        eq(pendingContacts.sourceId, salesCompId)
      ))
      .limit(1);

    if (existingPending.length > 0) {
      return { 
        created: false, 
        pendingContact: existingPending[0],
        reason: `Pending contact already processed for this comp (status: ${existingPending[0].status})` 
      };
    }

    // Check if similar contact already exists in CRM
    const similarContacts = await this.findSimilarContacts(orgId, fullName);
    if (similarContacts.length > 0) {
      // Create pending contact with suggested duplicates for user review
      const pendingContact = await this.createPendingContact({
        orgId,
        sourceType: 'sales_comp',
        sourceId: salesCompId,
        firstName,
        lastName,
        fullName,
        jobTitle: brokerage ? `Agent at ${brokerage}` : 'Real Estate Agent',
        status: 'pending',
        suggestedDuplicates: similarContacts.map(c => c.id),
        sourceMetadata: { salesCompId, agentFirstName, agentLastName, brokerage },
        createdBy: userId,
      });
      return { 
        created: true, 
        pendingContact,
        reason: `Created with ${similarContacts.length} potential duplicate(s) found` 
      };
    }

    // No duplicates found, create pending contact
    const pendingContact = await this.createPendingContact({
      orgId,
      sourceType: 'sales_comp',
      sourceId: salesCompId,
      firstName,
      lastName,
      fullName,
      jobTitle: brokerage ? `Agent at ${brokerage}` : 'Real Estate Agent',
      status: 'pending',
      sourceMetadata: { salesCompId, agentFirstName, agentLastName, brokerage },
      createdBy: userId,
    });

    return { created: true, pendingContact };
  }

  // ============================================================================
  // SALESCOMPS METHOD ALIASES - Map short names (used by routes) to long names
  // ============================================================================

  // Sales Comps CRUD - Aliases
  async getComps(params: {
    orgId: string;
    filters?: Record<string, any>;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<{ comps: SalesComp[]; total: number }> {
    return this.getSalesComps(params);
  }

  async getComp(id: string, orgId: string): Promise<SalesComp | undefined> {
    return this.getSalesComp(id, orgId);
  }

  async createComp(comp: InsertSalesComp): Promise<SalesComp> {
    return this.createSalesComp(comp);
  }

  async updateComp(id: string, comp: UpdateSalesComp, orgId: string): Promise<SalesComp | undefined> {
    return this.updateSalesComp(id, comp, orgId);
  }

  async deleteComp(id: string, orgId: string, deletedBy: string): Promise<boolean> {
    return this.deleteSalesComp(id, orgId, deletedBy);
  }

  async bulkUpdateComps(ids: string[], updates: UpdateSalesComp, orgId: string): Promise<number> {
    return this.bulkUpdateSalesComps(ids, updates, orgId);
  }

  async bulkDeleteComps(ids: string[], orgId: string, deletedBy: string): Promise<number> {
    return this.bulkDeleteSalesComps(ids, orgId, deletedBy);
  }

  // Column Management - Aliases
  async getColumns(orgId: string): Promise<CompColumn[]> {
    return this.getCompColumns(orgId);
  }

  async createColumn(column: InsertCompColumn): Promise<CompColumn> {
    return this.createCompColumn(column);
  }

  async updateColumn(id: string, column: UpdateCompColumn, orgId: string): Promise<CompColumn | undefined> {
    return this.updateCompColumn(id, column, orgId);
  }

  async deleteColumn(id: string, orgId: string): Promise<boolean> {
    return this.deleteCompColumn(id, orgId);
  }

  // Import Operations - Aliases
  async createImport(importData: InsertCompImport): Promise<CompImport> {
    return this.createCompImport(importData);
  }

  async getImport(id: string, orgId: string): Promise<CompImport | undefined> {
    return this.getCompImport(id, orgId);
  }

  async updateImport(id: string, updates: Partial<InsertCompImport>, orgId: string): Promise<CompImport | undefined> {
    return this.updateCompImport(id, updates, orgId);
  }

  // Project Operations - Aliases
  async getProjects(orgId: string, userId: string): Promise<ScProject[]> {
    return this.getScProjects(orgId, userId);
  }

  async getProject(id: string, orgId: string): Promise<ScProject | undefined> {
    return this.getScProject(id, orgId);
  }

  async createProject(data: InsertScProject): Promise<ScProject> {
    return this.createScProject(data);
  }

  async updateProject(id: string, data: UpdateScProject, orgId: string): Promise<ScProject | undefined> {
    return this.updateScProject(id, data, orgId);
  }

  async deleteProject(id: string, orgId: string, deletedBy: string): Promise<boolean> {
    return this.deleteScProject(id, orgId, deletedBy);
  }

  // Project-Comp Operations - Aliases
  async getProjectComps(projectId: string, orgId: string): Promise<(ScProjectComp & { salesComp: SalesComp })[]> {
    return this.getScProjectComps(projectId, orgId);
  }

  async addCompToProject(projectId: string, salesCompId: string, orgId: string, userId: string): Promise<ScProjectComp> {
    return this.addCompToScProject(projectId, salesCompId, orgId, userId);
  }

  async removeCompFromProject(projectId: string, salesCompId: string, orgId: string): Promise<boolean> {
    return this.removeCompFromScProject(projectId, salesCompId, orgId);
  }

  async updateProjectComp(id: string, data: UpdateScProjectComp, orgId: string): Promise<ScProjectComp | undefined> {
    return this.updateScProjectComp(id, data, orgId);
  }

  // Saved Searches - Aliases
  async getSavedSearches(orgId: string, userId?: string): Promise<ScSavedSearch[]> {
    return this.getScSavedSearches(orgId, userId);
  }

  async getSavedSearch(id: string, orgId: string): Promise<ScSavedSearch | undefined> {
    return this.getScSavedSearch(id, orgId);
  }

  async createSavedSearch(data: InsertScSavedSearch): Promise<ScSavedSearch> {
    return this.createScSavedSearch(data);
  }

  async updateSavedSearch(id: string, data: UpdateScSavedSearch, orgId: string): Promise<ScSavedSearch | undefined> {
    return this.updateScSavedSearch(id, data, orgId);
  }

  async deleteSavedSearch(id: string, orgId: string, deletedBy: string): Promise<boolean> {
    return this.deleteScSavedSearch(id, orgId, deletedBy);
  }

  async incrementSavedSearchUsage(id: string, orgId: string): Promise<void> {
    return this.incrementScSavedSearchUsage(id, orgId);
  }

  // Analytics Filter Presets - Aliases
  async getAnalyticsFilterPresets(orgId: string, userId: string): Promise<ScAnalyticsFilterPreset[]> {
    return this.getScAnalyticsFilterPresets(orgId, userId);
  }

  async createAnalyticsFilterPreset(data: InsertScAnalyticsFilterPreset): Promise<ScAnalyticsFilterPreset> {
    return this.createScAnalyticsFilterPreset(data);
  }

  async updateAnalyticsFilterPreset(id: string, data: UpdateScAnalyticsFilterPreset, orgId: string, userId: string): Promise<ScAnalyticsFilterPreset | undefined> {
    return this.updateScAnalyticsFilterPreset(id, data, orgId, userId);
  }

  async deleteAnalyticsFilterPreset(id: string, orgId: string, userId: string): Promise<boolean> {
    return this.deleteScAnalyticsFilterPreset(id, orgId, userId);
  }

  // Recommendation System - Aliases
  async getCompsForRecommendation(params: {
    orgId: string;
    filters?: Record<string, any>;
  }): Promise<SalesComp[]> {
    return this.getSalesCompsForRecommendation(params);
  }

  async createRecommendationFeedback(feedback: InsertScRecommendationFeedback): Promise<ScRecommendationFeedback> {
    return this.createScRecommendationFeedback(feedback);
  }

  async getRecommendationFeedback(orgId: string, projectId?: string): Promise<ScRecommendationFeedback[]> {
    return this.getScRecommendationFeedback(orgId, projectId);
  }

  // Organization Preferences - Aliases
  async getOrgPreferences(orgId: string, segmentKey: string): Promise<ScOrgPreferences | undefined> {
    return this.getScOrgPreferences(orgId, segmentKey);
  }

  async upsertOrgPreferences(preferences: InsertScOrgPreferences): Promise<ScOrgPreferences> {
    return this.upsertScOrgPreferences(preferences);
  }

  async updateOrgPreferences(orgId: string, segmentKey: string, updates: UpdateScOrgPreferences): Promise<ScOrgPreferences | undefined> {
    return this.updateScOrgPreferences(orgId, segmentKey, updates);
  }

  // ============================================================================
  // RATE COMPS STORAGE METHODS
  // ============================================================================

  // Rate Comps Operations
  async getRateComps(params: {
    orgId: string;
    filters?: Record<string, any>;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  }): Promise<{ comps: RateComp[]; total: number }> {
    const { orgId, filters = {}, sortBy = 'createdAt', sortDir = 'desc', page = 1, pageSize = 25 } = params;
    
    const conditions = [eq(rateComps.orgId, orgId), isNull(rateComps.deletedAt)];
    
    if (filters.q) {
      conditions.push(sql`${rateComps.marina} ILIKE ${`%${filters.q}%`}`);
    }
    if (filters.states && filters.states.length > 0) {
      conditions.push(inArray(rateComps.state, filters.states));
    }
    if (filters.storageTypes && filters.storageTypes.length > 0) {
      conditions.push(sql`${rateComps.storageTypes} && ARRAY[${sql.raw(filters.storageTypes.map((t: string) => `'${t}'`).join(','))}]::text[]`);
    }
    if (filters.rateTypes && filters.rateTypes.length > 0) {
      conditions.push(inArray(rateComps.rateType, filters.rateTypes));
    }
    if (filters.seasonalities && filters.seasonalities.length > 0) {
      conditions.push(inArray(rateComps.seasonality, filters.seasonalities));
    }
    if (filters.boatLengthMin) {
      conditions.push(sql`${rateComps.boatLengthMax} >= ${filters.boatLengthMin}`);
    }
    if (filters.boatLengthMax) {
      conditions.push(sql`${rateComps.boatLengthMin} <= ${filters.boatLengthMax}`);
    }
    if (filters.saleYearMin) {
      conditions.push(sql`${rateComps.saleYear} >= ${filters.saleYearMin}`);
    }
    if (filters.saleYearMax) {
      conditions.push(sql`${rateComps.saleYear} <= ${filters.saleYearMax}`);
    }
    if (filters.priceMin) {
      conditions.push(sql`${rateComps.salePrice} >= ${filters.priceMin}`);
    }
    if (filters.priceMax) {
      conditions.push(sql`${rateComps.salePrice} <= ${filters.priceMax}`);
    }
    if (filters.disclosedOnly) {
      conditions.push(isNotNull(rateComps.salePrice));
    }
    if (filters.disclosedCapRateOnly) {
      conditions.push(isNotNull(rateComps.capRate));
    }
    if (filters.portfoliosOnly) {
      conditions.push(eq(rateComps.isPortfolio, true));
    }

    const [{ total }] = await db.select({ total: count() })
      .from(rateComps)
      .where(and(...conditions));

    const orderColumn = sortBy === 'marina' ? rateComps.marina :
                       sortBy === 'saleYear' ? rateComps.saleYear :
                       sortBy === 'salePrice' ? rateComps.salePrice :
                       sortBy === 'state' ? rateComps.state :
                       rateComps.createdAt;
    
    const orderFn = sortDir === 'asc' ? asc : desc;

    const comps = await db.select().from(rateComps)
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Fetch tiers for all comps in this page
    if (comps.length > 0) {
      const compIds = comps.map(c => c.id);
      const allTiers = await db.select()
        .from(rateTiers)
        .where(and(
          inArray(rateTiers.rateCompId, compIds),
          eq(rateTiers.orgId, orgId)
        ))
        .orderBy(asc(rateTiers.displayOrder), asc(rateTiers.createdAt));

      // Group tiers by comp ID
      const tiersByCompId = new Map<string, typeof allTiers>();
      for (const tier of allTiers) {
        const existing = tiersByCompId.get(tier.rateCompId) || [];
        existing.push(tier);
        tiersByCompId.set(tier.rateCompId, existing);
      }

      // Attach tiers to each comp
      const compsWithTiers = comps.map(comp => ({
        ...comp,
        tiers: tiersByCompId.get(comp.id) || [],
        tierCount: (tiersByCompId.get(comp.id) || []).length,
      }));

      return { comps: compsWithTiers as any, total };
    }

    return { comps, total };
  }

  async getAllRateCompIds(orgId: string): Promise<string[]> {
    const comps = await db.select({ id: rateComps.id })
      .from(rateComps)
      .where(and(
        eq(rateComps.orgId, orgId),
        isNull(rateComps.deletedAt)
      ));
    return comps.map(comp => comp.id);
  }

  async getRateCompColumnUniqueValues(orgId: string, column: string): Promise<string[]> {
    try {
      let dbColumn;
      switch (column) {
        case 'marina':
          dbColumn = rateComps.marina;
          break;
        case 'state':
          dbColumn = rateComps.state;
          break;
        case 'saleYear':
          dbColumn = rateComps.saleYear;
          break;
        case 'region':
          dbColumn = rateComps.region;
          break;
        default:
          return [];
      }

      const results = await db
        .selectDistinct({ value: dbColumn })
        .from(rateComps)
        .where(and(
          eq(rateComps.orgId, orgId),
          isNull(rateComps.deletedAt),
          column === 'saleYear' ? 
            sql`${dbColumn} IS NOT NULL AND ${dbColumn}::text != '' AND ${dbColumn} > 0` : 
            sql`${dbColumn} IS NOT NULL AND ${dbColumn} != ''`
        ))
        .orderBy(asc(dbColumn));

      return results.map(r => String(r.value)).filter(Boolean);
    } catch (error) {
      console.error(`Error getting unique values for column ${column}:`, error);
      return [];
    }
  }

  async getRateComp(id: string, orgId: string): Promise<RateComp | undefined> {
    const [comp] = await db.select().from(rateComps)
      .where(and(
        eq(rateComps.id, id),
        eq(rateComps.orgId, orgId),
        isNull(rateComps.deletedAt)
      ));
    return comp;
  }

  async createRateComp(comp: InsertRateComp): Promise<RateComp> {
    const [newComp] = await db.insert(rateComps).values(comp as any).returning();
    return newComp;
  }

  async updateRateComp(id: string, comp: UpdateRateComp, orgId: string): Promise<RateComp | undefined> {
    const [updatedComp] = await db.update(rateComps)
      .set({ ...comp, updatedAt: new Date() } as any)
      .where(and(
        eq(rateComps.id, id),
        eq(rateComps.orgId, orgId),
        isNull(rateComps.deletedAt)
      ))
      .returning();
    return updatedComp;
  }

  async deleteRateComp(id: string, orgId: string, deletedBy: string): Promise<boolean> {
    const [deletedComp] = await db.update(rateComps)
      .set({ deletedAt: new Date(), updatedBy: deletedBy })
      .where(and(
        eq(rateComps.id, id),
        eq(rateComps.orgId, orgId),
        isNull(rateComps.deletedAt)
      ))
      .returning();
    return !!deletedComp;
  }

  async bulkUpdateRateComps(ids: string[], updates: UpdateRateComp, orgId: string): Promise<number> {
    const result = await db.update(rateComps)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(and(
        inArray(rateComps.id, ids),
        eq(rateComps.orgId, orgId),
        isNull(rateComps.deletedAt)
      ));
    return result.rowCount || 0;
  }

  async bulkDeleteRateComps(ids: string[], orgId: string, deletedBy: string): Promise<number> {
    const CHUNK_SIZE = 1000;
    let totalDeleted = 0;

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const result = await db.update(rateComps)
        .set({ deletedAt: new Date(), updatedBy: deletedBy })
        .where(and(
          inArray(rateComps.id, chunk),
          eq(rateComps.orgId, orgId),
          isNull(rateComps.deletedAt)
        ));
      totalDeleted += result.rowCount || 0;
    }
    
    return totalDeleted;
  }

  // Search by marina name for import conflict detection
  async getRateCompsByMarinaName(orgId: string, marinaName: string): Promise<RateComp[]> {
    return await db.select().from(rateComps)
      .where(and(
        eq(rateComps.orgId, orgId),
        sql`LOWER(${rateComps.marina}) = LOWER(${marinaName})`,
        isNull(rateComps.deletedAt)
      ))
      .limit(5);
  }

  // Columns Operations
  async getRateCompColumns(orgId: string): Promise<RateCompColumn[]> {
    return await db.select().from(rateCompColumns)
      .where(eq(rateCompColumns.orgId, orgId))
      .orderBy(asc(rateCompColumns.orderIndex));
  }

  async createRateCompColumn(column: InsertRateCompColumn): Promise<RateCompColumn> {
    const [newColumn] = await db.insert(rateCompColumns).values(column as any).returning();
    return newColumn;
  }

  async updateRateCompColumn(id: string, column: UpdateRateCompColumn, orgId: string): Promise<RateCompColumn | undefined> {
    const [updatedColumn] = await db.update(rateCompColumns)
      .set({ ...column, updatedAt: new Date() } as any)
      .where(and(eq(rateCompColumns.id, id), eq(rateCompColumns.orgId, orgId)))
      .returning();
    return updatedColumn;
  }

  async deleteRateCompColumn(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(rateCompColumns)
      .where(and(eq(rateCompColumns.id, id), eq(rateCompColumns.orgId, orgId)));
    return (result.rowCount || 0) > 0;
  }

  // Import Operations
  async createRateCompImport(importData: InsertRateCompImport): Promise<RateCompImport> {
    const [newImport] = await db.insert(rateCompImports).values(importData as any).returning();
    return newImport;
  }

  async getRateCompImport(id: string, orgId: string): Promise<RateCompImport | undefined> {
    const [importRecord] = await db.select().from(rateCompImports)
      .where(and(eq(rateCompImports.id, id), eq(rateCompImports.orgId, orgId)));
    return importRecord;
  }

  async updateRateCompImport(id: string, updates: Partial<RateCompImport>, orgId: string): Promise<RateCompImport | undefined> {
    const [updatedImport] = await db.update(rateCompImports)
      .set(updates)
      .where(and(eq(rateCompImports.id, id), eq(rateCompImports.orgId, orgId)))
      .returning();
    return updatedImport;
  }

  // Duplicate Detection
  async findPotentialRateCompDuplicates(orgId: string, marina: string, state?: string, saleYear?: number): Promise<RateComp[]> {
    const duplicates = await db.select()
      .from(rateComps)
      .where(and(
        eq(rateComps.orgId, orgId),
        isNull(rateComps.deletedAt),
        sql`LOWER(${rateComps.marina}) = LOWER(${marina})`,
        state ? sql`LOWER(${rateComps.state}) = LOWER(${state})` : sql`1=1`,
        saleYear ? eq(rateComps.saleYear, saleYear) : sql`1=1`
      ))
      .limit(10);
    
    return duplicates;
  }

  // RC Project Operations
  async getRcProjects(orgId: string, userId: string): Promise<RcProject[]> {
    return await db.select().from(rcProjects)
      .where(and(
        eq(rcProjects.orgId, orgId),
        isNull(rcProjects.deletedAt)
      ))
      .orderBy(desc(rcProjects.updatedAt));
  }

  async getRcProject(id: string, orgId: string): Promise<RcProject | undefined> {
    const [project] = await db.select().from(rcProjects)
      .where(and(
        eq(rcProjects.id, id),
        eq(rcProjects.orgId, orgId),
        isNull(rcProjects.deletedAt)
      ));
    return project;
  }

  async createRcProject(data: InsertRcProject): Promise<RcProject> {
    const [newProject] = await db.insert(rcProjects).values(data as any).returning();
    return newProject;
  }

  async updateRcProject(id: string, data: UpdateRcProject, orgId: string): Promise<RcProject | undefined> {
    const [updatedProject] = await db.update(rcProjects)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(
        eq(rcProjects.id, id),
        eq(rcProjects.orgId, orgId),
        isNull(rcProjects.deletedAt)
      ))
      .returning();
    return updatedProject;
  }

  async deleteRcProject(id: string, orgId: string, deletedBy: string): Promise<boolean> {
    const [deletedProject] = await db.update(rcProjects)
      .set({ deletedAt: new Date(), updatedBy: deletedBy })
      .where(and(
        eq(rcProjects.id, id),
        eq(rcProjects.orgId, orgId),
        isNull(rcProjects.deletedAt)
      ))
      .returning();
    return !!deletedProject;
  }

  // Project-Comp Operations
  async getRcProjectComps(projectId: string, orgId: string): Promise<(RcProjectComp & { rateComp: RateComp })[]> {
    const results = await db.select({
      id: rcProjectComps.id,
      orgId: rcProjectComps.orgId,
      rcProjectId: rcProjectComps.rcProjectId,
      rateCompId: rcProjectComps.rateCompId,
      addedBy: rcProjectComps.addedBy,
      addedAt: rcProjectComps.addedAt,
      notes: rcProjectComps.notes,
      rateComp: rateComps,
    })
      .from(rcProjectComps)
      .innerJoin(rateComps, and(
        eq(rcProjectComps.rateCompId, rateComps.id),
        eq(rateComps.orgId, rcProjectComps.orgId),
        isNull(rateComps.deletedAt)
      ))
      .where(and(
        eq(rcProjectComps.rcProjectId, projectId),
        eq(rcProjectComps.orgId, orgId)
      ))
      .orderBy(desc(rcProjectComps.addedAt));

    return results as (RcProjectComp & { rateComp: RateComp })[];
  }

  async addCompToRcProject(projectId: string, rateCompId: string, orgId: string, userId: string): Promise<RcProjectComp> {
    const project = await this.getRcProject(projectId, orgId);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const rateComp = await this.getRateComp(rateCompId, orgId);
    if (!rateComp) {
      throw new Error('Rate comp not found or access denied');
    }

    const [projectComp] = await db.insert(rcProjectComps).values({
      orgId,
      rcProjectId: projectId,
      rateCompId,
      addedBy: userId,
    } as any).returning();
    return projectComp;
  }

  async removeCompFromRcProject(projectId: string, rateCompId: string, orgId: string): Promise<boolean> {
    const result = await db.delete(rcProjectComps)
      .where(and(
        eq(rcProjectComps.rcProjectId, projectId),
        eq(rcProjectComps.rateCompId, rateCompId),
        eq(rcProjectComps.orgId, orgId)
      ));
    return (result.rowCount || 0) > 0;
  }

  async updateRcProjectComp(id: string, data: UpdateRcProjectComp, orgId: string): Promise<RcProjectComp | undefined> {
    const [updatedProjectComp] = await db.update(rcProjectComps)
      .set(data as any)
      .where(and(
        eq(rcProjectComps.id, id),
        eq(rcProjectComps.orgId, orgId)
      ))
      .returning();
    return updatedProjectComp;
  }

  // Audit Operations
  async createRcAuditLog(log: {
    orgId: string;
    userId: string;
    entity: string;
    entityId: string;
    action: string;
    before?: any;
    after?: any;
  }): Promise<RcAuditLog> {
    const [auditEntry] = await db.insert(rcAuditLog).values(log).returning();
    return auditEntry;
  }

  // Recommendation System
  async getRateCompsForRecommendation(params: {
    orgId: string;
    filters?: Record<string, any>;
  }): Promise<RateComp[]> {
    const { orgId, filters = {} } = params;
    
    const conditions = [
      eq(rateComps.orgId, orgId),
      isNull(rateComps.deletedAt)
    ];

    // Geographic filters
    if (filters.regions && filters.regions.length > 0) {
      conditions.push(inArray(rateComps.region, filters.regions));
    }
    if (filters.states && filters.states.length > 0) {
      conditions.push(inArray(rateComps.state, filters.states));
    }
    if (filters.coastalType) {
      conditions.push(eq(rateComps.coastalType, filters.coastalType));
    }
    
    // Price range filters
    if (filters.priceMin !== undefined && filters.priceMin !== null) {
      conditions.push(sql`COALESCE(${rateComps.salePrice}, 0) >= ${filters.priceMin}`);
    }
    if (filters.priceMax !== undefined && filters.priceMax !== null) {
      conditions.push(sql`COALESCE(${rateComps.salePrice}, 0) <= ${filters.priceMax}`);
    }
    
    // NOI range filters
    if (filters.noiMin !== undefined && filters.noiMin !== null) {
      conditions.push(sql`COALESCE(${rateComps.noi}, 0) >= ${filters.noiMin}`);
    }
    if (filters.noiMax !== undefined && filters.noiMax !== null) {
      conditions.push(sql`COALESCE(${rateComps.noi}, 0) <= ${filters.noiMax}`);
    }
    
    // Storage capacity filters
    if (filters.wetSlipsMin !== undefined && filters.wetSlipsMin !== null) {
      conditions.push(sql`COALESCE(${rateComps.wetSlips}, 0) >= ${filters.wetSlipsMin}`);
    }
    if (filters.wetSlipsMax !== undefined && filters.wetSlipsMax !== null) {
      conditions.push(sql`COALESCE(${rateComps.wetSlips}, 0) <= ${filters.wetSlipsMax}`);
    }
    if (filters.dryRacksMin !== undefined && filters.dryRacksMin !== null) {
      conditions.push(sql`COALESCE(${rateComps.dryRacks}, 0) >= ${filters.dryRacksMin}`);
    }
    if (filters.dryRacksMax !== undefined && filters.dryRacksMax !== null) {
      conditions.push(sql`COALESCE(${rateComps.dryRacks}, 0) <= ${filters.dryRacksMax}`);
    }
    
    // Exclude IDs
    if (filters.excludeIds && filters.excludeIds.length > 0) {
      conditions.push(sql`${rateComps.id} NOT IN (${sql.join(filters.excludeIds.map((id: string) => sql`${id}`), sql`, `)})`);
    }

    const comps = await db.select().from(rateComps)
      .where(and(...conditions))
      .orderBy(desc(rateComps.createdAt));

    return comps;
  }

  // Recommendation Feedback
  async createRcRecommendationFeedback(feedback: InsertRcRecommendationFeedback): Promise<RcRecommendationFeedback> {
    const [newFeedback] = await db.insert(rcRecommendationFeedback)
      .values(feedback as any)
      .returning();
    return newFeedback;
  }

  async getRcRecommendationFeedback(orgId: string, projectId?: string): Promise<RcRecommendationFeedback[]> {
    const conditions = [eq(rcRecommendationFeedback.orgId, orgId)];
    if (projectId) {
      conditions.push(eq(rcRecommendationFeedback.rcProjectId, projectId));
    }

    return await db.select().from(rcRecommendationFeedback)
      .where(and(...conditions))
      .orderBy(desc(rcRecommendationFeedback.createdAt));
  }

  // Organization Preferences
  async getRcOrgPreferences(orgId: string, segmentKey: string): Promise<RcOrgPreferences | undefined> {
    const [preferences] = await db.select().from(rcOrgPreferences)
      .where(and(
        eq(rcOrgPreferences.orgId, orgId),
        eq(rcOrgPreferences.segmentKey, segmentKey)
      ));
    return preferences;
  }

  async upsertRcOrgPreferences(preferences: InsertRcOrgPreferences): Promise<RcOrgPreferences> {
    const [result] = await db.insert(rcOrgPreferences)
      .values(preferences as any)
      .onConflictDoUpdate({
        target: [rcOrgPreferences.orgId, rcOrgPreferences.segmentKey],
        set: {
          weights: preferences.weights,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateRcOrgPreferences(orgId: string, segmentKey: string, updates: UpdateRcOrgPreferences): Promise<RcOrgPreferences | undefined> {
    const [updatedPreferences] = await db.update(rcOrgPreferences)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(and(
        eq(rcOrgPreferences.orgId, orgId),
        eq(rcOrgPreferences.segmentKey, segmentKey)
      ))
      .returning();
    return updatedPreferences;
  }

  // Saved Searches
  async getRcSavedSearches(orgId: string, userId?: string): Promise<RcSavedSearch[]> {
    const conditions = [
      eq(rcSavedSearches.orgId, orgId),
      isNull(rcSavedSearches.deletedAt)
    ];
    
    if (userId) {
      conditions.push(eq(rcSavedSearches.createdBy, userId));
    }

    return await db.select().from(rcSavedSearches)
      .where(and(...conditions))
      .orderBy(desc(rcSavedSearches.isPinned), desc(rcSavedSearches.lastUsedAt));
  }

  async getRcSavedSearch(id: string, orgId: string): Promise<RcSavedSearch | undefined> {
    const [savedSearch] = await db.select().from(rcSavedSearches)
      .where(and(
        eq(rcSavedSearches.id, id),
        eq(rcSavedSearches.orgId, orgId),
        isNull(rcSavedSearches.deletedAt)
      ));
    return savedSearch;
  }

  async createRcSavedSearch(data: InsertRcSavedSearch): Promise<RcSavedSearch> {
    const [newSearch] = await db.insert(rcSavedSearches).values(data as any).returning();
    return newSearch;
  }

  async updateRcSavedSearch(id: string, data: UpdateRcSavedSearch, orgId: string): Promise<RcSavedSearch | undefined> {
    const [updatedSearch] = await db.update(rcSavedSearches)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(
        eq(rcSavedSearches.id, id),
        eq(rcSavedSearches.orgId, orgId),
        isNull(rcSavedSearches.deletedAt)
      ))
      .returning();
    return updatedSearch;
  }

  async deleteRcSavedSearch(id: string, orgId: string, deletedBy: string): Promise<boolean> {
    const [deletedSearch] = await db.update(rcSavedSearches)
      .set({ deletedAt: new Date(), updatedBy: deletedBy })
      .where(and(
        eq(rcSavedSearches.id, id),
        eq(rcSavedSearches.orgId, orgId),
        isNull(rcSavedSearches.deletedAt)
      ))
      .returning();
    return !!deletedSearch;
  }

  async incrementRcSavedSearchUsage(id: string, orgId: string): Promise<void> {
    await db.update(rcSavedSearches)
      .set({
        useCount: sql`${rcSavedSearches.useCount} + 1`,
        lastUsedAt: new Date()
      })
      .where(and(
        eq(rcSavedSearches.id, id),
        eq(rcSavedSearches.orgId, orgId),
        isNull(rcSavedSearches.deletedAt)
      ));
  }

  // Custom Storage Types
  async getRcCustomStorageTypes(orgId: string): Promise<RcCustomStorageType[]> {
    return await db.select()
      .from(rcCustomStorageTypes)
      .where(eq(rcCustomStorageTypes.orgId, orgId))
      .orderBy(asc(rcCustomStorageTypes.name));
  }

  async createRcCustomStorageType(data: InsertRcCustomStorageType): Promise<RcCustomStorageType> {
    const [created] = await db.insert(rcCustomStorageTypes)
      .values(data as any)
      .returning();
    return created;
  }

  async deleteRcCustomStorageType(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(rcCustomStorageTypes)
      .where(and(
        eq(rcCustomStorageTypes.id, id),
        eq(rcCustomStorageTypes.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Pending Property Profiles
  async getRcPendingPropertyProfiles(orgId: string, status?: string): Promise<RcPendingPropertyProfile[]> {
    const conditions = [eq(rcPendingPropertyProfiles.orgId, orgId)];
    if (status) {
      conditions.push(eq(rcPendingPropertyProfiles.status, status));
    }
    return await db.select()
      .from(rcPendingPropertyProfiles)
      .where(and(...conditions))
      .orderBy(desc(rcPendingPropertyProfiles.createdAt));
  }

  async createRcPendingPropertyProfile(data: InsertRcPendingPropertyProfile): Promise<RcPendingPropertyProfile> {
    const [created] = await db.insert(rcPendingPropertyProfiles)
      .values(data as any)
      .returning();
    return created;
  }

  async updateRcPendingPropertyProfile(id: string, data: Partial<InsertRcPendingPropertyProfile>): Promise<RcPendingPropertyProfile> {
    const [updated] = await db.update(rcPendingPropertyProfiles)
      .set(data)
      .where(eq(rcPendingPropertyProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteRcPendingPropertyProfile(id: string): Promise<boolean> {
    const result = await db.delete(rcPendingPropertyProfiles)
      .where(eq(rcPendingPropertyProfiles.id, id))
      .returning();
    return result.length > 0;
  }

  // RateComps - Rate Tiers (flexible pricing tiers)
  async getRateTiersByRateComp(rateCompId: string, orgId: string): Promise<RateTier[]> {
    return await db.select()
      .from(rateTiers)
      .where(and(
        eq(rateTiers.rateCompId, rateCompId),
        eq(rateTiers.orgId, orgId)
      ))
      .orderBy(asc(rateTiers.loaMin), asc(rateTiers.beamMin));
  }

  async getRateTiersByOrg(orgId: string, filters?: { storageType?: string; isCurrentRate?: boolean; loaRange?: { min?: number; max?: number } }): Promise<RateTier[]> {
    const conditions = [eq(rateTiers.orgId, orgId)];
    
    if (filters?.storageType) {
      conditions.push(eq(rateTiers.storageType, filters.storageType));
    }
    if (filters?.isCurrentRate !== undefined) {
      conditions.push(eq(rateTiers.isCurrentRate, filters.isCurrentRate));
    }
    if (filters?.loaRange?.min !== undefined) {
      conditions.push(sql`${rateTiers.loaMax} >= ${filters.loaRange.min}`);
    }
    if (filters?.loaRange?.max !== undefined) {
      conditions.push(sql`${rateTiers.loaMin} <= ${filters.loaRange.max}`);
    }

    return await db.select()
      .from(rateTiers)
      .where(and(...conditions))
      .orderBy(asc(rateTiers.loaMin), asc(rateTiers.createdAt));
  }

  async getRateTier(id: string, orgId: string): Promise<RateTier | undefined> {
    const [tier] = await db.select()
      .from(rateTiers)
      .where(and(eq(rateTiers.id, id), eq(rateTiers.orgId, orgId)));
    return tier || undefined;
  }

  async createRateTier(tier: InsertRateTier): Promise<RateTier> {
    const [created] = await db.insert(rateTiers).values(tier).returning();
    return created;
  }

  async updateRateTier(id: string, updates: UpdateRateTier, orgId: string): Promise<RateTier | undefined> {
    const [updated] = await db.update(rateTiers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(rateTiers.id, id), eq(rateTiers.orgId, orgId)))
      .returning();
    return updated || undefined;
  }

  async deleteRateTier(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(rateTiers)
      .where(and(eq(rateTiers.id, id), eq(rateTiers.orgId, orgId)))
      .returning();
    return result.length > 0;
  }

  async bulkCreateRateTiers(tiers: InsertRateTier[]): Promise<RateTier[]> {
    if (tiers.length === 0) return [];
    return await db.insert(rateTiers).values(tiers).returning();
  }

  async getRateCompWithTiers(rateCompId: string, orgId: string): Promise<RateCompWithTiers | undefined> {
    const [comp] = await db.select()
      .from(rateComps)
      .where(and(eq(rateComps.id, rateCompId), eq(rateComps.orgId, orgId), isNull(rateComps.deletedAt)));
    
    if (!comp) return undefined;
    
    const tiers = await this.getRateTiersByRateComp(rateCompId, orgId);
    return { ...comp, tiers };
  }

  async getRateCompsWithTiers(orgId: string, filters?: Record<string, any>): Promise<RateCompWithTiers[]> {
    const { comps } = await this.getRateComps({ orgId, filters, pageSize: 1000 });
    
    if (comps.length === 0) return [];

    const compIds = comps.map(c => c.id);
    const allTiers = await db.select()
      .from(rateTiers)
      .where(and(
        inArray(rateTiers.rateCompId, compIds),
        eq(rateTiers.orgId, orgId)
      ));

    const tiersByCompId = new Map<string, RateTier[]>();
    for (const tier of allTiers) {
      const existing = tiersByCompId.get(tier.rateCompId) || [];
      existing.push(tier);
      tiersByCompId.set(tier.rateCompId, existing);
    }

    return comps.map(comp => ({
      ...comp,
      tiers: tiersByCompId.get(comp.id) || []
    }));
  }

  // ============================================================================
  // MARINA RATE DATABASE STORAGE METHODS
  // ============================================================================

  async getMarinas(params: { 
    orgId: string; 
    filters?: Record<string, any>; 
    sortBy?: string; 
    sortDir?: 'asc' | 'desc'; 
    page?: number; 
    pageSize?: number 
  }): Promise<{ marinas: MarinaRateDatabase[]; total: number }> {
    const { orgId, filters = {}, sortBy = 'marinaName', sortDir = 'asc', page = 1, pageSize = 25 } = params;
    
    const conditions = [eq(marinaRateDatabase.orgId, orgId), isNull(marinaRateDatabase.deletedAt)];
    
    if (filters.q) {
      conditions.push(sql`(
        ${marinaRateDatabase.marinaName} ILIKE ${`%${filters.q}%`} OR
        ${marinaRateDatabase.city} ILIKE ${`%${filters.q}%`} OR
        ${marinaRateDatabase.state} ILIKE ${`%${filters.q}%`}
      )`);
    }
    if (filters.states && filters.states.length > 0) {
      conditions.push(inArray(marinaRateDatabase.state, filters.states));
    }
    if (filters.regions && filters.regions.length > 0) {
      conditions.push(inArray(marinaRateDatabase.region, filters.regions));
    }
    if (filters.waterTypes && filters.waterTypes.length > 0) {
      conditions.push(inArray(marinaRateDatabase.waterType, filters.waterTypes));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(marinaRateDatabase.isActive, filters.isActive));
    }

    const [{ total }] = await db.select({ total: count() })
      .from(marinaRateDatabase)
      .where(and(...conditions));

    const orderColumn = sortBy === 'marinaName' ? marinaRateDatabase.marinaName :
                       sortBy === 'state' ? marinaRateDatabase.state :
                       sortBy === 'city' ? marinaRateDatabase.city :
                       sortBy === 'lastRateUpdate' ? marinaRateDatabase.lastRateUpdate :
                       sortBy === 'wetSlips' ? marinaRateDatabase.wetSlips :
                       marinaRateDatabase.createdAt;
    
    const orderFn = sortDir === 'asc' ? asc : desc;

    const marinas = await db.select().from(marinaRateDatabase)
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { marinas, total };
  }

  async getMarina(id: string, orgId: string): Promise<MarinaRateDatabase | undefined> {
    const [marina] = await db.select()
      .from(marinaRateDatabase)
      .where(and(
        eq(marinaRateDatabase.id, id),
        eq(marinaRateDatabase.orgId, orgId),
        isNull(marinaRateDatabase.deletedAt)
      ));
    return marina || undefined;
  }

  async createMarina(marina: InsertMarinaRateDatabase): Promise<MarinaRateDatabase> {
    const [created] = await db.insert(marinaRateDatabase)
      .values(marina as any)
      .returning();
    return created;
  }

  async updateMarina(id: string, updates: UpdateMarinaRateDatabase, orgId: string): Promise<MarinaRateDatabase | undefined> {
    const [updated] = await db.update(marinaRateDatabase)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(marinaRateDatabase.id, id),
        eq(marinaRateDatabase.orgId, orgId),
        isNull(marinaRateDatabase.deletedAt)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteMarina(id: string, orgId: string): Promise<boolean> {
    const [deleted] = await db.update(marinaRateDatabase)
      .set({ deletedAt: new Date() })
      .where(and(
        eq(marinaRateDatabase.id, id),
        eq(marinaRateDatabase.orgId, orgId)
      ))
      .returning();
    return !!deleted;
  }

  async getMarinaWithRates(id: string, orgId: string): Promise<MarinaWithRates | undefined> {
    const marina = await this.getMarina(id, orgId);
    if (!marina) return undefined;
    
    const rates = await this.getMarinaRates(id, orgId);
    return { ...marina, rates };
  }

  async searchMarinas(orgId: string, query: string, limit: number = 20): Promise<MarinaRateDatabase[]> {
    return await db.select()
      .from(marinaRateDatabase)
      .where(and(
        eq(marinaRateDatabase.orgId, orgId),
        isNull(marinaRateDatabase.deletedAt),
        sql`(
          ${marinaRateDatabase.marinaName} ILIKE ${`%${query}%`} OR
          ${marinaRateDatabase.city} ILIKE ${`%${query}%`} OR
          ${marinaRateDatabase.state} ILIKE ${`%${query}%`}
        )`
      ))
      .orderBy(marinaRateDatabase.marinaName)
      .limit(limit);
  }

  // Marina Rate History Methods
  async getMarinaRates(marinaId: string, orgId: string, filters?: { rateYear?: number; storageType?: string; isCurrentRate?: boolean }): Promise<MarinaRate[]> {
    const conditions = [
      eq(marinaRates.marinaId, marinaId),
      eq(marinaRates.orgId, orgId)
    ];

    if (filters?.rateYear) {
      conditions.push(eq(marinaRates.rateYear, filters.rateYear));
    }
    if (filters?.storageType) {
      conditions.push(eq(marinaRates.storageType, filters.storageType));
    }
    if (filters?.isCurrentRate !== undefined) {
      conditions.push(eq(marinaRates.isCurrentRate, filters.isCurrentRate));
    }

    return await db.select()
      .from(marinaRates)
      .where(and(...conditions))
      .orderBy(desc(marinaRates.rateYear), asc(marinaRates.storageType), asc(marinaRates.loaMin));
  }

  async getMarinaRate(id: string, orgId: string): Promise<MarinaRate | undefined> {
    const [rate] = await db.select()
      .from(marinaRates)
      .where(and(
        eq(marinaRates.id, id),
        eq(marinaRates.orgId, orgId)
      ));
    return rate || undefined;
  }

  async createMarinaRate(rate: InsertMarinaRate): Promise<MarinaRate> {
    const [created] = await db.insert(marinaRates)
      .values(rate as any)
      .returning();
    
    // Update marina's lastRateUpdate timestamp
    await db.update(marinaRateDatabase)
      .set({ lastRateUpdate: new Date(), updatedAt: new Date() })
      .where(eq(marinaRateDatabase.id, rate.marinaId));
    
    return created;
  }

  async updateMarinaRate(id: string, updates: UpdateMarinaRate, orgId: string): Promise<MarinaRate | undefined> {
    const [updated] = await db.update(marinaRates)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(marinaRates.id, id),
        eq(marinaRates.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteMarinaRate(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(marinaRates)
      .where(and(
        eq(marinaRates.id, id),
        eq(marinaRates.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  async getMarinaRateHistory(marinaId: string, orgId: string, storageType?: string): Promise<MarinaRate[]> {
    const conditions = [
      eq(marinaRates.marinaId, marinaId),
      eq(marinaRates.orgId, orgId)
    ];

    if (storageType) {
      conditions.push(eq(marinaRates.storageType, storageType));
    }

    return await db.select()
      .from(marinaRates)
      .where(and(...conditions))
      .orderBy(desc(marinaRates.rateYear), desc(marinaRates.rateSeason), asc(marinaRates.storageType));
  }

  async getLatestMarinaRates(marinaId: string, orgId: string): Promise<MarinaRate[]> {
    return await db.select()
      .from(marinaRates)
      .where(and(
        eq(marinaRates.marinaId, marinaId),
        eq(marinaRates.orgId, orgId),
        eq(marinaRates.isCurrentRate, true)
      ))
      .orderBy(asc(marinaRates.storageType), asc(marinaRates.loaMin));
  }

  async bulkCreateMarinaRates(rates: InsertMarinaRate[]): Promise<MarinaRate[]> {
    if (rates.length === 0) return [];
    
    const created = await db.insert(marinaRates).values(rates as any).returning();
    
    // Update lastRateUpdate for all affected marinas
    const marinaIds = [...new Set(rates.map(r => r.marinaId))];
    for (const marinaId of marinaIds) {
      await db.update(marinaRateDatabase)
        .set({ lastRateUpdate: new Date(), updatedAt: new Date() })
        .where(eq(marinaRateDatabase.id, marinaId));
    }
    
    return created;
  }

  async markPreviousRatesHistorical(marinaId: string, storageType: string, rateYear: number, orgId: string): Promise<void> {
    await db.update(marinaRates)
      .set({ isCurrentRate: false, updatedAt: new Date() })
      .where(and(
        eq(marinaRates.marinaId, marinaId),
        eq(marinaRates.orgId, orgId),
        eq(marinaRates.storageType, storageType),
        eq(marinaRates.rateYear, rateYear),
        eq(marinaRates.isCurrentRate, true)
      ));
  }

  // Search marina database by name for import conflict detection
  async getMarinasByName(orgId: string, name: string): Promise<MarinaRateDatabase[]> {
    return await db.select()
      .from(marinaRateDatabase)
      .where(and(
        eq(marinaRateDatabase.orgId, orgId),
        sql`LOWER(${marinaRateDatabase.name}) = LOWER(${name})`
      ))
      .limit(5);
  }

  async getFuelIntegration(orgId: string): Promise<FuelIntegration | undefined> {
    const [integration] = await db.select()
      .from(fuelIntegrations)
      .where(eq(fuelIntegrations.orgId, orgId));
    return integration || undefined;
  }

  async getFuelIntegrationById(id: string): Promise<FuelIntegration | undefined> {
    const [integration] = await db.select()
      .from(fuelIntegrations)
      .where(eq(fuelIntegrations.id, id));
    return integration || undefined;
  }

  async createFuelIntegration(data: InsertFuelIntegration): Promise<FuelIntegration> {
    const [created] = await db.insert(fuelIntegrations)
      .values(data as any)
      .returning();
    return created;
  }

  async updateFuelIntegration(id: string, data: UpdateFuelIntegration): Promise<FuelIntegration | undefined> {
    const [updated] = await db.update(fuelIntegrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fuelIntegrations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteFuelIntegration(id: string): Promise<boolean> {
    const result = await db.delete(fuelIntegrations)
      .where(eq(fuelIntegrations.id, id))
      .returning();
    return result.length > 0;
  }

  async getFuelImportLogs(orgId: string, limit: number = 50): Promise<FuelImportLog[]> {
    return await db.select()
      .from(fuelImportLogs)
      .where(eq(fuelImportLogs.orgId, orgId))
      .orderBy(desc(fuelImportLogs.startedAt))
      .limit(limit);
  }

  async getFuelImportLogsByIntegration(integrationId: string, limit: number = 50): Promise<FuelImportLog[]> {
    return await db.select()
      .from(fuelImportLogs)
      .where(eq(fuelImportLogs.integrationId, integrationId))
      .orderBy(desc(fuelImportLogs.startedAt))
      .limit(limit);
  }

  async createFuelImportLog(data: InsertFuelImportLog): Promise<FuelImportLog> {
    const [created] = await db.insert(fuelImportLogs)
      .values(data as any)
      .returning();
    return created;
  }

  async updateFuelImportLog(id: string, data: Partial<InsertFuelImportLog>): Promise<FuelImportLog | undefined> {
    const [updated] = await db.update(fuelImportLogs)
      .set(data)
      .where(eq(fuelImportLogs.id, id))
      .returning();
    return updated || undefined;
  }

  // Debt Scenarios
  async getDebtScenario(id: string, orgId: string): Promise<DebtScenario | undefined> {
    const [scenario] = await db.select()
      .from(debtScenarios)
      .where(and(
        eq(debtScenarios.id, id),
        eq(debtScenarios.orgId, orgId)
      ));
    return scenario || undefined;
  }

  async getDebtScenarios(orgId: string): Promise<DebtScenario[]> {
    return await db.select()
      .from(debtScenarios)
      .where(eq(debtScenarios.orgId, orgId))
      .orderBy(desc(debtScenarios.createdAt));
  }

  async getDebtScenariosByProject(projectId: string, orgId: string): Promise<DebtScenario[]> {
    return await db.select()
      .from(debtScenarios)
      .where(and(
        eq(debtScenarios.projectId, projectId),
        eq(debtScenarios.orgId, orgId)
      ))
      .orderBy(desc(debtScenarios.createdAt));
  }

  async createDebtScenario(data: InsertDebtScenario): Promise<DebtScenario> {
    const [created] = await db.insert(debtScenarios)
      .values(data as any)
      .returning();
    return created;
  }

  async updateDebtScenario(id: string, updates: UpdateDebtScenario, orgId: string): Promise<DebtScenario | undefined> {
    const [updated] = await db.update(debtScenarios)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(debtScenarios.id, id),
        eq(debtScenarios.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteDebtScenario(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(debtScenarios)
      .where(and(
        eq(debtScenarios.id, id),
        eq(debtScenarios.orgId, orgId)
      ));
    return result.rowCount > 0;
  }

  // Modeling Regions - Organization-specific customizable regions
  async getModelingRegions(orgId: string): Promise<ModelingRegion[]> {
    return await db.select()
      .from(modelingRegions)
      .where(eq(modelingRegions.orgId, orgId))
      .orderBy(asc(modelingRegions.sortOrder), asc(modelingRegions.name));
  }

  async createModelingRegion(data: InsertModelingRegion): Promise<ModelingRegion> {
    const [created] = await db.insert(modelingRegions)
      .values(data as any)
      .returning();
    return created;
  }

  async updateModelingRegion(id: string, data: UpdateModelingRegion, orgId: string): Promise<ModelingRegion | undefined> {
    const [updated] = await db.update(modelingRegions)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(modelingRegions.id, id), eq(modelingRegions.orgId, orgId)))
      .returning();
    return updated;
  }

  async deleteModelingRegion(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(modelingRegions)
      .where(and(eq(modelingRegions.id, id), eq(modelingRegions.orgId, orgId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Modeling Projects - Valuation & Financial Modeling
  async getModelingProjects(orgId: string): Promise<ModelingProject[]> {
    return await db.select()
      .from(modelingProjects)
      .where(eq(modelingProjects.orgId, orgId))
      .orderBy(desc(modelingProjects.createdAt));
  }

  async getModelingProject(id: string, orgId: string): Promise<ModelingProject | undefined> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, id),
        eq(modelingProjects.orgId, orgId)
      ));
    return project || undefined;
  }

  async getModelingProjectsByBroker(brokerId: string, orgId: string): Promise<ModelingProject[]> {
    return await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.brokerId, brokerId),
        eq(modelingProjects.orgId, orgId)
      ))
      .orderBy(desc(modelingProjects.createdAt));
  }

  async createModelingProject(data: InsertModelingProject): Promise<ModelingProject> {
    const [created] = await db.insert(modelingProjects)
      .values(data as any)
      .returning();
    return created;
  }

  async updateModelingProject(id: string, data: UpdateModelingProject, orgId: string): Promise<ModelingProject | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(modelingProjects)
      .set(updateData as any)
      .where(and(
        eq(modelingProjects.id, id),
        eq(modelingProjects.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteModelingProject(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(modelingProjects)
      .where(and(
        eq(modelingProjects.id, id),
        eq(modelingProjects.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  async getModelingAnalytics(orgId: string, filters?: {
    region?: string;
    state?: string;
    dealOutcome?: string;
    brokerId?: string;
    minPrice?: number;
    maxPrice?: number;
    minSize?: number;
    maxSize?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalDeals: number;
    totalPurchasePrice: number;
    avgCapRate: number;
    avgEbitda: number;
    successRate: number;
    avgPricePerUnit: number;
    totalUnits: number;
    activeDealsValue: number;
    activeDealsCount: number;
    closedDealsThisMonth: number;
    dealVelocity: number;
    dealsByOutcome: Array<{ outcome: string; count: number }>;
    dealsByBroker: Array<{ brokerId: string; brokerName: string; count: number; totalValue: number; wonCount: number; lostCount: number; passedCount: number; winRate: number; avgDealSize: number }>;
    dealsByRegion: Array<{ region: string; count: number; totalValue: number }>;
    dealsByState: Array<{ state: string; count: number; totalValue: number }>;
    dealsByMonth: Array<{ month: string; count: number; totalValue: number }>;
    capRateDistribution: Array<{ range: string; count: number }>;
    priceDistribution: Array<{ range: string; count: number }>;
  }> {
    // Build WHERE conditions based on filters
    const conditions = [eq(modelingProjects.orgId, orgId)];
    
    if (filters?.region) {
      conditions.push(eq(modelingProjects.region, filters.region));
    }
    if (filters?.state) {
      conditions.push(eq(modelingProjects.state, filters.state));
    }
    if (filters?.dealOutcome) {
      conditions.push(eq(modelingProjects.dealOutcome, filters.dealOutcome));
    }
    if (filters?.brokerId) {
      conditions.push(eq(modelingProjects.brokerId, filters.brokerId));
    }
    if (filters?.minPrice) {
      conditions.push(sql`${modelingProjects.purchasePrice} >= ${filters.minPrice}`);
    }
    if (filters?.maxPrice) {
      conditions.push(sql`${modelingProjects.purchasePrice} <= ${filters.maxPrice}`);
    }
    if (filters?.minSize) {
      conditions.push(sql`${modelingProjects.totalStorageUnits} >= ${filters.minSize}`);
    }
    if (filters?.maxSize) {
      conditions.push(sql`${modelingProjects.totalStorageUnits} <= ${filters.maxSize}`);
    }
    if (filters?.startDate) {
      conditions.push(sql`${modelingProjects.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${modelingProjects.createdAt} <= ${filters.endDate}`);
    }

    // Get all projects matching filters
    const projects = await db.select()
      .from(modelingProjects)
      .where(and(...conditions));

    // Calculate aggregate metrics
    const totalDeals = projects.length;
    const totalPurchasePrice = projects.reduce((sum, p) => sum + (Number(p.purchasePrice) || 0), 0);
    const avgCapRate = projects.length > 0
      ? projects.reduce((sum, p) => sum + (Number(p.year1CapRate) || 0), 0) / projects.length
      : 0;
    const avgEbitda = projects.length > 0
      ? projects.reduce((sum, p) => sum + (Number(p.ebitda) || 0), 0) / projects.length
      : 0;
    
    // Success rate calculation: won / (won + lost + passed) - only counts closed deals
    const wonDeals = projects.filter(p => p.dealOutcome === 'won').length;
    const lostDeals = projects.filter(p => p.dealOutcome === 'lost').length;
    const passedDeals = projects.filter(p => p.dealOutcome === 'passed').length;
    const closedDeals = wonDeals + lostDeals + passedDeals;
    const successRate = closedDeals > 0 ? (wonDeals / closedDeals) * 100 : 0;

    // Group by outcome
    const outcomeMap = new Map<string, number>();
    projects.forEach(p => {
      const count = outcomeMap.get(p.dealOutcome) || 0;
      outcomeMap.set(p.dealOutcome, count + 1);
    });
    const dealsByOutcome = Array.from(outcomeMap.entries()).map(([outcome, count]) => ({
      outcome,
      count
    }));

    // Group by broker (with broker name lookup and performance metrics)
    const brokerMap = new Map<string, { count: number; totalValue: number; name: string; wonCount: number; lostCount: number; passedCount: number }>();
    for (const project of projects) {
      if (project.brokerId) {
        const existing = brokerMap.get(project.brokerId) || { count: 0, totalValue: 0, name: '', wonCount: 0, lostCount: 0, passedCount: 0 };
        existing.count += 1;
        existing.totalValue += Number(project.purchasePrice) || 0;
        
        // Track outcomes
        if (project.dealOutcome === 'won') existing.wonCount += 1;
        if (project.dealOutcome === 'lost') existing.lostCount += 1;
        if (project.dealOutcome === 'passed') existing.passedCount += 1;
        
        // Get broker name if not already fetched
        if (!existing.name) {
          const broker = await this.getCrmContact(project.brokerId, orgId);
          existing.name = broker ? `${broker.firstName} ${broker.lastName}` : 'Unknown';
        }
        
        brokerMap.set(project.brokerId, existing);
      }
    }
    const dealsByBroker = Array.from(brokerMap.entries()).map(([brokerId, data]) => {
      const closedBrokerDeals = data.wonCount + data.lostCount + data.passedCount;
      const winRate = closedBrokerDeals > 0 ? (data.wonCount / closedBrokerDeals) * 100 : 0;
      const avgDealSize = data.count > 0 ? data.totalValue / data.count : 0;
      
      return {
        brokerId,
        brokerName: data.name,
        count: data.count,
        totalValue: data.totalValue,
        wonCount: data.wonCount,
        lostCount: data.lostCount,
        passedCount: data.passedCount,
        winRate,
        avgDealSize
      };
    });

    // Group by region
    const regionMap = new Map<string, { count: number; totalValue: number }>();
    projects.forEach(p => {
      if (p.region) {
        const existing = regionMap.get(p.region) || { count: 0, totalValue: 0 };
        existing.count += 1;
        existing.totalValue += Number(p.purchasePrice) || 0;
        regionMap.set(p.region, existing);
      }
    });
    const dealsByRegion = Array.from(regionMap.entries()).map(([region, data]) => ({
      region,
      count: data.count,
      totalValue: data.totalValue
    }));

    // Group by state
    const stateMap = new Map<string, { count: number; totalValue: number }>();
    projects.forEach(p => {
      if (p.state) {
        const existing = stateMap.get(p.state) || { count: 0, totalValue: 0 };
        existing.count += 1;
        existing.totalValue += Number(p.purchasePrice) || 0;
        stateMap.set(p.state, existing);
      }
    });
    const dealsByState = Array.from(stateMap.entries()).map(([state, data]) => ({
      state,
      count: data.count,
      totalValue: data.totalValue
    }));

    // Group by month (based on createdAt)
    const monthMap = new Map<string, { count: number; totalValue: number }>();
    projects.forEach(p => {
      const date = new Date(p.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(monthKey) || { count: 0, totalValue: 0 };
      existing.count += 1;
      existing.totalValue += Number(p.purchasePrice) || 0;
      monthMap.set(monthKey, existing);
    });
    const dealsByMonth = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        count: data.count,
        totalValue: data.totalValue
      }));

    // Cap rate distribution
    const capRateRanges = [
      { min: 0, max: 5, label: '0-5%' },
      { min: 5, max: 7, label: '5-7%' },
      { min: 7, max: 9, label: '7-9%' },
      { min: 9, max: 11, label: '9-11%' },
      { min: 11, max: 100, label: '11%+' }
    ];
    const capRateDistribution = capRateRanges.map(range => ({
      range: range.label,
      count: projects.filter(p => {
        const capRate = Number(p.year1CapRate) || 0;
        return capRate >= range.min && capRate < range.max;
      }).length
    })).filter(item => item.count > 0);

    // Price distribution (in millions)
    const priceRanges = [
      { min: 0, max: 1000000, label: 'Under $1M' },
      { min: 1000000, max: 5000000, label: '$1M-$5M' },
      { min: 5000000, max: 10000000, label: '$5M-$10M' },
      { min: 10000000, max: 20000000, label: '$10M-$20M' },
      { min: 20000000, max: 1000000000, label: '$20M+' }
    ];
    const priceDistribution = priceRanges.map(range => ({
      range: range.label,
      count: projects.filter(p => {
        const price = Number(p.purchasePrice) || 0;
        return price >= range.min && price < range.max;
      }).length
    })).filter(item => item.count > 0);

    // Additional metrics
    const totalUnits = projects.reduce((sum, p) => sum + (Number(p.totalStorageUnits) || 0), 0);
    const avgPricePerUnit = totalUnits > 0 ? totalPurchasePrice / totalUnits : 0;
    
    const activeProjects = projects.filter(p => p.dealOutcome === 'active');
    const activeDealsCount = activeProjects.length;
    const activeDealsValue = activeProjects.reduce((sum, p) => sum + (Number(p.purchasePrice) || 0), 0);

    // Closed deals this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const closedDealsThisMonth = projects.filter(p => {
      const createdDate = new Date(p.createdAt);
      return (p.dealOutcome === 'won' || p.dealOutcome === 'lost' || p.dealOutcome === 'passed') &&
        createdDate >= firstDayOfMonth;
    }).length;

    // Deal velocity (avg deals closed per month over last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentClosedDeals = projects.filter(p => {
      const createdDate = new Date(p.createdAt);
      return (p.dealOutcome === 'won' || p.dealOutcome === 'lost' || p.dealOutcome === 'passed') &&
        createdDate >= sixMonthsAgo;
    }).length;
    const dealVelocity = recentClosedDeals / 6;

    return {
      totalDeals,
      totalPurchasePrice,
      avgCapRate,
      avgEbitda,
      successRate,
      avgPricePerUnit,
      totalUnits,
      activeDealsValue,
      activeDealsCount,
      closedDealsThisMonth,
      dealVelocity,
      dealsByOutcome,
      dealsByBroker,
      dealsByRegion,
      dealsByState,
      dealsByMonth,
      capRateDistribution,
      priceDistribution
    };
  }

  // ============================================================================
  // MODELING FINANCIAL PERIODS - Year-based financial summaries
  // ============================================================================

  async getModelingFinancialPeriods(modelingProjectId: string, orgId: string): Promise<ModelingFinancialPeriod[]> {
    return await db.select()
      .from(modelingFinancialPeriods)
      .where(and(
        eq(modelingFinancialPeriods.modelingProjectId, modelingProjectId),
        eq(modelingFinancialPeriods.orgId, orgId)
      ))
      .orderBy(asc(modelingFinancialPeriods.sortOrder));
  }

  async getModelingFinancialPeriod(id: string, orgId: string): Promise<ModelingFinancialPeriod | undefined> {
    const [period] = await db.select()
      .from(modelingFinancialPeriods)
      .where(and(
        eq(modelingFinancialPeriods.id, id),
        eq(modelingFinancialPeriods.orgId, orgId)
      ));
    return period || undefined;
  }

  async getModelingFinancialPeriodByLabel(modelingProjectId: string, periodLabel: string, orgId: string): Promise<ModelingFinancialPeriod | undefined> {
    const [period] = await db.select()
      .from(modelingFinancialPeriods)
      .where(and(
        eq(modelingFinancialPeriods.modelingProjectId, modelingProjectId),
        eq(modelingFinancialPeriods.periodLabel, periodLabel),
        eq(modelingFinancialPeriods.orgId, orgId)
      ));
    return period || undefined;
  }

  async createModelingFinancialPeriod(data: InsertModelingFinancialPeriod): Promise<ModelingFinancialPeriod> {
    const [created] = await db.insert(modelingFinancialPeriods)
      .values(data as any)
      .returning();
    return created;
  }

  async updateModelingFinancialPeriod(id: string, data: UpdateModelingFinancialPeriod, orgId: string): Promise<ModelingFinancialPeriod | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(modelingFinancialPeriods)
      .set(updateData as any)
      .where(and(
        eq(modelingFinancialPeriods.id, id),
        eq(modelingFinancialPeriods.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteModelingFinancialPeriod(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(modelingFinancialPeriods)
      .where(and(
        eq(modelingFinancialPeriods.id, id),
        eq(modelingFinancialPeriods.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  async getAvailableFinancialPeriods(modelingProjectId: string, orgId: string): Promise<Array<{ periodType: string; periodLabel: string; periodYear: number | null }>> {
    const periods = await db.select({
      periodType: modelingFinancialPeriods.periodType,
      periodLabel: modelingFinancialPeriods.periodLabel,
      periodYear: modelingFinancialPeriods.periodYear
    })
      .from(modelingFinancialPeriods)
      .where(and(
        eq(modelingFinancialPeriods.modelingProjectId, modelingProjectId),
        eq(modelingFinancialPeriods.orgId, orgId)
      ))
      .orderBy(asc(modelingFinancialPeriods.sortOrder));
    
    return periods;
  }

  // ============================================================================
  // MODELING PERIOD ADJUSTMENTS - Normalization adjustments for financial periods
  // ============================================================================

  async getModelingPeriodAdjustments(modelingProjectId: string, orgId: string, periodLabel?: string): Promise<ModelingPeriodAdjustment[]> {
    const conditions = [
      eq(modelingPeriodAdjustments.modelingProjectId, modelingProjectId),
      eq(modelingPeriodAdjustments.orgId, orgId)
    ];
    
    if (periodLabel) {
      conditions.push(eq(modelingPeriodAdjustments.periodLabel, periodLabel));
    }
    
    return await db.select()
      .from(modelingPeriodAdjustments)
      .where(and(...conditions))
      .orderBy(desc(modelingPeriodAdjustments.createdAt));
  }

  async getActiveAdjustmentsForPeriod(modelingProjectId: string, periodLabel: string, orgId: string): Promise<ModelingPeriodAdjustment[]> {
    return await db.select()
      .from(modelingPeriodAdjustments)
      .where(and(
        eq(modelingPeriodAdjustments.modelingProjectId, modelingProjectId),
        eq(modelingPeriodAdjustments.periodLabel, periodLabel),
        eq(modelingPeriodAdjustments.orgId, orgId),
        eq(modelingPeriodAdjustments.isActive, true)
      ))
      .orderBy(modelingPeriodAdjustments.scope, modelingPeriodAdjustments.targetLabel);
  }

  async getModelingPeriodAdjustment(id: string, orgId: string): Promise<ModelingPeriodAdjustment | undefined> {
    const [adjustment] = await db.select()
      .from(modelingPeriodAdjustments)
      .where(and(
        eq(modelingPeriodAdjustments.id, id),
        eq(modelingPeriodAdjustments.orgId, orgId)
      ));
    return adjustment || undefined;
  }

  async createModelingPeriodAdjustment(data: InsertModelingPeriodAdjustment): Promise<ModelingPeriodAdjustment> {
    const [created] = await db.insert(modelingPeriodAdjustments)
      .values(data as any)
      .returning();
    return created;
  }

  async updateModelingPeriodAdjustment(id: string, data: UpdateModelingPeriodAdjustment, orgId: string): Promise<ModelingPeriodAdjustment | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(modelingPeriodAdjustments)
      .set(updateData as any)
      .where(and(
        eq(modelingPeriodAdjustments.id, id),
        eq(modelingPeriodAdjustments.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteModelingPeriodAdjustment(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(modelingPeriodAdjustments)
      .where(and(
        eq(modelingPeriodAdjustments.id, id),
        eq(modelingPeriodAdjustments.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  async toggleAdjustmentActive(id: string, isActive: boolean, orgId: string): Promise<ModelingPeriodAdjustment | undefined> {
    return this.updateModelingPeriodAdjustment(id, { isActive } as UpdateModelingPeriodAdjustment, orgId);
  }

  async getProjectPeriodAdjustmentsByScope(projectId: string, periodLabel: string, scope: string): Promise<ModelingPeriodAdjustment[]> {
    return db.select()
      .from(modelingPeriodAdjustments)
      .where(and(
        eq(modelingPeriodAdjustments.modelingProjectId, projectId),
        eq(modelingPeriodAdjustments.periodLabel, periodLabel),
        eq(modelingPeriodAdjustments.scope, scope as any),
        eq(modelingPeriodAdjustments.isActive, true)
      ))
      .orderBy(modelingPeriodAdjustments.targetLabel);
  }

  async getActiveAdjustmentsForPeriod(projectId: string, periodLabel: string, orgId: string): Promise<ModelingPeriodAdjustment[]> {
    return db.select()
      .from(modelingPeriodAdjustments)
      .where(and(
        eq(modelingPeriodAdjustments.modelingProjectId, projectId),
        eq(modelingPeriodAdjustments.periodLabel, periodLabel),
        eq(modelingPeriodAdjustments.orgId, orgId),
        eq(modelingPeriodAdjustments.isActive, true)
      ))
      .orderBy(modelingPeriodAdjustments.scope);
  }

  // ============================================================================
  // MODELING ANALYTICS - Aggregations for drill-down analytics
  // ============================================================================

  async getActualsAggregationByCategory(modelingProjectId: string, orgId: string): Promise<{
    category: string;
    totalAmount: number;
    avgMonthlyAmount: number;
    minMonthlyAmount: number;
    maxMonthlyAmount: number;
    monthCount: number;
    subcategories: string[];
  }[]> {
    const actuals = await db.select()
      .from(modelingActuals)
      .where(and(
        eq(modelingActuals.modelingProjectId, modelingProjectId),
        eq(modelingActuals.orgId, orgId)
      ));

    const categoryMap = new Map<string, {
      totalAmount: number;
      monthlyAmounts: number[];
      subcategories: Set<string>;
    }>();

    for (const actual of actuals) {
      const key = actual.category;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          totalAmount: 0,
          monthlyAmounts: [],
          subcategories: new Set()
        });
      }
      const cat = categoryMap.get(key)!;
      const amount = Number(actual.amount) || 0;
      cat.totalAmount += amount;
      cat.monthlyAmounts.push(amount);
      cat.subcategories.add(actual.subcategory);
    }

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      totalAmount: data.totalAmount,
      avgMonthlyAmount: data.monthlyAmounts.length > 0 ? data.totalAmount / data.monthlyAmounts.length : 0,
      minMonthlyAmount: data.monthlyAmounts.length > 0 ? Math.min(...data.monthlyAmounts) : 0,
      maxMonthlyAmount: data.monthlyAmounts.length > 0 ? Math.max(...data.monthlyAmounts) : 0,
      monthCount: data.monthlyAmounts.length,
      subcategories: Array.from(data.subcategories)
    }));
  }

  async getActualsAggregationBySubcategory(modelingProjectId: string, category: string, orgId: string): Promise<{
    subcategory: string;
    totalAmount: number;
    avgMonthlyAmount: number;
    minMonthlyAmount: number;
    maxMonthlyAmount: number;
    monthCount: number;
    lineItems: string[];
    yearlyTotals: { year: number; total: number }[];
  }[]> {
    const actuals = await db.select()
      .from(modelingActuals)
      .where(and(
        eq(modelingActuals.modelingProjectId, modelingProjectId),
        eq(modelingActuals.category, category),
        eq(modelingActuals.orgId, orgId)
      ));

    const subcategoryMap = new Map<string, {
      totalAmount: number;
      monthlyAmounts: number[];
      lineItems: Set<string>;
      yearlyTotals: Map<number, number>;
    }>();

    for (const actual of actuals) {
      const key = actual.subcategory;
      if (!subcategoryMap.has(key)) {
        subcategoryMap.set(key, {
          totalAmount: 0,
          monthlyAmounts: [],
          lineItems: new Set(),
          yearlyTotals: new Map()
        });
      }
      const sub = subcategoryMap.get(key)!;
      const amount = Number(actual.amount) || 0;
      sub.totalAmount += amount;
      sub.monthlyAmounts.push(amount);
      if (actual.lineItemDescription) {
        sub.lineItems.add(actual.lineItemDescription);
      }
      const yearTotal = sub.yearlyTotals.get(actual.year) || 0;
      sub.yearlyTotals.set(actual.year, yearTotal + amount);
    }

    return Array.from(subcategoryMap.entries()).map(([subcategory, data]) => ({
      subcategory,
      totalAmount: data.totalAmount,
      avgMonthlyAmount: data.monthlyAmounts.length > 0 ? data.totalAmount / data.monthlyAmounts.length : 0,
      minMonthlyAmount: data.monthlyAmounts.length > 0 ? Math.min(...data.monthlyAmounts) : 0,
      maxMonthlyAmount: data.monthlyAmounts.length > 0 ? Math.max(...data.monthlyAmounts) : 0,
      monthCount: data.monthlyAmounts.length,
      lineItems: Array.from(data.lineItems),
      yearlyTotals: Array.from(data.yearlyTotals.entries())
        .map(([year, total]) => ({ year, total }))
        .sort((a, b) => a.year - b.year)
    }));
  }

  async getActualsAggregationByLineItem(modelingProjectId: string, category: string, subcategory: string, orgId: string): Promise<{
    lineItem: string;
    totalAmount: number;
    avgMonthlyAmount: number;
    minMonthlyAmount: number;
    maxMonthlyAmount: number;
    monthCount: number;
    monthlyData: { year: number; month: number; amount: number }[];
    trend: 'increasing' | 'decreasing' | 'stable';
  }[]> {
    const actuals = await db.select()
      .from(modelingActuals)
      .where(and(
        eq(modelingActuals.modelingProjectId, modelingProjectId),
        eq(modelingActuals.category, category),
        eq(modelingActuals.subcategory, subcategory),
        eq(modelingActuals.orgId, orgId)
      ))
      .orderBy(modelingActuals.year, modelingActuals.month);

    const lineItemMap = new Map<string, {
      totalAmount: number;
      monthlyAmounts: number[];
      monthlyData: { year: number; month: number; amount: number }[];
    }>();

    for (const actual of actuals) {
      const key = actual.lineItemDescription || subcategory;
      if (!lineItemMap.has(key)) {
        lineItemMap.set(key, {
          totalAmount: 0,
          monthlyAmounts: [],
          monthlyData: []
        });
      }
      const item = lineItemMap.get(key)!;
      const amount = Number(actual.amount) || 0;
      item.totalAmount += amount;
      item.monthlyAmounts.push(amount);
      item.monthlyData.push({ year: actual.year, month: actual.month, amount });
    }

    return Array.from(lineItemMap.entries()).map(([lineItem, data]) => {
      // Calculate trend based on first half vs second half averages
      const midpoint = Math.floor(data.monthlyAmounts.length / 2);
      const firstHalf = data.monthlyAmounts.slice(0, midpoint);
      const secondHalf = data.monthlyAmounts.slice(midpoint);
      const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
      const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (secondAvg > firstAvg * 1.1) trend = 'increasing';
      else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';

      return {
        lineItem,
        totalAmount: data.totalAmount,
        avgMonthlyAmount: data.monthlyAmounts.length > 0 ? data.totalAmount / data.monthlyAmounts.length : 0,
        minMonthlyAmount: data.monthlyAmounts.length > 0 ? Math.min(...data.monthlyAmounts) : 0,
        maxMonthlyAmount: data.monthlyAmounts.length > 0 ? Math.max(...data.monthlyAmounts) : 0,
        monthCount: data.monthlyAmounts.length,
        monthlyData: data.monthlyData,
        trend
      };
    });
  }

  async getFinancialSummaryWithAdjustments(
    modelingProjectId: string,
    periodLabel: string,
    orgId: string,
    applyAdjustments: boolean = true
  ): Promise<{
    rawTotals: { revenue: number; cogs: number; expenses: number; noi: number };
    adjustedTotals: { revenue: number; cogs: number; expenses: number; noi: number };
    adjustments: ModelingPeriodAdjustment[];
    adjustmentImpact: { revenue: number; cogs: number; expenses: number; noi: number };
  }> {
    // Get raw actuals data
    const actuals = await db.select()
      .from(modelingActuals)
      .where(and(
        eq(modelingActuals.modelingProjectId, modelingProjectId),
        eq(modelingActuals.orgId, orgId)
      ));

    // Calculate raw totals
    let rawRevenue = 0, rawCogs = 0, rawExpenses = 0;
    for (const actual of actuals) {
      const amount = Number(actual.amount) || 0;
      if (actual.category.toLowerCase() === 'revenue') rawRevenue += amount;
      else if (actual.category.toLowerCase() === 'cogs') rawCogs += amount;
      else if (actual.category.toLowerCase() === 'expense' || actual.category.toLowerCase() === 'expenses') rawExpenses += amount;
    }
    const rawNoi = rawRevenue - rawCogs - rawExpenses;

    // Get active adjustments for this period
    const adjustments = applyAdjustments 
      ? await this.getActiveAdjustmentsForPeriod(modelingProjectId, periodLabel, orgId)
      : [];

    // Apply adjustments
    let revenueAdjustment = 0, cogsAdjustment = 0, expenseAdjustment = 0;
    
    for (const adj of adjustments) {
      const [category] = adj.targetIdentifier.split('|');
      let adjustmentAmount = 0;
      
      // Calculate the adjustment amount based on type
      const originalValue = Number(adj.originalValue) || 0;
      const adjValue = Number(adj.adjustmentValue) || 0;
      
      switch (adj.adjustmentType) {
        case 'absolute':
          adjustmentAmount = adjValue;
          break;
        case 'percentage':
          adjustmentAmount = originalValue * (adjValue / 100);
          break;
        case 'replace':
          adjustmentAmount = adjValue - originalValue;
          break;
      }
      
      // Apply to appropriate category
      if (category.toLowerCase() === 'revenue') revenueAdjustment += adjustmentAmount;
      else if (category.toLowerCase() === 'cogs') cogsAdjustment += adjustmentAmount;
      else if (category.toLowerCase() === 'expense' || category.toLowerCase() === 'expenses') expenseAdjustment += adjustmentAmount;
    }

    const adjustedRevenue = rawRevenue + revenueAdjustment;
    const adjustedCogs = rawCogs + cogsAdjustment;
    const adjustedExpenses = rawExpenses + expenseAdjustment;
    const adjustedNoi = adjustedRevenue - adjustedCogs - adjustedExpenses;

    return {
      rawTotals: {
        revenue: rawRevenue,
        cogs: rawCogs,
        expenses: rawExpenses,
        noi: rawNoi
      },
      adjustedTotals: {
        revenue: adjustedRevenue,
        cogs: adjustedCogs,
        expenses: adjustedExpenses,
        noi: adjustedNoi
      },
      adjustments,
      adjustmentImpact: {
        revenue: revenueAdjustment,
        cogs: cogsAdjustment,
        expenses: expenseAdjustment,
        noi: revenueAdjustment - cogsAdjustment - expenseAdjustment
      }
    };
  }

  // ============================================================================
  // EXIT STRATEGY SUITE - Implementation Methods
  // ============================================================================

  // Exit Scenarios
  async getExitScenarios(modelingProjectId: string, orgId: string): Promise<ExitScenario[]> {
    return await db.select()
      .from(exitScenarios)
      .where(and(
        eq(exitScenarios.modelingProjectId, modelingProjectId),
        eq(exitScenarios.orgId, orgId)
      ))
      .orderBy(desc(exitScenarios.createdAt));
  }

  async getExitScenario(id: string, orgId: string): Promise<ExitScenario | undefined> {
    const [scenario] = await db.select()
      .from(exitScenarios)
      .where(and(
        eq(exitScenarios.id, id),
        eq(exitScenarios.orgId, orgId)
      ));
    return scenario || undefined;
  }

  async createExitScenario(data: InsertExitScenario & { orgId: string; createdBy?: string }): Promise<ExitScenario> {
    const [created] = await db.insert(exitScenarios)
      .values(data as any)
      .returning();
    return created;
  }

  async updateExitScenario(id: string, data: UpdateExitScenario & { updatedBy?: string }, orgId: string): Promise<ExitScenario | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(exitScenarios)
      .set(updateData as any)
      .where(and(
        eq(exitScenarios.id, id),
        eq(exitScenarios.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteExitScenario(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exitScenarios)
      .where(and(
        eq(exitScenarios.id, id),
        eq(exitScenarios.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Tax Calculations
  async getExitTaxCalculations(exitScenarioId: string, orgId: string): Promise<ExitTaxCalculation[]> {
    return await db.select()
      .from(exitTaxCalculations)
      .where(and(
        eq(exitTaxCalculations.exitScenarioId, exitScenarioId),
        eq(exitTaxCalculations.orgId, orgId)
      ))
      .orderBy(desc(exitTaxCalculations.createdAt));
  }

  async getExitTaxCalculation(id: string, orgId: string): Promise<ExitTaxCalculation | undefined> {
    const [calc] = await db.select()
      .from(exitTaxCalculations)
      .where(and(
        eq(exitTaxCalculations.id, id),
        eq(exitTaxCalculations.orgId, orgId)
      ));
    return calc || undefined;
  }

  async createExitTaxCalculation(data: InsertExitTaxCalculation & { orgId: string }): Promise<ExitTaxCalculation> {
    const [created] = await db.insert(exitTaxCalculations)
      .values(data as any)
      .returning();
    return created;
  }

  async updateExitTaxCalculation(id: string, data: UpdateExitTaxCalculation, orgId: string): Promise<ExitTaxCalculation | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(exitTaxCalculations)
      .set(updateData as any)
      .where(and(
        eq(exitTaxCalculations.id, id),
        eq(exitTaxCalculations.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteExitTaxCalculation(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exitTaxCalculations)
      .where(and(
        eq(exitTaxCalculations.id, id),
        eq(exitTaxCalculations.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Seller Financing
  async getExitSellerFinancing(exitScenarioId: string, orgId: string): Promise<ExitSellerFinancing[]> {
    return await db.select()
      .from(exitSellerFinancing)
      .where(and(
        eq(exitSellerFinancing.exitScenarioId, exitScenarioId),
        eq(exitSellerFinancing.orgId, orgId)
      ))
      .orderBy(desc(exitSellerFinancing.createdAt));
  }

  async getExitSellerFinancingById(id: string, orgId: string): Promise<ExitSellerFinancing | undefined> {
    const [sf] = await db.select()
      .from(exitSellerFinancing)
      .where(and(
        eq(exitSellerFinancing.id, id),
        eq(exitSellerFinancing.orgId, orgId)
      ));
    return sf || undefined;
  }

  async createExitSellerFinancing(data: InsertExitSellerFinancing & { orgId: string }): Promise<ExitSellerFinancing> {
    const [created] = await db.insert(exitSellerFinancing)
      .values(data as any)
      .returning();
    return created;
  }

  async updateExitSellerFinancing(id: string, data: UpdateExitSellerFinancing, orgId: string): Promise<ExitSellerFinancing | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(exitSellerFinancing)
      .set(updateData as any)
      .where(and(
        eq(exitSellerFinancing.id, id),
        eq(exitSellerFinancing.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteExitSellerFinancing(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exitSellerFinancing)
      .where(and(
        eq(exitSellerFinancing.id, id),
        eq(exitSellerFinancing.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Earnouts
  async getExitEarnouts(exitScenarioId: string, orgId: string): Promise<ExitEarnout[]> {
    return await db.select()
      .from(exitEarnouts)
      .where(and(
        eq(exitEarnouts.exitScenarioId, exitScenarioId),
        eq(exitEarnouts.orgId, orgId)
      ))
      .orderBy(asc(exitEarnouts.sortOrder));
  }

  async getExitEarnout(id: string, orgId: string): Promise<ExitEarnout | undefined> {
    const [earnout] = await db.select()
      .from(exitEarnouts)
      .where(and(
        eq(exitEarnouts.id, id),
        eq(exitEarnouts.orgId, orgId)
      ));
    return earnout || undefined;
  }

  async createExitEarnout(data: InsertExitEarnout & { orgId: string }): Promise<ExitEarnout> {
    const [created] = await db.insert(exitEarnouts)
      .values(data as any)
      .returning();
    return created;
  }

  async updateExitEarnout(id: string, data: UpdateExitEarnout, orgId: string): Promise<ExitEarnout | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(exitEarnouts)
      .set(updateData as any)
      .where(and(
        eq(exitEarnouts.id, id),
        eq(exitEarnouts.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteExitEarnout(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exitEarnouts)
      .where(and(
        eq(exitEarnouts.id, id),
        eq(exitEarnouts.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // 1031 Exchanges
  async getExit1031Exchanges(exitScenarioId: string, orgId: string): Promise<Exit1031Exchange[]> {
    return await db.select()
      .from(exit1031Exchanges)
      .where(and(
        eq(exit1031Exchanges.exitScenarioId, exitScenarioId),
        eq(exit1031Exchanges.orgId, orgId)
      ))
      .orderBy(desc(exit1031Exchanges.createdAt));
  }

  async getExit1031Exchange(id: string, orgId: string): Promise<Exit1031Exchange | undefined> {
    const [exchange] = await db.select()
      .from(exit1031Exchanges)
      .where(and(
        eq(exit1031Exchanges.id, id),
        eq(exit1031Exchanges.orgId, orgId)
      ));
    return exchange || undefined;
  }

  async createExit1031Exchange(data: InsertExit1031Exchange & { orgId: string }): Promise<Exit1031Exchange> {
    const [created] = await db.insert(exit1031Exchanges)
      .values(data as any)
      .returning();
    return created;
  }

  async updateExit1031Exchange(id: string, data: UpdateExit1031Exchange, orgId: string): Promise<Exit1031Exchange | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(exit1031Exchanges)
      .set(updateData as any)
      .where(and(
        eq(exit1031Exchanges.id, id),
        eq(exit1031Exchanges.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteExit1031Exchange(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exit1031Exchanges)
      .where(and(
        eq(exit1031Exchanges.id, id),
        eq(exit1031Exchanges.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // DST Analyses
  async getExitDstAnalyses(exitScenarioId: string, orgId: string): Promise<ExitDstAnalysis[]> {
    return await db.select()
      .from(exitDstAnalyses)
      .where(and(
        eq(exitDstAnalyses.exitScenarioId, exitScenarioId),
        eq(exitDstAnalyses.orgId, orgId)
      ))
      .orderBy(asc(exitDstAnalyses.sortOrder));
  }

  async getExitDstAnalysis(id: string, orgId: string): Promise<ExitDstAnalysis | undefined> {
    const [dst] = await db.select()
      .from(exitDstAnalyses)
      .where(and(
        eq(exitDstAnalyses.id, id),
        eq(exitDstAnalyses.orgId, orgId)
      ));
    return dst || undefined;
  }

  async createExitDstAnalysis(data: InsertExitDstAnalysis & { orgId: string }): Promise<ExitDstAnalysis> {
    const [created] = await db.insert(exitDstAnalyses)
      .values(data as any)
      .returning();
    return created;
  }

  async updateExitDstAnalysis(id: string, data: UpdateExitDstAnalysis, orgId: string): Promise<ExitDstAnalysis | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(exitDstAnalyses)
      .set(updateData as any)
      .where(and(
        eq(exitDstAnalyses.id, id),
        eq(exitDstAnalyses.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteExitDstAnalysis(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exitDstAnalyses)
      .where(and(
        eq(exitDstAnalyses.id, id),
        eq(exitDstAnalyses.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Funds
  async getExitFunds(orgId: string): Promise<ExitFund[]> {
    return await db.select()
      .from(exitFunds)
      .where(eq(exitFunds.orgId, orgId))
      .orderBy(desc(exitFunds.vintage));
  }

  async getExitFund(id: string, orgId: string): Promise<ExitFund | undefined> {
    const [fund] = await db.select()
      .from(exitFunds)
      .where(and(
        eq(exitFunds.id, id),
        eq(exitFunds.orgId, orgId)
      ));
    return fund || undefined;
  }

  async createExitFund(data: InsertExitFund & { orgId: string }): Promise<ExitFund> {
    const [created] = await db.insert(exitFunds)
      .values(data as any)
      .returning();
    return created;
  }

  async updateExitFund(id: string, data: UpdateExitFund, orgId: string): Promise<ExitFund | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(exitFunds)
      .set(updateData as any)
      .where(and(
        eq(exitFunds.id, id),
        eq(exitFunds.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteExitFund(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exitFunds)
      .where(and(
        eq(exitFunds.id, id),
        eq(exitFunds.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Waterfall Structures
  async getExitWaterfallStructures(exitScenarioId: string, orgId: string): Promise<ExitWaterfallStructure[]> {
    return await db.select()
      .from(exitWaterfallStructures)
      .where(and(
        eq(exitWaterfallStructures.exitScenarioId, exitScenarioId),
        eq(exitWaterfallStructures.orgId, orgId)
      ))
      .orderBy(desc(exitWaterfallStructures.createdAt));
  }

  async getExitWaterfallStructure(id: string, orgId: string): Promise<ExitWaterfallStructure | undefined> {
    const [waterfall] = await db.select()
      .from(exitWaterfallStructures)
      .where(and(
        eq(exitWaterfallStructures.id, id),
        eq(exitWaterfallStructures.orgId, orgId)
      ));
    return waterfall || undefined;
  }

  async createExitWaterfallStructure(data: InsertExitWaterfallStructure & { orgId: string }): Promise<ExitWaterfallStructure> {
    const [created] = await db.insert(exitWaterfallStructures)
      .values(data as any)
      .returning();
    return created;
  }

  async updateExitWaterfallStructure(id: string, data: UpdateExitWaterfallStructure, orgId: string): Promise<ExitWaterfallStructure | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(exitWaterfallStructures)
      .set(updateData as any)
      .where(and(
        eq(exitWaterfallStructures.id, id),
        eq(exitWaterfallStructures.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteExitWaterfallStructure(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exitWaterfallStructures)
      .where(and(
        eq(exitWaterfallStructures.id, id),
        eq(exitWaterfallStructures.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Investors
  async getExitInvestors(fundId: string, orgId: string): Promise<ExitInvestor[]> {
    return await db.select()
      .from(exitInvestors)
      .where(and(
        eq(exitInvestors.fundId, fundId),
        eq(exitInvestors.orgId, orgId)
      ))
      .orderBy(asc(exitInvestors.name));
  }

  async getExitInvestor(id: string, orgId: string): Promise<ExitInvestor | undefined> {
    const [investor] = await db.select()
      .from(exitInvestors)
      .where(and(
        eq(exitInvestors.id, id),
        eq(exitInvestors.orgId, orgId)
      ));
    return investor || undefined;
  }

  async createExitInvestor(data: InsertExitInvestor & { orgId: string }): Promise<ExitInvestor> {
    const [created] = await db.insert(exitInvestors)
      .values(data as any)
      .returning();
    return created;
  }

  async updateExitInvestor(id: string, data: UpdateExitInvestor, orgId: string): Promise<ExitInvestor | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [updated] = await db.update(exitInvestors)
      .set(updateData as any)
      .where(and(
        eq(exitInvestors.id, id),
        eq(exitInvestors.orgId, orgId)
      ))
      .returning();
    return updated || undefined;
  }

  async deleteExitInvestor(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exitInvestors)
      .where(and(
        eq(exitInvestors.id, id),
        eq(exitInvestors.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Cash Flows
  async getExitCashFlows(exitScenarioId: string, orgId: string): Promise<ExitCashFlow[]> {
    return await db.select()
      .from(exitCashFlows)
      .where(and(
        eq(exitCashFlows.exitScenarioId, exitScenarioId),
        eq(exitCashFlows.orgId, orgId)
      ))
      .orderBy(asc(exitCashFlows.period));
  }

  async createExitCashFlow(data: InsertExitCashFlow & { orgId: string }): Promise<ExitCashFlow> {
    const [created] = await db.insert(exitCashFlows)
      .values(data as any)
      .returning();
    return created;
  }

  async deleteExitCashFlows(exitScenarioId: string, orgId: string): Promise<boolean> {
    const result = await db.delete(exitCashFlows)
      .where(and(
        eq(exitCashFlows.exitScenarioId, exitScenarioId),
        eq(exitCashFlows.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Activities
  async getExitActivities(exitScenarioId: string | null, modelingProjectId: string | null, orgId: string): Promise<ExitActivity[]> {
    const conditions = [eq(exitActivities.orgId, orgId)];
    
    if (exitScenarioId) {
      conditions.push(eq(exitActivities.exitScenarioId, exitScenarioId));
    }
    if (modelingProjectId) {
      conditions.push(eq(exitActivities.modelingProjectId, modelingProjectId));
    }
    
    return await db.select()
      .from(exitActivities)
      .where(and(...conditions))
      .orderBy(desc(exitActivities.createdAt));
  }

  async createExitActivity(data: InsertExitActivity & { orgId: string }): Promise<ExitActivity> {
    const [created] = await db.insert(exitActivities)
      .values(data as any)
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
