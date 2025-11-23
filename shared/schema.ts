import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, jsonb, pgEnum, primaryKey, unique, index, customType, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Import DockTalk enums from docktalk-schema for reuse
import { 
  alertFrequencyEnum as docktalkAlertFrequencyEnum,
  entityTypeEnum as docktalkEntityTypeEnum
} from "./docktalk-schema";

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
export const projectStatusEnum = pgEnum("project_status", ["active", "accepted", "completed"]);
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
export const pendingPropertyStatusEnum = pgEnum("pending_property_status", ["pending", "accepted", "rejected"]);
export const fuelTypeEnum = pgEnum("fuel_type", ["diesel", "regular_gas", "premium_gas", "ethanol_free"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "credit_card", "debit_card", "account_charge", "check"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "refunded"]);
export const fuelCategoryEnum = pgEnum("fuel_category", ["regular", "premium", "diesel", "ethanol"]);
export const customerStatusEnum = pgEnum("customer_status", ["active", "inactive", "prospect", "churned"]);
export const accountTypeEnum = pgEnum("account_type", ["annual", "seasonal", "transient", "monthly"]);
export const slipTypeEnum = pgEnum("slip_type", ["wet", "dry", "rack", "mooring"]);
export const slipStatusEnum = pgEnum("slip_status", ["active", "expired", "reserved", "terminated"]);
export const serviceTypeEnum = pgEnum("service_type", ["fuel", "maintenance", "dockage", "storage", "amenity", "other"]);
export const contactMethodEnum = pgEnum("contact_method", ["email", "phone", "sms", "mail"]);
export const rentRollContextEnum = pgEnum("rent_roll_context", ["operational", "valuation"]);
export const rentRollEntryTypeEnum = pgEnum("rent_roll_entry_type", ["slip", "rack", "commercial", "seasonal"]);
export const marketingCampaignStatusEnum = pgEnum("marketing_campaign_status", ["planning", "active", "paused", "completed", "archived"]);
export const marketingChannelEnum = pgEnum("marketing_channel", ["email", "paid_ads", "social_media", "content", "events", "direct_mail", "seo", "partnerships", "referral", "other"]);
export const expenseCategoryEnum = pgEnum("expense_category", ["advertising", "software", "agency_fees", "content_creation", "events", "sponsorships", "tools", "other"]);
export const expenseStatusEnum = pgEnum("expense_status", ["pending", "approved", "paid", "rejected"]);
export const attributionTypeEnum = pgEnum("attribution_type", ["first_touch", "last_touch", "assisted"]);
export const emailPlatformEnum = pgEnum("email_platform", ["mailchimp", "constant_contact"]);
export const leadStatusEnum = pgEnum("lead_status", ["none", "new", "contacted", "qualified", "unqualified", "converted"]);
export const contactTagEnum = pgEnum("contact_tag", ["lead", "seller", "competitor", "broker", "vendor", "insurance", "lender", "attorney", "other"]);
export const phoneTypeEnum = pgEnum("phone_type", ["office", "mobile", "home"]);
export const dealOutcomeEnum = pgEnum("deal_outcome", ["won", "lost", "passed", "under_review", "active"]);

// VDR & Request Management enums
export const vdrPermissionLevelEnum = pgEnum("vdr_permission_level", ["no_access", "view_only", "view_download", "view_download_print", "full_access"]);
export const watermarkTypeEnum = pgEnum("watermark_type", ["static", "dynamic"]);
export const auditEventTypeEnum = pgEnum("audit_event_type", ["view", "download", "print", "share", "edit", "delete", "permission_change", "folder_created", "folder_updated", "folder_deleted", "document_uploaded", "document_updated", "document_deleted"]);
export const requestStatusEnum = pgEnum("request_status", ["pending", "in_review", "responded", "completed", "blocked"]);
export const requestPriorityEnum = pgEnum("request_priority", ["low", "medium", "high", "critical"]);
export const externalUserRoleEnum = pgEnum("external_user_role", ["seller", "buyer", "advisor", "auditor", "lender", "attorney", "other"]);
export const externalUserProjectAccessStatusEnum = pgEnum("external_user_project_access_status", ["active", "revoked", "expired"]);
export const requestCategoryEnum = pgEnum("request_category", ["financial", "legal", "hr", "it", "commercial", "environmental", "tax", "ip", "regulatory", "operational", "other"]);
export const dataRequestItemStatusEnum = pgEnum("data_request_item_status", ["outstanding", "in_progress", "received", "n_a"]);
export const dataRequestPriorityEnum = pgEnum("data_request_priority", ["low", "medium", "high", "urgent"]);

// Persona and Dashboard enums
export const personaTypeEnum = pgEnum("persona_type", ["pe_investor", "broker", "operator", "advisor"]);
export const widgetCategoryEnum = pgEnum("widget_category", ["analytics", "pipeline", "operations", "finance", "tasks", "market_intel"]);
export const assetStatusEnum = pgEnum("asset_status", ["under_management", "optimization", "exit"]);
export const holdStrategyEnum = pgEnum("hold_strategy", ["core", "value_add", "opportunistic"]);

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

// Calendar Settings - User calendar preferences
export const calendarSettings = pgTable("calendar_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  syncEnabled: boolean("sync_enabled").default(false),
  defaultCalendarId: text("default_calendar_id").default('primary'),
  syncActivities: boolean("sync_activities").default(true),
  syncTasks: boolean("sync_tasks").default(true),
  reminderMinutes: integer("reminder_minutes").default(15),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Persona Feature Flags - Global registry of persona capabilities
export const personaFeatureFlags = pgTable("persona_feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  personaType: personaTypeEnum("persona_type").notNull(),
  featureKey: text("feature_key").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniquePersonaFeature: unique().on(table.personaType, table.featureKey),
}));

// User Persona Assignments - User-level persona configuration
export const userPersonaAssignments = pgTable("user_persona_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  primaryPersona: personaTypeEnum("primary_persona").notNull(),
  secondaryPersona: personaTypeEnum("secondary_persona"),
  featureOverrides: jsonb("feature_overrides").default(sql`'{}'`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  uniqueUserOrg: unique().on(table.userId, table.orgId),
  userOrgIdx: index("user_persona_user_org_idx").on(table.userId, table.orgId),
}));

// Dashboard Widgets - Global widget registry
export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  widgetKey: text("widget_key").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  category: widgetCategoryEnum("category").notNull(),
  dataSource: text("data_source"),
  defaultSize: jsonb("default_size").default(sql`'{"width": 1, "height": 1}'`),
  availableToPersonas: personaTypeEnum("available_to_personas").array().default(sql`'{}'`),
  configSchema: jsonb("config_schema").default(sql`'{}'`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User Dashboard Layouts - Personalized dashboard configurations
export const userDashboardLayouts = pgTable("user_dashboard_layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  personaTemplate: personaTypeEnum("persona_template"),
  layout: jsonb("layout").default(sql`'[]'`),
  isDefault: boolean("is_default").notNull().default(false),
  lastModified: timestamp("last_modified").notNull().defaultNow(),
}, (table) => ({
  uniqueUserOrgPersona: unique().on(table.userId, table.orgId, table.personaTemplate),
  userOrgIdx: index("user_dashboard_user_org_idx").on(table.userId, table.orgId),
}));

// Projects
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  city: text("city"),
  state: text("state"),
  status: projectStatusEnum("status").notNull().default("active"),
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
  leases: jsonb("leases").default(sql`'[]'`), // Array of lease information from deal
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
  // CRM Integration
  companyId: varchar("company_id").references(() => crmCompanies.id), // Link to CRM company
  contactId: varchar("contact_id").references(() => crmContacts.id), // Link to CRM contact (company representative)
  // Legacy text fields (kept for backward compatibility and manual entry)
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
  // Calendar sync fields
  calendarEventId: text("calendar_event_id"), // Google Calendar event ID
  syncedToCalendar: boolean("synced_to_calendar").default(false),
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

// Project Pending Contacts (Join table for associating pending contacts with projects)
export const projectPendingContacts = pgTable("project_pending_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  pendingContactId: varchar("pending_contact_id").notNull().references(() => pendingContacts.id),
  role: contactRoleEnum("role").notNull(), // Pre-assigned role for when contact is accepted
  customRole: text("custom_role"), // Custom role when role is "other"
  projectNotes: text("project_notes"), // Project-specific notes about this contact
  isPrimary: boolean("is_primary").notNull().default(false), // Will this be the primary contact for this role?
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    // Ensure a pending contact can only have one instance per project with the same role
    uniqueProjectPendingContactRole: unique("unique_project_pending_contact_role").on(table.projectId, table.pendingContactId, table.role),
    projectIdx: index("project_pending_contacts_project").on(table.projectId),
    pendingContactIdx: index("project_pending_contacts_pending_contact").on(table.pendingContactId),
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

export const insertCalendarSettingsSchema = createInsertSchema(calendarSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSettingsSchema = createInsertSchema(projectSettings);


export const insertProjectTemplateSchema = createInsertSchema(projectTemplates).omit({
  id: true,
});

export const insertDDTaskSchema = createInsertSchema(tasks).omit({
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

export const insertDDContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

// Security: Restricted schema for contact updates - excludes tenant isolation fields
export const updateDDContactSchema = createInsertSchema(contacts).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
});

export const insertProjectContactSchema = createInsertSchema(projectContacts).omit({
  id: true,
  createdAt: true,
});

export const insertProjectPendingContactSchema = createInsertSchema(projectPendingContacts).omit({
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

export type CalendarSettings = typeof calendarSettings.$inferSelect;
export type InsertCalendarSettings = z.infer<typeof insertCalendarSettingsSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type ProjectSettings = typeof projectSettings.$inferSelect;
export type InsertProjectSettings = z.infer<typeof insertProjectSettingsSchema>;


export type ProjectTemplate = typeof projectTemplates.$inferSelect;
export type InsertProjectTemplate = z.infer<typeof insertProjectTemplateSchema>;

export type DDTask = typeof tasks.$inferSelect;
export type InsertDDTask = z.infer<typeof insertDDTaskSchema>;

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

export type DDContact = typeof contacts.$inferSelect;
export type InsertDDContact = z.infer<typeof insertDDContactSchema>;
export type UpdateDDContact = z.infer<typeof updateDDContactSchema>;

export type ProjectContact = typeof projectContacts.$inferSelect;
export type InsertProjectContact = z.infer<typeof insertProjectContactSchema>;

export type ProjectPendingContact = typeof projectPendingContacts.$inferSelect;
export type InsertProjectPendingContact = z.infer<typeof insertProjectPendingContactSchema>;

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
  phone: text("phone"), // Legacy field - kept for backward compatibility
  phones: jsonb("phones").default(sql`'[]'`), // Array of {type: 'office'|'mobile'|'home', number: string}
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
  contactType: text("contact_type").default('prospect'), // prospect, vendor, buyer, seller, partner, client (legacy field)
  photoDataUrl: text("photo_data_url"), // Base64 encoded photo
  leadScore: text("lead_score").default('new'), // hot, warm, cold, new (legacy field)
  contactTag: contactTagEnum("contact_tag").default('lead'), // New tag system: lead, seller, competitor, broker, vendor, insurance, lender, attorney, other
  leadStatus: leadStatusEnum("lead_status"), // Only applicable when contactTag = 'lead', must be NULL when contactTag != 'lead'
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

// Owned Assets - Acquired properties under management
export const ownedAssets = pgTable("owned_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  propertyId: varchar("property_id").notNull().references(() => crmProperties.id),
  projectId: varchar("project_id").references(() => projects.id),
  acquisitionDate: date("acquisition_date").notNull(),
  acquisitionPrice: integer("acquisition_price"),
  status: assetStatusEnum("status").notNull().default("under_management"),
  holdStrategy: holdStrategyEnum("hold_strategy"),
  exitTargetDate: date("exit_target_date"),
  keyMetrics: jsonb("key_metrics").default(sql`'{}'`),
  notes: text("notes"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgStatusIdx: index("owned_assets_org_status_idx").on(table.orgId, table.status),
  orgPropertyIdx: index("owned_assets_org_property_idx").on(table.orgId, table.propertyId),
}));

// Asset Performance Snapshots - Historical KPI tracking for owned assets
export const assetPerformanceSnapshots = pgTable("asset_performance_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownedAssetId: varchar("owned_asset_id").notNull().references(() => ownedAssets.id, { onDelete: 'cascade' }),
  snapshotDate: date("snapshot_date").notNull(),
  metrics: jsonb("metrics").default(sql`'{}'`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueAssetDate: unique().on(table.ownedAssetId, table.snapshotDate),
  assetDateIdx: index("asset_snapshots_asset_date_idx").on(table.ownedAssetId, table.snapshotDate),
}));

// Pending Properties - Review queue for properties created from sales comps
export const pendingProperties = pgTable("pending_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  compId: varchar("comp_id").notNull().references(() => salesComps.id),
  
  // Property data extracted from comp
  marinaName: text("marina_name").notNull(),
  city: text("city"),
  state: text("state"),
  address: text("address"),
  salePrice: integer("sale_price"),
  
  // Review status
  status: pendingPropertyStatusEnum("status").notNull().default("pending"),
  
  // Additional metadata from comp for review
  compMetadata: jsonb("comp_metadata").default({}), // Stores full comp details for reference
  
  // Suggested duplicate matches for user review
  suggestedDuplicates: jsonb("suggested_duplicates").default([]), // Array of potential property IDs
  
  // Created property ID when accepted
  createdPropertyId: varchar("created_property_id").references(() => crmProperties.id),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Pending Contacts - Review queue for contacts created from sales comps or DD projects
export const pendingContacts = pgTable("pending_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  sourceType: text("source_type").notNull(), // 'sales_comp', 'dd_project', 'manual'
  sourceId: varchar("source_id"), // ID of the source (comp ID, project ID, etc.)
  
  // Contact data extracted from source
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name"), // For cases where first/last aren't split
  email: text("email"),
  phone: text("phone"),
  companyId: varchar("company_id").references(() => crmCompanies.id),
  jobTitle: text("job_title"),
  
  // Review status
  status: pendingPropertyStatusEnum("status").notNull().default("pending"),
  
  // Additional metadata from source for review
  sourceMetadata: jsonb("source_metadata").default({}),
  
  // Suggested duplicate matches for user review
  suggestedDuplicates: jsonb("suggested_duplicates").default([]), // Array of potential contact IDs
  
  // Created contact ID when accepted
  createdContactId: varchar("created_contact_id").references(() => crmContacts.id),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Pending Companies - Review queue for companies created from sales comps or DD projects
export const pendingCompanies = pgTable("pending_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  sourceType: text("source_type").notNull(), // 'sales_comp', 'dd_project', 'manual'
  sourceId: varchar("source_id"), // ID of the source (comp ID, project ID, etc.)
  
  // Company data extracted from source
  name: text("name").notNull(),
  website: text("website"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  industry: text("industry"),
  
  // Review status
  status: pendingPropertyStatusEnum("status").notNull().default("pending"),
  
  // Additional metadata from source for review
  sourceMetadata: jsonb("source_metadata").default({}),
  
  // Suggested duplicate matches for user review
  suggestedDuplicates: jsonb("suggested_duplicates").default([]), // Array of potential company IDs
  
  // Created company ID when accepted
  createdCompanyId: varchar("created_company_id").references(() => crmCompanies.id),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  leadStatus: leadStatusEnum("lead_status").notNull().default('new'), // none, new, contacted, qualified, unqualified, converted
  
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

// Lease types for marina properties
export const leaseTypeOptions = [
  'ground_lease',
  'submerged_land_lease',
  'dock_lease',
  'slip_lease',
  'mooring_lease',
  'facility_lease',
  'other'
] as const;

export type LeaseType = typeof leaseTypeOptions[number];

export interface Lease {
  id?: string;
  type: string; // ground_lease, submerged_land_lease, etc.
  lessor: string; // Who it's with (landlord/lessor name)
  startDate: string | null; // ISO date string
  endDate: string | null; // ISO date string  
  extensionEnabled: boolean;
  extensionNotes?: string; // Details about extension options
}

// Enhanced Deals/Opportunities table

export const crmDeals = pgTable("crm_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  type: text("type"), // Deal type: storage_lease, marina_acquisition, new_listing, etc.
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
  leases: jsonb("leases").default([]), // Array of {type, lessor, startDate, endDate, extensionEnabled, extensionNotes}
  // Property Details - comprehensive marina property information from OMs
  propertyDetails: jsonb("property_details").default({}), // Structured property data including capacity, equipment, financials, location, etc.
  // DD Deal Details fields - mirror DD project setup fields
  city: text("city"),
  state: text("state"),
  anchorType: text("anchor_type").default('psa'), // psa or custom
  useBusinessDays: boolean("use_business_days").default(false),
  holidayCalendar: text("holiday_calendar").default('us_federal'), // us_federal or none
  tz: text("tz").default('America/New_York'),
  psaSignedDate: timestamp("psa_signed_date"),
  ddExpirationDate: timestamp("dd_expiration_date"),
  closingDate: timestamp("closing_date"),
  ddPeriodDays: integer("dd_period_days"),
  hasExtensions: boolean("has_extensions").default(false),
  extensionCount: integer("extension_count").default(0),
  extensionDays: integer("extension_days").array(),
  daysToClosing: integer("days_to_closing"),
  // Key Contacts (arrays of contact IDs or names)
  seller: text("seller").array(),
  ourAttorney: text("our_attorney").array(),
  titleInsuranceCompany: text("title_insurance_company"),
  lender: text("lender"),
  // Deposit Information
  firstDepositAmount: decimal("first_deposit_amount", { precision: 12, scale: 2 }),
  firstDepositDays: integer("first_deposit_days"),
  firstDepositDueDate: timestamp("first_deposit_due_date"),
  secondDepositAmount: decimal("second_deposit_amount", { precision: 12, scale: 2 }),
  secondDepositDays: integer("second_deposit_days"),
  secondDepositDueDate: timestamp("second_deposit_due_date"),
  customDeadlines: jsonb("custom_deadlines").default([]), // Array of {label, date, showOnTimeline}
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
  // DD Project Integration
  ddProjectId: varchar("dd_project_id").references(() => projects.id), // Links to DD project if converted
  // Closed Deal Tracking
  isClosed: boolean("is_closed").default(false),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Performance indexes for dashboard queries
  ownerCreatedAtIdx: index("crm_deals_owner_created_at").on(table.ownerId, table.createdAt),
  stageIdx: index("crm_deals_stage").on(table.stage),
  createdAtIdx: index("crm_deals_created_at").on(table.createdAt),
}));

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

// ============================================================================
// VIRTUAL DATA ROOM (VDR) - DealRoom-competitive secure document repository
// ============================================================================

// VDR Folders - Hierarchical folder structure for document organization
export const vdrFolders = pgTable("vdr_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  parentFolderId: varchar("parent_folder_id"), // Self-reference for hierarchy
  name: text("name").notNull(),
  path: text("path").notNull(), // Full path for easy breadcrumb navigation
  displayOrder: integer("display_order").notNull().default(0),
  description: text("description"),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete support
}, (table) => ({
  projectIdx: index("vdr_folders_project_idx").on(table.projectId),
  parentIdx: index("vdr_folders_parent_idx").on(table.parentFolderId),
  orgIdx: index("vdr_folders_org_idx").on(table.orgId),
}));

// VDR Documents - Core document storage with versioning support
export const vdrDocuments = pgTable("vdr_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderId: varchar("folder_id").notNull().references(() => vdrFolders.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  filename: text("filename").notNull(), // Display name
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // bytes
  checksum: text("checksum").notNull(), // SHA-256 for integrity verification
  storagePath: text("storage_path").notNull(), // S3 key or filesystem path
  thumbnailPath: text("thumbnail_path"), // For images/PDFs
  version: integer("version").notNull().default(1),
  isCurrentVersion: boolean("is_current_version").notNull().default(true),
  parentDocumentId: varchar("parent_document_id"), // Link to original for versions
  // AI-extracted metadata
  extractedText: text("extracted_text"), // OCR or PDF text extraction
  aiCategory: text("ai_category"), // Auto-categorized by AI
  aiTags: text("ai_tags").array().default(sql`'{}'`),
  aiSummary: text("ai_summary"),
  aiRiskFlags: jsonb("ai_risk_flags").default(sql`'[]'`), // Array of {flag, severity, description}
  // User metadata
  description: text("description"),
  tags: text("tags").array().default(sql`'{}'`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete support
}, (table) => ({
  folderIdx: index("vdr_documents_folder_idx").on(table.folderId),
  projectIdx: index("vdr_documents_project_idx").on(table.projectId),
  versionIdx: index("vdr_documents_version_idx").on(table.parentDocumentId, table.version),
  orgIdx: index("vdr_documents_org_idx").on(table.orgId),
}));

// VDR Document Permissions - Granular access control (user/role/folder/document level)
export const vdrDocumentPermissions = pgTable("vdr_document_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Permission target (one of these must be set)
  documentId: varchar("document_id").references(() => vdrDocuments.id),
  folderId: varchar("folder_id").references(() => vdrFolders.id),
  projectId: varchar("project_id").references(() => projects.id),
  // Permission subject (one of these must be set)
  userId: varchar("user_id").references(() => users.id),
  externalUserId: varchar("external_user_id"), // References external_users (defined below)
  roleEnum: roleEnum("role_enum"), // Apply to all users with this role
  // Permission details
  permissionLevel: vdrPermissionLevelEnum("permission_level").notNull(),
  expiresAt: timestamp("expires_at"), // Time-limited access
  ipWhitelist: text("ip_whitelist").array().default(sql`'{}'`), // Restrict to IPs
  deviceRestrictions: jsonb("device_restrictions").default(sql`'{}'`), // {allowMobile: false, etc}
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  grantedBy: varchar("granted_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  documentIdx: index("vdr_permissions_document_idx").on(table.documentId),
  folderIdx: index("vdr_permissions_folder_idx").on(table.folderId),
  userIdx: index("vdr_permissions_user_idx").on(table.userId),
  externalUserIdx: index("vdr_permissions_external_user_idx").on(table.externalUserId),
  orgIdx: index("vdr_document_permissions_org_idx").on(table.orgId),
}));

// VDR Watermarks - Dynamic/static watermark configuration
export const vdrWatermarks = pgTable("vdr_watermarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Watermark target (apply to document, folder, or whole project)
  documentId: varchar("document_id").references(() => vdrDocuments.id),
  folderId: varchar("folder_id").references(() => vdrFolders.id),
  projectId: varchar("project_id").references(() => projects.id),
  watermarkType: watermarkTypeEnum("watermark_type").notNull(),
  staticText: text("static_text"), // For static watermarks
  isDynamic: boolean("is_dynamic").notNull().default(true), // Show viewer name/email/time
  opacity: integer("opacity").notNull().default(30), // 0-100
  position: text("position").notNull().default("diagonal"), // diagonal, center, corners, tiled
  includeQrCode: boolean("include_qr_code").notNull().default(false),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  documentIdx: index("vdr_watermarks_document_idx").on(table.documentId),
  folderIdx: index("vdr_watermarks_folder_idx").on(table.folderId),
  projectIdx: index("vdr_watermarks_project_idx").on(table.projectId),
}));

// VDR Audit Logs - Comprehensive document activity tracking
export const vdrAuditLogs = pgTable("vdr_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => vdrDocuments.id),
  folderId: varchar("folder_id").references(() => vdrFolders.id),
  // Actor (who performed the action)
  userId: varchar("user_id").references(() => users.id),
  externalUserId: varchar("external_user_id"), // References external_users
  eventType: auditEventTypeEnum("event_type").notNull(),
  // Event details
  duration: integer("duration"), // Time spent viewing (seconds)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceInfo: jsonb("device_info").default(sql`'{}'`), // {browser, os, deviceType}
  metadata: jsonb("metadata").default(sql`'{}'`), // Additional event context
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  documentIdx: index("vdr_audit_logs_document_idx").on(table.documentId),
  userIdx: index("vdr_audit_logs_user_idx").on(table.userId),
  externalUserIdx: index("vdr_audit_logs_external_user_idx").on(table.externalUserId),
  timestampIdx: index("vdr_audit_logs_timestamp_idx").on(table.timestamp),
  orgIdx: index("vdr_audit_logs_org_idx").on(table.orgId),
}));

// VDR Folder Templates - Reusable folder structures for real estate deals
export const vdrTemplates = pgTable("vdr_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("real_estate"), // real_estate, custom, etc.
  isDefault: boolean("is_default").notNull().default(false), // System-provided templates
  isPublic: boolean("is_public").notNull().default(true), // Available to all orgs
  orgId: varchar("org_id").references(() => organizations.id), // null for system templates
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index("vdr_templates_category_idx").on(table.category),
  orgIdx: index("vdr_templates_org_idx").on(table.orgId),
}));

// VDR Template Folders - Folder definitions within templates
export const vdrTemplateFolders = pgTable("vdr_template_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => vdrTemplates.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  parentFolderId: varchar("parent_folder_id"), // Self-reference for hierarchy within template
  displayOrder: integer("display_order").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  templateIdx: index("vdr_template_folders_template_idx").on(table.templateId),
  parentIdx: index("vdr_template_folders_parent_idx").on(table.parentFolderId),
}));

// ============================================================================
// DILIGENCE REQUEST MANAGEMENT - DealRoom-style request tracking
// ============================================================================

// Diligence Requests - Document requests separate from tasks
export const diligenceRequests = pgTable("diligence_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  taskId: varchar("task_id").references(() => tasks.id), // Optional link to DD task
  category: requestCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: requestPriorityEnum("priority").notNull().default("medium"),
  status: requestStatusEnum("status").notNull().default("pending"),
  // Assignment
  assigneeId: varchar("assignee_id").references(() => users.id),
  externalAssigneeId: varchar("external_assignee_id"), // References external_users
  externalAssigneeEmail: text("external_assignee_email"), // For manual entry
  requestorId: varchar("requestor_id").notNull().references(() => users.id),
  // Dates
  dueDate: date("due_date"),
  respondedAt: timestamp("responded_at"),
  completedAt: timestamp("completed_at"),
  // Response
  responseText: text("response_text"),
  // SLA tracking
  slaHours: integer("sla_hours"), // Expected response time
  isOverdue: boolean("is_overdue").notNull().default(false),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"), // Soft delete support
}, (table) => ({
  projectIdx: index("diligence_requests_project_idx").on(table.projectId),
  assigneeIdx: index("diligence_requests_assignee_idx").on(table.assigneeId),
  statusIdx: index("diligence_requests_status_idx").on(table.status),
  orgIdx: index("diligence_requests_org_idx").on(table.orgId),
}));

// Request Documents - Link documents to requests (many-to-many)
export const requestDocuments = pgTable("request_documents", {
  requestId: varchar("request_id").notNull().references(() => diligenceRequests.id),
  documentId: varchar("document_id").notNull().references(() => vdrDocuments.id),
  linkedBy: varchar("linked_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.requestId, table.documentId] }),
  requestIdx: index("request_documents_request_idx").on(table.requestId),
  documentIdx: index("request_documents_document_idx").on(table.documentId),
}));

// Request Comments - Threaded Q&A on requests
export const requestComments = pgTable("request_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => diligenceRequests.id),
  parentCommentId: varchar("parent_comment_id"), // For threading
  userId: varchar("user_id").references(() => users.id),
  externalUserId: varchar("external_user_id"), // References external_users
  content: text("content").notNull(),
  mentions: text("mentions").array().default(sql`'{}'`), // User IDs mentioned with @
  isAnswer: boolean("is_answer").notNull().default(false), // Mark as official answer
  reactions: jsonb("reactions").default(sql`'{}'`), // {👍: [userId1, userId2], ❤️: [...]}
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  requestIdx: index("request_comments_request_idx").on(table.requestId),
  parentIdx: index("request_comments_parent_idx").on(table.parentCommentId),
}));

// Request Templates - Pre-built request lists by category
export const requestTemplates = pgTable("request_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: requestCategoryEnum("category").notNull(),
  isGlobal: boolean("is_global").notNull().default(false), // Available to all orgs
  requests: jsonb("requests").notNull().default(sql`'[]'`), // Array of {title, description, priority}
  orgId: varchar("org_id").references(() => organizations.id), // Null for global templates
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index("request_templates_category_idx").on(table.category),
  orgIdx: index("request_templates_org_idx").on(table.orgId),
}));

// ============================================================================
// VDR DATA REQUEST - Document checklist and status tracking for VDR projects
// ============================================================================

// VDR Data Request Templates - Reusable document checklist templates
export const vdrDataRequestTemplates = pgTable("vdr_data_request_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("real_estate"), // real_estate, financial, legal, etc.
  isGlobal: boolean("is_global").notNull().default(false), // Available to all orgs
  orgId: varchar("org_id").references(() => organizations.id), // Null for global templates
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  categoryIdx: index("vdr_data_request_templates_category_idx").on(table.category),
  orgIdx: index("vdr_data_request_templates_org_idx").on(table.orgId),
}));

// VDR Diligence Categories - Organization-specific diligence categories
export const vdrDiligenceCategories = pgTable("vdr_diligence_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  slug: text("slug").notNull(), // Stable identifier for default categories
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("vdr_diligence_categories_org_idx").on(table.orgId),
  slugOrgIdx: unique("vdr_diligence_categories_slug_org_idx").on(table.slug, table.orgId),
}));

// VDR Due Date Presets - Organization-specific quick-select due date presets
export const vdrDueDatePresets = pgTable("vdr_due_date_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  slug: text("slug").notNull(), // Stable identifier for default presets
  name: text("name").notNull(), // e.g., "One Week", "Two Weeks", "One Month"
  days: integer("days").notNull(), // Number of days to add to today
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("vdr_due_date_presets_org_idx").on(table.orgId),
  slugOrgIdx: unique("vdr_due_date_presets_slug_org_idx").on(table.slug, table.orgId),
}));

// VDR Data Request Items - Individual document items in a project's data request checklist
export const vdrDataRequestItems = pgTable("vdr_data_request_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  templateId: varchar("template_id").references(() => vdrDataRequestTemplates.id), // Optional link to template
  category: text("category").notNull(), // Financial, Legal, Operational, etc.
  documentName: text("document_name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  status: dataRequestItemStatusEnum("status").notNull().default("outstanding"),
  priority: dataRequestPriorityEnum("priority").notNull().default("medium"),
  // Assignment
  assigneeId: varchar("assignee_id").references(() => users.id), // Internal team member
  externalAssigneeId: varchar("external_assignee_id").references(() => externalUsers.id), // External user (seller, attorney, etc.)
  // Link to VDR document when received
  linkedDocumentId: varchar("linked_document_id").references(() => vdrDocuments.id),
  isInDataRoom: boolean("is_in_data_room").notNull().default(false), // Checkbox sync with data room
  notes: text("notes"),
  dueDate: date("due_date"),
  receivedDate: date("received_date"),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("vdr_data_request_items_project_idx").on(table.projectId),
  statusIdx: index("vdr_data_request_items_status_idx").on(table.status),
  categoryIdx: index("vdr_data_request_items_category_idx").on(table.category),
  assigneeIdx: index("vdr_data_request_items_assignee_idx").on(table.assigneeId),
  priorityIdx: index("vdr_data_request_items_priority_idx").on(table.priority),
  orgIdx: index("vdr_data_request_items_org_idx").on(table.orgId),
}));

// ============================================================================
// EXTERNAL USER ACCESS - Seller/buyer/advisor portal
// ============================================================================

// External Users - Non-org users with limited access
export const externalUsers = pgTable("external_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  name: text("name").notNull(),
  company: text("company"),
  role: externalUserRoleEnum("role").notNull(),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  invitationToken: text("invitation_token").unique(),
  invitationSentAt: timestamp("invitation_sent_at"),
  acceptedAt: timestamp("accepted_at"),
  lastLoginAt: timestamp("last_login_at"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),
  isActive: boolean("is_active").notNull().default(true),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  emailOrgIdx: unique("external_users_email_org_idx").on(table.email, table.orgId),
  tokenIdx: index("external_users_token_idx").on(table.invitationToken),
  orgIdx: index("external_users_org_idx").on(table.orgId),
}));

// External User Project Access - Which projects external users can access
export const externalUserProjectAccess = pgTable("external_user_project_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalUserId: varchar("external_user_id").notNull().references(() => externalUsers.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  canViewFolders: text("can_view_folders").array().default(sql`'{}'`), // Folder IDs
  canViewRequests: text("can_view_requests").array().default(sql`'{}'`), // Request IDs
  expiresAt: timestamp("expires_at"),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  grantedBy: varchar("granted_by").notNull().references(() => users.id),
  status: externalUserProjectAccessStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  externalUserIdx: index("external_project_access_user_idx").on(table.externalUserId),
  projectIdx: index("external_project_access_project_idx").on(table.projectId),
}));

// Contact Roles table - defines relationships between contacts and deals

export const crmContactRoles = pgTable("crm_contact_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => crmDeals.id).notNull(),
  contactId: varchar("contact_id").references(() => crmContacts.id).notNull(),
  role: text("role").notNull().default('buyer'), // buyer, seller, listing_agent, buyer_agent, co_buyer, decision_maker
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// Tasks table - action items and to-dos

export const crmTasks = pgTable("crm_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default('task'), // task, follow_up, call, email, meeting
  priority: text("priority").notNull().default('medium'), // low, medium, high, urgent
  status: text("status").notNull().default('pending'), // pending, in_progress, completed, cancelled
  dueDate: timestamp("due_date"),
  completed: boolean("completed").notNull().default(false),
  dealId: varchar("deal_id").references(() => crmDeals.id),
  contactId: varchar("contact_id").references(() => crmContacts.id),
  companyId: varchar("company_id").references(() => crmCompanies.id),
  propertyId: varchar("property_id").references(() => crmProperties.id),
  assigneeId: varchar("assignee_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Activities table
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
  calendarEventId: text("calendar_event_id"), // Google Calendar event ID
  syncedToCalendar: boolean("synced_to_calendar").default(false),
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

// Prospecting User Settings (per-user preferences)
export const crmProspectingUserSettings = pgTable("crm_prospecting_user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  
  // Week start preference
  weekStartDay: text("week_start_day").default('monday'), // 'sunday', 'monday', 'saturday'
  
  // Future settings can be added here
  // e.g., timezone preference, notification preferences, etc.
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Prospecting Goal Templates (recurring goal templates)
export const crmProspectingGoalTemplates = pgTable("crm_prospecting_goal_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  orgId: varchar("org_id").references(() => organizations.id).notNull(),
  
  // Template details
  name: text("name").notNull(), // e.g., "Weekly Call Goal", "Monthly Lead Goal"
  description: text("description"),
  frequency: text("frequency").notNull(), // 'weekly', 'monthly'
  
  // Goal content (array of goal strings)
  goals: jsonb("goals").default([]).notNull(), // Array of string goals
  
  // Auto-instantiation
  autoInstantiate: boolean("auto_instantiate").default(false), // Auto-create goals for new weeks
  
  // Status
  isActive: boolean("is_active").default(true),
  
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

// ============================================================================
// CSV IMPORT SYSTEM TABLES
// ============================================================================

export const crmImportJobs = pgTable("crm_import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  totalRows: integer("total_rows").notNull(),
  processedRows: integer("processed_rows").default(0),
  successfulRows: integer("successful_rows").default(0),
  failedRows: integer("failed_rows").default(0),
  duplicatesFound: integer("duplicates_found").default(0),
  
  importType: text("import_type").notNull().default('contacts'),
  fieldMappings: jsonb("field_mappings").notNull(),
  duplicateStrategy: text("duplicate_strategy").default('skip'),
  
  status: text("status").notNull().default('pending'),
  currentStep: text("current_step"),
  progress: integer("progress").default(0),
  
  errorLog: jsonb("error_log").default(sql`'[]'::jsonb`),
  validationWarnings: jsonb("validation_warnings").default(sql`'[]'::jsonb`),
  importSummary: jsonb("import_summary").default(sql`'{}'::jsonb`),
  
  csvData: jsonb("csv_data"),
  originalHeaders: jsonb("original_headers").default(sql`'[]'::jsonb`),
  
  canRollback: boolean("can_rollback").default(true),
  rolledBackAt: timestamp("rolled_back_at"),
  rolledBackBy: varchar("rolled_back_by").references(() => users.id),
  
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const crmImportedRecords = pgTable("crm_imported_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  importJobId: varchar("import_job_id").references(() => crmImportJobs.id).notNull(),
  
  recordType: text("record_type").notNull(),
  recordId: varchar("record_id").notNull(),
  action: text("action").notNull(),
  
  rowNumber: integer("row_number").notNull(),
  originalData: jsonb("original_data").notNull(),
  
  wasNew: boolean("was_new").default(true),
  matchedBy: text("matched_by"),
  validationIssues: jsonb("validation_issues").default(sql`'[]'::jsonb`),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email Sequence Steps - Multi-step drip campaign support

export const crmEmailSequenceSteps = pgTable("crm_email_sequence_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceId: varchar("sequence_id").references(() => crmEmailSequences.id).notNull(),
  stepOrder: integer("step_order").notNull(),
  delayDays: integer("delay_days").default(0),
  delayHours: integer("delay_hours").default(0),
  emailTemplateId: varchar("email_template_id").references(() => crmEmailTemplates.id),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  sendTime: text("send_time"),
  skipWeekends: boolean("skip_weekends").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const crmEmailSequenceEnrollments = pgTable("crm_email_sequence_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceId: varchar("sequence_id").references(() => crmEmailSequences.id).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  status: text("status").notNull().default('active'),
  currentStep: integer("current_step").default(0),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  pausedAt: timestamp("paused_at"),
  cancelledAt: timestamp("cancelled_at"),
  exitReason: text("exit_reason"),
  enrolledById: varchar("enrolled_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const crmEmailSequenceStepExecutions = pgTable("crm_email_sequence_step_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enrollmentId: varchar("enrollment_id").references(() => crmEmailSequenceEnrollments.id).notNull(),
  stepId: varchar("step_id").references(() => crmEmailSequenceSteps.id).notNull(),
  status: text("status").notNull().default('pending'),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  errorMessage: text("error_message"),
  emailCommunicationId: varchar("email_communication_id").references(() => crmEmailCommunications.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const phoneSchema = z.object({
  type: z.enum(["office", "mobile", "home"]),
  number: z.string().min(1, "Phone number is required"),
});

export const insertCrmContactSchema = createInsertSchema(crmContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  leadStatus: z.enum(["none", "new", "contacted", "qualified", "unqualified", "converted"]).nullable().optional(), // Explicitly allow null to clear when contactTag != 'lead'
  phones: z.array(phoneSchema).optional().default([]), // Array of phone objects with type and number
});
export type InsertCrmContact = z.infer<typeof insertCrmContactSchema>;
export type Phone = z.infer<typeof phoneSchema>;

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

// CRM Task schema
export const insertCrmTaskSchema = createInsertSchema(crmTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;

// CRM Property schema
export const insertCrmPropertySchema = createInsertSchema(crmProperties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmProperty = z.infer<typeof insertCrmPropertySchema>;

// Pending Property schema
export const insertPendingPropertySchema = createInsertSchema(pendingProperties).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  createdPropertyId: true,
});
export type InsertPendingProperty = z.infer<typeof insertPendingPropertySchema>;
export type PendingProperty = typeof pendingProperties.$inferSelect;

// Pending Contact schema
export const insertPendingContactSchema = createInsertSchema(pendingContacts).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  createdContactId: true,
});
export type InsertPendingContact = z.infer<typeof insertPendingContactSchema>;
export type PendingContact = typeof pendingContacts.$inferSelect;

// Pending Company schema
export const insertPendingCompanySchema = createInsertSchema(pendingCompanies).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  createdCompanyId: true,
});
export type InsertPendingCompany = z.infer<typeof insertPendingCompanySchema>;
export type PendingCompany = typeof pendingCompanies.$inferSelect;

// CRM File schema
export const insertCrmFileSchema = createInsertSchema(crmFiles).omit({
  id: true,
  createdAt: true,
});
export type InsertCrmFile = z.infer<typeof insertCrmFileSchema>;
export type CrmFile = typeof crmFiles.$inferSelect;

// CRM Schema Aliases (for backward compatibility with original CRM code)
export const insertDealSchema = insertCrmDealSchema;
export type InsertDeal = InsertCrmDeal;
export const insertLeadSchema = insertCrmLeadSchema;
export type InsertLead = InsertCrmLead;
export const insertCompanySchema = insertCrmCompanySchema;
export type InsertCompany = InsertCrmCompany;
export const insertContactSchema = insertCrmContactSchema;
export type InsertContact = InsertCrmContact;
export const insertTaskSchema = insertCrmTaskSchema;
export type InsertTask = InsertCrmTask;
export const insertPropertySchema = insertCrmPropertySchema;
export type InsertProperty = InsertCrmProperty;
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

// Additional CRM Type Aliases for backward compatibility
export type Task = typeof crmTasks.$inferSelect;
export type Property = typeof crmProperties.$inferSelect;
export type ContactCompany = typeof crmContactCompanies.$inferSelect;
export type CompanyProperty = typeof crmCompanyProperties.$inferSelect;

// Email Sequence Types
export type EmailSequence = typeof crmEmailSequences.$inferSelect;
export type EmailTemplate = typeof crmEmailTemplates.$inferSelect;
export type EmailSequenceStep = typeof crmEmailSequenceSteps.$inferSelect;
export type EmailSequenceEnrollment = typeof crmEmailSequenceEnrollments.$inferSelect;
export type EmailSequenceStepExecution = typeof crmEmailSequenceStepExecutions.$inferSelect;

export const insertEmailSequenceSchema = createInsertSchema(crmEmailSequences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailSequence = z.infer<typeof insertEmailSequenceSchema>;

export const insertEmailTemplateSchema = createInsertSchema(crmEmailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

export const insertEmailSequenceStepSchema = createInsertSchema(crmEmailSequenceSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailSequenceStep = z.infer<typeof insertEmailSequenceStepSchema>;

export const insertEmailSequenceEnrollmentSchema = createInsertSchema(crmEmailSequenceEnrollments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailSequenceEnrollment = z.infer<typeof insertEmailSequenceEnrollmentSchema>;

export const insertEmailSequenceStepExecutionSchema = createInsertSchema(crmEmailSequenceStepExecutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailSequenceStepExecution = z.infer<typeof insertEmailSequenceStepExecutionSchema>;

// CSV Import System Types
export type CrmImportJob = typeof crmImportJobs.$inferSelect;
export type CrmImportedRecord = typeof crmImportedRecords.$inferSelect;

export const insertCrmImportJobSchema = createInsertSchema(crmImportJobs).omit({
  id: true,
  createdAt: true,
});
export type InsertCrmImportJob = z.infer<typeof insertCrmImportJobSchema>;

export const insertCrmImportedRecordSchema = createInsertSchema(crmImportedRecords).omit({
  id: true,
  createdAt: true,
});
export type InsertCrmImportedRecord = z.infer<typeof insertCrmImportedRecordSchema>;

// Prospecting Types
export type CrmProspectingEntry = typeof crmProspectingEntries.$inferSelect;
export const insertCrmProspectingEntrySchema = createInsertSchema(crmProspectingEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmProspectingEntry = z.infer<typeof insertCrmProspectingEntrySchema>;

// Aliases for convenience
export type ProspectingEntry = CrmProspectingEntry;
export type InsertProspectingEntry = InsertCrmProspectingEntry;
export const insertProspectingEntrySchema = insertCrmProspectingEntrySchema;

// Prospecting User Settings Types
export type CrmProspectingUserSettings = typeof crmProspectingUserSettings.$inferSelect;
export const insertCrmProspectingUserSettingsSchema = createInsertSchema(crmProspectingUserSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmProspectingUserSettings = z.infer<typeof insertCrmProspectingUserSettingsSchema>;

// Prospecting Goal Templates Types
export type CrmProspectingGoalTemplate = typeof crmProspectingGoalTemplates.$inferSelect;
export const insertCrmProspectingGoalTemplateSchema = createInsertSchema(crmProspectingGoalTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCrmProspectingGoalTemplate = z.infer<typeof insertCrmProspectingGoalTemplateSchema>;

// ============================================================================
// SALES COMPS / ANALYSIS MODULE
// ============================================================================

// Sales comparables table
export const salesComps = pgTable('sales_comps', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Standardized core fields
  marina: text('marina').notNull(),
  salePrice: integer('sale_price'),
  isPriceDisclosed: boolean('is_price_disclosed').default(true),
  capRate: integer('cap_rate'),
  isCapRateDisclosed: boolean('is_cap_rate_disclosed').default(true),
  noi: integer('noi'),
  isNoiDisclosed: boolean('is_noi_disclosed').default(true),
  saleMonth: integer('sale_month'), // 1-12
  saleYear: integer('sale_year'),
  city: text('city'),
  state: text('state'),
  wetSlips: integer('wet_slips'),
  dryRacks: integer('dry_racks'),
  ioBoth: text('inside_outside_both'), // Legacy field - deprecated
  storageTypes: text('storage_types').array().default(sql`'{}'`), // Multi-select storage types
  bodyOfWater: text('body_of_water'),
  waterBodyName: text('water_body_name'), // Specific name like "Gulf of America", "Lake Superior"
  waterfront: text('waterfront'),
  region: text('region'),
  saleCondition: text('sale_condition'),
  daysOnMarket: integer('days_on_market'),
  broker: text('broker'), // Legacy field - use brokerage + agent fields instead
  brokerage: text('brokerage'), // Brokerage company name
  agentFirstName: text('agent_first_name'), // Agent first name
  agentLastName: text('agent_last_name'), // Agent last name
  agentContactId: varchar('agent_contact_id').references(() => crmContacts.id, { onDelete: 'set null' }), // Link to CRM contact for broker/agent
  address: text('address'),
  zip: text('zip'),
  lat: decimal('lat', { precision: 10, scale: 7 }), // Geocoded latitude
  lng: decimal('lng', { precision: 10, scale: 7 }), // Geocoded longitude
  seller: text('seller'),
  company: text('company'),
  owner: text('owner'),
  listPrice: integer('list_price'),
  acres: integer('acres'),
  occupancy: integer('occupancy'),
  yearBuilt: integer('year_built'),
  articleUrls: text('article_urls').array().default(sql`'{}'`),
  notes: text('notes'),

  // Profit centers (revenue streams) - individual boolean columns
  profitCenterStorage: boolean('profit_center_storage').default(false),
  profitCenterEvents: boolean('profit_center_events').default(false),
  profitCenterService: boolean('profit_center_service').default(false),
  profitCenterThirdPartyLeases: boolean('profit_center_third_party_leases').default(false),
  profitCenterBoatRentals: boolean('profit_center_boat_rentals').default(false),
  profitCenterBoatBrokerage: boolean('profit_center_boat_brokerage').default(false),
  profitCenterRvPark: boolean('profit_center_rv_park').default(false),
  profitCenterFuel: boolean('profit_center_fuel').default(false),
  profitCenterShipStore: boolean('profit_center_ship_store').default(false),
  profitCenterParts: boolean('profit_center_parts').default(false),
  profitCenterBoatClub: boolean('profit_center_boat_club').default(false),
  profitCenterBoatSales: boolean('profit_center_boat_sales').default(false),
  profitCenterFnb: boolean('profit_center_fnb').default(false),
  profitCenterHospitality: boolean('profit_center_hospitality').default(false),
  
  // Profit center operation types (In-House/Leased/Third-Party)
  profitCenterBoatRentalsType: varchar('profit_center_boat_rentals_type', { length: 20 }),
  profitCenterBoatBrokerageType: varchar('profit_center_boat_brokerage_type', { length: 20 }),
  profitCenterFuelType: varchar('profit_center_fuel_type', { length: 20 }),
  profitCenterShipStoreType: varchar('profit_center_ship_store_type', { length: 20 }),
  profitCenterPartsType: varchar('profit_center_parts_type', { length: 20 }),
  profitCenterBoatSalesType: varchar('profit_center_boat_sales_type', { length: 20 }),
  profitCenterFnbType: varchar('profit_center_fnb_type', { length: 20 }),
  profitCenterHospitalityType: varchar('profit_center_hospitality_type', { length: 20 }),
  profitCenterBoatClubType: varchar('profit_center_boat_club_type', { length: 20 }),
  profitCenterBoatClubCompany: text('profit_center_boat_club_company'),
  
  // Legacy profit centers field (deprecated - keeping for migration compatibility)
  profitCenters: text('profit_centers').array().default(sql`'{}'`),
  coastalType: text('coastal_type'), // Legacy: now called waterType - 'Coastal'|'Lake'|'River'
  waterType: text('water_type'), // 'Coastal'|'Lake'|'River'

  // Portfolio functionality
  isPortfolio: boolean('is_portfolio').default(false),
  parentPortfolioId: varchar('parent_portfolio_id').references((): any => salesComps.id, { onDelete: 'cascade' }),
  ownerCompanyId: varchar('owner_company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  ownershipRole: varchar('ownership_role', { length: 20 }), // 'buyer' | 'seller' - which role the owner played

  // Link to CRM Property
  propertyId: varchar('property_id').references(() => crmProperties.id, { onDelete: 'set null' }),

  // Transaction parties - CRM links
  sellerCompanyId: varchar('seller_company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  sellerContactId: varchar('seller_contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  buyerCompanyId: varchar('buyer_company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  buyerContactId: varchar('buyer_contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),

  // Expandable data
  custom: jsonb('custom').$type<Record<string, unknown>>().default({}),
}, (table) => ({
  orgIdx: index('sales_comps_org_idx').on(table.orgId),
  orgStateIdx: index('sales_comps_org_state_idx').on(table.orgId, table.state),
  orgYearIdx: index('sales_comps_org_year_idx').on(table.orgId, table.saleYear),
  orgPriceIdx: index('sales_comps_org_price_idx').on(table.orgId, table.salePrice),
  orgCoastalIdx: index('sales_comps_org_coastal_idx').on(table.orgId, table.coastalType),
  orgMarinaIdx: index('sales_comps_org_marina_idx').on(table.orgId, table.marina),
  orgRegionIdx: index('sales_comps_org_region_idx').on(table.orgId, table.region),
  orgOwnerPortfolioIdx: index('sales_comps_org_owner_portfolio_idx').on(table.orgId, table.ownerCompanyId, table.isPortfolio),
}));

// Custom storage types table - per-organization customizable storage types
export const scCustomStorageTypes = pgTable('sc_custom_storage_types', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgIdx: index('sc_custom_storage_types_org_idx').on(table.orgId),
  orgNameIdx: index('sc_custom_storage_types_org_name_idx').on(table.orgId, table.name),
}));

// Pending property profiles - tracks comps that need property profiles created
export const scPendingPropertyProfiles = pgTable('sc_pending_property_profiles', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  compId: varchar('comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  status: text('status').notNull().default('pending'), // 'pending' | 'completed' | 'skipped'
  suggestedDuplicates: jsonb('suggested_duplicates').default([]), // Array of potential property IDs
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  orgIdx: index('sc_pending_property_profiles_org_idx').on(table.orgId),
  compIdx: index('sc_pending_property_profiles_comp_idx').on(table.compId),
  statusIdx: index('sc_pending_property_profiles_status_idx').on(table.orgId, table.status),
}));

// Duplicate audit log - tracks auto-merge decisions for compliance and transparency
export const scDuplicateAuditLog = pgTable('sc_duplicate_audit_log', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  entityType: text('entity_type').notNull(), // 'contact' | 'company' | 'property'
  action: text('action').notNull(), // 'auto_merged' | 'pending_created' | 'user_merged' | 'user_rejected'
  
  sourceCompId: varchar('source_comp_id').references(() => salesComps.id, { onDelete: 'set null' }),
  sourceType: text('source_type'), // 'csv_import' | 'manual_entry' | 'api'
  
  newEntityData: jsonb('new_entity_data').$type<Record<string, any>>(), // The data that was being imported
  existingEntityId: varchar('existing_entity_id'), // ID of the matched entity (if auto-merged)
  existingEntityData: jsonb('existing_entity_data').$type<Record<string, any>>(), // Snapshot of existing entity before merge
  
  matchedBy: text('matched_by'), // 'email' | 'phone' | 'name' | 'address' | etc.
  confidence: integer('confidence'), // 0-100 confidence score
  
  performedBy: varchar('performed_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('sc_duplicate_audit_log_org_idx').on(table.orgId),
  orgActionIdx: index('sc_duplicate_audit_log_org_action_idx').on(table.orgId, table.action),
  orgEntityTypeIdx: index('sc_duplicate_audit_log_org_entity_type_idx').on(table.orgId, table.entityType),
  orgCreatedIdx: index('sc_duplicate_audit_log_org_created_idx').on(table.orgId, table.createdAt),
  existingEntityIdx: index('sc_duplicate_audit_log_existing_entity_idx').on(table.existingEntityId),
}));

// Column definitions for dynamic columns
export const compColumns = pgTable('comp_columns', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  key: text('key').notNull(),
  label: text('label').notNull(),
  type: text('type').notNull(), // 'text'|'number'|'currency'|'percent'|'date'|'boolean'|'select'
  options: text('options').array(),
  required: boolean('required').default(false),
  visible: boolean('visible').default(true),
  orderIndex: integer('order_index').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('comp_columns_org_idx').on(table.orgId),
  orgKeyIdx: index('comp_columns_org_key_idx').on(table.orgId, table.key),
}));

// File uploads / import jobs
export const compImports = pgTable('comp_imports', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  filename: text('filename').notNull(),
  status: text('status').notNull(), // 'pending'|'mapping'|'processing'|'completed'|'failed'
  columnMapping: jsonb('column_mapping').$type<Record<string, string>>(),
  parsedData: jsonb('parsed_data').$type<Record<string, any>[]>(),
  summary: jsonb('summary').$type<{
    totalRows: number;
    successCount: number;
    errorCount: number;
    warningCount: number;
    errors: Array<{ row: number; message: string; }>;
  }>(),
}, (table) => ({
  orgIdx: index('comp_imports_org_idx').on(table.orgId),
}));

// SC Projects table for organizing sales comps (renamed from "projects" to avoid conflict with DD projects)
export const scProjects = pgTable('sc_projects', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Project fields
  name: text('name').notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }), // Hex color code like #FF0000
  
  // Project profile for matching
  profile: jsonb('profile').$type<{
    targetNOI?: number;
    targetNOIMin?: number;
    targetNOIMax?: number;
    targetCapacity?: number;
    targetPriceMin?: number;
    targetPriceMax?: number;
    wetSlipsMin?: number;
    wetSlipsMax?: number;
    dryRacksMin?: number;
    dryRacksMax?: number;
    states?: string[];
    regions?: string[];
    waterType?: 'Coastal' | 'Lake' | 'River';
    coastalType?: 'Coastal' | 'Lake' | 'River'; // Legacy - use waterType
    mustHaveProfitCenters?: string[];
    niceToHaveProfitCenters?: string[];
  }>().default({}),
  
  // User weight overrides for recommendation algorithm
  weightOverrides: jsonb('weight_overrides').$type<{
    capacity?: number;
    financial?: number;
    profitCenters?: number;
    regional?: number;
    geo?: number;
  }>().default({}),
}, (table) => ({
  orgIdx: index('sc_projects_org_idx').on(table.orgId),
  orgNameIdx: index('sc_projects_org_name_idx').on(table.orgId, table.name),
}));

// Project-Comps junction table (many-to-many)
export const scProjectComps = pgTable('sc_project_comps', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  scProjectId: varchar('sc_project_id').notNull().references(() => scProjects.id, { onDelete: 'cascade' }),
  salesCompId: varchar('sales_comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  addedBy: varchar('added_by').notNull().references(() => users.id),
  addedAt: timestamp('added_at').defaultNow(),
  notes: text('notes'), // Optional notes specific to this comp in this project
}, (table) => ({
  orgIdx: index('sc_project_comps_org_idx').on(table.orgId),
  projectIdx: index('sc_project_comps_project_idx').on(table.scProjectId),
  salesCompIdx: index('sc_project_comps_sales_comp_idx').on(table.salesCompId),
  uniqueProjectComp: unique('sc_project_comps_unique_idx').on(table.orgId, table.scProjectId, table.salesCompId),
}));

// Audit log for sales comps
export const scAuditLog = pgTable('sc_audit_log', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  entity: text('entity').notNull(), // 'sales_comp' | 'comp_column' | 'sc_project' | 'sc_project_comp'
  entityId: varchar('entity_id').notNull(),
  action: text('action').notNull(), // 'create'|'update'|'delete'|'import'
  before: jsonb('before'),
  after: jsonb('after'),
  at: timestamp('at').defaultNow(),
}, (table) => ({
  orgIdx: index('sc_audit_log_org_idx').on(table.orgId),
  entityIdx: index('sc_audit_log_entity_idx').on(table.entityId),
}));

// Recommendation feedback for learning system
export const scRecommendationFeedback = pgTable('sc_recommendation_feedback', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  scProjectId: varchar('sc_project_id').notNull().references(() => scProjects.id, { onDelete: 'cascade' }),
  salesCompId: varchar('sales_comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  userId: varchar('user_id').notNull().references(() => users.id),
  action: text('action').notNull(), // 'selected'|'rejected'|'liked'|'viewed'
  scoreAtTime: integer('score_at_time'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgIdx: index('sc_recommendation_feedback_org_idx').on(table.orgId),
  projectIdx: index('sc_recommendation_feedback_project_idx').on(table.scProjectId),
}));

// Org-specific learned preferences
export const scOrgPreferences = pgTable('sc_org_preferences', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  segmentKey: text('segment_key').notNull(), // e.g., 'coastal|cap:large' for categorizing preferences
  weights: jsonb('weights').$type<{
    capacity: number;
    financial: number;
    profitCenters: number;
    regional: number;
    geo: number;
  }>().default({ capacity: 0.40, financial: 0.35, profitCenters: 0.15, regional: 0.07, geo: 0.03 }),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('sc_org_preferences_org_idx').on(table.orgId),
  uniqueSegment: unique('sc_org_preferences_unique_idx').on(table.orgId, table.segmentKey),
}));

// Saved searches for quick access to frequently used filter combinations
export const scSavedSearches = pgTable('sc_saved_searches', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Search configuration
  name: text('name').notNull(),
  description: text('description'),
  filters: jsonb('filters').$type<Record<string, any>>().default({}),
  
  // Alert configuration
  emailAlertsEnabled: boolean('email_alerts_enabled').default(false),
  alertFrequency: text('alert_frequency'), // 'immediate'|'daily'|'weekly'
  lastAlertSent: timestamp('last_alert_sent'),
  
  // Usage tracking
  lastUsedAt: timestamp('last_used_at'),
  useCount: integer('use_count').default(0),
  
  // Organization
  isPinned: boolean('is_pinned').default(false),
  color: varchar('color', { length: 7 }), // Hex color for visual organization
}, (table) => ({
  orgIdx: index('sc_saved_searches_org_idx').on(table.orgId),
  orgCreatedByIdx: index('sc_saved_searches_org_created_by_idx').on(table.orgId, table.createdBy),
  orgPinnedIdx: index('sc_saved_searches_org_pinned_idx').on(table.orgId, table.isPinned),
}));

// Portfolios - Grouping mechanism for bulk comp transactions
export const scPortfolios = pgTable('sc_portfolios', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Portfolio fields
  name: text('name').notNull(),
  description: text('description'),
  notes: text('notes'),
}, (table) => ({
  orgIdx: index('sc_portfolios_org_idx').on(table.orgId),
  orgNameIdx: index('sc_portfolios_org_name_idx').on(table.orgId, table.name),
}));

// Portfolio-Comps junction table (many-to-many)
export const scPortfolioComps = pgTable('sc_portfolio_comps', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  portfolioId: varchar('portfolio_id').notNull().references(() => scPortfolios.id, { onDelete: 'cascade' }),
  salesCompId: varchar('sales_comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  addedBy: varchar('added_by').notNull().references(() => users.id),
  addedAt: timestamp('added_at').defaultNow(),
  orderIndex: integer('order_index').default(0), // For maintaining comp order within portfolio
}, (table) => ({
  orgIdx: index('sc_portfolio_comps_org_idx').on(table.orgId),
  portfolioIdx: index('sc_portfolio_comps_portfolio_idx').on(table.portfolioId),
  salesCompIdx: index('sc_portfolio_comps_sales_comp_idx').on(table.salesCompId),
  uniquePortfolioComp: unique('sc_portfolio_comps_unique_idx').on(table.orgId, table.portfolioId, table.salesCompId),
}));

// Saved analytics filter presets for quick access to frequently used analytics configurations
export const scAnalyticsFilterPresets = pgTable('sc_analytics_filter_presets', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),

  // Preset configuration
  name: text('name').notNull(),
  description: text('description'),
  filters: jsonb('filters').$type<Record<string, any>>().default({}),
  
  // Quick access
  isPinned: boolean('is_pinned').default(false),
  lastUsedAt: timestamp('last_used_at'),
  useCount: integer('use_count').default(0),
}, (table) => ({
  orgIdx: index('sc_analytics_filter_presets_org_idx').on(table.orgId),
  userIdx: index('sc_analytics_filter_presets_user_idx').on(table.userId),
  orgUserIdx: index('sc_analytics_filter_presets_org_user_idx').on(table.orgId, table.userId),
}));

// ============================================================================
// DOCKTALK M&A SPOTLIGHT
// ============================================================================

// Enums for DockTalk deals
export const dealOriginEnum = pgEnum("deal_origin", ["marinaMatch", "aiExtraction"]);
export const docktalkTransactionTypeEnum = pgEnum("docktalk_transaction_type", ["M&A", "Financing", "Partnership", "Asset Sale", "Lease", "Other"]);
export const docktalkDealStatusEnum = pgEnum("docktalk_deal_status", ["Announced", "Pending", "Closed", "Terminated"]);

// DockTalk deals - M&A transaction tracking
export const docktalkDeals = pgTable('docktalk_deals', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
  
  // Origin tracking - Primary vs AI-discovered deals
  origin: dealOriginEnum('origin').notNull().default('aiExtraction'),
  externalId: varchar('external_id'), // MarinaMatch Sales Comp UUID for sync
  sourceReference: text('source_reference'), // Link back to MarinaMatch record or news article
  articleId: integer('article_id'), // Optional link to docktalk_articles for AI-extracted deals
  
  // DockTalk-specific fields
  transactionType: docktalkTransactionTypeEnum('transaction_type'), // Deal type
  dealStatus: docktalkDealStatusEnum('deal_status'), // Deal status
  buyerEntityId: integer('buyer_entity_id'), // DockTalk entity ID
  sellerEntityId: integer('seller_entity_id'), // DockTalk entity ID
  assetDescription: text('asset_description'), // Asset/property description
  dealSize: text('deal_size'), // Deal size as text (for AI extraction)
  valuation: text('valuation'), // Property valuation
  equityStake: text('equity_stake'), // Equity stake percentage
  closingDate: timestamp('closing_date'), // Deal closing date
  
  // Deal parties
  buyer: text('buyer'), // Buyer company/entity name
  seller: text('seller'), // Seller company/entity name
  buyerCompanyId: varchar('buyer_company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  sellerCompanyId: varchar('seller_company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  
  // Transaction details
  marinaName: text('marina_name'), // Property/Marina name
  propertyId: varchar('property_id').references(() => crmProperties.id, { onDelete: 'set null' }),
  transactionSize: integer('transaction_size'), // Deal value in USD
  dealDate: date('deal_date'), // Transaction close date
  announcedDate: date('announced_date'), // Date deal was announced
  
  // Location
  city: text('city'),
  state: text('state'),
  region: text('region'), // "US/Domestic" or "International"
  
  // Marina details (from Sales Comps or AI extraction)
  wetSlips: integer('wet_slips'),
  dryRacks: integer('dry_racks'),
  
  // Metadata
  confidence: integer('confidence'), // AI confidence score (0-100) for AI-extracted deals
  notes: text('notes'),
  articleUrls: text('article_urls').array().default(sql`'{}'`), // Source article links
  
  // Flexible data storage
  custom: jsonb('custom').$type<Record<string, unknown>>().default({}),
}, (table) => ({
  orgIdx: index('docktalk_deals_org_idx').on(table.orgId),
  orgOriginIdx: index('docktalk_deals_org_origin_idx').on(table.orgId, table.origin),
  orgDateIdx: index('docktalk_deals_org_date_idx').on(table.orgId, table.dealDate),
  externalIdIdx: index('docktalk_deals_external_id_idx').on(table.externalId),
  articleIdIdx: index('docktalk_deals_article_id_idx').on(table.articleId),
  transactionTypeIdx: index('docktalk_deals_transaction_type_idx').on(table.transactionType),
  dealStatusIdx: index('docktalk_deals_deal_status_idx').on(table.dealStatus),
  uniqueExternalId: unique('docktalk_deals_unique_external_idx').on(table.orgId, table.externalId),
}));

// DockTalk entities - Companies, people, locations, assets for tracking
export const docktalkEntities = pgTable('docktalk_entities', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  type: docktalkEntityTypeEnum('type').notNull(),
  normalizedName: text('normalized_name').notNull(),
  aliases: text('aliases').array().default(sql`'{}'`),
  description: text('description'),
  industry: text('industry'),
  location: text('location'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('docktalk_entities_org_idx').on(table.orgId),
  nameIdx: index('docktalk_entities_name_idx').on(table.name),
  normalizedIdx: index('docktalk_entities_normalized_idx').on(table.normalizedName),
  typeIdx: index('docktalk_entities_type_idx').on(table.type),
}));

// DockTalk portfolio companies - PE firms tracking their portfolio investments
export const docktalkPortfolioCompanies = pgTable('docktalk_portfolio_companies', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  companyName: text('company_name').notNull(),
  description: text('description'),
  industry: text('industry'),
  location: text('location'),
  entityId: varchar('entity_id').references(() => docktalkEntities.id), // Optional link to entity
  alertEnabled: boolean('alert_enabled').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('docktalk_portfolio_companies_org_idx').on(table.orgId),
  userIdx: index('docktalk_portfolio_companies_user_idx').on(table.userId),
  companyIdx: index('docktalk_portfolio_companies_company_idx').on(table.companyName),
}));

// DockTalk saved searches - Save complex search queries with alerts
export const docktalkSavedSearches = pgTable('docktalk_saved_searches', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  filters: jsonb('filters').$type<Record<string, unknown>>().notNull(), // Search criteria as JSON
  alertFrequency: docktalkAlertFrequencyEnum('alert_frequency').notNull().default('none'),
  lastAlertSent: timestamp('last_alert_sent'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('docktalk_saved_searches_org_idx').on(table.orgId),
  userIdx: index('docktalk_saved_searches_user_idx').on(table.userId),
  activeIdx: index('docktalk_saved_searches_active_idx').on(table.isActive),
}));

// DockTalk watchlists - Monitor specific entities (companies, people, etc.)
export const docktalkWatchlists = pgTable('docktalk_watchlists', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  alertFrequency: docktalkAlertFrequencyEnum('alert_frequency').notNull().default('none'),
  lastAlertSent: timestamp('last_alert_sent'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('docktalk_watchlists_org_idx').on(table.orgId),
  userIdx: index('docktalk_watchlists_user_idx').on(table.userId),
}));

// DockTalk watchlist entities - Junction table for watchlist-to-entity relationships
export const docktalkWatchlistEntities = pgTable('docktalk_watchlist_entities', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  watchlistId: varchar('watchlist_id').notNull().references(() => docktalkWatchlists.id, { onDelete: 'cascade' }),
  entityId: varchar('entity_id').notNull().references(() => docktalkEntities.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at').defaultNow(),
}, (table) => ({
  orgIdx: index('docktalk_watchlist_entities_org_idx').on(table.orgId),
  watchlistIdx: index('docktalk_watchlist_entities_watchlist_idx').on(table.watchlistId),
  entityIdx: index('docktalk_watchlist_entities_entity_idx').on(table.entityId),
  uniqueWatchlistEntity: unique('docktalk_watchlist_entities_unique_idx').on(table.watchlistId, table.entityId),
}));

// DockTalk user preferences - Save user's default filter settings
export const docktalkUserPreferences = pgTable('docktalk_user_preferences', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id).unique(),
  defaultFilters: jsonb('default_filters').$type<Record<string, unknown>>().default({}),
  favoriteCategories: text('favorite_categories').array().default(sql`'{}'`),
  favoriteSources: text('favorite_sources').array().default(sql`'{}'`),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('docktalk_user_preferences_org_idx').on(table.orgId),
  userIdx: index('docktalk_user_preferences_user_idx').on(table.userId),
}));

// DockTalk article removal patterns - Train AI to filter irrelevant articles
export const docktalkArticleRemovalPatterns = pgTable('docktalk_article_removal_patterns', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  articleId: integer('article_id'),
  removalReason: text('removal_reason').notNull(),
  removalKeywords: text('removal_keywords').array().default(sql`'{}'`),
  removedBy: varchar('removed_by').references(() => users.id),
  articleTitle: text('article_title').notNull(),
  articleSource: text('article_source').notNull(),
  articleCategories: text('article_categories').array().default(sql`'{}'`),
  articleTags: text('article_tags').array().default(sql`'{}'`),
  articleContent: text('article_content'),
  removedAt: timestamp('removed_at').defaultNow(),
}, (table) => ({
  orgIdx: index('docktalk_article_removal_patterns_org_idx').on(table.orgId),
  articleIdx: index('docktalk_article_removal_patterns_article_idx').on(table.articleId),
  removedByIdx: index('docktalk_article_removal_patterns_user_idx').on(table.removedBy),
  dateIdx: index('docktalk_article_removal_patterns_date_idx').on(table.removedAt),
}));

// DockTalk notification preferences - User email alert settings
export const docktalkNotificationPreferences = pgTable('docktalk_notification_preferences', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id).unique(),
  emailAddress: text('email_address').notNull(),
  categories: text('categories').array().default(sql`'{}'`),
  frequency: docktalkAlertFrequencyEnum('frequency').notNull().default('none'),
  deliveryTime: text('delivery_time').default('09:00'),
  timezone: text('timezone').default('America/New_York'),
  enabled: boolean('enabled').default(true),
  lastSentAt: timestamp('last_sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('docktalk_notification_preferences_org_idx').on(table.orgId),
  userIdx: index('docktalk_notification_preferences_user_idx').on(table.userId),
  frequencyIdx: index('docktalk_notification_preferences_frequency_idx').on(table.frequency),
}));

// Relations
export const salesCompsRelations = relations(salesComps, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [salesComps.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [salesComps.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [salesComps.updatedBy],
    references: [users.id],
  }),
  scProjectComps: many(scProjectComps),
}));

export const compColumnsRelations = relations(compColumns, ({ one }) => ({
  organization: one(organizations, {
    fields: [compColumns.orgId],
    references: [organizations.id],
  }),
}));

export const compImportsRelations = relations(compImports, ({ one }) => ({
  organization: one(organizations, {
    fields: [compImports.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [compImports.createdBy],
    references: [users.id],
  }),
}));

export const scProjectsRelations = relations(scProjects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [scProjects.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [scProjects.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [scProjects.updatedBy],
    references: [users.id],
  }),
  scProjectComps: many(scProjectComps),
}));

export const scProjectCompsRelations = relations(scProjectComps, ({ one }) => ({
  organization: one(organizations, {
    fields: [scProjectComps.orgId],
    references: [organizations.id],
  }),
  scProject: one(scProjects, {
    fields: [scProjectComps.scProjectId],
    references: [scProjects.id],
  }),
  salesComp: one(salesComps, {
    fields: [scProjectComps.salesCompId],
    references: [salesComps.id],
  }),
  addedByUser: one(users, {
    fields: [scProjectComps.addedBy],
    references: [users.id],
  }),
}));

export const scRecommendationFeedbackRelations = relations(scRecommendationFeedback, ({ one }) => ({
  organization: one(organizations, {
    fields: [scRecommendationFeedback.orgId],
    references: [organizations.id],
  }),
  scProject: one(scProjects, {
    fields: [scRecommendationFeedback.scProjectId],
    references: [scProjects.id],
  }),
  salesComp: one(salesComps, {
    fields: [scRecommendationFeedback.salesCompId],
    references: [salesComps.id],
  }),
  user: one(users, {
    fields: [scRecommendationFeedback.userId],
    references: [users.id],
  }),
}));

export const scOrgPreferencesRelations = relations(scOrgPreferences, ({ one }) => ({
  organization: one(organizations, {
    fields: [scOrgPreferences.orgId],
    references: [organizations.id],
  }),
}));

export const scPortfoliosRelations = relations(scPortfolios, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [scPortfolios.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [scPortfolios.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [scPortfolios.updatedBy],
    references: [users.id],
  }),
  scPortfolioComps: many(scPortfolioComps),
}));

export const scPortfolioCompsRelations = relations(scPortfolioComps, ({ one }) => ({
  organization: one(organizations, {
    fields: [scPortfolioComps.orgId],
    references: [organizations.id],
  }),
  portfolio: one(scPortfolios, {
    fields: [scPortfolioComps.portfolioId],
    references: [scPortfolios.id],
  }),
  salesComp: one(salesComps, {
    fields: [scPortfolioComps.salesCompId],
    references: [salesComps.id],
  }),
  addedByUser: one(users, {
    fields: [scPortfolioComps.addedBy],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertSalesCompSchema = createInsertSchema(salesComps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSalesCompSchema = insertSalesCompSchema.partial().omit({
  orgId: true,
  createdBy: true,
});

export const insertCompColumnSchema = createInsertSchema(compColumns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCompColumnSchema = insertCompColumnSchema.partial().omit({
  orgId: true,
});

export const insertCompImportSchema = createInsertSchema(compImports).omit({
  id: true,
  createdAt: true,
});

export const insertScProjectSchema = createInsertSchema(scProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateScProjectSchema = insertScProjectSchema.partial().omit({
  orgId: true,
  createdBy: true,
});

export const insertScProjectCompSchema = createInsertSchema(scProjectComps).omit({
  id: true,
  addedAt: true,
});

export const updateScProjectCompSchema = insertScProjectCompSchema.partial().omit({
  orgId: true,
  scProjectId: true,
  salesCompId: true,
  addedBy: true,
});

export const insertScRecommendationFeedbackSchema = createInsertSchema(scRecommendationFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertScOrgPreferencesSchema = createInsertSchema(scOrgPreferences).omit({
  id: true,
  updatedAt: true,
});

export const updateScOrgPreferencesSchema = insertScOrgPreferencesSchema.partial().omit({
  orgId: true,
});

export const insertScSavedSearchSchema = createInsertSchema(scSavedSearches).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const updateScSavedSearchSchema = insertScSavedSearchSchema.partial();

export const insertScPortfolioSchema = createInsertSchema(scPortfolios).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const updateScPortfolioSchema = insertScPortfolioSchema.partial();

export const insertScPortfolioCompSchema = createInsertSchema(scPortfolioComps).omit({
  id: true,
  addedAt: true,
});

// Profit Centers constant schema
export const profitCentersSchema = z.array(z.enum([
  'Storage',
  'Fuel', 
  'Events',
  'Ship Store',
  'Service',
  'Parts',
  'Third-Party Leases',
  'Boat Club',
  'Boat Rentals',
  'Boat Sales',
  'Boat Brokerage',
  'F&B',
  'RV Park',
  'Hospitality/Accommodations'
]));

// SC Project profile validation
export const scProjectProfileSchema = z.object({
  targetNOI: z.number().optional(),
  targetNOIMin: z.number().optional(),
  targetNOIMax: z.number().optional(),
  targetCapacity: z.number().optional(),
  targetPriceMin: z.number().optional(),
  targetPriceMax: z.number().optional(),
  wetSlipsMin: z.number().optional(),
  wetSlipsMax: z.number().optional(),
  dryRacksMin: z.number().optional(),
  dryRacksMax: z.number().optional(),
  states: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  waterType: z.enum(['Coastal', 'Lake', 'River']).optional(),
  coastalType: z.enum(['Coastal', 'Lake', 'River']).optional(), // Legacy - use waterType
  mustHaveProfitCenters: profitCentersSchema.optional(),
  niceToHaveProfitCenters: profitCentersSchema.optional(),
});

// Weight overrides validation
export const scWeightOverridesSchema = z.object({
  capacity: z.number().min(0).max(1).optional(),
  financial: z.number().min(0).max(1).optional(),
  profitCenters: z.number().min(0).max(1).optional(),
  regional: z.number().min(0).max(1).optional(),
  geo: z.number().min(0).max(1).optional(),
});

// Types
export type SalesComp = typeof salesComps.$inferSelect;
export type InsertSalesComp = z.infer<typeof insertSalesCompSchema>;
export type UpdateSalesComp = z.infer<typeof updateSalesCompSchema>;
export type CompColumn = typeof compColumns.$inferSelect;
export type InsertCompColumn = z.infer<typeof insertCompColumnSchema>;
export type UpdateCompColumn = z.infer<typeof updateCompColumnSchema>;
export type CompImport = typeof compImports.$inferSelect;
export type InsertCompImport = z.infer<typeof insertCompImportSchema>;
export type ScAuditLog = typeof scAuditLog.$inferSelect;
export type ScProject = typeof scProjects.$inferSelect;
export type InsertScProject = z.infer<typeof insertScProjectSchema>;
export type UpdateScProject = z.infer<typeof updateScProjectSchema>;
export type ScProjectComp = typeof scProjectComps.$inferSelect;
export type InsertScProjectComp = z.infer<typeof insertScProjectCompSchema>;
export type UpdateScProjectComp = z.infer<typeof updateScProjectCompSchema>;
export type ScRecommendationFeedback = typeof scRecommendationFeedback.$inferSelect;
export type InsertScRecommendationFeedback = z.infer<typeof insertScRecommendationFeedbackSchema>;
export type ScOrgPreferences = typeof scOrgPreferences.$inferSelect;
export type InsertScOrgPreferences = z.infer<typeof insertScOrgPreferencesSchema>;
export type UpdateScOrgPreferences = z.infer<typeof updateScOrgPreferencesSchema>;
export type ScProjectProfile = z.infer<typeof scProjectProfileSchema>;
export type ScWeightOverrides = z.infer<typeof scWeightOverridesSchema>;
export type ProfitCenter = z.infer<typeof profitCentersSchema>[number];
export type ScSavedSearch = typeof scSavedSearches.$inferSelect;
export type InsertScSavedSearch = z.infer<typeof insertScSavedSearchSchema>;
export type UpdateScSavedSearch = z.infer<typeof updateScSavedSearchSchema>;
export type ScPortfolio = typeof scPortfolios.$inferSelect;
export type InsertScPortfolio = z.infer<typeof insertScPortfolioSchema>;
export type UpdateScPortfolio = z.infer<typeof updateScPortfolioSchema>;
export type ScPortfolioComp = typeof scPortfolioComps.$inferSelect;
export type InsertScPortfolioComp = z.infer<typeof insertScPortfolioCompSchema>;
export type ScCustomStorageType = typeof scCustomStorageTypes.$inferSelect;
export const insertScCustomStorageTypeSchema = createInsertSchema(scCustomStorageTypes).omit({
  id: true,
  createdAt: true,
});
export type InsertScCustomStorageType = z.infer<typeof insertScCustomStorageTypeSchema>;
export type ScPendingPropertyProfile = typeof scPendingPropertyProfiles.$inferSelect;
export const insertScPendingPropertyProfileSchema = createInsertSchema(scPendingPropertyProfiles).omit({
  id: true,
  createdAt: true,
});
export type InsertScPendingPropertyProfile = z.infer<typeof insertScPendingPropertyProfileSchema>;

export type ScDuplicateAuditLog = typeof scDuplicateAuditLog.$inferSelect;
export const insertScDuplicateAuditLogSchema = createInsertSchema(scDuplicateAuditLog).omit({
  id: true,
  createdAt: true,
});
export type InsertScDuplicateAuditLog = z.infer<typeof insertScDuplicateAuditLogSchema>;

// Analytics Filter Presets
export type ScAnalyticsFilterPreset = typeof scAnalyticsFilterPresets.$inferSelect;
export const insertScAnalyticsFilterPresetSchema = createInsertSchema(scAnalyticsFilterPresets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  useCount: true,
  lastUsedAt: true,
});
export type InsertScAnalyticsFilterPreset = z.infer<typeof insertScAnalyticsFilterPresetSchema>;
export const updateScAnalyticsFilterPresetSchema = insertScAnalyticsFilterPresetSchema.partial().omit({
  orgId: true,
  userId: true,
});
export type UpdateScAnalyticsFilterPreset = z.infer<typeof updateScAnalyticsFilterPresetSchema>;

// ============================================================================
// DOCKTALK M&A SPOTLIGHT - Types and Schemas
// ============================================================================

export const insertDocktalkDealSchema = createInsertSchema(docktalkDeals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDocktalkDealSchema = insertDocktalkDealSchema.partial().omit({
  orgId: true,
  createdBy: true,
});

export type DocktalkDeal = typeof docktalkDeals.$inferSelect;
export type InsertDocktalkDeal = z.infer<typeof insertDocktalkDealSchema>;
export type UpdateDocktalkDeal = z.infer<typeof updateDocktalkDealSchema>;

// Analytics/Metrics Tables
export const scMetricSeries = pgTable('sc_metric_series', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  
  name: text('name').notNull(),
  description: text('description'),
  metricType: text('metric_type').notNull(), // 'price_per_slip', 'cap_rate', 'total_price', 'noi', etc.
  aggregationType: text('aggregation_type').notNull(), // 'average', 'median', 'min', 'max', 'sum', 'count'
  filters: jsonb('filters').$type<Record<string, any>>().default({}),
  groupBy: text('group_by'), // 'state', 'year', 'water_type', 'price_range', etc.
  
  isActive: boolean('is_active').default(true),
}, (table) => ({
  orgIdx: index('sc_metric_series_org_idx').on(table.orgId),
  orgMetricTypeIdx: index('sc_metric_series_org_metric_type_idx').on(table.orgId, table.metricType),
}));

export const scMetricPoints = pgTable('sc_metric_points', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  seriesId: varchar('series_id').notNull().references(() => scMetricSeries.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdAt: timestamp('created_at').defaultNow(),
  
  timestamp: timestamp('timestamp').notNull(),
  value: decimal('value', { precision: 20, scale: 2 }).notNull(),
  sampleSize: integer('sample_size').default(0),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  groupValue: text('group_value'), // The value of the groupBy dimension (e.g., 'FL', '2023', etc.)
}, (table) => ({
  seriesIdx: index('sc_metric_points_series_idx').on(table.seriesId),
  orgTimestampIdx: index('sc_metric_points_org_timestamp_idx').on(table.orgId, table.timestamp),
  seriesTimestampIdx: index('sc_metric_points_series_timestamp_idx').on(table.seriesId, table.timestamp),
}));

export const scMetricAlerts = pgTable('sc_metric_alerts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  seriesId: varchar('series_id').notNull().references(() => scMetricSeries.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  
  name: text('name').notNull(),
  condition: text('condition').notNull(), // 'above', 'below', 'between', 'outside'
  threshold: decimal('threshold', { precision: 20, scale: 2 }),
  thresholdMin: decimal('threshold_min', { precision: 20, scale: 2 }),
  thresholdMax: decimal('threshold_max', { precision: 20, scale: 2 }),
  
  isActive: boolean('is_active').default(true),
  lastTriggered: timestamp('last_triggered'),
  notificationChannels: text('notification_channels').array().default(sql`ARRAY[]::text[]`), // ['email', 'in_app']
}, (table) => ({
  orgIdx: index('sc_metric_alerts_org_idx').on(table.orgId),
  seriesIdx: index('sc_metric_alerts_series_idx').on(table.seriesId),
}));

// Relations
export const scMetricSeriesRelations = relations(scMetricSeries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [scMetricSeries.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [scMetricSeries.createdBy],
    references: [users.id],
  }),
  points: many(scMetricPoints),
  alerts: many(scMetricAlerts),
}));

export const scMetricPointsRelations = relations(scMetricPoints, ({ one }) => ({
  organization: one(organizations, {
    fields: [scMetricPoints.orgId],
    references: [organizations.id],
  }),
  series: one(scMetricSeries, {
    fields: [scMetricPoints.seriesId],
    references: [scMetricSeries.id],
  }),
}));

export const scMetricAlertsRelations = relations(scMetricAlerts, ({ one }) => ({
  organization: one(organizations, {
    fields: [scMetricAlerts.orgId],
    references: [organizations.id],
  }),
  series: one(scMetricSeries, {
    fields: [scMetricAlerts.seriesId],
    references: [scMetricSeries.id],
  }),
  createdByUser: one(users, {
    fields: [scMetricAlerts.createdBy],
    references: [users.id],
  }),
}));

// Zod schemas for analytics
export const insertScMetricSeriesSchema = createInsertSchema(scMetricSeries).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateScMetricSeriesSchema = insertScMetricSeriesSchema.partial();

export const insertScMetricPointSchema = createInsertSchema(scMetricPoints).omit({
  id: true,
  orgId: true,
  createdAt: true,
});

export const insertScMetricAlertSchema = createInsertSchema(scMetricAlerts).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateScMetricAlertSchema = insertScMetricAlertSchema.partial();

// Types for analytics
export type ScMetricSeries = typeof scMetricSeries.$inferSelect;
export type InsertScMetricSeries = z.infer<typeof insertScMetricSeriesSchema>;
export type UpdateScMetricSeries = z.infer<typeof updateScMetricSeriesSchema>;
export type ScMetricPoint = typeof scMetricPoints.$inferSelect;
export type InsertScMetricPoint = z.infer<typeof insertScMetricPointSchema>;
export type ScMetricAlert = typeof scMetricAlerts.$inferSelect;
export type InsertScMetricAlert = z.infer<typeof insertScMetricAlertSchema>;
export type UpdateScMetricAlert = z.infer<typeof updateScMetricAlertSchema>;

// ============================================================================
// RATE COMPS / ANALYSIS MODULE
// ============================================================================

// Rate comparables table (completely separate from sales comps)
export const rateComps = pgTable('rate_comps', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Standardized core fields
  marina: text('marina').notNull(),
  salePrice: integer('sale_price'),
  isPriceDisclosed: boolean('is_price_disclosed').default(true),
  capRate: integer('cap_rate'),
  isCapRateDisclosed: boolean('is_cap_rate_disclosed').default(true),
  noi: integer('noi'),
  isNoiDisclosed: boolean('is_noi_disclosed').default(true),
  saleMonth: integer('sale_month'), // 1-12
  saleYear: integer('sale_year'),
  city: text('city'),
  state: text('state'),
  wetSlips: integer('wet_slips'),
  dryRacks: integer('dry_racks'),
  ioBoth: text('inside_outside_both'), // Legacy field - deprecated
  storageTypes: text('storage_types').array().default(sql`'{}'`), // Multi-select storage types
  rateType: text('rate_type'), // 'Monthly', 'Annual', 'Daily', 'Weekly', etc.
  seasonality: text('seasonality'), // 'Year-Round', 'Seasonal', 'Summer Only', 'Winter Only', etc.
  boatLengthMin: integer('boat_length_min'), // Minimum boat length in feet
  boatLengthMax: integer('boat_length_max'), // Maximum boat length in feet
  bodyOfWater: text('body_of_water'),
  waterBodyName: text('water_body_name'), // Specific name like "Gulf of America", "Lake Superior"
  waterfront: text('waterfront'),
  region: text('region'),
  saleCondition: text('sale_condition'),
  daysOnMarket: integer('days_on_market'),
  broker: text('broker'),
  address: text('address'),
  zip: text('zip'),
  lat: decimal('lat', { precision: 10, scale: 7 }), // Geocoded latitude
  lng: decimal('lng', { precision: 10, scale: 7 }), // Geocoded longitude
  seller: text('seller'),
  company: text('company'),
  owner: text('owner'),
  listPrice: integer('list_price'),
  acres: integer('acres'),
  occupancy: integer('occupancy'),
  yearBuilt: integer('year_built'),
  articleUrls: text('article_urls').array().default(sql`'{}'`),
  notes: text('notes'),

  // Profit centers (revenue streams) - individual boolean columns
  profitCenterStorage: boolean('profit_center_storage').default(false),
  profitCenterEvents: boolean('profit_center_events').default(false),
  profitCenterService: boolean('profit_center_service').default(false),
  profitCenterThirdPartyLeases: boolean('profit_center_third_party_leases').default(false),
  profitCenterBoatRentals: boolean('profit_center_boat_rentals').default(false),
  profitCenterBoatBrokerage: boolean('profit_center_boat_brokerage').default(false),
  profitCenterRvPark: boolean('profit_center_rv_park').default(false),
  profitCenterFuel: boolean('profit_center_fuel').default(false),
  profitCenterShipStore: boolean('profit_center_ship_store').default(false),
  profitCenterParts: boolean('profit_center_parts').default(false),
  profitCenterBoatClub: boolean('profit_center_boat_club').default(false),
  profitCenterBoatSales: boolean('profit_center_boat_sales').default(false),
  profitCenterFnb: boolean('profit_center_fnb').default(false),
  profitCenterHospitality: boolean('profit_center_hospitality').default(false),
  
  // Profit center operation types (In-House/Leased/Third-Party)
  profitCenterBoatRentalsType: varchar('profit_center_boat_rentals_type', { length: 20 }),
  profitCenterBoatBrokerageType: varchar('profit_center_boat_brokerage_type', { length: 20 }),
  profitCenterFuelType: varchar('profit_center_fuel_type', { length: 20 }),
  profitCenterShipStoreType: varchar('profit_center_ship_store_type', { length: 20 }),
  profitCenterPartsType: varchar('profit_center_parts_type', { length: 20 }),
  profitCenterBoatSalesType: varchar('profit_center_boat_sales_type', { length: 20 }),
  profitCenterFnbType: varchar('profit_center_fnb_type', { length: 20 }),
  profitCenterHospitalityType: varchar('profit_center_hospitality_type', { length: 20 }),
  profitCenterBoatClubType: varchar('profit_center_boat_club_type', { length: 20 }),
  profitCenterBoatClubCompany: text('profit_center_boat_club_company'),
  
  // Legacy profit centers field (deprecated - keeping for migration compatibility)
  profitCenters: text('profit_centers').array().default(sql`'{}'`),
  coastalType: text('coastal_type'), // Legacy: now called waterType - 'Coastal'|'Lake'|'River'
  waterType: text('water_type'), // 'Coastal'|'Lake'|'River'

  // Portfolio functionality
  isPortfolio: boolean('is_portfolio').default(false),
  parentPortfolioId: varchar('parent_portfolio_id').references((): any => rateComps.id, { onDelete: 'cascade' }),

  // Link to CRM Property
  propertyId: varchar('property_id').references(() => crmProperties.id, { onDelete: 'set null' }),

  // Transaction parties - CRM links
  sellerCompanyId: varchar('seller_company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  sellerContactId: varchar('seller_contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  buyerCompanyId: varchar('buyer_company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  buyerContactId: varchar('buyer_contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),

  // Expandable data
  custom: jsonb('custom').$type<Record<string, unknown>>().default({}),
}, (table) => ({
  orgIdx: index('rate_comps_org_idx').on(table.orgId),
  orgStateIdx: index('rate_comps_org_state_idx').on(table.orgId, table.state),
  orgYearIdx: index('rate_comps_org_year_idx').on(table.orgId, table.saleYear),
  orgPriceIdx: index('rate_comps_org_price_idx').on(table.orgId, table.salePrice),
  orgCoastalIdx: index('rate_comps_org_coastal_idx').on(table.orgId, table.coastalType),
  orgMarinaIdx: index('rate_comps_org_marina_idx').on(table.orgId, table.marina),
  orgRegionIdx: index('rate_comps_org_region_idx').on(table.orgId, table.region),
}));

// Custom storage types table - per-organization customizable storage types
export const rcCustomStorageTypes = pgTable('rc_custom_storage_types', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgIdx: index('rc_custom_storage_types_org_idx').on(table.orgId),
  orgNameIdx: index('rc_custom_storage_types_org_name_idx').on(table.orgId, table.name),
}));

// Pending property profiles - tracks comps that need property profiles created
export const rcPendingPropertyProfiles = pgTable('rc_pending_property_profiles', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  compId: varchar('comp_id').notNull().references(() => rateComps.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  status: text('status').notNull().default('pending'), // 'pending' | 'completed' | 'skipped'
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  orgIdx: index('rc_pending_property_profiles_org_idx').on(table.orgId),
  compIdx: index('rc_pending_property_profiles_comp_idx').on(table.compId),
  statusIdx: index('rc_pending_property_profiles_status_idx').on(table.orgId, table.status),
}));

// Column definitions for dynamic columns
export const rateCompColumns = pgTable('rate_comp_columns', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  key: text('key').notNull(),
  label: text('label').notNull(),
  type: text('type').notNull(), // 'text'|'number'|'currency'|'percent'|'date'|'boolean'|'select'
  options: text('options').array(),
  required: boolean('required').default(false),
  visible: boolean('visible').default(true),
  orderIndex: integer('order_index').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('rate_comp_columns_org_idx').on(table.orgId),
  orgKeyIdx: index('rate_comp_columns_org_key_idx').on(table.orgId, table.key),
}));

// File uploads / import jobs
export const rateCompImports = pgTable('rate_comp_imports', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  filename: text('filename').notNull(),
  status: text('status').notNull(), // 'pending'|'mapping'|'processing'|'completed'|'failed'
  columnMapping: jsonb('column_mapping').$type<Record<string, string>>(),
  parsedData: jsonb('parsed_data').$type<Record<string, any>[]>(),
  summary: jsonb('summary').$type<{
    totalRows: number;
    successCount: number;
    errorCount: number;
    warningCount: number;
    errors: Array<{ row: number; message: string; }>;
  }>(),
}, (table) => ({
  orgIdx: index('rate_comp_imports_org_idx').on(table.orgId),
}));

// RC Projects table for organizing rate comps (separate from sc_projects)
export const rcProjects = pgTable('rc_projects', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Project fields
  name: text('name').notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }), // Hex color code like #FF0000
  
  // Project profile for matching
  profile: jsonb('profile').$type<{
    targetNOI?: number;
    targetNOIMin?: number;
    targetNOIMax?: number;
    targetCapacity?: number;
    targetPriceMin?: number;
    targetPriceMax?: number;
    wetSlipsMin?: number;
    wetSlipsMax?: number;
    dryRacksMin?: number;
    dryRacksMax?: number;
    states?: string[];
    regions?: string[];
    waterType?: 'Coastal' | 'Lake' | 'River';
    coastalType?: 'Coastal' | 'Lake' | 'River'; // Legacy - use waterType
    mustHaveProfitCenters?: string[];
    niceToHaveProfitCenters?: string[];
  }>().default({}),
  
  // User weight overrides for recommendation algorithm
  weightOverrides: jsonb('weight_overrides').$type<{
    capacity?: number;
    financial?: number;
    profitCenters?: number;
    regional?: number;
    geo?: number;
  }>().default({}),
}, (table) => ({
  orgIdx: index('rc_projects_org_idx').on(table.orgId),
  orgNameIdx: index('rc_projects_org_name_idx').on(table.orgId, table.name),
}));

// Project-Comps junction table (many-to-many)
export const rcProjectComps = pgTable('rc_project_comps', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  rcProjectId: varchar('rc_project_id').notNull().references(() => rcProjects.id, { onDelete: 'cascade' }),
  rateCompId: varchar('rate_comp_id').notNull().references(() => rateComps.id, { onDelete: 'cascade' }),
  addedBy: varchar('added_by').notNull().references(() => users.id),
  addedAt: timestamp('added_at').defaultNow(),
  notes: text('notes'), // Optional notes specific to this comp in this project
}, (table) => ({
  orgIdx: index('rc_project_comps_org_idx').on(table.orgId),
  projectIdx: index('rc_project_comps_project_idx').on(table.rcProjectId),
  rateCompIdx: index('rc_project_comps_rate_comp_idx').on(table.rateCompId),
  uniqueProjectComp: unique('rc_project_comps_unique_idx').on(table.orgId, table.rcProjectId, table.rateCompId),
}));

// Audit log for rate comps
export const rcAuditLog = pgTable('rc_audit_log', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  entity: text('entity').notNull(), // 'rate_comp' | 'rate_comp_column' | 'rc_project' | 'rc_project_comp'
  entityId: varchar('entity_id').notNull(),
  action: text('action').notNull(), // 'create'|'update'|'delete'|'import'
  before: jsonb('before'),
  after: jsonb('after'),
  at: timestamp('at').defaultNow(),
}, (table) => ({
  orgIdx: index('rc_audit_log_org_idx').on(table.orgId),
  entityIdx: index('rc_audit_log_entity_idx').on(table.entityId),
}));

// Recommendation feedback for learning system
export const rcRecommendationFeedback = pgTable('rc_recommendation_feedback', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  rcProjectId: varchar('rc_project_id').notNull().references(() => rcProjects.id, { onDelete: 'cascade' }),
  rateCompId: varchar('rate_comp_id').notNull().references(() => rateComps.id, { onDelete: 'cascade' }),
  userId: varchar('user_id').notNull().references(() => users.id),
  action: text('action').notNull(), // 'selected'|'rejected'|'liked'|'viewed'
  scoreAtTime: integer('score_at_time'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  orgIdx: index('rc_recommendation_feedback_org_idx').on(table.orgId),
  projectIdx: index('rc_recommendation_feedback_project_idx').on(table.rcProjectId),
}));

// Org-specific learned preferences
export const rcOrgPreferences = pgTable('rc_org_preferences', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  segmentKey: text('segment_key').notNull(), // e.g., 'coastal|cap:large' for categorizing preferences
  weights: jsonb('weights').$type<{
    capacity: number;
    financial: number;
    profitCenters: number;
    regional: number;
    geo: number;
  }>().default({ capacity: 0.40, financial: 0.35, profitCenters: 0.15, regional: 0.07, geo: 0.03 }),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  orgIdx: index('rc_org_preferences_org_idx').on(table.orgId),
  uniqueSegment: unique('rc_org_preferences_unique_idx').on(table.orgId, table.segmentKey),
}));

// Saved searches for quick access to frequently used filter combinations
export const rcSavedSearches = pgTable('rc_saved_searches', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Search configuration
  name: text('name').notNull(),
  description: text('description'),
  filters: jsonb('filters').$type<Record<string, any>>().default({}),
  
  // Alert configuration
  emailAlertsEnabled: boolean('email_alerts_enabled').default(false),
  alertFrequency: text('alert_frequency'), // 'immediate'|'daily'|'weekly'
  lastAlertSent: timestamp('last_alert_sent'),
  
  // Usage tracking
  lastUsedAt: timestamp('last_used_at'),
  useCount: integer('use_count').default(0),
  
  // Organization
  isPinned: boolean('is_pinned').default(false),
  color: varchar('color', { length: 7 }), // Hex color for visual organization
}, (table) => ({
  orgIdx: index('rc_saved_searches_org_idx').on(table.orgId),
  orgCreatedByIdx: index('rc_saved_searches_org_created_by_idx').on(table.orgId, table.createdBy),
  orgPinnedIdx: index('rc_saved_searches_org_pinned_idx').on(table.orgId, table.isPinned),
}));

// Portfolios - Grouping mechanism for bulk comp transactions
export const rcPortfolios = pgTable('rc_portfolios', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Portfolio fields
  name: text('name').notNull(),
  description: text('description'),
  notes: text('notes'),
}, (table) => ({
  orgIdx: index('rc_portfolios_org_idx').on(table.orgId),
  orgNameIdx: index('rc_portfolios_org_name_idx').on(table.orgId, table.name),
}));

// Portfolio-Comps junction table (many-to-many)
export const rcPortfolioComps = pgTable('rc_portfolio_comps', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  portfolioId: varchar('portfolio_id').notNull().references(() => rcPortfolios.id, { onDelete: 'cascade' }),
  rateCompId: varchar('rate_comp_id').notNull().references(() => rateComps.id, { onDelete: 'cascade' }),
  addedBy: varchar('added_by').notNull().references(() => users.id),
  addedAt: timestamp('added_at').defaultNow(),
  orderIndex: integer('order_index').default(0), // For maintaining comp order within portfolio
}, (table) => ({
  orgIdx: index('rc_portfolio_comps_org_idx').on(table.orgId),
  portfolioIdx: index('rc_portfolio_comps_portfolio_idx').on(table.portfolioId),
  rateCompIdx: index('rc_portfolio_comps_rate_comp_idx').on(table.rateCompId),
  uniquePortfolioComp: unique('rc_portfolio_comps_unique_idx').on(table.orgId, table.portfolioId, table.rateCompId),
}));

// Analytics/Metrics Tables for Rate Comps
export const rcMetricSeries = pgTable('rc_metric_series', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  
  name: text('name').notNull(),
  description: text('description'),
  metricType: text('metric_type').notNull(), // 'price_per_slip', 'cap_rate', 'total_price', 'noi', etc.
  aggregationType: text('aggregation_type').notNull(), // 'average', 'median', 'min', 'max', 'sum', 'count'
  filters: jsonb('filters').$type<Record<string, any>>().default({}),
  groupBy: text('group_by'), // 'state', 'year', 'water_type', 'price_range', etc.
  
  isActive: boolean('is_active').default(true),
}, (table) => ({
  orgIdx: index('rc_metric_series_org_idx').on(table.orgId),
  orgMetricTypeIdx: index('rc_metric_series_org_metric_type_idx').on(table.orgId, table.metricType),
}));

export const rcMetricPoints = pgTable('rc_metric_points', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  seriesId: varchar('series_id').notNull().references(() => rcMetricSeries.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdAt: timestamp('created_at').defaultNow(),
  
  timestamp: timestamp('timestamp').notNull(),
  value: decimal('value', { precision: 20, scale: 2 }).notNull(),
  sampleSize: integer('sample_size').default(0),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  groupValue: text('group_value'), // The value of the groupBy dimension (e.g., 'FL', '2023', etc.)
}, (table) => ({
  seriesIdx: index('rc_metric_points_series_idx').on(table.seriesId),
  orgTimestampIdx: index('rc_metric_points_org_timestamp_idx').on(table.orgId, table.timestamp),
  seriesTimestampIdx: index('rc_metric_points_series_timestamp_idx').on(table.seriesId, table.timestamp),
}));

export const rcMetricAlerts = pgTable('rc_metric_alerts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  seriesId: varchar('series_id').notNull().references(() => rcMetricSeries.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  
  name: text('name').notNull(),
  description: text('description'),
  condition: jsonb('condition').$type<{
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'between';
    value: number;
    value2?: number; // For 'between' operator
  }>().notNull(),
  isActive: boolean('is_active').default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
}, (table) => ({
  orgIdx: index('rc_metric_alerts_org_idx').on(table.orgId),
  seriesIdx: index('rc_metric_alerts_series_idx').on(table.seriesId),
  activeIdx: index('rc_metric_alerts_active_idx').on(table.isActive),
}));

// Fuel Sales - Operations Module
export const fuelSales = pgTable('fuel_sales', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull().defaultNow(),
  fuelType: fuelTypeEnum('fuel_type').notNull(),
  quantityGallons: decimal('quantity_gallons', { precision: 10, scale: 2 }).notNull(),
  pricePerGallon: decimal('price_per_gallon', { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  customerName: text('customer_name'),
  boatName: text('boat_name'),
  slipNumber: text('slip_number'),
  paymentMethod: paymentMethodEnum('payment_method'),
  processedBy: varchar('processed_by').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fuel_sales_org_idx').on(table.orgId),
  dateIdx: index('fuel_sales_date_idx').on(table.transactionDate),
  fuelTypeIdx: index('fuel_sales_fuel_type_idx').on(table.fuelType),
  processedByIdx: index('fuel_sales_processed_by_idx').on(table.processedBy),
  // Composite index for dashboard revenue queries
  orgDateIdx: index('fuel_sales_org_date_idx').on(table.orgId, table.transactionDate),
}));

// Fuel Types Configuration - for managing different fuel products
export const fuelTypes = pgTable('fuel_types', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  category: fuelCategoryEnum('category').notNull(),
  currentPrice: decimal('current_price', { precision: 10, scale: 3 }).notNull(),
  cost: decimal('cost', { precision: 10, scale: 3 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fuel_types_org_idx').on(table.orgId),
  categoryIdx: index('fuel_types_category_idx').on(table.category),
  activeIdx: index('fuel_types_active_idx').on(table.isActive),
}));

// Fuel Inventory - for tracking fuel tank levels
export const fuelInventory = pgTable('fuel_inventory', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  fuelTypeId: varchar('fuel_type_id').references(() => fuelTypes.id).notNull(),
  currentLevel: decimal('current_level', { precision: 10, scale: 2 }).notNull(),
  capacity: decimal('capacity', { precision: 10, scale: 2 }).notNull(),
  reorderPoint: decimal('reorder_point', { precision: 10, scale: 2 }).notNull(),
  reorderQuantity: decimal('reorder_quantity', { precision: 10, scale: 2 }).notNull(),
  tankName: text('tank_name'),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fuel_inventory_org_idx').on(table.orgId),
  fuelTypeIdx: index('fuel_inventory_fuel_type_idx').on(table.fuelTypeId),
}));

// Fuel Deliveries - for tracking fuel deliveries from suppliers
export const fuelDeliveries = pgTable('fuel_deliveries', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  fuelTypeId: varchar('fuel_type_id').references(() => fuelTypes.id).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
  cost: decimal('cost', { precision: 10, scale: 2 }).notNull(),
  pricePerGallon: decimal('price_per_gallon', { precision: 10, scale: 3 }),
  supplier: text('supplier').notNull(),
  deliveryDate: timestamp('delivery_date', { withTimezone: true }).notNull(),
  invoiceNumber: text('invoice_number'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fuel_deliveries_org_idx').on(table.orgId),
  fuelTypeIdx: index('fuel_deliveries_fuel_type_idx').on(table.fuelTypeId),
  dateIdx: index('fuel_deliveries_date_idx').on(table.deliveryDate),
}));

// Financial Projections - for fuel sales forecasting
export const fuelFinancialProjections = pgTable('fuel_financial_projections', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  projectedRevenue: decimal('projected_revenue', { precision: 12, scale: 2 }).notNull(),
  projectedGallons: decimal('projected_gallons', { precision: 10, scale: 2 }).notNull(),
  projectedCosts: decimal('projected_costs', { precision: 12, scale: 2 }).notNull(),
  growthRate: decimal('growth_rate', { precision: 5, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fuel_projections_org_idx').on(table.orgId),
  periodIdx: index('fuel_projections_period_idx').on(table.year, table.month),
}));

// Fuel Integrations - store external system connection settings
export const fuelIntegrations = pgTable('fuel_integrations', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id).unique(),
  provider: text('provider').notNull(), // 'fuelcloud', 'marinago', 'marinaoffice', 'dockwa', 'manual_csv'
  isEnabled: boolean('is_enabled').notNull().default(false),
  apiUrl: text('api_url'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  syncFrequency: integer('sync_frequency').default(15), // minutes
  autoSyncEnabled: boolean('auto_sync_enabled').default(false),
  fieldMapping: jsonb('field_mapping').default(sql`'{}'`), // maps external fields to internal schema
  settings: jsonb('settings').default(sql`'{}'`), // provider-specific settings
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fuel_integrations_org_idx').on(table.orgId),
  providerIdx: index('fuel_integrations_provider_idx').on(table.provider),
}));

// Fuel Import Logs - track all import/sync operations
export const fuelImportLogs = pgTable('fuel_import_logs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  integrationId: varchar('integration_id').references(() => fuelIntegrations.id),
  source: text('source').notNull(), // 'fuelcloud_api', 'csv_upload', 'manual_entry', etc.
  importType: text('import_type').notNull(), // 'full_sync', 'incremental', 'manual_upload'
  status: text('status').notNull(), // 'pending', 'in_progress', 'completed', 'failed', 'partial'
  recordsProcessed: integer('records_processed').default(0),
  recordsImported: integer('records_imported').default(0),
  recordsSkipped: integer('records_skipped').default(0),
  recordsFailed: integer('records_failed').default(0),
  errorLog: jsonb('error_log').default(sql`'[]'`), // array of error messages
  importData: jsonb('import_data').default(sql`'{}'`), // summary of imported data
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fuel_import_logs_org_idx').on(table.orgId),
  integrationIdx: index('fuel_import_logs_integration_idx').on(table.integrationId),
  statusIdx: index('fuel_import_logs_status_idx').on(table.status),
  dateIdx: index('fuel_import_logs_date_idx').on(table.startedAt),
}));

// ================================================================================
// CUSTOMER ANALYTICS - Marina Customer & Tenant Management
// ================================================================================

// Marina Customers - Core customer profiles
export const marinaCustomers = pgTable('marina_customers', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  contactId: varchar('contact_id').references(() => crmContacts.id), // Link to CRM contact (optional)
  companyId: varchar('company_id').references(() => crmCompanies.id), // Link to CRM company (optional)
  customerNumber: text('customer_number').notNull(), // Unique per org
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  address: jsonb('address').default(sql`'{}'`), // {street, city, state, zip}
  status: customerStatusEnum('status').notNull().default('active'),
  accountType: accountTypeEnum('account_type').notNull().default('monthly'),
  joinDate: date('join_date').notNull(),
  lastActivityDate: date('last_activity_date'), // Auto-updated by triggers/app
  lastInvoiceDate: date('last_invoice_date'),
  preferredContactMethod: contactMethodEnum('preferred_contact_method').default('email'),
  primaryBoatId: varchar('primary_boat_id').references(() => boatRegistry.id, { onDelete: 'set null' }), // FK to boat_registry
  marketingConsent: boolean('marketing_consent').default(false),
  notes: text('notes'),
  customFields: jsonb('custom_fields').default(sql`'{}'`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('marina_customers_org_idx').on(table.orgId),
  statusIdx: index('marina_customers_status_idx').on(table.status),
  joinDateIdx: index('marina_customers_join_date_idx').on(table.joinDate),
  lastActivityIdx: index('marina_customers_last_activity_idx').on(table.lastActivityDate),
  uniqueCustomerNumber: unique('marina_customers_org_customer_number').on(table.orgId, table.customerNumber),
  emailIdx: index('marina_customers_email_idx').on(table.email),
}));

// Slip Assignments - Track slip rentals over time
// NOTE: Slip overlap prevention (same slip, overlapping dates) must be handled at app level
// or via raw SQL exclusion constraint: EXCLUDE USING gist (org_id WITH =, slip_number WITH =, daterange(start_date, end_date) WITH &&)
export const slipAssignments = pgTable('slip_assignments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  customerId: varchar('customer_id').notNull().references(() => marinaCustomers.id, { onDelete: 'cascade' }),
  slipNumber: text('slip_number').notNull(),
  slipType: slipTypeEnum('slip_type').notNull().default('wet'),
  status: slipStatusEnum('status').notNull().default('active'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'), // Nullable for active assignments
  monthlyRate: decimal('monthly_rate', { precision: 10, scale: 2 }),
  renewalDate: date('renewal_date'),
  autoRenew: boolean('auto_renew').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('slip_assignments_org_idx').on(table.orgId),
  customerIdx: index('slip_assignments_customer_idx').on(table.customerId),
  slipNumberIdx: index('slip_assignments_slip_number_idx').on(table.slipNumber),
  statusIdx: index('slip_assignments_status_idx').on(table.status),
  renewalDateIdx: index('slip_assignments_renewal_date_idx').on(table.renewalDate),
}));

// Boat Registry - Customer boats
export const boatRegistry = pgTable('boat_registry', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  customerId: varchar('customer_id').notNull().references(() => marinaCustomers.id, { onDelete: 'cascade' }),
  boatName: text('boat_name').notNull(),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  length: decimal('length', { precision: 5, scale: 2 }), // feet
  registration: text('registration'),
  insuranceExpiry: date('insurance_expiry'),
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('boat_registry_org_idx').on(table.orgId),
  customerIdx: index('boat_registry_customer_idx').on(table.customerId),
  activeIdx: index('boat_registry_active_idx').on(table.isActive),
  registrationIdx: index('boat_registry_registration_idx').on(table.registration),
  uniqueRegistration: unique('boat_registry_org_registration').on(table.orgId, table.registration),
}));

// Service Usage - Track all customer service transactions
export const serviceUsage = pgTable('service_usage', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  customerId: varchar('customer_id').notNull().references(() => marinaCustomers.id, { onDelete: 'cascade' }),
  serviceType: serviceTypeEnum('service_type').notNull(),
  serviceName: text('service_name'), // e.g., "Diesel Fuel", "Oil Change", "Monthly Dockage"
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }), // gallons, hours, etc.
  referenceId: varchar('reference_id'), // Link to fuel_sales.id, etc.
  referenceTable: text('reference_table'), // 'fuel_sales', etc.
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('service_usage_org_idx').on(table.orgId),
  customerIdx: index('service_usage_customer_idx').on(table.customerId),
  serviceTypeIdx: index('service_usage_service_type_idx').on(table.serviceType),
  transactionDateIdx: index('service_usage_transaction_date_idx').on(table.transactionDate),
  referenceIdx: index('service_usage_reference_idx').on(table.referenceTable, table.referenceId),
  uniqueReference: unique('service_usage_org_reference').on(table.orgId, table.referenceTable, table.referenceId),
}));

// Debt Scenarios - Financial Modeling Module
export const debtScenarios = pgTable('debt_scenarios', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  // Rate Configuration
  baseRate: text('base_rate').notNull(), // FRED series ID (SOFR, DPRIME, DGS5, etc.)
  spreadBps: integer('spread_bps').notNull().default(250), // Spread in basis points
  // Property Details
  purchasePrice: decimal('purchase_price', { precision: 15, scale: 2 }).notNull(),
  loanAmount: decimal('loan_amount', { precision: 15, scale: 2 }).notNull(),
  noi: decimal('noi', { precision: 15, scale: 2 }).notNull(), // Net Operating Income
  // Loan Terms
  amortizationYears: integer('amortization_years').notNull().default(25),
  loanTermYears: integer('loan_term_years').notNull().default(10),
  interestOnlyYears: integer('interest_only_years').notNull().default(0),
  // Optional Relations
  dealId: varchar('deal_id').references(() => crmDeals.id), // Link to CRM deal
  projectId: varchar('project_id').references(() => projects.id), // Link to DD project
  // Metadata
  createdBy: varchar('created_by').references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('debt_scenarios_org_idx').on(table.orgId),
  dealIdx: index('debt_scenarios_deal_idx').on(table.dealId),
  projectIdx: index('debt_scenarios_project_idx').on(table.projectId),
  createdByIdx: index('debt_scenarios_created_by_idx').on(table.createdBy),
}));

// ================================================================================
// RENT ROLL - Marina Occupancy & Revenue Tracking
// ================================================================================

// Rent Rolls - Master rent roll records
export const rentRolls = pgTable('rent_rolls', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  context: rentRollContextEnum('context').notNull().default('operational'),
  projectId: varchar('project_id').references(() => projects.id), // Link to DD project for valuation context
  facilityId: text('facility_id'), // Custom identifier for specific marina/facility
  name: text('name').notNull(),
  effectiveDate: date('effective_date').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('rent_rolls_org_idx').on(table.orgId),
  contextIdx: index('rent_rolls_context_idx').on(table.context),
  projectIdx: index('rent_rolls_project_idx').on(table.projectId),
  effectiveDateIdx: index('rent_rolls_effective_date_idx').on(table.effectiveDate),
}));

// Rent Roll Entries - Individual line items in a rent roll
export const rentRollEntries = pgTable('rent_roll_entries', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  rentRollId: varchar('rent_roll_id').notNull().references(() => rentRolls.id, { onDelete: 'cascade' }),
  entryType: rentRollEntryTypeEnum('entry_type').notNull(),
  unitNumber: text('unit_number').notNull(), // Slip/rack/unit number
  tenantName: text('tenant_name'),
  customerId: varchar('customer_id').references(() => marinaCustomers.id), // Optional FK to customer for operational data
  monthlyRate: decimal('monthly_rate', { precision: 10, scale: 2 }).notNull(),
  status: slipStatusEnum('status').notNull().default('active'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('rent_roll_entries_org_idx').on(table.orgId),
  rentRollIdx: index('rent_roll_entries_rent_roll_idx').on(table.rentRollId),
  customerIdx: index('rent_roll_entries_customer_idx').on(table.customerId),
  statusIdx: index('rent_roll_entries_status_idx').on(table.status),
  entryTypeIdx: index('rent_roll_entries_entry_type_idx').on(table.entryType),
}));

// ================================================================================
// MARKETING OPERATIONS MODULE
// ================================================================================

// Marketing Campaigns - Track all marketing initiatives
export const marketingCampaigns = pgTable('marketing_campaigns', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  status: marketingCampaignStatusEnum('status').notNull().default('planning'),
  channel: marketingChannelEnum('channel').notNull(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  budgetPlanned: decimal('budget_planned', { precision: 12, scale: 2 }),
  budgetActual: decimal('budget_actual', { precision: 12, scale: 2 }).default('0'),
  goalLeads: integer('goal_leads'),
  goalRevenue: decimal('goal_revenue', { precision: 12, scale: 2 }),
  goalRoas: decimal('goal_roas', { precision: 5, scale: 2 }), // Target ROAS (e.g., 3.5 = 350%)
  ownerId: varchar('owner_id').references(() => users.id), // Campaign owner
  utmSource: text('utm_source'), // UTM tracking parameters
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('marketing_campaigns_org_idx').on(table.orgId),
  statusIdx: index('marketing_campaigns_status_idx').on(table.status),
  channelIdx: index('marketing_campaigns_channel_idx').on(table.channel),
  ownerIdx: index('marketing_campaigns_owner_idx').on(table.ownerId),
  dateIdx: index('marketing_campaigns_date_idx').on(table.startDate, table.endDate),
}));

// Marketing Expenses - Track spend with approval workflow
export const marketingExpenses = pgTable('marketing_expenses', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  campaignId: varchar('campaign_id').references(() => marketingCampaigns.id, { onDelete: 'set null' }), // Optional campaign link
  vendor: text('vendor').notNull(),
  category: expenseCategoryEnum('category').notNull(),
  description: text('description').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  date: date('date').notNull(),
  status: expenseStatusEnum('status').notNull().default('pending'),
  invoiceUrl: text('invoice_url'), // Link to uploaded invoice
  poNumber: text('po_number'), // Purchase order number
  glAccount: text('gl_account'), // QuickBooks GL account
  approvedBy: varchar('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  paidDate: date('paid_date'),
  notes: text('notes'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('marketing_expenses_org_idx').on(table.orgId),
  campaignIdx: index('marketing_expenses_campaign_idx').on(table.campaignId),
  statusIdx: index('marketing_expenses_status_idx').on(table.status),
  categoryIdx: index('marketing_expenses_category_idx').on(table.category),
  dateIdx: index('marketing_expenses_date_idx').on(table.date),
}));

// Lead Attribution - Track lead sources and revenue attribution
export const leadAttribution = pgTable('lead_attribution', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  campaignId: varchar('campaign_id').references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
  contactId: varchar('contact_id').references(() => crmContacts.id, { onDelete: 'cascade' }), // Link to CRM contact
  leadId: varchar('lead_id').references(() => crmLeads.id, { onDelete: 'cascade' }), // Link to CRM lead
  dealId: varchar('deal_id').references(() => crmDeals.id, { onDelete: 'cascade' }), // Link to CRM deal if closed
  attributionType: attributionTypeEnum('attribution_type').notNull(),
  touchDate: timestamp('touch_date').notNull().defaultNow(),
  source: text('source'), // UTM source or manual entry
  medium: text('medium'), // UTM medium
  campaign: text('campaign'), // UTM campaign
  revenue: decimal('revenue', { precision: 12, scale: 2 }), // Attributed revenue if deal closed
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('lead_attribution_org_idx').on(table.orgId),
  campaignIdx: index('lead_attribution_campaign_idx').on(table.campaignId),
  contactIdx: index('lead_attribution_contact_idx').on(table.contactId),
  leadIdx: index('lead_attribution_lead_idx').on(table.leadId),
  dealIdx: index('lead_attribution_deal_idx').on(table.dealId),
  typeIdx: index('lead_attribution_type_idx').on(table.attributionType),
}));

// Email Campaigns - Sync with MailChimp/Constant Contact
export const emailCampaigns = pgTable('email_campaigns', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  campaignId: varchar('campaign_id').references(() => marketingCampaigns.id, { onDelete: 'cascade' }),
  platform: emailPlatformEnum('platform').notNull(),
  externalId: text('external_id').notNull(), // Platform campaign ID
  listId: text('list_id'), // Platform list/audience ID
  segmentId: text('segment_id'), // Platform segment ID
  subject: text('subject').notNull(),
  sentDate: timestamp('sent_date'),
  recipientCount: integer('recipient_count').default(0),
  openRate: decimal('open_rate', { precision: 5, scale: 2 }), // e.g., 23.45%
  clickRate: decimal('click_rate', { precision: 5, scale: 2 }),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('email_campaigns_org_idx').on(table.orgId),
  campaignIdx: index('email_campaigns_campaign_idx').on(table.campaignId),
  platformIdx: index('email_campaigns_platform_idx').on(table.platform),
  externalIdx: index('email_campaigns_external_idx').on(table.externalId),
}));

// ================================================================================
// MODELING PROJECTS - Valuation & Financial Modeling
// ================================================================================

// Modeling Projects - Track valuation/financial modeling projects
export const modelingProjects = pgTable('modeling_projects', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Core project information
  marinaName: text('marina_name').notNull(),
  purchasePrice: decimal('purchase_price', { precision: 15, scale: 2 }),
  year1CapRate: decimal('year_1_cap_rate', { precision: 5, scale: 2 }), // e.g., 7.25%
  totalStorageUnits: integer('total_storage_units'), // Total number of storage options (wet slips + dry racks, etc.)
  ebitda: decimal('ebitda', { precision: 15, scale: 2 }),
  dealOutcome: dealOutcomeEnum('deal_outcome').notNull().default('active'),
  
  // Broker/deal source
  brokerId: varchar('broker_id').references(() => crmContacts.id), // Broker who introduced the deal
  brokerCompanyId: varchar('broker_company_id').references(() => crmCompanies.id), // Broker's company
  
  // Linked entities
  ddProjectId: varchar('dd_project_id').references(() => projects.id), // Link to DD project
  salesCompId: varchar('sales_comp_id').references(() => salesComps.id), // Link to sales comp
  rateCompId: varchar('rate_comp_id').references(() => rateComps.id), // Link to rate comp
  propertyId: varchar('property_id').references(() => crmProperties.id), // Link to CRM property
  companyId: varchar('company_id').references(() => crmCompanies.id), // Property owner/seller company
  
  // Geographic/regional data
  city: text('city'),
  state: text('state'),
  region: text('region'), // e.g., "Southeast", "Great Lakes", etc.
  
  // Custom metrics - extensible field for user-defined metrics
  customMetrics: jsonb('custom_metrics').default(sql`'{}'`), // Flexible structure for additional fields
  
  // Metadata
  notes: text('notes'),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('modeling_projects_org_idx').on(table.orgId),
  outcomeIdx: index('modeling_projects_outcome_idx').on(table.dealOutcome),
  brokerIdx: index('modeling_projects_broker_idx').on(table.brokerId),
  ddProjectIdx: index('modeling_projects_dd_project_idx').on(table.ddProjectId),
  propertyIdx: index('modeling_projects_property_idx').on(table.propertyId),
  stateIdx: index('modeling_projects_state_idx').on(table.state),
  regionIdx: index('modeling_projects_region_idx').on(table.region),
  // Composite index for dashboard queries
  orgCreatedAtIdx: index('modeling_projects_org_created_at_idx').on(table.orgId, table.createdAt),
  orgOutcomeIdx: index('modeling_projects_org_outcome_idx').on(table.orgId, table.dealOutcome),
}));

// ================================================================================
// RBAC & ADVANCED COMPLIANCE SYSTEM
// ================================================================================

// User Roles - for RBAC system
export const userRoleEnum = pgEnum("user_role", [
  "owner", "admin", "editor", "viewer", "auditor"
]);

// Organization User Roles - maps users to organizations with roles
export const organizationUserRoles = pgTable('organization_user_roles', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  role: userRoleEnum('role').notNull().default('viewer'),
  permissions: jsonb('permissions').default(sql`'{}'`), // Custom permission overrides
  isActive: boolean('is_active').default(true).notNull(),
  assignedBy: varchar('assigned_by').references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('org_user_roles_org_idx').on(table.orgId),
  userIdx: index('org_user_roles_user_idx').on(table.userId),
  roleIdx: index('org_user_roles_role_idx').on(table.role),
  activeIdx: index('org_user_roles_active_idx').on(table.isActive),
  uniqueOrgUser: index('org_user_roles_unique').on(table.orgId, table.userId),
}));

// Relations for Fuel Sales
export const fuelSalesRelations = relations(fuelSales, ({ one }) => ({
  organization: one(organizations, {
    fields: [fuelSales.orgId],
    references: [organizations.id],
  }),
  processedByUser: one(users, {
    fields: [fuelSales.processedBy],
    references: [users.id],
  }),
}));

// Relations for Fuel Types
export const fuelTypesRelations = relations(fuelTypes, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [fuelTypes.orgId],
    references: [organizations.id],
  }),
  inventory: many(fuelInventory),
  deliveries: many(fuelDeliveries),
}));

// Relations for Fuel Inventory
export const fuelInventoryRelations = relations(fuelInventory, ({ one }) => ({
  organization: one(organizations, {
    fields: [fuelInventory.orgId],
    references: [organizations.id],
  }),
  fuelType: one(fuelTypes, {
    fields: [fuelInventory.fuelTypeId],
    references: [fuelTypes.id],
  }),
}));

// Relations for Fuel Deliveries
export const fuelDeliveriesRelations = relations(fuelDeliveries, ({ one }) => ({
  organization: one(organizations, {
    fields: [fuelDeliveries.orgId],
    references: [organizations.id],
  }),
  fuelType: one(fuelTypes, {
    fields: [fuelDeliveries.fuelTypeId],
    references: [fuelTypes.id],
  }),
}));

// Relations for Marina Customers
export const marinaCustomersRelations = relations(marinaCustomers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [marinaCustomers.orgId],
    references: [organizations.id],
  }),
  contact: one(crmContacts, {
    fields: [marinaCustomers.contactId],
    references: [crmContacts.id],
  }),
  company: one(crmCompanies, {
    fields: [marinaCustomers.companyId],
    references: [crmCompanies.id],
  }),
  primaryBoat: one(boatRegistry, {
    fields: [marinaCustomers.primaryBoatId],
    references: [boatRegistry.id],
  }),
  slipAssignments: many(slipAssignments),
  boats: many(boatRegistry),
  serviceUsage: many(serviceUsage),
}));

// Relations for Slip Assignments
export const slipAssignmentsRelations = relations(slipAssignments, ({ one }) => ({
  organization: one(organizations, {
    fields: [slipAssignments.orgId],
    references: [organizations.id],
  }),
  customer: one(marinaCustomers, {
    fields: [slipAssignments.customerId],
    references: [marinaCustomers.id],
  }),
}));

// Relations for Boat Registry
export const boatRegistryRelations = relations(boatRegistry, ({ one }) => ({
  organization: one(organizations, {
    fields: [boatRegistry.orgId],
    references: [organizations.id],
  }),
  customer: one(marinaCustomers, {
    fields: [boatRegistry.customerId],
    references: [marinaCustomers.id],
  }),
}));

// Relations for Service Usage
export const serviceUsageRelations = relations(serviceUsage, ({ one }) => ({
  organization: one(organizations, {
    fields: [serviceUsage.orgId],
    references: [organizations.id],
  }),
  customer: one(marinaCustomers, {
    fields: [serviceUsage.customerId],
    references: [marinaCustomers.id],
  }),
}));

// Relations for Fuel Financial Projections
export const fuelFinancialProjectionsRelations = relations(fuelFinancialProjections, ({ one }) => ({
  organization: one(organizations, {
    fields: [fuelFinancialProjections.orgId],
    references: [organizations.id],
  }),
}));

// Relations for Fuel Integrations
export const fuelIntegrationsRelations = relations(fuelIntegrations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [fuelIntegrations.orgId],
    references: [organizations.id],
  }),
  importLogs: many(fuelImportLogs),
}));

// Relations for Fuel Import Logs
export const fuelImportLogsRelations = relations(fuelImportLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [fuelImportLogs.orgId],
    references: [organizations.id],
  }),
  integration: one(fuelIntegrations, {
    fields: [fuelImportLogs.integrationId],
    references: [fuelIntegrations.id],
  }),
  createdByUser: one(users, {
    fields: [fuelImportLogs.createdBy],
    references: [users.id],
  }),
}));

// Relations for Rate Comps
export const rateCompsRelations = relations(rateComps, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [rateComps.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [rateComps.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [rateComps.updatedBy],
    references: [users.id],
  }),
  rcProjectComps: many(rcProjectComps),
}));

export const rateCompColumnsRelations = relations(rateCompColumns, ({ one }) => ({
  organization: one(organizations, {
    fields: [rateCompColumns.orgId],
    references: [organizations.id],
  }),
}));

export const rateCompImportsRelations = relations(rateCompImports, ({ one }) => ({
  organization: one(organizations, {
    fields: [rateCompImports.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [rateCompImports.createdBy],
    references: [users.id],
  }),
}));

export const rcProjectsRelations = relations(rcProjects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [rcProjects.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [rcProjects.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [rcProjects.updatedBy],
    references: [users.id],
  }),
  rcProjectComps: many(rcProjectComps),
}));

export const rcProjectCompsRelations = relations(rcProjectComps, ({ one }) => ({
  organization: one(organizations, {
    fields: [rcProjectComps.orgId],
    references: [organizations.id],
  }),
  rcProject: one(rcProjects, {
    fields: [rcProjectComps.rcProjectId],
    references: [rcProjects.id],
  }),
  rateComp: one(rateComps, {
    fields: [rcProjectComps.rateCompId],
    references: [rateComps.id],
  }),
  addedByUser: one(users, {
    fields: [rcProjectComps.addedBy],
    references: [users.id],
  }),
}));

export const rcRecommendationFeedbackRelations = relations(rcRecommendationFeedback, ({ one }) => ({
  organization: one(organizations, {
    fields: [rcRecommendationFeedback.orgId],
    references: [organizations.id],
  }),
  rcProject: one(rcProjects, {
    fields: [rcRecommendationFeedback.rcProjectId],
    references: [rcProjects.id],
  }),
  rateComp: one(rateComps, {
    fields: [rcRecommendationFeedback.rateCompId],
    references: [rateComps.id],
  }),
  user: one(users, {
    fields: [rcRecommendationFeedback.userId],
    references: [users.id],
  }),
}));

export const rcOrgPreferencesRelations = relations(rcOrgPreferences, ({ one }) => ({
  organization: one(organizations, {
    fields: [rcOrgPreferences.orgId],
    references: [organizations.id],
  }),
}));

export const rcPortfoliosRelations = relations(rcPortfolios, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [rcPortfolios.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [rcPortfolios.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [rcPortfolios.updatedBy],
    references: [users.id],
  }),
  rcPortfolioComps: many(rcPortfolioComps),
}));

export const rcPortfolioCompsRelations = relations(rcPortfolioComps, ({ one }) => ({
  organization: one(organizations, {
    fields: [rcPortfolioComps.orgId],
    references: [organizations.id],
  }),
  portfolio: one(rcPortfolios, {
    fields: [rcPortfolioComps.portfolioId],
    references: [rcPortfolios.id],
  }),
  rateComp: one(rateComps, {
    fields: [rcPortfolioComps.rateCompId],
    references: [rateComps.id],
  }),
  addedByUser: one(users, {
    fields: [rcPortfolioComps.addedBy],
    references: [users.id],
  }),
}));

export const rcMetricSeriesRelations = relations(rcMetricSeries, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [rcMetricSeries.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [rcMetricSeries.createdBy],
    references: [users.id],
  }),
  rcMetricPoints: many(rcMetricPoints),
  rcMetricAlerts: many(rcMetricAlerts),
}));

export const rcMetricPointsRelations = relations(rcMetricPoints, ({ one }) => ({
  organization: one(organizations, {
    fields: [rcMetricPoints.orgId],
    references: [organizations.id],
  }),
  series: one(rcMetricSeries, {
    fields: [rcMetricPoints.seriesId],
    references: [rcMetricSeries.id],
  }),
}));

export const rcMetricAlertsRelations = relations(rcMetricAlerts, ({ one }) => ({
  organization: one(organizations, {
    fields: [rcMetricAlerts.orgId],
    references: [organizations.id],
  }),
  series: one(rcMetricSeries, {
    fields: [rcMetricAlerts.seriesId],
    references: [rcMetricSeries.id],
  }),
  createdByUser: one(users, {
    fields: [rcMetricAlerts.createdBy],
    references: [users.id],
  }),
}));

// Zod schemas for Rate Comps
export const insertRateCompSchema = createInsertSchema(rateComps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRateCompSchema = insertRateCompSchema.partial().omit({
  orgId: true,
  createdBy: true,
});

export const insertRateCompColumnSchema = createInsertSchema(rateCompColumns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRateCompColumnSchema = insertRateCompColumnSchema.partial().omit({
  orgId: true,
});

export const insertRateCompImportSchema = createInsertSchema(rateCompImports).omit({
  id: true,
  createdAt: true,
});

export const insertRcProjectSchema = createInsertSchema(rcProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRcProjectSchema = insertRcProjectSchema.partial().omit({
  orgId: true,
  createdBy: true,
});

export const insertRcProjectCompSchema = createInsertSchema(rcProjectComps).omit({
  id: true,
  addedAt: true,
});

export const updateRcProjectCompSchema = insertRcProjectCompSchema.partial().omit({
  orgId: true,
  rcProjectId: true,
  rateCompId: true,
  addedBy: true,
});

export const insertRcRecommendationFeedbackSchema = createInsertSchema(rcRecommendationFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertRcOrgPreferencesSchema = createInsertSchema(rcOrgPreferences).omit({
  id: true,
  updatedAt: true,
});

export const updateRcOrgPreferencesSchema = insertRcOrgPreferencesSchema.partial().omit({
  orgId: true,
});

export const insertRcSavedSearchSchema = createInsertSchema(rcSavedSearches).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const updateRcSavedSearchSchema = insertRcSavedSearchSchema.partial();

export const insertRcPortfolioSchema = createInsertSchema(rcPortfolios).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const updateRcPortfolioSchema = insertRcPortfolioSchema.partial();

export const insertRcPortfolioCompSchema = createInsertSchema(rcPortfolioComps).omit({
  id: true,
  addedAt: true,
});

export const insertRcCustomStorageTypeSchema = createInsertSchema(rcCustomStorageTypes).omit({
  id: true,
  createdAt: true,
});

export const insertRcPendingPropertyProfileSchema = createInsertSchema(rcPendingPropertyProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertRcMetricSeriesSchema = createInsertSchema(rcMetricSeries).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRcMetricSeriesSchema = insertRcMetricSeriesSchema.partial();

export const insertRcMetricPointSchema = createInsertSchema(rcMetricPoints).omit({
  id: true,
  orgId: true,
  createdAt: true,
});

export const insertRcMetricAlertSchema = createInsertSchema(rcMetricAlerts).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRcMetricAlertSchema = insertRcMetricAlertSchema.partial();

// Fuel Sales
export const insertFuelSaleSchema = createInsertSchema(fuelSales).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  quantityGallons: z.string().or(z.number()),
  pricePerGallon: z.string().or(z.number()),
  totalAmount: z.string().or(z.number()),
});

export const updateFuelSaleSchema = insertFuelSaleSchema.partial();

// Fuel Types
export const insertFuelTypeSchema = createInsertSchema(fuelTypes).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  currentPrice: z.string().or(z.number()),
  cost: z.string().or(z.number()),
});

export const updateFuelTypeSchema = insertFuelTypeSchema.partial();

// Fuel Inventory
export const insertFuelInventorySchema = createInsertSchema(fuelInventory).omit({
  id: true,
  orgId: true,
  lastUpdated: true,
  createdAt: true,
}).extend({
  currentLevel: z.string().or(z.number()),
  capacity: z.string().or(z.number()),
  reorderPoint: z.string().or(z.number()),
  reorderQuantity: z.string().or(z.number()),
});

export const updateFuelInventorySchema = insertFuelInventorySchema.partial();

// Fuel Deliveries
export const insertFuelDeliverySchema = createInsertSchema(fuelDeliveries).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  quantity: z.string().or(z.number()),
  cost: z.string().or(z.number()),
  pricePerGallon: z.string().or(z.number()).optional(),
});

export const updateFuelDeliverySchema = insertFuelDeliverySchema.partial();

// Fuel Financial Projections
export const insertFuelProjectionSchema = createInsertSchema(fuelFinancialProjections).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  projectedRevenue: z.string().or(z.number()),
  projectedGallons: z.string().or(z.number()),
  projectedCosts: z.string().or(z.number()),
  growthRate: z.string().or(z.number()),
});

export const updateFuelProjectionSchema = insertFuelProjectionSchema.partial();

// Fuel Integrations
export const insertFuelIntegrationSchema = createInsertSchema(fuelIntegrations).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateFuelIntegrationSchema = insertFuelIntegrationSchema.partial();

// Fuel Import Logs
export const insertFuelImportLogSchema = createInsertSchema(fuelImportLogs).omit({
  id: true,
  orgId: true,
  createdAt: true,
});

export const updateFuelImportLogSchema = insertFuelImportLogSchema.partial();

// Customer Analytics
export const insertMarinaCustomerSchema = createInsertSchema(marinaCustomers).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMarinaCustomerSchema = insertMarinaCustomerSchema.partial();

export const insertSlipAssignmentSchema = createInsertSchema(slipAssignments).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSlipAssignmentSchema = insertSlipAssignmentSchema.partial().omit({
  customerId: true,
});

export const insertBoatRegistrySchema = createInsertSchema(boatRegistry).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  length: z.string().or(z.number()).optional(),
});

export const updateBoatRegistrySchema = insertBoatRegistrySchema.partial().omit({
  customerId: true,
});

export const insertServiceUsageSchema = createInsertSchema(serviceUsage).omit({
  id: true,
  orgId: true,
  createdAt: true,
}).extend({
  amount: z.string().or(z.number()),
  quantity: z.string().or(z.number()).optional(),
});

export const updateServiceUsageSchema = insertServiceUsageSchema.partial();

// Debt Scenarios
export const insertDebtScenarioSchema = createInsertSchema(debtScenarios).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  purchasePrice: z.string().or(z.number()),
  loanAmount: z.string().or(z.number()),
  noi: z.string().or(z.number()),
});

export const updateDebtScenarioSchema = insertDebtScenarioSchema.partial();

// RC Project profile validation (reuse same schema as SC)
export const rcProjectProfileSchema = scProjectProfileSchema;
export const rcWeightOverridesSchema = scWeightOverridesSchema;

// Types for Rate Comps
export type RateComp = typeof rateComps.$inferSelect;
export type InsertRateComp = z.infer<typeof insertRateCompSchema>;
export type UpdateRateComp = z.infer<typeof updateRateCompSchema>;
export type RateCompColumn = typeof rateCompColumns.$inferSelect;
export type InsertRateCompColumn = z.infer<typeof insertRateCompColumnSchema>;
export type UpdateRateCompColumn = z.infer<typeof updateRateCompColumnSchema>;
export type RateCompImport = typeof rateCompImports.$inferSelect;
export type InsertRateCompImport = z.infer<typeof insertRateCompImportSchema>;
export type RcAuditLog = typeof rcAuditLog.$inferSelect;
export type RcProject = typeof rcProjects.$inferSelect;
export type InsertRcProject = z.infer<typeof insertRcProjectSchema>;
export type UpdateRcProject = z.infer<typeof updateRcProjectSchema>;
export type RcProjectComp = typeof rcProjectComps.$inferSelect;
export type InsertRcProjectComp = z.infer<typeof insertRcProjectCompSchema>;
export type UpdateRcProjectComp = z.infer<typeof updateRcProjectCompSchema>;
export type RcRecommendationFeedback = typeof rcRecommendationFeedback.$inferSelect;
export type InsertRcRecommendationFeedback = z.infer<typeof insertRcRecommendationFeedbackSchema>;
export type RcOrgPreferences = typeof rcOrgPreferences.$inferSelect;
export type InsertRcOrgPreferences = z.infer<typeof insertRcOrgPreferencesSchema>;
export type UpdateRcOrgPreferences = z.infer<typeof updateRcOrgPreferencesSchema>;
export type RcProjectProfile = z.infer<typeof rcProjectProfileSchema>;
export type RcWeightOverrides = z.infer<typeof rcWeightOverridesSchema>;
export type RcSavedSearch = typeof rcSavedSearches.$inferSelect;
export type InsertRcSavedSearch = z.infer<typeof insertRcSavedSearchSchema>;
export type UpdateRcSavedSearch = z.infer<typeof updateRcSavedSearchSchema>;
export type RcPortfolio = typeof rcPortfolios.$inferSelect;
export type InsertRcPortfolio = z.infer<typeof insertRcPortfolioSchema>;
export type UpdateRcPortfolio = z.infer<typeof updateRcPortfolioSchema>;
export type RcPortfolioComp = typeof rcPortfolioComps.$inferSelect;
export type InsertRcPortfolioComp = z.infer<typeof insertRcPortfolioCompSchema>;
export type RcCustomStorageType = typeof rcCustomStorageTypes.$inferSelect;
export type InsertRcCustomStorageType = z.infer<typeof insertRcCustomStorageTypeSchema>;
export type RcPendingPropertyProfile = typeof rcPendingPropertyProfiles.$inferSelect;
export type InsertRcPendingPropertyProfile = z.infer<typeof insertRcPendingPropertyProfileSchema>;
export type RcMetricSeries = typeof rcMetricSeries.$inferSelect;
export type InsertRcMetricSeries = z.infer<typeof insertRcMetricSeriesSchema>;
export type UpdateRcMetricSeries = z.infer<typeof updateRcMetricSeriesSchema>;
export type RcMetricPoint = typeof rcMetricPoints.$inferSelect;
export type InsertRcMetricPoint = z.infer<typeof insertRcMetricPointSchema>;
export type RcMetricAlert = typeof rcMetricAlerts.$inferSelect;
export type InsertRcMetricAlert = z.infer<typeof insertRcMetricAlertSchema>;
export type UpdateRcMetricAlert = z.infer<typeof updateRcMetricAlertSchema>;

// Types for Fuel Sales
export type FuelSale = typeof fuelSales.$inferSelect;
export type InsertFuelSale = z.infer<typeof insertFuelSaleSchema>;
export type UpdateFuelSale = z.infer<typeof updateFuelSaleSchema>;

// Types for Fuel Types
export type FuelType = typeof fuelTypes.$inferSelect;
export type InsertFuelType = z.infer<typeof insertFuelTypeSchema>;
export type UpdateFuelType = z.infer<typeof updateFuelTypeSchema>;

// Types for Fuel Inventory
export type FuelInventory = typeof fuelInventory.$inferSelect;
export type InsertFuelInventory = z.infer<typeof insertFuelInventorySchema>;
export type UpdateFuelInventory = z.infer<typeof updateFuelInventorySchema>;

// Types for Fuel Deliveries
export type FuelDelivery = typeof fuelDeliveries.$inferSelect;
export type InsertFuelDelivery = z.infer<typeof insertFuelDeliverySchema>;
export type UpdateFuelDelivery = z.infer<typeof updateFuelDeliverySchema>;

// Types for Fuel Projections
export type FuelProjection = typeof fuelFinancialProjections.$inferSelect;
export type InsertFuelProjection = z.infer<typeof insertFuelProjectionSchema>;
export type UpdateFuelProjection = z.infer<typeof updateFuelProjectionSchema>;

// Types for Fuel Integrations
export type FuelIntegration = typeof fuelIntegrations.$inferSelect;
export type InsertFuelIntegration = z.infer<typeof insertFuelIntegrationSchema>;
export type UpdateFuelIntegration = z.infer<typeof updateFuelIntegrationSchema>;

// Types for Fuel Import Logs
export type FuelImportLog = typeof fuelImportLogs.$inferSelect;
export type InsertFuelImportLog = z.infer<typeof insertFuelImportLogSchema>;
export type UpdateFuelImportLog = z.infer<typeof updateFuelImportLogSchema>;

// Types for Customer Analytics
export type MarinaCustomer = typeof marinaCustomers.$inferSelect;
export type InsertMarinaCustomer = z.infer<typeof insertMarinaCustomerSchema>;
export type UpdateMarinaCustomer = z.infer<typeof updateMarinaCustomerSchema>;

export type SlipAssignment = typeof slipAssignments.$inferSelect;
export type InsertSlipAssignment = z.infer<typeof insertSlipAssignmentSchema>;
export type UpdateSlipAssignment = z.infer<typeof updateSlipAssignmentSchema>;

export type BoatRegistry = typeof boatRegistry.$inferSelect;
export type InsertBoatRegistry = z.infer<typeof insertBoatRegistrySchema>;
export type UpdateBoatRegistry = z.infer<typeof updateBoatRegistrySchema>;

export type ServiceUsage = typeof serviceUsage.$inferSelect;
export type InsertServiceUsage = z.infer<typeof insertServiceUsageSchema>;
export type UpdateServiceUsage = z.infer<typeof updateServiceUsageSchema>;

// Types for Debt Scenarios
export type DebtScenario = typeof debtScenarios.$inferSelect;
export type InsertDebtScenario = z.infer<typeof insertDebtScenarioSchema>;
export type UpdateDebtScenario = z.infer<typeof updateDebtScenarioSchema>;

// Rent Roll schemas
export const insertRentRollSchema = createInsertSchema(rentRolls).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRentRollSchema = insertRentRollSchema.partial();

export const insertRentRollEntrySchema = createInsertSchema(rentRollEntries).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  monthlyRate: z.string().or(z.number()),
});

export const updateRentRollEntrySchema = insertRentRollEntrySchema.partial().omit({
  rentRollId: true,
});

// Types for Rent Rolls
export type RentRoll = typeof rentRolls.$inferSelect;
export type InsertRentRoll = z.infer<typeof insertRentRollSchema>;
export type UpdateRentRoll = z.infer<typeof updateRentRollSchema>;

export type RentRollEntry = typeof rentRollEntries.$inferSelect;
export type InsertRentRollEntry = z.infer<typeof insertRentRollEntrySchema>;
export type UpdateRentRollEntry = z.infer<typeof updateRentRollEntrySchema>;

// Marketing Campaign schemas
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  budgetPlanned: z.string().or(z.number()).optional(),
  budgetActual: z.string().or(z.number()).optional(),
  goalRevenue: z.string().or(z.number()).optional(),
  goalRoas: z.string().or(z.number()).optional(),
});

export const updateMarketingCampaignSchema = insertMarketingCampaignSchema.partial();

// Marketing Expense schemas
export const insertMarketingExpenseSchema = createInsertSchema(marketingExpenses).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  approvedBy: true,
  approvedAt: true,
}).extend({
  amount: z.string().or(z.number()),
});

export const updateMarketingExpenseSchema = insertMarketingExpenseSchema.partial();

// Lead Attribution schemas
export const insertLeadAttributionSchema = createInsertSchema(leadAttribution).omit({
  id: true,
  orgId: true,
  createdAt: true,
}).extend({
  revenue: z.string().or(z.number()).optional(),
});

// Email Campaign schemas
export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  orgId: true,
  createdAt: true,
  syncedAt: true,
}).extend({
  openRate: z.string().or(z.number()).optional(),
  clickRate: z.string().or(z.number()).optional(),
  conversionRate: z.string().or(z.number()).optional(),
});

// Types for Marketing
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;
export type UpdateMarketingCampaign = z.infer<typeof updateMarketingCampaignSchema>;

export type MarketingExpense = typeof marketingExpenses.$inferSelect;
export type InsertMarketingExpense = z.infer<typeof insertMarketingExpenseSchema>;
export type UpdateMarketingExpense = z.infer<typeof updateMarketingExpenseSchema>;

export type LeadAttribution = typeof leadAttribution.$inferSelect;
export type InsertLeadAttribution = z.infer<typeof insertLeadAttributionSchema>;

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;

// Modeling Projects schemas
export const insertModelingProjectSchema = createInsertSchema(modelingProjects).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
}).extend({
  purchasePrice: z.string().or(z.number()).optional(),
  year1CapRate: z.string().or(z.number()).optional(),
  totalStorageUnits: z.string().or(z.number()).optional(),
  ebitda: z.string().or(z.number()).optional(),
});

export const updateModelingProjectSchema = insertModelingProjectSchema.partial();

export type ModelingProject = typeof modelingProjects.$inferSelect;
export type InsertModelingProject = z.infer<typeof insertModelingProjectSchema>;
export type UpdateModelingProject = z.infer<typeof updateModelingProjectSchema>;

// Persona Feature Flags schemas
export const insertPersonaFeatureFlagSchema = createInsertSchema(personaFeatureFlags).omit({
  id: true,
  createdAt: true,
});

export const updatePersonaFeatureFlagSchema = insertPersonaFeatureFlagSchema.partial();

// User Persona Assignments schemas
export const insertUserPersonaAssignmentSchema = createInsertSchema(userPersonaAssignments).omit({
  id: true,
  userId: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserPersonaAssignmentSchema = insertUserPersonaAssignmentSchema.partial();

// Dashboard Widgets schemas
export const insertDashboardWidgetSchema = createInsertSchema(dashboardWidgets).omit({
  id: true,
  createdAt: true,
});

export const updateDashboardWidgetSchema = insertDashboardWidgetSchema.partial();

// User Dashboard Layouts schemas
export const insertUserDashboardLayoutSchema = createInsertSchema(userDashboardLayouts).omit({
  id: true,
  userId: true,
  orgId: true,
  lastModified: true,
});

export const updateUserDashboardLayoutSchema = insertUserDashboardLayoutSchema.partial();

// Owned Assets schemas
export const insertOwnedAssetSchema = createInsertSchema(ownedAssets).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  acquisitionPrice: z.string().or(z.number()).optional(),
});

export const updateOwnedAssetSchema = insertOwnedAssetSchema.partial();

// Asset Performance Snapshots schemas
export const insertAssetPerformanceSnapshotSchema = createInsertSchema(assetPerformanceSnapshots).omit({
  id: true,
  createdAt: true,
});

export const updateAssetPerformanceSnapshotSchema = insertAssetPerformanceSnapshotSchema.partial();

// Types for Persona System
export type PersonaFeatureFlag = typeof personaFeatureFlags.$inferSelect;
export type InsertPersonaFeatureFlag = z.infer<typeof insertPersonaFeatureFlagSchema>;
export type UpdatePersonaFeatureFlag = z.infer<typeof updatePersonaFeatureFlagSchema>;

export type UserPersonaAssignment = typeof userPersonaAssignments.$inferSelect;
export type InsertUserPersonaAssignment = z.infer<typeof insertUserPersonaAssignmentSchema>;
export type UpdateUserPersonaAssignment = z.infer<typeof updateUserPersonaAssignmentSchema>;

// Types for Dashboard System
export type DashboardWidget = typeof dashboardWidgets.$inferSelect;
export type InsertDashboardWidget = z.infer<typeof insertDashboardWidgetSchema>;
export type UpdateDashboardWidget = z.infer<typeof updateDashboardWidgetSchema>;

export type UserDashboardLayout = typeof userDashboardLayouts.$inferSelect;
export type InsertUserDashboardLayout = z.infer<typeof insertUserDashboardLayoutSchema>;
export type UpdateUserDashboardLayout = z.infer<typeof updateUserDashboardLayoutSchema>;

// Types for Owned Assets
export type OwnedAsset = typeof ownedAssets.$inferSelect;
export type InsertOwnedAsset = z.infer<typeof insertOwnedAssetSchema>;
export type UpdateOwnedAsset = z.infer<typeof updateOwnedAssetSchema>;

export type AssetPerformanceSnapshot = typeof assetPerformanceSnapshots.$inferSelect;
export type InsertAssetPerformanceSnapshot = z.infer<typeof insertAssetPerformanceSnapshotSchema>;
export type UpdateAssetPerformanceSnapshot = z.infer<typeof updateAssetPerformanceSnapshotSchema>;

// ============================================================================
// VDR (Virtual Data Room) Schemas and Types
// ============================================================================

// VDR Folders
export const insertVdrFolderSchema = createInsertSchema(vdrFolders).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateVdrFolderSchema = insertVdrFolderSchema.partial();

export type VdrFolder = typeof vdrFolders.$inferSelect;
export type InsertVdrFolder = z.infer<typeof insertVdrFolderSchema>;
export type UpdateVdrFolder = z.infer<typeof updateVdrFolderSchema>;

// VDR Documents
export const insertVdrDocumentSchema = createInsertSchema(vdrDocuments).omit({
  id: true,
  orgId: true,
  uploadedBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateVdrDocumentSchema = insertVdrDocumentSchema.partial();

export type VdrDocument = typeof vdrDocuments.$inferSelect;
export type InsertVdrDocument = z.infer<typeof insertVdrDocumentSchema>;
export type UpdateVdrDocument = z.infer<typeof updateVdrDocumentSchema>;

// VDR Document Permissions
export const insertVdrDocumentPermissionSchema = createInsertSchema(vdrDocumentPermissions).omit({
  id: true,
  orgId: true,
  grantedBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateVdrDocumentPermissionSchema = insertVdrDocumentPermissionSchema.partial();

export type VdrDocumentPermission = typeof vdrDocumentPermissions.$inferSelect;
export type InsertVdrDocumentPermission = z.infer<typeof insertVdrDocumentPermissionSchema>;
export type UpdateVdrDocumentPermission = z.infer<typeof updateVdrDocumentPermissionSchema>;

// VDR Watermarks
export const insertVdrWatermarkSchema = createInsertSchema(vdrWatermarks).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
});

export const updateVdrWatermarkSchema = insertVdrWatermarkSchema.partial();

export type VdrWatermark = typeof vdrWatermarks.$inferSelect;
export type InsertVdrWatermark = z.infer<typeof insertVdrWatermarkSchema>;
export type UpdateVdrWatermark = z.infer<typeof updateVdrWatermarkSchema>;

// VDR Audit Logs
export const insertVdrAuditLogSchema = createInsertSchema(vdrAuditLogs).omit({
  id: true,
  orgId: true,
  timestamp: true,
});

export type VdrAuditLog = typeof vdrAuditLogs.$inferSelect;
export type InsertVdrAuditLog = z.infer<typeof insertVdrAuditLogSchema>;

// VDR Templates
export const insertVdrTemplateSchema = createInsertSchema(vdrTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateVdrTemplateSchema = insertVdrTemplateSchema.partial();

export type VdrTemplate = typeof vdrTemplates.$inferSelect;
export type InsertVdrTemplate = z.infer<typeof insertVdrTemplateSchema>;
export type UpdateVdrTemplate = z.infer<typeof updateVdrTemplateSchema>;

// VDR Template Folders
export const insertVdrTemplateFolderSchema = createInsertSchema(vdrTemplateFolders).omit({
  id: true,
  createdAt: true,
});

export type VdrTemplateFolder = typeof vdrTemplateFolders.$inferSelect;
export type InsertVdrTemplateFolder = z.infer<typeof insertVdrTemplateFolderSchema>;

// ============================================================================
// Diligence Request Management Schemas and Types
// ============================================================================

// Diligence Requests
export const insertDiligenceRequestSchema = createInsertSchema(diligenceRequests).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDiligenceRequestSchema = insertDiligenceRequestSchema.partial();

export type DiligenceRequest = typeof diligenceRequests.$inferSelect;
export type InsertDiligenceRequest = z.infer<typeof insertDiligenceRequestSchema>;
export type UpdateDiligenceRequest = z.infer<typeof updateDiligenceRequestSchema>;

// Request Documents (junction table)
export const insertRequestDocumentSchema = createInsertSchema(requestDocuments).omit({
  createdAt: true,
});

export type RequestDocument = typeof requestDocuments.$inferSelect;
export type InsertRequestDocument = z.infer<typeof insertRequestDocumentSchema>;

// Request Comments
export const insertRequestCommentSchema = createInsertSchema(requestComments).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRequestCommentSchema = insertRequestCommentSchema.partial();

export type RequestComment = typeof requestComments.$inferSelect;
export type InsertRequestComment = z.infer<typeof insertRequestCommentSchema>;
export type UpdateRequestComment = z.infer<typeof updateRequestCommentSchema>;

// Request Templates
export const insertRequestTemplateSchema = createInsertSchema(requestTemplates).omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRequestTemplateSchema = insertRequestTemplateSchema.partial();

export type RequestTemplate = typeof requestTemplates.$inferSelect;
export type InsertRequestTemplate = z.infer<typeof insertRequestTemplateSchema>;
export type UpdateRequestTemplate = z.infer<typeof updateRequestTemplateSchema>;

// ============================================================================
// VDR Data Request Schemas and Types
// ============================================================================

// VDR Data Request Templates
export const insertVdrDataRequestTemplateSchema = createInsertSchema(vdrDataRequestTemplates).omit({
  id: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateVdrDataRequestTemplateSchema = insertVdrDataRequestTemplateSchema.partial();

export type VdrDataRequestTemplate = typeof vdrDataRequestTemplates.$inferSelect;
export type InsertVdrDataRequestTemplate = z.infer<typeof insertVdrDataRequestTemplateSchema>;
export type UpdateVdrDataRequestTemplate = z.infer<typeof updateVdrDataRequestTemplateSchema>;

// VDR Data Request Items
export const insertVdrDataRequestItemSchema = createInsertSchema(vdrDataRequestItems).omit({
  id: true,
  orgId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateVdrDataRequestItemSchema = insertVdrDataRequestItemSchema.partial();

export type VdrDataRequestItem = typeof vdrDataRequestItems.$inferSelect;
export type InsertVdrDataRequestItem = z.infer<typeof insertVdrDataRequestItemSchema>;
export type UpdateVdrDataRequestItem = z.infer<typeof updateVdrDataRequestItemSchema>;

// ============================================================================
// External User Management Schemas and Types
// ============================================================================

// External Users
export const insertExternalUserSchema = createInsertSchema(externalUsers).omit({
  id: true,
  orgId: true,
  createdAt: true,
});

export const updateExternalUserSchema = insertExternalUserSchema.partial();

export type ExternalUser = typeof externalUsers.$inferSelect;
export type InsertExternalUser = z.infer<typeof insertExternalUserSchema>;
export type UpdateExternalUser = z.infer<typeof updateExternalUserSchema>;

// External User Project Access
export const insertExternalUserProjectAccessSchema = createInsertSchema(externalUserProjectAccess).omit({
  id: true,
  orgId: true,
  createdAt: true,
});

export const updateExternalUserProjectAccessSchema = insertExternalUserProjectAccessSchema.partial();

export type ExternalUserProjectAccess = typeof externalUserProjectAccess.$inferSelect;
export type InsertExternalUserProjectAccess = z.infer<typeof insertExternalUserProjectAccessSchema>;
export type UpdateExternalUserProjectAccess = z.infer<typeof updateExternalUserProjectAccessSchema>;

// ============================================================================
// Ship Store Module - Product Inventory and POS
// ============================================================================

export const shipStoreCategories = pgTable("ship_store_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shipStoreProducts = pgTable("ship_store_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  categoryId: varchar("category_id").references(() => shipStoreCategories.id),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  stock: integer("stock").default(0),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  barcode: text("barcode"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCategorySchema = createInsertSchema(shipStoreCategories).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(shipStoreProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ShipStoreCategory = typeof shipStoreCategories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type ShipStoreProduct = typeof shipStoreProducts.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export const shipStoreTransactions = pgTable("ship_store_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentIntentId: text("payment_intent_id"),
  status: text("status").default("completed"),
  customerId: varchar("customer_id"),
  customerType: text("customer_type"),
  customerName: text("customer_name"),
  items: jsonb("items").$type<Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    sku: string;
  }>>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Performance index for dashboard revenue queries
  createdAtIdx: index('ship_store_transactions_created_at_idx').on(table.createdAt),
}));

export const insertTransactionSchema = createInsertSchema(shipStoreTransactions).omit({
  id: true,
  createdAt: true,
});

export type ShipStoreTransaction = typeof shipStoreTransactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export const shipStoreFinancialMetrics = pgTable("ship_store_financial_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  period: text("period").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }),
  totalTransactions: integer("total_transactions"),
  averageOrderValue: decimal("average_order_value", { precision: 10, scale: 2 }),
  grossMargin: decimal("gross_margin", { precision: 5, scale: 2 }),
  operatingCosts: decimal("operating_costs", { precision: 10, scale: 2 }),
  netProfit: decimal("net_profit", { precision: 10, scale: 2 }),
  topCategories: jsonb("top_categories").$type<Array<{
    categoryId: string;
    name: string;
    revenue: number;
    percentage: number;
  }>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shipStoreSettings = pgTable("ship_store_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeName: text("store_name").default("Ship Store"),
  address: text("address"),
  phone: text("phone"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }).default("8.25"),
  currency: text("currency").default("USD"),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  autoSync: boolean("auto_sync").default(true),
  emailReceipts: boolean("email_receipts").default(false),
  lowStockAlerts: boolean("low_stock_alerts").default(true),
  stripePublishableKey: text("stripe_publishable_key"),
  stripeSecretKey: text("stripe_secret_key"),
  squareApplicationId: text("square_application_id"),
  quickbooksConnected: boolean("quickbooks_connected").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shipStoreScenarios = pgTable("ship_store_scenarios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  scenarioType: text("scenario_type").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shipStoreAssumptions = pgTable("ship_store_assumptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scenarioId: varchar("scenario_id").references(() => shipStoreScenarios.id).notNull().unique(),
  revenueGrowthRate: decimal("revenue_growth_rate", { precision: 5, scale: 2 }),
  monthlyRevenueGrowth: decimal("monthly_revenue_growth", { precision: 5, scale: 2 }),
  seasonalityFactors: jsonb("seasonality_factors").$type<{
    [month: number]: number;
  }>(),
  cogsPercentage: decimal("cogs_percentage", { precision: 5, scale: 2 }),
  operatingExpenseGrowth: decimal("opex_growth", { precision: 5, scale: 2 }),
  fixedCosts: decimal("fixed_costs", { precision: 10, scale: 2 }),
  targetGrossMargin: decimal("target_gross_margin", { precision: 5, scale: 2 }),
  targetOperatingMargin: decimal("target_operating_margin", { precision: 5, scale: 2 }),
  newProductLaunchImpact: jsonb("new_product_impact").$type<Array<{
    month: number;
    year: number;
    revenueIncrease: number;
    description: string;
  }>>(),
  categoryGrowthRates: jsonb("category_growth_rates").$type<{
    [categoryId: string]: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shipStoreProjections = pgTable("ship_store_projections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scenarioId: varchar("scenario_id").references(() => shipStoreScenarios.id).notNull(),
  period: text("period").notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month"),
  periodQuarter: integer("period_quarter"),
  projectedRevenue: decimal("projected_revenue", { precision: 12, scale: 2 }),
  projectedCOGS: decimal("projected_cogs", { precision: 12, scale: 2 }),
  projectedGrossProfit: decimal("projected_gross_profit", { precision: 12, scale: 2 }),
  projectedOpex: decimal("projected_opex", { precision: 12, scale: 2 }),
  projectedNetIncome: decimal("projected_net_income", { precision: 12, scale: 2 }),
  grossMarginPercent: decimal("gross_margin_percent", { precision: 5, scale: 2 }),
  operatingMarginPercent: decimal("operating_margin_percent", { precision: 5, scale: 2 }),
  netMarginPercent: decimal("net_margin_percent", { precision: 5, scale: 2 }),
  categoryBreakdown: jsonb("category_breakdown").$type<Array<{
    categoryId: string;
    categoryName: string;
    revenue: number;
    percentage: number;
  }>>(),
  calculationMetadata: jsonb("calculation_metadata").$type<{
    basedOnHistorical: boolean;
    dataPoints: number;
    confidence: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shipStoreHistoricalData = pgTable("ship_store_historical_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dataSource: text("data_source").notNull(),
  period: text("period").notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month"),
  periodQuarter: integer("period_quarter"),
  revenue: decimal("revenue", { precision: 12, scale: 2 }),
  cogs: decimal("cogs", { precision: 12, scale: 2 }),
  grossProfit: decimal("gross_profit", { precision: 12, scale: 2 }),
  operatingExpenses: decimal("operating_expenses", { precision: 12, scale: 2 }),
  netIncome: decimal("net_income", { precision: 12, scale: 2 }),
  transactionCount: integer("transaction_count"),
  averageOrderValue: decimal("average_order_value", { precision: 10, scale: 2 }),
  categoryData: jsonb("category_data").$type<Array<{
    categoryId?: string;
    categoryName: string;
    revenue: number;
    units: number;
  }>>(),
  importMetadata: jsonb("import_metadata").$type<{
    fileName?: string;
    importedAt?: string;
    mappings?: { [key: string]: string };
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shipStoreAuditLogs = pgTable("ship_store_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  changedFields: jsonb("changed_fields").$type<string[]>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").$type<{
    reason?: string;
    source?: string;
    recordCount?: number;
    [key: string]: any;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for remaining tables
export const insertStoreSettingsSchema = createInsertSchema(shipStoreSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertScenarioSchema = createInsertSchema(shipStoreScenarios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssumptionSchema = createInsertSchema(shipStoreAssumptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectionSchema = createInsertSchema(shipStoreProjections).omit({
  id: true,
  createdAt: true,
});

export const insertHistoricalDataSchema = createInsertSchema(shipStoreHistoricalData).omit({
  id: true,
  createdAt: true,
});

export const insertShipStoreAuditLogSchema = createInsertSchema(shipStoreAuditLogs).omit({
  id: true,
  createdAt: true,
});

// Types for remaining tables
export type ShipStoreFinancialMetric = typeof shipStoreFinancialMetrics.$inferSelect;
export type ShipStoreSettings = typeof shipStoreSettings.$inferSelect;
export type InsertStoreSettings = z.infer<typeof insertStoreSettingsSchema>;
export type ShipStoreScenario = typeof shipStoreScenarios.$inferSelect;
export type InsertScenario = z.infer<typeof insertScenarioSchema>;
export type ShipStoreAssumption = typeof shipStoreAssumptions.$inferSelect;
export type InsertAssumption = z.infer<typeof insertAssumptionSchema>;
export type ShipStoreProjection = typeof shipStoreProjections.$inferSelect;
export type InsertProjection = z.infer<typeof insertProjectionSchema>;
export type ShipStoreHistoricalData = typeof shipStoreHistoricalData.$inferSelect;
export type InsertHistoricalData = z.infer<typeof insertHistoricalDataSchema>;
export type ShipStoreAuditLog = typeof shipStoreAuditLogs.$inferSelect;
export type InsertShipStoreAuditLog = z.infer<typeof insertShipStoreAuditLogSchema>;

// Backward compatibility aliases for server/ship-store-router.ts
// Note: auditLogs alias omitted to avoid conflict with main app audit logs
export { shipStoreCategories as categories };
export { shipStoreProducts as products };
export { shipStoreTransactions as transactions };
export { shipStoreSettings as storeSettings };
export { shipStoreScenarios as scenarios };
export { shipStoreAssumptions as assumptions };
export { shipStoreProjections as projections };
export { shipStoreHistoricalData as historicalData };

export type Category = ShipStoreCategory;
export type Product = ShipStoreProduct;
export type Transaction = ShipStoreTransaction;
export type StoreSettings = ShipStoreSettings;
export type Scenario = ShipStoreScenario;
export type Assumption = ShipStoreAssumption;
export type Projection = ShipStoreProjection;
export type HistoricalData = ShipStoreHistoricalData;

// DockTalk Intelligence Features - Zod Schemas and Types
export const insertDocktalkEntitySchema = createInsertSchema(docktalkEntities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocktalkPortfolioCompanySchema = createInsertSchema(docktalkPortfolioCompanies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocktalkSavedSearchSchema = createInsertSchema(docktalkSavedSearches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAlertSent: true,
});

export const insertDocktalkWatchlistSchema = createInsertSchema(docktalkWatchlists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAlertSent: true,
});

export const insertDocktalkWatchlistEntitySchema = createInsertSchema(docktalkWatchlistEntities).omit({
  id: true,
  addedAt: true,
});

export const insertDocktalkUserPreferencesSchema = createInsertSchema(docktalkUserPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocktalkArticleRemovalPatternSchema = createInsertSchema(docktalkArticleRemovalPatterns).omit({
  id: true,
  removedAt: true,
});

export const insertDocktalkNotificationPreferencesSchema = createInsertSchema(docktalkNotificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSentAt: true,
});

// DockTalk Intelligence Features - Type Exports
export type DocktalkEntity = typeof docktalkEntities.$inferSelect;
export type InsertDocktalkEntity = z.infer<typeof insertDocktalkEntitySchema>;

export type DocktalkPortfolioCompany = typeof docktalkPortfolioCompanies.$inferSelect;
export type InsertDocktalkPortfolioCompany = z.infer<typeof insertDocktalkPortfolioCompanySchema>;

export type DocktalkSavedSearch = typeof docktalkSavedSearches.$inferSelect;
export type InsertDocktalkSavedSearch = z.infer<typeof insertDocktalkSavedSearchSchema>;

export type DocktalkWatchlist = typeof docktalkWatchlists.$inferSelect;
export type InsertDocktalkWatchlist = z.infer<typeof insertDocktalkWatchlistSchema>;

export type DocktalkWatchlistEntity = typeof docktalkWatchlistEntities.$inferSelect;
export type InsertDocktalkWatchlistEntity = z.infer<typeof insertDocktalkWatchlistEntitySchema>;

export type DocktalkUserPreferences = typeof docktalkUserPreferences.$inferSelect;
export type InsertDocktalkUserPreferences = z.infer<typeof insertDocktalkUserPreferencesSchema>;

export type DocktalkArticleRemovalPattern = typeof docktalkArticleRemovalPatterns.$inferSelect;
export type InsertDocktalkArticleRemovalPattern = z.infer<typeof insertDocktalkArticleRemovalPatternSchema>;

export type DocktalkNotificationPreferences = typeof docktalkNotificationPreferences.$inferSelect;
export type InsertDocktalkNotificationPreferences = z.infer<typeof insertDocktalkNotificationPreferencesSchema>;

// ============================================================================
// DockTalk 2.0 Schema Integration
// Re-export all DockTalk tables, types, and schemas from docktalk-schema.ts
// This makes them discoverable to Drizzle migrations while keeping schemas modular
// ============================================================================
export * from "./docktalk-schema";
