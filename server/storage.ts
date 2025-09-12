import { 
  organizations, users, projects, projectSettings, tasks, taskTemplates, 
  projectTemplates, auditLogs, timelineNotes, projectShares,
  type Organization, type User, type Project, type ProjectSettings, 
  type Task, type TaskTemplate, type ProjectTemplate, type AuditLog,
  type TimelineNote, type ProjectShare, type InsertOrganization, type InsertUser, type InsertProject, 
  type InsertProjectSettings, type InsertTask, type InsertTaskTemplate,
  type InsertProjectTemplate, type InsertAuditLog, type InsertTimelineNote, type InsertProjectShare
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

  // Task Templates
  getTaskTemplate(id: string): Promise<TaskTemplate | undefined>;
  getTaskTemplatesForOrg(orgId: string): Promise<TaskTemplate[]>;
  getGlobalTaskTemplates(): Promise<TaskTemplate[]>;
  createTaskTemplate(template: InsertTaskTemplate): Promise<TaskTemplate>;

  // Project Templates
  getProjectTemplate(id: string): Promise<ProjectTemplate | undefined>;
  getProjectTemplatesForOrg(orgId: string): Promise<ProjectTemplate[]>;
  getGlobalProjectTemplates(): Promise<ProjectTemplate[]>;
  createProjectTemplate(template: InsertProjectTemplate): Promise<ProjectTemplate>;

  // Timeline Notes
  getTimelineNotesForTask(taskId: string): Promise<TimelineNote[]>;
  createTimelineNote(note: InsertTimelineNote): Promise<TimelineNote>;
  updateTimelineNote(id: string, updates: Partial<InsertTimelineNote>): Promise<TimelineNote>;
  deleteTimelineNote(id: string): Promise<void>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsForProject(projectId: string): Promise<AuditLog[]>;

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

  async getTaskTemplate(id: string): Promise<TaskTemplate | undefined> {
    const [template] = await db.select().from(taskTemplates).where(eq(taskTemplates.id, id));
    return template || undefined;
  }

  async getTaskTemplatesForOrg(orgId: string): Promise<TaskTemplate[]> {
    return db.select().from(taskTemplates).where(eq(taskTemplates.orgId, orgId));
  }

  async getGlobalTaskTemplates(): Promise<TaskTemplate[]> {
    return db.select().from(taskTemplates).where(eq(taskTemplates.isGlobal, true));
  }

  async createTaskTemplate(template: InsertTaskTemplate): Promise<TaskTemplate> {
    const [created] = await db.insert(taskTemplates).values(template).returning();
    return created;
  }

  async getProjectTemplate(id: string): Promise<ProjectTemplate | undefined> {
    const [template] = await db.select().from(projectTemplates).where(eq(projectTemplates.id, id));
    return template || undefined;
  }

  async getProjectTemplatesForOrg(orgId: string): Promise<ProjectTemplate[]> {
    return db.select().from(projectTemplates).where(eq(projectTemplates.orgId, orgId));
  }

  async getGlobalProjectTemplates(): Promise<ProjectTemplate[]> {
    // Project templates don't have isGlobal field, return empty for now
    return [];
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
