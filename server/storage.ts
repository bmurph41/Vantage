import { 
  organizations, users, projects, projectSettings, tasks, 
  projectTemplates, auditLogs, timelineNotes, projectShares, risks,
  contacts, notificationSubscriptions, notificationsLog, calendarEvents,
  documentRequirements, projectIntegrations,
  type Organization, type User, type Project, type ProjectSettings, 
  type Task, type ProjectTemplate, type AuditLog,
  type TimelineNote, type ProjectShare, type Risk, type Contact, type NotificationSubscription, type NotificationLog, type CalendarEvent,
  type DocumentRequirement, type ProjectIntegration,
  type InsertOrganization, type InsertUser, type InsertProject, 
  type InsertProjectSettings, type InsertTask,
  type InsertProjectTemplate, type InsertAuditLog, type InsertTimelineNote, type InsertProjectShare, type InsertRisk,
  type InsertContact, type InsertNotificationSubscription, type InsertNotificationLog, type InsertCalendarEvent,
  type InsertDocumentRequirement, type InsertProjectIntegration
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";

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
  getTask(id: string): Promise<Task | undefined>;
  getTasksForProject(projectId: string): Promise<Task[]>;
  getProjectAssignees(projectId: string): Promise<string[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

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

  // Contact Management
  createContact(contact: InsertContact): Promise<Contact>;
  getContactsByOrg(orgId: string): Promise<Contact[]>;
  getContactById(id: string): Promise<Contact | undefined>;
  updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

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
          tz: projects.tz,
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

  async getTasksForProject(projectId: string): Promise<Task[]> {
    return db.select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
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
      .where(and(eq(tasks.projectId, projectId), sql`${tasks.assignee} IS NOT NULL AND ${tasks.assignee} != ''`));

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
  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async getContactsByOrg(orgId: string): Promise<Contact[]> {
    return db.select().from(contacts)
      .where(eq(contacts.orgId, orgId))
      .orderBy(contacts.name);
  }

  async getContactById(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async updateContact(id: string, updates: Partial<InsertContact>): Promise<Contact> {
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
          status: task.status,
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
}

export const storage = new DatabaseStorage();
