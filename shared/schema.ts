import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, boolean, jsonb, pgEnum, primaryKey, unique, index, customType, decimal, numeric, real, time } from "drizzle-orm/pg-core";
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
export const dealSourceEnum = pgEnum("deal_source", ["direct_to_seller", "broker", "owned_marina"]);

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
export const nwcBucketTypeEnum = pgEnum("nwc_bucket_type", ["current_asset", "current_liability", "nwc_adjustment"]);

// Prospecting enums
export const prospectingActivityTypeEnum = pgEnum("prospecting_activity_type", ["call", "email", "meeting", "voicemail", "text", "linkedin", "other"]);
export const prospectingActivityDirectionEnum = pgEnum("prospecting_activity_direction", ["outbound", "inbound", "internal"]);
export const prospectingActivityOutcomeEnum = pgEnum("prospecting_activity_outcome", ["connected", "no_answer", "left_message", "wrong_number", "gatekeeper", "not_interested", "interested", "scheduled", "sent", "opened", "replied", "bounced"]);
export const outreachCampaignStatusEnum = pgEnum("outreach_campaign_status", ["draft", "active", "paused", "completed", "archived"]);
export const outreachCampaignTypeEnum = pgEnum("outreach_campaign_type", ["email", "call", "mixed"]);
export const marketTargetStatusEnum = pgEnum("market_target_status", ["research", "active", "saturated", "paused"]);
export const marketTargetPriorityEnum = pgEnum("market_target_priority", ["low", "medium", "high", "critical"]);

// Service Department enums
export const workOrderStatusEnum = pgEnum("work_order_status", ["pending", "scheduled", "in_progress", "on_hold", "completed", "cancelled"]);
export const workOrderPriorityEnum = pgEnum("work_order_priority", ["low", "normal", "high", "urgent"]);
export const serviceJobTypeEnum = pgEnum("service_job_type", ["maintenance", "repair", "winterization", "spring_commissioning", "bottom_paint", "engine_service", "electrical", "fiberglass", "upholstery", "detailing", "inspection", "other"]);
export const partsCategoryEnum = pgEnum("parts_category", ["engine", "electrical", "plumbing", "hull", "rigging", "safety", "navigation", "cleaning", "general", "other"]);

// Boat Rentals enums
export const rentalStatusEnum = pgEnum("rental_status", ["available", "reserved", "rented", "maintenance", "retired"]);
export const rentalBookingStatusEnum = pgEnum("rental_booking_status", ["pending", "confirmed", "checked_out", "returned", "cancelled", "no_show"]);
export const rentalPricingTypeEnum = pgEnum("rental_pricing_type", ["hourly", "half_day", "full_day", "weekly", "monthly"]);

// Boat Club enums
export const clubMembershipStatusEnum = pgEnum("club_membership_status", ["active", "suspended", "expired", "cancelled", "pending"]);
export const clubMembershipTierEnum = pgEnum("club_membership_tier", ["bronze", "silver", "gold", "platinum", "unlimited"]);
export const clubBookingStatusEnum = pgEnum("club_booking_status", ["pending", "confirmed", "checked_out", "returned", "cancelled", "no_show"]);

// Boat Sales enums
export const boatConditionEnum = pgEnum("boat_condition", ["new", "excellent", "good", "fair", "project"]);
export const boatSaleStatusEnum = pgEnum("boat_sale_status", ["available", "pending", "sold", "consignment", "trade_in", "archived"]);
export const tradeInStatusEnum = pgEnum("trade_in_status", ["pending_evaluation", "evaluated", "accepted", "rejected", "completed"]);
export const financingStatusEnum = pgEnum("financing_status", ["not_started", "pre_approved", "application_submitted", "approved", "declined", "funded"]);

// SSO Provider enums
export const ssoProviderEnum = pgEnum("sso_provider", ["okta", "azure_ad", "onelogin", "google_workspace", "custom_saml"]);
export const mfaMethodEnum = pgEnum("mfa_method", ["totp", "sms", "email"]);
export const sessionStatusEnum = pgEnum("session_status", ["active", "expired", "revoked"]);

// Organizations
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // SSO settings
  ssoEnabled: boolean("sso_enabled").notNull().default(false),
  ssoEnforced: boolean("sso_enforced").notNull().default(false), // Require SSO for all users
  // Security settings
  mfaRequired: boolean("mfa_required").notNull().default(false),
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(480), // 8 hours default
  ipAllowlist: text("ip_allowlist").array(), // CIDR ranges
  allowedEmailDomains: text("allowed_email_domains").array(), // For JIT provisioning
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Pack Types - Add-on feature packs that can be purchased
// Core packs: crm_pipeline, modeling_tools, analysis, operations
// Add-on packs: fund_management, lp_portal, prospecting, analytics_pro
export const packTypeEnum = pgEnum("pack_type", [
  "crm_pipeline",     // CRM & Pipeline - deals, contacts, companies, pipeline management
  "modeling_tools",   // Modeling Tools - modeling projects, OM builder, exit strategies, waterfall
  "analysis",         // Analysis - sales comps, rate comps, market analytics
  "operations",       // Operations - rent roll, fuel sales, ship store, dockit, marketing
  "fund_management",  // Fund Management module (add-on to modeling_tools)
  "lp_portal",        // LP Portal for investor access (add-on to fund_management)
  "prospecting",      // Premium prospecting & outreach tools (add-on to crm_pipeline)
  "analytics_pro",    // Advanced analytics and reporting (add-on to analysis)
]);

export const packStatusEnum = pgEnum("pack_status", ["active", "trial", "expired", "cancelled"]);

// Pack Catalog - Static configuration for available packs
export const packCatalog = pgTable("pack_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packType: text("pack_type").notNull().unique(), // References pack_type enum values
  name: text("name").notNull(),
  description: text("description").notNull(),
  features: jsonb("features").notNull().default(sql`'[]'`), // Array of feature strings
  monthlyPriceCents: integer("monthly_price_cents").notNull().default(0), // Price in cents
  yearlyPriceCents: integer("yearly_price_cents").notNull().default(0), // Annual price in cents
  stripePriceIdMonthly: text("stripe_price_id_monthly"), // Stripe price ID for monthly billing
  stripePriceIdYearly: text("stripe_price_id_yearly"), // Stripe price ID for yearly billing
  dependencies: jsonb("dependencies").notNull().default(sql`'[]'`), // Array of pack_type slugs required
  isCore: boolean("is_core").notNull().default(false), // Core packs vs add-on packs
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true), // Whether pack is available for purchase
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Organization Packs - Tracks purchased add-on packs per organization
export const organizationPacks = pgTable("organization_packs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  packType: packTypeEnum("pack_type").notNull(),
  status: packStatusEnum("status").notNull().default("active"),
  // Billing info
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Null = no expiration
  trialEndsAt: timestamp("trial_ends_at"), // For trial packs
  // Stripe subscription info
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripePriceId: text("stripe_price_id"),
  billingCycle: text("billing_cycle"), // 'monthly' or 'yearly'
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  // Metadata
  purchasedBy: varchar("purchased_by"), // User who purchased
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgPackIdx: index("org_packs_org_idx").on(table.orgId),
  packTypeIdx: index("org_packs_type_idx").on(table.packType),
  orgPackUnique: index("org_packs_unique_idx").on(table.orgId, table.packType),
  stripeSubIdx: index("org_packs_stripe_sub_idx").on(table.stripeSubscriptionId),
}));

// SSO Configurations - Per-organization SSO provider settings
export const ssoConfigurations = pgTable("sso_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id).unique(),
  provider: ssoProviderEnum("provider").notNull(),
  // SAML Configuration
  entityId: text("entity_id"), // SP Entity ID
  ssoUrl: text("sso_url"), // IdP SSO URL
  sloUrl: text("slo_url"), // IdP Single Logout URL (optional)
  certificate: text("certificate"), // IdP X.509 certificate
  // Optional metadata URL for auto-config
  metadataUrl: text("metadata_url"),
  // Attribute mapping
  attributeMapping: jsonb("attribute_mapping").default(sql`'{"email": "email", "name": "displayName", "firstName": "givenName", "lastName": "surname"}'`),
  // Just-in-time provisioning
  jitProvisioningEnabled: boolean("jit_provisioning_enabled").notNull().default(true),
  defaultRole: text("default_role").notNull().default("viewer"),
  // Status
  isActive: boolean("is_active").notNull().default(false),
  lastTestedAt: timestamp("last_tested_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"), // Null if SSO-only user
  role: roleEnum("role").notNull().default("viewer"),
  tz: text("tz").notNull().default("America/New_York"),
  // SSO linking
  ssoSubjectId: text("sso_subject_id"), // IdP's unique user identifier
  ssoProvider: ssoProviderEnum("sso_provider"),
  // MFA settings
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaSecret: text("mfa_secret"), // Encrypted TOTP secret
  mfaBackupCodes: text("mfa_backup_codes").array(), // Encrypted backup codes
  mfaMethod: mfaMethodEnum("mfa_method"),
  // Calendar preferences
  defaultCalendarProvider: calendarProviderEnum("default_calendar_provider"),
  calendarSyncEnabled: boolean("calendar_sync_enabled").notNull().default(true),
  // Dashboard preferences
  preferredDashboard: dashboardTypeEnum("preferred_dashboard").default("default"),
  dashboardConfig: jsonb("dashboard_config").default(sql`'{}'`), // Custom dashboard settings
  // Account status
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User Sessions - Track active sessions with device info
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  // Session info
  sessionToken: text("session_token").notNull().unique(),
  status: sessionStatusEnum("status").notNull().default("active"),
  // Device and location info
  deviceType: text("device_type"), // desktop, mobile, tablet
  browser: text("browser"),
  os: text("os"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  location: text("location"), // GeoIP city/country
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
}, (table) => ({
  userIdIdx: index("user_sessions_user_id_idx").on(table.userId),
  sessionTokenIdx: index("user_sessions_token_idx").on(table.sessionToken),
}));

// Security Audit Log - Track auth events
export const securityAuditLog = pgTable("security_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  orgId: varchar("org_id").references(() => organizations.id),
  eventType: text("event_type").notNull(), // login_success, login_failure, logout, mfa_enabled, mfa_disabled, password_change, session_revoked, sso_login, etc.
  eventDetails: jsonb("event_details").default(sql`'{}'`),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("security_audit_user_id_idx").on(table.userId),
  orgIdIdx: index("security_audit_org_id_idx").on(table.orgId),
  eventTypeIdx: index("security_audit_event_type_idx").on(table.eventType),
  createdAtIdx: index("security_audit_created_at_idx").on(table.createdAt),
}));

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

// Dashboard Custom Modules - User-defined filtered dashboard modules with visualization configs
export const dashboardCustomModules = pgTable("dashboard_custom_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  title: text("title").notNull(), // User-defined module name (e.g., "Florida Sales Comps", "Q1 DD Tasks")
  moduleType: text("module_type").notNull(), // Source: 'crm', 'sales-comps', 'fuel', 'vdr', 'docktalk', 'ship-store', 'dd', 'rent-roll', 'modeling'
  filters: jsonb("filters").notNull().default(sql`'{}'`), // Filter configuration: { state: 'FL', dateRange: 'Q1', projectId: '123', etc. }
  visualizationType: text("visualization_type").notNull().default('table'), // 'kpi_card', 'line_chart', 'area_chart', 'bar_chart', 'pie_chart', 'combo_chart', 'stat_grid', 'table', 'goal_tracker', 'comparison_card'
  chartConfig: jsonb("chart_config").notNull().default(sql`'{}'`), // Visualization config: { xAxis, yAxis, metrics, colors, aggregations, timeframes, etc. }
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

// User KPI Preferences - Per-page KPI card configurations
export const userKpiPreferences = pgTable("user_kpi_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  pageKey: text("page_key").notNull(), // e.g., "crm_companies", "crm_contacts"
  kpiConfig: jsonb("kpi_config").notNull().default(sql`'[]'`), // Array of { title, metricType, icon, color }
  lastModified: timestamp("last_modified").notNull().defaultNow(),
}, (table) => ({
  uniqueUserOrgPage: unique().on(table.userId, table.orgId, table.pageKey),
  userOrgPageIdx: index("user_kpi_pref_user_org_page_idx").on(table.userId, table.orgId, table.pageKey),
}));

// User Pinned Items - Quick access pins for dashboard
export const userPinnedItems = pgTable("user_pinned_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  itemType: text("item_type").notNull(), // 'modeling_project', 'deal', 'sales_comp', 'report', 'page', 'custom'
  itemId: text("item_id"), // ID of the specific item (nullable for pages/custom)
  title: text("title").notNull(),
  description: text("description"),
  link: text("link").notNull(), // URL path to navigate to
  icon: text("icon"), // Lucide icon name
  color: text("color"), // Optional color for visual distinction
  sortOrder: integer("sort_order").notNull().default(0),
  pinnedAt: timestamp("pinned_at").notNull().defaultNow(),
}, (table) => ({
  userOrgIdx: index("user_pinned_items_user_org_idx").on(table.userId, table.orgId),
  itemTypeIdx: index("user_pinned_items_type_idx").on(table.itemType),
}));

// User Recent Items - Track recently accessed items
export const userRecentItems = pgTable("user_recent_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  itemType: text("item_type").notNull(), // 'modeling_project', 'deal', 'sales_comp', 'report', 'page'
  itemId: text("item_id"), // ID of the specific item (nullable for pages)
  title: text("title").notNull(),
  link: text("link").notNull(),
  icon: text("icon"),
  accessedAt: timestamp("accessed_at").notNull().defaultNow(),
}, (table) => ({
  userOrgIdx: index("user_recent_items_user_org_idx").on(table.userId, table.orgId),
  accessedIdx: index("user_recent_items_accessed_idx").on(table.accessedAt),
  uniqueUserItem: unique().on(table.userId, table.orgId, table.itemType, table.itemId),
}));

// User Favorites - Starred items for quick access
export const userFavorites = pgTable("user_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  itemType: text("item_type").notNull(), // 'modeling_project', 'deal', 'sales_comp', 'contact', 'company', 'property'
  itemId: text("item_id").notNull(), // ID of the specific item
  title: text("title").notNull(),
  subtitle: text("subtitle"), // Additional context (e.g., company name, location)
  link: text("link").notNull(),
  icon: text("icon"),
  favoritedAt: timestamp("favorited_at").notNull().defaultNow(),
}, (table) => ({
  userOrgIdx: index("user_favorites_user_org_idx").on(table.userId, table.orgId),
  itemTypeIdx: index("user_favorites_type_idx").on(table.itemType),
  uniqueUserItem: unique().on(table.userId, table.orgId, table.itemType, table.itemId),
}));

// ============================================================================
// Dashboard Customization System - Institutional-Grade Widget Framework
// ============================================================================

// Dashboard Module Metrics - Registry of available metrics per module
export const dashboardModuleMetrics = pgTable("dashboard_module_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleKey: text("module_key").notNull(), // 'sales_comps', 'rate_comps', 'demographics', 'capital_markets', 'docktalk', 'vdr', 'fuel', 'ship_store', 'rent_roll', 'modeling', 'due_diligence', 'crm'
  metricKey: text("metric_key").notNull(), // 'total_count', 'avg_price', 'median_price', 'total_volume', 'avg_cap_rate', etc.
  title: text("title").notNull(),
  description: text("description"),
  aggregationType: text("aggregation_type").notNull(), // 'count', 'sum', 'avg', 'median', 'min', 'max', 'latest'
  valueType: text("value_type").notNull(), // 'number', 'currency', 'percentage', 'date'
  icon: text("icon"), // Lucide icon name
  
  // Available filter dimensions for this metric
  filterDimensions: jsonb("filter_dimensions").default(sql`'[]'`), // ['year', 'state', 'region', 'water_type', 'profit_center', 'status']
  
  // Groupable dimensions for breakdowns
  groupableDimensions: jsonb("groupable_dimensions").default(sql`'[]'`), // ['year', 'quarter', 'month', 'state', 'region']
  
  // Comparison periods available
  comparisonOptions: jsonb("comparison_options").default(sql`'["yoy", "mom", "qoq", "prior_period"]'`),
  
  // Default widget configuration
  defaultConfig: jsonb("default_config").default(sql`'{}'`),
  
  // Display settings
  defaultSize: jsonb("default_size").default(sql`'{"cols": 1, "rows": 1}'`),
  minSize: jsonb("min_size").default(sql`'{"cols": 1, "rows": 1}'`),
  maxSize: jsonb("max_size").default(sql`'{"cols": 4, "rows": 4}'`),
  
  // Ordering and grouping
  displayOrder: integer("display_order").default(0),
  metricGroup: text("metric_group"), // 'pricing', 'volume', 'performance', 'activity', 'trends'
  
  // Feature flags
  isActive: boolean("is_active").notNull().default(true),
  isPremium: boolean("is_premium").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  moduleMetricIdx: index("dashboard_module_metrics_module_idx").on(table.moduleKey),
  uniqueModuleMetric: unique().on(table.moduleKey, table.metricKey),
}));

// Dashboard Custom Widgets - User's custom widget instances with configurations
export const dashboardCustomWidgets = pgTable("dashboard_custom_widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  
  // Widget identity
  widgetName: text("widget_name").notNull(), // User-defined name
  moduleKey: text("module_key").notNull(),
  metricKey: text("metric_key").notNull(),
  
  // Filter configuration
  filters: jsonb("filters").default(sql`'{}'`), // { year: 2024, state: ['FL', 'TX'], region: 'Southeast' }
  
  // Time range settings
  timeRangeType: text("time_range_type").default('all_time'), // 'all_time', 'current_year', 'last_n_years', 'custom_range', 'ytd', 'rolling_12m'
  timeRangeValue: jsonb("time_range_value").default(sql`'{}'`), // { years: 3 } or { startYear: 2020, endYear: 2024 }
  
  // Comparison settings
  enableComparison: boolean("enable_comparison").default(false),
  comparisonType: text("comparison_type"), // 'yoy', 'mom', 'qoq', 'prior_period', 'custom'
  comparisonPeriod: jsonb("comparison_period").default(sql`'{}'`), // { offset: -1, unit: 'year' }
  
  // Grouping/breakdown settings
  groupBy: text("group_by"), // 'year', 'quarter', 'month', 'state', 'region', null for no grouping
  
  // Display settings
  displaySize: jsonb("display_size").default(sql`'{"cols": 1, "rows": 1}'`),
  displayStyle: text("display_style").default('card'), // 'card', 'chart', 'table', 'sparkline'
  chartType: text("chart_type"), // 'bar', 'line', 'pie', 'area'
  showTrend: boolean("show_trend").default(true),
  showSparkline: boolean("show_sparkline").default(false),
  
  // Card appearance
  accentColor: text("accent_color"), // hex color for card accent
  icon: text("icon"), // Override default metric icon
  
  // Visibility and ordering
  isVisible: boolean("is_visible").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  
  // Template reference (if created from template)
  templateId: varchar("template_id"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userOrgIdx: index("dashboard_custom_widgets_user_org_idx").on(table.userId, table.orgId),
  moduleIdx: index("dashboard_custom_widgets_module_idx").on(table.moduleKey),
}));

// Dashboard Saved Layouts - Named layout configurations for quick switching
export const dashboardSavedLayouts = pgTable("dashboard_saved_layouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  
  // Layout identity
  layoutName: text("layout_name").notNull(),
  description: text("description"),
  icon: text("icon"), // Lucide icon for layout selector
  
  // Layout configuration
  widgetOrder: jsonb("widget_order").default(sql`'[]'`), // Array of widget IDs in display order
  gridConfig: jsonb("grid_config").default(sql`'{}'`), // { cols: 4, gap: 16, rowHeight: 'auto' }
  
  // Widget positions (for grid layout)
  widgetPositions: jsonb("widget_positions").default(sql`'{}'`), // { widgetId: { x: 0, y: 0, cols: 2, rows: 1 } }
  
  // Included standard modules (from fixed module cards)
  enabledModules: jsonb("enabled_modules").default(sql`'[]'`), // ['sales_comps', 'modeling', 'vdr']
  moduleOrder: jsonb("module_order").default(sql`'[]'`), // Order of module cards
  
  // Layout settings
  showQuickAccess: boolean("show_quick_access").default(true),
  showActivityFeed: boolean("show_activity_feed").default(true),
  compactMode: boolean("compact_mode").default(false),
  
  // Status flags
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  userOrgIdx: index("dashboard_saved_layouts_user_org_idx").on(table.userId, table.orgId),
  defaultIdx: index("dashboard_saved_layouts_default_idx").on(table.userId, table.orgId, table.isDefault),
}));

// Dashboard Widget Templates - Pre-built widget configurations for quick add
export const dashboardWidgetTemplates = pgTable("dashboard_widget_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Template identity
  templateName: text("template_name").notNull(),
  description: text("description"),
  moduleKey: text("module_key").notNull(),
  metricKey: text("metric_key").notNull(),
  
  // Pre-configured settings (same structure as custom widgets)
  filters: jsonb("filters").default(sql`'{}'`),
  timeRangeType: text("time_range_type").default('current_year'),
  timeRangeValue: jsonb("time_range_value").default(sql`'{}'`),
  enableComparison: boolean("enable_comparison").default(true),
  comparisonType: text("comparison_type").default('yoy'),
  groupBy: text("group_by"),
  displaySize: jsonb("display_size").default(sql`'{"cols": 1, "rows": 1}'`),
  displayStyle: text("display_style").default('card'),
  chartType: text("chart_type"),
  showTrend: boolean("show_trend").default(true),
  accentColor: text("accent_color"),
  icon: text("icon"),
  
  // Template metadata
  category: text("category"), // 'acquisition', 'portfolio', 'market', 'operations'
  tags: text("tags").array().default(sql`'{}'`),
  popularityScore: integer("popularity_score").default(0),
  
  // Visibility
  isGlobal: boolean("is_global").notNull().default(true), // Available to all users
  createdBy: varchar("created_by").references(() => users.id), // For org-specific templates
  orgId: varchar("org_id").references(() => organizations.id), // For org-specific templates
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  moduleIdx: index("dashboard_widget_templates_module_idx").on(table.moduleKey),
  categoryIdx: index("dashboard_widget_templates_category_idx").on(table.category),
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
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

// Project Deal Members - Custom deal team members manually added to a project
export const projectDealMembers = pgTable("project_deal_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"), // Free-form role/title
  notes: text("notes"),
  // Link to pending contact created for CRM review
  pendingContactId: varchar("pending_contact_id").references(() => pendingContacts.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("project_deal_members_project").on(table.projectId),
  orgIdx: index("project_deal_members_org").on(table.orgId),
}));

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

export const insertPackCatalogSchema = createInsertSchema(packCatalog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updatePackCatalogSchema = insertPackCatalogSchema.partial();

export const insertOrganizationPackSchema = createInsertSchema(organizationPacks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOrganizationPackSchema = insertOrganizationPackSchema.partial();

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSsoConfigurationSchema = createInsertSchema(ssoConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export const insertSecurityAuditLogSchema = createInsertSchema(securityAuditLog).omit({
  id: true,
  createdAt: true,
});

export const insertDashboardCustomModuleSchema = createInsertSchema(dashboardCustomModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDashboardCustomModule = z.infer<typeof insertDashboardCustomModuleSchema>;
export type DashboardCustomModule = typeof dashboardCustomModules.$inferSelect;

// Chart Configuration TypeScript Interfaces
export type VisualizationType = 
  | 'kpi_card' 
  | 'line_chart' 
  | 'area_chart' 
  | 'bar_chart' 
  | 'pie_chart' 
  | 'combo_chart' 
  | 'stat_grid' 
  | 'table' 
  | 'goal_tracker' 
  | 'comparison_card';

export interface ChartMetric {
  key: string;
  label: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  color?: string;
  format?: 'currency' | 'number' | 'percent';
}

export interface ChartAxisConfig {
  field: string;
  label: string;
  type?: 'category' | 'number' | 'date';
}

export interface TimeframeConfig {
  type: 'absolute' | 'relative';
  start?: string; // ISO date or relative like '-30d'
  end?: string;
  granularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface ChartConfig {
  // Data Selection
  marinaIds?: string[]; // Specific marinas to include
  timeframe?: TimeframeConfig;
  comparisonTimeframe?: TimeframeConfig; // For comparison charts
  
  // Axes Configuration (for charts)
  xAxis?: ChartAxisConfig;
  yAxis?: ChartAxisConfig;
  
  // Metrics Configuration
  metrics: ChartMetric[];
  
  // Visualization Options
  chartType?: 'line' | 'area' | 'bar'; // For combo charts
  showGrid?: boolean;
  showLegend?: boolean;
  showDataLabels?: boolean;
  
  // Colors
  colorScheme?: string[]; // Hex colors
  
  // Goal Tracker Specific
  goalValue?: number;
  currentValue?: number;
  
  // Stat Grid Specific
  layout?: 'row' | 'grid';
  columns?: number;
}

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

export type PackCatalog = typeof packCatalog.$inferSelect;
export type InsertPackCatalog = z.infer<typeof insertPackCatalogSchema>;
export type UpdatePackCatalog = z.infer<typeof updatePackCatalogSchema>;

export type OrganizationPack = typeof organizationPacks.$inferSelect;
export type InsertOrganizationPack = z.infer<typeof insertOrganizationPackSchema>;
export type UpdateOrganizationPack = z.infer<typeof updateOrganizationPackSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type SsoConfiguration = typeof ssoConfigurations.$inferSelect;
export type InsertSsoConfiguration = z.infer<typeof insertSsoConfigurationSchema>;

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

export type SecurityAuditLog = typeof securityAuditLog.$inferSelect;
export type InsertSecurityAuditLog = z.infer<typeof insertSecurityAuditLogSchema>;

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

export const insertProjectDealMemberSchema = createInsertSchema(projectDealMembers).omit({
  id: true,
  createdAt: true,
});
export type ProjectDealMember = typeof projectDealMembers.$inferSelect;
export type InsertProjectDealMember = z.infer<typeof insertProjectDealMemberSchema>;

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
  
  // Property Status Toggles (Upgrade G)
  isSelling: boolean("is_selling").default(false),
  isOnMarket: boolean("is_on_market").default(false),
  pipelineStage: text("pipeline_stage").default('lead'), // lead, deal, under_contract, owned
  
  // Listing Fields (when selling/on market)
  brokerContactId: varchar("broker_contact_id").references(() => crmContacts.id),
  brokerName: text("broker_name"), // Free text fallback if no CRM contact
  listPrice: decimal("list_price", { precision: 12, scale: 2 }),
  listCapRate: decimal("list_cap_rate", { precision: 6, scale: 4 }), // e.g., 0.0725 = 7.25%
  listingDate: date("listing_date"),
  listingUrl: text("listing_url"),
  listingNotes: text("listing_notes"),
  
  // Owner Company link
  ownerCompanyId: varchar("owner_company_id").references(() => crmCompanies.id),
  
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

// Property Ownership History - Tracks all ownership changes/sales for properties
export const propertyOwnershipHistory = pgTable("property_ownership_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  
  // Core relationships
  propertyId: varchar("property_id").notNull().references(() => crmProperties.id, { onDelete: 'cascade' }),
  salesCompId: varchar("sales_comp_id").references(() => salesComps.id, { onDelete: 'set null' }),
  
  // Transaction details
  transactionDate: date("transaction_date"),
  salePrice: integer("sale_price"),
  pricePerSlip: integer("price_per_slip"),
  capRate: decimal("cap_rate", { precision: 5, scale: 2 }),
  
  // Buyer information
  buyerCompanyId: varchar("buyer_company_id").references(() => crmCompanies.id, { onDelete: 'set null' }),
  buyerContactId: varchar("buyer_contact_id").references(() => crmContacts.id, { onDelete: 'set null' }),
  buyerName: text("buyer_name"), // Free-form for when not linked to CRM
  
  // Seller information
  sellerCompanyId: varchar("seller_company_id").references(() => crmCompanies.id, { onDelete: 'set null' }),
  sellerContactId: varchar("seller_contact_id").references(() => crmContacts.id, { onDelete: 'set null' }),
  sellerName: text("seller_name"), // Free-form for when not linked to CRM
  
  // Transaction type and source
  transactionType: text("transaction_type").default('sale'), // 'sale', 'acquisition', 'merger', 'foreclosure', 'transfer'
  source: text("source").default('sales_comp'), // 'sales_comp', 'manual', 'import', 'public_records'
  
  // Additional metadata
  notes: text("notes"),
  metadata: jsonb("metadata").default({}), // Additional transaction details
  
  // Audit fields
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgPropertyIdx: index("ownership_history_org_property_idx").on(table.orgId, table.propertyId),
  propertyDateIdx: index("ownership_history_property_date_idx").on(table.propertyId, table.transactionDate),
  orgBuyerIdx: index("ownership_history_org_buyer_idx").on(table.orgId, table.buyerCompanyId),
  orgSellerIdx: index("ownership_history_org_seller_idx").on(table.orgId, table.sellerCompanyId),
  salesCompIdx: index("ownership_history_sales_comp_idx").on(table.salesCompId),
}));

// CRM Match Results - Stores fuzzy match results for pending items
export const crmMatchResults = pgTable("crm_match_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  
  // Source reference (which pending item this match belongs to)
  pendingType: text("pending_type").notNull(), // 'property', 'contact', 'company'
  pendingId: varchar("pending_id").notNull(), // ID in the respective pending table
  
  // Match target
  matchEntityType: text("match_entity_type").notNull(), // 'property', 'contact', 'company'
  matchEntityId: varchar("match_entity_id").notNull(), // ID in the CRM table
  
  // Match quality
  confidenceScore: integer("confidence_score").notNull(), // 0-100
  confidenceLevel: text("confidence_level").notNull(), // 'high', 'medium', 'low'
  matchedFields: jsonb("matched_fields").default([]), // Array of field names that matched
  fieldScores: jsonb("field_scores").default({}), // { fieldName: score } for each compared field
  
  // Match explanation
  matchReason: text("match_reason"), // Human-readable explanation
  
  // DockTalk flags
  isInPortfolio: boolean("is_in_portfolio").default(false), // Company is in DockTalk Portfolio
  isOnWatchlist: boolean("is_on_watchlist").default(false), // Company is on DockTalk Watchlist
  
  // Action taken
  resolution: text("resolution"), // 'accepted', 'rejected', 'merged', null if pending
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orgPendingIdx: index("crm_match_org_pending_idx").on(table.orgId, table.pendingType, table.pendingId),
  pendingIdIdx: index("crm_match_pending_id_idx").on(table.pendingId),
  matchEntityIdx: index("crm_match_entity_idx").on(table.matchEntityType, table.matchEntityId),
  confidenceIdx: index("crm_match_confidence_idx").on(table.orgId, table.confidenceLevel),
}));

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
// PROSPECTING & OUTREACH MODULE - Deal sourcing and activity tracking
// ============================================================================

// Prospecting Activities - Tracks all outreach touches (calls, emails, meetings, etc.)
export const prospectingActivities = pgTable("prospecting_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  type: prospectingActivityTypeEnum("type").notNull(), // call, email, meeting, voicemail, text, linkedin, other
  direction: prospectingActivityDirectionEnum("direction").notNull().default("outbound"), // outbound, inbound, internal
  outcome: prospectingActivityOutcomeEnum("outcome"), // connected, no_answer, left_message, etc.
  subject: text("subject"),
  description: text("description"),
  duration: integer("duration"), // Duration in seconds (for calls/meetings)
  scheduledAt: timestamp("scheduled_at"), // When the activity was scheduled
  completedAt: timestamp("completed_at"), // When it was actually completed
  contactId: varchar("contact_id").references(() => crmContacts.id),
  companyId: varchar("company_id").references(() => crmCompanies.id),
  propertyId: varchar("property_id").references(() => crmProperties.id),
  dealId: varchar("deal_id").references(() => crmDeals.id),
  campaignId: varchar("campaign_id"), // Links to outreach campaign if part of one
  weekId: varchar("week_id"), // Links to prospecting week for weekly tracking
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("prospecting_activities_org_idx").on(table.orgId),
  ownerIdx: index("prospecting_activities_owner_idx").on(table.ownerId),
  typeIdx: index("prospecting_activities_type_idx").on(table.type),
  contactIdx: index("prospecting_activities_contact_idx").on(table.contactId),
  weekIdx: index("prospecting_activities_week_idx").on(table.weekId),
  createdAtIdx: index("prospecting_activities_created_at_idx").on(table.createdAt),
}));

// Prospecting Weeks - Weekly activity tracking and goal setting
export const prospectingWeeks = pgTable("prospecting_weeks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  weekStart: date("week_start").notNull(), // Monday of the week
  weekEnd: date("week_end").notNull(), // Sunday of the week
  // Goals
  callsGoal: integer("calls_goal").default(50),
  emailsGoal: integer("emails_goal").default(100),
  meetingsGoal: integer("meetings_goal").default(10),
  leadsGoal: integer("leads_goal").default(5),
  // Actual counts (computed or manually updated)
  callsActual: integer("calls_actual").default(0),
  emailsActual: integer("emails_actual").default(0),
  meetingsActual: integer("meetings_actual").default(0),
  leadsActual: integer("leads_actual").default(0),
  // Additional metrics
  conversations: integer("conversations").default(0), // Successful connections
  dealsCreated: integer("deals_created").default(0),
  notes: text("notes"),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgOwnerWeekIdx: unique().on(table.orgId, table.ownerId, table.weekStart),
  weekStartIdx: index("prospecting_weeks_week_start_idx").on(table.weekStart),
}));

// Outreach Campaigns - Email/call campaigns for systematic prospecting
export const outreachCampaigns = pgTable("outreach_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  type: outreachCampaignTypeEnum("type").notNull().default("email"), // email, call, mixed
  status: outreachCampaignStatusEnum("status").notNull().default("draft"), // draft, active, paused, completed, archived
  description: text("description"),
  // Target criteria (stored as JSON for flexibility)
  targetCriteria: jsonb("target_criteria").default({}), // Filters for selecting targets
  targetCount: integer("target_count").default(0), // Number of contacts in campaign
  // Metrics
  sentCount: integer("sent_count").default(0),
  openedCount: integer("opened_count").default(0),
  repliedCount: integer("replied_count").default(0),
  bouncedCount: integer("bounced_count").default(0),
  // Schedule
  startDate: date("start_date"),
  endDate: date("end_date"),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgStatusIdx: index("outreach_campaigns_org_status_idx").on(table.orgId, table.status),
}));

// Outreach Templates - Reusable email/call scripts
export const outreachTemplates = pgTable("outreach_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("email"), // email, call_script
  category: text("category"), // Cold Outreach, Follow-up, Nurture, etc.
  subject: text("subject"), // For emails
  content: text("content").notNull(), // Template content with merge fields
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  isActive: boolean("is_active").default(true),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Market Targets - Geographic/segment targets for prospecting
export const marketTargets = pgTable("market_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(), // e.g., "Tampa Bay", "Great Lakes Region"
  region: text("region"), // Broader region (e.g., "Southeast", "Midwest")
  states: text("states").array().default(sql`ARRAY[]::text[]`), // States included
  status: marketTargetStatusEnum("status").notNull().default("research"), // research, active, saturated, paused
  priority: marketTargetPriorityEnum("priority").notNull().default("medium"),
  // Market metrics
  totalMarinas: integer("total_marinas").default(0),
  targetedMarinas: integer("targeted_marinas").default(0),
  contactedMarinas: integer("contacted_marinas").default(0),
  convertedDeals: integer("converted_deals").default(0),
  // Notes and research
  notes: text("notes"),
  researchNotes: jsonb("research_notes").default({}), // Structured research data
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgStatusIdx: index("market_targets_org_status_idx").on(table.orgId, table.status),
}));

// Deal Contacts Junction - Many-to-many relationship between deals and contacts with roles
export const crmDealContacts = pgTable("crm_deal_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => crmDeals.id).notNull(),
  contactId: varchar("contact_id").references(() => crmContacts.id).notNull(),
  role: text("role"), // seller, buyer, broker, attorney, lender, etc.
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueDealContact: unique().on(table.dealId, table.contactId),
}));

// Deal Companies Junction - Many-to-many relationship between deals and companies
export const crmDealCompanies = pgTable("crm_deal_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => crmDeals.id).notNull(),
  companyId: varchar("company_id").references(() => crmCompanies.id).notNull(),
  role: text("role"), // seller, buyer, broker_firm, lender, title_company, etc.
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueDealCompany: unique().on(table.dealId, table.companyId),
}));

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
  // CRE-specific stage metadata (Oracle RCM style)
  stageType: text("stage_type").default('active'), // active, won, lost
  slaWarningDays: integer("sla_warning_days"), // days before SLA warning shows
  slaMaxDays: integer("sla_max_days"), // maximum days allowed in stage
  requiredFields: jsonb("required_fields").default([]), // fields required to enter stage
  taskTemplates: jsonb("task_templates").default([]), // auto-create tasks on entry
  automations: jsonb("automations").default([]), // workflow automations for this stage
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

// Property Ownership History schema
export const insertPropertyOwnershipHistorySchema = createInsertSchema(propertyOwnershipHistory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPropertyOwnershipHistory = z.infer<typeof insertPropertyOwnershipHistorySchema>;
export type PropertyOwnershipHistory = typeof propertyOwnershipHistory.$inferSelect;

// CRM Match Results schema
export const insertCrmMatchResultSchema = createInsertSchema(crmMatchResults).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});
export type InsertCrmMatchResult = z.infer<typeof insertCrmMatchResultSchema>;
export type CrmMatchResult = typeof crmMatchResults.$inferSelect;

// CRM File schema
export const insertCrmFileSchema = createInsertSchema(crmFiles).omit({
  id: true,
  createdAt: true,
});
export type InsertCrmFile = z.infer<typeof insertCrmFileSchema>;
export type CrmFile = typeof crmFiles.$inferSelect;

// ============================================================================
// PROSPECTING MODULE SCHEMAS & TYPES
// ============================================================================

// Prospecting Activities schema
export const insertProspectingActivitySchema = createInsertSchema(prospectingActivities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProspectingActivity = z.infer<typeof insertProspectingActivitySchema>;
export type ProspectingActivity = typeof prospectingActivities.$inferSelect;

// Prospecting Weeks schema
export const insertProspectingWeekSchema = createInsertSchema(prospectingWeeks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProspectingWeek = z.infer<typeof insertProspectingWeekSchema>;
export type ProspectingWeek = typeof prospectingWeeks.$inferSelect;

// Outreach Campaigns schema
export const insertOutreachCampaignSchema = createInsertSchema(outreachCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOutreachCampaign = z.infer<typeof insertOutreachCampaignSchema>;
export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;

// Outreach Templates schema
export const insertOutreachTemplateSchema = createInsertSchema(outreachTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOutreachTemplate = z.infer<typeof insertOutreachTemplateSchema>;
export type OutreachTemplate = typeof outreachTemplates.$inferSelect;

// Market Targets schema
export const insertMarketTargetSchema = createInsertSchema(marketTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMarketTarget = z.infer<typeof insertMarketTargetSchema>;
export type MarketTarget = typeof marketTargets.$inferSelect;

// Deal Contacts Junction schema
export const insertCrmDealContactSchema = createInsertSchema(crmDealContacts).omit({
  id: true,
  createdAt: true,
});
export type InsertCrmDealContact = z.infer<typeof insertCrmDealContactSchema>;
export type CrmDealContact = typeof crmDealContacts.$inferSelect;

// Deal Companies Junction schema
export const insertCrmDealCompanySchema = createInsertSchema(crmDealCompanies).omit({
  id: true,
  createdAt: true,
});
export type InsertCrmDealCompany = z.infer<typeof insertCrmDealCompanySchema>;
export type CrmDealCompany = typeof crmDealCompanies.$inferSelect;

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
  estimatedPurchasePrice: integer('estimated_purchase_price'), // Broker-provided estimate when actual price unavailable
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

  // === INSTITUTIONAL DATA GOVERNANCE ===
  
  // Source Attribution - Track where data came from
  dataSource: text('data_source'), // 'broker', 'costar', 'loopnet', 'direct_research', 'public_records', 'internal'
  sourceConfidence: integer('source_confidence'), // 1-100 confidence rating
  sourceUrl: text('source_url'), // Original source URL if applicable
  sourceContactId: varchar('source_contact_id').references(() => crmContacts.id, { onDelete: 'set null' }), // Who provided the data
  sourceNotes: text('source_notes'), // Additional context about the source
  
  // Data Quality & Verification
  lastVerifiedAt: timestamp('last_verified_at'), // When data was last verified
  lastVerifiedBy: varchar('last_verified_by').references(() => users.id, { onDelete: 'set null' }), // User who verified
  dataQualityScore: integer('data_quality_score'), // 0-100 computed quality score
  dataCompleteness: integer('data_completeness'), // 0-100 completeness percentage
  verificationStatus: text('verification_status').default('unverified'), // 'unverified', 'pending', 'verified', 'stale'
  verificationNotes: text('verification_notes'), // Notes from verification process
  
  // Enhanced Geocoding Metadata
  geocodedAt: timestamp('geocoded_at'), // When geocoding was performed
  geocodeAccuracy: text('geocode_accuracy'), // 'rooftop', 'range_interpolated', 'geometric_center', 'approximate'
  formattedAddress: text('formatted_address'), // Standardized address from geocoding
  placeId: text('place_id'), // Google Place ID for future reference
  county: text('county'), // Extracted county from geocoding
  country: text('country').default('US'), // Country code
  timezone: text('timezone'), // Property timezone for analytics
  
  // Import & Audit Tracking
  importBatchId: varchar('import_batch_id'), // Which import batch this came from
  importSource: text('import_source'), // 'csv_import', 'manual_entry', 'api', 'broker_submission'
  importedAt: timestamp('imported_at'), // When originally imported
  changeHistory: jsonb('change_history').$type<Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
    changedAt: string;
    changedBy: string;
    changeReason?: string;
  }>>().default([]),
  
  // Statistical Metadata (computed during import/update)
  pricePerSlip: integer('price_per_slip'), // Computed: salePrice / (wetSlips + dryRacks)
  pricePerAcre: integer('price_per_acre'), // Computed: salePrice / acres
  noiPerSlip: integer('noi_per_slip'), // Computed: noi / (wetSlips + dryRacks)
  totalUnits: integer('total_units'), // Computed: wetSlips + dryRacks

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
  orgQualityScoreIdx: index('sales_comps_org_quality_score_idx').on(table.orgId, table.dataQualityScore),
  orgVerificationIdx: index('sales_comps_org_verification_idx').on(table.orgId, table.verificationStatus),
  orgDataSourceIdx: index('sales_comps_org_data_source_idx').on(table.orgId, table.dataSource),
  orgImportBatchIdx: index('sales_comps_org_import_batch_idx').on(table.orgId, table.importBatchId),
  orgBuyerIdx: index('sales_comps_org_buyer_idx').on(table.orgId, table.buyerCompanyId),
  orgSellerIdx: index('sales_comps_org_seller_idx').on(table.orgId, table.sellerCompanyId),
  orgCountyIdx: index('sales_comps_org_county_idx').on(table.orgId, table.county),
  orgWaterTypeIdx: index('sales_comps_org_water_type_idx').on(table.orgId, table.waterType),
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

// Geocode cache - stores geocoding results to avoid repeat API calls
export const geocodeCache = pgTable('geocode_cache', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  addressHash: varchar('address_hash', { length: 64 }).notNull().unique(), // SHA-256 hash of normalized address
  originalAddress: text('original_address').notNull(),
  formattedAddress: text('formatted_address'),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),
  placeId: text('place_id'),
  county: text('county'),
  country: text('country'),
  geocodeAccuracy: text('geocode_accuracy'), // 'rooftop' | 'range_interpolated' | 'geometric_center' | 'approximate'
  timezone: text('timezone'),
  status: text('status').notNull().default('success'), // 'success' | 'not_found' | 'error'
  errorMessage: text('error_message'),
  apiProvider: text('api_provider').default('google'), // For future multi-provider support
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Optional cache expiry
  hitCount: integer('hit_count').default(0), // Track usage for analytics
  lastHitAt: timestamp('last_hit_at'),
}, (table) => ({
  addressHashIdx: index('geocode_cache_address_hash_idx').on(table.addressHash),
  placeIdIdx: index('geocode_cache_place_id_idx').on(table.placeId),
  statusIdx: index('geocode_cache_status_idx').on(table.status),
}));

// Saved filters - user-defined filter presets for sales comps and other modules
export const scSavedFilters = pgTable('sc_saved_filters', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  filterConfig: jsonb('filter_config').$type<{
    states?: string[];
    waterTypes?: string[];
    regions?: string[];
    saleYearMin?: number;
    saleYearMax?: number;
    salePriceMin?: number;
    salePriceMax?: number;
    capRateMin?: number;
    capRateMax?: number;
    wetSlipsMin?: number;
    wetSlipsMax?: number;
    [key: string]: any;
  }>().notNull(),
  isDefault: boolean('is_default').default(false),
  isShared: boolean('is_shared').default(false), // Share with org members
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgUserIdx: index('sc_saved_filters_org_user_idx').on(table.orgId, table.userId),
  orgSharedIdx: index('sc_saved_filters_org_shared_idx').on(table.orgId, table.isShared),
}));

// Comp tags - for bulk tagging and organization
export const scCompTags = pgTable('sc_comp_tags', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  color: varchar('color', { length: 7 }), // Hex color code
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgNameIdx: index('sc_comp_tags_org_name_idx').on(table.orgId, table.name),
}));

// Comp-tag relationships (many-to-many)
export const scCompTagAssignments = pgTable('sc_comp_tag_assignments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  compId: varchar('comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  tagId: varchar('tag_id').notNull().references(() => scCompTags.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  assignedBy: varchar('assigned_by').notNull().references(() => users.id),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
}, (table) => ({
  compTagIdx: index('sc_comp_tag_assignments_comp_tag_idx').on(table.compId, table.tagId),
  orgTagIdx: index('sc_comp_tag_assignments_org_tag_idx').on(table.orgId, table.tagId),
}));

// Scenario groupings - group comps by deal/scenario for analysis
export const scScenarios = pgTable('sc_scenarios', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  dealId: varchar('deal_id').references(() => crmDeals.id, { onDelete: 'set null' }), // Link to CRM deal
  projectId: varchar('project_id').references(() => projects.id, { onDelete: 'set null' }), // Link to DD project
  modelingProjectId: varchar('modeling_project_id').references(() => modelingProjects.id, { onDelete: 'set null' }),
  status: text('status').default('active'), // 'active' | 'archived'
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('sc_scenarios_org_idx').on(table.orgId),
  orgDealIdx: index('sc_scenarios_org_deal_idx').on(table.orgId, table.dealId),
  orgStatusIdx: index('sc_scenarios_org_status_idx').on(table.orgId, table.status),
}));

// Scenario-comp relationships
export const scScenarioComps = pgTable('sc_scenario_comps', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  scenarioId: varchar('scenario_id').notNull().references(() => scScenarios.id, { onDelete: 'cascade' }),
  compId: varchar('comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  addedBy: varchar('added_by').notNull().references(() => users.id),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  notes: text('notes'),
}, (table) => ({
  scenarioCompIdx: index('sc_scenario_comps_scenario_comp_idx').on(table.scenarioId, table.compId),
  orgScenarioIdx: index('sc_scenario_comps_org_scenario_idx').on(table.orgId, table.scenarioId),
}));

// Market benchmarks - external market data for comparison
export const scMarketBenchmarks = pgTable('sc_market_benchmarks', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  source: text('source').notNull(), // 'marina_association' | 'custom' | 'industry_report'
  region: text('region'), // Geographic region this applies to
  state: text('state'),
  waterType: text('water_type'),
  year: integer('year').notNull(),
  quarter: integer('quarter'), // 1-4, null for annual
  metrics: jsonb('metrics').$type<{
    avgPricePerSlip?: number;
    medianPricePerSlip?: number;
    avgCapRate?: number;
    avgSalePrice?: number;
    transactionVolume?: number;
    transactionCount?: number;
    avgOccupancy?: number;
    [key: string]: any;
  }>().notNull(),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgYearIdx: index('sc_market_benchmarks_org_year_idx').on(table.orgId, table.year),
  orgRegionIdx: index('sc_market_benchmarks_org_region_idx').on(table.orgId, table.region),
  orgSourceIdx: index('sc_market_benchmarks_org_source_idx').on(table.orgId, table.source),
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
  // Enhanced import tracking fields
  batchId: varchar('batch_id'), // Links to import batch for multi-file reconciliation
  dataSource: text('data_source'), // 'broker', 'costar', etc.
  sourceContact: text('source_contact'), // Who provided this file
  validationResults: jsonb('validation_results').$type<{
    passed: number;
    warnings: number;
    errors: number;
    outliers: Array<{ row: number; field: string; value: any; reason: string; }>;
  }>(),
}, (table) => ({
  orgIdx: index('comp_imports_org_idx').on(table.orgId),
  batchIdx: index('comp_imports_batch_idx').on(table.batchId),
}));

// Import batches - for multi-source reconciliation
export const scImportBatches = pgTable('sc_import_batches', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  
  name: text('name'), // User-friendly batch name
  description: text('description'),
  status: text('status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  
  // Batch statistics
  totalFiles: integer('total_files').default(0),
  totalRecords: integer('total_records').default(0),
  insertedCount: integer('inserted_count').default(0),
  updatedCount: integer('updated_count').default(0),
  skippedCount: integer('skipped_count').default(0),
  errorCount: integer('error_count').default(0),
  
  // Reconciliation tracking
  duplicatesFound: integer('duplicates_found').default(0),
  duplicatesResolved: integer('duplicates_resolved').default(0),
  conflictsFound: integer('conflicts_found').default(0),
  conflictsResolved: integer('conflicts_resolved').default(0),
  
  // Sources in this batch
  sources: text('sources').array().default(sql`'{}'`), // Array of data sources
}, (table) => ({
  orgIdx: index('sc_import_batches_org_idx').on(table.orgId),
  orgStatusIdx: index('sc_import_batches_org_status_idx').on(table.orgId, table.status),
  orgCreatedIdx: index('sc_import_batches_org_created_idx').on(table.orgId, table.createdAt),
}));

// Validation rules - configurable thresholds for import validation
export const scValidationRules = pgTable('sc_validation_rules', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  
  // Rule configuration
  field: text('field').notNull(), // Which field this applies to
  ruleType: text('rule_type').notNull(), // 'range', 'required', 'format', 'custom'
  severity: text('severity').default('warning'), // 'warning', 'error'
  
  // Rule parameters (depends on ruleType)
  minValue: decimal('min_value', { precision: 15, scale: 4 }),
  maxValue: decimal('max_value', { precision: 15, scale: 4 }),
  pattern: text('pattern'), // Regex pattern for format validation
  customLogic: text('custom_logic'), // Custom validation expression
  
  // Suggested action when violated
  suggestedAction: text('suggested_action'), // 'flag', 'exclude', 'auto_fix'
  autoFixValue: text('auto_fix_value'), // Value to use for auto-fix
}, (table) => ({
  orgIdx: index('sc_validation_rules_org_idx').on(table.orgId),
  orgFieldIdx: index('sc_validation_rules_org_field_idx').on(table.orgId, table.field),
  orgActiveIdx: index('sc_validation_rules_org_active_idx').on(table.orgId, table.isActive),
}));

// Comp history - preserves historical values when records are updated
export const scCompHistory = pgTable('sc_comp_history', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  compId: varchar('comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  
  changedBy: varchar('changed_by').notNull().references(() => users.id),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
  
  changeType: text('change_type').notNull(), // 'create', 'update', 'merge', 'bulk_update'
  changeSource: text('change_source'), // 'manual', 'import', 'api', 'system'
  importBatchId: varchar('import_batch_id'), // If from an import
  
  // Snapshot of changed fields
  previousValues: jsonb('previous_values').$type<Record<string, unknown>>().default({}),
  newValues: jsonb('new_values').$type<Record<string, unknown>>().default({}),
  
  // Change metadata
  changeReason: text('change_reason'), // User-provided reason
  affectedFields: text('affected_fields').array().default(sql`'{}'`),
}, (table) => ({
  orgIdx: index('sc_comp_history_org_idx').on(table.orgId),
  compIdx: index('sc_comp_history_comp_idx').on(table.compId),
  orgCompDateIdx: index('sc_comp_history_org_comp_date_idx').on(table.orgId, table.compId, table.changedAt),
  changeTypeIdx: index('sc_comp_history_change_type_idx').on(table.orgId, table.changeType),
}));

// Comp adjustments - for appraisal-style comp adjustments
export const scCompAdjustments = pgTable('sc_comp_adjustments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  
  // Links
  compId: varchar('comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  targetPropertyId: varchar('target_property_id').references(() => crmProperties.id, { onDelete: 'set null' }),
  projectId: varchar('project_id'), // Optional link to a modeling project
  
  // Adjustment calculations
  timeAdjustment: decimal('time_adjustment', { precision: 10, scale: 4 }), // % adjustment for time since sale
  locationAdjustment: decimal('location_adjustment', { precision: 10, scale: 4 }), // % adjustment for location differences
  sizeAdjustment: decimal('size_adjustment', { precision: 10, scale: 4 }), // % adjustment for size differences
  conditionAdjustment: decimal('condition_adjustment', { precision: 10, scale: 4 }), // % adjustment for condition
  amenitiesAdjustment: decimal('amenities_adjustment', { precision: 10, scale: 4 }), // % adjustment for amenity differences
  marketAdjustment: decimal('market_adjustment', { precision: 10, scale: 4 }), // % adjustment for market conditions
  customAdjustment: decimal('custom_adjustment', { precision: 10, scale: 4 }), // Any other adjustments
  
  // Totals
  grossAdjustment: decimal('gross_adjustment', { precision: 10, scale: 4 }), // Sum of absolute adjustments
  netAdjustment: decimal('net_adjustment', { precision: 10, scale: 4 }), // Sum of signed adjustments
  adjustedPrice: integer('adjusted_price'), // Final adjusted price
  adjustedCapRate: decimal('adjusted_cap_rate', { precision: 6, scale: 4 }),
  
  // Adjustment notes
  notes: text('notes'),
  adjustmentDetails: jsonb('adjustment_details').$type<{
    timeNotes?: string;
    locationNotes?: string;
    sizeNotes?: string;
    conditionNotes?: string;
    amenitiesNotes?: string;
    marketNotes?: string;
    customNotes?: string;
  }>().default({}),
  
  // Weight for this comp in analysis
  compWeight: decimal('comp_weight', { precision: 5, scale: 4 }).default('1'), // 0-1 weight for weighted analysis
}, (table) => ({
  orgIdx: index('sc_comp_adjustments_org_idx').on(table.orgId),
  compIdx: index('sc_comp_adjustments_comp_idx').on(table.compId),
  targetIdx: index('sc_comp_adjustments_target_idx').on(table.targetPropertyId),
  projectIdx: index('sc_comp_adjustments_project_idx').on(table.projectId),
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

// Import batch schemas
export const insertScImportBatchSchema = createInsertSchema(scImportBatches).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const updateScImportBatchSchema = insertScImportBatchSchema.partial().omit({
  orgId: true,
  createdBy: true,
});

// Validation rules schemas
export const insertScValidationRuleSchema = createInsertSchema(scValidationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateScValidationRuleSchema = insertScValidationRuleSchema.partial().omit({
  orgId: true,
  createdBy: true,
});

// Comp history schemas
export const insertScCompHistorySchema = createInsertSchema(scCompHistory).omit({
  id: true,
  changedAt: true,
});

// Comp adjustments schemas
export const insertScCompAdjustmentSchema = createInsertSchema(scCompAdjustments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateScCompAdjustmentSchema = insertScCompAdjustmentSchema.partial().omit({
  orgId: true,
  createdBy: true,
  compId: true,
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

// Institutional data governance types
export type ScImportBatch = typeof scImportBatches.$inferSelect;
export type InsertScImportBatch = z.infer<typeof insertScImportBatchSchema>;
export type UpdateScImportBatch = z.infer<typeof updateScImportBatchSchema>;

export type ScValidationRule = typeof scValidationRules.$inferSelect;
export type InsertScValidationRule = z.infer<typeof insertScValidationRuleSchema>;
export type UpdateScValidationRule = z.infer<typeof updateScValidationRuleSchema>;

export type ScCompHistory = typeof scCompHistory.$inferSelect;
export type InsertScCompHistory = z.infer<typeof insertScCompHistorySchema>;

export type ScCompAdjustment = typeof scCompAdjustments.$inferSelect;
export type InsertScCompAdjustment = z.infer<typeof insertScCompAdjustmentSchema>;
export type UpdateScCompAdjustment = z.infer<typeof updateScCompAdjustmentSchema>;
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
  address: text('address'),
  zip: text('zip'),
  lat: decimal('lat', { precision: 10, scale: 7 }), // Geocoded latitude
  lng: decimal('lng', { precision: 10, scale: 7 }), // Geocoded longitude
  acres: integer('acres'),
  occupancy: integer('occupancy'),
  yearBuilt: integer('year_built'),
  articleUrls: text('article_urls').array().default(sql`'{}'`),
  notes: text('notes'),

  // Rate-focused fields (for rate comp functionality)
  rateCollectionDate: text('rate_collection_date'),
  rateSource: text('rate_source'),
  rateTrend: text('rate_trend'),
  lastVerifiedDate: text('last_verified_date'),
  sourceNotes: text('source_notes'),

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

  // Link to Marina Rate Database (for rate data consolidation)
  marinaId: varchar('marina_id').references(() => marinaRateDatabase.id, { onDelete: 'set null' }),

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
    seasonMonths?: number; // Number of months in the season (e.g., 6 for seasonal, 12 for year-round)
    seasonStartMonth?: number; // 1-12 for January-December
    seasonEndMonth?: number; // 1-12 for January-December
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

// ============================================================================
// RATE TIERS - Detailed Rate Tracking for Rate Comps
// ============================================================================

// Storage type constants for rate comps
export const rateStorageTypes = ['wet_slip', 'dry_rack', 'mooring', 'trailer', 'rack_storage', 'lift_storage', 'kayak_sup', 'jet_ski', 'rv_space'] as const;
export type RateStorageType = typeof rateStorageTypes[number];

// Rate period constants
export const ratePeriods = ['daily', 'weekly', 'monthly', 'seasonal', 'annual'] as const;
export type RatePeriod = typeof ratePeriods[number];

// Rate unit constants
export const rateUnits = ['per_foot', 'flat', 'per_foot_beam', 'per_foot_loa'] as const;
export type RateUnit = typeof rateUnits[number];

// Size basis constants
export const rateSizeBases = ['loa_range', 'exact_loa', 'beam', 'category', 'any'] as const;
export type RateSizeBasis = typeof rateSizeBases[number];

// Protection level constants
export const rateProtectionLevels = ['open', 'protected', 'covered', 'indoor'] as const;
export type RateProtectionLevel = typeof rateProtectionLevels[number];

// Rate Tiers - detailed pricing tiers linked to rate comps (marina records)
export const rateTiers = pgTable('rate_tiers', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  rateCompId: varchar('rate_comp_id').notNull().references(() => rateComps.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),

  tierLabel: text('tier_label'),
  displayOrder: integer('display_order').default(0),
  
  storageType: text('storage_type').notNull(),
  
  sizeBasis: text('size_basis').default('loa_range'),
  loaMin: integer('loa_min'),
  loaMax: integer('loa_max'),
  beamMin: integer('beam_min'),
  beamMax: integer('beam_max'),
  draftMax: integer('draft_max'),
  categoryLabel: text('category_label'),
  
  rateUnit: text('rate_unit').notNull(),
  ratePeriod: text('rate_period').notNull(),
  amountCents: integer('amount_cents').notNull(),
  
  seasonality: text('seasonality').default('annual'),
  seasonStartMonth: integer('season_start_month'),
  seasonEndMonth: integer('season_end_month'),
  
  effectiveDate: date('effective_date'),
  expirationDate: date('expiration_date'),
  rateYear: integer('rate_year'), // Year the rate applies (for historical tracking)
  isCurrentRate: boolean('is_current_rate').default(true),
  
  minTermMonths: integer('min_term_months'),
  depositRequired: boolean('deposit_required').default(false),
  depositAmountCents: integer('deposit_amount_cents'),
  
  electricIncluded: boolean('electric_included').default(false),
  electricAmps: integer('electric_amps').array().default(sql`'{}'`),
  electricAdditionalCents: integer('electric_additional_cents'),
  
  waterIncluded: boolean('water_included').default(true),
  wifiIncluded: boolean('wifi_included').default(false),
  pumpOutIncluded: boolean('pump_out_included').default(false),
  
  protectionLevel: text('protection_level'),
  isCovered: boolean('is_covered').default(false),
  
  liveaboardAllowed: boolean('liveaboard_allowed'),
  liveaboardAdditionalCents: integer('liveaboard_additional_cents'),
  
  taxesIncluded: boolean('taxes_included').default(false),
  taxRate: decimal('tax_rate', { precision: 5, scale: 3 }),
  
  waitlistOnly: boolean('waitlist_only').default(false),
  availabilityNotes: text('availability_notes'),
  
  normalizedUnit: text('normalized_unit').default('usd_per_ft_per_month'),
  normalizedValue: integer('normalized_value'),
  normalizedMethod: text('normalized_method'),
  normalizedAt: timestamp('normalized_at'),
  
  sourceType: text('source_type'),
  sourceUrl: text('source_url'),
  sourceDate: date('source_date'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: varchar('verified_by').references(() => users.id),
  
  notes: text('notes'),
  custom: jsonb('custom').$type<Record<string, unknown>>().default({}),
}, (table) => ({
  rateCompIdx: index('rate_tiers_rate_comp_idx').on(table.rateCompId),
  orgIdx: index('rate_tiers_org_idx').on(table.orgId),
  orgStorageIdx: index('rate_tiers_org_storage_idx').on(table.orgId, table.storageType),
  orgLoaIdx: index('rate_tiers_org_loa_idx').on(table.orgId, table.loaMin, table.loaMax),
  orgNormalizedIdx: index('rate_tiers_org_normalized_idx').on(table.orgId, table.normalizedValue),
  orgCurrentIdx: index('rate_tiers_org_current_idx').on(table.orgId, table.isCurrentRate),
  orgYearIdx: index('rate_tiers_org_year_idx').on(table.orgId, table.rateYear),
}));

// Rate Tier Relations
export const rateTiersRelations = relations(rateTiers, ({ one }) => ({
  organization: one(organizations, {
    fields: [rateTiers.orgId],
    references: [organizations.id],
  }),
  rateComp: one(rateComps, {
    fields: [rateTiers.rateCompId],
    references: [rateComps.id],
  }),
  createdByUser: one(users, {
    fields: [rateTiers.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [rateTiers.updatedBy],
    references: [users.id],
  }),
}));

// Zod schemas for Rate Tiers
export const insertRateTierSchema = createInsertSchema(rateTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateRateTierSchema = insertRateTierSchema.partial().omit({
  orgId: true,
  rateCompId: true,
  createdBy: true,
});

// Rate analytics filter interface
export const rateAnalyticsFiltersSchema = z.object({
  states: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  waterTypes: z.array(z.string()).optional(),
  storageTypes: z.array(z.string()).optional(),
  
  loaMin: z.number().optional(),
  loaMax: z.number().optional(),
  beamMin: z.number().optional(),
  beamMax: z.number().optional(),
  
  rateUnits: z.array(z.string()).optional(),
  ratePeriods: z.array(z.string()).optional(),
  
  normalizedValueMin: z.number().optional(),
  normalizedValueMax: z.number().optional(),
  
  effectiveDateMin: z.string().optional(),
  effectiveDateMax: z.string().optional(),
  
  electricIncluded: z.boolean().optional(),
  protectionLevels: z.array(z.string()).optional(),
  isCovered: z.boolean().optional(),
  
  isCurrentRate: z.boolean().optional(),
  seasonality: z.array(z.string()).optional(),
});

export type RateAnalyticsFilters = z.infer<typeof rateAnalyticsFiltersSchema>;

// Types for Rate Tiers
export type RateTier = typeof rateTiers.$inferSelect;
export type InsertRateTier = z.infer<typeof insertRateTierSchema>;
export type UpdateRateTier = z.infer<typeof updateRateTierSchema>;

// Rate Comp with tiers joined
export type RateCompWithTiers = RateComp & {
  tiers: RateTier[];
};

// ============================================================================
// MARINA RATE DATABASE - US Marina Registry with Historical Rate Tracking
// ============================================================================

// Marina Rate Database - central registry of US marinas with rate tracking
export const marinaRateDatabase = pgTable('marina_rate_database', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),

  // Marina identification
  marinaName: text('marina_name').notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  country: text('country').default('USA'),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),
  region: text('region'),

  // Marina characteristics
  waterType: text('water_type'), // 'Coastal' | 'Lake' | 'River'
  bodyOfWater: text('body_of_water'),
  waterBodyName: text('water_body_name'),
  
  // Facility counts
  wetSlips: integer('wet_slips'),
  dryRacks: integer('dry_racks'),
  moorings: integer('moorings'),
  trailerSpaces: integer('trailer_spaces'),
  rvSpaces: integer('rv_spaces'),
  
  // Contact info
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  
  // Status tracking
  isActive: boolean('is_active').default(true),
  lastRateUpdate: timestamp('last_rate_update'),
  rateSource: text('rate_source'), // 'Website' | 'Phone' | 'Email' | 'Visit' | 'Broker' | 'Other'
  
  // CRM linkage
  propertyId: varchar('property_id').references(() => crmProperties.id, { onDelete: 'set null' }),
  
  // Additional info
  notes: text('notes'),
  custom: jsonb('custom').$type<Record<string, unknown>>().default({}),
}, (table) => ({
  orgIdx: index('marina_rate_db_org_idx').on(table.orgId),
  orgStateIdx: index('marina_rate_db_org_state_idx').on(table.orgId, table.state),
  orgRegionIdx: index('marina_rate_db_org_region_idx').on(table.orgId, table.region),
  orgActiveIdx: index('marina_rate_db_org_active_idx').on(table.orgId, table.isActive),
  orgNameIdx: index('marina_rate_db_org_name_idx').on(table.orgId, table.marinaName),
  propertyIdx: index('marina_rate_db_property_idx').on(table.propertyId),
}));

// Marina Rate History - stores individual rate records tied to year/season
export const marinaRates = pgTable('marina_rates', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  marinaId: varchar('marina_id').notNull().references(() => marinaRateDatabase.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),

  // Time period for this rate
  rateYear: integer('rate_year').notNull(), // e.g., 2023, 2024
  rateSeason: text('rate_season'), // e.g., 'Annual', 'Summer 2024', 'Winter 2023-24', 'Peak Season'
  effectiveDate: date('effective_date'),
  expirationDate: date('expiration_date'),
  isCurrentRate: boolean('is_current_rate').default(true),

  // Rate details
  storageType: text('storage_type').notNull(), // 'wet_slip', 'dry_rack', 'mooring', etc.
  tierLabel: text('tier_label'), // e.g., 'Up to 25ft', '26-35ft', 'Premium'
  
  // Size parameters
  loaMin: integer('loa_min'),
  loaMax: integer('loa_max'),
  beamMin: integer('beam_min'),
  beamMax: integer('beam_max'),
  
  // Pricing
  rateUnit: text('rate_unit').notNull(), // 'per_foot', 'flat', 'per_foot_beam'
  ratePeriod: text('rate_period').notNull(), // 'daily', 'weekly', 'monthly', 'seasonal', 'annual'
  amountCents: integer('amount_cents').notNull(),
  
  // Normalized for comparison
  normalizedMonthlyPerFoot: integer('normalized_monthly_per_foot'), // Cents per foot per month
  
  // Seasonality
  seasonality: text('seasonality').default('annual'), // 'annual', 'seasonal', 'peak', 'off-peak'
  seasonStartMonth: integer('season_start_month'),
  seasonEndMonth: integer('season_end_month'),
  
  // Amenities included
  electricIncluded: boolean('electric_included').default(false),
  electricAmps: integer('electric_amps').array().default(sql`'{}'`),
  waterIncluded: boolean('water_included').default(true),
  wifiIncluded: boolean('wifi_included').default(false),
  pumpOutIncluded: boolean('pump_out_included').default(false),
  
  // Protection
  protectionLevel: text('protection_level'), // 'open', 'protected', 'covered', 'indoor'
  isCovered: boolean('is_covered').default(false),
  
  // Live-aboard
  liveaboardAllowed: boolean('liveaboard_allowed'),
  liveaboardAdditionalCents: integer('liveaboard_additional_cents'),
  
  // Source/verification
  sourceType: text('source_type'), // 'website', 'phone', 'email', 'visit', 'broker'
  sourceUrl: text('source_url'),
  sourceDate: date('source_date'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: varchar('verified_by').references(() => users.id),
  
  notes: text('notes'),
  custom: jsonb('custom').$type<Record<string, unknown>>().default({}),
}, (table) => ({
  marinaIdx: index('marina_rates_marina_idx').on(table.marinaId),
  orgIdx: index('marina_rates_org_idx').on(table.orgId),
  orgYearIdx: index('marina_rates_org_year_idx').on(table.orgId, table.rateYear),
  orgStorageIdx: index('marina_rates_org_storage_idx').on(table.orgId, table.storageType),
  orgCurrentIdx: index('marina_rates_org_current_idx').on(table.orgId, table.isCurrentRate),
  marinaYearIdx: index('marina_rates_marina_year_idx').on(table.marinaId, table.rateYear),
  marinaStorageIdx: index('marina_rates_marina_storage_idx').on(table.marinaId, table.storageType),
  trendIdx: index('marina_rates_trend_idx').on(table.marinaId, table.storageType, table.rateYear),
}));

// Relations for Marina Rate Database
export const marinaRateDatabaseRelations = relations(marinaRateDatabase, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [marinaRateDatabase.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [marinaRateDatabase.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [marinaRateDatabase.updatedBy],
    references: [users.id],
  }),
  property: one(crmProperties, {
    fields: [marinaRateDatabase.propertyId],
    references: [crmProperties.id],
  }),
  rates: many(marinaRates),
}));

// Relations for Marina Rates
export const marinaRatesRelations = relations(marinaRates, ({ one }) => ({
  marina: one(marinaRateDatabase, {
    fields: [marinaRates.marinaId],
    references: [marinaRateDatabase.id],
  }),
  organization: one(organizations, {
    fields: [marinaRates.orgId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [marinaRates.createdBy],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [marinaRates.updatedBy],
    references: [users.id],
  }),
  verifiedByUser: one(users, {
    fields: [marinaRates.verifiedBy],
    references: [users.id],
  }),
}));

// Zod schemas for Marina Rate Database
export const insertMarinaRateDatabaseSchema = createInsertSchema(marinaRateDatabase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

export const updateMarinaRateDatabaseSchema = insertMarinaRateDatabaseSchema.partial().omit({
  orgId: true,
  createdBy: true,
});

// Zod schemas for Marina Rates
export const insertMarinaRateSchema = createInsertSchema(marinaRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateMarinaRateSchema = insertMarinaRateSchema.partial().omit({
  orgId: true,
  marinaId: true,
  createdBy: true,
});

// Types for Marina Rate Database
export type MarinaRateDatabase = typeof marinaRateDatabase.$inferSelect;
export type InsertMarinaRateDatabase = z.infer<typeof insertMarinaRateDatabaseSchema>;
export type UpdateMarinaRateDatabase = z.infer<typeof updateMarinaRateDatabaseSchema>;

export type MarinaRate = typeof marinaRates.$inferSelect;
export type InsertMarinaRate = z.infer<typeof insertMarinaRateSchema>;
export type UpdateMarinaRate = z.infer<typeof updateMarinaRateSchema>;

// Marina with rates joined
export type MarinaWithRates = MarinaRateDatabase & {
  rates: MarinaRate[];
};

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
// SERVICE DEPARTMENT - Work Orders, Parts, Technicians, Labor
// ================================================================================

// Service Technicians - Staff who perform service work
export const serviceTechnicians = pgTable('service_technicians', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').references(() => users.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  specialties: text('specialties').array(),
  certifications: jsonb('certifications').default(sql`'[]'`),
  isActive: boolean('is_active').default(true).notNull(),
  hireDate: date('hire_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('service_technicians_org_idx').on(table.orgId),
  activeIdx: index('service_technicians_active_idx').on(table.isActive),
  userIdx: index('service_technicians_user_idx').on(table.userId),
}));

// Service Parts - Parts inventory for service department
export const serviceParts = pgTable('service_parts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  partNumber: text('part_number').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: partsCategoryEnum('category').notNull().default('general'),
  manufacturer: text('manufacturer'),
  unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).notNull(),
  retailPrice: decimal('retail_price', { precision: 10, scale: 2 }).notNull(),
  quantityOnHand: integer('quantity_on_hand').default(0).notNull(),
  reorderPoint: integer('reorder_point').default(5).notNull(),
  reorderQuantity: integer('reorder_quantity').default(10).notNull(),
  location: text('location'),
  isActive: boolean('is_active').default(true).notNull(),
  glAccount: text('gl_account'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('service_parts_org_idx').on(table.orgId),
  partNumberIdx: index('service_parts_part_number_idx').on(table.partNumber),
  categoryIdx: index('service_parts_category_idx').on(table.category),
  activeIdx: index('service_parts_active_idx').on(table.isActive),
  uniquePartNumber: unique('service_parts_org_part_number').on(table.orgId, table.partNumber),
}));

// Service Work Orders - Main work order tracking
export const serviceWorkOrders = pgTable('service_work_orders', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  workOrderNumber: text('work_order_number').notNull(),
  customerId: varchar('customer_id').references(() => marinaCustomers.id),
  contactId: varchar('contact_id').references(() => crmContacts.id),
  boatId: varchar('boat_id').references(() => boatRegistry.id),
  boatName: text('boat_name'),
  boatMake: text('boat_make'),
  boatModel: text('boat_model'),
  boatYear: integer('boat_year'),
  jobType: serviceJobTypeEnum('job_type').notNull().default('maintenance'),
  status: workOrderStatusEnum('status').notNull().default('pending'),
  priority: workOrderPriorityEnum('priority').notNull().default('normal'),
  description: text('description').notNull(),
  estimatedHours: decimal('estimated_hours', { precision: 6, scale: 2 }),
  actualHours: decimal('actual_hours', { precision: 6, scale: 2 }),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
  laborTotal: decimal('labor_total', { precision: 10, scale: 2 }).default('0'),
  partsTotal: decimal('parts_total', { precision: 10, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).default('0'),
  scheduledDate: date('scheduled_date'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  assignedTechnicianId: varchar('assigned_technician_id').references(() => serviceTechnicians.id),
  internalNotes: text('internal_notes'),
  customerNotes: text('customer_notes'),
  glAccount: text('gl_account'),
  invoiceId: varchar('invoice_id'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('service_work_orders_org_idx').on(table.orgId),
  workOrderNumberIdx: index('service_work_orders_number_idx').on(table.workOrderNumber),
  statusIdx: index('service_work_orders_status_idx').on(table.status),
  customerIdx: index('service_work_orders_customer_idx').on(table.customerId),
  technicianIdx: index('service_work_orders_technician_idx').on(table.assignedTechnicianId),
  scheduledDateIdx: index('service_work_orders_scheduled_date_idx').on(table.scheduledDate),
  uniqueWorkOrderNumber: unique('service_work_orders_org_number').on(table.orgId, table.workOrderNumber),
}));

// Service Labor Entries - Time tracking for work orders
export const serviceLaborEntries = pgTable('service_labor_entries', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  workOrderId: varchar('work_order_id').notNull().references(() => serviceWorkOrders.id, { onDelete: 'cascade' }),
  technicianId: varchar('technician_id').notNull().references(() => serviceTechnicians.id),
  description: text('description'),
  hours: decimal('hours', { precision: 6, scale: 2 }).notNull(),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  workDate: date('work_date').notNull(),
  startTime: time('start_time'),
  endTime: time('end_time'),
  isBillable: boolean('is_billable').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('service_labor_entries_org_idx').on(table.orgId),
  workOrderIdx: index('service_labor_entries_work_order_idx').on(table.workOrderId),
  technicianIdx: index('service_labor_entries_technician_idx').on(table.technicianId),
  workDateIdx: index('service_labor_entries_work_date_idx').on(table.workDate),
}));

// Service Parts Used - Parts used on work orders
export const servicePartsUsed = pgTable('service_parts_used', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  workOrderId: varchar('work_order_id').notNull().references(() => serviceWorkOrders.id, { onDelete: 'cascade' }),
  partId: varchar('part_id').notNull().references(() => serviceParts.id),
  quantity: integer('quantity').notNull().default(1),
  unitCost: decimal('unit_cost', { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('service_parts_used_org_idx').on(table.orgId),
  workOrderIdx: index('service_parts_used_work_order_idx').on(table.workOrderId),
  partIdx: index('service_parts_used_part_idx').on(table.partId),
}));

// ================================================================================
// BOAT RENTALS - Fleet, Reservations, Pricing
// ================================================================================

// Boat Rental Fleet - Rental boat inventory
export const boatRentalFleet = pgTable('boat_rental_fleet', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  length: decimal('length', { precision: 5, scale: 2 }),
  capacity: integer('capacity'),
  engineType: text('engine_type'),
  engineHorsepower: integer('engine_horsepower'),
  fuelType: text('fuel_type'),
  registrationNumber: text('registration_number'),
  status: rentalStatusEnum('status').notNull().default('available'),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  halfDayRate: decimal('half_day_rate', { precision: 10, scale: 2 }),
  fullDayRate: decimal('full_day_rate', { precision: 10, scale: 2 }),
  weeklyRate: decimal('weekly_rate', { precision: 10, scale: 2 }),
  securityDeposit: decimal('security_deposit', { precision: 10, scale: 2 }),
  insuranceValue: decimal('insurance_value', { precision: 12, scale: 2 }),
  purchaseDate: date('purchase_date'),
  purchasePrice: decimal('purchase_price', { precision: 12, scale: 2 }),
  currentValue: decimal('current_value', { precision: 12, scale: 2 }),
  maintenanceNotes: text('maintenance_notes'),
  features: text('features').array(),
  images: jsonb('images').default(sql`'[]'`),
  glAccount: text('gl_account'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('boat_rental_fleet_org_idx').on(table.orgId),
  statusIdx: index('boat_rental_fleet_status_idx').on(table.status),
  activeIdx: index('boat_rental_fleet_active_idx').on(table.isActive),
}));

// Boat Rentals - Rental transactions/reservations
export const boatRentals = pgTable('boat_rentals', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  rentalNumber: text('rental_number').notNull(),
  boatId: varchar('boat_id').notNull().references(() => boatRentalFleet.id),
  customerId: varchar('customer_id').references(() => marinaCustomers.id),
  contactId: varchar('contact_id').references(() => crmContacts.id),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email'),
  customerPhone: text('customer_phone'),
  status: rentalBookingStatusEnum('status').notNull().default('pending'),
  pricingType: rentalPricingTypeEnum('pricing_type').notNull().default('full_day'),
  startDateTime: timestamp('start_date_time', { withTimezone: true }).notNull(),
  endDateTime: timestamp('end_date_time', { withTimezone: true }).notNull(),
  actualReturnTime: timestamp('actual_return_time', { withTimezone: true }),
  baseRate: decimal('base_rate', { precision: 10, scale: 2 }).notNull(),
  hoursRented: decimal('hours_rented', { precision: 6, scale: 2 }),
  fuelCharge: decimal('fuel_charge', { precision: 10, scale: 2 }).default('0'),
  damageCharge: decimal('damage_charge', { precision: 10, scale: 2 }).default('0'),
  lateCharge: decimal('late_charge', { precision: 10, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  depositPaid: decimal('deposit_paid', { precision: 10, scale: 2 }).default('0'),
  depositReturned: decimal('deposit_returned', { precision: 10, scale: 2 }).default('0'),
  paymentMethod: paymentMethodEnum('payment_method'),
  checkoutNotes: text('checkout_notes'),
  returnNotes: text('return_notes'),
  damageReport: text('damage_report'),
  fuelLevelOut: integer('fuel_level_out'),
  fuelLevelIn: integer('fuel_level_in'),
  mileageOut: decimal('mileage_out', { precision: 10, scale: 1 }),
  mileageIn: decimal('mileage_in', { precision: 10, scale: 1 }),
  checkedOutBy: varchar('checked_out_by').references(() => users.id),
  checkedInBy: varchar('checked_in_by').references(() => users.id),
  glAccount: text('gl_account'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('boat_rentals_org_idx').on(table.orgId),
  rentalNumberIdx: index('boat_rentals_number_idx').on(table.rentalNumber),
  boatIdx: index('boat_rentals_boat_idx').on(table.boatId),
  customerIdx: index('boat_rentals_customer_idx').on(table.customerId),
  statusIdx: index('boat_rentals_status_idx').on(table.status),
  startDateIdx: index('boat_rentals_start_date_idx').on(table.startDateTime),
  uniqueRentalNumber: unique('boat_rentals_org_number').on(table.orgId, table.rentalNumber),
}));

// ================================================================================
// BOAT CLUB - Memberships, Fleet, Bookings
// ================================================================================

// Boat Club Fleet - Boats available to club members
export const boatClubFleet = pgTable('boat_club_fleet', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  make: text('make'),
  model: text('model'),
  year: integer('year'),
  length: decimal('length', { precision: 5, scale: 2 }),
  capacity: integer('capacity'),
  engineType: text('engine_type'),
  engineHorsepower: integer('engine_horsepower'),
  fuelType: text('fuel_type'),
  registrationNumber: text('registration_number'),
  status: rentalStatusEnum('status').notNull().default('available'),
  minimumMembershipTier: clubMembershipTierEnum('minimum_membership_tier').default('bronze'),
  hoursPerMonth: integer('hours_per_month'),
  advanceBookingDays: integer('advance_booking_days').default(14),
  purchaseDate: date('purchase_date'),
  purchasePrice: decimal('purchase_price', { precision: 12, scale: 2 }),
  currentValue: decimal('current_value', { precision: 12, scale: 2 }),
  maintenanceNotes: text('maintenance_notes'),
  features: text('features').array(),
  images: jsonb('images').default(sql`'[]'`),
  glAccount: text('gl_account'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('boat_club_fleet_org_idx').on(table.orgId),
  statusIdx: index('boat_club_fleet_status_idx').on(table.status),
  tierIdx: index('boat_club_fleet_tier_idx').on(table.minimumMembershipTier),
  activeIdx: index('boat_club_fleet_active_idx').on(table.isActive),
}));

// Boat Club Memberships - Member management
export const boatClubMemberships = pgTable('boat_club_memberships', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  memberNumber: text('member_number').notNull(),
  customerId: varchar('customer_id').references(() => marinaCustomers.id),
  contactId: varchar('contact_id').references(() => crmContacts.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  tier: clubMembershipTierEnum('tier').notNull().default('bronze'),
  status: clubMembershipStatusEnum('status').notNull().default('pending'),
  monthlyFee: decimal('monthly_fee', { precision: 10, scale: 2 }).notNull(),
  setupFee: decimal('setup_fee', { precision: 10, scale: 2 }).default('0'),
  hoursIncluded: integer('hours_included'),
  hoursUsedThisMonth: decimal('hours_used_this_month', { precision: 6, scale: 2 }).default('0'),
  additionalHourRate: decimal('additional_hour_rate', { precision: 10, scale: 2 }),
  joinDate: date('join_date').notNull(),
  renewalDate: date('renewal_date'),
  expirationDate: date('expiration_date'),
  autoRenew: boolean('auto_renew').default(true),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  boatingLicense: text('boating_license'),
  licenseExpiration: date('license_expiration'),
  notes: text('notes'),
  glAccount: text('gl_account'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('boat_club_memberships_org_idx').on(table.orgId),
  memberNumberIdx: index('boat_club_memberships_number_idx').on(table.memberNumber),
  statusIdx: index('boat_club_memberships_status_idx').on(table.status),
  tierIdx: index('boat_club_memberships_tier_idx').on(table.tier),
  customerIdx: index('boat_club_memberships_customer_idx').on(table.customerId),
  uniqueMemberNumber: unique('boat_club_memberships_org_number').on(table.orgId, table.memberNumber),
}));

// Boat Club Bookings - Reservation system
export const boatClubBookings = pgTable('boat_club_bookings', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  bookingNumber: text('booking_number').notNull(),
  membershipId: varchar('membership_id').notNull().references(() => boatClubMemberships.id),
  boatId: varchar('boat_id').notNull().references(() => boatClubFleet.id),
  status: clubBookingStatusEnum('status').notNull().default('pending'),
  startDateTime: timestamp('start_date_time', { withTimezone: true }).notNull(),
  endDateTime: timestamp('end_date_time', { withTimezone: true }).notNull(),
  actualReturnTime: timestamp('actual_return_time', { withTimezone: true }),
  hoursBooked: decimal('hours_booked', { precision: 6, scale: 2 }).notNull(),
  hoursUsed: decimal('hours_used', { precision: 6, scale: 2 }),
  isIncludedHours: boolean('is_included_hours').default(true),
  additionalHoursCharge: decimal('additional_hours_charge', { precision: 10, scale: 2 }).default('0'),
  fuelCharge: decimal('fuel_charge', { precision: 10, scale: 2 }).default('0'),
  cleaningCharge: decimal('cleaning_charge', { precision: 10, scale: 2 }).default('0'),
  damageCharge: decimal('damage_charge', { precision: 10, scale: 2 }).default('0'),
  totalCharges: decimal('total_charges', { precision: 10, scale: 2 }).default('0'),
  checkoutNotes: text('checkout_notes'),
  returnNotes: text('return_notes'),
  damageReport: text('damage_report'),
  fuelLevelOut: integer('fuel_level_out'),
  fuelLevelIn: integer('fuel_level_in'),
  checkedOutBy: varchar('checked_out_by').references(() => users.id),
  checkedInBy: varchar('checked_in_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('boat_club_bookings_org_idx').on(table.orgId),
  bookingNumberIdx: index('boat_club_bookings_number_idx').on(table.bookingNumber),
  membershipIdx: index('boat_club_bookings_membership_idx').on(table.membershipId),
  boatIdx: index('boat_club_bookings_boat_idx').on(table.boatId),
  statusIdx: index('boat_club_bookings_status_idx').on(table.status),
  startDateIdx: index('boat_club_bookings_start_date_idx').on(table.startDateTime),
  uniqueBookingNumber: unique('boat_club_bookings_org_number').on(table.orgId, table.bookingNumber),
}));

// ================================================================================
// BOAT SALES - Inventory, Sales, Trade-ins
// ================================================================================

// Boat Sales Inventory - New and used boats for sale
export const boatSalesInventory = pgTable('boat_sales_inventory', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  stockNumber: text('stock_number').notNull(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  condition: boatConditionEnum('condition').notNull().default('new'),
  status: boatSaleStatusEnum('status').notNull().default('available'),
  length: decimal('length', { precision: 5, scale: 2 }),
  beam: decimal('beam', { precision: 5, scale: 2 }),
  draft: decimal('draft', { precision: 5, scale: 2 }),
  weight: integer('weight'),
  capacity: integer('capacity'),
  hullMaterial: text('hull_material'),
  engineMake: text('engine_make'),
  engineModel: text('engine_model'),
  engineHorsepower: integer('engine_horsepower'),
  engineHours: integer('engine_hours'),
  fuelType: text('fuel_type'),
  fuelCapacity: integer('fuel_capacity'),
  registrationNumber: text('registration_number'),
  hullId: text('hull_id'),
  listPrice: decimal('list_price', { precision: 12, scale: 2 }).notNull(),
  minPrice: decimal('min_price', { precision: 12, scale: 2 }),
  cost: decimal('cost', { precision: 12, scale: 2 }),
  floorPlanAmount: decimal('floor_plan_amount', { precision: 12, scale: 2 }),
  floorPlanRate: decimal('floor_plan_rate', { precision: 5, scale: 3 }),
  floorPlanStartDate: date('floor_plan_start_date'),
  location: text('location'),
  slipNumber: text('slip_number'),
  consignorId: varchar('consignor_id').references(() => crmContacts.id),
  consignmentFeePercent: decimal('consignment_fee_percent', { precision: 5, scale: 2 }),
  features: text('features').array(),
  options: jsonb('options').default(sql`'[]'`),
  description: text('description'),
  internalNotes: text('internal_notes'),
  images: jsonb('images').default(sql`'[]'`),
  videos: jsonb('videos').default(sql`'[]'`),
  documents: jsonb('documents').default(sql`'[]'`),
  dateAcquired: date('date_acquired'),
  daysOnLot: integer('days_on_lot').default(0),
  webListing: boolean('web_listing').default(true),
  featuredListing: boolean('featured_listing').default(false),
  glAccount: text('gl_account'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('boat_sales_inventory_org_idx').on(table.orgId),
  stockNumberIdx: index('boat_sales_inventory_stock_idx').on(table.stockNumber),
  statusIdx: index('boat_sales_inventory_status_idx').on(table.status),
  conditionIdx: index('boat_sales_inventory_condition_idx').on(table.condition),
  makeModelIdx: index('boat_sales_inventory_make_model_idx').on(table.make, table.model),
  uniqueStockNumber: unique('boat_sales_inventory_org_stock').on(table.orgId, table.stockNumber),
}));

// Boat Sales Transactions - Sales records
export const boatSalesTransactions = pgTable('boat_sales_transactions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  transactionNumber: text('transaction_number').notNull(),
  inventoryId: varchar('inventory_id').notNull().references(() => boatSalesInventory.id),
  customerId: varchar('customer_id').references(() => marinaCustomers.id),
  contactId: varchar('contact_id').references(() => crmContacts.id),
  dealId: varchar('deal_id').references(() => crmDeals.id),
  buyerName: text('buyer_name').notNull(),
  buyerEmail: text('buyer_email'),
  buyerPhone: text('buyer_phone'),
  buyerAddress: jsonb('buyer_address').default(sql`'{}'`),
  saleDate: date('sale_date').notNull(),
  salePrice: decimal('sale_price', { precision: 12, scale: 2 }).notNull(),
  tradeInId: varchar('trade_in_id'),
  tradeInAllowance: decimal('trade_in_allowance', { precision: 12, scale: 2 }).default('0'),
  downPayment: decimal('down_payment', { precision: 12, scale: 2 }).default('0'),
  financedAmount: decimal('financed_amount', { precision: 12, scale: 2 }).default('0'),
  docFee: decimal('doc_fee', { precision: 10, scale: 2 }).default('0'),
  registrationFee: decimal('registration_fee', { precision: 10, scale: 2 }).default('0'),
  extendedWarranty: decimal('extended_warranty', { precision: 10, scale: 2 }).default('0'),
  otherFees: decimal('other_fees', { precision: 10, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  grossProfit: decimal('gross_profit', { precision: 12, scale: 2 }),
  commissionPercent: decimal('commission_percent', { precision: 5, scale: 2 }),
  commissionAmount: decimal('commission_amount', { precision: 10, scale: 2 }),
  salespersonId: varchar('salesperson_id').references(() => users.id),
  financingStatus: financingStatusEnum('financing_status').default('not_started'),
  lenderName: text('lender_name'),
  loanTermMonths: integer('loan_term_months'),
  interestRate: decimal('interest_rate', { precision: 5, scale: 3 }),
  monthlyPayment: decimal('monthly_payment', { precision: 10, scale: 2 }),
  deliveryDate: date('delivery_date'),
  deliveryNotes: text('delivery_notes'),
  isDelivered: boolean('is_delivered').default(false),
  notes: text('notes'),
  glAccount: text('gl_account'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('boat_sales_transactions_org_idx').on(table.orgId),
  transactionNumberIdx: index('boat_sales_transactions_number_idx').on(table.transactionNumber),
  inventoryIdx: index('boat_sales_transactions_inventory_idx').on(table.inventoryId),
  customerIdx: index('boat_sales_transactions_customer_idx').on(table.customerId),
  saleDateIdx: index('boat_sales_transactions_sale_date_idx').on(table.saleDate),
  salespersonIdx: index('boat_sales_transactions_salesperson_idx').on(table.salespersonId),
  uniqueTransactionNumber: unique('boat_sales_transactions_org_number').on(table.orgId, table.transactionNumber),
}));

// Boat Sales Trade-ins - Trade-in evaluations
export const boatSalesTradeIns = pgTable('boat_sales_trade_ins', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  tradeInNumber: text('trade_in_number').notNull(),
  customerId: varchar('customer_id').references(() => marinaCustomers.id),
  contactId: varchar('contact_id').references(() => crmContacts.id),
  customerName: text('customer_name').notNull(),
  status: tradeInStatusEnum('status').notNull().default('pending_evaluation'),
  make: text('make').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  length: decimal('length', { precision: 5, scale: 2 }),
  condition: boatConditionEnum('condition').notNull().default('good'),
  engineMake: text('engine_make'),
  engineModel: text('engine_model'),
  engineHours: integer('engine_hours'),
  registrationNumber: text('registration_number'),
  hullId: text('hull_id'),
  estimatedRetailValue: decimal('estimated_retail_value', { precision: 12, scale: 2 }),
  estimatedWholesaleValue: decimal('estimated_wholesale_value', { precision: 12, scale: 2 }),
  offeredAllowance: decimal('offered_allowance', { precision: 12, scale: 2 }),
  acceptedAllowance: decimal('accepted_allowance', { precision: 12, scale: 2 }),
  payoffAmount: decimal('payoff_amount', { precision: 12, scale: 2 }),
  lienHolder: text('lien_holder'),
  evaluationNotes: text('evaluation_notes'),
  conditionNotes: text('condition_notes'),
  images: jsonb('images').default(sql`'[]'`),
  evaluatedBy: varchar('evaluated_by').references(() => users.id),
  evaluatedDate: date('evaluated_date'),
  linkedTransactionId: varchar('linked_transaction_id').references(() => boatSalesTransactions.id),
  convertedToInventoryId: varchar('converted_to_inventory_id').references(() => boatSalesInventory.id),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('boat_sales_trade_ins_org_idx').on(table.orgId),
  tradeInNumberIdx: index('boat_sales_trade_ins_number_idx').on(table.tradeInNumber),
  statusIdx: index('boat_sales_trade_ins_status_idx').on(table.status),
  customerIdx: index('boat_sales_trade_ins_customer_idx').on(table.customerId),
  uniqueTradeInNumber: unique('boat_sales_trade_ins_org_number').on(table.orgId, table.tradeInNumber),
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

// Modeling Regions - Organization-specific customizable regions for modeling projects
export const modelingRegions = pgTable('modeling_regions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('modeling_regions_org_idx').on(table.orgId),
  activeIdx: index('modeling_regions_active_idx').on(table.isActive),
  sortOrderIdx: index('modeling_regions_sort_order_idx').on(table.sortOrder),
}));

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
  dealId: varchar('deal_id').references(() => crmDeals.id), // Link to CRM deal
  ddProjectId: varchar('dd_project_id').references(() => projects.id), // Link to DD project
  salesCompId: varchar('sales_comp_id').references(() => salesComps.id), // Link to sales comp
  rateCompId: varchar('rate_comp_id').references(() => rateComps.id), // Link to rate comp
  propertyId: varchar('property_id').references(() => crmProperties.id), // Link to CRM property
  companyId: varchar('company_id').references(() => crmCompanies.id), // Property owner/seller company
  
  // Geographic/regional data
  address: text('address'), // Street address
  city: text('city'),
  state: text('state'), // Two-letter state abbreviation
  zipCode: text('zip_code'),
  region: text('region'), // e.g., "Southeast", "Great Lakes", etc.
  
  // Deal source - how the deal originated
  dealSource: dealSourceEnum('deal_source'),
  
  // Custom metrics - extensible field for user-defined metrics
  customMetrics: jsonb('custom_metrics').default(sql`'{}'`), // Flexible structure for additional fields
  
  // Case configuration - custom labels for scenarios (base, aggressive, conservative, custom)
  caseLabels: jsonb('case_labels').default(sql`'{"base": "Base Case", "aggressive": "Aggressive Case", "conservative": "Conservative Case", "custom": "Custom Case"}'`),
  
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

// Transaction & Closing Costs - Transaction Closing Summary - Aggregated metrics and computations (1:1 with modeling_projects)
export const transactionClosingSummary = pgTable('transaction_closing_summary', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }).unique(),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Purchase price (can be pulled from modeling project or manually overridden)
  purchasePrice: decimal('purchase_price', { precision: 18, scale: 2 }),
  
  // Closing costs
  totalClosingCosts: decimal('total_closing_costs', { precision: 18, scale: 2 }),
  
  // Financing fees
  financingFeeRate: decimal('financing_fee_rate', { precision: 10, scale: 6 }), // e.g., 0.01 = 1%
  financingBaseAmount: decimal('financing_base_amount', { precision: 18, scale: 2 }), // Base amount for fee calculation
  financingFees: decimal('financing_fees', { precision: 18, scale: 2 }), // Computed: rate * base
  
  // Working capital
  workingCapitalMonths: integer('working_capital_months'), // Number of months of expenses
  workingCapitalMonthlyExpenseBase: decimal('working_capital_monthly_expense_base', { precision: 18, scale: 2 }), // Annual opex / 12
  workingCapitalRequired: decimal('working_capital_required', { precision: 18, scale: 2 }), // months * monthly base
  
  // Transition costs
  transitionCostsTotal: decimal('transition_costs_total', { precision: 18, scale: 2 }),
  
  // CapEx (can be pulled from CapEx module or manually entered)
  capexPhase1: decimal('capex_phase1', { precision: 18, scale: 2 }),
  capexPhase2: decimal('capex_phase2', { precision: 18, scale: 2 }),
  capexPhase3: decimal('capex_phase3', { precision: 18, scale: 2 }),
  
  // Total investment cost (computed)
  totalInvestmentCost: decimal('total_investment_cost', { precision: 18, scale: 2 }),
  
  // Net working capital outputs
  currentAssetsTotal: decimal('current_assets_total', { precision: 18, scale: 2 }),
  currentLiabilitiesTotal: decimal('current_liabilities_total', { precision: 18, scale: 2 }),
  currentRatio: decimal('current_ratio', { precision: 18, scale: 6 }), // = current_assets / current_liabilities
  arMinusAp: decimal('ar_minus_ap', { precision: 18, scale: 2 }), // Accounts Receivable - Accounts Payable
  nwcAdjustmentsTotal: decimal('nwc_adjustments_total', { precision: 18, scale: 2 }),
  workingCapitalBalance: decimal('working_capital_balance', { precision: 18, scale: 2 }), // (assets - liabilities) + adjustments
  currentRatioAsOfDate: date('current_ratio_as_of_date'),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  modelingProjectIdx: index('transaction_closing_summary_modeling_project_idx').on(table.modelingProjectId),
  orgIdx: index('transaction_closing_summary_org_idx').on(table.orgId),
}));

// Closing Cost Lines - Detailed line items for closing costs
export const closingCostLines = pgTable('closing_cost_lines', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  category: text('category').notNull(), // e.g., "Legal Fees", "Broker Fees", "Survey", etc.
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  isFinancingFee: boolean('is_financing_fee').notNull().default(false), // True if this is the computed financing fee row
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  modelingProjectIdx: index('closing_cost_lines_modeling_project_idx').on(table.modelingProjectId),
  orgIdx: index('closing_cost_lines_org_idx').on(table.orgId),
}));

// Transition Cost Lines - Detailed line items for transition costs
export const transitionCostLines = pgTable('transition_cost_lines', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  category: text('category').notNull(), // e.g., "Office 365", "Software/Migration", "Hardware", etc.
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  modelingProjectIdx: index('transition_cost_lines_modeling_project_idx').on(table.modelingProjectId),
  orgIdx: index('transition_cost_lines_org_idx').on(table.orgId),
}));

// NWC Lines - Net Working Capital inputs (current assets, liabilities, adjustments)
export const nwcLines = pgTable('nwc_lines', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  bucketType: nwcBucketTypeEnum('bucket_type').notNull(), // "current_asset", "current_liability", "nwc_adjustment"
  label: text('label').notNull(), // e.g., "Cash", "Accounts Receivables", "Inventory", etc.
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull().default('0'),
  sortOrder: integer('sort_order').notNull().default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  modelingProjectIdx: index('nwc_lines_modeling_project_idx').on(table.modelingProjectId),
  orgIdx: index('nwc_lines_org_idx').on(table.orgId),
  bucketTypeIdx: index('nwc_lines_bucket_type_idx').on(table.bucketType),
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

// Service Department Schemas
export const insertServiceTechnicianSchema = createInsertSchema(serviceTechnicians).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  hourlyRate: z.string().or(z.number()).optional(),
});

export const updateServiceTechnicianSchema = insertServiceTechnicianSchema.partial();

export const insertServicePartSchema = createInsertSchema(serviceParts).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  unitCost: z.string().or(z.number()),
  retailPrice: z.string().or(z.number()),
});

export const updateServicePartSchema = insertServicePartSchema.partial();

export const insertServiceWorkOrderSchema = createInsertSchema(serviceWorkOrders).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  estimatedHours: z.string().or(z.number()).optional(),
  actualHours: z.string().or(z.number()).optional(),
  estimatedCost: z.string().or(z.number()).optional(),
  laborTotal: z.string().or(z.number()).optional(),
  partsTotal: z.string().or(z.number()).optional(),
  taxAmount: z.string().or(z.number()).optional(),
  totalAmount: z.string().or(z.number()).optional(),
});

export const updateServiceWorkOrderSchema = insertServiceWorkOrderSchema.partial();

export const insertServiceLaborEntrySchema = createInsertSchema(serviceLaborEntries).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  hours: z.string().or(z.number()),
  hourlyRate: z.string().or(z.number()),
  totalAmount: z.string().or(z.number()),
});

export const updateServiceLaborEntrySchema = insertServiceLaborEntrySchema.partial();

export const insertServicePartsUsedSchema = createInsertSchema(servicePartsUsed).omit({
  id: true,
  orgId: true,
  createdAt: true,
}).extend({
  unitCost: z.string().or(z.number()),
  unitPrice: z.string().or(z.number()),
  totalAmount: z.string().or(z.number()),
});

// Boat Rentals Schemas
export const insertBoatRentalFleetSchema = createInsertSchema(boatRentalFleet).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  length: z.string().or(z.number()).optional(),
  hourlyRate: z.string().or(z.number()).optional(),
  halfDayRate: z.string().or(z.number()).optional(),
  fullDayRate: z.string().or(z.number()).optional(),
  weeklyRate: z.string().or(z.number()).optional(),
  securityDeposit: z.string().or(z.number()).optional(),
  insuranceValue: z.string().or(z.number()).optional(),
  purchasePrice: z.string().or(z.number()).optional(),
  currentValue: z.string().or(z.number()).optional(),
});

export const updateBoatRentalFleetSchema = insertBoatRentalFleetSchema.partial();

export const insertBoatRentalSchema = createInsertSchema(boatRentals).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  baseRate: z.string().or(z.number()),
  hoursRented: z.string().or(z.number()).optional(),
  fuelCharge: z.string().or(z.number()).optional(),
  damageCharge: z.string().or(z.number()).optional(),
  lateCharge: z.string().or(z.number()).optional(),
  discountAmount: z.string().or(z.number()).optional(),
  taxAmount: z.string().or(z.number()).optional(),
  totalAmount: z.string().or(z.number()),
  depositPaid: z.string().or(z.number()).optional(),
  depositReturned: z.string().or(z.number()).optional(),
  mileageOut: z.string().or(z.number()).optional(),
  mileageIn: z.string().or(z.number()).optional(),
});

export const updateBoatRentalSchema = insertBoatRentalSchema.partial();

// Boat Club Schemas
export const insertBoatClubFleetSchema = createInsertSchema(boatClubFleet).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  length: z.string().or(z.number()).optional(),
  purchasePrice: z.string().or(z.number()).optional(),
  currentValue: z.string().or(z.number()).optional(),
});

export const updateBoatClubFleetSchema = insertBoatClubFleetSchema.partial();

export const insertBoatClubMembershipSchema = createInsertSchema(boatClubMemberships).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  monthlyFee: z.string().or(z.number()),
  setupFee: z.string().or(z.number()).optional(),
  hoursUsedThisMonth: z.string().or(z.number()).optional(),
  additionalHourRate: z.string().or(z.number()).optional(),
});

export const updateBoatClubMembershipSchema = insertBoatClubMembershipSchema.partial();

export const insertBoatClubBookingSchema = createInsertSchema(boatClubBookings).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  hoursBooked: z.string().or(z.number()),
  hoursUsed: z.string().or(z.number()).optional(),
  additionalHoursCharge: z.string().or(z.number()).optional(),
  fuelCharge: z.string().or(z.number()).optional(),
  cleaningCharge: z.string().or(z.number()).optional(),
  damageCharge: z.string().or(z.number()).optional(),
  totalCharges: z.string().or(z.number()).optional(),
});

export const updateBoatClubBookingSchema = insertBoatClubBookingSchema.partial();

// Boat Sales Schemas
export const insertBoatSalesInventorySchema = createInsertSchema(boatSalesInventory).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  length: z.string().or(z.number()).optional(),
  beam: z.string().or(z.number()).optional(),
  draft: z.string().or(z.number()).optional(),
  listPrice: z.string().or(z.number()),
  minPrice: z.string().or(z.number()).optional(),
  cost: z.string().or(z.number()).optional(),
  floorPlanAmount: z.string().or(z.number()).optional(),
  floorPlanRate: z.string().or(z.number()).optional(),
});

export const updateBoatSalesInventorySchema = insertBoatSalesInventorySchema.partial();

export const insertBoatSalesTransactionSchema = createInsertSchema(boatSalesTransactions).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  salePrice: z.string().or(z.number()),
  tradeInAllowance: z.string().or(z.number()).optional(),
  downPayment: z.string().or(z.number()).optional(),
  financedAmount: z.string().or(z.number()).optional(),
  docFee: z.string().or(z.number()).optional(),
  registrationFee: z.string().or(z.number()).optional(),
  extendedWarranty: z.string().or(z.number()).optional(),
  otherFees: z.string().or(z.number()).optional(),
  taxAmount: z.string().or(z.number()).optional(),
  totalAmount: z.string().or(z.number()),
  grossProfit: z.string().or(z.number()).optional(),
  commissionPercent: z.string().or(z.number()).optional(),
  commissionAmount: z.string().or(z.number()).optional(),
  interestRate: z.string().or(z.number()).optional(),
  monthlyPayment: z.string().or(z.number()).optional(),
});

export const updateBoatSalesTransactionSchema = insertBoatSalesTransactionSchema.partial();

export const insertBoatSalesTradeInSchema = createInsertSchema(boatSalesTradeIns).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  length: z.string().or(z.number()).optional(),
  estimatedRetailValue: z.string().or(z.number()).optional(),
  estimatedWholesaleValue: z.string().or(z.number()).optional(),
  offeredAllowance: z.string().or(z.number()).optional(),
  acceptedAllowance: z.string().or(z.number()).optional(),
  payoffAmount: z.string().or(z.number()).optional(),
});

export const updateBoatSalesTradeInSchema = insertBoatSalesTradeInSchema.partial();

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

// Types for Service Department
export type ServiceTechnician = typeof serviceTechnicians.$inferSelect;
export type InsertServiceTechnician = z.infer<typeof insertServiceTechnicianSchema>;
export type UpdateServiceTechnician = z.infer<typeof updateServiceTechnicianSchema>;

export type ServicePart = typeof serviceParts.$inferSelect;
export type InsertServicePart = z.infer<typeof insertServicePartSchema>;
export type UpdateServicePart = z.infer<typeof updateServicePartSchema>;

export type ServiceWorkOrder = typeof serviceWorkOrders.$inferSelect;
export type InsertServiceWorkOrder = z.infer<typeof insertServiceWorkOrderSchema>;
export type UpdateServiceWorkOrder = z.infer<typeof updateServiceWorkOrderSchema>;

export type ServiceLaborEntry = typeof serviceLaborEntries.$inferSelect;
export type InsertServiceLaborEntry = z.infer<typeof insertServiceLaborEntrySchema>;
export type UpdateServiceLaborEntry = z.infer<typeof updateServiceLaborEntrySchema>;

export type ServicePartsUsed = typeof servicePartsUsed.$inferSelect;
export type InsertServicePartsUsed = z.infer<typeof insertServicePartsUsedSchema>;

// Types for Boat Rentals
export type BoatRentalFleet = typeof boatRentalFleet.$inferSelect;
export type InsertBoatRentalFleet = z.infer<typeof insertBoatRentalFleetSchema>;
export type UpdateBoatRentalFleet = z.infer<typeof updateBoatRentalFleetSchema>;

export type BoatRental = typeof boatRentals.$inferSelect;
export type InsertBoatRental = z.infer<typeof insertBoatRentalSchema>;
export type UpdateBoatRental = z.infer<typeof updateBoatRentalSchema>;

// Types for Boat Club
export type BoatClubFleet = typeof boatClubFleet.$inferSelect;
export type InsertBoatClubFleet = z.infer<typeof insertBoatClubFleetSchema>;
export type UpdateBoatClubFleet = z.infer<typeof updateBoatClubFleetSchema>;

export type BoatClubMembership = typeof boatClubMemberships.$inferSelect;
export type InsertBoatClubMembership = z.infer<typeof insertBoatClubMembershipSchema>;
export type UpdateBoatClubMembership = z.infer<typeof updateBoatClubMembershipSchema>;

export type BoatClubBooking = typeof boatClubBookings.$inferSelect;
export type InsertBoatClubBooking = z.infer<typeof insertBoatClubBookingSchema>;
export type UpdateBoatClubBooking = z.infer<typeof updateBoatClubBookingSchema>;

// Types for Boat Sales
export type BoatSalesInventory = typeof boatSalesInventory.$inferSelect;
export type InsertBoatSalesInventory = z.infer<typeof insertBoatSalesInventorySchema>;
export type UpdateBoatSalesInventory = z.infer<typeof updateBoatSalesInventorySchema>;

export type BoatSalesTransaction = typeof boatSalesTransactions.$inferSelect;
export type InsertBoatSalesTransaction = z.infer<typeof insertBoatSalesTransactionSchema>;
export type UpdateBoatSalesTransaction = z.infer<typeof updateBoatSalesTransactionSchema>;

export type BoatSalesTradeIn = typeof boatSalesTradeIns.$inferSelect;
export type InsertBoatSalesTradeIn = z.infer<typeof insertBoatSalesTradeInSchema>;
export type UpdateBoatSalesTradeIn = z.infer<typeof updateBoatSalesTradeInSchema>;

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
// Modeling Region schemas
export const insertModelingRegionSchema = createInsertSchema(modelingRegions).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateModelingRegionSchema = insertModelingRegionSchema.partial();

export type ModelingRegion = typeof modelingRegions.$inferSelect;
export type InsertModelingRegion = z.infer<typeof insertModelingRegionSchema>;
export type UpdateModelingRegion = z.infer<typeof updateModelingRegionSchema>;

// Modeling Project schemas
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

// Transaction Closing Summary schemas
export const insertTransactionClosingSummarySchema = createInsertSchema(transactionClosingSummary).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  purchasePrice: z.string().or(z.number()).optional(),
  totalClosingCosts: z.string().or(z.number()).optional(),
  financingFeeRate: z.string().or(z.number()).optional(),
  financingBaseAmount: z.string().or(z.number()).optional(),
  financingFees: z.string().or(z.number()).optional(),
  workingCapitalMonthlyExpenseBase: z.string().or(z.number()).optional(),
  workingCapitalRequired: z.string().or(z.number()).optional(),
  transitionCostsTotal: z.string().or(z.number()).optional(),
  capexPhase1: z.string().or(z.number()).optional(),
  capexPhase2: z.string().or(z.number()).optional(),
  capexPhase3: z.string().or(z.number()).optional(),
  totalInvestmentCost: z.string().or(z.number()).optional(),
  currentAssetsTotal: z.string().or(z.number()).optional(),
  currentLiabilitiesTotal: z.string().or(z.number()).optional(),
  currentRatio: z.string().or(z.number()).optional(),
  arMinusAp: z.string().or(z.number()).optional(),
  nwcAdjustmentsTotal: z.string().or(z.number()).optional(),
  workingCapitalBalance: z.string().or(z.number()).optional(),
});

export const updateTransactionClosingSummarySchema = insertTransactionClosingSummarySchema.partial();

export type TransactionClosingSummary = typeof transactionClosingSummary.$inferSelect;
export type InsertTransactionClosingSummary = z.infer<typeof insertTransactionClosingSummarySchema>;
export type UpdateTransactionClosingSummary = z.infer<typeof updateTransactionClosingSummarySchema>;

// Closing Cost Lines schemas
export const insertClosingCostLineSchema = createInsertSchema(closingCostLines).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.string().or(z.number()).optional(),
});

export const updateClosingCostLineSchema = insertClosingCostLineSchema.partial();

export type ClosingCostLine = typeof closingCostLines.$inferSelect;
export type InsertClosingCostLine = z.infer<typeof insertClosingCostLineSchema>;
export type UpdateClosingCostLine = z.infer<typeof updateClosingCostLineSchema>;

// Transition Cost Lines schemas
export const insertTransitionCostLineSchema = createInsertSchema(transitionCostLines).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.string().or(z.number()).optional(),
});

export const updateTransitionCostLineSchema = insertTransitionCostLineSchema.partial();

export type TransitionCostLine = typeof transitionCostLines.$inferSelect;
export type InsertTransitionCostLine = z.infer<typeof insertTransitionCostLineSchema>;
export type UpdateTransitionCostLine = z.infer<typeof updateTransitionCostLineSchema>;

// NWC Lines schemas
export const insertNwcLineSchema = createInsertSchema(nwcLines).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.string().or(z.number()).optional(),
});

export const updateNwcLineSchema = insertNwcLineSchema.partial();

export type NwcLine = typeof nwcLines.$inferSelect;
export type InsertNwcLine = z.infer<typeof insertNwcLineSchema>;
export type UpdateNwcLine = z.infer<typeof updateNwcLineSchema>;

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

// Dashboard Module Metrics schemas
export const insertDashboardModuleMetricSchema = createInsertSchema(dashboardModuleMetrics).omit({
  id: true,
  createdAt: true,
});

export const updateDashboardModuleMetricSchema = insertDashboardModuleMetricSchema.partial();

// Dashboard Custom Widgets schemas
export const widgetFiltersSchema = z.object({
  year: z.number().optional(),
  years: z.array(z.number()).optional(),
  state: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  region: z.string().optional(),
  regions: z.array(z.string()).optional(),
  waterType: z.string().optional(),
  profitCenters: z.array(z.string()).optional(),
  status: z.string().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  capacityMin: z.number().optional(),
  capacityMax: z.number().optional(),
}).passthrough();

export const widgetTimeRangeValueSchema = z.object({
  years: z.number().optional(),
  startYear: z.number().optional(),
  endYear: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).passthrough();

export const widgetComparisonPeriodSchema = z.object({
  offset: z.number().optional(),
  unit: z.enum(['year', 'quarter', 'month', 'week', 'day']).optional(),
}).passthrough();

export const widgetDisplaySizeSchema = z.object({
  cols: z.number().min(1).max(4).default(1),
  rows: z.number().min(1).max(4).default(1),
});

export const insertDashboardCustomWidgetSchema = createInsertSchema(dashboardCustomWidgets).omit({
  id: true,
  userId: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  filters: widgetFiltersSchema.optional(),
  timeRangeValue: widgetTimeRangeValueSchema.optional(),
  comparisonPeriod: widgetComparisonPeriodSchema.optional(),
  displaySize: widgetDisplaySizeSchema.optional(),
});

export const updateDashboardCustomWidgetSchema = insertDashboardCustomWidgetSchema.partial();

// Dashboard Saved Layouts schemas
export const widgetPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  cols: z.number(),
  rows: z.number(),
});

export const gridConfigSchema = z.object({
  cols: z.number().default(4),
  gap: z.number().default(16),
  rowHeight: z.union([z.number(), z.literal('auto')]).default('auto'),
});

export const insertDashboardSavedLayoutSchema = createInsertSchema(dashboardSavedLayouts).omit({
  id: true,
  userId: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  widgetOrder: z.array(z.string()).optional(),
  gridConfig: gridConfigSchema.optional(),
  widgetPositions: z.record(z.string(), widgetPositionSchema).optional(),
  enabledModules: z.array(z.string()).optional(),
  moduleOrder: z.array(z.string()).optional(),
});

export const updateDashboardSavedLayoutSchema = insertDashboardSavedLayoutSchema.partial();

// Dashboard Widget Templates schemas
export const insertDashboardWidgetTemplateSchema = createInsertSchema(dashboardWidgetTemplates).omit({
  id: true,
  createdAt: true,
}).extend({
  filters: widgetFiltersSchema.optional(),
  timeRangeValue: widgetTimeRangeValueSchema.optional(),
  displaySize: widgetDisplaySizeSchema.optional(),
  tags: z.array(z.string()).optional(),
});

export const updateDashboardWidgetTemplateSchema = insertDashboardWidgetTemplateSchema.partial();

// User KPI Preferences schemas
export const kpiConfigItemSchema = z.object({
  title: z.string(),
  metricType: z.enum(['total_companies', 'portfolio_companies', 'active_deals', 'new_this_month', 'with_website', 'with_contacts', 'with_properties']),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const insertUserKpiPreferencesSchema = createInsertSchema(userKpiPreferences).omit({
  id: true,
  userId: true,
  orgId: true,
  lastModified: true,
}).extend({
  kpiConfig: z.array(kpiConfigItemSchema),
});

export const updateUserKpiPreferencesSchema = insertUserKpiPreferencesSchema.partial();

// User Pinned Items schemas
export const insertUserPinnedItemSchema = createInsertSchema(userPinnedItems).omit({
  id: true,
  userId: true,
  orgId: true,
  pinnedAt: true,
});

export const updateUserPinnedItemSchema = insertUserPinnedItemSchema.partial();

// User Recent Items schemas
export const insertUserRecentItemSchema = createInsertSchema(userRecentItems).omit({
  id: true,
  userId: true,
  orgId: true,
  accessedAt: true,
});

export const updateUserRecentItemSchema = insertUserRecentItemSchema.partial();

// User Favorites schemas
export const insertUserFavoriteSchema = createInsertSchema(userFavorites).omit({
  id: true,
  userId: true,
  orgId: true,
  favoritedAt: true,
});

export const updateUserFavoriteSchema = insertUserFavoriteSchema.partial();

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

// Types for Dashboard Customization System
export type DashboardModuleMetric = typeof dashboardModuleMetrics.$inferSelect;
export type InsertDashboardModuleMetric = z.infer<typeof insertDashboardModuleMetricSchema>;
export type UpdateDashboardModuleMetric = z.infer<typeof updateDashboardModuleMetricSchema>;

export type DashboardCustomWidget = typeof dashboardCustomWidgets.$inferSelect;
export type InsertDashboardCustomWidget = z.infer<typeof insertDashboardCustomWidgetSchema>;
export type UpdateDashboardCustomWidget = z.infer<typeof updateDashboardCustomWidgetSchema>;

export type DashboardSavedLayout = typeof dashboardSavedLayouts.$inferSelect;
export type InsertDashboardSavedLayout = z.infer<typeof insertDashboardSavedLayoutSchema>;
export type UpdateDashboardSavedLayout = z.infer<typeof updateDashboardSavedLayoutSchema>;

export type DashboardWidgetTemplate = typeof dashboardWidgetTemplates.$inferSelect;
export type InsertDashboardWidgetTemplate = z.infer<typeof insertDashboardWidgetTemplateSchema>;
export type UpdateDashboardWidgetTemplate = z.infer<typeof updateDashboardWidgetTemplateSchema>;

export type WidgetFilters = z.infer<typeof widgetFiltersSchema>;
export type WidgetTimeRangeValue = z.infer<typeof widgetTimeRangeValueSchema>;
export type WidgetComparisonPeriod = z.infer<typeof widgetComparisonPeriodSchema>;
export type WidgetDisplaySize = z.infer<typeof widgetDisplaySizeSchema>;
export type WidgetPosition = z.infer<typeof widgetPositionSchema>;
export type GridConfig = z.infer<typeof gridConfigSchema>;

export type UserKpiPreferences = typeof userKpiPreferences.$inferSelect;
export type InsertUserKpiPreferences = z.infer<typeof insertUserKpiPreferencesSchema>;
export type UpdateUserKpiPreferences = z.infer<typeof updateUserKpiPreferencesSchema>;
export type KpiConfigItem = z.infer<typeof kpiConfigItemSchema>;

// Types for Quick Access (Pins, Recents, Favorites)
export type UserPinnedItem = typeof userPinnedItems.$inferSelect;
export type InsertUserPinnedItem = z.infer<typeof insertUserPinnedItemSchema>;
export type UpdateUserPinnedItem = z.infer<typeof updateUserPinnedItemSchema>;

export type UserRecentItem = typeof userRecentItems.$inferSelect;
export type InsertUserRecentItem = z.infer<typeof insertUserRecentItemSchema>;
export type UpdateUserRecentItem = z.infer<typeof updateUserRecentItemSchema>;

export type UserFavorite = typeof userFavorites.$inferSelect;
export type InsertUserFavorite = z.infer<typeof insertUserFavoriteSchema>;
export type UpdateUserFavorite = z.infer<typeof updateUserFavoriteSchema>;

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
// EXIT STRATEGY SUITE - Integrated with Modeling Projects
// Provides comprehensive exit strategy analysis for marina acquisitions
// ============================================================================

// Enums for Exit Strategy
export const exitScenarioTypeEnum = pgEnum("exit_scenario_type", [
  "cash_sale",
  "exchange_1031",
  "seller_financing",
  "dst_investment",
  "hybrid"
]);

export const waterfallStructureTypeEnum = pgEnum("waterfall_structure_type", [
  "american",
  "european"
]);

export const compoundingTypeEnum = pgEnum("compounding_type", [
  "annual",
  "quarterly",
  "continuous"
]);

export const exitScenarioStatusEnum = pgEnum("exit_scenario_status", [
  "draft",
  "active",
  "archived"
]);

export const filingStatusEnum = pgEnum("filing_status", [
  "single",
  "married",
  "head_of_household"
]);

export const propertyTypeEnum = pgEnum("exit_property_type", [
  "residential",
  "commercial",
  "marina"
]);

// Exit Scenarios - Main exit strategy configuration per modeling project
export const exitScenarios = pgTable('exit_scenarios', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Scenario identification
  name: text('name').notNull(),
  description: text('description'),
  scenarioType: exitScenarioTypeEnum('scenario_type').notNull().default('cash_sale'),
  status: exitScenarioStatusEnum('status').notNull().default('draft'),
  isBaseCase: boolean('is_base_case').default(false),
  
  // Property details (can be synced from modeling project)
  purchasePrice: decimal('purchase_price', { precision: 18, scale: 2 }),
  acquisitionDate: timestamp('acquisition_date'),
  currentBasis: decimal('current_basis', { precision: 18, scale: 2 }),
  landValue: decimal('land_value', { precision: 18, scale: 2 }),
  improvementValue: decimal('improvement_value', { precision: 18, scale: 2 }),
  
  // Exit assumptions
  holdingPeriodYears: integer('holding_period_years').default(5),
  exitDate: timestamp('exit_date'),
  exitCapRate: decimal('exit_cap_rate', { precision: 5, scale: 4 }), // e.g., 0.0725 = 7.25%
  exitNoi: decimal('exit_noi', { precision: 18, scale: 2 }),
  projectedSalePrice: decimal('projected_sale_price', { precision: 18, scale: 2 }),
  
  // Depreciation tracking
  depreciationSchedule: integer('depreciation_schedule').default(39), // Commercial = 39, Residential = 27.5
  annualDepreciation: decimal('annual_depreciation', { precision: 18, scale: 2 }),
  accumulatedDepreciation: decimal('accumulated_depreciation', { precision: 18, scale: 2 }),
  costSegregationBonus: decimal('cost_segregation_bonus', { precision: 18, scale: 2 }).default('0'),
  
  // Closing costs at exit
  brokerCommissionRate: decimal('broker_commission_rate', { precision: 5, scale: 4 }).default('0.04'), // 4%
  sellingClosingCosts: decimal('selling_closing_costs', { precision: 18, scale: 2 }),
  
  // Loan payoff (if applicable)
  outstandingLoanBalance: decimal('outstanding_loan_balance', { precision: 18, scale: 2 }),
  prepaymentPenalty: decimal('prepayment_penalty', { precision: 18, scale: 2 }),
  
  // Calculated results (cached for performance)
  netProceeds: decimal('net_proceeds', { precision: 18, scale: 2 }),
  totalTaxLiability: decimal('total_tax_liability', { precision: 18, scale: 2 }),
  irr: decimal('irr', { precision: 10, scale: 6 }),
  moic: decimal('moic', { precision: 10, scale: 4 }),
  
  // Metadata
  createdBy: varchar('created_by').references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  modelingProjectIdx: index('exit_scenarios_modeling_project_idx').on(table.modelingProjectId),
  orgIdx: index('exit_scenarios_org_idx').on(table.orgId),
  statusIdx: index('exit_scenarios_status_idx').on(table.status),
}));

// Exit Tax Calculations - Detailed tax liability per scenario
export const exitTaxCalculations = pgTable('exit_tax_calculations', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  exitScenarioId: varchar('exit_scenario_id').notNull().references(() => exitScenarios.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Tax parameters
  salePrice: decimal('sale_price', { precision: 18, scale: 2 }).notNull(),
  adjustedBasis: decimal('adjusted_basis', { precision: 18, scale: 2 }).notNull(),
  depreciationTaken: decimal('depreciation_taken', { precision: 18, scale: 2 }).default('0'),
  
  // Filer information
  filingStatus: filingStatusEnum('filing_status').notNull().default('single'),
  adjustedGrossIncome: decimal('adjusted_gross_income', { precision: 18, scale: 2 }).default('0'),
  stateOfResidence: varchar('state_of_residence', { length: 2 }).default('CA'),
  isHighIncome: boolean('is_high_income').default(false),
  
  // Gain components
  totalGain: decimal('total_gain', { precision: 18, scale: 2 }),
  capitalGain: decimal('capital_gain', { precision: 18, scale: 2 }),
  depreciationRecapture: decimal('depreciation_recapture', { precision: 18, scale: 2 }),
  ordinaryIncome: decimal('ordinary_income', { precision: 18, scale: 2 }),
  
  // Tax rates used
  federalCapitalGainsRate: decimal('federal_capital_gains_rate', { precision: 5, scale: 4 }).default('0.15'),
  federalDepreciationRecaptureRate: decimal('federal_depreciation_recapture_rate', { precision: 5, scale: 4 }).default('0.25'),
  niitRate: decimal('niit_rate', { precision: 5, scale: 4 }).default('0.038'),
  stateTaxRate: decimal('state_tax_rate', { precision: 5, scale: 4 }),
  
  // Tax liability breakdown
  federalCapitalGainsTax: decimal('federal_capital_gains_tax', { precision: 18, scale: 2 }),
  federalDepreciationRecaptureTax: decimal('federal_depreciation_recapture_tax', { precision: 18, scale: 2 }),
  netInvestmentIncomeTax: decimal('net_investment_income_tax', { precision: 18, scale: 2 }),
  stateTax: decimal('state_tax', { precision: 18, scale: 2 }),
  totalTaxLiability: decimal('total_tax_liability', { precision: 18, scale: 2 }),
  
  // Effective rates
  effectiveTaxRate: decimal('effective_tax_rate', { precision: 5, scale: 4 }),
  afterTaxProceeds: decimal('after_tax_proceeds', { precision: 18, scale: 2 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  exitScenarioIdx: index('exit_tax_calcs_scenario_idx').on(table.exitScenarioId),
  orgIdx: index('exit_tax_calcs_org_idx').on(table.orgId),
}));

// Exit Seller Financing - Installment sale modeling
export const exitSellerFinancing = pgTable('exit_seller_financing', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  exitScenarioId: varchar('exit_scenario_id').notNull().references(() => exitScenarios.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Sale structure
  salePrice: decimal('sale_price', { precision: 18, scale: 2 }).notNull(),
  downPaymentAmount: decimal('down_payment_amount', { precision: 18, scale: 2 }).notNull(),
  downPaymentPercent: decimal('down_payment_percent', { precision: 5, scale: 4 }),
  financedAmount: decimal('financed_amount', { precision: 18, scale: 2 }).notNull(),
  
  // Loan terms
  interestRate: decimal('interest_rate', { precision: 5, scale: 4 }).notNull(),
  termYears: integer('term_years').notNull(),
  amortizationYears: integer('amortization_years'),
  balloonPaymentYear: integer('balloon_payment_year'),
  
  // Payment details
  monthlyPayment: decimal('monthly_payment', { precision: 18, scale: 2 }),
  annualDebtService: decimal('annual_debt_service', { precision: 18, scale: 2 }),
  totalInterestIncome: decimal('total_interest_income', { precision: 18, scale: 2 }),
  balloonPaymentAmount: decimal('balloon_payment_amount', { precision: 18, scale: 2 }),
  
  // Tax implications
  installmentSaleGrossProfit: decimal('installment_sale_gross_profit', { precision: 18, scale: 2 }),
  installmentSaleGrossProfitRatio: decimal('installment_sale_gross_profit_ratio', { precision: 5, scale: 4 }),
  taxableInterestIncome: decimal('taxable_interest_income', { precision: 18, scale: 2 }),
  deferredGain: decimal('deferred_gain', { precision: 18, scale: 2 }),
  
  // NPV analysis
  discountRate: decimal('discount_rate', { precision: 5, scale: 4 }).default('0.08'),
  netPresentValue: decimal('net_present_value', { precision: 18, scale: 2 }),
  
  // Amortization schedule stored as JSON
  amortizationSchedule: jsonb('amortization_schedule'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  exitScenarioIdx: index('exit_seller_financing_scenario_idx').on(table.exitScenarioId),
  orgIdx: index('exit_seller_financing_org_idx').on(table.orgId),
}));

// Exit Earnouts - Contingent payment structures
export const exitEarnouts = pgTable('exit_earnouts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  exitScenarioId: varchar('exit_scenario_id').notNull().references(() => exitScenarios.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Earnout structure
  name: text('name').notNull(),
  milestoneName: text('milestone_name'),
  paymentYear: integer('payment_year').notNull(),
  
  // Trigger conditions
  triggerMetric: text('trigger_metric'), // e.g., "NOI", "Revenue", "Occupancy"
  triggerThreshold: decimal('trigger_threshold', { precision: 18, scale: 2 }),
  triggerOperator: varchar('trigger_operator', { length: 10 }), // ">", ">=", "<", "<=", "="
  
  // Payment details
  maxPaymentAmount: decimal('max_payment_amount', { precision: 18, scale: 2 }).notNull(),
  minPaymentAmount: decimal('min_payment_amount', { precision: 18, scale: 2 }).default('0'),
  paymentFormula: text('payment_formula'), // Custom formula if applicable
  
  // Probability weighting
  probabilityOfAchievement: decimal('probability_of_achievement', { precision: 5, scale: 4 }).default('0.5'),
  expectedPayment: decimal('expected_payment', { precision: 18, scale: 2 }),
  
  // Tax treatment
  isTaxableAsOrdinaryIncome: boolean('is_taxable_as_ordinary_income').default(true),
  
  // NPV
  discountRate: decimal('discount_rate', { precision: 5, scale: 4 }).default('0.10'),
  presentValue: decimal('present_value', { precision: 18, scale: 2 }),
  
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  exitScenarioIdx: index('exit_earnouts_scenario_idx').on(table.exitScenarioId),
  orgIdx: index('exit_earnouts_org_idx').on(table.orgId),
}));

// Exit 1031 Exchanges - Like-kind exchange planning
export const exit1031Exchanges = pgTable('exit_1031_exchanges', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  exitScenarioId: varchar('exit_scenario_id').notNull().references(() => exitScenarios.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Relinquished property (property being sold)
  relinquishedPropertyValue: decimal('relinquished_property_value', { precision: 18, scale: 2 }).notNull(),
  relinquishedPropertyBasis: decimal('relinquished_property_basis', { precision: 18, scale: 2 }),
  relinquishedMortgage: decimal('relinquished_mortgage', { precision: 18, scale: 2 }),
  
  // Exchange timeline
  saleDate: timestamp('sale_date'),
  identificationDeadline: timestamp('identification_deadline'), // +45 days
  exchangeDeadline: timestamp('exchange_deadline'), // +180 days
  
  // Replacement property targets
  targetReplacementValue: decimal('target_replacement_value', { precision: 18, scale: 2 }),
  targetReplacementMortgage: decimal('target_replacement_mortgage', { precision: 18, scale: 2 }),
  
  // Boot calculation (taxable portion)
  cashBootReceived: decimal('cash_boot_received', { precision: 18, scale: 2 }).default('0'),
  mortgageBootReceived: decimal('mortgage_boot_received', { precision: 18, scale: 2 }).default('0'),
  totalBoot: decimal('total_boot', { precision: 18, scale: 2 }).default('0'),
  bootTaxLiability: decimal('boot_tax_liability', { precision: 18, scale: 2 }).default('0'),
  
  // Deferred gain
  realizedGain: decimal('realized_gain', { precision: 18, scale: 2 }),
  recognizedGain: decimal('recognized_gain', { precision: 18, scale: 2 }),
  deferredGain: decimal('deferred_gain', { precision: 18, scale: 2 }),
  deferredTax: decimal('deferred_tax', { precision: 18, scale: 2 }),
  
  // Exchange percentage
  exchangePercentage: decimal('exchange_percentage', { precision: 5, scale: 4 }).default('1.0'), // 100% exchange
  
  // Qualified Intermediary
  qiCompany: text('qi_company'),
  qiContact: text('qi_contact'),
  qiFees: decimal('qi_fees', { precision: 18, scale: 2 }),
  
  // Identified replacement properties (up to 3)
  identifiedProperties: jsonb('identified_properties'),
  
  // Notes
  notes: text('notes'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  exitScenarioIdx: index('exit_1031_scenario_idx').on(table.exitScenarioId),
  orgIdx: index('exit_1031_org_idx').on(table.orgId),
}));

// Exit DST Analyses - Delaware Statutory Trust modeling
export const exitDstAnalyses = pgTable('exit_dst_analyses', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  exitScenarioId: varchar('exit_scenario_id').notNull().references(() => exitScenarios.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // DST identification
  dstName: text('dst_name').notNull(),
  sponsorName: text('sponsor_name'),
  propertyType: text('property_type'),
  propertyLocation: text('property_location'),
  
  // Investment details
  investmentAmount: decimal('investment_amount', { precision: 18, scale: 2 }).notNull(),
  ownershipPercentage: decimal('ownership_percentage', { precision: 10, scale: 6 }),
  minimumInvestment: decimal('minimum_investment', { precision: 18, scale: 2 }),
  
  // Projected returns
  projectedCashOnCashReturn: decimal('projected_cash_on_cash_return', { precision: 5, scale: 4 }),
  projectedAnnualDistribution: decimal('projected_annual_distribution', { precision: 18, scale: 2 }),
  projectedHoldPeriod: integer('projected_hold_period'), // years
  projectedIrr: decimal('projected_irr', { precision: 5, scale: 4 }),
  
  // Depreciation benefits
  dstDepreciationPassthrough: decimal('dst_depreciation_passthrough', { precision: 18, scale: 2 }),
  annualDepreciationBenefit: decimal('annual_depreciation_benefit', { precision: 18, scale: 2 }),
  
  // Risk factors
  leverageRatio: decimal('leverage_ratio', { precision: 5, scale: 4 }),
  singleTenantRisk: boolean('single_tenant_risk').default(false),
  tenantCreditRating: varchar('tenant_credit_rating', { length: 10 }),
  leaseTermRemaining: integer('lease_term_remaining'), // years
  
  // Fees
  upfrontFees: decimal('upfront_fees', { precision: 18, scale: 2 }),
  ongoingAnnualFees: decimal('ongoing_annual_fees', { precision: 18, scale: 2 }),
  dispositionFees: decimal('disposition_fees', { precision: 18, scale: 2 }),
  
  // Comparison flag
  isSelected: boolean('is_selected').default(false),
  
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  exitScenarioIdx: index('exit_dst_scenario_idx').on(table.exitScenarioId),
  orgIdx: index('exit_dst_org_idx').on(table.orgId),
}));

// Exit Funds - Fund tracking for waterfall distributions
export const exitFunds = pgTable('exit_funds', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Fund identification
  name: text('name').notNull(),
  vintage: integer('vintage').notNull(), // Fund vintage year
  
  // Capital structure
  targetSize: decimal('target_size', { precision: 18, scale: 2 }),
  committedCapital: decimal('committed_capital', { precision: 18, scale: 2 }).default('0'),
  calledCapital: decimal('called_capital', { precision: 18, scale: 2 }).default('0'),
  distributedCapital: decimal('distributed_capital', { precision: 18, scale: 2 }).default('0'),
  
  // Fee structure
  managementFeeRate: decimal('management_fee_rate', { precision: 5, scale: 4 }).default('0.02'),
  carriedInterestRate: decimal('carried_interest_rate', { precision: 5, scale: 4 }).default('0.20'),
  
  // Status
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('exit_funds_org_idx').on(table.orgId),
}));

// Exit Waterfall Structures - Fund distribution modeling
export const exitWaterfallStructures = pgTable('exit_waterfall_structures', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  exitScenarioId: varchar('exit_scenario_id').notNull().references(() => exitScenarios.id, { onDelete: 'cascade' }),
  fundId: varchar('fund_id').references(() => exitFunds.id),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Structure configuration
  name: text('name').notNull(),
  structureType: waterfallStructureTypeEnum('structure_type').notNull().default('american'),
  
  // Capital inputs
  totalProceeds: decimal('total_proceeds', { precision: 18, scale: 2 }).notNull(),
  totalCapitalContributed: decimal('total_capital_contributed', { precision: 18, scale: 2 }).notNull(),
  holdingPeriodYears: decimal('holding_period_years', { precision: 5, scale: 2 }).default('5'),
  
  // Preferred return
  preferredReturn: decimal('preferred_return', { precision: 5, scale: 4 }).default('0.08'),
  preferredReturnCompounding: compoundingTypeEnum('preferred_return_compounding').default('annual'),
  
  // GP catch-up
  catchUpPercentage: decimal('catch_up_percentage', { precision: 5, scale: 4 }).default('1.0'),
  catchUpTarget: decimal('catch_up_target', { precision: 5, scale: 4 }).default('0.20'),
  
  // Carried interest
  carriedInterest: decimal('carried_interest', { precision: 5, scale: 4 }).default('0.20'),
  lpSplit: decimal('lp_split', { precision: 5, scale: 4 }).default('0.80'),
  gpSplit: decimal('gp_split', { precision: 5, scale: 4 }).default('0.20'),
  
  // Custom tiers (for complex structures)
  customTiers: jsonb('custom_tiers'),
  
  // Calculated distributions
  lpTotalDistribution: decimal('lp_total_distribution', { precision: 18, scale: 2 }),
  gpTotalDistribution: decimal('gp_total_distribution', { precision: 18, scale: 2 }),
  preferredReturnPaid: decimal('preferred_return_paid', { precision: 18, scale: 2 }),
  catchUpPaid: decimal('catch_up_paid', { precision: 18, scale: 2 }),
  carriedInterestPaid: decimal('carried_interest_paid', { precision: 18, scale: 2 }),
  
  // Metrics
  lpMoic: decimal('lp_moic', { precision: 10, scale: 4 }),
  gpMoic: decimal('gp_moic', { precision: 10, scale: 4 }),
  lpIrr: decimal('lp_irr', { precision: 10, scale: 6 }),
  gpIrr: decimal('gp_irr', { precision: 10, scale: 6 }),
  
  // GP clawback (for European waterfalls)
  gpClawbackAmount: decimal('gp_clawback_amount', { precision: 18, scale: 2 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  exitScenarioIdx: index('exit_waterfall_scenario_idx').on(table.exitScenarioId),
  fundIdx: index('exit_waterfall_fund_idx').on(table.fundId),
  orgIdx: index('exit_waterfall_org_idx').on(table.orgId),
}));

// Exit Investors - LP/GP tracking for waterfall
export const exitInvestors = pgTable('exit_investors', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  fundId: varchar('fund_id').notNull().references(() => exitFunds.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  crmContactId: varchar('crm_contact_id').references(() => crmContacts.id),
  crmCompanyId: varchar('crm_company_id').references(() => crmCompanies.id),
  
  // Investor details
  name: text('name').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('lp'), // 'lp', 'gp', 'co-invest'
  email: varchar('email'),
  
  // Commitment
  commitmentAmount: decimal('commitment_amount', { precision: 18, scale: 2 }),
  calledAmount: decimal('called_amount', { precision: 18, scale: 2 }).default('0'),
  distributedAmount: decimal('distributed_amount', { precision: 18, scale: 2 }).default('0'),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  fundIdx: index('exit_investors_fund_idx').on(table.fundId),
  orgIdx: index('exit_investors_org_idx').on(table.orgId),
}));

// Exit Cash Flow Projections - For IRR and sensitivity analysis
export const exitCashFlows = pgTable('exit_cash_flows', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  exitScenarioId: varchar('exit_scenario_id').notNull().references(() => exitScenarios.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  period: integer('period').notNull(), // 0 = acquisition, 1+ = operating years
  periodDate: timestamp('period_date'),
  
  // Cash flow components
  cashFlowType: varchar('cash_flow_type', { length: 20 }).notNull(), // 'investment', 'distribution', 'sale'
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  description: text('description'),
  
  // Cumulative tracking
  cumulativeInvested: decimal('cumulative_invested', { precision: 18, scale: 2 }),
  cumulativeDistributed: decimal('cumulative_distributed', { precision: 18, scale: 2 }),
  
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  exitScenarioIdx: index('exit_cash_flows_scenario_idx').on(table.exitScenarioId),
  orgIdx: index('exit_cash_flows_org_idx').on(table.orgId),
}));

// Exit Activities - Activity logging for exit module
export const exitActivities = pgTable('exit_activities', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  exitScenarioId: varchar('exit_scenario_id').references(() => exitScenarios.id, { onDelete: 'cascade' }),
  modelingProjectId: varchar('modeling_project_id').references(() => modelingProjects.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').references(() => users.id),
  
  activityType: varchar('activity_type', { length: 50 }).notNull(), // 'scenario_created', 'tax_calculated', 'waterfall_run', etc.
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  exitScenarioIdx: index('exit_activities_scenario_idx').on(table.exitScenarioId),
  modelingProjectIdx: index('exit_activities_project_idx').on(table.modelingProjectId),
  orgIdx: index('exit_activities_org_idx').on(table.orgId),
}));

// ============================================================================
// EXIT STRATEGY - Insert Schemas and Types
// ============================================================================

export const insertExitScenarioSchema = createInsertSchema(exitScenarios).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
}).extend({
  purchasePrice: z.string().or(z.number()).optional(),
  currentBasis: z.string().or(z.number()).optional(),
  landValue: z.string().or(z.number()).optional(),
  improvementValue: z.string().or(z.number()).optional(),
  exitCapRate: z.string().or(z.number()).optional(),
  exitNoi: z.string().or(z.number()).optional(),
  projectedSalePrice: z.string().or(z.number()).optional(),
  annualDepreciation: z.string().or(z.number()).optional(),
  accumulatedDepreciation: z.string().or(z.number()).optional(),
  costSegregationBonus: z.string().or(z.number()).optional(),
  brokerCommissionRate: z.string().or(z.number()).optional(),
  sellingClosingCosts: z.string().or(z.number()).optional(),
  outstandingLoanBalance: z.string().or(z.number()).optional(),
  prepaymentPenalty: z.string().or(z.number()).optional(),
});

export const updateExitScenarioSchema = insertExitScenarioSchema.partial();

export const insertExitTaxCalculationSchema = createInsertSchema(exitTaxCalculations).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  salePrice: z.string().or(z.number()),
  adjustedBasis: z.string().or(z.number()),
  depreciationTaken: z.string().or(z.number()).optional(),
  adjustedGrossIncome: z.string().or(z.number()).optional(),
});

export const updateExitTaxCalculationSchema = insertExitTaxCalculationSchema.partial();

export const insertExitSellerFinancingSchema = createInsertSchema(exitSellerFinancing).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  salePrice: z.string().or(z.number()),
  downPaymentAmount: z.string().or(z.number()),
  financedAmount: z.string().or(z.number()),
  interestRate: z.string().or(z.number()),
});

export const updateExitSellerFinancingSchema = insertExitSellerFinancingSchema.partial();

export const insertExitEarnoutSchema = createInsertSchema(exitEarnouts).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  maxPaymentAmount: z.string().or(z.number()),
  minPaymentAmount: z.string().or(z.number()).optional(),
  triggerThreshold: z.string().or(z.number()).optional(),
  probabilityOfAchievement: z.string().or(z.number()).optional(),
});

export const updateExitEarnoutSchema = insertExitEarnoutSchema.partial();

export const insertExit1031ExchangeSchema = createInsertSchema(exit1031Exchanges).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  relinquishedPropertyValue: z.string().or(z.number()),
  relinquishedPropertyBasis: z.string().or(z.number()).optional(),
  relinquishedMortgage: z.string().or(z.number()).optional(),
  targetReplacementValue: z.string().or(z.number()).optional(),
  targetReplacementMortgage: z.string().or(z.number()).optional(),
});

export const updateExit1031ExchangeSchema = insertExit1031ExchangeSchema.partial();

export const insertExitDstAnalysisSchema = createInsertSchema(exitDstAnalyses).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  investmentAmount: z.string().or(z.number()),
  projectedCashOnCashReturn: z.string().or(z.number()).optional(),
  projectedAnnualDistribution: z.string().or(z.number()).optional(),
  projectedIrr: z.string().or(z.number()).optional(),
});

export const updateExitDstAnalysisSchema = insertExitDstAnalysisSchema.partial();

export const insertExitFundSchema = createInsertSchema(exitFunds).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  targetSize: z.string().or(z.number()).optional(),
  committedCapital: z.string().or(z.number()).optional(),
  managementFeeRate: z.string().or(z.number()).optional(),
  carriedInterestRate: z.string().or(z.number()).optional(),
});

export const updateExitFundSchema = insertExitFundSchema.partial();

export const insertExitWaterfallStructureSchema = createInsertSchema(exitWaterfallStructures).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  totalProceeds: z.string().or(z.number()),
  totalCapitalContributed: z.string().or(z.number()),
  preferredReturn: z.string().or(z.number()).optional(),
  catchUpPercentage: z.string().or(z.number()).optional(),
  carriedInterest: z.string().or(z.number()).optional(),
});

export const updateExitWaterfallStructureSchema = insertExitWaterfallStructureSchema.partial();

export const insertExitInvestorSchema = createInsertSchema(exitInvestors).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  commitmentAmount: z.string().or(z.number()).optional(),
});

export const updateExitInvestorSchema = insertExitInvestorSchema.partial();

export const insertExitCashFlowSchema = createInsertSchema(exitCashFlows).omit({
  id: true,
  orgId: true,
  createdAt: true,
}).extend({
  amount: z.string().or(z.number()),
});

export const insertExitActivitySchema = createInsertSchema(exitActivities).omit({
  id: true,
  orgId: true,
  createdAt: true,
});

// Type exports
export type ExitScenario = typeof exitScenarios.$inferSelect;
export type InsertExitScenario = z.infer<typeof insertExitScenarioSchema>;
export type UpdateExitScenario = z.infer<typeof updateExitScenarioSchema>;

export type ExitTaxCalculation = typeof exitTaxCalculations.$inferSelect;
export type InsertExitTaxCalculation = z.infer<typeof insertExitTaxCalculationSchema>;
export type UpdateExitTaxCalculation = z.infer<typeof updateExitTaxCalculationSchema>;

export type ExitSellerFinancing = typeof exitSellerFinancing.$inferSelect;
export type InsertExitSellerFinancing = z.infer<typeof insertExitSellerFinancingSchema>;
export type UpdateExitSellerFinancing = z.infer<typeof updateExitSellerFinancingSchema>;

export type ExitEarnout = typeof exitEarnouts.$inferSelect;
export type InsertExitEarnout = z.infer<typeof insertExitEarnoutSchema>;
export type UpdateExitEarnout = z.infer<typeof updateExitEarnoutSchema>;

export type Exit1031Exchange = typeof exit1031Exchanges.$inferSelect;
export type InsertExit1031Exchange = z.infer<typeof insertExit1031ExchangeSchema>;
export type UpdateExit1031Exchange = z.infer<typeof updateExit1031ExchangeSchema>;

export type ExitDstAnalysis = typeof exitDstAnalyses.$inferSelect;
export type InsertExitDstAnalysis = z.infer<typeof insertExitDstAnalysisSchema>;
export type UpdateExitDstAnalysis = z.infer<typeof updateExitDstAnalysisSchema>;

export type ExitFund = typeof exitFunds.$inferSelect;
export type InsertExitFund = z.infer<typeof insertExitFundSchema>;
export type UpdateExitFund = z.infer<typeof updateExitFundSchema>;

export type ExitWaterfallStructure = typeof exitWaterfallStructures.$inferSelect;
export type InsertExitWaterfallStructure = z.infer<typeof insertExitWaterfallStructureSchema>;
export type UpdateExitWaterfallStructure = z.infer<typeof updateExitWaterfallStructureSchema>;

export type ExitInvestor = typeof exitInvestors.$inferSelect;
export type InsertExitInvestor = z.infer<typeof insertExitInvestorSchema>;
export type UpdateExitInvestor = z.infer<typeof updateExitInvestorSchema>;

export type ExitCashFlow = typeof exitCashFlows.$inferSelect;
export type InsertExitCashFlow = z.infer<typeof insertExitCashFlowSchema>;

export type ExitActivity = typeof exitActivities.$inferSelect;
export type InsertExitActivity = z.infer<typeof insertExitActivitySchema>;

// ============================================================================
// CAPITAL STACK & INSTITUTIONAL UNDERWRITING
// Comprehensive capital structure modeling for PE/institutional acquisitions
// Includes debt tranches, equity layers, waterfall distributions, and IC workflows
// ============================================================================

// Enums for Capital Stack
export const debtTrancheTypeEnum = pgEnum("debt_tranche_type", ["senior", "mezzanine", "bridge", "construction", "sba", "cmbs", "credit_union", "other"]);
export const equityLayerTypeEnum = pgEnum("equity_layer_type", ["common", "preferred", "promote", "co_invest"]);
export const capitalStackStatusEnum = pgEnum("capital_stack_status", ["draft", "active", "closed", "archived"]);
export const icMemoStatusEnum = pgEnum("ic_memo_status", ["draft", "pending_review", "under_review", "approved", "rejected", "revision_requested"]);
export const icVoteTypeEnum = pgEnum("ic_vote_type", ["approve", "reject", "abstain", "conditional_approve"]);
export const varianceAlertSeverityEnum = pgEnum("variance_alert_severity", ["info", "warning", "critical"]);
export const covenantTypeEnum = pgEnum("covenant_type", ["dscr", "ltv", "debt_yield", "occupancy", "noi", "capex_reserve", "custom"]);
export const covenantStatusEnum = pgEnum("covenant_status", ["in_compliance", "watch", "breach", "waived"]);
export const exitReadinessStatusEnum = pgEnum("exit_readiness_status", ["not_ready", "preparing", "market_ready", "actively_marketing", "under_loi"]);

// Capital Stack - Master configuration for a deal's capital structure
export const capitalStacks = pgTable('capital_stacks', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  name: text('name').notNull(),
  description: text('description'),
  status: capitalStackStatusEnum('status').notNull().default('draft'),
  
  // Total deal metrics
  purchasePrice: decimal('purchase_price', { precision: 18, scale: 2 }).notNull(),
  closingCosts: decimal('closing_costs', { precision: 18, scale: 2 }).default('0'),
  capexReserves: decimal('capex_reserves', { precision: 18, scale: 2 }).default('0'),
  workingCapital: decimal('working_capital', { precision: 18, scale: 2 }).default('0'),
  totalCapitalization: decimal('total_capitalization', { precision: 18, scale: 2 }).notNull(),
  
  // Calculated metrics (denormalized for performance)
  totalDebt: decimal('total_debt', { precision: 18, scale: 2 }).default('0'),
  totalEquity: decimal('total_equity', { precision: 18, scale: 2 }).default('0'),
  blendedDebtRate: decimal('blended_debt_rate', { precision: 8, scale: 4 }),
  ltv: decimal('ltv', { precision: 8, scale: 4 }),
  debtYield: decimal('debt_yield', { precision: 8, scale: 4 }),
  
  // Assumptions
  holdPeriodYears: integer('hold_period_years').default(5),
  exitCapRate: decimal('exit_cap_rate', { precision: 8, scale: 4 }),
  noiGrowthRate: decimal('noi_growth_rate', { precision: 8, scale: 4 }).default('0.02'),
  
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('capital_stacks_org_idx').on(table.orgId),
  projectIdx: index('capital_stacks_project_idx').on(table.modelingProjectId),
  statusIdx: index('capital_stacks_status_idx').on(table.status),
}));

// Debt Tranches - Individual debt layers in the capital stack
export const debtTranches = pgTable('debt_tranches', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  capitalStackId: varchar('capital_stack_id').notNull().references(() => capitalStacks.id, { onDelete: 'cascade' }),
  
  name: text('name').notNull(),
  trancheType: debtTrancheTypeEnum('tranche_type').notNull(),
  lenderName: text('lender_name'),
  
  // Loan terms
  principal: decimal('principal', { precision: 18, scale: 2 }).notNull(),
  interestRate: decimal('interest_rate', { precision: 8, scale: 4 }).notNull(),
  spreadBps: integer('spread_bps').default(0), // Spread over index
  indexRate: text('index_rate'), // e.g., "SOFR", "Prime"
  floorRate: decimal('floor_rate', { precision: 8, scale: 4 }),
  
  // Structure
  amortizationYears: integer('amortization_years'),
  termYears: integer('term_years').notNull(),
  interestOnlyMonths: integer('interest_only_months').default(0),
  
  // Fees
  originationFeePct: decimal('origination_fee_pct', { precision: 8, scale: 4 }).default('0.01'),
  exitFeePct: decimal('exit_fee_pct', { precision: 8, scale: 4 }).default('0'),
  prepaymentPenalty: text('prepayment_penalty'), // Description of prepayment terms
  
  // Covenants
  minDscr: decimal('min_dscr', { precision: 8, scale: 4 }),
  maxLtv: decimal('max_ltv', { precision: 8, scale: 4 }),
  minDebtYield: decimal('min_debt_yield', { precision: 8, scale: 4 }),
  
  // Priority
  priority: integer('priority').notNull().default(1), // 1 = most senior
  
  // Calculated fields
  annualDebtService: decimal('annual_debt_service', { precision: 18, scale: 2 }),
  monthlyPayment: decimal('monthly_payment', { precision: 18, scale: 2 }),
  
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('debt_tranches_org_idx').on(table.orgId),
  capitalStackIdx: index('debt_tranches_capital_stack_idx').on(table.capitalStackId),
  typeIdx: index('debt_tranches_type_idx').on(table.trancheType),
}));

// Equity Layers - GP/LP equity structure with promote/waterfall tiers
export const equityLayers = pgTable('equity_layers', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  capitalStackId: varchar('capital_stack_id').notNull().references(() => capitalStacks.id, { onDelete: 'cascade' }),
  
  name: text('name').notNull(),
  layerType: equityLayerTypeEnum('layer_type').notNull(),
  
  // Contribution
  commitmentAmount: decimal('commitment_amount', { precision: 18, scale: 2 }).notNull(),
  fundedAmount: decimal('funded_amount', { precision: 18, scale: 2 }).default('0'),
  ownershipPct: decimal('ownership_pct', { precision: 8, scale: 4 }).notNull(),
  
  // Returns
  preferredReturn: decimal('preferred_return', { precision: 8, scale: 4 }), // Annual pref rate
  preferredReturnType: text('preferred_return_type'), // 'cumulative', 'non_cumulative', 'compounding'
  isParticipating: boolean('is_participating').default(true), // Participates after pref
  
  // Waterfall position
  waterfallPriority: integer('waterfall_priority').notNull().default(1),
  catchUpPct: decimal('catch_up_pct', { precision: 8, scale: 4 }), // GP catch-up percentage
  
  // Promote structure (for GP layers)
  promoteTiers: jsonb('promote_tiers').$type<{
    irrHurdle: number;
    gpSplit: number;
    lpSplit: number;
  }[]>(),
  
  // Investor info
  investorName: text('investor_name'),
  investorType: text('investor_type'), // 'gp', 'lp', 'co_invest', 'fundOfFunds'
  
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('equity_layers_org_idx').on(table.orgId),
  capitalStackIdx: index('equity_layers_capital_stack_idx').on(table.capitalStackId),
  typeIdx: index('equity_layers_type_idx').on(table.layerType),
}));

// Capital Stack Projections - Year-by-year pro forma tied to capital structure
export const capitalStackProjections = pgTable('capital_stack_projections', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  capitalStackId: varchar('capital_stack_id').notNull().references(() => capitalStacks.id, { onDelete: 'cascade' }),
  
  year: integer('year').notNull(), // 0 = acquisition, 1+ = operating years
  
  // Operating metrics
  grossRevenue: decimal('gross_revenue', { precision: 18, scale: 2 }),
  operatingExpenses: decimal('operating_expenses', { precision: 18, scale: 2 }),
  noi: decimal('noi', { precision: 18, scale: 2 }),
  capex: decimal('capex', { precision: 18, scale: 2 }).default('0'),
  ncf: decimal('ncf', { precision: 18, scale: 2 }), // Net cash flow after capex
  
  // Debt service
  totalDebtService: decimal('total_debt_service', { precision: 18, scale: 2 }),
  principalPaydown: decimal('principal_paydown', { precision: 18, scale: 2 }),
  interestExpense: decimal('interest_expense', { precision: 18, scale: 2 }),
  
  // Cash available
  cashFlowBeforeDebt: decimal('cash_flow_before_debt', { precision: 18, scale: 2 }),
  cashFlowAfterDebt: decimal('cash_flow_after_debt', { precision: 18, scale: 2 }),
  
  // Distributions
  lpDistribution: decimal('lp_distribution', { precision: 18, scale: 2 }),
  gpDistribution: decimal('gp_distribution', { precision: 18, scale: 2 }),
  totalDistribution: decimal('total_distribution', { precision: 18, scale: 2 }),
  
  // Coverage ratios
  dscr: decimal('dscr', { precision: 8, scale: 4 }),
  debtYield: decimal('debt_yield', { precision: 8, scale: 4 }),
  
  // Valuations (for exit year)
  exitValue: decimal('exit_value', { precision: 18, scale: 2 }),
  loanPayoff: decimal('loan_payoff', { precision: 18, scale: 2 }),
  netSaleProceeds: decimal('net_sale_proceeds', { precision: 18, scale: 2 }),
  
  // Returns
  cumulativeCashFlow: decimal('cumulative_cash_flow', { precision: 18, scale: 2 }),
  equityMultiple: decimal('equity_multiple', { precision: 8, scale: 4 }),
  irr: decimal('irr', { precision: 8, scale: 4 }),
  cashOnCash: decimal('cash_on_cash', { precision: 8, scale: 4 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('capital_stack_projections_org_idx').on(table.orgId),
  capitalStackIdx: index('capital_stack_projections_capital_stack_idx').on(table.capitalStackId),
  yearIdx: index('capital_stack_projections_year_idx').on(table.year),
}));

// ============================================================================
// INVESTMENT COMMITTEE (IC) WORKSPACE
// Approval workflows, memos, voting, and audit trails for institutional deals
// ============================================================================

// IC Committee Members - Who can vote on deals
export const icCommitteeMembers = pgTable('ic_committee_members', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  
  role: text('role').notNull(), // 'chair', 'voting_member', 'observer', 'advisor'
  title: text('title'), // e.g., "Managing Partner", "CIO"
  votingWeight: decimal('voting_weight', { precision: 5, scale: 2 }).default('1.0'),
  isRequired: boolean('is_required').default(false), // Must vote for quorum
  
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('ic_committee_members_org_idx').on(table.orgId),
  userIdx: index('ic_committee_members_user_idx').on(table.userId),
  activeIdx: index('ic_committee_members_active_idx').on(table.isActive),
}));

// IC Memos - Investment committee memoranda for deals
export const icMemos = pgTable('ic_memos', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  capitalStackId: varchar('capital_stack_id').references(() => capitalStacks.id),
  
  // Memo info
  title: text('title').notNull(),
  memoNumber: text('memo_number'), // Auto-generated IC-2024-001 format
  version: integer('version').notNull().default(1),
  status: icMemoStatusEnum('status').notNull().default('draft'),
  
  // Content sections (structured for PDF generation)
  executiveSummary: text('executive_summary'),
  investmentThesis: text('investment_thesis'),
  marketOverview: text('market_overview'),
  propertyDescription: text('property_description'),
  financialSummary: jsonb('financial_summary').$type<{
    purchasePrice: number;
    capRate: number;
    noi: number;
    pricePerSlip: number;
    targetIrr: number;
    targetEquityMultiple: number;
  }>(),
  
  // Auto-populated sections
  rentRollSummary: jsonb('rent_roll_summary').$type<{
    totalUnits: number;
    occupancyRate: number;
    monthlyRevenue: number;
    averageRent: number;
  }>(),
  dueDiligenceStatus: jsonb('due_diligence_status').$type<{
    totalTasks: number;
    completedTasks: number;
    criticalIssues: string[];
  }>(),
  
  riskFactors: text('risk_factors').array(),
  mitigationStrategies: text('mitigation_strategies'),
  recommendation: text('recommendation'), // 'proceed', 'pass', 'conditional'
  conditions: text('conditions').array(), // Conditions for approval
  
  // Voting requirements
  quorumRequired: integer('quorum_required').default(3),
  approvalsRequired: integer('approvals_required').default(2),
  
  // Approval tracking
  submittedAt: timestamp('submitted_at'),
  submittedBy: varchar('submitted_by').references(() => users.id),
  reviewDeadline: timestamp('review_deadline'),
  approvedAt: timestamp('approved_at'),
  rejectedAt: timestamp('rejected_at'),
  
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('ic_memos_org_idx').on(table.orgId),
  projectIdx: index('ic_memos_project_idx').on(table.modelingProjectId),
  statusIdx: index('ic_memos_status_idx').on(table.status),
  submittedIdx: index('ic_memos_submitted_idx').on(table.submittedAt),
}));

// IC Votes - Individual votes on memos
export const icVotes = pgTable('ic_votes', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  memoId: varchar('memo_id').notNull().references(() => icMemos.id, { onDelete: 'cascade' }),
  memberId: varchar('member_id').notNull().references(() => icCommitteeMembers.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  
  vote: icVoteTypeEnum('vote').notNull(),
  comments: text('comments'),
  conditions: text('conditions').array(), // For conditional approvals
  
  votedAt: timestamp('voted_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('ic_votes_org_idx').on(table.orgId),
  memoIdx: index('ic_votes_memo_idx').on(table.memoId),
  memberIdx: index('ic_votes_member_idx').on(table.memberId),
  uniqueVote: unique('ic_votes_memo_member').on(table.memoId, table.memberId),
}));

// IC Comments - Discussion threads on memos
export const icComments = pgTable('ic_comments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  memoId: varchar('memo_id').notNull().references(() => icMemos.id, { onDelete: 'cascade' }),
  parentId: varchar('parent_id'), // For threaded replies
  
  userId: varchar('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  
  // Mentions and references
  mentions: text('mentions').array(), // User IDs mentioned
  section: text('section'), // Which memo section this relates to
  
  isResolved: boolean('is_resolved').default(false),
  resolvedBy: varchar('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('ic_comments_org_idx').on(table.orgId),
  memoIdx: index('ic_comments_memo_idx').on(table.memoId),
  parentIdx: index('ic_comments_parent_idx').on(table.parentId),
  resolvedIdx: index('ic_comments_resolved_idx').on(table.isResolved),
}));

// ============================================================================
// MODEL VS ACTUAL VARIANCE TRACKING
// Track performance against underwriting assumptions with alerts
// ============================================================================

// Underwriting Assumptions - Baseline assumptions to track against
export const underwritingAssumptions = pgTable('underwriting_assumptions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  capitalStackId: varchar('capital_stack_id').references(() => capitalStacks.id),
  
  // Assumption period
  year: integer('year').notNull(),
  month: integer('month'), // Optional for monthly tracking
  period: text('period'), // 'annual', 'quarterly', 'monthly'
  
  // Revenue assumptions
  grossPotentialRevenue: decimal('gross_potential_revenue', { precision: 18, scale: 2 }),
  occupancyRate: decimal('occupancy_rate', { precision: 8, scale: 4 }),
  effectiveGrossRevenue: decimal('effective_gross_revenue', { precision: 18, scale: 2 }),
  
  // Expense assumptions
  operatingExpenses: decimal('operating_expenses', { precision: 18, scale: 2 }),
  expenseRatio: decimal('expense_ratio', { precision: 8, scale: 4 }),
  
  // NOI and below
  noi: decimal('noi', { precision: 18, scale: 2 }),
  capex: decimal('capex', { precision: 18, scale: 2 }),
  debtService: decimal('debt_service', { precision: 18, scale: 2 }),
  cashFlow: decimal('cash_flow', { precision: 18, scale: 2 }),
  
  // Segment breakdown
  slipRevenue: decimal('slip_revenue', { precision: 18, scale: 2 }),
  fuelRevenue: decimal('fuel_revenue', { precision: 18, scale: 2 }),
  shipStoreRevenue: decimal('ship_store_revenue', { precision: 18, scale: 2 }),
  otherRevenue: decimal('other_revenue', { precision: 18, scale: 2 }),
  
  // Lock status
  isLocked: boolean('is_locked').default(false),
  lockedAt: timestamp('locked_at'),
  lockedBy: varchar('locked_by').references(() => users.id),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('underwriting_assumptions_org_idx').on(table.orgId),
  projectIdx: index('underwriting_assumptions_project_idx').on(table.modelingProjectId),
  yearIdx: index('underwriting_assumptions_year_idx').on(table.year),
}));

// Actual Performance - Recorded actuals to compare against assumptions
export const actualPerformance = pgTable('actual_performance', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  assumptionId: varchar('assumption_id').references(() => underwritingAssumptions.id),
  
  // Period
  year: integer('year').notNull(),
  month: integer('month'),
  period: text('period'),
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  
  // Revenue actuals
  grossPotentialRevenue: decimal('gross_potential_revenue', { precision: 18, scale: 2 }),
  occupancyRate: decimal('occupancy_rate', { precision: 8, scale: 4 }),
  effectiveGrossRevenue: decimal('effective_gross_revenue', { precision: 18, scale: 2 }),
  
  // Expense actuals
  operatingExpenses: decimal('operating_expenses', { precision: 18, scale: 2 }),
  expenseRatio: decimal('expense_ratio', { precision: 8, scale: 4 }),
  
  // NOI and below
  noi: decimal('noi', { precision: 18, scale: 2 }),
  capex: decimal('capex', { precision: 18, scale: 2 }),
  debtService: decimal('debt_service', { precision: 18, scale: 2 }),
  cashFlow: decimal('cash_flow', { precision: 18, scale: 2 }),
  
  // Segment breakdown
  slipRevenue: decimal('slip_revenue', { precision: 18, scale: 2 }),
  fuelRevenue: decimal('fuel_revenue', { precision: 18, scale: 2 }),
  shipStoreRevenue: decimal('ship_store_revenue', { precision: 18, scale: 2 }),
  otherRevenue: decimal('other_revenue', { precision: 18, scale: 2 }),
  
  // Source tracking
  dataSource: text('data_source'), // 'manual', 'rent_roll_sync', 'fuel_sync', 'ship_store_sync'
  syncedAt: timestamp('synced_at'),
  
  notes: text('notes'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('actual_performance_org_idx').on(table.orgId),
  projectIdx: index('actual_performance_project_idx').on(table.modelingProjectId),
  yearIdx: index('actual_performance_year_idx').on(table.year),
  assumptionIdx: index('actual_performance_assumption_idx').on(table.assumptionId),
}));

// Variance Alerts - Threshold-based alerts when actuals deviate from assumptions
export const varianceAlerts = pgTable('variance_alerts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  actualPerformanceId: varchar('actual_performance_id').references(() => actualPerformance.id),
  
  metric: text('metric').notNull(), // 'occupancy', 'noi', 'revenue', etc.
  assumedValue: decimal('assumed_value', { precision: 18, scale: 2 }),
  actualValue: decimal('actual_value', { precision: 18, scale: 2 }),
  variancePct: decimal('variance_pct', { precision: 8, scale: 4 }),
  varianceAmount: decimal('variance_amount', { precision: 18, scale: 2 }),
  
  severity: varianceAlertSeverityEnum('severity').notNull(),
  thresholdPct: decimal('threshold_pct', { precision: 8, scale: 4 }), // Threshold that triggered
  
  message: text('message').notNull(),
  recommendation: text('recommendation'),
  
  // Resolution
  isResolved: boolean('is_resolved').default(false),
  resolvedBy: varchar('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  resolutionNotes: text('resolution_notes'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('variance_alerts_org_idx').on(table.orgId),
  projectIdx: index('variance_alerts_project_idx').on(table.modelingProjectId),
  severityIdx: index('variance_alerts_severity_idx').on(table.severity),
  resolvedIdx: index('variance_alerts_resolved_idx').on(table.isResolved),
}));

// ============================================================================
// PORTFOLIO RISK DASHBOARD
// Aggregate portfolio metrics, covenant tracking, and risk analysis
// ============================================================================

// Portfolio Definitions - Group projects into portfolios
export const portfolios = pgTable('portfolios', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  name: text('name').notNull(),
  description: text('description'),
  fundName: text('fund_name'), // Associated fund
  vintage: integer('vintage'), // Investment year
  
  // Portfolio targets
  targetIrr: decimal('target_irr', { precision: 8, scale: 4 }),
  targetEquityMultiple: decimal('target_equity_multiple', { precision: 8, scale: 4 }),
  targetHoldPeriod: integer('target_hold_period'),
  
  // Aggregate metrics (denormalized, updated via triggers/sync)
  totalAssets: integer('total_assets').default(0),
  totalInvested: decimal('total_invested', { precision: 18, scale: 2 }).default('0'),
  currentValue: decimal('current_value', { precision: 18, scale: 2 }).default('0'),
  totalNoi: decimal('total_noi', { precision: 18, scale: 2 }).default('0'),
  weightedCapRate: decimal('weighted_cap_rate', { precision: 8, scale: 4 }),
  portfolioIrr: decimal('portfolio_irr', { precision: 8, scale: 4 }),
  
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('portfolios_org_idx').on(table.orgId),
  vintageIdx: index('portfolios_vintage_idx').on(table.vintage),
}));

// Portfolio Assets - Link projects to portfolios
export const portfolioAssets = pgTable('portfolio_assets', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  portfolioId: varchar('portfolio_id').notNull().references(() => portfolios.id, { onDelete: 'cascade' }),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id),
  
  // Acquisition info
  acquisitionDate: date('acquisition_date'),
  acquisitionPrice: decimal('acquisition_price', { precision: 18, scale: 2 }),
  equityInvested: decimal('equity_invested', { precision: 18, scale: 2 }),
  
  // Current valuation
  currentValue: decimal('current_value', { precision: 18, scale: 2 }),
  currentNoi: decimal('current_noi', { precision: 18, scale: 2 }),
  impliedCapRate: decimal('implied_cap_rate', { precision: 8, scale: 4 }),
  
  // Location for geographic analysis
  state: text('state'),
  region: text('region'),
  market: text('market'),
  
  // Asset-level metrics
  occupancyRate: decimal('occupancy_rate', { precision: 8, scale: 4 }),
  debtBalance: decimal('debt_balance', { precision: 18, scale: 2 }),
  ltv: decimal('ltv', { precision: 8, scale: 4 }),
  dscr: decimal('dscr', { precision: 8, scale: 4 }),
  
  // Status
  status: text('status').default('active'), // 'active', 'under_loi', 'sold'
  
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('portfolio_assets_org_idx').on(table.orgId),
  portfolioIdx: index('portfolio_assets_portfolio_idx').on(table.portfolioId),
  projectIdx: index('portfolio_assets_project_idx').on(table.modelingProjectId),
  stateIdx: index('portfolio_assets_state_idx').on(table.state),
  uniqueAsset: unique('portfolio_assets_portfolio_project').on(table.portfolioId, table.modelingProjectId),
}));

// Covenant Tracking - Monitor loan covenants across portfolio
export const covenantTracking = pgTable('covenant_tracking', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  debtTrancheId: varchar('debt_tranche_id').references(() => debtTranches.id),
  
  covenantType: covenantTypeEnum('covenant_type').notNull(),
  covenantName: text('covenant_name').notNull(),
  
  // Threshold
  requiredValue: decimal('required_value', { precision: 18, scale: 4 }).notNull(),
  comparisonOperator: text('comparison_operator').notNull(), // 'gte', 'lte', 'eq'
  
  // Current status
  currentValue: decimal('current_value', { precision: 18, scale: 4 }),
  status: covenantStatusEnum('status').notNull().default('in_compliance'),
  cushionPct: decimal('cushion_pct', { precision: 8, scale: 4 }), // How far from breach
  
  // Testing schedule
  testingFrequency: text('testing_frequency'), // 'monthly', 'quarterly', 'annual'
  lastTestedAt: timestamp('last_tested_at'),
  nextTestDate: date('next_test_date'),
  
  // Breach history
  lastBreachDate: date('last_breach_date'),
  breachCount: integer('breach_count').default(0),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('covenant_tracking_org_idx').on(table.orgId),
  projectIdx: index('covenant_tracking_project_idx').on(table.modelingProjectId),
  typeIdx: index('covenant_tracking_type_idx').on(table.covenantType),
  statusIdx: index('covenant_tracking_status_idx').on(table.status),
}));

// ============================================================================
// LP PORTAL & INVESTOR REPORTING
// Investor management, capital accounts, and distribution tracking
// ============================================================================

// LP Investors - Limited partner tracking
export const lpInvestors = pgTable('lp_investors', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Investor info
  name: text('name').notNull(),
  entityType: text('entity_type'), // 'individual', 'trust', 'llc', 'corporation', 'fund_of_funds'
  taxId: text('tax_id'), // EIN or SSN (encrypted)
  
  // Contact
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  address: jsonb('address').$type<{
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }>(),
  
  // Accreditation
  isAccredited: boolean('is_accredited').default(true),
  accreditationDate: date('accreditation_date'),
  accreditationExpiry: date('accreditation_expiry'),
  
  // Portal access
  portalUserId: varchar('portal_user_id').references(() => users.id),
  lastLoginAt: timestamp('last_login_at'),
  
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('lp_investors_org_idx').on(table.orgId),
  emailIdx: index('lp_investors_email_idx').on(table.email),
  activeIdx: index('lp_investors_active_idx').on(table.isActive),
}));

// LP Commitments - Investor commitments to specific investments/funds
export const lpCommitments = pgTable('lp_commitments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  investorId: varchar('investor_id').notNull().references(() => lpInvestors.id),
  portfolioId: varchar('portfolio_id').references(() => portfolios.id),
  modelingProjectId: varchar('modeling_project_id').references(() => modelingProjects.id),
  equityLayerId: varchar('equity_layer_id').references(() => equityLayers.id),
  
  // Commitment details
  commitmentAmount: decimal('commitment_amount', { precision: 18, scale: 2 }).notNull(),
  fundedAmount: decimal('funded_amount', { precision: 18, scale: 2 }).default('0'),
  unfundedCommitment: decimal('unfunded_commitment', { precision: 18, scale: 2 }),
  ownershipPct: decimal('ownership_pct', { precision: 8, scale: 6 }),
  
  // Dates
  commitmentDate: date('commitment_date'),
  firstFundingDate: date('first_funding_date'),
  
  // Status
  status: text('status').default('active'), // 'pending', 'active', 'fully_funded', 'redeemed'
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('lp_commitments_org_idx').on(table.orgId),
  investorIdx: index('lp_commitments_investor_idx').on(table.investorId),
  portfolioIdx: index('lp_commitments_portfolio_idx').on(table.portfolioId),
  projectIdx: index('lp_commitments_project_idx').on(table.modelingProjectId),
}));

// LP Distributions - Distribution history per investor
export const lpDistributions = pgTable('lp_distributions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  commitmentId: varchar('commitment_id').notNull().references(() => lpCommitments.id),
  investorId: varchar('investor_id').notNull().references(() => lpInvestors.id),
  
  // Distribution details
  distributionDate: date('distribution_date').notNull(),
  distributionType: text('distribution_type').notNull(), // 'operating', 'return_of_capital', 'capital_gain', 'refinance'
  
  grossAmount: decimal('gross_amount', { precision: 18, scale: 2 }).notNull(),
  withholding: decimal('withholding', { precision: 18, scale: 2 }).default('0'),
  netAmount: decimal('net_amount', { precision: 18, scale: 2 }).notNull(),
  
  // Waterfall tier this came from
  waterfallTier: text('waterfall_tier'),
  
  // Cumulative tracking
  cumulativeDistributed: decimal('cumulative_distributed', { precision: 18, scale: 2 }),
  remainingBasis: decimal('remaining_basis', { precision: 18, scale: 2 }),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('lp_distributions_org_idx').on(table.orgId),
  commitmentIdx: index('lp_distributions_commitment_idx').on(table.commitmentId),
  investorIdx: index('lp_distributions_investor_idx').on(table.investorId),
  dateIdx: index('lp_distributions_date_idx').on(table.distributionDate),
}));

// LP Capital Accounts - Point-in-time capital account balances
export const lpCapitalAccounts = pgTable('lp_capital_accounts', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  commitmentId: varchar('commitment_id').notNull().references(() => lpCommitments.id),
  investorId: varchar('investor_id').notNull().references(() => lpInvestors.id),
  
  // Period
  periodEnd: date('period_end').notNull(),
  
  // Balances
  beginningBalance: decimal('beginning_balance', { precision: 18, scale: 2 }).notNull(),
  contributions: decimal('contributions', { precision: 18, scale: 2 }).default('0'),
  distributions: decimal('distributions', { precision: 18, scale: 2 }).default('0'),
  income: decimal('income', { precision: 18, scale: 2 }).default('0'),
  unrealizedGainLoss: decimal('unrealized_gain_loss', { precision: 18, scale: 2 }).default('0'),
  endingBalance: decimal('ending_balance', { precision: 18, scale: 2 }).notNull(),
  
  // NAV per unit
  navPerUnit: decimal('nav_per_unit', { precision: 18, scale: 6 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('lp_capital_accounts_org_idx').on(table.orgId),
  commitmentIdx: index('lp_capital_accounts_commitment_idx').on(table.commitmentId),
  investorIdx: index('lp_capital_accounts_investor_idx').on(table.investorId),
  periodIdx: index('lp_capital_accounts_period_idx').on(table.periodEnd),
}));

// ============================================================================
// EXIT READINESS SCORING
// Track asset readiness for exit with checklists and scoring
// ============================================================================

// Exit Readiness Assessments - Overall readiness scoring per asset
export const exitReadinessAssessments = pgTable('exit_readiness_assessments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Overall scoring
  overallScore: integer('overall_score'), // 0-100
  status: exitReadinessStatusEnum('status').notNull().default('not_ready'),
  
  // Category scores
  documentationScore: integer('documentation_score'),
  financialScore: integer('financial_score'),
  operationalScore: integer('operational_score'),
  legalScore: integer('legal_score'),
  marketTimingScore: integer('market_timing_score'),
  
  // Market analysis
  currentMarketCapRate: decimal('current_market_cap_rate', { precision: 8, scale: 4 }),
  suggestedListingPrice: decimal('suggested_listing_price', { precision: 18, scale: 2 }),
  optimalExitWindow: text('optimal_exit_window'), // e.g., "Q2-Q3 2025"
  
  // Recommendations
  topIssues: text('top_issues').array(),
  recommendations: jsonb('recommendations').$type<{
    category: string;
    issue: string;
    action: string;
    priority: 'high' | 'medium' | 'low';
    estimatedDays: number;
  }[]>(),
  
  // Timeline
  estimatedTimeToReady: integer('estimated_time_to_ready'), // Days
  targetExitDate: date('target_exit_date'),
  
  assessedBy: varchar('assessed_by').references(() => users.id),
  assessedAt: timestamp('assessed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('exit_readiness_assessments_org_idx').on(table.orgId),
  projectIdx: index('exit_readiness_assessments_project_idx').on(table.modelingProjectId),
  statusIdx: index('exit_readiness_assessments_status_idx').on(table.status),
  scoreIdx: index('exit_readiness_assessments_score_idx').on(table.overallScore),
}));

// Exit Readiness Checklist Items - Individual checklist items
export const exitReadinessChecklist = pgTable('exit_readiness_checklist', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  assessmentId: varchar('assessment_id').notNull().references(() => exitReadinessAssessments.id, { onDelete: 'cascade' }),
  
  category: text('category').notNull(), // 'documentation', 'financial', 'operational', 'legal', 'market'
  item: text('item').notNull(),
  description: text('description'),
  
  // Status
  isComplete: boolean('is_complete').default(false),
  completedBy: varchar('completed_by').references(() => users.id),
  completedAt: timestamp('completed_at'),
  
  // Scoring impact
  weight: integer('weight').default(1), // Impact on category score
  
  // Notes
  notes: text('notes'),
  blockers: text('blockers'),
  
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('exit_readiness_checklist_org_idx').on(table.orgId),
  assessmentIdx: index('exit_readiness_checklist_assessment_idx').on(table.assessmentId),
  categoryIdx: index('exit_readiness_checklist_category_idx').on(table.category),
  completeIdx: index('exit_readiness_checklist_complete_idx').on(table.isComplete),
}));

// ============================================================================
// PE INSTITUTIONAL MODULE - Insert Schemas and Types
// ============================================================================

export const insertCapitalStackSchema = createInsertSchema(capitalStacks).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
}).extend({
  purchasePrice: z.string().or(z.number()),
  closingCosts: z.string().or(z.number()).optional(),
  capexReserves: z.string().or(z.number()).optional(),
  workingCapital: z.string().or(z.number()).optional(),
  totalCapitalization: z.string().or(z.number()),
  totalDebt: z.string().or(z.number()).optional(),
  totalEquity: z.string().or(z.number()).optional(),
  exitCapRate: z.string().or(z.number()).optional(),
  noiGrowthRate: z.string().or(z.number()).optional(),
});
export const updateCapitalStackSchema = insertCapitalStackSchema.partial();

export const insertDebtTrancheSchema = createInsertSchema(debtTranches).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  principal: z.string().or(z.number()),
  interestRate: z.string().or(z.number()),
  originationFeePct: z.string().or(z.number()).optional(),
  minDscr: z.string().or(z.number()).optional(),
  maxLtv: z.string().or(z.number()).optional(),
});
export const updateDebtTrancheSchema = insertDebtTrancheSchema.partial();

export const insertEquityLayerSchema = createInsertSchema(equityLayers).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  commitmentAmount: z.string().or(z.number()),
  fundedAmount: z.string().or(z.number()).optional(),
  ownershipPct: z.string().or(z.number()),
  preferredReturn: z.string().or(z.number()).optional(),
});
export const updateEquityLayerSchema = insertEquityLayerSchema.partial();

export const insertIcMemoSchema = createInsertSchema(icMemos).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  submittedAt: true,
  submittedBy: true,
  approvedAt: true,
  rejectedAt: true,
});
export const updateIcMemoSchema = insertIcMemoSchema.partial();

export const insertIcVoteSchema = createInsertSchema(icVotes).omit({
  id: true,
  orgId: true,
  votedAt: true,
});

export const insertIcCommentSchema = createInsertSchema(icComments).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  resolvedBy: true,
  resolvedAt: true,
});

export const insertUnderwritingAssumptionSchema = createInsertSchema(underwritingAssumptions).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  lockedAt: true,
  lockedBy: true,
});

export const insertActualPerformanceSchema = createInsertSchema(actualPerformance).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  syncedAt: true,
});

export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});
export const updatePortfolioSchema = insertPortfolioSchema.partial();

export const insertPortfolioAssetSchema = createInsertSchema(portfolioAssets).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCovenantTrackingSchema = createInsertSchema(covenantTracking).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLpInvestorSchema = createInsertSchema(lpInvestors).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});
export const updateLpInvestorSchema = insertLpInvestorSchema.partial();

export const insertLpCommitmentSchema = createInsertSchema(lpCommitments).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLpDistributionSchema = createInsertSchema(lpDistributions).omit({
  id: true,
  orgId: true,
  createdAt: true,
});

export const insertExitReadinessAssessmentSchema = createInsertSchema(exitReadinessAssessments).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  assessedBy: true,
  assessedAt: true,
});

export const insertExitReadinessChecklistSchema = createInsertSchema(exitReadinessChecklist).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  completedBy: true,
  completedAt: true,
});

// Type exports
export type CapitalStack = typeof capitalStacks.$inferSelect;
export type InsertCapitalStack = z.infer<typeof insertCapitalStackSchema>;
export type UpdateCapitalStack = z.infer<typeof updateCapitalStackSchema>;

export type DebtTranche = typeof debtTranches.$inferSelect;
export type InsertDebtTranche = z.infer<typeof insertDebtTrancheSchema>;
export type UpdateDebtTranche = z.infer<typeof updateDebtTrancheSchema>;

export type EquityLayer = typeof equityLayers.$inferSelect;
export type InsertEquityLayer = z.infer<typeof insertEquityLayerSchema>;
export type UpdateEquityLayer = z.infer<typeof updateEquityLayerSchema>;

export type CapitalStackProjection = typeof capitalStackProjections.$inferSelect;

export type IcCommitteeMember = typeof icCommitteeMembers.$inferSelect;

export type IcMemo = typeof icMemos.$inferSelect;
export type InsertIcMemo = z.infer<typeof insertIcMemoSchema>;
export type UpdateIcMemo = z.infer<typeof updateIcMemoSchema>;

export type IcVote = typeof icVotes.$inferSelect;
export type InsertIcVote = z.infer<typeof insertIcVoteSchema>;

export type IcComment = typeof icComments.$inferSelect;
export type InsertIcComment = z.infer<typeof insertIcCommentSchema>;

export type UnderwritingAssumption = typeof underwritingAssumptions.$inferSelect;
export type InsertUnderwritingAssumption = z.infer<typeof insertUnderwritingAssumptionSchema>;

export type ActualPerformance = typeof actualPerformance.$inferSelect;
export type InsertActualPerformance = z.infer<typeof insertActualPerformanceSchema>;

export type VarianceAlert = typeof varianceAlerts.$inferSelect;

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type UpdatePortfolio = z.infer<typeof updatePortfolioSchema>;

export type PortfolioAsset = typeof portfolioAssets.$inferSelect;
export type InsertPortfolioAsset = z.infer<typeof insertPortfolioAssetSchema>;

export type CovenantTracking = typeof covenantTracking.$inferSelect;
export type InsertCovenantTracking = z.infer<typeof insertCovenantTrackingSchema>;

export type LpInvestor = typeof lpInvestors.$inferSelect;
export type InsertLpInvestor = z.infer<typeof insertLpInvestorSchema>;
export type UpdateLpInvestor = z.infer<typeof updateLpInvestorSchema>;

export type LpCommitment = typeof lpCommitments.$inferSelect;
export type InsertLpCommitment = z.infer<typeof insertLpCommitmentSchema>;

export type LpDistribution = typeof lpDistributions.$inferSelect;
export type InsertLpDistribution = z.infer<typeof insertLpDistributionSchema>;

export type LpCapitalAccount = typeof lpCapitalAccounts.$inferSelect;

export type ExitReadinessAssessment = typeof exitReadinessAssessments.$inferSelect;
export type InsertExitReadinessAssessment = z.infer<typeof insertExitReadinessAssessmentSchema>;

export type ExitReadinessChecklistItem = typeof exitReadinessChecklist.$inferSelect;
export type InsertExitReadinessChecklistItem = z.infer<typeof insertExitReadinessChecklistSchema>;

// ============================================================================
// DOCUMENT INTELLIGENCE - AI-Powered Financial Document Parsing
// Provides smart import for P&L, Rent Roll, and other financial documents
// with line item extraction, categorization, and learning from user feedback
// ============================================================================

// Enums for Document Intelligence
export const docIntelDocTypeEnum = pgEnum("doc_intel_doc_type", ["pnl", "rent_roll", "balance_sheet", "rate_sheet", "invoice", "other"]);
export const docIntelItemStatusEnum = pgEnum("doc_intel_item_status", ["pending", "confirmed", "rejected", "needs_review", "excluded"]);
export const docIntelProcessingStatusEnum = pgEnum("doc_intel_processing_status", ["uploaded", "processing", "parsed", "reviewing", "approved", "applied", "completed", "error"]);
export const pnlCategoryTypeEnum = pgEnum("pnl_category_type", ["revenue", "cogs", "opex", "payroll", "other_expense", "other_income"]);
export const holdingStationStatusEnum = pgEnum("holding_station_status", ["staging", "validated", "ready_to_process", "processing", "processed"]);
export const docIntelDepartmentEnum = pgEnum("doc_intel_department", ["marina_ops", "fuel_dock", "ship_store", "restaurant", "boat_sales", "service_dept", "storage", "admin", "other"]);

// P&L Categories - Hierarchical marina-specific categories (org-configurable)
export const pnlCategories = pgTable('pnl_categories', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Hierarchy
  parentId: varchar('parent_id'), // Self-referencing for subcategories (null = top-level)
  categoryType: pnlCategoryTypeEnum('category_type').notNull(), // revenue, cogs, opex, payroll
  
  // Display
  name: text('name').notNull(), // e.g., "Wet Slip Revenue", "Fuel COGS"
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  
  // Settings
  isActive: boolean('is_active').default(true).notNull(),
  isDefault: boolean('is_default').default(false).notNull(), // System-provided default categories
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('pnl_categories_org_idx').on(table.orgId),
  parentIdx: index('pnl_categories_parent_idx').on(table.parentId),
  typeIdx: index('pnl_categories_type_idx').on(table.categoryType),
  activeIdx: index('pnl_categories_active_idx').on(table.isActive),
}));

// Document Uploads - Files uploaded for intelligent parsing
export const docIntelUploads = pgTable('doc_intel_uploads', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // File info
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  storagePath: text('storage_path').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  hashSha256: text('hash_sha256'), // For duplicate detection
  
  // Classification
  docType: docIntelDocTypeEnum('doc_type'),
  year: integer('year'), // Fiscal year of document
  
  // Processing status
  status: docIntelProcessingStatusEnum('status').notNull().default('uploaded'),
  errorMessage: text('error_message'),
  
  // Holding Station - Staging queue before processing
  holdingStatus: holdingStationStatusEnum('holding_status').default('staging'),
  holdingTags: text('holding_tags').array(), // User-defined tags for organization
  holdingNotes: text('holding_notes'), // Notes about the document
  isDuplicate: boolean('is_duplicate').default(false),
  duplicateOfId: varchar('duplicate_of_id'), // Reference to original if duplicate
  validationErrors: jsonb('validation_errors').$type<string[]>(), // Validation issues
  validatedAt: timestamp('validated_at'),
  validatedBy: varchar('validated_by').references(() => users.id),
  
  // Review progress
  wizardStep: integer('wizard_step').default(1), // Current step in review wizard (1-5)
  reviewStartedAt: timestamp('review_started_at'),
  reviewCompletedAt: timestamp('review_completed_at'),
  
  // Approval workflow
  approvalNotes: text('approval_notes'), // Notes from reviewer before applying
  approvedAt: timestamp('approved_at'),
  approvedBy: varchar('approved_by').references(() => users.id),
  appliedAt: timestamp('applied_at'), // When data was written to model
  appliedBy: varchar('applied_by').references(() => users.id),
  
  // Metadata
  uploadedBy: varchar('uploaded_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('doc_intel_uploads_org_idx').on(table.orgId),
  projectIdx: index('doc_intel_uploads_project_idx').on(table.modelingProjectId),
  statusIdx: index('doc_intel_uploads_status_idx').on(table.status),
  docTypeIdx: index('doc_intel_uploads_doc_type_idx').on(table.docType),
  holdingStatusIdx: index('doc_intel_uploads_holding_status_idx').on(table.holdingStatus),
}));

// Extracted Items - Line items parsed from documents
export const docIntelExtractedItems = pgTable('doc_intel_extracted_items', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  uploadId: varchar('upload_id').notNull().references(() => docIntelUploads.id, { onDelete: 'cascade' }),
  
  // Extracted raw data
  rawText: text('raw_text').notNull(), // Original text from document
  amount: decimal('amount', { precision: 18, scale: 2 }),
  extractedDate: text('extracted_date'), // Date string found in document
  sourcePage: integer('source_page'), // Page/sheet number
  sourceRow: integer('source_row'), // Row number in spreadsheet
  
  // AI suggestions
  categorySuggested: varchar('category_suggested').references(() => pnlCategories.id),
  confidenceScore: decimal('confidence_score', { precision: 5, scale: 4 }), // 0.0000 to 1.0000
  matchedRuleId: varchar('matched_rule_id'), // Which rule triggered this suggestion
  
  // Department assignment (AI suggested + user confirmed)
  departmentSuggested: docIntelDepartmentEnum('department_suggested'),
  departmentConfirmed: docIntelDepartmentEnum('department_confirmed'),
  
  // User confirmation
  status: docIntelItemStatusEnum('status').notNull().default('pending'),
  categoryConfirmed: varchar('category_confirmed').references(() => pnlCategories.id),
  amountConfirmed: decimal('amount_confirmed', { precision: 18, scale: 2 }),
  confirmedBy: varchar('confirmed_by').references(() => users.id),
  confirmedAt: timestamp('confirmed_at'),
  
  // Review notes
  reviewNotes: text('review_notes'),
  
  // Destination mapping
  targetTable: text('target_table'), // e.g., 'pnl_lines', 'rent_roll_entries'
  targetRecordId: varchar('target_record_id'), // ID of created record after import
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('doc_intel_items_org_idx').on(table.orgId),
  uploadIdx: index('doc_intel_items_upload_idx').on(table.uploadId),
  statusIdx: index('doc_intel_items_status_idx').on(table.status),
  categoryIdx: index('doc_intel_items_category_idx').on(table.categorySuggested),
}));

// Category Mappings - Pattern-based rules for auto-categorization
export const docIntelCategoryMappings = pgTable('doc_intel_category_mappings', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Rule definition
  name: text('name').notNull(), // e.g., "Dock Revenue Pattern"
  pattern: text('pattern').notNull(), // Regex pattern to match
  categoryId: varchar('category_id').notNull().references(() => pnlCategories.id),
  targetTable: text('target_table').notNull().default('pnl_lines'), // Destination table
  
  // Scope
  projectId: varchar('project_id').references(() => modelingProjects.id), // null = org-wide
  
  // Confidence & priority
  confidenceThreshold: decimal('confidence_threshold', { precision: 5, scale: 4 }).default('0.8'),
  priority: integer('priority').default(0), // Higher = checked first
  
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('doc_intel_mappings_org_idx').on(table.orgId),
  categoryIdx: index('doc_intel_mappings_category_idx').on(table.categoryId),
  projectIdx: index('doc_intel_mappings_project_idx').on(table.projectId),
  activeIdx: index('doc_intel_mappings_active_idx').on(table.isActive),
}));

// Learning Rules - Complex rules that improve from user feedback
export const docIntelLearningRules = pgTable('doc_intel_learning_rules', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Rule definition
  name: text('name').notNull(),
  ruleJson: jsonb('rule_json').notNull(), // Complex rule with conditions
  categoryId: varchar('category_id').notNull().references(() => pnlCategories.id),
  targetTable: text('target_table').notNull().default('pnl_lines'),
  
  // Learning metrics
  timesApplied: integer('times_applied').default(0),
  timesConfirmed: integer('times_confirmed').default(0),
  timesRejected: integer('times_rejected').default(0),
  confidenceScore: decimal('confidence_score', { precision: 5, scale: 4 }).default('0.5'),
  
  // Scope
  projectId: varchar('project_id').references(() => modelingProjects.id), // null = org-wide
  
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('doc_intel_rules_org_idx').on(table.orgId),
  categoryIdx: index('doc_intel_rules_category_idx').on(table.categoryId),
  activeIdx: index('doc_intel_rules_active_idx').on(table.isActive),
}));

// Training Examples - User confirmations used for learning
export const docIntelTrainingExamples = pgTable('doc_intel_training_examples', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  extractedItemId: varchar('extracted_item_id').references(() => docIntelExtractedItems.id, { onDelete: 'cascade' }),
  
  // Training data
  textSnippet: text('text_snippet').notNull(), // The text that was categorized
  labelCategoryId: varchar('label_category_id').notNull().references(() => pnlCategories.id),
  labelTable: text('label_table').notNull(), // Target table for this type
  
  // Context
  projectId: varchar('project_id').references(() => modelingProjects.id),
  docType: docIntelDocTypeEnum('doc_type'),
  
  // Tracking
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('doc_intel_training_org_idx').on(table.orgId),
  categoryIdx: index('doc_intel_training_category_idx').on(table.labelCategoryId),
  projectIdx: index('doc_intel_training_project_idx').on(table.projectId),
}));

// P&L Lines - Actual P&L data imported from documents
export const pnlLines = pgTable('pnl_lines', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Category & description
  categoryId: varchar('category_id').references(() => pnlCategories.id),
  lineDescription: text('line_description').notNull(),
  
  // Financial data
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  fiscalYear: integer('fiscal_year'),
  fiscalMonth: integer('fiscal_month'), // 1-12, null for annual
  
  // Source tracking
  sourceUploadId: varchar('source_upload_id').references(() => docIntelUploads.id),
  sourceItemId: varchar('source_item_id').references(() => docIntelExtractedItems.id),
  isManualEntry: boolean('is_manual_entry').default(false).notNull(),
  
  notes: text('notes'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('pnl_lines_org_idx').on(table.orgId),
  projectIdx: index('pnl_lines_project_idx').on(table.modelingProjectId),
  categoryIdx: index('pnl_lines_category_idx').on(table.categoryId),
  yearIdx: index('pnl_lines_year_idx').on(table.fiscalYear),
}));

// Insert schemas for Document Intelligence
export const insertPnlCategorySchema = createInsertSchema(pnlCategories).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePnlCategorySchema = insertPnlCategorySchema.partial();

export const insertDocIntelUploadSchema = createInsertSchema(docIntelUploads).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDocIntelUploadSchema = insertDocIntelUploadSchema.partial();

export const insertDocIntelExtractedItemSchema = createInsertSchema(docIntelExtractedItems).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.string().or(z.number()).optional(),
  confidenceScore: z.string().or(z.number()).optional(),
  amountConfirmed: z.string().or(z.number()).optional(),
});

export const updateDocIntelExtractedItemSchema = insertDocIntelExtractedItemSchema.partial();

export const insertDocIntelCategoryMappingSchema = createInsertSchema(docIntelCategoryMappings).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  confidenceThreshold: z.string().or(z.number()).optional(),
});

export const updateDocIntelCategoryMappingSchema = insertDocIntelCategoryMappingSchema.partial();

export const insertDocIntelLearningRuleSchema = createInsertSchema(docIntelLearningRules).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  confidenceScore: z.string().or(z.number()).optional(),
});

export const updateDocIntelLearningRuleSchema = insertDocIntelLearningRuleSchema.partial();

export const insertDocIntelTrainingExampleSchema = createInsertSchema(docIntelTrainingExamples).omit({
  id: true,
  orgId: true,
  createdAt: true,
});

export const insertPnlLineSchema = createInsertSchema(pnlLines).omit({
  id: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.string().or(z.number()),
});

export const updatePnlLineSchema = insertPnlLineSchema.partial();

// Type exports for Document Intelligence
export type PnlCategory = typeof pnlCategories.$inferSelect;
export type InsertPnlCategory = z.infer<typeof insertPnlCategorySchema>;
export type UpdatePnlCategory = z.infer<typeof updatePnlCategorySchema>;

export type DocIntelUpload = typeof docIntelUploads.$inferSelect;
export type InsertDocIntelUpload = z.infer<typeof insertDocIntelUploadSchema>;
export type UpdateDocIntelUpload = z.infer<typeof updateDocIntelUploadSchema>;

export type DocIntelExtractedItem = typeof docIntelExtractedItems.$inferSelect;
export type InsertDocIntelExtractedItem = z.infer<typeof insertDocIntelExtractedItemSchema>;
export type UpdateDocIntelExtractedItem = z.infer<typeof updateDocIntelExtractedItemSchema>;

export type DocIntelCategoryMapping = typeof docIntelCategoryMappings.$inferSelect;
export type InsertDocIntelCategoryMapping = z.infer<typeof insertDocIntelCategoryMappingSchema>;
export type UpdateDocIntelCategoryMapping = z.infer<typeof updateDocIntelCategoryMappingSchema>;

export type DocIntelLearningRule = typeof docIntelLearningRules.$inferSelect;
export type InsertDocIntelLearningRule = z.infer<typeof insertDocIntelLearningRuleSchema>;
export type UpdateDocIntelLearningRule = z.infer<typeof updateDocIntelLearningRuleSchema>;

export type DocIntelTrainingExample = typeof docIntelTrainingExamples.$inferSelect;
export type InsertDocIntelTrainingExample = z.infer<typeof insertDocIntelTrainingExampleSchema>;

export type PnlLine = typeof pnlLines.$inferSelect;
export type InsertPnlLine = z.infer<typeof insertPnlLineSchema>;
export type UpdatePnlLine = z.infer<typeof updatePnlLineSchema>;

// ============================================================================
// Operations → Modeling Data Pipeline
// Canonical actuals schema for aggregating operations data into modeling
// ============================================================================

// Data source type for tracking where actuals data originated
export const actualsDataSourceEnum = pgEnum("actuals_data_source", [
  "rent_roll",      // From Rent Roll module
  "fuel_sales",     // From Fuel Sales module
  "ship_store",     // From Ship Store module
  "quickbooks",     // From QuickBooks Online sync
  "manual_entry",   // Manually entered by user
  "csv_import",     // Imported from CSV file
  "doc_intel"       // Parsed from Document Intelligence
]);

// Sync status for data pipeline jobs
export const syncStatusEnum = pgEnum("sync_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "partial"
]);

// Modeling Actuals - Canonical store for historical financial data linked to modeling projects
export const modelingActuals = pgTable('modeling_actuals', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Period information
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12
  
  // Category classification (matches P&L structure)
  category: text('category').notNull(), // 'Revenue', 'COGS', 'Expenses'
  subcategory: text('subcategory').notNull(), // e.g., 'Wet Slips', 'Fuel Sales', 'Payroll'
  lineItemDescription: text('line_item_description'),
  
  // Amounts
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  
  // Data source tracking for audit
  dataSource: actualsDataSourceEnum('data_source').notNull(),
  sourceRecordId: varchar('source_record_id'), // ID from source system
  sourceRecordType: text('source_record_type'), // e.g., 'rent_roll_entry', 'fuel_sale', 'ship_store_transaction'
  
  // Sync metadata
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
  syncJobId: varchar('sync_job_id'),
  
  // Audit
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('modeling_actuals_org_idx').on(table.orgId),
  projectIdx: index('modeling_actuals_project_idx').on(table.modelingProjectId),
  periodIdx: index('modeling_actuals_period_idx').on(table.year, table.month),
  categoryIdx: index('modeling_actuals_category_idx').on(table.category, table.subcategory),
  dataSourceIdx: index('modeling_actuals_data_source_idx').on(table.dataSource),
  uniqueLineItem: unique('modeling_actuals_unique_line').on(
    table.modelingProjectId, table.year, table.month, table.category, table.subcategory, table.lineItemDescription
  ),
}));

// Financial Period Type - defines the type of financial period
export const financialPeriodTypeEnum = pgEnum("financial_period_type", [
  "calendar_year",    // Full calendar year (2023, 2024, 2025, etc.)
  "t12",              // Trailing 12 months
  "year_1",           // First year of pro forma projection
  "custom"            // User-defined period
]);

// Modeling Financial Periods - Aggregated financial summaries by period for pricing/yield calculations
export const modelingFinancialPeriods = pgTable('modeling_financial_periods', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Period identification
  periodType: financialPeriodTypeEnum('period_type').notNull(),
  periodLabel: text('period_label').notNull(), // Display label: "2024", "T12", "Year 1", etc.
  periodYear: integer('period_year'), // Calendar year if applicable (null for T12, Year 1)
  periodStartDate: date('period_start_date'), // Actual date range for the period
  periodEndDate: date('period_end_date'),
  sortOrder: integer('sort_order').default(0), // For ordering in dropdown
  
  // Revenue metrics
  totalRevenue: decimal('total_revenue', { precision: 15, scale: 2 }),
  wetSlipRevenue: decimal('wet_slip_revenue', { precision: 15, scale: 2 }),
  dryStorageRevenue: decimal('dry_storage_revenue', { precision: 15, scale: 2 }),
  fuelRevenue: decimal('fuel_revenue', { precision: 15, scale: 2 }),
  shipStoreRevenue: decimal('ship_store_revenue', { precision: 15, scale: 2 }),
  otherRevenue: decimal('other_revenue', { precision: 15, scale: 2 }),
  
  // Expense metrics
  totalExpenses: decimal('total_expenses', { precision: 15, scale: 2 }),
  operatingExpenses: decimal('operating_expenses', { precision: 15, scale: 2 }),
  payrollExpenses: decimal('payroll_expenses', { precision: 15, scale: 2 }),
  utilitiesExpenses: decimal('utilities_expenses', { precision: 15, scale: 2 }),
  insuranceExpenses: decimal('insurance_expenses', { precision: 15, scale: 2 }),
  maintenanceExpenses: decimal('maintenance_expenses', { precision: 15, scale: 2 }),
  managementFees: decimal('management_fees', { precision: 15, scale: 2 }),
  otherExpenses: decimal('other_expenses', { precision: 15, scale: 2 }),
  
  // Profitability metrics
  grossProfit: decimal('gross_profit', { precision: 15, scale: 2 }),
  noi: decimal('noi', { precision: 15, scale: 2 }), // Net Operating Income
  ebitda: decimal('ebitda', { precision: 15, scale: 2 }),
  
  // Pricing inputs for this period
  purchasePrice: decimal('purchase_price', { precision: 15, scale: 2 }),
  
  // Calculated yields based on period NOI and purchase price
  capRate: decimal('cap_rate', { precision: 5, scale: 4 }), // e.g., 0.0725 = 7.25%
  pricePerUnit: decimal('price_per_unit', { precision: 15, scale: 2 }),
  noiMargin: decimal('noi_margin', { precision: 5, scale: 4 }), // NOI / Total Revenue
  
  // Occupancy metrics (if applicable)
  occupancyRate: decimal('occupancy_rate', { precision: 5, scale: 4 }),
  totalUnits: integer('total_units'),
  occupiedUnits: integer('occupied_units'),
  
  // Data quality indicators
  isProjected: boolean('is_projected').default(false), // true for Year 1 or future projections
  dataCompleteness: decimal('data_completeness', { precision: 5, scale: 2 }), // 0-100% completeness score
  lastCalculatedAt: timestamp('last_calculated_at'),
  
  // Audit fields
  notes: text('notes'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('modeling_fin_periods_org_idx').on(table.orgId),
  projectIdx: index('modeling_fin_periods_project_idx').on(table.modelingProjectId),
  periodTypeIdx: index('modeling_fin_periods_type_idx').on(table.periodType),
  periodYearIdx: index('modeling_fin_periods_year_idx').on(table.periodYear),
  sortOrderIdx: index('modeling_fin_periods_sort_idx').on(table.sortOrder),
  uniquePeriod: unique('modeling_fin_periods_unique').on(
    table.modelingProjectId, table.periodType, table.periodLabel
  ),
}));

// Adjustment scope and type enums for normalization
export const adjustmentScopeEnum = pgEnum("adjustment_scope", [
  "line_item",    // Adjustment applies to a specific line item
  "subcategory",  // Adjustment applies to a subcategory/department
  "category"      // Adjustment applies to an entire category (Revenue, COGS, Expenses)
]);

export const adjustmentTypeEnum = pgEnum("adjustment_type", [
  "absolute",     // Add/subtract a fixed dollar amount
  "percentage",   // Adjust by a percentage (e.g., +10% or -5%)
  "replace"       // Replace the original value entirely
]);

// Modeling Period Adjustments - Store normalization adjustments for financial periods
// These adjustments allow users to "normalize" financial data by adjusting unusual items
export const modelingPeriodAdjustments = pgTable('modeling_period_adjustments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Period this adjustment applies to
  periodLabel: text('period_label').notNull(), // e.g., "2024", "T12", "Year 1"
  
  // Scope of adjustment
  scope: adjustmentScopeEnum('scope').notNull(),
  
  // Target identifier based on scope:
  // - line_item: "category|subcategory|lineItemDescription" 
  // - subcategory: "category|subcategory"
  // - category: "category"
  targetIdentifier: text('target_identifier').notNull(),
  
  // Human-readable label for the target
  targetLabel: text('target_label').notNull(),
  
  // Adjustment configuration
  adjustmentType: adjustmentTypeEnum('adjustment_type').notNull(),
  adjustmentValue: decimal('adjustment_value', { precision: 15, scale: 2 }).notNull(),
  
  // Original value before adjustment (for reference/display)
  originalValue: decimal('original_value', { precision: 15, scale: 2 }),
  
  // Calculated adjusted value
  adjustedValue: decimal('adjusted_value', { precision: 15, scale: 2 }),
  
  // Reason for the adjustment (required for audit trail)
  reason: text('reason').notNull(),
  
  // Whether this adjustment is currently active
  isActive: boolean('is_active').default(true).notNull(),
  
  // Audit fields
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: varchar('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('period_adj_org_idx').on(table.orgId),
  projectIdx: index('period_adj_project_idx').on(table.modelingProjectId),
  periodIdx: index('period_adj_period_idx').on(table.periodLabel),
  scopeIdx: index('period_adj_scope_idx').on(table.scope),
  activeIdx: index('period_adj_active_idx').on(table.isActive),
  uniqueAdjustment: unique('period_adj_unique').on(
    table.modelingProjectId, table.periodLabel, table.scope, table.targetIdentifier
  ),
}));

// Operations Data Sync Jobs - Track sync operations from Operations modules
export const operationsDataSyncJobs = pgTable('operations_data_sync_jobs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Job configuration
  syncType: text('sync_type').notNull(), // 'full', 'incremental', 'manual'
  dataSources: text('data_sources').array().notNull(), // ['rent_roll', 'fuel_sales', 'ship_store']
  dateRangeStart: date('date_range_start'),
  dateRangeEnd: date('date_range_end'),
  
  // Job status
  status: syncStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  // Results
  recordsProcessed: integer('records_processed').default(0),
  recordsImported: integer('records_imported').default(0),
  recordsSkipped: integer('records_skipped').default(0),
  recordsFailed: integer('records_failed').default(0),
  
  // Error tracking
  errorLog: jsonb('error_log').default(sql`'[]'`),
  
  // Metadata
  triggeredBy: varchar('triggered_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('ops_sync_jobs_org_idx').on(table.orgId),
  projectIdx: index('ops_sync_jobs_project_idx').on(table.modelingProjectId),
  statusIdx: index('ops_sync_jobs_status_idx').on(table.status),
  dateIdx: index('ops_sync_jobs_date_idx').on(table.createdAt),
}));

// Operations Data Mappings - Configure how operations data maps to P&L categories
export const operationsDataMappings = pgTable('operations_data_mappings', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Source configuration
  dataSource: actualsDataSourceEnum('data_source').notNull(),
  sourceField: text('source_field').notNull(), // e.g., 'fuel_type', 'slip_type', 'category_id'
  sourceValue: text('source_value'), // Optional filter value
  
  // Target P&L mapping
  targetCategory: text('target_category').notNull(), // 'Revenue', 'COGS', 'Expenses'
  targetSubcategory: text('target_subcategory').notNull(), // e.g., 'Fuel Sales', 'Ship Store'
  targetDescription: text('target_description'), // Optional line item description
  
  // Calculation rules
  amountField: text('amount_field').notNull(), // Which field to use for amount
  aggregationMethod: text('aggregation_method').notNull().default('sum'), // 'sum', 'count', 'average'
  
  // Status
  isActive: boolean('is_active').notNull().default(true),
  priority: integer('priority').default(0), // For ordering when multiple mappings match
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('ops_data_mappings_org_idx').on(table.orgId),
  sourceIdx: index('ops_data_mappings_source_idx').on(table.dataSource, table.sourceField),
  activeIdx: index('ops_data_mappings_active_idx').on(table.isActive),
}));

// QuickBooks Integration - OAuth and sync configuration
export const quickbooksIntegrations = pgTable('quickbooks_integrations', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id).unique(),
  
  // OAuth tokens (encrypted at rest)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  realmId: text('realm_id'), // QuickBooks company ID
  tokenExpiresAt: timestamp('token_expires_at'),
  
  // Connection status
  isConnected: boolean('is_connected').notNull().default(false),
  lastSyncAt: timestamp('last_sync_at'),
  syncFrequency: integer('sync_frequency').default(60), // minutes
  autoSyncEnabled: boolean('auto_sync_enabled').default(false),
  
  // Chart of Accounts mapping
  chartOfAccountsMapping: jsonb('coa_mapping').default(sql`'{}'`), // Maps QB accounts to P&L categories
  
  // Sync configuration
  syncStartDate: date('sync_start_date'), // How far back to sync
  excludedAccounts: text('excluded_accounts').array().default(sql`'{}'`), // Account IDs to skip
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('qb_integrations_org_idx').on(table.orgId),
  connectedIdx: index('qb_integrations_connected_idx').on(table.isConnected),
}));

// QuickBooks Sync Logs - Track sync operations with QuickBooks
export const quickbooksSyncLogs = pgTable('quickbooks_sync_logs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  integrationId: varchar('integration_id').notNull().references(() => quickbooksIntegrations.id, { onDelete: 'cascade' }),
  modelingProjectId: varchar('modeling_project_id').references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Sync details
  syncType: text('sync_type').notNull(), // 'full', 'incremental', 'manual'
  status: syncStatusEnum('status').notNull().default('pending'),
  
  // Period synced
  periodStart: date('period_start'),
  periodEnd: date('period_end'),
  
  // Results
  transactionsProcessed: integer('transactions_processed').default(0),
  transactionsImported: integer('transactions_imported').default(0),
  transactionsSkipped: integer('transactions_skipped').default(0),
  transactionsFailed: integer('transactions_failed').default(0),
  
  // Error tracking
  errorLog: jsonb('error_log').default(sql`'[]'`),
  
  // Timestamps
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('qb_sync_logs_org_idx').on(table.orgId),
  integrationIdx: index('qb_sync_logs_integration_idx').on(table.integrationId),
  projectIdx: index('qb_sync_logs_project_idx').on(table.modelingProjectId),
  statusIdx: index('qb_sync_logs_status_idx').on(table.status),
  dateIdx: index('qb_sync_logs_date_idx').on(table.createdAt),
}));

// Modeling Scenario Versions - Persist scenarios with version history for PE/Family Office compliance
export const modelingScenarioVersions = pgTable('modeling_scenario_versions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Scenario identification
  scenarioType: text('scenario_type').notNull(), // 'base', 'aggressive', 'conservative', 'custom'
  name: text('name').notNull(),
  description: text('description'),
  
  // Version tracking
  version: integer('version').notNull().default(1),
  isCurrentVersion: boolean('is_current_version').notNull().default(true),
  previousVersionId: varchar('previous_version_id').references((): any => modelingScenarioVersions.id),
  
  // Scenario configuration
  revenueGrowthRate: decimal('revenue_growth_rate', { precision: 5, scale: 2 }),
  expenseGrowthRate: decimal('expense_growth_rate', { precision: 5, scale: 2 }),
  exitCapRate: decimal('exit_cap_rate', { precision: 5, scale: 2 }),
  
  // Additional assumptions (flexible JSON)
  assumptions: jsonb('assumptions').default(sql`'{}'`), // Stores all granular assumptions
  
  // Approval workflow
  status: text('status').notNull().default('draft'), // 'draft', 'pending_approval', 'approved', 'rejected'
  approvedBy: varchar('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  approvalNotes: text('approval_notes'),
  
  // Audit trail
  createdBy: varchar('created_by').notNull().references(() => users.id),
  updatedBy: varchar('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('scenario_versions_org_idx').on(table.orgId),
  projectIdx: index('scenario_versions_project_idx').on(table.modelingProjectId),
  typeIdx: index('scenario_versions_type_idx').on(table.scenarioType),
  currentIdx: index('scenario_versions_current_idx').on(table.isCurrentVersion),
  statusIdx: index('scenario_versions_status_idx').on(table.status),
  uniqueCurrentVersion: unique('scenario_versions_unique_current').on(
    table.modelingProjectId, table.scenarioType, table.isCurrentVersion
  ).nullsNotDistinct(),
}));

// Modeling Audit Log - Comprehensive audit trail for compliance
export const modelingAuditLog = pgTable('modeling_audit_log', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Event details
  eventType: text('event_type').notNull(), // 'scenario_created', 'scenario_updated', 'scenario_approved', 'data_synced', 'export_generated', etc.
  entityType: text('entity_type').notNull(), // 'scenario', 'actuals', 'assumption', 'export'
  entityId: varchar('entity_id'),
  
  // Change tracking
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),
  changedFields: text('changed_fields').array(),
  
  // Context
  userId: varchar('user_id').notNull().references(() => users.id),
  userEmail: text('user_email'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  // Timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('modeling_audit_org_idx').on(table.orgId),
  projectIdx: index('modeling_audit_project_idx').on(table.modelingProjectId),
  eventTypeIdx: index('modeling_audit_event_type_idx').on(table.eventType),
  entityIdx: index('modeling_audit_entity_idx').on(table.entityType, table.entityId),
  userIdx: index('modeling_audit_user_idx').on(table.userId),
  dateIdx: index('modeling_audit_date_idx').on(table.createdAt),
}));

// Modeling Multi-Approver Workflow - IC committee approvals with quorum requirements
export const modelingApprovalRequests = pgTable('modeling_approval_requests', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  scenarioVersionId: varchar('scenario_version_id').notNull().references(() => modelingScenarioVersions.id),
  
  // Request details
  title: text('title').notNull(),
  description: text('description'),
  requestedBy: varchar('requested_by').notNull().references(() => users.id),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  
  // Workflow configuration
  requiredApprovers: jsonb('required_approvers').notNull(), // Array of user IDs required to approve
  quorumCount: integer('quorum_count').notNull().default(1), // Minimum approvals needed
  deadline: timestamp('deadline'),
  
  // Status tracking
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected', 'expired'
  completedAt: timestamp('completed_at'),
  
  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('approval_req_org_idx').on(table.orgId),
  projectIdx: index('approval_req_project_idx').on(table.modelingProjectId),
  scenarioIdx: index('approval_req_scenario_idx').on(table.scenarioVersionId),
  statusIdx: index('approval_req_status_idx').on(table.status),
}));

// Individual approver decisions
export const modelingApproverDecisions = pgTable('modeling_approver_decisions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  approvalRequestId: varchar('approval_request_id').notNull().references(() => modelingApprovalRequests.id, { onDelete: 'cascade' }),
  approverId: varchar('approver_id').notNull().references(() => users.id),
  
  // Decision
  decision: text('decision').notNull(), // 'approved', 'rejected', 'pending'
  comments: text('comments'),
  decidedAt: timestamp('decided_at'),
  
  // Audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  requestIdx: index('approver_decision_request_idx').on(table.approvalRequestId),
  approverIdx: index('approver_decision_approver_idx').on(table.approverId),
  uniqueApproverRequest: unique('unique_approver_request').on(table.approvalRequestId, table.approverId),
}));

// Modeling Comment Threads - IC feedback and collaboration on scenarios
export const modelingCommentThreads = pgTable('modeling_comment_threads', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  scenarioVersionId: varchar('scenario_version_id').references(() => modelingScenarioVersions.id),
  
  // Thread context
  targetType: text('target_type').notNull(), // 'scenario', 'metric', 'assumption', 'line_item'
  targetId: text('target_id'), // ID of the specific element being discussed
  targetLabel: text('target_label'), // Human-readable label (e.g., "Revenue Growth Rate")
  
  // Thread status
  status: text('status').notNull().default('open'), // 'open', 'resolved', 'archived'
  resolvedBy: varchar('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  
  // Metadata
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('comment_thread_org_idx').on(table.orgId),
  projectIdx: index('comment_thread_project_idx').on(table.modelingProjectId),
  scenarioIdx: index('comment_thread_scenario_idx').on(table.scenarioVersionId),
  statusIdx: index('comment_thread_status_idx').on(table.status),
}));

// Individual comments within threads
export const modelingComments = pgTable('modeling_comments', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar('thread_id').notNull().references(() => modelingCommentThreads.id, { onDelete: 'cascade' }),
  
  // Comment content
  content: text('content').notNull(),
  
  // Mentions and reactions
  mentions: jsonb('mentions'), // Array of user IDs mentioned
  
  // Edit tracking
  isEdited: boolean('is_edited').default(false),
  editedAt: timestamp('edited_at'),
  
  // Metadata
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  threadIdx: index('comment_thread_id_idx').on(table.threadId),
  createdByIdx: index('comment_created_by_idx').on(table.createdBy),
}));

// Modeling Sensitivity Matrix - Store sensitivity analysis results with scenario versioning
export const modelingSensitivityMatrices = pgTable('modeling_sensitivity_matrices', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  scenarioVersionId: varchar('scenario_version_id').references(() => modelingScenarioVersions.id),
  
  // Analysis configuration
  analysisType: text('analysis_type').notNull(), // 'exit_cap_vs_growth', 'revenue_vs_expenses', 'irr_sensitivity', 'custom'
  name: text('name'),
  description: text('description'),
  
  // Variable configuration
  xAxisVariable: text('x_axis_variable').notNull(), // 'exit_cap_rate', 'revenue_growth', etc.
  xAxisMin: numeric('x_axis_min'),
  xAxisMax: numeric('x_axis_max'),
  xAxisStep: numeric('x_axis_step'),
  
  yAxisVariable: text('y_axis_variable').notNull(),
  yAxisMin: numeric('y_axis_min'),
  yAxisMax: numeric('y_axis_max'),
  yAxisStep: numeric('y_axis_step'),
  
  // Target metric being analyzed
  targetMetric: text('target_metric').notNull(), // 'irr', 'equity_multiple', 'noi', 'exit_value'
  
  // Computed matrix data
  matrixData: jsonb('matrix_data').notNull(), // 2D array of computed values
  baselineValue: numeric('baseline_value'),
  
  // Metadata
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('sensitivity_org_idx').on(table.orgId),
  projectIdx: index('sensitivity_project_idx').on(table.modelingProjectId),
  scenarioIdx: index('sensitivity_scenario_idx').on(table.scenarioVersionId),
  typeIdx: index('sensitivity_type_idx').on(table.analysisType),
}));

// Document Intelligence - AI-powered P&L and Rent Roll parsing
export const documentIntelligenceJobs = pgTable('document_intelligence_jobs', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').references(() => modelingProjects.id),
  
  documentPath: text('document_path').notNull(),
  documentType: text('document_type').notNull(), // 'p&l', 'rent_roll'
  fileName: text('file_name'),
  
  status: text('status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  itemsExtracted: integer('items_extracted'),
  errorMessage: text('error_message'),
  
  createdBy: varchar('created_by').notNull().references(() => users.id),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('doc_intel_job_org_idx').on(table.orgId),
  projectIdx: index('doc_intel_job_project_idx').on(table.modelingProjectId),
  statusIdx: index('doc_intel_job_status_idx').on(table.status),
}));

export const documentIntelligenceResults = pgTable('document_intelligence_results', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar('job_id').notNull().references(() => documentIntelligenceJobs.id, { onDelete: 'cascade' }),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  resultType: text('result_type').notNull(), // 'p&l', 'rent_roll'
  extractedData: jsonb('extracted_data').notNull(), // Full extraction result
  confidence: numeric('confidence'), // Overall confidence score 0-1
  
  reviewStatus: text('review_status').notNull().default('pending'), // 'pending', 'approved', 'rejected'
  reviewedBy: varchar('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  modifications: jsonb('modifications'), // User modifications before approval
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  jobIdx: index('doc_intel_result_job_idx').on(table.jobId),
  orgIdx: index('doc_intel_result_org_idx').on(table.orgId),
  statusIdx: index('doc_intel_result_status_idx').on(table.reviewStatus),
}));

// Insert schemas for new tables
export const insertModelingActualsSchema = createInsertSchema(modelingActuals).omit({
  id: true,
  syncedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOperationsDataSyncJobSchema = createInsertSchema(operationsDataSyncJobs).omit({
  id: true,
  createdAt: true,
});

export const insertOperationsDataMappingSchema = createInsertSchema(operationsDataMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuickbooksIntegrationSchema = createInsertSchema(quickbooksIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuickbooksSyncLogSchema = createInsertSchema(quickbooksSyncLogs).omit({
  id: true,
  createdAt: true,
});

export const insertModelingScenarioVersionSchema = createInsertSchema(modelingScenarioVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModelingAuditLogSchema = createInsertSchema(modelingAuditLog).omit({
  id: true,
  createdAt: true,
});

export const insertModelingSensitivityMatrixSchema = createInsertSchema(modelingSensitivityMatrices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModelingApprovalRequestSchema = createInsertSchema(modelingApprovalRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  requestedAt: true,
});

export const insertModelingApproverDecisionSchema = createInsertSchema(modelingApproverDecisions).omit({
  id: true,
  createdAt: true,
});

export const insertModelingCommentThreadSchema = createInsertSchema(modelingCommentThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModelingCommentSchema = createInsertSchema(modelingComments).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentIntelligenceJobSchema = createInsertSchema(documentIntelligenceJobs).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentIntelligenceResultSchema = createInsertSchema(documentIntelligenceResults).omit({
  id: true,
  createdAt: true,
});

// Type exports for Operations → Modeling pipeline
export type ModelingActuals = typeof modelingActuals.$inferSelect;
export type InsertModelingActuals = z.infer<typeof insertModelingActualsSchema>;

export type OperationsDataSyncJob = typeof operationsDataSyncJobs.$inferSelect;
export type InsertOperationsDataSyncJob = z.infer<typeof insertOperationsDataSyncJobSchema>;

export type OperationsDataMapping = typeof operationsDataMappings.$inferSelect;
export type InsertOperationsDataMapping = z.infer<typeof insertOperationsDataMappingSchema>;

export type QuickbooksIntegration = typeof quickbooksIntegrations.$inferSelect;
export type InsertQuickbooksIntegration = z.infer<typeof insertQuickbooksIntegrationSchema>;

export type QuickbooksSyncLog = typeof quickbooksSyncLogs.$inferSelect;
export type InsertQuickbooksSyncLog = z.infer<typeof insertQuickbooksSyncLogSchema>;

export type ModelingScenarioVersion = typeof modelingScenarioVersions.$inferSelect;
export type InsertModelingScenarioVersion = z.infer<typeof insertModelingScenarioVersionSchema>;

export type ModelingAuditLog = typeof modelingAuditLog.$inferSelect;
export type InsertModelingAuditLog = z.infer<typeof insertModelingAuditLogSchema>;

export type ModelingSensitivityMatrix = typeof modelingSensitivityMatrices.$inferSelect;
export type InsertModelingSensitivityMatrix = z.infer<typeof insertModelingSensitivityMatrixSchema>;

export type ModelingApprovalRequest = typeof modelingApprovalRequests.$inferSelect;
export type InsertModelingApprovalRequest = z.infer<typeof insertModelingApprovalRequestSchema>;

export type ModelingApproverDecision = typeof modelingApproverDecisions.$inferSelect;
export type InsertModelingApproverDecision = z.infer<typeof insertModelingApproverDecisionSchema>;

export type ModelingCommentThread = typeof modelingCommentThreads.$inferSelect;
export type InsertModelingCommentThread = z.infer<typeof insertModelingCommentThreadSchema>;

export type ModelingComment = typeof modelingComments.$inferSelect;
export type InsertModelingComment = z.infer<typeof insertModelingCommentSchema>;

export type DocumentIntelligenceJob = typeof documentIntelligenceJobs.$inferSelect;
export type InsertDocumentIntelligenceJob = z.infer<typeof insertDocumentIntelligenceJobSchema>;

export type DocumentIntelligenceResult = typeof documentIntelligenceResults.$inferSelect;
export type InsertDocumentIntelligenceResult = z.infer<typeof insertDocumentIntelligenceResultSchema>;

// ============================================================================
// Demographics & Market Intelligence Schema
// ============================================================================

// FRED API data cache - stores economic indicators by region
export const demographicsCache = pgTable('demographics_cache', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Geographic identifiers
  stateCode: varchar('state_code', { length: 2 }).notNull(),
  region: varchar('region', { length: 50 }),
  county: varchar('county', { length: 100 }),
  
  // FRED API data series
  seriesId: varchar('series_id', { length: 50 }).notNull(), // e.g., 'FLFLFN', 'MEHOINUSFLA'
  seriesName: varchar('series_name', { length: 200 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // 'population', 'income', 'employment', 'housing'
  
  // Data values (array of historical data points)
  dataPoints: jsonb('data_points').notNull().default(sql`'[]'`), // [{date, value}, ...]
  latestValue: numeric('latest_value'),
  latestDate: date('latest_date'),
  
  // Computed metrics
  yoyChange: numeric('yoy_change'), // Year-over-year change
  fiveYearCagr: numeric('five_year_cagr'), // 5-year compound annual growth rate
  
  // Cache management
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('demographics_cache_org_idx').on(table.orgId),
  stateIdx: index('demographics_cache_state_idx').on(table.stateCode),
  seriesIdx: index('demographics_cache_series_idx').on(table.seriesId),
  categoryIdx: index('demographics_cache_category_idx').on(table.category),
  uniqueEntry: unique('demographics_cache_unique').on(table.orgId, table.stateCode, table.seriesId),
}));

// Regional market statistics - aggregated from sales comps
export const regionalMarketStats = pgTable('regional_market_stats', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Geographic identifiers
  stateCode: varchar('state_code', { length: 2 }).notNull(),
  region: varchar('region', { length: 50 }),
  
  // Marina supply metrics
  totalMarinas: integer('total_marinas').notNull().default(0),
  totalWetSlips: integer('total_wet_slips').notNull().default(0),
  totalDryRacks: integer('total_dry_racks').notNull().default(0),
  
  // Transaction metrics
  transactionCount: integer('transaction_count').notNull().default(0),
  avgSalePrice: numeric('avg_sale_price'),
  medianSalePrice: numeric('median_sale_price'),
  avgPricePerSlip: numeric('avg_price_per_slip'),
  medianPricePerSlip: numeric('median_price_per_slip'),
  avgCapRate: numeric('avg_cap_rate'),
  medianCapRate: numeric('median_cap_rate'),
  
  // Time-based trends (last 5 years)
  priceGrowth1Yr: numeric('price_growth_1yr'),
  priceGrowth3Yr: numeric('price_growth_3yr'),
  priceGrowth5Yr: numeric('price_growth_5yr'),
  
  // Detailed time series
  yearlyStats: jsonb('yearly_stats').notNull().default(sql`'[]'`), // [{year, txCount, avgPrice, avgPPS}, ...]
  
  // Computation metadata
  computedAt: timestamp('computed_at').notNull().defaultNow(),
  dataAsOf: date('data_as_of'), // Latest transaction date included
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('regional_market_stats_org_idx').on(table.orgId),
  stateIdx: index('regional_market_stats_state_idx').on(table.stateCode),
  regionIdx: index('regional_market_stats_region_idx').on(table.region),
  uniqueEntry: unique('regional_market_stats_unique').on(table.orgId, table.stateCode, table.region),
}));

// Insert schemas for demographics tables
export const insertDemographicsCacheSchema = createInsertSchema(demographicsCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRegionalMarketStatsSchema = createInsertSchema(regionalMarketStats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for demographics
export type DemographicsCache = typeof demographicsCache.$inferSelect;
export type InsertDemographicsCache = z.infer<typeof insertDemographicsCacheSchema>;

export type RegionalMarketStats = typeof regionalMarketStats.$inferSelect;
export type InsertRegionalMarketStats = z.infer<typeof insertRegionalMarketStatsSchema>;

// Location-based demographic summary from Census API
export interface DemographicSummary {
  // Core Demographics
  totalPopulation: number;
  totalMales?: number;
  totalFemales?: number;
  medianAge: number;
  medianAgeMale?: number;
  medianAgeFemale?: number;
  
  // Age Analytics
  ageDistribution?: Record<string, number>;
  ageByGender?: Record<string, any>;
  generationalCohorts?: Record<string, number>;
  
  // Income Analytics
  medianHouseholdIncome: number;
  meanHouseholdIncome?: number;
  perCapitaIncome?: number;
  medianFamilyIncome?: number;
  incomeDistribution?: Record<string, number>;
  
  // Education Analytics
  educationLevels?: Record<string, number>;
  
  // Employment Analytics
  employmentStats?: Record<string, number>;
  industryDistribution?: Record<string, number>;
  
  // Housing Analytics
  housingStats?: Record<string, number>;
  householdSize?: number;
  medianHomeValue?: number;
  
  // Race & Ethnicity
  raceEthnicity?: Record<string, number>;
  
  // Geographic
  populationDensity?: number;
  geographicLevel?: string;
  fipsState?: string;
  fipsCounty?: string;
  fipsTract?: string;
}

// Location demographics cache - stores Census API responses
export const locationDemographicsCache = pgTable('location_demographics_cache', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Geographic identifiers
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  stateCode: varchar('state_code', { length: 2 }),
  zipCode: varchar('zip_code', { length: 10 }),
  
  // Census geography identifiers
  fipsState: varchar('fips_state', { length: 2 }),
  fipsCounty: varchar('fips_county', { length: 3 }),
  fipsTract: varchar('fips_tract', { length: 6 }),
  geographicLevel: varchar('geographic_level', { length: 20 }),
  
  // Trade area configuration
  radiusMiles: real('radius_miles'), // null = point location
  
  // Demographic data (full Census response)
  demographicData: jsonb('demographic_data').notNull(),
  
  // Cache management
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('loc_demo_cache_org_idx').on(table.orgId),
  coordsIdx: index('loc_demo_cache_coords_idx').on(table.latitude, table.longitude),
  stateIdx: index('loc_demo_cache_state_idx').on(table.stateCode),
  uniqueLocation: unique('loc_demo_cache_unique').on(table.orgId, table.latitude, table.longitude, table.radiusMiles),
}));

export const insertLocationDemographicsCacheSchema = createInsertSchema(locationDemographicsCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LocationDemographicsCache = typeof locationDemographicsCache.$inferSelect;
export type InsertLocationDemographicsCache = z.infer<typeof insertLocationDemographicsCacheSchema>;

// Demographic Project Locations - stores location configurations per modeling project
export const demographicProjectLocations = pgTable('demographic_project_locations', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Location data
  address: text('address').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  label: varchar('label', { length: 100 }),
  
  // Trade area configuration
  analysisMode: varchar('analysis_mode', { length: 20 }).notNull().default('distance'), // 'distance' | 'drivetime'
  distanceRings: jsonb('distance_rings').notNull().default(sql`'[1]'::jsonb`), // Array of miles: [1, 3, 5, 10]
  driveTimes: jsonb('drive_times').notNull().default(sql`'[]'::jsonb`), // Array of minutes: [5, 10, 15, 20]
  
  // Display order
  sortOrder: integer('sort_order').default(0),
  
  // Metadata
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('demo_proj_loc_org_idx').on(table.orgId),
  projectIdx: index('demo_proj_loc_project_idx').on(table.modelingProjectId),
  uniqueLocation: unique('demo_proj_loc_unique').on(table.modelingProjectId, table.latitude, table.longitude),
}));

export const insertDemographicProjectLocationSchema = createInsertSchema(demographicProjectLocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DemographicProjectLocation = typeof demographicProjectLocations.$inferSelect;
export type InsertDemographicProjectLocation = z.infer<typeof insertDemographicProjectLocationSchema>;

// ============================================================================
// Background Jobs - Job Queue for Heavy Analytics and Processing Tasks
// ============================================================================
export const backgroundJobs = pgTable('background_jobs', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  priority: integer('priority').notNull().default(2),
  
  payload: jsonb('payload').notNull().default(sql`'{}'`),
  result: jsonb('result'),
  error: text('error'),
  
  orgId: varchar('org_id').references(() => organizations.id),
  userId: varchar('user_id').references(() => users.id),
  
  scheduledFor: timestamp('scheduled_for').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  
  maxRetries: integer('max_retries').notNull().default(3),
  retryCount: integer('retry_count').notNull().default(0),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  typeIdx: index('bg_jobs_type_idx').on(table.type),
  statusIdx: index('bg_jobs_status_idx').on(table.status),
  priorityIdx: index('bg_jobs_priority_idx').on(table.priority),
  orgIdx: index('bg_jobs_org_idx').on(table.orgId),
  scheduledIdx: index('bg_jobs_scheduled_idx').on(table.scheduledFor),
  statusScheduledIdx: index('bg_jobs_status_scheduled_idx').on(table.status, table.scheduledFor),
}));

export const insertBackgroundJobSchema = createInsertSchema(backgroundJobs).omit({
  createdAt: true,
  updatedAt: true,
});

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type InsertBackgroundJob = z.infer<typeof insertBackgroundJobSchema>;

// ============================================================================
// CROSS-MODULE INTEGRATION LAYER
// Enables full connectivity between CRM, Sales Comps, Rate Comps, DD, VDR, and Modeling
// ============================================================================

// Deal-to-Sales Comps Junction - Many-to-many for comparable analysis
export const dealSalesComps = pgTable('deal_sales_comps', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  dealId: varchar('deal_id').notNull().references(() => crmDeals.id, { onDelete: 'cascade' }),
  salesCompId: varchar('sales_comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  
  // Comparison metadata
  relevanceScore: integer('relevance_score'), // 0-100 relevance scoring
  isPrimary: boolean('is_primary').default(false), // Primary comparable
  notes: text('notes'),
  comparisonType: varchar('comparison_type', { length: 50 }).default('similar'), // similar, aspirational, market_floor, market_ceiling
  
  // Auto-calculated similarity metrics
  distanceMiles: real('distance_miles'), // Geographic distance
  priceDifferencePercent: real('price_difference_percent'),
  sizeDifferencePercent: real('size_difference_percent'),
  
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('deal_sales_comps_org_idx').on(table.orgId),
  dealIdx: index('deal_sales_comps_deal_idx').on(table.dealId),
  compIdx: index('deal_sales_comps_comp_idx').on(table.salesCompId),
  uniqueDealComp: unique('deal_sales_comps_unique').on(table.dealId, table.salesCompId),
}));

export const insertDealSalesCompSchema = createInsertSchema(dealSalesComps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DealSalesComp = typeof dealSalesComps.$inferSelect;
export type InsertDealSalesComp = z.infer<typeof insertDealSalesCompSchema>;

// Deal-to-Rate Comps Junction - Many-to-many for rate benchmarking
export const dealRateComps = pgTable('deal_rate_comps', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  dealId: varchar('deal_id').notNull().references(() => crmDeals.id, { onDelete: 'cascade' }),
  rateCompId: varchar('rate_comp_id').notNull().references(() => rateComps.id, { onDelete: 'cascade' }),
  
  // Comparison metadata
  relevanceScore: integer('relevance_score'), // 0-100 relevance scoring
  isPrimary: boolean('is_primary').default(false),
  notes: text('notes'),
  comparisonType: varchar('comparison_type', { length: 50 }).default('benchmark'), // benchmark, premium, discount, market_rate
  
  // Rate comparison metrics
  rateVariancePercent: real('rate_variance_percent'),
  occupancyComparison: real('occupancy_comparison'),
  
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('deal_rate_comps_org_idx').on(table.orgId),
  dealIdx: index('deal_rate_comps_deal_idx').on(table.dealId),
  compIdx: index('deal_rate_comps_comp_idx').on(table.rateCompId),
  uniqueDealComp: unique('deal_rate_comps_unique').on(table.dealId, table.rateCompId),
}));

export const insertDealRateCompSchema = createInsertSchema(dealRateComps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DealRateComp = typeof dealRateComps.$inferSelect;
export type InsertDealRateComp = z.infer<typeof insertDealRateCompSchema>;

// Deal-to-VDR Links - Connect CRM deals directly to VDR folders
export const dealVdrLinks = pgTable('deal_vdr_links', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  dealId: varchar('deal_id').notNull().references(() => crmDeals.id, { onDelete: 'cascade' }),
  vdrFolderId: varchar('vdr_folder_id').notNull().references(() => vdrFolders.id, { onDelete: 'cascade' }),
  
  // Link metadata
  linkType: varchar('link_type', { length: 50 }).notNull().default('deal_room'), // deal_room, due_diligence, closing, archive
  isActive: boolean('is_active').notNull().default(true),
  
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('deal_vdr_links_org_idx').on(table.orgId),
  dealIdx: index('deal_vdr_links_deal_idx').on(table.dealId),
  vdrIdx: index('deal_vdr_links_vdr_idx').on(table.vdrFolderId),
  uniqueDealVdr: unique('deal_vdr_links_unique').on(table.dealId, table.vdrFolderId),
}));

export const insertDealVdrLinkSchema = createInsertSchema(dealVdrLinks).omit({
  id: true,
  createdAt: true,
});

export type DealVdrLink = typeof dealVdrLinks.$inferSelect;
export type InsertDealVdrLink = z.infer<typeof insertDealVdrLinkSchema>;

// CRM Deal to DD Project Conversion Tracking
export const dealDdConversions = pgTable('deal_dd_conversions', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  dealId: varchar('deal_id').notNull().references(() => crmDeals.id),
  ddProjectId: varchar('dd_project_id').notNull().references(() => projects.id),
  
  // Conversion metadata
  conversionType: varchar('conversion_type', { length: 50 }).notNull().default('manual'), // manual, automated, api
  conversionStatus: varchar('conversion_status', { length: 50 }).notNull().default('completed'), // pending, completed, failed, rolled_back
  
  // What was migrated
  contactsMigrated: integer('contacts_migrated').default(0),
  documentsMigrated: integer('documents_migrated').default(0),
  taskTemplateUsed: varchar('task_template_used'),
  
  // VDR auto-creation
  vdrFolderCreated: boolean('vdr_folder_created').default(false),
  vdrFolderId: varchar('vdr_folder_id').references(() => vdrFolders.id),
  vdrTemplateUsed: varchar('vdr_template_used'),
  
  // Audit trail
  convertedBy: varchar('converted_by').notNull().references(() => users.id),
  convertedAt: timestamp('converted_at').notNull().defaultNow(),
  rollbackAt: timestamp('rollback_at'),
  rollbackBy: varchar('rollback_by').references(() => users.id),
  rollbackReason: text('rollback_reason'),
  
  notes: text('notes'),
  metadata: jsonb('metadata').default(sql`'{}'`),
}, (table) => ({
  orgIdx: index('deal_dd_conversions_org_idx').on(table.orgId),
  dealIdx: index('deal_dd_conversions_deal_idx').on(table.dealId),
  projectIdx: index('deal_dd_conversions_project_idx').on(table.ddProjectId),
  statusIdx: index('deal_dd_conversions_status_idx').on(table.conversionStatus),
  uniqueConversion: unique('deal_dd_conversions_unique').on(table.dealId, table.ddProjectId),
}));

export const insertDealDdConversionSchema = createInsertSchema(dealDdConversions).omit({
  id: true,
  convertedAt: true,
});

export type DealDdConversion = typeof dealDdConversions.$inferSelect;
export type InsertDealDdConversion = z.infer<typeof insertDealDdConversionSchema>;

// Property-to-Sales Comps Junction - Link CRM properties to sales comps
export const propertySalesComps = pgTable('property_sales_comps', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  propertyId: varchar('property_id').notNull().references(() => crmProperties.id, { onDelete: 'cascade' }),
  salesCompId: varchar('sales_comp_id').notNull().references(() => salesComps.id, { onDelete: 'cascade' }),
  
  // Comparison metadata
  relevanceScore: integer('relevance_score'),
  isPrimary: boolean('is_primary').default(false),
  notes: text('notes'),
  
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('property_sales_comps_org_idx').on(table.orgId),
  propertyIdx: index('property_sales_comps_property_idx').on(table.propertyId),
  compIdx: index('property_sales_comps_comp_idx').on(table.salesCompId),
  uniquePropertyComp: unique('property_sales_comps_unique').on(table.propertyId, table.salesCompId),
}));

export const insertPropertySalesCompSchema = createInsertSchema(propertySalesComps).omit({
  id: true,
  createdAt: true,
});

export type PropertySalesComp = typeof propertySalesComps.$inferSelect;
export type InsertPropertySalesComp = z.infer<typeof insertPropertySalesCompSchema>;

// Property-to-Rate Comps Junction
export const propertyRateComps = pgTable('property_rate_comps', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  propertyId: varchar('property_id').notNull().references(() => crmProperties.id, { onDelete: 'cascade' }),
  rateCompId: varchar('rate_comp_id').notNull().references(() => rateComps.id, { onDelete: 'cascade' }),
  
  // Comparison metadata
  relevanceScore: integer('relevance_score'),
  isPrimary: boolean('is_primary').default(false),
  notes: text('notes'),
  
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('property_rate_comps_org_idx').on(table.orgId),
  propertyIdx: index('property_rate_comps_property_idx').on(table.propertyId),
  compIdx: index('property_rate_comps_comp_idx').on(table.rateCompId),
  uniquePropertyComp: unique('property_rate_comps_unique').on(table.propertyId, table.rateCompId),
}));

export const insertPropertyRateCompSchema = createInsertSchema(propertyRateComps).omit({
  id: true,
  createdAt: true,
});

export type PropertyRateComp = typeof propertyRateComps.$inferSelect;
export type InsertPropertyRateComp = z.infer<typeof insertPropertyRateCompSchema>;

// Modeling Project to Comps Integration - Track multiple comps per modeling project
export const modelingProjectComps = pgTable('modeling_project_comps', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Can reference either sales comp or rate comp
  salesCompId: varchar('sales_comp_id').references(() => salesComps.id, { onDelete: 'cascade' }),
  rateCompId: varchar('rate_comp_id').references(() => rateComps.id, { onDelete: 'cascade' }),
  
  // Comparison metadata
  compType: varchar('comp_type', { length: 20 }).notNull(), // 'sales' or 'rate'
  relevanceScore: integer('relevance_score'),
  isPrimary: boolean('is_primary').default(false),
  usedInValuation: boolean('used_in_valuation').default(false), // Whether used in cap rate or valuation calc
  weight: real('weight').default(1.0), // Weighting for blended analysis
  notes: text('notes'),
  
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('modeling_project_comps_org_idx').on(table.orgId),
  projectIdx: index('modeling_project_comps_project_idx').on(table.modelingProjectId),
  salesCompIdx: index('modeling_project_comps_sales_idx').on(table.salesCompId),
  rateCompIdx: index('modeling_project_comps_rate_idx').on(table.rateCompId),
}));

export const insertModelingProjectCompSchema = createInsertSchema(modelingProjectComps).omit({
  id: true,
  createdAt: true,
});

export type ModelingProjectComp = typeof modelingProjectComps.$inferSelect;
export type InsertModelingProjectComp = z.infer<typeof insertModelingProjectCompSchema>;

// Modeling Financial Periods - Schema and Types
export const insertModelingFinancialPeriodSchema = createInsertSchema(modelingFinancialPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateModelingFinancialPeriodSchema = insertModelingFinancialPeriodSchema.partial();

export type ModelingFinancialPeriod = typeof modelingFinancialPeriods.$inferSelect;
export type InsertModelingFinancialPeriod = z.infer<typeof insertModelingFinancialPeriodSchema>;
export type UpdateModelingFinancialPeriod = z.infer<typeof updateModelingFinancialPeriodSchema>;

// Modeling Period Adjustments - Schema and Types
export const insertModelingPeriodAdjustmentSchema = createInsertSchema(modelingPeriodAdjustments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateModelingPeriodAdjustmentSchema = insertModelingPeriodAdjustmentSchema.partial();

export type ModelingPeriodAdjustment = typeof modelingPeriodAdjustments.$inferSelect;
export type InsertModelingPeriodAdjustment = z.infer<typeof insertModelingPeriodAdjustmentSchema>;
export type UpdateModelingPeriodAdjustment = z.infer<typeof updateModelingPeriodAdjustmentSchema>;

// Cross-Module Audit Trail - Track all cross-module operations
export const crossModuleAuditLog = pgTable('cross_module_audit_log', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  
  // Source and target modules
  sourceModule: varchar('source_module', { length: 50 }).notNull(), // crm, sales_comps, rate_comps, dd, vdr, modeling
  targetModule: varchar('target_module', { length: 50 }).notNull(),
  
  // Entity references
  sourceEntityType: varchar('source_entity_type', { length: 50 }).notNull(), // deal, property, project, folder, etc.
  sourceEntityId: varchar('source_entity_id').notNull(),
  targetEntityType: varchar('target_entity_type', { length: 50 }).notNull(),
  targetEntityId: varchar('target_entity_id').notNull(),
  
  // Action details
  action: varchar('action', { length: 50 }).notNull(), // link, unlink, convert, sync, import, export
  actionStatus: varchar('action_status', { length: 20 }).notNull().default('completed'), // pending, completed, failed
  
  // Context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata').default(sql`'{}'`),
  errorMessage: text('error_message'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('cross_module_audit_org_idx').on(table.orgId),
  userIdx: index('cross_module_audit_user_idx').on(table.userId),
  sourceIdx: index('cross_module_audit_source_idx').on(table.sourceModule, table.sourceEntityType, table.sourceEntityId),
  targetIdx: index('cross_module_audit_target_idx').on(table.targetModule, table.targetEntityType, table.targetEntityId),
  createdIdx: index('cross_module_audit_created_idx').on(table.createdAt),
}));

export const insertCrossModuleAuditLogSchema = createInsertSchema(crossModuleAuditLog).omit({
  id: true,
  createdAt: true,
});

export type CrossModuleAuditLog = typeof crossModuleAuditLog.$inferSelect;
export type InsertCrossModuleAuditLog = z.infer<typeof insertCrossModuleAuditLogSchema>;

// ============================================================================
// Target Demographics - User-defined demographic criteria for site suitability scoring
// ============================================================================
export const targetDemographics = pgTable('target_demographics', {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  userId: varchar('user_id').notNull().references(() => users.id),
  
  // Optional project-specific override (null = organization-wide default)
  projectId: varchar('project_id').references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Target ranges for demographic criteria (null = not considered in scoring)
  medianAgeMin: real('median_age_min'),
  medianAgeMax: real('median_age_max'),
  medianIncomeMin: real('median_income_min'),
  medianIncomeMax: real('median_income_max'),
  populationDensityMin: real('population_density_min'),
  populationDensityMax: real('population_density_max'),
  householdSizeMin: real('household_size_min'),
  householdSizeMax: real('household_size_max'),
  educationBachelorsMin: real('education_bachelors_min'), // Percentage with Bachelor's+
  educationBachelorsMax: real('education_bachelors_max'),
  employmentRateMin: real('employment_rate_min'),
  employmentRateMax: real('employment_rate_max'),
  homeValueMin: real('home_value_min'),
  homeValueMax: real('home_value_max'),
  
  // Criterion weights (0-1 scale, null = equal weighting)
  weights: jsonb('weights').default(sql`'{}'`),
  
  // Metadata
  name: varchar('name', { length: 100 }), // Optional name for this target profile
  description: text('description'),
  isDefault: boolean('is_default').default(false), // Whether this is the user's default profile
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgIdx: index('target_demographics_org_idx').on(table.orgId),
  userIdx: index('target_demographics_user_idx').on(table.userId),
  projectIdx: index('target_demographics_project_idx').on(table.projectId),
  defaultIdx: index('target_demographics_default_idx').on(table.orgId, table.userId, table.isDefault),
}));

export const insertTargetDemographicsSchema = createInsertSchema(targetDemographics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TargetDemographics = typeof targetDemographics.$inferSelect;
export type InsertTargetDemographics = z.infer<typeof insertTargetDemographicsSchema>;

// ============================================================================
// PE FUND MANAGEMENT
// Fund lifecycle tracking with committed capital, allocations, investor accounts,
// cash flow ledger, waterfall distributions, and fund-level IRR/TVPI calculations
// ============================================================================

export const fundStatusEnum = pgEnum("fund_status", ["raising", "investing", "harvesting", "closed", "liquidated"]);
export const fundInvestorTypeEnum = pgEnum("fund_investor_type", ["gp", "lp", "co_invest", "feeder", "fund_of_funds", "anchor"]);
export const capitalMovementTypeEnum = pgEnum("capital_movement_type", ["call", "contribution", "distribution", "recycling", "return_of_capital", "fee", "expense"]);
export const waterfallStyleEnum = pgEnum("waterfall_style", ["european", "american", "deal_by_deal"]);

// Funds - Master fund entity for PE/real estate funds
export const funds = pgTable('funds', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Fund identity
  name: text('name').notNull(),
  shortName: varchar('short_name', { length: 50 }),
  description: text('description'),
  fundNumber: integer('fund_number'), // e.g., "Fund III"
  status: fundStatusEnum('status').notNull().default('raising'),
  
  // Fund sizing
  targetSize: decimal('target_size', { precision: 18, scale: 2 }),
  hardCap: decimal('hard_cap', { precision: 18, scale: 2 }),
  committedCapital: decimal('committed_capital', { precision: 18, scale: 2 }).default('0'),
  calledCapital: decimal('called_capital', { precision: 18, scale: 2 }).default('0'),
  distributedCapital: decimal('distributed_capital', { precision: 18, scale: 2 }).default('0'),
  recycledCapital: decimal('recycled_capital', { precision: 18, scale: 2 }).default('0'),
  
  // Fund timeline
  vintage: integer('vintage').notNull(), // Year of first close
  firstCloseDate: timestamp('first_close_date'),
  finalCloseDate: timestamp('final_close_date'),
  investmentPeriodYears: integer('investment_period_years').default(4),
  fundLifeYears: integer('fund_life_years').default(10),
  extensionYears: integer('extension_years').default(2),
  
  // Fees
  managementFeePct: decimal('management_fee_pct', { precision: 6, scale: 4 }).default('0.02'),
  managementFeeBase: text('management_fee_base').default('committed'), // 'committed', 'called', 'invested', 'nav'
  carriedInterestPct: decimal('carried_interest_pct', { precision: 6, scale: 4 }).default('0.20'),
  
  // Waterfall configuration (fund-level defaults)
  waterfallStyle: waterfallStyleEnum('waterfall_style').default('european'),
  preferredReturn: decimal('preferred_return', { precision: 8, scale: 4 }).default('0.08'),
  gpCatchUpPct: decimal('gp_catch_up_pct', { precision: 6, scale: 4 }).default('1.00'), // 100% catch-up until GP at promote %
  
  // Multi-tier promote structure (fund-level)
  promoteTiers: jsonb('promote_tiers').$type<{
    irrHurdle: number;
    gpSplit: number;
    lpSplit: number;
  }[]>().default([
    { irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 },
    { irrHurdle: 0.12, gpSplit: 0.25, lpSplit: 0.75 },
    { irrHurdle: 0.18, gpSplit: 0.30, lpSplit: 0.70 },
  ]),
  
  // Recycling provisions
  recyclingAllowed: boolean('recycling_allowed').default(true),
  recyclingLimitPct: decimal('recycling_limit_pct', { precision: 6, scale: 4 }).default('0.25'), // % of committed
  recyclingPeriodMonths: integer('recycling_period_months').default(48),
  
  // Investment guidelines
  maxSingleInvestmentPct: decimal('max_single_investment_pct', { precision: 6, scale: 4 }).default('0.20'),
  minInvestmentSize: decimal('min_investment_size', { precision: 18, scale: 2 }),
  maxInvestmentSize: decimal('max_investment_size', { precision: 18, scale: 2 }),
  geographicFocus: text('geographic_focus'),
  sectorFocus: text('sector_focus'),
  
  // Performance metrics (denormalized for dashboard)
  grossIrr: decimal('gross_irr', { precision: 8, scale: 4 }),
  netIrr: decimal('net_irr', { precision: 8, scale: 4 }),
  grossMoic: decimal('gross_moic', { precision: 8, scale: 4 }),
  netMoic: decimal('net_moic', { precision: 8, scale: 4 }),
  tvpi: decimal('tvpi', { precision: 8, scale: 4 }), // Total Value to Paid-In
  dpi: decimal('dpi', { precision: 8, scale: 4 }), // Distributions to Paid-In
  rvpi: decimal('rvpi', { precision: 8, scale: 4 }), // Residual Value to Paid-In
  pme: decimal('pme', { precision: 8, scale: 4 }), // Public Market Equivalent
  
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('funds_org_idx').on(table.orgId),
  statusIdx: index('funds_status_idx').on(table.status),
  vintageIdx: index('funds_vintage_idx').on(table.vintage),
}));

// Fund Investors - LP/GP commitments and capital accounts
export const fundInvestors = pgTable('fund_investors', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  fundId: varchar('fund_id').notNull().references(() => funds.id, { onDelete: 'cascade' }),
  
  // Investor identity
  investorName: text('investor_name').notNull(),
  investorType: fundInvestorTypeEnum('investor_type').notNull(),
  legalEntityName: text('legal_entity_name'),
  taxId: varchar('tax_id', { length: 50 }),
  
  // CRM integration
  crmContactId: varchar('crm_contact_id').references(() => crmContacts.id),
  crmCompanyId: varchar('crm_company_id').references(() => crmCompanies.id),
  
  // Commitment
  commitmentAmount: decimal('commitment_amount', { precision: 18, scale: 2 }).notNull(),
  commitmentDate: timestamp('commitment_date'),
  commitmentPct: decimal('commitment_pct', { precision: 8, scale: 6 }), // % of total fund
  
  // Capital account (running balances)
  calledCapital: decimal('called_capital', { precision: 18, scale: 2 }).default('0'),
  unfundedCommitment: decimal('unfunded_commitment', { precision: 18, scale: 2 }),
  distributedCapital: decimal('distributed_capital', { precision: 18, scale: 2 }).default('0'),
  returnedCapital: decimal('return_of_capital', { precision: 18, scale: 2 }).default('0'),
  preferredReturnAccrued: decimal('preferred_return_accrued', { precision: 18, scale: 2 }).default('0'),
  preferredReturnPaid: decimal('preferred_return_paid', { precision: 18, scale: 2 }).default('0'),
  capitalAccountBalance: decimal('capital_account_balance', { precision: 18, scale: 2 }).default('0'),
  
  // Carried interest (for GPs)
  carriedInterestPct: decimal('carried_interest_pct', { precision: 8, scale: 4 }),
  carriedInterestEarned: decimal('carried_interest_earned', { precision: 18, scale: 2 }).default('0'),
  carriedInterestPaid: decimal('carried_interest_paid', { precision: 18, scale: 2 }).default('0'),
  
  // Side letter terms
  hasReducedFees: boolean('has_reduced_fees').default(false),
  feeDiscount: decimal('fee_discount', { precision: 6, scale: 4 }),
  hasMfn: boolean('has_mfn').default(false), // Most Favored Nation
  coInvestRights: text('co_invest_rights'), // 'pro_rata', 'negotiated', 'none'
  
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fund_investors_org_idx').on(table.orgId),
  fundIdx: index('fund_investors_fund_idx').on(table.fundId),
  typeIdx: index('fund_investors_type_idx').on(table.investorType),
}));

// Fund Deal Allocations - Link funds to modeling projects
export const fundDealAllocations = pgTable('fund_deal_allocations', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  fundId: varchar('fund_id').notNull().references(() => funds.id, { onDelete: 'cascade' }),
  modelingProjectId: varchar('modeling_project_id').notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  
  // Allocation details
  allocationPct: decimal('allocation_pct', { precision: 8, scale: 6 }).notNull(), // Fund's share of deal
  allocatedEquity: decimal('allocated_equity', { precision: 18, scale: 2 }).notNull(),
  fundedAmount: decimal('funded_amount', { precision: 18, scale: 2 }).default('0'),
  
  // Basis tracking
  costBasis: decimal('cost_basis', { precision: 18, scale: 2 }),
  currentValue: decimal('current_value', { precision: 18, scale: 2 }),
  unrealizedGain: decimal('unrealized_gain', { precision: 18, scale: 2 }),
  realizedGain: decimal('realized_gain', { precision: 18, scale: 2 }).default('0'),
  
  // Deal-level returns
  dealIrr: decimal('deal_irr', { precision: 8, scale: 4 }),
  dealMoic: decimal('deal_moic', { precision: 8, scale: 4 }),
  
  // Timing
  investmentDate: timestamp('investment_date'),
  expectedExitDate: timestamp('expected_exit_date'),
  actualExitDate: timestamp('actual_exit_date'),
  exitStatus: varchar('exit_status', { length: 20 }).default('active'), // active, exited, written_off
  
  // Capital stack inheritance
  usesFundCapitalStack: boolean('uses_fund_capital_stack').default(true),
  capitalStackTemplateId: varchar('capital_stack_template_id').references(() => fundCapitalStackTemplates.id),
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fund_deal_allocations_org_idx').on(table.orgId),
  fundIdx: index('fund_deal_allocations_fund_idx').on(table.fundId),
  projectIdx: index('fund_deal_allocations_project_idx').on(table.modelingProjectId),
  uniqueFundProject: unique('fund_deal_allocations_unique').on(table.fundId, table.modelingProjectId),
}));

// Fund Capital Movements - Cash flow ledger for calls, contributions, distributions
export const fundCapitalMovements = pgTable('fund_capital_movements', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  fundId: varchar('fund_id').notNull().references(() => funds.id, { onDelete: 'cascade' }),
  fundInvestorId: varchar('fund_investor_id').references(() => fundInvestors.id, { onDelete: 'cascade' }),
  
  // Movement details
  movementType: capitalMovementTypeEnum('movement_type').notNull(),
  movementDate: timestamp('movement_date').notNull(),
  dueDate: timestamp('due_date'),
  
  // Amounts
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  preferredReturn: decimal('preferred_return', { precision: 18, scale: 2 }).default('0'),
  returnOfCapital: decimal('return_of_capital', { precision: 18, scale: 2 }).default('0'),
  carriedInterest: decimal('carried_interest', { precision: 18, scale: 2 }).default('0'),
  
  // Deal attribution
  dealAllocationId: varchar('deal_allocation_id').references(() => fundDealAllocations.id),
  
  // Recycling tracking
  isRecyclable: boolean('is_recyclable').default(false),
  recycledAmount: decimal('recycled_amount', { precision: 18, scale: 2 }).default('0'),
  
  // Call specifics
  callNumber: integer('call_number'),
  callPurpose: text('call_purpose'), // 'investment', 'fees', 'expenses'
  
  // Status
  status: varchar('status', { length: 20 }).default('pending'), // pending, completed, cancelled
  
  description: text('description'),
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fund_capital_movements_org_idx').on(table.orgId),
  fundIdx: index('fund_capital_movements_fund_idx').on(table.fundId),
  investorIdx: index('fund_capital_movements_investor_idx').on(table.fundInvestorId),
  dateIdx: index('fund_capital_movements_date_idx').on(table.movementDate),
  typeIdx: index('fund_capital_movements_type_idx').on(table.movementType),
}));

// Fund Cash Flows - Consolidated dated cash flows for IRR calculation
export const fundCashFlows = pgTable('fund_cash_flows', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  fundId: varchar('fund_id').notNull().references(() => funds.id, { onDelete: 'cascade' }),
  
  // Cash flow details
  flowDate: timestamp('flow_date').notNull(),
  flowType: varchar('flow_type', { length: 20 }).notNull(), // 'inflow' or 'outflow'
  
  // Amounts (negative = outflow from investor, positive = inflow to investor)
  grossAmount: decimal('gross_amount', { precision: 18, scale: 2 }).notNull(),
  netAmount: decimal('net_amount', { precision: 18, scale: 2 }).notNull(),
  
  // Breakdowns
  investmentAmount: decimal('investment_amount', { precision: 18, scale: 2 }).default('0'),
  managementFees: decimal('management_fees', { precision: 18, scale: 2 }).default('0'),
  expenses: decimal('expenses', { precision: 18, scale: 2 }).default('0'),
  preferredReturn: decimal('preferred_return', { precision: 18, scale: 2 }).default('0'),
  returnOfCapital: decimal('return_of_capital', { precision: 18, scale: 2 }).default('0'),
  gainDistribution: decimal('gain_distribution', { precision: 18, scale: 2 }).default('0'),
  carriedInterest: decimal('carried_interest', { precision: 18, scale: 2 }).default('0'),
  
  // Running balances (for performance calculation)
  cumulativeContributions: decimal('cumulative_contributions', { precision: 18, scale: 2 }),
  cumulativeDistributions: decimal('cumulative_distributions', { precision: 18, scale: 2 }),
  runningNav: decimal('running_nav', { precision: 18, scale: 2 }),
  
  // Attribution
  dealAllocationId: varchar('deal_allocation_id').references(() => fundDealAllocations.id),
  capitalMovementId: varchar('capital_movement_id').references(() => fundCapitalMovements.id),
  
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fund_cash_flows_org_idx').on(table.orgId),
  fundIdx: index('fund_cash_flows_fund_idx').on(table.fundId),
  dateIdx: index('fund_cash_flows_date_idx').on(table.flowDate),
}));

// Fund Capital Stack Templates - Reusable capital structure for deals
export const fundCapitalStackTemplates = pgTable('fund_capital_stack_templates', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  fundId: varchar('fund_id').references(() => funds.id, { onDelete: 'cascade' }),
  
  name: text('name').notNull(),
  description: text('description'),
  isDefault: boolean('is_default').default(false),
  
  // Default leverage assumptions
  targetLtv: decimal('target_ltv', { precision: 6, scale: 4 }).default('0.65'),
  
  // Debt template
  debtTemplates: jsonb('debt_templates').$type<{
    name: string;
    trancheType: string;
    interestRate: number;
    termYears: number;
    amortizationYears: number | null;
    interestOnlyMonths: number;
    principalPct: number; // % of total debt
    priority: number;
  }[]>(),
  
  // Equity template
  equityTemplates: jsonb('equity_templates').$type<{
    name: string;
    layerType: string;
    investorType: string;
    ownershipPct: number;
    preferredReturn: number | null;
    preferredReturnType: string | null;
    isParticipating: boolean;
    waterfallPriority: number;
    promoteTiers?: { irrHurdle: number; gpSplit: number; lpSplit: number }[];
  }[]>(),
  
  // Waterfall configuration
  waterfallStyle: waterfallStyleEnum('waterfall_style').default('european'),
  preferredReturn: decimal('preferred_return', { precision: 8, scale: 4 }).default('0.08'),
  gpCatchUpPct: decimal('gp_catch_up_pct', { precision: 6, scale: 4 }).default('1.00'),
  promoteTiers: jsonb('promote_tiers').$type<{
    irrHurdle: number;
    gpSplit: number;
    lpSplit: number;
  }[]>(),
  
  createdBy: varchar('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fund_capital_stack_templates_org_idx').on(table.orgId),
  fundIdx: index('fund_capital_stack_templates_fund_idx').on(table.fundId),
}));

// Fund Waterfall Calculations - Stored waterfall tier calculations
export const fundWaterfallCalculations = pgTable('fund_waterfall_calculations', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  fundId: varchar('fund_id').notNull().references(() => funds.id, { onDelete: 'cascade' }),
  
  calculationDate: timestamp('calculation_date').notNull(),
  periodEnd: timestamp('period_end'),
  
  // Total values
  totalContributions: decimal('total_contributions', { precision: 18, scale: 2 }),
  totalDistributions: decimal('total_distributions', { precision: 18, scale: 2 }),
  unrealizedValue: decimal('unrealized_value', { precision: 18, scale: 2 }),
  totalValue: decimal('total_value', { precision: 18, scale: 2 }),
  
  // Waterfall tiers
  returnOfCapital: decimal('return_of_capital', { precision: 18, scale: 2 }),
  preferredReturnAmount: decimal('preferred_return_amount', { precision: 18, scale: 2 }),
  gpCatchUp: decimal('gp_catch_up', { precision: 18, scale: 2 }),
  
  // Promote tier breakdown
  promoteTierBreakdown: jsonb('promote_tier_breakdown').$type<{
    tier: number;
    irrHurdle: number;
    lpAmount: number;
    gpAmount: number;
  }[]>(),
  
  // LP/GP split
  totalLpDistribution: decimal('total_lp_distribution', { precision: 18, scale: 2 }),
  totalGpDistribution: decimal('total_gp_distribution', { precision: 18, scale: 2 }),
  
  // Performance metrics
  grossIrr: decimal('gross_irr', { precision: 8, scale: 4 }),
  netIrr: decimal('net_irr', { precision: 8, scale: 4 }),
  tvpi: decimal('tvpi', { precision: 8, scale: 4 }),
  dpi: decimal('dpi', { precision: 8, scale: 4 }),
  rvpi: decimal('rvpi', { precision: 8, scale: 4 }),
  
  isLatest: boolean('is_latest').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('fund_waterfall_calculations_org_idx').on(table.orgId),
  fundIdx: index('fund_waterfall_calculations_fund_idx').on(table.fundId),
  dateIdx: index('fund_waterfall_calculations_date_idx').on(table.calculationDate),
  latestIdx: index('fund_waterfall_calculations_latest_idx').on(table.fundId, table.isLatest),
}));

// Insert schemas and types for Fund Management
export const insertFundSchema = createInsertSchema(funds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateFundSchema = insertFundSchema.partial();
export type Fund = typeof funds.$inferSelect;
export type InsertFund = z.infer<typeof insertFundSchema>;
export type UpdateFund = z.infer<typeof updateFundSchema>;

export const insertFundInvestorSchema = createInsertSchema(fundInvestors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateFundInvestorSchema = insertFundInvestorSchema.partial();
export type FundInvestor = typeof fundInvestors.$inferSelect;
export type InsertFundInvestor = z.infer<typeof insertFundInvestorSchema>;
export type UpdateFundInvestor = z.infer<typeof updateFundInvestorSchema>;

export const insertFundDealAllocationSchema = createInsertSchema(fundDealAllocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateFundDealAllocationSchema = insertFundDealAllocationSchema.partial();
export type FundDealAllocation = typeof fundDealAllocations.$inferSelect;
export type InsertFundDealAllocation = z.infer<typeof insertFundDealAllocationSchema>;
export type UpdateFundDealAllocation = z.infer<typeof updateFundDealAllocationSchema>;

export const insertFundCapitalMovementSchema = createInsertSchema(fundCapitalMovements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateFundCapitalMovementSchema = insertFundCapitalMovementSchema.partial();
export type FundCapitalMovement = typeof fundCapitalMovements.$inferSelect;
export type InsertFundCapitalMovement = z.infer<typeof insertFundCapitalMovementSchema>;
export type UpdateFundCapitalMovement = z.infer<typeof updateFundCapitalMovementSchema>;

export const insertFundCashFlowSchema = createInsertSchema(fundCashFlows).omit({
  id: true,
  createdAt: true,
});
export type FundCashFlow = typeof fundCashFlows.$inferSelect;
export type InsertFundCashFlow = z.infer<typeof insertFundCashFlowSchema>;

export const insertFundCapitalStackTemplateSchema = createInsertSchema(fundCapitalStackTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateFundCapitalStackTemplateSchema = insertFundCapitalStackTemplateSchema.partial();
export type FundCapitalStackTemplate = typeof fundCapitalStackTemplates.$inferSelect;
export type InsertFundCapitalStackTemplate = z.infer<typeof insertFundCapitalStackTemplateSchema>;
export type UpdateFundCapitalStackTemplate = z.infer<typeof updateFundCapitalStackTemplateSchema>;

export const insertFundWaterfallCalculationSchema = createInsertSchema(fundWaterfallCalculations).omit({
  id: true,
  createdAt: true,
});
export type FundWaterfallCalculation = typeof fundWaterfallCalculations.$inferSelect;
export type InsertFundWaterfallCalculation = z.infer<typeof insertFundWaterfallCalculationSchema>;

// ============================================================================
// MarinaMatch - Deal Sourcing & Prospecting Module
// ============================================================================

// Enums for MarinaMatch
export const dealSourceTypeEnum = pgEnum("deal_source_type", ["broker", "marketplace", "direct", "referral", "owned_network", "web_scrape", "cold_outreach"]);
export const feedStatusEnum = pgEnum("feed_status", ["active", "paused", "error", "pending_setup"]);
export const mandateStatusEnum = pgEnum("mandate_status", ["active", "paused", "archived"]);
export const sourcedDealStatusEnum = pgEnum("sourced_deal_status", ["new", "reviewing", "qualified", "disqualified", "converted", "duplicate"]);
export const brokerTierEnum = pgEnum("broker_tier", ["platinum", "gold", "silver", "bronze", "new"]);
export const marinaTypeEnum = pgEnum("marina_type", ["wet_slips", "dry_storage", "full_service", "yacht_club", "boatyard", "mixed_use", "commercial"]);

// Deal Sources - External feed configurations (brokers, marketplaces, etc.)
export const dealSources = pgTable("deal_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  sourceType: dealSourceTypeEnum("source_type").notNull(),
  // Feed configuration
  feedUrl: text("feed_url"), // RSS/API endpoint
  apiKey: text("api_key"), // Encrypted API key if needed
  feedFormat: text("feed_format").default("rss"), // rss, json, xml
  // Broker/source info
  brokerCompany: text("broker_company"),
  brokerContact: text("broker_contact"),
  brokerEmail: text("broker_email"),
  brokerPhone: text("broker_phone"),
  // Status & sync
  status: feedStatusEnum("status").notNull().default("pending_setup"),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status"),
  syncErrorCount: integer("sync_error_count").default(0),
  // Settings
  autoImport: boolean("auto_import").notNull().default(false),
  dedupeEnabled: boolean("dedupe_enabled").notNull().default(true),
  minDealSize: decimal("min_deal_size", { precision: 18, scale: 2 }),
  maxDealSize: decimal("max_deal_size", { precision: 18, scale: 2 }),
  targetRegions: text("target_regions").array(),
  // Metrics
  totalDealsImported: integer("total_deals_imported").default(0),
  totalDealsConverted: integer("total_deals_converted").default(0),
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("deal_sources_org_idx").on(table.orgId),
  statusIdx: index("deal_sources_status_idx").on(table.status),
}));

// Investment Mandates - Define investment thesis/criteria
export const investmentMandates = pgTable("investment_mandates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  status: mandateStatusEnum("status").notNull().default("active"),
  // Deal size criteria
  minDealSize: decimal("min_deal_size", { precision: 18, scale: 2 }),
  maxDealSize: decimal("max_deal_size", { precision: 18, scale: 2 }),
  // Geographic criteria
  targetStates: text("target_states").array(),
  targetRegions: text("target_regions").array(), // e.g., "Gulf Coast", "Great Lakes"
  coastalPreference: text("coastal_preference"), // "ocean", "lake", "river", "any"
  // Marina type criteria
  targetMarinaTypes: text("target_marina_types").array(),
  // Operational criteria
  minSlipCount: integer("min_slip_count"),
  maxSlipCount: integer("max_slip_count"),
  minOccupancy: decimal("min_occupancy", { precision: 5, scale: 2 }),
  minRevenue: decimal("min_revenue", { precision: 18, scale: 2 }),
  minNoi: decimal("min_noi", { precision: 18, scale: 2 }),
  // Cap rate / valuation criteria
  minCapRate: decimal("min_cap_rate", { precision: 5, scale: 2 }),
  maxCapRate: decimal("max_cap_rate", { precision: 5, scale: 2 }),
  // Required amenities/features
  requiredAmenities: text("required_amenities").array(),
  excludedAttributes: text("excluded_attributes").array(), // Things to avoid
  // Priority & scoring weights
  priority: integer("priority").default(1), // 1 = highest
  sizeWeight: integer("size_weight").default(20), // % weight for scoring
  locationWeight: integer("location_weight").default(25),
  typeWeight: integer("type_weight").default(15),
  operationsWeight: integer("operations_weight").default(25),
  valuationWeight: integer("valuation_weight").default(15),
  // Fund association (optional)
  fundId: varchar("fund_id").references(() => funds.id),
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("investment_mandates_org_idx").on(table.orgId),
  statusIdx: index("investment_mandates_status_idx").on(table.status),
  fundIdx: index("investment_mandates_fund_idx").on(table.fundId),
}));

// Broker Relationships - Track broker contacts and performance
export const brokerRelationships = pgTable("broker_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  // Broker info
  companyName: text("company_name").notNull(),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  website: text("website"),
  // Classification
  tier: brokerTierEnum("tier").notNull().default("new"),
  specializations: text("specializations").array(), // e.g., "marinas", "yacht clubs", "commercial"
  regions: text("regions").array(), // Geographic coverage
  // Relationship details
  relationshipStartDate: date("relationship_start_date"),
  lastContactDate: date("last_contact_date"),
  preferredContactMethod: text("preferred_contact_method").default("email"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }), // Standard rate
  // Performance metrics
  totalDealsSubmitted: integer("total_deals_submitted").default(0),
  totalDealsConverted: integer("total_deals_converted").default(0),
  totalDealValue: decimal("total_deal_value", { precision: 18, scale: 2 }).default("0"),
  avgDealQuality: decimal("avg_deal_quality", { precision: 5, scale: 2 }), // 0-100 score
  // Notes & tracking
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  // Link to CRM contact if exists (stored as integer, FK added at DB level)
  crmContactId: integer("crm_contact_id"),
  // Broker Portal - shareable link for external deal submissions
  shareToken: varchar("share_token", { length: 64 }).unique(),
  portalEnabled: boolean("portal_enabled").notNull().default(false),
  portalLastAccessedAt: timestamp("portal_last_accessed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("broker_relationships_org_idx").on(table.orgId),
  tierIdx: index("broker_relationships_tier_idx").on(table.tier),
  activeIdx: index("broker_relationships_active_idx").on(table.isActive),
  shareTokenIdx: index("broker_relationships_share_token_idx").on(table.shareToken),
}));

// Sourced Deals - Incoming deals from feeds before conversion to CRM
export const sourcedDeals = pgTable("sourced_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  // Source tracking
  dealSourceId: varchar("deal_source_id").references(() => dealSources.id),
  brokerId: varchar("broker_id").references(() => brokerRelationships.id),
  externalId: text("external_id"), // ID from source system
  sourceUrl: text("source_url"), // Original listing URL
  // Status
  status: sourcedDealStatusEnum("status").notNull().default("new"),
  // Basic deal info
  propertyName: text("property_name").notNull(),
  propertyAddress: text("property_address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  // Marina details
  marinaType: marinaTypeEnum("marina_type"),
  totalSlips: integer("total_slips"),
  wetSlips: integer("wet_slips"),
  dryStorage: integer("dry_storage"),
  // Financial info
  askingPrice: decimal("asking_price", { precision: 18, scale: 2 }),
  grossRevenue: decimal("gross_revenue", { precision: 18, scale: 2 }),
  noi: decimal("noi", { precision: 18, scale: 2 }),
  capRate: decimal("cap_rate", { precision: 5, scale: 2 }),
  pricePerSlip: decimal("price_per_slip", { precision: 18, scale: 2 }),
  // Amenities & features
  amenities: text("amenities").array(),
  description: text("description"),
  // Mandate matching
  mandateScores: jsonb("mandate_scores").$type<{
    mandateId: string;
    mandateName: string;
    score: number;
    breakdown: {
      size: number;
      location: number;
      type: number;
      operations: number;
      valuation: number;
    };
  }[]>(),
  bestMandateScore: decimal("best_mandate_score", { precision: 5, scale: 2 }),
  bestMandateId: varchar("best_mandate_id"),
  // Deduplication
  dedupeHash: text("dedupe_hash"), // Hash for detecting duplicates
  isDuplicate: boolean("is_duplicate").default(false),
  duplicateOfId: varchar("duplicate_of_id"),
  // Conversion tracking (stored as integer for legacy compatibility)
  convertedToDealId: integer("converted_to_deal_id"),
  convertedAt: timestamp("converted_at"),
  convertedBy: varchar("converted_by").references(() => users.id),
  // Review tracking
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  disqualificationReason: text("disqualification_reason"),
  // Metadata
  rawData: jsonb("raw_data"), // Original data from source
  isManual: boolean("is_manual").default(false), // True if submitted via broker/manual entry
  portalSubmissionId: varchar("portal_submission_id"), // Links to broker portal submission if applicable
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("sourced_deals_org_idx").on(table.orgId),
  sourceIdx: index("sourced_deals_source_idx").on(table.dealSourceId),
  statusIdx: index("sourced_deals_status_idx").on(table.status),
  brokerIdx: index("sourced_deals_broker_idx").on(table.brokerId),
  mandateScoreIdx: index("sourced_deals_mandate_score_idx").on(table.bestMandateScore),
  dedupeIdx: index("sourced_deals_dedupe_idx").on(table.dedupeHash),
  stateIdx: index("sourced_deals_state_idx").on(table.state),
}));

// Deal Attribution - Track how CRM deals were sourced
export const dealAttributions = pgTable("deal_attributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  dealId: integer("deal_id").notNull(),
  // Attribution details
  sourceType: dealSourceTypeEnum("source_type").notNull(),
  dealSourceId: varchar("deal_source_id").references(() => dealSources.id),
  brokerId: varchar("broker_id").references(() => brokerRelationships.id),
  sourcedDealId: varchar("sourced_deal_id").references(() => sourcedDeals.id),
  // For referrals
  referredBy: text("referred_by"),
  referralContact: text("referral_contact"),
  // For direct/cold outreach
  outreachCampaignId: varchar("outreach_campaign_id"),
  initialContactDate: date("initial_contact_date"),
  // Commission tracking
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }),
  commissionAmount: decimal("commission_amount", { precision: 18, scale: 2 }),
  commissionPaid: boolean("commission_paid").default(false),
  commissionPaidDate: date("commission_paid_date"),
  // Notes
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("deal_attributions_org_idx").on(table.orgId),
  dealIdx: index("deal_attributions_deal_idx").on(table.dealId),
  sourceTypeIdx: index("deal_attributions_source_type_idx").on(table.sourceType),
  brokerIdx: index("deal_attributions_broker_idx").on(table.brokerId),
}));

// Broker Activity Log - Track interactions with brokers
export const brokerActivityLog = pgTable("broker_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  brokerId: varchar("broker_id").notNull().references(() => brokerRelationships.id),
  // Activity details
  activityType: text("activity_type").notNull(), // "call", "email", "meeting", "deal_submitted", etc.
  activityDate: timestamp("activity_date").notNull().defaultNow(),
  subject: text("subject"),
  description: text("description"),
  // Associated deal if any
  sourcedDealId: varchar("sourced_deal_id").references(() => sourcedDeals.id),
  dealId: integer("deal_id").references(() => crmDeals.id),
  // User tracking
  performedBy: varchar("performed_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("broker_activity_log_org_idx").on(table.orgId),
  brokerIdx: index("broker_activity_log_broker_idx").on(table.brokerId),
  dateIdx: index("broker_activity_log_date_idx").on(table.activityDate),
}));

// Broker Portal Submissions - Audit trail for external broker submissions
export const brokerPortalSubmissionStatusEnum = pgEnum("broker_portal_submission_status", ["pending", "approved", "rejected", "duplicate"]);
export const brokerPortalSubmissions = pgTable("broker_portal_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  brokerId: varchar("broker_id").notNull().references(() => brokerRelationships.id),
  submissionToken: varchar("submission_token", { length: 64 }).notNull().unique(),
  status: brokerPortalSubmissionStatusEnum("status").notNull().default("pending"),
  // Submitted property data (before promotion to sourcedDeals)
  propertyName: text("property_name").notNull(),
  propertyAddress: text("property_address"),
  city: text("city"),
  state: text("state"),
  askingPrice: decimal("asking_price", { precision: 18, scale: 2 }),
  totalSlips: integer("total_slips"),
  grossRevenue: decimal("gross_revenue", { precision: 18, scale: 2 }),
  description: text("description"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  additionalNotes: text("additional_notes"),
  // Raw submission payload for audit
  rawPayload: jsonb("raw_payload"),
  // Review tracking
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  // Links to promoted deal if approved
  promotedToSourcedDealId: varchar("promoted_to_sourced_deal_id").references(() => sourcedDeals.id),
  // Metadata
  submitterIp: text("submitter_ip"),
  submitterUserAgent: text("submitter_user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("broker_portal_submissions_org_idx").on(table.orgId),
  brokerIdx: index("broker_portal_submissions_broker_idx").on(table.brokerId),
  statusIdx: index("broker_portal_submissions_status_idx").on(table.status),
  tokenIdx: index("broker_portal_submissions_token_idx").on(table.submissionToken),
}));

// Insert schemas and types for MarinaMatch
export const insertDealSourceSchema = createInsertSchema(dealSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateDealSourceSchema = insertDealSourceSchema.partial();
export type DealSource = typeof dealSources.$inferSelect;
export type InsertDealSource = z.infer<typeof insertDealSourceSchema>;
export type UpdateDealSource = z.infer<typeof updateDealSourceSchema>;

export const insertInvestmentMandateSchema = createInsertSchema(investmentMandates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateInvestmentMandateSchema = insertInvestmentMandateSchema.partial();
export type InvestmentMandate = typeof investmentMandates.$inferSelect;
export type InsertInvestmentMandate = z.infer<typeof insertInvestmentMandateSchema>;
export type UpdateInvestmentMandate = z.infer<typeof updateInvestmentMandateSchema>;

export const mandateCriteria = pgTable("mandate_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  mandateId: varchar("mandate_id").notNull().references(() => investmentMandates.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  criteriaType: varchar("criteria_type", { length: 50 }).notNull(),
  criteriaKey: varchar("criteria_key", { length: 100 }).notNull(),
  operator: varchar("operator", { length: 20 }).notNull().default("equals"),
  criteriaValue: text("criteria_value").notNull(),
  weight: integer("weight").default(10),
  isRequired: boolean("is_required").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  mandateIdx: index("mandate_criteria_mandate_idx").on(table.mandateId),
  orgIdx: index("mandate_criteria_org_idx").on(table.orgId),
}));

export const insertMandateCriteriaSchema = createInsertSchema(mandateCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateMandateCriteriaSchema = insertMandateCriteriaSchema.partial();
export type MandateCriteria = typeof mandateCriteria.$inferSelect;
export type InsertMandateCriteria = z.infer<typeof insertMandateCriteriaSchema>;
export type UpdateMandateCriteria = z.infer<typeof updateMandateCriteriaSchema>;

export const insertBrokerRelationshipSchema = createInsertSchema(brokerRelationships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateBrokerRelationshipSchema = insertBrokerRelationshipSchema.partial();
export type BrokerRelationship = typeof brokerRelationships.$inferSelect;
export type InsertBrokerRelationship = z.infer<typeof insertBrokerRelationshipSchema>;
export type UpdateBrokerRelationship = z.infer<typeof updateBrokerRelationshipSchema>;

export const insertSourcedDealSchema = createInsertSchema(sourcedDeals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  importedAt: true,
});
export const updateSourcedDealSchema = insertSourcedDealSchema.partial();
export type SourcedDeal = typeof sourcedDeals.$inferSelect;
export type InsertSourcedDeal = z.infer<typeof insertSourcedDealSchema>;
export type UpdateSourcedDeal = z.infer<typeof updateSourcedDealSchema>;

export const insertDealAttributionSchema = createInsertSchema(dealAttributions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateDealAttributionSchema = insertDealAttributionSchema.partial();
export type DealAttribution = typeof dealAttributions.$inferSelect;
export type InsertDealAttribution = z.infer<typeof insertDealAttributionSchema>;
export type UpdateDealAttribution = z.infer<typeof updateDealAttributionSchema>;

export const insertBrokerActivityLogSchema = createInsertSchema(brokerActivityLog).omit({
  id: true,
  createdAt: true,
});
export type BrokerActivityLog = typeof brokerActivityLog.$inferSelect;
export type InsertBrokerActivityLog = z.infer<typeof insertBrokerActivityLogSchema>;

export const insertBrokerPortalSubmissionSchema = createInsertSchema(brokerPortalSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateBrokerPortalSubmissionSchema = insertBrokerPortalSubmissionSchema.partial();
export type BrokerPortalSubmission = typeof brokerPortalSubmissions.$inferSelect;
export type InsertBrokerPortalSubmission = z.infer<typeof insertBrokerPortalSubmissionSchema>;
export type UpdateBrokerPortalSubmission = z.infer<typeof updateBrokerPortalSubmissionSchema>;

// ============================================================================
// MarinaMatch Intel - Scraped Listings & Investment Criteria
// ============================================================================

export const marinaListings = pgTable("marina_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  sourcePlatform: varchar("source_platform", { length: 100 }).notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceListingId: varchar("source_listing_id"),
  scrapeRunId: varchar("scrape_run_id"),
  dedupeHash: varchar("dedupe_hash", { length: 64 }).notNull(),
  title: text("title").notNull(),
  propertyName: text("property_name"),
  propertyAddress: text("property_address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 50 }),
  zipCode: varchar("zip_code", { length: 20 }),
  region: varchar("region", { length: 100 }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  marinaType: varchar("marina_type", { length: 50 }),
  propertyType: varchar("property_type", { length: 50 }),
  dealType: varchar("deal_type", { length: 50 }),
  totalSlips: integer("total_slips"),
  wetSlips: integer("wet_slips"),
  dryStorageSpaces: integer("dry_storage_spaces"),
  acreage: numeric("acreage", { precision: 10, scale: 2 }),
  waterFrontage: numeric("water_frontage", { precision: 10, scale: 2 }),
  hasFuel: boolean("has_fuel").default(false),
  hasShipStore: boolean("has_ship_store").default(false),
  hasRestaurant: boolean("has_restaurant").default(false),
  hasRepairShop: boolean("has_repair_shop").default(false),
  hasDryStorage: boolean("has_dry_storage").default(false),
  hasBoatRamp: boolean("has_boat_ramp").default(false),
  amenities: jsonb("amenities"),
  askingPrice: numeric("asking_price", { precision: 15, scale: 2 }),
  pricePerSlip: numeric("price_per_slip", { precision: 12, scale: 2 }),
  grossRevenue: numeric("gross_revenue", { precision: 15, scale: 2 }),
  noi: numeric("noi", { precision: 15, scale: 2 }),
  ebitda: numeric("ebitda", { precision: 15, scale: 2 }),
  capRate: numeric("cap_rate", { precision: 5, scale: 2 }),
  occupancyRate: numeric("occupancy_rate", { precision: 5, scale: 2 }),
  status: varchar("status", { length: 30 }).default("active"),
  isFeatured: boolean("is_featured").default(false),
  isReviewed: boolean("is_reviewed").default(false),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  bestCriteriaId: varchar("best_criteria_id"),
  bestMatchScore: integer("best_match_score"),
  matchScores: jsonb("match_scores"),
  brokerName: text("broker_name"),
  brokerCompany: text("broker_company"),
  brokerPhone: varchar("broker_phone", { length: 50 }),
  brokerEmail: varchar("broker_email", { length: 255 }),
  attributionText: text("attribution_text"),
  originalDescription: text("original_description"),
  heroImageUrl: text("hero_image_url"),
  images: jsonb("images"),
  services: text("services").array(),
  tenantSummary: text("tenant_summary"),
  extractionConfidence: integer("extraction_confidence"),
  listingDate: timestamp("listing_date"),
  lastScrapedAt: timestamp("last_scraped_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orgIdx: index("marina_listings_org_idx").on(table.orgId),
  sourceIdx: index("marina_listings_source_idx").on(table.sourcePlatform),
  statusIdx: index("marina_listings_status_idx").on(table.status),
  stateIdx: index("marina_listings_state_idx").on(table.state),
}));

export const investmentCriteriaProfiles = pgTable("investment_criteria_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull().default("Default Investment Criteria"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  minMatchScoreAlert: integer("min_match_score_alert").default(70),
  locationWeight: integer("location_weight").default(20),
  financialWeight: integer("financial_weight").default(25),
  operationalWeight: integer("operational_weight").default(15),
  sizeWeight: integer("size_weight").default(15),
  capitalWeight: integer("capital_weight").default(10),
  involvementWeight: integer("involvement_weight").default(5),
  capexWeight: integer("capex_weight").default(10),
  
  // Enhanced Alert Settings (from guidance docs)
  alertEnabled: boolean("alert_enabled").default(true),
  alertFrequency: varchar("alert_frequency", { length: 20 }).default("daily"), // instant, daily, weekly
  alertMaxListingsPerEmail: integer("alert_max_listings_per_email").default(20),
  
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orgIdx: index("criteria_profiles_org_idx").on(table.orgId),
}));

export const investmentCriteriaLocation = pgTable("investment_criteria_location", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  targetStates: text("target_states").array(),
  targetRegions: text("target_regions").array(),
  targetMetros: text("target_metros").array(),
  excludedStates: text("excluded_states").array(),
  maxDistanceFromCoast: integer("max_distance_from_coast"),
  preferIcwAccess: boolean("prefer_icw_access").default(false),
  preferOceanAccess: boolean("prefer_ocean_access").default(false),
  
  // Enhanced with must-have and importance (from guidance docs)
  geographyMustHave: boolean("geography_must_have").default(true),
  geographyImportance: integer("geography_importance").default(5), // 1-5 scale
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const investmentCriteriaFinancial = pgTable("investment_criteria_financial", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  
  // Price criteria with must-have and importance
  minAskingPrice: numeric("min_asking_price", { precision: 15, scale: 2 }),
  maxAskingPrice: numeric("max_asking_price", { precision: 15, scale: 2 }),
  priceMustHave: boolean("price_must_have").default(true),
  priceImportance: integer("price_importance").default(5), // 1-5 scale
  
  // Revenue criteria with metric type
  minGrossRevenue: numeric("min_gross_revenue", { precision: 15, scale: 2 }),
  maxGrossRevenue: numeric("max_gross_revenue", { precision: 15, scale: 2 }),
  revenueMetricType: varchar("revenue_metric_type", { length: 20 }).default("T12"), // T12, Average3Yr, ProFormaYear1
  revenueMustHave: boolean("revenue_must_have").default(false),
  revenueImportance: integer("revenue_importance").default(3),
  
  // Cap Rate with type selection
  minCapRate: numeric("min_cap_rate", { precision: 5, scale: 2 }),
  maxCapRate: numeric("max_cap_rate", { precision: 5, scale: 2 }),
  capRateType: varchar("cap_rate_type", { length: 20 }).default("T12"), // T12, ProFormaYear1, Stabilized
  capRateMustHave: boolean("cap_rate_must_have").default(false),
  capRateImportance: integer("cap_rate_importance").default(4),
  
  // EBITDA criteria
  minEbitda: numeric("min_ebitda", { precision: 15, scale: 2 }),
  maxEbitda: numeric("max_ebitda", { precision: 15, scale: 2 }),
  ebitdaMetricType: varchar("ebitda_metric_type", { length: 20 }).default("T12"),
  ebitdaMustHave: boolean("ebitda_must_have").default(false),
  ebitdaImportance: integer("ebitda_importance").default(3),
  
  // NOI criteria
  minNoi: numeric("min_noi", { precision: 15, scale: 2 }),
  maxNoi: numeric("max_noi", { precision: 15, scale: 2 }),
  noiMustHave: boolean("noi_must_have").default(false),
  noiImportance: integer("noi_importance").default(3),
  
  // Operating Margin (EBITDA/Revenue as decimal, e.g., 0.25 = 25%)
  minOperatingMargin: numeric("min_operating_margin", { precision: 5, scale: 4 }),
  maxOperatingMargin: numeric("max_operating_margin", { precision: 5, scale: 4 }),
  operatingMarginMustHave: boolean("operating_margin_must_have").default(false),
  operatingMarginImportance: integer("operating_margin_importance").default(4),
  
  // Price per slip criteria
  minPricePerSlip: numeric("min_price_per_slip", { precision: 12, scale: 2 }),
  maxPricePerSlip: numeric("max_price_per_slip", { precision: 12, scale: 2 }),
  pricePerSlipMustHave: boolean("price_per_slip_must_have").default(false),
  pricePerSlipImportance: integer("price_per_slip_importance").default(2),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const investmentCriteriaOperational = pgTable("investment_criteria_operational", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  targetMarinaTypes: text("target_marina_types").array(),
  targetPropertyTypes: text("target_property_types").array(),
  minOccupancyRate: numeric("min_occupancy_rate", { precision: 5, scale: 2 }),
  requireFuelDock: boolean("require_fuel_dock").default(false),
  requireShipStore: boolean("require_ship_store").default(false),
  requireRepairShop: boolean("require_repair_shop").default(false),
  requireRestaurant: boolean("require_restaurant").default(false),
  requireDryStorage: boolean("require_dry_storage").default(false),
  requireBoatRamp: boolean("require_boat_ramp").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const investmentCriteriaSize = pgTable("investment_criteria_size", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  minTotalSlips: integer("min_total_slips"),
  maxTotalSlips: integer("max_total_slips"),
  minWetSlips: integer("min_wet_slips"),
  maxWetSlips: integer("max_wet_slips"),
  minDryStorage: integer("min_dry_storage"),
  maxDryStorage: integer("max_dry_storage"),
  minAcreage: numeric("min_acreage", { precision: 10, scale: 2 }),
  maxAcreage: numeric("max_acreage", { precision: 10, scale: 2 }),
  minWaterFrontage: numeric("min_water_frontage", { precision: 10, scale: 2 }),
  maxWaterFrontage: numeric("max_water_frontage", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const investmentCriteriaCapital = pgTable("investment_criteria_capital", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  totalCapitalAvailable: numeric("total_capital_available", { precision: 15, scale: 2 }),
  maxEquityPerDeal: numeric("max_equity_per_deal", { precision: 15, scale: 2 }),
  targetLtvRatio: numeric("target_ltv_ratio", { precision: 5, scale: 2 }),
  preferredDebtType: varchar("preferred_debt_type", { length: 50 }),
  minCashOnCashReturn: numeric("min_cash_on_cash_return", { precision: 5, scale: 2 }),
  minIrrTarget: numeric("min_irr_target", { precision: 5, scale: 2 }),
  targetHoldPeriod: integer("target_hold_period"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const investmentCriteriaInvolvement = pgTable("investment_criteria_involvement", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  involvementLevel: varchar("involvement_level", { length: 30 }),
  requireManagementInPlace: boolean("require_management_in_place").default(false),
  willingToRelocate: boolean("willing_to_relocate").default(false),
  maxTravelDistance: integer("max_travel_distance"),
  hoursPerWeekAvailable: integer("hours_per_week_available"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const investmentCriteriaCapex = pgTable("investment_criteria_capex", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  deferredMaintenanceTolerance: varchar("deferred_maintenance_tolerance", { length: 30 }),
  maxCapexBudget: numeric("max_capex_budget", { precision: 15, scale: 2 }),
  capexAsPercentOfPurchase: numeric("capex_as_percent_of_purchase", { precision: 5, scale: 2 }),
  preferTurnkey: boolean("prefer_turnkey").default(true),
  willingToRenovate: boolean("willing_to_renovate").default(false),
  environmentalIssuesOk: boolean("environmental_issues_ok").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Storage Revenue Mix Criteria - Per guidance docs
// Allows user to define which departments count as "storage" and min/max % share
// ============================================================================
export const investmentCriteriaStorageMix = pgTable("investment_criteria_storage_mix", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  
  // Which departments to include in the "Storage" bucket
  // Default: Wet Slips, Lift Slips, Dry Racks, Moorings, Trailer Storage, Indoor Storage
  includedDepartments: jsonb("included_departments").default(sql`'["Wet Slips", "Lift Slips", "Dry Racks", "Moorings", "Trailer Storage", "Indoor Storage"]'::jsonb`),
  
  // Min/max % of total revenue from storage departments (0-1 as decimal)
  minStorageShare: numeric("min_storage_share", { precision: 5, scale: 4 }),
  maxStorageShare: numeric("max_storage_share", { precision: 5, scale: 4 }),
  
  // Hard filter or soft preference
  storageMixMustHave: boolean("storage_mix_must_have").default(true),
  storageMixImportance: integer("storage_mix_importance").default(5), // 1-5 scale
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Department Configuration - Exclusions, Preferences, Max Share Limits
// Per guidance docs: allow user to exclude, prefer, or cap certain revenue segments
// ============================================================================
export const investmentCriteriaDepartments = pgTable("investment_criteria_departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  
  // Departments to exclude entirely (hard filter)
  // Example: ["Boat Sales", "F&B"]
  excludedDepartments: jsonb("excluded_departments").default(sql`'[]'::jsonb`),
  
  // Departments that increase score if present
  // Example: ["Fuel", "Ship Store"]
  preferredDepartments: jsonb("preferred_departments").default(sql`'[]'::jsonb`),
  
  // Max allowed revenue share per department (soft cap with score penalty)
  // Example: { "Boat Sales": 0.10, "F&B": 0.20 }
  maxSharePerDepartment: jsonb("max_share_per_department").default(sql`'{}'::jsonb`),
  
  // How strictly to enforce exclusions
  excludeMode: varchar("exclude_mode", { length: 20 }).default("reject"), // reject = hard, penalize = soft
  excludeThreshold: numeric("exclude_threshold", { precision: 5, scale: 4 }).default("0.01"), // Revenue % threshold to trigger exclusion
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// Storage Types & Rates Criteria - Per guidance docs
// Define desired storage types and minimum rates per type
// ============================================================================
export const investmentCriteriaStorageTypes = pgTable("investment_criteria_storage_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  profileId: varchar("profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  
  // Desired storage types
  // Example: ["Wet Slips", "Lift Slips", "Dry Racks"]
  desiredTypes: jsonb("desired_types").default(sql`'["Wet Slips"]'::jsonb`),
  
  // Minimum total slip/storage count across all types
  minTotalSlips: integer("min_total_slips"),
  
  // Minimum rates per storage type (JSONB array of objects)
  // Example: [{ "type": "Wet Slips", "minRate": 18, "basis": "$/ft/month" }]
  storageRates: jsonb("storage_rates").default(sql`'[]'::jsonb`),
  
  // Scoring settings
  storageTypesMustHave: boolean("storage_types_must_have").default(false),
  storageTypesImportance: integer("storage_types_importance").default(3),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const marinaMatchGoals = pgTable("marina_match_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  goalType: varchar("goal_type", { length: 50 }).notNull(),
  goalName: varchar("goal_name", { length: 255 }).notNull(),
  targetValue: numeric("target_value", { precision: 15, scale: 2 }).notNull(),
  currentValue: numeric("current_value", { precision: 15, scale: 2 }).default("0"),
  timePeriod: varchar("time_period", { length: 30 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  priority: integer("priority").default(0),
  isPrimary: boolean("is_primary").default(false),
  displayFormat: varchar("display_format", { length: 30 }).default("number"),
  color: varchar("color", { length: 20 }),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orgIdx: index("goals_org_idx").on(table.orgId),
}));

export const marinaMatchGoalProgress = pgTable("marina_match_goal_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  goalId: varchar("goal_id").notNull().references(() => marinaMatchGoals.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  recordedValue: numeric("recorded_value", { precision: 15, scale: 2 }).notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const marinaScrapeources = pgTable("marina_scrape_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  platform: varchar("platform", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  baseUrl: text("base_url"),
  searchUrl: text("search_url"),
  config: jsonb("config"),
  rateLimitRpm: integer("rate_limit_rpm").default(30),
  respectRobotsTxt: boolean("respect_robots_txt").default(true),
  userAgent: varchar("user_agent", { length: 255 }).default("MarinaMatchBot/1.0"),
  isActive: boolean("is_active").default(true),
  isManaged: boolean("is_managed").default(false), // True for system-created default sources
  
  // Ingestion method configuration
  ingestionMethod: varchar("ingestion_method", { length: 30 }).default("scraping"), // api, feed, scraping, manual, rss
  
  // Search/filter configuration for marina listings
  propertyType: varchar("property_type", { length: 50 }).default("marina"),
  keywordsInclude: text("keywords_include").array().default(sql`ARRAY['marina', 'boatyard', 'yacht club', 'boat slip', 'dock', 'waterfront marina']`),
  keywordsExclude: text("keywords_exclude").array().default(sql`ARRAY['rv storage', 'self-storage', 'warehouse', 'mini storage']`),
  
  // Geography filters
  geographyStates: text("geography_states").array(), // Array of state abbreviations to filter
  geographyRegion: varchar("geography_region", { length: 100 }), // Optional region name
  geographyRadius: numeric("geography_radius", { precision: 10, scale: 2 }), // Radius in miles from center point
  
  // Price and size filters
  minPrice: numeric("min_price", { precision: 15, scale: 2 }),
  maxPrice: numeric("max_price", { precision: 15, scale: 2 }),
  minSlips: integer("min_slips"),
  maxSlips: integer("max_slips"),
  
  // Polling configuration
  pollingIntervalMinutes: integer("polling_interval_minutes").default(60),
  
  // Multi-page crawl configuration
  seedUrls: text("seed_urls").array(), // Multiple starting URLs for crawling
  crawlMode: varchar("crawl_mode", { length: 30 }).default("single"), // single, pagination, multi_seed, sitemap
  paginationSelector: varchar("pagination_selector", { length: 255 }), // CSS selector for "Next" button/link
  paginationUrlPattern: varchar("pagination_url_pattern", { length: 500 }), // URL pattern with {page} placeholder
  listingLinkSelector: varchar("listing_link_selector", { length: 255 }), // CSS selector to find listing detail links
  maxPagesPerRun: integer("max_pages_per_run").default(10), // Limit pages crawled per run
  maxCrawlDepth: integer("max_crawl_depth").default(1), // How many link levels to follow
  tokenBudgetPerRun: numeric("token_budget_per_run", { precision: 10, scale: 4 }).default("0.50"), // Max $ to spend on AI per run
  
  // Delta tracking for detecting new/updated listings
  lastSeenListingId: varchar("last_seen_listing_id", { length: 255 }),
  lastSeenContentHash: varchar("last_seen_content_hash", { length: 64 }),
  lastDeltaCheckAt: timestamp("last_delta_check_at"),
  
  // Source capabilities (what methods this source supports)
  capabilities: text("capabilities").array().default(sql`ARRAY['scraping']`), // api, scraping, rss, webhook, manual
  capabilityNotes: text("capability_notes"), // Notes about API access requirements, etc.
  
  // Scrape tracking
  lastScrapeAt: timestamp("last_scrape_at"),
  lastScrapeStatus: varchar("last_scrape_status", { length: 30 }),
  lastScrapeCount: integer("last_scrape_count"),
  totalListingsFound: integer("total_listings_found").default(0),
  
  // Source health tracking
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  consecutiveFailures: integer("consecutive_failures").default(0),
  lastFailureReason: text("last_failure_reason"),
  healthStatus: varchar("health_status", { length: 20 }).default("unknown"), // unknown, healthy, warning, failing, disabled
  lastFetchMethod: varchar("last_fetch_method", { length: 20 }), // static, headless
  requiresJsRendering: boolean("requires_js_rendering").default(false), // Auto-learned preference
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orgIdx: index("scrape_sources_org_idx").on(table.orgId),
}));

export const marinaScrapeRuns = pgTable("marina_scrape_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  sourceId: varchar("source_id").references(() => marinaScrapeources.id, { onDelete: "set null" }),
  platform: varchar("platform", { length: 255 }).notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  listingsFound: integer("listings_found").default(0),
  listingsNew: integer("listings_new").default(0),
  listingsUpdated: integer("listings_updated").default(0),
  listingsRemoved: integer("listings_removed").default(0),
  errorsCount: integer("errors_count").default(0),
  
  // Multi-page crawl tracking
  pagesCrawled: integer("pages_crawled").default(0),
  pagesSkipped: integer("pages_skipped").default(0),
  linksDiscovered: integer("links_discovered").default(0),
  tokensCost: numeric("tokens_cost", { precision: 10, scale: 4 }).default("0"), // Estimated $ spent on AI
  
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("scrape_runs_org_idx").on(table.orgId),
}));

export const marinaListingMatches = pgTable("marina_listing_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  listingId: varchar("listing_id").notNull().references(() => marinaListings.id, { onDelete: "cascade" }),
  criteriaProfileId: varchar("criteria_profile_id").notNull().references(() => investmentCriteriaProfiles.id, { onDelete: "cascade" }),
  orgId: varchar("org_id").notNull(),
  overallScore: integer("overall_score").notNull(),
  locationScore: integer("location_score"),
  financialScore: integer("financial_score"),
  operationalScore: integer("operational_score"),
  sizeScore: integer("size_score"),
  capitalScore: integer("capital_score"),
  involvementScore: integer("involvement_score"),
  capexScore: integer("capex_score"),
  scoreBreakdown: jsonb("score_breakdown"),
  passesHardRequirements: boolean("passes_hard_requirements").default(true),
  disqualificationReasons: jsonb("disqualification_reasons"),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
}, (table) => ({
  listingIdx: index("listing_matches_listing_idx").on(table.listingId),
  profileIdx: index("listing_matches_profile_idx").on(table.criteriaProfileId),
}));

export const marinaMatchAlerts = pgTable("marina_match_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  orgId: varchar("org_id").notNull(),
  userId: varchar("user_id"),
  name: varchar("name", { length: 255 }).notNull(),
  criteriaProfileId: varchar("criteria_profile_id").references(() => investmentCriteriaProfiles.id, { onDelete: "set null" }),
  minMatchScore: integer("min_match_score").default(70),
  sendImmediately: boolean("send_immediately").default(true),
  digestFrequency: varchar("digest_frequency", { length: 20 }),
  notifyEmail: boolean("notify_email").default(true),
  notifyInApp: boolean("notify_in_app").default(true),
  emailAddresses: text("email_addresses").array(),
  isActive: boolean("is_active").default(true),
  lastSentAt: timestamp("last_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  orgIdx: index("alerts_org_idx").on(table.orgId),
}));

export const marinaMatchAlertHistory = pgTable("marina_match_alert_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  alertId: varchar("alert_id").notNull().references(() => marinaMatchAlerts.id, { onDelete: "cascade" }),
  listingId: varchar("listing_id").references(() => marinaListings.id, { onDelete: "set null" }),
  orgId: varchar("org_id").notNull(),
  matchScore: integer("match_score").notNull(),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  channel: varchar("channel", { length: 20 }),
  status: varchar("status", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Insert schemas and types for MarinaMatch Intel
export const insertMarinaListingSchema = createInsertSchema(marinaListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastScrapedAt: true,
});
export const updateMarinaListingSchema = insertMarinaListingSchema.partial();
export type MarinaListing = typeof marinaListings.$inferSelect;
export type InsertMarinaListing = z.infer<typeof insertMarinaListingSchema>;

export const insertInvestmentCriteriaProfileSchema = createInsertSchema(investmentCriteriaProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateInvestmentCriteriaProfileSchema = insertInvestmentCriteriaProfileSchema.partial();
export type InvestmentCriteriaProfile = typeof investmentCriteriaProfiles.$inferSelect;

// Export types for new criteria tables
export type InvestmentCriteriaLocation = typeof investmentCriteriaLocation.$inferSelect;
export type InvestmentCriteriaFinancial = typeof investmentCriteriaFinancial.$inferSelect;
export type InvestmentCriteriaOperational = typeof investmentCriteriaOperational.$inferSelect;
export type InvestmentCriteriaSize = typeof investmentCriteriaSize.$inferSelect;
export type InvestmentCriteriaCapital = typeof investmentCriteriaCapital.$inferSelect;
export type InvestmentCriteriaInvolvement = typeof investmentCriteriaInvolvement.$inferSelect;
export type InvestmentCriteriaCapex = typeof investmentCriteriaCapex.$inferSelect;
export type InvestmentCriteriaStorageMix = typeof investmentCriteriaStorageMix.$inferSelect;
export type InvestmentCriteriaDepartments = typeof investmentCriteriaDepartments.$inferSelect;
export type InvestmentCriteriaStorageTypes = typeof investmentCriteriaStorageTypes.$inferSelect;
export type MarinaListingMatch = typeof marinaListingMatches.$inferSelect;

export const insertMarinaMatchGoalSchema = createInsertSchema(marinaMatchGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateMarinaMatchGoalSchema = insertMarinaMatchGoalSchema.partial();
export type MarinaMatchGoal = typeof marinaMatchGoals.$inferSelect;

export const insertMarinaScrapeSourceSchema = createInsertSchema(marinaScrapeources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateMarinaScrapeSourceSchema = insertMarinaScrapeSourceSchema.partial();
export type MarinaScrapeSource = typeof marinaScrapeources.$inferSelect;

export const insertMarinaMatchAlertSchema = createInsertSchema(marinaMatchAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateMarinaMatchAlertSchema = insertMarinaMatchAlertSchema.partial();
export type MarinaMatchAlert = typeof marinaMatchAlerts.$inferSelect;

// ============================================================================
// MarinaMatch Listing Feedback System
// Global feedback collection for AI training and listing quality improvement
// ============================================================================

export const listingFeedbackReasons = [
  "sold_closed",
  "under_contract", 
  "off_market",
  "duplicate_listing",
  "not_a_marina",
  "incorrect_information",
  "spam_or_fake",
  "broken_link",
  "other"
] as const;

export const marinaListingFeedback = pgTable("marina_listing_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  listingId: varchar("listing_id").notNull().references(() => marinaListings.id, { onDelete: "cascade" }),
  userId: varchar("user_id"),
  orgId: varchar("org_id"),
  reason: varchar("reason", { length: 50 }).notNull(),
  customReason: text("custom_reason"),
  details: text("details"),
  listingTitle: text("listing_title"),
  listingSource: varchar("listing_source", { length: 100 }),
  listingUrl: text("listing_url"),
  status: varchar("status", { length: 20 }).default("pending"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  aiPatternApplied: boolean("ai_pattern_applied").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  listingIdx: index("feedback_listing_idx").on(table.listingId),
  statusIdx: index("feedback_status_idx").on(table.status),
  reasonIdx: index("feedback_reason_idx").on(table.reason),
}));

export const marinaAiFilterPatterns = pgTable("marina_ai_filter_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  patternType: varchar("pattern_type", { length: 50 }).notNull(),
  pattern: text("pattern").notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  source: varchar("source", { length: 100 }),
  feedbackCount: integer("feedback_count").default(1),
  isActive: boolean("is_active").default(true),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).default("1.00"),
  createdFromFeedbackId: varchar("created_from_feedback_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  typeIdx: index("ai_pattern_type_idx").on(table.patternType),
  activeIdx: index("ai_pattern_active_idx").on(table.isActive),
}));

export const userHiddenListings = pgTable("user_hidden_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  orgId: varchar("org_id").notNull(),
  listingId: varchar("listing_id").notNull().references(() => marinaListings.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 50 }),
  hiddenAt: timestamp("hidden_at").notNull().defaultNow(),
}, (table) => ({
  userListingIdx: index("user_hidden_listing_idx").on(table.userId, table.listingId),
  orgListingIdx: index("org_hidden_listing_idx").on(table.orgId, table.listingId),
}));

export type UserHiddenListing = typeof userHiddenListings.$inferSelect;

export const insertListingFeedbackSchema = createInsertSchema(marinaListingFeedback).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});
export type ListingFeedback = typeof marinaListingFeedback.$inferSelect;
export type InsertListingFeedback = z.infer<typeof insertListingFeedbackSchema>;

export const insertAiFilterPatternSchema = createInsertSchema(marinaAiFilterPatterns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AiFilterPattern = typeof marinaAiFilterPatterns.$inferSelect;

// ============================================================================
// OM Builder Module (Offering Memorandum Builder)
// Tables for building and managing investment offering memorandums
// ============================================================================

export const omStatusEnum = pgEnum("om_status", ["draft", "review", "published", "archived"]);
export const omDocTypeEnum = pgEnum("om_doc_type", ["om", "executive_summary", "ic_memo", "pitch_deck"]);
export const omTemplateScopeEnum = pgEnum("om_template_scope", ["block", "page", "om"]);
export const omTemplateOwnerTypeEnum = pgEnum("om_template_owner_type", ["global", "org", "user"]);
export const omDatasetTypeEnum = pgEnum("om_dataset_type", ["underwriting", "sales_comps", "rent_comps", "market", "demographics", "custom"]);

export const oms = pgTable("oms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  projectId: varchar("project_id").notNull(),
  organizationId: varchar("organization_id"),
  dealId: varchar("deal_id").references(() => crmDeals.id, { onDelete: 'set null' }),
  modelingProjectId: varchar("modeling_project_id").references(() => modelingProjects.id, { onDelete: 'set null' }),
  name: text("name").notNull(),
  docType: omDocTypeEnum("doc_type").notNull().default('om'),
  status: omStatusEnum("status").notNull().default('draft'),
  version: integer("version").notNull().default(1),
  settings: jsonb("settings"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("oms_project_idx").on(table.projectId),
  orgIdx: index("oms_org_idx").on(table.organizationId),
  dealIdx: index("oms_deal_idx").on(table.dealId),
  modelingProjectIdx: index("oms_modeling_project_idx").on(table.modelingProjectId),
}));

export const omPages = pgTable("om_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  omId: varchar("om_id").notNull().references(() => oms.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  orderIndex: integer("order_index").notNull(),
  layout: jsonb("layout"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  omIdx: index("om_pages_om_idx").on(table.omId),
}));

export const omBlocks = pgTable("om_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  pageId: varchar("page_id").notNull().references(() => omPages.id, { onDelete: 'cascade' }),
  type: text("type").notNull(),
  orderIndex: integer("order_index").notNull(),
  content: jsonb("content").notNull(),
  dataBinding: jsonb("data_binding"),
  style: jsonb("style"),
  aiMetadata: jsonb("ai_metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  pageIdx: index("om_blocks_page_idx").on(table.pageId),
}));

export const omTemplates = pgTable("om_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  ownerType: omTemplateOwnerTypeEnum("owner_type").notNull(),
  ownerId: varchar("owner_id"),
  name: text("name").notNull(),
  scope: omTemplateScopeEnum("scope").notNull(),
  category: text("category"),
  templateData: jsonb("template_data").notNull(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  ownerIdx: index("om_templates_owner_idx").on(table.ownerType, table.ownerId),
  scopeIdx: index("om_templates_scope_idx").on(table.scope),
}));

export const omDatasets = pgTable("om_datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  projectId: varchar("project_id").notNull(),
  organizationId: varchar("organization_id"),
  name: text("name").notNull(),
  type: omDatasetTypeEnum("type").notNull(),
  sourceFileName: text("source_file_name"),
  data: jsonb("data").notNull(),
  sheetNames: text("sheet_names").array(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  projectIdx: index("om_datasets_project_idx").on(table.projectId),
  orgIdx: index("om_datasets_org_idx").on(table.organizationId),
}));

// ============================================================================
// OM Builder - Brand Kits
// ============================================================================
export const omBrandKits = pgTable("om_brand_kits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  organizationId: varchar("organization_id"),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  tokens: jsonb("tokens").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgIdx: index("om_brand_kits_org_idx").on(table.organizationId),
  userIdx: index("om_brand_kits_user_idx").on(table.userId),
}));

// ============================================================================
// OM Builder - Document Versions
// ============================================================================
export const omDocumentVersions = pgTable("om_document_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  omId: varchar("om_id").notNull().references(() => oms.id, { onDelete: 'cascade' }),
  versionNumber: integer("version_number").notNull(),
  snapshotJson: jsonb("snapshot_json").notNull(),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  omIdx: index("om_document_versions_om_idx").on(table.omId),
  versionIdx: index("om_document_versions_version_idx").on(table.omId, table.versionNumber),
}));

// ============================================================================
// OM Builder - Assets
// ============================================================================
export const omAssets = pgTable("om_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  organizationId: varchar("organization_id"),
  fileUrl: text("file_url").notNull(),
  mimeType: text("mime_type").notNull(),
  fileName: text("file_name").notNull(),
  sha256: text("sha256"),
  tags: jsonb("tags"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  userIdx: index("om_assets_user_idx").on(table.userId),
  orgIdx: index("om_assets_org_idx").on(table.organizationId),
}));

export const insertOmSchema = createInsertSchema(oms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOmSchema = insertOmSchema.partial();
export type Om = typeof oms.$inferSelect;
export type InsertOm = z.infer<typeof insertOmSchema>;

export const insertOmPageSchema = createInsertSchema(omPages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOmPageSchema = insertOmPageSchema.partial();
export type OmPage = typeof omPages.$inferSelect;
export type InsertOmPage = z.infer<typeof insertOmPageSchema>;

export const insertOmBlockSchema = createInsertSchema(omBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOmBlockSchema = insertOmBlockSchema.partial();
export type OmBlock = typeof omBlocks.$inferSelect;
export type InsertOmBlock = z.infer<typeof insertOmBlockSchema>;

export const insertOmTemplateSchema = createInsertSchema(omTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOmTemplateSchema = insertOmTemplateSchema.partial();
export type OmTemplate = typeof omTemplates.$inferSelect;
export type InsertOmTemplate = z.infer<typeof insertOmTemplateSchema>;

export const insertOmDatasetSchema = createInsertSchema(omDatasets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOmDatasetSchema = insertOmDatasetSchema.partial();
export type OmDataset = typeof omDatasets.$inferSelect;
export type InsertOmDataset = z.infer<typeof insertOmDatasetSchema>;

export const insertOmBrandKitSchema = createInsertSchema(omBrandKits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOmBrandKitSchema = insertOmBrandKitSchema.partial();
export type OmBrandKit = typeof omBrandKits.$inferSelect;
export type InsertOmBrandKit = z.infer<typeof insertOmBrandKitSchema>;

export const insertOmDocumentVersionSchema = createInsertSchema(omDocumentVersions).omit({
  id: true,
  createdAt: true,
});
export type OmDocumentVersion = typeof omDocumentVersions.$inferSelect;
export type InsertOmDocumentVersion = z.infer<typeof insertOmDocumentVersionSchema>;

export const insertOmAssetSchema = createInsertSchema(omAssets).omit({
  id: true,
  createdAt: true,
});
export type OmAsset = typeof omAssets.$inferSelect;
export type InsertOmAsset = z.infer<typeof insertOmAssetSchema>;

// ============================================================================
// MODELING SCENARIOS / CASES SYSTEM
// User-defined N cases with separate assumptions and lease-up data
// ============================================================================

// Enum for addback period types
export const addbackPeriodTypeEnum = pgEnum("addback_period_type", ["monthly", "yearly"]);

// Modeling Cases - Individual case definitions for a modeling project
export const modelingCases = pgTable("modeling_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  
  name: text("name").notNull(), // e.g., "Base Case", "Aggressive", "Conservative"
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false), // One case per project is the default
  isEnabled: boolean("is_enabled").notNull().default(true),
  
  // Core assumptions stored directly on the case for quick access
  revenueGrowthRate: decimal("revenue_growth_rate", { precision: 8, scale: 4 }), // e.g., 0.03 = 3%
  expenseGrowthRate: decimal("expense_growth_rate", { precision: 8, scale: 4 }),
  exitCapRate: decimal("exit_cap_rate", { precision: 8, scale: 4 }),
  occupancyRate: decimal("occupancy_rate", { precision: 8, scale: 4 }),
  discountRate: decimal("discount_rate", { precision: 8, scale: 4 }),
  holdPeriodYears: integer("hold_period_years"),
  
  // Lease-up assumptions (stored as JSON for flexibility)
  leaseUpSchedule: jsonb("lease_up_schedule").default(sql`'[]'`), // Array of { month: number, occupancy: number }
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("modeling_cases_project_idx").on(table.projectId),
  orgIdx: index("modeling_cases_org_idx").on(table.orgId),
  sortOrderIdx: index("modeling_cases_sort_order_idx").on(table.projectId, table.sortOrder),
}));

// Case Assumptions - Extended key-value pairs for additional assumptions per case
export const modelingCaseAssumptions = pgTable("modeling_case_assumptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull().references(() => modelingCases.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  
  key: text("key").notNull(), // e.g., "vacancy_rate", "expense_ratio", etc.
  value: text("value").notNull(),
  valueType: text("value_type").notNull().default("number"), // "number", "percentage", "currency", "text"
  category: text("category"), // Group assumptions by category
  
  // Period-specific values (for monthly/yearly overrides)
  period: text("period"), // "monthly" or "yearly" or null for global
  month: integer("month"), // 1-12 if monthly
  year: integer("year"), // Year number if yearly
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  caseIdx: index("modeling_case_assumptions_case_idx").on(table.caseId),
  projectIdx: index("modeling_case_assumptions_project_idx").on(table.projectId),
  keyIdx: index("modeling_case_assumptions_key_idx").on(table.caseId, table.key),
}));

// ============================================================================
// ADDBACKS SYSTEM
// Per-line-item addback flags and values
// ============================================================================

// Modeling Addbacks - Addback flags per line item
export const modelingAddbacks = pgTable("modeling_addbacks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => modelingProjects.id, { onDelete: 'cascade' }),
  caseId: varchar("case_id").references(() => modelingCases.id, { onDelete: 'cascade' }), // Nullable if applies to all cases
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  
  lineItemKey: text("line_item_key").notNull(), // Identifier for the P&L line item
  lineItemLabel: text("line_item_label").notNull(), // Display label for the line item
  category: text("category"), // Revenue/Expense/Other
  
  periodType: addbackPeriodTypeEnum("period_type").notNull().default("yearly"), // "monthly" or "yearly"
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("modeling_addbacks_project_idx").on(table.projectId),
  caseIdx: index("modeling_addbacks_case_idx").on(table.caseId),
  orgIdx: index("modeling_addbacks_org_idx").on(table.orgId),
  lineItemIdx: index("modeling_addbacks_line_item_idx").on(table.projectId, table.lineItemKey),
}));

// Addback Values - Period-specific addback amounts
export const modelingAddbackValues = pgTable("modeling_addback_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  addbackId: varchar("addback_id").notNull().references(() => modelingAddbacks.id, { onDelete: 'cascade' }),
  
  year: integer("year").notNull(), // Year number (1-based for projection years, or actual year)
  month: integer("month"), // 1-12 for monthly, null for yearly
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull().default("0"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  addbackIdx: index("modeling_addback_values_addback_idx").on(table.addbackId),
  periodIdx: index("modeling_addback_values_period_idx").on(table.addbackId, table.year, table.month),
}));

// ============================================================================
// DUE DILIGENCE FEES TRACKING
// Track fees paid to third-parties and deal team members
// ============================================================================

// DD Fee category enum
export const ddFeeCategoryEnum = pgEnum("dd_fee_category", [
  "legal", "accounting", "consulting", "inspection", "appraisal", 
  "environmental", "survey", "title", "lender", "broker", "other"
]);

// Due Diligence Fees - Track fees paid to contacts/companies
export const ddFees = pgTable("dd_fees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  
  // Link to CRM entities (at least one should be set)
  contactId: varchar("contact_id").references(() => crmContacts.id),
  companyId: varchar("company_id").references(() => crmCompanies.id),
  
  // Optional link to DD task
  taskId: varchar("task_id").references(() => tasks.id, { onDelete: 'set null' }),
  
  // Fee details
  category: ddFeeCategoryEnum("category").notNull().default("other"),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  dateIncurred: date("date_incurred"),
  datePaid: date("date_paid"),
  isPaid: boolean("is_paid").notNull().default(false),
  
  // Invoice/payment tracking
  invoiceNumber: text("invoice_number"),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  
  // Allocation (optional DD phase)
  phase: text("phase"), // e.g., "Initial DD", "Extended DD", "Closing"
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdx: index("dd_fees_project_idx").on(table.projectId),
  orgIdx: index("dd_fees_org_idx").on(table.orgId),
  contactIdx: index("dd_fees_contact_idx").on(table.contactId),
  companyIdx: index("dd_fees_company_idx").on(table.companyId),
  taskIdx: index("dd_fees_task_idx").on(table.taskId),
  categoryIdx: index("dd_fees_category_idx").on(table.projectId, table.category),
}));

// DD Fees Relations
export const ddFeesRelations = relations(ddFees, ({ one }) => ({
  project: one(projects, {
    fields: [ddFees.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [ddFees.orgId],
    references: [organizations.id],
  }),
  contact: one(crmContacts, {
    fields: [ddFees.contactId],
    references: [crmContacts.id],
  }),
  company: one(crmCompanies, {
    fields: [ddFees.companyId],
    references: [crmCompanies.id],
  }),
  task: one(tasks, {
    fields: [ddFees.taskId],
    references: [tasks.id],
  }),
  creator: one(users, {
    fields: [ddFees.createdBy],
    references: [users.id],
  }),
}));

// DD Fees Insert/Select schemas
export const insertDdFeeSchema = createInsertSchema(ddFees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateDdFeeSchema = insertDdFeeSchema.partial();
export type DdFee = typeof ddFees.$inferSelect;
export type InsertDdFee = z.infer<typeof insertDdFeeSchema>;

// ============================================================================
// CRM LISTS FEATURE
// User-defined lists for Contacts, Companies, Properties
// ============================================================================

// CRM List entity type enum
export const crmListEntityTypeEnum = pgEnum("crm_list_entity_type", ["contact", "company", "property"]);

// CRM Lists - User-defined list definitions
export const crmLists = pgTable("crm_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"), // Optional color for visual identification
  icon: text("icon"), // Optional icon name
  
  // Which entity types can be added to this list
  allowedEntityTypes: text("allowed_entity_types").array().default(sql`ARRAY['contact', 'company', 'property']::text[]`),
  
  isArchived: boolean("is_archived").notNull().default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("crm_lists_org_idx").on(table.orgId),
  createdByIdx: index("crm_lists_created_by_idx").on(table.createdBy),
  nameIdx: index("crm_lists_name_idx").on(table.orgId, table.name),
}));

// CRM List Items - Entity membership in lists
export const crmListItems = pgTable("crm_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull().references(() => crmLists.id, { onDelete: 'cascade' }),
  orgId: varchar("org_id").notNull().references(() => organizations.id),
  
  entityType: crmListEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(), // ID of the contact/company/property
  
  addedBy: varchar("added_by").notNull().references(() => users.id),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  notes: text("notes"),
}, (table) => ({
  listIdx: index("crm_list_items_list_idx").on(table.listId),
  orgIdx: index("crm_list_items_org_idx").on(table.orgId),
  entityIdx: index("crm_list_items_entity_idx").on(table.entityType, table.entityId),
  uniqueListEntity: index("crm_list_items_unique").on(table.listId, table.entityType, table.entityId),
}));

// ============================================================================
// MODELING CASES - RELATIONS
// ============================================================================

export const modelingCasesRelations = relations(modelingCases, ({ one, many }) => ({
  project: one(modelingProjects, {
    fields: [modelingCases.projectId],
    references: [modelingProjects.id],
  }),
  organization: one(organizations, {
    fields: [modelingCases.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [modelingCases.createdBy],
    references: [users.id],
  }),
  assumptions: many(modelingCaseAssumptions),
  addbacks: many(modelingAddbacks),
}));

export const modelingCaseAssumptionsRelations = relations(modelingCaseAssumptions, ({ one }) => ({
  case: one(modelingCases, {
    fields: [modelingCaseAssumptions.caseId],
    references: [modelingCases.id],
  }),
  project: one(modelingProjects, {
    fields: [modelingCaseAssumptions.projectId],
    references: [modelingProjects.id],
  }),
}));

export const modelingAddbacksRelations = relations(modelingAddbacks, ({ one, many }) => ({
  project: one(modelingProjects, {
    fields: [modelingAddbacks.projectId],
    references: [modelingProjects.id],
  }),
  case: one(modelingCases, {
    fields: [modelingAddbacks.caseId],
    references: [modelingCases.id],
  }),
  organization: one(organizations, {
    fields: [modelingAddbacks.orgId],
    references: [organizations.id],
  }),
  values: many(modelingAddbackValues),
}));

export const modelingAddbackValuesRelations = relations(modelingAddbackValues, ({ one }) => ({
  addback: one(modelingAddbacks, {
    fields: [modelingAddbackValues.addbackId],
    references: [modelingAddbacks.id],
  }),
}));

export const crmListsRelations = relations(crmLists, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [crmLists.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [crmLists.createdBy],
    references: [users.id],
  }),
  items: many(crmListItems),
}));

export const crmListItemsRelations = relations(crmListItems, ({ one }) => ({
  list: one(crmLists, {
    fields: [crmListItems.listId],
    references: [crmLists.id],
  }),
  organization: one(organizations, {
    fields: [crmListItems.orgId],
    references: [organizations.id],
  }),
  addedByUser: one(users, {
    fields: [crmListItems.addedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// MODELING CASES - INSERT/SELECT SCHEMAS
// ============================================================================

export const insertModelingCaseSchema = createInsertSchema(modelingCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateModelingCaseSchema = insertModelingCaseSchema.partial();
export type ModelingCase = typeof modelingCases.$inferSelect;
export type InsertModelingCase = z.infer<typeof insertModelingCaseSchema>;

export const insertModelingCaseAssumptionSchema = createInsertSchema(modelingCaseAssumptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ModelingCaseAssumption = typeof modelingCaseAssumptions.$inferSelect;
export type InsertModelingCaseAssumption = z.infer<typeof insertModelingCaseAssumptionSchema>;

export const insertModelingAddbackSchema = createInsertSchema(modelingAddbacks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateModelingAddbackSchema = insertModelingAddbackSchema.partial();
export type ModelingAddback = typeof modelingAddbacks.$inferSelect;
export type InsertModelingAddback = z.infer<typeof insertModelingAddbackSchema>;

export const insertModelingAddbackValueSchema = createInsertSchema(modelingAddbackValues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ModelingAddbackValue = typeof modelingAddbackValues.$inferSelect;
export type InsertModelingAddbackValue = z.infer<typeof insertModelingAddbackValueSchema>;

export const insertCrmListSchema = createInsertSchema(crmLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateCrmListSchema = insertCrmListSchema.partial();
export type CrmList = typeof crmLists.$inferSelect;
export type InsertCrmList = z.infer<typeof insertCrmListSchema>;

export const insertCrmListItemSchema = createInsertSchema(crmListItems).omit({
  id: true,
  addedAt: true,
});
export type CrmListItem = typeof crmListItems.$inferSelect;
export type InsertCrmListItem = z.infer<typeof insertCrmListItemSchema>;

// ============================================================================
// DockTalk 2.0 Schema Integration
// Re-export all DockTalk tables, types, and schemas from docktalk-schema.ts
// This makes them discoverable to Drizzle migrations while keeping schemas modular
// ============================================================================
export * from "./docktalk-schema";

// ============================================================================
// Financial Kernel Schema Integration
// Re-export all Financial Kernel tables, types, and schemas
// This provides the canonical financial data model for integrations platform
// ============================================================================
export * from "./finance-kernel-schema";

// ============================================================================
// Institutional Analytics Schema Integration
// Re-export all Analytics tables, types, and KPI definitions
// This provides multi-asset class performance metrics and benchmarking
// ============================================================================
export * from "./analytics-schema";

// ============================================================================
// DEAL WORKSPACES - UNIFIED HUB FOR MODELING, DD, AND VDR
// ============================================================================

export const workspaceRoleEnum = pgEnum('workspace_role', ['buyer', 'seller', 'broker', 'lender', 'consultant']);
export const workspaceStatusEnum = pgEnum('workspace_status', ['active', 'pending', 'under_contract', 'due_diligence', 'closing', 'closed', 'dead', 'on_hold']);

export const dealWorkspaces = pgTable('deal_workspaces', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar('org_id').notNull().references(() => organizations.id),
  
  // Core workspace info
  name: text('name').notNull(),
  description: text('description'),
  
  // Role/persona for this workspace
  role: workspaceRoleEnum('role').notNull().default('buyer'),
  status: workspaceStatusEnum('status').notNull().default('active'),
  
  // Linked entities - the unified hub
  dealId: varchar('deal_id').references(() => crmDeals.id),
  modelingProjectId: varchar('modeling_project_id').references(() => modelingProjects.id),
  ddProjectId: varchar('dd_project_id').references(() => projects.id),
  propertyId: varchar('property_id').references(() => crmProperties.id),
  
  // Key metrics for dashboard display
  targetPrice: decimal('target_price', { precision: 15, scale: 2 }),
  expectedCloseDate: date('expected_close_date'),
  priority: text('priority').default('medium'),
  
  // Activity tracking
  lastActivityAt: timestamp('last_activity_at'),
  lastActivityType: text('last_activity_type'),
  lastActivityDescription: text('last_activity_description'),
  
  // Counters for quick reference
  openDdTasks: integer('open_dd_tasks').default(0),
  totalDdTasks: integer('total_dd_tasks').default(0),
  pendingDocuments: integer('pending_documents').default(0),
  
  // Metadata
  createdBy: varchar('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  archivedAt: timestamp('archived_at'),
}, (table) => ({
  orgIdx: index('deal_workspaces_org_idx').on(table.orgId),
  statusIdx: index('deal_workspaces_status_idx').on(table.status),
  roleIdx: index('deal_workspaces_role_idx').on(table.role),
  dealIdx: index('deal_workspaces_deal_idx').on(table.dealId),
  modelingIdx: index('deal_workspaces_modeling_idx').on(table.modelingProjectId),
  ddProjectIdx: index('deal_workspaces_dd_project_idx').on(table.ddProjectId),
}));

export const dealWorkspacesRelations = relations(dealWorkspaces, ({ one }) => ({
  organization: one(organizations, {
    fields: [dealWorkspaces.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [dealWorkspaces.createdBy],
    references: [users.id],
  }),
  deal: one(crmDeals, {
    fields: [dealWorkspaces.dealId],
    references: [crmDeals.id],
  }),
  modelingProject: one(modelingProjects, {
    fields: [dealWorkspaces.modelingProjectId],
    references: [modelingProjects.id],
  }),
  ddProject: one(projects, {
    fields: [dealWorkspaces.ddProjectId],
    references: [projects.id],
  }),
  property: one(crmProperties, {
    fields: [dealWorkspaces.propertyId],
    references: [crmProperties.id],
  }),
}));

export const insertDealWorkspaceSchema = createInsertSchema(dealWorkspaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateDealWorkspaceSchema = insertDealWorkspaceSchema.partial();
export type DealWorkspace = typeof dealWorkspaces.$inferSelect;
export type InsertDealWorkspace = z.infer<typeof insertDealWorkspaceSchema>;
