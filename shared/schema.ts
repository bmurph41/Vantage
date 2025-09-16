import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, jsonb, pgEnum, primaryKey, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Enums
export const roleEnum = pgEnum("role", ["owner", "editor", "viewer"]);
export const anchorTypeEnum = pgEnum("anchor_type", ["psa", "custom"]);
export const deadlineTypeEnum = pgEnum("deadline_type", ["dd_expiration", "days_after_psa"]);
export const holidayCalendarEnum = pgEnum("holiday_calendar", ["us_federal", "none"]);
export const startStrategyEnum = pgEnum("start_strategy", ["fixed", "offset"]);
export const priorityEnum = pgEnum("priority", ["low", "med", "high"]);
export const statusEnum = pgEnum("status", ["not_started", "engaged", "scheduled", "in_progress", "completed"]);
export const paymentStatusEnum = pgEnum("payment_status", ["not_paid", "paid", "no_cost"]);
export const shareAccessEnum = pgEnum("share_access", ["view", "comment"]);
export const shareTypeEnum = pgEnum("share_type", ["public", "invite", "organization"]);
export const riskCategoryEnum = pgEnum("risk_category", ["technical", "financial", "legal", "regulatory", "operational", "market", "strategic", "environmental", "reputational", "cybersecurity"]);
export const riskStatusEnum = pgEnum("risk_status", ["identified", "analyzing", "mitigating", "monitoring", "closed"]);
export const likelihoodEnum = pgEnum("likelihood", ["1", "2", "3", "4", "5"]);
export const impactEnum = pgEnum("impact", ["1", "2", "3", "4", "5"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["email", "sms"]);
export const subscriptionEventEnum = pgEnum("subscription_event", ["task_status", "note_added", "deadline_upcoming", "deadline_today", "overdue"]);
export const notificationStatusEnum = pgEnum("notification_status", ["sent", "failed", "pending"]);
export const recipientTypeEnum = pgEnum("recipient_type", ["user", "contact"]);

// Organizations
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("viewer"),
  tz: text("tz").notNull().default("America/New_York"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Projects
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  anchorType: anchorTypeEnum("anchor_type").notNull().default("psa"),
  psaSignedDate: date("psa_signed_date"),
  ddExpirationDate: date("dd_expiration_date"),
  closingDate: date("closing_date"),
  // DD Timeline calculation fields
  ddPeriodDays: integer("dd_period_days"),
  hasExtensions: boolean("has_extensions").notNull().default(false),
  extensionCount: integer("extension_count").default(0),
  extensionDays: integer("extension_days").array().default(sql`'{}'`),
  daysToClosing: integer("days_to_closing"),
  // Key Contacts
  seller: text("seller").array().default(sql`'{}'`),
  ourAttorney: text("our_attorney").array().default(sql`'{}'`),
  titleInsuranceCompany: text("title_insurance_company"),
  lender: text("lender"),
  tz: text("tz").notNull().default("America/New_York"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Project Settings
export const projectSettings = pgTable("project_settings", {
  projectId: varchar("project_id").primaryKey().references(() => projects.id),
  useBusinessDays: boolean("use_business_days").notNull().default(false),
  holidayCalendar: holidayCalendarEnum("holiday_calendar").notNull().default("us_federal"),
  notificationsJson: jsonb("notifications_json").notNull().default(sql`'{}'`),
  ndaRequired: boolean("nda_required").notNull().default(false),
  // Enhanced Notification Settings
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  defaultChannels: notificationChannelEnum("default_channels").array().notNull().default(sql`'{"email"}'`),
  defaultEvents: subscriptionEventEnum("default_events").array().notNull().default(sql`'{"deadline_upcoming","deadline_today","overdue"}'`),
  defaultLeadTimesDays: integer("default_lead_times_days").array().notNull().default(sql`'{7,3,1,0,-1}'`),
  emailTemplateId: varchar("email_template_id"), // For custom email templates
  smsTemplateId: varchar("sms_template_id"), // For custom SMS templates
  quietHoursStart: text("quiet_hours_start").default("22:00"), // 10 PM
  quietHoursEnd: text("quiet_hours_end").default("08:00"), // 8 AM
  weekendNotifications: boolean("weekend_notifications").notNull().default(false),
});


// Project Templates
export const projectTemplates = pgTable("project_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  tasksBlueprint: text("tasks_blueprint").array().default(sql`'{}'`),
});


// Tasks
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  startStrategy: startStrategyEnum("start_strategy").notNull().default("offset"),
  startDate: date("start_date"),
  startOffsetDays: integer("start_offset_days"),
  // New deadline fields
  deadlineType: deadlineTypeEnum("deadline_type").default("days_after_psa"),
  deadlineDays: integer("deadline_days"),
  deadline: date("deadline"), // Direct deadline date field
  assignee: text("assignee"),
  companyHired: text("company_hired"),
  repName: text("rep_name"),
  repEmail: text("rep_email"),
  repPhone: text("rep_phone"),
  companyAddress: text("company_address"),
  companySuite: text("company_suite"),
  companyCity: text("company_city"),
  companyState: text("company_state"),
  companyZip: text("company_zip"),
  priority: priorityEnum("priority").notNull().default("med"),
  status: statusEnum("status").notNull().default("not_started"),
  dateEngaged: date("date_engaged"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("not_paid"),
  completedAt: timestamp("completed_at"),
  dateOnSite: text("date_on_site"),
  requiresOnSiteInspection: boolean("requires_on_site_inspection").notNull().default(false),
  orderedAt: date("ordered_at"),
  dependencies: varchar("dependencies").array().default(sql`'{}'`),
  baselineStart: date("baseline_start"),
  baselineDue: date("baseline_due"),
  manuallyLocked: boolean("manually_locked").notNull().default(false),
  cost: text("cost"),
  notes: text("notes"), // Keep for backward compatibility
  showOnTimeline: boolean("show_on_timeline").notNull().default(false),
  sortOrder: integer("sort_order"),
  taskOwner: varchar("task_owner").references(() => users.id), // Team member who owns the task
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Timeline Notes
export const timelineNotes = pgTable("timeline_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  noteType: text("note_type").notNull().default("general"), // general, status_update, contact_interaction, etc.
  metadata: jsonb("metadata").default(sql`'{}'`), // For future CRM integration data
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project Shares
export const projectShares = pgTable("project_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  shareType: shareTypeEnum("share_type").notNull().default("public"),
  accessLevel: shareAccessEnum("access_level").notNull().default("view"),
  shareToken: varchar("share_token").notNull().unique(), // Unique token for the share link
  email: text("email"), // Optional: specific email for invite type
  expiresAt: timestamp("expires_at"), // Optional: expiration date
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at"),
});

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Risk Management
export const risks = pgTable("risks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  category: riskCategoryEnum("category").notNull().default("operational"),
  owner: text("owner").notNull(), // Risk owner name
  ownerId: varchar("owner_id").references(() => users.id), // Optional: link to system user
  
  // Quantitative Risk Assessment
  likelihood: likelihoodEnum("likelihood").notNull().default("3"), // 1-5 scale
  impact: impactEnum("impact").notNull().default("3"), // 1-5 scale
  riskScore: integer("risk_score").notNull().default(9), // Auto-calculated: likelihood × impact
  
  // Financial Impact Analysis
  impactCostUSD: integer("impact_cost_usd").default(0), // Financial impact in USD
  impactScheduleDays: integer("impact_schedule_days").default(0), // Schedule impact in days
  
  // Mitigation Planning
  mitigationPlan: text("mitigation_plan"),
  mitigationOwner: text("mitigation_owner"),
  targetDate: date("target_date"), // Mitigation completion target
  mitigationCostUSD: integer("mitigation_cost_usd").default(0), // Cost to mitigate
  
  // Residual Risk (Post-Mitigation)
  residualLikelihood: likelihoodEnum("residual_likelihood"), // Expected likelihood after mitigation
  residualImpact: impactEnum("residual_impact"), // Expected impact after mitigation
  residualScore: integer("residual_score"), // Auto-calculated residual risk score
  
  // Status and Tracking
  status: riskStatusEnum("status").notNull().default("identified"),
  identifiedDate: date("identified_date").notNull().default(sql`CURRENT_DATE`),
  lastReviewDate: date("last_review_date"),
  nextReviewDate: date("next_review_date"),
  
  // Materialization Tracking
  materialized: boolean("materialized").notNull().default(false),
  materializedDate: date("materialized_date"),
  actualCostUSD: integer("actual_cost_usd"), // Actual cost if materialized
  actualScheduleDays: integer("actual_schedule_days"), // Actual schedule impact if materialized
  
  // Additional Analysis Fields
  probability: integer("probability"), // Percentage probability (0-100)
  confidenceLevel: integer("confidence_level").default(50), // Confidence in assessment (0-100)
  riskVelocity: text("risk_velocity").default("stable"), // increasing, stable, decreasing
  
  // Metadata
  tags: text("tags").array().default(sql`'{}'`), // For categorization and filtering
  metadata: jsonb("metadata").default(sql`'{}'`), // For additional custom fields
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Contacts
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  timezone: text("timezone").notNull().default("America/New_York"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Notification Subscriptions
export const notificationSubscriptions = pgTable("notification_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  taskId: varchar("task_id").references(() => tasks.id), // Optional: specific task subscription
  recipientType: recipientTypeEnum("recipient_type").notNull(),
  recipientId: varchar("recipient_id").notNull(), // References users.id OR contacts.id
  channels: notificationChannelEnum("channels").array().notNull().default(sql`'{"email"}'`),
  events: subscriptionEventEnum("events").array().notNull().default(sql`'{"deadline_upcoming","deadline_today","overdue"}'`),
  leadTimesDays: integer("lead_times_days").array().notNull().default(sql`'{7,3,1,0,-1}'`), // Days before/after deadline
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    // Performance indexes for critical query paths
    projectIdx: index("notification_subscriptions_project").on(table.projectId),
    projectTaskIdx: index("notification_subscriptions_project_task").on(table.projectId, table.taskId),
    recipientIdx: index("notification_subscriptions_recipient").on(table.recipientType, table.recipientId),
    activeIdx: index("notification_subscriptions_active").on(table.active),
  };
});

// Notifications Log
export const notificationsLog = pgTable("notifications_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  taskId: varchar("task_id").references(() => tasks.id), // Optional: specific task notification
  event: subscriptionEventEnum("event").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  
  // Recipient identification (for cleaner resolution)
  recipientType: recipientTypeEnum("recipient_type").notNull(),
  recipientId: varchar("recipient_id").notNull(), // References users.id OR contacts.id
  recipientEmail: text("recipient_email"), // Cached for delivery
  recipientPhone: text("recipient_phone"), // Cached for delivery
  
  // Timing and de-duplication
  leadOffsetDays: integer("lead_offset_days").notNull(), // Lead time used (renamed from thresholdDays)
  scheduledFor: timestamp("scheduled_for").notNull(), // When notification should be sent
  sentAt: timestamp("sent_at"), // When actually sent (null if not sent yet)
  
  // Delivery tracking
  providerMessageId: text("provider_message_id"), // ID from email/SMS provider
  status: notificationStatusEnum("status").notNull().default("pending"),
  metadata: jsonb("metadata").default(sql`'{}'`), // Additional provider response data
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    // Composite unique constraint to prevent duplicate notifications
    uniqueNotification: unique("unique_notification").on(
      table.projectId, table.taskId, table.event, table.channel, 
      table.recipientType, table.recipientId, table.leadOffsetDays
    ),
    // Performance indexes for critical query paths
    projectTaskEventIdx: index("notifications_log_project_task_event").on(
      table.projectId, table.taskId, table.event
    ),
    recipientIdx: index("notifications_log_recipient").on(
      table.recipientType, table.recipientId
    ),
    scheduledAtIdx: index("notifications_log_scheduled_at").on(
      table.scheduledFor
    ),
    sentAtIdx: index("notifications_log_sent_at").on(
      table.sentAt
    ),
    statusIdx: index("notifications_log_status").on(
      table.status
    )
  };
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  projects: many(projects),
  contacts: many(contacts),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  createdProjects: many(projects),
  auditLogs: many(auditLogs),
  createdContacts: many(contacts),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  settings: one(projectSettings),
  tasks: many(tasks),
  auditLogs: many(auditLogs),
  shares: many(projectShares),
  risks: many(risks),
  notificationSubscriptions: many(notificationSubscriptions),
  notificationsLog: many(notificationsLog),
}));

export const projectSettingsRelations = relations(projectSettings, ({ one }) => ({
  project: one(projects, {
    fields: [projectSettings.projectId],
    references: [projects.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
}));

export const projectSharesRelations = relations(projectShares, ({ one }) => ({
  project: one(projects, {
    fields: [projectShares.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [projectShares.createdBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  project: one(projects, {
    fields: [auditLogs.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const risksRelations = relations(risks, ({ one }) => ({
  project: one(projects, {
    fields: [risks.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [risks.ownerId],
    references: [users.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  organization: one(organizations, {
    fields: [contacts.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [contacts.createdBy],
    references: [users.id],
  }),
}));

export const notificationSubscriptionsRelations = relations(notificationSubscriptions, ({ one }) => ({
  project: one(projects, {
    fields: [notificationSubscriptions.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [notificationSubscriptions.taskId],
    references: [tasks.id],
  }),
}));

export const notificationsLogRelations = relations(notificationsLog, ({ one }) => ({
  project: one(projects, {
    fields: [notificationsLog.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [notificationsLog.taskId],
    references: [tasks.id],
  }),
}));

// Insert Schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSettingsSchema = createInsertSchema(projectSettings);


export const insertProjectTemplateSchema = createInsertSchema(projectTemplates).omit({
  id: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTimelineNoteSchema = createInsertSchema(timelineNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectShareSchema = createInsertSchema(projectShares).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertRiskSchema = createInsertSchema(risks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSubscriptionSchema = createInsertSchema(notificationSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationLogSchema = createInsertSchema(notificationsLog).omit({
  id: true,
  createdAt: true,
});

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type ProjectSettings = typeof projectSettings.$inferSelect;
export type InsertProjectSettings = z.infer<typeof insertProjectSettingsSchema>;


export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type InsertProjectTemplate = z.infer<typeof insertProjectTemplateSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type TimelineNote = typeof timelineNotes.$inferSelect;
export type InsertTimelineNote = z.infer<typeof insertTimelineNoteSchema>;

export type ProjectShare = typeof projectShares.$inferSelect;
export type InsertProjectShare = z.infer<typeof insertProjectShareSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Risk = typeof risks.$inferSelect;
export type InsertRisk = z.infer<typeof insertRiskSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type NotificationSubscription = typeof notificationSubscriptions.$inferSelect;
export type InsertNotificationSubscription = z.infer<typeof insertNotificationSubscriptionSchema>;

export type NotificationLog = typeof notificationsLog.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
