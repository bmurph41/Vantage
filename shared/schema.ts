import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, jsonb, pgEnum, primaryKey, unique, index, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value.replace(/^\[|\]$/g, '').split(',').map(Number);
  },
});

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
export const calendarEventTypeEnum = pgEnum("calendar_event_type", ["dd_expiration", "closing", "task_deadline", "milestone", "custom"]);
export const documentRequirementStatusEnum = pgEnum("document_requirement_status", ["requested", "received", "verified", "rejected", "outdated", "external_unavailable"]);
export const dependencyTypeEnum = pgEnum("dependency_type", ["FS", "SS", "FF", "SF"]);
export const ddCategoryEnum = pgEnum("dd_category", ["title", "survey", "ESA", "appraisal", "inspection", "permits", "zoning", "financial", "legal", "insurance", "other"]);
export const calendarProviderEnum = pgEnum("calendar_provider", ["google", "outlook", "apple"]);
export const emailTypeEnum = pgEnum("email_type", ["primary", "additional"]);
export const guestStatusEnum = pgEnum("guest_status", ["pending", "accepted", "declined"]);
export const contactRoleEnum = pgEnum("contact_role", ["seller", "attorney", "lender", "title_insurance", "inspector", "surveyor", "environmental", "appraiser", "broker", "insurance_agent", "other"]);
export const dashboardTypeEnum = pgEnum("dashboard_type", ["default", "investor", "owner", "attorney", "lender", "inspector", "third_party"]);
export const parseStatusEnum = pgEnum("parse_status", ["pending", "parsing", "parsed", "failed"]);
export const embeddingsStatusEnum = pgEnum("embeddings_status", ["pending", "processing", "completed", "failed"]);
export const severityEnum = pgEnum("severity", ["low", "med", "high", "critical"]);
export const confidenceLevelEnum = pgEnum("confidence_level", ["low", "medium", "high"]);

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
  // Calendar preferences
  defaultCalendarProvider: calendarProviderEnum("default_calendar_provider"),
  calendarSyncEnabled: boolean("calendar_sync_enabled").notNull().default(true),
  // Dashboard preferences
  preferredDashboard: dashboardTypeEnum("preferred_dashboard").default("default"),
  dashboardConfig: jsonb("dashboard_config").default(sql`'{}'`), // Custom dashboard settings
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Projects
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  city: text("city"),
  state: text("state"),
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
  // Deposit Information
  firstDepositAmount: integer("first_deposit_amount"),
  firstDepositDays: integer("first_deposit_days"),
  firstDepositDueDate: date("first_deposit_due_date"),
  secondDepositAmount: integer("second_deposit_amount"),
  secondDepositDays: integer("second_deposit_days"),
  secondDepositDueDate: date("second_deposit_due_date"),
  tz: text("tz").notNull().default("America/New_York"),
  executiveNotes: text("executive_notes"), // User's notes for AI enhancement
  // Investment & Deal Health Metrics
  purchasePrice: integer("purchase_price"), // Acquisition cost
  estimatedRenovationCost: integer("estimated_renovation_cost"),
  projectedAnnualRevenue: integer("projected_annual_revenue"),
  investmentThesis: text("investment_thesis"), // Strategic rationale
  dealHealthScore: integer("deal_health_score"), // 0-100 calculated score
  healthScoreUpdatedAt: timestamp("health_score_updated_at"),
  customDeadlines: jsonb("custom_deadlines").default(sql`'[]'`), // Array of {label: string, date: string}
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
  // Enhanced CPM fields
  optimisticDays: integer("optimistic_days"),
  mostLikelyDays: integer("most_likely_days"),
  pessimisticDays: integer("pessimistic_days"),
  earliestStart: date("earliest_start"),
  requiredFinish: date("required_finish"),
  // DD-specific fields
  isGating: boolean("is_gating").notNull().default(false),
  isMilestone: boolean("is_milestone").notNull().default(false),
  ddCategory: ddCategoryEnum("dd_category"),
  // Archive fields
  archived: boolean("archived").notNull().default(false),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Files
export const taskFiles = pgTable("task_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Original filename
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // File size in bytes
  storageProvider: text("storage_provider").notNull().default("local"), // 'local' | 'supabase'
  storagePath: text("storage_path").notNull(), // Internal storage path
  url: text("url"), // Optional: for external URLs or signed URLs
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  visibility: text("visibility").notNull().default("org"), // 'org' | 'shared'
  checksum: text("checksum"), // Optional: for file integrity verification
  notes: text("notes"), // Optional: user notes about the file
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Enhanced Task Dependencies (CPM support)
export const taskDependencies = pgTable("task_dependencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  successorId: varchar("successor_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  predecessorId: varchar("predecessor_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  type: dependencyTypeEnum("type").notNull().default("FS"),
  lagDays: integer("lag_days").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate dependencies
  uniqueDependency: unique().on(table.successorId, table.predecessorId)
}));

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
  projectId: varchar("project_id").references(() => projects.id), // Nullable for org-level audit logs
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default(sql`'{}'`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    orgIdx: index("audit_logs_org").on(table.orgId),
    projectIdx: index("audit_logs_project").on(table.projectId),
    userIdx: index("audit_logs_user").on(table.userId),
    entityIdx: index("audit_logs_entity").on(table.entityType, table.entityId),
    actionIdx: index("audit_logs_action").on(table.action),
    createdAtIdx: index("audit_logs_created_at").on(table.createdAt),
  };
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
  role: contactRoleEnum("role"), // Optional role designation
  customRole: text("custom_role"), // Custom role/position when role is "other"
  company: text("company"), // Company name for the contact
  onDealTeam: boolean("on_deal_team").notNull().default(false), // Whether contact is on the deal team
  dealTeamNotes: text("deal_team_notes"), // Notes about this contact's role on the deal team
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

// Calendar Events
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  taskId: varchar("task_id").references(() => tasks.id), // Optional: link to specific task
  
  // Event details
  eventType: calendarEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  
  // Date/time information
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // Optional for all-day events
  isAllDay: boolean("is_all_day").notNull().default(false),
  timezone: text("timezone").notNull().default("America/New_York"),
  
  // Event metadata
  priority: priorityEnum("priority").notNull().default("med"),
  status: statusEnum("status").notNull().default("not_started"),
  location: text("location"),
  
  // Calendar integration metadata
  icalUid: text("ical_uid"), // For ICS generation
  lastSynced: timestamp("last_synced"),
  isGenerated: boolean("is_generated").notNull().default(true), // Auto-generated vs manual
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    // Unique constraint to prevent duplicate task calendar events
    uniqueTaskEvent: unique("calendar_events_unique_task_event").on(
      table.projectId, table.taskId, table.eventType
    ),
    // Performance indexes
    projectEventTypeIdx: index("calendar_events_project_event_type").on(
      table.projectId, table.eventType
    ),
    startDateIdx: index("calendar_events_start_date").on(
      table.startDate
    ),
    taskEventIdx: index("calendar_events_task").on(
      table.taskId
    ),
  };
});

// User Emails - for multiple email addresses per user
export const userEmails = pgTable("user_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  emailType: emailTypeEnum("email_type").notNull().default("additional"),
  calendarProvider: calendarProviderEnum("calendar_provider"),
  isVerified: boolean("is_verified").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    userEmailIdx: index("user_emails_user").on(table.userId),
    emailIdx: index("user_emails_email").on(table.email),
    // Ensure unique emails per user
    uniqueUserEmail: unique("user_emails_unique_user_email").on(table.userId, table.email),
  };
});

// Calendar Guests - for guest email invitations
export const calendarGuests = pgTable("calendar_guests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  email: text("email").notNull(),
  name: text("name"),
  calendarProvider: calendarProviderEnum("calendar_provider"),
  status: guestStatusEnum("status").notNull().default("pending"),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    projectGuestIdx: index("calendar_guests_project").on(table.projectId),
    emailIdx: index("calendar_guests_email").on(table.email),
    invitedByIdx: index("calendar_guests_invited_by").on(table.invitedBy),
    // Ensure unique guests per project
    uniqueProjectGuest: unique("calendar_guests_unique_project_guest").on(table.projectId, table.email),
  };
});

// Document Requirements
export const documentRequirements = pgTable("document_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  requirementKey: text("requirement_key").notNull(), // Indexed for lookups
  title: text("title").notNull(),
  description: text("description"),
  provider: text("provider").notNull(), // Third-party provider name
  externalDocId: text("external_doc_id"), // Nullable - external document ID
  externalVersion: text("external_version"), // Version from external system
  status: documentRequirementStatusEnum("status").notNull().default("requested"),
  receivedAt: timestamp("received_at"),
  verifiedAt: timestamp("verified_at"),
  metadata: jsonb("metadata").default(sql`'{}'`), // Additional provider-specific data
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    // Unique constraint on (taskId, requirementKey)
    taskRequirementKey: unique("document_requirements_task_requirement_key").on(
      table.taskId, table.requirementKey
    ),
    // Performance indexes
    projectIdx: index("document_requirements_project").on(table.projectId),
    taskIdx: index("document_requirements_task").on(table.taskId),
    requirementKeyIdx: index("document_requirements_requirement_key").on(table.requirementKey),
    statusIdx: index("document_requirements_status").on(table.status),
    providerIdx: index("document_requirements_provider").on(table.provider),
    // Additional indexes based on architect feedback
    projectRequirementKeyIdx: index("document_requirements_project_requirement_key").on(table.projectId, table.requirementKey),
    externalDocIdIdx: index("document_requirements_external_doc_id").on(table.externalDocId),
  };
});

// Project Integrations
export const projectIntegrations = pgTable("project_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  provider: text("provider").notNull(), // Integration provider name (e.g., "webhook", "api")
  config: jsonb("config").notNull().default(sql`'{}'`), // Configuration data (webhookId, secret, baseUrl, lastSyncCursor, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    // Unique constraint to prevent duplicate integrations per project
    uniqueProjectProvider: unique("project_integrations_unique_project_provider").on(
      table.projectId, table.provider
    ),
    // Performance indexes
    projectIdx: index("project_integrations_project").on(table.projectId),
    providerIdx: index("project_integrations_provider").on(table.provider),
    projectProviderIdx: index("project_integrations_project_provider").on(table.projectId, table.provider),
  };
});

// CDD Documents - Commercial Due Diligence documents
export const cddDocuments = pgTable("cdd_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  parseStatus: parseStatusEnum("parse_status").notNull().default("pending"),
  parseError: text("parse_error"),
  embeddingsStatus: embeddingsStatusEnum("embeddings_status").notNull().default("pending"),
  embeddingsError: text("embeddings_error"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  parsedAt: timestamp("parsed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("cdd_documents_project").on(table.projectId),
  parseStatusIdx: index("cdd_documents_parse_status").on(table.parseStatus),
}));

// Document Pages - extracted text from documents
export const docPages = pgTable("doc_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => cddDocuments.id, { onDelete: "cascade" }),
  pageNo: integer("page_no").notNull(),
  text: text("text").notNull(),
  tokens: integer("tokens"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  documentPageIdx: index("doc_pages_document_page").on(table.documentId, table.pageNo),
  uniqueDocumentPage: unique("doc_pages_unique_document_page").on(table.documentId, table.pageNo),
}));

// KPIs - extracted key performance indicators
export const kpis = pgTable("kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  valueText: text("value_text"),
  valueNum: integer("value_num"),
  unit: text("unit"),
  sourceDocumentId: varchar("source_document_id").references(() => cddDocuments.id),
  pageHint: text("page_hint"),
  confidence: confidenceLevelEnum("confidence").notNull().default("medium"),
  category: text("category"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("kpis_project").on(table.projectId),
  sourceDocIdx: index("kpis_source_document").on(table.sourceDocumentId),
  categoryIdx: index("kpis_category").on(table.category),
}));

// Findings - due diligence findings and issues
export const findings = pgTable("findings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  severity: severityEnum("severity").notNull().default("low"),
  bodyMd: text("body_md").notNull(),
  sources: jsonb("sources").default(sql`'[]'`),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("findings_project").on(table.projectId),
  severityIdx: index("findings_severity").on(table.severity),
  createdByIdx: index("findings_created_by").on(table.createdBy),
}));

// Recommendations - analysis recommendations
export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  priority: priorityEnum("priority").notNull().default("med"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("recommendations_project").on(table.projectId),
  priorityIdx: index("recommendations_priority").on(table.priority),
}));

// Vector Chunks - embeddings for RAG
export const vectorChunks = pgTable("vector_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceId: varchar("source_id").notNull(),
  contentText: text("content_text").notNull(),
  embedding: vector("embedding"),
  metadata: jsonb("metadata").default(sql`'{}'`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("vector_chunks_project").on(table.projectId),
  sourceIdx: index("vector_chunks_source").on(table.sourceType, table.sourceId),
}));

// CDD Reports - generated reports
export const cddReports = pgTable("cdd_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  version: integer("version").notNull().default(1),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("cdd_reports_project").on(table.projectId),
  versionIdx: index("cdd_reports_version").on(table.projectId, table.version),
}));

// Comps - comparable properties for analysis
export const comps = pgTable("comps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  assetType: text("asset_type"),
  location: text("location"),
  slips: integer("slips"),
  racks: integer("racks"),
  rateNotes: text("rate_notes"),
  source: text("source"),
  capexNotes: text("capex_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("comps_project").on(table.projectId),
}));

// Checklist Items - due diligence checklist
export const checklistItems = pgTable("checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  section: text("section").notNull(),
  item: text("item").notNull(),
  status: statusEnum("status").notNull().default("not_started"),
  ownerUserId: varchar("owner_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("checklist_items_project").on(table.projectId),
  sectionIdx: index("checklist_items_section").on(table.projectId, table.section),
  statusIdx: index("checklist_items_status").on(table.status),
}));

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
  calendarEvents: many(calendarEvents),
  documentRequirements: many(documentRequirements),
  projectIntegrations: many(projectIntegrations),
  cddDocuments: many(cddDocuments),
  kpis: many(kpis),
  findings: many(findings),
  recommendations: many(recommendations),
  vectorChunks: many(vectorChunks),
  cddReports: many(cddReports),
  comps: many(comps),
  checklistItems: many(checklistItems),
}));

export const projectSettingsRelations = relations(projectSettings, ({ one }) => ({
  project: one(projects, {
    fields: [projectSettings.projectId],
    references: [projects.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  documentRequirements: many(documentRequirements),
  taskFiles: many(taskFiles),
  // Enhanced dependency relations
  dependenciesAsSuccessor: many(taskDependencies, {
    relationName: "taskSuccessor"
  }),
  dependenciesAsPredecessor: many(taskDependencies, {
    relationName: "taskPredecessor"
  }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  successor: one(tasks, {
    fields: [taskDependencies.successorId],
    references: [tasks.id],
    relationName: "taskSuccessor"
  }),
  predecessor: one(tasks, {
    fields: [taskDependencies.predecessorId],
    references: [tasks.id],
    relationName: "taskPredecessor"
  }),
}));

export const taskFilesRelations = relations(taskFiles, ({ one }) => ({
  project: one(projects, {
    fields: [taskFiles.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [taskFiles.taskId],
    references: [tasks.id],
  }),
  uploadedByUser: one(users, {
    fields: [taskFiles.uploadedBy],
    references: [users.id],
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
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [auditLogs.projectId],
    references: [projects.id],
    relationName: "auditProject"
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
    relationName: "auditUser"
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

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  project: one(projects, {
    fields: [calendarEvents.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [calendarEvents.taskId],
    references: [tasks.id],
  }),
}));

export const documentRequirementsRelations = relations(documentRequirements, ({ one }) => ({
  project: one(projects, {
    fields: [documentRequirements.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [documentRequirements.taskId],
    references: [tasks.id],
  }),
}));

export const projectIntegrationsRelations = relations(projectIntegrations, ({ one }) => ({
  project: one(projects, {
    fields: [projectIntegrations.projectId],
    references: [projects.id],
  }),
}));

export const cddDocumentsRelations = relations(cddDocuments, ({ one, many }) => ({
  project: one(projects, {
    fields: [cddDocuments.projectId],
    references: [projects.id],
  }),
  uploadedByUser: one(users, {
    fields: [cddDocuments.uploadedBy],
    references: [users.id],
  }),
  docPages: many(docPages),
  kpis: many(kpis),
  vectorChunks: many(vectorChunks),
}));

export const docPagesRelations = relations(docPages, ({ one }) => ({
  document: one(cddDocuments, {
    fields: [docPages.documentId],
    references: [cddDocuments.id],
  }),
}));

export const kpisRelations = relations(kpis, ({ one }) => ({
  project: one(projects, {
    fields: [kpis.projectId],
    references: [projects.id],
  }),
  sourceDocument: one(cddDocuments, {
    fields: [kpis.sourceDocumentId],
    references: [cddDocuments.id],
  }),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  project: one(projects, {
    fields: [findings.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [findings.createdBy],
    references: [users.id],
  }),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  project: one(projects, {
    fields: [recommendations.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [recommendations.createdBy],
    references: [users.id],
  }),
}));

export const vectorChunksRelations = relations(vectorChunks, ({ one }) => ({
  project: one(projects, {
    fields: [vectorChunks.projectId],
    references: [projects.id],
  }),
}));

export const cddReportsRelations = relations(cddReports, ({ one }) => ({
  project: one(projects, {
    fields: [cddReports.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [cddReports.createdBy],
    references: [users.id],
  }),
}));

export const compsRelations = relations(comps, ({ one }) => ({
  project: one(projects, {
    fields: [comps.projectId],
    references: [projects.id],
  }),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  project: one(projects, {
    fields: [checklistItems.projectId],
    references: [projects.id],
  }),
  owner: one(users, {
    fields: [checklistItems.ownerUserId],
    references: [users.id],
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

export const insertTaskDependencySchema = createInsertSchema(taskDependencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskFileSchema = createInsertSchema(taskFiles).omit({
  id: true,
  url: true, // Generated by backend
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

// Security: Restricted schema for contact updates - excludes tenant isolation fields
export const updateContactSchema = createInsertSchema(contacts).omit({
  id: true,
  orgId: true,
  createdBy: true,
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

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserEmailSchema = createInsertSchema(userEmails).omit({
  id: true,
  createdAt: true,
});

export const insertCalendarGuestSchema = createInsertSchema(calendarGuests).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentRequirementSchema = createInsertSchema(documentRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectIntegrationSchema = createInsertSchema(projectIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

export type TaskDependency = typeof taskDependencies.$inferSelect;
export type InsertTaskDependency = z.infer<typeof insertTaskDependencySchema>;

export type TaskFile = typeof taskFiles.$inferSelect;
export type InsertTaskFile = z.infer<typeof insertTaskFileSchema>;

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
export type UpdateContact = z.infer<typeof updateContactSchema>;

export type NotificationSubscription = typeof notificationSubscriptions.$inferSelect;
export type InsertNotificationSubscription = z.infer<typeof insertNotificationSubscriptionSchema>;

export type NotificationLog = typeof notificationsLog.$inferSelect;
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

export type UserEmail = typeof userEmails.$inferSelect;
export type InsertUserEmail = z.infer<typeof insertUserEmailSchema>;

export type CalendarGuest = typeof calendarGuests.$inferSelect;
export type InsertCalendarGuest = z.infer<typeof insertCalendarGuestSchema>;

export type DocumentRequirement = typeof documentRequirements.$inferSelect;
export type InsertDocumentRequirement = z.infer<typeof insertDocumentRequirementSchema>;

export type ProjectIntegration = typeof projectIntegrations.$inferSelect;
export type InsertProjectIntegration = z.infer<typeof insertProjectIntegrationSchema>;

export const insertCddDocumentSchema = createInsertSchema(cddDocuments).omit({
  id: true,
  createdAt: true,
});

export const insertDocPageSchema = createInsertSchema(docPages).omit({
  id: true,
  createdAt: true,
});

export const insertKpiSchema = createInsertSchema(kpis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFindingSchema = createInsertSchema(findings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVectorChunkSchema = createInsertSchema(vectorChunks).omit({
  id: true,
  createdAt: true,
});

export const insertCddReportSchema = createInsertSchema(cddReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompSchema = createInsertSchema(comps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CddDocument = typeof cddDocuments.$inferSelect;
export type InsertCddDocument = z.infer<typeof insertCddDocumentSchema>;

export type DocPage = typeof docPages.$inferSelect;
export type InsertDocPage = z.infer<typeof insertDocPageSchema>;

export type Kpi = typeof kpis.$inferSelect;
export type InsertKpi = z.infer<typeof insertKpiSchema>;

export type Finding = typeof findings.$inferSelect;
export type InsertFinding = z.infer<typeof insertFindingSchema>;

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;

export type VectorChunk = typeof vectorChunks.$inferSelect;
export type InsertVectorChunk = z.infer<typeof insertVectorChunkSchema>;

export type CddReport = typeof cddReports.$inferSelect;
export type InsertCddReport = z.infer<typeof insertCddReportSchema>;

export type Comp = typeof comps.$inferSelect;
export type InsertComp = z.infer<typeof insertCompSchema>;

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
