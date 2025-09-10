import { 
  organizations, users, projects, projectSettings, tasks, taskTemplates, 
  projectTemplates, auditLogs, timelineNotes,
  type Organization, type User, type Project, type ProjectSettings, 
  type Task, type TaskTemplate, type ProjectTemplate, type AuditLog,
  type TimelineNote, type InsertOrganization, type InsertUser, type InsertProject, 
  type InsertProjectSettings, type InsertTask, type InsertTaskTemplate,
  type InsertProjectTemplate, type InsertAuditLog, type InsertTimelineNote
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
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

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
}

export const storage = new DatabaseStorage();
