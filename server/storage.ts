import { 
  organizations, users, projects, projectSettings, tasks, 
  projectTemplates, auditLogs, timelineNotes, projectShares, risks,
  contacts, projectContacts, notificationSubscriptions, notificationsLog, calendarEvents,
  documentRequirements, projectIntegrations, taskDependencies, taskFiles, userEmails, calendarGuests,
  cddDocuments, docPages, kpis, findings, recommendations, vectorChunks, cddReports, comps, checklistItems,
  crmDeals, crmLeads, crmContacts, crmCompanies, crmPipelines, crmPipelineStages, crmActivities,
  crmImportJobs, crmImportedRecords, crmProspectingEntries,
  crmEmailSequences, crmEmailTemplates, crmEmailSequenceSteps, crmEmailSequenceEnrollments, crmEmailSequenceStepExecutions,
  calendarSettings,
  salesComps, compColumns, compImports, scProjects, scProjectComps, scAuditLog, scRecommendationFeedback, scOrgPreferences, scSavedSearches,
  type Organization, type User, type Project, type ProjectSettings, 
  type DDTask, type ProjectTemplate, type AuditLog,
  type TimelineNote, type ProjectShare, type Risk, type DDContact, type ProjectContact, type NotificationSubscription, type NotificationLog, type CalendarEvent,
  type DocumentRequirement, type ProjectIntegration, type TaskDependency, type TaskFile, type UserEmail, type CalendarGuest,
  type CddDocument, type DocPage, type Kpi, type Finding, type Recommendation, type VectorChunk, type CddReport, type Comp, type ChecklistItem,
  type CrmDeal, type CrmLead, type CrmContact, type CrmCompany, type CrmPipeline, type CrmPipelineStage, type CrmActivity,
  type CrmImportJob, type CrmImportedRecord, type ProspectingEntry,
  type EmailSequence, type EmailTemplate, type EmailSequenceStep, type EmailSequenceEnrollment, type EmailSequenceStepExecution,
  type CalendarSettings,
  type SalesComp, type CompColumn, type CompImport, type ScProject, type ScProjectComp, type ScAuditLog, type ScRecommendationFeedback, type ScOrgPreferences, type ScSavedSearch,
  type InsertOrganization, type InsertUser, type InsertProject, 
  type InsertProjectSettings, type InsertDDTask,
  type InsertProjectTemplate, type InsertAuditLog, type InsertTimelineNote, type InsertProjectShare, type InsertRisk,
  type InsertDDContact, type UpdateDDContact, type InsertProjectContact, type InsertNotificationSubscription, type InsertNotificationLog, type InsertCalendarEvent,
  type InsertDocumentRequirement, type InsertProjectIntegration, type InsertTaskDependency, type InsertTaskFile, type InsertUserEmail, type InsertCalendarGuest,
  type InsertCddDocument, type InsertDocPage, type InsertKpi, type InsertFinding, type InsertRecommendation, type InsertVectorChunk, type InsertCddReport, type InsertComp, type InsertChecklistItem,
  type InsertCrmDeal, type InsertCrmLead, type InsertCrmContact, type InsertCrmCompany, type InsertCrmPipeline, type InsertCrmPipelineStage, type InsertCrmActivity,
  type InsertCrmImportJob, type InsertCrmImportedRecord, type InsertProspectingEntry,
  type InsertEmailSequence, type InsertEmailTemplate, type InsertEmailSequenceStep, type InsertEmailSequenceEnrollment, type InsertEmailSequenceStepExecution,
  type InsertCalendarSettings,
  type InsertSalesComp, type UpdateSalesComp, type InsertCompColumn, type UpdateCompColumn, type InsertCompImport,
  type InsertScProject, type UpdateScProject, type InsertScProjectComp, type UpdateScProjectComp,
  type InsertScRecommendationFeedback, type InsertScOrgPreferences, type UpdateScOrgPreferences,
  type InsertScSavedSearch, type UpdateScSavedSearch
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray, isNull, or, count } from "drizzle-orm";

export interface IStorage {
  // Organizations
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;

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
  getCrmDealsByPipeline(pipelineId: string): Promise<CrmDeal[]>;
  getCrmDealsByStage(stageId: string): Promise<CrmDeal[]>;
  createCrmDeal(deal: InsertCrmDeal): Promise<CrmDeal>;
  updateCrmDeal(id: string, updates: Partial<InsertCrmDeal>): Promise<CrmDeal>;
  deleteCrmDeal(id: string): Promise<void>;

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
  getCrmContactsByCompany(companyId: string): Promise<CrmContact[]>;
  createCrmContact(contact: InsertCrmContact): Promise<CrmContact>;
  updateCrmContact(id: string, updates: Partial<InsertCrmContact>): Promise<CrmContact>;
  deleteCrmContact(id: string): Promise<void>;

  // CRM - Companies
  getCrmCompany(id: string): Promise<CrmCompany | undefined>;
  getCrmCompaniesForOrg(orgId: string): Promise<CrmCompany[]>;
  createCrmCompany(company: InsertCrmCompany): Promise<CrmCompany>;
  updateCrmCompany(id: string, updates: Partial<InsertCrmCompany>): Promise<CrmCompany>;
  deleteCrmCompany(id: string): Promise<void>;

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
}

export class DatabaseStorage implements IStorage {
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
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
    if (filters.state) {
      conditions.push(eq(salesComps.state, filters.state));
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
      conditions.push(eq(salesComps.isPriceDisclosed, true));
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
        case 'market':
          dbColumn = salesComps.market;
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

    if (filters.regions && filters.regions.length > 0) {
      conditions.push(inArray(salesComps.region, filters.regions));
    }
    if (filters.states && filters.states.length > 0) {
      conditions.push(inArray(salesComps.state, filters.states));
    }
    if (filters.coastalType) {
      conditions.push(eq(salesComps.coastalType, filters.coastalType));
    }
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
}

export const storage = new DatabaseStorage();
