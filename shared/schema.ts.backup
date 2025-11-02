import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, jsonb, pgEnum, primaryKey, unique, index, customType, decimal } from "drizzle-orm/pg-core";
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
  requiresDecision: boolean("requires_decision").notNull().default(false), // Task needs a decision point
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

// Project Contacts (Join table for associating contacts with projects)
export const projectContacts = pgTable("project_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  role: contactRoleEnum("role").notNull(), // Role for this specific project
  customRole: text("custom_role"), // Custom role/position when role is "other"
  projectNotes: text("project_notes"), // Project-specific notes about this contact
  isPrimary: boolean("is_primary").notNull().default(false), // Is this the primary contact for this role?
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    // Ensure a contact can only have one instance per project with the same role
    uniqueProjectContactRole: unique("unique_project_contact_role").on(table.projectId, table.contactId, table.role),
    projectIdx: index("project_contacts_project").on(table.projectId),
    contactIdx: index("project_contacts_contact").on(table.contactId),
  };
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

export const insertProjectContactSchema = createInsertSchema(projectContacts).omit({
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

export type ProjectContact = typeof projectContacts.$inferSelect;
export type InsertProjectContact = z.infer<typeof insertProjectContactSchema>;

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

// ============================================================================
// CRM SCHEMA - Converted from UUID to VARCHAR for compatibility
// ============================================================================


export const crmCompanies = pgTable("crm_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  domain: text("domain"),
  industry: text("industry"),
  size: text("size"),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  description: text("description"),
  labels: text("labels").array().default(sql`ARRAY[]::text[]`),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Contacts table

export const crmContacts = pgTable("crm_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  position: text("position"),
  address: text("address"), // Street address
  unit: text("unit"), // Unit/Suite/Apt number
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  company: text("company"), // Free-form company name field
  role: text("role"), // Job role/title
  onDealTeam: boolean("on_deal_team").default(false),
  dealTeamNotes: text("deal_team_notes"),
  dealAssignment: varchar("deal_assignment").references(() => crmDeals.id), // Which deal this contact is assigned to
  contactType: text("contact_type").default('prospect'), // prospect, vendor, buyer, seller, partner, client
  photoDataUrl: text("photo_data_url"), // Base64 encoded photo
  leadScore: text("lead_score").default('new'), // hot, warm, cold, new
  labels: text("labels").array().default(sql`ARRAY[]::text[]`),
  companyId: varchar("company_id").references(() => crmCompanies.id), // Legacy field for backward compatibility
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Junction table for many-to-many relationship between contacts and companies

export const crmContactCompanies = pgTable("crm_contact_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => crmContacts.id).notNull(),
  companyId: varchar("company_id").references(() => crmCompanies.id).notNull(),
  role: text("role"), // Optional role of contact in this company (e.g., "CEO", "Manager", "Employee")
  isPrimary: boolean("is_primary").default(false), // Indicates if this is the primary company for the contact
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction table for many-to-many relationship between companies and properties

export const crmCompanyProperties = pgTable("crm_company_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => crmCompanies.id).notNull(),
  propertyId: varchar("property_id").references(() => crmProperties.id).notNull(),
  relationship: text("relationship"), // Optional relationship type (e.g., "Owner", "Tenant", "Buyer", "Seller")
  notes: text("notes"), // Optional notes about the relationship
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction table for many-to-many relationship between contacts and properties

export const crmContactProperties = pgTable("crm_contact_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => crmContacts.id).notNull(),
  propertyId: varchar("property_id").references(() => crmProperties.id).notNull(),
  relationship: text("relationship"), // Optional relationship type (e.g., "Buyer", "Seller", "Agent", "Interested Party")
  notes: text("notes"), // Optional notes about the relationship
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Labels table for categorizing contacts and organizations

export const crmContactsLabels = pgTable("crm_contacts_labels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // Slug/identifier (e.g., 'owner', 'broker', 'investor')
  name: text("name").notNull(), // Display name (e.g., 'Owner', 'Broker', 'Investor')
  color: text("color").notNull().default('#6366f1'), // Hex color code for UI display
  scope: text("scope").notNull().default('both'), // 'person', 'organization', 'both'
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Properties table

export const crmProperties = pgTable("crm_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type").notNull().default('marina'), // marina, boat, slip, dry_storage
  status: text("status").notNull().default('available'), // available, under_contract, sold, off_market
  listingPrice: decimal("listing_price", { precision: 12, scale: 2 }),
  address: text("address"),
  coordinates: jsonb("coordinates"), // { lat: number, lng: number }
  specifications: jsonb("specifications").default({}), // marina/boat specific details
  description: text("description"),
  images: jsonb("images").default([]),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  listingAgentId: varchar("listing_agent_id").references(() => crmContacts.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Leads table (separate from contacts for better lead management)

export const crmLeads = pgTable("crm_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  jobTitle: text("job_title"),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  leadScore: integer("lead_score").default(0),
  prospectStatus: text("prospect_status").notNull().default('active'), // active, target, referral, past_client, cold, nurture
  leadStatus: text("lead_status").notNull().default('new'), // new, contacted, qualified, unqualified, converted
  
  // Enhanced Source Tracking and Attribution
  leadSource: text("lead_source").notNull().default('unknown'), // google_ads, facebook_ads, email, direct, referral, organic_search, social, phone, website_form
  leadSourceDetails: text("lead_source_details"),
  originalSource: text("original_source"), // First-touch attribution source
  lastTouchSource: text("last_touch_source"), // Last-touch attribution source
  
  // UTM Parameters for Campaign Tracking
  utmSource: text("utm_source"), // utm_source parameter
  utmMedium: text("utm_medium"), // utm_medium parameter
  utmCampaign: text("utm_campaign"), // utm_campaign parameter
  utmTerm: text("utm_term"), // utm_term parameter
  utmContent: text("utm_content"), // utm_content parameter
  
  // Landing and Referral Tracking
  landingPageUrl: text("landing_page_url"), // First page visited
  referrerUrl: text("referrer_url"), // Where they came from
  currentPageUrl: text("current_page_url"), // Page where lead was captured
  
  // Campaign and Channel Attribution
  campaignId: varchar("campaign_id").references(() => crmCampaigns.id), // Associated marketing campaign
  channelType: text("channel_type"), // organic, paid, direct, referral, social, email
  adGroupId: text("ad_group_id"), // For paid advertising
  keywordId: text("keyword_id"), // For search campaigns
  
  // Session and Interaction Tracking
  sessionId: text("session_id"), // Unique session identifier
  visitCount: integer("visit_count").default(1), // Number of visits before converting
  firstVisitDate: timestamp("first_visit_date"), // First time they visited
  lastVisitDate: timestamp("last_visit_date"), // Most recent visit
  timeToConversion: integer("time_to_conversion"), // Minutes from first visit to lead
  touchpoints: jsonb("touchpoints").default([]), // Array of all touchpoints before conversion
  
  // Geographic and Device Information
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"), // desktop, mobile, tablet
  browserInfo: text("browser_info"),
  geolocation: jsonb("geolocation").default({}), // { country, region, city, timezone }
  
  tags: jsonb("tags").default([]),
  notes: text("notes"),
  customFields: jsonb("custom_fields").default({}),
  lastActivityDate: timestamp("last_activity_date"),
  convertedContactId: varchar("converted_contact_id").references(() => crmContacts.id),
  convertedDate: timestamp("converted_date"),
  assignedToId: varchar("assigned_to_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Marketing Campaigns table

export const crmCampaigns = pgTable("crm_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default('email'), // email, social, advertisement, webinar, event
  status: text("status").notNull().default('draft'), // draft, active, paused, completed
  description: text("description"),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  spent: decimal("spent", { precision: 12, scale: 2 }).default('0'),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  targetAudience: jsonb("target_audience").default({}),
  metrics: jsonb("metrics").default({}), // opens, clicks, conversions, etc.
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email Sequences/Templates

export const crmEmailSequences = pgTable("crm_email_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  triggerEvent: text("trigger_event").notNull(), // lead_created, lead_scored, deal_stage_changed, etc.
  delayDays: integer("delay_days").default(0),
  emailTemplateId: varchar("email_template_id").references(() => crmEmailTemplates.id),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const crmEmailTemplates = pgTable("crm_email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default('nurture'), // nurture, follow_up, welcome, promotional
  isActive: boolean("is_active").default(true),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Territory Management

export const crmTerritories = pgTable("crm_territories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  criteria: jsonb("criteria").default({}), // geographic, industry, company size criteria
  managerId: varchar("manager_id").references(() => users.id).notNull(),
  members: jsonb("members").default([]), // user IDs
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Accounts (enhanced companies with hierarchy)

export const crmAccounts = pgTable("crm_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  parentAccountId: varchar("parent_account_id"),
  type: text("type").notNull().default('prospect'), // prospect, customer, partner, competitor
  industry: text("industry"),
  annualRevenue: decimal("annual_revenue", { precision: 15, scale: 2 }),
  employeeCount: integer("employee_count"),
  website: text("website"),
  phone: text("phone"),
  billingAddress: jsonb("billing_address").default({}),
  shippingAddress: jsonb("shipping_address").default({}),
  description: text("description"),
  tags: jsonb("tags").default([]),
  customFields: jsonb("custom_fields").default({}),
  accountScore: integer("account_score").default(0),
  territoryId: varchar("territory_id").references(() => crmTerritories.id),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Deal stages enum
export const dealStageEnum = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const;

// Enhanced Deals/Opportunities table

export const crmDeals = pgTable("crm_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  value: decimal("value", { precision: 12, scale: 2 }),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  // Pipeline & Stage Management (Pipedrive-like) - nullable for backward compatibility
  pipelineId: varchar("pipeline_id").references(() => crmPipelines.id),
  stageId: varchar("stage_id").references(() => crmPipelineStages.id),
  stageOrder: integer("stage_order").default(0), // position within stage for drag & drop
  // Legacy stage field for backward compatibility
  stage: text("stage").notNull().default('lead'),
  probability: integer("probability").default(10), // 0-100 percentage
  priority: text("priority").notNull().default('medium'), // low, medium, high, critical
  expectedCloseDate: timestamp("expected_close_date"),
  leadSource: text("lead_source"),
  lastActivityDate: timestamp("last_activity_date"),
  daysInCurrentStage: integer("days_in_current_stage").default(0),
  currentStageEnteredAt: timestamp("current_stage_entered_at").defaultNow(),
  lostReason: text("lost_reason"),
  competitorId: varchar("competitor_id"),
  forecastCategory: text("forecast_category"),
  // Commission Tracking
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }), // percentage (e.g., 3.50 for 3.5%)
  commissionType: text("commission_type").default('percentage'), // percentage, fixed, tiered
  dealSource: text("deal_source"), // inbound, outbound, referral, partner, organic
  sourceDetails: jsonb("source_details").default({}), // Additional source metadata
  // Marina-specific fields
  marinaName: text("marina_name"),
  slipNumber: text("slip_number"),
  dockLocation: text("dock_location"),
  boatName: text("boat_name"),
  boatMake: text("boat_make"),
  boatModel: text("boat_model"),
  boatYear: integer("boat_year"),
  boatLength: decimal("boat_length", { precision: 6, scale: 2 }), // in feet
  boatType: text("boat_type"), // sailboat, powerboat, yacht, etc.
  propertyType: text("property_type"), // slip, boat, mooring, dry_storage
  leaseTermMonths: integer("lease_term_months"),
  // Property Details - comprehensive marina property information from OMs
  propertyDetails: jsonb("property_details").default({}), // Structured property data including capacity, equipment, financials, location, etc.
  // Relationships - matching actual database structure
  leadId: varchar("lead_id"),
  accountId: varchar("account_id"),
  primaryContactId: varchar("primary_contact_id"),
  campaignId: varchar("campaign_id"),
  contactId: varchar("contact_id"), // Legacy column
  companyId: varchar("company_id"), // Legacy column  
  // Team members
  referralAgentId: varchar("referral_agent_id").references(() => crmContacts.id), // External referring agent
  transactionCoordinatorId: varchar("transaction_coordinator_id").references(() => users.id), // Internal TC
  ownerId: varchar("owner_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Products table - for revenue tracking

export const crmProducts = pgTable("crm_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code"), // product SKU or code
  description: text("description"),
  unit: text("unit").default('unit'), // unit, hour, month, year, etc.
  price: decimal("price", { precision: 12, scale: 2 }).notNull().default('0'),
  cost: decimal("cost", { precision: 12, scale: 2 }),
  category: text("category"), // Service, Product, License, etc.
  isActive: boolean("is_active").default(true),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Deal Products junction table - for associating products with deals and tracking recurring revenue

export const crmDealProducts = pgTable("crm_deal_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => crmDeals.id).notNull(),
  productId: varchar("product_id").references(() => crmProducts.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(), // price at time of deal
  discount: decimal("discount", { precision: 5, scale: 2 }).default('0'), // percentage discount
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
  isRecurring: boolean("is_recurring").default(false),
  billingCycle: text("billing_cycle"), // monthly, quarterly, annually
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notes table - structured notes that can be attached to any entity

export const crmNotes = pgTable("crm_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").default(false),
  entityType: text("entity_type").notNull(), // deal, contact, company, property, lead, etc.
  entityId: varchar("entity_id").notNull(),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  ownerId: varchar("owner_id").references(() => users.id).notNull(), // for multi-tenant access control
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Files table - file attachments that can be associated with any entity

export const crmFiles = pgTable("crm_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // display name
  fileName: text("file_name").notNull(), // actual file name with extension
  size: integer("size").notNull(), // file size in bytes
  mimeType: text("mime_type").notNull(), // e.g., 'application/pdf', 'image/jpeg'
  url: text("url").notNull(), // file URL or path
  entityType: text("entity_type").notNull(), // deal, contact, company, property, lead, etc.
  entityId: varchar("entity_id").notNull(),
  uploadedById: varchar("uploaded_by_id").references(() => users.id).notNull(),
  ownerId: varchar("owner_id").references(() => users.id).notNull(), // for multi-tenant access control
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Contact Roles table - defines relationships between contacts and deals

export const crmContactRoles = pgTable("crm_contact_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => crmDeals.id).notNull(),
  contactId: varchar("contact_id").references(() => crmContacts.id).notNull(),
  role: text("role").notNull().default('buyer'), // buyer, seller, listing_agent, buyer_agent, co_buyer, decision_maker
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tasks table

export const crmActivities = pgTable("crm_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // call, email, sms, meeting, showing, note, mail, document, website_visit, social_media, form_submission
  subject: text("subject"),
  description: text("description").notNull(),
  direction: text("direction"), // inbound, outbound
  duration: integer("duration"), // minutes for calls/meetings
  outcome: text("outcome"),
  status: text("status").default('completed'), // scheduled, in_progress, completed, cancelled
  entityType: text("entity_type").notNull(), // lead, contact, deal, account, property, campaign
  entityId: varchar("entity_id"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  campaignId: varchar("campaign_id").references(() => crmCampaigns.id),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata"), // phone number, email subject, document URL, page visited, social platform, etc.
  score: integer("score").default(0), // activity scoring for lead qualification
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Activity Templates for quick activity creation

export const crmActivityTemplates = pgTable("crm_activity_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // call, email, sms, meeting, showing, note
  subjectTemplate: text("subject_template"),
  descriptionTemplate: text("description_template"),
  defaultDuration: integer("default_duration"), // minutes
  defaultDirection: text("default_direction"), // inbound, outbound
  isGlobal: boolean("is_global").default(false), // true for system templates, false for user templates
  userId: varchar("user_id").references(() => users.id), // null for global templates
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Prospecting entries for weekly tracking

export const crmProspectingEntries = pgTable("crm_prospecting_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  year: integer("year").notNull(),
  quarter: integer("quarter").notNull(), // 1, 2, 3, 4
  weekNumber: integer("week_number").notNull(), // 1-13 within quarter
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  
  // Weekly goals (up to 6 goals)
  goals: jsonb("goals").default([]), // Array of string goals
  
  // Enabled days of the week for this prospecting week
  enabledDays: jsonb("enabled_days").default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']), // Array of enabled day IDs
  
  // Daily activities tracking (Monday-Friday)
  dailyActivities: jsonb("daily_activities").default({}), // { monday: [], tuesday: [], etc. }
  
  // Summary metrics
  totalLeadGeneration: integer("total_lead_generation").default(0),
  totalCalls: integer("total_calls").default(0),
  totalEmails: integer("total_emails").default(0),
  totalMeetings: integer("total_meetings").default(0),
  
  // Reflection notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Prospecting Activities for detailed daily tracking

export const crmProspectingActivities = pgTable("crm_prospecting_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  prospectingEntryId: varchar("prospecting_entry_id").references(() => crmProspectingEntries.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Activity details
  activityType: text("activity_type").notNull(), // 'call', 'voicemail', 'no_answer', 'not_interested', 'text', 'linkedin', 'email', 'meeting'
  outcome: text("outcome").notNull(), // 'connected', 'left_voicemail', 'no_answer', 'not_interested', 'callback_requested', 'meeting_scheduled', 'sent', 'opened', 'replied'
  
  // Timing
  dayOfWeek: text("day_of_week").notNull(), // 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'
  activityDate: timestamp("activity_date").notNull(),
  duration: integer("duration"), // in minutes for calls/meetings
  
  // Linking to CRM entities
  contactId: varchar("contact_id").references(() => crmContacts.id),
  dealId: varchar("deal_id").references(() => crmDeals.id),
  
  // Activity details
  notes: text("notes"),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  
  // Tracking metadata
  phoneNumber: text("phone_number"), // for call activities
  emailAddress: text("email_address"), // for email activities
  linkedinProfile: text("linkedin_profile"), // for linkedin activities
  subject: text("subject"), // for emails/messages
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email Communications (for email tracking)

export const crmEmailCommunications = pgTable("crm_email_communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  ccEmails: jsonb("cc_emails").default([]),
  bccEmails: jsonb("bcc_emails").default([]),
  status: text("status").notNull().default('sent'), // draft, sent, delivered, opened, clicked, bounced, failed
  isTemplateUsed: boolean("is_template_used").default(false),
  templateId: varchar("template_id").references(() => crmEmailTemplates.id),
  sequenceId: varchar("sequence_id").references(() => crmEmailSequences.id),
  leadId: varchar("lead_id").references(() => crmLeads.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  dealId: varchar("deal_id").references(() => crmDeals.id),
  campaignId: varchar("campaign_id").references(() => crmCampaigns.id),
  sentById: varchar("sent_by_id").references(() => users.id).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  metadata: jsonb("metadata").default({}), // tracking pixels, links clicked, etc.
});

// Lead/Contact Scoring Rules

export const crmScoringRules = pgTable("crm_scoring_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  triggerEvent: text("trigger_event").notNull(), // email_opened, form_submitted, page_visited, etc.
  conditions: jsonb("conditions").notNull(), // criteria for scoring
  points: integer("points").notNull(),
  isActive: boolean("is_active").default(true),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Website Visitor Tracking

export const crmWebsiteVisitors = pgTable("crm_website_visitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitorId: text("visitor_id").notNull(), // anonymous tracking ID or known contact ID
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  location: jsonb("location").default({}), // country, city, etc.
  pageUrl: text("page_url").notNull(),
  pageTitle: text("page_title"),
  referrerUrl: text("referrer_url"),
  sessionDuration: integer("session_duration"), // seconds
  leadId: varchar("lead_id").references(() => crmLeads.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  campaignId: varchar("campaign_id").references(() => crmCampaigns.id),
  visitedAt: timestamp("visited_at").defaultNow().notNull(),
});

// Lead Scoring Events - Track all behavioral events for scoring

export const crmLeadScoringEvents = pgTable("crm_lead_scoring_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => crmLeads.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  
  // Event Details
  eventType: text("event_type").notNull(), // page_visit, email_open, email_click, form_submit, call_made, meeting_attended, etc.
  eventCategory: text("event_category").notNull(), // behavioral, engagement, demographic, marina_specific
  eventAction: text("event_action").notNull(), // specific action taken
  eventLabel: text("event_label"), // additional context
  eventValue: integer("event_value"), // numeric value if applicable
  
  // Scoring Impact
  pointsAwarded: integer("points_awarded").default(0),
  scoringRuleId: varchar("scoring_rule_id").references(() => crmScoringRules.id),
  
  // Event Context
  entityType: text("entity_type"), // deal, property, campaign, form, etc.
  entityId: varchar("entity_id"),
  sessionId: text("session_id"),
  
  // Event Metadata
  metadata: jsonb("metadata").default({}), // flexible JSON for event-specific data
  
  // Marina/Boat Specific Context
  boatType: text("boat_type"), // sailboat, powerboat, yacht, catamaran
  marinaService: text("marina_service"), // slip_rental, maintenance, storage, fuel
  priceRange: text("price_range"), // under_50k, 50k_100k, 100k_250k, 250k_500k, over_500k
  location: text("location"), // marina or boat location
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Lead Scoring History - Track score changes over time

export const crmLeadScoringHistory = pgTable("crm_lead_scoring_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => crmLeads.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  
  // Score Change Details
  previousScore: integer("previous_score").default(0),
  newScore: integer("new_score").notNull(),
  scoreDelta: integer("score_delta").notNull(), // positive or negative change
  
  // Score Temperature Classification
  previousTemperature: text("previous_temperature"), // hot, warm, cold
  newTemperature: text("new_temperature").notNull(), // hot, warm, cold
  
  // Change Trigger
  triggerEventId: varchar("trigger_event_id").references(() => crmLeadScoringEvents.id),
  triggerEventType: text("trigger_event_type").notNull(),
  changeReason: text("change_reason"), // rule_triggered, manual_adjustment, decay_applied, bulk_update
  
  // Scoring Context
  scoringRuleId: varchar("scoring_rule_id").references(() => crmScoringRules.id),
  userId: varchar("user_id").references(() => users.id), // if manual change
  
  // Metadata
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Lead Engagement Metrics - Calculated engagement patterns

export const crmLeadEngagementMetrics = pgTable("crm_lead_engagement_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => crmLeads.id).notNull(),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  
  // Email Engagement
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  emailOpenRate: decimal("email_open_rate", { precision: 5, scale: 4 }).default('0'),
  emailClickRate: decimal("email_click_rate", { precision: 5, scale: 4 }).default('0'),
  
  // Website Engagement
  pageVisits: integer("page_visits").default(0),
  uniquePageVisits: integer("unique_page_visits").default(0),
  totalTimeOnSite: integer("total_time_on_site").default(0), // seconds
  averageSessionDuration: integer("average_session_duration").default(0), // seconds
  bounceRate: decimal("bounce_rate", { precision: 5, scale: 4 }).default('0'),
  
  // Form Engagement
  formsViewed: integer("forms_viewed").default(0),
  formsStarted: integer("forms_started").default(0),
  formsCompleted: integer("forms_completed").default(0),
  formCompletionRate: decimal("form_completion_rate", { precision: 5, scale: 4 }).default('0'),
  
  // Communication Response
  callsReceived: integer("calls_received").default(0),
  callsAnswered: integer("calls_answered").default(0),
  callAnswerRate: decimal("call_answer_rate", { precision: 5, scale: 4 }).default('0'),
  averageResponseTime: integer("average_response_time").default(0), // minutes
  
  // Meeting Engagement
  meetingsScheduled: integer("meetings_scheduled").default(0),
  meetingsAttended: integer("meetings_attended").default(0),
  meetingAttendanceRate: decimal("meeting_attendance_rate", { precision: 5, scale: 4 }).default('0'),
  
  // Overall Engagement Score
  engagementScore: decimal("engagement_score", { precision: 5, scale: 2 }).default('0'), // 0-100
  engagementTrend: text("engagement_trend").default('stable'), // increasing, decreasing, stable
  
  // Recency Metrics
  lastEmailOpen: timestamp("last_email_open"),
  lastWebsiteVisit: timestamp("last_website_visit"),
  lastFormSubmission: timestamp("last_form_submission"),
  lastCommunication: timestamp("last_communication"),
  
  // Activity Level
  activityLevel: text("activity_level").default('low'), // high, medium, low
  daysSinceLastActivity: integer("days_since_last_activity").default(0),
  
  // Calculation Metadata
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  calculationPeriod: integer("calculation_period").default(30), // days
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Marina Specific Lead Data - Industry-specific lead information

export const crmMarinaLeadData = pgTable("crm_marina_lead_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => crmLeads.id).notNull(),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  
  // Boat Ownership & Interest
  currentBoatOwner: boolean("current_boat_owner").default(false),
  boatOwnershipExperience: text("boat_ownership_experience"), // first_time, experienced, expert
  interestedBoatTypes: jsonb("interested_boat_types").default([]), // sailboat, powerboat, yacht, etc.
  budgetRange: text("budget_range"), // under_50k, 50k_100k, 100k_250k, 250k_500k, over_500k
  
  // Marina Services Interest
  servicesNeeded: jsonb("services_needed").default([]), // slip_rental, maintenance, storage, fuel, etc.
  preferredMarinaSize: text("preferred_marina_size"), // small, medium, large, megayacht
  preferredAmenities: jsonb("preferred_amenities").default([]), // restaurant, pool, security, etc.
  
  // Location & Geographic Preferences
  preferredRegions: jsonb("preferred_regions").default([]), // geographic areas
  maxDistanceFromHome: integer("max_distance_from_home"), // miles
  seasonalUsage: text("seasonal_usage"), // year_round, seasonal, occasional
  
  // Purchase Timeline & Intent
  purchaseTimeline: text("purchase_timeline"), // immediate, 3_months, 6_months, 1_year, exploring
  purchaseType: text("purchase_type"), // buy, lease, rent, charter
  hasFinancing: boolean("has_financing").default(false),
  tradeInVehicle: boolean("trade_in_vehicle").default(false),
  
  // Industry Role & Expertise
  industryRole: text("industry_role"), // boat_owner, marina_manager, yacht_broker, boat_dealer, service_provider
  boatingExperience: text("boating_experience"), // beginner, intermediate, advanced, professional
  certifications: jsonb("certifications").default([]), // captain_license, sailing_certification, etc.
  
  // Event & Show Attendance
  boatShowAttendance: jsonb("boat_show_attendance").default([]), // recent boat shows attended
  marinaEventInterest: jsonb("marina_event_interest").default([]), // types of events interested in
  
  // Referral & Social Proof
  referralSource: text("referral_source"), // friend, family, broker, online, advertisement
  socialProofFactors: jsonb("social_proof_factors").default([]), // reviews_reader, brand_conscious, etc.
  
  // Scoring Multipliers (Marina-specific scoring factors)
  locationScoreMultiplier: decimal("location_score_multiplier", { precision: 3, scale: 2 }).default('1.0'),
  seasonalityMultiplier: decimal("seasonality_multiplier", { precision: 3, scale: 2 }).default('1.0'),
  budgetQualificationScore: integer("budget_qualification_score").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pipelines table (Pipedrive-like pipeline management)

export const crmPipelines = pgTable("crm_pipelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  color: text("color").default('#3B82F6'),
  type: text("type").notNull().default('sales'), // sales, marketing, service, marina_sales, boat_sales
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pipeline Stages (configurable stages with pipeline association)

export const crmPipelineStages = pgTable("crm_pipeline_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pipelineId: varchar("pipeline_id").references(() => crmPipelines.id),
  name: text("name").notNull(),
  description: text("description"),
  stageOrder: integer("stage_order").notNull(),
  probability: integer("probability").default(0), // default win probability %
  isActive: boolean("is_active").default(true),
  color: text("color").default('#3B82F6'),
  // Legacy field for backward compatibility
  pipelineType: text("pipeline_type").notNull().default('sales'), // sales, marketing, service
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Deal History table (audit trail for drag & drop and field changes)

export const crmDealHistory = pgTable("crm_deal_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => crmDeals.id).notNull(),
  field: text("field").notNull(), // stage, value, owner, etc.
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value").notNull(),
  changeType: text("change_type").notNull(), // update, stage_move, create, delete
  changedById: varchar("changed_by_id").references(() => users.id).notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  metadata: jsonb("metadata").default({}), // additional context like drag & drop positions
});

// Workflows table

export const crmWorkflows = pgTable("crm_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  
  // Trigger configuration - when to execute this workflow
  // Examples: { type: 'deal_stage_changed', stageId: 'uuid', pipelineId: 'uuid' }
  //           { type: 'label_added', labelId: 'uuid', entityType: 'contact' }
  //           { type: 'field_updated', entityType: 'deal', field: 'value' }
  //           { type: 'deal_created', pipelineId: 'uuid' }
  trigger: jsonb("trigger").notNull(),
  
  // Conditions - when to proceed with actions (optional)
  // Examples: [{ field: 'value', operator: 'greater_than', value: 10000 }]
  //           [{ field: 'status', operator: 'equals', value: 'qualified' }]
  conditions: jsonb("conditions").default([]),
  
  // Actions - what to execute when triggered and conditions pass
  // Examples: [{ type: 'send_email', templateId: 'uuid', to: 'contact_email' }]
  //           [{ type: 'create_task', title: 'Follow up', assigneeId: 'uuid' }]
  //           [{ type: 'add_label', labelId: 'uuid' }]
  //           [{ type: 'update_field', field: 'priority', value: 'high' }]
  //           [{ type: 'webhook', url: 'https://...', method: 'POST' }]
  actions: jsonb("actions").notNull(),
  
  isActive: boolean("is_active").default(true),
  triggerCount: integer("trigger_count").default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Webhooks table - stores webhook subscriptions

export const crmWebhooks = pgTable("crm_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  method: text("method").notNull().default('POST'), // POST, GET, PUT, PATCH, DELETE
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  
  // Events to subscribe to
  // Examples: ['deal.created', 'deal.updated', 'contact.created', 'lead.converted']
  events: jsonb("events").notNull().default([]),
  
  // Headers to send with the webhook (for authentication, etc.)
  headers: jsonb("headers").default({}),
  
  // Secret for signature verification (optional)
  secret: text("secret"),
  
  isActive: boolean("is_active").default(true),
  
  // Statistics
  totalCalls: integer("total_calls").default(0),
  successfulCalls: integer("successful_calls").default(0),
  failedCalls: integer("failed_calls").default(0),
  lastCalledAt: timestamp("last_called_at"),
  lastStatus: integer("last_status"), // HTTP status code
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Webhook Logs table - stores webhook call history

export const crmWebhookLogs = pgTable("crm_webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookId: varchar("webhook_id").references(() => crmWebhooks.id, { onDelete: 'cascade' }).notNull(),
  
  event: text("event").notNull(), // e.g., 'deal.created'
  payload: jsonb("payload").notNull(), // Data sent to the webhook
  
  // Response data
  statusCode: integer("status_code"), // HTTP status code
  responseBody: text("response_body"), // Response from the webhook
  responseTime: integer("response_time"), // Time in milliseconds
  
  // Error information
  errorMessage: text("error_message"),
  
  success: boolean("success").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Conversations table - stores AI advisor conversation sessions

export const crmAiConversations = pgTable("crm_ai_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  
  // Conversation metadata
  title: text("title"), // Optional title for the conversation
  
  // Context - what the user was viewing when they started the conversation
  contextType: text("context_type"), // 'deal', 'contact', 'company', 'property', 'general'
  contextId: varchar("context_id"), // ID of the entity they were viewing
  contextData: jsonb("context_data"), // Snapshot of context data
  
  // Settings
  provider: text("provider").notNull().default('openai'), // 'openai' or 'anthropic'
  model: text("model").default('gpt-4o'), // Model used
  
  // Status
  isActive: boolean("is_active").default(true),
  lastMessageAt: timestamp("last_message_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Messages table - stores individual messages in conversations

export const crmAiMessages = pgTable("crm_ai_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => crmAiConversations.id, { onDelete: 'cascade' }).notNull(),
  
  // Message content
  role: text("role").notNull(), // 'user', 'assistant', 'system', 'function'
  content: text("content"), // Message text content
  
  // Function calling
  functionCall: jsonb("function_call"), // { name: string, arguments: string }
  functionResult: jsonb("function_result"), // Result of function execution
  toolCalls: jsonb("tool_calls"), // Array of tool calls (for multi-tool calls)
  toolResults: jsonb("tool_results"), // Array of tool results
  
  // Metadata
  tokenCount: integer("token_count"), // Approximate token count
  model: text("model"), // Model used for this message
  finishReason: text("finish_reason"), // 'stop', 'length', 'function_call', 'tool_calls'
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Dedupe Rules table - stores rules for detecting duplicate records

export const crmDedupeRules = pgTable("crm_dedupe_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Descriptive name for the rule
  entityType: text("entity_type").notNull(), // 'contact', 'company', 'lead'
  
  // Matching configuration
  matchFields: jsonb("match_fields").notNull(), // Array of field names to match on, e.g., ['email'] or ['firstName', 'lastName']
  matchStrategy: text("match_strategy").notNull().default('exact'), // 'exact', 'fuzzy', 'contains'
  caseSensitive: boolean("case_sensitive").default(false),
  
  // Merge behavior
  autoMerge: boolean("auto_merge").default(false), // Whether to automatically merge or just flag for review
  priorityField: text("priority_field"), // Field to determine which record to keep (e.g., 'createdAt', 'updatedAt', 'leadScore')
  priorityOrder: text("priority_order").default('desc'), // 'asc' or 'desc'

  // Status
  isActive: boolean("is_active").default(true),

  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Merge History table - tracks all merged records for audit trail

export const crmMergeHistory = pgTable("crm_merge_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(), // 'contact', 'company', 'lead'
  
  // Merge details
  primaryRecordId: varchar("primary_record_id").notNull(), // The record that was kept
  mergedRecordIds: jsonb("merged_record_ids").notNull(), // Array of UUIDs that were merged into primary
  
  // Field-level merge details
  fieldsMerged: jsonb("fields_merged"), // JSON of which fields were taken from which record
  conflictResolutions: jsonb("conflict_resolutions"), // How conflicts were resolved
  
  // Merge metadata
  mergedBy: varchar("merged_by").references(() => users.id).notNull(),
  mergedAt: timestamp("merged_at").defaultNow().notNull(),
  dedupeRuleId: varchar("dedupe_rule_id").references(() => crmDedupeRules.id), // Optional - if triggered by a rule
  
  // Undo capability
  canUndo: boolean("can_undo").default(true),
  undoneAt: timestamp("undone_at"),
  undoneBy: varchar("undone_by").references(() => users.id),
  
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
});

// Forms System Tables

// Forms table - stores form definitions and configuration

export const crmForms = pgTable("crm_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default('contact'), // contact, demo, newsletter, property_inquiry, boat_inquiry, quote, download
  status: text("status").notNull().default('draft'), // draft, active, paused, archived
  
  // Form Configuration
  title: text("title"), // Display title on the form
  subtitle: text("subtitle"), // Form description/subtitle
  thankYouMessage: text("thank_you_message").default('Thank you for your submission!'),
  redirectUrl: text("redirect_url"), // Redirect after submission
  submitButtonText: text("submit_button_text").default('Submit'),
  
  // Form Settings
  requiresApproval: boolean("requires_approval").default(false),
  allowMultipleSubmissions: boolean("allow_multiple_submissions").default(true),
  captchaEnabled: boolean("captcha_enabled").default(false),
  progressBar: boolean("progress_bar").default(false),
  
  // Styling and Layout
  theme: text("theme").default('default'), // default, marina, boat, modern, minimal
  primaryColor: text("primary_color").default('#3B82F6'),
  backgroundColor: text("background_color").default('#FFFFFF'),
  fontFamily: text("font_family").default('Inter'),
  customCss: text("custom_css"),
  layout: text("layout").default('single_column'), // single_column, two_column, wizard
  
  // SEO and Meta
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  socialImage: text("social_image"),
  
  // Lead Routing and Automation
  autoAssignUser: varchar("auto_assign_user").references(() => users.id),
  leadScore: integer("lead_score").default(0), // Base score for form submissions
  followUpSequenceId: varchar("follow_up_sequence_id").references(() => crmEmailSequences.id),
  notificationEmails: jsonb("notification_emails").default([]), // Array of email addresses
  
  // A/B Testing
  isTestVariant: boolean("is_test_variant").default(false),
  parentFormId: varchar("parent_form_id"), // Reference to original form for A/B testing
  testSplitPercentage: integer("test_split_percentage").default(50), // 0-100
  
  // Analytics and Performance
  submissionCount: integer("submission_count").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 4 }).default('0'), // Percentage as decimal
  averageCompletionTime: integer("average_completion_time").default(0), // Seconds
  
  // Marina/Boat Specific Settings
  propertyType: text("property_type"), // marina, boat, slip, dry_storage (for property inquiry forms)
  inquiryType: text("inquiry_type"), // buy, sell, rent, service, financing
  targetBudgetRange: jsonb("target_budget_range").default({}), // { min: number, max: number }
  
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Form Fields table - stores individual field configurations

export const crmFormFields = pgTable("crm_form_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").references(() => crmForms.id, { onDelete: 'cascade' }).notNull(),
  
  // Field Configuration
  fieldType: text("field_type").notNull(), // text, email, phone, number, select, checkbox, radio, textarea, date, file, hidden
  fieldName: text("field_name").notNull(), // Field identifier/key
  label: text("label").notNull(),
  placeholder: text("placeholder"),
  helpText: text("help_text"),
  defaultValue: text("default_value"),
  
  // Validation Rules
  required: boolean("required").default(false),
  minLength: integer("min_length"),
  maxLength: integer("max_length"),
  pattern: text("pattern"), // Regex pattern for validation
  validationMessage: text("validation_message"),
  
  // Field Options (for select, radio, checkbox)
  options: jsonb("options").default([]), // Array of {label: string, value: string, score?: number}
  allowOther: boolean("allow_other").default(false),
  
  // Layout and Display
  fieldOrder: integer("field_order").notNull(),
  width: text("width").default('full'), // full, half, third, quarter
  cssClasses: text("css_classes"),
  isConditional: boolean("is_conditional").default(false),
  conditionalLogic: jsonb("conditional_logic").default({}), // Show/hide based on other fields
  
  // Lead Scoring
  scoreWeight: integer("score_weight").default(0), // Points for completion
  optionScoring: jsonb("option_scoring").default({}), // Different scores for different options
  
  // Marina/Boat Specific Fields
  boatSpecField: text("boat_spec_field"), // length, type, year, make, model, price_range
  marinaSpecField: text("marina_spec_field"), // slip_size, amenities, location_preference
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Form Submissions table - tracks all form submissions with analytics

export const crmFormSubmissions = pgTable("crm_form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").references(() => crmForms.id).notNull(),
  
  // Submission Data
  submissionData: jsonb("submission_data").notNull(), // All form field values
  leadId: varchar("lead_id").references(() => crmLeads.id), // Created lead (if applicable)
  contactId: varchar("contact_id").references(() => crmContacts.id), // Existing contact (if found)
  
  // Session and Attribution Data
  sessionId: text("session_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"), // desktop, mobile, tablet
  browserInfo: text("browser_info"),
  
  // UTM and Source Tracking
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  referrerUrl: text("referrer_url"),
  landingPageUrl: text("landing_page_url"),
  
  // Form Analytics
  startedAt: timestamp("started_at"), // When user first interacted with form
  completionTime: integer("completion_time"), // Seconds to complete
  fieldInteractions: jsonb("field_interactions").default([]), // Array of field interaction events
  abandonedAt: timestamp("abandoned_at"), // If form was abandoned
  abandonedAtField: text("abandoned_at_field"), // Which field caused abandonment
  
  // Lead Qualification
  calculatedScore: integer("calculated_score").default(0),
  qualificationStatus: text("qualification_status").default('unqualified'), // unqualified, marketing_qualified, sales_qualified
  
  // Geographic Information
  geolocation: jsonb("geolocation").default({}), // { country, region, city, timezone }
  
  // Processing Status
  status: text("status").default('pending'), // pending, processed, error
  processingErrors: jsonb("processing_errors").default([]),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Landing Pages table - stores landing page templates and configurations

export const crmLandingPages = pgTable("crm_landing_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // URL slug for the landing page
  title: text("title").notNull(),
  description: text("description"),
  
  // Page Content
  heroTitle: text("hero_title"),
  heroSubtitle: text("hero_subtitle"),
  heroImage: text("hero_image"),
  bodyContent: text("body_content"), // HTML content
  
  // SEO Configuration
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),
  
  // Page Settings
  template: text("template").notNull().default('marina'), // marina, boat, generic, minimal
  status: text("status").notNull().default('draft'), // draft, active, archived
  isPublished: boolean("is_published").default(false),
  passwordProtected: boolean("password_protected").default(false),
  password: text("password"),
  
  // Form Integration
  formId: varchar("form_id").references(() => crmForms.id),
  formPlacement: text("form_placement").default('bottom'), // top, bottom, sidebar, inline, popup
  
  // A/B Testing
  isTestVariant: boolean("is_test_variant").default(false),
  parentPageId: varchar("parent_page_id"),
  testSplitPercentage: integer("test_split_percentage").default(50),
  
  // Analytics
  viewCount: integer("view_count").default(0),
  uniqueVisitors: integer("unique_visitors").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 4 }).default('0'),
  bounceRate: decimal("bounce_rate", { precision: 5, scale: 4 }).default('0'),
  averageTimeOnPage: integer("average_time_on_page").default(0), // Seconds
  
  // Custom Styling
  customCss: text("custom_css"),
  customJs: text("custom_js"),
  theme: jsonb("theme").default({}), // Color scheme and styling preferences
  
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Form Analytics table - stores aggregated analytics data for forms

export const crmFormAnalytics = pgTable("crm_form_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").references(() => crmForms.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format for daily aggregation
  
  // Traffic Metrics
  views: integer("views").default(0),
  uniqueVisitors: integer("unique_visitors").default(0),
  
  // Conversion Metrics
  submissions: integer("submissions").default(0),
  completedSubmissions: integer("completed_submissions").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 4 }).default('0'),
  
  // Engagement Metrics
  averageTimeOnForm: integer("average_time_on_form").default(0), // Seconds
  bounceRate: decimal("bounce_rate", { precision: 5, scale: 4 }).default('0'),
  abandonmentRate: decimal("abandonment_rate", { precision: 5, scale: 4 }).default('0'),
  
  // Field-Level Analytics
  fieldDropoffRates: jsonb("field_dropoff_rates").default({}), // { fieldName: rate }
  fieldCompletionTimes: jsonb("field_completion_times").default({}), // Average time per field
  fieldErrorRates: jsonb("field_error_rates").default({}), // Validation error rates per field
  
  // Source Analytics
  sourceBreakdown: jsonb("source_breakdown").default({}), // Traffic by source
  deviceBreakdown: jsonb("device_breakdown").default({}), // Desktop vs mobile
  locationBreakdown: jsonb("location_breakdown").default({}), // Geographic data
  
  // Lead Quality Metrics
  qualifiedLeads: integer("qualified_leads").default(0),
  averageLeadScore: decimal("average_lead_score", { precision: 5, scale: 2 }).default('0'),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Form Versions table - for A/B testing and version history

export const crmFormVersions = pgTable("crm_form_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formId: varchar("form_id").references(() => crmForms.id).notNull(),
  versionNumber: integer("version_number").notNull(),
  name: text("name"), // Version name/label
  description: text("description"),
  
  // Version Data (snapshot of form and fields configuration)
  formData: jsonb("form_data").notNull(), // Complete form configuration
  fieldsData: jsonb("fields_data").notNull(), // Complete fields configuration
  
  // A/B Test Results
  testStatus: text("test_status").default('draft'), // draft, active, completed, winner
  trafficAllocation: integer("traffic_allocation").default(50), // Percentage of traffic
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 4 }),
  submissions: integer("submissions").default(0),
  
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
// CRM Type Exports
export type CrmDeal = typeof crmDeals.$inferSelect;
export type CrmLead = typeof crmLeads.$inferSelect;
export type CrmContact = typeof crmContacts.$inferSelect;
export type CrmCompany = typeof crmCompanies.$inferSelect;
export type CrmPipeline = typeof crmPipelines.$inferSelect;
export type CrmPipelineStage = typeof crmPipelineStages.$inferSelect;
export type CrmActivity = typeof crmActivities.$inferSelect;

// CRM Insert Schemas
export const insertCrmDealSchema = createInsertSchema(crmDeals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmDeal = z.infer<typeof insertCrmDealSchema>;

export const insertCrmLeadSchema = createInsertSchema(crmLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmLead = z.infer<typeof insertCrmLeadSchema>;

export const insertCrmContactSchema = createInsertSchema(crmContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;

export const insertCrmCompanySchema = createInsertSchema(crmCompanies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmCompany = z.infer<typeof insertCrmCompanySchema>;

export const insertCrmPipelineSchema = createInsertSchema(crmPipelines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmPipeline = z.infer<typeof insertCrmPipelineSchema>;

export const insertCrmPipelineStageSchema = createInsertSchema(crmPipelineStages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmPipelineStage = z.infer<typeof insertCrmPipelineStageSchema>;

export const insertCrmActivitySchema = createInsertSchema(crmActivities).omit({
  id: true,
  createdAt: true,
});
export type InsertCrmActivity = z.infer<typeof insertCrmActivitySchema>;

// CRM Workflow schema
export const insertCrmWorkflowSchema = createInsertSchema(crmWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmWorkflow = z.infer<typeof insertCrmWorkflowSchema>;

// CRM Schema Aliases (for backward compatibility with original CRM code)
export const insertDealSchema = insertCrmDealSchema;
export type InsertDeal = InsertCrmDeal;
export const insertLeadSchema = insertCrmLeadSchema;
export type InsertLead = InsertCrmLead;
export const insertCompanySchema = insertCrmCompanySchema;
export type InsertCompany = InsertCrmCompany;
export const insertActivitySchema = insertCrmActivitySchema;
export type InsertActivity = InsertCrmActivity;
export const insertWorkflowSchema = insertCrmWorkflowSchema;
export type InsertWorkflow = InsertCrmWorkflow;
export const insertPipelineSchema = insertCrmPipelineSchema;
export type InsertPipeline = InsertCrmPipeline;
export const insertPipelineStageSchema = insertCrmPipelineStageSchema;
export type InsertPipelineStage = InsertCrmPipelineStage;

// CRM Type Aliases
export type Deal = typeof crmDeals.$inferSelect;
export type Lead = typeof crmLeads.$inferSelect;
export type Contact = typeof crmContacts.$inferSelect;
export type Company = typeof crmCompanies.$inferSelect;
export type Activity = typeof crmActivities.$inferSelect;
export type Workflow = typeof crmWorkflows.$inferSelect;
export type Pipeline = typeof crmPipelines.$inferSelect;
export type PipelineStage = typeof crmPipelineStages.$inferSelect;
