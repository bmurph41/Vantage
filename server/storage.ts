import { 
  organizations, users, projects, projectSettings, tasks, 
  projectTemplates, auditLogs, timelineNotes, projectShares, risks,
  type Organization, type User, type Project, type ProjectSettings, 
  type Task, type ProjectTemplate, type AuditLog,
  type TimelineNote, type ProjectShare, type Risk, type InsertOrganization, type InsertUser, type InsertProject, 
  type InsertProjectSettings, type InsertTask,
  type InsertProjectTemplate, type InsertAuditLog, type InsertTimelineNote, type InsertProjectShare, type InsertRisk
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

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
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project>;

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

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const [updated] = await db.update(projects)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(projects.id, id))
      .returning();
    return updated;
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
    return db.select().from(tasks).where(eq(tasks.projectId, projectId));
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
      .where(and(eq(risks.projectId, projectId), eq(risks.category, category)))
      .orderBy(desc(risks.riskScore));
  }

  async getRisksByStatus(projectId: string, status: string): Promise<Risk[]> {
    return db.select().from(risks)
      .where(and(eq(risks.projectId, projectId), eq(risks.status, status)))
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
}

export const storage = new DatabaseStorage();
